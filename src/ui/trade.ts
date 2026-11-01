// Einfache Handels-Bedienung (Paket S2; die große Handelsoberfläche kommt mit U5):
// - Reiter „⚖️ Handel“ im Kontor: Händler-Zustand, Aufträge (Ware, Kaufen/Verkaufen, Schwelle, Preis) und der
//   teure Sofort-Handel als Notbehelf.
// - Block „🧭 Handelsroute“ im Schiffsfenster (ab zwei eigenen Kontoren): Halte, Laden/Ausladen je Ware,
//   Starten/Pause; am eigenen Kontor zusätzlich „Abwracken“.
// Einstiege: ui/info.ts zeigt den Reiter und ui/ship.ts den Block, wenn `ready` true ist.
// Auswahlfelder (Ware, Kontor) merken sich die Wahl hier, weil das Infofenster regelmäßig neu aufgebaut wird.
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

/** Schritte der Knöpfe: Schwelle ±10 t, Preis ±5 % des Grundpreises, Route ±10 t */
const LIMIT_STEP = 10;
const PRICE_STEP = 0.05;
const ROUTE_STEP = 10;

export class TradePanel implements Part {
  /** gewählte Ware für einen neuen Auftrag */
  private pick: GoodId | '' = '';
  /** gewählte Ware je Halt der Route */
  private stopPick: Record<number, GoodId> = {};
  /** Block „Handelsroute“ aufgeklappt? (ohne eigene Wahl: offen, wenn es eine Route gibt) */
  private routeOpen: boolean | null = null;

  constructor(readonly ui: UI) {}

  /** sobald Händlerschiffe fahren (ab dem ersten Kontor) */
  get ready(): boolean { return active(this.ui.g); }

  // ---------- Kontor ----------

  /** Waren, die der Spieler gerade braucht oder hat (Regel 8: nur Nutzbares) */
  private goodsFor(k: Building): GoodId[] {
    const g = this.ui.g, l = g.lagerOf(HUMAN, k.island);
    return GOODS.map((x) => x.id).filter((id) => PRICES[id] && (this.ui.relevant.has(id) || (l?.[id] ?? 0) >= 1));
  }

  /** Inhalt des Reiters „Handel“ im Kontor */
  kontorHtml(k: Building): string {
    const g = this.ui.g, l = g.lagerOf(HUMAN, k.island);
    const list = orders(g, k), sl = slots(k);
    const nb = list.filter((o) => o.buy).length, ns = list.length - nb;
    let h = `<p class="sub">${traderStatus(g, k)}</p>`;
    h += `<h4>Aufträge für den Händler</h4><p class="sub">Kaufen ${nb} von ${sl.buy} · Verkaufen ${ns} von ${sl.sell}</p>`;
    if (!list.length) h += '<p class="sub">Noch keine Aufträge. Der Händler kauft und verkauft nur, was du hier einstellst.</p>';
    for (const o of list) h += this.orderHtml(k, o, Math.floor(l?.[o.g] ?? 0));
    // neuer Auftrag
    const free = this.goodsFor(k).filter((id) => !list.some((o) => o.g === id));
    if (free.length && (nb < sl.buy || ns < sl.sell)) {
      if (!this.pick || !free.includes(this.pick)) this.pick = free[0];
      h += `<h4>Neuer Auftrag</h4><select class="tsel" id="tGood" aria-label="Ware für den neuen Auftrag">${free.map((id) =>
        `<option value="${id}"${id === this.pick ? ' selected' : ''}>${GOOD[id].icon} ${GOOD[id].name}</option>`).join('')}</select>`;
      const canSell = ns < sl.sell, canBuy = nb < sl.buy && sells(g, this.pick);
      h += `<div class="tpair"><button class="btn" id="tBuy"${canBuy ? '' : ' disabled'}>➕ Kaufen</button><button class="btn" id="tSell"${canSell ? '' : ' disabled'}>➕ Verkaufen</button></div>`;
      if (nb < sl.buy && !sells(g, this.pick)) h += '<p class="sub">Diese Ware hat der Händler erst, wenn sie jemand hergestellt hat.</p>';
    } else if (list.length) h += '<p class="sub">Alle Plätze belegt – ein größeres Kontor hat mehr.</p>';
    // Sofort-Handel als teurer Notbehelf
    h += `<h4>Sofort handeln</h4><p class="sub">Ohne Händlerschiff, dafür deutlich teurer. Je 5 t, Preis je Tonne.</p>`;
    for (const id of this.goodsFor(k)) {
      const pr = sofortPreis(g, id);
      if (!pr) continue;
      h += `<div class="trade"><span>${GOOD[id].icon} ${GOOD[id].name}</span><button class="btn" data-buy="${id}" aria-label="${GOOD[id].name}: 5 t kaufen">+5 · ${pr.kaufen}</button><button class="btn" data-sell="${id}" aria-label="${GOOD[id].name}: 5 t verkaufen">−5 · ${pr.verkaufen}</button></div>`;
    }
    return h;
  }

