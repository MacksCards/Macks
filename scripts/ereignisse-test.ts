// Ereignis-Test ohne Browser (Paket S3): Feuer, Pest, Kriminalität, Dürre, Schatz, Fluch.
// Erwartung: Feuer brennt ohne Feuerwehr in 60 s ab und springt über, mit Feuerwehr (Weganschluss) ist es in
// 10–15 s gelöscht; die Pest kostet alle 15 s einen Bewohner und steckt Nachbarn an, beim Arzt heilt sie in 20 s;
// Diebe stehlen nur ohne Galgen; die Dürre stoppt Felder und Weiden, Fischer arbeiten weiter; Schätze
// kommen erst nach dem Zeitfenster fürs Rückgängigmachen; der Fluch macht alles dreimal so häufig;
// die Häufigkeit folgt der Einstellung (aus / mild / normal); alles übersteht Speichern und Laden.
// Ausführen im Projektordner:
//   npx esbuild scripts/ereignisse-test.ts --bundle --platform=node --outfile=/tmp/ereignisse-test.cjs && node /tmp/ereignisse-test.cjs
// Beendet sich mit Fehlercode 1, wenn eine Prüfung fehlschlägt.
const g0 = globalThis as unknown as Record<string, unknown>;
g0.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
import { Game, HUMAN, type Building, type GameOptions, type MsgAt, type SaveData } from '../src/game';
import { BUILDINGS, TIERS, type BuildingId } from '../src/data';
import * as ev from '../src/events';

let fails = 0;
const check = (name: string, cond: boolean, info = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK    ' : 'FEHLER'} ${name}${info ? ' – ' + info : ''}`);
};

/** freien Platz für ein Gebäude auf der Insel suchen (nahe beim Punkt, Abstand min…max), mit placeNeutral setzen */
function put(g: Game, type: BuildingId, isl: number, cx: number, cy: number, opt: { min?: number; max?: number; ok?: (b: Building) => boolean } = {}): Building {
  const max = opt.max ?? 14, min = opt.min ?? 0;
  const cands: [number, number, number][] = [];
  for (let y = Math.floor(cy - max); y <= cy + max; y++) for (let x = Math.floor(cx - max); x <= cx + max; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d >= min && d <= max) cands.push([x, y, d]);
  }
  cands.sort((a, b) => a[2] - b[2]);
  for (const [x, y] of cands) {
    if (!g.inMap(x, y) || g.islandOf[g.idx(x, y)] !== isl) continue;
    const b = g.placeNeutral(type, x, y, HUMAN);
    if (!b) continue;
    if (opt.ok && !opt.ok(b)) { g.forceRemove(b); continue; }
    return b;
  }
  throw new Error(`kein Platz für ${type}`);
}

/** Spiel mit Kontor an der Heimatküste, ohne Gegner und Piraten */
function world(seed: number, opts: Partial<GameOptions> = {}) {
  const g = Game.create(seed, 0, { piraten: false, ...opts });
  g.quest = 1e9;
  const msgs: { text: string; kind?: string; at?: MsgAt; t: number }[] = [];
  g.ev.message = (text, kind, at) => { msgs.push({ text, kind, at, t: g.time }); };
  const coast = g.homeCoast()!;
  const isl = g.islandOf[g.idx(coast[0], coast[1])];
  const kontor = put(g, 'kontor', isl, coast[0], coast[1]);
  const l = g.lagerOf(HUMAN, isl)!;
  l.nahrung = 50; l.holz = 40; l.werkzeug = 20; l.stein = 20;
  return { g, msgs, isl, kontor, l };
}

const run = (g: Game, secs: number, dt = 0.25) => { const end = g.time + secs; while (g.time < end - 1e-9) g.tick(Math.min(dt, end - g.time)); };
const roundTrip = (g: Game) => Game.fromSave(JSON.parse(JSON.stringify(g.serialize())) as SaveData);
const sys = ev.system;

// ---------- Gebäude: Feuerwehr, Arzt, Galgen sind bereit, Werte wie im Vorbild ----------
{
  const { g } = world(4711);
  const f = BUILDINGS.feuerwehr, a = BUILDINGS.arzt, ga = BUILDINGS.galgen;
  check('Feuerwehr, Arzt und Galgen sind „bereit“', g.isReady('feuerwehr') && g.isReady('arzt') && g.isReady('galgen'));
  check('Feuerwehr: 150 Taler, 5 Holz, 3 Werkzeug, Unterhalt 15, Reichweite 15, 2×2, ab 15 Siedlern',
    f.cost.taler === 150 && f.cost.holz === 5 && f.cost.werkzeug === 3 && !f.cost.stein && f.upkeep === 15 && f.radius === 15 && f.size === 2 && f.unlock?.tier === 1 && f.unlock.n === 15);
  check('Arzt: 450 Taler, 4 Holz, 4 Werkzeug, 9 Steine, Unterhalt 30, Reichweite 16, 2×2, ab 50 Bürgern',
    a.cost.taler === 450 && a.cost.holz === 4 && a.cost.werkzeug === 4 && a.cost.stein === 9 && a.upkeep === 30 && a.radius === 16 && a.size === 2 && a.unlock?.tier === 2 && a.unlock.n === 50);
  check('Galgen: 100 Taler, 2 Holz, 1 Werkzeug, Unterhalt 20, Reichweite 16, 1×1, ab 100 Bürgern',
    ga.cost.taler === 100 && ga.cost.holz === 2 && ga.cost.werkzeug === 1 && ga.upkeep === 20 && ga.radius === 16 && ga.size === 1 && ga.unlock?.tier === 2 && ga.unlock.n === 100);
  check('Am Anfang noch nicht freigeschaltet (Regel 8)', !g.isUnlocked('feuerwehr') && !g.isUnlocked('arzt') && !g.isUnlocked('galgen'));
  const { isl, kontor } = { isl: g.buildings[0].island, kontor: g.buildings[0] };
  const hs = put(g, 'haus', isl, ...g.center(kontor), { max: 10 });
  hs.tier = 1; hs.residents = 15;
  g.checkUnlocks();
  check('Ab 15 Siedlern: Feuerwehr im Baumenü', g.isUnlocked('feuerwehr') && !g.isUnlocked('arzt'));
  check('Standard der Häufigkeit ist „mild“', g.opts.ereignisse === 'mild');
}

