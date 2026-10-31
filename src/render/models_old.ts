// Prozedurale Low-Poly-Modelle aus Grundformen. Jedes Gebäude wird zu EINER
// Geometrie mit Vertex-Farben zusammengefügt (1 Draw-Call pro Gebäude).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BuildingId } from '../data';

type Geo = THREE.BufferGeometry;

const C = {
  holz: 0xa0703f, dunkelholz: 0x6b4a2b, putz: 0xefe4cc, stein: 0xb9b2a5, dunkelstein: 0x8a8378,
  stroh: 0xcfa85a, rot: 0xb5452f, schiefer: 0x4f5d75, gruen: 0x6aa23e, feld: 0xe3c35a, feldDunkel: 0xc9a443,
  weiss: 0xf4f1ea, schwarz: 0x2a2522, blau: 0x3f6fb0, fundament: 0x7d6a55, pflaster: 0xd2c6ae, gold: 0xe0b23a,
  wasser: 0x3a8cc4, tuchRot: 0xc8463b, tuchGelb: 0xe7c14d, tuchBlau: 0x4b7cc2,
};

function colorize(g: Geo, hex: number): Geo {
  const geo = g.index ? g.toNonIndexed() : g;
  geo.deleteAttribute('uv');
  const col = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

class Builder {
  parts: Geo[] = [];
  add(g: Geo, color: number, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0): this {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(1, 1, 1),
    );
    const geo = colorize(g, color);
    geo.applyMatrix4(m);
    this.parts.push(geo);
    return this;
  }
  /** Quader, Unterkante auf y */
  box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, ry = 0) {
    return this.add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, ry);
  }
  /** Satteldach (Prisma) über einer Fläche w (x) mal d (z) */
  roof(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, ry = 0) {
    const g = new THREE.BufferGeometry();
    const hw = w / 2, hd = d / 2;
    const v = [
      // Giebel vorne/hinten
      -hw, 0, hd, hw, 0, hd, 0, h, hd,
      hw, 0, -hd, -hw, 0, -hd, 0, h, -hd,
    ];
    const pos: number[] = [];
    const P = (i: number) => [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]];
    // Giebel
    pos.push(...P(0), ...P(1), ...P(2));
    pos.push(...P(3), ...P(4), ...P(5));
    // Dachflächen
    pos.push(...P(1), ...P(3), ...P(5), ...P(1), ...P(5), ...P(2));
    pos.push(...P(4), ...P(0), ...P(2), ...P(4), ...P(2), ...P(5));
    // Boden
    pos.push(...P(0), ...P(4), ...P(3), ...P(0), ...P(3), ...P(1));
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    // First verläuft entlang z, Giebel zeigen nach vorne/hinten
    return this.add(g, color, x, y, z, ry);
  }
  cyl(rTop: number, rBot: number, h: number, seg: number, color: number, x = 0, y = 0, z = 0, rx = 0, rz = 0) {
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg), color, x, y + h / 2, z, 0, rx, rz);
  }
  cone(r: number, h: number, seg: number, color: number, x = 0, y = 0, z = 0, ry = 0) {
    return this.add(new THREE.ConeGeometry(r, h, seg), color, x, y + h / 2, z, ry);
  }
  build(): Geo {
    const g = mergeGeometries(this.parts, false)!;
    g.computeBoundingSphere();
    return g;
  }
}

function foundation(b: Builder, s: number) {
  b.box(s * 0.92, 0.5, s * 0.92, C.fundament, 0, -0.48, 0);
}

function logPile(b: Builder, x: number, z: number) {
  for (let i = 0; i < 3; i++) b.cyl(0.07, 0.07, 0.6, 6, C.holz, x, 0.07 + i * 0.0, z - 0.15 + i * 0.15, 0, Math.PI / 2);
  b.cyl(0.07, 0.07, 0.6, 6, C.dunkelholz, x, 0.19, z - 0.07, 0, Math.PI / 2);
  b.cyl(0.07, 0.07, 0.6, 6, C.dunkelholz, x, 0.19, z + 0.08, 0, Math.PI / 2);
}

function crate(b: Builder, x: number, z: number, s = 0.22) { b.box(s, s, s, C.holz, x, 0, z, 0.3); }

