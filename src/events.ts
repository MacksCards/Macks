// Ereignisse wie im Vorbild (Paket S3): Feuer, Pest, Kriminalität, Dürre, Schätze und der Fluch der Ureinwohner.
//
// Feuer:   je Spieler ab 20 Einwohnern alle 8–15 Minuten ein Haus (häufiger ohne Feuerwehr, bei Unzufriedenen
//          und dichter Bebauung). Der Brand senkt die Trefferpunkte – dadurch erscheinen die Flammen der
//          Darstellung von selbst. Alle 20 s springt er mit 30 % auf Häuser im Abstand ≤ 2 (Steinhäuser und
//          Pflaster dazwischen bremsen). Eine Feuerwehr in Reichweite mit Weganschluss löscht in 10–15 s,
//          sonst ist das Haus nach 60 s abgebrannt (ohne Rückerstattung). ignite() für Kanonentreffer.
// Pest:    Häuser ab Siedlern in dichter Lage (mehr als 15 Häuser im Umkreis 5) mit ≈ 5 % je 10 Minuten;
//          alle 15 s stirbt ein Bewohner, Ansteckung im Abstand 3; ein Arzt in Reichweite heilt in ≈ 20 s;
//          Kirche und Badehaus halbieren das Risiko (je eins).
// Diebe:   Häuser ab Bürgern ohne Galgen in Reichweite und mit Zufriedenheit unter 50 % – selten Diebstahl
//          (50–150 Taler oder 1–3 t aus einer Karrenladung).
// Dürre:   alle 30–50 Minuten für 3–4 Minuten auf einer besiedelten Insel: Felder und Weiden wachsen nicht
//          (Getreide, Plantagen, Schafe und Schweine stehen still); Fischer, Jäger und Holzfäller arbeiten weiter.
// Schatz:  1 % je neuem Gebäude (nicht Wege, Mauern, Kontor): +1 000 Taler – erst nach 45 Spielsekunden, also
//          nach dem Zeitfenster fürs Rückgängigmachen (sonst ließe sich bauen und zurücknehmen, bis einer kommt).
// Fluch:   curse() macht Feuer, Pest und Dürre für einen Spieler 20 Minuten lang dreimal so häufig (für S4).
// Häufigkeit: opts.ereignisse aus / mild (Standard, halb so oft) / normal. Brände aus dem Kampf gibt es immer.
// Alles ist im Spielstand (ext.events); alte Spielstände ohne diesen Teil starten mit Standardwerten.
import { BUILDINGS, type BuildingId } from './data';
import type { Building, Game, MsgAt } from './game';
import type { GameSystem } from './systems';

// Nur Typen aus game.ts und combat.ts: beide laden diese Datei selbst (Ring beim Laden vermeiden).
/** der menschliche Spieler (wie HUMAN in game.ts) */
const HUMAN = 0;
/** Holzbau? (wie wooden in combat.ts: Pionier- und Siedlerhäuser und alles ohne Steine) */
const wooden = (b: Building) => (b.type === 'haus' ? b.tier < 2 : !(BUILDINGS[b.type].cost.stein ?? 0));

// ---------- Zahlen (für Tests und spätere Feinarbeit an einer Stelle) ----------

export const FIRE = {
  /** ab so vielen Einwohnern (je Spieler) kann es brennen */
  minPop: 20,
  /** Abstand zwischen zwei Bränden (Spielsekunden) bei „normal“ und mittlerem Risiko */
  every: [480, 900] as const,
  /** erster Brand frühestens nach so vielen Sekunden mit genug Einwohnern */
  first: 600,
  /** Trefferpunkte beim Ausbruch (Anteil) – unter 75 % zeigt die Darstellung Flammen */
  startHp: 0.7,
  /** so lange brennt ein Haus ohne Feuerwehr, bis es abgebrannt ist (Sekunden) */
  burn: 60,
  /** Löschzeit der Feuerwehr (Sekunden, zufällig dazwischen) */
  ext: [10, 15] as const,
  /** alle so viele Sekunden springt das Feuer … */
  spreadEvery: 20,
  /** … mit dieser Wahrscheinlichkeit je Nachbarhaus … */
  spreadChance: 0.3,
  /** … auf Häuser bis zu diesem Abstand (Feldmitten) */
  spreadDist: 2,
  /** solange der Spieler noch keine Feuerwehr bauen kann, helfen die Nachbarn mit Eimern: weniger Funkenflug … */
  spreadNoBrigade: 1 / 3,
  /** … und sie löschen den Brand nach so vielen Sekunden selbst (das Haus bleibt beschädigt stehen) */
  buckets: 35,
  /** Steinhaus bzw. Pflasterweg dazwischen: so viel seltener */
  stone: 0.5,
  paved: 0.5,
  /** nach dem Löschen bessern die Bewohner aus (Anteil der Trefferpunkte je Sekunde) */
  repair: 0.02,
} as const;

export const PLAGUE = {
  /** ab dieser Stufe (1 = Siedler) */
  minTier: 1,
  /** dicht: mehr als so viele Häuser … */
  dense: 15,
  /** … im Umkreis von so vielen Feldern */
  denseR: 5,
  /** Ansteckungsgefahr je Haus und 10 Minuten bei „normal“ */
  chance: 0.05,
  /** so oft wird geprüft (Sekunden) */
  check: 60,
  /** alle so viele Sekunden stirbt ein Bewohner */
  death: 15,
  /** Ansteckung im Abstand bis … */
  spreadDist: 3,
  /** … mit dieser Wahrscheinlichkeit je Nachbarhaus und Todesfall */
  spreadChance: 0.12,
  /** so lange braucht der Arzt (Sekunden) */
  heal: 20,
  /** ohne Arzt klingt die Pest nach so vielen Sekunden ab */
  maxT: 75,
  /** Kirche bzw. Badehaus in der Nähe: Risiko mal diesen Wert (je eins) */
  holy: 0.5,
} as const;

