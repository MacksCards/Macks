// Stadtleben-Test ohne Browser (Paket G3): Warnsymbole und ihre Dringlichkeit, Sammelmarken,
// Insel-Symbole, Rauch nur bei Arbeit, Mühle dreht nur bei Arbeit, Tippradius in Fingerbreite,
// Rauchpunkte der Meshy-Modelle in manifest.json.
// Ausführen im Projektordner:
//   npx esbuild scripts/stadtleben-test.ts --bundle --platform=node --outfile=/tmp/stadtleben-test.cjs && node /tmp/stadtleben-test.cjs
// Beendet sich mit Fehlercode 1, wenn eine Prüfung fehlschlägt.
const g0 = globalThis as unknown as Record<string, unknown>;
g0.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
import { readFileSync } from 'node:fs';
import { Building, Game, HUMAN } from '../src/game';
import { BUILDINGS, BuildingId } from '../src/data';
import { T } from '../src/world';
import type { Island } from '../src/world';
import {
  buildingSign, clusterPins, effColor, islandSymbols, ownSigns, smokeStrength, tapRadius, working,
  HAPPY_RED, HAPPY_YELLOW, SMOKE_STYLE,
} from '../src/render/citysigns';

let fails = 0;
const check = (name: string, cond: boolean, info = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK    ' : 'FEHLER'} ${name}${info ? ' – ' + info : ''}`);
};

/** Gebäude zum Prüfen (nur die Felder, die die Regeln lesen) */
const mk = (type: BuildingId, over: Partial<Building> = {}): Building => ({
  id: 1, type, x: 0, y: 0, owner: HUMAN, island: 0, progress: 0, loaded: false, eff: 1, status: 'ok', missing: [], active: 0,
  tier: 0, residents: 0, need: {}, demand: {}, short: {}, happy: 0.8, growT: 0, upT: 0, stock: 0, ...over,
} as Building);

// 1) Warnsymbole und Dringlichkeit
{
  const s = buildingSign(mk('holzfaeller', { status: 'keinWeg' }));
  check('ohne Weg: 🚧 rot', s?.icon === '🚧' && s.level === 3, JSON.stringify(s));
  const m = buildingSign(mk('baeckerei', { status: 'rohstoff', missing: ['mehl'] }));
  check('fehlender Rohstoff: rot mit Warensymbol', m?.level === 3 && m.icon !== '📦', JSON.stringify(m));
  const l = buildingSign(mk('baeckerei', { status: 'lagerVoll' }));
  check('Lager voll: gelb (eingeschränkt)', l?.level === 2, JSON.stringify(l));
  const e = buildingSign(mk('erzmine', { status: 'erschoepft' }));
  check('Vorkommen erschöpft: rot ⛏️', e?.level === 3 && e.icon === '⛏️', JSON.stringify(e));
  const low = buildingSign(mk('holzfaeller', { status: 'ok', eff: 0.3 }));
  check('arbeitet, aber wenig Wald: grauer Hinweis', low?.level === 1 && low.icon === '🌲', JSON.stringify(low));
  check('arbeitet gut: kein Symbol', buildingSign(mk('holzfaeller', { status: 'ok', eff: 0.9 })) === null);
  const h1 = buildingSign(mk('haus', { status: 'wohnen', happy: HAPPY_YELLOW - 0.05 }));
  check(`Haus unter ${HAPPY_YELLOW}: gelbes Gesicht`, h1?.level === 2 && h1.icon === '😐', JSON.stringify(h1));
  const h2 = buildingSign(mk('haus', { status: 'wohnen', happy: HAPPY_RED - 0.05 }));
  check(`Haus unter ${HAPPY_RED}: rotes Gesicht (ziehen weg)`, h2?.level === 3 && h2.icon === '😠', JSON.stringify(h2));
  check('zufriedenes Haus: kein Symbol', buildingSign(mk('haus', { status: 'wohnen', happy: 0.9 })) === null);
  check('neues Haus (Zufriedenheit 0,7): kein Symbol', buildingSign(mk('haus', { status: 'wohnen', happy: 0.7 })) === null);
  const fire = buildingSign(mk('haus', { status: 'wohnen', happy: 0.9 }), '🔥');
  check('Ereignis (Brand) geht vor und ist rot', fire?.icon === '🔥' && fire.level === 3, JSON.stringify(fire));
}

// 2) Sammelmarken je 6 × 6 Felder
{
  const pins = [
    { x: 1, z: 1, level: 2 as const, icon: '📦' }, { x: 4, z: 5, level: 3 as const, icon: '🚧' }, { x: 5.5, z: 0.5, level: 1 as const, icon: '🌲' },
    { x: 13, z: 2, level: 2 as const, icon: '😐' },
  ];
  const c = clusterPins(pins).sort((a, b) => a.x - b.x);
  check('zwei Sammelmarken', c.length === 2, JSON.stringify(c));
  check('erste Marke: 3 Warnungen, rot, Symbol der dringendsten', c[0]?.count === 3 && c[0].level === 3 && c[0].icon === '🚧');
  check('Marke in der Mitte ihrer Warnungen', Math.abs(c[0].x - 3.5) < 1e-9 && Math.abs(c[0].z - 6.5 / 3) < 1e-9, `${c[0].x}/${c[0].z}`);
  check('zweite Marke: 1 Warnung, gelb', c[1]?.count === 1 && c[1].level === 2);
}

