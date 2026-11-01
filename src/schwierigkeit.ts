// Schwierigkeit beim Spielstart (Paket P1). Entscheidung des Nutzers vom 31.10.2026:
// leicht / normal / schwer mit 20 000 / 15 000 / 10 000 Talern Startgeld; Standard „normal“:
// Computergegner wachsen bis zu den Kaufleuten, besiedeln 2 bis 3 Inseln und greifen nur nach
// einer Vorwarnung an; Ereignisse (Feuer, Pest …) standardmäßig „mild“.
// Die Werte für die Computergegner (höchste Stufe, Zahl der Inseln, Angriff) liest später das
// Paket KI2 über kiGrenzen(); heute wirken schon Startgeld, Kasse der Gegner, Belohnung der
// Aufgaben und die Schonzeit vor den Piraten.
import type { Game, Schwierigkeit } from './game';

export interface Stufenwerte {
  /** Anzeige im Fenster „Neues Spiel“ */
  name: string;
  /** kurze Erklärung (einfaches Deutsch) – nur, was heute schon wirkt; KI2 ergänzt die Gegner */
  text: string;
  /** Startgeld des Spielers (Taler) */
  startgeld: number;
  /** Startkasse der Computergegner im Verhältnis zum bisherigen Startgeld */
  kiKasse: number;
  /** Belohnung für erledigte Aufgaben (Faktor) */
  belohnung: number;
  /** höchste Bewohnerstufe der Computergegner (0 = Pioniere … 4 = Aristokraten) */
  kiStufe: number;
  /** so viele Inseln besiedeln die Computergegner höchstens */
  kiInseln: [number, number];
  /** Angriffe der Computergegner: nur nach Vorwarnung; „spaet“ = erst nach einer langen Schonzeit */
  kiAngriff: 'spaet' | 'vorwarnung';
  /** Spielsekunden, bevor frühestens Piraten auftauchen (mindestens die Schonzeit des Kampfteils) */
  piratenAb: number;
}

export const SCHWIERIGKEIT: Readonly<Record<Schwierigkeit, Stufenwerte>> = Object.freeze({
  leicht: {
    name: 'Leicht', text: 'Mehr Geld, Gegner mit kleinerer Kasse, Piraten erst nach etwa einer Stunde.',
    startgeld: 20000, kiKasse: 0.75, belohnung: 1, kiStufe: 2, kiInseln: [1, 2], kiAngriff: 'spaet', piratenAb: 3600,
  },
  normal: {
    name: 'Normal', text: 'Das ausgewogene Spiel. Piraten nach etwa einer halben Stunde.',
    startgeld: 15000, kiKasse: 1, belohnung: 1, kiStufe: 3, kiInseln: [2, 3], kiAngriff: 'vorwarnung', piratenAb: 1800,
  },
  schwer: {
    name: 'Schwer', text: 'Wenig Geld, Gegner mit größerer Kasse, halbe Belohnung für Aufgaben.',
    startgeld: 10000, kiKasse: 1.5, belohnung: 0.5, kiStufe: 4, kiInseln: [3, 4], kiAngriff: 'vorwarnung', piratenAb: 1800,
  },
});

export const STUFEN: readonly Schwierigkeit[] = ['leicht', 'normal', 'schwer'];

/** Werte zur gewählten Schwierigkeit (unbekannter Wert = normal) */
export function stufe(s: Schwierigkeit | string | undefined): Stufenwerte {
  return SCHWIERIGKEIT[(s as Schwierigkeit)] ?? SCHWIERIGKEIT.normal;
}

/** Grenzen der Computergegner in diesem Spiel (für das Paket KI2) */
export function kiGrenzen(g: Game): { stufe: number; inseln: [number, number]; angriff: Stufenwerte['kiAngriff'] } {
  const w = stufe(g.opts.schwierigkeit);
  return { stufe: w.kiStufe, inseln: w.kiInseln, angriff: w.kiAngriff };
}
