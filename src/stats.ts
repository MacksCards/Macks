// Statistik: Kassenbuch, Warenfluss, Verläufe, Bevölkerung je Stufe, Vergleich und Warnungen (Paket S1).
//
// Schnittstelle für die Fenster (U2: Statistik/Bilanz/Bevölkerung) und den Überblick (U3: Meldungen, Warenleiste).
// Alles hier ist reine Spiellogik ohne Oberfläche; game.ts bleibt unverändert (Anschluss über src/systems.ts).
//   ledger(g, owner)            – Kassenbuch, eine Zeile je abgeschlossener Spielminute (höchstens 120, älteste zuerst).
//                                 Einnahmen positiv, Ausgaben negativ; die Summe einer Zeile ist die Bilanz der Minute.
//   current(g, owner)           – die laufende, noch nicht abgeschlossene Minute (gleicher Aufbau, Taler bisher)
//   rates(g, owner)             – Taler je Minute im Augenblick: Steuern je Stufe und Unterhalt nach Art
//   book(g, owner, kind, taler) – Geld ins Kassenbuch buchen, NACHDEM es auf dem Konto ist (z. B. trade() → 'handel').
//                                 kind: 'handel' (Vorzeichen entscheidet ein/aus), 'steuern', 'betriebe', 'dienste',
//                                 'militaer'; alles andere zählt zu „Bauen und Sonstiges“. Ungebuchtes fällt ebenfalls
//                                 dorthin – das Kassenbuch stimmt also immer mit dem Kontostand überein.
//   flows(g, owner, island)     – Warenfluss je Ware: Erzeugung/Verbrauch je Minute, Saldo, „reicht noch N Minuten“
//   trend(g, what, owner, island) – Verlauf (ein Messpunkt je Spielminute): 'einwohner', 'geld', 'bilanz' oder eine
//                                 Ware (Lagerbestand; Waren und Inseln nur für den Spieler)
//   popSummary(g, owner, island), popByTier(g, owner, island) – Bevölkerung je Stufe mit „Es fehlt“
//   rivals(g)                   – Vergleich: du und die entdeckten Gegner (Einwohner, Kasse, Vermögen, Stärke)
//   problems(g)                 – was gerade im Argen liegt (für eine Warnleiste); dieselben Punkte kommen
//                                 alle 5 s als Meldung (je Ware und Insel höchstens alle 5 Minuten), mit „⚠️“ (Alarmton)
//                                 und Ort (Tipp auf die Meldung springt hin).
// Gespeichert wird im Spielstand unter ext.stats (ab Spielstand-Version 4 vorgesehen; ältere Stände beginnen leer).
import { BUILDINGS, GOOD, GOODS, PRICES, SHIPS, SHIP_GUN, TIERS, UNITS, type BuildingId, type GoodId } from './data';
import { HUMAN, type Building, type Game, type MsgAt } from './game';
import { atWar, unitUpkeep } from './combat';
import type { GameSystem } from './systems';

/** Warenfluss einer Ware auf einer Insel, je Spielminute */
export interface Flow {
  /** erzeugt pro Minute */
  prod: number;
  /** verbraucht pro Minute (Bewohner und Werkstätten) */
  use: number;
  /** prod − use */
  net: number;
  /** reicht der Vorrat noch so viele Minuten (null = wird nicht weniger) */
  minutes: number | null;
  /** davon verbrauchen die Bewohner pro Minute */
  people: number;
  /** Vorrat im Lager */
  stock: number;
  /** so viel passt höchstens ins Lager */
  cap: number;
}

/** eine Zeile im Kassenbuch (eine Spielminute); Einnahmen positiv, Ausgaben negativ */
export interface LedgerRow {
  /** Spielminute */
  t: number;
  /** Steuern je Stufe (Pioniere … Aristokraten) */
  steuern: number[];
  /** Unterhalt der Betriebe */
  betriebe: number;
  /** Unterhalt der öffentlichen Gebäude */
  dienste: number;
  /** Sold der Soldaten und Kosten des Militärs */
  militaer: number;
  /** Einnahmen und Ausgaben im Handel */
  handelEin: number;
  handelAus: number;
  /** Bauen und alles andere */
  sonstiges: number;
}

/** Bevölkerung einer Stufe */
export interface TierSummary {
  houses: number;
  residents: number;
  /** so viele Bewohner hätten in diesen Häusern Platz */
  max: number;
  /** mittlere Zufriedenheit 0..1 */
  happy: number;
  /** Häuser, die gerade aufsteigen könnten (voll und zufrieden) */
  ready: number;
  /** was fehlt, mit Anzahl betroffener Häuser */
  missing: { what: string; houses: number }[];
  /** warum aufstiegsbereite Häuser nicht aufsteigen, mit Anzahl Häuser */
  blocked: { what: string; houses: number }[];
}

