// Wirtschafts-Simulation (Paket L2): Stimmen die Verhältnisse wie im Vorbild 1602?
//
// 1. Einwohner je Betrieb: Wie viele Bewohner versorgt ein Betrieb (bzw. die Kette) – verglichen mit dem
//    Original (docs/1602-INHALT.md, „Max. Einw.“). Ziel nach der Entscheidung des Nutzers: 60–100 %.
// 2. Kosten der Warenketten je Bewohner und Minute im Verhältnis zur Steuer (Standardsatz) – im Original
//    26–45 % ab den Bürgern. Ziel: Aristokraten 26–45 %.
// 3. Gewinn je Bewohner und Stufe vorher (Stand vor L2) und nachher: Das Spiel soll nicht schwerer werden.
// 4. Eine Aristokratenstadt mit 1 000 Bewohnern, gerechnet mit den Formeln des Spiels (incomePerMinute):
//    Steuern, Unterhalt der Ketten, Dienste und Lager – Ziel: Gewinn wie im Original etwa ein Drittel (25–45 %)
//    und nicht weniger als vor L2 (das Spiel soll nicht schwerer werden).
// 5. Praxis im laufenden Spiel: zwei Schaffarmen und eine Weberei mit Marktkarren – schaffen die Karren die
//    schnellere Herstellung? Ziel: mindestens 60 % der rechnerischen Leistung kommen im Lager an.
//
// Ausführen im Projektordner:
//   npx esbuild scripts/wirtschaft-sim.ts --bundle --platform=node --outfile=/tmp/wirtschaft-sim.cjs && node /tmp/wirtschaft-sim.cjs
// Beendet sich mit Fehlercode 1, wenn ein Ziel verfehlt wird.
const g0 = globalThis as unknown as Record<string, unknown>;
g0.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
import { BUILDINGS, BuildingId, GOODS, GoodId, TIERS } from '../src/data';
import { Building, Game, HUMAN } from '../src/game';
import { T } from '../src/world';

declare const process: { exitCode?: number };

let fails = 0;
const ziel = (name: string, cond: boolean, info = '') => {
  if (!cond) fails++;
  console.log(`  ${cond ? '✓' : '✗'} ${name}${info ? ' – ' + info : ''}`);
};
const pct = (v: number) => `${Math.round(v * 100)} %`;
const pad = (s: string | number, n: number) => String(s).padEnd(n);

/** Leistung eines Betriebs in Tonnen je Minute bei voller Arbeit */
const rate = (id: BuildingId) => { const p = BUILDINGS[id].prod!; return (60 / p.time) * (p.amount ?? 1); };
const up = (id: BuildingId) => BUILDINGS[id].upkeep;
/** höchster Verbrauch einer Ware je Bewohner und Minute (über alle Stufen) */
const maxUse = (g: GoodId) => Math.max(...TIERS.map((t) => t.consumes[g] ?? 0));

