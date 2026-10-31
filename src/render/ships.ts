// Schiffe: Modelle (klein/groß, Piraten), Fahnen in Besitzerfarbe, Kanonen, Bewegung, Auswahl, Fahrtroute, Untergang.
import * as THREE from 'three';
import { SHIPS } from '../data';
import { Game, Ship } from '../game';
import { Builder, M, Paint } from './kit';
import { buildingMaterial } from './materials';
import type { Fx } from './fx';

/** gewölbtes Segel (Ausschnitt eines Zylindermantels), Bauch nach vorne (+z) */
function sail(b: Builder, w: number, h: number, paint: Paint, x: number, y: number, z: number) {
  const r = w * 0.9, th = 2 * Math.asin(Math.min(0.99, w / 2 / r));
  b.add(new THREE.CylinderGeometry(r, r, h, 8, 1, true, -th / 2, th), paint, x, y + h / 2, z - r * Math.cos(th / 2) + 0.03);
}

function shipGeometry(large: boolean, pirate: boolean): THREE.BufferGeometry {
  const b = new Builder();
  const hull: Paint = pirate ? { c: 0x3a2a20, p: 3 } : M.bretterDunkel;
  const hullLight: Paint = pirate ? { c: 0x4a382a, p: 3 } : M.bretter;
  const canvas: Paint = pirate ? { c: 0x2e2a26, p: 0 } : { c: 0xf1e8d0, p: 0 };
  const L = large ? 1.5 : 1.3;
  // Rumpf: geschwungen durch gestaffelte Planken, Kiel, Bug, Heck
  b.box(0.5, 0.22, L, hull, 0, -0.12, -0.05);
  b.box(0.42, 0.12, L - 0.1, hullLight, 0, -0.18, -0.05);
  b.box(0.54, 0.04, L * 0.9, M.dunkelholz, 0, -0.02, -0.05); // Barkholz
  b.box(0.52, 0.025, L * 0.92, { c: 0xb08a4a, p: 0 }, 0, 0.06, -0.05); // Zierleiste
  b.add(new THREE.ConeGeometry(0.25, 0.45, 4, 1).rotateX(Math.PI / 2).rotateZ(Math.PI / 4), hull, 0, -0.02, L / 2 + 0.15, 0, 0, 0, 1, 0.5, 1);
  b.box(0.5, 0.03, L, M.bretter, 0, 0.1, -0.05); // Deck
  // Achterkastell mit Heckfenstern und Laternen
  const sz = -L / 2 + 0.1;
  b.box(0.52, large ? 0.36 : 0.26, 0.38, hull, 0, 0.1, sz);
  b.box(0.54, 0.03, 0.4, M.dunkelholz, 0, large ? 0.46 : 0.36, sz);
  for (const x of [-0.14, 0, 0.14]) b.box(0.08, 0.08, 0.02, { c: 0xffd98a, p: 0 }, x, large ? 0.28 : 0.2, sz - 0.2);
  b.box(0.46, 0.02, 0.02, { c: 0xb08a4a, p: 0 }, 0, large ? 0.38 : 0.3, sz - 0.2);
  for (const s of [-1, 1]) { b.cyl(0.02, 0.025, 0.06, 6, M.gold, s * 0.22, large ? 0.48 : 0.38, sz - 0.18); }
  // Vorderkastell
  b.box(0.48, 0.14, 0.24, hull, 0, 0.1, L / 2 - 0.15);
  // Reling mit Stützen
  for (const s of [-1, 1]) {
    b.box(0.02, 0.06, L * 0.75, M.holz, s * 0.25, 0.13, 0);
    for (let i = 0; i < 6; i++) b.box(0.02, 0.06, 0.02, M.dunkelholz, s * 0.25, 0.1, -L * 0.35 + i * L * 0.14);
  }
  // Masten, Rahen, Segel
  const masts: [number, number][] = large ? [[0.42, 1.3], [-0.05, 1.45], [-0.48, 1.05]] : [[0.25, 1.2], [-0.3, 1.0]];
  for (const [mz, h] of masts) {
    b.cyl(0.025, 0.032, h, 7, M.dunkelholz, 0, 0.08, mz);
    b.cyl(0.06, 0.06, 0.04, 8, M.bretterDunkel, 0, 0.08 + h * 0.72, mz); // Mastkorb
    const yards = h > 1.1 ? [0.38, 0.86] : [0.36, 0.76];
    yards.forEach((yy, i) => {
      const w = (i === 0 ? 0.64 : 0.5) * (large ? 1.08 : 1);
      b.box(w + 0.06, 0.025, 0.025, M.dunkelholz, 0, 0.08 + yy * h + (i === 0 ? 0.38 : 0.28) * h * 0.95, mz);
      sail(b, w, (i === 0 ? 0.38 : 0.28) * h, canvas, 0, 0.08 + yy * h, mz + 0.02);
    });
    // Wanten (Seile) zu beiden Seiten
    for (const s of [-1, 1]) {
      const top = 0.08 + h * 0.7;
      const len = Math.hypot(0.24, top - 0.12);
      b.add(new THREE.BoxGeometry(0.008, len, 0.008), { c: 0x3a2e22, p: 0 }, s * 0.12, (top + 0.12) / 2, mz, 0, 0, s * Math.atan2(0.24, top - 0.12));
    }
  }
  // Klüverbaum, Vorsegel, Stag
  b.cyl(0.015, 0.015, 0.55, 5, M.dunkelholz, 0, 0.12, L / 2 + 0.25, Math.PI / 2.6);
  const jib = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.25, L / 2 + 0.45), new THREE.Vector3(0, 1.0 * masts[0][1], masts[0][0]), new THREE.Vector3(0, 0.22, masts[0][0] + 0.05)]);
  jib.setIndex([0, 1, 2, 2, 1, 0]);
  b.add(jib, canvas, 0, 0, 0);
  // Ruder, Anker
  b.box(0.03, 0.26, 0.08, M.dunkelholz, 0, -0.2, -L / 2 - 0.08);
  b.box(0.02, 0.12, 0.02, M.eisen, 0.24, 0.0, L / 2 - 0.05);
  b.box(0.08, 0.02, 0.02, M.eisen, 0.24, -0.06, L / 2 - 0.05);
  // Fracht an Deck
  b.barrel(0.12, 0.05, 0.12, 0.05, 0.1); b.crate(-0.1, -0.05, 0.12, 0.1);
  if (pirate) for (let i = 0; i < 2; i++) b.barrel(-0.12 + i * 0.07, 0.3, 0.12, 0.045, 0.09);
  return b.geometry();
}

