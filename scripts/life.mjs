// Bildtest „lebendige Welt“: Fischschwärme, Holzfäller, Fischerboot, Tiere.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || '.';
const html = readFileSync('dist/index.html');
const server = createServer((req, res) => { if (req.url.includes('manifest')) { res.end('{}'); return; } res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); }).listen(4178);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 852, height: 393 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(120000);
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:4178/');
await page.waitForFunction(() => window.__view, null, { timeout: 60000 });
await page.click('#hClose').catch(() => {});
const info = await page.evaluate(() => {
  const g = window.__game(), v = window.__view;
  g.seen.fill(1); v.onSeen();
  g.money = 1e6;
  const ship = g.myShips()[0];
  const isl = [...g.islands].sort((a, b) => Math.hypot(a.cx - ship.x, a.cy - ship.y) - Math.hypot(b.cx - ship.x, b.cy - ship.y))[0];
  let site = null;
  for (let y = isl.y0; y <= isl.y1 && !site; y++) for (let x = isl.x0; x <= isl.x1 && !site; x++) if (g.canPlace('kontor', x, y, 0, true).ok) site = [x, y];
  for (const [rx, ry] of g.ring({ type: 'kontor', x: site[0], y: site[1] })) if (g.tiles[g.idx(rx, ry)] === 0) { ship.x = rx + 0.5; ship.y = ry + 0.5; break; }
  g.place('kontor', site[0], site[1]);
  const k = g.kontor(); const l = g.lagerOf(0, k.island);
  const best = (type) => { let b = null; for (let y = isl.y0; y <= isl.y1; y++) for (let x = isl.x0; x <= isl.x1; x++) if (g.canPlace(type, x, y).ok) { const e = g.siteEfficiency(type, x, y); if (!b || e > b[2]) b = [x, y, e]; } return b; };
  for (const t of ['holzfaeller', 'fischer', 'jagdhuette', 'schaffarm']) { l.holz = 30; l.werkzeug = 30; const b = best(t); if (b) g.place(t, b[0], b[1]); }
  for (const b of g.buildings) g.linked.add(b.id);
  for (let i = 0; i < 40; i++) { g.tick(0.25); for (const b of g.buildings) { g.linked.add(b.id); b.stock = 0; } }
  const hf = g.buildings.find((b) => b.type === 'holzfaeller');
  const fi = g.buildings.find((b) => b.type === 'fischer');
  return { hf: hf && [hf.x, hf.y], fi: fi && [fi.x, fi.y], kontor: site };
});
console.log(JSON.stringify(info));
const shot = async (name, x, z, dist, yaw, ticks = 0) => {
  await page.evaluate(([x, z, d, y, n]) => {
    const g = window.__game();
    for (let i = 0; i < n; i++) { g.tick(0.25); for (const b of g.buildings) { g.linked.add(b.id); b.stock = 0; } }
    const r = window.__view.rig; r.tx = x; r.tz = z; r.dist = d; r.yaw = y;
  }, [x, z, dist, yaw, ticks]);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${name}.png` });
};
if (info.hf) await shot('l1-holzfaeller', info.hf[0] + 1, info.hf[1] + 1, 10, 0.8, 30);
if (info.fi) await shot('l2-fischer', info.fi[0] + 1, info.fi[1] + 1, 16, 2.4, 10);
await shot('l3-ueberblick', info.kontor[0], info.kontor[1], 26, 0.5, 0);
console.log(errs.length ? 'FEHLER: ' + errs.join(' | ') : 'keine Fehler');
await browser.close(); server.close();
