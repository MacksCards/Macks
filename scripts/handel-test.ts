// Handels-Test ohne Browser (Paket S2): freier Händler, Aufträge am Kontor, Preise, Blockade, Sofort-Handel,
// Handelsrouten, Abwracken, Speichern/Laden.
// Ausführen im Projektordner:
//   npx esbuild scripts/handel-test.ts --bundle --platform=node --outfile=/tmp/handel-test.cjs && node /tmp/handel-test.cjs
// Beendet sich mit Fehlercode 1, wenn eine Prüfung fehlschlägt.
const g0 = globalThis as unknown as Record<string, unknown>;
g0.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
import { PRICES, SHIPS } from '../src/data';
import { atWar, ensurePirates } from '../src/combat';
import { Building, Game, HUMAN, Ship } from '../src/game';
import * as T from '../src/trade';

let fails = 0;
const check = (name: string, cond: boolean, info = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK    ' : 'FEHLER'} ${name}${info ? ' – ' + info : ''}`);
};

/** Küstenplatz für ein Kontor auf einer Insel (ohne Schiff), null = keiner */
function coastSite(g: Game, isl: number): [number, number] | null {
  const i = g.islands[isl];
  for (let y = i.y0; y <= i.y1; y++) for (let x = i.x0; x <= i.x1; x++) {
    if (g.islandOf[g.idx(x, y)] !== isl) continue;
    if (!g.canPlace('kontor', x, y, HUMAN, true).ok) continue;
    const b = { type: 'kontor' as const, x, y, id: -1 } as unknown as Building;
    g.buildings.push(b); // nur zum Messen der Anlegestelle
    const ok = !!T.dockAt(g, b);
    g.buildings.pop();
    if (ok) return [x, y];
  }
  return null;
}

function world(seed: number) {
  const g = Game.create(seed, 2);
  g.seen.fill(1);
  const msgs: string[] = [];
  g.ev.message = (t: string) => { msgs.push(t); };
  return { g, msgs };
}

function run(g: Game, sec: number, until?: () => boolean): number {
  for (let i = 0; i < sec * 4; i++) { g.tick(0.25); if (until?.()) return i / 4; }
  return -1;
}

// ---------- Welt mit zwei eigenen Kontoren ----------
let g!: Game, msgs!: string[], k1!: Building, k2!: Building;
for (const seed of [11, 23, 37, 51, 77, 91]) {
  ({ g, msgs } = world(seed));
  const home = g.islands.find((i) => i.heimat) ?? g.islands[0];
  const s1 = coastSite(g, home.id);
  const other = g.islands.filter((i) => i.id !== home.id).sort((a, b) => Math.hypot(a.cx - home.cx, a.cy - home.cy) - Math.hypot(b.cx - home.cx, b.cy - home.cy));
  let s2: [number, number] | null = null, isl2 = -1;
  for (const o of other) { s2 = coastSite(g, o.id); if (s2) { isl2 = o.id; break; } }
  if (!s1 || !s2) continue;
  check('vor dem ersten Kontor: kein Händler, kein Aufschlag', !T.trader(g) && T.notFaktor(g) === 1);
  k1 = g.placeNeutral('kontor', s1[0], s1[1], HUMAN)!;
  k2 = g.placeNeutral('kontor', s2[0], s2[1], HUMAN)!;
  console.log(`Welt ${seed}: Kontore auf ${g.islands[k1.island].name} und ${g.islands[isl2].name}`);
  break;
}
check('zwei Kontore gebaut', !!k1 && !!k2);
if (!k1 || !k2) process.exit(1);
const l1 = g.lagerOf(HUMAN, k1.island)!, l2 = g.lagerOf(HUMAN, k2.island)!;
g.players[HUMAN].money = 50000;
run(g, 3);
const tr = T.trader(g);
check('Händler als neutraler Spieler', !!tr && !!tr.trader && !tr.ai && tr.id === g.players.indexOf(tr));
ensurePirates(g);
const pir = g.players.find((p) => p.pirate)!;
check('Händler ist unangreifbar (Piraten, Spieler)', !!tr && !atWar(g, pir.id, tr.id) && !atWar(g, HUMAN, tr.id));
check('Sofort-Handel wird teurer (Faktor 1,4)', T.notFaktor(g) === 1.4, String(T.notFaktor(g)));
const sp = T.sofortPreis(g, 'werkzeug')!;
check('Sofort-Preis Werkzeug 126 / 43', sp.kaufen === Math.round(PRICES.werkzeug!.kaufen * 1.4) && sp.verkaufen === Math.round(PRICES.werkzeug!.verkaufen / 1.4), `${sp.kaufen}/${sp.verkaufen}`);
{
  const m0 = g.players[HUMAN].money, w0 = l1.werkzeug;
  const n = T.sofort(g, HUMAN, k1.island, 'werkzeug', 5);
  check('Sofort kaufen 5 t', n === 5 && l1.werkzeug === w0 + 5 && g.players[HUMAN].money === m0 - 5 * sp.kaufen);
  l1.werkzeug = w0;
  g.players[HUMAN].money = m0;
}

