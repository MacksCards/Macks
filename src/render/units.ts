// Soldaten: detailreiche Figuren (Schwertkämpfer, Reiter, Musketier, Kanonier) mit Lauf- und Angriffsbewegung.
// Jede Figur besteht aus wenigen Teilen (Körper, Beine, Waffenarm …); jedes Teil ist eine Instanzen-Gruppe,
// damit auch 200 Soldaten flüssig laufen. Teile in Besitzerfarbe werden pro Soldat eingefärbt.
import * as THREE from 'three';
import type { UnitType } from '../data';
import type { Game, Unit } from '../game';
import { Builder, M, Paint } from './kit';
import { buildingMaterial } from './materials';
import { flushInstances } from './instances';

/** Maßstab: Figuren werden in „1 = Körpergröße“ gebaut */
const S = 0.5;
/** Plätze je Figurenteil: höchstens 99 Soldaten je Spieler, gezeichnet werden nur die in Kameranähe */
const MAX = 128;

const haut = 0xe2b896, hautDunkel = 0xc99a74;
const leder = { c: 0x5e3f26, p: 0 }, lederHell = { c: 0x8a6036, p: 0 };
const hose = { c: 0x4a4038, p: 0 }, stiefel = { c: 0x2a211b, p: 0 };
const stahl = { c: 0xaab0b8, p: 0 }, stahlDunkel = { c: 0x6c7178, p: 0 };
const messing = { c: 0xc9a24a, p: 0 }, bronze = { c: 0x9a7038, p: 0 };
const WEISS = 0xffffff; // eingefärbte Teile: weiß bauen, Farbe kommt pro Soldat
const fell = { c: 0x6b4426, p: 0 }, fellDunkel = { c: 0x3a2618, p: 0 };

type Anim = 'none' | 'legL' | 'legR' | 'hfl' | 'hfr' | 'hbl' | 'hbr' | 'swing' | 'musket' | 'recoil' | 'ram';
interface PartDef { geo: THREE.BufferGeometry; pivot: [number, number, number]; anim: Anim; tint?: boolean; metal?: boolean }
interface Kind { parts: PartDef[]; ring: number; bar: number }

// ---------- Bauteile ----------

/** Kopf mit Gesicht, Hals */
function head(b: Builder, y: number, skin = haut) {
  b.cyl(0.035, 0.04, 0.06, 8, skin, 0, y - 0.1, 0);
  b.sphere(0.075, skin, 0, y, 0, 0.92, 1.05, 0.98, 10);
  b.sphere(0.016, hautDunkel, 0, y - 0.005, 0.072, 1, 1.2, 1, 5); // Nase
  b.box(0.012, 0.01, 0.01, 0x2a1d14, -0.026, y + 0.018, 0.066); b.box(0.012, 0.01, 0.01, 0x2a1d14, 0.026, y + 0.018, 0.066); // Augen
  b.sphere(0.066, 0x4a3020, 0, y + 0.022, -0.02, 1, 0.8, 1, 8); // Haar
  b.box(0.05, 0.03, 0.02, 0x4a3020, 0, y - 0.055, 0.058); // Bart
}

/** Rumpf mit Rock, Gürtel; c = Stoff */
function torso(b: Builder, c: Paint, y0 = 0.42) {
  b.cyl(0.12, 0.165, 0.16, 10, c, 0, y0 - 0.02, 0); // Rockschoß
  b.cyl(0.135, 0.12, 0.32, 10, c, 0, y0 + 0.12, 0); // Oberkörper
  b.sphere(0.07, c, -0.13, y0 + 0.4, 0, 1, 0.8, 1, 7); b.sphere(0.07, c, 0.13, y0 + 0.4, 0, 1, 0.8, 1, 7); // Schultern
  b.cyl(0.128, 0.128, 0.035, 10, leder, 0, y0 + 0.12, 0);
  b.box(0.04, 0.03, 0.02, messing, 0, y0 + 0.125, 0.128); // Schnalle
}

/** linker Arm, hängend (statisch), Hand vorne */
function armLeft(b: Builder, c: Paint, y = 0.82, fwd = 0.04) {
  b.add(new THREE.CylinderGeometry(0.038, 0.032, 0.3, 7), c, -0.165, y - 0.16, fwd, 0, -0.25, 0.08);
  b.sphere(0.032, haut, -0.175, y - 0.32, fwd + 0.07, 1, 1, 1, 6);
}

