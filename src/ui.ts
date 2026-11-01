// Bedienoberfläche (HTML über dem 3D-Bild) – der Kern: Tippen, Auswahl, Meldungen, Rückfragen, Fensterrahmen.
// Die einzelnen Teile liegen als Bausteine in src/ui/, jeder mit eigener Gestaltung (src/ui/*.css):
//   hud.ts       Oberleiste, linke Baumenü-Spalte, Warenleiste, Aufgabe, Pause/Tempo, Zoom und Kompass
//   build.ts     Bau-, Wege- und Abriss-Werkzeug, Hinweisleiste, Baumenü-Karten
//   info.ts      Gebäude-, Haus-, Kontor- und Insel-Info
//   ship.ts      Schiffsfenster
//   units.ts     Soldatenfenster
//   windows.ts   Menü, Weltkarte, Hilfe, Verloren-Fenster
//   diplomacy.ts Krieg & Frieden
// Gerüste für spätere Arbeitspakete (ihr Einstieg bleibt versteckt, solange sie leer sind):
//   stats.ts (Tipp auf Geld/Einwohner), log.ts (Glocke 🔔), fleet.ts (⛵ und Inselname),
//   trade.ts (Reiter „Handel“ im Kontor, Routen im Schiff), settings.ts (Neues Spiel),
//   score.ts (Menüpunkt „Punkte“), natives.ts (Tipp auf eine Häuptlingshütte)
import './ui/fonts.css';
import { BUILDINGS, GoodId, UNITS } from './data';
import { atWar, declareWar, orderAttack, orderBoard, orderMove, shipAttack } from './combat';
import { Building, DOCK_RANGE, Game, HUMAN, Ship, ShotKind, Unit } from './game';
import { Input } from './input';
import { View } from './render/scene';
import { LAND_Y } from './render/terrain';
import { sound } from './audio';
import { $, Art, Ort, costText, el } from './ui/util';
import { Hud } from './ui/hud';
import { BuildTool, Mode } from './ui/build';
import { InfoPanel } from './ui/info';
import { ShipPanel } from './ui/ship';
import { UnitsPanel } from './ui/units';
import { Windows } from './ui/windows';
import { Diplomacy } from './ui/diplomacy';
import { StatsWindow } from './ui/stats';
import { LogBook } from './ui/log';
import { FleetWindow } from './ui/fleet';
import { TradePanel } from './ui/trade';
import { SettingsWindow } from './ui/settings';
import { ScoreWindow } from './ui/score';
import { NativesWindow } from './ui/natives';

export { costText };
export type { Mode };

/** Einstellungen für ein Fenster in der Bildmitte (siehe UI.dialog) */
export interface DialogOpts {
  title: string;
  /** Inhalt – scrollt, wenn er nicht passt */
  body: string;
  /** Fuß mit dem Hauptknopf (Los geht's, Schließen, Weiterspielen) – bleibt immer unten sichtbar */
  foot?: string;
  /** zusätzliche CSS-Klasse für die Box (z. B. 'help', 'menu') */
  cls?: string;
  /** false = Rückfrage: kein ✕, Tipp auf den dunklen Hintergrund schließt nicht */
  dismiss?: boolean;
}

export class UI {
  mode: Mode = { kind: 'none' };
  selected: Building | null = null;
  showStorage = false;
  paused = false;
  speed = 1;
  selShip: Ship | null = null;
  /** ausgewählte eigene Soldaten */
  selUnits: Unit[] = [];
  /** Waren, die gerade eine Rolle spielen (Warenleiste, Lager) */
  relevant = new Set<GoodId>();
  islandInfo: number | null = null;
  /** Infofenster eingeklappt (▾) – gilt, bis etwas anderes gewählt wird */
  infoFolded = false;
  /** Gesten auf der Karte und sanfte Kamerafahrten */
  readonly input: Input;

  // ---------- Bausteine ----------
  readonly hud: Hud;
  readonly build: BuildTool;
  readonly info: InfoPanel;
  readonly ship: ShipPanel;
  readonly units: UnitsPanel;
  readonly windows: Windows;
  readonly diplomacy: Diplomacy;
  readonly stats: StatsWindow;
  readonly log: LogBook;
  readonly fleet: FleetWindow;
  readonly trade: TradePanel;
  readonly settings: SettingsWindow;
  readonly score: ScoreWindow;
  readonly natives: NativesWindow;