export const CRIME = {
  /** ab dieser Stufe (2 = Bürger, mit ihnen kommt der Galgen) */
  minTier: 2,
  /** Zufriedenheit unter diesem Wert */
  happy: 0.5,
  /** so oft wird geprüft (Sekunden) */
  check: 60,
  /** Diebstahl-Wahrscheinlichkeit je Prüfung und unzufriedenem Haus bei „normal“ … */
  per: 0.01,
  /** … höchstens */
  cap: 0.25,
  taler: [50, 150] as const,
  tons: [1, 3] as const,
} as const;

export const DROUGHT = {
  /** Abstand zwischen zwei Dürren (Spielsekunden) bei „normal“ */
  every: [1800, 3000] as const,
  /** Dauer (Sekunden) */
  len: [180, 240] as const,
} as const;

export const TREASURE = {
  chance: 0.01,
  taler: 1000,
  /** erst nach so vielen Spielsekunden (bei vierfachem Tempo länger als die 10 s fürs Rückgängigmachen) */
  delay: 45,
} as const;

/** Fluch: so viel häufiger, so lange (Sekunden, Vorbild-nah 20 Minuten) */
export const CURSE = { factor: 3, seconds: 1200 } as const;

/** Häufigkeit je Einstellung */
export const RATE: Record<'aus' | 'mild' | 'normal', number> = { aus: 0, mild: 0.5, normal: 1 };
/** Funkenflug je Einstellung (Anteil von FIRE.spreadChance). „mild“ (Standard): ein Brand springt im Mittel auf
 *  weniger als ein halbes Nachbarhaus über – vorher fraß er sich durch dichte Pionier-Blöcke (je Brand 3–5 Häuser).
 *  „aus“ gilt für Brände aus dem Kampf. */
export const SPREAD: Record<'aus' | 'mild' | 'normal', number> = { aus: 0.15, mild: 0.15, normal: 1 };

/** brennen nie ab (Lager der Insel) */
const NO_FIRE = new Set<BuildingId>(['kontor', 'markt']);
/** kein Schatz beim Bau von Wegen, Mauern, Toren und dem Kontor */
const NO_TREASURE = new Set<BuildingId>(['kontor', 'palisade', 'steinmauer', 'holztor', 'steintor_klein', 'steintor']);

// ---------- Zustand ----------

interface Fire {
  /** Trefferpunkte, die der Brand zuletzt gesetzt hat (Ausbessern von außen zählt während des Brands nicht) */
  hp: number;
  /** so lange brennt es schon (Sekunden) */
  t: number;
  /** Löschen: Fortschritt, benötigte Zeit, Trefferpunkte beim Beginn des Löschens */
  ext: number;
  need: number;
  hpE?: number;
  /** Zeit bis zum nächsten Funkenflug */
  spread: number;
}

interface Sick {
  t: number;
  /** Zeit bis zum nächsten Todesfall */
  death: number;
  /** Heilfortschritt beim Arzt */
  heal: number;
}

interface State {
  fires: Map<number, Fire>;
  /** nach dem Brand: wird ausgebessert (Gebäude-ids) */
  repair: Set<number>;
  sick: Map<number, Sick>;
  /** Dürre je Insel: bis zu dieser Spielzeit */
  drought: Map<number, number>;
  /** Fluch je Spieler: bis zu dieser Spielzeit */
  curse: Map<number, number>;
  /** Zeit bis zum nächsten Brand je Spieler */
  fireT: Map<number, number>;
  droughtT: number;
  plagueT: number;
  crimeT: number;
  /** gefundene Schätze, ausgezahlt zur Spielzeit at */
  treasure: { id: number; at: number }[];
  /** so oft ist es in diesem Spiel schon passiert (für Tests und die Statistik) */
  count: Counts;
  // --- nicht gespeichert ---
  slowT: number;
  /** letzte Meldung je Schlüssel (Spielzeit) */
  msgT: Map<string, number>;
  /** Landfelder je Insel (für die Dürre) */
  land: Map<number, Int32Array>;
  /** Schutzgebäude je Besitzer (neu bei jeder Änderung an Gebäuden oder Wegen) */
  prot: { ver: number; by: Map<number, Protectors>; dense: Map<number, number> };
}

/** Zähler je Ereignis: Ausbrüche (nicht übergesprungene Brände), Abgebranntes, Diebstähle, Dürren, Schätze */
export interface Counts { feuer: number; abgebrannt: number; geloescht: number; pest: number; diebe: number; duerre: number; schatz: number }
const noCounts = (): Counts => ({ feuer: 0, abgebrannt: 0, geloescht: 0, pest: 0, diebe: 0, duerre: 0, schatz: 0 });

interface Protectors { feuerwehr: [number, number][]; arzt: [number, number][]; galgen: [number, number][] }

const states = new WeakMap<Game, State>();

function fresh(): State {
  return {
    fires: new Map(), repair: new Set(), sick: new Map(), drought: new Map(), curse: new Map(), fireT: new Map(),
    droughtT: DROUGHT.every[0] * 1.5, plagueT: PLAGUE.check, crimeT: CRIME.check, treasure: [], count: noCounts(),
    slowT: 0, msgT: new Map(), land: new Map(), prot: { ver: -1, by: new Map(), dense: new Map() },
  };
}

function st(g: Game): State {
  let s = states.get(g);
  if (!s) { s = fresh(); states.set(g, s); }
  return s;
}

