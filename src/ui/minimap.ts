// Minikarte (Paket U3): ≈ 96 × 96 Bildpunkte unten rechts, ausgeblendet bei offenem Infofenster.
// Zeigt das entdeckte Land (eigenes blau, Gegner in ihrer Farbe), eigene Kontore, Schiffe (eigene gelb, Feinde rot,
// Piraten schwarz, Händler weiß), feindliche Soldaten, blinkende Kämpfe und als Viereck, was gerade im Bild ist
// (aus den vier Bildecken). Tippen oder Ziehen setzt die Kamera.
// Leistung: Inhalt höchstens einmal je Sekunde neu (aus einem kleinen Bild der Welt, in dem nur die Felder neu
// gemalt werden, deren Anblick sich geändert hat – entdeckt, Besitz, Wald); das Sichtfeld-Viereck liegt auf einer eigenen kleinen Ebene und folgt der Kamera
// (höchstens 10 × je Sekunde, nur wenn sie sich bewegt).
// Die Farben und das Zeichnen der Welt nutzt auch die große Weltkarte (ui/windows.ts).
import { atWar } from '../combat';
import { HUMAN, type Game } from '../game';
import type { UI } from '../ui';
import { T } from '../world';
import { el } from './util';

/** Farbe des Landes ohne Besitzer, des Meeres und des Nebels */
const LAND: Record<number, [number, number, number]> = {
  [T.Wasser]: [38, 92, 135], [T.Sand]: [214, 196, 142], [T.Gras]: [104, 152, 78], [T.Wald]: [50, 98, 52], [T.Berg]: [128, 121, 110],
};
const FOG: [number, number, number] = [44, 56, 70];
const OWN: [number, number, number] = [70, 125, 225];

export type MapLayer = 'none' | 'fisch' | 'wald';

const rgb = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Farbe eines Feldes in die Bilddaten schreiben (ohne kleine Zahlenlisten je Feld – nichts für den Speicher-Aufräumer) */
function paintTile(g: Game, d: Uint8ClampedArray, k: number, layer: MapLayer, pc: [number, number, number][]) {
  let r: number, gr: number, b: number;
  const t = g.tiles[k];
  if (!g.seen[k]) { r = FOG[0]; gr = FOG[1]; b = FOG[2]; }
  else if (layer === 'fisch') {
    // Fischbestand je Fanggrund: dunkel = kaum Fisch, hell türkis = viel
    if (t === T.Wasser) { const v = g.fishCap[k] * g.fish[k]; r = 20 + v * 40; gr = 50 + v * 170; b = 90 + v * 140; }
    else { r = 92; gr = 88; b = 80; }
  } else if (layer === 'wald') {
    // Wald: hellgrün = ausgewachsen, dunkel = gefällt/jung
    if (t === T.Wald || g.trees[k] > 0.02) { const v = g.trees[k]; r = 30 + v * 40; gr = 60 + v * 150; b = 30 + v * 30; }
    else if (t === T.Wasser) { r = 30; gr = 52; b = 72; }
    else { r = 96; gr = 90; b = 80; }
  } else {
    const c = LAND[t] ?? LAND[T.Gras];
    r = c[0]; gr = c[1]; b = c[2];
    const o = g.own[k];
    if (t !== T.Wasser && o >= 0) {
      const oc = o === HUMAN ? OWN : pc[o] ?? OWN;
      r = r * 0.35 + oc[0] * 0.65; gr = gr * 0.35 + oc[1] * 0.65; b = b * 0.35 + oc[2] * 0.65;
    }
  }
  const i = k * 4;
  d[i] = r; d[i + 1] = gr; d[i + 2] = b; d[i + 3] = 255;
}

/** Weltbild Feld für Feld (1 Bildpunkt je Feld): Land, Besitz, Nebel – auf Wunsch Ergiebigkeit von Fisch oder Wald */
export function paintWorld(g: Game, img: ImageData, layer: MapLayer = 'none') {
  const N = g.size, d = img.data;
  const pc = g.players.map((p) => rgb(p.color));
  for (let k = 0; k < N * N; k++) paintTile(g, d, k, layer, pc);
}