  /** wofür das Infofenster gerade aufgebaut ist (andere Auswahl = neu aufbauen und aufklappen) */
  private infoKey = '';
  /** eigenes Gebäude, das das gewählte Schiff gerade ansteuert – ein zweiter Tipp darauf öffnet die Info */
  private shipGoal: number | null = null;
  /** darf das offene Fenster per ✕ oder Tipp auf den Hintergrund geschlossen werden? */
  private modalDismiss = false;
  private lostShown = false;

  constructor(public g: Game, public view: View, readonly onNewGame: (g: Game) => void) {
    this.log = new LogBook(this);
    this.hud = new Hud(this);
    this.build = new BuildTool(this);
    this.info = new InfoPanel(this);
    this.ship = new ShipPanel(this);
    this.units = new UnitsPanel(this);
    this.windows = new Windows(this);
    this.diplomacy = new Diplomacy(this);
    this.stats = new StatsWindow(this);
    this.fleet = new FleetWindow(this);
    this.trade = new TradePanel(this);
    this.settings = new SettingsWindow(this);
    this.score = new ScoreWindow(this);
    this.natives = new NativesWindow(this);
    this.buildDom();
    this.input = new Input($('#c'), view, {
      tap: (x, y) => this.tap(x, y),
      // Wege werden per Tippen gebaut (Start, Ziel, ✓) – ein Finger verschiebt immer nur die Karte
      wantsPaint: () => false,
      paintStart: (x, y) => this.build.roadTap(x, y),
      paintMove: () => { /* Wege werden nicht gezogen */ },
      paintEnd: () => { /* siehe build.confirmRoad */ },
    });
    // Kompassnadel folgt jeder Drehung sofort
    this.input.onCamera = () => this.hud.needle();
    this.bindGame();
  }

  bindGame() {
    const v = this.view;
    this.g.ev = {
      added: (b) => { v.addBuilding(b); if (b.type === 'kontor' || b.type === 'markt') v.onTerritory(); },
      removed: (b) => { v.removeBuilding(b); if (b.type === 'markt' || b.type === 'kontor') v.onTerritory(); if (this.selected === b) this.select(null); if (b.owner === HUMAN) sound.play('abriss'); },
      changed: (b) => v.changedBuilding(b),
      roads: () => v.onRoadsChanged(),
      trees: () => v.onTreesChanged(),
      felled: (k) => { v.onFelled(k); if (this.g.seen[k]) sound.play('baum', { x: k % this.g.size, z: Math.floor(k / this.g.size) }); },
      seen: () => v.onSeen(),
      // Meldung aus dem Spiel, auf Wunsch mit Ort (für den Meldungsverlauf)
      message: (t: string, k?: Art, at?: Ort) => this.toast(t, k ?? 'info', at),
      shot: (kind, fx, fy, tx, ty, hit) => this.onShot(kind, fx, fy, tx, ty, hit),
      sunk: (s) => { v.ships.sink(s.id); if (this.visible(s.x, s.y)) sound.play('versenkt', { x: s.x, z: s.y }); if (this.selShip === s) this.selectShip(null); },
      died: (u) => { v.onUnitDied(u); if (this.visible(u.x, u.y)) sound.play('fall', { x: u.x, z: u.y }); },
      chop: (u) => { if (this.visible(u.x, u.y)) sound.play('axt', { x: u.x, z: u.y }); },
    };
  }

  /** liegt ein Ort im entdeckten Gebiet? */
  visible(x: number, y: number) {
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
    this.hud.build(hud);
    this.build.buildPanel(hud);
    // Infofenster: feste Kopfknöpfe (▾ einklappen, ✕ schließen), darunter der wechselnde Inhalt
    const info = el('div', 'info hidden', `<div class="ibar"><button class="btn sq" id="infoFold" aria-label="Einklappen">▾</button><button class="btn sq close" id="infoX" aria-label="Schließen">✕</button></div><div class="ibody" id="infoBody"></div><div class="ifoot hidden" id="infoFoot"></div>`);
    info.id = 'info';
    hud.appendChild(info);
    $('#infoX').addEventListener('click', () => this.select(null));
    $('#infoFold').addEventListener('click', () => { this.infoFolded = !this.infoFolded; this.renderInfo(); });
    this.hud.buildBottom(hud);
    // oben in der Mitte: Bauhinweis (nicht antippbar) und darunter die Meldungen
    const topmid = el('div', 'topmid', '');
    topmid.id = 'topmid';
    hud.appendChild(topmid);
    this.build.buildHint(hud, topmid);
    topmid.appendChild(el('div', 'toasts', '')).id = 'toasts';
    // jeder Knopf klickt hörbar
    hud.addEventListener('pointerdown', (e) => { if ((e.target as HTMLElement).closest('button')) sound.play('klick'); });
    const modal = el('div', 'modal hidden', '');
    modal.id = 'modal';
    // Tipp auf den dunklen Hintergrund schließt Menü, Karte und Hilfe (nicht die Rückfragen)
    modal.addEventListener('click', (e) => { if (e.target === modal && this.modalDismiss) this.closeModal(); });
    hud.appendChild(modal);
  }