// ---------- Feuer ohne Feuerwehr ----------
{
  const { g, msgs, isl, kontor, l } = world(4711, { ereignisse: 'aus' });
  g.best[1] = 100; // Feuerwehr wäre baubar (keine gebaut): dann brennt es ab
  const [kx, ky] = g.center(kontor);
  const h = put(g, 'haus', isl, kx + 7, ky, { max: 10 });
  h.residents = 3;
  const max = g.maxHp(h);
  const holz0 = l.holz;
  check('Kontor brennt nicht', !ev.ignite(g, kontor) && !ev.burning(g, kontor));
  check('(R2-Fix2) vor dem Brand: crisisOn meldet kein Feuer auf der Insel', !ev.crisisOn(g, HUMAN, h.island, 'feuer'));
  check('ignite: das Haus brennt', ev.ignite(g, h) && ev.burning(g, h));
  check('(R2-Fix2) crisisOn: Feuer auf der Insel (die Brandmeldung bleibt stehen)', ev.crisisOn(g, HUMAN, h.island, 'feuer') && !ev.crisisOn(g, HUMAN, h.island, 'pest'));
  check('Brand senkt die Trefferpunkte unter 75 % (Flammen erscheinen)', h.hp !== undefined && h.hp / max < 0.75, `${h.hp}/${max}`);
  check('Symbol 🔥 über dem Haus', ev.iconFor(g, h) === '🔥');
  check('Flammen gleich beim Ausbruch deutlich (Stärke über 0,2 – darunter zeichnet die Darstellung keine Flammen)', ev.fireStrength(g, h) > 0.2, `${ev.fireStrength(g, h)}`);
  check('Info: „Brennt – Feuerwehr fehlt“', ev.infoLines(g, h).some((s) => s.includes('Brennt – Feuerwehr fehlt')), ev.infoLines(g, h).join(' | '));
  const m = msgs.find((x) => x.text.startsWith('🔥 Feuer'));
  check('Meldung mit Ort und Alarm-Anfang „🔥 Feuer“', !!m && !!m.at && m.kind === 'bad', m?.text);
  run(g, 30);
  const mid = h.hp ?? max;
  check('Nach 30 s brennt es noch, die Trefferpunkte sinken', g.byId.has(h.id) && mid < max * 0.4, `${mid.toFixed(1)}`);
  run(g, 31);
  check('Nach 60 s ist das Haus abgebrannt', !g.byId.has(h.id));
  check('(R2-Fix2) danach meldet crisisOn kein Feuer mehr (die Brandmeldung verschwindet)', !ev.crisisOn(g, HUMAN, h.island, 'feuer'));
  check('Abgebrannt: kein Baumaterial zurück', l.holz <= holz0);
  check('Meldung „abgebrannt“', msgs.some((x) => x.text.includes('abgebrannt')));
  check('Zähler: abgebrannt = 1', ev.counts(g).abgebrannt === 1);
  // Kampf: Holzturm brennt, Steinturm nicht nötig (combat entscheidet), hier nur: anderes Gebäude geht auch
  const t = put(g, 'holzturm', isl, kx - 6, ky, { max: 10 });
  check('ignite auch für andere Holzgebäude (Kanonentreffer)', ev.ignite(g, t) && ev.iconFor(g, t) === '🔥');
}

