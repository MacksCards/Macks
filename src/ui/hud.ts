// Oberleiste (Geld mit Bilanz, Einwohner, Insel mit Spieluhr, Warenleiste, Knöpfe), linke Baumenü-Spalte,
// Aufgabenleiste (Haupt- und Nebenaufgabe, „Zeig mir“, Liste aller Aufgaben), Pause-Banner, Hilfen am Start
// (Pfeil zur nächsten unerkundeten Insel, pulsierende Ringe) sowie unten rechts Weltkarte, + / −, Kompass
// und die Minikarte (ui/minimap.ts).
import './hud.css';
import { BUILDINGS, CATEGORIES, Category, GOOD, GOODS, GoodId, TIERS, UNITS } from '../data';
import { HUMAN, QUESTS, type Game, type Ship } from '../game';
import { ZOOM_STEP } from '../input';
import { flows, trend } from '../stats';
import { QUEST_INFO, currentSide, isSide, questLock, rewardOf, sideList } from '../ueberblick';
import type { UI } from '../ui';
import { clock } from './log';
import { Minimap } from './minimap';
import { $, el, fmt } from './util';
import * as THREE from 'three';

/** so lange drücken (ms), bis der Kompass zum Kontor springt */
const LONG_MS = 550;
/** kurze Beschriftung für die zweispaltige Baumenü-Leiste (nur wo der volle Name nicht passt) */
const CAT_SHORT: Partial<Record<Category, string>> = { werkstatt: 'Werkstatt' };
/** diese Waren stehen immer in der Leiste (Steine erst, wenn sie gebraucht werden) */
const ALWAYS: GoodId[] = ['holz', 'werkzeug', 'stein', 'nahrung'];
/** knapp: reicht nur noch so viele Minuten */
const SCARCE_MIN = 2;
/** so lange pulsiert der Knopf nach „Zeig mir“ (ms) */
const SHOW_MS = 9000;
/** Knöpfe im Schiffsfenster, auf die eine Aufgabe zeigt */
const SHIP_BTN = { kontor: '#shipKontor', ausladen: '#shipUnload', bewaffnen: '#shipArm' } as const;

