// Infofenster für Gebäude (Betrieb, Haus, Werft, Burg), das Kontor (Reiter Lager, Handel, Bilanz, Ausbau) und Inseln.
// Der Rahmen des Fensters (▾ einklappen, ✕ schließen) gehört zum Kern in ui.ts.
// Das Fenster wird 4 × je Sekunde aufgefrischt: Zahlen und Balken werden nur ausgetauscht (ui/live.ts),
// komplett neu gebaut wird nur, wenn sich der Aufbau ändert (andere Zeilen oder Knöpfe).
// Andockstelle für Zusatzzeilen anderer Spielteile: addInfoLines (Ereignisse über events.infoLines, später Ureinwohner).
import './info.css';
import { BUILDINGS, BuildingId, GOOD, GOODS, GoodId, KONTOR_LEVELS, PRICES, SHIPS, ShipType, TIERS, UNITS, UnitType } from '../data';
import { atWar, canTrain, train } from '../combat';
import { Building, Game, HUMAN } from '../game';
import { PFLANZEN, Pflanze, depositText } from '../world';
import { infoLines as eventLines } from '../events';
import { flows, ledger } from '../stats';
import { sound } from '../audio';
import type { UI } from '../ui';
import { $, costText, fmt, soft } from './util';
import { Live, esc } from './live';
import { bindTax, cashHint, houseTaxHtml, taxSectionHtml } from './tax';

/** Reiter im Kontor: Lager (immer), Handel (sobald ui/trade.ts Inhalt hat), Bilanz, Ausbau */
type KontorTab = 'lager' | 'handel' | 'bilanz' | 'ausbau';

// ---------- Andockstelle: Zusatzzeilen anderer Spielteile ----------

/** liefert Zeilen (reiner Text) fürs Infofenster eines Gebäudes, z. B. „🔥 Brennt – Feuerwehr fehlt“ */
export type InfoLines = (g: Game, b: Building) => string[];
const EXTRA: InfoLines[] = [eventLines];
/** weiteren Lieferanten für Zusatzzeilen anmelden (z. B. Ureinwohner, Paket S4) */
export function addInfoLines(fn: InfoLines) { if (!EXTRA.includes(fn)) EXTRA.push(fn); }

/** (S3) Laufendes (Brand, Pest, Dürre) gehört gleich unter die Überschrift */
const URGENT = /^(🔥|💀|☀️)/u;

/** Zusatzzeilen einsetzen: Dringendes unter die Überschrift, alles andere (Schutz, Hinweise) unten anfügen */
function withExtra(h: string, L: Live, g: Game, b: Building): string {
  const lines: string[] = [];
  for (const fn of EXTRA) { try { lines.push(...fn(g, b)); } catch { /* ein fehlerhafter Spielteil darf das Fenster nicht stören */ } }
  const row = (l: string, warn: boolean) => `<p class="sub xline${warn ? ' neg' : ''}">${esc(l)}</p>`;
  const top = lines.filter((l) => URGENT.test(l)).map((l) => row(l, true)).join('');
  const rest = lines.filter((l) => !URGENT.test(l)).map((l) => row(l, l.startsWith('🚧'))).join('');
  // je ein wechselnder Block: neue oder verschwundene Zeilen bauen das Fenster nicht neu
  return h.replace('</h3>', `</h3><div class="xlines xtop">${L.v(top)}</div>`) + `<div class="xlines">${L.v(rest)}</div>`;
}

// ---------- „Wo?“: zum Hersteller springen oder die passende Baumenü-Kategorie öffnen ----------

const near = (g: Game, list: Building[], at: Building) => {
  const [x, y] = g.center(at);
  return list.slice().sort((a, b) => Math.hypot(g.center(a)[0] - x, g.center(a)[1] - y) - Math.hypot(g.center(b)[0] - x, g.center(b)[1] - y))[0];
};

/** Kategorie im Baumenü öffnen (bleibt offen, wenn sie es schon ist) */
function openCat(ui: UI, id: BuildingId) {
  const cat = BUILDINGS[id].category;
  if (cat && ui.build.openCat !== cat) ui.build.toggleCat(cat);
}

/** fehlende Ware: eigener Hersteller (auf der Insel zuerst) – sonst das Baumenü mit dem passenden Betrieb */
export function whereGood(ui: UI, at: Building, gd: GoodId) {
  const g = ui.g, gn = GOOD[gd].name;
  const makers = g.buildings.filter((o) => o.owner === HUMAN && BUILDINGS[o.type].prod?.output === gd);
  const here = makers.filter((o) => o.island === at.island);
  if (here.length) {
    // erst einen, der gerade nicht arbeitet – dort steht, woran es hakt
    const stuck = here.filter((o) => o.status !== 'ok');
    const pick = near(g, stuck.length ? stuck : here, at);
    ui.select(pick);
    ui.toast(stuck.length ? `${BUILDINGS[pick.type].icon} ${BUILDINGS[pick.type].name} liefert ${gn}, arbeitet aber gerade nicht – siehe Status.`
      : `${BUILDINGS[pick.type].icon} ${BUILDINGS[pick.type].name} liefert ${gn}. Reicht es nicht, baue mehr davon.`, 'info');
    return;
  }
  if (makers.length) {
    const m = makers[0];
    ui.select(m);
    ui.toast(`${gn} entsteht auf ${g.islands[m.island]?.name ?? 'einer anderen Insel'}. Bring es mit dem Schiff her oder baue auch hier einen Betrieb.`, 'info');
    return;
  }
  const defs = Object.values(BUILDINGS).filter((d) => d.category && !d.geplant && d.prod?.output === gd);
  const open = defs.find((d) => g.isUnlocked(d.id));
  if (open) {
    openCat(ui, open.id);
    const inp = Object.keys(open.prod?.input ?? {}).map((k) => GOOD[k as GoodId].name);
    ui.toast(`Für ${gn}: baue ${open.icon} ${open.name}${inp.length ? ` (braucht ${inp.join(' und ')})` : ''} und verbinde sie mit einem Weg.`, 'info');
    return;
  }
  const lock = defs.filter((d) => d.unlock).sort((a, b) => a.unlock!.tier - b.unlock!.tier || a.unlock!.n - b.unlock!.n)[0];
  const buy = PRICES[gd] ? ' Bis dahin kannst du es am Kontor kaufen.' : '';
  ui.toast(lock ? `${gn} kannst du ab ${lock.unlock!.n} ${TIERS[lock.unlock!.tier].dat} selbst herstellen (${lock.icon} ${lock.name}).${buy}` : `${gn} stellst du nicht selbst her.${buy}`, 'info');
}