/** Kennung dessen, was ein Feld auf der Minikarte zeigt: -1 = Nebel, sonst Besitz und Bodenart */
const tileSig = (g: Game, k: number) => (g.seen[k] ? (g.own[k] + 2) * 16 + g.tiles[k] : -1);

/**
 * Weltbild nachführen: nur Felder, deren Anblick sich geändert hat (Entdecktes, Besitz, gerodeter oder
 * nachgewachsener Wald), werden neu gemalt. sig merkt sich je Feld, was zuletzt gemalt wurde.
 * Gebäude der Gegner auf unentdeckten Inseln oder Häuser auf eigenem Land ändern nichts.
 * Schreibt in box das Rechteck der geänderten Felder [x0, y0, x1, y1] und gibt ihre Zahl zurück (0 = unverändert).
 */
export function paintWorldDelta(g: Game, img: ImageData, sig: Int32Array, box: number[] = []): number {
  const n = sig.length, N = g.size, d = img.data;
  let pc: [number, number, number][] | null = null, changed = 0;
  let x0 = N, y0 = N, x1 = -1, y1 = -1;
  for (let k = 0; k < n; k++) {
    const v = tileSig(g, k);
    if (v === sig[k]) continue;
    sig[k] = v;
    pc ??= g.players.map((p) => rgb(p.color));
    paintTile(g, d, k, 'none', pc);
    changed++;
    const x = k % N, y = (k - x) / N;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    y1 = y;
  }
  box[0] = x0; box[1] = y0; box[2] = x1; box[3] = y1;
  return changed;
}

/** Farbe eines Schiffs oder Soldaten auf der Karte: eigene gelb, Piraten schwarz, Händler weiß, Feinde im Krieg rot,
 *  sonst die Farbe des Gegners (Violett, Rosa, Grün – nie Rot oder Gelb, siehe game.ts) */
export function markColor(g: Game, owner: number): string {
  const p = g.players[owner];
  if (owner === HUMAN) return '#ffe066';
  if (p?.pirate) return '#111';
  if (p?.trader) return '#f4f1e8';
  if (atWar(g, HUMAN, owner)) return '#ff3b2f';
  return p ? css(p.color) : '#ccc';
}

/** Orte, an denen gerade gekämpft wird (Schüsse der letzten Sekunden), nur im entdeckten Gebiet */
export function battles(g: Game): [number, number][] {
  const out: [number, number][] = [];
  const seen = (x: number, y: number) => g.inMap(Math.floor(x), Math.floor(y)) && g.seen[g.idx(Math.floor(x), Math.floor(y))] === 1;
  for (const s of g.ships) if (s.shotT !== undefined && g.time - s.shotT < 3 && seen(s.x, s.y)) out.push([s.x, s.y]);
  for (const u of g.units) if (u.ship === undefined && u.atk !== undefined && g.time - u.atk < 2.5 && seen(u.x, u.y)) {
    // nahe Kämpfe zu einem Punkt zusammenfassen
    if (!out.some(([x, y]) => Math.abs(x - u.x) < 6 && Math.abs(y - u.y) < 6)) out.push([u.x, u.y]);
  }
  return out;
}

/** Anzahl entdeckter Felder (schnell genug für einmal je Sekunde) */
export function seenCount(g: Game): number {
  let n = 0;
  const s = g.seen;
  for (let k = 0; k < s.length; k++) n += s[k];
  return n;
}

let discCache: { g: Game; key: number; set: Set<number> } | null = null;
/** Inseln, von denen schon Land entdeckt ist (zwischengespeichert, solange nichts Neues entdeckt wurde) */
export function discovered(g: Game): Set<number> {
  const key = seenCount(g);
  if (discCache && discCache.g === g && discCache.key === key) return discCache.set;
  const set = new Set<number>();
  for (let k = 0; k < g.seen.length; k++) if (g.seen[k] && g.islandOf[k] >= 0) set.add(g.islandOf[k]);
  discCache = { g, key, set };
  return set;
}

