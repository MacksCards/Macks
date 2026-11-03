// Spielstart und Spielstände ohne Browser (Paket P1): Schwierigkeit, Einstellungen im Spielstand,
// Auto 1/Auto 2 im Wechsel, eigene Plätze, Packen, Weitergeben/Einlesen, Übernahme des alten Stands.
// Ausführen im Projektordner:
//   npx esbuild scripts/spielstaende-test.ts --bundle --platform=node --outfile=/tmp/spielstaende-test.cjs && node /tmp/spielstaende-test.cjs
// Beendet sich mit Fehlercode 1, wenn eine Prüfung fehlschlägt.
const ls = new Map<string, string>();
const g0 = globalThis as unknown as Record<string, unknown>;
g0.localStorage = {
  getItem: (k: string) => (ls.has(k) ? ls.get(k)! : null),
  setItem: (k: string, v: string) => { ls.set(k, String(v)); },
  removeItem: (k: string) => { ls.delete(k); },
};
import { Game, QUESTS, SAVE_VERSION } from '../src/game';
import { SCHWIERIGKEIT, kiGrenzen } from '../src/schwierigkeit';
import { MemoryBackend, SaveStore, AUTO_WECHSEL_MS, datumText, spielzeitText } from '../src/saves';
import { START_MONEY } from '../src/data';

let fails = 0;
const check = (name: string, cond: boolean, info = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK    ' : 'FEHLER'} ${name}${info ? ' – ' + info : ''}`);
};
const rivals = (g: Game) => g.players.filter((p) => p.ai && !p.pirate);