/** Bein mit Hose, Strumpf, Stiefel – Drehpunkt Hüfte (0, 0.42, 0) → Geometrie relativ dazu */
function legGeo(x: number, pants: Paint = hose, boots: Paint = stiefel): THREE.BufferGeometry {
  const b = new Builder();
  b.cyl(0.055, 0.046, 0.22, 7, pants, x, -0.22, 0);
  b.cyl(0.044, 0.04, 0.12, 7, boots, x, -0.34, 0);
  b.cyl(0.05, 0.046, 0.06, 7, boots, x, -0.24, 0); // Stulpe
  b.box(0.075, 0.05, 0.14, boots, x, -0.42, 0.03);
  return b.geometry();
}

function geo(fn: (b: Builder) => void): THREE.BufferGeometry { const b = new Builder(); fn(b); return b.geometry(); }

// ---------- Figuren ----------

function infanterie(): Kind {
  const body = geo((b) => {
    torso(b, { c: 0x6a5a48, p: 0 });
    head(b, 0.92);
    armLeft(b, { c: 0x6a5a48, p: 0 }, 0.82, 0.06);
    // Schwertscheide am Gürtel
    b.add(new THREE.BoxGeometry(0.025, 0.28, 0.04), leder, 0.15, 0.38, -0.04, 0, 0.35, 0);
  });
  const metal = geo((b) => {
    b.cyl(0.142, 0.128, 0.24, 10, stahl, 0, 0.6, 0.004); // Brustpanzer
    b.box(0.02, 0.2, 0.02, stahlDunkel, 0, 0.62, 0.142);
    for (const s of [-1, 1]) b.sphere(0.075, stahl, s * 0.14, 0.82, 0, 1, 0.7, 1.1, 8); // Schulterstücke
    // Morion-Helm: Kalotte, hochgezogene Krempe, Kamm
    b.sphere(0.085, stahl, 0, 0.97, 0, 1, 0.9, 1.05, 10);
    b.add(new THREE.CylinderGeometry(0.14, 0.15, 0.02, 14), stahl, 0, 0.955, 0, 0, 0, 0, 1, 1, 1.15);
    b.box(0.015, 0.06, 0.16, stahlDunkel, 0, 1.03, 0);
    // Schild links: Rand + Buckel
    b.add(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 16).rotateZ(Math.PI / 2), stahlDunkel, -0.22, 0.58, 0.1, 0.3);
    b.sphere(0.035, stahl, -0.235, 0.58, 0.105, 1, 1, 1, 8);
  });
  const tint = geo((b) => {
    b.add(new THREE.CylinderGeometry(0.13, 0.13, 0.025, 16).rotateZ(Math.PI / 2), WEISS, -0.225, 0.58, 0.1, 0.3); // Schildfläche
    b.add(new THREE.BoxGeometry(0.035, 0.36, 0.02), WEISS, 0.0, 0.62, 0.145, 0, 0, 0.75); // Schärpe
    b.add(new THREE.ConeGeometry(0.03, 0.16, 6), WEISS, 0, 1.1, -0.05, 0, -0.5); // Federbusch
    b.sphere(0.035, WEISS, 0, 1.07, -0.02, 1.2, 1, 1.4, 6);
  });
  const arm = geo((b) => { // rechter Arm mit Schwert, Drehpunkt Schulter
    b.cyl(0.038, 0.032, 0.3, 7, { c: 0x6a5a48, p: 0 }, 0, -0.32, 0);
    b.sphere(0.032, haut, 0, -0.34, 0.02, 1, 1, 1, 6);
  });
  const sword = geo((b) => {
    b.box(0.03, 0.03, 0.08, leder, 0, -0.34, 0.04); // Griff
    b.box(0.12, 0.018, 0.02, messing, 0, -0.34, 0.09); // Parierstange
    b.box(0.025, 0.012, 0.42, stahl, 0, -0.34, 0.3); // Klinge
    b.sphere(0.018, messing, 0, -0.34, 0.0, 1, 1, 1, 5);
  });
  return {
    parts: [
      { geo: body, pivot: [0, 0, 0], anim: 'none' },
      { geo: metal, pivot: [0, 0, 0], anim: 'none', metal: true },
      { geo: tint, pivot: [0, 0, 0], anim: 'none', tint: true },
      { geo: legGeo(-0.06), pivot: [0, 0.44, 0], anim: 'legL' },
      { geo: legGeo(0.06), pivot: [0, 0.44, 0], anim: 'legR' },
      { geo: arm, pivot: [0.17, 0.82, 0.02], anim: 'swing' },
      { geo: sword, pivot: [0.17, 0.82, 0.02], anim: 'swing', metal: true },
    ],
    ring: 0.55, bar: 1.25,
  };
}