// ---------- 1. Einwohner je Betrieb ----------
console.log('\n1. Einwohner je Betrieb (bzw. Kette) im Vergleich mit dem Original');
// Original: Max. Einw. aus docs/1602-INHALT.md §4; bei Ketten zählt der letzte Betrieb
const ORIG: [BuildingId, GoodId, number, string][] = [
  ['fischer', 'nahrung', 63, 'Fischerhütte'],
  ['jagdhuette', 'nahrung', 168, 'Jagdhütte'],
  ['fleischerei', 'nahrung', 193, 'Schweinezucht → Fleischerei'],
  ['baeckerei', 'nahrung', 252, 'Getreide → Mühle → Bäckerei'],
  ['weberei', 'stoff', 283, 'Schaffarmen → Weberei'],
  ['schneiderei', 'kleidung', 457, 'Schneiderei'],
  ['weingut', 'alkohol', 167, 'Weingut'],
  ['rumbrennerei', 'alkohol', 334, 'Zuckerrohr → Rumbrennerei'],
  ['tabakwaren', 'tabakwaren', 337, 'Tabak → Tabakwaren'],
  ['gewuerzplantage', 'gewuerze', 248, 'Gewürzplantage'],
  ['kakaoplantage', 'kakao', 248, 'Kakaoplantage'],
  ['goldschmied', 'schmuck', 1000, 'Goldmine → Goldschmied'],
];
console.log(`  ${pad('Kette', 30)}${pad('Neue Ufer', 11)}${pad('Original', 10)}Anteil`);
let outside = 0;
for (const [id, g, orig, name] of ORIG) {
  const ew = rate(id) / maxUse(g);
  const share = ew / orig;
  if (share < 0.6 || share > 1.0001) outside++;
  console.log(`  ${pad(name, 30)}${pad(Math.round(ew), 11)}${pad(orig, 10)}${pct(share)}${share < 0.6 || share > 1.0001 ? '  ← außerhalb 60–100 %' : ''}`);
}
// Rohstoffbetriebe passen zu ihren Werkstätten wie im Original (z. B. 2 Schaffarmen je Weberei)
const PAIRS: [BuildingId, BuildingId, number, number][] = [
  ['schaffarm', 'weberei', 2, 2], ['baumwollplantage', 'weberei', 2, 2], ['zuckerrohrplantage', 'rumbrennerei', 2, 2], ['tabakplantage', 'tabakwaren', 2, 2], ['goldmine', 'goldschmied', 0.5, 1],
];
console.log(`  Rohstoffbetriebe je Werkstatt (Original in Klammern):`);
for (const [raw, proc, inPerOut, orig] of PAIRS) {
  const need = (rate(proc) / (BUILDINGS[proc].prod!.amount ?? 1)) * (BUILDINGS[proc].prod!.input![Object.keys(BUILDINGS[proc].prod!.input!)[0] as GoodId] ?? inPerOut) / rate(raw);
  console.log(`    ${pad(BUILDINGS[raw].name, 20)} je ${pad(BUILDINGS[proc].name, 14)} ${need.toFixed(1)} (${orig})`);
}
ziel('jeder Betrieb versorgt 60–100 % der Bewohner des Originals', outside === 0, `${ORIG.length - outside} von ${ORIG.length}`);

// ---------- 2. Kosten der Ketten im Verhältnis zur Steuer ----------
console.log('\n2. Kosten der Warenketten je Bewohner und Minute im Verhältnis zur Steuer (Standardsatz)');
// Taler Unterhalt je Tonne Endprodukt über die ganze Kette (günstigste übliche Kette, wie im Original gerechnet)
const perT: Record<string, number> = {
  nahrung: up('fischer') / rate('fischer'),
  stoff: (up('schaffarm') * 2) / rate('schaffarm') + up('weberei') / rate('weberei'),
  alkohol: up('weingut') / rate('weingut'),
  tabakwaren: (up('tabakplantage') * 2) / rate('tabakplantage') + up('tabakwaren') / rate('tabakwaren'),
  gewuerze: up('gewuerzplantage') / rate('gewuerzplantage'),
  kakao: up('kakaoplantage') / rate('kakaoplantage'),
  schmuck: (up('goldmine') * 0.5) / rate('goldmine') + up('goldschmied') / rate('goldschmied'),
};
perT.kleidung = perT.stoff + up('schneiderei') / rate('schneiderei');
const chainCost = (t: number) => Object.entries(TIERS[t].consumes).reduce((a, [g, v]) => a + (v ?? 0) * perT[g], 0);
// Original: Kosten/Steuer je Bewohner (docs/ABGLEICH-1602.md, gerechnet aus 1602-INHALT)
const ORIG_RATIO = [0.04, 0.13, 0.26, 0.35, 0.38];
for (let t = 0; t < 5; t++) {
  const c = chainCost(t), tax = TIERS[t].tax;
  console.log(`  ${pad(TIERS[t].name, 13)} Kosten ${c.toFixed(2)} / Steuer ${tax.toFixed(2)} = ${pad(pct(c / tax), 6)} (Original ${pct(ORIG_RATIO[t])})`);
}
const ratioA = chainCost(4) / TIERS[4].tax;
ziel('Aristokraten: Kosten der Ketten 26–45 % der Steuer', ratioA >= 0.26 && ratioA <= 0.45, pct(ratioA));
const ratioB = chainCost(2) / TIERS[2].tax;
ziel('Bürger und Kaufleute ebenfalls 20–45 %', ratioB >= 0.2 && ratioB <= 0.45 && chainCost(3) / TIERS[3].tax <= 0.45, `${pct(ratioB)} / ${pct(chainCost(3) / TIERS[3].tax)}`);

