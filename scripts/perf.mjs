// Leistungsmessung im Browser (Playwright, Software-Grafik SwiftShader).
// Misst, was auch ohne echtes iPhone vergleichbar ist: Zeichenaufrufe, Dreiecke, Grafik-Puffer,
// Daten zur Grafikkarte je Bild, Grafik-Programme, gezeichnete Bilder je Sekunde (Drosselung),
// Speichermüll je Bild und Bildzeit (Software-Grafik: nur als Verhältnis aussagekräftig).
//
// Aufruf:  node scripts/perf.mjs [html=dist/index.html] [port=5410] [--json=datei.json] [--bild=stadt.png] [--schnell]
// Vorher:  npx vite build
// Auf dem echten iPhone: Spiel mit ?debug in der Adresse öffnen – unten links steht dann die Bildzeit.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const pos = args.filter((a) => !a.startsWith('--'));
const html = readFileSync(resolve(pos[0] ?? 'dist/index.html'));
const port = Number(pos[1] ?? 5410);
const quick = !!flags.schnell;

const server = createServer((req, res) => {
  if (req.url.includes('manifest')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); return; }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(html);
}).listen(port);

// ---------- im Browser: Zähler für WebGL-Aufrufe (hochgeladene Bytes, lebende Puffer/Texturen/Programme) ----------
const GLSPY = `(() => {
  const P = WebGL2RenderingContext.prototype;
  const st = window.__gl = { up: 0, upCalls: 0, draws: 0, live: { buf: 0, tex: 0, prog: 0, vao: 0 }, created: { buf: 0, tex: 0, prog: 0 }, deleted: { buf: 0, tex: 0, prog: 0 } };
  window.__glReset = () => { st.up = st.upCalls = st.draws = 0; };
  const bytes = (d) => (d == null ? 0 : d.byteLength ?? d.length ?? 0);
  const wrap = (name, fn) => { const o = P[name]; P[name] = function (...a) { fn(a); return o.apply(this, a); }; };
  // bufferSubData(target, offset, src, srcOffset, length): bei Teil-Uploads zählt nur die Länge
  wrap('bufferSubData', (a) => { const el = a[2] && a[2].BYTES_PER_ELEMENT ? a[2].BYTES_PER_ELEMENT : 1; st.up += a[4] !== undefined ? a[4] * el : Math.max(0, bytes(a[2]) - (a[3] ?? 0) * el); st.upCalls++; });
  for (const n of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) wrap(n, () => { st.draws++; });
  const pairs = [['createBuffer', 'deleteBuffer', 'buf'], ['createTexture', 'deleteTexture', 'tex'], ['createProgram', 'deleteProgram', 'prog'], ['createVertexArray', 'deleteVertexArray', 'vao']];
  for (const [c, d, k] of pairs) {
    const oc = P[c], od = P[d];
    P[c] = function (...a) { st.live[k]++; if (st.created[k] !== undefined) st.created[k]++; return oc.apply(this, a); };
    P[d] = function (...a) { if (a[0]) { st.live[k]--; if (st.deleted[k] !== undefined) st.deleted[k]++; } return od.apply(this, a); };
  }
})();`;

