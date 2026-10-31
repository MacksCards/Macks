// Militärbauten aus Code: Palisaden, Mauern, Tore, Türme, Burgen, Festung, Triumphbogen.
// Mauern und Palisaden verbinden sich mit Nachbarn (mask: 1 = Norden/-z, 2 = Osten/+x, 4 = Süden/+z, 8 = Westen/-x).
import * as THREE from 'three';
import { Builder, M, ModelDef, rand } from '../kit';

const DIRS: [number, number, number][] = [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0]];
const arms = (mask: number) => DIRS.filter(([bit]) => (mask || 10) & bit);

const helleEiche = { c: 0x8a6440, p: 0 };
const rinde = { c: 0x6b4c31, p: 0 };
const bronze = { c: 0x8c6a3a, p: 0 };
const dunkel = { c: 0x1d1a18, p: 0 };

/** Palisade: angespitzte Stämme auf einem Erdwall, mit Querriegel */
export function palisade(mask: number): ModelDef {
  const b = new Builder();
  const r = rand(mask * 13 + 7);
  b.ground(1, 1, M.erde, false);
  const stake = (x: number, z: number, h: number) => {
    b.cyl(0.055, 0.065, h, 7, r() > 0.5 ? rinde : M.holz, x, 0.05, z, (r() - 0.5) * 0.06, (r() - 0.5) * 0.06);
    b.cone(0.058, 0.12, 7, helleEiche, x, 0.05 + h, z);
  };
  stake(0, 0, 0.62);
  for (const [, dx, dz] of arms(mask)) {
    b.box(dx ? 0.5 : 0.3, 0.08, dz ? 0.5 : 0.3, M.erde, dx * 0.25, 0, dz * 0.25);
    for (let i = 1; i <= 4; i++) {
      const t = i * 0.12;
      stake(dx * t + (r() - 0.5) * 0.02, dz * t + (r() - 0.5) * 0.02, 0.5 + r() * 0.14);
    }
    // Querriegel innen
    const len = 0.5;
    b.add(new THREE.BoxGeometry(dx ? len : 0.035, 0.035, dz ? len : 0.035), M.balken, dx * 0.25 - dz * 0.07, 0.38, dz * 0.25 + dx * 0.07);
    b.add(new THREE.BoxGeometry(dx ? len : 0.035, 0.035, dz ? len : 0.035), M.balken, dx * 0.25 - dz * 0.07, 0.18, dz * 0.25 + dx * 0.07);
  }
  return b.build();
}

/** Steinmauer mit Zinnen, Wehrgang und Pfeiler in der Mitte */
export function steinmauer(mask: number): ModelDef {
  const b = new Builder();
  b.ground(1, 1, M.mauerDunkel, false);
  const H = 0.62;
  b.box(0.44, H + 0.12, 0.44, M.mauer, 0, 0, 0);
  b.box(0.5, 0.05, 0.5, M.mauerDunkel, 0, H + 0.12, 0);
  b.box(0.5, 0.12, 0.5, M.mauerDunkel, 0, 0, 0);
  for (const [, dx, dz] of arms(mask)) {
    const lx = dx ? 0.5 : 0.34, lz = dz ? 0.5 : 0.34;
    b.box(dx ? 0.5 : 0.4, 0.1, dz ? 0.5 : 0.4, M.mauerDunkel, dx * 0.25, 0, dz * 0.25); // Sockel
    b.box(lx, H, lz, M.mauer, dx * 0.25, 0, dz * 0.25);
    b.box(dx ? 0.5 : 0.38, 0.04, dz ? 0.5 : 0.38, M.mauerDunkel, dx * 0.25, H, dz * 0.25); // Mauerkrone
    // Zinnen auf beiden Außenkanten
    for (const side of [-1, 1]) {
      const ox = dz ? side * 0.15 : 0, oz = dx ? side * 0.15 : 0;
      b.merlons(dx * 0.22 + ox, dz * 0.22 + oz, dx * 0.5 + ox, dz * 0.5 + oz, H + 0.04, M.mauer, 0.08, 0.11, 0.07, 0.8);
    }
    // Schießscharte
    b.box(dx ? 0.04 : 0.36, 0.14, dz ? 0.04 : 0.36, dunkel, dx * 0.36, 0.3, dz * 0.36);
  }
  b.merlons(-0.2, -0.2, 0.2, -0.2, H + 0.17, M.mauer, 0.08, 0.1, 0.08, 0.9);
  b.merlons(-0.2, 0.2, 0.2, 0.2, H + 0.17, M.mauer, 0.08, 0.1, 0.08, 0.9);
  return b.build();
}

