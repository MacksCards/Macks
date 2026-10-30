// Gebäudemodelle aus Code. Sie dienen als Platzhalter, bis die Meshy-Modelle
// (public/models/*.glb, siehe glb.ts) geladen sind.
import { BuildingId, BUILDINGS } from '../../data';
import { Builder, M, ModelDef } from '../kit';
import { buildingGeometry, makeMillBlades } from '../models_old';

const KNOWN: BuildingId[] = ['haus', 'kontor', 'markt', 'kapelle', 'wirtshaus', 'holzfaeller', 'fischer', 'schaffarm',
  'getreidefarm', 'weberei', 'steinbruch', 'erzmine', 'schmiede', 'muehle', 'baeckerei'];

const cache = new Map<string, ModelDef>();

function placeholder(id: BuildingId): ModelDef {
  const s = BUILDINGS[id].size;
  const b = new Builder().ground(s, s, M.wiese);
  b.box(s * 0.55, 0.6, s * 0.45, M.putz, 0, 0, -0.1).roof(s * 0.55, 0.45, s * 0.45, M.ziegelRot, 0, 0.6, -0.1);
  b.door(0, 0, s * 0.45 / 2 - 0.1, 0);
  if (id === 'schweinezucht' || id === 'rinderfarm') {
    const h = s / 2 - 0.1;
    b.fence(-h, -h, h, -h).fence(h, -h, h, h).fence(h, h, -h, h).fence(-h, h, -h, -h);
  }
  b.chimney(s * 0.15, 0.7, -0.2, 0.4);
  return b.build();
}

export function buildingModel(type: BuildingId, tier = 0): ModelDef {
  const key = `${type}:${tier}`;
  let m = cache.get(key);
  if (m) return m;
  if (KNOWN.includes(type)) {
    m = { geo: buildingGeometry(type, Math.min(tier, 2)), smoke: [], spinners: [] };
    if (type === 'muehle') m.spinners.push({ geo: makeMillBlades(), pos: [0, 1.4, 0.62], axis: 'z', speed: 1.2 });
  } else m = placeholder(type);
  cache.set(key, m);
  return m;
}