const between = (g: Game, r: readonly [number, number]) => r[0] + g.rng() * (r[1] - r[0]);
const rate = (g: Game) => RATE[g.opts.ereignisse] ?? RATE.mild;
const spread = (g: Game) => SPREAD[g.opts.ereignisse] ?? SPREAD.mild;
/** Fluch-Faktor eines Spielers (1 = kein Fluch) */
const curseF = (g: Game, owner: number) => ((st(g).curse.get(owner) ?? -1) > g.time ? CURSE.factor : 1);
/** zählt dieser Spieler für Ereignisse? (nicht Piraten, Händler, Ureinwohner, Besiegte) */
const normal = (g: Game, owner: number) => { const p = g.players[owner]; return !!p && !p.pirate && !p.trader && !p.natives && !p.defeated; };
const atB = (g: Game, b: Building): MsgAt => { const [x, y] = g.center(b); return { x, y }; };
const isleName = (g: Game, id: number) => g.islands[id]?.name ?? 'der Insel';

/** Meldung an den Spieler, höchstens alle gap Sekunden je Schlüssel */
function say(g: Game, key: string, gap: number, text: string, kind: 'info' | 'good' | 'bad', at?: MsgAt) {
  const s = st(g);
  if (g.time - (s.msgT.get(key) ?? -1e9) < gap) return;
  s.msgT.set(key, g.time);
  g.ev.message(text, kind, at);
}

// ---------- Schutz durch Feuerwehr, Arzt, Galgen ----------

function protectors(g: Game): State['prot'] {
  const s = st(g);
  if (s.prot.ver === g.buildVersion) return s.prot;
  const by = new Map<number, Protectors>();
  for (const b of g.buildings) {
    if (b.type !== 'feuerwehr' && b.type !== 'arzt' && b.type !== 'galgen') continue;
    // die Feuerwehr braucht einen Weg, damit der Löschwagen hinkommt
    if (b.type === 'feuerwehr' && !g.linked.has(b.id)) continue;
    let p = by.get(b.owner);
    if (!p) by.set(b.owner, (p = { feuerwehr: [], arzt: [], galgen: [] }));
    p[b.type].push(g.center(b));
  }
  s.prot = { ver: g.buildVersion, by, dense: new Map() };
  return s.prot;
}

/** steht ein Schutzgebäude dieser Art (des Besitzers) in Reichweite? */
export function covered(g: Game, b: Building, type: 'feuerwehr' | 'arzt' | 'galgen'): boolean {
  const l = protectors(g).by.get(b.owner)?.[type];
  if (!l?.length) return false;
  const [x, y] = g.center(b), r = BUILDINGS[type].radius ?? 15;
  return l.some(([px, py]) => (px - x) ** 2 + (py - y) ** 2 <= r * r);
}

/**
 * Häuser (aller Besitzer) nahe an einem Gebäude, ohne es selbst.
 * gap = false: Mitte des Hauses höchstens r Felder von der Mitte des Gebäudes (Umkreis);
 * gap = true: höchstens r Felder Lücke zwischen den Grundflächen (0 = Wand an Wand, 1 = ein Weg dazwischen …).
 */
function housesAround(g: Game, b: Building, r: number, gap = false): Building[] {
  const [cx, cy] = g.center(b);
  const half = BUILDINGS[b.type].size / 2;
  const out: Building[] = [];
  const R = Math.ceil(r + half + 2);
  for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
    if (!g.inMap(x, y)) continue;
    const id = g.occ[g.idx(x, y)];
    if (!id || id === b.id) continue;
    const o = g.byId.get(id);
    // jedes Haus nur einmal (an seiner Ecke oben links)
    if (!o || o.type !== 'haus' || o.x !== x || o.y !== y) continue;
    const [ox, oy] = g.center(o);
    const oh = BUILDINGS.haus.size / 2;
    const d = gap
      ? Math.hypot(Math.max(0, Math.abs(ox - cx) - half - oh), Math.max(0, Math.abs(oy - cy) - half - oh))
      : Math.hypot(ox - cx, oy - cy);
    if (d <= r) out.push(o);
  }
  return out;
}

/** Zahl der Häuser im Umkreis 5 um die Grundfläche (für Pest und Feuer; zwischengespeichert bis zur nächsten Änderung) */
export function density(g: Game, h: Building): number {
  const p = protectors(g);
  let n = p.dense.get(h.id);
  if (n === undefined) { n = housesAround(g, h, PLAGUE.denseR, true).length; p.dense.set(h.id, n); }
  return n;
}

/** Brandgefahr eines Hauses (1 = geschützt, zufrieden, locker gebaut) */
function fireWeight(g: Game, h: Building): number {
  return (covered(g, h, 'feuerwehr') ? 1 : 2) * (h.happy < 0.5 ? 1.5 : 1) * (density(g, h) > PLAGUE.dense ? 1.3 : 1);
}

/** Kirche und Badehaus in der Nähe halbieren die Pestgefahr (je eins) */
function holy(g: Game, h: Building): number {
  const c = g.coverage.get(h.id);
  return (c?.has('kirche') ? PLAGUE.holy : 1) * (c?.has('badehaus') ? PLAGUE.holy : 1);
}

// ---------- Feuer ----------

/**
 * Gebäude in Brand setzen (z. B. nach einem Kanonentreffer). true = es brennt jetzt.
 * Kontor und Marktplatz brennen nicht (das Lager der Insel).
 */
