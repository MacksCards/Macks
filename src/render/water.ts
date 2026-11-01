// Meer: Farbe nach Wassertiefe (an der Küste hell türkis, draußen tief dunkelblau), feine bewegte
// Wellen, Sonnenglitzern und weicher Schaum an der Küste.
//
// - Die Tiefe kommt aus der echten Höhe des Meeresbodens (Gelände): die Küstenlinie im Wasser liegt
//   damit genau dort, wo der Strand aus dem Wasser kommt – weich und rund, ohne Treppenstufen.
// - Die feinen Wellen sind ein kleines, einmal berechnetes Muster (128 × 128 Bildpunkte, nahtlos
//   wiederholbar), das in zwei Größen gegeneinander verschoben wird. Es bestimmt, wie das Licht
//   gespiegelt wird (Glitzern) – das ist auf dem Handy viel billiger als Rauschen je Bildpunkt.
import * as THREE from 'three';
import { Game } from '../game';
import { T } from '../world';
import { Terrain } from './terrain';

const RES = 2; // Bildpunkte der Tiefenkarte je Feld (wie das Gelände)

let waveTex: THREE.DataTexture | null = null;

/**
 * Nahtloses Wellenmuster: Summe vieler Sinuswellen mit ganzzahligen Richtungen (passen genau in das
 * Bild, deshalb keine Nähte). Rot/Grün = Neigung der Wasseroberfläche, Alpha = Höhe.
 */
function waveTexture(): THREE.DataTexture {
  if (waveTex) return waveTex;
  const S = 128;
  const h = new Float32Array(S * S);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const waves: [number, number, number, number][] = [];
  for (let k = 0; k < 28; k++) {
    let a = 0, b = 0;
    while (a === 0 && b === 0) {
      const len = 2 + rnd() * 11, ang = rnd() * Math.PI * 2;
      a = Math.round(Math.cos(ang) * len); b = Math.round(Math.sin(ang) * len);
    }
    waves.push([a, b, 1 / Math.pow(Math.hypot(a, b), 1.25), rnd() * Math.PI * 2]);
  }
  let lo = Infinity, hi = -Infinity;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 0;
    for (const [a, b, amp, ph] of waves) {
      // spitze Wellenkämme, flache Täler (wie echtes Wasser)
      const s = Math.sin(((a * x + b * y) / S) * Math.PI * 2 + ph) * 0.5 + 0.5;
      v += amp * (s * s * 1.6 - 0.4);
    }
    h[y * S + x] = v;
    lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  const data = new Uint8Array(S * S * 4);
  const at = (x: number, y: number) => h[((y + S) % S) * S + ((x + S) % S)];
  const k = 3.0 / (hi - lo);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * k, dy = (at(x, y + 1) - at(x, y - 1)) * k;
    const i = (y * S + x) * 4;
    data[i] = Math.round(Math.min(1, Math.max(0, dx * 0.5 + 0.5)) * 255);
    data[i + 1] = Math.round(Math.min(1, Math.max(0, dy * 0.5 + 0.5)) * 255);
    data[i + 2] = 0;
    data[i + 3] = Math.round(((h[y * S + x] - lo) / (hi - lo)) * 255);
  }
  const t = new THREE.DataTexture(data, S, S);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  waveTex = t;
  return t;
}

/**
 * Tiefenkarte (2 Bildpunkte je Feld): Rot = Wassertiefe aus dem Gelände (0 an der Küste, 1 ab 2 Einheiten
 * Tiefe), Grün = Abstand zum nächsten Land (0 an der Küste, 1 ab 12 Feldern) für das tiefe Blau draußen.
 */