export interface PopSummary { tiers: TierSummary[] }

/** Taler je Minute im Augenblick */
export interface Rates {
  steuern: number[];
  betriebe: number;
  dienste: number;
  militaer: number;
  /** Steuern − Unterhalt */
  bilanz: number;
}

/** eine Zeile im Vergleich */
export interface Rival {
  id: number;
  name: string;
  color: number;
  /** true = der Spieler selbst */
  you: boolean;
  einwohner: number;
  /** Bewohner der höchsten erreichten Stufe (Index in TIERS) */
  stufe: number;
  inseln: number;
  kasse: number;
  /** Kasse + Wert der Gebäude, Schiffe und Waren */
  vermoegen: number;
  /** Kampfkraft der Soldaten und Schiffe (nur zum Vergleichen) */
  staerke: number;
  soldaten: number;
  schiffe: number;
  /** ihr seid im Krieg */
  krieg: boolean;
}

/** etwas, das gerade im Argen liegt */
export interface Problem {
  /** fester Schlüssel (z. B. 'knapp:3:nahrung'); gleiche Schlüssel werden höchstens alle 5 Minuten gemeldet */
  key: string;
  text: string;
  at?: MsgAt;
  island?: number;
}

// ---------- Zustand ----------

/** Messpunkt einer Spielminute */
interface Sample {
  t: number;
  /** je Spieler [Einwohner, Kasse, Bilanz der Minute] */
  pl: Record<number, [number, number, number]>;
  /** Spieler-Inseln: Einwohner und Lagerbestand (nur Waren > 0) */
  is: Record<number, { e: number; w: Partial<Record<GoodId, number>> }>;
}

interface Track {
  /** Kontostand beim letzten Rechenschritt (null = noch keiner) */
  last: number | null;
  /** schon gebucht, aber noch nicht mit dem Kontostand abgeglichen */
  booked: number;
  /** Anteile von Steuern und Unterhalt (jede Sekunde neu) */
  split: { tax: number[]; up: [number, number, number] };
  pend: LedgerRow;
  rows: LedgerRow[];
}

interface State {
  tracks: Map<number, Track>;
  samples: Sample[];
  met: Set<number>;
  secT: number;
  warnT: number;
  /** Spielzeit der letzten Meldung je Schlüssel */
  said: Map<string, number>;
  /** Bewohner je Haus bei der letzten Prüfung (für „ziehen weg“) */
  lastRes: Map<number, number>;
  /** Erzeugung und Verbrauch je Insel (ohne Lagerbestand), gültig für eine Spielzeit */
  cache: { time: number; ver: number; owner: number; by: Map<number, Partial<Record<GoodId, Flow>>> } | null;
}

const KEEP = 120;
const WARN_EVERY = 5;
const REPEAT = 300;
const states = new WeakMap<Game, State>();

function emptyRow(t: number): LedgerRow {
  return { t, steuern: TIERS.map(() => 0), betriebe: 0, dienste: 0, militaer: 0, handelEin: 0, handelAus: 0, sonstiges: 0 };
}
const minuteOf = (g: Game) => Math.floor(g.time / 60) + 1;

function st(g: Game): State {
  let s = states.get(g);
  if (!s) {
    s = { tracks: new Map(), samples: [], met: new Set(), secT: 1, warnT: 0, said: new Map(), lastRes: new Map(), cache: null };
    states.set(g, s);
  }
  return s;
}

function track(g: Game, owner: number): Track {
  const s = st(g);
  let t = s.tracks.get(owner);
  if (!t) {
    t = { last: null, booked: 0, split: { tax: TIERS.map(() => 0), up: [1, 0, 0] }, pend: emptyRow(minuteOf(g)), rows: [] };
    s.tracks.set(owner, t);
  }
  return t;
}

/** Teilnehmer am Kassenbuch: alle Spieler außer Piraten, Händlern und Ureinwohnern */
const counted = (g: Game) => g.players.filter((p) => !p.pirate && !p.trader && !p.natives);

// ---------- Kassenbuch ----------

/**
 * Geld ins Kassenbuch buchen. kind = Art (z. B. 'handel', 'bauen'), taler > 0 Einnahme, < 0 Ausgabe.
 * Aufrufen, wenn das Geld schon auf dem Konto ist (oder im selben Rechenschritt dorthin kommt).
 */