// ---------- im Browser: Hilfen (Bilder von Hand treiben, Stadt bauen) ----------
const HARNESS = `window.P = (() => {
  const g = () => window.__game(), v = () => window.__view, ui = () => window.__ui;
  const stat = (a) => { if (!a.length) return { n: 0 }; const s = [...a].sort((x, y) => x - y); const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]; return { n: a.length, p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +s[s.length - 1].toFixed(2) }; };
  // Spielschleife anhalten: requestAnimationFrame stumm schalten (die Schleife meldet sich dann nicht mehr an)
  let raf = null;
  const stopLoop = () => { if (!raf) { raf = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; } };
  let clock = 1000, acc = 0;
  const info = () => { const r = v().renderer; return { calls: r.info.render.calls, tris: r.info.render.triangles, geos: r.info.memory.geometries, tex: r.info.memory.textures, progs: r.info.programs.length }; };
  // n Bilder wie die Spielschleife: Spielschritte nachholen, dann view.frame; misst JS-Zeit und Fertigstellung
  const run = (n, o = {}) => {
    const V = v(), rr = V.renderer.render.bind(V.renderer), gl = V.renderer.getContext(), px = new Uint8Array(4);
    const t = { frame: [], render: [], finish: [] };
    V.renderer.render = (...a) => { const t0 = performance.now(); rr(...a); const t1 = performance.now(); if (o.sync !== false) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); t.render.push(t1 - t0); t.finish.push(performance.now() - t1); };
    window.__glReset();
    try {
      for (let i = 0; i < n; i++) {
        clock += 1 / 30;
        if (o.ticks) { acc += 1 / 30; while (acc >= 0.25) { g().tick(0.25); acc -= 0.25; } g().alpha = acc / 0.25; }
        const t0 = performance.now();
        V.frame(clock, o.ticks ? 1 / 30 : 0);
        t.frame.push(performance.now() - t0);
      }
    } finally { V.renderer.render = rr; }
    const gs = window.__gl;
    return { ...info(), upKB: +(gs.up / n / 1024).toFixed(1), upCalls: +(gs.upCalls / n).toFixed(1), draws: +(gs.draws / n).toFixed(1), frameMs: stat(t.frame), renderCpuMs: stat(t.render), finishMs: stat(t.finish) };
  };
  const live = () => ({ buf: window.__gl.live.buf, tex: window.__gl.live.tex, vao: window.__gl.live.vao, prog: window.__gl.live.prog, geos: v().renderer.info.memory.geometries, texs: v().renderer.info.memory.textures });
  const lookAt = (x, z, dist) => { const r = v().rig; r.tx = x; r.tz = z; r.dist = dist; r.yaw = Math.PI * 0.25; v().updateCamera(); };
  // Stadt für Messungen (nur Test): Kontor, Marktplätze, Wegeraster, Betriebe, Häuser
  const TYPES = ['holzfaeller', 'fischer', 'jagdhuette', 'schweinezucht', 'fleischerei', 'schaffarm', 'weberei', 'getreidefarm', 'muehle', 'baeckerei', 'kapelle', 'wirtshaus', 'schule', 'kirche', 'badehaus', 'steinbruch', 'brauerei', 'schneiderei', 'hochschule', 'theater', 'erzmine', 'schmiede'];
  const rich = (G, who, isl, n = 99) => { const l = G.lagerOf(who, isl); if (l) for (const k of Object.keys(l)) l[k] = n; };
  const city = (houses = 120, prod = 40) => {
    const G = g(); G.seen.fill(1);
    for (const t of [...TYPES, 'markt', 'haus', 'kontor']) G.unlocked.add(t);
    const isl = [...G.islands].sort((a, b) => b.land - a.land).find((i) => !G.buildings.some((b) => b.island === i.id));
    if (!isl) return { fehler: 'keine freie Insel' };
    const ship = G.ships.find((s) => s.owner === 0);
    let k = null;
    for (let y = isl.y0; y <= isl.y1 && !k; y++) for (let x = isl.x0; x <= isl.x1 && !k; x++) {
      if (!G.canPlace('kontor', x, y, 0, true).ok) continue;
      for (const [rx, ry] of G.ring({ type: 'kontor', x, y })) if (G.inMap(rx, ry) && G.tiles[G.idx(rx, ry)] === 0) { ship.x = rx + 0.5; ship.y = ry + 0.5; break; }
      if (G.place('kontor', x, y, 0)?.ok) k = G.kontor(0, isl.id);
    }
    if (!k) return { fehler: 'kein Kontor' };
    G.players[0].money = 5e7; rich(G, 0, isl.id);
    k.level = 3; G.recompute?.(); rich(G, 0, isl.id);
    const [kx, ky] = G.center(k);
    let markets = 0;
    for (let r = 0; r < 12; r++) {
      let best = null, bd = -1;
      for (let y = isl.y0; y <= isl.y1; y++) for (let x = isl.x0; x <= isl.x1; x++) {
        if (G.own[G.idx(x, y)] !== 0 || !G.canPlace('markt', x, y, 0).ok) continue;
        const d = Math.hypot(x - kx, y - ky); if (d > bd) { bd = d; best = [x, y]; }
      }
      if (!best) break;
      if (G.place('markt', best[0], best[1], 0)?.ok) markets++;
      rich(G, 0, isl.id);
    }
    const cells = [];
    for (let y = isl.y0; y <= isl.y1; y++) for (let x = isl.x0; x <= isl.x1; x++) {
      const i = G.idx(x, y);
      if (G.own[i] === 0 && G.tiles[i] !== 3 && ((x - Math.floor(kx)) % 4 === 0 || (y - Math.floor(ky)) % 4 === 0)) cells.push([x, y]);
    }
    const roads = G.placeRoads(cells, 0);
    const nearRoad = (t, x, y) => { for (const [rx, ry] of G.ring({ type: t, x, y })) if (G.inMap(rx, ry) && G.roads[G.idx(rx, ry)]) return true; return false; };
    const put = (t, score) => {
      let best = null, bs = -1e9;
      for (let y = isl.y0; y <= isl.y1; y++) for (let x = isl.x0; x <= isl.x1; x++) {
        if (G.own[G.idx(x, y)] !== 0 || !G.canPlace(t, x, y, 0).ok || !nearRoad(t, x, y)) continue;
        const s = score(x, y); if (s > bs) { bs = s; best = [x, y]; }
      }
      return best && G.place(t, best[0], best[1], 0)?.ok;
    };
    let p = 0, h = 0, i = 0;
    while (p < prod && i < prod * 3) { if (put(TYPES[i++ % TYPES.length], (x, y) => -Math.hypot(x - kx, y - ky) * 0.2 + ((x * 7 + y * 13) % 5))) p++; if (i % 8 === 0) rich(G, 0, isl.id); }
    for (let n = 0; n < houses * 2 && h < houses; n++) { if (put('haus', (x, y) => -Math.hypot(x - kx, y - ky) + ((x * 3 + y * 5) % 3))) h++; else break; if (n % 10 === 0) rich(G, 0, isl.id); }
    v().onSeen();
    lookAt(kx, ky, 30);
    return { insel: isl.name, markets, roads, betriebe: p, haeuser: h, gebaeude: G.buildings.length };
  };
  // warten, bis die Grafik-Programme vorbereitet sind (View.preparing)
  const waitPrepared = () => new Promise((res) => { const t0 = performance.now(); const f = () => (!v().preparing || performance.now() - t0 > 30000) ? res(Math.round(performance.now() - t0)) : setTimeout(f, 20); f(); });
  // gezeichnete Bilder je Sekunde in der echten Spielschleife (und wie oft die Schleife lief)
  let lastLoops = 0;
  const countDraws = async (ms) => {
    const V = v(); let n = 0, loops = 0;
    const rr = V.renderer.render; V.renderer.render = function (...a) { n++; return rr.apply(this, a); };
    const raf0 = window.requestAnimationFrame; window.requestAnimationFrame = (cb) => raf0((t) => { loops++; cb(t); });
    await new Promise((r) => setTimeout(r, ms));
    V.renderer.render = rr; window.requestAnimationFrame = raf0;
    lastLoops = +(loops / (ms / 1000)).toFixed(1);
    return +(n / (ms / 1000)).toFixed(1);
  };
  const loopsPerS = () => lastLoops;
  return { g, v, ui, stat, stopLoop, run, info, live, lookAt, city, waitPrepared, countDraws, loopsPerS };
})();`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const errs = [];
const warns = [];
async function open(w, h, dpr, query = '') {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/ERR_|fonts\.g/.test(t)) errs.push(t); if (m.type() === 'warning' && /THREE|Buffer|GL_/.test(t) && !/ReadPixels|parallel_shader/.test(t)) warns.push(t.slice(0, 160)); });
  await page.addInitScript({ content: GLSPY });
  await page.route('**/fonts.g*apis.com/**', (r) => r.abort());
  await page.route('**/fonts.gstatic.com/**', (r) => r.abort());
  const t0 = Date.now();
  await page.goto(`http://localhost:${port}/${query}`);
  await page.waitForFunction(() => window.__game && window.__view && window.__ui, null, { timeout: 120000 });
  await page.addScriptTag({ content: HARNESS });
  const prepMs = await page.evaluate(() => P.waitPrepared());
  const startMs = Date.now() - t0;
  await page.evaluate(() => { window.__ui.closeModal(); });
  await page.waitForTimeout(300);
  return { ctx, page, prepMs, startMs };
}
const out = { datei: pos[0] ?? 'dist/index.html', zeit: new Date().toISOString() };
const log = (k, v) => { out[k] = v; console.log(k.padEnd(26), JSON.stringify(v)); };

