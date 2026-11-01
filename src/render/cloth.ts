// Wehende Stoff-Fahnen (Gebäude und Schiffe): ein fein unterteiltes Tuch, das im Grafikprogramm Wellen
// schlägt – am Mast fest, zum freien Ende hin immer stärker. Falten werden leicht schattiert, damit das
// Tuch nach Stoff aussieht und nicht nach einem flachen Brett. Kostet keinen zusätzlichen Speicher je Bild;
// die Uhr (windTime) teilt es sich mit Bäumen und Gras, die Fahnen wehen also im selben Wind.
import * as THREE from 'three';
import { windTime } from './vegetation';

/**
 * Tuch-Form: Oberkante am Mast bei y = 0, Mastkante bei z = 0, das Tuch reicht bis z = len (Breite h nach unten).
 * taper = 0: rechteckige Fahne; taper → 1: spitzer Wimpel (das Ende läuft in der Mitte zusammen).
 * cuv.x = 0 am Mast … 1 am freien Ende (danach richtet sich, wie stark das Tuch weht).
 */
export function clothGeometry(len: number, h: number, taper = 0, segX = 8, segY = 3): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], nor: number[] = [], idx: number[] = [];
  for (let i = 0; i <= segX; i++) {
    const u = i / segX, half = (h / 2) * (1 - taper * u * 0.94);
    for (let j = 0; j <= segY; j++) {
      const v = j / segY;
      pos.push(0, -h / 2 + half - v * half * 2, u * len);
      uv.push(u, v);
      nor.push(1, 0, 0);
    }
  }
  const row = segY + 1;
  for (let i = 0; i < segX; i++) for (let j = 0; j < segY; j++) {
    const a = i * row + j, b = a + row;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('cuv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Stoff-Material (beidseitig). Ohne Farbe: weiß, die Farbe kommt je Kopie (Instanzen). */
export function clothMaterial(color = 0xffffff): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uWind;
attribute vec2 cuv;
varying float vFold;`)
      .replace('#include <beginnormal_vertex>', `
vec3 clothOrg = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#ifdef USE_INSTANCING
  clothOrg += instanceMatrix[3].xyz;
#endif
float cu = cuv.x;
float cph = cu * 7.5 - uWind * 7.0 + clothOrg.x * 1.7 + clothOrg.z * 1.3 + cuv.y * 0.9;
float cAmp = 0.16 * position.z;
// Steigung der Welle entlang des Tuchs (für das Licht auf den Falten)
float cSlope = 0.16 * (sin(cph) + 7.5 * cu * cos(cph));
vec3 objectNormal = normalize(vec3(1.0, 0.0, -cSlope));
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(0.0, 0.0, 1.0);
#endif
vFold = cos(cph) * min(1.0, cu * 2.5);`)
      .replace('#include <begin_vertex>', `
vec3 transformed = vec3(position);
transformed.x += sin(cph) * cAmp;
// das freie Ende hängt ein wenig durch und zuckt leicht
transformed.y -= cu * cu * position.z * (0.10 + 0.05 * sin(cph * 0.5 + 1.0));`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vFold;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb *= 0.86 + 0.14 * vFold;`);
  };
  m.customProgramCacheKey = () => 'stoff-fahne';
  return m;
}
