// Leben in der Welt: Fischschwärme, Hirsche, Weidetiere, arbeitende Holzfäller/Jäger, Fischerboote.
// Alles wird aus dem Spielzustand abgeleitet (Bestände, Arbeitsfortschritt) – keine eigene Logik.
import * as THREE from 'three';
import { BUILDINGS } from '../data';
import { Building, Game } from '../game';
import { T } from '../world';
import { Builder, M } from './kit';
import { buildingMaterial } from './materials';
import { sound } from '../audio';
import { ensureCapacity, flushInstances } from './instances';

function fishGeo() {
  const b = new Builder();
  b.sphere(0.07, { c: 0x4e6474, p: 0 }, 0, 0, 0, 0.55, 0.5, 1.5, 6);
  b.sphere(0.05, { c: 0xb9c9d4, p: 0 }, 0, -0.012, 0.01, 0.6, 0.35, 1.3, 6);
  b.add(new THREE.ConeGeometry(0.05, 0.08, 4).rotateX(-Math.PI / 2), 0x3e5464, 0, 0, -0.12);
  return b.geometry();
}
/** Tier aus Teilen: Rumpf (fest), Kopf (dreht sich zum Grasen um das Genick), vier Beine (schwingen beim Laufen) */
interface AnimalDef { body: THREE.BufferGeometry; head: THREE.BufferGeometry; leg: THREE.BufferGeometry; neck: [number, number, number]; hips: [number, number, number][]; graze: number }

