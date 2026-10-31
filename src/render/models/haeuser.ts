// Wohnhäuser der fünf Stufen (Pioniere bis Aristokraten) aus Code.
// Sie dienen als Ersatz, bis die Meshy-Modelle (haus-0 … haus-4) geladen sind,
// und folgen denselben Beschreibungen, damit Meshy sie später 1:1 ersetzen kann.
//
// Grundfläche 2 x 2 Felder (-1 … +1), Vorderseite = +z, Boden = y 0.
// Keine Bodenplatte: Häuser stehen auf einem Steinsockel, der nur am Hang ganz sichtbar wird.
// Dreiecke (gemessen): Stufe 0 ≈ 2 100, 1 ≈ 2 200, 2 ≈ 3 150, 3 ≈ 3 450, 4 ≈ 5 000 (Budget laut docs/GRAFIK.md: ≤ 12 000).
import * as THREE from 'three';
import { Builder, M, ModelDef, P, Paint } from '../kit';

const LADEN_GRUEN: Paint = { c: 0x3f6b45, p: P.latten };
const LADEN_BLAU: Paint = { c: 0x3c5a7a, p: P.latten };
const LADEN_ROT: Paint = { c: 0x7a3a2c, p: P.latten };
const TUER_GRUEN: Paint = { c: 0x2f5a3c, p: P.latten };
const EICHE: Paint = { c: 0x5e3f26, p: P.latten };
const ERDE: Paint = { c: 0x5f4630, p: P.acker };
const KOHL: Paint = { c: 0x6f9a4a, p: P.laub };
const KIES: Paint = { c: 0xd8cdb4, p: P.pflaster };

/** Tür mit Rahmen und Stufen hinunter bis zum Boden (y = Türschwelle) */
function entrance(b: Builder, x: number, y: number, z: number, ry: number, w: number, h: number, paint: Paint, frame: Paint = M.balken, stepPaint: Paint = M.stein) {
  b.group(x, y, z, ry, (g) => {
    g.box(w + 0.06, h + 0.04, 0.03, frame, 0, 0, 0);
    g.box(w, h, 0.04, paint, 0, 0, 0.008);
    g.box(0.02, 0.02, 0.03, M.gold, w * 0.32, h * 0.47, 0.035);
    // Stufen: je ca. 4 cm hoch, nach vorne länger
    const n = Math.max(1, Math.round(y / 0.045));
    for (let i = 0; i < n; i++) {
      const top = y - (i * y) / n;
      g.box(w + 0.12 + i * 0.04, top, 0.09 + i * 0.07, stepPaint, 0, -y, 0.045 + (i * 0.07) / 2);
    }
  });
}

/** Blumenkasten unter einem Fenster */
function flowerBox(b: Builder, x: number, y: number, z: number, ry: number, w: number, flower: Paint) {
  b.group(x, y, z, ry, (g) => {
    g.box(w, 0.045, 0.05, M.bretterDunkel, 0, 0, 0.035);
    for (let i = 0; i < 4; i++) g.sphere(0.022, i % 2 ? flower : M.laub, -w * 0.36 + (i * w * 0.72) / 3, 0.055, 0.04, 1, 0.8, 1, 5);
  });
}

/** Gemüsebeet mit Holzrahmen */
function bed(b: Builder, x: number, z: number, w: number, d: number, plant: Paint = KOHL) {
  b.box(w, 0.3, d, M.bretterDunkel, x, -0.25, z); // reicht in den Boden (Hochbeet am Hang)
  b.box(w - 0.04, 0.052, d - 0.04, ERDE, x, 0, z);
  const nx = Math.max(2, Math.round(w / 0.11)), nz = Math.max(1, Math.round(d / 0.13));
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) b.sphere(0.03, plant, x - w / 2 + (i + 0.5) * (w / nx), 0.07, z - d / 2 + (j + 0.5) * (d / nz), 1, 0.7, 1, 5);
}