function depthTexture(g: Game, terrain: Terrain): THREE.DataTexture {
  const N = g.size, M = N * RES + 1;
  // Abstand zum Land, mit Schrägschritten (rund statt rautenförmig)
  const dist = new Float32Array(N * N).fill(1e9);
  for (let i = 0; i < N * N; i++) if (g.tiles[i] !== T.Wasser) dist[i] = 0;
  const pass = (y0: number, y1: number, dy: number, x0: number, x1: number, dx: number) => {
    for (let y = y0; y !== y1; y += dy) for (let x = x0; x !== x1; x += dx) {
      const i = y * N + x;
      let d = dist[i];
      const px = x - dx, py = y - dy;
      if (px >= 0 && px < N) d = Math.min(d, dist[y * N + px] + 1);
      if (py >= 0 && py < N) {
        d = Math.min(d, dist[py * N + x] + 1);
        if (px >= 0 && px < N) d = Math.min(d, dist[py * N + px] + 1.414);
        const qx = x + dx;
        if (qx >= 0 && qx < N) d = Math.min(d, dist[py * N + qx] + 1.414);
      }
      dist[i] = d;
    }
  };
  pass(0, N, 1, 0, N, 1);
  pass(N - 1, -1, -1, N - 1, -1, -1);
  const data = new Uint8Array(M * M * 4);
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const x = i / RES, z = j / RES;
    const h = terrain.heightAt(x, z);
    // Abstand bilinear zwischen den Feldmitten
    const fx = Math.min(N - 1.001, Math.max(0, x - 0.5)), fz = Math.min(N - 1.001, Math.max(0, z - 0.5));
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
    const d = (dist[iz * N + ix] * (1 - tx) + dist[iz * N + ix + 1] * tx) * (1 - tz)
      + (dist[(iz + 1) * N + ix] * (1 - tx) + dist[(iz + 1) * N + ix + 1] * tx) * tz;
    const o = (j * M + i) * 4;
    data[o] = Math.round(Math.min(1, Math.max(0, -h / 2.0)) * 255);
    data[o + 1] = Math.round(Math.min(1, d / 12) * 255);
    data[o + 2] = 0;
    data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, M, M);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

const WATER_COMMON = /* glsl */ `
uniform float uTime;
uniform sampler2D uDepth;
uniform sampler2D uSeen;
uniform sampler2D uWaveN;
uniform float uN;
uniform float uM;
varying vec3 vW;
vec3 wN;
float wh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float wn(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wh(i), wh(i + vec2(1, 0)), f.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), f.x), f.y); }
`;

const WATER_COLOR = /* glsl */ `
vec2 uv = vW.xz / uN;
vec2 uvc = clamp(uv, 0.0, 1.0);
float outside = smoothstep(0.0, 0.2, length(uv - uvc));
vec2 dd = texture2D(uDepth, (clamp(vW.xz, 0.0, uN) * 2.0 + 0.5) / uM).rg;
float dl = max(dd.r, outside); // Tiefe: 0 an der Küste, 1 tief
float df = max(dd.g, outside); // Abstand zum Land
float cdist = distance(vW, cameraPosition);
// Wellenmuster in mehreren Größen gegeneinander verschoben, dazu eine langsame große Dünung
vec4 n1 = texture2D(uWaveN, vW.xz * 0.105 + vec2(uTime * 0.017, uTime * 0.010));
vec4 n2 = texture2D(uWaveN, vW.xz * 0.235 + vec2(-uTime * 0.013, uTime * 0.022));
vec4 n3 = texture2D(uWaveN, vW.xz * 0.031 + vec2(uTime * 0.004, -uTime * 0.006));
vec2 slope = (n1.xy * 2.0 - 1.0) + (n2.xy * 2.0 - 1.0) * 0.65 + (n3.xy * 2.0 - 1.0) * 0.8;
// nah an der Kamera noch ein feines Kräuseln (sonst wirkt das Wasser beim Heranzoomen verschwommen)
float nahW = 1.0 - smoothstep(10.0, 28.0, cdist);
slope += (texture2D(uWaveN, vW.xz * 0.71 + vec2(uTime * 0.05, -uTime * 0.035)).xy * 2.0 - 1.0) * 0.6 * nahW;
float hgt = n1.a * 0.45 + n2.a * 0.3 + n3.a * 0.25;
// im flachen Wasser ruhiger, in der Ferne sanfter (kein Flimmern)
float calm = mix(0.45, 1.0, smoothstep(0.0, 0.3, dl)) * mix(1.0, 0.55, smoothstep(30.0, 90.0, cdist));
wN = normalize(vec3(-slope.x * 0.13 * calm, 1.0, -slope.y * 0.13 * calm));
// Farbe nach Tiefe
vec3 shallow = vec3(0.10, 0.52, 0.50);
vec3 mid = vec3(0.025, 0.25, 0.34);
vec3 deep = vec3(0.008, 0.075, 0.17);
vec3 col = mix(shallow, mid, smoothstep(0.0, 0.5, dl));
col = mix(col, deep, smoothstep(0.12, 0.85, df) * smoothstep(0.3, 0.8, dl));
// Wellenkämme etwas heller (Licht scheint durch), Täler dunkler
col *= 0.86 + 0.3 * hgt;
col += vec3(0.0, 0.05, 0.045) * smoothstep(0.55, 0.9, hgt) * (1.0 - smoothstep(0.2, 0.7, dl));
// Schaum: ein ausgefranster Saum direkt am Strand und Wellen, die heranrollen und auslaufen
float brk = wn(vW.xz * 2.3 + vec2(uTime * 0.12, -uTime * 0.08)) * 0.6 + hgt * 0.5;
float saum = (1.0 - smoothstep(0.0, 0.045, dl + (brk - 0.5) * 0.03)) * smoothstep(0.3, 0.6, brk);
float phase = dl * 44.0 - uTime * 1.25 + hgt * 2.0;
float roll = smoothstep(0.82, 0.98, sin(phase) * 0.5 + 0.5) * (1.0 - smoothstep(0.02, 0.2, dl)) * smoothstep(0.35, 0.75, brk);
float foam = clamp(saum * 0.9 + roll * 0.7, 0.0, 1.0);
col = mix(col, vec3(0.82, 0.88, 0.88), foam * 0.85);
diffuseColor.rgb = col;
// am Strand durchsichtig (der nasse Sand scheint durch), ganz am Rand weich auslaufend
float a = mix(0.42, 1.0, smoothstep(0.0, 0.55, dl));
a = mix(a, 0.95, foam);
a *= smoothstep(0.0, 0.02, dl + foam * 0.01);
diffuseColor.a = a;
// Nebel über Unentdecktem
float seenV = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 0.0 : texture2D(uSeen, uvc).r;
if (seenV < 0.999) {
  float cl = wn(vW.xz * 0.12 + uTime * 0.02) * 0.6 + wn(vW.xz * 0.45 - uTime * 0.03) * 0.4;
  vec3 mist = mix(vec3(0.36, 0.42, 0.50), vec3(0.62, 0.67, 0.73), cl);
  diffuseColor.rgb = mix(mist, diffuseColor.rgb, smoothstep(0.0, 1.0, seenV));
  diffuseColor.a = mix(1.0, diffuseColor.a, smoothstep(0.0, 1.0, seenV));
  wN = normalize(mix(vec3(0.0, 1.0, 0.0), wN, seenV));
}
`;

