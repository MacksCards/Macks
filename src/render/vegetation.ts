// Bäume und Gras mit Wind. Viele Exemplare werden als "Instanzen" gezeichnet
// (eine Vorlage, tausendfach platziert) – das bleibt auf dem iPhone flüssig.
//
// Damit nur gezeichnet wird, was man sieht, ist die Welt in Blöcke zu 16 × 16 Feldern geteilt.
// Jeder Block hat eigene Gruppen mit einer Hüllkugel (unsichtbare Kugel um den Block): liegt sie
// außerhalb des Bildes, lässt three.js den Block von selbst weg. In der Ferne wird gespart:
// kein Gras, nur jeder zweite Baum (dafür etwas größer), ganz weit weg einfache Baumformen.
// Ändert sich etwas (Roden, Bauen, Entdecken), wird nur der betroffene Block neu aufgebaut.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Game } from '../game';
import { T } from '../world';
import { LAND_Y, Terrain } from './terrain';

export const windTime = { value: 0 };

/** Felder je Block (Seitenlänge) */
const B = 16;
/** Fern-Blöcke fassen 2 × 2 Blöcke zusammen (32 × 32 Felder): weniger Zeichenaufrufe in der Ferne */
const FB = 2;
/** Abstände (wie Kamera-Zoom): ab hier kein Gras, ab hier jeder zweite Baum, ab hier einfache Formen; Schatten bis hier */
export const VEG_LOD = { gras: 25, halb: 45, fern: 70, schatten: 35 };
/** Bäume der halben Dichte etwas größer, damit der Wald gleich dicht wirkt */
const HALF_SCALE = 1.3;
/** Ferne Blöcke zählen etwas weiter weg, als sie sind (Bäume dort sind klein und verdecken sich gegenseitig) */
const FAR_K = 1.6;

function paint(g: THREE.BufferGeometry, fn: (x: number, y: number, z: number) => [number, number, number]) {
  const geo = g.index ? g.toNonIndexed() : g;
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) col.set(fn(p.getX(i), p.getY(i), p.getZ(i)), i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

function jitter(g: THREE.BufferGeometry, amt: number, seed: number) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 12.9 + y * 7.1 + z * 5.3 + seed) * 43758.5453;
    const r = (n - Math.floor(n) - 0.5) * amt;
    p.setXYZ(i, x * (1 + r), y + r * 0.3, z * (1 + r));
  }
  g.computeVertexNormals();
  return g;
}

const lin = (hex: number) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b] as [number, number, number]; };

function conifer(seed: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const bark = lin(0x4a3424);
  const trunk = new THREE.CylinderGeometry(0.035, 0.06, 0.5, 6).translate(0, 0.25, 0);
  parts.push(paint(trunk, () => bark));
  const dark = lin(0x1c3a1c), light = lin(0x3f6a2c);
  const layers = 3;
  for (let i = 0; i < layers; i++) {
    const r = 0.36 - i * 0.09, h = 0.48 - i * 0.05, y = 0.22 + i * 0.24;
    const c = jitter(new THREE.ConeGeometry(r, h, 8, 1, true), 0.25, seed + i).translate(0, y + h / 2, 0);
    parts.push(paint(c, (_x, yy) => {
      const t = Math.min(1, Math.max(0, (yy - y) / h));
      return [dark[0] + (light[0] - dark[0]) * (1 - t) * 0.9, dark[1] + (light[1] - dark[1]) * (1 - t) * 0.9, dark[2] + (light[2] - dark[2]) * (1 - t) * 0.9];
    }));
  }
  return mergeGeometries(parts)!;
}

