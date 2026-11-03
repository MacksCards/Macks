// Schutzgebäude gegen die Ereignisse (Paket S3) aus Code – bis es Meshy-Modelle dafür gibt.
// Feuerwehr (2 × 2): Spritzenhaus mit offenem Tor, Schlauchturm mit Glocke, Handdruckspritze auf Rädern,
//   Leiter, Ledereimer, Wassertrog und Fässer.
// Arzt (2 × 2): Haus mit Steinsockel und Fachwerk, Kräutergarten mit Beeten, Trockengestell, Bank, Schild.
// Galgen (1 × 1): Holzgerüst auf einem Podest mit Treppe und Geländer (ohne Gehängten).
// Maßstab wie kit.ts: 1 Einheit = 1 Feld, Mitte auf (0,0,0), Vorderseite = +z, Boden = y 0.
import * as THREE from 'three';
import { Builder, M, ModelDef, P, Paint } from '../kit';

const ROT_HOLZ: Paint = { c: 0x7e3a2c, p: P.bretter }; // ochsenblutrot gestrichenes Holz
const LEDER: Paint = { c: 0x6a4428, p: P.glatt };
const SEIL: Paint = { c: 0xb59a6a, p: P.glatt };
const DUNKEL: Paint = { c: 0x2a2420, p: P.glatt }; // Innenraum hinter dem offenen Tor
const KRAUT: Paint[] = [{ c: 0x5d7f3a, p: P.laub }, { c: 0x7d9a52, p: P.laub }, { c: 0x4c6a34, p: P.laub }, { c: 0x8a9a6a, p: P.laub }];
const BLUETE: Paint[] = [{ c: 0x8f6fa8, p: P.glatt }, { c: 0xe8d36a, p: P.glatt }, { c: 0xf2efe4, p: P.glatt }];
const RAD = (b: Builder, x: number, y: number, z: number, r: number) => {
  // Speichenrad: Felge, Nabe, sechs Speichen (Achse entlang x)
  b.add(new THREE.TorusGeometry(r, r * 0.12, 5, 14), M.dunkelholz, x, y, z, Math.PI / 2);
  b.log(r * 0.22, 0.05, M.eisen, x, y, z, 0, 8);
  for (let i = 0; i < 6; i++) b.add(new THREE.BoxGeometry(0.012, r * 1.9, 0.012), M.holz, x, y, z, 0, (i * Math.PI) / 6);
};

