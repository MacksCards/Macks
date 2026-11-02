// Test der Computergegner ohne Browser (Paket KI2): Charakter, fairer Start, gesperrte Heimatinsel, Tempo,
// Grenzen der Schwierigkeit, Bedarfs-Planer und Warenketten, Feuerwehr/Arzt über die Freigabe, Aufträge beim
// Händler, Kontor verloren (neu gründen oder Piraten), Niederlage ohne brauchbare Schiffe, Reizung → Vorwarnung,
// Soll-Truppen, Ausbildung mit Waffen aus dem Lager und alte Spielstände ohne die neuen Felder.
// Ausführen im Projektordner:
//   npx esbuild scripts/ki-test.ts --bundle --platform=node --outfile=/tmp/ki-test.cjs && node /tmp/ki-test.cjs
// Beendet sich mit Fehlercode 1, wenn eine Prüfung fehlschlägt.
const g0 = globalThis as unknown as Record<string, unknown>;
g0.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
import {
  PERSOENLICHKEITEN, aiPop, canMake, charakter, denkzeit, hausGrenze, persoenlichkeit, popGrenze, reizung, sollTruppen, thinkAI, waffenBedarf,
} from '../src/ai';
import type { Brain } from '../src/ai';
import { checkDefeat, ensurePirates, pirates, spawnUnit, tickAIMilitary } from '../src/combat';
import { BUILDINGS, TIERS } from '../src/data';
import { Game, HUMAN, Player, Ship } from '../src/game';
import { kiGrenzen } from '../src/schwierigkeit';
import { orders } from '../src/trade';
import { T } from '../src/world';

declare const process: { exit(code: number): never };

let fails = 0;
const check = (name: string, cond: boolean, info = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK    ' : 'FEHLER'} ${name}${info ? ' – ' + info : ''}`);
};
const quiet = (g: Game) => { const msgs: string[] = []; g.ev.message = (t: string) => { msgs.push(t); }; return msgs; };
const ai = (g: Game, i = 1) => g.players[i];
const brain = (p: Player) => p.brain as Brain;
/** n Spielsekunden laufen lassen */
const run = (g: Game, sec: number, dt = 0.25) => { for (let i = 0; i < sec / dt; i++) g.tick(dt); };

// ---------- 1. Charakter ----------
{
  const g = Game.create(1, 3);
  const names = g.players.filter((p) => p.ai).map((p) => persoenlichkeit(p).id);
  check('drei Gegner mit drei Charakteren (Händler, Eroberin, Baumeister)', names.join() === 'haendler,eroberin,baumeister', names.join());
  const c = charakter(g, 2);
  check('Text für das Diplomatie-Fenster: Titel, Beschreibung, Stimmung', !!c && c.titel === 'Eroberin' && c.text.length > 40 && c.stimmung === 'Ist friedlich.', JSON.stringify(c));
  check('kein Text für den Spieler selbst', charakter(g, HUMAN) === null);
  check('Baumeister denkt schneller (baut schneller)', denkzeit(ai(g, 3)) < denkzeit(ai(g, 1)));
  check('Eroberin rüstet früh, Händler nur bei Anlass', PERSOENLICHKEITEN.eroberin.ruestetFrueh && PERSOENLICHKEITEN.haendler.krieg === 0 && PERSOENLICHKEITEN.eroberin.kriegAb < PERSOENLICHKEITEN.baumeister.kriegAb);
  const texts = Object.values(PERSOENLICHKEITEN).map((p) => p.text).join(' ');
  check('Texte ohne Anno und ohne Fachwörter', !/anno|KI\b|AI\b/i.test(texts));
}