/**
 * Wasserfläche samt Meeresboden. `uni` sind die gemeinsamen Werte (uTime wird von außen weitergezählt);
 * die Tiefenkarte landet in uni.uDepth, das Nebel-Datenbild (vom Aufrufer beschrieben) in uni.uSeen.
 */
export function createWater(g: Game, terrain: Terrain, uni: Record<string, THREE.IUniform>): { mesh: THREE.Mesh; seenTex: THREE.DataTexture } {
  const N = g.size;
  const geo = new THREE.PlaneGeometry(N * 5, N * 5, 160, 160).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, transparent: true, roughness: 0.2, metalness: 0.0, envMapIntensity: 0.85,
  });
  uni.uDepth = { value: depthTexture(g, terrain) };
  uni.uWaveN = { value: waveTexture() };
  const seenTex = new THREE.DataTexture(new Uint8Array(N * N * 4), N, N);
  seenTex.magFilter = THREE.LinearFilter;
  seenTex.minFilter = THREE.LinearFilter;
  uni.uSeen = { value: seenTex };
  uni.uN = { value: N };
  uni.uM = { value: N * RES + 1 };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime;
varying vec3 vW;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
float w1 = sin(wp.x * 0.7 + uTime * 1.3) * 0.04;
float w2 = cos(wp.z * 0.55 + uTime * 0.9) * 0.04;
float w3 = sin((wp.x + wp.z) * 1.6 + uTime * 2.1) * 0.015;
transformed.y += w1 + w2 + w3;
vW = wp;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
${WATER_COMMON}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
${WATER_COLOR}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);`)
      // Sonnenglanz gedämpft: glitzert, ohne eine grelle weiße Fläche zu bilden
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
reflectedLight.directSpecular *= 0.5;`);
  };
  mat.customProgramCacheKey = () => 'wasser-v3';
  const mesh = new THREE.Mesh(geo, mat);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(N * 5, N * 5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0a2a3c }));
  floor.position.set(0, -2.4, 0);
  mesh.add(floor);
  mesh.position.set(N / 2, 0, N / 2);
  mesh.renderOrder = 1;
  // Wasser empfängt keine Schatten: spart auf fast jedem Bildpunkt 16 Schatten-Abfragen
  mesh.receiveShadow = false;
  return { mesh, seenTex };
}
