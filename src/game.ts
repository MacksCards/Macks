// Spiellogik: Zustand, Bauen, Wirtschaftssimulation, Speichern.
import {
  BUILDINGS, BuildingDef, BuildingId, Cost, GOOD, GOODS, GoodId, START_GOODS, START_MONEY, TIERS,
} from './data';
import { MAP_SIZE, T, generateIsland, rng } from './world';

export type Status = 'ok' | 'keinWeg' | 'rohstoff' | 'lagerVoll' | 'keinWald' | 'keinWasser' | 'wohnen';

export interface Building {
  id: number;
  type: BuildingId;
  x: number;
  y: number;
  // Produktion
  progress: number;
  loaded: boolean;
  eff: number;
  status: Status;
  missing: GoodId[];
  active: number;
  // Wohnhaus
  tier: number;
  residents: number;
  need: Partial<Record<GoodId, number>>;
  demand: Partial<Record<GoodId, number>>;
  short: Partial<Record<GoodId, boolean>>;
  happy: number;
  growT: number;
  upT: number;
}

export interface SaveData {
  v: 1;
  seed: number;
  size: number;
  tiles: string;
  roads: string;
  buildings: Building[];
  nextId: number;
  money: number;
  goods: Record<GoodId, number>;
  time: number;
  quest: number;
}

export interface GameEvents {
  added(b: Building): void;
  removed(b: Building): void;
  changed(b: Building): void;
  roads(): void;
  trees(): void;
  message(text: string, kind?: 'info' | 'good' | 'bad'): void;
}

export interface Check { ok: boolean; reason?: string }

const LAGER: BuildingId[] = ['kontor', 'markt'];
const SAVE_KEY = 'neue-ufer-save-v2';

export class Game {
  seed = 1;
  size = MAP_SIZE;
  tiles: Uint8Array = new Uint8Array(0);
  roads: Uint8Array = new Uint8Array(0);
  occ = new Int32Array(0); // Gebäude-ID pro Kachel (0 = frei)
  buildings: Building[] = [];
  byId = new Map<number, Building>();
  nextId = 1;
  money = 0;
  goods = {} as Record<GoodId, number>;
  time = 0;
  quest = 0;
  speed = 1;

  // abgeleitete Werte (werden bei Änderungen neu berechnet)
  area: Uint8Array = new Uint8Array(0);
  roadLinked: Uint8Array = new Uint8Array(0);
  linked = new Set<number>();
  coverage = new Map<number, Set<BuildingId>>();
  capacity = 0;

  ev: GameEvents = {
    added() {}, removed() {}, changed() {}, roads() {}, trees() {}, message() {},
  };

  // ---------- Erstellen / Laden ----------

  static create(seed: number): Game {
    const g = new Game();
    let s = seed;
    for (let attempt = 0; attempt < 30; attempt++, s++) {
      const tiles = generateIsland(s);
      let berg = 0, wald = 0, land = 0;
      for (const t of tiles) { if (t === T.Berg) berg++; if (t === T.Wald) wald++; if (t !== T.Wasser) land++; }
      if (berg >= 6 && wald >= 80 && land >= 900) { g.tiles = tiles; break; }
      g.tiles = tiles;
    }
    g.seed = s;
    g.roads = new Uint8Array(g.size * g.size);
    g.occ = new Int32Array(g.size * g.size);
    g.money = START_MONEY;
    for (const gd of GOODS) g.goods[gd.id] = START_GOODS[gd.id] ?? 0;
    g.placeKontor();
    g.recompute();
    return g;
  }

  static fromSave(d: SaveData): Game {
    const g = new Game();
    g.seed = d.seed;
    g.size = d.size;
    g.tiles = Uint8Array.from(d.tiles, (c) => c.charCodeAt(0) - 48);
    g.roads = Uint8Array.from(d.roads, (c) => c.charCodeAt(0) - 48);
    g.occ = new Int32Array(g.size * g.size);
    g.nextId = d.nextId;
    g.money = d.money;
    g.goods = {} as Record<GoodId, number>;
    for (const gd of GOODS) g.goods[gd.id] = d.goods[gd.id] ?? 0;
    g.time = d.time;
    g.quest = d.quest;
    for (const b of d.buildings) {
      if (!BUILDINGS[b.type]) continue;
      g.buildings.push(b);
      g.byId.set(b.id, b);
      g.stamp(b, b.id);
    }
    g.recompute();
    return g;
  }

