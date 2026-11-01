// Baukasten für detailreiche Gebäude aus Code (Ersatz, bis Meshy-Modelle da sind).
// Quader und Dachflächen behalten harte Kanten, runde Teile werden weich schattiert.
//
// Maßstab: 1 Einheit = 1 Kachel. Ein Gebäude mit Größe s steht mittig auf (0,0,0),
// seine Fläche reicht von -s/2 bis +s/2 in x und z. Boden = y 0. Vorderseite = +z.
// Alles wird am Ende zu EINER Geometrie zusammengefügt (schnell auf dem iPhone).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Oberflächenmuster (werden im Shader gezeichnet, siehe materials.ts) */
export const P = {
  glatt: 0, ziegel: 1, stroh: 2, bretter: 3, mauer: 4, schiefer: 5, pflaster: 6, latten: 7, putz: 8, acker: 9, laub: 10, glas: 11, tuch: 12,
} as const;

export interface Mat { c: number; p: number }
export type Paint = number | Mat;

/** Fertige Materialien (Farbe + Muster). Eigene: { c: 0xrrggbb, p: P.xxx } */
export const M = {
  ziegelRot: { c: 0xb0472f, p: P.ziegel },
  ziegelBraun: { c: 0x8f4a2c, p: P.ziegel },
  stroh: { c: 0xd2ad5f, p: P.stroh },
  strohAlt: { c: 0xb8955a, p: P.stroh },
  schiefer: { c: 0x56637a, p: P.schiefer },
  schindel: { c: 0x7a5a3c, p: P.schiefer },
  bretter: { c: 0xa2733f, p: P.bretter },
  bretterDunkel: { c: 0x7a5432, p: P.bretter },
  latten: { c: 0x8c6238, p: P.latten },
  mauer: { c: 0xbdb5a6, p: P.mauer },
  mauerDunkel: { c: 0x8e877a, p: P.mauer },
  backstein: { c: 0xa65a3c, p: P.mauer },
  putz: { c: 0xf0e6cf, p: P.putz },
  putzGelb: { c: 0xead6a0, p: P.putz },
  putzRosa: { c: 0xe9cfc0, p: P.putz },
  pflaster: { c: 0xcfc3a8, p: P.pflaster },
  wiese: { c: 0x86b84c, p: P.laub },
  laub: { c: 0x4f8f3a, p: P.laub },
  acker: { c: 0x8a6a40, p: P.acker },
  balken: { c: 0x5a3d26, p: P.glatt },
  holz: { c: 0x9a6b3c, p: P.glatt },
  dunkelholz: { c: 0x4e3523, p: P.glatt },
  rahmen: { c: 0xe8dcc0, p: P.glatt },
  rahmenWeiss: { c: 0xf6f4ee, p: P.glatt },
  glas: { c: 0x30455e, p: P.glas },
  sandstein: { c: 0xd9c49a, p: P.mauer },
  sandsteinGlatt: { c: 0xe4d3ad, p: P.glatt },
  backsteinRot: { c: 0x9b4a32, p: P.mauer },
  sockel: { c: 0x8a8274, p: P.mauer },
  ziegelFirst: { c: 0x7e3424, p: P.glatt },
  schieferFirst: { c: 0x3c4556, p: P.glatt },
  blumeRot: { c: 0xc8413a, p: P.glatt },
  blumeGelb: { c: 0xe8c84a, p: P.glatt },
  blumeWeiss: { c: 0xf2efe4, p: P.glatt },
  hecke: { c: 0x3f7a35, p: P.laub },
  eisen: { c: 0x3a3a3e, p: P.glatt },
  gold: { c: 0xe0b23a, p: P.glatt },
  weiss: { c: 0xf4f1ea, p: P.glatt },
  wasser: { c: 0x3a8cc4, p: P.glatt },
  erde: { c: 0x7a5c3e, p: P.glatt },
  stein: { c: 0xa9a294, p: P.glatt },
} satisfies Record<string, Mat>;