  // ---------- Modi (Bauen, Wege, Abreißen: siehe ui/build.ts) ----------

  setMode(m: Mode) { this.build.setMode(m); }

  // Für Tests und ältere Skripte: Weg-Zustand des Bau-Werkzeugs
  get roadStart() { return this.build.roadStart; }
  set roadStart(v: [number, number] | null) { this.build.roadStart = v; }
  get roadCells() { return this.build.roadCells; }
  get roadEndSet() { return this.build.roadEndSet; }
  roadTo(t: [number, number]) { this.build.roadTo(t); }

  // ---------- Tippen ----------

  private tap(x: number, y: number) {
    if (this.build.catOpen) { this.build.closeCat(); return; }
    if (this.mode.kind !== 'none') { this.build.tap(x, y); return; }
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
      const name = ship.type === 'pirat' ? 'Piratenschiff' : g.players[ship.owner]?.trader ? 'Händlerschiff (neutral)' : `Schiff von ${g.players[ship.owner]?.name}`;
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
    // Schiff ausgewählt: aufs Meer, aufs Land oder auf ein Gebäude getippt → hinsegeln
    if (this.selShip) { this.shipTap(x, y, t, b); return; }
    if (b) {
      sound.play('klick');
      // Häuptlingshütte der Ureinwohner: eigenes Fenster (sobald es Inhalt hat)
      if (this.natives.ready && this.natives.isHut(b)) { this.select(null); this.natives.open(b); return; }
      this.select(b);
      return;
    }
    // Land einer entdeckten Insel → Inselinfo
    if (t) {
      const k = this.g.idx(t[0], t[1]);
      const isl = this.g.islandOf[k];
      if (isl >= 0 && this.g.seen[k] && !this.g.area[k]) { this.showIsland(isl, t); return; }
    }
    this.select(null);
  }

  /** gewähltes Schiff steuern: Meer, Land (zur Küste) oder ein eigenes Gebäude (dort anlegen) */
  private shipTap(x: number, y: number, t: [number, number] | null, b: Building | undefined) {
    const g = this.g, s = this.selShip!;
    if (b && b.owner === HUMAN) {
      // zweiter Tipp auf dasselbe Gebäude – oder das Schiff liegt schon dort: Gebäude-Info öffnen
      if (this.shipGoal === b.id || this.shipAt(s, b)) { this.select(b); return; }
      const d = BUILDINGS[b.type];
      this.shipGoal = b.id;
      if (this.sailTo(s, b)) {
        sound.play('glocke');
        this.toast(`⛵ Kurs auf ${d.icon} ${d.name} – nochmal tippen zeigt die Info`, 'info');
      } else this.toast('Dorthin findet das Schiff keinen Weg – nochmal tippen zeigt die Info', 'bad');
      return;
    }
    const gt = this.view.pick(x, y, false) ?? t;
    // außerhalb der Karte: kurze Meldung, das Schiff bleibt gewählt
    if (!gt) { this.toast('Dort ist die Karte zu Ende – tippe aufs Meer oder auf eine Insel', 'info'); return; }
    this.shipGoal = null;
    const k = g.idx(gt[0], gt[1]);
    const water = g.tiles[k] === 0;
    // Ziel im Nebel: immer dieselbe Meldung – sie verrät nicht, ob dort Land ist
    const fog = !g.seen[k];
    if (this.steer(s, gt[0] + 0.5, gt[1] + 0.5)) { this.toast(fog || water ? '⛵ Kurs gesetzt' : '⛵ Kurs zur Küste', 'info'); sound.play('glocke'); }
    else this.toast('Dorthin findet das Schiff keinen Weg', 'bad');
  }

