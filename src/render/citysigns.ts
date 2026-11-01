// Stadtleben – die Regeln hinter den Bildern (ohne Grafik, damit sie sich ohne Browser prüfen lassen):
// welches Warnsymbol mit welcher Dringlichkeit über einem Gebäude steht, wie Warnungen beim
// Herauszoomen zu Sammelmarken werden, welche Symbole über einer entdeckten Insel stehen,
// welcher Schornstein wie stark raucht, ob sich die Mühle dreht und wie groß der Tippbereich ist.
import { BUILDINGS, BuildingId, GOOD } from '../data';
import type { Building, Game } from '../game';
import { PFLANZEN, Pflanze } from '../world';
import type { Island } from '../world';

/** Dringlichkeit: 0 = nichts, 1 = grau (Hinweis), 2 = gelb (eingeschränkt), 3 = rot (steht still / Bewohner ziehen weg) */
export type Urgency = 0 | 1 | 2 | 3;
export interface Sign { icon: string; level: Urgency }

/** Ringfarbe je Dringlichkeit */
export const URGENCY_COLOR: Record<Urgency, string> = { 0: '#ffffff', 1: '#8d8a84', 2: '#e3a72f', 3: '#d23a2c' };

/** Zufriedenheit, unter der ein Haus ein gelbes bzw. rotes Gesicht zeigt (rot: Bewohner ziehen weg) */
export const HAPPY_YELLOW = 0.7, HAPPY_RED = 0.45;
/** Ab diesem Kameraabstand werden Warnungen zu Sammelmarken je CLUSTER × CLUSTER Felder zusammengefasst */
export const CLUSTER_DIST = 40, CLUSTER = 6;
/** Ab diesem Kameraabstand stehen Symbole (Erz, Gold, Pflanzen) über entdeckten Inseln */
export const ISLAND_DIST = 20;
/** Ab diesem Kameraabstand bekommen eigene Soldaten eine Marke (28 px), die man antippen kann */
export const UNIT_MARK_DIST = 45, UNIT_MARK_PX = 28;
/** Rauch nur bis zu diesem Kameraabstand (weiter weg sieht man ihn kaum, spart Rechenzeit) */
export const SMOKE_DIST = 45;

const HARVEST_ICON: Record<string, string> = { baum: '🌲', fisch: '🐟', wild: '🦌', weide: '🌿', feld: '🌾' };

/**
 * Warnsymbol über einem eigenen Gebäude. eventIcon = Symbol eines laufenden Ereignisses (🔥 Brand, 💀 Pest …,
 * kommt aus events.iconFor) – es geht allem anderen vor und ist immer rot.
 */
export function buildingSign(b: Building, eventIcon = ''): Sign | null {
  if (eventIcon) return { icon: eventIcon, level: 3 };
  const d = BUILDINGS[b.type];
  switch (b.status) {
    case 'keinWeg': return { icon: '🚧', level: 3 };
    case 'rohstoff': return { icon: b.missing[0] ? GOOD[b.missing[0]].icon : '📦', level: 3 };
    case 'keinWald': return { icon: '🌲', level: 3 };
    case 'keinWasser': return { icon: '🌊', level: 3 };
    case 'erschoepft': return { icon: d.deposit ? '⛏️' : HARVEST_ICON[d.harvest?.res ?? 'baum'], level: 3 };
    // Lager des Betriebs voll: er wartet auf den Marktkarren – arbeitet also nur eingeschränkt
    case 'lagerVoll': return { icon: '📦', level: 2 };
    case 'wohnen':
      if (b.happy < HAPPY_RED) return { icon: '😠', level: 3 };
      if (b.happy < HAPPY_YELLOW) return { icon: '😐', level: 2 };
      return null;
    case 'ok':
      // arbeitet, aber hier wächst wenig nach (zu dicht gebaut, wenig Wald/Fisch …): nur ein Hinweis
      if (d.harvest && b.eff < 0.5) return { icon: HARVEST_ICON[d.harvest.res] ?? '⚠️', level: 1 };
      return null;
  }
  return null;
}

export interface Pin { x: number; z: number; level: Urgency; icon: string }
export interface Cluster { x: number; z: number; count: number; level: Urgency; icon: string }

/**
 * Warnungen zu Sammelmarken je cell × cell Felder zusammenfassen: Marke in der Mitte der Warnungen,
 * Zahl = wie viele, Farbe = die dringendste, Symbol = das der dringendsten.
 */