/** Feuerwehr: Spritzenhaus mit Schlauchturm */
export function feuerwehrModel(): ModelDef {
  const b = new Builder();
  b.ground(2, 2, M.pflaster);
  // Spritzenhaus (hinten), Tor nach vorne
  const w = 1.25, h = 0.72, d = 0.82, z0 = -0.5;
  b.plinth(w + 0.04, d + 0.04, -0.15, z0, 0.06);
  b.box(w, h, d, M.putz, -0.15, 0.06, z0);
  b.timber(w, h, -0.15, 0.06, z0 + d / 2 + 0.005, 0, 4);
  b.timber(d, h, -0.15 - w / 2 - 0.005, 0.06, z0, -Math.PI / 2, 3);
  b.saddle(w, 0.5, d, M.ziegelRot, -0.15, h + 0.06, z0, Math.PI / 2);
  b.gable(d + 0.0, 0.5, M.putz, -0.15 - w / 2 + 0.02, h + 0.06, z0, Math.PI / 2);
  b.gable(d + 0.0, 0.5, M.putz, -0.15 + w / 2 - 0.02, h + 0.06, z0, Math.PI / 2);
  // großes Tor: dunkle Öffnung, zwei aufgeschlagene Flügel
  const tz = z0 + d / 2 + 0.012;
  b.box(0.56, 0.52, 0.02, DUNKEL, -0.25, 0.06, tz);
  b.box(0.62, 0.05, 0.05, M.balken, -0.25, 0.58, tz + 0.01);
  for (const s of [-1, 1]) {
    b.box(0.03, 0.55, 0.05, M.balken, -0.25 + s * 0.3, 0.06, tz + 0.01);
    b.box(0.27, 0.5, 0.025, ROT_HOLZ, -0.25 + s * 0.42, 0.07, tz + 0.12, s * 1.2);
  }
  b.window(0.3, 0.45, tz, 0, 0.16, 0.2, ROT_HOLZ);
  // Schild über dem Tor
  b.box(0.36, 0.08, 0.02, M.bretterDunkel, -0.25, 0.64, tz + 0.03);
  // Schlauchturm hinten rechts mit offener Glockenstube
  const tx = 0.68, tzT = -0.62;
  b.plinth(0.36, 0.36, tx, tzT, 0.06);
  b.box(0.32, 1.45, 0.32, M.mauer, tx, 0.06, tzT);
  b.window(tx, 1.15, tzT + 0.165, 0, 0.09, 0.16);
  b.window(tx, 0.7, tzT + 0.165, 0, 0.09, 0.16);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.035, 0.32, 0.035, M.balken, tx + sx * 0.14, 1.51, tzT + sz * 0.14);
  b.box(0.36, 0.03, 0.36, M.balken, tx, 1.51, tzT);
  b.cyl(0.05, 0.08, 0.11, 10, M.gold, tx, 1.62, tzT);
  b.hipRoof(0.36, 0.34, 0.36, M.schiefer, tx, 1.83, tzT, 0, 0.04);
  b.cone(0.012, 0.12, 4, M.eisen, tx, 2.17, tzT);
  // Handdruckspritze vor dem Tor: Wasserkasten, Pumpe mit Schwengel, Schlauch
  b.group(-0.25, 0, 0.3, 0, (g) => {
    g.box(0.34, 0.2, 0.5, ROT_HOLZ, 0, 0.14, 0);
    g.box(0.36, 0.025, 0.52, M.bretterDunkel, 0, 0.34, 0);
    g.cyl(0.04, 0.045, 0.2, 10, { c: 0xb07a3a, p: P.glatt }, 0, 0.36, 0.04); // Messing-Windkessel
    g.sphere(0.045, { c: 0xb07a3a, p: P.glatt }, 0, 0.57, 0.04, 1, 1, 1, 8);
    g.box(0.03, 0.18, 0.03, M.balken, 0, 0.36, -0.14);
    g.add(new THREE.BoxGeometry(0.62, 0.025, 0.025), M.holz, 0, 0.55, -0.14, 0, 0, 0.12);
    RAD(g, -0.2, 0.11, -0.16, 0.11); RAD(g, 0.2, 0.11, -0.16, 0.11);
    RAD(g, -0.2, 0.11, 0.17, 0.11); RAD(g, 0.2, 0.11, 0.17, 0.11);
    g.add(new THREE.BoxGeometry(0.025, 0.025, 0.42), M.holz, 0, 0.12, 0.45, 0, 0.12); // Deichsel
    // Schlauch in Bögen auf dem Pflaster
    g.add(new THREE.TorusGeometry(0.1, 0.014, 5, 16, Math.PI * 1.6), LEDER, 0.36, 0.015, 0.2, 0, Math.PI / 2);
  });
  // Leiter am Haus, Eimerbrett mit Ledereimern
  b.group(-0.98, 0, -0.1, 0, (g) => {
    for (const s of [-1, 1]) g.add(new THREE.BoxGeometry(0.025, 0.95, 0.025), M.holz, s * 0.08, 0.45, 0.05, 0, -0.25);
    for (let i = 0; i < 7; i++) g.add(new THREE.BoxGeometry(0.17, 0.018, 0.018), M.holz, 0, 0.08 + i * 0.12, 0.05 - Math.sin(0.25) * (0.08 + i * 0.12 - 0.45), 0, -0.25);
  });
  b.box(0.6, 0.03, 0.04, M.balken, 0.3, 0.6, tz + 0.02);
  for (let i = 0; i < 4; i++) b.cyl(0.035, 0.028, 0.08, 8, LEDER, 0.12 + i * 0.12, 0.49, tz + 0.05);
  // Wassertrog und Fässer
  b.box(0.5, 0.14, 0.18, M.bretterDunkel, 0.55, 0, 0.62);
  b.box(0.44, 0.02, 0.12, M.wasser, 0.55, 0.12, 0.62);
  b.barrel(0.88, 0.25, 0, 0.08, 0.19).barrel(0.9, 0.05, 0, 0.08, 0.19).barrel(0.72, 0.18, 0, 0.07, 0.17);
  b.flagPole(-0.9, 0, 0.88, 0.95);
  return b.build();
}

