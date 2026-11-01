// Statistik-Test ohne Browser (Paket S1): Kassenbuch, Warenfluss, Bevölkerung, Verläufe, Vergleich, Warnungen.
// Erwartung: Das Kassenbuch stimmt immer mit dem Kontostand überein, die Zahlen passen zu den Spielwerten,
// Warnungen kommen mit ⚠️ und Ort und wiederholen sich je Ware und Insel höchstens alle 5 Minuten,
// und alles übersteht Speichern und Laden.
// Ausführen im Projektordner:
//   npx esbuild scripts/statistik-test.ts --bundle --platform=node --outfile=/tmp/statistik-test.cjs && node /tmp/statistik-test.cjs
// Beendet sich mit Fehlercode 1, wenn eine Prüfung fehlschlägt.
const g0 = globalThis as unknown as Record<string, unknown>;
g0.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
import { Game, HUMAN, type Building, type MsgAt } from '../src/game';
import { BUILDINGS, TIERS, type BuildingId } from '../src/data';
import * as stats from '../src/stats';

let fails = 0;
const check = (name: string, cond: boolean, info = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK    ' : 'FEHLER'} ${name}${info ? ' – ' + info : ''}`);
};
const near = (a: number, b: number, tol = 0.5) => Math.abs(a - b) <= tol;
const sumRows = (rows: stats.LedgerRow[]) => rows.reduce((s, r) => s + stats.rowSum(r), 0);

/** freien Platz für ein Gebäude auf der Insel suchen (nahe beim Punkt), mit placeNeutral setzen */
function put(g: Game, type: BuildingId, isl: number, cx: number, cy: number, owner = HUMAN, ownOnly = false): Building {
  const s = BUILDINGS[type].size;
  const cands: [number, number, number][] = [];
  for (let y = Math.floor(cy) - 14; y <= cy + 14; y++) for (let x = Math.floor(cx) - 14; x <= cx + 14; x++) cands.push([x, y, Math.hypot(x - cx, y - cy)]);
  cands.sort((a, b) => a[2] - b[2]);
  for (const [x, y] of cands) {
    if (!g.inMap(x, y) || g.islandOf[g.idx(x, y)] !== isl) continue;
    if (ownOnly) {
      let ok = true;
      for (let j = 0; j < s && ok; j++) for (let i = 0; i < s; i++) if (!g.inMap(x + i, y + j) || g.own[g.idx(x + i, y + j)] !== owner) { ok = false; break; }
      if (!ok) continue;
    }
    const b = g.placeNeutral(type, x, y, owner);
    if (b) return b;
  }
  throw new Error(`kein Platz für ${type}`);
}

// ---------- Aufbau: Spieler mit Kontor, Häusern und einer Fleischerei ----------
const g = Game.create(4711, 2);
g.quest = 1e9; // keine Aufgaben-Belohnungen (die landeten sonst in „Sonstiges“)
const msgs: { text: string; kind?: string; at?: MsgAt; t: number }[] = [];
g.ev.message = (text, kind, at) => { msgs.push({ text, kind, at, t: g.time }); };
const coast = g.homeCoast()!;
const isl = g.islandOf[g.idx(coast[0], coast[1])];
const kontor = put(g, 'kontor', isl, coast[0], coast[1]);
check('Aufbau: Kontor steht', kontor.island === isl);
const [kx, ky] = g.center(kontor);
const houses: Building[] = [];
for (let i = 0; i < 6; i++) houses.push(put(g, 'haus', isl, kx + 6, ky, HUMAN, true));
houses.forEach((h, i) => { h.tier = i < 4 ? 0 : 1; h.residents = TIERS[h.tier].maxResidents; h.happy = 1; });
const markt = put(g, 'markt', isl, kx - 6, ky, HUMAN, true);
check('Aufbau: Marktplatz steht', !!markt);
const fl = put(g, 'fleischerei', isl, kx, ky + 7, HUMAN, true);
const l = g.lagerOf(HUMAN, isl)!;
l.nahrung = 30; l.schweine = 20; l.holz = 20; l.werkzeug = 10;
g.recompute();