// ---------- Feuer mit Feuerwehr (Weganschluss) ----------
{
  const { g, msgs, isl, kontor } = world(4711, { ereignisse: 'aus' });
  const [kx, ky] = g.center(kontor);
  // direkt am Kontor = mit dem Wegenetz verbunden
  const fw = put(g, 'feuerwehr', isl, kx, ky, { max: 4, ok: (b) => g.linked.has(b.id) });
  const [fx, fy] = g.center(fw);
  const h = put(g, 'haus', isl, fx + 5, fy, { max: 8 });
  const max = g.maxHp(h);
  check('Feuerwehr hat Weganschluss', g.linked.has(fw.id));
  check('Haus liegt in Reichweite der Feuerwehr', ev.covered(g, h, 'feuerwehr'));
  check('Info der Feuerwehr: „Schützt … Häuser vor Feuer“', ev.infoLines(g, fw).some((s) => /Schützt (ein Haus|\d+ Häuser) vor Feuer/.test(s)), ev.infoLines(g, fw).join(' | '));
  ev.ignite(g, h);
  check('Info: „die Feuerwehr löscht“', ev.infoLines(g, h).some((s) => s.includes('Feuerwehr löscht')));
  check('Meldung nennt die Feuerwehr', msgs.some((x) => x.text.startsWith('🔥 Feuer') && x.text.includes('Feuerwehr rückt aus')));
  run(g, 2);
  const s0 = ev.fireStrength(g, h);
  run(g, 5);
  check('Beim Löschen werden die Flammen kleiner', ev.fireStrength(g, h) < s0 && ev.fireStrength(g, h) > 0, `${s0.toFixed(2)} → ${ev.fireStrength(g, h).toFixed(2)}`);
  let out = -1;
  const t0 = g.time - 7;
  while (g.time - t0 < 20) { g.tick(0.25); if (!ev.burning(g, h)) { out = g.time - t0; break; } }
  check('Feuerwehr löscht in 10–15 s', out >= 9.9 && out <= 15.3, `${out.toFixed(2)} s`);
  check('Haus steht noch, Flammen aus (≥ 75 %)', g.byId.has(h.id) && (h.hp ?? max) >= max * 0.75, `${h.hp}`);
  check('Meldung „🚒 … gelöscht“', msgs.some((x) => x.text.startsWith('🚒') && x.kind === 'good'));
  run(g, 15);
  check('Brandschaden wird danach ausgebessert (wieder unbeschädigt)', h.hp === undefined, `${h.hp}`);
  // Feuerwehr ohne Weg: hilft nicht
  const { g: g2, isl: i2, kontor: k2 } = world(4711, { ereignisse: 'aus' });
  g2.best[1] = 100; // Feuerwehr baubar – sonst löschten die Nachbarn mit Eimern
  const [k2x, k2y] = g2.center(k2);
  const fw2 = put(g2, 'feuerwehr', i2, k2x + 9, k2y, { min: 6, max: 12, ok: (b) => !g2.linked.has(b.id) });
  const [f2x, f2y] = g2.center(fw2);
  const h2 = put(g2, 'haus', i2, f2x + 4, f2y, { max: 8 });
  check('Feuerwehr ohne Weg schützt nicht', !ev.covered(g2, h2, 'feuerwehr'));
  check('Info der Feuerwehr ohne Weg: „Kein Weg“', ev.infoLines(g2, fw2).some((s) => s.includes('Kein Weg')));
  ev.ignite(g2, h2);
  run(g2, 61);
  check('… und das Haus brennt ab', !g2.byId.has(h2.id));
}

// ---------- Noch keine Feuerwehr baubar: die Nachbarn löschen mit Eimern ----------
{
  const { g, msgs, isl, kontor } = world(4711, { ereignisse: 'aus' });
  const [kx, ky] = g.center(kontor);
  const h = put(g, 'haus', isl, kx + 7, ky, { max: 10 });
  h.residents = 3;
  check('ignite vor der Feuerwehr: das Haus brennt', ev.ignite(g, h) && ev.burning(g, h));
  check('Info: „die Nachbarn löschen mit Eimern“', ev.infoLines(g, h).some((s) => s.includes('Eimern')), ev.infoLines(g, h).join(' | '));
  run(g, ev.FIRE.buckets + 1);
  check(`Nach ${ev.FIRE.buckets} s haben die Nachbarn gelöscht – das Haus steht noch (beschädigt)`, g.byId.has(h.id) && !ev.burning(g, h) && (h.hp ?? 0) > 0);
  check('Meldung „mit Eimern gelöscht“', msgs.some((x) => x.text.includes('mit Eimern gelöscht')));
  run(g, 120);
  check('… und wird danach ausgebessert', g.byId.has(h.id) && h.hp === undefined);
}

// ---------- „mild“ (Standard): Funkenflug selten – ein Brand frisst keine Pionier-Blöcke mehr ----------
{
  // Erwartung je Brand ohne Feuerwehr (60 s, drei Funkenflüge): Nachbarn × 3 × 30 % × 0,15 – bei 4 Nachbarn ≈ 0,5
  check('„mild“: Funkenflug 15 % von „normal“', ev.SPREAD.mild === 0.15 && ev.SPREAD.normal === 1);
  const { g, isl, kontor } = world(4711, { ereignisse: 'mild' });
  g.best[1] = 100; // Feuerwehr baubar, aber keine gebaut
  const [kx, ky] = g.center(kontor);
  const a = put(g, 'haus', isl, kx + 8, ky, { max: 12 });
  const nb = put(g, 'haus', isl, a.x + 2, a.y, { max: 3, ok: (b) => Math.abs(b.x - a.x) + Math.abs(b.y - a.y) === 2 });
  g.rng = () => 0.2; // reicht bei „normal“ (30 %), bei „mild“ (4,5 %) nicht
  ev.ignite(g, a);
  run(g, 20.5);
  check('„mild“: Wurf 0,2 springt nicht über', !ev.burning(g, nb));
  g.rng = () => 0.04;
  run(g, 20);
  check('„mild“: Wurf 0,04 schon', ev.burning(g, nb));
}

