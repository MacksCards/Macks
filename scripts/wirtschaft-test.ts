// Logiktest der Wirtschaft wie 1602 (Paket L2) ohne Browser: Steuersätze, Zufriedenheit, Hunger, Auszug,
// Abstieg, Aufstiegstempo, Baumaterial-Sperre, Unterhalt im Betrieb und in Ruhe, Betrieb ruhen lassen,
// Abholweite der Marktkarren, Schulden und Bankrott, Kontor abreißen, Spielstand.
// Ausführen im Projektordner:
//   npx esbuild scripts/wirtschaft-test.ts --bundle --platform=node --outfile=/tmp/wirtschaft-test.cjs && node /tmp/wirtschaft-test.cjs
// Beendet sich mit Fehlercode 1, wenn eine Prüfung fehlschlägt.
const g0 = globalThis as unknown as Record<string, unknown>;
g0.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
import { BUILDINGS, BuildingId, GOODS, TIERS } from '../src/data';
import { BANKROTT, Building, Game, HUMAN, SaveData } from '../src/game';
import { T } from '../src/world';

declare const process: { exitCode?: number };

let fails = 0;
const check = (name: string, cond: boolean, info = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK    ' : 'FEHLER'} ${name}${info ? ' – ' + info : ''}`);
};

/** Spiel mit Kontor auf einer großen Insel mit viel flachem Land; Meldungen werden gesammelt */
function setup(seed = 4242) {
  const g = Game.create(seed, 0);
  g.money = 1e6;
  g.seen.fill(1);
  const msgs: string[] = [];
  g.ev.message = (t: string) => { msgs.push(t); };
  const ship = g.myShips()[0];
  const cand = [...g.islands].filter((i) => i.land >= 1500).sort((a, b) => Math.hypot(a.cx - ship.x, a.cy - ship.y) - Math.hypot(b.cx - ship.x, b.cy - ship.y));
  for (const isl of cand) {
    let best: [number, number, number] | null = null;
    for (let y = isl.y0; y <= isl.y1; y++) for (let x = isl.x0; x <= isl.x1; x++) {
      if (!g.canPlace('kontor', x, y, 0, true).ok) continue;
      let n = 0;
      for (let j = -9; j <= 9; j++) for (let i = -9; i <= 9; i++) { const t = g.tile(x + 1 + i, y + 1 + j); if (t === T.Gras || t === T.Sand) n++; }
      if (!best || n > best[2]) best = [x, y, n];
    }
    if (!best) continue;
    for (const [rx, ry] of g.ring({ type: 'kontor', x: best[0], y: best[1] })) if (g.tiles[g.idx(rx, ry)] === T.Wasser) { ship.x = rx + 0.5; ship.y = ry + 0.5; break; }
    if (g.place('kontor', best[0], best[1]).ok) {
      const k = g.kontor()!;
      const l = g.lagerOf(HUMAN, k.island)!;
      for (const gd of GOODS) l[gd.id] = 25;
      return { g, k, l, msgs };
    }
  }
  throw new Error('kein Platz für ein Kontor');
}

/** freien Platz für ein Gebäude suchen, Abstand zum Kontor zwischen dmin und dmax */
function spot(g: Game, type: BuildingId, k: Building, dmin = 0, dmax = 14): [number, number] | null {
  const [kx, ky] = g.center(k);
  const s = BUILDINGS[type].size / 2;
  let best: [number, number] | null = null, bd = 1e9;
  for (let y = Math.floor(ky - dmax); y <= ky + dmax; y++) for (let x = Math.floor(kx - dmax); x <= kx + dmax; x++) {
    const d = Math.hypot(x + s - kx, y + s - ky);
    if (d < dmin || d > dmax || !g.canPlace(type, x, y).ok) continue;
    if (d < bd) { bd = d; best = [x, y]; }
  }
  return best;
}

/** Gebäude bauen (ohne Freischalt- und Standortsorgen: es wird ein passender Platz gesucht) */
function put(g: Game, type: BuildingId, k: Building, dmin = 0, dmax = 14): Building | null {
  g.unlocked.add(type);
  const p = spot(g, type, k, dmin, dmax);
  if (!p || !g.place(type, p[0], p[1]).ok) return null;
  return g.buildingAt(p[0], p[1]) ?? null;
}

