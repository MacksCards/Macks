// Überblick (Paket U3): Meldungsverlauf und Nebenaufgaben – reine Spiellogik ohne Oberfläche.
//
//   logOf(g)            – die letzten 60 Meldungen dieses Spiels (älteste zuerst); die Oberfläche (ui/log.ts) zeigt sie
//   addLog(g, …)        – Meldung merken (ui.toast ruft das für jede Meldung auf, mit Spielzeit und Ort)
//   QUEST_INFO          – je Aufgabe: welche Gebäude sie braucht (für „gesperrt ab …“ und „Zeig mir“)
//   SIDE                – Nebenaufgaben, die neben der Hauptaufgabe laufen (Wehrhaft, Eigene Flotte, Kanonen an Bord)
//   sideList(g)         – Stand der Nebenaufgaben (frei, erledigt)
//   questLock(g, i)     – „ab 200 Siedlern“, solange die Gebäude einer Aufgabe noch nicht freigeschaltet sind
//
// Die Hauptaufgaben bleiben in game.ts (QUESTS, g.quest, checkQuest). Nebenaufgaben stehen dort weiter in der Liste,
// werden aber hier übersprungen und parallel geprüft: Sobald ihre Gebäude freigeschaltet sind, erscheinen sie als
// Nebenaufgabe (mit Meldung), erledigt gibt es die Belohnung wie bei den Hauptaufgaben (nach Schwierigkeit).
// Gespeichert wird unter ext.ueberblick (die letzten 30 Meldungen und die erledigten Nebenaufgaben).
// Alte Spielstände ohne diesen Eintrag: Nebenaufgaben, die in der alten Reihenfolge schon hinter g.quest lagen,
// gelten als erledigt (die Belohnung gab es damals schon).
import { BUILDINGS, TIERS, type BuildingId } from './data';
import { HUMAN, QUESTS, type Game, type MsgAt, type MsgKind } from './game';
import { stufe } from './schwierigkeit';
import type { GameSystem } from './systems';

// ---------- Meldungsverlauf ----------

export interface LogEntry {
  text: string;
  kind: MsgKind;
  /** Ort des Ereignisses in Spielfeldern, falls bekannt */
  at?: MsgAt;
  /** Spielzeit in Sekunden */
  time: number;
  read: boolean;
}

/** so viele Meldungen merkt sich der Verlauf */
export const LOG_MAX = 60;
/** so viele kommen in den Spielstand */
export const LOG_SAVE = 30;

/**
 * Wichtige Meldungen bleiben stehen, bis man sie antippt (N6): Krieg (Kriegserklärung und Vorwarnung „rüstet zum
 * Krieg“), Piraten, Eroberung, Brand, Pest, Bankrott und Verlust. Alltägliche Hinweise mit ⚠️ (Lager voll, Ware fehlt
 * oder reicht nur noch kurz, Bewohner ziehen weg, Kasse) blenden sich nach ein paar Sekunden aus – sie stehen
 * weiter im Meldungsverlauf hinter der Glocke 🔔.
 */
export function important(text: string, kind: MsgKind): boolean {
  if (kind !== 'bad') return false;
  // (S3) Brand und Pest brauchen schnelles Handeln: bleiben stehen wie Kriegsmeldungen
  return /^(🚨|🏳️|🚩|🏴‍☠️|⚔️ .* erklärt dir|🔥 Feuer auf|💀 Pest auf)/u.test(text) || /rüstet zum Krieg|Bankrott|verloren/.test(text);
}

// ---------- Aufgaben ----------

/** Was eine Aufgabe braucht: Gebäude (alle bzw. eines davon), eine Bewohnerstufe oder das Schiff */
export interface QuestInfo {
  build?: BuildingId[];
  /** true = eines der Gebäude genügt */
  any?: boolean;
  /** Ziel ist eine Bewohnerstufe (Index in TIERS) */
  tier?: number;
  /** Aufgabe am Schiff: welcher Knopf im Schiffsfenster gemeint ist */
  ship?: 'kontor' | 'ausladen' | 'bewaffnen';
}

