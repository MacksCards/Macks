// Minikarte (Paket U3): ≈ 96 × 96 Bildpunkte unten rechts, ausgeblendet bei offenem Infofenster.
// Zeigt das entdeckte Land (eigenes blau, Gegner in ihrer Farbe), eigene Kontore, Schiffe (eigene gelb, Feinde rot,
// Piraten schwarz, Händler weiß), feindliche Soldaten, blinkende Kämpfe und als Viereck, was gerade im Bild ist
// (aus den vier Bildecken). Tippen oder Ziehen setzt die Kamera.
// Leistung: Inhalt höchstens einmal je Sekunde neu (aus einem kleinen Bild der Welt, das nur neu entsteht, wenn
// Land entdeckt oder gebaut wurde); das Sichtfeld-Viereck liegt auf einer eigenen kleinen Ebene und folgt der Kamera
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

/** Weltbild Feld für Feld (1 Bildpunkt je Feld): Land, Besitz, Nebel – auf Wunsch Ergiebigkeit von Fisch oder Wald */
export function paintWorld(g: Game, img: ImageData, layer: MapLayer = 'none') {
  const N = g.size, d = img.data;
  const pc = g.players.map((p) => rgb(p.color));
  for (let k = 0; k < N * N; k++) {
    let c: [number, number, number];
    const t = g.tiles[k];
    if (!g.seen[k]) c = FOG;
    else if (layer === 'fisch') {
      // Fischbestand je Fanggrund: dunkel = kaum Fisch, hell türkis = viel
      if (t === T.Wasser) { const v = g.fishCap[k] * g.fish[k]; c = [20 + v * 40, 50 + v * 170, 90 + v * 140]; }
      else c = [92, 88, 80];
    } else if (layer === 'wald') {
      // Wald: hellgrün = ausgewachsen, dunkel = gefällt/jung
      if (t === T.Wald || g.trees[k] > 0.02) { const v = g.trees[k]; c = [30 + v * 40, 60 + v * 150, 30 + v * 30]; }
      else c = t === T.Wasser ? [30, 52, 72] : [96, 90, 80];
    } else {
      c = LAND[t] ?? LAND[T.Gras];
      const o = g.own[k];
      if (t !== T.Wasser && o >= 0) {
        const oc = o === HUMAN ? OWN : pc[o] ?? OWN;
        c = [c[0] * 0.35 + oc[0] * 0.65, c[1] * 0.35 + oc[1] * 0.65, c[2] * 0.35 + oc[2] * 0.65];
      }
    }
    const i = k * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
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

/** Kennzahl des sichtbaren Weltbilds: entdeckte Felder, Besitz und Bodenart auf entdecktem Land (ein Durchlauf).
 *  Bauen ohne neues Gebiet (Häuser, Betriebe) oder Gegner auf unentdeckten Inseln ändern sie nicht – dann bleibt
 *  das Weltbild der Minikarte, wie es ist. */
export function worldKey(g: Game): string {
  const s = g.seen, o = g.own, t = g.tiles;
  let n = 0, h = 0;
  for (let k = 0; k < s.length; k++) {
    if (!s[k]) continue;
    n++;
    // Besitz und Bodenart (gerodeter Wald) des Feldes
    h = (Math.imul(h, 31) + (o[k] + 2) * 16 + t[k]) | 0;
  }
  return `${s.length}:${n}:${h}`;
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
  /** Weltbild 1 Bildpunkt je Feld; neu nur, wenn Land entdeckt oder gebaut wurde */
  private world: HTMLCanvasElement | null = null;
  private worldKey = '';
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
  reset() { this.world = null; this.img = null; this.worldKey = ''; this.lastDraw = -1e9; }

  private draw() {
    const g = this.ui.g, N = g.size;
    // Weltbild nur neu, wenn sich Entdecktes oder der Besitz auf entdecktem Land geändert hat (nicht bei jedem Bau
    // irgendwo); die Bilddaten werden dabei wiederverwendet statt jedes Mal neu angelegt
    const key = worldKey(g);
    if (!this.world || this.world.width !== N || key !== this.worldKey) {
      this.worldKey = key;
      const w = this.world && this.world.width === N ? this.world : Object.assign(document.createElement('canvas'), { width: N, height: N });
      const wc = w.getContext('2d')!;
      if (!this.img || this.img.width !== N) this.img = wc.createImageData(N, N);
      paintWorld(g, this.img);
      wc.putImageData(this.img, 0, 0);
      this.world = w;
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
