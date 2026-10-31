// GERÜST für „Flotte & Inseln“ (Paket U3): Schiffe (Ort, Ziel, Ladung, Kanonen, Zustand) und Inseln mit Kontor.
// Einstiege: Knopf ⛵ in der Oberleiste und Tipp auf den Inselnamen (ui/hud.ts) – beide versteckt bzw.
// ohne Wirkung, solange `ready` false ist.
// So füllen: html() liefern, `ready` auf true setzen.
import './fleet.css';
import type { UI } from '../ui';
import { Part } from './util';

export type FleetTab = 'schiffe' | 'inseln';

export class FleetWindow implements Part {
  constructor(readonly ui: UI) {}

  /** noch leer – Knopf ⛵ versteckt, Inselname nicht antippbar */
  get ready(): boolean { return false; }

  /** Fenster öffnen (⛵ → Schiffe, Inselname → Inseln) */
  open(tab: FleetTab = 'schiffe') {
    const ui = this.ui;
    ui.dialog({ title: '⛵ Flotte &amp; Inseln', cls: 'fleet', body: this.html(tab), foot: `<button class="btn wide ok" id="fleetX">▶️ Weiterspielen</button>` });
    document.getElementById('fleetX')?.addEventListener('click', () => ui.closeModal());
  }

  /** Inhalt des Fensters (füllt U3) */
  html(_tab: FleetTab): string { return ''; }
}