  serialize(): SaveData {
    return {
      v: 1, seed: this.seed, size: this.size,
      tiles: String.fromCharCode(...Array.from(this.tiles, (t) => t + 48)),
      roads: String.fromCharCode(...Array.from(this.roads, (t) => t + 48)),
      buildings: this.buildings, nextId: this.nextId, money: this.money,
      goods: this.goods, time: this.time, quest: this.quest,
    };
  }

  save(): boolean {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize()));
      return true;
    } catch {
      return false;
    }
  }

  static load(): Game | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw) as SaveData;
      if (d.v !== 1) return null;
      return Game.fromSave(d);
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
  def(b: Building): BuildingDef { return BUILDINGS[b.type]; }
  center(b: Building): [number, number] { const s = BUILDINGS[b.type].size; return [b.x + s / 2, b.y + s / 2]; }
  count(type: BuildingId, onlyLinked = false) {
    let n = 0;
    for (const b of this.buildings) if (b.type === type && (!onlyLinked || this.linked.has(b.id))) n++;
    return n;
  }
  population() { let n = 0; for (const b of this.buildings) if (b.type === 'haus') n += b.residents; return n; }
  popByTier(): number[] {
    const r = [0, 0, 0];
    for (const b of this.buildings) if (b.type === 'haus') r[b.tier] += b.residents;
    return r;
  }
  housesByTier(): number[] {
    const r = [0, 0, 0];
    for (const b of this.buildings) if (b.type === 'haus') r[b.tier]++;
    return r;
  }
  buildingAt(x: number, y: number): Building | undefined {
    if (!this.inMap(x, y)) return undefined;
    const id = this.occ[this.idx(x, y)];
    return id ? this.byId.get(id) : undefined;
  }

  private stamp(b: Building, val: number) {
    const s = BUILDINGS[b.type].size;
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) this.occ[this.idx(b.x + i, b.y + j)] = val;
  }

  private newBuilding(type: BuildingId, x: number, y: number): Building {
    return {
      id: this.nextId++, type, x, y, progress: 0, loaded: false, eff: 1, status: 'ok', missing: [], active: 0,
      tier: 0, residents: type === 'haus' ? 1 : 0, need: { nahrung: 1 }, demand: {}, short: {}, happy: 0.7, growT: 0, upT: 0,
    };
  }

  private placeKontor() {
    const s = 3;
    let best: [number, number] | null = null;
    let bestScore = -1;
    for (let y = 3; y < this.size - 6; y++) {
      for (let x = 3; x < this.size - 6; x++) {
        let ok = true;
        for (let j = 0; j < s && ok; j++) for (let i = 0; i < s && ok; i++) {
          const t = this.tile(x + i, y + j);
          if (t === T.Wasser || t === T.Berg) ok = false;
        }
        if (!ok) continue;
        let water = 0;
        for (let k = 0; k < s; k++) {
          if (this.tile(x + k, y - 1) === T.Wasser) water++;
          if (this.tile(x + k, y + s) === T.Wasser) water++;
          if (this.tile(x - 1, y + k) === T.Wasser) water++;
          if (this.tile(x + s, y + k) === T.Wasser) water++;
        }
        if (water < 3) continue;
        let land = 0;
        const cx = x + 1.5, cy = y + 1.5;
        for (let j = -11; j <= 11; j++) for (let i = -11; i <= 11; i++) {
          if (i * i + j * j > 121) continue;
          const t = this.tile(Math.floor(cx + i), Math.floor(cy + j));
          if (t === T.Gras || t === T.Wald || t === T.Sand) land++;
        }
        if (land > bestScore) { bestScore = land; best = [x, y]; }
      }
    }
    const [x, y] = best ?? [this.size / 2, this.size / 2];
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
      const k = this.idx(x + i, y + j);
      if (this.tiles[k] === T.Wald || this.tiles[k] === T.Wasser) this.tiles[k] = T.Sand;
    }
    const b = this.newBuilding('kontor', x, y);
    b.residents = 0;
    this.buildings.push(b);
    this.byId.set(b.id, b);
    this.stamp(b, b.id);
  }

  kontor(): Building | undefined { return this.buildings.find((b) => b.type === 'kontor'); }

  // ---------- abgeleitete Werte ----------

  recompute() {
    const N = this.size;
    // Baubereich
    this.area = new Uint8Array(N * N);
    this.capacity = 0;
    for (const b of this.buildings) {
      const d = this.def(b);
      if (d.storage) this.capacity += d.storage;
      if (!LAGER.includes(b.type) || !d.radius) continue;
      const [cx, cy] = this.center(b);
      const r = d.radius;
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          if (!this.inMap(x, y)) continue;
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
          if (dx * dx + dy * dy <= r * r) this.area[this.idx(x, y)] = 1;
        }
      }
    }
    // Wegnetz ab Kontor/Markt
    this.roadLinked = new Uint8Array(N * N);
    const stack: number[] = [];
    for (const b of this.buildings) {
      if (!LAGER.includes(b.type)) continue;
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
        if (this.roadLinked[k] || (other && LAGER.includes(other.type))) { this.linked.add(b.id); break; }
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
        const [sx, sy] = this.center(s);
        const r = this.def(s).radius ?? 0;
        if ((hx - sx) ** 2 + (hy - sy) ** 2 <= r * r) set.add(s.type);
      }
      this.coverage.set(h.id, set);
    }
    // Standort-Effizienz
    for (const b of this.buildings) b.eff = this.siteEfficiency(b.type, b.x, b.y);
  }

  /** Kacheln direkt rund um ein Gebäude (ohne Ecken) */
  ring(b: { type: BuildingId; x: number; y: number }): [number, number][] {
    const s = BUILDINGS[b.type].size;
    const out: [number, number][] = [];
    for (let k = 0; k < s; k++) {
      out.push([b.x + k, b.y - 1], [b.x + k, b.y + s], [b.x - 1, b.y + k], [b.x + s, b.y + k]);
    }
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
    const full = d.needs === 'wald' ? (type === 'jagdhuette' ? 10 : 14) : 10;
    const cx = x + d.size / 2, cy = y + d.size / 2;
    let n = 0;
    for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) {
      const tx = Math.floor(cx + i), ty = Math.floor(cy + j);
      if ((tx + 0.5 - cx) ** 2 + (ty + 0.5 - cy) ** 2 > 16) continue;
      if (tx >= x && tx < x + d.size && ty >= y && ty < y + d.size) continue;
      if (this.tile(tx, ty) === want) n++;
    }
    return Math.min(1, n / full);
  }

  // ---------- Bauen ----------

  canAfford(c: Cost): Check {
    if ((c.taler ?? 0) > this.money) return { ok: false, reason: 'Zu wenig Taler' };
    for (const k of ['holz', 'werkzeug', 'stein'] as const) {
      if ((c[k] ?? 0) > this.goods[k]) return { ok: false, reason: `Zu wenig ${GOOD[k].name}` };
    }
    return { ok: true };
  }

  private pay(c: Cost, factor = 1) {
    this.money -= (c.taler ?? 0) * factor;
    for (const k of ['holz', 'werkzeug', 'stein'] as const) this.goods[k] -= (c[k] ?? 0) * factor;
  }

  canPlace(type: BuildingId, x: number, y: number): Check {
    const d = BUILDINGS[type];
    const s = d.size;
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
      const tx = x + i, ty = y + j;
      if (!this.inMap(tx, ty)) return { ok: false, reason: 'Außerhalb der Karte' };
      const t = this.tile(tx, ty);
      const k = this.idx(tx, ty);
      if (t === T.Wasser) return { ok: false, reason: 'Nicht auf dem Wasser' };
      if (t === T.Berg) return { ok: false, reason: 'Nicht auf dem Berg' };
      if (this.occ[k] || this.roads[k]) return { ok: false, reason: 'Platz ist belegt' };
      if (!this.area[k]) return { ok: false, reason: 'Außerhalb deines Gebiets – baue einen Marktplatz' };
    }
    if (d.needs === 'wasser') {
      let w = 0;
      for (const [rx, ry] of this.ring({ type, x, y })) if (this.tile(rx, ry) === T.Wasser) w++;
      if (w < 2) return { ok: false, reason: 'Muss direkt am Wasser stehen' };
    }
    if (d.needs === 'berg' && this.siteEfficiency(type, x, y) === 0) return { ok: false, reason: 'Muss direkt am Berg stehen' };
    return this.canAfford(d.cost);
  }

  place(type: BuildingId, x: number, y: number): Check {
    const c = this.canPlace(type, x, y);
    if (!c.ok) return c;
    const d = BUILDINGS[type];
    this.pay(d.cost);
    let treesChanged = false;
    for (let j = 0; j < d.size; j++) for (let i = 0; i < d.size; i++) {
      const k = this.idx(x + i, y + j);
      if (this.tiles[k] === T.Wald) { this.tiles[k] = T.Gras; treesChanged = true; }
    }
    const b = this.newBuilding(type, x, y);
    this.buildings.push(b);
    this.byId.set(b.id, b);
    this.stamp(b, b.id);
    this.recompute();
    if (treesChanged) this.ev.trees();
    this.ev.added(b);
    return { ok: true };
  }

  canRoad(x: number, y: number): Check {
    if (!this.inMap(x, y)) return { ok: false, reason: 'Außerhalb der Karte' };
    const k = this.idx(x, y);
    const t = this.tiles[k];
    if (t === T.Wasser || t === T.Berg) return { ok: false, reason: 'Hier geht kein Weg' };
    if (this.roads[k] || this.occ[k]) return { ok: false, reason: 'Platz ist belegt' };
    if (!this.area[k]) return { ok: false, reason: 'Außerhalb deines Gebiets' };
    if (this.money < (BUILDINGS.weg.cost.taler ?? 0)) return { ok: false, reason: 'Zu wenig Taler' };
    return { ok: true };
  }

  /** Baut Wege auf allen gültigen Feldern; gibt Anzahl zurück */
  placeRoads(cells: [number, number][]): number {
    let n = 0;
    let trees = false;
    let lastReason = '';
    for (const [x, y] of cells) {
      const c = this.canRoad(x, y);
      if (!c.ok) { lastReason = c.reason ?? ''; continue; }
      const k = this.idx(x, y);
      if (this.tiles[k] === T.Wald) { this.tiles[k] = T.Gras; trees = true; }
      this.roads[k] = 1;
      this.money -= BUILDINGS.weg.cost.taler ?? 0;
      n++;
    }
    if (n) { this.recompute(); this.ev.roads(); }
    if (trees) this.ev.trees();
    if (!n && lastReason && cells.length === 1) this.ev.message(lastReason, 'bad');
    return n;
  }

  demolish(x: number, y: number): boolean {
    if (!this.inMap(x, y)) return false;
    const k = this.idx(x, y);
    if (this.roads[k]) {
      this.roads[k] = 0;
      this.recompute();
      this.ev.roads();
      return true;
    }
    const b = this.buildingAt(x, y);
    if (!b) return false;
    if (b.type === 'kontor') { this.ev.message('Das Kontor kann nicht abgerissen werden', 'bad'); return false; }
    this.removeBuilding(b);
    return true;
  }

  removeBuilding(b: Building) {
    if (b.type === 'kontor') return;
    const d = this.def(b);
    // Hälfte des Baumaterials zurück
    for (const k of ['holz', 'werkzeug', 'stein'] as const) {
      this.goods[k] = Math.min(this.goods[k] + Math.floor((d.cost[k] ?? 0) / 2), Math.max(this.capacity, this.goods[k]));
    }
    this.stamp(b, 0);
    this.buildings = this.buildings.filter((o) => o !== b);
    this.byId.delete(b.id);
    this.recompute();
    this.ev.removed(b);
  }

  // ---------- Simulation ----------

  incomePerMinute(): { tax: number; upkeep: number } {
    let tax = 0, upkeep = 0;
    for (const b of this.buildings) {
      upkeep += this.def(b).upkeep;
      if (b.type === 'haus') tax += b.residents * TIERS[b.tier].tax * (0.4 + 0.6 * b.happy);
    }
    return { tax, upkeep };
  }

  tick(dt: number) {
    this.time += dt;
    for (const b of this.buildings) {
      if (b.type === 'haus') this.tickHouse(b, dt);
      else if (this.def(b).prod) this.tickProduction(b, dt);
    }
    const { tax, upkeep } = this.incomePerMinute();
    this.money += ((tax - upkeep) / 60) * dt;
    this.checkQuest();
  }

  private tickProduction(b: Building, dt: number) {
    const p = this.def(b).prod!;
    let working = false;
    b.missing = [];
    if (!this.linked.has(b.id)) b.status = 'keinWeg';
    else if (b.eff <= 0) b.status = this.def(b).needs === 'wasser' ? 'keinWasser' : 'keinWald';
    else if (this.goods[p.output] >= this.capacity) b.status = 'lagerVoll';
    else {
      if (!b.loaded) {
        const inp = p.input ?? {};
        for (const [g, n] of Object.entries(inp) as [GoodId, number][]) if (this.goods[g] < n) b.missing.push(g);
        if (!b.missing.length) {
          for (const [g, n] of Object.entries(inp) as [GoodId, number][]) this.goods[g] -= n;
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
          this.goods[p.output] = Math.min(this.capacity, this.goods[p.output] + (p.amount ?? 1));
        }
      } else b.status = 'rohstoff';
    }
    b.active += ((working ? 1 : 0) - b.active) * Math.min(1, dt * 0.1);
  }

  private tickHouse(h: Building, dt: number) {
    const tier = TIERS[h.tier];
    h.status = 'wohnen';
    let goodsSum = 0, goodsN = 0;
    for (const [g, rate] of Object.entries(tier.consumes) as [GoodId, number][]) {
      h.demand[g] = Math.min(2, (h.demand[g] ?? 0) + (h.residents * rate * dt) / 60);
      while ((h.demand[g] ?? 0) >= 1) {
        if (this.goods[g] >= 1) { this.goods[g] -= 1; h.demand[g]! -= 1; h.short[g] = false; }
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
        this.pay(TIERS[h.tier + 1].upgradeCost);
        h.tier++;
        h.upT = 0;
        for (const g of Object.keys(TIERS[h.tier].consumes) as GoodId[]) if (h.need[g] === undefined) h.need[g] = 1;
        this.ev.changed(h);
        if (this.housesByTier()[h.tier] === 1) this.ev.message(`Deine ersten ${TIERS[h.tier].name} sind eingezogen! 🎉`, 'good');
      }
    } else h.upT = 0;
  }

  /** Warum steigt dieses Haus (noch) nicht auf? null = es steigt gerade auf */
  upgradeBlocker(h: Building): string | null {
    if (h.tier >= TIERS.length - 1) return 'Höchste Stufe erreicht';
    const tier = TIERS[h.tier];
    const next = TIERS[h.tier + 1];
    if (h.residents < tier.maxResidents) return `Haus noch nicht voll (${h.residents}/${tier.maxResidents})`;
    if (h.happy < 0.9) return 'Bewohner noch nicht zufrieden genug';
    const cov = this.coverage.get(h.id) ?? new Set();
    for (const s of next.services) if (!cov.has(s)) return `${BUILDINGS[s].name} in der Nähe fehlt`;
    for (const g of Object.keys(next.consumes) as GoodId[]) {
      if (!(g in tier.consumes) && this.goods[g] < 1) return `${GOOD[g].name} fehlt im Lager`;
    }
    const c = this.canAfford(next.upgradeCost);
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

export const QUESTS: Quest[] = [
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
    done: (g) => done(g, ['schweinezucht', 'fleischerei']) === 2,
    progress: (g) => `${done(g, ['schweinezucht', 'fleischerei'])}/2`, reward: 600 },
  { title: 'Bier für die Bürger', hint: 'Bürger wollen Bier und ein Wirtshaus: Getreidefarm → Brauerei, dazu ein Wirtshaus.',
    done: (g) => done(g, ['getreidefarm', 'brauerei']) === 2 && g.count('wirtshaus') >= 1,
    progress: (g) => `${done(g, ['getreidefarm', 'brauerei']) + Math.min(1, g.count('wirtshaus'))}/3`, reward: 1000 },
  { title: 'Stolze Bürger', hint: 'Lass deine Stadt wachsen: 100 Bürger.',
    done: (g) => g.popByTier()[2] >= 100, progress: (g) => `${Math.min(g.popByTier()[2], 100)}/100`, reward: 2000 },
];

export function newSeed(): number {
  return Math.floor(rng(Date.now() % 100000)() * 1e9);
}
