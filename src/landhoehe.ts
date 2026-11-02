// (KL) Sichtbares Land für die Spiellogik: Ist ein Feld im Bild wirklich trockenes Land?
//
// Die Spielwelt kennt nur „Land“ oder „Wasser“ je Feld. Das Bild (src/render/terrain.ts) zeichnet die
// Küste aber weich: Es zeichnet die Land-Felder weich, daher liegen einzelne Landfelder, schmale Zungen und
// winzige Sandbänke im Bild ganz oder halb unter Wasser. Ein Gebäude dort stand halb im Meer.
// Diese Datei rechnet die Höhe des Bodens genau so aus wie terrain.ts (gleiche Weichzeichnung,
// gleiche Meerestiefe, gleiches Rauschen, gleiche Berge) – aber ohne three.js und nur für die
// Felder, nach denen gefragt wird (das Ergebnis wird je Feld gemerkt).
//
// WICHTIG: Ändert sich die Höhenrechnung in src/render/terrain.ts (Konstruktor, „Höhen für die ganze
// Welt“), muss sie hier gleich mitgeändert werden. scripts/kueste-test.ts vergleicht beide.
import { T } from './world';

/** Höhe des flachen Landes (wie LAND_Y in terrain.ts) */
const LAND_Y = 0.3;
/** Gitterpunkte pro Feld (wie RES in terrain.ts) */
const RES = 2;
/**
 * So hoch muss die Feldmitte über dem Wasser liegen, damit sie sicher trocken aussieht (die Wellen heben
 * das Wasser um bis zu etwa 0,07, siehe src/render/water.ts – die Mitte liegt deshalb deutlich darüber).
 */
const RAND_MITTE = 0.06;
/**
 * Mindestens so viel vom Feld muss im Bild über dem Wasser liegen. Gemessen (scripts/kueste-test.ts):
 * Felder an einer geraden oder schrägen Küste sind zu 60–90 % trocken (die Wasserlinie läuft dort etwa
 * ein Fünftel des Feldes vom Rand entfernt), vorspringende Ecken nur zu 30–50 %, Sandbänke kaum.
 */
const ANTEIL = 0.6;
/** Abtastpunkte je Feldseite für den trockenen Anteil */
const PROBE = 6;

function blur(src: Float32Array, N: number, passes: number): Float32Array {
  let a = src;
  for (let p = 0; p < passes; p++) {
    const b = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let s = 0, n = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const xx = Math.min(N - 1, Math.max(0, x + i)), yy = Math.min(N - 1, Math.max(0, y + j));
        s += a[yy * N + xx]; n++;
      }
      b[y * N + x] = s / n;
    }
    a = b;
  }
  return a;
}
function sample(f: Float32Array, N: number, x: number, z: number): number {
  const fx = Math.min(N - 1.001, Math.max(0, x - 0.5)), fz = Math.min(N - 1.001, Math.max(0, z - 0.5));
  const ix = Math.floor(fx), iz = Math.floor(fz);
  const tx = fx - ix, tz = fz - iz;
  const a = f[iz * N + ix], b = f[iz * N + ix + 1], c = f[(iz + 1) * N + ix], d = f[(iz + 1) * N + ix + 1];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}
function hash2(x: number, y: number, seed: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}
function fbm(x: number, y: number, seed: number, oct = 4) {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += vnoise(x * f, y * f, seed + i) * a; a *= 0.5; f *= 2; }
  return v;
}
function smoothstep(x: number, a: number, b: number) {
  if (x <= a) return 0;
  if (x >= b) return 1;
  const t = (x - a) / (b - a);
  return t * t * (3 - 2 * t);
}

interface Welt { tiles: Uint8Array; size: number; seed: number; islandOf: ArrayLike<number> }

