// Spiellogik: Inselwelt, Spieler, Schiffe, Bauen, Wirtschaft, Speichern.
// Wie im Vorbild hat jede Insel ihr eigenes Lager (je Spieler); Geld ist global.
import {
  BUILDINGS, BuildingDef, BuildingId, Cost, GOOD, GOODS, GoodId, PRICES, SLOT_CAP, START_CARGO, START_MONEY, TIERS,
} from './data';
import { findSeaPath } from './path';
import { thinkAI } from './ai';
import { Island, T, WORLD_SIZE, generateWorld, rng } from './world';

export type Status = 'ok' | 'keinWeg' | 'rohstoff' | 'lagerVoll' | 'keinWald' | 'keinWasser' | 'wohnen';

export interface Building {
  id: number;
  type: BuildingId;
  x: number;
  y: number;
  owner: number;
  island: number;
  progress: number;
  loaded: boolean;
  eff: number;
  status: Status;
  missing: GoodId[];
  active: number;
  tier: number;
  residents: number;
  need: Partial<Record<GoodId, number>>;
  demand: Partial<Record<GoodId, number>>;
  short: Partial<Record<GoodId, boolean>>;
  happy: number;
  growT: number;
  upT: number;
  /** eigenes kleines Lager des Betriebs (wartet auf den Marktkarren) */
  stock: number;
}

/** Marktkarren: holt Waren von Betrieben ab und bringt sie ins Inselllager */
export interface Cart {
  id: number;
  home: number; // Kontor/Marktplatz
  x: number;
  y: number;
  path: [number, number][];
  state: 'idle' | 'hin' | 'zurueck';
  target: number;
  g: GoodId | null;
  n: number;
}

export interface Slot { g: GoodId | null; n: number }

export interface Ship {
  id: number;
  owner: number;
  name: string;
  x: number;
  y: number;
  dir: number;
  path: [number, number][];
  slots: Slot[];
}

/** Gedächtnis eines Computergegners */
export interface AIState { phase: 'suchen' | 'fahren' | 'gruenden' | 'aufbau'; island: number; t: number; tries: number; grid: boolean }

export interface Player { id: number; name: string; color: number; ai: boolean; money: number; brain?: AIState }

type Goods = Record<GoodId, number>;

export interface SaveData {
  v: 3;
  seed: number;
  tiles: string;
  roads: string;
  seen: string;
  buildings: Building[];
  ships: Ship[];
  players: Player[];
  lager: Record<string, Goods>;
  nextId: number;
  time: number;
  quest: number;
  unlocked?: BuildingId[];
}

export interface GameEvents {
  added(b: Building): void;
  removed(b: Building): void;
  changed(b: Building): void;
  roads(): void;
  trees(): void;
  seen(): void;
  message(text: string, kind?: 'info' | 'good' | 'bad'): void;
}

export interface Check { ok: boolean; reason?: string }

const LAGER: BuildingId[] = ['kontor', 'markt'];
const SAVE_KEY = 'neue-ufer-save-v3';
export const HUMAN = 0;
const SHIP_SPEED = 3.2; // Kacheln pro Spielsekunde
const SHIP_SIGHT = 9;
const CART_SPEED = 1.8; // Felder pro Spielsekunde
const CART_CAP = 6; // Tonnen pro Fahrt
export const DOCK_RANGE = 5; // so nah muss ein Schiff am Kontor/Bauplatz sein

/** Computergegner (eigene Namen und Farben) */
export const OPPONENTS = [
  { name: 'Hendrik van Dalen', color: 0xc8463b },
  { name: 'Morwenna Grey', color: 0xe0b23a },
  { name: 'Baron von Kessel', color: 0x4f9a4a },
];

const enc = (a: ArrayLike<number>) => { let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i] + 48); return s; };
const zeroGoods = (): Goods => Object.fromEntries(GOODS.map((g) => [g.id, 0])) as Goods;
const EMPTY: Goods = Object.freeze(zeroGoods()) as Goods;

export class Game {
  seed = 1;
  size = WORLD_SIZE;
  tiles: Uint8Array = new Uint8Array(0);
  islandOf: Int16Array = new Int16Array(0);
  islands: Island[] = [];
  starts: [number, number][] = [];
  roads: Uint8Array = new Uint8Array(0);
  seen: Uint8Array = new Uint8Array(0);
  occ = new Int32Array(0);
  buildings: Building[] = [];
  byId = new Map<number, Building>();
  ships: Ship[] = [];
  carts: Cart[] = [];
  players: Player[] = [];
  lager: Record<string, Goods> = {};
  nextId = 1;
  time = 0;
  quest = 0;
  /** Insel, deren Lager die Oberfläche gerade zeigt (-1 = keine) */
  focus = -1;

  // abgeleitete Werte
  own: Int8Array = new Int8Array(0); // Besitzer je Kachel (-1 = frei)
  area: Uint8Array = new Uint8Array(0); // Baugebiet des menschlichen Spielers
  roadLinked: Uint8Array = new Uint8Array(0);
  linked = new Set<number>();
  coverage = new Map<number, Set<BuildingId>>();
  cap = new Map<string, number>();
  private seenDirty = false;
  private sightT = 0;
  /** Bereits freigeschaltete Gebäude (bleiben freigeschaltet) */
  unlocked = new Set<BuildingId>();
  private unlockT = 0;
  private cartT = 0;

  ev: GameEvents = { added() {}, removed() {}, changed() {}, roads() {}, trees() {}, seen() {}, message() {} };

  // ---------- Erstellen / Laden ----------

  private setupWorld(seed: number) {
    const w = generateWorld(seed);
    this.seed = seed;
    this.size = w.size;
    this.tiles = w.tiles;
    this.islandOf = w.island;
    this.islands = w.islands;
    this.starts = w.starts;
    const N = this.size * this.size;
    this.roads = new Uint8Array(N);
    this.seen = new Uint8Array(N);
    this.occ = new Int32Array(N);
  }