async function main() {
  // ---------- Schwierigkeit ----------
  const gl = Game.create(4711, 2, { schwierigkeit: 'leicht' });
  const gn = Game.create(4711, 2);
  const gs = Game.create(4711, 3, { schwierigkeit: 'schwer', piraten: false, ereignisse: 'aus' });
  check('Startgeld leicht 20 000', gl.money === 20000, String(gl.money));
  check('Startgeld normal (Standard) 15 000', gn.money === 15000 && gn.opts.schwierigkeit === 'normal', String(gn.money));
  check('Startgeld schwer 10 000', gs.money === 10000, String(gs.money));
  check('Ereignisse standardmäßig mild', gn.opts.ereignisse === 'mild');
  check('Kasse der Gegner je Schwierigkeit', rivals(gl)[0].money === Math.round(START_MONEY * 0.75) && rivals(gn)[0].money === START_MONEY && rivals(gs)[0].money === START_MONEY * 1.5,
    rivals(gl).concat(rivals(gn), rivals(gs)).map((p) => p.money).join('/'));
  check('Zahl der Gegner', rivals(gl).length === 2 && rivals(gs).length === 3);
  check('Piraten leicht erst nach 60 min', gl.pirateT === 3600 && gn.pirateT === 1800, `${gl.pirateT}/${gn.pirateT}`);
  const kn = kiGrenzen(gn);
  check('normal: Gegner bis Kaufleute, 2–3 Inseln, Vorwarnung', kn.stufe === 3 && kn.inseln[0] === 2 && kn.inseln[1] === 3 && kn.angriff === 'vorwarnung');
  check('gleiche Nummer = gleiche Inselwelt', gl.tiles.every((t, i) => t === gn.tiles[i]) && gl.islands.length === gn.islands.length);
  // Piraten aus: tauchen nie auf
  gs.tick(0.25);
  check('Piraten aus', gs.pirateT > 1e8);

  // Belohnung der Aufgaben: schwer = die Hälfte
  const q0 = QUESTS[0], done0 = q0.done;
  q0.done = () => true;
  const mN = gn.money; gn.checkQuest();
  const mS = gs.money; gs.checkQuest();
  q0.done = done0;
  check('Belohnung normal voll, schwer halb', gn.money - mN === q0.reward && gs.money - mS === Math.round(q0.reward * 0.5), `${gn.money - mN} / ${gs.money - mS}`);

  // Einstellungen überstehen Speichern und Laden
  const back = Game.fromSave(JSON.parse(JSON.stringify(gs.serialize())));
  check('Einstellungen im Spielstand', back.opts.schwierigkeit === 'schwer' && back.opts.piraten === false && back.opts.ereignisse === 'aus' && back.opts.startgeld === 10000);
  check('Spielstand-Version unverändert (Hülle neu, Daten gleich)', gs.serialize().v === SAVE_VERSION);
  // Stand der Version davor (5, vor Ereignissen/Meldungsverlauf/Bedienung) lädt weiter
  {
    const old = JSON.parse(JSON.stringify(gs.serialize()));
    old.v = SAVE_VERSION - 1;
    for (const k of ['events', 'ueberblick', 'bedienung']) delete old.ext?.[k];
    let ok = true, why = '';
    try {
      const g5 = Game.fromSave(old);
      g5.tick(0.25);
      ok = g5.money === gs.money && g5.buildings.length === gs.buildings.length && g5.serialize().v === SAVE_VERSION;
    } catch (e) { ok = false; why = String(e); }
    check(`Spielstand Version ${SAVE_VERSION - 1} lädt`, ok, why);
  }

  // ---------- Spielstände im Arbeitsspeicher ----------
  const mem = new MemoryBackend();
  const st = new SaveStore();
  let clock = 1_000_000;
  st.now = () => clock;
  await st.init(mem);
  check('leer: kein letzter Stand', (await st.latest()) === null);
  gn.money = 12345;
  check('Selbstsicherung Auto 1', await st.autosave(gn) && mem.map.has('auto1') && !mem.map.has('auto2'));
  const m1 = mem.map.get('auto1')!.meta;
  const json = JSON.stringify(gn.serialize());
  check('gepackt kleiner als ein Fünftel', m1.format === 'gz' && m1.bytes < json.length / 5, `${(m1.bytes / 1024).toFixed(0)} KB statt ${(json.length / 1024).toFixed(0)} KB`);
  check('Kurzinfo: Geld, Schwierigkeit, Nummer', m1.geld === 12345 && m1.stufe === 'Normal' && m1.seed === 4711 && m1.v === SAVE_VERSION);
  clock += AUTO_WECHSEL_MS - 1000;
  await st.autosave(gn);
  check('vor 5 min: weiter in Auto 1', !mem.map.has('auto2') && st.cur === 'auto1');
  clock += 2000;
  gn.money = 999;
  await st.autosave(gn);
  check('nach 5 min: Wechsel auf Auto 2', mem.map.has('auto2') && st.cur === 'auto2' && mem.map.get('auto1')!.meta.geld === 12345);
  clock += AUTO_WECHSEL_MS;
  gn.money = 777;
  await st.autosave(gn);
  check('nach weiteren 5 min: wieder Auto 1', st.cur === 'auto1' && mem.map.get('auto1')!.meta.geld === 777 && mem.map.get('auto2')!.meta.geld === 999);
  const latest = await st.latest();
  check('letzter Stand = Auto 1', latest?.slot === 'auto1');
  const lg = await st.load('auto1');
  check('Laden: gleiches Spiel', lg.money === 777 && lg.buildings.length === gn.buildings.length && lg.seed === gn.seed && lg.ships.length === gn.ships.length);

  // ein neuer Speicher setzt den laufenden Auto-Platz fort
  const st2 = new SaveStore();
  st2.now = () => clock;
  await st2.init(mem);
  check('nach Neustart: weiter im zuletzt laufenden Auto-Platz', st2.cur === 'auto1');

  // eigene Plätze
  await st.save(gl, 'platz2');
  check('eigener Platz', mem.map.get('platz2')!.meta.stufe === 'Leicht' && (await st.load('platz2')).money === 20000);
  check('leerer Platz meldet sich verständlich', await st.load('platz3').then(() => false, (e: Error) => /leer/.test(e.message)));
  await st.remove('platz2');
  check('Löschen', !mem.map.has('platz2'));

  // ein langsames Packen darf einen neueren Stand nicht überschreiben
  gn.money = 1; const pSlow = st.save(gn, 'platz1', true);
  gn.money = 2; const pFast = st.save(gn, 'platz1', false);
  await Promise.all([pSlow, pFast]);
  check('neuerer Stand gewinnt', mem.map.get('platz1')!.meta.geld === 2 && mem.map.get('platz1')!.meta.format === 'json');
  check('ungepackt lässt sich laden', (await st.load('platz1')).money === 2);

  // beschädigter Stand
  mem.map.set('platz3', { meta: { ...mem.map.get('platz1')!.meta, slot: 'platz3', format: 'gz' }, data: new Uint8Array([1, 2, 3]) });
  check('beschädigter Stand meldet sich verständlich', await st.load('platz3').then(() => false, (e: Error) => /beschädigt/.test(e.message)));

  // Fehler beim Speichern: Meldung beim zweiten Mal
  let msgs = 0;
  st.onFail = () => { msgs++; };
  mem.fail = true;
  await st.autosave(gn); await st.autosave(gn); await st.autosave(gn);
  mem.fail = false;
  check('Speicherfehler: genau eine Meldung', msgs === 1, String(msgs));
  await st.autosave(gn);
  check('nach Erfolg wieder bereit', st.fails === 0);

  // ---------- Weitergeben und Einlesen ----------
  gs.money = 4242;
  const text = await st.exportText(gs);
  check('Text beginnt mit Kennung', text.startsWith('NEUE-UFER-1:'), `${(text.length / 1024).toFixed(0)} KB Text`);
  const ig = await st.importText(text.replace(/(.{60})/g, '$1\n') + '\n');
  check('Einlesen (auch mit Zeilenumbrüchen)', ig.money === 4242 && ig.opts.schwierigkeit === 'schwer' && ig.players.length === gs.players.length);
  check('Unsinn wird abgelehnt', await st.importText('hallo').then(() => false, (e: Error) => /kein Spielstand/.test(e.message)));
  check('abgeschnittener Text wird abgelehnt', await st.importText(text.slice(0, 200)).then(() => false, (e: Error) => /unvollständig|beschädigt/.test(e.message)));
  const future = JSON.stringify({ ...gs.serialize(), v: SAVE_VERSION + 1 });
  check('Stand aus neuerer Fassung wird abgelehnt', await st.importText(future).then(() => false, (e: Error) => /neueren/.test(e.message)));

  // ---------- Übernahme des alten Stands aus localStorage ----------
  ls.set('neue-ufer-save-v4', JSON.stringify(gl.serialize()));
  const mem2 = new MemoryBackend();
  const st3 = new SaveStore();
  await st3.init(mem2);
  // MemoryBackend übernimmt nichts (nur echte Speicher) – mit dem localStorage-Speicher prüfen:
  const st4 = new SaveStore();
  await st4.init(); // ohne IndexedDB (Node): localStorage
  check('ohne IndexedDB: localStorage', st4.backend.art === 'localstorage');
  const mig = await st4.migrate();
  check('alter Stand übernommen', mig.game?.money === 20000 && !!ls.get('neue-ufer-stand-auto1') && !ls.has('neue-ufer-save-v4'));
  check('nur einmal übernommen', (await st4.migrate()).game === null);
  check('übernommener Stand lädt', (await st4.load('auto1')).money === 20000);
  // beschädigter alter Stand wird gesichert, nicht übernommen
  ls.clear();
  ls.set('neue-ufer-save-v4', '{kaputt');
  const st5 = new SaveStore();
  await st5.init();
  const mig2 = await st5.migrate();
  check('beschädigter alter Stand: Hinweis und Sicherung', mig2.game === null && !!mig2.note && ls.get('neue-ufer-save-sicherung') === '{kaputt');
  void st3;

  // ---------- Anzeige ----------
  check('Spielzeit lesbar', spielzeitText(65 * 60) === '1 Std 05 Min' && spielzeitText(600) === '10 Min');
  const now = new Date(2026, 10, 1, 15, 0).getTime();
  check('Datum lesbar', datumText(new Date(2026, 10, 1, 14, 5).getTime(), now) === 'heute 14:05' && datumText(new Date(2026, 9, 31, 9, 12).getTime(), now) === 'gestern 09:12');
  check('Schwierigkeiten vollständig', Object.keys(SCHWIERIGKEIT).join() === 'leicht,normal,schwer');

  console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden');
  process.exit(fails ? 1 : 0);
}
void main();
