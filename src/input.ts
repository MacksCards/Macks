// Touch- und Maussteuerung der Karte.
// Ein Finger verschiebt (und gleitet nach dem Loslassen weich aus), zwei Finger zoomen um den Punkt
// zwischen den Fingern und drehen erst ab etwa 9° Fingerdrehung. Das Mausrad zoomt zum Zeiger.
// Ein Tipp gilt bis 1 s, ein Doppeltipp zoomt eine Stufe näher. Dazu sanfte Kamerafahrten
// (für die Knöpfe + / − / Kompass und wenn die Kamera einem Infofenster ausweicht).
import { View } from './render/scene';

export interface InputHandlers {
  tap(x: number, y: number): void;
  /** true = dieser Finger malt (z. B. Wege) statt die Karte zu verschieben */
  wantsPaint(): boolean;
  paintStart(x: number, y: number): void;
  paintMove(x: number, y: number): void;
  paintEnd(cancel: boolean): void;
  /** Doppeltipp auf die Karte: true = selbst erledigt, sonst zoomt die Karte eine Stufe näher */
  doubleTap?(x: number, y: number): boolean;
}

interface Ptr { x: number; y: number; sx: number; sy: number; t: number }
interface Anim { t0: number; ms: number; step: (e: number) => void }

/** eine Zoomstufe (Doppeltipp, Knöpfe + und −): Abstand × 0,62 */
export const ZOOM_STEP = 0.62;
/** so lange darf ein Tipp dauern (ms) */
const TAP_MS = 1000;
/** so weit darf der Finger beim Tippen wackeln (Pixel) */
const TAP_PX = 8;
/** zwei Tipps so kurz nacheinander und so nah beieinander = Doppeltipp */
const DOUBLE_MS = 350;
const DOUBLE_PX = 36;
/** Drehen erst, wenn sich die Finger in dieser Geste um mehr als 9° gedreht haben */
const ROT_START = (9 * Math.PI) / 180;
/** Drehung nur messen, wenn die Finger mindestens so weit auseinander sind (Pixel) */
const ROT_SPREAD = 70;
/** Nachgleiten: so schnell bremst die Karte ab (ms bis auf etwa ein Drittel) */
const GLIDE_TAU = 325;
/** unter diesem Tempo (Felder je ms) hört das Nachgleiten auf */
const GLIDE_MIN = 0.002;
/** höchstes Tempo beim Nachgleiten (Felder je ms) */
const GLIDE_MAX = 0.2;