/** Bein: Oberkante im Ursprung (dort ist das Gelenk), nach unten hängend */
function legGeo(w: number, h: number, paint: number, hoof?: number) {
  const b = new Builder();
  b.box(w, h, w, paint, 0, -h, 0);
  if (hoof !== undefined) b.box(w * 1.15, h * 0.15, w * 1.15, hoof, 0, -h, 0);
  return b.geometry();
}
function sheepDef(): AnimalDef {
  const body = new Builder();
  body.sphere(0.13, { c: 0xf2efe6, p: 10 }, 0, 0.17, 0, 1, 0.85, 1.3, 14);
  // flauschiges Vlies: kleine Wollbüschel auf dem Rücken und an den Seiten
  for (const [x, y, z] of [[0, 0.27, 0.06], [0, 0.27, -0.07], [0.08, 0.22, 0.02], [-0.08, 0.22, 0.02], [0.07, 0.21, -0.1], [-0.07, 0.21, -0.1], [0, 0.24, 0.13]]) body.sphere(0.055, { c: 0xece8dc, p: 10 }, x, y, z, 1, 0.8, 1, 8);
  body.sphere(0.035, { c: 0xf2efe6, p: 10 }, 0, 0.2, -0.16, 1, 1, 1, 8); // Schwanz
  const head = new Builder();
  head.sphere(0.06, 0x2a2522, 0, 0.0, 0.07, 0.9, 1, 1.2, 12);
  head.sphere(0.045, { c: 0xece8dc, p: 10 }, 0, 0.045, 0.05, 1, 0.7, 1, 8); // Wollkappe
  for (const s of [-1, 1]) head.box(0.05, 0.015, 0.02, 0x2a2522, s * 0.05, 0.02, 0.05); // Ohren
  return { body: body.geometry(), head: head.geometry(), leg: legGeo(0.028, 0.1, 0x2a2522), neck: [0, 0.2, 0.1], hips: [[-0.06, 0.1, -0.08], [0.06, 0.1, 0.08], [0.06, 0.1, -0.08], [-0.06, 0.1, 0.08]], graze: 0.9 };
}
function pigDef(): AnimalDef {
  const body = new Builder();
  body.sphere(0.12, 0xe6a7a0, 0, 0.14, 0, 0.9, 0.8, 1.35, 14);
  body.box(0.01, 0.04, 0.01, 0xd98f88, 0, 0.17, -0.17); // Ringelschwanz
  const head = new Builder();
  head.sphere(0.065, 0xe6a7a0, 0, 0, 0.04, 0.95, 0.9, 1, 12);
  head.cyl(0.04, 0.045, 0.05, 10, 0xd98f88, 0, -0.01, 0.1, Math.PI / 2);
  for (const s of [-1, 1]) head.box(0.035, 0.012, 0.03, 0xd98f88, s * 0.04, 0.05, 0.03);
  return { body: body.geometry(), head: head.geometry(), leg: legGeo(0.035, 0.08, 0xd98f88), neck: [0, 0.14, 0.12], hips: [[-0.06, 0.08, -0.08], [0.06, 0.08, 0.08], [0.06, 0.08, -0.08], [-0.06, 0.08, 0.08]], graze: 0.6 };
}
function deerDef(): AnimalDef {
  const body = new Builder();
  body.sphere(0.1, 0x8a5a33, 0, 0.26, 0, 0.8, 0.75, 1.6, 14);
  body.sphere(0.04, 0xe8dcc8, 0, 0.27, -0.15, 1, 1, 0.6, 8); // heller Spiegel
  const head = new Builder();
  head.box(0.05, 0.17, 0.05, 0x8a5a33, 0, 0.07, 0.03);
  head.sphere(0.05, 0x7a4e2c, 0, 0.17, 0.07, 0.9, 0.9, 1.3, 12);
  for (const s of [-1, 1]) head.sphere(0.02, 0x7a4e2c, s * 0.04, 0.2, 0.05, 0.5, 1.2, 0.8, 6); // Lauscher
  for (const s of [-1, 1]) {
    head.box(0.012, 0.1, 0.012, 0x5a3d26, s * 0.03, 0.22, 0.06); head.box(0.04, 0.012, 0.012, 0x5a3d26, s * 0.045, 0.27, 0.06);
    head.box(0.012, 0.05, 0.012, 0x5a3d26, s * 0.05, 0.29, 0.04);
  }
  return { body: body.geometry(), head: head.geometry(), leg: legGeo(0.022, 0.2, 0x5a3d26, 0x2a1d14), neck: [0, 0.28, 0.1], hips: [[-0.05, 0.2, -0.1], [0.05, 0.2, 0.1], [0.05, 0.2, -0.1], [-0.05, 0.2, 0.1]], graze: 1.15 };
}
/** Arbeiter: Oberkörper (Kittel, Kopf, Hut, Werkzeug/Last) über zwei Beinen */
const WORKER_LEG = 0.11;
function workerGeo(carry: 'nichts' | 'stamm' | 'wild') {
  const b = new Builder();
  b.group(0, WORKER_LEG, 0, 0, (g) => {
    g.person(0, 0, 0, carry === 'wild' ? 0x9c3d2e : 0xd2a03a, 1.9);
    if (carry === 'stamm') g.log(0.04, 0.35, M.holz, 0, 0.25, 0, Math.PI / 2 - 0.2);
    else if (carry === 'wild') g.sphere(0.06, 0x8a5a33, 0.05, 0.24, -0.04, 1, 0.7, 1.4);
    else g.box(0.015, 0.2, 0.015, M.dunkelholz, 0.07, 0.08, 0.02); // Axt/Bogen in der Hand
  });
  return b.geometry();
}
function boatGeo() {
  const b = new Builder();
  b.add(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), M.bretterDunkel, 0, 0.06, 0);
  b.person(0, 0, 0, 0x3f6fb0, 1.5);
  b.box(0.01, 0.01, 0.4, M.holz, 0.13, 0.12, 0); // Ruder
  return b.geometry();
}

interface Walk { s: number; moving: boolean; graze: number }
const WALK: Walk = { s: 0, moving: false, graze: 0 };
/**
 * Laufen/Stehen im Wechsel: s = zurückgelegter Anteil, moving = läuft gerade, graze = 0..1 Kopf unten.
 * Schreibt in ein wiederverwendetes Objekt (kein Speichermüll je Bild) – Ergebnis sofort verwenden.
 */
