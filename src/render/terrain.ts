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
// ---- Pflaster ----
// Kopfsteinpflaster wie in alten Städten: Reihen QUER zur Fahrtrichtung, jede Reihe gegen die vorige versetzt,
// Steine unterschiedlich lang, leicht gerundet, grau/beige/bräunlich, schmale dunkle Fugen. Das Muster steht
// je Feld im Wegebild (blau, siehe updateRoads): Reihen für waagerechte oder senkrechte Wege (Kreuzungen und
// Plätze nach der längeren Richtung), in Kurven ein Fächer um die Innenecke. Wo zwei Muster aneinanderstoßen,
// enden die Steine genau an der Feldkante bzw. die Reihengrenze dort bleibt gerade – so läuft keine Naht quer
// durch einen Stein. Zum Rand hin werden die Steine nach und nach kleiner und verschwinden einzeln in
// festgetretener Erde, die weich ins Gras oder in den Sand übergeht (keine Kante, keine Matte).
const float PK = 6.0; // Steinreihen je Feld (gerade Wege)
const float NF = 5.0; // Steinreihen in einer Kurve (Viertelkreis)
float tCode(vec2 tile) { return floor(texture2D(uRoad, (tile + 0.5) / uRN).b * 127.5 + 0.5); }
// Verschiebung einer Reihengrenze i; null an Feldkanten, an denen ein anderes Muster anschließt
float tRow(float i, float salt, float a0, float a1) {
  return (th(vec2(i, salt)) - 0.5) * 0.28 * (1.0 - a0 * (1.0 - step(0.5, abs(i - a1))));
}
vec3 tPave(vec2 q, float e, vec3 ground, float mid, float lo, float hi, float hi2, float pxq, out float hOut) {
  vec2 tile = floor(q);
  vec4 tx0 = texture2D(uRoad, (tile + 0.5) / uRN);
  float code = floor(tx0.b * 127.5 + 0.5), cor = floor(tx0.a * 127.5 + 0.5);
  // Abstand zu einer Fuge (in Reihenbreiten), nur in Innenecken zwischen verschiedenen Mustern
  float miter = 1e4;
  if (cor > 0.5) {
    // Innenecke: gehört ganz zu einem Nachbarn; gerade Fugen an den Kanten zu den anderen
    float dir = mod(cor - 1.0, 4.0), jm = floor((cor - 1.0) / 8.0);
    vec2 fq = q - tile;
    if (mod(jm, 2.0) > 0.5) miter = min(miter, 1.0 - fq.x);
    if (mod(floor(jm * 0.5), 2.0) > 0.5) miter = min(miter, fq.x);
    if (mod(floor(jm * 0.25), 2.0) > 0.5) miter = min(miter, 1.0 - fq.y);
    if (jm > 7.5) miter = min(miter, fq.y);
    miter *= PK;
    tile += dir < 0.5 ? vec2(1.0, 0.0) : dir < 1.5 ? vec2(-1.0, 0.0) : dir < 2.5 ? vec2(0.0, 1.0) : vec2(0.0, -1.0);
    code = tCode(tile);
  } else if (code < 0.5) {
    // Randstück auf einem Feld ohne Weg: Muster des nächsten Wegfelds fortsetzen (erst die nähere Kante)
    vec2 f = q - tile - 0.5;
    vec2 sx = vec2(f.x < 0.0 ? -1.0 : 1.0, 0.0), sy = vec2(0.0, f.y < 0.0 ? -1.0 : 1.0);
    bool xf = abs(f.x) > abs(f.y);
    vec2 n1 = xf ? sx : sy, n2 = xf ? sy : sx;
    float c1 = tCode(tile + n1), c2 = tCode(tile + n2);
    if (c1 > 0.5) {
      tile += n1; code = c1;
      // Innenecke (Weg auf beiden Seiten, anderes Muster oder andere Nahtstellen): schräge Fuge statt
      // durchgeschnittener Steine
      if (c2 > 0.5 && abs(c1 - c2) > 0.5) miter = abs(abs(f.x) - abs(f.y)) * 0.7071 * PK;
    } else if (c2 > 0.5) { tile += n2; code = c2; }
    else { tile += sx + sy; code = tCode(tile); }
  }
  float cls = mod(code, 8.0), bits = floor(code / 8.0);
  float vLo = mod(bits, 2.0), vHi = mod(floor(bits * 0.5), 2.0), uLo = mod(floor(bits * 0.25), 2.0), uHi = floor(bits * 0.125);
  // U zählt die Reihen entlang der Fahrtrichtung, V läuft entlang einer Reihe (Maß: eine Reihe = 1).
  // U0/U1: Reihengrenzen an den Feldkanten; vA/vB: Nahtstellen entlang der Reihe
  float U, V, U0, U1, tw, salt = 0.0, vA = -1e4, vB = 1e4;
  if (cls > 2.5) {
    // Kurve: Reihen fächerförmig um die Innenecke; die beiden Kanten zu den Nachbarwegen sind Reihengrenzen
    // Nahe der Innenecke weniger Reihen (sonst laufen viele Keile in einem Punkt zusammen):
    // ganz innen ein Stein, dann ein Ring mit 3 Reihen, außen NF Reihen; dazwischen runde Fugen
    float k = cls - 3.0;
    vec2 d = q - tile - vec2(1.0 - mod(k, 2.0), k < 1.5 ? 1.0 : 0.0);
    float r = length(d);
    float nr = r < 0.22 ? 1.0 : (r < 0.5 ? 3.0 : NF);
    U = atan(abs(d.y), abs(d.x)) * (nr / 1.5707963); V = r * PK;
    if (nr < 1.5) vB = 0.22 * PK; else if (nr < 3.5) { vA = 0.22 * PK; vB = 0.5 * PK; } else vA = 0.5 * PK;
    U0 = 0.0; U1 = nr; uLo = 1.0; uHi = 1.0; tw = U / nr; salt = dot(tile, vec2(3.1, 5.3)) + nr * 1.7;
  } else if (cls > 1.5) {
    U = q.y * PK; V = q.x * PK; U0 = tile.y * PK; U1 = U0 + PK; tw = q.y - tile.y;
    if (vLo > 0.5) vA = tile.x * PK;
    if (vHi > 0.5) vB = (tile.x + 1.0) * PK;
  } else {
    U = q.x * PK; V = q.y * PK; U0 = tile.x * PK; U1 = U0 + PK; tw = q.x - tile.x;
    if (vLo > 0.5) vA = tile.y * PK;
    if (vHi > 0.5) vB = (tile.y + 1.0) * PK;
  }
  // Reihen leicht gewellt – nicht an Kanten, an denen ein anderes Muster anschließt
  float wob = 1.0;
  if (uLo > 0.5) wob = min(wob, smoothstep(0.0, 0.3, tw));
  if (uHi > 0.5) wob = min(wob, smoothstep(1.0, 0.7, tw));
  U += (mid - 0.5) * 0.3 * wob;
  float ri = floor(U), rs0 = 17.3 + salt;
  float u0 = ri + tRow(ri, rs0, uLo, U0) + tRow(ri, rs0, uHi, U1);
  float u1 = ri + 1.0 + tRow(ri + 1.0, rs0, uLo, U0) + tRow(ri + 1.0, rs0, uHi, U1);
  if (U < u0) { u1 = u0; ri -= 1.0; u0 = ri + tRow(ri, rs0, uLo, U0) + tRow(ri, rs0, uHi, U1); }
  else if (U >= u1) { u0 = u1; ri += 1.0; u1 = ri + 1.0 + tRow(ri + 1.0, rs0, uLo, U0) + tRow(ri + 1.0, rs0, uHi, U1); }
  // entlang der Reihe: Steine unterschiedlich lang, jede Reihe gegen die vorige versetzt
  const float SV = 1.25; // Länge einer V-Einheit in Reihenbreiten
  float off = th(vec2(ri, 5.1 + salt)) * 9.0;
  V = V / SV + off; vA = vA / SV + off; vB = vB / SV + off;
  float rs = ri * 7.31 + salt;
  float j = floor(V);
  float b0 = j + (th(vec2(j, rs)) - 0.5) * 0.6, b1 = j + 1.0 + (th(vec2(j + 1.0, rs)) - 0.5) * 0.6;
  if (V < b0) { b1 = b0; j -= 1.0; b0 = j + (th(vec2(j, rs)) - 0.5) * 0.6; }
  else if (V >= b1) { b0 = b1; j += 1.0; b1 = j + 1.0 + (th(vec2(j + 1.0, rs)) - 0.5) * 0.6; }
  // Naht: der Stein endet genau an der Feldkante (kleiner Stein statt halbem, durchgeschnittenem)
  float part = 0.0;
  if (vA > b0 && vA < b1) { if (V < vA) b1 = vA; else { b0 = vA; part = 1.0; } }
  if (vB > b0 && vB < b1) { if (V < vB) b1 = vB; else { b0 = vB; part = 2.0; } }
  vec2 id = vec2(j + part * 0.31, ri) + salt;
  // Stein: Rechteck mit gerundeten Ecken, Kante etwas unruhig (Naturstein); Fuge schmal.
  // Zum Rand hin schrumpft jeder Stein unterschiedlich schnell und verschwindet schließlich ganz; kleine
  // Steine werden dabei runder (Kiesel statt spitzer Scherben).
  float edge = smoothstep(0.24, 0.64, e);
  float shr = (1.0 - edge) * (0.5 + 0.55 * th(id + 11.1));
  float gap = 0.035 + th(id + 2.0) * 0.025;
  float hu = (u1 - u0) * 0.5 - gap - shr, hv = (b1 - b0) * 0.5 * SV - gap - shr;
  vec2 lp = vec2(U - (u0 + u1) * 0.5, (V - (b0 + b1) * 0.5) * SV);
  float hm = max(min(hu, hv), 0.0);
  float rad = hm * min(1.0, 0.55 + shr * 1.5);
  vec2 dq = abs(lp) - vec2(hu, hv) + rad;
  float sdf = hm > 0.0 ? length(max(dq, 0.0)) + min(max(dq.x, dq.y), 0.0) - rad : 1.0;
  sdf += (hi - 0.5) * 0.06 + (hi2 - 0.5) * 0.012;
  // Fuge in der Innenecke einer Kreuzung
  sdf = max(sdf, 0.045 - miter);
  // Größe eines Bildpunkts in Reihenbreiten: glatte Kanten, aus der Ferne nur noch die Mischfarbe
  float px = pxq * PK;
  float st = 1.0 - smoothstep(-px * 0.6, px * 0.6, sdf);
  float det = 1.0 - smoothstep(0.3, 0.7, px);
  // festgetretene Erde: der Untergrund (Gras, Sand) dunkler und erdiger, zur Wegmitte hin mehr
  vec3 earth = mix(vec3(0.17, 0.13, 0.085), ground * 0.7, 0.35);
  vec3 soil = mix(ground, earth, 0.4 + 0.5 * smoothstep(0.0, 0.6, edge));
  // dunkle Fuge direkt um jeden Stein (er liegt eingebettet), stellenweise Moos
  vec3 fuge = mix(vec3(0.075, 0.064, 0.048), vec3(0.06, 0.085, 0.032), smoothstep(0.55, 0.8, mid) * 0.6);
  float rim = 1.0 - smoothstep(0.0, 0.14, sdf);
  // Farbe je Stein: grau, beige, bräunlich, ab und zu dunkel
  float r1 = th(id + 7.0), r2 = th(id + 8.3), r3 = th(id + 9.9);
  vec3 sc = mix(vec3(0.16, 0.15, 0.135), vec3(0.25, 0.212, 0.152), smoothstep(0.25, 0.8, r1));
  sc = mix(sc, vec3(0.185, 0.132, 0.088), step(0.72, r2) * 0.85);
  sc = mix(sc, vec3(0.11, 0.107, 0.1), step(0.9, r3) * 0.8);
  sc *= (0.82 + 0.32 * th(id + 12.7)) * (0.9 + 0.2 * hi2);
  // gewölbt: zum Rand hin dunkler; Schmutz am Wegrand und fleckig; in der Mitte etwas abgelaufen (heller)
  float inner = smoothstep(0.0, 0.22, -sdf);
  sc *= 0.72 + 0.28 * inner;
  float dirt = (1.0 - smoothstep(0.5, 0.9, e)) * 0.4 + smoothstep(0.6, 0.85, lo * 0.5 + mid * 0.5) * 0.25;
  sc = mix(sc, vec3(0.16, 0.12, 0.075), dirt * (1.0 - inner * 0.5));
  sc *= 1.0 + smoothstep(0.85, 1.0, e) * 0.08;
  // Fugen werden mit kleiner werdenden Steinen (Zoom) heller, damit sie nicht flimmern
  vec3 avgS = vec3(0.17, 0.152, 0.12) * (0.9 + 0.2 * lo);
  fuge = mix(fuge, avgS * 0.8, smoothstep(0.12, 0.4, px) * 0.6);
  vec3 bed = mix(soil, fuge, rim * smoothstep(0.05, 0.4, edge));
  vec3 near = mix(bed, sc, st);
  vec3 farC = mix(soil, avgS, edge * 0.9);
  hOut = (st * (sqrt(inner) * 0.016 + (hi2 - 0.5) * 0.003) - rim * (1.0 - st) * 0.004) * det;
  return mix(farC, near, det);
}
vec3 terrainColor(vec3 p, vec4 w) {
  vec2 q = p.xz;
  // Größe eines Bildpunkts auf dem Boden (außerhalb aller Verzweigungen berechnet, für das Pflaster)
  float pxq = length(fwidth(q));
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
    // Wege laufen vor der Wasserlinie aus: wo der Strand abfällt, wird der Weg schmaler und endet rund
    // (kein abgeschnittener Fleck am Wasser, kein Pflaster unter Wasser)
    float shore = 1.0 - smoothstep(0.07, 0.25, p.y);
    float en = (mid - 0.5) * 0.24 + (hi - 0.5) * 0.08 - shore * 0.7;
    float e = rr + en;
    float pave = clamp(rd.g / max(rr, 0.001), 0.0, 1.0);
    // Pflaster: ruhigerer Rand (die Steine selbst machen ihn unregelmäßig), deckt bis etwas weiter nach außen
    float ep = rr + (mid - 0.5) * 0.12 - shore * 0.7;
    float cover = mix(smoothstep(0.40, 0.55, e), smoothstep(0.08, 0.4, ep + (lo - 0.5) * 0.12), pave);
    // Rand: niedergetretenes, trockenes Gras mit Erde
    float worn = smoothstep(0.12, 0.42, mix(e, ep, pave)) * (1.0 - cover);
    c = mix(c, mix(c, vec3(0.27, 0.22, 0.11), 0.55) * (0.85 + 0.3 * hi), worn * 0.8);
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
    // Pflaster: Kopfsteine in Reihen quer zur Wegrichtung (tPave)
    vec3 stone = c;
    float hStone = 0.0;
    if (pave > 0.01) stone = tPave(q, ep, c, mid, lo, hi, hi2, pxq, hStone);
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
  /** Pflastermuster je Feld (0 = kein Weg, 1 = waagerecht, 2 = senkrecht, 3–6 = Kurve) */
  private roadCls: Uint8Array;
  /** Innenecken: 0 = keine, sonst 1 + Richtung des zuständigen Wegfelds + 8 × Fugen-Bits (siehe updateRoads) */
  private roadCorner: Uint8Array;
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
    this.roadCls = new Uint8Array(N * N);
    this.roadCorner = new Uint8Array(N * N);
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
    this.mat.customProgramCacheKey = () => 'terrain-welt-v6';

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
    const mark = (i: number) => {
      const y = (i / N) | 0;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    };
    const changed: number[] = [];
    const put = (i: number) => {
      const v = g.seen[i] ? g.roads[i] : 0;
      if (v === shown[i] && !all) return;
      shown[i] = v;
      data[i * 4] = v === 1 ? 255 : 0;
      data[i * 4 + 1] = v === 2 ? 255 : 0;
      changed.push(i);
      mark(i);
    };
    // blau: Pflastermuster je Feld (Art + Nahtstellen, siehe tPave im Farbprogramm). Art: 0 = kein Weg,
    // 1 = Reihen für einen waagerechten Weg, 2 = für einen senkrechten, 3–6 = Kurve (Fächer um die Innenecke).
    // Bits: 8/16 = Naht an der unteren/oberen Feldkante entlang der Reihe (dort endet jeder Stein genau an der
    // Kante, weil nebenan ein anderes Muster liegt), 32/64 = Reihengrenze an der unteren/oberen Kante bleibt
    // gerade (damit sie genau auf die Reihen bzw. den Fächer des Nachbarfelds trifft). Wert × 2.
    const cls = this.roadCls;
    const at = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && shown[y * N + x] !== 0;
    const run = (x: number, y: number, dx: number, dy: number) => {
      let n = 0;
      for (let k = 1; k <= 4 && at(x + dx * k, y + dy * k); k++) n++;
      return n;
    };
    const classify = (i: number) => {
      if (!shown[i]) return 0;
      const x = i % N, y = (i / N) | 0;
      const e = at(x + 1, y), w = at(x - 1, y), s = at(x, y + 1), n = at(x, y - 1);
      const hor = e || w, ver = s || n;
      // echte Kurve: genau ein Nachbar quer und einer längs, und das Eckfeld dazwischen ist kein Weg
      if (hor && ver && e !== w && s !== n && !at(x + (e ? 1 : -1), y + (s ? 1 : -1))) return 3 + (e ? 0 : 1) + (s ? 0 : 2);
      if (hor && !ver) return 1;
      if (ver && !hor) return 2;
      // Kreuzung, Einmündung, breiter Weg, Platz: die längere Richtung bestimmt die Reihen
      return run(x, y, 1, 0) + run(x, y, -1, 0) >= run(x, y, 0, 1) + run(x, y, 0, -1) ? 1 : 2;
    };
    // Innenecken (Feld ohne Weg zwischen einem Weg daneben und einem darüber/darunter mit anderem Muster):
    // das Pflaster der abgerundeten Ecke gehört ganz zu EINEM Nachbarn (Richtung 0–3 = O, W, S, N), zu den
    // anderen Nachbarn läuft eine gerade Fuge an der Feldkante (Bits jm: 1 O, 2 W, 4 S, 8 N).
    // Vorher wurde die Ecke schräg zwischen zwei Mustern geteilt – das gab dreieckige Steinscherben.
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const cornerOf = (i: number): number => {
      if (shown[i]) return 0;
      const x = i % N, y = (i / N) | 0;
      const nc = DIRS.map(([dx, dy]) => (at(x + dx, y + dy) ? cls[(y + dy) * N + x + dx] : 0));
      const horC = nc[0] || nc[1], verC = nc[2] || nc[3];
      if (!horC || !verC || nc.filter((c) => c).every((c) => c === (nc[0] || nc[1]))) return 0;
      // bevorzugt der Nachbar, dessen Reihen sich ohne Bruch in die Ecke fortsetzen (waagerechte Reihen
      // ober-/unterhalb, senkrechte links/rechts), sonst der obere/untere
      let own = [2, 3].find((d) => nc[d] === 1) ?? [0, 1].find((d) => nc[d] === 2) ?? (nc[2] ? 2 : 3);
      let jm = 0;
      for (let d = 0; d < 4; d++) if (d !== own && nc[d] && nc[d] !== nc[own]) jm |= 1 << d;
      return 1 + own + 8 * jm;
    };
    const corner = this.roadCorner;
    const encode = (i: number) => {
      const c = cls[i];
      let v = c;
      if (c === 1 || c === 2) {
        const x = i % N, y = (i / N) | 0;
        const other = (xx: number, yy: number) => {
          if (xx < 0 || yy < 0 || xx >= N || yy >= N) return false;
          const j = yy * N + xx, o = cls[j];
          if (o !== 0) return o !== c;
          // Innenecke, die zu einem Nachbarn mit anderem Muster gehört
          const k = corner[j];
          if (!k) return false;
          const [dx, dy] = DIRS[(k - 1) & 3];
          const ow = (yy + dy) * N + xx + dx;
          return ow !== i && cls[ow] !== c;
        };
        // waagerecht: Reihen zählen in x, Steine liegen in y – senkrecht umgekehrt
        const [ax, ay] = c === 1 ? [0, 1] : [1, 0];
        if (other(x - ax, y - ay)) v |= 8;
        if (other(x + ax, y + ay)) v |= 16;
        if (other(x - ay, y - ax)) v |= 32;
        if (other(x + ay, y + ax)) v |= 64;
      }
      if (data[i * 4 + 2] !== v * 2) { data[i * 4 + 2] = v * 2; mark(i); }
      if (data[i * 4 + 3] !== corner[i] * 2) { data[i * 4 + 3] = corner[i] * 2; mark(i); }
    };
    if (all) {
      for (let i = 0; i < N * N; i++) put(i);
      for (let i = 0; i < N * N; i++) cls[i] = classify(i);
      for (let i = 0; i < N * N; i++) corner[i] = cornerOf(i);
      for (let i = 0; i < N * N; i++) encode(i);
    } else {
      for (const i of tiles) put(i);
      // Muster hängen von Nachbarn bis 4 Felder weit ab: dieses Umfeld neu einordnen, eins weiter neu eintragen
      const box = (r: number, f: (i: number) => void) => {
        const seen = new Set<number>();
        for (const i of changed) {
          const x = i % N, y = (i / N) | 0;
          for (let yy = Math.max(0, y - r); yy <= Math.min(N - 1, y + r); yy++)
            for (let xx = Math.max(0, x - r); xx <= Math.min(N - 1, x + r); xx++) {
              const j = yy * N + xx;
              if (!seen.has(j)) { seen.add(j); f(j); }
            }
        }
      };
      if (changed.length > 1500) {
        // sehr viel auf einmal (z. B. große Gegend neu entdeckt): einmal alles statt vieler Umfelder
        for (let i = 0; i < N * N; i++) cls[i] = classify(i);
        for (let i = 0; i < N * N; i++) corner[i] = cornerOf(i);
        for (let i = 0; i < N * N; i++) encode(i);
      } else {
        box(5, (j) => { cls[j] = classify(j); });
        box(6, (j) => { corner[j] = cornerOf(j); });
        box(7, encode);
      }
    }
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
