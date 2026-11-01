// Handel wie im Vorbild: freier Händler mit Schiff, Kauf- und Verkaufsaufträge am Kontor, Handelsrouten.
//
// Freier Händler: ein neutraler Spieler (Player.trader, weiße Flagge, unangreifbar). Sobald es ein Kontor gibt,
// kommt alle 3 bis 6 Minuten ein Händlerschiff vom Kartenrand an jedes Kontor mit Küste, liegt etwa 40 Sekunden
// im Hafen und handelt nach den Aufträgen dieses Kontors (visit). Danach fährt es zum nächsten fälligen Kontor
// oder wieder hinaus. Liegt ein bewaffnetes feindliches Schiff vor dem Kontor, kommt er nicht (Blockade).
//
// Preise: Grundpreis (PRICES.kaufen, Waffen beim Kauf × 3) schwankt langsam um ± 15 %. Jede Tonne, die der
// Händler verkauft, macht die Ware teurer (je 10 t um 8 %), jede Tonne, die er ankauft, billiger; das erholt
// sich in etwa 5 Minuten. Ein Kaufauftrag wird bedient, solange der gebotene Preis mindestens 90 % des
// Marktpreises beträgt; ein Verkaufsauftrag, solange der verlangte Preis höchstens 85 % davon beträgt.
// Höchstens 40 t je Ware und Besuch (Waffen: 10 t). Der Händler verkauft nur, was schon einmal in einem Lager
// war, dazu immer Werkzeug, Erz, Holz, Nahrung und (knapp und teuer) Waffen.
//
// Handelsrouten: je Schiff 2 bis 4 Halte an eigenen Kontoren; je Halt „laden bis X t an Bord“ und
// „ausladen bis zu X t“ je Ware (höchstens 100 t). Das Schiff fährt allein, wartet bei vollem Ziel oder leerer
// Quelle bis zu 30 Sekunden (Meldung „Route blockiert“) und fährt dann weiter. Lenkt der Spieler das Schiff
// selbst, pausiert die Route.
//
// Sofort-Handel am Kontor bleibt als teurer Notbehelf: notFaktor() = 1,4, sobald Händlerschiffe fahren.
// Alle Käufe und Verkäufe gehen ins Kassenbuch (stats.book, Art „handel“).
// Zustand im Spielstand: SaveData.ext.trade (eigene Versionsnummer v; alte Stände ohne Eintrag starten leer).
import { GOOD, GOODS, GoodId, PRICES, SHIPS } from './data';
import { atWar } from './combat';
import { DOCK_RANGE, HUMAN } from './game';
import type { Building, Check, Game, Player, Ship } from './game';
import { book } from './stats';
import type { GameSystem } from './systems';

/** Auftrag am Kontor: kaufen bis zur Schwelle oder verkaufen über der Schwelle, zum Preis in Taler je Tonne */
export interface TradeOrder {
  g: GoodId;
  /** true = kaufen, false = verkaufen */
  buy: boolean;
  /** kaufen bis zu so vielen Tonnen im Lager bzw. verkaufen, was darüber liegt */
  limit: number;
  /** Preis je Tonne */
  price: number;
}

/** ein Halt einer Handelsroute */
export interface RouteStop {
  /** Kontor (Gebäude-id) */
  kontor: number;
  /** hier einladen: Ware → so viele Tonnen sollen danach an Bord sein */
  laden: Partial<Record<GoodId, number>>;
  /** hier ausladen: Ware → bis zu so viele Tonnen */
  entladen: Partial<Record<GoodId, number>>;
}

/** Handelsroute eines Schiffs (2–4 Halte) */
export interface TradeRoute {
  stops: RouteStop[];
  /** läuft (true) oder pausiert */
  on: boolean;
  /** nächster Halt (Index in stops) */
  next: number;
  /** warum es gerade nicht weitergeht (z. B. „Ziel voll“), sonst leer */
  blocked?: string;
  /** Sekunden am aktuellen Halt (Laden dauert ein paar Sekunden) */
  t?: number;
  /** so lange wartet das Schiff schon wegen einer Blockade an diesem Halt */
  wait?: number;
  /** Ziel, das die Route dem Schiff gegeben hat (anderes Ziel = der Spieler hat selbst gelenkt) */
  goal?: [number, number];
  /** fehlgeschlagene Versuche, einen Seeweg zu finden */
  fails?: number;
}

/** Preisliste eines Händlers: Taler je Tonne (kaufen = so viel zahlt der Spieler, verkaufen = so viel bekommt er) */
export type PriceTable = Partial<Record<GoodId, { kaufen: number; verkaufen: number }>>;

/** ein Geschäft bei einem Besuch: tons > 0 gekauft, < 0 verkauft; taler > 0 Einnahme, < 0 Ausgabe */
export interface Deal { g: GoodId; tons: number; taler: number }

/** Ergebnis eines Händlerbesuchs (tons = bewegte Tonnen, taler = Saldo für den Kontorbesitzer) */
export interface VisitResult { tons: number; taler: number; deals?: Deal[] }

// ---------- Werte (nach dem Vorbild) ----------

