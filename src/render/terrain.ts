// Realistische Landschaft: feines Höhengitter mit echten Bergen, weichen Küsten
// und natürlichen Oberflächen (Gras, Waldboden, Sand, Fels), im Shader gemischt.
// Das Gelände ist in Blöcke zu 32 × 32 Feldern geteilt: Blöcke außerhalb des Bildes werden nicht
// gezeichnet, und bei Änderungen (Roden, Entdecken) wird nur der betroffene Ausschnitt neu berechnet.
import * as THREE from 'three';
import { Game } from '../game';
import { T } from '../world';

export const LAND_Y = 0.3;
const RES = 2; // Gitterpunkte pro Kachel

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

/** ein Feld der Weichzeichnung (wie blur mit einem Durchgang) */
function blurAt(src: Float32Array, N: number, x: number, y: number): number {
  let s = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const xx = Math.min(N - 1, Math.max(0, x + i)), yy = Math.min(N - 1, Math.max(0, y + j));
    s += src[yy * N + xx];
  }
  return s / 9;
}

/** bilineares Abtasten eines Kachelfeldes an Weltposition (x,z) */
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

// Farbprogramm des Bodens (läuft für jeden Bildpunkt – deshalb sparsam):
// ein gemeinsames Rauschen für alle Untergründe, Untergründe mit kaum Anteil werden übersprungen,
// in der Ferne (ab Abstand 50) nur zwei statt vier Rauschstufen.
// Wege liegen nicht mehr als flache Kästen auf dem Boden, sondern werden hier in den Boden gemalt:
// ein Datenbild mit einem Wert je Feld (rot = Erdweg, grün = Pflaster), weich zwischen den Feldern
// verlaufend. Daraus entstehen ausgefranste Ränder mit niedergetretenem Gras, Fahrspuren (sie folgen
// den Linien gleichen Werts und biegen deshalb in Kurven von selbst mit ab) und Pflastersteine.
// tH ist eine kleine Höhe (Unebenheit): daraus berechnet das Programm, wie das Licht auf Halme,
// Steine und Spuren fällt – ohne zusätzliche Dreiecke.
const TERRAIN_GLSL = /* glsl */ `
varying vec4 vSplat;
varying float vDim;
varying vec3 vTW;
uniform sampler2D uRoad;
uniform float uRN;
float tH = 0.0;
float th(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tn(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(th(i), th(i + vec2(1.0, 0.0)), f.x), mix(th(i + vec2(0.0, 1.0)), th(i + vec2(1.0, 1.0)), f.x), f.y); }
// Rauschen in Stufen; nah = 1: vier Stufen, nah = 0: zwei Stufen (die feinen als Mittelwert)
float tf(vec2 p, float nah) {
  float v = tn(p) * 0.5 + tn(p * 2.03) * 0.25;
  if (nah > 0.0) v += mix(0.09375, tn(p * 4.1) * 0.125 + tn(p * 8.3) * 0.0625, nah);
  else v += 0.09375;
  return v;
}
// Licht-Unebenheit aus der Höhe tH (Änderung von Bildpunkt zu Bildpunkt)
vec3 tBump(vec3 pos, vec3 nrm, vec2 dH) {
  vec3 sx = dFdx(pos), sy = dFdy(pos);
  vec3 r1 = cross(sy, nrm), r2 = cross(nrm, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
  return normalize(abs(det) * nrm - grad);
}
vec3 terrainColor(vec3 p, vec4 w) {
  vec2 q = p.xz;
  float cd = distance(p, cameraPosition);
  float nah = 1.0 - smoothstep(40.0, 50.0, cd);
  // feine Muster (Halme, Steine) verblassen mit der Entfernung, damit nichts flimmert
  float fein = 1.0 - smoothstep(18.0, 42.0, cd);
  // gemeinsames Rauschen: große Flecken, mittlere Flecken, feines Korn
  float lo = tf(q * 0.35, nah);
  float mid = tn(q * 2.2) * 0.62 + tn(q * 4.7) * 0.38;
  float hi = tn(q * 17.0);
  float hi2 = fein > 0.0 ? tn(q * 43.0 + 3.7) : 0.5;
  vec3 c = vec3(0.0);
  float sum = 0.0;
  if (w.x > 0.02) {
    // Wiese: satte und gelbliche Bereiche, trockene Flecken, Kleeinseln, kleine Erdstellen, feine Halme
    float macro = tn(q * 0.045 + 11.0);
    float dry = smoothstep(0.58, 0.86, tn(q * 0.13 + 7.3) * 0.7 + lo * 0.3);
    vec3 grass = mix(vec3(0.085, 0.20, 0.032), vec3(0.20, 0.33, 0.065), lo);
    grass = mix(grass, grass * vec3(1.22, 1.04, 0.62), macro * 0.7);
    grass = mix(grass, vec3(0.36, 0.34, 0.13), dry * 0.6);
    grass = mix(grass, vec3(0.06, 0.17, 0.035), smoothstep(0.62, 0.85, mid) * 0.45 * (1.0 - dry));
    float soil = smoothstep(0.84, 0.95, mid * 0.55 + hi * 0.45) * (1.0 - smoothstep(0.3, 0.7, lo));
    grass = mix(grass, vec3(0.20, 0.14, 0.075), soil * 0.55);
    float halm = hi * 0.6 + hi2 * 0.4;
    grass *= 0.8 + 0.3 * mix(0.5, halm, fein * 0.8 + 0.2);
    c += grass * w.x; sum += w.x;
    tH += (hi * 0.012 + hi2 * 0.009 * fein) * w.x;
  }
  if (w.y > 0.02) {
    // Waldboden: dunkles Moos, Nadeln, Laub, Erde
    vec3 forest = mix(vec3(0.09, 0.13, 0.04), vec3(0.20, 0.15, 0.08), mid) * (0.75 + 0.35 * hi);
    forest = mix(forest, vec3(0.26, 0.17, 0.08), smoothstep(0.55, 0.8, hi2) * 0.35 * fein);
    c += forest * w.y; sum += w.y;
    tH += (hi * 0.016 + hi2 * 0.01 * fein) * w.y;
  }
  if (w.z > 0.02) {
    // Sand: hell, feines Korn, vom Wind geriffelt, nasser Sand unten dunkler
    vec3 sand = mix(vec3(0.50, 0.41, 0.25), vec3(0.62, 0.52, 0.34), lo * 0.6 + mid * 0.4) * (0.9 + 0.12 * hi);
    sand = mix(sand * vec3(0.62, 0.6, 0.58), sand, smoothstep(0.02, 0.22, p.y));
    c += sand * w.z; sum += w.z;
    tH += (sin(q.x * 6.0 + q.y * 2.5 + lo * 9.0) * 0.004 + hi2 * 0.003) * w.z * fein;
  }
  if (w.w > 0.02) {
    // Fels: Schichten + Risse, oben heller
    float r1 = tf(vec2(q.x * 0.6 + p.y * 0.9, q.y * 0.6 - p.y * 0.4), nah);
    float strata = sin(p.y * 7.0 + r1 * 6.0) * 0.5 + 0.5;
    vec3 rock = mix(vec3(0.13, 0.12, 0.11), vec3(0.30, 0.28, 0.25), r1) * (0.75 + 0.35 * strata);
    rock *= 0.8 + 0.4 * tn(q * 9.0);
    rock = mix(rock, vec3(0.70, 0.72, 0.75), smoothstep(4.6, 5.3, p.y + r1 * 1.0) * 0.8);
    c += rock * w.w; sum += w.w;
    tH += (strata * 0.03 + hi * 0.02) * w.w;
  }
  c /= max(sum, 0.001);
  // ---- Wege ----
  vec2 rd = texture2D(uRoad, q / uRN).rg;
  float rr = min(1.0, rd.r + rd.g);
  if (rr > 0.03) {
    float en = (mid - 0.5) * 0.24 + (hi - 0.5) * 0.08;
    // Wege enden an der Wasserlinie (kein Pflaster unter Wasser)
    float cover = smoothstep(0.40, 0.55, rr + en) * smoothstep(-0.04, 0.1, p.y);
    // Rand: niedergetretenes, trockenes Gras mit Erde
    float worn = smoothstep(0.12, 0.42, rr + en) * (1.0 - cover);
    c = mix(c, mix(c, vec3(0.27, 0.22, 0.11), 0.55) * (0.85 + 0.3 * hi), worn * 0.8);
    float pave = clamp(rd.g / max(rr, 0.001), 0.0, 1.0);
    // Erdweg: festgefahrene Erde, Kies, zwei Fahrspuren, in der Mitte ein Grasstreifen
    vec3 dirt = mix(vec3(0.21, 0.135, 0.07), vec3(0.33, 0.23, 0.12), lo * 0.7 + mid * 0.3);
    dirt *= 0.85 + 0.25 * mix(0.5, hi2, fein);
    float kies = smoothstep(0.8, 0.92, hi2) * fein;
    dirt = mix(dirt, vec3(0.38, 0.32, 0.24), kies * 0.35);
    // Fahrspuren: breit und weich, etwas dunkler und feuchter
    float spur = 1.0 - smoothstep(0.02, 0.085, abs(rr - 0.78 + (hi - 0.5) * 0.04));
    dirt = mix(dirt, dirt * vec3(0.72, 0.66, 0.6), spur * 0.6);
    float streifen = smoothstep(0.93, 0.995, rr) * smoothstep(0.35, 0.65, mid + hi * 0.3);
    dirt = mix(dirt, vec3(0.12, 0.19, 0.045) * (0.8 + 0.4 * hi), streifen * 0.5);
    float hDirt = -spur * 0.025 + kies * 0.006 + hi2 * 0.004 * fein + streifen * 0.01;
    // Pflaster: einzelne, leicht gewölbte Steine im Verband, jeder etwas anders gefärbt, Fugen dunkel
    vec3 stone = vec3(0.36, 0.34, 0.31);
    float hStone = 0.0;
    if (pave > 0.01) {
      vec2 s = q * vec2(5.6, 7.2);
      float row = floor(s.y);
      s.x += row * 0.5 + th(vec2(row, 3.0)) * 0.35;
      vec2 id = vec2(floor(s.x), row);
      vec2 cell = fract(s) - 0.5;
      float rnd = th(id);
      // jeder Stein etwas anders groß und leicht verschoben (Natursteine statt Fliesen)
      cell -= (vec2(th(id + 1.3), th(id + 2.7)) - 0.5) * 0.08;
      vec2 hs = vec2(0.25 + th(id + 4.1) * 0.06, 0.22 + th(id + 5.9) * 0.05);
      float sdf = length(max(abs(cell) - hs, 0.0)) - 0.14 - (hi2 - 0.5) * 0.04;
      float st = 1.0 - smoothstep(-0.03, 0.025, sdf);
      vec3 sc = mix(vec3(0.15, 0.14, 0.12), vec3(0.30, 0.27, 0.225), rnd);
      sc = mix(sc, sc * vec3(1.12, 0.97, 0.82), th(id + 7.0) * 0.6);
      sc *= 0.85 + 0.25 * hi2;
      // Fugen: Erde, stellenweise Moos
      vec3 fuge = mix(vec3(0.10, 0.08, 0.06), vec3(0.08, 0.12, 0.04), smoothstep(0.5, 0.8, mid));
      vec3 near = mix(fuge, sc, st);
      vec3 farC = mix(vec3(0.20, 0.185, 0.165), vec3(0.25, 0.23, 0.20), lo);
      stone = mix(farC, near, fein);
      hStone = (st * (0.012 - dot(cell, cell) * 0.03)) * fein;
      // Randsteine etwas dunkler, damit der Weg eine klare Kante hat
      stone *= 1.0 - (1.0 - smoothstep(0.55, 0.66, rr + en)) * 0.25;
    }
    vec3 road = mix(dirt, stone, pave);
    c = mix(c, road, cover);
    tH = mix(tH, mix(hDirt, hStone, pave), cover);
  }
  return c;
}
`;

