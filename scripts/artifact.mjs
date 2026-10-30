// Macht aus dist/index.html eine Vorschau-Seite für claude.ai (ohne <html>/<head>/<body>-Gerüst).
import { readFileSync, writeFileSync } from 'node:fs';
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