/** je Aufgabe (nach Titel in QUESTS) */
export const QUEST_INFO: Readonly<Record<string, QuestInfo>> = {
  'Neues Land': { ship: 'kontor' },
  'Ladung löschen': { ship: 'ausladen' },
  'Holz für den Aufbau': { build: ['holzfaeller'] },
  'Nahrung': { build: ['fischer', 'jagdhuette'], any: true },
  'Ein Platz zum Leben': { build: ['markt'] },
  'Erste Siedlung': { build: ['haus'] },
  'Stoffe': { build: ['schaffarm', 'weberei'] },
  'Glaube': { build: ['kapelle'] },
  'Siedler': { tier: 1 },
  'Steine': { build: ['steinbruch'] },
  'Alkohol': { build: ['weingut', 'zuckerrohrplantage', 'brauerei'], any: true },
  'Tabak oder Gewürze': { build: ['tabakplantage', 'gewuerzplantage'], any: true },
  'Wirtshaus und Schule': { build: ['wirtshaus', 'schule'] },
  'Bürger': { tier: 2 },
  'Eisen und Werkzeug': { build: ['erzmine', 'erzschmelze', 'schmiede'] },
  'Wehrhaft': { build: ['burg'] },
  'Kakao': { build: ['kakaoplantage'] },
  'Kirche und Badehaus': { build: ['kirche', 'badehaus'] },
  'Kaufleute': { tier: 3 },
  'Kleidung und Schmuck': { build: ['schneiderei', 'goldschmied'] },
  'Hochschule und Theater': { build: ['hochschule', 'theater'] },
  'Aristokraten': { tier: 4 },
  'Eigene Flotte': { build: ['werft'] },
  'Kanonen an Bord': { build: ['kanonengiesserei'], ship: 'bewaffnen' },
};

/** Nebenaufgaben (Titel in QUESTS): laufen neben der Hauptaufgabe, sobald ihre Gebäude freigeschaltet sind */
export const SIDE: readonly string[] = ['Wehrhaft', 'Eigene Flotte', 'Kanonen an Bord'];

// erst beim ersten Gebrauch bestimmen (game.ts lädt diese Datei über systems.ts, bevor QUESTS feststeht)
let sideSet: Set<number> | null = null;
function sideIdxs(): Set<number> {
  if (!sideSet) { sideSet = new Set(); QUESTS.forEach((q, i) => { if (SIDE.includes(q.title)) sideSet!.add(i); }); }
  return sideSet;
}

/** ist QUESTS[i] eine Nebenaufgabe? */
export const isSide = (i: number) => sideIdxs().has(i);

/** Belohnung einer Aufgabe in diesem Spiel (nach Schwierigkeit) */
export const rewardOf = (g: Game, i: number) => Math.round((QUESTS[i]?.reward ?? 0) * stufe(g.opts.schwierigkeit).belohnung);

/** freigeschaltet? Gebäude ohne Freischaltung (Kontor, Wege …) gelten immer als frei */
const free = (g: Game, id: BuildingId) => !BUILDINGS[id]?.unlock || g.isUnlocked(id);

/** „ab 200 Siedlern“ – solange die Gebäude der Aufgabe noch nicht freigeschaltet sind; sonst null */
export function questLock(g: Game, i: number): string | null {
  const q = QUESTS[i];
  const info = q ? QUEST_INFO[q.title] : undefined;
  if (!info?.build?.length) return null;
  const ids = info.build;
  // eines genügt: gesperrt, solange keines frei ist – dann zählt das, das am frühesten kommt
  // alle nötig: gesperrt, solange eines fehlt – dann zählt das, das am spätesten kommt
  const locked = ids.filter((id) => !free(g, id));
  if (info.any ? locked.length < ids.length : locked.length === 0) return null;
  const key = (id: BuildingId) => { const u = BUILDINGS[id].unlock!; return u.tier * 100000 + u.n; };
  locked.sort((a, b) => key(a) - key(b));
  const u = BUILDINGS[info.any ? locked[0] : locked[locked.length - 1]].unlock!;
  return `ab ${u.n} ${TIERS[u.tier].dat}`;
}

/** Stand einer Nebenaufgabe */
export interface SideQuest {
  /** Index in QUESTS */
  i: number;
  title: string;
  /** Gebäude freigeschaltet: die Aufgabe läuft */
  open: boolean;
  done: boolean;
}

// ---------- Zustand ----------

interface State {
  log: LogEntry[];
  /** erledigte Nebenaufgaben (Titel) */
  done: Set<string>;
  /** schon angekündigte Nebenaufgaben (Titel) */
  told: Set<string>;
  t: number;
}

const states = new WeakMap<Game, State>();