// ---------- 2. Fairer Start: frühestens nach 3 Minuten, nie die Heimatinsel des Spielers, nahe der Startecke ----------
{
  const g = Game.create(2, 3);
  quiet(g);
  run(g, 170);
  check('in den ersten 3 Minuten wählt kein Gegner eine Insel', g.players.filter((p) => p.ai).every((p) => brain(p).island < 0 && brain(p).phase === 'suchen'));
  run(g, 260);
  const picks = g.players.filter((p) => p.ai).map((p) => brain(p).island);
  check('nach spätestens 6 Minuten haben alle eine Insel', picks.every((i) => i >= 0), picks.join());
  const home = g.islands.find((i) => i.heimat);
  check('keiner wählt die Heimatinsel des Spielers', !!home && picks.every((i) => i !== home.id));
  const near = g.players.filter((p) => p.ai).every((p) => { const isl = g.islands[brain(p).island]; const [sx, sy] = g.starts[p.id]; return Math.hypot(isl.cx - sx, isl.cy - sy) < 150; });
  check('Inseln nahe der eigenen Startecke', near);
  // sobald der Spieler ein Kontor hat, startet die Wahl sofort
  const g2 = Game.create(2, 3);
  quiet(g2);
  const isl = home!;
  let placed = false;
  for (let y = isl.y0; y <= isl.y1 && !placed; y++) for (let x = isl.x0; x <= isl.x1 && !placed; x++) {
    if (g2.canPlace('kontor', x, y, HUMAN, true).ok) { g2.placeNeutral('kontor', x, y, HUMAN); placed = true; }
  }
  run(g2, 20);
  check('nach dem ersten Kontor des Spielers wählen die Gegner sofort', placed && g2.players.filter((p) => p.ai).some((p) => brain(p).island >= 0));
}

// ---------- 3. Tempo und Grenzen der Schwierigkeit ----------
{
  const g = Game.create(3, 3, { schwierigkeit: 'normal' });
  check('Einwohnergrenze ohne Spieler-Einwohner: 150', popGrenze(g) === 150, String(popGrenze(g)));
  g.popByTier = () => [100, 0, 0, 0, 0];
  check('Einwohnergrenze bei 100 Spieler-Einwohnern: 280', popGrenze(g) === 280, String(popGrenze(g)));
  const leicht = Game.create(3, 3, { schwierigkeit: 'leicht' }), schwer = Game.create(3, 3, { schwierigkeit: 'schwer' });
  check('leicht: bis Bürger, 1–2 Inseln, spät; schwer: bis Aristokraten, bis 4 Inseln, mehr Soldaten',
    kiGrenzen(leicht).stufe === 2 && kiGrenzen(leicht).inseln[1] === 2 && kiGrenzen(leicht).angriff === 'spaet'
    && kiGrenzen(schwer).stufe === 4 && kiGrenzen(schwer).inseln[1] === 4 && kiGrenzen(schwer).truppen > kiGrenzen(g).truppen);
  const big = g.islands.reduce((a, i) => (i.land > a.land ? i : a)), small = g.islands.reduce((a, i) => (i.land < a.land ? i : a));
  check('Hausgrenze nach Inselgröße (40 bis 110)', hausGrenze(g, small.id) === 40 && hausGrenze(g, big.id) > 40 && hausGrenze(g, big.id) <= 110, `${hausGrenze(g, small.id)} / ${hausGrenze(g, big.id)}`);
}

// ---------- 4. Ketten: was wächst wo? ----------
{
  const g = Game.create(1, 3);
  const p = ai(g, 1);
  const wein = g.islands.find((i) => (i.frucht.wein ?? 0) > 0 && !(i.frucht.zuckerrohr ?? 0))!;
  const ohne = g.islands.find((i) => !(i.frucht.tabak ?? 0))!;
  check('Alkohol geht auf einer Wein-Insel (später, sobald freigeschaltet)', canMake(g, p, 'alkohol', wein.id, false));
  check('Tabakwaren gehen nicht ohne Tabak', !canMake(g, p, 'tabakwaren', ohne.id, false));
  check('ohne Siedler ist noch nichts davon freigeschaltet', !canMake(g, p, 'alkohol', wein.id, true));
}

