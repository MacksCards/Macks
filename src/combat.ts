// Kampf wie im Vorbild: Soldaten aus der Burg, Wachtürme, bewaffnete Schiffe, Seeschlachten,
// Truppen übersetzen, Eroberung über Kontor/Marktplatz, Krieg und Frieden, Piraten.
import { BUILDINGS, GOODS, MAX_UNITS, SHIP_GUN, SHIPS, START_CARGO, ShipType, UNITS, UnitType } from './data';
import { Building, Check, Game, HUMAN, Ship, ShotKind, Unit } from './game';
import { findLandPath } from './path';
import { T } from './world';

type Target = { kind: 'unit'; u: Unit; owner: number } | { kind: 'ship'; s: Ship; owner: number } | { kind: 'bau'; b: Building; owner: number };

const PIRATE_START = 1800; // Spielsekunden bis zum ersten Piraten (ca. 30 Minuten)
const PIRATE_COAST = 3000; // ab dann beschießen sie auch Küsten
const PIRATE_RESPAWN = 480;
const AGGRO = 6; // so nah bemerken Soldaten Feinde von selbst

/** Laufzeit-Zustand je Spiel (wird nicht gespeichert) */
interface State {
  /** Zeit des letzten Treffers je Gebäude/Schiff (für Ausbessern) */
  lastHit: Map<number, number>;
  /** Schiffe: Ziel vom Spieler befohlen (verfolgen) + Zeit bis zur nächsten Kursberechnung */
  shipChase: Map<number, { ordered: boolean; repath: number }>;
  raids: Map<number, { phase: 'sammeln' | 'fahren' | 'land'; ship: number; t: number; dest?: [number, number]; tries?: number }>;
  sepT: number; aiT: number; alarmT: number; pirateThinkT: number;
  /** KI: Zeitpunkt der Vorwarnung vor der Kriegserklärung */
  warnT: Map<number, number>;
  /** nächstes mögliches Ersatzschiff */
  rescueT: number;
  /** KI: nächster Zeitpunkt zum Anwerben bzw. für ein Kriegsschiff */
  recruitT: Map<number, number>;
  shipT: Map<number, number>;
  /** Spielzeit, ab der ein Spieler sich wehren kann (200 Siedler erreicht) */
  defendT: Map<number, number>;
}
const states = new WeakMap<Game, State>();
function st(g: Game): State {
  let s = states.get(g);
  if (!s) { s = { lastHit: new Map(), shipChase: new Map(), raids: new Map(), warnT: new Map(), rescueT: 0, defendT: new Map(), recruitT: new Map(), shipT: new Map(), sepT: 0, aiT: 0, alarmT: -99, pirateThinkT: 0 }; states.set(g, s); }
  return s;
}

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
  if (pa.pirate || pb.pirate) {
    const other = pa.pirate ? pb : pa;
    return !((other.protectedUntil ?? 0) > g.time);
  }
  return (pa.war ?? []).includes(b);
}

export function declareWar(g: Game, a: number, b: number) {
  const pa = g.players[a], pb = g.players[b];
  if (!pa || !pb || pa.pirate || pb.pirate || atWar(g, a, b)) return;
  pa.war = [...(pa.war ?? []), b];
  pb.war = [...(pb.war ?? []), a];
  if (a === HUMAN) g.ev.message(`⚔️ Du hast ${pb.name} den Krieg erklärt`, 'bad');
  else if (b === HUMAN) g.ev.message(`⚔️ ${pa.name} erklärt dir den Krieg!`, 'bad');
}


