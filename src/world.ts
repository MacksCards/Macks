// Zufällige Inselwelt wie im Vorbild: viele Inseln verschiedener Größe und Form,
// Klima Nord/Süd, Fruchtbarkeit je Pflanze, Berge mit Stein und manchmal Erz oder Gold.

export enum T { Wasser = 0, Sand = 1, Gras = 2, Wald = 3, Berg = 4 }

export type Klima = 'nord' | 'sued';
export type Pflanze = 'tabak' | 'wein' | 'zuckerrohr' | 'gewuerze' | 'kakao' | 'baumwolle';

export const PFLANZEN: Record<Pflanze, { name: string; icon: string; klima: Klima }> = {
  tabak: { name: 'Tabak', icon: '🍂', klima: 'nord' },
  wein: { name: 'Wein', icon: '🍇', klima: 'nord' },
  zuckerrohr: { name: 'Zuckerrohr', icon: '🎋', klima: 'nord' },
  gewuerze: { name: 'Gewürze', icon: '🌶️', klima: 'sued' },
  kakao: { name: 'Kakao', icon: '🫘', klima: 'sued' },
  baumwolle: { name: 'Baumwolle', icon: '☁️', klima: 'sued' },
};

export interface Island {
  id: number;
  name: string;
  x0: number; y0: number; x1: number; y1: number; // Begrenzung (inklusive)
  cx: number; cy: number;
  groesse: 'klein' | 'mittel' | 'gross';
  klima: Klima;
  /** Fruchtbarkeit in Prozent (0/50/100) */
  frucht: Partial<Record<Pflanze, number>>;
  /** Vorkommen im Berg: Erz (Tonnen) und Gold (1 = vorhanden), 0 = keins */
  erz: number;
  gold: number;
  land: number; // Anzahl Landkacheln
}

export interface World {
  size: number;
  tiles: Uint8Array;
  island: Int16Array; // Insel-ID je Kachel, -1 = Meer
  islands: Island[];
  /** Startpunkte im Meer (Spieler + Konkurrenten) */
  starts: [number, number][];
}

export const WORLD_SIZE = 160;

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueNoise(seed: number, cell: number): (x: number, y: number) => number {
  const r = rng(seed);
  const n = 64;
  const g = new Float32Array(n * n).map(() => r());
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / cell + 1000, fy = y / cell + 1000;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = s(fx - ix), ty = s(fy - iy);
    const v = (i: number, j: number) => g[(((j % n) + n) % n) * n + ((i % n) + n) % n];
    return (v(ix, iy) * (1 - tx) + v(ix + 1, iy) * tx) * (1 - ty) + (v(ix, iy + 1) * (1 - tx) + v(ix + 1, iy + 1) * tx) * ty;
  };
}

const NAMEN = ['Möwenfels', 'Grünhaven', 'Sturmeck', 'Bernsteinhuk', 'Lindholm', 'Salzwiese', 'Kranichsand', 'Eichwerder',
  'Nebelsund', 'Rabenklippe', 'Sonnenhuk', 'Hirschholm', 'Kupferbucht', 'Tangeland', 'Walfisch-Eiland', 'Muschelriff',
  'Falkenstein', 'Seerosenhof', 'Goldküste', 'Ankergrund', 'Wolfsinsel', 'Heringsbank'];