function broadleaf(seed: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const bark = lin(0x5a412c);
  parts.push(paint(new THREE.CylinderGeometry(0.035, 0.055, 0.45, 6).translate(0, 0.22, 0), () => bark));
  const r = (k: number) => { const n = Math.sin(seed * 91.7 + k * 13.3) * 43758.5; return n - Math.floor(n); };
  const greens = [lin(0x2f5a1f), lin(0x46782c), lin(0x3a6624)];
  for (let i = 0; i < 5; i++) {
    const s = 0.16 + r(i) * 0.1;
    const x = (r(i + 10) - 0.5) * 0.28, z = (r(i + 20) - 0.5) * 0.28, y = 0.5 + r(i + 30) * 0.28;
    const blob = jitter(new THREE.IcosahedronGeometry(s, 0), 0.3, seed + i * 3).translate(x, y, z);
    const base = greens[i % 3];
    parts.push(paint(blob, (_x, yy) => { const t = 0.75 + (yy - y + s) / (2 * s) * 0.5; return [base[0] * t, base[1] * t, base[2] * t]; }));
  }
  return mergeGeometries(parts)!;
}

/** Nadelbaum für die Ferne: ein schlanker Kegel (14 statt 48 Dreiecke) mit weicher Beleuchtung, gleiche Höhe und Farben */
function coniferFar(): THREE.BufferGeometry {
  const dark = lin(0x1c3a1c), light = lin(0x3f6a2c);
  const y0 = 0.22, h = 0.86;
  // ConeGeometry bringt runde (weiche) Normalen mit – nicht neu berechnen, sonst wirkt der Kegel kantig
  const c = new THREE.ConeGeometry(0.37, h, 7, 1, true).translate(0, y0 + h / 2, 0);
  return paint(c, (_x, yy) => { const t = Math.min(1, Math.max(0, (yy - y0) / h)); const k = (1 - t) * 0.6; return [dark[0] + (light[0] - dark[0]) * k, dark[1] + (light[1] - dark[1]) * k, dark[2] + (light[2] - dark[2]) * k]; });
}

/** Laubbaum für die Ferne: eine runde Krone aus 8 Flächen statt 124, wie eine Kugel beleuchtet */
function broadleafFar(): THREE.BufferGeometry {
  const base = lin(0x3a6624);
  const cy = 0.66, sy = 0.85;
  const g = paint(new THREE.OctahedronGeometry(0.32, 0).scale(1, sy, 1).translate(0, cy, 0), (_x, yy) => { const t = 0.75 + (yy - 0.4) / 0.52 * 0.5; return [base[0] * t, base[1] * t, base[2] * t]; });
  const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.set(p.getX(i), (p.getY(i) - cy) / sy, p.getZ(i)).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
  return g;
}

function tuft(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const base = lin(0x24410f), tip = lin(0x7f9a3a);
  for (let k = 0; k < 4; k++) {
    const g = new THREE.PlaneGeometry(0.04, 0.16, 1, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.07) pos.setX(i, pos.getX(i) * 0.15);
    g.translate(0, 0.08, 0);
    g.rotateZ((k - 2) * 0.22);
    g.rotateY(k * 1.3);
    g.translate(Math.cos(k * 2.1) * 0.03, 0, Math.sin(k * 2.1) * 0.03);
    parts.push(paint(g, (_x, y) => { const t = Math.min(1, y / 0.16); return [base[0] + (tip[0] - base[0]) * t, base[1] + (tip[1] - base[1]) * t, base[2] + (tip[2] - base[2]) * t]; }));
  }
  const m = mergeGeometries(parts)!;
  // Normalen nach oben → Gras wirkt von allen Seiten gleich hell
  const n = m.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return m;
}

