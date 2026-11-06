// Kampf wie im Vorbild: Soldaten aus der Burg, Wachtürme, bewaffnete Schiffe, Seeschlachten,
// Truppen übersetzen, Eroberung über Kontor/Marktplatz, Krieg und Frieden, Piraten.
// Dazu die Regeln aus dem Abgleich (Paket M1): weiße Flagge, Piraten fliehen bei Schaden, Bäume fällen,
// Aufstellung in Reihe oder Block, Ausmustern, Patrouille, Arzt pflegt Soldaten, Gebäude bessern sich nur
// bis 75 % selbst aus, Kanonen setzen Holzgebäude in Brand, Fehlschüsse mit ausgeglichenem Schaden,
// sparsame Wegsuche im Gefecht. Zufall nur über g.rng() (gleicher Ablauf nach dem Laden).
import { BUILDINGS, GOODS, MAX_UNITS, PRICES, SHIP_GUN, SHIPS, START_CARGO, ShipType, UNITS, UnitType } from './data';
import { ignite } from './events';
import { Building, Check, Game, HUMAN, MsgAt, Player, Ship, ShotKind, Unit } from './game';
import { findLandPath } from './path';
import { T, rng } from './world';
import { hasKontorCargo, persoenlichkeit, reizung, sollTruppen } from './ai';
import type { Brain } from './ai';
import { kiGrenzen } from './schwierigkeit';
import { dockAt, route, sofort } from './trade';

type Target = { kind: 'unit'; u: Unit; owner: number } | { kind: 'ship'; s: Ship; owner: number } | { kind: 'bau'; b: Building; owner: number };

const PIRATE_START = 1800; // Spielsekunden bis zum ersten Piraten (ca. 30 Minuten)
const PIRATE_COAST = 3000; // ab dann beschießen sie auch Küsten
const PIRATE_RESPAWN = 480;
const AGGRO = 6; // so nah bemerken Soldaten Feinde von selbst

/** Trefferchance je Schütze. Der Schaden je Treffer wird durch sie geteilt, damit im Mittel so viel
 *  Schaden ankommt wie im Vorbild (dort trifft jeder Schuss). */
export const HIT = { feld: 0.85, turm: 0.8, schiff: 0.75 } as const;
/** Piraten drehen ab, wenn ihr Schiff weniger als so viele Trefferpunkte hat (Anteil) … */
export const PIRATE_FLEE = 0.3;
/** … und kommen wieder, wenn es sich so weit erholt hat */
const PIRATE_BACK = 0.7;
/** Sekunden, die ein Soldat an einem Baum hackt */
export const FELL_TIME = 4;
/** Arzt: Heilung je Sekunde im Umkreis, sonst (auf eigenem Land, ohne Kampf) */
export const HEAL_DOCTOR = 1.0;
export const HEAL_FIELD = 0.03;
/** Gebäude bessern sich von selbst nur bis zu diesem Anteil aus */
export const SELF_REPAIR = 0.75;
/** Kanonentreffer an einem Holzgebäude: so wahrscheinlich fängt es Feuer */
export const IGNITE_CHANCE = 0.25;
/** nach einer vergeblichen Wegsuche zum selben Ziel so lange nicht neu suchen (Sekunden) */
const NO_PATH_WAIT = 6;
/** höchstens so viele Felder durchsucht die Wegsuche für selbst gewählte Ziele */
const SELF_NODES = 2000;
/** so viele Wegsuchen im Gefecht je Rechenschritt (der Rest kommt im nächsten dran) */
const PATH_BUDGET = 8;

/** Laufzeit-Zustand je Spiel (wird nicht gespeichert) */
interface State {
  /** Zeit des letzten Treffers je Gebäude/Schiff (für Ausbessern) */
  lastHit: Map<number, number>;
  /** Schiffe: Ziel vom Spieler befohlen (verfolgen) + Zeit bis zur nächsten Kursberechnung */
  shipChase: Map<number, { ordered: boolean; repath: number }>;
  raids: Map<number, { phase: 'anfahrt' | 'sammeln' | 'fahren' | 'land'; ship: number; t: number; dest?: [number, number]; tries?: number; crew?: number[] }>;
  sepT: number; aiT: number; alarmT: number; pirateThinkT: number;
  /** nächstes mögliches Ersatzschiff */
  rescueT: number;
  /** KI: nächster Zeitpunkt zum Anwerben bzw. für ein Kriegsschiff */
  recruitT: Map<number, number>;
  shipT: Map<number, number>;
  /** Schiffe mit gehisster weißer Flagge (wie im Vorbild nicht im Spielstand) */
  white: Set<number>;
  /** fliehende Piratenschiffe */
  flee: Set<number>;
  /** Patrouille: Richtung (0 = zum Startpunkt, 1 = zum Zielpunkt) und ob gerade ein Feind verfolgt wird */
  patrol: Map<number, { leg: 0 | 1; chase: boolean; repath: number }>;
  /** vergebliche Wegsuche je Soldat: bis dahin nicht erneut zum selben Ziel suchen */
  noPath: Map<number, { until: number; x: number; y: number }>;
  /** begehbare Gebiete (Nummer je Feld, -1 = Wasser/Berg), neu bei geändertem g.buildVersion */
  region: { ver: number; size: number; id: Int32Array } | null;
  /** Ärzte je Besitzer (Mittelpunkt), neu bei geändertem g.buildVersion */
  doctors: { ver: number; n: number; by: Map<number, [number, number][]> } | null;
  /** Wegsuchen, die in diesem Rechenschritt noch erlaubt sind */
  budget: number;
  /** letzte Meldung „kommen nicht zu den Bäumen“ (nicht für jeden Soldaten einzeln) */
  fellMsgT: number;
}
const states = new WeakMap<Game, State>();
function st(g: Game): State {
  let s = states.get(g);
  if (!s) {
    s = {
      lastHit: new Map(), shipChase: new Map(), raids: new Map(), rescueT: 0, recruitT: new Map(), shipT: new Map(), sepT: 0, aiT: 0, alarmT: -99, pirateThinkT: 0,
      white: new Set(g.ships.filter((x) => x.white).map((x) => x.id)), flee: new Set(), patrol: new Map(), noPath: new Map(), region: null, doctors: null, budget: PATH_BUDGET, fellMsgT: -99,
    };
    states.set(g, s);
  }
  return s;
}

/** Ort für eine Meldung (Feldkoordinaten) */
const at = (x: number, y: number): MsgAt => ({ x, y });
/** Ort eines Gebäudes für eine Meldung */
const atB = (g: Game, b: Building): MsgAt => { const [x, y] = g.center(b); return at(x, y); };

// ---------- Beziehungen ----------

export function pirates(g: Game) { return g.players.find((p) => p.pirate); }

export function ensurePirates(g: Game) {
  if (pirates(g)) return;
  g.players.push({ id: g.players.length, name: 'Piraten', color: 0x1c1c1c, ai: false, money: 0, pirate: true });
}

export function atWar(g: Game, a: number, b: number): boolean {
  if (a === b || a < 0 || b < 0) return false;
  const pa = g.players[a], pb = g.players[b];
  if (!pa || !pb) return false;
  // freier Händler und Ureinwohner: nie Ziel von Piraten oder Computergegnern, nie im Krieg
  if (pa.trader || pb.trader || pa.natives || pb.natives) return false;
  if (pa.pirate || pb.pirate) {
    const other = pa.pirate ? pb : pa;
    return !((other.protectedUntil ?? 0) > g.time);
  }
  return (pa.war ?? []).includes(b);
}

export function declareWar(g: Game, a: number, b: number) {
  const pa = g.players[a], pb = g.players[b];
  if (!pa || !pb || pa.pirate || pb.pirate || atWar(g, a, b)) return;
  if (pa.trader || pb.trader || pa.natives || pb.natives) return;
  if (pa.defeated || pb.defeated) return;
  pa.war = [...new Set([...(pa.war ?? []), b])];
  pb.war = [...new Set([...(pb.war ?? []), a])];
  // Ort: Kontor des Gegners
  const k = g.kontor(a === HUMAN ? b : a);
  const where = k ? atB(g, k) : undefined;
  if (a === HUMAN) g.ev.message(`⚔️ Du hast ${pb.name} den Krieg erklärt`, 'bad', where);
  else if (b === HUMAN) { pb.lastWarAt = g.time; g.ev.message(`⚔️ ${pa.name} erklärt dir den Krieg! Frieden kannst du im Menü ☰ anbieten.`, 'bad', where); }
}

/**
 * Darf a das Ziel von b angreifen? Wie atWar – dazu Ureinwohner, aber nur auf ausdrücklichen Befehl des
 * Spielers (nie von selbst, nie durch Computergegner oder Piraten).
 */
export function hostile(g: Game, a: number, b: number, ordered = false): boolean {
  if (atWar(g, a, b)) return true;
  return ordered && a === HUMAN && !!g.players[b]?.natives;
}

// ---------- Weiße Flagge ----------

/** Weiße Flagge hissen (on = true) oder einholen. Steht im Spielstand (Ship.white): Nach dem Laden weht sie weiter –
 *  sonst zählte ein Kriegsschiff mit Flagge vor einem Gegner-Kontor sofort als Reizung (KI2). */
export function setWhiteFlag(g: Game, s: Ship, on: boolean) {
  const S = st(g);
  if (on) s.white = true; else delete s.white;
  if (on) {
    S.white.add(s.id);
    // eigene Kanonen schweigen: laufender Angriff endet
    s.target = undefined; S.shipChase.delete(s.id);
    // Verfolger lassen ab (Piraten und Computergegner)
    for (const o of g.ships) if (o.target === s.id && respectsFlag(g, o.owner)) { o.target = undefined; S.shipChase.delete(o.id); if (g.players[o.owner]?.pirate) sailAway(g, o); }
  } else S.white.delete(s.id);
}

/** Weht auf dem Schiff die weiße Flagge? */
export function whiteFlag(g: Game, s: Ship): boolean { return st(g).white.has(s.id); }

/** Diese Besitzer lassen Schiffe mit weißer Flagge in Ruhe (Piraten und Computergegner) */
function respectsFlag(g: Game, owner: number): boolean {
  const p = g.players[owner];
  return !!p && (!!p.pirate || p.ai);
}

/** Schützt die weiße Flagge dieses Schiff vor owner? (nicht mit Soldaten an Bord) */
function flagProtects(g: Game, s: Ship, owner: number): boolean {
  return st(g).white.has(s.id) && !s.troops?.length && respectsFlag(g, owner);
}


export function makePeace(g: Game, a: number, b: number) {
  const pa = g.players[a], pb = g.players[b];
  if (!pa || !pb) return;
  pa.war = (pa.war ?? []).filter((x) => x !== b);
  pb.war = (pb.war ?? []).filter((x) => x !== a);
  pa.peaceAt = { ...(pa.peaceAt ?? {}), [b]: g.time }; pb.peaceAt = { ...(pb.peaceAt ?? {}), [a]: g.time };
  for (const u of g.units) if (u.target !== undefined) { const t = resolve(g, u.target); if (t && !hostile(g, u.owner, t.owner, u.ordered)) { u.target = undefined; u.ordered = false; } }
  for (const s of g.ships) if (s.target !== undefined) { const t = resolve(g, s.target); if (t && !atWar(g, s.owner, t.owner)) s.target = undefined; }
}

/** Militärstärke grob: Soldaten + Kanonen auf Schiffen + Türme */
export function strength(g: Game, owner: number): number {
  let v = 0;
  for (const u of g.units) if (u.owner === owner) { const d = UNITS[u.type]; v += d.hp * d.str / d.interval / 10; }
  for (const s of g.ships) if (s.owner === owner) v += (s.guns ?? 0) * 0.6;
  for (const b of g.buildings) if (b.owner === owner && BUILDINGS[b.type].tower) v += 4;
  return Math.round(v);
}

