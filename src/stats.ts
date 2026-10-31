// Statistik: Kassenbuch, Warenfluss, Verläufe und Bevölkerung je Stufe.
// GERÜST: Die Schnittstelle steht fest, die Werte kommen mit dem Paket S1 (bis dahin leer bzw. null).
// Wer bucht (z. B. der Handel über book), verliert nichts: S1 übernimmt das Erfassen.
import type { GoodId } from './data';
import { HUMAN, type Game } from './game';
import type { GameSystem } from './systems';

/** Warenfluss einer Ware auf einer Insel, je Spielminute */
export interface Flow {
  /** erzeugt pro Minute */
  prod: number;
  /** verbraucht pro Minute (Bewohner und Werkstätten) */
  use: number;
  /** prod − use */
  net: number;
  /** reicht der Vorrat noch so viele Minuten (null = wird nicht weniger) */
  minutes: number | null;
}

/** eine Zeile im Kassenbuch (eine Spielminute) */
export interface LedgerRow {
  /** Spielminute */
  t: number;
  /** Steuern je Stufe (Pioniere … Aristokraten) */
  steuern: number[];
  /** Unterhalt der Betriebe */
  betriebe: number;
  /** Unterhalt der öffentlichen Gebäude */
  dienste: number;
  /** Sold der Soldaten und Kosten des Militärs */
  militaer: number;
  /** Einnahmen und Ausgaben im Handel */
  handelEin: number;
  handelAus: number;
  /** Bauen und alles andere */
  sonstiges: number;
}

/** Bevölkerung einer Stufe */
export interface TierSummary {
  houses: number;
  residents: number;
  /** so viele Bewohner hätten in diesen Häusern Platz */
  max: number;
  /** mittlere Zufriedenheit 0..1 */
  happy: number;
  /** Häuser, die gerade aufsteigen könnten */
  ready: number;
  /** was fehlt, mit Anzahl betroffener Häuser */
  missing: { what: string; houses: number }[];
}

export interface PopSummary { tiers: TierSummary[] }

/**
 * Geld ins Kassenbuch buchen. kind = Art (z. B. 'handel', 'bauen'), taler > 0 Einnahme, < 0 Ausgabe.
 * Gerüst: wird noch nicht erfasst.
 */
export function book(_g: Game, _owner: number, _kind: string, _taler: number): void {
  // Gerüst: noch ohne Wirkung
}

/** Warenfluss je Ware auf einer Insel (owner, island) */
export function flows(_g: Game, _owner = HUMAN, _island = -1): Partial<Record<GoodId, Flow>> {
  return {};
}

/**
 * Verlauf eines Werts, ein Messpunkt je Spielminute (älteste zuerst, höchstens 120).
 * what: 'einwohner', 'geld', 'bilanz' oder eine Ware; island = -1 für alle Inseln.
 */
export function trend(_g: Game, _what: string, _owner = HUMAN, _island = -1): number[] {
  return [];
}

/** Bevölkerung je Stufe (Pioniere … Aristokraten); island = -1 für alle Inseln */
export function popSummary(_g: Game, _owner = HUMAN, _island = -1): PopSummary {
  return { tiers: [0, 1, 2, 3, 4].map(() => ({ houses: 0, residents: 0, max: 0, happy: 0, ready: 0, missing: [] })) };
}

/** Kassenbuch, eine Zeile je Spielminute (älteste zuerst) */
export function ledger(_g: Game, _owner = HUMAN): LedgerRow[] {
  return [];
}

/** Eintrag in der Liste der Spielteile (src/systems.ts) */
export const system: GameSystem = {
  id: 'stats',
};