function musketier(): Kind {
  const coat = WEISS;
  const body = geo((b) => {
    head(b, 0.92);
    b.cyl(0.128, 0.128, 0.035, 10, leder, 0, 0.54, 0);
    b.box(0.04, 0.03, 0.02, messing, 0, 0.545, 0.128);
    // breitkrempiger Hut
    b.add(new THREE.CylinderGeometry(0.17, 0.17, 0.018, 16), 0x2a2420, 0, 0.985, 0, 0, -0.12);
    b.cyl(0.07, 0.085, 0.1, 10, 0x2a2420, 0, 0.99, 0);
    b.cyl(0.087, 0.087, 0.02, 10, leder, 0, 1.0, 0);
    // Bandelier mit Pulverfläschchen
    b.add(new THREE.BoxGeometry(0.03, 0.42, 0.02), lederHell, 0, 0.66, 0.135, 0, 0, -0.7);
    for (let i = 0; i < 5; i++) b.cyl(0.013, 0.013, 0.05, 6, 0xd8cfb8, -0.1 + i * 0.045, 0.56 + i * 0.05, 0.145);
    b.box(0.05, 0.08, 0.04, leder, 0.12, 0.4, 0.06); // Tasche
    b.add(new THREE.BoxGeometry(0.02, 0.24, 0.035), leder, -0.15, 0.36, -0.03, 0, 0.3, 0); // Degen
    b.box(0.13, 0.04, 0.06, 0xe8e0d0, 0, 0.82, 0.08); // Kragen
  });
  const tint = geo((b) => {
    torso(b, coat);
    armLeft(b, coat, 0.82, 0.1);
    b.add(new THREE.ConeGeometry(0.025, 0.2, 5), WEISS, 0.1, 1.07, -0.04, 0, -0.9, -0.3); // Feder
  });
  const arm = geo((b) => { // rechter Arm hält die Muskete; Ruhe = geschultert, Angriff = angelegt
    b.add(new THREE.CylinderGeometry(0.038, 0.032, 0.26, 7).rotateX(Math.PI / 2), WEISS, 0, -0.06, 0.12);
    b.sphere(0.032, haut, 0, -0.06, 0.26, 1, 1, 1, 6);
  });
  const musket = geo((b) => {
    b.add(new THREE.BoxGeometry(0.035, 0.05, 0.26), { c: 0x6b4426, p: 0 }, -0.03, -0.07, 0.1); // Schaft
    b.add(new THREE.CylinderGeometry(0.012, 0.014, 0.55, 7).rotateX(Math.PI / 2), stahlDunkel, -0.03, -0.045, 0.48); // Lauf
    b.box(0.02, 0.03, 0.04, messing, -0.03, -0.035, 0.22); // Schloss
  });
  return {
    parts: [
      { geo: body, pivot: [0, 0, 0], anim: 'none' },
      { geo: tint, pivot: [0, 0, 0], anim: 'none', tint: true },
      { geo: legGeo(-0.06, { c: 0x3a3430, p: 0 }), pivot: [0, 0.44, 0], anim: 'legL' },
      { geo: legGeo(0.06, { c: 0x3a3430, p: 0 }), pivot: [0, 0.44, 0], anim: 'legR' },
      { geo: arm, pivot: [0.16, 0.8, 0], anim: 'musket', tint: true },
      { geo: musket, pivot: [0.16, 0.8, 0], anim: 'musket', metal: true },
    ],
    ring: 0.55, bar: 1.3,
  };
}