/** Arzt: Haus mit Kräutergarten */
export function arztModel(): ModelDef {
  const b = new Builder();
  b.ground(2, 2, M.pflaster);
  const w = 1.15, d = 0.8, z0 = -0.45, h1 = 0.42, h2 = 0.42;
  b.plinth(w + 0.04, d + 0.04, -0.2, z0, 0.06);
  // Erdgeschoss aus Bruchstein, Obergeschoss Fachwerk mit Putz
  b.box(w, h1, d, M.mauer, -0.2, 0.06, z0);
  b.box(w + 0.04, h2, d + 0.04, M.putzGelb, -0.2, 0.06 + h1, z0);
  b.timber(w + 0.04, h2, -0.2, 0.06 + h1, z0 + d / 2 + 0.025, 0, 4);
  b.timber(d + 0.04, h2, -0.2 + w / 2 + 0.025, 0.06 + h1, z0, Math.PI / 2, 3);
  b.saddle(w + 0.04, 0.55, d + 0.04, M.ziegelBraun, -0.2, 0.06 + h1 + h2, z0, Math.PI / 2);
  b.gable(d + 0.04, 0.55, M.putzGelb, -0.2 - w / 2 + 0.0, 0.06 + h1 + h2, z0, Math.PI / 2);
  b.gable(d + 0.04, 0.55, M.putzGelb, -0.2 + w / 2 + 0.0, 0.06 + h1 + h2, z0, Math.PI / 2);
  b.chimney(-0.5, 0.06 + h1 + h2 + 0.15, -0.55, 0.5);
  const fz = z0 + d / 2;
  b.door(-0.2, 0.06, fz + 0.005, 0, 0.2, 0.34, M.bretterDunkel);
  b.window(-0.55, 0.3, fz + 0.005, 0, 0.16, 0.18, M.bretterDunkel);
  b.window(0.18, 0.3, fz + 0.005, 0, 0.16, 0.18, M.bretterDunkel);
  for (const x of [-0.55, -0.2, 0.18]) b.window(x, 0.72, fz + 0.03, 0, 0.15, 0.17, M.bretterDunkel);
  b.window(-0.2 + w / 2 + 0.01, 0.3, z0, Math.PI / 2, 0.16, 0.18, M.bretterDunkel);
  // Schild am Ausleger: Mörser mit Stößel
  b.box(0.02, 0.02, 0.2, M.eisen, 0.0, 0.52, fz + 0.1);
  b.box(0.16, 0.13, 0.015, M.bretterDunkel, 0.0, 0.38, fz + 0.18);
  b.cyl(0.035, 0.025, 0.04, 8, M.sandsteinGlatt, 0.0, 0.42, fz + 0.19);
  b.add(new THREE.BoxGeometry(0.012, 0.07, 0.012), M.holz, 0.015, 0.47, fz + 0.19, 0, 0, 0.4);
  // Kräutergarten vorne rechts: Beete mit Zaun, Pflanzen und Blüten
  const gx = 0.55, gz = 0.45;
  b.fence(gx - 0.42, gz - 0.42, gx + 0.42, gz - 0.42, 0.14).fence(gx + 0.42, gz - 0.42, gx + 0.42, gz + 0.48, 0.14)
    .fence(gx + 0.42, gz + 0.48, gx - 0.42, gz + 0.48, 0.14);
  for (let r = 0; r < 3; r++) {
    b.box(0.72, 0.05, 0.18, M.erde, gx, 0, gz - 0.27 + r * 0.3);
    for (let i = 0; i < 5; i++) {
      const x = gx - 0.28 + i * 0.14, z = gz - 0.27 + r * 0.3;
      b.sphere(0.045 + ((i + r) % 3) * 0.01, KRAUT[(i + r) % 4], x, 0.09, z, 1, 0.8, 1, 6);
      if ((i + r) % 2 === 0) b.sphere(0.018, BLUETE[(i + r) % 3], x + 0.02, 0.15, z, 1, 1, 1, 5);
    }
  }
  // Trockengestell mit Kräuterbündeln, Bank, Korb
  b.group(-0.62, 0, 0.5, 0.2, (g) => {
    for (const s of [-1, 1]) g.box(0.03, 0.42, 0.03, M.balken, s * 0.22, 0, 0);
    g.box(0.5, 0.025, 0.025, M.balken, 0, 0.4, 0);
    for (let i = 0; i < 5; i++) {
      g.cyl(0.004, 0.004, 0.06, 4, SEIL, -0.18 + i * 0.09, 0.35, 0);
      g.cone(0.03, 0.1, 6, KRAUT[i % 4], -0.18 + i * 0.09, 0.25, 0);
    }
  });
  b.box(0.36, 0.03, 0.1, M.holz, -0.2, 0.13, fz + 0.2);
  for (const s of [-1, 1]) b.box(0.03, 0.13, 0.08, M.balken, -0.2 + s * 0.15, 0, fz + 0.2);
  b.cyl(0.06, 0.05, 0.07, 10, { c: 0xa98a55, p: P.stroh }, 0.0, 0, 0.75);
  b.flagPole(-0.92, 0, 0.9, 0.9);
  return b.build();
}