export function makePeace(g: Game, a: number, b: number) {
  const pa = g.players[a], pb = g.players[b];
  if (!pa || !pb) return;
  pa.war = (pa.war ?? []).filter((x) => x !== b);
  pb.war = (pb.war ?? []).filter((x) => x !== a);
  pa.peaceAt = { ...(pa.peaceAt ?? {}), [b]: g.time }; pb.peaceAt = { ...(pb.peaceAt ?? {}), [a]: g.time };
  for (const u of g.units) if (u.target !== undefined) { const t = resolve(g, u.target); if (t && !atWar(g, u.owner, t.owner)) { u.target = undefined; u.ordered = false; } }
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

function damage(g: Game, t: Target, dmg: number, from: number, fx: number, fy: number) {
  const S = st(g);
  if (t.owner === HUMAN && from !== HUMAN && g.time - S.alarmT > 30) {
    S.alarmT = g.time;
    const [px, py] = t.kind === 'unit' ? [t.u.x, t.u.y] : t.kind === 'bau' ? g.center(t.b) : [fx, fy];
    const isl = t.kind === 'ship' ? null : g.islands[g.islandOf[g.idx(Math.floor(px), Math.floor(py))]];
    g.ev.message(t.kind === 'ship' ? `⚔️ Dein Schiff ${t.s.name} wird angegriffen!` : `⚔️ Angriff${isl ? ` auf ${isl.name}` : ''}!`, 'bad');
  }
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
      s.safeUntil = g.time + 600;
      for (const p of g.ships) if (p.owner === from && p.target === s.id) { p.target = undefined; S.shipChase.delete(p.id); sailAway(g, p); }
      if (s.owner === HUMAN) g.ev.message(`🏴‍☠️ Piraten haben die ${s.name} überfallen${loot ? ` und ${loot} t Ladung geraubt` : ''}! Kriegsschiffe, Wachtürme oder Schutz (Menü ☰) helfen.`, 'bad');
      return;
    }
    if (s.hp <= 0) sinkShip(g, s, from);
  } else {
    const b = t.b;
    b.hp = (b.hp ?? g.maxHp(b)) - dmg;
    S.lastHit.set(b.id, g.time);
    if (b.hp <= 0 && g.players[from]?.pirate && (b.type === 'kontor' || b.type === 'markt')) {
      // Piraten plündern das Lager, zerstören Kontor und Marktplatz aber nicht
      b.hp = Math.round(g.maxHp(b) * 0.3);
      const l = g.lagerOf(b.owner, b.island);
      if (l) for (const k of Object.keys(l) as (keyof typeof l)[]) l[k] = Math.floor(l[k] / 2);
      b.safeUntil = g.time + 600;
      for (const p of g.ships) if (p.owner === from && p.target === b.id) { p.target = undefined; S.shipChase.delete(p.id); sailAway(g, p); }
      if (b.owner === HUMAN) g.ev.message(`🏴‍☠️ Piraten haben dein Lager auf ${g.islands[b.island]?.name ?? 'der Insel'} geplündert! Wachtürme schützen die Küste.`, 'bad');
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
  if (u.ship !== undefined) { const s = g.ships.find((x) => x.id === u.ship); if (s?.troops) s.troops = s.troops.filter((i) => i !== u.id); }
  g.ev.died(u);
}

function sinkShip(g: Game, s: Ship, by: number) {
  g.ev.sunk(s);
  const lost = (s.troops ?? []).length;
  for (const id of s.troops ?? []) { const u = g.unitById(id); if (u) { g.units = g.units.filter((o) => o !== u); } }
  if (lost && s.owner === HUMAN) g.ev.message(lost === 1 ? `🌊 Ein Soldat ist mit der ${s.name} untergegangen` : `🌊 ${lost} Soldaten sind mit der ${s.name} untergegangen`, 'bad');
  g.ships = g.ships.filter((o) => o !== s);
  st(g).shipChase.delete(s.id);
  const pir = pirates(g);
  if (s.owner === HUMAN) g.ev.message(`🌊 ${s.name} wurde versenkt`, 'bad');
  else if (by === HUMAN) g.ev.message(s.type === 'pirat' ? '🏴‍☠️ Piratenschiff versenkt!' : `💥 Schiff von ${g.players[s.owner].name} versenkt`, 'good');
  if (pir && s.owner === pir.id) {
    g.pirateT = PIRATE_RESPAWN;
    if (by === HUMAN) {
      g.pirateSunk++;
      if (g.pirateSunk === 3) { g.victories++; g.unlocked.add('triumphbogen'); g.ev.message('🏛️ Sieg über die Piraten! Du darfst einen Triumphbogen bauen', 'good'); }
    }
  }
  checkDefeat(g, s.owner, by);
}

function destroy(g: Game, b: Building, by: number) {
  const owner = b.owner;
  if (b.type === 'kontor') {
    // Lager der Insel geht verloren, wenn kein Marktplatz mehr da ist
    const rest = g.buildings.some((o) => o !== b && o.owner === owner && o.island === b.island && (o.type === 'markt' || o.type === 'kontor'));
    const l = g.lagerOf(owner, b.island);
    if (l && !rest) for (const k of Object.keys(l) as (keyof typeof l)[]) l[k] = 0;
  }
  g.forceRemove(b);
  if (owner === HUMAN) g.ev.message(`🔥 ${BUILDINGS[b.type].name} zerstört`, 'bad');
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
  if (by === HUMAN) g.ev.message(`🚩 ${name} von ${g.players[old].name} erobert!`, 'good');
  else if (old === HUMAN) g.ev.message(`🚩 ${g.players[by].name} hat ${b.type === 'kontor' ? 'dein Kontor' : 'deinen Marktplatz'} erobert!`, 'bad');
  checkDefeat(g, old, by);
}

function checkDefeat(g: Game, owner: number, by: number) {
  const p = g.players[owner];
  if (!p || p.pirate || p.defeated) return;
  if (g.buildings.some((b) => b.owner === owner) || g.ships.some((s) => s.owner === owner)) return;
  p.defeated = true;
  for (const u of g.units.filter((x) => x.owner === owner)) killUnit(g, u);
  for (const q of g.players) q.war = (q.war ?? []).filter((x) => x !== owner);
  if (owner === HUMAN) { g.ev.message('Du hast alles verloren – starte im Menü ein neues Spiel.', 'bad'); return; }
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
    if (b.owner === HUMAN) g.ev.message(`${UNITS[j.type].icon} ${UNITS[j.type].name} ausgebildet`, 'good');
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

function pathTo(g: Game, u: Unit, tx: number, ty: number): boolean {
  const gx = Math.floor(tx), gy = Math.floor(ty);
  if (!g.inMap(gx, gy)) return false;
  const p = findLandPath(g.size, costFn(g, u.owner), Math.floor(u.x), Math.floor(u.y), gx, gy);
  u.goal = [tx, ty];
  if (!p) { u.path = []; return false; }
  u.path = p;
  return true;
}

/** Soldaten in Formation an einen Ort schicken */
export function orderMove(g: Game, units: Unit[], x: number, y: number): number {
  let ok = 0;
  const taken = new Set<number>();
  for (const u of units) {
    if (u.ship !== undefined) continue;
    u.target = undefined; u.ordered = false; u.board = undefined;
    const p = units.length === 1 ? [Math.floor(x), Math.floor(y)] as [number, number] : freeSpot(g, x, y, 0, taken) ?? [Math.floor(x), Math.floor(y)];
    // der erste sucht sofort (für die Rückmeldung), die anderen nacheinander – kein Stocken bei großen Gruppen
    if (ok === 0) { if (pathTo(g, u, p[0] + 0.5, p[1] + 0.5)) ok++; }
    else { u.path = []; u.dest = [p[0] + 0.5, p[1] + 0.5]; u.repath = ok * 0.03; ok++; }
  }
  return ok;
}

export function orderAttack(g: Game, units: Unit[], targetId: number) {
  for (const u of units) { if (u.ship !== undefined) continue; u.dest = undefined; u.target = targetId; u.ordered = true; u.board = undefined; u.path = []; u.goal = undefined; u.repath = 0; }
}

export function orderBoard(g: Game, units: Unit[], s: Ship) {
  for (const u of units) { if (u.ship !== undefined) continue; u.board = s.id; u.target = undefined; u.ordered = false; u.path = []; u.repath = 0; }
}

export function shipAttack(g: Game, s: Ship, targetId: number) {
  s.target = targetId;
  st(g).shipChase.set(s.id, { ordered: true, repath: 0 });
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
    u.ship = undefined; u.x = p[0] + 0.5; u.y = p[1] + 0.5; u.path = []; u.target = undefined;
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
  const safe = (o: { safeUntil?: number }) => g.players[owner]?.pirate && (o.safeUntil ?? 0) > g.time;
  const isl = opts.island;
  const onIsl = (px: number, py: number) => isl === undefined || g.islandOf[g.idx(Math.floor(px), Math.floor(py))] === isl;
  if (opts.units !== false) for (const u of g.units) {
    if (u.ship !== undefined || !atWar(g, owner, u.owner) || !onIsl(u.x, u.y)) continue;
    const d = Math.hypot(u.x - x, u.y - y);
    if (d < bd) { bd = d; best = { kind: 'unit', u, owner: u.owner }; }
  }
  if (opts.ships) for (const s of g.ships) {
    if (!atWar(g, owner, s.owner) || safe(s)) continue;
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
    if (!u.path.length && u.repath <= 0) {
      u.repath = 2;
      const p = freeSpot(g, s.x, s.y, 1);
      if (!p || !pathTo(g, u, p[0] + 0.5, p[1] + 0.5)) { u.board = undefined; if (u.owner === HUMAN) g.ev.message('Die Soldaten kommen nicht zum Schiff', 'bad'); return; }
    }
  } else {
    // Ziel prüfen
    let t = u.target !== undefined ? resolve(g, u.target) : undefined;
    if (t && (!atWar(g, u.owner, t.owner) || (t.kind === 'ship' && u.type !== 'kanonier'))) t = undefined;
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
          const hit = ranged ? Math.random() < 0.85 : true;
          g.ev.shot(shotKind(u.type), u.x, u.y, tx, ty, hit);
          if (hit) damage(g, t, d.str, u.owner, u.x, u.y);
        }
        return;
      }
      // hinlaufen (Weg neu berechnen, wenn das Ziel sich bewegt hat)
      u.repath = (u.repath ?? 0) - dt;
      const moved = !u.goal || Math.hypot(u.goal[0] - tx, u.goal[1] - ty) > 1.5;
      if ((moved || !u.path.length) && u.repath <= 0) {
        u.repath = 1 + Math.random() * 0.5;
        if (!pathTo(g, u, tx, ty) || !u.path.length) {
          // kein Weg dorthin (andere Insel, eingemauert): Ziel aufgeben
          if (!u.ordered || dd > 3) { u.target = undefined; u.ordered = false; u.then = undefined; }
        }
      }
    }
  }
  // gestaffelter Laufbefehl
  if (u.dest && u.target === undefined && u.board === undefined && !u.path.length) {
    u.repath = (u.repath ?? 0) - dt;
    if (u.repath <= 0) { const [dx, dy] = u.dest; u.dest = undefined; pathTo(g, u, dx, dy); }
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

/** stehende Soldaten nicht übereinander */
function separate(g: Game) {
  const land = g.units.filter((u) => u.ship === undefined);
  for (let i = 0; i < land.length; i++) for (let j = i + 1; j < land.length; j++) {
    const a = land[i], b = land[j];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d > 0.55 || d < 1e-4) continue;
    const push = (0.55 - d) * 0.25;
    const ax = a.x - (dx / d) * push, ay = a.y - (dy / d) * push, bx = b.x + (dx / d) * push, by = b.y + (dy / d) * push;
    if (!a.path.length && walkableOrSame(g, a, ax, ay)) { a.x = ax; a.y = ay; }
    if (!b.path.length && walkableOrSame(g, b, bx, by)) { b.x = bx; b.y = by; }
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
  const hit = Math.random() < 0.8;
  g.ev.shot('turm', cx, cy, tx, ty, hit);
  if (hit) damage(g, t, tw.str, b.owner, cx, cy);
}

function tickShipCombat(g: Game, s: Ship, dt: number) {
  const max = g.shipMaxHp(s);
  s.hp ??= max;
  // Ausbessern an der eigenen Werft (Holz aus dem Lager)
  const S = st(g);
  if (s.hp < max && g.time - (S.lastHit.get(s.id) ?? -99) > 10 && !s.path.length) {
    const w = g.buildings.find((b) => (b.type === 'werft' || b.type === 'grosswerft') && b.owner === s.owner && Math.hypot(g.center(b)[0] - s.x, g.center(b)[1] - s.y) < 7);
    const l = w ? g.lagerOf(s.owner, w.island) : null;
    if (l && l.holz >= 0.1) { const h = Math.min(max - s.hp, 2 * dt); s.hp += h; l.holz = Math.max(0, l.holz - h / 10); }
  }
  if (!s.guns) { s.target = undefined; return; }
  s.cd = Math.max(0, (s.cd ?? 0) - dt);
  const ch = S.shipChase.get(s.id) ?? { ordered: false, repath: 0 };
  let t = s.target !== undefined ? resolve(g, s.target) : undefined;
  if (t && !atWar(g, s.owner, t.owner)) t = undefined;
  if (!t) {
    s.target = undefined; ch.ordered = false;
    t = acquire(g, s.owner, s.x, s.y, SHIP_GUN.range + 1, { ships: true, units: false });
    if (t) s.target = t.kind === 'ship' ? t.s.id : undefined;
  }
  S.shipChase.set(s.id, ch);
  if (!t) return;
  const [tx, ty] = targetPos(g, t, s.x, s.y);
  const dd = Math.hypot(tx - s.x, ty - s.y);
  if (dd <= SHIP_GUN.range) {
    if (ch.ordered && s.path.length && dd < SHIP_GUN.range - 1.5) s.path = [];
    if (s.cd <= 0) {
      s.cd = SHIP_GUN.interval;
      s.shotT = g.time;
      const hit = Math.random() < 0.75;
      g.ev.shot('schiff', s.x, s.y, tx, ty, hit);
      if (hit) damage(g, t, s.guns * SHIP_GUN.dmg, s.owner, s.x, s.y);
    }
  } else if (ch.ordered) {
    ch.repath -= dt;
    if (ch.repath <= 0) { ch.repath = 2.5; g.moveShip(s, tx, ty); }
  }
}

// ---------- Piraten ----------

/** nach einem Überfall davonsegeln */
function sailAway(g: Game, s: Ship) {
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2;
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
        const x = 5 + Math.floor(Math.random() * (g.size - 10)), y = 5 + Math.floor(Math.random() * (g.size - 10));
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
    if (g.seen[g.idx(Math.floor(s.x), Math.floor(s.y))] && !g.pirateSeen) { g.pirateSeen = true; g.ev.message('🏴‍☠️ Piraten gesichtet! Sie überfallen Schiffe. Schutz kannst du im Menü ☰ kaufen.', 'bad'); }
    if (s.target !== undefined) continue;
    let prey: Ship | undefined, pd = 16;
    for (const o of g.ships) {
      if (!atWar(g, pir.id, o.owner) || (o.safeUntil ?? 0) > g.time) continue;
      const d = Math.hypot(o.x - s.x, o.y - s.y);
      if (d < pd) { pd = d; prey = o; }
    }
    if (prey) { shipAttack(g, s, prey.id); continue; }
    // ab und zu eine schlecht bewachte Küste beschießen
    if (s.target === undefined && g.time > PIRATE_COAST && Math.random() < 0.08) {
      const b = acquire(g, pir.id, s.x, s.y, 30, { buildings: true, units: false });
      // nur Küsten von Spielern, die schon Wachtürme bauen können (und das seit einer Weile)
      const since = b ? S.defendT.get(b.owner) : undefined;
      if (b && b.kind === 'bau' && since !== undefined && g.time - since > 900 && !g.buildings.some((o) => o.owner === b.owner && BUILDINGS[o.type].tower && Math.hypot(o.x - b.b.x, o.y - b.b.y) < 9)) { shipAttack(g, s, b.b.id); continue; }
    }
    if (!s.path.length && s.target === undefined) {
      for (let i = 0; i < 20; i++) {
        const x = Math.floor(s.x + (Math.random() - 0.5) * 70), y = Math.floor(s.y + (Math.random() - 0.5) * 70);
        if (g.inMap(x, y) && g.isWater(g.idx(x, y)) && g.moveShip(s, x + 0.5, y + 0.5)) break;
      }
    }
  }
}

