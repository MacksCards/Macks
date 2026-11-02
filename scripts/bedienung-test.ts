// Bedienungs-Test ohne Browser (Paket U4 „Bauen und Kämpfen mit dem Finger“): Plan des Häuserfelds,
// Begrenzung der Bereiche, Bauen eines ganzen Häuserfelds samt Rückgängig (volle Erstattung),
// Abriss-Bereich (Rückfrage zählt dasselbe wie der Abriss), „NEU“-Merker, Soldatengruppen und Aufstellung
// im Spielstand (auch alte Stände ohne diese Angaben laden).
// Ausführen im Projektordner:
//   npx esbuild scripts/bedienung-test.ts --bundle --platform=node --outfile=/tmp/bedienung-test.cjs && node /tmp/bedienung-test.cjs
// Beendet sich mit Fehlercode 1, wenn eine Prüfung fehlschlägt.
const g0 = globalThis as unknown as Record<string, unknown>;
g0.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
import { BUILDINGS } from '../src/data';
import { Game, HUMAN, SaveData } from '../src/game';
import { spawnUnit } from '../src/combat';
import { MAX_SPAN, clampSpan, everBuilt, fieldPlan, formation, groupSize, groupUnits, markBuilt, saveGroup, setFormation } from '../src/bedienung';
import { T } from '../src/world';

let fails = 0;
const check = (name: string, cond: boolean, info = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK    ' : 'FEHLER'} ${name}${info ? ' – ' + info : ''}`);
};

// ---------- 1. Plan des Häuserfelds ----------
{
  const key = ([x, y]: [number, number]) => `${x},${y}`;
  const test = (a: [number, number], b: [number, number], name: string) => {
    const p = fieldPlan(a, b);
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    const road = new Set(p.roads.map(key));
    const used = new Set<string>();
    let overlap = 0, outside = 0;
    for (const [hx, hy] of p.houses) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const k = key([hx + i, hy + j]);
      if (road.has(k) || used.has(k)) overlap++;
      used.add(k);
      if (hx + i < x0 || hx + i > x1 || hy + j < y0 || hy + j > y1) outside++;
    }
    return { p, overlap, outside };
  };
  // 17 × 9 Felder: zwei Blöcke nebeneinander, zwei übereinander → 4 Blöcke zu 4 × 2 Häusern
  const r = test([10, 20], [26, 28], '17×9');
  check('Häuserfeld 17 × 9: 32 Häuser in vier 4 × 2-Blöcken', r.p.houses.length === 32, `${r.p.houses.length}`);
  check('Häuserfeld 17 × 9: Wegstreifen dazwischen (25 Felder)', r.p.roads.length === 25, `${r.p.roads.length}`);
  check('Häuserfeld: Häuser überlappen weder sich noch die Wege', r.overlap === 0 && r.outside === 0, `überlappt ${r.overlap}, außerhalb ${r.outside}`);
  // jede Ecke kann die erste sein: gleiche Zahl, Raster hängt an Ecke 1
  for (const [a, b] of [[[26, 28], [10, 20]], [[26, 20], [10, 28]], [[10, 28], [26, 20]]] as [[number, number], [number, number]][]) {
    const q = test(a, b, '');
    check(`Häuserfeld von Ecke ${a} nach ${b}: ebenso 32 Häuser, sauber`, q.p.houses.length === 32 && q.overlap === 0 && q.outside === 0, `${q.p.houses.length}/${q.overlap}/${q.outside}`);
  }
  // hochkant: Blöcke liegen quer
  const tall = test([5, 5], [13, 21], 'hoch');
  check('Häuserfeld 9 × 17 (hochkant): 32 Häuser', tall.p.houses.length === 32 && tall.overlap === 0 && tall.outside === 0, `${tall.p.houses.length}`);
  // ein einzelner Block ohne Wegstreifen
  const one = test([0, 0], [7, 3], '8×4');
  check('Häuserfeld 8 × 4: genau ein Block, keine Wege', one.p.houses.length === 8 && one.p.roads.length === 0, `${one.p.houses.length}/${one.p.roads.length}`);
  check('Ecke 1 allein (1 × 1): kein Haus', fieldPlan([3, 3], [3, 3]).houses.length === 0);
  const c = clampSpan([10, 10], [80, -50]);
  check(`Bereich höchstens ${MAX_SPAN} Felder je Seite`, c[0] - 10 + 1 === MAX_SPAN && 10 - c[1] + 1 === MAX_SPAN, `${c}`);
}

