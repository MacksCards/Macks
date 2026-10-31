// Kleine Helfer, die alle Bausteine der Oberfläche teilen.
import { Cost, GOOD } from '../data';

/** erstes Element zu einem CSS-Wähler */
export const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;

/** neues Element mit Klasse und Inhalt */
export function el(tag: string, cls = '', html = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

/** Baukosten als kurze Zeile mit Symbolen */
export function costText(c: Cost): string {
  const parts: string[] = [];
  if (c.taler) parts.push(`💰${c.taler}`);
  if (c.holz) parts.push(`${GOOD.holz.icon}${c.holz}`);
  if (c.werkzeug) parts.push(`${GOOD.werkzeug.icon}${c.werkzeug}`);
  if (c.stein) parts.push(`${GOOD.stein.icon}${c.stein}`);
  if (c.kanonen) parts.push(`${GOOD.kanonen.icon}${c.kanonen}`);
  return parts.join(' ') || 'kostenlos';
}

/** Zahl mit Tausenderpunkt (8.000) */
export const fmt = (n: number) => Math.floor(n).toLocaleString('de-DE');

/** Zustandsbalken (Treffer) für Gebäude, Schiffe und Soldaten */
export function hpHtml(hp: number, max: number): string {
  const f = Math.max(0, Math.min(1, hp / max));
  const pc = Math.round(f * 10) * 10;
  return `<div class="row"><span>❤️ Zustand</span><b>${pc} %</b></div><div class="bar"><i style="width:${pc}%;background:${f > 0.6 ? '#7cc95a' : f > 0.3 ? '#e8b93a' : '#e2553f'}"></i></div>`;
}

/** Art einer Meldung */
export type Art = 'info' | 'good' | 'bad';

/** Ort auf der Karte in Spielfeldern (x nach Osten, y nach Süden) */
export interface Ort { x: number; y: number }

/**
 * Baustein, der anfangs noch leer sein kann (ein Gerüst für ein späteres Arbeitspaket).
 * Solange `ready` false ist, bleibt sein Einstieg (Knopf, Reiter, Menüpunkt) versteckt –
 * der Spieler sieht also nie ein leeres Fenster (Regel 8: nur Nutzbares zeigen).
 */
export interface Part { readonly ready: boolean }
