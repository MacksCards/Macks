// Bau-, Wege- und Abriss-Werkzeug: Baumenü-Karten, Vorschau, Hinweisleiste (oben, nicht antippbar)
// und die Knöpfe ✓ / ✕ unten rechts.
import './build.css';
import { BUILDINGS, BuildingId, CATEGORIES, Category, TIERS } from '../data';
import { HUMAN } from '../game';
import { sound } from '../audio';
import type { UI } from '../ui';
import { $, costText, el } from './util';

export type Mode =
  | { kind: 'none' }
  | { kind: 'build'; type: BuildingId; gx: number; gy: number; has: boolean }
  | { kind: 'road'; type: BuildingId }
  | { kind: 'demolish' };

/** ein zweiter Tipp auf dieselbe Stelle baut erst nach dieser Zeit (ms) – gegen Fehltipps */
const CONFIRM_MS = 500;

export class BuildTool {
  /** offene Kategorie im Baumenü */
  openCat: Category | null = null;
  roadStart: [number, number] | null = null;
  roadCells: [number, number][] = [];
  roadEndSet = false;
  /** true = es gibt keinen durchgehenden Weg zum Ziel (✓ gesperrt) */
  roadNoWay = false;
  /** true = Ziel nicht erreichbar, der Weg endet am nächsten erreichbaren Feld */
  roadPartial = false;
  /** zuletzt getipptes Wegziel (für „schon verbunden“) */
  private roadTarget: [number, number] | null = null;
  /** wann die Vorschau (Gebäude oder Wegziel) zuletzt gesetzt wurde */
  private shownAt = 0;

  constructor(private ui: UI) {}

  get catOpen() { return this.openCat !== null; }

  /** Fläche für die Baumenü-Karten (rechts neben der linken Spalte) */
  buildPanel(hud: HTMLElement) {
    hud.appendChild(el('div', 'panel hidden', '')).id = 'buildPanel';
  }

  /** Hinweistext oben (in topmid) und die Knöpfe ✓ / ✕ unten rechts */
  buildHint(hud: HTMLElement, topmid: HTMLElement) {
    const hint = el('div', 'hint hidden', `<div id="hintText"></div>`);
    hint.id = 'hint';
    topmid.appendChild(hint);
    const btns = el('div', 'hintbtns hidden', `<button id="hintOk" class="btn ok" aria-label="Bauen">✓</button><button id="hintX" class="btn" aria-label="Abbrechen">✕</button>`);
    btns.id = 'hintBtns';
    hud.appendChild(btns);
    $('#hintOk').addEventListener('click', () => { if (this.ui.mode.kind === 'road') this.confirmRoad(); else this.confirmBuild(); });
    $('#hintX').addEventListener('click', () => this.setMode({ kind: 'none' }));
  }

  // ---------- Modi ----------

  setMode(m: Mode) {
    const ui = this.ui, v = ui.view;
    ui.mode = m;
    this.roadStart = null;
    this.roadCells = [];
    this.roadEndSet = false;
    this.roadNoWay = false;
    this.roadPartial = false;
    this.roadTarget = null;
    v.setGhost(null);
    v.setRoadPreview([], []);
    const building = m.kind !== 'none';
    if (v.areaShown !== building) v.showArea(building);
    if (building) ui.select(null);
    $('#demBtn').classList.toggle('active', m.kind === 'demolish');
    $('#hint').classList.toggle('hidden', !building);
    $('#hint').classList.toggle('line', m.kind === 'road');
    $('#hintBtns').classList.toggle('hidden', !building);
    document.body.classList.toggle('building', building);
    $('#quest').classList.toggle('hidden', building);
    $('#hintOk').classList.toggle('hidden', m.kind !== 'build' && m.kind !== 'road');
    this.updateHint();
  }

  /** regelmäßig: Karten (bezahlbar?) und Bauhinweis auffrischen */
  refresh() {
    if (this.openCat) this.refreshCards();
    if (this.ui.mode.kind === 'build') this.updateHint();
  }