export function book(g: Game, owner: number, kind: string, taler: number): void {
  if (!taler || !Number.isFinite(taler) || !g.players[owner]) return;
  const t = track(g, owner);
  const r = t.pend;
  if (kind === 'handel') { if (taler > 0) r.handelEin += taler; else r.handelAus += taler; }
  else if (kind === 'steuern') r.steuern[0] += taler;
  else if (kind === 'betriebe') r.betriebe += taler;
  else if (kind === 'dienste') r.dienste += taler;
  else if (kind === 'militaer') r.militaer += taler;
  else r.sonstiges += taler;
  t.booked += taler;
}

/** Anteile neu bestimmen: Steuern je Stufe, Unterhalt Betriebe/Dienste/Militär (Summen kommen aus dem Spiel) */
function resplit(g: Game) {
  const tax = new Map<number, number[]>();
  const up = new Map<number, [number, number, number]>();
  // Steuern je Stufe genau so, wie das Spiel sie rechnet (mit den Steuersätzen je Stufe)
  for (const p of counted(g)) { tax.set(p.id, [...g.incomePerMinute(p.id).byTier]); up.set(p.id, [0, 0, unitUpkeep(g, p.id)]); }
  for (const b of g.buildings) {
    const u = up.get(b.owner);
    if (!u) continue;
    const d = BUILDINGS[b.type];
    if (d.upkeep) u[d.category === 'oeffentlich' ? 1 : d.category === 'militaer' ? 2 : 0] += d.upkeep;
  }
  for (const p of counted(g)) track(g, p.id).split = { tax: tax.get(p.id)!, up: up.get(p.id)! };
}

/** Anteil i an total nach den Gewichten w (ohne Gewichte: alles auf den ersten) */
function share(total: number, w: readonly number[]): number[] {
  const sum = w.reduce((a, b) => a + b, 0);
  return sum > 0 ? w.map((x) => (total * x) / sum) : w.map((_, i) => (i === 0 ? total : 0));
}

/** Taler je Minute im Augenblick (Steuern je Stufe, Unterhalt nach Art; Ausgaben negativ) */
export function rates(g: Game, owner = HUMAN): Rates {
  const { tax, upkeep } = g.incomePerMinute(owner);
  const t = track(g, owner);
  const [b, d, m] = share(upkeep, t.split.up);
  return { steuern: share(tax, t.split.tax), betriebe: -b, dienste: -d, militaer: -m, bilanz: tax - upkeep };
}

function closeMinute(g: Game, s: State) {
  const r1 = (x: number) => Math.round(x * 100) / 100;
  const sample: Sample = { t: 0, pl: {}, is: {} };
  const m = minuteOf(g);
  for (const [id, t] of s.tracks) {
    const p = g.players[id];
    if (t.pend.t === m) { sample.pl[id] = [population(g, id), Math.round(p?.money ?? 0), 0]; continue; } // erst in dieser Minute dazugekommen
    const r = t.pend;
    const row: LedgerRow = { t: r.t, steuern: r.steuern.map(r1), betriebe: r1(r.betriebe), dienste: r1(r.dienste), militaer: r1(r.militaer),
      handelEin: r1(r.handelEin), handelAus: r1(r.handelAus), sonstiges: r1(r.sonstiges) };
    t.rows.push(row);
    if (t.rows.length > KEEP) t.rows.splice(0, t.rows.length - KEEP);
    sample.t = r.t;
    sample.pl[id] = [population(g, id), Math.round(p?.money ?? 0), r1(rowSum(row))];
    t.pend = emptyRow(m);
  }
  // Inseln des Spielers: Einwohner und Lager
  const e = new Map<number, number>();
  for (const b of g.buildings) if (b.owner === HUMAN && b.type === 'haus') e.set(b.island, (e.get(b.island) ?? 0) + b.residents);
  for (const isl of humanIslands(g)) {
    const l = g.lagerOf(HUMAN, isl)!;
    const w: Partial<Record<GoodId, number>> = {};
    for (const gd of GOODS) { const n = Math.round(l[gd.id] ?? 0); if (n > 0) w[gd.id] = n; }
    sample.is[isl] = { e: e.get(isl) ?? 0, w };
  }
  s.samples.push(sample);
  if (s.samples.length > KEEP) s.samples.splice(0, s.samples.length - KEEP);
}

export const rowSum = (r: LedgerRow) => r.steuern.reduce((a, b) => a + b, 0) + r.betriebe + r.dienste + r.militaer + r.handelEin + r.handelAus + r.sonstiges;