  static create(seed: number, opponents = 2): Game {
    const g = new Game();
    g.setupWorld(seed);
    g.players = [{ id: HUMAN, name: 'Du', color: 0x2f6fd0, ai: false, money: START_MONEY }];
    for (let i = 0; i < Math.min(3, opponents); i++) {
      const o = OPPONENTS[i];
      g.players.push({ id: i + 1, name: o.name, color: o.color, ai: true, money: START_MONEY, brain: { phase: 'suchen', island: -1, t: 0, tries: 0, grid: false } });
    }
    const shipNames = ['Morgenstern', 'Seeadler', 'Goldene Gans', 'Nordlicht'];
    for (const p of g.players) {
      const [sx, sy] = g.starts[p.id];
      const ship: Ship = { id: g.nextId++, owner: p.id, name: shipNames[p.id], x: sx + 0.5, y: sy + 0.5, dir: -Math.PI / 4, path: [], slots: [] };
      for (let i = 0; i < 4; i++) ship.slots.push(START_CARGO[i] ? { g: START_CARGO[i][0], n: START_CARGO[i][1] } : { g: null, n: 0 });
      g.ships.push(ship);
    }
    const [sx, sy] = g.starts[HUMAN];
    g.reveal(sx, sy, SHIP_SIGHT + 2);
    g.recompute();
    g.checkUnlocks(true);
    return g;
  }

  static fromSave(d: SaveData): Game {
    const g = new Game();
    g.setupWorld(d.seed);
    g.tiles = Uint8Array.from(d.tiles, (c) => c.charCodeAt(0) - 48);
    g.roads = Uint8Array.from(d.roads, (c) => c.charCodeAt(0) - 48);
    g.seen = Uint8Array.from(d.seen, (c) => c.charCodeAt(0) - 48);
    g.players = d.players;
    g.ships = d.ships;
    g.lager = d.lager;
    for (const k of Object.keys(g.lager)) g.lager[k] = { ...zeroGoods(), ...g.lager[k] };
    g.nextId = d.nextId;
    g.time = d.time;
    g.quest = d.quest;
    for (const b of d.buildings) {
      if (!BUILDINGS[b.type]) continue;
      b.stock ??= 0;
      g.buildings.push(b);
      g.byId.set(b.id, b);
      g.stamp(b, b.id);
    }
    g.recompute();
    for (const t of d.unlocked ?? []) if (BUILDINGS[t]) g.unlocked.add(t);
    g.checkUnlocks(true);
    return g;
  }

  serialize(): SaveData {
    return {
      v: 3, seed: this.seed, tiles: enc(this.tiles), roads: enc(this.roads), seen: enc(this.seen),
      buildings: this.buildings, ships: this.ships, players: this.players, lager: this.lager,
      nextId: this.nextId, time: this.time, quest: this.quest, unlocked: [...this.unlocked],
    };
  }