// ---------- Warenfluss ----------
fl.eff = 1; fl.active = 1;
{
  const f = stats.flows(g, HUMAN, isl);
  const people = houses.reduce((s, h) => s + h.residents * (TIERS[h.tier].consumes.nahrung ?? 0), 0);
  check('Warenfluss: Fleischerei erzeugt 12 Nahrung je Minute', near(f.nahrung?.prod ?? 0, 12, 0.01), `${f.nahrung?.prod}`);
  check('Warenfluss: Fleischerei verbraucht 6 Schweine je Minute', near(f.schweine?.use ?? 0, 6, 0.01), `${f.schweine?.use}`);
  check('Warenfluss: Bewohner essen', near(f.nahrung?.people ?? 0, people, 0.01) && near(f.nahrung?.use ?? 0, people, 0.01), `${f.nahrung?.people} / ${people}`);
  check('Warenfluss: Saldo = Erzeugung − Verbrauch', near(f.nahrung!.net, 12 - people, 0.01));
  check('Warenfluss: Schweine reichen noch 20/6 Minuten', near(f.schweine?.minutes ?? -1, 20 / 6, 0.01), `${f.schweine?.minutes}`);
  check('Warenfluss: Nahrung wächst → keine Minutenangabe', f.nahrung!.minutes === null);
  const all = stats.flows(g, HUMAN, -1);
  check('Warenfluss: alle Inseln zusammen', near(all.nahrung?.prod ?? 0, 12, 0.01) && all.nahrung?.stock === 30);
  // Bestand frisch, auch wenn die Zeit steht (z. B. Verkauf in der Pause)
  l.schweine = 3;
  check('Warenfluss: Lagerbestand frisch ohne Zeitschritt', stats.flows(g, HUMAN, isl).schweine?.stock === 3);
  l.schweine = 20;
  fl.active = 0.5;
  g.time += 0.001; // neue Spielzeit → neu rechnen
  check('Warenfluss: halbe Auslastung = halbe Erzeugung', near(stats.flows(g, HUMAN, isl).nahrung?.prod ?? 0, 6, 0.01));
}

// ---------- Bevölkerung ----------
{
  houses[0].short = { nahrung: true }; houses[1].short = { nahrung: true };
  const p = stats.popSummary(g, HUMAN, isl);
  check('Bevölkerung: 4 Pionierhäuser, 2 Siedlerhäuser', p.tiers[0].houses === 4 && p.tiers[1].houses === 2);
  check('Bevölkerung: Bewohner und Platz', p.tiers[0].residents === 12 && p.tiers[0].max === 12 && p.tiers[1].residents === 14);
  check('Bevölkerung: „Es fehlt“ Nahrung bei 2 Häusern', p.tiers[0].missing.some((m) => m.what === 'Nahrung' && m.houses === 2), JSON.stringify(p.tiers[0].missing));
  check('Bevölkerung: Pioniere voll und zufrieden = aufstiegsbereit', p.tiers[0].ready === 4);
  check('Bevölkerung: Grund, warum sie nicht aufsteigen', p.tiers[0].blocked.length > 0, JSON.stringify(p.tiers[0].blocked));
  const byTier = stats.popByTier(g, HUMAN, isl);
  check('popByTier je Insel', byTier[0] === 12 && byTier[1] === 14 && stats.popByTier(g, HUMAN, isl + 1000).every((n) => n === 0));
  houses[0].short = {}; houses[1].short = {};
}

