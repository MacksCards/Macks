// Statistik-Fenster (Paket U2): Bilanz, Steuern, Waren, Bevölkerung, Vergleich mit den Gegnern.
// Einstieg: Tipp auf Geld (→ Bilanz) oder Einwohner (→ Bevölkerung) in der Oberleiste (ui/hud.ts), dazu der
// Knopf „📊 Alle Zahlen“ im Kontor (Reiter Bilanz). Das offene Fenster hält das Spiel an (wie jedes Fenster).
// Die Zahlen kommen aus src/stats.ts (Paket S1); hier wird nur angezeigt.
// Reiter erscheinen erst, wenn es dort etwas gibt (Regel 8): Steuern und Bevölkerung ab dem ersten Haus,
// Waren ab dem ersten Kontor, Vergleich ab dem ersten entdeckten Gegner.
// Nach einem Tipp auf − / + werden nur die Zahlen ausgetauscht (ui/live.ts), neu gebaut wird nur beim Reiterwechsel.
import './stats.css';
import { BUILDINGS, BuildingId, GOODS, TIERS } from '../data';
import { Building, HUMAN, Status } from '../game';
import { Flow, LedgerRow, flows, ledger, popSummary, rates, rivals, rowSum, trend } from '../stats';
import type { UI } from '../ui';
import { Part, fmt } from './util';
import { Live, esc } from './live';
import { bindTax, cashHint, reachedTiers, taxSectionHtml } from './tax';

/** Reiter: Geld → Bilanz, Einwohner → Bevölkerung */
export type StatsTab = 'geld' | 'einwohner' | 'waren' | 'vergleich' | 'steuern';

const TABS: [StatsTab, string, string][] = [
  ['geld', '💰', 'Bilanz'],
  ['steuern', '⚖️', 'Steuern'],
  ['waren', '📦', 'Waren'],
  ['einwohner', '👥', 'Bevölkerung'],
  ['vergleich', '🏁', 'Vergleich'],
];

/** kurz, warum ein Betrieb gerade nichts herstellt */
const WHY: Partial<Record<Status, string>> = {
  keinWeg: 'kein Weg', rohstoff: 'wartet auf Lieferung', lagerVoll: 'Lager voll', zuWeit: 'zu weit vom Kontor',
  aus: 'ruht', erschoepft: 'nichts mehr zu holen', keinWald: 'kein Wald', keinWasser: 'kein Wasser',
};

/** Zahl mit Vorzeichen und Tausenderpunkt (+1.234 / −56) */
const sg = (n: number) => (Math.abs(n) < 0.5 ? '0' : (n > 0 ? '+' : '−') + fmt(Math.abs(n) + 0.5));
/** Zahl mit einer Nachkommastelle (Warenfluss je Minute) */
const f1 = (n: number) => (Math.abs(n) < 0.05 ? '0' : n.toFixed(1).replace('.', ','));
/** „reicht noch“ in Worten */
const lasts = (m: number | null) => (m === null ? '–' : m < 1 ? '< 1 Min' : m >= 120 ? '> 2 Std' : `${Math.floor(m)} Min`);

export class StatsWindow implements Part {
  private tab: StatsTab = 'geld';
  /** Insel für Waren und Bevölkerung (-1 = alle) */
  private island = -1;
  /** Vorlage des gezeigten Inhalts (gleich = nur Zahlen austauschen) */
  private tpl = '';

  constructor(readonly ui: UI) {}

  /** sobald der Spieler etwas gebaut hat (vorher zeigt der Tipp auf Geld/Einwohner das Lager) */
  get ready(): boolean { return this.ui.g.buildings.some((b) => b.owner === HUMAN); }

  /** Reiter, die gerade etwas zeigen */
  private visible(): StatsTab[] {
    const g = this.ui.g;
    const houses = reachedTiers(g).some(Boolean);
    const kontor = !!g.kontor(HUMAN);
    return TABS.map(([id]) => id).filter((id) => id === 'geld' || ((id === 'steuern' || id === 'einwohner') && houses) || (id === 'waren' && kontor)
      || (id === 'vergleich' && rivals(g).length > 1));
  }