/** Auftragsplätze je Kontorstufe I–IV: kaufen / verkaufen */
export const BUY_SLOTS = [4, 7, 8, 11];
export const SELL_SLOTS = [3, 4, 6, 8];
/** höchstens so viele Tonnen je Ware und Besuch */
export const MAX_PER_VISIT = 40;
/** Waffen: knapp (höchstens 10 t je Besuch) und teuer (dreifacher Preis beim Kauf) */
export const WEAPONS: readonly GoodId[] = ['schwerter', 'musketen', 'kanonen'];
const WEAPON_MAX = 10;
const WEAPON_FACTOR = 3;
/** verkauft der Händler immer (auch wenn es auf der Karte noch keiner hatte) */
const ALWAYS: readonly GoodId[] = ['werkzeug', 'erz', 'holz', 'nahrung'];
/** Auftragspreis: 70 bis 105 % des Grundpreises */
export const PRICE_MIN = 0.7;
export const PRICE_MAX = 1.05;
/** Schwankung des Grundpreises ± 15 % */
const DRIFT = 0.15;
/** je Tonne ändert sich der Marktpreis um 0,8 % (je 10 t um 8 %), Erholung in etwa 5 Minuten */
const PRESS_PER_TON = 0.008;
const PRESS_TAU = 100;
/** Kaufauftrag wird bedient ab 90 % des Marktpreises, Verkaufsauftrag bis 85 % */
const ASK = 0.9;
const BID = 0.85;
/** Händler im Hafen (Sekunden), Abstand der Besuche je Kontor, erster Besuch nach der Gründung */
export const STAY = 40;
const VISIT_MIN = 180, VISIT_MAX = 360;
const FIRST_MIN = 60, FIRST_MAX = 120;
/** Blockade: bewaffnetes feindliches Schiff so nah am Kontor */
export const BLOCK_RANGE = 10;
/** Aufschlag des Sofort-Handels, sobald Händlerschiffe fahren */
const NOT_FAKTOR = 1.4;
/** Handelsroute: höchstens so viele Tonnen je Ware und Halt, Ladezeit, Wartezeit bei Blockade */
export const ROUTE_MAX = 100;
export const ROUTE_STOPS = 4;
const LOAD_TIME = 4;
const ROUTE_WAIT = 30;

// ---------- Zustand ----------

interface TraderShip {
  /** Schiffs-id */
  id: number;
  /** hin = fährt zum Kontor k, hafen = liegt dort, weg = fährt zum Kartenrand */
  phase: 'hin' | 'hafen' | 'weg';
  /** Kontor-id (bei hin/hafen) */
  k: number;
  t: number;
  fails: number;
}

interface State {
  v: 1;
  /** Händler fahren (ab dem ersten Kontor) */
  active: boolean;
  /** Aufträge je Kontor (Besitzer dazu: wechselt der Besitzer, verfallen sie) */
  orders: Record<string, { owner: number; list: TradeOrder[] }>;
  /** Handelsroute je Schiff */
  routes: Record<string, TradeRoute>;
  /** Waren, die schon einmal in einem Lager waren (Sortiment des Händlers) */
  known: GoodId[];
  /** Schwankung des Grundpreises (0,85 … 1,15) */
  drift: Partial<Record<GoodId, number>>;
  /** Nachfrage durch Käufe/Verkäufe (+ = teurer) */
  press: Partial<Record<GoodId, number>>;
  /** nächster Besuch je Kontor (Spielzeit) */
  due: Record<string, number>;
  ships: TraderShip[];
  /** erster Hinweis auf die Aufträge schon gegeben */
  hinted?: boolean;
  /** Hinweis auf Handelsrouten schon gegeben */
  routeHint?: boolean;
  /** letzte Meldungen (gegen zu viele Meldungen): Schlüssel → Spielzeit */
  said: Record<string, number>;
}

const fresh = (): State => ({ v: 1, active: false, orders: {}, routes: {}, known: [], drift: {}, press: {}, due: {}, ships: [], said: {} });
const states = new WeakMap<Game, State>();
/** nur zur Laufzeit: Anlegestellen je Kontor, Zeitgeber */
interface Runtime { dock: Map<number, { v: number; at: [number, number] | null; alt: [number, number] | null }>; slow: number; drift: number; dispatch: number }
const runtimes = new WeakMap<Game, Runtime>();

function S(g: Game): State {
  let s = states.get(g);
  if (!s) { s = fresh(); states.set(g, s); }
  return s;
}
function R(g: Game): Runtime {
  let r = runtimes.get(g);
  if (!r) { r = { dock: new Map(), slow: 0, drift: 0, dispatch: 0 }; runtimes.set(g, r); }
  return r;
}

const islName = (g: Game, k: Building) => g.islands[k.island]?.name ?? 'der Insel';
const atK = (g: Game, k: Building) => { const [x, y] = g.center(k); return { x, y }; };
const fmtT = (n: number) => Math.round(n).toLocaleString('de-DE');
const kontors = (g: Game) => g.buildings.filter((b) => b.type === 'kontor');

/** Meldung höchstens alle `every` Sekunden je Schlüssel */
function say(g: Game, key: string, every: number, text: string, kind: 'info' | 'good' | 'bad', at?: { x: number; y: number }) {
  const s = S(g);
  if (g.time - (s.said[key] ?? -1e9) < every) return;
  s.said[key] = g.time;
  g.ev.message(text, kind, at);
}

// ---------- Händler (Spieler) ----------

/** der freie Händler (fehlt, solange es noch kein Kontor gibt) */
export function trader(g: Game): Player | undefined {
  return g.players.find((p) => p.trader);
}

/** Ist dieser Spieler der freie Händler? (für Oberfläche und Kampf: neutral, nicht angreifbar) */
export function isTrader(g: Game, owner: number): boolean {
  return !!g.players[owner]?.trader;
}

function ensureTrader(g: Game): Player {
  let p = trader(g);
  if (!p) {
    p = { id: g.players.length, name: 'Freier Händler', color: 0xf2efe6, ai: false, money: 0, trader: true };
    g.players.push(p);
  }
  // unangreifbar: auch Piraten lassen ihn in Ruhe (Schutz „für immer“, als Zahl speicherbar)
  p.protectedUntil = 1e12;
  return p;
}

/** Fahren schon Händlerschiffe? (ab dem ersten Kontor) */
export function active(g: Game): boolean {
  return S(g).active;
}

// ---------- Preise ----------

/** Grundpreis je Tonne (buy = der Händler verkauft; Waffen dann dreifach). null = nicht handelbar */
export function basePrice(good: GoodId, buy: boolean): number | null {
  const pr = PRICES[good];
  if (!pr) return null;
  return pr.kaufen * (buy && WEAPONS.includes(good) ? WEAPON_FACTOR : 1);
}

