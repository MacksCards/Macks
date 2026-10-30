// Schnelles Foto vom Spiel: node scripts/shot.mjs ordner [dist] [yaw]
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out = '.', ...views] = process.argv.slice(2);
const html = readFileSync('dist/index.html');
const server = createServer((_, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); }).listen(4175);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 852, height: 393 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(120000);
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const t0 = Date.now();
await page.goto('http://localhost:4175/');
await page.waitForFunction(() => window.__view, null, { timeout: 60000 });
console.log('geladen in', Date.now() - t0, 'ms');
await page.click('#hClose').catch(() => {});
const list = views.length ? views : ['30:0.8', '14:2.2', '55:4'];
let i = 0;
for (const v of list) {
  const [dist, yaw] = v.split(':').map(Number);
  await page.evaluate(([d, y]) => { const r = window.__view.rig; r.dist = d; r.yaw = y; }, [dist, yaw]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/view${++i}.png` });
}
console.log(errs.length ? 'FEHLER: ' + errs.join(' | ') : 'keine Fehler');
await browser.close(); server.close();