function walk(tt: number, period: number, ph: number, mv = 0.35): Walk {
  const q = tt / period + ph;
  const n = Math.floor(q), f = q - n;
  const e = f < mv ? f / mv : 1;
  // nach dem Anhalten Kopf langsam senken, kurz vor dem Weiterlaufen heben
  WALK.graze = f < mv ? 0 : Math.min(1, (f - mv) / 0.08, (1 - f) / 0.06);
  WALK.s = n + e * e * (3 - 2 * e);
  WALK.moving = f < mv && f > 0.02 && f < mv - 0.02;
  return WALK;
}

/** Höchstzahlen je Art (der Platz wächst bei Bedarf bis dahin) */
const MAXN = { fish: 2000, ripples: 500, animal: 400, deer: 300, worker: 300, workerLegs: 1600, boats: 200 };

interface Animal { def: AnimalDef; body: THREE.InstancedMesh; head: THREE.InstancedMesh; legs: THREE.InstancedMesh; n: number; max: number }
interface Shoal { x: number; z: number; k: number; fish: { r: number; w: number; ph: number; d: number }[]; jump: number }
interface Herd { x: number; z: number; k: number; ph: number; spd: number; tracks: [number, number][][] }

const TMP = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), base: new THREE.Matrix4(), loc: new THREE.Matrix4(), rot: new THREE.Matrix4() };
/** Teil eines Tieres: Grundlage × (Gelenkpunkt × Drehung um die Querachse) */
function placePart(mesh: THREE.InstancedMesh, i: number, px: number, py: number, pz: number, rx: number) {
  if (i >= mesh.instanceMatrix.count) return;
  TMP.loc.makeTranslation(px, py, pz).multiply(TMP.rot.makeRotationX(rx));
  TMP.m.multiplyMatrices(TMP.base, TMP.loc);
  mesh.setMatrixAt(i, TMP.m);
}
function place(mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, rot: number, s = 1) {
  if (i >= mesh.instanceMatrix.count) return;
  TMP.m.compose(TMP.v.set(x, y, z), TMP.q.setFromAxisAngle(TMP.up, rot), TMP.s.set(s, s, s));
  mesh.setMatrixAt(i, TMP.m);
}

export class LifeLayer {
  group = new THREE.Group();
  private mat = buildingMaterial();
  private fish: THREE.InstancedMesh;
  private animals: Record<'sheep' | 'pigs' | 'deer', Animal>;
  private animalList: Animal[];
  private plain: THREE.InstancedMesh[];
  private workers: Record<'nichts' | 'stamm' | 'wild', THREE.InstancedMesh>;
  private workerLegs: THREE.InstancedMesh;
  private boats: THREE.InstancedMesh;
  private shoals: Shoal[] = [];
  private beats = new Map<number, number>();
  private ripples: THREE.InstancedMesh;
  private herds: Herd[] = [];

