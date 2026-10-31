// Browser-Test: lädt das gebaute Spiel im iPhone-Querformat, spielt automatisch ein Stück und macht Screenshots.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const out = process.argv[2] || 'shots';
const port = Number(process.env.PORT || 4173);
const html = readFileSync(resolve('dist/index.html'));
const server = createServer((_, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); }).listen(port);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 852, height: 393 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(`http://localhost:${port}/`);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/01-start.png` });
await page.click('#hClose').catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/02-island.png` });

// Automatisch eine Siedlung bauen und lange simulieren (prüft die Warenketten)
const report = await page.evaluate(() => {
  const g = window.__game();
  // Ein neues Spiel beginnt nur mit dem Schiff: zuerst ein Kontor an der Küste der Heimatinsel gründen
  if (!g.kontor()) {
    const ship = g.myShips()[0];
    const isl = g.islands.find((i) => i.heimat) ?? g.islands[0];
    g.seen.fill(1); window.__view.onSeen();
    outer: for (let y = isl.y0; y <= isl.y1; y++) for (let x = isl.x0; x <= isl.x1; x++) {
      if (!g.canPlace('kontor', x, y, 0, true).ok) continue;
      for (const [rx, ry] of g.ring({ type: 'kontor', x, y })) if (g.tiles[g.idx(rx, ry)] === 0) { ship.x = rx + 0.5; ship.y = ry + 0.5; break; }
      if (g.place('kontor', x, y).ok) { g.unloadAll(ship); break outer; }
    }
  }
  const k = g.kontor();
  const log = [];
  g.money = 100000;
  for (const id of ['holz', 'werkzeug', 'stein']) g.goods[id] = 60;
  // Wegeraster alle 4 Felder im Baugebiet
  const grid = () => {
    const cells = [];
    for (let y = 0; y < g.size; y++) for (let x = 0; x < g.size; x++) if (x % 4 === 0 || y % 4 === 0) cells.push([x, y]);
    return g.placeRoads(cells);
  };
  log.push('Wege: ' + grid());
  const [kx, ky] = g.center(k);
  const tryPlace = (type, mustLink, far = false) => {
    const cands = [];
    for (let y = 0; y < g.size; y++) for (let x = 0; x < g.size; x++) cands.push([x, y, (x - kx) ** 2 + (y - ky) ** 2]);
    cands.sort((a, b) => far ? b[2] - a[2] : a[2] - b[2]);
    for (const [x, y] of cands) {
      if (!g.canPlace(type, x, y).ok) continue;
      if (g.siteEfficiency(type, x, y) < 0.3) continue;
      g.place(type, x, y);
      const b = g.buildings[g.buildings.length - 1];
      if (mustLink && !g.linked.has(b.id)) { g.removeBuilding(b); continue; }
      return b;
    }
    log.push('konnte nicht bauen: ' + type);
    return null;
  };
  tryPlace('holzfaeller', true); tryPlace('holzfaeller', true);
  tryPlace('fischer', true); tryPlace('fischer', true);
  tryPlace('markt', false);
  log.push('Wege nach Markt: ' + grid());
  for (let i = 0; i < 10; i++) tryPlace('haus', false);
  const sim = (min) => { for (let i = 0; i < min * 240; i++) g.tick(0.25); };
  sim(3);
  log.push(`nach 3 min: pop ${g.population()} nahrung ${g.goods.nahrung} geld ${Math.round(g.money)} quest ${g.quest}`);
  tryPlace('schaffarm', true); tryPlace('weberei', true); tryPlace('kapelle', false);
  for (let i = 0; i < 6; i++) tryPlace('haus', false);
  tryPlace('fischer', true);
  sim(5);
  log.push(`nach 8 min: tiers ${g.housesByTier()} pop ${g.population()} stoff ${g.goods.stoff} quest ${g.quest}`);
  tryPlace('markt', false, true); tryPlace('markt', false, true); tryPlace('markt', false, true);
  log.push('Wege nach Märkten: ' + grid());
  tryPlace('steinbruch', true); tryPlace('erzmine', true); tryPlace('schmiede', true);
  tryPlace('getreidefarm', true); tryPlace('muehle', true); tryPlace('baeckerei', true); tryPlace('wirtshaus', false);
  tryPlace('schaffarm', true); tryPlace('weberei', true);
  for (let i = 0; i < 8; i++) tryPlace('haus', false);
  tryPlace('fischer', true); tryPlace('holzfaeller', true);
  sim(10);
  log.push(`nach 18 min: tiers ${g.housesByTier()} popByTier ${g.popByTier()} quest ${g.quest}`);
  sim(10);
  log.push(`nach 28 min: tiers ${g.housesByTier()} popByTier ${g.popByTier()} quest ${g.quest}`);
  const st = {};
  for (const b of g.buildings) if (b.type !== 'haus') st[b.type + '#' + b.id] = `${b.status} eff${b.eff.toFixed(2)} aktiv${b.active.toFixed(2)}`;
  return { log, money: Math.round(g.money), goods: g.goods, inc: g.incomePerMinute(), st, saved: g.save() };
});
console.log(JSON.stringify(report, null, 1));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/03-settlement.png` });
// Zoom ran
await page.evaluate(() => { const v = window.__view; v.rig.dist = 14; });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/04-zoom.png` });
// Haus antippen → Infofenster
await page.evaluate(() => { const ui = window.__ui; const h = window.__game().buildings.find((b) => b.type === 'haus'); ui.select(h); });
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/05-info.png` });
// Baumenü öffnen
await page.evaluate(() => window.__ui.select(null));
await page.click('.cat[data-cat="rohstoffe"]');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/06-buildmenu.png` });
// Echte Touch-Bedienung: Karte wählen, auf Insel tippen
await page.click('.card[data-type="holzfaeller"]');
await page.touchscreen.tap(426, 250);
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/07-ghost.png` });
// Neu laden → Spielstand muss da sein
const before = await page.evaluate(() => window.__game().buildings.length);
await page.reload();
await page.waitForTimeout(2000);
const after = await page.evaluate(() => window.__game().buildings.length);
console.log('Gebäude vor/nach Neuladen:', before, after);
await page.screenshot({ path: `${out}/08-reload.png` });
// Hochformat
await page.setViewportSize({ width: 393, height: 852 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/09-portrait.png` });
console.log('FEHLER:', errors.length ? errors : 'keine');
await browser.close();
server.close();