export function clusterPins(pins: readonly Pin[], cell = CLUSTER): Cluster[] {
  const map = new Map<number, Cluster & { sx: number; sz: number }>();
  for (const p of pins) {
    const key = Math.floor(p.x / cell) * 4096 + Math.floor(p.z / cell);
    let c = map.get(key);
    if (!c) { c = { x: 0, z: 0, sx: 0, sz: 0, count: 0, level: 0, icon: p.icon }; map.set(key, c); }
    c.count++; c.sx += p.x; c.sz += p.z;
    if (p.level > c.level) { c.level = p.level; c.icon = p.icon; }
  }
  return [...map.values()].map((c) => ({ x: c.sx / c.count, z: c.sz / c.count, count: c.count, level: c.level, icon: c.icon }));
}

export interface IslandSymbol { icon: string; text: string }

/** Symbole über einer entdeckten Insel: Erz (Hacke), Gold, Pflanzen mit Fruchtbarkeit in Prozent (beste zuerst) */
export function islandSymbols(il: Island): IslandSymbol[] {
  const out: IslandSymbol[] = [];
  if (il.erz > 0 || il.erzDeep > 0 || il.erzEndlos) out.push({ icon: '⛏️', text: 'Erz' });
  if (il.gold > 0) out.push({ icon: '🥇', text: 'Gold' });
  const plants = (Object.entries(il.frucht) as [Pflanze, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  for (const [p, v] of plants) out.push({ icon: PFLANZEN[p].icon, text: `${v} %` });
  return out;
}

export type SmokeStyle = 'dunkel' | 'mittel' | 'hell' | 'duenn';

/** Welcher Rauch aus welchem Gebäude kommt (fehlt = raucht nicht) */
export const SMOKE_STYLE: Partial<Record<BuildingId, SmokeStyle>> = {
  erzschmelze: 'dunkel', schmiede: 'dunkel', schwertschmiede: 'dunkel', buechsenmacher: 'dunkel', kanonengiesserei: 'dunkel',
  brauerei: 'mittel', rumbrennerei: 'mittel', tabakwaren: 'mittel', fleischerei: 'mittel', goldschmied: 'mittel', wirtshaus: 'mittel',
  baeckerei: 'hell',
  haus: 'duenn',
};

/** Arbeitet der Betrieb gerade sichtbar? (Mühle dreht sich, Schornstein raucht) */
export function working(b: Building): boolean {
  return b.status === 'ok' && b.active > 0.05;
}

/**
 * Wie stark ein Gebäude raucht (0 = gar nicht, 1 = voll): Betriebe nur, wenn sie arbeiten (mehr Arbeit,
 * mehr Rauch); Wohnhäuser, solange jemand darin wohnt (höhere Stufen etwas mehr); das Wirtshaus immer.
 */
export function smokeStrength(b: Building): number {
  const style = SMOKE_STYLE[b.type];
  if (!style) return 0;
  if (b.type === 'haus') return b.residents > 0 ? 0.55 + b.tier * 0.1 : 0;
  if (b.type === 'wirtshaus') return 0.7;
  return working(b) ? Math.min(1, Math.max(0.4, b.active * 1.3)) : 0;
}

/** Farbe des Ergiebigkeits-Rings (wie die Skala beim Bauen): rot unter 40 %, gelb unter 75 %, sonst grün */
export function effColor(eff: number): number {
  return eff < 0.4 ? 0xe2553f : eff < 0.75 ? 0xe8b93a : 0x7cc95a;
}

/** Tippradius für Soldaten in Feldern: mindestens base, aber nie weniger als minPx Bildpunkte (Fingerbreite) */
export function tapRadius(base: number, pxPerTile: number, minPx = 24): number {
  return Math.max(base, minPx / Math.max(1e-3, pxPerTile));
}

/** Sichtbare Warnungen eines Spielers (für Tests): Gebäude mit Symbol */
export function ownSigns(g: Game, owner: number, eventIcon: (b: Building) => string = () => ''): { b: Building; sign: Sign }[] {
  const out: { b: Building; sign: Sign }[] = [];
  for (const b of g.buildings) {
    if (b.owner !== owner) continue;
    const s = buildingSign(b, eventIcon(b));
    if (s) out.push({ b, sign: s });
  }
  return out;
}
