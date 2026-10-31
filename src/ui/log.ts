// GERÜST für den Meldungsverlauf (Paket U3). Jede Meldung landet schon jetzt hier:
// ui.toast(text, art, ort) → log.add(text, art, ort), mit Spielzeit; die letzten 60 bleiben.
// Einstieg: Glocke 🔔 in der Oberleiste (ui/hud.ts, mit Zahl der ungelesenen) – versteckt, solange `ready` false ist.
// So füllen: html() liefern (Liste, „Hinschauen“ springt zum Ort), `ready` auf true setzen.
import './log.css';
import type { UI } from '../ui';
import { Art, Ort, Part } from './util';

export interface LogEntry {
  text: string;
  kind: Art;
  /** Ort des Ereignisses in Spielfeldern, falls bekannt */
  at?: Ort;
  /** Spielzeit in Sekunden */
  time: number;
  read: boolean;
}

/** so viele Meldungen merkt sich der Verlauf */
export const LOG_MAX = 60;

export class LogBook implements Part {
  readonly entries: LogEntry[] = [];

  constructor(readonly ui: UI) {}

  /** noch leer – die Glocke bleibt versteckt */
  get ready(): boolean { return false; }

  /** ungelesene Meldungen (Zahl an der Glocke) */
  get unread(): number { return this.entries.reduce((n, e) => n + (e.read ? 0 : 1), 0); }

  /** neue Meldung merken (ruft ui.toast für jede Meldung auf) */
  add(text: string, kind: Art = 'info', at?: Ort) {
    this.entries.push({ text, kind, at, time: this.ui.g?.time ?? 0, read: false });
    if (this.entries.length > LOG_MAX) this.entries.splice(0, this.entries.length - LOG_MAX);
  }

  /** Verlauf öffnen – danach gilt alles als gelesen */
  open() {
    const ui = this.ui;
    for (const e of this.entries) e.read = true;
    ui.dialog({ title: '🔔 Meldungen', cls: 'log', body: this.html(), foot: `<button class="btn wide ok" id="logX">▶️ Weiterspielen</button>` });
    document.getElementById('logX')?.addEventListener('click', () => ui.closeModal());
  }

  /** Inhalt des Fensters (füllt U3) */
  html(): string { return ''; }
}
