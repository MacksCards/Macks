// Mühle: Die Meshy-Mühle hat feste Flügel. Dieses Werkzeug schneidet sie aus dem Modell heraus und
// bestimmt die Mitte der Flügel (Nabe) und ihre Länge. Das Spiel setzt dort drehende Flügel aus Code ein
// (Werte als "nabe" und "fluegel" in public/models/manifest.json eintragen).
//
//   einmalig: npm i --no-save @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer
//   node scripts/muehle-fluegel.mjs <roh.glb> <ziel.glb> [Breite 0.16]
//   danach: node scripts/modell-texturen.mjs muehle.glb
//
// Die Startgeraden (Lage der beiden Flügel-Diagonalen) passen zum aktuellen Modell; bei einem neuen
// Modell erst ansehen und anpassen.
const { NodeIO } = await import('@gltf-transform/core');
const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
const { MeshoptDecoder, MeshoptEncoder } = await import('meshoptimizer');
const { prune, compactPrimitive } = await import('@gltf-transform/functions');
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [src, dst, wS] = process.argv.slice(2);
const Z0 = 0.36, W = +(wS ?? 0.16);
const doc = await io.read(src);
const node = doc.getRoot().listNodes().find((n) => n.getMesh());
const p = node.getMesh().listPrimitives()[0];
const pos = p.getAttribute('POSITION'), ia = p.getIndices(), idx = ia.getArray();
const tris = [];
const q = [], r = [], s = [];
for (let t = 0; t < idx.length; t += 3) {
  pos.getElement(idx[t], q); pos.getElement(idx[t+1], r); pos.getElement(idx[t+2], s);
  tris.push({ t, zmin: Math.min(q[2], r[2], s[2]), x: (q[0] + r[0] + s[0]) / 3, y: (q[1] + r[1] + s[1]) / 3 });
}
const front = tris.filter((o) => o.zmin >= Z0);
// Startgeraden (von Hand aus dem Bild): Punkt + Richtung
let lines = [{ px: -0.01, py: 0.33, dx: -0.63, dy: 0.77 }, { px: -0.01, py: 0.33, dx: 0.69, dy: 0.73 }];
const dist = (L, x, y) => Math.abs((x - L.px) * L.dy - (y - L.py) * L.dx);
for (let it = 0; it < 4; it++) {
  lines = lines.map((L) => {
    const pts = front.filter((o) => dist(L, o.x, o.y) < 0.15 && Math.hypot(o.x - L.px, o.y - L.py) > 0.12);
    const n = pts.length, mx = pts.reduce((a, o) => a + o.x, 0) / n, my = pts.reduce((a, o) => a + o.y, 0) / n;
    let sxx = 0, syy = 0, sxy = 0; for (const o of pts) { sxx += (o.x - mx) ** 2; syy += (o.y - my) ** 2; sxy += (o.x - mx) * (o.y - my); }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    return { px: mx, py: my, dx: Math.cos(ang), dy: Math.sin(ang), n };
  });
  // Schnittpunkt als neuer Bezugspunkt
  const [A, B] = lines;
  const den = A.dx * B.dy - A.dy * B.dx;
  const u = ((B.px - A.px) * B.dy - (B.py - A.py) * B.dx) / den;
  const hx = A.px + u * A.dx, hy = A.py + u * A.dy;
  lines = lines.map((L) => ({ ...L, px: hx, py: hy }));
}
const hx = lines[0].px, hy = lines[0].py;
const cut = new Set();
let len = 0;
for (const o of front) {
  const d = Math.min(dist(lines[0], o.x, o.y), dist(lines[1], o.x, o.y)), rr = Math.hypot(o.x - hx, o.y - hy);
  if ((d < W && rr < 1.05) || rr < 0.14) { cut.add(o.t); len = Math.max(len, rr); }
}
const keep = [];
for (let t = 0; t < idx.length; t += 3) if (!cut.has(t)) keep.push(idx[t], idx[t+1], idx[t+2]);
const zs = front.filter((o) => cut.has(o.t));
const T = node.getTranslation(), S = node.getScale();
const hz = 0.40;
const nabe = [hx * S[0] + T[0], hy * S[1] + T[1], hz * S[2] + T[2]].map((v) => +v.toFixed(3));
console.log(JSON.stringify({ lines: lines.map((L) => [L.dx.toFixed(2), L.dy.toFixed(2), L.n]), hub: [hx.toFixed(3), hy.toFixed(3)], cut: cut.size, nabe, fluegel: +(len * S[0]).toFixed(3) }));
p.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(keep)));
ia.dispose();
compactPrimitive(p);
await doc.transform(prune());
await io.write(dst, doc);
