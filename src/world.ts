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
  /** Vorkommen im Berg: Erz (Tonnen, was die Erzmine noch fördern kann) und Gold (1 = vorhanden), 0 = keins */
  erz: number;
  gold: number;
  land: number; // Anzahl Landkacheln
  /** Erz zu Spielbeginn (Tonnen); 0 = die Insel hatte nie Erz */
  erzStart: number;
  /** Rest für die tiefe Erzmine (Tonnen): sie baut weiter ab, bis insgesamt 3 × die Startmenge gefördert ist */
  erzDeep: number;
  /** unerschöpfliches Erzvorkommen (etwa jedes siebte): Erzmine und tiefe Mine leeren es nie */
  erzEndlos?: boolean;
  /** Heimatinsel des Spielers: nahe am Start, groß genug, mit Erz und mindestens einer Pflanze auf 100 % */
  heimat?: boolean;
}

export interface World {
  size: number;
  tiles: Uint8Array;
  island: Int16Array; // Insel-ID je Kachel, -1 = Meer
  islands: Island[];
  /** Startpunkte im Meer (Spieler + Konkurrenten) */
  starts: [number, number][];
}

export const WORLD_SIZE = 240;
/** Wählbare Weltgrößen (Felder je Seite). Vorerst nur eine; mehr kommen nach der Leistungsarbeit. */
export const WORLD_SIZES: readonly number[] = [WORLD_SIZE];
/** Anteil der Erzvorkommen, die nie leer werden */
const ERZ_ENDLOS = 0.15;

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

/**
 * Welt aus der Startzahl erzeugen. legacy = so, wie Spielstände bis Version 3 ihre Inseln bekamen
 * (dieselbe Landschaft, aber die alte Startinsel-Regel, kein Gold-Ausgleich, keine endlosen Vorkommen).
 */