// ---------- Aufträge ----------
check('Plätze Kontor I: 4 kaufen / 3 verkaufen', T.slots(k1).buy === 4 && T.slots(k1).sell === 3);
const buyGoods = ['werkzeug', 'holz', 'nahrung', 'erz', 'stein'] as const;
const okBuy = buyGoods.map((gd) => T.setOrder(g, k1, T.defaultOrder(gd, true)).ok);
check('vier Kaufaufträge gehen, der fünfte nicht', okBuy.slice(0, 4).every(Boolean) && !okBuy[4]);
const sellGoods = ['stoff', 'alkohol', 'wolle', 'gewuerze'] as const;
const okSell = sellGoods.map((gd) => T.setOrder(g, k1, T.defaultOrder(gd, false)).ok);
check('drei Verkaufsaufträge gehen, der vierte nicht', okSell.slice(0, 3).every(Boolean) && !okSell[3]);
k1.level = 1;
check('Kontor II: 7 / 4 Plätze', T.slots(k1).buy === 7 && T.slots(k1).sell === 4 && T.setOrder(g, k1, T.defaultOrder('stein', true)).ok);
T.removeOrder(g, k1, 'stein');
k1.level = 0;
check('Preis wird auf 70–105 % begrenzt', (() => {
  T.setOrder(g, k1, { g: 'werkzeug', buy: true, limit: 999, price: 1 });
  const o = T.orders(g, k1).find((x) => x.g === 'werkzeug')!;
  return o.price === Math.ceil(90 * 0.7) && o.limit === g.capOf(HUMAN, k1.island) && T.priceRange('werkzeug', true)[1] === 94;
})());
// Werkzeug zu 105 % bis 30 t; Stoffe über 10 t zu 70 % verkaufen
T.setOrder(g, k1, { g: 'werkzeug', buy: true, limit: 30, price: 94 });
T.setOrder(g, k1, { g: 'stoff', buy: false, limit: 10, price: Math.round(PRICES.stoff!.kaufen * 0.7) });
for (const gd of ['holz', 'nahrung', 'erz', 'stein', 'alkohol', 'wolle'] as const) T.removeOrder(g, k1, gd);
check('Aufträge löschen', T.orders(g, k1).length === 2, T.orders(g, k1).map((o) => o.g).join(','));
l1.werkzeug = 0; l1.stoff = 30;