  /** Fenster öffnen; tab = womit es beginnt */
  open(tab: StatsTab = 'geld') {
    const ui = this.ui;
    const vis = this.visible();
    this.tab = vis.includes(tab) ? tab : 'geld';
    if (this.island >= 0 && !ui.g.kontor(HUMAN, this.island)) this.island = -1;
    ui.dialog({ title: '📊 Statistik', cls: 'stats', body: `<div class="stw"><div class="sttabs" id="stTabs" role="tablist"></div><div class="stc" id="stC"></div></div>` });
    this.tpl = '';
    this.fill();
  }

  /** Inhalt zeigen: gleicher Aufbau → nur Zahlen austauschen, sonst neu bauen und Knöpfe verbinden */
  private fill() {
    const c = document.getElementById('stC'), tabs = document.getElementById('stTabs');
    if (!c || !tabs) return;
    const L = new Live();
    const tpl = this.html(this.tab, L);
    if (tpl === this.tpl) { L.patch(c); return; }
    const sameTab = this.tpl !== '' && c.dataset.tab === this.tab;
    this.tpl = tpl;
    const vis = this.visible();
    tabs.innerHTML = TABS.filter(([id]) => vis.includes(id)).map(([id, ic, nm]) =>
      `<button class="btn${id === this.tab ? ' active' : ''}" role="tab" aria-selected="${id === this.tab}" data-st="${id}"><span>${ic}</span>${nm}</button>`).join('')
      + `<button class="btn ok go" id="statsX" aria-label="Weiterspielen">▶️ Weiter</button>`;
    c.innerHTML = L.html(tpl);
    c.dataset.tab = this.tab;
    if (!sameTab) c.scrollTop = 0;
    this.bind(c, tabs);
  }

  private bind(c: HTMLElement, tabs: HTMLElement) {
    const ui = this.ui, g = ui.g;
    tabs.querySelectorAll<HTMLElement>('[data-st]').forEach((bt) => bt.addEventListener('click', () => {
      if (this.tab === bt.dataset.st) return;
      this.tab = bt.dataset.st as StatsTab;
      this.fill();
    }));
    document.getElementById('statsX')?.addEventListener('click', () => ui.closeModal());
    c.querySelectorAll<HTMLElement>('[data-isl]').forEach((bt) => bt.addEventListener('click', () => {
      this.island = Number(bt.dataset.isl);
      this.fill();
    }));
    bindTax(c, g, () => this.fill());
    // Sprung zu einem Gebäude: Fenster zu, Gebäude wählen (die Kamera fährt hin)
    c.querySelectorAll<HTMLElement>('[data-jump]').forEach((bt) => bt.addEventListener('click', () => {
      const b = g.buildings.find((x) => x.id === Number(bt.dataset.jump));
      if (b) this.jump(b);
    }));
    c.querySelectorAll<HTMLElement>('[data-miss]').forEach((bt) => bt.addEventListener('click', () => {
      const [t, what] = (bt.dataset.miss ?? '').split('|');
      const b = this.firstHouse(Number(t), (h) => this.lacks(h, what));
      if (b) this.jump(b);
    }));
    c.querySelectorAll<HTMLElement>('[data-ready]').forEach((bt) => bt.addEventListener('click', () => {
      const t = Number(bt.dataset.ready);
      const b = this.firstHouse(t, (h) => h.residents >= TIERS[t].maxResidents && h.happy >= 0.85);
      if (b) this.jump(b);
    }));
    document.getElementById('stDipl')?.addEventListener('click', () => { ui.closeModal(); ui.openDiplomacy(); });
  }

  private jump(b: Building) {
    this.ui.closeModal();
    this.ui.select(b);
  }

  /** erstes Haus einer Stufe (auf der gewählten Insel), das die Bedingung erfüllt */
  private firstHouse(tier: number, ok: (h: Building) => boolean): Building | undefined {
    return this.ui.g.buildings.find((h) => h.owner === HUMAN && h.type === 'haus' && h.tier === tier && (this.island < 0 || h.island === this.island) && ok(h));
  }

