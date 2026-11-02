// Gebietsgrenze als gestrichelte Linie in Besitzerfarbe (wie eine Grenze auf einer Landkarte).
//
// Früher lief die Grenze als Band genau auf den Feldkanten: eckige Treppen, und an der Küste lag sie als
// Zickzack auf dem Wasser. Danach war sie ein weiches, hellblaues Band – das sah aus wie ein Bach. Jetzt:
// - Für jeden Besitzer wird „gehört ihm“ (1) / „gehört ihm nicht“ (0) je Feld leicht weichgezeichnet und
//   die Linie etwas innerhalb der Feldkante nachgezogen (Höhenlinie). Danach werden die Ecken zweimal
//   abgerundet. Die Grenzen zweier Nachbarn liegen so nebeneinander statt übereinander.
// - Wasser übernimmt den Wert des nächsten Landfelds: entlang der Küste entsteht so keine Grenze, und eine
//   Grenze, die zum Meer läuft, endet auf dem Strand vor der Wasserlinie.
// - Gezeichnet wird ein schmales Band, auf das das Grafikprogramm (borderMaterial) feine Striche mit runden
//   Enden malt: in der Besitzerfarbe, mit dunklem Rand, am Bildschirm aus jeder Höhe gleich fein. So ist die
//   Linie auf Gras, Wald, Sand und Fels gleich gut zu sehen und kann nicht mit Wasser verwechselt werden.
// - Jeder Strich ist ganz oder gar nicht da: Striche, die ins Wasser, auf den nassen Strand oder in den Nebel
//   reichen würden, fallen ganz weg (keine Bruchstücke an der Küste).
import * as THREE from 'three';
import { Game } from '../game';
import { T } from '../world';

const FAR = 3; // so viele Felder weit übernimmt das Wasser den Besitz des nächsten Landfelds
const LEVEL = 0.58; // Höhenlinie: etwas über 0,5, damit die Linie knapp im eigenen Gebiet liegt
const HALF = 0.26; // halbe Breite des Bandes (Felder) – die Striche selbst sind schmaler
const DASH = 0.55; // Abstand von Strich zu Strich (Felder)
/** Höhenlinien bei LEVEL eines Feldes f (Werte an den Feldmitten), als Linienzüge in Weltkoordinaten */
function contours(f: Float32Array, N: number, x0: number, y0: number, x1: number, y1: number): number[][] {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= N || y >= N ? 0 : f[y * N + x]);
  // Schnittpunkte auf Gitterkanten: Schlüssel → Punkt
  const pt = new Map<number, [number, number]>();
  const edgeKey = (x: number, y: number, vert: number) => ((y + 1) * (N + 3) + x + 1) * 2 + vert;
  const cross = (xa: number, ya: number, xb: number, yb: number, vert: number): number => {
    const k = edgeKey(xa, ya, vert);
    if (!pt.has(k)) {
      const a = at(xa, ya), b = at(xb, yb);
      const t = Math.abs(b - a) < 1e-6 ? 0.5 : (LEVEL - a) / (b - a);
      pt.set(k, [xa + 0.5 + (xb - xa) * t, ya + 0.5 + (yb - ya) * t]);
    }
    return k;
  };
  const links = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    (links.get(a) ?? links.set(a, []).get(a)!).push(b);
    (links.get(b) ?? links.set(b, []).get(b)!).push(a);
  };
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const a = at(x, y), b = at(x + 1, y), c = at(x + 1, y + 1), d = at(x, y + 1);
    const code = (a > LEVEL ? 1 : 0) | (b > LEVEL ? 2 : 0) | (c > LEVEL ? 4 : 0) | (d > LEVEL ? 8 : 0);
    if (code === 0 || code === 15) continue;
    const top = () => cross(x, y, x + 1, y, 0);
    const right = () => cross(x + 1, y, x + 1, y + 1, 1);
    const bottom = () => cross(x, y + 1, x + 1, y + 1, 0);
    const left = () => cross(x, y, x, y + 1, 1);
    const mid = (a + b + c + d) / 4 > LEVEL;
    switch (code) {
      case 1: case 14: link(left(), top()); break;
      case 2: case 13: link(top(), right()); break;
      case 3: case 12: link(left(), right()); break;
      case 4: case 11: link(right(), bottom()); break;
      case 6: case 9: link(top(), bottom()); break;
      case 7: case 8: link(left(), bottom()); break;
      case 5: if (mid) { link(left(), bottom()); link(top(), right()); } else { link(left(), top()); link(right(), bottom()); } break;
      case 10: if (mid) { link(left(), top()); link(right(), bottom()); } else { link(top(), right()); link(left(), bottom()); } break;
    }
  }
  // Teilstücke zu Linienzügen verketten
  const used = new Set<string>();
  const ek = (a: number, b: number) => (a < b ? a + ':' + b : b + ':' + a);
  const lines: number[][] = [];
  const walk = (start: number) => {
    for (const first of links.get(start) ?? []) {
      if (used.has(ek(start, first))) continue;
      const chain = [start];
      let prev = start, cur = first;
      used.add(ek(prev, cur));
      for (;;) {
        chain.push(cur);
        const nxt = (links.get(cur) ?? []).find((n) => !used.has(ek(cur, n)));
        if (nxt === undefined) break;
        used.add(ek(cur, nxt));
        prev = cur; cur = nxt;
      }
      void prev;
      const flat: number[] = [];
      for (const k of chain) { const p = pt.get(k)!; flat.push(p[0], p[1]); }
      lines.push(flat);
    }
  };
  // offene Enden zuerst (Grenze am Kartenrand), dann geschlossene Ringe
  for (const [k, l] of links) if (l.length === 1) walk(k);
  for (const k of links.keys()) walk(k);
  return lines;
}

