// Gebäude-Material: Vertex-Farben + prozedurale Oberflächenmuster im Shader
// (Dachziegel, Stroh, Bretter, Mauerwerk, Schiefer, Pflaster ...).
// Das Muster steht pro Vertex im Attribut "pat" (siehe kit.ts → P).
//
// Zusätzlich (alles im Grafikprogramm, kostet keinen Speicher):
// - Relief: Fugen und Ziegelkanten werfen im Streiflicht kleine Schatten
//   (aus dem Muster wird eine Höhe abgeleitet, die das Licht verschiebt).
// - Verwitterung: Wände werden zum Boden hin dunkler und leicht moosig.
// - Farbvariation: jedes Gebäude ist um etwa ±6 % heller/dunkler und
//   minimal anders getönt, damit Straßen nicht aus Kopien bestehen.
// - Fensterglas glänzt und spiegelt den Himmel.
import * as THREE from 'three';

const PATTERN_GLSL = /* glsl */ `
varying float vPat;
varying vec3 vWPos;
varying float vAO;
varying float vLocalY;
varying vec3 vVar;
float hsh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gap(float v, float w) { float f = fract(v); return smoothstep(0.0, w, f) * smoothstep(0.0, w, 1.0 - f); }
// Reliefhöhe des Musters (1 = Oberfläche, 0 = Fuge); wird in patternShade gesetzt
float gH = 1.0;
float patternShade(float pat, vec3 p) {
  float s = p.x + p.z;
  gH = 1.0;
  if (pat < 0.5) return 1.0;
  if (pat < 1.5) { // Dachziegel
    float row = p.y * 13.0; float r = floor(row);
    float u = s * 6.0 + r * 0.5;
    float a = gap(row, 0.18), b = gap(u, 0.08);
    gH = a * mix(0.75, 1.0, b) * (0.55 + 0.45 * fract(row));
    return mix(0.62, 1.0, a) * mix(0.8, 1.0, b) * (0.82 + 0.18 * fract(row)) * (0.9 + 0.18 * hsh(vec2(floor(u), r)));
  }
  if (pat < 2.5) { // Stroh
    float row = p.y * 7.0;
    float st = hsh(vec2(floor(s * 55.0), floor(row)));
    float a = gap(row, 0.25);
    gH = a * (0.75 + 0.25 * st);
    return (0.8 + 0.28 * st) * mix(0.7, 1.0, a) * (0.85 + 0.15 * fract(row));
  }
  if (pat < 3.5) { // Holzbretter (waagerecht)
    float row = p.y * 11.0;
    float a = gap(row, 0.12);
    gH = a;
    return mix(0.68, 1.0, a) * (0.86 + 0.2 * hsh(vec2(floor(row), floor(s * 1.7))));
  }
  if (pat < 4.5) { // Mauerwerk
    float row = p.y * 8.0; float r = floor(row);
    float u = s * 4.5 + r * 0.5;
    float a = gap(row, 0.1), b = gap(u, 0.06);
    gH = a * b;
    return mix(0.7, 1.0, a) * mix(0.72, 1.0, b) * (0.84 + 0.26 * hsh(vec2(floor(u), r)));
  }
  if (pat < 5.5) { // Schiefer
    float row = p.y * 19.0; float r = floor(row);
    float u = s * 9.0 + r * 0.5;
    float a = gap(row, 0.16), b = gap(u, 0.08);
    gH = a * mix(0.7, 1.0, b) * (0.55 + 0.45 * fract(row));
    return mix(0.62, 1.0, a) * mix(0.78, 1.0, b) * (0.8 + 0.3 * hsh(vec2(floor(u), r)));
  }
  if (pat < 6.5) { // Pflaster (Boden)
    float row = p.z * 6.0; float r = floor(row);
    float u = p.x * 6.0 + r * 0.5;
    float a = gap(row, 0.14), b = gap(u, 0.14);
    gH = a * b;
    return mix(0.68, 1.0, a) * mix(0.68, 1.0, b) * (0.84 + 0.24 * hsh(vec2(floor(u), r)));
  }
  if (pat < 7.5) { // Senkrechte Bretter (Türen, Scheunen)
    float col = s * 12.0;
    float a = gap(col, 0.12);
    gH = a;
    return mix(0.68, 1.0, a) * (0.86 + 0.2 * hsh(vec2(floor(col), 3.0)));
  }
  if (pat < 8.5) { // Putz (leicht fleckig)
    return 0.94 + 0.08 * hsh(vec2(floor(s * 9.0), floor(p.y * 9.0)));
  }
  if (pat < 9.5) { // Ackerfurchen (entlang x)
    float a = gap(p.z * 7.0, 0.45);
    gH = a;
    return mix(0.72, 1.05, a);
  }
  if (pat < 10.5) { // Wiese/Laub (fein gesprenkelt)
    return 0.85 + 0.25 * hsh(vec2(floor(p.x * 14.0), floor(p.z * 14.0 + p.y * 14.0)));
  }
  // 11: Fensterglas – glatt, Glanz kommt über die Rauheit (siehe unten)
  return 1.0;
}
// Licht-Verschiebung aus einer Höhe (Verfahren von M. Mikkelsen, ohne Textur-Koordinaten)
vec3 reliefNormal(vec3 surfPos, vec3 n, float h, float faceDir) {
  vec2 dH = vec2(dFdx(h), dFdy(h));
  vec3 sx = dFdx(surfPos), sy = dFdy(surfPos);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
  return normalize(abs(det) * n - grad);
}
`;