// ---------- Feuer springt über (Stein und Pflaster bremsen; Einstellung „normal“) ----------
{
  const { g, isl, kontor } = world(4711, { ereignisse: 'normal' });
  g.best[1] = 100; // Feuerwehr wäre baubar: voller Funkenflug
  const [kx, ky] = g.center(kontor);
  const a = put(g, 'haus', isl, kx + 8, ky, { max: 12 });
  // Nachbar Wand an Wand rechts (oder irgendwo direkt daneben)
  const nb = put(g, 'haus', isl, a.x + 2, a.y, { max: 3, ok: (b) => Math.abs(b.x - a.x) + Math.abs(b.y - a.y) === 2 });
  const realRng = g.rng.bind(g);
  g.rng = () => 0.2; // unter 30 %, aber über 15 %
  ev.ignite(g, a);
  run(g, 20.5);
  check('Holzhaus daneben fängt mit 30 % Feuer (Wurf 0,2)', ev.burning(g, nb));
  // Steinhaus (Bürger) daneben: nur halb so oft → Wurf 0,2 reicht nicht
  const { g: g2, isl: i2, kontor: k2 } = world(4711, { ereignisse: 'normal' });
  g2.best[1] = 100;
  const [k2x, k2y] = g2.center(k2);
  const a2 = put(g2, 'haus', i2, k2x + 8, k2y, { max: 12 });
  const nb2 = put(g2, 'haus', i2, a2.x + 2, a2.y, { max: 3, ok: (b) => Math.abs(b.x - a2.x) + Math.abs(b.y - a2.y) === 2 });
  nb2.tier = 2;
  g2.rng = () => 0.2;
  ev.ignite(g2, a2);
  run(g2, 20.5);
  check('Steinhaus daneben fängt mit Wurf 0,2 kein Feuer', !ev.burning(g2, nb2));
  g2.rng = () => 0.1;
  run(g2, 20);
  check('… mit Wurf 0,1 (unter 15 %) schon', ev.burning(g2, nb2));
  // Pflasterweg dazwischen: ein Feld Lücke mit Steinweg
  const { g: g3, isl: i3, kontor: k3 } = world(4711, { ereignisse: 'normal' });
  g3.best[1] = 100;
  const [k3x, k3y] = g3.center(k3);
  const a3 = put(g3, 'haus', i3, k3x + 8, k3y, { max: 12, ok: (b) => g3.inMap(b.x + 2, b.y) && !g3.occ[g3.idx(b.x + 2, b.y)] && !g3.occ[g3.idx(b.x + 2, b.y + 1)] && g3.islandOf[g3.idx(b.x + 2, b.y)] === i3 });
  g3.roads[g3.idx(a3.x + 2, a3.y)] = 2; g3.roads[g3.idx(a3.x + 2, a3.y + 1)] = 2;
  const nb3 = put(g3, 'haus', i3, a3.x + 3, a3.y, { max: 0.5 });
  g3.rng = () => 0.2;
  ev.ignite(g3, a3);
  run(g3, 20.5);
  check('Pflasterweg dazwischen: Wurf 0,2 reicht nicht (halbe Chance)', !ev.burning(g3, nb3) && g3.byId.has(nb3.id));
  g3.rng = () => 0.99;
  run(g3, 20);
  check('Wurf 0,99: kein Funkenflug', !ev.burning(g3, nb3));
  // weit weg (mehr als 2 Felder Lücke): nie
  const far = put(g3, 'haus', i3, a3.x + 8, a3.y, { min: 5, max: 9 });
  g3.rng = () => 0;
  run(g3, 20);
  check('Haus mit mehr als 2 Feldern Lücke fängt nie Feuer', !ev.burning(g3, far));
  void realRng;
}