  private orderHtml(k: Building, o: TradeOrder, have: number): string {
    const g = this.ui.g;
    const base = basePrice(o.g, o.buy) ?? 1;
    const mp = marketPrice(g, o.g);
    const hint = mp ? (o.buy ? `Händler verkauft gerade ab ${mp.kaufen}` : `Händler kauft gerade bis ${mp.verkaufen}`) : '';
    const ok = mp ? (o.buy ? o.price >= mp.kaufen && sells(g, o.g) : o.price <= mp.verkaufen) : false;
    return `<div class="tord"><div class="tord-h"><span>${GOOD[o.g].icon} ${GOOD[o.g].name} <small>(da: ${have} t)</small></span>`
      + `<button class="btn tx" data-odel="${o.g}" aria-label="Auftrag ${GOOD[o.g].name} löschen">✕</button></div>`
      + `<p class="sub">${o.buy ? '⬇️ Kaufen bis' : '⬆️ Verkaufen über'} <b>${o.limit} t</b> · <b>${o.price}</b> Taler/t (${Math.round((o.price / base) * 100)} %)</p>`
      + `<p class="sub ${ok ? 'pos' : 'neg'}">${ok ? '✓' : '✗'} ${hint}</p>`
      + `<div class="tsteps"><button class="btn" data-olim="${o.g}" data-d="-1" aria-label="Schwelle weniger">−${LIMIT_STEP} t</button>`
      + `<button class="btn" data-olim="${o.g}" data-d="1" aria-label="Schwelle mehr">+${LIMIT_STEP} t</button>`
      + `<button class="btn" data-opr="${o.g}" data-d="-1" aria-label="Preis niedriger">−5 %</button>`
      + `<button class="btn" data-opr="${o.g}" data-d="1" aria-label="Preis höher">+5 %</button></div></div>`;
  }

