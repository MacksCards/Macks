// Hilfe beim Platzieren eines Gebäudes: man sieht genau, wo es steht – auch mitten im Wald.
//
// - Bäume auf der Grundfläche werden nicht gezeichnet (beim Bau werden sie dort ohnehin gefällt),
//   Bäume davor (zwischen Kamera und Vorschau) werden ausgeblendet, am Rand dieses schmalen Streifens und
//   direkt an der Grundfläche nur kleiner (ruhig und scharf, kein körniges Punktmuster, kein Flimmern).
//   Dafür ändern sich nur zwei Werte im gemeinsamen Bäume-Material (placeClear) – kein Neuaufbau, flüssig.
// - Der Ring des Arbeitsbereichs (GroundRing unten) folgt dem Gelände: am Berg liegt er auf dem Hang, nicht in
//   der Luft auf Meereshöhe. Wo Bäume, Häuser oder ein Hügel davor stehen, scheint er schwächer durch – so sieht
//   man ihn auch im Wald, und in der Stadt erkennt man, dass er hinter den Häusern liegt.
// - Die Grundfläche bekommt eine farbige Fläche und einen klaren Rahmen mit dunkler Kante
//   (grün = geht, rot = geht nicht). Der Rahmen ist immer zu sehen, auch hinter Gras oder Hügeln.
// - Teile der Vorschau, die trotzdem verdeckt sind, scheinen als zarter Umriss durch.
import * as THREE from 'three';
import { placeClear } from './trees';

const OK = 0x6dff5a, BAD = 0xff4a3d;

/** quadratischer Rahmen (Seite s, Breite w), flach auf dem Boden, Mitte im Ursprung */
function frameGeo(s: number, w: number): THREE.BufferGeometry {
  const h = s / 2;
  const shape = new THREE.Shape([new THREE.Vector2(-h - w / 2, -h - w / 2), new THREE.Vector2(h + w / 2, -h - w / 2), new THREE.Vector2(h + w / 2, h + w / 2), new THREE.Vector2(-h - w / 2, h + w / 2)]);
  shape.holes.push(new THREE.Path([new THREE.Vector2(-h + w / 2, -h + w / 2), new THREE.Vector2(-h + w / 2, h - w / 2), new THREE.Vector2(h - w / 2, h - w / 2), new THREE.Vector2(h - w / 2, -h + w / 2)]));
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
}

