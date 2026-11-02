// Ziehpunkte auf dem geplanten Weg: runde Griffe, die man mit dem Finger verschiebt, um den Weg zu biegen
// (wie beim Verschieben einer Route in einer Karten-App).
// - kleiner weißer Kreis in der Mitte jedes Wegstücks: ziehen = neuen Knickpunkt anlegen
// - goldener Kreis mit vier Pfeilen: ein Knickpunkt (ziehen = verschieben, antippen = entfernen)
// - Kreis mit Fähnchen am Ziel: ziehen = Ziel verschieben
// - Start: grüner Kreis mit weißem Punkt (nur Zeichen, nicht ziehbar)
// Weit herausgezoomt fallen weiße Kreise weg, die sonst auf anderen Zeichen liegen würden.
// Ein Tipp auf einen Griff ist ein normaler Tipp (siehe build.ts); erst wer den Finger bewegt, zieht.
// Die Griffe haben am Bildschirm immer dieselbe Größe und liegen über allem (auch über Bäumen).
import * as THREE from 'three';

export type HandleKind = 'start' | 'mid' | 'via' | 'end';
export interface Handle { kind: HandleKind; x: number; y: number; z: number }

/** Größe am Bildschirm (Bildpunkte, Durchmesser) */
const PX: Record<HandleKind, number> = { start: 28, mid: 30, via: 36, end: 36 };
/** so nah muss der Finger an einem Griff landen: sichtbarer Kreis plus dieser Rand (Bildpunkte) */
const HIT_EXTRA = 8;
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
  else if (kind === 'start') { g.addColorStop(0, '#9be37f'); g.addColorStop(1, '#3f9a2c'); }
  else if (kind === 'end') { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cfe0f2'); }
  else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d9e4d0'); }
  x.fillStyle = g;
  x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill();
  // dunkler Rand: auf Gras, Sand und Wasser gleich gut zu sehen
  x.lineWidth = S * 0.06;
  x.strokeStyle = '#3b2610';
  x.stroke();
  x.fillStyle = '#3b2610';
  if (kind === 'start') {
    // Start: weißer Punkt auf Grün
    x.fillStyle = '#ffffff';
    x.beginPath(); x.arc(0, 0, r * 0.36, 0, Math.PI * 2); x.fill();
    return texOf(c);
  }
  if (kind === 'end') {
    // Ziel: Fähnchen (Stange + rote Fahne)
    x.fillRect(-r * 0.32, -r * 0.62, r * 0.12, r * 1.24);
    x.fillStyle = '#d23a2a';
    x.beginPath();
    x.moveTo(-r * 0.2, -r * 0.62); x.lineTo(r * 0.5, -r * 0.4); x.lineTo(-r * 0.2, -r * 0.12);
    x.closePath(); x.fill();
    x.lineWidth = S * 0.025; x.strokeStyle = '#3b2610'; x.stroke();
    x.fillStyle = '#3b2610';
    x.beginPath(); x.ellipse(-r * 0.26, r * 0.62, r * 0.3, r * 0.1, 0, 0, Math.PI * 2); x.fill();
    return texOf(c);
  }
  // vier kleine Pfeile = „verschieben“
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
  return texOf(c);
}