  /** Knöpfe im Reiter verbinden (box = Inhalt des Infofensters, gerade neu aufgebaut) */
  bindKontor(box: HTMLElement, k: Building) {
    const ui = this.ui, g = ui.g;
    const find = (id: string) => orders(g, k).find((o) => o.g === id);
    const redo = () => ui.renderInfo();
    box.querySelector<HTMLSelectElement>('#tGood')?.addEventListener('change', (e) => { this.pick = (e.target as HTMLSelectElement).value as GoodId; redo(); });
    const add = (buy: boolean) => {
      if (!this.pick) return;
      const r = setOrder(g, k, defaultOrder(this.pick, buy));
      if (r.ok) sound.play('klick'); else ui.toast(r.reason ?? '', 'bad');
      redo();
    };
    box.querySelector('#tBuy')?.addEventListener('click', () => add(true));
    box.querySelector('#tSell')?.addEventListener('click', () => add(false));
    box.querySelectorAll<HTMLElement>('[data-odel]').forEach((bt) => bt.addEventListener('click', () => { removeOrder(g, k, bt.dataset.odel as GoodId); sound.play('klick'); redo(); }));
    box.querySelectorAll<HTMLElement>('[data-olim]').forEach((bt) => bt.addEventListener('click', () => {
      const o = find(bt.dataset.olim!);
      if (!o) return;
      setOrder(g, k, { ...o, limit: o.limit + Number(bt.dataset.d) * LIMIT_STEP });
      redo();
    }));
    box.querySelectorAll<HTMLElement>('[data-opr]').forEach((bt) => bt.addEventListener('click', () => {
      const o = find(bt.dataset.opr!);
      if (!o) return;
      const base = basePrice(o.g, o.buy) ?? 0;
      const [lo, hi] = priceRange(o.g, o.buy);
      const step = Math.max(1, Math.round(base * PRICE_STEP));
      const p = Math.max(lo, Math.min(hi, o.price + Number(bt.dataset.d) * step));
      if (p === o.price) ui.toast(Number(bt.dataset.d) > 0 ? 'Höher geht es nicht (105 %)' : 'Niedriger geht es nicht (70 %)', 'info');
      setOrder(g, k, { ...o, price: p });
      redo();
    }));
    box.querySelectorAll<HTMLElement>('[data-buy],[data-sell]').forEach((bt) => bt.addEventListener('click', () => {
      const id = (bt.dataset.buy ?? bt.dataset.sell) as GoodId;
      const n = sofort(g, HUMAN, k.island, id, bt.dataset.buy ? 5 : -5);
      if (n) sound.play('muenzen');
      else ui.toast(bt.dataset.buy ? 'Nicht genug Taler oder Lager voll' : 'Nichts zum Verkaufen da', 'bad');
      redo();
    }));
  }

  // ---------- Schiff ----------

  /** Block „Handelsroute“ (ab zwei eigenen Kontoren) und „Abwracken“ (am eigenen Kontor) im Schiffsfenster */
  shipHtml(s: Ship): string {
    const g = this.ui.g;
    if (s.owner !== HUMAN) return '';
    let h = '';
    const mine = g.buildings.filter((b) => b.type === 'kontor' && b.owner === HUMAN);
    const r = route(g, s);
    if (mine.length >= 2 || r) {
      const open = this.routeOpen ?? !!r;
      const state = !r ? 'keine' : r.on ? (r.blocked ? '⚠️ blockiert' : '▶️ fährt') : '⏸️ Pause';
      h += `<button class="fold-h" data-rfold aria-expanded="${open}"><span>🧭 Handelsroute</span><b>${state} <i>${open ? '▾' : '▸'}</i></b></button>`;
      if (open) h += `<div class="fold-b">${this.routeHtml(s, r, mine)}</div>`;
    }
    const sc = canScrap(g, s);
    if (g.shipDock(s) && !s.path.length) {
      const ref = scrapRefund(s);
      h += `<button class="btn wide tw danger tscrap" id="tScrap"${sc.ok ? '' : ' aria-disabled="true"'}>♻️ Schiff abwracken<small>${sc.ok ? `zurück: ${GOOD.holz.icon}${ref.holz} ${GOOD.stoff.icon}${ref.stoff}` : sc.reason}</small></button>`;
    }
    return h;
  }