/** Ecken abrunden (Chaikin): jede Ecke wird durch zwei Punkte bei 1/4 und 3/4 ersetzt */
function smooth(line: number[], closed: boolean): number[] {
  const n = line.length / 2;
  if (n < 3) return line;
  const out: number[] = [];
  if (!closed) out.push(line[0], line[1]);
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % n;
    const ax = line[i * 2], az = line[i * 2 + 1], bx = line[j * 2], bz = line[j * 2 + 1];
    out.push(ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25, ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75);
  }
  if (!closed) out.push(line[(n - 1) * 2], line[(n - 1) * 2 + 1]);
  return out;
}

/**
 * Grenzlinien aller Besitzer als ein Dreiecksnetz: Farbe und Sichtbarkeit je Ecke, dazu „bd“ =
 * (Weg entlang der Linie in Feldern, Lage quer zur Linie −1 … 1) für die Striche im Grafikprogramm.
 * heightAt = Geländehöhe; colorOf = Farbe eines Besitzers.
 */
export function borderGeometry(g: Game, heightAt: (x: number, z: number) => number, colorOf: (owner: number) => number): THREE.BufferGeometry {
  const N = g.size;
  const pos: number[] = [];
  const col: number[] = [];
  const bd: number[] = [];
  const owners = new Map<number, [number, number, number, number]>();
  for (let i = 0; i < N * N; i++) {
    const o = g.own[i];
    if (o < 0 || g.tiles[i] === T.Wasser || !g.seen[i]) continue;
    const x = i % N, y = (i / N) | 0;
    const b = owners.get(o);
    if (!b) owners.set(o, [x, y, x, y]);
    else { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
  }
  // Besitz je Landfeld; Wasser übernimmt bis FAR Felder weit den Besitz des nächsten Landfelds
  const own = new Int32Array(N * N).fill(-2);
  const q: number[] = [];
  const step = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) if (g.tiles[i] !== T.Wasser) { own[i] = g.own[i]; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    if (step[i] >= FAR) continue;
    const x = i % N, y = (i / N) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const ni = ny * N + nx;
      if (own[ni] !== -2) continue;
      own[ni] = own[i]; step[ni] = step[i] + 1; q.push(ni);
    }
  }
  const f = new Float32Array(N * N);
  const tmp = new Float32Array(N * N);
  const c = new THREE.Color();
  for (const [o, [bx0, by0, bx1, by1]] of owners) {
    const x0 = Math.max(0, bx0 - FAR - 2), y0 = Math.max(0, by0 - FAR - 2);
    const x1 = Math.min(N - 1, bx1 + FAR + 2), y1 = Math.min(N - 1, by1 + FAR + 2);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tmp[y * N + x] = own[y * N + x] === o ? 1 : 0;
    // leicht weichzeichnen (Kreuz aus fünf Feldern): rundere Linie
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const v = (yy: number, xx: number) => (xx < x0 || yy < y0 || xx > x1 || yy > y1 ? 0 : tmp[yy * N + xx]);
      f[y * N + x] = v(y, x) * 0.6 + (v(y - 1, x) + v(y + 1, x) + v(y, x - 1) + v(y, x + 1)) * 0.1;
    }
    const lines = contours(f, N, x0 - 1, y0 - 1, x1 + 1, y1 + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) f[y * N + x] = 0;
    c.setHex(colorOf(o));
    for (let line of lines) {
      const n0 = line.length / 2;
      const closed = n0 > 2 && line[0] === line[line.length - 2] && line[1] === line[line.length - 1];
      if (closed) line = line.slice(0, -2);
      line = smooth(smooth(line, closed), closed);
      addRibbon(line, closed, heightAt, (x, z) => {
        const tx = Math.floor(x), tz = Math.floor(z);
        return tx >= 0 && tz >= 0 && tx < N && tz < N && g.seen[tz * N + tx] ? 1 : 0;
      }, c, pos, col, bd);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.setAttribute('bd', new THREE.Float32BufferAttribute(bd, 2));
  return geo;
}

