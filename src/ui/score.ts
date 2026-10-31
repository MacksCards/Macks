// GERÜST für die Endwertung (Paket S5): Punkte, Spielziel, Rangliste.
// Einstieg: Menüpunkt „🏆 Punkte“ (ui/windows.ts) – versteckt, solange `ready` false ist.
// So füllen: html() liefern, `ready` auf true setzen.
import './score.css';
import type { UI } from '../ui';
import { Part } from './util';

export class ScoreWindow implements Part {
  constructor(readonly ui: UI) {}

  /** noch leer – kein Menüpunkt */
  get ready(): boolean { return false; }

  open() {
    const ui = this.ui;
    ui.dialog({ title: '🏆 Punkte', cls: 'score', body: this.html(), foot: `<button class="btn wide ok" id="scoreX">▶️ Weiterspielen</button>` });
    document.getElementById('scoreX')?.addEventListener('click', () => ui.closeModal());
  }

  /** Inhalt des Fensters (füllt S5) */
  html(): string { return ''; }
}