/** erlaubte Auftragspreise (70–105 % des Grundpreises) */
export function priceRange(good: GoodId, buy: boolean): [number, number] {
  const b = basePrice(good, buy) ?? 0;
  return [Math.max(1, Math.ceil(b * PRICE_MIN - 1e-9)), Math.max(1, Math.floor(b * PRICE_MAX + 1e-9))];
}

function market(g: Game, good: GoodId, buy: boolean): number {
  const s = S(g);
  return (basePrice(good, buy) ?? 0) * (s.drift[good] ?? 1) * (1 + (s.press[good] ?? 0));
}

/**
 * Was der freie Händler gerade annimmt: kaufen = so viel muss ein Kaufauftrag mindestens bieten,
 * verkaufen = so viel darf ein Verkaufsauftrag höchstens verlangen. null = nicht handelbar.
 */
export function marketPrice(g: Game, good: GoodId): { kaufen: number; verkaufen: number } | null {
  if (!PRICES[good]) return null;
  return { kaufen: Math.ceil(market(g, good, true) * ASK), verkaufen: Math.floor(market(g, good, false) * BID) };
}

/** Verkauft der freie Händler diese Ware? */
export function sells(g: Game, good: GoodId): boolean {
  return !!PRICES[good] && (ALWAYS.includes(good) || WEAPONS.includes(good) || S(g).known.includes(good));
}

/** Sortiment des freien Händlers */
export function assortment(g: Game): GoodId[] {
  return GOODS.map((x) => x.id).filter((id) => sells(g, id));
}

/** höchstens so viele Tonnen je Besuch */
export function maxPerVisit(good: GoodId): number {
  return WEAPONS.includes(good) ? WEAPON_MAX : MAX_PER_VISIT;
}

function push(g: Game, good: GoodId, tons: number) {
  const s = S(g);
  s.press[good] = Math.max(-0.6, Math.min(1.5, (s.press[good] ?? 0) + tons * PRESS_PER_TON));
}

// ---------- Aufträge ----------

/** Aufträge eines Kontors */
export function orders(g: Game, kontor: Building): TradeOrder[] {
  const e = S(g).orders[kontor.id];
  if (!e) return [];
  if (e.owner !== kontor.owner) { delete S(g).orders[kontor.id]; return []; }
  return e.list;
}

/** Auftragsplätze des Kontors (nach Ausbaustufe) */
export function slots(kontor: Building): { buy: number; sell: number } {
  const lv = Math.max(0, Math.min(3, kontor.level ?? 0));
  return { buy: BUY_SLOTS[lv], sell: SELL_SLOTS[lv] };
}

/** Standardauftrag für eine Ware (Kaufen bis 20 t zu 100 %, Verkaufen über 20 t zu 70 %) */
export function defaultOrder(good: GoodId, buy: boolean): TradeOrder {
  const b = basePrice(good, buy) ?? 0;
  const [lo, hi] = priceRange(good, buy);
  return { g: good, buy, limit: 20, price: Math.max(lo, Math.min(hi, Math.round(b * (buy ? 1 : PRICE_MIN)))) };
}

/**
 * Auftrag setzen oder ändern (je Ware ein Auftrag). Prüft Plätze, Preis (70–105 %) und Schwelle (0 bis Lagerplatz).
 */
export function setOrder(g: Game, kontor: Building, o: TradeOrder): Check {
  if (kontor.type !== 'kontor') return { ok: false, reason: 'Aufträge gibt es nur am Kontor' };
  const base = basePrice(o.g, o.buy);
  if (base === null) return { ok: false, reason: 'Mit dieser Ware handelt der Händler nicht' };
  const list = orders(g, kontor).filter((x) => x.g !== o.g);
  const sl = slots(kontor);
  if (list.filter((x) => x.buy === o.buy).length >= (o.buy ? sl.buy : sl.sell)) {
    return { ok: false, reason: `Alle ${o.buy ? 'Kauf' : 'Verkaufs'}plätze belegt – ein größeres Kontor hat mehr` };
  }
  const [lo, hi] = priceRange(o.g, o.buy);
  const cap = Math.max(0, g.capOf(kontor.owner, kontor.island));
  const clean: TradeOrder = { g: o.g, buy: o.buy, limit: Math.max(0, Math.min(cap, Math.round(o.limit))), price: Math.max(lo, Math.min(hi, Math.round(o.price))) };
  const old = orders(g, kontor);
  const i = old.findIndex((x) => x.g === o.g);
  const next = i >= 0 ? old.map((x, j) => (j === i ? clean : x)) : [...old, clean];
  S(g).orders[kontor.id] = { owner: kontor.owner, list: next };
  return { ok: true };
}

/** Auftrag für eine Ware löschen */
export function removeOrder(g: Game, kontor: Building, good: GoodId) {
  const list = orders(g, kontor).filter((x) => x.g !== good);
  if (list.length) S(g).orders[kontor.id] = { owner: kontor.owner, list };
  else delete S(g).orders[kontor.id];
}

// ---------- Besuch ----------

/**
 * Ein Händler besucht ein Kontor und handelt nach dessen Aufträgen. Bezahlt wird der Preis des Auftrags.
 * prices = eigene Preisliste (z. B. für KI-Händler mit Handelsvertrag): dann feste Preise, kein Einfluss auf
 * den Markt, gehandelt wird nur, was in der Liste steht. Sonst gilt der Markt des freien Händlers.
 */
