// Spiellogik: Inselwelt, Spieler, Schiffe, Bauen, Wirtschaft, Speichern.
// Wie im Vorbild hat jede Insel ihr eigenes Lager (je Spieler); Geld ist global.
import {
  BUILDINGS, BUILD_GOODS, BuildingDef, BuildingId, Cost, GOOD, GOODS, GoodId, KONTOR_LEVELS, PRICES, Res, SHIPS, SLOT_CAP,
  START_CARGO, START_MONEY, ShipType, TIERS, UnitType,
} from './data';
import { findSeaPath, seaPass, seaReach } from './path';
import { thinkAI } from './ai';
import { tickCombat, unitUpkeep } from './combat';
import { SYSTEMS } from './systems';
import { Island, PFLANZEN, T, WORLD_SIZE, WORLD_SIZES, generateWorld, rng } from './world';
import { SCHWIERIGKEIT, stufe } from './schwierigkeit';
import { book } from './stats';
import { KEIN_FESTES_LAND, landVorbereiten, trockeneFlaeche } from './landhoehe'; // (KL)

/** zuWeit = kein Marktkarren kommt hin (zu weit von Kontor/Marktplatz); aus = vom Spieler ruhen gelassen */
export type Status = 'ok' | 'keinWeg' | 'rohstoff' | 'lagerVoll' | 'keinWald' | 'keinWasser' | 'wohnen' | 'erschoepft' | 'zuWeit' | 'aus';
export type { Res } from './data';

export interface Building {
  id: number;
  type: BuildingId;
  x: number;
  y: number;
  owner: number;
  island: number;
  progress: number;
  loaded: boolean;
  eff: number;
  status: Status;
  missing: GoodId[];
  active: number;
  tier: number;
  residents: number;
  need: Partial<Record<GoodId, number>>;
  demand: Partial<Record<GoodId, number>>;
  short: Partial<Record<GoodId, boolean>>;
  happy: number;
  growT: number;
  upT: number;
  /** eigenes kleines Lager des Betriebs (wartet auf den Marktkarren) */
  stock: number;
  /** Feld, an dem gerade geerntet wird (Baum, Fanggrund, Wild …), -1 = keins */
  target?: number;
  cut?: boolean;
  /** Kontor-Ausbaustufe (0 = Kontor I) */
  level?: number;
  /** Werft: Schiff im Bau */
  job?: { ship: ShipType; t: number };
  /** Trefferpunkte (fehlt = unbeschädigt) */
  hp?: number;
  /** Burg: Soldaten in Ausbildung (Restzeit in Sekunden) */
  train?: { type: UnitType; t: number }[];
  /** Turm: Zeit bis zum nächsten Schuss */
  cd?: number;
  /** von Piraten gerade geplündert: bis dahin in Ruhe gelassen */
  safeUntil?: number;
  /** Betrieb vom Spieler ruhen gelassen: arbeitet nicht, zahlt nur den Ruhe-Unterhalt */
  off?: boolean;
  /** Kontor: Baumaterial (Holz, Werkzeug, Steine) nicht für Haus-Aufstiege hergeben */
  matLock?: boolean;
  /** Haus: so lange (Sekunden) schon sehr unzufrieden – nach 90 s steigt es eine Stufe ab */
  downT?: number;
  /** Haus: warum zuletzt Bewohner ausgezogen sind (für Meldungen und die Statistik) */
  leave?: 'hunger' | 'steuern' | 'mangel';
}

/** Soldat auf dem Land (oder an Bord eines Schiffs) */
export interface Unit {
  id: number;
  type: UnitType;
  owner: number;
  x: number;
  y: number;
  dir: number;
  hp: number;
  path: [number, number][];
  /** Angriffsziel (Soldat, Gebäude oder Schiff, per id) – vom Spieler befohlen oder selbst gewählt */
  target?: number;
  /** true = Ziel wurde befohlen (nicht selbst gesucht) */
  ordered?: boolean;
  /** befohlenes Ziel, zu dem nach einem Abwehrkampf zurückgekehrt wird */
  then?: number;
  /** Schiff, an dem eingestiegen werden soll */
  board?: number;
  /** an Bord dieses Schiffs (unsichtbar) */
  ship?: number;
  /** Zeit bis zum nächsten Schlag/Schuss */
  cd: number;
  /** Spielzeit des letzten Angriffs (für die Ausholbewegung) */
  atk?: number;
  /** Ziel des laufenden Wegs (zum Neuberechnen) */
  goal?: [number, number];
  repath?: number;
  /** Laufziel, dessen Weg noch gesucht wird (gestaffelt) */
  dest?: [number, number];
  /** Bäume fällen: Waldfeld (Index), an dem der Soldat hackt, und wie lange schon (Sekunden) */
  fell?: number;
  chop?: number;
}

/** Marktkarren: holt Waren von Betrieben ab und bringt sie ins Inselllager */
export interface Cart {
  id: number;
  home: number; // Kontor/Marktplatz
  x: number;
  y: number;
  path: [number, number][];
  state: 'idle' | 'hin' | 'zurueck';
  target: number;
  g: GoodId | null;
  n: number;
}

export interface Slot { g: GoodId | null; n: number }

export interface Ship {
  id: number;
  type?: ShipType;
  owner: number;
  name: string;
  x: number;
  y: number;
  dir: number;
  path: [number, number][];
  slots: Slot[];
  /** Trefferpunkte (fehlt = voll) */
  hp?: number;
  /** geladene Kanonen */
  guns?: number;
  /** Angriffsziel (Schiff, Gebäude oder Soldat, per id) */
  target?: number;
  cd?: number;
  /** Soldaten an Bord (ids) */
  troops?: number[];
  /** Spielzeit der letzten Salve (für Mündungsfeuer) */
  shotT?: number;
  /** von Piraten gerade ausgeraubt: bis dahin in Ruhe gelassen */
  safeUntil?: number;
  /** angetipptes Ziel der laufenden Fahrt (für die Neuplanung, wenn im Nebel Land auftaucht) */
  goal?: [number, number];
  /** weiße Flagge gehisst (combat.ts setWhiteFlag) – steht im Spielstand, damit ein Kriegsschiff mit Flagge nach dem
   *  Laden nicht plötzlich als Reizung zählt */
  white?: boolean;
  /** Patrouille zwischen zwei Punkten (x1, y1, x2, y2), siehe combat.ts patrol() */
  patrol?: [number, number, number, number];
}

/** Gedächtnis eines Computergegners */
export interface AIState { phase: 'suchen' | 'fahren' | 'gruenden' | 'aufbau'; island: number; t: number; tries: number; grid: boolean; site?: [number, number]; bad?: number[] }

export interface Player {
  id: number; name: string; color: number; ai: boolean; money: number; brain?: AIState;
  /** mit diesen Spielern herrscht Krieg */
  war?: number[];
  /** Piraten (immer feindlich, außer man hat Schutz gekauft) */
  pirate?: boolean;
  /** besiegt: hat keine Gebäude und Schiffe mehr */
  defeated?: boolean;
  /** Schutz vor Piraten bis zu dieser Spielzeit */
  protectedUntil?: number;
  /** Zeitpunkt des letzten Friedensschlusses je Gegner */
  peaceAt?: Record<number, number>;
  /** seit dieser Spielzeit kann sich der Spieler wehren (200 Siedler) */
  defendAt?: number;
  /** KI: Kriegserklärung zu diesem Zeitpunkt (vorher gewarnt) */
  warnAt?: number;
  /** Spieler: Zeit der letzten Kriegserklärung gegen ihn */
  lastWarAt?: number;
  /** Ruhe vor Piraten je Insel bis zu dieser Zeit */
  restAt?: Record<number, number>;
  /** Spieler: bis dahin keine Kriegserklärungen (nach einem Neubeginn) */
  graceUntil?: number;
  /** KI: nach dem Abrüsten bis dahin keine neue Vorwarnung */
  calmUntil?: number;
  /** freier Händler (neutral, unangreifbar) */
  trader?: boolean;
  /** Ureinwohner (neutral, nur auf ausdrücklichen Befehl angreifbar) */
  natives?: boolean;
  /** Steuersatz in Prozent je Stufe (Pioniere … Aristokraten); fehlt = Standardsatz (TierDef.taxStd).
   *  Computergegner nutzen immer den Standardsatz. */
  tax?: number[];
  /** Schulden: so lange (Spielsekunden) schon unter −10 000 Taler */
  debtT?: number;
  /** Schulden: schon gewarnt bei −2 000 (1), −5 000 (2), −10 000 (3) */
  debtWarn?: number;
  /** wie oft die Schulden erlassen wurden (gibt später Punktabzug) */
  erlass?: number;
  /** warum das Spiel verloren ist (fehlt = alles verloren: keine Gebäude und Schiffe mehr) */
  lost?: 'bankrott';
}

type Goods = Record<GoodId, number>;

export type Schwierigkeit = 'leicht' | 'normal' | 'schwer';
export type Ereignisse = 'aus' | 'mild' | 'normal';

/** Einstellungen beim Spielstart (werden im Spielstand gespeichert) */
export interface GameOptions {
  schwierigkeit: Schwierigkeit;
  /** Startgeld des Spielers (Taler) */
  startgeld: number;
  /** Piraten an oder aus */
  piraten: boolean;
  /** Feuer, Pest, Dürre … (wirkt, sobald es die Ereignisse gibt) */
  ereignisse: Ereignisse;
  /** Spielziel (id aus GOALS in src/score.ts) */
  ziel: string;
  /** Weltgröße (Felder je Seite, aus WORLD_SIZES) */
  weltgroesse: number;
}

/** Standard = Schwierigkeit „normal“ (15 000 Taler, Piraten, Ereignisse mild, Endlosspiel, 240 × 240 Felder) */
export const DEFAULT_OPTIONS: Readonly<GameOptions> = Object.freeze({
  schwierigkeit: 'normal', startgeld: SCHWIERIGKEIT.normal.startgeld, piraten: true, ereignisse: 'mild', ziel: 'endlos', weltgroesse: WORLD_SIZE,
});

/** Ort einer Meldung (Feldkoordinaten wie x/y der Gebäude) */
export interface MsgAt { x: number; y: number }
export type MsgKind = 'info' | 'good' | 'bad';

export interface SaveData {
  /** 3 = alt (Welt kam aus der Startzahl), 4 = Welt steht vollständig im Spielstand,
   *  5 = Wirtschaft wie 1602 (Steuersätze, Betriebe ruhen, Baumaterial-Sperre, Schulden – alles neue Felder sind
   *  freiwillig, ältere Stände laufen mit den Standardwerten weiter) */
  v: 3 | 4 | 5 | 6;
  seed: number;
  tiles: string;
  roads: string;
  seen: string;
  buildings: Building[];
  ships: Ship[];
  players: Player[];
  lager: Record<string, Goods>;
  nextId: number;
  time: number;
  quest: number;
  unlocked?: BuildingId[];
  best?: number[];
  res?: { trees: string; fish: string; wild: string; weide: string; feld?: string };
  /** verbleibendes Erz je Insel */
  ore?: number[];
  units?: Unit[];
  pirate?: { t: number; sunk: number; seen: boolean; victories?: number };
  /** ab v4: Inselwelt (damit spätere Änderungen am Weltgenerator alte Stände nicht verändern) */
  world?: { size: number; islandOf: string; islands: Island[]; starts: [number, number][] };
  /** ab v4: ausdrücklich gewählte Einstellungen (der Rest kommt aus DEFAULT_OPTIONS) */
  opts?: Partial<GameOptions>;
  /** ab v4: Zustand des Zufallsgenerators g.rng() */
  rng?: number;
  /** ab v4: Zustand der Spielteile (src/systems.ts), je Spielteil unter seiner id */
  ext?: Record<string, unknown>;
}

export interface GameEvents {
  added(b: Building): void;
  removed(b: Building): void;
  changed(b: Building): void;
  roads(): void;
  trees(): void;
  /** ein Baum wurde gefällt (Feld-Index) */
  felled(k: number): void;
  seen(): void;
  /** Schuss oder Schlag: Art, von, nach, getroffen? */
  shot(kind: ShotKind, fx: number, fy: number, tx: number, ty: number, hit: boolean): void;
  /** Schiff versenkt (wird danach aus der Liste entfernt) */
  sunk(s: Ship): void;
  /** Einheit gefallen */
  died(u: Unit): void;
  /** Soldat hackt an einem Baum (ein Axthieb; für den Klang) */
  chop?(u: Unit): void;
  /** Meldung; at = Ort im Spiel (für „Hinschauen“), fehlt bei allgemeinen Meldungen */
  message(text: string, kind?: MsgKind, at?: MsgAt): void;
}

export interface Check { ok: boolean; reason?: string }

/** Ergebnis von undoBuild: wie viele Teile zurückgenommen wurden und was erstattet wurde */
export interface UndoResult extends Check { n: number; refund: Cost }
/** Ergebnis von demolishArea: was abgerissen wird (bzw. wurde) und was zurückkommt */
export interface AreaResult { buildings: number; roads: number; kept: number; refund: Cost }

/** schwert = Nahkampf, muskete, kanone (Kanonier), turm, schiff (Breitseite) */
export type ShotKind = 'schwert' | 'muskete' | 'kanone' | 'turm' | 'schiff';

const LAGER: BuildingId[] = ['kontor', 'markt'];
/** Schlüssel des Spielstands (der Name blieb seit Version 3 gleich; die Version steht im Stand selbst: v) */
const SAVE_KEY = 'neue-ufer-save-v4';
/** hierhin wird ein unlesbarer Stand gesichert, bevor ein neues Spiel ihn überschreiben kann */
const BROKEN_KEY = 'neue-ufer-save-sicherung';
/** 6: Ereignisse (S3), Meldungsverlauf und Nebenaufgaben (U3), Merkzettel der Bedienung (U4), Gegner-Zustand (KI2) */
export const SAVE_VERSION = 6;
/** So lange (echte Sekunden) lässt sich ein Bau mit voller Erstattung zurücknehmen */
export const UNDO_SECONDS = 10;
export const HUMAN = 0;
const SHIP_SPEED = 3.2; // Kacheln pro Spielsekunde
const SHIP_SIGHT = 9;
/** Nachwachsen je Sekunde (voller Bestand = 1): Baum ~5 min, Fischgrund ~2,5 min, Wild ~6,5 min, Weide ~1,5 min */
const REGEN: Record<Res, number> = { baum: 1 / 300, fisch: 1 / 150, wild: 1 / 400, weide: 1 / 90, feld: 1 / 100 };
const CART_SPEED = 1.8; // Felder pro Spielsekunde
const CART_CAP = 10; // Tonnen pro Fahrt
/** Pflasterwege: so viel schneller kommen Marktkarren voran (wie im Vorbild etwa ein Drittel) */
const PFLASTER_TEMPO = 1.3;
/** Steuerregler: höchster einstellbarer Satz in Prozent */
export const TAX_MAX = 60;
/** Bankrott: so tief im Minus (Taler) und so lange (Spielsekunden) – dann ist das Spiel verloren */
export const BANKROTT = { grenze: -10000, zeit: 600, warnungen: [-2000, -5000] as const };
export const DOCK_RANGE = 5; // so nah muss ein Schiff am Kontor/Bauplatz sein

/** Computergegner (eigene Namen und Farben) */
export const OPPONENTS = [
  // Farben der Gegner: nie Rot (heißt auf den Karten „Feind im Krieg“) und nie Gelb (heißt „deine Schiffe“)
  { name: 'Hendrik van Dalen', color: 0x8a5cc8 },
  { name: 'Morwenna Grey', color: 0xd0609e },
  { name: 'Baron von Kessel', color: 0x4f9a4a },
];

const enc = (a: ArrayLike<number>) => { let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i] + 48); return s; };
const encR = (a: Float32Array) => { let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(48 + Math.round(Math.max(0, Math.min(1, a[i])) * 40)); return s; };
const dec = (s: string, n: number, what: string) => {
  if (typeof s !== 'string' || s.length !== n) throw new Error(`Spielstand beschädigt (${what})`);
  return Uint8Array.from(s, (c) => c.charCodeAt(0) - 48);
};
/** Inselnummern je Feld kurz schreiben: „Wert*Anzahl“ hintereinander (Meer ist eine lange Folge von -1) */
const encRuns = (a: Int16Array) => {
  const out: string[] = [];
  for (let i = 0; i < a.length;) { let j = i; while (j < a.length && a[j] === a[i]) j++; out.push(`${a[i]}*${j - i}`); i = j; }
  return out.join(',');
};
const decRuns = (s: string, n: number) => {
  const a = new Int16Array(n);
  let i = 0;
  for (const part of s.split(',')) {
    const [v, c] = part.split('*').map(Number);
    if (!Number.isInteger(v) || !Number.isInteger(c) || c < 0 || i + c > n) throw new Error('Spielstand beschädigt (Inseln)');
    a.fill(v, i, i + c); i += c;
  }
  if (i !== n) throw new Error('Spielstand beschädigt (Inseln)');
  return a;
};
const zeroGoods = (): Goods => Object.fromEntries(GOODS.map((g) => [g.id, 0])) as Goods;
const EMPTY: Goods = Object.freeze(zeroGoods()) as Goods;
/** Uhr für das Rückgängigmachen (echte Zeit, damit es bei 4-fachem Tempo genauso lange geht) */
const wallClock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
const COST_KEYS = ['taler', ...BUILD_GOODS] as const;
/** Kosten aufsummieren (für Gesamt-Erstattungen) */
const addCost = (sum: Cost, c: Cost) => {
  for (const k of COST_KEYS) if (c[k]) sum[k] = (sum[k] ?? 0) + c[k]!;
  return sum;
};
/** Was ein Abriss zurückgibt: die Hälfte des Baumaterials, keine Taler */
const halfRefund = (c: Cost): Cost => {
  const r: Cost = {};
  for (const k of BUILD_GOODS) { const v = Math.floor((c[k] ?? 0) / 2); if (v) r[k] = v; }
  return r;
};

