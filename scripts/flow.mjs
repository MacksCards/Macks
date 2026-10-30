// Ablauftest: Start mit Schiff → zur nächsten Insel segeln → Kontor bauen → ausladen → bauen.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || '.';
const html = readFileSync('dist/index.html');
const server = createServer((req, res) => {
  if (req.url.includes('manifest.json')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); return; }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(html);
}).listen(4176);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 852, height: 393 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(120000);
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:4176/');
await page.waitForFunction(() => window.__view, null, { timeout: 60000 });
await page.click('#hClose').catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/f1-start.png` });
const r1 = await page.evaluate(() => {
  const g = window.__game();
  const ship = g.myShips()[0];
  // nächste Insel mit Küste suchen
  const isl = [...g.islands].sort((a, b) => Math.hypot(a.cx - ship.x, a.cy - ship.y) - Math.hypot(b.cx - ship.x, b.cy - ship.y))[0];
  // Küstenwasser nahe Inselzentrum in Richtung Schiff
  let target = null;
  for (let t = 0; t < 1; t += 0.02) {
    const x = Math.floor(isl.cx + (ship.x - isl.cx) * t), y = Math.floor(isl.cy + (ship.y - isl.cy) * t);
    if (g.tiles[g.idx(x, y)] === 0) { target = [x, y]; break; }
  }
  const ok = g.moveShip(ship, target[0] + 0.5, target[1] + 0.5);
  for (let i = 0; i < 400 && ship.path.length; i++) g.tick(0.25);
  window.__ui.selectShip(ship);
  return { isl: isl.name, ok, ship: [ship.x.toFixed(1), ship.y.toFixed(1)], near: g.shipNearIsland(ship), seen: g.seen.reduce((a, b) => a + b, 0) };
});
console.log('Segeln:', JSON.stringify(r1));
await page.evaluate(() => { const s = window.__game().myShips()[0]; const r = window.__view.rig; r.tx = s.x; r.tz = s.y; r.dist = 30; });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/f2-ship.png` });
const r2 = await page.evaluate(() => {
  const g = window.__game();
  const ship = g.myShips()[0];
  const isl = g.shipNearIsland(ship);
  let placed = null, reason = '';
  for (let r = 0; r < 8 && !placed; r++) for (let dy = -r; dy <= r && !placed; dy++) for (let dx = -r; dx <= r && !placed; dx++) {
    const x = Math.floor(ship.x) + dx, y = Math.floor(ship.y) + dy;
    const c = g.canPlace('kontor', x, y);
    if (c.ok) { g.place('kontor', x, y); placed = [x, y]; } else reason = c.reason;
  }
  const n = g.unloadAll(ship);
  const k = g.kontor();
  return { isl, placed, reason, unloaded: n, lager: k ? g.lagerOf(0, k.island) : null, unlockedCats: [...g.unlocked] };
});
console.log('Kontor:', JSON.stringify(r2));
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/f3-kontor.png` });
await page.evaluate(() => window.__ui.selectShip(null));
await page.evaluate(() => window.__view.showArea(true));
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/f4-gebiet.png` });
await page.evaluate(() => { window.__view.showArea(false); window.__ui.openMap(); });
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/f5-karte.png` });
await page.evaluate(() => window.__ui.closeModal());
const r3 = await page.evaluate(() => {
  const g = window.__game();
  const k = g.kontor();
  const [kx, ky] = g.center(k);
  // Holzfäller mit möglichst viel Wald im Gebiet suchen, dann Weg vom Kontor dorthin legen
  let best = null, be = -1;
  for (let y = Math.floor(ky) - 9; y <= ky + 9; y++) for (let x = Math.floor(kx) - 9; x <= kx + 9; x++) {
    if (!g.canPlace('holzfaeller', x, y).ok) continue;
    const e = g.siteEfficiency('holzfaeller', x, y);
    if (e > be) { be = e; best = [x, y]; }
  }
  if (!best) return { fehler: 'kein Platz für Holzfäller' };
  g.place('holzfaeller', best[0], best[1]);
  const b = g.buildings[g.buildings.length - 1];
  // Weg: L-Form von Kontor-Rand zu Holzfäller-Rand
  const cells = [];
  const sx = Math.floor(kx), sy = Math.floor(ky) + 2, tx = best[0], ty = best[1] - 1;
  for (let x = Math.min(sx, tx); x <= Math.max(sx, tx); x++) cells.push([x, sy]);
  for (let y = Math.min(sy, ty); y <= Math.max(sy, ty); y++) cells.push([tx, y]);
  const roads = g.placeRoads(cells);
  const linked = g.linked.has(b.id);
  const holz0 = g.lagerOf(0, k.island).holz;
  let maxStock = 0, cartMoved = false;
  for (let i = 0; i < 1200; i++) { g.tick(0.25); maxStock = Math.max(maxStock, b.stock); if (g.carts.some((c) => c.state !== 'idle')) cartMoved = true; }
  return { best, eff: be.toFixed(2), roads, linked, status: b.status, holzVorher: holz0, holzNachher: g.lagerOf(0, k.island).holz, maxStock, cartMoved, carts: g.carts.length };
});
console.log('Holzfäller+Karren:', JSON.stringify(r3));
// einen Karren unterwegs fotografieren
await page.evaluate(() => {
  const g = window.__game();
  for (let i = 0; i < 400; i++) { g.tick(0.25); const c = g.carts.find((c) => c.state !== 'idle' && c.path.length > 2); if (c) { const r = window.__view.rig; r.tx = c.x; r.tz = c.y; r.dist = 12; return; } }
});
await page.waitForTimeout(1000);
await page.screenshot({ path: `${out}/f6-karren.png` });
console.log(errs.length ? 'FEHLER: ' + errs.join(' | ') : 'keine Fehler');
await browser.close(); server.close();
