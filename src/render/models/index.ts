// Verzeichnis aller Gebäudemodelle. Die Modelle selbst liegen in wohnen.ts, rohstoffe.ts, werkstatt.ts.
import { BuildingId } from '../../data';
import { Builder, M, ModelDef } from '../kit';
import { WOHNEN } from './wohnen';
import { ROHSTOFFE } from './rohstoffe';
import { WERKSTATT } from './werkstatt';

export type ModelFn = (tier: number) => ModelDef;

const ALL: Partial<Record<BuildingId, ModelFn>> = { ...WOHNEN, ...ROHSTOFFE, ...WERKSTATT };
const cache = new Map<string, ModelDef>();

export function buildingModel(type: BuildingId, tier = 0): ModelDef {
  const key = `${type}:${tier}`;
  let m = cache.get(key);
  if (m) return m;
  const fn = ALL[type];
  m = fn ? fn(tier) : new Builder().ground(1, 1, M.pflaster).build();
  cache.set(key, m);
  return m;
}