/** Zahl mit Komma und einer Nachkommastelle (2,1) */
const dez = (n: number) => (Math.round(n * 10) / 10).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export class Hud {
  private goodEls = new Map<GoodId, HTMLElement>();
  private yawShown = NaN;
  readonly minimap: Minimap;
  private game: Game | null = null;
  /** zuletzt geschriebene Inhalte (nur bei Änderung neu schreiben) */
  private questHtml = '';
  private clockTxt = '';
  /** „Zeig mir“: Wähler der pulsierenden Knöpfe und bis wann */
  private showSel: string[] = [];
  private showUntil = 0;
  private pulseCss = '';
  /** Start: Ziel des Pfeils (unerkundete Insel) und Schiff mit Ring */
  private arrowTo: [number, number] | null = null;
  private ringShip: Ship | null = null;
  private loopOn = false;
  private exploreT = 0;
  private tipTimer = 0;
  private pv = new THREE.Vector3();

  constructor(private ui: UI) {
    this.minimap = new Minimap(ui);
  }

  /** Oberleiste und linke Baumenü-Spalte anlegen */
  build(hud: HTMLElement) {
    const ui = this.ui;
    const top = el('div', 'top');
    top.innerHTML = `
      <button class="stat money" id="money" aria-label="Taler"><span class="ic">💰</span><span class="v"><b>0</b><small id="bal"></small></span></button>
      <button class="stat" id="pop" aria-label="Einwohner"><span class="ic">👥</span><b>0</b></button>
      <button class="stat island" id="islandName" aria-label="Flotte und Inseln"><span class="nm"></span><small class="clk" id="clock" title="Spielzeit"></small></button>
      <div class="goods" id="goods"></div>
      <button class="good all" id="allGoods" aria-label="Alle Waren im Lager"><span>📦</span><b>Alle</b></button>
      <div class="ctrl">
        <button id="demBtn" class="btn sq hidden" aria-label="Abreißen">💥</button>
        <button id="pause" class="btn sq" aria-label="Pause">⏸</button>
        <button id="speed" class="btn sq" aria-label="Tempo">1x</button>
        <button id="menuBtn" class="btn sq" aria-label="Menü">☰</button>
      </div>`;
    hud.appendChild(top);
    const goods = top.querySelector<HTMLElement>('#goods')!;
    for (const gd of GOODS) {
      const c = el('button', 'good hidden', `<span>${gd.icon}</span><b>0</b><i class="tr"></i>`);
      c.title = gd.name;
      c.setAttribute('aria-label', gd.name);
      c.addEventListener('click', () => this.goodTip(gd.id, c));
      goods.appendChild(c);
      this.goodEls.set(gd.id, c);
    }
    $('#allGoods').addEventListener('click', () => ui.openStorage());
    // Verlauf am Rand zeigt, dass man weiterwischen kann
    goods.addEventListener('scroll', () => { this.fadeGoods(); this.hideTip(); }, { passive: true });
    $('#pause').addEventListener('click', () => ui.togglePause());
    // Tempo: in der Pause geht es mit dem zuletzt gewählten Tempo weiter, sonst 1x → 2x → 4x
    $('#speed').addEventListener('click', () => {
      if (ui.paused) ui.togglePause();
      else ui.speed = ui.speed === 1 ? 2 : ui.speed === 2 ? 4 : 1;
      this.updateSpeedBtn();
    });
    $('#menuBtn').addEventListener('click', () => ui.openMenu());
    // Abreißen: fester Knopf in der Oberleiste (scrollt nie weg)
    $('#demBtn').addEventListener('click', () => {
      ui.build.closeCat();
      ui.setMode(ui.mode.kind === 'demolish' ? { kind: 'none' } : { kind: 'demolish' });
    });
    // Geld und Einwohner: Statistik, sobald es sie gibt – bis dahin Lager & Bilanz
    $('#money').addEventListener('click', () => { if (ui.stats.ready) ui.stats.open('geld'); else ui.openStorage(); });
    $('#pop').addEventListener('click', () => { if (ui.stats.ready) ui.stats.open('einwohner'); else ui.openStorage(); });
    $('#islandName').addEventListener('click', () => { if (ui.fleet.ready) ui.fleet.open('inseln'); });
    // Tipp irgendwo anders schließt die Waren-Sprechblase
    document.addEventListener('pointerdown', (e) => { if (!(e.target as HTMLElement).closest?.('.goods')) this.hideTip(); }, true);

    // Linke Baumenü-Spalte
    const left = el('div', 'left');
    for (const c of CATEGORIES) {
      // anfangs versteckt (update() zeigt nur Kategorien mit freigeschalteten Gebäuden);
      // zweispaltig ist weniger Platz: dann die kurze Beschriftung (z. B. „Werkstatt“ statt „Werkstätten“)
      const short = CAT_SHORT[c.id];
      const b = el('button', 'btn cat hidden', `<span>${c.icon}</span><small class="${short ? 'long' : ''}">${c.name}</small>${short ? `<small class="short">${short}</small>` : ''}`);
      b.dataset.cat = c.id;
      b.setAttribute('aria-label', c.name);
      b.addEventListener('click', () => ui.build.toggleCat(c.id));
      left.appendChild(b);
    }
    hud.appendChild(left);
  }

  /** Aufgabe unten in der Mitte, Kartenknöpfe und Minikarte unten rechts, Pause-Banner, Start-Hilfen */
  buildBottom(hud: HTMLElement) {
    const ui = this.ui;
    // Aufgabenleiste: Tipp öffnet die Liste aller Aufgaben, „Zeig mir“ führt hin
    const quest = el('div', 'quest', `<button class="qmain" id="questMain" aria-label="Alle Aufgaben"></button><button class="btn qshow" id="questShow" aria-label="Zeig mir, wo">👉<span class="qst"> Zeig mir</span></button>`);
    quest.id = 'quest';
    hud.appendChild(quest);
    $('#questMain').addEventListener('click', () => this.openQuests());
    $('#questShow').addEventListener('click', () => { const i = this.ui.g.quest; if (QUESTS[i]) this.showMe(i); });
    // Überblick-Ecke unten rechts: Meldungen und Flotte, Weltkarte und Kompass, Zoom – darunter die Minikarte
    const nav = el('div', 'nav', `
      <button id="logBtn" class="btn sq hidden" aria-label="Meldungen">🔔<i class="badge hidden" id="logBadge"></i></button>
      <button id="fleetBtn" class="btn sq hidden" aria-label="Flotte und Inseln">⛵</button>
      <button class="btn sq" id="mapBtn" aria-label="Weltkarte">🗺️</button>
      <button class="btn sq compass" id="compass" aria-label="Kompass – antippen: Norden nach oben, lang drücken: zum Kontor"><span>🧭</span><b id="north">N</b></button>
      <button class="btn sq" id="zoomIn" aria-label="Näher heran">+</button>
      <button class="btn sq" id="zoomOut" aria-label="Weiter weg">−</button>`);
    nav.id = 'nav';
    hud.appendChild(nav);
    this.minimap.mount(hud);
    $('#logBtn').addEventListener('click', () => { if (ui.log.ready) ui.log.open(); });
    $('#fleetBtn').addEventListener('click', () => { if (ui.fleet.ready) ui.fleet.open('schiffe'); });
    $('#mapBtn').addEventListener('click', () => ui.openMap());
    $('#zoomIn').addEventListener('click', () => ui.input.zoomStep(ZOOM_STEP));
    $('#zoomOut').addEventListener('click', () => ui.input.zoomStep(1 / ZOOM_STEP));
    // Kompass: Antippen = Norden nach oben, lang drücken = zum Kontor
    const cmp = $('#compass');
    let timer = 0, long = false;
    const clear = () => { if (timer) { clearTimeout(timer); timer = 0; } };
    cmp.addEventListener('pointerdown', () => {
      long = false;
      clear();
      timer = window.setTimeout(() => { timer = 0; long = true; this.toHome(); }, LONG_MS);
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) cmp.addEventListener(ev, clear);
    cmp.addEventListener('click', () => { if (long) { long = false; return; } ui.input.north(); });
    // großes Banner in der Pause (lässt Tippen und Wischen zur Karte durch)
    const pb = el('div', 'pbanner', '⏸ PAUSE<small>▶️ oben rechts geht es weiter</small>');
    pb.id = 'pauseBanner';
    pb.setAttribute('aria-hidden', 'true');
    hud.appendChild(pb);
    // Start-Hilfen: Pfeil zur nächsten unerkundeten Insel, Ring um das Schiff, Sprechblase der Warenleiste
    const arrow = el('button', 'xarrow hidden', '<span class="ar">➤</span><small>Unerkundet</small>');
    arrow.id = 'exploreArrow';
    arrow.setAttribute('aria-label', 'Unerkundete Insel – antippen, um hinzuschauen');
    arrow.addEventListener('click', () => { if (this.arrowTo) ui.input.flyTo({ tx: this.arrowTo[0], tz: this.arrowTo[1] }, 700); });
    hud.appendChild(arrow);
    const ring = el('div', 'shipring hidden', '');
    ring.id = 'shipRing';
    hud.appendChild(ring);
    const tip = el('div', 'goodtip hidden', '');
    tip.id = 'goodTip';
    hud.appendChild(tip);
    const st = document.createElement('style');
    st.id = 'pulseCss';
    document.head.appendChild(st);
  }

  /** N am Kompassrand dorthin drehen, wo auf dem Bildschirm Norden liegt
   *  (nach jeder Kamerabewegung durch Finger oder Kamerafahrt und bei jeder Auffrischung der Leiste);
   *  dabei folgt das Sichtfeld-Viereck der Minikarte */
  needle() {
    this.minimap.rect();
    const yaw = this.ui.view.rig.yaw;
    if (yaw === this.yawShown) return;
    this.yawShown = yaw;
    const n = document.getElementById('north');
    if (n) n.style.transform = `rotate(${yaw}rad) translateY(-15px) rotate(${-yaw}rad)`;
  }

  /** Kamera sanft zum Kontor (der Insel im Blick, sonst dem nächsten; liegt man schon dort: zum nächsten Kontor).
   *  Ohne Kontor: zum eigenen Schiff. */
  private toHome() {
    const ui = this.ui, g = ui.g, r = ui.view.rig;
    const ks = g.buildings.filter((b) => b.type === 'kontor' && b.owner === HUMAN).sort((a, b) => a.island - b.island);
    let to: [number, number] | null = null;
    if (ks.length) {
      const d = (i: number) => { const [cx, cy] = g.center(ks[i]); return Math.hypot(cx - r.tx, cy - r.tz); };
      let near = 0;
      for (let i = 1; i < ks.length; i++) if (d(i) < d(near)) near = i;
      const focus = ks.findIndex((k) => k.island === g.focus);
      const pick = d(near) < 3 ? (near + 1) % ks.length : focus >= 0 ? focus : near;
      to = g.center(ks[pick]);
    } else {
      const s = g.myShips()[0];
      if (s) to = [s.x, s.y];
    }
    if (to) ui.input.flyTo({ tx: to[0], tz: to[1] }, 600);
  }

  /** Verlauf links/rechts an der Warenleiste, wenn dort noch Waren sind */
  private fadeGoods() {
    const gd = document.getElementById('goods');
    if (!gd) return;
    gd.classList.toggle('fade-l', gd.scrollLeft > 2);
    gd.classList.toggle('fade-r', gd.scrollLeft + gd.clientWidth < gd.scrollWidth - 2);
  }

  // ---------- Warenleiste ----------

  /** Sprechblase unter einer Ware: Name, Menge von Limit, Fluss je Minute */
  private goodTip(id: GoodId, chip: HTMLElement) {
    const tip = $('#goodTip');
    if (!tip.classList.contains('hidden') && tip.dataset.good === id) { this.hideTip(); return; }
    const g = this.ui.g, gd = GOOD[id];
    const f = g.focus >= 0 ? flows(g, HUMAN, g.focus)[id] : undefined;
    const v = Math.floor(g.goods[id]), cap = g.capacity;
    let t = `${gd.icon} <b>${gd.name}</b> ${v}/${cap}`;
    if (f && (f.prod > 0 || f.use > 0)) t += Math.abs(f.net) < 0.05 ? ' · ±0/min' : ` · ${f.net >= 0 ? '+' : '−'}${dez(Math.abs(f.net))}/min`;
    if (f?.minutes !== null && f?.minutes !== undefined) t += ` · reicht ${f.minutes < 1 ? 'unter 1' : Math.floor(f.minutes)} min`;
    else if (v >= cap - 0.5 && cap > 0) t += ' · Lager voll';
    tip.innerHTML = t;
    tip.dataset.good = id;
    tip.classList.remove('hidden');
    const rc = chip.getBoundingClientRect();
    const w = tip.offsetWidth;
    tip.style.left = `${Math.max(6, Math.min(window.innerWidth - w - 6, rc.left + rc.width / 2 - w / 2))}px`;
    tip.style.top = `${rc.bottom + 6}px`;
    clearTimeout(this.tipTimer);
    this.tipTimer = window.setTimeout(() => this.hideTip(), 4000);
  }

  private hideTip() {
    const tip = document.getElementById('goodTip');
    if (tip && !tip.classList.contains('hidden')) tip.classList.add('hidden');
  }

  /** Trendpfeil aus dem Verlauf (S1): Bestand jetzt gegenüber vor etwa 3 Spielminuten */
  private trendOf(id: GoodId, v: number, cap: number, focus: number): '' | 'up' | 'down' {
    const t = trend(this.ui.g, id, HUMAN, focus);
    if (t.length < 2) return '';
    const before = t[Math.max(0, t.length - 3)];
    const lim = Math.max(2, cap * 0.05);
    return v - before > lim ? 'up' : before - v > lim ? 'down' : '';
  }

  private updateGoods(focus: number) {
    const ui = this.ui, g = ui.g, relevant = ui.relevant;
    const fl = focus >= 0 ? flows(g, HUMAN, focus) : {};
    const cap = g.capacity;
    for (const [id, e] of this.goodEls) {
      const v = g.goods[id];
      const f = fl[id];
      const scarce = !!f && f.minutes !== null && f.minutes < SCARCE_MIN && f.use > 0;
      const full = cap > 0 && v >= cap - 0.5;
      const base = ALWAYS.includes(id) && (id !== 'stein' || relevant.has('stein') || v >= 1);
      const show = focus >= 0 && (base || scarce || full);
      e.classList.toggle('hidden', !show);
      if (!show) continue;
      const b = e.querySelector('b')!, txt = String(Math.floor(v));
      if (b.textContent !== txt) b.textContent = txt;
      e.classList.toggle('full', full);
      e.classList.toggle('empty', v < 1);
      e.classList.toggle('scarce', scarce);
      // knappe Waren zuerst, dann die festen, dann volle
      e.style.order = scarce ? '0' : base ? '1' : '2';
      const tr = this.trendOf(id, v, cap, focus);
      const ti = e.querySelector<HTMLElement>('.tr')!;
      if (ti.dataset.t !== tr) { ti.dataset.t = tr; ti.textContent = tr === 'up' ? '▲' : tr === 'down' ? '▼' : ''; }
      e.setAttribute('aria-label', `${GOOD[id].name} ${Math.floor(v)} von ${cap}${scarce ? ', knapp' : full ? ', Lager voll' : ''}`);
    }
    $('#allGoods').classList.toggle('hidden', focus < 0);
  }

  /** Zahlen, Insel, Warenleiste, Baumenü-Spalte, Minikarte und Hilfen auffrischen (4 × je Sekunde) */
  update() {
    const ui = this.ui, g = ui.g;
    if (g !== this.game) { this.game = g; this.minimap.reset(); this.questHtml = ''; this.showUntil = 0; }
    const inc = g.incomePerMinute();
    const bal = inc.tax - inc.upkeep;
    $('#money').querySelector('b')!.textContent = fmt(g.money);
    const balEl = $('#bal');
    balEl.textContent = `${bal >= 0 ? '+' : '−'}${fmt(Math.abs(bal))}/min`;
    balEl.className = bal >= 0 ? 'pos' : 'neg';
    $('#money').classList.toggle('neg', g.money < 0);
    $('#pop').querySelector('b')!.textContent = fmt(g.population());
    // Fokus: ausgewähltes Gebäude, sonst eigene Insel unter der Kameramitte, sonst erstes Kontor
    const r = ui.view.rig;
    const under = g.islandOf[g.idx(Math.min(g.size - 1, Math.max(0, Math.floor(r.tx))), Math.min(g.size - 1, Math.max(0, Math.floor(r.tz))))];
    let focus = ui.selected ? ui.selected.island : -1;
    if (focus < 0 && under >= 0 && g.kontor(HUMAN, under)) focus = under;
    if (focus < 0) {
      const own = g.buildings.filter((b) => b.type === 'kontor' && b.owner === HUMAN);
      own.sort((a, b) => Math.hypot(g.center(a)[0] - r.tx, g.center(a)[1] - r.tz) - Math.hypot(g.center(b)[0] - r.tx, g.center(b)[1] - r.tz));
      focus = own[0]?.island ?? -1;
    }
    g.focus = focus;
    const isl = $('#islandName');
    const nm = focus >= 0 ? `📍 ${g.islands[focus].name}` : '⛵ Kein Kontor';
    const nmEl = isl.querySelector<HTMLElement>('.nm')!;
    if (nmEl.textContent !== nm) nmEl.textContent = nm;
    // Spieluhr (Stunden:Minuten)
    const ck = `🕐 ${clock(g.time)}`;
    if (ck !== this.clockTxt) {
      this.clockTxt = ck;
      $('#clock').textContent = ck;
      isl.setAttribute('aria-label', `${nm.replace('📍 ', '')}, Spielzeit ${clock(g.time)} – Flotte und Inseln`);
    }
    isl.classList.toggle('tap', ui.fleet.ready);
    // Waren, die gerade eine Rolle spielen (für Lager und Infofenster): es gibt sie, oder ein freigeschaltetes
    // Gebäude stellt sie her oder braucht sie
    const relevant = ui.relevant;
    relevant.clear();
    for (const k of ['holz', 'werkzeug', 'nahrung'] as GoodId[]) relevant.add(k);
    // Waffen, sobald man Soldaten ausbilden kann
    if (g.isUnlocked('burg')) for (const [, ud] of Object.entries(UNITS)) if (g.reached(ud.unlock)) for (const k of Object.keys(ud.cost)) relevant.add(k as GoodId);
    // Baustoffe freigeschalteter Gebäude (z. B. Kanonen für Wachtürme) und Kanonen für Schiffe, sobald es eine Werft gibt
    for (const d of Object.values(BUILDINGS)) if (d.category && g.isUnlocked(d.id)) for (const k of Object.keys(d.cost)) if (k !== 'taler') relevant.add(k as GoodId);
    if (g.isUnlocked('werft')) relevant.add('kanonen');
    for (const d of Object.values(BUILDINGS)) {
      if (!d.prod || !g.isUnlocked(d.id) || !d.category) continue;
      relevant.add(d.prod.output);
      for (const k of Object.keys(d.prod.input ?? {})) relevant.add(k as GoodId);
    }
    // dazu alles, was die eigenen Bewohner verbrauchen oder zum Aufstieg brauchen
    const hb = g.housesByTier();
    hb.forEach((n, t) => {
      if (!n) return;
      for (const k of Object.keys(TIERS[t].consumes)) relevant.add(k as GoodId);
      for (const grp of TIERS[t].next?.goods ?? []) for (const k of grp) relevant.add(k);
    });
    // Warenleiste: immer Holz, Werkzeug, Steine, Nahrung – dazu alles, was knapp oder voll ist
    this.updateGoods(focus);
    // Baumenü: nur Kategorien mit freigeschalteten Gebäuden; vor dem ersten Kontor nichts
    const hasKontor = g.count('kontor') > 0;
    let shown = 0;
    document.querySelectorAll<HTMLElement>('#hud .cat').forEach((bt) => {
      const c = bt.dataset.cat;
      const show = hasKontor && Object.values(BUILDINGS).some((d) => d.category === c && g.isUnlocked(d.id));
      bt.classList.toggle('hidden', !show);
      if (show) shown++;
    });
    $('#demBtn').classList.toggle('hidden', !hasKontor);
    // wenn eine Spalte nicht in die Höhe passt: zweispaltig (Symbol mit kurzer Beschriftung)
    const left = document.querySelector<HTMLElement>('#hud .left');
    if (left) {
      const two = shown * 48 - 4 > left.clientHeight;
      left.classList.toggle('two', two);
      document.body.classList.toggle('cols2', two);
    }
    // Glocke mit Zahl der ungelesenen Meldungen, Flotte & Inseln
    $('#logBtn').classList.toggle('hidden', !ui.log.ready);
    const unread = ui.log.ready ? ui.log.unread : 0;
    const badge = $('#logBadge');
    badge.classList.toggle('hidden', unread <= 0);
    const bt = unread > 99 ? '99+' : String(unread);
    if (badge.textContent !== bt) badge.textContent = bt;
    $('#logBtn').setAttribute('aria-label', unread ? `Meldungen, ${unread} neu` : 'Meldungen');
    $('#fleetBtn').classList.toggle('hidden', !ui.fleet.ready);
    this.fadeGoods();
    this.needle();
    this.minimap.update();
    this.updateHelp(hasKontor);
    this.updatePulse();
  }

  // ---------- Aufgaben ----------

  /** Aufgabenleiste: Hauptaufgabe und eine Nebenaufgabe – nur bei Änderung neu schreiben */
  updateQuest() {
    const g = this.ui.g;
    const q = QUESTS[g.quest];
    const side = currentSide(g);
    let h = q
      ? `<span class="ql">📜 <b>${q.title}</b> <span class="prog">${q.progress(g)}</span></span>`
      : `<span class="ql">📜 <b>Alle Hauptaufgaben erledigt!</b></span>`;
    if (side) h += `<span class="ql side">➕ ${side.title} <span class="prog">${QUESTS[side.i].progress(g)}</span></span>`;
    if (h === this.questHtml) return;
    this.questHtml = h;
    $('#questMain').innerHTML = h;
    $('#questShow').classList.toggle('hidden', !q);
  }

  /** Liste aller Aufgaben: erledigt, aktuell (mit Tipp und „Zeig mir“), gesperrt (ab …), Nebenaufgaben */
  openQuests() {
    const ui = this.ui, g = ui.g;
    const row = (i: number, state: 'done' | 'now' | 'lock' | 'later' | 'open') => {
      const q = QUESTS[i];
      const lock = questLock(g, i);
      const icon = { done: '✅', now: '▶️', lock: '🔒', later: '⏳', open: '➕' }[state];
      const note = state === 'done' ? `+${fmt(rewardOf(g, i))} Taler` : state === 'lock' ? lock ?? '' : state === 'later' ? 'kommt danach' : `${q.progress(g)} · +${fmt(rewardOf(g, i))} Taler`;
      return `<li class="qrow s-${state}"><span class="qi">${icon}</span><div class="qt"><b>${q.title}</b><small>${note}</small>${state === 'now' || state === 'open' ? `<p>${q.hint}</p>` : ''}</div>${state === 'now' || state === 'open' ? `<button class="btn qgo" data-i="${i}">👉 Zeig mir</button>` : ''}</li>`;
    };
    let h = '<h4>Hauptaufgaben</h4><ul class="qrows">';
    QUESTS.forEach((_, i) => {
      if (isSide(i)) return;
      h += row(i, i < g.quest ? 'done' : i === g.quest ? 'now' : questLock(g, i) ? 'lock' : 'later');
    });
    h += '</ul><h4>Nebenaufgaben</h4><p class="sub">Laufen neben der Hauptaufgabe, sobald ihre Gebäude frei sind.</p><ul class="qrows">';
    for (const s of sideList(g)) h += row(s.i, s.done ? 'done' : s.open ? 'open' : 'lock');
    h += '</ul>';
    ui.dialog({ title: '📜 Aufgaben', cls: 'quests', body: h, foot: `<button class="btn wide ok" id="questX">▶️ Weiterspielen</button>` });
    $('#questX').addEventListener('click', () => ui.closeModal());
    document.querySelectorAll<HTMLElement>('#modal .qgo').forEach((b) => b.addEventListener('click', () => { ui.closeModal(); this.showMe(Number(b.dataset.i)); }));
    // aktuelle Aufgabe in den Blick
    document.querySelector('#modal .qrow.s-now')?.scrollIntoView({ block: 'center' });
  }

  /** „Zeig mir“: Kamera zum passenden Ort, der passende Knopf pulsiert */
  showMe(i: number) {
    const ui = this.ui, g = ui.g, q = QUESTS[i];
    const info = q ? QUEST_INFO[q.title] : undefined;
    if (!q || !info) return;
    const sel: string[] = [];
    const kontor = g.kontor(HUMAN, g.focus) ?? g.kontor(HUMAN);
    if (info.ship && !info.build) {
      // Aufgabe am Schiff: Schiff wählen (das Schiffsfenster zeigt den Knopf)
      const s = this.nearShip();
      if (s) { ui.selectShip(s); ui.input.flyTo({ tx: s.x, tz: s.y, dist: Math.min(ui.view.rig.dist, 30) }, 650); }
      sel.push(SHIP_BTN[info.ship]);
    } else if (info.build) {
      // Gebäude: Kategorie in der linken Spalte (und die Karte im offenen Baumenü)
      const want = info.build.filter((id) => g.isUnlocked(id) && g.count(id) < 1);
      const pick = (want.length ? want : info.build)[0];
      const cat = BUILDINGS[pick]?.category;
      if (cat) sel.push(`#hud .cat[data-cat="${cat}"]`);
      for (const id of want.length ? want : info.build) sel.push(`#buildPanel .card[data-type="${id}"]`);
      if (info.ship) sel.push(SHIP_BTN[info.ship]);
      if (kontor) { const [cx, cy] = g.center(kontor); ui.input.flyTo({ tx: cx, tz: cy }, 650); }
    } else if (info.tier !== undefined) {
      // Bewohnerstufe: zu einem Haus der Stufe darunter, das am ehesten aufsteigt
      const hs = g.buildings.filter((b) => b.owner === HUMAN && b.type === 'haus' && b.tier === info.tier! - 1);
      hs.sort((a, b) => b.happy - a.happy);
      const h = hs[0];
      if (h) { ui.select(h); const [cx, cy] = g.center(h); ui.input.flyTo({ tx: cx, tz: cy, dist: Math.min(ui.view.rig.dist, 24) }, 650); }
      sel.push('#pop');
    }
    this.showSel = sel;
    this.showUntil = performance.now() + SHOW_MS;
    this.updatePulse();
  }

  /** eigenes Schiff nahe der Kameramitte */
  private nearShip(): Ship | undefined {
    const g = this.ui.g, r = this.ui.view.rig;
    let best: Ship | undefined, bd = Infinity;
    for (const s of g.myShips()) { const d = Math.hypot(s.x - r.tx, s.y - r.tz); if (d < bd) { bd = d; best = s; } }
    return best;
  }

  /** pulsierende Ringe: nach „Zeig mir“ und bei den ersten Aufgaben (Schiff, „Kontor bauen“, Holz, Nahrung) –
   *  als Stilregel, damit sie auch an neu aufgebauten Knöpfen (Infofenster) sofort sitzen */
  private updatePulse() {
    const g = this.ui.g;
    const sel: string[] = [];
    if (performance.now() < this.showUntil) sel.push(...this.showSel);
    const q = QUESTS[g.quest];
    const info = q ? QUEST_INFO[q.title] : undefined;
    if (g.quest <= 3 && info) {
      if (info.ship) sel.push(SHIP_BTN[info.ship]);
      if (info.build) for (const id of info.build) { const c = BUILDINGS[id]?.category; if (c) sel.push(`#hud .cat[data-cat="${c}"]:not(.active)`); }
    }
    const css = sel.length ? `${[...new Set(sel)].join(',\n')} { animation: u3pulse 1.3s ease-in-out infinite; position: relative; z-index: 2; }` : '';
    if (css !== this.pulseCss) {
      this.pulseCss = css;
      const st = document.getElementById('pulseCss');
      if (st) st.textContent = css;
    }
  }

  // ---------- Start-Hilfen: Pfeil zur nächsten unerkundeten Insel, Ring um das Schiff ----------

  private updateHelp(hasKontor: boolean) {
    const g = this.ui.g;
    // Ring um das Schiff bei den ersten beiden Aufgaben (solange es nicht gewählt ist)
    const q = QUESTS[g.quest];
    const ringOn = !!q && QUEST_INFO[q.title]?.ship !== undefined && g.quest <= 1 && !this.ui.selShip;
    this.ringShip = ringOn ? this.nearShip() ?? null : null;
    // Pfeil: solange kein Kontor steht, einmal je Sekunde die nächste unerkundete Insel suchen
    const now = performance.now();
    if (hasKontor) this.arrowTo = null;
    else if (now - this.exploreT > 1000) { this.exploreT = now; this.arrowTo = this.unexplored(); }
    const need = !!this.arrowTo || !!this.ringShip;
    if (!need) { $('#exploreArrow').classList.add('hidden'); $('#shipRing').classList.add('hidden'); return; }
    if (!this.loopOn) { this.loopOn = true; requestAnimationFrame(() => this.helpFrame()); }
  }

  /** nächste unerkundete Insel (weniger als die Hälfte gesehen) vom eigenen Schiff aus */
  private unexplored(): [number, number] | null {
    const g = this.ui.g;
    const s = g.myShips()[0];
    const ox = s?.x ?? this.ui.view.rig.tx, oy = s?.y ?? this.ui.view.rig.tz;
    let best: [number, number] | null = null, bd = Infinity;
    for (const isl of g.islands) {
      const d = Math.hypot(isl.cx - ox, isl.cy - oy);
      if (d >= bd) continue;
      let seen = 0, land = 0;
      for (let y = isl.y0; y <= isl.y1; y++) for (let x = isl.x0; x <= isl.x1; x++) {
        const k = g.idx(x, y);
        if (g.islandOf[k] !== isl.id) continue;
        land++;
        seen += g.seen[k];
      }
      if (land && seen / land < 0.5) { bd = d; best = [isl.cx, isl.cy]; }
    }
    return best;
  }

  /** je Bild: Pfeil am Bildrand bzw. über der Insel, Ring über dem Schiff (nur solange nötig) */
  private helpFrame() {
    const arrow = $('#exploreArrow'), ring = $('#shipRing');
    if (!this.arrowTo && !this.ringShip) { this.loopOn = false; arrow.classList.add('hidden'); ring.classList.add('hidden'); return; }
    requestAnimationFrame(() => this.helpFrame());
    const v = this.ui.view, cam = v.camera;
    const rc = v.renderer.domElement.getBoundingClientRect();
    const proj = (x: number, z: number) => {
      const p = this.pv.set(x, 0, z).project(cam);
      return { x: rc.left + ((p.x + 1) / 2) * rc.width, y: rc.top + ((1 - p.y) / 2) * rc.height, behind: p.z > 1 };
    };
    // Ring über dem eigenen Schiff
    if (this.ringShip && this.ui.g.ships.includes(this.ringShip)) {
      const [sx, sy] = this.ui.g.ip(this.ringShip);
      const p = proj(sx, sy);
      ring.classList.toggle('hidden', p.behind);
      ring.style.transform = `translate(${p.x - 32}px, ${p.y - 32}px)`;
    } else ring.classList.add('hidden');
    // Pfeil: innerhalb des freien Bereichs über der Insel (zeigt nach unten), sonst am Rand in ihre Richtung
    if (this.arrowTo) {
      const p = proj(this.arrowTo[0], this.arrowTo[1]);
      const top = (document.querySelector<HTMLElement>('#hud .top')?.getBoundingClientRect().bottom ?? 0) + 34;
      const lr = document.querySelector<HTMLElement>('#hud .left')?.getBoundingClientRect();
      // freier Bereich: nicht unter dem Infofenster, den Kartenknöpfen oder der Aufgabe
      const box = (sel: string) => { const e = document.querySelector<HTMLElement>(sel); const b = e && e.offsetParent !== null ? e.getBoundingClientRect() : null; return b && b.width ? b : null; };
      const ir = box('#info'), nr = box('#nav'), qr = box('#quest');
      const left = (lr && lr.width ? lr.right : rc.left) + 30;
      const right = Math.min(rc.right, ir ? ir.left : rc.right, nr ? nr.left : rc.right) - 30;
      const bottom = Math.min(rc.bottom - 30, qr ? qr.top - 34 : rc.bottom);
      const cx = (left + right) / 2, cy = (top + bottom) / 2;
      let x = p.x, y = p.y, ang = Math.PI / 2;
      const inside = !p.behind && x > left && x < right && y > top && y < bottom;
      if (inside) { y -= 30; }
      else {
        let dx = x - cx, dy = y - cy;
        if (p.behind) { dx = -dx; dy = -dy; }
        ang = Math.atan2(dy, dx);
        const kx = dx ? (dx > 0 ? right - cx : left - cx) / dx : Infinity;
        const ky = dy ? (dy > 0 ? bottom - cy : top - cy) / dy : Infinity;
        const k = Math.min(Math.abs(kx), Math.abs(ky));
        x = cx + dx * k; y = cy + dy * k;
      }
      arrow.classList.remove('hidden');
      arrow.style.transform = `translate(${x - 22}px, ${y - 22}px)`;
      arrow.querySelector<HTMLElement>('.ar')!.style.transform = `rotate(${ang}rad)`;
    } else arrow.classList.add('hidden');
  }

  updateSpeedBtn() {
    const ui = this.ui;
    $('#pause').textContent = ui.paused ? '▶️' : '⏸';
    $('#pause').classList.toggle('active', ui.paused);
    $('#pause').setAttribute('aria-label', ui.paused ? 'Weiterspielen' : 'Pause');
    $('#speed').textContent = `${ui.speed}x`;
    $('#speed').setAttribute('aria-label', ui.paused ? `Weiterspielen mit Tempo ${ui.speed}x` : `Tempo ${ui.speed}x – antippen für schneller`);
    document.body.classList.toggle('paused', ui.paused);
  }
}