  /** fehlt dem Haus die Ware oder das Gebäude mit diesem Namen? (wie src/stats.ts zählt) */
  private lacks(h: Building, what: string): boolean {
    const gd = GOODS.find((x) => x.name === what);
    if (gd) return !!h.short?.[gd.id];
    const s = Object.values(BUILDINGS).find((d) => d.name === what);
    return !!s && !(this.ui.g.coverage.get(h.id)?.has(s.id as BuildingId));
  }

  /** Inhalt eines Reiters (Vorlage für ui/live.ts) */
  html(tab: StatsTab, L: Live = new Live()): string {
    if (tab === 'steuern') return this.taxes(L);
    if (tab === 'waren') return this.goods(L);
    if (tab === 'einwohner') return this.people(L);
    if (tab === 'vergleich') return this.compare(L);
    return this.balance(L);
  }

  /** Inselwahl (nur mit mehr als einer Insel) */
  private islandChips(): string {
    const g = this.ui.g;
    const own = g.buildings.filter((b) => b.owner === HUMAN && b.type === 'kontor').map((b) => b.island).sort((a, b) => a - b);
    if (own.length < 2) { this.island = -1; return ''; }
    const chip = (id: number, name: string) => `<button class="btn chip${this.island === id ? ' active' : ''}" data-isl="${id}" aria-pressed="${this.island === id}">${esc(name)}</button>`;
    return `<div class="chips">${chip(-1, 'Alle Inseln')}${own.map((i) => chip(i, g.islands[i]?.name ?? `Insel ${i}`)).join('')}</div>`;
  }

  // ---------- Bilanz ----------

