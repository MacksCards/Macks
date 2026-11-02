// Fenster-Test ohne Browser (Paket U2): Steuerregler, Vorschau der Einnahmen, Hinweis bei leerer Kasse und die
// Vorlagen, mit denen Fenster nur Zahlen austauschen statt neu gebaut zu werden (src/ui/live.ts).
// Erwartung: Die Vorschau „jetzt“ ist genau die Steuer, die das Spiel rechnet; mehr Steuern bringen mehr Geld,
// solange die Bewohner sie tragen; die Vorlage bleibt gleich, wenn sich nur Zahlen ändern.
// Ausführen im Projektordner:
//   npx esbuild scripts/fenster-test.ts --bundle --platform=node --outfile=/tmp/fenster-test.cjs && node /tmp/fenster-test.cjs
// Beendet sich mit Fehlercode 1, wenn eine Prüfung fehlschlägt.
const g0 = globalThis as unknown as Record<string, unknown>;
g0.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
import { Game, HUMAN, type Building } from '../src/game';
import { BUILDINGS, TIERS, type BuildingId } from '../src/data';
import { Live } from '../src/ui/live';
import { STEP, cashHint, mood, reachedTiers, taxAt, taxRowHtml } from '../src/ui/tax';

let fails = 0;
const check = (name: string, cond: boolean, info = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK    ' : 'FEHLER'} ${name}${info ? ' – ' + info : ''}`);
};

function put(g: Game, type: BuildingId, isl: number, cx: number, cy: number): Building {
  const cands: [number, number, number][] = [];
  for (let y = Math.floor(cy) - 14; y <= cy + 14; y++) for (let x = Math.floor(cx) - 14; x <= cx + 14; x++) cands.push([x, y, Math.hypot(x - cx, y - cy)]);
  cands.sort((a, b) => a[2] - b[2]);
  for (const [x, y] of cands) {
    if (!g.inMap(x, y) || g.islandOf[g.idx(x, y)] !== isl) continue;
    const b = g.placeNeutral(type, x, y, HUMAN);
    if (b) return b;
  }
  throw new Error(`kein Platz für ${type}`);
}

// ---------- Aufbau ----------
const g = Game.create(4711, 2);
const coast = g.homeCoast()!;
const isl = g.islandOf[g.idx(coast[0], coast[1])];
const kontor = put(g, 'kontor', isl, coast[0], coast[1]);
const [kx, ky] = g.center(kontor);
const houses: Building[] = [];
for (let i = 0; i < 6; i++) houses.push(put(g, 'haus', isl, kx + 6, ky));
houses.forEach((h, i) => { h.tier = i < 4 ? 0 : 1; h.residents = TIERS[h.tier].maxResidents; h.happy = i === 3 ? 0.6 : 1; });
g.recompute();

// ---------- Steuern: Vorschau ----------
{
  const reached = reachedTiers(g);
  check('Erreichte Stufen: Pioniere und Siedler', reached[0] && reached[1] && !reached[2], JSON.stringify(reached));
  for (const t of [0, 1]) {
    const real = g.buildings.filter((b) => b.type === 'haus' && b.tier === t).reduce((s, h) => s + g.houseTax(h), 0);
    const now = taxAt(g, t, g.taxRate(t));
    check(`Vorschau „jetzt“ = Steuer des Spiels (${TIERS[t].name})`, Math.abs(now - real) < 1e-9, `${now.toFixed(3)} / ${real.toFixed(3)}`);
    const lo = taxAt(g, t, g.taxRate(t) - STEP), hi = taxAt(g, t, g.taxRate(t) + STEP);
    check(`Vorschau: 5 % weniger bringt weniger, 5 % mehr mehr (${TIERS[t].name}, tragbar)`, lo < now && hi > now, `${lo.toFixed(1)} < ${now.toFixed(1)} < ${hi.toFixed(1)}`);
  }
  // weit über dem tragbaren Satz: Zufriedenheit bricht ein, die Einnahmen steigen kaum oder sinken
  const at60 = taxAt(g, 0, 60), at50 = taxAt(g, 0, 50);
  check('Vorschau: weit über dem tragbaren Satz lohnt mehr Steuer nicht', at60 <= at50 * 1.05, `50 %: ${at50.toFixed(1)} · 60 %: ${at60.toFixed(1)}`);
  check('Gesicht: 😊 bei tragbarem Satz', mood(30, 40).face === '😊');
  check('Gesicht: 😐 knapp darüber', mood(42, 40).face === '😐');
  check('Gesicht: 😠 deutlich darüber', mood(50, 40).face === '😠');
}

// ---------- Hinweis „Kasse leer? Steuern erhöhen“ ----------
{
  g.players[HUMAN].money = 5000;
  check('Kein Kassen-Hinweis, solange Geld da ist und mehr hereinkommt', cashHint(g) === '' || g.incomePerMinute().tax < g.incomePerMinute().upkeep);
  // viele teure Gebäude ohne Arbeit: Ausgaben > Einnahmen
  for (let i = 0; i < 4; i++) put(g, 'schule', isl, kx - 8, ky - 4);
  g.recompute();
  const inc = g.incomePerMinute();
  check('Aufbau: Ausgaben größer als Einnahmen', inc.upkeep > inc.tax, `${inc.tax.toFixed(0)} / ${inc.upkeep.toFixed(0)}`);
  check('Kassen-Hinweis bei Minus-Bilanz nennt „Steuern erhöhen“', /Steuern erhöhen/.test(cashHint(g)), cashHint(g));
  g.players[HUMAN].money = -100;
  check('Kassen-Hinweis bei leerer Kasse', /Kasse im Minus/.test(cashHint(g)));
  g.players[HUMAN].money = 5000;
}

// ---------- Vorlagen: nur Zahlen austauschen ----------
{
  const build = () => { const L = new Live(); return { L, tpl: taxRowHtml(L, g, 0, 40) }; };
  const a = build();
  g.setTaxRate(0, g.taxRate(0) + STEP);
  const b = build();
  check('Vorlage bleibt gleich, wenn sich nur der Satz ändert', a.tpl === b.tpl);
  check('… aber das fertige HTML zeigt den neuen Satz', a.L.html(a.tpl) !== b.L.html(b.tpl) && b.L.html(b.tpl).includes(`${g.taxRate(0)} %`));
  g.setTaxRate(0, 60);
  const c = build();
  check('Gesperrter Knopf bei 60 % ändert die Vorlage nicht (nur „disabled“)', c.tpl === a.tpl && /data-d="\d+" disabled/.test(c.L.html(c.tpl)));
  g.setTaxRate(0, TIERS[0].taxStd);
  const L = new Live();
  const h = L.html(`<b>${L.v('<i>1</i>')}</b>${L.bar(0.5, '#fff')}<p ${L.cls('a b')}>x</p>`);
  check('Vorlage: Wert, Balken und Klasse werden eingesetzt', h === '<b><span data-v="0"><i>1</i></span></b><div class="bar"><i data-b="1" style="width:50%;background:#fff"></i></div><p class="a b" data-c="2">x</p>', h);
}

// ---------- alle Gebäude mit Unterhalt haben Ruhe-Werte, die das Fenster zeigen kann ----------
{
  const bad = Object.values(BUILDINGS).filter((d) => d.prod && d.upkeepIdle !== undefined && d.upkeepIdle > d.upkeep);
  check('Ruhe-Unterhalt nie höher als im Betrieb', bad.length === 0, bad.map((d) => d.id).join(', '));
}

console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden');
process.exit(fails ? 1 : 0);