export function generateWorld(seed: number, size = WORLD_SIZE, legacy = false): World {
  const r = rng(seed);
  const tiles = new Uint8Array(size * size);
  const island = new Int16Array(size * size).fill(-1);
  const islands: Island[] = [];
  const margin = 14;
  // Startecken für Schiffe (im freien Meer)
  const starts: [number, number][] = [[8, size - 9], [size - 9, size - 9], [size - 9, 8], [8, 8]];

  // Inselzentren platzieren: erst große, dann mittlere, dann kleine
  const plan: { r: number; g: Island['groesse'] }[] = [];
  // Größen so, dass jede Insel eine echte Siedlung trägt (Mindestgröße wird unten geprüft)
  for (let i = 0; i < 3; i++) plan.push({ r: 27 + r() * 7, g: 'gross' });
  for (let i = 0; i < 6; i++) plan.push({ r: 17 + r() * 5, g: 'mittel' });
  for (let i = 0; i < 5; i++) plan.push({ r: 12 + r() * 2.5, g: 'klein' });
  const centers: { x: number; y: number; r: number; g: Island['groesse'] }[] = [];
  for (const p of plan) {
    for (let tries = 0; tries < 300; tries++) {
      const x = margin + p.r + r() * (size - 2 * margin - 2 * p.r);
      const y = margin + p.r + r() * (size - 2 * margin - 2 * p.r);
      const ok = centers.every((c) => Math.hypot(c.x - x, c.y - y) > c.r + p.r + 7)
        && starts.every(([sx, sy]) => Math.hypot(sx - x, sy - y) > p.r * 1.3 + 10);
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
      if (d < 0.68 + n * 0.55 && island[y * size + x] < 0) {
        const k = y * size + x;
        island[k] = id; tiles[k] = T.Gras; cells.push(k);
      }
    }
    // Berge: große/mittlere Inseln meist, kleine manchmal (dafür eher mit Gold)
    const peaks = c.g === 'gross' ? 2 + (r() < 0.5 ? 1 : 0) : c.g === 'mittel' ? 1 + (r() < 0.3 ? 1 : 0) : (r() < 0.75 ? 1 : 0);
    const peakPos: [number, number, number][] = [];
    for (let i = 0; i < peaks; i++) {
      const ang = r() * Math.PI * 2, dist = rad * (0.15 + r() * 0.35);
      peakPos.push([c.x + Math.cos(ang) * dist, c.y + Math.sin(ang) * dist, c.g === 'klein' ? 2.6 + r() : c.g === 'mittel' ? 3.2 + r() * 1.6 : 4 + r() * 2.5]);
    }
    for (const k of cells) {
      const x = k % size, y = (k / size) | 0;
      for (const [px, py, pr] of peakPos) if (Math.hypot(x + 0.5 - px, y + 0.5 - py) + shapeB(x * 2, y * 2) * 1.5 < pr) tiles[k] = T.Berg;
      if (tiles[k] === T.Gras && woodN(x + id * 13, y) > 0.5) tiles[k] = T.Wald;
    }
    const isl: Island = {
      id, name: NAMEN[id % NAMEN.length], x0, y0, x1, y1, cx: c.x, cy: c.y, groesse: c.g,
      klima: c.y < size / 2 ? 'nord' : 'sued', frucht: {}, erz: 0, gold: 0, land: cells.length, erzStart: 0, erzDeep: 0,
    };
    // Fruchtbarkeit: 2–3 Pflanzen des eigenen Klimas, selten eine fremde mit 50 %
    const own = (Object.keys(PFLANZEN) as Pflanze[]).filter((p) => PFLANZEN[p].klima === isl.klima);
    const other = (Object.keys(PFLANZEN) as Pflanze[]).filter((p) => PFLANZEN[p].klima !== isl.klima);
    const n = c.g === 'gross' ? 1 + (r() < 0.4 ? 1 : 0) : c.g === 'mittel' ? 2 : 2 + (r() < 0.6 ? 1 : 0);
    const full = c.g === 'gross' ? 0.3 : c.g === 'mittel' ? 0.55 : 0.85; // Chance auf 100 %
    own.sort(() => r() - 0.5).slice(0, n).forEach((p, i) => { isl.frucht[p] = (i === 0 && c.g !== 'gross') || r() < full ? 100 : 50; });
    if (r() < (c.g === 'klein' ? 0.4 : 0.2)) isl.frucht[other[Math.floor(r() * other.length)]] = 50;
    // Vorkommen im Berg
    if (peaks > 0) {
      const goldChance = c.g === 'klein' ? 0.5 : c.g === 'mittel' ? 0.15 : 0.04;
      if (r() < goldChance) isl.gold = 1;
      else if (r() < 0.7) isl.erz = r() < 0.5 ? 240 : 80;
    }
    islands.push(isl);
  });

  // Mindestgröße: Inseln, die zu klein geraten sind, verschwinden wieder
  const MIN = { klein: 320, mittel: 650, gross: 1500 } as const;
  for (const isl of islands) {
    let n = 0;
    for (let y = isl.y0; y <= isl.y1; y++) for (let x = isl.x0; x <= isl.x1; x++) if (island[y * size + x] === isl.id) n++;
    if (n < MIN[isl.groesse]) {
      for (let y = isl.y0; y <= isl.y1; y++) for (let x = isl.x0; x <= isl.x1; x++) {
        const k = y * size + x;
        if (island[k] === isl.id) { island[k] = -1; tiles[k] = T.Wasser; }
      }
      isl.land = 0;
    }
  }

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
  // entfernte Inseln aus der Liste nehmen und IDs neu vergeben
  const keep = islands.filter((i) => i.land > 0);
  const remap = new Map(keep.map((i, n) => [i.id, n]));
  for (let k = 0; k < island.length; k++) if (island[k] >= 0) island[k] = remap.get(island[k]) ?? -1;
  keep.forEach((i, n) => { i.id = n; i.name = NAMEN[n % NAMEN.length]; });
  islands.length = 0;
  islands.push(...keep);
  const hasBerg = (i: Island) => { for (let y = i.y0; y <= i.y1; y++) for (let x = i.x0; x <= i.x1; x++) if (island[y * size + x] === i.id && tiles[y * size + x] === T.Berg) return true; return false; };
  for (const i of islands) if (!hasBerg(i)) { i.erz = 0; i.gold = 0; }
  // Ab hier nur noch Eigenschaften der Inseln (keine Kacheln mehr) – mit eigenem Zufall,
  // damit die Landschaft für dieselbe Startzahl genau gleich bleibt wie früher.
  if (legacy) legacyIslands(islands, starts[0], hasBerg);
  else finishIslands(islands, starts[0], hasBerg, rng(seed + 9001));
  return { size, tiles, island, islands, starts };
}

