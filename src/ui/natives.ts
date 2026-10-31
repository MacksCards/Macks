// GERÜST für die Ureinwohner (Paket S4): Tipp auf eine Häuptlingshütte öffnet Tausch und Beziehung.
// Einstieg: im Kern (ui.ts, Tippen) – solange `ready` false ist, zeigt der Tipp die normale Gebäude-Info.
// So füllen: html() liefern, `ready` auf true setzen.
import './natives.css';
import type { Building } from '../game';
import type { UI } from '../ui';
import { Part } from './util';

export class NativesWindow implements Part {
  constructor(readonly ui: UI) {}

  /** noch leer – keine eigene Ansicht */
  get ready(): boolean { return false; }

  /** Häuptlingshütte? (die Gebäudeart „haeuptling“ bringt das Spiellogik-Paket mit) */
  isHut(b: Building): boolean { return (b.type as string) === 'haeuptling'; }

  open(b: Building) {
    const ui = this.ui;
    ui.dialog({ title: '🪶 Häuptling', cls: 'natives', body: this.html(b), foot: `<button class="btn wide ok" id="nativesX">▶️ Weiterspielen</button>` });
    document.getElementById('nativesX')?.addEventListener('click', () => ui.closeModal());
  }

  /** Inhalt des Fensters (füllt S4) */
  html(_b: Building): string { return ''; }
}