// ---------- Kassenbuch ----------
const money0 = new Map<number, number>();
g.tick(0.25);
for (const p of g.players) money0.set(p.id, p.money);
g.money += 500; stats.book(g, HUMAN, 'handel', 500);
g.money -= 120; stats.book(g, HUMAN, 'handel', -120);
g.money -= 77; // ungebucht (z. B. Bauen) → Sonstiges
const start = g.time;
let tickMs = 0;
while (g.time < start + 185) {
  const t0 = performance.now();
  g.tick(0.25);
  tickMs += performance.now() - t0;
}
{
  const rows = stats.ledger(g, HUMAN);
  check('Kassenbuch: 3 abgeschlossene Minuten', rows.length >= 3, `${rows.length}`);
  for (const p of g.players.filter((q) => !q.pirate && !q.trader && !q.natives)) {
    const total = sumRows(stats.ledger(g, p.id)) + stats.rowSum(stats.current(g, p.id));
    const real = p.money - money0.get(p.id)!;
    check(`Kassenbuch stimmt mit der Kasse überein (${p.name})`, near(total, real, 0.1), `Buch ${total.toFixed(2)} / Kasse ${real.toFixed(2)}`);
  }
  const all = [...rows, stats.current(g, HUMAN)];
  const ein = all.reduce((s, r) => s + r.handelEin, 0), aus = all.reduce((s, r) => s + r.handelAus, 0);
  check('Kassenbuch: Handel ein 500, aus −120', near(ein, 500) && near(aus, -120), `${ein} / ${aus}`);
  const r1 = rows[0];
  check('Kassenbuch: Ungebuchtes landet in „Sonstiges“', near(r1.sonstiges, -77, 0.5), `${r1.sonstiges}`);
  const r2 = rows[1];
  check('Kassenbuch: Steuern von Pionieren und Siedlern', r2.steuern[0] > 0 && r2.steuern[1] > 0, r2.steuern.join(' / '));
  check('Kassenbuch: Unterhalt Betriebe und Dienste (negativ)', r2.betriebe < 0 && r2.dienste < 0, `${r2.betriebe} / ${r2.dienste}`);
  const rate = stats.rates(g, HUMAN);
  const inc = g.incomePerMinute(HUMAN);
  check('Augenblickswerte: Summen wie im Spiel', near(rate.steuern.reduce((a, b) => a + b, 0), inc.tax, 0.01) && near(rate.betriebe + rate.dienste + rate.militaer, -inc.upkeep, 0.01));
  check('Kassenbuch: Spielminuten aufsteigend', rows.every((r, i) => i === 0 || r.t === rows[i - 1].t + 1));
}

// ---------- Verläufe ----------
{
  const e = stats.trend(g, 'einwohner');
  const m = stats.trend(g, 'geld');
  const b = stats.trend(g, 'bilanz');
  const n = stats.ledger(g, HUMAN).length;
  check('Verlauf: ein Messpunkt je Minute', e.length === n && m.length === n && b.length === n && stats.trendTimes(g).length === n, `${e.length}/${n}`);
  check('Verlauf: Bilanz = Summe der Kassenbuch-Zeile', b.every((v, i) => near(v, stats.rowSum(stats.ledger(g, HUMAN)[i]), 0.2)));
  check('Verlauf: Einwohner der Insel', stats.trend(g, 'einwohner', HUMAN, isl).length === n && e[n - 1] > 0);
  check('Verlauf: Ware je Insel', stats.trend(g, 'schweine', HUMAN, isl).length === n);
  check('Verlauf: Gegner haben keine Waren-Verläufe', stats.trend(g, 'holz', 1).length === 0 && stats.trend(g, 'geld', 1).length === n);
}

