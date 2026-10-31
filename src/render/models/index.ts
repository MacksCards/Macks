// Gebäudemodelle aus Code. Sie dienen als Platzhalter, bis die Meshy-Modelle
// (public/models/*.glb, siehe glb.ts) geladen sind.
import { BuildingId, BUILDINGS } from '../../data';
import { Builder, M, ModelDef } from '../kit';
import { buildingGeometry, makeMillBlades } from '../models_old';
import { burg, festung, grosseBurg, holztor, holzturm, palisade, steinmauer, steinturm, steintor, steintorKlein, triumphbogen } from './militaer';

/** Militärbauten; bei Mauern/Palisaden ist variant die Nachbarmaske */
const MILITAER: Partial<Record<BuildingId, (variant: number) => ModelDef>> = {
  palisade, steinmauer, holztor, steintor_klein: steintorKlein, steintor, holzturm, wachturm: steinturm, burg, grosseburg: grosseBurg, festung, triumphbogen,
};
/** Gebäude, die sich wie Mauern mit Nachbarn verbinden */
export const WALLS = new Set<BuildingId>(['palisade', 'steinmauer']);
/** Teile, an die Mauern anschließen */
export const WALL_LINKS = new Set<BuildingId>(['palisade', 'steinmauer', 'holztor', 'steintor_klein', 'steintor', 'holzturm', 'wachturm']);

const KNOWN: BuildingId[] = ['haus', 'kontor', 'markt', 'kapelle', 'wirtshaus', 'holzfaeller', 'fischer', 'schaffarm',
  'getreidefarm', 'weberei', 'steinbruch', 'erzmine', 'schmiede', 'muehle', 'baeckerei'];

const cache = new Map<string, ModelDef>();

const CROP: Partial<Record<BuildingId, number>> = {
  tabakplantage: 0x7f8f3a, zuckerrohrplantage: 0x9cc35a, weingut: 0x5d3b6b, gewuerzplantage: 0xb5462c,
  kakaoplantage: 0x6b4426, baumwollplantage: 0xf2efe6, getreidefarm: 0xe3c35a,
};

function placeholder(id: BuildingId): ModelDef {
  const d = BUILDINGS[id];
  const s = d.size;
  const b = new Builder();
  const mil = MILITAER[id];
  if (mil) return mil(0);
  if (id === 'werft' || id === 'grosswerft') {
    b.ground(s, s, M.bretter);
    b.box(1.2, 0.8, 1.0, M.bretterDunkel, -0.8, 0, -0.8);
    b.roof(1.2, 0.5, 1.0, M.ziegelRot, -0.8, 0.8, -0.8);
    // Schiffsrumpf im Bau auf der Helling
    b.box(0.8, 0.35, 1.9, M.bretterDunkel, 0.5, 0.05, 0.2);
    for (let i = 0; i < 5; i++) b.box(0.9, 0.5, 0.05, M.holz, 0.5, 0.05, -0.6 + i * 0.4);
    b.cyl(0.03, 0.03, 1.4, 5, M.dunkelholz, 0.5, 0.4, 0.2);
    b.crate(-0.9, 0.7); b.woodpile(-0.2, 1.0);
    return b.build();
  }
  if (CROP[id]) {
    // Hof mit Feldreihen in der Farbe der Pflanze
    b.ground(s, s, M.acker);
    for (let i = 0; i < 6; i++) b.box(1.7, 0.18 + (i % 2) * 0.05, 0.26, { c: CROP[id]!, p: 10 }, 0.45, 0, -1.1 + i * 0.44);
    b.box(0.9, 0.6, 0.85, M.putz, -0.95, 0, -0.8);
    b.roof(0.9, 0.45, 0.85, M.stroh, -0.95, 0.6, -0.8);
    b.door(-0.95, 0, -0.37, 0);
    return b.build();
  }
  b.ground(s, s, d.category === 'oeffentlich' ? M.pflaster : M.wiese);
  const w = s * 0.62, dd = s * 0.48, h = d.category === 'oeffentlich' ? 0.9 : 0.65;
  b.box(w, h, dd, d.stock ? M.putz : M.mauer, 0, 0, -0.1).roof(w, 0.45, dd, d.category === 'oeffentlich' ? M.schiefer : M.ziegelRot, 0, h, -0.1);
  b.timber(w, h, 0, 0, dd / 2 - 0.1 + 0.01, 0, 3);
  b.door(0, 0, dd / 2 - 0.1, 0);
  b.window(-w / 3, h * 0.7, dd / 2 - 0.09, 0);
  b.window(w / 3, h * 0.7, dd / 2 - 0.09, 0);
  if (id === 'schweinezucht') {
    const q = s / 2 - 0.1;
    b.fence(-q, -q, q, -q).fence(q, -q, q, q).fence(q, q, -q, q).fence(-q, q, -q, -q);
  }
  if (d.category === 'werkstatt' || id === 'baeckerei' || id === 'fleischerei') b.chimney(w * 0.25, h + 0.1, -0.2, 0.45);
  if (d.category === 'oeffentlich') { b.box(0.35, h + 0.9, 0.35, M.mauer, -w / 2 + 0.2, 0, -0.1 - dd / 2 + 0.2); b.cone(0.3, 0.5, 4, M.schiefer, -w / 2 + 0.2, h + 0.9, -0.1 - dd / 2 + 0.2, Math.PI / 4); }
  return b.build();
}

export function buildingModel(type: BuildingId, tier = 0): ModelDef {
  const key = `${type}:${tier}`;
  let m = cache.get(key);
  if (m) return m;
  if (WALLS.has(type)) { m = MILITAER[type]!(tier); cache.set(key, m); return m; }
  if (KNOWN.includes(type)) {
    m = { geo: buildingGeometry(type, Math.min(tier, 2)), smoke: [], spinners: [] };
    if (type === 'muehle') m.spinners.push({ geo: makeMillBlades(), pos: [0, 1.4, 0.62], axis: 'z', speed: 1.2 });
  } else m = placeholder(type);
  cache.set(key, m);
  return m;
}
