// Verkleinert die Oberflächenbilder der Meshy-Modelle fürs iPhone (weniger Grafikspeicher).
//
//   Nebenbilder (Normalen = feine Unebenheiten, Metall/Rauheit = Glanz): immer 512 × 512
//   Farbbild: 1024 × 1024 bei Häusern, großen Gebäuden (Grundfläche > 2) und Schiffen, sonst 512
//
// Die Form-Komprimierung (meshopt) bleibt erhalten. Ändert die Dateien an Ort und Stelle.
//
//   einmalig: npm i --no-save @gltf-transform/core@4 @gltf-transform/extensions@4 meshoptimizer sharp
//   node scripts/modell-texturen.mjs                    alle Modelle in public/models
//   node scripts/modell-texturen.mjs kontor.glb haus-0.glb
//   node scripts/modell-texturen.mjs --messen           nur Größen und Grafikspeicher anzeigen
import { readFileSync, readdirSync, statSync } from 'node:fs';

const { NodeIO } = await import('@gltf-transform/core');
const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
const { MeshoptDecoder, MeshoptEncoder } = await import('meshoptimizer');
const sharp = (await import('sharp')).default;

const DIR = 'public/models/';
const args = process.argv.slice(2);
const onlyMeasure = args.includes('--messen');
const files = args.filter((a) => !a.startsWith('--'));
const manifest = JSON.parse(readFileSync(DIR + 'manifest.json', 'utf8'));

// größte Grundfläche je Datei (eine Datei kann mehrere Gebäude bedienen)
const maxSize = {}, house = {};
for (const e of Object.values(manifest)) {
  maxSize[e.file] = Math.max(maxSize[e.file] ?? 0, e.art === 'schiff' ? 99 : e.size ?? 99);
  if (e.building === 'haus') house[e.file] = true;
}

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

let memSum = 0, sizeSum = 0;
for (const f of files.length ? files : readdirSync(DIR).filter((n) => n.endsWith('.glb')).sort()) {
  const path = DIR + f;
  const doc = await io.read(path);
  const root = doc.getRoot();
  const bigColor = house[f] || (maxSize[f] ?? 99) > 2;
  let changed = false;
  for (const t of root.listTextures()) {
    const mats = root.listMaterials();
    const color = mats.some((m) => m.getBaseColorTexture() === t || m.getEmissiveTexture() === t);
    const normal = mats.some((m) => m.getNormalTexture() === t);
    const target = color && bigColor ? 1024 : 512;
    const img = Buffer.from(t.getImage());
    const meta = await sharp(img).metadata();
    if (onlyMeasure || (meta.width <= target && meta.height <= target)) continue;
    const out = await sharp(img).resize(target, target, { fit: 'fill', kernel: 'lanczos3' }).webp({ quality: normal ? 92 : 85, effort: 6 }).toBuffer();
    t.setImage(new Uint8Array(out)).setMimeType('image/webp');
    changed = true;
  }
  if (changed) await io.write(path, doc);
  // Grafikspeicher grob: Breite × Höhe × 4 Byte × 1,33 (mit verkleinerten Zwischenstufen)
  let mem = 0;
  for (const t of (changed ? await io.read(path) : doc).getRoot().listTextures()) {
    const meta = await sharp(Buffer.from(t.getImage())).metadata();
    mem += meta.width * meta.height * 4 * 1.33;
  }
  const size = statSync(path).size;
  memSum += mem; sizeSum += size;
  console.log(`${f.padEnd(24)} ${(size / 1024).toFixed(0).padStart(5)} KB  Grafikspeicher ${(mem / 1048576).toFixed(1).padStart(5)} MB${changed ? '  (verkleinert)' : ''}`);
}
console.log(`Summe: Dateien ${(sizeSum / 1048576).toFixed(1)} MB, Grafikspeicher ${(memSum / 1048576).toFixed(0)} MB (wenn alle Modelle geladen sind)`);