function makeHouse(tier: number): Geo {
  const b = new Builder();
  foundation(b, 2);
  if (tier === 0) {
    b.box(2, 0.04, 2, C.gruen, 0, 0, 0);
    b.box(1.0, 0.55, 0.9, C.holz, -0.15, 0.04, -0.1);
    b.roof(1.25, 0.55, 1.1, C.stroh, -0.15, 0.59, -0.1);
    b.box(0.2, 0.35, 0.05, C.dunkelholz, -0.15, 0.04, 0.36);
    // Gemüsebeet
    b.box(0.6, 0.08, 0.35, C.dunkelholz, 0.45, 0.04, 0.6);
    b.box(0.5, 0.06, 0.25, 0x88b04b, 0.45, 0.12, 0.6);
  } else if (tier === 1) {
    b.box(2, 0.04, 2, C.gruen, 0, 0, 0);
    b.box(1.4, 0.8, 1.1, C.putz, 0, 0.04, -0.15);
    // Fachwerk
    for (const x of [-0.69, 0, 0.69]) b.box(0.07, 0.8, 1.14, C.dunkelholz, x, 0.04, -0.15);
    b.box(1.44, 0.07, 1.14, C.dunkelholz, 0, 0.44, -0.15);
    b.roof(1.65, 0.7, 1.3, C.rot, 0, 0.84, -0.15);
    b.box(0.22, 0.42, 0.05, C.dunkelholz, 0.3, 0.04, 0.42);
    b.box(0.18, 0.4, 0.18, C.dunkelstein, -0.45, 1.1, -0.3);
    b.box(0.9, 0.25, 0.04, C.holz, 0, 0.04, 0.85); // Zaun
  } else {
    b.box(2, 0.05, 2, C.pflaster, 0, 0, 0);
    b.box(1.6, 1.5, 1.3, C.stein, 0, 0.05, -0.1);
    b.box(1.66, 0.08, 1.36, C.dunkelstein, 0, 0.75, -0.1);
    b.roof(1.85, 0.8, 1.5, C.schiefer, 0, 1.55, -0.1);
    b.box(0.25, 0.6, 0.25, C.dunkelstein, 0.5, 1.8, -0.4);
    b.box(0.26, 0.5, 0.05, C.dunkelholz, 0, 0.05, 0.56);
    for (const x of [-0.5, 0.5]) for (const y of [0.35, 1.05]) b.box(0.22, 0.25, 0.04, 0x3b4a5c, x, y, 0.56);
  }
  return b.build();
}

function makeKontor(): Geo {
  const b = new Builder();
  foundation(b, 3);
  b.box(3, 0.05, 3, C.pflaster, 0, 0, 0);
  b.box(2.2, 1.2, 1.5, C.putz, -0.1, 0.05, -0.55);
  for (const x of [-1.15, -0.1, 0.95]) b.box(0.08, 1.2, 1.54, C.dunkelholz, x, 0.05, -0.55);
  b.roof(2.45, 0.9, 1.75, C.rot, -0.1, 1.25, -0.55);
  b.box(0.6, 0.7, 0.06, C.dunkelholz, -0.1, 0.05, 0.22);
  // Steg Richtung Wasser (+z)
  b.box(0.7, 0.08, 1.6, C.holz, 0.6, -0.05, 1.7);
  for (const x of [0.3, 0.9]) for (const z of [1.2, 2.3]) b.cyl(0.05, 0.05, 0.9, 5, C.dunkelholz, x, -0.75, z);
  crate(b, -0.9, 0.7); crate(b, -0.6, 0.85, 0.18); crate(b, -0.75, 1.0, 0.2);
  b.cyl(0.12, 0.14, 0.3, 7, C.holz, 0.1, 0.05, 0.8);
  // Fahnenmast
  b.cyl(0.03, 0.03, 2.2, 5, C.dunkelholz, 1.2, 0.05, -1.2);
  b.box(0.04, 0.35, 0.55, C.tuchBlau, 1.2, 1.85, -0.92);
  return b.build();
}

function makeMarkt(): Geo {
  const b = new Builder();
  foundation(b, 3);
  b.box(2.9, 0.06, 2.9, C.pflaster, 0, 0, 0);
  // Brunnen
  b.cyl(0.32, 0.34, 0.25, 8, C.stein, 0, 0.06, 0);
  b.cyl(0.25, 0.25, 0.04, 8, C.wasser, 0, 0.28, 0);
  // Stände
  const stalls: [number, number, number][] = [[-0.9, -0.9, C.tuchRot], [0.9, -0.9, C.tuchGelb], [-0.9, 0.9, C.tuchBlau], [0.9, 0.9, C.tuchRot]];
  for (const [x, z, c] of stalls) {
    b.box(0.6, 0.3, 0.4, C.holz, x, 0.06, z);
    for (const dx of [-0.27, 0.27]) b.box(0.04, 0.6, 0.04, C.dunkelholz, x + dx, 0.06, z - 0.18);
    b.roof(0.75, 0.22, 0.55, c, x, 0.62, z);
    crate(b, x + 0.25, z + 0.35, 0.16);
  }
  return b.build();
}

