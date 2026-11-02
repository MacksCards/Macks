// Merkzettel der Bedienung (Paket U4) – reine Spiellogik ohne Oberfläche, damit sie sich prüfen lässt:
//   - welche freigeschalteten Gebäudearten der Spieler schon einmal gebaut hat (Punkt „NEU“ im Baumenü),
//   - die Soldatengruppen 1–3 und die gewählte Aufstellung (Reihe/Block),
//   - der Plan eines Häuserfelds (Häuser in 4 × 2-Blöcken mit Wegstreifen dazwischen).
// Gespeichert im Spielstand unter ext.bedienung; ältere Stände laden mit leeren Werten.
import type { BuildingId } from './data';
import { HUMAN, type Building, type Game, type Unit } from './game';
import type { Aufstellung } from './combat';
import type { GameSystem } from './systems';

/** so viele Soldatengruppen gibt es (Knöpfe 1–3) */
export const GROUPS = 3;

interface State {
  /** einmal gebaute Gebäudearten (eigene) */
  built: Set<BuildingId>;
  /** Soldatengruppen: Kennungen der Soldaten */
  groups: number[][];
  /** Aufstellung beim nächsten Laufbefehl */
  form: Aufstellung;
}

const states = new WeakMap<Game, State>();
function st(g: Game): State {
  let s = states.get(g);
  if (!s) { s = { built: new Set(), groups: Array.from({ length: GROUPS }, () => []), form: 'block' }; states.set(g, s); }
  return s;
}

/** Gebäudeart als „schon gebaut“ merken (Wege melden sich selbst, sie laufen nicht über afterPlace) */
export function markBuilt(g: Game, type: BuildingId) { st(g).built.add(type); }

/** Hat der Spieler diese Art schon einmal gebaut? (auch: steht eine davon) */
export function everBuilt(g: Game, type: BuildingId): boolean {
  const s = st(g);
  if (s.built.has(type)) return true;
  const has = type === 'steinweg' ? g.roads.includes(2) && g.roads.some((r, k) => r === 2 && g.own[k] === HUMAN)
    : g.buildings.some((b) => b.owner === HUMAN && b.type === type);
  if (has) s.built.add(type);
  return has;
}

/** Soldaten einer Gruppe (nur noch lebende eigene an Land) */
export function groupUnits(g: Game, i: number): Unit[] {
  const ids = new Set(st(g).groups[i] ?? []);
  if (!ids.size) return [];
  return g.units.filter((u) => ids.has(u.id) && u.owner === HUMAN && u.ship === undefined);
}

/** Zahl der Soldaten einer Gruppe, die noch leben (auch an Bord) */
export function groupSize(g: Game, i: number): number {
  const ids = st(g).groups[i] ?? [];
  if (!ids.length) return 0;
  const alive = new Set(g.units.filter((u) => u.owner === HUMAN).map((u) => u.id));
  return ids.filter((id) => alive.has(id)).length;
}

export function saveGroup(g: Game, i: number, units: readonly Unit[]) {
  if (i < 0 || i >= GROUPS) return;
  st(g).groups[i] = units.filter((u) => u.owner === HUMAN).map((u) => u.id);
}

export function formation(g: Game): Aufstellung { return st(g).form; }
export function setFormation(g: Game, f: Aufstellung) { st(g).form = f; }

/** Plan eines Häuserfelds: Häuser (linke obere Ecke je Haus) und Wegfelder */
export interface FieldPlan { houses: [number, number][]; roads: [number, number][] }

/** größte Seitenlänge eines Häuserfelds bzw. Abrissbereichs (Felder) */
export const MAX_SPAN = 26;

/**
 * Häuserfeld zwischen Ecke a und Ecke b (beide eingeschlossen): Blöcke aus 4 × 2 Häusern (je 2 × 2 Felder),
 * dazwischen ein Feld breite Wegstreifen. Das Raster beginnt an Ecke a (dort, wo man zuerst getippt hat);
 * ist das Feld höher als breit, liegen die Blöcke hochkant. Häuser, die nicht ganz hineinpassen, fallen weg.
 */
export function fieldPlan(a: readonly [number, number], b: readonly [number, number], size = 2): FieldPlan {
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]);
  const y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
  const W = x1 - x0 + 1, H = y1 - y0 + 1;
  const wide = W >= H;
  // Blockmaße in Feldern längs (4 Häuser) und quer (2 Häuser), plus Wegstreifen
  const along = 4 * size, across = 2 * size;
  const pa = along + 1, pc = across + 1;
  // Abstand von Ecke a aus gezählt (das Raster hängt an der ersten Ecke)
  const dx = (x: number) => (a[0] <= b[0] ? x - x0 : x1 - x);
  const dy = (y: number) => (a[1] <= b[1] ? y - y0 : y1 - y);
  const houses: [number, number][] = [], roads: [number, number][] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const u = wide ? dx(x) : dy(y), v = wide ? dy(y) : dx(x);
    const ru = u % pa === along, rv = v % pc === across;
    if (ru || rv) { roads.push([x, y]); continue; }
    // Hausecke: im Block an geraden Stellen (von Ecke a aus gesehen)
    if ((u % pa) % size !== 0 || (v % pc) % size !== 0) continue;
    // Haus liegt von Ecke a aus gesehen „vorn“; zurück in Kartenrichtung umrechnen
    const hx = a[0] <= b[0] ? x : x - size + 1, hy = a[1] <= b[1] ? y : y - size + 1;
    if (hx < x0 || hy < y0 || hx + size - 1 > x1 || hy + size - 1 > y1) continue;
    houses.push([hx, hy]);
  }
  return { houses, roads };
}

/** Ecke b so begrenzen, dass das Feld höchstens MAX_SPAN Felder je Seite misst */
export function clampSpan(a: readonly [number, number], b: readonly [number, number]): [number, number] {
  const c = (p: number, q: number) => Math.max(p - MAX_SPAN + 1, Math.min(p + MAX_SPAN - 1, q));
  return [c(a[0], b[0]), c(a[1], b[1])];
}

export const system: GameSystem = {
  id: 'bedienung',
  afterPlace(g: Game, b: Building) { if (b.owner === HUMAN) st(g).built.add(b.type); },
  save(g: Game) {
    const s = st(g);
    return { built: [...s.built], groups: s.groups, form: s.form };
  },
  load(g: Game, data: unknown) {
    const s = st(g);
    s.built.clear();
    s.groups = Array.from({ length: GROUPS }, () => []);
    s.form = 'block';
    const d = data as { built?: unknown; groups?: unknown; form?: unknown } | undefined;
    if (!d || typeof d !== 'object') return;
    if (Array.isArray(d.built)) for (const t of d.built) if (typeof t === 'string') s.built.add(t as BuildingId);
    if (Array.isArray(d.groups)) d.groups.slice(0, GROUPS).forEach((ids, i) => { if (Array.isArray(ids)) s.groups[i] = ids.filter((n): n is number => typeof n === 'number'); });
    if (d.form === 'reihe' || d.form === 'block') s.form = d.form;
  },
};