  updateHint() {
    const ui = this.ui, g = ui.g, m = ui.mode;
    const t = $('#hintText');
    if (m.kind === 'build') {
      const d = BUILDINGS[m.type];
      const chk = m.has ? g.canPlace(m.type, m.gx, m.gy) : g.canAfford(d.cost);
      let msg = !m.has ? 'Tippe auf die Insel, wo es stehen soll.' : chk.ok ? 'Nochmal auf dieselbe Stelle tippen oder ✓ zum Bauen.' : `⚠️ ${chk.reason}`;
      let scale = '';
      if (m.has && d.harvest) {
        // Ergiebigkeit: wie viel wächst hier nach, geteilt mit gleichartigen Betrieben in der Nähe
        const eff = g.siteEfficiency(m.type, m.gx, m.gy);
        const pct = Math.round(eff * 100);
        const col = eff < 0.4 ? '#e2553f' : eff < 0.75 ? '#e8b93a' : '#7cc95a';
        const what = { baum: 'Wald', fisch: 'Fischgründe', wild: 'Wild', weide: 'Weideland', feld: 'Ackerland' }[d.harvest.res];
        const fert = g.fertility(m.type, m.gx, m.gy);
        if (d.pflanze && fert > 0 && fert < 1) msg = `🌱 Insel nur zu ${Math.round(fert * 100)} % fruchtbar dafür. ` + msg;
        const shared = g.buildings.some((o) => o.type === m.type && Math.hypot(g.center(o)[0] - m.gx, g.center(o)[1] - m.gy) < (d.work ?? 4) * 2);
        if (eff < 0.2 && !(d.pflanze && fert <= 0)) msg = `⚠️ Hier gibt es kaum ${what} – such dir einen besseren Platz. ` + msg;
        scale = `<div class="effbar"><i style="width:${pct}%;background:${col}"></i><span>${what}: ${pct} %${shared ? ' · geteilt mit Nachbarn' : ''}</span></div>`;
      }
      if (!m.has && d.prod) msg += ' Danach mit einem Weg verbinden!';
      t.innerHTML = `<b>${d.icon} ${d.name}</b> <span class="cost">${costText(d.cost)}</span>${scale}<small>${msg}</small>`;
      ($('#hintOk') as HTMLButtonElement).disabled = !(m.has && chk.ok);
    } else if (m.kind === 'road') {
      // Wege-Hinweis: eine Zeile
      const d = BUILDINGS[m.type];
      const n = this.roadCells.length;
      const ok = n > 0 && this.roadEndSet;
      const build = ok ? this.roadBuildable() : 0;
      const isRoad = m.type === 'weg' || m.type === 'steinweg';
      // Warum geht es nicht? (Material, Gebiet, Platz) – Grund des ersten gesperrten Feldes
      const why = () => {
        for (const [cx, cy] of this.roadCells) {
          const c = isRoad ? g.canRoad(cx, cy, HUMAN, m.type as 'weg' | 'steinweg') : g.canPlace(m.type, cx, cy);
          if (!c.ok && !(isRoad && g.roads[g.idx(cx, cy)])) return c.reason ?? 'Geht hier nicht';
        }
        return 'Geht hier nicht';
      };
      const cost = build
        ? `${build} Felder · ${costText(Object.fromEntries(Object.entries(d.cost).map(([k, v]) => [k, (v ?? 0) * build])))}`
        : `${costText(d.cost)} je Feld`;
      // Gebäude und Weg (oder zwei Wegstücke) hängen schon zusammen: das melden statt „geht nicht“
      const linked = ok && isRoad && (this.roadNoWay || !build) ? this.alreadyLinked() : null;
      const msg = !this.roadStart ? `Tippe aufs Startfeld.${m.type === 'steinweg' ? ' Feldwege werden gepflastert.' : ''}`
        : !ok ? 'Tippe jetzt aufs Ziel (gelb = Start).'
        : linked ? (linked === 'haus' ? 'Schon mit dem Weg verbunden ✓ – anderes Ziel tippen.' : 'Hier liegt schon ein Weg ✓ – anderes Ziel tippen.')
        : this.roadNoWay ? 'Kein Durchgang – tippe ein anderes Ziel.'
        : build ? (this.roadPartial ? '✓ baut bis vors Hindernis – oder anderes Ziel.' : '✓ baut – oder anderes Ziel tippen.')
        : `⚠️ ${why()} – anderes Ziel tippen.`;
      // eine Zeile; die Kosten stehen hinten – wird es zu eng, werden sie zuerst gekürzt,
      // auf schmalen Bildschirmen fällt der Name weg (das Symbol bleibt), siehe build.css
      t.innerHTML = `<b>${d.icon}<span class="nm"> ${d.name}</span></b> <span class="msg">${msg}</span> <span class="cost">${cost}</span>`;
      ($('#hintOk') as HTMLButtonElement).disabled = !build;
    } else if (m.kind === 'demolish') {
      t.innerHTML = `<b>💥 Abreißen</b><small>Tippe auf ein Gebäude oder einen Weg. Du bekommst die Hälfte des Materials zurück.</small>`;
    }
  }

