// Handel bedienen (Paket U5, aufbauend auf der einfachen Bedienung aus S2):
// - Reiter „⚖️ Handel“ im Kontor: oben der Händler-Zustand (im Hafen / blockiert von … / nächster Besuch), darunter
//   die Auftragsliste nach Kontorstufe (Plätze Kaufen/Verkaufen, z. B. 4 / 3). Je Auftrag Ware und Richtung,
//   ein Regler für die Schwelle („kaufe bis X t“ bzw. „verkaufe über X t“) und ein Preis-Regler mit Farbbalken
//   (rot = der Händler macht gerade nicht mit, gelb = knapp, grün = passt). Regler: ziehen, auf den Balken tippen
//   oder − / + (Schwelle ±10 t, Preis ±5 %). Der teure Sofort-Handel steht klein und eingeklappt darunter.
// - Block „🧭 Handelsroute“ im Schiffsfenster (ab zwei eigenen Kontoren): Zustand, Halte, ▶/⏸ und „Bearbeiten“.
//   Der Routen-Editor ist ein großes Fenster in der Bildmitte: Kontore auf einer kleinen Karte oder in der Liste
//   antippen (2–4 Halte), je Halt Waren laden oder ausladen (±10 t, bis 100 t), Zustand „blockiert: …“.
// Einstiege: ui/info.ts zeigt den Reiter und ui/ship.ts den Block, wenn `ready` true ist.
//
// Leistung und Bedienung: Das Infofenster wird alle 0,25 s neu berechnet, aber nur neu aufgebaut, wenn sich sein
// HTML ändert (ui.setInfo). Darum steht im HTML hier nur der Aufbau; alles, was sich laufend ändert (Lager,
// Marktpreise, Händler-Zustand, Reglerstände), setzen paintKontor()/paintShip() direkt in die vorhandenen
// Elemente. So bleibt ein Regler beim Ziehen unter dem Finger, und Tipps gehen nicht verloren.
import './trade.css';
import { GOOD, GOODS, GoodId, PRICES } from '../data';
import { Building, HUMAN, Ship } from '../game';
import {
  ROUTE_MAX, ROUTE_STOPS, TradeOrder, TradeRoute, active, basePrice, canScrap, defaultOrder, marketPrice, orders, pauseRoute,
  priceRange, removeOrder, route, routeCheck, scrap, scrapRefund, sells, setOrder, setRoute, slots, sofort, sofortPreis,
  startRoute, traderStatus,
} from '../trade';
import { sound } from '../audio';
import type { UI } from '../ui';
import { Part } from './util';

/** Schritte der Knöpfe: Schwelle ±10 t, Preis ±5 % des Grundpreises, Route ±10 t; Ziehen rastet bei 5 t ein */
export const LIMIT_STEP = 10;
export const LIMIT_SNAP = 5;
export const PRICE_STEP = 0.05;
export const ROUTE_STEP = 10;

// ---------- reine Rechenhilfen (ohne Seite, getestet in scripts/handelsfenster-test.ts) ----------

/** Wert auf das Raster lo + n·step legen und auf lo … hi begrenzen (ganze Zahlen) */
export function snap(v: number, lo: number, hi: number, step: number): number {
  if (!(hi > lo)) return lo;
  const s = Math.round((v - lo) / Math.max(1e-9, step)) * step + lo;
  return Math.max(lo, Math.min(hi, Math.round(s)));
}

/** Anteil 0 … 1 eines Werts zwischen lo und hi */
export function frac(v: number, lo: number, hi: number): number {
  return hi > lo ? Math.max(0, Math.min(1, (v - lo) / (hi - lo))) : 0;
}

/** Schritt des Preis-Knopfs (5 % des Grundpreises, mindestens 1 Taler) */
export function priceStep(good: GoodId, buy: boolean): number {
  return Math.max(1, Math.round((basePrice(good, buy) ?? 0) * PRICE_STEP));
}

/**
 * Farbbalken unter dem Preis-Regler: wo auf dem Regler (0 … 1) die Grenze des Händlers liegt und welche Seite
 * „passt“. Kaufen: ab der Grenze nach rechts grün (mehr bieten). Verkaufen: bis zur Grenze nach links grün.
 */
export function priceBand(o: TradeOrder, mp: { kaufen: number; verkaufen: number } | null): { at: number; css: string } {
  const [lo, hi] = priceRange(o.g, o.buy);
  if (!mp) return { at: -1, css: 'linear-gradient(90deg,#8a4436,#8a4436)' };
  const thr = o.buy ? mp.kaufen : mp.verkaufen;
  // Grenze als Anteil; außerhalb des Reglers ganz rot bzw. ganz grün
  const t = hi > lo ? (thr - lo) / (hi - lo) : 0.5;
  const red = '#b5493a', yel = '#d7a93c', grn = '#5f9a3e';
  const pc = (x: number) => `${(Math.max(-0.2, Math.min(1.2, x)) * 100).toFixed(1)}%`;
  const w = 0.06;
  const css = o.buy
    ? `linear-gradient(90deg,${red} 0%,${red} ${pc(t - w)},${yel} ${pc(t)},${grn} ${pc(t + w)},${grn} 100%)`
    : `linear-gradient(90deg,${grn} 0%,${grn} ${pc(t - w)},${yel} ${pc(t)},${red} ${pc(t + w)},${red} 100%)`;
  return { at: t, css };
}

/** Lage eines Auftrags: passt der Preis, gibt es etwas zu tun? (für ✓/✗ und den Hinweis) */
export function orderState(o: TradeOrder, have: number, mp: { kaufen: number; verkaufen: number } | null, traderHas: boolean):
  { ok: boolean; idle: boolean; hint: string } {
  if (!mp) return { ok: false, idle: true, hint: 'Mit dieser Ware handelt der Händler nicht.' };
  if (o.buy) {
    if (!traderHas) return { ok: false, idle: false, hint: '✗ Diese Ware hat der Händler noch nicht – erst, wenn sie jemand hergestellt hat.' };
    const ok = o.price >= mp.kaufen;
    const idle = have >= o.limit;
    let hint = ok ? `✓ Passt: Der Händler verkauft gerade ab ${mp.kaufen} Taler.` : `✗ Zu wenig geboten: Der Händler will gerade mindestens ${mp.kaufen} Taler.`;
    if (!ok && mp.kaufen > priceRange(o.g, true)[1]) hint += ' Warte, bis der Preis wieder sinkt.';
    if (idle) hint += ` Im Lager sind schon ${have} t – er liefert erst, wenn es weniger wird.`;
    return { ok, idle, hint };
  }
  const ok = o.price <= mp.verkaufen;
  const idle = have <= o.limit;
  let hint = ok ? `✓ Passt: Der Händler zahlt gerade bis ${mp.verkaufen} Taler.` : `✗ Zu teuer: Der Händler zahlt gerade höchstens ${mp.verkaufen} Taler.`;
  if (idle) hint += ` Im Lager sind ${have} t – verkauft wird erst, was über ${o.limit} t liegt.`;
  return { ok, idle, hint };
}