/** Lebende Teile, die der Renderer animiert/ergänzt */
export interface ModelDef {
  geo: THREE.BufferGeometry;
  /** Schornstein-Öffnungen (lokale Koordinaten) – dort steigt Rauch auf */
  smoke: [number, number, number][];
  /** Drehende Teile (Mühlenflügel, Wasserrad ...) */
  spinners: { geo: THREE.BufferGeometry; pos: [number, number, number]; axis: 'x' | 'z'; speed: number }[];
  /** Fahnen in Besitzerfarbe (Spitze des Fahnenmasts, lokale Koordinaten) */
  flags?: [number, number, number][];
}

const tmpColor = new THREE.Color();

/** Kegel/Zylinder/Kugeln mit höchstens 4 Ecken sind eckige Körper (Pyramiden-Dach, Pfosten): harte Kanten behalten */
function isFaceted(g: THREE.BufferGeometry): boolean {
  const p = (g as THREE.BufferGeometry & { parameters?: { radialSegments?: number; widthSegments?: number } }).parameters;
  if (!p) return false;
  if (g.type === 'ConeGeometry' || g.type === 'CylinderGeometry') return (p.radialSegments ?? 8) <= 4;
  if (g.type === 'SphereGeometry') return (p.widthSegments ?? 8) <= 4;
  return false;
}

function prepare(g: THREE.BufferGeometry, paint: Paint): THREE.BufferGeometry {
  const faceted = isFaceted(g);
  const geo = g.index ? g.toNonIndexed() : g;
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  if (geo.attributes.uv1) geo.deleteAttribute('uv1');
  // ohne Index ergibt computeVertexNormals je Fläche eine eigene Richtung (harte Kanten);
  // runde Grundformen bringen ihre weichen Normalen von three.js schon mit.
  if (faceted || !geo.attributes.normal) geo.computeVertexNormals();
  const m = typeof paint === 'number' ? { c: paint, p: 0 } : paint;
  tmpColor.setHex(m.c);
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  const pat = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    col[i * 3] = tmpColor.r; col[i * 3 + 1] = tmpColor.g; col[i * 3 + 2] = tmpColor.b;
    pat[i] = m.p;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('pat', new THREE.BufferAttribute(pat, 1));
  return geo;
}