export function ignite(g: Game, b: Building): boolean {
  if (!g.byId.has(b.id) || NO_FIRE.has(b.type)) return false;
  const s = st(g);
  if (s.fires.has(b.id)) return true;
  const max = g.maxHp(b);
  const hp = Math.min(b.hp ?? max, max * FIRE.startHp);
  if (hp <= 0) return false;
  b.hp = hp;
  s.repair.delete(b.id);
  s.fires.set(b.id, { hp, t: 0, ext: 0, need: between(g, FIRE.ext), spread: FIRE.spreadEvery });
  if (b.owner === HUMAN) {
    const fw = covered(g, b, 'feuerwehr');
    const hint = fw ? 'die Feuerwehr rückt aus.'
      : reachedBrigade(g, b.owner) ? 'keine Feuerwehr in der Nähe – ohne sie brennt es in einer Minute ab!'
        : 'die Nachbarn löschen mit Eimern. Eine Feuerwehr gibt es ab 15 Siedlern.';
    say(g, `feuer:${b.island}`, 25, `🔥 Feuer auf ${isleName(g, b.island)}! ${b.type === 'haus' ? 'Ein Haus' : BUILDINGS[b.type].name} brennt – ${hint}`, 'bad', atB(g, b));
  }
  return true;
}

/**
 * Stärke der Flammen für die Darstellung (0 = kein Brand): ein frischer Brand ist schon deutlich zu sehen
 * und wird stärker, je weiter er sich frisst; beim Löschen werden die Flammen kleiner.
 */
export function fireStrength(g: Game, b: Building): number {
  const f = st(g).fires.get(b.id);
  if (!f) return 0;
  const max = g.maxHp(b);
  const eaten = 1 - Math.max(0, Math.min(1, f.hp / (max * FIRE.startHp)));
  const s = 0.55 + 0.45 * eaten;
  return f.ext > 0 ? Math.max(0.12, s * (1 - f.ext / f.need)) : s;
}

/** Brennt das Gebäude gerade? */
export function burning(g: Game, b: Building): boolean { return st(g).fires.has(b.id); }

/** Brennt (art 'feuer') bzw. hat die Pest (art 'pest') noch ein Gebäude des Spielers auf der Insel?
 *  Für die Meldungen: eine stehende Brand- oder Pestmeldung verschwindet, wenn alles vorbei ist. */
export function crisisOn(g: Game, owner: number, island: number, art: 'feuer' | 'pest'): boolean {
  const s = st(g);
  for (const id of (art === 'feuer' ? s.fires.keys() : s.sick.keys())) {
    const b = g.byId.get(id);
    if (b && b.owner === owner && b.island === island) return true;
  }
  return false;
}

function burnDown(g: Game, b: Building) {
  const s = st(g);
  s.fires.delete(b.id);
  s.sick.delete(b.id);
  s.count.abgebrannt++;
  b.hp = 0;
  if (b.owner === HUMAN) say(g, `asche:${b.island}`, 6, `🔥 ${b.type === 'haus' ? 'Ein Haus' : BUILDINGS[b.type].name} auf ${isleName(g, b.island)} ist abgebrannt.`, 'bad', atB(g, b));
  g.forceRemove(b);
}

function tickFires(g: Game, dt: number) {
  const s = st(g);
  for (const [id, f] of [...s.fires]) {
    const b = g.byId.get(id);
    if (!b) { s.fires.delete(id); continue; }
    const max = g.maxHp(b);
    // Kampfschaden zählt, Ausbessern während des Brands nicht
    let hp = Math.min(b.hp ?? max, f.hp);
    f.t += dt;
    if (covered(g, b, 'feuerwehr')) {
      // die Feuerwehr löscht: die Flammen werden kleiner, nach 10–15 s ist es aus
      f.hpE ??= hp;
      f.ext += dt;
      hp = Math.min(max, f.hpE + (Math.max(f.hpE, max * 0.76) - f.hpE) * Math.min(1, f.ext / f.need));
      if (f.ext >= f.need) {
        b.hp = Math.max(hp, max * 0.76);
        s.fires.delete(id);
        s.repair.add(id);
        s.count.geloescht++;
        if (b.owner === HUMAN) say(g, `geloescht:${b.island}`, 15, `🚒 Die Feuerwehr hat den Brand auf ${isleName(g, b.island)} gelöscht.`, 'good', atB(g, b));
        continue;
      }
    } else {
      f.ext = 0; f.hpE = undefined;
      hp -= (max * FIRE.startHp / FIRE.burn) * dt;
      // noch keine Feuerwehr baubar: die Nachbarn löschen mit Eimern (das Haus bleibt beschädigt stehen)
      if (f.t >= FIRE.buckets && normal(g, b.owner) && !reachedBrigade(g, b.owner) && hp > 0) {
        b.hp = hp;
        s.fires.delete(id);
        s.repair.add(id);
        s.count.geloescht++;
        if (b.owner === HUMAN) say(g, `eimer:${b.island}`, 15, `🪣 Die Nachbarn haben den Brand auf ${isleName(g, b.island)} mit Eimern gelöscht. Später schützt eine Feuerwehr.`, 'good', atB(g, b));
        continue;
      }
    }
    if (hp <= 0) { burnDown(g, b); continue; }
    f.hp = hp; b.hp = hp;
    // Funkenflug auf Nachbarhäuser
    f.spread -= dt;
    if (f.spread <= 0) {
      f.spread += FIRE.spreadEvery;
      spreadFire(g, b);
    }
  }
  // nach dem Brand bessern die Bewohner aus (bis voll; dann gilt das Gebäude wieder als unbeschädigt)
  for (const id of [...s.repair]) {
    const b = g.byId.get(id);
    if (!b || b.hp === undefined) { s.repair.delete(id); continue; }
    const max = g.maxHp(b);
    b.hp = Math.min(max, b.hp + max * FIRE.repair * dt);
    if (b.hp >= max) { delete b.hp; s.repair.delete(id); }
  }
}

