// Simulation der Computergegner ohne Browser – misst, ob sie wachsen, siedeln und rüsten wie geplant (Paket KI2).
//
// Was passiert: Viele Zufallswelten mit je drei Computergegnern (Händler, Eroberin, Baumeister) laufen bis zu
// 120 Spielminuten. Der Spieler baut selbst nichts; damit das Tempo der Gegner (höchstens Spieler-Einwohner
// × 1,3 + 150) trotzdem wie im Spiel wirkt, folgen seine Einwohner einer Kurve eines zügigen Spielers
// (SPIELER unten: 150 nach 30, 400 nach 60, 700 nach 90, 1 000 nach 120 Minuten; Burg und Türme ab Minute 40).
// Mit --passiv bleibt der Spieler bei 0 Einwohnern – dann zeigt die Simulation, dass die Gegner nicht davonziehen.
// Zu festen Zeitpunkten (20, 60, 90, 120 min) wird gezählt: Kasse, Einwohner, Häuser je Stufe, Kontore,
// Soldaten, Kriegsschiffe, Betriebe am Wegenetz, Hunger. Dazu die erste Vorwarnung jedes Gegners (Charakter).
//
// Ziele (Schwierigkeit „normal“, Spieler nach der Kurve):
//  - nach 60 min im Mittel mindestens 300 Einwohner, Kasse über 0 (höchstens 10 % im Minus),
//  - nach 90 min die ersten Bürger (mindestens 80 % der Gegner),
//  - nach 120 min mindestens eine zweite Insel (mindestens 80 % der Gegner),
//  - die Eroberin warnt im Mittel früher vor einem Krieg als der Händler,
//  - Rechenzeit: eine Bau-Entscheidung im Mittel unter 0,5 ms; der Anfangsstoß unter 5 ms.
// Rechenzeit je Spielschritt: gemessen wird der ganze Schritt (Spiel + KI) und die KI allein (Bau-Entscheidung
// und Militär). Die Spitzen werden genannt.
//
// Starten (im Projektordner):
//   npx esbuild scripts/ki-sim.ts --bundle --platform=node --outfile=dist/ki-sim.cjs && node --expose-gc dist/ki-sim.cjs
// Optionen: --welten 12   --minuten 120   --wdh 3 (Wiederholungen der Startmessung)   --stufe leicht|normal|schwer
//           --passiv (Spieler ohne Einwohner)   --schnell (4 Welten, 60 min)   --liste (jede KI einzeln)
// Der Zufall ist je Welt fest eingestellt: gleiche Optionen ergeben gleiche Zahlen (bis auf die Zeiten).
// --expose-gc räumt vor jeder Welt den Speicher auf, damit Reste der vorigen Welt die Zeiten nicht verfälschen.
// Zeiten: der kleinere Wert aus Wanduhr und Rechenzeit des Prozesses.

import { BUILDINGS, TIERS } from '../src/data';
import { Game, HUMAN, Player } from '../src/game';
import { denkzeit, persoenlichkeit, popGrenze, thinkAI } from '../src/ai';
import type { Brain } from '../src/ai';
import { tickAIMilitary } from '../src/combat';
import { rng } from '../src/world';
import type { Schwierigkeit } from '../src/game';

declare const process: { argv: string[]; exitCode?: number; cpuUsage(prev?: { user: number; system: number }): { user: number; system: number } };

// Ohne Browser gibt es keinen Speicher – das Spiel braucht ihn hier auch nicht.
const G = globalThis as unknown as Record<string, unknown>;
G.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };

const arg = (name: string, def: number): number => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? Number(process.argv[i + 1]) : def;
};
const sarg = (name: string, def: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : def;
};
const flag = (name: string) => process.argv.includes(`--${name}`);
const QUICK = flag('schnell');
const WORLDS = arg('welten', QUICK ? 4 : 12);
const MINUTES = arg('minuten', QUICK ? 60 : 120);
const REPS = Math.max(1, arg('wdh', 3));
const LIST = flag('liste');
const PASSIV = flag('passiv');
const STUFE = sarg('stufe', 'normal') as Schwierigkeit;
const DT = 0.25; // wie im Spiel: Sekunden Spielzeit je Rechenschritt
const MARKS = [20, 60, 90, 120].filter((m) => m <= MINUTES);
if (!MARKS.includes(MINUTES)) MARKS.push(MINUTES);
const SEEDS = [1, 2, 3, 42, 99, 123, 777, 2024, 31337, 4711, 5555, 8080, 9999, 12345, 54321, 65432, 70000, 99999, 815657, 871090];
const seedOf = (i: number) => (i < SEEDS.length ? SEEDS[i] : 1000003 + i * 7919);

/** Einwohner eines zügigen Spielers (Minute → Einwohner), dazwischen gerade Linien */
const SPIELER: [number, number][] = [[0, 0], [5, 0], [30, 150], [60, 400], [90, 700], [120, 1000]];
function spielerEinwohner(min: number): number {
  if (PASSIV) return 0;
  for (let i = 1; i < SPIELER.length; i++) {
    const [m0, v0] = SPIELER[i - 1], [m1, v1] = SPIELER[i];
    if (min <= m1) return v0 + ((v1 - v0) * (min - m0)) / (m1 - m0);
  }
  return SPIELER[SPIELER.length - 1][1];
}

/** Rechenzeit einer Funktion in ms (kleinerer Wert aus Wanduhr und Prozess-Rechenzeit) */
function timed(fn: () => void): number {
  const c0 = process.cpuUsage(), a = performance.now();
  fn();
  const wall = performance.now() - a, c = process.cpuUsage(c0);
  return Math.min(wall, (c.user + c.system) / 1000);
}

interface World { g: Game; ais: Player[]; rec: { ms: number }; milT: number }

/** Neue Welt wie im Spiel; Kampf und Piraten würfeln – hier je Welt immer gleich.
 *  shift > 0 belegt vorher etwas Speicher, damit die Speicherbereinigung bei jeder Wiederholung
 *  an einer anderen Stelle einsetzt (sonst träfe sie immer denselben Denkschritt). */
function newWorld(seed: number, shift = 0): World {
  const gc = (globalThis as { gc?: () => void }).gc;
  gc?.();
  Math.random = rng(seed * 31 + 7);
  const g = Game.create(seed, 3, { schwierigkeit: STUFE });
  g.ev.message = () => {};
  // Einwohner des Spielers nach der Kurve (für das Tempo der Gegner und die Statistik)
  g.popByTier = () => { const r = TIERS.map(() => 0); r[0] = spielerEinwohner(g.time / 60); return r; };
  gc?.();
  const junk: number[][] = [];
  for (let i = 0; i < shift * 3000; i++) junk.push([i, i]);
  junk.length = 0;
  const rec = { ms: 0 };
  const recompute = g.recompute.bind(g);
  g.recompute = () => { rec.ms += timed(recompute); };
  return { g, ais: g.players.filter((p) => p.ai && p.brain), rec, milT: 0 };
}

interface StepTimes { all: number; ai: number; mil: number }

/** Was der Gegner im nächsten Denkschritt tut (für die Liste der langsamsten Entscheidungen) */
function art(g: Game, p: Player): string {
  const b = p.brain as Brain;
  if (b.phase !== 'aufbau') return b.phase;
  const turn = (b.turn ?? 0) + 1;
  if (b.erw && turn % 2 === 0) return `erweitern:${b.erw.step}`;
  if (g.buildings.some((o) => o.type === 'kontor' && o.owner === p.id && o.island !== b.island) && turn % 3 === 0) return 'kolonie';
  return 'heimat';
}

/** Ein Spielschritt. Die KI wird hier selbst aufgerufen (statt in g.tick), damit ihre Zeit genau messbar ist:
 *  Bau-Entscheidungen (thinkAI) jeden Schritt, das Militär (tickAIMilitary) alle 5 Spielsekunden wie im Spiel.
 *  Für jede echte Entscheidung (Denkzeit erreicht) kommt ein Rückruf. */
