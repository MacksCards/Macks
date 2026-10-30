// Foto von Gebäudemodellen: node scripts/modelshot.mjs "haus:0,haus:1" out.png [nah|hinten]
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { createServer } from 'node:http';
const { chromium } = createRequire(import.meta.url)('playwright');

const [list, out = 'model.png', opt = ''] = process.argv.slice(2);
const res = await build({ entryPoints: ['tools/viewer.ts'], bundle: true, write: false, format: 'iife', target: 'es2020', logLevel: 'error' });
const js = res.outputFiles[0].text;
const html = `<!doctype html><html><body><script>${js.replace(/<\/script>/g, '<\\/script>')}</script></body></html>`;
const server = createServer((_, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); });
await new Promise((ok) => server.listen(0, ok));
const port = server.address().port;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`http://localhost:${port}/#${list}${opt ? '&' + opt : ''}`);
await page.waitForFunction(() => window.done === true, null, { timeout: 30000 }).catch(() => errs.push('Timeout'));
await page.screenshot({ path: out });
console.log(errs.length ? 'FEHLER: ' + errs.join(' | ') : 'ok → ' + out);
await browser.close();
server.close();