// ===== Teil 1: kleines Bild (viele Bilder schnell): Drosselung, Leck, Neues Spiel, Vorwärmen, Upload =====
{
  const { ctx, page, prepMs, startMs } = await open(284, 131, 1);
  log('start', { bisSpielBereit_ms: startMs, vorbereiten_ms: prepMs });
  // Drosselung mit echter Spielschleife: gezeichnete Bilder je Sekunde beim Spielen, in Pause, mit Menü, im Hochformat
  log('drosselung_bilder_je_s', await page.evaluate(async () => {
    const V = P.v(), ui = P.ui(), res = {};
    if (typeof V.setQuality === 'function') V.setQuality('hoch');
    // je Zustand: gezeichnete Bilder je Sekunde / Durchläufe der Spielschleife je Sekunde
    const m = async (ms) => { const b = await P.countDraws(ms); return `${b} / ${P.loopsPerS()}`; };
    ui.paused = false; await P.countDraws(400); res.spielt = await m(2000);
    ui.paused = true; await P.countDraws(400); res.pause = await m(2000);
    const r = V.rig; const iv = setInterval(() => { r.tx += 0.05; }, 16);
    res.pauseMitKamerafahrt = await m(1500); clearInterval(iv);
    ui.paused = false;
    ui.openHelp?.(); await P.countDraws(400); res.menuOffen = await m(2000); ui.closeModal();
    if (typeof V.setQuality === 'function') { V.setQuality('sparsam'); await P.countDraws(400); res.sparsam = await m(2000); V.setQuality('hoch'); }
    return res;
  }));
  await page.setViewportSize({ width: 131, height: 284 });
  await page.waitForTimeout(400);
  log('hochformat', await page.evaluate(async () => { const t0 = P.g().time; const b = await P.countDraws(2000); return { bilderJeS: b, schleifeJeS: P.loopsPerS(), spielzeitLief: +(P.g().time - t0).toFixed(2) }; }));
  await page.setViewportSize({ width: 284, height: 131 });
  await page.waitForTimeout(400);
  await page.evaluate(() => P.stopLoop());
  await page.waitForTimeout(200);
  log('start_leerlauf', await page.evaluate(() => { P.run(3); return P.run(20, { sync: false }); }));
  // Schiffsroute: 300 Bilder mit ausgewähltem Schiff auf langer Fahrt (ohne Spielschritte: nur die Darstellung)
  log('route_300_bilder', await page.evaluate(() => {
    const G = P.g(), V = P.v(), ship = G.ships.find((s) => s.owner === 0);
    const water = []; for (let k = 0; k < G.size * G.size; k += 37) if (G.tiles[k] === 0) water.push(k);
    let ok = false;
    for (const f of [0.7, 0.5, 0.3, 0.9]) { const k = water[Math.floor(water.length * f)]; if (G.moveShip(ship, (k % G.size) + 0.5, ((k / G.size) | 0) + 0.5)) { ok = true; break; } }
    V.ships.selected = ship.id;
    P.run(3);
    const l0 = P.live(), c0 = window.__gl.created.buf;
    // Schiff wandert auf der Route (wie beim Segeln), Darstellung jedes Bild
    for (let i = 0; i < 300; i++) { ship.x += 0.002; P.run(1, { sync: false }); }
    const l1 = P.live();
    const r = { kursGesetzt: ok, wegpunkte: ship.path.length, neuePuffer: window.__gl.created.buf - c0, lebendePufferVorher: l0.buf, lebendePufferNachher: l1.buf };
    V.ships.selected = null;
    return r;
  }));
  // lange Route nach kurzer Route: wird die lange vollständig gezeigt?
  log('route_kurz_dann_lang', await page.evaluate(() => {
    const G = P.g(), V = P.v(), ship = G.ships.find((s) => s.owner === 0);
    V.ships.selected = ship.id;
    ship.path = [[ship.x + 1, ship.y + 1], [ship.x + 2, ship.y + 1]];
    P.run(2);
    const long = []; let x = ship.x, y = ship.y; for (let i = 0; i < 200; i++) { x += 0.3; y += (i % 2 ? 1 : -1) * 0.2; long.push([x, y]); }
    ship.path = long;
    P.run(2);
    const geo = V.ships.route.geometry;
    const shown = Math.min(geo.drawRange.count, geo.attributes.position.count);
    ship.path = []; V.ships.selected = null; P.run(1);
    return { punkteNoetig: long.length + 1, punkteGezeigt: shown };
  }));
  // Neues Spiel fünfmal: lebende Puffer/Texturen dürfen nicht wachsen
  log('neues_spiel', await page.evaluate(async () => {
    const res = [];
    const once = async (seed) => { const G = P.g(); const ng = G.constructor.create(seed, 2); P.ui().onNewGame(ng); await P.waitPrepared(); ng.seen.fill(1); P.v().onSeen(); P.run(2, { sync: false }); };
    await once(4242); res.push(P.live());
    for (let i = 1; i <= 3; i++) { await once(4242 + i * 17); res.push(P.live()); }
    await once(4242); res.push(P.live());
    return res;
  }));
  // Vorwärmen: neue Grafik-Programme beim ersten Gebrauch von Vorschau, Ringen, Wegen, Warnsymbol, Kampf, Untergang
  log('programme_erstbenutzung', await page.evaluate(async () => {
    await P.waitPrepared();
    const G = P.g(), V = P.v();
    P.run(2, { sync: false });
    const p0 = window.__gl.created.prog, n0 = V.renderer.info.programs.length;
    const isl = [...G.islands].sort((a, b) => b.land - a.land)[0];
    const cx = Math.floor(isl.cx), cy = Math.floor(isl.cy);
    P.lookAt(cx, cy, 20);
    const steps = {};
    const step = (name, fn) => { const a = window.__gl.created.prog; try { fn(); } catch (e) { steps[name] = 'Fehler: ' + e.message; return; } P.run(1, { sync: false }); steps[name] = window.__gl.created.prog - a; };
    step('bauvorschau', () => V.setGhost('haus', cx, cy, true));
    step('bauvorschau_rot', () => V.setGhost('haus', cx, cy, false));
    step('auswahlring', () => { V.setGhost(null); V.setSelected({ type: 'haus', x: cx, y: cy, id: -1 }); });
    step('wegvorschau', () => { V.setSelected(null); V.setRoadPreview([[cx, cy], [cx + 1, cy]], [true, false]); });
    step('wege', () => { V.setRoadPreview([], []); G.roads[G.idx(cx, cy)] = 1; V.onRoadsChanged(); });
    step('schiffsroute', () => { const s = G.ships.find((x) => x.owner === 0); s.path = [[s.x + 2, s.y], [s.x + 4, s.y + 1]]; V.ships.selected = s.id; });
    step('schuss', () => { V.ships.selected = null; V.fx.shot('kanone', cx, cy, cx + 3, cy + 2, true); V.fx.burn('x', cx, 0.5, cy, 1, 0.1); });
    step('lebensbalken', () => { V.fx.bars.begin(); V.fx.bars.bar(cx, 1, cy, 0.5); V.fx.bars.end(); });
    step('soldat', () => { G.units.push({ id: 999999, type: 'infanterie', owner: 0, x: cx + 0.5, y: cy + 0.5, dir: 0, hp: 20, path: [], cd: 0 }); });
    step('soldat_faellt', () => { const u = G.units.find((x) => x.id === 999999); V.onUnitDied(u); G.units = G.units.filter((x) => x !== u); });
    step('warnsymbol', () => { const b = G.buildings.find((x) => x.owner === 0) ?? G.buildings[0]; if (b) { b.status = 'keinWeg'; V.refreshIcons(); } });
    step('schiff_sinkt', () => { const s = G.ships.find((x) => x.owner === 0); V.ships.sink(s.id); });
    for (let i = 0; i < 4; i++) P.run(25, { sync: false });
    steps.schiff_sinkt_spaeter = window.__gl.created.prog - p0 - Object.values(steps).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    return { programmeVorher: n0, neu: window.__gl.created.prog - p0, schritte: steps };
  }));
  await ctx.close();
}