function makeKapelle(): Geo {
  const b = new Builder();
  foundation(b, 2);
  b.box(2, 0.05, 2, C.gruen, 0, 0, 0);
  b.box(0.9, 0.9, 1.4, C.putz, 0, 0.05, 0.15, Math.PI / 2 * 0);
  b.roof(1.1, 0.6, 1.6, C.schiefer, 0, 0.95, 0.15);
  b.box(0.55, 1.7, 0.55, C.putz, 0, 0.05, -0.75);
  b.cone(0.42, 0.9, 4, C.schiefer, 0, 1.75, -0.75, Math.PI / 4);
  b.box(0.05, 0.3, 0.05, C.gold, 0, 2.62, -0.75);
  b.box(0.18, 0.05, 0.05, C.gold, 0, 2.8, -0.75);
  b.box(0.25, 0.45, 0.05, C.dunkelholz, 0, 0.05, 0.86);
  return b.build();
}

function makeWirtshaus(): Geo {
  const b = new Builder();
  foundation(b, 2);
  b.box(2, 0.05, 2, C.pflaster, 0, 0, 0);
  b.box(1.5, 0.7, 1.2, C.stein, 0, 0.05, -0.2);
  b.box(1.6, 0.7, 1.3, C.putz, 0, 0.75, -0.2);
  for (const x of [-0.78, 0, 0.78]) b.box(0.07, 0.7, 1.34, C.dunkelholz, x, 0.75, -0.2);
  b.roof(1.8, 0.75, 1.5, C.rot, 0, 1.45, -0.2);
  b.box(0.05, 0.05, 0.4, C.dunkelholz, 0.8, 1.0, 0.55);
  b.box(0.04, 0.25, 0.3, C.gold, 0.8, 0.72, 0.62);
  for (const x of [-0.6, -0.35]) b.cyl(0.12, 0.12, 0.28, 7, C.holz, x, 0.05, 0.7);
  return b.build();
}

function makeHolzfaeller(): Geo {
  const b = new Builder();
  foundation(b, 2);
  b.box(2, 0.04, 2, 0x7a9a45, 0, 0, 0);
  b.box(0.9, 0.55, 0.8, C.dunkelholz, -0.35, 0.04, -0.35);
  b.roof(1.1, 0.45, 1.0, C.holz, -0.35, 0.59, -0.35);
  logPile(b, 0.45, 0.45);
  b.cyl(0.14, 0.16, 0.2, 7, C.holz, -0.45, 0.04, 0.55);
  return b.build();
}

function makeFischer(): Geo {
  const b = new Builder();
  foundation(b, 2);
  b.box(2, 0.04, 2, 0xe0cc8e, 0, 0, 0);
  b.box(0.9, 0.55, 0.8, C.holz, -0.3, 0.04, -0.3);
  b.roof(1.1, 0.45, 1.0, C.stroh, -0.3, 0.59, -0.3);
  // Netz-Gestell
  for (const x of [0.25, 0.85]) b.box(0.05, 0.6, 0.05, C.dunkelholz, x, 0.04, 0.3);
  b.box(0.6, 0.35, 0.02, 0x9c9070, 0.55, 0.25, 0.3);
  // Boot
  b.add(new THREE.CylinderGeometry(0.22, 0.22, 0.9, 8, 1, false, 0, Math.PI), C.dunkelholz, -0.3, 0.2, 0.6, 0, 0, Math.PI / 2);
  return b.build();
}

function makeSchaffarm(): Geo {
  const b = new Builder();
  foundation(b, 3);
  b.box(2.9, 0.05, 2.9, 0x8cc152, 0, 0, 0);
  // Zaun
  for (const [w, d, x, z] of [[2.8, 0.05, 0, -1.4], [2.8, 0.05, 0, 1.4], [0.05, 2.8, -1.4, 0], [0.05, 2.8, 1.4, 0]] as const) {
    b.box(w, 0.08, d, C.holz, x, 0.2, z);
  }
  for (const x of [-1.4, 0, 1.4]) for (const z of [-1.4, 1.4]) b.box(0.07, 0.35, 0.07, C.dunkelholz, x, 0.05, z);
  b.box(1.0, 0.6, 0.8, C.holz, -0.8, 0.05, -0.8);
  b.roof(1.2, 0.45, 1.0, C.rot, -0.8, 0.65, -0.8);
  // Schafe laufen lebendig (render/life.ts), nicht als feste Figuren im Modell
  return b.build();
}