/** Dreiseitiges Prisma (Satteldach) über w (x) mal d (z), First entlang z */
function prismGeo(w: number, h: number, d: number, ridgeShift = 0): THREE.BufferGeometry {
  const hw = w / 2, hd = d / 2;
  const P0 = [-hw, 0, hd], P1 = [hw, 0, hd], P2 = [ridgeShift, h, hd];
  const P3 = [hw, 0, -hd], P4 = [-hw, 0, -hd], P5 = [ridgeShift, h, -hd];
  const pos = [
    ...P0, ...P1, ...P2, ...P3, ...P4, ...P5,
    ...P1, ...P3, ...P5, ...P1, ...P5, ...P2,
    ...P4, ...P0, ...P2, ...P4, ...P2, ...P5,
    ...P0, ...P4, ...P3, ...P0, ...P3, ...P1,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Kegelstumpf mit Rechteck unten (wb x db) und oben (wt x dt), harte Flächen */
function frustumGeo(wb: number, db: number, wt: number, dt: number, h: number): THREE.BufferGeometry {
  const B = [[-wb / 2, 0, db / 2], [wb / 2, 0, db / 2], [wb / 2, 0, -db / 2], [-wb / 2, 0, -db / 2]];
  const T = [[-wt / 2, h, dt / 2], [wt / 2, h, dt / 2], [wt / 2, h, -dt / 2], [-wt / 2, h, -dt / 2]];
  const pos: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  quad(B[0], B[1], T[1], T[0]);
  quad(B[1], B[2], T[2], T[1]);
  quad(B[2], B[3], T[3], T[2]);
  quad(B[3], B[0], T[0], T[3]);
  if (wt > 0 && dt > 0) quad(T[0], T[1], T[2], T[3]);
  quad(B[3], B[2], B[1], B[0]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export class Builder {
  parts: THREE.BufferGeometry[] = [];
  smoke: [number, number, number][] = [];
  spinners: ModelDef['spinners'] = [];
  flags: [number, number, number][] = [];
  /** Verschiebung/Drehung für alle folgenden Teile (für Untergruppen, siehe group()) */
  private stack: THREE.Matrix4[] = [];

  /** Beliebige Geometrie hinzufügen. Position = Mittelpunkt der Geometrie. */
  add(g: THREE.BufferGeometry, paint: Paint, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1): this {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
      new THREE.Vector3(sx, sy, sz),
    );
    for (let i = this.stack.length - 1; i >= 0; i--) m.premultiply(this.stack[i]);
    const geo = prepare(g, paint);
    geo.applyMatrix4(m);
    this.parts.push(geo);
    return this;
  }

  /** Teile in einer verschobenen/gedrehten Untergruppe bauen */
  group(x: number, y: number, z: number, ry: number, fn: (b: this) => void): this {
    this.stack.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1)));
    const before = this.smoke.length, beforeF = this.flags.length;
    fn(this);
    for (let i = beforeF; i < this.flags.length; i++) {
      const v = new THREE.Vector3(...this.flags[i]).applyMatrix4(this.stack[this.stack.length - 1]);
      this.flags[i] = [v.x, v.y, v.z];
    }
    // Rauchpunkte der Untergruppe mittransformieren
    const top = this.stack[this.stack.length - 1];
    for (let i = before; i < this.smoke.length; i++) {
      const v = new THREE.Vector3(...this.smoke[i]).applyMatrix4(top);
      this.smoke[i] = [v.x, v.y, v.z];
    }
    this.stack.pop();
    return this;
  }

  /** Quader; (x,z) = Mitte, y = Unterkante */
  box(w: number, h: number, d: number, paint: Paint, x = 0, y = 0, z = 0, ry = 0): this {
    return this.add(new THREE.BoxGeometry(w, h, d), paint, x, y + h / 2, z, ry);
  }

  /** Satteldach über w (x) mal d (z), First entlang z. y = Traufhöhe. overhang = Überstand. */
  roof(w: number, h: number, d: number, paint: Paint, x = 0, y = 0, z = 0, ry = 0, overhang = 0.08): this {
    const W = w + overhang * 2, D = d + overhang * 2;
    this.add(prismGeo(W, h, D), paint, x, y - 0.02, z, ry);
    return this;
  }

  /** Walmdach (Pyramide/gestreckt) über w x d */
  hipRoof(w: number, h: number, d: number, paint: Paint, x = 0, y = 0, z = 0, ry = 0, overhang = 0.08): this {
    const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
    g.rotateY(Math.PI / 4);
    return this.add(g, paint, x, y + h / 2 - 0.02, z, ry, 0, 0, w + overhang * 2, h, d + overhang * 2);
  }

  /** Pultdach (einseitig geneigt), hohe Seite hinten (-z) */
  shedRoof(w: number, h: number, d: number, paint: Paint, x = 0, y = 0, z = 0, ry = 0): this {
    return this.add(prismGeo(d + 0.12, h, w + 0.12, (d + 0.12) / 2), paint, x, y, z, ry + Math.PI / 2);
  }

  /** Zylinder; y = Unterkante */
  cyl(rTop: number, rBot: number, h: number, seg: number, paint: Paint, x = 0, y = 0, z = 0, rx = 0, rz = 0): this {
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg), paint, x, y + h / 2, z, 0, rx, rz);
  }

  /** Liegender Zylinder entlang x (Baumstamm, Fass liegend) – Mittelpunkt bei (x,y,z) */
  log(r: number, len: number, paint: Paint, x = 0, y = 0, z = 0, ry = 0, seg = 6): this {
    return this.add(new THREE.CylinderGeometry(r, r, len, seg), paint, x, y, z, ry, 0, Math.PI / 2);
  }

  cone(r: number, h: number, seg: number, paint: Paint, x = 0, y = 0, z = 0, ry = 0): this {
    return this.add(new THREE.ConeGeometry(r, h, seg), paint, x, y + h / 2, z, ry);
  }

  sphere(r: number, paint: Paint, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, seg = 6): this {
    return this.add(new THREE.SphereGeometry(r, seg, Math.max(3, seg - 2)), paint, x, y, z, 0, 0, 0, sx, sy, sz);
  }

  // ---------- Fertige Details ----------

  /**
   * Fenster flach an einer Wand. (x,y,z) = Mitte des Fensters auf der Wandfläche,
   * ry = Blickrichtung (0 = nach +z, PI/2 = nach +x, PI = nach -z, -PI/2 = nach -x).
   */
  window(x: number, y: number, z: number, ry = 0, w = 0.18, h = 0.22, shutters: Paint | null = null, frame: Paint = M.rahmen): this {
    return this.group(x, y, z, ry, (b) => {
      b.box(w + 0.05, 0.03, 0.05, frame, 0, -h / 2 - 0.03, 0.01); // Fensterbank
      b.box(w + 0.03, h + 0.03, 0.03, frame, 0, -h / 2 - 0.015, 0.0);
      b.box(w, h, 0.035, M.glas, 0, -h / 2, 0.005);
      b.box(0.015, h, 0.04, frame, 0, -h / 2, 0.01);
      b.box(w, 0.015, 0.04, frame, 0, -0.0075, 0.01);
      if (shutters !== null) {
        b.box(w * 0.5, h + 0.02, 0.02, shutters, -w * 0.78, -h / 2 - 0.01, 0.01);
        b.box(w * 0.5, h + 0.02, 0.02, shutters, w * 0.78, -h / 2 - 0.01, 0.01);
      }
    });
  }

  /** Tür an einer Wand, (x,z) Wandfläche, y = Boden, ry = Blickrichtung */
  door(x: number, y: number, z: number, ry = 0, w = 0.2, h = 0.36, paint: Paint = M.latten): this {
    return this.group(x, y, z, ry, (b) => {
      b.box(w + 0.05, h + 0.03, 0.03, M.balken, 0, 0, 0);
      b.box(w, h, 0.04, paint, 0, 0, 0.005);
      b.box(0.025, 0.025, 0.03, M.gold, w * 0.3, h * 0.48, 0.03);
      b.box(w + 0.1, 0.03, 0.12, M.stein, 0, -0.01, 0.06); // Stufe
    });
  }

  /** Schornstein (mit Rauch). y = Unterkante (meist im Dach versenkt) */
  chimney(x: number, y: number, z: number, h = 0.5, w = 0.14, paint: Paint = M.mauerDunkel, smoke = true): this {
    this.box(w, h, w, paint, x, y, z);
    this.box(w + 0.05, 0.04, w + 0.05, M.mauerDunkel, x, y + h, z);
    if (smoke) this.smoke.push([x, y + h + 0.05, z]);
    return this;
  }

  /** Fachwerk auf eine Wand: Rahmen + senkrechte Ständer + Diagonalen. Wand w breit, h hoch, an (x,y,z) mit Blickrichtung ry */
  timber(w: number, h: number, x: number, y: number, z: number, ry = 0, posts = 3, paint: Paint = M.balken): this {
    return this.group(x, y, z, ry, (b) => {
      const t = 0.035;
      b.box(w, t, 0.02, paint, 0, 0, 0.005);
      b.box(w, t, 0.02, paint, 0, h - t, 0.005);
      b.box(w, t, 0.02, paint, 0, h * 0.5, 0.005);
      for (let i = 0; i <= posts; i++) b.box(t, h, 0.02, paint, -w / 2 + t / 2 + (i * (w - t)) / posts, 0, 0.005);
      // Andreaskreuz-artige Streben in den äußeren Feldern
      const fw = (w - t) / posts;
      const diag = Math.hypot(fw, h * 0.5);
      const ang = Math.atan2(h * 0.5, fw);
      for (const side of [0, posts - 1]) {
        const cx = -w / 2 + t / 2 + fw * (side + 0.5);
        b.add(new THREE.BoxGeometry(diag, t * 0.8, 0.02), paint, cx, h * 0.25, 0.006, 0, 0, side === 0 ? ang : -ang);
      }
    });
  }

  /** Fass stehend */
  barrel(x: number, z: number, y = 0, r = 0.08, h = 0.18): this {
    this.cyl(r * 0.88, r * 0.88, h, 8, M.holz, x, y, z);
    this.cyl(r, r, h * 0.12, 8, M.eisen, x, y + h * 0.18, z);
    this.cyl(r, r, h * 0.12, 8, M.eisen, x, y + h * 0.7, z);
    return this;
  }

  crate(x: number, z: number, y = 0, s = 0.16, ry = 0.3): this {
    this.box(s, s, s, M.latten, x, y, z, ry);
    this.box(s * 1.02, s * 0.12, s * 1.02, M.bretterDunkel, x, y + s * 0.44, z, ry);
    return this;
  }

  sack(x: number, z: number, y = 0, paint: Paint = 0xd8c79a): this {
    this.sphere(0.07, paint, x, y + 0.06, z, 1, 1.2, 0.9);
    this.cyl(0.02, 0.03, 0.04, 5, paint, x, y + 0.13, z);
    return this;
  }

  /** Busch / kleiner Laubbaum */
  bush(x: number, z: number, s = 0.14, paint: Paint = M.laub): this {
    this.sphere(s, paint, x, s * 0.7, z, 1, 0.8, 1);
    this.sphere(s * 0.7, paint, x + s * 0.5, s * 0.5, z + s * 0.3, 1, 0.8, 1);
    return this;
  }

  tree(x: number, z: number, s = 1): this {
    this.cyl(0.035 * s, 0.05 * s, 0.35 * s, 5, M.dunkelholz, x, 0, z);
    this.sphere(0.22 * s, M.laub, x, 0.48 * s, z, 1, 1.1, 1);
    this.sphere(0.15 * s, { c: 0x5c9a40, p: P.laub }, x + 0.08 * s, 0.62 * s, z - 0.05 * s);
    return this;
  }

  /** Zaun entlang einer Linie von (x1,z1) nach (x2,z2) */
  fence(x1: number, z1: number, x2: number, z2: number, h = 0.2, paint: Paint = M.holz): this {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const ang = Math.atan2(-(z2 - z1), x2 - x1);
    const n = Math.max(1, Math.round(len / 0.25));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      // Pfosten reichen in den Boden (am Hang schweben sie nicht)
      this.box(0.035, h + 0.3, 0.035, M.balken, x1 + (x2 - x1) * t, -0.3, z1 + (z2 - z1) * t);
    }
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
    this.add(new THREE.BoxGeometry(len, 0.025, 0.02), paint, mx, h * 0.45, mz, ang);
    this.add(new THREE.BoxGeometry(len, 0.025, 0.02), paint, mx, h * 0.85, mz, ang);
    return this;
  }

  /** Holzstapel (Brennholz) */
  woodpile(x: number, z: number, ry = 0, rows = 3): this {
    return this.group(x, 0, z, ry, (b) => {
      for (let r = 0; r < rows; r++) for (let i = 0; i < 4 - r; i++) b.log(0.04, 0.4, i % 2 ? M.holz : M.bretter, 0, 0.04 + r * 0.07, -0.12 + i * 0.08 + r * 0.04, Math.PI / 2);
    });
  }

  /**
   * Hof: eine sichtbare Fläche gibt es nur noch für echte Höfe (Pflaster, Acker, Bretterboden);
   * sie liegt fast bündig im Gelände. Bei Wiese, Erde oder Stein bleibt das Gelände selbst sichtbar,
   * darunter liegt nur ein Fundament. Fundamente liegen ganz unter y=0 und sind daher nur am Hang zu sehen.
   */
  ground(sx: number, sz: number, paint: Paint, foundation = true): this {
    const p = typeof paint === 'number' ? -1 : paint.p;
    const yard = p === P.pflaster || p === P.acker || p === P.bretter || p === P.latten;
    // Oberkante knapp unter dem Boden: auf ebenem Grund unsichtbar, am Hang trägt es das Gebäude
    if (foundation) this.box(sx * 0.96, 0.7, sz * 0.96, M.sockel, 0, -0.72, 0);
    else if (!yard) this.box(sx * 0.6, 0.45, sz * 0.6, paint, 0, -0.465, 0); // Fuß unter Mauern/Türmen
    if (!yard) return this;
    return this.box(sx * 0.97, 0.04, sz * 0.97, paint, 0, -0.025, 0);
  }

  /** Steinsockel unter einem Baukörper: h sichtbar über dem Boden, depth darunter (nur am Hang sichtbar) */
  plinth(w: number, d: number, x = 0, z = 0, h = 0.07, paint: Paint = M.sockel, depth = 0.7, ry = 0): this {
    this.box(w, h + depth, d, paint, x, -depth, z, ry);
    return this;
  }

  /**
   * Satteldach aus zwei Dachflächen mit Dicke, First entlang z (wie roof()), y = Traufhöhe.
   * Die Giebel bleiben offen (Giebelwand mit gable() in Wandfarbe schließen).
   */
  saddle(w: number, h: number, d: number, paint: Paint, x = 0, y = 0, z = 0, ry = 0, overhang = 0.09, ridge: Paint | null = M.ziegelFirst, t = 0.045): this {
    const a = Math.atan2(h, w / 2);
    const run = w / 2 + overhang;
    const L = run / Math.cos(a);
    const D = d + overhang * 2;
    return this.group(x, y, z, ry, (b) => {
      for (const s of [-1, 1]) {
        // Mitte der Dachfläche; sie liegt mit der Unterseite auf der Dachlinie
        const cx = (s * run) / 2, cy = h - (run / 2) * Math.tan(a);
        const nx = s * Math.sin(a) * (t / 2), ny = Math.cos(a) * (t / 2);
        b.add(new THREE.BoxGeometry(L, t, D), paint, cx + nx, cy + ny, 0, 0, 0, -s * a);
        // Traufbrett
        b.add(new THREE.BoxGeometry(0.03, 0.05, D), M.dunkelholz, s * (w / 2 + overhang - 0.01), -overhang * Math.tan(a) - 0.01, 0);
      }
      if (ridge !== null) b.add(new THREE.BoxGeometry(0.075, 0.075, D + 0.02), ridge, 0, h + t * 0.9, 0, 0, 0, Math.PI / 4);
    });
  }

  /** Giebelwand (Dreieck) w breit, h hoch, an (x,y,z) mit Blickrichtung ry (0 = nach +z) */
  gable(w: number, h: number, paint: Paint, x = 0, y = 0, z = 0, ry = 0, t = 0.04): this {
    return this.add(prismGeo(w, h, t), paint, x, y, z, ry);
  }

  /** Treppengiebel (Backsteinhäuser): n Stufen, w breit, h hoch, Blickrichtung ry */
  stepGable(w: number, h: number, n: number, paint: Paint, cap: Paint, x = 0, y = 0, z = 0, ry = 0, t = 0.08): this {
    return this.group(x, y, z, ry, (b) => {
      const sh = h / n;
      for (let i = 0; i < n; i++) {
        const wi = w * (1 - i / n);
        b.box(wi, sh, t, paint, 0, i * sh, 0);
        // Abdeckstein auf den Stufen
        if (i < n - 1) for (const s of [-1, 1]) b.box(w / n / 2 + 0.03, 0.025, t + 0.03, cap, s * (wi / 2 - w / n / 4), (i + 1) * sh, 0);
      }
      b.box(w / n + 0.04, 0.03, t + 0.03, cap, 0, h, 0);
      b.cone(0.035, 0.08, 6, cap, 0, h + 0.03, 0);
    });
  }

  /** Kegelstumpf mit rechteckiger Grund- und Deckfläche (Mansard-, Walmdach); dt = 0 ergibt einen First */
  frustum(wb: number, db: number, wt: number, dt: number, h: number, paint: Paint, x = 0, y = 0, z = 0, ry = 0): this {
    return this.add(frustumGeo(wb, db, wt, dt, h), paint, x, y, z, ry);
  }

  /** Mansarddach: steiles Unterdach (h1) und flaches Oberdach (h2) über w x d, y = Traufhöhe */
  mansard(w: number, d: number, h1: number, h2: number, inset: number, paint: Paint, x = 0, y = 0, z = 0, ry = 0, overhang = 0.06): this {
    const wb = w + overhang * 2, db = d + overhang * 2;
    const wt = w - inset * 2, dt = d - inset * 2;
    this.frustum(wb, db, wt, dt, h1, paint, x, y, z, ry);
    this.frustum(wt + 0.04, dt + 0.04, Math.max(0, wt - dt), 0, h2, paint, x, y + h1 - 0.01, z, ry);
    return this;
  }

  /** Kleine Person (stehend), Farbe der Kleidung wählbar */
  person(x: number, z: number, ry = 0, cloth: Paint = 0x3f6fb0, s = 1): this {
    return this.group(x, 0, z, ry, (b) => {
      b.cyl(0.03 * s, 0.045 * s, 0.12 * s, 6, cloth, 0, 0, 0);
      b.sphere(0.03 * s, 0xe8c4a0, 0, 0.15 * s, 0);
      b.cyl(0.035 * s, 0.035 * s, 0.015 * s, 6, 0x6b4a2b, 0, 0.175 * s, 0);
    });
  }

  /** Fahnenmast; an der Spitze weht eine Fahne in Besitzerfarbe (vom Renderer ergänzt) */
  flagPole(x: number, y: number, z: number, h = 0.6): this {
    this.cyl(0.012, 0.016, h, 6, M.dunkelholz, x, y, z);
    this.sphere(0.022, M.gold, x, y + h + 0.01, z);
    this.flags.push([x, y + h - 0.02, z]);
    return this;
  }

  /** Zinnen entlang einer Strecke (Mauerkrone) von (x1,z1) nach (x2,z2) auf Höhe y */
  merlons(x1: number, z1: number, x2: number, z2: number, y: number, paint: Paint = M.mauer, w = 0.1, h = 0.1, t = 0.1, gapF = 1): this {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.max(1, Math.floor(len / (w * (1 + gapF))));
    const ang = Math.atan2(-(z2 - z1), x2 - x1);
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      this.add(new THREE.BoxGeometry(w, h, t), paint, x1 + (x2 - x1) * f, y + h / 2, z1 + (z2 - z1) * f, ang);
    }
    return this;
  }

  /** Dreh-Teil (z. B. Mühlenflügel) als eigene Geometrie anmelden */
  spinner(geo: THREE.BufferGeometry, pos: [number, number, number], axis: 'x' | 'z' = 'z', speed = 1): this {
    this.spinners.push({ geo, pos, axis, speed });
    return this;
  }

  build(): ModelDef {
    const geo = mergeGeometries(this.parts, false);
    if (!geo) throw new Error('Leeres Modell');
    geo.computeBoundingSphere();
    return { geo, smoke: this.smoke, spinners: this.spinners, flags: this.flags };
  }

  /** Nur die Geometrie (für Dreh-Teile) */
  geometry(): THREE.BufferGeometry {
    const geo = mergeGeometries(this.parts, false)!;
    geo.computeBoundingSphere();
    return geo;
  }
}

/** Kleiner deterministischer Zufall für Variationen in Modellen */
export function rand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