/** Felder je Geländeblock (Seitenlänge) */
const CT = 32;
/** Höhe des flachen Meeresbodens fern der Inseln (dort braucht es kein Gelände: der Boden unter dem Wasser reicht) */
const DEEP = -2.3;

interface Chunk {
  mesh: THREE.Mesh;
  i0: number; j0: number; w: number; h: number; // Gitterausschnitt (Punkte)
  splat: Float32Array;
  dim: Float32Array;
  fog: Float32Array;
  /** Zahl der Punkte, die schon entdeckt sind (Nebel > 0,5) – 0 = Block unsichtbar */
  fogOn: number;
}

/** Rechteck in Feldern (einschließlich) */
export interface TileRect { x0: number; y0: number; x1: number; y1: number }

export class Terrain {
  group = new THREE.Group();
  chunks: Chunk[] = [];
  private N: number;
  private W: number; // Punkte pro Zeile der ganzen Welt
  private H: Float32Array;
  private bergB: Float32Array;
  private mat: THREE.MeshStandardMaterial;
  /** Wald/Sand je Feld und weichgezeichnet (für die Bodenfarbe), entdeckt je Feld (für den Nebel) */
  private forest: Float32Array;
  private sand: Float32Array;
  private fB: Float32Array;
  private sB: Float32Array;
  private seenF: Float32Array;
  /** Geländeblock je Blockfeld (fehlt, wo nur tiefes Meer ist) */
  private nc: number;
  private chunkAt: (Chunk | undefined)[] = [];
  /** Wege als Datenbild (ein Bildpunkt je Feld: rot = Erdweg, grün = Pflaster), weich gefiltert */
  private roadTex: THREE.DataTexture;
  private roadUni: { uRoad: THREE.IUniform; uRN: THREE.IUniform };
  /** zuletzt eingetragener Weg je Feld (0 = keiner, 1 = Erdweg, 2 = Pflaster) */
  private roadShown: Uint8Array;
  /** true, solange ein ganzes Hochladen des Wegebilds aussteht (dann keine Teil-Bereiche) */
  private roadFresh = true;

