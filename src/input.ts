// Touch- und Maussteuerung: verschieben, zoomen, drehen, tippen, Wege ziehen.
import { View } from './render/scene';

export interface InputHandlers {
  tap(x: number, y: number): void;
  /** true = dieser Finger malt (z. B. Wege) statt die Karte zu verschieben */
  wantsPaint(): boolean;
  paintStart(x: number, y: number): void;
  paintMove(x: number, y: number): void;
  paintEnd(cancel: boolean): void;
}

interface Ptr { x: number; y: number; sx: number; sy: number; t: number }

export class Input {
  private ptrs = new Map<number, Ptr>();
  private multi = false; // Geste hatte zwischendurch 2 Finger
  private painting = false;
  private moved = false;
  private rotating = false;

  constructor(private el: HTMLElement, private view: View, private h: InputHandlers) {
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e, true));
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.view.rig.dist *= Math.exp(e.deltaY * 0.0015);
    }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // Safari: Seiten-Zoom verhindern
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
      document.addEventListener(ev, (e) => e.preventDefault(), { passive: false } as AddEventListenerOptions);
    }
  }

  private down(e: PointerEvent) {
    this.el.setPointerCapture(e.pointerId);
    const p: Ptr = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() };
    this.ptrs.set(e.pointerId, p);
    this.rotating = e.button === 2 || (e.pointerType === 'mouse' && e.shiftKey);
    if (this.ptrs.size === 1) {
      this.multi = false;
      this.moved = false;
      if (this.h.wantsPaint() && !this.rotating) {
        this.painting = true;
        this.h.paintStart(e.clientX, e.clientY);
      }
    } else {
      this.multi = true;
      if (this.painting) { this.painting = false; this.h.paintEnd(true); }
    }
  }

  private move(e: PointerEvent) {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    const px = p.x, py = p.y;
    if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 8) this.moved = true;

    if (this.ptrs.size === 1) {
      p.x = e.clientX; p.y = e.clientY;
      if (this.painting) { this.h.paintMove(e.clientX, e.clientY); return; }
      if (!this.moved) return;
      if (this.rotating) {
        this.view.rig.yaw -= (e.clientX - px) * 0.008;
        return;
      }
      this.panBy(px, py, e.clientX, e.clientY);
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
      if (oldDist > 10 && newDist > 10) this.view.rig.dist *= oldDist / newDist;
      let dAng = newAng - oldAng;
      if (dAng > Math.PI) dAng -= Math.PI * 2;
      if (dAng < -Math.PI) dAng += Math.PI * 2;
      this.view.rig.yaw += dAng;
      this.panBy(oldMid[0], oldMid[1], newMid[0], newMid[1]);
      return;
    }
    p.x = e.clientX; p.y = e.clientY;
  }

  /** Karte so verschieben, dass der Punkt unter dem Finger mitwandert */
  private panBy(x0: number, y0: number, x1: number, y1: number) {
    this.view.updateCamera();
    const a = this.view.groundPoint(x0, y0);
    const b = this.view.groundPoint(x1, y1);
    if (!a || !b) return;
    this.view.rig.tx += a.x - b.x;
    this.view.rig.tz += a.z - b.z;
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
    if (this.ptrs.size === 0 && !this.multi && !this.moved && !cancel && performance.now() - p.t < 600) {
      this.h.tap(e.clientX, e.clientY);
    }
  }
}