// ---------- Brandausbruch: Häufigkeit aus / mild / normal, ab 20 Einwohnern, Fluch ----------
{
  const outbreak = (opts: Partial<GameOptions>, residents: number, secs: number, withCurse = false, brigade = true) => {
    const { g, isl, kontor } = world(99, opts);
    if (brigade) g.best[1] = 100; // Feuerwehr baubar (Siedler erreicht)
    const [kx, ky] = g.center(kontor);
    // Feuerwehr direkt am Kontor: Brände gehen aus, das Zählen bleibt sauber
    put(g, 'feuerwehr', isl, kx, ky, { max: 4, ok: (b) => g.linked.has(b.id) });
    const hs: Building[] = [];
    for (let i = 0; i < 6; i++) hs.push(put(g, 'haus', isl, kx + 6, ky, { max: 10 }));
    const per = Math.floor(residents / 6);
    if (withCurse) ev.curse(g, HUMAN, secs + 100);
    let ms = 0, n = 0;
    const end = g.time + secs;
    while (g.time < end) {
      for (const h of hs) if (g.byId.has(h.id)) { h.residents = per; h.happy = 0.9; }
      const t0 = performance.now();
      sys.tick!(g, 1);
      ms += performance.now() - t0; n++;
      g.time += 1;
    }
    return { c: ev.counts(g).feuer, ms: ms / n };
  };
  const aus = outbreak({ ereignisse: 'aus' }, 30, 7200);
  const wenig = outbreak({ ereignisse: 'normal' }, 18, 7200);
  const mild = outbreak({ ereignisse: 'mild' }, 30, 7200);
  const normal = outbreak({ ereignisse: 'normal' }, 30, 7200);
  const fluch = outbreak({ ereignisse: 'mild' }, 30, 7200, true);
  check('„aus“: kein Brand in 2 Stunden', aus.c === 0);
  const frueh = outbreak({ ereignisse: 'mild' }, 30, 7200, false, false);
  check('„mild“: kein Brand, solange noch keine Feuerwehr baubar ist', frueh.c === 0, `${frueh.c}`);
  check('Unter 20 Einwohnern: kein Brand', wenig.c === 0);
  // geschützt (Feuerwehr), zufrieden, locker: halbes Risiko → normal alle 16–30 min, mild alle 32–60 min
  check('„normal“ mit Feuerwehr: 3–8 Brände in 2 Stunden', normal.c >= 3 && normal.c <= 8, `${normal.c}`);
  check('„mild“: etwa halb so oft wie „normal“', mild.c >= 1 && mild.c <= Math.ceil(normal.c * 0.75), `${mild.c} / ${normal.c}`);
  check('Fluch: dreimal so oft (mild mit Fluch > normal)', fluch.c > normal.c && fluch.c >= mild.c * 2.5, `${fluch.c} / mild ${mild.c}`);
  check('Rechenzeit je Sekunde Spielzeit klein (< 0,3 ms)', normal.ms < 0.3, `${normal.ms.toFixed(3)} ms`);
  // ohne Feuerwehr brennt es doppelt so oft
  const { g, isl, kontor } = world(99, { ereignisse: 'normal' });
  const [kx, ky] = g.center(kontor);
  const hs: Building[] = [];
  for (let i = 0; i < 6; i++) hs.push(put(g, 'haus', isl, kx + 6, ky, { max: 10 }));
  let t = 0, first = -1;
  while (t < 3600 && first < 0) {
    for (const h of hs) if (g.byId.has(h.id)) { h.residents = 5; h.happy = 0.9; }
    sys.tick!(g, 1); g.time += 1; t++;
    if (ev.counts(g).feuer) first = t;
  }
  check('Ohne Feuerwehr: erster Brand nach 5–10 Minuten (normal)', first >= 290 && first <= 610, `${first} s`);
}

