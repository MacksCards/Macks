// Bedienoberfläche (HTML über dem 3D-Bild) und Steuerlogik.
import { BUILDINGS, BuildingId, CATEGORIES, Category, Cost, GOOD, GOODS, GoodId, TIERS } from './data';
import { Building, Game, QUESTS, newSeed } from './game';
import { Input } from './input';
import { View } from './render/scene';

type Mode =
  | { kind: 'none' }
  | { kind: 'build'; type: BuildingId; gx: number; gy: number; has: boolean }
  | { kind: 'road' }
  | { kind: 'demolish' };

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

function el(tag: string, cls = '', html = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export function costText(c: Cost): string {
  const parts: string[] = [];
  if (c.taler) parts.push(`💰${c.taler}`);
  if (c.holz) parts.push(`${GOOD.holz.icon}${c.holz}`);
  if (c.werkzeug) parts.push(`${GOOD.werkzeug.icon}${c.werkzeug}`);
  if (c.stein) parts.push(`${GOOD.stein.icon}${c.stein}`);
  return parts.join(' ') || 'kostenlos';
}

const fmt = (n: number) => Math.floor(n).toLocaleString('de-DE');

export class UI {
  mode: Mode = { kind: 'none' };
  selected: Building | null = null;
  showStorage = false;
  paused = false;
  speed = 1;
  private openCat: Category | null = null;
  private roadStart: [number, number] | null = null;
  private roadCells: [number, number][] = [];
  private goodEls = new Map<GoodId, HTMLElement>();
  private questOpen = false;

  constructor(public g: Game, public view: View, private onNewGame: (g: Game) => void) {
    this.buildDom();
    new Input($('#c'), view, {
      tap: (x, y) => this.tap(x, y),
      wantsPaint: () => this.mode.kind === 'road',
      paintStart: (x, y) => this.roadStartAt(x, y),
      paintMove: (x, y) => this.roadMoveTo(x, y),
      paintEnd: (cancel) => this.roadEnd(cancel),
    });
    this.bindGame();
  }

  bindGame() {
    const v = this.view;
    this.g.ev = {
      added: (b) => v.addBuilding(b),
      removed: (b) => { v.removeBuilding(b); if (this.selected === b) this.select(null); },
      changed: (b) => v.changedBuilding(b),
      roads: () => v.onRoadsChanged(),
      trees: () => v.onTreesChanged(),
      message: (t, k) => this.toast(t, k),
    };
  }

  setGame(g: Game) {
    this.g = g;
    this.bindGame();
    this.setMode({ kind: 'none' });
    this.select(null);
  }

  // ---------- DOM ----------

  private buildDom() {
    const hud = $('#hud');
    // Obere Leiste
    const top = el('div', 'top');
    top.innerHTML = `
      <div class="stat" id="money" title="Taler"><span>💰</span><b>0</b><small id="bal"></small></div>
      <div class="stat" id="pop" title="Einwohner"><span>👥</span><b>0</b></div>
      <div class="goods" id="goods"></div>
      <div class="ctrl">
        <button id="pause" class="btn sq" aria-label="Pause">⏸</button>
        <button id="speed" class="btn sq" aria-label="Tempo">1x</button>
        <button id="menuBtn" class="btn sq" aria-label="Menü">☰</button>
      </div>`;
    hud.appendChild(top);
    const goods = top.querySelector('#goods')!;
    for (const gd of GOODS) {
      const c = el('button', 'good', `<span>${gd.icon}</span><b>0</b>`);
      c.title = gd.name;
      c.addEventListener('click', () => this.openStorage());
      goods.appendChild(c);
      this.goodEls.set(gd.id, c);
    }
    $('#pause').addEventListener('click', () => this.togglePause());
    $('#speed').addEventListener('click', () => {
      this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
      if (this.paused) this.togglePause();
      this.updateSpeedBtn();
    });
    $('#menuBtn').addEventListener('click', () => this.openMenu());
    $('#money').addEventListener('click', () => this.openStorage());
    $('#pop').addEventListener('click', () => this.openStorage());

    // Linke Baumenü-Spalte
    const left = el('div', 'left');
    for (const c of CATEGORIES) {
      const b = el('button', 'btn cat', `<span>${c.icon}</span><small>${c.name}</small>`);
      b.dataset.cat = c.id;
      b.addEventListener('click', () => this.toggleCat(c.id));
      left.appendChild(b);
    }
    const dem = el('button', 'btn cat', `<span>💥</span><small>Abreißen</small>`);
    dem.id = 'demBtn';
    dem.addEventListener('click', () => {
      this.closeCat();
      this.setMode(this.mode.kind === 'demolish' ? { kind: 'none' } : { kind: 'demolish' });
    });
    left.appendChild(dem);
    hud.appendChild(left);

    hud.appendChild(el('div', 'panel hidden', '')).id = 'buildPanel';
    hud.appendChild(el('div', 'info hidden', '')).id = 'info';

    const quest = el('button', 'quest', '');
    quest.id = 'quest';
    quest.addEventListener('click', () => { this.questOpen = !this.questOpen; this.updateQuest(); });
    hud.appendChild(quest);

    const hint = el('div', 'hint hidden', `<div id="hintText"></div>
      <button id="hintOk" class="btn ok">✓ Bauen</button><button id="hintX" class="btn">✕</button>`);
    hint.id = 'hint';
    hud.appendChild(hint);
    $('#hintOk').addEventListener('click', () => this.confirmBuild());
    $('#hintX').addEventListener('click', () => this.setMode({ kind: 'none' }));

    hud.appendChild(el('div', 'toasts', '')).id = 'toasts';
    hud.appendChild(el('div', 'modal hidden', '')).id = 'modal';
  }

  // ---------- Modi ----------

  setMode(m: Mode) {
    this.mode = m;
    this.view.setGhost(null);
    this.view.setRoadPreview([], []);
    const building = m.kind !== 'none';
    if (this.view.areaShown !== building) this.view.showArea(building);
    if (building) this.select(null);
    $('#demBtn').classList.toggle('active', m.kind === 'demolish');
    const hint = $('#hint');
    hint.classList.toggle('hidden', !building);
    $('#quest').classList.toggle('hidden', building);
    $('#hintOk').classList.toggle('hidden', m.kind !== 'build');
    this.updateHint();
  }

  private updateHint() {
    const m = this.mode;
    const t = $('#hintText');
    if (m.kind === 'build') {
      const d = BUILDINGS[m.type];
      const chk = m.has ? this.g.canPlace(m.type, m.gx, m.gy) : this.g.canAfford(d.cost);
      let msg = !m.has ? 'Tippe auf die Insel, wo es stehen soll.' : chk.ok ? 'Nochmal tippen oder ✓ zum Bauen.' : `⚠️ ${chk.reason}`;
      if (m.has && chk.ok && d.prod) {
        const eff = this.g.siteEfficiency(m.type, m.gx, m.gy);
        if (d.needs === 'wald' && eff < 0.5) msg += ` Wenig Wald hier (${Math.round(eff * 100)} %).`;
        if (d.needs === 'wasser' && eff < 0.5) msg += ` Wenig Wasser hier (${Math.round(eff * 100)} %).`;
      }
      if (!m.has && d.prod) msg += ' Danach mit einem Weg verbinden!';
      t.innerHTML = `<b>${d.icon} ${d.name}</b> <span class="cost">${costText(d.cost)}</span><br><small>${msg}</small>`;
      ($('#hintOk') as HTMLButtonElement).disabled = !(m.has && chk.ok);
    } else if (m.kind === 'road') {
      t.innerHTML = `<b>🟫 Feldweg</b> <span class="cost">💰5 je Feld</span><br><small>Mit dem Finger ziehen, um Wege zu bauen. Zwei Finger bewegen die Karte.</small>`;
    } else if (m.kind === 'demolish') {
      t.innerHTML = `<b>💥 Abreißen</b><br><small>Tippe auf ein Gebäude oder einen Weg. Du bekommst die Hälfte des Materials zurück.</small>`;
    }
  }

  private toggleCat(c: Category) {
    if (this.openCat === c) { this.closeCat(); return; }
    if (c === 'wege') {
      this.closeCat();
      this.setMode(this.mode.kind === 'road' ? { kind: 'none' } : { kind: 'road' });
      return;
    }
    this.openCat = c;
    this.select(null);
    document.querySelectorAll('.cat').forEach((b) => b.classList.toggle('active', (b as HTMLElement).dataset.cat === c));
    const p = $('#buildPanel');
    p.innerHTML = '';
    p.classList.remove('hidden');
    for (const d of Object.values(BUILDINGS)) {
      if (d.category !== c) continue;
      const card = el('button', 'card', `<span class="ic">${d.icon}</span><b>${d.name}</b><small class="cost">${costText(d.cost)}</small><small class="desc">${d.desc}</small>`);
      card.dataset.type = d.id;
      card.addEventListener('click', () => {
        this.closeCat();
        this.setMode({ kind: 'build', type: d.id, gx: 0, gy: 0, has: false });
      });
      p.appendChild(card);
    }
    this.refreshCards();
  }

  private refreshCards() {
    document.querySelectorAll<HTMLElement>('#buildPanel .card').forEach((c) => {
      const d = BUILDINGS[c.dataset.type as BuildingId];
      c.classList.toggle('poor', !this.g.canAfford(d.cost).ok);
    });
  }

  private closeCat() {
    this.openCat = null;
    $('#buildPanel').classList.add('hidden');
    document.querySelectorAll('.cat').forEach((b) => b.classList.remove('active'));
  }

  // ---------- Tippen ----------

  private tap(x: number, y: number) {
    if (this.openCat) { this.closeCat(); return; }
    const m = this.mode;
    if (m.kind === 'build') {
      const t = this.view.pick(x, y, false);
      if (!t) return;
      const s = BUILDINGS[m.type].size;
      const gx = t[0] - Math.floor((s - 1) / 2), gy = t[1] - Math.floor((s - 1) / 2);
      if (m.has && gx === m.gx && gy === m.gy) { this.confirmBuild(); return; }
      m.gx = gx; m.gy = gy; m.has = true;
      this.view.setGhost(m.type, gx, gy, this.g.canPlace(m.type, gx, gy).ok);
      this.updateHint();
      return;
    }
    if (m.kind === 'demolish') {
      const t = this.view.pick(x, y, true);
      if (t && this.g.demolish(t[0], t[1])) this.toast('Abgerissen', 'info');
      return;
    }
    const t = this.view.pick(x, y, true);
    const b = t ? this.g.buildingAt(t[0], t[1]) : undefined;
    this.select(b ?? null);
  }

  private confirmBuild() {
    const m = this.mode;
    if (m.kind !== 'build' || !m.has) return;
    const r = this.g.place(m.type, m.gx, m.gy);
    if (!r.ok) { this.toast(r.reason ?? 'Geht nicht', 'bad'); return; }
    // Vorschau bleibt aktiv für das nächste Gebäude
    m.has = false;
    this.view.setGhost(null);
    this.updateHint();
    if (!this.g.canAfford(BUILDINGS[m.type].cost).ok) {
      this.toast(`${this.g.canAfford(BUILDINGS[m.type].cost).reason} für ein weiteres`, 'info');
    }
  }

  // ---------- Wege ziehen ----------

  private roadStartAt(x: number, y: number) {
    this.roadStart = this.view.pick(x, y, false);
    this.roadCells = this.roadStart ? [this.roadStart] : [];
    this.previewRoad();
  }

  private roadMoveTo(x: number, y: number) {
    if (!this.roadStart) { this.roadStartAt(x, y); return; }
    const t = this.view.pick(x, y, false);
    if (!t) return;
    const [x0, y0] = this.roadStart;
    const [x1, y1] = t;
    const cells: [number, number][] = [];
    // L-Form: zuerst die längere Richtung
    const line = (a: number, b: number) => {
      const out: number[] = [];
      const st = Math.sign(b - a);
      for (let v = a; ; v += st) { out.push(v); if (v === b) break; }
      return out;
    };
    if (Math.abs(x1 - x0) >= Math.abs(y1 - y0)) {
      for (const xx of line(x0, x1)) cells.push([xx, y0]);
      for (const yy of line(y0, y1).slice(1)) cells.push([x1, yy]);
    } else {
      for (const yy of line(y0, y1)) cells.push([x0, yy]);
      for (const xx of line(x0, x1).slice(1)) cells.push([xx, y1]);
    }
    this.roadCells = cells.slice(0, 200);
    this.previewRoad();
  }

  private previewRoad() {
    const ok = this.roadCells.map(([x, y]) => this.g.canRoad(x, y).ok || this.g.roads[this.g.idx(x, y)] === 1);
    this.view.setRoadPreview(this.roadCells, ok);
  }

  private roadEnd(cancel: boolean) {
    if (!cancel && this.roadCells.length) {
      const n = this.g.placeRoads(this.roadCells);
      if (n > 1) this.toast(`${n} Wegfelder gebaut`, 'info');
    }
    this.roadStart = null;
    this.roadCells = [];
    this.view.setRoadPreview([], []);
  }

  // ---------- Info-Fenster ----------

  select(b: Building | null) {
    this.selected = b;
    this.showStorage = false;
    this.view.setSelected(b);
    if (b) this.closeCat();
    this.renderInfo();
  }

  private openStorage() {
    this.select(null);
    this.closeCat();
    this.showStorage = true;
    this.renderInfo();
  }

  renderInfo() {
    const box = $('#info');
    const b = this.selected;
    if (!b && !this.showStorage) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const g = this.g;
    let h = `<button class="close btn sq" id="infoX">✕</button>`;
    if (this.showStorage || (b && b.type === 'kontor')) {
      const inc = g.incomePerMinute();
      const pt = g.popByTier();
      h += `<h3>${b ? '⚓ Kontor' : '📦 Lager & Bilanz'}</h3>
        <p class="sub">Lagerplatz: ${g.capacity} je Ware</p><div class="grid">`;
      for (const gd of GOODS) {
        const v = g.goods[gd.id];
        h += `<div class="row ${v >= g.capacity ? 'warn' : ''}"><span>${gd.icon} ${gd.name}</span><b>${fmt(v)}</b></div>`;
      }
      h += `</div><h4>Bilanz pro Minute</h4>
        <div class="row"><span>Steuern</span><b class="pos">+${fmt(inc.tax)}</b></div>
        <div class="row"><span>Unterhalt</span><b class="neg">−${fmt(inc.upkeep)}</b></div>
        <h4>Einwohner</h4>`;
      TIERS.forEach((t, i) => { h += `<div class="row"><span>${t.name}</span><b>${pt[i]}</b></div>`; });
      box.innerHTML = h;
      $('#infoX').addEventListener('click', () => this.select(null));
      return;
    }
    if (!b) return;
    const d = BUILDINGS[b.type];
    if (b.type === 'haus') {
      const tier = TIERS[b.tier];
      const cov = g.coverage.get(b.id) ?? new Set();
      h += `<h3>🏠 Haus der ${tier.name}</h3>
        <div class="row"><span>Bewohner</span><b>${b.residents} / ${tier.maxResidents}</b></div>
        <div class="row"><span>Zufriedenheit</span><b>${Math.round(b.happy * 100)} %</b></div>
        <div class="bar"><i style="width:${Math.round(b.happy * 100)}%;background:${b.happy > 0.85 ? '#6c3' : b.happy > 0.45 ? '#eb3' : '#d43'}"></i></div>
        <h4>Bedürfnisse</h4>`;
      for (const gId of Object.keys(tier.consumes) as GoodId[]) {
        const ok = (b.need[gId] ?? 1) > 0.6 && !b.short[gId];
        h += `<div class="row"><span>${GOOD[gId].icon} ${GOOD[gId].name}</span><b>${ok ? '✅' : '❌'}</b></div>`;
      }
      for (const s of tier.services) {
        h += `<div class="row"><span>${BUILDINGS[s].icon} ${BUILDINGS[s].name} in der Nähe</span><b>${cov.has(s) ? '✅' : '❌'}</b></div>`;
      }
      const block = g.upgradeBlocker(b);
      if (b.tier < TIERS.length - 1) {
        const next = TIERS[b.tier + 1];
        h += `<h4>Aufstieg zu ${next.name}</h4><p class="sub">${block ? '⏳ ' + block : '⬆️ Steigt gerade auf …'}</p>
          <p class="sub">Kosten: ${costText(next.upgradeCost)}</p>`;
      } else h += `<p class="sub">🏆 Höchste Stufe erreicht</p>`;
      h += `<p class="sub">Steuern: ${(b.residents * tier.tax * (0.4 + 0.6 * b.happy)).toFixed(1)} Taler/Min</p>`;
    } else {
      h += `<h3>${d.icon} ${d.name}</h3><p class="sub">${d.desc}</p>`;
      if (d.prod) {
        const st: Record<string, string> = {
          ok: '✅ Arbeitet', keinWeg: '🚧 Kein Weg zum Kontor oder Marktplatz', lagerVoll: '📦 Lager ist voll',
          keinWald: '🌲 Kein Wald in der Nähe', keinWasser: '🌊 Kein Wasser in der Nähe',
          rohstoff: `⚠️ Es fehlt: ${b.missing.map((m) => GOOD[m].name).join(', ')}`,
        };
        const inp = Object.entries(d.prod.input ?? {}).map(([k, n]) => `${n} ${GOOD[k as GoodId].icon}`).join(' + ');
        h += `<div class="row"><span>Status</span><b>${st[b.status] ?? ''}</b></div>
          <div class="row"><span>Produziert</span><b>${inp ? inp + ' → ' : ''}1 ${GOOD[d.prod.output].icon} ${GOOD[d.prod.output].name} / ${Math.round(d.prod.time / Math.max(0.05, b.eff))} s</b></div>
          <div class="row"><span>Standort</span><b>${Math.round(b.eff * 100)} %</b></div>
          <div class="row"><span>Auslastung</span><b>${Math.round(b.active * 100)} %</b></div>
          <div class="bar"><i style="width:${Math.round((b.progress / d.prod.time) * 100)}%"></i></div>`;
      }
      if (d.radius) h += `<div class="row"><span>Reichweite</span><b>${d.radius} Felder</b></div>`;
      if (d.storage) h += `<div class="row"><span>Lager</span><b>+${d.storage} je Ware</b></div>`;
    }
    h += `<div class="row"><span>Unterhalt</span><b>${d.upkeep} Taler/Min</b></div>`;
    if (b.type !== 'kontor') h += `<button class="btn danger" id="infoDel">💥 Abreißen</button>`;
    box.innerHTML = h;
    $('#infoX').addEventListener('click', () => this.select(null));
    document.getElementById('infoDel')?.addEventListener('click', () => {
      this.ask(`${d.icon} ${d.name} abreißen?`, 'Du bekommst die Hälfte des Baumaterials zurück.', '💥 Abreißen', () => {
        g.removeBuilding(b);
        this.select(null);
      });
    });
  }

  // ---------- Leisten ----------

  updateHud() {
    const g = this.g;
    const inc = g.incomePerMinute();
    const bal = inc.tax - inc.upkeep;
    $('#money').querySelector('b')!.textContent = fmt(g.money);
    const balEl = $('#bal');
    balEl.textContent = `${bal >= 0 ? '+' : '−'}${fmt(Math.abs(bal))}/min`;
    balEl.className = bal >= 0 ? 'pos' : 'neg';
    $('#money').classList.toggle('neg', g.money < 0);
    $('#pop').querySelector('b')!.textContent = fmt(g.population());
    for (const [id, e] of this.goodEls) {
      const v = g.goods[id];
      e.querySelector('b')!.textContent = String(Math.floor(v));
      e.classList.toggle('full', v >= g.capacity);
      e.classList.toggle('empty', v < 1);
    }
    if (this.openCat) this.refreshCards();
    if (this.mode.kind === 'build') this.updateHint();
    if (this.selected || this.showStorage) this.renderInfo();
    this.updateQuest();
  }

  private updateQuest() {
    const q = QUESTS[this.g.quest];
    const e = $('#quest');
    if (!q) { e.innerHTML = `📜 <b>Alle Aufgaben erledigt!</b> Baue frei weiter.`; return; }
    e.innerHTML = `📜 <b>${q.title}</b> <span class="prog">${q.progress(this.g)}</span>` +
      (this.questOpen ? `<br><small>${q.hint}</small>` : '');
  }

  togglePause() {
    this.paused = !this.paused;
    this.updateSpeedBtn();
  }

  private updateSpeedBtn() {
    $('#pause').textContent = this.paused ? '▶️' : '⏸';
    $('#pause').classList.toggle('active', this.paused);
    $('#speed').textContent = `${this.speed}x`;
    document.body.classList.toggle('paused', this.paused);
  }

  toast(text: string, kind: 'info' | 'good' | 'bad' = 'info') {
    const box = $('#toasts');
    const t = el('div', `toast ${kind}`, text);
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild!.remove();
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  // ---------- Menü ----------

  openMenu() {
    const m = $('#modal');
    m.classList.remove('hidden');
    m.innerHTML = `<div class="box">
      <h2>⚓ Neue Ufer</h2>
      <button class="btn wide" id="mResume">▶️ Weiterspielen</button>
      <button class="btn wide" id="mSave">💾 Speichern</button>
      <button class="btn wide" id="mHelp">❓ Anleitung</button>
      <button class="btn wide danger" id="mNew">🏝️ Neues Spiel (neue Insel)</button>
      <p class="sub">Das Spiel speichert automatisch.</p></div>`;
    $('#mResume').addEventListener('click', () => this.closeModal());
    $('#mSave').addEventListener('click', () => {
      const ok = this.g.save();
      this.toast(ok ? 'Gespeichert ✔' : 'Speichern nicht möglich (privater Modus?)', ok ? 'good' : 'bad');
      this.closeModal();
    });
    $('#mHelp').addEventListener('click', () => this.openHelp());
    $('#mNew').addEventListener('click', () => {
      this.ask('Neu anfangen?', 'Dein aktuelles Spiel geht verloren.', '🏝️ Neue Insel', () => {
        Game.clearSave();
        this.onNewGame(Game.create(newSeed()));
        this.toast('Eine neue Insel wartet auf dich!', 'good');
      });
    });
  }

  openHelp() {
    const m = $('#modal');
    m.classList.remove('hidden');
    m.innerHTML = `<div class="box help">
      <h2>Willkommen auf deiner Insel!</h2>
      <p>Dein Schiff hat angelegt, das <b>⚓ Kontor</b> steht. Baue eine blühende Siedlung auf.</p>
      <ul>
        <li><b>Karte bewegen:</b> mit einem Finger ziehen. <b>Zoomen & drehen:</b> mit zwei Fingern.</li>
        <li><b>Bauen:</b> links eine Kategorie wählen → Gebäude wählen → auf die Insel tippen → nochmal tippen oder ✓.</li>
        <li><b>Wege 🛤️:</b> Betriebe brauchen einen Feldweg zum Kontor oder Marktplatz, sonst liefern sie nichts.</li>
        <li><b>Bewohner:</b> Pioniere wollen Fisch und einen Marktplatz. Sind sie zufrieden, steigen ihre Häuser zu Siedlern und Bürgern auf. Die wollen mehr.</li>
        <li><b>Geld:</b> Bewohner zahlen Steuern, Betriebe kosten Unterhalt. Achte auf die Bilanz oben links.</li>
        <li>Tippe auf ein Gebäude, um zu sehen, was ihm fehlt. Das 📜 unten hilft dir mit Aufgaben.</li>
      </ul>
      <button class="btn wide ok" id="hClose">Los geht's!</button></div>`;
    $('#hClose').addEventListener('click', () => this.closeModal());
  }

  /** Eigene Rückfrage (Browser-Dialoge sind nicht überall erlaubt) */
  ask(title: string, text: string, yes: string, onYes: () => void) {
    const m = $('#modal');
    m.classList.remove('hidden');
    m.innerHTML = `<div class="box"><h2>${title}</h2><p class="sub">${text}</p>
      <div class="row2"><button class="btn" id="askNo">Abbrechen</button><button class="btn danger" id="askYes">${yes}</button></div></div>`;
    $('#askNo').addEventListener('click', () => this.closeModal());
    $('#askYes').addEventListener('click', () => { this.closeModal(); onYes(); });
  }

  closeModal() {
    $('#modal').classList.add('hidden');
  }
}
