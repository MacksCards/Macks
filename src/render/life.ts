// Leben in der Welt: Fischschwärme, Hirsche, Weidetiere, arbeitende Holzfäller/Jäger, Fischerboote.
// Alles wird aus dem Spielzustand abgeleitet (Bestände, Arbeitsfortschritt) – keine eigene Logik.
import * as THREE from 'three';
import { BUILDINGS } from '../data';
import { Building, Game } from '../game';
import { T } from '../world';
import { Builder, M } from './kit';
import { buildingMaterial } from './materials';

function fishGeo() {
  const b = new Builder();
  b.sphere(0.07, { c: 0x4e6474, p: 0 }, 0, 0, 0, 0.55, 0.5, 1.5, 6);
  b.sphere(0.05, { c: 0xb9c9d4, p: 0 }, 0, -0.012, 0.01, 0.6, 0.35, 1.3, 6);
  b.add(new THREE.ConeGeometry(0.05, 0.08, 4).rotateX(-Math.PI / 2), 0x3e5464, 0, 0, -0.12);
  return b.geometry();
}
function sheepGeo() {
  const b = new Builder();
  b.sphere(0.13, { c: 0xf2efe6, p: 10 }, 0, 0.17, 0, 1, 0.85, 1.3, 7);
  b.sphere(0.06, 0x2a2522, 0, 0.2, 0.17, 0.9, 1, 1.2, 6);
  for (const [x, z] of [[-0.06, -0.08], [0.06, -0.08], [-0.06, 0.08], [0.06, 0.08]]) b.box(0.03, 0.09, 0.03, 0x2a2522, x, 0, z);
  return b.geometry();
}
function pigGeo() {
  const b = new Builder();
  b.sphere(0.12, 0xe6a7a0, 0, 0.14, 0, 0.9, 0.8, 1.35, 7);
  b.cyl(0.045, 0.05, 0.05, 6, 0xd98f88, 0, 0.11, 0.17, Math.PI / 2);
  for (const [x, z] of [[-0.06, -0.08], [0.06, -0.08], [-0.06, 0.08], [0.06, 0.08]]) b.box(0.035, 0.07, 0.035, 0xd98f88, x, 0, z);
  return b.geometry();
}
function deerGeo() {
  const b = new Builder();
  b.sphere(0.1, 0x8a5a33, 0, 0.26, 0, 0.8, 0.75, 1.6, 7);
  b.box(0.05, 0.16, 0.05, 0x8a5a33, 0, 0.28, 0.13);
  b.sphere(0.05, 0x7a4e2c, 0, 0.45, 0.17, 0.9, 0.9, 1.3, 6);
  for (const s of [-1, 1]) { b.box(0.012, 0.1, 0.012, 0x5a3d26, s * 0.03, 0.48, 0.14); b.box(0.04, 0.012, 0.012, 0x5a3d26, s * 0.045, 0.55, 0.14); }
  for (const [x, z] of [[-0.05, -0.1], [0.05, -0.1], [-0.05, 0.1], [0.05, 0.1]]) b.box(0.025, 0.2, 0.025, 0x5a3d26, x, 0, z);
  return b.geometry();
}
function workerGeo(carry: 'nichts' | 'stamm' | 'wild') {
  const b = new Builder();
  b.person(0, 0, 0, carry === 'wild' ? 0x5c6b3a : 0x7a5434, 1.7);
  if (carry === 'stamm') b.log(0.04, 0.35, M.holz, 0, 0.25, 0, Math.PI / 2 - 0.2);
  else if (carry === 'wild') b.sphere(0.06, 0x8a5a33, 0.05, 0.24, -0.04, 1, 0.7, 1.4);
  else b.box(0.015, 0.2, 0.015, M.dunkelholz, 0.07, 0.08, 0.02); // Axt/Bogen in der Hand
  return b.geometry();
}
function boatGeo() {
  const b = new Builder();
  b.add(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), M.bretterDunkel, 0, 0.06, 0);
  b.person(0, 0, 0, 0x3f6fb0, 1.5);
  b.box(0.01, 0.01, 0.4, M.holz, 0.13, 0.12, 0); // Ruder
  return b.geometry();
}

interface Shoal { x: number; z: number; k: number; fish: { r: number; w: number; ph: number; d: number }[]; jump: number }
interface Herd { x: number; z: number; k: number; ph: number; spd: number }

const TMP = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) };
function place(mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, rot: number, s = 1) {
  TMP.m.compose(TMP.v.set(x, y, z), TMP.q.setFromAxisAngle(TMP.up, rot), TMP.s.set(s, s, s));
  mesh.setMatrixAt(i, TMP.m);
}

export class LifeLayer {
  group = new THREE.Group();
  private mat = buildingMaterial();
  private fish: THREE.InstancedMesh;
  private sheep: THREE.InstancedMesh;
  private pigs: THREE.InstancedMesh;
  private deer: THREE.InstancedMesh;
  private workers: Record<'nichts' | 'stamm' | 'wild', THREE.InstancedMesh>;
  private boats: THREE.InstancedMesh;
  private shoals: Shoal[] = [];
  private ripples: THREE.InstancedMesh;
  private herds: Herd[] = [];