// ---------- 3. Gewinn je Bewohner vorher/nachher ----------
console.log('\n3. Gewinn je Bewohner und Minute (Steuer minus Ketten) – vor L2 und jetzt');
// Stand vor L2: Steuer 1,0/1,8/2,8/4,2/6,0 je Bewohner, Kettenkosten aus dem damaligen Tempo (Abgleich, exp5)
const OLD_TAX = [1.0, 1.8, 2.8, 4.2, 6.0], OLD_COST = [0.1, 0.76, 2.05, 3.05, 3.35];
let notHarder = true;
for (let t = 0; t < 5; t++) {
  const before = OLD_TAX[t] - OLD_COST[t];
  const now = TIERS[t].tax - chainCost(t);
  const atMax = (TIERS[t].tax * TIERS[t].maxTax) / TIERS[t].taxStd - chainCost(t);
  if (atMax < before) notHarder = false;
  console.log(`  ${pad(TIERS[t].name, 13)} vorher ${before.toFixed(2)} · jetzt Standardsatz ${now.toFixed(2)} · beim Höchstsatz ${atMax.toFixed(2)}`);
}
ziel('keine Stufe bringt beim Höchstsatz weniger Gewinn als vorher', notHarder);
// eine typische Spätphase: 400 Siedler, 600 Bürger, 500 Kaufleute, 300 Aristokraten
const MIX = [0, 400, 600, 500, 300];
const sum = (f: (t: number) => number) => MIX.reduce((a, n, t) => a + n * f(t), 0);
const mixBefore = sum((t) => OLD_TAX[t] - OLD_COST[t]), mixNow = sum((t) => TIERS[t].tax - chainCost(t));
ziel('typische Spätphase (1 800 Bewohner gemischt) beim Standardsatz nicht ärmer', mixNow >= mixBefore, `${Math.round(mixBefore)} → ${Math.round(mixNow)} Taler/Min`);

// ---------- 4. Aristokratenstadt ----------
console.log('\n4. Aristokratenstadt mit 1 000 Bewohnern (Formeln des Spiels)');
{
  const g = Game.create(4242, 0);
  const add = (type: BuildingId, n: number, f?: (b: Building) => void) => {
    for (let i = 0; i < n; i++) {
      const b = { id: g.nextId++, type, x: 0, y: 0, owner: HUMAN, island: 0, progress: 0, loaded: false, eff: 1, status: 'ok', missing: [], active: 1,
        tier: 0, residents: 0, need: {}, demand: {}, short: {}, happy: 1, growT: 0, upT: 0, stock: 0 } as Building;
      f?.(b);
      g.buildings.push(b); g.byId.set(b.id, b);
    }
  };
  const POP = 1000, A = TIERS[4];
  add('haus', Math.ceil(POP / A.maxResidents), (b) => { b.tier = 4; b.residents = A.maxResidents; b.status = 'wohnen'; });
  // je Ware die Kette vom Endbetrieb rückwärts zu den Rohstoffen; Nahrung aus der Bäckerei-Kette (für eine
  // große Stadt reichen die Fischgründe nicht)
  const chains: [GoodId, BuildingId[]][] = [
    ['nahrung', ['baeckerei', 'muehle', 'getreidefarm']],
    ['alkohol', ['weingut']],
    ['gewuerze', ['gewuerzplantage']],
    ['kakao', ['kakaoplantage']],
    ['tabakwaren', ['tabakwaren', 'tabakplantage']],
    ['kleidung', ['schneiderei', 'weberei', 'schaffarm']],
    ['schmuck', ['goldschmied', 'goldmine']],
  ];
  const counts: string[] = [];
  for (const [good, list] of chains) {
    // Bedarf je Minute am Ende der Kette, dann Stufe für Stufe: wie viel Rohstoff braucht die Stufe davor
    let need = POP * (A.consumes[good] ?? 0);
    for (const type of list) {
      const p = BUILDINGS[type].prod!;
      const exact = need / rate(type);
      const whole = Math.ceil(exact - 1e-9);
      // vorsichtig gerechnet: auch angebrochene Betriebe zahlen den vollen Unterhalt
      add(type, whole);
      counts.push(`${whole} ${BUILDINGS[type].name}`);
      const inp = Object.values(p.input ?? {})[0] ?? 0;
      need = exact * (60 / p.time) * inp; // Rohstoff je Minute für die nächste Stufe
    }
  }
  const markets = Math.ceil(Math.ceil(POP / A.maxResidents) / 14);
  add('kontor', 1); add('markt', markets);
  for (const s of ['kirche', 'wirtshaus', 'badehaus', 'hochschule', 'theater'] as BuildingId[]) add(s, s === 'wirtshaus' ? 2 : 1);
  g.recompute();
  const inc = g.incomePerMinute();
  const cityGain = (inc.tax - inc.upkeep) / inc.tax;
  console.log(`  Betriebe: ${counts.join(', ')}; ${markets} Marktplätze, Kirche, 2 Wirtshäuser, Badehaus, Hochschule, Theater`);
  console.log(`  Steuern ${Math.round(inc.tax)} · Unterhalt ${Math.round(inc.upkeep)} · Gewinn ${Math.round(inc.tax - inc.upkeep)} Taler/Min (${pct(cityGain)})`);
  // vor L2: Steuer 6,0 je Aristokrat, Ketten 3,35 je Bewohner (gerechnet wie oben, damaliges Tempo), dieselben Dienste
  const services = inc.buildings - g.buildings.filter((b) => BUILDINGS[b.type].prod).reduce((a, b) => a + g.upkeepOf(b), 0);
  const oldGain = (POP * 6.0 - POP * 3.35 - services) / (POP * 6.0);
  console.log(`  vor L2 (gleiche Stadt): etwa ${pct(oldGain)} Gewinn · Original rechnerisch etwa ein Drittel`);
  ziel('Aristokratenstadt: Gewinn wie im Original etwa ein Drittel (25–45 %) und nicht weniger als vor L2', cityGain >= 0.25 && cityGain <= 0.45 && cityGain >= oldGain - 0.01, pct(cityGain));
}