  // ---------- Baumenü ----------

  toggleCat(c: Category) {
    const ui = this.ui, g = ui.g;
    if (this.openCat === c) { this.closeCat(); return; }
    // Mit nur einem Weg-Typ direkt losziehen, sonst Auswahl zeigen
    if (c === 'wege' && !g.isUnlocked('steinweg')) {
      this.closeCat();
      this.setMode(ui.mode.kind === 'road' ? { kind: 'none' } : { kind: 'road', type: 'weg' });
      return;
    }
    this.openCat = c;
    sound.play('auf');
    ui.select(null);
    document.querySelectorAll('#hud .cat').forEach((b) => b.classList.toggle('active', (b as HTMLElement).dataset.cat === c));
    const p = $('#buildPanel');
    p.innerHTML = '';
    p.classList.remove('hidden');
    $('#quest').classList.add('hidden');
    // Name der Kategorie oben (in der zweispaltigen Leiste steht nur eine kurze Beschriftung)
    const cat = CATEGORIES.find((x) => x.id === c);
    if (cat) p.appendChild(el('h3', 'ptitle', `${cat.icon} ${cat.name}`));
    for (const d of Object.values(BUILDINGS)) {
      if (d.category !== c || !g.isUnlocked(d.id)) continue;
      const card = el('button', 'card', `<span class="ic">${d.icon}</span><b>${d.name}</b><small class="cost">${costText(d.cost)}</small><small class="desc">${d.desc}</small>`);
      card.dataset.type = d.id;
      card.addEventListener('click', () => {
        this.closeCat();
        this.setMode(d.paint ? { kind: 'road', type: d.id } : { kind: 'build', type: d.id, gx: 0, gy: 0, has: false });
      });
      p.appendChild(card);
    }
    const nx = g.nextUnlock(c);
    if (nx) p.appendChild(el('div', 'card next', `<span class="ic">🔒</span><b>Weitere Gebäude</b><small class="desc">ab ${nx.n} ${TIERS[nx.tier].dat} auf einer Insel (z. B. ${BUILDINGS[nx.type].icon} ${BUILDINGS[nx.type].name})</small>`));
    this.refreshCards();
  }

  private refreshCards() {
    document.querySelectorAll<HTMLElement>('#buildPanel .card[data-type]').forEach((c) => {
      const d = BUILDINGS[c.dataset.type as BuildingId];
      c.classList.toggle('poor', !this.ui.g.canAfford(d.cost).ok);
    });
  }

  closeCat() {
    if (this.openCat) sound.play('zu');
    this.openCat = null;
    $('#buildPanel').classList.add('hidden');
    $('#quest').classList.toggle('hidden', this.ui.mode.kind !== 'none');
    document.querySelectorAll('#hud .cat').forEach((b) => b.classList.remove('active'));
  }

  // ---------- Tippen im Bau-, Wege- und Abrissmodus ----------

  tap(x: number, y: number) {
    const ui = this.ui, m = ui.mode;
    if (m.kind === 'build') {
      const t = ui.view.pick(x, y, false);
      if (!t) return;
      const s = BUILDINGS[m.type].size;
      const gx = t[0] - Math.floor((s - 1) / 2), gy = t[1] - Math.floor((s - 1) / 2);
      if (m.has && gx === m.gx && gy === m.gy) {
        // zweiter Tipp auf dieselbe Stelle: erst nach 0,5 s bauen (ein Doppeltipp aus Versehen baut nicht)
        if (performance.now() - this.shownAt >= CONFIRM_MS) this.confirmBuild();
        return;
      }
      m.gx = gx; m.gy = gy; m.has = true;
      this.shownAt = performance.now();
      ui.view.setGhost(m.type, gx, gy, ui.g.canPlace(m.type, gx, gy).ok);
      this.updateHint();
      return;
    }
    if (m.kind === 'road') { this.roadTap(x, y); return; }
    if (m.kind === 'demolish') this.demolishTap(x, y);
  }