// ===== Teil 2: iPhone-Querformat mit Stadt: Aufrufe, Dreiecke, Daten je Bild, Speichermüll, Bildzeit (Verhältnis) =====
if (!quick) {
  const { ctx, page } = await open(852, 393, 1, '?q=hoch');
  await page.evaluate(() => { P.stopLoop(); if (typeof P.v().setQuality === 'function') P.v().setQuality('hoch'); });
  await page.waitForTimeout(200);
  // immer dieselbe Welt, damit vorher/nachher vergleichbar ist
  await page.evaluate(async () => { const G = P.g(); const ng = G.constructor.create(20261031, 2); P.ui().onNewGame(ng); await P.waitPrepared(); });
  log('iphone_start', await page.evaluate(() => { P.run(2); return P.run(6); }));
  log('stadt', await page.evaluate(() => P.city(120, 40)));
  await page.evaluate(() => P.waitPrepared());
  for (const d of [14, 30, 60, 110]) {
    log('stadt_abstand_' + d, await page.evaluate((d) => { const V = P.v(); V.rig.dist = d; V.updateCamera(); P.run(2, { ticks: true }); return P.run(5, { ticks: true }); }, d));
  }
  // Speichermüll je Aufruf (KB): Stichproben-Messung der Speicher-Anlage (Chrome-Werkzeug), Stadt bei Abstand 24
  {
    await page.evaluate(() => { const V = P.v(); V.rig.dist = 24; V.updateCamera(); P.run(3, { ticks: true }); });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('HeapProfiler.enable');
    const res = {};
    for (const [label, n] of [['life.update', 300], ['units.update', 300], ['ships.update', 300], ['fx.update', 300], ['view.frame', 15]]) {
      await cdp.send('HeapProfiler.startSampling', { samplingInterval: 128 });
      await page.evaluate(([label, n]) => {
        const V = P.v(); let t = 2000 + Math.random(); const cam = { x: V.rig.tx, z: V.rig.tz, dist: V.rig.dist };
        for (let i = 0; i < n; i++) {
          t += 0.033;
          if (label === 'life.update') V.life.update(t, cam);
          else if (label === 'units.update') V.units.update(t, cam);
          else if (label === 'ships.update') V.ships.update(t);
          else if (label === 'fx.update') V.fx.update(0.033, 400);
          else V.frame(t, 0.033);
        }
      }, [label, n]);
      const { profile } = await cdp.send('HeapProfiler.stopSampling');
      let sum = 0; const walk = (nd) => { sum += nd.selfSize; for (const c of nd.children) walk(c); }; walk(profile.head);
      res[label] = +(sum / n / 1024).toFixed(2);
    }
    log('muell_kb_je_aufruf', res);
  }
  await page.screenshot({ path: flags.bild ? String(flags.bild) : '/tmp/perf-stadt.png' }).catch(() => {});
  await ctx.close();
}

log('warnungen', [...new Set(warns)].slice(0, 6));
log('seitenfehler', errs.slice(0, 6));
if (flags.json) writeFileSync(String(flags.json), JSON.stringify(out, null, 1));
await browser.close();
server.close();