// ---------- 5. Praxis: Schaffarmen → Weberei mit Marktkarren ----------
console.log('\n5. Praxis im Spiel: 2 Schaffarmen → Weberei, Waren holt der Marktkarren');
{
  const g = Game.create(4242, 0);
  g.money = 1e6; g.seen.fill(1);
  g.ev.message = () => {};
  const ship = g.myShips()[0];
  let k: Building | undefined;
  for (const isl of [...g.islands].filter((i) => i.land >= 1500).sort((a, b) => Math.hypot(a.cx - ship.x, a.cy - ship.y) - Math.hypot(b.cx - ship.x, b.cy - ship.y))) {
    let best: [number, number, number] | null = null;
    for (let y = isl.y0; y <= isl.y1; y++) for (let x = isl.x0; x <= isl.x1; x++) {
      if (!g.canPlace('kontor', x, y, 0, true).ok) continue;
      let n = 0;
      for (let j = -9; j <= 9; j++) for (let i = -9; i <= 9; i++) { const t = g.tile(x + 1 + i, y + 1 + j); if (t === T.Gras || t === T.Sand) n++; }
      if (!best || n > best[2]) best = [x, y, n];
    }
    if (!best) continue;
    for (const [rx, ry] of g.ring({ type: 'kontor', x: best[0], y: best[1] })) if (g.tiles[g.idx(rx, ry)] === T.Wasser) { ship.x = rx + 0.5; ship.y = ry + 0.5; break; }
    if (g.place('kontor', best[0], best[1]).ok) { k = g.kontor(); break; }
  }
  if (!k) { ziel('Platz für die Probe', false); } else {
    const l = g.lagerOf(HUMAN, k.island)!;
    for (const gd of GOODS) l[gd.id] = 40;
    l.wolle = 0; l.stoff = 0;
    const [kx, ky] = g.center(k);
    const put = (type: BuildingId, dmin: number, dmax: number, best: (x: number, y: number) => number) => {
      g.unlocked.add(type);
      let pick: [number, number] | null = null, bv = -1e9;
      const s = BUILDINGS[type].size / 2;
      for (let y = Math.floor(ky - dmax); y <= ky + dmax; y++) for (let x = Math.floor(kx - dmax); x <= kx + dmax; x++) {
        const d = Math.hypot(x + s - kx, y + s - ky);
        if (d < dmin || d > dmax || !g.canPlace(type, x, y).ok) continue;
        const v = best(x, y) - d * 0.01;
        if (v > bv) { bv = v; pick = [x, y]; }
      }
      if (!pick || !g.place(type, pick[0], pick[1]).ok) return null;
      return g.buildingAt(pick[0], pick[1])!;
    };
    const markt = put('markt', 3, 6, () => 0);
    const farms = [put('schaffarm', 3, 9, (x, y) => g.siteEfficiency('schaffarm', x, y)), null as Building | null];
    farms[1] = put('schaffarm', 3, 9, (x, y) => g.siteEfficiency('schaffarm', x, y));
    const web = put('weberei', 2, 7, () => 0);
    const all = [markt, ...farms, web].filter((b): b is Building => !!b);
    // Wege: jeden Betrieb an das Netz anschließen
    for (const b of all) {
      const N = g.size, from = new Map<number, number>(), q: number[] = [];
      for (const [x, y] of g.ring(b)) { const kk = g.idx(x, y); if (!g.occ[kk] && g.own[kk] === HUMAN && g.tiles[kk] !== T.Wasser && g.tiles[kk] !== T.Berg && !g.roads[kk]) { from.set(kk, -1); q.push(kk); } }
      for (let h = 0; h < q.length; h++) {
        const c = q[h], x = c % N, y = (c / N) | 0;
        let hit = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nk = g.idx(x + dx, y + dy);
          const o = g.occ[nk] ? g.byId.get(g.occ[nk]) : undefined;
          if (g.roadLinked[nk] || (o && o.type === 'kontor')) hit = true;
        }
        if (hit) { const cells: [number, number][] = []; for (let cc = c; cc >= 0; cc = from.get(cc)!) cells.push([cc % N, (cc / N) | 0]); g.placeRoads(cells); break; }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nk = g.idx(x + dx, y + dy);
          if (from.has(nk) || g.occ[nk] || g.own[nk] !== HUMAN || g.tiles[nk] === T.Wasser || g.tiles[nk] === T.Berg || g.roads[nk]) continue;
          from.set(nk, c); q.push(nk);
        }
      }
    }
    g.recompute();
    const ok = all.length === 4 && all.every((b) => g.linked.has(b.id));
    ziel('Probe aufgebaut (Marktplatz, 2 Schaffarmen, Weberei, alle mit Weg)', ok, all.map((b) => `${BUILDINGS[b.type].name} ${pct(b.eff)}`).join(', '));
    if (ok) {
      for (let i = 0; i < 4 * 120; i++) g.tick(0.25); // anlaufen lassen
      const MIN = 10;
      let got = -l.stoff;
      for (let i = 0; i < 4 * 60 * MIN; i++) { g.tick(0.25); if (l.stoff > 30) { got += 20; l.stoff -= 20; } }
      got += l.stoff;
      // rechnerisch: so viel Wolle geben die Weiden auf Dauer her (Ergiebigkeit), je 2 Wolle ein Stoff – höchstens die Weberei
      const wolle = farms.reduce((a, f) => a + rate('schaffarm') * f!.eff, 0);
      const ideal = Math.min(rate('weberei'), wolle / 2);
      const perMin = got / MIN;
      console.log(`  Schaffarmen ${pct(farms[0]!.eff)} / ${pct(farms[1]!.eff)} Ergiebigkeit · rechnerisch ${ideal.toFixed(1)} Stoffe/Min · im Lager angekommen ${perMin.toFixed(1)} Stoffe/Min · Weberei ${pct(web!.active)} ausgelastet`);
      console.log(`  das versorgt ${Math.round(perMin / maxUse('stoff'))} Bewohner (Original mit 2 Schaffarmen + Webstube: 283)`);
      ziel('Marktkarren schaffen die schnellere Herstellung (≥ 60 % kommen an)', perMin >= 0.6 * ideal, pct(perMin / ideal));
    }
  }
}

console.log(fails ? `\n${fails} Ziel(e) verfehlt` : '\nAlle Ziele erreicht');
if (fails) process.exitCode = 1;