/** fehlendes öffentliches Gebäude: das nächste vorhandene zeigen (zu weit weg) – sonst Baumenü öffnen */
export function whereService(ui: UI, at: Building, s: BuildingId) {
  const g = ui.g, d = BUILDINGS[s];
  if (!g.isUnlocked(s)) {
    ui.toast(d.unlock ? `${d.icon} ${d.name} gibt es ab ${d.unlock.n} ${TIERS[d.unlock.tier].dat} auf einer Insel.` : `${d.icon} ${d.name} gibt es noch nicht.`, 'info');
    return;
  }
  // die Kirche ersetzt die Kapelle, die Hochschule die Schule
  const types: BuildingId[] = s === 'kapelle' ? ['kapelle', 'kirche'] : s === 'schule' ? ['schule', 'hochschule'] : [s];
  const own = g.buildings.filter((o) => o.owner === HUMAN && o.island === at.island && types.includes(o.type));
  if (own.length) {
    const pick = near(g, own, at);
    ui.select(pick);
    ui.toast(`${BUILDINGS[pick.type].icon} ${BUILDINGS[pick.type].name} ist zu weit weg (Reichweite ${BUILDINGS[pick.type].radius ?? 0} Felder). Baue noch eins näher an den Häusern.`, 'info');
    return;
  }
  openCat(ui, s);
  ui.toast(`Baue ${d.icon} ${d.name} in der Nähe der Häuser (Reichweite ${d.radius ?? 0} Felder).`, 'info');
}

// ---------- Kontor: Kennzahlen der Insel ----------

/** Steuern und Unterhalt einer Insel je Minute (Militär zählt nur gesamt) */
function islandMoney(g: Game, island: number) {
  let tax = 0, betriebe = 0, dienste = 0, militaer = 0;
  for (const b of g.buildings) {
    if (b.owner !== HUMAN || b.island !== island) continue;
    if (b.type === 'haus') tax += g.houseTax(b);
    const up = g.upkeepOf(b), cat = BUILDINGS[b.type].category;
    if (cat === 'oeffentlich' || b.type === 'kontor') dienste += up; else if (cat === 'militaer') militaer += up; else betriebe += up;
  }
  return { tax, betriebe, dienste, militaer };
}

const sign = (n: number) => (n >= 0.5 ? '+' : n <= -0.5 ? '−' : '') + fmt(Math.abs(n) + 0.5);

export class InfoPanel {
  private tab: KontorTab = 'lager';
  /** Kontor, für das der Reiter gewählt wurde (anderes Kontor oder Tipp auf die Warenleiste = wieder Lager) */
  private tabFor = '';

  constructor(private ui: UI) {}

  /** Inhalt für ein Gebäude oder für Lager & Bilanz (storage) zeigen */
  render(b: Building | null, storage: boolean) {
    if (b && b.owner !== HUMAN) { this.foreign(b); return; }
    if (storage || (b && b.type === 'kontor')) { this.kontor(b); return; }
    if (b) this.building(b);
  }

  renderIsland(id: number) {
    this.ui.setInfo(this.islandHtml(id));
  }

  /**
   * Vorlage zeigen: gleicher Aufbau wie zuletzt → nur Zahlen und Balken austauschen (false);
   * anderer Aufbau → neu bauen (true: dann die Knöpfe neu verbinden)
   */
  private show(L: Live, tpl: string, foot = ''): boolean {
    const body = $('#infoBody') as HTMLElement & { _h?: string; _live?: string; _liveH?: string };
    const key = tpl + '\u0000' + foot;
    if (body._live === key && body._h !== undefined && body._h === body._liveH) { L.patch($('#info')); return false; }
    const fresh = this.ui.setInfo(L.html(tpl), L.html(foot));
    body._live = key;
    body._liveH = body._h;
    if (!fresh) L.patch($('#info'));
    return fresh;
  }

  /** Gebäude eines anderen Spielers */
  private foreign(b: Building) {
    const g = this.ui.g, pl = g.players[b.owner], L = new Live();
    let h = `<h3>${BUILDINGS[b.type].icon} ${BUILDINGS[b.type].name}</h3><p class="sub">Gehört ${esc(pl?.name ?? 'jemand anderem')}.</p>`;
    if (b.type === 'haus') h += `<div class="row"><span>Bewohner</span><b>${L.v(b.residents)}</b></div>`;
    const f = (b.hp ?? g.maxHp(b)) / g.maxHp(b);
    h += `<div class="row"><span>❤️ Zustand</span><b>${L.v(`${Math.round(f * 10) * 10} %`)}</b></div>${L.bar(f, f > 0.6 ? '#7cc95a' : f > 0.3 ? '#e8b93a' : '#e2553f')}`;
    h += `<p class="sub">${atWar(g, HUMAN, b.owner) ? '⚔️ Ihr seid im Krieg.' : '🕊️ Ihr habt Frieden.'} Wähle Soldaten oder ein Schiff mit Kanonen und tippe hierher, um anzugreifen.${b.type === 'kontor' || b.type === 'markt' ? ' Fällt es, während deine Soldaten daneben stehen, gehört es dir – mit dem Land ringsum.' : ''}</p>`;
    h = withExtra(h, L, g, b);
    this.show(L, h);
  }