function reiter(): Kind {
  // Pferd: Länge entlang z (Kopf vorne), Rücken auf ~0,62
  const horse = geo((b) => {
    b.sphere(0.2, fell, 0, 0.66, 0, 0.9, 0.85, 2.1, 12); // Rumpf
    b.sphere(0.17, fell, 0, 0.7, 0.26, 0.9, 1, 1, 10); // Brust
    b.sphere(0.16, fell, 0, 0.68, -0.27, 0.95, 0.95, 1, 10); // Kruppe
    b.add(new THREE.CylinderGeometry(0.07, 0.11, 0.36, 9), fell, 0, 0.9, 0.38, 0, 0.75); // Hals
    b.add(new THREE.BoxGeometry(0.1, 0.11, 0.26), fell, 0, 1.04, 0.56, 0, 0.35); // Kopf
    b.add(new THREE.BoxGeometry(0.08, 0.08, 0.08), fellDunkel, 0, 0.99, 0.68, 0, 0.35); // Maul
    for (const s of [-1, 1]) b.add(new THREE.ConeGeometry(0.022, 0.07, 4), fell, s * 0.035, 1.14, 0.48);
    b.add(new THREE.BoxGeometry(0.03, 0.3, 0.06), fellDunkel, 0, 1.0, 0.36, 0, 0.75); // Mähne
    b.add(new THREE.CylinderGeometry(0.035, 0.02, 0.36, 6), fellDunkel, 0, 0.56, -0.5, 0, -0.5); // Schweif
    // Sattel + Zaumzeug
    b.add(new THREE.CylinderGeometry(0.17, 0.17, 0.2, 10, 1, false, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), leder, 0, 0.78, -0.02);
    b.box(0.2, 0.05, 0.04, leder, 0, 0.86, 0.09);
    b.box(0.012, 0.15, 0.012, leder, -0.08, 0.62, 0.0); b.box(0.012, 0.15, 0.012, leder, 0.08, 0.62, 0.0);
    b.box(0.11, 0.015, 0.015, leder, 0, 1.02, 0.63);
    // Reiter: Beine im Sattel, Rumpf
    for (const s of [-1, 1]) {
      b.add(new THREE.CylinderGeometry(0.05, 0.045, 0.26, 7), hose, s * 0.15, 0.73, 0.06, 0, 0.9, s * 0.25);
      b.cyl(0.045, 0.04, 0.2, 7, stiefel, s * 0.19, 0.5, 0.12);
      b.box(0.07, 0.04, 0.12, stiefel, s * 0.19, 0.48, 0.15);
    }
    head(b, 1.42);
  });
  const metal = geo((b) => {
    b.cyl(0.14, 0.126, 0.26, 10, stahl, 0, 1.08, 0.004);
    for (const s of [-1, 1]) b.sphere(0.07, stahl, s * 0.14, 1.32, 0, 1, 0.7, 1.1, 8);
    // Sturmhaube mit Wangenklappen
    b.sphere(0.084, stahl, 0, 1.47, 0, 1, 0.95, 1.08, 10);
    b.add(new THREE.CylinderGeometry(0.11, 0.12, 0.018, 14), stahl, 0, 1.44, 0.02, 0, 0.15);
    for (const s of [-1, 1]) b.box(0.015, 0.07, 0.05, stahlDunkel, s * 0.075, 1.39, 0.01);
    b.box(0.03, 0.03, 0.04, stahl, 0, 1.03, 0.6); // Stirnplatte
  });
  const tint = geo((b) => {
    b.add(new THREE.BoxGeometry(0.42, 0.2, 0.36), WEISS, 0, 0.68, -0.02); // Satteldecke
    b.cyl(0.12, 0.17, 0.16, 10, WEISS, 0, 0.9, 0); // Rockschoß
    b.cyl(0.13, 0.12, 0.08, 10, WEISS, 0, 1.03, 0);
    b.add(new THREE.ConeGeometry(0.035, 0.18, 6), WEISS, 0, 1.6, -0.05, 0, -0.6); // Federbusch
    armLeft(b, WEISS, 1.32, 0.12);
  });
  const arm = geo((b) => {
    b.cyl(0.038, 0.032, 0.3, 7, WEISS, 0, -0.32, 0);
    b.sphere(0.032, haut, 0, -0.34, 0.02, 1, 1, 1, 6);
  });
  const saber = geo((b) => {
    b.box(0.03, 0.03, 0.08, leder, 0, -0.34, 0.04);
    b.add(new THREE.TorusGeometry(0.04, 0.008, 4, 8, Math.PI), messing, 0, -0.34, 0.06, 0, 0, Math.PI / 2);
    b.add(new THREE.BoxGeometry(0.022, 0.01, 0.4), stahl, 0, -0.33, 0.3, 0, -0.12);
  });
  const leg = (x: number, z: number) => geo((b) => {
    b.cyl(0.04, 0.05, 0.2, 7, fell, x, -0.22, z);
    b.cyl(0.025, 0.03, 0.22, 7, fell, x, -0.42, z);
    b.cyl(0.032, 0.034, 0.05, 7, fellDunkel, x, -0.5, z + 0.005); // Huf
    b.sphere(0.032, fell, x, -0.3, z, 1, 1.2, 1, 6); // Gelenk
  });
  return {
    parts: [
      { geo: horse, pivot: [0, 0, 0], anim: 'none' },
      { geo: metal, pivot: [0, 0, 0], anim: 'none', metal: true },
      { geo: tint, pivot: [0, 0, 0], anim: 'none', tint: true },
      { geo: leg(-0.1, 0), pivot: [0, 0.52, 0.28], anim: 'hfl' },
      { geo: leg(0.1, 0), pivot: [0, 0.52, 0.28], anim: 'hfr' },
      { geo: leg(-0.1, 0), pivot: [0, 0.52, -0.3], anim: 'hbl' },
      { geo: leg(0.1, 0), pivot: [0, 0.52, -0.3], anim: 'hbr' },
      { geo: arm, pivot: [0.17, 1.32, 0.02], anim: 'swing', tint: true },
      { geo: saber, pivot: [0.17, 1.32, 0.02], anim: 'swing', metal: true },
    ],
    ring: 0.8, bar: 1.85,
  };
}

