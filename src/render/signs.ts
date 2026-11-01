// Symbole über der Welt: Warnsymbole über Gebäuden (Ring in der Farbe der Dringlichkeit), Sammelmarken
// mit Zahl beim Herauszoomen, Symbole über entdeckten Inseln (Erz, Gold, Pflanzen mit Prozent) und
// Marken für eigene Soldaten aus großer Entfernung.
// Alle Symbole liegen auf EINEM Bild (Symbol-Tafel) und werden in EINEM Zeichenaufruf gezeichnet.
// Sie haben eine feste Größe in Bildpunkten (egal wie weit weg) und liegen über allem anderen.
import * as THREE from 'three';
import { URGENCY_COLOR, Urgency } from './citysigns';

/** Größe einer Zelle der Symbol-Tafel in Bildpunkten und Zahl der Zellen (Breite × Höhe) */
const CELL = 128, COLS = 16, ROWS = 8;
const MAX = 2048;
type Painter = (ctx: CanvasRenderingContext2D, s: number) => void;

export class SignLayer {
  mesh: THREE.Mesh;
  private geo: THREE.InstancedBufferGeometry;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private tex: THREE.Texture;
  private cells = new Map<string, number>();
  private aPos = new Float32Array(MAX * 3);
  private aCell = new Float32Array(MAX * 2);
  private aExt = new Float32Array(MAX * 4);
  private n = 0;
  private texDirty = false;
  private uni = { uMap: { value: null as THREE.Texture | null }, uView: { value: new THREE.Vector2(800, 400) }, uCell: { value: new THREE.Vector2(1 / COLS, 1 / ROWS) } };

  constructor() {
    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.canvas.width = CELL * COLS; this.canvas.height = CELL * ROWS;
      this.ctx = this.canvas.getContext('2d');
      this.tex = new THREE.CanvasTexture(this.canvas);
    } else this.tex = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.flipY = false;
    this.tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.tex.generateMipmaps = true;
    this.uni.uMap.value = this.tex;
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(this.aPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(this.aCell, 2).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aExt', new THREE.InstancedBufferAttribute(this.aExt, 4).setUsage(THREE.DynamicDrawUsage));
    geo.instanceCount = 0;
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: this.uni,
      vertexShader: /* glsl */ `
        attribute vec3 aPos; attribute vec2 aCell; attribute vec4 aExt;
        uniform vec2 uView; uniform vec2 uCell;
        varying vec2 vUv; varying float vA;
        void main() {
          vec4 c = projectionMatrix * viewMatrix * vec4(aPos, 1.0);
          // feste Größe in Bildpunkten (aExt.x), versetzt um aExt.yz Bildpunkte
          vec2 px = position.xy * aExt.x + aExt.yz;
          c.xy += px * 2.0 / uView * c.w;
          gl_Position = c.w <= 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : c;
          vUv = aCell + vec2(position.x + 0.5, 0.5 - position.y) * uCell;
          vA = aExt.w;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying vec2 vUv; varying float vA;
        void main() {
          vec4 t = texture2D(uMap, vUv);
          if (t.a * vA < 0.01) discard;
          gl_FragColor = vec4(t.rgb, t.a * vA);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
  }

  /** Größe der Zeichenfläche in CSS-Bildpunkten (für die feste Symbolgröße) */
  setView(w: number, h: number) { this.uni.uView.value.set(Math.max(1, w), Math.max(1, h)); }

  begin() { this.n = 0; }

  /** Symbol setzen: Weltpunkt, Schlüssel (gleiches Bild = gleicher Schlüssel), Maler, Größe und Versatz in Bildpunkten */
  add(x: number, y: number, z: number, key: string, paint: Painter, sizePx: number, offX = 0, offY = 0, alpha = 1) {
    if (this.n >= MAX) return;
    const cell = this.cell(key, paint);
    const i = this.n++;
    this.aPos[i * 3] = x; this.aPos[i * 3 + 1] = y; this.aPos[i * 3 + 2] = z;
    this.aCell[i * 2] = (cell % COLS) / COLS; this.aCell[i * 2 + 1] = Math.floor(cell / COLS) / ROWS;
    this.aExt[i * 4] = sizePx; this.aExt[i * 4 + 1] = offX; this.aExt[i * 4 + 2] = offY; this.aExt[i * 4 + 3] = alpha;
  }

  end() {
    const g = this.geo;
    g.instanceCount = this.n;
    if (this.n) for (const [name, size] of [['aPos', 3], ['aCell', 2], ['aExt', 4]] as const) {
      const a = g.getAttribute(name) as THREE.InstancedBufferAttribute;
      a.clearUpdateRanges(); a.addUpdateRange(0, this.n * size); a.needsUpdate = true;
    }
    if (this.texDirty) { this.tex.needsUpdate = true; this.texDirty = false; }
  }

  get count() { return this.n; }

  /** Zelle für ein Bild: einmal malen, danach wiederverwenden. Ist die Tafel voll, wird sie geleert. */
  private cell(key: string, paint: Painter): number {
    let c = this.cells.get(key);
    if (c !== undefined) return c;
    if (this.cells.size >= COLS * ROWS) {
      // Tafel voll: neu beginnen (die gerade gesetzten Symbole dieses Bildes behalten ihre Zellen nicht – selten)
      this.cells.clear();
      this.ctx?.clearRect(0, 0, CELL * COLS, CELL * ROWS);
    }
    c = this.cells.size;
    this.cells.set(key, c);
    const ctx = this.ctx;
    if (ctx) {
      ctx.save();
      ctx.translate((c % COLS) * CELL, Math.floor(c / COLS) * CELL);
      ctx.clearRect(0, 0, CELL, CELL);
      ctx.beginPath(); ctx.rect(0, 0, CELL, CELL); ctx.clip();
      paint(ctx, CELL);
      ctx.restore();
      this.texDirty = true;
    }
    return c;
  }

  dispose() {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.tex.dispose();
  }
}

/** abgerundetes Rechteck (ältere Browser kennen roundRect nicht) */
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const TEXT = '"Alegreya Sans", system-ui, sans-serif';

/** Warnsymbol: weiße Scheibe, Ring in der Farbe der Dringlichkeit, Symbol in der Mitte */
export function paintWarn(icon: string, level: Urgency): Painter {
  return (ctx, s) => {
    const r = s * 0.42, c = s / 2;
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = s * 0.05; ctx.shadowOffsetY = s * 0.02;
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = s * 0.075; ctx.strokeStyle = URGENCY_COLOR[level]; ctx.stroke();
    ctx.font = `${Math.round(s * 0.46)}px ${EMOJI}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(icon, c, c + s * 0.03);
  };
}