// ---------- Warnungen ----------
{
  msgs.length = 0;
  houses.forEach((h) => { h.residents = TIERS[h.tier].maxResidents; h.happy = 1; });
  fl.active = 0; fl.eff = 0;
  l.nahrung = 1.5; // reicht nicht mal eine Minute
  l.schweine = 0;
  for (let i = 0; i < 24; i++) g.tick(0.25);
  const food = msgs.find((m) => /Nahrung/.test(m.text));
  check('Warnung: Nahrung wird knapp/fehlt', !!food, food?.text ?? msgs.map((m) => m.text).join(' | '));
  check('Warnung: mit ⚠️, Art „bad“ und Ort', !!food && food.text.startsWith('⚠️') && food.kind === 'bad' && !!food.at);
  check('Warnung: mit Hinweis, wer Nahrung liefert', !!food && /Mehr liefert:/.test(food.text), food?.text);
  const before = msgs.filter((m) => /Nahrung/.test(m.text)).length;
  for (let i = 0; i < 4 * 60; i++) { l.nahrung = Math.min(l.nahrung, 1.5); g.tick(0.25); }
  check('Warnung: dieselbe nicht vor 5 Minuten wiederholt', msgs.filter((m) => /Nahrung/.test(m.text)).length === before);
  // Bewohner ziehen weg
  msgs.length = 0;
  houses[2].short = { nahrung: true };
  houses[2].residents = 1;
  houses[3].short = { nahrung: true };
  houses[3].residents = 1;
  for (let i = 0; i < 24; i++) g.tick(0.25);
  const weg = msgs.find((m) => /ziehen Bewohner weg/.test(m.text));
  check('Warnung: Bewohner ziehen weg, mit Grund', !!weg && /Nahrung/.test(weg.text) && !!weg.at, weg?.text ?? msgs.map((m) => m.text).join(' | '));
  // Lager voll
  msgs.length = 0;
  fl.eff = 1; fl.active = 1;
  l.schweine = 50;
  l.nahrung = g.capOf(HUMAN, isl);
  houses.forEach((h) => { h.residents = 1; });
  g.time += 0.01;
  const pr = stats.problems(g);
  const voll = pr.find((p) => p.key === `voll:nahrung:${isl}`);
  check('Warnung: Lager voll mit Zahl', !!voll && voll.text.includes(`Nahrung ${g.capOf(HUMAN, isl)}/${g.capOf(HUMAN, isl)}`) && !!voll.at, voll?.text);
  // Kasse im Minus
  const keep = g.money;
  g.money = -50;
  const k = stats.problems(g).find((p) => p.key === 'kasse');
  check('Warnung: Kasse im Minus', !!k && /Kasse im Minus/.test(k.text), k?.text);
  g.money = keep;
  // Mehrzahl richtig
  l.stoff = 0;
  const siedler = houses.filter((h) => h.tier === 1);
  siedler.forEach((h) => { h.residents = 7; h.short = { stoff: true }; });
  g.time += 0.01;
  const st = stats.problems(g).find((p) => p.key === `stoff:${isl}`);
  check('Warnung: Mehrzahl („fehlen Stoffe“)', !!st && /fehlen Stoffe/.test(st.text), st?.text);
}

// ---------- höchstens zwei Warnungen je Prüfung ----------
{
  msgs.length = 0;
  houses.forEach((h) => { h.residents = TIERS[h.tier].maxResidents; h.short = { nahrung: true, stoff: true, alkohol: true }; });
  l.nahrung = 0; l.stoff = 0; l.alkohol = 0;
  g.money = -10;
  g.time += 400; // alte Sperrzeiten vorbei
  const before = msgs.length;
  for (let i = 0; i < 21; i++) g.tick(0.25);
  const first = msgs.length - before;
  for (let i = 0; i < 20; i++) g.tick(0.25);
  check('Warnungen: höchstens 2 je Prüfung, der Rest 5 s später', first === 2 && msgs.length - before > 2, `${first} dann ${msgs.length - before}`);
  const alk = msgs.find((m) => /Alkohol/.test(m.text));
  if (alk) check('Warnung ohne freigeschalteten Betrieb: Hinweis aufs Kontor', /Nachkaufen geht am Kontor/.test(alk.text), alk.text);
  g.money = 5000;
  houses.forEach((h) => { h.short = {}; });
}

