// GERÜST für das Statistik-Fenster (Paket U2): Bilanz, Waren, Bevölkerung, Vergleich mit den Gegnern.
// Einstieg: Tipp auf Geld oder Einwohner in der Oberleiste (ui/hud.ts).
// Solange `ready` false ist, öffnet derselbe Tipp wie bisher „Lager & Bilanz“ – kein leeres Fenster.
// So füllen: html() liefern, `ready` auf true setzen; das offene Fenster hält das Spiel an (wie jedes Fenster).
import './stats.css';
import type { UI } from '../ui';
import { Part } from './util';

/** Reiter: Geld → Bilanz, Einwohner → Bevölkerung */
export type StatsTab = 'geld' | 'einwohner' | 'waren' | 'vergleich';

export class StatsWindow implements Part {
  constructor(readonly ui: UI) {}

  /** noch leer – der Tipp auf Geld oder Einwohner zeigt weiter Lager & Bilanz */
  get ready(): boolean { return false; }

  /** Fenster öffnen; tab = womit es beginnt */
  open(tab: StatsTab = 'geld') {
    const ui = this.ui;
    ui.dialog({ title: '📊 Statistik', cls: 'stats', body: this.html(tab), foot: `<button class="btn wide ok" id="statsX">▶️ Weiterspielen</button>` });
    document.getElementById('statsX')?.addEventListener('click', () => ui.closeModal());
  }

  /** Inhalt des Fensters (füllt U2) */
  html(_tab: StatsTab): string { return ''; }
}
