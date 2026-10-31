// Wegsuche für Schiffe über das Meer (A*-Suche auf dem Kachelraster, 8 Richtungen).

/**
 * Befahrbarkeit mit Nebel: ist seen angegeben, gelten unentdeckte Felder (seen[k] = 0) als Wasser.
 * So verrät der Kurs nichts über Inseln, die der Spieler noch nicht kennt.
 */
export function seaPass(isWater: (k: number) => boolean, seen?: ArrayLike<number>): (k: number) => boolean {
  return seen ? (k) => !seen[k] || isWater(k) : isWater;
}

/**
 * Kürzester Seeweg von (sx, sy) nach (tx, ty), geglättet. null = nicht erreichbar.
 * seen: Nebel-Option (unentdeckte Felder gelten als befahrbar, siehe seaPass).
 */
export function findSeaPath(
  size: number, isWater: (k: number) => boolean,
  sx: number, sy: number, tx: number, ty: number, maxNodes = 40000, seen?: ArrayLike<number>,
): [number, number][] | null {
  const start = sy * size + sx, goal = ty * size + tx;
  isWater = seaPass(isWater, seen);
  if (!isWater(goal)) return null;
  const g = new Float32Array(size * size).fill(Infinity);
  const from = new Int32Array(size * size).fill(-1);
  const closed = new Uint8Array(size * size);
  // einfacher Binärheap
  const heap: number[] = [], prio: number[] = [];
  const push = (k: number, p: number) => {
    heap.push(k); prio.push(p);
    let i = heap.length - 1;
    while (i > 0) {
      const pa = (i - 1) >> 1;
      if (prio[pa] <= prio[i]) break;
      [heap[pa], heap[i]] = [heap[i], heap[pa]]; [prio[pa], prio[i]] = [prio[i], prio[pa]]; i = pa;
    }
  };
  const pop = () => {
    const top = heap[0];
    const lk = heap.pop()!, lp = prio.pop()!;
    if (heap.length) {
      heap[0] = lk; prio[0] = lp;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < heap.length && prio[l] < prio[m]) m = l;
        if (r < heap.length && prio[r] < prio[m]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; [prio[m], prio[i]] = [prio[i], prio[m]]; i = m;
      }
    }
    return top;
  };
  const h = (k: number) => { const x = k % size, y = (k / size) | 0; const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
  g[start] = 0;
  push(start, h(start));
  let n = 0;
  while (heap.length && n++ < maxNodes) {
    const k = pop();
    if (k === goal) break;
    if (closed[k]) continue;
    closed[k] = 1;
    const x = k % size, y = (k / size) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const nk = ny * size + nx;
      if (!isWater(nk)) continue;
      // keine Abkürzung diagonal über Landecken
      if (dx && dy && (!isWater(y * size + nx) || !isWater(ny * size + x))) continue;
      const cost = g[k] + (dx && dy ? 1.414 : 1);
      if (cost < g[nk]) { g[nk] = cost; from[nk] = k; push(nk, cost + h(nk)); }
    }
  }
  if (from[goal] < 0 && goal !== start) return null;
  return smoothPath(size, isWater, sx, sy, trace(size, from, start, goal));
}

/** Feldmitten von start bis goal aus der Vorgänger-Liste */
function trace(size: number, from: Int32Array, start: number, goal: number): [number, number][] {
  const path: [number, number][] = [];
  for (let k = goal; k !== start && k >= 0; k = from[k]) path.push([k % size + 0.5, ((k / size) | 0) + 0.5]);
  return path.reverse();
}

/** Pfad glätten: Zwischenpunkte auf gerader freier Linie weglassen */
function smoothPath(size: number, isWater: (k: number) => boolean, sx: number, sy: number, path: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let ax = sx + 0.5, ay = sy + 0.5;
  for (let i = 0; i < path.length; i++) {
    const next = path[i + 1];
    if (next && lineFree(size, isWater, ax, ay, next[0], next[1])) continue;
    out.push(path[i]);
    [ax, ay] = path[i];
  }
  return out;
}

/**
 * „So nah wie möglich“: Flächensuche über das Wasser ab dem Schiff. Ziel ist das Feld mit dem
 * kleinsten Wert aus Abstand zum Tippunkt + w × Fahrweg. Gibt den geglätteten Pfad zurück
 * ([] = das Schiff steht schon am besten Platz) oder null, wenn es sich gar nicht bewegen kann.
 */