function step(w: World, onDecision: (p: Player, phase: string, ms: number, recMs: number, kind: string) => void): StepTimes {
  const { g, ais, rec } = w;
  // Spieler kann sich ab Minute 40 wehren (Burg und Türme) – wie ein zügiger Spieler
  if (!PASSIV && g.time >= 2400 && g.players[HUMAN].defendAt === undefined) g.players[HUMAN].defendAt = 2400;
  const brains = ais.map((p) => p.brain);
  for (const p of ais) p.brain = undefined;
  const tickMs = timed(() => g.tick(DT));
  ais.forEach((p, i) => { p.brain = brains[i]; });
  let ai = 0;
  for (const p of ais) {
    const before = p.brain!.t, phase = p.brain!.phase, kind = art(g, p);
    rec.ms = 0;
    const d = timed(() => thinkAI(g, p, DT));
    ai += d;
    if (before + DT >= denkzeit(p) - 1e-9 && p.brain!.t < before + DT - 1e-9) onDecision(p, phase, d, rec.ms, kind);
  }
  let mil = 0;
  w.milT += DT;
  if (w.milT > 5) { w.milT = 0; mil = timed(() => tickAIMilitary(g)); }
  return { all: tickMs + ai + mil, ai: ai + mil, mil };
}

interface Row {
  welt: number; name: string; art: string; geld: number; einw: number; grenze: number; haeuser: number; stufen: number[];
  kontore: number; soldaten: number; kriegsschiffe: number; schiffe: number;
  betriebe: number; angeschl: number; arbeiten: number; hunger: number; arten: number;
}
function snapshot(g: Game, w: number, p: Player): Row {
  const bs = g.buildings.filter((b) => b.owner === p.id);
  const prod = bs.filter((b) => BUILDINGS[b.type].prod);
  const houses = bs.filter((b) => b.type === 'haus');
  const stufen = TIERS.map((_, t) => houses.filter((h) => h.tier === t).length);
  return {
    welt: w, name: p.name, art: persoenlichkeit(p).titel, geld: p.money,
    einw: houses.reduce((a, b) => a + b.residents, 0), grenze: popGrenze(g),
    haeuser: houses.length, stufen,
    kontore: bs.filter((b) => b.type === 'kontor').length,
    soldaten: g.units.filter((u) => u.owner === p.id).length,
    kriegsschiffe: g.ships.filter((s) => s.owner === p.id && (s.type ?? '').startsWith('krieg')).length,
    schiffe: g.ships.filter((s) => s.owner === p.id).length,
    betriebe: prod.length,
    angeschl: prod.filter((b) => g.linked.has(b.id)).length,
    arbeiten: prod.filter((b) => b.status === 'ok').length,
    hunger: houses.filter((b) => b.short.nahrung).length,
    arten: new Set(bs.map((b) => b.type)).size,
  };
}

const real0 = performance.now();

// ---------- 1. Anfangsstoß: Start jeder Welt mehrmals, je Denkschritt die kürzeste Zeit ----------
const startMax: number[] = [];
const startMaxAll: number[] = [];
const founded: number[] = [];
let startCold = 0, startColdAll = 0, notFounded = 0;
for (let w = 0; w < WORLDS; w++) {
  const best = new Map<string, number>(), bestAll = new Map<string, number>();
  for (let r = 0; r < REPS; r++) {
    const world = newWorld(seedOf(w), r);
    const count = new Map<number, number>(), done = new Map<number, number>();
    while (world.g.time < 900 && done.size < world.ais.length) {
      step(world, (p, phase, ms, recMs) => {
        if (done.has(p.id)) return;
        const i = (count.get(p.id) ?? 0) + 1;
        count.set(p.id, i);
        const key = `${p.id}:${i}`, own = Math.max(0, ms - recMs);
        best.set(key, Math.min(best.get(key) ?? Infinity, own));
        bestAll.set(key, Math.min(bestAll.get(key) ?? Infinity, ms));
        if (w === 0 && r === 0) { startCold = Math.max(startCold, own); startColdAll = Math.max(startColdAll, ms); }
        if (phase !== 'aufbau' && p.brain!.phase === 'aufbau') done.set(p.id, world.g.time);
      });
    }
    if (r === 0) { founded.push(...done.values()); notFounded += world.ais.length - done.size; }
  }
  startMax.push(Math.max(0, ...best.values()));
  startMaxAll.push(Math.max(0, ...bestAll.values()));
}

