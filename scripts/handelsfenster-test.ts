// Test der Handels-Bedienung ohne Browser (Paket U5): Rechenhilfen der Regler (Raster, Anteil, Preisschritt),
// Farbbalken und ✓/✗ der Aufträge, Bearbeiten der Handelsrouten (Ware dazu mit automatischem Ausladen, ±10 t,
// Laden ⇄ Ausladen) – zusammen mit der echten Handels-Logik aus src/trade.ts.
// Ausführen im Projektordner:
//   npx esbuild scripts/handelsfenster-test.ts --bundle --platform=node --outfile=/tmp/handelsfenster-test.cjs && node /tmp/handelsfenster-test.cjs
// Beendet sich mit Fehlercode 1, wenn eine Prüfung fehlschlägt.
const g0 = globalThis as unknown as Record<string, unknown>;
g0.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
// ui/trade.ts lädt die Klänge (brauchen window/document): einfache Platzhalter, dann erst laden (siehe main)
g0.window = { addEventListener() {} };
g0.document = { addEventListener() {}, hidden: true };
import { PRICES } from '../src/data';
import { Game, HUMAN } from '../src/game';
import * as T from '../src/trade';
type UT = typeof import('../src/ui/trade');

async function main() {
const { addRouteGood, flipRouteGood, frac, orderState, priceBand, priceStep, snap, stepRouteGood }: UT = await import('../src/ui/trade');
let fails = 0;
const check = (name: string, cond: boolean, info = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK    ' : 'FEHLER'} ${name}${info ? ' – ' + info : ''}`);
};

// ---------- Regler ----------
check('Raster: 37 → 35 (5er-Schritte)', snap(37, 0, 200, 5) === 35);
check('Raster: 38 → 40', snap(38, 0, 200, 5) === 40);
check('Raster: Grenzen', snap(-20, 0, 200, 5) === 0 && snap(999, 0, 200, 5) === 200);
check('Raster: Preis ganzzahlig zwischen lo und hi', snap(63.4, 63, 94, 1) === 63 && snap(93.6, 63, 94, 1) === 94);
check('Raster: leerer Bereich bleibt bei lo', snap(10, 30, 30, 5) === 30);
check('Anteil', frac(50, 0, 200) === 0.25 && frac(-5, 0, 200) === 0 && frac(300, 0, 200) === 1 && frac(3, 3, 3) === 0);
check('Preisschritt: 5 % von 90 = 5 (gerundet), mindestens 1', priceStep('werkzeug', true) === Math.round((PRICES.werkzeug?.kaufen ?? 0) * 0.05) && priceStep('holz', true) >= 1);

// ---------- Farbbalken und Lage der Aufträge ----------
{
  const [lo, hi] = T.priceRange('werkzeug', true);
  const o = { g: 'werkzeug' as const, buy: true, limit: 40, price: hi };
  const mid = Math.round((lo + hi) / 2);
  const b = priceBand(o, { kaufen: mid, verkaufen: 50 });
  check('Farbbalken Kaufen: Grenze in der Mitte', Math.abs(b.at - (mid - lo) / (hi - lo)) < 1e-9, b.at.toFixed(3));
  check('Farbbalken Kaufen: links rot, rechts grün', b.css.indexOf('#b5493a') < b.css.indexOf('#5f9a3e'));
  const s = priceBand({ ...o, buy: false }, { kaufen: 99, verkaufen: mid });
  check('Farbbalken Verkaufen: links grün, rechts rot', s.css.indexOf('#5f9a3e') < s.css.indexOf('#b5493a'));
  check('Farbbalken ohne Markt: keine Grenze', priceBand(o, null).at === -1);

  const mp = { kaufen: 80, verkaufen: 50 };
  const buyOk = orderState({ g: 'werkzeug', buy: true, limit: 40, price: 85 }, 10, mp, true);
  check('Kaufauftrag: Preis über der Grenze → ✓, Lager unter Schwelle → läuft', buyOk.ok && !buyOk.idle && buyOk.hint.startsWith('✓'));
  const buyLow = orderState({ g: 'werkzeug', buy: true, limit: 40, price: 70 }, 10, mp, true);
  check('Kaufauftrag: zu wenig geboten → ✗ mit Grenze im Text', !buyLow.ok && buyLow.hint.includes('80'));
  const buyFull = orderState({ g: 'werkzeug', buy: true, limit: 40, price: 85 }, 45, mp, true);
  check('Kaufauftrag: Lager schon voller als die Schwelle → nichts zu tun', buyFull.ok && buyFull.idle);
  const buyNone = orderState({ g: 'werkzeug', buy: true, limit: 40, price: 85 }, 0, mp, false);
  check('Kaufauftrag: Händler hat die Ware nicht → ✗', !buyNone.ok && buyNone.hint.includes('noch nicht'));
  const sellOk = orderState({ g: 'werkzeug', buy: false, limit: 20, price: 45 }, 60, mp, true);
  check('Verkaufsauftrag: Preis unter der Grenze → ✓', sellOk.ok && !sellOk.idle);
  const sellHigh = orderState({ g: 'werkzeug', buy: false, limit: 20, price: 55 }, 60, mp, true);
  check('Verkaufsauftrag: zu teuer → ✗ mit Grenze im Text', !sellHigh.ok && sellHigh.hint.includes('50'));
  const sellIdle = orderState({ g: 'werkzeug', buy: false, limit: 20, price: 45 }, 12, mp, true);
  check('Verkaufsauftrag: Lager unter der Schwelle → nichts zu tun', sellIdle.idle);
}

// ---------- Mit der echten Logik: Standardaufträge stimmen mit dem Markt überein ----------
{
  const g = Game.create(11, 1);
  g.ev.message = () => {};
  for (let i = 0; i < 40; i++) g.tick(0.25);
  const sell = T.defaultOrder('holz', false);
  const mp = T.marketPrice(g, 'holz');
  // Standard-Verkauf zu 70 %: der Händler nimmt ihn (fast) immer an
  check('Standard-Verkaufsauftrag passt zum Markt', !!mp && orderState(sell, 100, mp, true).ok, `Preis ${sell.price}, Händler bis ${mp?.verkaufen}`);
  const [lo, hi] = T.priceRange('holz', false);
  check('Preis-Regler: Standardpreis liegt im Bereich', sell.price >= lo && sell.price <= hi);
  check('Spieler HUMAN ist 0', HUMAN === 0);
}

// ---------- Routen bearbeiten ----------
{
  const mk = (): T.TradeRoute => ({ stops: [{ kontor: 1, laden: {}, entladen: {} }, { kontor: 2, laden: {}, entladen: {} }, { kontor: 3, laden: {}, entladen: {} }], on: false, next: 0 });
  const r = mk();
  const auto = addRouteGood(r, 0, 'laden', 'holz');
  check('Ware laden: 50 t am Halt 1', r.stops[0].laden.holz === 50);
  check('… und automatisch am nächsten Halt ausladen (100 t)', auto === 1 && r.stops[1].entladen.holz === 100);
  const auto2 = addRouteGood(r, 2, 'laden', 'holz');
  check('Zweites Laden: kein weiteres automatisches Ausladen (wird schon ausgeladen)', auto2 === -1 && !r.stops[0].entladen.holz);
  const auto3 = addRouteGood(r, 2, 'laden', 'stein');
  check('Letzter Halt lädt → Ausladen am ersten Halt (Rundfahrt)', auto3 === 0 && r.stops[0].entladen.stein === 100);
  stepRouteGood(r, 0, 'laden', 'holz', 1);
  check('+10 t', r.stops[0].laden.holz === 60);
  for (let i = 0; i < 10; i++) stepRouteGood(r, 0, 'laden', 'holz', 1);
  check('höchstens 100 t', r.stops[0].laden.holz === T.ROUTE_MAX);
  for (let i = 0; i < 12; i++) stepRouteGood(r, 0, 'laden', 'holz', -1);
  check('bei 0 t ist die Ware weg', r.stops[0].laden.holz === undefined);
  addRouteGood(r, 1, 'entladen', 'werkzeug');
  flipRouteGood(r, 1, 'entladen', 'werkzeug');
  check('Ausladen → Laden umschalten', r.stops[1].laden.werkzeug === 100 && r.stops[1].entladen.werkzeug === undefined);
  addRouteGood(r, 1, 'entladen', 'werkzeug');
  check('Ware am selben Halt nie zugleich laden und ausladen', r.stops[1].entladen.werkzeug === 100 && r.stops[1].laden.werkzeug === undefined);
  const same: T.TradeRoute = { stops: [{ kontor: 5, laden: {}, entladen: {} }, { kontor: 5, laden: {}, entladen: {} }], on: false, next: 0 };
  check('Nächster Halt am selben Kontor: kein automatisches Ausladen', addRouteGood(same, 0, 'laden', 'holz') === -1);
  const one: T.TradeRoute = { stops: [{ kontor: 5, laden: {}, entladen: {} }], on: false, next: 0 };
  check('Nur ein Halt: kein automatisches Ausladen', addRouteGood(one, 0, 'laden', 'holz') === -1 && one.stops[0].laden.holz === 50);
}

console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden');
if (fails) process.exit(1);
}
void main();