/** zweiflügeliges Holztor mit Eisenbändern; Breite w, Höhe h, Mitte (0,0,z) */
function gateDoors(b: Builder, w: number, h: number, z: number) {
  for (const s of [-1, 1]) {
    const x = s * w / 4;
    b.box(w / 2 - 0.01, h, 0.05, M.latten, x, 0, z);
    for (const y of [h * 0.18, h * 0.5, h * 0.82]) b.box(w / 2 - 0.03, 0.025, 0.06, M.eisen, x, y, z);
    for (const y of [h * 0.3, h * 0.66]) for (const k of [-1, 1]) b.sphere(0.012, M.eisen, x + k * w / 8, y, z + 0.03);
    b.sphere(0.018, M.gold, s * 0.03, h * 0.5, z + 0.035);
  }
}

/** Holztor in der Palisade (Durchgang entlang z, Palisade läuft entlang x) */
export function holztor(): ModelDef {
  const b = new Builder();
  b.ground(1, 1, M.erde, false);
  for (const s of [-1, 1]) {
    b.box(0.11, 0.85, 0.11, M.balken, s * 0.3, 0, 0);
    b.cone(0.08, 0.1, 4, M.balken, s * 0.3, 0.85, 0, Math.PI / 4);
    for (let i = 0; i < 2; i++) { b.cyl(0.05, 0.06, 0.55, 7, rinde, s * (0.4 + i * 0.09), 0, 0); b.cone(0.055, 0.1, 7, helleEiche, s * (0.4 + i * 0.09), 0.55, 0); }
    b.add(new THREE.BoxGeometry(0.03, 0.4, 0.03), M.balken, s * 0.24, 0.62, 0.0, 0, 0, s * 0.7); // Kopfband
  }
  b.box(0.75, 0.08, 0.13, M.balken, 0, 0.78, 0);
  b.roof(0.82, 0.16, 0.26, M.schindel, 0, 0.86, 0, Math.PI / 2, 0.04);
  gateDoors(b, 0.5, 0.62, 0.02);
  b.flagPole(0.3, 0.92, 0, 0.35);
  return b.build();
}

/** Stadttor aus Stein mit zwei Türmchen, Rundbogen, Fallgitter */
export function steintor(): ModelDef {
  const b = new Builder();
  b.ground(1, 1, M.pflaster, false);
  b.box(1, 0.95, 0.5, M.mauer, 0, 0, 0);
  b.box(1.02, 0.08, 0.52, M.mauerDunkel, 0, 0, 0);
  // Durchgang (dunkel) mit Rundbogen
  b.box(0.42, 0.5, 0.52, dunkel, 0, 0, 0);
  b.add(new THREE.CylinderGeometry(0.21, 0.21, 0.53, 12, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), dunkel, 0, 0.5, 0);
  b.add(new THREE.TorusGeometry(0.235, 0.035, 5, 12, Math.PI), M.mauerDunkel, 0, 0.5, 0.255);
  gateDoors(b, 0.4, 0.5, 0.2);
  for (let i = 0; i < 6; i++) b.box(0.012, 0.18, 0.012, M.eisen, -0.17 + i * 0.068, 0.55, 0.24); // Fallgitter
  b.merlons(-0.5, 0.22, 0.5, 0.22, 0.95, M.mauer, 0.09, 0.12, 0.08, 0.9);
  b.merlons(-0.5, -0.22, 0.5, -0.22, 0.95, M.mauer, 0.09, 0.12, 0.08, 0.9);
  b.box(0.3, 0.12, 0.04, M.gold, 0, 0.78, 0.26); // Wappen
  b.box(0.18, 0.08, 0.045, { c: 0x2f4f8f, p: 0 }, 0, 0.8, 0.265);
  for (const s of [-1, 1]) {
    b.cyl(0.2, 0.22, 1.25, 10, M.mauer, s * 0.4, 0, 0);
    b.cyl(0.235, 0.2, 0.08, 10, M.mauerDunkel, s * 0.4, 1.17, 0);
    b.cone(0.25, 0.42, 10, M.schiefer, s * 0.4, 1.25, 0);
    for (const y of [0.45, 0.85]) b.box(0.035, 0.12, 0.03, dunkel, s * 0.4, y, 0.205);
  }
  b.flagPole(-0.4, 1.62, 0, 0.32);
  return b.build();
}