// ---------- 5. Aufbau über 25 Minuten: Kontor, Planer, Aufträge, keine Pleite ----------
{
  const g = Game.create(42, 3);
  quiet(g);
  g.popByTier = () => [Math.min(400, g.time / 6), 0, 0, 0, 0];
  run(g, 25 * 60);
  const rivals = g.players.filter((p) => p.ai);
  check('alle Gegner haben nach 25 Minuten ein Kontor', rivals.every((p) => !!g.kontor(p.id)));
  check('niemand im Minus', rivals.every((p) => p.money >= 0), rivals.map((p) => Math.round(p.money)).join());
  check('jeder hat mindestens 100 Einwohner', rivals.every((p) => aiPop(g, p.id) >= 100), rivals.map((p) => aiPop(g, p.id)).join());
  const ord = rivals.flatMap((p) => { const k = g.kontor(p.id, brain(p).island); return k ? orders(g, k) : []; });
  check('die Gegner stellen Aufträge beim Händler ein', ord.length > 0, ord.map((o) => `${o.buy ? '+' : '-'}${o.g}`).join(' '));
  check('Gegner bauen mehr als nur Holz, Nahrung und Stoffe', rivals.some((p) => new Set(g.buildings.filter((b) => b.owner === p.id).map((b) => b.type)).size >= 9));
}

// ---------- 6. Feuerwehr und Arzt erst, wenn ihr Spielteil sie freigibt ----------
{
  const g = Game.create(42, 3);
  quiet(g);
  g.popByTier = () => [300, 0, 0, 0, 0];
  run(g, 20 * 60);
  const before = g.buildings.some((b) => b.type === 'feuerwehr' && b.owner !== HUMAN);
  const ready = g.isReady.bind(g);
  g.isReady = (t) => t === 'feuerwehr' || ready(t);
  g.isUnlocked = (t) => t === 'feuerwehr' || Game.prototype.isUnlocked.call(g, t);
  for (const p of g.players) if (p.ai) p.money = Math.max(p.money, 9000);
  run(g, 4 * 60);
  const after = g.buildings.filter((b) => b.type === 'feuerwehr' && b.owner !== HUMAN).length;
  check('ohne Freigabe baut kein Gegner eine Feuerwehr', !before);
  check('nach der Freigabe bauen Gegner Feuerwehren', after > 0, `${after}`);
}

// ---------- 7. Kontor verloren: mit Material neu gründen, sonst Piraten; Niederlage ohne brauchbare Schiffe ----------
{
  const g = Game.create(5, 1);
  const msgs = quiet(g);
  ensurePirates(g);
  const p = ai(g, 1);
  run(g, 9 * 60);
  const k = g.kontor(p.id);
  check('Gegner hat ein Kontor', !!k);
  // Kontor verloren, Schiff hat noch Baumaterial
  const ship = g.ships.find((s) => s.owner === p.id)!;
  ship.slots = [{ g: 'holz', n: 20 }, { g: 'werkzeug', n: 10 }, { g: null, n: 0 }, { g: null, n: 0 }];
  g.forceRemove(k!);
  checkDefeat(g, p.id, HUMAN);
  check('mit Material an Bord nicht besiegt', !p.defeated);
  for (let i = 0; i < 20; i++) thinkAI(g, p, 3);
  check('Phase „suchen“: neues Kontor wird geplant', brain(p).phase !== 'aufbau' || !!g.kontor(p.id), brain(p).phase);
  // ohne Material und ohne Kontor: Schiffe werden Piraten, Gegner scheidet aus
  const g2 = Game.create(5, 1);
  const m2 = quiet(g2);
  ensurePirates(g2);
  const q = ai(g2, 1);
  run(g2, 9 * 60);
  for (const s of g2.ships) if (s.owner === q.id) s.slots = s.slots.map(() => ({ g: null, n: 0 }));
  for (const b of g2.buildings.filter((o) => o.owner === q.id && o.type === 'kontor')) g2.forceRemove(b);
  for (let i = 0; i < 4; i++) thinkAI(g2, q, 3);
  const pir = pirates(g2)!;
  check('ohne Kontor und Material: Schiff segelt unter Piratenflagge', g2.ships.some((s) => s.owner === pir.id && s.name === 'Seeadler') && !g2.ships.some((s) => s.owner === q.id));
  check('… und der Gegner scheidet aus (mit Meldung)', !!q.defeated && m2.some((t) => t.includes('Piratenflagge')), m2.filter((t) => t.includes(q.name)).join(' | '));
  // checkDefeat: leere, unbewaffnete Schiffe zählen nicht mehr
  const g3 = Game.create(5, 1);
  quiet(g3);
  const r = ai(g3, 1);
  for (const s of g3.ships) if (s.owner === r.id) s.slots = s.slots.map(() => ({ g: null, n: 0 }));
  checkDefeat(g3, r.id, HUMAN);
  check('Gegner ohne Kontor mit leerem, unbewaffnetem Schiff ist besiegt', !!r.defeated);
  const g4 = Game.create(5, 1);
  quiet(g4);
  const r4 = ai(g4, 1);
  for (const s of g4.ships) if (s.owner === r4.id) { s.slots = s.slots.map(() => ({ g: null, n: 0 })); s.guns = 4; }
  checkDefeat(g4, r4.id, HUMAN);
  check('… mit bewaffnetem Schiff nicht', !r4.defeated);
  const me = g4.players[HUMAN];
  for (const s of g4.ships) if (s.owner === HUMAN) s.slots = s.slots.map(() => ({ g: null, n: 0 }));
  checkDefeat(g4, HUMAN, 1);
  check('der Spieler behält sein leeres Schiff (das Rettungsschiff-Verfahren bleibt)', !me.defeated);
  void msgs;
}