function spreadFire(g: Game, b: Building) {
  const s = st(g);
  const [cx, cy] = g.center(b);
  const early = normal(g, b.owner) && !reachedBrigade(g, b.owner);
  for (const o of housesAround(g, b, FIRE.spreadDist, true)) {
    if (s.fires.has(o.id)) continue;
    let p = FIRE.spreadChance * spread(g) * (wooden(o) ? 1 : FIRE.stone) * (early ? FIRE.spreadNoBrigade : 1);
    // Pflasterweg zwischen den Häusern bremst den Funkenflug
    if (pavedBetween(g, cx, cy, ...g.center(o))) p *= FIRE.paved;
    if (g.rng() < p) {
      ignite(g, o);
      if (o.owner === HUMAN) say(g, `sprung:${o.island}`, 20, `🔥 Feuer auf ${isleName(g, o.island)}: Das Feuer greift auf Nachbarhäuser über!`, 'bad', atB(g, o));
    }
  }
}

/** liegt auf der Linie zwischen zwei Mitten ein Pflasterweg? */
function pavedBetween(g: Game, ax: number, ay: number, bx: number, by: number): boolean {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
  for (let i = 1; i < n; i++) {
    const x = Math.floor(ax + ((bx - ax) * i) / n), y = Math.floor(ay + ((by - ay) * i) / n);
    if (g.inMap(x, y) && g.roads[g.idx(x, y)] === 2) return true;
  }
  return false;
}

/** kann der Spieler schon eine Feuerwehr bauen? (vorher helfen die Nachbarn mit Eimern) */
function reachedBrigade(g: Game, owner: number): boolean {
  const u = BUILDINGS.feuerwehr.unlock;
  return !u || g.reached(u, owner);
}

/** Brandausbruch je Spieler (einmal je Sekunde) */
function fireOutbreak(g: Game, dt: number, houses: Map<number, Building[]>) {
  const s = st(g);
  const r = rate(g);
  if (r <= 0) return;
  for (const [owner, list] of houses) {
    let pop = 0;
    for (const h of list) pop += h.residents;
    if (pop < FIRE.minPop) continue;
    // „mild“: kein Brandausbruch, bevor man sich mit einer Feuerwehr schützen kann
    if (r < RATE.normal && !reachedBrigade(g, owner)) continue;
    // mittleres Brandrisiko der Stadt: ungeschützt, unzufrieden und dicht gebaut brennt es öfter
    const w = list.map((h) => (s.fires.has(h.id) ? 0 : fireWeight(g, h)));
    const mean = w.reduce((a, c) => a + c, 0) / list.length;
    let t = s.fireT.get(owner) ?? FIRE.first;
    t -= dt * r * curseF(g, owner) * (mean / 2);
    if (t <= 0) {
      t = between(g, FIRE.every);
      const sum = w.reduce((a, c) => a + c, 0);
      let pick = g.rng() * sum;
      for (let i = 0; i < list.length; i++) { pick -= w[i]; if (pick <= 0 && w[i] > 0) { if (ignite(g, list[i])) s.count.feuer++; break; } }
    }
    s.fireT.set(owner, t);
  }
}

// ---------- Pest ----------

/** Hat das Haus die Pest? */
export function sick(g: Game, b: Building): boolean { return st(g).sick.has(b.id); }

/** Haus erkrankt (true = jetzt krank). Für Tests und den Fluch nutzbar. */
export function infect(g: Game, h: Building): boolean {
  const s = st(g);
  if (h.type !== 'haus' || !g.byId.has(h.id)) return false;
  if (s.sick.has(h.id)) return true;
  s.sick.set(h.id, { t: 0, death: PLAGUE.death, heal: 0 });
  return true;
}

function plagueOutbreak(g: Game, houses: Map<number, Building[]>) {
  const s = st(g);
  const r = rate(g);
  if (r <= 0) return;
  for (const [owner, list] of houses) {
    const cf = curseF(g, owner);
    for (const h of list) {
      if (h.tier < PLAGUE.minTier || s.sick.has(h.id) || density(g, h) <= PLAGUE.dense) continue;
      const p = PLAGUE.chance * (PLAGUE.check / 600) * r * cf * holy(g, h);
      if (g.rng() >= p) continue;
      infect(g, h);
      s.count.pest++;
      if (owner === HUMAN) {
        const doc = covered(g, h, 'arzt');
        const hint = doc ? 'Der Arzt kümmert sich um die Kranken.'
          : g.isUnlocked('arzt') ? 'Kein Arzt in der Nähe – baue einen, bevor sie sich ausbreitet!'
            : 'Einen Arzt gibt es ab 50 Bürgern. Kirche und Badehaus senken die Gefahr.';
        say(g, `pest:${h.island}`, 60, `💀 Pest auf ${isleName(g, h.island)}! ${hint}`, 'bad', atB(g, h));
      }
    }
  }
}

function tickSick(g: Game, dt: number) {
  const s = st(g);
  for (const [id, k] of [...s.sick]) {
    const h = g.byId.get(id);
    if (!h || h.type !== 'haus') { s.sick.delete(id); continue; }
    k.t += dt;
    const doc = covered(g, h, 'arzt');
    if (doc) {
      k.heal += dt;
      if (k.heal >= PLAGUE.heal) {
        s.sick.delete(id);
        if (h.owner === HUMAN) say(g, `geheilt:${h.island}`, 30, `⚕️ Der Arzt hat die Kranken auf ${isleName(g, h.island)} geheilt.`, 'good', atB(g, h));
        continue;
      }
    } else k.heal = 0;
    k.death -= dt;
    if (k.death <= 0) {
      k.death += PLAGUE.death;
      if (h.residents > 1) h.residents--;
      // Ansteckung der Nachbarn
      for (const o of housesAround(g, h, PLAGUE.spreadDist, true)) {
        if (o.tier < PLAGUE.minTier || s.sick.has(o.id)) continue;
        if (g.rng() < PLAGUE.spreadChance * holy(g, o)) infect(g, o);
      }
    }
    if (!doc && k.t >= PLAGUE.maxT) {
      s.sick.delete(id);
      if (h.owner === HUMAN) say(g, `pestvorbei:${h.island}`, 60, `💀 Die Pest auf ${isleName(g, h.island)} klingt ab.`, 'info', atB(g, h));
    }
  }
}