/** Wachturm aus Holz: vier Stämme, Streben, Plattform mit Geländer, Dach, Kanone */
export function holzturm(): ModelDef {
  const b = new Builder();
  b.ground(1, 1, M.erde, false);
  const P = 0.3, H = 1.15;
  for (const [x, z] of [[-P, -P], [P, -P], [-P, P], [P, P]]) {
    b.cyl(0.045, 0.06, H + 0.45, 7, rinde, x, 0, z);
    b.box(0.14, 0.05, 0.14, M.stein, x, 0, z);
  }
  // Kreuzstreben auf allen Seiten
  for (const [ry, ox, oz] of [[0, 0, P], [0, 0, -P], [Math.PI / 2, P, 0], [Math.PI / 2, -P, 0]] as [number, number, number][]) {
    for (const lvl of [0.15, 0.6]) {
      const len = Math.hypot(P * 2, 0.45);
      b.add(new THREE.BoxGeometry(len, 0.03, 0.03), M.balken, ox, lvl + 0.22, oz, ry, 0, Math.atan2(0.45, P * 2));
      b.add(new THREE.BoxGeometry(len, 0.03, 0.03), M.balken, ox, lvl + 0.22, oz, ry, 0, -Math.atan2(0.45, P * 2));
    }
  }
  b.box(0.82, 0.05, 0.82, M.bretter, 0, H, 0); // Plattform
  for (const [x1, z1, x2, z2] of [[-0.4, -0.4, 0.4, -0.4], [0.4, -0.4, 0.4, 0.4], [0.4, 0.4, -0.4, 0.4], [-0.4, 0.4, -0.4, -0.4]]) {
    b.group(0, H + 0.05, 0, 0, (g) => g.fence(x1, z1, x2, z2, 0.22, M.bretterDunkel));
  }
  // Leiter
  for (const s of [-1, 1]) b.box(0.02, H, 0.02, M.holz, s * 0.08, 0, P + 0.08);
  for (let i = 1; i < 8; i++) b.box(0.16, 0.015, 0.015, M.holz, 0, i * 0.14, P + 0.08);
  // Dach auf Pfosten
  b.hipRoof(0.9, 0.38, 0.9, M.schindel, 0, H + 0.45, 0, 0, 0.04);
  // Kanonen
  b.log(0.035, 0.32, M.eisen, 0.28, H + 0.16, 0.1, 0.4);
  b.log(0.035, 0.32, M.eisen, -0.1, H + 0.16, 0.28, Math.PI / 2 + 0.3);
  b.box(0.16, 0.08, 0.14, M.bretterDunkel, 0.18, H + 0.05, 0.06);
  b.barrel(-0.25, -0.25, H + 0.05, 0.06, 0.13);
  b.flagPole(0, H + 0.82, 0, 0.32);
  return b.build();
}

