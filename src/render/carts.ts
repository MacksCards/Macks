// Marktkarren: kleine Figur mit Handkarren, läuft über die Wege.
import * as THREE from 'three';
import { Game } from '../game';
import { Builder, M } from './kit';
import { buildingMaterial } from './materials';

function cartGeometry(loaded: boolean): THREE.BufferGeometry {
  const b = new Builder();
  // Zieher (läuft vorne, Blickrichtung +z)
  b.person(0, 0.2, 0, 0x6b4a2b, 1.6);
  // Deichsel + Karren
  b.box(0.02, 0.02, 0.22, M.dunkelholz, -0.06, 0.12, 0.05);
  b.box(0.02, 0.02, 0.22, M.dunkelholz, 0.06, 0.12, 0.05);
  b.box(0.2, 0.06, 0.24, M.bretter, 0, 0.1, -0.14);
  b.log(0.06, 0.02, M.dunkelholz, -0.11, 0.06, -0.14, 0, 8);
  b.log(0.06, 0.02, M.dunkelholz, 0.11, 0.06, -0.14, 0, 8);
  if (loaded) { b.crate(-0.04, -0.17, 0.16, 0.1, 0.2); b.sack(0.05, -0.1, 0.16); }
  return b.geometry();
}

export class CartLayer {
  group = new THREE.Group();
  private meshes = new Map<number, THREE.Mesh>();
  private geoEmpty = cartGeometry(false);
  private geoFull = cartGeometry(true);
  private mat = buildingMaterial();
  private last = new Map<number, [number, number]>();

  constructor(private g: Game, private height: (x: number, z: number) => number) {}

  setGame(g: Game, height: (x: number, z: number) => number) {
    this.g = g; this.height = height;
    for (const m of this.meshes.values()) this.group.remove(m);
    this.meshes.clear(); this.last.clear();
  }

  update(t: number) {
    const alive = new Set<number>();
    for (const c of this.g.carts) {
      alive.add(c.id);
      let m = this.meshes.get(c.id);
      if (!m) {
        m = new THREE.Mesh(this.geoEmpty, this.mat);
        m.castShadow = true;
        m.scale.setScalar(1.4);
        this.group.add(m);
        this.meshes.set(c.id, m);
      }
      m.visible = c.state !== 'idle' && this.g.seen[this.g.idx(Math.floor(c.x), Math.floor(c.y))] === 1;
      m.geometry = c.n > 0 ? this.geoFull : this.geoEmpty;
      const [cx, cy] = this.g.ip(c);
      const prev = this.last.get(c.id);
      let moving = false;
      if (prev) {
        const dx = cx - prev[0], dz = cy - prev[1];
        if (dx * dx + dz * dz > 1e-7) {
          moving = true;
          // sanft in die neue Richtung drehen
          let d = Math.atan2(dx, dz) - m.rotation.y;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          m.rotation.y += d * 0.3;
        }
      }
      this.last.set(c.id, [cx, cy]);
      const bob = m.visible && moving ? Math.abs(Math.sin(t * 9 + c.id)) * 0.015 : 0;
      m.position.set(cx, Math.max(this.height(cx, cy), 0.05) + 0.03 + bob, cy);
    }
    for (const [id, m] of this.meshes) if (!alive.has(id)) { this.group.remove(m); this.meshes.delete(id); this.last.delete(id); }
  }
}