/** Ware an einem Halt hinzufügen; beim Laden wird sie (wenn noch nirgends ausgeladen) am nächsten Halt ausgeladen.
 *  Gibt den Halt zurück, an dem automatisch ausgeladen wird (−1 = keiner). */
export function addRouteGood(r: TradeRoute, i: number, kind: 'laden' | 'entladen', gd: GoodId): number {
  const st = r.stops[i];
  if (!st) return -1;
  const other = kind === 'laden' ? 'entladen' : 'laden';
  delete st[other][gd];
  st[kind][gd] = st[kind][gd] ?? (kind === 'laden' ? 50 : ROUTE_MAX);
  if (kind !== 'laden' || r.stops.length < 2 || r.stops.some((x) => x.entladen[gd])) return -1;
  const j = (i + 1) % r.stops.length;
  if (r.stops[j].kontor === st.kontor) return -1;
  delete r.stops[j].laden[gd];
  r.stops[j].entladen[gd] = ROUTE_MAX;
  return j;
}

/** Menge einer Ware an einem Halt um d Schritte ändern (0 = Ware weg) */
export function stepRouteGood(r: TradeRoute, i: number, kind: 'laden' | 'entladen', gd: GoodId, d: number) {
  const st = r.stops[i];
  if (!st) return;
  const n = Math.max(0, Math.min(ROUTE_MAX, (st[kind][gd] ?? 0) + d * ROUTE_STEP));
  if (n) st[kind][gd] = n; else delete st[kind][gd];
}

/** Ware an einem Halt zwischen Laden und Ausladen umschalten */
export function flipRouteGood(r: TradeRoute, i: number, kind: 'laden' | 'entladen', gd: GoodId) {
  const st = r.stops[i];
  const n = st?.[kind][gd];
  if (!st || !n) return;
  const other = kind === 'laden' ? 'entladen' : 'laden';
  delete st[kind][gd];
  st[other][gd] = Math.max(st[other][gd] ?? 0, n);
}

// ---------- Regler (groß, für den Finger) ----------

/** Regler mit − und +; der Balken (44 px hoch) lässt sich ziehen oder antippen */
function sliderHtml(key: string, label: string, minus: string, plus: string): string {
  return `<div class="tsl" data-sl="${key}"><button class="btn tsl-b" data-step="-1" aria-label="${label}: ${minus}">−</button>`
    + `<div class="tsl-track" role="slider" tabindex="0" aria-label="${label}"><i class="tsl-bar"></i><i class="tsl-mark"></i><b class="tsl-knob"></b></div>`
    + `<button class="btn tsl-b" data-step="1" aria-label="${label}: ${plus}">+</button></div>`;
}

/** Reglerstand zeigen (ohne neu aufzubauen) */
function setSlider(track: Element | null, v: number, lo: number, hi: number, text: string) {
  if (!(track instanceof HTMLElement)) return;
  track.style.setProperty('--f', frac(v, lo, hi).toFixed(4));
  const s = String(v);
  if (track.getAttribute('aria-valuenow') !== s) {
    track.setAttribute('aria-valuenow', s);
    track.setAttribute('aria-valuemin', String(lo));
    track.setAttribute('aria-valuemax', String(hi));
    track.setAttribute('aria-valuetext', text);
  }
}

/** Text eines Elements setzen, nur wenn er sich ändert */
function txt(root: ParentNode, sel: string, t: string) {
  const e = root.querySelector(sel);
  if (e && e.textContent !== t) e.textContent = t;
}

const UNSET = Symbol('unset');

/** Ziehen, Antippen und Tasten eines Reglers. range() liefert die aktuellen Grenzen, set() übernimmt einen Wert. */
interface SliderCtl {
  range: () => { v: number; lo: number; hi: number; snap: number; step: number } | null;
  set: (v: number, final: boolean) => void;
}

type KontorSide = 'buy' | 'sell';

export class TradePanel implements Part {
  // Kontor-Reiter
  /** Kontor, für das die Wahl unten gilt */
  private forK = -1;
  /** aufgeklappter Auftrag (Ware) */
  private openG: GoodId | null = null;
  /** Warenwahl für einen neuen Auftrag offen (Kaufen oder Verkaufen) */
  private pickFor: KontorSide | null = null;
  /** Notverkauf aufgeklappt */
  private notOpen = false;
  /** Regler, der gerade gezogen wird (dessen Stand malt paint nicht nach) */
  private drag: string | null = null;
  // Schiffsfenster
  /** Block „Handelsroute“ aufgeklappt? (ohne eigene Wahl: offen, wenn es eine Route gibt) */
  private routeOpen: boolean | null = null;
  // Routen-Editor
  private edShip: Ship | null = null;
  /** Halt, für den die Warenwahl offen ist, und gewählte Richtung */
  private edPick = -1;
  private edKind: 'laden' | 'entladen' = 'laden';
  /** Kartenausschnitt des Editors (Felder) */
  private edView = { x0: 0, y0: 0, side: 1 };
  private edBase: { key: string; cv: HTMLCanvasElement } | null = null;

  constructor(readonly ui: UI) {}

  /** sobald Händlerschiffe fahren (ab dem ersten Kontor) */
  get ready(): boolean { return active(this.ui.g); }

  // ======================================================================
  // Kontor: Reiter „Handel“
  // ======================================================================

  /** Waren, die der Spieler gerade braucht oder hat (Regel 8: nur Nutzbares) */
  private goodsFor(k: Building): GoodId[] {
    const g = this.ui.g, l = g.lagerOf(HUMAN, k.island);
    return GOODS.map((x) => x.id).filter((id) => PRICES[id] && (this.ui.relevant.has(id) || (l?.[id] ?? 0) >= 1));
  }