function st(g: Game): State {
  let s = states.get(g);
  if (!s) {
    s = { log: [], done: new Set(), told: new Set(), t: 1 };
    // neues Spiel oder Spiel ohne Ladevorgang (Tests): Nebenaufgaben hinter der laufenden Aufgabe gelten als erledigt
    for (const i of sideIdxs()) if (i < g.quest) s.done.add(QUESTS[i].title);
    states.set(g, s);
  }
  return s;
}

/** die letzten Meldungen (älteste zuerst) */
export function logOf(g: Game): LogEntry[] { return st(g).log; }

/** Meldung merken; gibt den neuen Eintrag zurück */
export function addLog(g: Game, text: string, kind: MsgKind = 'info', at?: MsgAt): LogEntry {
  const log = st(g).log;
  const e: LogEntry = { text, kind, time: g.time, read: false };
  if (at && Number.isFinite(at.x) && Number.isFinite(at.y)) e.at = { x: at.x, y: at.y };
  log.push(e);
  if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
  return e;
}

/** Nebenaufgaben mit Stand */
export function sideList(g: Game): SideQuest[] {
  const s = st(g);
  const r: SideQuest[] = [];
  for (const i of sideIdxs()) {
    const q = QUESTS[i];
    r.push({ i, title: q.title, open: questLock(g, i) === null, done: s.done.has(q.title) });
  }
  return r;
}

/** die Nebenaufgabe, die gerade angezeigt wird (erste freie, noch nicht erledigte) */
export function currentSide(g: Game): SideQuest | null {
  return sideList(g).find((q) => q.open && !q.done) ?? null;
}

// ---------- Ablauf ----------

/** Hauptkette: Nebenaufgaben überspringen (sie laufen parallel) */
function skipSide(g: Game) {
  while (isSide(g.quest) && g.quest < QUESTS.length) g.quest++;
}

function tick(g: Game, dt: number) {
  skipSide(g);
  const s = st(g);
  s.t += dt;
  if (s.t < 1) return;
  s.t = 0;
  for (const q of sideList(g)) {
    if (q.done || !q.open) continue;
    const def = QUESTS[q.i];
    if (!s.told.has(q.title)) {
      s.told.add(q.title);
      // schon erfüllt (z. B. Schiffe gekauft): gleich als erledigt melden, ohne Ankündigung
      if (!def.done(g)) g.ev.message(`📜 Neue Nebenaufgabe: ${def.title} – ${def.hint}`, 'info');
    }
    if (!def.done(g)) continue;
    s.done.add(q.title);
    const reward = rewardOf(g, q.i);
    const p = g.players[HUMAN];
    if (p) p.money += reward;
    g.ev.message(`Aufgabe erledigt: ${def.title} (Nebenaufgabe, +${reward} Taler)`, 'good');
  }
}

interface Saved {
  v: 1;
  log: LogEntry[];
  done: string[];
  told: string[];
}

function save(g: Game): Saved {
  const s = st(g);
  return { v: 1, log: s.log.slice(-LOG_SAVE), done: [...s.done], told: [...s.told] };
}

function load(g: Game, data: unknown) {
  states.delete(g);
  const s = st(g);
  const d = data as Partial<Saved> | undefined;
  if (d && typeof d === 'object' && d.v === 1) {
    s.done.clear();
    for (const t of Array.isArray(d.done) ? d.done : []) if (typeof t === 'string' && SIDE.includes(t)) s.done.add(t);
    for (const t of Array.isArray(d.told) ? d.told : []) if (typeof t === 'string') s.told.add(t);
    for (const e of Array.isArray(d.log) ? d.log : []) {
      if (!e || typeof e.text !== 'string') continue;
      const kind: MsgKind = e.kind === 'good' || e.kind === 'bad' ? e.kind : 'info';
      const at = e.at && Number.isFinite(e.at.x) && Number.isFinite(e.at.y) ? { x: e.at.x, y: e.at.y } : undefined;
      s.log.push({ text: e.text, kind, at, time: Number.isFinite(e.time) ? Math.min(e.time, g.time) : g.time, read: !!e.read });
    }
  }
  // alter Stand oder Stand mitten in einer Nebenaufgabe: weiter in der Hauptkette
  skipSide(g);
}

/** Eintrag in der Liste der Spielteile (src/systems.ts) */
export const system: GameSystem = {
  id: 'ueberblick',
  tick,
  save,
  load,
};