// ---------- Welt mit eigenem Kontor ----------
function world(seed: number) {
  const g = Game.create(seed, 1);
  g.seen.fill(1);
  const msgs: string[] = [];
  g.ev.message = (t: string) => { msgs.push(t); };
  const home = g.islands.find((i) => i.heimat) ?? g.islands[0];
  for (let y = home.y0; y <= home.y1; y++) for (let x = home.x0; x <= home.x1; x++) {
    if (g.islandOf[g.idx(x, y)] !== home.id || !g.canPlace('kontor', x, y, HUMAN, true).ok) continue;
    const k = g.placeNeutral('kontor', x, y, HUMAN);
    if (k) { g.focus = k.island; return { g, msgs, k }; }
  }
  throw new Error('kein Kontorplatz');
}
/** freier Bereich w × h im eigenen Gebiet (Gras oder Wald, keine Gebäude/Wege) */
function freeRect(g: Game, w: number, h: number): [number, number] | null {
  for (let y = 0; y + h <= g.size; y++) for (let x = 0; x + w <= g.size; x++) {
    let ok = true;
    for (let j = 0; j < h && ok; j++) for (let i = 0; i < w; i++) {
      const k = g.idx(x + i, y + j);
      if (g.own[k] !== HUMAN || g.occ[k] || g.roads[k] || (g.tiles[k] !== T.Gras && g.tiles[k] !== T.Wald)) { ok = false; break; }
    }
    if (ok) return [x, y];
  }
  return null;
}

// ---------- 2. Häuserfeld bauen und zurücknehmen ----------
{
  let done = false;
  for (const seed of [5, 17, 29, 41]) {
    const { g, k } = world(seed);
    const l = g.lagerOf(HUMAN, k.island)!;
    l.holz = 200;
    g.players[HUMAN].money = 10000;
    const at = freeRect(g, 17, 4) ?? freeRect(g, 8, 4);
    if (!at) continue;
    const w = freeRect(g, 17, 4) ? 17 : 8;
    const plan = fieldPlan(at, [at[0] + w - 1, at[1] + 3]);
    const money0 = g.players[HUMAN].money, holz0 = l.holz, n0 = g.buildings.length;
    const before = new Set(g.buildings);
    const nh = g.placeMany('haus', plan.houses);
    const built = g.buildings.filter((b) => !before.has(b));
    const nr = g.placeRoads(plan.roads, HUMAN, 'weg');
    check(`Häuserfeld ${w} × 4 gebaut: ${plan.houses.length} Häuser`, nh === plan.houses.length && built.length === nh, `${nh}/${plan.houses.length}`);
    check('Häuserfeld: Wegstreifen gebaut', nr === plan.roads.length, `${nr}/${plan.roads.length}`);
    check('Häuserfeld kostet 3 Holz je Haus und 5 Taler je Wegfeld', holz0 - l.holz === 3 * nh && money0 - g.players[HUMAN].money === 5 * nr, `Holz −${holz0 - l.holz}, Taler −${money0 - g.players[HUMAN].money}`);
    check('„NEU“: Wohnhaus gilt nach dem Bau als gebaut', everBuilt(g, 'haus'));
    const u1 = g.undoBuild(built), u2 = nr ? g.undoBuild(plan.roads) : { ok: true, n: 0, refund: {} };
    check('Rückgängig nimmt alle Häuser und Wege zurück', u1.ok && u1.n === nh && u2.n === nr && g.buildings.length === n0, `${u1.n}/${u2.n}`);
    check('Rückgängig erstattet die vollen Kosten', l.holz === holz0 && g.players[HUMAN].money === money0, `Holz ${l.holz}/${holz0}, Taler ${g.players[HUMAN].money}/${money0}`);
    check('nach Rückgängig liegen dort keine Wege mehr', plan.roads.every(([x, y]) => !g.roads[g.idx(x, y)]));
    // Abriss-Bereich: Rückfrage (dry) zählt dasselbe, was dann abgerissen wird; das Kontor bleibt
    g.placeMany('haus', plan.houses);
    g.placeRoads(plan.roads, HUMAN, 'weg');
    const [kx, ky] = [k.x, k.y];
    const ax = Math.min(at[0], kx), ay = Math.min(at[1], ky), bx = Math.max(at[0] + w - 1, kx + 3), by = Math.max(at[1] + 3, ky + 3);
    const dry = g.demolishArea(ax, ay, bx, by, true);
    const real = g.demolishArea(ax, ay, bx, by);
    check('Abriss-Bereich: Rückfrage zählt wie der Abriss', dry.buildings === real.buildings && dry.roads === real.roads && dry.buildings >= nh, `${dry.buildings}/${real.buildings} Gebäude, ${dry.roads}/${real.roads} Wege`);
    check('Abriss-Bereich: das Kontor bleibt stehen', g.buildings.includes(k) && real.kept === 1);
    done = true;
    break;
  }
  check('Testplatz für das Häuserfeld gefunden', done);
}