  /** Inhalt des Reiters „Handel“ im Kontor (nur Aufbau; Zahlen setzt paintKontor gleich danach) */
  kontorHtml(k: Building): string {
    const g = this.ui.g;
    if (this.forK !== k.id) { this.forK = k.id; this.openG = null; this.pickFor = null; this.notOpen = false; }
    const list = orders(g, k), sl = slots(k);
    if (this.openG && !list.some((o) => o.g === this.openG)) this.openG = null;
    let h = '<div class="tstat" data-tstat role="status"><span></span></div>';
    h += this.sideHtml(k, 'buy', list.filter((o) => o.buy), sl.buy);
    h += this.sideHtml(k, 'sell', list.filter((o) => !o.buy), sl.sell);
    if (!list.length && !this.pickFor) h += '<p class="sub">Der Händler kauft und verkauft nur, was du hier einstellst. Tippe auf „＋“.</p>';
    // Notverkauf / Sofortkauf: teurer Notbehelf, klein und eingeklappt
    h += `<button class="fold-h tnot" data-tnot aria-expanded="${this.notOpen}"><span>🆘 Sofort handeln (teuer)</span><b><i>${this.notOpen ? '▾' : '▸'}</i></b></button>`;
    if (this.notOpen) {
      h += '<div class="fold-b tnot-b"><p class="sub">Ohne Händlerschiff, dafür deutlich teurer. Je 5 t, Preis je Tonne.</p>';
      for (const id of this.goodsFor(k)) {
        const pr = sofortPreis(g, id);
        if (!pr) continue;
        h += `<div class="trade"><span>${GOOD[id].icon} ${GOOD[id].name}</span><button class="btn" data-buy="${id}" aria-label="${GOOD[id].name}: 5 t sofort kaufen">+5 · ${pr.kaufen}</button><button class="btn" data-sell="${id}" aria-label="${GOOD[id].name}: 5 t sofort verkaufen">−5 · ${pr.verkaufen}</button></div>`;
      }
      h += '</div>';
    }
    // Zahlen gleich nach dem Einsetzen (ui.setInfo läuft direkt nach diesem Aufruf)
    queueMicrotask(() => this.paintKontor(k));
    return h;
  }

  /** Kaufen oder Verkaufen: Kopf mit belegten Plätzen, Aufträge, „＋“ bzw. Warenwahl */
  private sideHtml(k: Building, side: KontorSide, list: TradeOrder[], n: number): string {
    const buy = side === 'buy';
    const pips = Array.from({ length: n }, (_, i) => `<i${i < list.length ? ' class="on"' : ''}></i>`).join('');
    let h = `<div class="tside"><h4>${buy ? '⬇️ Kaufen' : '⬆️ Verkaufen'}</h4><span class="tpips" aria-hidden="true">${pips}</span><small>${list.length} von ${n}</small></div>`;
    for (const o of list) h += this.orderHtml(o);
    if (list.length < n) {
      if (this.pickFor === side) h += this.pickerHtml(k, buy);
      else h += `<button class="btn tadd" data-tadd="${side}">＋ ${buy ? 'Kaufauftrag' : 'Verkaufsauftrag'}</button>`;
    } else h += `<p class="sub">Alle Plätze belegt${(k.level ?? 0) < 3 ? ' – ein größeres Kontor hat mehr' : ''}.</p>`;
    return h;
  }

  private orderHtml(o: TradeOrder): string {
    const open = this.openG === o.g, gd = GOOD[o.g];
    // Kopfzeile: antippen klappt auf/zu; Löschen erst im aufgeklappten Auftrag (nichts geht aus Versehen weg)
    let h = `<div class="tord${open ? ' open' : ''}" data-ord="${o.g}">`
      + `<button class="tord-sum" data-oopen="${o.g}" aria-expanded="${open}"><span class="tn">${gd.icon} ${gd.name}</span><small class="th"></small><i class="tok"></i><small class="tv"></small></button>`;
    if (open) {
      h += '<div class="tord-b">'
        + `<p class="tl tl-lim"></p>${sliderHtml(`lim:${o.g}`, o.buy ? 'Kaufen bis' : 'Verkaufen über', `${LIMIT_STEP} t weniger`, `${LIMIT_STEP} t mehr`)}`
        + `<p class="tl tl-pr"></p>${sliderHtml(`pr:${o.g}`, 'Preis', '5 % billiger', '5 % teurer')}`
        + '<p class="sub thint"></p>'
        + `<button class="btn tdel" data-odel="${o.g}">🗑️ Auftrag löschen</button></div>`;
    }
    return h + '</div>';
  }

  /** Warenwahl für einen neuen Auftrag (Knöpfe mit Bild und Namen) */
  private pickerHtml(k: Building, buy: boolean): string {
    const g = this.ui.g;
    const used = new Set(orders(g, k).map((o) => o.g));
    const all = this.goodsFor(k).filter((id) => !used.has(id));
    const ids = buy ? all.filter((id) => sells(g, id)) : all;
    let h = `<div class="tpick"><p class="sub">${buy ? 'Was soll dir der Händler bringen?' : 'Was soll dir der Händler abkaufen?'}</p><div class="tpick-g">`;
    h += ids.map((id) => `<button class="btn" data-pg="${id}"><span>${GOOD[id].icon}</span>${GOOD[id].name}</button>`).join('');
    h += '</div>';
    if (!ids.length) h += '<p class="sub">Gerade keine passende Ware.</p>';
    if (buy && ids.length < all.length) h += '<p class="sub">Was noch niemand hergestellt hat, bringt der Händler noch nicht mit.</p>';
    return h + '<button class="btn tw" data-tadd-x>Abbrechen</button></div>';
  }