// ---------- Computergegner ----------

function tickAIMilitary(g: Game) {
  for (const p of g.players) {
    if (!p.ai || p.defeated) continue;
    const k = g.kontor(p.id);
    if (!k) continue;
    const pop = g.buildings.reduce((n, b) => n + (b.owner === p.id && b.type === 'haus' ? b.residents : 0), 0);
    const mine = g.units.filter((u) => u.owner === p.id);
    const war = atWar(g, p.id, HUMAN);
    const S = st(g);
    // Wache halten: Soldaten anwerben (Waffen beim Händler gekauft) – höchstens einer pro Minute
    const want = Math.min(16, (war ? 4 : 2) + Math.floor(pop / 120));
    if (mine.length < want && pop > 60 && g.time >= (S.recruitT.get(p.id) ?? 0)) {
      S.recruitT.set(p.id, g.time + (war ? 40 : 75));
      const type: UnitType = Math.random() < 0.6 ? 'infanterie' : pop > 300 && Math.random() < 0.5 ? 'kanonier' : 'reiter';
      const price = type === 'kanonier' ? 900 : 500;
      const [cx, cy] = g.center(k);
      const spot = freeSpot(g, cx, cy, 3);
      if (spot) { p.money -= Math.min(price, Math.max(0, p.money)); spawnUnit(g, type, p.id, spot[0], spot[1]); }
    }
    // Kriegsschiff, wenn Krieg herrscht (höchstens alle 8 Minuten ein neues)
    if (war && g.time >= (S.shipT.get(p.id) ?? 0) && !g.ships.some((s) => s.owner === p.id && (s.guns ?? 0) > 0)) {
      S.shipT.set(p.id, g.time + 480);
      const [cx, cy] = g.center(k);
      for (let r = 2; r < 8; r++) {
        const x = Math.floor(cx + (Math.random() - 0.5) * r * 2), y = Math.floor(cy + (Math.random() - 0.5) * r * 2);
        if (g.inMap(x, y) && g.isWater(g.idx(x, y))) {
          p.money -= Math.min(3000, Math.max(0, p.money));
          g.ships.push({ id: g.nextId++, type: 'krieg_klein', owner: p.id, name: `${p.name.split(' ')[0]}s Fregatte`, x: x + 0.5, y: y + 0.5, dir: 0, path: [], slots: [{ g: null, n: 0 }, { g: null, n: 0 }, { g: null, n: 0 }], hp: SHIPS.krieg_klein.hp, guns: 8, troops: [] });
          break;
        }
      }
    }
    // Krieg erklären: erst nach einer Weile, wenn deutlich stärker
    // erst, wenn sich der Spieler wehren kann (Burg/Türme ab 200 Siedlern) oder sehr spät
    const canDefend = S.defendT.get(HUMAN);
    if (!war && g.time > 2400 && ((canDefend !== undefined && g.time - canDefend > 900) || g.time > 5400)
      && g.time - (p.peaceAt?.[HUMAN] ?? -9999) > 900 && strength(g, p.id) > strength(g, HUMAN) * 1.2 + 3
      // nicht alle gleichzeitig: läuft schon ein Krieg, ist ein weiterer viel seltener
      && (S.warnT.has(p.id) || Math.random() < (g.players.some((o) => o.ai && o !== p && atWar(g, o.id, HUMAN)) ? 0.004 : 0.04))) {
      // erst eine Vorwarnung, drei Minuten später der Krieg
      const w = S.warnT.get(p.id);
      if (w === undefined) { S.warnT.set(p.id, g.time + 180); g.ev.message(`⚠️ ${p.name} rüstet zum Krieg gegen dich! Burg, Soldaten und Wachtürme schützen dich.`, 'bad'); }
      else if (g.time >= w) { S.warnT.delete(p.id); declareWar(g, p.id, HUMAN); }
    }
    // Soldaten, die noch an Bord sitzen (z. B. nach dem Laden eines Spielstands): heimfahren und absetzen
    if (!S.raids.has(p.id)) for (const s of g.ships) {
      if (s.owner !== p.id || !s.troops?.length || s.path.length) continue;
      if (unloadTroops(g, s) > 0 || g.shipDock(s)) continue;
      const [cx, cy] = g.center(k);
      g.moveShip(s, cx, cy);
    }
    if (!war) continue;
    // Kriegsschiff jagt Schiffe des Spielers in der Nähe der eigenen Insel
    for (const s of g.ships) {
      if (s.owner !== p.id || !s.guns || s.target !== undefined) continue;
      const prey = acquire(g, p.id, s.x, s.y, 40, { ships: true, units: false });
      if (prey) shipAttack(g, s, prey.kind === 'ship' ? prey.s.id : 0);
    }
    // Angriff: Truppen per Schiff zur nächsten Insel des Spielers bringen
    raid(g, p.id, mine);
  }
}

