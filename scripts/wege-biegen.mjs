// Test: Weg planen (Start, Ziel), dann per Ziehpunkt biegen, Knickpunkt antippen = weg, Karte verschieben baut nichts.
// Aufruf: PORT=4190 node scripts/wege-biegen.mjs <Bilder-Ordner> [Breite] [Höhe]
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || '.';
const W = +(process.argv[3] || 852), H = +(process.argv[4] || 393);
const port = +(process.env.PORT || 4190);
const html = readFileSync('dist/index.html');
const server = createServer((req, res) => {
  if (req.url.includes('manifest.json')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); return; }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(html);
}).listen(port);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.setDefaultTimeout(120000);
const errs = [], fails = [];
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'FEHLER ') + what); if (!ok) fails.push(what); };
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`http://localhost:${port}/`);
await page.waitForFunction(() => window.__view, null, { timeout: 60000 });
await page.click('#hClose').catch(() => {});
await page.waitForTimeout(800);
// Kontor auf der nächsten Insel, viel Holz, freies Stück Land suchen
const setup = await page.evaluate(() => {
  const g = window.__game();
  const ship = g.myShips()[0];
  const isl = [...g.islands].sort((a, b) => Math.hypot(a.cx - ship.x, a.cy - ship.y) - Math.hypot(b.cx - ship.x, b.cy - ship.y))[0];
  let target = null;
  for (let t = 0; t < 1; t += 0.02) {
    const x = Math.floor(isl.cx + (ship.x - isl.cx) * t), y = Math.floor(isl.cy + (ship.y - isl.cy) * t);
    if (g.tiles[g.idx(x, y)] === 0) { target = [x, y]; break; }
  }
  g.moveShip(ship, target[0] + 0.5, target[1] + 0.5);
  for (let i = 0; i < 400 && ship.path.length; i++) g.tick(0.25);
  let placed = null;
  for (let r = 0; r < 8 && !placed; r++) for (let dy = -r; dy <= r && !placed; dy++) for (let dx = -r; dx <= r && !placed; dx++) {
    const x = Math.floor(ship.x) + dx, y = Math.floor(ship.y) + dy;
    if (g.canPlace('kontor', x, y).ok) { g.place('kontor', x, y); placed = [x, y]; }
  }
  g.unloadAll(ship);
  const k = g.kontor();
  const lager = g.lagerOf(0, k.island); lager.holz = 200; lager.werkzeug = 50;
  // zwei Felder, 10 Felder auseinander auf einer Linie; rundherum Land ohne Gebäude (Wald zählt als frei).
  // Das Stück wird für den Test zu eigenem Gebiet erklärt (das Gebiet des Kontors ist manchmal zu klein)
  const land = (x, y) => g.inMap(x, y) && g.tiles[g.idx(x, y)] !== 0 && g.canRoad(x, y, 0, 'weg').reason !== 'Hier geht kein Weg' && !g.occ[g.idx(x, y)] && !g.roads[g.idx(x, y)];
  let pair = null;
  for (let r = 3; r < 60 && !pair; r++) for (let dy = -r; dy <= r && !pair; dy++) for (let dx = -r; dx <= r && !pair; dx++) {
    const x = placed[0] + dx, y = placed[1] + dy;
    let ok = true;
    for (let i = -3; i <= 13 && ok; i++) for (let j = -5; j <= 5 && ok; j++) if (!land(x + i, y + j)) ok = false;
    if (ok) pair = [[x, y], [x + 10, y]];
  }
  if (pair) for (let i = -3; i <= 13; i++) for (let j = -5; j <= 5; j++) g.own[g.idx(pair[0][0] + i, pair[0][1] + j)] = 0;
  return { placed, pair };
});
console.log('Aufbau:', JSON.stringify(setup));
if (!setup.pair) { console.log('FEHLER kein freies Stück Land gefunden'); process.exit(1); }
const [A, B] = setup.pair;
await page.evaluate(([A, B]) => { const r = window.__view.rig; r.tx = (A[0] + B[0]) / 2 + 0.5; r.tz = A[1] + 0.5; r.dist = 26; window.__view.updateCamera(); window.__ui.build.setMode({ kind: 'road', type: 'weg' }); }, [A, B]);
await page.waitForTimeout(800);
const scr = (x, y) => page.evaluate(([x, y]) => {
  const v = window.__view, c = v.camera; c.updateMatrixWorld();
  const p = new c.position.constructor(x + 0.5, v.groundY(x, y, 1), y + 0.5).project(c);
  const r = v.renderer.domElement.getBoundingClientRect();
  return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height];
}, [x, y]);
const tap = async (p) => { await page.mouse.move(p[0], p[1]); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(450); };
const sA = await scr(...A), sB = await scr(...B); console.log("Bildpunkte A/B:", JSON.stringify([sA, sB]));
await tap(sA);
await tap(sB);
const st1 = await page.evaluate(() => { const b = window.__ui.build; return { cells: b.roadCells.length, end: b.roadEndSet, h: window.__view.roadHandles.count }; });
console.log('Geplant:', JSON.stringify(st1));
check(st1.end && st1.cells === 11, 'gerader Weg mit 11 Feldern geplant');
check(st1.h === 2, 'zwei Ziehpunkte (Mitte + Ziel)');
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/wb1-geplant-${W}.png` });
// Mittel-Griff 4 Felder zur Seite ziehen
const mid = [A[0] + 5, A[1]];
const p0 = await scr(...mid), p1 = await scr(mid[0], mid[1] + 4);
const roads0 = await page.evaluate(() => window.__game().roads.reduce((a, b) => a + (b > 0), 0));
await page.mouse.move(p0[0], p0[1]); await page.mouse.down();
for (let i = 1; i <= 10; i++) { await page.mouse.move(p0[0] + (p1[0] - p0[0]) * i / 10, p0[1] + (p1[1] - p0[1]) * i / 10); await page.waitForTimeout(40); }
await page.screenshot({ path: `${out}/wb2-ziehen-${W}.png` });
await page.mouse.up();
await page.waitForTimeout(400);
const st2 = await page.evaluate(() => { const b = window.__ui.build, r = window.__view.rig; return { vias: b.roadVias, cells: b.roadCells, h: window.__view.roadHandles.count, cam: [r.tx, r.tz] }; });
console.log('Gebogen:', JSON.stringify({ vias: st2.vias, n: st2.cells.length, h: st2.h }));
check(st2.vias.length === 1 && st2.vias[0][1] === A[1] + 4, 'Knickpunkt 4 Felder daneben gesetzt');
check(st2.cells.some(([x, y]) => x === st2.vias[0]?.[0] && y === st2.vias[0]?.[1]), 'Weg läuft über den Knickpunkt');
check(st2.cells[0][0] === A[0] && st2.cells[0][1] === A[1] && st2.cells.at(-1)[0] === B[0] && st2.cells.at(-1)[1] === B[1], 'Anfang und Ende unverändert');
check(st2.h >= 3, 'Ziehpunkte: Knickpunkt, Ziel und Mitten');
const roads1 = await page.evaluate(() => window.__game().roads.reduce((a, b) => a + (b > 0), 0));
check(roads1 === roads0, 'Ziehen baut nichts');
await page.screenshot({ path: `${out}/wb3-gebogen-${W}.png` });
// Karte woanders wischen: kein neuer Knick, kein Bau
const camA = st2.cam;
await page.mouse.move(W * 0.2, H * 0.8); await page.mouse.down();
for (let i = 1; i <= 8; i++) { await page.mouse.move(W * 0.2 + i * 12, H * 0.8 - i * 6); await page.waitForTimeout(30); }
await page.mouse.up(); await page.waitForTimeout(600);
const st3 = await page.evaluate(() => { const b = window.__ui.build, r = window.__view.rig; return { vias: b.roadVias.length, n: b.roadCells.length, cam: [r.tx, r.tz], roads: window.__game().roads.reduce((a, b) => a + (b > 0), 0) }; });
check(st3.vias === 1 && st3.n === st2.cells.length && st3.roads === roads0, 'Wischen auf der Karte ändert den Weg nicht');
check(Math.hypot(st3.cam[0] - camA[0], st3.cam[1] - camA[1]) > 0.3, 'Wischen verschiebt die Karte');
// Knickpunkt antippen = entfernen
const via = st2.vias[0];
await tap(await scr(via[0], via[1]));
const st4 = await page.evaluate(() => { const b = window.__ui.build; return { vias: b.roadVias.length, n: b.roadCells.length }; });
check(st4.vias === 0 && st4.n === 11, 'Knickpunkt antippen macht den Weg wieder gerade');
// nochmal biegen und bauen
await page.mouse.move(...(await scr(...mid))); await page.mouse.down();
const q1 = await scr(mid[0], mid[1] - 3);
for (let i = 1; i <= 8; i++) { const q0 = await scr(...mid); await page.mouse.move(q0[0] + (q1[0] - q0[0]) * i / 8, q0[1] + (q1[1] - q0[1]) * i / 8); await page.waitForTimeout(30); }
await page.mouse.up(); await page.waitForTimeout(300);
const n5 = await page.evaluate(() => window.__ui.build.roadCells.length);
console.log('vor ✓:', await page.evaluate(() => { const g = window.__game(), b = window.__ui.build; return JSON.stringify({ vias: b.roadVias, nw: b.roadNoWay, cells: b.roadCells.map(([x, y]) => [x, y, g.canRoad(x, y, 0, 'weg').reason || 'ok']) }); }));
await page.click('#hintOk');
await page.waitForTimeout(800);
const st6 = await page.evaluate(() => { const b = window.__ui.build; return { vias: b.roadVias.length, h: window.__view.roadHandles.count, roads: window.__game().roads.reduce((a, b) => a + (b > 0), 0) }; });
check(st6.roads - roads0 === n5, `✓ baut den gebogenen Weg (${st6.roads - roads0} von ${n5} Feldern)`);
check(st6.vias === 0 && st6.h === 0, 'nach dem Bauen keine Ziehpunkte mehr');
await page.screenshot({ path: `${out}/wb4-gebaut-${W}.png` });
console.log('Fehler im Browser:', errs.length ? errs.join(' | ') : 'keine');
console.log(fails.length || errs.length ? `FEHLER: ${fails.length + errs.length}` : 'Alle Prüfungen bestanden');
await browser.close(); server.close();