/** Preis, damit ein Gegner Frieden schließt (0 = er nimmt ohne Geld an) */
export function peacePrice(g: Game, ai: number): number {
  const mine = strength(g, HUMAN), theirs = strength(g, ai);
  if (mine >= theirs * 1.2) return 0;
  return Math.round((800 + g.players[HUMAN].money * 0.15) / 50) * 50;
}

export function protectionPrice(g: Game): number {
  return Math.round((600 + Math.max(0, g.players[HUMAN].money) * 0.1) / 50) * 50;
}

export function buyProtection(g: Game): Check {
  const p = g.players[HUMAN], cost = protectionPrice(g);
  if (p.money < cost) return { ok: false, reason: 'Zu wenig Taler' };
  p.money -= cost;
  p.protectedUntil = g.time + 1200;
  for (const s of g.ships) if (s.owner === pirates(g)?.id) s.target = undefined;
  return { ok: true };
}

/** Was den Spieler gerade schützen kann (nur Freigeschaltetes) */
export function defenseAdvice(g: Game): string {
  const parts: string[] = [];
  if (g.isUnlocked('burg')) parts.push('Burg und Soldaten');
  if (g.isUnlocked('wachturm') || g.isUnlocked('holzturm')) parts.push('Wachtürme');
  if (g.isUnlocked('werft')) parts.push('Kriegsschiffe');
  // kurz halten: die Meldung muss auch auf dem kleinen iPhone ganz zu lesen sein
  const peace = 'Frieden: Menü ☰';
  return parts.length ? `Schutz: ${parts.join(', ').replace(/, ([^,]*)$/, ' und $1')}. ${peace}.` : `${peace}.`;
}

/** Was gegen Piraten hilft (nur Freigeschaltetes, Schutz geht immer) */
export function pirateAdvice(g: Game): string {
  const parts: string[] = [];
  if (g.isUnlocked('werft')) parts.push('Kriegsschiffe');
  if (g.isUnlocked('wachturm') || g.isUnlocked('holzturm')) parts.push('Wachtürme an der Küste');
  parts.push('gekaufter Schutz (Menü ☰)');
  const t = `${parts.join(', ').replace(/, ([^,]*)$/, ' oder $1')} ${parts.length > 1 ? 'helfen' : 'hilft'}.`;
  return t[0].toUpperCase() + t.slice(1);
}

// ---------- Ziele ----------

export function resolve(g: Game, id: number): Target | undefined {
  const b = g.byId.get(id);
  if (b) return { kind: 'bau', b, owner: b.owner };
  const s = g.ships.find((x) => x.id === id);
  if (s) return { kind: 'ship', s, owner: s.owner };
  const u = g.unitById(id);
  if (u && u.ship === undefined) return { kind: 'unit', u, owner: u.owner };
  return undefined;
}

function targetPos(g: Game, t: Target, fx: number, fy: number): [number, number] {
  if (t.kind === 'unit') return [t.u.x, t.u.y];
  if (t.kind === 'ship') return [t.s.x, t.s.y];
  const s = BUILDINGS[t.b.type].size;
  return [Math.max(t.b.x, Math.min(t.b.x + s, fx)), Math.max(t.b.y, Math.min(t.b.y + s, fy))];
}

function dist(g: Game, x: number, y: number, t: Target) {
  const [tx, ty] = targetPos(g, t, x, y);
  return Math.hypot(tx - x, ty - y);
}

/** Wald oder Gebäude in der Schusslinie? (Kanoniere und Musketiere schießen nicht durch Bäume) */
function lineClear(g: Game, x0: number, y0: number, x1: number, y1: number, ignore: number): boolean {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
  for (let i = 2; i < n - 1; i++) {
    const t = i / n;
    const k = g.idx(Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t));
    if (g.tiles[k] === T.Wald && g.trees[k] > 0.5) return false;
    const o = g.occ[k];
    if (o && o !== ignore) { const b = g.byId.get(o); if (b && !BUILDINGS[b.type].paint && !BUILDINGS[b.type].gate) return false; }
  }
  return true;
}

// ---------- Schaden ----------

/** Holzgebäude (kann brennen): ohne Stein gebaut; Wohnhäuser bis zu den Siedlern */
export function wooden(b: Building): boolean {
  const d = BUILDINGS[b.type];
  if (b.type === 'haus') return b.tier < 2;
  return !(d.cost.stein ?? 0);
}

/** cannon = Kanonenkugel (Turm, Schiff, Kanonier): kann Holzgebäude in Brand setzen */
function damage(g: Game, t: Target, dmg: number, from: number, fx: number, fy: number, cannon = false) {
  const S = st(g);
  if (t.owner === HUMAN && from !== HUMAN && g.time - S.alarmT > 30) {
    S.alarmT = g.time;
    const [px, py] = t.kind === 'unit' ? [t.u.x, t.u.y] : t.kind === 'bau' ? g.center(t.b) : [t.s.x, t.s.y];
    const isl = t.kind === 'ship' ? null : g.islands[g.islandOf[g.idx(Math.floor(px), Math.floor(py))]];
    g.ev.message(t.kind === 'ship' ? `⚔️ Dein Schiff ${t.s.name} wird angegriffen!` : `⚔️ Angriff${isl ? ` auf ${isl.name}` : ''}!`, 'bad', at(px, py));
  }
  void fx; void fy;
  if (t.kind === 'unit') {
    t.u.hp -= dmg;
    if (t.u.hp <= 0) killUnit(g, t.u);
  } else if (t.kind === 'ship') {
    const s = t.s;
    s.hp = (s.hp ?? g.shipMaxHp(s)) - dmg;
    S.lastHit.set(s.id, g.time);
    // Piraten rauben Handelsschiffe aus, statt sie zu versenken (Kriegsschiffe kämpfen bis zum Ende)
    if (g.players[from]?.pirate && !(s.type ?? '').startsWith('krieg') && s.hp < g.shipMaxHp(s) * 0.4) {
      s.hp = Math.max(s.hp, 5);
      const loot = s.slots.reduce((n, sl) => n + sl.n, 0);
      for (const sl of s.slots) { sl.g = null; sl.n = 0; }
      s.safeUntil = g.time + (loot ? 600 : 1800);
      for (const p of g.ships) if (p.owner === from && p.target === s.id) { p.target = undefined; S.shipChase.delete(p.id); sailAway(g, p); }
      if (s.owner === HUMAN && loot) g.ev.message(`🏴‍☠️ Piraten haben die ${s.name} überfallen und ${loot} t Ladung geraubt! ${pirateAdvice(g)}`, 'bad', at(s.x, s.y));
      return;
    }
    if (s.hp <= 0) sinkShip(g, s, from);
  } else {
    const b = t.b;
    b.hp = (b.hp ?? g.maxHp(b)) - dmg;
    S.lastHit.set(b.id, g.time);
    // Kanonenkugel in ein Holzgebäude: kann Feuer fangen (wirkt, sobald es die Ereignisse gibt)
    if (cannon && b.hp > 0 && wooden(b) && g.rng() < IGNITE_CHANCE) ignite(g, b);
    if (b.hp <= 0 && g.players[from]?.pirate && (b.type === 'kontor' || b.type === 'markt')) {
      // Piraten plündern das Lager, zerstören Kontor und Marktplatz aber nicht
      b.hp = Math.round(g.maxHp(b) * 0.3);
      const l = g.lagerOf(b.owner, b.island);
      if (l) for (const k of Object.keys(l) as (keyof typeof l)[]) l[k] = Math.floor(l[k] / 2);
      restIsland(g, b.owner, b.island, from);
      if (b.owner === HUMAN) g.ev.message(`🏴‍☠️ Piraten haben dein Lager auf ${g.islands[b.island]?.name ?? 'der Insel'} geplündert! ${pirateAdvice(g)}`, 'bad', atB(g, b));
      return;
    }
    if (b.hp <= 0) {
      const lager = b.type === 'kontor' || b.type === 'markt';
      const [cx, cy] = g.center(b);
      const s = BUILDINGS[b.type].size;
      const near = g.units.some((u) => u.owner === from && u.ship === undefined && Math.hypot(u.x - cx, u.y - cy) < s / 2 + 2.5);
      if (lager && near) conquer(g, b, from);
      else destroy(g, b, from);
    }
  }
}

export function killUnit(g: Game, u: Unit) {
  g.units = g.units.filter((o) => o !== u);
  st(g).noPath.delete(u.id);
  if (u.ship !== undefined) { const s = g.ships.find((x) => x.id === u.ship); if (s?.troops) s.troops = s.troops.filter((i) => i !== u.id); }
  g.ev.died(u);
}

function sinkShip(g: Game, s: Ship, by: number) {
  g.ev.sunk(s);
  const lost = (s.troops ?? []).length;
  for (const id of s.troops ?? []) { const u = g.unitById(id); if (u) { g.units = g.units.filter((o) => o !== u); } }
  const where = at(s.x, s.y);
  if (lost && s.owner === HUMAN) g.ev.message(lost === 1 ? `🌊 Ein Soldat ist mit der ${s.name} untergegangen` : `🌊 ${lost} Soldaten sind mit der ${s.name} untergegangen`, 'bad', where);
  g.ships = g.ships.filter((o) => o !== s);
  forgetShip(g, s.id);
  const pir = pirates(g);
  if (s.owner === HUMAN) g.ev.message(`🌊 ${s.name} wurde versenkt`, 'bad', where);
  else if (by === HUMAN) g.ev.message(s.type === 'pirat' ? '🏴‍☠️ Piratenschiff versenkt!' : `💥 Schiff von ${g.players[s.owner].name} versenkt`, 'good', where);
  if (pir && s.owner === pir.id) {
    g.pirateT = PIRATE_RESPAWN;
    if (by === HUMAN) {
      g.pirateSunk++;
      if (g.pirateSunk === 3) { g.victories++; g.unlocked.add('triumphbogen'); g.ev.message('🏛️ Sieg über die Piraten! Du darfst einen Triumphbogen bauen', 'good', where); }
    }
  }
  checkDefeat(g, s.owner, by);
}

/** Laufzeit-Zustand eines verschwundenen Schiffs vergessen */
function forgetShip(g: Game, id: number) {
  const S = st(g);
  S.shipChase.delete(id); S.white.delete(id); S.flee.delete(id); S.patrol.delete(id); S.lastHit.delete(id);
}

/** nach einem Küstenüberfall der Piraten: 10 Minuten Ruhe für die ganze Insel, Piraten segeln davon */
function restIsland(g: Game, owner: number, island: number, pirate: number) {
  const p = g.players[owner];
  if (p) p.restAt = { ...(p.restAt ?? {}), [island]: g.time + 600 };
  for (const sh of g.ships) if (sh.owner === pirate && sh.target !== undefined) {
    const t = resolve(g, sh.target);
    if (!t || (t.kind === 'bau' && t.b.island === island)) { sh.target = undefined; st(g).shipChase.delete(sh.id); sailAway(g, sh); }
  }
}

function destroy(g: Game, b: Building, by: number) {
  const owner = b.owner;
  const byPirate = !!g.players[by]?.pirate;
  if (b.type === 'kontor') {
    // Lager der Insel geht verloren, wenn kein Marktplatz mehr da ist
    const rest = g.buildings.some((o) => o !== b && o.owner === owner && o.island === b.island && (o.type === 'markt' || o.type === 'kontor'));
    const l = g.lagerOf(owner, b.island);
    if (l && !rest) for (const k of Object.keys(l) as (keyof typeof l)[]) l[k] = 0;
  }
  const where = atB(g, b);
  g.forceRemove(b);
  st(g).lastHit.delete(b.id);
  if (byPirate) restIsland(g, owner, b.island, by);
  if (owner === HUMAN) g.ev.message(byPirate ? `🏴‍☠️ Piraten haben ein Gebäude zerstört: ${BUILDINGS[b.type].name}! ${pirateAdvice(g)}` : `🔥 ${BUILDINGS[b.type].name} zerstört`, 'bad', where);
  checkDefeat(g, owner, by);
}

