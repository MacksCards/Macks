// Meer: Farbe nach Wassertiefe (an der Küste hell türkis und durchsichtig, draußen satt tiefblau), feine
// bewegte Wellen, Himmelsspiegelung je nach Blickwinkel, Sonnenglitzern, Lichtnetz am Grund im flachen
// Wasser und ein weicher, vor- und zurücklaufender Schaumsaum am Strand.
//
// - Die Tiefe kommt aus der echten Höhe des Meeresbodens (Gelände): die Küstenlinie im Wasser liegt
//   damit genau dort, wo der Strand aus dem Wasser kommt – weich und rund, ohne Treppenstufen.
// - Die feinen Wellen sind ein kleines, einmal berechnetes Muster (128 × 128 Bildpunkte, nahtlos
//   wiederholbar), das in mehreren Größen gegeneinander verschoben wird. Es bestimmt, wie das Licht
//   gespiegelt wird (Himmel, Glitzern) – das ist auf dem Handy viel billiger als Rauschen je Bildpunkt.
//   Im selben Bild steckt auch das Lichtnetz für den Meeresgrund (kein weiteres Bild nötig).
// - Spiegelung und Glanz werden hier selbst gerechnet (ein einfacher Himmelsverlauf statt des
//   Umgebungsbildes): keine echte Spiegelung der Szene, kein zusätzlicher Zeichendurchgang.
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
  // Lichtnetz am Grund (Blau): Zellmuster, hell an den Zellrändern – zwei gegeneinander verschobene Kopien
  // ergeben im Wasser die wandernden Lichtlinien, die Wellen auf den Meeresboden werfen
  const C = 8, cell = S / C;
  const pts: [number, number][] = [];
  for (let k = 0; k < C * C; k++) pts.push([(k % C + 0.15 + rnd() * 0.7) * cell, (Math.floor(k / C) + 0.15 + rnd() * 0.7) * cell]);
  const net = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    let f1 = 1e9, f2 = 1e9;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const gx = cx + ox, gy = cy + oy;
      const [px, py] = pts[((gy + C) % C) * C + ((gx + C) % C)];
      const d = Math.hypot(x + 0.5 - (px + (gx - ((gx + C) % C)) * cell), y + 0.5 - (py + (gy - ((gy + C) % C)) * cell));
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    net[y * S + x] = Math.exp(-((f2 - f1) / cell) * 7.0);
  }
  const data = new Uint8Array(S * S * 4);
  const at = (x: number, y: number) => h[((y + S) % S) * S + ((x + S) % S)];
  const k = 3.0 / (hi - lo);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * k, dy = (at(x, y + 1) - at(x, y - 1)) * k;
    const i = (y * S + x) * 4;
    data[i] = Math.round(Math.min(1, Math.max(0, dx * 0.5 + 0.5)) * 255);
    data[i + 1] = Math.round(Math.min(1, Math.max(0, dy * 0.5 + 0.5)) * 255);
    data[i + 2] = Math.round(net[y * S + x] * 255);
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
vec3 wN;        // Wellen-Normale (Welt)
float wFoam;    // Schaum 0..1
float wCaus;    // Lichtnetz am Grund 0..1
float wCalm;    // 1 = volle Wellen, kleiner in der Ferne
float wSeen;    // 1 = entdeckt
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
float nahW = 1.0 - smoothstep(14.0, 36.0, cdist);
if (nahW > 0.0) slope += (texture2D(uWaveN, vW.xz * 0.71 + vec2(uTime * 0.05, -uTime * 0.035)).xy * 2.0 - 1.0) * 0.75 * nahW;
float hgt = n1.a * 0.45 + n2.a * 0.3 + n3.a * 0.25;
// im ganz flachen Wasser etwas ruhiger, in der Ferne sanfter (kein Flimmern)
wCalm = mix(1.0, 0.3, smoothstep(20.0, 80.0, cdist));
float calm = mix(0.7, 1.0, smoothstep(0.0, 0.25, dl)) * wCalm;
wN = normalize(vec3(-slope.x * 0.30 * calm, 1.0, -slope.y * 0.30 * calm));
// Farbe nach Tiefe: flach hell türkis, dann blaugrün, draußen sattes tiefes Blau
vec3 shallow = vec3(0.12, 0.50, 0.46);
vec3 mid = vec3(0.022, 0.23, 0.34);
vec3 deep = vec3(0.008, 0.068, 0.215);
vec3 col = mix(shallow, mid, smoothstep(0.04, 0.7, dl));
col = mix(col, deep, smoothstep(0.1, 0.8, df) * smoothstep(0.3, 0.85, dl));
// Wellenkämme etwas heller und grünlicher (Licht scheint durch), Täler dunkler
col *= 0.76 + 0.48 * hgt;
col += vec3(0.0, 0.07, 0.06) * smoothstep(0.55, 0.92, hgt) * (1.0 - 0.6 * smoothstep(0.3, 0.9, dl));
// Schaum am Strand: ein weicher Saum, der mit den Wellen vor- und zurückläuft, dazu heranrollende Wellen
float foam = 0.0;
if (dl < 0.4) {
  float nz = wn(vW.xz * 1.6 + vec2(uTime * 0.11, -uTime * 0.07));
  float bub = texture2D(uWaveN, vW.xz * 1.35 + vec2(uTime * 0.02, -uTime * 0.03)).a;
  float bubbles = smoothstep(0.2, 0.8, bub * 0.7 + nz * 0.5 - 0.1);
  // der Saum atmet: läuft auf den Strand und zieht sich wieder zurück (je Stelle etwas versetzt)
  float breathe = sin(uTime * 0.85 + nz * 3.0 + (vW.x * 0.37 + vW.z * 0.23)) * 0.5 + 0.5;
  float edge = 0.06 + 0.08 * breathe;
  float saum = (1.0 - smoothstep(edge * 0.35, edge, dl)) * mix(0.6, 1.0, bubbles);
  // zurückbleibende Schaumreste hinter dem Saum
  float rest = (1.0 - smoothstep(edge, edge + 0.12, dl)) * smoothstep(0.5, 0.8, bub + nz * 0.3) * 0.6;
  // Wellen, die heranrollen, auf dem Strand auslaufen und dabei zerfasern
  float phase = dl * 30.0 - uTime * 1.1 + nz * 2.2;
  float roll = smoothstep(0.7, 0.95, sin(phase) * 0.5 + 0.5) * (1.0 - smoothstep(0.08, 0.38, dl)) * smoothstep(0.3, 0.7, bub * 0.6 + nz * 0.6);
  foam = clamp(max(saum, rest) + roll * 0.7, 0.0, 1.0) * smoothstep(0.0, 0.006, dl);
}
wFoam = foam;
// Lichtnetz am Grund im flachen Wasser (zwei gegeneinander wandernde Netze, verschoben von den Wellen)
wCaus = 0.0;
float cw = smoothstep(0.005, 0.05, dl) * (1.0 - smoothstep(0.2, 0.62, dl)) * (1.0 - smoothstep(16.0, 42.0, cdist));
if (cw > 0.0) {
  vec2 cuv = vW.xz * 0.42 + slope * 0.035;
  float c1 = texture2D(uWaveN, cuv + vec2(uTime * 0.021, uTime * 0.012)).b;
  float c2 = texture2D(uWaveN, cuv * 1.17 + vec2(0.37 - uTime * 0.016, 0.61 + uTime * 0.019)).b;
  wCaus = pow(min(c1, c2), 1.6) * cw * (1.0 - foam);
}
col = mix(col, vec3(0.80, 0.86, 0.86), foam * 0.9);
diffuseColor.rgb = col;
// im Flachen durchsichtig (der Sand scheint durch), ganz am Rand weich auslaufend
float a = mix(0.3, 1.0, smoothstep(0.04, 0.75, dl));
a *= smoothstep(0.0, 0.018, dl);
a = mix(a, 0.95, foam);
diffuseColor.a = a;
// Nebel über Unentdecktem
float seenV = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 0.0 : texture2D(uSeen, uvc).r;
wSeen = seenV;
if (seenV < 0.999) {
  float cl = wn(vW.xz * 0.12 + uTime * 0.02) * 0.6 + wn(vW.xz * 0.45 - uTime * 0.03) * 0.4;
  vec3 mist = mix(vec3(0.36, 0.42, 0.50), vec3(0.62, 0.67, 0.73), cl);
  diffuseColor.rgb = mix(mist, diffuseColor.rgb, smoothstep(0.0, 1.0, seenV));
  diffuseColor.a = mix(1.0, diffuseColor.a, smoothstep(0.0, 1.0, seenV));
  wN = normalize(mix(vec3(0.0, 1.0, 0.0), wN, seenV));
}
`;

/**
 * Licht auf dem Wasser (ersetzt die üblichen Glanzlichter): Himmel spiegelt sich je nach Blickwinkel
 * (flach drübergeschaut stärker), Sonne glitzert auf den Wellen als feine Funken und ein breiterer Schimmer.
 * Alles ohne zusätzlichen Durchgang – nur Rechnung je Bildpunkt.
 */
const WATER_LIGHT = /* glsl */ `
vec3 wSpec = vec3(0.0);
vec3 wGlow = vec3(0.0);
{
  vec3 Vw = normalize(cameraPosition - vW);
  // Himmelsspiegelung: in der Ferne mit ruhigerer Oberfläche (sonst wirkt das Meer fleckig)
  vec3 nR = normalize(mix(vec3(0.0, 1.0, 0.0), wN, 0.4 + 0.6 * wCalm));
  float ndv = max(dot(nR, Vw), 0.0);
  float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  vec3 R = reflect(-Vw, nR);
  R.y = abs(R.y);
  vec3 Ls = vec3(0.0, 1.0, 0.0);
  vec3 Lc = vec3(0.0);
  #if NUM_DIR_LIGHTS > 0
    Ls = normalize(inverseTransformDirection(directionalLights[0].direction, viewMatrix));
    Lc = directionalLights[0].color;
  #endif
  // Himmel: am Horizont hell und dunstig, oben satter blau, zur Sonne hin warm aufgehellt
  vec3 sky = mix(vec3(0.66, 0.76, 0.86), vec3(0.17, 0.36, 0.70), pow(R.y, 0.55));
  sky += vec3(0.55, 0.47, 0.36) * pow(max(dot(R, Ls), 0.0), 5.0);
  float keep = (1.0 - wFoam) * wSeen;
  wSpec = sky * fres * 1.35 * keep;
  // Sonne: feine Funken auf den Wellen und ein weicher Schimmer drumherum (in der Ferne breiter und
  // schwächer, damit nichts flimmert)
  vec3 Hs = normalize(Ls + Vw);
  float nh = max(dot(wN, Hs), 0.0);
  float sharp = mix(260.0, 1400.0, wCalm * wCalm);
  float c2 = wCalm * wCalm;
  float glint = pow(nh, sharp) * 1.6 * c2 * c2 + pow(nh, mix(36.0, 90.0, wCalm)) * mix(0.15, 0.07, wCalm);
  wSpec += Lc * glint * keep;
  // Lichtnetz am Grund (aufs Licht vom Boden addiert, macht das Wasser nicht undurchsichtiger)
  wGlow = vec3(0.95, 1.0, 0.85) * wCaus * 0.55 * wSeen;
}
reflectedLight.directSpecular = vec3(0.0);
reflectedLight.indirectSpecular = vec3(0.0);
`;

/**
 * Durchsichtiges Wasser schwächt sonst auch die Spiegelung ab. Hier wird die Spiegelung (und das Lichtnetz)
 * so verrechnet, dass sie trotz Durchsichtigkeit voll ankommt und der Grund dahinter sichtbar bleibt.
 */
const WATER_OUT = /* glsl */ `
{
  float aW = diffuseColor.a;
  float aN = clamp(aW + (1.0 - aW) * clamp(dot(wSpec, vec3(0.3, 0.55, 0.15)), 0.0, 1.0), 0.0, 1.0);
  outgoingLight = (outgoingLight * aW + wSpec + wGlow) / max(aN, 0.02);
  diffuseColor.a = aN;
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
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
${WATER_LIGHT}`)
      .replace('#include <opaque_fragment>', `${WATER_OUT}
#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'wasser-v4';
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