/** einfacher Überfall der KI: sammeln → einsteigen → hinfahren → absetzen → angreifen */
function raid(g: Game, owner: number, mine: Unit[]) {
  const raids = st(g).raids;
  let r = raids.get(owner);
  const islandAt = (x: number, y: number) => g.islandOf[g.idx(Math.floor(x), Math.floor(y))];
  const idle = mine.filter((u) => u.ship === undefined && u.target === undefined && !u.path.length && u.board === undefined);
  if (!r) {
    if (idle.length < 4 || Math.random() > 0.15) return;
    const ship = g.ships.find((s) => s.owner === owner && !s.path.length);
    if (!ship) return;
    const goal = g.buildings.filter((b) => b.owner === HUMAN && (b.type === 'kontor' || b.type === 'markt'))
      .sort((a, b) => Math.hypot(a.x - ship.x, a.y - ship.y) - Math.hypot(b.x - ship.x, b.y - ship.y))[0];
    if (!goal) return;
    r = { phase: 'sammeln', ship: ship.id, t: 0, dest: g.center(goal) };
    raids.set(owner, r);
    orderBoard(g, idle.slice(0, SHIPS[ship.type ?? 'handel_klein'].troops), ship);
    return;
  }
  const ship = g.ships.find((s) => s.id === r!.ship);
  r.t += 5;
  if (!ship || r.t > 400) { raids.delete(owner); return; }
  if (r.phase === 'sammeln') {
    const boarding = g.units.some((u) => u.owner === owner && u.board === ship.id);
    if (!boarding || r.t > 90) {
      if (!ship.troops?.length) { raids.delete(owner); return; }
      if (g.moveShip(ship, r.dest![0], r.dest![1])) r.phase = 'fahren'; else raids.delete(owner);
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

// ---------- Hauptschleife ----------

export function tickCombat(g: Game, dt: number) {
  ensurePirates(g);
  const S = st(g);
  for (const b of g.buildings) {
    const d = BUILDINGS[b.type];
    if (d.trains) tickTraining(g, b, dt);
    if (d.tower) tickTower(g, b, dt);
    // Gebäude bessern sich langsam aus, wenn eine Weile Ruhe ist
    if (b.hp !== undefined && g.time - (S.lastHit.get(b.id) ?? -99) > 15) {
      b.hp = Math.min(g.maxHp(b), b.hp + 0.4 * dt);
      if (b.hp >= g.maxHp(b)) b.hp = undefined;
    }
  }
  for (const u of [...g.units]) if (g.units.includes(u)) tickUnit(g, u, dt);
  for (const s of [...g.ships]) if (g.ships.includes(s)) tickShipCombat(g, s, dt);
  // Soldaten heilen langsam auf eigenem Gebiet, wenn kein Feind nah ist
  for (const u of g.units) {
    if (u.ship !== undefined || u.target !== undefined || u.hp >= UNITS[u.type].hp) continue;
    if (g.own[g.idx(Math.floor(u.x), Math.floor(u.y))] === u.owner) u.hp = Math.min(UNITS[u.type].hp, u.hp + 0.15 * dt);
  }
  S.sepT += dt;
  if (S.sepT > 0.2) { S.sepT = 0; separate(g); }
  tickPirates(g, dt);
  S.aiT += dt;
  if (S.aiT > 5) {
    S.aiT = 0;
    for (const p of g.players) if (!p.pirate && !S.defendT.has(p.id) && g.reached({ tier: 1, n: 200 }, p.id)) S.defendT.set(p.id, g.time);
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
  g.ev.message('⛵ Ein neues Schiff mit Baumaterial ist angekommen – gründe ein neues Kontor!', 'good');
}

/** Unterhalt der Soldaten je Minute */
export function unitUpkeep(g: Game, owner: number): number {
  let n = 0;
  for (const u of g.units) if (u.owner === owner) n += UNITS[u.type].upkeep;
  return n;
}