/** Kassenbuch, eine Zeile je Spielminute (älteste zuerst) */
export function ledger(g: Game, owner = HUMAN): LedgerRow[] {
  return st(g).tracks.get(owner)?.rows ?? [];
}

/** die laufende Spielminute (noch nicht abgeschlossen) */
export function current(g: Game, owner = HUMAN): LedgerRow {
  return track(g, owner).pend;
}

// ---------- Warenfluss ----------

function humanIslands(g: Game): number[] {
  const r: number[] = [];
  for (const k of Object.keys(g.lager)) {
    const [o, i] = k.split(':').map(Number);
    if (o === HUMAN) r.push(i);
  }
  return r.sort((a, b) => a - b);
}

const emptyFlow = (): Flow => ({ prod: 0, use: 0, net: 0, minutes: null, people: 0, stock: 0, cap: 0 });

/**
 * Erzeugung und Verbrauch aller Inseln eines Spielers. Zwischengespeichert, solange Spielzeit und Gebäude
 * gleich bleiben; der Lagerbestand kommt jedes Mal frisch dazu (Verkauf in der Pause ändert ihn).
 */
function allFlows(g: Game, owner: number): Map<number, Partial<Record<GoodId, Flow>>> {
  const s = st(g);
  let by: Map<number, Partial<Record<GoodId, Flow>>>;
  if (s.cache && s.cache.time === g.time && s.cache.owner === owner && s.cache.ver === g.buildVersion) by = s.cache.by;
  else { by = rawFlows(g, owner); s.cache = { time: g.time, ver: g.buildVersion, owner, by }; }
  const out = new Map<number, Partial<Record<GoodId, Flow>>>();
  for (const [isl, m] of by) {
    const l = g.lagerOf(owner, isl);
    const cap = g.capOf(owner, isl);
    const r: Partial<Record<GoodId, Flow>> = {};
    for (const [gd, f] of Object.entries(m) as [GoodId, Flow][]) r[gd] = finish({ ...f, stock: l ? l[gd] ?? 0 : 0, cap });
    out.set(isl, r);
  }
  return out;
}

function rawFlows(g: Game, owner: number): Map<number, Partial<Record<GoodId, Flow>>> {
  const by = new Map<number, Partial<Record<GoodId, Flow>>>();
  const get = (isl: number, gd: GoodId): Flow => {
    let m = by.get(isl);
    if (!m) { m = {}; by.set(isl, m); }
    return (m[gd] ??= emptyFlow());
  };
  for (const b of g.buildings) {
    if (b.owner !== owner) continue;
    if (b.type === 'haus') {
      const tier = TIERS[b.tier];
      if (!tier) continue;
      for (const [gd, rate] of Object.entries(tier.consumes) as [GoodId, number][]) {
        const f = get(b.island, gd);
        f.use += b.residents * rate;
        f.people += b.residents * rate;
      }
      continue;
    }
    const d = BUILDINGS[b.type];
    const p = d.prod;
    if (!p) continue;
    // Tempo wie im Spiel: Erntebetriebe nach Fruchtbarkeit, andere nach Ergiebigkeit; mal Auslastung
    const speed = (d.harvest ? g.fertility(b.type, b.x, b.y) : b.eff) * b.active;
    if (speed <= 0) continue;
    const per = (60 / p.time) * speed;
    get(b.island, p.output).prod += (p.amount ?? 1) * per;
    for (const [gd, n] of Object.entries(p.input ?? {}) as [GoodId, number][]) get(b.island, gd).use += n * per;
  }
  return by;
}

function finish(f: Flow): Flow {
  f.net = f.prod - f.use;
  f.minutes = f.net < -1e-6 ? Math.max(0, f.stock) / -f.net : null;
  return f;
}

/** Warenfluss je Ware auf einer Insel (owner, island); island = -1 für alle Inseln zusammen */
export function flows(g: Game, owner = HUMAN, island = -1): Partial<Record<GoodId, Flow>> {
  const by = allFlows(g, owner);
  if (island >= 0) return by.get(island) ?? {};
  const sum: Partial<Record<GoodId, Flow>> = {};
  for (const m of by.values()) for (const [gd, f] of Object.entries(m) as [GoodId, Flow][]) {
    const t = (sum[gd] ??= emptyFlow());
    t.prod += f.prod; t.use += f.use; t.people += f.people; t.stock += f.stock; t.cap += f.cap;
  }
  for (const f of Object.values(sum)) finish(f);
  return sum;
}

