// Fahnen, Wimpel und Fahnenmasten in Besitzerfarbe für alle Gebäude.
// Alle gleichen Teile werden zusammen gezeichnet („Instanzen“: eine Vorlage, viele Kopien in einem
// Zeichenaufruf) – vorher kosteten Mast und Fahne auf jedem Gebäude zwei eigene Zeichenaufrufe
// (mit Schatten vier). Die Besitzerfarbe steht je Kopie; ein gemeinsames Material für alle Farben.
import * as THREE from 'three';
import { Builder, M } from './kit';
import { buildingMaterial } from './materials';
import { ensureCapacity, flushInstances } from './instances';

/** Fahnentuch: hängt am Mast (Kante bei z = 0, Oberkante bei y = 0) und weht nach +z. Weiß, die Farbe kommt je Kopie. */
const FLAG_GEO = new Builder().box(0.008, 0.12, 0.2, 0xffffff, 0, -0.12, 0.1).geometry();
/** kleiner dreieckiger Wimpel (für Meshy-Gebäude ohne große Fahne) */
const PENNANT_GEO = (() => {
  const tri = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.04, 0.13), new THREE.Vector3(0, -0.08, 0)]);
  tri.setIndex([0, 1, 2, 2, 1, 0]);
  return new Builder().add(tri, 0xffffff).geometry();
})();
/** Fahnenmast für Meshy-Gebäude: hoch (Fahne) und kurz (Wimpel); Fuß bei y = 0 */
export const POLE_H = 0.42, POLE_H_SMALL = 0.2;
const POLE_GEO = new Builder().cyl(0.011, 0.015, POLE_H, 6, M.dunkelholz, 0, 0, 0).sphere(0.02, M.gold, 0, POLE_H + 0.01, 0).geometry();
const POLE_GEO_SMALL = new Builder().cyl(0.007, 0.009, POLE_H_SMALL, 5, M.dunkelholz, 0, 0, 0).geometry();

const MAX = 4096;

/** Tuch: 0 = Fahne, 1 = Wimpel */
export const Cloth = { Flag: 0, Pennant: 1 } as const;
export type Cloth = (typeof Cloth)[keyof typeof Cloth];
/** Mast: -1 = keiner, 0 = hoch, 1 = kurz */
export const Pole = { None: -1, Big: 0, Small: 1 } as const;
export type Pole = (typeof Pole)[keyof typeof Pole];

/** Eine Fahne/ein Wimpel an einem Gebäude (Lage in Weltkoordinaten) */
export interface MarkDef {
  cloth: Cloth;
  /** Aufhängepunkt (Oberkante am Mast) */
  x: number; y: number; z: number;
  scale: number;
  /** eigener Mast (Fuß bei px/py/pz) oder keiner (Code-Modelle und Meshy-Modelle mit eigenem Mast) */
  pole: Pole; px: number; py: number; pz: number;
}

interface Mark extends MarkDef { phase: number }
interface Entry { host: THREE.Object3D; color: THREE.Color; marks: Mark[] }

export class OwnerMarks {
  group = new THREE.Group();
  private entries = new Map<number, Entry>();
  private cloth: THREE.InstancedMesh[];
  private poles: THREE.InstancedMesh[];
  private clothMat = buildingMaterial({ side: THREE.DoubleSide });
  /** Masten nur neu schreiben, wenn sich etwas geändert hat (sie bewegen sich nicht) */
  private polesDirty = true;
  private lastVisible = -1;
  private m = new THREE.Matrix4();
  private v = new THREE.Vector3();