/** Wachturm aus Stein: runder Turm mit Sockel, Schießscharten, Zinnenkranz und zwei Kanonen */
export function steinturm(): ModelDef {
  const b = new Builder();
  b.ground(1, 1, M.mauerDunkel, false);
  b.cyl(0.42, 0.47, 0.22, 12, M.mauerDunkel, 0, 0, 0);
  b.cyl(0.33, 0.4, 1.35, 12, M.mauer, 0, 0.2, 0);
  for (const y of [0.55, 1.0]) for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + (y > 0.8 ? Math.PI / 4 : 0);
    b.box(0.04, 0.15, 0.04, dunkel, Math.sin(a) * 0.36, y, Math.cos(a) * 0.36, a);
  }
  b.door(0, 0.2, 0.39, 0, 0.18, 0.3, M.latten);
  // Konsolen + auskragender Zinnenkranz
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; b.box(0.06, 0.08, 0.06, M.mauerDunkel, Math.sin(a) * 0.36, 1.48, Math.cos(a) * 0.36, a); }
  b.cyl(0.43, 0.38, 0.1, 12, M.mauer, 0, 1.55, 0);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    b.box(0.12, 0.14, 0.08, M.mauer, Math.sin(a) * 0.39, 1.65, Math.cos(a) * 0.39, a);
  }
  b.cyl(0.36, 0.36, 0.02, 12, M.pflaster, 0, 1.64, 0);
  // Kanonen zwischen den Zinnen
  for (const a of [0.3, 2.4]) {
    b.add(new THREE.CylinderGeometry(0.03, 0.04, 0.34, 8).rotateX(Math.PI / 2), M.eisen, Math.sin(a) * 0.3, 1.72, Math.cos(a) * 0.3, a);
    b.box(0.12, 0.06, 0.16, M.bretterDunkel, Math.sin(a) * 0.18, 1.65, Math.cos(a) * 0.18, a);
  }
  // kleines Wachhäuschen
  b.box(0.2, 0.2, 0.2, M.mauer, -0.12, 1.66, -0.14);
  b.hipRoof(0.24, 0.16, 0.24, M.schiefer, -0.12, 1.86, -0.14, 0, 0.03);
  b.flagPole(0.1, 1.66, -0.18, 0.5);
  return b.build();
}

/** runder Eckturm mit Kegeldach */
function tower(b: Builder, x: number, z: number, r: number, h: number, roof = true, flag = false) {
  b.cyl(r * 1.05, r * 1.15, 0.12, 10, M.mauerDunkel, x, 0, z);
  b.cyl(r, r * 1.06, h, 10, M.mauer, x, 0.1, z);
  b.cyl(r * 1.12, r, 0.08, 10, M.mauerDunkel, x, h + 0.06, z);
  if (roof) {
    b.cone(r * 1.2, r * 2.2, 10, M.schiefer, x, h + 0.14, z);
    b.sphere(0.025, M.gold, x, h + 0.14 + r * 2.2, z);
  } else {
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; b.box(0.08, 0.1, 0.05, M.mauer, x + Math.sin(a) * r * 1.05, h + 0.14, z + Math.cos(a) * r * 1.05, a); }
  }
  for (const y of [h * 0.4, h * 0.75]) b.box(0.03, 0.1, 0.03, dunkel, x + Math.sign(x || 1) * r * 0.72, y, z + Math.sign(z || 1) * r * 0.72, Math.atan2(x, z));
  if (flag) b.flagPole(x, h + (roof ? 0.14 + r * 2.2 : 0.2), z, 0.38);
}

/** Wehrmauer mit Zinnen zwischen zwei Punkten */
function curtain(b: Builder, x1: number, z1: number, x2: number, z2: number, h: number, t = 0.16) {
  const len = Math.hypot(x2 - x1, z2 - z1), ang = Math.atan2(-(z2 - z1), x2 - x1);
  const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
  b.add(new THREE.BoxGeometry(len, h, t), M.mauer, mx, h / 2, mz, ang);
  b.add(new THREE.BoxGeometry(len, 0.07, t + 0.04), M.mauerDunkel, mx, 0.035, mz, ang);
  b.add(new THREE.BoxGeometry(len, 0.03, t + 0.03), M.mauerDunkel, mx, h, mz, ang);
  const nx = (z2 - z1) / len, nz = -(x2 - x1) / len; // Normale
  for (const s of [-1, 1]) b.merlons(x1 + nx * s * t * 0.4, z1 + nz * s * t * 0.4, x2 + nx * s * t * 0.4, z2 + nz * s * t * 0.4, h + 0.02, M.mauer, 0.07, 0.09, 0.05, 0.9);
}

