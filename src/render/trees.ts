// Realistische Bäume wie in modernen Aufbauspielen.
//
// Eine Baumkrone besteht nicht aus wenigen großen Flächen, sondern aus vielen „Blattbüscheln“: kleine,
// gekreuzte Bildflächen, auf die ein im Code gemaltes Bild mit vielen einzelnen Blättern (bzw. Nadeln,
// Palmwedeln) kommt. Was zwischen den Blättern liegt, ist durchsichtig und wird beim Zeichnen
// weggeschnitten (kein langsames Sortieren durchsichtiger Flächen). Die Licht-Richtung jeder Fläche
// zeigt von der Kronenmitte nach außen – so wirkt die Krone rund und voll statt flach wie Pappe;
// innen ist sie dunkler (dort kommt weniger Licht hin), außen heller.
//
// Alle Bilder (Laub, Nadeln, Palmwedel, Rinde) liegen auf EINEM gemeinsamen Bild (512 × 512 Punkte),
// alle Bäume nutzen EIN Material: so bleibt es bei wenigen Zeichenaufrufen.
// Jede Baumart gibt es in vier Detailstufen: nah (≤ 600 Dreiecke), mittel (~150), weiter weg (~60) und fern (~30).
import * as THREE from 'three';

/** Kantenlänge des gemeinsamen Bildes */
export const ATLAS = 512;
type Rect = { x: number; y: number; w: number; h: number };
/** Bereiche im gemeinsamen Bild (in Bildpunkten, oben links = 0/0) */
const REG = {
  laub: { x: 0, y: 0, w: 256, h: 256 },
  nadel: { x: 256, y: 0, w: 256, h: 256 },
  wedel: { x: 0, y: 256, w: 512, h: 160 },
  rinde: { x: 0, y: 416, w: 256, h: 96 },
  palmrinde: { x: 256, y: 416, w: 256, h: 96 },
} satisfies Record<string, Rect>;

