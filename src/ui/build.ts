// Bau-, Wege- und Abriss-Werkzeug: Baumenü-Karten, Vorschau, Hinweisleiste (oben, nicht antippbar)
// und die Knöpfe unten rechts (✓ / ✕ und ein Zusatzknopf wie „Ziel ändern“ oder „⬚ Bereich“).
// Dazu (Paket U4): Rückgängig nach dem Bauen, Häuserfeld (Ecke 1 und Ecke 2 tippen), Abriss-Bereich,
// Rahmen um Soldaten und Schiffe, Patrouillen-Ziel, „NEU“ an Kategorien und Karten, Fortschritt der
// nächsten Freischaltung und der Grund, warum eine Karte gerade nicht bezahlbar ist.
// Regel 13: Gesten bauen nie aus Versehen – Bereiche entstehen aus zwei Tipps und werden mit ✓ bestätigt.
import './build.css';
import { BUILDINGS, BuildingId, CATEGORIES, Category, Cost, TIERS } from '../data';
import { Building, HUMAN, UNDO_SECONDS } from '../game';
import { T } from '../world';
import { clampSpan, everBuilt, fieldPlan, markBuilt } from '../bedienung';
import { sound } from '../audio';
import { placeClear } from '../render/trees';
import type { UI } from '../ui';
import { $, costText, el } from './util';

export type Mode =
  | { kind: 'none' }
  | { kind: 'build'; type: BuildingId; gx: number; gy: number; has: boolean }
  | { kind: 'road'; type: BuildingId }
  /** area = Bereich mit zwei Ecken statt einzelner Tipps */
  | { kind: 'demolish'; area?: boolean }
  /** Häuserfeld: viele Wohnhäuser mit Wegen dazwischen */
  | { kind: 'field' }
  /** Rahmen: Soldaten (oder Schiffe) zwischen zwei Ecken wählen; back = vorige Auswahl (für ✕) */
  | { kind: 'frame'; back?: { units: number[]; ships: number[] } }
  /** Patrouille: Ziel für diese Schiffe tippen */
  | { kind: 'patrol'; ships: number[] };

/** ein zweiter Tipp auf dieselbe Stelle baut erst nach dieser Zeit (ms) – gegen Fehltipps */
const CONFIRM_MS = 500;
/** so viele Knickpunkte darf ein geplanter Weg haben */
const MAX_VIAS = 8;
/** so viele Felder baut ein Weg höchstens auf einmal */
const MAX_CELLS = 400;
/** so lange steht „↩ Rückgängig“ in der Meldung (ms); das Spiel nimmt bis UNDO_SECONDS zurück */
const UNDO_MS = Math.min(8, UNDO_SECONDS - 1) * 1000;
/** Suchfenster der Wegsuche um Start und Ziel (Felder) */
const ROAD_PAD = 30;

/** Farben der Vorschau-Felder */
const COL = {
  ok: 0x66ff66, poor: 0xffb347, bad: 0xff5555, road: 0xe8d27a, have: 0xb9a77a, corner: 0xfff27a,
  dem: 0xff3b30, demEmpty: 0xff9a8a, kept: 0xffd34d, frame: 0xffe066,
};