export class PlaceHelp {
  readonly group = new THREE.Group();
  private fill: THREE.Mesh;
  private frame: THREE.Mesh;
  private edge: THREE.Mesh;
  private xray: THREE.Mesh;
  private frames = new Map<number, [THREE.BufferGeometry, THREE.BufferGeometry]>();
  private fillMat = new THREE.MeshBasicMaterial({ color: OK, transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  private frameMat = new THREE.MeshBasicMaterial({ color: OK, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false });
  private edgeMat = new THREE.MeshBasicMaterial({ color: 0x10140c, transparent: true, opacity: 0.5, depthWrite: false, depthTest: false });
  /** nur dort gezeichnet, wo etwas vor der Vorschau steht */
  private xrayMat = new THREE.MeshBasicMaterial({ color: 0xd8ffd0, transparent: true, opacity: 0.32, depthWrite: false, depthFunc: THREE.GreaterDepth });

  /** Umriss nur über dem Boden (sonst schiene das Fundament im Hang als Kasten durch) */
  private xrayMinY = { value: 0 };

  constructor() {
    this.xrayMat.onBeforeCompile = (sh) => {
      sh.uniforms.uMinY = this.xrayMinY;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vWorldY;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uMinY;\nvarying float vWorldY;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vWorldY < uMinY) discard;');
    };
    this.xrayMat.customProgramCacheKey = () => 'bau-umriss';
    this.fill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.fillMat);
    this.fill.renderOrder = 2;
    // Blick der Spielkamera für das Schattenbild der Bäume merken (ausgeblendete Bäume werfen keinen Schatten;
    // das Schattenbild entsteht vor dem eigentlichen Bild, nimmt also den Blick des vorigen Bilds – unsichtbar)
    this.fill.onBeforeRender = (_r, _s, cam) => {
      const c = cam as THREE.PerspectiveCamera;
      placeClear.uClearVP.value.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse);
      placeClear.uClearPS.value.set(c.projectionMatrix.elements[0], c.projectionMatrix.elements[5]);
    };
    this.edge = new THREE.Mesh(undefined, this.edgeMat);
    this.edge.renderOrder = 3;
    this.frame = new THREE.Mesh(undefined, this.frameMat);
    this.frame.renderOrder = 3.1;
    this.xray = new THREE.Mesh(undefined, this.xrayMat);
    this.xray.renderOrder = 3.5; // vor der eigentlichen Vorschau (4), damit nur Fremdes sie verdeckt
    for (const m of [this.fill, this.edge, this.frame, this.xray]) { m.frustumCulled = false; this.group.add(m); }
    this.group.visible = false;
  }

  /**
   * Vorschau zeigen: Gebäudeform geo, Grundfläche size × size Felder ab Feld (x, y), Bodenhöhe gy.
   */
  show(geo: THREE.BufferGeometry, x: number, y: number, size: number, gy: number, ok: boolean) {
    const cx = x + size / 2, cz = y + size / 2;
    let f = this.frames.get(size);
    if (!f) { f = [frameGeo(size, 0.1), frameGeo(size, 0.22)]; this.frames.set(size, f); }
    this.frame.geometry = f[0];
    this.edge.geometry = f[1];
    this.xray.geometry = geo;
    const col = ok ? OK : BAD;
    this.fillMat.color.setHex(col);
    this.frameMat.color.setHex(col);
    this.xrayMat.color.setHex(ok ? 0xd8ffd0 : 0xffc0b8);
    this.fill.scale.set(size, 1, size);
    this.fill.position.set(cx, gy + 0.03, cz);
    this.frame.position.set(cx, gy + 0.05, cz);
    this.edge.position.set(cx, gy + 0.04, cz);
    this.xray.position.set(cx, gy + 0.02, cz);
    this.xrayMinY.value = gy + 0.12;
    this.group.visible = true;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const ht = Math.max(0.5, geo.boundingBox!.max.y);
    const e = 0.02;
    placeClear.uClearBox.value.set(x + e, y + e, x + size - e, y + size - e);
    placeClear.uClearFocus.value.set(cx, gy + ht * 0.45, cz, size * 0.5 + 0.35);
  }

  hide() {
    this.group.visible = false;
    placeClear.uClearBox.value.set(0, 0, -1, -1);
    placeClear.uClearFocus.value.set(0, 0, 0, 0);
  }

  dispose() {
    this.hide();
    for (const [a, b] of this.frames.values()) { a.dispose(); b.dispose(); }
    this.frames.clear();
    this.fill.geometry.dispose();
    for (const m of [this.fillMat, this.frameMat, this.edgeMat, this.xrayMat]) m.dispose();
  }
}

/** Punkte rund um den Ring (genug, damit er auch an Hängen eng am Boden bleibt) */
const SEG = 192;
/** Ringe der Ergiebigkeits-Scheibe (von innen nach außen) */
const DISC_RINGS = 10, DISC_SEG = 96;
/** so weit über dem Boden (gegen Flimmern mit dem Boden und kurzen Halmen) */
const LIFT = 0.09;

/**
 * Ring des Arbeitsbereichs (beim Bauen und beim angewählten Betrieb) und die zarte Scheibe der Ergiebigkeit.
 * Jeder Punkt liegt auf der Geländehöhe an seiner Stelle (über Wasser auf dem Wasser). Gezeichnet in zwei
 * Durchgängen mit derselben Form: sichtbar kräftig, verdeckt (hinter Bäumen, Häusern, Hügeln) schwächer.
 * Die Form wird nur neu berechnet, wenn sich Mitte oder Größe ändern.
 */