function makeGetreidefarm(): Geo {
  const b = new Builder();
  foundation(b, 3);
  b.box(2.9, 0.05, 2.9, 0x8a6a40, 0, 0, 0);
  for (let i = 0; i < 6; i++) b.box(1.6, 0.22, 0.28, i % 2 ? C.feld : C.feldDunkel, 0.5, 0.05, -1.1 + i * 0.44);
  b.box(0.85, 0.6, 0.9, C.holz, -0.95, 0.05, -0.75);
  b.roof(1.05, 0.45, 1.05, C.stroh, -0.95, 0.65, -0.75);
  b.cyl(0.2, 0.2, 0.3, 7, C.feld, -0.95, 0.05, 0.6);
  return b.build();
}

function makeWeberei(): Geo {
  const b = new Builder();
  foundation(b, 2);
  b.box(2, 0.05, 2, C.pflaster, 0, 0, 0);
  b.box(1.5, 0.8, 1.1, C.putz, 0, 0.05, -0.3);
  b.roof(1.7, 0.6, 1.3, C.rot, 0, 0.85, -0.3);
  // Tücher zum Trocknen
  for (const x of [-0.6, 0.6]) b.box(0.05, 0.75, 0.05, C.dunkelholz, x, 0.05, 0.6);
  b.box(1.25, 0.04, 0.04, C.dunkelholz, 0, 0.78, 0.6);
  b.box(0.35, 0.45, 0.02, C.tuchBlau, -0.35, 0.33, 0.6);
  b.box(0.35, 0.45, 0.02, C.tuchRot, 0.05, 0.33, 0.6);
  b.box(0.3, 0.45, 0.02, C.tuchGelb, 0.4, 0.33, 0.6);
  return b.build();
}

function makeSteinbruch(): Geo {
  const b = new Builder();
  foundation(b, 2);
  b.box(2, 0.05, 2, 0x9a9384, 0, 0, 0);
  b.box(0.5, 0.35, 0.4, C.stein, -0.5, 0.05, -0.4, 0.2);
  b.box(0.4, 0.3, 0.35, C.dunkelstein, 0.0, 0.05, -0.55, -0.3);
  b.box(0.35, 0.25, 0.35, C.stein, -0.35, 0.4, -0.45, 0.5);
  for (const [x, z] of [[0.4, 0.4], [0.65, 0.4], [0.52, 0.62]]) b.box(0.22, 0.22, 0.22, C.stein, x, 0.05, z);
  // Kran
  b.box(0.08, 1.2, 0.08, C.dunkelholz, 0.6, 0.05, -0.5);
  b.box(0.9, 0.07, 0.07, C.dunkelholz, 0.25, 1.2, -0.5);
  b.box(0.02, 0.5, 0.02, C.schwarz, -0.15, 0.72, -0.5);
  return b.build();
}

function makeErzmine(): Geo {
  const b = new Builder();
  foundation(b, 2);
  b.box(2, 0.05, 2, 0x8f8270, 0, 0, 0);
  b.box(1.1, 0.8, 0.7, C.dunkelstein, 0, 0.05, -0.55);
  b.box(0.55, 0.55, 0.1, C.schwarz, 0, 0.05, -0.17);
  b.box(0.08, 0.6, 0.08, C.holz, -0.3, 0.05, -0.15);
  b.box(0.08, 0.6, 0.08, C.holz, 0.3, 0.05, -0.15);
  b.box(0.7, 0.08, 0.1, C.holz, 0, 0.62, -0.15);
  // Lore + Schienen
  b.box(0.06, 0.03, 1.0, C.dunkelholz, -0.12, 0.05, 0.4);
  b.box(0.06, 0.03, 1.0, C.dunkelholz, 0.12, 0.05, 0.4);
  b.box(0.35, 0.22, 0.4, 0x5b5148, 0, 0.1, 0.45);
  b.box(0.28, 0.06, 0.32, 0x7a5a3a, 0, 0.32, 0.45);
  return b.build();
}