export class Game {
  seed = 1;
  size = WORLD_SIZE;
  tiles: Uint8Array = new Uint8Array(0);
  islandOf: Int16Array = new Int16Array(0);
  islands: Island[] = [];
  starts: [number, number][] = [];
  roads: Uint8Array = new Uint8Array(0);
  seen: Uint8Array = new Uint8Array(0);
  occ = new Int32Array(0);
  /** Rohstoffbestände je Feld (0..1): Reife der Bäume, Fisch, Wild, Weide; fishCap = Ergiebigkeit des Fanggrunds */
  trees: Float32Array = new Float32Array(0);
  fish: Float32Array = new Float32Array(0);
  fishCap: Float32Array = new Float32Array(0);
  wild: Float32Array = new Float32Array(0);
  weide: Float32Array = new Float32Array(0);
  feld: Float32Array = new Float32Array(0);
  private regenT = 0;
  /** wie viele Ernte-Betriebe je Rohstoff ein Feld nutzen (für die Ergiebigkeit) */
  private share: Partial<Record<Res, Uint8Array>> = {};
  buildings: Building[] = [];
  byId = new Map<number, Building>();
  ships: Ship[] = [];
  units: Unit[] = [];
  /** Für flüssige Darstellung: Position vor dem letzten Rechenschritt und Anteil (0..1) bis zum nächsten */
  private prev = new Map<number, [number, number, number]>();
  /** Arbeitsfortschritt der Betriebe vor dem letzten Rechenschritt (für flüssige Arbeiter/Fischerboote) */
  private prevProg = new Map<number, number>();
  alpha = 1;
  /** Piraten: Zeit bis zum nächsten Auftauchen, versenkte Piratenschiffe, schon gesichtet? */
  pirateT = 0;
  pirateSunk = 0;
  pirateSeen = false;
  /** Siege über Gegner/Piraten: so viele Triumphbögen darf man bauen */
  victories = 0;
  carts: Cart[] = [];
  players: Player[] = [];
  lager: Record<string, Goods> = {};
  nextId = 1;
  time = 0;
  quest = 0;
  /** Insel, deren Lager die Oberfläche gerade zeigt (-1 = keine) */
  focus = -1;

  // abgeleitete Werte
  own: Int8Array = new Int8Array(0); // Besitzer je Kachel (-1 = frei)
  area: Uint8Array = new Uint8Array(0); // Baugebiet des menschlichen Spielers
  roadLinked: Uint8Array = new Uint8Array(0);
  linked = new Set<number>();
  /** Betriebe, die ein Marktkarren erreicht (in Abholweite eines eigenen Kontors oder Marktplatzes) */
  inReach = new Set<number>();
  coverage = new Map<number, Set<BuildingId>>();
  cap = new Map<string, number>();
  private seenDirty = false;
  private sightT = 0;
  /** Bereits freigeschaltete Gebäude (bleiben freigeschaltet) */
  unlocked = new Set<BuildingId>();
  /** höchste je erreichte Einwohnerzahl je Stufe (Freischaltungen bleiben erhalten, wenn sie wieder sinkt) */
  best: number[] = [0, 0, 0, 0, 0];
  private unlockT = 0;
  private cartT = 0;
  /** Einstellungen dieses Spiels (vollständig) und die ausdrücklich gewählten (nur die werden gespeichert) */
  opts: GameOptions = { ...DEFAULT_OPTIONS };
  private optsSet: Partial<GameOptions> = {};
  /** Zustand des gespeicherten Zufallsgenerators (siehe rng()) */
  private rngState = 1;
  /** Änderungszähler: steigt bei jedem Bauen, Abreißen, Wegebau oder Besitzwechsel (für Zwischenspeicher anderer Teile) */
  buildVersion = 0;
  /** steigt, wenn neue Felder entdeckt werden (Schiffe planen dann ihren Kurs neu) */
  private seenVer = 0;
  private planSeen = new Map<number, number>();
  /** Fahrt ins Unbekannte (Ziel im Nebel): erlaubte Gesamtstrecke und schon gefahrene Strecke */
  private fogRun = new Map<number, { budget: number; run: number }>();
  /** Zwischenspeicher für maxPop (wird bei jeder Änderung an Häusern geleert) */
  private popCache = new Map<number, number>();
  /** frisch Gebautes für undoBuild: Bauzeit (echte Sekunden), bezahlte Kosten, gerodete Waldfelder */
  private recent = new Map<number, { t: number; paid: Cost; cleared: number[]; ship?: number }>();
  private recentRoads = new Map<number, { t: number; owner: number; prev: number; paid: Cost; cleared: boolean }>();
  /** zuletzt ausgezahlte Aufgaben-Belohnung (echte Sekunden): Nimmt „Rückgängig“ den Bau zurück, der die Aufgabe
   *  erfüllt hat, gilt die Aufgabe wieder als offen und die Belohnung geht zurück */
  private questPaid: { i: number; reward: number; t: number } | null = null;
  /** Verbrauch der Bewohner je Ware und Minute, je Besitzer und Insel (einmal je Spielsekunde neu gezählt) */
  private useCache = new Map<string, Partial<Record<GoodId, number>>>();
  private useT = -1;
  /** letzte Meldung „Bewohner ziehen aus“ je Insel (Spielzeit), damit sie nicht ständig kommt */
  private leaveMsgT = new Map<string, number>();

  ev: GameEvents = { added() {}, removed() {}, changed() {}, roads() {}, trees() {}, felled() {}, seen() {}, message() {}, shot() {}, sunk() {}, died() {} };

  // ---------- Erstellen / Laden ----------

  /** Welt aus der Startzahl erzeugen (legacy = alte Inselregeln für Spielstände bis Version 3) */
  private setupWorld(seed: number, size = WORLD_SIZE, legacy = false) {
    const w = generateWorld(seed, size, legacy);
    this.seed = seed;
    this.size = w.size;
    this.tiles = w.tiles;
    this.islandOf = w.island;
    this.islands = w.islands;
    this.starts = w.starts;
    this.setupGrids();
  }

  /** leere Raster in Weltgröße, dann die Rohstoffe aus der Landschaft */
  private setupGrids() {
    const N = this.size * this.size;
    this.roads = new Uint8Array(N);
    this.seen = new Uint8Array(N);
    this.occ = new Int32Array(N);
    this.initResources(this.seed);
  }

