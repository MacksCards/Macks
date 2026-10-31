// GERÜST für die Handels-Bedienung (Paket U5): Reiter „Handel“ im Kontor (Aufträge, Händler im Hafen)
// und der Block „Handelsroute“ im Schiffsfenster.
// Einstiege: ui/info.ts zeigt den Reiter und ui/ship.ts den Block erst, wenn `ready` true ist.
// So füllen: kontorHtml/shipHtml liefern, Knöpfe in bindKontor/bindShip verbinden, `ready` auf true setzen.
import './trade.css';
import type { Building, Ship } from '../game';
import type { UI } from '../ui';
import { Part } from './util';

export class TradePanel implements Part {
  constructor(readonly ui: UI) {}

  /** noch leer – kein Reiter „Handel“, kein Routen-Block */
  get ready(): boolean { return false; }

  /** Inhalt des Reiters „Handel“ im Kontor */
  kontorHtml(_k: Building): string { return ''; }

  /** Knöpfe im Reiter verbinden (box = Inhalt des Infofensters, gerade neu aufgebaut) */
  bindKontor(_box: HTMLElement, _k: Building) { /* füllt U5 */ }

  /** Block „Handelsroute“ im Schiffsfenster */
  shipHtml(_s: Ship): string { return ''; }

  /** Knöpfe im Routen-Block verbinden */
  bindShip(_box: HTMLElement, _s: Ship) { /* füllt U5 */ }
}