  // ---------- Kontor ----------

  /** Kontor bzw. Lager & Bilanz der Insel im Blick: Reiter Lager / Handel / Bilanz / Ausbau */
  private kontor(b: Building | null) {
    const ui = this.ui, g = ui.g;
    // ohne angetipptes Kontor (Tipp auf die Warenleiste): das Kontor der Insel im Blick
    const k = b ?? g.kontor(HUMAN, g.focus) ?? null;
    const own = !!k && k.owner === HUMAN;
    const isl = k?.island ?? g.focus;
    const tabs: [KontorTab, string, string][] = [['lager', '📦', 'Lager']];
    if (own && ui.trade.ready) tabs.push(['handel', '⚖️', 'Handel']);
    if (own) tabs.push(['bilanz', '💰', 'Bilanz'], ['ausbau', '⬆️', 'Ausbau']);
    const tabKey = `${k?.id ?? -1}|${b ? 'kontor' : 'leiste'}`;
    if (tabKey !== this.tabFor) { this.tab = 'lager'; this.tabFor = tabKey; }
    if (!tabs.some(([id]) => id === this.tab)) this.tab = 'lager';
    const name = isl >= 0 ? g.islands[isl]?.name ?? '' : '';
    let h = `<h3>${k ? `⚓ Kontor${name ? ` · ${esc(name)}` : ''}` : '📦 Lager'}</h3>`;
    // Reiter nur, wenn es mehr als einen gibt
    if (tabs.length > 1) h += `<div class="tabs ktabs" role="tablist">${tabs.map(([id, ic, nm]) => `<button class="btn tab${id === this.tab ? ' active' : ''}" role="tab" aria-selected="${id === this.tab}" data-tab="${id}"><span>${ic}</span><small>${nm}</small></button>`).join('')}</div>`;
    if (this.tab === 'handel' && k) {
      // Andockstelle für ui/trade.ts (Paket U5): Inhalt und Knöpfe kommen von dort
      h += ui.trade.kontorHtml(k);
      if (ui.setInfo(h)) { this.bindTabs(); ui.trade.bindKontor($('#infoBody'), k); }
      return;
    }
    const L = new Live();
    let foot = '';
    if (this.tab === 'bilanz' && k) { const r = this.bilanzTab(L, k); h += r.body; foot = r.foot; }
    else if (this.tab === 'ausbau' && k) { const r = this.ausbauTab(L, k); h += r.body; foot = r.foot; }
    else h += this.lagerTab(L, k, isl);
    if (k) h = withExtra(h, L, g, k);
    if (!this.show(L, h, foot)) return;
    this.bindTabs();
    const box = $('#info');
    bindTax(box, g, () => ui.renderInfo());
    document.getElementById('kLock')?.addEventListener('click', () => {
      g.setMatLock(k!, !k!.matLock);
      ui.toast(k!.matLock ? 'Baumaterial gesperrt – Häuser steigen vorerst nicht auf.' : 'Baumaterial wieder frei für die Bewohner.', 'info');
      ui.renderInfo();
    });
    document.getElementById('kDel')?.addEventListener('click', () => {
      // die Spiellogik entscheidet, ob das Kontor weg darf (nur, wenn auf der Insel sonst nichts mehr steht)
      const c = g.canDemolishKontor(k!);
      if (!c.ok) { ui.toast(`⚓ ${c.reason ?? 'Das Kontor kann nicht weg.'}`, 'bad'); return; }
      ui.ask('⚓ Kontor abreißen?', 'Die Insel wird aufgegeben: Das Lager mit allen Waren verfällt, Land und Wege werden frei.', '💥 Abreißen', () => {
        const r = g.demolishKontor(k!);
        if (!r.ok) ui.toast(r.reason ?? '', 'bad');
        ui.select(null);
      });
    });
    document.getElementById('kUp')?.addEventListener('click', () => {
      const res = g.kontorUpgrade(k!);
      ui.toast(res.ok ? 'Kontor ausgebaut – mehr Lagerplatz!' : res.reason ?? '', res.ok ? 'good' : 'bad');
      ui.renderInfo();
    });
    document.getElementById('kStats')?.addEventListener('click', () => { if (ui.stats.ready) ui.stats.open('geld'); });
    $('#infoBody').querySelectorAll<HTMLElement>('[data-buy],[data-sell]').forEach((bt) => bt.addEventListener('click', () => {
      const gid = (bt.dataset.buy ?? bt.dataset.sell) as GoodId;
      const n = g.trade(HUMAN, k!.island, gid, bt.dataset.buy ? 5 : -5);
      if (n) sound.play('muenzen');
      if (!n) ui.toast(bt.dataset.buy ? 'Nicht genug Taler oder Lager voll' : 'Nichts zum Verkaufen da', 'bad');
      ui.renderInfo();
    }));
  }

