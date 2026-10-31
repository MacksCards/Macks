// Spiellogik: Inselwelt, Spieler, Schiffe, Bauen, Wirtschaft, Speichern.
// Wie im Vorbild hat jede Insel ihr eigenes Lager (je Spieler); Geld ist global.
import {
  BUILDINGS, BUILD_GOODS, BuildingDef, BuildingId, Cost, GOOD, GOODS, GoodId, KONTOR_LEVELS, PRICES, Res, SHIPS, SLOT_CAP,
  START_CARGO, START_MONEY, ShipType, TIERS, UnitType,
} from './data';
import { findSeaPath } from './path';
import { thinkAI } from './ai';
import { Island, PFLANZEN, T, WORLD_SIZE, generateWorld, rng } from './world';

export type Status = 'ok' | 'keinWeg' | 'rohstoff' | 'lagerVoll' | 'keinWald' | 'keinWasser' | 'wohnen' | 'erschoepft';
export type { Res } from './data';

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
  /** Feld, an dem gerade geerntet wird (Baum, Fanggrund, Wild …), -1 = keins */
  target?: number;
  cut?: boolean;
  /** Kontor-Ausbaustufe (0 = Kontor I) */
  level?: number;
  /** Werft: Schiff im Bau */
  job?: { ship: ShipType; t: number };
  /** Trefferpunkte (fehlt = unbeschädigt) */
  hp?: number;
  /** Burg: Soldaten in Ausbildung (Restzeit in Sekunden) */
  train?: { type: UnitType; t: number }[];
  /** Turm: Zeit bis zum nächsten Schuss */
  cd?: number;
}

/** Soldat auf dem Land (oder an Bord eines Schiffs) */
export interface Unit {
  id: number;
  type: UnitType;
  owner: number;
  x: number;
  y: number;
  dir: number;
  hp: number;
  path: [number, number][];
  /** Angriffsziel (Soldat, Gebäude oder Schiff, per id) – vom Spieler befohlen oder selbst gewählt */
  target?: number;
  /** true = Ziel wurde befohlen (nicht selbst gesucht) */
  ordered?: boolean;
  /** Schiff, an dem eingestiegen werden soll */
  board?: number;
  /** an Bord dieses Schiffs (unsichtbar) */
  ship?: number;
  /** Zeit bis zum nächsten Schlag/Schuss */
  cd: number;
  /** Spielzeit des letzten Angriffs (für die Ausholbewegung) */
  atk?: number;
  /** Ziel des laufenden Wegs (zum Neuberechnen) */
  goal?: [number, number];
  repath?: number;
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
  type?: ShipType;
  owner: number;
  name: string;
  x: number;
  y: number;
  dir: number;
  path: [number, number][];
  slots: Slot[];
  /** Trefferpunkte (fehlt = voll) */
  hp?: number;
  /** geladene Kanonen */
  guns?: number;
  /** Angriffsziel (Schiff, Gebäude oder Soldat, per id) */
  target?: number;
  cd?: number;
  /** Soldaten an Bord (ids) */
  troops?: number[];
  /** Spielzeit der letzten Salve (für Mündungsfeuer) */
  shotT?: number;
}

/** Gedächtnis eines Computergegners */
export interface AIState { phase: 'suchen' | 'fahren' | 'gruenden' | 'aufbau'; island: number; t: number; tries: number; grid: boolean; site?: [number, number]; bad?: number[] }

export interface Player {
  id: number; name: string; color: number; ai: boolean; money: number; brain?: AIState;
  /** mit diesen Spielern herrscht Krieg */
  war?: number[];
  /** Piraten (immer feindlich, außer man hat Schutz gekauft) */
  pirate?: boolean;
  /** besiegt: hat keine Gebäude und Schiffe mehr */
  defeated?: boolean;
  /** Schutz vor Piraten bis zu dieser Spielzeit */
  protectedUntil?: number;
}

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
  best?: number[];
  res?: { trees: string; fish: string; wild: string; weide: string; feld?: string };
  /** verbleibendes Erz je Insel */
  ore?: number[];
}

export interface GameEvents {
  added(b: Building): void;
  removed(b: Building): void;
  changed(b: Building): void;
  roads(): void;
  trees(): void;
  /** ein Baum wurde gefällt (Feld-Index) */
  felled(k: number): void;
  seen(): void;
  /** Schuss oder Schlag: Art, von, nach, getroffen? */
  shot(kind: ShotKind, fx: number, fy: number, tx: number, ty: number, hit: boolean): void;
  /** Schiff versenkt (wird danach aus der Liste entfernt) */
  sunk(s: Ship): void;
  /** Einheit gefallen */
  died(u: Unit): void;
  message(text: string, kind?: 'info' | 'good' | 'bad'): void;
}

export interface Check { ok: boolean; reason?: string }

/** schwert = Nahkampf, muskete, kanone (Kanonier), turm, schiff (Breitseite) */
export type ShotKind = 'schwert' | 'muskete' | 'kanone' | 'turm' | 'schiff';