/** Weg vom Gebäude zum Wegenetz oder zum Kontor legen (Breitensuche über eigenes Land) */
function connect(g: Game, b: Building): boolean {
  const N = g.size;
  const from = new Map<number, number>();
  const q: number[] = [];
  for (const [x, y] of g.ring(b)) {
    if (!g.inMap(x, y)) continue;
    const k = g.idx(x, y);
    if (g.roadLinked[k]) return true;
    if (!g.occ[k] && g.own[k] === HUMAN && g.tiles[k] !== T.Wasser && g.tiles[k] !== T.Berg && !g.roads[k]) { from.set(k, -1); q.push(k); }
  }
  for (let h = 0; h < q.length; h++) {
    const c = q[h], x = c % N, y = (c / N) | 0;
    let hit = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nk = g.idx(x + dx, y + dy);
      if (g.roadLinked[nk]) hit = true;
      const o = g.occ[nk] ? g.byId.get(g.occ[nk]) : undefined;
      if (o && (o.type === 'kontor' || o.type === 'markt') && o.owner === HUMAN) hit = true;
    }
    if (hit) { const cells: [number, number][] = []; for (let cc = c; cc >= 0; cc = from.get(cc)!) cells.push([cc % N, (cc / N) | 0]); g.placeRoads(cells); return true; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nk = g.idx(x + dx, y + dy);
      if (from.has(nk) || g.occ[nk] || g.own[nk] !== HUMAN || g.tiles[nk] === T.Wasser || g.tiles[nk] === T.Berg || g.roads[nk]) continue;
      from.set(nk, c); q.push(nk);
    }
  }
  return false;
}

const run = (g: Game, sec: number, step = 0.25) => { for (let t = 0; t < sec; t += step) g.tick(step); };
/** Haus auf eine Stufe setzen, voll belegt und zufrieden */
const setHouse = (g: Game, h: Building, tier: number, residents = TIERS[tier].maxResidents) => {
  h.tier = tier; h.residents = residents; h.happy = 1;
  for (const gd of Object.keys(TIERS[tier].consumes)) h.need[gd as 'nahrung'] = 1;
  g.recompute();
};

// ---------- 1. Steuersätze ----------
{
  const { g } = setup();
  check('Standardsatz der Pioniere', g.taxRate(0) === TIERS[0].taxStd, `${g.taxRate(0)} %`);
  check('Höchstsätze wie im Vorbild 48/45/38/36/35', TIERS.map((t) => t.maxTax).join('/') === '48/45/38/36/35');
  const flach = TIERS[4].tax / TIERS[0].tax;
  check('flache Steuerkurve: Aristokrat ≈ 1,4 × Pionier', flach > 1.3 && flach < 1.5, flach.toFixed(2));
  check('Satz wird begrenzt (0 … 60 %)', g.setTaxRate(1, 99) === 60 && g.setTaxRate(1, -5) === 0);
  g.setTaxRate(1, TIERS[1].taxStd);
  g.setTaxRate(2, 30);
  check('nur die eingestellte Stufe ändert sich', g.taxRate(2) === 30 && g.taxRate(0) === TIERS[0].taxStd && g.taxRate(3) === TIERS[3].taxStd);
  const ai = { id: 1, name: 'KI', color: 0, ai: true, money: 0, tax: [5, 5, 5, 5, 5] };
  g.players.push(ai);
  check('Computergegner zahlen immer den Standardsatz', g.taxRate(0, 1) === TIERS[0].taxStd);
  g.players.pop();
}

// ---------- 2. Steuer eines Hauses, hohe Steuern, Auszug ----------
{
  const { g, k, l, msgs } = setup();
  put(g, 'markt', k, 3, 10);
  const h = put(g, 'haus', k, 2, 12)!;
  check('Haus gebaut', !!h);
  setHouse(g, h, 0);
  run(g, 30);
  const t0 = g.houseTax(h);
  check('voll versorgt: Steuer = Bewohner × Steuer der Stufe', Math.abs(t0 - h.residents * TIERS[0].tax * Math.pow(h.happy, 1.3)) < 1e-6, `${t0.toFixed(2)} Taler/Min, zufrieden ${(h.happy * 100).toFixed(0)} %`);
  check('voll versorgt beim Standardsatz zufrieden', h.happy > 0.85);
  g.setTaxRate(0, TIERS[0].taxStd * 1.25);
  const t1 = g.houseTax(h);
  check('höherer Satz = mehr Steuer', t1 > t0 * 1.2, `${t0.toFixed(2)} → ${t1.toFixed(2)}`);
  check('bis zum Höchstsatz bleibt ein voll versorgtes Haus zufrieden', (g.setTaxRate(0, 48), run(g, 30), h.happy > 0.85), `${(h.happy * 100).toFixed(0)} %`);
  g.setTaxRate(0, 60);
  for (const gd of GOODS) l[gd.id] = 40;
  run(g, 60);
  check('zu hohe Steuern: Bewohner unzufrieden und ziehen aus', h.happy < 0.85 && h.residents < TIERS[0].maxResidents, `zufrieden ${(h.happy * 100).toFixed(0)} %, Bewohner ${h.residents}`);
  check('Auszugsgrund „Steuern“ und Meldung', h.leave === 'steuern' && msgs.some((m) => m.includes('Zu hohe Steuern')), msgs.filter((m) => m.includes('Steuern')).join(' | '));
  const inc = g.incomePerMinute();
  check('incomePerMinute: Steuern je Stufe ergeben die Summe', Math.abs(inc.byTier.reduce((a, b) => a + b, 0) - inc.tax) < 1e-6);
  check('incomePerMinute: Unterhalt = Gebäude + Soldaten', Math.abs(inc.buildings + inc.army - inc.upkeep) < 1e-6);
}