  private routeHtml(s: Ship, r: TradeRoute | null, mine: Building[]): string {
    const g = this.ui.g;
    const name = (id: number) => { const k = g.byId.get(id); return k ? g.islands[k.island]?.name ?? '?' : 'fehlt'; };
    if (!r) {
      return '<p class="sub">Das Schiff fährt allein zwischen deinen Kontoren hin und her und lädt Waren um.</p>'
        + '<button class="btn wide tw ok" id="rNew">🧭 Route anlegen</button>';
    }
    let h = '';
    if (r.on) h += `<p class="sub">Nächster Halt: ${r.next + 1}. ${name(r.stops[r.next]?.kontor ?? -1)}</p>`;
    if (r.blocked) h += `<p class="sub neg">⚠️ ${r.blocked}</p>`;
    const goods = GOODS.map((x) => x.id).filter((id) => this.ui.relevant.has(id) || mine.some((k) => (g.lagerOf(HUMAN, k.island)?.[id] ?? 0) >= 1));
    r.stops.forEach((st, i) => {
      h += `<div class="tstop"><div class="tord-h"><select class="tsel" data-skon="${i}" aria-label="Kontor für Halt ${i + 1}">`
        + mine.map((k) => `<option value="${k.id}"${k.id === st.kontor ? ' selected' : ''}>${i + 1}. ⚓ ${g.islands[k.island]?.name ?? ''}</option>`).join('')
        + (mine.some((k) => k.id === st.kontor) ? '' : '<option selected disabled>– Kontor fehlt –</option>')
        + `</select><button class="btn tx" data-sdel="${i}" aria-label="Halt ${i + 1} löschen"${r.stops.length <= 2 ? ' disabled' : ''}>✕</button></div>`;
      for (const [kind, label] of [['laden', '⬆️ bis'], ['entladen', '⬇️']] as const) {
        for (const [gd, n] of Object.entries(st[kind]) as [GoodId, number][]) {
          h += `<div class="trow"><span title="${GOOD[gd].name} ${kind === 'laden' ? 'laden' : 'ausladen'}">${GOOD[gd].icon} ${label} ${n} t</span>`
            + `<button class="btn" data-rn="${i}" data-k="${kind}" data-g="${gd}" data-d="-1" aria-label="${GOOD[gd].name} weniger">−</button>`
            + `<button class="btn" data-rn="${i}" data-k="${kind}" data-g="${gd}" data-d="1" aria-label="${GOOD[gd].name} mehr">+</button></div>`;
        }
      }
      const pick = this.stopPick[i] && goods.includes(this.stopPick[i]) ? this.stopPick[i] : goods[0];
      if (pick) {
        h += `<select class="tsel" data-sgood="${i}" aria-label="Ware für Halt ${i + 1}">${goods.map((id) => `<option value="${id}"${id === pick ? ' selected' : ''}>${GOOD[id].icon} ${GOOD[id].name}</option>`).join('')}</select>`
          + `<div class="tpair"><button class="btn" data-sadd="${i}" data-k="laden">⬆️ Laden</button><button class="btn" data-sadd="${i}" data-k="entladen">⬇️ Ausladen</button></div>`;
      }
      h += '</div>';
    });
    if (r.stops.length < ROUTE_STOPS) h += '<button class="btn wide tw" id="rAdd">➕ Halt dazu</button>';
    const chk = routeCheck(g, s);
    h += r.on ? '<button class="btn wide tw" id="rPause">⏸️ Route anhalten</button>'
      : `<button class="btn wide tw ok" id="rGo"${chk.ok ? '' : ' aria-disabled="true"'}>▶️ Route starten${chk.ok ? '' : `<small>${chk.reason}</small>`}</button>`;
    h += '<button class="btn wide tw danger" id="rDel">🗑️ Route löschen</button>';
    h += `<p class="sub">⬆️ Laden bis: so viel soll danach an Bord sein. ⬇️ Ausladen: so viel kommt ins Kontor (je höchstens ${ROUTE_MAX} t).</p>`;
    return h;
  }