export function visit(g: Game, kontor: Building, prices?: PriceTable): VisitResult {
  const res: VisitResult = { tons: 0, taler: 0, deals: [] };
  const l = g.lagerOf(kontor.owner, kontor.island);
  const p = g.players[kontor.owner];
  if (!l || !p) return res;
  const cap = g.capOf(kontor.owner, kontor.island);
  for (const o of orders(g, kontor)) {
    const tbl = prices?.[o.g];
    if (prices ? !tbl : !PRICES[o.g]) continue;
    let n = 0, taler = 0;
    if (o.buy) {
      if (!prices && !sells(g, o.g)) continue;
      const max = Math.min(prices ? MAX_PER_VISIT : maxPerVisit(o.g), Math.floor(Math.min(o.limit, cap) - l[o.g]));
      while (n < max && p.money >= o.price) {
        const ask = tbl ? tbl.kaufen : market(g, o.g, true) * ASK;
        if (o.price < ask) break;
        l[o.g] += 1; p.money -= o.price; taler -= o.price; n++;
        if (!prices) push(g, o.g, 1);
      }
    } else {
      const max = Math.min(MAX_PER_VISIT, Math.floor(l[o.g] - o.limit));
      while (n < max) {
        const bid = tbl ? tbl.verkaufen : market(g, o.g, false) * BID;
        if (o.price > bid) break;
        l[o.g] -= 1; p.money += o.price; taler += o.price; n++;
        if (!prices) push(g, o.g, -1);
      }
      if (n && !prices) know(g, o.g);
    }
    if (!n) continue;
    res.tons += n; res.taler += taler;
    res.deals!.push({ g: o.g, tons: o.buy ? n : -n, taler });
    book(g, kontor.owner, 'handel', taler);
  }
  return res;
}

function know(g: Game, good: GoodId) {
  const s = S(g);
  if (!s.known.includes(good)) s.known.push(good);
}

/** Meldung nach dem Besuch an einem Kontor des Spielers */
function report(g: Game, k: Building, r: VisitResult) {
  const s = S(g), isl = islName(g, k);
  if (r.deals?.length) {
    s.hinted = true;
    const parts = r.deals.map((d) => `${d.tons > 0 ? 'gekauft' : 'verkauft'} ${Math.abs(d.tons)} t ${GOOD[d.g].icon}`);
    g.ev.message(`⛵ Händler im Hafen von ${isl}: ${parts.join(', ')} (${r.taler >= 0 ? '+' : '−'}${fmtT(Math.abs(r.taler))} Taler)`, r.taler >= 0 ? 'good' : 'info', atK(g, k));
    return;
  }
  if (!orders(g, k).length) {
    if (s.hinted) return;
    s.hinted = true;
    g.ev.message(`⛵ Händler im Hafen von ${isl}! Am Kontor unter „⚖️ Handel“ stellst du ein, was er dir verkaufen oder abkaufen soll.`, 'good', atK(g, k));
    return;
  }
  say(g, `nodeal:${k.id}`, 600, `⛵ Händler im Hafen von ${isl}: kein Geschäft – vielleicht passen die Preise oder Mengen nicht.`, 'info', atK(g, k));
}

// ---------- Blockade, Anlegestelle, Kartenrand ----------

/** Wer blockiert das Kontor? (bewaffnetes feindliches Schiff im Umkreis von 10 Feldern), sonst null */
export function blockade(g: Game, k: Building): Player | null {
  const [cx, cy] = g.center(k);
  for (const s of g.ships) {
    if (!(s.guns ?? 0) || s.owner === k.owner || g.players[s.owner]?.trader) continue;
    if (Math.hypot(s.x - cx, s.y - cy) > BLOCK_RANGE) continue;
    if (atWar(g, k.owner, s.owner)) return g.players[s.owner] ?? null;
  }
  return null;
}

const byName = (p: Player) => (p.pirate ? 'Piraten' : p.name);

/**
 * Wasserfeld vor dem Kontor, an dem Schiffe anlegen (null = keine Küste).
 * trader = Liegeplatz des Händlers: ein zweiter Platz mindestens 2,5 Felder neben dem der eigenen Schiffe
 * (damit sich Händler- und Routenschiff nicht übereinanderschieben); gibt es keinen, derselbe.
 */
export function dockAt(g: Game, k: Building, trader = false): [number, number] | null {
  const rt = R(g);
  const c = rt.dock.get(k.id);
  if (c && c.v === g.buildVersion) return trader ? c.alt : c.at;
  const [cx, cy] = g.center(k);
  const cand: { at: [number, number]; score: number }[] = [];
  const r = Math.ceil(DOCK_RANGE);
  for (let y = Math.floor(cy) - r; y <= Math.floor(cy) + r; y++) for (let x = Math.floor(cx) - r; x <= Math.floor(cx) + r; x++) {
    if (!g.inMap(x, y) || !g.isWater(g.idx(x, y))) continue;
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d > DOCK_RANGE - 0.5) continue;
    let open = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (g.inMap(x + i, y + j) && g.isWater(g.idx(x + i, y + j))) open++;
    if (open < 7) continue;
    // nicht direkt am Ufer, nicht zu weit draußen
    cand.push({ at: [x + 0.5, y + 0.5], score: Math.abs(d - 3.5) + (9 - open) * 0.3 });
  }
  cand.sort((a, b) => a.score - b.score);
  const at = cand[0]?.at ?? null;
  const alt = at ? cand.find((o) => Math.hypot(o.at[0] - at[0], o.at[1] - at[1]) >= 2.5)?.at ?? at : null;
  rt.dock.set(k.id, { v: g.buildVersion, at, alt });
  return trader ? alt : at;
}

/** liegt das Schiff am Kontor (angekommen, steht)? */
function moored(g: Game, s: Ship, k: Building): boolean {
  const [cx, cy] = g.center(k);
  return !s.path.length && Math.hypot(s.x - cx, s.y - cy) <= DOCK_RANGE + 1.5;
}