  /** laufende Zahlen im Reiter setzen: Händler-Zustand, Aufträge, Regler, Farbbalken */
  paintKontor(k: Building) {
    const box = document.getElementById('infoBody');
    const stat = box?.querySelector<HTMLElement>('[data-tstat]');
    if (!box || !stat) return;
    const g = this.ui.g, l = g.lagerOf(HUMAN, k.island);
    const st = traderStatus(g, k) || '⛵ Der Händler kommt bald.';
    txt(stat, 'span', st);
    stat.classList.toggle('hafen', st.startsWith('⛵ Der Händler liegt'));
    stat.classList.toggle('block', st.startsWith('⛔'));
    const cap = Math.max(0, g.capOf(HUMAN, k.island));
    for (const o of orders(g, k)) {
      const el = box.querySelector<HTMLElement>(`[data-ord="${o.g}"]`);
      if (!el) continue;
      const have = Math.floor(l?.[o.g] ?? 0);
      const mp = marketPrice(g, o.g);
      const s = orderState(o, have, mp, sells(g, o.g));
      const base = basePrice(o.g, o.buy) ?? 1;
      const pct = Math.round((o.price / base) * 100);
      txt(el, '.th', `📦 ${have} t`);
      txt(el, '.tv', `${o.buy ? 'bis' : 'über'} ${o.limit} t · ${o.price} Taler`);
      const ok = el.querySelector<HTMLElement>('.tok');
      if (ok) {
        const t = s.ok ? (s.idle ? '💤' : '✓') : '✗';
        if (ok.textContent !== t) ok.textContent = t;
        ok.className = `tok ${s.ok ? (s.idle ? 'idle' : 'pos') : 'neg'}`;
        ok.title = s.ok ? (s.idle ? 'Preis passt, gerade nichts zu tun' : 'Preis passt') : 'Der Händler macht so nicht mit';
      }
      if (!el.classList.contains('open')) continue;
      txt(el, '.tl-lim', o.buy ? `Kaufen, bis ${o.limit} t im Lager sind (jetzt ${have} t)` : `Verkaufen, was über ${o.limit} t liegt (jetzt ${have} t)`);
      txt(el, '.tl-pr', `Preis: ${o.price} Taler je t (${pct} %)`);
      txt(el, '.thint', s.hint);
      const hint = el.querySelector('.thint');
      hint?.classList.toggle('pos', s.ok && !s.idle);
      hint?.classList.toggle('neg', !s.ok);
      if (this.drag !== `lim:${o.g}`) setSlider(el.querySelector(`[data-sl="lim:${o.g}"] .tsl-track`), o.limit, 0, cap, `${o.limit} Tonnen`);
      const [lo, hi] = priceRange(o.g, o.buy);
      const tr = el.querySelector<HTMLElement>(`[data-sl="pr:${o.g}"] .tsl-track`);
      if (tr) {
        if (this.drag !== `pr:${o.g}`) setSlider(tr, o.price, lo, hi, `${o.price} Taler`);
        const band = priceBand(o, mp);
        const bar = tr.querySelector<HTMLElement>('.tsl-bar');
        if (bar && bar.dataset.css !== band.css) { bar.dataset.css = band.css; bar.style.background = band.css; }
        tr.style.setProperty('--m', band.at >= 0 && band.at <= 1 ? band.at.toFixed(4) : '-1');
        tr.classList.toggle('nomark', !(band.at >= 0 && band.at <= 1));
      }
    }
  }

  /** Knöpfe im Reiter verbinden (box = Inhalt des Infofensters, gerade neu aufgebaut) */
  bindKontor(box: HTMLElement, k: Building) {
    const ui = this.ui, g = ui.g;
    const find = (id: string) => orders(g, k).find((o) => o.g === id);
    const redo = () => ui.renderInfo();
    box.querySelectorAll<HTMLElement>('[data-tadd]').forEach((bt) => bt.addEventListener('click', () => {
      this.pickFor = bt.dataset.tadd as KontorSide; sound.play('klick'); redo();
    }));
    box.querySelector('[data-tadd-x]')?.addEventListener('click', () => { this.pickFor = null; redo(); });
    box.querySelectorAll<HTMLElement>('[data-pg]').forEach((bt) => bt.addEventListener('click', () => {
      const id = bt.dataset.pg as GoodId;
      const r = setOrder(g, k, defaultOrder(id, this.pickFor === 'buy'));
      if (r.ok) { sound.play('klick'); this.openG = id; this.pickFor = null; } else ui.toast(r.reason ?? '', 'bad');
      redo();
    }));
    box.querySelectorAll<HTMLElement>('[data-oopen]').forEach((bt) => bt.addEventListener('click', () => {
      const id = bt.dataset.oopen as GoodId;
      this.openG = this.openG === id ? null : id;
      redo();
    }));
    box.querySelectorAll<HTMLElement>('[data-odel]').forEach((bt) => bt.addEventListener('click', () => {
      const id = bt.dataset.odel as GoodId;
      removeOrder(g, k, id);
      if (this.openG === id) this.openG = null;
      sound.play('klick');
      redo();
    }));
    // Regler: Schwelle und Preis
    box.querySelectorAll<HTMLElement>('[data-sl]').forEach((root) => {
      const [kind, id] = root.dataset.sl!.split(':') as ['lim' | 'pr', GoodId];
      const ctl: SliderCtl = {
        range: () => {
          const o = find(id);
          if (!o) return null;
          if (kind === 'lim') return { v: o.limit, lo: 0, hi: Math.max(0, g.capOf(HUMAN, k.island)), snap: LIMIT_SNAP, step: LIMIT_STEP };
          const [lo, hi] = priceRange(o.g, o.buy);
          return { v: o.price, lo, hi, snap: 1, step: priceStep(o.g, o.buy) };
        },
        set: (v, final) => {
          const o = find(id);
          if (!o) return;
          if (kind === 'lim' ? o.limit !== v : o.price !== v) setOrder(g, k, kind === 'lim' ? { ...o, limit: v } : { ...o, price: v });
          this.paintKontor(k);
          if (final) sound.play('klick');
        },
      };
      this.bindSlider(root, ctl, (atEnd) => {
        if (kind === 'pr') ui.toast(atEnd ? 'Höher geht es nicht (105 % des Grundpreises)' : 'Niedriger geht es nicht (70 % des Grundpreises)', 'info');
      }, () => this.paintKontor(k));
    });
    box.querySelector('[data-tnot]')?.addEventListener('click', () => { this.notOpen = !this.notOpen; redo(); });
    box.querySelectorAll<HTMLElement>('[data-buy],[data-sell]').forEach((bt) => bt.addEventListener('click', () => {
      const id = (bt.dataset.buy ?? bt.dataset.sell) as GoodId;
      const n = sofort(g, HUMAN, k.island, id, bt.dataset.buy ? 5 : -5);
      if (n) sound.play('muenzen');
      else ui.toast(bt.dataset.buy ? 'Nicht genug Taler oder Lager voll' : 'Nichts zum Verkaufen da', 'bad');
      redo();
    }));
  }

