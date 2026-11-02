// Ziehpunkte auf dem geplanten Weg: runde Griffe, die man mit dem Finger verschiebt, um den Weg zu biegen
// (wie beim Verschieben einer Route in einer Karten-App).
// - kleiner weißer Kreis in der Mitte jedes Wegstücks: ziehen = neuen Knickpunkt anlegen
// - goldener Kreis mit vier Pfeilen: ein Knickpunkt (ziehen = verschieben, antippen = entfernen)
// - Kreis am Ziel: ziehen = Ziel verschieben
// Die Griffe haben am Bildschirm immer dieselbe Größe und liegen über allem (auch über Bäumen).
import * as THREE from 'three';

export type HandleKind = 'mid' | 'via' | 'end';
export interface Handle { kind: HandleKind; x: number; y: number; z: number }

/** Größe am Bildschirm (Bildpunkte, Durchmesser) */
const PX: Record<HandleKind, number> = { mid: 30, via: 38, end: 34 };
/** so nah muss der Finger an einem Griff landen (Bildpunkte) */
const HIT_PX = 30;
const MAX = 24;

/** Bild eines Griffs zeichnen (Kreis mit Schatten, Rand und Pfeilen) */
function drawHandle(kind: HandleKind): THREE.CanvasTexture {
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  const r = S * 0.4;
  x.translate(S / 2, S / 2);
  // weicher Schatten
  x.fillStyle = 'rgba(0,0,0,0.35)';
  x.beginPath(); x.arc(0, 3, r + 4, 0, Math.PI * 2); x.fill();
  // Füllung mit leichtem Verlauf (wirkt wie ein gewölbter Knopf)
  const g = x.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  if (kind === 'via') { g.addColorStop(0, '#fff2b8'); g.addColorStop(1, '#e8a417'); }
  else if (kind === 'end') { g.addColorStop(0, '#fffbe0'); g.addColorStop(1, '#f2d64b'); }
  else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d9e4d0'); }
  x.fillStyle = g;
  x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill();
  // dunkler Rand: auf Gras, Sand und Wasser gleich gut zu sehen
  x.lineWidth = S * 0.06;
  x.strokeStyle = '#3b2610';
  x.stroke();
  // vier kleine Pfeile = „verschieben“
  x.fillStyle = '#3b2610';
  const a = r * 0.62, w = r * 0.24, l = r * 0.26;
  for (let i = 0; i < 4; i++) {
    x.save();
    x.rotate((i * Math.PI) / 2);
    x.beginPath();
    x.moveTo(0, -a - l * 0.35);
    x.lineTo(w, -a + l * 0.65);
    x.lineTo(-w, -a + l * 0.65);
    x.closePath();
    x.fill();
    x.restore();
  }
  // Mitte: Punkt
  x.beginPath(); x.arc(0, 0, r * 0.14, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class RoadHandles {
  group = new THREE.Group();
  private sprites: THREE.Sprite[] = [];
  private mats = {} as Record<HandleKind, THREE.SpriteMaterial>;
  private list: Handle[] = [];
  /** Griff, der gerade gezogen wird (wird größer gezeichnet) */
  private active = -1;
  private v = new THREE.Vector3();

  constructor() {
    for (const k of ['mid', 'via', 'end'] as HandleKind[]) {
      this.mats[k] = new THREE.SpriteMaterial({
        map: drawHandle(k), sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true,
        opacity: k === 'mid' ? 0.9 : 1,
      });
    }
  }

  /** Griffe setzen (leer = keine); active = Nummer des gezogenen Griffs */
  set(list: Handle[], active = -1) {
    this.list = list.slice(0, MAX);
    this.active = active;
    while (this.sprites.length < this.list.length) {
      const s = new THREE.Sprite(this.mats.mid);
      s.renderOrder = 13;
      s.frustumCulled = false;
      this.group.add(s);
      this.sprites.push(s);
    }
    this.sprites.forEach((s, i) => {
      const h = this.list[i];
      s.visible = !!h;
      if (!h) return;
      s.material = this.mats[h.kind];
      s.position.set(h.x, h.y, h.z);
    });
  }

  get count() { return this.list.length; }
  handle(i: number): Handle | undefined { return this.list[i]; }

  /** Größe am Bildschirm einstellen (vor jedem Bild) */
  update(camera: THREE.PerspectiveCamera, viewH: number) {
    if (!this.list.length) return;
    // ohne Größenabnahme mit der Entfernung: Größe s ergibt s · p11 · H/2 Bildpunkte
    const p11 = camera.projectionMatrix.elements[5] || 1;
    this.list.forEach((h, i) => {
      const px = PX[h.kind] * (i === this.active ? 1.3 : 1);
      this.sprites[i].scale.setScalar(px / (p11 * Math.max(1, viewH) / 2));
    });
  }

  /** Griff unter dem Finger (nächster in Fingerbreite) oder -1; Knickpunkte und Ziel vor den Mittel-Griffen */
  at(clientX: number, clientY: number, camera: THREE.PerspectiveCamera, rect: DOMRect): number {
    let best = -1, bestD = Infinity;
    camera.updateMatrixWorld();
    this.list.forEach((h, i) => {
      this.v.set(h.x, h.y, h.z).project(camera);
      if (this.v.z > 1) return;
      const sx = rect.left + ((this.v.x + 1) / 2) * rect.width, sy = rect.top + ((1 - this.v.y) / 2) * rect.height;
      // Mittel-Griffe zählen etwas weiter weg, damit ein Knickpunkt daneben gewinnt
      const d = Math.hypot(sx - clientX, sy - clientY) + (h.kind === 'mid' ? 6 : 0);
      if (d < HIT_PX + (h.kind === 'mid' ? 6 : 0) && d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  dispose() {
    for (const m of Object.values(this.mats)) { m.map?.dispose(); m.dispose(); }
  }
}