function makeSchmiede(): Geo {
  const b = new Builder();
  foundation(b, 2);
  b.box(2, 0.05, 2, C.pflaster, 0, 0, 0);
  b.box(1.4, 0.75, 1.1, C.stein, -0.1, 0.05, -0.25);
  b.roof(1.6, 0.55, 1.3, C.schiefer, -0.1, 0.8, -0.25);
  b.box(0.3, 1.6, 0.3, C.dunkelstein, 0.55, 0.05, -0.55);
  // Amboss
  b.box(0.15, 0.2, 0.12, C.schwarz, 0.4, 0.05, 0.6);
  b.box(0.3, 0.08, 0.14, C.schwarz, 0.4, 0.25, 0.6);
  return b.build();
}

function makeMuehle(): Geo {
  const b = new Builder();
  foundation(b, 2);
  b.box(2, 0.05, 2, C.gruen, 0, 0, 0);
  b.cyl(0.42, 0.62, 1.6, 8, C.putz, 0, 0.05, 0);
  b.cone(0.55, 0.6, 8, C.stroh, 0, 1.65, 0);
  b.box(0.22, 0.4, 0.05, C.dunkelholz, 0, 0.05, 0.6);
  return b.build();
}

export function makeMillBlades(): Geo {
  const b = new Builder();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    b.add(new THREE.BoxGeometry(0.1, 0.75, 0.03), C.holz, Math.sin(a) * 0.38, Math.cos(a) * 0.38, 0, 0, 0, -a);
    b.add(new THREE.BoxGeometry(0.14, 0.55, 0.01), C.weiss, Math.sin(a) * 0.45 + Math.cos(a) * 0.05, Math.cos(a) * 0.45 - Math.sin(a) * 0.05, 0.02, 0, 0, -a);
  }
  b.cyl(0.07, 0.07, 0.12, 6, C.dunkelholz, 0, -0.06, 0, Math.PI / 2);
  return b.build();
}

function makeBaeckerei(): Geo {
  const b = new Builder();
  foundation(b, 2);
  b.box(2, 0.05, 2, C.pflaster, 0, 0, 0);
  b.box(1.3, 0.75, 1.1, C.putz, -0.2, 0.05, -0.25);
  for (const x of [-0.84, -0.2, 0.44]) b.box(0.07, 0.75, 1.14, C.dunkelholz, x, 0.05, -0.25);
  b.roof(1.5, 0.6, 1.3, C.rot, -0.2, 0.8, -0.25);
  b.add(new THREE.SphereGeometry(0.35, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), C.stein, 0.6, 0.05, 0.5);
  b.box(0.15, 0.7, 0.15, C.dunkelstein, 0.6, 0.3, 0.5);
  return b.build();
}

const cache = new Map<string, Geo>();

export function buildingGeometry(type: BuildingId, tier = 0): Geo {
  const key = `${type}:${tier}`;
  let g = cache.get(key);
  if (g) return g;
  switch (type) {
    case 'haus': g = makeHouse(tier); break;
    case 'kontor': g = makeKontor(); break;
    case 'markt': g = makeMarkt(); break;
    case 'kapelle': g = makeKapelle(); break;
    case 'wirtshaus': g = makeWirtshaus(); break;
    case 'holzfaeller': g = makeHolzfaeller(); break;
    case 'fischer': g = makeFischer(); break;
    case 'schaffarm': g = makeSchaffarm(); break;
    case 'getreidefarm': g = makeGetreidefarm(); break;
    case 'weberei': g = makeWeberei(); break;
    case 'steinbruch': g = makeSteinbruch(); break;
    case 'erzmine': g = makeErzmine(); break;
    case 'schmiede': g = makeSchmiede(); break;
    case 'muehle': g = makeMuehle(); break;
    case 'baeckerei': g = makeBaeckerei(); break;
    default: g = new Builder().box(0.9, 0.06, 0.9, 0xb39869).build();
  }
  cache.set(key, g);
  return g;
}

export function treeGeometry(): Geo {
  const b = new Builder();
  b.cyl(0.05, 0.07, 0.3, 5, C.dunkelholz, 0, 0, 0);
  b.cone(0.32, 0.55, 6, 0x3f7f35, 0, 0.22, 0);
  b.cone(0.24, 0.45, 6, 0x4c9140, 0, 0.5, 0);
  return b.build();
}

export function mountainGeometry(): Geo {
  const b = new Builder();
  b.cone(0.85, 1, 5, 0xffffff, 0, 0, 0);
  return b.build();
}
