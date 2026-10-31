// Simulation der Computergegner ohne Browser – misst, ob ihre Wirtschaft auf Dauer trägt.
//
// Was passiert: Viele Zufallswelten mit je drei Computergegnern laufen bis zu 120 Spielminuten,
// der Spieler selbst tut nichts. Zu festen Zeitpunkten (20, 60, 120 min) wird gezählt:
//  - wie viele Gegner im Minus sind (Ziel: höchstens 10 %),
//  - wie viele Einwohner sie haben (Ziel: im Mittel mindestens 120),
//  - wie viele Betriebe am Wegenetz hängen und arbeiten, ob Häuser hungern.
// Dazu die Rechenzeit:
//  - eine Bau-Entscheidung der KI (Ziel: im Mittel unter 0,5 ms; ohne die Neuberechnung, die
//    das Spiel nach jedem Bau selbst macht – die wird extra angegeben),
//  - der Anfangsstoß = der teuerste Denkschritt der KI bis zur Gründung: Insel wählen, Kontor-Platz
//    planen, Überfahrt, Kontor bauen (Ziel: unter 5 ms, ohne die Neuberechnung des Spiels, die das
//    Bauen des Kontors auslöst – sie gehört dem Spiel, nicht der KI, und wird daneben angegeben).
//    Der Start jeder Welt läuft dafür mehrmals gleich ab; je Denkschritt zählt die kürzeste Zeit –
//    so stören andere Programme auf dem Rechner die Messung kaum. Die allererste Welt (Programm noch
//    „kalt“) wird extra angegeben.
//
// Starten (im Projektordner):
//   npx esbuild scripts/ki-sim.ts --bundle --platform=node --outfile=dist/ki-sim.cjs && node --expose-gc dist/ki-sim.cjs
// Optionen: --welten 20   --minuten 120   --wdh 5 (Wiederholungen der Startmessung)
//           --schnell (4 Welten, 20 min)   --liste (jede KI einzeln)
// Der Zufall ist je Welt fest eingestellt: gleiche Optionen ergeben gleiche Zahlen (bis auf die Zeiten).
// --expose-gc räumt vor jeder Welt den Speicher auf, damit Reste der vorigen Welt die Zeiten nicht verfälschen.
// Zeiten: der kleinere Wert aus Wanduhr und Rechenzeit des Prozesses. Die Wanduhr zählt mit, wenn andere
// Programme den Rechner belegen; die Rechenzeit zählt Hilfsarbeiten im Hintergrund mit – das Kleinere
// kommt der echten Rechenzeit der KI am nächsten.

import { BUILDINGS } from '../src/data';
import { Game, Player } from '../src/game';
import { THINK, thinkAI } from '../src/ai';
import { rng } from '../src/world';

declare const process: { argv: string[]; exitCode?: number; cpuUsage(prev?: { user: number; system: number }): { user: number; system: number } };

// Ohne Browser gibt es keinen Speicher – das Spiel braucht ihn hier auch nicht.
const G = globalThis as unknown as Record<string, unknown>;
G.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };

const arg = (name: string, def: number): number => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? Number(process.argv[i + 1]) : def;
};
const flag = (name: string) => process.argv.includes(`--${name}`);
const QUICK = flag('schnell');
const WORLDS = arg('welten', QUICK ? 4 : 20);
const MINUTES = arg('minuten', QUICK ? 20 : 120);
const REPS = Math.max(1, arg('wdh', 5));
const LIST = flag('liste');
const DT = 0.25; // wie im Spiel: Sekunden Spielzeit je Rechenschritt
const MARKS = [20, 60, 120].filter((m) => m <= MINUTES);
if (!MARKS.includes(MINUTES)) MARKS.push(MINUTES);
const SEEDS = [1, 2, 3, 42, 99, 123, 777, 2024, 31337, 4711, 5555, 8080, 9999, 12345, 54321, 65432, 70000, 99999, 815657, 871090];
const seedOf = (i: number) => (i < SEEDS.length ? SEEDS[i] : 1000003 + i * 7919);