/** offenes Wasser am Kartenrand, dem Punkt (x, y) möglichst nah */
function edgePoint(g: Game, x: number, y: number): [number, number] | null {
  const N = g.size, m = 2;
  const ok = (px: number, py: number) => {
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (!g.inMap(px + i, py + j) || !g.isWater(g.idx(px + i, py + j))) return false;
    return true;
  };
  const fx = Math.max(m, Math.min(N - 1 - m, Math.floor(x))), fy = Math.max(m, Math.min(N - 1 - m, Math.floor(y)));
  const sides: [number, number, number, number][] = [[m, fy, 0, 1], [N - 1 - m, fy, 0, 1], [fx, m, 1, 0], [fx, N - 1 - m, 1, 0]];
  sides.sort((a, b) => Math.hypot(a[0] - x, a[1] - y) - Math.hypot(b[0] - x, b[1] - y));
  for (const [sx, sy, dx, dy] of sides) {
    for (let d = 0; d < N; d++) for (const sg of [1, -1]) {
      const px = sx + dx * d * sg, py = sy + dy * d * sg;
      if (px < m || py < m || px > N - 1 - m || py > N - 1 - m) continue;
      if (ok(px, py)) return [px + 0.5, py + 0.5];
    }
  }
  return null;
}

// ---------- Händlerschiffe ----------

const SHIP_NAMES = ['Weiße Möwe', 'Fortuna', 'Gute Hoffnung', 'Seestern', 'Wanderer'];

function spawnShip(g: Game, owner: number, near: [number, number]): Ship | null {
  const at = edgePoint(g, near[0], near[1]);
  if (!at) return null;
  const n = S(g).ships.length;
  const s: Ship = { id: g.nextId++, type: 'handel_gross', owner, name: SHIP_NAMES[(g.nextId + n) % SHIP_NAMES.length], x: at[0], y: at[1], dir: 0, path: [], slots: [] };
  for (let i = 0; i < SHIPS.handel_gross.slots; i++) s.slots.push({ g: null, n: 0 });
  g.ships.push(s);
  return s;
}

function removeShip(g: Game, id: number) {
  g.ships = g.ships.filter((s) => s.id !== id);
}

/** nächster Besuch je Kontor (Spielzeit) */
function schedule(g: Game, k: Building, first = false) {
  const [a, b] = first ? [FIRST_MIN, FIRST_MAX] : [VISIT_MIN, VISIT_MAX];
  S(g).due[k.id] = g.time + a + g.rng() * (b - a);
}

/** Zustand des Händlers für ein Kontor (für die Oberfläche) */
export function traderStatus(g: Game, k: Building): string {
  const s = S(g);
  if (!s.active) return '';
  const t = s.ships.find((x) => x.k === k.id && x.phase !== 'weg');
  if (t?.phase === 'hafen') return '⛵ Der Händler liegt gerade im Hafen.';
  const by = blockade(g, k);
  if (by) return `⛔ Blockiert von ${byName(by)} – der Händler kommt nicht.`;
  if (t?.phase === 'hin') return '⛵ Ein Händler ist auf dem Weg hierher.';
  if (!dockAt(g, k)) return 'Dieses Kontor hat keinen Hafen für Händlerschiffe.';
  const due = s.due[k.id];
  if (due === undefined) return '';
  const min = Math.ceil((due - g.time) / 60);
  return min <= 0 ? '⛵ Der nächste Händler kommt bald.' : `⛵ Nächster Händler in etwa ${min} ${min === 1 ? 'Minute' : 'Minuten'}.`;
}

function tickTraders(g: Game, dt: number) {
  const s = S(g), rt = R(g);
  const ks = kontors(g);
  if (!ks.length && !s.ships.length) return;
  const tr = ensureTrader(g);
  s.active = true;
  // fremde Händlerschiffe (z. B. aus einem Stand ohne Händler-Zustand) übernehmen
  for (const sh of g.ships) if (sh.owner === tr.id && !s.ships.some((x) => x.id === sh.id)) s.ships.push({ id: sh.id, phase: 'weg', k: -1, t: 0, fails: 0 });
  for (const t of [...s.ships]) {
    const sh = g.ships.find((x) => x.id === t.id);
    if (!sh) { s.ships = s.ships.filter((x) => x !== t); continue; }
    const k = t.k >= 0 ? g.byId.get(t.k) : undefined;
    if (t.phase !== 'weg' && (!k || k.type !== 'kontor')) { leave(g, t, sh); continue; }
    if (t.phase === 'hin') {
      if (!sh.path.length) {
        if (moored(g, sh, k!)) {
          const by = blockade(g, k!);
          if (by) {
            if (k!.owner === HUMAN) say(g, `block:${k!.id}`, 300, `⛔ Der Händler musste ${islName(g, k!)} verlassen: blockiert von ${byName(by)}.`, 'bad', atK(g, k!));
            s.due[k!.id] = g.time + 60;
            leave(g, t, sh);
            continue;
          }
          t.phase = 'hafen'; t.t = 0;
          const r = visit(g, k!);
          if (k!.owner === HUMAN) report(g, k!, r);
        } else {
          const at = dockAt(g, k!, true);
          t.fails++;
          if (!at || t.fails > 3 || !g.moveShip(sh, at[0], at[1])) { s.due[k!.id] = g.time + 300; leave(g, t, sh); }
        }
      }
    } else if (t.phase === 'hafen') {
      t.t += dt;
      if (t.t >= STAY) { schedule(g, k!); leave(g, t, sh); }
    } else if (!sh.path.length) {
      // am Kartenrand angekommen (oder kein Weg mehr): verschwindet
      removeShip(g, sh.id);
      s.ships = s.ships.filter((x) => x !== t);
    }
  }
  // fällige Kontore anlaufen (höchstens ein neuer Kurs je Sekunde)
  rt.dispatch -= dt;
  if (rt.dispatch > 0) return;
  rt.dispatch = 1;
  const busy = new Set(s.ships.filter((x) => x.phase !== 'weg').map((x) => x.k));
  const due = ks.filter((k) => !busy.has(k.id) && (s.due[k.id] ?? Infinity) <= g.time && !g.players[k.owner]?.pirate)
    .sort((a, b) => s.due[a.id] - s.due[b.id]);
  for (const k of due) {
    const at = dockAt(g, k, true);
    if (!at) { s.due[k.id] = g.time + 600; continue; }
    const by = blockade(g, k);
    if (by) {
      if (k.owner === HUMAN) say(g, `block:${k.id}`, 300, `⛔ Der Händler kann ${islName(g, k)} nicht anlaufen: blockiert von ${byName(by)}.`, 'bad', atK(g, k));
      s.due[k.id] = g.time + 60;
      continue;
    }
    // ein Schiff, das gerade hinausfährt, umlenken – sonst ein neues vom Kartenrand
    let t = s.ships.filter((x) => x.phase === 'weg').map((x) => ({ x, sh: g.ships.find((y) => y.id === x.id)! }))
      .filter((o) => o.sh).sort((a, b) => Math.hypot(a.sh.x - at[0], a.sh.y - at[1]) - Math.hypot(b.sh.x - at[0], b.sh.y - at[1]))[0];
    if (!t) {
      if (s.ships.length >= Math.min(5, 1 + Math.floor(ks.length / 3))) return;
      const sh = spawnShip(g, tr.id, at);
      if (!sh) return;
      const rec: TraderShip = { id: sh.id, phase: 'weg', k: -1, t: 0, fails: 0 };
      s.ships.push(rec);
      t = { x: rec, sh };
    }
    t.x.phase = 'hin'; t.x.k = k.id; t.x.t = 0; t.x.fails = 0;
    if (!g.moveShip(t.sh, at[0], at[1])) { s.due[k.id] = g.time + 300; leave(g, t.x, t.sh); }
    return; // ein Kurs je Durchgang
  }
}