/** Hackklotz mit Axt */
function choppingBlock(b: Builder, x: number, z: number) {
  b.cyl(0.07, 0.08, 0.12, 8, M.holz, x, 0, z);
  b.add(new THREE.BoxGeometry(0.015, 0.2, 0.015), M.balken, x + 0.02, 0.18, z, 0, 0.5, 0.3);
  b.box(0.05, 0.035, 0.012, M.eisen, x + 0.05, 0.24, z + 0.05, 0.5);
}

// ---------------------------------------------------------------------------
// Stufe 0: Pionierhütte – Rundholzhütte mit Strohdach, Gemüsebeet, Brennholz
function pionier(): ModelDef {
  const b = new Builder();
  const cx = -0.2, cz = -0.2, w = 1.05, d = 0.82, wh = 0.5;
  b.plinth(w + 0.06, d + 0.06, cx, cz, 0.03, M.mauerDunkel);
  // Kern (schließt die Fugen zwischen den Stämmen)
  b.box(w - 0.05, wh, d - 0.05, M.bretterDunkel, cx, 0.03, cz);
  // Rundhölzer, an den Ecken überstehend und verschränkt
  const r = 0.042, rows = 6;
  for (let i = 0; i < rows; i++) {
    const y = 0.03 + r + i * (wh / rows);
    const tone = i % 2 ? M.holz : { c: 0x8a5e35, p: P.glatt };
    for (const s of [-1, 1]) {
      b.log(r, w + 0.16, tone, cx, y, cz + s * (d / 2 - 0.01), 0, 7);
      b.log(r, d + 0.16, tone, cx + s * (w / 2 - 0.01), y + wh / rows / 2, cz, Math.PI / 2, 7);
    }
  }
  // Giebel aus Brettern, Strohdach mit dickem First
  b.gable(d - 0.02, 0.46, M.bretter, cx - w / 2 + 0.02, 0.03 + wh, cz, Math.PI / 2, 0.05);
  b.gable(d - 0.02, 0.46, M.bretter, cx + w / 2 - 0.02, 0.03 + wh, cz, Math.PI / 2, 0.05);
  b.saddle(d, 0.46, w + 0.06, M.stroh, cx, 0.03 + wh, cz, Math.PI / 2, 0.13, M.strohAlt, 0.08);
  // Rauchloch im Giebel (Pioniere haben noch keinen Schornstein)
  b.box(0.1, 0.06, 0.03, M.dunkelholz, cx + w / 2 + 0.005, 0.03 + wh + 0.28, cz, Math.PI / 2);
  // Tür, kleines Fenster mit offenem Holzladen
  entrance(b, cx + 0.2, 0.03, cz + d / 2 + 0.035, 0, 0.17, 0.36, M.latten, M.dunkelholz, M.holz);
  b.window(cx - 0.25, 0.33, cz + d / 2 + 0.04, 0, 0.13, 0.13, M.bretterDunkel, M.holz);
  b.window(cx + w / 2 + 0.04, 0.33, cz + 0.05, Math.PI / 2, 0.12, 0.12, M.bretterDunkel, M.holz);
  // Hof: Beet, Holzstapel, Hackklotz, Regenfass, Flechtzaun
  bed(b, 0.5, 0.45, 0.5, 0.36);
  bed(b, 0.5, 0.82, 0.5, 0.22, { c: 0x8fb04e, p: P.laub });
  b.woodpile(cx + w / 2 + 0.24, cz - 0.2, Math.PI / 2, 3);
  choppingBlock(b, -0.65, 0.55);
  b.barrel(cx - w / 2 - 0.08, cz + d / 2 - 0.05, 0, 0.065, 0.16);
  b.fence(0.18, 0.98, 0.9, 0.98, 0.16, M.strohAlt).fence(0.9, 0.98, 0.9, 0.2, 0.16, M.strohAlt);
  b.sack(-0.7, 0.2);
  return b.build();
}

