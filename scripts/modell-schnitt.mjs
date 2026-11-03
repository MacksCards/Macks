// Meshy-Modelle nachbessern: Teile aus der Form herausschneiden (einmalig, Ergebnis immer als Bild prüfen).
//
//   --flecken             lose Einzelteile entfernen, die deutlich neben dem Hauptkörper liegen
//                         (kleine, nicht verbundene Stücke; z. B. Brett vor der Schule, Rebstock vor dem Weingut)
//   --box x0,x1,y0,y1,z0,z1     alle Dreiecke, deren Mitte in diesem Quader liegt (Modell-Koordinaten)
//   --rotbox x0,x1,y0,y1,z0,z1  wie --box, aber nur kräftig rote Dreiecke (Fahnentuch; der dunkle Mast bleibt)
//   --ymax Y              alles, was über die Höhe Y hinausragt (z. B. alle Fahnen auf den Türmen)
//   --pol x0,x1,z0,z1     gibt die Spitze des verbliebenen Fahnenmasts aus (Wert "fahne" für manifest.json:
//                         dort hängt das Spiel die Fahne in Besitzerfarbe an den Mast des Modells)
//
//   einmalig: npm i --no-save @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer sharp
//   node scripts/modell-schnitt.mjs <roh.glb> <ziel.glb> [Angaben]
//
// So wurden die heutigen Modelle bearbeitet (Rot ist eine Gegnerfarbe, deshalb keine festen roten Fahnen):
//   kontor.glb:  --box -0.9,-0.56,0.42,0.7,0.38,0.58 --rotbox -0.9,-0.49,0.42,0.7,0.38,0.58 --pol -0.57,-0.49,0.4,0.53
//                (rotes Tuch entfernt, Mast blieb; "fahne": [-0.515, 0.601, 0.446])
//                danach (02.11.2026) auch der Mast: --box -0.565,-0.515,-0.157,0.7,0.445,0.485
//                (Rohwerte im Modell, 54 Dreiecke; die Fahne hängt seit 02.11.2026 auf der Landseite,
//                der leere Mast stand sonst als dunkle Stange neben ankernden Schiffen; "fahne" aus manifest.json entfernt)
//                danach (02.11.2026, Paket KL) schräge Leitern, Stangen, Gerüst und Leinen auf der Landseite (hinten, −z),
//                die aus der Nähe als dünne dunkle Splitter links und vorne aus dem Gebäude ragten – fünf Schritte
//                nacheinander, jeweils Ausgabe des vorigen als Eingabe (zusammen 2635 Dreiecke; Haus, Dach, Steg und
//                Geländer bleiben, die Fahne auf der Landseite setzt das Spiel weiter aufs Dach):
//                  --box -0.879,0.922,-0.452,0.332,-1.069,-0.719   (alles hinter der Dachkante über dem Geländer)
//                  --box -0.879,-0.296,-0.452,0.332,-1.069,-0.629  (Leitern hinter dem Anbau)
//                  --box 0.286,0.922,-0.452,-0.039,-1.069,-0.645   (Gerüst an der Rückwand, unter der Traufe)
//                  --box -0.296,0.286,-0.452,-0.039,-1.069,-0.645  (Leiterfuß in der Mitte)
//                  --box 0.286,0.922,-0.378,-0.250,-1.069,-0.617   (Splitter-Reste des Gerüsts an der Wand)
//   festung.glb: --ymax 0.25   (alle rot-blauen Fahnen samt Masten auf den Türmen entfernt)
//   schule.glb, weingut.glb: --flecken
//   burg.glb:    --rotbox -0.30,-0.11,-0.22,0.05,0.62,0.74, danach --box -0.29,-0.12,-0.21,0.04,0.668,0.74 (rotes Wandbanner)
//   theater.glb: --box -0.2,0.1,0.46,0.7,0.4,0.6   (Fahne auf dem Dach)
//   schiff-krieg.glb: --box -0.14,-0.04,0.62,0.75,-0.1,0.05, --box 0.80,0.98,0.10,0.22,-0.10,0.06,
//                --box 0.84,0.97,-0.115,0.02,-0.07,0.005   (Wimpel und Heckflagge)
const { NodeIO } = await import('@gltf-transform/core');
const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
const { MeshoptDecoder, MeshoptEncoder } = await import('meshoptimizer');
const { prune, compactPrimitive } = await import('@gltf-transform/functions');
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const args = process.argv.slice(2);
const [src, dst] = args;
const opt = (k) => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; };
const doc = await io.read(src);
const node = doc.getRoot().listNodes().find((n) => n.getMesh());
const p = node.getMesh().listPrimitives()[0];
const pos = p.getAttribute('POSITION'), ia = p.getIndices(), idx = ia.getArray();
const cut = new Set();
const q = [];
const tri = (t) => { const v = [0, 1, 2].map((k) => pos.getElement(idx[t + k], [])); return { c: [0, 1, 2].map((j) => (v[0][j] + v[1][j] + v[2][j]) / 3), ymax: Math.max(v[0][1], v[1][1], v[2][1]) }; };
const inBox = (c, b) => c[0] >= b[0] && c[0] <= b[1] && c[1] >= b[2] && c[1] <= b[3] && c[2] >= b[4] && c[2] <= b[5];

