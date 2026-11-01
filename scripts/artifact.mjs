// Macht aus dist/index.html eine Vorschau-Seite für claude.ai (ohne <html>/<head>/<body>-Gerüst).
// Die Vorschau liefert keine .glb-Dateien aus: die Modelle kommen deshalb als base64-Text nach
// dist/artifact-models/*.glb.txt, mit eigener manifest.json, die auf diese Dateien zeigt.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
let h = readFileSync('dist/index.html', 'utf8');
const head = h.match(/<head>([\s\S]*?)<\/head>/i)[1];
const body = h.match(/<body>([\s\S]*?)<\/body>/i)[1];
const keep = head
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '');
const titleMatch = keep.match(/<title>[\s\S]*?<\/title>/i);
const rest = keep.replace(titleMatch[0], '');
writeFileSync('dist/artifact.html', `${titleMatch[0]}\n${rest}\n${body}`);
console.log('dist/artifact.html', (readFileSync('dist/artifact.html').length / 1024).toFixed(0), 'KB');
if (existsSync('dist/models/manifest.json')) {
  rmSync('dist/artifact-models', { recursive: true, force: true });
  mkdirSync('dist/artifact-models');
  const man = JSON.parse(readFileSync('dist/models/manifest.json', 'utf8'));
  const done = new Set();
  for (const e of Object.values(man)) {
    if (!done.has(e.file)) {
      writeFileSync(`dist/artifact-models/${e.file}.txt`, readFileSync(`dist/models/${e.file}`).toString('base64'));
      done.add(e.file);
    }
    e.file = e.file + '.txt';
  }
  writeFileSync('dist/artifact-models/manifest.json', JSON.stringify(man));
  console.log('dist/artifact-models:', done.size, 'Modelle als Text');
}