  save(): boolean {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize())); return true; } catch { return false; }
  }

  static load(): Game | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw) as SaveData;
      return d.v === 3 ? Game.fromSave(d) : null;
    } catch {
      return null;
    }
  }

  static clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* egal */ }
  }

  // ---------- Hilfen ----------

  idx(x: number, y: number) { return y * this.size + x; }
  inMap(x: number, y: number) { return x >= 0 && y >= 0 && x < this.size && y < this.size; }
  tile(x: number, y: number) { return this.inMap(x, y) ? this.tiles[this.idx(x, y)] : T.Wasser; }
  isWater = (k: number) => this.tiles[k] === T.Wasser;
  def(b: Building): BuildingDef { return BUILDINGS[b.type]; }
  center(b: { type: BuildingId; x: number; y: number }): [number, number] { const s = BUILDINGS[b.type].size; return [b.x + s / 2, b.y + s / 2]; }
  island(id: number): Island | undefined { return this.islands[id]; }

  get money() { return this.players[HUMAN].money; }
  set money(v: number) { this.players[HUMAN].money = v; }

  /** Lager eines Spielers auf einer Insel (nur vorhanden, wenn er dort ein Kontor hat) */
  lagerOf(owner: number, island: number): Goods | null { return this.lager[`${owner}:${island}`] ?? null; }
  capOf(owner: number, island: number): number { return this.cap.get(`${owner}:${island}`) ?? 0; }
  /** Lager der Insel im Fokus (für die Oberfläche) */
  get goods(): Goods { return this.lagerOf(HUMAN, this.focus) ?? EMPTY; }
  get capacity(): number { return this.capOf(HUMAN, this.focus); }

  count(type: BuildingId, onlyLinked = false) {
    let n = 0;
    for (const b of this.buildings) if (b.owner === HUMAN && b.type === type && (!onlyLinked || this.linked.has(b.id))) n++;
    return n;
  }
  population() { let n = 0; for (const b of this.buildings) if (b.owner === HUMAN && b.type === 'haus') n += b.residents; return n; }
  popByTier(): number[] {
    const r = TIERS.map(() => 0);
    for (const b of this.buildings) if (b.owner === HUMAN && b.type === 'haus') r[b.tier] += b.residents;
    return r;
  }
  housesByTier(): number[] {
    const r = TIERS.map(() => 0);
    for (const b of this.buildings) if (b.owner === HUMAN && b.type === 'haus') r[b.tier]++;
    return r;
  }
  buildingAt(x: number, y: number): Building | undefined {
    if (!this.inMap(x, y)) return undefined;
    const id = this.occ[this.idx(x, y)];
    return id ? this.byId.get(id) : undefined;
  }
  kontor(owner = HUMAN, island = -1): Building | undefined {
    return this.buildings.find((b) => b.type === 'kontor' && b.owner === owner && (island < 0 || b.island === island));
  }
  myShips() { return this.ships.filter((s) => s.owner === HUMAN); }

  private stamp(b: Building, val: number) {
    const s = BUILDINGS[b.type].size;
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) this.occ[this.idx(b.x + i, b.y + j)] = val;
  }

  private newBuilding(type: BuildingId, x: number, y: number, owner: number): Building {
    return {
      id: this.nextId++, type, x, y, owner, island: this.islandOf[this.idx(x, y)],
      progress: 0, loaded: false, eff: 1, status: 'ok', missing: [], active: 0,
      tier: 0, residents: type === 'haus' ? 1 : 0, need: { nahrung: 1 }, demand: {}, short: {}, happy: 0.7, growT: 0, upT: 0, stock: 0,
    };
  }

  // ---------- Freischaltungen (wie im Vorbild nach Einwohnerzahl) ----------

  /** Größte Einwohnerzahl mindestens der Stufe tier auf einer einzelnen Insel */
  maxPop(tier: number, owner = HUMAN): number {
    const per = new Map<number, number>();
    for (const b of this.buildings) if (b.owner === owner && b.type === 'haus' && b.tier >= tier) per.set(b.island, (per.get(b.island) ?? 0) + b.residents);
    return Math.max(0, ...per.values());
  }

  isUnlocked(type: BuildingId): boolean {
    if (this.unlocked.has(type)) return true;
    const u = BUILDINGS[type].unlock;
    return !u || this.maxPop(u.tier) >= u.n;
  }

  checkUnlocks(silent = false) {
    const fresh: BuildingId[] = [];
    for (const d of Object.values(BUILDINGS)) {
      if (!d.category || this.unlocked.has(d.id)) continue;
      const u = d.unlock;
      if (!u || this.maxPop(u.tier) >= u.n) { this.unlocked.add(d.id); if (u) fresh.push(d.id); }
    }
    if (!silent && fresh.length) this.ev.message(`Neu freigeschaltet: ${fresh.map((t) => `${BUILDINGS[t].icon} ${BUILDINGS[t].name}`).join(', ')}`, 'good');
  }

  /** Nächste Freischaltung in einer Kategorie (für Hinweise) */
  nextUnlock(cat: string): { type: BuildingId; tier: number; n: number } | null {
    let best: { type: BuildingId; tier: number; n: number } | null = null;
    for (const d of Object.values(BUILDINGS)) {
      if (d.category !== cat || this.unlocked.has(d.id) || !d.unlock) continue;
      if (!best || d.unlock.tier < best.tier || (d.unlock.tier === best.tier && d.unlock.n < best.n)) best = { type: d.id, ...d.unlock };
    }
    return best;
  }

  // ---------- Erkundung ----------

  reveal(cx: number, cy: number, r: number) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (!this.inMap(x, y)) continue;
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r) continue;
      const k = this.idx(x, y);
      if (!this.seen[k]) { this.seen[k] = 1; this.seenDirty = true; }
    }
  }

  /** Ist eine Insel (teilweise) entdeckt? */
  islandSeen(id: number): boolean {
    const i = this.islands[id];
    for (let y = i.y0; y <= i.y1; y++) for (let x = i.x0; x <= i.x1; x++) if (this.seen[this.idx(x, y)] && this.islandOf[this.idx(x, y)] === id) return true;
    return false;
  }

  // ---------- abgeleitete Werte ----------

  recompute() {
    const N = this.size;
    // Besitz: Kontore/Marktplätze beanspruchen Land ihrer Insel (wer zuerst baut, dem gehört es)
    this.own = new Int8Array(N * N).fill(-1);
    this.cap.clear();
    const claimers = this.buildings.filter((b) => LAGER.includes(b.type)).sort((a, b) => a.id - b.id);
    for (const b of claimers) {
      const d = this.def(b);
      const key = `${b.owner}:${b.island}`;
      this.cap.set(key, (this.cap.get(key) ?? 0) + (d.storage ?? 0));
      const [cx, cy] = this.center(b);
      const r = d.radius ?? 0;
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (!this.inMap(x, y)) continue;
        const k = this.idx(x, y);
        if (this.islandOf[k] !== b.island || this.own[k] >= 0) continue;
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.own[k] = b.owner;
      }
    }
    this.area = new Uint8Array(N * N);
    for (let k = 0; k < N * N; k++) if (this.own[k] === HUMAN) this.area[k] = 1;
    // Wegnetz ab Kontor/Markt
    this.roadLinked = new Uint8Array(N * N);
    const stack: number[] = [];
    for (const b of claimers) {
      for (const [x, y] of this.ring(b)) {
        if (!this.inMap(x, y)) continue;
        const k = this.idx(x, y);
        if (this.roads[k] && !this.roadLinked[k]) { this.roadLinked[k] = 1; stack.push(k); }
      }
    }
    while (stack.length) {
      const k = stack.pop()!;
      const x = k % N, y = (k / N) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.inMap(nx, ny)) continue;
        const nk = this.idx(nx, ny);
        if (this.roads[nk] && !this.roadLinked[nk]) { this.roadLinked[nk] = 1; stack.push(nk); }
      }
    }
    this.linked.clear();
    for (const b of this.buildings) {
      if (LAGER.includes(b.type)) { this.linked.add(b.id); continue; }
      for (const [x, y] of this.ring(b)) {
        if (!this.inMap(x, y)) continue;
        const k = this.idx(x, y);
        const other = this.occ[k] ? this.byId.get(this.occ[k]) : undefined;
        if (this.roadLinked[k] || (other && LAGER.includes(other.type) && other.owner === b.owner)) { this.linked.add(b.id); break; }
      }
    }
    // Versorgung der Wohnhäuser
    this.coverage.clear();
    const services = this.buildings.filter((b) => b.type === 'markt' || b.type === 'kapelle' || b.type === 'wirtshaus');
    for (const h of this.buildings) {
      if (h.type !== 'haus') continue;
      const set = new Set<BuildingId>();
      const [hx, hy] = this.center(h);
      for (const s of services) {
        if (s.owner !== h.owner) continue;
        const [sx, sy] = this.center(s);
        const r = this.def(s).radius ?? 0;
        if ((hx - sx) ** 2 + (hy - sy) ** 2 <= r * r) set.add(s.type);
      }
      this.coverage.set(h.id, set);
    }
    for (const b of this.buildings) b.eff = this.siteEfficiency(b.type, b.x, b.y);
    // Marktkarren: Kontor 2, Marktplatz 1
    this.carts = this.carts.filter((c) => this.byId.has(c.home));
    for (const b of claimers) {
      const want = b.type === 'kontor' ? 2 : 1;
      const have = this.carts.filter((c) => c.home === b.id).length;
      const [cx, cy] = this.center(b);
      for (let i = have; i < want; i++) this.carts.push({ id: this.nextId++, home: b.id, x: cx, y: cy, path: [], state: 'idle', target: 0, g: null, n: 0 });
    }
  }

  /** Weg über Straßen von Gebäude a zu Gebäude b (Feldmitten), null = keine Verbindung */
  roadPath(a: Building, b: Building): [number, number][] | null {
    const N = this.size;
    const goal = new Set<number>();
    for (const [x, y] of this.ring(b)) if (this.inMap(x, y)) goal.add(this.idx(x, y));
    const startRing = this.ring(a).filter(([x, y]) => this.inMap(x, y)).map(([x, y]) => this.idx(x, y));
    // direkt benachbart?
    for (const k of startRing) if (this.occ[k] === b.id) return [];
    const from = new Map<number, number>();
    const q: number[] = [];
    for (const k of startRing) if (this.roads[k] && !from.has(k)) { from.set(k, -1); q.push(k); }
    for (let h = 0; h < q.length; h++) {
      const k = q[h];
      if (goal.has(k)) {
        const path: [number, number][] = [];
        for (let c = k; c >= 0; c = from.get(c)!) path.push([c % N + 0.5, ((c / N) | 0) + 0.5]);
        return path.reverse();
      }
      const x = k % N, y = (k / N) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.inMap(nx, ny)) continue;
        const nk = this.idx(nx, ny);
        if (this.roads[nk] && !from.has(nk)) { from.set(nk, k); q.push(nk); }
      }
    }
    return null;
  }

  private assignCart(c: Cart, home: Building) {
    const [hx, hy] = this.center(home);
    const reach = this.def(home).work ?? 9;
    const taken = new Set(this.carts.filter((o) => o.state === 'hin').map((o) => o.target));
    const cands = this.buildings
      .filter((b) => b.owner === home.owner && b.island === home.island && this.def(b).prod && b.stock >= 1 && !taken.has(b.id))
      .filter((b) => { const [bx, by] = this.center(b); return Math.hypot(bx - hx, by - hy) <= reach + 1; })
      .sort((p, q) => q.stock - p.stock);
    for (const b of cands) {
      const path = this.roadPath(home, b);
      if (!path) continue;
      const [bx, by] = this.center(b);
      c.path = [...path, [bx, by]];
      c.state = 'hin';
      c.target = b.id;
      return;
    }
  }

  private tickCarts(dt: number) {
    const think = this.cartT >= 1;
    for (const c of this.carts) {
      const home = this.byId.get(c.home)!;
      if (c.state === 'idle') { if (think) this.assignCart(c, home); continue; }
      let step = CART_SPEED * dt;
      while (step > 0 && c.path.length) {
        const [tx, ty] = c.path[0];
        const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
        if (d < 1e-3) { c.path.shift(); continue; }
        const m = Math.min(step, d);
        c.x += (dx / d) * m; c.y += (dy / d) * m; step -= m;
        if (m >= d) c.path.shift();
      }
      if (c.path.length) continue;
      if (c.state === 'hin') {
        const b = this.byId.get(c.target);
        if (b && this.def(b).prod) {
          const take = Math.min(Math.floor(b.stock), CART_CAP);
          b.stock -= take; c.g = this.def(b).prod!.output; c.n = take;
        }
        const back = b ? this.roadPath(home, b) : null;
        c.path = [...(back ?? []).reverse(), this.center(home)];
        c.state = 'zurueck';
      } else {
        const l = this.lagerOf(home.owner, home.island);
        if (l && c.g) l[c.g] = Math.min(Math.max(this.capOf(home.owner, home.island), l[c.g]), l[c.g] + c.n);
        c.g = null; c.n = 0; c.state = 'idle';
      }
    }
    if (think) this.cartT = 0;
  }

  ring(b: { type: BuildingId; x: number; y: number }): [number, number][] {
    const s = BUILDINGS[b.type].size;
    const out: [number, number][] = [];
    for (let k = 0; k < s; k++) out.push([b.x + k, b.y - 1], [b.x + k, b.y + s], [b.x - 1, b.y + k], [b.x + s, b.y + k]);
    return out;
  }

  siteEfficiency(type: BuildingId, x: number, y: number): number {
    const d = BUILDINGS[type];
    if (!d.needs) return 1;
    if (d.needs === 'berg') {
      for (const [rx, ry] of this.ring({ type, x, y })) if (this.tile(rx, ry) === T.Berg) return 1;
      return 0;
    }
    const want = d.needs === 'wald' ? T.Wald : T.Wasser;
    const R = d.work ?? 4;
    // so viel Wald/Wasser im Arbeitsradius braucht ein Betrieb für volle Leistung
    const full = Math.round(Math.PI * R * R * (d.needs === 'wald' ? (type === 'jagdhuette' ? 0.18 : 0.28) : 0.2));
    const cx = x + d.size / 2, cy = y + d.size / 2;
    let n = 0;
    for (let j = -R - 1; j <= R + 1; j++) for (let i = -R - 1; i <= R + 1; i++) {
      const tx = Math.floor(cx + i), ty = Math.floor(cy + j);
      if ((tx + 0.5 - cx) ** 2 + (ty + 0.5 - cy) ** 2 > R * R) continue;
      if (tx >= x && tx < x + d.size && ty >= y && ty < y + d.size) continue;
      if (this.tile(tx, ty) === want) n++;
    }
    return Math.min(1, n / full);
  }

  // ---------- Schiffe ----------

  shipCargo(s: Ship, g: GoodId): number { return s.slots.reduce((n, sl) => n + (sl.g === g ? sl.n : 0), 0); }

  /** Ware ins Schiff laden; gibt geladene Menge zurück */
  shipAdd(s: Ship, g: GoodId, n: number): number {
    let left = n;
    for (const sl of s.slots) if (sl.g === g && left > 0) { const t = Math.min(left, SLOT_CAP - sl.n); sl.n += t; left -= t; }
    for (const sl of s.slots) if (!sl.g && left > 0) { const t = Math.min(left, SLOT_CAP); sl.g = g; sl.n = t; left -= t; }
    return n - left;
  }

  shipTake(s: Ship, g: GoodId, n: number): number {
    let left = n;
    for (const sl of s.slots) if (sl.g === g && left > 0) { const t = Math.min(left, sl.n); sl.n -= t; left -= t; if (!sl.n) sl.g = null; }
    return n - left;
  }

  /** Kontor des Schiffsbesitzers in Reichweite des Schiffs */
  shipDock(s: Ship): Building | undefined {
    return this.buildings.find((b) => b.type === 'kontor' && b.owner === s.owner && Math.hypot(this.center(b)[0] - s.x, this.center(b)[1] - s.y) <= DOCK_RANGE + 1.5);
  }

  /** Alles aus dem Schiff ins Kontor laden (soweit Platz ist); gibt Tonnen zurück */
  unloadAll(s: Ship): number {
    const k = this.shipDock(s);
    if (!k) return 0;
    const l = this.lagerOf(s.owner, k.island)!;
    const cap = this.capOf(s.owner, k.island);
    let moved = 0;
    for (const sl of s.slots) {
      if (!sl.g) continue;
      const t = Math.max(0, Math.min(sl.n, cap - l[sl.g]));
      l[sl.g] += t; sl.n -= t; moved += t;
      if (!sl.n) sl.g = null;
    }
    return moved;
  }

  /** Ware vom Kontor aufs Schiff laden */
  loadGood(s: Ship, g: GoodId, n: number): number {
    const k = this.shipDock(s);
    if (!k) return 0;
    const l = this.lagerOf(s.owner, k.island)!;
    const t = this.shipAdd(s, g, Math.min(n, Math.floor(l[g])));
    l[g] -= t;
    return t;
  }

  /** Insel, an deren Küste das Schiff gerade liegt (-1 = keine) */
  shipNearIsland(s: Ship): number {
    let best = -1, bd = DOCK_RANGE + 1;
    const r = Math.ceil(DOCK_RANGE);
    for (let y = Math.floor(s.y) - r; y <= Math.floor(s.y) + r; y++) for (let x = Math.floor(s.x) - r; x <= Math.floor(s.x) + r; x++) {
      if (!this.inMap(x, y)) continue;
      const id = this.islandOf[this.idx(x, y)];
      if (id < 0) continue;
      const d = Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }

  moveShip(s: Ship, tx: number, ty: number): boolean {
    let gx = Math.floor(tx), gy = Math.floor(ty);
    const clamp = (v: number) => Math.min(this.size - 1, Math.max(0, v));
    gx = clamp(gx); gy = clamp(gy);
    // Ziel an Land → nächstes Wasserfeld suchen
    if (!this.isWater(this.idx(gx, gy))) {
      let best: [number, number] | null = null, bd = 1e9;
      for (let r = 1; r < 10 && !best; r++) for (let y = gy - r; y <= gy + r; y++) for (let x = gx - r; x <= gx + r; x++) {
        if (!this.inMap(x, y) || !this.isWater(this.idx(x, y))) continue;
        const d = Math.hypot(x - gx, y - gy);
        if (d < bd) { bd = d; best = [x, y]; }
      }
      if (!best) return false;
      [gx, gy] = best;
    }
    const p = findSeaPath(this.size, this.isWater, Math.floor(s.x), Math.floor(s.y), gx, gy);
    if (!p) return false;
    s.path = p;
    return true;
  }

  private tickShip(s: Ship, dt: number) {
    let step = SHIP_SPEED * dt;
    while (step > 0 && s.path.length) {
      const [tx, ty] = s.path[0];
      const dx = tx - s.x, dy = ty - s.y;
      const d = Math.hypot(dx, dy);
      if (d < 1e-3) { s.path.shift(); continue; }
      const m = Math.min(step, d);
      s.x += (dx / d) * m; s.y += (dy / d) * m;
      s.dir = Math.atan2(dx, dy);
      step -= m;
      if (m >= d) s.path.shift();
    }
  }

  // ---------- Handel ----------

  /** Mit dem freien Händler am Kontor handeln: n > 0 kaufen, n < 0 verkaufen. Gibt gehandelte Tonnen zurück. */
  trade(owner: number, island: number, g: GoodId, n: number): number {
    const pr = PRICES[g];
    const l = this.lagerOf(owner, island);
    if (!pr || !l) return 0;
    const p = this.players[owner];
    if (n > 0) {
      const room = Math.max(0, this.capOf(owner, island) - l[g]);
      const t = Math.floor(Math.min(n, room, p.money / pr.kaufen));
      l[g] += t; p.money -= t * pr.kaufen;
      return t;
    }
    const t = Math.floor(Math.min(-n, l[g]));
    l[g] -= t; p.money += t * pr.verkaufen;
    return t;
  }

  // ---------- Bauen ----------

  canAfford(c: Cost, owner = HUMAN, island = this.focus): Check {
    if ((c.taler ?? 0) > this.players[owner].money) return { ok: false, reason: 'Zu wenig Taler' };
    const l = this.lagerOf(owner, island) ?? EMPTY;
    for (const k of ['holz', 'werkzeug', 'stein'] as const) if ((c[k] ?? 0) > l[k]) return { ok: false, reason: `Zu wenig ${GOOD[k].name}` };
    return { ok: true };
  }

  private pay(c: Cost, owner: number, island: number) {
    this.players[owner].money -= c.taler ?? 0;
    const l = this.lagerOf(owner, island);
    if (l) for (const k of ['holz', 'werkzeug', 'stein'] as const) l[k] -= c[k] ?? 0;
  }

  /** Schiff des Spielers, das nahe genug an einem Bauplatz liegt */
  shipNear(owner: number, cx: number, cy: number): Ship | undefined {
    return this.ships.filter((s) => s.owner === owner).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))
      .find((s) => Math.hypot(s.x - cx, s.y - cy) <= DOCK_RANGE + 2);
  }

  canPlace(type: BuildingId, x: number, y: number, owner = HUMAN): Check {
    const d = BUILDINGS[type];
    const s = d.size;
    let isl = -2;
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
      const tx = x + i, ty = y + j;
      if (!this.inMap(tx, ty)) return { ok: false, reason: 'Außerhalb der Karte' };
      const t = this.tile(tx, ty);
      const k = this.idx(tx, ty);
      if (owner === HUMAN && !this.seen[k]) return { ok: false, reason: 'Noch unentdeckt' };
      if (t === T.Wasser) return { ok: false, reason: 'Nicht auf dem Wasser' };
      if (t === T.Berg) return { ok: false, reason: 'Nicht auf dem Berg' };
      if (this.occ[k] || this.roads[k]) return { ok: false, reason: 'Platz ist belegt' };
      if (isl === -2) isl = this.islandOf[k];
      if (type === 'kontor') {
        if (this.own[k] >= 0 && this.own[k] !== owner) return { ok: false, reason: 'Das Land gehört schon jemand anderem' };
      } else if (this.own[k] !== owner) return { ok: false, reason: 'Außerhalb deines Gebiets – baue einen Marktplatz' };
    }
    if (d.category && d.unlock && (owner === HUMAN ? !this.isUnlocked(type) : this.maxPop(d.unlock.tier, owner) < d.unlock.n)) {
      const u = d.unlock;
      return { ok: false, reason: `Erst ab ${u.n} ${TIERS[u.tier].name}` };
    }
    if (type === 'kontor') {
      if (this.kontor(owner, isl)) return { ok: false, reason: 'Auf dieser Insel hast du schon ein Kontor' };
      let w = 0;
      for (const [rx, ry] of this.ring({ type, x, y })) if (this.tile(rx, ry) === T.Wasser) w++;
      if (w < 2) return { ok: false, reason: 'Das Kontor muss direkt an der Küste stehen' };
      const ship = this.shipNear(owner, x + s / 2, y + s / 2);
      if (!ship) return { ok: false, reason: 'Ein Schiff muss in der Nähe liegen' };
      if ((d.cost.taler ?? 0) > this.players[owner].money) return { ok: false, reason: 'Zu wenig Taler' };
      for (const k of ['holz', 'werkzeug'] as const) if (this.shipCargo(ship, k) < (d.cost[k] ?? 0)) return { ok: false, reason: `Zu wenig ${GOOD[k].name} an Bord` };
      return { ok: true };
    }
    if (d.needs === 'wasser') {
      let w = 0;
      for (const [rx, ry] of this.ring({ type, x, y })) if (this.tile(rx, ry) === T.Wasser) w++;
      if (w < 2) return { ok: false, reason: 'Muss direkt am Wasser stehen' };
    }
    if (d.needs === 'berg' && this.siteEfficiency(type, x, y) === 0) return { ok: false, reason: 'Muss direkt am Berg stehen' };
    return this.canAfford(d.cost, owner, isl);
  }

  place(type: BuildingId, x: number, y: number, owner = HUMAN): Check {
    const c = this.canPlace(type, x, y, owner);
    if (!c.ok) return c;
    const d = BUILDINGS[type];
    const b = this.newBuilding(type, x, y, owner);
    if (type === 'kontor') {
      const ship = this.shipNear(owner, x + d.size / 2, y + d.size / 2)!;
      this.players[owner].money -= d.cost.taler ?? 0;
      for (const k of ['holz', 'werkzeug'] as const) this.shipTake(ship, k, d.cost[k] ?? 0);
      this.lager[`${owner}:${b.island}`] ??= zeroGoods();
    } else this.pay(d.cost, owner, b.island);
    let treesChanged = false;
    for (let j = 0; j < d.size; j++) for (let i = 0; i < d.size; i++) {
      const k = this.idx(x + i, y + j);
      if (this.tiles[k] === T.Wald) { this.tiles[k] = T.Gras; treesChanged = true; }
    }
    this.buildings.push(b);
    this.byId.set(b.id, b);
    this.stamp(b, b.id);
    this.recompute();
    if (LAGER.includes(type) && owner === HUMAN) {
      const [cx, cy] = this.center(b);
      this.reveal(cx, cy, (d.radius ?? 8) + 3);
      if (this.seenDirty) { this.seenDirty = false; this.ev.seen(); }
    }
    if (treesChanged) this.ev.trees();
    this.ev.added(b);
    if (type === 'kontor' && owner === HUMAN) {
      this.focus = b.island;
      this.ev.message(`Kontor auf ${this.islands[b.island].name} gegründet! Lade jetzt die Waren aus dem Schiff.`, 'good');
    }
    return { ok: true };
  }

  canRoad(x: number, y: number, owner = HUMAN): Check {
    if (!this.inMap(x, y)) return { ok: false, reason: 'Außerhalb der Karte' };
    const k = this.idx(x, y);
    const t = this.tiles[k];
    if (t === T.Wasser || t === T.Berg) return { ok: false, reason: 'Hier geht kein Weg' };
    if (this.roads[k] || this.occ[k]) return { ok: false, reason: 'Platz ist belegt' };
    if (this.own[k] !== owner) return { ok: false, reason: 'Außerhalb deines Gebiets' };
    if (this.players[owner].money < (BUILDINGS.weg.cost.taler ?? 0)) return { ok: false, reason: 'Zu wenig Taler' };
    return { ok: true };
  }

  placeRoads(cells: [number, number][], owner = HUMAN): number {
    let n = 0, trees = false, lastReason = '';
    for (const [x, y] of cells) {
      const c = this.canRoad(x, y, owner);
      if (!c.ok) { lastReason = c.reason ?? ''; continue; }
      const k = this.idx(x, y);
      if (this.tiles[k] === T.Wald) { this.tiles[k] = T.Gras; trees = true; }
      this.roads[k] = 1;
      this.players[owner].money -= BUILDINGS.weg.cost.taler ?? 0;
      n++;
    }
    if (n) { this.recompute(); this.ev.roads(); }
    if (trees) this.ev.trees();
    if (!n && lastReason && cells.length === 1 && owner === HUMAN) this.ev.message(lastReason, 'bad');
    return n;
  }

  demolish(x: number, y: number): boolean {
    if (!this.inMap(x, y)) return false;
    const k = this.idx(x, y);
    if (this.roads[k] && this.area[k]) { this.roads[k] = 0; this.recompute(); this.ev.roads(); return true; }
    const b = this.buildingAt(x, y);
    if (!b || b.owner !== HUMAN) return false;
    if (b.type === 'kontor') { this.ev.message('Das Kontor kann nicht abgerissen werden', 'bad'); return false; }
    this.removeBuilding(b);
    return true;
  }

  removeBuilding(b: Building) {
    if (b.type === 'kontor') return;
    const d = this.def(b);
    const l = this.lagerOf(b.owner, b.island);
    const cap = this.capOf(b.owner, b.island);
    if (l) for (const k of ['holz', 'werkzeug', 'stein'] as const) l[k] = Math.min(l[k] + Math.floor((d.cost[k] ?? 0) / 2), Math.max(cap, l[k]));
    this.stamp(b, 0);
    this.buildings = this.buildings.filter((o) => o !== b);
    this.byId.delete(b.id);
    this.recompute();
    this.ev.removed(b);
  }

  // ---------- Simulation ----------

  incomePerMinute(owner = HUMAN): { tax: number; upkeep: number } {
    let tax = 0, upkeep = 0;
    for (const b of this.buildings) {
      if (b.owner !== owner) continue;
      upkeep += this.def(b).upkeep;
      if (b.type === 'haus') tax += b.residents * TIERS[b.tier].tax * (0.4 + 0.6 * b.happy);
    }
    return { tax, upkeep };
  }

  tick(dt: number) {
    this.time += dt;
    for (const s of this.ships) this.tickShip(s, dt);
    this.sightT += dt;
    if (this.sightT > 0.5) {
      this.sightT = 0;
      for (const s of this.myShips()) this.reveal(s.x, s.y, SHIP_SIGHT);
      if (this.seenDirty) { this.seenDirty = false; this.ev.seen(); }
    }
    for (const b of this.buildings) {
      if (b.type === 'haus') this.tickHouse(b, dt);
      else if (this.def(b).prod) this.tickProduction(b, dt);
    }
    this.cartT += dt;
    this.tickCarts(dt);
    for (const p of this.players) if (p.ai && p.brain) thinkAI(this, p, dt);
    for (const p of this.players) {
      const { tax, upkeep } = this.incomePerMinute(p.id);
      p.money += ((tax - upkeep) / 60) * dt;
    }
    this.unlockT += dt;
    if (this.unlockT > 1) { this.unlockT = 0; this.checkUnlocks(); }
    this.checkQuest();
  }

  private tickProduction(b: Building, dt: number) {
    const p = this.def(b).prod!;
    const l = this.lagerOf(b.owner, b.island);
    let working = false;
    b.missing = [];
    if (!l || !this.linked.has(b.id)) b.status = 'keinWeg';
    else if (b.eff <= 0) b.status = this.def(b).needs === 'wasser' ? 'keinWasser' : 'keinWald';
    else if (b.stock >= (this.def(b).stock ?? 4)) b.status = 'lagerVoll';
    else {
      if (!b.loaded) {
        const inp = p.input ?? {};
        for (const [g, n] of Object.entries(inp) as [GoodId, number][]) if (l[g] < n) b.missing.push(g);
        if (!b.missing.length) {
          for (const [g, n] of Object.entries(inp) as [GoodId, number][]) l[g] -= n;
          b.loaded = true;
        }
      }
      if (b.loaded) {
        working = true;
        b.status = 'ok';
        b.progress += dt * b.eff;
        if (b.progress >= p.time) {
          b.progress = 0;
          b.loaded = false;
          b.stock = Math.min(this.def(b).stock ?? 4, b.stock + (p.amount ?? 1));
        }
      } else b.status = 'rohstoff';
    }
    b.active += ((working ? 1 : 0) - b.active) * Math.min(1, dt * 0.1);
  }

  private tickHouse(h: Building, dt: number) {
    const tier = TIERS[h.tier];
    const l = this.lagerOf(h.owner, h.island);
    h.status = 'wohnen';
    let goodsSum = 0, goodsN = 0;
    for (const [g, rate] of Object.entries(tier.consumes) as [GoodId, number][]) {
      h.demand[g] = Math.min(2, (h.demand[g] ?? 0) + (h.residents * rate * dt) / 60);
      while ((h.demand[g] ?? 0) >= 1) {
        if (l && l[g] >= 1) { l[g] -= 1; h.demand[g]! -= 1; h.short[g] = false; }
        else { h.short[g] = true; break; }
      }
      const target = h.short[g] ? 0 : 1;
      const cur = h.need[g] ?? 1;
      h.need[g] = cur + (target - cur) * Math.min(1, dt / 25);
      goodsSum += h.need[g]!;
      goodsN++;
    }
    const cov = this.coverage.get(h.id) ?? new Set();
    const svcFrac = tier.services.filter((s) => cov.has(s)).length / tier.services.length;
    const goodsAvg = goodsN ? goodsSum / goodsN : 1;
    const target = goodsAvg * 0.7 + svcFrac * 0.3;
    h.happy += (target - h.happy) * Math.min(1, dt / 8);

    if (h.happy > 0.85 && h.residents < tier.maxResidents) {
      h.growT += dt;
      if (h.growT >= 6) { h.residents++; h.growT = 0; }
    } else if (h.happy < 0.45 && h.residents > 1) {
      h.growT -= dt;
      if (h.growT <= -12) { h.residents--; h.growT = 0; }
    } else h.growT *= 0.98;

    const block = this.upgradeBlocker(h);
    if (!block) {
      h.upT += dt;
      if (h.upT >= 10) {
        this.pay(TIERS[h.tier + 1].upgradeCost, h.owner, h.island);
        h.tier++;
        h.upT = 0;
        for (const g of Object.keys(TIERS[h.tier].consumes) as GoodId[]) if (h.need[g] === undefined) h.need[g] = 1;
        this.ev.changed(h);
        if (h.owner === HUMAN && this.housesByTier()[h.tier] === 1) this.ev.message(`Deine ersten ${TIERS[h.tier].name} sind eingezogen! 🎉`, 'good');
      }
    } else h.upT = 0;
  }

  upgradeBlocker(h: Building): string | null {
    if (h.tier >= TIERS.length - 1) return 'Höchste Stufe erreicht';
    const tier = TIERS[h.tier];
    const next = TIERS[h.tier + 1];
    if (h.residents < tier.maxResidents) return `Haus noch nicht voll (${h.residents}/${tier.maxResidents})`;
    if (h.happy < 0.9) return 'Bewohner noch nicht zufrieden genug';
    const cov = this.coverage.get(h.id) ?? new Set();
    for (const s of next.services) if (!cov.has(s)) return `${BUILDINGS[s].name} in der Nähe fehlt`;
    const l = this.lagerOf(h.owner, h.island) ?? EMPTY;
    for (const g of Object.keys(next.consumes) as GoodId[]) if (!(g in tier.consumes) && l[g] < 1) return `${GOOD[g].name} fehlt im Lager`;
    const c = this.canAfford(next.upgradeCost, h.owner, h.island);
    if (!c.ok) return `${c.reason} zum Ausbau`;
    return null;
  }

  // ---------- Aufgaben ----------

  checkQuest() {
    const q = QUESTS[this.quest];
    if (!q || !q.done(this)) return;
    this.money += q.reward;
    this.ev.message(`Aufgabe erledigt: ${q.title} (+${q.reward} Taler)`, 'good');
    this.quest++;
  }
}