/** Kontor/Marktplatz einnehmen: Gebäude und das Land ringsum wechseln den Besitzer */
function conquer(g: Game, b: Building, by: number) {
  const old = b.owner;
  b.owner = by;
  b.hp = Math.round(g.maxHp(b) * 0.4);
  if (b.type === 'kontor') {
    const from = g.lagerOf(old, b.island);
    const key = `${by}:${b.island}`;
    g.lager[key] ??= Object.fromEntries(GOODS.map((gd) => [gd.id, 0])) as never;
    if (from) {
      const to = g.lager[key];
      if (to) for (const k of Object.keys(from) as (keyof typeof from)[]) { to[k] += from[k]; from[k] = 0; }
      else { g.lager[key] = { ...from }; for (const k of Object.keys(from) as (keyof typeof from)[]) from[k] = 0; }
    }
  } else g.lager[`${by}:${b.island}`] ??= Object.fromEntries(GOODS.map((gd) => [gd.id, 0])) as never;
  g.recompute();
  // Gebäude des alten Besitzers, die jetzt auf dem neuen Gebiet stehen, gehen mit über
  for (const o of g.buildings) {
    if (o.owner !== old || o.island !== b.island) continue;
    const s = BUILDINGS[o.type].size;
    let all = true;
    for (let j = 0; j < s && all; j++) for (let i = 0; i < s; i++) if (g.own[g.idx(o.x + i, o.y + j)] !== by) { all = false; break; }
    if (all) { o.owner = by; o.target = undefined; o.train = undefined; g.ev.changed(o); }
  }
  g.recompute();
  g.ev.changed(b);
  g.ev.roads();
  const name = BUILDINGS[b.type].name;
  if (by === HUMAN) g.ev.message(`🚩 ${name} von ${g.players[old].name} erobert!`, 'good', atB(g, b));
  else if (old === HUMAN) g.ev.message(`🚩 ${g.players[by].name} hat ${b.type === 'kontor' ? 'dein Kontor' : 'deinen Marktplatz'} erobert!`, 'bad', atB(g, b));
  checkDefeat(g, old, by);
}

/**
 * Ist ein Spieler besiegt? Gebäude zählen (beim Computergegner nur Kontor und Marktplatz – sie halten sein Land;
 * ohne sie ist er handlungsunfähig), Schiffe nur, wenn sie bewaffnet sind oder Material für ein neues Kontor geladen
 * haben (KI2). Steht nach dem Kontor noch ein Marktplatz, bleibt der Gegner im Spiel: Der Krieg geht weiter, der
 * Marktplatz lässt sich erobern (die Gebäude in seinem Gebiet gehen dann mit über) oder zerstören. Erst wenn auch der
 * letzte Marktplatz fällt, ist er besiegt – seine übrigen Häuser und Betriebe stehen dann auf herrenlosem Land und
 * verfallen (das Land wird frei). Beim Spieler zählt jedes Gebäude, und ohne Kontor schickt das Spiel ihm ein Schiff
 * mit Baumaterial (rescue).
 * by: wer zuletzt zugeschlagen hat (−1 = niemand, der Gegner gibt auf).
 */
export function checkDefeat(g: Game, owner: number, by: number) {
  const p = g.players[owner];
  // Piraten, Händler und Ureinwohner werden nicht „besiegt“ (kein Triumphbogen)
  if (!p || p.pirate || p.trader || p.natives || p.defeated) return;
  const kc = BUILDINGS.kontor.cost;
  const useful = (s: Ship) => s.owner === owner && (!p.ai || (s.guns ?? 0) > 0 || (g.shipCargo(s, 'holz') >= (kc.holz ?? 0) && g.shipCargo(s, 'werkzeug') >= (kc.werkzeug ?? 0)));
  const land = g.buildings.some((b) => b.owner === owner && (!p.ai || b.type === 'kontor' || b.type === 'markt'));
  if (land || g.ships.some(useful)) return;
  p.defeated = true;
  p.warnAt = undefined;
  for (const u of g.units.filter((x) => x.owner === owner)) killUnit(g, u);
  for (const q of g.players) q.war = (q.war ?? []).filter((x) => x !== owner);
  // Computergegner: was noch steht (Häuser, Betriebe, Türme), hat kein Land mehr – es verfällt, das Land wird frei
  if (p.ai) {
    const rest = g.buildings.filter((b) => b.owner === owner);
    if (rest.length) {
      g.forceRemoveMany(rest);
      g.ev.roads();
      g.ev.message(`🏚️ Die verlassenen Gebäude von ${p.name} verfallen – das Land ist wieder frei.`, 'info', atB(g, rest[0]));
    }
  }
  if (owner === HUMAN) { g.ev.message('🏳️ Du hast alles verloren.', 'bad'); return; }
  if (by < 0) { g.ev.message(`${p.name} ist aus dem Spiel ausgeschieden`, 'info'); return; }
  if (by !== HUMAN) { g.ev.message(`${p.name} wurde von ${g.players[by]?.name ?? 'Feinden'} besiegt`, 'info'); return; }
  g.ev.message(`🏆 ${p.name} ist besiegt!`, 'good');
  g.victories++;
  g.unlocked.add('triumphbogen');
  g.ev.message('🏛️ Du darfst einen Triumphbogen bauen', 'good');
}

// ---------- Burg: Ausbildung ----------

export function canTrain(g: Game, b: Building, type: UnitType): Check {
  const d = BUILDINGS[b.type].trains;
  if (!d) return { ok: false, reason: 'Nur in Burg oder Festung' };
  const ud = UNITS[type];
  if (!g.reached(ud.unlock, b.owner)) return { ok: false, reason: `Erst ab ${ud.unlock.n} ${['Pionieren', 'Siedlern', 'Bürgern', 'Kaufleuten', 'Aristokraten'][ud.unlock.tier]}` };
  if ((b.train?.length ?? 0) >= d.slots) return { ok: false, reason: 'Alle Plätze belegt' };
  if (g.units.filter((u) => u.owner === b.owner).length + g.buildings.reduce((n, o) => n + (o.owner === b.owner ? o.train?.length ?? 0 : 0), 0) >= MAX_UNITS) return { ok: false, reason: `Höchstens ${MAX_UNITS} Soldaten` };
  const l = g.lagerOf(b.owner, b.island);
  for (const [k, n] of Object.entries(ud.cost)) if (!l || l[k as keyof typeof l] < (n ?? 0)) return { ok: false, reason: `Zu wenig ${k === 'schwerter' ? 'Schwerter' : k === 'musketen' ? 'Musketen' : 'Kanonen'}` };
  return { ok: true };
}

export function train(g: Game, b: Building, type: UnitType): Check {
  const c = canTrain(g, b, type);
  if (!c.ok) return c;
  const l = g.lagerOf(b.owner, b.island)!;
  for (const [k, n] of Object.entries(UNITS[type].cost)) l[k as keyof typeof l] -= n ?? 0;
  (b.train ??= []).push({ type, t: BUILDINGS[b.type].trains!.time });
  return { ok: true };
}

/** freies Landfeld neben einem Gebäude (oder Punkt) */
function freeSpot(g: Game, cx: number, cy: number, r0 = 1, taken?: Set<number>): [number, number] | null {
  for (let r = r0; r < 8; r++) {
    let best: [number, number] | null = null, bd = 1e9;
    for (let y = Math.floor(cy) - r; y <= Math.floor(cy) + r; y++) for (let x = Math.floor(cx) - r; x <= Math.floor(cx) + r; x++) {
      if (!g.inMap(x, y)) continue;
      const k = g.idx(x, y);
      if (!walkable(g, k) || taken?.has(k)) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    if (best) { taken?.add(g.idx(best[0], best[1])); return best; }
  }
  return null;
}

function walkable(g: Game, k: number) {
  const t = g.tiles[k];
  return t !== T.Wasser && t !== T.Berg && !g.occ[k];
}

export function spawnUnit(g: Game, type: UnitType, owner: number, x: number, y: number): Unit {
  const u: Unit = { id: g.nextId++, type, owner, x: x + 0.5, y: y + 0.5, dir: 0, hp: UNITS[type].hp, path: [], cd: 0 };
  g.units.push(u);
  return u;
}

function tickTraining(g: Game, b: Building, dt: number) {
  if (!b.train?.length) return;
  for (const j of b.train) j.t -= dt;
  const done = b.train.filter((j) => j.t <= 0);
  if (!done.length) return;
  b.train = b.train.filter((j) => j.t > 0);
  const [cx, cy] = g.center(b);
  for (const j of done) {
    const p = freeSpot(g, cx, cy, Math.ceil(BUILDINGS[b.type].size / 2) + 1);
    if (!p) { b.train.push({ type: j.type, t: 3 }); continue; }
    spawnUnit(g, j.type, b.owner, p[0], p[1]);
    if (b.owner === HUMAN) g.ev.message(`${UNITS[j.type].icon} ${UNITS[j.type].name} ausgebildet`, 'good', at(p[0] + 0.5, p[1] + 0.5));
  }
}

// ---------- Befehle ----------

/** Laufkosten je Feld für einen Soldaten */
function costFn(g: Game, owner: number) {
  return (k: number) => {
    const t = g.tiles[k];
    if (t === T.Wasser || t === T.Berg) return Infinity;
    const o = g.occ[k];
    if (o) {
      const b = g.byId.get(o);
      if (!b) return Infinity;
      if (b.owner === owner) return BUILDINGS[b.type].gate ? 1 : Infinity;
      return atWar(g, owner, b.owner) ? 12 : Infinity; // Feind: durchbrechen
    }
    if (g.roads[k]) return 0.7;
    return t === T.Wald ? 1.6 : 1;
  };
}

/**
 * Begehbare Gebiete: zusammenhängendes Land ohne Berge bekommt eine Nummer (-1 = Wasser oder Berg).
 * Gebäude zählen nicht mit (feindliche lassen sich einreißen, eigene haben Tore). Liegen Start und Ziel in
 * verschiedenen Gebieten (z. B. auf zwei Inseln), braucht es gar keine Wegsuche. Neu bei geändertem g.buildVersion.
 */
function regions(g: Game): Int32Array {
  const S = st(g);
  if (S.region && S.region.ver === g.buildVersion && S.region.size === g.size) return S.region.id;
  const N = g.size, NN = N * N;
  const id = S.region && S.region.size === N ? S.region.id : new Int32Array(NN);
  id.fill(-1);
  const q = new Int32Array(NN);
  const land = (k: number) => { const t = g.tiles[k]; return t !== T.Wasser && t !== T.Berg; };
  let n = 0;
  for (let k = 0; k < NN; k++) {
    if (id[k] !== -1 || !land(k)) continue;
    let h = 0, e = 0;
    q[e++] = k; id[k] = n;
    while (h < e) {
      const c = q[h++], x = c % N;
      if (x > 0 && id[c - 1] === -1 && land(c - 1)) { id[c - 1] = n; q[e++] = c - 1; }
      if (x < N - 1 && id[c + 1] === -1 && land(c + 1)) { id[c + 1] = n; q[e++] = c + 1; }
      if (c >= N && id[c - N] === -1 && land(c - N)) { id[c - N] = n; q[e++] = c - N; }
      if (c + N < NN && id[c + N] === -1 && land(c + N)) { id[c + N] = n; q[e++] = c + N; }
    }
    n++;
  }
  S.region = { ver: g.buildVersion, size: N, id };
  return id;
}

/** Liegen beide Felder sicher in verschiedenen begehbaren Gebieten? */
function apart(g: Game, k0: number, k1: number): boolean {
  const r = regions(g);
  return r[k0] >= 0 && r[k1] >= 0 && r[k0] !== r[k1];
}

/**
 * Weg für einen Soldaten suchen. self = selbst gewähltes Ziel (kleinere Suche).
 * Ergebnis: 'ok' = Weg (oder ein Stück davon) gefunden, 'none' = kein Weg, 'wait' = dieses Ziel wurde eben
 * vergeblich oder nur zum Teil gesucht – erst nach einigen Sekunden erneut (spart Rechenzeit im Gefecht).
 */
function pathTo(g: Game, u: Unit, tx: number, ty: number, self = false): 'ok' | 'none' | 'wait' {
  const gx = Math.floor(tx), gy = Math.floor(ty);
  if (!g.inMap(gx, gy)) return 'none';
  const S = st(g);
  u.goal = [tx, ty];
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
  // andere Insel (oder hinter Bergen): sofort aufgeben, ganz ohne Suche
  if (apart(g, g.idx(sx, sy), g.idx(gx, gy))) { u.path = []; return 'none'; }
  const np = S.noPath.get(u.id);
  if (np && np.until > g.time && Math.hypot(np.x - tx, np.y - ty) < 1.5) return 'wait';
  S.budget--;
  const p = findLandPath(g.size, costFn(g, u.owner), sx, sy, gx, gy, self ? SELF_NODES : 8000);
  if (!p) { u.path = []; S.noPath.set(u.id, { until: g.time + NO_PATH_WAIT, x: tx, y: ty }); return 'none'; }
  u.path = p;
  // nur ein Stück des Wegs gefunden (Ziel zu weit oder versperrt): erst nach einer Weile wieder ganz suchen
  const end = p.length ? p[p.length - 1] : [sx + 0.5, sy + 0.5];
  if (Math.hypot(end[0] - (gx + 0.5), end[1] - (gy + 0.5)) > 1.5) S.noPath.set(u.id, { until: g.time + NO_PATH_WAIT, x: tx, y: ty });
  else S.noPath.delete(u.id);
  return 'ok';
}

/** darf in diesem Rechenschritt noch ein Weg gesucht werden? */
const mayPlan = (g: Game) => st(g).budget > 0;

/** Aufstellung beim Laufbefehl: Reihe (quer zur Laufrichtung) oder Block */
export type Aufstellung = 'reihe' | 'block';

/** Reihenfolge in der Aufstellung: Nahkämpfer vorn, dann Musketiere, Kanoniere hinten */
const RANK: Record<UnitType, number> = { infanterie: 0, reiter: 0, musketier: 1, kanonier: 2 };

/**
 * Plätze der Aufstellung um den Zielpunkt: erste Reihe am Ziel, weitere Reihen dahinter (vom Ziel aus
 * gesehen Richtung Gruppe). Reihe = eine breite Linie (ab 12 Soldaten zwei Linien), Block = fast quadratisch.
 */
export function formationSlots(n: number, cx: number, cy: number, x: number, y: number, form: Aufstellung): [number, number][] {
  let dx = x - cx, dy = y - cy;
  const d = Math.hypot(dx, dy);
  if (d < 0.5) { dx = 0; dy = 1; } else { dx /= d; dy /= d; }
  const px = -dy, py = dx; // quer zur Laufrichtung
  const cols = form === 'reihe' ? Math.min(n, 12) : Math.ceil(Math.sqrt(n));
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols), col = i % cols;
    const inRow = Math.min(cols, n - row * cols);
    const lat = col - (inRow - 1) / 2;
    out.push([x + px * lat - dx * row, y + py * lat - dy * row]);
  }
  return out;
}

