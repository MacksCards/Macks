// Überblick-Test ohne Browser (Paket U3): Meldungsverlauf und Nebenaufgaben.
// Erwartung: Der Verlauf hält höchstens 60 Meldungen, die letzten 30 überstehen Speichern und Laden (mit Ort,
// Art und gelesen/ungelesen); Nebenaufgaben (Wehrhaft, Eigene Flotte, Kanonen an Bord) laufen neben der Hauptkette,
// erscheinen erst, wenn ihre Gebäude freigeschaltet sind, geben ihre Belohnung genau einmal und werden in der
// Hauptkette übersprungen; alte Spielstände ohne Eintrag laden mit sinnvollem Stand.
// Ausführen im Projektordner:
//   npx esbuild scripts/ueberblick-test.ts --bundle --platform=node --outfile=/tmp/ueberblick-test.cjs && node /tmp/ueberblick-test.cjs
// Beendet sich mit Fehlercode 1, wenn eine Prüfung fehlschlägt.
const g0 = globalThis as unknown as Record<string, unknown>;
g0.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
import { Game, HUMAN, QUESTS, type SaveData, type Unit } from '../src/game';
import * as ub from '../src/ueberblick';

let fails = 0;
const check = (name: string, cond: boolean, info = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK    ' : 'FEHLER'} ${name}${info ? ' – ' + info : ''}`);
};
const idx = (t: string) => QUESTS.findIndex((q) => q.title === t);
const reload = (g: Game) => Game.fromSave(JSON.parse(JSON.stringify(g.serialize())) as SaveData);
const msgs: string[] = [];
const listen = (g: Game) => { g.ev = { ...g.ev, message: (t: string) => { msgs.push(t); } }; };

// ---------- 1. Meldungsverlauf ----------
{
  const g = Game.create(4242);
  for (let i = 0; i < 75; i++) ub.addLog(g, `Meldung ${i}`, i % 3 === 0 ? 'bad' : i % 3 === 1 ? 'good' : 'info', i % 2 ? { x: i, y: i + 1 } : undefined);
  const log = ub.logOf(g);
  check('Verlauf hält höchstens 60 Meldungen', log.length === ub.LOG_MAX, `${log.length}`);
  check('älteste fallen heraus', log[0].text === 'Meldung 15' && log[log.length - 1].text === 'Meldung 74');
  log[log.length - 1].read = true;
  const h = reload(g);
  const l2 = ub.logOf(h);
  check('die letzten 30 überstehen Speichern und Laden', l2.length === ub.LOG_SAVE && l2[0].text === 'Meldung 45' && l2[29].text === 'Meldung 74', `${l2.length}`);
  // Meldung 74: Info ohne Ort, gelesen; Meldung 73: gut, mit Ort, ungelesen
  check('Ort, Art und gelesen bleiben erhalten', l2[29].at === undefined && l2[29].kind === 'info' && l2[29].read
    && !!l2[28].at && l2[28].at.x === 73 && l2[28].at.y === 74 && l2[28].kind === 'good' && !l2[28].read);
  check('wichtige Meldungen erkannt', ub.important('⚠️ Nahrung reicht nur noch 1 Minute', 'bad') && ub.important('🏴‍☠️ Piraten gesichtet!', 'bad')
    && ub.important('⚔️ Baron erklärt dir den Krieg!', 'bad') && ub.important('🏳️ Bankrott – zu lange zu hohe Schulden.', 'bad')
    && !ub.important('Holzfäller fertig', 'info') && !ub.important('⚠️ Test', 'good'));
  // kaputter Eintrag im Spielstand wird übergangen
  const d = JSON.parse(JSON.stringify(g.serialize())) as SaveData;
  (d.ext!.ueberblick as { log: unknown[] }).log.push(null, { text: 5 }, { text: 'ok', kind: 'seltsam', time: 'x' });
  const k = Game.fromSave(d);
  const l3 = ub.logOf(k);
  check('kaputte Einträge werden übergangen', l3.length === 31 && l3[30].text === 'ok' && l3[30].kind === 'info' && Number.isFinite(l3[30].time));
}