  /** Knöpfe im Routen-Block verbinden */
  bindShip(box: HTMLElement, s: Ship) {
    const ui = this.ui, g = ui.g;
    const redo = () => ui.renderInfo();
    const edit = (f: (r: TradeRoute) => void) => { const r = route(g, s); if (!r) return; f(r); setRoute(g, s, r); redo(); };
    box.querySelector('[data-rfold]')?.addEventListener('click', (e) => {
      this.routeOpen = (e.currentTarget as HTMLElement).getAttribute('aria-expanded') !== 'true';
      redo();
    });
    box.querySelector('#rNew')?.addEventListener('click', () => {
      const mine = g.buildings.filter((b) => b.type === 'kontor' && b.owner === HUMAN);
      const here = g.shipDock(s);
      const first = here && here.owner === HUMAN ? here : mine[0];
      const second = mine.find((k) => k !== first);
      if (!first || !second) { ui.toast('Dafür brauchst du zwei Kontore', 'bad'); return; }
      setRoute(g, s, { stops: [{ kontor: first.id, laden: {}, entladen: {} }, { kontor: second.id, laden: {}, entladen: {} }], on: false, next: 0 });
      this.routeOpen = true;
      sound.play('klick');
      redo();
    });
    box.querySelectorAll<HTMLSelectElement>('[data-skon]').forEach((sel) => sel.addEventListener('change', () => {
      edit((r) => { r.stops[Number(sel.dataset.skon)].kontor = Number(sel.value); });
    }));
    box.querySelectorAll<HTMLSelectElement>('[data-sgood]').forEach((sel) => sel.addEventListener('change', () => {
      this.stopPick[Number(sel.dataset.sgood)] = sel.value as GoodId;
      redo();
    }));
    box.querySelectorAll<HTMLElement>('[data-sdel]').forEach((bt) => bt.addEventListener('click', () => {
      edit((r) => { if (r.stops.length > 2) { r.stops.splice(Number(bt.dataset.sdel), 1); if (r.next >= r.stops.length) r.next = 0; } });
    }));
    box.querySelectorAll<HTMLElement>('[data-sadd]').forEach((bt) => bt.addEventListener('click', () => {
      const i = Number(bt.dataset.sadd), kind = bt.dataset.k as 'laden' | 'entladen';
      const sel = box.querySelector<HTMLSelectElement>(`[data-sgood="${i}"]`);
      const gd = (sel?.value ?? '') as GoodId;
      if (!GOOD[gd]) return;
      edit((r) => { const st = r.stops[i]; st[kind][gd] = Math.max(st[kind][gd] ?? 0, 50); });
    }));
    box.querySelectorAll<HTMLElement>('[data-rn]').forEach((bt) => bt.addEventListener('click', () => {
      const i = Number(bt.dataset.rn), kind = bt.dataset.k as 'laden' | 'entladen', gd = bt.dataset.g as GoodId;
      edit((r) => {
        const st = r.stops[i];
        const n = Math.max(0, Math.min(ROUTE_MAX, (st[kind][gd] ?? 0) + Number(bt.dataset.d) * ROUTE_STEP));
        if (n) st[kind][gd] = n; else delete st[kind][gd];
      });
    }));
    box.querySelector('#rAdd')?.addEventListener('click', () => {
      edit((r) => {
        const last = r.stops[r.stops.length - 1]?.kontor;
        const k = g.buildings.find((b) => b.type === 'kontor' && b.owner === HUMAN && b.id !== last);
        if (k && r.stops.length < ROUTE_STOPS) r.stops.push({ kontor: k.id, laden: {}, entladen: {} });
      });
    });
    box.querySelector('#rGo')?.addEventListener('click', () => {
      const c = startRoute(g, s);
      if (c.ok) { sound.play('glocke'); ui.toast(`🧭 ${s.name} fährt die Route`, 'good'); } else ui.toast(c.reason ?? '', 'bad');
      redo();
    });
    box.querySelector('#rPause')?.addEventListener('click', () => { pauseRoute(g, s); sound.play('klick'); redo(); });
    box.querySelector('#rDel')?.addEventListener('click', () => {
      ui.ask('🗑️ Route löschen?', 'Die Halte und Waren dieser Route gehen verloren.', '🗑️ Löschen', () => { pauseRoute(g, s); setRoute(g, s, null); this.routeOpen = null; redo(); }, redo);
    });
    box.querySelector('#tScrap')?.addEventListener('click', () => {
      const c = canScrap(g, s);
      if (!c.ok) { ui.toast(c.reason ?? '', 'bad'); return; }
      const ref = scrapRefund(s);
      ui.ask(`♻️ ${s.name} abwracken?`, `Das Schiff wird zerlegt. Du bekommst ${ref.holz} Holz und ${ref.stoff} Stoffe zurück (soweit im Lager Platz ist).`, '♻️ Abwracken', () => {
        const res = scrap(g, s);
        if (res.ok) { sound.play('kisten'); ui.toast(`♻️ ${s.name} abgewrackt: +${res.holz} Holz, +${res.stoff} Stoffe`, 'good'); ui.selectShip(null); }
        else { ui.toast(res.reason ?? '', 'bad'); redo(); }
      }, redo);
    });
  }
}