// ---------- Verläufe ----------

/**
 * Verlauf eines Werts, ein Messpunkt je Spielminute (älteste zuerst, höchstens 120).
 * what: 'einwohner', 'geld', 'bilanz' oder eine Ware; island = -1 für alle Inseln.
 * Inseln und Waren gibt es nur für den Spieler (bei Gegnern: leer).
 */
export function trend(g: Game, what: string, owner = HUMAN, island = -1): number[] {
  const samples = st(g).samples;
  const col = what === 'einwohner' ? 0 : what === 'geld' ? 1 : what === 'bilanz' ? 2 : -1;
  if (col >= 0 && (island < 0 || col > 0)) return samples.map((s) => (s.pl[owner] as number[] | undefined)?.[col] ?? 0);
  if (owner !== HUMAN) return [];
  if (col === 0) return samples.map((s) => s.is[island]?.e ?? 0);
  if (!(what in GOOD)) return [];
  const gd = what as GoodId;
  return samples.map((s) => {
    if (island >= 0) return s.is[island]?.w[gd] ?? 0;
    let n = 0;
    for (const v of Object.values(s.is)) n += v.w[gd] ?? 0;
    return n;
  });
}

/** Spielminuten der Messpunkte (passend zu trend) */
export function trendTimes(g: Game): number[] {
  return st(g).samples.map((s) => s.t);
}

// ---------- Bevölkerung ----------

function population(g: Game, owner: number, island = -1): number {
  let n = 0;
  for (const b of g.buildings) if (b.owner === owner && b.type === 'haus' && (island < 0 || b.island === island)) n += b.residents;
  return n;
}

/** Bewohner je Stufe (Pioniere … Aristokraten); island = -1 für alle Inseln */
export function popByTier(g: Game, owner = HUMAN, island = -1): number[] {
  const r = TIERS.map(() => 0);
  for (const b of g.buildings) if (b.owner === owner && b.type === 'haus' && (island < 0 || b.island === island)) r[b.tier] += b.residents;
  return r;
}

/** was diesem Haus fehlt: knappe Waren und fehlende öffentliche Gebäude seiner Stufe (Namen) */
function lacks(g: Game, h: Building): string[] {
  const tier = TIERS[h.tier];
  if (!tier) return [];
  const r: string[] = [];
  for (const gd of Object.keys(tier.consumes) as GoodId[]) if (h.short?.[gd]) r.push(GOOD[gd].name);
  const cov = g.coverage.get(h.id);
  for (const s of tier.services as BuildingId[]) if (!cov?.has(s)) r.push(BUILDINGS[s].name);
  return r;
}

function countUp(m: Map<string, number>, k: string) { m.set(k, (m.get(k) ?? 0) + 1); }
const sorted = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).map(([what, houses]) => ({ what, houses }));

/** Bevölkerung je Stufe (Pioniere … Aristokraten); island = -1 für alle Inseln */
export function popSummary(g: Game, owner = HUMAN, island = -1): PopSummary {
  const acc = TIERS.map(() => ({ houses: 0, residents: 0, max: 0, happy: 0, ready: 0, miss: new Map<string, number>(), block: new Map<string, number>() }));
  for (const h of g.buildings) {
    if (h.owner !== owner || h.type !== 'haus' || (island >= 0 && h.island !== island)) continue;
    const a = acc[h.tier], tier = TIERS[h.tier];
    if (!a || !tier) continue;
    a.houses++;
    a.residents += h.residents;
    a.max += tier.maxResidents;
    a.happy += h.happy;
    for (const w of lacks(g, h)) countUp(a.miss, w);
    if (h.tier < TIERS.length - 1 && h.residents >= tier.maxResidents && h.happy >= 0.85) {
      a.ready++;
      const why = g.upgradeBlocker(h);
      if (why) countUp(a.block, why);
    }
  }
  return {
    tiers: acc.map((a) => ({ houses: a.houses, residents: a.residents, max: a.max, happy: a.houses ? a.happy / a.houses : 0, ready: a.ready,
      missing: sorted(a.miss), blocked: sorted(a.block) })),
  };
}

// ---------- Vergleich ----------

/** Ist der Gegner schon entdeckt (Gebäude oder Schiff im aufgedeckten Gebiet, oder Krieg)? */
function seenPlayer(g: Game, id: number): boolean {
  if (atWar(g, HUMAN, id)) return true;
  const seen = (x: number, y: number) => g.inMap(Math.floor(x), Math.floor(y)) && g.seen[g.idx(Math.floor(x), Math.floor(y))] === 1;
  return g.buildings.some((b) => b.owner === id && seen(b.x, b.y)) || g.ships.some((s) => s.owner === id && seen(s.x, s.y));
}

