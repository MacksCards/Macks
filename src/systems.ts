// Andockstelle für Spielteile: Ereignisse, Statistik, Handel, Punkte, Ureinwohner …
// Jeder Spielteil lebt in seiner eigenen Datei und meldet sich hier mit einem Eintrag an.
// game.ts ruft die Einträge an festen Stellen auf, ohne die Teile im Einzelnen zu kennen:
//   tick       – jeden Rechenschritt (nach allem anderen), dt in Spielsekunden
//   afterPlace – nach jedem erfolgreichen Bau (place und jedes Teil von placeMany; nicht placeNeutral)
//   save/load  – eigener Zustand im Spielstand (SaveData.ext[id]); load kommt auch bei neuen Spielen (mit undefined)
//   bereit     – vorbereitete Gebäude (BuildingDef.geplant), die dieser Teil schon unterstützt:
//                erst dann erscheinen sie im Baumenü und lassen sich bauen
// Regel: Signaturen später nur erweitern, nicht ändern (andere Teile verlassen sich darauf).
import type { BuildingId } from './data';
import type { Building, Game } from './game';
import { system as events } from './events';
import { system as stats } from './stats';
import { system as trade } from './trade';
import { system as score } from './score';
import { system as natives } from './natives';

export interface GameSystem {
  /** eindeutiger Name, zugleich Schlüssel im Spielstand */
  id: string;
  tick?(g: Game, dt: number): void;
  afterPlace?(g: Game, b: Building): void;
  /** Zustand als JSON-fähiger Wert; undefined = nichts speichern */
  save?(g: Game): unknown;
  /** Zustand übernehmen; data fehlt (undefined) bei neuen Spielen und alten Spielständen */
  load?(g: Game, data: unknown): void;
  /** vorbereitete Gebäude, die dieser Spielteil schon unterstützt */
  bereit?(g: Game): readonly BuildingId[];
}

/** alle Spielteile in fester Reihenfolge */
export const SYSTEMS: readonly GameSystem[] = [events, stats, trade, score, natives];