// ---------- 3. tragbarer Satz sinkt mit fehlenden Waren ----------
{
  const { g, k } = setup();
  put(g, 'markt', k, 3, 10);
  const h = put(g, 'haus', k, 2, 12)!;
  setHouse(g, h, 2);
  check('Bürger voll versorgt: tragbar = Höchstsatz 38 %', Math.abs(g.bearableTax(h) - 38) < 0.01);
  h.need.gewuerze = 0; h.need.tabakwaren = 0; h.need.alkohol = 0;
  const b2 = g.bearableTax(h);
  check('Bürger mit 2 von 4 Waren (ohne Nahrung): tragbar etwa 20 %', b2 > 15 && b2 < 25, `${b2.toFixed(1)} %`);
}

// ---------- 4. Hunger ----------
{
  const { g, k, l, msgs } = setup();
  put(g, 'markt', k, 3, 10);
  put(g, 'kapelle', k, 2, 10);
  const h = put(g, 'haus', k, 2, 12)!;
  setHouse(g, h, 1);
  for (const gd of GOODS) l[gd.id] = 40;
  run(g, 20);
  check('Siedler versorgt: zufrieden', h.happy > 0.8, `${(h.happy * 100).toFixed(0)} %`);
  l.nahrung = 0;
  const vorher = h.residents;
  // erst wird der kleine Vorrat im Haus aufgegessen, dann wird der Hunger spürbar
  for (let i = 0; i < 240 * 4; i++) { l.nahrung = 0; g.tick(0.25); }
  check('ohne Nahrung: Hunger', g.hungry(h));
  check('Hunger: Zufriedenheit höchstens 30 %', h.happy <= 0.31, `${(h.happy * 100).toFixed(0)} %`);
  check('Hunger: Bewohner ziehen aus (auch Siedler)', h.residents < vorher, `${vorher} → ${h.residents}`);
  check('Auszugsgrund „Hunger“ mit Meldung', h.leave === 'hunger' && msgs.some((m) => m.startsWith('🍖 Hunger')));
}

// ---------- 5. Abstieg ----------
{
  const { g, k, l, msgs } = setup();
  put(g, 'markt', k, 3, 10);
  put(g, 'kapelle', k, 2, 10);
  const h = put(g, 'haus', k, 2, 12)!;
  setHouse(g, h, 2);
  for (const gd of GOODS) l[gd.id] = 0;
  let changed = 0;
  g.ev.changed = (b) => { if (b === h) changed++; };
  for (let i = 0; i < 300 * 4; i++) { for (const gd of GOODS) l[gd.id] = 0; g.tick(0.25); }
  check('lange unversorgt: Haus steigt ab', h.tier < 2, `Stufe ${TIERS[h.tier].name}, ${h.residents} Bewohner`);
  check('Abstieg meldet „Haus verfällt“ mit Grund', msgs.some((m) => m.startsWith('🏚️ Haus verfällt') && m.includes('fehlt')), msgs.filter((m) => m.startsWith('🏚️')).slice(0, 1).join(''));
  check('Abstieg zeichnet das Haus neu (changed)', changed > 0);
}