  /** Startbestände: Wald voll, Fischgründe je nach Lage (Schwärme an Küsten, reiche und arme Stellen) */
  private initResources(seed: number) {
    const N = this.size, NN = N * N;
    this.trees = new Float32Array(NN); this.wild = new Float32Array(NN); this.weide = new Float32Array(NN); this.feld = new Float32Array(NN);
    this.fish = new Float32Array(NN); this.fishCap = new Float32Array(NN);
    const dist = new Float32Array(NN).fill(99);
    const q: number[] = [];
    for (let k = 0; k < NN; k++) if (this.tiles[k] !== T.Wasser) { dist[k] = 0; q.push(k); }
    for (let h = 0; h < q.length; h++) {
      const k = q[h], x = k % N, y = (k / N) | 0;
      if (dist[k] >= 6) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const nk = ny * N + nx;
        if (dist[nk] > dist[k] + 1) { dist[nk] = dist[k] + 1; q.push(nk); }
      }
    }
    const r = rng(seed + 501);
    // grobe Schwarm-Flecken: Zufallszentren mit weichem Rand
    const shoals: [number, number, number][] = [];
    for (let i = 0; i < 140; i++) shoals.push([r() * N, r() * N, 3 + r() * 5]);
    for (let k = 0; k < NN; k++) {
      const t = this.tiles[k];
      if (t === T.Wald) { this.trees[k] = r() < 0.85 ? 1 : 0.3 + r() * 0.6; this.wild[k] = 1; }
      if (t === T.Gras || t === T.Sand) { this.weide[k] = 1; this.feld[k] = 1; }
      if (t === T.Wasser && dist[k] <= 5) {
        const x = k % N + 0.5, y = ((k / N) | 0) + 0.5;
        let sh = 0;
        for (const [sx, sy, sr] of shoals) { const d = Math.hypot(x - sx, y - sy); if (d < sr) sh = Math.max(sh, 1 - d / sr); }
        const depth = dist[k] <= 1 ? 0.55 : dist[k] <= 3 ? 1 : 0.7;
        this.fishCap[k] = Math.min(1, (0.25 + sh * 0.9) * depth);
        this.fish[k] = this.fishCap[k];
      }
    }
  }

  /**
   * Neues Spiel. opts: Einstellungen (fehlende Werte = DEFAULT_OPTIONS, also das bisherige Spiel).
   * Das Startgeld gilt für den Spieler (ohne Angabe: das der Schwierigkeit); die Computergegner starten
   * mit START_MONEY mal dem Faktor der Schwierigkeit (src/schwierigkeit.ts).
   */
  static create(seed: number, opponents = 2, opts: Partial<GameOptions> = {}): Game {
    const g = new Game();
    const w = stufe(opts.schwierigkeit);
    g.optsSet = { ...opts };
    g.opts = { ...DEFAULT_OPTIONS, startgeld: w.startgeld, ...opts };
    if (!WORLD_SIZES.includes(g.opts.weltgroesse)) g.opts.weltgroesse = WORLD_SIZE;
    if (!(g.opts.startgeld >= 0)) g.opts.startgeld = w.startgeld;
    g.setupWorld(seed, g.opts.weltgroesse);
    g.rngState = (seed ^ 0x9e3779b9) >>> 0 || 1;
    g.players = [{ id: HUMAN, name: 'Du', color: 0x2f6fd0, ai: false, money: g.opts.startgeld }];
    for (let i = 0; i < Math.min(3, opponents); i++) {
      const o = OPPONENTS[i];
      g.players.push({ id: i + 1, name: o.name, color: o.color, ai: true, money: Math.round(START_MONEY * w.kiKasse), brain: { phase: 'suchen', island: -1, t: 0, tries: 0, grid: false } });
    }
    const shipNames = ['Morgenstern', 'Seeadler', 'Goldene Gans', 'Nordlicht'];
    for (const p of g.players) {
      const [sx, sy] = g.starts[p.id];
      const ship: Ship = { id: g.nextId++, type: 'handel_klein', owner: p.id, name: shipNames[p.id], x: sx + 0.5, y: sy + 0.5, dir: -Math.PI / 4, path: [], slots: [] };
      for (let i = 0; i < 4; i++) ship.slots.push(START_CARGO[i] ? { g: START_CARGO[i][0], n: START_CARGO[i][1] } : { g: null, n: 0 });
      g.ships.push(ship);
    }
    // Das eigene Schiff startet im freien Meer 10 bis 13 Felder vor der Heimatküste, auf der Seite der
    // Startecke, damit beim Start Schiff und Land zugleich im Bild sind
    const coast = g.homeCoast();
    const me = g.ships.find((s) => s.owner === HUMAN)!;
    if (coast) {
      const cx = coast[0] + 0.5, cy = coast[1] + 0.5;
      const free = (x: number, y: number) => {
        for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (!g.inMap(x + i, y + j) || !g.isWater(g.idx(x + i, y + j))) return false;
        return true;
      };
      let best: [number, number] | null = null, bd = Infinity;
      for (let y = Math.floor(cy) - 14; y <= cy + 14; y++) for (let x = Math.floor(cx) - 14; x <= cx + 14; x++) {
        const dc = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (dc < 10 || dc > 13 || !free(x, y)) continue;
        const ds = Math.hypot(x + 0.5 - me.x, y + 0.5 - me.y);
        if (ds < bd) { bd = ds; best = [x, y]; }
      }
      if (best && bd < Math.hypot(me.x - cx, me.y - cy)) {
        me.x = best[0] + 0.5; me.y = best[1] + 0.5;
        me.dir = Math.atan2(cx - me.x, cy - me.y);
      }
    }
    g.pirateT = w.piratenAb; // Schonzeit vor den Piraten (wirkt ab der Schonzeit des Kampfteils)
    g.reveal(me.x, me.y, SHIP_SIGHT + 2);
    // ein Stück Küste der Heimatinsel aufdecken, damit beim Start Land in Sicht ist
    if (coast) g.reveal(coast[0] + 0.5, coast[1] + 0.5, 6);
    g.seenDirty = false;
    g.recompute();
    g.checkUnlocks(true);
    for (const s of SYSTEMS) s.load?.(g, undefined);
    landVorbereiten(g); // (KL) Küstenrechnung beim Erzeugen statt im ersten Denkschritt der Gegner
    return g;
  }

  /** Landfeld der Heimatinsel, das dem Start des Spielers am nächsten liegt (null = keine Insel) */
  homeCoast(): [number, number] | null {
    const [sx, sy] = this.starts[HUMAN] ?? [0, 0];
    const home = this.islands.find((i) => i.heimat) ?? this.islands.slice().sort((a, b) => Math.hypot(a.cx - sx, a.cy - sy) - Math.hypot(b.cx - sx, b.cy - sy))[0];
    if (!home) return null;
    let best: [number, number] | null = null, bd = 1e9;
    for (let y = home.y0; y <= home.y1; y++) for (let x = home.x0; x <= home.x1; x++) {
      if (this.islandOf[this.idx(x, y)] !== home.id) continue;
      const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  }

  static fromSave(d: SaveData): Game {
    const g = new Game();
    if (d.v >= 4 && d.world) {
      // Welt vollständig aus dem Spielstand (unabhängig vom heutigen Weltgenerator)
      const w = d.world;
      if (!Number.isInteger(w.size) || w.size < 16 || !Array.isArray(w.islands) || !Array.isArray(w.starts)) throw new Error('Spielstand beschädigt (Welt)');
      g.seed = d.seed;
      g.size = w.size;
      g.islands = w.islands;
      g.starts = w.starts;
      g.islandOf = decRuns(w.islandOf, w.size * w.size);
      g.tiles = dec(d.tiles, w.size * w.size, 'Gelände');
      g.setupGrids();
    } else {
      // alter Stand: Inseln wie damals aus der Startzahl (alte Regeln), Gelände aus dem Stand
      g.setupWorld(d.seed, WORLD_SIZE, true);
      g.tiles = dec(d.tiles, g.size * g.size, 'Gelände');
    }
    const NN = g.size * g.size;
    g.roads = dec(d.roads, NN, 'Wege');
    g.seen = dec(d.seen, NN, 'Erkundung');
    g.optsSet = d.opts ?? {};
    g.opts = { ...DEFAULT_OPTIONS, startgeld: stufe(g.optsSet.schwierigkeit).startgeld, ...g.optsSet, weltgroesse: g.size };
    g.rngState = (d.rng ?? ((d.seed ^ Math.floor(d.time * 1000)) >>> 0)) || 1;
    g.players = d.players;
    // ältere Spielstände: Gegner in Rot bzw. Gelb bekommen ihre neuen Farben (Rot und Gelb sind auf den Karten vergeben)
    for (const p of g.players) if (p.color === 0xc8463b) p.color = 0x8a5cc8; else if (p.color === 0xe0b23a) p.color = 0xd0609e;
    g.ships = d.ships;
    g.lager = d.lager;
    for (const k of Object.keys(g.lager)) g.lager[k] = { ...zeroGoods(), ...g.lager[k] };
    g.nextId = d.nextId;
    g.time = d.time;
    g.quest = d.quest;
    // ab v5 steht „Wehrhaft“ hinter „Eisen und Werkzeug“ (vorher vor „Bürger“): laufende Aufgabe beibehalten
    if (d.v < 5 && (g.quest === 14 || g.quest === 15)) g.quest--;
    // alter Stand: verbleibendes Erz je Insel (ab v4 steht es in den Inseln selbst)
    if (d.v < 4) (d.ore ?? []).forEach((v, i) => { if (g.islands[i]) g.islands[i].erz = v; });
    for (const b of d.buildings) {
      if (!BUILDINGS[b.type]) continue;
      b.stock ??= 0;
      g.buildings.push(b);
      g.byId.set(b.id, b);
      g.stamp(b, b.id);
    }
    g.recompute();
    for (const t of d.unlocked ?? []) if (BUILDINGS[t]) g.unlocked.add(t);
    if (d.best) g.best = d.best;
    g.units = d.units ?? [];
    if (d.pirate) { g.pirateT = d.pirate.t; g.pirateSunk = d.pirate.sunk; g.pirateSeen = d.pirate.seen; g.victories = d.pirate.victories ?? 0; }
    else g.pirateT = 900; // alter Spielstand: Piraten erst nach einer Schonfrist
    if (d.res) {
      const decR = (str: string, arr: Float32Array) => { for (let i = 0; i < arr.length && i < str.length; i++) arr[i] = (str.charCodeAt(i) - 48) / 40; };
      decR(d.res.trees, g.trees); decR(d.res.fish, g.fish); decR(d.res.wild, g.wild); decR(d.res.weide, g.weide);
      if (d.res.feld) decR(d.res.feld, g.feld);
    }
    g.checkUnlocks(true);
    for (const s of SYSTEMS) s.load?.(g, d.ext?.[s.id]);
    landVorbereiten(g); // (KL) wie in create
    return g;
  }

  serialize(): SaveData {
    const ext: Record<string, unknown> = {};
    for (const s of SYSTEMS) {
      const v = s.save?.(this);
      if (v !== undefined) ext[s.id] = v;
    }
    return {
      v: SAVE_VERSION, seed: this.seed, tiles: enc(this.tiles), roads: enc(this.roads), seen: enc(this.seen),
      buildings: this.buildings, ships: this.ships, players: this.players, lager: this.lager,
      nextId: this.nextId, time: this.time, quest: this.quest, unlocked: [...this.unlocked], best: this.best,
      res: { trees: encR(this.trees), fish: encR(this.fish), wild: encR(this.wild), weide: encR(this.weide), feld: encR(this.feld) },
      units: this.units, pirate: { t: this.pirateT, sunk: this.pirateSunk, seen: this.pirateSeen, victories: this.victories },
      world: { size: this.size, islandOf: encRuns(this.islandOf), islands: this.islands, starts: this.starts },
      opts: this.optsSet, rng: this.rngState, ext,
    };
  }

  /** Hinweis vom letzten load(), z. B. dass ein unlesbarer Stand gesichert wurde (für die Oberfläche) */
  static loadNote: string | null = null;
  /** true, wenn ein unlesbarer Stand nicht gesichert werden konnte: dann wird er nicht überschrieben */
  private static protectSave = false;

  /** Speicherort der Spielstände (main.ts setzt ihn auf src/saves.ts); fehlt er, wie früher in localStorage */
  static saveHook: ((g: Game) => boolean) | null = null;

  save(): boolean {
    // mit Spielständen (src/saves.ts) wird der alte Stand in localStorage nie überschrieben
    if (Game.saveHook) return Game.saveHook(this);
    if (Game.protectSave) return false;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize())); return true; } catch { return false; }
  }

  /**
   * Spielstand laden. Versionen 3 bis 5 werden gelesen. Ist der Stand unlesbar (kaputt oder aus einer
   * neueren Version), wird er unter eigenem Schlüssel gesichert, bevor ein neues Spiel ihn überschreibt.
   */
  static load(): Game | null {
    Game.loadNote = null;
    let raw: string | null = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch { return null; }
    if (!raw) return null;
    try {
      const d = JSON.parse(raw) as SaveData;
      if (!d || typeof d !== 'object' || (d.v !== 3 && d.v !== 4 && d.v !== 5 && d.v !== 6)) throw new Error(`unbekannte Version ${String((d as { v?: unknown } | null)?.v)}`);
      return Game.fromSave(d);
    } catch (e) {
      try {
        localStorage.setItem(BROKEN_KEY, raw);
        localStorage.setItem(`${BROKEN_KEY}-info`, JSON.stringify({ zeit: new Date().toISOString(), grund: String(e) }));
        Game.loadNote = 'Dein letzter Spielstand ließ sich nicht laden. Er wurde gesichert, und ein neues Spiel beginnt.';
      } catch {
        // kein Platz für die Sicherung: dann den alten Stand lieber nicht überschreiben
        Game.protectSave = true;
        Game.loadNote = 'Dein letzter Spielstand ließ sich nicht laden. Er bleibt erhalten; dieses Spiel wird erst gespeichert, wenn du ein neues Spiel beginnst.';
      }
      return null;
    }
  }

  static clearSave() {
    Game.protectSave = false;
    try { localStorage.removeItem(SAVE_KEY); } catch { /* egal */ }
  }

  /** Zufallszahl 0..1 aus dem gespeicherten Zufallsgenerator (gleiche Folge nach dem Laden) */
  rng(): number {
    let t = (this.rngState = (this.rngState + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- Hilfen ----------

  idx(x: number, y: number) { return y * this.size + x; }
  inMap(x: number, y: number) { return x >= 0 && y >= 0 && x < this.size && y < this.size; }
  tile(x: number, y: number) { return this.inMap(x, y) ? this.tiles[this.idx(x, y)] : T.Wasser; }
  isWater = (k: number) => this.tiles[k] === T.Wasser;
  def(b: Building): BuildingDef { return BUILDINGS[b.type]; }
  center(b: { type: BuildingId; x: number; y: number }): [number, number] { const s = BUILDINGS[b.type].size; return [b.x + s / 2, b.y + s / 2]; }
  island(id: number): Island | undefined { return this.islands[id]; }

  get money() { return this.players[HUMAN].money; }
  set money(v: number) { this.players[HUMAN].money = v; }

  /** Lager eines Spielers auf einer Insel (nur vorhanden, wenn er dort ein Kontor hat) */
  lagerOf(owner: number, island: number): Goods | null { return this.lager[`${owner}:${island}`] ?? null; }
  capOf(owner: number, island: number): number { return this.cap.get(`${owner}:${island}`) ?? 0; }
  /** Lager der Insel im Fokus (für die Oberfläche) */
  get goods(): Goods { return this.lagerOf(HUMAN, this.focus) ?? EMPTY; }
  get capacity(): number { return this.capOf(HUMAN, this.focus); }

  /** volle Trefferpunkte eines Gebäudes */
  maxHp(b: { type: BuildingId }): number {
    const d = BUILDINGS[b.type];
    return d.hp ?? 30 + d.size * d.size * 12;
  }
  /** volle Trefferpunkte eines Schiffs */
  shipMaxHp(s: Ship): number { return SHIPS[s.type ?? 'handel_klein'].hp; }
  unitById(id: number): Unit | undefined { return this.units.find((u) => u.id === id); }

  count(type: BuildingId, onlyLinked = false) {
    let n = 0;
    for (const b of this.buildings) if (b.owner === HUMAN && b.type === type && (!onlyLinked || this.linked.has(b.id))) n++;
    return n;
  }
  population() { let n = 0; for (const b of this.buildings) if (b.owner === HUMAN && b.type === 'haus') n += b.residents; return n; }
  popByTier(): number[] {
    const r = TIERS.map(() => 0);
    for (const b of this.buildings) if (b.owner === HUMAN && b.type === 'haus') r[b.tier] += b.residents;
    return r;
  }
  housesByTier(): number[] {
    const r = TIERS.map(() => 0);
    for (const b of this.buildings) if (b.owner === HUMAN && b.type === 'haus') r[b.tier]++;
    return r;
  }
  buildingAt(x: number, y: number): Building | undefined {
    if (!this.inMap(x, y)) return undefined;
    const id = this.occ[this.idx(x, y)];
    return id ? this.byId.get(id) : undefined;
  }
  kontor(owner = HUMAN, island = -1): Building | undefined {
    return this.buildings.find((b) => b.type === 'kontor' && b.owner === owner && (island < 0 || b.island === island));
  }
  myShips() { return this.ships.filter((s) => s.owner === HUMAN); }

  private stamp(b: Building, val: number) {
    const s = BUILDINGS[b.type].size;
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) this.occ[this.idx(b.x + i, b.y + j)] = val;
  }

  private newBuilding(type: BuildingId, x: number, y: number, owner: number): Building {
    return {
      id: this.nextId++, type, x, y, owner, island: this.islandOf[this.idx(x, y)],
      progress: 0, loaded: false, eff: 1, status: 'ok', missing: [], active: 0,
      tier: 0, residents: type === 'haus' ? 1 : 0, need: { nahrung: 1 }, demand: {}, short: {}, happy: 0.7, growT: 0, upT: 0, stock: 0,
    };
  }

  // ---------- Freischaltungen (wie im Vorbild nach Einwohnerzahl) ----------

  /** Größte Einwohnerzahl mindestens der Stufe tier auf einer einzelnen Insel (zwischengespeichert, bis sich Häuser ändern) */
  maxPop(tier: number, owner = HUMAN): number {
    const key = owner * 8 + tier;
    const c = this.popCache.get(key);
    if (c !== undefined) return c;
    const per = new Map<number, number>();
    for (const b of this.buildings) if (b.owner === owner && b.type === 'haus' && b.tier >= tier) per.set(b.island, (per.get(b.island) ?? 0) + b.residents);
    const v = Math.max(0, ...per.values());
    this.popCache.set(key, v);
    return v;
  }

  /** Ein vorbereitetes Gebäude (geplant) gibt es erst, wenn sein Spielteil es als „bereit“ meldet */
  isReady(type: BuildingId): boolean {
    if (!BUILDINGS[type].geplant) return true;
    for (const s of SYSTEMS) if (s.bereit?.(this).includes(type)) return true;
    return false;
  }

  isUnlocked(type: BuildingId): boolean {
    if (!this.isReady(type)) return false;
    if (this.unlocked.has(type)) return true;
    if (BUILDINGS[type].victory) return false;
    const u = BUILDINGS[type].unlock;
    return !u || this.maxPop(u.tier) >= u.n;
  }

  /** Ist eine Schwelle (z. B. 120 Siedler) für den Spieler schon einmal erreicht worden? */
  reached(u: { tier: number; n: number }, owner = HUMAN): boolean {
    return owner === HUMAN ? Math.max(this.best[u.tier] ?? 0, this.maxPop(u.tier)) >= u.n : this.maxPop(u.tier, owner) >= u.n;
  }

  checkUnlocks(silent = false) {
    for (let t = 0; t < TIERS.length; t++) this.best[t] = Math.max(this.best[t] ?? 0, this.maxPop(t));
    const fresh: BuildingId[] = [];
    for (const d of Object.values(BUILDINGS)) {
      if (!d.category || d.victory || this.unlocked.has(d.id) || !this.isReady(d.id)) continue;
      const u = d.unlock;
      if (!u || this.maxPop(u.tier) >= u.n) { this.unlocked.add(d.id); if (u) fresh.push(d.id); }
    }
    if (!silent && fresh.length) {
      const names = fresh.map((t) => `${BUILDINGS[t].icon} ${BUILDINGS[t].name}`);
      this.ev.message(`Neu freigeschaltet: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` und ${names.length - 3} weitere` : ''}`, 'good');
    }
  }

  /** Nächste Freischaltung in einer Kategorie (für Hinweise) */
  nextUnlock(cat: string): { type: BuildingId; tier: number; n: number } | null {
    let best: { type: BuildingId; tier: number; n: number } | null = null;
    for (const d of Object.values(BUILDINGS)) {
      if (d.category !== cat || this.unlocked.has(d.id) || !d.unlock || !this.isReady(d.id)) continue;
      if (!best || d.unlock.tier < best.tier || (d.unlock.tier === best.tier && d.unlock.n < best.n)) best = { type: d.id, ...d.unlock };
    }
    return best;
  }

  // ---------- Erkundung ----------

  reveal(cx: number, cy: number, r: number) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (!this.inMap(x, y)) continue;
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r) continue;
      const k = this.idx(x, y);
      if (!this.seen[k]) { this.seen[k] = 1; this.seenDirty = true; this.seenVer++; }
    }
  }

  /** Ist eine Insel (teilweise) entdeckt? */
  islandSeen(id: number): boolean {
    const i = this.islands[id];
    for (let y = i.y0; y <= i.y1; y++) for (let x = i.x0; x <= i.x1; x++) if (this.seen[this.idx(x, y)] && this.islandOf[this.idx(x, y)] === id) return true;
    return false;
  }

  // ---------- abgeleitete Werte ----------

  /** Gehört ein Feld zum Wegenetz eines Besitzers? Wege – und seine eigenen Tore (auch ohne Weg darunter) */
  roadOpen(k: number, owner: number): boolean {
    const o = this.occ[k];
    if (o) { const b = this.byId.get(o); return !!b && b.owner === owner && !!BUILDINGS[b.type].gate; }
    return this.roads[k] > 0;
  }

  recompute() {
    const N = this.size;
    this.buildVersion++;
    this.popCache.clear();
    // Besitz: Kontore/Marktplätze beanspruchen Land ihrer Insel (wer zuerst baut, dem gehört es)
    this.own = new Int8Array(N * N).fill(-1);
    this.cap.clear();
    const claimers = this.buildings.filter((b) => LAGER.includes(b.type)).sort((a, b) => a.id - b.id);
    for (const b of claimers) {
      const d = this.def(b);
      const key = `${b.owner}:${b.island}`;
      const stor = b.type === 'kontor' ? KONTOR_LEVELS[b.level ?? 0].storage : d.storage ?? 0;
      this.cap.set(key, (this.cap.get(key) ?? 0) + stor);
      const [cx, cy] = this.center(b);
      const r = d.radius ?? 0;
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (!this.inMap(x, y)) continue;
        const k = this.idx(x, y);
        if (this.islandOf[k] !== b.island || this.own[k] >= 0) continue;
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.own[k] = b.owner;
      }
    }
    this.area = new Uint8Array(N * N);
    for (let k = 0; k < N * N; k++) if (this.own[k] === HUMAN) this.area[k] = 1;
    // Wegnetz je Besitzer ab Kontor/Markt: über Wege und durch die eigenen Tore (fremde Tore sperren)
    this.roadLinked = new Uint8Array(N * N);
    const nets = new Map<number, Uint8Array>();
    for (const b of claimers) {
      let net = nets.get(b.owner);
      if (!net) { net = new Uint8Array(N * N); nets.set(b.owner, net); }
      const stack: number[] = [];
      for (const [x, y] of this.ring(b)) {
        if (!this.inMap(x, y)) continue;
        const k = this.idx(x, y);
        if (!net[k] && this.roadOpen(k, b.owner)) { net[k] = 1; this.roadLinked[k] = 1; stack.push(k); }
      }
      while (stack.length) {
        const k = stack.pop()!;
        const x = k % N, y = (k / N) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (!this.inMap(nx, ny)) continue;
          const nk = this.idx(nx, ny);
          if (!net[nk] && this.roadOpen(nk, b.owner)) { net[nk] = 1; this.roadLinked[nk] = 1; stack.push(nk); }
        }
      }
    }
    this.linked.clear();
    for (const b of this.buildings) {
      if (LAGER.includes(b.type)) { this.linked.add(b.id); continue; }
      const net = nets.get(b.owner);
      for (const [x, y] of this.ring(b)) {
        if (!this.inMap(x, y)) continue;
        const k = this.idx(x, y);
        const other = this.occ[k] ? this.byId.get(this.occ[k]) : undefined;
        if (net?.[k] || (other && LAGER.includes(other.type) && other.owner === b.owner)) { this.linked.add(b.id); break; }
      }
    }
    // Versorgung der Wohnhäuser
    this.coverage.clear();
    const SVC: BuildingId[] = ['markt', 'kapelle', 'kirche', 'wirtshaus', 'schule', 'badehaus', 'hochschule', 'theater'];
    const services = this.buildings.filter((b) => SVC.includes(b.type));
    for (const h of this.buildings) {
      if (h.type !== 'haus') continue;
      const set = new Set<BuildingId>();
      const [hx, hy] = this.center(h);
      for (const s of services) {
        if (s.owner !== h.owner) continue;
        const [sx, sy] = this.center(s);
        const r = this.def(s).radius ?? 0;
        // wie im Vorbild: die Kirche ersetzt die Kapelle, die Hochschule die Schule in ihrer Reichweite
        if ((hx - sx) ** 2 + (hy - sy) ** 2 <= r * r) { set.add(s.type); if (s.type === 'kirche') set.add('kapelle'); if (s.type === 'hochschule') set.add('schule'); }
      }
      this.coverage.set(h.id, set);
    }
    this.share = {};
    for (const o of this.buildings) {
      const res = BUILDINGS[o.type].harvest?.res;
      if (!res) continue;
      const arr = (this.share[res] ??= new Uint8Array(N * N));
      for (const k of this.workTiles(o.type, o.x, o.y)) if (arr[k] < 255) arr[k]++;
    }
    for (const b of this.buildings) b.eff = this.siteEfficiency(b.type, b.x, b.y, b.id);
    // Abholweite der Marktkarren (Kontor 8, Marktplatz 12 Felder) – wie assignCart rechnet
    this.inReach.clear();
    for (const b of this.buildings) {
      if (!BUILDINGS[b.type].prod) continue;
      const [bx, by] = this.center(b);
      if (claimers.some((h) => h.owner === b.owner && h.island === b.island && Math.hypot(this.center(h)[0] - bx, this.center(h)[1] - by) <= this.pickupOf(h) + 1)) this.inReach.add(b.id);
    }
    // Marktkarren: Kontor 2, Marktplatz 1
    this.carts = this.carts.filter((c) => this.byId.has(c.home));
    for (const b of claimers) {
      const want = b.type === 'kontor' ? 2 : 1;
      const have = this.carts.filter((c) => c.home === b.id).length;
      const [cx, cy] = this.center(b);
      for (let i = have; i < want; i++) this.carts.push({ id: this.nextId++, home: b.id, x: cx, y: cy, path: [], state: 'idle', target: 0, g: null, n: 0 });
    }
  }

  /** Weg über Straßen (und eigene Tore) von Gebäude a zu Gebäude b (Feldmitten), null = keine Verbindung */
  roadPath(a: Building, b: Building): [number, number][] | null {
    const N = this.size;
    const goal = new Set<number>();
    for (const [x, y] of this.ring(b)) if (this.inMap(x, y)) goal.add(this.idx(x, y));
    const startRing = this.ring(a).filter(([x, y]) => this.inMap(x, y)).map(([x, y]) => this.idx(x, y));
    // direkt benachbart?
    for (const k of startRing) if (this.occ[k] === b.id) return [];
    const from = new Map<number, number>();
    const q: number[] = [];
    const open = (k: number) => this.roadOpen(k, a.owner);
    for (const k of startRing) if (open(k) && !from.has(k)) { from.set(k, -1); q.push(k); }
    for (let h = 0; h < q.length; h++) {
      const k = q[h];
      if (goal.has(k)) {
        const path: [number, number][] = [];
        for (let c = k; c >= 0; c = from.get(c)!) path.push([c % N + 0.5, ((c / N) | 0) + 0.5]);
        return path.reverse();
      }
      const x = k % N, y = (k / N) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.inMap(nx, ny)) continue;
        const nk = this.idx(nx, ny);
        if (open(nk) && !from.has(nk)) { from.set(nk, k); q.push(nk); }
      }
    }
    return null;
  }

  /** Abholweite der Marktkarren eines Kontors oder Marktplatzes (Felder) */
  pickupOf(home: { type: BuildingId }): number { const d = BUILDINGS[home.type]; return d.pickup ?? d.work ?? 9; }

  private assignCart(c: Cart, home: Building) {
    const [hx, hy] = this.center(home);
    const reach = this.pickupOf(home);
    const taken = new Set(this.carts.filter((o) => o.state === 'hin').map((o) => o.target));
    const cands = this.buildings
      // ruhende Betriebe (off) werden nicht angefahren
      .filter((b) => b.owner === home.owner && b.island === home.island && this.def(b).prod && b.stock >= 1 && !b.off && !taken.has(b.id))
      // ist die Ware im Inselllager schon am Limit, bleibt sie im Betrieb (er meldet dann selbst „Lager voll“)
      .filter((b) => this.cartRoom(home, this.def(b).prod!.output) >= 1)
      .filter((b) => { const [bx, by] = this.center(b); return Math.hypot(bx - hx, by - hy) <= reach + 1; })
      .sort((p, q) => q.stock - p.stock);
    for (const b of cands) {
      const path = this.roadPath(home, b);
      if (!path) continue;
      const [bx, by] = this.center(b);
      c.path = [...path, [bx, by]];
      c.state = 'hin';
      c.target = b.id;
      return;
    }
  }

  /**
   * Platz im Inselllager des Karren-Heims für eine Ware, abzüglich dessen, was andere Karren
   * schon dorthin bringen (geladen oder auf dem Weg zum Abholen). except = dieser Karren zählt nicht mit.
   */
  private cartRoom(home: Building, g: GoodId, except?: Cart): number {
    const l = this.lagerOf(home.owner, home.island);
    if (!l) return 0;
    let room = this.capOf(home.owner, home.island) - l[g];
    for (const o of this.carts) {
      if (o === except) continue;
      const oh = this.byId.get(o.home);
      if (!oh || oh.owner !== home.owner || oh.island !== home.island) continue;
      if (o.g === g && o.n > 0) room -= o.n;
      else if (o.state === 'hin') {
        const t = this.byId.get(o.target);
        if (t && this.def(t).prod?.output === g) room -= Math.min(CART_CAP, Math.floor(t.stock));
      }
    }
    return room;
  }

  /** Ladung ins Inselllager bringen – nur so viel, wie Platz ist; der Rest bleibt im Karren */
  private cartUnload(c: Cart, home: Building) {
    const l = this.lagerOf(home.owner, home.island);
    if (!c.g || c.n <= 0) { c.g = null; c.n = 0; return; }
    if (!l) { c.g = null; c.n = 0; return; } // kein Lager mehr (Kontor verloren): die Ladung ist weg
    const put = Math.max(0, Math.min(c.n, Math.floor(this.capOf(home.owner, home.island) - l[c.g])));
    l[c.g] += put; c.n -= put;
    if (c.n <= 0) { c.g = null; c.n = 0; }
  }

  private tickCarts(dt: number) {
    const think = this.cartT >= 1;
    for (const c of this.carts) {
      const home = this.byId.get(c.home)!;
      if (c.state === 'idle') {
        if (!think) continue;
        // Rest vom letzten Mal: erst abladen, wenn wieder Platz ist – vorher keine neue Fahrt
        if (c.n > 0) { this.cartUnload(c, home); if (c.n > 0) continue; }
        this.assignCart(c, home);
        continue;
      }
      const here = this.roads[this.idx(Math.floor(c.x), Math.floor(c.y))];
      let step = CART_SPEED * (here === 2 ? PFLASTER_TEMPO : 1) * dt;
      while (step > 0 && c.path.length) {
        const [tx, ty] = c.path[0];
        const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
        if (d < 1e-3) { c.path.shift(); continue; }
        const m = Math.min(step, d);
        c.x += (dx / d) * m; c.y += (dy / d) * m; step -= m;
        if (m >= d) c.path.shift();
      }
      if (c.path.length) continue;
      if (c.state === 'hin') {
        const b = this.byId.get(c.target);
        if (b && this.def(b).prod) {
          // nur so viel mitnehmen, wie im Lager noch Platz ist – der Rest bleibt im Betrieb
          const g = this.def(b).prod!.output;
          const take = Math.max(0, Math.min(Math.floor(b.stock), CART_CAP, Math.floor(this.cartRoom(home, g, c))));
          b.stock -= take;
          if (take > 0) { c.g = g; c.n = take; }
        }
        const back = b ? this.roadPath(home, b) : null;
        c.path = [...(back ?? []).reverse(), this.center(home)];
        c.state = 'zurueck';
      } else {
        this.cartUnload(c, home);
        c.state = 'idle';
      }
    }
    if (think) this.cartT = 0;
  }

  ring(b: { type: BuildingId; x: number; y: number }): [number, number][] {
    const s = BUILDINGS[b.type].size;
    const out: [number, number][] = [];
    for (let k = 0; k < s; k++) out.push([b.x + k, b.y - 1], [b.x + k, b.y + s], [b.x - 1, b.y + k], [b.x + s, b.y + k]);
    return out;
  }

  /** Felder im Arbeitsradius eines Betriebs (ohne die eigene Grundfläche) */
  workTiles(type: BuildingId, x: number, y: number): number[] {
    const d = BUILDINGS[type];
    const R = d.work ?? 4;
    const cx = x + d.size / 2, cy = y + d.size / 2;
    const out: number[] = [];
    for (let j = Math.floor(cy - R); j <= Math.ceil(cy + R); j++) for (let i = Math.floor(cx - R); i <= Math.ceil(cx + R); i++) {
      if (!this.inMap(i, j)) continue;
      if ((i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2 > R * R) continue;
      if (i >= x && i < x + d.size && j >= y && j < y + d.size) continue;
      out.push(this.idx(i, j));
    }
    return out;
  }

  /** Taugt dieses Feld für den Rohstoff? (Weide nur auf freiem Gras/Sand) */
  resOk(res: Res, k: number): boolean {
    const t = this.tiles[k];
    if (res === 'fisch') return this.fishCap[k] > 0;
    if (res === 'baum' || res === 'wild') return t === T.Wald;
    // Weide/Felder: freies Gras oder Sand
    return (t === T.Gras || t === T.Sand) && !this.occ[k] && !this.roads[k];
  }

  resStock(res: Res): Float32Array {
    return res === 'baum' ? this.trees : res === 'fisch' ? this.fish : res === 'wild' ? this.wild : res === 'feld' ? this.feld : this.weide;
  }

  /**
   * Ergiebigkeit 0..1: wie viel im Arbeitsradius dauerhaft nachwächst, geteilt durch alle
   * gleichartigen Betriebe, die dieselben Felder nutzen – verglichen mit dem Bedarf bei voller Arbeit.
   */
  /** Fruchtbarkeit der Insel für eine Plantage (0..1); 1 für alles andere */
  fertility(type: BuildingId, x: number, y: number): number {
    const p = BUILDINGS[type].pflanze;
    if (!p) return 1;
    const isl = this.islands[this.islandOf[this.idx(x, y)]];
    return (isl?.frucht[p] ?? 0) / 100;
  }

  siteEfficiency(type: BuildingId, x: number, y: number, self = -1): number {
    const d = BUILDINGS[type];
    const fert = this.fertility(type, x, y);
    if (fert <= 0) return 0;
    if (d.deposit) {
      const id = this.islandOf[this.idx(x, y)];
      const isl = this.islands[id];
      if (!isl || !this.depositLeft(isl, d.deposit)) return 0;
    }
    if (d.needs === 'berg') {
      for (const [rx, ry] of this.ring({ type, x, y })) if (this.tile(rx, ry) === T.Berg) return 1;
      return 0;
    }
    if (!d.harvest || !d.prod) return 1;
    const res = d.harvest.res;
    const need = d.harvest.per / d.prod.time;
    // wer nutzt welche Felder schon mit? (self zählt sich selbst nicht doppelt)
    const sh = this.share[res];
    const minus = self >= 0 ? 1 : 0;
    let supply = 0;
    for (const k of this.workTiles(type, x, y)) {
      if (!this.resOk(res, k)) continue;
      const cap = res === 'fisch' ? this.fishCap[k] : 1;
      supply += (REGEN[res] * cap) / (1 + Math.max(0, (sh ? sh[k] : 0) - minus));
    }
    return Math.min(1, supply / need) * fert;
  }

  // ---------- Schiffe ----------

  shipCargo(s: Ship, g: GoodId): number { return s.slots.reduce((n, sl) => n + (sl.g === g ? sl.n : 0), 0); }

  /** Ware ins Schiff laden; gibt geladene Menge zurück */
  shipAdd(s: Ship, g: GoodId, n: number): number {
    let left = n;
    for (const sl of s.slots) if (sl.g === g && left > 0) { const t = Math.min(left, SLOT_CAP - sl.n); sl.n += t; left -= t; }
    for (const sl of s.slots) if (!sl.g && left > 0) { const t = Math.min(left, SLOT_CAP); sl.g = g; sl.n = t; left -= t; }
    return n - left;
  }

  shipTake(s: Ship, g: GoodId, n: number): number {
    let left = n;
    for (const sl of s.slots) if (sl.g === g && left > 0) { const t = Math.min(left, sl.n); sl.n -= t; left -= t; if (!sl.n) sl.g = null; }
    return n - left;
  }

  /** Kontor des Schiffsbesitzers in Reichweite des Schiffs */
  shipDock(s: Ship): Building | undefined {
    return this.buildings.find((b) => b.type === 'kontor' && b.owner === s.owner && Math.hypot(this.center(b)[0] - s.x, this.center(b)[1] - s.y) <= DOCK_RANGE + 1.5);
  }

  /** Alles aus dem Schiff ins Kontor laden (soweit Platz ist); gibt Tonnen zurück */
  unloadAll(s: Ship): number {
    const k = this.shipDock(s);
    if (!k) return 0;
    const l = this.lagerOf(s.owner, k.island)!;
    const cap = this.capOf(s.owner, k.island);
    let moved = 0;
    for (const sl of s.slots) {
      if (!sl.g) continue;
      const t = Math.max(0, Math.min(sl.n, cap - l[sl.g]));
      l[sl.g] += t; sl.n -= t; moved += t;
      if (!sl.n) sl.g = null;
    }
    return moved;
  }

  /** Ware vom Kontor aufs Schiff laden */
  loadGood(s: Ship, g: GoodId, n: number): number {
    const k = this.shipDock(s);
    if (!k) return 0;
    const l = this.lagerOf(s.owner, k.island)!;
    const t = this.shipAdd(s, g, Math.min(n, Math.floor(l[g])));
    l[g] -= t;
    return t;
  }

  /** Eine Ware (bis zu n Tonnen) vom Schiff ins Kontor laden – nur so viel, wie im Lager Platz ist */
  unloadGood(s: Ship, g: GoodId, n: number): number {
    const k = this.shipDock(s);
    if (!k) return 0;
    const l = this.lagerOf(s.owner, k.island);
    if (!l) return 0;
    const room = Math.max(0, Math.floor(this.capOf(s.owner, k.island) - l[g]));
    const t = this.shipTake(s, g, Math.max(0, Math.min(Math.floor(n), room, this.shipCargo(s, g))));
    l[g] += t;
    return t;
  }

  /** Insel, an deren Küste das Schiff gerade liegt (-1 = keine) */
  shipNearIsland(s: Ship): number {
    let best = -1, bd = DOCK_RANGE + 1;
    const r = Math.ceil(DOCK_RANGE);
    for (let y = Math.floor(s.y) - r; y <= Math.floor(s.y) + r; y++) for (let x = Math.floor(s.x) - r; x <= Math.floor(s.x) + r; x++) {
      if (!this.inMap(x, y)) continue;
      const id = this.islandOf[this.idx(x, y)];
      if (id < 0) continue;
      const d = Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }

  /** Nebel für die Kursplanung: Schiffe des Spielers kennen nur Entdecktes (unentdeckt gilt als Wasser) */
  private fogOf(s: Ship): Uint8Array | undefined { return s.owner === HUMAN ? this.seen : undefined; }

  /**
   * Schiff fahren lassen (Wunsch: „Tipp aufs Land = in diese Richtung, so weit es geht“).
   * - Ziel auf dem Wasser (oder im Nebel): kürzester Seeweg dorthin.
   * - Ziel an Land: der Linie vom Schiff zum Tippunkt folgen; Ziel ist das letzte Wasserfeld vor der Küste
   *   der angetippten Insel – das Schiff hält an der zugewandten Küste und fährt nicht um die Insel herum.
   * - Geht beides nicht: Flächensuche ab dem Schiff – das Feld mit dem kleinsten Wert aus
   *   Abstand zum Tippunkt + 0,5 × Fahrweg („so nah wie möglich, ohne riesigen Umweg“).
   * false nur, wenn sich das Schiff gar nicht bewegen kann.
   */
  moveShip(s: Ship, tx: number, ty: number): boolean {
    const N = this.size;
    tx = Math.min(N - 0.01, Math.max(0, tx)); ty = Math.min(N - 0.01, Math.max(0, ty));
    const gx = Math.floor(tx), gy = Math.floor(ty);
    const sx = Math.min(N - 1, Math.max(0, Math.floor(s.x))), sy = Math.min(N - 1, Math.max(0, Math.floor(s.y)));
    const fog = this.fogOf(s);
    const pass = seaPass(this.isWater, fog);
    const gk = this.idx(gx, gy);
    let path: [number, number][] | null = null;
    if (pass(gk)) path = findSeaPath(N, this.isWater, sx, sy, gx, gy, 40000, fog);
    else {
      const stop = this.lineToCoast(s.x, s.y, tx, ty, this.islandOf[gk], pass);
      if (stop && (stop[0] !== sx || stop[1] !== sy)) path = findSeaPath(N, this.isWater, sx, sy, stop[0], stop[1], 40000, fog);
    }
    path ??= seaReach(N, this.isWater, sx, sy, tx, ty, { seen: fog, w: 0.5 });
    if (!path) { s.goal = undefined; return false; }
    s.path = path;
    s.goal = path.length ? [tx, ty] : undefined;
    this.planSeen.set(s.id, this.seenVer);
    // Ziel im Nebel: später nur kleine Umwege erlaubt (sonst würde der Kurs verraten, wo Land ist)
    if (fog && !fog[gk] && path.length) this.fogRun.set(s.id, { budget: this.pathLength(s, path) + 6, run: 0 });
    else this.fogRun.delete(s.id);
    return true;
  }

  /** Länge eines Kurses ab der Schiffsposition */
  private pathLength(s: { x: number; y: number }, path: [number, number][]): number {
    let len = 0, ax = s.x, ay = s.y;
    for (const [x, y] of path) { len += Math.hypot(x - ax, y - ay); ax = x; ay = y; }
    return len;
  }

  /**
   * Der Linie vom Punkt (x0, y0) zum Tippunkt folgen: das letzte befahrbare Feld, bevor die Linie
   * auf (bekanntes) Land der Insel isl trifft – andere Inseln unterwegs zählen nicht.
   * isl = null: schon vor dem ersten Land überhaupt halten. Ergebnis null = kein solches Feld.
   */
  private lineToCoast(x0: number, y0: number, x1: number, y1: number, isl: number | null, pass: (k: number) => boolean): [number, number] | null {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 4);
    let last: [number, number] | null = null;
    for (let i = 0; i <= steps; i++) {
      const t = i / Math.max(1, steps);
      const x = Math.floor(x0 + (x1 - x0) * t), y = Math.floor(y0 + (y1 - y0) * t);
      if (!this.inMap(x, y)) continue;
      const k = this.idx(x, y);
      if (pass(k)) { last = [x, y]; continue; }
      if (isl === null || this.islandOf[k] === isl) return last;
    }
    return last;
  }

  /** Verläuft der Rest des Kurses über Land, das inzwischen entdeckt wurde? (Felder entlang der Strecke) */
  private courseBlocked(s: Ship): boolean {
    const pass = seaPass(this.isWater, this.fogOf(s));
    let ax = s.x, ay = s.y;
    for (const [x, y] of s.path) {
      const n = Math.ceil(Math.hypot(x - ax, y - ay) * 4);
      for (let i = 1; i <= n; i++) {
        const px = Math.floor(ax + ((x - ax) * i) / n), py = Math.floor(ay + ((y - ay) * i) / n);
        if (this.inMap(px, py) && !pass(this.idx(px, py))) return true;
      }
      ax = x; ay = y;
    }
    return false;
  }

  /**
   * Neu planen, weil im Nebel Land aufgetaucht ist. Ist das Ziel bekannt: normal neu fahren (auch mit Umweg).
   * Liegt es noch im Nebel: nur ein kleiner Umweg (z. B. um eine Landspitze) – sonst würde der Kurs verraten,
   * dass dort Land ist. Dann hält das Schiff vor der Küste, wie ein Kapitän, der Land voraus sieht.
   */
  private replan(s: Ship) {
    const goal = s.goal;
    if (!goal) return;
    const [gx, gy] = goal;
    if (this.seen[this.idx(Math.floor(gx), Math.floor(gy))]) { this.moveShip(s, gx, gy); return; }
    const N = this.size, fog = this.fogOf(s);
    const sx = Math.floor(s.x), sy = Math.floor(s.y);
    const p = findSeaPath(N, this.isWater, sx, sy, Math.floor(gx), Math.floor(gy), 40000, fog);
    const len = p ? this.pathLength(s, p) : Infinity;
    const fr = this.fogRun.get(s.id);
    // klein = höchstens 3 Felder länger als der bisherige Kurs und insgesamt nicht mehr als 6 Felder Umweg
    const small = len <= this.pathLength(s, s.path) + 3 && (!fr || fr.run + len <= fr.budget);
    if (p && small) { s.path = p; this.planSeen.set(s.id, this.seenVer); return; }
    // vor dem ersten bekannten Land auf der Linie zum Ziel halten (liegt keins darauf: hier stehen bleiben)
    const pass = seaPass(this.isWater, fog);
    const stop = this.lineToCoast(s.x, s.y, gx, gy, null, pass);
    const atGoal = stop && stop[0] === Math.floor(gx) && stop[1] === Math.floor(gy);
    s.path = (stop && !atGoal && (stop[0] !== sx || stop[1] !== sy) ? findSeaPath(N, this.isWater, sx, sy, stop[0], stop[1], 40000, fog) : null) ?? [];
    s.goal = undefined;
    this.fogRun.delete(s.id);
  }

  private tickShip(s: Ship, dt: number) {
    // im Nebel geplant und inzwischen Land entdeckt? → Kurs neu planen
    if (s.goal && s.path.length && s.owner === HUMAN && this.planSeen.get(s.id) !== this.seenVer) {
      this.planSeen.set(s.id, this.seenVer);
      if (this.courseBlocked(s)) this.replan(s);
    }
    // beschädigte Schiffe fahren langsamer: halbe Fahrt bei fast keinen Treffern mehr
    const full = this.shipMaxHp(s);
    const hp = Math.max(0, Math.min(full, s.hp ?? full));
    let step = SHIP_SPEED * (SHIPS[s.type ?? 'handel_klein'].speed) * (0.5 + 0.5 * hp / full) * dt;
    const fr = this.fogRun.get(s.id);
    while (step > 0 && s.path.length) {
      const [tx, ty] = s.path[0];
      const dx = tx - s.x, dy = ty - s.y;
      const d = Math.hypot(dx, dy);
      if (d < 1e-3) { s.path.shift(); continue; }
      const m = Math.min(step, d);
      s.x += (dx / d) * m; s.y += (dy / d) * m;
      s.dir = Math.atan2(dx, dy);
      step -= m;
      if (fr) fr.run += m;
      if (m >= d) s.path.shift();
    }
    if (!s.path.length) { s.goal = undefined; this.fogRun.delete(s.id); }
  }

  // ---------- Handel ----------

  /** Mit dem freien Händler am Kontor handeln: n > 0 kaufen, n < 0 verkaufen. Gibt gehandelte Tonnen zurück. */
  trade(owner: number, island: number, g: GoodId, n: number): number {
    const pr = PRICES[g];
    const l = this.lagerOf(owner, island);
    if (!pr || !l) return 0;
    const p = this.players[owner];
    if (n > 0) {
      const room = Math.max(0, this.capOf(owner, island) - l[g]);
      const t = Math.floor(Math.min(n, room, p.money / pr.kaufen));
      l[g] += t; p.money -= t * pr.kaufen;
      if (t) book(this, owner, 'handel', -t * pr.kaufen);
      return t;
    }
    const t = Math.floor(Math.min(-n, l[g]));
    l[g] -= t; p.money += t * pr.verkaufen;
    if (t) book(this, owner, 'handel', t * pr.verkaufen);
    return t;
  }

  // ---------- Bauen ----------

  canAfford(c: Cost, owner = HUMAN, island = this.focus): Check {
    if ((c.taler ?? 0) > this.players[owner].money) return { ok: false, reason: 'Zu wenig Taler' };
    const l = this.lagerOf(owner, island) ?? EMPTY;
    for (const k of BUILD_GOODS) if ((c[k] ?? 0) > l[k]) return { ok: false, reason: `Zu wenig ${GOOD[k].name}` };
    return { ok: true };
  }

  private pay(c: Cost, owner: number, island: number) {
    this.players[owner].money -= c.taler ?? 0;
    const l = this.lagerOf(owner, island);
    if (l) for (const k of BUILD_GOODS) l[k] -= c[k] ?? 0;
  }

  /** Schiff des Spielers, das nahe genug an einem Bauplatz liegt */
  shipNear(owner: number, cx: number, cy: number): Ship | undefined {
    return this.ships.filter((s) => s.owner === owner).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))
      .find((s) => Math.hypot(s.x - cx, s.y - cy) <= DOCK_RANGE + 2);
  }

  canPlace(type: BuildingId, x: number, y: number, owner = HUMAN, ignoreShip = false): Check {
    const d = BUILDINGS[type];
    const s = d.size;
    // Billige Prüfungen zuerst (Freischaltung, Geld): dann muss die Feldschleife gar nicht laufen –
    // das glättet die Rechenspitzen der Computergegner, die viele Bauplätze nacheinander prüfen.
    if (!this.isReady(type)) return { ok: false, reason: 'Das gibt es noch nicht' };
    if (d.victory && (!this.unlocked.has(type) || this.buildings.filter((b) => b.type === type && b.owner === owner).length >= this.victories)) return { ok: false, reason: this.victories ? 'Ein Triumphbogen je Sieg' : 'Erst nach einem Sieg' };
    if (d.category && d.unlock && (owner === HUMAN ? !this.isUnlocked(type) : this.maxPop(d.unlock.tier, owner) < d.unlock.n)) {
      const u = d.unlock;
      return { ok: false, reason: `Erst ab ${u.n} ${TIERS[u.tier].dat}` };
    }
    if (!this.inMap(x, y)) return { ok: false, reason: 'Außerhalb der Karte' };
    if ((d.cost.taler ?? 0) > (this.players[owner]?.money ?? 0)) return { ok: false, reason: 'Zu wenig Taler' };
    if (type !== 'kontor') {
      const i0 = this.islandOf[this.idx(x, y)];
      if (i0 >= 0) { const c = this.canAfford(d.cost, owner, i0); if (!c.ok) return c; }
    }
    let isl = -2;
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
      const tx = x + i, ty = y + j;
      if (!this.inMap(tx, ty)) return { ok: false, reason: 'Außerhalb der Karte' };
      const t = this.tile(tx, ty);
      const k = this.idx(tx, ty);
      if (owner === HUMAN && !this.seen[k]) return { ok: false, reason: 'Noch unentdeckt' };
      if (t === T.Wasser) return { ok: false, reason: 'Nicht auf dem Wasser' };
      if (t === T.Berg) return { ok: false, reason: 'Nicht auf dem Berg' };
      // ein Tor darf auf einen eigenen Weg (der Weg bleibt darunter und das Netz verbunden)
      if (this.occ[k] || (this.roads[k] && !d.gate)) return { ok: false, reason: 'Platz ist belegt' };
      if (isl === -2) isl = this.islandOf[k];
      if (type === 'kontor') {
        if (this.own[k] >= 0 && this.own[k] !== owner) return { ok: false, reason: 'Das Land gehört schon jemand anderem' };
      } else if (this.own[k] !== owner) return { ok: false, reason: 'Außerhalb deines Gebiets – baue einen Marktplatz' };
    }
    if (type === 'kontor') {
      if (this.kontor(owner, isl)) return { ok: false, reason: 'Auf dieser Insel hast du schon ein Kontor' };
      let w = 0;
      for (const [rx, ry] of this.ring({ type, x, y })) if (this.tile(rx, ry) === T.Wasser) w++;
      if (w < 2) return { ok: false, reason: 'Das Kontor muss direkt an der Küste stehen' };
      // (KL) jedes Feld muss im Bild trockenes Land sein (siehe src/landhoehe.ts)
      if (!trockeneFlaeche(this, x, y, s)) return { ok: false, reason: KEIN_FESTES_LAND };
      if (ignoreShip) return { ok: true };
      const ship = this.shipNear(owner, x + s / 2, y + s / 2);
      if (!ship) return { ok: false, reason: 'Ein Schiff muss in der Nähe liegen' };
      for (const k of ['holz', 'werkzeug'] as const) if (this.shipCargo(ship, k) < (d.cost[k] ?? 0)) return { ok: false, reason: `Zu wenig ${GOOD[k].name} an Bord` };
      return { ok: true };
    }
    if (d.needs === 'wasser') {
      let w = 0;
      for (const [rx, ry] of this.ring({ type, x, y })) if (this.tile(rx, ry) === T.Wasser) w++;
      if (w < 2) return { ok: false, reason: 'Muss direkt am Wasser stehen' };
    }
    if (d.needs === 'kueste') {
      let w = 0;
      for (const [rx, ry] of this.ring({ type, x, y })) if (this.tile(rx, ry) === T.Wasser) w++;
      if (w < 2) return { ok: false, reason: 'Muss direkt an der Küste stehen' };
    }
    if (d.needs === 'berg') {
      let berg = false;
      for (const [rx, ry] of this.ring({ type, x, y })) if (this.tile(rx, ry) === T.Berg) berg = true;
      if (!berg) return { ok: false, reason: 'Muss direkt am Berg stehen' };
    }
    if (d.deposit) {
      const il = this.islands[isl];
      if (d.deposit === 'gold') { if (!il?.gold) return { ok: false, reason: 'Diese Insel hat kein Gold im Berg' }; }
      else if (!il || !this.hadOre(isl)) return { ok: false, reason: 'Diese Insel hat kein Erz im Berg' };
      else if (!this.depositLeft(il, d.deposit)) return { ok: false, reason: d.deposit === 'erz' && il.erzDeep > 0 ? 'Das Erzvorkommen ist oben erschöpft' : 'Das Erzvorkommen ist erschöpft' };
    }
    if (d.pflanze && this.fertility(type, x, y) <= 0) return { ok: false, reason: `Diese Insel ist nicht fruchtbar für ${PFLANZEN[d.pflanze].name}` };
    // (KL) keine Hütte halb im Wasser: jedes Feld der Grundfläche muss im Bild trockenes Land sein
    // (winzige Sandbänke und Landzungen liegen im Bild unter Wasser; siehe src/landhoehe.ts)
    if (!trockeneFlaeche(this, x, y, s)) return { ok: false, reason: KEIN_FESTES_LAND };
    return this.canAfford(d.cost, owner, isl);
  }

  /** Hatte die Insel zu Spielbeginn Erz? */
  hadOre(isl: number) { return (this.islands[isl]?.erzStart ?? 0) > 0; }

  /** Ist im Berg noch etwas für diese Mine? (Erzmine: oberes Vorkommen; tiefe Mine: der Rest; Gold: solange es Gold gibt) */
  depositLeft(isl: Island, dep: NonNullable<BuildingDef['deposit']>): boolean {
    if (dep === 'gold') return !!isl.gold;
    if (!isl.erzStart && !isl.erz) return false;
    if (isl.erzEndlos) return true;
    return dep === 'erz' ? isl.erz > 0 : isl.erzDeep > 0;
  }

  /** Ort eines Gebäudes für Meldungen */
  private at(b: { type: BuildingId; x: number; y: number }): MsgAt { const [x, y] = this.center(b); return { x, y }; }

  /**
   * Gemeinsamer Kern von place, placeMany und placeNeutral: Gebäude setzen – ohne Prüfung,
   * ohne Neuberechnung, ohne Meldungen. pay = Kosten abziehen (Kontor: Material aus dem nahen Schiff).
   */
  private putBuilding(type: BuildingId, x: number, y: number, owner: number, pay: boolean): { b: Building; cleared: number[] } {
    const d = BUILDINGS[type];
    const b = this.newBuilding(type, x, y, owner);
    let ship: Ship | undefined;
    if (pay) {
      if (type === 'kontor') {
        ship = this.shipNear(owner, x + d.size / 2, y + d.size / 2);
        this.players[owner].money -= d.cost.taler ?? 0;
        if (ship) for (const k of ['holz', 'werkzeug'] as const) this.shipTake(ship, k, d.cost[k] ?? 0);
      } else this.pay(d.cost, owner, b.island);
    }
    if (LAGER.includes(type)) this.lager[`${owner}:${b.island}`] ??= zeroGoods();
    const cleared: number[] = [];
    for (let j = 0; j < d.size; j++) for (let i = 0; i < d.size; i++) {
      const k = this.idx(x + i, y + j);
      if (this.tiles[k] === T.Wald) { this.tiles[k] = T.Gras; cleared.push(k); }
    }
    this.buildings.push(b);
    this.byId.set(b.id, b);
    this.stamp(b, b.id);
    if (type === 'haus') this.popCache.clear();
    if (pay) {
      const now = wallClock();
      for (const [id, r] of this.recent) if (now - r.t > UNDO_SECONDS) this.recent.delete(id);
      this.recent.set(b.id, { t: now, paid: { ...d.cost }, cleared, ship: ship?.id });
    }
    return { b, cleared };
  }

  /** nach jedem erfolgreichen Bau: die Spielteile (src/systems.ts) erfahren davon */
  private afterPlace(b: Building) {
    for (const s of SYSTEMS) s.afterPlace?.(this, b);
  }

  place(type: BuildingId, x: number, y: number, owner = HUMAN): Check {
    const c = this.canPlace(type, x, y, owner);
    if (!c.ok) return c;
    const d = BUILDINGS[type];
    const { b, cleared } = this.putBuilding(type, x, y, owner, true);
    this.recompute();
    if (LAGER.includes(type) && owner === HUMAN) {
      const [cx, cy] = this.center(b);
      this.reveal(cx, cy, (d.radius ?? 8) + 3);
      if (this.seenDirty) { this.seenDirty = false; this.ev.seen(); }
    }
    if (cleared.length) this.ev.trees();
    this.ev.added(b);
    if (type === 'kontor' && owner === HUMAN) {
      this.focus = b.island;
      this.ev.message(`Kontor auf ${this.islands[b.island].name} gegründet! Lade jetzt die Waren aus dem Schiff.`, 'good', this.at(b));
    }
    this.afterPlace(b);
    return { ok: true };
  }

  /**
   * Gebäude für einen neutralen Besitzer setzen (Piratennest, Ureinwohner) – ohne Gebiets-, Freischalt-
   * und Kostenprüfung. Das Gelände muss passen: Land derselben Insel, kein Berg, frei. null = geht hier nicht.
   */
  placeNeutral(type: BuildingId, x: number, y: number, owner: number): Building | null {
    const s = BUILDINGS[type].size;
    if (!this.inMap(x, y)) return null;
    const isl = this.islandOf[this.idx(x, y)];
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
      const tx = x + i, ty = y + j;
      if (!this.inMap(tx, ty)) return null;
      const k = this.idx(tx, ty);
      const t = this.tiles[k];
      if (t === T.Wasser || t === T.Berg || this.occ[k] || this.roads[k] || this.islandOf[k] !== isl) return null;
    }
    const { b, cleared } = this.putBuilding(type, x, y, owner, false);
    this.recompute();
    if (cleared.length) this.ev.trees();
    this.ev.added(b);
    return b;
  }

  /** Weg bauen: 'weg' = Feldweg, 'steinweg' = Pflasterweg (kostet 1 Stein, Karren schneller). Feldwege lassen sich pflastern. */
  canRoad(x: number, y: number, owner = HUMAN, type: 'weg' | 'steinweg' = 'weg'): Check {
    if (!this.inMap(x, y)) return { ok: false, reason: 'Außerhalb der Karte' };
    const k = this.idx(x, y);
    const t = this.tiles[k];
    if (t === T.Wasser || t === T.Berg) return { ok: false, reason: 'Hier geht kein Weg' };
    const upgrade = type === 'steinweg' && this.roads[k] === 1;
    if ((this.roads[k] && !upgrade) || this.occ[k]) return { ok: false, reason: 'Platz ist belegt' };
    if (this.own[k] !== owner) return { ok: false, reason: 'Außerhalb deines Gebiets' };
    if (type === 'steinweg' && owner === HUMAN && !this.isUnlocked('steinweg')) return { ok: false, reason: 'Pflasterwege erst ab 15 Siedlern' };
    const c = BUILDINGS[type].cost;
    if (this.players[owner].money < (c.taler ?? 0)) return { ok: false, reason: 'Zu wenig Taler' };
    if (c.stein && (this.lagerOf(owner, this.islandOf[k])?.stein ?? 0) < c.stein) return { ok: false, reason: 'Zu wenig Steine' };
    return { ok: true };
  }

  placeRoads(cells: [number, number][], owner = HUMAN, type: 'weg' | 'steinweg' = 'weg'): number {
    let n = 0, trees = false, lastReason = '';
    const c = BUILDINGS[type].cost;
    const now = wallClock();
    for (const [k, r] of this.recentRoads) if (now - r.t > UNDO_SECONDS) this.recentRoads.delete(k);
    for (const [x, y] of cells) {
      const ch = this.canRoad(x, y, owner, type);
      if (!ch.ok) { lastReason = ch.reason ?? ''; continue; }
      const k = this.idx(x, y);
      const wood = this.tiles[k] === T.Wald;
      if (wood) { this.tiles[k] = T.Gras; trees = true; }
      // für undoBuild merken, was vorher hier lag (beim Pflastern: der Feldweg)
      const prev = this.recentRoads.get(k);
      this.recentRoads.set(k, { t: now, owner, prev: prev ? prev.prev : this.roads[k], paid: prev ? addCost({ ...prev.paid }, c) : { ...c }, cleared: wood || !!prev?.cleared });
      this.roads[k] = type === 'steinweg' ? 2 : 1;
      this.players[owner].money -= c.taler ?? 0;
      if (c.stein) { const l = this.lagerOf(owner, this.islandOf[k]); if (l) l.stein -= c.stein; }
      n++;
    }
    if (n) { this.recompute(); this.ev.roads(); }
    if (trees) this.ev.trees();
    if (!n && lastReason && cells.length === 1 && owner === HUMAN) this.ev.message(lastReason, 'bad', { x: cells[0][0] + 0.5, y: cells[0][1] + 0.5 });
    return n;
  }

  /**
   * Viele Teile auf einmal (Mauern, Palisaden, ein Feld voller Häuser): alles setzen, dann nur
   * eine Neuberechnung und die Meldungen gesammelt am Ende. Gibt die Zahl der gebauten Teile zurück.
   */
  placeMany(type: BuildingId, cells: [number, number][], owner = HUMAN): number {
    let last = '', lastAt: MsgAt | undefined;
    if (LAGER.includes(type)) {
      // Kontor und Marktplatz verändern das Baugebiet: dann Teil für Teil (kommt kaum vor)
      let n = 0;
      for (const [x, y] of cells) { const r = this.place(type, x, y, owner); if (r.ok) n++; else { last = r.reason ?? ''; lastAt = { x: x + 0.5, y: y + 0.5 }; } }
      if (!n && last && owner === HUMAN) this.ev.message(last, 'bad', lastAt);
      return n;
    }
    // Die Prüfung bleibt ohne Neuberechnung gültig: belegte Felder, Geld und Lager ändern sich sofort mit
    const placed: Building[] = [];
    let trees = false;
    for (const [x, y] of cells) {
      const c = this.canPlace(type, x, y, owner);
      if (!c.ok) { last = c.reason ?? ''; lastAt = { x: x + 0.5, y: y + 0.5 }; continue; }
      const r = this.putBuilding(type, x, y, owner, true);
      if (r.cleared.length) trees = true;
      placed.push(r.b);
    }
    if (placed.length) {
      this.recompute();
      if (trees) this.ev.trees();
      for (const b of placed) this.ev.added(b);
      for (const b of placed) this.afterPlace(b);
    }
    if (!placed.length && last && owner === HUMAN) this.ev.message(last, 'bad', lastAt);
    return placed.length;
  }

  // ---------- Kontor-Ausbau und Werft ----------

  kontorUpgrade(b: Building): Check {
    const lv = (b.level ?? 0) + 1;
    const next = KONTOR_LEVELS[lv];
    if (!next) return { ok: false, reason: 'Höchste Ausbaustufe erreicht' };
    if (next.unlock && !this.reached(next.unlock, b.owner)) return { ok: false, reason: `Erst ab ${next.unlock.n} ${TIERS[next.unlock.tier].dat}` };
    const c = this.canAfford(next.cost, b.owner, b.island);
    if (!c.ok) return c;
    this.pay(next.cost, b.owner, b.island);
    b.level = lv;
    this.recompute();
    // die Darstellung soll die neue Kontorstufe zeigen können
    this.ev.changed(b);
    return { ok: true };
  }

  canOrderShip(w: Building, type: ShipType): Check {
    const sd = SHIPS[type];
    if (w.job) return { ok: false, reason: 'Die Werft baut gerade' };
    if (sd.werft === 'grosswerft' && w.type !== 'grosswerft') return { ok: false, reason: 'Nur auf der großen Werft' };
    if (!this.reached(sd.unlock, w.owner)) return { ok: false, reason: `Erst ab ${sd.unlock.n} ${TIERS[sd.unlock.tier].dat}` };
    const maxShips = 20 + this.buildings.filter((b) => b.type === 'triumphbogen' && b.owner === w.owner).length;
    if (this.ships.filter((s) => s.owner === w.owner).length >= maxShips) return { ok: false, reason: `Höchstens ${maxShips} Schiffe` };
    const l = this.lagerOf(w.owner, w.island);
    if (this.players[w.owner].money < sd.cost.taler) return { ok: false, reason: 'Zu wenig Taler' };
    if (!l || l.holz < sd.cost.holz) return { ok: false, reason: 'Zu wenig Holz' };
    if (l.stoff < sd.cost.stoff) return { ok: false, reason: 'Zu wenig Stoffe (für die Segel)' };
    return { ok: true };
  }

  orderShip(w: Building, type: ShipType): Check {
    const c = this.canOrderShip(w, type);
    if (!c.ok) return c;
    const sd = SHIPS[type];
    const l = this.lagerOf(w.owner, w.island)!;
    this.players[w.owner].money -= sd.cost.taler;
    l.holz -= sd.cost.holz; l.stoff -= sd.cost.stoff;
    w.job = { ship: type, t: 0 };
    return { ok: true };
  }

  private tickWerft(w: Building, dt: number) {
    if (!w.job) return;
    const sd = SHIPS[w.job.ship];
    w.job.t += dt * (w.type === 'grosswerft' ? 1.6 : 1);
    if (w.job.t < sd.time) return;
    // Stapellauf am nächsten Wasserfeld
    let spot: [number, number] | null = null;
    for (const [x, y] of this.ring(w)) if (this.inMap(x, y) && this.tiles[this.idx(x, y)] === T.Wasser) { spot = [x, y]; break; }
    if (!spot) return;
    const names = ['Möwe', 'Delfin', 'Hoffnung', 'Fortuna', 'Seestern', 'Albatros', 'Zuversicht', 'Stolz von Neue Ufer', 'Brise', 'Kormoran'];
    const ship: Ship = { id: this.nextId++, type: w.job.ship, owner: w.owner, name: names[this.ships.length % names.length], x: spot[0] + 0.5, y: spot[1] + 0.5, dir: 0, path: [], slots: [] };
    for (let i = 0; i < sd.slots; i++) ship.slots.push({ g: null, n: 0 });
    this.ships.push(ship);
    w.job = undefined;
    if (w.owner === HUMAN) this.ev.message(`⛵ ${sd.name} „${ship.name}“ ist vom Stapel gelaufen!`, 'good', { x: ship.x, y: ship.y });
  }

  demolish(x: number, y: number): boolean {
    if (!this.inMap(x, y)) return false;
    const k = this.idx(x, y);
    // ein Gebäude geht vor (ein Tor kann auf einem Weg stehen: dann zuerst das Tor)
    if (!this.occ[k] && this.roads[k] && this.area[k]) { this.roads[k] = 0; this.recentRoads.delete(k); this.recompute(); this.ev.roads(); return true; }
    const b = this.buildingAt(x, y);
    if (!b || b.owner !== HUMAN) return false;
    if (b.type === 'kontor') {
      const r = this.demolishKontor(b);
      if (!r.ok) this.ev.message(r.reason ?? '', 'bad', this.at(b));
      return r.ok;
    }
    this.removeBuilding(b);
    return true;
  }

  /** Darf das Kontor weg? Nur, wenn auf der Insel sonst nichts mehr von seinem Besitzer steht (wie im Vorbild) */
  canDemolishKontor(k: Building): Check {
    if (k.type !== 'kontor') return { ok: false, reason: 'Kein Kontor' };
    if (this.buildings.some((o) => o !== k && o.owner === k.owner && o.island === k.island)) return { ok: false, reason: 'Erst alle anderen Gebäude auf der Insel abreißen' };
    return { ok: true };
  }

  /** Kontor abreißen und die Insel aufgeben: das Lager verfällt, Wege und Gebiet werden frei */
  demolishKontor(k: Building): Check {
    const c = this.canDemolishKontor(k);
    if (!c.ok) return c;
    this.takeDown(k, false);
    delete this.lager[`${k.owner}:${k.island}`];
    let roads = false;
    for (let k2 = 0; k2 < this.roads.length; k2++) if (this.roads[k2] && this.own[k2] === k.owner && this.islandOf[k2] === k.island) { this.roads[k2] = 0; this.recentRoads.delete(k2); roads = true; }
    this.recompute();
    if (this.focus === k.island && k.owner === HUMAN) this.focus = this.kontor(HUMAN)?.island ?? -1;
    this.ev.removed(k);
    if (roads) this.ev.roads();
    if (k.owner === HUMAN) this.ev.message(`⚓ Kontor auf ${this.islands[k.island]?.name ?? 'der Insel'} abgerissen – die Insel ist wieder frei.`, 'info');
    return { ok: true };
  }

  /** Gebäude ohne Rückgabe von Baumaterial entfernen (zerstört im Kampf; auch Kontore) */
  forceRemove(b: Building) {
    this.takeDown(b, false);
    this.recompute();
    this.ev.removed(b);
  }

  /** Mehrere Gebäude auf einmal entfernen (ohne Rückerstattung), nur einmal neu rechnen – z. B. die verlassene
   *  Stadt eines besiegten Gegners */
  forceRemoveMany(list: Building[]) {
    if (!list.length) return;
    for (const b of list) this.takeDown(b, false);
    this.recompute();
    for (const b of list) this.ev.removed(b);
  }

  removeBuilding(b: Building) {
    if (b.type === 'kontor') return;
    this.takeDown(b, true);
    this.recompute();
    this.ev.removed(b);
  }

  /** Gebäude von der Karte nehmen (ohne Neuberechnung); refund = halbes Baumaterial ins Inselllager (bis zum Limit) */
  private takeDown(b: Building, refund: boolean): Cost {
    const back: Cost = {};
    if (refund) {
      const l = this.lagerOf(b.owner, b.island);
      const cap = this.capOf(b.owner, b.island);
      const r = halfRefund(this.def(b).cost);
      if (l) for (const k of BUILD_GOODS) {
        const v = Math.max(0, Math.min(l[k] + (r[k] ?? 0), Math.max(cap, l[k])) - l[k]);
        if (v) { l[k] += v; back[k] = v; }
      }
    }
    this.stamp(b, 0);
    this.buildings = this.buildings.filter((o) => o !== b);
    this.byId.delete(b.id);
    this.recent.delete(b.id);
    if (b.type === 'haus') this.popCache.clear();
    return back;
  }

  /**
   * Bereich abreißen (Ecke x0/y0 bis x1/y1): eigene Gebäude (das Kontor bleibt stehen) und eigene Wege.
   * dry = nur zählen (für die Rückfrage), nichts ändern. Ein recompute am Ende. refund = halbes Baumaterial.
   */
  demolishArea(x0: number, y0: number, x1: number, y1: number, dry = false, owner = HUMAN): AreaResult {
    const res: AreaResult = { buildings: 0, roads: 0, kept: 0, refund: {} };
    const ax = Math.max(0, Math.min(x0, x1)), bx = Math.min(this.size - 1, Math.max(x0, x1));
    const ay = Math.max(0, Math.min(y0, y1)), by = Math.min(this.size - 1, Math.max(y0, y1));
    const hit = new Set<Building>();
    const roads: number[] = [];
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) {
      const k = this.idx(x, y);
      const b = this.buildingAt(x, y);
      if (b && b.owner === owner) hit.add(b);
      if (this.roads[k] && this.own[k] === owner) roads.push(k);
    }
    const gone: Building[] = [];
    for (const b of hit) {
      if (b.type === 'kontor') { res.kept++; continue; }
      res.buildings++;
      if (dry) addCost(res.refund, halfRefund(this.def(b).cost));
      else { addCost(res.refund, this.takeDown(b, true)); gone.push(b); }
    }
    res.roads = roads.length;
    if (dry || (!gone.length && !roads.length)) return res;
    for (const k of roads) { this.roads[k] = 0; this.recentRoads.delete(k); }
    this.recompute();
    for (const b of gone) this.ev.removed(b);
    if (roads.length) this.ev.roads();
    return res;
  }

  /**
   * Rückgängig: eben Gebautes wieder entfernen und die vollen Kosten erstatten – nur innerhalb von
   * UNDO_SECONDS echten Sekunden nach dem Bau. what = ein Gebäude, mehrere (z. B. eine Mauer) oder
   * die Felder einer Wegstrecke. Gerodeter Wald wächst dabei sofort wieder.
   */
  undoBuild(what: Building | readonly Building[] | readonly (readonly [number, number])[], owner = HUMAN): UndoResult {
    const list = (Array.isArray(what) ? what : [what]) as readonly (Building | readonly [number, number])[];
    const res: UndoResult = { ok: false, n: 0, refund: {} };
    if (!list.length) return { ...res, reason: 'Nichts zum Zurücknehmen' };
    const now = wallClock();
    let trees = false;
    if (Array.isArray(list[0])) {
      // Wegstrecke
      for (const [x, y] of list as readonly (readonly [number, number])[]) {
        if (!this.inMap(x, y)) continue;
        const k = this.idx(x, y);
        const r = this.recentRoads.get(k);
        if (!r || r.owner !== owner || now - r.t > UNDO_SECONDS) continue;
        this.roads[k] = r.prev;
        this.refund(r.paid, owner, this.islandOf[k], res.refund);
        if (r.cleared && !this.occ[k] && !r.prev) { this.tiles[k] = T.Wald; trees = true; }
        this.recentRoads.delete(k);
        res.n++;
      }
      if (!res.n) return { ...res, reason: 'Zu spät – zurücknehmen geht nur kurz nach dem Bau' };
      this.recompute();
      this.ev.roads();
      if (trees) this.ev.trees();
      return { ...res, ok: true };
    }
    const todo = (list as readonly Building[]).filter((b) => {
      const r = this.recent.get(b.id);
      return this.byId.get(b.id) === b && b.owner === owner && !!r && now - r.t <= UNDO_SECONDS;
    });
    if (!todo.length) return { ...res, reason: 'Zu spät – zurücknehmen geht nur kurz nach dem Bau' };
    const builtAt = Math.min(...todo.map((b) => this.recent.get(b.id)!.t));
    // ein Kontor erst prüfen, bevor irgendetwas geändert wird
    for (const b of todo) if (b.type === 'kontor') {
      const why = this.undoKontor(b, this.recent.get(b.id)!.ship, res.refund, true);
      if (why) return { ...res, reason: why };
    }
    for (const b of todo) {
      const r = this.recent.get(b.id)!;
      if (b.type === 'kontor') this.undoKontor(b, r.ship, res.refund, false);
      else this.refund(r.paid, owner, b.island, res.refund);
      this.takeDown(b, false);
      for (const k of r.cleared) if (!this.occ[k] && !this.roads[k]) { this.tiles[k] = T.Wald; trees = true; }
    }
    res.n = todo.length;
    this.recompute();
    for (const b of todo) this.ev.removed(b);
    if (trees) this.ev.trees();
    this.undoQuest(owner, builtAt);
    return { ...res, ok: true };
  }

  /** Rückgängig nach einer Aufgabe: Hat erst dieser Bau die Aufgabe erfüllt (Belohnung nach dem Bau gezahlt) und ist
   *  sie ohne ihn nicht mehr erfüllt, ist sie wieder offen – und die Belohnung geht zurück (keine Belohnung ohne Bau) */
  private undoQuest(owner: number, builtAt: number) {
    const q = this.questPaid;
    if (owner !== HUMAN || !q || q.t < builtAt - 0.001 || this.quest !== q.i + 1) return;
    if (QUESTS[q.i]?.done(this)) return;
    this.money -= q.reward;
    this.quest = q.i;
    this.questPaid = null;
    this.ev.message(`Aufgabe wieder offen: ${QUESTS[q.i].title} (−${q.reward} Taler Belohnung)`, 'info');
  }

  /** volle Kosten zurück: Taler an den Besitzer, Baumaterial ins Inselllager */
  private refund(c: Cost, owner: number, island: number, sum: Cost) {
    if (c.taler) { this.players[owner].money += c.taler; sum.taler = (sum.taler ?? 0) + c.taler; }
    const l = this.lagerOf(owner, island);
    if (l) for (const k of BUILD_GOODS) if (c[k]) { l[k] += c[k]!; sum[k] = (sum[k] ?? 0) + c[k]!; }
  }

  /**
   * Kontor zurücknehmen: geht nur, solange auf der Insel sonst nichts gebaut ist und das Schiff
   * daneben liegt – Baumaterial und alles im Lager kommen zurück an Bord.
   * check = nur prüfen. Gibt den Grund zurück, wenn es nicht geht (sonst null).
   */
  private undoKontor(k: Building, shipId: number | undefined, sum: Cost, check: boolean): string | null {
    if (this.buildings.some((o) => o !== k && o.owner === k.owner && o.island === k.island)) return 'Erst die anderen Gebäude auf der Insel abreißen';
    const [cx, cy] = this.center(k);
    const ship = this.ships.find((s) => s.id === shipId) ?? this.shipNear(k.owner, cx, cy);
    if (!ship || Math.hypot(ship.x - cx, ship.y - cy) > DOCK_RANGE + 2) return 'Das Schiff muss noch am Kontor liegen';
    const l = this.lagerOf(k.owner, k.island) ?? zeroGoods();
    const cost = BUILDINGS.kontor.cost;
    const load = new Map<GoodId, number>();
    for (const g of GOODS) if (l[g.id] >= 1) load.set(g.id, Math.floor(l[g.id]));
    for (const g of ['holz', 'werkzeug'] as const) load.set(g, (load.get(g) ?? 0) + (cost[g] ?? 0));
    // passt alles an Bord? (Laderäume zu je SLOT_CAP Tonnen)
    let need = 0;
    for (const [g, n] of load) {
      const room = ship.slots.filter((sl) => sl.g === g).reduce((a, sl) => a + SLOT_CAP - sl.n, 0);
      if (n > room) need += Math.ceil((n - room) / SLOT_CAP);
    }
    if (need > ship.slots.filter((sl) => !sl.g).length) return 'An Bord ist nicht genug Platz für Lager und Baumaterial';
    if (check) return null;
    for (const [g, n] of load) this.shipAdd(ship, g, n);
    this.players[k.owner].money += cost.taler ?? 0;
    addCost(sum, cost);
    delete this.lager[`${k.owner}:${k.island}`];
    return null;
  }

  // ---------- Simulation ----------

  /**
   * Einnahmen und Ausgaben je Minute. tax = alle Steuern, upkeep = aller Unterhalt (Gebäude + Militär);
   * dazu aufgeschlüsselt: army = Sold der Soldaten, buildings = Unterhalt der Gebäude, byTier = Steuern je Stufe.
   */
  incomePerMinute(owner = HUMAN): { tax: number; upkeep: number; army: number; buildings: number; byTier: number[] } {
    let tax = 0, buildings = 0;
    const byTier = TIERS.map(() => 0);
    for (const b of this.buildings) {
      if (b.owner !== owner) continue;
      buildings += this.upkeepOf(b);
      if (b.type === 'haus') { const t = this.houseTax(b); tax += t; byTier[b.tier] += t; }
    }
    const army = unitUpkeep(this, owner);
    return { tax, upkeep: buildings + army, army, buildings, byTier };
  }

  // ---------- Unterhalt, Steuern, Zufriedenheit ----------

  /** Ruht der Betrieb gerade? (abgeschaltet, Stillstand, oder er kann nicht arbeiten) */
  isIdle(b: Building): boolean {
    const d = this.def(b);
    if (d.id === 'werft' || d.id === 'grosswerft') return !b.job;
    if (!d.prod) return false;
    return !!b.off || b.status !== 'ok' || b.active < 0.2;
  }

  /** Unterhalt eines Gebäudes je Minute: im Betrieb voll, in Ruhe der Ruhewert (Werften nur mit Auftrag voll) */
  upkeepOf(b: Building): number {
    const d = this.def(b);
    return d.upkeepIdle !== undefined && this.isIdle(b) ? d.upkeepIdle : d.upkeep;
  }

  /** Steuersatz (%) einer Stufe; Computergegner zahlen immer den Standardsatz */
  taxRate(tier: number, owner = HUMAN): number {
    const p = this.players[owner];
    const v = p && !p.ai ? p.tax?.[tier] : undefined;
    return typeof v === 'number' && Number.isFinite(v) ? v : TIERS[tier].taxStd;
  }

  /** Steuersatz einer Stufe einstellen (0 … TAX_MAX %, ganze Prozent); gibt den neuen Satz zurück */
  setTaxRate(tier: number, rate: number, owner = HUMAN): number {
    const p = this.players[owner];
    if (!p || !TIERS[tier]) return 0;
    const v = Math.max(0, Math.min(TAX_MAX, Math.round(rate)));
    p.tax = TIERS.map((_, i) => this.taxRate(i, owner));
    p.tax[tier] = v;
    return v;
  }

  /** Wie gut ein Haus mit Waren versorgt ist (0..1): Grundbedarf zählt doppelt */
  supplyShare(h: Building): number {
    const tier = TIERS[h.tier];
    let sum = 0, n = 0;
    for (const g of Object.keys(tier.consumes) as GoodId[]) {
      const w = tier.core.includes(g) ? 2 : 1;
      sum += w * Math.max(0, Math.min(1, h.need[g] ?? 1));
      n += w;
    }
    return n ? sum / n : 1;
  }

  /** Höchster Steuersatz (%), den die Bewohner dieses Hauses klaglos zahlen: voll versorgt der Höchstsatz der
   *  Stufe, mit fehlenden Waren deutlich weniger (z. B. Bürger mit der Hälfte ihrer Waren etwa 20 %) */
  bearableTax(h: Building): number {
    const s = this.supplyShare(h);
    return TIERS[h.tier].maxTax * (0.25 + 0.75 * s * s);
  }

  /** Hungert das Haus? (Nahrung fehlt schon eine Weile) */
  hungry(h: Building): boolean { return (h.need.nahrung ?? 1) < 0.5; }

  /** Steuer eines Hauses je Minute: Bewohner × Steuer der Stufe × (Satz ÷ Standardsatz) × Zufriedenheit^1,3 */
  houseTax(h: Building): number {
    const t = TIERS[h.tier];
    return h.residents * t.tax * (this.taxRate(h.tier, h.owner) / t.taxStd) * Math.pow(Math.max(0, Math.min(1, h.happy)), 1.3);
  }

  /** Verbrauch der Bewohner einer Insel je Ware und Minute (einmal je Spielsekunde neu gezählt) */
  islandUse(owner: number, island: number): Partial<Record<GoodId, number>> {
    const sec = Math.floor(this.time);
    if (sec !== this.useT) {
      this.useT = sec;
      this.useCache.clear();
      for (const h of this.buildings) {
        if (h.type !== 'haus') continue;
        const key = `${h.owner}:${h.island}`;
        let u = this.useCache.get(key);
        if (!u) { u = {}; this.useCache.set(key, u); }
        for (const [g, r] of Object.entries(TIERS[h.tier].consumes) as [GoodId, number][]) u[g] = (u[g] ?? 0) + h.residents * r;
      }
    }
    return this.useCache.get(`${owner}:${island}`) ?? {};
  }

  /**
   * Waren für den Aufstieg eines Hauses: je Gruppe (z. B. Tabakwaren oder Gewürze) die Ware mit dem größten
   * Vorrat, wie viel da ist und wie viel da sein muss – der Vorrat muss die Insel samt dem aufsteigenden Haus
   * mindestens 2 Minuten versorgen (mindestens 1 t). So steigen nicht viele Häuser auf einmal auf und hungern dann.
   */
  upgradeGoods(h: Building): { group: GoodId[]; good: GoodId; have: number; need: number; ok: boolean }[] {
    const tier = TIERS[h.tier], next = TIERS[h.tier + 1];
    if (!next) return [];
    const l = this.lagerOf(h.owner, h.island) ?? EMPTY;
    const use = this.islandUse(h.owner, h.island);
    return (tier.next?.goods ?? []).map((group) => {
      const rows = group.map((g) => {
        const need = Math.max(1, 2 * ((use[g] ?? 0) + h.residents * (next.consumes[g] ?? 0)));
        return { good: g, have: l[g], need };
      });
      const best = rows.find((r) => r.have >= r.need) ?? rows.reduce((a, r) => (r.have / r.need > a.have / a.need ? r : a));
      return { group, ...best, ok: best.have >= best.need };
    });
  }

  /** Baumaterial für Haus-Aufstiege auf dieser Insel gesperrt? (Schalter am Kontor) */
  matLocked(owner: number, island: number): boolean { return !!this.kontor(owner, island)?.matLock; }

  /** Schalter am Kontor: Baumaterial an Bewohner sperren (true) oder freigeben */
  setMatLock(k: Building, lock: boolean) { if (k.type === 'kontor') k.matLock = lock || undefined; }

  /** Betrieb ruhen lassen (off = true) oder wieder arbeiten lassen */
  setOff(b: Building, off: boolean): Check {
    const d = this.def(b);
    if (!d.prod) return { ok: false, reason: 'Nur Betriebe können ruhen' };
    b.off = off || undefined;
    if (off) b.status = 'aus';
    return { ok: true };
  }

  /** Schulden erlassen: Kasse auf 0, das Spiel geht weiter (zählt später als Punktabzug) */
  forgiveDebt(owner = HUMAN) {
    const p = this.players[owner];
    if (!p) return;
    if (p.money < 0) p.money = 0;
    p.erlass = (p.erlass ?? 0) + 1;
    p.debtT = 0; p.debtWarn = 0;
    if (p.lost === 'bankrott') { p.lost = undefined; p.defeated = false; }
  }

  /** Schulden wie im Vorbild: Warnungen, und wer zu lange tief im Minus steht, ist bankrott.
   *  Computergegner verlieren dadurch nicht – im Minus können sie nur nichts bauen. */
  private tickDebt(p: Player, dt: number) {
    if (p.ai || p.pirate || p.trader || p.natives || p.defeated) return;
    const m = p.money, B = BANKROTT;
    if (m >= 0) { p.debtWarn = 0; p.debtT = 0; return; }
    const lvl = m < B.grenze ? 3 : m < B.warnungen[1] ? 2 : m < B.warnungen[0] ? 1 : 0;
    if (lvl > (p.debtWarn ?? 0)) {
      p.debtWarn = lvl;
      if (p.id === HUMAN) this.ev.message([
        '',
        '💸 Deine Kasse ist über 2 000 Taler im Minus. Erhöhe die Steuern, lass teure Betriebe ruhen oder verkaufe Waren am Kontor.',
        '💸 Schon 5 000 Taler Schulden! Steuern erhöhen, Betriebe ohne Arbeit ruhen lassen, Überschüsse verkaufen.',
        '🚨 Über 10 000 Taler Schulden! Bleibt es 10 Minuten so, bist du bankrott und hast verloren.',
      ][lvl], 'bad');
    }
    if (m < B.grenze) {
      const before = p.debtT ?? 0;
      p.debtT = before + dt;
      if (p.id === HUMAN && before < B.zeit - 120 && p.debtT >= B.zeit - 120) this.ev.message('🚨 Noch 2 Minuten bis zum Bankrott – bring die Kasse über −10 000 Taler!', 'bad');
      if (p.debtT >= B.zeit) {
        p.defeated = true;
        p.lost = 'bankrott';
        if (p.id === HUMAN) this.ev.message('🏳️ Bankrott – zu lange zu hohe Schulden.', 'bad');
      }
    } else p.debtT = 0;
  }

  /** Darstellungsort zwischen zwei Rechenschritten (Schiffe, Soldaten, Karren gleiten statt zu springen) */
  ip(o: { id: number; x: number; y: number }): [number, number] {
    const p = this.prev.get(o.id);
    if (!p) return [o.x, o.y];
    const dx = o.x - p[0], dy = o.y - p[1];
    if (dx * dx + dy * dy > 9) return [o.x, o.y]; // Sprung (z. B. an Land gesetzt): nicht gleiten
    return [p[0] + dx * this.alpha, p[1] + dy * this.alpha];
  }
  /** Arbeitsfortschritt zwischen zwei Rechenschritten (springt beim neuen Arbeitsgang nicht zurück-gleitend) */
  ipProgress(b: Building): number {
    const p = this.prevProg.get(b.id);
    if (p === undefined || b.progress < p) return b.progress;
    return p + (b.progress - p) * this.alpha;
  }

  /** Blickrichtung zwischen zwei Rechenschritten */
  ipDir(o: { id: number; dir: number }): number {
    const p = this.prev.get(o.id);
    if (!p) return o.dir;
    let d = o.dir - p[2];
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return p[2] + d * this.alpha;
  }

  tick(dt: number) {
    // Änderungen von außen (Tests, Oberfläche) sicher mitbekommen
    this.popCache.clear();
    this.prev.clear();
    for (const s of this.ships) this.prev.set(s.id, [s.x, s.y, s.dir]);
    for (const u of this.units) this.prev.set(u.id, [u.x, u.y, u.dir]);
    for (const c of this.carts) this.prev.set(c.id, [c.x, c.y, 0]);
    this.prevProg.clear();
    for (const b of this.buildings) if (b.loaded && b.target !== undefined) this.prevProg.set(b.id, b.progress);
    this.time += dt;
    for (const s of this.ships) this.tickShip(s, dt);
    this.sightT += dt;
    if (this.sightT > 0.5) {
      this.sightT = 0;
      for (const s of this.myShips()) this.reveal(s.x, s.y, SHIP_SIGHT);
      if (this.seenDirty) { this.seenDirty = false; this.ev.seen(); }
    }
    for (const b of this.buildings) {
      if (b.type === 'haus') this.tickHouse(b, dt);
      else if (this.def(b).prod) this.tickProduction(b, dt);
      else if (b.job) this.tickWerft(b, dt);
    }
    this.regenT += dt;
    if (this.regenT >= 1) { this.regrow(this.regenT); this.regenT = 0; }
    this.cartT += dt;
    this.tickCarts(dt);
    // Piraten ausgeschaltet (Spieleinstellung): sie tauchen nie auf
    if (!this.opts.piraten) this.pirateT = Math.max(this.pirateT, 1e9);
    tickCombat(this, dt);
    for (const p of this.players) if (p.ai && p.brain) thinkAI(this, p, dt);
    for (const p of this.players) {
      const { tax, upkeep } = this.incomePerMinute(p.id);
      p.money += ((tax - upkeep) / 60) * dt;
      this.tickDebt(p, dt);
    }
    this.unlockT += dt;
    if (this.unlockT > 1) { this.unlockT = 0; this.checkUnlocks(); }
    this.checkQuest();
    for (const s of SYSTEMS) s.tick?.(this, dt);
  }

  private regrow(dt: number) {
    const NN = this.trees.length;
    const rb = REGEN.baum * dt, rf = REGEN.fisch * dt, rw = REGEN.wild * dt, rg = REGEN.weide * dt, rl = REGEN.feld * dt;
    for (let k = 0; k < NN; k++) {
      const t = this.tiles[k];
      if (t === T.Wald) {
        if (this.trees[k] < 1) this.trees[k] = Math.min(1, this.trees[k] + rb);
        if (this.wild[k] < 1) this.wild[k] = Math.min(1, this.wild[k] + rw);
      } else if (t === T.Wasser) {
        const c = this.fishCap[k];
        if (c > 0 && this.fish[k] < c) this.fish[k] = Math.min(c, this.fish[k] + rf * c);
      } else {
        if (this.weide[k] < 1) this.weide[k] = Math.min(1, this.weide[k] + rg);
        if (this.feld[k] < 1) this.feld[k] = Math.min(1, this.feld[k] + rl);
      }
    }
  }

  /** Arbeitsgang beginnen: Ziel wählen (reifer Baum / ergiebigstes Feld). false = nichts mehr da */
  private startHarvest(b: Building): boolean {
    const h = this.def(b).harvest!;
    const st = this.resStock(h.res);
    const tiles = this.workTiles(b.type, b.x, b.y).filter((k) => this.resOk(h.res, k));
    if (h.res === 'baum') {
      const taken = new Set(this.buildings.filter((o) => o !== b && o.loaded && o.target !== undefined).map((o) => o.target));
      const [cx, cy] = this.center(b);
      let best = -1, bd = 1e9;
      for (const k of tiles) {
        if (st[k] < 0.999 || taken.has(k)) continue;
        const d = Math.hypot(k % this.size + 0.5 - cx, ((k / this.size) | 0) + 0.5 - cy);
        if (d < bd) { bd = d; best = k; }
      }
      if (best < 0) return false;
      b.target = best; b.cut = false;
      return true;
    }
    let sum = 0, best = -1, bv = 0;
    for (const k of tiles) { sum += st[k]; if (st[k] > bv) { bv = st[k]; best = k; } }
    if (sum < h.per) return false;
    b.target = best;
    return true;
  }

  /** Arbeitsgang abschließen: Rohstoff aus der Umgebung nehmen */
  private finishHarvest(b: Building): boolean {
    const h = this.def(b).harvest!;
    if (h.res === 'baum') {
      if (!b.cut && b.target !== undefined && b.target >= 0) { this.trees[b.target] = 0; this.ev.felled(b.target); b.cut = true; }
      return true;
    }
    const st = this.resStock(h.res);
    const N = this.size;
    const tx = (b.target ?? 0) % N, ty = ((b.target ?? 0) / N) | 0;
    // nahe am Ziel zuerst abernten (Fische im Schwarm, Schafe auf einer Weidefläche)
    const tiles = this.workTiles(b.type, b.x, b.y).filter((k) => this.resOk(h.res, k))
      .sort((p, q) => Math.hypot(p % N - tx, ((p / N) | 0) - ty) - Math.hypot(q % N - tx, ((q / N) | 0) - ty));
    let left = h.per;
    for (const k of tiles) { if (left <= 0) break; const t = Math.min(st[k], left, h.res === 'weide' ? 1 : 0.34); st[k] -= t; left -= t; }
    return left < h.per * 0.5;
  }

  private tickProduction(b: Building, dt: number) {
    const p = this.def(b).prod!;
    const l = this.lagerOf(b.owner, b.island);
    let working = false;
    b.missing = [];
    const hv = this.def(b).harvest;
    if (b.off) b.status = 'aus';
    else if (!l || !this.linked.has(b.id)) b.status = 'keinWeg';
    else if (!this.inReach.has(b.id)) b.status = 'zuWeit';
    else if (b.eff <= 0 && !hv) b.status = this.def(b).deposit ? 'erschoepft' : this.def(b).needs === 'wasser' ? 'keinWasser' : 'keinWald';
    else if (b.stock >= (this.def(b).stock ?? 4)) b.status = 'lagerVoll';
    else if (hv && !b.loaded && !this.startHarvest(b)) b.status = 'erschoepft';
    else {
      if (hv) b.loaded = true;
      if (!b.loaded) {
        const inp = p.input ?? {};
        for (const [g, n] of Object.entries(inp) as [GoodId, number][]) if (l[g] < n) b.missing.push(g);
        if (!b.missing.length) {
          for (const [g, n] of Object.entries(inp) as [GoodId, number][]) l[g] -= n;
          b.loaded = true;
        }
      }
      if (b.loaded) {
        working = true;
        b.status = 'ok';
        b.progress += dt * (hv ? this.fertility(b.type, b.x, b.y) : b.eff);
        // Baum fällt kurz vor Ende des Arbeitsgangs (Holzfäller hackt erst)
        if (hv?.res === 'baum' && !b.cut && b.progress >= p.time * 0.8 && b.target !== undefined) {
          this.trees[b.target] = 0; this.ev.felled(b.target); b.cut = true;
        }
        if (b.progress >= p.time) {
          b.progress = 0;
          b.loaded = false;
          const ok = hv ? this.finishHarvest(b) : true;
          if (ok) b.stock = Math.min(this.def(b).stock ?? 4, b.stock + (p.amount ?? 1));
          const dep = this.def(b).deposit;
          const il = this.islands[b.island];
          // Erz wird weniger (außer bei unerschöpflichen Vorkommen): oben für die Erzmine, darunter für die tiefe Mine
          if (il && !il.erzEndlos && (dep === 'erz' || dep === 'tiefErz')) {
            const key = dep === 'erz' ? 'erz' : 'erzDeep';
            const before = il[key];
            il[key] = Math.max(0, il[key] - (p.amount ?? 1));
            if (before > 0 && il[key] === 0) {
              for (const o of this.buildings) if (o.island === b.island && this.def(o).deposit === dep) o.eff = 0;
              if (b.owner === HUMAN) this.ev.message(dep === 'erz'
                ? `⛏️ Das Erzvorkommen auf ${il.name} ist erschöpft.${il.erzDeep > 0 && this.isUnlocked('tiefeErzmine') ? ' Eine tiefe Erzmine kommt noch an den Rest.' : ''}`
                : `⛏️ Auf ${il.name} ist das Erz jetzt endgültig erschöpft – kaufe Erz beim Händler oder suche ein anderes Vorkommen.`, 'bad', this.at(b));
            }
          }
          b.target = undefined;
        }
      } else b.status = 'rohstoff';
    }
    b.active += ((working ? 1 : 0) - b.active) * Math.min(1, dt * 0.1);
  }

  /**
   * Haus: Waren verbrauchen, Zufriedenheit, Ein- und Auszug, Auf- und Abstieg.
   * Zufriedenheit = 70 % Waren (Grundbedarf doppelt) + 30 % öffentliche Gebäude, dazu die Steuern:
   * jeder Prozentpunkt über dem tragbaren Satz kostet 3 Punkte Zufriedenheit, ab 5 Punkten darüber 6 Punkte
   * (gut 10 Punkte zu viel = Auszug); ein niedrigerer Satz bringt bis zu 10 Punkte. Ohne Nahrung herrscht Hunger: höchstens 30 % – die Bewohner ziehen aus.
   */
  private tickHouse(h: Building, dt: number) {
    const tier = TIERS[h.tier];
    const l = this.lagerOf(h.owner, h.island);
    h.status = 'wohnen';
    for (const [g, rate] of Object.entries(tier.consumes) as [GoodId, number][]) {
      h.demand[g] = Math.min(2, (h.demand[g] ?? 0) + (h.residents * rate * dt) / 60);
      while ((h.demand[g] ?? 0) >= 1) {
        if (l && l[g] >= 1) { l[g] -= 1; h.demand[g]! -= 1; h.short[g] = false; }
        else { h.short[g] = true; break; }
      }
      const target = h.short[g] ? 0 : 1;
      const cur = h.need[g] ?? 1;
      h.need[g] = cur + (target - cur) * Math.min(1, dt / 25);
    }
    const cov = this.coverage.get(h.id) ?? new Set();
    const svcFrac = tier.services.filter((s) => cov.has(s)).length / tier.services.length;
    const supply = this.supplyShare(h);
    let target = supply * 0.7 + svcFrac * 0.3;
    const over = this.taxRate(h.tier, h.owner) - this.bearableTax(h);
    if (over > 0) target -= over * 0.03 + Math.max(0, over - 5) * 0.03;
    else target += Math.min(0.1, -over * 0.01);
    const hunger = this.hungry(h);
    if (hunger) target = Math.min(target, 0.3);
    target = Math.max(0, Math.min(1, target));
    h.happy += (target - h.happy) * Math.min(1, dt / 8);

    if (h.happy > 0.85 && h.residents < tier.maxResidents) {
      h.growT += dt;
      if (h.growT >= 6) { h.residents++; h.growT = 0; this.popCache.clear(); }
    } else if (h.happy < 0.45 && h.residents > 1) {
      h.growT -= dt;
      if (h.growT <= -12) {
        h.residents--; h.growT = 0; this.popCache.clear();
        h.leave = hunger || (h.need.nahrung ?? 1) < 0.6 ? 'hunger' : over > 3 && supply > 0.6 ? 'steuern' : 'mangel';
        this.leaveMessage(h);
      }
    } else h.growT *= 0.98;

    // Abstieg: lange sehr unzufrieden und nur noch so viele Bewohner, wie in die Stufe darunter passen
    if (h.happy < 0.25) h.downT = (h.downT ?? 0) + dt;
    else if (h.downT) h.downT = Math.max(0, h.downT - dt * 2);
    if (h.tier > 0 && (h.downT ?? 0) >= 90 && h.residents <= TIERS[h.tier - 1].maxResidents) {
      const why = this.houseLack(h);
      h.tier--;
      h.downT = 0; h.upT = 0;
      this.popCache.clear();
      this.ev.changed(h);
      if (h.owner === HUMAN) this.ev.message(`🏚️ Haus verfällt zu ${TIERS[h.tier].name}: ${why}`, 'bad', this.at(h));
      return;
    }

    const block = this.upgradeBlocker(h);
    if (!block) {
      h.upT += dt;
      if (h.upT >= 10) {
        // erst jetzt bezahlen – und nur, wenn das Material noch da ist (das Lager fällt nie unter 0)
        const cost = TIERS[h.tier + 1].upgradeCost;
        if (!this.canAfford(cost, h.owner, h.island).ok) { h.upT = 0; return; }
        this.pay(cost, h.owner, h.island);
        h.tier++;
        h.upT = 0;
        h.downT = 0;
        this.popCache.clear();
        for (const g of Object.keys(TIERS[h.tier].consumes) as GoodId[]) if (h.need[g] === undefined) h.need[g] = 1;
        this.ev.changed(h);
        if (h.owner === HUMAN && this.housesByTier()[h.tier] === 1) this.ev.message(`Deine ersten ${TIERS[h.tier].name} sind eingezogen! 🎉`, 'good', this.at(h));
      }
    } else h.upT = 0;
  }

  /** Was dem Haus am meisten fehlt, in Worten (für Meldungen): Nahrung, sonst Waren, Gebäude, Steuern */
  houseLack(h: Building): string {
    const tier = TIERS[h.tier];
    if (this.hungry(h)) return 'Nahrung fehlt';
    const goods = (Object.keys(tier.consumes) as GoodId[]).filter((g) => (h.need[g] ?? 1) < 0.6);
    if (goods.length) return `${goods.map((g) => GOOD[g].name).join(', ')} fehlt`;
    const cov = this.coverage.get(h.id) ?? new Set();
    const svc = tier.services.filter((s) => !cov.has(s));
    if (svc.length) return `${svc.map((s) => BUILDINGS[s].name).join(', ')} in der Nähe fehlt`;
    if (this.taxRate(h.tier, h.owner) > this.bearableTax(h)) return 'die Steuern sind zu hoch';
    return 'die Bewohner sind unzufrieden';
  }

  /** Meldung „Bewohner ziehen aus“ – je Insel höchstens alle 2 Minuten */
  private leaveMessage(h: Building) {
    if (h.owner !== HUMAN || !h.leave) return;
    const key = `${h.island}`;
    if (this.time - (this.leaveMsgT.get(key) ?? -1e9) < 120) return;
    this.leaveMsgT.set(key, this.time);
    const isl = this.islands[h.island]?.name ?? 'deiner Insel';
    const text = h.leave === 'hunger' ? `🍖 Hunger auf ${isl}: Bewohner ziehen aus. Baue mehr Fischer- oder Jagdhütten!`
      : h.leave === 'steuern' ? `💰 Zu hohe Steuern für die ${TIERS[h.tier].name} auf ${isl}: Bewohner ziehen aus. Senke den Steuersatz.`
      : `😠 Auf ${isl} ziehen ${TIERS[h.tier].name} aus: ${this.houseLack(h)}.`;
    this.ev.message(text, 'bad', this.at(h));
  }

  upgradeBlocker(h: Building): string | null {
    if (h.tier >= TIERS.length - 1) return 'Höchste Stufe erreicht';
    const tier = TIERS[h.tier];
    const next = TIERS[h.tier + 1];
    if (h.residents < tier.maxResidents) return `Haus noch nicht voll (${h.residents}/${tier.maxResidents})`;
    if (h.happy < 0.85) return 'Bewohner noch nicht zufrieden genug';
    const cov = this.coverage.get(h.id) ?? new Set();
    for (const s of tier.next?.services ?? []) if (!cov.has(s)) return `${BUILDINGS[s].name} in der Nähe fehlt`;
    for (const r of this.upgradeGoods(h)) {
      if (r.ok) continue;
      if (r.have < 1) return `${r.group.map((g) => GOOD[g].name).join(' oder ')} fehlt im Lager`;
      return `Zu wenig ${GOOD[r.good].name} im Lager (${Math.floor(r.have)} von ${Math.ceil(r.need)} t – reicht keine 2 Minuten)`;
    }
    if (BUILD_GOODS.some((k) => (next.upgradeCost[k] ?? 0) > 0) && this.matLocked(h.owner, h.island)) return 'Baumaterial gesperrt (Schalter am Kontor)';
    const c = this.canAfford(next.upgradeCost, h.owner, h.island);
    if (!c.ok) return `${c.reason} zum Ausbau`;
    return null;
  }

  // ---------- Aufgaben ----------

  checkQuest() {
    const q = QUESTS[this.quest];
    if (!q || !q.done(this)) return;
    // Belohnung je nach Schwierigkeit (schwer: die Hälfte)
    const reward = Math.round(q.reward * stufe(this.opts.schwierigkeit).belohnung);
    this.money += reward;
    this.ev.message(`Aufgabe erledigt: ${q.title} (+${reward} Taler)`, 'good');
    this.questPaid = { i: this.quest, reward, t: wallClock() };
    this.quest++;
  }
}