  private balance(L: Live): string {
    const g = this.ui.g;
    const r = rates(g);
    const rows = ledger(g);
    const last = rows.slice(-30), five = rows.slice(-5);
    const avg = (f: (x: LedgerRow) => number) => (five.length ? five.reduce((s, x) => s + f(x), 0) / five.length : 0);
    const sum = (f: (x: LedgerRow) => number) => last.reduce((s, x) => s + f(x), 0);
    const tax = (x: LedgerRow) => x.steuern.reduce((a, b) => a + b, 0);
    const lines: [string, number, number, boolean][] = [
      ['👥 Steuern', r.steuern.reduce((a, b) => a + b, 0), sum(tax), true],
      ['⚒️ Betriebe', r.betriebe, sum((x) => x.betriebe), true],
      ['⛪ Öffentliche Gebäude', r.dienste, sum((x) => x.dienste), true],
      ['⚔️ Militär', r.militaer, sum((x) => x.militaer), r.militaer !== 0 || sum((x) => x.militaer) !== 0],
      ['⚖️ Handel: Verkauf', avg((x) => x.handelEin), sum((x) => x.handelEin), rows.some((x) => x.handelEin || x.handelAus)],
      ['⚖️ Handel: Einkauf', avg((x) => x.handelAus), sum((x) => x.handelAus), rows.some((x) => x.handelEin || x.handelAus)],
      ['🏗️ Bauen und Sonstiges', avg((x) => x.sonstiges), sum((x) => x.sonstiges), rows.length > 0],
    ];
    const has = last.length > 0;
    let h = `<table class="sttab tmoney"><thead><tr><th></th><th>je Minute</th>${has ? `<th>letzte ${last.length} Min</th>` : ''}</tr></thead><tbody>`;
    let nNow = 0, nSum = 0;
    for (const [lbl, now, tot, show] of lines) {
      nNow += now; nSum += tot;
      if (!show) continue;
      h += `<tr><td>${lbl}</td><td ${L.cls(now >= 0 ? 'pos' : 'neg')}>${L.v(sg(now))}</td>${has ? `<td ${L.cls(tot >= 0 ? 'pos' : 'neg')}>${L.v(sg(tot))}</td>` : ''}</tr>`;
    }
    h += `<tr class="sum"><td>= Überschuss</td><td ${L.cls(nNow >= 0 ? 'pos' : 'neg')}>${L.v(sg(nNow))}</td>${has ? `<td ${L.cls(nSum >= 0 ? 'pos' : 'neg')}>${L.v(sg(nSum))}</td>` : ''}</tr></tbody></table>`;
    h += `<p class="stnote">„je Minute“: Steuern und Unterhalt im Augenblick, Handel und Bauen im Mittel der letzten 5 Minuten.</p>`;
    h += `<p ${L.cls('sthint neg')}>${L.v(cashHint(g))}</p>`;
    // Verlauf: Überschuss jeder Spielminute als Balken
    h += `<h4>Verlauf der letzten 30 Minuten</h4>`;
    if (last.length < 2) h += `<p class="stnote">Der Verlauf erscheint nach den ersten Spielminuten.</p>`;
    else {
      const money = trend(g, 'geld').slice(-last.length);
      h += bars(last.map(rowSum));
      h += `<div class="staxis"><span>vor ${last.length} Min</span><span>Kasse ${fmt(money[0] ?? 0)} → ${L.v(fmt(g.money))}</span><span>jetzt</span></div>`;
    }
    // teuerste Gebäude: zuerst die, die Geld kosten und nichts herstellen
    const cost = g.buildings.filter((b) => b.owner === HUMAN && g.upkeepOf(b) > 0).map((b) => {
      const d = BUILDINGS[b.type];
      const idle = !!d.prod && g.isIdle(b);
      const why = idle ? `produziert nichts${WHY[b.status] ? ` – ${WHY[b.status]}` : ''}`
        : d.prod ? `arbeitet zu ${Math.round(b.active * 100)} %`
        : b.type === 'werft' || b.type === 'grosswerft' ? (b.job ? 'baut ein Schiff' : 'kein Auftrag')
        : d.category === 'militaer' ? 'Militär' : b.type === 'kontor' ? 'Lager und Hafen' : 'versorgt die Bewohner';
      return { b, up: g.upkeepOf(b), idle, why };
    }).sort((a, c) => Number(c.idle) - Number(a.idle) || c.up - a.up).slice(0, 5);
    if (cost.length) {
      h += `<h4>Was am meisten kostet</h4>`;
      for (const x of cost) {
        const d = BUILDINGS[x.b.type];
        h += `<button class="jrow${x.idle ? ' bad' : ''}" data-jump="${x.b.id}" aria-label="${d.name} zeigen"><span>${d.icon} ${d.name}<small>${x.why}${g.islands[x.b.island] && this.multi() ? ` · ${esc(g.islands[x.b.island].name)}` : ''}</small></span><b class="neg">−${fmt(x.up)}</b><i>📍</i></button>`;
      }
      h += `<p class="stnote">Tippe eine Zeile an, um hinzuspringen. Betriebe ohne Arbeit lassen sich ruhen lassen – das spart Unterhalt.</p>`;
    }
    return h;
  }

  private multi(): boolean { return this.ui.g.buildings.filter((b) => b.owner === HUMAN && b.type === 'kontor').length > 1; }

  // ---------- Steuern ----------

  private taxes(L: Live): string {
    const g = this.ui.g;
    const inc = g.incomePerMinute();
    let h = `<p ${L.cls('sthint neg')}>${L.v(cashHint(g))}</p>`;
    h += `<div class="row"><span>Steuern zusammen</span><b>${L.v(`${fmt(inc.tax + 0.5)} Taler je Minute`)}</b></div>`;
    h += `<div class="row"><span>Unterhalt zusammen</span><b>${L.v(`${fmt(inc.upkeep + 0.5)} Taler je Minute`)}</b></div>`;
    h += taxSectionHtml(L, g, -1);
    h += `<p class="stnote">😊 = tragen sie gern · 😐 = gerade noch · 😠 = zu hoch, Bewohner ziehen aus. Fehlende Waren senken, was sie tragen.</p>`;
    return h;
  }

  // ---------- Waren ----------