/**
 * Soldaten an einen Ort schicken, in Aufstellung: 'block' (Standard) oder 'reihe' quer zur Laufrichtung.
 * Nahkämpfer stehen vorn, Kanoniere hinten. Rückgabe: wie viele losgehen.
 */
export function orderMove(g: Game, units: Unit[], x: number, y: number, form: Aufstellung = 'block'): number {
  const land = units.filter((u) => u.ship === undefined);
  if (!land.length) return 0;
  let cx = 0, cy = 0;
  for (const u of land) { cx += u.x; cy += u.y; }
  cx /= land.length; cy /= land.length;
  const sorted = [...land].sort((a, b) => RANK[a.type] - RANK[b.type]);
  const slots = land.length === 1 ? [[x, y] as [number, number]] : formationSlots(land.length, cx, cy, x, y, form);
  let ok = 0;
  const taken = new Set<number>();
  sorted.forEach((u, i) => {
    u.target = undefined; u.ordered = false; u.board = undefined; u.then = undefined; u.fell = undefined; u.chop = undefined;
    const [sx, sy] = slots[i];
    const p = land.length === 1 ? [Math.floor(x), Math.floor(y)] as [number, number] : freeSpot(g, sx, sy, 0, taken) ?? [Math.floor(x), Math.floor(y)];
    st(g).noPath.delete(u.id);
    // der erste sucht sofort (für die Rückmeldung), die anderen nacheinander – kein Stocken bei großen Gruppen
    if (ok === 0) { if (pathTo(g, u, p[0] + 0.5, p[1] + 0.5) === 'ok') ok++; }
    else { u.path = []; u.dest = [p[0] + 0.5, p[1] + 0.5]; u.repath = ok * 0.03; ok++; }
  });
  return ok;
}

export function orderAttack(g: Game, units: Unit[], targetId: number) {
  let i = 0;
  for (const u of units) {
    if (u.ship !== undefined) continue;
    u.dest = undefined; u.target = targetId; u.ordered = true; u.board = undefined; u.path = []; u.goal = undefined; u.fell = undefined; u.chop = undefined;
    // Wegsuche zeitlich versetzt (große Gruppen stocken nicht)
    u.repath = (i++ % 10) * 0.05;
    st(g).noPath.delete(u.id);
  }
}

export function orderBoard(g: Game, units: Unit[], s: Ship) {
  for (const u of units) { if (u.ship !== undefined) continue; u.dest = undefined; u.board = s.id; u.target = undefined; u.ordered = false; u.path = []; u.repath = 0; u.fell = undefined; u.chop = undefined; st(g).noPath.delete(u.id); }
}

/** Bäume fällen: die Soldaten laufen zum Waldfeld k (und zu Waldfeldern daneben), hacken ≈ 4 s, danach ist dort Gras. */
export function orderFell(g: Game, units: Unit[], k: number): number {
  if (k < 0 || k >= g.tiles.length || g.tiles[k] !== T.Wald) return 0;
  const N = g.size, kx = k % N, ky = Math.floor(k / N);
  // Waldfelder um k, die nächsten zuerst (jeder Soldat bekommt möglichst sein eigenes)
  const woods: number[] = [];
  for (let r = 0; r <= 3; r++) for (let y = ky - r; y <= ky + r; y++) for (let x = kx - r; x <= kx + r; x++) {
    if (Math.max(Math.abs(x - kx), Math.abs(y - ky)) !== r || !g.inMap(x, y)) continue;
    const j = g.idx(x, y);
    if (g.tiles[j] === T.Wald && !g.occ[j]) woods.push(j);
  }
  let n = 0;
  for (const u of units) {
    // Kanoniere haben keine Axt dabei
    if (u.ship !== undefined || u.type === 'kanonier') continue;
    u.target = undefined; u.ordered = false; u.board = undefined; u.dest = undefined; u.then = undefined; u.path = []; u.goal = undefined;
    u.fell = woods[n % woods.length] ?? k; u.chop = 0; u.repath = (n % 10) * 0.05;
    st(g).noPath.delete(u.id);
    n++;
  }
  return n;
}

/** Ausmustern: Soldaten verlassen still das Heer (kein Kampf, kein Sterben) – ihr Sold endet. */
export function dismiss(g: Game, units: Unit[]): number {
  const S = st(g);
  let n = 0;
  for (const u of units) {
    if (!g.units.includes(u)) continue;
    g.units = g.units.filter((o) => o !== u);
    if (u.ship !== undefined) { const s = g.ships.find((x) => x.id === u.ship); if (s?.troops) s.troops = s.troops.filter((i) => i !== u.id); }
    S.noPath.delete(u.id);
    n++;
  }
  return n;
}

export function shipAttack(g: Game, s: Ship, targetId: number) {
  s.target = targetId;
  const S = st(g);
  // wer angreift, holt die weiße Flagge ein
  S.white.delete(s.id); delete s.white;
  S.shipChase.set(s.id, { ordered: true, repath: 0 });
}

/**
 * Patrouille: das Schiff pendelt zwischen seinem jetzigen Ort und (x, y) und greift unterwegs Feinde in
 * Reichweite an. Ein anderer Fahrbefehl beendet sie. Rückgabe: false, wenn es dorthin keinen Weg gibt.
 */
export function patrol(g: Game, s: Ship, x: number, y: number): boolean {
  const from: [number, number] = [s.x, s.y];
  if (!g.moveShip(s, x, y)) return false;
  s.patrol = [from[0], from[1], x, y];
  st(g).patrol.set(s.id, { leg: 1, chase: false, repath: 0 });
  return true;
}

/** Patrouille beenden (das Schiff fährt die laufende Strecke zu Ende) */
export function stopPatrol(g: Game, s: Ship) {
  s.patrol = undefined;
  st(g).patrol.delete(s.id);
}

/** Truppen an der nahen Küste absetzen */
export function unloadTroops(g: Game, s: Ship): number {
  const ids = s.troops ?? [];
  if (!ids.length) return 0;
  const taken = new Set<number>();
  let n = 0;
  for (const id of [...ids]) {
    const u = g.unitById(id);
    if (!u) continue;
    const p = freeSpot(g, s.x, s.y, 1, taken);
    if (!p || Math.hypot(p[0] + 0.5 - s.x, p[1] + 0.5 - s.y) > 4.5) break;
    u.ship = undefined; u.x = p[0] + 0.5; u.y = p[1] + 0.5; u.path = []; u.target = undefined; u.dest = undefined;
    s.troops = s.troops!.filter((i) => i !== id);
    n++;
  }
  return n;
}

/** Kanonen aus dem Kontor aufs Schiff (bis zum Höchstwert) */
export function armShip(g: Game, s: Ship): number {
  const k = g.shipDock(s);
  if (!k) return 0;
  const l = g.lagerOf(s.owner, k.island)!;
  const max = SHIPS[s.type ?? 'handel_klein'].kanonen;
  const n = Math.max(0, Math.min(max - (s.guns ?? 0), Math.floor(l.kanonen)));
  l.kanonen -= n;
  s.guns = (s.guns ?? 0) + n;
  return n;
}

export function disarmShip(g: Game, s: Ship): number {
  const k = g.shipDock(s);
  if (!k || !s.guns) return 0;
  const l = g.lagerOf(s.owner, k.island)!;
  const n = s.guns;
  l.kanonen += n;
  s.guns = 0;
  return n;
}

// ---------- Ablauf ----------

