// Marktplatz aus Code (3 x 3 Felder, -1,5 … +1,5; Vorderseite = +z, Boden = y 0).
// Realistisch statt bunt: gepflasterter Platz mit Randsteinen, Brunnen aus Stein, Holzstände mit
// Brettermaserung und Planen aus Leinen in verblichenen Erdtönen, darauf Waren (Obst, Fisch, Brot,
// Tuchballen) in Körben und Kisten; Fässer, Säcke und ein Handkarren dazwischen.
import * as THREE from 'three';
import { Builder, M, ModelDef, P, Paint, rand } from '../kit';

// Planen: ungefärbtes Leinen und verblichene Pflanzenfarben (Krapp, Ocker, Waid, Salbei)
const LEINEN: Paint = { c: 0xc2b594, p: P.tuch };
const PLANE: Paint[] = [
  { c: 0x9a6a55, p: P.tuch }, // verblichenes Krapprot
  { c: 0xb59a68, p: P.tuch }, // Ocker
  { c: 0x6f7b80, p: P.tuch }, // verblichenes Waidblau
  { c: 0x858a68, p: P.tuch }, // Salbeigrün
];
const THEKE: Paint = { c: 0x8a6440, p: P.bretter };
const KORB: Paint = { c: 0xa98a55, p: P.stroh };
const RAND: Paint = { c: 0x7d766a, p: P.mauer };
/** Kopfsteinpflaster, etwas dunkler und wärmer als Hofpflaster */
const PFLASTER: Paint = { c: 0xa99d86, p: P.pflaster };
const BECKEN: Paint = { c: 0x948b7c, p: P.mauer };
const STEIN_HELL: Paint = { c: 0xb2a68c, p: P.glatt };
const STEIN: Paint = { c: 0xa69a80, p: P.mauer };

/** Ware auf einer Theke (Mitte x/z, Oberkante y) */
type Ware = 'obst' | 'fisch' | 'brot' | 'tuch' | 'gemuese';

function ware(b: Builder, kind: Ware, x: number, y: number, z: number, r: () => number) {
  switch (kind) {
    case 'obst': {
      // flacher Korb mit Äpfeln und Birnen
      b.cyl(0.09, 0.07, 0.05, 10, KORB, x, y, z);
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9 + r(), d = i ? 0.045 : 0;
        b.sphere(0.024, i % 3 ? 0xa2452f : 0xa8a04a, x + Math.cos(a) * d, y + 0.06 + (i ? 0 : 0.015), z + Math.sin(a) * d, 1, 1, 1, 6);
      }
      break;
    }
    case 'gemuese': {
      b.cyl(0.085, 0.07, 0.05, 10, KORB, x, y, z);
      for (let i = 0; i < 5; i++) b.sphere(0.03, i % 2 ? 0x6f8f3e : 0x8a9a52, x + (i - 2) * 0.03, y + 0.065, z + ((i % 2) - 0.5) * 0.04, 1, 0.85, 1, 6);
      break;
    }
    case 'fisch': {
      // Brett mit Fischen
      b.box(0.24, 0.015, 0.14, M.bretterDunkel, x, y, z);
      for (let i = 0; i < 4; i++) b.sphere(0.022, 0x8d989b, x - 0.075 + i * 0.05, y + 0.03, z + (i % 2 ? 0.02 : -0.02), 0.9, 0.5, 2.8, 6);
      break;
    }
    case 'brot': {
      b.cyl(0.09, 0.07, 0.045, 10, KORB, x, y, z);
      for (let i = 0; i < 4; i++) b.sphere(0.03, 0xa8743f, x + (i % 2 ? 0.035 : -0.035), y + 0.06, z + (i < 2 ? 0.03 : -0.03), 1.4, 0.7, 1, 6);
      break;
    }
    case 'tuch': {
      // Tuchballen, liegend gestapelt
      const cols = [0xc9bc9c, 0x8a6a52, 0x6f7578];
      for (let i = 0; i < 3; i++) b.log(0.03, 0.2, { c: cols[i], p: P.tuch }, x, y + 0.03 + (i === 2 ? 0.05 : 0), z + (i === 2 ? 0 : (i - 0.5) * 0.065), 0, 8);
      break;
    }
  }
}

/** Marktstand: Theke aus Brettern, vier Pfosten, schräge Plane mit Streifen und Saum */
function stall(b: Builder, x: number, z: number, ry: number, plane: Paint, goods: Ware[], seed: number) {
  const r = rand(seed);
  b.group(x, 0, z, ry, (g) => {
    const w = 0.7, d = 0.36, h = 0.3;
    // Theke: Kasten aus Brettern mit dunkler Deckplatte
    g.box(w, h, d, THEKE, 0, 0, 0);
    g.box(w + 0.04, 0.025, d + 0.04, M.bretterDunkel, 0, h, 0);
    // Pfosten (vorne niedriger: die Plane fällt nach vorne ab)
    for (const sx of [-1, 1]) {
      g.box(0.035, 0.66, 0.035, M.balken, sx * (w / 2 - 0.01), 0, -d / 2 - 0.02);
      g.box(0.035, 0.56, 0.035, M.balken, sx * (w / 2 - 0.01), 0, d / 2 + 0.12);
    }
    // Plane: Bahnen abwechselnd aus Leinen und gefärbt, von hinten (y 0,66) nach vorne (y 0,55) abfallend
    const z0 = -0.23, z1 = 0.34, slope = 0.2;
    const tilt = Math.atan(slope), len = (z1 - z0) / Math.cos(tilt);
    const n = 6, bw = (w + 0.12) / n;
    for (let i = 0; i < n; i++) {
      g.add(new THREE.BoxGeometry(bw + 0.002, 0.012, len), i % 2 ? LEINEN : plane, -(w + 0.12) / 2 + bw * (i + 0.5), 0.66 - slope * ((z0 + z1) / 2 + 0.2) - (i % 2) * 0.003, (z0 + z1) / 2, 0, tilt);
    }
    // Saum vorne: kurze hängende Lappen
    const front = 0.66 - slope * (z1 + 0.2);
    for (let i = 0; i < 7; i++) g.box(0.1, 0.06, 0.008, i % 2 ? plane : LEINEN, -0.36 + i * 0.12, front - 0.06, z1);
    // Waren auf der Theke
    goods.forEach((k, i) => ware(g, k, -0.2 + i * 0.2, h + 0.025, 0.02 + (r() - 0.5) * 0.06, r));
    // hinter der Theke: Kiste und Fass
    g.crate(-0.2, -d / 2 - 0.16, 0, 0.15, r());
    g.barrel(0.22, -d / 2 - 0.15, 0, 0.07, 0.17);
  });
}

