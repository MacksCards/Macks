// Ureinwohner wie im Vorbild: Dörfer auf manchen Inseln, Tausch an der Häuptlingshütte, Fluch bei Angriff.
// GERÜST: Die Schnittstelle steht fest, Dörfer gibt es noch nicht (kommt mit dem Paket S4).
// Die vorbereiteten Gebäude „Hütte“ und „Häuptlingshütte“ meldet dieser Teil in „bereit“, sobald es ihn gibt;
// gesetzt werden sie mit Game.placeNeutral für einen Spieler mit dem Kennzeichen natives.
import type { BuildingId, GoodId } from './data';
import type { Building, Game } from './game';
import type { GameSystem } from './systems';

/** ein Dorf der Ureinwohner */
export interface NativeVillage {
  island: number;
  /** Spieler mit dem Kennzeichen natives */
  owner: number;
  /** Häuptlingshütte (Gebäude-id) */
  chief: number;
  /** Hütten (Gebäude-ids) */
  huts: number[];
  /** diese Waren wünschen sie */
  wants: GoodId[];
  /** diese Waren geben sie dafür */
  gives: GoodId[];
  /** nach einem Angriff: nie wieder Handel */
  hostile: boolean;
}

/** Tauschangebot an der Häuptlingshütte */
export interface NativeOffer {
  village: NativeVillage;
  /** für 1 t gewünschte Ware gibt es so viele Tonnen zurück */
  rate: number;
  /** kann jetzt getauscht werden (Schiff oder Kontor nahe genug)? */
  ok: boolean;
  /** warum nicht */
  reason?: string;
}

/** Dorf auf einer Insel (null = keins) */
export function village(_g: Game, _island: number): NativeVillage | null {
  return null;
}

/** Tausch an einer Häuptlingshütte öffnen (null = kein Dorf bzw. kein Handel möglich) */
export function open(_g: Game, _chief: Building): NativeOffer | null {
  return null;
}

/** Eintrag in der Liste der Spielteile (src/systems.ts); bereit: später Hütte und Häuptlingshütte */
export const system: GameSystem = {
  id: 'natives',
  bereit: (): readonly BuildingId[] => [],
};
