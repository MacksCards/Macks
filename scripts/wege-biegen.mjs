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
  // Nebel über dem Prüfgebiet aufdecken (für brauchbare Bilder)
  if (pair) { for (let i = -20; i <= 30; i++) for (let j = -18; j <= 18; j++) if (g.inMap(pair[0][0] + i, pair[0][1] + j)) g.seen[g.idx(pair[0][0] + i, pair[0][1] + j)] = 1; window.__view.onSeen(); }
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
// Tipp = Finger auf und ab in einem Zug (die Test-Grafik zeichnet so langsam, dass zwischen zwei getrennten
// Befehlen über 1 s vergehen kann – dann wäre es kein Tipp mehr)
const tap = async (p) => {
  await page.evaluate(([x, y]) => {
    const c = document.querySelector('#c');
    for (const type of ['pointerdown', 'pointerup']) c.dispatchEvent(new PointerEvent(type, { pointerId: 9, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true, button: 0 }));
  }, p);
  await page.waitForTimeout(450);
};
const sA = await scr(...A), sB = await scr(...B); console.log("Bildpunkte A/B:", JSON.stringify([sA, sB]));
await tap(sA);
await tap(sB);
const st1 = await page.evaluate(() => { const b = window.__ui.build; return { cells: b.roadCells.length, end: b.roadEndSet, h: window.__view.roadHandles.count }; });
console.log('Geplant:', JSON.stringify(st1));
check(st1.end && st1.cells === 11, 'gerader Weg mit 11 Feldern geplant');
check(st1.h === 3, 'Zeichen: Start, Mitte (ziehbar), Ziel');

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
check(st2.h >= 4, 'Ziehpunkte: Start, Knickpunkt, Ziel und Mitten');
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
check(st6.vias === 0 && st6.h === 1, 'nach dem Bauen nur noch das Start-Zeichen (Weiterbauen vom Ende)');
await page.screenshot({ path: `${out}/wb4-gebaut-${W}.png` });

