// Fenster, die sich nur dort ändern, wo sich etwas ändert (Paket U2).
// Ein Fenster wird als Vorlage geschrieben: feste Teile als Text, wechselnde Teile über die Helfer unten
// (Zahl, Balken, Klasse, gesperrter Knopf). Bleibt die Vorlage gleich, werden nur diese Stellen ausgetauscht –
// Knöpfe bleiben dieselben (ein Tipp geht nicht verloren) und das Handy muss nichts neu aufbauen.
// Ändert sich der Aufbau (andere Zeilen, andere Knöpfe), wird das Fenster komplett neu gebaut.

/** Markierungen in der Vorlage: \u0001 Art Nummer \u0002 */
const MARK = /\u0001([vbcd])(\d+)\u0002/g;

export class Live {
  private vals: string[] = [];

  /** wechselnder Text oder kleines HTML (z. B. Zahl mit Einheit) */
  v(content: string | number): string {
    this.vals.push(String(content));
    return `\u0001v${this.vals.length - 1}\u0002`;
  }

  /** Balken 0..1 mit Farbe (Farbe leer = Standard) */
  bar(f: number, color = ''): string {
    const pc = Math.round(Math.max(0, Math.min(1, f)) * 100);
    this.vals.push(`width:${pc}%${color ? `;background:${color}` : ''}`);
    return `<div class="bar"><i \u0001b${this.vals.length - 1}\u0002></i></div>`;
  }

  /** wechselnde Klassen eines Elements: class="…" samt Kennung */
  cls(classes: string): string {
    this.vals.push(classes);
    return `\u0001c${this.vals.length - 1}\u0002`;
  }

  /** Knopf gesperrt oder frei */
  dis(off: boolean): string {
    this.vals.push(off ? '1' : '');
    return `\u0001d${this.vals.length - 1}\u0002`;
  }

  /** fertiges HTML aus der Vorlage */
  html(tpl: string): string {
    return tpl.replace(MARK, (_, k: string, n: string) => {
      const i = Number(n), val = this.vals[i] ?? '';
      if (k === 'v') return `<span data-v="${i}">${val}</span>`;
      if (k === 'b') return `data-b="${i}" style="${val}"`;
      if (k === 'c') return `class="${val}" data-c="${i}"`;
      return `data-d="${i}"${val ? ' disabled' : ''}`;
    });
  }

  /** nur die wechselnden Stellen in root austauschen (Vorlage unverändert) */
  patch(root: HTMLElement) {
    root.querySelectorAll<HTMLElement>('[data-v]').forEach((e) => {
      const val = this.vals[Number(e.dataset.v)];
      if (val !== undefined && e.innerHTML !== val) e.innerHTML = val;
    });
    root.querySelectorAll<HTMLElement>('[data-b]').forEach((e) => {
      const val = this.vals[Number(e.dataset.b)];
      if (val !== undefined && e.getAttribute('style') !== val) e.setAttribute('style', val);
    });
    root.querySelectorAll<HTMLElement>('[data-c]').forEach((e) => {
      const val = this.vals[Number(e.dataset.c)];
      if (val !== undefined && e.className !== val) e.className = val;
    });
    root.querySelectorAll<HTMLButtonElement>('[data-d]').forEach((e) => {
      const val = this.vals[Number(e.dataset.d)];
      if (val !== undefined) e.disabled = !!val;
    });
  }
}

/** Text sicher in HTML einsetzen (Zeilen anderer Spielteile, Namen) */
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/**
 * Vorlage im Infofenster zeigen: gleicher Aufbau wie zuletzt → nur Zahlen und Balken austauschen (false);
 * anderer Aufbau → neu bauen (true: dann die Knöpfe neu verbinden). setInfo = UI.setInfo (Inhalt + Fußleiste).
 */
export function showLive(setInfo: (html: string, foot?: string) => boolean, L: Live, tpl: string, foot = ''): boolean {
  const body = document.getElementById('infoBody') as (HTMLElement & { _h?: string; _live?: string; _liveH?: string }) | null;
  const info = document.getElementById('info');
  if (!body || !info) return setInfo(L.html(tpl), L.html(foot));
  const key = tpl + '\u0000' + foot;
  if (body._live === key && body._h !== undefined && body._h === body._liveH) { L.patch(info); return false; }
  const fresh = setInfo(L.html(tpl), L.html(foot));
  body._live = key;
  body._liveH = body._h;
  if (!fresh) L.patch(info);
  return fresh;
}