  /** Reiter Lager: kompaktes Raster (rot = wird knapp, gelb = voll), Einwohner, Baumaterial-Schalter */
  private lagerTab(L: Live, k: Building | null, isl: number): string {
    const ui = this.ui, g = ui.g;
    const l = isl >= 0 ? g.lagerOf(HUMAN, isl) : null;
    if (!l) return `<p class="sub">Noch kein Kontor. Gründe eines vom Schiff aus an der Küste einer Insel.</p>`;
    const cap = g.capOf(HUMAN, isl);
    const fl = flows(g, HUMAN, isl);
    let here = 0;
    for (const b of g.buildings) if (b.owner === HUMAN && b.type === 'haus' && b.island === isl) here += b.residents;
    let h = `<p class="sub">${k ? `Kontor ${['I', 'II', 'III', 'IV'][k.level ?? 0]} · ` : ''}Lagerplatz ${L.v(cap)} t je Ware</p>`;
    h += `<div class="row"><span>👥 Einwohner hier / insgesamt</span><b>${L.v(`${fmt(here)} / ${fmt(g.population())}`)}</b></div>`;
    h += `<div class="grid lager">`;
    let red = false, yellow = false;
    for (const gd of GOODS) {
      const v = l[gd.id] ?? 0, f = fl[gd.id];
      if (!ui.relevant.has(gd.id) && v < 1 && !f) continue;
      const short = !!f && f.use > 0 && ((v < 1 && f.net <= 0) || (f.minutes !== null && f.minutes <= 3));
      const full = cap > 0 && v >= cap - 0.5;
      red ||= short; yellow ||= full;
      const tr = !f || Math.abs(f.net) < 0.05 ? '' : f.net > 0 ? '<i class="up">▲</i>' : '<i class="dn">▼</i>';
      // Zelle: Symbol und Menge groß, darunter der Name klein (passt auch ins schmale Fenster ungekürzt)
      h += `<div ${L.cls(`gcell${short ? ' short' : full ? ' warn' : ''}`)}><b>${gd.icon} ${L.v(`${fmt(v)}${tr}`)}</b><small>${gd.name}</small></div>`;
    }
    h += `</div><p class="sub legend">${L.v(red || yellow ? `${red ? '<span class="short">rot</span> = wird knapp' : ''}${red && yellow ? ' · ' : ''}${yellow ? '<span class="warn">gelb</span> = Lager voll' : ''}` : '▲ ▼ = mehr oder weniger werdend')}</p>`;
    // Baumaterial an Bewohner: erst wichtig, sobald es Häuser gibt (sie nehmen sich Material zum Aufstieg)
    if (k && k.owner === HUMAN && g.count('haus') > 0) {
      h += `<div class="switchrow"><span>🏠 Baumaterial an Bewohner<small>${k.matLock ? 'Gesperrt: Häuser steigen nicht auf, Holz, Werkzeug und Steine bleiben für Betriebe.' : 'Häuser nehmen sich Holz, Werkzeug und Steine zum Aufstieg.'}</small></span>
        <button class="btn ${k.matLock ? 'danger' : ''}" id="kLock" aria-pressed="${!!k.matLock}">${k.matLock ? '🔒 Gesperrt' : '✅ Frei'}</button></div>`;
    }
    // ohne Reiter „Handel“ (Händler noch nicht unterwegs): der einfache Sofort-Handel hier
    if (k && k.owner === HUMAN && !ui.trade.ready) {
      h += `<h4>Freier Händler</h4><p class="sub">Kaufen/verkaufen je 5 t (Preis je Tonne).</p>`;
      for (const gd of GOODS) {
        const pr = PRICES[gd.id];
        if (!pr || (!ui.relevant.has(gd.id) && (l[gd.id] ?? 0) < 1)) continue;
        h += `<div class="trade"><span>${gd.icon} ${gd.name}</span><button class="btn" data-buy="${gd.id}">+5 · ${pr.kaufen}</button><button class="btn" data-sell="${gd.id}">−5 · ${pr.verkaufen}</button></div>`;
      }
    }
    return h;
  }

  /** Reiter Bilanz: Einnahmen und Ausgaben je Minute (Insel und gesamt), Hinweis bei Minus, Steuerregler */
  private bilanzTab(L: Live, k: Building): { body: string; foot: string } {
    const g = this.ui.g;
    const inc = g.incomePerMinute();
    const all = { tax: 0, betriebe: 0, dienste: 0 };
    const islands = new Set<number>();
    for (const b of g.buildings) if (b.owner === HUMAN && b.type === 'kontor') islands.add(b.island);
    for (const i of islands) { const m = islandMoney(g, i); all.tax += m.tax; all.betriebe += m.betriebe; all.dienste += m.dienste; }
    const me = islandMoney(g, k.island);
    const two = islands.size > 1;
    // Handel: Mittel der letzten 5 Spielminuten aus dem Kassenbuch
    const rows = ledger(g).slice(-5);
    const handel = rows.length ? rows.reduce((s, r) => s + r.handelEin + r.handelAus, 0) / rows.length : 0;
    const line = (label: string, isl: number | null, total: number) =>
      `<div class="mrow${two ? '' : ' one'}"><span>${label}</span>${two ? `<b ${L.cls(isl === null ? 'dim' : isl >= 0 ? 'pos' : 'neg')}>${L.v(isl === null ? '–' : sign(isl))}</b>` : ''}<b ${L.cls(total >= 0 ? 'pos' : 'neg')}>${L.v(sign(total))}</b></div>`;
    let h = `<div class="mrow head${two ? '' : ' one'}"><span>Taler je Minute</span>${two ? '<small>Insel</small>' : ''}<small>${two ? 'Alle' : 'Gesamt'}</small></div>`;
    h += line('👥 Steuern', me.tax, inc.tax);
    h += line('⚒️ Betriebe', -me.betriebe, -all.betriebe);
    h += line('⛪ Öffentliche Gebäude', -me.dienste, -all.dienste);
    const mil = inc.upkeep - all.betriebe - all.dienste;
    if (mil > 0.5 || me.militaer > 0) h += line('⚔️ Militär', -me.militaer, -mil);
    if (rows.length) h += line('⚖️ Handel', null, handel);
    const net = inc.tax - inc.upkeep + handel;
    h += `<div class="mrow sum${two ? '' : ' one'}"><span>= Überschuss</span>${two ? `<b ${L.cls(me.tax - me.betriebe - me.dienste - me.militaer >= 0 ? 'pos' : 'neg')}>${L.v(sign(me.tax - me.betriebe - me.dienste - me.militaer))}</b>` : ''}<b ${L.cls(net >= 0 ? 'pos' : 'neg')}>${L.v(sign(net))}</b></div>`;
    h += `<p ${L.cls('sub neg cash')}>${L.v(cashHint(g))}</p>`;
    h += `<h4>💰 Steuern</h4>${taxSectionHtml(L, g, k.island) || '<p class="sub">Steuern zahlen die Bewohner deiner Wohnhäuser.</p>'}`;
    const foot = this.ui.stats.ready ? `<button class="btn" id="kStats">📊 Alle Zahlen<small>Bilanz, Waren, Bevölkerung</small></button>` : '';
    return { body: h, foot };
  }