// 3) Insel-Symbole
{
  const il = { erz: 30, erzDeep: 60, gold: 1, frucht: { tabak: 50, wein: 100, zuckerrohr: 0 } } as unknown as Island;
  const s = islandSymbols(il);
  check('Erz, Gold, dann Pflanzen (beste zuerst, ohne 0 %)', s.map((x) => x.icon + x.text).join(' ') === '⛏️Erz 🥇Gold 🍇100 % 🍂50 %', s.map((x) => x.icon + x.text).join(' '));
  const none = islandSymbols({ erz: 0, erzDeep: 0, gold: 0, frucht: {} } as unknown as Island);
  check('Insel ohne Schätze: keine Symbole', none.length === 0);
}

// 4) Rauch und Mühle nur bei Arbeit
{
  check('leeres Haus raucht nicht', smokeStrength(mk('haus', { residents: 0 })) === 0);
  check('bewohntes Haus raucht dünn', smokeStrength(mk('haus', { residents: 3, status: 'wohnen' })) > 0);
  check('Erzschmelze arbeitet: raucht', smokeStrength(mk('erzschmelze', { status: 'ok', active: 0.6 })) > 0.5);
  check('Erzschmelze ohne Rohstoff: kein Rauch', smokeStrength(mk('erzschmelze', { status: 'rohstoff', active: 0.6 })) === 0);
  check('Bäckerei steht still (Lager voll): kein Rauch', smokeStrength(mk('baeckerei', { status: 'lagerVoll', active: 0.9 })) === 0);
  check('Holzfäller hat keinen Schornstein', smokeStrength(mk('holzfaeller', { status: 'ok', active: 1 })) === 0);
  check('Schmelze dunkel, Bäckerei hell, Haus dünn', SMOKE_STYLE.erzschmelze === 'dunkel' && SMOKE_STYLE.baeckerei === 'hell' && SMOKE_STYLE.haus === 'duenn');
  check('Mühle arbeitet → dreht', working(mk('muehle', { status: 'ok', active: 0.4 })));
  check('Mühle ohne Getreide → steht', !working(mk('muehle', { status: 'rohstoff', active: 0.4 })));
}

// 5) Tippradius und Ergiebigkeitsfarbe
{
  check('nah (50 px je Feld): Grundradius 0,9', tapRadius(0.9, 50) === 0.9);
  check('weit (10 px je Feld): 24 px = 2,4 Felder', Math.abs(tapRadius(0.9, 10) - 2.4) < 1e-9);
  check('Ergiebigkeit: rot/gelb/grün wie beim Bauen', effColor(0.2) === 0xe2553f && effColor(0.6) === 0xe8b93a && effColor(0.9) === 0x7cc95a);
}

// 6) Im echten Spiel: Betrieb ohne Weg zeigt rot 🚧, fremde Gebäude zeigen nichts
{
  const g = Game.create(4242, 1);
  const N = g.size;
  let spot: [number, number] | null = null;
  for (let y = 10; y < N - 10 && !spot; y++) for (let x = 10; x < N - 10 && !spot; x++) {
    let ok = true;
    for (let j = 0; j < 2 && ok; j++) for (let i = 0; i < 5 && ok; i++) { const k = g.idx(x + i, y + j); if (g.tiles[k] !== T.Gras || g.occ[k] || g.roads[k]) ok = false; }
    if (ok) spot = [x, y];
  }
  check('freier Platz gefunden', !!spot);
  if (spot) {
    const a = g.placeNeutral('baeckerei', spot[0], spot[1], HUMAN);
    const b = g.placeNeutral('baeckerei', spot[0] + 3, spot[1], 1);
    for (let i = 0; i < 8; i++) g.tick(0.25);
    const signs = ownSigns(g, HUMAN);
    const mine = signs.find((s) => s.b === a);
    check('eigene Bäckerei ohne Weg: 🚧 rot', mine?.sign.icon === '🚧' && mine.sign.level === 3, JSON.stringify(mine?.sign));
    check('Gebäude des Gegners: kein Warnsymbol', !ownSigns(g, HUMAN).some((s) => s.b === b));
    check('Bäckerei ohne Arbeit raucht nicht', !!a && smokeStrength(a) === 0);
  }
}

// 7) Rauchpunkte der Meshy-Modelle (manifest.json „rauch“)
{
  const man = JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Record<string, { building?: BuildingId; rauch?: number[][] }>;
  const withSmoke = Object.entries(man).filter(([, e]) => e.rauch);
  check('Rauchpunkte für mehrere Meshy-Modelle', withSmoke.length >= 10, String(withSmoke.length));
  for (const [id, e] of withSmoke) {
    const okType = !!e.building && !!SMOKE_STYLE[e.building];
    const okPts = e.rauch!.every((p) => p.length === 3 && p.every((v) => Math.abs(v) <= 1.2) && p[1] > 0.2);
    check(`${id}: raucht (Art bekannt) und Punkte liegen oben im Modell`, okType && okPts, JSON.stringify(e.rauch));
  }
  // jedes Meshy-Modell einer rauchenden Gebäudeart hat Rauchpunkte (sonst raucht das Meshy-Gebäude nie)
  const missing = Object.entries(man).filter(([, e]) => e.building && SMOKE_STYLE[e.building] && !e.rauch).map(([id]) => id);
  check('kein Meshy-Modell einer rauchenden Art ohne Rauchpunkte', missing.length === 0, missing.join(', '));
  check('Gebäudearten mit Rauch gibt es alle', Object.keys(SMOKE_STYLE).every((t) => !!BUILDINGS[t as BuildingId]));
}

console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden');
process.exit(fails ? 1 : 0);