function acquire(g: Game, owner: number, x: number, y: number, r: number, opts: { units?: boolean; ships?: boolean; buildings?: boolean; island?: number }): Target | undefined {
  let best: Target | undefined, bd = r;
  // Piraten lassen gerade Ausgeraubtes eine Weile in Ruhe
  const safe = (o: { safeUntil?: number; owner: number; island?: number }) => !!g.players[owner]?.pirate
    && ((o.safeUntil ?? 0) > g.time || (o.island !== undefined && (g.players[o.owner]?.restAt?.[o.island] ?? 0) > g.time));
  const isl = opts.island;
  const onIsl = (px: number, py: number) => isl === undefined || g.islandOf[g.idx(Math.floor(px), Math.floor(py))] === isl;
  if (opts.units !== false) for (const u of g.units) {
    if (u.ship !== undefined || !atWar(g, owner, u.owner) || !onIsl(u.x, u.y)) continue;
    const d = Math.hypot(u.x - x, u.y - y);
    if (d < bd) { bd = d; best = { kind: 'unit', u, owner: u.owner }; }
  }
  if (opts.ships) for (const s of g.ships) {
    if (!atWar(g, owner, s.owner) || safe(s) || flagProtects(g, s, owner)) continue;
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < bd) { bd = d; best = { kind: 'ship', s, owner: s.owner }; }
  }
  if (opts.buildings && !best) {
    for (const b of g.buildings) {
      if (!atWar(g, owner, b.owner) || (isl !== undefined && b.island !== isl) || safe(b)) continue;
      const t: Target = { kind: 'bau', b, owner: b.owner };
      const d = dist(g, x, y, t) + (BUILDINGS[b.type].tower ? 0 : BUILDINGS[b.type].paint ? 3 : 1.5);
      if (d < bd) { bd = d; best = t; }
    }
  }
  return best;
}

function shotKind(type: UnitType): ShotKind {
  return type === 'musketier' ? 'muskete' : type === 'kanonier' ? 'kanone' : 'schwert';
}

/**
 * Bäume fällen: hinlaufen, dann ≈ 4 s hacken (ein Hieb pro Sekunde), danach wird das Feld Gras.
 * true = der Soldat hackt gerade (nicht weiterlaufen).
 */
function tickFell(g: Game, u: Unit, dt: number): boolean {
  const k = u.fell!;
  if (g.tiles[k] !== T.Wald || g.occ[k]) { u.fell = undefined; u.chop = undefined; return false; }
  const N = g.size, fx = (k % N) + 0.5, fy = Math.floor(k / N) + 0.5;
  const d = Math.hypot(fx - u.x, fy - u.y);
  if (d <= 1.25) {
    u.path = []; u.goal = undefined;
    u.dir = Math.atan2(fx - u.x, fy - u.y);
    const before = u.chop ?? 0;
    u.chop = before + dt;
    // ein Axthieb je Sekunde: Ausholbewegung und Klang
    if ((Math.floor(u.chop) !== Math.floor(before) || before === 0) && u.chop < FELL_TIME) { u.atk = g.time; g.ev.chop?.(u); }
    if (u.chop >= FELL_TIME) {
      u.fell = undefined; u.chop = undefined;
      g.ev.felled(k);
      g.tiles[k] = T.Gras;
      g.trees[k] = 0; g.wild[k] = 0; g.weide[k] = 0;
      g.buildVersion++;
      g.ev.trees();
    }
    return true;
  }
  if (!u.path.length) {
    u.repath = (u.repath ?? 0) - dt;
    if (u.repath <= 0 && mayPlan(g)) {
      u.repath = 1.5;
      const r = pathTo(g, u, fx, fy);
      if (r === 'none' || (r === 'ok' && !u.path.length)) {
        u.fell = undefined; u.chop = undefined;
        const S = st(g);
        if (u.owner === HUMAN && g.time - S.fellMsgT > 5) { S.fellMsgT = g.time; g.ev.message('Die Soldaten kommen nicht zu den Bäumen', 'bad', at(fx, fy)); }
      }
    }
  }
  return false;
}

function tickUnit(g: Game, u: Unit, dt: number) {
  const d = UNITS[u.type];
  u.cd = Math.max(0, u.cd - dt);
  if (u.ship !== undefined) {
    const s = g.ships.find((x) => x.id === u.ship);
    if (s) { u.x = s.x; u.y = s.y; } else killUnit(g, u);
    return;
  }
  // Einsteigen
  if (u.board !== undefined) {
    const s = g.ships.find((x) => x.id === u.board);
    if (!s || s.owner !== u.owner) { u.board = undefined; return; }
    const cap = SHIPS[s.type ?? 'handel_klein'].troops;
    if (Math.hypot(s.x - u.x, s.y - u.y) < 3.2 && !s.path.length) {
      if ((s.troops?.length ?? 0) >= cap) { u.board = undefined; if (u.owner === HUMAN) g.ev.message('Das Schiff ist voll besetzt', 'bad'); return; }
      (s.troops ??= []).push(u.id);
      u.ship = s.id; u.board = undefined; u.path = [];
      return;
    }
    u.repath = (u.repath ?? 0) - dt;
    if (!u.path.length && u.repath <= 0 && mayPlan(g)) {
      u.repath = 2;
      const p = freeSpot(g, s.x, s.y, 1);
      if (!p || pathTo(g, u, p[0] + 0.5, p[1] + 0.5) === 'none') { u.board = undefined; if (u.owner === HUMAN) g.ev.message('Die Soldaten kommen nicht zum Schiff', 'bad', at(s.x, s.y)); return; }
    }
  } else {
    // Ziel prüfen
    let t = u.target !== undefined ? resolve(g, u.target) : undefined;
    if (t && (!hostile(g, u.owner, t.owner, u.ordered) || (t.kind === 'ship' && u.type !== 'kanonier'))) t = undefined;
    if (!t) {
      u.target = undefined; u.ordered = false;
      // nach dem Abwehrkampf zum befohlenen Ziel zurück
      if (u.then !== undefined) { const n = resolve(g, u.then); if (n && atWar(g, u.owner, n.owner)) { u.target = u.then; u.ordered = true; t = n; } u.then = undefined; }
    }
    // greift ein Feind an, während das Ziel ein Gebäude ist → erst wehren
    if (t && t.kind === 'bau') {
      const foe = acquire(g, u.owner, u.x, u.y, Math.max(d.range, 1.5) + 1.5, { units: true, island: g.islandOf[g.idx(Math.floor(u.x), Math.floor(u.y))] });
      if (foe && foe.kind === 'unit') { if (u.ordered) u.then = t.b.id; u.target = foe.u.id; u.ordered = false; t = foe; }
    }
    // Bäume fällen (nur ohne Kampf)
    if (!t && u.fell !== undefined) { if (tickFell(g, u, dt)) return; }
    // selbst Feinde suchen, wenn untätig
    if (!t && !u.path.length) {
      t = acquire(g, u.owner, u.x, u.y, AGGRO + (d.range > 2 ? d.range - 2 : 0), { buildings: true, ships: u.type === 'kanonier', island: g.islandOf[g.idx(Math.floor(u.x), Math.floor(u.y))] });
      if (t) u.target = t.kind === 'unit' ? t.u.id : t.kind === 'ship' ? t.s.id : t.b.id;
    }
    if (t) {
      const [tx, ty] = targetPos(g, t, u.x, u.y);
      const dd = Math.hypot(tx - u.x, ty - u.y);
      const ranged = d.range > 2;
      const inRange = dd <= d.range + (t.kind === 'bau' ? 0.3 : 0) && (!ranged || lineClear(g, u.x, u.y, tx, ty, t.kind === 'bau' ? t.b.id : 0));
      if (inRange) {
        u.path = [];
        u.dir = Math.atan2(tx - u.x, ty - u.y);
        if (u.cd <= 0) {
          u.cd = d.interval;
          u.atk = g.time;
          // Fehlschüsse: Schaden je Treffer durch die Trefferchance geteilt (im Mittel wie im Vorbild)
          const hit = ranged ? g.rng() < HIT.feld : true;
          g.ev.shot(shotKind(u.type), u.x, u.y, tx, ty, hit);
          if (hit) damage(g, t, ranged ? d.str / HIT.feld : d.str, u.owner, u.x, u.y, u.type === 'kanonier');
        }
        return;
      }
      // hinlaufen (Weg neu berechnen, wenn das Ziel sich bewegt hat)
      u.repath = (u.repath ?? 0) - dt;
      const moved = !u.goal || Math.hypot(u.goal[0] - tx, u.goal[1] - ty) > 1.5;
      if ((moved || !u.path.length) && u.repath <= 0 && mayPlan(g)) {
        u.repath = 1 + g.rng() * 0.5;
        const r = pathTo(g, u, tx, ty, !u.ordered);
        if (r === 'none' || (r === 'ok' && !u.path.length)) {
          // kein Weg dorthin (andere Insel, eingemauert): Ziel aufgeben
          if (!u.ordered || dd > 3) { u.target = undefined; u.ordered = false; u.then = undefined; }
        }
      }
    }
  }
  // gestaffelter Laufbefehl
  if (u.dest && u.target === undefined && u.board === undefined && !u.path.length) {
    u.repath = (u.repath ?? 0) - dt;
    if (u.repath <= 0 && mayPlan(g)) { const [dx, dy] = u.dest; u.dest = undefined; pathTo(g, u, dx, dy); }
  }
  // laufen
  let step = d.speed * dt;
  while (step > 0 && u.path.length) {
    const [px, py] = u.path[0];
    const k = g.idx(Math.floor(px), Math.floor(py));
    const o = g.occ[k];
    if (o) {
      const b = g.byId.get(o);
      if (b && !(b.owner === u.owner && BUILDINGS[b.type].gate)) {
        // Hindernis: Feind → einreißen, sonst neuen Weg suchen
        if (atWar(g, u.owner, b.owner)) { if (u.target !== undefined && u.target !== b.id && u.ordered) u.then = u.target; u.target = b.id; u.ordered = false; u.path = []; }
        else { u.path = []; u.repath = 0; }
        break;
      }
    }
    const dx = px - u.x, dy = py - u.y, dd = Math.hypot(dx, dy);
    if (dd < 1e-3) { u.path.shift(); continue; }
    const slow = g.roads[g.idx(Math.floor(u.x), Math.floor(u.y))] ? 1.25 : g.tiles[g.idx(Math.floor(u.x), Math.floor(u.y))] === T.Wald ? 0.7 : 1;
    const m = Math.min(step * slow, dd);
    u.x += (dx / dd) * m; u.y += (dy / dd) * m;
    u.dir = Math.atan2(dx, dy);
    step -= m / slow;
    if (m >= dd) u.path.shift();
  }
  if (!u.path.length) u.goal = undefined;
}

/** stehende Soldaten nicht übereinander: einer macht ein paar Schritte zur Seite (läuft sichtbar, statt zu rutschen) */
function separate(g: Game) {
  const land = g.units.filter((u) => u.ship === undefined && !u.path.length && u.target === undefined && !u.dest && u.fell === undefined);
  if (land.length < 2) return;
  // Raster je Feld: nur Nachbarn in den umliegenden Feldern vergleichen (statt jeder mit jedem)
  const N = g.size;
  const cell = new Map<number, Unit[]>();
  const key = (x: number, y: number) => Math.floor(y) * N + Math.floor(x);
  for (const u of land) { const k = key(u.x, u.y); const l = cell.get(k); if (l) l.push(u); else cell.set(k, [u]); }
  const near = (x: number, y: number, r: number, skip: Unit) => {
    const cx = Math.floor(x), cy = Math.floor(y);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const l = cell.get((cy + j) * N + cx + i);
      if (l) for (const o of l) if (o !== skip && Math.hypot(o.x - x, o.y - y) < r) return o;
    }
    return undefined;
  };
  const order = new Map<Unit, number>();
  land.forEach((u, i) => order.set(u, i));
  const taken = new Set<number>();
  for (const b of land) {
    if (b.path.length) continue;
    // nur ausweichen, wenn ein früherer (noch stehender) Soldat zu nah steht
    const cx = Math.floor(b.x), cy = Math.floor(b.y);
    let crowded = false;
    for (let j = -1; j <= 1 && !crowded; j++) for (let i = -1; i <= 1 && !crowded; i++) {
      const l = cell.get((cy + j) * N + cx + i);
      if (l) for (const a of l) if (a !== b && order.get(a)! < order.get(b)! && !a.path.length && Math.hypot(b.x - a.x, b.y - a.y) <= 0.4) { crowded = true; break; }
    }
    if (!crowded) continue;
    // freien Platz in der Nähe suchen (Feldmitte oder Viertelpunkt eines freien Nachbarfelds)
    for (const [ox, oy] of [[0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3], [0.8, 0.8], [-0.8, 0.8], [0.8, -0.8], [-0.8, -0.8], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = b.x + ox, y = b.y + oy;
      const tk = Math.round(x * 4) * 10000 + Math.round(y * 4);
      if (!walkableOrSame(g, b, x, y) || taken.has(tk) || near(x, y, 0.45, b)) continue;
      taken.add(tk);
      b.path = [[x, y]];
      break;
    }
  }
}
function walkableOrSame(g: Game, u: Unit, x: number, y: number) {
  const k = g.idx(Math.floor(x), Math.floor(y));
  return k === g.idx(Math.floor(u.x), Math.floor(u.y)) || walkable(g, k);
}

