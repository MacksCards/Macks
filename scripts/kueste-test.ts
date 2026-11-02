// Küsten-Test ohne Browser (Paket KL): Gebäude nur auf Land, das im Bild wirklich trocken ist.
// 1) Die Höhenrechnung der Spiellogik (src/landhoehe.ts) stimmt mit dem Bild (src/render/terrain.ts) überein.
// 2) Winzige Sandbänke und Landzungen, die im Bild unter Wasser liegen, lassen sich nicht bebauen.
// 3) Normale Küstenbauten (Kontor, Fischer, Werft) gehen weiter – an geraden und schrägen Küsten fast überall.
// 4) Jede erlaubte Grundfläche liegt im Bild über dem Wasser (Feldmitte und mindestens gut die Hälfte jedes Feldes).
// Ausführen im Projektordner:
//   npx esbuild scripts/kueste-test.ts --bundle --platform=node --outfile=/tmp/kueste-test.cjs && node /tmp/kueste-test.cjs
// Beendet sich mit Fehlercode 1, wenn eine Prüfung fehlschlägt.
const g0 = globalThis as unknown as Record<string, unknown>;
g0.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
import { Game, HUMAN } from '../src/game';
import { BUILDINGS, BuildingId, GOOD, GoodId } from '../src/data';
import { T } from '../src/world';
import { Terrain } from '../src/render/terrain';
import { bodenHoehe, trockeneFlaeche } from '../src/landhoehe';

let fails = 0;
const check = (name: string, cond: boolean, info = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK    ' : 'FEHLER'} ${name}${info ? ' – ' + info : ''}`);
};

/** Spieler darf überall bauen (Gebiet, entdeckt, freigeschaltet, Geld) – geprüft wird nur der Boden */
function open(g: Game) {
  g.seen.fill(1);
  g.own.fill(HUMAN);
  g.players[HUMAN].money = 1e9;
  for (const id of Object.keys(BUILDINGS) as BuildingId[]) g.unlocked.add(id);
  for (let i = 0; i < g.islands.length; i++) {
    const l = (g.lager[`${HUMAN}:${i}`] ??= {} as Record<GoodId, number>);
    for (const k of Object.keys(GOOD) as GoodId[]) l[k] = 1e6;
  }
}
const WET = 'Hier ist kein festes Land – zu nah am Wasser';

// 1) gleiche Höhe wie das Bild
for (const seed of [11, 4242, 90817]) {
  const g = Game.create(seed, 0);
  const terr = new Terrain(g);
  let n = 0, maxd = 0;
  for (let k = 0; k < g.tiles.length; k += 7) {
    if (g.tiles[k] === T.Wasser || g.islandOf[k] < 0) continue;
    const tx = k % g.size, ty = (k / g.size) | 0;
    for (const [i, j] of [[0, 0], [1, 1], [2, 1], [1, 2], [2, 2]]) {
      const a = bodenHoehe(g, tx * 2 + i, ty * 2 + j), b = terr.heightAt((tx * 2 + i) / 2, (ty * 2 + j) / 2);
      maxd = Math.max(maxd, Math.abs(a - b)); n++;
    }
  }
  check(`Welt ${seed}: Höhe wie im Bild (${n} Punkte)`, n > 1000 && maxd < 1e-5, `größte Abweichung ${maxd.toExponential(2)}`);
  terr.dispose();
}

