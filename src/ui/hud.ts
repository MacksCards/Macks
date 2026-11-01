// Oberleiste (Geld, Einwohner, Insel, Warenleiste, Knöpfe), linke Baumenü-Spalte, Aufgabe,
// Pause/Tempo sowie die Kartenknöpfe + / − und der Kompass unten rechts.
import './hud.css';
import { BUILDINGS, CATEGORIES, Category, GOODS, GoodId, TIERS, UNITS } from '../data';
import { HUMAN, QUESTS } from '../game';
import { ZOOM_STEP } from '../input';
import type { UI } from '../ui';
import { $, el, fmt } from './util';

/** so lange drücken (ms), bis der Kompass zum Kontor springt */
const LONG_MS = 550;
/** kurze Beschriftung für die zweispaltige Baumenü-Leiste (nur wo der volle Name nicht passt) */
const CAT_SHORT: Partial<Record<Category, string>> = { werkstatt: 'Werkstatt' };

export class Hud {
  private goodEls = new Map<GoodId, HTMLElement>();
  private questOpen = false;
  private yawShown = NaN;

  constructor(private ui: UI) {}

  /** Oberleiste und linke Baumenü-Spalte anlegen */
  build(hud: HTMLElement) {
    const ui = this.ui;
    const top = el('div', 'top');
    top.innerHTML = `
      <button class="stat money" id="money" aria-label="Taler"><span class="ic">💰</span><span class="v"><b>0</b><small id="bal"></small></span></button>
      <button class="stat" id="pop" aria-label="Einwohner"><span class="ic">👥</span><b>0</b></button>
      <div class="stat island" id="islandName"></div>
      <div class="goods" id="goods"></div>
      <div class="ctrl">
        <button id="logBtn" class="btn sq hidden" aria-label="Meldungen">🔔<i class="badge hidden" id="logBadge"></i></button>
        <button id="fleetBtn" class="btn sq hidden" aria-label="Flotte und Inseln">⛵</button>
        <button id="demBtn" class="btn sq hidden" aria-label="Abreißen">💥</button>
        <button id="pause" class="btn sq" aria-label="Pause">⏸</button>
        <button id="speed" class="btn sq" aria-label="Tempo">1x</button>
        <button id="mapBtn" class="btn sq" aria-label="Weltkarte">🗺️</button>
        <button id="menuBtn" class="btn sq" aria-label="Menü">☰</button>
      </div>`;
    hud.appendChild(top);
    const goods = top.querySelector<HTMLElement>('#goods')!;
    for (const gd of GOODS) {
      const c = el('button', 'good', `<span>${gd.icon}</span><b>0</b>`);
      c.title = gd.name;
      c.setAttribute('aria-label', gd.name);
      c.addEventListener('click', () => ui.openStorage());
      goods.appendChild(c);
      this.goodEls.set(gd.id, c);
    }
    // Verlauf am Rand zeigt, dass man weiterwischen kann
    goods.addEventListener('scroll', () => this.fadeGoods(), { passive: true });
    $('#pause').addEventListener('click', () => ui.togglePause());
    $('#speed').addEventListener('click', () => {
      ui.speed = ui.speed === 1 ? 2 : ui.speed === 2 ? 4 : 1;
      if (ui.paused) ui.togglePause();
      this.updateSpeedBtn();
    });
    $('#menuBtn').addEventListener('click', () => ui.openMenu());
    $('#mapBtn').addEventListener('click', () => ui.openMap());
    // Abreißen: fester Knopf in der Oberleiste (scrollt nie weg)
    $('#demBtn').addEventListener('click', () => {
      ui.build.closeCat();
      ui.setMode(ui.mode.kind === 'demolish' ? { kind: 'none' } : { kind: 'demolish' });
    });
    // Geld und Einwohner: Statistik, sobald es sie gibt – bis dahin Lager & Bilanz
    $('#money').addEventListener('click', () => { if (ui.stats.ready) ui.stats.open('geld'); else ui.openStorage(); });
    $('#pop').addEventListener('click', () => { if (ui.stats.ready) ui.stats.open('einwohner'); else ui.openStorage(); });
    $('#logBtn').addEventListener('click', () => { if (ui.log.ready) ui.log.open(); });
    $('#fleetBtn').addEventListener('click', () => { if (ui.fleet.ready) ui.fleet.open('schiffe'); });
    $('#islandName').addEventListener('click', () => { if (ui.fleet.ready) ui.fleet.open('inseln'); });

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

  /** Aufgabe unten in der Mitte und Kartenknöpfe (+ / − / Kompass) unten rechts */
  buildBottom(hud: HTMLElement) {
    const ui = this.ui;
    const quest = el('button', 'quest', '');
    quest.id = 'quest';
    quest.addEventListener('click', () => { this.questOpen = !this.questOpen; this.updateQuest(); });
    hud.appendChild(quest);
    const nav = el('div', 'nav', `
      <button class="btn sq" id="zoomIn" aria-label="Näher heran">+</button>
      <button class="btn sq" id="zoomOut" aria-label="Weiter weg">−</button>
      <button class="btn sq compass" id="compass" aria-label="Kompass – antippen: Norden nach oben, lang drücken: zum Kontor"><span>🧭</span><b id="north">N</b></button>`);
    nav.id = 'nav';
    hud.appendChild(nav);
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
  }

  /** N am Kompassrand dorthin drehen, wo auf dem Bildschirm Norden liegt
   *  (nach jeder Kamerabewegung durch Finger oder Kamerafahrt und bei jeder Auffrischung der Leiste) */
  needle() {
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

  /** Zahlen, Insel, Warenleiste und Baumenü-Spalte auffrischen (4 × je Sekunde) */
  update() {
    const ui = this.ui, g = ui.g;
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
    isl.textContent = focus >= 0 ? `📍 ${g.islands[focus].name}` : '⛵ Noch kein Kontor';
    isl.classList.toggle('tap', ui.fleet.ready);
    // Nur Waren zeigen, die es gibt oder die ein freigeschaltetes Gebäude herstellt/braucht
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
    for (const [id, e] of this.goodEls) {
      const v = g.goods[id];
      e.classList.toggle('hidden', focus < 0 || (!relevant.has(id) && v < 1));
      e.querySelector('b')!.textContent = String(Math.floor(v));
      e.classList.toggle('full', v >= g.capacity);
      e.classList.toggle('empty', v < 1);
    }
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
    // Gerüste: ihre Knöpfe erst zeigen, wenn es dort etwas gibt
    $('#logBtn').classList.toggle('hidden', !ui.log.ready);
    const unread = ui.log.ready ? ui.log.unread : 0;
    const badge = $('#logBadge');
    badge.classList.toggle('hidden', unread <= 0);
    badge.textContent = unread > 99 ? '99+' : String(unread);
    $('#fleetBtn').classList.toggle('hidden', !ui.fleet.ready);
    this.fadeGoods();
    this.needle();
  }

  updateQuest() {
    const q = QUESTS[this.ui.g.quest];
    const e = $('#quest');
    if (!q) { e.innerHTML = `📜 <b>Alle Aufgaben erledigt!</b> Baue frei weiter.`; return; }
    e.innerHTML = `📜 <b>${q.title}</b> <span class="prog">${q.progress(this.ui.g)}</span>` +
      (this.questOpen ? `<br><small>${q.hint}</small>` : '');
  }

  updateSpeedBtn() {
    const ui = this.ui;
    $('#pause').textContent = ui.paused ? '▶️' : '⏸';
    $('#pause').classList.toggle('active', ui.paused);
    $('#speed').textContent = `${ui.speed}x`;
    document.body.classList.toggle('paused', ui.paused);
  }
}