// ---------- 8. Reizung → Ärger → Vorwarnung (auch beim friedlichen Händler) ----------
{
  const g = Game.create(5, 1);
  const msgs = quiet(g);
  run(g, 9 * 60);
  const p = ai(g, 1);
  const k = g.kontor(p.id)!;
  // bewaffnetes Schiff des Spielers direkt vor dem Kontor
  const me = g.ships.find((s) => s.owner === HUMAN)!;
  const [kx, ky] = g.center(k);
  let spot: [number, number] | null = null;
  for (let r = 2; r < 6 && !spot; r++) for (let y = Math.floor(ky) - r; y <= ky + r && !spot; y++) for (let x = Math.floor(kx) - r; x <= kx + r && !spot; x++) if (g.inMap(x, y) && g.isWater(g.idx(x, y))) spot = [x, y];
  me.x = spot![0] + 0.5; me.y = spot![1] + 0.5; me.guns = 6;
  const why = reizung(g, p, 5, () => false);
  check('Kriegsschiff vor dem Kontor reizt', why === 'weil dein Kriegsschiff vor seinem Kontor kreuzt', String(why));
  for (let i = 0; i < 6; i++) reizung(g, p, 5, () => false);
  check('Ärger steigt bis über die Geduld des Händlers', (brain(p).aerger ?? 0) >= persoenlichkeit(p).geduld, String(brain(p).aerger));
  // Vorwarnung braucht positive Bilanz und etwas Militär: ein Soldat
  const [ux, uy] = g.center(k);
  spawnUnit(g, 'infanterie', p.id, Math.floor(ux) + 3, Math.floor(uy) + 3);
  p.money = 20000;
  let warned = false;
  for (let i = 0; i < 40 && !warned; i++) { reizung(g, p, 5, () => false); tickAIMilitary(g); warned = p.warnAt !== undefined; }
  check('nach anhaltender Reizung warnt auch der Händler vor dem Krieg', warned, msgs.filter((t) => t.includes('⚠️')).join(' | '));
  check('die Vorwarnung nennt den Grund', msgs.some((t) => t.includes('Kriegsschiff vor seinem Kontor')));
  // ohne Reizung sinkt der Ärger wieder
  me.guns = 0;
  const a0 = brain(p).aerger ?? 0;
  for (let i = 0; i < 10; i++) reizung(g, p, 5, () => false);
  check('ohne Reizung sinkt der Ärger', (brain(p).aerger ?? 0) < a0);
  // weiße Flagge reizt nicht
  me.guns = 6;
  check('mit weißer Flagge keine Reizung', reizung(g, p, 5, () => true) === null);
}