  private demolishTap(x: number, y: number) {
    const ui = this.ui, g = ui.g;
    const t = ui.view.pick(x, y, true);
    if (!t) return;
    const b = g.buildingAt(t[0], t[1]);
    if (b && b.type !== 'kontor') {
      // Gebäude nur nach Rückfrage abreißen (Wege sofort)
      const d = BUILDINGS[b.type];
      ui.ask(`${d.icon} ${d.name} abreißen?`, 'Du bekommst die Hälfte des Baumaterials zurück.', '💥 Abreißen', () => {
        g.removeBuilding(b);
        ui.toast('Abgerissen', 'info');
      });
      return;
    }
    if (g.demolish(t[0], t[1])) ui.toast('Abgerissen', 'info');
  }

  private confirmBuild() {
    const ui = this.ui, g = ui.g, m = ui.mode;
    if (m.kind !== 'build' || !m.has) return;
    const r = g.place(m.type, m.gx, m.gy);
    if (r.ok) sound.play(m.type === 'kontor' ? 'kontor' : 'bauen');
    if (!r.ok) { ui.toast(r.reason ?? 'Geht nicht', 'bad'); return; }
    if (m.type === 'kontor') { this.setMode({ kind: 'none' }); return; }
    // Vorschau bleibt aktiv für das nächste Gebäude
    m.has = false;
    ui.view.setGhost(null);
    this.updateHint();
    if (!g.canAfford(BUILDINGS[m.type].cost).ok) {
      ui.toast(`${g.canAfford(BUILDINGS[m.type].cost).reason} für ein weiteres`, 'info');
    }
  }

  // ---------- Wege per Tippen ----------