if (args.includes('--flecken')) {
  // zusammenhängende Teile suchen (Punkte mit gleicher Lage gelten als verbunden; Meshy trennt sie an Bildkanten)
  const n = pos.getCount(), a = [];
  const key = new Map(), weld = new Int32Array(n);
  for (let i = 0; i < n; i++) { pos.getElement(i, a); const k = a.map((v) => Math.round(v * 2000)).join(','); let w = key.get(k); if (w === undefined) { w = i; key.set(k, i); } weld[i] = w; }
  const par = new Int32Array(n).map((_, i) => i);
  const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let t = 0; t < idx.length; t += 3) for (const k of [1, 2]) { const x = find(weld[idx[t]]), y = find(weld[idx[t + k]]); if (x !== y) par[x] = y; }
  const comp = new Map();
  for (let t = 0; t < idx.length; t += 3) { const r = find(weld[idx[t]]); let c = comp.get(r); if (!c) { c = []; comp.set(r, c); } c.push(t); }
  const list = [...comp.values()].sort((x, y) => y.length - x.length);
  const box = (tris) => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (const t of tris) for (let k = 0; k < 3; k++) { pos.getElement(idx[t + k], q); for (let j = 0; j < 3; j++) { mn[j] = Math.min(mn[j], q[j]); mx[j] = Math.max(mx[j], q[j]); } } return { mn, mx }; };
  const main = box(list[0]);
  const M = 0.04;
  // kleines Teil (< 1/30 der Form), dessen Mitte außerhalb des Hauptkörpers liegt → weg
  for (const tris of list.slice(1)) {
    const b = box(tris);
    const c = b.mn.map((v, j) => (v + b.mx[j]) / 2);
    const outside = c.some((v, j) => v < main.mn[j] - M || v > main.mx[j] + M);
    if (outside && tris.length < idx.length / 30) { for (const t of tris) cut.add(t); console.log('loses Teil entfernt:', tris.length, 'Dreiecke, Mitte', c.map((v) => v.toFixed(2)).join(' ')); }
  }
}

const bx = opt('--box')?.split(',').map(Number);
const rb = opt('--rotbox')?.split(',').map(Number);
let colorAt = null;
if (rb) {
  // Farbe des Oberflächenbilds in der Dreiecksmitte
  const sharp = (await import('sharp')).default;
  const img = await sharp(Buffer.from(p.getMaterial().getBaseColorTexture().getImage())).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const W = img.info.width, H = img.info.height, px = img.data, uv = p.getAttribute('TEXCOORD_0'), u = [];
  colorAt = (t) => {
    let su = 0, sv = 0;
    for (let k = 0; k < 3; k++) { uv.getElement(idx[t + k], u); su += u[0] / 3; sv += u[1] / 3; }
    const x = Math.min(W - 1, Math.max(0, Math.floor(su * W))), y = Math.min(H - 1, Math.max(0, Math.floor(sv * H)));
    const o = (y * W + x) * 4;
    return [px[o], px[o + 1], px[o + 2]];
  };
}
const ymax = opt('--ymax') !== null ? +opt('--ymax') : null;
for (let t = 0; t < idx.length; t += 3) {
  const T = tri(t);
  if (bx && inBox(T.c, bx)) cut.add(t);
  if (ymax !== null && T.ymax > ymax) cut.add(t);
  if (rb && inBox(T.c, rb)) { const [r, g, b] = colorAt(t); if (r / Math.max(g, b, 1) > 1.45) cut.add(t); }
}
const keep = [];
for (let t = 0; t < idx.length; t += 3) if (!cut.has(t)) keep.push(idx[t], idx[t + 1], idx[t + 2]);

const pol = opt('--pol')?.split(',').map(Number);
if (pol) {
  let best = null;
  for (const i of keep) { pos.getElement(i, q); if (q[0] >= pol[0] && q[0] <= pol[1] && q[2] >= pol[2] && q[2] <= pol[3] && (!best || q[1] > best[1])) best = [...q]; }
  const T = node.getTranslation(), S = node.getScale();
  if (best) console.log('Mastspitze → "fahne":', JSON.stringify(best.map((v, j) => +(v * S[j] + T[j]).toFixed(3))));
}
console.log('entfernt', cut.size, 'von', idx.length / 3, 'Dreiecken');
p.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(keep)));
ia.dispose();
compactPrimitive(p);
await doc.transform(prune());
await io.write(dst, doc);
