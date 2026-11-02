// Kampf-Test ohne Browser (Paket M1 „Kampf-Regeln wie 1602“): weiße Flagge, Händler und Ureinwohner,
// Piraten fliehen, Bäume fällen, Aufstellung, Ausmustern, Patrouille, Arzt, Ausbessern bis 75 %,
// Holzgebäude, Meldungen mit Ort, Trefferchance mit ausgeglichenem Schaden, wiederholbarer Zufall
// und die Rechenzeit im großen Gefecht.
// Ausführen im Projektordner:
//   npx esbuild scripts/kampf-test.ts --bundle --platform=node --outfile=/tmp/kampf-test.cjs && node /tmp/kampf-test.cjs
// Beendet sich mit Fehlercode 1, wenn eine Prüfung fehlschlägt.
const g0 = globalThis as unknown as Record<string, unknown>;
g0.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
import {
  HIT, PIRATE_FLEE, atWar, declareWar, dismiss, ensurePirates, formationSlots, hostile, nearDoctor, orderAttack,
  orderFell, orderMove, patrol, pirates, setWhiteFlag, shipAttack, spawnUnit, unitUpkeep, whiteFlag, wooden,
} from '../src/combat';
import { SHIPS, UNITS } from '../src/data';
import { Building, Game, HUMAN, MsgAt, Ship, Unit } from '../src/game';
import { T } from '../src/world';

let fails = 0;
const check = (name: string, cond: boolean, info = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK    ' : 'FEHLER'} ${name}${info ? ' – ' + info : ''}`);
};
const run = (g: Game, sec: number, dt = 0.25) => { for (let i = 0; i < sec / dt; i++) g.tick(dt); };

/** freies Gras-/Sandfeld nahe (cx, cy) */
function landSpot(g: Game, cx: number, cy: number, r0 = 0, island?: number): [number, number] {
  for (let r = r0; r < 60; r++) for (let y = Math.floor(cy) - r; y <= Math.floor(cy) + r; y++) for (let x = Math.floor(cx) - r; x <= Math.floor(cx) + r; x++) {
    if (!g.inMap(x, y)) continue;
    const k = g.idx(x, y);
    if ((g.tiles[k] === T.Gras || g.tiles[k] === T.Sand) && !g.occ[k] && !g.roads[k] && (island === undefined || g.islandOf[k] === island)) return [x, y];
  }
  throw new Error('kein Land');
}
/** freies Wasserfeld mit Abstand zum Land nahe (cx, cy) */
function seaSpot(g: Game, cx: number, cy: number, r0 = 0): [number, number] {
  for (let r = r0; r < 80; r++) for (let y = Math.floor(cy) - r; y <= Math.floor(cy) + r; y++) for (let x = Math.floor(cx) - r; x <= Math.floor(cx) + r; x++) {
    let ok = true;
    for (let j = -2; j <= 2 && ok; j++) for (let i = -2; i <= 2; i++) if (!g.inMap(x + i, y + j) || !g.isWater(g.idx(x + i, y + j))) { ok = false; break; }
    if (ok) return [x, y];
  }
  throw new Error('kein Meer');
}
/** größte Insel (für Landtests) */
const bigIsland = (g: Game) => g.islands.slice().sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0))[0];
const newShip = (g: Game, owner: number, x: number, y: number, type: Ship['type'] = 'handel_klein', guns = 0): Ship => {
  const s: Ship = { id: g.nextId++, type, owner, name: `Test ${g.nextId}`, x: x + 0.5, y: y + 0.5, dir: 0, path: [], slots: [{ g: 'holz', n: 20 }, { g: null, n: 0 }], hp: SHIPS[type ?? 'handel_klein'].hp, guns, troops: [] };
  g.ships.push(s);
  return s;
};
/** Testwelt: zwei Gegner, Zeit nach dem Piratenstart, alles entdeckt */
function world(seed = 4242): Game {
  const g = Game.create(seed, 1);
  g.seen.fill(1);
  ensurePirates(g);
  return g;
}