function kanonier(): Kind {
  // Feldkanone vorne (Mündung nach +z), Kanonier steht links dahinter
  const gun = geo((b) => {
    // Lafette mit Schwanz
    for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(0.035, 0.09, 0.62), { c: 0x6b4a2b, p: 3 }, s * 0.07, 0.17, -0.12, 0, -0.18);
    b.box(0.16, 0.05, 0.12, { c: 0x5a3d26, p: 0 }, 0, 0.17, 0.05);
    b.box(0.1, 0.04, 0.1, { c: 0x5a3d26, p: 0 }, 0, 0.06, -0.42);
    // Räder mit Speichen und Eisenreifen
    for (const s of [-1, 1]) {
      b.add(new THREE.TorusGeometry(0.15, 0.018, 5, 16), stahlDunkel, s * 0.15, 0.17, 0.05, Math.PI / 2);
      b.add(new THREE.TorusGeometry(0.135, 0.016, 5, 16), { c: 0x6b4a2b, p: 0 }, s * 0.15, 0.17, 0.05, Math.PI / 2);
      for (let i = 0; i < 6; i++) b.add(new THREE.BoxGeometry(0.012, 0.27, 0.014), { c: 0x7a5432, p: 0 }, s * 0.15, 0.17, 0.05, 0, (i / 6) * Math.PI);
      b.add(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8).rotateZ(Math.PI / 2), stahlDunkel, s * 0.15, 0.17, 0.05);
    }
    b.add(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 6).rotateZ(Math.PI / 2), stahlDunkel, 0, 0.17, 0.05); // Achse
    // Kugeln und Eimer
    for (let i = 0; i < 3; i++) b.sphere(0.028, 0x222224, -0.05 + i * 0.05, 0.03, -0.3, 1, 1, 1, 6);
    b.cyl(0.035, 0.03, 0.06, 8, M.holz, 0.12, 0, -0.3);
  });
  const barrel = geo((b) => {
    b.add(new THREE.CylinderGeometry(0.038, 0.055, 0.52, 12).rotateX(Math.PI / 2), bronze, 0, 0.25, 0.12);
    b.add(new THREE.CylinderGeometry(0.048, 0.048, 0.04, 12).rotateX(Math.PI / 2), bronze, 0, 0.25, 0.37); // Mündungswulst
    b.add(new THREE.CylinderGeometry(0.058, 0.058, 0.035, 12).rotateX(Math.PI / 2), bronze, 0, 0.25, -0.1);
    b.sphere(0.035, bronze, 0, 0.25, -0.15, 1, 1, 1, 8); // Traube
    b.add(new THREE.CylinderGeometry(0.02, 0.02, 0.15, 6).rotateZ(Math.PI / 2), bronze, 0, 0.25, 0.08); // Schildzapfen
  });
  const man = geo((b) => {
    head(b, 0.92);
    b.cyl(0.128, 0.128, 0.035, 10, leder, 0, 0.54, 0);
    b.box(0.13, 0.04, 0.06, 0xe8e0d0, 0, 0.82, 0.08);
    // Mütze
    b.cyl(0.072, 0.08, 0.06, 10, 0x2a2420, 0, 0.98, 0);
    b.sphere(0.06, 0x2a2420, 0, 1.03, -0.01, 1, 0.6, 1, 8);
    // Ansetzer (Stange mit Wischer) in der linken Hand
    b.add(new THREE.CylinderGeometry(0.01, 0.01, 0.95, 6), M.holz, -0.2, 0.62, 0.08, 0, 0.12);
    b.cyl(0.03, 0.03, 0.08, 7, 0x3a3430, -0.2, 1.05, 0.13);
  });
  const manTint = geo((b) => { torso(b, WEISS); armLeft(b, WEISS, 0.82, 0.06); });
  const manArm = geo((b) => {
    b.cyl(0.038, 0.032, 0.3, 7, WEISS, 0, -0.32, 0);
    b.sphere(0.032, haut, 0, -0.34, 0.02, 1, 1, 1, 6);
    b.box(0.01, 0.01, 0.16, M.dunkelholz, 0, -0.34, 0.08); // Lunte
    b.sphere(0.012, 0xffa040, 0, -0.34, 0.17, 1, 1, 1, 5);
  });
  const move = (g: THREE.BufferGeometry) => g.translate(-0.3, 0, -0.32);
  return {
    parts: [
      { geo: gun, pivot: [0, 0, 0], anim: 'none' },
      { geo: barrel, pivot: [0, 0, 0], anim: 'recoil', metal: true },
      { geo: move(man), pivot: [0, 0, 0], anim: 'none' },
      { geo: move(manTint), pivot: [0, 0, 0], anim: 'none', tint: true },
      { geo: legGeo(-0.06), pivot: [-0.3, 0.44, -0.32], anim: 'legL' },
      { geo: legGeo(0.06), pivot: [-0.3, 0.44, -0.32], anim: 'legR' },
      { geo: manArm, pivot: [-0.13, 0.82, -0.3], anim: 'ram', tint: true },
    ],
    ring: 0.65, bar: 1.3,
  };
}