/** alte Regel (bis Spielstand-Version 3): die nächste mittlere/große Berginsel bekommt Erz, wenn sie weder Erz noch Gold hat */
function legacyIslands(islands: Island[], [sx, sy]: [number, number], hasBerg: (i: Island) => boolean) {
  const near = islands.filter((i) => i.groesse !== 'klein' && hasBerg(i)).sort((p, q) => Math.hypot(p.cx - sx, p.cy - sy) - Math.hypot(q.cx - sx, q.cy - sy))[0];
  if (near && !near.erz && !near.gold) near.erz = 240;
  if (near) near.heimat = true;
  for (const i of islands) { i.erzStart = i.erz; i.erzDeep = i.erz * 2; }
}

/**
 * Heimatinsel, Gold-Garantie und Erzmengen festlegen.
 * Heimat = die nächste mittlere oder große Insel mit Berg; sie hat sicher Erz (sonst bekommt sie ein
 * großes Vorkommen, ein Goldvorkommen dort wandert dann auf eine kleine Insel) und mindestens eine
 * Pflanze auf 100 %. Gibt es nirgends Gold, bekommt eine kleine Berginsel welches.
 */
function finishIslands(islands: Island[], [sx, sy]: [number, number], hasBerg: (i: Island) => boolean, r: () => number) {
  const far = (i: Island) => Math.hypot(i.cx - sx, i.cy - sy);
  const cands = islands.filter((i) => i.groesse !== 'klein' && hasBerg(i)).sort((p, q) => far(p) - far(q));
  let home: Island | undefined = cands[0];
  if (home && !home.erz) { home.erz = 240; home.gold = 0; }
  home ??= islands.filter((i) => i.groesse !== 'klein').sort((p, q) => far(p) - far(q))[0] ?? islands.slice().sort((p, q) => far(p) - far(q))[0];
  if (home) {
    home.heimat = true;
    if (!Object.values(home.frucht).some((v) => v === 100)) {
      // die beste vorhandene Pflanze des eigenen Klimas auf 100 % – sonst eine neue
      const own = (Object.keys(PFLANZEN) as Pflanze[]).filter((p) => PFLANZEN[p].klima === home!.klima);
      const have = own.filter((p) => (home!.frucht[p] ?? 0) > 0);
      const pick = have.length ? have[0] : own[Math.floor(r() * own.length)];
      home.frucht[pick] = 100;
    }
  }
  // Gold-Garantie: ohne Gold gäbe es keinen Schmuck (nur teuer beim Händler)
  if (!islands.some((i) => i.gold)) {
    const small = islands.filter((i) => i !== home && hasBerg(i));
    const pool = [small.filter((i) => i.groesse === 'klein' && !i.erz), small.filter((i) => i.groesse === 'klein'), small].find((l) => l.length) ?? [];
    const g = pool[Math.floor(r() * pool.length)];
    if (g) { g.gold = 1; g.erz = 0; }
  }
  // Erzmengen: die tiefe Mine baut danach noch das Doppelte ab; manche Vorkommen werden nie leer
  for (const i of islands) {
    i.erzStart = i.erz;
    i.erzDeep = i.erz * 2;
    if (i.erz > 0 && r() < ERZ_ENDLOS) i.erzEndlos = true;
  }
}

/** Kurzer Text zu den Vorkommen im Berg */
export function depositText(i: Island): string {
  if (i.gold) return 'Gold ⭐';
  const big = (i.erzStart || i.erz) >= 200 ? 'groß' : 'klein';
  if (i.erzEndlos && (i.erzStart || i.erz)) return 'Erz (unerschöpflich)';
  if (i.erz > 0) return `Erz (${big}, noch ${Math.floor(i.erz)} t)`;
  if (i.erzStart > 0) return i.erzDeep > 0 ? 'Erz (oben erschöpft)' : 'Erz (erschöpft)';
  return 'keins';
}