/** Torhaus mit Rundbogen an der Vorderseite (+z) */
function gatehouse(b: Builder, z: number, w: number, h: number) {
  b.box(w, h, 0.3, M.mauer, 0, 0, z);
  b.box(w * 0.42, h * 0.55, 0.32, dunkel, 0, 0, z);
  b.add(new THREE.TorusGeometry(w * 0.23, 0.03, 5, 12, Math.PI), M.mauerDunkel, 0, h * 0.55, z + 0.16);
  gateDoors(b, w * 0.4, h * 0.55, z + 0.1);
  b.merlons(-w / 2, z + 0.12, w / 2, z + 0.12, h, M.mauer, 0.07, 0.1, 0.06, 0.9);
  b.box(w * 0.25, w * 0.18, 0.03, M.gold, 0, h * 0.72, z + 0.16);
}

/** Bergfried: hoher Wohnturm mit Fenstern und Walmdach */
function keep(b: Builder, x: number, z: number, w: number, h: number) {
  b.box(w, h, w, M.mauer, x, 0, z);
  b.box(w + 0.04, 0.05, w + 0.04, M.mauerDunkel, x, h * 0.5, z);
  for (const [ry, ox, oz] of [[0, 0, 1], [Math.PI / 2, 1, 0], [Math.PI, 0, -1], [-Math.PI / 2, -1, 0]] as [number, number, number][]) {
    for (const f of [-0.25, 0.25]) {
      const px = x + ox * (w / 2 + 0.005) + (oz ? f * w : 0), pz = z + oz * (w / 2 + 0.005) + (ox ? f * w : 0);
      b.window(px, h * 0.82, pz, ry, 0.08, 0.13);
      b.window(px, h * 0.42, pz, ry, 0.07, 0.11);
    }
  }
  b.hipRoof(w, w * 0.6, w, M.schiefer, x, h, z, 0, 0.05);
  b.chimney(x + w * 0.25, h + 0.05, z - w * 0.2, 0.3, 0.08);
}

/** Burg: Ringmauer, vier Ecktürme, Bergfried, Torhaus */
export function burg(): ModelDef {
  const b = new Builder();
  b.ground(2, 2, M.pflaster);
  const E = 0.78, H = 0.62;
  curtain(b, -E, -E, E, -E, H); curtain(b, E, -E, E, E, H); curtain(b, -E, E, -E, -E, H);
  curtain(b, -E, E, -0.25, E, H); curtain(b, 0.25, E, E, E, H);
  for (const [x, z] of [[-E, -E], [E, -E], [-E, E], [E, E]]) tower(b, x, z, 0.19, 1.0, true, x < 0 && z < 0);
  gatehouse(b, E, 0.55, 0.82);
  keep(b, -0.1, -0.15, 0.62, 1.35);
  b.flagPole(-0.1, 1.72, -0.15, 0.4);
  // Hof: Brunnen, Fässer, Heu
  b.cyl(0.08, 0.09, 0.1, 10, M.stein, 0.4, 0, 0.35);
  b.barrel(0.45, -0.2); b.barrel(0.52, -0.08); b.crate(0.35, 0.05);
  return b.build();
}