// ---------- Händler kommt ----------
const tId = tr!.id;
const tShip = () => g.ships.find((s) => s.owner === tId);
const tSpawn = run(g, 200, () => !!tShip());
check('ein Händlerschiff erscheint nach 1–2 Minuten', tSpawn >= 50 && tSpawn <= 125, `${tSpawn} s`);
const w0 = l1.werkzeug, m0 = g.players[HUMAN].money, st0 = l1.stoff;
const prBefore = T.marketPrice(g, 'werkzeug')!.kaufen;
const arrive = run(g, 240, () => msgs.some((m) => m.includes('Händler im Hafen')));
const ts = tShip();
check('Händler legt an (Meldung „Händler im Hafen“)', arrive >= 0, `${arrive} s, ${msgs.filter((m) => m.includes('Händler')).slice(-1)[0] ?? ''}`);
check('Händlerschiff hat weiße Flagge (helle Farbe) und ist groß', !!ts && ts.type === 'handel_gross' && (g.players[tId].color & 0xff) > 0xe0);
const bought = l1.werkzeug - w0, sold = st0 - l1.stoff;
check('Werkzeug gekauft (höchstens 30 t im Lager, höchstens 40 t)', bought > 0 && l1.werkzeug <= 30, `${bought} t`);
check('Stoffe verkauft (über 10 t)', sold > 0 && l1.stoff >= 10, `${sold} t`);
// (dazu kommen Steuern und Unterhalt der wenigen Sekunden bis zur Ankunft)
const expect = -bought * 94 + sold * Math.round(PRICES.stoff!.kaufen * 0.7);
check('Geld stimmt mit den Auftragspreisen', Math.abs(g.players[HUMAN].money - m0 - expect) < 40 && msgs.some((m) => m.includes(`(${expect >= 0 ? '+' : '−'}${Math.abs(expect).toLocaleString('de-DE')} Taler)`)),
  `${Math.round(g.players[HUMAN].money - m0)} / ${expect}`);
const prAfter = T.marketPrice(g, 'werkzeug')!.kaufen;
check('Kaufen macht die Ware teurer (je 10 t etwa 8 %)', prAfter > prBefore, `${prBefore} → ${prAfter}`);
check('Händler liegt im Hafen', T.traderStatus(g, k1).includes('im Hafen'), T.traderStatus(g, k1));
const left = run(g, 60, () => !!ts && ts.path.length > 0);
check('nach etwa 40 s fährt er weiter', left >= 30 && left <= 45, `${left} s`);
run(g, 300);
const prLater = T.marketPrice(g, 'werkzeug')!.kaufen;
check('Preis erholt sich in etwa 5 Minuten', prLater < prBefore + (prAfter - prBefore) * 0.15 + 2, `${prAfter} → ${prLater}`);

// ---------- visit direkt: Sortiment, Waffen, Höchstmengen, eigene Preisliste ----------
{
  T.removeOrder(g, k1, 'werkzeug'); T.removeOrder(g, k1, 'stoff');
  // Kontor IV (100 t je Ware), damit die Höchstmenge je Besuch greift und nicht der Lagerplatz
  k1.level = 3; k2.level = 3; g.recompute();
  l1.kanonen = 0; l1.tabakwaren = 0; l1.holz = 0;
  T.setOrder(g, k1, { g: 'kanonen', buy: true, limit: 50, price: 99999 });
  const r = T.visit(g, k1);
  const pk = T.orders(g, k1)[0].price;
  check('Waffen: höchstens 10 t, dreifacher Preis', l1.kanonen === 10 && pk === Math.floor(PRICES.kanonen!.kaufen * 3 * 1.05), `${l1.kanonen} t zu ${pk}`);
  check('Kassenbuch-Saldo im Ergebnis', r.taler === -10 * pk && r.tons === 10);
  T.removeOrder(g, k1, 'kanonen');
  const known = T.sells(g, 'tabakwaren');
  T.setOrder(g, k1, { g: 'tabakwaren', buy: true, limit: 50, price: 99999 });
  T.visit(g, k1);
  check('Sortiment: unbekannte Ware wird nicht verkauft', known || l1.tabakwaren === 0, `bekannt=${known}`);
  T.removeOrder(g, k1, 'tabakwaren');
  // (feste Preisliste, damit nicht der steigende Marktpreis bremst)
  T.setOrder(g, k1, { g: 'holz', buy: true, limit: 100, price: 99999 });
  T.visit(g, k1, { holz: { kaufen: 1, verkaufen: 1 } });
  check('höchstens 40 t je Ware und Besuch', l1.holz === 40, `${l1.holz} t`);
  T.removeOrder(g, k1, 'holz');
  // eigene Preisliste (z. B. KI-Händler mit Handelsvertrag): feste Preise, nur Waren aus der Liste
  l1.nahrung = 0; l1.wolle = 50;
  T.setOrder(g, k1, { g: 'nahrung', buy: true, limit: 20, price: 15 });
  T.setOrder(g, k1, { g: 'wolle', buy: false, limit: 30, price: 12 });
  const r2 = T.visit(g, k1, { nahrung: { kaufen: 14, verkaufen: 9 }, wolle: { kaufen: 14, verkaufen: 12 } });
  check('eigene Preisliste: kauft 20 t, verkauft 20 t', l1.nahrung === 20 && l1.wolle === 30 && r2.taler === -20 * 15 + 20 * 12, `${l1.nahrung}/${l1.wolle}/${r2.taler}`);
  const r3 = T.visit(g, k1, { nahrung: { kaufen: 16, verkaufen: 9 } });
  check('eigene Preisliste: zu niedriges Gebot wird nicht bedient', r3.tons === 0);
  T.removeOrder(g, k1, 'nahrung'); T.removeOrder(g, k1, 'wolle');
}

