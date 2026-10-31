// Schiffe: Modell (Platzhalter bis Meshy), Bewegung, Auswahl, Fahrtroute.
import * as THREE from 'three';
import { Game, Ship } from '../game';
import { Builder, M } from './kit';
import { buildingMaterial } from './materials';

function shipGeometry(): THREE.BufferGeometry {
  const b = new Builder();
  // Rumpf: Länge entlang z (Bug zeigt nach +z)
  b.box(0.5, 0.22, 1.3, M.bretterDunkel, 0, -0.12, -0.05);
  b.box(0.42, 0.12, 1.2, M.bretter, 0, -0.18, -0.05);
  b.add(new THREE.ConeGeometry(0.25, 0.45, 4, 1).rotateX(Math.PI / 2).rotateZ(Math.PI / 4), M.bretterDunkel, 0, -0.02, 0.8, 0, 0, 0, 1, 0.5, 1);
  b.box(0.5, 0.25, 0.32, M.bretterDunkel, 0, 0.1, -0.56); // Achterdeck
  b.box(0.52, 0.03, 1.3, M.holz, 0, 0.1, -0.05); // Reling
  // Masten
  b.cyl(0.025, 0.03, 1.2, 6, M.dunkelholz, 0, 0.08, 0.25);
  b.cyl(0.025, 0.03, 1.0, 6, M.dunkelholz, 0, 0.08, -0.3);
  // Segel (leicht gewölbt durch zwei Lagen)
  const sail = { c: 0xf1e8d0, p: 0 };
  b.box(0.62, 0.42, 0.03, sail, 0, 0.5, 0.27);
  b.box(0.5, 0.3, 0.03, sail, 0, 0.98, 0.27);
  b.box(0.52, 0.36, 0.03, sail, 0, 0.45, -0.28);
  b.box(0.04, 0.03, 0.66, M.dunkelholz, 0, 0.94, 0.25);
  // Klüverbaum + Flagge
  b.cyl(0.015, 0.015, 0.5, 5, M.dunkelholz, 0, 0.12, 0.98, Math.PI / 2.6);
  b.box(0.02, 0.12, 0.2, { c: 0x2f6fd0, p: 0 }, 0, 1.22, 0.33);
  return b.geometry();
}

interface View { mesh: THREE.Mesh; ring: THREE.Mesh; wake: THREE.Mesh }

export class ShipLayer {
  group = new THREE.Group();
  private views = new Map<number, View>();
  private geo = shipGeometry();
  private mat = buildingMaterial();
  private route: THREE.Line;
  selected: number | null = null;

  constructor(private g: Game) {
    this.route = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.8 }));
    this.route.frustumCulled = false;
    this.group.add(this.route);
  }

  setGame(g: Game) {
    this.g = g;
    for (const v of this.views.values()) this.group.remove(v.mesh, v.ring, v.wake);
    this.views.clear();
    this.selected = null;
  }

  private view(s: Ship): View {
    let v = this.views.get(s.id);
    if (v) return v;
    const mesh = new THREE.Mesh(this.geo, this.mat);
    mesh.castShadow = true;
    mesh.userData.shipId = s.id;
    mesh.scale.setScalar(1.3);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.1, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.visible = false;
    const wake = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.6).rotateX(-Math.PI / 2).translate(0, 0, -1.2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false }));
    v = { mesh, ring, wake };
    this.group.add(mesh, ring, wake);
    this.views.set(s.id, v);
    return v;
  }

  update(t: number) {
    const alive = new Set<number>();
    for (const s of this.g.ships) {
      alive.add(s.id);
      const v = this.view(s);
      const visible = s.owner === 0 || this.g.seen[this.g.idx(Math.floor(s.x), Math.floor(s.y))] === 1;
      v.mesh.visible = visible;
      const bob = Math.sin(t * 1.6 + s.id) * 0.03;
      v.mesh.position.set(s.x, 0.08 + bob, s.y);
      v.mesh.scale.setScalar(s.type === 'handel_gross' || s.type === 'krieg_gross' ? 1.75 : 1.3);
      v.mesh.rotation.set(Math.sin(t * 1.3 + s.id) * 0.04, s.dir, Math.cos(t * 1.1 + s.id) * 0.05);
      v.ring.visible = this.selected === s.id;
      v.ring.position.set(s.x, 0.06, s.y);
      v.wake.visible = visible && s.path.length > 0;
      v.wake.position.set(s.x, 0.04, s.y);
      v.wake.rotation.y = s.dir;
    }
    for (const [id, v] of this.views) if (!alive.has(id)) { this.group.remove(v.mesh, v.ring, v.wake); this.views.delete(id); }
    // Fahrtroute des ausgewählten Schiffs
    const sel = this.g.ships.find((s) => s.id === this.selected);
    if (sel && sel.path.length) {
      const pts = [new THREE.Vector3(sel.x, 0.1, sel.y), ...sel.path.map(([x, y]) => new THREE.Vector3(x, 0.1, y))];
      this.route.geometry.setFromPoints(pts);
      this.route.computeLineDistances();
      this.route.visible = true;
    } else this.route.visible = false;
  }

  /** Schiff unter dem Finger (oder in dessen Nähe) */
  pick(ray: THREE.Raycaster): Ship | undefined {
    const hit = ray.intersectObjects(Array.from(this.views.values(), (v) => v.mesh), false)[0];
    if (hit) return this.g.ships.find((s) => s.id === hit.object.userData.shipId);
    // großzügig: Schiff nahe am Treffpunkt auf Wasserhöhe
    const p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1), p)) return undefined;
    return this.g.ships.filter((s) => s.owner === 0).find((s) => Math.hypot(s.x - p.x, s.y - p.z) < 1.4);
  }
}
