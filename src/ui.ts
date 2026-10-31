// Bedienoberfläche (HTML über dem 3D-Bild) und Steuerlogik.
import { BUILDINGS, BuildingId, CATEGORIES, Category, Cost, GOOD, GOODS, GoodId, KONTOR_LEVELS, PRICES, SHIPS, ShipType, TIERS, UNITS, UnitType } from './data';
import {
  armShip, atWar, buyProtection, canTrain, declareWar, disarmShip, makePeace, orderAttack, orderBoard, orderMove,
  defenseAdvice, peacePrice, pirateAdvice, pirates, protectionPrice, restart, shipAttack, strength, train, unloadTroops,
} from './combat';
import { Building, Game, HUMAN, QUESTS, Ship, ShotKind, Unit, newSeed } from './game';
import { PFLANZEN, Pflanze, depositText } from './world';
import { Input } from './input';
import { View } from './render/scene';
import { sound } from './audio';

type Mode =
  | { kind: 'none' }
  | { kind: 'build'; type: BuildingId; gx: number; gy: number; has: boolean }
  | { kind: 'road'; type: BuildingId }
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
  if (c.kanonen) parts.push(`${GOOD.kanonen.icon}${c.kanonen}`);
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
  private lostShown = false;
  /** ausgewählte eigene Soldaten */
  selUnits: Unit[] = [];
  relevant = new Set<GoodId>();
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
      removed: (b) => { v.removeBuilding(b); if (b.type === 'markt') v.onTerritory(); if (this.selected === b) this.select(null); if (b.owner === HUMAN) sound.play('abriss'); },
      changed: (b) => v.changedBuilding(b),
      roads: () => v.onRoadsChanged(),
      trees: () => v.onTreesChanged(),
      felled: (k) => { v.onFelled(k); if (this.g.seen[k]) sound.play('baum', { x: k % this.g.size, z: Math.floor(k / this.g.size) }); },
      seen: () => v.onSeen(),
      message: (t, k) => this.toast(t, k),
      shot: (kind, fx, fy, tx, ty, hit) => this.onShot(kind, fx, fy, tx, ty, hit),
      sunk: (s) => { v.ships.sink(s.id); if (this.visible(s.x, s.y)) sound.play('versenkt', { x: s.x, z: s.y }); if (this.selShip === s) this.selectShip(null); },
      died: (u) => { v.onUnitDied(u); if (this.visible(u.x, u.y)) sound.play('fall', { x: u.x, z: u.y }); },
    };
  }

  /** liegt ein Ort im entdeckten Gebiet? */
  private visible(x: number, y: number) {
    const k = this.g.idx(Math.floor(x), Math.floor(y));
    return k >= 0 && k < this.g.seen.length && this.g.seen[k] === 1;
  }

  private onShot(kind: ShotKind, fx: number, fy: number, tx: number, ty: number, hit: boolean) {
    if (!this.visible(fx, fy) && !this.visible(tx, ty)) return;
    this.view.fx.shot(kind, fx, fy, tx, ty, hit);
    const at = { x: fx, z: fy };
    if (kind === 'schwert') sound.play('schwert', at);
    else if (kind === 'muskete') sound.play('muskete', at);
    else sound.play('kanone', at);
  }

  setGame(g: Game) {
    this.g = g;
    this.selUnits = [];
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
    // jeder Knopf klickt hörbar
    hud.addEventListener('pointerdown', (e) => { if ((e.target as HTMLElement).closest('button')) sound.play('klick'); });
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
      let scale = '';
      if (m.has && d.harvest) {
        // Ergiebigkeit: wie viel wächst hier nach, geteilt mit gleichartigen Betrieben in der Nähe
        const eff = this.g.siteEfficiency(m.type, m.gx, m.gy);
        const pct = Math.round(eff * 100);
        const col = eff < 0.4 ? '#e2553f' : eff < 0.75 ? '#e8b93a' : '#7cc95a';
        const what = { baum: 'Wald', fisch: 'Fischgründe', wild: 'Wild', weide: 'Weideland', feld: 'Ackerland' }[d.harvest.res];
        const fert = this.g.fertility(m.type, m.gx, m.gy);
        if (d.pflanze && fert > 0 && fert < 1) msg = `🌱 Insel nur zu ${Math.round(fert * 100)} % fruchtbar dafür. ` + msg;
        const shared = this.g.buildings.some((o) => o.type === m.type && Math.hypot(this.g.center(o)[0] - m.gx, this.g.center(o)[1] - m.gy) < (d.work ?? 4) * 2);
        if (eff < 0.2 && !(d.pflanze && fert <= 0)) msg = `⚠️ Hier gibt es kaum ${what} – such dir einen besseren Platz. ` + msg;
        scale = `<div class="effbar" title="Ergiebigkeit"><i style="width:${pct}%;background:${col}"></i><span>${what}: ${pct} %${shared ? ' · geteilt mit Nachbarn' : ''}</span></div>`;
      }
      if (!m.has && d.prod) msg += ' Danach mit einem Weg verbinden!';
      t.innerHTML = `<b>${d.icon} ${d.name}</b> <span class="cost">${costText(d.cost)}</span>${scale}<small>${msg}</small>`;
      ($('#hintOk') as HTMLButtonElement).disabled = !(m.has && chk.ok);
    } else if (m.kind === 'road') {
      const d = BUILDINGS[m.type];
      t.innerHTML = `<b>${d.icon} ${d.name}</b> <span class="cost">${costText(d.cost)} je Feld</span><br><small>Mit dem Finger ziehen, um zu bauen${m.type === 'steinweg' ? ' (Feldwege werden dabei gepflastert)' : ''}. Zwei Finger bewegen die Karte.</small>`;
    } else if (m.kind === 'demolish') {
      t.innerHTML = `<b>💥 Abreißen</b><br><small>Tippe auf ein Gebäude oder einen Weg. Du bekommst die Hälfte des Materials zurück.</small>`;
    }
  }

  private toggleCat(c: Category) {
    if (this.openCat === c) { this.closeCat(); return; }
    // Mit nur einem Weg-Typ direkt losziehen, sonst Auswahl zeigen
    if (c === 'wege' && !this.g.isUnlocked('steinweg')) {
      this.closeCat();
      this.setMode(this.mode.kind === 'road' ? { kind: 'none' } : { kind: 'road', type: 'weg' });
      return;
    }
    this.openCat = c;
    sound.play('auf');
    this.select(null);
    document.querySelectorAll('.cat').forEach((b) => b.classList.toggle('active', (b as HTMLElement).dataset.cat === c));
    const p = $('#buildPanel');
    p.innerHTML = '';
    p.classList.remove('hidden');
    $('#quest').classList.add('hidden');
    for (const d of Object.values(BUILDINGS)) {
      if (d.category !== c || !this.g.isUnlocked(d.id)) continue;
      const card = el('button', 'card', `<span class="ic">${d.icon}</span><b>${d.name}</b><small class="cost">${costText(d.cost)}</small><small class="desc">${d.desc}</small>`);
      card.dataset.type = d.id;
      card.addEventListener('click', () => {
        this.closeCat();
        this.setMode(d.paint ? { kind: 'road', type: d.id } : { kind: 'build', type: d.id, gx: 0, gy: 0, has: false });
      });
      p.appendChild(card);
    }
    const nx = this.g.nextUnlock(c);
    if (nx) p.appendChild(el('div', 'card next', `<span class="ic">🔒</span><b>Weitere Gebäude</b><small class="desc">ab ${nx.n} ${TIERS[nx.tier].dat} auf einer Insel (z. B. ${BUILDINGS[nx.type].icon} ${BUILDINGS[nx.type].name})</small>`));
    this.refreshCards();
  }

  private refreshCards() {
    document.querySelectorAll<HTMLElement>('#buildPanel .card[data-type]').forEach((c) => {
      const d = BUILDINGS[c.dataset.type as BuildingId];
      c.classList.toggle('poor', !this.g.canAfford(d.cost).ok);
    });
  }

  private closeCat() {
    if (this.openCat) sound.play('zu');
    this.openCat = null;
    $('#buildPanel').classList.add('hidden');
    $('#quest').classList.toggle('hidden', this.mode.kind !== 'none');
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
    const g = this.g;
    this.selUnits = this.selUnits.filter((u) => g.units.includes(u) && u.ship === undefined);
    const sel = this.selUnits;
    // Soldat antippen
    const unit = this.view.pickUnit(x, y);
    if (unit) {
      if (unit.owner === HUMAN) { sound.play('klick'); if (!sel.includes(unit)) this.selectUnits([unit]); return; }
      if (sel.length) { this.attack(unit.owner, () => { orderAttack(g, sel, unit.id); sound.play('marsch'); this.toast(`⚔️ Angriff auf ${UNITS[unit.type].name}`, 'info'); }); return; }
      this.toast(`${UNITS[unit.type].icon} ${UNITS[unit.type].name} von ${g.players[unit.owner]?.name}`, 'info');
      return;
    }
    // Schiff antippen → auswählen / einsteigen / angreifen
    const ship = this.view.pickShip(x, y) ?? this.shipNear(x, y);
    if (ship && ship.owner === HUMAN) {
      sound.play('klick');
      if (sel.length) {
        orderBoard(g, sel, ship);
        this.toast(`🪖 Soldaten gehen an Bord der ${ship.name}`, 'info');
        this.select(null);
        return;
      }
      this.selectShip(ship); return;
    }
    if (ship) {
      const name = ship.type === 'pirat' ? 'Piratenschiff' : `Schiff von ${g.players[ship.owner]?.name}`;
      if (this.selShip && (this.selShip.guns ?? 0) > 0) { const me = this.selShip; this.attack(ship.owner, () => { shipAttack(g, me, ship.id); sound.play('glocke'); this.toast(`💣 Angriff auf ${name}`, 'info'); }); return; }
      if (this.selShip) { this.toast('Dein Schiff hat keine Kanonen – lade sie am Kontor', 'bad'); return; }
      const kan = sel.filter((u) => u.type === 'kanonier');
      if (kan.length) { this.attack(ship.owner, () => orderAttack(g, kan, ship.id)); return; }
      this.toast(`⛵ ${name}`, 'info');
      return;
    }
    const t = this.view.pick(x, y, true);
    const b = t ? this.g.buildingAt(t[0], t[1]) : undefined;
    // Soldaten ausgewählt: angreifen oder hinlaufen
    if (sel.length && t) {
      if (b && b.owner !== HUMAN) {
        this.attack(b.owner, () => { orderAttack(g, sel, b.id); sound.play('marsch'); this.toast(`⚔️ Angriff auf ${BUILDINGS[b.type].name}`, 'info'); });
        return;
      }
      const gt = this.view.pick(x, y, false) ?? t;
      if (g.tiles[g.idx(gt[0], gt[1])] !== 0) {
        const n = orderMove(g, sel, gt[0] + 0.5, gt[1] + 0.5);
        if (n) sound.play('marsch'); else this.toast('Dorthin kommen die Soldaten nicht', 'bad');
        return;
      }
    }
    // bewaffnetes Schiff ausgewählt + fremdes Gebäude → beschießen
    if (this.selShip && b && b.owner !== HUMAN && (this.selShip.guns ?? 0) > 0) {
      const me = this.selShip;
      this.attack(b.owner, () => { shipAttack(g, me, b.id); sound.play('glocke'); this.toast(`💣 ${me.name} greift ${BUILDINGS[b.type].name} an`, 'info'); });
      return;
    }
    // Schiff ausgewählt + aufs Meer getippt → hinsegeln
    if (this.selShip && !b) {
      const gt = this.view.pick(x, y, false);
      if (gt && this.g.tiles[this.g.idx(gt[0], gt[1])] === 0) {
        if (this.g.moveShip(this.selShip, gt[0] + 0.5, gt[1] + 0.5)) { this.toast('⛵ Kurs gesetzt', 'info'); sound.play('glocke'); }
        else this.toast('Dorthin findet das Schiff keinen Weg', 'bad');
        return;
      }
    }
    if (b) { sound.play('klick'); this.select(b); return; }
    // Land einer entdeckten Insel → Inselinfo
    if (t) {
      const k = this.g.idx(t[0], t[1]);
      const isl = this.g.islandOf[k];
      if (isl >= 0 && this.g.seen[k] && !this.g.area[k]) { this.select(null); this.islandInfo = isl; this.renderInfo(); return; }
    }
    this.select(null);
  }

  /** Schiff in Fingernähe (auch fremde) */
  private shipNear(x: number, y: number): Ship | undefined {
    const t = this.view.pick(x, y, false);
    if (!t) return undefined;
    let best: Ship | undefined, bd = 1.8;
    for (const s of this.g.ships) {
      if (s.owner !== HUMAN && !this.visible(s.x, s.y)) continue;
      const d = Math.hypot(s.x - t[0] - 0.5, s.y - t[1] - 0.5);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  /** Angriff – herrscht noch Frieden, vorher fragen */
  private attack(owner: number, go: () => void) {
    const g = this.g, p = g.players[owner];
    if (!p || owner === HUMAN) return;
    if (atWar(g, HUMAN, owner)) { go(); return; }
    if (p.pirate) {
      this.ask('🏴‍☠️ Die Piraten angreifen?', 'Dein gekaufter Schutz endet damit sofort.', '⚔️ Angreifen', () => { g.players[HUMAN].protectedUntil = 0; go(); });
      return;
    }
    this.ask(`⚔️ Krieg gegen ${p.name}?`, 'Mit diesem Gegner herrscht Frieden. Ein Angriff bedeutet Krieg – dann greifen dich auch dessen Soldaten, Türme und Schiffe an.', '⚔️ Krieg erklären', () => { declareWar(g, HUMAN, owner); go(); });
  }

  selectUnits(list: Unit[]) {
    this.select(null);
    this.selUnits = list;
    this.view.units.selected = new Set(list.map((u) => u.id));
    this.renderInfo();
    if (list.length) this.keepLeft(list[0].x, list[0].y);
  }

  /** Kamera so verschieben, dass ein Punkt links vom Infofenster liegt (rechts davon wäre er verdeckt) */
  private keepLeft(x: number, y: number) {
    const v = this.view, cam = v.camera;
    const p = cam.position.clone().set(x, 0.3, y).project(cam);
    if (p.x < -0.15) return;
    // Bildschirm-Rechts auf den Boden projiziert
    const e = cam.matrixWorld.elements;
    const rx = e[0], rz = e[2], len = Math.hypot(rx, rz) || 1;
    const shift = (p.x + 0.35) * v.rig.dist * 0.45;
    v.rig.tx += (rx / len) * shift;
    v.rig.tz += (rz / len) * shift;
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
    if (r.ok) sound.play(m.type === 'kontor' ? 'kontor' : 'bauen');
    if (!r.ok) { this.toast(r.reason ?? 'Geht nicht', 'bad'); return; }
    if (m.type === 'kontor') { this.setMode({ kind: 'none' }); return; }
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
    if (cells.length !== this.roadCells.length) sound.play('weg');
    this.roadCells = cells.slice(0, 200);
    this.previewRoad();
  }

  private previewRoad() {
    const type = this.mode.kind === 'road' ? this.mode.type : 'weg';
    const ok = this.roadCells.map(([x, y]) => (type === 'weg' || type === 'steinweg')
      ? this.g.canRoad(x, y, HUMAN, type).ok || this.g.roads[this.g.idx(x, y)] === (type === 'steinweg' ? 2 : 1)
      : this.g.canPlace(type, x, y).ok);
    this.view.setRoadPreview(this.roadCells, ok);
  }

  private roadEnd(cancel: boolean) {
    if (!cancel && this.roadCells.length) {
      const type = this.mode.kind === 'road' ? this.mode.type : 'weg';
      const n = type === 'weg' || type === 'steinweg' ? this.g.placeRoads(this.roadCells, HUMAN, type) : this.g.placeMany(type, this.roadCells);
      if (n > 1) this.toast(`${n} Wegfelder gebaut`, 'info');
      if (n) sound.play(type === 'weg' || type === 'steinweg' ? 'weg' : 'bauen');
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
    if (this.selUnits.length) { this.selUnits = []; this.view.units.selected = new Set(); }
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
    if (this.selUnits.length) { this.selUnits = this.selUnits.filter((u) => this.g.units.includes(u) && u.ship === undefined); if (!this.selUnits.length) this.view.units.selected = new Set(); }
    if (!b && !this.showStorage && !this.selShip && this.islandInfo === null && !this.selUnits.length) { box.classList.add('hidden'); document.body.classList.remove('info-open'); return; }
    box.classList.remove('hidden');
    const g = this.g;
    let h = `<button class="close btn sq" id="infoX">✕</button>`;
    if (this.selShip) { this.renderShip(box, h); return; }
    box.classList.toggle('slim', this.selUnits.length > 0);
    document.body.classList.add('info-open');
    if (this.selUnits.length) { this.renderUnits(box, h); return; }
    if (this.islandInfo !== null) { if (!this.setHtml(box, h + this.islandHtml(this.islandInfo))) return; $('#infoX').addEventListener('click', () => this.select(null)); return; }
    if (b && b.owner !== HUMAN) {
      const pl = g.players[b.owner];
      h += `<h3>${BUILDINGS[b.type].icon} ${BUILDINGS[b.type].name}</h3><p class="sub">Gehört ${pl?.name ?? 'jemand anderem'}.</p>`;
      if (b.type === 'haus') h += `<div class="row"><span>Bewohner</span><b>${b.residents}</b></div>`;
      h += this.hpHtml(b.hp ?? g.maxHp(b), g.maxHp(b));
      h += `<p class="sub">${atWar(g, HUMAN, b.owner) ? '⚔️ Ihr seid im Krieg.' : '🕊️ Ihr habt Frieden.'} Wähle Soldaten oder ein Schiff mit Kanonen und tippe hierher, um anzugreifen.${b.type === 'kontor' || b.type === 'markt' ? ' Fällt es, während deine Soldaten daneben stehen, gehört es dir – mit dem Land ringsum.' : ''}</p>`;
      if (this.setHtml(box, h)) $('#infoX').addEventListener('click', () => this.select(null));
      return;
    }
    if (this.showStorage || (b && b.type === 'kontor')) {
      const inc = g.incomePerMinute();
      const pt = g.popByTier();
      h += `<h3>${b ? '⚓ Kontor' : '📦 Lager & Bilanz'}</h3>
        <p class="sub">Lagerplatz: ${g.capacity} je Ware</p>`;
      if (b && b.owner === HUMAN) {
        const nl = KONTOR_LEVELS[(b.level ?? 0) + 1];
        h += `<p class="sub">Kontor ${['I', 'II', 'III', 'IV'][b.level ?? 0]}</p>`;
        if (nl) {
          const locked = nl.unlock && !g.reached(nl.unlock);
          h += locked ? `<p class="sub">🔒 Ausbau ab ${nl.unlock!.n} ${TIERS[nl.unlock!.tier].dat}</p>`
            : `<button class="btn wide ok" id="kUp">⬆️ Ausbauen: Lager ${nl.storage} t (${costText(nl.cost)})</button>`;
        }
        h += `<h4>Freier Händler</h4><p class="sub">Kaufen/verkaufen je 5 t (Preis je Tonne).</p>`;
        for (const gd of GOODS) {
          const pr = PRICES[gd.id];
          if (!pr || (!this.relevant.has(gd.id) && g.goods[gd.id] < 1)) continue;
          h += `<div class="trade"><span>${gd.icon} ${gd.name}</span><button class="btn" data-buy="${gd.id}">+5 · ${pr.kaufen}</button><button class="btn" data-sell="${gd.id}">−5 · ${pr.verkaufen}</button></div>`;
        }
      }
      h += `<h4>Lager</h4><div class="grid">`;
      for (const gd of GOODS) {
        const v = g.goods[gd.id];
        if (!this.relevant.has(gd.id) && v < 1) continue;
        h += `<div class="row ${v >= g.capacity ? 'warn' : ''}"><span>${gd.icon} ${gd.name}</span><b>${fmt(v)}</b></div>`;
      }
      h += `</div><h4>Bilanz pro Minute</h4>
        <div class="row"><span>Steuern</span><b class="pos">+${fmt(inc.tax)}</b></div>
        <div class="row"><span>Unterhalt</span><b class="neg">−${fmt(inc.upkeep)}</b></div>
        <h4>Einwohner</h4>`;
      TIERS.forEach((t, i) => { h += `<div class="row"><span>${t.name}</span><b>${pt[i]}</b></div>`; });
      if (!this.setHtml(box, h)) return;
      document.getElementById('kUp')?.addEventListener('click', () => {
        const res = g.kontorUpgrade(b!);
        this.toast(res.ok ? 'Kontor ausgebaut – mehr Lagerplatz!' : res.reason ?? '', res.ok ? 'good' : 'bad');
        this.renderInfo();
      });
      box.querySelectorAll<HTMLElement>('[data-buy],[data-sell]').forEach((bt) => bt.addEventListener('click', () => {
        const gid = (bt.dataset.buy ?? bt.dataset.sell) as GoodId;
        const n = g.trade(HUMAN, b!.island, gid, bt.dataset.buy ? 5 : -5);
        if (n) sound.play('muenzen');
        if (!n) this.toast(bt.dataset.buy ? 'Nicht genug Taler oder Lager voll' : 'Nichts zum Verkaufen da', 'bad');
        this.renderInfo();
      }));
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
        h += `<h4>Aufstieg zu ${next.name}</h4><p class="sub">${block ? '⏳ ' + block : '⬆️ Steigt gerade auf …'}</p>`;
        const l = g.goods;
        for (const grp of tier.next?.goods ?? []) {
          const ok = grp.some((x) => l[x] >= 1);
          h += `<div class="row"><span>${grp.map((x) => `${GOOD[x].icon} ${GOOD[x].name}`).join(' oder ')} im Lager</span><b>${ok ? '✅' : '❌'}</b></div>`;
        }
        for (const sv of tier.next?.services ?? []) {
          const unl = g.isUnlocked(sv);
          h += `<div class="row"><span>${BUILDINGS[sv].icon} ${BUILDINGS[sv].name} in der Nähe${unl ? '' : ` <small>(ab ${BUILDINGS[sv].unlock!.n} ${TIERS[BUILDINGS[sv].unlock!.tier].dat})</small>`}</span><b>${cov.has(sv) ? '✅' : '❌'}</b></div>`;
        }
        h += `<p class="sub">Baumaterial: ${costText(next.upgradeCost)}</p>`;
      } else h += `<p class="sub">🏆 Höchste Stufe erreicht</p>`;
      h += `<p class="sub">Steuern: ${(b.residents * tier.tax * (0.4 + 0.6 * b.happy)).toFixed(1)} Taler/Min</p>`;
    } else {
      h += `<h3>${d.icon} ${d.name}</h3><p class="sub">${d.desc}</p>`;
      if (d.prod) {
        const st: Record<string, string> = {
          ok: '✅ Arbeitet', keinWeg: '🚧 Kein Weg zum Kontor oder Marktplatz', lagerVoll: '📦 Voll – wartet auf den Marktkarren (Weg + Reichweite von Kontor/Marktplatz?)',
          keinWald: '🌲 Kein Wald in der Nähe', keinWasser: '🌊 Kein Wasser in der Nähe',
          erschoepft: d.deposit ? '⛏️ Das Vorkommen ist erschöpft' : ({ baum: '🌲 Keine erntereifen Bäume – Setzlinge wachsen nach', fisch: '🐟 Fischgründe leergefischt – erholen sich', wild: '🦌 Kein Wild mehr – kommt langsam zurück', weide: '🌿 Weide abgegrast – wächst nach', feld: '🌾 Felder erschöpft – wachsen nach' } as Record<string, string>)[d.harvest?.res ?? 'baum'],
          rohstoff: `⚠️ Es fehlt: ${b.missing.map((m) => GOOD[m].name).join(', ')}`,
        };
        const inp = Object.entries(d.prod.input ?? {}).map(([k, n]) => `${n} ${GOOD[k as GoodId].icon}`).join(' + ');
        h += `<div class="row"><span>Status</span><b>${st[b.status] ?? ''}</b></div>
          <div class="row"><span>Produziert</span><b>${inp ? inp + ' → ' : ''}${d.prod.amount ?? 1} ${GOOD[d.prod.output].icon} ${GOOD[d.prod.output].name} / ${Math.round(d.prod.time / Math.max(0.05, b.eff))} s</b></div>
          <div class="row"><span>${d.harvest ? 'Ergiebigkeit' : 'Standort'}</span><b>${Math.round(b.eff * 100)} %</b></div>
          ${d.harvest ? `<div class="bar"><i style="width:${Math.round(b.eff * 100)}%;background:${b.eff < 0.4 ? '#e2553f' : b.eff < 0.75 ? '#e8b93a' : '#7cc95a'}"></i></div>` : ''}
          <div class="row"><span>Im Betrieb gelagert</span><b>${Math.floor(b.stock)} / ${d.stock ?? 4} t</b></div>
          <div class="row"><span>Auslastung</span><b>${Math.round(b.active * 100)} %</b></div>
          <div class="bar"><i style="width:${Math.round((b.progress / d.prod.time) * 100)}%"></i></div>`;
      }
      if (d.work && d.prod) h += `<div class="row"><span>Arbeitsradius</span><b>${d.work} Felder</b></div>`;
      else if (d.radius) h += `<div class="row"><span>Reichweite</span><b>${d.radius} Felder</b></div>`;
      if (d.storage) h += `<div class="row"><span>Lager</span><b>+${d.storage} je Ware</b></div>`;
      if (d.tower) h += `<div class="row"><span>🎯 Schießt auf Feinde</span><b>${d.tower.range} Felder</b></div>`;
      if (d.trains) h += this.trainHtml(b);
      if (b.type === 'werft' || b.type === 'grosswerft') {
        if (b.job) {
          const sd = SHIPS[b.job.ship];
          h += `<h4>Im Bau: ${sd.name}</h4><div class="bar"><i style="width:${Math.round((b.job.t / sd.time) * 100)}%"></i></div>`;
        } else {
          h += `<h4>Schiff bauen</h4>`;
          for (const [id, sd] of Object.entries(SHIPS) as [ShipType, typeof SHIPS[ShipType]][]) {
            if (sd.build === false) continue;
            if (sd.werft === 'grosswerft' && b.type !== 'grosswerft') continue;
            const chk = g.canOrderShip(b, id);
            h += `<button class="btn wide ${chk.ok ? 'ok' : ''}" data-ship="${id}">⛵ ${sd.name}<br><small>${sd.slots} Laderäume · Tempo ${Math.round(sd.speed * 100)} % · bis ${sd.kanonen} Kanonen · 💰${sd.cost.taler} 🪵${sd.cost.holz} 🧵${sd.cost.stoff}${''}${chk.ok ? '' : ` – ${chk.reason}`}</small></button>`;
          }
        }
      }
    }
    if (b.hp !== undefined) h += this.hpHtml(b.hp, g.maxHp(b));
    h += `<div class="row"><span>Unterhalt</span><b>${d.upkeep} Taler/Min</b></div>`;
    if (b.type !== 'kontor') h += `<button class="btn danger" id="infoDel">💥 Abreißen</button>`;
    if (!this.setHtml(box, h)) return;
    $('#infoX').addEventListener('click', () => this.select(null));
    box.querySelectorAll<HTMLElement>('[data-train]').forEach((bt) => bt.addEventListener('click', () => {
      const res = train(g, b, bt.dataset.train as UnitType);
      if (res.ok) sound.play('marsch'); else this.toast(res.reason ?? '', 'bad');
      this.renderInfo();
    }));
    box.querySelectorAll<HTMLElement>('[data-ship]').forEach((bt) => bt.addEventListener('click', () => {
      const res = g.orderShip(b, bt.dataset.ship as ShipType);
      this.toast(res.ok ? 'Die Werft beginnt mit dem Bau.' : res.reason ?? '', res.ok ? 'good' : 'bad');
      this.renderInfo();
    }));
    document.getElementById('infoDel')?.addEventListener('click', () => {
      this.ask(`${d.icon} ${d.name} abreißen?`, 'Du bekommst die Hälfte des Baumaterials zurück.', '💥 Abreißen', () => {
        g.removeBuilding(b);
        this.select(null);
      });
    });
  }

  private hpHtml(hp: number, max: number): string {
    const f = Math.max(0, Math.min(1, hp / max));
    const pc = Math.round(f * 10) * 10;
    return `<div class="row"><span>❤️ Zustand</span><b>${pc} %</b></div><div class="bar"><i style="width:${pc}%;background:${f > 0.6 ? '#7cc95a' : f > 0.3 ? '#e8b93a' : '#e2553f'}"></i></div>`;
  }

  /** Burg: Ausbildung (nur freigeschaltete Soldaten, dazu ein Hinweis auf den nächsten) */
  private trainHtml(b: Building): string {
    const g = this.g, d = BUILDINGS[b.type].trains!;
    const l = g.lagerOf(HUMAN, b.island);
    let h = `<h4>Ausbildung (${b.train?.length ?? 0} von ${d.slots})</h4>`;
    for (const j of b.train ?? []) h += `<div class="row"><span>${UNITS[j.type].icon} ${UNITS[j.type].name}</span><b>${Math.ceil(j.t)} s</b></div><div class="bar"><i style="width:${Math.round((1 - j.t / d.time) * 10) * 10}%"></i></div>`;
    const locked = (Object.values(UNITS)).filter((ud) => !g.reached(ud.unlock)).sort((a, b) => a.unlock.tier - b.unlock.tier || a.unlock.n - b.unlock.n)[0];
    for (const [id, ud] of Object.entries(UNITS) as [UnitType, typeof UNITS[UnitType]][]) {
      if (!g.reached(ud.unlock)) continue;
      const chk = canTrain(g, b, id);
      const cost = Object.entries(ud.cost).map(([k, n]) => `${GOOD[k as GoodId].icon}${n} (da: ${Math.floor(l?.[k as GoodId] ?? 0)})`).join(' ');
      h += `<button class="btn wide ${chk.ok ? 'ok' : ''}" data-train="${id}">${ud.icon} ${ud.name} ausbilden<br><small>${cost} · ❤️${ud.hp} · ${ud.range > 2 ? `Reichweite ${ud.range}` : 'Nahkampf'} · ${ud.upkeep} Taler/Min${chk.ok ? '' : ` – ${chk.reason}`}</small></button>`;
    }
    if (locked) h += `<p class="sub">🔒 ${locked.icon} ${locked.plural} ab ${locked.unlock.n} ${TIERS[locked.unlock.tier].dat}</p>`;
    const mine = g.units.filter((u) => u.owner === HUMAN).length;
    if (mine) h += `<p class="sub">Du hast ${mine === 1 ? 'einen Soldaten' : `${mine} Soldaten`}. Tippe einen an, um ihn zu führen.</p>`;
    return h;
  }

  private renderUnits(box: HTMLElement, head: string) {
    const g = this.g, list = this.selUnits;
    const by = new Map<UnitType, number>();
    let hp = 0, max = 0, fighting = 0, walking = 0;
    for (const u of list) {
      by.set(u.type, (by.get(u.type) ?? 0) + 1);
      hp += u.hp; max += UNITS[u.type].hp;
      if (u.target !== undefined) fighting++; else if (u.path.length || u.board !== undefined) walking++;
    }
    const one = list.length === 1 ? UNITS[list[0].type] : null;
    let h = head + `<h3>${one ? `${one.icon} ${one.name}` : `⚔️ ${list.length} Soldaten`}</h3>`;
    if (one) h += `<p class="sub">${one.desc}</p>`;
    else for (const [t, n] of by) h += `<div class="row"><span>${UNITS[t].icon} ${UNITS[t].plural}</span><b>${n}</b></div>`;
    h += this.hpHtml(hp, max);
    h += `<div class="row"><span>Lage</span><b>${fighting ? '⚔️ kämpft' : walking ? '🚶 unterwegs' : '🛡️ wartet'}</b></div>`;
    h += `<p class="sub">Tippe aufs Land, um hinzulaufen · auf Feinde, um anzugreifen · auf dein Schiff, um einzusteigen.</p>`;
    const near = g.units.filter((u) => u.owner === HUMAN && u.ship === undefined && !list.includes(u) && Math.hypot(u.x - list[0].x, u.y - list[0].y) < 10).length;
    h += `<div class="row2">${near ? `<button class="btn ok" id="uAll">👥 +${near} in der Nähe</button>` : ''}<button class="btn" id="uStop">✋ Halt</button></div>`;
    if (!this.setHtml(box, h)) return;
    $('#infoX').addEventListener('click', () => this.select(null));
    document.getElementById('uAll')?.addEventListener('click', () => {
      const add = g.units.filter((u) => u.owner === HUMAN && u.ship === undefined && Math.hypot(u.x - list[0].x, u.y - list[0].y) < 10);
      this.selectUnits([...new Set([...list, ...add])]);
    });
    $('#uStop').addEventListener('click', () => { for (const u of list) { u.path = []; u.target = undefined; u.ordered = false; u.board = undefined; } this.renderInfo(); });
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
    const canFound = near >= 0 && !g.kontor(HUMAN, near) && !s.path.length;
    let h = head + `<h3>⛵ ${s.name}</h3><p class="sub">${SHIPS[s.type ?? 'handel_klein'].name}</p><p class="sub">${s.path.length ? 'Unterwegs …' : 'Liegt vor Anker'} – tippe aufs Meer, um hinzusegeln.</p>`;
    if (canFound) h += `<button class="btn wide ok" id="shipKontor">⚓ Kontor auf ${g.islands[near].name} bauen (💰100 🪵6 🔧3)</button>`;
    const sd = SHIPS[s.type ?? 'handel_klein'];
    h += this.hpHtml(s.hp ?? sd.hp, sd.hp);
    if ((s.hp ?? sd.hp) < sd.hp) {
      const atWerft = g.buildings.some((b) => (b.type === 'werft' || b.type === 'grosswerft') && b.owner === HUMAN && Math.hypot(g.center(b)[0] - s.x, g.center(b)[1] - s.y) < 7);
      h += `<p class="sub">🔧 ${atWerft ? 'Wird an deiner Werft ausgebessert (braucht Holz im Lager).' : 'Fahre zu deiner Werft, um das Schiff auszubessern.'}</p>`;
    }
    h += `<div class="row"><span>💣 Kanonen</span><b>${s.guns ?? 0} / ${sd.kanonen}</b></div>`;
    if (s.guns) h += `<p class="sub">Tippe auf ein feindliches Schiff oder Gebäude, um es zu beschießen.</p>`;
    const tr = s.troops?.length ?? 0;
    if (tr || g.reached(UNITS.infanterie.unlock)) h += `<div class="row"><span>🪖 Soldaten an Bord</span><b>${tr} / ${sd.troops}</b></div>`;
    if (tr && near >= 0 && !s.path.length) h += `<button class="btn wide ok" id="shipLand">🪖 Soldaten an Land setzen</button>`;
    if (dock) {
      const kl = g.lagerOf(HUMAN, dock.island)!;
      if ((s.guns ?? 0) < sd.kanonen && kl.kanonen >= 1) h += `<button class="btn wide ok" id="shipArm">💣 Bewaffnen (${Math.min(sd.kanonen - (s.guns ?? 0), Math.floor(kl.kanonen))} Kanonen aus dem Lager)</button>`;
      else if ((s.guns ?? 0) < sd.kanonen && g.isUnlocked('kanonengiesserei')) h += `<p class="sub">Kanonen kommen aus der Kanonengießerei ins Lager.</p>`;
      if (s.guns) h += `<button class="btn wide" id="shipDisarm">Kanonen ins Lager zurück</button>`;
    }
    h += `<h4>Laderaum</h4><div class="slots">`;
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
    if (canFound) h += `<h4>Insel in der Nähe</h4>${this.islandHtml(near).replace('<h3>', '<h3 class="small">')}`; else if (near < 0 && !s.path.length && !dock) h += '<p class="sub">Segle an eine Küste, um dort ein Kontor zu bauen.</p>';
    if (!this.setHtml(box, h)) return;
    $('#infoX').addEventListener('click', () => this.selectShip(null));
    document.getElementById('shipUnload')?.addEventListener('click', () => {
      const n = g.unloadAll(s);
      if (n > 0) sound.play('kisten');
      const left = s.slots.reduce((a, sl) => a + sl.n, 0);
      this.toast(n ? `${n} t ins Kontor geladen${left ? ` – ${left} t bleiben an Bord (Lager voll, 30 t je Ware)` : ''}` : 'Kontor ist voll (30 t je Ware)', n ? 'good' : 'bad');
      this.renderInfo();
    });
    box.querySelectorAll<HTMLElement>('[data-load]').forEach((bt) => bt.addEventListener('click', () => {
      const n = g.loadGood(s, bt.dataset.load as GoodId, 10);
      if (n > 0) sound.play('kisten');
      if (!n) this.toast('Kein Platz mehr im Laderaum', 'bad');
      this.renderInfo();
    }));
    document.getElementById('shipArm')?.addEventListener('click', () => { const n = armShip(g, s); if (n) { sound.play('kisten'); this.toast(n === 1 ? '💣 Eine Kanone geladen' : `💣 ${n} Kanonen geladen`, 'good'); } this.renderInfo(); });
    document.getElementById('shipDisarm')?.addEventListener('click', () => { disarmShip(g, s); sound.play('kisten'); this.renderInfo(); });
    document.getElementById('shipLand')?.addEventListener('click', () => {
      const n = unloadTroops(g, s);
      this.toast(n ? (n === 1 ? '🪖 Ein Soldat an Land' : `🪖 ${n} Soldaten an Land`) : 'Hier ist kein Platz an der Küste', n ? 'good' : 'bad');
      if (n) sound.play('marsch');
      this.renderInfo();
    });
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
      if (g.own[k] > 0 && t !== 0) { const c = g.players[g.own[k]]?.color ?? 0xc8463b; return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; }
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
    const relevant = this.relevant;
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
    document.querySelectorAll<HTMLElement>('.cat').forEach((bt) => {
      const c = bt.dataset.cat;
      const show = hasKontor && (!c || Object.values(BUILDINGS).some((d) => d.category === c && g.isUnlocked(d.id)));
      bt.classList.toggle('hidden', !show);
    });
    if (this.selShip || this.selUnits.length) this.renderInfo();
    // Niederlage: festes Fenster
    if (g.players[HUMAN].defeated && !this.lostShown) { this.lostShown = true; this.showLost(); }
    if (!g.players[HUMAN].defeated) this.lostShown = false;
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
    // passendes Geräusch zur Meldung
    if (/freigeschaltet/i.test(text)) sound.play('freischalten');
    else if (/eingezogen/.test(text)) sound.play('aufstieg');
    else if (/Aufgabe erledigt|ausgebaut/.test(text)) sound.play('muenzen');
    else if (/Stapel/.test(text)) sound.play('horn');
    else if (/^⚠️/.test(text) || /^⚔️ (Angriff|Dein Schiff|.* erklärt dir)/.test(text) || /Piraten gesichtet/.test(text)) sound.play('alarm');
    else if (/^(⚔️|💣) /.test(text)) { /* Befehl – eigener Klang */ }
    else if (/ausgebildet/.test(text)) sound.play('marsch');
    else if (/erobert!|besiegt|versenkt!/.test(text) && kind === 'good') sound.play('aufstieg');
    else if (kind === 'bad') sound.play('fehler');
    else if (kind === 'good' || /Kontor auf/.test(text)) sound.play('nachricht');
    const box = $('#toasts');
    const t = el('div', `toast ${kind}`, text);
    box.appendChild(t);
    // höchstens 3 Meldungen; wichtige (Warnungen, Krieg) bleiben am längsten stehen
    t.dataset.important = kind === 'bad' && /^(⚠️|⚔️ .* erklärt dir|🚩|🏴‍☠️)|verloren/.test(text) ? '1' : '';
    while (box.children.length > 3) {
      const kids = Array.from(box.children) as HTMLElement[];
      (kids.find((c) => !c.dataset.important && c !== t) ?? kids[0]).remove();
    }
    // wichtige oder lange Meldungen länger zeigen
    const ms = /^(⚠️|⚔️ .* erklärt dir|🚩|🏴‍☠️)|verloren/.test(text) ? 7500 : Math.min(6000, 2600 + Math.max(0, text.length - 40) * 45);
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 500);
  }

  // ---------- Menü ----------

  openMenu() {
    const m = $('#modal');
    m.classList.remove('hidden');
    m.innerHTML = `<div class="box">
      <h2>⚓ Neue Ufer</h2>
      <button class="btn wide" id="mResume">▶️ Weiterspielen</button>
      <button class="btn wide" id="mSave">💾 Speichern</button>
      ${this.g.players.some((p) => p.id !== HUMAN && (p.pirate ? this.g.pirateSeen : this.met(p.id))) ? '<button class="btn wide" id="mDipl">🤝 Krieg &amp; Frieden</button>' : ''}
      <div class="row2"><button class="btn" id="mTon">${sound.soundOn ? '🔊 Ton an' : '🔇 Ton aus'}</button><button class="btn" id="mMusik">${sound.musicOn ? '🎵 Musik an' : '🔕 Musik aus'}</button></div>
      <button class="btn wide" id="mHelp">❓ Anleitung</button>
      <button class="btn wide danger" id="mNew">🏝️ Neues Spiel (neue Inselwelt)</button>
      <p class="sub">Das Spiel speichert automatisch.</p></div>`;
    $('#mResume').addEventListener('click', () => this.closeModal());
    $('#mSave').addEventListener('click', () => {
      const ok = this.g.save();
      this.toast(ok ? 'Gespeichert ✔' : 'Speichern nicht möglich (privater Modus?)', ok ? 'good' : 'bad');
      this.closeModal();
    });
    $('#mHelp').addEventListener('click', () => this.openHelp());
    document.getElementById('mDipl')?.addEventListener('click', () => this.openDiplomacy());
    $('#mTon').addEventListener('click', () => { sound.setSound(!sound.soundOn); this.openMenu(); });
    $('#mMusik').addEventListener('click', () => { sound.setMusic(!sound.musicOn); this.openMenu(); });
    $('#mNew').addEventListener('click', () => {
      const m2 = $('#modal');
      m2.innerHTML = `<div class="box"><h2>Neues Spiel</h2><p class="sub">Eine neue Inselwelt. Dein aktuelles Spiel geht verloren.</p>
        <p>Wie viele Konkurrenten sollen mitspielen?</p>
        <div class="row2">${[0, 1, 2, 3].map((n) => `<button class="btn ${n === 2 ? 'ok' : ''}" data-opp="${n}">${n}</button>`).join('')}</div>
        <button class="btn wide" id="newX">Abbrechen</button></div>`;
      $('#newX').addEventListener('click', () => this.closeModal());
      m2.querySelectorAll<HTMLElement>('[data-opp]').forEach((bt) => bt.addEventListener('click', () => {
        Game.clearSave();
        this.onNewGame(Game.create(newSeed(), Number(bt.dataset.opp)));
        this.closeModal();
        this.toast('Eine neue Inselwelt wartet auf dich!', 'good');
      }));
    });
  }

  /** Gegner, die man schon getroffen hat (Gebäude oder Schiff im entdeckten Gebiet) oder mit denen Krieg herrscht */
  private met(id: number): boolean {
    const g = this.g;
    if (atWar(g, HUMAN, id)) return true;
    return g.buildings.some((b) => b.owner === id && g.seen[g.idx(b.x, b.y)] === 1) || g.ships.some((s) => s.owner === id && this.visible(s.x, s.y));
  }

  private showLost() {
    const m = $('#modal');
    m.classList.remove('hidden');
    m.innerHTML = `<div class="box"><h2>🏳️ Spiel verloren</h2><p class="sub">Du hast keine Gebäude und keine Schiffe mehr.</p>
      <button class="btn wide ok" id="lostGo">⛵ Mit einem neuen Schiff weiterspielen</button>
      <button class="btn wide danger" id="lostNew">🏝️ Neues Spiel</button></div>`;
    $('#lostGo').addEventListener('click', () => { restart(this.g); this.closeModal(); });
    $('#lostNew').addEventListener('click', () => { Game.clearSave(); this.onNewGame(Game.create(newSeed(), Math.max(0, this.g.players.filter((p) => p.ai).length))); this.closeModal(); });
  }

  /** Krieg und Frieden mit den Konkurrenten, Schutz vor Piraten */
  openDiplomacy() {
    const g = this.g, m = $('#modal');
    m.classList.remove('hidden');
    const me = strength(g, HUMAN);
    let h = `<div class="box"><h2>🤝 Krieg &amp; Frieden</h2><p class="sub">Deine Streitmacht: ${me}</p>`;
    for (const p of g.players) {
      if (p.id === HUMAN || p.pirate || !this.met(p.id)) continue;
      const war = atWar(g, HUMAN, p.id);
      const col = '#' + p.color.toString(16).padStart(6, '0');
      h += `<div class="row"><span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${col}"></i> ${p.name}${p.defeated ? ' – besiegt' : ''}</span><b>${p.defeated ? '🏳️' : war ? '⚔️ Krieg' : '🕊️ Frieden'}</b></div>`;
      if (!war && !p.defeated && p.warnAt !== undefined) h += `<p class="sub">⚠️ Rüstet zum Krieg – noch ${Math.max(1, Math.ceil((p.warnAt - g.time) / 60))} Min. ${defenseAdvice(g)}</p>`;
      if (p.defeated) continue;
      h += `<p class="sub">Streitmacht: ${strength(g, p.id)}</p>`;
      if (war) {
        const price = peacePrice(g, p.id);
        h += `<button class="btn wide ok" data-peace="${p.id}">🕊️ Frieden anbieten${price ? ` (💰${price} Entschädigung)` : ' – wird angenommen'}</button>`;
      } else h += `<button class="btn wide danger" data-war="${p.id}">⚔️ Krieg erklären</button>`;
    }
    const pir = pirates(g);
    if (pir && g.pirateSeen) {
      const prot = (g.players[HUMAN].protectedUntil ?? 0) - g.time;
      h += `<h4>🏴‍☠️ Piraten</h4><p class="sub">${prot > 0 ? `Du hast Schutz gekauft – noch ${Math.ceil(prot / 60)} Minuten.` : `Sie überfallen Schiffe und beschießen schlecht bewachte Küsten. ${pirateAdvice(g).replace(' (Menü ☰)', '')}`}</p>`;
      if (prot <= 0) h += `<button class="btn wide" id="dProt">💰 Schutz kaufen (${protectionPrice(g)} Taler, 20 Minuten)</button>`;
    }
    h += `<button class="btn wide" id="dX">Schließen</button></div>`;
    m.innerHTML = h;
    $('#dX').addEventListener('click', () => this.closeModal());
    m.querySelectorAll<HTMLElement>('[data-war]').forEach((bt) => bt.addEventListener('click', () => {
      const id = Number(bt.dataset.war);
      this.ask(`⚔️ Krieg gegen ${g.players[id].name}?`, 'Dann greifen dich die Soldaten, Türme und Schiffe dieses Gegners an.', '⚔️ Krieg erklären', () => { declareWar(g, HUMAN, id); sound.play('alarm'); this.openDiplomacy(); });
    }));
    m.querySelectorAll<HTMLElement>('[data-peace]').forEach((bt) => bt.addEventListener('click', () => {
      const id = Number(bt.dataset.peace), price = peacePrice(g, id);
      if (g.players[HUMAN].money < price) { this.toast('Zu wenig Taler für die Entschädigung', 'bad'); return; }
      g.players[HUMAN].money -= price;
      g.players[id].money += price;
      makePeace(g, HUMAN, id);
      this.toast(`🕊️ Frieden mit ${g.players[id].name}`, 'good');
      this.openDiplomacy();
    }));
    document.getElementById('dProt')?.addEventListener('click', () => {
      const r = buyProtection(g);
      this.toast(r.ok ? '🏴‍☠️ Die Piraten lassen dich 20 Minuten in Ruhe' : r.reason ?? '', r.ok ? 'good' : 'bad');
      if (r.ok) sound.play('muenzen');
      this.openDiplomacy();
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
        <li>Tippe auf ein Gebäude, um zu sehen, was ihm fehlt. Das 📜 unten führt dich Schritt für Schritt.</li>
        ${this.g.isUnlocked('burg') || this.g.units.some((u) => u.owner === HUMAN) || this.g.players.some((p) => !p.pirate && atWar(this.g, HUMAN, p.id)) ? `<li><b>Kampf ⚔️:</b> In der Burg bildest du Soldaten aus (Waffen aus dem Lager). Soldat antippen → aufs Land tippen = hinlaufen, auf Feinde tippen = angreifen, auf dein Schiff tippen = einsteigen. „+ in der Nähe“ wählt mehrere aus.</li>
        <li><b>Eroberung:</b> Fällt das Kontor oder ein Marktplatz des Gegners, während deine Soldaten daneben stehen, gehört es dir – samt Land und Häusern ringsum.</li>
        <li><b>Seeschlacht:</b> Kanonen am Kontor aufs Schiff laden („Bewaffnen“), dann ein feindliches Schiff antippen. Beschädigte Schiffe werden an deiner Werft ausgebessert.</li>
        <li><b>Krieg &amp; Frieden:</b> im Menü ☰.</li>` : ''}
        ${this.g.pirateSeen ? `<li><b>Piraten 🏴‍☠️</b> überfallen Schiffe – ${pirateAdvice(this.g)}</li>` : ''}
        <li>🔇 Kein Ton? Den Stummschalter am iPhone prüfen.</li></ul>
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
    if (!$('#modal').classList.contains('hidden')) sound.play('zu');
    $('#modal').classList.add('hidden');
  }
}
