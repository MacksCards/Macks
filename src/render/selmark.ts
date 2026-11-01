// Auswahl-Zeichen: ein goldener, nach unten zeigender Pfeil (geschliffene Spitze wie ein Edelstein)
// schwebt über dem angewählten Schiff, Gebäude oder Soldaten, wippt sanft auf und ab und dreht sich
// langsam, damit das Gold glänzt. Ein dunkler Rand macht ihn vor hellem Himmel, Sand und Wasser
// gleich gut sichtbar.
// Er hat am Bildschirm immer etwa dieselbe Größe (egal wie weit herausgezoomt) und liegt über allem –
// auch Bäume oder Dächer davor verdecken ihn nicht.
// Alle Pfeile zusammen kosten zwei Zeichenaufrufe (gold + Rand), und nur, solange etwas angewählt ist.
import * as THREE from 'three';
import { flushInstances } from './instances';

/** Größe des Pfeils am Bildschirm in Bildpunkten (Höhe), für Schiffe/Gebäude bzw. für einzelne Soldaten */
const PX_BIG = 30, PX_SMALL = 22;
const MAX = 64;

/** Pfeil: Spitze unten bei y = 0, Höhe 1, oben ein flacher, geschliffener Deckel (nach außen gewölbt = überall „von vorne“ sichtbar) */
function arrowGeometry(): THREE.BufferGeometry {
  const n = 4, r = 0.4, hb = 0.84, top = 1;
  const pts: number[] = [];
  const ring = (y: number, rad: number, rot: number) => {
    const a: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) { const t = rot + (i / n) * Math.PI * 2; a.push(new THREE.Vector3(Math.cos(t) * rad, y, Math.sin(t) * rad)); }
    return a;
  };
  const tip = new THREE.Vector3(0, 0, 0), cap = new THREE.Vector3(0, top, 0);
  const mid = ring(hb, r, 0);
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < n; i++) {
    const a = mid[i], b = mid[(i + 1) % n];
    tri(tip, a, b); // lange Spitze nach unten
    tri(cap, b, a); // flacher Deckel oben
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.computeVertexNormals(); // getrennte Dreiecke: scharfe Facetten
  return g;
}

export class SelectionMarks {
  group = new THREE.Group();
  private gold: THREE.InstancedMesh;
  private rim: THREE.InstancedMesh;
  private pts: { x: number; y: number; z: number; px: number; gap: number }[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private axis = new THREE.Vector3(0, 1, 0);
  private up = new THREE.Vector3();
  private spin = new THREE.Quaternion();

  constructor() {
    const geo = arrowGeometry();
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffb627, emissive: 0x5c3500, emissiveIntensity: 1, metalness: 0.45, roughness: 0.3,
      flatShading: true, depthTest: false, depthWrite: false, transparent: true,
    });
    // Rand: dieselbe Form etwas größer, nur die Rückseiten, dunkel – liegt hinter dem Gold als Umriss
    const rimMat = new THREE.MeshBasicMaterial({ color: 0x2a1a06, side: THREE.BackSide, depthTest: false, depthWrite: false, transparent: true, opacity: 0.85 });
    const mk = (mat: THREE.Material, order: number) => {
      const im = new THREE.InstancedMesh(geo, mat, MAX);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      im.renderOrder = order;
      im.count = 0;
      im.visible = false;
      this.group.add(im);
      return im;
    };
    this.rim = mk(rimMat, 11);
    this.gold = mk(goldMat, 12);
  }

  /** Zeichen sammeln: begin(), add() je angewähltem Ding (x/z = Mitte, y = Oberkante), end() */
  begin() { this.pts.length = 0; }
  /** small = kleiner Pfeil (Soldaten); gap = zusätzlicher Abstand in Bildpunkten (z. B. über einem Warnsymbol) */
  add(x: number, y: number, z: number, small = false, gap = 0) {
    if (this.pts.length < MAX) this.pts.push({ x, y, z, px: small ? PX_SMALL : PX_BIG, gap });
  }

  /** Lage setzen; t = Uhrzeit in s, viewH = Höhe der Zeichenfläche in Bildpunkten (CSS) */
  end(t: number, camera: THREE.PerspectiveCamera, viewH: number) {
    const n = this.pts.length;
    if (!n) { flushInstances(this.gold, 0); flushInstances(this.rim, 0); return; }
    const k = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / Math.max(1, viewH);
    const bob = 0.5 + 0.5 * Math.sin(t * 3.2);
    // zur Kamera gedreht: die Spitze zeigt am Bildschirm immer nach unten, auch beim Blick von oben;
    // dabei dreht sich der Pfeil langsam um seine Längsachse, damit die Facetten glänzen
    this.q.copy(camera.quaternion).multiply(this.spin.setFromAxisAngle(this.axis, t * 1.1));
    this.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    for (let i = 0; i < n; i++) {
      const p = this.pts[i];
      // Weltgröße so, dass der Pfeil am Bildschirm px Bildpunkte hoch ist
      const d = Math.max(0.5, camera.position.distanceTo(this.v.set(p.x, p.y, p.z)));
      const size = p.px * d * k;
      // Spitze schwebt knapp über dem Ding (am Bildschirm darüber) und wippt sanft auf und ab
      const lift = size * (0.08 + 0.22 * bob) + p.gap * d * k;
      this.m.compose(this.v.set(p.x, p.y, p.z).addScaledVector(this.up, lift), this.q, this.s.setScalar(size));
      this.gold.setMatrixAt(i, this.m);
      // Rand: etwas größer, Spitze etwas tiefer, damit der Umriss rundum gleich breit ist
      this.m.compose(this.v.set(p.x, p.y, p.z).addScaledVector(this.up, lift - size * 0.09), this.q, this.s.setScalar(size * 1.16));
      this.rim.setMatrixAt(i, this.m);
    }
    flushInstances(this.gold, n);
    flushInstances(this.rim, n);
  }

  /** Vorlagen zum Vorbereiten der Grafik-Programme */
  warm(): THREE.Object3D[] {
    return [this.rim, this.gold].map((src) => {
      const im = new THREE.InstancedMesh(src.geometry, src.material, 1);
      im.frustumCulled = false;
      return im;
    });
  }

  dispose() {
    for (const im of [this.gold, this.rim]) { im.dispose(); (im.material as THREE.Material).dispose(); }
    this.gold.geometry.dispose();
  }
}