// ---------------------------------------------------------------------------
// Stufe 1: Siedlerhaus – Fachwerk, Ziegeldach, Schornstein, Fensterläden
function siedler(): ModelDef {
  const b = new Builder();
  const cz = -0.18, w = 1.34, d = 0.96, pl = 0.08, wh = 0.64;
  const front = cz + d / 2, back = cz - d / 2;
  b.plinth(w + 0.04, d + 0.04, 0, cz, pl);
  b.box(w, wh, d, M.putz, 0, pl, cz);
  // Fachwerk auf allen Seiten
  b.timber(w, wh, 0, pl, front + 0.002, 0, 4);
  b.timber(w, wh, 0, pl, back - 0.002, Math.PI, 4);
  b.timber(d, wh, w / 2 + 0.002, pl, cz, Math.PI / 2, 3);
  b.timber(d, wh, -w / 2 - 0.002, pl, cz, -Math.PI / 2, 3);
  // Giebel mit Balken
  const rh = 0.58, top = pl + wh;
  for (const s of [-1, 1]) {
    b.gable(d - 0.01, rh, M.putz, s * (w / 2 - 0.02), top, cz, Math.PI / 2, 0.05);
    b.box(0.035, rh * 0.9, 0.035, M.balken, s * (w / 2 + 0.008), top, cz, Math.PI / 2);
    b.box(0.035, 0.035, d * 0.6, M.balken, s * (w / 2 + 0.008), top + rh * 0.38, cz);
  }
  b.saddle(d, rh, w, M.ziegelRot, 0, top, cz, Math.PI / 2, 0.11, M.ziegelFirst);
  b.chimney(0.36, top + 0.1, cz - 0.17, 0.62, 0.13, M.backstein);
  // Fenster mit grünen Läden, Tür mit Stufe
  for (const x of [-0.43, 0.43]) b.window(x, pl + 0.38, front + 0.02, 0, 0.17, 0.2, LADEN_GRUEN);
  entrance(b, 0, pl, front + 0.025, 0, 0.21, 0.42, TUER_GRUEN);
  b.box(0.32, 0.03, 0.14, M.ziegelBraun, 0, pl + 0.48, front + 0.07); // Vordach
  for (const x of [-0.4, 0.4]) b.window(x, pl + 0.38, back - 0.02, Math.PI, 0.17, 0.2, LADEN_GRUEN);
  for (const s of [-1, 1]) {
    b.window(s * (w / 2 + 0.02), pl + 0.38, cz, (s * Math.PI) / 2, 0.16, 0.2, LADEN_GRUEN);
    b.window(s * (w / 2 + 0.02), top + 0.24, cz, (s * Math.PI) / 2, 0.11, 0.13);
  }
  flowerBox(b, -0.43, pl + 0.25, front + 0.02, 0, 0.2, M.blumeRot);
  // Garten: Zaun, Beet, Fass, Bank
  b.fence(-0.98, 0.42, -0.98, 0.96, 0.18).fence(-0.98, 0.96, -0.3, 0.96, 0.18);
  bed(b, -0.64, 0.7, 0.5, 0.36);
  b.barrel(w / 2 + 0.1, front - 0.1, 0, 0.07, 0.17);
  b.box(0.36, 0.03, 0.09, M.holz, 0.5, 0.12, front + 0.12);
  for (const x of [0.37, 0.63]) b.box(0.03, 0.12, 0.07, M.balken, x, 0, front + 0.12);
  b.woodpile(0.75, back - 0.13, 0, 2);
  return b.build();
}