  constructor(private g: Game) {
    const N = (this.N = g.size);
    const W = (this.W = N * RES + 1);
    const land = new Float32Array(N * N), berg = new Float32Array(N * N);
    const dist = new Float32Array(N * N).fill(99);
    const q: number[] = [];
    for (let i = 0; i < N * N; i++) {
      land[i] = g.tiles[i] !== T.Wasser ? 1 : 0;
      berg[i] = g.tiles[i] === T.Berg ? 1 : 0;
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
    const landB = blur(land, N, 1);
    this.bergB = blur(berg, N, 1);
    const distF = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) distF[i] = Math.min(dist[i], 8) / 8;
    const depthB = blur(distF, N, 2);

    // Höhen für die ganze Welt (Meeresboden fern der Inseln ist flach und tief)
    const H = (this.H = new Float32Array(W * W).fill(DEEP));
    for (const isl of g.islands) {
      const i0 = Math.max(0, (isl.x0 - 4) * RES), i1 = Math.min(W - 1, (isl.x1 + 5) * RES);
      const j0 = Math.max(0, (isl.y0 - 4) * RES), j1 = Math.min(W - 1, (isl.y1 + 5) * RES);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = i / RES, z = j / RES;
        const L = sample(landB, N, x, z);
        const D = sample(depthB, N, x, z);
        const t = THREE.MathUtils.smoothstep(L, 0.3, 0.72);
        const sea = -0.25 - 1.7 * Math.min(1, D * 1.4) - fbm(x * 0.3, z * 0.3, g.seed) * 0.3;
        let h = sea + (LAND_Y - sea) * t;
        const Mb = sample(this.bergB, N, x, z);
        if (Mb > 0.01) {
          // zerklüftete Gipfel: "Grat-Rauschen" (scharfe Kämme) in mehreren Größen
          let ridged = 0, amp = 1, fr = 0.32;
          for (let o = 0; o < 4; o++) {
            const n = 1 - Math.abs(vnoise(x * fr, z * fr, g.seed + 40 + o) * 2 - 1);
            ridged += n * n * amp; amp *= 0.5; fr *= 2.1;
          }
          h += Math.pow(Mb, 1.3) * (1.0 + 2.6 * ridged) + Mb * fbm(x * 3, z * 3, g.seed + 5) * 0.3;
        }
        H[j * W + i] = h;
      }
    }