// ---------- Grenzfälle aus der Prüfung ----------
// synthetische Finger (mehrere gleichzeitig möglich)
const ptr = (type, id, p) => page.evaluate(([type, id, x, y]) => {
  document.querySelector('#c').dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: id === 1, button: 0 }));
}, [type, id, p[0], p[1]]);
const st = () => page.evaluate(() => { const b = window.__ui.build; return { vias: b.roadVias.map((v) => v.join(',')), n: b.roadCells.length, end: b.roadEndSet, last: b.roadCells.at(-1)?.join(','), roads: window.__game().roads.reduce((a, b) => a + (b > 0), 0) }; });
// neuer Plan: Start = gebautes Ende (B), Ziel 10 Felder zurück auf der Linie ein Feld daneben
// näher heran: auf dem kleinen iPhone sind Felder sonst nur ~15 Bildpunkte breit, und schon ein Wackeln wechselt das Feld
await page.evaluate(([A]) => { const r = window.__view.rig; r.tx = A[0] + 5.5; r.tz = A[1] + 2.5; r.dist = 15; window.__view.updateCamera(); }, [A]);
await page.waitForTimeout(500);
const C = [A[0], A[1] + 2];
await tap(await scr(...C));
await page.waitForTimeout(600);
let s0 = await st();
check(s0.end && s0.n > 5, 'zweiter Plan angelegt');
// 1) Ziel-Kreis gedrückt halten, leicht wackeln (im selben Feld), 0,9 s, loslassen: baut NICHT
let pc = await scr(...C);
await ptr('pointerdown', 1, pc);
await ptr('pointermove', 1, [pc[0] + 5, pc[1] + 4]);
await ptr('pointermove', 1, [pc[0] + 10, pc[1] + 2]);
await page.waitForTimeout(900);
await ptr('pointerup', 1, [pc[0] + 10, pc[1] + 2]);
await page.waitForTimeout(400);
let s1 = await st();
check(s1.roads === s0.roads && s1.end, 'Ziel-Kreis festhalten und wackeln baut nichts');
// 2) Tipp auf den Rand des Fähnchens (weit heraus: der Kreis ist größer als ein Feld): baut nicht, Ziel bleibt
await page.evaluate(([A]) => { const r = window.__view.rig; r.tx = A[0] + 5.5; r.tz = A[1] + 2.5; r.dist = 34; window.__view.updateCamera(); }, [A]);
await page.waitForTimeout(500);
const tgt = await page.evaluate(() => window.__ui.build.roadTarget ?? window.__ui.build.roadCells.at(-1));
let pf = await scr(...tgt);
const offs = [pf[0] + 13, pf[1] + 2];
const hitF = await page.evaluate(([x, y]) => window.__view.roadHandleAt(x, y), offs);
check(hitF >= 0, 'Tipp 13 Bildpunkte neben der Fähnchen-Mitte trifft das Fähnchen');
await page.waitForTimeout(400);
await tap(offs);
let s2 = await st();
check(s2.roads === s0.roads && s2.end && s2.last === s1.last, `Tipp aufs Fähnchen baut nicht und ändert nichts (${s2.last} / ${s1.last})`);
await page.evaluate(([A]) => { const r = window.__view.rig; r.tx = A[0] + 5.5; r.tz = A[1] + 2.5; r.dist = 15; window.__view.updateCamera(); }, [A]);
await page.waitForTimeout(500);
// 3) Mittel-Kreis ziehen, dann zweiter Finger (Zoom): Knick wird zurückgenommen
const midNow = await page.evaluate(() => { const b = window.__ui.build; const c = b.roadCells[Math.round((b.roadCells.length - 1) / 2)]; return c; });
let m0 = await scr(...midNow), m1 = await scr(midNow[0], midNow[1] + 3);
const nBefore = (await st()).n;
await ptr('pointerdown', 1, m0);
for (let i = 1; i <= 6; i++) { await ptr('pointermove', 1, [m0[0] + (m1[0] - m0[0]) * i / 6, m0[1] + (m1[1] - m0[1]) * i / 6]); await page.waitForTimeout(30); }
const s3a = await st();
await ptr('pointerdown', 2, [W * 0.8, H * 0.5]);
await ptr('pointermove', 2, [W * 0.85, H * 0.55]);
await ptr('pointerup', 2, [W * 0.85, H * 0.55]);
await ptr('pointerup', 1, m1);
await page.waitForTimeout(400);
const s3 = await st();
check(s3a.vias.length === 1, 'beim Ziehen entsteht ein Knick');
check(s3.vias.length === 0 && s3.n === nBefore && s3.roads === s0.roads, 'zweiter Finger (Zoom) nimmt das Ziehen zurück');
// 3b) Knick setzen, dann den goldenen Kreis neben seiner Mitte antippen: genau dieser Knick geht weg
{
  const mc = await page.evaluate(() => { const b = window.__ui.build; return b.roadCells[Math.round((b.roadCells.length - 1) / 2)]; });
  // ein Feld 2–3 Reihen daneben, über das der Weg laufen darf
  const dy = await page.evaluate(([x, y]) => [2, -2, 3, -3].find((d) => window.__ui.build.passable(x, y + d)) ?? 2, mc);
  const q0 = await scr(...mc), q1 = await scr(mc[0], mc[1] + dy);
  await page.mouse.move(q0[0], q0[1]); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(q0[0] + (q1[0] - q0[0]) * i / 8, q0[1] + (q1[1] - q0[1]) * i / 8); await page.waitForTimeout(30); }
  await page.mouse.up(); await page.waitForTimeout(500);
  const sv = await st();
  check(sv.vias.length === 1, 'Knick für den Antipp-Test gesetzt');
  if (sv.vias.length !== 1) { console.log('FEHLER: Abbruch'); process.exit(1); }
  const vv = sv.vias[0].split(',').map(Number);
  const pv = await scr(...vv);
  await tap([pv[0] + 12, pv[1] - 9]);
  const sw = await st();
  check(sw.vias.length === 0 && sw.last === sv.last && sw.roads === s0.roads, 'Tipp neben die Mitte des goldenen Kreises entfernt genau diesen Knick');
  // ↶ holt ihn zurück
  check(await page.evaluate(() => !document.querySelector('#roadUndo').classList.contains('hidden')), '↶ ist sichtbar');
  await page.click('#roadUndo'); await page.waitForTimeout(400);
  const su = await st();
  check(su.vias.length === 1 && su.vias[0] === sv.vias[0], '↶ holt den Knick zurück');
  // Start antippen: Plan bleibt
  const ps = await scr(...(await page.evaluate(() => window.__ui.build.roadStart)));
  await page.waitForTimeout(400);
  await tap(ps);
  const sp = await st();
  check(sp.vias.length === 1 && sp.n === su.n && sp.end, 'Tipp auf den Start ändert den Plan nicht');
  // Doppeltipp aufs Fähnchen zoomt
  const d0 = await page.evaluate(() => window.__view.rig.dist);
  const pe = await scr(...(await page.evaluate(() => window.__ui.build.roadTarget)));
  await page.waitForTimeout(500);
  // beide Tipps in einem Zug (die Test-Grafik ist so langsam, dass sonst zwischen den Tipps über 350 ms vergehen)
  await page.evaluate(([x, y]) => {
    const c = document.querySelector('#c');
    for (const type of ['pointerdown', 'pointerup', 'pointerdown', 'pointerup']) c.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true, button: 0 }));
  }, pe);
  // die Test-Grafik zeichnet langsam: bis zu 5 s auf die Zoom-Fahrt warten
  let d1 = d0;
  for (let w = 0; w < 10 && !(d1 < d0 * 0.9); w++) { await page.waitForTimeout(500); d1 = await page.evaluate(() => window.__view.rig.dist); }
  const sd = await st();
  check(d1 < d0 * 0.9 && sd.roads === s0.roads && sd.vias.length === 1, `Doppeltipp aufs Fähnchen zoomt (${d0.toFixed(1)} → ${d1.toFixed(1)}) und ändert nichts`);
  await page.evaluate(([A]) => { const r = window.__view.rig; r.tx = A[0] + 5.5; r.tz = A[1] + 2.5; r.dist = 15; window.__view.updateCamera(); }, [A]);
  await page.waitForTimeout(500);
  // Doppeltipp auf den goldenen Knick und auf freie Karte: nur Zoom, der Plan bleibt
  const dbl = (p) => page.evaluate(([x, y]) => {
    const c = document.querySelector('#c');
    for (const type of ['pointerdown', 'pointerup', 'pointerdown', 'pointerup']) c.dispatchEvent(new PointerEvent(type, { pointerId: 8, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true, button: 0 }));
  }, p);
  {
    const before = await st();
    const vk = before.vias[0].split(',').map(Number);
    await page.waitForTimeout(500);
    await dbl(await scr(...vk));
    await page.waitForTimeout(900);
    const a1 = await st();
    check(a1.vias.length === 1 && a1.last === before.last, 'Doppeltipp auf den goldenen Knick zoomt nur (Knick bleibt)');
    await page.evaluate(([A]) => { const r = window.__view.rig; r.tx = A[0] + 5.5; r.tz = A[1] + 2.5; r.dist = 15; window.__view.updateCamera(); }, [A]);
    await page.waitForTimeout(600);
    const free = await page.evaluate(() => { const b = window.__ui.build, s = b.roadStart; for (let d = 2; d < 8; d++) for (const [x, y] of [[s[0], s[1] + d], [s[0], s[1] - d], [s[0] + d, s[1]], [s[0] - d, s[1]]]) if (b.passable(x, y) && !b.roadCells.some((c) => c[0] === x && c[1] === y)) return [x, y]; return null; });
    if (free) {
      await dbl(await scr(...free));
      await page.waitForTimeout(900);
      const a2 = await st();
      check(a2.vias.length === 1 && a2.last === before.last, 'Doppeltipp auf freie Karte zoomt nur (Plan bleibt)');
    }
    await page.evaluate(([A]) => { const r = window.__view.rig; r.tx = A[0] + 5.5; r.tz = A[1] + 2.5; r.dist = 15; window.__view.updateCamera(); }, [A]);
    await page.waitForTimeout(600);
  }
  // leere Kasse: Hinweis nennt den Grund, nicht „kein Durchgang“
  const hint = await page.evaluate(() => { const g = window.__game(), m = g.players[0].money; g.players[0].money = 0; const b = window.__ui.build; b.roadTo(b.roadTarget); b.updateHint(); const t = document.querySelector('#hintText').textContent; g.players[0].money = m; b.roadTo(b.roadTarget); b.updateHint(); return t; });
  check(/Taler|schon ein Weg/.test(hint) && !/Durchgang/.test(hint), `leere Kasse: Hinweis nennt den Grund („${hint.trim()}“)`);
}
// 4) Knick hinter das Ziel ziehen: das Ziel bleibt das letzte Feld
const end4 = (await st()).last.split(',').map(Number);
const mid4 = await page.evaluate(() => { const b = window.__ui.build; return b.roadCells[Math.round((b.roadCells.length - 1) / 2)]; });
let a4 = await scr(...mid4), b4 = await scr(end4[0] + 2, end4[1]);
await page.mouse.move(a4[0], a4[1]); await page.mouse.down();
for (let i = 1; i <= 10; i++) { await page.mouse.move(a4[0] + (b4[0] - a4[0]) * i / 10, a4[1] + (b4[1] - a4[1]) * i / 10); await page.waitForTimeout(30); }
await page.mouse.up(); await page.waitForTimeout(400);
const s4 = await st();
check(s4.last === end4.join(','), `Knick hinter dem Ziel: Ziel bleibt das Ende (${s4.last} / ${end4.join(',')})`);
await page.screenshot({ path: `${out}/wb5-grenzfaelle-${W}.png` });
// 5) Rechenzeit beim Ziehen (Knicke + kein Durchgang): Weg mit 2 Knicken neu rechnen
const ms = await page.evaluate(() => {
  const b = window.__ui.build, s = b.roadStart, t = b.roadTarget;
  // schwerer Fall: 6 Knicke im Zickzack
  const keep = b.roadVias; b.roadVias = [0, 1, 2, 3, 4, 5].map((i) => [s[0] + i * 2, s[1] + (i % 2 ? 4 : -4)]);
  const t0 = performance.now(); for (let i = 0; i < 20; i++) b.roadTo(t); const r = (performance.now() - t0) / 20;
  b.roadVias = keep; b.roadTo(t); return r;
});
check(ms < 15, `Neu-Rechnen beim Ziehen schnell genug (${ms.toFixed(1)} ms)`);
// 6) ✓ während des Ziehens (zweiter Finger auf dem Knopf): sauber gebaut, kein Fehler, kein ↶ danach
{
  const mc = await page.evaluate(() => { const b = window.__ui.build; const h = b.handles.find((x) => x.kind === 'mid'); return h ? [h.x, h.y] : null; });
  if (mc) {
    const dy = await page.evaluate(([x, y]) => [2, -2, 3, -3].find((d) => window.__ui.build.passable(x, y + d)) ?? 2, mc);
    const q0 = await scr(...mc), q1 = await scr(mc[0], mc[1] + dy), q2 = await scr(mc[0] + 2, mc[1] + dy);
    await ptr('pointerdown', 1, q0);
    for (let i = 1; i <= 5; i++) await ptr('pointermove', 1, [q0[0] + (q1[0] - q0[0]) * i / 5, q0[1] + (q1[1] - q0[1]) * i / 5]);
    await page.evaluate(() => document.querySelector('#hintOk').click());
    for (let i = 1; i <= 5; i++) await ptr('pointermove', 1, [q1[0] + (q2[0] - q1[0]) * i / 5, q1[1] + (q2[1] - q1[1]) * i / 5]);
    await ptr('pointerup', 1, q2);
    await page.waitForTimeout(500);
    const sc = await page.evaluate(() => { const b = window.__ui.build; return { end: b.roadEndSet, n: b.roadCells.length, hist: b.roadHist.length, undo: !document.querySelector('#roadUndo').classList.contains('hidden') }; });
    check(!sc.end && sc.n === 1 && sc.hist === 0 && !sc.undo, `✓ während des Ziehens: gebaut, Plan sauber zurückgesetzt (${JSON.stringify(sc)})`);
    // ✕: erst nur den Plan verwerfen, dann das Werkzeug beenden
    await page.evaluate(() => document.querySelector('#hintX').click());
    const x1 = await page.evaluate(() => ({ mode: window.__ui.mode.kind, start: window.__ui.build.roadStart }));
    check(x1.mode === 'road' && !x1.start, '✕ verwirft erst nur den Plan');
    // Start im Wasser wird abgelehnt
    const water = await page.evaluate(([A]) => { const g = window.__game(); for (let r = 1; r < 25; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = A[0] + dx, y = A[1] + dy; if (g.inMap(x, y) && g.tiles[g.idx(x, y)] === 0) return [x, y]; } return null; }, [A]);
    if (water) {
      await page.evaluate(([x, y]) => { const r = window.__view.rig; r.tx = x + 0.5; r.tz = y + 0.5; window.__view.updateCamera(); }, water);
      await page.waitForTimeout(500);
      await tap(await scr(...water));
      const w1 = await page.evaluate(() => window.__ui.build.roadStart);
      check(!w1, 'Start im Wasser wird abgelehnt');
    }
    await page.evaluate(() => document.querySelector('#hintX').click());
    check(await page.evaluate(() => window.__ui.mode.kind) === 'none', 'zweites ✕ beendet das Werkzeug');
  }
}
console.log('Fehler im Browser:', errs.length ? errs.join(' | ') : 'keine');
console.log(fails.length || errs.length ? `FEHLER: ${fails.length + errs.length}` : 'Alle Prüfungen bestanden');
await browser.close(); server.close();