type CellState = 'ok' | 'poor' | 'bad' | 'have';
interface FieldEval {
  houses: { x: number; y: number; s: CellState }[];
  roads: { x: number; y: number; s: CellState }[];
  nHouse: number; nRoad: number; poor: number; bad: number; cost: Cost;
}

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
  /** Ecke 1 und Ecke 2 (Häuserfeld, Abriss-Bereich, Rahmen) */
  cornerA: [number, number] | null = null;
  cornerB: [number, number] | null = null;
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
  /** zuletzt geschriebener Hinweis (nur bei Änderung neu schreiben) */
  private hintHtml = '';
  /** Stand der „NEU“-Punkte an den Kategorien (nur neu rechnen, wenn sich etwas geändert hat) */
  private newKey = '';
  /** Kategorien mit einem noch nie gebauten, freigeschalteten Gebäude */
  private newCats = new Set<Category>();

  constructor(private ui: UI) {}

  get catOpen() { return this.openCat !== null; }

  /** Fläche für die Baumenü-Karten (rechts neben der linken Spalte) */
  buildPanel(hud: HTMLElement) {
    hud.appendChild(el('div', 'panel hidden', '')).id = 'buildPanel';
  }

  /** Hinweistext oben (in topmid) und die Knöpfe unten rechts */
  buildHint(hud: HTMLElement, topmid: HTMLElement) {
    const hint = el('div', 'hint hidden', `<div id="hintText"></div>`);
    hint.id = 'hint';
    topmid.appendChild(hint);
    const btns = el('div', 'hintbtns hidden', `<button id="roadUndo" class="btn hidden" aria-label="Letzten Schritt zurücknehmen">↶</button><button id="hintAlt" class="btn alt hidden"></button><button id="hintOk" class="btn ok" aria-label="Bauen">✓</button><button id="hintX" class="btn" aria-label="Abbrechen">✕</button>`);
    btns.id = 'hintBtns';
    hud.appendChild(btns);
    $('#hintOk').addEventListener('click', () => this.confirm());
    $('#hintX').addEventListener('click', () => this.cancel());
    $('#hintAlt').addEventListener('click', () => this.alt());
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
    this.cornerA = null;
    this.cornerB = null;
    v.setGhost(null);
    v.setRoadPreview([], []);
    v.setRoadHandles([]);
    const active = m.kind !== 'none';
    // Baugebiet zeigen – nicht beim Wählen von Soldaten oder beim Patrouillen-Ziel
    const terr = active && m.kind !== 'frame' && m.kind !== 'patrol';
    if (v.areaShown !== terr) v.showArea(terr);
    if (active) ui.select(null);
    $('#demBtn').classList.toggle('active', m.kind === 'demolish');
    $('#hint').classList.toggle('hidden', !active);
    $('#hint').classList.toggle('line', m.kind === 'road');
    $('#hintBtns').classList.toggle('hidden', !active);
    document.body.classList.toggle('building', active);
    $('#quest').classList.toggle('hidden', active);
    const ok = m.kind === 'build' || m.kind === 'road' || m.kind === 'field' || m.kind === 'frame' || (m.kind === 'demolish' && !!m.area);
    $('#hintOk').classList.toggle('hidden', !ok);
    $('#hintOk').setAttribute('aria-label', m.kind === 'frame' ? 'Wählen' : m.kind === 'demolish' ? 'Abreißen' : 'Bauen');
    $('#roadUndo').classList.add('hidden');
    this.updateHint();
  }

  /** ✕: Werkzeug beenden (Rahmen und Patrouille: zurück zur vorigen Auswahl) */
  private cancel() {
    const m = this.ui.mode;
    // Wege-Werkzeug mit angefangenem Plan: erst nur den Plan verwerfen (neuer Start), beim zweiten Mal beenden
    if (m.kind === 'road' && this.roadStart) { this.setMode({ kind: 'road', type: m.type }); sound.play('klick'); return; }
    this.setMode({ kind: 'none' });
    if (m.kind === 'patrol') this.ui.selectShipsById(m.ships);
    if (m.kind === 'frame' && m.back) {
      const ids = new Set(m.back.units);
      const us = this.ui.g.units.filter((u) => ids.has(u.id) && u.ship === undefined);
      if (us.length) this.ui.selectUnits(us); else if (m.back.ships.length) this.ui.selectShipsById(m.back.ships);
    }
  }

  /** regelmäßig: Karten (bezahlbar?), „NEU“-Punkte und Bauhinweis auffrischen */
  refresh() {
    this.markNew();
    if (this.openCat) this.refreshCards();
    const k = this.ui.mode.kind;
    if (k === 'field' && this.cornerB) this.previewArea();
    if (k !== 'none') this.updateHint();
  }

  /** Hinweistext setzen – nur, wenn er sich geändert hat */
  private setHint(html: string) {
    if (html === this.hintHtml) return;
    this.hintHtml = html;
    $('#hintText').innerHTML = html;
  }

  updateHint() {
    const ui = this.ui, g = ui.g, m = ui.mode;
    let okOn: boolean | null = null;
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
      this.setHint(`<b>${d.icon} ${d.name}</b> <span class="cost">${costText(d.cost)}</span>${scale}<small>${msg}</small>`);
      okOn = m.has && chk.ok;
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
      const cost = build ? `${build} ${build === 1 ? 'Feld' : 'Felder'} · ${costText(times(d.cost, build))}` : `${costText(d.cost)} je Feld`;
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
      this.setHint(`<b>${d.icon}<span class="nm"> ${d.name}</span></b> <span class="msg">${msg}</span> <span class="cost">${cost}</span>`);
      okOn = build > 0;
      $('#roadUndo').classList.toggle('hidden', !this.roadHist.length);
    } else if (m.kind === 'demolish' && !m.area) {
      this.setHint(`<b>💥 Abreißen</b><small>Tippe auf ein Gebäude oder einen Weg. Du bekommst die Hälfte des Materials zurück. ⬚ Bereich: viel auf einmal.</small>`);
    } else if (m.kind === 'demolish') {
      if (!this.cornerA) this.setHint(`<b>💥 Bereich abreißen</b><small>Tippe auf die erste Ecke.</small>`);
      else if (!this.cornerB) this.setHint(`<b>💥 Bereich abreißen</b><small>Tippe jetzt auf die zweite Ecke.</small>`);
      else {
        const r = g.demolishArea(this.cornerA[0], this.cornerA[1], this.cornerB[0], this.cornerB[1], true);
        const any = r.buildings + r.roads > 0;
        const what = any ? `${r.buildings} Gebäude, ${r.roads} ${r.roads === 1 ? 'Weg' : 'Wege'}` : 'Nichts Eigenes im Bereich';
        // Rückerstattung immer nennen – auch wenn es nichts gibt (Wege geben kein Material zurück)
        const back = Object.keys(r.refund).length ? ` – Rückerstattung ${costText(r.refund)}` : ` – keine Rückerstattung${r.buildings ? '' : ' (Wege geben nichts zurück)'}`;
        this.setHint(`<b>💥 ${what}</b>${any ? `<span class="cost">${back}</span>` : ''}<small>${r.kept ? 'Das Kontor bleibt stehen. ' : ''}${any ? '✓ reißt ab (mit Rückfrage) – oder neue zweite Ecke tippen.' : 'Neue zweite Ecke tippen.'}</small>`);
        okOn = any;
      }
    } else if (m.kind === 'field') {
      const d = BUILDINGS.haus;
      if (!this.cornerA) this.setHint(`<b>🏘️ Häuserfeld</b> <span class="cost">${costText(d.cost)} je Haus</span><small>Tippe auf die erste Ecke des Feldes.</small>`);
      else if (!this.cornerB) this.setHint(`<b>🏘️ Häuserfeld</b><small>Tippe jetzt auf die zweite Ecke – dazwischen entstehen Häuser mit Wegen.</small>`);
      else {
        const f = this.fieldEval();
        const parts = [`${f.nHouse} ${f.nHouse === 1 ? 'Haus' : 'Häuser'}`];
        if (f.nRoad) parts.push(`${f.nRoad} Wegfelder`);
        const notes: string[] = [];
        if (f.bad) notes.push('rot = belegt, dort nichts');
        if (f.poor) notes.push('orange = zu wenig Material');
        this.setHint(`<b>🏘️ ${parts.join(' · ')}</b> <span class="cost">${f.nHouse + f.nRoad ? costText(f.cost) : ''}</span><small>${f.nHouse + f.nRoad ? '✓ baut alles Grüne' : 'Hier passt nichts hin'}${notes.length ? ` (${notes.join(', ')})` : ''} – oder neue zweite Ecke tippen.</small>`);
        okOn = f.nHouse + f.nRoad > 0;
      }
    } else if (m.kind === 'frame') {
      if (!this.cornerA) this.setHint(`<b>⬚ Rahmen</b><small>Tippe auf die erste Ecke um deine Soldaten oder Schiffe.</small>`);
      else if (!this.cornerB) this.setHint(`<b>⬚ Rahmen</b><small>Tippe jetzt auf die zweite Ecke.</small>`);
      else {
        const sel = this.ui.units.inFrame(this.cornerA, this.cornerB);
        const n = sel.units.length || sel.ships.length;
        const what = sel.units.length ? `${n} ${n === 1 ? 'Soldat' : 'Soldaten'}` : sel.ships.length ? `${n} ${n === 1 ? 'Schiff' : 'Schiffe'}` : 'Niemand im Rahmen';
        this.setHint(`<b>⬚ ${what}</b><small>${n ? '✓ wählt sie aus – oder neue zweite Ecke tippen.' : 'Neue zweite Ecke tippen.'}</small>`);
        okOn = n > 0;
      }
    } else if (m.kind === 'patrol') {
      this.setHint(`<b>🔁 Patrouille</b><small>Tippe aufs Meer: ${m.ships.length > 1 ? 'die Schiffe fahren' : 'das Schiff fährt'} zwischen hier und dort hin und her und greift Feinde an.</small>`);
    }
    if (okOn !== null) ($('#hintOk') as HTMLButtonElement).disabled = !okOn;
    this.updateAlt();
  }

  /** Zusatzknopf links neben ✓: je nach Werkzeug „Ziel ändern“, „Start neu“, „⬚ Bereich“, „↺ Neu“ */
  private updateAlt() {
    const m = this.ui.mode, b = $('#hintAlt');
    let t = '';
    if (m.kind === 'road') t = this.roadEndSet ? '🎯 Ziel ändern' : this.roadStart ? '📍 Start neu' : '';
    else if (m.kind === 'demolish') t = m.area ? (this.cornerA ? '↺ Neu' : '👆 Einzeln') : '⬚ Bereich';
    else if (m.kind === 'field' || m.kind === 'frame') t = this.cornerA ? '↺ Neu' : '';
    if (b.textContent !== t) b.textContent = t;
    b.classList.toggle('hidden', !t);
  }

  private alt() {
    const ui = this.ui, m = ui.mode;
    if (m.kind === 'road') {
      this.flushPendingTap();
      if (this.roadEndSet && this.roadStart) {
        // Ziel ändern: der Start bleibt, das nächste Tippen setzt ein neues Ziel (↶ holt den Plan zurück)
        this.remember();
        this.roadCells = [this.roadStart];
        this.roadEndSet = false; this.roadNoWay = false; this.roadPartial = false; this.roadTooLong = false; this.roadTarget = null;
        this.roadVias = [];
      } else { this.roadStart = null; this.roadCells = []; this.roadVias = []; this.roadHist = []; }
      this.previewRoad();
    } else if (m.kind === 'demolish') {
      if (m.area && this.cornerA) { this.cornerA = this.cornerB = null; this.previewArea(); }
      else { this.setMode({ kind: 'demolish', area: !m.area }); return; }
    } else if (m.kind === 'field' || m.kind === 'frame') { this.cornerA = this.cornerB = null; this.previewArea(); }
    sound.play('klick');
    this.updateHint();
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
      const neu = this.isNew(d.id);
      const card = el('button', 'card', `<span class="ic">${d.icon}</span><b>${d.name}${neu ? ' <i class="neu">NEU</i>' : ''}</b><small class="cost">${costText(d.cost)}<span class="why"></span></small><small class="desc">${d.desc}</small>`);
      card.dataset.type = d.id;
      card.addEventListener('click', () => {
        this.closeCat();
        this.setMode(d.paint ? { kind: 'road', type: d.id } : { kind: 'build', type: d.id, gx: 0, gy: 0, has: false });
      });
      p.appendChild(card);
      // Häuserfeld gleich hinter dem Wohnhaus: viele Häuser mit Wegen in einem Zug
      if (d.id === 'haus') {
        const f = el('button', 'card', `<span class="ic">🏘️</span><b>Häuserfeld</b><small class="cost">${costText(d.cost)} je Haus<span class="why"></span></small><small class="desc">Zwei Ecken tippen: Häuser in Blöcken zu 4 × 2 mit Wegen dazwischen, dann ✓.</small>`);
        f.dataset.field = '1';
        f.addEventListener('click', () => { this.closeCat(); this.setMode({ kind: 'field' }); });
        p.appendChild(f);
      }
    }
    const nx = g.nextUnlock(c);
    if (nx) {
      const lock = el('div', 'card next', '');
      lock.dataset.lock = '1';
      p.appendChild(lock);
    }
    this.refreshCards();
  }

  /** Karten auffrischen: bezahlbar? (sonst der Grund), Fortschritt der nächsten Freischaltung */
  private refreshCards() {
    const g = this.ui.g;
    document.querySelectorAll<HTMLElement>('#buildPanel .card[data-type], #buildPanel .card[data-field]').forEach((c) => {
      const d = BUILDINGS[(c.dataset.type ?? 'haus') as BuildingId];
      const chk = g.canAfford(d.cost);
      c.classList.toggle('poor', !chk.ok);
      const why = c.querySelector('.why');
      const txt = chk.ok ? '' : chk.reason ?? '';
      if (why && why.textContent !== txt) why.textContent = txt;
    });
    const lock = document.querySelector<HTMLElement>('#buildPanel .card[data-lock]');
    if (lock && this.openCat) {
      const html = this.lockHtml(this.openCat);
      if ((lock as HTMLElement & { _h?: string })._h !== html) { (lock as HTMLElement & { _h?: string })._h = html; lock.innerHTML = html; }
    }
  }

  /** Schloss-Karte: nächste Freischaltung mit Stand („ab 50 Siedlern – du hast 23 auf dieser Insel“) und Balken */
  private lockHtml(c: Category): string {
    const g = this.ui.g, nx = g.nextUnlock(c);
    if (!nx) return '';
    const d = BUILDINGS[nx.type];
    // weitere Gebäude derselben Schwelle in dieser Kategorie
    const more = Object.values(BUILDINGS).filter((o) => o.category === c && o.id !== nx.type && o.unlock && o.unlock.tier === nx.tier && o.unlock.n === nx.n && !g.isUnlocked(o.id) && g.isReady(o.id)).length;
    // Einwohner dieser Stufe (und höher) je Insel; freigeschaltet wird nach der größten Insel
    const per = new Map<number, number>();
    for (const b of g.buildings) if (b.owner === HUMAN && b.type === 'haus' && b.tier >= nx.tier) per.set(b.island, (per.get(b.island) ?? 0) + b.residents);
    let best = g.focus, have = per.get(g.focus) ?? 0;
    for (const [isl, n] of per) if (n > have) { best = isl; have = n; }
    const where = best === g.focus || best < 0 ? 'auf dieser Insel' : `auf ${g.islands[best]?.name ?? 'einer Insel'}`;
    const pct = Math.max(0, Math.min(100, Math.round((have / nx.n) * 100)));
    return `<span class="ic">🔒</span><b>${d.icon} ${d.name}${more ? ` <small>und ${more} ${more === 1 ? 'weiteres' : 'weitere'}</small>` : ''}</b>`
      + `<small class="desc">ab ${nx.n} ${TIERS[nx.tier].dat} – du hast ${have} ${where}</small>`
      + `<span class="lockbar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></span>`;
  }

  /** „NEU“: freigeschaltet (nicht von Anfang an da) und noch nie gebaut */
  private isNew(t: BuildingId): boolean {
    const d = BUILDINGS[t];
    return !!d.unlock && this.ui.g.isUnlocked(t) && !everBuilt(this.ui.g, t);
  }

  /** „NEU“-Punkte an den Kategorien der linken Leiste (nur neu rechnen, wenn gebaut oder freigeschaltet wurde) */
  private markNew() {
    const g = this.ui.g;
    const key = `${g.buildVersion}|${g.unlocked.size}|${g.buildings.length}`;
    if (key === this.newKey) return;
    this.newKey = key;
    this.newCats.clear();
    for (const d of Object.values(BUILDINGS)) if (d.category && this.isNew(d.id)) this.newCats.add(d.category);
    document.querySelectorAll<HTMLElement>('#hud .cat').forEach((b) => b.classList.toggle('neu', this.newCats.has(b.dataset.cat as Category)));
  }

  closeCat() {
    if (this.openCat) sound.play('zu');
    this.openCat = null;
    $('#buildPanel').classList.add('hidden');
    $('#quest').classList.toggle('hidden', this.ui.mode.kind !== 'none');
    document.querySelectorAll('#hud .cat').forEach((b) => b.classList.remove('active'));
  }

  // ---------- Tippen in den Werkzeugen ----------

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
    if (m.kind === 'demolish' && !m.area) { this.demolishTap(x, y); return; }
    if (m.kind === 'patrol') { ui.units.patrolTap(m.ships, x, y); return; }
    if (m.kind === 'demolish' || m.kind === 'field' || m.kind === 'frame') this.cornerTap(x, y);
  }

  /** Bereich aus zwei Tipps: erst Ecke 1, dann Ecke 2; jeder weitere Tipp setzt Ecke 2 neu (bestätigt wird nur mit ✓) */
  private cornerTap(x: number, y: number) {
    const ui = this.ui;
    const t = ui.view.pick(x, y, ui.mode.kind === 'demolish');
    if (!t) return;
    if (!this.cornerA) this.cornerA = t;
    else this.cornerB = clampSpan(this.cornerA, t);
    sound.play('klick');
    this.previewArea();
    this.updateHint();
  }

  /** Vorschau der Fläche: Häuserfeld (grün/orange/rot, Wege hell), Abriss (rot), Rahmen (gelber Rand) */
  private previewArea() {
    const ui = this.ui, g = ui.g, m = ui.mode, a = this.cornerA, b = this.cornerB;
    // Bäume im Häuserfeld ausblenden (sie werden beim Bau ohnehin gefällt) – so sieht man genau, wo die Häuser stehen
    const box = placeClear.uClearBox.value;
    if (!a || !b || m.kind !== 'field') { if (box.z >= box.x) box.set(0, 0, -1, -1); }
    if (!a) { ui.view.setRoadPreview([], []); return; }
    if (!b) { ui.view.setRoadPreview([a], [true], [COL.corner]); return; }
    const cells: [number, number][] = [], cols: number[] = [];
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    if (m.kind === 'field') {
      box.set(x0 + 0.05, y0 + 0.05, x1 + 0.95, y1 + 0.95);
      const f = this.fieldEval();
      const c = (s: CellState, road: boolean) => s === 'ok' ? (road ? COL.road : COL.ok) : s === 'poor' ? COL.poor : s === 'have' ? COL.have : COL.bad;
      for (const h of f.houses) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { cells.push([h.x + i, h.y + j]); cols.push(c(h.s, false)); }
      for (const r of f.roads) { cells.push([r.x, r.y]); cols.push(c(r.s, true)); }
    } else if (m.kind === 'demolish') {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (!g.inMap(x, y)) continue;
        const k = g.idx(x, y), bd = g.buildingAt(x, y);
        const mine = bd && bd.owner === HUMAN;
        cells.push([x, y]);
        cols.push(mine ? (bd!.type === 'kontor' ? COL.kept : COL.dem) : g.roads[k] && g.own[k] === HUMAN ? COL.dem : COL.demEmpty);
      }
    } else {
      // Rahmen: nur der Rand, damit man die Soldaten darin sieht
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (x !== x0 && x !== x1 && y !== y0 && y !== y1) continue;
        if (g.inMap(x, y)) { cells.push([x, y]); cols.push(COL.frame); }
      }
    }
    ui.view.setRoadPreview(cells, cells.map(() => true), cols);
  }

  /**
   * Häuserfeld bewerten: welche Häuser und Wegfelder gehen (grün), welche scheitern am Material (orange),
   * welche am Platz (rot), welche Wege liegen schon. Gebaut wird in derselben Reihenfolge (erst Häuser, dann Wege),
   * deshalb rechnet die Bewertung das Material der Reihe nach herunter.
   */
  private fieldEval(): FieldEval {
    const g = this.ui.g;
    const out: FieldEval = { houses: [], roads: [], nHouse: 0, nRoad: 0, poor: 0, bad: 0, cost: {} };
    if (!this.cornerA || !this.cornerB) return out;
    const plan = fieldPlan(this.cornerA, this.cornerB, BUILDINGS.haus.size);
    const isl = g.islandOf[g.idx(this.cornerA[0], this.cornerA[1])];
    const l = g.lagerOf(HUMAN, isl);
    const have: Record<string, number> = { taler: g.players[HUMAN].money, holz: l?.holz ?? 0, werkzeug: l?.werkzeug ?? 0, stein: l?.stein ?? 0 };
    const afford = (c: Cost) => {
      for (const [k, v] of Object.entries(c)) if ((v ?? 0) > (have[k] ?? 0)) return false;
      for (const [k, v] of Object.entries(c)) { have[k] -= v ?? 0; out.cost[k as keyof Cost] = (out.cost[k as keyof Cost] ?? 0) + (v ?? 0); }
      return true;
    };
    const hc = BUILDINGS.haus.cost, rc = BUILDINGS.weg.cost;
    for (const [x, y] of plan.houses) {
      const c = g.canPlace('haus', x, y);
      // „Zu wenig …“ prüft das Spiel zuletzt: dann passt der Platz, nur das Material reicht nicht
      const placeOk = c.ok || /^Zu wenig/.test(c.reason ?? '');
      const s: CellState = !placeOk ? 'bad' : afford(hc) ? 'ok' : 'poor';
      out.houses.push({ x, y, s });
      if (s === 'ok') out.nHouse++; else if (s === 'poor') out.poor++; else out.bad++;
    }
    for (const [x, y] of plan.roads) {
      if (!g.inMap(x, y)) continue;
      const k = g.idx(x, y);
      if (g.roads[k] && g.own[k] === HUMAN) { out.roads.push({ x, y, s: 'have' }); continue; }
      const c = g.canRoad(x, y, HUMAN, 'weg');
      const placeOk = c.ok || /^Zu wenig/.test(c.reason ?? '');
      // Wege auf Wasser, Berg oder fremdem Land lässt das Feld einfach aus (kein Rot – das wären nur Lücken)
      if (!placeOk) continue;
      const s: CellState = afford(rc) ? 'ok' : 'poor';
      out.roads.push({ x, y, s });
      if (s === 'ok') out.nRoad++; else out.poor++;
    }
    return out;
  }

  private demolishTap(x: number, y: number) {
    const ui = this.ui, g = ui.g;
    const t = ui.view.pick(x, y, true);
    if (!t) return;
    const b = g.buildingAt(t[0], t[1]);
    if (b && b.owner === HUMAN) {
      const d = BUILDINGS[b.type];
      // Kontor: ob es weg darf, entscheidet das Spiel (nur, wenn auf der Insel sonst nichts mehr steht)
      if (b.type === 'kontor') {
        const c = g.canDemolishKontor(b);
        if (!c.ok) { ui.toast(`⚓ ${c.reason}`, 'bad'); return; }
        ui.ask(`${d.icon} ${d.name} abreißen?`, 'Die Insel wird wieder frei. Was im Lager ist, geht verloren.', '💥 Abreißen', () => { g.demolish(t[0], t[1]); });
        return;
      }
      // Gebäude nur nach Rückfrage abreißen (Wege sofort)
      ui.ask(`${d.icon} ${d.name} abreißen?`, 'Du bekommst die Hälfte des Baumaterials zurück.', '💥 Abreißen', () => {
        g.removeBuilding(b);
        ui.toast('Abgerissen', 'info');
      });
      return;
    }
    if (g.demolish(t[0], t[1])) ui.toast('Abgerissen', 'info');
  }

  /** ✓ – je nach Werkzeug bauen, abreißen (mit Rückfrage) oder wählen */
  private confirm() {
    const m = this.ui.mode;
    if (m.kind === 'road') this.confirmRoad();
    else if (m.kind === 'build') this.confirmBuild();
    else if (m.kind === 'field') this.confirmField();
    else if (m.kind === 'demolish' && m.area) this.confirmArea();
    else if (m.kind === 'frame') this.confirmFrame();
  }

  private confirmBuild() {
    const ui = this.ui, g = ui.g, m = ui.mode;
    if (m.kind !== 'build' || !m.has) return;
    const r = g.place(m.type, m.gx, m.gy);
    if (r.ok) sound.play(m.type === 'kontor' ? 'kontor' : 'bauen');
    if (!r.ok) { ui.toast(r.reason ?? 'Geht nicht', 'bad'); return; }
    const b = g.buildingAt(m.gx, m.gy);
    const d = BUILDINGS[m.type];
    if (b) this.offerUndo(`${d.icon} ${d.name} gebaut`, [b], []);
    if (m.type === 'kontor') { this.setMode({ kind: 'none' }); return; }
    // Vorschau bleibt aktiv für das nächste Gebäude
    m.has = false;
    ui.view.setGhost(null);
    this.updateHint();
    if (!g.canAfford(d.cost).ok) {
      ui.toast(`${g.canAfford(d.cost).reason} für ein weiteres`, 'info');
    }
  }

  /** Häuserfeld bauen: erst alle Häuser (ein Rechenschritt), dann die Wege dazwischen */
  private confirmField() {
    const ui = this.ui, g = ui.g;
    const f = this.fieldEval();
    const hs = f.houses.filter((h) => h.s !== 'bad').map((h) => [h.x, h.y] as [number, number]);
    const rs = f.roads.filter((r) => r.s === 'ok' || r.s === 'poor').map((r) => [r.x, r.y] as [number, number]);
    if (!hs.length && !rs.length) return;
    const before = new Set(g.buildings);
    const nh = hs.length ? g.placeMany('haus', hs) : 0;
    const built = g.buildings.filter((b) => !before.has(b) && b.owner === HUMAN);
    const nr = rs.length ? g.placeRoads(rs, HUMAN, 'weg') : 0;
    if (nh || nr) {
      sound.play('bauen');
      this.offerUndo(`🏘️ ${nh} ${nh === 1 ? 'Haus' : 'Häuser'}${nr ? ` und ${nr} Wegfelder` : ''} gebaut`, built, nr ? rs : []);
    } else ui.toast('Nichts gebaut – zu wenig Material oder kein Platz', 'bad');
    // für das nächste Feld frisch beginnen
    this.cornerA = this.cornerB = null;
    this.previewArea();
    this.updateHint();
  }

  /** Abriss-Bereich: eine gemeinsame Rückfrage, dann alles auf einmal (das Kontor entscheidet das Spiel) */
  private confirmArea() {
    const ui = this.ui, g = ui.g, a = this.cornerA, b = this.cornerB;
    if (!a || !b) return;
    const r = g.demolishArea(a[0], a[1], b[0], b[1], true);
    if (!r.buildings && !r.roads) return;
    const back = Object.keys(r.refund).length ? ` Du bekommst ${costText(r.refund)} zurück.` : ` Zurück gibt es nichts${r.buildings ? '' : ' (Wege geben kein Material zurück)'}.`;
    ui.ask(`💥 ${r.buildings} Gebäude und ${r.roads} ${r.roads === 1 ? 'Weg' : 'Wege'} abreißen?`, `Alles im roten Bereich wird abgerissen.${back}${r.kept ? ' Das Kontor bleibt stehen.' : ''}`, '💥 Abreißen', () => {
      const res = g.demolishArea(a[0], a[1], b[0], b[1]);
      ui.toast(`💥 ${res.buildings} Gebäude und ${res.roads} ${res.roads === 1 ? 'Weg' : 'Wege'} abgerissen`, 'info');
      if (ui.mode.kind === 'demolish') { this.cornerA = this.cornerB = null; this.previewArea(); this.updateHint(); }
    });
  }

  private confirmFrame() {
    const ui = this.ui, a = this.cornerA, b = this.cornerB;
    if (!a || !b) return;
    const sel = ui.units.inFrame(a, b);
    this.setMode({ kind: 'none' });
    if (sel.units.length) ui.selectUnits(sel.units);
    else if (sel.ships.length) ui.selectShipsById(sel.ships.map((s) => s.id));
  }

  /**
   * Meldung mit „↩ Rückgängig“ (8 s): nimmt das eben Gebaute zurück, mit voller Erstattung (g.undoBuild).
   * builds = neue Gebäude, roads = Felder einer Wegstrecke.
   */
  private offerUndo(text: string, builds: Building[], roads: [number, number][]) {
    const ui = this.ui, g = ui.g;
    ui.toastAction(text, '↩ Rückgängig', () => {
      const sum: Cost = {};
      let n = 0, why = '';
      for (const r of [builds.length ? g.undoBuild(builds) : null, roads.length ? g.undoBuild(roads) : null]) {
        if (!r) continue;
        if (r.ok) { n += r.n; for (const [k, v] of Object.entries(r.refund)) sum[k as keyof Cost] = (sum[k as keyof Cost] ?? 0) + (v ?? 0); }
        else why = r.reason ?? '';
      }
      if (n) { sound.play('abriss'); ui.toast(`↩ Zurückgenommen${Object.keys(sum).length ? ` – ${costText(sum)} zurück` : ''}`, 'info'); }
      else ui.toast(why || 'Zurücknehmen geht nicht mehr', 'bad');
      // eine Wegstrecke kann gerade Start des nächsten Stücks sein: Vorschau auffrischen
      if (ui.mode.kind === 'road') { this.previewRoad(); this.updateHint(); }
      if (ui.mode.kind === 'field' && this.cornerB) { this.previewArea(); this.updateHint(); }
    }, UNDO_MS);
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
    // Suchfenster: 30 Felder um Start und Ziel (auch lange Umwege um eine Bucht finden sich)
    const pad = ROAD_PAD;
    const bx0 = Math.max(0, Math.min(x0, x1) - pad), by0 = Math.max(0, Math.min(y0, y1) - pad);
    const bx1 = Math.min(N - 1, Math.max(x0, x1) + pad), by1 = Math.min(N - 1, Math.max(y0, y1) + pad);
    const W = bx1 - bx0 + 1, H = by1 - by0 + 1;
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    // Zustand = Feld × Richtung; Ecken kosten etwas mehr, damit der Weg gerade bleibt
    const cost = new Float64Array(W * H * 4).fill(Infinity);
    const from = new Int32Array(W * H * 4).fill(-1);
    // Befahrbarkeit je Feld nur einmal prüfen (0 = offen, 1 = frei, 2 = gesperrt)
    const passC = new Uint8Array(W * H);
    const ok = (x: number, y: number) => {
      const c = (y - by0) * W + (x - bx0);
      if (!passC[c]) passC[c] = pass(x, y) ? 1 : 2;
      return passC[c] === 1;
    };
    const id = (x: number, y: number, d: number) => ((y - by0) * W + (x - bx0)) * 4 + d;
    const heap = new MinHeap();
    // Start: das Feld selbst, oder – wenn dort ein Gebäude steht – alle freien Nachbarfelder
    const starts: [number, number][] = pass(x0, y0) ? [[x0, y0]] : g.occ[g.idx(x0, y0)] ? this.freeAround(x0, y0, pass) : [];
    for (const [sx, sy] of starts) if (sx >= bx0 && sy >= by0 && sx <= bx1 && sy <= by1) for (let d = 0; d < 4; d++) { cost[id(sx, sy, d)] = 0; heap.push(id(sx, sy, d), 0); }
    // Ziel: das Feld selbst, oder bei einem Gebäude dessen freie Nachbarfelder
    const goals = new Set<number>((pass(x1, y1) ? [[x1, y1]] : g.occ[g.idx(x1, y1)] ? this.freeAround(x1, y1, pass) : []).map(([gx, gy]) => gy * N + gx));
    let goal = -1;
    let guard = 0;
    // nächstes erreichbares Feld zum Ziel merken (falls das Ziel selbst nicht erreichbar ist)
    let near = -1, nearD = Infinity;
    const d0 = Math.hypot(x1 - x0, y1 - y0);
    while (heap.size && guard++ < 250000) {
      const c = heap.topCost(), st = heap.pop();
      if (c > cost[st]) continue;
      const d = st % 4, cell = (st - d) / 4, x = cell % W + bx0, y = Math.floor(cell / W) + by0;
      if (goals.has(y * N + x)) { goal = st; break; }
      const dd = Math.hypot(x1 - x, y1 - y);
      if (dd < nearD) { nearD = dd; near = st; }
      for (let nd = 0; nd < 4; nd++) {
        const nx = x + DIRS[nd][0], ny = y + DIRS[nd][1];
        if (nx < bx0 || ny < by0 || nx > bx1 || ny > by1) continue;
        if (!ok(nx, ny)) continue;
        // schon belegte Felder meiden: sonst läuft der Weg zum Knickpunkt hin und auf derselben Spur zurück
        const nc = c + 1 + (nd !== d ? 0.6 : 0) + (road && g.roads[g.idx(nx, ny)] ? -0.3 : 0) + (used?.has(ny * N + nx) ? 3 : 0);
        const ns = id(nx, ny, nd);
        if (nc < cost[ns]) { cost[ns] = nc; from[ns] = st; heap.push(ns, nc); }
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
    const d = BUILDINGS[type];
    const end = this.roadCells[this.roadCells.length - 1];
    const isRoad = type === 'weg' || type === 'steinweg';
    const cells = this.roadCells.slice();
    const before = new Set(g.buildings);
    const n = isRoad ? g.placeRoads(cells, HUMAN, type) : g.placeMany(type, cells);
    if (n) {
      sound.play(isRoad ? 'weg' : 'bauen');
      if (type === 'steinweg') markBuilt(g, 'steinweg');
      const built = isRoad ? [] : g.buildings.filter((b) => !before.has(b) && b.owner === HUMAN);
      this.offerUndo(`${d.icon} ${n} ${isRoad ? 'Wegfelder' : 'Felder'} gebaut`, built, isRoad ? cells : []);
    } else ui.toast('Nichts gebaut – zu wenig Material oder kein Platz', 'bad');
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

/** Kosten × n */
function times(c: Cost, n: number): Cost {
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, (v ?? 0) * n]));
}

/** kleiner Vorrangspeicher für die Wegsuche (kleinste Kosten zuerst) */
class MinHeap {
  private k: number[] = [];
  private c: number[] = [];
  get size() { return this.k.length; }
  topCost() { return this.c[0]; }
  push(key: number, cost: number) {
    const k = this.k, c = this.c;
    let i = k.length;
    k.push(key); c.push(cost);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (c[p] <= cost) break;
      k[i] = k[p]; c[i] = c[p]; i = p;
    }
    k[i] = key; c[i] = cost;
  }
  pop(): number {
    const k = this.k, c = this.c;
    const top = k[0];
    const lk = k.pop()!, lc = c.pop()!;
    const n = k.length;
    if (n) {
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i, mc = lc;
        if (l < n && c[l] < mc) { m = l; mc = c[l]; }
        if (r < n && c[r] < mc) { m = r; mc = c[r]; }
        if (m === i) break;
        k[i] = k[m]; c[i] = c[m]; i = m;
      }
      k[i] = lk; c[i] = lc;
    }
    return top;
  }
}