/** Stückpforten + Kanonenrohre auf beiden Seiten */
function gunGeometry(large: boolean): THREE.BufferGeometry {
  const b = new Builder();
  const n = large ? 6 : 4, L = large ? 1.5 : 1.3;
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
    const z = -L * 0.32 + (i / (n - 1)) * L * 0.62;
    b.box(0.02, 0.07, 0.08, { c: 0x1a1512, p: 0 }, s * 0.255, -0.06, z);
    b.box(0.015, 0.075, 0.09, { c: 0x8a2e22, p: 0 }, s * 0.262, 0.0, z); // aufgeklappter Deckel
    b.add(new THREE.CylinderGeometry(0.018, 0.022, 0.12, 7).rotateZ(Math.PI / 2), M.eisen, s * 0.29, -0.06, z);
  }
  return b.geometry();
}

/** Fahne am Großmast + Wimpel (weiß gebaut, wird in Besitzerfarbe eingefärbt) */
function flagGeometry(large: boolean): THREE.BufferGeometry {
  const b = new Builder();
  const top = large ? 0.08 + 1.45 : 0.08 + 1.2, z = large ? -0.05 : 0.25;
  b.box(0.012, 0.13, 0.24, 0xffffff, 0, top - 0.02, z + 0.13);
  const pen = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.035, 0), new THREE.Vector3(0, 0, 0.42), new THREE.Vector3(0, -0.035, 0)]);
  pen.setIndex([0, 1, 2, 2, 1, 0]);
  b.add(pen, 0xffffff, 0, top - 0.25, z + 0.02);
  return b.geometry();
}

interface View { mesh: THREE.Mesh; ring: THREE.Mesh; wake: THREE.Mesh; flag: THREE.Mesh; guns: THREE.Mesh; key: string; sink?: number; hpFrac: number }

export class ShipLayer {
  group = new THREE.Group();
  private views = new Map<number, View>();
  private geos = new Map<string, THREE.BufferGeometry>();
  private gunGeos = [gunGeometry(false), gunGeometry(true)];
  private flagGeos = [flagGeometry(false), flagGeometry(true)];
  private mat = buildingMaterial();
  private gunMat = buildingMaterial({ metalness: 0.5, roughness: 0.4 });
  private flagMats = new Map<number, THREE.Material>();
  private sinkMat = buildingMaterial({ transparent: true });
  private route: THREE.Line;
  private lastT = 0;
  selected: number | null = null;
  /** Effekte (Blasen beim Untergang); setzt die Szene */
  fx?: Fx;

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

  private isPirate(s: Ship) { return s.type === 'pirat' || !!this.g.players[s.owner]?.pirate; }
  private isLarge(s: Ship) { return s.type === 'handel_gross' || s.type === 'krieg_gross' || s.type === 'pirat'; }

  private geo(large: boolean, pirate: boolean) {
    const key = `${large ? 1 : 0}${pirate ? 1 : 0}`;
    let g = this.geos.get(key);
    if (!g) { g = shipGeometry(large, pirate); this.geos.set(key, g); }
    return g;
  }

  private flagMat(color: number) {
    let m = this.flagMats.get(color);
    if (!m) { m = buildingMaterial({ color, side: THREE.DoubleSide }); this.flagMats.set(color, m); }
    return m;
  }