  constructor(poleMat: THREE.Material) {
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, color: boolean, shadow: boolean) => {
      const im = new THREE.InstancedMesh(geo, mat, 64);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (color) { im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(64 * 3).fill(1), 3); im.instanceColor.setUsage(THREE.DynamicDrawUsage); }
      // Kopien liegen über die ganze Karte verteilt: nicht als Ganzes wegschneiden
      im.frustumCulled = false;
      im.castShadow = shadow;
      im.count = 0;
      im.visible = false;
      this.group.add(im);
      return im;
    };
    // wie bisher: Tücher werfen keinen Schatten, Masten schon
    this.cloth = [mk(FLAG_GEO, this.clothMat, true, false), mk(PENNANT_GEO, this.clothMat, true, false)];
    this.poles = [mk(POLE_GEO, poleMat, false, true), mk(POLE_GEO_SMALL, poleMat, false, true)];
  }

  /** Fahnen eines Gebäudes setzen (ersetzt vorhandene). host = Gebäude-Objekt (seine Sichtbarkeit gilt mit). */
  set(id: number, host: THREE.Object3D, color: number, defs: MarkDef[]) {
    if (!defs.length) { this.remove(id); return; }
    this.entries.set(id, { host, color: new THREE.Color(color), marks: defs.map((d, i) => ({ ...d, phase: i * 1.7 + host.position.x })) });
    this.polesDirty = true;
  }

  remove(id: number) {
    if (this.entries.delete(id)) this.polesDirty = true;
  }

  /** neuer Besitzer (erobert): nur die Farbe wechseln */
  recolor(id: number, color: number) {
    this.entries.get(id)?.color.setHex(color);
  }

  /** Sichtbarkeit von Gebäuden hat sich geändert (Nebel aufgedeckt) */
  touch() { this.polesDirty = true; }

  clear() {
    this.entries.clear();
    this.polesDirty = true;
  }

  /** je gezeichnetem Bild: Tücher wehen lassen (alle in derselben Windrichtung) */
  update(t: number) {
    const n = [0, 0], m = this.m, s = this.v;
    let visible = 0;
    for (const e of this.entries.values()) {
      if (!e.host.visible) continue;
      visible++;
      for (const k of e.marks) {
        const im = this.cloth[k.cloth];
        const i = n[k.cloth]++;
        if (i >= im.instanceMatrix.count && ensureCapacity(im, i + 1, MAX) <= i) { n[k.cloth]--; continue; }
        m.makeRotationY(Math.PI / 2 + Math.sin(t * 4.3 + k.phase) * 0.22);
        if (k.scale !== 1) m.scale(s.setScalar(k.scale));
        m.setPosition(k.x, k.y, k.z);
        im.setMatrixAt(i, m);
        im.setColorAt(i, e.color);
      }
    }
    flushInstances(this.cloth[0], n[0]);
    flushInstances(this.cloth[1], n[1]);
    if (!this.polesDirty && visible === this.lastVisible) return;
    this.polesDirty = false;
    this.lastVisible = visible;
    const p = [0, 0];
    m.identity();
    for (const e of this.entries.values()) {
      if (!e.host.visible) continue;
      for (const k of e.marks) {
        if (k.pole === Pole.None) continue;
        const im = this.poles[k.pole];
        const i = p[k.pole]++;
        if (i >= im.instanceMatrix.count && ensureCapacity(im, i + 1, MAX) <= i) { p[k.pole]--; continue; }
        m.setPosition(k.px, k.py, k.pz);
        im.setMatrixAt(i, m);
      }
    }
    flushInstances(this.poles[0], p[0]);
    flushInstances(this.poles[1], p[1]);
  }

  /** Vorlagen zum Vorbereiten der Grafik-Programme (je eine Kopie, wie im Spiel eingestellt) */
  warm(): THREE.Object3D[] {
    return [...this.cloth, ...this.poles].map((src) => {
      const im = new THREE.InstancedMesh(src.geometry, src.material, 1);
      if (src.instanceColor) im.setColorAt(0, new THREE.Color(0xffffff));
      im.castShadow = src.castShadow;
      im.frustumCulled = false;
      return im;
    });
  }

  dispose() {
    for (const im of [...this.cloth, ...this.poles]) im.dispose();
    this.clothMat.dispose();
  }
}
