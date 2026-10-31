// Handel wie im Vorbild: freier Händler mit Schiff, Kauf- und Verkaufsaufträge am Kontor, Handelsrouten.
// GERÜST: Die Schnittstelle steht fest, der Händler fährt noch nicht (kommt mit dem Paket S2).
// Bis dahin bleibt der Sofort-Handel am Kontor (Game.trade) ohne Aufschlag: notFaktor() = 1.
import type { GoodId } from './data';
import type { Building, Game, Ship } from './game';
import type { GameSystem } from './systems';

/** Auftrag am Kontor: kaufen bis zur Schwelle oder verkaufen über der Schwelle, zum Preis in Taler je Tonne */
export interface TradeOrder {
  g: GoodId;
  /** true = kaufen, false = verkaufen */
  buy: boolean;
  /** kaufen bis zu so vielen Tonnen im Lager bzw. verkaufen, was darüber liegt */
  limit: number;
  /** Preis je Tonne */
  price: number;
}

/** ein Halt einer Handelsroute */
export interface RouteStop {
  /** Kontor (Gebäude-id) */
  kontor: number;
  /** hier einladen: Ware → Tonnen */
  laden: Partial<Record<GoodId, number>>;
  /** hier ausladen: Ware → Tonnen */
  entladen: Partial<Record<GoodId, number>>;
}

/** Handelsroute eines Schiffs (2–4 Halte) */
export interface TradeRoute {
  stops: RouteStop[];
  /** läuft (true) oder pausiert */
  on: boolean;
  /** nächster Halt (Index in stops) */
  next: number;
  /** warum es gerade nicht weitergeht (z. B. „Ziel voll“), sonst leer */
  blocked?: string;
}

/** Preisliste eines Händlers: Taler je Tonne */
export type PriceTable = Partial<Record<GoodId, { kaufen: number; verkaufen: number }>>;

/** Ergebnis eines Händlerbesuchs */
export interface VisitResult { tons: number; taler: number }

/** Aufträge eines Kontors (leer, solange es keinen fahrenden Händler gibt) */
export function orders(_g: Game, _kontor: Building): TradeOrder[] {
  return [];
}

/** Handelsroute eines Schiffs (null = keine) */
export function route(_g: Game, _ship: Ship): TradeRoute | null {
  return null;
}

/**
 * Ein Händler besucht ein Kontor und handelt nach dessen Aufträgen. prices = eigene Preisliste
 * (z. B. für KI-Händler mit Handelsvertrag), sonst die des freien Händlers.
 * Gerüst: handelt noch nicht.
 */
export function visit(_g: Game, _kontor: Building, _prices?: PriceTable): VisitResult {
  return { tons: 0, taler: 0 };
}

/** Aufschlag für den Sofort-Handel am Kontor (1 = keiner; teurer, sobald Händlerschiffe fahren) */
export function notFaktor(_g?: Game): number {
  return 1;
}

/** Eintrag in der Liste der Spielteile (src/systems.ts) */
export const system: GameSystem = {
  id: 'trade',
};