function windMaterial(opts: THREE.MeshStandardMaterialParameters, strength: number, key: string) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, ...opts });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uWind;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  vec3 ip = vec3(0.0);
  #ifdef USE_INSTANCING
  ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
  #endif
  float sway = sin(uWind * 1.7 + ip.x * 0.35 + ip.z * 0.27) * 0.6 + sin(uWind * 3.1 + ip.x * 0.9) * 0.4;
  float k = max(0.0, position.y) * max(0.0, position.y) * ${strength.toFixed(3)};
  transformed.x += sway * k;
  transformed.z += sway * k * 0.5;
}`);
  };
  m.customProgramCacheKey = () => key;
  return m;
}


/** Ein Waldbaum: wo er steht und wie groß er ausgewachsen ist; dazu seine Plätze in halber Dichte (hm/hi) und in der Ferne (sm/si) */
export interface TreeSlot {
  mesh: THREE.InstancedMesh; i: number; x: number; y: number; z: number; rot: number; s: number; sy: number; m: number;
  hm: THREE.InstancedMesh | null; hi: number; sm: THREE.InstancedMesh | null; si: number;
}

/** Baum im Aufbau: Art (0/1 Nadel, 2 Laub), Farbton, zählt in halber Dichte mit? */
interface Plant { kind: 0 | 1 | 2; x: number; y: number; z: number; rot: number; s: number; sy: number; m: number; r: number; g: number; b: number; half: boolean; tile: number; solo: boolean; slot?: TreeSlot }

interface Block {
  bx: number; by: number; cx: number; cz: number;
  /** volle Dichte, schöne Form: Nadelbaum 1, Nadelbaum 2, Laubbaum */
  trees: (THREE.InstancedMesh | null)[];
  /** halbe Dichte, schöne Form: Nadel, Laub */
  half: (THREE.InstancedMesh | null)[];
  grass: THREE.InstancedMesh | null;
  plants: Plant[];
  dirty: boolean;
}

interface FarBlock {
  fx: number; fy: number; cx: number; cz: number;
  blocks: Block[];
  /** halbe Dichte, einfache Form für die Ferne: Nadel, Laub */
  simple: (THREE.InstancedMesh | null)[];
  dirty: boolean;
}

/** Größe je nach Reife: Setzling → ausgewachsener Baum */
const growth = (m: number) => (m < 0.04 ? 0.14 : 0.22 + 0.78 * Math.pow(m, 0.8));

const TMP = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), c: new THREE.Color() };

export class Vegetation {
  group = new THREE.Group();
  private geoC = [conifer(1), conifer(8)];
  private geoB = broadleaf(3);
  private geoG = tuft();
  private geoCF = coniferFar();
  private geoBF = broadleafFar();
  private treeMat = windMaterial({}, 0.06, 'baum-wind');
  private grassMat = windMaterial({ side: THREE.DoubleSide }, 3.5, 'gras-wind');
  /** Bäume je Feld (für Wachsen/Fällen) */
  slots = new Map<number, TreeSlot[]>();
  private blocks = new Map<number, Block>();
  private far = new Map<number, FarBlock>();
  private nb: number;
  private nf: number;
  /** Zwischenspeicher für Gras (Lage + Farbe), wird wiederverwendet */
  private gm = new Float32Array(16 * 1024);
  private gc = new Float32Array(3 * 1024);
  /** Messhilfe: wie viele Blöcke zuletzt neu aufgebaut wurden */
  rebuilt = 0;
  get material() { return this.treeMat; }

  constructor(private g: Game, private terrain: Terrain) {
    this.nb = Math.ceil(g.size / B);
    this.nf = Math.ceil(this.nb / FB);
    // nur Blöcke anlegen, die eine Insel berühren
    for (const isl of g.islands) {
      for (let by = Math.floor(isl.y0 / B); by <= Math.floor(isl.y1 / B); by++)
        for (let bx = Math.floor(isl.x0 / B); bx <= Math.floor(isl.x1 / B); bx++) this.block(bx, by).dirty = true;
    }
    this.flush();
  }

  private block(bx: number, by: number): Block {
    const key = by * this.nb + bx;
    let b = this.blocks.get(key);
    if (b) return b;
    b = { bx, by, cx: bx * B + B / 2, cz: by * B + B / 2, trees: [null, null, null], half: [null, null], grass: null, plants: [], dirty: true };
    this.blocks.set(key, b);
    const fx = Math.floor(bx / FB), fy = Math.floor(by / FB), fk = fy * this.nf + fx;
    let f = this.far.get(fk);
    if (!f) {
      f = { fx, fy, cx: fx * B * FB + (B * FB) / 2, cz: fy * B * FB + (B * FB) / 2, blocks: [], simple: [null, null], dirty: true };
      this.far.set(fk, f);
    }
    f.blocks.push(b);
    return b;
  }

  /** Feld hat sich geändert (Wald, Weg, Gebäude, entdeckt): sein Block wird beim nächsten flush() neu aufgebaut */
  markTile(k: number) {
    const N = this.g.size;
    if (this.g.islandOf[k] < 0 && !this.slots.has(k)) return; // Wasser ohne Pflanzen
    this.block(Math.floor((k % N) / B), Math.floor(((k / N) | 0) / B)).dirty = true;
  }

  /** geänderte Blöcke neu aufbauen; gibt die Zahl der neu gebauten Blöcke zurück */
  flush(): number {
    let n = 0;
    for (const b of this.blocks.values()) if (b.dirty) { this.buildBlock(b); n++; }
    for (const f of this.far.values()) if (f.dirty) this.buildFar(f);
    this.rebuilt = n;
    return n;
  }

  /** Instanzgruppe mit genug Platz (vorher gezählt, +15 %); eine zu kleine wird ersetzt */
  private fit(old: THREE.InstancedMesh | null, geo: THREE.BufferGeometry, mat: THREE.Material, need: number, shadow: boolean, sphere: THREE.Sphere): THREE.InstancedMesh | null {
    if (need === 0) { if (old) { old.count = 0; old.visible = false; } return old; }
    if (old && old.instanceMatrix.count >= need) return old;
    if (old) { this.group.remove(old); old.dispose(); }
    const cap = Math.ceil(need * 1.15) + 2;
    const m = new THREE.InstancedMesh(geo, mat, cap);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    m.castShadow = shadow; m.receiveShadow = true; m.count = 0; m.visible = false;
    m.boundingSphere = sphere.clone();
    this.group.add(m);
    return m;
  }

  private sphere(cx: number, cz: number, side: number) {
    // Kugel um den Block samt Baumhöhe (große Bäume werden gut 2,5 Einheiten hoch)
    return new THREE.Sphere(new THREE.Vector3(cx, LAND_Y + 1, cz), Math.hypot(side / 2, side / 2, 1.8) + 1.5);
  }

  /** Baum mit Reife und Zusatzgröße in eine Gruppe schreiben */
  private put(mesh: THREE.InstancedMesh, i: number, p: Plant, extra: number) {
    const gs = (p.solo ? 1 : growth(p.slot ? p.slot.m : p.m)) * extra;
    TMP.m.compose(TMP.v.set(p.x, p.y, p.z), TMP.q.setFromAxisAngle(TMP.up, p.rot), TMP.s.set(p.s * gs, p.sy * gs, p.s * gs));
    mesh.setMatrixAt(i, TMP.m);
    mesh.setColorAt(i, TMP.c.setRGB(p.r, p.g, p.b));
  }

  private buildBlock(bk: Block) {
    const g = this.g, N = g.size;
    bk.dirty = false;
    const x0 = bk.bx * B, y0 = bk.by * B, x1 = Math.min(N, x0 + B), y1 = Math.min(N, y0 + B);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.slots.delete(y * N + x);
    const plants: Plant[] = [];
    let ng = 0;
    const m = TMP.m, q = TMP.q, up = TMP.up;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * N + x;
      if (g.islandOf[i] < 0 || !g.seen[i]) continue;
      const t = g.tiles[i];
      if (t === T.Wasser || t === T.Berg) continue;
      const free = !g.occ[i] && !g.roads[i];
      let a = Math.sin(i * 12.9898 + g.seed) * 43758.5453;
      const rnd = () => { a = Math.sin(a) * 43758.5453; return a - Math.floor(a); };
      if (t === T.Wald) {
        const n = 2 + (rnd() < 0.5 ? 1 : 0);
        for (let k = 0; k < n; k++) {
          const px = x + 0.15 + rnd() * 0.7, pz = y + 0.15 + rnd() * 0.7;
          const s = 1.1 + rnd() * 0.9;
          const rot = rnd() * 6.28;
          const sy = s * (0.9 + rnd() * 0.4);
          const py = this.terrain.heightAt(px, pz) - 0.02;
          const r = 0.85 + rnd() * 0.3, gg = 0.85 + rnd() * 0.3, b = 0.8 + rnd() * 0.3;
          const kind: 0 | 1 | 2 = rnd() < 0.78 ? (rnd() < 0.5 ? 0 : 1) : 2;
          // jeder zweite Baum zählt auch in der halben Dichte (Ferne)
          plants.push({ kind, x: px, y: py, z: pz, rot, s, sy, m: g.trees[i], r, g: gg, b, half: k % 2 === 0, tile: i, solo: false });
        }
      } else if (free) {
        if (t === T.Gras && rnd() < 0.035) {
          const px = x + 0.5, pz = y + 0.5, s = 1.0 + rnd() * 0.6;
          const rot = rnd() * 6.28;
          plants.push({ kind: 2, x: px, y: this.terrain.heightAt(px, pz) - 0.02, z: pz, rot, s, sy: s, m: 1, r: 1, g: 1, b: 1, half: true, tile: i, solo: true });
        }
        const tufts = t === T.Sand ? (rnd() < 0.3 ? 1 : 0) : 3;
        for (let k = 0; k < tufts; k++) {
          const px = x + rnd(), pz = y + rnd(), s = 0.7 + rnd() * 0.8;
          q.setFromAxisAngle(up, rnd() * 6.28);
          m.compose(TMP.v.set(px, this.terrain.heightAt(px, pz), pz), q, TMP.s.set(s, s * (0.7 + rnd() * 0.6), s));
          const dry = t === T.Sand ? 0.25 : rnd() * 0.15;
          if ((ng + 1) * 16 > this.gm.length) {
            const a2 = new Float32Array(this.gm.length * 2); a2.set(this.gm); this.gm = a2;
            const c2 = new Float32Array(this.gc.length * 2); c2.set(this.gc); this.gc = c2;
          }
          m.toArray(this.gm, ng * 16);
          this.gc[ng * 3] = 1 + dry; this.gc[ng * 3 + 1] = 1 + dry * 0.6; this.gc[ng * 3 + 2] = 1 - dry * 0.3;
          ng++;
        }
      }
    }
    // Instanzzahl je Art vorher zählen → Gruppen passend anlegen
    const counts = [0, 0, 0], hc = [0, 0];
    for (const p of plants) { counts[p.kind]++; if (p.half) hc[p.kind === 2 ? 1 : 0]++; }
    const sph = this.sphere(bk.cx, bk.cz, B);
    const geos = [this.geoC[0], this.geoC[1], this.geoB];
    for (let k = 0; k < 3; k++) bk.trees[k] = this.fit(bk.trees[k], geos[k], this.treeMat, counts[k], true, sph);
    // halbe Dichte: Nadelbäume beider Formen in einer Gruppe (aus der Entfernung sieht man den Unterschied nicht)
    bk.half[0] = this.fit(bk.half[0], this.geoC[1], this.treeMat, hc[0], true, sph);
    bk.half[1] = this.fit(bk.half[1], this.geoB, this.treeMat, hc[1], true, sph);
    bk.grass = this.fit(bk.grass, this.geoG, this.grassMat, ng, false, sph);
    const idx = [0, 0, 0], hidx = [0, 0];
    for (const p of plants) {
      p.slot = undefined;
      const mesh = bk.trees[p.kind]!;
      const i = idx[p.kind]++;
      let hm: THREE.InstancedMesh | null = null, hi = -1;
      if (p.half) { const hk = p.kind === 2 ? 1 : 0; hm = bk.half[hk]!; hi = hidx[hk]++; }
      if (!p.solo) {
        const slot: TreeSlot = { mesh, i, x: p.x, y: p.y, z: p.z, rot: p.rot, s: p.s, sy: p.sy, m: p.m, hm, hi, sm: null, si: -1 };
        const list = this.slots.get(p.tile);
        if (list) list.push(slot); else this.slots.set(p.tile, [slot]);
        p.slot = slot; // einzelne Laubbäume auf Wiesen wachsen nicht nach: ohne Eintrag
      }
      this.put(mesh, i, p, 1);
      if (hm) this.put(hm, hi, p, HALF_SCALE);
    }
    for (let k = 0; k < 3; k++) this.finish(bk.trees[k], counts[k]);
    for (let k = 0; k < 2; k++) this.finish(bk.half[k], hc[k]);
    if (bk.grass) {
      (bk.grass.instanceMatrix.array as Float32Array).set(this.gm.subarray(0, ng * 16));
      (bk.grass.instanceColor!.array as Float32Array).set(this.gc.subarray(0, ng * 3));
      this.finish(bk.grass, ng);
    }
    bk.plants = plants;
    this.far.get(Math.floor(bk.by / FB) * this.nf + Math.floor(bk.bx / FB))!.dirty = true;
  }

  /** Fern-Block (2 × 2 Blöcke): halbe Dichte mit einfachen Formen für große Entfernung */
  private buildFar(f: FarBlock) {
    f.dirty = false;
    const counts = [0, 0];
    for (const bk of f.blocks) for (const p of bk.plants) if (p.half) counts[p.kind === 2 ? 1 : 0]++;
    const sph = this.sphere(f.cx, f.cz, B * FB);
    f.simple[0] = this.fit(f.simple[0], this.geoCF, this.treeMat, counts[0], true, sph);
    f.simple[1] = this.fit(f.simple[1], this.geoBF, this.treeMat, counts[1], true, sph);
    const idx = [0, 0];
    for (const bk of f.blocks) for (const p of bk.plants) {
      if (!p.half) continue;
      const k = p.kind === 2 ? 1 : 0;
      const mesh = f.simple[k]!, i = idx[k]++;
      this.put(mesh, i, p, HALF_SCALE);
      if (p.slot) { p.slot.sm = mesh; p.slot.si = i; }
    }
    for (let k = 0; k < 2; k++) this.finish(f.simple[k], counts[k]);
  }

  private finish(mesh: THREE.InstancedMesh | null, n: number) {
    if (!mesh) return;
    mesh.count = n;
    mesh.visible = false; // update() entscheidet je Bild
    if (!n) return;
    const im = mesh.instanceMatrix, ic = mesh.instanceColor;
    im.clearUpdateRanges(); im.addUpdateRange(0, n * 16); im.needsUpdate = true;
    if (ic) { ic.clearUpdateRanges(); ic.addUpdateRange(0, n * 3); ic.needsUpdate = true; }
  }

  /**
   * Je Bild: welche Gruppen gezeichnet werden und welche Schatten werfen. Maß ist der Abstand der Kamera
   * zum nächsten Punkt des Blocks (mindestens der Zoom): so wirkt ein Block in 45 Feldern Abstand wie
   * die Bildmitte bei Zoom 45. cam = Kameraposition; tx/tz = Blickpunkt am Boden; dist = Zoom
   */
  update(cam: THREE.Vector3, tx: number, tz: number, dist: number) {
    const L = VEG_LOD;
    const dy = cam.y - LAND_Y;
    const near3 = (cx: number, cz: number, h: number) => Math.hypot(Math.max(0, Math.abs(cam.x - cx) - h), dy, Math.max(0, Math.abs(cam.z - cz) - h));
    // weiter entfernt als die Bildmitte: Abstand zählt stärker (dort sind Bäume klein und verdecken sich)
    const effOf = (d: number) => (d <= dist ? dist : dist + (d - dist) * FAR_K);
    for (const f of this.far.values()) {
      const farLevel = effOf(near3(f.cx, f.cz, (B * FB) / 2)) >= L.fern;
      const shF = boxDist(tx, tz, f.cx, f.cz, (B * FB) / 2) <= L.schatten;
      for (const s of f.simple) if (s) { s.visible = farLevel && s.count > 0; s.castShadow = shF; }
      for (const bk of f.blocks) {
        const eff = effOf(near3(bk.cx, bk.cz, B / 2));
        const level = farLevel ? 2 : eff < L.halb ? 0 : 1;
        const sh = boxDist(tx, tz, bk.cx, bk.cz, B / 2) <= L.schatten;
        for (const m of bk.trees) if (m) { m.visible = level === 0 && m.count > 0; m.castShadow = sh; }
        for (const m of bk.half) if (m) { m.visible = level === 1 && m.count > 0; m.castShadow = sh; }
        if (bk.grass) bk.grass.visible = level === 0 && eff < L.gras && bk.grass.count > 0;
      }
    }
  }

  /** Für das Vorbereiten der Grafik-Programme: je eine Baum- und Grasgruppe sichtbar machen */
  warm() {
    let tree = false, grass = false;
    for (const bk of this.blocks.values()) {
      for (const m of bk.trees) if (m && m.count && !tree) { m.visible = true; m.castShadow = true; tree = true; }
      if (bk.grass && bk.grass.count && !grass) { bk.grass.visible = true; grass = true; }
      if (tree && grass) break;
    }
  }

  /** Bäume an die aktuelle Reife anpassen (nur geänderte) */
  updateGrowth() {
    const g = this.g;
    const m = TMP.m, q = TMP.q, up = TMP.up, v = TMP.v, sc = TMP.s;
    const dirty = new Set<THREE.InstancedMesh>();
    for (const [k, list] of this.slots) {
      const mat = g.trees[k];
      if (Math.abs(mat - list[0].m) < 0.02) continue;
      for (const t of list) {
        t.m = mat;
        const gs = growth(mat), hs = gs * HALF_SCALE;
        q.setFromAxisAngle(up, t.rot);
        v.set(t.x, t.y, t.z);
        m.compose(v, q, sc.set(t.s * gs, t.sy * gs, t.s * gs));
        t.mesh.setMatrixAt(t.i, m);
        dirty.add(t.mesh);
        if (t.hm || t.sm) {
          m.compose(v, q, sc.set(t.s * hs, t.sy * hs, t.s * hs));
          if (t.hm) { t.hm.setMatrixAt(t.hi, m); dirty.add(t.hm); }
          if (t.sm) { t.sm.setMatrixAt(t.si, m); dirty.add(t.sm); }
        }
      }
    }
    for (const d of dirty) {
      d.instanceMatrix.clearUpdateRanges();
      d.instanceMatrix.addUpdateRange(0, d.count * 16);
      d.instanceMatrix.needsUpdate = true;
    }
  }

  /** Messhilfe: Zahl der Blöcke, Gruppen und Pflanzen */
  stats() {
    let meshes = 0, trees = 0, grass = 0;
    for (const bk of this.blocks.values()) {
      for (const m of [...bk.trees, ...bk.half]) if (m) meshes++;
      for (const m of bk.trees) if (m) trees += m.count;
      if (bk.grass) { meshes++; grass += bk.grass.count; }
    }
    for (const f of this.far.values()) for (const m of f.simple) if (m) meshes++;
    return { bloecke: this.blocks.size, fernBloecke: this.far.size, gruppen: meshes, baeume: trees, gras: grass };
  }

  /** Alles freigeben: Instanzdaten, Formen und Materialien (Neues Spiel) */
  dispose() {
    const all: (THREE.InstancedMesh | null)[] = [];
    for (const bk of this.blocks.values()) all.push(...bk.trees, ...bk.half, bk.grass);
    for (const f of this.far.values()) all.push(...f.simple);
    for (const m of all) if (m) { this.group.remove(m); m.dispose(); }
    this.blocks.clear();
    this.far.clear();
    this.slots.clear();
    for (const geo of [...this.geoC, this.geoB, this.geoG, this.geoCF, this.geoBF]) geo.dispose();
    this.treeMat.dispose();
    this.grassMat.dispose();
  }
}

/** waagerechter Abstand vom Punkt (x, z) zum Quadrat um (cx, cz) mit halber Seitenlänge h */
function boxDist(x: number, z: number, cx: number, cz: number, h: number) {
  return Math.hypot(Math.max(0, Math.abs(x - cx) - h), Math.max(0, Math.abs(z - cz) - h));
}