const KINDS: Record<UnitType, () => Kind> = { infanterie, reiter, musketier, kanonier };

interface Track { x: number; y: number; ph: number; mv: number }
interface Dying { group: THREE.Group; t: number; mats: THREE.Material[]; axis: THREE.Vector3 }

export class UnitLayer {
  group = new THREE.Group();
  /** ausgewählte eigene Soldaten */
  selected = new Set<number>();
  private kinds = new Map<UnitType, { def: Kind; meshes: THREE.InstancedMesh[] }>();
  private mat = buildingMaterial();
  private metalMat = buildingMaterial({ metalness: 0.55, roughness: 0.38 });
  private rings: THREE.InstancedMesh;
  private track = new Map<number, Track>();
  private dying: Dying[] = [];
  private lastT = 0;
  private col = new THREE.Color();
  private tm = {
    base: new THREE.Matrix4(), part: new THREE.Matrix4(), tmp: new THREE.Matrix4(), q: new THREE.Quaternion(),
    e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3(),
  };
  /** sichtbare Soldaten mit Weltposition (für Lebensbalken und Antippen) */
  shown: { u: Unit; x: number; y: number; z: number; top: number }[] = [];
  // je Bild wiederverwendet (kein neuer Speicher)
  private counts = new Map<UnitType, number>();
  private alive = new Set<number>();
  private pz = { rx: 0, dz: 0 };