/** Große Burg: doppelte Mauer, sechs Türme, großer Palas, Torhaus mit Flankentürmen */
export function grosseBurg(): ModelDef {
  const b = new Builder();
  b.ground(3, 3, M.pflaster);
  const E = 1.25, H = 0.72;
  curtain(b, -E, -E, E, -E, H, 0.2); curtain(b, E, -E, E, E, H, 0.2); curtain(b, -E, E, -E, -E, H, 0.2);
  curtain(b, -E, E, -0.35, E, H, 0.2); curtain(b, 0.35, E, E, E, H, 0.2);
  for (const [x, z] of [[-E, -E], [E, -E], [-E, E], [E, E], [-E, 0], [E, 0]]) tower(b, x, z, 0.24, 1.15, Math.abs(z) > 0.1, x > 0 && z < 0);
  gatehouse(b, E, 0.7, 0.95);
  tower(b, -0.42, E + 0.05, 0.16, 1.2, true, true);
  tower(b, 0.42, E + 0.05, 0.16, 1.2, true, false);
  // Innenhof: Palas (Saal) und Bergfried
  b.box(1.3, 0.7, 0.55, M.mauer, 0.1, 0, -0.6);
  b.roof(1.3, 0.45, 0.55, M.schiefer, 0.1, 0.7, -0.6, Math.PI / 2);
  for (let i = 0; i < 5; i++) b.window(-0.42 + i * 0.26, 0.55, -0.32, 0, 0.08, 0.16);
  b.door(0.1, 0, -0.32, 0, 0.18, 0.3);
  keep(b, -0.65, 0.1, 0.6, 1.7);
  b.flagPole(-0.65, 2.08, 0.1, 0.45);
  b.chimney(0.5, 0.8, -0.65, 0.4, 0.09);
  // Stall und Vorräte
  b.box(0.5, 0.35, 0.35, M.bretter, 0.65, 0, 0.35);
  b.shedRoof(0.5, 0.15, 0.35, M.schindel, 0.65, 0.35, 0.35);
  b.barrel(0.3, 0.55); b.barrel(0.42, 0.62); b.crate(0.2, 0.7); b.woodpile(0.95, 0.75, 0);
  return b.build();
}

/** Festung: sternförmige Bastionen mit Kanonen, Graben, Zitadelle */
export function festung(): ModelDef {
  const b = new Builder();
  b.ground(3, 3, M.wiese);
  b.box(2.6, 0.03, 2.6, { c: 0x2f6b78, p: 0 }, 0, 0.0, 0); // Wassergraben
  const H = 0.55, E = 0.85;
  // Hauptwall (geböscht)
  b.add(new THREE.CylinderGeometry(E * 1.05, E * 1.25, H, 4, 1).rotateY(Math.PI / 4), M.mauer, 0, H / 2, 0);
  b.add(new THREE.CylinderGeometry(E * 1.0, E * 1.04, 0.05, 4, 1).rotateY(Math.PI / 4), M.wiese, 0, H + 0.02, 0);
  // Bastionen an den Ecken (Rauten)
  for (const [x, z] of [[-E, -E], [E, -E], [-E, E], [E, E]]) {
    b.add(new THREE.CylinderGeometry(0.36, 0.46, H, 4, 1), M.mauer, x, H / 2, z);
    b.add(new THREE.CylinderGeometry(0.34, 0.36, 0.04, 4, 1), M.pflaster, x, H + 0.02, z);
    const a = Math.atan2(x, z);
    b.add(new THREE.CylinderGeometry(0.025, 0.035, 0.3, 8).rotateX(Math.PI / 2), M.eisen, x + Math.sin(a) * 0.18, H + 0.1, z + Math.cos(a) * 0.18, a);
    b.box(0.12, 0.06, 0.16, M.bretterDunkel, x + Math.sin(a) * 0.05, H + 0.04, z + Math.cos(a) * 0.05, a);
    b.cyl(0.06, 0.07, 0.16, 8, M.mauer, x + Math.sin(a) * 0.32, H, z + Math.cos(a) * 0.32); // Wachhäuschen
    b.cone(0.075, 0.1, 8, M.schiefer, x + Math.sin(a) * 0.32, H + 0.16, z + Math.cos(a) * 0.32);
  }
  // Tor + Brücke
  b.box(0.35, 0.45, 0.2, M.mauerDunkel, 0, 0, E * 1.12);
  gateDoors(b, 0.24, 0.32, E * 1.12 + 0.11);
  b.box(0.26, 0.04, 0.4, M.bretter, 0, 0.02, E * 1.12 + 0.3);
  // Zitadelle
  b.box(0.9, 0.55, 0.7, M.putz, 0, H, -0.1);
  b.roof(0.9, 0.4, 0.7, M.ziegelBraun, 0, H + 0.55, -0.1, Math.PI / 2);
  for (let i = 0; i < 4; i++) b.window(-0.3 + i * 0.2, H + 0.4, 0.255, 0, 0.07, 0.12, M.balken);
  b.door(0, H, 0.255, 0, 0.14, 0.24);
  tower(b, 0.42, -0.4, 0.14, H + 0.95, true, false);
  b.flagPole(0, H + 0.95, -0.1, 0.55);
  // Pulverfässer, Kugeln
  for (let i = 0; i < 3; i++) b.barrel(-0.5 + i * 0.12, 0.45, H);
  for (let i = 0; i < 6; i++) b.sphere(0.03, M.eisen, 0.35 + (i % 3) * 0.06, H + 0.03 + Math.floor(i / 3) * 0.05, 0.45);
  return b.build();
}