  private goods(L: Live): string {
    const g = this.ui.g;
    let h = this.islandChips();
    const fl = flows(g, HUMAN, this.island);
    const list = GOODS.filter((x) => { const f = fl[x.id]; return !!f && (f.stock >= 1 || f.prod > 0.001 || f.use > 0.001); });
    if (!list.length) return h + `<p class="stnote">Noch keine Waren im Lager.</p>`;
    h += `<table class="sttab tgoods"><thead><tr><th>Ware</th><th>Lager</th><th>+</th><th>−</th><th>Saldo</th><th>reicht</th></tr></thead><tbody>`;
    for (const x of list) {
      const f = fl[x.id] as Flow;
      const arrow = f.net > 0.05 ? '▲' : f.net < -0.05 ? '▼' : '＝';
      h += `<tr ${L.cls(f.net < -0.05 ? 'minus' : '')}><td>${x.icon} ${x.name}</td><td>${L.v(fmt(f.stock))}</td><td>${L.v(f1(f.prod))}</td><td>${L.v(f1(f.use))}</td>`
        + `<td ${L.cls(f.net > 0.05 ? 'pos' : f.net < -0.05 ? 'neg' : '')}>${L.v(`${arrow} ${f1(Math.abs(f.net))}`)}</td><td>${L.v(f.stock < 1 && f.net < -0.05 ? '<b class="neg">leer!</b>' : lasts(f.minutes))}</td></tr>`;
    }
    h += `</tbody></table><p class="stnote">+ hergestellt, − verbraucht (Tonnen je Minute). Rote Zeile: der Vorrat wird weniger – „reicht“ sagt, wie lange noch.</p>`;
    return h;
  }

  // ---------- Bevölkerung ----------

  private people(L: Live): string {
    const g = this.ui.g;
    let h = this.islandChips();
    const ps = popSummary(g, HUMAN, this.island);
    const total = ps.tiers.reduce((s, t) => s + t.residents, 0);
    const tr = trend(g, 'einwohner', HUMAN, this.island);
    const before = tr.length > 10 ? tr[tr.length - 11] : tr[0];
    h += `<div class="row"><span>👥 Einwohner</span><b>${L.v(fmt(total))}${before !== undefined ? ` <small>${L.v(`(vor ${Math.min(10, tr.length - 1)} Min: ${fmt(before)})`)}</small>` : ''}</b></div>`;
    ps.tiers.forEach((t, i) => {
      if (!t.houses) return;
      const m = t.happy >= 0.7 ? '😊' : t.happy >= 0.45 ? '😐' : '😠';
      h += `<div class="tcard"><div class="th"><b>${L.v(m)} ${TIERS[i].name}</b><span>${L.v(`${t.houses} Häuser · ${fmt(t.residents)} / ${fmt(t.max)} Bewohner · zufrieden ${Math.round(t.happy * 100)} %`)}</span></div>`;
      for (const x of t.missing.slice(0, 4)) {
        h += `<button class="jrow bad" data-miss="${i}|${esc(x.what)}" aria-label="Erstes Haus ohne ${esc(x.what)} zeigen"><span>❌ Es fehlt: ${esc(x.what)}<small>${L.v(`bei ${x.houses} von ${t.houses} Häusern`)}</small></span><i>📍</i></button>`;
      }
      if (!t.missing.length) h += `<p class="stnote ok">✅ Alles da, was sie brauchen.</p>`;
      if (t.ready) {
        h += `<button class="jrow upok" data-ready="${i}" aria-label="Aufstiegsbereites Haus zeigen"><span>⬆️ ${L.v(`${t.ready} ${t.ready === 1 ? 'Haus' : 'Häuser'}`)} bereit zum Aufstieg${i < TIERS.length - 1 ? ` zu ${TIERS[i + 1].name}` : ''}<small>${L.v(t.blocked.length ? 'wartet noch: ' + t.blocked.slice(0, 2).map((b) => `${esc(b.what)} (${b.houses})`).join(', ') : 'steigen gleich auf')}</small></span><i>📍</i></button>`;
      }
      h += `</div>`;
    });
    return h;
  }

  // ---------- Vergleich ----------

