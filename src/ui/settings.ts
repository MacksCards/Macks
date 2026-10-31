// Einstellungen beim Spielstart: heute das Fenster „Neues Spiel“ mit der Zahl der Konkurrenten.
// Paket P1 erweitert es (Schwierigkeit, Piraten, Ereignisse, Spielziel, Weltgröße, Spielstände, Grafik).
import './settings.css';
import { Game, newSeed } from '../game';
import type { UI } from '../ui';
import { $, Part } from './util';

export class SettingsWindow implements Part {
  constructor(readonly ui: UI) {}

  get ready(): boolean { return true; }

  /** „Neues Spiel“: eine neue Inselwelt; back = was „Abbrechen“ danach öffnet (z. B. das Menü) */
  open(back?: () => void) {
    const ui = this.ui;
    const box = ui.dialog({
      title: '🏝️ Neues Spiel', cls: 'settings',
      body: `<p class="sub">Eine neue Inselwelt. Dein aktuelles Spiel geht dabei verloren.</p>
        <p>Wie viele Konkurrenten sollen mitspielen?</p>
        <div class="row2">${[0, 1, 2, 3].map((n) => `<button class="btn ${n === 2 ? 'ok' : ''}" data-opp="${n}">${n}</button>`).join('')}</div>`,
      foot: `<button class="btn wide" id="newX">Abbrechen</button>`,
    });
    $('#newX').addEventListener('click', () => { ui.closeModal(); back?.(); });
    box.querySelectorAll<HTMLElement>('[data-opp]').forEach((bt) => bt.addEventListener('click', () => {
      Game.clearSave();
      ui.onNewGame(Game.create(newSeed(), Number(bt.dataset.opp)));
      ui.closeModal();
      ui.toast('Eine neue Inselwelt wartet auf dich!', 'good');
    }));
  }
}
