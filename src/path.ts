// Wegsuche für Schiffe über das Meer (A*-Suche auf dem Kachelraster, 8 Richtungen).

export function findSeaPath(
  size: number, isWater: (k: number) => boolean,
  sx: number, sy: number, tx: number, ty: number, maxNodes = 40000,
): [number, number][] | null {
  const start = sy * size + sx, goal = ty * size + tx;
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
  const path: [number, number][] = [];
  for (let k = goal; k !== start && k >= 0; k = from[k]) path.push([k % size + 0.5, ((k / size) | 0) + 0.5]);
  path.reverse();
  // Pfad glätten: Zwischenpunkte auf gerader freier Linie weglassen
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

function lineFree(size: number, isWater: (k: number) => boolean, x0: number, y0: number, x1: number, y1: number) {
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