// ---------- Kriminalität ----------

function crime(g: Game, houses: Map<number, Building[]>) {
  const r = rate(g);
  if (r <= 0) return;
  for (const [owner, list] of houses) {
    const bad = list.filter((h) => h.tier >= CRIME.minTier && h.happy < CRIME.happy && !covered(g, h, 'galgen'));
    if (!bad.length) continue;
    const p = Math.min(CRIME.cap, CRIME.per * bad.length) * r;
    if (g.rng() >= p) continue;
    const where = bad[Math.floor(g.rng() * bad.length)];
    steal(g, owner, where);
  }
}

/** Diebstahl: Taler aus der Kasse oder Waren aus einer Karrenladung */
export function steal(g: Game, owner: number, where: Building): { taler: number; tons: number } {
  const pl = g.players[owner];
  const carts = g.carts.filter((c) => c.g && c.n >= 1 && g.byId.get(c.home)?.owner === owner);
  const hint = g.isUnlocked('galgen') ? 'Ein Galgen in der Nähe schreckt Diebe ab.' : 'Zufriedene Bewohner stehlen nicht; einen Galgen gibt es ab 100 Bürgern.';
  if (carts.length && g.rng() < 0.5) {
    st(g).count.diebe++;
    const c = carts[Math.floor(g.rng() * carts.length)];
    const n = Math.min(c.n, Math.round(between(g, CRIME.tons)));
    c.n -= n;
    if (owner === HUMAN) say(g, `dieb:${owner}`, 30, `🦹 Diebe auf ${isleName(g, where.island)} haben ${n} t aus einem Marktkarren gestohlen. ${hint}`, 'bad', atB(g, where));
    return { taler: 0, tons: n };
  }
  const n = Math.max(0, Math.min(Math.round(between(g, CRIME.taler)), Math.floor(pl?.money ?? 0)));
  if (!pl || n <= 0) return { taler: 0, tons: 0 };
  pl.money -= n;
  st(g).count.diebe++;
  if (owner === HUMAN) say(g, `dieb:${owner}`, 30, `🦹 Diebe auf ${isleName(g, where.island)} haben ${n} Taler gestohlen. ${hint}`, 'bad', atB(g, where));
  return { taler: n, tons: 0 };
}

// ---------- Dürre ----------

/** Herrscht gerade Dürre auf der Insel? (für Ernten und die Bodenfarbe) */
export function droughtOn(g: Game, island: number): boolean {
  return (st(g).drought.get(island) ?? -1) > g.time;
}

/** Restdauer der Dürre auf der Insel in Sekunden (0 = keine) */
export function droughtLeft(g: Game, island: number): number {
  return Math.max(0, (st(g).drought.get(island) ?? 0) - g.time);
}

/** Dürre auf einer Insel beginnen lassen (seconds = Dauer) */
export function startDrought(g: Game, island: number, seconds = between(g, DROUGHT.len)) {
  const s = st(g);
  if (!g.islands[island]) return;
  if (!droughtOn(g, island)) s.count.duerre++;
  s.drought.set(island, Math.max(s.drought.get(island) ?? 0, g.time + seconds));
  if (g.buildings.some((b) => b.owner === HUMAN && b.island === island)) {
    say(g, `duerre:${island}`, 60, `☀️ Dürre auf ${isleName(g, island)}! Für etwa ${Math.round(seconds / 60)} Minuten wächst nichts auf Feldern und Weiden. Fischer, Jäger und Holzfäller arbeiten weiter.`, 'bad', centerOf(g, island));
  }
}

function centerOf(g: Game, island: number): MsgAt | undefined {
  const k = g.kontor(HUMAN, island) ?? g.buildings.find((b) => b.owner === HUMAN && b.island === island);
  return k ? atB(g, k) : undefined;
}

/** Landfelder einer Insel (einmal gesucht, dann gemerkt) */
function landOf(g: Game, island: number): Int32Array {
  const s = st(g);
  let l = s.land.get(island);
  if (l) return l;
  const il = g.islands[island];
  const out: number[] = [];
  if (il) for (let y = il.y0; y <= il.y1; y++) for (let x = il.x0; x <= il.x1; x++) {
    if (!g.inMap(x, y)) continue;
    const k = g.idx(x, y);
    if (g.islandOf[k] === island) out.push(k);
  }
  l = Int32Array.from(out);
  s.land.set(island, l);
  return l;
}

/** Ernte-Art eines Betriebs, die die Dürre trifft */
const dry = (type: BuildingId) => { const r = BUILDINGS[type].harvest?.res; return r === 'feld' || r === 'weide'; };