function updateMet(g: Game, s: State) {
  for (const p of counted(g)) if (p.id !== HUMAN && !s.met.has(p.id) && seenPlayer(g, p.id)) s.met.add(p.id);
}

/** Vergleich: du und die entdeckten Gegner (ohne Piraten, Händler, Ureinwohner) */
export function rivals(g: Game): Rival[] {
  const s = st(g);
  updateMet(g, s);
  const out: Rival[] = [];
  for (const p of counted(g)) {
    if (p.id !== HUMAN && !s.met.has(p.id)) continue;
    let einwohner = 0, stufe = 0, wert = 0, staerke = 0, soldaten = 0, schiffe = 0;
    const inseln = new Set<number>();
    for (const b of g.buildings) {
      if (b.owner !== p.id) continue;
      wert += BUILDINGS[b.type].cost.taler ?? 0;
      if (b.type === 'haus') { einwohner += b.residents; if (b.residents > 0) stufe = Math.max(stufe, b.tier); }
      if (b.type === 'kontor') inseln.add(b.island);
    }
    for (const [k, l] of Object.entries(g.lager)) {
      if (Number(k.split(':')[0]) !== p.id) continue;
      for (const [gd, n] of Object.entries(l) as [GoodId, number][]) wert += (n || 0) * (PRICES[gd]?.verkaufen ?? 0);
    }
    for (const sh of g.ships) {
      if (sh.owner !== p.id) continue;
      const sd = SHIPS[sh.type ?? 'handel_klein'];
      schiffe++;
      wert += sd.cost.taler;
      staerke += ((sh.guns ?? 0) * SHIP_GUN.dmg / SHIP_GUN.interval) * (sh.hp ?? sd.hp) / 10;
    }
    for (const u of g.units) {
      if (u.owner !== p.id) continue;
      const ud = UNITS[u.type];
      soldaten++;
      staerke += (ud.str / ud.interval) * u.hp / 10;
    }
    out.push({ id: p.id, name: p.name, color: p.color, you: p.id === HUMAN, einwohner, stufe, inseln: inseln.size, kasse: Math.round(p.money),
      vermoegen: Math.round(p.money + wert), staerke: Math.round(staerke), soldaten, schiffe, krieg: atWar(g, HUMAN, p.id) });
  }
  return out;
}

// ---------- Warnungen ----------

/** Namen in der Mehrzahl (für „fehlen“ statt „fehlt“) */
const PLURAL = new Set(['Steine', 'Stoffe', 'Gewürze', 'Tabakwaren', 'Schweine', 'Schwerter', 'Musketen', 'Kanonen']);
const verb = (names: string[], one: string, many: string) => (names.length > 1 || PLURAL.has(names[0]) ? many : one);

const minText = (m: number) => (m < 1 ? 'weniger als 1 Minute' : `etwa ${Math.round(m)} Minute${Math.round(m) === 1 ? '' : 'n'}`);

function placeOf(g: Game, b: Building | undefined): MsgAt | undefined {
  if (!b) return undefined;
  const [x, y] = g.center(b);
  return { x, y };
}

/** wer diese Ware herstellt (freigeschaltete Gebäude, höchstens zwei Namen) */
function makers(g: Game, gd: GoodId): string[] {
  const r: string[] = [];
  for (const d of Object.values(BUILDINGS)) if (d.prod?.output === gd && g.isUnlocked(d.id) && !r.includes(d.name)) r.push(d.name);
  return r.slice(0, 2);
}