/** gleichmäßige Zufallszahlen aus einem Startwert (immer gleiche Bäume) */
function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h.toFixed(1)},${s.toFixed(1)}%,${l.toFixed(1)}%,${a})`;

// ---------------------------------------------------------------------------------------------
// Das gemeinsame Bild malen
// ---------------------------------------------------------------------------------------------

/** Laubbüschel: feine Zweige und ~280 einzelne Blätter in drei Lagen (hinten dunkel, vorn hell) */
function paintLaub(c: CanvasRenderingContext2D, R: Rect, r: () => number) {
  c.save(); c.translate(R.x, R.y);
  const cx = R.w / 2, cy = R.h / 2, rad = R.w / 2 - 6;
  c.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, len = rad * (0.55 + r() * 0.35);
    c.strokeStyle = hsl(28, 22, 16 + r() * 8);
    c.lineWidth = 2.4 - i * 0.12;
    c.beginPath(); c.moveTo(cx, cy);
    c.quadraticCurveTo(cx + Math.cos(a + 0.35) * len * 0.5, cy + Math.sin(a + 0.35) * len * 0.5, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    c.stroke();
  }
  const passes = [{ n: 95, l: [13, 22] }, { n: 115, l: [22, 32] }, { n: 85, l: [30, 44] }];
  passes.forEach((P, pi) => {
    for (let i = 0; i < P.n; i++) {
      const L = 12 + r() * 12, W = L * (0.4 + r() * 0.14);
      const a = r() * Math.PI * 2, d = (rad - L) * Math.pow(r(), 0.55 + pi * 0.2);
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      const ang = a + (r() - 0.5) * 1.8;
      const h = 82 + r() * 26, s = 34 + r() * 24, l = P.l[0] + r() * (P.l[1] - P.l[0]);
      c.save(); c.translate(x, y); c.rotate(ang);
      const gr = c.createLinearGradient(0, -W, 0, W);
      gr.addColorStop(0, hsl(h, s, l + 8)); gr.addColorStop(1, hsl(h + 4, s + 6, Math.max(6, l - 7)));
      c.fillStyle = gr;
      c.beginPath(); c.moveTo(0, 0);
      c.bezierCurveTo(L * 0.25, -W * 0.95, L * 0.7, -W * 0.78, L, 0);
      c.bezierCurveTo(L * 0.7, W * 0.78, L * 0.25, W * 0.95, 0, 0);
      c.fill();
      c.strokeStyle = hsl(h, s - 10, l + 14, 0.35); c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(1, 0); c.lineTo(L * 0.85, 0); c.stroke();
      c.restore();
    }
  });
  c.restore();
}

/** Nadelzweig: Ast von links (Stamm) nach rechts (Spitze), Seitenzweige dicht mit Nadeln besetzt */
function paintNadel(c: CanvasRenderingContext2D, R: Rect, r: () => number) {
  c.save(); c.translate(R.x, R.y);
  const H = R.h / 2;
  const stem = (u: number): [number, number] => [5 + u * (R.w - 12), H - Math.sin(u * Math.PI) * 5];
  /** halbe Breite des Zweigs an der Stelle u (vorn breit, zur Spitze schmal) */
  const env = (u: number) => (H - 6) * Math.pow(Math.sin(Math.PI * (0.12 + 0.88 * u)), 0.65) * (1.08 - 0.45 * u);
  c.lineCap = 'round';
  const needle = (x: number, y: number, ang: number, len: number, light: number) => {
    c.strokeStyle = hsl(112 + r() * 26, 28 + r() * 18, light);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); c.stroke();
  };
  const twigs: { x: number; y: number; dx: number; dy: number; len: number }[] = [];
  for (let u = 0.03; u < 0.96; u += 0.042) for (const side of [-1, 1]) {
    const [x, y] = stem(u + (r() - 0.5) * 0.015);
    const th = 0.8 + r() * 0.35;
    if (r() < 0.12) continue; // Lücken: zerzauster Rand
    const len = Math.min(env(u) / Math.sin(th), (R.w - 6 - x) / Math.max(0.2, Math.cos(th))) * (0.55 + r() * 0.45);
    twigs.push({ x, y, dx: Math.cos(th), dy: side * Math.sin(th), len });
  }
  // Nadeln in zwei Lagen: erst dunkle (innen, Schatten), dann hellere obenauf
  for (const pass of [0, 1]) {
    c.lineWidth = pass ? 1.15 : 1.5;
    for (const t of twigs) {
      for (let s = 2; s < t.len; s += pass ? 3.2 : 2.4) {
        const x = t.x + t.dx * s, y = t.y + t.dy * s;
        const base = Math.atan2(t.dy, t.dx);
        const f = s / t.len;
        const len = 5 + r() * 4 * (1 - f * 0.4);
        // innen dunkel, zu den Zweigspitzen heller (junge Triebe)
        const light = pass ? 16 + f * 20 + r() * 8 : 8 + f * 8 + r() * 6;
        needle(x, y, base + 0.85 + (r() - 0.5) * 0.3, len, light);
        needle(x, y, base - 0.85 + (r() - 0.5) * 0.3, len, light);
      }
    }
    // Nadeln am Hauptast
    for (let u = 0.02; u < 0.97; u += 0.012) {
      const [x, y] = stem(u);
      const light = pass ? 16 + r() * 8 : 8 + r() * 6;
      needle(x, y, -0.9 - r() * 0.4, 7 + r() * 3, light);
      needle(x, y, 0.9 + r() * 0.4, 7 + r() * 3, light);
    }
  }
  // Zweige und Ast (dünn, nur zwischen den Nadeln sichtbar)
  c.strokeStyle = hsl(24, 30, 20, 0.85);
  for (const t of twigs) { c.lineWidth = 1.1; c.beginPath(); c.moveTo(t.x, t.y); c.lineTo(t.x + t.dx * t.len * 0.8, t.y + t.dy * t.len * 0.8); c.stroke(); }
  c.beginPath(); c.lineWidth = 2.6;
  for (let u = 0; u <= 0.9; u += 0.05) { const [x, y] = stem(u); if (u === 0) c.moveTo(x, y); else c.lineTo(x, y); }
  c.stroke();
  c.restore();
}

/** Palmwedel: Mittelrippe von links (Stamm) nach rechts (Spitze), beidseitig lange, schmale Fiederblätter */
function paintWedel(c: CanvasRenderingContext2D, R: Rect, r: () => number) {
  c.save(); c.translate(R.x, R.y);
  const H = R.h / 2;
  const rach = (u: number): [number, number] => [6 + u * (R.w - 14), H + Math.sin(u * Math.PI) * 2];
  for (let u = 0.035; u < 0.975; u += 0.0095) for (const side of [-1, 1]) {
    if (r() < 0.07) continue; // hier und da eine Lücke (zerzauster Wedel)
    const [x, y] = rach(u + (r() - 0.5) * 0.004);
    const th = 0.78 + r() * 0.22 + u * 0.15;
    const len = (H - 5) / Math.sin(th) * Math.pow(Math.sin(Math.PI * (0.05 + 0.95 * u)), 0.5) * (0.82 + r() * 0.18);
    const dx = Math.cos(th), dy = side * Math.sin(th);
    const tx = x + dx * len, ty = y + dy * len;
    // leicht nach hinten gebogen
    const mx = x + dx * len * 0.5 - dy * side * len * 0.06, my = y + dy * len * 0.5 + dx * side * len * 0.06;
    const w = 2.2 + r() * 1.4;
    const brown = r() < 0.08;
    const hue = brown ? 42 : 78 + r() * 22, sat = brown ? 32 : 36 + r() * 20, lig = brown ? 34 + r() * 8 : 21 + r() * 16;
    c.fillStyle = hsl(hue, sat, lig);
    c.beginPath();
    c.moveTo(x - dy * w, y + dx * w);
    c.quadraticCurveTo(mx - dy * w * 0.8, my + dx * w * 0.8, tx, ty);
    c.quadraticCurveTo(mx + dy * w * 0.8, my - dx * w * 0.8, x + dy * w, y - dx * w);
    c.closePath(); c.fill();
    c.strokeStyle = hsl(hue, sat - 8, lig + 12, 0.5); c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx, my, tx, ty); c.stroke();
  }
  // Mittelrippe, zur Spitze dünner
  c.lineCap = 'round';
  for (let u = 0; u < 0.97; u += 0.02) {
    const [x0, y0] = rach(u), [x1, y1] = rach(u + 0.02);
    c.strokeStyle = hsl(72, 32, 33 - u * 6); c.lineWidth = 4 * (1 - u) + 1;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  }
  c.restore();
}

/** Baumrinde: graubraun mit senkrechten Furchen und hellen Graten (waagerecht nahtlos) */
function paintRinde(c: CanvasRenderingContext2D, R: Rect, r: () => number) {
  c.save(); c.translate(R.x, R.y);
  c.beginPath(); c.rect(0, 0, R.w, R.h); c.clip();
  c.fillStyle = hsl(28, 16, 34); c.fillRect(0, 0, R.w, R.h);
  for (let i = 0; i < 500; i++) {
    c.fillStyle = r() < 0.5 ? hsl(28, 18, 18 + r() * 10, 0.25) : hsl(32, 12, 46 + r() * 12, 0.18);
    c.fillRect(r() * R.w, r() * R.h, 2 + r() * 6, 1 + r() * 3);
  }
  const furrow = (color: string, width: number, x0: number, seed: number) => {
    c.strokeStyle = color; c.lineWidth = width;
    for (const off of [-R.w, 0, R.w]) {
      c.beginPath();
      for (let y = -2; y <= R.h + 2; y += 3) {
        const x = x0 + off + Math.sin(y * 0.13 + seed) * 2.2 + Math.sin(y * 0.41 + seed * 3) * 0.9;
        if (y === -2) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
  };
  for (let i = 0; i < 30; i++) furrow(hsl(24, 26, 9 + r() * 6, 0.8), 1.6 + r() * 2.6, r() * R.w, r() * 10);
  for (let i = 0; i < 26; i++) furrow(hsl(34, 12, 52 + r() * 12, 0.32), 0.9 + r() * 0.8, r() * R.w, r() * 10);
  for (let i = 0; i < 40; i++) { c.fillStyle = hsl(24, 26, 12, 0.6); c.fillRect(r() * R.w, r() * R.h, 3 + r() * 5, 1); }
  c.restore();
}

/** Palmstamm: dicht geringelt (Blattnarben), dazwischen Fasern */
function paintPalmrinde(c: CanvasRenderingContext2D, R: Rect, r: () => number) {
  c.save(); c.translate(R.x, R.y);
  c.beginPath(); c.rect(0, 0, R.w, R.h); c.clip();
  c.fillStyle = hsl(34, 16, 40); c.fillRect(0, 0, R.w, R.h);
  for (let i = 0; i < 360; i++) { c.fillStyle = hsl(30, 18, 26 + r() * 22, 0.3); c.fillRect(r() * R.w, r() * R.h, 1, 2 + r() * 3); }
  for (let y = 1; y < R.h; y += 4 + r() * 1.5) {
    c.fillStyle = hsl(28, 24, 17, 0.8); c.fillRect(0, y, R.w, 1.4);
    c.fillStyle = hsl(38, 18, 58, 0.45); c.fillRect(0, y + 1.4, R.w, 1);
    for (let x = 0; x < R.w; x += 5 + r() * 6) { c.fillStyle = hsl(28, 22, 20, 0.5); c.fillRect(x, y - 1, 1.2, 2.2); }
  }
  c.restore();
}

let atlasTex: THREE.DataTexture | null = null;

/**
 * Das gemeinsame Bild aller Bäume (einmal gemalt, von allen Bäumen geteilt).
 * Unsichtbare Punkte bekommen die mittlere Farbe ihres Bereichs – sonst entstehen in der Ferne
 * (verkleinerte Bildstufen) dunkle Ränder um die Blätter.
 */
export function treeAtlas(): THREE.DataTexture {
  if (atlasTex) return atlasTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = ATLAS;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  const r = rng(1602);
  paintLaub(c, REG.laub, r);
  paintNadel(c, REG.nadel, r);
  paintWedel(c, REG.wedel, r);
  paintRinde(c, REG.rinde, r);
  paintPalmrinde(c, REG.palmrinde, r);
  const img = c.getImageData(0, 0, ATLAS, ATLAS);
  const d = img.data;
  for (const R of Object.values(REG)) {
    let sr = 0, sg = 0, sb = 0, n = 0;
    for (let y = R.y; y < R.y + R.h; y++) for (let x = R.x; x < R.x + R.w; x++) {
      const i = (y * ATLAS + x) * 4;
      if (d[i + 3] > 200) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++; }
    }
    if (!n) continue;
    sr /= n; sg /= n; sb /= n;
    for (let y = R.y; y < R.y + R.h; y++) for (let x = R.x; x < R.x + R.w; x++) {
      const i = (y * ATLAS + x) * 4;
      const a = d[i + 3] / 255;
      if (a < 0.98) { d[i] = d[i] * a + sr * (1 - a); d[i + 1] = d[i + 1] * a + sg * (1 - a); d[i + 2] = d[i + 2] * a + sb * (1 - a); }
    }
  }
  const tex = new THREE.DataTexture(new Uint8Array(d.buffer.slice(0)), ATLAS, ATLAS, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  atlasTex = tex;
  return tex;
}

/** Bildkoordinaten im gemeinsamen Bild: s = 0..1 nach rechts, t = 0..1 nach unten im Bereich */
function uvIn(R: Rect, s: number, t: number): [number, number] {
  const e = 1.5; // Rand in Bildpunkten gegen Ausfransen in die Nachbarbereiche
  return [(R.x + e + s * (R.w - 2 * e)) / ATLAS, (R.y + e + t * (R.h - 2 * e)) / ATLAS];
}

// ---------------------------------------------------------------------------------------------
// Formen bauen
// ---------------------------------------------------------------------------------------------

const V3 = THREE.Vector3;
type Col = [number, number, number];

/** sammelt Ecken (Lage, Licht-Richtung, Bildkoordinate, Farbe, Windstärke) und Dreiecke */
class Builder {
  p: number[] = []; n: number[] = []; uv: number[] = []; c: number[] = []; w: number[] = []; idx: number[] = [];
  vert(p: THREE.Vector3, n: THREE.Vector3, uv: [number, number], col: Col, ao: number, wind: number) {
    this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.uv.push(uv[0], uv[1]);
    this.c.push(col[0] * ao, col[1] * ao, col[2] * ao); this.w.push(wind);
    return this.p.length / 3 - 1;
  }
  quad(a: number, b: number, c: number, d: number) { this.idx.push(a, b, c, a, c, d); }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aWind', new THREE.Float32BufferAttribute(this.w, 1));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * Runder Ast/Stamm entlang eines Pfades: radial Ecken rundherum, rings Abschnitte entlang.
 * Rinde läuft einmal rundherum; vt0..vt1 = welcher Teil der Rinde (der Länge nach) benutzt wird.
 */
function tube(b: Builder, path: (t: number) => THREE.Vector3, radius: (t: number) => number, radial: number, rings: number,
  R: Rect, vt0: number, vt1: number, col: Col, ao: (t: number) => number) {
  const T = new V3(), N = new V3(), Bn = new V3(), ref = new V3(), q = new V3(), nn = new V3();
  const rows: number[][] = [];
  const rot = 0.37; // Naht der Rinde nicht genau vorn
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const p = path(t);
    T.copy(path(Math.min(1, t + 0.01))).sub(path(Math.max(0, t - 0.01))).normalize();
    ref.set(0, 1, 0); if (Math.abs(T.y) > 0.9) ref.set(1, 0, 0);
    N.crossVectors(T, ref).normalize(); Bn.crossVectors(T, N).normalize();
    const rr = radius(t), row: number[] = [];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2 + rot;
      nn.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(Bn, Math.sin(a));
      q.copy(p).addScaledVector(nn, rr);
      row.push(b.vert(q, nn, uvIn(R, j / radial, vt0 + (vt1 - vt0) * t), col, ao(t), 0));
    }
    rows.push(row);
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < radial; j++) b.quad(rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]);
}

/**
 * Bildfläche aus einem Raster: pos(s, t) gibt die Lage, nrm(p) die Licht-Richtung, shade(p, s, t) die Helligkeit.
 * s/t laufen 0..1 über den Bildbereich R.
 */
function sheet(b: Builder, ns: number, nt: number, pos: (s: number, t: number) => THREE.Vector3, R: Rect,
  nrm: (p: THREE.Vector3, s: number, t: number) => THREE.Vector3, col: Col, shade: (p: THREE.Vector3, s: number, t: number) => number,
  wind: (s: number, t: number) => number) {
  const rows: number[][] = [];
  for (let j = 0; j <= nt; j++) {
    const row: number[] = [];
    for (let i = 0; i <= ns; i++) {
      const s = i / ns, t = j / nt, p = pos(s, t);
      row.push(b.vert(p, nrm(p, s, t), uvIn(R, s, t), col, shade(p, s, t), wind(s, t)));
    }
    rows.push(row);
  }
  for (let j = 0; j < nt; j++) for (let i = 0; i < ns; i++) b.quad(rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]);
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** zufällige Richtung auf der Kugel, nach oben verschoben (Kronen sind oben voller) */
function dirOn(r: () => number, up: number) {
  const z = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - z * z);
  return new V3(s * Math.cos(a), z, s * Math.sin(a)).add(new V3(0, up, 0)).normalize();
}
/** zwei Richtungen senkrecht zu n */
function basis(n: THREE.Vector3, roll: number): [THREE.Vector3, THREE.Vector3] {
  const ref = Math.abs(n.y) < 0.9 ? new V3(0, 1, 0) : new V3(1, 0, 0);
  const a = new V3().crossVectors(n, ref).normalize();
  const c = new V3().crossVectors(n, a).normalize();
  const ca = Math.cos(roll), sa = Math.sin(roll);
  return [a.clone().multiplyScalar(ca).addScaledVector(c, sa), c.clone().multiplyScalar(ca).addScaledVector(a, -sa)];
}

/** Detailstufe: 0 = nah (schön), 1 = mittel, 2 = halbe Dichte (weiter weg), 3 = fern */
export type Lod = 0 | 1 | 2 | 3;

const BARK_LAUB: Col = [0.92, 0.9, 0.86];
const BARK_NADEL: Col = [1.0, 0.82, 0.72];

/** Laubbaum: Stamm mit Wurzelansatz, sichtbare Äste, Krone aus mehreren runden Teilkronen voller Blattbüschel */
export function laubbaum(seed: number, lod: Lod): THREE.BufferGeometry {
  const r = rng(seed * 7 + 11);
  const b = new Builder();
  const C = new V3(0, 0.68, 0), RX = 0.36, RY = 0.3;
  const lean = new V3((r() - 0.5) * 0.08, 0, (r() - 0.5) * 0.08);
  // Teilkronen (machen die Krone unregelmäßig rund statt kugelig)
  const lobes: { c: THREE.Vector3; r: number }[] = [{ c: C.clone().add(new V3(0, 0.06, 0)), r: 0.24 }];
  const nl = 5;
  for (let i = 0; i < nl; i++) {
    const a = (i / nl) * Math.PI * 2 + r() * 0.8;
    lobes.push({ c: new V3(Math.cos(a) * RX * 0.55, C.y - 0.04 + (r() - 0.3) * 0.16, Math.sin(a) * RX * 0.55).add(lean), r: 0.17 + r() * 0.06 });
  }
  const top = 0.5;
  if (lod < 3) {
    const path = (t: number) => new V3(lean.x * t * 1.3 + Math.sin(t * 3 + seed) * 0.012, -0.06 + t * (top + 0.06), lean.z * t * 1.3);
    const rad = (t: number) => (0.05 - 0.022 * t) * (1 + 0.7 * Math.pow(Math.max(0, 1 - t / 0.16), 2));
    tube(b, path, rad, [8, 6, 4, 0][lod], [5, 2, 1, 0][lod], REG.rinde, 0.05, 0.95, BARK_LAUB, (t) => 0.55 + 0.4 * t);
    // Äste vom Stamm in die Teilkronen
    const nb = [5, 3, 0, 0][lod];
    for (let i = 0; i < nb; i++) {
      const L = lobes[1 + (i % nl)];
      const p0 = path(0.62 + r() * 0.3), p1 = L.c.clone().lerp(p0, 0.3);
      const mid = p0.clone().lerp(p1, 0.5).add(new V3(0, 0.05, 0));
      const bp = (t: number) => { const a = p0.clone().lerp(mid, t), c = mid.clone().lerp(p1, t); return a.lerp(c, t); };
      tube(b, bp, (t) => 0.02 - 0.012 * t, lod === 0 ? 5 : 4, lod === 0 ? 2 : 1, REG.rinde, 0.1, 0.5, BARK_LAUB, () => 0.6);
    }
  }
  // Blattbüschel: die meisten liegen als „Haut“ außen auf der Krone (schauen nach außen), einige gekreuzt im Inneren
  const shell = [54, 24, 15, 10][lod];
  const inner = [8, 3, 0, 0][lod];
  const size = [0.27, 0.36, 0.43, 0.54][lod];
  const sphN = (p: THREE.Vector3) => new V3((p.x - C.x) / RX, (p.y - C.y) / RY * 0.8 + 0.35, (p.z - C.z) / RX).normalize();
  const card = (pc: THREE.Vector3, u: THREE.Vector3, v: THREE.Vector3, fn: THREE.Vector3, sz: number) => {
    const lum = 0.82 + r() * 0.26;
    const tint: Col = [lum * (0.95 + r() * 0.1), lum * (0.97 + r() * 0.06), lum * (0.92 + r() * 0.1)];
    sheet(b, 1, 1, (s, t) => pc.clone().addScaledVector(u, (s - 0.5) * sz).addScaledVector(v, (t - 0.5) * sz), REG.laub,
      (p) => {
        const sn = sphN(p);
        const g = fn.dot(sn) < 0 ? fn.clone().negate() : fn.clone();
        return sn.multiplyScalar(0.8).addScaledVector(g, 0.2).normalize();
      }, tint,
      (p) => {
        const q = Math.hypot((p.x - C.x) / RX, (p.y - C.y) / RY, (p.z - C.z) / RX);
        const h = smooth(C.y - RY * 1.2, C.y + RY, p.y);
        return (0.32 + 0.72 * smooth(0.25, 1.05, q)) * (0.6 + 0.48 * h);
      }, () => 1);
  };
  for (let i = 0; i < shell; i++) {
    // gleichmäßig verteilt (Fibonacci-Kugel), dann der passenden Teilkrone zugeordnet
    const y = 1 - ((i + 0.5) / shell) * 1.75, rr = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.39996 + seed;
    const d = new V3(Math.cos(a) * rr, y, Math.sin(a) * rr);
    let L = lobes[0], best = -1e9;
    for (const l of lobes) { const sc = l.c.clone().sub(C).normalize().dot(d) + l.r; if (sc > best) { best = sc; L = l; } }
    const pc = L.c.clone().addScaledVector(d, L.r * (0.78 + r() * 0.3)).add(C.clone().sub(L.c).multiplyScalar(0.12));
    const n0 = d.clone().add(dirOn(r, 0).multiplyScalar(0.55)).normalize();
    const [ax, ay] = basis(n0, r() * Math.PI * 2);
    card(pc, ax, ay, n0, size * (0.85 + r() * 0.3));
  }
  for (let i = 0; i < inner; i++) {
    const L = lobes[1 + (i % nl)];
    const pc = L.c.clone().addScaledVector(dirOn(r, 0.2), L.r * 0.4 * r());
    const n0 = dirOn(r, 0);
    const [ax, ay] = basis(n0, r() * Math.PI * 2);
    const sz = size * 1.1;
    card(pc, ax, ay, n0, sz);
    card(pc, n0, ay, ax, sz);
  }
  return b.build();
}

/** Nadelbaum: durchgehender Stamm, Astquirle mit hängenden Nadelzweigen, unten breit, oben spitz */
export function nadelbaum(seed: number, lod: Lod): THREE.BufferGeometry {
  const r = rng(seed * 13 + 5);
  const b = new Builder();
  const Ht = 1.08;
  const radial = [7, 5, 4, 3][lod];
  // Stamm endet unter der Spitze (oben verdecken ihn die Zweige); fern unsichtbar, also weggelassen
  if (lod < 3) tube(b, (t) => new V3(Math.sin(t * 2 + seed) * 0.008, -0.06 + t * (Ht * 0.8 + 0.06), 0), (t) => 0.046 * (1 - t) + 0.005 + 0.03 * Math.pow(Math.max(0, 1 - t / 0.08), 2),
    radial, lod === 0 ? 3 : 1, REG.rinde, 0.02, 0.98, BARK_NADEL, (t) => 0.5 + 0.4 * t);
  const levels = [9, 7, 5, 3][lod];
  const y0 = 0.2, y1 = 0.97;
  for (let i = 0; i < levels; i++) {
    const t = i / (levels - 1);
    const y = y0 + (y1 - y0) * Math.pow(t, 0.92);
    const L = 0.44 * Math.pow(1 - t, 0.9) + 0.08;
    const cnt = lod === 0 ? (t > 0.75 ? 5 : 6) : lod === 1 ? (t > 0.7 ? 4 : 5) : lod === 2 ? 5 : 4;
    const off = i * 1.1 + r() * 0.6;
    for (let k = 0; k < cnt; k++) {
      const a = off + (k / cnt) * Math.PI * 2 + (r() - 0.5) * 0.5;
      const hd = new V3(Math.cos(a), 0, Math.sin(a));
      const side = new V3(-hd.z, 0, hd.x);
      const lk = L * (0.85 + r() * 0.3);
      const droop = 0.12 + 0.3 * (1 - t) + r() * 0.08;
      const W = Math.max(0.14, lk * [0.92, 0.95, 1.05, 1.2][lod]);
      const roll = (r() - 0.5) * 0.5;
      const root = new V3(0, y + (r() - 0.5) * 0.03, 0).addScaledVector(hd, 0.015);
      const spine = (s: number) => root.clone().addScaledVector(hd, lk * s).add(new V3(0, -lk * (droop * s + 0.35 * s * s) + lk * 0.12 * s, 0));
      const across = lod === 0 ? 2 : 1;
      sheet(b, lod >= 2 ? 1 : 2, across, (s, tt) => {
        const c = (tt - 0.5) * 2; // −1 … 1 quer
        const p = spine(s);
        // quer leicht nach unten hängend (V-Form), um die Längsachse etwas gedreht
        const sv = side.clone().multiplyScalar(Math.cos(roll)).add(new V3(0, Math.sin(roll), 0));
        return p.addScaledVector(sv, c * W * 0.5).add(new V3(0, -Math.abs(c) * W * 0.22 * (0.4 + s), 0));
      }, REG.nadel, (p) => {
        const rh = new V3(p.x, 0, p.z); const len = rh.length();
        if (len > 1e-4) rh.multiplyScalar(1 / len);
        return rh.multiplyScalar(0.75).add(new V3(0, 0.75, 0)).normalize();
      }, [0.95 + r() * 0.1, 0.95 + r() * 0.1, 0.95 + r() * 0.1], (p, s) => (0.32 + 0.74 * Math.pow(s, 0.8)) * (0.62 + 0.44 * t),
      (s) => s);
    }
  }
  // Spitze: zwei gekreuzte, aufrechte Zweige
  if (lod < 3) {
    for (let k = 0; k < (lod < 2 ? 2 : 1); k++) {
      const a = k * Math.PI / 2 + r();
      const side = new V3(Math.cos(a), 0, Math.sin(a));
      sheet(b, 1, 1, (s, tt) => new V3(0, 0.86 + s * 0.24, 0).addScaledVector(side, (tt - 0.5) * 0.17), REG.nadel,
        (p) => new V3(side.z, 0.8, -side.x).normalize(), [1, 1, 1], (p, s) => 0.7 + 0.35 * s, (s) => s);
    }
  }
  return b.build();
}

/** Palme: gebogener, geringelter Stamm, Krone aus gefiederten, überhängenden Wedeln, Kokosnüsse */
export function palme(seed: number, lod: Lod): THREE.BufferGeometry {
  const r = rng(seed * 17 + 3);
  const b = new Builder();
  const la = r() * Math.PI * 2, bend = 0.16 + r() * 0.12;
  const ld = new V3(Math.cos(la), 0, Math.sin(la));
  const Hp = 1.12;
  const path = (t: number) => new V3(0, -0.06 + t * (Hp + 0.06), 0).addScaledVector(ld, bend * t * t);
  const radius = (t: number) => 0.036 + 0.012 * (1 - t) + 0.035 * Math.pow(Math.max(0, 1 - t / 0.12), 2);
  tube(b, path, radius, [8, 6, 4, 3][lod], [9, 4, 2, 1][lod], REG.palmrinde, 0.02, 0.98, [1, 1, 1], (t) => 0.62 + 0.38 * t);
  const T = path(1);
  // Wedel
  const nf = [15, 10, 8, 6][lod];
  const segs = [5, 3, 2, 2][lod];
  for (let i = 0; i < nf; i++) {
    const young = lod === 0 && i >= nf - 3;
    const az = (i / (young ? 3 : nf - (lod === 0 ? 3 : 0))) * Math.PI * 2 + r() * 0.5 + (young ? 0.5 : 0);
    const hd = new V3(Math.cos(az), 0, Math.sin(az));
    const side = new V3(-hd.z, 0, hd.x);
    const el = young ? 1.0 + r() * 0.25 : 0.12 + r() * 0.45;
    const Lf = young ? 0.3 + r() * 0.06 : 0.46 + r() * 0.12;
    const sag = young ? 0.25 : 1.05 + r() * 0.5;
    // Breite passend zum Bild (Wedel ~3½-mal so lang wie breit), mittlere/ferne Stufe etwas breiter
    const hw = Lf * (lod === 0 ? 0.19 : 0.22);
    const fold = 0.38 + r() * 0.15;
    const base = T.clone().add(new V3(0, 0.02, 0));
    const spine = (s: number) => base.clone().addScaledVector(hd, Lf * Math.cos(el) * s).add(new V3(0, Lf * Math.sin(el) * s - Lf * sag * s * s * 0.75, 0));
    const across = lod >= 2 ? 1 : 2;
    const twist = (r() - 0.5) * 0.5;
    sheet(b, segs, across, (s, tt) => {
      const c = (tt - 0.5) * 2;
      const w = hw * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, 0.12 + s * 0.95)));
      const sv = side.clone().multiplyScalar(Math.cos(twist * s)).add(new V3(0, Math.sin(twist * s), 0));
      return spine(s).addScaledVector(sv, c * w).add(new V3(0, -Math.abs(c) * w * fold, 0));
    }, REG.wedel, () => hd.clone().multiplyScalar(0.35).add(new V3(0, 1, 0)).normalize(),
      [0.95 + r() * 0.1, 0.95 + r() * 0.1, 0.9 + r() * 0.1], (p, s) => 0.55 + 0.5 * Math.pow(s, 0.6), (s) => s * 1.4);
  }
  // Kokosnüsse
  if (lod === 0) {
    for (let k = 0; k < 3; k++) {
      const a = la + k * 2.1 + r() * 0.4;
      const c = T.clone().add(new V3(Math.cos(a) * 0.045, -0.035, Math.sin(a) * 0.045));
      const ico = new THREE.IcosahedronGeometry(0.032, 0);
      const pp = ico.attributes.position;
      const base = b.p.length / 3;
      for (let v = 0; v < pp.count; v++) {
        const n = new V3(pp.getX(v), pp.getY(v), pp.getZ(v)).normalize();
        b.vert(c.clone().addScaledVector(n, 0.032), n, uvIn(REG.palmrinde, 0.2 + k * 0.2, 0.5), [0.55, 0.5, 0.28], 0.8, 0);
      }
      const ix = ico.index;
      if (ix) for (let v = 0; v < ix.count; v++) b.idx.push(base + ix.getX(v));
      else for (let v = 0; v < pp.count; v++) b.idx.push(base + v);
      ico.dispose();
    }
  }
  return b.build();
}

// ---------------------------------------------------------------------------------------------
// Material: Wind, Blätter auch in der Ferne dicht, Licht auf beiden Seiten der Blattflächen
// ---------------------------------------------------------------------------------------------

/** Wind im Ecken-Teil: ganzer Baum wiegt (oben stärker), Blätter zittern leicht */
function windVertex(sh: { vertexShader: string; uniforms: Record<string, THREE.IUniform> }, wind: THREE.IUniform, strength: number) {
  sh.uniforms.uWind = wind;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>
uniform float uWind;
attribute float aWind;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  vec3 ip = vec3(0.0);
  #ifdef USE_INSTANCING
  ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
  #endif
  float ph = ip.x * 0.35 + ip.z * 0.27;
  float sway = sin(uWind * 1.7 + ph) * 0.6 + sin(uWind * 3.1 + ip.x * 0.9) * 0.4;
  float h = max(0.0, position.y);
  float k = h * h * ${strength.toFixed(3)};
  transformed.x += sway * k;
  transformed.z += sway * k * 0.5;
  float fl = sin(uWind * 5.3 + dot(position, vec3(31.0, 23.0, 37.0)) + ph * 4.0);
  transformed += vec3(0.6, 0.8, 0.45) * fl * 0.011 * aWind;
}`);
}