// ---------------------------------------------------------------------------
// Stufe 2: Bürgerhaus – Steinsockelgeschoss, Fachwerk-Obergeschoss, Schieferdach mit Gauben
function buerger(): ModelDef {
  const b = new Builder();
  const cz = -0.14, w = 1.52, d = 1.08, pl = 0.08, g1 = 0.56, g2 = 0.54, ov = 0.05;
  const front = cz + d / 2, back = cz - d / 2;
  b.plinth(w + 0.04, d + 0.04, 0, cz, pl);
  // Erdgeschoss Stein, Obergeschoss vorkragend mit Fachwerk
  b.box(w, g1, d, M.mauer, 0, pl, cz);
  b.box(w + ov * 2, 0.05, d + ov * 2, M.balken, 0, pl + g1, cz);
  const y2 = pl + g1 + 0.05, W2 = w + ov * 2, D2 = d + ov * 2;
  b.box(W2, g2, D2, M.putzGelb, 0, y2, cz);
  b.timber(W2, g2, 0, y2, cz + D2 / 2 + 0.002, 0, 5);
  b.timber(W2, g2, 0, y2, cz - D2 / 2 - 0.002, Math.PI, 5);
  b.timber(D2, g2, W2 / 2 + 0.002, y2, cz, Math.PI / 2, 3);
  b.timber(D2, g2, -W2 / 2 - 0.002, y2, cz, -Math.PI / 2, 3);
  // Ecksteine
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let i = 0; i < 4; i++) {
    const l = i % 2 ? 0.1 : 0.15;
    b.box(l, 0.12, 0.03, M.sandsteinGlatt, sx * (w / 2 - l / 2 + 0.01), pl + 0.02 + i * 0.135, cz + sz * (d / 2 + 0.008));
  }
  // Dach (Schiefer), Giebel verputzt, zwei Gauben, zwei Schornsteine
  const top = y2 + g2, rh = 0.7;
  for (const s of [-1, 1]) b.gable(D2 - 0.01, rh, M.putzGelb, s * (W2 / 2 - 0.02), top, cz, Math.PI / 2, 0.05);
  for (const s of [-1, 1]) b.window(s * (W2 / 2 + 0.02), top + 0.25, cz, (s * Math.PI) / 2, 0.13, 0.16, LADEN_BLAU);
  b.saddle(D2, rh, W2, M.schiefer, 0, top, cz, Math.PI / 2, 0.1, M.schieferFirst);
  for (const x of [-0.38, 0.38]) dormer(b, x, top, cz, D2, rh, M.schiefer, M.putzGelb);
  b.chimney(-0.55, top + 0.15, cz - 0.2, 0.75, 0.14, M.backstein);
  b.chimney(0.55, top + 0.15, cz - 0.2, 0.75, 0.14, M.backstein);
  // Fenster: Erdgeschoss 2 + Tür, Obergeschoss 3 mit Läden und Blumen
  for (const x of [-0.46, 0.46]) b.window(x, pl + 0.33, front + 0.02, 0, 0.19, 0.24, LADEN_BLAU);
  entrance(b, 0, pl, front + 0.025, 0, 0.22, 0.42, EICHE, M.sandsteinGlatt);
  b.box(0.32, 0.05, 0.03, M.sandsteinGlatt, 0, pl + 0.45, front + 0.03); // Türsturz
  for (const x of [-0.5, 0, 0.5]) {
    b.window(x, y2 + 0.3, cz + D2 / 2 + 0.02, 0, 0.18, 0.23, LADEN_BLAU);
    flowerBox(b, x, y2 + 0.15, cz + D2 / 2 + 0.02, 0, 0.21, x === 0 ? M.blumeGelb : M.blumeRot);
  }
  for (const x of [-0.46, 0, 0.46]) {
    b.window(x, pl + 0.33, back - 0.02, Math.PI, 0.17, 0.22);
    b.window(x, y2 + 0.3, cz - D2 / 2 - 0.02, Math.PI, 0.17, 0.22, LADEN_BLAU);
  }
  for (const s of [-1, 1]) {
    b.window(s * (w / 2 + 0.02), pl + 0.33, cz, (s * Math.PI) / 2, 0.17, 0.22);
    b.window(s * (W2 / 2 + 0.02), y2 + 0.3, cz, (s * Math.PI) / 2, 0.17, 0.22, LADEN_BLAU);
  }
  // Laterne, Bank, Fässer, Pflasterstreifen vor dem Haus
  b.box(0.02, 0.1, 0.02, M.eisen, 0.22, pl + 0.42, front + 0.06);
  b.box(0.06, 0.08, 0.06, { c: 0xffd98a, p: P.glatt }, 0.22, pl + 0.36, front + 0.08);
  b.box(w + 0.2, 0.025, 0.34, M.pflaster, 0, -0.005, front + 0.2);
  b.barrel(-w / 2 - 0.12, front - 0.05, 0, 0.07, 0.17);
  b.barrel(-w / 2 - 0.12, front - 0.22, 0, 0.07, 0.17);
  b.crate(0.82, 0.55);
  b.bush(-0.8, 0.85, 0.12);
  b.bush(0.85, 0.85, 0.1);
  return b.build();
}