// ---------- 6. Aufstiegstempo und Baumaterial-Sperre ----------
{
  const { g, k, l } = setup();
  put(g, 'markt', k, 3, 10);
  put(g, 'kapelle', k, 2, 10);
  const houses: Building[] = [];
  for (let i = 0; i < 12; i++) { const h = put(g, 'haus', k, 2, 13); if (h) houses.push(h); }
  for (const h of houses) setHouse(g, h, 1);
  const h0 = houses[0];
  setHouse(g, h0, 0);
  for (const gd of GOODS) l[gd.id] = 40;
  run(g, 1.5);
  l.stoff = 1; // mindestens 1 t ist da, reicht aber keine 2 Minuten
  const use = g.islandUse(HUMAN, k.island).stoff ?? 0;
  const r = g.upgradeGoods(h0)[0];
  console.log("   Häuser", houses.length, houses.map((h) => `${h.tier}:${h.residents}`).join(" "), "Verbrauch Stoffe", use.toFixed(2));
  check('Aufstieg: Stoffe müssen 2 Minuten reichen', !r.ok && Math.abs(r.need - 2 * (use + h0.residents * (TIERS[1].consumes.stoff ?? 0))) < 1e-6, `da ${r.have}, nötig ${r.need.toFixed(1)} t`);
  check('Aufstieg gesperrt mit Erklärung', /reicht keine 2 Minuten/.test(g.upgradeBlocker(h0) ?? ''), g.upgradeBlocker(h0) ?? '');
  l.stoff = 40;
  check('genug Vorrat: kein Hindernis', g.upgradeBlocker(h0) === null, String(g.upgradeBlocker(h0)));
  g.setMatLock(k, true);
  check('Baumaterial gesperrt: kein Aufstieg', g.upgradeBlocker(h0) === 'Baumaterial gesperrt (Schalter am Kontor)');
  const holz = l.holz;
  run(g, 15);
  check('gesperrt: Haus bleibt Pionier, Holz bleibt im Lager', h0.tier === 0 && l.holz >= holz - 1e-9);
  g.setMatLock(k, false);
  l.holz = 2; // zu wenig für den Aufstieg (3 Holz)
  run(g, 15);
  check('zu wenig Baumaterial: kein Aufstieg, Lager nie unter 0', h0.tier === 0 && l.holz >= 0);
  l.holz = 40; l.stoff = 40;
  run(g, 15);
  check('mit Material und Vorrat: Aufstieg zu Siedlern', h0.tier === 1);
}

// ---------- 7. Unterhalt aktiv/ruhend, Betrieb ruhen lassen, Werft ----------
{
  const { g, k, l } = setup();
  const w = put(g, 'weberei', k, 2, 7)!;
  check('Weberei gebaut', !!w);
  connect(g, w); g.recompute();
  l.wolle = 40;
  run(g, 20);
  check('Weberei arbeitet: voller Unterhalt', w.status === 'ok' && g.upkeepOf(w) === BUILDINGS.weberei.upkeep, `${w.status}, ${g.upkeepOf(w)}`);
  g.setOff(w, true);
  run(g, 15); // ein Karren, der schon unterwegs war, darf noch abliefern
  const stoff = l.stoff, wolle = l.wolle;
  run(g, 30);
  check('ruhend: Status „aus“, Ruhe-Unterhalt', w.status === 'aus' && g.upkeepOf(w) === BUILDINGS.weberei.upkeepIdle, `${w.status}, ${g.upkeepOf(w)}`);
  check('ruhend: keine Wolle verbraucht, kein Stoff abgeholt', l.wolle === wolle && l.stoff === stoff, `Wolle ${wolle}→${l.wolle}, Stoffe ${stoff}→${l.stoff}`);
  g.setOff(w, false);
  l.wolle = 0;
  run(g, 60);
  check('ohne Rohstoff: Stillstand kostet nur den Ruhe-Unterhalt', w.status === 'rohstoff' && g.upkeepOf(w) === BUILDINGS.weberei.upkeepIdle, `${w.status}, ${g.upkeepOf(w)}`);
  check('Steinbruch ohne Unterhalt (wie im Vorbild)', BUILDINGS.steinbruch.upkeep === 0);
  const wf = { ...w, type: 'werft' as BuildingId, job: undefined };
  check('Werft ohne Auftrag: 20, mit Auftrag: 100', g.upkeepOf(wf) === 20 && g.upkeepOf({ ...wf, job: { ship: 'handel_klein', t: 0 } }) === 100);
}