/** Galgen: Holzgerüst auf einem Podest */
export function galgenModel(): ModelDef {
  const b = new Builder();
  b.ground(1, 1, M.erde, false);
  const ph = 0.2;
  // Podest auf Pfosten, Bretterboden, Treppe nach vorne, Geländer
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.05, ph + 0.3, 0.05, M.balken, sx * 0.3, -0.3, sz * 0.26 - 0.06);
  b.box(0.68, 0.04, 0.6, M.bretter, 0, ph - 0.04, -0.06);
  b.box(0.7, 0.05, 0.03, M.bretterDunkel, 0, ph - 0.09, 0.24);
  b.box(0.7, 0.05, 0.03, M.bretterDunkel, 0, ph - 0.09, -0.36);
  for (let i = 0; i < 3; i++) b.box(0.26, 0.03, 0.07, M.bretterDunkel, -0.15, (ph / 3) * (i + 1) - 0.03, 0.42 - i * 0.07);
  for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(0.025, 0.04, 0.26), M.balken, -0.15 + s * 0.14, ph / 2, 0.33, 0, 0.62);
  b.fence(0.0, 0.24, 0.33, 0.24, 0.18, M.holz).fence(0.33, 0.24, 0.33, -0.36, 0.18, M.holz).fence(-0.33, -0.36, -0.33, 0.24, 0.18, M.holz);
  // Gerüst: zwei Pfosten, Querbalken, Streben
  const top = ph + 0.95;
  for (const s of [-1, 1]) {
    b.box(0.06, top - ph + 0.02, 0.06, M.dunkelholz, s * 0.22, ph - 0.02, -0.18);
    b.add(new THREE.BoxGeometry(0.035, 0.3, 0.035), M.dunkelholz, s * 0.13, top - 0.12, -0.18, 0, 0, s * 0.75);
  }
  b.box(0.58, 0.07, 0.07, M.dunkelholz, 0, top, -0.18);
  // Seil mit Schlinge
  b.cyl(0.008, 0.008, 0.36, 5, SEIL, 0.05, top - 0.36, -0.18);
  b.add(new THREE.TorusGeometry(0.045, 0.009, 4, 12), SEIL, 0.05, top - 0.41, -0.18);
  // Hocker unter dem Seil
  b.box(0.1, 0.1, 0.1, M.bretterDunkel, 0.05, ph, -0.18, 0.3);
  return b.build();
}