/** Dachgaube auf der vorderen Dachfläche (Dach-First entlang x, Traufe vorne bei z = cz + D/2) */
function dormer(b: Builder, x: number, eaveY: number, cz: number, D: number, rh: number, roof: Paint, wall: Paint) {
  const slope = rh / (D / 2);
  const zf = cz + D / 2 - 0.2; // Vorderkante der Gaube
  const yb = eaveY + 0.2 * slope; // Dachhöhe dort
  const gw = 0.24, gh = 0.24, depth = 0.34;
  b.box(gw, gh, depth, wall, x, yb - 0.05, zf - depth / 2);
  b.window(x, yb + 0.07, zf + 0.012, 0, 0.13, 0.14, null, M.rahmenWeiss);
  b.saddle(gw, 0.12, depth, roof, x, yb + gh - 0.05, zf - depth / 2, 0, 0.04, null, 0.03);
  b.gable(gw, 0.12, wall, x, yb + gh - 0.05, zf - 0.01, 0, 0.02);
}

// ---------------------------------------------------------------------------
// Stufe 3: Kaufmannshaus – Backstein, Treppengiebel zur Straße, weiße Fensterrahmen, Kranbalken
function kaufmann(): ModelDef {
  const b = new Builder();
  const cz = -0.12, w = 1.22, d = 1.42, pl = 0.1, fl = 0.5, floors = 3;
  const front = cz + d / 2, back = cz - d / 2;
  const top = pl + fl * floors;
  b.plinth(w + 0.05, d + 0.05, 0, cz, pl, M.sandstein);
  b.box(w, fl * floors, d, M.backsteinRot, 0, pl, cz);
  // Gesimsbänder aus Sandstein zwischen den Geschossen
  for (let i = 1; i < floors; i++) b.box(w + 0.04, 0.035, d + 0.04, M.sandsteinGlatt, 0, pl + i * fl - 0.015, cz);
  b.box(w + 0.06, 0.05, d + 0.06, M.sandsteinGlatt, 0, top - 0.02, cz);
  // Ecksteine
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let i = 0; i < 9; i++) {
    const l = i % 2 ? 0.08 : 0.13;
    b.box(l, 0.1, 0.025, M.sandsteinGlatt, sx * (w / 2 - l / 2 + 0.008), pl + 0.06 + i * 0.16, cz + sz * (d / 2 + 0.006));
  }
  // Dach (First zur Straße), vorne Treppengiebel, hinten glatter Giebel
  const rh = 0.95;
  b.saddle(w, rh, d - 0.06, M.ziegelRot, 0, top, cz - 0.03, 0, 0.06, M.ziegelFirst);
  b.stepGable(w + 0.02, rh + 0.16, 5, M.backsteinRot, M.sandsteinGlatt, 0, top, front - 0.04, 0, 0.09);
  b.gable(w, rh, M.backsteinRot, 0, top, back + 0.03, 0, 0.06);
  b.chimney(0.3, top + 0.2, back + 0.35, 0.82, 0.14, M.backsteinRot, true);
  // Fenster mit weißen Rahmen: vorne 3 je Geschoss (unten Tür statt Mitte)
  const W = M.rahmenWeiss;
  for (let f = 0; f < floors; f++) {
    const y = pl + f * fl + 0.29;
    for (const x of [-0.38, 0, 0.38]) {
      if (f === 0 && x === 0) continue;
      b.window(x, y, front + 0.015, 0, 0.17, 0.26, null, W);
      b.box(0.21, 0.03, 0.03, M.sandsteinGlatt, x, y + 0.14, front + 0.012); // Sturz
    }
    for (const z of [-0.45, 0, 0.45]) for (const s of [-1, 1]) b.window(s * (w / 2 + 0.015), y, cz + z, (s * Math.PI) / 2, 0.16, 0.24, null, W);
    for (const x of [-0.32, 0.32]) b.window(x, y, back - 0.015, Math.PI, 0.16, 0.24, null, W);
  }
  entrance(b, 0, pl, front + 0.02, 0, 0.24, 0.44, EICHE, M.sandsteinGlatt, M.sandstein);
  b.box(0.36, 0.06, 0.06, M.sandsteinGlatt, 0, pl + 0.46, front + 0.03);
  // Ladeluken im Giebel und Kranbalken mit Seilrolle und Last
  const gy = top + 0.12;
  b.box(0.24, 0.32, 0.05, LADEN_ROT, 0, gy, front + 0.03);
  b.box(0.28, 0.035, 0.06, W, 0, gy + 0.32, front + 0.03);
  b.window(0, gy + 0.6, front + 0.04, 0, 0.12, 0.13, null, W);
  const ky = top + rh - 0.02;
  b.box(0.06, 0.06, 0.55, M.dunkelholz, 0, ky, front + 0.2);
  b.add(new THREE.BoxGeometry(0.035, 0.035, 0.32), M.dunkelholz, 0, ky - 0.13, front + 0.12, 0, -0.75, 0);
  b.log(0.035, 0.03, M.eisen, 0, ky - 0.03, front + 0.4, 0, 10);
  b.box(0.008, 0.62, 0.008, { c: 0xc9b48a, p: P.glatt }, 0, ky - 0.66, front + 0.43);
  b.crate(0, front + 0.43, ky - 0.82, 0.14, 0.2);
  // Waren vor dem Haus: Fässer, Kisten, Säcke
  b.barrel(-0.5, front + 0.25, 0, 0.075, 0.18);
  b.barrel(-0.34, front + 0.3, 0, 0.075, 0.18);
  b.add(new THREE.CylinderGeometry(0.075, 0.075, 0.18, 10), M.holz, -0.42, 0.075, front + 0.5, 0, 0, Math.PI / 2);
  b.crate(0.45, front + 0.25, 0, 0.17, 0.1);
  b.crate(0.62, front + 0.32, 0, 0.15, 0.5);
  b.crate(0.5, front + 0.27, 0.17, 0.14, 0.3);
  b.sack(0.78, front + 0.15);
  b.sack(0.75, front + 0.0, 0, 0xcbb98a);
  return b.build();
}