function tickDrought(g: Game, dt: number) {
  const s = st(g);
  for (const [isl, until] of [...s.drought]) {
    if (until <= g.time) {
      s.drought.delete(isl);
      if (g.buildings.some((b) => b.owner === HUMAN && b.island === isl)) say(g, `regen:${isl}`, 30, `🌧️ Regen auf ${isleName(g, isl)} – die Dürre ist vorbei. Felder und Weiden wachsen wieder.`, 'good', centerOf(g, isl));
      continue;
    }
    // Felder und Weiden bleiben leer (Wald, Wild und Fische sind nicht betroffen)
    for (const k of landOf(g, isl)) { g.feld[k] = 0; g.weide[k] = 0; }
  }
  const r = rate(g);
  if (r <= 0) return;
  const cursed = [...s.curse].some(([o, u]) => u > g.time && normal(g, o));
  s.droughtT -= dt * r * (cursed ? CURSE.factor : 1);
  if (s.droughtT > 0) return;
  s.droughtT = between(g, DROUGHT.every);
  // besiedelte Inseln mit Feldern oder Weiden; verfluchte Spieler trifft es dreimal so oft
  const weight = new Map<number, number>();
  for (const b of g.buildings) {
    if (!dry(b.type) || !normal(g, b.owner) || s.drought.has(b.island)) continue;
    weight.set(b.island, Math.max(weight.get(b.island) ?? 0, curseF(g, b.owner)));
  }
  if (!weight.size) return;
  const sum = [...weight.values()].reduce((a, c) => a + c, 0);
  let pick = g.rng() * sum;
  for (const [isl, w] of weight) { pick -= w; if (pick <= 0) { startDrought(g, isl); break; } }
}

// ---------- Fluch ----------

/**
 * Fluch der Ureinwohner über einen Spieler: für eine Weile häufiger Feuer, Pest und Dürre (mal 3).
 * seconds = Dauer in Spielsekunden (Vorbild-nah: 20 Minuten).
 */
export function curse(g: Game, owner: number, seconds: number = CURSE.seconds): void {
  const s = st(g);
  s.curse.set(owner, Math.max(s.curse.get(owner) ?? 0, g.time + seconds));
}

/** Liegt gerade ein Fluch auf dem Spieler? */
export function cursed(g: Game, owner: number): boolean { return curseF(g, owner) > 1; }

// ---------- Schatz ----------

function afterPlace(g: Game, b: Building) {
  if (NO_TREASURE.has(b.type) || !normal(g, b.owner)) return;
  if (g.rng() >= TREASURE.chance) return;
  st(g).treasure.push({ id: b.id, at: g.time + TREASURE.delay });
}

function tickTreasure(g: Game) {
  const s = st(g);
  if (!s.treasure.length) return;
  s.treasure = s.treasure.filter((t) => {
    if (t.at > g.time) return true;
    const b = g.byId.get(t.id);
    // zurückgenommen oder abgerissen: kein Schatz
    if (!b || !normal(g, b.owner)) return false;
    g.players[b.owner].money += TREASURE.taler;
    s.count.schatz++;
    if (b.owner === HUMAN) g.ev.message(`💰 Schatz gefunden! Beim Bau von ${b.type === 'haus' ? 'einem Wohnhaus' : BUILDINGS[b.type].name} kamen ${TREASURE.taler.toLocaleString('de-DE')} Taler zum Vorschein.`, 'good', atB(g, b));
    return false;
  });
}

/** Wie oft welches Ereignis in diesem Spiel schon vorkam */
export function counts(g: Game): Readonly<Counts> { return st(g).count; }

// ---------- Anzeige ----------

/** Symbol über dem Gebäude für ein laufendes Ereignis (🔥 Feuer, 💀 Pest, ☀️ Dürre); '' = keins */
export function iconFor(g: Game, b: Building): string {
  const s = st(g);
  if (s.fires.has(b.id)) return '🔥';
  if (s.sick.has(b.id)) return '💀';
  if (s.drought.size && dry(b.type) && droughtOn(g, b.island)) return '☀️';
  return '';
}

/** Zeilen fürs Infofenster eines Gebäudes, z. B. „Brennt – Feuerwehr fehlt“ */
export function infoLines(g: Game, b: Building): string[] {
  const s = st(g);
  const out: string[] = [];
  const f = s.fires.get(b.id);
  if (f) {
    if (covered(g, b, 'feuerwehr')) out.push(`🔥 Brennt – die Feuerwehr löscht (noch etwa ${Math.max(1, Math.ceil(f.need - f.ext))} s)`);
    else if (normal(g, b.owner) && !reachedBrigade(g, b.owner)) out.push(`🔥 Brennt – die Nachbarn löschen mit Eimern (noch etwa ${Math.max(1, Math.ceil(FIRE.buckets - f.t))} s). Feuerwehr ab 15 Siedlern.`);
    else {
      const left = Math.max(1, Math.ceil(f.hp / (g.maxHp(b) * FIRE.startHp / FIRE.burn)));
      out.push(`🔥 Brennt – Feuerwehr fehlt! In etwa ${left} s abgebrannt`);
    }
  }
  const k = s.sick.get(b.id);
  if (k) {
    if (covered(g, b, 'arzt')) out.push(`💀 Pest – der Arzt heilt (noch etwa ${Math.max(1, Math.ceil(PLAGUE.heal - k.heal))} s)`);
    else out.push(`💀 Pest – Arzt fehlt! Alle ${PLAGUE.death} s stirbt ein Bewohner${g.isUnlocked('arzt') ? '' : ' (Arzt ab 50 Bürgern)'}`);
  }
  if (dry(b.type) && droughtOn(g, b.island)) out.push(`☀️ Dürre – auf Feldern und Weiden wächst nichts (noch etwa ${Math.ceil(droughtLeft(g, b.island) / 60)} Min.)`);
  if (s.repair.has(b.id)) out.push('🔨 Brandschaden – die Bewohner bessern aus');
  if (b.type === 'haus') {
    // Schutz des Hauses: nur, was der Spieler schon bauen kann (Regel 8)
    const parts: string[] = [];
    if (g.isUnlocked('feuerwehr')) parts.push(`🚒 ${covered(g, b, 'feuerwehr') ? '✅' : '❌'}`);
    if (g.isUnlocked('arzt') && b.tier >= PLAGUE.minTier) parts.push(`⚕️ ${covered(g, b, 'arzt') ? '✅' : '❌'}`);
    if (g.isUnlocked('galgen') && b.tier >= CRIME.minTier) parts.push(`🪢 ${covered(g, b, 'galgen') ? '✅' : '❌'}`);
    if (parts.length) out.push(`Schutz: ${parts.join(' · ')}`);
  }
  if (b.type === 'feuerwehr' || b.type === 'arzt' || b.type === 'galgen') {
    if (b.type === 'feuerwehr' && !g.linked.has(b.id)) out.push('🚧 Kein Weg – der Löschwagen kommt nicht hin. Verbinde die Feuerwehr mit einem Weg.');
    else {
      const r = BUILDINGS[b.type].radius ?? 15;
      const [cx, cy] = g.center(b);
      let n = 0;
      for (const h of g.buildings) if (h.type === 'haus' && h.owner === b.owner) { const [x, y] = g.center(h); if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) n++; }
      const what = b.type === 'feuerwehr' ? 'vor Feuer' : b.type === 'arzt' ? 'vor der Pest' : 'vor Dieben';
      out.push(`🛡️ Schützt ${n === 1 ? 'ein Haus' : `${n} Häuser`} ${what}`);
    }
  }
  return out;
}