/** Triumphbogen: Sockel, Säulen, Bogen, Attika mit Inschrift, Figurengruppe */
export function triumphbogen(): ModelDef {
  const b = new Builder();
  b.ground(2, 2, M.pflaster);
  const marmor = { c: 0xe9e3d6, p: 4 };
  b.box(1.7, 0.1, 0.8, M.mauerDunkel, 0, 0, 0);
  for (const s of [-1, 1]) {
    b.box(0.5, 1.05, 0.62, marmor, s * 0.55, 0.1, 0);
    for (const fz of [-0.34, 0.34]) for (const fx of [-0.17, 0.17]) {
      const x = s * 0.55 + fx;
      b.cyl(0.045, 0.05, 0.9, 10, marmor, x, 0.15, fz);
      b.box(0.11, 0.05, 0.11, marmor, x, 0.1, fz);
      b.box(0.12, 0.06, 0.12, M.gold, x, 1.05, fz);
    }
    b.box(0.2, 0.3, 0.02, { c: 0xcfc6b3, p: 0 }, s * 0.55, 0.55, 0.32); // Relief
    b.sphere(0.06, { c: 0x7a9a5a, p: 10 }, s * 0.55, 0.85, 0.33, 1.4, 1, 0.3); // Lorbeer
  }
  // Bogen
  b.add(new THREE.CylinderGeometry(0.33, 0.33, 0.62, 16, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), marmor, 0, 0.82, 0);
  b.box(0.6, 0.3, 0.62, marmor, 0, 0.95, 0);
  b.add(new THREE.TorusGeometry(0.34, 0.035, 6, 16, Math.PI), M.gold, 0, 0.82, 0.32);
  b.box(1.65, 0.08, 0.7, marmor, 0, 1.15, 0);
  b.box(1.4, 0.32, 0.6, marmor, 0, 1.23, 0); // Attika
  b.box(0.9, 0.16, 0.02, M.gold, 0, 1.31, 0.305);
  b.box(1.5, 0.05, 0.66, marmor, 0, 1.55, 0);
  b.box(1.52, 0.02, 0.68, M.gold, 0, 1.53, 0);
  // Figurengruppe: Wagen mit vier Pferden
  b.box(0.22, 0.12, 0.14, M.gold, 0, 1.6, -0.05);
  for (let i = 0; i < 4; i++) {
    const x = -0.24 + i * 0.16;
    b.sphere(0.05, bronze, x, 1.72, 0.14, 0.7, 0.7, 1.4);
    b.add(new THREE.CylinderGeometry(0.02, 0.025, 0.1, 6), bronze, x, 1.78, 0.2, 0, -0.6);
    b.sphere(0.025, bronze, x, 1.83, 0.24, 0.8, 0.8, 1.3);
    for (const [lx, lz] of [[-0.02, 0.08], [0.02, 0.08], [-0.02, 0.2], [0.02, 0.2]]) b.box(0.012, 0.1, 0.012, bronze, x + lx, 1.6, lz);
  }
  b.group(0, 1.66, 0, 0, (g) => g.person(0, -0.05, 0, M.gold, 1.4));
  b.flagPole(-0.7, 1.58, 0, 0.4);
  b.flagPole(0.7, 1.58, 0, 0.4);
  return b.build();
}