// ---------- Pest ----------
function plagueTown(seed: number, opts: Partial<GameOptions>, withDoctor: boolean) {
  const w = world(seed, opts);
  const { g, isl, kontor } = w;
  const [kx, ky] = g.center(kontor);
  // dichter Block aus Siedlerhäusern (Wand an Wand)
  const hs: Building[] = [];
  for (let i = 0; i < 24; i++) {
    try { hs.push(put(g, 'haus', isl, kx + 9, ky + 2, { max: 9 })); } catch { break; }
  }
  for (const h of hs) { h.tier = 1; h.residents = 7; h.happy = 0.9; }
  let doc: Building | null = null;
  if (withDoctor) doc = put(g, 'arzt', isl, kx + 9, ky + 2, { min: 3, max: 14 });
  g.recompute();
  const dense = hs.filter((h) => ev.density(g, h) > 15);
  return { ...w, hs, dense, doc };
}
{
  const { g, msgs, hs, dense } = plagueTown(4711, { ereignisse: 'aus' }, false);
  check('Pest: dichter Block (mehr als 15 Häuser im Umkreis 5)', dense.length >= 1, `${dense.length} von ${hs.length}`);
  const h = dense[0] ?? hs[0];
  ev.infect(g, h);
  check('Symbol 💀 über dem Haus', ev.iconFor(g, h) === '💀');
  check('Info: „Pest – Arzt fehlt“', ev.infoLines(g, h).some((s) => s.includes('Pest – Arzt fehlt')));
  const r0 = h.residents;
  for (const o of hs) o.happy = 0.9;
  // Bewohner nicht zuziehen lassen: nur den Ereignis-Teil rechnen
  for (let i = 0; i < 31; i++) { sys.tick!(g, 1); g.time += 1; }
  check('Alle 15 s stirbt ein Bewohner (nach 31 s: −2)', h.residents === r0 - 2, `${r0} → ${h.residents}`);
  g.rng = () => 0; // jede Ansteckung gelingt
  for (let i = 0; i < 15; i++) { sys.tick!(g, 1); g.time += 1; }
  const spread = hs.filter((o) => o !== h && ev.sick(g, o));
  check('Ansteckung im Abstand 3', spread.length > 0, `${spread.length} Nachbarn`);
  const tooFar = hs.filter((o) => ev.sick(g, o) && o !== h).every((o) => {
    const [ax, ay] = g.center(h), [bx, by] = g.center(o);
    return Math.max(0, Math.abs(ax - bx) - 2) <= 3.01 || Math.max(0, Math.abs(ay - by) - 2) <= 3.01;
  });
  check('… nur nahe Häuser', tooFar);
  g.rng = () => 0.99; // keine weitere Ansteckung
  for (let i = 0; i < 40; i++) { sys.tick!(g, 1); g.time += 1; }
  check('Ohne Arzt klingt die Pest nach 75 s ab', !ev.sick(g, h));
  check('Bewohner sinken nie unter 1', hs.every((o) => o.residents >= 1));
  check('Meldungen: keine (Häufigkeit „aus“, nur von Hand angesteckt)', !msgs.some((x) => x.text.startsWith('💀 Pest auf')));
}
{
  const { g, hs, doc, msgs } = plagueTown(4711, { ereignisse: 'aus' }, true);
  const h = hs.find((o) => ev.covered(g, o, 'arzt'))!;
  check('Arzt in Reichweite', !!doc && !!h);
  check('Info des Arztes: „Schützt … vor der Pest“', ev.infoLines(g, doc!).some((s) => s.includes('vor der Pest')));
  ev.infect(g, h);
  check('Info: „der Arzt heilt“', ev.infoLines(g, h).some((s) => s.includes('Arzt heilt')));
  const r0 = h.residents;
  let healed = -1;
  for (let i = 1; i <= 30; i++) { sys.tick!(g, 1); g.time += 1; if (!ev.sick(g, h) && healed < 0) healed = i; }
  check('Mit Arzt geheilt nach ≈ 20 s', healed >= 19 && healed <= 21, `${healed} s`);
  check('… höchstens ein Bewohner gestorben', r0 - h.residents <= 1, `${r0} → ${h.residents}`);
  check('Meldung „⚕️ … geheilt“', msgs.some((x) => x.text.startsWith('⚕️')));
}
{
  // Ausbruch: nur ab Siedlern in dichter Lage; Kirche/Badehaus halbieren
  const { g, hs, dense } = plagueTown(4711, { ereignisse: 'normal' }, false);
  const p = 0.05 * (60 / 600); // je Prüfung bei „normal“
  g.rng = () => p * 0.75; // trifft ohne Kirche, nicht mit Kirche (halbe Chance)
  for (const h of hs) g.coverage.get(h.id)?.add('kirche');
  const h0 = dense[0];
  g.coverage.get(h0.id)?.delete('kirche');
  ev.system.tick!(g, 60.5); // erreicht die Prüfung nach 60 s
  check('Pest-Ausbruch im dichten Haus ohne Kirche', ev.sick(g, h0));
  check('Kirche halbiert das Risiko (andere dichte Häuser bleiben gesund)', dense.filter((h) => h !== h0).every((h) => !ev.sick(g, h)));
  check('Zähler: Pest = 1', ev.counts(g).pest === 1);
  const { g: g2, hs: hs2 } = plagueTown(4711, { ereignisse: 'normal' }, false);
  for (const h of hs2) h.tier = 0;
  g2.rng = () => 0;
  ev.system.tick!(g2, 60.5);
  check('Pioniere bekommen keine Pest', hs2.every((h) => !ev.sick(g2, h)));
  const { g: g3, hs: hs3 } = plagueTown(4711, { ereignisse: 'aus' }, false);
  g3.rng = () => 0;
  ev.system.tick!(g3, 60.5);
  check('„aus“: keine Pest', hs3.every((h) => !ev.sick(g3, h)));
}

// ---------- Kriminalität ----------
{
  const setup = (galgen: boolean, happy: number, tier = 2) => {
    const w = world(4711, { ereignisse: 'normal' });
    const { g, isl, kontor } = w;
    const [kx, ky] = g.center(kontor);
    const hs: Building[] = [];
    for (let i = 0; i < 8; i++) hs.push(put(g, 'haus', isl, kx + 7, ky, { max: 10 }));
    for (const h of hs) { h.tier = tier; h.residents = TIERS[tier].maxResidents; h.happy = happy; }
    let gal: Building | null = null;
    if (galgen) gal = put(g, 'galgen', isl, kx + 7, ky, { max: 12 });
    for (const c of g.carts) { c.g = null; c.n = 0; }
    g.rng = () => 0;
    return { ...w, hs, gal };
  };
  {
    const { g, msgs } = setup(false, 0.3);
    const m0 = g.money;
    ev.system.tick!(g, 60.5);
    check('Diebe stehlen ohne Galgen bei Unzufriedenen (50 Taler bei Wurf 0)', g.money === m0 - 50, `${m0 - g.money}`);
    const m = msgs.find((x) => x.text.startsWith('🦹'));
    check('Meldung „🦹 Diebe …“ mit Ort', !!m && !!m.at, m?.text);
    check('Zähler: Diebe = 1', ev.counts(g).diebe === 1);
  }
  {
    const { g, hs, gal } = setup(true, 0.3);
    const m0 = g.money;
    check('Galgen schützt die Häuser', hs.every((h) => ev.covered(g, h, 'galgen')));
    check('Info des Galgens: „Schützt … vor Dieben“', ev.infoLines(g, gal!).some((s) => s.includes('vor Dieben')));
    ev.system.tick!(g, 60.5);
    check('Mit Galgen kein Diebstahl', g.money === m0);
  }
  {
    const { g } = setup(false, 0.9);
    const m0 = g.money;
    ev.system.tick!(g, 60.5);
    check('Zufriedene Bewohner stehlen nicht', g.money === m0);
  }
  {
    const { g, kontor } = setup(false, 0.3);
    const c = g.carts.find((x) => x.home === kontor.id)!;
    c.g = 'holz'; c.n = 8;
    const m0 = g.money;
    const r = ev.steal(g, HUMAN, g.buildings.find((b) => b.type === 'haus')!);
    check('Diebstahl aus der Karrenladung: 1–3 t', r.tons >= 1 && r.tons <= 3 && c.n === 8 - r.tons && g.money === m0, `${r.tons} t`);
  }
}