// 2) künstliche Sandbank vor der Küste: 1, 2 und 3 Felder groß
{
  const g = Game.create(7, 0);
  open(g);
  // freie Wasserfläche nahe einer Insel suchen (5 × 5 Wasser, 2 Felder bis zum Land)
  const N = g.size;
  const water = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && g.tiles[y * N + x] === T.Wasser;
  let spot: [number, number] | null = null;
  for (let y = 4; y < N - 8 && !spot; y++) for (let x = 4; x < N - 8 && !spot; x++) {
    let ok = true;
    for (let j = -2; j <= 4 && ok; j++) for (let i = -2; i <= 4 && ok; i++) if (!water(x + i, y + j)) ok = false;
    if (ok && !water(x - 3, y + 1)) spot = [x, y];
  }
  check('Platz für eine Sandbank gefunden', !!spot);
  if (spot) {
    const [x, y] = spot;
    const isl = g.islandOf[(y + 1) * N + x - 3];
    const set = (cells: [number, number][]) => {
      for (const [cx, cy] of cells) { g.tiles[cy * N + cx] = T.Sand; g.islandOf[cy * N + cx] = isl; }
      // neue Welt-Fläche (wie ein neu erzeugtes Spiel): Rechnung neu anlegen
      g.tiles = g.tiles.slice();
    };
    set([[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]);
    const c2 = g.canPlace('holzfaeller', x, y);
    check('Holzfäller auf 2 × 2-Sandbank: nicht erlaubt', !c2.ok, c2.reason ?? 'erlaubt');
    const terr = new Terrain(g);
    const hm = terr.heightAt(x + 0.5, y + 0.5);
    check('… im Bild liegt die Sandbank unter Wasser', hm < 0.06, `Höhe ${hm.toFixed(2)}`);
    terr.dispose();
    // größere Sandbank (5 × 5): innen trocken, am Rand nicht
    const big: [number, number][] = [];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) big.push([x - 1 + i, y - 1 + j]);
    set(big);
    const inner = g.canPlace('holzfaeller', x, y);
    const edge = g.canPlace('holzfaeller', x - 1, y - 1);
    const hs: string[] = [];
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) hs.push(bodenHoehe(g, (x + i) * 2 + 1, (y + j) * 2 + 1).toFixed(2) + (trockeneFlaeche(g, x + i, y + j, 1) ? '' : '!'));
    check('5 × 5-Sandbank: Holzfäller in der Mitte erlaubt', inner.ok, (inner.reason ?? '') + ' Mitten ' + hs.join(' '));
    check('5 × 5-Sandbank: Holzfäller auf der Ecke nicht erlaubt', !edge.ok, edge.reason ?? 'erlaubt');
  }
}

// 3) + 4) normale Küsten: Wie viele Bauplätze gehen verloren? Liegen die erlaubten im Bild trocken?
for (const seed of [11, 4242, 90817]) {
  const g = Game.create(seed, 0);
  open(g);
  const terr = new Terrain(g);
  const N = g.size;
  for (const type of ['kontor', 'fischer', 'werft', 'holzfaeller', 'haus'] as BuildingId[]) {
    const s = BUILDINGS[type].size;
    let before = 0, after = 0, wet = 0;
    const perIsl = new Map<number, [number, number]>(); // Insel → [vorher, nachher]
    for (let y = 0; y < N - s; y++) for (let x = 0; x < N - s; x++) {
      const k = y * N + x;
      if (g.tiles[k] === T.Wasser) continue;
      const c = type === 'kontor' ? g.canPlace(type, x, y, HUMAN, true) : g.canPlace(type, x, y);
      const dry = trockeneFlaeche(g, x, y, s);
      if (c.ok || c.reason === WET) {
        before++;
        const pi = perIsl.get(g.islandOf[k]) ?? [0, 0];
        pi[0]++; if (c.ok) pi[1]++;
        perIsl.set(g.islandOf[k], pi);
      }
      if (c.reason === WET && dry) wet += 1000; // Meldung nur, wenn wirklich nass
      if (!c.ok) continue;
      after++;
      // erlaubte Grundfläche: Mitte und Viertelmitten jedes Feldes über dem Wasser
      for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
        if (terr.heightAt(x + i + 0.5, y + j + 0.5) < 0.05) wet++;
        let dryPts = 0;
        for (let b = 0; b < 10; b++) for (let a = 0; a < 10; a++) if (terr.heightAt(x + i + (a + 0.5) / 10, y + j + (b + 0.5) / 10) > 0) dryPts++;
        if (dryPts < 55) wet++;
      }
    }
    const kept = before ? after / before : 1;
    const need = type === 'kontor' || type === 'werft' || type === 'fischer' ? 0.6 : 0.85;
    check(`Welt ${seed}, ${BUILDINGS[type].name}: Bauplätze bleiben (${after} von ${before})`, kept >= need && after > 0, `${Math.round(kept * 100)} %`);
    check(`Welt ${seed}, ${BUILDINGS[type].name}: alle erlaubten Plätze im Bild trocken`, wet === 0, `${wet} nasse Stellen`);
    if (type === 'kontor' || type === 'fischer') {
      // jede Insel, die vorher eine Küste dafür hatte, hat noch reichlich Plätze
      const poor = [...perIsl].filter(([, [b, a]]) => b >= 4 && a < Math.min(4, b));
      check(`Welt ${seed}, ${BUILDINGS[type].name}: jede Insel behält Küstenplätze (${perIsl.size} Inseln)`, poor.length === 0,
        poor.map(([i, [b, a]]) => `Insel ${i}: ${a} von ${b}`).join(', '));
    }
  }
  terr.dispose();
}

console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden');
process.exit(fails ? 1 : 0);