/** was gerade im Argen liegt (nur für den Spieler): knappe oder leere Waren der Bewohner, volles Lager, Kasse */
export function problems(g: Game): Problem[] {
  const out: Problem[] = [];
  for (const isl of humanIslands(g)) {
    const name = g.islands[isl]?.name ?? 'der Insel';
    const kontor = g.kontor(HUMAN, isl);
    const fl = flows(g, HUMAN, isl);
    for (const [gd, f] of Object.entries(fl) as [GoodId, Flow][]) {
      const gn = GOOD[gd].name;
      // Waren der Bewohner: bald leer oder schon leer
      if (f.people > 0) {
        const short = g.buildings.find((h) => h.owner === HUMAN && h.island === isl && h.type === 'haus' && h.short?.[gd]);
        const mk = makers(g, gd);
        const hint = mk.length ? ` Mehr liefert: ${mk.join(' oder ')}.` : PRICES[gd] && kontor ? ' Nachkaufen geht am Kontor.' : '';
        // leer: nur wenn nicht mehr nachkommt, als verbraucht wird (sonst ist es gleich wieder da)
        if (f.stock < 1 && short && f.net <= 0) {
          out.push({ key: `${gd}:${isl}`, island: isl, at: placeOf(g, short),
            text: `⚠️ Auf ${name} ${verb([gn], 'fehlt', 'fehlen')} ${gn} – die Bewohner werden unzufrieden.${hint}` });
        } else if (f.minutes !== null && f.minutes <= 2) {
          out.push({ key: `${gd}:${isl}`, island: isl, at: placeOf(g, kontor),
            text: `⚠️ ${gn} ${verb([gn], 'reicht', 'reichen')} auf ${name} nur noch ${minText(f.minutes)}.${hint}` });
        }
      }
      // Lager voll, obwohl weiter hergestellt wird: der Rest geht verloren
      if (f.prod > 0 && f.cap > 0 && f.stock >= f.cap - 0.5) {
        out.push({ key: `voll:${gd}:${isl}`, island: isl, at: placeOf(g, kontor),
          text: `⚠️ Lager voll: ${gn} ${Math.floor(f.stock)}/${f.cap} auf ${name}. Verkaufe etwas oder baue einen Marktplatz für mehr Platz.` });
      }
    }
  }
  const money = g.players[HUMAN]?.money ?? 0;
  const bal = rates(g, HUMAN).bilanz;
  if (money < 0) {
    out.push({ key: 'kasse', text: `⚠️ Kasse im Minus: ${Math.round(money)} Taler. Senke die Kosten oder verkaufe Waren.` });
  } else if (bal < -0.5 && money / -bal < 3 && g.buildings.some((b) => b.owner === HUMAN)) {
    out.push({ key: 'kasse', text: `⚠️ Deine Kasse ist in ${minText(money / -bal)} leer (${Math.round(bal)} Taler je Minute).` });
  }
  return out;
}

/** Bewohner, die seit der letzten Prüfung ausgezogen sind, je Insel – mit dem häufigsten Grund */
function movedOut(g: Game, s: State): Problem[] {
  const lost = new Map<number, { n: number; why: Map<string, number>; at?: Building }>();
  const now = new Map<number, number>();
  for (const h of g.buildings) {
    if (h.owner !== HUMAN || h.type !== 'haus') continue;
    now.set(h.id, h.residents);
    const before = s.lastRes.get(h.id);
    if (before === undefined || h.residents >= before) continue;
    const e = lost.get(h.island) ?? { n: 0, why: new Map<string, number>() };
    e.n += before - h.residents;
    e.at ??= h;
    for (const w of lacks(g, h)) countUp(e.why, w);
    lost.set(h.island, e);
  }
  s.lastRes = now;
  const out: Problem[] = [];
  for (const [isl, e] of lost) {
    const name = g.islands[isl]?.name ?? 'der Insel';
    const top = sorted(e.why).slice(0, 2).map((x) => x.what);
    const text = top.length
      ? `⚠️ Auf ${name} ziehen Bewohner weg: ${top.join(' und ')} ${verb(top, 'fehlt', 'fehlen')}.`
      : `⚠️ Auf ${name} ziehen Bewohner weg – sie sind unzufrieden.`;
    out.push({ key: `weg:${isl}`, island: isl, at: placeOf(g, e.at), text });
  }
  return out;
}

/** höchstens so viele Warnungen je Prüfung (der Rest kommt 5 s später) – sonst stapeln sich die Meldungen */
const PER_CHECK = 2;

function warn(g: Game, s: State) {
  // „Bewohner ziehen aus“ meldet das Spiel selbst (game.ts leaveMessage, mit Grund wie Hunger oder Steuern);
  // movedOut zählt hier nur mit, damit es keine doppelte Meldung gibt
  movedOut(g, s);
  const list = problems(g);
  let n = 0;
  for (const p of list) {
    const last = s.said.get(p.key);
    if (last !== undefined && g.time - last < REPEAT) continue;
    if (++n > PER_CHECK) break;
    s.said.set(p.key, g.time);
    g.ev.message(p.text, 'bad', p.at);
  }
}

// ---------- Ablauf und Spielstand ----------