  /**
   * Hängen Start und Ziel schon über Wege zusammen? Ein Gebäude zählt über die Wegfelder an seinem Rand.
   * 'haus' = mindestens ein Ende ist ein Gebäude, 'weg' = beide Enden sind Wegfelder, null = nicht verbunden.
   */
  private alreadyLinked(): 'haus' | 'weg' | null {
    const g = this.ui.g, a = this.roadStart, b = this.roadTarget;
    if (!a || !b) return null;
    let house = false;
    const seeds = ([x, y]: [number, number]): number[] => {
      if (!g.inMap(x, y)) return [];
      const k = g.idx(x, y);
      if (g.roads[k]) return [k];
      const bd = g.buildingAt(x, y);
      if (!bd) return [];
      house = true;
      return g.ring(bd).filter(([rx, ry]) => g.inMap(rx, ry) && g.roads[g.idx(rx, ry)] > 0).map(([rx, ry]) => g.idx(rx, ry));
    };
    const from = seeds(a), to = new Set(seeds(b));
    if (!from.length || !to.size) return null;
    // Breitensuche über die Wege (begrenzt, die Suche läuft bei jedem Tipp)
    const N = g.size, seen = new Set(from), q = [...from];
    for (let i = 0; i < q.length && i < 8000; i++) {
      const k = q[i];
      if (to.has(k)) return house ? 'haus' : 'weg';
      const x = k % N, y = (k - x) / N;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!g.inMap(nx, ny)) continue;
        const nk = g.idx(nx, ny);
        if (g.roads[nk] > 0 && !seen.has(nk)) { seen.add(nk); q.push(nk); }
      }
    }
    return null;
  }

  /** freie Nachbarfelder des Gebäudes, das auf (x,y) steht */
  private freeAround(x: number, y: number, pass: (x: number, y: number) => boolean): [number, number][] {
    const g = this.ui.g;
    const b = g.buildingAt(x, y);
    if (!b) return [];
    return g.ring(b).filter(([rx, ry]) => pass(rx, ry)) as [number, number][];
  }

  /** Wege per Tippen: erstes Tippen = Start, zweites = Ziel (Vorschau), nochmal Ziel (nach 0,5 s) oder ✓ = bauen */
  roadTap(x: number, y: number) {
    const t = this.ui.view.pick(x, y, false);
    if (!t) return;
    if (!this.roadStart) {
      this.roadStart = t;
      this.roadCells = [t];
      this.roadEndSet = false;
      this.roadNoWay = false;
      sound.play('klick');
    } else {
      const end = this.roadCells[this.roadCells.length - 1];
      if (this.roadEndSet && end && end[0] === t[0] && end[1] === t[1]) {
        if (performance.now() - this.shownAt >= CONFIRM_MS) this.confirmRoad();
        return;
      }
      this.roadTarget = t;
      this.roadTo(t);
      this.roadEndSet = true;
      this.shownAt = performance.now();
      sound.play('weg');
    }
    this.previewRoad();
    this.updateHint();
  }

  /** Weg vom Start zum Ziel: um Wasser und Gebäude herum, möglichst gerade (wenige Ecken). Ohne Durchgang: L-Form */
  roadTo(t: [number, number]) {
    const ui = this.ui, g = ui.g, N = g.size;
    const [x0, y0] = this.roadStart!;
    const [x1, y1] = t;
    const type = ui.mode.kind === 'road' ? ui.mode.type : 'weg';
    const road = type === 'weg' || type === 'steinweg';
    // Wege dürfen über vorhandene Wege laufen, Mauern/Palisaden nicht
    const pass = (x: number, y: number) => g.inMap(x, y) && ((road && g.roads[g.idx(x, y)] > 0) || (road ? g.canRoad(x, y, HUMAN, type).ok : g.canPlace(type, x, y).ok));
    const pad = 12;
    const bx0 = Math.max(0, Math.min(x0, x1) - pad), by0 = Math.max(0, Math.min(y0, y1) - pad);
    const bx1 = Math.min(N - 1, Math.max(x0, x1) + pad), by1 = Math.min(N - 1, Math.max(y0, y1) + pad);
    const W = bx1 - bx0 + 1, H = by1 - by0 + 1;
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    // Zustand = Feld × Richtung; Ecken kosten etwas mehr, damit der Weg gerade bleibt
    const cost = new Float64Array(W * H * 4).fill(Infinity);
    const from = new Int32Array(W * H * 4).fill(-1);
    const id = (x: number, y: number, d: number) => ((y - by0) * W + (x - bx0)) * 4 + d;
    const open: [number, number][] = [];
    const push = (st: number, c: number) => { open.push([st, c]); };
    // Start: das Feld selbst, oder – wenn dort ein Gebäude steht – alle freien Nachbarfelder
    const starts: [number, number][] = pass(x0, y0) ? [[x0, y0]] : g.occ[g.idx(x0, y0)] ? this.freeAround(x0, y0, pass) : [];
    for (const [sx, sy] of starts) if (sx >= bx0 && sy >= by0 && sx <= bx1 && sy <= by1) for (let d = 0; d < 4; d++) { cost[id(sx, sy, d)] = 0; push(id(sx, sy, d), 0); }
    // Ziel: das Feld selbst, oder bei einem Gebäude dessen freie Nachbarfelder
    const goals = new Set<number>((pass(x1, y1) ? [[x1, y1]] : g.occ[g.idx(x1, y1)] ? this.freeAround(x1, y1, pass) : []).map(([gx, gy]) => gy * N + gx));
    let goal = -1;
    let guard = 0;
    // nächstes erreichbares Feld zum Ziel merken (falls das Ziel selbst nicht erreichbar ist)
    let near = -1, nearD = Infinity;
    const d0 = Math.hypot(x1 - x0, y1 - y0);
    while (open.length && guard++ < 60000) {
      // kleinste Kosten zuerst (einfach, Suchraum ist klein)
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][1] < open[bi][1]) bi = i;
      const [st, c] = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (c > cost[st]) continue;
      const d = st % 4, cell = (st - d) / 4, x = cell % W + bx0, y = Math.floor(cell / W) + by0;
      if (goals.has(y * N + x)) { goal = st; break; }
      const dd = Math.hypot(x1 - x, y1 - y);
      if (dd < nearD) { nearD = dd; near = st; }
      for (let nd = 0; nd < 4; nd++) {
        const nx = x + DIRS[nd][0], ny = y + DIRS[nd][1];
        if (nx < bx0 || ny < by0 || nx > bx1 || ny > by1) continue;
        if (!pass(nx, ny)) continue;
        const nc = c + 1 + (nd !== d ? 0.6 : 0) + (road && g.roads[g.idx(nx, ny)] ? -0.3 : 0);
        const ns = id(nx, ny, nd);
        if (nc < cost[ns]) { cost[ns] = nc; from[ns] = st; push(ns, nc); }
      }
    }
    this.roadPartial = false;
    if (goal < 0 && near >= 0 && nearD < d0 - 0.5) { goal = near; this.roadPartial = true; }
    if (goal >= 0) {
      const cells: [number, number][] = [];
      for (let st = goal; st >= 0; st = from[st]) { const cell = (st - (st % 4)) / 4; cells.push([cell % W + bx0, Math.floor(cell / W) + by0]); }
      cells.reverse();
      this.roadCells = cells.slice(0, 200);
      this.roadNoWay = false;
      return;
    }
    // kein Durchgang gefunden: L-Form nur als rote Vorschau – gebaut wird dann nichts
    this.roadNoWay = true;
    const cells: [number, number][] = [];
    const line = (a: number, b: number) => { const out: number[] = []; const st = Math.sign(b - a); for (let v = a; ; v += st) { out.push(v); if (v === b) break; } return out; };
    if (Math.abs(x1 - x0) >= Math.abs(y1 - y0)) {
      for (const xx of line(x0, x1)) cells.push([xx, y0]);
      for (const yy of line(y0, y1).slice(1)) cells.push([x1, yy]);
    } else {
      for (const yy of line(y0, y1)) cells.push([x0, yy]);
      for (const xx of line(x0, x1).slice(1)) cells.push([xx, y1]);
    }
    this.roadCells = cells.slice(0, 200);
  }

  /** wie viele Felder der Vorschau wirklich neu gebaut würden */
  private roadBuildable(): number {
    const ui = this.ui, g = ui.g;
    if (this.roadNoWay) return 0;
    const type = ui.mode.kind === 'road' ? ui.mode.type : 'weg';
    const road = type === 'weg' || type === 'steinweg';
    return this.roadCells.filter(([x, y]) => road ? g.canRoad(x, y, HUMAN, type).ok : g.canPlace(type, x, y).ok).length;
  }

  /** Vorschau bauen; danach geht es vom Ziel aus weiter */
  private confirmRoad() {
    const ui = this.ui, g = ui.g;
    if (ui.mode.kind !== 'road' || !this.roadEndSet || !this.roadCells.length || this.roadNoWay) return;
    const type = ui.mode.type;
    const end = this.roadCells[this.roadCells.length - 1];
    const isRoad = type === 'weg' || type === 'steinweg';
    const n = isRoad ? g.placeRoads(this.roadCells, HUMAN, type) : g.placeMany(type, this.roadCells);
    if (n) { sound.play(isRoad ? 'weg' : 'bauen'); ui.toast(`${n} ${isRoad ? 'Wegfelder' : 'Felder'} gebaut`, 'info'); }
    else ui.toast('Nichts gebaut – zu wenig Material oder kein Platz', 'bad');
    // weiterbauen: das Ziel ist der neue Start
    this.roadStart = end;
    this.roadCells = [end];
    this.roadEndSet = false;
    this.roadNoWay = false;
    this.previewRoad();
    this.updateHint();
  }

  private previewRoad() {
    const ui = this.ui, g = ui.g;
    const type = ui.mode.kind === 'road' ? ui.mode.type : 'weg';
    const ok = this.roadCells.map(([x, y]) => (type === 'weg' || type === 'steinweg')
      ? g.canRoad(x, y, HUMAN, type).ok || g.roads[g.idx(x, y)] === (type === 'steinweg' ? 2 : 1)
      : g.canPlace(type, x, y).ok);
    ui.view.setRoadPreview(this.roadCells, ok);
  }
}