/** weich anfahren und weich abbremsen */
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Input {
  private ptrs = new Map<number, Ptr>();
  /** Geste hatte zwischendurch 2 Finger */
  private multi = false;
  private painting = false;
  private moved = false;
  /** Maus: rechte Taste oder Umschalt = drehen */
  private rotating = false;
  /** Fingerdrehung in dieser Zwei-Finger-Geste (Bogenmaß) und ob schon gedreht wird */
  private rotAcc = 0;
  private rotOn = false;
  /** Verschiebung der Kamera über die Zeit – daraus das Tempo fürs Nachgleiten */
  private track: { t: number; x: number; z: number }[] = [];
  private panX = 0;
  private panZ = 0;
  private vel: { x: number; z: number } | null = null;
  private lastTap: { t: number; x: number; y: number } | null = null;
  private anim: Anim | null = null;
  private loopOn = false;
  private lastFrame = 0;
  /** Kamera nach dem letzten eigenen Schritt – weicht sie ab, hat jemand anderes die Kamera bewegt */
  private mark: number[] | null = null;
  /** wird nach jeder Kamerabewegung durch Finger, Maus oder Kamerafahrt aufgerufen (z. B. für die Kompassnadel) */
  onCamera: (() => void) | null = null;

  constructor(private el: HTMLElement, private view: View, private h: InputHandlers) {
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e, true));
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.stop();
      // Mausrad zoomt zum Zeiger (Zeilen- und Seitenschritte wie Pixel umrechnen)
      const k = e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 0.8 : 0.0015;
      this.zoomAt(e.clientX, e.clientY, Math.exp(Math.max(-1, Math.min(1, e.deltaY * k))));
      this.onCamera?.();
    }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // Safari: Seiten-Zoom verhindern
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
      document.addEventListener(ev, (e) => e.preventDefault(), { passive: false } as AddEventListenerOptions);
    }
  }

  // ---------- Kamerafahrten ----------

  /** sanfte Kamerafahrt: step bekommt den Fortschritt 0 … 1 (weich); eine neue Fahrt ersetzt die alte */
  animate(ms: number, step: (e: number) => void) {
    this.vel = null;
    this.mark = null;
    this.anim = { t0: performance.now(), ms: Math.max(1, ms), step };
    this.kick();
  }

  /** laufende Kamerafahrt und Nachgleiten anhalten */
  stop() {
    this.anim = null;
    this.vel = null;
  }

  private snap(): number[] {
    const r = this.view.rig;
    return [r.tx, r.tz, r.dist, r.yaw];
  }

  /** Kamera sanft zu einem Ziel bewegen (nur die angegebenen Werte ändern sich) */
  flyTo(to: { tx?: number; tz?: number; dist?: number; yaw?: number }, ms = 450) {
    const r = this.view.rig;
    const from = { tx: r.tx, tz: r.tz, dist: r.dist, yaw: r.yaw };
    // Drehen auf dem kürzesten Weg
    const dyaw = to.yaw === undefined ? 0 : Math.atan2(Math.sin(to.yaw - r.yaw), Math.cos(to.yaw - r.yaw));
    this.animate(ms, (e) => {
      if (to.tx !== undefined) r.tx = from.tx + (to.tx - from.tx) * e;
      if (to.tz !== undefined) r.tz = from.tz + (to.tz - from.tz) * e;
      // Abstand gleichmäßig auf der Zoom-Skala ändern
      if (to.dist !== undefined) r.dist = from.dist * Math.pow(to.dist / from.dist, e);
      if (to.yaw !== undefined) r.yaw = from.yaw + dyaw * e;
    });
  }

  /** Kamera nach einer Änderung sofort neu stellen – samt der Matrizen, mit denen groundPoint rechnet */
  private sync() {
    this.view.updateCamera();
    this.view.camera.updateMatrixWorld();
  }

  /** sofort zoomen; der Boden unter dem Bildpunkt (x, y) bleibt dabei an seiner Stelle */
  zoomAt(x: number, y: number, f: number) {
    const v = this.view, r = v.rig;
    this.sync();
    const a = v.groundPoint(x, y);
    r.dist *= f;
    this.sync();
    const b = v.groundPoint(x, y);
    if (a && b) { r.tx += a.x - b.x; r.tz += a.z - b.z; this.sync(); }
  }

  /** sanft eine Stufe zoomen (f < 1 = näher) um einen Bildpunkt */
  zoomStepAt(x: number, y: number, f: number, ms = 280) {
    const r = this.view.rig;
    const d0 = r.dist;
    this.animate(ms, (e) => {
      const want = d0 * Math.pow(f, e);
      if (r.dist > 0) this.zoomAt(x, y, want / r.dist);
    });
  }

  /** sanft eine Stufe zoomen um die Bildmitte */
  zoomStep(f: number) {
    const rc = this.el.getBoundingClientRect();
    this.zoomStepAt(rc.left + rc.width / 2, rc.top + rc.height / 2, f);
  }

  /** Ansicht sanft nach Norden drehen (Norden zeigt dann nach oben) */
  north(ms = 500) {
    this.flyTo({ yaw: 0 }, ms);
  }

  private kick() {
    if (this.loopOn) return;
    this.loopOn = true;
    this.lastFrame = performance.now();
    requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    // echte Zeit seit dem letzten Bild (bei einer langen Pause höchstens 1 s)
    const dt = Math.min(1000, Math.max(0, now - this.lastFrame));
    this.lastFrame = Math.max(this.lastFrame, now);
    // hat jemand anderes die Kamera bewegt (Weltkarte, neues Spiel …)? Dann nicht dagegen anfahren
    const m = this.mark;
    if (m && this.snap().some((v, i) => Math.abs(v - m[i]) > 1e-6)) { this.anim = null; this.vel = null; }
    let busy = false;
    const a = this.anim;
    if (a) {
      const t = Math.min(1, Math.max(0, (now - a.t0) / a.ms));
      a.step(ease(t));
      if (t >= 1) { if (this.anim === a) this.anim = null; } else busy = true;
    }
    const v = this.vel;
    if (v && dt > 0) {
      // Abbremsen genau gerechnet: gleich weit und gleich lang – egal, wie viele Bilder je Sekunde gezeichnet werden
      const r = this.view.rig, ox = r.tx, oz = r.tz;
      const k = Math.exp(-dt / GLIDE_TAU);
      const s = GLIDE_TAU * (1 - k);
      r.tx += v.x * s;
      r.tz += v.z * s;
      this.view.updateCamera(); // hält am Kartenrand an
      v.x *= k; v.z *= k;
      const stuck = Math.hypot(r.tx - ox, r.tz - oz) < 1e-4;
      if (Math.hypot(v.x, v.z) < GLIDE_MIN || stuck) this.vel = null; else busy = true;
    } else if (v) busy = true;
    if (a || v) this.onCamera?.();
    this.mark = this.anim || this.vel ? this.snap() : null;
    if (busy || this.anim || this.vel) requestAnimationFrame(this.frame);
    else this.loopOn = false;
  };

  // ---------- Finger und Maus ----------

  private down(e: PointerEvent) {
    try { this.el.setPointerCapture(e.pointerId); } catch { /* Zeiger schon weg */ }
    // Der Finger übernimmt: laufende Fahrt und Nachgleiten anhalten
    this.stop();
    const p: Ptr = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: e.timeStamp };
    this.ptrs.set(e.pointerId, p);
    this.rotating = e.button === 2 || (e.pointerType === 'mouse' && e.shiftKey);
    if (this.ptrs.size === 1) {
      this.multi = false;
      this.moved = false;
      this.panX = 0; this.panZ = 0;
      this.track = [{ t: e.timeStamp, x: 0, z: 0 }];
      if (this.h.wantsPaint() && !this.rotating) {
        this.painting = true;
        this.h.paintStart(e.clientX, e.clientY);
      }
    } else {
      this.multi = true;
      this.lastTap = null;
      // neue Zwei-Finger-Geste: Drehung von vorn zählen
      this.rotAcc = 0;
      this.rotOn = false;
      if (this.painting) { this.painting = false; this.h.paintEnd(true); }
    }
  }

  private move(e: PointerEvent) {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    const px = p.x, py = p.y;
    if (!this.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > TAP_PX) { this.moved = true; this.lastTap = null; }

    if (this.ptrs.size === 1) {
      p.x = e.clientX; p.y = e.clientY;
      if (this.painting) { this.h.paintMove(e.clientX, e.clientY); return; }
      if (!this.moved) return;
      if (this.rotating) {
        this.view.rig.yaw -= (e.clientX - px) * 0.008;
        this.onCamera?.();
        return;
      }
      const [dx, dz] = this.panBy(px, py, e.clientX, e.clientY);
      this.panX += dx; this.panZ += dz;
      this.track.push({ t: e.timeStamp, x: this.panX, z: this.panZ });
      if (this.track.length > 24) this.track.splice(0, this.track.length - 24);
      return;
    }
    if (this.ptrs.size === 2) {
      const [a, b] = Array.from(this.ptrs.values());
      const oldMid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      const oldDist = Math.hypot(a.x - b.x, a.y - b.y);
      const oldAng = Math.atan2(b.y - a.y, b.x - a.x);
      p.x = e.clientX; p.y = e.clientY;
      const newMid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      const newDist = Math.hypot(a.x - b.x, a.y - b.y);
      const newAng = Math.atan2(b.y - a.y, b.x - a.x);
      const v = this.view, r = v.rig;
      // Bodenpunkt zwischen den Fingern merken – er soll nach Zoom und Drehung wieder dort liegen
      this.sync();
      const anchor = v.groundPoint(oldMid[0], oldMid[1]);
      if (oldDist > 10 && newDist > 10) r.dist *= oldDist / newDist;
      let dAng = newAng - oldAng;
      if (dAng > Math.PI) dAng -= Math.PI * 2;
      if (dAng < -Math.PI) dAng += Math.PI * 2;
      // kleines Fingerwackeln beim Zoomen dreht die Karte nicht: erst ab 9° Drehung in dieser Geste –
      // und nur, wenn die Finger weit genug auseinander sind (nah beieinander ist der Winkel zu ungenau)
      const spread = oldDist > ROT_SPREAD && newDist > ROT_SPREAD;
      if (spread) {
        this.rotAcc += dAng;
        if (!this.rotOn && Math.abs(this.rotAcc) >= ROT_START) this.rotOn = true;
        if (this.rotOn) r.yaw += dAng;
      }
      this.sync();
      const now = v.groundPoint(newMid[0], newMid[1]);
      if (anchor && now) { r.tx += anchor.x - now.x; r.tz += anchor.z - now.z; }
      this.onCamera?.();
      return;
    }
    p.x = e.clientX; p.y = e.clientY;
  }

  /** Karte so verschieben, dass der Punkt unter dem Finger mitwandert; gibt die Verschiebung zurück */
  private panBy(x0: number, y0: number, x1: number, y1: number): [number, number] {
    this.sync();
    const a = this.view.groundPoint(x0, y0);
    const b = this.view.groundPoint(x1, y1);
    if (!a || !b) return [0, 0];
    const dx = a.x - b.x, dz = a.z - b.z;
    this.view.rig.tx += dx;
    this.view.rig.tz += dz;
    return [dx, dz];
  }

  /** nach dem Wischen mit dem Tempo des Fingers weitergleiten und sanft abbremsen */
  private glide(tUp: number) {
    const tr = this.track;
    if (tr.length < 2) return;
    const last = tr[tr.length - 1];
    if (tUp - last.t > 70) return; // der Finger lag zuletzt still
    let i = tr.length - 2;
    while (i > 0 && last.t - tr[i - 1].t <= 100) i--;
    const first = tr[i];
    const dt = last.t - first.t;
    if (dt < 8) return;
    let vx = (last.x - first.x) / dt, vz = (last.z - first.z) / dt;
    const sp = Math.hypot(vx, vz);
    if (sp < GLIDE_MIN * 2) return;
    if (sp > GLIDE_MAX) { vx *= GLIDE_MAX / sp; vz *= GLIDE_MAX / sp; }
    this.anim = null;
    this.vel = { x: vx, z: vz };
    this.mark = this.snap();
    this.kick();
  }

  private up(e: PointerEvent, cancel = false) {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    this.ptrs.delete(e.pointerId);
    if (this.painting && this.ptrs.size === 0) {
      this.painting = false;
      this.h.paintEnd(cancel);
      return;
    }
    // ein Finger bleibt nach dem Zwei-Finger-Zoom liegen: die Drehung beginnt beim nächsten Mal von vorn
    if (this.ptrs.size === 1) { this.rotAcc = 0; this.rotOn = false; }
    if (this.ptrs.size !== 0 || cancel) return;
    if (this.multi) return;
    if (this.moved) {
      if (!this.rotating) this.glide(e.timeStamp);
      return;
    }
    if (e.timeStamp - p.t >= TAP_MS) return;
    // Tipp – oder der zweite Tipp eines Doppeltipps
    const lt = this.lastTap;
    if (lt && e.timeStamp - lt.t < DOUBLE_MS && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < DOUBLE_PX) {
      this.lastTap = null;
      if (!this.h.doubleTap?.(e.clientX, e.clientY)) this.zoomStepAt(e.clientX, e.clientY, ZOOM_STEP);
      return;
    }
    this.lastTap = { t: e.timeStamp, x: e.clientX, y: e.clientY };
    this.h.tap(e.clientX, e.clientY);
  }
}
