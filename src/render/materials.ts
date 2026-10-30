// Gebäude-Material: Vertex-Farben + prozedurale Oberflächenmuster im Shader
// (Dachziegel, Stroh, Bretter, Mauerwerk, Schiefer, Pflaster ...).
// Das Muster steht pro Vertex im Attribut "pat" (siehe kit.ts → P).
import * as THREE from 'three';

const PATTERN_GLSL = /* glsl */ `
varying float vPat;
varying vec3 vWPos;
varying float vAO;
float hsh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gap(float v, float w) { float f = fract(v); return smoothstep(0.0, w, f) * smoothstep(0.0, w, 1.0 - f); }
float patternShade(float pat, vec3 p) {
  float s = p.x + p.z;
  if (pat < 0.5) return 1.0;
  if (pat < 1.5) { // Dachziegel
    float row = p.y * 13.0; float r = floor(row);
    float u = s * 6.0 + r * 0.5;
    return mix(0.62, 1.0, gap(row, 0.18)) * mix(0.8, 1.0, gap(u, 0.08)) * (0.82 + 0.18 * fract(row)) * (0.9 + 0.18 * hsh(vec2(floor(u), r)));
  }
  if (pat < 2.5) { // Stroh
    float row = p.y * 7.0;
    float st = hsh(vec2(floor(s * 55.0), floor(row)));
    return (0.8 + 0.28 * st) * mix(0.7, 1.0, gap(row, 0.25)) * (0.85 + 0.15 * fract(row));
  }
  if (pat < 3.5) { // Holzbretter (waagerecht)
    float row = p.y * 11.0;
    return mix(0.68, 1.0, gap(row, 0.12)) * (0.86 + 0.2 * hsh(vec2(floor(row), floor(s * 1.7))));
  }
  if (pat < 4.5) { // Mauerwerk
    float row = p.y * 8.0; float r = floor(row);
    float u = s * 4.5 + r * 0.5;
    return mix(0.7, 1.0, gap(row, 0.1)) * mix(0.72, 1.0, gap(u, 0.06)) * (0.84 + 0.26 * hsh(vec2(floor(u), r)));
  }
  if (pat < 5.5) { // Schiefer
    float row = p.y * 19.0; float r = floor(row);
    float u = s * 9.0 + r * 0.5;
    return mix(0.62, 1.0, gap(row, 0.16)) * mix(0.78, 1.0, gap(u, 0.08)) * (0.8 + 0.3 * hsh(vec2(floor(u), r)));
  }
  if (pat < 6.5) { // Pflaster (Boden)
    float row = p.z * 6.0; float r = floor(row);
    float u = p.x * 6.0 + r * 0.5;
    return mix(0.68, 1.0, gap(row, 0.14)) * mix(0.68, 1.0, gap(u, 0.14)) * (0.84 + 0.24 * hsh(vec2(floor(u), r)));
  }
  if (pat < 7.5) { // Senkrechte Bretter (Türen, Scheunen)
    float col = s * 12.0;
    return mix(0.68, 1.0, gap(col, 0.12)) * (0.86 + 0.2 * hsh(vec2(floor(col), 3.0)));
  }
  if (pat < 8.5) { // Putz (leicht fleckig)
    return 0.94 + 0.08 * hsh(vec2(floor(s * 9.0), floor(p.y * 9.0)));
  }
  if (pat < 9.5) { // Ackerfurchen (entlang x)
    return mix(0.72, 1.05, gap(p.z * 7.0, 0.45));
  }
  // 10: Wiese/Laub (fein gesprenkelt)
  return 0.85 + 0.25 * hsh(vec2(floor(p.x * 14.0), floor(p.z * 14.0 + p.y * 14.0)));
}
`;

function patch(mat: THREE.Material) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float pat;
varying float vPat;
varying vec3 vWPos;
varying float vAO;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vPat = pat;
vAO = 0.72 + 0.28 * smoothstep(-0.05, 0.45, position.y);`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
vec4 wp4 = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
wp4 = instanceMatrix * wp4;
#endif
vWPos = (modelMatrix * wp4).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
${PATTERN_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb *= patternShade(vPat, vWPos) * vAO;`);
  };
  mat.customProgramCacheKey = () => 'neue-ufer-pattern-v1';
}

export function buildingMaterial(opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.82, metalness: 0, ...opts });
  patch(m);
  return m;
}