  private compare(L: Live): string {
    const g = this.ui.g;
    const rv = rivals(g);
    if (rv.length < 2) return `<p class="stnote">Noch keinen Gegner entdeckt. Erkunde mit dem Schiff die Inseln.</p>`;
    const col = (c: number) => '#' + c.toString(16).padStart(6, '0');
    const head = rv.map((r) => `<th><i class="dot" style="background:${col(r.color)}"></i>${r.you ? 'Du' : esc(r.name)}</th>`).join('');
    const best = (f: (r: typeof rv[number]) => number) => Math.max(...rv.map(f));
    const row = (lbl: string, f: (r: typeof rv[number]) => number, show: (r: typeof rv[number]) => string = (r) => fmt(f(r))) => {
      const top = best(f);
      return `<tr><td>${lbl}</td>${rv.map((r) => `<td ${L.cls(f(r) === top && top > 0 ? 'best' : '')}>${L.v(show(r))}</td>`).join('')}</tr>`;
    };
    let h = `<table class="sttab cmp"><thead><tr><th></th>${head}</tr></thead><tbody>`;
    h += row('👥 Einwohner', (r) => r.einwohner);
    h += row('🏠 Höchste Stufe', (r) => (r.einwohner ? r.stufe : -1), (r) => (r.einwohner ? TIERS[r.stufe].name : '–'));
    h += row('🏝️ Inseln', (r) => r.inseln);
    h += row('💰 Kasse', (r) => r.kasse);
    h += row('💎 Vermögen', (r) => r.vermoegen);
    h += row('⚔️ Soldaten', (r) => r.soldaten);
    h += row('⛵ Schiffe', (r) => r.schiffe);
    h += row('💪 Stärke', (r) => r.staerke);
    h += `<tr><td>🕊️ Lage</td>${rv.map((r) => `<td>${L.v(r.you ? '–' : r.krieg ? '<span class="neg">⚔️ Krieg</span>' : 'Frieden')}</td>`).join('')}</tr>`;
    h += `</tbody></table>`;
    const warn = g.players.filter((p) => !p.pirate && !p.trader && !p.natives && p.id !== HUMAN && p.warnAt !== undefined && rv.some((r) => r.id === p.id));
    for (const p of warn) h += `<p class="sthint neg">⚠️ ${esc(p.name)} rüstet zum Krieg – noch etwa ${Math.max(1, Math.ceil(((p.warnAt ?? 0) - g.time) / 60))} Min.</p>`;
    h += `<p class="stnote">Stärke = Kampfkraft der Soldaten und Schiffe. Fett = Bester. Vermögen = Kasse und Wert von Gebäuden, Schiffen und Waren.</p>`;
    h += `<button class="btn wide" id="stDipl">⚔️ Krieg & Frieden</button>`;
    return h;
  }
}

/** Balken je Spielminute (grün = Überschuss, rot = Minus), die neueste rechts */
function bars(vals: number[]): string {
  const W = 300, H = 64;
  // einzelne Ausreißer (z. B. ein großer Verkauf) sollen die übrigen Balken nicht flach drücken:
  // höchstens das Vierfache des üblichen Ausschlags, größere Balken stoßen oben bzw. unten an
  const abs = vals.map((v) => Math.abs(v)).sort((a, b) => a - b);
  const typical = abs[Math.floor(abs.length * 0.75)] ?? 0;
  const cap = Math.max(1, abs.length > 3 && typical > 0 ? Math.min(abs[abs.length - 1], typical * 4) : abs[abs.length - 1] ?? 1);
  const cl = (v: number) => Math.max(-cap, Math.min(cap, v));
  const pos = Math.max(0, ...vals.map(cl)), neg = Math.max(0, ...vals.map((v) => -cl(v)));
  const span = pos + neg || 1;
  const zero = (pos / span) * (H - 4) + 2;
  const bw = W / 30;
  let s = `<svg class="stbars" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Überschuss je Minute">`;
  s += `<line x1="0" x2="${W}" y1="${zero}" y2="${zero}" stroke="rgba(241,227,194,.35)" stroke-width="1"/>`;
  vals.forEach((v, i) => {
    const x = W - (vals.length - i) * bw + 1;
    const hgt = (Math.abs(cl(v)) / span) * (H - 4);
    s += `<rect x="${x.toFixed(1)}" y="${(v >= 0 ? zero - hgt : zero).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${Math.max(0.5, hgt).toFixed(1)}" fill="${v >= 0 ? '#7cc95a' : '#e2553f'}"/>`;
  });
  return s + '</svg>';
}