/**
 * Band entlang eines Linienzugs: drei Reihen (links, Mitte, rechts), damit es dem Boden folgt.
 * Das Band wird an jeder Strichlücke geteilt, und jeder Strich ist ganz oder gar nicht sichtbar: über Wasser,
 * auf dem nassen Strand und im Nebel fehlt er ganz – es gibt keine angeschnittenen Strichstücke.
 */
function addRibbon(line: number[], closed: boolean, heightAt: (x: number, z: number) => number, seen: (x: number, z: number) => number,
  c: THREE.Color, pos: number[], col: number[], bd: number[]) {
  const n = line.length / 2;
  if (n < 2) return;
  // Weg entlang der Linie; bei Ringen leicht gestreckt, damit die Striche am Anfang und Ende genau aufgehen
  const m = closed ? n : n - 1;
  const s = new Float32Array(n + 1);
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % n;
    s[i + 1] = s[i] + Math.hypot(line[j * 2] - line[i * 2], line[j * 2 + 1] - line[i * 2 + 1]);
  }
  if (closed && s[n] > 0) {
    const k = (Math.max(1, Math.round(s[n] / DASH)) * DASH) / s[n];
    for (let i = 0; i <= n; i++) s[i] *= k;
  }
  // Querrichtung je Punkt (Mittel der beiden anliegenden Stücke)
  const nx = new Float32Array(n), nz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const ip = closed ? (i - 1 + n) % n : Math.max(0, i - 1), inx = closed ? (i + 1) % n : Math.min(n - 1, i + 1);
    let tx = line[inx * 2] - line[ip * 2], tz = line[inx * 2 + 1] - line[ip * 2 + 1];
    const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    nx[i] = -tz; nz[i] = tx;
  }
  // Punkte des Bandes: an den Linienpunkten und zusätzlich in jeder Strichlücke
  interface P { x: number; z: number; nx: number; nz: number; s: number }
  const pts: P[] = [];
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % n;
    const sa = s[i], sb = s[i + 1];
    const add = (t: number, sv: number) => {
      const ux = nx[i] + (nx[j] - nx[i]) * t, uz = nz[i] + (nz[j] - nz[i]) * t, ul = Math.hypot(ux, uz) || 1;
      pts.push({ x: line[i * 2] + (line[j * 2] - line[i * 2]) * t, z: line[i * 2 + 1] + (line[j * 2 + 1] - line[i * 2 + 1]) * t, nx: ux / ul, nz: uz / ul, s: sv });
    };
    add(0, sa);
    for (let k = Math.floor(sa / DASH) + 1; k * DASH < sb - 1e-4; k++) if (k * DASH > sa + 1e-4) add((k * DASH - sa) / (sb - sa), k * DASH);
  }
  if (!closed) { const i = n - 1; pts.push({ x: line[i * 2], z: line[i * 2 + 1], nx: nx[i], nz: nz[i], s: s[n - 1] }); }
  else pts.push({ ...pts[0], s: s[n] });
  // Sichtbarkeit je Strich: nur, wenn alle seine Punkte auf trockenem, entdecktem Land liegen
  const visAt = (x: number, z: number) => (heightAt(x, z) > 0.17 ? 1 : 0) * seen(x, z);
  const dashOf = (a: P, b: P) => Math.floor((a.s + b.s) * 0.5 / DASH);
  const dashVis = new Map<number, number>();
  for (let i = 0; i + 1 < pts.length; i++) {
    const k = dashOf(pts[i], pts[i + 1]);
    const v = Math.min(visAt(pts[i].x, pts[i].z), visAt(pts[i + 1].x, pts[i + 1].z));
    dashVis.set(k, Math.min(dashVis.get(k) ?? 1, v));
  }
  const offs = [-HALF, 0, HALF];
  const row = (p: P) => offs.map((o) => {
    const px = p.x + p.nx * o, pz = p.z + p.nz * o;
    return [px, Math.max(heightAt(px, pz), 0.05) + 0.06, pz];
  });
  let prevRow = row(pts[0]);
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    const rb = row(b), ra = prevRow;
    prevRow = rb;
    const v = dashVis.get(dashOf(a, b)) ?? 0;
    if (v === 0) continue; // ganz unsichtbare Striche weglassen
    const put = (r: number[][], k: number, si: number) => {
      pos.push(r[k][0], r[k][1], r[k][2]);
      col.push(c.r, c.g, c.b, v);
      bd.push(si, k - 1);
    };
    for (let k = 0; k < 2; k++) {
      put(ra, k, a.s); put(rb, k, b.s); put(rb, k + 1, b.s);
      put(ra, k, a.s); put(rb, k + 1, b.s); put(ra, k + 1, a.s);
    }
  }
}