// ---------- 2. Wachstum, Inseln, Militär über die ganze Spielzeit ----------
const rows = new Map<number, Row[]>(MARKS.map((m) => [m, []]));
const plan: number[] = []; // Bau-Entscheidungen: Rechenzeit der KI selbst (ohne Neuberechnung des Spiels)
const full: number[] = []; // Bau-Entscheidungen inklusive Neuberechnung nach dem Bauen
const allMs: number[] = []; // ganzer Spielschritt (Spiel + KI)
const aiMs: number[] = []; // KI je Spielschritt (Entscheidungen + Militär)
const milMs: number[] = []; // Militär der KI (alle 5 Spielsekunden)
const warn = new Map<string, number[]>(); // Charakter → Minute der ersten Vorwarnung (Infinity = keine)
const slow: { ms: number; kind: string; min: number; welt: number }[] = []; // langsamste Entscheidungen
let maxOver = 0; // größte Überschreitung der Einwohnergrenze (Anteil)
for (let w = 0; w < WORLDS; w++) {
  const world = newWorld(seedOf(w));
  const first = new Map<number, number>();
  let mark = 0;
  while (mark < MARKS.length) {
    const t = step(world, (_p, phase, d, recMs, kind) => {
      if (phase === 'aufbau') { plan.push(Math.max(0, d - recMs)); full.push(d); }
      if (d - recMs > 4) { slow.push({ ms: d - recMs, kind, min: world.g.time / 60, welt: w }); slow.sort((a, b) => b.ms - a.ms); slow.length = Math.min(slow.length, 8); }
    });
    allMs.push(t.all); aiMs.push(t.ai);
    if (t.mil) milMs.push(t.mil);
    for (const p of world.ais) if (!first.has(p.id) && (p.warnAt !== undefined || (p.war ?? []).includes(HUMAN))) first.set(p.id, world.g.time / 60);
    if (world.g.time >= MARKS[mark] * 60 - 1e-6) {
      for (const p of world.ais) {
        const r = snapshot(world.g, w, p);
        rows.get(MARKS[mark])!.push(r);
        if (MARKS[mark] >= 60) maxOver = Math.max(maxOver, r.einw / r.grenze - 1);
      }
      mark++;
    }
  }
  for (const p of world.ais) {
    const k = persoenlichkeit(p).titel;
    if (!warn.has(k)) warn.set(k, []);
    warn.get(k)!.push(first.get(p.id) ?? Infinity);
  }
  if (LIST) for (const m of MARKS) for (const r of rows.get(m)!.filter((y) => y.welt === w)) {
    console.log(`  Welt ${r.welt} nach ${m} min ${r.name.padEnd(18)} ${r.art.padEnd(10)} Geld ${Math.round(r.geld).toString().padStart(6)} · Einw ${r.einw}/${Math.round(r.grenze)} · Häuser ${r.haeuser} [${r.stufen.join('/')}] · Kontore ${r.kontore} · Soldaten ${r.soldaten} · Kriegsschiffe ${r.kriegsschiffe} · Betriebe ${r.betriebe}/${r.angeschl}/${r.arbeiten} · Hunger ${r.hunger}`);
  }
}

// ---------- Auswertung ----------
const de = (v: number, d = 0) => (Number.isFinite(v) ? v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) : 'nie');
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
const goals: [string, boolean][] = [];