/** Händlerschiff fährt weiter: zum nächsten fälligen Kontor in der Nähe oder hinaus an den Kartenrand */
function leave(g: Game, t: TraderShip, sh: Ship) {
  const s = S(g);
  t.phase = 'weg'; t.k = -1; t.t = 0; t.fails = 0;
  const busy = new Set(s.ships.filter((x) => x.phase !== 'weg').map((x) => x.k));
  const next = kontors(g).filter((k) => !busy.has(k.id) && (s.due[k.id] ?? Infinity) <= g.time + 30 && !blockade(g, k) && dockAt(g, k))
    .sort((a, b) => Math.hypot(g.center(a)[0] - sh.x, g.center(a)[1] - sh.y) - Math.hypot(g.center(b)[0] - sh.x, g.center(b)[1] - sh.y))[0];
  if (next) {
    const at = dockAt(g, next, true)!;
    if (Math.hypot(at[0] - sh.x, at[1] - sh.y) < 90 && g.moveShip(sh, at[0], at[1])) { t.phase = 'hin'; t.k = next.id; return; }
  }
  const e = edgePoint(g, sh.x, sh.y);
  if (!e || !g.moveShip(sh, e[0], e[1])) sh.path = [];
}

// ---------- Handelsrouten ----------

/** Handelsroute eines Schiffs (null = keine) */
export function route(g: Game, ship: Ship): TradeRoute | null {
  return S(g).routes[ship.id] ?? null;
}

const clampN = (n: number) => Math.max(0, Math.min(ROUTE_MAX, Math.round(n)));
function cleanStop(st: RouteStop): RouteStop {
  const m = (o: Partial<Record<GoodId, number>>) => {
    const r: Partial<Record<GoodId, number>> = {};
    for (const [k, v] of Object.entries(o) as [GoodId, number][]) if (GOOD[k] && clampN(v) > 0) r[k] = clampN(v);
    return r;
  };
  return { kontor: st.kontor, laden: m(st.laden ?? {}), entladen: m(st.entladen ?? {}) };
}

/** Route setzen oder löschen (null). Höchstens 4 Halte, je Ware höchstens 100 t. Der Lauf bleibt, wie er war. */
export function setRoute(g: Game, ship: Ship, r: TradeRoute | null) {
  const s = S(g);
  if (!r) { delete s.routes[ship.id]; return; }
  const stops = r.stops.slice(0, ROUTE_STOPS).map(cleanStop);
  s.routes[ship.id] = { ...r, stops, next: stops.length ? Math.max(0, Math.min(stops.length - 1, r.next)) : 0 };
}

/** Kann die Route laufen? (mindestens zwei Halte an verschiedenen eigenen Kontoren) */
export function routeCheck(g: Game, ship: Ship): Check {
  const r = route(g, ship);
  if (!r) return { ok: false, reason: 'Noch keine Route' };
  const ok = r.stops.filter((st) => { const k = g.byId.get(st.kontor); return !!k && k.type === 'kontor' && k.owner === ship.owner; });
  if (ok.length < r.stops.length) return { ok: false, reason: 'Ein Halt hat kein eigenes Kontor mehr' };
  if (new Set(ok.map((st) => st.kontor)).size < 2) return { ok: false, reason: 'Die Route braucht zwei verschiedene Kontore' };
  if (!r.stops.some((st) => Object.keys(st.laden).length || Object.keys(st.entladen).length)) return { ok: false, reason: 'Stelle an einem Halt ein, was geladen werden soll' };
  return { ok: true };
}

/** Route starten bzw. fortsetzen */
export function startRoute(g: Game, ship: Ship): Check {
  const c = routeCheck(g, ship);
  if (!c.ok) return c;
  const r = route(g, ship)!;
  r.on = true; r.blocked = undefined; r.t = 0; r.wait = 0; r.fails = 0; r.goal = undefined;
  return { ok: true };
}

/** Route anhalten: das Schiff bleibt stehen, die Einstellungen bleiben */
export function pauseRoute(g: Game, ship: Ship) {
  const r = route(g, ship);
  if (!r) return;
  r.on = false;
  if (r.goal && ship.path.length) { ship.path = []; ship.goal = undefined; }
  r.goal = undefined;
}

