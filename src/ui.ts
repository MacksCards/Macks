// Bedienoberfläche (HTML über dem 3D-Bild) und Steuerlogik.
import { BUILDINGS, BuildingId, CATEGORIES, Category, Cost, GOOD, GOODS, GoodId, TIERS } from './data';
import { Building, Game, HUMAN, QUESTS, Ship, newSeed } from './game';
import { PFLANZEN, Pflanze, depositText } from './world';
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
  selShip: Ship | null = null;
  islandInfo: number | null = null;

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
      added: (b) => { v.addBuilding(b); if (b.type === 'kontor' || b.type === 'markt') v.onTerritory(); },
      removed: (b) => { v.removeBuilding(b); if (b.type === 'markt') v.onTerritory(); if (this.selected === b) this.select(null); },
      changed: (b) => v.changedBuilding(b),
      roads: () => v.onRoadsChanged(),
      trees: () => v.onTreesChanged(),
      seen: () => v.onSeen(),
      message: (t, k) => this.toast(t, k),
    };
  }

  setGame(g: Game) {
    this.g = g;
    this.bindGame();
    this.setMode({ kind: 'none' });
    this.select(null);
    this.view.ships.selected = null;
  }

  // ---------- DOM ----------

  private buildDom() {
    const hud = $('#hud');
    // Obere Leiste
    const top = el('div', 'top');
    top.innerHTML = `
      <div class="stat" id="money" title="Taler"><span>💰</span><b>0</b><small id="bal"></small></div>
      <div class="stat" id="pop" title="Einwohner"><span>👥</span><b>0</b></div>
      <div class="stat island" id="islandName"></div>
      <div class="goods" id="goods"></div>
      <div class="ctrl">
        <button id="pause" class="btn sq" aria-label="Pause">⏸</button>
        <button id="speed" class="btn sq" aria-label="Tempo">1x</button>
        <button id="mapBtn" class="btn sq" aria-label="Weltkarte">🗺️</button>
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
    $('#mapBtn').addEventListener('click', () => this.openMap());
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
      if (d.category !== c || !this.g.isUnlocked(d.id)) continue;
      const card = el('button', 'card', `<span class="ic">${d.icon}</span><b>${d.name}</b><small class="cost">${costText(d.cost)}</small><small class="desc">${d.desc}</small>`);
      card.dataset.type = d.id;
      card.addEventListener('click', () => {
        this.closeCat();
        this.setMode({ kind: 'build', type: d.id, gx: 0, gy: 0, has: false });
      });
      p.appendChild(card);
    }
    const nx = this.g.nextUnlock(c);
    if (nx) p.appendChild(el('div', 'card next', `<span class="ic">🔒</span><b>Weitere Gebäude</b><small class="desc">ab ${nx.n} ${TIERS[nx.tier].name} auf einer Insel (z. B. ${BUILDINGS[nx.type].icon} ${BUILDINGS[nx.type].name})</small>`));
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
      if (!t) return;
      const b = this.g.buildingAt(t[0], t[1]);
      if (b && b.type !== 'kontor') {
        // Gebäude nur nach Rückfrage abreißen (Wege sofort)
        const d = BUILDINGS[b.type];
        this.ask(`${d.icon} ${d.name} abreißen?`, 'Du bekommst die Hälfte des Baumaterials zurück.', '💥 Abreißen', () => {
          this.g.removeBuilding(b);
          this.toast('Abgerissen', 'info');
        });
        return;
      }
      if (this.g.demolish(t[0], t[1])) this.toast('Abgerissen', 'info');
      return;
    }
    // Schiff antippen → auswählen
    const ship = this.view.pickShip(x, y);
    if (ship && ship.owner === HUMAN) { this.selectShip(ship); return; }
    const t = this.view.pick(x, y, true);
    const b = t ? this.g.buildingAt(t[0], t[1]) : undefined;
    // Schiff ausgewählt + aufs Meer getippt → hinsegeln
    if (this.selShip && !b) {
      const gt = this.view.pick(x, y, false);
      if (gt && this.g.tiles[this.g.idx(gt[0], gt[1])] === 0) {
        if (this.g.moveShip(this.selShip, gt[0] + 0.5, gt[1] + 0.5)) this.toast('⛵ Kurs gesetzt', 'info');
        else this.toast('Dorthin findet das Schiff keinen Weg', 'bad');
        return;
      }
    }
    if (b) { this.select(b); return; }
    // Land einer entdeckten Insel → Inselinfo
    if (t) {
      const k = this.g.idx(t[0], t[1]);
      const isl = this.g.islandOf[k];
      if (isl >= 0 && this.g.seen[k] && !this.g.area[k]) { this.select(null); this.islandInfo = isl; this.renderInfo(); return; }
    }
    this.select(null);
  }

  selectShip(s: Ship | null) {
    this.select(null);
    this.selShip = s;
    this.view.ships.selected = s ? s.id : null;
    this.renderInfo();
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
    this.islandInfo = null;
    if (this.selShip) { this.selShip = null; this.view.ships.selected = null; }
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
    if (!b && !this.showStorage && !this.selShip && this.islandInfo === null) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const g = this.g;
    let h = `<button class="close btn sq" id="infoX">✕</button>`;
    if (this.selShip) { this.renderShip(box, h); return; }
    if (this.islandInfo !== null) { if (!this.setHtml(box, h + this.islandHtml(this.islandInfo))) return; $('#infoX').addEventListener('click', () => this.select(null)); return; }
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
      if (!this.setHtml(box, h)) return;
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
          ok: '✅ Arbeitet', keinWeg: '🚧 Kein Weg zum Kontor oder Marktplatz', lagerVoll: '📦 Voll – wartet auf den Marktkarren (Weg + Reichweite von Kontor/Marktplatz?)',
          keinWald: '🌲 Kein Wald in der Nähe', keinWasser: '🌊 Kein Wasser in der Nähe',
          rohstoff: `⚠️ Es fehlt: ${b.missing.map((m) => GOOD[m].name).join(', ')}`,
        };
        const inp = Object.entries(d.prod.input ?? {}).map(([k, n]) => `${n} ${GOOD[k as GoodId].icon}`).join(' + ');
        h += `<div class="row"><span>Status</span><b>${st[b.status] ?? ''}</b></div>
          <div class="row"><span>Produziert</span><b>${inp ? inp + ' → ' : ''}${d.prod.amount ?? 1} ${GOOD[d.prod.output].icon} ${GOOD[d.prod.output].name} / ${Math.round(d.prod.time / Math.max(0.05, b.eff))} s</b></div>
          <div class="row"><span>Standort</span><b>${Math.round(b.eff * 100)} %</b></div>
          <div class="row"><span>Im Betrieb gelagert</span><b>${Math.floor(b.stock)} / ${d.stock ?? 4} t</b></div>
          <div class="row"><span>Auslastung</span><b>${Math.round(b.active * 100)} %</b></div>
          <div class="bar"><i style="width:${Math.round((b.progress / d.prod.time) * 100)}%"></i></div>`;
      }
      if (d.work && d.prod) h += `<div class="row"><span>Arbeitsradius</span><b>${d.work} Felder</b></div>`;
      else if (d.radius) h += `<div class="row"><span>Reichweite</span><b>${d.radius} Felder</b></div>`;
      if (d.storage) h += `<div class="row"><span>Lager</span><b>+${d.storage} je Ware</b></div>`;
    }
    h += `<div class="row"><span>Unterhalt</span><b>${d.upkeep} Taler/Min</b></div>`;
    if (b.type !== 'kontor') h += `<button class="btn danger" id="infoDel">💥 Abreißen</button>`;
    if (!this.setHtml(box, h)) return;
    $('#infoX').addEventListener('click', () => this.select(null));
    document.getElementById('infoDel')?.addEventListener('click', () => {
      this.ask(`${d.icon} ${d.name} abreißen?`, 'Du bekommst die Hälfte des Baumaterials zurück.', '💥 Abreißen', () => {
        g.removeBuilding(b);
        this.select(null);
      });
    });
  }

  /** HTML nur setzen, wenn es sich geändert hat (sonst gehen Tipps auf Knöpfe verloren) */
  private setHtml(box: HTMLElement, html: string): boolean {
    if ((box as HTMLElement & { _h?: string })._h === html) return false;
    (box as HTMLElement & { _h?: string })._h = html;
    box.innerHTML = html;
    return true;
  }

  private islandHtml(id: number): string {
    const isl = this.g.islands[id];
    const fr = (Object.keys(PFLANZEN) as Pflanze[]).filter((p) => isl.frucht[p]).map((p) =>
      `<div class="row"><span>${PFLANZEN[p].icon} ${PFLANZEN[p].name}</span><b>${isl.frucht[p]} %</b></div>`).join('');
    const owner = this.g.kontor(HUMAN, id) ? 'Deine Insel' : this.g.buildings.some((b) => b.island === id && b.type === 'kontor') ? 'Besetzt' : 'Unbesiedelt';
    const gr = { klein: 'klein', mittel: 'mittelgroß', gross: 'groß' }[isl.groesse];
    return `<h3>🏝️ ${isl.name}</h3><p class="sub">${gr} · ${isl.klima === 'nord' ? 'Nördliches' : 'Südliches'} Klima · ${owner}</p>
      <h4>Fruchtbarkeit</h4>${fr || '<p class="sub">Keine Plantagenpflanzen</p>'}
      <p class="sub">Holz, Getreide, Schafe und Schweine gehen überall.</p>
      <h4>Im Berg</h4><div class="row"><span>⛰️ Vorkommen</span><b>${depositText(isl)}</b></div>`;
  }

  private renderShip(box: HTMLElement, head: string) {
    const g = this.g, s = this.selShip!;
    const dock = g.shipDock(s);
    const near = g.shipNearIsland(s);
    let h = head + `<h3>⛵ ${s.name}</h3><p class="sub">${s.path.length ? 'Unterwegs …' : 'Liegt vor Anker'} – tippe aufs Meer, um hinzusegeln.</p><h4>Laderaum</h4><div class="slots">`;
    for (const sl of s.slots) h += `<div class="slot">${sl.g ? `<span>${GOOD[sl.g].icon}</span><b>${sl.n}</b>` : '<small>leer</small>'}</div>`;
    h += '</div>';
    if (dock) {
      const l = g.lagerOf(HUMAN, dock.island)!;
      h += `<h4>Am Kontor von ${g.islands[dock.island].name}</h4><button class="btn wide ok" id="shipUnload">⬇️ Alles ausladen</button>`;
      const loadable = GOODS.filter((gd) => l[gd.id] >= 1);
      if (loadable.length) {
        h += '<p class="sub">Einladen (je 10 t):</p><div class="loadrow">';
        for (const gd of loadable) h += `<button class="btn" data-load="${gd.id}">${gd.icon} ${Math.floor(l[gd.id])}</button>`;
        h += '</div>';
      }
    }
    if (near >= 0 && !g.kontor(HUMAN, near) && !s.path.length) {
      h += `<h4>Insel in der Nähe</h4>${this.islandHtml(near).replace('<h3>', '<h3 class="small">')}
        <button class="btn wide ok" id="shipKontor">⚓ Kontor bauen (💰100 🪵6 🔧3)</button>`;
    } else if (near < 0 && !s.path.length && !dock) h += '<p class="sub">Segle an eine Küste, um dort ein Kontor zu bauen.</p>';
    if (!this.setHtml(box, h)) return;
    $('#infoX').addEventListener('click', () => this.selectShip(null));
    document.getElementById('shipUnload')?.addEventListener('click', () => {
      const n = g.unloadAll(s);
      this.toast(n ? `${n} t ins Kontor geladen` : 'Kontor ist voll', n ? 'good' : 'bad');
      this.renderInfo();
    });
    box.querySelectorAll<HTMLElement>('[data-load]').forEach((bt) => bt.addEventListener('click', () => {
      const n = g.loadGood(s, bt.dataset.load as GoodId, 10);
      if (!n) this.toast('Kein Platz mehr im Laderaum', 'bad');
      this.renderInfo();
    }));
    document.getElementById('shipKontor')?.addEventListener('click', () => {
      this.selectShip(null);
      this.setMode({ kind: 'build', type: 'kontor', gx: 0, gy: 0, has: false });
      this.toast('Tippe auf die Küste neben dem Schiff', 'info');
    });
  }

  /** Weltkarte: entdeckte Inseln, eigene Gebiete, Schiffe – antippen springt dorthin */
  openMap() {
    const g = this.g, N = g.size;
    const m = $('#modal');
    m.classList.remove('hidden');
    m.innerHTML = `<div class="box map"><h2>Weltkarte</h2><canvas id="mapCv" width="${N * 2}" height="${N * 2}"></canvas>
      <p class="sub">Tippe auf einen Ort, um dorthin zu schauen.</p><button class="btn wide" id="mapX">Schließen</button></div>`;
    const cv = $('#mapCv') as HTMLCanvasElement;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(N * 2, N * 2);
    const col = (k: number): [number, number, number] => {
      if (!g.seen[k]) return [52, 60, 70];
      const t = g.tiles[k];
      if (g.own[k] === HUMAN && t !== 0) return [70, 120, 220];
      if (g.own[k] > 0 && t !== 0) return [200, 70, 60];
      return t === 0 ? [40, 110, 160] : t === 1 ? [220, 200, 140] : t === 3 ? [50, 110, 50] : t === 4 ? [130, 125, 115] : [110, 170, 80];
    };
    for (let y = 0; y < N * 2; y++) for (let x = 0; x < N * 2; x++) {
      const c = col(((y >> 1) * N) + (x >> 1));
      const i = (y * N * 2 + x) * 4;
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    for (const sh of g.ships) {
      if (sh.owner !== HUMAN && !g.seen[g.idx(Math.floor(sh.x), Math.floor(sh.y))]) continue;
      ctx.fillStyle = sh.owner === HUMAN ? '#ffe066' : '#ff6b5b';
      ctx.beginPath(); ctx.arc(sh.x * 2, sh.y * 2, 4, 0, Math.PI * 2); ctx.fill();
    }
    const r = this.view.rig;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(r.tx * 2 - 20, r.tz * 2 - 12, 40, 24);
    cv.addEventListener('click', (e) => {
      const rect = cv.getBoundingClientRect();
      r.tx = ((e.clientX - rect.left) / rect.width) * N;
      r.tz = ((e.clientY - rect.top) / rect.height) * N;
      this.closeModal();
    });
    $('#mapX').addEventListener('click', () => this.closeModal());
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
    // Fokus: ausgewähltes Gebäude, sonst eigene Insel unter der Kameramitte, sonst erstes Kontor
    const r = this.view.rig;
    const under = g.islandOf[g.idx(Math.min(g.size - 1, Math.max(0, Math.floor(r.tx))), Math.min(g.size - 1, Math.max(0, Math.floor(r.tz))))];
    let focus = this.selected ? this.selected.island : -1;
    if (focus < 0 && under >= 0 && g.kontor(HUMAN, under)) focus = under;
    if (focus < 0) {
      const own = g.buildings.filter((b) => b.type === 'kontor' && b.owner === HUMAN);
      own.sort((a, b) => Math.hypot(g.center(a)[0] - r.tx, g.center(a)[1] - r.tz) - Math.hypot(g.center(b)[0] - r.tx, g.center(b)[1] - r.tz));
      focus = own[0]?.island ?? -1;
    }
    g.focus = focus;
    $('#islandName').textContent = focus >= 0 ? `📍 ${g.islands[focus].name}` : '⛵ Noch kein Kontor';
    // Nur Waren zeigen, die es gibt oder die ein freigeschaltetes Gebäude herstellt/braucht
    const relevant = new Set<GoodId>(['holz', 'werkzeug', 'nahrung']);
    for (const d of Object.values(BUILDINGS)) {
      if (!d.prod || !g.isUnlocked(d.id) || !d.category) continue;
      relevant.add(d.prod.output);
      for (const k of Object.keys(d.prod.input ?? {})) relevant.add(k as GoodId);
    }
    for (const [id, e] of this.goodEls) {
      const v = g.goods[id];
      e.classList.toggle('hidden', focus < 0 || (!relevant.has(id) && v < 1));
      e.querySelector('b')!.textContent = String(Math.floor(v));
      e.classList.toggle('full', v >= g.capacity);
      e.classList.toggle('empty', v < 1);
    }
    // Baumenü: nur Kategorien mit freigeschalteten Gebäuden; vor dem ersten Kontor nichts
    const hasKontor = g.count('kontor') > 0;
    document.querySelectorAll<HTMLElement>('.cat').forEach((bt) => {
      const c = bt.dataset.cat;
      const show = hasKontor && (!c || Object.values(BUILDINGS).some((d) => d.category === c && g.isUnlocked(d.id)));
      bt.classList.toggle('hidden', !show);
    });
    if (this.selShip) this.renderInfo();
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
      <h2>Willkommen, Kapitän!</h2>
      <p>Dein Schiff ist mit Werkzeug, Holz und Nahrung an Bord in einer unbekannten Inselwelt angekommen. Die meisten Inseln liegen noch im Nebel.</p>
      <ul>
        <li><b>Segeln:</b> Schiff antippen, dann aufs Meer tippen. Unterwegs entdeckst du Inseln.</li>
        <li><b>Insel prüfen:</b> Schiff an eine Küste fahren oder Land antippen – du siehst, was dort wächst (z. B. Tabak 100 %) und ob der Berg Erz oder Gold hat.</li>
        <li><b>Kontor gründen:</b> Schiff an der Küste antippen → „Kontor bauen“ → auf die Küste tippen. Das Kontor beansprucht das Land ringsum (dein Baugebiet). Danach „Alles ausladen“.</li>
        <li><b>Karte:</b> ein Finger verschiebt, zwei Finger zoomen und drehen. 🗺️ oben zeigt die Weltkarte.</li>
        <li><b>Bauen:</b> Links erscheinen die Gebäude, sobald du sie nutzen kannst. Neue kommen mit mehr Einwohnern dazu.</li>
        <li><b>Wege 🛤️:</b> Betriebe brauchen einen Feldweg zum Kontor oder Marktplatz. Marktplätze vergrößern dein Gebiet.</li>
        <li>Tippe auf ein Gebäude, um zu sehen, was ihm fehlt. Das 📜 unten führt dich Schritt für Schritt.</ul>
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