  constructor(private g: Game, private height: (x: number, z: number) => number) {
    for (const t of Object.keys(KINDS) as UnitType[]) {
      const def = KINDS[t]();
      const meshes = def.parts.map((p) => {
        const m = new THREE.InstancedMesh(p.geo, p.metal ? this.metalMat : this.mat, MAX);
        m.count = 0;
        m.visible = false;
        m.castShadow = true;
        m.frustumCulled = false;
        if (p.tint) m.setColorAt(0, this.col.setHex(0xffffff));
        this.group.add(m);
        return m;
      });
      this.kinds.set(t, { def, meshes });
    }
    this.rings = new THREE.InstancedMesh(new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9, depthWrite: false }), MAX);
    this.rings.count = 0;
    this.rings.visible = false;
    this.rings.frustumCulled = false;
    this.rings.renderOrder = 3;
    this.group.add(this.rings);
  }

  setGame(g: Game, height: (x: number, z: number) => number) {
    this.g = g; this.height = height;
    this.selected.clear(); this.track.clear();
    for (const d of this.dying) { this.group.remove(d.group); d.mats.forEach((m) => m.dispose()); }
    this.dying = [];
  }

  private visible(u: Unit) {
    if (u.ship !== undefined) return false;
    if (u.owner === 0) return true;
    const x = Math.floor(u.x), y = Math.floor(u.y);
    return this.g.inMap(x, y) && this.g.seen[this.g.idx(x, y)] === 1;
  }

  /** Winkel eines Teils (Drehung um x) bzw. Verschiebung (z) für die aktuelle Bewegung */
  private pose(anim: Anim, ph: number, mv: number, atk: number, kind: UnitType): { rx: number; dz: number } {
    const o = this.pz;
    o.dz = 0;
    o.rx = this.poseRx(anim, ph, mv, atk, kind);
    if (anim === 'musket' && atk < 0.15) o.dz = -0.04; // Rückstoß
    else if (anim === 'recoil' && atk < 0.5) o.dz = -0.12 * (1 - atk / 0.5);
    return o;
  }

  private poseRx(anim: Anim, ph: number, mv: number, atk: number, kind: UnitType): number {
    const sw = Math.sin(ph) * 0.65 * mv;
    switch (anim) {
      case 'legL': return sw;
      case 'legR': return -sw;
      case 'hfl': case 'hbr': return Math.sin(ph) * 0.55 * mv;
      case 'hfr': case 'hbl': return -Math.sin(ph) * 0.55 * mv;
      case 'swing': {
        if (atk < 0.4) { const k = atk / 0.4; return k < 0.35 ? 2.4 * (k / 0.35) : 2.4 - 3.0 * ((k - 0.35) / 0.65); }
        return kind === 'reiter' ? -0.5 : -sw * 0.5 - 0.15;
      }
      case 'musket': return atk < 1.4 ? (atk < 0.15 ? -0.25 * (1 - atk / 0.15) : 0) : -1.25; // angelegt bzw. geschultert
      case 'ram': return atk < 0.6 ? -0.9 + atk : -sw * 0.5;
      default: return 0;
    }
  }

  update(t: number, cam?: { x: number; z: number; dist: number }) {
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    const g = this.g, tm = this.tm;
    const counts = this.counts;
    counts.clear();
    let rings = 0;
    const alive = this.alive;
    alive.clear();
    this.shown.length = 0;
    const far = cam ? Math.max(40, cam.dist * 2.2) : 1e9;
    for (const u of g.units) {
      alive.add(u.id);
      // flüssige Position zwischen den Rechenschritten
      const [ux, uy] = g.ip(u), udir = g.ipDir(u);
      let tr = this.track.get(u.id);
      if (!tr) { tr = { x: ux, y: uy, ph: Math.random() * 6, mv: 0 }; this.track.set(u.id, tr); }
      const moved = Math.hypot(ux - tr.x, uy - tr.y);
      tr.x = ux; tr.y = uy;
      // Beine bewegen sich, solange der Soldat einen Weg hat (nicht nur bei Positionsänderung im Bild)
      const moving = dt > 0 && (moved > 0.0005 || u.path.length > 0);
      tr.mv += ((moving ? 1 : 0) - tr.mv) * Math.min(1, dt * 8);
      tr.ph += moved * (u.type === 'reiter' ? 7 : 13);
      if (!this.visible(u)) continue;
      if (cam && Math.abs(ux - cam.x) > far && Math.abs(uy - cam.z) > far) continue;
      const k = this.kinds.get(u.type);
      if (!k) continue;
      const i = counts.get(u.type) ?? 0;
      if (i >= MAX) continue;
      counts.set(u.type, i + 1);
      const gy = Math.max(0.02, this.height(ux, uy));
      const bob = Math.abs(Math.sin(tr.ph)) * 0.025 * tr.mv * (u.type === 'reiter' ? 2 : 1);
      tm.base.compose(tm.v.set(ux, gy + bob, uy), tm.q.setFromAxisAngle(tm.s.set(0, 1, 0), udir), tm.s.set(S, S, S));
      const atk = u.atk !== undefined ? g.time - u.atk : 99;
      const color = g.players[u.owner]?.color ?? 0xffffff;
      const parts = k.def.parts;
      for (let pi = 0; pi < parts.length; pi++) {
        const p = parts[pi], m = k.meshes[pi];
        if (p.anim === 'none') tm.part.copy(tm.base);
        else {
          const ps = this.pose(p.anim, tr.ph, tr.mv, atk, u.type);
          tm.tmp.makeRotationX(ps.rx);
          tm.part.makeTranslation(p.pivot[0], p.pivot[1], p.pivot[2] + ps.dz).multiply(tm.tmp);
          tm.part.premultiply(tm.base);
        }
        m.setMatrixAt(i, tm.part);
        if (p.tint) m.setColorAt(i, this.col.setHex(color));
      }
      if (this.selected.has(u.id) && rings < MAX) {
        const r = k.def.ring * S * 1.6;
        tm.part.compose(tm.v.set(ux, gy + 0.04, uy), tm.q.identity(), tm.s.set(r, 1, r));
        this.rings.setMatrixAt(rings++, tm.part);
      }
      this.shown.push({ u, x: ux, y: gy, z: uy, top: gy + k.def.bar * S });
    }
    for (const [t2, k] of this.kinds) {
      const n = counts.get(t2) ?? 0;
      for (let mi = 0; mi < k.meshes.length; mi++) flushInstances(k.meshes[mi], n);
    }
    flushInstances(this.rings, rings);
    for (const id of this.track.keys()) if (!alive.has(id)) this.track.delete(id);
    for (const id of this.selected) if (!alive.has(id)) this.selected.delete(id);
    this.animateDying(dt);
  }

  /** Soldat gefallen: Figur kippt um und verblasst */
  die(u: Unit) {
    if (!this.visible(u)) return;
    const k = this.kinds.get(u.type);
    if (!k) return;
    const grp = new THREE.Group();
    const mats: THREE.Material[] = [];
    const color = this.g.players[u.owner]?.color ?? 0xffffff;
    for (const p of k.def.parts) {
      const mat = buildingMaterial({ transparent: true, opacity: 1, ...(p.metal ? { metalness: 0.55, roughness: 0.38 } : {}), ...(p.tint ? { color } : {}) });
      mats.push(mat);
      const m = new THREE.Mesh(p.geo, mat);
      grp.add(m);
    }
    grp.position.set(u.x, Math.max(0.02, this.height(u.x, u.y)), u.y);
    grp.rotation.y = u.dir;
    grp.scale.setScalar(S);
    this.group.add(grp);
    const side = Math.random() < 0.5 ? -1 : 1;
    this.dying.push({ group: grp, t: 0, mats, axis: new THREE.Vector3(0, 0, side) });
  }

  private animateDying(dt: number) {
    for (const d of this.dying) {
      d.t += dt;
      const fall = Math.min(1, (d.t / 0.7) ** 2);
      d.group.children.forEach((c) => c.quaternion.setFromAxisAngle(d.axis, fall * Math.PI * 0.47));
      if (d.t > 2) for (const m of d.mats) { m.opacity = Math.max(0, 1 - (d.t - 2) / 1.5); }
    }
    if (!this.dying.length) return;
    const done = this.dying.filter((d) => d.t > 3.5);
    for (const d of done) { this.group.remove(d.group); d.mats.forEach((m) => m.dispose()); }
    if (done.length) this.dying = this.dying.filter((d) => d.t <= 3.5);
  }

  /** nächster sichtbarer Soldat am Bodenpunkt (großzügig für Finger) */
  pick(px: number, pz: number, r = 0.9): Unit | undefined {
    let best: Unit | undefined, bd = r;
    for (const s of this.shown) {
      const d = Math.hypot(s.x - px, s.z - pz);
      if (d < bd) { bd = d; best = s.u; }
    }
    return best;
  }
}