function tickTower(g: Game, b: Building, dt: number) {
  const tw = BUILDINGS[b.type].tower!;
  b.cd = Math.max(0, (b.cd ?? 0) - dt);
  if (b.cd > 0) return;
  const [cx, cy] = g.center(b);
  const t = acquire(g, b.owner, cx, cy, tw.range, { ships: true });
  if (!t) { b.cd = 0.5; return; }
  b.cd = tw.interval;
  const [tx, ty] = targetPos(g, t, cx, cy);
  const hit = g.rng() < HIT.turm;
  g.ev.shot('turm', cx, cy, tx, ty, hit);
  if (hit) damage(g, t, tw.str / HIT.turm, b.owner, cx, cy, true);
}

function tickShipCombat(g: Game, s: Ship, dt: number) {
  const max = g.shipMaxHp(s);
  s.hp ??= max;
  // Ausbessern an der eigenen Werft (Holz aus dem Lager)
  const S = st(g);
  const calm = g.time - (S.lastHit.get(s.id) ?? -99);
  if (s.hp < max && calm > 10 && !s.path.length) {
    const w = g.buildings.find((b) => (b.type === 'werft' || b.type === 'grosswerft') && b.owner === s.owner && Math.hypot(g.center(b)[0] - s.x, g.center(b)[1] - s.y) < 7);
    const l = w ? g.lagerOf(s.owner, w.island) : null;
    if (l && l.holz >= 0.1) { const h = Math.min(max - s.hp, 2 * dt); s.hp += h; l.holz = Math.max(0, l.holz - h / 10); }
  }
  const pirate = !!g.players[s.owner]?.pirate;
  // Piraten fliehen bei schwerem Schaden und kommen erst erholt wieder (sie flicken ihr Schiff auf See)
  if (pirate) {
    if (!S.flee.has(s.id) && s.hp < max * PIRATE_FLEE) {
      S.flee.add(s.id);
      s.target = undefined; S.shipChase.delete(s.id);
      sailAway(g, s);
      if (g.seen[g.idx(Math.floor(s.x), Math.floor(s.y))]) g.ev.message('🏴‍☠️ Das Piratenschiff dreht schwer beschädigt ab!', 'good', at(s.x, s.y));
    }
    if (S.flee.has(s.id)) {
      if (calm > 20) s.hp = Math.min(max, s.hp + 0.3 * dt);
      if (s.hp >= max * PIRATE_BACK) S.flee.delete(s.id);
      else { s.target = undefined; return; }
    }
  }
  tickPatrol(g, s, dt);
  if (!s.guns) { s.target = undefined; return; }
  s.cd = Math.max(0, (s.cd ?? 0) - dt);
  const ch = S.shipChase.get(s.id) ?? { ordered: false, repath: 0 };
  const white = S.white.has(s.id);
  let t = s.target !== undefined ? resolve(g, s.target) : undefined;
  if (t && !hostile(g, s.owner, t.owner, ch.ordered)) t = undefined;
  // weiße Flagge: Piraten und Computergegner lassen ab (verfolgende Piraten segeln davon)
  if (t && t.kind === 'ship' && flagProtects(g, t.s, s.owner)) { t = undefined; if (pirate) sailAway(g, s); }
  if (!t) {
    const pt = S.patrol.get(s.id);
    // Verfolgung auf Patrouille vorbei: Kurs zum Feind abbrechen, die Patrouille geht weiter
    if (pt && (pt.chase || ch.ordered) && s.path.length) { s.path = []; s.goal = undefined; }
    s.target = undefined; ch.ordered = false;
    // eigene Kanonen schießen unter weißer Flagge nicht von selbst
    if (!white) t = acquire(g, s.owner, s.x, s.y, SHIP_GUN.range + (s.patrol ? 3 : 1), { ships: true, units: false });
    if (t) s.target = t.kind === 'ship' ? t.s.id : undefined;
    if (pt) pt.chase = !!t;
  }
  S.shipChase.set(s.id, ch);
  if (!t) return;
  const [tx, ty] = targetPos(g, t, s.x, s.y);
  const dd = Math.hypot(tx - s.x, ty - s.y);
  const pt = S.patrol.get(s.id);
  if (dd <= SHIP_GUN.range) {
    if ((ch.ordered || pt?.chase) && s.path.length && dd < SHIP_GUN.range - 1.5) s.path = [];
    if (s.cd <= 0) {
      s.cd = SHIP_GUN.interval;
      s.shotT = g.time;
      const hit = g.rng() < HIT.schiff;
      g.ev.shot('schiff', s.x, s.y, tx, ty, hit);
      if (hit) damage(g, t, (s.guns * SHIP_GUN.dmg) / HIT.schiff, s.owner, s.x, s.y, true);
    }
  } else if (ch.ordered || pt?.chase) {
    // Patrouille verfolgt nur in der Nähe (sonst weiter auf ihrer Strecke)
    if (!ch.ordered && pt && dd > SHIP_GUN.range + 5) { s.target = undefined; pt.chase = false; s.path = []; return; }
    ch.repath -= dt;
    if (ch.repath <= 0) { ch.repath = 2.5; g.moveShip(s, tx, ty); }
  }
}

/** Patrouille: zwischen den beiden Punkten pendeln; ein anderer Fahrbefehl des Spielers beendet sie */
function tickPatrol(g: Game, s: Ship, dt: number) {
  const S = st(g);
  if (!s.patrol) { S.patrol.delete(s.id); return; }
  let pt = S.patrol.get(s.id);
  // nach dem Laden: Richtung aus der Lage ableiten
  if (!pt) {
    const [x1, y1, x2, y2] = s.patrol;
    pt = { leg: Math.hypot(s.x - x1, s.y - y1) < Math.hypot(s.x - x2, s.y - y2) ? 1 : 0, chase: false, repath: 0 };
    S.patrol.set(s.id, pt);
  }
  const [x1, y1, x2, y2] = s.patrol;
  // Fahrt zu einem anderen Ziel (nicht beim Verfolgen) = neuer Befehl: Patrouille endet
  if (!pt.chase && !S.shipChase.get(s.id)?.ordered && s.goal && s.path.length) {
    const near = (x: number, y: number) => Math.hypot(s.goal![0] - x, s.goal![1] - y) < 1;
    if (!near(x1, y1) && !near(x2, y2)) { stopPatrol(g, s); return; }
  }
  if (s.target !== undefined || s.path.length) return;
  pt.repath -= dt;
  if (pt.repath > 0) return;
  // am Ende angekommen (oder nach einer Verfolgung): zum anderen Punkt bzw. weiter zum Ziel der Strecke
  const [ex, ey] = pt.leg ? [x2, y2] : [x1, y1];
  if (Math.hypot(ex - s.x, ey - s.y) < 1.5) pt.leg = pt.leg ? 0 : 1;
  const [nx, ny] = pt.leg ? [x2, y2] : [x1, y1];
  // nicht in jedem Rechenschritt neu planen (Wegsuche auf See ist teuer)
  pt.repath = g.moveShip(s, nx, ny) ? 1 : 5;
}

// ---------- Piraten ----------

/** nach einem Überfall davonsegeln */
function sailAway(g: Game, s: Ship) {
  for (let i = 0; i < 20; i++) {
    const a = g.rng() * Math.PI * 2;
    const x = Math.floor(s.x + Math.cos(a) * 40), y = Math.floor(s.y + Math.sin(a) * 40);
    if (g.inMap(x, y) && g.isWater(g.idx(x, y)) && g.moveShip(s, x + 0.5, y + 0.5)) return;
  }
}

function tickPirates(g: Game, dt: number) {
  const pir = pirates(g);
  if (!pir) return;
  const ships = g.ships.filter((s) => s.owner === pir.id);
  if (!ships.length) {
    g.pirateT -= dt;
    if (g.pirateT <= 0 && g.time > PIRATE_START) {
      g.pirateT = PIRATE_RESPAWN;
      // weit weg von allen Kontoren auftauchen
      for (let i = 0; i < 200; i++) {
        const x = 5 + Math.floor(g.rng() * (g.size - 10)), y = 5 + Math.floor(g.rng() * (g.size - 10));
        if (!g.isWater(g.idx(x, y))) continue;
        if (g.buildings.some((b) => b.type === 'kontor' && Math.hypot(b.x - x, b.y - y) < 35)) continue;
        g.ships.push({ id: g.nextId++, type: 'pirat' as ShipType, owner: pir.id, name: 'Schwarze Möwe', x: x + 0.5, y: y + 0.5, dir: 0, path: [], slots: [], hp: SHIPS.pirat.hp, guns: SHIPS.pirat.kanonen });
        break;
      }
    }
    return;
  }
  const S = st(g);
  S.pirateThinkT -= dt;
  if (S.pirateThinkT > 0) return;
  S.pirateThinkT = 3;
  for (const s of ships) {
    // erst gesichtet → Warnung
    if (g.seen[g.idx(Math.floor(s.x), Math.floor(s.y))] && !g.pirateSeen) { g.pirateSeen = true; g.ev.message('🏴‍☠️ Piraten gesichtet! Sie überfallen Schiffe. Schutz kannst du im Menü ☰ kaufen, oder hisse die weiße Flagge.', 'bad', at(s.x, s.y)); }
    if (s.target !== undefined || S.flee.has(s.id)) continue;
    let prey: Ship | undefined, pd = 16;
    for (const o of g.ships) {
      if (!atWar(g, pir.id, o.owner) || (o.safeUntil ?? 0) > g.time || flagProtects(g, o, pir.id)) continue;
      const d = Math.hypot(o.x - s.x, o.y - s.y);
      if (d < pd) { pd = d; prey = o; }
    }
    if (prey) { shipAttack(g, s, prey.id); continue; }
    // ab und zu eine schlecht bewachte Küste beschießen
    if (s.target === undefined && g.time > PIRATE_COAST && g.rng() < 0.08) {
      const b = acquire(g, pir.id, s.x, s.y, 30, { buildings: true, units: false });
      // nur Küsten von Spielern, die schon Wachtürme bauen können (und das seit einer Weile)
      const since = b ? g.players[b.owner]?.defendAt : undefined;
      if (b && b.kind === 'bau' && since !== undefined && g.time - since > 900 && g.time > (g.players[b.owner]?.graceUntil ?? 0) && !g.buildings.some((o) => o.owner === b.owner && BUILDINGS[o.type].tower && Math.hypot(o.x - b.b.x, o.y - b.b.y) < 9)) { shipAttack(g, s, b.b.id); continue; }
    }
    if (!s.path.length && s.target === undefined) {
      for (let i = 0; i < 20; i++) {
        const x = Math.floor(s.x + (g.rng() - 0.5) * 70), y = Math.floor(s.y + (g.rng() - 0.5) * 70);
        if (g.inMap(x, y) && g.isWater(g.idx(x, y)) && g.moveShip(s, x + 0.5, y + 0.5)) break;
      }
    }
  }
}

