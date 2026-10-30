// Realistische Landschaft: feines Höhengitter mit echten Bergen, weichen Küsten
// und natürlichen Oberflächen (Gras, Waldboden, Sand, Fels), im Shader gemischt.
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

const TERRAIN_GLSL = /* glsl */ `
varying vec4 vSplat;
varying float vDim;
varying vec3 vTW;
float th(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tn(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(th(i), th(i + vec2(1.0, 0.0)), f.x), mix(th(i + vec2(0.0, 1.0)), th(i + vec2(1.0, 1.0)), f.x), f.y); }
float tf(vec2 p) { return tn(p) * 0.5 + tn(p * 2.03) * 0.25 + tn(p * 4.1) * 0.125 + tn(p * 8.3) * 0.0625; }
vec3 terrainColor(vec3 p, vec4 w) {
  vec2 q = p.xz;
  // Gras: mehrere Grüntöne, Flecken, feine Halme
  float g1 = tf(q * 0.35), g2 = tf(q * 2.2), g3 = tn(q * 18.0);
  vec3 grass = mix(vec3(0.10, 0.22, 0.03), vec3(0.22, 0.34, 0.06), g1);
  grass = mix(grass, vec3(0.38, 0.40, 0.14), smoothstep(0.55, 0.8, g2) * 0.6);
  grass *= 0.85 + 0.25 * g3;
  // Waldboden: dunkles Moos, Nadeln, Erde
  float f1 = tf(q * 1.3), f2 = tn(q * 14.0);
  vec3 forest = mix(vec3(0.10, 0.14, 0.04), vec3(0.20, 0.16, 0.08), f1) * (0.8 + 0.3 * f2);
  // Sand: hell, feines Korn, nasser Sand unten dunkler
  float s1 = tf(q * 0.8), s2 = tn(q * 30.0);
  vec3 sand = mix(vec3(0.50, 0.41, 0.25), vec3(0.62, 0.52, 0.34), s1) * (0.9 + 0.12 * s2);
  sand = mix(sand * vec3(0.62, 0.6, 0.58), sand, smoothstep(0.02, 0.22, p.y));
  // Fels: Schichten + Risse, oben heller
  float r1 = tf(vec2(q.x * 0.6 + p.y * 0.9, q.y * 0.6 - p.y * 0.4));
  float strata = sin(p.y * 7.0 + r1 * 6.0) * 0.5 + 0.5;
  vec3 rock = mix(vec3(0.13, 0.12, 0.11), vec3(0.30, 0.28, 0.25), r1) * (0.75 + 0.35 * strata);
  rock *= 0.8 + 0.4 * tn(q * 9.0);
  rock = mix(rock, vec3(0.70, 0.72, 0.75), smoothstep(4.6, 5.3, p.y + r1 * 1.0) * 0.8);
  vec3 c = grass * w.x + forest * w.y + sand * w.z + rock * w.w;
  return c;
}
`;

interface Chunk {
  island: number;
  mesh: THREE.Mesh;
  i0: number; j0: number; w: number; h: number; // Gitterausschnitt (Punkte)
  splat: Float32Array;
  dim: Float32Array;
  fog: Float32Array;
}