  /** Reiter Ausbau: Stufe, Lagerplatz, nächste Stufe; unten Ausbauen und Abreißen */
  private ausbauTab(L: Live, k: Building): { body: string; foot: string } {
    const g = this.ui.g;
    const lv = k.level ?? 0;
    const nl = KONTOR_LEVELS[lv + 1];
    let h = `<div class="row"><span>Stufe</span><b>Kontor ${['I', 'II', 'III', 'IV'][lv]}</b></div>
      <div class="row"><span>Lagerplatz je Ware</span><b>${KONTOR_LEVELS[lv].storage} t</b></div>
      <div class="row"><span>Mit Marktplätzen</span><b>${L.v(`${g.capOf(HUMAN, k.island)} t`)}</b></div>
      <div class="row"><span>Unterhalt</span><b>${g.upkeepOf(k)} Taler/Min</b></div>`;
    let foot = '';
    if (nl) {
      const locked = nl.unlock && !g.reached(nl.unlock);
      h += `<h4>Nächste Stufe: Kontor ${['I', 'II', 'III', 'IV'][lv + 1]}</h4><p class="sub">Lagerplatz ${nl.storage} t je Ware · ${costText(nl.cost)}</p>`;
      if (locked) h += `<p class="sub">🔒 Ausbau ab ${nl.unlock!.n} ${TIERS[nl.unlock!.tier].dat}</p>`;
      else foot += `<button class="btn ok" id="kUp">⬆️ Ausbauen<small>Lager ${nl.storage} t</small></button>`;
    } else h += `<p class="sub">🏆 Größte Stufe erreicht. Mehr Platz bringen weitere Marktplätze.</p>`;
    h += `<p class="sub">Abreißen gibt die Insel auf. Das geht erst, wenn hier sonst nichts mehr von dir steht.</p>`;
    foot += `<button class="btn danger" id="kDel">💥 Kontor abreißen</button>`;
    return { body: h, foot };
  }

  private bindTabs() {
    $('#infoBody').querySelectorAll<HTMLElement>('[data-tab]').forEach((bt) => bt.addEventListener('click', () => {
      this.tab = bt.dataset.tab as KontorTab;
      this.ui.renderInfo();
    }));
  }

  // ---------- eigene Gebäude ----------