// ---------- 2. Nebenaufgaben ----------
{
  const g = Game.create(777);
  listen(g);
  const iW = idx('Wehrhaft'), iF = idx('Eigene Flotte'), iK = idx('Kanonen an Bord');
  check('drei Nebenaufgaben in der Liste', iW > 0 && iF > 0 && iK > 0 && ub.isSide(iW) && ub.isSide(iF) && ub.isSide(iK) && !ub.isSide(0));
  check('am Anfang gesperrt (ab … Einwohnern)', ub.questLock(g, iW) === 'ab 200 Siedlern' && ub.questLock(g, iF) === 'ab 120 Siedlern' && ub.questLock(g, iK) === 'ab 400 Bürgern',
    `${ub.questLock(g, iW)} / ${ub.questLock(g, iF)} / ${ub.questLock(g, iK)}`);
  check('keine Nebenaufgabe sichtbar', ub.currentSide(g) === null);
  check('„Eines genügt“: Nahrung ist frei', ub.questLock(g, idx('Nahrung')) === null);
  check('„Alkohol“ ab 40 Siedlern', ub.questLock(g, idx('Alkohol')) === 'ab 40 Siedlern', `${ub.questLock(g, idx('Alkohol'))}`);
  // Hauptkette überspringt Wehrhaft
  g.quest = iW - 1;
  g.tick(0.25);
  check('Hauptkette läuft vor Wehrhaft normal', g.quest === iW - 1);
  g.quest = iW;
  g.tick(0.25);
  check('Hauptkette überspringt Wehrhaft', g.quest === iW + 1, `${g.quest}`);
  // Werft freischalten: „Eigene Flotte“ erscheint, Belohnung genau einmal
  g.unlocked.add('werft');
  msgs.length = 0;
  for (let i = 0; i < 8; i++) g.tick(0.25);
  const side = ub.currentSide(g);
  check('Eigene Flotte erscheint mit der Werft', side?.title === 'Eigene Flotte' && msgs.some((m) => m.startsWith('📜 Neue Nebenaufgabe: Eigene Flotte')), msgs.join(' | '));
  const money0 = g.money;
  const s0 = g.myShips()[0];
  g.ships.push({ ...s0, id: g.nextId++, path: [], slots: s0.slots.map(() => ({ g: null, n: 0 })) });
  msgs.length = 0;
  for (let i = 0; i < 8; i++) g.tick(0.25);
  const reward = ub.rewardOf(g, iF);
  check('Belohnung für Eigene Flotte', g.money - money0 >= reward - 1 && msgs.some((m) => /Aufgabe erledigt: Eigene Flotte/.test(m)), `${Math.round(g.money - money0)} / ${reward}`);
  const money1 = g.money;
  for (let i = 0; i < 40; i++) g.tick(0.25);
  check('keine zweite Belohnung', g.money - money1 < reward / 2, `${Math.round(g.money - money1)}`);
  check('erledigt in der Liste', ub.sideList(g).find((q) => q.title === 'Eigene Flotte')?.done === true);
  // Wehrhaft: Burg frei, 3 Soldaten
  g.unlocked.add('burg');
  for (let i = 0; i < 8; i++) g.tick(0.25);
  check('Wehrhaft wird angezeigt', ub.currentSide(g)?.title === 'Wehrhaft');
  const h = reload(g);
  check('Nebenaufgaben überstehen Speichern und Laden', ub.sideList(h).find((q) => q.title === 'Eigene Flotte')?.done === true && ub.currentSide(h)?.title === 'Wehrhaft');
  listen(h);
  const m2 = h.money;
  const k = h.kontor() ?? null;
  const at = k ? h.center(k) : [h.myShips()[0].x, h.myShips()[0].y];
  for (let i = 0; i < 3; i++) h.units.push({ id: h.nextId++, type: 'infanterie', owner: HUMAN, x: at[0], y: at[1], dir: 0, hp: 10, path: [], cd: 0 } as unknown as Unit);
  msgs.length = 0;
  for (let i = 0; i < 8; i++) h.tick(0.25);
  check('Wehrhaft erledigt nach dem Laden (Belohnung einmal)', ub.sideList(h).find((q) => q.title === 'Wehrhaft')?.done === true && msgs.filter((m) => /Aufgabe erledigt: Wehrhaft/.test(m)).length === 1,
    `${Math.round(h.money - m2)}`);
  // Hauptkette erreicht später die Nebenaufgaben am Ende: kein zweites Mal
  // (die Aufgabe davor – Aristokraten – wird hier künstlich als erledigt gemeldet)
  h.quest = iF - 1;
  const before = QUESTS[iF - 1], doneFn = before.done;
  before.done = () => true;
  msgs.length = 0;
  h.tick(0.25);
  before.done = doneFn;
  h.tick(0.25);
  h.tick(0.25);
  check('Hauptkette springt über Flotte und Kanonen ans Ende', h.quest === QUESTS.length && msgs.some((m) => m.includes(before.title))
    && !msgs.some((m) => /Eigene Flotte/.test(m)), `${h.quest} ${msgs.join(' | ')}`);
}

// ---------- 3. alter Spielstand ohne Eintrag ----------
{
  const g = Game.create(31337);
  const iW = idx('Wehrhaft');
  g.quest = iW + 2; // alte Reihenfolge: Wehrhaft schon geschafft
  const d = JSON.parse(JSON.stringify(g.serialize())) as SaveData;
  delete d.ext!.ueberblick;
  const h = Game.fromSave(d);
  check('alter Stand: frühere Nebenaufgabe gilt als erledigt', ub.sideList(h).find((q) => q.title === 'Wehrhaft')?.done === true && ub.logOf(h).length === 0);
  g.quest = iW; // mitten in Wehrhaft
  const d2 = JSON.parse(JSON.stringify(g.serialize())) as SaveData;
  delete d2.ext!.ueberblick;
  const k = Game.fromSave(d2);
  check('alter Stand mitten in Wehrhaft: weiter in der Hauptkette, Wehrhaft offen', k.quest === iW + 1 && ub.sideList(k).find((q) => q.title === 'Wehrhaft')?.done === false, `${k.quest}`);
}

console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden');
if (fails) process.exit(1);