// ---------- 9. Soll-Truppen und Ausbildung mit Waffen aus dem Lager ----------
{
  const g = Game.create(5, 3);
  quiet(g);
  const p = ai(g, 2);
  check('vor 200 Siedlern keine Soll-Truppen', sollTruppen(g, p) === 0);
  run(g, 9 * 60);
  const k = g.kontor(p.id)!;
  // 210 Siedler auf der Insel (Testaufbau: 30 Häuser à 7)
  let n = 0;
  for (let y = k.y - 16; y < k.y + 16 && n < 30; y += 2) for (let x = k.x - 16; x < k.x + 16 && n < 30; x += 2) {
    if (!g.inMap(x, y) || g.islandOf[g.idx(x, y)] !== k.island) continue;
    const h = g.placeNeutral('haus', x, y, p.id);
    if (h) { h.tier = 1; h.residents = 7; n++; }
  }
  g.recompute();
  const soll = sollTruppen(g, p);
  check('ab 200 Siedlern 6 bis 30 Soll-Truppen', soll >= 6 && soll <= 30, `${soll} bei ${n} Häusern`);
  check('Eroberin will mehr Soldaten als der Händler', sollTruppen(g, p) > sollTruppen(g, { ...ai(g, 1), id: p.id, name: 'Hendrik van Dalen' }));
  check('Waffenbedarf: Schwerter für die fehlenden Soldaten', (waffenBedarf(g, p).schwerter ?? 0) > 0);
  const [bx, by] = g.center(k);
  let burg = null;
  for (let r = 4; r < 14 && !burg; r++) for (let y = Math.floor(by) - r; y <= by + r && !burg; y++) for (let x = Math.floor(bx) - r; x <= bx + r && !burg; x++) burg = g.placeNeutral('burg', x, y, p.id);
  const l = g.lagerOf(p.id, k.island)!;
  l.schwerter = 6;
  p.money = 20000;
  tickAIMilitary(g);
  check('Burg bildet mit Schwertern aus dem Lager aus (Waffen werden verbraucht)', !!burg && (burg.train?.length ?? 0) > 0 && l.schwerter < 6, `Ausbildung ${burg?.train?.length ?? 0}, Schwerter ${l.schwerter}`);
}

// ---------- 10. Alte Spielstände: Gedächtnis ohne die neuen Felder ----------
{
  const g = Game.create(7, 3);
  quiet(g);
  run(g, 9 * 60);
  const d = JSON.parse(JSON.stringify(g.serialize()));
  for (const p of d.players) if (p.brain) for (const k of Object.keys(p.brain)) if (!['phase', 'island', 't', 'tries', 'grid', 'site', 'bad'].includes(k)) delete p.brain[k];
  const h = Game.fromSave(d);
  quiet(h);
  let ok = true;
  try { run(h, 120); } catch (e) { ok = false; console.log(e); }
  check('alter Stand ohne KI2-Felder lädt und läuft weiter', ok && h.players.filter((p) => p.ai).every((p) => brain(p).phase === 'aufbau' || brain(p).phase === 'suchen'));
}

// ---------- 11. Rechenzeit ----------
{
  const g = Game.create(99, 3);
  quiet(g);
  g.popByTier = () => [300, 0, 0, 0, 0];
  run(g, 15 * 60);
  const times: number[] = [];
  for (let i = 0; i < 2400; i++) { const t0 = performance.now(); g.tick(0.25); times.push(performance.now() - t0); }
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  check('Spielschritt mit drei wachsenden Gegnern im Mittel unter 3 ms', mean < 3, `Mittel ${mean.toFixed(2)} ms, 99 % unter ${times[Math.floor(times.length * 0.99)].toFixed(2)} ms, höchstens ${times[times.length - 1].toFixed(1)} ms`);
}

void T; void BUILDINGS; void TIERS; void (null as unknown as Ship);
console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden');
if (fails) process.exit(1);