    this.roadShown = new Uint8Array(N * N);
    this.roadTex = new THREE.DataTexture(new Uint8Array(N * N * 4), N, N);
    this.roadTex.magFilter = THREE.LinearFilter;
    this.roadTex.minFilter = THREE.LinearFilter;
    this.roadTex.needsUpdate = true;
    this.roadTex.onUpdate = () => { this.roadFresh = false; };
    this.roadUni = { uRoad: { value: this.roadTex }, uRN: { value: N } };

    this.mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
    this.mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRoad = this.roadUni.uRoad;
      sh.uniforms.uRN = this.roadUni.uRN;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
attribute vec4 splat;
attribute float dim;
attribute float fog;
varying vec4 vSplat;
varying float vDim;
varying float vFog;
varying vec3 vTW;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vSplat = splat; vDim = dim; vFog = fog; vTW = (modelMatrix * vec4(position, 1.0)).xyz;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
varying float vFog;
${TERRAIN_GLSL}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb = terrainColor(vTW, vSplat) * vDim;`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = tBump(-vViewPosition, normal, vec2(dFdx(tH), dFdy(tH)));`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
if (vFog < 0.999) {
  // Nebel über Unentdecktem: zwei Rauschstufen reichen
  float cl = tn(vTW.xz * 0.15) * 0.62 + tn(vTW.xz * 0.6) * 0.38;
  vec3 mist = mix(vec3(0.55, 0.60, 0.66), vec3(0.80, 0.83, 0.87), cl);
  gl_FragColor.rgb = mix(mist, gl_FragColor.rgb, smoothstep(0.0, 1.0, vFog));
}`);
    };
    this.mat.customProgramCacheKey = () => 'terrain-welt-v3';

    // Gelände in Blöcken zu 32 × 32 Feldern; Blöcke mit nur tiefem Meer entfallen
    const nc = (this.nc = Math.ceil(N / CT));
    const hAt = (i: number, j: number) => H[Math.min(W - 1, Math.max(0, j)) * W + Math.min(W - 1, Math.max(0, i))];
    const deep = (i: number, j: number) => H[j * W + i] <= DEEP + 0.005;
    for (let cy = 0; cy < nc; cy++) for (let cx = 0; cx < nc; cx++) {
      const i0 = cx * CT * RES, i1 = Math.min(W - 1, (cx + 1) * CT * RES);
      const j0 = cy * CT * RES, j1 = Math.min(W - 1, (cy + 1) * CT * RES);
      const w = i1 - i0 + 1, h = j1 - j0 + 1;
      const idx: number[] = [];
      for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
        const gi = i0 + i, gj = j0 + j;
        // nur Vierecke, die über den flachen Meeresboden hinausragen
        if (deep(gi, gj) && deep(gi + 1, gj) && deep(gi, gj + 1) && deep(gi + 1, gj + 1)) continue;
        const a = j * w + i, b = a + 1, c = a + w, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      if (!idx.length) continue;
      const pos = new Float32Array(w * h * 3), nrm = new Float32Array(w * h * 3);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const gi = i0 + i, gj = j0 + j, k = (j * w + i) * 3;
        pos[k] = gi / RES; pos[k + 1] = H[gj * W + gi]; pos[k + 2] = gj / RES;
        // Normale aus der ganzen Höhenkarte: keine sichtbaren Kanten an Blockgrenzen
        const dx = (hAt(gi + 1, gj) - hAt(gi - 1, gj)) * RES * 0.5, dz = (hAt(gi, gj + 1) - hAt(gi, gj - 1)) * RES * 0.5;
        const l = Math.hypot(dx, 1, dz);
        nrm[k] = -dx / l; nrm[k + 1] = 1 / l; nrm[k + 2] = -dz / l;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      geo.setIndex(idx);
      geo.computeBoundingSphere();
      const ch: Chunk = { mesh: new THREE.Mesh(geo, this.mat), i0, j0, w, h,
        splat: new Float32Array(w * h * 4), dim: new Float32Array(w * h).fill(1), fog: new Float32Array(w * h), fogOn: 0 };
      geo.setAttribute('splat', new THREE.BufferAttribute(ch.splat, 4));
      geo.setAttribute('dim', new THREE.BufferAttribute(ch.dim, 1));
      geo.setAttribute('fog', new THREE.BufferAttribute(ch.fog, 1));
      ch.mesh.receiveShadow = true;
      // Schatten wirft das Gelände nur, wo Berge sind (flaches Land wirft keinen sichtbaren Schatten)
      let berg = false;
      for (let ty = cy * CT; ty < Math.min(N, (cy + 1) * CT) && !berg; ty++) {
        for (let tx = cx * CT; tx < Math.min(N, (cx + 1) * CT); tx++) if (this.bergB[ty * N + tx] > 0.01) { berg = true; break; }
      }
      ch.mesh.castShadow = berg;
      ch.mesh.visible = false;
      this.chunks.push(ch);
      this.chunkAt[cy * nc + cx] = ch;
      this.group.add(ch.mesh);
    }
    this.forest = new Float32Array(N * N);
    this.sand = new Float32Array(N * N);
    this.fB = new Float32Array(N * N);
    this.sB = new Float32Array(N * N);
    this.seenF = new Float32Array(N * N);
    this.updateSplat();
    this.updateFog();
  }

  /** Geländeblöcke, die den Punktbereich [pi0..pi1] × [pj0..pj1] berühren (mit Ausschnitt in Blockkoordinaten) */
  private forChunks(pi0: number, pj0: number, pi1: number, pj1: number, fn: (ch: Chunk, a0: number, b0: number, a1: number, b1: number) => void) {
    const S = CT * RES, W = this.W;
    pi0 = Math.max(0, pi0); pj0 = Math.max(0, pj0); pi1 = Math.min(W - 1, pi1); pj1 = Math.min(W - 1, pj1);
    if (pi0 > pi1 || pj0 > pj1) return;
    // Punkte auf einer Blockgrenze gehören zu beiden Nachbarblöcken
    const cx0 = Math.max(0, Math.floor((pi0 - 1) / S)), cx1 = Math.min(this.nc - 1, Math.floor(pi1 / S));
    const cy0 = Math.max(0, Math.floor((pj0 - 1) / S)), cy1 = Math.min(this.nc - 1, Math.floor(pj1 / S));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const ch = this.chunkAt[cy * this.nc + cx];
      if (!ch) continue;
      const a0 = Math.max(pi0, ch.i0), a1 = Math.min(pi1, ch.i0 + ch.w - 1);
      const b0 = Math.max(pj0, ch.j0), b1 = Math.min(pj1, ch.j0 + ch.h - 1);
      if (a0 > a1 || b0 > b1) continue;
      fn(ch, a0 - ch.i0, b0 - ch.j0, a1 - ch.i0, b1 - ch.j0);
    }
  }

  /** nur die Zeilen b0..b1 eines Datenfeldes zur Grafikkarte schicken */
  private upload(attr: THREE.BufferAttribute, w: number, b0: number, b1: number) {
    const s = attr.itemSize;
    attr.addUpdateRange(b0 * w * s, (b1 - b0 + 1) * w * s);
    attr.needsUpdate = true;
  }

  private splatPoint(ch: Chunk, i: number, j: number) {
    const N = this.N, k = j * ch.w + i;
    const x = (ch.i0 + i) / RES, z = (ch.j0 + j) / RES;
    const hgt = this.H[(ch.j0 + j) * this.W + ch.i0 + i];
    const slope = 1 - (ch.mesh.geometry.attributes.normal as THREE.BufferAttribute).getY(k);
    let rock = Math.min(1, sample(this.bergB, N, x, z) * 1.6 + Math.max(0, slope - 0.25) * 3);
    let sd = hgt < LAND_Y - 0.02 ? 1 : Math.min(1, sample(this.sB, N, x, z) * 1.3);
    let f = sample(this.fB, N, x, z);
    rock = Math.max(0, rock);
    sd *= 1 - rock;
    f *= (1 - rock) * (1 - sd);
    const o = k * 4;
    ch.splat[o] = Math.max(0, 1 - rock - sd - f); ch.splat[o + 1] = f; ch.splat[o + 2] = sd; ch.splat[o + 3] = rock;
  }

  /**
   * Oberflächen neu mischen (z. B. wenn Wald gerodet wurde). Ohne Angabe alles, sonst nur um die
   * geänderten Felder herum (die Weichzeichnung reicht gut zwei Felder weit).
   */
  updateSplat(changed?: number[]) {
    const g = this.g, N = this.N;
    const cls = (i: number) => {
      const t = g.tiles[i];
      this.forest[i] = t === T.Wald ? 1 : 0;
      this.sand[i] = t === T.Sand || t === T.Wasser ? 1 : 0;
    };
    if (!changed || changed.length > 4000) {
      for (let i = 0; i < N * N; i++) cls(i);
      this.fB = blur(this.forest, N, 1); this.sB = blur(this.sand, N, 1);
      for (const ch of this.chunks) {
        for (let j = 0; j < ch.h; j++) for (let i = 0; i < ch.w; i++) this.splatPoint(ch, i, j);
        const a = ch.mesh.geometry.attributes.splat as THREE.BufferAttribute;
        a.clearUpdateRanges(); a.needsUpdate = true;
      }
      return;
    }
    for (const k of changed) cls(k);
    // Weichzeichnung im 3 × 3-Umfeld neu
    for (const k of changed) {
      const x = k % N, y = (k / N) | 0;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(N - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(N - 1, x + 1); xx++) {
        this.fB[yy * N + xx] = blurAt(this.forest, N, xx, yy);
        this.sB[yy * N + xx] = blurAt(this.sand, N, xx, yy);
      }
    }
    // Gitterpunkte, deren Farbe davon abhängt
    for (const k of changed) {
      const x = k % N, y = (k / N) | 0;
      this.forChunks(Math.ceil((x - 1.5) * RES), Math.ceil((y - 1.5) * RES), Math.floor((x + 2.5) * RES), Math.floor((y + 2.5) * RES), (ch, a0, b0, a1, b1) => {
        for (let j = b0; j <= b1; j++) for (let i = a0; i <= a1; i++) this.splatPoint(ch, i, j);
        this.upload(ch.mesh.geometry.attributes.splat as THREE.BufferAttribute, ch.w, b0, b1);
      });
    }
  }

  /** Nebel über Unentdecktem; Blöcke erst zeigen, wenn ein Teil entdeckt ist. Ohne Angabe alles, sonst nur um das Rechteck */
  updateFog(r?: TileRect) {
    const g = this.g, N = this.N;
    const all = !r;
    const rr = r ?? { x0: 0, y0: 0, x1: N - 1, y1: N - 1 };
    for (let y = Math.max(0, rr.y0); y <= Math.min(N - 1, rr.y1); y++) for (let x = Math.max(0, rr.x0); x <= Math.min(N - 1, rr.x1); x++) this.seenF[y * N + x] = g.seen[y * N + x];
    // ein Feld wirkt gut ein Feld weit (weicher Übergang)
    const pi0 = all ? 0 : Math.floor((rr.x0 - 1) * RES), pj0 = all ? 0 : Math.floor((rr.y0 - 1) * RES);
    const pi1 = all ? this.W - 1 : Math.ceil((rr.x1 + 2) * RES), pj1 = all ? this.W - 1 : Math.ceil((rr.y1 + 2) * RES);
    this.forChunks(pi0, pj0, pi1, pj1, (ch, a0, b0, a1, b1) => {
      for (let j = b0; j <= b1; j++) for (let i = a0; i <= a1; i++) {
        const k = j * ch.w + i;
        const old = ch.fog[k];
        const v = sample(this.seenF, N, (ch.i0 + i) / RES, (ch.j0 + j) / RES);
        ch.fog[k] = v;
        ch.fogOn += (v > 0.5 ? 1 : 0) - (old > 0.5 ? 1 : 0);
      }
      ch.mesh.visible = ch.fogOn > 0;
      const a = ch.mesh.geometry.attributes.fog as THREE.BufferAttribute;
      if (all) { a.clearUpdateRanges(); a.needsUpdate = true; } else this.upload(a, ch.w, b0, b1);
    });
  }

  /**
   * Wege in das Bodenbild eintragen (nur entdeckte Felder). Ohne Angabe alle Felder, sonst nur die
   * genannten; hochgeladen werden nur die geänderten Zeilen.
   */
  updateRoads(tiles?: number[]) {
    const g = this.g, N = this.N, data = this.roadTex.image.data as Uint8Array, shown = this.roadShown;
    const all = !tiles;
    let y0 = N, y1 = -1;
    const put = (i: number) => {
      const v = g.seen[i] ? g.roads[i] : 0;
      if (v === shown[i] && !all) return;
      shown[i] = v;
      data[i * 4] = v === 1 ? 255 : 0;
      data[i * 4 + 1] = v === 2 ? 255 : 0;
      const y = (i / N) | 0;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    };
    if (all) for (let i = 0; i < N * N; i++) put(i);
    else for (const i of tiles) put(i);
    if (y1 < 0) return false;
    // Teil-Uploads erst, wenn das Bild einmal ganz auf der Grafikkarte ist; je Zeile ein Bereich
    if (all || this.roadFresh) { this.roadFresh = true; this.roadTex.clearUpdateRanges(); }
    else for (let y = y0; y <= y1; y++) this.roadTex.addUpdateRange(y * N * 4, N * 4);
    this.roadTex.needsUpdate = true;
    return true;
  }

  /** Gebiet außerhalb des eigenen Baubereichs abdunkeln */
  showArea(on: boolean) {
    const g = this.g, N = this.N;
    for (const ch of this.chunks) {
      for (let j = 0; j < ch.h; j++) for (let i = 0; i < ch.w; i++) {
        const tx = Math.min(N - 1, Math.floor((ch.i0 + i) / RES)), ty = Math.min(N - 1, Math.floor((ch.j0 + j) / RES));
        const t = ty * N + tx;
        ch.dim[j * ch.w + i] = on && !g.area[t] && g.tiles[t] !== T.Wasser ? 0.5 : 1;
      }
      const a = ch.mesh.geometry.attributes.dim as THREE.BufferAttribute;
      a.clearUpdateRanges(); a.needsUpdate = true;
    }
  }

  heightAt(x: number, z: number): number {
    const W = this.W;
    const fx = Math.min(W - 1.001, Math.max(0, x * RES)), fz = Math.min(W - 1.001, Math.max(0, z * RES));
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = fx - ix, tz = fz - iz;
    const H = this.H;
    const a = H[iz * W + ix], b = H[iz * W + ix + 1], c = H[(iz + 1) * W + ix], d = H[(iz + 1) * W + ix + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }

  /** Bodenhöhe für eine Grundfläche: höchster Punkt (Fundament gleicht den Rest aus) */
  groundY(x: number, y: number, s: number): number {
    let h = -5;
    for (let j = 0; j <= s * RES; j++) for (let i = 0; i <= s * RES; i++) h = Math.max(h, this.heightAt(x + i / RES, y + j / RES));
    return Math.min(Math.max(h, 0.05), LAND_Y + 0.15);
  }

  /** Geometrien und Material freigeben (Neues Spiel) */
  dispose() {
    for (const ch of this.chunks) ch.mesh.geometry.dispose();
    this.mat.dispose();
    this.roadTex.dispose();
  }
}
