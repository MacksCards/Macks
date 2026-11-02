// Leben in der Welt: Fischschwärme, Hirsche, Weidetiere, arbeitende Holzfäller/Jäger, Fischerboote.
// Alles wird aus dem Spielzustand abgeleitet (Bestände, Arbeitsfortschritt) – keine eigene Logik.
//
// Fischschwärme sieht man wie in der Natur: dunkle Fischschatten knapp unter der Oberfläche, darunter ein
// leichter dunkler Fleck des ganzen Schwarms, ab und zu ein kleiner, weich auslaufender Kräuselring, wo ein
// Fisch an die Oberfläche kommt (nur in der Nähe), gelegentlich ein springender Fisch mit Spritzern, und über
// großen Schwärmen kreisen Möwen. Wie viel davon zu sehen ist, hängt vom Fischbestand des Fanggrunds ab.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
/**
 * Weiche, flache Form auf dem Wasser (Farbe kommt vom Material): innen deckend (midA), am Umriss outA, dann
 * um `soft` weiter außen weich auslaufend (Deckkraft 0). outline = Umriss (x, z) um den Mittelpunkt c.
 */
function softShape(outline: [number, number][], c: [number, number], soft: number, outA = 1, midA = 1): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [];
  const put = (x: number, z: number, a: number) => { pos.push(x, 0, z); col.push(1, 1, 1, a); };
  const ext = (x: number, z: number): [number, number] => {
    const dx = x - c[0], dz = z - c[1], l = Math.hypot(dx, dz) || 1;
    return [x + (dx / l) * soft, z + (dz / l) * soft];
  };
  for (let i = 0; i < outline.length; i++) {
    const [ax, az] = outline[i], [bx, bz] = outline[(i + 1) % outline.length];
    const [aox, aoz] = ext(ax, az), [box, boz] = ext(bx, bz);
    put(c[0], c[1], midA); put(bx, bz, outA); put(ax, az, outA);
    put(ax, az, outA); put(bx, bz, outA); put(box, boz, 0);
    put(ax, az, outA); put(box, boz, 0); put(aox, aoz, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  return g;
}
/** Fischschatten von oben: schlanker Körper mit Schwanzflosse (Kopf zeigt nach +z), weicher Rand */
function fishShadeGeo() {
  const body = softShape([[0, 0.17], [0.026, 0.135], [0.04, 0.07], [0.041, 0], [0.032, -0.07], [0.018, -0.13], [-0.018, -0.13], [-0.032, -0.07], [-0.041, 0], [-0.04, 0.07], [-0.026, 0.135]], [0, 0.01], 0.025, 0.85);
  const tail = softShape([[0, -0.12], [0.055, -0.215], [0.012, -0.19], [-0.012, -0.19], [-0.055, -0.215]], [0, -0.165], 0.018, 0.7, 0.8);
  return mergeGeometries([body, tail])!;
}
/** dunkler Fleck unter dem ganzen Schwarm: unregelmäßig rund, sehr weich */
function patchGeo() {
  const pts: [number, number][] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const r = 0.62 + 0.14 * Math.sin(a * 3 + 0.7) + 0.08 * Math.sin(a * 5 + 2.1);
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return softShape(pts, [0, 0], 0.75, 0.55);
}
/** Kräuselring: schmal, innen und außen weich (hell, wird aufs Wasser addiert) */
function ringGeo() {
  const pos: number[] = [], col: number[] = [];
  const R = [0.4, 0.78, 1.0], A = [0, 1, 0], n = 40;
  const p = (r: number, a: number, al: number) => { pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); col.push(1, 1, 1, al); };
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    for (let k = 0; k < 2; k++) {
      p(R[k], a0, A[k]); p(R[k + 1], a0, A[k + 1]); p(R[k + 1], a1, A[k + 1]);
      p(R[k], a0, A[k]); p(R[k + 1], a1, A[k + 1]); p(R[k], a1, A[k]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  return g;
}
/** Möwe: Rumpf mit Kopf, Schnabel und Schwanz; die Flügel sind eigene Teile (schlagen am Gelenk) */
function gullBodyGeo() {
  const b = new Builder();
  b.sphere(0.03, 0xf3f2ee, 0, 0, 0, 0.85, 0.8, 2.5, 10);
  b.sphere(0.022, 0xf6f5f1, 0, 0.012, 0.07, 1, 0.95, 1.15, 8);
  b.add(new THREE.ConeGeometry(0.007, 0.03, 5).rotateX(Math.PI / 2), 0xe2b43a, 0, 0.008, 0.098);
  b.add(new THREE.ConeGeometry(0.026, 0.06, 4).rotateX(-Math.PI / 2), 0xe6e6e2, 0, 0.002, -0.085, 0, 0, 0, 1, 0.25, 1);
  return b.geometry();
}
/** Flügel als dünne Platte: breit am Rumpf, spitz auslaufend, dunkle Spitze; side −1 = linker Flügel */
function gullWingGeo(side: 1 | -1) {
  const shape = (P: [number, number][]) => {
    const sh = new THREE.Shape();
    sh.moveTo(P[0][0] * side, P[0][1]);
    for (let i = 1; i < P.length; i++) sh.lineTo(P[i][0] * side, P[i][1]);
    return sh;
  };
  const wing = shape([[0, 0.03], [0.09, 0.034], [0.17, 0.02], [0.24, -0.004], [0.2, -0.02], [0.11, -0.03], [0, -0.032]]);
  const tip = shape([[0.165, 0.021], [0.24, -0.004], [0.2, -0.02], [0.16, -0.013]]);
  const plate = (s: THREE.Shape, y: number) => new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, y, 0);
  const b = new Builder();
  b.add(plate(wing, 0.003), 0xd9dde0);
  b.add(plate(tip, 0.0046), 0x26282b);
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
const MAXN = { fish: 200, shades: 2000, patches: 220, rings: 800, drops: 1200, gulls: 160, animal: 400, deer: 300, worker: 300, workerLegs: 1600, boats: 200 };
/** Höhe der Fischschatten und Ringe: knapp über den höchsten Wellen (sonst schneiden die Wellen Stücke heraus) */
const WY = 0.1;
/** Sprung: Dauer in der Luft (s); Ringe laufen so lange aus (s); Spritzer fliegen so lange (s) */
const JUMP = 0.75, RING_T = 1.35, DROP_T = 0.5;
/** fester Zufallswert 0..1 aus einer Zahl */
const hash = (n: number) => { const v = Math.sin(n * 12.9898 + 4.1414) * 43758.5453; return v - Math.floor(v); };
/** Mitte eines Schwarms zur Zeit tt: der ganze Schwarm wandert langsam um seinen Platz */
const shoalX = (s: Shoal, tt: number) => s.x + Math.sin(tt * 0.11 + s.jump) * 0.35;
const shoalZ = (s: Shoal, tt: number) => s.z + Math.cos(tt * 0.09 + s.jump * 1.3) * 0.3;
/** Lage eines Fisches zur Zeit tt (schreibt in FP, kein Speichermüll je Bild) */
const FP = { x: 0, z: 0 };
function fishAt(s: Shoal, f: Shoal['fish'][number], tt: number) {
  const a = f.ph + tt * f.w;
  FP.x = shoalX(s, tt) + Math.cos(a) * f.r; FP.z = shoalZ(s, tt) + Math.sin(a) * f.r * 0.7;
  return FP;
}

interface Animal { def: AnimalDef; body: THREE.InstancedMesh; head: THREE.InstancedMesh; legs: THREE.InstancedMesh; n: number; max: number }
/** Fanggrund: Mitte, Block, Feld k, Fische (Bahnhalbmesser, Tempo, Lage, Tiefe), Sprungtakt (jump = Versatz, jp = Abstand in s) */
interface Shoal { x: number; z: number; ox: number; oy: number; k: number; fish: { r: number; w: number; ph: number; d: number }[]; jump: number; jp: number }
interface Herd { x: number; z: number; k: number; ph: number; spd: number; tracks: [number, number][][] }

const TMP = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), base: new THREE.Matrix4(), loc: new THREE.Matrix4(), rot: new THREE.Matrix4(), e: new THREE.Euler(), c: new THREE.Color() };
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
  /** Fischschatten, Schwarm-Flecken, Kräuselringe, Spritzer, Möwen (Rumpf und beide Flügel) */
  private shades: THREE.InstancedMesh;
  private patches: THREE.InstancedMesh;
  private rings: THREE.InstancedMesh;
  private drops: THREE.InstancedMesh;
  private gulls: THREE.InstancedMesh;
  private wingsR: THREE.InstancedMesh;
  private wingsL: THREE.InstancedMesh;
  private nr = 0;
  /** Helligkeit der Kräuselringe je nach Kameraabstand (1 = nah, 0 = von Weitem ausgeblendet) */
  private ringFade = 1;
  private nd = 0;
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
    // auf dem Wasser: über die Wasserfläche gelegt (danach gezeichnet), ohne Tiefe zu schreiben
    const onWater = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number, order: number) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false; m.count = 0; m.visible = false; m.renderOrder = order;
      this.group.add(m);
      return m;
    };
    this.patches = onWater(patchGeo(), new THREE.MeshBasicMaterial({ color: 0x03202c, vertexColors: true, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }), 16, 2);
    this.shades = onWater(fishShadeGeo(), new THREE.MeshBasicMaterial({ color: 0x082a36, vertexColors: true, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide }), 64, 3);
    // Ringe und Spritzer hellen das Wasser auf (Licht spiegelt sich auf der bewegten Oberfläche); Ausblenden über die Farbe
    const glow = (vc: boolean) => new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: vc, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.rings = onWater(ringGeo(), glow(true), 32, 4);
    this.drops = onWater(new THREE.SphereGeometry(0.016, 6, 4), glow(false), 64, 4);
    for (const m of [this.rings, this.drops]) m.setColorAt(0, TMP.c.setRGB(1, 1, 1));
    this.gulls = mk(gullBodyGeo(), 8, false);
    this.wingsR = mk(gullWingGeo(1), 8, false);
    this.wingsL = mk(gullWingGeo(-1), 8, false);
    this.plain = [this.fish, this.shades, this.patches, this.rings, this.drops, this.gulls, this.wingsR, this.wingsL, this.boats, this.workers.nichts, this.workers.stamm, this.workers.wild, this.workerLegs];
    this.rebuild();
  }

  setGame(g: Game, height: (x: number, z: number) => number) { this.g = g; this.height = height; this.waterCache.clear(); this.beats.clear(); this.rebuild(); }

  /**
   * Schwärme und Wildherden neu verteilen (nach Entdeckungen oder Bauen). Ohne Rechteck die ganze Welt,
   * sonst nur um das Rechteck r (Felder) herum; what: 1 = Fischschwärme, 2 = Wild, 3 = beides.
   */
  rebuild(r?: { x0: number; y0: number; x1: number; y1: number }, what = 3) {
    const g = this.g, N = g.size;
    // Fanggründe liegen in 4 × 4-Feldern ab (2, 2), Herden auf einem 7er-Raster ab (1, 1) und laufen bis gut 3 Felder weit
    const R = r ?? { x0: 0, y0: 0, x1: N - 1, y1: N - 1 };
    if (what & 1) {
      if (!r) this.shoals = [];
      else this.shoals = this.shoals.filter((s) => { const ox = s.ox, oy = s.oy; return ox + 3 < R.x0 || ox > R.x1 || oy + 3 < R.y0 || oy > R.y1; });
      const ya = Math.max(2, 2 + Math.ceil((R.y0 - 3 - 2) / 4) * 4), xa = Math.max(2, 2 + Math.ceil((R.x0 - 3 - 2) / 4) * 4);
      this.addShoals(xa, ya, Math.min(N - 3, R.x1), Math.min(N - 3, R.y1));
    }
    if (what & 2) {
      const M = 4;
      if (!r) this.herds = [];
      else this.herds = this.herds.filter((h) => h.x < R.x0 - M || h.x > R.x1 + M + 1 || h.z < R.y0 - M || h.z > R.y1 + M + 1);
      const ya = Math.max(1, 1 + Math.ceil((R.y0 - M - 1) / 7) * 7), xa = Math.max(1, 1 + Math.ceil((R.x0 - M - 1) / 7) * 7);
      this.addHerds(xa, ya, Math.min(N - 2, R.x1 + M), Math.min(N - 2, R.y1 + M));
    }
  }

  private addShoals(xa: number, ya: number, xb: number, yb: number) {
    const g = this.g, N = g.size;
    for (let y = ya; y < N - 2 && y <= yb; y += 4) for (let x = xa; x < N - 2 && x <= xb; x += 4) {
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
        // ein Schwarm zieht in eine Richtung (alle Fische gleichsinnig), jeder auf etwas anderer Bahn und Tiefe
        const dir = rnd() < 0.5 ? -1 : 1;
        const fish = Array.from({ length: 12 }, () => ({ r: 0.2 + rnd() * 0.75, w: (0.45 + rnd() * 0.35) * dir, ph: rnd() * 6.28, d: rnd() }));
        this.shoals.push({ x: (best % N) + 0.5, z: ((best / N) | 0) + 0.5, ox: x, oy: y, k: best, fish, jump: rnd() * 10, jp: 7 + rnd() * 6 });
      }
    }
  }

  private addHerds(xa: number, ya: number, xb: number, yb: number) {
    const g = this.g, N = g.size;
    for (let y = ya; y < N - 1 && y <= yb; y += 7) for (let x = xa; x < N - 1 && x <= xb; x += 7) {
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
    this.updateShoals(t, cam, R);

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

  /**
   * Fischschwärme zeichnen. Je mehr Fische der Fanggrund gerade hat, desto mehr Fischschatten, desto öfter
   * kommt ein Fisch an die Oberfläche, und über vollen Fanggründen kreisen Möwen.
   */
  private updateShoals(t: number, cam: { x: number; z: number; dist: number }, R: number) {
    const g = this.g;
    const drops = cam.dist <= 30, birds = cam.dist <= 60, jumpFish = cam.dist <= 34;
    // Fischschatten bis ganz hinaus (von Weitem nur jeder zweite Fisch: spart Rechenzeit, der Schwarm bleibt erkennbar)
    const step = cam.dist > 34 ? 2 : 1;
    // der dunkle Fleck gehört zur Nahansicht (von Weitem sähe er aus wie ein Wolkenschatten): mit dem Zoom ausblenden
    const pm = this.patches.material as THREE.MeshBasicMaterial;
    pm.opacity = 0.18 * (1 - Math.min(1, Math.max(0, (cam.dist - 14) / 12)));
    const patch = pm.opacity > 0.005;
    // Möwen von Weitem etwas größer, damit man sie noch sieht
    const farK = Math.min(1, Math.max(0, (cam.dist - 18) / 30));
    // Kräuselringe gehören zur Nahansicht: von Weitem waren sie nur noch kleine, scharf umrandete hellblaue
    // Kreise („komische blaue Zeichen“) – deshalb ab Abstand 24 schwächer, ab 36 ganz weg (nah unverändert).
    // Den Fanggrund erkennt man von Weitem an den Fischschatten.
    const rf = Math.min(1, Math.max(0, (cam.dist - 24) / 12));
    this.ringFade = 1 - rf * rf * (3 - 2 * rf);
    let nf = 0, ns = 0, np = 0, ng = 0;
    this.nr = 0; this.nd = 0;
    const { m, q, v, s: sc, up, e } = TMP;
    for (const s of this.shoals) {
      if (Math.abs(s.x - cam.x) >= R || Math.abs(s.z - cam.z) >= R) continue;
      const fill = g.fishCap[s.k] > 0 ? g.fish[s.k] / g.fishCap[s.k] : 0;
      if (fill < 0.05) continue;
      const sx = shoalX(s, t), sz = shoalZ(s, t);
      // dunkler Fleck des Schwarms (größer bei vollem Fanggrund, atmet leicht)
      if (patch && np < MAXN.patches) {
        if (np >= this.patches.instanceMatrix.count) ensureCapacity(this.patches, np + 1, MAXN.patches);
        const k = (0.65 + 0.55 * fill) * (1 + Math.sin(t * 0.5 + s.jump) * 0.06);
        m.compose(v.set(sx, WY - 0.004, sz), q.setFromAxisAngle(up, s.jump + t * 0.05), sc.set(k * 1.15, 1, k * 0.85));
        this.patches.setMatrixAt(np++, m);
      }
      const show = Math.round(s.fish.length * fill);
      // Sprung: der erste Fisch springt ab und zu (nur bei gutem Bestand)
      const jt = (t + s.jump) % s.jp;
      const jumps = show > 0 && fill >= 0.3;
      const jumping = jumps && jt < JUMP;
      for (let i = 0; i < show && ns < MAXN.shades; i += step) {
        if (i === 0 && jumping) continue;
        const f = s.fish[i];
        const a = f.ph + t * f.w;
        const x = sx + Math.cos(a) * f.r, z = sz + Math.sin(a) * f.r * 0.7;
        // Schwimmrichtung = Bahnrichtung, dazu das Hin und Her des Schwanzschlags
        const head = Math.atan2(-Math.sin(a) * f.w, Math.cos(a) * 0.7 * f.w) + Math.sin(t * 7 + i * 1.7) * 0.13;
        // tiefere Fische etwas größer und unschärfer
        const k = 1.15 + f.d * 0.3;
        if (ns >= this.shades.instanceMatrix.count) ensureCapacity(this.shades, ns + 1, MAXN.shades);
        m.compose(v.set(x, WY, z), q.setFromAxisAngle(up, head), sc.set(k * (1 + f.d * 0.25), 1, k));
        this.shades.setMatrixAt(ns++, m);
      }
      if (jumps) {
        const f = s.fish[0];
        const t0 = t - jt; // Absprung
        if (jumping && jumpFish && nf < MAXN.fish) {
          const { x, z } = fishAt(s, f, t);
          const a = f.ph + t * f.w;
          const head = Math.atan2(-Math.sin(a) * f.w, Math.cos(a) * 0.7 * f.w);
          const ph = jt / JUMP;
          // Bogen aus dem Wasser: Kopf erst nach oben, dann nach unten, dabei zappeln
          const y = Math.sin(ph * Math.PI) * 0.32;
          if (nf >= this.fish.instanceMatrix.count) ensureCapacity(this.fish, nf + 1, MAXN.fish);
          m.compose(v.set(x, y, z), q.setFromEuler(e.set(-Math.cos(ph * Math.PI) * 0.9, head, Math.sin(t * 9) * 0.2, 'YXZ')), sc.set(1.6, 1.6, 1.6));
          this.fish.setMatrixAt(nf++, m);
        }
        // Spritzer und Ring beim Herausspringen und (stärker) beim Eintauchen
        this.jumpSplash(s, t0, jt, 0.6, drops, 0);
        this.jumpSplash(s, t0 + JUMP, jt - JUMP, 1, drops, 0.5);
      }
      // Fische kommen an die Oberfläche: je Schwarm zwei Takte, mehr Bestand = öfter (von Weitem keine Ringe mehr)
      for (let j = 0; j < 2 && this.ringFade > 0.01; j++) {
        const P = 2.4 + hash(s.k * 0.731 + j) * 2.6;
        const qq = (t + s.jump * 3.1 + j * 1.37) / P;
        const n = Math.floor(qq), u = (qq - n) * P;
        if (u > RING_T || hash(n * 7.13 + s.k * 0.37 + j * 0.11) > fill * 1.15) continue;
        const a = hash(n * 3.7 + s.k + j) * Math.PI * 2, r = 0.85 * Math.sqrt(hash(n * 5.3 + s.k * 1.3 + j));
        const tt = t - u;
        this.ring(shoalX(s, tt) + Math.cos(a) * r, shoalZ(s, tt) + Math.sin(a) * r * 0.7, u, 0.3, 0.2);
      }
      // über manchen vollen Fanggründen kreisen Möwen (nicht über jedem, sonst wirkt es wie ein Zeichen)
      if (birds && fill >= 0.6 && hash(s.k * 0.173) < 0.45) {
        const cnt = 1 + (hash(s.k * 0.291) < 0.3 ? 1 : 0);
        for (let j = 0; j < cnt && ng < MAXN.gulls; j++) {
          const dir = (s.k + j) % 2 ? 1 : -1;
          const rr = 1.1 + j * 0.35, w = (0.5 + j * 0.08) * dir;
          const th = t * w + s.jump + j * 2.4;
          const x = sx + Math.cos(th) * rr, z = sz + Math.sin(th) * rr * 0.85;
          const y = 1.2 + j * 0.25 + Math.sin(t * 0.4 + j + s.jump) * 0.12;
          const head = Math.atan2(-Math.sin(th) * w, Math.cos(th) * 0.85 * w);
          // Flügelschlag in Abständen, dazwischen gleiten (Flügel leicht angehoben)
          const cyc = (t + s.jump * 2 + j * 1.9) % 5.5;
          const flap = cyc < 1.3 ? Math.sin(cyc * 13) * 0.55 + 0.1 : 0.14 + Math.sin(t * 2.2 + j) * 0.04;
          if (ng >= this.gulls.instanceMatrix.count) {
            ensureCapacity(this.gulls, ng + 1, MAXN.gulls); ensureCapacity(this.wingsR, ng + 1, MAXN.gulls); ensureCapacity(this.wingsL, ng + 1, MAXN.gulls);
          }
          // in die Kurve gelegt (zur Kreismitte geneigt); von Weitem etwas größer, damit man sie noch sieht
          const gs = 0.65 + farK * 0.35;
          TMP.base.compose(v.set(x, y, z), q.setFromEuler(e.set(0, head, 0.32 * dir, 'YXZ')), sc.set(gs, gs, gs));
          this.gulls.setMatrixAt(ng, TMP.base);
          this.wing(this.wingsR, ng, 1, flap);
          this.wing(this.wingsL, ng, -1, flap);
          ng++;
        }
      }
    }
    flushInstances(this.fish, nf);
    flushInstances(this.shades, ns);
    flushInstances(this.patches, np);
    flushInstances(this.rings, this.nr);
    flushInstances(this.drops, this.nd);
    flushInstances(this.gulls, ng); flushInstances(this.wingsR, ng); flushInstances(this.wingsL, ng);
  }

  /** Flügel am Gelenk neben dem Rumpf (TMP.base), um flap angehoben */
  private wing(mesh: THREE.InstancedMesh, i: number, side: 1 | -1, flap: number) {
    TMP.loc.makeTranslation(side * 0.018, 0.012, 0.005).multiply(TMP.rot.makeRotationZ(side * flap));
    TMP.m.multiplyMatrices(TMP.base, TMP.loc);
    mesh.setMatrixAt(i, TMP.m);
  }

  /** Ring und Spritzer eines springenden Fisches: at = Zeitpunkt des Auf-/Eintauchens, u = Sekunden seitdem */
  private jumpSplash(s: Shoal, at: number, u: number, k: number, drops: boolean, seed: number) {
    if (u < 0 || u > RING_T) return;
    const { x, z } = fishAt(s, s.fish[0], at);
    this.ring(x, z, u, 0.42 * k + 0.12, 0.32 * k);
    if (drops && u < DROP_T) this.splash(x, z, u, k, s.k + seed);
  }

  /** weich auslaufender Ring an (x, z), u Sekunden nach dem Entstehen; size = größter Halbmesser, k = Helligkeit */
  private ring(x: number, z: number, u: number, size: number, k: number) {
    if (this.nr >= MAXN.rings || this.ringFade <= 0.01) return;
    const rest = 1 - u / RING_T;
    const r = size * (0.12 + 0.88 * (1 - rest * rest));
    const b = k * rest * rest * Math.min(1, u * 8) * this.ringFade;
    if (this.nr >= this.rings.instanceMatrix.count) ensureCapacity(this.rings, this.nr + 1, MAXN.rings);
    TMP.m.compose(TMP.v.set(x, WY + 0.002, z), TMP.q.identity(), TMP.s.set(r, 1, r));
    this.rings.setMatrixAt(this.nr, TMP.m);
    this.rings.setColorAt(this.nr++, TMP.c.setRGB(b * 0.9, b * 0.94, b));
  }

  /** Wassertropfen, die beim Springen hochfliegen und zurückfallen */
  private splash(x: number, z: number, u: number, k: number, seed: number) {
    const n = k >= 1 ? 7 : 4;
    const fade = 1 - u / DROP_T;
    for (let i = 0; i < n && this.nd < MAXN.drops; i++) {
      const a = hash(seed * 1.7 + i) * Math.PI * 2, sp = (0.25 + hash(seed + i * 3.1) * 0.35) * k, vy = (0.9 + hash(seed * 0.3 + i) * 0.6) * (0.7 + 0.3 * k);
      const y = WY + vy * u - 4.2 * u * u;
      if (y < WY - 0.02) continue;
      if (this.nd >= this.drops.instanceMatrix.count) ensureCapacity(this.drops, this.nd + 1, MAXN.drops);
      const s = 0.7 + hash(seed * 2.1 + i) * 0.7;
      TMP.m.compose(TMP.v.set(x + Math.cos(a) * sp * u, y, z + Math.sin(a) * sp * u), TMP.q.identity(), TMP.s.set(s, s * 1.4, s));
      this.drops.setMatrixAt(this.nd, TMP.m);
      const b = 0.75 * fade;
      this.drops.setColorAt(this.nd++, TMP.c.setRGB(b * 0.9, b * 0.95, b));
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