// ---------- Computergegner ----------
// Militär der Computergegner (Paket KI2): Soll-Truppen aus eigener Größe, Stärke des Spielers und Charakter
// (6 bis 30, src/ai.ts sollTruppen). Ausgebildet wird wie beim Spieler in der Burg mit Waffen aus dem Lager
// (gekauft beim Händler oder selbst geschmiedet; Burg, Türme und Schmieden setzt ai.ts ab 200 Siedlern),
// nur mit Reserve in der Kasse und nur, solange der Sold aus dem Überschuss bezahlbar bleibt. Kriegsschiffe
// kommen aus der eigenen Werft (bis zu 3) und laden Kanonen am Kontor. Krieg nur bei positiver Bilanz:
// aus eigenem Antrieb je nach Charakter (Zeitpunkt gestreut), sonst bei Reizung (Kontor auf seiner Insel,
// Soldaten auf seinem Land, Kriegsschiff vor seinem Kontor) – immer erst mit Vorwarnung.

/** Kasse, die beim Ausbilden und Schiffbau mindestens bleibt (die Gegner haben meist 1 000 bis 3 000 Taler –
 *  mit einer höheren Grenze bildete kaum einer je einen Soldaten aus) */
const MIL_RESERVE = 800;
/** so oft (Sekunden) denkt das Militär der Gegner */
const MIL_THINK = 5;

export function tickAIMilitary(g: Game) {
  if (g.players[HUMAN].defeated) return;
  for (const p of g.players) {
    if (!p.ai || p.defeated || !p.brain) continue;
    const b = p.brain as Brain;
    const k = g.kontor(p.id, b.island) ?? g.kontor(p.id);
    if (!k) { if (p.warnAt !== undefined) g.ev.message(`🕊️ ${p.name} rüstet wieder ab`, 'good'); p.warnAt = undefined; continue; }
    const kAt = atB(g, k);
    const S = st(g);
    const mine = g.units.filter((u) => u.owner === p.id);
    const war = atWar(g, p.id, HUMAN);
    const per = persoenlichkeit(p);
    const inc = g.incomePerMinute(p.id);
    const plus = inc.tax - inc.upkeep;
    recruit(g, p, mine, plus);
    warships(g, p, k, war);
    // Krieg erklären – aus eigenem Antrieb (Charakter, Zeitpunkt gestreut, deutlich stärker) oder weil der
    // Spieler ihn reizt; beides nur bei positiver Bilanz
    reizung(g, p, MIL_THINK, (s) => S.white.has(s.id));
    const me = g.players[HUMAN];
    const spaet = kiGrenzen(g).angriff === 'spaet';
    b.kriegT ??= per.kriegAb * (spaet ? 1.5 : 1) + rng(g.seed * 13 + p.id * 71)() * 900;
    const canDefend = me.defendAt;
    const fair = g.time > (me.graceUntil ?? 0) && g.time - (p.peaceAt?.[HUMAN] ?? -9999) > 900;
    // aus eigenem Antrieb erst, wenn sich der Spieler wehren kann (Burg/Türme ab 200 Siedlern) oder sehr spät
    const gate = (canDefend !== undefined && g.time - canDefend > (spaet ? 1800 : 900)) || g.time > (spaet ? 7200 : 5400);
    const mineStr = strength(g, p.id), hisStr = strength(g, HUMAN);
    const own = per.krieg > 0 && g.time > b.kriegT && gate && mineStr > hisStr * per.mut + 3;
    const provoked = (b.aerger ?? 0) >= per.geduld && mineStr > 0;
    const ready = !war && fair && plus > 0 && (own || provoked);
    if (!ready) {
      // Lage hat sich geändert: Vorwarnung verfällt
      if (p.warnAt !== undefined && !war) { g.ev.message(`🕊️ ${p.name} rüstet wieder ab`, 'good', kAt); p.calmUntil = g.time + 300; me.calmUntil = g.time + 300; }
      p.warnAt = undefined;
    } else if (p.warnAt !== undefined) {
      if (g.time >= p.warnAt) { p.warnAt = undefined; b.aerger = 0; declareWar(g, p.id, HUMAN); }
    } else {
      // nie zwei Vorwarnungen gleichzeitig und frühestens 10 Minuten nach der letzten Kriegserklärung
      const busy = g.players.some((o) => o.ai && o !== p && o.warnAt !== undefined) || g.time - (me.lastWarAt ?? -9999) < 600 || g.time < (p.calmUntil ?? 0) || g.time < (me.calmUntil ?? 0);
      if (!busy && g.rng() < (provoked ? 0.3 : 0.04 * per.krieg)) {
        // erst eine Vorwarnung, drei Minuten später der Krieg
        p.warnAt = g.time + 180;
        const why = provoked && b.anlass ? ` – ${b.anlass}` : '';
        g.ev.message(`⚠️ ${p.name} rüstet zum Krieg gegen dich${why}! ${defenseAdvice(g)}`, 'bad', kAt);
      }
    }
    // Soldaten, die noch an Bord sitzen (z. B. nach dem Laden eines Spielstands): heimfahren und absetzen
    if (!S.raids.has(p.id)) for (const s of g.ships) {
      if (s.owner !== p.id || !s.troops?.length || s.path.length) continue;
      if (unloadTroops(g, s) > 0 || g.shipDock(s)) continue;
      const [cx, cy] = g.center(k);
      g.moveShip(s, cx, cy);
    }
    if (!war) continue;
    defend(g, p.id, mine);
    // Kriegsschiff jagt Schiffe des Spielers in der Nähe der eigenen Insel
    for (const s of g.ships) {
      if (s.owner !== p.id || !s.guns || s.target !== undefined) continue;
      const prey = acquire(g, p.id, s.x, s.y, 40, { ships: true, units: false });
      if (prey) shipAttack(g, s, prey.kind === 'ship' ? prey.s.id : 0);
    }
    // Angriff: Truppen per Schiff zur nächsten Insel des Spielers bringen, Kriegsschiffe geben Geleit
    raid(g, p.id, mine, sollTruppen(g, p));
  }
}

/** Ausbildung in der Burg: bis zur Soll-Zahl, nur mit Waffen im Lager, Reserve in der Kasse und bezahlbarem Sold.
 *  Etwa jeder vierte wird Kanonier (ab 400 Bürgern), Musketiere ab 400 Kaufleuten, sonst Schwertkämpfer und Reiter. */
function recruit(g: Game, p: Player, mine: Unit[], plus: number) {
  const soll = sollTruppen(g, p);
  if (!soll || p.money < MIL_RESERVE) return;
  const burgs = g.buildings.filter((b) => b.owner === p.id && BUILDINGS[b.type].trains);
  if (!burgs.length) return;
  const training = burgs.reduce((n, b) => n + (b.train?.length ?? 0), 0);
  if (mine.length + training >= soll) return;
  const guns = mine.filter((u) => u.type === 'kanonier').length + burgs.reduce((n, b) => n + (b.train?.filter((j) => j.type === 'kanonier').length ?? 0), 0);
  const order: UnitType[] = [];
  if (guns < soll / 4) order.push('kanonier');
  order.push('musketier', ...(g.rng() < 0.35 ? ['reiter', 'infanterie'] as UnitType[] : ['infanterie', 'reiter'] as UnitType[]));
  for (const b of burgs) for (const t of order) {
    if (plus - UNITS[t].upkeep < 0) continue;
    if (train(g, b, t).ok) return;
  }
  // keine Waffen im Lager: Schwerter für einen Soldaten am Kontor kaufen (Sofort-Handel wie der Spieler)
  const b = burgs[0], l = g.lagerOf(p.id, b.island);
  const need = (UNITS.infanterie.cost.schwerter ?? 3) - Math.floor(l?.schwerter ?? 0);
  // (R2-Fix2) Polster 100 statt 500 Taler – sonst kam die Burg fast nie zum Ausbilden
  if (l && need > 0 && plus > UNITS.infanterie.upkeep && p.money > MIL_RESERVE + need * (PRICES.schwerter?.kaufen ?? 122) * 1.4 + 100) sofort(g, p.id, b.island, 'schwerter', need);
}

/** Kriegsschiffe: bis zu 3 aus der eigenen Werft (im Frieden die Eroberin eines, bei Krieg oder Vorwarnung mehr);
 *  am Kontor Kanonen laden */
function warships(g: Game, p: Player, k: Building, war: boolean) {
  const navy = g.ships.filter((s) => s.owner === p.id && (s.type ?? '').startsWith('krieg'));
  for (const s of navy) {
    const max = SHIPS[s.type ?? 'krieg_klein'].kanonen;
    if (s.path.length || s.target !== undefined || (s.guns ?? 0) >= max) continue;
    const dock = g.shipDock(s);
    if (dock) {
      // fehlende Kanonen am Kontor kaufen (Sofort-Handel wie der Spieler), solange die Kasse reicht
      const l = g.lagerOf(p.id, dock.island);
      const lack = Math.max(0, max - (s.guns ?? 0) - Math.floor(l?.kanonen ?? 0));
      const each = (PRICES.kanonen?.kaufen ?? 340) * 1.4;
      const n = Math.min(lack, Math.floor((p.money - MIL_RESERVE) / each));
      if (n > 0) sofort(g, p.id, dock.island, 'kanonen', n);
      armShip(g, s);
    }
    else if (!s.troops?.length && !st(g).raids.has(p.id)) { const at = dockAt(g, k); if (at) g.moveShip(s, at[0], at[1]); }
  }
  const per = persoenlichkeit(p);
  // die Eroberin hält schon im Frieden ein Kriegsschiff, sobald sie eine Werft hat
  const want = war ? 3 : p.warnAt !== undefined ? 2 : per.ruestetFrueh ? 1 : 0;
  const building = g.buildings.filter((b) => b.owner === p.id && b.job && b.job.ship.startsWith('krieg')).length;
  // (R2-Fix2) Geld: der Preis des Schiffs plus ein kleines Polster (im Krieg 300, sonst 900) – vorher verlangte die
  // KI 2 300 Taler in der Kasse, die sie fast nie hatte: es gab in keiner Welt ein Kriegsschiff
  if (navy.length + building >= Math.min(3, want) || p.money < SHIPS.krieg_klein.cost.taler + (war || p.warnAt !== undefined ? 300 : 900)) return;
  const w = g.buildings.find((b) => b.owner === p.id && (b.type === 'werft' || b.type === 'grosswerft') && !b.job);
  if (!w) return;
  const type: ShipType = w.type === 'grosswerft' && g.reached(SHIPS.krieg_gross.unlock, p.id) ? 'krieg_gross' : 'krieg_klein';
  const sd = SHIPS[type], l = g.lagerOf(p.id, w.island);
  if (!l) return;
  for (const [gd, n] of [['holz', sd.cost.holz], ['stoff', sd.cost.stoff]] as const) {
    const lack = Math.ceil(n - l[gd]);
    if (lack > 0 && sofort(g, p.id, w.island, gd, lack) < lack) return;
  }
  g.orderShip(w, type);
}

