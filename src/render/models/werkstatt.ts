// Platzhalter – wird durch detaillierte Modelle ersetzt.
import { BuildingId, BUILDINGS } from '../../data';
import { Builder, M, ModelDef } from '../kit';

function placeholder(id: BuildingId): ModelDef {
  const s = BUILDINGS[id].size;
  const b = new Builder().ground(s, s, M.wiese);
  b.box(s * 0.6, 0.6, s * 0.5, M.putz, 0, 0, 0).roof(s * 0.6, 0.4, s * 0.5, M.ziegelRot, 0, 0.6, 0);
  return b.build();
}

export const WERKSTATT: Partial<Record<BuildingId, (tier: number) => ModelDef>> = {
  weberei: () => placeholder('weberei'),
  schmiede: () => placeholder('schmiede'),
  muehle: () => placeholder('muehle'),
  baeckerei: () => placeholder('baeckerei'),
  fleischerei: () => placeholder('fleischerei'),
  brauerei: () => placeholder('brauerei'),
};