export interface Quest { title: string; hint: string; done(g: Game): boolean; progress(g: Game): string; reward: number }

const cnt = (g: Game, t: BuildingId, need: number) => `${Math.min(g.count(t, true), need)}/${need}`;
const linkedAny = (g: Game, types: BuildingId[]) => types.reduce((n, t) => n + g.count(t, true), 0);
const done = (g: Game, types: BuildingId[]) => types.filter((t) => g.count(t, true) >= 1).length;
const stored = (g: Game) => { const k = g.kontor(); const l = k ? g.lagerOf(HUMAN, k.island) : null; return l ? Object.values(l).reduce((a, b) => a + b, 0) : 0; };

export const QUESTS: Quest[] = [
  { title: 'Neues Land', hint: 'Tippe dein Schiff an, dann aufs Meer, um loszusegeln. Erkunde die Inseln und gründe an der Küste einer guten Insel ein Kontor (Schiff antippen → „Kontor bauen“).',
    done: (g) => g.count('kontor') >= 1, progress: (g) => `${Math.min(1, g.count('kontor'))}/1`, reward: 300 },
  { title: 'Ladung löschen', hint: 'Lade Werkzeug, Holz und Nahrung aus dem Schiff ins Kontor (Schiff antippen → „Alles ausladen“).',
    done: (g) => stored(g) >= 40, progress: (g) => `${Math.min(40, Math.floor(stored(g)))}/40 t`, reward: 100 },
  { title: 'Holz für den Aufbau', hint: 'Baue einen Holzfäller nahe am Wald und verbinde ihn mit einem Feldweg mit dem Kontor ⚓.',
    done: (g) => g.count('holzfaeller', true) >= 1, progress: (g) => cnt(g, 'holzfaeller', 1), reward: 200 },
  { title: 'Nahrung', hint: 'Baue eine Fischerhütte direkt am Wasser oder eine Jagdhütte am Wald und verbinde sie per Weg.',
    done: (g) => linkedAny(g, ['fischer', 'jagdhuette']) >= 1, progress: (g) => `${Math.min(1, linkedAny(g, ['fischer', 'jagdhuette']))}/1`, reward: 200 },
  { title: 'Ein Platz zum Leben', hint: 'Baue einen Marktplatz. Er vergrößert dein Gebiet und versorgt Wohnhäuser.',
    done: (g) => g.count('markt') >= 1, progress: (g) => `${Math.min(g.count('markt'), 1)}/1`, reward: 300 },
  { title: 'Erste Siedlung', hint: 'Baue 6 Wohnhäuser in Reichweite des Marktplatzes.',
    done: (g) => g.count('haus') >= 6, progress: (g) => `${Math.min(g.count('haus'), 6)}/6`, reward: 300 },
  { title: 'Wachsende Siedlung', hint: 'Halte deine Pioniere mit Nahrung zufrieden, dann ziehen mehr ein. Ziel: 30 Einwohner.',
    done: (g) => g.population() >= 30, progress: (g) => `${Math.min(g.population(), 30)}/30`, reward: 400 },
  { title: 'Kleidung', hint: 'Siedler brauchen Stoff: Baue eine Schaffarm und eine Weberei (beide mit Weg).',
    done: (g) => done(g, ['schaffarm', 'weberei']) === 2, progress: (g) => `${done(g, ['schaffarm', 'weberei'])}/2`, reward: 400 },
  { title: 'Glaube', hint: 'Baue eine Kapelle in der Nähe deiner Häuser.',
    done: (g) => g.count('kapelle') >= 1, progress: (g) => `${Math.min(g.count('kapelle'), 1)}/1`, reward: 300 },
  { title: 'Siedler', hint: 'Volle, zufriedene Pionierhäuser steigen zu Siedlern auf (kostet Holz + Werkzeug). Ziel: 5 Siedlerhäuser.',
    done: (g) => g.housesByTier()[1] + g.housesByTier()[2] >= 5, progress: (g) => `${Math.min(g.housesByTier()[1] + g.housesByTier()[2], 5)}/5`, reward: 600 },
  { title: 'Stein und Eisen', hint: 'Baue Steinbruch und Erzmine direkt am Berg, dazu eine Werkzeugschmiede.',
    done: (g) => done(g, ['steinbruch', 'erzmine', 'schmiede']) === 3, progress: (g) => `${done(g, ['steinbruch', 'erzmine', 'schmiede'])}/3`, reward: 800 },
  { title: 'Bessere Nahrung', hint: 'Schweinezucht → Fleischerei liefert viel mehr Nahrung als Fischer und Jäger.',
    done: (g) => done(g, ['schweinezucht', 'fleischerei']) === 2, progress: (g) => `${done(g, ['schweinezucht', 'fleischerei'])}/2`, reward: 600 },
  { title: 'Brot backen', hint: 'Getreidefarm → Mühle → Bäckerei: Aus 1 Mehl backt die Bäckerei 2 Nahrung.',
    done: (g) => done(g, ['getreidefarm', 'muehle', 'baeckerei']) === 3, progress: (g) => `${done(g, ['getreidefarm', 'muehle', 'baeckerei'])}/3`, reward: 700 },
  { title: 'Bier für die Bürger', hint: 'Bürger wollen Bier und ein Wirtshaus: Getreidefarm → Brauerei, dazu ein Wirtshaus.',
    done: (g) => done(g, ['getreidefarm', 'brauerei']) === 2 && g.count('wirtshaus') >= 1,
    progress: (g) => `${done(g, ['getreidefarm', 'brauerei']) + Math.min(1, g.count('wirtshaus'))}/3`, reward: 1000 },
  { title: 'Stolze Bürger', hint: 'Lass deine Stadt wachsen: 100 Bürger.',
    done: (g) => g.popByTier()[2] >= 100, progress: (g) => `${Math.min(g.popByTier()[2], 100)}/100`, reward: 2000 },
];

export function newSeed(): number {
  return Math.floor(rng(Date.now() % 100000)() * 1e9);
}