/** Verteidigung im Krieg: freie Soldaten greifen Feinde an, die auf eigenem Land stehen */
function defend(g: Game, owner: number, mine: Unit[]) {
  const N = g.size;
  const foes = g.units.filter((u) => u.ship === undefined && u.owner !== owner && atWar(g, owner, u.owner) && g.own[Math.floor(u.y) * N + Math.floor(u.x)] === owner);
  if (!foes.length) return;
  const crew = new Set(st(g).raids.get(owner)?.crew ?? []);
  for (const u of mine) {
    if (u.ship !== undefined || u.target !== undefined || u.board !== undefined || crew.has(u.id)) continue;
    let best: Unit | undefined, bd = 30;
    for (const f of foes) { const d = Math.hypot(f.x - u.x, f.y - u.y); if (d < bd) { bd = d; best = f; } }
    if (best) orderAttack(g, [u], best.id);
  }
}

/** Überfall der KI in Wellen: sammeln → einsteigen → hinfahren (Kriegsschiffe geben Geleit) → absetzen → angreifen.
 *  Transport: am liebsten ein Kriegsschiff, sonst ein Handelsschiff ohne Handelsroute. */
function raid(g: Game, owner: number, mine: Unit[], soll: number) {
  const raids = st(g).raids;
  let r = raids.get(owner);
  const islandAt = (x: number, y: number) => g.islandOf[g.idx(Math.floor(x), Math.floor(y))];
  const idle = mine.filter((u) => u.ship === undefined && u.target === undefined && !u.path.length && u.board === undefined);
  if (!r) {
    if (idle.length < Math.max(4, Math.round(soll * 0.5)) || g.rng() > 0.15) return;
    // nicht das Schiff einer laufenden Erweiterung (es wartet am Kontor mit Material für ein neues Kontor) und kein
    // Schiff mit Kontor-Material an Bord – das ginge sonst mit unter, wenn der Angriff scheitert
    const erw = (g.players[owner]?.brain as Brain | undefined)?.erw?.ship;
    const free = g.ships.filter((s) => s.owner === owner && !s.path.length && !route(g, s) && s.id !== erw && !hasKontorCargo(g, s));
    const ship = free.find((s) => (s.type ?? '').startsWith('krieg')) ?? free.find((s) => (s.type ?? 'handel_klein').startsWith('handel'));
    if (!ship) return;
    const goal = g.buildings.filter((b) => b.owner === HUMAN && (b.type === 'kontor' || b.type === 'markt'))
      .sort((a, b) => Math.hypot(a.x - ship.x, a.y - ship.y) - Math.hypot(b.x - ship.x, b.y - ship.y))[0];
    if (!goal) return;
    // Schiff erst an die Küste bei den Soldaten bringen (dort, wo sie es auch erreichen)
    const cx = idle.reduce((a, u) => a + u.x, 0) / idle.length, cy = idle.reduce((a, u) => a + u.y, 0) / idle.length;
    if (!g.moveShip(ship, cx, cy)) return;
    // Kanoniere zuerst an Bord (gegen Türme), dann die anderen
    const crew = [...idle].sort((a, b) => (b.type === 'kanonier' ? 1 : 0) - (a.type === 'kanonier' ? 1 : 0)).slice(0, SHIPS[ship.type ?? 'handel_klein'].troops);
    r = { phase: 'anfahrt', ship: ship.id, t: 0, dest: g.center(goal), crew: crew.map((u) => u.id) };
    raids.set(owner, r);
    return;
  }
  const ship = g.ships.find((s) => s.id === r!.ship);
  r.t += 5;
  if (!ship || r.t > 400) { raids.delete(owner); return; }
  if (r.phase === 'anfahrt') {
    if (!ship.path.length) {
      const crew = (r.crew ?? []).map((id) => g.unitById(id)).filter((u): u is Unit => !!u && u.ship === undefined);
      if (!crew.length) { raids.delete(owner); return; }
      orderBoard(g, crew, ship);
      r.phase = 'sammeln'; r.t = 0;
    }
  } else if (r.phase === 'sammeln') {
    const boarding = g.units.some((u) => u.owner === owner && u.board === ship.id);
    if (!boarding || r.t > 90) {
      if (!ship.troops?.length) { raids.delete(owner); return; }
      if (g.moveShip(ship, r.dest![0], r.dest![1])) { r.phase = 'fahren'; escort(g, owner, ship, r.dest!); } else raids.delete(owner);
    }
  } else if (r.phase === 'fahren') {
    if (!ship.path.length) {
      if (unloadTroops(g, ship) === 0 && ship.troops?.length) {
        // Küste zu weit weg: näher heran, sonst aufgeben (Soldaten fahren dann heim)
        r.tries = (r.tries ?? 0) + 1;
        if (r.tries > 3 || !g.moveShip(ship, r.dest![0], r.dest![1])) raids.delete(owner);
        return;
      }
      r.phase = 'land';
      for (const u of g.units) if (u.owner === owner && u.ship === undefined && Math.hypot(u.x - ship.x, u.y - ship.y) < 6) {
        const t = acquire(g, owner, u.x, u.y, 30, { buildings: true, island: islandAt(u.x, u.y) });
        if (t) { u.target = t.kind === 'unit' ? t.u.id : t.kind === 'ship' ? t.s.id : t.b.id; u.ordered = true; }
      }
    }
  } else if (!g.units.some((u) => u.owner === owner && u.target !== undefined)) raids.delete(owner);
}

/** Geleit: bis zu 3 bewaffnete Kriegsschiffe fahren mit zum Ziel und greifen dort Schiffe und Küstenbauten an */
function escort(g: Game, owner: number, transport: Ship, dest: [number, number]) {
  let n = 0;
  for (const s of g.ships) {
    if (n >= 3 || s.owner !== owner || s === transport || !(s.guns ?? 0) || s.target !== undefined) continue;
    n++;
    const t = acquire(g, owner, dest[0], dest[1], 12, { ships: true, buildings: true, units: false });
    if (t && t.kind !== 'unit') shipAttack(g, s, t.kind === 'ship' ? t.s.id : t.b.id);
    else g.moveShip(s, dest[0], dest[1]);
  }
}

// ---------- Hauptschleife ----------

export function tickCombat(g: Game, dt: number) {
  ensurePirates(g);
  const S = st(g);
  S.budget = PATH_BUDGET;
  for (const b of g.buildings) {
    const d = BUILDINGS[b.type];
    if (d.trains) tickTraining(g, b, dt);
    if (d.tower) tickTower(g, b, dt);
    // Gebäude bessern sich langsam aus, wenn eine Weile Ruhe ist – von selbst aber nur bis 75 %
    if (b.hp !== undefined && g.time - (S.lastHit.get(b.id) ?? -99) > 15) {
      const cap = g.maxHp(b) * SELF_REPAIR;
      if (b.hp < cap) b.hp = Math.min(cap, b.hp + 0.4 * dt);
    }
  }
  // Ziele, die es nicht mehr gibt: Laufzeit-Zustand aufräumen (selten)
  if (S.lastHit.size > 2000) for (const id of S.lastHit.keys()) if (!g.byId.has(id) && !g.ships.some((x) => x.id === id)) S.lastHit.delete(id);
  for (const u of [...g.units]) if (g.units.includes(u)) tickUnit(g, u, dt);
  for (const s of [...g.ships]) if (g.ships.includes(s)) tickShipCombat(g, s, dt);
  // Soldaten heilen: beim Arzt schnell (auch im Kampf), sonst nur ganz langsam auf eigenem Gebiet ohne Kampf
  for (const u of g.units) {
    if (u.ship !== undefined || u.hp >= UNITS[u.type].hp) continue;
    const rate = nearDoctor(g, u) ? HEAL_DOCTOR : u.target === undefined && g.own[g.idx(Math.floor(u.x), Math.floor(u.y))] === u.owner ? HEAL_FIELD : 0;
    if (rate) u.hp = Math.min(UNITS[u.type].hp, u.hp + rate * dt);
  }
  S.sepT += dt;
  if (S.sepT > 0.2) { S.sepT = 0; separate(g); }
  tickPirates(g, dt);
  S.aiT += dt;
  if (S.aiT > 5) {
    S.aiT = 0;
    for (const p of g.players) if (!p.pirate && p.defendAt === undefined && g.reached({ tier: 1, n: 200 }, p.id)) p.defendAt = g.time;
    rescue(g);
    tickAIMilitary(g);
  }
}

/** Ohne Kontor und ohne Schiff ginge es nicht weiter: ein neues Schiff mit Startladung schicken */
function rescue(g: Game) {
  const me = g.players[HUMAN];
  const S = st(g);
  if (me.defeated || g.kontor(HUMAN) || g.time < S.rescueT) return;
  // reicht die Ladung eines eigenen Schiffs noch für ein Kontor?
  const kc = BUILDINGS.kontor.cost;
  if (g.ships.some((s) => s.owner === HUMAN && g.shipCargo(s, 'holz') >= (kc.holz ?? 0) && g.shipCargo(s, 'werkzeug') >= (kc.werkzeug ?? 0))) return;
  S.rescueT = g.time + 600;
  const [sx, sy] = g.starts[HUMAN] ?? [10, 10];
  const ship: Ship = { id: g.nextId++, type: 'handel_klein', owner: HUMAN, name: 'Hoffnung', x: sx + 0.5, y: sy + 0.5, dir: 0, path: [], slots: [] };
  for (let i = 0; i < 4; i++) ship.slots.push(START_CARGO[i] ? { g: START_CARGO[i][0], n: START_CARGO[i][1] } : { g: null, n: 0 });
  g.ships.push(ship);
  if (me.money < 300) me.money = 300;
  g.ev.message('⛵ Ein neues Schiff mit Baumaterial ist angekommen – gründe ein neues Kontor!', 'good', at(ship.x, ship.y));
}

/** Nach der Niederlage weiterspielen: Frieden mit allen, neues Schiff */
export function restart(g: Game) {
  const me = g.players[HUMAN];
  me.defeated = false;
  // Neubeginn: 40 Minuten Ruhe vor Kriegen, Schutzfrist für das Wehren beginnt neu
  me.defendAt = undefined;
  me.graceUntil = g.time + 2400;
  for (const p of g.players) if (p.id !== HUMAN && !p.pirate) { makePeace(g, HUMAN, p.id); p.warnAt = undefined; }
  me.protectedUntil = g.time + 1200;
  st(g).rescueT = 0;
  rescue(g);
}

/** Ärzte eines Besitzers (Mittelpunkte), zwischengespeichert bis zur nächsten Bauänderung */
function doctors(g: Game, owner: number): [number, number][] | undefined {
  const S = st(g);
  if (!S.doctors || S.doctors.ver !== g.buildVersion || S.doctors.n !== g.buildings.length) {
    const by = new Map<number, [number, number][]>();
    for (const b of g.buildings) if (b.type === 'arzt') { let l = by.get(b.owner); if (!l) by.set(b.owner, (l = [])); l.push(g.center(b)); }
    S.doctors = { ver: g.buildVersion, n: g.buildings.length, by };
  }
  return S.doctors.by.get(owner);
}

/** Steht der Soldat im Umkreis eines eigenen Arztes? (an Land) */
export function nearDoctor(g: Game, u: Unit): boolean {
  if (u.ship !== undefined) return false;
  const l = doctors(g, u.owner);
  if (!l) return false;
  const r = BUILDINGS.arzt.radius ?? 16;
  return l.some(([x, y]) => Math.hypot(x - u.x, y - u.y) <= r);
}

/** Unterhalt (Sold) der Soldaten je Minute; wer beim eigenen Arzt gepflegt wird, kostet keinen Sold */
export function unitUpkeep(g: Game, owner: number): number {
  let n = 0;
  for (const u of g.units) if (u.owner === owner && !nearDoctor(g, u)) n += UNITS[u.type].upkeep;
  return n;
}