export class GroundRing {
  readonly group = new THREE.Group();
  private ringGeo = new THREE.BufferGeometry();
  private discGeo = new THREE.BufferGeometry();
  private ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  /** nur dort, wo etwas davor steht */
  private hidMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide, depthFunc: THREE.GreaterDepth });
  private discMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  private ring: THREE.Mesh;
  private hid: THREE.Mesh;
  private disc: THREE.Mesh;
  private ringKey = '';
  private discKey = '';

  constructor() {
    this.ringGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3));
    const idx: number[] = [];
    for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    this.ringGeo.setIndex(idx);
    const dn = 1 + DISC_RINGS * DISC_SEG;
    this.discGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dn * 3), 3));
    const di: number[] = [];
    for (let i = 0; i < DISC_SEG; i++) di.push(0, 1 + ((i + 1) % DISC_SEG), 1 + i);
    for (let k = 1; k < DISC_RINGS; k++) for (let i = 0; i < DISC_SEG; i++) {
      const a = 1 + (k - 1) * DISC_SEG + i, b = 1 + (k - 1) * DISC_SEG + ((i + 1) % DISC_SEG);
      const c = a + DISC_SEG, d = b + DISC_SEG;
      di.push(a, b, c, c, b, d);
    }
    this.discGeo.setIndex(di);
    this.ring = new THREE.Mesh(this.ringGeo, this.ringMat);
    this.hid = new THREE.Mesh(this.ringGeo, this.hidMat);
    this.disc = new THREE.Mesh(this.discGeo, this.discMat);
    this.disc.renderOrder = 2;
    this.hid.renderOrder = 3;
    this.ring.renderOrder = 3.05;
    for (const m of [this.ring, this.hid, this.disc]) { m.frustumCulled = false; m.visible = false; this.group.add(m); }
  }

  /** Ring zeigen (r = Halbmesser in Feldern, Mitte x/z) oder mit r = 0 ausblenden */
  show(r: number, x: number, z: number, color: number, heightAt: (x: number, z: number) => number) {
    const on = r > 0;
    this.ring.visible = this.hid.visible = on;
    if (!on) return;
    this.ringMat.color.setHex(color);
    this.hidMat.color.setHex(color);
    const key = `${r}|${x}|${z}`;
    if (key === this.ringKey) return;
    this.ringKey = key;
    // Breite wie bisher mit dem Ring wachsend, aber nie dünner als ein Zehntel Feld
    const w = Math.max(0.1, r * 0.03);
    const pos = this.ringGeo.getAttribute('position') as THREE.BufferAttribute;
    const P = pos.array as Float32Array;
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      for (let j = 0; j < 2; j++) {
        const rr = j ? r : r - w, px = x + c * rr, pz = z + s * rr;
        const o = (i * 2 + j) * 3;
        P[o] = px; P[o + 1] = Math.max(0, heightAt(px, pz)) + LIFT; P[o + 2] = pz;
      }
    }
    pos.needsUpdate = true;
  }

  /** zarte Scheibe der Ergiebigkeit (r = 0: aus) */
  showDisc(r: number, x: number, z: number, color: number, heightAt: (x: number, z: number) => number) {
    this.disc.visible = r > 0;
    if (r <= 0) return;
    this.discMat.color.setHex(color);
    const key = `${r}|${x}|${z}`;
    if (key === this.discKey) return;
    this.discKey = key;
    const pos = this.discGeo.getAttribute('position') as THREE.BufferAttribute;
    const P = pos.array as Float32Array;
    P[0] = x; P[1] = Math.max(0, heightAt(x, z)) + LIFT - 0.01; P[2] = z;
    for (let k = 0; k < DISC_RINGS; k++) {
      const rr = (r * (k + 1)) / DISC_RINGS;
      for (let i = 0; i < DISC_SEG; i++) {
        const a = (i / DISC_SEG) * Math.PI * 2, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
        const o = (1 + k * DISC_SEG + i) * 3;
        P[o] = px; P[o + 1] = Math.max(0, heightAt(px, pz)) + LIFT - 0.01; P[o + 2] = pz;
      }
    }
    pos.needsUpdate = true;
  }

  /** neues Spiel: Gelände ist ein anderes */
  reset() { this.ringKey = this.discKey = ''; this.show(0, 0, 0, 0, () => 0); this.showDisc(0, 0, 0, 0, () => 0); }

  /** Materialien fürs Vorbereiten der Grafik-Programme */
  materials(): THREE.Material[] { return [this.ringMat, this.hidMat, this.discMat]; }
}