export function marktModel(): ModelDef {
  const b = new Builder();
  // Platz: Pflaster mit Randsteinen
  b.ground(3, 3, PFLASTER);
  for (const s of [-1, 1]) {
    b.box(2.92, 0.05, 0.08, RAND, 0, -0.02, s * 1.44);
    b.box(0.08, 0.05, 2.92, RAND, s * 1.44, -0.02, 0);
  }
  // Brunnen aus Stein: achteckiges Becken, Säule mit Schale, Wasser
  b.cyl(0.44, 0.47, 0.24, 8, BECKEN, 0, 0, 0);
  b.cyl(0.48, 0.48, 0.05, 8, STEIN_HELL, 0, 0.22, 0);
  b.cyl(0.4, 0.4, 0.02, 16, M.wasser, 0, 0.245, 0);
  b.cyl(0.07, 0.1, 0.42, 8, STEIN, 0, 0.25, 0);
  b.cyl(0.17, 0.08, 0.08, 12, STEIN_HELL, 0, 0.62, 0);
  b.cyl(0.145, 0.145, 0.012, 12, M.wasser, 0, 0.69, 0);
  b.cyl(0.03, 0.045, 0.12, 8, STEIN, 0, 0.69, 0);
  b.sphere(0.04, STEIN_HELL, 0, 0.83, 0, 1, 1, 1, 8);
  // Wasserstrahlen aus der Schale ins Becken
  // (von der Schale in r = 0,16 / y = 0,66 schräg nach außen bis ins Becken r = 0,3 / y = 0,26)
  const tilt = Math.atan2(0.14, 0.4), jet = Math.hypot(0.14, 0.4);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    b.group(Math.cos(a) * 0.23, 0.46, Math.sin(a) * 0.23, -a, (g) => {
      g.add(new THREE.CylinderGeometry(0.007, 0.011, jet, 5), { c: 0x9cc4d8, p: P.glas }, 0, 0, 0, 0, 0, tilt);
    });
  }
  // Eimer am Brunnenrand
  b.cyl(0.045, 0.038, 0.07, 8, M.bretterDunkel, 0.36, 0.27, 0.22);
  // Stände rund um den Brunnen, Rücken zum Rand
  stall(b, -0.85, -0.95, 0, PLANE[0], ['obst', 'gemuese', 'obst'], 3);
  stall(b, 0.85, -0.95, 0, PLANE[1], ['brot', 'brot', 'gemuese'], 5);
  stall(b, -0.95, 0.75, Math.PI / 2, PLANE[2], ['fisch', 'fisch'], 7);
  stall(b, 0.95, 0.75, -Math.PI / 2, PLANE[3], ['tuch', 'tuch', 'tuch'], 9);
  // Fässer, Säcke, Kisten dazwischen
  b.barrel(-0.25, -1.3, 0, 0.08, 0.19).barrel(-0.08, -1.32, 0, 0.08, 0.19).barrel(-0.17, -1.17, 0, 0.07, 0.17);
  b.sack(0.58, 1.3).sack(0.7, 1.33).sack(0.64, 1.22, 0.08);
  b.crate(-1.15, -0.15, 0, 0.17, 0.4).crate(-1.15, -0.15, 0.17, 0.13, 0.9).crate(-1.0, 0.05, 0, 0.15, 0.1);
  b.barrel(1.15, -0.2, 0, 0.08, 0.19).barrel(1.2, -0.02, 0, 0.08, 0.19);
  // Handkarren mit Säcken
  b.group(0.0, 0, 1.0, 0.3, (g) => {
    g.box(0.36, 0.03, 0.22, THEKE, 0, 0.11, 0);
    for (const s of [-1, 1]) g.box(0.36, 0.06, 0.015, M.bretterDunkel, 0, 0.14, s * 0.11);
    for (const s of [-1, 1]) g.log(0.075, 0.025, M.dunkelholz, 0, 0.075, s * 0.13, Math.PI / 2, 12);
    g.add(new THREE.BoxGeometry(0.4, 0.02, 0.02), M.holz, -0.32, 0.12, 0.08, 0, 0, 0.1);
    g.add(new THREE.BoxGeometry(0.4, 0.02, 0.02), M.holz, -0.32, 0.12, -0.08, 0, 0, 0.1);
    g.sack(0.05, 0, 0.14, 0xc8b48a).sack(-0.08, 0.03, 0.14, 0xb8a47a);
  });
  // Fahne des Besitzers an der Ecke
  b.flagPole(1.38, 0, -1.38, 1.0);
  return b.build();
}