// ---------- Dürre: Felder und Weiden stehen, Fischer arbeiten weiter ----------
{
  const { g, isl, kontor, l, msgs } = world(4711, { ereignisse: 'aus' });
  const [kx, ky] = g.center(kontor);
  const fi = put(g, 'fischer', isl, kx, ky, { max: 6, ok: (b) => g.linked.has(b.id) && g.inReach.has(b.id) && b.eff > 0.3 });
  const fa = put(g, 'getreidefarm', isl, kx, ky, { max: 7, ok: (b) => g.linked.has(b.id) && g.inReach.has(b.id) && b.eff > 0.3 });
  const sf = put(g, 'schaffarm', isl, kx, ky, { max: 7, ok: (b) => g.linked.has(b.id) && g.inReach.has(b.id) && b.eff > 0.3 });
  const total = (good: 'getreide' | 'nahrung' | 'wolle', b: Building) => l[good] + b.stock + g.carts.reduce((s, c) => s + (c.g === good ? c.n : 0), 0);
  l.nahrung = 0;
  run(g, 120);
  const g1 = total('getreide', fa), n1 = total('nahrung', fi), w1 = total('wolle', sf);
  check('Vorher: Getreidefarm, Schaffarm und Fischer arbeiten', g1 > 0 && n1 > 0 && w1 > 0, `Getreide ${g1}, Nahrung ${n1}, Wolle ${w1}`);
  ev.startDrought(g, isl, 240);
  check('droughtOn meldet die Dürre', ev.droughtOn(g, isl) && !ev.droughtOn(g, isl + 1));
  check('Meldung „☀️ Dürre …“ mit Ort', msgs.some((x) => x.text.startsWith('☀️ Dürre') && !!x.at));
  check('Symbol ☀️ über Farm und Schaffarm, nicht über dem Fischer', ev.iconFor(g, fa) === '☀️' && ev.iconFor(g, sf) === '☀️' && ev.iconFor(g, fi) === '');
  check('Info: „Dürre“ an der Farm', ev.infoLines(g, fa).some((s) => s.startsWith('☀️ Dürre')));
  run(g, 25); // laufender Arbeitsgang endet
  const g2 = total('getreide', fa), n2 = total('nahrung', fi), w2 = total('wolle', sf);
  run(g, 150);
  const g3 = total('getreide', fa), n3 = total('nahrung', fi), w3 = total('wolle', sf);
  check('Während der Dürre: kein Getreide', g3 === g2, `${g2} → ${g3}`);
  check('Während der Dürre: keine Wolle', w3 === w2, `${w2} → ${w3}`);
  check('Dürre verschont die Fischer (Nahrung wächst weiter)', n3 > n2, `${n2} → ${n3}`);
  check('Felder und Weiden der Insel sind leer', (() => { const [cx, cy] = g.center(fa); return g.feld[g.idx(Math.floor(cx), Math.floor(cy) + 2)] === 0; })());
  // Spielstand mitten in der Dürre
  const g4 = roundTrip(g);
  check('Dürre übersteht Speichern und Laden', ev.droughtOn(g4, isl));
  run(g, 80);
  check('Nach 4 Minuten ist die Dürre vorbei', !ev.droughtOn(g, isl) && msgs.some((x) => x.text.startsWith('🌧️')));
  run(g, 200);
  check('Danach wächst wieder Getreide', total('getreide', fa) > g3);
}
{
  // Dürre kommt von selbst (normal alle 30–50 min) und trifft nur besiedelte Inseln mit Feldern/Weiden
  const { g, isl, kontor } = world(4711, { ereignisse: 'normal' });
  const [kx, ky] = g.center(kontor);
  put(g, 'schaffarm', isl, kx, ky, { max: 9 });
  let t = 0, at = -1;
  while (t < 6000 && at < 0) { sys.tick!(g, 5); g.time += 5; t += 5; if (ev.droughtOn(g, isl)) at = t; }
  check('Erste Dürre von selbst innerhalb von 45–75 Minuten', at >= 2600 && at <= 4600, `${(at / 60).toFixed(1)} min`);
  check('Zähler: Dürre = 1', ev.counts(g).duerre === 1);
  const { g: ga } = world(4711, { ereignisse: 'aus' });
  for (let i = 0; i < 1500; i++) { sys.tick!(ga, 5); ga.time += 5; }
  check('„aus“: keine Dürre in 2 Stunden', ev.counts(ga).duerre === 0);
}