  /** eigenes Gebäude: Haus, Betrieb, Werft, Burg … */
  private building(b: Building) {
    const ui = this.ui, g = ui.g;
    const d = BUILDINGS[b.type];
    const L = new Live();
    let h = '';
    /** Knöpfe der festen Fußleiste */
    let foot = '';
    if (b.type === 'haus') h += this.houseHtml(L, b);
    else {
      h += `<h3>${d.icon} ${d.name}</h3><p class="sub">${d.desc}</p>`;
      if (d.prod) {
        const r = this.prodHtml(L, b);
        h += r.body; foot += r.foot;
      }
      if (d.work && d.prod) h += `<div class="row"><span>Arbeitsradius</span><b>${d.work} Felder</b></div>`;
      else if (d.radius) h += `<div class="row"><span>Reichweite</span><b>${d.radius} Felder</b></div>`;
      if (d.storage) h += `<div class="row"><span>Lager</span><b>+${d.storage} je Ware</b></div>`;
      if (d.tower) h += `<div class="row"><span>🎯 Schießt auf Feinde</span><b>${d.tower.range} Felder</b></div>`;
      if (d.trains) { const t = this.trainHtml(L, b); h += t.body; foot += t.foot; }
      if (b.type === 'werft' || b.type === 'grosswerft') {
        if (b.job) {
          const sd = SHIPS[b.job.ship];
          h += `<h4>Im Bau: ${sd.name}</h4>${L.bar(b.job.t / sd.time)}`;
        } else {
          // Bestellknöpfe unten in der Fußleiste, Einzelheiten der Schiffe hier im Inhalt
          h += `<h4>Schiff bauen</h4>`;
          let locked: typeof SHIPS[ShipType] | null = null;
          for (const [id, sd] of Object.entries(SHIPS) as [ShipType, typeof SHIPS[ShipType]][]) {
            if (sd.build === false) continue;
            if (sd.werft === 'grosswerft' && b.type !== 'grosswerft') continue;
            if (!g.reached(sd.unlock)) { locked ??= sd; continue; }
            const chk = g.canOrderShip(b, id);
            h += `<div class="row"><span>⛵ ${sd.name}</span></div><p class="sub">${sd.slots} Laderäume · Tempo ${Math.round(sd.speed * 100)} % · bis ${sd.kanonen} Kanonen${L.v(chk.ok ? '' : ` · <span class="neg">${chk.reason}</span>`)}</p>`;
            foot += `<button ${L.cls(`btn ${chk.ok ? 'ok' : ''}`)} data-ship="${id}" aria-label="${sd.name} bestellen">⛵ ${soft(sd.name)}<small>💰${sd.cost.taler} 🪵${sd.cost.holz} 🧵${sd.cost.stoff}</small></button>`;
          }
          if (locked) h += `<p class="sub">🔒 ${locked.name} ab ${locked.unlock.n} ${TIERS[locked.unlock.tier].dat}</p>`;
          if (foot) h += `<p class="sub">Tippe unten auf ein Schiff, um es zu bestellen.</p>`;
        }
      }
    }
    if (b.hp !== undefined) {
      const f = b.hp / g.maxHp(b);
      h += `<div class="row"><span>❤️ Zustand</span><b>${L.v(`${Math.round(f * 10) * 10} %`)}</b></div>${L.bar(f, f > 0.6 ? '#7cc95a' : f > 0.3 ? '#e8b93a' : '#e2553f')}`;
    }
    // Unterhalt: was es jetzt kostet, und was es in Ruhe kosten würde
    const idle = d.upkeepIdle !== undefined && d.upkeepIdle !== d.upkeep;
    if (d.upkeep > 0 || idle) h += `<div class="row"><span>Unterhalt jetzt${idle ? ` <small>(ruhend ${d.upkeepIdle})</small>` : ''}</span><b>${L.v(`${g.upkeepOf(b)}/Min`)}</b></div>`;
    h = withExtra(h, L, g, b);
    if (d.prod) foot += b.off ? `<button class="btn ok" id="infoOff">▶ Betreiben<small>Unterhalt dann ${d.upkeep}</small></button>` : `<button class="btn" id="infoOff">⏸ Ruhen lassen${idle ? `<small>Unterhalt nur ${d.upkeepIdle}</small>` : ''}</button>`;
    if (b.type !== 'kontor') foot += `<button class="btn danger" id="infoDel">💥 Abreißen</button>`;
    if (!this.show(L, h, foot)) return;
    // Knöpfe stehen im Inhalt oder in der Fußleiste: im ganzen Fenster suchen
    const box = $('#info');
    bindTax(box, g, () => ui.renderInfo());
    document.getElementById('infoOff')?.addEventListener('click', () => {
      g.setOff(b, !b.off);
      sound.play('klick');
      ui.toast(b.off ? `${d.name} ruht jetzt.` : `${d.name} arbeitet wieder.`, 'info');
      ui.renderInfo();
    });
    document.getElementById('infoRoad')?.addEventListener('click', () => this.roadFrom(b));
    box.querySelectorAll<HTMLElement>('[data-wgood]').forEach((bt) => bt.addEventListener('click', () => whereGood(ui, b, bt.dataset.wgood as GoodId)));
    box.querySelectorAll<HTMLElement>('[data-wsvc]').forEach((bt) => bt.addEventListener('click', () => whereService(ui, b, bt.dataset.wsvc as BuildingId)));
    box.querySelectorAll<HTMLElement>('[data-train]').forEach((bt) => bt.addEventListener('click', () => {
      const res = train(g, b, bt.dataset.train as UnitType);
      if (res.ok) sound.play('marsch'); else ui.toast(res.reason ?? '', 'bad');
      ui.renderInfo();
    }));
    box.querySelectorAll<HTMLElement>('[data-ship]').forEach((bt) => bt.addEventListener('click', () => {
      const res = g.orderShip(b, bt.dataset.ship as ShipType);
      ui.toast(res.ok ? 'Die Werft beginnt mit dem Bau.' : res.reason ?? '', res.ok ? 'good' : 'bad');
      ui.renderInfo();
    }));
    document.getElementById('infoDel')?.addEventListener('click', () => {
      ui.ask(`${d.icon} ${d.name} abreißen?`, 'Du bekommst die Hälfte des Baumaterials zurück.', '💥 Abreißen', () => {
        g.removeBuilding(b);
        ui.select(null);
      });
    });
  }

  /** „Weg bauen“: Wege-Werkzeug mit dem Betrieb als Start – der Spieler tippt nur noch das Ziel */
  private roadFrom(b: Building) {
    const ui = this.ui;
    ui.setMode({ kind: 'road', type: 'weg' });
    ui.build.roadStart = [b.x, b.y];
    ui.build.roadCells = [];
    ui.build.updateHint();
    ui.toast('🟫 Tippe aufs Ziel: einen Weg, das Kontor oder einen Marktplatz.', 'info');
  }