function texOf(c: HTMLCanvasElement): THREE.CanvasTexture {
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
  /** wie viele weiße Kreise gerade zu sehen sind; crowded = Zeichen liegen aufeinander (weit herausgezoomt) */
  shownMids = 0;
  crowded = false;
  /** Griffe, die gerade ausgeblendet sind (weißer Kreis zu nah an einem anderen Zeichen) */
  private hidden: boolean[] = [];
  /** Bildschirmlage der Griffe im letzten Bild (Bildpunkte, Mitte = 0) */
  private scr: [number, number][] = [];

  constructor() {
    for (const k of ['start', 'mid', 'via', 'end'] as HandleKind[]) {
      this.mats[k] = new THREE.SpriteMaterial({
        map: drawHandle(k), sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true,
        opacity: k === 'mid' ? 0.9 : 1,
      });
      // gleich je einen (unsichtbaren) Griff anlegen: dann bereitet das Spiel beim Laden das Zeichenprogramm
      // mit vor (scene.ts, prewarm) – sonst ruckelt es beim ersten Weg kurz
      const sp = new THREE.Sprite(this.mats[k]);
      sp.renderOrder = 13;
      sp.frustumCulled = false;
      sp.visible = false;
      this.group.add(sp);
      this.sprites.push(sp);
    }
  }

  /** Griffe setzen (leer = keine); active = Nummer des gezogenen Griffs */
  set(list: Handle[], active = -1) {
    this.list = list.slice(0, MAX);
    this.active = active;
    this.hidden = [];
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
  /** Bilder der Griffe (zum Vorab-Hochladen beim Laden) */
  textures(): THREE.Texture[] { return Object.values(this.mats).map((m) => m.map!).filter(Boolean); }
  handle(i: number): Handle | undefined { return this.list[i]; }

  /** Größe am Bildschirm einstellen (vor jedem Bild) */
  update(camera: THREE.PerspectiveCamera, viewH: number) {
    if (!this.list.length) return;
    // ohne Größenabnahme mit der Entfernung: Größe s ergibt s · p11 · H/2 Bildpunkte
    const p11 = camera.projectionMatrix.elements[5] || 1;
    const H = Math.max(1, viewH), W = H * camera.aspect;
    camera.updateMatrixWorld();
    this.scr = this.list.map((h) => {
      this.v.set(h.x, h.y, h.z).project(camera);
      return [this.v.x * W / 2, this.v.y * H / 2];
    });
    // weiße Kreise nur, wo sie frei liegen: weit herausgezoomt würden sie sich sonst stapeln und den Weg verdecken
    this.hidden = this.list.map(() => false);
    this.list.forEach((h, i) => {
      if (h.kind !== 'mid' || i === this.active) return;
      const [x, y] = this.scr[i];
      const near = this.list.some((o, j) => j !== i && !this.hidden[j] && Math.hypot(this.scr[j][0] - x, this.scr[j][1] - y) < (PX.mid + PX[o.kind]) * 0.75);
      if (near) this.hidden[i] = true;
    });
    this.shownMids = this.list.filter((h, i) => h.kind === 'mid' && !this.hidden[i]).length;
    this.crowded = this.list.some((h, i) => h.kind !== 'mid' && this.list.some((o, j) => j > i && o.kind !== 'mid'
      && Math.hypot(this.scr[j][0] - this.scr[i][0], this.scr[j][1] - this.scr[i][1]) < (PX[h.kind] + PX[o.kind]) * 0.35));
    this.list.forEach((h, i) => {
      const px = PX[h.kind] * (i === this.active ? 1.3 : 1);
      this.sprites[i].scale.setScalar(px / (p11 * H / 2));
      this.sprites[i].visible = !this.hidden[i];
    });
  }

  /** Zeichen unter dem Finger (auf dem Kreis oder knapp daneben) oder -1; ausgeblendete zählen nicht */
  at(clientX: number, clientY: number, camera: THREE.PerspectiveCamera, rect: DOMRect): number {
    let best = -1, bestD = Infinity;
    camera.updateMatrixWorld();
    this.list.forEach((h, i) => {
      if (this.hidden[i]) return;
      this.v.set(h.x, h.y, h.z).project(camera);
      if (this.v.z > 1) return;
      const sx = rect.left + ((this.v.x + 1) / 2) * rect.width, sy = rect.top + ((1 - this.v.y) / 2) * rect.height;
      // bei gleich nahen Griffen gewinnen Knickpunkt und Ziel vor der Mitte
      const d = Math.hypot(sx - clientX, sy - clientY);
      const rank = d + (h.kind === 'mid' || h.kind === 'start' ? 4 : 0);
      if (d < PX[h.kind] / 2 + HIT_EXTRA && rank < bestD) { bestD = rank; best = i; }
    });
    return best;
  }

  dispose() {
    for (const m of Object.values(this.mats)) { m.map?.dispose(); m.dispose(); }
  }
}