/** Rechenzeit einer Funktion in ms (kleinerer Wert aus Wanduhr und Prozess-Rechenzeit) */
function timed(fn: () => void): number {
  const c0 = process.cpuUsage(), a = performance.now();
  fn();
  const wall = performance.now() - a, c = process.cpuUsage(c0);
  return Math.min(wall, (c.user + c.system) / 1000);
}

/** Neue Welt wie im Spiel; Kampf und Piraten würfeln – hier je Welt immer gleich.
 *  shift > 0 belegt vorher etwas Speicher, damit die Speicherbereinigung bei jeder Wiederholung
 *  an einer anderen Stelle einsetzt (sonst träfe sie immer denselben Denkschritt). */
function newWorld(seed: number, shift = 0): { g: Game; ais: Player[]; rec: { ms: number } } {
  const gc = (globalThis as { gc?: () => void }).gc;
  gc?.(); // Reste der vorigen Welt wegräumen (nur mit --expose-gc)
  Math.random = rng(seed * 31 + 7);
  const g = Game.create(seed, 3);
  g.ev.message = () => {};
  gc?.(); // Reste vom Erzeugen der Welt wegräumen
  const junk: number[][] = [];
  for (let i = 0; i < shift * 3000; i++) junk.push([i, i]);
  junk.length = 0;
  // Neuberechnung des Spiels (nach jedem Bau) getrennt messen
  const rec = { ms: 0 };
  const recompute = g.recompute.bind(g);
  g.recompute = () => { rec.ms += timed(recompute); };
  return { g, ais: g.players.filter((p) => p.ai && p.brain), rec };
}

/** Ein Spielschritt. Die KI wird hier selbst aufgerufen (statt in g.tick), damit ihre Zeit genau
 *  messbar ist. Für jede echte Entscheidung (Denkzeit erreicht) kommt ein Rückruf. */
function step(w: { g: Game; ais: Player[]; rec: { ms: number } }, onDecision: (p: Player, phase: string, ms: number, recMs: number) => void): number {
  const { g, ais, rec } = w;
  const brains = ais.map((p) => p.brain);
  for (const p of ais) p.brain = undefined;
  g.tick(DT);
  ais.forEach((p, i) => { p.brain = brains[i]; });
  let sum = 0;
  for (const p of ais) {
    const before = p.brain!.t, phase = p.brain!.phase;
    rec.ms = 0;
    const d = timed(() => thinkAI(g, p, DT));
    sum += d;
    if (before + DT >= THINK - 1e-9 && p.brain!.t < before + DT - 1e-9) onDecision(p, phase, d, rec.ms);
  }
  return sum;
}

interface Row {
  welt: number; name: string; geld: number; einw: number; haeuser: number; siedler: number;
  betriebe: number; angeschl: number; arbeiten: number; lagerVoll: number; hunger: number; arten: number; kontor: boolean;
}
function snapshot(g: Game, w: number, p: Player): Row {
  const bs = g.buildings.filter((b) => b.owner === p.id);
  const prod = bs.filter((b) => BUILDINGS[b.type].prod);
  const houses = bs.filter((b) => b.type === 'haus');
  return {
    welt: w, name: p.name, geld: p.money,
    einw: houses.reduce((a, b) => a + b.residents, 0),
    haeuser: houses.length,
    siedler: houses.filter((b) => b.tier >= 1).length,
    betriebe: prod.length,
    angeschl: prod.filter((b) => g.linked.has(b.id)).length,
    arbeiten: prod.filter((b) => b.status === 'ok').length,
    lagerVoll: prod.filter((b) => b.status === 'lagerVoll').length,
    hunger: houses.filter((b) => b.short.nahrung).length,
    arten: new Set(bs.map((b) => b.type)).size,
    kontor: !!g.kontor(p.id),
  };
}