/** Waren am Halt umladen: erst ausladen, dann bis zur gewünschten Menge laden */
function exchange(g: Game, s: Ship, k: Building, st: RouteStop): { moved: number; problem?: string } {
  const l = g.lagerOf(s.owner, k.island);
  if (!l) return { moved: 0, problem: 'kein Lager' };
  const cap = g.capOf(s.owner, k.island), isl = islName(g, k);
  let moved = 0, problem: string | undefined;
  for (const [gd, n] of Object.entries(st.entladen) as [GoodId, number][]) {
    const have = g.shipCargo(s, gd);
    if (!have || !n) continue;
    const room = Math.max(0, Math.floor(cap - l[gd]));
    const t = g.shipTake(s, gd, Math.min(n, have, room));
    l[gd] += t; moved += t;
    if (!t) problem ??= `Lager auf ${isl} ist voll (${GOOD[gd].icon} ${GOOD[gd].name})`;
  }
  for (const [gd, n] of Object.entries(st.laden) as [GoodId, number][]) {
    const want = n - g.shipCargo(s, gd);
    if (want <= 0) continue;
    const t = g.shipAdd(s, gd, Math.min(want, Math.floor(l[gd])));
    l[gd] -= t; moved += t;
    if (!t) problem ??= Math.floor(l[gd]) < 1 ? `${GOOD[gd].icon} ${GOOD[gd].name} fehlt auf ${isl}` : 'Laderaum voll';
  }
  return { moved, problem };
}

function tickRoute(g: Game, s: Ship, r: TradeRoute, dt: number) {
  if (!r.on) return;
  const human = s.owner === HUMAN;
  const c = routeCheck(g, s);
  if (!c.ok) {
    r.on = false; r.blocked = c.reason; r.goal = undefined;
    if (human) g.ev.message(`🧭 Route der ${s.name} angehalten: ${c.reason}.`, 'bad');
    return;
  }
  if (r.next >= r.stops.length) r.next = 0;
  const st = r.stops[r.next];
  const k = g.byId.get(st.kontor)!;
  if (!moored(g, s, k)) {
    r.t = 0;
    if (s.path.length) {
      // der Spieler (oder ein Gefecht) hat das Schiff selbst gelenkt: Route pausieren
      if (r.goal && s.goal && (Math.abs(s.goal[0] - r.goal[0]) > 0.01 || Math.abs(s.goal[1] - r.goal[1]) > 0.01)) {
        r.on = false; r.goal = undefined;
        if (human) g.ev.message(`🧭 Route der ${s.name} pausiert – du hast das Schiff selbst gelenkt. Im Schiffsfenster geht es weiter.`, 'info');
      }
      return;
    }
    const at = dockAt(g, k);
    if (at && g.moveShip(s, at[0], at[1]) && s.path.length) { r.goal = [at[0], at[1]]; r.fails = 0; return; }
    r.fails = (r.fails ?? 0) + 1;
    if (r.fails > 3) {
      r.on = false; r.goal = undefined; r.blocked = `Kein Seeweg nach ${islName(g, k)}`;
      if (human) g.ev.message(`🧭 Route der ${s.name} angehalten: kein Seeweg nach ${islName(g, k)}.`, 'bad', atK(g, k));
    }
    return;
  }
  // Ziel merken (auch wenn das Schiff schon dort lag): fährt es von hier woandershin, hat der Spieler gelenkt
  if (!r.goal) { const at = dockAt(g, k); if (at) r.goal = [at[0], at[1]]; }
  r.t = (r.t ?? 0) + dt;
  if (r.t < LOAD_TIME) return;
  const res = exchange(g, s, k, st);
  if (res.problem && !res.moved) {
    r.blocked = res.problem;
    r.wait = (r.wait ?? 0) + r.t;
    if (human) say(g, `route:${s.id}`, 120, `⚠️ Route blockiert: ${s.name} – ${res.problem}.`, 'bad', atK(g, k));
    if (r.wait < ROUTE_WAIT) { r.t = LOAD_TIME - 5; return; } // in 5 Sekunden noch einmal versuchen
  } else r.blocked = undefined;
  r.wait = 0; r.t = 0;
  r.next = (r.next + 1) % r.stops.length;
}

// ---------- Abwracken ----------

/** Kann das Schiff hier abgewrackt werden? (am eigenen Kontor, leer, ohne Soldaten und Kanonen) */
export function canScrap(g: Game, s: Ship): Check {
  if (s.type === 'pirat' || g.players[s.owner]?.trader) return { ok: false, reason: 'Geht nicht' };
  const k = g.shipDock(s);
  if (!k || s.path.length) return { ok: false, reason: 'Nur am eigenen Kontor' };
  if (s.slots.some((sl) => sl.g && sl.n > 0)) return { ok: false, reason: 'Erst die Ladung ausladen' };
  if (s.troops?.length) return { ok: false, reason: 'Erst die Soldaten an Land setzen' };
  if ((s.guns ?? 0) > 0) return { ok: false, reason: 'Erst die Kanonen ins Lager bringen' };
  return { ok: true };
}

/** Was das Abwracken zurückgibt: die Hälfte von Holz und Stoffen */
export function scrapRefund(s: Ship): { holz: number; stoff: number } {
  const c = SHIPS[s.type ?? 'handel_klein'].cost;
  return { holz: Math.floor(c.holz / 2), stoff: Math.floor(c.stoff / 2) };
}