console.log(`\nComputergegner-Simulation: ${WORLDS} Welten × 3 Gegner, ${MINUTES} Spielminuten, Schwierigkeit „${STUFE}“, Spieler ${PASSIV ? 'passiv (0 Einwohner)' : 'nach der Kurve'}`);
for (const m of MARKS) {
  const r = rows.get(m)!;
  const minus = r.filter((x) => x.geld < 0).length;
  const pop = r.map((x) => x.einw);
  const hungry = r.reduce((a, x) => a + x.hunger, 0) / Math.max(1, r.reduce((a, x) => a + x.haeuser, 0));
  const tiers = TIERS.map((_, t) => avg(r.map((x) => x.stufen[t])));
  const buerger = r.filter((x) => x.stufen.slice(2).some((n) => n > 0)).length;
  const two = r.filter((x) => x.kontore >= 2).length;
  console.log(`\nNach ${m} min (Grenze der Einwohner ${de(r[0]?.grenze ?? 0)}):`);
  console.log(`  im Minus ${minus} von ${r.length} · Geld Ø ${de(avg(r.map((x) => x.geld)))}, kleinstes ${de(Math.min(...r.map((x) => x.geld)))}`);
  console.log(`  Einwohner Ø ${de(avg(pop))} (kleinste ${Math.min(...pop)}, größte ${Math.max(...pop)}) · Häuser Ø ${de(avg(r.map((x) => x.haeuser)), 1)} – je Stufe ${tiers.map((v) => de(v, 1)).join(' / ')}`);
  console.log(`  mit Bürgern ${buerger}/${r.length} · mit zweiter Insel ${two}/${r.length} · Kontore Ø ${de(avg(r.map((x) => x.kontore)), 1)} · Soldaten Ø ${de(avg(r.map((x) => x.soldaten)), 1)} · Kriegsschiffe Ø ${de(avg(r.map((x) => x.kriegsschiffe)), 1)} · Schiffe Ø ${de(avg(r.map((x) => x.schiffe)), 1)}`);
  console.log(`  Betriebe Ø ${de(avg(r.map((x) => x.betriebe)), 1)}, am Wegenetz ${de(avg(r.map((x) => x.angeschl)), 1)}, arbeiten ${de(avg(r.map((x) => x.arbeiten)), 1)} · Häuser mit Hunger ${de(hungry * 100)} % · Gebäudearten Ø ${de(avg(r.map((x) => x.arten)), 1)}`);
  if (m === 60 && !PASSIV && STUFE === 'normal') {
    goals.push([`nach 60 min im Mittel mindestens 300 Einwohner (${de(avg(pop))})`, avg(pop) >= 300]);
    goals.push([`nach 60 min Kasse über 0 (im Minus: ${minus}/${r.length}, höchstens 10 %)`, minus <= r.length * 0.1]);
  }
  if (m === 90 && !PASSIV && STUFE === 'normal') goals.push([`nach 90 min die ersten Bürger (${buerger}/${r.length}, mindestens 80 %)`, buerger >= r.length * 0.8]);
  if (m === 120 && !PASSIV && STUFE === 'normal') goals.push([`nach 120 min eine zweite Insel (${two}/${r.length}, mindestens 80 %)`, two >= r.length * 0.8]);
  if (m >= 60) goals.push([`nach ${m} min höchstens 10 % im Minus (${minus}/${r.length})`, minus <= r.length * 0.1]);
}
console.log(`\nTempo: größte Überschreitung der Einwohnergrenze ab Minute 60: ${de(maxOver * 100)} % (Häuser füllen sich noch, wenn die Grenze erreicht ist)`);
if (PASSIV) goals.push([`Spieler passiv: Gegner bleiben nahe der Grenze von 150 Einwohnern (höchstens + 60 %: ${de(maxOver * 100)} %)`, maxOver <= 0.6]);

console.log('\nErste Vorwarnung vor einem Krieg (Spielminute je Gegner; „nie“ = keine):');
const med = new Map<string, number>();
for (const [k, list] of warn) {
  med.set(k, q(list, 0.5));
  console.log(`  ${k.padEnd(10)} Median ${de(q(list, 0.5))} · ${list.map((v) => de(v)).join(', ')}`);
}
if (MINUTES >= 90 && !PASSIV) {
  // je Welt verglichen (dieselbe Welt, derselbe Spieler): wer warnt zuerst? („nie“ zählt als später)
  const E = warn.get('Eroberin') ?? [], H = warn.get('Händler') ?? [];
  let early = 0, late = 0;
  E.forEach((t, i) => { const h = H[i] ?? Infinity; if (t < h) early++; else if (h < t) late++; });
  console.log(`  je Welt: Eroberin früher in ${early}, Händler früher in ${late}, gleich (beide nie) in ${E.length - early - late} Welten`);
  goals.push([`Eroberin erklärt früher Krieg als der Händler (früher in ${early} Welten, später in ${late})`, early > late]);
}