/** in der Ferne (verkleinerte Bildstufen) Blätter nicht ausdünnen lassen */
const ALPHA_KEEP = `#include <map_fragment>
#ifdef USE_MAP
{
  vec2 tx = vMapUv * ${ATLAS.toFixed(1)};
  vec2 dx = dFdx(tx), dy = dFdy(tx);
  float lod = 0.5 * log2(max(dot(dx, dx), dot(dy, dy)));
  diffuseColor.a *= 1.0 + max(lod, 0.0) * 0.32;
}
#endif`;

// ---------------------------------------------------------------------------------------------
// Bauplatz freiräumen: beim Platzieren eines Gebäudes sieht man genau, wo es steht
// ---------------------------------------------------------------------------------------------

/**
 * Werte für die Bau-Vorschau, gemeinsam für alle Bäume (und das Gras):
 * - uClearBox: Grundfläche (x0, z0, x1, z1 in Weltmaßen). Bäume, die darauf stehen, werden nicht gezeichnet
 *   (beim echten Bau werden sie ohnehin gefällt). Aus, wenn x1 < x0.
 * - uClearFocus: Mitte der Vorschau (x, y, z) und ihr Radius (w, 0 = aus). Bäume, die von der Kamera aus
 *   davor stehen, werden ganz ausgeblendet; am Rand dieses schmalen Streifens werden sie stufenlos kleiner
 *   (wie junge Bäume), Bäume dicht am Rand der Grundfläche nur etwas kleiner.
 *   Früher wurden sie mit einem Punktmuster „halb durchsichtig“ gemacht – das sah nah körnig aus und
 *   flimmerte beim Verschieben, besonders bei niedriger Auflösung. Ausblenden ist ruhig, scharf und
 *   sogar schneller (kein Wegschneiden einzelner Bildpunkte).
 * Es werden nur diese zwei Werte geändert – die Bäume selbst bleiben unverändert (kein Neuaufbau, flüssig).
 */