  /** Kurs auf einen Punkt; geht das nicht, dann so weit wie möglich in diese Richtung (auf der Linie vom Schiff dorthin) */
  private steer(s: Ship, x: number, y: number): boolean {
    const g = this.g;
    if (g.moveShip(s, x, y)) return true;
    for (let f = 0.9; f > 0.05; f -= 0.1) {
      const px = s.x + (x - s.x) * f, py = s.y + (y - s.y) * f;
      const tx = Math.floor(px), ty = Math.floor(py);
      if (g.inMap(tx, ty) && g.isWater(g.idx(tx, ty)) && g.moveShip(s, px, py)) return true;
    }
    return false;
  }

  /** Schiff liegt schon an diesem Gebäude (am Kontor: in Ladereichweite) */
  private shipAt(s: Ship, b: Building): boolean {
    if (s.path.length) return false;
    const g = this.g;
    if (b.type === 'kontor') return g.shipDock(s) === b;
    const [cx, cy] = g.center(b);
    return Math.hypot(cx - s.x, cy - s.y) <= BUILDINGS[b.type].size / 2 + 3.5;
  }

  /** zum Gebäude segeln: an das nächste erreichbare Wasserfeld daneben (beim Kontor in Ladereichweite) */
  private sailTo(s: Ship, b: Building): boolean {
    const g = this.g, [cx, cy] = g.center(b);
    const R = b.type === 'kontor' ? DOCK_RANGE : BUILDINGS[b.type].size / 2 + 3;
    const cand: [number, number, number][] = [];
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      if (!g.inMap(x, y) || !g.isWater(g.idx(x, y))) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= R) cand.push([x, y, d + Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y) * 0.01]);
    }
    cand.sort((a, c) => a[2] - c[2]);
    // erste paar Kandidaten probieren (ein Teich hinter dem Kontor ist nicht erreichbar)
    for (const [x, y] of cand.slice(0, 6)) if (g.moveShip(s, x + 0.5, y + 0.5)) return true;
    // kein Wasser in der Nähe (Gebäude im Landesinneren): so nah wie möglich an die Küste
    return g.moveShip(s, cx, cy);
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
  attack(owner: number, go: () => void) {
    const g = this.g, p = g.players[owner];
    if (!p || owner === HUMAN) return;
    // der freie Händler ist neutral und lässt sich nicht angreifen (src/trade.ts)
    if (p.trader) { this.toast('Der freie Händler ist neutral – ihn kann man nicht angreifen', 'info'); return; }
    if (atWar(g, HUMAN, owner)) { go(); return; }
    // freier Händler: neutral, nie angreifbar
    if (p.trader) { this.toast('Der freie Händler ist neutral – ihn kannst du nicht angreifen', 'info'); return; }
    // Ureinwohner: nur auf ausdrücklichen Befehl, kein Krieg
    if (p.natives) {
      this.ask('🪶 Die Ureinwohner angreifen?', 'Sie wehren sich nicht mit Waffen, aber sie werden nie wieder mit dir tauschen.', '⚔️ Angreifen', go);
      return;
    }
    if (p.pirate) {
      this.ask('🏴‍☠️ Die Piraten angreifen?', 'Dein gekaufter Schutz endet damit sofort.', '⚔️ Angreifen', () => { g.players[HUMAN].protectedUntil = 0; go(); });
      return;
    }
    this.ask(`⚔️ Krieg gegen ${p.name}?`, 'Mit diesem Gegner herrscht Frieden. Ein Angriff bedeutet Krieg – dann greifen dich auch dessen Soldaten, Türme und Schiffe an.', '⚔️ Krieg erklären', () => { declareWar(g, HUMAN, owner); go(); });
  }

  // ---------- Auswahl ----------

  selectUnits(list: Unit[]) {
    this.select(null);
    this.selUnits = list;
    this.view.units.selected = new Set(list.map((u) => u.id));
    this.renderInfo();
    if (list.length) this.keepLeft(list[0].x, list[0].y);
  }

  selectShip(s: Ship | null) {
    this.select(null);
    this.selShip = s;
    this.view.ships.selected = s ? s.id : null;
    this.renderInfo();
    if (s) this.keepLeft(s.x, s.y);
  }

  select(b: Building | null) {
    this.selected = b;
    this.showStorage = false;
    this.islandInfo = null;
    this.shipGoal = null;
    if (this.selShip) { this.selShip = null; this.view.ships.selected = null; }
    if (this.selUnits.length) { this.selUnits = []; this.view.units.selected = new Set(); }
    this.view.setSelected(b);
    if (b) this.build.closeCat();
    this.renderInfo();
    if (b) { const [cx, cy] = this.g.center(b); this.keepLeft(cx, cy); }
  }

  /** Inselinfo zeigen (at = angetippte Stelle, die Kamera hält sie sichtbar) */
  showIsland(isl: number, at?: [number, number]) {
    this.select(null);
    this.islandInfo = isl;
    this.renderInfo();
    if (at) this.keepLeft(at[0] + 0.5, at[1] + 0.5);
  }

  /** Lager & Bilanz der Insel im Blick */
  openStorage() {
    this.select(null);
    this.build.closeCat();
    this.showStorage = true;
    this.renderInfo();
  }

  /** Kamera sanft so verschieben, dass ein Punkt im freien Bereich liegt (nicht unter dem Infofenster) */
  keepLeft(x: number, y: number) {
    const v = this.view, cam = v.camera;
    v.updateCamera();
    cam.updateMatrixWorld();
    const p = cam.position.clone().set(x, LAND_Y, y).project(cam);
    if (p.z > 1) return; // hinter der Kamera
    const rc = v.renderer.domElement.getBoundingClientRect();
    const sx = rc.left + ((p.x + 1) / 2) * rc.width, sy = rc.top + ((1 - p.y) / 2) * rc.height;
    // freier Bereich: rechts der Baumenü-Spalte, links vom Infofenster, unter der Oberleiste
    const box = $('#info');
    const ir = box.classList.contains('hidden') ? null : box.getBoundingClientRect();
    const lr = document.querySelector<HTMLElement>('#hud .left')?.getBoundingClientRect();
    const tr = document.querySelector<HTMLElement>('#hud .top')?.getBoundingClientRect();
    const left = Math.max(rc.left, lr && lr.width ? lr.right : rc.left) + 24;
    const right = (ir && ir.width ? ir.left : rc.right) - 24;
    const top = (tr ? tr.bottom : rc.top) + 30, bottom = rc.bottom - 50;
    if (right - left < 60 || bottom - top < 60) return;
    const inX = sx >= left && sx <= right, inY = sy >= top && sy <= bottom;
    if (inX && inY) return; // schon gut zu sehen
    const at = v.groundPoint(inX ? sx : (left + right) / 2, inY ? sy : (top + bottom) / 2);
    if (!at) return;
    const r = v.rig, tx0 = r.tx, tz0 = r.tz, dx = x - at.x, dz = y - at.z;
    this.input.animate(380, (e) => { r.tx = tx0 + dx * e; r.tz = tz0 + dz * e; });
  }

  // ---------- Infofenster ----------

  /** Inhalt des Infofensters setzen – nur wenn er sich geändert hat (sonst gehen Tipps auf Knöpfe verloren).
   *  foot = Knöpfe der festen Fußleiste (leer = keine Leiste).
   *  true = neu aufgebaut: dann die Knöpfe darin neu verbinden */
  setInfo(html: string, foot = ''): boolean {
    const body = $('#infoBody') as HTMLElement & { _h?: string };
    const key = html + '\u0000' + foot;
    if (body._h === key) return false;
    body._h = key;
    body.innerHTML = html;
    // Fußleiste: Hauptknöpfe (Abreißen, Bewaffnen, Ausbilden, Bestellen …) bleiben beim Wischen stehen
    const f = $('#infoFoot');
    f.innerHTML = foot;
    f.classList.toggle('hidden', !foot);
    return true;
  }

  renderInfo() {
    const box = $('#info');
    const b = this.selected;
    if (this.selUnits.length) { this.selUnits = this.selUnits.filter((u) => this.g.units.includes(u) && u.ship === undefined); if (!this.selUnits.length) this.view.units.selected = new Set(); }
    if (!b && !this.showStorage && !this.selShip && this.islandInfo === null && !this.selUnits.length) {
      box.classList.add('hidden');
      document.body.classList.remove('info-open', 'info-folded');
      this.infoKey = '';
      return;
    }
    // andere Auswahl: Inhalt sicher neu aufbauen (Knöpfe gehören zum neuen Objekt) und wieder aufklappen
    const key = `${b?.id ?? ''}|${this.showStorage}|${this.selShip?.id ?? ''}|${this.islandInfo ?? ''}|${this.selUnits.map((u) => u.id).join(',')}`;
    if (key !== this.infoKey) {
      this.infoKey = key;
      this.infoFolded = false;
      ($('#infoBody') as HTMLElement & { _h?: string })._h = undefined;
    }
    box.classList.remove('hidden');
    box.classList.toggle('folded', this.infoFolded);
    box.classList.toggle('slim', !this.selShip && this.selUnits.length > 0);
    document.body.classList.add('info-open');
    document.body.classList.toggle('info-folded', this.infoFolded);
    const fold = $('#infoFold');
    fold.textContent = this.infoFolded ? '▸' : '▾';
    fold.setAttribute('aria-label', this.infoFolded ? 'Aufklappen' : 'Einklappen');
    if (this.selShip) this.ship.render(this.selShip);
    else if (this.selUnits.length) this.units.render(this.selUnits);
    else if (this.islandInfo !== null) this.info.renderIsland(this.islandInfo);
    else this.info.render(b, this.showStorage);
  }

  // ---------- Fenster (Menü, Karte, Hilfe, Diplomatie: siehe ui/windows.ts, ui/diplomacy.ts) ----------

  openMap() { this.windows.openMap(); }
  openMenu() { this.windows.openMenu(); }
  openHelp() { this.windows.openHelp(); }
  openDiplomacy() { this.diplomacy.open(); }

  /** Gegner, die man schon getroffen hat (Gebäude oder Schiff im entdeckten Gebiet) oder mit denen Krieg herrscht */
  met(id: number): boolean {
    const g = this.g;
    if (atWar(g, HUMAN, id)) return true;
    return g.buildings.some((b) => b.owner === id && g.seen[g.idx(b.x, b.y)] === 1) || g.ships.some((s) => s.owner === id && this.visible(s.x, s.y));
  }

  // ---------- Leisten ----------

  updateHud() {
    const g = this.g;
    this.hud.update();
    if (this.selShip || this.selUnits.length) this.renderInfo();
    // Niederlage: festes Fenster
    if (g.players[HUMAN].defeated && !this.lostShown) { this.lostShown = true; this.windows.showLost(); }
    if (!g.players[HUMAN].defeated) this.lostShown = false;
    this.build.refresh();
    if (this.selected || this.showStorage) this.renderInfo();
    this.hud.updateQuest();
  }

  togglePause() {
    this.paused = !this.paused;
    this.hud.updateSpeedBtn();
  }

  // ---------- Meldungen ----------

  /** kurze Meldung oben; jede Meldung geht auch in den Meldungsverlauf (mit Ort, falls bekannt) */
  toast(text: string, kind: Art = 'info', at?: Ort) {
    this.log.add(text, kind, at);
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
    // Art als eigene Klasse (toast-info …) – „info“ und „good“ allein sind schon Infofenster und Warenknöpfe
    const t = el('div', `toast toast-${kind}`, text);
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

  // ---------- Fensterrahmen, Rückfragen ----------

  /** Fenster in der Bildmitte: Kopf mit Titel (und ✕), Inhalt scrollt, Fuß mit dem Hauptknopf bleibt unten sichtbar.
   *  Gibt die Box zurück, damit der Aufrufer seine Knöpfe verbinden kann. */
  dialog(o: DialogOpts): HTMLElement {
    const m = $('#modal');
    m.classList.remove('hidden');
    this.modalDismiss = o.dismiss !== false;
    m.innerHTML = `<div class="box ${o.cls ?? ''}" role="dialog" aria-modal="true">
      <div class="dhead"><h2>${o.title}</h2>${this.modalDismiss ? '<button class="btn sq dx" aria-label="Schließen">✕</button>' : ''}</div>
      <div class="dbody">${o.body}</div>${o.foot ? `<div class="dfoot">${o.foot}</div>` : ''}</div>`;
    m.querySelector('.dx')?.addEventListener('click', () => this.closeModal());
    return m.querySelector('.box') as HTMLElement;
  }

  /** Eigene Rückfrage (Browser-Dialoge sind nicht überall erlaubt). onNo: z. B. zurück zum vorigen Fenster */
  ask(title: string, text: string, yes: string, onYes: () => void, onNo?: () => void) {
    this.dialog({
      title, cls: 'ask', dismiss: false,
      body: `<p class="sub">${text}</p>`,
      foot: `<div class="row2"><button class="btn" id="askNo">Abbrechen</button><button class="btn danger" id="askYes">${yes}</button></div>`,
    });
    $('#askNo').addEventListener('click', () => { this.closeModal(); onNo?.(); });
    $('#askYes').addEventListener('click', () => { this.closeModal(); onYes(); });
  }

  closeModal() {
    if (!$('#modal').classList.contains('hidden')) sound.play('zu');
    $('#modal').classList.add('hidden');
    this.modalDismiss = false;
  }
}