const warm = WORLDS > 1 ? startMax.slice(1) : startMax;
const warmAll = WORLDS > 1 ? startMaxAll.slice(1) : startMaxAll;
const startWorst = Math.max(...warm);
console.log(`\nGründung: Kontor nach Ø ${de(avg(founded))} s (längstens ${de(Math.max(0, ...founded))} s; fairer Start: frühestens nach 3 bis 6 min), ohne Kontor geblieben: ${notFounded}`);
console.log('\nRechenzeit (Millisekunden):');
console.log(`  eine Bau-Entscheidung (nur die KI): Ø ${de(avg(plan), 3)} · 95 % unter ${de(q(plan, 0.95), 3)} · 99 % unter ${de(q(plan, 0.99), 3)} · höchstens ${de(q(plan, 1), 2)} (${plan.length} Entscheidungen)`);
console.log(`  mit Neuberechnung des Spiels nach dem Bauen: Ø ${de(avg(full), 3)} · 95 % unter ${de(q(full, 0.95), 3)} · höchstens ${de(q(full, 1), 2)}`);
console.log(`  Militär der KI (alle 5 s, alle Gegner): Ø ${de(avg(milMs), 3)} · 99 % unter ${de(q(milMs, 0.99), 3)} · höchstens ${de(q(milMs, 1), 2)}`);
console.log(`  KI je Spielschritt: Ø ${de(avg(aiMs), 3)} · 99,9 % unter ${de(q(aiMs, 0.999), 2)} · höchstens ${de(q(aiMs, 1), 2)} · Schritte über 2 ms: ${aiMs.filter((v) => v > 2).length}, über 5 ms: ${aiMs.filter((v) => v > 5).length} (von ${aiMs.length})`);
console.log(`  ganzer Spielschritt (Spiel + KI): Ø ${de(avg(allMs), 3)} · 99 % unter ${de(q(allMs, 0.99), 2)} · 99,9 % unter ${de(q(allMs, 0.999), 2)} · höchstens ${de(q(allMs, 1), 2)}`);
console.log(`  Anfangsstoß der KI (teuerster Denkschritt bis zur Gründung, kürzeste von ${REPS} Wiederholungen): höchstens ${de(startWorst, 2)}, Median ${de(q(warm, 0.5), 2)} · allererste Welt, Programm noch kalt: ${de(startCold, 2)}`);
console.log(`  dasselbe mit der Neuberechnung des Spiels beim Bauen des Kontors: höchstens ${de(Math.max(...warmAll), 2)}, Median ${de(q(warmAll, 0.5), 2)} · kalt: ${de(startColdAll, 2)}`);
if (slow.length) console.log(`  langsamste Entscheidungen (ohne Neuberechnung): ${slow.map((x) => `${de(x.ms, 1)} ms ${x.kind} (Welt ${x.welt}, Minute ${de(x.min)})`).join(' · ')}`);
goals.push([`KI-Entscheidung im Mittel unter 0,5 ms (${de(avg(plan), 3)})`, avg(plan) < 0.5]);
if (REPS >= 3) goals.push([`Anfangsstoß der KI unter 5 ms (${de(startWorst, 2)})`, startWorst < 5]);
else console.log('  (Der Anfangsstoß wird nur mit mindestens 3 Wiederholungen bewertet – ein einzelner Lauf streut durch fremde Last zu stark.)');
console.log('\nZiele:');
for (const [t, ok] of goals) console.log(`  ${ok ? '✓' : '✗'} ${t}`);
console.log(`\n(Laufzeit ${de((performance.now() - real0) / 1000, 1)} s)`);
if (goals.some(([, ok]) => !ok)) process.exitCode = 1;