export function seaReach(
  size: number, isWater: (k: number) => boolean,
  sx: number, sy: number, tx: number, ty: number,
  opts: { w?: number; seen?: ArrayLike<number>; maxNodes?: number } = {},
): [number, number][] | null {
  const pass = seaPass(isWater, opts.seen);
  const w = opts.w ?? 0.5, maxNodes = opts.maxNodes ?? 60000;
  const start = sy * size + sx;
  const g = new Float32Array(size * size).fill(Infinity);
  const from = new Int32Array(size * size).fill(-1);
  const closed = new Uint8Array(size * size);
  const heap: number[] = [], prio: number[] = [];
  const push = (k: number, p: number) => {
    heap.push(k); prio.push(p);
    let i = heap.length - 1;
    while (i > 0) {
      const pa = (i - 1) >> 1;
      if (prio[pa] <= prio[i]) break;
      [heap[pa], heap[i]] = [heap[i], heap[pa]]; [prio[pa], prio[i]] = [prio[i], prio[pa]]; i = pa;
    }
  };
  const pop = () => {
    const top = heap[0];
    const lk = heap.pop()!, lp = prio.pop()!;
    if (heap.length) {
      heap[0] = lk; prio[0] = lp;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < heap.length && prio[l] < prio[m]) m = l;
        if (r < heap.length && prio[r] < prio[m]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; [prio[m], prio[i]] = [prio[i], prio[m]]; i = m;
      }
    }
    return top;
  };
  const score = (k: number) => Math.hypot(k % size + 0.5 - tx, ((k / size) | 0) + 0.5 - ty) + w * g[k];
  g[start] = 0;
  push(start, 0);
  let best = start, bs = score(start), n = 0, moves = 0;
  while (heap.length && n++ < maxNodes) {
    const k = pop();
    if (closed[k]) continue;
    closed[k] = 1;
    // alles Weitere ist mindestens so weit gefahren, dass es nicht mehr besser werden kann
    if (w * g[k] >= bs) break;
    const sk = score(k);
    if (sk < bs) { bs = sk; best = k; }
    const x = k % size, y = (k / size) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const nk = ny * size + nx;
      if (!pass(nk)) continue;
      if (dx && dy && (!pass(y * size + nx) || !pass(ny * size + x))) continue;
      if (k === start) moves++;
      const cost = g[k] + (dx && dy ? 1.414 : 1);
      if (cost < g[nk]) { g[nk] = cost; from[nk] = k; push(nk, cost); }
    }
  }
  if (best === start) return moves ? [] : null;
  return smoothPath(size, pass, sx, sy, trace(size, from, start, best));
}

/** Liegt die Strecke frei auf dem Wasser (mit etwas Abstand zur Küste)? */
export function lineFree(size: number, isWater: (k: number) => boolean, x0: number, y0: number, x1: number, y1: number) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / Math.max(1, steps);
    const x = Math.floor(x0 + (x1 - x0) * t), y = Math.floor(y0 + (y1 - y0) * t);
    if (!isWater(y * size + x)) return false;
    // etwas Abstand zur Küste halten
    for (const [ox, oy] of [[0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]]) {
      const xx = Math.floor(x0 + (x1 - x0) * t + ox), yy = Math.floor(y0 + (y1 - y0) * t + oy);
      if (xx < 0 || yy < 0 || xx >= size || yy >= size || !isWater(yy * size + xx)) return false;
    }
  }
  return true;
}

/** Wegsuche für Soldaten an Land. cost(k) = Aufwand je Feld (Infinity = unpassierbar).
 *  Gibt Feldmitten zurück; das Ziel selbst darf ein „teures“ Feld sein (z. B. ein feindliches Gebäude). */
export function findLandPath(
  size: number, cost: (k: number) => number,
  sx: number, sy: number, tx: number, ty: number, maxNodes = 8000,
): [number, number][] | null {
  const start = sy * size + sx, goal = ty * size + tx;
  if (start === goal) return [];
  const N = size * size;
  const gs = new Map<number, number>();
  const from = new Map<number, number>();
  const closed = new Set<number>();
  const heap: number[] = [], prio: number[] = [];
  const push = (k: number, p: number) => {
    heap.push(k); prio.push(p);
    let i = heap.length - 1;
    while (i > 0) {
      const pa = (i - 1) >> 1;
      if (prio[pa] <= prio[i]) break;
      [heap[pa], heap[i]] = [heap[i], heap[pa]]; [prio[pa], prio[i]] = [prio[i], prio[pa]]; i = pa;
    }
  };
  const pop = () => {
    const top = heap[0];
    const lk = heap.pop()!, lp = prio.pop()!;
    if (heap.length) {
      heap[0] = lk; prio[0] = lp;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < heap.length && prio[l] < prio[m]) m = l;
        if (r < heap.length && prio[r] < prio[m]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; [prio[m], prio[i]] = [prio[i], prio[m]]; i = m;
      }
    }
    return top;
  };
  const h = (k: number) => { const x = k % size, y = (k / size) | 0; const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
  gs.set(start, 0);
  push(start, h(start));
  let n = 0, found = false;
  // bester erreichter Punkt (falls das Ziel nicht erreichbar ist: so nah wie möglich)
  let bestK = start, bestH = h(start);
  while (heap.length && n++ < maxNodes) {
    const k = pop();
    if (k === goal) { found = true; break; }
    if (closed.has(k)) continue;
    closed.add(k);
    const hk = h(k);
    if (hk < bestH) { bestH = hk; bestK = k; }
    const x = k % size, y = (k / size) | 0;
    const gk = gs.get(k)!;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const nk = ny * size + nx;
      if (nk < 0 || nk >= N) continue;
      let c = nk === goal ? Math.min(cost(nk), 50) : cost(nk);
      if (!isFinite(c)) continue;
      if (dx && dy) {
        // nicht diagonal an Hindernissen vorbei quetschen
        if (!isFinite(cost(y * size + nx)) || !isFinite(cost(ny * size + x))) continue;
        c *= 1.414;
      }
      const ng = gk + c;
      if (ng < (gs.get(nk) ?? Infinity)) { gs.set(nk, ng); from.set(nk, k); push(nk, ng + h(nk)); }
    }
  }
  const end = found ? goal : bestK;
  if (end === start) return found ? [] : null;
  const path: [number, number][] = [];
  for (let k = end; k !== start && k !== undefined; k = from.get(k)!) path.push([k % size + 0.5, ((k / size) | 0) + 0.5]);
  path.reverse();
  return path;
}