export function generateWorld(seed: number, size = WORLD_SIZE): World {
  const r = rng(seed);
  const tiles = new Uint8Array(size * size);
  const island = new Int16Array(size * size).fill(-1);
  const islands: Island[] = [];
  const margin = 12;
  // Startecken für Schiffe (im freien Meer)
  const starts: [number, number][] = [[7, size - 8], [size - 8, size - 8], [size - 8, 7], [7, 7]];

  // Inselzentren platzieren: erst große, dann mittlere, dann kleine
  const plan: { r: number; g: Island['groesse'] }[] = [];
  for (let i = 0; i < 4; i++) plan.push({ r: 15 + r() * 4, g: 'gross' });
  for (let i = 0; i < 7; i++) plan.push({ r: 9 + r() * 3, g: 'mittel' });
  for (let i = 0; i < 6; i++) plan.push({ r: 5 + r() * 2.5, g: 'klein' });
  const centers: { x: number; y: number; r: number; g: Island['groesse'] }[] = [];
  for (const p of plan) {
    for (let tries = 0; tries < 300; tries++) {
      const x = margin + p.r + r() * (size - 2 * margin - 2 * p.r);
      const y = margin + p.r + r() * (size - 2 * margin - 2 * p.r);
      const ok = centers.every((c) => Math.hypot(c.x - x, c.y - y) > c.r + p.r + 6)
        && starts.every(([sx, sy]) => Math.hypot(sx - x, sy - y) > p.r + 10);
      if (ok) { centers.push({ x, y, ...p }); break; }
    }
  }

  const shapeA = valueNoise(seed + 1, 7);
  const shapeB = valueNoise(seed + 2, 3);
  const woodN = valueNoise(seed + 3, 6);
  centers.forEach((c, id) => {
    const rad = c.r;
    const x0 = Math.max(1, Math.floor(c.x - rad * 1.5)), x1 = Math.min(size - 2, Math.ceil(c.x + rad * 1.5));
    const y0 = Math.max(1, Math.floor(c.y - rad * 1.5)), y1 = Math.min(size - 2, Math.ceil(c.y + rad * 1.5));
    // Form: Kreis, durch Rauschen verformt; leicht gestreckt und gedreht
    const stretch = 0.75 + r() * 0.5, rot = r() * Math.PI;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const cells: number[] = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - c.x, dy = y + 0.5 - c.y;
      const u = (dx * cs + dy * sn) * stretch, v = (-dx * sn + dy * cs) / stretch;
      const d = Math.hypot(u, v) / rad;
      const n = shapeA(x + id * 31, y) * 0.55 + shapeB(x, y + id * 17) * 0.3;
      if (d < 0.62 + n * 0.7 && island[y * size + x] < 0) {
        const k = y * size + x;
        island[k] = id; tiles[k] = T.Gras; cells.push(k);
      }
    }
    // Berge: große/mittlere Inseln meist, kleine manchmal (dafür eher mit Gold)
    const peaks = c.g === 'gross' ? 1 + (r() < 0.6 ? 1 : 0) : c.g === 'mittel' ? (r() < 0.75 ? 1 : 0) : (r() < 0.5 ? 1 : 0);
    const peakPos: [number, number, number][] = [];
    for (let i = 0; i < peaks; i++) {
      const ang = r() * Math.PI * 2, dist = rad * (0.15 + r() * 0.35);
      peakPos.push([c.x + Math.cos(ang) * dist, c.y + Math.sin(ang) * dist, c.g === 'klein' ? 2.2 + r() : 2.8 + r() * 1.8]);
    }
    for (const k of cells) {
      const x = k % size, y = (k / size) | 0;
      for (const [px, py, pr] of peakPos) if (Math.hypot(x + 0.5 - px, y + 0.5 - py) + shapeB(x * 2, y * 2) * 1.5 < pr) tiles[k] = T.Berg;
      if (tiles[k] === T.Gras && woodN(x + id * 13, y) > 0.5) tiles[k] = T.Wald;
    }
    const isl: Island = {
      id, name: NAMEN[id % NAMEN.length], x0, y0, x1, y1, cx: c.x, cy: c.y, groesse: c.g,
      klima: c.y < size / 2 ? 'nord' : 'sued', frucht: {}, erz: 0, gold: 0, land: cells.length,
    };
    // Fruchtbarkeit: 2–3 Pflanzen des eigenen Klimas, selten eine fremde mit 50 %
    const own = (Object.keys(PFLANZEN) as Pflanze[]).filter((p) => PFLANZEN[p].klima === isl.klima);
    const other = (Object.keys(PFLANZEN) as Pflanze[]).filter((p) => PFLANZEN[p].klima !== isl.klima);
    const n = 2 + (r() < (c.g === 'klein' ? 0.6 : 0.35) ? 1 : 0);
    own.sort(() => r() - 0.5).slice(0, n).forEach((p, i) => { isl.frucht[p] = i === 0 || r() < 0.5 ? 100 : 50; });
    if (r() < 0.3) isl.frucht[other[Math.floor(r() * other.length)]] = 50;
    // Vorkommen im Berg
    if (peaks > 0) {
      const goldChance = c.g === 'klein' ? 0.45 : c.g === 'mittel' ? 0.15 : 0.08;
      if (r() < goldChance) isl.gold = 1;
      else if (r() < 0.7) isl.erz = r() < 0.5 ? 240 : 80;
    }
    islands.push(isl);
  });

  // Strand: Land direkt am Wasser
  const copy = tiles.slice();
  for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
    const k = y * size + x;
    if (island[k] < 0 || copy[k] === T.Berg) continue;
    let coast = false;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (island[(y + j) * size + x + i] < 0) coast = true;
    if (coast) tiles[k] = T.Sand;
  }
  // Inselgrenzen auf tatsächliches Land eingrenzen
  for (const isl of islands) {
    let a = size, b = size, c = -1, d = -1, land = 0;
    for (let y = isl.y0; y <= isl.y1; y++) for (let x = isl.x0; x <= isl.x1; x++) {
      if (island[y * size + x] !== isl.id) continue;
      land++; a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y);
    }
    Object.assign(isl, { x0: a, y0: b, x1: c, y1: d, land });
  }
  // Startinsel-Garantie: nahe am Spielerstart eine große/mittlere Insel mit Erz
  const [sx, sy] = starts[0];
  const near = islands.filter((i) => i.groesse !== 'klein').sort((p, q) => Math.hypot(p.cx - sx, p.cy - sy) - Math.hypot(q.cx - sx, q.cy - sy))[0];
  if (near && !near.erz && !near.gold) near.erz = 240;
  return { size, tiles, island, islands, starts };
}

/** Kurzer Text zu den Vorkommen im Berg */
export function depositText(i: Island): string {
  if (i.gold) return 'Gold ⭐';
  if (i.erz) return i.erz >= 200 ? 'Erz (groß)' : 'Erz (klein)';
  return 'keins';
}
