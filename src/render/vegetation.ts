// Bäume und Gras mit Wind. Viele Exemplare werden als "Instanzen" gezeichnet
// (eine Vorlage, tausendfach platziert) – das bleibt auf dem iPhone flüssig.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Game } from '../game';
import { T } from '../world';
import { Terrain } from './terrain';

export const windTime = { value: 0 };

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

interface IslandVeg { conifers: THREE.InstancedMesh[]; broad: THREE.InstancedMesh; grass: THREE.InstancedMesh }

/** Ein Waldbaum: wo er steht und wie groß er ausgewachsen ist */
export interface TreeSlot { mesh: THREE.InstancedMesh; i: number; x: number; y: number; z: number; rot: number; s: number; sy: number; m: number }

/** Größe je nach Reife: Setzling → ausgewachsener Baum */
const growth = (m: number) => (m < 0.04 ? 0.14 : 0.22 + 0.78 * Math.pow(m, 0.8));

export class Vegetation {
  group = new THREE.Group();
  private per = new Map<number, IslandVeg>();
  private geoC = [conifer(1), conifer(8)];
  private geoB = broadleaf(3);
  private geoG = tuft();
  private treeMat = windMaterial({}, 0.06, 'baum-wind');
  private grassMat = windMaterial({ side: THREE.DoubleSide }, 3.5, 'gras-wind');
  /** Bäume je Feld (für Wachsen/Fällen) */
  slots = new Map<number, TreeSlot[]>();
  get material() { return this.treeMat; }

  constructor(private g: Game, private terrain: Terrain) {
    this.refresh();
  }

  private veg(id: number): IslandVeg {
    let v = this.per.get(id);
    if (v) return v;
    const isl = this.g.islands[id];
    const tiles = (isl.x1 - isl.x0 + 1) * (isl.y1 - isl.y0 + 1);
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number, shadow: boolean) => {
      const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
      m.castShadow = shadow; m.receiveShadow = true; m.count = 0;
      this.group.add(m);
      return m;
    };
    v = {
      conifers: [mk(this.geoC[0], this.treeMat, tiles * 2, true), mk(this.geoC[1], this.treeMat, tiles * 2, true)],
      broad: mk(this.geoB, this.treeMat, tiles, true),
      grass: mk(this.geoG, this.grassMat, tiles * 3, false),
    };
    this.per.set(id, v);
    return v;
  }

  /** Pflanzen neu setzen – alle Inseln oder nur bestimmte */
  refresh(only?: number[]) {
    const g = this.g, N = g.size;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const tint = new THREE.Color();
    for (const isl of g.islands) {
      if (only && !only.includes(isl.id)) continue;
      const v = this.veg(isl.id);
      for (let y = isl.y0; y <= isl.y1; y++) for (let x = isl.x0; x <= isl.x1; x++) this.slots.delete(y * N + x);
      const counts = [0, 0];
      let nb = 0, ng = 0;
      for (let y = isl.y0; y <= isl.y1; y++) for (let x = isl.x0; x <= isl.x1; x++) {
        const i = y * N + x;
        if (g.islandOf[i] !== isl.id || !g.seen[i]) continue;
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
            const mat = g.trees[i];
            const gs = growth(mat);
            q.setFromAxisAngle(up, rot);
            m.compose(new THREE.Vector3(px, py, pz), q, new THREE.Vector3(s * gs, sy * gs, s * gs));
            tint.setRGB(0.85 + rnd() * 0.3, 0.85 + rnd() * 0.3, 0.8 + rnd() * 0.3);
            let mesh: THREE.InstancedMesh, idx: number;
            if (rnd() < 0.78) {
              const c = rnd() < 0.5 ? 0 : 1;
              mesh = v.conifers[c]; idx = counts[c]++;
            } else { mesh = v.broad; idx = nb++; }
            mesh.setMatrixAt(idx, m); mesh.setColorAt(idx, tint);
            const list = this.slots.get(i) ?? [];
            list.push({ mesh, i: idx, x: px, y: py, z: pz, rot, s, sy, m: mat });
            this.slots.set(i, list);
          }
        } else if (free) {
          if (t === T.Gras && rnd() < 0.035) {
            const px = x + 0.5, pz = y + 0.5, s = 1.0 + rnd() * 0.6;
            q.setFromAxisAngle(up, rnd() * 6.28);
            m.compose(new THREE.Vector3(px, this.terrain.heightAt(px, pz) - 0.02, pz), q, new THREE.Vector3(s, s, s));
            tint.setRGB(1, 1, 1);
            v.broad.setMatrixAt(nb, m); v.broad.setColorAt(nb, tint); nb++;
          }
          const tufts = t === T.Sand ? (rnd() < 0.3 ? 1 : 0) : 3;
          for (let k = 0; k < tufts; k++) {
            const px = x + rnd(), pz = y + rnd(), s = 0.7 + rnd() * 0.8;
            q.setFromAxisAngle(up, rnd() * 6.28);
            m.compose(new THREE.Vector3(px, this.terrain.heightAt(px, pz), pz), q, new THREE.Vector3(s, s * (0.7 + rnd() * 0.6), s));
            const dry = t === T.Sand ? 0.25 : rnd() * 0.15;
            tint.setRGB(1 + dry, 1 + dry * 0.6, 1 - dry * 0.3);
            v.grass.setMatrixAt(ng, m); v.grass.setColorAt(ng, tint); ng++;
          }
        }
      }
      const fin = (mesh: THREE.InstancedMesh, n: number) => {
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.visible = n > 0;
      };
      v.conifers.forEach((c, k) => fin(c, counts[k]));
      fin(v.broad, nb);
      fin(v.grass, ng);
    }
  }

  /** Bäume an die aktuelle Reife anpassen (nur geänderte) */
  updateGrowth() {
    const g = this.g;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const dirty = new Set<THREE.InstancedMesh>();
    for (const [k, list] of this.slots) {
      const mat = g.trees[k];
      if (Math.abs(mat - list[0].m) < 0.02) continue;
      for (const t of list) {
        t.m = mat;
        const gs = growth(mat);
        m.compose(v.set(t.x, t.y, t.z), q.setFromAxisAngle(up, t.rot), sc.set(t.s * gs, t.sy * gs, t.s * gs));
        t.mesh.setMatrixAt(t.i, m);
        dirty.add(t.mesh);
      }
    }
    for (const d of dirty) d.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    for (const v of this.per.values()) for (const m of [...v.conifers, v.broad, v.grass]) this.group.remove(m);
    this.per.clear();
  }
}