// ---------- 3. Merkzettel im Spielstand: „NEU“, Gruppen, Aufstellung ----------
{
  const { g } = world(7);
  const isl = g.islands.find((i) => i.heimat) ?? g.islands[0];
  const spots: [number, number][] = [];
  for (let y = isl.y0; y <= isl.y1 && spots.length < 5; y++) for (let x = isl.x0; x <= isl.x1 && spots.length < 5; x++) {
    const k = g.idx(x, y);
    if (g.islandOf[k] === isl.id && g.tiles[k] === T.Gras && !g.occ[k]) spots.push([x, y]);
  }
  const us = spots.map(([x, y], i) => spawnUnit(g, i < 3 ? 'infanterie' : 'musketier', HUMAN, x, y));
  saveGroup(g, 0, us.slice(0, 3));
  saveGroup(g, 2, us);
  setFormation(g, 'reihe');
  markBuilt(g, 'steinweg');
  check('Gruppe 1 hat 3 Soldaten, Gruppe 3 hat 5, Gruppe 2 ist leer', groupSize(g, 0) === 3 && groupSize(g, 2) === 5 && groupSize(g, 1) === 0);
  const data = JSON.parse(JSON.stringify(g.serialize())) as SaveData;
  const h = Game.fromSave(data);
  check('Spielstand: Gruppen bleiben erhalten', groupUnits(h, 0).length === 3 && groupUnits(h, 2).length === 5, `${groupUnits(h, 0).length}/${groupUnits(h, 2).length}`);
  check('Spielstand: Aufstellung „Reihe“ bleibt', formation(h) === 'reihe');
  check('Spielstand: „schon gebaut“ bleibt (Pflasterweg)', everBuilt(h, 'steinweg'));
  // alter Stand ohne Angaben der Bedienung
  const old = JSON.parse(JSON.stringify(data)) as SaveData;
  if (old.ext) delete old.ext.bedienung;
  const o = Game.fromSave(old);
  check('alter Spielstand lädt: leere Gruppen, Block, nichts „schon gebaut“', groupSize(o, 0) === 0 && formation(o) === 'block' && !everBuilt(o, 'steinweg'));
  // ein gefallener Soldat fällt aus der Gruppe
  h.units = h.units.filter((u) => u.id !== us[0].id);
  check('gefallener Soldat zählt nicht mehr zur Gruppe', groupSize(h, 0) === 2 && groupUnits(h, 0).length === 2);
  // neues Spiel: frische Merkzettel
  const fresh = Game.create(99, 1);
  check('neues Spiel: keine Gruppen, Block', groupSize(fresh, 0) === 0 && formation(fresh) === 'block');
  // „NEU“ gilt nur für freigeschaltete Gebäude: Wohnhaus ist ab Anfang da (ohne Freischaltung)
  check('Wohnhaus hat keine Freischaltung (kein „NEU“ am Anfang)', !BUILDINGS.haus.unlock);
}

console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden');
if (fails) process.exit(1);
