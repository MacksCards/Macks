// Bau-, Wege- und Abriss-Werkzeug: Baumenü-Karten, Vorschau, Hinweisleiste (oben, nicht antippbar)
// und die Knöpfe ✓ / ✕ unten rechts.
import './build.css';
import { BUILDINGS, BuildingId, CATEGORIES, Category, TIERS } from '../data';
import { HUMAN } from '../game';
import { T } from '../world';
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
/** so viele Knickpunkte darf ein geplanter Weg haben */
const MAX_VIAS = 8;
/** so viele Felder baut ein Weg höchstens auf einmal */
const MAX_CELLS = 200;

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
  /** Knickpunkte: der Weg läuft vom Start über diese Felder zum Ziel (per Ziehpunkt gesetzt) */
  roadVias: [number, number][] = [];
  /** true = der geplante Weg ist länger als MAX_CELLS (✓ gesperrt) */
  roadTooLong = false;
  /** frühere Stände der Planung (Knicke + Ziel) für ↶ */
  private roadHist: { vias: [number, number][]; target: [number, number] }[] = [];
  /** Tipp, der etwas wegnimmt (Knick entfernen, neues Ziel): wartet kurz, ob ein Doppeltipp (Zoom) daraus wird */
  private pending: { timer: number; fn: () => void } | null = null;
  /** schon erklärt: Tipp auf Mitte, Fähnchen, Start */
  private told = new Set<string>();
  /** Ziehpunkte auf der Vorschau: Mitte je Wegstück (seg = Nummer des Stücks), Knickpunkte (i), Ziel */
  private handles: { kind: 'start' | 'mid' | 'via' | 'end'; x: number; y: number; seg: number; i: number }[] = [];
  /** gerade gezogener Ziehpunkt; px = wo der Finger aufsetzte, undo = Stand vor dem Ziehen */
  private drag: {
    kind: 'start' | 'mid' | 'via' | 'end'; seg: number; via: number; moved: boolean; at: [number, number]; px: [number, number];
    undo: { vias: [number, number][]; target: [number, number] | null };
  } | null = null;
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
    const btns = el('div', 'hintbtns hidden', `<button id="roadUndo" class="btn hidden" aria-label="Letzten Schritt zurücknehmen">↶</button><button id="hintOk" class="btn ok" aria-label="Bauen">✓</button><button id="hintX" class="btn" aria-label="Abbrechen">✕</button>`);
    btns.id = 'hintBtns';
    hud.appendChild(btns);
    $('#hintOk').addEventListener('click', () => { if (this.ui.mode.kind === 'road') this.confirmRoad(); else this.confirmBuild(); });
    // ✕ im Wege-Werkzeug mit angefangenem Plan: erst nur den Plan verwerfen (neuer Start), beim zweiten Mal beenden
    $('#hintX').addEventListener('click', () => {
      const m = this.ui.mode;
      if (m.kind === 'road' && this.roadStart) { this.setMode({ kind: 'road', type: m.type }); sound.play('klick'); }
      else this.setMode({ kind: 'none' });
    });
    $('#roadUndo').addEventListener('click', () => this.undoRoad());
  }

  // ---------- Modi ----------

  setMode(m: Mode) {
    const ui = this.ui, v = ui.view;
    this.cancelPendingTap();
    ui.mode = m;
    this.roadStart = null;
    this.roadCells = [];
    this.roadEndSet = false;
    this.roadNoWay = false;
    this.roadPartial = false;
    this.roadTarget = null;
    this.roadVias = [];
    this.roadTooLong = false;
    this.roadHist = [];
    this.drag = null;
    this.handles = [];
    v.setGhost(null);
    v.setRoadPreview([], []);
    v.setRoadHandles([]);
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
    $('#roadUndo').classList.add('hidden');
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
        return null;
      };
      const cost = build
        ? `${build} ${build === 1 ? 'Feld' : 'Felder'} · ${costText(Object.fromEntries(Object.entries(d.cost).map(([k, v]) => [k, (v ?? 0) * build])))}`
        : `${costText(d.cost)} je Feld`;
      // Gebäude und Weg (oder zwei Wegstücke) hängen schon zusammen: das melden statt „geht nicht“
      // sichtbare Zeichen (weit herausgezoomt fallen weiße Kreise weg bzw. liegen Zeichen aufeinander)
      const rh = ui.view.roadHandles;
      const mids = rh.shownMids > 0, crowded = rh.crowded;
      this.hintState = `${mids}|${crowded}`;
      const lack = ok && !build ? why() : null;
      const linked = ok && isRoad && (this.roadNoWay || !build) && !(lack && /^Zu wenig/.test(lack)) ? this.alreadyLinked() : null;
      const msg = !this.roadStart ? `Tippe aufs Startfeld.${m.type === 'steinweg' ? ' Feldwege werden gepflastert.' : ''}`
        : !ok ? 'Tippe jetzt aufs Ziel.'
        : this.roadTooLong ? `Zu lang – höchstens ${MAX_CELLS} Felder auf einmal. Näheres Ziel tippen.`
        : linked ? (linked === 'haus' ? 'Schon mit dem Weg verbunden ✓ – anderes Ziel tippen.' : 'Hier liegt schon ein Weg ✓ – anderes Ziel tippen.')
        : this.roadNoWay ? (!this.roadTarget || !this.endOk(this.roadTarget) ? 'Hier kann der Weg nicht enden – anderes Ziel tippen.'
          : crowded ? 'Kein Durchgang – näher heranzoomen und Kreis ziehen.'
          : mids ? 'Kein Durchgang – weißen Kreis ziehen führt drumherum.' : 'Kein Durchgang – tippe ein anderes Ziel.')
        : build ? (this.roadPartial ? '✓ baut bis vors Hindernis – oder anderes Ziel.'
          : crowded ? '✓ baut · zum Biegen näher heranzoomen.'
          : this.roadVias.length ? '✓ baut · Kreise ziehen biegt, goldenen antippen = Knick weg.'
          : mids ? `✓ baut · weißen Kreis ziehen biegt ${isRoad ? 'den Weg' : 'die Reihe'}.`
          : '✓ baut · Fähnchen ziehen verschiebt das Ziel.')
        : why() ? (/^Zu wenig/.test(why()!) ? `⚠️ ${why()} – erst sammeln, dann ✓.` : `⚠️ ${why()} – anderes Ziel tippen.`) : 'Hier liegt schon ein Weg ✓ – anderes Ziel tippen.';
      // eine Zeile; die Kosten stehen hinten – wird es zu eng, werden sie zuerst gekürzt,
      // auf schmalen Bildschirmen fällt der Name weg (das Symbol bleibt), siehe build.css
      t.innerHTML = `<b>${d.icon}<span class="nm"> ${d.name}</span></b> <span class="msg">${msg}</span> <span class="cost">${cost}</span>`;
      ($('#hintOk') as HTMLButtonElement).disabled = !build;
      $('#roadUndo').classList.toggle('hidden', !this.roadHist.length);
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

  /** Wege per Tippen: erstes Tippen = Start, zweites = Ziel (Vorschau), ✓ = bauen (ein Tipp baut nie) */
  roadTap(x: number, y: number) {
    // jeder Tipp wartet kurz: wird ein Doppeltipp (Zoom) daraus, ändert sich am Plan nichts
    // Feld und Zeichen gleich jetzt bestimmen (verschiebt man danach die Karte, gilt trotzdem das getippte Feld)
    const onStart = !!this.roadStart && this.handles[this.ui.view.roadHandleAt(x, y)]?.kind === 'start';
    const t = this.ui.view.pick(x, y, false);
    this.later(() => this.roadTapNow(t, onStart));
  }

  private roadTapNow(t: [number, number] | null, onStart: boolean) {
    // Tipp auf das Start-Zeichen: nur erklären (sonst würde der Start zum Ziel und der Plan schrumpft auf ein Feld)
    if (onStart && this.roadStart) { this.tell('start'); return; }
    if (!t) return;
    if (!this.roadStart) {
      // nur dort anfangen, wo auch ein Weg liegen kann (oder an einem Gebäude mit freiem Rand)
      if (!this.endOk(t)) {
        const m = this.ui.mode, g = this.ui.g;
        const c = m.kind === 'road' && (m.type === 'weg' || m.type === 'steinweg') ? g.canRoad(t[0], t[1], HUMAN, m.type) : g.canPlace(m.kind === 'road' ? m.type : 'weg', t[0], t[1]);
        this.ui.toast(`Hier kann der Weg nicht anfangen${c.reason ? ` (${c.reason})` : ''}.`, 'bad');
        return;
      }
      this.roadStart = t;
      this.roadCells = [t];
      this.roadEndSet = false;
      this.roadNoWay = false;
      this.roadTooLong = false;
      this.roadVias = [];
      this.roadHist = [];
      sound.play('klick');
    } else {
      const end = this.roadCells[this.roadCells.length - 1];
      // dasselbe Ziel nochmal: nichts ändern (gebaut wird nur mit ✓, Knicke bleiben)
      const tg = this.roadTarget, g = this.ui.g;
      const sameHouse = tg && g.occ[g.idx(t[0], t[1])] && g.buildingAt(t[0], t[1]) === g.buildingAt(tg[0], tg[1]);
      if (this.roadEndSet && ((end && end[0] === t[0] && end[1] === t[1]) || (tg && tg[0] === t[0] && tg[1] === t[1]) || sameHouse)) {
        this.tell('end');
        return;
      }
      const apply = () => {
        // neues Ziel = neuer Weg (Knickpunkte fallen weg – mit ↶ kommt der alte Plan zurück)
        this.remember();
        this.roadVias = [];
        this.roadTarget = t;
        this.roadTo(t);
        this.roadEndSet = true;
        this.shownAt = performance.now();
        sound.play('weg');
        this.previewRoad();
        this.updateHint();
      };
      apply();
      return;
    }
    this.previewRoad();
    this.updateHint();
  }

  /** kann der Weg hier anfangen oder enden? (Feld begehbar oder Gebäude mit freiem Rand) */
  private endOk(t: [number, number]): boolean {
    const g = this.ui.g;
    if (this.passable(t[0], t[1])) return true;
    return !!g.occ[g.idx(t[0], t[1])] && this.freeAround(t[0], t[1], (a, b) => this.passable(a, b)).length > 0;
  }

  /** Tipp kurz zurückhalten (Doppeltipp-Zeit); ein Doppeltipp verwirft ihn */
  private later(fn: () => void) {
    this.flushPendingTap();
    const p = { timer: 0, fn };
    p.timer = window.setTimeout(() => { if (this.pending === p) { this.pending = null; if (this.ui.mode.kind === 'road') fn(); } }, 360);
    this.pending = p;
  }

  /** zurückgehaltenen Tipp verwerfen (bei Doppeltipp und Moduswechsel) */
  cancelPendingTap() {
    if (this.pending) { clearTimeout(this.pending.timer); this.pending = null; }
  }

  /** zurückgehaltenen Tipp sofort ausführen (vor ✓, ↶ und dem nächsten Ziehen – sonst gälte noch der alte Stand) */
  private flushPendingTap() {
    const p = this.pending;
    if (!p) return;
    clearTimeout(p.timer);
    this.pending = null;
    if (this.ui.mode.kind === 'road') p.fn();
  }

  /** Weg vom Start über die Knickpunkte zum Ziel; jedes Stück um Wasser und Gebäude herum, möglichst gerade */
  roadTo(t: [number, number]) {
    const pts: [number, number][] = [this.roadStart!, ...this.roadVias, t];
    const cells: [number, number][] = [];
    /** wo jedes Wegstück in cells anfängt und endet (für die Mittel-Griffe) */
    const segs: [number, number][] = [];
    let noWay = false, partial = false;
    let lastCell: [number, number] | undefined;
    for (let i = 0; i + 1 < pts.length; i++) {
      // schon belegte Felder meiden: sonst läuft der Weg zum Knickpunkt hin und auf derselben Spur zurück
      const used = new Set(cells.map(([x, y]) => y * this.ui.g.size + x));
      const r = this.segment(pts[i], pts[i + 1], used);
      const last = i + 2 === pts.length;
      if (r.noWay || (r.partial && !last)) noWay = true;
      if (r.partial && last) partial = true;
      if (last) lastCell = r.cells[r.cells.length - 1];
      const a = cells.length;
      // jedes Feld nur einmal (sonst würde es doppelt bezahlt)
      for (const c of r.cells) if (!used.has(c[1] * this.ui.g.size + c[0])) { used.add(c[1] * this.ui.g.size + c[0]); cells.push(c); }
      segs.push([Math.max(0, a - 1), cells.length - 1]);
    }
    // das Ende des letzten Stücks bleibt immer das letzte Feld (gelb markiert, dort geht es nach ✓ weiter) –
    // auch wenn ein Knickpunkt hinter dem Ziel liegt und das Feld schon früher vorkam
    if (lastCell) {
      const k = cells.findIndex((c) => c[0] === lastCell![0] && c[1] === lastCell![1]);
      if (k >= 0 && k < cells.length - 1) { cells.splice(k, 1); cells.push(lastCell); }
    }
    // zu lang: nichts abschneiden (sonst endet der Weg irgendwo mitten auf der Strecke), sondern ✓ sperren
    this.roadTooLong = cells.length > MAX_CELLS;
    this.roadCells = cells;
    this.roadNoWay = noWay;
    this.roadPartial = !noWay && partial;
    this.roadSegs = segs;
  }

  /** Grenzen der Wegstücke in roadCells (von – bis) */
  private roadSegs: [number, number][] = [];

  /**
   * darf der Weg über dieses Feld laufen? (vorhandene Wege ja, Mauern/Palisaden nicht)
   * Geld und Material zählen hier nicht – sonst hieße es bei leerer Kasse „kein Durchgang“; den echten Grund
   * („Zu wenig Taler“) nennt der Hinweis, und ✓ bleibt gesperrt.
   */
  private passable(x: number, y: number): boolean {
    const ui = this.ui, g = ui.g;
    if (!g.inMap(x, y)) return false;
    const type = ui.mode.kind === 'road' ? ui.mode.type : 'weg';
    const k = g.idx(x, y), t = g.tiles[k];
    const ground = t !== T.Wasser && t !== T.Berg && !g.occ[k] && g.own[k] === HUMAN;
    if (type === 'weg' || type === 'steinweg') {
      if (g.roads[k] > 0) return true;
      const c = g.canRoad(x, y, HUMAN, type);
      return c.ok || (ground && /^Zu wenig/.test(c.reason ?? ''));
    }
    const c = g.canPlace(type, x, y);
    return c.ok || (ground && !g.roads[k] && !!g.seen[k] && /^Zu wenig/.test(c.reason ?? ''));
  }

  /** ein Wegstück von a nach b: um Wasser und Gebäude herum, möglichst gerade (wenige Ecken). Ohne Durchgang: L-Form */
  private segment(a: [number, number], t: [number, number], used?: Set<number>): { cells: [number, number][]; noWay: boolean; partial: boolean } {
    const ui = this.ui, g = ui.g, N = g.size;
    const [x0, y0] = a;
    const [x1, y1] = t;
    const type = ui.mode.kind === 'road' ? ui.mode.type : 'weg';
    const road = type === 'weg' || type === 'steinweg';
    const pass = (x: number, y: number) => this.passable(x, y);
    const pad = 12;
    const bx0 = Math.max(0, Math.min(x0, x1) - pad), by0 = Math.max(0, Math.min(y0, y1) - pad);
    const bx1 = Math.min(N - 1, Math.max(x0, x1) + pad), by1 = Math.min(N - 1, Math.max(y0, y1) + pad);
    const W = bx1 - bx0 + 1, H = by1 - by0 + 1;
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    // Zustand = Feld × Richtung; Ecken kosten etwas mehr, damit der Weg gerade bleibt
    const cost = new Float64Array(W * H * 4).fill(Infinity);
    const from = new Int32Array(W * H * 4).fill(-1);
    const id = (x: number, y: number, d: number) => ((y - by0) * W + (x - bx0)) * 4 + d;
    // Warteliste als Haufen (kleinste Kosten oben): schnell genug, um beim Ziehen jedes Mal neu zu rechnen
    const hs: number[] = [], hc: number[] = [];
    const push = (st: number, c: number) => {
      let i = hs.length; hs.push(st); hc.push(c);
      while (i > 0) { const p = (i - 1) >> 1; if (hc[p] <= hc[i]) break; [hs[p], hs[i]] = [hs[i], hs[p]]; [hc[p], hc[i]] = [hc[i], hc[p]]; i = p; }
    };
    const pop = (): [number, number] => {
      const top: [number, number] = [hs[0], hc[0]];
      const ls = hs.pop()!, lc = hc.pop()!;
      if (hs.length) {
        hs[0] = ls; hc[0] = lc;
        for (let i = 0; ;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < hs.length && hc[l] < hc[m]) m = l;
          if (r < hs.length && hc[r] < hc[m]) m = r;
          if (m === i) break;
          [hs[m], hs[i]] = [hs[i], hs[m]]; [hc[m], hc[i]] = [hc[i], hc[m]]; i = m;
        }
      }
      return top;
    };
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
    while (hs.length && guard++ < 60000) {
      const [st, c] = pop();
      if (c > cost[st]) continue;
      const d = st % 4, cell = (st - d) / 4, x = cell % W + bx0, y = Math.floor(cell / W) + by0;
      if (goals.has(y * N + x)) { goal = st; break; }
      const dd = Math.hypot(x1 - x, y1 - y);
      if (dd < nearD) { nearD = dd; near = st; }
      for (let nd = 0; nd < 4; nd++) {
        const nx = x + DIRS[nd][0], ny = y + DIRS[nd][1];
        if (nx < bx0 || ny < by0 || nx > bx1 || ny > by1) continue;
        if (!pass(nx, ny)) continue;
        const nc = c + 1 + (nd !== d ? 0.6 : 0) + (road && g.roads[g.idx(nx, ny)] ? -0.3 : 0) + (used?.has(ny * N + nx) ? 3 : 0);
        const ns = id(nx, ny, nd);
        if (nc < cost[ns]) { cost[ns] = nc; from[ns] = st; push(ns, nc); }
      }
    }
    let partial = false;
    if (goal < 0 && near >= 0 && nearD < d0 - 0.5) { goal = near; partial = true; }
    if (goal >= 0) {
      const cells: [number, number][] = [];
      for (let st = goal; st >= 0; st = from[st]) { const cell = (st - (st % 4)) / 4; cells.push([cell % W + bx0, Math.floor(cell / W) + by0]); }
      cells.reverse();
      return { cells, noWay: false, partial };
    }
    // kein Durchgang gefunden: L-Form nur als rote Vorschau – gebaut wird dann nichts
    const cells: [number, number][] = [];
    const line = (a: number, b: number) => { const out: number[] = []; const st = Math.sign(b - a); for (let v = a; ; v += st) { out.push(v); if (v === b) break; } return out; };
    if (Math.abs(x1 - x0) >= Math.abs(y1 - y0)) {
      for (const xx of line(x0, x1)) cells.push([xx, y0]);
      for (const yy of line(y0, y1).slice(1)) cells.push([x1, yy]);
    } else {
      for (const yy of line(y0, y1)) cells.push([x0, yy]);
      for (const xx of line(x0, x1).slice(1)) cells.push([xx, y1]);
    }
    return { cells, noWay: true, partial: false };
  }

  /** wie viele Felder der Vorschau wirklich neu gebaut würden */
  private roadBuildable(): number {
    const ui = this.ui, g = ui.g;
    if (this.roadNoWay || this.roadTooLong) return 0;
    const type = ui.mode.kind === 'road' ? ui.mode.type : 'weg';
    const road = type === 'weg' || type === 'steinweg';
    return this.roadCells.filter(([x, y]) => road ? g.canRoad(x, y, HUMAN, type).ok : g.canPlace(type, x, y).ok).length;
  }

  /** Vorschau bauen; danach geht es vom Ziel aus weiter */
  private confirmRoad() {
    const ui = this.ui, g = ui.g;
    // ein eben getippter Wunsch (neues Ziel, Knick weg) gilt vor dem Bauen
    this.flushPendingTap();
    if (ui.mode.kind !== 'road' || !this.roadEndSet || !this.roadCells.length || this.roadNoWay || this.roadTooLong) return;
    // ein laufendes Ziehen (zweiter Finger auf ✓) endet hier
    this.drag = null;
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
    this.roadPartial = false;
    this.roadTooLong = false;
    this.roadTarget = null;
    this.roadVias = [];
    this.roadHist = [];
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
    this.makeHandles();
  }

  // ---------- Ziehpunkte: Weg biegen ----------

  /** Ziehpunkte neu anlegen: Start (Zeichen), Mitte jedes längeren Wegstücks, jeder Knickpunkt, Ziel (Fähnchen) */
  private makeHandles() {
    const hs: typeof this.handles = [];
    const ui = this.ui;
    if (ui.mode.kind === 'road' && this.roadStart) {
      hs.push({ kind: 'start', x: this.roadStart[0], y: this.roadStart[1], seg: -1, i: -1 });
      if (this.roadEndSet && this.roadTarget) {
        const cells = this.roadCells;
        // Mittel-Griffe auch bei „kein Durchgang“: gerade dann hilft ein Knick um das Hindernis herum.
        // Kurze Stücke bekommen keinen (sonst liegen die Kreise aufeinander), höchstens MAX_VIAS Knicke
        if (this.roadVias.length < MAX_VIAS) this.roadSegs.forEach(([a, b], seg) => {
          if (b - a < 4) return;
          const c = cells[Math.min(cells.length - 1, Math.round((a + b) / 2))];
          if (c) hs.push({ kind: 'mid', x: c[0], y: c[1], seg, i: -1 });
        });
        this.roadVias.forEach((v, i) => hs.push({ kind: 'via', x: v[0], y: v[1], seg: -1, i }));
        const t = this.roadTarget;
        hs.push({ kind: 'end', x: t[0], y: t[1], seg: -1, i: -1 });
      }
    }
    this.handles = hs;
    const d = this.drag;
    const active = !d ? -1 : hs.findIndex((h) => d.kind === 'end' ? h.kind === 'end' : d.via >= 0 ? h.kind === 'via' && h.i === d.via : h.kind === 'mid' && h.seg === d.seg);
    ui.view.setRoadHandles(hs, active);
  }

  /** zuletzt im Hinweis berücksichtigte Sichtbarkeit der Zeichen */
  private hintState = '';

  /** nach jeder Kamerabewegung: hat sich geändert, welche Zeichen zu sehen sind? Dann Hinweis neu */
  cameraMoved() {
    if (this.ui.mode.kind !== 'road' || !this.roadEndSet) return;
    this.ui.view.refreshRoadHandles();
    const rh = this.ui.view.roadHandles;
    if (`${rh.shownMids > 0}|${rh.crowded}` !== this.hintState) this.updateHint();
  }

  /** einmal kurz erklären, was ein Zeichen tut (beim ersten Antippen) */
  private tell(what: 'mid' | 'end' | 'start') {
    if (this.told.has(what)) return;
    this.told.add(what);
    this.ui.toast({
      mid: 'Halte den weißen Kreis fest und zieh ihn dorthin, wo der Weg langlaufen soll.',
      end: 'Das Fähnchen ist das Ziel – ziehen verschiebt es. Gebaut wird mit ✓.',
      start: 'Hier beginnt der Weg. Anderer Start: ✕ verwirft den Plan.',
    }[what], 'info');
  }

  /** Stand vor einer Änderung merken (für ↶) */
  private remember() {
    if (!this.roadTarget || !this.roadEndSet) return;
    this.roadHist.push({ vias: this.roadVias.map((v) => [v[0], v[1]] as [number, number]), target: [this.roadTarget[0], this.roadTarget[1]] });
    if (this.roadHist.length > 30) this.roadHist.shift();
  }

  /** ↶: letzten Schritt der Planung zurücknehmen (Knick, Ziel verschoben, neues Ziel) */
  undoRoad() {
    this.flushPendingTap();
    const h = this.roadHist.pop();
    if (!h || this.ui.mode.kind !== 'road' || !this.roadStart) return;
    this.drag = null;
    this.roadVias = h.vias;
    this.roadTarget = h.target;
    this.roadEndSet = true;
    this.roadTo(h.target);
    sound.play('klick');
    this.previewRoad();
    this.updateHint();
  }

  /** liegt der Finger auf einem Ziehpunkt? (dann zieht er den Punkt statt die Karte zu verschieben) */
  wantsDrag(x: number, y: number): boolean {
    // offenes Baumenü: ein Tipp schließt erst das Menü (wie überall auf der Karte)
    if (this.catOpen) return false;
    if (this.ui.mode.kind !== 'road' || !this.handles.length) return false;
    // der Start ist nur ein Zeichen: dort verschiebt ein Wisch die Karte wie überall
    const h = this.handles[this.ui.view.roadHandleAt(x, y)];
    return !!h && h.kind !== 'start';
  }

  dragStart(x: number, y: number) {
    // (ein wartender Tipp wird erst beim Ziehen ausgeführt – sonst käme ein Doppeltipp auf einen Kreis zu spät)
    this.grab(x, y);
  }

  /** den Zeichen unter (x, y) zum Ziehen greifen */
  private grab(x: number, y: number) {
    const i = this.ui.view.roadHandleAt(x, y);
    const h = this.handles[i];
    if (!h) { this.drag = null; return; }
    // Stand merken: wird die Geste abgebrochen (z. B. zweiter Finger zum Zoomen), kommt er zurück
    this.drag = {
      kind: h.kind, seg: h.seg, via: h.kind === 'via' ? h.i : -1, moved: false, at: [h.x, h.y], px: [x, y],
      undo: { vias: this.roadVias.map((v) => [v[0], v[1]] as [number, number]), target: this.roadTarget },
    };
  }

  dragMove(x: number, y: number) {
    // ein eben getippter Wunsch gilt, bevor gezogen wird; danach den Kreis neu greifen (Nummern können sich verschoben haben)
    if (this.pending && this.drag && !this.drag.moved) { const p = this.drag.px; this.flushPendingTap(); this.grab(p[0], p[1]); }
    const d = this.drag;
    if (!d || d.kind === 'start' || !this.roadStart || !this.roadTarget || !this.roadEndSet) return;
    const t = this.ui.view.pick(x, y, false);
    if (!t || (t[0] === d.at[0] && t[1] === d.at[1])) return;
    // Knickpunkte nur auf Felder, über die der Weg laufen kann (sonst bleibt der Punkt stehen)
    if (d.kind !== 'end' && !this.passable(t[0], t[1])) return;
    if (!d.moved) sound.play('klick');
    d.at = t;
    d.moved = true;
    if (d.kind === 'end') {
      this.roadTarget = t;
    } else if (d.via < 0) {
      // Mittel-Griff gezogen: hier entsteht ein neuer Knickpunkt
      this.roadVias.splice(d.seg, 0, t);
      d.via = d.seg;
    } else {
      this.roadVias[d.via] = t;
    }
    this.roadTo(this.roadTarget);
    this.previewRoad();
    this.updateHint();
  }

  /** Finger los: gezogen = fertig; abgebrochen = alter Stand; getippt = je nach Zeichen (nie bauen, nie alles löschen) */
  dragEnd(cancel: boolean, tap: boolean) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (cancel) {
      if (d.moved) { this.roadVias = d.undo.vias; this.roadTarget = d.undo.target; if (this.roadTarget) this.roadTo(this.roadTarget); }
    } else if (d.moved) {
      if (d.undo.target && this.roadEndSet) this.roadHist.push({ vias: d.undo.vias, target: d.undo.target });
      sound.play('weg');
      this.shownAt = performance.now();
    } else if (tap) {
      // ein Tipp zählt nach dem getroffenen Zeichen – nicht nach dem Feld darunter (der Kreis ist größer als ein Feld)
      if (d.kind === 'via' && d.via >= 0) {
        // Knickpunkt antippen = genau diesen Knick entfernen (kurz gewartet: ein Doppeltipp zoomt nur)
        const v = this.roadVias[d.via];
        this.later(() => {
          const i = this.roadVias.indexOf(v);
          if (i < 0 || !this.roadEndSet) return;
          this.remember();
          this.roadVias.splice(i, 1);
          if (this.roadTarget) this.roadTo(this.roadTarget);
          sound.play('klick');
          this.previewRoad();
          this.updateHint();
        });
        return;
      } else {
        this.tell(d.kind === 'via' ? 'mid' : d.kind);
        return;
      }
    }
    this.previewRoad();
    this.updateHint();
  }
}