  private view(s: Ship): View {
    const large = this.isLarge(s), pirate = this.isPirate(s);
    const key = `${large}${pirate}`;
    let v = this.views.get(s.id);
    if (v && v.key === key) return v;
    if (v) { this.group.remove(v.mesh, v.ring, v.wake); this.views.delete(s.id); }
    const mesh = new THREE.Mesh(this.geo(large, pirate), this.mat);
    mesh.castShadow = true;
    mesh.userData.shipId = s.id;
    const flag = new THREE.Mesh(this.flagGeos[large ? 1 : 0], this.flagMat(pirate ? 0x111111 : this.g.players[s.owner]?.color ?? 0x2f6fd0));
    mesh.add(flag);
    const guns = new THREE.Mesh(this.gunGeos[large ? 1 : 0], this.gunMat);
    guns.castShadow = true;
    mesh.add(guns);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.1, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.visible = false;
    const wake = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.6).rotateX(-Math.PI / 2).translate(0, 0, -1.2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false }));
    v = { mesh, ring, wake, flag, guns, key, hpFrac: 1 };
    this.group.add(mesh, ring, wake);
    this.views.set(s.id, v);
    return v;
  }

  /** Schiff geht unter (wird gleich aus der Spielliste entfernt) */
  sink(id: number) {
    const v = this.views.get(id);
    if (!v || v.sink !== undefined) return;
    v.sink = 0;
    v.ring.visible = false;
    v.wake.visible = false;
    if (this.selected === id) this.selected = null;
  }

  /** Höhe und Position eines Schiffs für Lebensbalken/Rauch */
  shown: { s: Ship; x: number; z: number; frac: number; scale: number }[] = [];

  update(t: number) {
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    const alive = new Set<number>();
    this.shown.length = 0;
    for (const s of this.g.ships) {
      alive.add(s.id);
      const v = this.view(s);
      if (v.sink !== undefined) continue;
      const visible = s.owner === 0 || this.g.seen[this.g.idx(Math.floor(s.x), Math.floor(s.y))] === 1;
      v.mesh.visible = visible;
      const large = this.isLarge(s);
      const scale = large ? 1.6 : 1.3;
      const max = SHIPS[s.type ?? 'handel_klein'].hp;
      const frac = s.hp === undefined ? 1 : Math.max(0, s.hp / max);
      v.hpFrac = frac;
      const bob = Math.sin(t * 1.6 + s.id) * 0.03;
      v.mesh.position.set(s.x, 0.08 + bob - (1 - frac) * 0.06, s.y);
      v.mesh.scale.setScalar(scale);
      // beschädigt: Schlagseite
      v.mesh.rotation.set(Math.sin(t * 1.3 + s.id) * 0.04, s.dir, Math.cos(t * 1.1 + s.id) * 0.05 + (1 - frac) * 0.12);
      v.guns.visible = (s.guns ?? 0) > 0;
      // Fahne flattert
      v.flag.rotation.y = Math.sin(t * 5 + s.id) * 0.12;
      v.ring.visible = this.selected === s.id;
      v.ring.position.set(s.x, 0.06, s.y);
      v.wake.visible = visible && s.path.length > 0;
      v.wake.position.set(s.x, 0.04, s.y);
      v.wake.rotation.y = s.dir;
      if (visible) this.shown.push({ s, x: s.x, z: s.y, frac, scale });
    }
    for (const [id, v] of this.views) {
      if (alive.has(id) && v.sink === undefined) continue;
      if (v.sink === undefined) { this.group.remove(v.mesh, v.ring, v.wake); this.views.delete(id); continue; }
      // Untergang: Bug hebt sich, Schiff neigt sich und sinkt
      v.sink += dt;
      const k = Math.min(1, v.sink / 4);
      if (v.mesh.material !== this.sinkMat && v.sink > 2.5) v.mesh.material = this.sinkMat;
      v.mesh.position.y = 0.08 - k * k * 1.6;
      v.mesh.rotation.x = -k * 0.5;
      v.mesh.rotation.z = k * 0.6;
      if (v.mesh.visible && Math.random() < 0.6) this.fx?.bubbles(v.mesh.position.x, v.mesh.position.z, 2);
      if (v.sink > 4.5) { this.group.remove(v.mesh, v.ring, v.wake); this.views.delete(id); }
    }
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
    const meshes = Array.from(this.views.values()).filter((v) => v.sink === undefined && v.mesh.visible).map((v) => v.mesh);
    const hit = ray.intersectObjects(meshes, false)[0];
    if (hit) return this.g.ships.find((s) => s.id === hit.object.userData.shipId);
    // großzügig: Schiff nahe am Treffpunkt auf Wasserhöhe (eigene zuerst, dann sichtbare fremde)
    const p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1), p)) return undefined;
    const near = (s: Ship) => Math.hypot(s.x - p.x, s.y - p.z) < 1.4;
    return this.g.ships.find((s) => s.owner === 0 && near(s)) ?? this.g.ships.find((s) => near(s) && this.views.get(s.id)?.mesh.visible && this.views.get(s.id)?.sink === undefined);
  }
}