function tick(g: Game, dt: number) {
  const s = st(g);
  // Minute vorbei: Zeile abschließen und Messpunkt speichern
  const m = minuteOf(g);
  for (const p of counted(g)) track(g, p.id);
  for (const t of s.tracks.values()) if (t.pend.t !== m) { closeMinute(g, s); break; }
  // jede Sekunde: Anteile neu bestimmen, Gegner entdecken
  s.secT += dt;
  if (s.secT >= 1) { s.secT = 0; resplit(g); updateMet(g, s); }
  // Kontostand abgleichen: Steuern und Unterhalt dieses Schritts nach Anteilen, Gebuchtes, Rest = Sonstiges
  for (const p of counted(g)) {
    const t = track(g, p.id);
    if (t.last === null) { t.last = p.money; t.booked = 0; continue; }
    const r = rates(g, p.id);
    const f = dt / 60;
    r.steuern.forEach((v, i) => { t.pend.steuern[i] += v * f; });
    t.pend.betriebe += r.betriebe * f;
    t.pend.dienste += r.dienste * f;
    t.pend.militaer += r.militaer * f;
    const delta = p.money - t.last;
    t.pend.sonstiges += delta - r.bilanz * f - t.booked;
    t.booked = 0;
    t.last = p.money;
  }
  // alle 5 s: Warnungen
  s.warnT += dt;
  if (s.warnT >= WARN_EVERY) { s.warnT = 0; warn(g, s); }
}

/**
 * gespeicherte Form (ext.stats). Kassenbuch-Zeilen als Zahlenreihe (spart Platz im Spielstand):
 * [Minute, Steuern Stufe 1…5, Betriebe, Dienste, Militär, Handel ein, Handel aus, Sonstiges]
 */
interface Saved {
  v: 1;
  rows: Record<number, number[][]>;
  pend: Record<number, number[]>;
  samples: Sample[];
  met: number[];
  said?: Record<string, number>;
}

const packRow = (r: LedgerRow): number[] => [r.t, ...r.steuern, r.betriebe, r.dienste, r.militaer, r.handelEin, r.handelAus, r.sonstiges];
function unpackRow(a: unknown): LedgerRow | null {
  const nT = TIERS.length;
  if (!Array.isArray(a) || a.length !== nT + 7 || !a.every((x) => typeof x === 'number' && Number.isFinite(x))) return null;
  const v = a as number[];
  return { t: v[0], steuern: v.slice(1, 1 + nT), betriebe: v[nT + 1], dienste: v[nT + 2], militaer: v[nT + 3], handelEin: v[nT + 4], handelAus: v[nT + 5], sonstiges: v[nT + 6] };
}

function save(g: Game): Saved {
  const s = st(g);
  const rows: Record<number, number[][]> = {}, pend: Record<number, number[]> = {};
  for (const [id, t] of s.tracks) { rows[id] = t.rows.map(packRow); pend[id] = packRow(t.pend); }
  return { v: 1, rows, pend, samples: s.samples, met: [...s.met], said: Object.fromEntries(s.said) };
}

function load(g: Game, data: unknown) {
  const s: State = { tracks: new Map(), samples: [], met: new Set(), secT: 1, warnT: 0, said: new Map(), lastRes: new Map(), cache: null };
  states.set(g, s);
  // Häuser merken, damit nach dem Laden nicht „ziehen weg“ gemeldet wird, nur weil vorher nichts bekannt war
  for (const h of g.buildings) if (h.owner === HUMAN && h.type === 'haus') s.lastRes.set(h.id, h.residents);
  const d = data as Partial<Saved> | undefined;
  if (!d || typeof d !== 'object' || d.v !== 1) return;
  for (const [k, list] of Object.entries(d.rows ?? {})) {
    if (!Array.isArray(list)) continue;
    const t = track(g, Number(k));
    t.rows = list.map(unpackRow).filter((r): r is LedgerRow => !!r).slice(-KEEP);
    const p = unpackRow(d.pend?.[Number(k)]);
    if (p && p.t === minuteOf(g)) t.pend = p;
  }
  if (Array.isArray(d.samples)) s.samples = d.samples.filter((x) => x && typeof x.t === 'number' && x.pl && x.is).slice(-KEEP);
  if (Array.isArray(d.met)) for (const id of d.met) if (typeof id === 'number') s.met.add(id);
  if (d.said && typeof d.said === 'object') for (const [k, v] of Object.entries(d.said)) if (typeof v === 'number' && v <= g.time) s.said.set(k, v);
}

/** Eintrag in der Liste der Spielteile (src/systems.ts) */
export const system: GameSystem = {
  id: 'stats',
  tick,
  save,
  load,
};