export class Minimap {
  private wrap!: HTMLElement;
  private cv!: HTMLCanvasElement;
  private vcv!: HTMLCanvasElement;
  /** Weltbild 1 Bildpunkt je Feld; nur geänderte Felder werden nachgemalt */
  private world: HTMLCanvasElement | null = null;
  /** je Feld: was zuletzt gemalt wurde (siehe paintWorldDelta) */
  private sig: Int32Array | null = null;
  private box: number[] = [0, 0, 0, 0];
  /** Bilddaten des Weltbilds (wiederverwendet) */
  private img: ImageData | null = null;
  /** so oft wurde das Weltbild neu gemalt (für Messungen) */
  worldDraws = 0;
  private lastDraw = -1e9;
  private lastRect = 0;
  private blink = false;
  private drag = false;

  constructor(private ui: UI) {}

  mount(hud: HTMLElement) {
    this.wrap = el('div', 'minimap', '<canvas class="mmc"></canvas><canvas class="mmv"></canvas>');
    this.wrap.id = 'minimap';
    this.wrap.setAttribute('role', 'button');
    this.wrap.setAttribute('aria-label', 'Übersichtskarte – antippen oder ziehen, um dorthin zu schauen');
    [this.cv, this.vcv] = Array.from(this.wrap.querySelectorAll('canvas'));
    hud.appendChild(this.wrap);
    const at = (e: PointerEvent) => {
      const rc = this.wrap.getBoundingClientRect(), N = this.ui.g.size;
      const x = ((e.clientX - rc.left) / rc.width) * N, y = ((e.clientY - rc.top) / rc.height) * N;
      const r = this.ui.view.rig;
      this.ui.input.stop();
      r.tx = Math.max(2, Math.min(N - 2, x));
      r.tz = Math.max(2, Math.min(N - 2, y));
      this.ui.hud.needle();
      this.rect(true);
    };
    this.wrap.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.drag = true;
      try { this.wrap.setPointerCapture(e.pointerId); } catch { /* ältere Browser */ }
      at(e);
    });
    this.wrap.addEventListener('pointermove', (e) => { if (this.drag) at(e); });
    const end = () => { this.drag = false; };
    this.wrap.addEventListener('pointerup', end);
    this.wrap.addEventListener('pointercancel', end);
  }

  /** sichtbar? (ausgeblendet bei offenem Infofenster) */
  private shown(): boolean {
    return !!this.wrap && this.wrap.offsetParent !== null;
  }

  private size(c: HTMLCanvasElement) {
    const w = Math.round(c.clientWidth * Math.min(2, window.devicePixelRatio || 1)) || 96;
    if (c.width !== w) { c.width = w; c.height = w; }
    return w;
  }

  /** aus ui.updateHud (4 × je Sekunde): Inhalt höchstens einmal je Sekunde neu zeichnen */
  update() {
    const now = performance.now();
    if (now - this.lastDraw < 1000 || !this.shown()) return;
    this.lastDraw = now;
    this.draw();
  }

  /** neues Spiel: Weltbild verwerfen */
  reset() { this.world = null; this.img = null; this.sig = null; this.lastDraw = -1e9; }

  private draw() {
    const g = this.ui.g, N = g.size;
    // Weltbild nur dort neu, wo sich Entdecktes, Besitz oder Bodenart auf entdecktem Land geändert hat (nicht bei
    // jedem Bau irgendwo); Leinwand und Bilddaten werden wiederverwendet statt jedes Mal neu angelegt
    if (!this.world || this.world.width !== N || !this.img || !this.sig || this.sig.length !== N * N) {
      this.world = Object.assign(document.createElement('canvas'), { width: N, height: N });
      this.img = this.world.getContext('2d')!.createImageData(N, N);
      this.sig = new Int32Array(N * N).fill(-2); // -2 = noch nie gemalt
    }
    const bx = this.box;
    if (paintWorldDelta(g, this.img, this.sig, bx) > 0) {
      // nur das geänderte Rechteck auf die Leinwand übertragen
      this.world.getContext('2d')!.putImageData(this.img, 0, 0, bx[0], bx[1], bx[2] - bx[0] + 1, bx[3] - bx[1] + 1);
      this.worldDraws++;
    }
    const W = this.size(this.cv), s = W / N;
    const ctx = this.cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.world, 0, 0, W, W);
    const dot = (x: number, y: number, r: number, fill: string, stroke?: string) => {
      ctx.beginPath(); ctx.arc(x * s, y * s, r, 0, Math.PI * 2);
      ctx.fillStyle = fill; ctx.fill();
      if (stroke) { ctx.lineWidth = Math.max(1, W / 120); ctx.strokeStyle = stroke; ctx.stroke(); }
    };
    const u = W / 96;
    // Kontore: eigene als weiß umrandetes Quadrat, fremde (entdeckt) in ihrer Farbe
    for (const b of g.buildings) {
      if (b.type !== 'kontor') continue;
      if (b.owner !== HUMAN && !g.seen[g.idx(b.x, b.y)]) continue;
      const [cx, cy] = g.center(b), q = 3.2 * u;
      ctx.fillStyle = b.owner === HUMAN ? '#4a86ff' : markColor(g, b.owner);
      ctx.fillRect(cx * s - q, cy * s - q, q * 2, q * 2);
      ctx.lineWidth = Math.max(1, u);
      ctx.strokeStyle = b.owner === HUMAN ? '#fff' : '#000';
      ctx.strokeRect(cx * s - q, cy * s - q, q * 2, q * 2);
    }
    // feindliche Soldaten (im Krieg) und eigene Soldaten
    for (const un of g.units) {
      if (un.ship !== undefined) continue;
      if (un.owner !== HUMAN && !(atWar(g, HUMAN, un.owner) && g.seen[g.idx(Math.floor(un.x), Math.floor(un.y))])) continue;
      dot(un.x, un.y, 1.4 * u, un.owner === HUMAN ? '#9fd0ff' : '#ff3b2f');
    }
    // Schiffe
    for (const sh of g.ships) {
      if (sh.owner !== HUMAN && !g.seen[g.idx(Math.floor(sh.x), Math.floor(sh.y))]) continue;
      const p = g.players[sh.owner];
      dot(sh.x, sh.y, (sh.owner === HUMAN ? 2.8 : 2.4) * u, markColor(g, sh.owner), p?.pirate ? '#fff' : '#000');
    }
    // Kämpfe blinken (an/aus im Sekundentakt)
    this.blink = !this.blink;
    if (this.blink) for (const [x, y] of battles(g)) {
      ctx.beginPath(); ctx.arc(x * s, y * s, 5 * u, 0, Math.PI * 2);
      ctx.lineWidth = 2 * u; ctx.strokeStyle = '#ff9a3c'; ctx.stroke();
    }
    this.rect(true);
  }

  /** Sichtfeld-Viereck aus den vier Bildecken (eigene Ebene; auch nach jeder Kamerabewegung, gedrosselt) */
  rect(force = false) {
    if (!this.wrap || !this.shown()) return;
    const now = performance.now();
    if (!force && now - this.lastRect < 100) return;
    this.lastRect = now;
    const v = this.ui.view, N = this.ui.g.size;
    const W = this.size(this.vcv), s = W / N;
    const ctx = this.vcv.getContext('2d')!;
    ctx.clearRect(0, 0, W, W);
    v.updateCamera();
    v.camera.updateMatrixWorld();
    const rc = v.renderer.domElement.getBoundingClientRect();
    const top = document.querySelector<HTMLElement>('#hud .top')?.getBoundingClientRect().bottom ?? rc.top;
    const pts = [[rc.left, top], [rc.right, top], [rc.right, rc.bottom], [rc.left, rc.bottom]]
      .map(([x, y]) => v.groundPoint(x, y));
    if (pts.some((p) => !p)) return;
    ctx.beginPath();
    pts.forEach((p, i) => { const x = p!.x * s, y = p!.z * s; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.closePath();
    ctx.lineWidth = Math.max(1.5, W / 64);
    ctx.strokeStyle = 'rgba(255,255,255,.95)';
    ctx.stroke();
  }
}