// ---------- Schatz ----------
{
  const { g, isl, kontor, msgs } = world(4711, { ereignisse: 'mild' });
  const [kx, ky] = g.center(kontor);
  const fi = put(g, 'fischer', isl, kx, ky, { max: 8 });
  g.rng = () => 0; // Fund
  ev.system.afterPlace!(g, fi);
  const m0 = g.money;
  for (let i = 0; i < 44; i++) { sys.tick!(g, 1); g.time += 1; }
  check('Schatz erst nach dem Zeitfenster fürs Rückgängigmachen (nach 44 s noch nicht)', g.money === m0);
  for (let i = 0; i < 3; i++) { sys.tick!(g, 1); g.time += 1; }
  check('Schatz gefunden: +1 000 Taler', g.money === m0 + 1000, `${g.money - m0}`);
  const m = msgs.find((x) => x.text.startsWith('💰 Schatz gefunden'));
  check('Meldung „💰 Schatz gefunden“ (Münzklang) mit Ort', !!m && !!m.at && m.kind === 'good', m?.text);
  // zurückgenommen: kein Schatz
  const h = put(g, 'haus', isl, kx + 6, ky, { max: 10 });
  ev.system.afterPlace!(g, h);
  g.forceRemove(h);
  const m1 = g.money;
  for (let i = 0; i < 50; i++) { sys.tick!(g, 1); g.time += 1; }
  check('Zurückgenommener Bau: kein Schatz', g.money === m1);
  // Kontor, Mauern: nie
  ev.system.afterPlace!(g, kontor);
  for (let i = 0; i < 50; i++) { sys.tick!(g, 1); g.time += 1; }
  check('Beim Kontor gibt es keinen Schatz', g.money === m1);
  // Häufigkeit ≈ 1 %
  g.rng = Game.prototype.rng.bind(g);
  let n = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) if (g.rng() < ev.TREASURE.chance) n++;
  check('Fundchance ≈ 1 % je Gebäude', n > N * 0.007 && n < N * 0.013, `${(n / N * 100).toFixed(2)} %`);
  // echtes Bauen ruft afterPlace auf
  const g5 = world(4711).g;
  let calls = 0;
  const orig = ev.system.afterPlace!;
  ev.system.afterPlace = (gg, b) => { calls++; orig(gg, b); };
  const k5 = g5.buildings.find((b) => b.type === 'kontor')!;
  const [k5x, k5y] = g5.center(k5);
  let placed = false;
  for (let dy = -6; dy <= 6 && !placed; dy++) for (let dx = -6; dx <= 6 && !placed; dx++) placed = g5.place('haus', Math.floor(k5x) + dx, Math.floor(k5y) + dy).ok;
  ev.system.afterPlace = orig;
  check('g.place meldet jeden Bau an die Ereignisse (afterPlace)', placed && calls === 1, `${calls}`);
}

// ---------- Fluch ----------
{
  const { g } = world(4711, { ereignisse: 'mild' });
  check('Ohne Fluch: kein Fluch', !ev.cursed(g, HUMAN));
  ev.curse(g, HUMAN);
  check('curse(): Fluch liegt auf dem Spieler', ev.cursed(g, HUMAN));
  const g2 = roundTrip(g);
  check('Fluch übersteht Speichern und Laden', ev.cursed(g2, HUMAN));
  g.time += 1201;
  check('Nach 20 Minuten ist der Fluch vorbei', !ev.cursed(g, HUMAN));
}

// ---------- Spielstand: laufender Brand und Pest, alte Stände ----------
{
  const { g, hs } = plagueTown(4711, { ereignisse: 'aus' }, false);
  ev.ignite(g, hs[0]);
  ev.infect(g, hs[5]);
  run(g, 5);
  const hp = hs[0].hp!;
  const g2 = roundTrip(g);
  const b0 = g2.byId.get(hs[0].id)!, b5 = g2.byId.get(hs[5].id)!;
  check('Brand übersteht Speichern und Laden', ev.burning(g2, b0) && Math.abs((b0.hp ?? 0) - hp) < 0.05);
  check('Pest übersteht Speichern und Laden', ev.sick(g2, b5));
  check('Zähler übersteht Speichern und Laden', JSON.stringify(ev.counts(g2)) === JSON.stringify(ev.counts(g)));
  run(g2, 61);
  check('… und der geladene Brand brennt weiter (abgebrannt)', !g2.byId.has(b0.id));
  const d = JSON.parse(JSON.stringify(g.serialize())) as SaveData;
  delete d.ext?.events;
  let ok = true;
  try { const g3 = Game.fromSave(d); run(g3, 5); ok = !ev.burning(g3, g3.byId.get(hs[0].id)!); } catch (e) { ok = false; console.log(e); }
  check('Alter Spielstand ohne Ereignisse lädt (Standardwerte)', ok);
  // (Zusammenführung) Version 6: Ereignisse, Meldungsverlauf und Bedienung im Spielstand; Version 5 lädt weiter
  check('Spielstand-Version 6', g.serialize().v === 6);
}

// ---------- Leistung: großer Brand in einer großen Stadt ----------
{
  const { g, hs } = plagueTown(4711, { ereignisse: 'normal' }, false);
  for (const h of hs) ev.ignite(g, h);
  for (const h of hs.slice(0, 8)) ev.infect(g, h);
  let ms = 0, n = 0;
  for (let i = 0; i < 400; i++) { const t0 = performance.now(); sys.tick!(g, 0.05); ms += performance.now() - t0; n++; g.time += 0.05; }
  check('Rechenzeit bei vielen Bränden je Rechenschritt < 0,5 ms', ms / n < 0.5, `${(ms / n).toFixed(3)} ms`);
}

console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden');
process.exit(fails ? 1 : 0);