// ---------------------------------------------------------------------------
// Stufe 4: Aristokratenvilla – Sandstein, Mansarddach, Gesimse, Säulenportal, Zierbeet
function aristokrat(): ModelDef {
  const b = new Builder();
  const cz = -0.32, w = 1.74, d = 1.0, pl = 0.13, fl = 0.56;
  const front = cz + d / 2, back = cz - d / 2;
  const top = pl + fl * 2;
  const S = M.sandsteinGlatt, W = M.rahmenWeiss;
  // Sockel mit Bossenquadern, Wände aus hellem Sandstein
  b.plinth(w + 0.08, d + 0.08, 0, cz, pl, M.sandstein);
  b.box(w, fl * 2, d, { c: 0xe8dcc2, p: P.putz }, 0, pl, cz);
  // Mittelrisalit (vorspringender Mittelteil)
  const rw = 0.56, ro = 0.07;
  b.box(rw, fl * 2, ro, { c: 0xe8dcc2, p: P.putz }, 0, pl, front + ro / 2);
  // Gesimse und Pilaster
  b.box(w + 0.06, 0.04, d + 0.06, S, 0, pl + fl - 0.02, cz);
  b.box(rw + 0.04, 0.04, ro + 0.04, S, 0, pl + fl - 0.02, front + ro / 2);
  b.box(w + 0.12, 0.06, d + 0.12, S, 0, top - 0.03, cz);
  b.box(w + 0.16, 0.03, d + 0.16, S, 0, top + 0.03, cz);
  b.box(rw + 0.08, 0.06, ro + 0.1, S, 0, top - 0.03, front + ro / 2);
  for (const x of [-w / 2 + 0.03, w / 2 - 0.03, -rw / 2 + 0.03, rw / 2 - 0.03]) {
    const zf = Math.abs(x) < rw / 2 ? front + ro : front;
    b.box(0.07, fl * 2, 0.025, S, x, pl, zf + 0.01);
  }
  for (const s of [-1, 1]) for (const z of [front - 0.03, back + 0.03]) b.box(0.025, fl * 2, 0.07, S, s * (w / 2 + 0.01), pl, z);
  // Dreiecksgiebel über dem Risalit
  b.gable(rw + 0.08, 0.24, S, 0, top + 0.03, front + ro / 2 + 0.03, 0, ro + 0.1);
  b.add(new THREE.SphereGeometry(0.05, 10, 6), M.gold, 0, top + 0.13, front + ro + 0.09, 0, 0, 0, 1, 1, 0.4); // Wappen
  // Mansarddach mit Gauben, zwei hohe Schornsteine
  b.mansard(w + 0.04, d + 0.04, 0.4, 0.17, 0.15, M.schiefer, 0, top + 0.06, cz, 0, 0.05);
  for (const x of [-0.6, -0.3, 0.3, 0.6]) mansardDormer(b, x, top + 0.06, front + 0.07, 0, W);
  for (const x of [-0.6, -0.2, 0.2, 0.6]) mansardDormer(b, x, top + 0.06, back - 0.07, Math.PI, W);
  for (const s of [-1, 1]) {
    b.chimney(s * 0.62, top + 0.35, cz, 0.5, 0.16, M.sandstein);
    b.box(0.2, 0.03, 0.2, S, s * 0.62, top + 0.62, cz);
  }
  // Hohe Fenster mit weißen Rahmen und Verdachungen
  const winRow = (y: number, upper: boolean) => {
    for (const x of [-0.7, -0.45, 0.45, 0.7]) {
      b.window(x, y, front + 0.015, 0, 0.15, 0.3, null, W);
      b.box(0.2, 0.03, 0.04, S, x, y + 0.165, front + 0.02);
      if (upper) b.box(0.16, 0.02, 0.06, M.eisen, x, y - 0.17, front + 0.04); // Fenstergitter
    }
    // Mittelrisalit: oben zwei Fenster, unten liegt das Portal
    if (upper) for (const x of [-0.16, 0.16]) b.window(x, y, front + ro + 0.015, 0, 0.13, 0.3, null, W);
    for (const x of [-0.7, -0.35, 0, 0.35, 0.7]) b.window(x, y, back - 0.015, Math.PI, 0.15, 0.3, null, W);
    for (const s of [-1, 1]) for (const z of [-0.22, 0.22]) b.window(s * (w / 2 + 0.015), y, cz + z, (s * Math.PI) / 2, 0.15, 0.3, null, W);
  };
  winRow(pl + 0.3, false);
  winRow(pl + fl + 0.3, true);
  // Balkon über dem Portal
  b.box(rw - 0.06, 0.035, 0.16, S, 0, pl + fl - 0.01, front + ro + 0.08);
  for (let i = 0; i < 7; i++) b.cyl(0.01, 0.012, 0.1, 6, S, -0.2 + i * 0.066, pl + fl + 0.025, front + ro + 0.15);
  b.box(rw - 0.06, 0.02, 0.025, S, 0, pl + fl + 0.12, front + ro + 0.15);
  // Portal: zwei Säulen, Doppeltür, breite Treppe
  const pz = front + ro;
  entrance(b, 0, pl, pz + 0.015, 0, 0.24, 0.44, { c: 0x4a2e1e, p: P.latten }, S, M.sandstein);
  for (const s of [-1, 1]) {
    b.cyl(0.028, 0.032, 0.44, 10, S, s * 0.19, pl, pz + 0.07);
    b.box(0.08, 0.03, 0.08, S, s * 0.19, pl + 0.44, pz + 0.07);
  }
  // Zierbeet: Kiesweg, Buchsbaumhecken, rundes Blumenbeet mit Brunnen, Formschnitt-Kegel, Ziergitter
  const gz0 = pz + 0.16, gz1 = 0.97;
  b.box(0.26, 0.02, gz1 - gz0, KIES, 0, -0.005, (gz0 + gz1) / 2);
  for (const s of [-1, 1]) {
    const x0 = s * 0.18, x1 = s * 0.92, gx = (x0 + x1) / 2, gw = Math.abs(x1 - x0);
    // Hecken-Rahmen
    b.box(gw - 0.06, 0.07, 0.05, M.hecke, gx, 0, gz0 + 0.06);
    b.box(gw - 0.06, 0.07, 0.05, M.hecke, gx, 0, gz1 - 0.05);
    b.box(0.05, 0.07, gz1 - gz0 - 0.1, M.hecke, x0 + s * 0.05, 0, (gz0 + gz1) / 2);
    b.box(0.05, 0.07, gz1 - gz0 - 0.1, M.hecke, x1 - s * 0.05, 0, (gz0 + gz1) / 2);
    // Blumenbeet
    const bz = (gz0 + gz1) / 2;
    b.cyl(0.13, 0.14, 0.04, 14, ERDE, gx, 0, bz);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      b.sphere(0.028, i % 3 === 0 ? M.blumeWeiss : i % 3 === 1 ? M.blumeRot : M.blumeGelb, gx + Math.cos(a) * 0.095, 0.06, bz + Math.sin(a) * 0.095, 1, 0.8, 1, 5);
    }
    b.cone(0.045, 0.2, 8, M.hecke, gx, 0.04, bz);
    for (const cz2 of [gz0 + 0.06, gz1 - 0.05]) b.cone(0.04, 0.16, 8, M.hecke, x1 - s * 0.05, 0.06, cz2);
  }
  // kleiner Brunnen am Weg
  b.cyl(0.1, 0.11, 0.06, 14, M.sandstein, 0, 0, gz1 - 0.12);
  b.cyl(0.085, 0.085, 0.01, 14, M.wasser, 0, 0.055, gz1 - 0.12);
  b.cyl(0.015, 0.02, 0.14, 8, S, 0, 0.06, gz1 - 0.12);
  // Ziergitter mit Sandsteinpfosten an der Straße
  for (let i = 0; i <= 12; i++) {
    const x = -0.95 + i * (1.9 / 12);
    if (Math.abs(x) < 0.12) continue;
    b.box(0.012, 0.16, 0.012, M.eisen, x, 0, 0.985);
  }
  b.box(0.82, 0.015, 0.015, M.eisen, -0.55, 0.15, 0.985);
  b.box(0.82, 0.015, 0.015, M.eisen, 0.55, 0.15, 0.985);
  for (const x of [-0.97, -0.14, 0.14, 0.97]) {
    b.box(0.07, 0.2, 0.07, S, x, 0, 0.98);
    b.sphere(0.035, S, x, 0.23, 0.98, 1, 1, 1, 8);
  }
  return b.build();
}

/** Gaube im steilen Unterdach eines Mansarddachs, Blickrichtung ry */
function mansardDormer(b: Builder, x: number, y: number, z: number, ry: number, frame: Paint) {
  b.group(x, y, z, ry, (g) => {
    g.box(0.17, 0.25, 0.18, { c: 0xe8dcc2, p: P.putz }, 0, 0.04, -0.07);
    g.window(0, 0.17, 0.025, 0, 0.1, 0.15, null, frame);
    g.saddle(0.17, 0.08, 0.2, M.schiefer, 0, 0.29, -0.06, 0, 0.025, null, 0.025);
    g.gable(0.17, 0.08, { c: 0xe8dcc2, p: P.putz }, 0, 0.29, 0.02, 0, 0.02);
  });
}

const MAKERS = [pionier, siedler, buerger, kaufmann, aristokrat];

/** Wohnhaus der Stufe tier (0 = Pioniere … 4 = Aristokraten) */
export function houseModel(tier: number): ModelDef {
  return MAKERS[Math.max(0, Math.min(MAKERS.length - 1, tier | 0))]();
}