  /** Haus: Bewohner, Zufriedenheit mit Gesicht, Nahrung, Bedürfnisse mit „Wo?“, Aufstieg, Steuern */
  private houseHtml(L: Live, b: Building): string {
    const g = this.ui.g;
    const tier = TIERS[b.tier];
    const cov = g.coverage.get(b.id) ?? new Set();
    const face = b.happy >= 0.7 ? '😊' : b.happy >= 0.45 ? '😐' : '😠';
    const food = Math.max(0, Math.min(1, b.need.nahrung ?? 1));
    const hungry = g.hungry(b);
    let h = `<h3>🏠 Haus der ${tier.name}</h3>
      <div class="row"><span>Bewohner <b>${L.v(`${b.residents} / ${tier.maxResidents}`)}</b></span><span>${L.v(face)} Zufrieden <b>${L.v(`${Math.round(b.happy * 100)} %`)}</b></span></div>
      ${L.bar(b.happy, b.happy > 0.85 ? '#6c3' : b.happy > 0.45 ? '#eb3' : '#d43')}
      <div class="row"><span>🍖 Nahrung</span><b ${L.cls(hungry ? 'neg' : '')}>${L.v(hungry ? 'Hunger!' : `${Math.round(food * 100)} %`)}</b></div>
      ${L.bar(food, hungry ? '#e2553f' : food < 0.85 ? '#e8b93a' : '#7cc95a')}
      <h4>Bedürfnisse</h4><div class="chips">`;
    // kompakt in zwei Spalten (Waren aus dem Lager, Gebäude in der Nähe)
    const missG: GoodId[] = [], missS: BuildingId[] = [];
    for (const gId of Object.keys(tier.consumes) as GoodId[]) {
      const ok = (b.need[gId] ?? 1) > 0.6 && !b.short[gId];
      if (!ok) missG.push(gId);
      h += `<span title="${GOOD[gId].name}"><i>${GOOD[gId].icon} ${GOOD[gId].name}</i><b>${L.v(ok ? '✅' : '❌')}</b></span>`;
    }
    for (const s of tier.services) {
      const ok = cov.has(s);
      if (!ok) missS.push(s);
      h += `<span title="${BUILDINGS[s].name} in der Nähe"><i>${BUILDINGS[s].icon} ${BUILDINGS[s].name}</i><b>${L.v(ok ? '✅' : '❌')}</b></span>`;
    }
    h += '</div>';
    // was fehlt – mit „Wo?“: zum Hersteller springen oder das Baumenü öffnen
    for (const gId of missG) h += `<div class="lackrow"><span>❌ ${GOOD[gId].icon} ${GOOD[gId].name} fehlt</span><button class="btn" data-wgood="${gId}" aria-label="Wo gibt es ${GOOD[gId].name}?">📍 Wo?</button></div>`;
    for (const s of missS) h += `<div class="lackrow"><span>❌ ${BUILDINGS[s].icon} ${BUILDINGS[s].name} fehlt</span><button class="btn" data-wsvc="${s}" aria-label="Wo ist ${BUILDINGS[s].name}?">📍 Wo?</button></div>`;
    const warn: string[] = [];
    if (hungry) warn.push('🍖 Hunger! Ohne Nahrung ziehen die Bewohner aus.');
    if ((b.downT ?? 0) > 20 && b.tier > 0) warn.push(`🏚️ Das Haus verfällt bald zu ${TIERS[b.tier - 1].name}: ${g.houseLack(b)}.`);
    h += `<div class="warnlines">${L.v(warn.map((w) => `<p class="sub neg">${w}</p>`).join(''))}</div>`;
    if (b.tier < TIERS.length - 1) {
      const next = TIERS[b.tier + 1];
      const block = g.upgradeBlocker(b);
      // fehlende Gebäude/Waren stehen gleich darunter in eigenen Zeilen – nicht doppelt nennen
      const dup = !!block && (block.endsWith('in der Nähe fehlt') || block.endsWith('fehlt im Lager'));
      h += `<h4>⬆️ Aufstieg zu ${next.name}</h4><p class="sub">${L.v(dup ? '' : block ? '⏳ ' + block : '⬆️ Steigt gerade auf …')}</p>`;
      // Vorrat muss die Insel samt diesem Haus 2 Minuten versorgen
      for (const r of g.upgradeGoods(b)) {
        h += `<div class="row"><span>${r.group.map((x) => `${GOOD[x].icon} ${GOOD[x].name}`).join(' oder ')} im Lager ${L.v(r.ok ? '' : `<small>(${Math.floor(r.have)} von ${Math.ceil(r.need)} t)</small>`)}</span><b>${L.v(r.ok ? '✅' : '❌')}</b></div>`;
      }
      for (const sv of tier.next?.services ?? []) {
        const unl = g.isUnlocked(sv);
        h += `<div class="row"><span>${BUILDINGS[sv].icon} ${BUILDINGS[sv].name} in der Nähe${unl ? '' : ` <small>(ab ${BUILDINGS[sv].unlock!.n} ${TIERS[BUILDINGS[sv].unlock!.tier].dat})</small>`}</span><b>${L.v(cov.has(sv) ? '✅' : '❌')}</b></div>`;
      }
      h += `<p class="sub">Baumaterial: ${costText(next.upgradeCost)}</p>`;
    } else h += `<p class="sub">🏆 Höchste Stufe erreicht</p>`;
    h += `<h4>💰 Steuern</h4>` + houseTaxHtml(L, g, b);
    h += `<p class="sub">Dieses Haus zahlt ${L.v(fmt(g.houseTax(b) + 0.5))} Taler je Minute.</p>`;
    return h;
  }

  /** Betrieb: Status mit klaren Texten, Erzeugung, Ergiebigkeit, Lager; Knöpfe „Weg bauen“ / „Wo?“ */
  private prodHtml(L: Live, b: Building): { body: string; foot: string } {
    const g = this.ui.g, d = BUILDINGS[b.type], p = d.prod!;
    const out = GOOD[p.output];
    const l = g.lagerOf(HUMAN, b.island);
    const cap = g.capOf(HUMAN, b.island);
    const kontorFull = !!l && cap > 0 && (l[p.output] ?? 0) >= cap - 0.5;
    const missing = b.missing.map((m) => GOOD[m].name).join(' und ');
    const st: Record<string, string> = {
      ok: '✅ Arbeitet',
      keinWeg: '🚧 Kein Weg zum Kontor oder Marktplatz',
      lagerVoll: kontorFull ? `📦 Kontor-Lager voll (${out.name} ${cap}/${cap} t) – ausbauen, verschiffen oder verkaufen`
        : '📦 Voll – wartet auf den Marktkarren',
      keinWald: '🌲 Kein Wald in der Nähe', keinWasser: '🌊 Kein Wasser in der Nähe',
      erschoepft: d.deposit ? '⛏️ Das Vorkommen ist erschöpft' : ({ baum: '🌲 Keine erntereifen Bäume – Setzlinge wachsen nach', fisch: '🐟 Fischgründe leergefischt – erholen sich', wild: '🦌 Kein Wild mehr – kommt langsam zurück', weide: '🌿 Weide abgegrast – wächst nach', feld: '🌾 Felder erschöpft – wachsen nach' } as Record<string, string>)[d.harvest?.res ?? 'baum'],
      rohstoff: `⏳ Wartet auf Lieferung: ${missing || 'Rohstoffe'}`,
      zuWeit: '🚧 Zu weit vom Kontor oder Marktplatz – kein Marktkarren kommt hin (Kontor 8, Marktplatz 12 Felder)',
      aus: '⏸ Ruht – arbeitet nicht und kostet nur den Ruhe-Unterhalt',
    };
    const inp = Object.entries(p.input ?? {}).map(([k, n]) => `${n} ${GOOD[k as GoodId].icon}`).join(' + ');
    const bad = b.status !== 'ok';
    let h = `<div class="row status"><span>Status</span><b ${L.cls(b.status === 'aus' ? 'dim' : bad ? 'neg' : 'pos')}>${L.v(st[b.status] ?? '')}</b></div>
      <div class="row"><span>Produziert</span><b>${inp ? inp + ' → ' : ''}${p.amount ?? 1} ${out.icon} ${out.name} / ${L.v(Math.round(p.time / Math.max(0.05, b.eff)))} s</b></div>
      <div class="row"><span>${d.harvest ? 'Ergiebigkeit' : 'Standort'}</span><b>${L.v(`${Math.round(b.eff * 100)} %`)}</b></div>
      ${d.harvest ? L.bar(b.eff, b.eff < 0.4 ? '#e2553f' : b.eff < 0.75 ? '#e8b93a' : '#7cc95a') : ''}
      <div class="row"><span>Im Betrieb gelagert</span><b>${L.v(`${Math.floor(b.stock)} / ${d.stock ?? 4} t`)}</b></div>
      <div class="row"><span>Auslastung</span><b>${L.v(`${Math.round(b.active * 100)} %`)}</b></div>
      ${L.bar(b.progress / p.time)}`;
    let foot = '';
    // Hilfe gleich dort, wo es hakt
    if (b.status === 'keinWeg') foot += `<button class="btn ok" id="infoRoad">🟫 Weg bauen<small>Ziel antippen</small></button>`;
    if (b.status === 'rohstoff' && b.missing.length) foot += `<button class="btn" data-wgood="${b.missing[0]}">📍 Wo gibt es ${GOOD[b.missing[0]].name}?</button>`;
    return { body: h, foot };
  }