/** Schiff am eigenen Kontor abwracken: Hälfte von Holz und Stoffen ins Lager (soweit Platz ist) */
export function scrap(g: Game, s: Ship): Check & { holz?: number; stoff?: number } {
  const c = canScrap(g, s);
  if (!c.ok) return c;
  const k = g.shipDock(s)!;
  const l = g.lagerOf(s.owner, k.island);
  const cap = g.capOf(s.owner, k.island);
  const ref = scrapRefund(s);
  let holz = 0, stoff = 0;
  if (l) {
    holz = Math.max(0, Math.min(ref.holz, Math.floor(cap - l.holz))); l.holz += holz;
    stoff = Math.max(0, Math.min(ref.stoff, Math.floor(cap - l.stoff))); l.stoff += stoff;
  }
  removeShip(g, s.id);
  delete S(g).routes[s.id];
  return { ok: true, holz, stoff };
}

// ---------- Sofort-Handel (Notbehelf) ----------

/** Aufschlag für den Sofort-Handel am Kontor (1 = keiner; 1,4, sobald Händlerschiffe fahren) */
export function notFaktor(g?: Game): number {
  return g && S(g).active ? NOT_FAKTOR : 1;
}

/** Preise des Sofort-Handels je Tonne (kaufen = du zahlst, verkaufen = du bekommst) */
export function sofortPreis(g: Game, good: GoodId): { kaufen: number; verkaufen: number } | null {
  const pr = PRICES[good];
  if (!pr) return null;
  const f = notFaktor(g);
  return { kaufen: Math.round(pr.kaufen * f), verkaufen: Math.max(1, Math.round(pr.verkaufen / f)) };
}

/** Sofort am Kontor handeln: n > 0 kaufen, n < 0 verkaufen. Gibt gehandelte Tonnen zurück. */
export function sofort(g: Game, owner: number, island: number, good: GoodId, n: number): number {
  const pr = sofortPreis(g, good);
  const l = g.lagerOf(owner, island);
  const p = g.players[owner];
  if (!pr || !l || !p) return 0;
  if (n > 0) {
    const room = Math.max(0, g.capOf(owner, island) - l[good]);
    const t = Math.max(0, Math.floor(Math.min(n, room, p.money / pr.kaufen)));
    l[good] += t; p.money -= t * pr.kaufen;
    if (t) book(g, owner, 'handel', -t * pr.kaufen);
    return t;
  }
  const t = Math.max(0, Math.floor(Math.min(-n, l[good])));
  l[good] -= t; p.money += t * pr.verkaufen;
  if (t) { book(g, owner, 'handel', t * pr.verkaufen); know(g, good); }
  return t;
}

// ---------- Ablauf, Speichern ----------

function tick(g: Game, dt: number) {
  const s = S(g), rt = R(g);
  // Nachfrage erholt sich, Grundpreise schwanken langsam
  const decay = Math.exp(-dt / PRESS_TAU);
  for (const k of Object.keys(s.press) as GoodId[]) {
    const v = (s.press[k] ?? 0) * decay;
    if (Math.abs(v) < 0.001) delete s.press[k]; else s.press[k] = v;
  }
  rt.drift -= dt;
  if (rt.drift <= 0) {
    rt.drift = 10;
    for (const gd of GOODS) {
      if (!PRICES[gd.id]) continue;
      const d = s.drift[gd.id] ?? 1 + (g.rng() - 0.5) * DRIFT * 1.2;
      s.drift[gd.id] = Math.max(1 - DRIFT, Math.min(1 + DRIFT, d + (g.rng() - 0.5) * 0.03));
    }
  }
  // Sortiment: was schon einmal in einem Lager lag; neue Kontore bekommen ihren ersten Besuch
  rt.slow -= dt;
  if (rt.slow <= 0) {
    rt.slow = 2;
    for (const l of Object.values(g.lager)) for (const gd of GOODS) if (l[gd.id] >= 1 && PRICES[gd.id]) know(g, gd.id);
    const ids = new Set<number>();
    for (const k of kontors(g)) { ids.add(k.id); if (s.due[k.id] === undefined) schedule(g, k, true); }
    for (const id of Object.keys(s.due)) if (!ids.has(Number(id))) delete s.due[id];
    for (const id of Object.keys(s.orders)) if (!ids.has(Number(id))) delete s.orders[id];
    const ships = new Set(g.ships.map((x) => x.id));
    for (const id of Object.keys(s.routes)) if (!ships.has(Number(id))) delete s.routes[id];
  }
  tickTraders(g, dt);
  for (const [id, r] of Object.entries(s.routes)) {
    if (!r.on) continue;
    const sh = g.ships.find((x) => x.id === Number(id));
    if (sh) tickRoute(g, sh, r, dt);
  }
}

function afterPlace(g: Game, b: Building) {
  if (b.type !== 'kontor') return;
  const s = S(g);
  if (s.due[b.id] === undefined) schedule(g, b, true);
  if (b.owner === HUMAN && !s.routeHint && kontors(g).filter((k) => k.owner === HUMAN).length >= 2) {
    s.routeHint = true;
    g.ev.message('🧭 Neu: Handelsrouten! Wähle ein Schiff – unter „Handelsroute“ fährt es allein zwischen deinen Kontoren und lädt Waren um.', 'good');
  }
}

function load(g: Game, data: unknown) {
  const d = data as Partial<State> | undefined;
  const s = fresh();
  if (d && typeof d === 'object' && d.v === 1) {
    s.active = !!d.active;
    s.orders = d.orders ?? {};
    s.routes = d.routes ?? {};
    s.known = Array.isArray(d.known) ? d.known.filter((x) => GOOD[x]) : [];
    s.drift = d.drift ?? {};
    s.press = d.press ?? {};
    s.due = d.due ?? {};
    s.ships = Array.isArray(d.ships) ? d.ships : [];
    s.hinted = !!d.hinted;
    s.routeHint = !!d.routeHint;
    s.said = d.said ?? {};
  }
  states.set(g, s);
  runtimes.delete(g);
}

/** Eintrag in der Liste der Spielteile (src/systems.ts) */
export const system: GameSystem = {
  id: 'trade',
  tick,
  afterPlace,
  save: (g) => S(g),
  load,
};