export class Terrain {
  group = new THREE.Group();
  chunks: Chunk[] = [];
  private N: number;
  private W: number; // Punkte pro Zeile der ganzen Welt
  private H: Float32Array;
  private bergB: Float32Array;
  private mat: THREE.MeshStandardMaterial;

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
    this.H = new Float32Array(W * W).fill(-2.3);
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
        this.H[j * W + i] = h;
      }
    }

    this.mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
    this.mat.onBeforeCompile = (sh) => {
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
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
{
  float cl = tf(vTW.xz * 0.15) * 0.7 + tf(vTW.xz * 0.6) * 0.3;
  vec3 mist = mix(vec3(0.55, 0.60, 0.66), vec3(0.80, 0.83, 0.87), cl);
  gl_FragColor.rgb = mix(mist, gl_FragColor.rgb, smoothstep(0.0, 1.0, vFog));
}`);
    };
    this.mat.customProgramCacheKey = () => 'terrain-welt-v1';

    for (const isl of g.islands) {
      const i0 = Math.max(0, (isl.x0 - 3) * RES), i1 = Math.min(W - 1, (isl.x1 + 4) * RES);
      const j0 = Math.max(0, (isl.y0 - 3) * RES), j1 = Math.min(W - 1, (isl.y1 + 4) * RES);
      const w = i1 - i0 + 1, h = j1 - j0 + 1;
      const pos = new Float32Array(w * h * 3);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const gi = i0 + i, gj = j0 + j;
        pos.set([gi / RES, this.H[gj * W + gi], gj / RES], (j * w + i) * 3);
      }
      const idx: number[] = [];
      for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
        const a = j * w + i, b = a + 1, c = a + w, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const ch: Chunk = { island: isl.id, mesh: new THREE.Mesh(geo, this.mat), i0, j0, w, h,
        splat: new Float32Array(w * h * 4), dim: new Float32Array(w * h).fill(1), fog: new Float32Array(w * h) };
      geo.setAttribute('splat', new THREE.BufferAttribute(ch.splat, 4));
      geo.setAttribute('dim', new THREE.BufferAttribute(ch.dim, 1));
      geo.setAttribute('fog', new THREE.BufferAttribute(ch.fog, 1));
      ch.mesh.receiveShadow = true;
      ch.mesh.castShadow = true;
      ch.mesh.visible = false;
      this.chunks.push(ch);
      this.group.add(ch.mesh);
    }
    this.updateSplat();
    this.updateFog();
  }

  /** Oberflächen neu mischen (z. B. wenn Wald gerodet wurde) */
  updateSplat() {
    const g = this.g, N = this.N;
    const forest = new Float32Array(N * N), sand = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) {
      forest[i] = g.tiles[i] === T.Wald ? 1 : 0;
      sand[i] = g.tiles[i] === T.Sand || g.tiles[i] === T.Wasser ? 1 : 0;
    }
    const fB = blur(forest, N, 1), sB = blur(sand, N, 1);
    for (const ch of this.chunks) {
      const nrm = ch.mesh.geometry.attributes.normal as THREE.BufferAttribute;
      for (let j = 0; j < ch.h; j++) for (let i = 0; i < ch.w; i++) {
        const k = j * ch.w + i;
        const x = (ch.i0 + i) / RES, z = (ch.j0 + j) / RES;
        const hgt = this.H[(ch.j0 + j) * this.W + ch.i0 + i];
        const slope = 1 - nrm.getY(k);
        let rock = Math.min(1, sample(this.bergB, N, x, z) * 1.6 + Math.max(0, slope - 0.25) * 3);
        let sd = hgt < LAND_Y - 0.02 ? 1 : Math.min(1, sample(sB, N, x, z) * 1.3);
        let f = sample(fB, N, x, z);
        rock = Math.max(0, rock);
        sd *= 1 - rock;
        f *= (1 - rock) * (1 - sd);
        ch.splat.set([Math.max(0, 1 - rock - sd - f), f, sd, rock], k * 4);
      }
      (ch.mesh.geometry.attributes.splat as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  /** Nebel über Unentdecktem; Inseln erst zeigen, wenn ein Teil entdeckt ist */
  updateFog() {
    const g = this.g, N = this.N;
    const seenF = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) seenF[i] = g.seen[i];
    for (const ch of this.chunks) {
      let any = false;
      for (let j = 0; j < ch.h; j++) for (let i = 0; i < ch.w; i++) {
        const v = sample(seenF, N, (ch.i0 + i) / RES, (ch.j0 + j) / RES);
        ch.fog[j * ch.w + i] = v;
        if (v > 0.5) any = true;
      }
      ch.mesh.visible = any;
      (ch.mesh.geometry.attributes.fog as THREE.BufferAttribute).needsUpdate = true;
    }
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
      (ch.mesh.geometry.attributes.dim as THREE.BufferAttribute).needsUpdate = true;
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

  dispose() {
    for (const ch of this.chunks) ch.mesh.geometry.dispose();
  }
}