export interface Quest { title: string; hint: string; done(g: Game): boolean; progress(g: Game): string; reward: number }

const linkedAny = (g: Game, types: BuildingId[]) => types.reduce((n, t) => n + g.count(t, true), 0);
const stored = (g: Game) => { const k = g.kontor(); const l = k ? g.lagerOf(HUMAN, k.island) : null; return l ? Object.values(l).reduce((a, b) => a + b, 0) : 0; };

const houses = (g: Game, tier: number) => g.housesByTier().slice(tier).reduce((a, b) => a + b, 0);
const any = (g: Game, types: BuildingId[], linked = true) => types.some((t) => g.count(t, linked) >= 1);
const step = (title: string, hint: string, done: (g: Game) => boolean, progress: (g: Game) => string, reward: number): Quest => ({ title, hint, done, progress, reward });
const all = (types: BuildingId[], linked = true) => ({
  done: (g: Game) => types.every((t) => g.count(t, linked) >= 1),
  progress: (g: Game) => `${types.filter((t) => g.count(t, linked) >= 1).length}/${types.length}`,
});
const tierGoal = (tier: number, n: number) => ({ done: (g: Game) => houses(g, tier) >= n, progress: (g: Game) => `${Math.min(n, houses(g, tier))}/${n}` });

/** Aufgaben führen Schritt für Schritt durch alle Stufen und Warenketten (wie die Lernkurve des Vorbilds) */
export const QUESTS: Quest[] = [
  step('Neues Land', 'Tippe dein Schiff an, dann aufs Meer oder auf eine Insel – es segelt so nah wie möglich heran. Erkunde die Inseln und gründe an der Küste einer guten Insel ein Kontor (Schiff antippen → „Kontor bauen“).',
    (g) => g.count('kontor') >= 1, (g) => `${Math.min(1, g.count('kontor'))}/1`, 300),
  step('Ladung löschen', 'Lade Werkzeug, Holz und Nahrung aus dem Schiff ins Kontor (Schiff antippen → „Alles ausladen“).',
    (g) => stored(g) >= 40, (g) => `${Math.min(40, Math.floor(stored(g)))}/40 t`, 100),
  step('Holz für den Aufbau', 'Baue einen Holzfäller nahe am Wald und verbinde ihn mit einem Feldweg mit dem Kontor ⚓.', ...Object.values(all(['holzfaeller'])) as [Quest['done'], Quest['progress']], 200),
  step('Nahrung', 'Baue eine Fischerhütte an guten Fischgründen (Kräuselringe!) oder eine Jagdhütte am Wald und verbinde sie per Weg.',
    (g) => linkedAny(g, ['fischer', 'jagdhuette']) >= 1, (g) => `${Math.min(1, linkedAny(g, ['fischer', 'jagdhuette']))}/1`, 200),
  step('Ein Platz zum Leben', 'Baue einen Marktplatz. Er vergrößert dein Gebiet und versorgt Wohnhäuser.', ...Object.values(all(['markt'], false)) as [Quest['done'], Quest['progress']], 300),
  step('Erste Siedlung', 'Baue 8 Wohnhäuser in Reichweite des Marktplatzes.', (g) => g.count('haus') >= 8, (g) => `${Math.min(g.count('haus'), 8)}/8`, 300),
  step('Stoffe', 'Pioniere brauchen Stoffe, um aufzusteigen: Schaffarm (Wolle) und Weberei, beide mit Weg.', ...Object.values(all(['schaffarm', 'weberei'])) as [Quest['done'], Quest['progress']], 400),
  step('Glaube', 'Baue eine Kapelle in der Nähe deiner Häuser.', ...Object.values(all(['kapelle'], false)) as [Quest['done'], Quest['progress']], 300),
  step('Siedler', 'Volle, zufriedene Pionierhäuser mit Kapelle und Stoffen im Lager werden zu Siedlern. Ziel: 6 Siedlerhäuser.', ...Object.values(tierGoal(1, 6)) as [Quest['done'], Quest['progress']], 600),
  step('Steine', 'Ab 15 Siedlern: Steinbruch direkt am Berg. Steine brauchst du für Pflasterwege, Plantagen, Wirtshaus, Schule und mehr.', ...Object.values(all(['steinbruch'])) as [Quest['done'], Quest['progress']], 500),
  step('Alkohol', 'Siedler wollen Alkohol: Weingut oder Zuckerrohrplantage + Rumbrennerei (auf fruchtbarer Insel) – oder später die Brauerei.',
    (g) => any(g, ['weingut', 'rumbrennerei', 'brauerei']), (g) => (any(g, ['weingut', 'rumbrennerei', 'brauerei']) ? '1/1' : '0/1'), 700),
  step('Tabak oder Gewürze', 'Für Bürger: Tabakplantage + Tabakwarenmanufaktur oder eine Gewürzplantage. Schau mit dem Schiff, welche Insel dafür fruchtbar ist.',
    (g) => any(g, ['tabakwaren', 'gewuerzplantage']), (g) => (any(g, ['tabakwaren', 'gewuerzplantage']) ? '1/1' : '0/1'), 700),
  step('Wirtshaus und Schule', 'Siedler brauchen Wirtshaus (ab 50 Siedlern) und Schule (ab 100 Siedlern), um Bürger zu werden.', ...Object.values(all(['wirtshaus', 'schule'], false)) as [Quest['done'], Quest['progress']], 800),
  step('Bürger', 'Siedlerhäuser mit Alkohol, Tabakwaren oder Gewürzen, Wirtshaus und Schule werden zu Bürgern. Ziel: 6 Bürgerhäuser.', ...Object.values(tierGoal(2, 6)) as [Quest['done'], Quest['progress']], 1000),
  step('Eisen und Werkzeug', 'Erzmine am Berg einer Erz-Insel, Erzschmelze und Werkzeugschmiede: nie wieder Werkzeug kaufen!', ...Object.values(all(['erzmine', 'erzschmelze', 'schmiede'])) as [Quest['done'], Quest['progress']], 1200),
  step('Wehrhaft', 'Deine Rivalen rüsten auf: Die Schwertschmiede macht aus Eisen Schwerter. Baue eine Burg und bilde 3 Soldaten aus. Wachtürme schützen die Küste.',
    (g) => g.units.filter((u) => u.owner === HUMAN).length >= 3, (g) => `${Math.min(3, g.units.filter((u) => u.owner === HUMAN).length)}/3`, 1200),
  step('Kakao', 'Bürger werden zu Kaufleuten, wenn es Kakao gibt. Kakao wächst auf südlichen Inseln.', ...Object.values(all(['kakaoplantage'])) as [Quest['done'], Quest['progress']], 1000),
  step('Kirche und Badehaus', 'Kaufleute wollen Kirche (ab 150 Bürgern) und Badehaus (ab 210 Bürgern).', ...Object.values(all(['kirche', 'badehaus'], false)) as [Quest['done'], Quest['progress']], 1500),
  step('Kaufleute', 'Ziel: 6 Häuser der Kaufleute.', ...Object.values(tierGoal(3, 6)) as [Quest['done'], Quest['progress']], 2000),
  step('Kleidung und Schmuck', 'Aristokraten wollen Kleidung (Schneiderei) und Schmuck (Goldmine + Goldschmied).', ...Object.values(all(['schneiderei', 'goldschmied'])) as [Quest['done'], Quest['progress']], 2500),
  step('Hochschule und Theater', 'Kaufleute brauchen Hochschule und Theater, um Aristokraten zu werden.', ...Object.values(all(['hochschule', 'theater'], false)) as [Quest['done'], Quest['progress']], 2500),
  step('Aristokraten', 'Die höchste Stufe: 6 Häuser der Aristokraten.', ...Object.values(tierGoal(4, 6)) as [Quest['done'], Quest['progress']], 5000),
  step('Eigene Flotte', 'Baue eine Werft an der Küste und lass ein zweites Schiff vom Stapel laufen.', (g) => g.myShips().length >= 2, (g) => `${Math.min(2, g.myShips().length)}/2`, 1000),
  step('Kanonen an Bord', 'Kanonengießerei bauen, Kanonen ins Kontor bringen und ein Schiff am Kontor bewaffnen (Schiff antippen → „Bewaffnen“).',
    (g) => g.myShips().some((s) => (s.guns ?? 0) >= 6), (g) => (g.myShips().some((s) => (s.guns ?? 0) >= 6) ? '1/1' : '0/1'), 1500),
];

export function newSeed(): number {
  return Math.floor(rng(Date.now() % 100000)() * 1e9);
}
