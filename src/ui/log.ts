// Meldungsverlauf (Paket U3): jede Meldung landet hier (ui.toast → log.add, mit Spielzeit und Ort).
//   • Einblendung einzeilig links unten (höchstens 3); wichtige Meldungen (Warnung, Krieg, Piraten, Bankrott)
//     bleiben stehen, bis man sie antippt. Tipp auf eine Einblendung mit Ort springt sanft dorthin.
//   • Glocke 🔔 unten rechts (über der Minikarte) mit der Zahl der ungelesenen Meldungen öffnet die Liste der letzten 60
//     (Spielzeit, Farbe nach Art, 📍 „Hinschauen“ springt zum Ort).
// Die Meldungen selbst gehören zum Spiel (src/ueberblick.ts) – die letzten 30 stehen im Spielstand.
import './log.css';
import type { UI } from '../ui';
import { addLog, important, logOf, type LogEntry } from '../ueberblick';
import { crisisOn } from '../events';
import { HUMAN } from '../game';
import { Art, Ort, Part, el } from './util';

export type { LogEntry };
export { LOG_MAX } from '../ueberblick';

/** so viele Einblendungen stehen höchstens gleichzeitig links unten */
const SHOWN_MAX = 3;

/** Spielzeit gut lesbar: „12 min“, ab einer Stunde „1 h 05“ */
export function clock(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

/** Text ohne HTML (für Vorlesen und Vergleiche) */
const plain = (html: string) => html.replace(/<[^>]*>/g, '');

export class LogBook implements Part {
  constructor(readonly ui: UI) {}

  get ready(): boolean { return true; }

  /** Meldungen des laufenden Spiels (älteste zuerst) */
  get entries(): LogEntry[] { return logOf(this.ui.g); }

  /** ungelesene Meldungen (Zahl an der Glocke) */
  get unread(): number { return this.entries.reduce((n, e) => n + (e.read ? 0 : 1), 0); }

  /** neue Meldung merken und links unten einblenden (ruft ui.toast für jede Meldung auf) */
  add(text: string, kind: Art = 'info', at?: Ort) {
    const e = addLog(this.ui.g, text, kind, at);
    this.show(e);
  }

  // ---------- Einblendung links unten ----------

  private box(): HTMLElement {
    let b = document.getElementById('logToasts');
    if (!b) {
      b = el('div', 'ltoasts', '');
      b.id = 'logToasts';
      b.setAttribute('role', 'status');
      b.setAttribute('aria-live', 'polite');
      document.getElementById('hud')?.appendChild(b);
    }
    return b;
  }

  private show(e: LogEntry) {
    const box = this.box();
    const imp = important(e.text, e.kind);
    const t = el('button', `ltoast ltoast-${e.kind}${imp ? ' imp' : ''}`, `${e.at ? '<i class="pin">📍</i>' : ''}<span class="tx">${e.text}</span>${imp ? '<i class="x" aria-hidden="true">✕</i>' : ''}`) as HTMLButtonElement & { _e?: LogEntry };
    t.type = 'button';
    t._e = e;
    t.setAttribute('aria-label', plain(e.text) + (e.at ? ' – antippen: hinschauen' : ''));
    t.addEventListener('click', () => {
      e.read = true;
      const span = t.querySelector<HTMLElement>('.tx');
      const cut = !!span && span.scrollWidth > span.clientWidth + 1;
      t.remove();
      if (e.at) this.look(e.at);
      else if (cut) this.open();
    });
    // neueste unten (am nächsten zur Aufgabe), ältere wandern nach oben
    box.appendChild(t);
    this.trim(box, t);
    this.besidePanel(box);
    if (imp) return; // bleibt stehen, bis man sie antippt
    const ms = Math.min(6500, 3000 + Math.max(0, plain(e.text).length - 40) * 45);
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 450);
  }

  /** Stehende Brand- und Pestmeldungen wegräumen, wenn auf der Insel nichts mehr brennt bzw. niemand mehr krank ist
   *  (sonst stand „🔥 Feuer auf …! Ein Haus brennt“ noch lange nach dem Löschen). Ruft die Oberleiste 4 × je Sekunde. */
  prune() {
    const box = document.getElementById('logToasts');
    if (!box || !box.firstChild) return;
    this.besidePanel(box);
    const g = this.ui.g;
    for (const c of Array.from(box.children) as (HTMLElement & { _e?: LogEntry })[]) {
      const e = c._e;
      if (!e?.at || !c.classList.contains('imp')) continue;
      const art = /^🔥 Feuer auf/u.test(e.text) ? 'feuer' : /^💀 Pest auf/u.test(e.text) ? 'pest' : null;
      if (!art) continue;
      const x = Math.floor(e.at.x), y = Math.floor(e.at.y);
      if (!g.inMap(x, y)) continue;
      if (!crisisOn(g, HUMAN, g.islandOf[g.idx(x, y)], art)) c.remove();
    }
  }

  /** Baumenü offen: Platz rechts daneben (bis vor die Kartenknöpfe) – reicht er (≥ 200 px), stehen die Meldungen dort */
  private besidePanel(box: HTMLElement) {
    const p = document.getElementById('buildPanel');
    const nav = document.querySelector<HTMLElement>('#hud .nav');
    if (!p || p.classList.contains('hidden')) { box.classList.remove('side'); return; }
    const pr = p.getBoundingClientRect();
    const right = nav && nav.offsetParent ? nav.getBoundingClientRect().left : window.innerWidth;
    const l = pr.right + 10, w = Math.min(360, right - 10 - l);
    box.classList.toggle('side', w >= 200);
    box.style.setProperty('--side-l', `${Math.round(l)}px`);
    box.style.setProperty('--side-w', `${Math.round(w)}px`);
  }

  /** höchstens SHOWN_MAX Einblendungen: zuerst fallen gewöhnliche weg (nicht wichtige, nicht die mit Knopf) */
  private trim(box: HTMLElement, keep: HTMLElement) {
    while (box.children.length > SHOWN_MAX) {
      const kids = Array.from(box.children) as HTMLElement[];
      (kids.find((c) => !c.classList.contains('imp') && !c.classList.contains('act') && c !== keep)
        ?? kids.find((c) => c !== keep) ?? kids[0]).remove();
    }
  }

  /** (U3 + U4) Meldung mit eigenem Knopf (z. B. „↩ Rückgängig“ nach dem Bauen) in derselben Zeile links unten.
   *  Steht ms lang; eine neue ersetzt die vorige. Im Verlauf steht nur der Text. */
  action(text: string, label: string, run: () => void, ms = 8000) {
    const e = addLog(this.ui.g, text, 'info');
    const box = this.box();
    box.querySelector('.ltoast.act')?.remove();
    const t = el('div', 'ltoast ltoast-info act', '<span class="tx"></span><button class="btn" type="button"></button>');
    t.querySelector('.tx')!.textContent = plain(text);
    const bt = t.querySelector('button')!;
    bt.textContent = label;
    bt.addEventListener('click', (ev) => { ev.stopPropagation(); e.read = true; t.remove(); run(); });
    box.appendChild(t);
    this.trim(box, t);
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 450);
  }

  /** Kamera sanft zum Ort einer Meldung (ein Stück heran, wenn man weit weg ist) */
  look(at: Ort) {
    const ui = this.ui, r = ui.view.rig;
    ui.input.flyTo({ tx: at.x, tz: at.y, dist: Math.min(r.dist, 26) }, 650);
  }

  // ---------- Liste hinter der Glocke ----------

  /** Verlauf öffnen – danach gilt alles als gelesen (auch die stehenden Einblendungen verschwinden) */
  open() {
    const ui = this.ui;
    const list = this.entries;
    const body = this.html();
    for (const e of list) e.read = true;
    document.getElementById('logToasts')?.replaceChildren();
    ui.dialog({ title: '🔔 Meldungen', cls: 'log', body, foot: `<button class="btn wide ok" id="logX">▶️ Weiterspielen</button>` });
    document.getElementById('logX')?.addEventListener('click', () => ui.closeModal());
    document.querySelectorAll<HTMLElement>('#modal .lrow .look').forEach((b) => {
      b.addEventListener('click', () => {
        const e = list[Number(b.dataset.i)];
        if (!e?.at) return;
        ui.closeModal();
        this.look(e.at);
      });
    });
  }

  /** Inhalt des Fensters: neueste zuerst, Spielzeit, Farbe nach Art, „Hinschauen“ bei Meldungen mit Ort */
  html(): string {
    const list = this.entries;
    if (!list.length) return '<p class="sub">Noch keine Meldungen. Hier stehen später alle Nachrichten mit Spielzeit – mit 📍 springst du zum Ort.</p>';
    let h = '<ul class="lrows">';
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      h += `<li class="lrow k-${e.kind}${e.read ? '' : ' new'}${important(e.text, e.kind) ? ' imp' : ''}">
        <span class="lt" title="Spielzeit">${clock(e.time)}</span><span class="lx">${e.text}</span>
        ${e.at ? `<button class="btn sq look" data-i="${i}" aria-label="Hinschauen">📍</button>` : '<span class="nolook"></span>'}</li>`;
    }
    return h + '</ul><p class="sub">Links die Spielzeit. 📍 = hinschauen.</p>';
  }
}