/** Sammelmarke: Ring in der Farbe der dringendsten Warnung, Symbol und Zahl */
export function paintCluster(icon: string, level: Urgency, count: number): Painter {
  return (ctx, s) => {
    const c = s / 2, r = s * 0.42;
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = s * 0.05; ctx.shadowOffsetY = s * 0.02;
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = s * 0.08; ctx.strokeStyle = URGENCY_COLOR[level]; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(s * 0.34)}px ${EMOJI}`;
    ctx.fillText(icon, c, c - s * 0.12);
    // Zahl unten in einem farbigen Schild
    const label = count > 99 ? '99+' : String(count);
    ctx.fillStyle = URGENCY_COLOR[level];
    const w = s * (0.26 + 0.14 * label.length), h = s * 0.34;
    rrect(ctx, c - w / 2, c + s * 0.08, w, h, h / 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.round(s * 0.3)}px ${TEXT}`;
    ctx.fillText(label, c, c + s * 0.08 + h / 2 + s * 0.015);
  };
}

/** Insel-Symbol: dunkles Schild mit Symbol oben und kurzem Text (Erz, Gold, 100 %) unten */
export function paintIsland(icon: string, text: string): Painter {
  return (ctx, s) => {
    const p = s * 0.06;
    ctx.fillStyle = 'rgba(30,24,16,0.72)';
    rrect(ctx, p, p, s - 2 * p, s - 2 * p, s * 0.16); ctx.fill();
    ctx.strokeStyle = 'rgba(246,236,214,0.55)'; ctx.lineWidth = s * 0.025; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(s * 0.42)}px ${EMOJI}`;
    ctx.fillText(icon, s / 2, s * 0.4);
    ctx.fillStyle = '#f6ecd6';
    ctx.font = `700 ${Math.round(s * 0.21)}px ${TEXT}`;
    ctx.fillText(text, s / 2, s * 0.78);
  };
}

/** Marke für eigene Soldaten: Scheibe in der Spielerfarbe, heller Rand (gelb = ausgewählt), Schwerter */
export function paintUnit(color: number, selected: boolean): Painter {
  return (ctx, s) => {
    const c = s / 2, r = s * 0.4;
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = s * 0.06;
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = s * 0.08; ctx.strokeStyle = selected ? '#ffe066' : '#f6ecd6'; ctx.stroke();
    ctx.font = `${Math.round(s * 0.42)}px ${EMOJI}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⚔️', c, c + s * 0.03);
  };
}