/**
 * Material der Grenzlinie: malt auf das Band schmale Striche mit runden Enden in der Besitzerfarbe, mit
 * feinem dunklem Rand. Breite und Rand richten sich nach der Größe eines Bildpunkts: Die Linie ist am
 * Bildschirm aus jeder Höhe gleich fein (beim Heranzoomen wird sie nicht dicker). Die Kanten werden je
 * Bildpunkt geglättet (kein Flimmern); aus großer Höhe wachsen die Striche zu einer durchgehenden Linie zusammen.
 */
export function borderMaterial(): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    // etwas zur Kamera gezogen: kleine Buckel im Boden schneiden keine Stücke aus den Strichen
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 bd;
varying vec2 vBd;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vBd = bd;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vBd;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec2 p = vec2(vBd.x, vBd.y * ${HALF.toFixed(3)});
  // Größe eines Bildpunkts in Feldern: entlang und quer zur Linie (am Hang verschieden)
  float pxL = max(fwidth(vBd.x), 1e-4), pxA = max(fwidth(vBd.y) * ${HALF.toFixed(3)}, 1e-4);
  float px = max(pxL, pxA);
  float per = ${DASH.toFixed(3)};
  // Strich als schmale Kapsel: etwa 3–4 Bildpunkte breit plus Rand, egal wie nah die Kamera ist; aus großer
  // Höhe werden die Striche länger, bis die Linie durchgeht.
  float len = mix(0.34, per + 0.2, smoothstep(0.045, 0.1, px));
  float r = min(pxA * 1.8, ${(HALF * 0.62).toFixed(3)});
  float ow = min(pxA * 1.2, ${(HALF * 0.3).toFixed(3)});
  float u = mod(p.x, per) - per * 0.5;
  float d = length(vec2(max(abs(u) - max(len * 0.5 - r, 0.0), 0.0), p.y)) - r;
  float aa = px * 0.75;
  float body = 1.0 - smoothstep(-aa, aa, d);
  float rim = 1.0 - smoothstep(ow - aa, ow + aa, d);
  float halo = 1.0 - smoothstep(ow + pxA * 0.6, ow + pxA * 2.2 + aa, d);
  // Besitzerfarbe kräftig, zur Mitte hin etwas heller (wirkt wie ein gemalter Strich)
  vec3 own = diffuseColor.rgb * (1.1 + 0.3 * (1.0 - smoothstep(0.0, r, abs(p.y))));
  // feiner dunkler Rand und außen ein zarter heller Schein: trennt die Linie von hellem Sand, sattem Gras
  // (auch die grüne Spielerfarbe) und dunklem Wald
  diffuseColor.rgb = mix(mix(vec3(0.9, 0.86, 0.74), vec3(0.02, 0.018, 0.014), rim), own, body);
  diffuseColor.a *= max(max(body, rim * 0.8), halo * 0.4);
}`);
  };
  mat.customProgramCacheKey = () => 'grenze-strich-v3';
  return mat;
}