export const placeClear = {
  uClearBox: { value: new THREE.Vector4(0, 0, -1, -1) },
  uClearFocus: { value: new THREE.Vector4(0, 0, 0, 0) },
  /** Blick der Spielkamera (für den Schattenwurf: ausgeblendete Bäume werfen auch keinen Schatten); setzt placehelp.ts */
  uClearVP: { value: new THREE.Matrix4() },
  uClearPS: { value: new THREE.Vector2(1, 1) },
};

/**
 * Ecken-Teil: Baum auf der Grundfläche verschwinden lassen, Bäume vor der Vorschau ausblenden.
 * shadow = Schattenbild: dort ist die „Kamera“ die Sonne, der Blick der Spielkamera kommt aus uClearVP.
 */
function clearVertex(sh: { vertexShader: string; uniforms: Record<string, THREE.IUniform> }, shadow: boolean) {
  sh.uniforms.uClearBox = placeClear.uClearBox;
  sh.uniforms.uClearFocus = placeClear.uClearFocus;
  sh.uniforms.uClearVP = placeClear.uClearVP;
  sh.uniforms.uClearPS = placeClear.uClearPS;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>
uniform vec4 uClearBox;
uniform vec4 uClearFocus;
uniform mat4 uClearVP;
uniform vec2 uClearPS;`)
    .replace('#include <project_vertex>', `{
  mat4 cm = modelMatrix;
  #ifdef USE_INSTANCING
  cm = modelMatrix * instanceMatrix;
  #endif
  vec3 org = cm[3].xyz;
  float inBox = step(uClearBox.x, org.x) * step(org.x, uClearBox.z) * step(uClearBox.y, org.z) * step(org.z, uClearBox.w);
  float keep = 1.0 - inBox;
  if (uClearFocus.w > 0.0 && inBox < 0.5) {
    // Baum als senkrechte Linie (Fuß bis Spitze) auf dem Bild; Abstand zur Mitte der Vorschau,
    // umgerechnet in Weltmaß auf Höhe der Vorschau
    float ht = length(cm[1].xyz);
    ${shadow ? 'mat4 pv = uClearVP; vec2 ps = uClearPS;' : 'mat4 pv = projectionMatrix * viewMatrix; vec2 ps = vec2(projectionMatrix[0][0], projectionMatrix[1][1]);'}
    vec4 cg = pv * vec4(uClearFocus.xyz, 1.0);
    vec4 c0 = pv * vec4(org, 1.0);
    vec4 c1 = pv * vec4(org + vec3(0.0, ht, 0.0), 1.0);
    vec2 sc = vec2(cg.w / ps.x, cg.w / ps.y);
    vec2 g = cg.xy / cg.w * sc, a = c0.xy / c0.w * sc, b = c1.xy / c1.w * sc;
    vec2 ab = b - a;
    float t = clamp(dot(g - a, ab) / max(dot(ab, ab), 1e-5), 0.0, 1.0);
    float d = length(g - (a + ab * t)) - ht * 0.28;
    // nur Bäume vor der Vorschau (näher an der Kamera) …
    float before = step(c0.w, cg.w + 0.6);
    float line = (1.0 - smoothstep(uClearFocus.w, uClearFocus.w + 1.2, d)) * before;
    // … und Bäume direkt am Rand der Grundfläche (nur kleiner, damit sie nicht über den Rahmen ragen)
    vec2 q = max(vec2(uClearBox.x, uClearBox.y) - org.xz, org.xz - vec2(uClearBox.z, uClearBox.w));
    float edge = 1.0 - smoothstep(0.0, 1.2, max(q.x, q.y));
    keep *= 1.0 - max(line, edge * 0.5);
  }
  // zum Fuß hin schrumpfen (wie ein junger Baum); ganz weg = gar nicht gezeichnet
  transformed *= keep;
}
#include <project_vertex>`);
}

export function treeMaterials(wind: THREE.IUniform, strength: number, key: string) {
  const map = treeAtlas();
  // gleiche Beleuchtung wie die übrige Welt (auch das weiche Himmelslicht); Blätter matt.
  // Zwischen den Blättern wird einfach weggeschnitten (schnell; sieht sauberer aus als weich gerechnete Ränder)
  const mat = new THREE.MeshStandardMaterial({
    map, vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.5,
  });
  mat.onBeforeCompile = (sh) => {
    windVertex(sh, wind, strength);
    clearVertex(sh, false);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', ALPHA_KEEP)
      // Blattflächen: Rückseite wie Vorderseite beleuchten (Licht-Richtung zeigt immer aus der Krone heraus)
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
  mat.customProgramCacheKey = () => key;
  // Schatten: gleiche Form (Blätter ausgeschnitten), gleicher Wind
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5, side: THREE.DoubleSide });
  depth.onBeforeCompile = (sh) => {
    windVertex(sh, wind, strength);
    clearVertex(sh, true);
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', ALPHA_KEEP);
  };
  depth.customProgramCacheKey = () => key + '-schatten';
  return { mat, depth };
}