  /** Burg: Ausbildung (nur freigeschaltete Soldaten, dazu ein Hinweis auf den nächsten) */
  private trainHtml(L: Live, b: Building): { body: string; foot: string } {
    const g = this.ui.g, d = BUILDINGS[b.type].trains!;
    const l = g.lagerOf(HUMAN, b.island);
    let h = `<h4>Ausbildung (${L.v(b.train?.length ?? 0)} von ${d.slots})</h4>`, foot = '';
    for (const j of b.train ?? []) h += `<div class="row"><span>${UNITS[j.type].icon} ${UNITS[j.type].name}</span><b>${L.v(`${Math.ceil(j.t)} s`)}</b></div>${L.bar(1 - j.t / d.time)}`;
    const locked = (Object.values(UNITS)).filter((ud) => !g.reached(ud.unlock)).sort((a, c) => a.unlock.tier - c.unlock.tier || a.unlock.n - c.unlock.n)[0];
    for (const [id, ud] of Object.entries(UNITS) as [UnitType, typeof UNITS[UnitType]][]) {
      if (!g.reached(ud.unlock)) continue;
      const chk = canTrain(g, b, id);
      const cost = Object.entries(ud.cost).map(([k, n]) => `${GOOD[k as GoodId].icon}${n} (da: ${Math.floor(l?.[k as GoodId] ?? 0)})`).join(' ');
      // Knopf unten in der Fußleiste, Einzelheiten hier im Inhalt
      h += `<div class="row"><span>${ud.icon} ${ud.name}</span><b>${L.v(cost)}</b></div><p class="sub">❤️${ud.hp} · ${ud.range > 2 ? `Reichweite ${ud.range}` : 'Nahkampf'} · ${ud.upkeep} Taler/Min${L.v(chk.ok ? '' : ` · <span class="neg">${chk.reason}</span>`)}</p>`;
      foot += `<button ${L.cls(`btn ${chk.ok ? 'ok' : ''}`)} data-train="${id}" aria-label="${ud.name} ausbilden">${ud.icon} ${soft(ud.name)}<small>ausbilden ${Object.entries(ud.cost).map(([k, n]) => `${GOOD[k as GoodId].icon}${n}`).join(' ')}</small></button>`;
    }
    if (locked) h += `<p class="sub">🔒 ${locked.icon} ${locked.plural} ab ${locked.unlock.n} ${TIERS[locked.unlock.tier].dat}</p>`;
    if (foot) h += `<p class="sub">Tippe unten auf eine Truppe, um sie auszubilden.</p>`;
    const mine = g.units.filter((u) => u.owner === HUMAN).length;
    h += `<p class="sub">${L.v(mine ? `Du hast ${mine === 1 ? 'einen Soldaten' : `${mine} Soldaten`}. Tippe einen an, um ihn zu führen.` : '')}</p>`;
    return { body: h, foot };
  }

  /** Inselinfo: Größe, Klima, Besitzer, Fruchtbarkeit, Vorkommen im Berg */
  islandHtml(id: number): string {
    const g = this.ui.g, isl = g.islands[id];
    const fr = (Object.keys(PFLANZEN) as Pflanze[]).filter((p) => isl.frucht[p]).map((p) =>
      `<div class="row"><span>${PFLANZEN[p].icon} ${PFLANZEN[p].name}</span><b>${isl.frucht[p]} %</b></div>`).join('');
    const owner = g.kontor(HUMAN, id) ? 'Deine Insel' : g.buildings.some((b) => b.island === id && b.type === 'kontor') ? 'Besetzt' : 'Unbesiedelt';
    const gr = { klein: 'klein', mittel: 'mittelgroß', gross: 'groß' }[isl.groesse];
    return `<h3>🏝️ ${isl.name}</h3><p class="sub">${gr} · ${isl.klima === 'nord' ? 'Nördliches' : 'Südliches'} Klima · ${owner}</p>
      <h4>Fruchtbarkeit</h4>${fr || '<p class="sub">Keine Plantagenpflanzen</p>'}
      <p class="sub">Holz, Getreide, Schafe und Schweine gehen überall.</p>
      <h4>Im Berg</h4><div class="row"><span>⛰️ Vorkommen</span><b>${depositText(isl)}</b></div>`;
  }
}