// ---------- Vergleich ----------
{
  let r = stats.rivals(g);
  check('Vergleich: du stehst drin', r.some((x) => x.you && x.einwohner > 0));
  const hidden = g.players.filter((p) => p.ai && !p.pirate).every((p) => !r.some((x) => x.id === p.id) || g.buildings.some((b) => b.owner === p.id && g.seen[g.idx(b.x, b.y)]) || g.ships.some((s) => s.owner === p.id && g.seen[g.idx(Math.floor(s.x), Math.floor(s.y))]));
  check('Vergleich: unentdeckte Gegner fehlen', hidden);
  // Gegner sichtbar machen
  const foe = g.players.find((p) => p.ai)!;
  const ship = g.ships.find((s) => s.owner === foe.id);
  if (ship) g.seen[g.idx(Math.floor(ship.x), Math.floor(ship.y))] = 1;
  r = stats.rivals(g);
  const row = r.find((x) => x.id === foe.id);
  check('Vergleich: entdeckter Gegner mit Kasse, Vermögen, Stärke', !!row && row.kasse === Math.round(foe.money) && row.vermoegen >= row.kasse && row.staerke >= 0, JSON.stringify(row));
  if (ship) g.seen[g.idx(Math.floor(ship.x), Math.floor(ship.y))] = 0;
  check('Vergleich: einmal entdeckt bleibt entdeckt', stats.rivals(g).some((x) => x.id === foe.id));
}

// ---------- Speichern und Laden ----------
{
  const d = JSON.parse(JSON.stringify(g.serialize()));
  check('Spielstand: Statistik unter ext.stats', !!d.ext?.stats);
  const h = Game.fromSave(d);
  check('Spielstand: Kassenbuch bleibt', JSON.stringify(stats.ledger(h, HUMAN)) === JSON.stringify(stats.ledger(g, HUMAN)));
  check('Spielstand: Verläufe bleiben', JSON.stringify(stats.trend(h, 'einwohner')) === JSON.stringify(stats.trend(g, 'einwohner')));
  check('Spielstand: entdeckte Gegner bleiben', stats.rivals(h).length === stats.rivals(g).length);
  const hm: string[] = [];
  h.ev.message = (t) => { hm.push(t); };
  for (let i = 0; i < 24; i++) h.tick(0.25);
  check('Spielstand: nach dem Laden keine „ziehen weg“-Meldung ohne Grund', !hm.some((t) => /ziehen Bewohner weg/.test(t)), hm.join(' | '));
  // alter Stand ohne Statistik
  delete d.ext.stats;
  const old = Game.fromSave(d);
  check('Spielstand: alter Stand ohne Statistik beginnt leer', stats.ledger(old, HUMAN).length === 0 && stats.trend(old, 'geld').length === 0);
  old.tick(0.25); old.tick(0.25);
  check('Spielstand: alter Stand läuft weiter', stats.rowSum(stats.current(old, HUMAN)) !== undefined);
  // kaputte Daten werden nicht übernommen
  const bad = JSON.parse(JSON.stringify(g.serialize()));
  bad.ext.stats = { v: 1, rows: { 0: [null, { t: 'x' }, 5, [1, 2]] }, pend: { 0: 'x' }, samples: 'nein', met: [null] };
  const b = Game.fromSave(bad);
  check('Spielstand: kaputte Statistik → leer statt Absturz', stats.ledger(b, HUMAN).length === 0 && stats.trend(b, 'geld').length === 0);
}

// ---------- höchstens 120 Messpunkte ----------
{
  const s2 = Game.create(99, 0);
  s2.ev.message = () => {};
  for (let i = 0; i < 130; i++) { s2.time += 60; s2.tick(0.25); }
  check('Verlauf: höchstens 120 Messpunkte und Zeilen', stats.trend(s2, 'geld').length === 120 && stats.ledger(s2, HUMAN).length === 120,
    `${stats.trend(s2, 'geld').length}`);
}

// ---------- Rechenzeit ----------
{
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) { g.time += 0.001; stats.problems(g); }
  const per = (performance.now() - t0) / 200;
  check('Rechenzeit: Warnungs-Prüfung unter 2 ms', per < 2, `${per.toFixed(3)} ms`);
  console.log(`       (Spiel-Rechenschritt im Mittel ${(tickMs / (185 * 4)).toFixed(3)} ms mit Statistik)`);
}

console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden');
process.exit(fails ? 1 : 0);