const LAGER: BuildingId[] = ['kontor', 'markt'];
const SAVE_KEY = 'neue-ufer-save-v4';
export const HUMAN = 0;
const SHIP_SPEED = 3.2; // Kacheln pro Spielsekunde
const SHIP_SIGHT = 9;
/** Nachwachsen je Sekunde (voller Bestand = 1): Baum ~5 min, Fischgrund ~2,5 min, Wild ~6,5 min, Weide ~1,5 min */
const REGEN: Record<Res, number> = { baum: 1 / 300, fisch: 1 / 150, wild: 1 / 400, weide: 1 / 90, feld: 1 / 100 };
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
const encR = (a: Float32Array) => { let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(48 + Math.round(Math.max(0, Math.min(1, a[i])) * 40)); return s; };
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
  /** Rohstoffbestände je Feld (0..1): Reife der Bäume, Fisch, Wild, Weide; fishCap = Ergiebigkeit des Fanggrunds */
  trees: Float32Array = new Float32Array(0);
  fish: Float32Array = new Float32Array(0);
  fishCap: Float32Array = new Float32Array(0);
  wild: Float32Array = new Float32Array(0);
  weide: Float32Array = new Float32Array(0);
  feld: Float32Array = new Float32Array(0);
  private regenT = 0;
  /** wie viele Ernte-Betriebe je Rohstoff ein Feld nutzen (für die Ergiebigkeit) */
  private share: Partial<Record<Res, Uint8Array>> = {};
  buildings: Building[] = [];
  byId = new Map<number, Building>();
  ships: Ship[] = [];
  units: Unit[] = [];
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
  /** höchste je erreichte Einwohnerzahl je Stufe (Freischaltungen bleiben erhalten, wenn sie wieder sinkt) */
  best: number[] = [0, 0, 0, 0, 0];
  private unlockT = 0;
  private cartT = 0;

  ev: GameEvents = { added() {}, removed() {}, changed() {}, roads() {}, trees() {}, felled() {}, seen() {}, message() {}, shot() {}, sunk() {}, died() {} };

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
    this.initResources(seed);
    this.oreStart = new Map(this.islands.map((i) => [i.id, i.erz]));
  }

  /** Startbestände: Wald voll, Fischgründe je nach Lage (Schwärme an Küsten, reiche und arme Stellen) */
  private initResources(seed: number) {
    const N = this.size, NN = N * N;
    this.trees = new Float32Array(NN); this.wild = new Float32Array(NN); this.weide = new Float32Array(NN); this.feld = new Float32Array(NN);
    this.fish = new Float32Array(NN); this.fishCap = new Float32Array(NN);
    const dist = new Float32Array(NN).fill(99);
    const q: number[] = [];
    for (let k = 0; k < NN; k++) if (this.tiles[k] !== T.Wasser) { dist[k] = 0; q.push(k); }
    for (let h = 0; h < q.length; h++) {
      const k = q[h], x = k % N, y = (k / N) | 0;
      if (dist[k] >= 6) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const nk = ny * N + nx;
        if (dist[nk] > dist[k] + 1) { dist[nk] = dist[k] + 1; q.push(nk); }
      }
    }
    const r = rng(seed + 501);
    // grobe Schwarm-Flecken: Zufallszentren mit weichem Rand
    const shoals: [number, number, number][] = [];
    for (let i = 0; i < 140; i++) shoals.push([r() * N, r() * N, 3 + r() * 5]);
    for (let k = 0; k < NN; k++) {
      const t = this.tiles[k];
      if (t === T.Wald) { this.trees[k] = r() < 0.85 ? 1 : 0.3 + r() * 0.6; this.wild[k] = 1; }
      if (t === T.Gras || t === T.Sand) { this.weide[k] = 1; this.feld[k] = 1; }
      if (t === T.Wasser && dist[k] <= 5) {
        const x = k % N + 0.5, y = ((k / N) | 0) + 0.5;
        let sh = 0;
        for (const [sx, sy, sr] of shoals) { const d = Math.hypot(x - sx, y - sy); if (d < sr) sh = Math.max(sh, 1 - d / sr); }
        const depth = dist[k] <= 1 ? 0.55 : dist[k] <= 3 ? 1 : 0.7;
        this.fishCap[k] = Math.min(1, (0.25 + sh * 0.9) * depth);
        this.fish[k] = this.fishCap[k];
      }
    }
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
      const ship: Ship = { id: g.nextId++, type: 'handel_klein', owner: p.id, name: shipNames[p.id], x: sx + 0.5, y: sy + 0.5, dir: -Math.PI / 4, path: [], slots: [] };
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
    (d.ore ?? []).forEach((v, i) => { if (g.islands[i]) g.islands[i].erz = v; });
    if (d.best) g.best = d.best;
    if (d.res) {
      const dec = (str: string, arr: Float32Array) => { for (let i = 0; i < arr.length && i < str.length; i++) arr[i] = (str.charCodeAt(i) - 48) / 40; };
      dec(d.res.trees, g.trees); dec(d.res.fish, g.fish); dec(d.res.wild, g.wild); dec(d.res.weide, g.weide);
      if (d.res.feld) dec(d.res.feld, g.feld);
    }
    g.checkUnlocks(true);
    return g;
  }

  serialize(): SaveData {
    return {
      v: 3, seed: this.seed, tiles: enc(this.tiles), roads: enc(this.roads), seen: enc(this.seen),
      buildings: this.buildings, ships: this.ships, players: this.players, lager: this.lager,
      nextId: this.nextId, time: this.time, quest: this.quest, unlocked: [...this.unlocked], best: this.best,
      res: { trees: encR(this.trees), fish: encR(this.fish), wild: encR(this.wild), weide: encR(this.weide), feld: encR(this.feld) },
      ore: this.islands.map((i) => i.erz),
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

  /** volle Trefferpunkte eines Gebäudes */
  maxHp(b: { type: BuildingId }): number {
    const d = BUILDINGS[b.type];
    return d.hp ?? 30 + d.size * d.size * 12;
  }
  /** volle Trefferpunkte eines Schiffs */
  shipMaxHp(s: Ship): number { return SHIPS[s.type ?? 'handel_klein'].hp; }
  unitById(id: number): Unit | undefined { return this.units.find((u) => u.id === id); }

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

  /** Ist eine Schwelle (z. B. 120 Siedler) für den Spieler schon einmal erreicht worden? */
  reached(u: { tier: number; n: number }, owner = HUMAN): boolean {
    return owner === HUMAN ? Math.max(this.best[u.tier] ?? 0, this.maxPop(u.tier)) >= u.n : this.maxPop(u.tier, owner) >= u.n;
  }

  checkUnlocks(silent = false) {
    for (let t = 0; t < TIERS.length; t++) this.best[t] = Math.max(this.best[t] ?? 0, this.maxPop(t));
    const fresh: BuildingId[] = [];
    for (const d of Object.values(BUILDINGS)) {
      if (!d.category || this.unlocked.has(d.id)) continue;
      const u = d.unlock;
      if (!u || this.maxPop(u.tier) >= u.n) { this.unlocked.add(d.id); if (u) fresh.push(d.id); }
    }
    if (!silent && fresh.length) {
      const names = fresh.map((t) => `${BUILDINGS[t].icon} ${BUILDINGS[t].name}`);
      this.ev.message(`Neu freigeschaltet: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` und ${names.length - 3} weitere` : ''}`, 'good');
    }
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
      const stor = b.type === 'kontor' ? KONTOR_LEVELS[b.level ?? 0].storage : d.storage ?? 0;
      this.cap.set(key, (this.cap.get(key) ?? 0) + stor);
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
    const SVC: BuildingId[] = ['markt', 'kapelle', 'kirche', 'wirtshaus', 'schule', 'badehaus', 'hochschule', 'theater'];
    const services = this.buildings.filter((b) => SVC.includes(b.type));
    for (const h of this.buildings) {
      if (h.type !== 'haus') continue;
      const set = new Set<BuildingId>();
      const [hx, hy] = this.center(h);
      for (const s of services) {
        if (s.owner !== h.owner) continue;
        const [sx, sy] = this.center(s);
        const r = this.def(s).radius ?? 0;
        if ((hx - sx) ** 2 + (hy - sy) ** 2 <= r * r) { set.add(s.type); if (s.type === 'kirche') set.add('kapelle'); }
      }
      this.coverage.set(h.id, set);
    }
    this.share = {};
    for (const o of this.buildings) {
      const res = BUILDINGS[o.type].harvest?.res;
      if (!res) continue;
      const arr = (this.share[res] ??= new Uint8Array(N * N));
      for (const k of this.workTiles(o.type, o.x, o.y)) if (arr[k] < 255) arr[k]++;
    }
    for (const b of this.buildings) b.eff = this.siteEfficiency(b.type, b.x, b.y, b.id);
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
      const here = this.roads[this.idx(Math.floor(c.x), Math.floor(c.y))];
      let step = CART_SPEED * (here === 2 ? 1.5 : 1) * dt;
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

  /** Felder im Arbeitsradius eines Betriebs (ohne die eigene Grundfläche) */
  workTiles(type: BuildingId, x: number, y: number): number[] {
    const d = BUILDINGS[type];
    const R = d.work ?? 4;
    const cx = x + d.size / 2, cy = y + d.size / 2;
    const out: number[] = [];
    for (let j = Math.floor(cy - R); j <= Math.ceil(cy + R); j++) for (let i = Math.floor(cx - R); i <= Math.ceil(cx + R); i++) {
      if (!this.inMap(i, j)) continue;
      if ((i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2 > R * R) continue;
      if (i >= x && i < x + d.size && j >= y && j < y + d.size) continue;
      out.push(this.idx(i, j));
    }
    return out;
  }

  /** Taugt dieses Feld für den Rohstoff? (Weide nur auf freiem Gras/Sand) */
  resOk(res: Res, k: number): boolean {
    const t = this.tiles[k];
    if (res === 'fisch') return this.fishCap[k] > 0;
    if (res === 'baum' || res === 'wild') return t === T.Wald;
    // Weide/Felder: freies Gras oder Sand
    return (t === T.Gras || t === T.Sand) && !this.occ[k] && !this.roads[k];
  }

  resStock(res: Res): Float32Array {
    return res === 'baum' ? this.trees : res === 'fisch' ? this.fish : res === 'wild' ? this.wild : res === 'feld' ? this.feld : this.weide;
  }

  /**
   * Ergiebigkeit 0..1: wie viel im Arbeitsradius dauerhaft nachwächst, geteilt durch alle
   * gleichartigen Betriebe, die dieselben Felder nutzen – verglichen mit dem Bedarf bei voller Arbeit.
   */
  /** Fruchtbarkeit der Insel für eine Plantage (0..1); 1 für alles andere */
  fertility(type: BuildingId, x: number, y: number): number {
    const p = BUILDINGS[type].pflanze;
    if (!p) return 1;
    const isl = this.islands[this.islandOf[this.idx(x, y)]];
    return (isl?.frucht[p] ?? 0) / 100;
  }

  siteEfficiency(type: BuildingId, x: number, y: number, self = -1): number {
    const d = BUILDINGS[type];
    const fert = this.fertility(type, x, y);
    if (fert <= 0) return 0;
    if (d.deposit) {
      const id = this.islandOf[this.idx(x, y)];
      const isl = this.islands[id];
      const ok = !isl ? false : d.deposit === 'erz' ? isl.erz > 0 : d.deposit === 'tiefErz' ? this.hadOre(id) : !!isl.gold;
      if (!ok) return 0;
    }
    if (d.needs === 'berg') {
      for (const [rx, ry] of this.ring({ type, x, y })) if (this.tile(rx, ry) === T.Berg) return 1;
      return 0;
    }
    if (!d.harvest || !d.prod) return 1;
    const res = d.harvest.res;
    const need = d.harvest.per / d.prod.time;
    // wer nutzt welche Felder schon mit? (self zählt sich selbst nicht doppelt)
    const sh = this.share[res];
    const minus = self >= 0 ? 1 : 0;
    let supply = 0;
    for (const k of this.workTiles(type, x, y)) {
      if (!this.resOk(res, k)) continue;
      const cap = res === 'fisch' ? this.fishCap[k] : 1;
      supply += (REGEN[res] * cap) / (1 + Math.max(0, (sh ? sh[k] : 0) - minus));
    }
    return Math.min(1, supply / need) * fert;
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
    let step = SHIP_SPEED * (SHIPS[s.type ?? 'handel_klein'].speed) * dt;
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
    for (const k of BUILD_GOODS) if ((c[k] ?? 0) > l[k]) return { ok: false, reason: `Zu wenig ${GOOD[k].name}` };
    return { ok: true };
  }

  private pay(c: Cost, owner: number, island: number) {
    this.players[owner].money -= c.taler ?? 0;
    const l = this.lagerOf(owner, island);
    if (l) for (const k of BUILD_GOODS) l[k] -= c[k] ?? 0;
  }

  /** Schiff des Spielers, das nahe genug an einem Bauplatz liegt */
  shipNear(owner: number, cx: number, cy: number): Ship | undefined {
    return this.ships.filter((s) => s.owner === owner).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))
      .find((s) => Math.hypot(s.x - cx, s.y - cy) <= DOCK_RANGE + 2);
  }

  canPlace(type: BuildingId, x: number, y: number, owner = HUMAN, ignoreShip = false): Check {
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
      return { ok: false, reason: `Erst ab ${u.n} ${TIERS[u.tier].dat}` };
    }
    if (type === 'kontor') {
      if (this.kontor(owner, isl)) return { ok: false, reason: 'Auf dieser Insel hast du schon ein Kontor' };
      let w = 0;
      for (const [rx, ry] of this.ring({ type, x, y })) if (this.tile(rx, ry) === T.Wasser) w++;
      if (w < 2) return { ok: false, reason: 'Das Kontor muss direkt an der Küste stehen' };
      if (ignoreShip) return { ok: true };
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
    if (d.needs === 'kueste') {
      let w = 0;
      for (const [rx, ry] of this.ring({ type, x, y })) if (this.tile(rx, ry) === T.Wasser) w++;
      if (w < 2) return { ok: false, reason: 'Muss direkt an der Küste stehen' };
    }
    if (d.needs === 'berg') {
      let berg = false;
      for (const [rx, ry] of this.ring({ type, x, y })) if (this.tile(rx, ry) === T.Berg) berg = true;
      if (!berg) return { ok: false, reason: 'Muss direkt am Berg stehen' };
    }
    if (d.deposit) {
      const il = this.islands[isl];
      if (d.deposit === 'erz' && !(il?.erz > 0)) return { ok: false, reason: il && il.erz === 0 && this.hadOre(isl) ? 'Das Erzvorkommen ist erschöpft' : 'Diese Insel hat kein Erz im Berg' };
      if (d.deposit === 'gold' && !il?.gold) return { ok: false, reason: 'Diese Insel hat kein Gold im Berg' };
      if (d.deposit === 'tiefErz' && !this.hadOre(isl)) return { ok: false, reason: 'Diese Insel hat kein Erz im Berg' };
    }
    if (d.pflanze && this.fertility(type, x, y) <= 0) return { ok: false, reason: `Diese Insel ist nicht fruchtbar für ${PFLANZEN[d.pflanze].name}` };
    return this.canAfford(d.cost, owner, isl);
  }

  private oreStart = new Map<number, number>();
  hadOre(isl: number) { return (this.oreStart.get(isl) ?? 0) > 0; }

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

  /** Weg bauen: 'weg' = Feldweg, 'steinweg' = Pflasterweg (kostet 1 Stein, Karren schneller). Feldwege lassen sich pflastern. */
  canRoad(x: number, y: number, owner = HUMAN, type: 'weg' | 'steinweg' = 'weg'): Check {
    if (!this.inMap(x, y)) return { ok: false, reason: 'Außerhalb der Karte' };
    const k = this.idx(x, y);
    const t = this.tiles[k];
    if (t === T.Wasser || t === T.Berg) return { ok: false, reason: 'Hier geht kein Weg' };
    const upgrade = type === 'steinweg' && this.roads[k] === 1;
    if ((this.roads[k] && !upgrade) || this.occ[k]) return { ok: false, reason: 'Platz ist belegt' };
    if (this.own[k] !== owner) return { ok: false, reason: 'Außerhalb deines Gebiets' };
    if (type === 'steinweg' && owner === HUMAN && !this.isUnlocked('steinweg')) return { ok: false, reason: 'Pflasterwege erst ab 15 Siedlern' };
    const c = BUILDINGS[type].cost;
    if (this.players[owner].money < (c.taler ?? 0)) return { ok: false, reason: 'Zu wenig Taler' };
    if (c.stein && (this.lagerOf(owner, this.islandOf[k])?.stein ?? 0) < c.stein) return { ok: false, reason: 'Zu wenig Steine' };
    return { ok: true };
  }

  placeRoads(cells: [number, number][], owner = HUMAN, type: 'weg' | 'steinweg' = 'weg'): number {
    let n = 0, trees = false, lastReason = '';
    const c = BUILDINGS[type].cost;
    for (const [x, y] of cells) {
      const ch = this.canRoad(x, y, owner, type);
      if (!ch.ok) { lastReason = ch.reason ?? ''; continue; }
      const k = this.idx(x, y);
      if (this.tiles[k] === T.Wald) { this.tiles[k] = T.Gras; trees = true; }
      this.roads[k] = type === 'steinweg' ? 2 : 1;
      this.players[owner].money -= c.taler ?? 0;
      if (c.stein) { const l = this.lagerOf(owner, this.islandOf[k]); if (l) l.stein -= c.stein; }
      n++;
    }
    if (n) { this.recompute(); this.ev.roads(); }
    if (trees) this.ev.trees();
    if (!n && lastReason && cells.length === 1 && owner === HUMAN) this.ev.message(lastReason, 'bad');
    return n;
  }

  /** Mauern/Palisaden: viele 1×1-Bauteile auf einmal setzen */
  placeMany(type: BuildingId, cells: [number, number][], owner = HUMAN): number {
    let n = 0, last = '';
    for (const [x, y] of cells) { const r = this.place(type, x, y, owner); if (r.ok) n++; else last = r.reason ?? ''; }
    if (!n && last && owner === HUMAN) this.ev.message(last, 'bad');
    return n;
  }

  // ---------- Kontor-Ausbau und Werft ----------

  kontorUpgrade(b: Building): Check {
    const lv = (b.level ?? 0) + 1;
    const next = KONTOR_LEVELS[lv];
    if (!next) return { ok: false, reason: 'Höchste Ausbaustufe erreicht' };
    if (next.unlock && !this.reached(next.unlock, b.owner)) return { ok: false, reason: `Erst ab ${next.unlock.n} ${TIERS[next.unlock.tier].dat}` };
    const c = this.canAfford(next.cost, b.owner, b.island);
    if (!c.ok) return c;
    this.pay(next.cost, b.owner, b.island);
    b.level = lv;
    this.recompute();
    return { ok: true };
  }

  canOrderShip(w: Building, type: ShipType): Check {
    const sd = SHIPS[type];
    if (w.job) return { ok: false, reason: 'Die Werft baut gerade' };
    if (sd.werft === 'grosswerft' && w.type !== 'grosswerft') return { ok: false, reason: 'Nur auf der großen Werft' };
    if (!this.reached(sd.unlock, w.owner)) return { ok: false, reason: `Erst ab ${sd.unlock.n} ${TIERS[sd.unlock.tier].dat}` };
    if (this.ships.filter((s) => s.owner === w.owner).length >= 20) return { ok: false, reason: 'Höchstens 20 Schiffe' };
    const l = this.lagerOf(w.owner, w.island);
    if (this.players[w.owner].money < sd.cost.taler) return { ok: false, reason: 'Zu wenig Taler' };
    if (!l || l.holz < sd.cost.holz) return { ok: false, reason: 'Zu wenig Holz' };
    if (l.stoff < sd.cost.stoff) return { ok: false, reason: 'Zu wenig Stoffe (für die Segel)' };
    return { ok: true };
  }

  orderShip(w: Building, type: ShipType): Check {
    const c = this.canOrderShip(w, type);
    if (!c.ok) return c;
    const sd = SHIPS[type];
    const l = this.lagerOf(w.owner, w.island)!;
    this.players[w.owner].money -= sd.cost.taler;
    l.holz -= sd.cost.holz; l.stoff -= sd.cost.stoff;
    w.job = { ship: type, t: 0 };
    return { ok: true };
  }

  private tickWerft(w: Building, dt: number) {
    if (!w.job) return;
    const sd = SHIPS[w.job.ship];
    w.job.t += dt * (w.type === 'grosswerft' ? 1.6 : 1);
    if (w.job.t < sd.time) return;
    // Stapellauf am nächsten Wasserfeld
    let spot: [number, number] | null = null;
    for (const [x, y] of this.ring(w)) if (this.inMap(x, y) && this.tiles[this.idx(x, y)] === T.Wasser) { spot = [x, y]; break; }
    if (!spot) return;
    const names = ['Möwe', 'Delfin', 'Hoffnung', 'Fortuna', 'Seestern', 'Albatros', 'Zuversicht', 'Stolz von Neue Ufer', 'Brise', 'Kormoran'];
    const ship: Ship = { id: this.nextId++, type: w.job.ship, owner: w.owner, name: names[this.ships.length % names.length], x: spot[0] + 0.5, y: spot[1] + 0.5, dir: 0, path: [], slots: [] };
    for (let i = 0; i < sd.slots; i++) ship.slots.push({ g: null, n: 0 });
    this.ships.push(ship);
    w.job = undefined;
    if (w.owner === HUMAN) this.ev.message(`⛵ ${sd.name} „${ship.name}“ ist vom Stapel gelaufen!`, 'good');
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
    if (l) for (const k of BUILD_GOODS) l[k] = Math.min(l[k] + Math.floor((d.cost[k] ?? 0) / 2), Math.max(cap, l[k]));
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
      else if (b.job) this.tickWerft(b, dt);
    }
    this.regenT += dt;
    if (this.regenT >= 1) { this.regrow(this.regenT); this.regenT = 0; }
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

  private regrow(dt: number) {
    const NN = this.trees.length;
    const rb = REGEN.baum * dt, rf = REGEN.fisch * dt, rw = REGEN.wild * dt, rg = REGEN.weide * dt, rl = REGEN.feld * dt;
    for (let k = 0; k < NN; k++) {
      const t = this.tiles[k];
      if (t === T.Wald) {
        if (this.trees[k] < 1) this.trees[k] = Math.min(1, this.trees[k] + rb);
        if (this.wild[k] < 1) this.wild[k] = Math.min(1, this.wild[k] + rw);
      } else if (t === T.Wasser) {
        const c = this.fishCap[k];
        if (c > 0 && this.fish[k] < c) this.fish[k] = Math.min(c, this.fish[k] + rf * c);
      } else {
        if (this.weide[k] < 1) this.weide[k] = Math.min(1, this.weide[k] + rg);
        if (this.feld[k] < 1) this.feld[k] = Math.min(1, this.feld[k] + rl);
      }
    }
  }

  /** Arbeitsgang beginnen: Ziel wählen (reifer Baum / ergiebigstes Feld). false = nichts mehr da */
  private startHarvest(b: Building): boolean {
    const h = this.def(b).harvest!;
    const st = this.resStock(h.res);
    const tiles = this.workTiles(b.type, b.x, b.y).filter((k) => this.resOk(h.res, k));
    if (h.res === 'baum') {
      const taken = new Set(this.buildings.filter((o) => o !== b && o.loaded && o.target !== undefined).map((o) => o.target));
      const [cx, cy] = this.center(b);
      let best = -1, bd = 1e9;
      for (const k of tiles) {
        if (st[k] < 0.999 || taken.has(k)) continue;
        const d = Math.hypot(k % this.size + 0.5 - cx, ((k / this.size) | 0) + 0.5 - cy);
        if (d < bd) { bd = d; best = k; }
      }
      if (best < 0) return false;
      b.target = best; b.cut = false;
      return true;
    }
    let sum = 0, best = -1, bv = 0;
    for (const k of tiles) { sum += st[k]; if (st[k] > bv) { bv = st[k]; best = k; } }
    if (sum < h.per) return false;
    b.target = best;
    return true;
  }

  /** Arbeitsgang abschließen: Rohstoff aus der Umgebung nehmen */
  private finishHarvest(b: Building): boolean {
    const h = this.def(b).harvest!;
    if (h.res === 'baum') {
      if (!b.cut && b.target !== undefined && b.target >= 0) { this.trees[b.target] = 0; this.ev.felled(b.target); b.cut = true; }
      return true;
    }
    const st = this.resStock(h.res);
    const N = this.size;
    const tx = (b.target ?? 0) % N, ty = ((b.target ?? 0) / N) | 0;
    // nahe am Ziel zuerst abernten (Fische im Schwarm, Schafe auf einer Weidefläche)
    const tiles = this.workTiles(b.type, b.x, b.y).filter((k) => this.resOk(h.res, k))
      .sort((p, q) => Math.hypot(p % N - tx, ((p / N) | 0) - ty) - Math.hypot(q % N - tx, ((q / N) | 0) - ty));
    let left = h.per;
    for (const k of tiles) { if (left <= 0) break; const t = Math.min(st[k], left, h.res === 'weide' ? 1 : 0.34); st[k] -= t; left -= t; }
    return left < h.per * 0.5;
  }

  private tickProduction(b: Building, dt: number) {
    const p = this.def(b).prod!;
    const l = this.lagerOf(b.owner, b.island);
    let working = false;
    b.missing = [];
    const hv = this.def(b).harvest;
    if (!l || !this.linked.has(b.id)) b.status = 'keinWeg';
    else if (b.eff <= 0 && !hv) b.status = this.def(b).deposit ? 'erschoepft' : this.def(b).needs === 'wasser' ? 'keinWasser' : 'keinWald';
    else if (b.stock >= (this.def(b).stock ?? 4)) b.status = 'lagerVoll';
    else if (hv && !b.loaded && !this.startHarvest(b)) b.status = 'erschoepft';
    else {
      if (hv) b.loaded = true;
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
        b.progress += dt * (hv ? this.fertility(b.type, b.x, b.y) : b.eff);
        // Baum fällt kurz vor Ende des Arbeitsgangs (Holzfäller hackt erst)
        if (hv?.res === 'baum' && !b.cut && b.progress >= p.time * 0.8 && b.target !== undefined) {
          this.trees[b.target] = 0; this.ev.felled(b.target); b.cut = true;
        }
        if (b.progress >= p.time) {
          b.progress = 0;
          b.loaded = false;
          const ok = hv ? this.finishHarvest(b) : true;
          if (ok) b.stock = Math.min(this.def(b).stock ?? 4, b.stock + (p.amount ?? 1));
          const dep = this.def(b).deposit;
          if (dep === 'erz') {
            const il = this.islands[b.island];
            il.erz = Math.max(0, il.erz - (p.amount ?? 1));
            if (il.erz === 0) { b.eff = 0; if (b.owner === HUMAN) this.ev.message(`⛏️ Das Erzvorkommen auf ${il.name} ist erschöpft.`, 'bad'); }
          }
          b.target = undefined;
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
    if (h.happy < 0.85) return 'Bewohner noch nicht zufrieden genug';
    const cov = this.coverage.get(h.id) ?? new Set();
    for (const s of tier.next?.services ?? []) if (!cov.has(s)) return `${BUILDINGS[s].name} in der Nähe fehlt`;
    const l = this.lagerOf(h.owner, h.island) ?? EMPTY;
    for (const group of tier.next?.goods ?? []) {
      if (!group.some((g) => l[g] >= 1)) return `${group.map((g) => GOOD[g].name).join(' oder ')} fehlt im Lager`;
    }
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

const linkedAny = (g: Game, types: BuildingId[]) => types.reduce((n, t) => n + g.count(t, true), 0);
const stored = (g: Game) => { const k = g.kontor(); const l = k ? g.lagerOf(HUMAN, k.island) : null; return l ? Object.values(l).reduce((a, b) => a + b, 0) : 0; };

const houses = (g: Game, tier: number) => g.housesByTier().slice(tier).reduce((a, b) => a + b, 0);
const any = (g: Game, types: BuildingId[], linked = true) => types.some((t) => g.count(t, linked) >= 1);
const step = (title: string, hint: string, done: (g: Game) => boolean, progress: (g: Game) => string, reward: number): Quest => ({ title, hint, done, progress, reward });
const all = (types: BuildingId[], linked = true) => ({
  done: (g: Game) => types.every((t) => g.count(t, linked) >= 1),
  progress: (g: Game) => `${types.filter((t) => g.count(t, linked) >= 1).length}/${types.length}`,
});
const tierGoal = (tier: number, n: number) => ({ done: (g: Game) => houses(g, tier) >= n, progress: (g: Game) => `${Math.min(n, houses(g, tier))}/${n}` });

/** Aufgaben führen Schritt für Schritt durch alle Stufen und Warenketten (wie die Lernkurve des Vorbilds) */
export const QUESTS: Quest[] = [
  step('Neues Land', 'Tippe dein Schiff an, dann aufs Meer, um loszusegeln. Erkunde die Inseln und gründe an der Küste einer guten Insel ein Kontor (Schiff antippen → „Kontor bauen“).',
    (g) => g.count('kontor') >= 1, (g) => `${Math.min(1, g.count('kontor'))}/1`, 300),
  step('Ladung löschen', 'Lade Werkzeug, Holz und Nahrung aus dem Schiff ins Kontor (Schiff antippen → „Alles ausladen“).',
    (g) => stored(g) >= 40, (g) => `${Math.min(40, Math.floor(stored(g)))}/40 t`, 100),
  step('Holz für den Aufbau', 'Baue einen Holzfäller nahe am Wald und verbinde ihn mit einem Feldweg mit dem Kontor ⚓.', ...Object.values(all(['holzfaeller'])) as [Quest['done'], Quest['progress']], 200),
  step('Nahrung', 'Baue eine Fischerhütte an guten Fischgründen (Kräuselringe!) oder eine Jagdhütte am Wald und verbinde sie per Weg.',
    (g) => linkedAny(g, ['fischer', 'jagdhuette']) >= 1, (g) => `${Math.min(1, linkedAny(g, ['fischer', 'jagdhuette']))}/1`, 200),
  step('Ein Platz zum Leben', 'Baue einen Marktplatz. Er vergrößert dein Gebiet und versorgt Wohnhäuser.', ...Object.values(all(['markt'], false)) as [Quest['done'], Quest['progress']], 300),
  step('Erste Siedlung', 'Baue 8 Wohnhäuser in Reichweite des Marktplatzes.', (g) => g.count('haus') >= 8, (g) => `${Math.min(g.count('haus'), 8)}/8`, 300),
  step('Stoffe', 'Pioniere brauchen Stoffe, um aufzusteigen: Schaffarm (Wolle) und Weberei, beide mit Weg.', ...Object.values(all(['schaffarm', 'weberei'])) as [Quest['done'], Quest['progress']], 400),
  step('Glaube', 'Baue eine Kapelle in der Nähe deiner Häuser.', ...Object.values(all(['kapelle'], false)) as [Quest['done'], Quest['progress']], 300),
  step('Siedler', 'Volle, zufriedene Pionierhäuser mit Kapelle und Stoffen im Lager werden zu Siedlern. Ziel: 6 Siedlerhäuser.', ...Object.values(tierGoal(1, 6)) as [Quest['done'], Quest['progress']], 600),
  step('Steine', 'Ab 15 Siedlern: Steinbruch direkt am Berg. Steine brauchst du für Pflasterwege, Plantagen, Wirtshaus, Schule und mehr.', ...Object.values(all(['steinbruch'])) as [Quest['done'], Quest['progress']], 500),
  step('Alkohol', 'Siedler wollen Alkohol: Weingut oder Zuckerrohrplantage + Rumbrennerei (auf fruchtbarer Insel) – oder später die Brauerei.',
    (g) => any(g, ['weingut', 'rumbrennerei', 'brauerei']), (g) => (any(g, ['weingut', 'rumbrennerei', 'brauerei']) ? '1/1' : '0/1'), 700),
  step('Tabak oder Gewürze', 'Für Bürger: Tabakplantage + Tabakwarenmanufaktur oder eine Gewürzplantage. Schau mit dem Schiff, welche Insel dafür fruchtbar ist.',
    (g) => any(g, ['tabakwaren', 'gewuerzplantage']), (g) => (any(g, ['tabakwaren', 'gewuerzplantage']) ? '1/1' : '0/1'), 700),
  step('Wirtshaus und Schule', 'Siedler brauchen Wirtshaus (ab 50 Siedlern) und Schule (ab 100 Siedlern), um Bürger zu werden.', ...Object.values(all(['wirtshaus', 'schule'], false)) as [Quest['done'], Quest['progress']], 800),
  step('Bürger', 'Siedlerhäuser mit Alkohol, Tabakwaren oder Gewürzen, Wirtshaus und Schule werden zu Bürgern. Ziel: 6 Bürgerhäuser.', ...Object.values(tierGoal(2, 6)) as [Quest['done'], Quest['progress']], 1000),
  step('Eisen und Werkzeug', 'Erzmine am Berg einer Erz-Insel, Erzschmelze und Werkzeugschmiede: nie wieder Werkzeug kaufen!', ...Object.values(all(['erzmine', 'erzschmelze', 'schmiede'])) as [Quest['done'], Quest['progress']], 1200),
  step('Kakao', 'Bürger werden zu Kaufleuten, wenn es Kakao gibt. Kakao wächst auf südlichen Inseln.', ...Object.values(all(['kakaoplantage'])) as [Quest['done'], Quest['progress']], 1000),
  step('Kirche und Badehaus', 'Kaufleute wollen Kirche (ab 150 Bürgern) und Badehaus (ab 210 Bürgern).', ...Object.values(all(['kirche', 'badehaus'], false)) as [Quest['done'], Quest['progress']], 1500),
  step('Kaufleute', 'Ziel: 6 Häuser der Kaufleute.', ...Object.values(tierGoal(3, 6)) as [Quest['done'], Quest['progress']], 2000),
  step('Kleidung und Schmuck', 'Aristokraten wollen Kleidung (Schneiderei) und Schmuck (Goldmine + Goldschmied).', ...Object.values(all(['schneiderei', 'goldschmied'])) as [Quest['done'], Quest['progress']], 2500),
  step('Hochschule und Theater', 'Kaufleute brauchen Hochschule und Theater, um Aristokraten zu werden.', ...Object.values(all(['hochschule', 'theater'], false)) as [Quest['done'], Quest['progress']], 2500),
  step('Aristokraten', 'Die höchste Stufe: 6 Häuser der Aristokraten.', ...Object.values(tierGoal(4, 6)) as [Quest['done'], Quest['progress']], 5000),
  step('Eigene Flotte', 'Baue eine Werft an der Küste und lass ein zweites Schiff vom Stapel laufen.', (g) => g.myShips().length >= 2, (g) => `${Math.min(2, g.myShips().length)}/2`, 1000),
];

export function newSeed(): number {
  return Math.floor(rng(Date.now() % 100000)() * 1e9);
}