// ---------- Blockade ----------
{
  const at = T.dockAt(g, k1)!;
  const p: Ship = { id: g.nextId++, type: 'pirat', owner: pir.id, name: 'Test-Pirat', x: at[0], y: at[1], dir: 0, path: [], slots: [], hp: 9999, guns: 10 };
  check('ohne Schiff keine Blockade', !T.blockade(g, k1));
  g.ships.push(p);
  check('bewaffnetes Piratenschiff blockiert', T.blockade(g, k1)?.id === pir.id);
  check('Anzeige „Blockiert von Piraten“', T.traderStatus(g, k1).includes('Blockiert von Piraten'), T.traderStatus(g, k1));
  const n0 = msgs.length;
  // das Piratenschiff bleibt liegen (sonst segelt es davon)
  const got = run(g, 420, () => { p.x = at[0]; p.y = at[1]; p.path = []; return msgs.slice(n0).some((m) => m.includes('blockiert von Piraten')); });
  check('Meldung „blockiert von …“, wenn der Händler fällig ist', got >= 0, msgs.slice(n0).join(' | ') + ' ' + T.traderStatus(g, k1));
  g.ships = g.ships.filter((s) => s !== p);
}

// ---------- Handelsroute ----------
const ship = g.ships.find((s) => s.owner === HUMAN)!;
{
  for (const sl of ship.slots) { sl.g = null; sl.n = 0; }
  l1.holz = 100; l2.holz = 0;
  T.setRoute(g, ship, { stops: [{ kontor: k1.id, laden: { holz: 80 }, entladen: {} }, { kontor: k2.id, laden: {}, entladen: { holz: 100 } }], on: false, next: 0 });
  const r = T.route(g, ship)!;
  check('Route gespeichert (2 Halte)', r.stops.length === 2 && T.routeCheck(g, ship).ok);
  T.setRoute(g, ship, { ...r, stops: [...r.stops, { kontor: k1.id, laden: { holz: 500 }, entladen: {} }, { kontor: k2.id, laden: {}, entladen: {} }, { kontor: k1.id, laden: {}, entladen: {} }] });
  check('höchstens 4 Halte, höchstens 100 t je Ware', T.route(g, ship)!.stops.length === 4 && T.route(g, ship)!.stops[2].laden.holz === 100);
  T.setRoute(g, ship, { ...r });
  check('Route starten', T.startRoute(g, ship).ok && T.route(g, ship)!.on);
  const t = run(g, 400, () => l2.holz > 0);
  check('Schiff bringt Holz allein von Kontor 1 zu Kontor 2', t > 0 && l2.holz >= 50, `${t} s, Kontor 2: ${Math.floor(l2.holz)} t, Kontor 1: ${Math.floor(l1.holz)} t`);
  // volles Ziel: Meldung „Route blockiert“
  const cap2 = g.capOf(HUMAN, k2.island);
  l1.holz = 100;
  const n0 = msgs.length;
  const t2 = run(g, 400, () => { l2.holz = cap2; return msgs.slice(n0).some((m) => m.includes('Route blockiert')); });
  check('volles Ziel: Meldung „Route blockiert“', t2 >= 0, msgs.slice(n0).find((m) => m.includes('Route')) ?? '');
  check('Grund steht an der Route', !!T.route(g, ship)!.blocked, T.route(g, ship)!.blocked ?? '');
  l2.holz = 0;
  // Pause und Weiter
  run(g, 40, () => ship.path.length > 0);
  T.pauseRoute(g, ship);
  check('Pause hält das Schiff an', !T.route(g, ship)!.on && ship.path.length === 0);
  check('Weiter', T.startRoute(g, ship).ok);
  run(g, 10, () => ship.path.length > 0);
  // Spieler lenkt selbst: Route pausiert
  if (!ship.path.length) run(g, 60, () => ship.path.length > 0);
  const n1 = msgs.length;
  g.moveShip(ship, ship.x > g.size / 2 ? 3 : g.size - 4, ship.y);
  run(g, 1);
  check('selbst gelenkt: Route pausiert', !T.route(g, ship)!.on && msgs.slice(n1).some((m) => m.includes('pausiert')));
}