  constructor(private g: Game, private height: (x: number, z: number) => number) {
    const mk = (geo: THREE.BufferGeometry, n: number, shadow = true) => {
      const m = new THREE.InstancedMesh(geo, this.mat, n);
      m.castShadow = shadow; m.frustumCulled = false; m.count = 0;
      this.group.add(m);
      return m;
    };
    this.fish = mk(fishGeo(), 2000, false);
    this.sheep = mk(sheepGeo(), 400);
    this.pigs = mk(pigGeo(), 400);
    this.deer = mk(deerGeo(), 300);
    this.workers = { nichts: mk(workerGeo('nichts'), 300), stamm: mk(workerGeo('stamm'), 300), wild: mk(workerGeo('wild'), 200) };
    this.boats = mk(boatGeo(), 200);
    // Kräuselringe über Fischschwärmen – zeigen von Weitem gute Fanggründe
    this.ripples = new THREE.InstancedMesh(new THREE.RingGeometry(0.42, 0.5, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.45, depthWrite: false }), 500);
    this.ripples.frustumCulled = false; this.ripples.count = 0; this.ripples.renderOrder = 2;
    this.group.add(this.ripples);
    this.rebuild();
  }

  setGame(g: Game, height: (x: number, z: number) => number) { this.g = g; this.height = height; this.rebuild(); }

  /** Schwärme und Wildherden neu verteilen (nach Entdeckungen) */
  rebuild() {
    const g = this.g, N = g.size;
    this.shoals = [];
    this.herds = [];
    for (let y = 2; y < N - 2; y += 4) for (let x = 2; x < N - 2; x += 4) {
      // bestes Feld im 4×4-Block
      let best = -1, bv = 0;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const k = (y + j) * N + x + i;
        if (g.fishCap[k] > bv) { bv = g.fishCap[k]; best = k; }
      }
      if (best >= 0 && bv >= 0.55 && g.seen[best] && this.shoals.length < 220) {
        const fish = Array.from({ length: 9 }, () => ({ r: 0.25 + Math.random() * 0.8, w: (0.5 + Math.random() * 0.7) * (Math.random() < 0.5 ? -1 : 1), ph: Math.random() * 6.28, d: 0.02 + Math.random() * 0.05 }));
        this.shoals.push({ x: (best % N) + 0.5, z: ((best / N) | 0) + 0.5, k: best, fish, jump: Math.random() * 10 });
      }
    }
    for (let y = 1; y < N - 1; y += 7) for (let x = 1; x < N - 1; x += 7) {
      const k = y * N + x;
      if (g.tiles[k] === T.Wald && g.seen[k] && this.herds.length < 280) this.herds.push({ x: x + 0.5, z: y + 0.5, k, ph: Math.random() * 6.28, spd: 0.04 + Math.random() * 0.05 });
    }
  }

  update(t: number) {
    const g = this.g, N = g.size;
    // Fischschwärme: Anzahl sichtbarer Fische = aktueller Bestand des Fanggrunds
    let nf = 0;
    for (const s of this.shoals) {
      const fill = g.fishCap[s.k] > 0 ? g.fish[s.k] / g.fishCap[s.k] : 0;
      const show = Math.round(s.fish.length * fill);
      for (let i = 0; i < show && nf < 2000; i++) {
        const f = s.fish[i];
        const a = f.ph + t * f.w;
        const x = s.x + Math.cos(a) * f.r, z = s.z + Math.sin(a) * f.r * 0.7;
        let y = -f.d + Math.sin(t * 2 + i) * 0.01;
        // ab und zu springt ein Fisch aus dem Wasser
        if (i === 0) { const jt = (t + s.jump) % 9; if (jt < 0.7) y = Math.sin((jt / 0.7) * Math.PI) * 0.3; }
        place(this.fish, nf++, x, y, z, a + (f.w > 0 ? Math.PI : 0), 1.5);
      }
    }
    this.fish.count = nf;
    this.fish.instanceMatrix.needsUpdate = true;
    // je Schwarm zwei Kräuselringe, die sich ausbreiten (nur bei gutem Bestand)
    let nr = 0;
    for (const s of this.shoals) {
      const fill = g.fishCap[s.k] > 0 ? g.fish[s.k] / g.fishCap[s.k] : 0;
      if (fill < 0.35 || nr > 490) continue;
      for (let j = 0; j < 2; j++) {
        const ph = ((t * 0.35 + s.jump * 0.1 + j * 0.5) % 1);
        const sc = (0.4 + ph * 1.6) * (0.6 + fill * 0.6);
        TMP.m.compose(TMP.v.set(s.x + Math.sin(s.jump) * 0.3, 0.07, s.z), TMP.q.identity(), TMP.s.set(sc, 1, sc));
        this.ripples.setMatrixAt(nr++, TMP.m);
      }
    }
    this.ripples.count = nr;
    this.ripples.instanceMatrix.needsUpdate = true;

    // Hirsche im Wald, so viele wie Wild da ist
    let nd = 0;
    for (const h of this.herds) {
      if (g.wild[h.k] < 0.5) continue;
      for (let i = 0; i < 2 && nd < 300; i++) {
        const a = h.ph + i * 2.1 + t * h.spd;
        const x = h.x + Math.cos(a) * 2.2 + Math.sin(a * 2.3) * 0.6, z = h.z + Math.sin(a * 0.8) * 2.2;
        const kx = Math.floor(x), kz = Math.floor(z);
        if (kx < 0 || kz < 0 || kx >= N || kz >= N || g.tiles[kz * N + kx] !== T.Wald) continue;
        const grazing = Math.sin(t * 0.7 + h.ph + i) > 0.3;
        place(this.deer, nd++, x, Math.max(this.height(x, z), 0.05), z, a + Math.PI / 2 + (grazing ? 0.4 : 0), 1.2);
      }
    }
    this.deer.count = nd;
    this.deer.instanceMatrix.needsUpdate = true;

    // Weidetiere und Arbeiter aus den Betrieben
    let ns = 0, np = 0, nb = 0;
    const nw = { nichts: 0, stamm: 0, wild: 0 };
    for (const b of g.buildings) {
      if (!g.seen[g.idx(b.x, b.y)]) continue;
      const d = BUILDINGS[b.type];
      const [cx, cz] = g.center(b);
      if (b.type === 'schaffarm' || b.type === 'schweinezucht') {
        const mesh = b.type === 'schaffarm' ? this.sheep : this.pigs;
        for (let i = 0; i < 5; i++) {
          const ph = b.id * 1.7 + i * 1.3;
          const a = ph + t * 0.05;
          const R = (d.work ?? 3) * 0.75;
          let x = cx + Math.cos(a) * R * (0.5 + 0.5 * Math.sin(ph)), z = cz + Math.sin(a * 1.3) * R * (0.5 + 0.5 * Math.cos(ph));
          const k = Math.floor(z) * N + Math.floor(x);
          if (g.tiles[k] === T.Wasser || g.tiles[k] === T.Berg || g.occ[k] && g.occ[k] !== b.id) { x = cx + (i - 2) * 0.3; z = cz + 1.7; }
          const n = mesh === this.sheep ? ns++ : np++;
          place(mesh, n, x, Math.max(this.height(x, z), 0.05), z, a + Math.PI / 2 + Math.sin(t + i) * 0.3, 1.2);
        }
      }
      if (!d.harvest || !b.loaded || b.target === undefined || !d.prod) continue;
      const p = Math.min(1, b.progress / d.prod.time);
      const tx = (b.target % N) + 0.5, tz = ((b.target / N) | 0) + 0.5;
      // Weg: 0–30 % hin, Arbeit bis 80 %, dann zurück
      const out = Math.min(1, p / 0.3), back = Math.max(0, (p - 0.8) / 0.2);
      const f = p < 0.8 ? out : 1 - back;
      if (d.harvest.res === 'fisch') {
        const start = this.waterNear(b) ?? [cx, cz];
        const x = start[0] + (tx - start[0]) * f, z = start[1] + (tz - start[1]) * f;
        const heading = Math.atan2(tx - start[0], tz - start[1]) + (p > 0.8 ? Math.PI : 0);
        place(this.boats, nb++, x, 0.03 + Math.sin(t * 2 + b.id) * 0.02, z, heading + (p > 0.3 && p < 0.8 ? Math.sin(t) * 0.3 : 0), 1.3);
      } else if (d.harvest.res === 'baum' || d.harvest.res === 'wild') {
        const x = cx + (tx - cx) * f, z = cz + (tz - cz) * f;
        const heading = Math.atan2(tx - cx, tz - cz) + (p > 0.8 ? Math.PI : 0);
        const kind = p > 0.8 ? (d.harvest.res === 'baum' ? 'stamm' : 'wild') : 'nichts';
        // beim Hacken leicht vor und zurück wippen
        const chop = p > 0.3 && p < 0.8 && d.harvest.res === 'baum' ? Math.abs(Math.sin(t * 7)) * 0.05 : 0;
        const mesh = this.workers[kind];
        if (nw[kind] < 300) place(mesh, nw[kind]++, x - Math.sin(heading) * chop, Math.max(this.height(x, z), 0.05), z - Math.cos(heading) * chop, heading, 1.3);
      }
    }
    for (const [m, n] of [[this.sheep, ns], [this.pigs, np], [this.boats, nb], [this.workers.nichts, nw.nichts], [this.workers.stamm, nw.stamm], [this.workers.wild, nw.wild]] as const) {
      m.count = n; m.instanceMatrix.needsUpdate = true;
    }
  }

  private waterCache = new Map<number, [number, number] | null>();
  private waterNear(b: Building): [number, number] | null {
    if (this.waterCache.has(b.id)) return this.waterCache.get(b.id)!;
    let res: [number, number] | null = null;
    for (const [x, y] of this.g.ring(b)) if (this.g.inMap(x, y) && this.g.tiles[this.g.idx(x, y)] === T.Wasser) { res = [x + 0.5, y + 0.5]; break; }
    this.waterCache.set(b.id, res);
    return res;
  }
}
