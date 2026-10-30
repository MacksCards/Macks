// Inselgenerator: erzeugt aus einem Startwert (Seed) eine zufällige Insel.

export enum T { Wasser = 0, Sand = 1, Gras = 2, Wald = 3, Berg = 4 }

export const MAP_SIZE = 64;

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

function valueNoise(seed: number, size: number, cell: number): (x: number, y: number) => number {
  const r = rng(seed);
  const n = Math.ceil(size / cell) + 2;
  const g = new Float32Array(n * n).map(() => r());
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / cell, fy = y / cell;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = s(fx - ix), ty = s(fy - iy);
    const v = (i: number, j: number) => g[(j % n) * n + (i % n)];
    const a = v(ix, iy) * (1 - tx) + v(ix + 1, iy) * tx;
    const b = v(ix, iy + 1) * (1 - tx) + v(ix + 1, iy + 1) * tx;
    return a * (1 - ty) + b * ty;
  };
}

export function generateIsland(seed: number, size = MAP_SIZE): Uint8Array {
  const tiles = new Uint8Array(size * size);
  const n1 = valueNoise(seed, size, 12);
  const n2 = valueNoise(seed + 1, size, 6);
  const n3 = valueNoise(seed + 2, size, 3);
  const wood = valueNoise(seed + 7, size, 7);
  const r = rng(seed + 99);
  const c = size / 2;
  // Berge: 1–2 Zentren auf dem Land
  const peaks: [number, number, number][] = [];
  const peakCount = 1 + (r() < 0.6 ? 1 : 0);
  for (let i = 0; i < peakCount; i++) {
    const ang = r() * Math.PI * 2;
    const dist = 6 + r() * 9;
    peaks.push([c + Math.cos(ang) * dist, c + Math.sin(ang) * dist, 2.6 + r() * 1.6]);
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - c) / (size * 0.42), dy = (y - c) / (size * 0.42);
      const d = Math.sqrt(dx * dx + dy * dy);
      const h = n1(x, y) * 0.55 + n2(x, y) * 0.3 + n3(x, y) * 0.15;
      const land = h + 0.62 - d * 1.05;
      let t = T.Wasser;
      if (land > 0.18) t = T.Gras;
      if (t === T.Gras) {
        for (const [px, py, pr] of peaks) {
          const pd = Math.hypot(x - px, y - py) + n3(x, y) * 2.2;
          if (pd < pr) t = T.Berg;
        }
        if (t === T.Gras && wood(x, y) > 0.52) t = T.Wald;
      }
      tiles[y * size + x] = t;
    }
  }
  // Rand der Karte immer Wasser
  for (let i = 0; i < size; i++) {
    for (const k of [0, 1, 2, size - 3, size - 2, size - 1]) {
      tiles[k * size + i] = T.Wasser;
      tiles[i * size + k] = T.Wasser;
    }
  }
  // Kleine Seen/Inselchen entfernen: nur die größte Landmasse behalten
  keepLargestLand(tiles, size);
  // Strand: Land direkt am Wasser
  const copy = tiles.slice();
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const t = copy[y * size + x];
      if (t === T.Wasser || t === T.Berg) continue;
      let coast = false;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (copy[(y + j) * size + x + i] === T.Wasser) coast = true;
      if (coast) tiles[y * size + x] = T.Sand;
    }
  }
  return tiles;
}

function keepLargestLand(tiles: Uint8Array, size: number) {
  const label = new Int32Array(size * size).fill(-1);
  let best = -1, bestCount = 0, cur = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === T.Wasser || label[i] >= 0) continue;
    let count = 0;
    const stack = [i];
    label[i] = cur;
    while (stack.length) {
      const k = stack.pop()!;
      count++;
      const x = k % size, y = (k / size) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const nk = ny * size + nx;
        if (tiles[nk] !== T.Wasser && label[nk] < 0) { label[nk] = cur; stack.push(nk); }
      }
    }
    if (count > bestCount) { bestCount = count; best = cur; }
    cur++;
  }
  for (let i = 0; i < tiles.length; i++) if (tiles[i] !== T.Wasser && label[i] !== best) tiles[i] = T.Wasser;
}