  constructor(private g: Game, private height: (x: number, z: number) => number) {
    // klein anfangen: der Platz wächst bei Bedarf (siehe MAXN)
    const mk = (geo: THREE.BufferGeometry, n: number, shadow = true) => {
      const m = new THREE.InstancedMesh(geo, this.mat, n);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = shadow; m.frustumCulled = false; m.count = 0; m.visible = false;
      this.group.add(m);
      return m;
    };
    this.fish = mk(fishGeo(), 256, false);
    const animal = (def: AnimalDef, max: number): Animal => ({ def, body: mk(def.body, 32), head: mk(def.head, 32), legs: mk(def.leg, 128), n: 0, max });
    this.animals = { sheep: animal(sheepDef(), MAXN.animal), pigs: animal(pigDef(), MAXN.animal), deer: animal(deerDef(), MAXN.deer) };
    this.animalList = [this.animals.sheep, this.animals.pigs, this.animals.deer];
    this.workers = { nichts: mk(workerGeo('nichts'), 32), stamm: mk(workerGeo('stamm'), 32), wild: mk(workerGeo('wild'), 16) };
    this.workerLegs = mk(legGeo(0.035, WORKER_LEG, 0x4a3a2a, 0x2a2018), 128);
    this.boats = mk(boatGeo(), 16);
    // Kräuselringe über Fischschwärmen – zeigen von Weitem gute Fanggründe
    this.ripples = new THREE.InstancedMesh(new THREE.RingGeometry(0.42, 0.5, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.45, depthWrite: false }), 64);
    this.ripples.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ripples.frustumCulled = false; this.ripples.count = 0; this.ripples.visible = false; this.ripples.renderOrder = 2;
    this.group.add(this.ripples);
    this.plain = [this.fish, this.ripples, this.boats, this.workers.nichts, this.workers.stamm, this.workers.wild, this.workerLegs];
    this.rebuild();
  }

  setGame(g: Game, height: (x: number, z: number) => number) { this.g = g; this.height = height; this.waterCache.clear(); this.beats.clear(); this.rebuild(); }

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
        // feste Zufallswerte je Fanggrund, damit Schwärme beim Neuaufbau nicht springen
        let a = best * 9.137;
        const rnd = () => { a = Math.sin(a) * 43758.5453; return a - Math.floor(a); };
        const fish = Array.from({ length: 10 }, () => ({ r: 0.25 + rnd() * 0.8, w: (0.5 + rnd() * 0.7) * (rnd() < 0.5 ? -1 : 1), ph: rnd() * 6.28, d: 0.02 + rnd() * 0.05 }));
        this.shoals.push({ x: (best % N) + 0.5, z: ((best / N) | 0) + 0.5, k: best, fish, jump: rnd() * 10 });
      }
    }
    for (let y = 1; y < N - 1; y += 7) for (let x = 1; x < N - 1; x += 7) {
      const k = y * N + x;
      if (g.tiles[k] !== T.Wald || !g.seen[k] || this.herds.length >= 280) continue;
      // nur am Waldrand (Lichtung/Wiese daneben), damit man die Tiere sieht
      let edge = false;
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const t2 = g.tiles[(y + j) * N + x + i]; if (t2 === T.Gras || t2 === T.Sand) edge = true; }
      if (!edge) continue;
      const h: Herd = { x: x + 0.5, z: y + 0.5, k, ph: (k * 0.731) % 6.28, spd: 0.04 + ((k * 0.317) % 1) * 0.05, tracks: [] };
      // je Tier eine Bahn: nur das längste zusammenhängende Stück auf freiem Boden (Tiere laufen darauf hin und her)
      for (let i = 0; i < 2; i++) {
        const pts: [number, number][] = [];
        for (let j = 0; j < 48; j++) {
          const a = h.ph + i * 2.1 + (j / 48) * Math.PI * 2;
          pts.push([h.x + Math.cos(a) * 2.2 + Math.sin(a * 2.3) * 0.6, h.z + Math.sin(a * 0.8) * 2.2]);
        }
        const ok = pts.map(([px, pz]) => this.free(px, pz));
        let best: [number, number][] = [], cur: [number, number][] = [];
        for (let j = 0; j < 96; j++) { // zweimal herum, damit Stücke über den Anfang hinweg zählen
          if (ok[j % 48] && cur.length < 48) { cur.push(pts[j % 48]); if (cur.length > best.length) best = cur.slice(); } else cur = [];
        }
        h.tracks.push(best);
      }
      if (h.tracks.some((tr) => tr.length >= 4)) this.herds.push(h);
    }
  }

  /** frei begehbar für Tiere (kein Wasser, Berg, Gebäude, Weg) */
  private free(x: number, z: number): boolean {
    const g = this.g, N = g.size;
    const kx = Math.floor(x), kz = Math.floor(z);
    if (kx < 0 || kz < 0 || kx >= N || kz >= N) return false;
    const k = kz * N + kx, t = g.tiles[k];
    return t !== T.Wasser && t !== T.Berg && !g.occ[k] && !g.roads[k];
  }

  /** ein Tier aus Teilen zeichnen */
  private drawAnimal(kind: 'sheep' | 'pigs' | 'deer', x: number, z: number, head: number, scale: number, t: number, w: Walk, seed: number) {
    const A = this.animals[kind];
    if (A.n >= A.max) return;
    if (A.n >= A.body.instanceMatrix.count) {
      ensureCapacity(A.body, A.n + 1, A.max); ensureCapacity(A.head, A.n + 1, A.max); ensureCapacity(A.legs, (A.n + 1) * 4, A.max * 4);
    }
    const i = A.n++;
    TMP.base.compose(TMP.v.set(x, Math.max(this.height(x, z), 0.05), z), TMP.q.setFromAxisAngle(TMP.up, head), TMP.s.set(scale, scale, scale));
    A.body.setMatrixAt(i, TMP.base);
    const nod = w.moving ? Math.sin(t * 9 + seed) * 0.08 : Math.sin(t * 1.3 + seed) * 0.05;
    placePart(A.head, i, A.def.neck[0], A.def.neck[1], A.def.neck[2], w.graze * A.def.graze + nod);
    // Kreuzgang: diagonale Beinpaare schwingen gemeinsam
    const swing = w.moving ? Math.sin(t * (kind === 'deer' ? 9 : 11) + seed) * 0.55 : 0;
    const hips = A.def.hips;
    for (let li = 0; li < hips.length; li++) placePart(A.legs, i * 4 + li, hips[li][0], hips[li][1], hips[li][2], li < 2 ? swing : -swing);
  }

  /** cam = Kameraziel (x, z) und Abstand; weit weg wird nichts gezeichnet (spart Rechenzeit) */
  update(t: number, cam: { x: number; z: number; dist: number }) {
    const g = this.g, N = g.size;
    const R = Math.max(18, cam.dist * 1.4);
    const cx0 = cam.x, cz0 = cam.z;
    if (cam.dist > 60) {
      // nichts zu zeigen: alle Gruppen aus (kein Hochladen, kein Zeichnen)
      for (const m of this.plain) if (m.visible) flushInstances(m, 0);
      for (const A of this.animalList) if (A.body.visible) { flushInstances(A.body, 0); flushInstances(A.head, 0); flushInstances(A.legs, 0); }
      return;
    }
    for (const A of this.animalList) A.n = 0;
    // Fischschwärme: Anzahl sichtbarer Fische = aktueller Bestand des Fanggrunds
    let nf = 0;
    if (cam.dist <= 30) for (const s of this.shoals) {
      if (Math.abs(s.x - cx0) >= R || Math.abs(s.z - cz0) >= R) continue;
      const fill = g.fishCap[s.k] > 0 ? g.fish[s.k] / g.fishCap[s.k] : 0;
      const show = Math.round(s.fish.length * fill);
      if (nf + show > this.fish.instanceMatrix.count) ensureCapacity(this.fish, nf + show, MAXN.fish);
      for (let i = 0; i < show && nf < MAXN.fish; i++) {
        const f = s.fish[i];
        const a = f.ph + t * f.w;
        const x = s.x + Math.cos(a) * f.r, z = s.z + Math.sin(a) * f.r * 0.7;
        let y = -f.d + Math.sin(t * 2 + i) * 0.01;
        // ab und zu springt ein Fisch aus dem Wasser
        if (i === 0) { const jt = (t + s.jump) % 9; if (jt < 0.7) y = Math.sin((jt / 0.7) * Math.PI) * 0.3; }
        place(this.fish, nf++, x, y, z, a + (f.w > 0 ? Math.PI : 0), 1.8);
      }
    }
    flushInstances(this.fish, Math.min(nf, this.fish.instanceMatrix.count));
    // je Schwarm zwei Kräuselringe, die sich ausbreiten (nur bei gutem Bestand)
    let nr = 0;
    for (const s of this.shoals) {
      if (Math.abs(s.x - cx0) >= R || Math.abs(s.z - cz0) >= R) continue;
      const fill = g.fishCap[s.k] > 0 ? g.fish[s.k] / g.fishCap[s.k] : 0;
      if (fill < 0.35 || nr + 2 > MAXN.ripples) continue;
      if (nr + 2 > this.ripples.instanceMatrix.count) ensureCapacity(this.ripples, nr + 2, MAXN.ripples);
      for (let j = 0; j < 2; j++) {
        const ph = ((t * 0.35 + s.jump * 0.1 + j * 0.5) % 1);
        const sc = (0.4 + ph * 1.6) * (0.6 + fill * 0.6);
        TMP.m.compose(TMP.v.set(s.x + Math.sin(s.jump) * 0.3, 0.07, s.z), TMP.q.identity(), TMP.s.set(sc, 1, sc));
        this.ripples.setMatrixAt(nr++, TMP.m);
      }
    }
    flushInstances(this.ripples, nr);

    // Hirsche am Waldrand, so viele wie Wild da ist: laufen auf freiem Boden hin und her, bleiben stehen und äsen
    for (const h of this.herds) {
      if (g.wild[h.k] < 0.5 || Math.abs(h.x - cx0) >= R || Math.abs(h.z - cz0) >= R) continue;
      for (let i = 0; i < h.tracks.length; i++) {
        const tr = h.tracks[i];
        if (tr.length < 4) continue;
        const w = walk(t, 7 + i, h.ph + i * 0.37);
        // Position auf der Bahn: hin und zurück (Pendel), Schritte je Laufabschnitt
        const L = tr.length - 1;
        const u = (w.s * 6 * h.spd * 20) % (2 * L);
        const dirFwd = u <= L;
        const pos = dirFwd ? u : 2 * L - u;
        const j = Math.min(L - 1, Math.floor(pos)), f = pos - j;
        const ax = tr[j][0], az = tr[j][1], bx = tr[j + 1][0], bz = tr[j + 1][1];
        const x = ax + (bx - ax) * f, z = az + (bz - az) * f;
        if (!this.free(x, z)) continue; // inzwischen bebaut
        const head = Math.atan2((bx - ax) * (dirFwd ? 1 : -1), (bz - az) * (dirFwd ? 1 : -1));
        this.drawAnimal('deer', x, z, head, 1.7, t, w, h.k + i);
      }
    }

    // Weidetiere und Arbeiter aus den Betrieben
    let nb = 0, nl = 0, wN = 0, wS = 0, wW = 0;
    const W = this.workers;
    for (const b of g.buildings) {
      if (!g.seen[g.idx(b.x, b.y)]) continue;
      const d = BUILDINGS[b.type];
      // Gebäudemitte direkt ausrechnen (kein neues Feld je Gebäude und Bild)
      const cx = b.x + d.size / 2, cz = b.y + d.size / 2;
      if (Math.abs(cx - cx0) >= R || Math.abs(cz - cz0) >= R) continue;
      if (b.type === 'schaffarm' || b.type === 'schweinezucht') {
        const kind = b.type === 'schaffarm' ? 'sheep' : 'pigs';
        // innerhalb des Zauns (Hof 3×3) umherlaufen
        const RR = d.size / 2 - 0.35;
        for (let i = 0; i < 5; i++) {
          const ph = b.id * 1.7 + i * 1.3;
          const w = walk(t, 9 + i * 1.3, ph);
          const a = ph + w.s * 0.6, a2 = a + 0.05;
          const kz = 0.4 + 0.6 * Math.abs(Math.cos(ph));
          const x = cx + Math.cos(a) * RR * (0.4 + 0.6 * Math.abs(Math.sin(ph + a * 0.6))), z = cz + Math.sin(a * 1.3) * RR * kz;
          const x2 = cx + Math.cos(a2) * RR * (0.4 + 0.6 * Math.abs(Math.sin(ph + a2 * 0.6))), z2 = cz + Math.sin(a2 * 1.3) * RR * kz;
          this.drawAnimal(kind, x, z, Math.atan2(x2 - x, z2 - z), 1.2, t, w, b.id + i * 7);
        }
      }
      if (!d.harvest || !b.loaded || b.target === undefined || !d.prod) continue;
      const p = Math.min(1, g.ipProgress(b) / d.prod.time);
      const tx = (b.target % N) + 0.5, tz = ((b.target / N) | 0) + 0.5;
      // Weg: 0–30 % hin, Arbeit bis 80 %, dann zurück
      const out = Math.min(1, p / 0.3), back = Math.max(0, (p - 0.8) / 0.2);
      const f = p < 0.8 ? out : 1 - back;
      if (d.harvest.res === 'fisch') {
        if (nb >= MAXN.boats) continue;
        const wtr = this.waterNear(b);
        const sx = wtr ? wtr[0] : cx, sz = wtr ? wtr[1] : cz;
        const x = sx + (tx - sx) * f, z = sz + (tz - sz) * f;
        const heading = Math.atan2(tx - sx, tz - sz) + (p > 0.8 ? Math.PI : 0);
        if (nb >= this.boats.instanceMatrix.count) ensureCapacity(this.boats, nb + 1, MAXN.boats);
        place(this.boats, nb++, x, 0.03 + Math.sin(t * 2 + b.id) * 0.02, z, heading + (p > 0.3 && p < 0.8 ? Math.sin(t) * 0.3 : 0), 1.3);
      } else if (d.harvest.res === 'baum' || d.harvest.res === 'wild') {
        // am Baum auf der Hof-Seite stehen (sonst verdecken die Kronen die Figur)
        const dl = Math.hypot(tx - cx, tz - cz) || 1;
        const ex = tx - ((tx - cx) / dl) * 0.6, ez = tz - ((tz - cz) / dl) * 0.6;
        const x = cx + (ex - cx) * f, z = cz + (ez - cz) * f;
        const heading = Math.atan2(tx - cx, tz - cz) + (p > 0.8 ? Math.PI : 0);
        const kind = p > 0.8 ? (d.harvest.res === 'baum' ? 'stamm' : 'wild') : 'nichts';
        // beim Hacken leicht vor und zurück wippen
        const chop = p > 0.3 && p < 0.8 && d.harvest.res === 'baum' ? Math.abs(Math.sin(t * 7)) * 0.05 : 0;
        if (chop) {
          const beat = Math.floor((t * 7) / Math.PI);
          if (this.beats.get(b.id) !== beat) { this.beats.set(b.id, beat); sound.play('axt', { x, z }); }
        }
        const mesh = W[kind];
        const wi = kind === 'nichts' ? wN : kind === 'stamm' ? wS : wW;
        if (wi < MAXN.worker) {
          if (kind === 'nichts') wN++; else if (kind === 'stamm') wS++; else wW++;
          if (wi >= mesh.instanceMatrix.count) ensureCapacity(mesh, wi + 1, MAXN.worker);
          const wx = x - Math.sin(heading) * chop, wz = z - Math.cos(heading) * chop;
          const wy = Math.max(this.height(wx, wz), 0.05);
          place(mesh, wi, wx, wy, wz, heading, 1.6);
          // Beine: schwingen auf dem Hin- und Rückweg, stehen beim Arbeiten
          const walking = p < 0.3 || p > 0.8;
          const sw = walking ? Math.sin(t * 12 + b.id) * 0.6 : 0;
          TMP.base.compose(TMP.v.set(wx, wy, wz), TMP.q.setFromAxisAngle(TMP.up, heading), TMP.s.set(1.6, 1.6, 1.6));
          if (nl + 2 <= MAXN.workerLegs) {
            if (nl + 2 > this.workerLegs.instanceMatrix.count) ensureCapacity(this.workerLegs, nl + 2, MAXN.workerLegs);
            placePart(this.workerLegs, nl++, -0.025, WORKER_LEG, 0, sw); placePart(this.workerLegs, nl++, 0.025, WORKER_LEG, 0, -sw);
          }
        }
      }
    }
    flushInstances(this.boats, nb);
    flushInstances(W.nichts, wN); flushInstances(W.stamm, wS); flushInstances(W.wild, wW);
    flushInstances(this.workerLegs, nl);
    for (const A of this.animalList) { flushInstances(A.body, A.n); flushInstances(A.head, A.n); flushInstances(A.legs, A.n * 4); }
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