// ---------- Spielteil ----------

function tick(g: Game, dt: number) {
  if (dt <= 0) return;
  const s = st(g);
  tickFires(g, dt);
  tickSick(g, dt);
  tickDrought(g, dt);
  // seltene Prüfungen nur einmal je Spielsekunde
  s.slowT += dt;
  if (s.slowT < 1) return;
  const step = s.slowT;
  s.slowT = 0;
  tickTreasure(g);
  if (rate(g) <= 0) return;
  const houses = new Map<number, Building[]>();
  for (const b of g.buildings) {
    if (b.type !== 'haus' || !normal(g, b.owner)) continue;
    let l = houses.get(b.owner);
    if (!l) houses.set(b.owner, (l = []));
    l.push(b);
  }
  fireOutbreak(g, step, houses);
  s.plagueT -= step;
  if (s.plagueT <= 0) { s.plagueT += PLAGUE.check; plagueOutbreak(g, houses); }
  s.crimeT -= step;
  if (s.crimeT <= 0) { s.crimeT += CRIME.check; crime(g, houses); }
}

interface Saved {
  fires?: [number, number, number, number, number, number][];
  repair?: number[];
  sick?: [number, number, number, number][];
  drought?: [number, number][];
  curse?: [number, number][];
  fireT?: [number, number][];
  droughtT?: number; plagueT?: number; crimeT?: number;
  treasure?: [number, number][];
  count?: Partial<Counts>;
}

function save(g: Game): Saved {
  const s = st(g);
  const r = (v: number) => Math.round(v * 100) / 100;
  return {
    fires: [...s.fires].map(([id, f]) => [id, r(f.hp), r(f.t), r(f.ext), r(f.need), r(f.spread)]),
    repair: [...s.repair],
    sick: [...s.sick].map(([id, k]) => [id, r(k.t), r(k.death), r(k.heal)]),
    drought: [...s.drought].map(([i, u]) => [i, r(u)]),
    curse: [...s.curse].map(([o, u]) => [o, r(u)]),
    fireT: [...s.fireT].map(([o, t]) => [o, r(t)]),
    droughtT: r(s.droughtT), plagueT: r(s.plagueT), crimeT: r(s.crimeT),
    treasure: s.treasure.map((t) => [t.id, r(t.at)]),
    count: { ...s.count },
  };
}

function load(g: Game, data: unknown) {
  const s = fresh();
  states.set(g, s);
  const d = (data && typeof data === 'object' ? data : {}) as Saved;
  const num = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
  const arr = <T>(v: T[] | undefined) => (Array.isArray(v) ? v : []);
  for (const [id, hp, t, ext, need, spread] of arr(d.fires)) {
    if (!g.byId.has(id)) continue;
    s.fires.set(id, { hp: num(hp, 1), t: num(t, 0), ext: 0, need: num(need, FIRE.ext[0]), spread: num(spread, FIRE.spreadEvery) });
    void ext; // Löschen beginnt nach dem Laden von vorn (wenige Sekunden)
  }
  for (const id of arr(d.repair)) if (g.byId.has(id)) s.repair.add(id);
  for (const [id, t, death, heal] of arr(d.sick)) if (g.byId.has(id)) s.sick.set(id, { t: num(t, 0), death: num(death, PLAGUE.death), heal: num(heal, 0) });
  for (const [i, u] of arr(d.drought)) if (g.islands[i]) s.drought.set(i, num(u, 0));
  for (const [o, u] of arr(d.curse)) s.curse.set(o, num(u, 0));
  for (const [o, t] of arr(d.fireT)) s.fireT.set(o, num(t, FIRE.first));
  s.droughtT = num(d.droughtT, s.droughtT);
  s.plagueT = num(d.plagueT, s.plagueT);
  s.crimeT = num(d.crimeT, s.crimeT);
  for (const [id, at] of arr(d.treasure)) s.treasure.push({ id, at: num(at, g.time) });
  const c = (d.count && typeof d.count === 'object' ? d.count : {}) as Partial<Counts>;
  for (const k of Object.keys(s.count) as (keyof Counts)[]) s.count[k] = num(c[k], 0);
}

/** Eintrag in der Liste der Spielteile (src/systems.ts); bereit: Feuerwehr, Arzt, Galgen */
export const system: GameSystem = {
  id: 'events',
  tick,
  afterPlace,
  save,
  load,
  bereit: (): readonly BuildingId[] => ['feuerwehr', 'arzt', 'galgen'],
};