  /**
   * Regler verbinden. Ziehen erst ab 6 px seitlicher Bewegung (wer senkrecht wischt, blättert im Fenster und
   * verstellt nichts), kurzes Antippen springt an die Stelle; − / + gehen in großen Schritten.
   */
  private bindSlider(root: HTMLElement, ctl: SliderCtl, edge: (atEnd: boolean) => void, paint: () => void) {
    const track = root.querySelector<HTMLElement>('.tsl-track');
    const key = root.dataset.sl!;
    if (!track) return;
    const fromX = (x: number) => {
      const r = ctl.range();
      if (!r) return null;
      const rc = track.getBoundingClientRect();
      const pad = 16; // Knopfradius: die Enden sind erreichbar
      const f = Math.max(0, Math.min(1, (x - rc.left - pad) / Math.max(1, rc.width - 2 * pad)));
      return { r, v: snap(r.lo + f * (r.hi - r.lo), r.lo, r.hi, r.snap) };
    };
    let st: { id: number; x: number; y: number; drag: boolean; last: number | typeof UNSET } | null = null;
    const end = () => { st = null; this.drag = null; track.classList.remove('drag'); };
    track.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      st = { id: e.pointerId, x: e.clientX, y: e.clientY, drag: false, last: UNSET };
    });
    track.addEventListener('pointermove', (e) => {
      if (!st || e.pointerId !== st.id) return;
      const dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (!st.drag) {
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
        st.drag = true; this.drag = key; track.classList.add('drag');
        try { track.setPointerCapture(e.pointerId); } catch { /* egal */ }
      }
      e.preventDefault();
      const p = fromX(e.clientX);
      if (!p || p.v === st.last) return;
      st.last = p.v;
      setSlider(track, p.v, p.r.lo, p.r.hi, String(p.v));
      ctl.set(p.v, false);
    });
    track.addEventListener('pointerup', (e) => {
      if (!st || e.pointerId !== st.id) return;
      const tap = !st.drag && Math.abs(e.clientX - st.x) < 8 && Math.abs(e.clientY - st.y) < 8;
      const wasDrag = st.drag;
      end();
      if (tap || wasDrag) {
        const p = fromX(e.clientX);
        if (p) ctl.set(p.v, true);
      }
    });
    track.addEventListener('pointercancel', () => { const was = st?.drag; end(); if (was) paint(); });
    track.addEventListener('lostpointercapture', () => { if (st?.drag) { end(); paint(); } });
    // Tasten (Maus/Tastatur beim Testen)
    track.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const r = ctl.range();
      if (r) ctl.set(snap(r.v + d * r.snap, r.lo, r.hi, r.snap), true);
    });
    root.querySelectorAll<HTMLElement>('[data-step]').forEach((bt) => bt.addEventListener('click', () => {
      const r = ctl.range();
      if (!r) return;
      const d = Number(bt.dataset.step);
      const v = Math.max(r.lo, Math.min(r.hi, r.v + d * r.step));
      if (v === r.v) { edge(d > 0); return; }
      ctl.set(v, false);
    }));
  }

  // ======================================================================
  // Schiff: Block „Handelsroute“
  // ======================================================================

  /** eigene Kontore */
  private mine(): Building[] {
    return this.ui.g.buildings.filter((b) => b.type === 'kontor' && b.owner === HUMAN);
  }

  private kName(id: number): string {
    const g = this.ui.g, k = g.byId.get(id);
    return k && k.type === 'kontor' ? g.islands[k.island]?.name ?? '?' : 'Kontor fehlt';
  }

  /** Zustand einer Route in einem Satz (für Schiffsfenster und Editor) */
  routeState(s: Ship, r: TradeRoute | null): { text: string; cls: string } {
    if (!r) return { text: 'Noch keine Route.', cls: '' };
    const chk = routeCheck(this.ui.g, s);
    if (r.on && r.blocked) return { text: `⚠️ blockiert: ${r.blocked}`, cls: 'neg' };
    if (r.on) return { text: `▶️ fährt · nächster Halt: ${r.next + 1}. ${this.kName(r.stops[r.next]?.kontor ?? -1)}`, cls: 'pos' };
    if (!chk.ok) return { text: `⏸️ angehalten – ${chk.reason}`, cls: 'warn' };
    return { text: r.blocked ? `⏸️ angehalten (${r.blocked})` : '⏸️ angehalten – bereit zum Start', cls: '' };
  }

  /** Block „Handelsroute“ (ab zwei eigenen Kontoren) im Schiffsfenster */
  shipHtml(s: Ship): string {
    const g = this.ui.g;
    if (s.owner !== HUMAN) return '';
    const mine = this.mine();
    const r = route(g, s);
    if (mine.length < 2 && !r) return '';
    const open = this.routeOpen ?? !!r;
    const short = !r ? 'keine' : r.on ? (r.blocked ? '⚠️ blockiert' : '▶️ fährt') : '⏸️ Pause';
    let h = `<button class="fold-h" data-rfold aria-expanded="${open}"><span>🧭 Handelsroute</span><b><span class="rshort">${short}</span> <i>${open ? '▾' : '▸'}</i></b></button>`;
    if (!open) return h;
    h += '<div class="fold-b">';
    if (!r) {
      h += '<p class="sub">Das Schiff fährt allein zwischen deinen Kontoren hin und her und lädt Waren um.</p>'
        + '<button class="btn wide tw ok" id="rNew">🧭 Route anlegen</button></div>';
      return h;
    }
    h += '<p class="sub rstate" role="status"></p>';
    h += `<ol class="rstops">${r.stops.map((st) => {
      const goods = [...Object.keys(st.laden).map((x) => `⬆️${GOOD[x as GoodId].icon}`), ...Object.keys(st.entladen).map((x) => `⬇️${GOOD[x as GoodId].icon}`)].join(' ');
      return `<li><span>⚓ ${this.kName(st.kontor)}</span><small>${goods || '–'}</small></li>`;
    }).join('')}</ol>`;
    const chk = routeCheck(g, s);
    h += '<div class="tpair">' + (r.on ? '<button class="btn" id="rPause">⏸️ Anhalten</button>'
      : `<button class="btn ok" id="rGo"${chk.ok ? '' : ' aria-disabled="true"'}>▶️ Starten</button>`)
      + '<button class="btn" id="rEdit">✏️ Bearbeiten</button></div></div>';
    return h;
  }

  /** laufender Zustand im Block (ohne neu aufzubauen) */
  paintShip(box: HTMLElement, s: Ship) {
    const r = route(this.ui.g, s);
    const el = box.querySelector<HTMLElement>('.rstate');
    if (!el || !r) return;
    const st = this.routeState(s, r);
    if (el.textContent !== st.text) el.textContent = st.text;
    el.className = `sub rstate ${st.cls}`;
  }

  /** Knöpfe im Routen-Block verbinden */
  bindShip(box: HTMLElement, s: Ship) {
    const ui = this.ui, g = ui.g;
    const redo = () => ui.renderInfo();
    box.querySelector('[data-rfold]')?.addEventListener('click', (e) => {
      this.routeOpen = (e.currentTarget as HTMLElement).getAttribute('aria-expanded') !== 'true';
      redo();
    });
    box.querySelector('#rNew')?.addEventListener('click', () => {
      const mine = this.mine();
      const here = g.shipDock(s);
      const first = here && here.owner === HUMAN ? here : mine[0];
      const second = mine.find((k) => k !== first);
      if (!first || !second) { ui.toast('Dafür brauchst du zwei Kontore', 'bad'); return; }
      setRoute(g, s, { stops: [{ kontor: first.id, laden: {}, entladen: {} }, { kontor: second.id, laden: {}, entladen: {} }], on: false, next: 0 });
      this.routeOpen = true;
      sound.play('klick');
      redo();
      this.openRoute(s);
    });
    box.querySelector('#rEdit')?.addEventListener('click', () => { sound.play('klick'); this.openRoute(s); });
    box.querySelector('#rGo')?.addEventListener('click', () => { this.start(s); redo(); });
    box.querySelector('#rPause')?.addEventListener('click', () => { pauseRoute(g, s); sound.play('klick'); redo(); });
    this.paintShip(box, s);
  }

  private start(s: Ship): boolean {
    const c = startRoute(this.ui.g, s);
    if (c.ok) { sound.play('glocke'); this.ui.toast(`🧭 ${s.name} fährt die Route`, 'good'); } else this.ui.toast(c.reason ?? '', 'bad');
    return c.ok;
  }

  // ======================================================================
  // Routen-Editor (Fenster in der Bildmitte; das Spiel steht still, solange es offen ist)
  // ======================================================================

  /** Editor für die Route eines Schiffs öffnen (legt keine Route an) */
  openRoute(s: Ship) {
    if (!route(this.ui.g, s)) return;
    this.edShip = s; this.edPick = -1; this.edKind = 'laden'; this.edBase = null;
    this.renderRoute(true);
  }

  /** Route ändern, speichern und den Editor neu zeichnen. Wird die Route ungültig, hält sie an. */
  private editRoute(f: (r: TradeRoute) => void) {
    const g = this.ui.g, s = this.edShip;
    if (!s) return;
    const r = route(g, s);
    if (!r) return;
    const copy: TradeRoute = { ...r, stops: r.stops.map((st) => ({ kontor: st.kontor, laden: { ...st.laden }, entladen: { ...st.entladen } })) };
    f(copy);
    if (copy.next >= copy.stops.length) copy.next = 0;
    setRoute(g, s, copy);
    if (copy.on && !routeCheck(g, s).ok) pauseRoute(g, s);
    this.renderRoute(false);
  }

  /** Waren für die Route: was gebraucht wird oder in einem eigenen Kontor bzw. an Bord ist */
  private routeGoods(s: Ship): GoodId[] {
    const g = this.ui.g, mine = this.mine();
    return GOODS.map((x) => x.id).filter((id) => this.ui.relevant.has(id) || g.shipCargo(s, id) > 0
      || mine.some((k) => (g.lagerOf(HUMAN, k.island)?.[id] ?? 0) >= 1));
  }

  private renderRoute(first: boolean) {
    const ui = this.ui, g = ui.g, s = this.edShip;
    const r = s ? route(g, s) : null;
    if (!s || !r || !g.ships.includes(s)) { this.edShip = null; ui.closeModal(); return; }
    const old = document.querySelector<HTMLElement>('#modal .troute .tr-stops');
    const keep = first || !old ? 0 : old.scrollTop;
    const mine = this.mine();
    const goods = this.routeGoods(s);
    // linke Spalte: Karte und Kontor-Liste
    const used = (id: number) => r.stops.map((st, i) => (st.kontor === id ? i + 1 : 0)).filter(Boolean);
    let left = '<canvas id="trMap" width="300" height="300" aria-label="Karte mit deinen Kontoren – antippen fügt einen Halt hinzu"></canvas>';
    left += '<p class="tr-tip">Kontor antippen = nächster Halt</p><div class="tr-chips">';
    left += mine.map((k) => {
      const u = used(k.id);
      return `<button class="btn tr-chip${u.length ? ' in' : ''}" data-rk-add="${k.id}">⚓ ${g.islands[k.island]?.name ?? '?'}${u.length ? `<small>Halt ${u.join(', ')}</small>` : ''}</button>`;
    }).join('');
    left += '</div>';
    // rechte Spalte: Halte
    let right = '';
    r.stops.forEach((st, i) => {
      right += `<div class="tr-stop"><div class="tr-sh"><b class="tr-n">${i + 1}</b><span>⚓ ${this.kName(st.kontor)}</span>`
        + `<button class="btn tx" data-r-del="${i}" aria-label="Halt ${i + 1} entfernen">✕</button></div>`;
      const rows = [...(Object.entries(st.laden) as [GoodId, number][]).map(([gd, n]) => ['laden', gd, n] as const),
        ...(Object.entries(st.entladen) as [GoodId, number][]).map(([gd, n]) => ['entladen', gd, n] as const)];
      if (!rows.length) right += '<p class="sub tr-empty">Hier noch nichts laden oder ausladen.</p>';
      for (const [kind, gd, n] of rows) {
        const key = `${i}:${kind}:${gd}`;
        right += `<div class="tr-row"><span title="${GOOD[gd].name}">${GOOD[gd].icon} ${GOOD[gd].name}</span>`
          + `<button class="btn tr-dir ${kind}" data-r-flip="${key}" aria-label="${GOOD[gd].name}: zwischen Laden und Ausladen wechseln">${kind === 'laden' ? '⬆️ laden bis' : '⬇️ ausladen'}</button>`
          + `<button class="btn" data-r-n="${key}" data-d="-1" aria-label="${GOOD[gd].name}: ${ROUTE_STEP} t weniger">−</button>`
          + `<b>${n} t</b>`
          + `<button class="btn" data-r-n="${key}" data-d="1" aria-label="${GOOD[gd].name}: ${ROUTE_STEP} t mehr"${n >= ROUTE_MAX ? ' aria-disabled="true"' : ''}>+</button></div>`;
      }
      if (this.edPick === i) {
        right += '<div class="tr-pick"><div class="tr-kind">'
          + `<button class="btn${this.edKind === 'laden' ? ' active' : ''}" data-r-kind="laden" aria-pressed="${this.edKind === 'laden'}">⬆️ Laden</button>`
          + `<button class="btn${this.edKind === 'entladen' ? ' active' : ''}" data-r-kind="entladen" aria-pressed="${this.edKind === 'entladen'}">⬇️ Ausladen</button></div>`
          + `<div class="tr-goods">${goods.map((gd) => `<button class="btn" data-r-good="${gd}"><span>${GOOD[gd].icon}</span>${GOOD[gd].name}</button>`).join('')}</div>`
          + '<button class="btn tr-cancel" data-r-pickx>Fertig</button></div>';
      } else right += `<button class="btn tr-add" data-r-pick="${i}">＋ Ware laden oder ausladen</button>`;
      right += '</div>';
    });
    if (r.stops.length < ROUTE_STOPS) right += `<p class="sub tr-more">${r.stops.length < 2 ? 'Tippe links ein zweites Kontor an.' : `Bis zu ${ROUTE_STOPS} Halte: links ein weiteres Kontor antippen.`}</p>`;
    right += `<p class="sub">⬆️ Laden bis: so viel soll danach an Bord sein. ⬇️ Ausladen: bis zu so viel kommt ins Kontor (je höchstens ${ROUTE_MAX} t).</p>`;
    right += '<button class="btn danger tr-delall" id="trDel">🗑️ Route löschen</button>';
    const st = this.routeState(s, r);
    const chk = routeCheck(g, s);
    const foot = `<p class="tr-state ${st.cls}" role="status">${st.text}</p><button class="btn" id="trDone">✓ Fertig</button>`
      + (r.on ? '<button class="btn" id="trPause">⏸️ Anhalten</button>' : `<button class="btn ok" id="trGo"${chk.ok ? '' : ' aria-disabled="true"'}>▶️ Starten</button>`);
    const box = ui.dialog({ title: `🧭 Route: ${s.name}`, cls: 'troute', body: `<div class="tr-left">${left}</div><div class="tr-stops">${right}</div>`, foot });
    const stops = box.querySelector<HTMLElement>('.tr-stops');
    if (stops) stops.scrollTop = keep;
    this.drawRouteMap(box.querySelector<HTMLCanvasElement>('#trMap'), s, r, mine);
    this.bindRoute(box, s, mine);
  }

  private bindRoute(box: HTMLElement, s: Ship, mine: Building[]) {
    const ui = this.ui, g = ui.g;
    const addStop = (k: Building) => {
      const r = route(g, s);
      if (!r) return;
      if (r.stops.length >= ROUTE_STOPS) { ui.toast(`Höchstens ${ROUTE_STOPS} Halte – erst einen Halt entfernen (✕)`, 'info'); return; }
      if (r.stops[r.stops.length - 1]?.kontor === k.id) { ui.toast('Das ist schon der letzte Halt', 'info'); return; }
      sound.play('klick');
      this.editRoute((x) => { x.stops.push({ kontor: k.id, laden: {}, entladen: {} }); });
    };
    box.querySelectorAll<HTMLElement>('[data-rk-add]').forEach((bt) => bt.addEventListener('click', () => {
      const k = mine.find((b) => b.id === Number(bt.dataset.rkAdd));
      if (k) addStop(k);
    }));
    const cv = box.querySelector<HTMLCanvasElement>('#trMap');
    cv?.addEventListener('click', (e) => {
      const rc = cv.getBoundingClientRect();
      const v = this.edView;
      const best = mine.map((k) => {
        const [x, y] = g.center(k);
        const px = rc.left + ((x - v.x0) / v.side) * rc.width, py = rc.top + ((y - v.y0) / v.side) * rc.height;
        return { k, d: Math.hypot(px - e.clientX, py - e.clientY) };
      }).sort((a, b) => a.d - b.d)[0];
      if (best && best.d <= 26) addStop(best.k);
      else ui.toast('Tippe auf ein Kontor (⚓) auf der Karte', 'info');
    });
    box.querySelectorAll<HTMLElement>('[data-r-del]').forEach((bt) => bt.addEventListener('click', () => {
      const i = Number(bt.dataset.rDel);
      if (this.edPick === i) this.edPick = -1; else if (this.edPick > i) this.edPick--;
      sound.play('klick');
      this.editRoute((r) => { r.stops.splice(i, 1); if (r.next > i) r.next--; });
    }));
    box.querySelectorAll<HTMLElement>('[data-r-pick]').forEach((bt) => bt.addEventListener('click', () => {
      this.edPick = Number(bt.dataset.rPick);
      // erster Halt: meist laden, spätere Halte: meist ausladen
      this.edKind = this.edPick === 0 ? 'laden' : 'entladen';
      this.renderRoute(false);
    }));
    box.querySelector('[data-r-pickx]')?.addEventListener('click', () => { this.edPick = -1; this.renderRoute(false); });
    box.querySelectorAll<HTMLElement>('[data-r-kind]').forEach((bt) => bt.addEventListener('click', () => {
      this.edKind = bt.dataset.rKind as 'laden' | 'entladen'; this.renderRoute(false);
    }));
    box.querySelectorAll<HTMLElement>('[data-r-good]').forEach((bt) => bt.addEventListener('click', () => {
      const gd = bt.dataset.rGood as GoodId, i = this.edPick, kind = this.edKind;
      let auto = -1;
      sound.play('klick');
      this.editRoute((r) => { auto = addRouteGood(r, i, kind, gd); });
      if (auto >= 0) ui.toast(`⬇️ ${GOOD[gd].name} wird an Halt ${auto + 1} ausgeladen – ändern geht dort`, 'info');
    }));
    box.querySelectorAll<HTMLElement>('[data-r-n]').forEach((bt) => bt.addEventListener('click', () => {
      const [i, kind, gd] = bt.dataset.rN!.split(':') as [string, 'laden' | 'entladen', GoodId];
      const r = route(g, s);
      const n = r?.stops[Number(i)]?.[kind][gd] ?? 0;
      if (Number(bt.dataset.d) > 0 && n >= ROUTE_MAX) { ui.toast(`Höchstens ${ROUTE_MAX} t je Ware und Halt`, 'info'); return; }
      this.editRoute((x) => stepRouteGood(x, Number(i), kind, gd, Number(bt.dataset.d)));
    }));
    box.querySelectorAll<HTMLElement>('[data-r-flip]').forEach((bt) => bt.addEventListener('click', () => {
      const [i, kind, gd] = bt.dataset.rFlip!.split(':') as [string, 'laden' | 'entladen', GoodId];
      sound.play('klick');
      this.editRoute((x) => flipRouteGood(x, Number(i), kind, gd));
    }));
    box.querySelector('#trDone')?.addEventListener('click', () => { this.edShip = null; ui.closeModal(); ui.renderInfo(); });
    box.querySelector('#trGo')?.addEventListener('click', () => {
      if (this.start(s)) { this.edShip = null; ui.closeModal(); ui.renderInfo(); }
    });
    box.querySelector('#trPause')?.addEventListener('click', () => { pauseRoute(g, s); sound.play('klick'); this.renderRoute(false); });
    box.querySelector('#trDel')?.addEventListener('click', () => {
      ui.ask('🗑️ Route löschen?', 'Die Halte und Waren dieser Route gehen verloren. Die Ladung bleibt an Bord.', '🗑️ Löschen', () => {
        pauseRoute(g, s); setRoute(g, s, null); this.routeOpen = null; this.edShip = null; ui.renderInfo();
      }, () => this.renderRoute(false));
    });
  }

  /** kleine Karte: Inseln, eigene Kontore (⚓), Halte mit Nummern und Linie, das Schiff */
  private drawRouteMap(cv: HTMLCanvasElement | null, s: Ship, r: TradeRoute, mine: Building[]) {
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const g = this.ui.g, N = g.size;
    // Ausschnitt: alle eigenen Kontore und das Schiff, mit Rand, quadratisch
    let x0 = s.x, x1 = s.x, y0 = s.y, y1 = s.y;
    for (const k of mine) { const [x, y] = g.center(k); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const side = Math.min(N, Math.max(48, Math.ceil(Math.max(x1 - x0, y1 - y0) + 28)));
    const vx = Math.max(0, Math.min(N - side, Math.round((x0 + x1) / 2 - side / 2)));
    const vy = Math.max(0, Math.min(N - side, Math.round((y0 + y1) / 2 - side / 2)));
    this.edView = { x0: vx, y0: vy, side };
    // Landschaft (nur einmal je Ausschnitt berechnet)
    const key = `${vx},${vy},${side}`;
    if (!this.edBase || this.edBase.key !== key) {
      const base = document.createElement('canvas');
      base.width = side; base.height = side;
      const bc = base.getContext('2d')!;
      const img = bc.createImageData(side, side);
      for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
        const k = g.idx(vx + x, vy + y), t = g.tiles[k];
        const c = !g.seen[k] ? [44, 52, 62] : t === 0 ? [38, 98, 140]
          : g.own[k] === HUMAN ? [86, 128, 196] : t === 1 ? [205, 188, 132] : t === 3 ? [58, 104, 54] : t === 4 ? [124, 118, 108] : [102, 152, 76];
        const i = (y * side + x) * 4;
        img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
      }
      bc.putImageData(img, 0, 0);
      this.edBase = { key, cv: base };
    }
    const W = cv.width, sc = W / side;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.edBase.cv, 0, 0, W, W);
    const P = (x: number, y: number): [number, number] => [(x - vx) * sc, (y - vy) * sc];
    // Linie der Route (geschlossen)
    const pts = r.stops.map((st) => g.byId.get(st.kontor)).filter((k): k is Building => !!k).map((k) => P(...g.center(k)));
    if (pts.length >= 2) {
      ctx.strokeStyle = 'rgba(227,180,72,.95)'; ctx.lineWidth = 5; ctx.setLineDash([14, 9]);
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
      ctx.setLineDash([]);
    }
    // Kontore: Kreis; Halte golden mit Nummer(n)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const k of mine) {
      const [x, y] = P(...g.center(k));
      const nums = r.stops.map((st, i) => (st.kontor === k.id ? i + 1 : 0)).filter(Boolean);
      ctx.fillStyle = nums.length ? '#e3b448' : '#f1e3c2';
      ctx.strokeStyle = '#2b2118'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, nums.length ? 17 : 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2b2118';
      ctx.font = `bold ${nums.length > 1 ? 16 : 20}px sans-serif`;
      ctx.fillText(nums.length ? nums.join('·') : '⚓', x, y + 1);
    }
    // Schiff (liegt es an einem Kontor, etwas daneben – sonst verdeckt es die Nummer des Halts)
    let [sx, sy] = P(s.x, s.y);
    if (mine.some((k) => { const [x, y] = P(...g.center(k)); return Math.hypot(x - sx, y - sy) < 26; })) { sx += 22; sy -= 20; }
    ctx.fillStyle = '#ffe066'; ctx.strokeStyle = '#2b2118'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sx, sy - 11); ctx.lineTo(sx + 9, sy + 8); ctx.lineTo(sx - 9, sy + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // ======================================================================
  // Abwracken (Schiffsfenster, mit Rückfrage)
  // ======================================================================

  /** Knopf „Schiff abwracken“ (nur am eigenen Kontor) */
  scrapHtml(s: Ship): string {
    const g = this.ui.g;
    if (s.owner !== HUMAN || !g.shipDock(s) || s.path.length) return '';
    const sc = canScrap(g, s);
    const ref = scrapRefund(s);
    return `<button class="btn wide tw danger tscrap" id="tScrap"${sc.ok ? '' : ' aria-disabled="true"'}>♻️ Schiff abwracken<small>${sc.ok ? `zurück: ${GOOD.holz.icon}${ref.holz} ${GOOD.stoff.icon}${ref.stoff}` : sc.reason}</small></button>`;
  }

  bindScrap(box: HTMLElement, s: Ship) {
    const ui = this.ui, g = ui.g;
    box.querySelector('#tScrap')?.addEventListener('click', () => {
      const c = canScrap(g, s);
      if (!c.ok) { ui.toast(c.reason ?? '', 'bad'); return; }
      const ref = scrapRefund(s);
      ui.ask(`♻️ ${s.name} abwracken?`, `Das Schiff wird zerlegt und ist danach weg. Du bekommst ${ref.holz} Holz und ${ref.stoff} Stoffe zurück (soweit im Lager Platz ist).`, '♻️ Abwracken', () => {
        const res = scrap(g, s);
        if (res.ok) { sound.play('kisten'); ui.toast(`♻️ ${s.name} abgewrackt: +${res.holz} Holz, +${res.stoff} Stoffe`, 'good'); ui.selectShip(null); }
        else { ui.toast(res.reason ?? '', 'bad'); ui.renderInfo(); }
      }, () => ui.renderInfo());
    });
  }
}