class LandHoehe {
  private landB: Float32Array;
  private depthB: Float32Array;
  private bergB: Float32Array;
  /** je Feld: 0 = noch nicht gerechnet, 1 = trocken, 2 = (teilweise) unter Wasser */
  private dry: Uint8Array;
  constructor(private w: Welt) {
    const N = w.size;
    const land = new Float32Array(N * N), berg = new Float32Array(N * N);
    const dist = new Float32Array(N * N).fill(99);
    const q: number[] = [];
    for (let i = 0; i < N * N; i++) {
      land[i] = w.tiles[i] !== T.Wasser ? 1 : 0;
      berg[i] = w.tiles[i] === T.Berg ? 1 : 0;
      if (land[i]) { dist[i] = 0; q.push(i); }
    }
    for (let h = 0; h < q.length; h++) {
      const i = q[h]; const x = i % N, y = (i / N) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const ni = ny * N + nx;
        if (dist[ni] > dist[i] + 1) { dist[ni] = dist[i] + 1; q.push(ni); }
      }
    }
    this.landB = blur(land, N, 1);
    this.bergB = blur(berg, N, 1);
    const distF = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) distF[i] = Math.min(dist[i], 8) / 8;
    this.depthB = blur(distF, N, 2);
    this.dry = new Uint8Array(N * N);
  }

  /** Bodenhöhe am Gitterpunkt (i, j) – genau wie terrain.ts (innerhalb der Inselrahmen) */
  gridH(i: number, j: number): number {
    const N = this.w.size, seed = this.w.seed;
    const x = i / RES, z = j / RES;
    const L = sample(this.landB, N, x, z);
    const D = sample(this.depthB, N, x, z);
    const t = smoothstep(L, 0.3, 0.72);
    const sea = -0.25 - 1.7 * Math.min(1, D * 1.4) - fbm(x * 0.3, z * 0.3, seed) * 0.3;
    let h = sea + (LAND_Y - sea) * t;
    const Mb = sample(this.bergB, N, x, z);
    if (Mb > 0.01) {
      let ridged = 0, amp = 1, fr = 0.32;
      for (let o = 0; o < 4; o++) {
        const n = 1 - Math.abs(vnoise(x * fr, z * fr, seed + 40 + o) * 2 - 1);
        ridged += n * n * amp; amp *= 0.5; fr *= 2.1;
      }
      h += Math.pow(Mb, 1.3) * (1.0 + 2.6 * ridged) + Mb * fbm(x * 3, z * 3, seed + 5) * 0.3;
    }
    return h;
  }

  /**
   * Ist das Feld im Bild trockenes Land? Die Feldmitte liegt sicher über den Wellen, und mindestens
   * 60 % des Feldes liegen über dem Wasser. An geraden und schrägen Küsten ist das so; Felder, die im Bild
   * ganz oder halb im Meer liegen (vorspringende Ecken, Zungen, winzige Sandbänke), fallen heraus.
   * (Das Gelände ist im Bild ein Gitter mit Punkten an Feldecken, Kantenmitten und Feldmitte; dazwischen
   * wird gleichmäßig verbunden – so wird hier auch zwischen den 9 Punkten des Feldes gerechnet.)
   */
  trocken(tx: number, ty: number): boolean {
    const N = this.w.size, k = ty * N + tx;
    const c = this.dry[k];
    if (c) return c === 1;
    let ok = this.w.tiles[k] !== T.Wasser && this.w.islandOf[k] >= 0;
    if (ok) {
      const i0 = tx * RES, j0 = ty * RES;
      const h: number[] = [];
      for (let j = 0; j <= 2; j++) for (let i = 0; i <= 2; i++) h.push(this.gridH(i0 + i, j0 + j));
      ok = h[4] >= RAND_MITTE;
      if (ok) {
        let dry = 0;
        for (let b = 0; b < PROBE; b++) for (let a = 0; a < PROBE; a++) {
          const u = ((a + 0.5) / PROBE) * 2, v = ((b + 0.5) / PROBE) * 2; // 0 … 2 in Gitterpunkten
          const iu = u < 1 ? 0 : 1, iv = v < 1 ? 0 : 1, fu = u - iu, fv = v - iv;
          const r0 = h[iv * 3 + iu] * (1 - fu) + h[iv * 3 + iu + 1] * fu;
          const r1 = h[(iv + 1) * 3 + iu] * (1 - fu) + h[(iv + 1) * 3 + iu + 1] * fu;
          if (r0 * (1 - fv) + r1 * fv > 0) dry++;
        }
        ok = dry >= ANTEIL * PROBE * PROBE;
      }
    }
    this.dry[k] = ok ? 1 : 2;
    return ok;
  }
}

/** je Welt (Geländefeld) eine Rechnung; eine neue Welt oder ein geladener Spielstand hat ein neues Feld */
const cache = new WeakMap<Uint8Array, LandHoehe>();
function fuer(w: Welt): LandHoehe {
  let l = cache.get(w.tiles);
  if (!l) { l = new LandHoehe(w); cache.set(w.tiles, l); }
  return l;
}

/** Meldung, wenn die Grundfläche im Bild (teilweise) im Wasser läge */
export const KEIN_FESTES_LAND = 'Hier ist kein festes Land – zu nah am Wasser';

/** (KL) Liegt jedes Feld der Grundfläche (x, y, Größe s) im Bild auf trockenem Land? */
export function trockeneFlaeche(w: Welt, x: number, y: number, s: number): boolean {
  const l = fuer(w);
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) if (!l.trocken(x + i, y + j)) return false;
  return true;
}

/** (Zusammenführung) Grundrechnung gleich beim Erzeugen bzw. Laden der Welt machen – sonst fällt sie in den
 *  ersten Denkschritt der Computergegner (Kontorplatz suchen) und macht ihn um etwa 9 ms langsamer */
export function landVorbereiten(w: Welt): void { fuer(w); }

/** Bodenhöhe am Gitterpunkt wie im Bild (nur für scripts/kueste-test.ts) */
export function bodenHoehe(w: Welt, i: number, j: number): number {
  return fuer(w).gridH(i, j);
}
