// Bildtest der Menüs: alle Gebäude freigeschaltet, Plantagen, Werft, Haus-Info
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || '.';
const html = readFileSync('dist/index.html');
const server = createServer((req, res) => { if (req.url.includes('manifest')) { res.end('{}'); return; } res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); }).listen(4179);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 852, height: 393 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(120000);
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:4179/');
await page.waitForFunction(() => window.__view, null, { timeout: 60000 });
await page.click('#hClose').catch(() => {});
await page.evaluate(() => {
  const g = window.__game(), v = window.__view;
  g.seen.fill(1); v.onSeen(); g.money = 1e6;
  const ship = g.myShips()[0];
  const isl = [...g.islands].filter((i) => i.groesse !== 'klein').sort((a, b) => Math.hypot(a.cx - ship.x, a.cy - ship.y) - Math.hypot(b.cx - ship.x, b.cy - ship.y))[0];
  let site = null;
  for (let y = isl.y0; y <= isl.y1 && !site; y++) for (let x = isl.x0; x <= isl.x1 && !site; x++) if (g.canPlace('kontor', x, y, 0, true).ok) site = [x, y];
  for (const [rx, ry] of g.ring({ type: 'kontor', x: site[0], y: site[1] })) if (g.tiles[g.idx(rx, ry)] === 0) { ship.x = rx + 0.5; ship.y = ry + 0.5; break; }
  g.place('kontor', site[0], site[1]);
  const l = g.lagerOf(0, g.kontor().island);
  for (const k of Object.keys(l)) l[k] = 25;
  const r = v.rig; r.tx = site[0]; r.tz = site[1]; r.dist = 22;
  // Werft + Haus bauen
  const put = (t) => { for (let rr = 2; rr < 16; rr++) for (let y = site[1] - rr; y <= site[1] + rr; y++) for (let x = site[0] - rr; x <= site[0] + rr; x++) if (g.canPlace(t, x, y).ok) { g.place(t, x, y); return g.buildings[g.buildings.length - 1]; } return null; };
  for (const k of Object.keys(l)) l[k] = 25;
  g.unlocked.add('werft');
  window.__werft = put('werft');
  window.__haus = put('haus');
});
await page.waitForTimeout(800);
await page.click('.cat[data-cat="nahrung"]');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/m1-nahrung.png` });
await page.click('.cat[data-cat="nahrung"]');
// alles freischalten → volle Kategorie-Liste
await page.evaluate(() => { const g = window.__game(); for (const t of ['tabakplantage', 'weingut', 'kakaoplantage', 'gewuerzplantage', 'zuckerrohrplantage', 'baumwollplantage']) g.unlocked.add(t); });
await page.waitForTimeout(600);
await page.click('.cat[data-cat="plantagen"]');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/m2-plantagen.png` });
await page.click('.cat[data-cat="plantagen"]');
await page.evaluate(() => { if (window.__werft) window.__ui.select(window.__werft); });
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/m3-werft.png` });
await page.evaluate(() => { if (window.__haus) window.__ui.select(window.__haus); });
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/m4-haus.png` });
console.log(errs.length ? 'FEHLER: ' + errs.join(' | ') : 'keine Fehler');
await browser.close(); server.close();