const real0 = performance.now();

// ---------- 1. Anfangsstoß: Start jeder Welt mehrmals, je Denkschritt die kürzeste Zeit ----------
const startMax: number[] = []; // je Welt: teuerster Denkschritt der KI bis zur Gründung (ohne Neuberechnung des Spiels)
const startMaxAll: number[] = []; // dasselbe mit der Neuberechnung, die das Bauen des Kontors im Spiel auslöst
const founded: number[] = []; // Spielsekunden bis zur Gründung des Kontors
let startCold = 0, startColdAll = 0, notFounded = 0;
for (let w = 0; w < WORLDS; w++) {
  const best = new Map<string, number>(), bestAll = new Map<string, number>();
  for (let r = 0; r < REPS; r++) {
    const world = newWorld(seedOf(w), r);
    const count = new Map<number, number>(), done = new Map<number, number>();
    while (world.g.time < 600 && done.size < world.ais.length) {
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

// ---------- 2. Wirtschaft über die ganze Spielzeit ----------
const rows = new Map<number, Row[]>(MARKS.map((m) => [m, []]));
const plan: number[] = []; // Bau-Entscheidungen: Rechenzeit der KI selbst (ohne Neuberechnung des Spiels)
const full: number[] = []; // Bau-Entscheidungen inklusive Neuberechnung nach dem Bauen
let over2 = 0, over5 = 0, ticks = 0;
for (let w = 0; w < WORLDS; w++) {
  const world = newWorld(seedOf(w));
  let mark = 0;
  while (mark < MARKS.length) {
    const ms = step(world, (_p, phase, d, recMs) => {
      if (phase === 'aufbau') { plan.push(Math.max(0, d - recMs)); full.push(d); }
    });
    ticks++;
    if (ms > 2) over2++;
    if (ms > 5) over5++;
    if (world.g.time >= MARKS[mark] * 60 - 1e-6) {
      for (const p of world.ais) rows.get(MARKS[mark])!.push(snapshot(world.g, w, p));
      mark++;
    }
  }
  if (LIST) for (const m of MARKS) for (const r of rows.get(m)!.filter((y) => y.welt === w)) {
    console.log(`  Welt ${r.welt} nach ${m} min ${r.name.padEnd(18)} Geld ${Math.round(r.geld).toString().padStart(6)} · Einw ${r.einw} · Häuser ${r.haeuser} (Siedler ${r.siedler}) · Betriebe ${r.betriebe}/${r.angeschl}/${r.arbeiten} · Hunger ${r.hunger}`);
  }
}

// ---------- Auswertung ----------
const de = (v: number, d = 0) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
const goals: [string, boolean][] = [];

console.log(`\nComputergegner-Simulation: ${WORLDS} Welten × 3 Gegner, ${MINUTES} Spielminuten, Spieler passiv`);
for (const m of MARKS) {
  const r = rows.get(m)!;
  const minus = r.filter((x) => x.geld < 0).length;
  const pop = r.map((x) => x.einw);
  const hungry = r.reduce((a, x) => a + x.hunger, 0) / Math.max(1, r.reduce((a, x) => a + x.haeuser, 0));
  const starving = r.filter((x) => x.hunger > x.haeuser * 0.1).length;
  console.log(`\nNach ${m} min:`);
  console.log(`  im Minus ${minus} von ${r.length} (${de((minus / r.length) * 100)} %) · Geld Ø ${de(avg(r.map((x) => x.geld)))}, kleinstes ${de(Math.min(...r.map((x) => x.geld)))}`);
  console.log(`  Einwohner Ø ${de(avg(pop))} (kleinste ${Math.min(...pop)}, ab 120: ${pop.filter((v) => v >= 120).length}/${r.length}) · Häuser Ø ${de(avg(r.map((x) => x.haeuser)), 1)}, davon Siedler Ø ${de(avg(r.map((x) => x.siedler)), 1)}`);
  console.log(`  Betriebe Ø ${de(avg(r.map((x) => x.betriebe)), 1)}, am Wegenetz ${de(avg(r.map((x) => x.angeschl)), 1)}, arbeiten ${de(avg(r.map((x) => x.arbeiten)), 1)}, Lager voll ${de(avg(r.map((x) => x.lagerVoll)), 1)} · ohne angeschlossenen Betrieb: ${r.filter((x) => x.angeschl === 0).length}`);
  console.log(`  Häuser mit Hunger ${de(hungry * 100)} % (Gegner mit Hunger in mehr als jedem 10. Haus: ${starving}) · Gebäudearten Ø ${de(avg(r.map((x) => x.arten)), 1)} · ohne Kontor: ${r.filter((x) => !x.kontor).length}`);
  goals.push([`nach ${m} min höchstens 10 % im Minus (${minus}/${r.length})`, minus <= r.length * 0.1]);
  goals.push([`nach ${m} min im Mittel mindestens 120 Einwohner (${de(avg(pop))})`, avg(pop) >= 120]);
}
const warm = WORLDS > 1 ? startMax.slice(1) : startMax;
const warmAll = WORLDS > 1 ? startMaxAll.slice(1) : startMaxAll;
const startWorst = Math.max(...warm);
console.log(`\nGründung: Kontor nach Ø ${de(avg(founded))} s (längstens ${de(Math.max(0, ...founded))} s), ohne Kontor geblieben: ${notFounded}`);
console.log('\nRechenzeit der KI (Millisekunden):');
console.log(`  eine Bau-Entscheidung (nur die KI): Ø ${de(avg(plan), 3)} · 95 % unter ${de(q(plan, 0.95), 3)} · 99 % unter ${de(q(plan, 0.99), 3)} · höchstens ${de(q(plan, 1), 2)} (${plan.length} Entscheidungen)`);
console.log(`  mit Neuberechnung des Spiels nach dem Bauen: Ø ${de(avg(full), 3)} · 95 % unter ${de(q(full, 0.95), 3)} · höchstens ${de(q(full, 1), 2)}`);
console.log(`  Anfangsstoß der KI (teuerster Denkschritt bis zur Gründung, kürzeste von ${REPS} Wiederholungen): höchstens ${de(startWorst, 2)}, Median ${de(q(warm, 0.5), 2)} · allererste Welt, Programm noch kalt, einmalig: ${de(startCold, 2)}`);
console.log(`  dasselbe mit der Neuberechnung des Spiels beim Bauen des Kontors (Spiel, nicht KI): höchstens ${de(Math.max(...warmAll), 2)}, Median ${de(q(warmAll, 0.5), 2)} · kalt: ${de(startColdAll, 2)}`);
console.log(`  Spielschritte mit mehr als 2 ms KI-Zeit: ${over2}, mit mehr als 5 ms: ${over5} (von ${ticks}; einzelne Ausreißer kommen auch von fremder Last auf dem Rechner)`);
goals.push([`KI-Entscheidung im Mittel unter 0,5 ms (${de(avg(plan), 3)})`, avg(plan) < 0.5]);
if (REPS >= 3) goals.push([`Anfangsstoß der KI unter 5 ms (${de(startWorst, 2)})`, startWorst < 5]);
else console.log('  (Der Anfangsstoß wird nur mit mindestens 3 Wiederholungen bewertet – ein einzelner Lauf streut durch fremde Last zu stark.)');
console.log('\nZiele:');
for (const [t, ok] of goals) console.log(`  ${ok ? '✓' : '✗'} ${t}`);
console.log(`\n(Laufzeit ${de((performance.now() - real0) / 1000, 1)} s)`);
if (goals.some(([, ok]) => !ok)) process.exitCode = 1;