// ---------- 1. Trefferchance: Kanonier gegen Türme (Vorbild: Holzturm 6, Steinturm 8 Schüsse) ----------
{
  const g = world(777);
  const isl = bigIsland(g);
  const ai = 1;
  declareWar(g, HUMAN, ai);
  const res: Record<string, number[]> = { holzturm: [], wachturm: [] };
  let shots = 0;
  // (KL) nur Kanonenschüsse auf den Turm zählen – wehrt sich der Kanonier gegen Soldaten des Gegners,
  // die zufällig auf derselben Insel stehen, zählten diese Schüsse sonst mit
  let target: Building | null = null;
  g.ev.shot = (kind, _fx, _fy, tx, ty) => { if (kind === 'kanone' && target && Math.hypot(tx - target.x - 0.5, ty - target.y - 0.5) < 1.5) shots++; };
  for (let trial = 0; trial < 60; trial++) {
    const type = trial % 2 ? 'wachturm' : 'holzturm';
    const [tx, ty] = landSpot(g, isl.cx, isl.cy, 0, isl.id);
    const tw = g.placeNeutral(type, tx, ty, ai)!;
    const [ux, uy] = landSpot(g, tx + 5, ty, 0, isl.id);
    const u = spawnUnit(g, 'kanonier', HUMAN, ux, uy);
    u.hp = 1e6;
    orderAttack(g, [u], tw.id);
    target = tw;
    shots = 0;
    for (let i = 0; i < 2000 && g.byId.has(tw.id); i++) { tw.cd = 99; g.tick(0.25); }
    res[type].push(shots);
    g.units = g.units.filter((o) => o !== u);
    if (g.byId.has(tw.id)) g.forceRemove(tw);
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const mh = mean(res.holzturm), ms = mean(res.wachturm);
  check('Holzturm fällt im Mittel nach ≈ 6 Kanonierschüssen', mh > 5.2 && mh < 6.8, mh.toFixed(2));
  check('Steinturm fällt im Mittel nach ≈ 8 Kanonierschüssen', ms > 7.2 && ms < 9.0, ms.toFixed(2));
  check('Trefferchancen 0,85 / 0,8 / 0,75', HIT.feld === 0.85 && HIT.turm === 0.8 && HIT.schiff === 0.75);
}

// ---------- 2. Weiße Flagge ----------
{
  const g = world();
  g.time = 4000;
  const pir = pirates(g)!;
  const [sx, sy] = seaSpot(g, 60, 60, 0);
  const me = newShip(g, HUMAN, sx, sy);
  const ps = newShip(g, pir.id, sx + 3, sy, 'pirat', 10);
  shipAttack(g, ps, me.id);
  run(g, 1);
  check('ohne Flagge: Pirat greift an', ps.target === me.id);
  setWhiteFlag(g, me, true);
  check('Flagge gehisst', whiteFlag(g, me));
  check('verfolgender Pirat lässt ab', ps.target === undefined);
  const hp = me.hp;
  ps.path = [];
  ps.x = sx + 2.5; ps.y = sy + 0.5;
  for (let i = 0; i < 120; i++) { me.path = []; ps.path = []; g.tick(0.25); }
  check('Pirat greift Schiff mit weißer Flagge nicht an', me.hp === hp && me.slots[0].n === 20, `Treffer ${hp} → ${me.hp}`);
  // eigene Kanonen schießen unter weißer Flagge nicht von selbst
  me.guns = 6;
  let own = 0;
  g.ev.shot = (kind, fx, fy) => { if (kind === 'schiff' && Math.hypot(fx - me.x, fy - me.y) < 0.1) own++; };
  for (let i = 0; i < 40; i++) { me.path = []; ps.path = []; g.tick(0.25); }
  check('eigene Kanonen schweigen mit weißer Flagge', own === 0, `${own} Salven`);
  setWhiteFlag(g, me, false);
  for (let i = 0; i < 40; i++) { me.path = []; ps.path = []; g.tick(0.25); }
  check('ohne Flagge schießen die eigenen Kanonen wieder von selbst', own > 0, `${own} Salven`);
  // mit Soldaten an Bord schützt die Flagge nicht
  setWhiteFlag(g, me, true);
  me.troops = [spawnUnit(g, 'infanterie', HUMAN, 0, 0).id];
  const u = g.units[g.units.length - 1]; u.ship = me.id;
  ps.target = undefined;
  g.time = Math.max(g.time, 4000);
  for (let i = 0; i < 20 && ps.target === undefined; i++) { me.path = []; ps.path = []; g.tick(0.25); }
  check('mit Soldaten an Bord schützt die weiße Flagge nicht', ps.target === me.id);
  // Angriffsbefehl holt die Flagge ein
  shipAttack(g, me, ps.id);
  check('Angriffsbefehl holt die weiße Flagge ein', !whiteFlag(g, me));
  // KI-Kriegsschiff jagt keine weiße Flagge
  const g2 = world();
  declareWar(g2, 1, HUMAN);
  const [ax, ay] = seaSpot(g2, 80, 80, 0);
  const mine = newShip(g2, HUMAN, ax, ay);
  const war = newShip(g2, 1, ax + 4, ay, 'krieg_klein', 8);
  setWhiteFlag(g2, mine, true);
  const h2 = mine.hp;
  for (let i = 0; i < 40; i++) { mine.path = []; war.path = []; g2.tick(0.25); }
  check('KI-Kriegsschiff lässt weiße Flagge in Ruhe', war.target !== mine.id && mine.hp === h2);
  setWhiteFlag(g2, mine, false);
  for (let i = 0; i < 40; i++) { mine.path = []; war.path = []; g2.tick(0.25); }
  check('ohne Flagge greift das KI-Kriegsschiff an', (mine.hp ?? 0) < (h2 ?? 0));
}

// ---------- 3. Händler und Ureinwohner ----------
{
  const g = world();
  g.time = 4000;
  const pir = pirates(g)!;
  const tr = g.players.length; g.players.push({ id: tr, name: 'Händler', color: 0xffffff, ai: false, money: 0, trader: true });
  const nat = g.players.length; g.players.push({ id: nat, name: 'Ureinwohner', color: 0x885522, ai: false, money: 0, natives: true });
  check('Piraten nie im Krieg mit dem Händler', !atWar(g, pir.id, tr) && !atWar(g, tr, pir.id));
  check('KI nie im Krieg mit Ureinwohnern', !atWar(g, 1, nat));
  declareWar(g, HUMAN, nat);
  check('Krieg gegen Ureinwohner gibt es nicht', !atWar(g, HUMAN, nat));
  check('Ureinwohner nur auf Befehl angreifbar', hostile(g, HUMAN, nat, true) && !hostile(g, HUMAN, nat, false) && !hostile(g, 1, nat, true));
  const [sx, sy] = seaSpot(g, 100, 60, 0);
  const ts = newShip(g, tr, sx, sy);
  const ps = newShip(g, pir.id, sx + 3, sy, 'pirat', 10);
  const hp = ts.hp;
  for (let i = 0; i < 60; i++) { ts.path = []; ps.path = []; g.tick(0.25); }
  check('Piraten greifen das Händlerschiff nicht an', ps.target !== ts.id && ts.hp === hp);
  // Ureinwohner-Hütte: eigene Soldaten greifen nur auf Befehl an
  const isl = bigIsland(g);
  const [hx, hy] = landSpot(g, isl.cx, isl.cy, 0, isl.id);
  const hut = g.placeNeutral('burg', hx, hy, nat)!;
  const [ux, uy] = landSpot(g, hx + 3, hy, 0, isl.id);
  const u = spawnUnit(g, 'infanterie', HUMAN, ux, uy);
  run(g, 10);
  check('Soldaten greifen Ureinwohner nicht von selbst an', u.target === undefined && hut.hp === undefined);
  orderAttack(g, [u], hut.id);
  run(g, 15);
  check('auf Befehl greifen sie Ureinwohner an', (hut.hp ?? g.maxHp(hut)) < g.maxHp(hut));
}

// ---------- 4. Piraten fliehen ----------
{
  const g = world();
  g.time = 4000;
  const pir = pirates(g)!;
  const [sx, sy] = seaSpot(g, 60, 120, 0);
  const me = newShip(g, HUMAN, sx, sy);
  const ps = newShip(g, pir.id, sx + 3, sy, 'pirat', 10);
  shipAttack(g, ps, me.id);
  ps.hp = SHIPS.pirat.hp * (PIRATE_FLEE - 0.05);
  const before = me.hp;
  g.tick(0.25);
  check('Pirat unter 30 % dreht ab', ps.target === undefined && ps.path.length > 0);
  for (let i = 0; i < 40; i++) g.tick(0.25);
  check('fliehender Pirat greift nicht an', me.hp === before && ps.target === undefined);
}

// ---------- 5. Bäume fällen ----------
{
  const g = world();
  const isl = bigIsland(g);
  let wood = -1;
  for (let y = isl.y0; y <= isl.y1 && wood < 0; y++) for (let x = isl.x0; x <= isl.x1; x++) {
    const k = g.idx(x, y);
    if (g.tiles[k] === T.Wald && !g.occ[k]) {
      // ein Grasfeld in der Nähe für den Soldaten
      let ok = false;
      for (let j = -3; j <= 3 && !ok; j++) for (let i = -3; i <= 3; i++) { const q = g.idx(x + i, y + j); if (g.tiles[q] === T.Gras && !g.occ[q]) ok = true; }
      if (ok) { wood = k; break; }
    }
  }
  const wx = wood % g.size, wy = Math.floor(wood / g.size);
  const [ux, uy] = landSpot(g, wx, wy, 1, isl.id);
  const u = spawnUnit(g, 'infanterie', HUMAN, ux, uy);
  const k2 = spawnUnit(g, 'kanonier', HUMAN, ux, uy);
  let chops = 0, felled = -1, trees = 0;
  g.ev.chop = () => chops++;
  g.ev.felled = (k) => { felled = k; };
  g.ev.trees = () => trees++;
  const n = orderFell(g, [u, k2], wood);
  check('Kanoniere fällen keine Bäume', n === 1 && k2.fell === undefined);
  run(g, 30);
  check('Soldat fällt den Baum: Feld wird Gras', g.tiles[wood] === T.Gras && g.trees[wood] === 0 && felled === wood && trees > 0, `Feld ${g.tiles[wood]}`);
  check('4 Axthiebe (≈ 4 s)', chops === 4, `${chops}`);
  check('danach wartet der Soldat', u.fell === undefined && u.target === undefined);
}

// ---------- 6. Aufstellung ----------
{
  const pts = formationSlots(6, 0, 0, 0, 10, 'reihe');
  check('Reihe: alle in einer Linie quer zur Laufrichtung', pts.every((p) => Math.abs(p[1] - 10) < 1e-6) && Math.abs(pts[0][0] - pts[5][0]) >= 4.9);
  const blk = formationSlots(9, 0, 0, 10, 0, 'block');
  const xs = new Set(blk.map((p) => Math.round(p[0])));
  check('Block: 3 × 3', xs.size === 3);
  const g = world();
  const isl = bigIsland(g);
  const [cx, cy] = landSpot(g, isl.cx, isl.cy, 0, isl.id);
  const us: Unit[] = [];
  const types = ['kanonier', 'infanterie', 'kanonier', 'reiter', 'infanterie', 'musketier'] as const;
  for (const t of types) { const [x, y] = landSpot(g, cx - 1, cy, 0, isl.id); us.push(spawnUnit(g, t, HUMAN, x, y)); }
  const [tx, ty] = landSpot(g, cx, cy + 8, 0, isl.id);
  const n = orderMove(g, us, tx + 0.5, ty + 0.5, 'block');
  run(g, 40);
  const d = (u: Unit) => Math.hypot(u.x - tx - 0.5, u.y - ty - 0.5);
  const front = us.filter((u) => u.type === 'infanterie' || u.type === 'reiter').map(d);
  const back = us.filter((u) => u.type === 'kanonier').map(d);
  check('alle laufen los', n === 6);
  check('Nahkämpfer vorn, Kanoniere hinten', Math.max(...front) <= Math.min(...back) + 0.6, `vorn ${front.map((x) => x.toFixed(1))} hinten ${back.map((x) => x.toFixed(1))}`);
}

// ---------- 7. Ausmustern ----------
{
  const g = world();
  const isl = bigIsland(g);
  const [x, y] = landSpot(g, isl.cx, isl.cy, 0, isl.id);
  const us = [spawnUnit(g, 'infanterie', HUMAN, x, y), spawnUnit(g, 'musketier', HUMAN, x, y)];
  const up = unitUpkeep(g, HUMAN);
  let died = 0;
  g.ev.died = () => died++;
  const n = dismiss(g, us);
  check('Ausmustern entfernt still (kein Sterben)', n === 2 && died === 0 && !g.units.some((u) => us.includes(u)));
  check('Sold endet', unitUpkeep(g, HUMAN) === up - UNITS.infanterie.upkeep - UNITS.musketier.upkeep);
}

// ---------- 8. Patrouille ----------
{
  const g = world();
  g.time = 4000;
  const [sx, sy] = seaSpot(g, 120, 120, 0);
  let [ex, ey] = seaSpot(g, sx + 14, sy, 0);
  const s = newShip(g, HUMAN, sx, sy, 'krieg_klein', 8);
  if (Math.hypot(ex - sx, ey - sy) < 6) [ex, ey] = seaSpot(g, sx, sy + 14, 0);
  check('Patrouille startet', patrol(g, s, ex + 0.5, ey + 0.5));
  let atA = 0, atB = 0, wasA = false, wasB = false;
  for (let i = 0; i < 4 * 120; i++) {
    g.tick(0.25);
    const a = Math.hypot(s.x - sx - 0.5, s.y - sy - 0.5) < 1.5, b = Math.hypot(s.x - ex - 0.5, s.y - ey - 0.5) < 1.5;
    if (a && !wasA) atA++;
    if (b && !wasB) atB++;
    wasA = a; wasB = b;
  }
  check('Schiff pendelt zwischen Start und Ziel', atA >= 2 && atB >= 2, `Start ${atA}×, Ziel ${atB}×`);
  // Feind in Reichweite wird angegriffen
  const pir = pirates(g)!;
  const ps = newShip(g, pir.id, Math.round(s.x) + 4, Math.round(s.y), 'pirat', 0);
  let hits = 0;
  g.ev.shot = (kind, fx, fy) => { if (kind === 'schiff' && Math.hypot(fx - s.x, fy - s.y) < 0.1) hits++; };
  for (let i = 0; i < 40; i++) { ps.path = []; g.tick(0.25); }
  check('Patrouille greift Feinde in Reichweite an', hits > 0 && (ps.hp ?? 0) < SHIPS.pirat.hp, `${hits} Salven`);
  g.ships = g.ships.filter((o) => o !== ps);
  run(g, 5);
  const [ox, oy] = seaSpot(g, sx, sy - 12, 0);
  g.moveShip(s, ox + 0.5, oy + 0.5);
  run(g, 1);
  check('anderer Fahrbefehl beendet die Patrouille', s.patrol === undefined);
}

// ---------- 9. Arzt, Ausbessern bis 75 %, Holzgebäude ----------
{
  const g = world();
  const isl = bigIsland(g);
  const [ax, ay] = landSpot(g, isl.cx, isl.cy, 0, isl.id);
  const arzt = g.placeNeutral('arzt', ax, ay, HUMAN)!;
  g.buildVersion++;
  const [nx, ny] = landSpot(g, ax + 3, ay, 0, isl.id);
  const u = spawnUnit(g, 'infanterie', HUMAN, nx, ny);
  u.hp = 5;
  const up = unitUpkeep(g, HUMAN);
  check('Soldat beim Arzt kostet keinen Sold', nearDoctor(g, u) && up === 0, `${up}`);
  run(g, 5);
  check('beim Arzt heilen 1 Leben/s', Math.abs(u.hp - 10) < 0.6, u.hp.toFixed(2));
  g.forceRemove(arzt); g.buildVersion++;
  const h0 = u.hp;
  run(g, 10);
  const own = g.own[g.idx(Math.floor(u.x), Math.floor(u.y))] === HUMAN;
  check('ohne Arzt kaum Heilung (0,03/s auf eigenem Land)', u.hp - h0 < (own ? 0.35 : 0.01), `${(u.hp - h0).toFixed(3)}`);
  check('ohne Arzt kostet er Sold', unitUpkeep(g, HUMAN) === UNITS.infanterie.upkeep);
  // Gebäude bessern sich nur bis 75 % aus
  const [bx, by] = landSpot(g, isl.cx + 6, isl.cy + 6, 0, isl.id);
  const b = g.placeNeutral('wachturm', bx, by, 1)!;
  b.hp = g.maxHp(b) * 0.3;
  run(g, 300, 1);
  check('Gebäude bessert sich von selbst nur bis 75 %', b.hp !== undefined && Math.abs(b.hp / g.maxHp(b) - 0.75) < 0.01, `${((b.hp ?? 0) / g.maxHp(b) * 100).toFixed(0)} %`);
  const fake = (type: Building['type'], tier = 0) => ({ type, tier } as Building);
  check('Holzgebäude erkannt (Holzturm, Pionierhaus, nicht Steinturm, nicht Bürgerhaus)',
    wooden(fake('holzturm')) && wooden(fake('haus', 0)) && !wooden(fake('wachturm')) && !wooden(fake('haus', 2)) && wooden(fake('kontor')));
}

// ---------- 10. Meldungen mit Ort ----------
{
  const g = world();
  g.time = 4000;
  const msgs: { t: string; at?: MsgAt }[] = [];
  g.ev.message = (t, _k, at) => msgs.push({ t, at });
  // Kontor für den Gegner, damit die Kriegserklärung einen Ort hat
  for (let i = 0; i < 600 && !g.kontor(1); i++) g.tick(1);
  declareWar(g, 1, HUMAN);
  const war = msgs.find((m) => m.t.includes('Krieg'));
  check('Kriegserklärung mit Ort (beim Kontor des Gegners)', !!g.kontor(1) && !!war?.at, war?.t ?? '–');
  const pir = pirates(g)!;
  const [sx, sy] = seaSpot(g, 140, 60, 0);
  const me = newShip(g, HUMAN, sx, sy);
  const ps = newShip(g, pir.id, sx + 3, sy, 'pirat', 10);
  g.pirateSeen = false;
  shipAttack(g, ps, me.id);
  for (let i = 0; i < 4 * 60 && g.ships.includes(me); i++) { me.path = []; g.tick(0.25); }
  const seen = msgs.find((m) => m.t.includes('Piraten gesichtet'));
  const hit = msgs.find((m) => m.t.includes('wird angegriffen') || m.t.includes('haben die'));
  check('„Piraten gesichtet“ mit Ort', !!seen?.at);
  check('Angriff/Überfall mit Ort', !!hit?.at, hit?.t ?? '–');
  // Versenkung
  const mine = newShip(g, HUMAN, sx, sy + 6, 'krieg_klein', 8);
  const p2 = newShip(g, pir.id, sx + 3, sy + 6, 'pirat', 10);
  p2.hp = 1; S_noFlee(p2);
  shipAttack(g, mine, p2.id);
  for (let i = 0; i < 80 && g.ships.includes(p2); i++) { mine.path = []; p2.path = []; g.tick(0.25); }
  const sunk = msgs.find((m) => m.t.includes('versenkt'));
  check('Versenkung mit Ort', !!sunk?.at, sunk?.t ?? '–');
}
/** fliehende Piraten bleiben stehen (für den Versenkungstest: das Schiff soll nicht entkommen) */
function S_noFlee(s: Ship) { s.path = []; }

// ---------- 11. Wiederholbarer Zufall ----------
{
  const battle = () => {
    const g = world(99);
    const isl = bigIsland(g);
    declareWar(g, HUMAN, 1);
    const [x, y] = landSpot(g, isl.cx, isl.cy, 0, isl.id);
    const a: Unit[] = [], b: Unit[] = [];
    for (let i = 0; i < 6; i++) { const p = landSpot(g, x - 4, y, 0, isl.id); a.push(spawnUnit(g, i % 2 ? 'musketier' : 'infanterie', HUMAN, p[0], p[1])); }
    for (let i = 0; i < 6; i++) { const p = landSpot(g, x + 4, y, 0, isl.id); b.push(spawnUnit(g, 'kanonier', 1, p[0], p[1])); }
    orderAttack(g, a, b[0].id);
    run(g, 60);
    return g.units.map((u) => `${u.id}:${u.hp.toFixed(3)}:${u.x.toFixed(3)}`).join('|');
  };
  check('gleiches Gefecht, gleiches Ergebnis (Zufall über g.rng)', battle() === battle());
}

// ---------- 12. Rechenzeit im großen Gefecht ----------
{
  const g = world(4242);
  const isl = bigIsland(g);
  declareWar(g, HUMAN, 1);
  const [cx, cy] = landSpot(g, isl.cx, isl.cy, 0, isl.id);
  const target = g.placeNeutral('burg', cx, cy, 1)!;
  const types = ['infanterie', 'reiter', 'musketier', 'kanonier'] as const;
  const us: Unit[] = [];
  for (let i = 0; i < 99; i++) { const [x, y] = landSpot(g, cx + 14, cy, 3 + (i % 6), isl.id); us.push(spawnUnit(g, types[i % 4], HUMAN, x, y)); }
  for (let i = 0; i < 40; i++) { const [x, y] = landSpot(g, cx, cy, 3, isl.id); spawnUnit(g, 'infanterie', 1, x, y); }
  // dazu Soldaten auf einer anderen Insel, die ein unerreichbares Ziel haben (keine Wegsuche nötig)
  const other = g.islands.find((i) => i.id !== isl.id)!;
  for (let i = 0; i < 20; i++) { const [x, y] = landSpot(g, other.cx, other.cy, 0, other.id); spawnUnit(g, 'infanterie', HUMAN, x, y); }
  orderAttack(g, us, target.id);
  orderAttack(g, g.units.filter((u) => u.owner === HUMAN && !us.includes(u)), target.id);
  const times: number[] = [];
  for (let t = 0; t < 60; t += 0.25) { const t0 = performance.now(); g.tick(0.25); times.push(performance.now() - t0); }
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const p95 = times[Math.floor(times.length * 0.95)];
  check('großes Gefecht: Spielschritt im Mittel unter 6 ms', mean < 6, `Mittel ${mean.toFixed(2)} ms, 95 % unter ${p95.toFixed(2)} ms, Soldaten ${g.units.length}`);
}

console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden');
if (fails) process.exit(1);