// ---------- Speichern und Laden ----------
{
  T.setOrder(g, k1, { g: 'werkzeug', buy: true, limit: 25, price: 80 });
  const json = JSON.parse(JSON.stringify(g.serialize()));
  check('Spielstand enthält den Handel (ext.trade)', !!json.ext?.trade && json.ext.trade.v === 1);
  const h = Game.fromSave(json);
  const hk = h.byId.get(k1.id)!;
  const hs = h.ships.find((s) => s.id === ship.id)!;
  check('Aufträge nach dem Laden', T.orders(h, hk).some((o) => o.g === 'werkzeug' && o.limit === 25 && o.price === 80));
  check('Route nach dem Laden', T.route(h, hs)?.stops.length === 2);
  check('Händler nach dem Laden', !!T.trader(h) && T.active(h) && T.notFaktor(h) === 1.4);
  run(h, 5);
  delete json.ext.trade;
  const old = Game.fromSave(json);
  check('alter Stand ohne Handel lädt (leer)', T.orders(old, old.byId.get(k1.id)!).length === 0 && T.route(old, old.ships.find((s) => s.id === ship.id)!) === null);
  run(old, 5);
  check('alter Stand: Händler fährt wieder', T.active(old));
}

// ---------- Abwracken ----------
{
  T.setRoute(g, ship, null);
  const at = T.dockAt(g, k1)!;
  ship.x = at[0]; ship.y = at[1]; ship.path = [];
  g.shipAdd(ship, 'holz', 10);
  check('mit Ladung: kein Abwracken', !T.canScrap(g, ship).ok && T.canScrap(g, ship).reason === 'Erst die Ladung ausladen');
  for (const sl of ship.slots) { sl.g = null; sl.n = 0; }
  l1.holz = 0; l1.stoff = 0;
  const n = g.ships.length;
  const res = T.scrap(g, ship);
  const c = SHIPS[ship.type ?? 'handel_klein'].cost;
  check('Abwracken am Kontor: Hälfte von Holz und Stoffen', res.ok && g.ships.length === n - 1 && l1.holz === Math.floor(c.holz / 2) && l1.stoff === Math.floor(c.stoff / 2), `${l1.holz} Holz, ${l1.stoff} Stoffe`);
}

console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden');
process.exit(fails ? 1 : 0);
