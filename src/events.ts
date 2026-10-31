// Ereignisse wie im Vorbild: Feuer, Pest, Kriminalität, Dürre, Schätze, Fluch der Ureinwohner.
// GERÜST: Die Schnittstelle steht fest, die Funktionen haben noch keine Wirkung (kommt mit dem Paket S3).
// Wer sie schon aufruft (Kampf: ignite, Grafik: iconFor/droughtOn, Infofenster: infoLines,
// Ureinwohner: curse), bekommt bis dahin harmlose Antworten.
// Die vorbereiteten Gebäude Feuerwehr, Arzt und Galgen meldet dieser Teil in „bereit“, sobald es ihn gibt.
import type { BuildingId } from './data';
import type { Building, Game } from './game';
import type { GameSystem } from './systems';

/**
 * Gebäude in Brand setzen (z. B. nach einem Kanonentreffer). true = es brennt jetzt.
 * Gerüst: noch ohne Wirkung.
 */
export function ignite(_g: Game, _b: Building): boolean {
  return false;
}

/** Symbol über dem Gebäude für ein laufendes Ereignis (🔥 Feuer, 💀 Pest …); '' = keins */
export function iconFor(_g: Game, _b: Building): string {
  return '';
}

/** Zeilen fürs Infofenster eines Gebäudes, z. B. „Brennt – Feuerwehr fehlt“ */
export function infoLines(_g: Game, _b: Building): string[] {
  return [];
}

/**
 * Fluch der Ureinwohner über einen Spieler: für eine Weile häufiger Feuer, Pest und Dürre.
 * seconds = Dauer in Spielsekunden (Vorbild-nah: 20 Minuten).
 */
export function curse(_g: Game, _owner: number, _seconds = 1200): void {
  // Gerüst: noch ohne Wirkung
}

/** Herrscht gerade Dürre auf der Insel? (für Ernten und die Bodenfarbe) */
export function droughtOn(_g: Game, _island: number): boolean {
  return false;
}

/** Eintrag in der Liste der Spielteile (src/systems.ts); bereit: später Feuerwehr, Arzt, Galgen */
export const system: GameSystem = {
  id: 'events',
  bereit: (): readonly BuildingId[] => [],
};