function patch(mat: THREE.Material) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float pat;
varying float vPat;
varying vec3 vWPos;
varying float vAO;
varying float vLocalY;
varying vec3 vVar;
float vnHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// weiches Rauschen: Nachbarn unterscheiden sich, Bewegte Dinge (Schiffe) flackern nicht
float vNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(vnHash(i), vnHash(i + vec2(1.0, 0.0)), f.x), mix(vnHash(i + vec2(0.0, 1.0)), vnHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vPat = pat;
vLocalY = position.y;
vAO = 0.72 + 0.28 * smoothstep(-0.05, 0.45, position.y);`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
vec4 wp4 = vec4(transformed, 1.0);
vec4 org4 = vec4(0.0, 0.0, 0.0, 1.0);
#ifdef USE_INSTANCING
wp4 = instanceMatrix * wp4;
org4 = instanceMatrix * org4;
#endif
vWPos = (modelMatrix * wp4).xyz;
vec2 org = (modelMatrix * org4).xz * 0.43;
vVar = vec3(vNoise(org), vNoise(org + 17.3), vNoise(org - 31.7)) - 0.5;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
${PATTERN_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb *= patternShade(vPat, vWPos) * vAO;
// Farbvariation je Gebäude: Helligkeit ±6 %, Farbton minimal
diffuseColor.rgb *= (1.0 + vVar.x * 0.12) * (vec3(1.0) + vec3(vVar.y, 0.0, vVar.z) * 0.06);
float relief = gH;
// Verwitterung: Wände und Holz unten dunkler und leicht moosig (nicht bei Boden, Glas, glatten Teilen)
if ((vPat > 0.5 && vPat < 5.5) || (vPat > 6.5 && vPat < 8.5)) {
  float wy = 1.0 - smoothstep(0.0, 0.34, vLocalY);
  float wn = hsh(floor(vWPos.xz * 9.0 + vWPos.y * 6.0));
  diffuseColor.rgb *= 1.0 - wy * (0.16 + 0.08 * wn);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.86, 0.96, 0.74), wy * 0.4);
}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
if (vPat > 10.5) { roughnessFactor = 0.12; diffuseColor.rgb *= 0.8; }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  // Relief nur, wenn die Fugen größer als ein Bildpunkt sind (sonst flimmert es)
  float px = length(fwidth(vWPos));
  float fade = 1.0 - smoothstep(0.01, 0.035, px);
  if (fade > 0.0) normal = reliefNormal(-vViewPosition, normal, relief * 0.014 * fade, faceDirection);
}`);
  };
  mat.customProgramCacheKey = () => 'neue-ufer-pattern-v2';
}

export function buildingMaterial(opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  // Weiche Schattierung: runde Teile (Fässer, Köpfe, Kuppeln) wirken rund,
  // Quader und Dachflächen behalten ihre eigenen, harten Flächen (siehe kit.ts).
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.82, metalness: 0, ...opts });
  patch(m);
  return m;
}