// ---------- 8. Abholweite der Marktkarren ----------
{
  const { g, k } = setup();
  check('Abholweite Kontor 8, Marktplatz 12', g.pickupOf(k) === 8 && g.pickupOf({ type: 'markt' }) === 12);
  const fern = put(g, 'holzfaeller', k, 11, 15) ?? put(g, 'getreidefarm', k, 11, 15);
  if (fern) {
    connect(g, fern); g.recompute();
    run(g, 3);
    check('Betrieb weiter als 8 Felder vom Kontor: „zu weit“', g.linked.has(fern.id) && fern.status === 'zuWeit', `${fern.status}, verbunden ${g.linked.has(fern.id)}`);
    const m = put(g, 'markt', fern, 0, 6);
    if (m) { connect(g, m); g.recompute(); run(g, 3); }
    check('Marktplatz in der Nähe: wieder erreichbar', !!m && fern.status !== 'zuWeit' && g.inReach.has(fern.id), `${fern.status}`);
  } else check('Platz für einen fernen Betrieb', false);
}

// ---------- 9. Schulden und Bankrott ----------
{
  const { g, msgs } = setup();
  const me = g.players[HUMAN];
  g.money = -2500; run(g, 1);
  check('Warnung bei −2 000', msgs.some((m) => m.includes('2 000 Taler im Minus')));
  g.money = -6000; run(g, 1);
  check('Warnung bei −5 000', msgs.some((m) => m.includes('5 000 Taler Schulden')));
  g.money = -20000; run(g, BANKROTT.zeit - 30, 1);
  check('unter −10 000: noch nicht bankrott vor Ablauf von 10 Minuten', !me.defeated && msgs.some((m) => m.includes('Über 10 000')));
  g.money = -20000; run(g, 40, 1);
  check('nach 10 Minuten unter −10 000: bankrott', !!me.defeated && me.lost === 'bankrott');
  g.forgiveDebt();
  check('Schulden erlassen: Kasse 0, weiter im Spiel, Zähler 1', g.money === 0 && !me.defeated && !me.lost && me.erlass === 1);
  g.money = -20000; run(g, 300, 1); g.money = 100; run(g, 1, 1); g.money = -20000; run(g, 400, 1);
  check('Zeit unter −10 000 beginnt nach Erholung neu', !me.defeated, `${Math.round(me.debtT ?? 0)} s`);
  const ai = { id: 1, name: 'KI', color: 0, ai: true, money: -50000 };
  g.players.push(ai);
  run(g, BANKROTT.zeit + 60, 1);
  check('Computergegner werden nicht bankrott', !g.players[1].defeated);
}

// ---------- 10. Kontor abreißen ----------
{
  const { g, k } = setup();
  const hf = put(g, 'holzfaeller', k, 2, 8)!;
  check('Kontor mit anderen Gebäuden bleibt stehen', !g.canDemolishKontor(k).ok && !g.demolish(k.x, k.y) && !!g.byId.get(k.id));
  g.removeBuilding(hf);
  const isl = k.island;
  check('Kontor allein auf der Insel: Abriss möglich', g.demolish(k.x, k.y) && !g.byId.get(k.id));
  check('Lager verfällt, Gebiet wird frei', !g.lagerOf(HUMAN, isl) && !g.own.some((o, i) => o === HUMAN && g.islandOf[i] === isl));
}

// ---------- 11. Spielstand ----------
{
  const { g, k } = setup();
  const w = put(g, 'weberei', k, 2, 8)!;
  g.setTaxRate(3, 20); g.setOff(w, true); g.setMatLock(k, true); g.players[HUMAN].erlass = 2;
  const d = JSON.parse(JSON.stringify(g.serialize())) as SaveData;
  // (Zusammenführung Welle 2) Version 6; ältere Stände laden weiter (siehe unten und spielstaende-test)
  check('Spielstand Version 6', d.v === 6);
  const g2 = Game.fromSave(d);
  check('Steuersatz, Ruhen, Sperre und Erlass bleiben erhalten', g2.taxRate(3) === 20 && !!g2.byId.get(w.id)?.off && !!g2.kontor()?.matLock && g2.players[HUMAN].erlass === 2);
  const old = JSON.parse(JSON.stringify(d)) as SaveData & { v: number };
  old.v = 4; delete old.players[HUMAN].tax;
  for (const b of old.buildings) { delete b.off; delete b.matLock; }
  const g3 = Game.fromSave(old as SaveData);
  check('alter Stand (Version 4): Standardsätze, alles läuft', g3.taxRate(3) === TIERS[3].taxStd && !g3.kontor()?.matLock && (run(g3, 5), true));
}

console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden');
if (fails) process.exitCode = 1;
