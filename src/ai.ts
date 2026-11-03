// Computergegner: suchen eine Insel, gründen ein Kontor und bauen eine Siedlung –
// nach denselben Regeln und Kosten wie der Spieler (kein Schummeln).
//
// Damit ihre Städte auf Dauer tragen:
//  - Wege: Gleich nach der Gründung entsteht im Kern ums Kontor (12 Felder) ein Wegeraster,
//    auch durch Wald. Danach wächst es nur Stück für Stück: Steht ein neues Wohnhaus nicht an
//    einer Straße, verlängert die KI zuerst das Raster bis dorthin. Häuser stehen in den Blöcken
//    zwischen den Rasterlinien, damit dort später Straßen Platz haben. Betriebe kommen an Plätze am
//    Wegenetz des Kontors, in Reichweite der Marktkarren; wo ein Weg fehlt, legt die KI eine kurze
//    Anschlussstraße. Auch jeder Marktplatz hängt an diesem einen Netz (ein eigenes Netz am Marktplatz
//    ließ Waren liegen). Staut es sich, baut die KI einen weiteren Marktplatz – jeder bringt einen Karren mit.
//  - Nahrung: Gezählt wird, was die angeschlossenen Betriebe wirklich liefern. Neue Häuser gibt es nur,
//    solange die Nahrung auch die Bewohner satt macht, die noch einziehen werden.
//  - Kasse: Waren für die Bewohner kauft die KI beim Händlerschiff nur mit voller Kasse, Baustoffe (Holz,
//    Werkzeug, Steine) schon mit wenig Geld – beim Händler kosten sie 105 %, am Kontor sofort 140 % (der
//    Sofort-Kauf von Werkzeug war der größte Kostenfresser). Im Minus darf im Spiel niemand bauen (auch kein
//    Wohnhaus); dann verkauft die KI Überschüsse (Holz, Werkzeug …), bis wieder Guthaben da ist. Hungern
//    Häuser, kauft sie Nahrung am Kontor nach.
//  - Rüsten: Ab 200 Siedlern rüstet die Eroberin, die anderen bei Gefahr oder als große Stadt; fehlen Burg
//    oder Soldaten, spart die KI dafür (mustArm).
//  - Marktkarren: Sie holen zuerst, wovon am meisten bereitliegt – also Holz. Ist das Holzlager voll,
//    reißt die KI überzählige Holzfäller ab, sonst bliebe die Nahrung liegen.
//  - Rechenzeit: Die Gegner denken versetzt (nicht alle im selben Rechenschritt), prüfen zuerst
//    Freischaltung, Geld und Material und suchen Bauplätze nur im eigenen Land. Die Küstenplätze
//    einer Insel werden nur einmal berechnet. Die Überfahrt plant die KI in kurzen Etappen über eine
//    grobe Seekarte, und den Start (Insel wählen, Platz planen, losfahren) verteilt sie auf drei Schritte.
//
// Wachsen wie im Vorbild (Paket KI2):
//  - Bedarfs-Planer: Aus den Stufen (TIERS) liest die KI, welche Waren ihre Bewohner verbrauchen und für
//    den nächsten Aufstieg brauchen, und welche öffentlichen Gebäude dafür in der Nähe stehen müssen. Fehlt
//    eine Ware, setzt sie die ganze Kette – vom Rohstoff zum Endprodukt (z. B. Alkohol über Weingut, über
//    Zuckerrohr und Rumbrennerei oder über Getreide und Brauerei, je nachdem, was auf der Insel wächst).
//  - Was auf der eigenen Insel nicht wächst, kauft sie zuerst mit Aufträgen beim Händlerschiff. Ab etwa
//    150 Einwohnern und 3 000 Talern gründet sie ein zweites Kontor auf einer Insel, auf der die Mangelware
//    wächst (Phase „erweitern“), baut dort die Kette und holt die Ware mit einer Handelsroute heim.
//    Ab 120 Siedlern baut sie eine kleine Werft für ein zweites Schiff.
//  - Jeder Gegner hat einen Charakter (PERSOENLICHKEITEN): Händler, Eroberin oder Baumeister.
//    Er wirkt auf das Bautempo, die Zahl der Soldaten und die Lust auf Krieg.
//  - Tempo: Die Gegner wachsen nicht davon – höchstens Spieler-Einwohner × 1,3 + 150 (Schwierigkeit
//    „normal“; leicht weniger, schwer mehr). Wie hoch sie aufsteigen und wie viele Inseln sie besiedeln,
//    regelt die Schwierigkeit (src/schwierigkeit.ts, kiGrenzen).
//  - Fairer Start: Die erste Insel wählen sie erst nach 3 bis 6 Minuten (oder sobald der Spieler sein
//    erstes Kontor hat), nie die Heimatinsel des Spielers und nur in der Nähe der eigenen Startecke.
//  - Kontor verloren: Mit einem Schiff, das Baumaterial geladen hat, gründen sie neu; sonst fahren ihre
//    Schiffe künftig unter Piratenflagge.
//  - Militär und Krieg stehen in src/combat.ts (tickAIMilitary); die Bauten dafür (Burg, Türme,
//    Waffenschmieden, Werft) setzt diese Datei.
import { BUILDINGS, BUILD_GOODS, BuildingId, Cost, GoodId, KONTOR_LEVELS, PRICES, SHIPS, TIERS } from './data';
import { HUMAN } from './game';
import type { AIState, Building, Game, Player, Ship } from './game';
import { atWar, checkDefeat, pirates, strength } from './combat';
import { dockAt, orders, removeOrder, route, setOrder, setRoute, slots, sofort, startRoute, priceRange } from './trade';
import type { RouteStop } from './trade';
import { kiGrenzen } from './schwierigkeit';
import { T, rng } from './world';

/** Sekunden Spielzeit zwischen zwei Entscheidungen eines Gegners (Grundwert, der Charakter ändert ihn) */
export const THINK = 3;
/** Kern ums Kontor: hier entsteht das Wegeraster gleich nach der Gründung, auch durch Wald */
const CORE = 12;
/** Wegeraster: alle 4 Felder ein Weg, dazwischen 3 × 3 Felder Bauland */
const GRID = 4;
/** Beim Händler nur kaufen, wenn danach noch mehr als so viel Geld bleibt (der Charakter ändert es) */
const RESERVE = 2500;
/** So viele Wohnhäuser baut die KI mindestens bzw. höchstens (dazwischen je nach Inselgröße) */
const MIN_HOUSES = 40;
const MAX_HOUSES = 110;
/** Landfelder je Wohnhaus (Inselgröße → Hausgrenze) */
const LAND_PER_HOUSE = 28;
/** Ein weiterer Marktplatz für die Karren muss den Betrieben zusammen mindestens so viele Felder Weg ersparen */
const HUB_GAIN = 25;
/** … und wenn sich schon etwas staut, reicht weniger */
const HUB_GAIN_JAM = 10;
/** Anschluss eines Betriebs: höchstens so viel „Wegaufwand“ (freies Feld 2, Wald 5, alter Weg 1) */
const LINK_MAX = 16;
/** Nach einer vergeblichen Platzsuche so lange warten (Sekunden Spielzeit) */
const RETRY = 30;
/** Nahrung, die ein Einwohner je Minute isst (gleich für alle Stufen) */
const PER_HEAD = TIERS[0].consumes.nahrung ?? 0.1;
/** Fairer Start: die erste Insel frühestens nach so vielen Sekunden wählen (dazu Zufall bis zum Doppelten) */
const START_WAIT = 180;
/** Erste Insel nur im Umkreis so vieler Felder um die eigene Startecke (weiter weg kostet Punkte) */
const HOME_RANGE = 110;
/** Weitere Insel: ab so vielen Einwohnern und so viel Geld */
const EXPAND_POP = 150;
const EXPAND_MONEY = 3000;
/** Zweites Schiff (kleine Werft): ab so vielen Siedlern */
const WERFT_SETTLERS = 120;
/** Burg und Türme: ab so vielen Siedlern (wie für den Spieler) */
const MIL_SETTLERS = 200;
/** Für Nötiges (Holz, Nahrung, Wohnhäuser …) darf die Kasse bis auf so viel sinken */
const NOTGROSCHEN = 300;
/** Material, das das Schiff für ein neues Kontor und die ersten Betriebe mitnimmt */
const COLONY_LOAD: [GoodId, number][] = [['holz', 30], ['werkzeug', 8], ['stein', 16]];
const INF = 1 << 29;
/** Baustoffe: brauchen jeder Bau und jeder Aufstieg (beim Händler schon mit wenig Geld in der Kasse) */
const BAUSTOFFE = new Set<GoodId>(['holz', 'werkzeug', 'stein']);

// ---------- Charakter ----------

export type Charakter = 'haendler' | 'eroberin' | 'baumeister';

/** Charakter eines Gegners: wirkt auf Bautempo, Soldaten und Kriegslust. titel/text zeigt das Diplomatie-Fenster (M2). */
export interface Persoenlichkeit {
  id: Charakter;
  /** kurze Bezeichnung (ein Wort) */
  titel: string;
  /** zwei Sätze in einfachem Deutsch: wie sich der Gegner verhält */
  text: string;
  /** Sekunden zwischen zwei Bau-Entscheidungen (kleiner = baut schneller) */
  denk: number;
  /** Taler, die beim Kauf von Baumaterial mindestens übrig bleiben */
  reserve: number;
  /** Faktor für die Zahl der Soldaten */
  truppen: number;
  /** so viele Wachtürme stellt er im Frieden auf */
  tuerme: number;
  /** Lust auf Krieg aus eigenem Antrieb (0 = nur, wenn man ihn reizt) */
  krieg: number;
  /** frühestens nach so vielen Spielsekunden Krieg aus eigenem Antrieb */
  kriegAb: number;
  /** so viel stärker als der Spieler muss er für einen Krieg aus eigenem Antrieb sein (Faktor) */
  mut: number;
  /** so viel Ärger (0–100) über Reizungen führt zur Vorwarnung */
  geduld: number;
  /** Handelslust: verkauft Überschüsse schon ab diesem Anteil des Lagers */
  verkauf: number;
  /** baut Burg und Türme schon ab 200 Siedlern (sonst erst bei Gefahr oder großer Stadt) */
  ruestetFrueh: boolean;
}

export const PERSOENLICHKEITEN: Readonly<Record<Charakter, Persoenlichkeit>> = Object.freeze({
  haendler: {
    id: 'haendler', titel: 'Händler',
    text: 'Denkt zuerst an sein Geschäft und handelt viel. Er bleibt friedlich – außer man baut auf seiner Insel, lässt Soldaten auf seinem Land stehen oder kreuzt mit Kanonen vor seinem Kontor.',
    denk: 3, reserve: 2500, truppen: 0.7, tuerme: 2, krieg: 0, kriegAb: Infinity, mut: 99, geduld: 60, verkauf: 0.5, ruestetFrueh: false,
  },
  eroberin: {
    id: 'eroberin', titel: 'Eroberin',
    text: 'Rüstet früh auf, baut Burg, Türme und Kriegsschiffe. Ist sie stärker als du, sucht sie Streit – auch ohne Anlass.',
    denk: 3, reserve: 2500, truppen: 1.5, tuerme: 4, krieg: 1, kriegAb: 2400, mut: 1.1, geduld: 25, verkauf: 0.8, ruestetFrueh: true,
  },
  baumeister: {
    id: 'baumeister', titel: 'Baumeister',
    text: 'Will die größte Stadt und baut schnell. Krieg fängt er erst spät an und nur, wenn er dir weit überlegen ist.',
    denk: 2.2, reserve: 1800, truppen: 0.9, tuerme: 2, krieg: 0.4, kriegAb: 5400, mut: 1.6, geduld: 45, verkauf: 0.8, ruestetFrueh: false,
  },
});

/** Wer welchen Charakter hat (nach Namen, sonst der Reihe nach) */
const CHARAKTER_VON: Record<string, Charakter> = { 'Hendrik van Dalen': 'haendler', 'Morwenna Grey': 'eroberin', 'Baron von Kessel': 'baumeister' };
const REIHE: Charakter[] = ['haendler', 'eroberin', 'baumeister'];

/** Charakter eines Computergegners */
export function persoenlichkeit(p: Player): Persoenlichkeit {
  return PERSOENLICHKEITEN[CHARAKTER_VON[p.name] ?? REIHE[(Math.max(1, p.id) - 1) % REIHE.length]];
}

/**
 * Für das Diplomatie-Fenster (Anzeige baut M2): Charakter und Stimmung eines Gegners in einfachen Worten.
 * null = kein Computergegner.
 */
export function charakter(g: Game, id: number): { titel: string; text: string; stimmung: string } | null {
  const p = g.players[id];
  if (!p?.ai || p.pirate || p.trader || p.natives) return null;
  const c = persoenlichkeit(p);
  return { titel: c.titel, text: c.text, stimmung: stimmung(g, p) };
}

/** Stimmung gegenüber dem Spieler, ein kurzer Satz */
export function stimmung(g: Game, p: Player): string {
  if (p.defeated) return 'Ist aus dem Spiel ausgeschieden.';
  if (atWar(g, p.id, HUMAN)) return 'Führt Krieg gegen dich.';
  if (p.warnAt !== undefined) return 'Rüstet zum Krieg gegen dich!';
  const a = (p.brain as Brain | undefined)?.aerger ?? 0;
  if (a >= persoenlichkeit(p).geduld * 0.5) return 'Ist verärgert über dich.';
  return 'Ist friedlich.';
}

/** Sekunden zwischen zwei Entscheidungen dieses Gegners */
export function denkzeit(p: Player): number {
  return persoenlichkeit(p).denk;
}

// ---------- Gedächtnis ----------

/** Gedächtnis eines Gegners: die Felder aus AIState plus eigene Zusätze. Die Zusätze sind
 *  freiwillig – ältere Spielstände haben sie nicht, dann gelten die Standardwerte. */
export interface Brain extends AIState {
  /** Denkzeit schon versetzt (damit nicht alle Gegner im selben Rechenschritt denken) */
  off?: boolean;
  /** Gebäudeart (oder 'raster' / 'abriss') → Spielzeit, ab der nach einem vergeblichen Versuch (oder einem Abriss) wieder gesucht wird */
  wait?: Partial<Record<BuildingId | 'raster' | 'abriss' | 'handel' | 'route' | 'lager' | 'essen', number>>;
  /** Überfahrt zur gewählten Insel in Etappen: nächste Etappenziele, zuletzt der Ankerplatz am Kontor */
  route?: [number, number][];
  /** Insel gewählt, Fahrt wird im nächsten Denkschritt geplant (verteilt die Rechenarbeit) */
  pick?: number;
  /** fairer Start: ab dieser Spielzeit wählt die KI ihre erste Insel */
  startAt?: number;
  /** Zähler der Denkschritte (Heimat, Kolonien und Erweiterung wechseln sich ab) */
  turn?: number;
  /** Erweiterung auf eine weitere Insel (Phase „erweitern“) */
  erw?: Erweitern;
  /** frühestens dann die nächste Erweiterung */
  erwT?: number;
  /** spart für eine weitere Insel (dann wird nur Nötiges gebaut) */
  sparen?: boolean;
  /** Grundbedarf der heutigen Bewohner gerade zu knapp (dann keine neuen Häuser) */
  knapp?: boolean;
  /** Kolonien: Insel → Waren, die sie für die Heimat erzeugt */
  kol?: Record<number, GoodId[]>;
  /** Kolonien: Insel → zuletzt gemessene Leistung je Ware (t/min) */
  kolOut?: Record<number, Partial<Record<GoodId, number>>>;
  /** Kolonien mit fertigem Wegeraster */
  kolGrid?: number[];
  /** Waren, die der Heimat fehlen: fehlende Menge je Minute */
  mangel?: Partial<Record<GoodId, number>>;
  /** Waren, für deren Betriebe auf der Heimatinsel zuletzt kein Platz war (Ware → Spielzeit) */
  platz?: Partial<Record<GoodId, number>>;
  /** Ärger über den Spieler (0–100): Anlass für einen Krieg */
  aerger?: number;
  /** Grund des letzten Ärgers (für die Vorwarnung) */
  anlass?: string;
  /** seit dieser Spielzeit stehen Soldaten des Spielers auf eigenem Land */
  fremdT?: number;
  /** gestreuter frühester Zeitpunkt für einen Krieg aus eigenem Antrieb */
  kriegT?: number;
}

/** Phase „erweitern“: Schiff am Heimatkontor beladen, Insel und Platz planen, hinfahren, Kontor gründen */
interface Erweitern {
  step: 'laden' | 'planen' | 'fahren' | 'gruenden';
  ship: number;
  island: number;
  goods: GoodId[];
  site?: [number, number];
  route?: [number, number][];
  /** Denkschritte in diesem Schritt (zum Abbrechen, wenn es hängt) */
  t: number;
}

/** Möglicher Kontor-Platz an der Küste: Ecke, Wasserfeld zum Ankern, Land im Umkreis */
interface Site { x: number; y: number; wx: number; wy: number; land: number }

/** Abgeleitete Daten je Spiel (nicht gespeichert, jederzeit neu berechenbar) */
interface Memo {
  /** Küstenplätze je Insel – einmal berechnet (Wasser und Berge ändern sich nie) */
  coast: Map<number, Site[]>;
  /** Betriebe und Marktplätze, deren Anschluss nicht klappte: Gebäude → nächster Versuch */
  retry: Map<number, number>;
  /** grobe Seekarte für die Überfahrt (einmal je Spiel) */
  sea?: Sea;
  /** Insel → hat sie Berge? (einmal je Insel) */
  berg: Map<number, boolean>;
}

/** Grobe Seekarte: freie Zellen (nur Wasser) und davon das offene Meer (mit dem Kartenrand verbunden) */
interface Sea { w: number; open: Uint8Array; ocean: Uint8Array }
const memos = new WeakMap<Game, Memo>();
function memo(g: Game): Memo {
  let m = memos.get(g);
  if (!m) { m = { coast: new Map(), retry: new Map(), berg: new Map() }; memos.set(g, m); }
  return m;
}

// ---------- Ablauf ----------

export function thinkAI(g: Game, p: Player, dt: number) {
  const b = p.brain as Brain;
  if (!b.off) stagger(g, p, b);
  b.t += dt;
  if (b.t < denkzeit(p)) return;
  b.t = 0;
  b.turn = (b.turn ?? 0) + 1;
  // ausgeschieden: verbliebene Schiffe segeln als Piraten weiter
  if (p.defeated) { if (g.ships.some((s) => s.owner === p.id)) toPirates(g, p, false); return; }
  switch (b.phase) {
    case 'suchen': {
      const ship = foundingShip(g, p);
      if (!ship) { lostAll(g, p); return; }
      // fairer Start: die erste Insel erst nach 3 bis 6 Minuten wählen – oder sobald der Spieler sein Kontor hat
      if (b.startAt === undefined) b.startAt = START_WAIT * (1 + rng(g.seed * 7 + p.id * 131)());
      if (g.time < b.startAt && !g.kontor(HUMAN)) return;
      // Der Start ist auf drei leichte Denkschritte verteilt, damit kein Spielschritt ruckelt.
      // Schritt 1: Insel wählen und ihre Küstenplätze berechnen
      if (b.pick === undefined) {
        const pick = chooseIsland(g, p, ship.x, ship.y);
        if (pick < 0) return;
        coastSites(g, pick);
        b.pick = pick;
        b.island = pick; // vorgemerkt: andere Gegner wählen eine andere Insel
        b.route = undefined;
        return;
      }
      const target = b.pick;
      const giveUp = () => { (b.bad ??= []).push(target); b.island = -1; b.pick = undefined; b.route = undefined; };
      // Schritt 2: gültigen Kontor-Platz mit Ankerplatz im offenen Meer planen
      if (!b.route) {
        const site = planKontor(g, p, target, ship.x, ship.y);
        if (!site) { giveUp(); return; }
        b.site = [site.x, site.y];
        b.route = [[site.wx, site.wy]];
        return;
      }
      // Schritt 3: Überfahrt in Etappen – grobe Route über die Seekarte, je Etappe nur eine kurze genaue Wegsuche
      const route = depart(g, ship, b.route[b.route.length - 1]);
      if (!route) { giveUp(); return; }
      b.route = route;
      b.pick = undefined;
      b.phase = 'fahren';
      return;
    }
    case 'fahren': {
      const ship = foundingShip(g, p);
      if (!ship) { lostAll(g, p); return; }
      const r = voyage(g, ship, b.route);
      if (r === 'weiter') return;
      b.route = undefined;
      if (r === 'da') b.phase = 'gruenden';
      // auch direkt kein Weg: diese Insel nicht noch einmal versuchen
      else { (b.bad ??= []).push(b.island); b.island = -1; b.phase = 'suchen'; }
      return;
    }
    case 'gruenden': {
      const ship = foundingShip(g, p);
      if (!ship) { lostAll(g, p); return; }
      const [sx, sy] = b.site ?? [-1, -1];
      if (sx >= 0 && g.canPlace('kontor', sx, sy, p.id).ok) {
        g.place('kontor', sx, sy, p.id);
        g.unloadAll(ship);
        b.phase = 'aufbau';
        b.grid = false;
        const known = g.islandSeen(b.island);
        g.ev.message(`${p.name} hat ein Kontor auf ${known ? g.islands[b.island].name : 'einer noch unentdeckten Insel'} gegründet.`, 'info');
      } else {
        // Platz inzwischen belegt o. Ä. → nach 2 Fehlversuchen andere Insel
        b.tries++;
        if (b.tries % 2 === 0) (b.bad ??= []).push(b.island);
        b.phase = 'suchen';
      }
      return;
    }
    case 'aufbau': {
      if (!g.kontor(p.id, b.island) && lostKontor(g, p, b)) return;
      // Heimat, Kolonien und Erweiterung wechseln sich ab (je Denkschritt nur eine Stadt – keine Rechenspitzen)
      const kols = colonies(g, p, b);
      if (b.erw && b.turn % 2 === 0) { expand(g, p, b); return; }
      if (kols.length && b.turn % 3 === 0) { buildColony(g, p, b, kols[Math.floor(b.turn / 3) % kols.length]); return; }
      build(g, p);
    }
  }
}

/** Denkzeit versetzen: Gegner i von n denkt i × THINK / n Sekunden später, dazu etwas Zufall.
 *  So rechnet in einem Spielschritt höchstens einer – keine gemeinsamen Spitzen. */
function stagger(g: Game, p: Player, b: Brain) {
  const ais = g.players.filter((o) => o.ai && o.brain);
  const slot = THINK / Math.max(1, ais.length);
  const i = Math.max(0, ais.indexOf(p));
  b.t -= i * slot + rng(g.seed * 31 + p.id * 977)() * slot * 0.5;
  b.off = true;
}

// ---------- Schiffe ----------

/** Hat das Schiff genug Baumaterial für ein Kontor an Bord? */
export function hasKontorCargo(g: Game, s: Ship): boolean {
  const c = BUILDINGS.kontor.cost;
  return g.shipCargo(s, 'holz') >= (c.holz ?? 0) && g.shipCargo(s, 'werkzeug') >= (c.werkzeug ?? 0);
}

/** Schiff für die Gründung: eines mit Baumaterial an Bord (ohne geht keine Gründung) */
function foundingShip(g: Game, p: Player): Ship | undefined {
  return g.ships.find((s) => s.owner === p.id && hasKontorCargo(g, s));
}

/** Freies Handelsschiff: keine Handelsroute, keine Soldaten an Bord, nicht für die Erweiterung unterwegs */
function freeShip(g: Game, p: Player, b: Brain): Ship | undefined {
  return g.ships.find((s) => s.owner === p.id && !(s.guns ?? 0) && (s.type ?? 'handel_klein').startsWith('handel')
    && !route(g, s) && !s.troops?.length && s.id !== b.erw?.ship);
}

/** Losfahren: grobe Route übers Meer bis zum Ankerplatz, erste Etappe genau planen. null = geht nicht */
function depart(g: Game, ship: Ship, dock: [number, number]): [number, number][] | null {
  let route: [number, number][] = [...(seaRoute(g, ship.x, ship.y, dock[0], dock[1]) ?? []), dock];
  if (!g.moveShip(ship, route[0][0] + 0.5, route[0][1] + 0.5)) {
    // erste Etappe geht nicht: direkt zum Ankerplatz (teurer, aber selten)
    if (route.length === 1 || !g.moveShip(ship, dock[0] + 0.5, dock[1] + 0.5)) return null;
    route = [dock];
  }
  return route;
}

/** Unterwegs: nächste Etappe planen, sobald das Etappenziel fast erreicht ist (ohne anzuhalten) */
function voyage(g: Game, ship: Ship, r: [number, number][] | undefined): 'weiter' | 'da' | 'kein Weg' {
  if (r && r.length > 1) {
    const [wx, wy] = r[0];
    if (!ship.path.length || Math.hypot(ship.x - wx - 0.5, ship.y - wy - 0.5) < 10) {
      r.shift();
      if (!g.moveShip(ship, r[0][0] + 0.5, r[0][1] + 0.5)) {
        const [dx, dy] = r[r.length - 1];
        r.length = 0;
        if (!g.moveShip(ship, dx + 0.5, dy + 0.5)) return 'kein Weg';
      }
    }
    return 'weiter';
  }
  return ship.path.length ? 'weiter' : 'da';
}

// ---------- Kontor verloren ----------

/** Kein Kontor mehr auf der Heimatinsel. true = in diesem Denkschritt nichts weiter tun */
function lostKontor(g: Game, p: Player, b: Brain): boolean {
  // eine Kolonie wird zur neuen Heimat
  const other = g.kontor(p.id);
  if (other) {
    b.island = other.island;
    b.grid = true;
    if (b.kol) delete b.kol[other.island];
    if (b.kolOut) delete b.kolOut[other.island];
    return false;
  }
  const ship = g.ships.find((s) => s.owner === p.id && hasKontorCargo(g, s));
  if (ship) {
    // mit Schiff und Material neu gründen
    (b.bad ??= []).push(b.island);
    b.island = -1; b.pick = undefined; b.route = undefined; b.erw = undefined; b.grid = false;
    b.startAt = 0;
    b.phase = 'suchen';
    setRoute(g, ship, null);
    g.ev.message(`${p.name} hat sein Kontor verloren und sucht mit seinem Schiff eine neue Insel.`, 'info');
    return true;
  }
  lostAll(g, p);
  return true;
}

/** Weder Kontor noch Material: die Schiffe werden zu Piraten, der Gegner scheidet aus */
function lostAll(g: Game, p: Player) {
  if (g.kontor(p.id)) return;
  toPirates(g, p, true);
  checkDefeat(g, p.id, -1);
}

/** Alle Schiffe eines Gegners fahren künftig unter Piratenflagge */
function toPirates(g: Game, p: Player, say: boolean) {
  const pir = pirates(g);
  const mine = g.ships.filter((s) => s.owner === p.id);
  if (!pir || !mine.length) return;
  for (const s of mine) {
    setRoute(g, s, null);
    for (const id of s.troops ?? []) g.units = g.units.filter((u) => u.id !== id);
    s.troops = [];
    s.owner = pir.id;
    s.type = 'pirat';
    s.hp = Math.max(s.hp ?? SHIPS.pirat.hp, SHIPS.pirat.hp * 0.6);
    s.guns = Math.max(s.guns ?? 0, SHIPS.pirat.kanonen);
    s.target = undefined;
    s.patrol = undefined;
  }
  if (say) g.ev.message(`🏴‍☠️ ${p.name} hat kein Kontor mehr – ${mine.length === 1 ? 'sein Schiff segelt' : 'seine Schiffe segeln'} jetzt unter Piratenflagge.`, 'bad', { x: mine[0].x, y: mine[0].y });
}

// ---------- Tempo, Grenzen ----------

/** Einwohner des Spielers (alle Inseln) */
function humanPop(g: Game): number {
  return g.popByTier().reduce((a, v) => a + v, 0);
}

/** Einwohner eines Gegners (alle Inseln) */
export function aiPop(g: Game, owner: number): number {
  let n = 0;
  for (const b of g.buildings) if (b.owner === owner && b.type === 'haus') n += b.residents;
  return n;
}

/** So viele Einwohner darf ein Gegner höchstens haben: Spieler × 1,3 + 150 (Schwierigkeit „normal“) */
export function popGrenze(g: Game): number {
  const [f, plus] = kiGrenzen(g).tempo;
  return humanPop(g) * f + plus;
}

/** So viele Wohnhäuser baut die KI auf dieser Insel höchstens (nach Inselgröße) */
export function hausGrenze(g: Game, island: number): number {
  const land = g.islands[island]?.land ?? 0;
  return Math.max(MIN_HOUSES, Math.min(MAX_HOUSES, Math.round(land / LAND_PER_HOUSE)));
}

/** So viele Marktplätze höchstens (nach Inselgröße; sie kosten Unterhalt) */
function marktGrenze(g: Game, island: number): number {
  const land = g.islands[island]?.land ?? 0;
  return Math.max(3, Math.min(8, 3 + Math.floor(land / 400)));
}

/** Soll-Zahl der Soldaten: aus eigener Größe, der Stärke des Spielers und dem Charakter (6 bis 30; 0 ohne Burg-Erlaubnis) */
export function sollTruppen(g: Game, p: Player): number {
  if (g.maxPop(1, p.id) < MIL_SETTLERS) return 0;
  const per = persoenlichkeit(p);
  let n = 5 + aiPop(g, p.id) / 90 + strength(g, HUMAN) / 6;
  if (atWar(g, p.id, HUMAN) || p.warnAt !== undefined) n += 6;
  n *= per.truppen * kiGrenzen(g).truppen;
  return Math.max(6, Math.min(30, Math.round(n)));
}

/** Reserve dieses Gegners (Charakter) */
function reserve(p: Player): number {
  return persoenlichkeit(p).reserve;
}
// ---------- Überfahrt ----------

/** Zellgröße der groben Seekarte (Felder je Seite) */
const CELL = 4;

/** Grobe Seekarte: Zellen aus 4 × 4 Feldern, frei = nur Wasser. Einmal je Spiel berechnet
 *  (Wasser ändert sich nie). Darauf ist eine Route 16-mal billiger zu finden als Feld für Feld.
 *  Offenes Meer = freie Zellen, die mit dem Kartenrand verbunden sind (keine Binnenseen). */
function seaCells(g: Game): Sea {
  const m = memo(g);
  if (m.sea) return m.sea;
  const N = g.size, w = Math.ceil(N / CELL), tiles = g.tiles;
  const open = new Uint8Array(w * w).fill(1), ocean = new Uint8Array(w * w);
  // zeilenweise: ein Block ist frei, wenn alle seine Felder Wasser sind (Wasser = 0, alles andere größer)
  for (let y = 0; y < N; y++) {
    const row = y * N, brow = ((y / CELL) | 0) * w;
    for (let cx = 0, x = 0; x < N; cx++, x += CELL) {
      const e = Math.min(N, x + CELL);
      let t = e - x < CELL ? 1 : 0; // angeschnittener Block am Kartenrand: nicht frei
      for (let i = x; i < e; i++) t |= tiles[row + i];
      if (t) open[brow + cx] = 0;
    }
  }
  if (N % CELL) for (let cx = 0; cx < w; cx++) open[(w - 1) * w + cx] = 0; // letzte Blockzeile ist angeschnitten
  const q: number[] = [];
  const add = (c: number) => { if (open[c] && !ocean[c]) { ocean[c] = 1; q.push(c); } };
  for (let i = 0; i < w; i++) { add(i); add((w - 1) * w + i); add(i * w); add(i * w + w - 1); }
  for (let h = 0; h < q.length; h++) {
    const c = q[h], cx = c % w;
    if (cx > 0) add(c - 1);
    if (cx < w - 1) add(c + 1);
    if (c >= w) add(c - w);
    if (c < w * (w - 1)) add(c + w);
  }
  m.sea = { w, open, ocean };
  return m.sea;
}

/** Liegt der Ankerplatz am offenen Meer? (über kurzen Seeweg mit einer Meereszelle verbunden) */
function reachesOcean(g: Game, near: (x: number, y: number) => boolean, tx: number, ty: number): boolean {
  const { w, ocean } = seaCells(g);
  const R = 20, half = CELL >> 1;
  for (let cy = Math.max(0, Math.floor((ty - R) / CELL)); cy <= Math.min(w - 1, Math.floor((ty + R) / CELL)); cy++)
    for (let cx = Math.max(0, Math.floor((tx - R) / CELL)); cx <= Math.min(w - 1, Math.floor((tx + R) / CELL)); cx++)
      if (ocean[cy * w + cx] && near(cx * CELL + half, cy * CELL + half)) return true;
  return false;
}

/** Etappenziele übers Meer (Mitten freier Zellen, etwa alle 24 Felder) vom Schiff bis in die Nähe
 *  des Ziels. null = keine grobe Route gefunden (dann fährt das Schiff direkt). */
function seaRoute(g: Game, sx: number, sy: number, tx: number, ty: number): [number, number][] | null {
  const { w, open } = seaCells(g);
  const near = dockArea(g, tx, ty);
  const start = Math.min(w - 1, Math.floor(sy / CELL)) * w + Math.min(w - 1, Math.floor(sx / CELL));
  const prev = new Int32Array(w * w).fill(-2);
  const q = [start];
  prev[start] = -1;
  const half = CELL >> 1;
  const mid = (c: number): [number, number] => [(c % w) * CELL + half, ((c / w) | 0) * CELL + half];
  let end = -1, bd = 1e9;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], cx = c % w, cy = (c / w) | 0;
    const mx = cx * CELL + half, my = cy * CELL + half;
    // Ziel erreicht: eine freie Zelle, von der aus der Ankerplatz auf kurzem Seeweg erreichbar ist
    if (open[c] && near(mx, my)) { end = c; break; }
    const d = (mx - tx) * (mx - tx) + (my - ty) * (my - ty);
    if (d < bd && (open[c] || c === start)) { bd = d; end = c; }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= w) continue;
      const n = ny * w + nx;
      if (prev[n] !== -2 || !open[n]) continue;
      // schräg nur, wenn beide Nachbarzellen frei sind (nicht über eine Landecke)
      if (dx && dy && (!open[cy * w + nx] || !open[ny * w + cx])) continue;
      prev[n] = c;
      q.push(n);
    }
  }
  if (end < 0 || end === start) return null;
  const cells: number[] = [];
  for (let c = end; c >= 0; c = prev[c]) cells.push(c);
  cells.reverse();
  const pts: [number, number][] = [];
  for (let i = 6; i < cells.length - 1; i += 6) pts.push(mid(cells[i]));
  pts.push(mid(cells[cells.length - 1]));
  return pts;
}

/** Wasser rund um den Ankerplatz, das auf kurzem Seeweg (höchstens 20 Felder) dorthin führt.
 *  So endet die grobe Route nie auf der falschen Seite einer Landzunge. */
function dockArea(g: Game, tx: number, ty: number): (x: number, y: number) => boolean {
  const R = 20, side = 2 * R + 1, N = g.size;
  const seen = new Uint8Array(side * side);
  const water = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && g.tiles[y * N + x] === T.Wasser;
  const qx = [tx], qy = [ty];
  seen[R * side + R] = 1;
  for (let h = 0; h < qx.length; h++) {
    const x = qx[h], y = qy[h];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy, ix = nx - tx + R, iy = ny - ty + R;
      if ((!dx && !dy) || ix < 0 || iy < 0 || ix >= side || iy >= side || seen[iy * side + ix] || !water(nx, ny)) continue;
      if (dx && dy && (!water(nx, y) || !water(x, ny))) continue;
      seen[iy * side + ix] = 1;
      qx.push(nx); qy.push(ny);
    }
  }
  return (x, y) => {
    const ix = x - tx + R, iy = y - ty + R;
    return ix >= 0 && iy >= 0 && ix < side && iy < side && seen[iy * side + ix] === 1;
  };
}

// ---------- Insel und Kontor ----------

/** Inseln, die für eine neue Gründung nicht in Frage kommen: schon besiedelt, von anderen Gegnern
 *  anvisiert, die Heimatinsel des Spielers (fairer Start) und Inseln, an denen es schon nicht klappte */
function takenIslands(g: Game, p: Player): Set<number> {
  const taken = new Set(g.buildings.filter((b) => b.type === 'kontor').map((b) => b.island));
  for (const o of g.players) {
    const ob = o.brain as Brain | undefined;
    if (!ob || o.id === p.id) continue;
    if (ob.island >= 0) taken.add(ob.island);
    if (ob.erw) taken.add(ob.erw.island);
  }
  for (const id of p.brain?.bad ?? []) taken.add(id);
  for (const isl of g.islands) if (isl.heimat) taken.add(isl.id);
  return taken;
}

/** Beste freie Insel für die Heimat: groß, mit Erz/Gold, fruchtbar, nahe der eigenen Startecke
 *  (weiter als etwa 110 Felder kostet viele Punkte), nicht von anderen anvisiert, nie die Heimat des Spielers */
function chooseIsland(g: Game, p: Player, sx: number, sy: number): number {
  const taken = takenIslands(g, p);
  const [hx, hy] = g.starts[p.id] ?? [sx, sy];
  let best = -1, bs = -1e9;
  for (const isl of g.islands) {
    if (taken.has(isl.id) || isl.land < 300) continue;
    const fert = Object.values(isl.frucht).reduce((a, v) => a + (v ?? 0), 0);
    const d = Math.hypot(isl.cx - hx, isl.cy - hy);
    const score = isl.land * 0.5 + (isl.erz ? 60 : 0) + (isl.gold ? 40 : 0) + fert * 0.3 - Math.hypot(isl.cx - sx, isl.cy - sy) * 1.6 - Math.max(0, d - HOME_RANGE) * 12;
    if (score > bs) { bs = score; best = isl.id; }
  }
  return best;
}

/** Alle Küstenplätze einer Insel für ein Kontor (3 × 3 Land, mindestens 2 Wasserfelder daneben)
 *  samt Land im Umkreis von 12 Feldern. Wird je Insel nur einmal berechnet. */
function coastSites(g: Game, island: number): Site[] {
  const cache = memo(g).coast;
  const hit = cache.get(island);
  if (hit) return hit;
  const isl = g.islands[island];
  const N = g.size, R = 12;
  // Zeilensummen der Landfelder (ohne Wasser und Berg): Land im Kreis zählt so in 25 Schritten
  const bx0 = Math.max(0, isl.x0 - R - 2), by0 = Math.max(0, isl.y0 - R - 2);
  const bx1 = Math.min(N - 1, isl.x1 + R + 2), by1 = Math.min(N - 1, isl.y1 + R + 2);
  const W = bx1 - bx0 + 2;
  const rows = new Int32Array(W * (by1 - by0 + 1));
  for (let y = by0; y <= by1; y++) {
    let s = 0;
    for (let x = bx0; x <= bx1; x++) {
      const t = g.tiles[y * N + x];
      if (t !== T.Wasser && t !== T.Berg) s++;
      rows[(y - by0) * W + (x - bx0 + 1)] = s;
    }
  }
  const landIn = (cx: number, cy: number) => {
    let n = 0;
    for (let y = Math.max(by0, Math.ceil(cy - R - 0.5)); y <= Math.min(by1, Math.floor(cy + R - 0.5)); y++) {
      const dy = y + 0.5 - cy, half = Math.sqrt(Math.max(0, R * R - dy * dy));
      const a = Math.max(bx0, Math.ceil(cx - half - 0.5)), e = Math.min(bx1, Math.floor(cx + half - 0.5));
      if (e >= a) n += rows[(y - by0) * W + (e - bx0 + 1)] - rows[(y - by0) * W + (a - bx0)];
    }
    return n;
  };
  const list: Site[] = [];
  for (let y = isl.y0; y <= isl.y1 - 2; y++) for (let x = isl.x0; x <= isl.x1 - 2; x++) {
    let ok = true;
    for (let j = 0; j < 3 && ok; j++) for (let i = 0; i < 3 && ok; i++) {
      const k = (y + j) * N + x + i, t = g.tiles[k];
      if (t === T.Wasser || t === T.Berg || g.islandOf[k] !== island) ok = false;
    }
    if (!ok) continue;
    // Wasser direkt daneben zählen; Ankerplatz = das Wasserfeld mit dem meisten Wasser ringsum
    let w = 0, wx = -1, wy = -1, open = -1;
    for (let k = 0; k < 12; k++) {
      const side = k % 4, i = (k / 4) | 0;
      const rx = side === 0 || side === 1 ? x + i : side === 2 ? x - 1 : x + 3;
      const ry = side === 0 ? y - 1 : side === 1 ? y + 3 : y + i;
      if (rx < 0 || ry < 0 || rx >= N || ry >= N || g.tiles[ry * N + rx] !== T.Wasser) continue;
      w++;
      let o = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g.tile(rx + dx, ry + dy) === T.Wasser) o++;
      if (o > open) { open = o; wx = rx; wy = ry; }
    }
    if (w >= 2) list.push({ x, y, wx, wy, land: landIn(x + 1.5, y + 1.5) });
  }
  cache.set(island, list);
  return list;
}

/** Gültiger Kontor-Platz an der Küste (viel Land ringsum, nahe am Schiff) mit einem Ankerplatz
 *  am offenen Meer – an einem Binnensee könnte das Schiff nie anlegen */
function planKontor(g: Game, p: Player, island: number, sx: number, sy: number): Site | null {
  const order = coastSites(g, island).map((s) => ({ s, v: s.land - Math.hypot(s.x - sx, s.y - sy) * 0.3 })).sort((a, b) => b.v - a.v);
  let tries = 0;
  for (const { s } of order) {
    if (!g.canPlace('kontor', s.x, s.y, p.id, true).ok) continue;
    if (reachesOcean(g, dockArea(g, s.wx, s.wy), s.wx, s.wy)) return s;
    if (++tries >= 8) break; // so viele Binnensee-Plätze hintereinander: lieber eine andere Insel
  }
  return null;
}

// ---------- Lage der Stadt ----------

/** Was die KI vor einer Entscheidung über ihre Stadt weiß (in einem Durchgang gesammelt) */
interface City {
  owner: number;
  island: number;
  kontor: Building;
  /** Mitte des Kontors und Ursprung des Wegerasters */
  kx: number; ky: number; gx: number; gy: number;
  lager: Record<GoodId, number>;
  /** so viel passt von jeder Ware ins Lager */
  cap: number;
  n: Partial<Record<BuildingId, number>>;
  /** alle eigenen Gebäude auf der Insel */
  mine: Building[];
  houses: Building[];
  /** Wohnhäuser, in denen gerade Nahrung fehlt */
  hungry: number;
  prod: Building[];
  /** Kontor und Marktplätze: beanspruchen Land, schicken Marktkarren */
  claim: Building[];
  pop: number;
  /** so viele Bewohner ziehen in die vorhandenen Häuser noch ein (bis sie voll sind) */
  room: number;
  /** höchste Stufe unter den Häusern und wie viele Häuser sie hat */
  top: number; topN: number;
  /** Bilanz des Gegners (Steuern − Unterhalt je Minute, alle Inseln) */
  plus: number;
  /** Nahrung, die gerade wirklich entsteht (t/min, nach der Auslastung der Betriebe) */
  foodNow: number;
  /** gerade Nötiges (Kasse darf fast leer werden) oder Wachsen (nur mit Reserve und positiver Bilanz) */
  mode: 'noetig' | 'wachsen';
  /** Ist-Leistung der angeschlossenen Betriebe in Tonnen je Minute */
  out: Partial<Record<GoodId, number>>;
  /** So viele Einwohner macht die Nahrung dieser Betriebe satt */
  food: number;
  /** Rechteck um das eigene Land (inklusive) – nur hier wird gesucht */
  box: [number, number, number, number];
  /** Wege, die mit dem Kontor zusammenhängen (wird bei Bedarf einmal je Entscheidung berechnet) */
  kern?: Kern;
  /** Anschlusskosten je Feld (wird bei Bedarf einmal je Entscheidung berechnet) */
  net?: Net;
  /** dasselbe, aber nur über Felder des Wegerasters (für Straßen zu neuen Wohnhäusern) */
  gridNet?: Net;
}

/** Das Wegenetz des Kontors: seine Wegefelder und die Knoten daran (Kontor und angeschlossene Marktplätze).
 *  Alles soll an diesem einen Netz hängen: Die Karren eines Marktplatzes holen nur, was an Wegen liegt,
 *  die zu ihm führen – hinge der Marktplatz an einem eigenen Netz, blieben Waren dort liegen. */
interface Kern { roads: Set<number>; hubs: Set<number> }

/** Neu rechnen lassen, was von Wegen und Gebäuden abhängt (nach jedem Bau) */
function dirty(c: City) { c.kern = c.net = c.gridNet = undefined; }

/** Wegaufwand bis zum angeschlossenen Netz je Feld im Rechteck, mit Rückweg zum Nachbauen */
interface Net { cost: Int32Array; from: Int32Array; x0: number; y0: number; w: number; h: number }

function survey(g: Game, p: Player, kontor: Building, lager: Record<GoodId, number>): City {
  const island = kontor.island;
  const n: Partial<Record<BuildingId, number>> = {};
  const mine: Building[] = [], houses: Building[] = [], prod: Building[] = [], claim: Building[] = [];
  let pop = 0, hungry = 0, room = 0, top = 0, topN = 0;
  for (const o of g.buildings) {
    if (o.owner !== p.id || o.island !== island) continue;
    mine.push(o);
    n[o.type] = (n[o.type] ?? 0) + 1;
    if (o.type === 'haus') {
      houses.push(o); pop += o.residents; if (o.short.nahrung) hungry++;
      room += Math.max(0, TIERS[o.tier].maxResidents - o.residents);
      if (o.tier > top) { top = o.tier; topN = 0; }
      if (o.tier === top) topN++;
    }
    else if (o.type === 'kontor' || o.type === 'markt') claim.push(o);
    if (BUILDINGS[o.type].prod) prod.push(o);
  }
  const isl = g.islands[island];
  let x0 = isl.x1, y0 = isl.y1, x1 = isl.x0, y1 = isl.y0;
  for (const o of claim) {
    const [cx, cy] = g.center(o);
    const r = Math.ceil(BUILDINGS[o.type].radius ?? 0);
    x0 = Math.min(x0, Math.floor(cx) - r); y0 = Math.min(y0, Math.floor(cy) - r);
    x1 = Math.max(x1, Math.floor(cx) + r); y1 = Math.max(y1, Math.floor(cy) + r);
  }
  const box: [number, number, number, number] = [Math.max(isl.x0, x0), Math.max(isl.y0, y0), Math.min(isl.x1, x1), Math.min(isl.y1, y1)];
  const [kx, ky] = g.center(kontor);
  const out = output(g, prod, lager);
  const inc = g.incomePerMinute(p.id);
  let foodNow = 0;
  for (const o of prod) {
    const pr = BUILDINGS[o.type].prod!;
    if (pr.output === 'nahrung') foodNow += (60 / pr.time) * (pr.amount ?? 1) * Math.min(1, o.eff) * o.active;
  }
  return { owner: p.id, island, kontor, kx, ky, gx: Math.floor(kx), gy: Math.floor(ky), lager, cap: g.capOf(p.id, island), n, mine, houses, hungry, prod, claim, pop, room, top, topN, plus: inc.tax - inc.upkeep, foodNow, mode: 'wachsen', out, food: (out.nahrung ?? 0) / PER_HEAD, box };
}

/** Stufe eines Betriebs in der Warenkette: 0 = Rohstoff, 1 = verarbeitet Rohstoffe, 2 = verarbeitet Verarbeitetes … */
const DEPTH: Partial<Record<BuildingId, number>> = {};
{
  const defs = Object.values(BUILDINGS).filter((d) => d.prod);
  for (let pass = 0; pass < 6; pass++) for (const d of defs) {
    let dep = 0;
    for (const gd of Object.keys(d.prod!.input ?? {})) for (const e of defs) if (e.prod!.output === gd) dep = Math.max(dep, (DEPTH[e.id] ?? 0) + 1);
    DEPTH[d.id] = dep;
  }
}

/** Ist-Leistung: was die angeschlossenen, arbeitenden Betriebe je Minute liefern. Rohstoffbetriebe

/** Ist-Leistung: was die angeschlossenen, arbeitenden Betriebe je Minute liefern. Rohstoffbetriebe
 *  nach ihrer Ergiebigkeit (geteilte Felder, Nachwachsen, Fruchtbarkeit), Werkstätten nur so viel,
 *  wie ihre Rohstoffe hergeben (z. B. Fleischerei nicht mehr, als die Schweinezucht liefert). */
function output(g: Game, prod: Building[], lager: Record<GoodId, number>): Partial<Record<GoodId, number>> {
  const out: Partial<Record<GoodId, number>> = {};
  // Vorrat im Lager zählt für Werkstätten mit, als ob er 10 Minuten lang nachkäme
  const stock = (gd: GoodId) => Math.max(0, lager[gd] ?? 0) / 10;
  const list = prod.filter((o) => g.linked.has(o.id) && o.status !== 'keinWeg' && o.eff > 0)
    .sort((a, b) => (DEPTH[a.type] ?? 0) - (DEPTH[b.type] ?? 0));
  for (const o of list) {
    const pr = BUILDINGS[o.type].prod!;
    const runs = 60 / pr.time; // Arbeitsgänge je Minute bei voller Arbeit
    const inputs = Object.entries(pr.input ?? {}) as [GoodId, number][];
    // Rohstoff gerade erschöpft (Wild, Fisch, Wald, Weide wachsen erst nach): liefert nur noch einen Teil
    let f = Math.min(1, o.eff) * (o.status === 'erschoepft' ? 0.35 : 1);
    for (const [gd, k] of inputs) f = Math.min(f, ((out[gd] ?? 0) + stock(gd)) / (runs * k));
    if (f <= 0) continue;
    for (const [gd, k] of inputs) out[gd] = (out[gd] ?? 0) - runs * k * f;
    out[pr.output] = (out[pr.output] ?? 0) + runs * (pr.amount ?? 1) * f;
  }
  return out;
}

// ---------- Entscheiden und Bauen ----------

function build(g: Game, p: Player) {
  const b = p.brain as Brain;
  const kontor = g.kontor(p.id, b.island);
  if (!kontor) return;
  const lager = g.lagerOf(p.id, b.island);
  if (!lager) return;
  unloadRest(g, p, kontor);
  const c = survey(g, p, kontor, lager);
  // 1. gleich nach der Gründung: Wegeraster im Kern, auch durch Wald
  if (!b.grid) {
    b.grid = true;
    if (coreRoads(g, p, c)) return;
  }
  // 2. Betriebe ohne Anschluss ans Wegenetz nachträglich anschließen (einer je Runde)
  if (p.money > 0 && relink(g, p, c)) return;
  // 3. Im Minus: Überschüsse verkaufen, damit wieder gebaut werden darf
  if (rescue(g, p, c)) return;
  // 4. Überzählige Holzfäller abreißen, bevor sie die Marktkarren verstopfen
  if (trimWood(g, p, c)) return;
  // 5. Bedarf feststellen; Aufträge beim Händlerschiff (alle 30 Sekunden): Mangelware kaufen, Überschüsse verkaufen
  assess(g, p, c);
  tradeOrders(g, p, c, true);
  feed(g, p, c);
  restock(g, p, c);
  // 6. Weitere Insel nötig? (Phase „erweitern“ läuft dann in eigenen Denkschritten)
  maybeExpand(g, p, b, c);
  // 7. Bauwünsche der Reihe nach – der erste, der klappt, wird gebaut
  decide(g, p, c);
}

/** Baumaterial und Waren für Aufstiege: Warten Häuser auf Werkzeug, Holz oder Steine, kauft die KI am Kontor nach
 *  (Sofort-Handel wie der Spieler, wenige Tonnen alle 30 Sekunden) – auf den Händler allein ist kein Verlass, und
 *  ohne Aufstieg wächst die Stadt nicht. Steht ein Haus sonst bereit (voll, zufrieden, Dienste in der Nähe) und fehlt
 *  nur der kleine Vorrat einer Aufstiegsware (z. B. Tabakwaren für die ersten Bürger), kauft sie den auch. */
function restock(g: Game, p: Player, c: City) {
  const b = p.brain as Brain;
  if (p.money < reserve(p) * 0.4 + 300 || c.kontor.matLock || g.time < (b.wait?.lager ?? 0)) return;
  (b.wait ??= {}).lager = g.time + 30;
  const lack = new Map<GoodId, number>();
  for (const h of c.houses) {
    if (h.tier >= kiGrenzen(g).stufe || h.residents < TIERS[h.tier].maxResidents) continue;
    const cost = TIERS[h.tier + 1]?.upgradeCost ?? {};
    for (const k of BUILD_GOODS) if ((cost[k] ?? 0) > c.lager[k]) lack.set(k, Math.max(lack.get(k) ?? 0, (cost[k] ?? 0) * 4));
  }
  for (const [k, n] of lack) sofort(g, p.id, c.island, k, Math.min(6, n, Math.floor(c.cap * 0.5 - c.lager[k])));
  // Aufstiegswaren (z. B. Tabakwaren für die ersten Bürger): schon mit 1 500 Talern in der Kasse – mit der vollen
  // Reserve kam es fast nie dazu, und die Gegner blieben bei den Siedlern stehen
  if (p.money < 1500) return;
  const goods = new Map<GoodId, number>();
  for (const h of c.houses) {
    if (h.tier >= kiGrenzen(g).stufe || h.residents < TIERS[h.tier].maxResidents || h.happy < 0.85) continue;
    const cov = g.coverage.get(h.id);
    if ((TIERS[h.tier].next?.services ?? []).some((sv) => !cov?.has(sv))) continue;
    for (const r of g.upgradeGoods(h)) if (!r.ok) goods.set(r.good, Math.max(goods.get(r.good) ?? 0, Math.ceil(r.need - r.have)));
    if (goods.size >= 2) break;
  }
  for (const [gd, n] of goods) sofort(g, p.id, c.island, gd, Math.min(15, n, Math.floor((p.money - 1000) / ((PRICES[gd]?.kaufen ?? 999) * 1.4))));
}

/** Hunger: Hungern schon Häuser (oder ist das Lager fast leer, während die Betriebe zu wenig liefern), kauft die KI
 *  Nahrung am Kontor (wie der Spieler, mit Aufschlag) – höchstens für 2 Minuten Fehlmenge, alle 30 Sekunden.
 *  Sonst ziehen die Bewohner aus, und die Stadt schrumpft, bis neue Betriebe stehen. */
function feed(g: Game, p: Player, c: City) {
  const b = p.brain as Brain;
  if (g.time < (b.wait?.essen ?? 0) || p.money < NOTGROSCHEN + 200) return;
  const eat = c.pop * PER_HEAD;
  if (eat < 1 || c.lager.nahrung >= eat * (c.hungry ? 2 : 0.5)) return;
  (b.wait ??= {}).essen = g.time + 30;
  const lack = Math.max(eat - c.foodNow, c.hungry > 0 ? eat * 0.3 : 0);
  if (lack <= 0) return;
  // höchstens ein Drittel des freien Geldes – Nahrung zu kaufen ist teuer, eigene Betriebe sind besser
  const pr = (PRICES.nahrung?.kaufen ?? 18) * 1.4;
  const n = Math.floor(Math.min(lack * 2, c.cap * 0.6 - c.lager.nahrung, (p.money - NOTGROSCHEN) / 3 / pr));
  if (n > 0) sofort(g, p.id, c.island, 'nahrung', n);
}

/** Überschüsse, die die KI im Minus verkauft: Ware und die Menge, die sie für die nächsten Bauten behält */
const SELL: [GoodId, number][] = [['werkzeug', 4], ['holz', 6], ['wolle', 6], ['stoff', 6], ['stein', 6]];

/** Im Minus darf niemand bauen – das Spiel verlangt Guthaben, auch für ein Wohnhaus, das nur Holz kostet.
 *  Darum verkauft die KI dann Überschüsse am Kontor (Sofort-Handel wie der Spieler), bis wieder etwas
 *  Guthaben da ist (z. B. nach Kriegsschäden: erst Geld, dann Häuser neu bauen, dann fließen wieder Steuern).
 *  Aus einem tiefen Loch hilft das nicht – dort bleibt nur das Steuergeld. */
function rescue(g: Game, p: Player, c: City): boolean {
  if (p.money >= 0) return false;
  let sold = false;
  for (const [gd, keep] of SELL) {
    const pr = PRICES[gd];
    const surplus = Math.floor(c.lager[gd] - keep);
    if (!pr || surplus <= 0 || p.money >= 200) continue;
    if (sofort(g, p.id, c.island, gd, -Math.min(surplus, Math.ceil((200 - p.money) / (pr.verkaufen * 0.7)))) > 0) sold = true;
  }
  return sold;
}

/** Zu viele Holzfäller verstopfen die Marktkarren: Ein Karren holt zuerst, wovon am meisten bereitliegt –
 *  und das ist Holz (bis zu 10 Tonnen). Ist das Holzlager längst voll, fahren die Karren nutzlos Holz
 *  spazieren, und die Nahrung bleibt in den Hütten liegen (Lager voll, Häuser hungern). Darum reißt die
 *  KI überzählige Holzfäller ab – den schwächsten zuerst, höchstens einen je Minute –, sobald das Holzlager
 *  voll und die Stadt fertig gebaut ist (dann auch den letzten), oder sobald Häuser hungern, obwohl reichlich
 *  Holz da ist (dann bleibt einer). Danach baut sie fünf Minuten lang keinen neuen. */
function trimWood(g: Game, p: Player, c: City): boolean {
  const saws = c.prod.filter((o) => o.type === 'holzfaeller');
  const b = p.brain as Brain;
  if (!saws.length || g.time < (b.wait?.abriss ?? 0)) return false;
  // Holz, das Werkstätten verarbeiten (Erzschmelze, Büchsenmacher, Kanonengießerei): dann bleibt einer stehen
  const used = c.prod.some((o) => BUILDINGS[o.type].prod?.input?.holz);
  const full = c.lager.holz >= g.capOf(p.id, c.island) - 1 && (c.n.haus ?? 0) >= hausGrenze(g, c.island);
  // hungern Häuser bei vollem Holzlager, stauen die Karren das Holz – dann darf einer weg (aber nie unter zwei)
  const starving = c.hungry >= Math.max(2, c.houses.length * 0.1) && c.lager.holz >= c.cap - 2 && saws.length > 2;
  // fertig gebaut und das Lager voll: auch der letzte Holzfäller ist überflüssig (bei Bedarf kommt ein neuer)
  if (saws.length < (full && !used ? 1 : 2) || (!full && !starving)) return false;
  const weakest = saws.reduce((a, o) => (o.eff < a.eff ? o : a));
  const wait = (b.wait ??= {});
  wait.abriss = g.time + 60;
  wait.holzfaeller = g.time + 300;
  g.removeBuilding(weakest);
  return true;
}

/** Braucht die Stadt mehr Holz? Solange gebaut wird oder das Holzlager fast leer ist */
function woodWanted(g: Game, c: City): boolean {
  return c.lager.holz < 8 || ((c.n.haus ?? 0) < hausGrenze(g, c.island) && (c.out.holz ?? 0) < 4);
}

/** Weitere Wohnhäuser? Bis zur Haus- und Einwohnergrenze – aber nicht, solange den Bewohnern eine Ware deutlich
 *  fehlt, die die Insel selbst machen kann (sonst nähmen die Häuser den Betrieben den Platz weg) */
function housesWanted(g: Game, p: Player, c: City): boolean {
  if ((c.n.haus ?? 0) >= hausGrenze(g, c.island) || aiPop(g, p.id) + c.room >= popGrenze(g)) return false;
  // Grundbedarf der heutigen Bewohner zu knapp: erst die Betriebe, keine neuen Häuser
  return !(p.brain as Brain).knapp;
}

/** Die Bauwünsche in ihrer Reihenfolge; true = es wurde etwas gebaut.
 *  Zuerst das Nötige (Holz, Nahrung, Marktplätze, Kapelle, Stoffe, Wohnhäuser) – dafür darf die Kasse bis auf
 *  wenige hundert Taler sinken. Dann das Wachsen (Steinbruch, Kontor, Dienste, Warenketten, Werft, Militär) –
 *  nur mit positiver Bilanz und mit der Reserve des Charakters in der Kasse. */
function decide(g: Game, p: Player, c: City): boolean {
  const n = (t: BuildingId) => c.n[t] ?? 0;
  const markets = marktGrenze(g, c.island);
  c.mode = 'noetig';
  if (p.money >= 0) {
    if (!n('holzfaeller') && (housesWanted(g, p, c) || c.lager.holz < 8) && place(g, p, c, 'holzfaeller')) return true;
    // zu jeder Schweinezucht gehört eine Fleischerei (erst sie macht Nahrung daraus)
    if (n('schweinezucht') > n('fleischerei') && place(g, p, c, 'fleischerei')) return true;
    // Nahrung: auch für die Bewohner, die noch einziehen (die Häuser füllen sich und steigen auf)
    // (ist das Lager voll Nahrung, fehlt keine – dann holen die Karren nur nicht nach)
    // – oder der Vorrat reicht keine 3 Minuten mehr (die Schätzung kann daneben liegen, der Vorrat nicht)
    const eat = c.pop * PER_HEAD;
    if ((c.food < c.pop + c.room + 45 && c.lager.nahrung < Math.min(c.cap * 0.6, 40)) || (c.lager.nahrung < Math.min(3 * eat, c.cap * 0.4) && c.food < (c.pop + c.room) * 1.3 + 45) || (c.lager.nahrung < 8 && c.hungry > 0)) {
      if (placeFood(g, p, c)) return true;
      // kein Platz für Fischer, Jäger oder Schweine: mit einem Marktplatz neue Gründe erschließen
      if (c.food < c.pop + 10 && n('markt') && n('markt') < markets && place(g, p, c, 'markt', true)) return true;
    }
    if (!n('markt') && place(g, p, c, 'markt')) return true;
    // Karren: kommen viele Betriebe auf wenige Karren (oder staut es sich schon: Häuser hungern, oder die Nahrung
    // im Lager wird knapp, während Betriebe voll liegen), ein weiterer Marktplatz dort, wo er die Wege am meisten
    // verkürzt
    if (n('markt') && n('markt') < markets) {
      const waiting = c.prod.filter((o) => o.status === 'lagerVoll' && c.lager[BUILDINGS[o.type].prod!.output] < c.cap - 3).length;
      const jammed = c.hungry >= 2 || (c.pop >= 60 && c.lager.nahrung < 10 && waiting >= 2);
      if ((jammed || c.prod.length >= 8 * n('markt')) && ready(g, p, c, 'markt')
        && place(g, p, c, 'markt', false, hubSites(g, p, c, jammed ? HUB_GAIN_JAM : HUB_GAIN))) return true;
    }
    // Kapelle und Stoffe lassen Pioniere zu Siedlern aufsteigen – nur, solange die Stadt wachsen darf
    // (oder schon Siedler da sind, die beides brauchen)
    const up = c.top >= 1 || aiPop(g, p.id) < popGrenze(g);
    if (up && c.pop >= 20 && !n('kapelle') && !n('kirche') && place(g, p, c, 'kapelle')) return true;
    if (up && c.pop >= 35 && !n('schaffarm') && !n('baumwollplantage') && place(g, p, c, 'schaffarm')) return true;
    if ((n('schaffarm') || n('baumwollplantage')) && !n('weberei') && place(g, p, c, 'weberei')) return true;
    // weitere Holzfäller, solange gebaut wird (Holzbedarf) oder das Holzlager fast leer ist – große Städte brauchen mehr
    if (n('holzfaeller') < 3 + Math.floor(c.houses.length / 40) && woodWanted(g, c) && place(g, p, c, 'holzfaeller')) return true;
  }
  // Wohnhäuser bringen Steuern und kosten nur Holz – aber nur so viele, wie satt werden (auch die, die noch
  // einziehen), bis zur Hausgrenze der Insel und zur Einwohnergrenze (Tempo des Spielers)
  const fed = c.pop < 60 || c.lager.nahrung >= Math.min(2 * c.pop * PER_HEAD, c.cap * 0.3);
  if (housesWanted(g, p, c) && fed && c.pop + c.room + 3 < c.food + 30 && c.lager.holz >= (BUILDINGS.haus.cost.holz ?? 0)) {
    const sites = ready(g, p, c, 'haus') ? houseSites(g, p, c) : [];
    // Liegt der beste Platz an keiner Straße: erst das Wegeraster bis dorthin verlängern (Haus im nächsten Schritt)
    if (sites.length && !touchesRoad(g, 'haus', sites[0].x, sites[0].y) && streetTo(g, p, c, sites[0])) return true;
    if (place(g, p, c, 'haus', false, sites)) return true;
    // kein Platz mehr im Bereich der Marktplätze: Gebiet mit einem neuen Marktplatz erweitern
    if (p.money > 1000 && n('markt') && n('markt') < markets && place(g, p, c, 'markt', true)) return true;
  }
  if (p.money < 0 || (p.brain as Brain).sparen) return false;
  c.mode = 'wachsen';
  // Steine für Aufstiege, Plantagen und große Gebäude: ein Steinbruch, sobald erlaubt
  if (!n('steinbruch') && c.pop >= 40 && hasBerg(g, c.island) && place(g, p, c, 'steinbruch')) return true;
  // Werkzeug selbst schmieden, sobald es erlaubt ist (Schmiede ab 100, Erzmine ab 120 Siedlern): Werkzeug braucht
  // jeder Bau und jeder Aufstieg, gekauft kostet es am meisten Geld. Auf Inseln mit Erz die ganze Kette, sonst
  // nur die Schmiede – das Eisen bringt dann der Händler (1 Eisen → 2 Werkzeug, billiger als Werkzeug zu kaufen).
  if ((c.out.werkzeug ?? 0) < 1.5 && c.lager.werkzeug < 30) {
    if (canMake(g, p, 'werkzeug', c.island, true) && growChain(g, p, c, 'werkzeug')) return true;
    if (!(c.n.schmiede ?? 0) && allowed(g, p, 'schmiede') && !canMake(g, p, 'eisen', c.island, true) && place(g, p, c, 'schmiede')) return true;
  }
  // Rüsten: die Eroberin ab 200 Siedlern, die anderen bei Gefahr (Krieg, Vorwarnung, Ärger) oder als große Stadt.
  // Fehlen dann Burg oder Soldaten, kommt das Militär vor allem anderen – und solange das Geld dafür nicht reicht,
  // spart die KI (nur noch Nötiges wird gebaut), damit Burg, Waffen und Sold bezahlbar werden. Ohne dieses Sparen
  // gaben die Gegner jeden Taler für Betriebe aus und hatten im Krieg keinen einzigen Soldaten.
  const ruesten = mustArm(g, p, c);
  if (ruesten && military(g, p, c)) return true;
  // die Eroberin braucht für ihre Kriegsschiffe eine Werft – sobald die Burg steht, gehört sie zum Rüsten
  if (ruesten && persoenlichkeit(p).ruestetFrueh && (c.n.burg ?? 0) && shipyard(g, p, c)) return true;
  if (ruesten && p.money < reserve(p) * 0.5 + 1000) return false;
  // Werft und zweites Schiff (die Eroberin baut dort auch ihre Kriegsschiffe)
  if (shipyard(g, p, c)) return true;
  // Kontor ausbauen: mehr Lagerplatz und mehr Plätze für Aufträge beim Händler
  if (upgradeKontor(g, p, c)) return true;
  // Bedarfs-Planer: Dienste und Warenketten für die heutigen Stufen und den nächsten Aufstieg
  if (planNeeds(g, p, c)) return true;
  // Burg, Türme, Waffenschmieden
  if (military(g, p, c)) return true;
  return false;
}

/** Nahrung: den Betrieb wählen, der an seinem besten Platz am meisten liefert. Ab 75 Siedlern auch Getreide,
 *  Mühle und Bäckerei (die Kette setzt growChain der Reihe nach) – wenn Fisch und Wild nicht mehr viel hergeben. */
function placeFood(g: Game, p: Player, c: City): boolean {
  let best: { type: BuildingId; v: number; sites: Cand[] } | null = null;
  for (const type of ['fischer', 'jagdhuette', 'schweinezucht'] as BuildingId[]) {
    // Wild wächst langsam nach: nur wenige Jagdhütten
    if (type === 'jagdhuette' && (c.n.jagdhuette ?? 0) >= 2 + Math.floor(c.houses.length / 40)) continue;
    // Weiden teilen sich die Schweine: nicht mehr als die Insel trägt
    if (type === 'schweinezucht' && (c.n.schweinezucht ?? 0) >= 2 + Math.floor(c.houses.length / 30)) continue;
    if (!ready(g, p, c, type)) continue;
    const sites = sitesFor(g, p, c, type);
    if (!sites.length) continue;
    const pr = BUILDINGS[type].prod!;
    // Nahrung je Minute; Schweine werden erst in der Fleischerei zu je 2 Nahrung (die kostet extra)
    const v = (60 / pr.time) * (pr.amount ?? 1) * sites[0].eff * (pr.output === 'nahrung' ? 1 : 2 * 0.7);
    if (!best || v > best.v) best = { type, v, sites };
  }
  // Brot: eine Getreidefarm (6 t/min) ergibt über Mühle und Bäckerei etwa 6 Nahrung je Minute
  if ((!best || best.v < 3.5) && canMake(g, p, 'mehl', c.island, true) && growChain(g, p, c, 'nahrung', 0, 'baeckerei')) return true;
  return !!best && place(g, p, c, best.type, false, best.sites);
}

/** Bauplatz-Kandidat: Ecke, Bewertung, Ergiebigkeit */
interface Cand { x: number; y: number; s: number; eff: number }

/** Darf und kann die KI das bauen (Freischaltung, Wartezeit, Geld und Material notfalls vom Händler)?
 *  Zum Wachsen (c.mode) nur mit positiver Bilanz und Reserve in der Kasse. */
function ready(g: Game, p: Player, c: City, type: BuildingId): [GoodId, number][] | null {
  const d = BUILDINGS[type];
  const wait = (p.brain as Brain).wait?.[type];
  if (wait !== undefined && g.time < wait) return null;
  if (!allowed(g, p, type)) return null;
  const grow = c.mode === 'wachsen';
  if (grow && (c.plus < 0 || p.money - (d.cost.taler ?? 0) < reserve(p) * 0.5)) return null;
  return shopping(g, p, c, d.cost, grow ? reserve(p) : NOTGROSCHEN);
}

/** Freigeschaltet für diesen Gegner (Einwohner auf einer seiner Inseln) und schon im Spiel
 *  (Feuerwehr und Arzt erst, wenn ihr Spielteil sie freigibt) */
function allowed(g: Game, p: Player, type: BuildingId): boolean {
  const d = BUILDINGS[type];
  if (!g.isReady(type)) return false;
  return !(d.category && d.unlock && g.maxPop(d.unlock.tier, p.id) < d.unlock.n);
}

/** Fehlendes Baumaterial für einen Bau. null = geht nicht: zu wenig Taler, oder der Kauf am Kontor
 *  würde die Reserve (floor) angreifen. Gekauft wird nie auf Vorrat – zum Preis des Sofort-Handels wie der Spieler. */
function shopping(g: Game, p: Player, c: City, cost: Cost, floor: number): [GoodId, number][] | null {
  const taler = cost.taler ?? 0;
  if (taler > p.money) return null;
  const buy: [GoodId, number][] = [];
  let spend = 0;
  for (const k of BUILD_GOODS) {
    const lack = Math.ceil((cost[k] ?? 0) - c.lager[k]);
    if (lack <= 0) continue;
    const pr = PRICES[k];
    if (!pr) return null;
    buy.push([k, lack]);
    spend += lack * pr.kaufen * 1.4;
  }
  if (spend > 0 && (p.money - spend <= floor || p.money - spend < taler)) return null;
  return buy;
}

/** Bauen: Platz suchen (oder die schon gefundenen nehmen), fehlendes Material kaufen, setzen,
 *  ans Wegenetz anschließen */
function place(g: Game, p: Player, c: City, type: BuildingId, expand = false, found?: Cand[]): boolean {
  const buy = ready(g, p, c, type);
  if (!buy) return false;
  const d = BUILDINGS[type];
  const cands = found ?? (type === 'markt' ? marketSites(g, p, c, expand) : sitesFor(g, p, c, type));
  if (!cands.length) {
    const b = p.brain as Brain;
    (b.wait ??= {})[type] = g.time + RETRY;
    return false;
  }
  // erst jetzt kaufen, genau so viel, wie dieser Bau braucht
  for (const [gd, k] of buy) if (sofort(g, p.id, c.island, gd, k) < k) return false;
  for (const s of cands) {
    if (!g.place(type, s.x, s.y, p.id).ok) continue;
    const nb = g.buildingAt(s.x, s.y);
    if (nb && (d.prod || type === 'markt')) connect(g, p, c, nb);
    dirty(c);
    c.n[type] = (c.n[type] ?? 0) + 1;
    return true;
  }
  return false;
}

/** Bauplätze für Betriebe, Dienste und Wohnhäuser – beste zuerst */
function sitesFor(g: Game, p: Player, c: City, type: BuildingId): Cand[] {
  const d = BUILDINGS[type];
  if (type === 'haus') return houseSites(g, p, c);
  if (d.tower) return towerSites(g, p, c, type);
  if (d.trains) return nearSites(g, p, c, type);
  if (!d.prod) return serviceSites(g, p, c, type);
  const net = netOf(g, p, c);
  const res = d.harvest?.res;
  const near = res ? resourceNear(g, c, type) : null;
  const half = d.size / 2;
  const served = cartReach(g, c);
  // grob: Anschluss ans Wegenetz, in Reichweite der Marktkarren, Rohstoffe in der Nähe (schnelle Schätzung),
  // kurzer Weg zum Kontor
  const rough = scan(g, p.id, c, type, (x, y) => {
    const link = ringCost(net, type, x, y);
    if (link > LINK_MAX || !served(x + half, y + half)) return null;
    const dist = Math.hypot(x + half - c.kx, y + half - c.ky);
    return (near ? near(x, y) : 0) - link * 0.5 - dist * 0.05 - gridTiles(c, type, x, y) * 0.3;
  }, near ? 12 : 3);
  if (!near && !d.needs) return rough;
  // genau: Ergiebigkeit wie im Spiel, aber nur für die besten Kandidaten
  const fine: Cand[] = [];
  for (const s of rough) {
    const eff = g.siteEfficiency(type, s.x, s.y);
    if (eff < 0.35) continue;
    const link = ringCost(net, type, s.x, s.y);
    const dist = Math.hypot(s.x + half - c.kx, s.y + half - c.ky);
    fine.push({ x: s.x, y: s.y, eff, s: eff * 10 - link * 0.5 - dist * 0.1 - gridTiles(c, type, s.x, s.y) * 0.3 });
  }
  return fine.sort((a, b) => b.s - a.s);
}

/** Reichweite der Marktkarren: Sie holen nur Waren von Betrieben, die höchstens so weit (Abholweite) vom
 *  Kontor oder von einem angeschlossenen Marktplatz entfernt sind – weiter draußen bliebe alles liegen. */
function cartReach(g: Game, c: City): (cx: number, cy: number) => boolean {
  const kern = kernOf(g, c);
  const homes = c.claim.filter((m) => kern.hubs.has(m.id)).map((m) => ({ at: g.center(m), r: g.pickupOf(m) - 0.5 }));
  return (cx, cy) => homes.some(({ at, r }) => (at[0] - cx) ** 2 + (at[1] - cy) ** 2 <= r * r);
}

/** Dienste (Kapelle, Wirtshaus, Schule …): so viele Wohnhäuser wie möglich in Reichweite – zuerst die, denen
 *  dieser Dienst noch fehlt –, nicht weit vom Kontor. Die Häuser werden über ein Summenbild gezählt (ein
 *  Quadrat etwas kleiner als der Kreis), damit große Städte keine Rechenspitzen machen. */
function serviceSites(g: Game, p: Player, c: City, type: BuildingId, need?: Set<number>): Cand[] {
  const d = BUILDINGS[type];
  const r = (d.radius ?? 8) - 0.5, half = d.size / 2, N = g.size;
  const q = Math.max(1, Math.floor(r * 0.8));
  const [x0, y0, x1, y1] = c.box;
  const lacking = need ?? new Set<number>();
  if (!need) for (const h of c.houses) if (!g.coverage.get(h.id)?.has(type)) lacking.add(h.y * N + h.x);
  const all = new Set<number>(c.houses.map((h) => h.y * N + h.x));
  const sum = areaSum(N, x0 - q, y0 - q, x1 + q, y1 + q, (_x, _y, k) => (lacking.has(k) ? 2 : all.has(k) ? 0.3 : 0));
  const counts = !!d.radius;
  return scan(g, p.id, c, type, (x, y) => {
    const cx = Math.floor(x + half), cy = Math.floor(y + half);
    const covered = counts ? sum(cx - q - 1, cy - q - 1, cx + q, cy + q) : 0;
    if (counts && lacking.size && covered < Math.min(8, lacking.size * 2)) return null; // deckt kaum ein Haus ab, dem der Dienst fehlt
    return covered - Math.hypot(x + half - c.kx, y + half - c.ky) * 0.1 - gridTiles(c, type, x, y);
  }, 3);
}

/** Militär (Burg): nahe am Kontor, gern zwischen Kontor und Häusern */
function nearSites(g: Game, p: Player, c: City, type: BuildingId): Cand[] {
  const half = BUILDINGS[type].size / 2;
  return scan(g, p.id, c, type, (x, y) => {
    const dd = Math.hypot(x + half - c.kx, y + half - c.ky);
    return -Math.abs(dd - 7) - gridTiles(c, type, x, y) * 0.5;
  }, 3);
}

/** Wachtürme: an der Küste in 5 bis 12 Feldern ums Kontor, nicht neben einem anderen Turm */
function towerSites(g: Game, p: Player, c: City, type: BuildingId): Cand[] {
  const towers = c.mine.filter((o) => BUILDINGS[o.type].tower).map((o) => [o.x + 0.5, o.y + 0.5]);
  return scan(g, p.id, c, type, (x, y) => {
    const dd = Math.hypot(x + 0.5 - c.kx, y + 0.5 - c.ky);
    if (dd < 4 || dd > 13) return null;
    let near = 0;
    for (const [tx, ty] of towers) { const e = Math.hypot(tx - x - 0.5, ty - y - 0.5); if (e < 6) near += 6 - e; }
    let water = 0;
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (g.tile(x + i, y + j) === T.Wasser) water++;
    return Math.min(water, 6) - near * 2 - Math.abs(dd - 8) * 0.3 - (onGrid(c, x, y) ? 3 : 0);
  }, 3);
}

/** Wohnhäuser: im Bereich eines Marktplatzes (Pflicht), gern an einem Weg und bei der Kapelle,
 *  dicht beieinander, in den Blöcken zwischen den Rasterlinien (dort kommen später Straßen hin),
 *  nicht im Wald und nicht auf der Weide der Schaf- und Schweinezucht */
function houseSites(g: Game, p: Player, c: City): Cand[] {
  const N = g.size;
  const markets = c.claim.filter((o) => o.type === 'markt').map((o) => ({ at: g.center(o), r: (BUILDINGS.markt.radius ?? 15) - 0.5 }));
  if (!markets.length) return [];
  const chapels = c.mine.filter((o) => o.type === 'kapelle' || o.type === 'kirche').map((o) => ({ at: g.center(o), r: (BUILDINGS[o.type].radius ?? 9) - 0.5 }));
  const pastures = c.prod.filter((o) => { const res = BUILDINGS[o.type].harvest?.res; return res === 'weide' || res === 'feld'; })
    .map((o) => ({ at: g.center(o), r: (BUILDINGS[o.type].work ?? 4) + 1 }));
  const inside = (list: { at: [number, number]; r: number }[], x: number, y: number) => list.some(({ at, r }) => (at[0] - x) ** 2 + (at[1] - y) ** 2 <= r * r);
  return scan(g, p.id, c, 'haus', (x, y) => {
    const cx = x + 1, cy = y + 1;
    let best = 1e9;
    for (const m of markets) {
      const dd = Math.hypot(m.at[0] - cx, m.at[1] - cy);
      if (dd <= m.r && dd < best) best = dd;
    }
    if (best > 1e8) return null;
    let v = -best * 0.1;
    if (inside(chapels, cx, cy)) v += 3;
    if (inside(pastures, cx, cy)) v -= 2;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      if (g.tiles[(y + j) * N + x + i] === T.Wald) v -= 1.5;
      if (onGrid(c, x + i, y + j)) v -= 4;
    }
    if (touchesRoad(g, 'haus', x, y)) v += 2;
    return v;
  }, 3);
}

/** Marktplatz: der erste möglichst mitten im Bauland, weitere am Rand mit möglichst viel neuem Land */
function marketSites(g: Game, p: Player, c: City, expand: boolean): Cand[] {
  const N = g.size, R = 14;
  const isl = g.islands[c.island];
  // Summenbild: wertvolle Felder (Bauland – beim Erweitern nur noch nicht beanspruchtes Land)
  const x0 = Math.max(0, c.box[0] - R - 2), y0 = Math.max(0, c.box[1] - R - 2);
  const x1 = Math.min(N - 1, c.box[2] + R + 2), y1 = Math.min(N - 1, c.box[3] + R + 2);
  const sum = areaSum(N, x0, y0, x1, y1, (_x, _y, k) => {
    if (g.islandOf[k] !== isl.id) return 0;
    const t = g.tiles[k];
    if (t === T.Wasser || t === T.Berg || g.occ[k]) return 0;
    return expand ? (g.own[k] < 0 ? 1 : 0) : (g.own[k] === p.id || g.own[k] < 0 ? 1 : 0);
  });
  const net = netOf(g, p, c);
  return scan(g, p.id, c, 'markt', (x, y) => {
    const link = ringCost(net, 'markt', x, y);
    if (link > LINK_MAX) return null;
    const v = sum(x + 1 - R, y + 1 - R, x + 1 + R, y + 1 + R);
    const dist = Math.hypot(x + 1.5 - c.kx, y + 1.5 - c.ky);
    const lines = gridTiles(c, 'markt', x, y) * 0.5; // lieber in einem Block zwischen den Rasterlinien
    return expand ? v - link * 0.5 - lines : v * 0.1 - link * 0.5 - Math.abs(dist - 7) * 0.3 - lines;
  }, 3);
}

/** Ein weiterer Marktplatz (er bringt einen Karren mit) dorthin, wo er den Betrieben die weitesten Wege
 *  erspart. Gewinn = Summe der Strecken, um die Betriebe näher an einen Marktplatz oder das Kontor rücken
 *  (nur Betriebe in Reichweite der Karren). Bringt ein Platz zu wenig, gibt es keinen. */
function hubSites(g: Game, p: Player, c: City, minGain: number): Cand[] {
  const kern = kernOf(g, c);
  const hubs = c.claim.filter((m) => kern.hubs.has(m.id)).map((m) => g.center(m));
  const reach = g.pickupOf({ type: 'markt' }) - 0.5;
  const prods = c.prod.map((o) => g.center(o));
  const base = prods.map(([px, py]) => Math.min(...hubs.map(([hx, hy]) => Math.hypot(hx - px, hy - py))));
  const net = netOf(g, p, c);
  return scan(g, p.id, c, 'markt', (x, y) => {
    const link = ringCost(net, 'markt', x, y);
    if (link > LINK_MAX) return null;
    const cx = x + 1.5, cy = y + 1.5;
    let gain = 0;
    prods.forEach(([px, py], i) => {
      const d = Math.hypot(cx - px, cy - py);
      if (d < base[i] && d <= reach) gain += (base[i] - d) * 1.5; // Wege sind länger als die Luftlinie
    });
    return gain < minGain ? null : gain - link * 0.5 - gridTiles(c, 'markt', x, y) * 0.5;
  }, 3);
}


// ---------- Warenketten ----------

/** Betriebe je Ware in der Reihenfolge, in der die KI sie bevorzugt (Rest: wie in BUILDINGS) */
const PREF: Partial<Record<GoodId, BuildingId[]>> = {
  alkohol: ['weingut', 'rumbrennerei', 'brauerei'],
  wolle: ['baumwollplantage', 'schaffarm'],
  nahrung: ['fischer', 'jagdhuette', 'fleischerei', 'baeckerei'],
  erz: ['erzmine', 'tiefeErzmine'],
};
/** Ware → Betriebe, die sie herstellen */
const PRODUCERS: Partial<Record<GoodId, BuildingId[]>> = {};
for (const d of Object.values(BUILDINGS)) if (d.prod && d.category) (PRODUCERS[d.prod.output] ??= []).push(d.id);
for (const [gd, list] of Object.entries(PREF) as [GoodId, BuildingId[]][]) PRODUCERS[gd] = [...list, ...(PRODUCERS[gd] ?? []).filter((t) => !list.includes(t))];

/** Hat die Insel Berge (für Steinbruch und Minen)? Einmal je Insel gerechnet */
function hasBerg(g: Game, island: number): boolean {
  const m = memo(g).berg;
  const hit = m.get(island);
  if (hit !== undefined) return hit;
  const isl = g.islands[island];
  let found = false;
  if (isl) for (let y = Math.max(0, isl.y0 - 1); y <= Math.min(g.size - 1, isl.y1 + 1) && !found; y++)
    for (let x = Math.max(0, isl.x0 - 1); x <= Math.min(g.size - 1, isl.x1 + 1); x++) {
      const k = y * g.size + x;
      if (g.tiles[k] === T.Berg && g.islandOf[k] === island) { found = true; break; }
    }
  m.set(island, found);
  return found;
}

/** Geht dieser Betrieb auf der Insel? (Pflanze fruchtbar, Vorkommen im Berg, Berg vorhanden) */
function grows(g: Game, type: BuildingId, island: number): boolean {
  const d = BUILDINGS[type], isl = g.islands[island];
  if (!isl) return false;
  if (d.pflanze && !(isl.frucht[d.pflanze] ?? 0)) return false;
  if (d.deposit === 'gold' && !isl.gold) return false;
  if ((d.deposit === 'erz' || d.deposit === 'tiefErz') && (!g.hadOre(island) || !g.depositLeft(isl, d.deposit))) return false;
  if (d.needs === 'berg' && !hasBerg(g, island)) return false;
  return true;
}

/** Kann die ganze Kette dieses Betriebs auf der Insel laufen? now = nur, was schon freigeschaltet ist */
function makes(g: Game, p: Player, type: BuildingId, island: number, now: boolean, depth = 0): boolean {
  if (depth > 4 || !grows(g, type, island)) return false;
  if (now && !allowed(g, p, type)) return false;
  for (const gd of Object.keys(BUILDINGS[type].prod?.input ?? {}) as GoodId[]) if (gd !== 'holz' && !canMake(g, p, gd, island, now, depth + 1)) return false;
  return true;
}

/** Kann die Insel diese Ware herstellen (samt allen Vorprodukten)? */
export function canMake(g: Game, p: Player, good: GoodId, island: number, now: boolean, depth = 0): boolean {
  return (PRODUCERS[good] ?? []).some((t) => makes(g, p, t, island, now, depth));
}

/**
 * Eine Kette wachsen lassen: einen Betrieb mehr für diese Ware. Fehlt dafür ein Vorprodukt (die Insel liefert
 * weniger als 60 % dessen, was ein weiterer Betrieb verarbeiten würde), kommt zuerst dessen Betrieb dran –
 * so entsteht die Kette vom Rohstoff her (z. B. Getreidefarm → Mühle → Bäckerei). true = etwas gebaut.
 */
function growChain(g: Game, p: Player, c: City, good: GoodId, depth = 0, only?: BuildingId): boolean {
  // liegt die Ware schon reichlich im Lager, fehlt sie nicht (sonst entstünden Betriebe, deren Waren nur die
  // Marktkarren verstopfen)
  if (depth > 4 || c.lager[good] >= Math.max(20, c.cap * 0.5)) return false;
  for (const type of only ? [only] : PRODUCERS[good] ?? []) {
    if (!makes(g, p, type, c.island, true)) continue;
    const pr = BUILDINGS[type].prod!;
    const runs = 60 / pr.time;
    let feeder: GoodId | null = null;
    for (const [gd, k] of Object.entries(pr.input ?? {}) as [GoodId, number][]) {
      // Vorrat im Lager zählt, als käme er 20 Minuten lang nach
      if ((c.out[gd] ?? 0) + c.lager[gd] / 20 < runs * k * 0.6) { feeder = gd; break; }
    }
    if (feeder) {
      if (feeder === 'holz' ? place(g, p, c, 'holzfaeller') : growChain(g, p, c, feeder, depth + 1)) return true;
      // Vorprodukt liegt reichlich im Lager (z. B. von der Kolonie): dann gleich die Werkstatt
      if (c.lager[feeder] < 10) continue;
    }
    if (place(g, p, c, type)) return true;
  }
  return false;
}

// ---------- Bedarfs-Planer ----------

/** Aus einer Gruppe (z. B. Tabakwaren oder Gewürze) die Ware, die die KI am ehesten bekommt */
function pickOption(g: Game, p: Player, c: City, group: GoodId[]): GoodId {
  const b = p.brain as Brain;
  return group.find((gd) => canMake(g, p, gd, c.island, true))
    ?? group.find((gd) => Object.values(b.kol ?? {}).some((l) => l.includes(gd)))
    ?? group.find((gd) => canMake(g, p, gd, c.island, false))
    ?? group[0];
}

/** Was die Kolonien zuletzt je Minute geliefert haben (nur noch bestehende) */
function colonySupply(g: Game, p: Player, b: Brain): Partial<Record<GoodId, number>> {
  const sum: Partial<Record<GoodId, number>> = {};
  for (const k of colonies(g, p, b)) for (const [gd, v] of Object.entries(b.kolOut?.[k.island] ?? {}) as [GoodId, number][]) sum[gd] = (sum[gd] ?? 0) + v;
  return sum;
}

/**
 * Bedarf der Heimat (jede Bau-Entscheidung, ohne zu bauen): Waren der heutigen Stufen und die Aufstiegswaren der
 * höchsten Stufe – bis zur Grenze der Schwierigkeit. Was fehlt, steht danach in b.mangel (für Aufträge beim Händler,
 * die Ketten und die Wahl einer Kolonie). Fehlt eine Ware, die die Bewohner schon verbrauchen, sperrt die KI das
 * Baumaterial für Aufstiege (Schalter am Kontor, wie ihn auch der Spieler hat) – so steigen nicht mehr Häuser auf,
 * als die Betriebe versorgen können, und es gibt keinen Absturz durch Mangel.
 */
function assess(g: Game, p: Player, c: City) {
  const b = p.brain as Brain;
  const lim = kiGrenzen(g).stufe;
  const grow = aiPop(g, p.id) < popGrenze(g);
  const use = g.islandUse(p.id, c.island);
  const want = new Map<GoodId, number>();
  const add = (gd: GoodId, v: number) => want.set(gd, Math.max(want.get(gd) ?? 0, v));
  for (let t = 0; t <= Math.min(c.top, lim); t++) for (const gd of Object.keys(TIERS[t].consumes) as GoodId[]) if (gd !== 'nahrung') add(gd, use[gd] ?? 0);
  // Aufstieg vorbereiten: die Waren der nächsten Stufe (Vorrat für 2 Minuten muss im Lager liegen)
  if (c.top < lim && grow && c.topN >= 3) {
    const nx = TIERS[c.top + 1];
    for (const group of TIERS[c.top].next?.goods ?? []) {
      const gd = pickOption(g, p, c, group);
      add(gd, Math.max(use[gd] ?? 0, c.topN * nx.maxResidents * (nx.consumes[gd] ?? 0.03) * 0.4, 0.8));
    }
  }
  const kol = colonySupply(g, p, b);
  const mangel: Partial<Record<GoodId, number>> = {};
  // Grundbedarf der heutigen Stufen (ohne ihn ziehen Bewohner aus); was der Händler bringt, zählt nur bei voller Kasse
  const core = new Set<GoodId>();
  for (let t = 0; t <= Math.min(c.top, lim); t++) for (const gd of TIERS[t].core) core.add(gd);
  const rich = p.money > reserve(p) + 3000;
  // Grundbedarf nach den nächsten Aufstiegen (je Stufe drei Häuser mehr): reicht die Erzeugung nicht, wird gesperrt
  const next = new Map<GoodId, number>();
  // (für Pioniere → Siedler, den Aufstieg vieler Häuser auf einmal; Nahrung für alle Stufen – die höheren
  // Aufstiege bremst das Spiel selbst: die Aufstiegswaren müssen 2 Minuten reichen)
  for (let t = 0; t < lim; t++) {
    if (!c.houses.some((h) => h.tier === t)) continue;
    const nx = TIERS[t + 1];
    for (const gd of nx.core) if (t === 0 || gd === 'nahrung') next.set(gd, (next.get(gd) ?? use[gd] ?? 0) + 3 * nx.maxResidents * (nx.consumes[gd] ?? 0));
    // Siedler trinken Alkohol: sobald es Ketten dafür gibt (ab 75 Siedlern), werden nur so viele Siedler, wie
    // Alkohol bekommen – sonst bliebe nie ein Vorrat für die ersten Bürger
    if (t === 0 && g.maxPop(1, p.id) >= 75) next.set('alkohol', (next.get('alkohol') ?? use.alkohol ?? 0) + 3 * nx.maxResidents * (nx.consumes.alkohol ?? 0));
  }
  let short = false, knapp = false;
  for (const [gd, soon] of next) {
    // Nahrung: die Schätzung, höchstens aber etwas mehr, als gerade wirklich entsteht
    const have = gd === 'nahrung' ? Math.min(c.food * PER_HEAD, c.foodNow * 1.25 + 2) : (c.out[gd] ?? 0) + (kol[gd] ?? 0) + (rich ? 3 : 0);
    // knapp erst, wenn auch der Vorrat keine 4 Minuten mehr reicht
    if (have < soon && c.lager[gd] < Math.min(4 * soon, c.cap * 0.5)) short = true;
    // die Betriebe dafür schon jetzt planen (sonst bliebe die Sperre für immer)
    if (gd !== 'nahrung' && grow) add(gd, soon);
  }
  for (const [gd, need] of want) {
    if (need <= 0.05) continue;
    const have = (c.out[gd] ?? 0) + (kol[gd] ?? 0);
    // Grundbedarf zu knapp, dazu kaum Vorrat: keine weiteren Aufstiege
    const u = use[gd] ?? 0;
    if (core.has(gd) && u > 0.3 && have + (rich ? Math.min(u, 8) : 0) < u * 1.05 && c.lager[gd] < 2 * u) short = knapp = true;
    const lack = need * 1.1 + 0.2 - have;
    if (lack <= 0 || c.lager[gd] >= c.cap * 0.8) continue;
    mangel[gd] = lack;
  }
  b.mangel = mangel;
  b.knapp = knapp;
  // Tempo: an der Einwohnergrenze steigen keine Häuser mehr auf (sonst wüchse die Stadt über die Grenze)
  if (!grow) short = true;
  g.setMatLock(c.kontor, short);
}

/** Wächst diese Ware auf der Insel gut? Alkohol nur aus Getreide (Brauerei) zählt nicht – das braucht viel Land;
 *  dann sucht die KI lieber eine Insel mit Wein oder Zuckerrohr. */
function makesWell(g: Game, p: Player, gd: GoodId, island: number, now: boolean): boolean {
  if (gd === 'alkohol') return makes(g, p, 'weingut', island, now) || makes(g, p, 'rumbrennerei', island, now);
  return canMake(g, p, gd, island, now);
}

/**
 * Bedarfs-Planer je Stufe aus TIERS: Dienste (Kapelle, Wirtshaus, Schule, Kirche, Badehaus, Hochschule, Theater)
 * und Waren (siehe assess). Was fehlt und auf der Insel geht, bekommt einen Betrieb mehr in seiner Kette; findet
 * sich dafür kein Platz, merkt sich die KI die Ware für eine Kolonie (b.platz). true = etwas gebaut.
 */
function planNeeds(g: Game, p: Player, c: City): boolean {
  const b = p.brain as Brain;
  const lim = kiGrenzen(g).stufe;
  const grow = aiPop(g, p.id) < popGrenze(g);
  if (services(g, p, c, lim, grow)) return true;
  if (safety(g, p, c)) return true;
  // was eine Kolonie schon liefert, baut die Heimat nicht auch noch (spart Land, z. B. Brauerei statt Wein)
  const kol = colonySupply(g, p, b);
  const todo = (Object.keys(b.mangel ?? {}) as GoodId[]).filter((gd) => canMake(g, p, gd, c.island, true) && (kol[gd] ?? 0) < 0.5);
  for (const gd of todo) {
    if (growChain(g, p, c, gd)) return true;
    (b.platz ??= {})[gd] = g.time;
  }
  // kein Platz für die nötigen Betriebe: das Gebiet mit einem Marktplatz erweitern
  if (todo.length && (c.n.markt ?? 0) < marktGrenze(g, c.island) && place(g, p, c, 'markt', true)) return true;
  return false;
}

/** Öffentliche Gebäude: der Dienst, der den meisten Häusern fehlt (mindestens 3), wird gebaut – auch die des
 *  nächsten Aufstiegs, solange die Stadt noch wachsen darf */
function services(g: Game, p: Player, c: City, lim: number, grow: boolean): boolean {
  const need = new Map<BuildingId, number>();
  // die Dienste des nächsten Aufstiegs erst, wenn dessen Waren schon kommen (sonst kosten sie nur Unterhalt)
  const kol = colonySupply(g, p, p.brain as Brain);
  const has = (gd: GoodId) => (c.out[gd] ?? 0) + (kol[gd] ?? 0) >= 0.5 || c.lager[gd] >= 10;
  // (Siedler → Bürger: auch, wenn schon viele Siedler-Häuser voll und zufrieden warten – die Aufstiegsware kauft
  // dann restock beim Händler, sonst kämen Wirtshaus und Schule nie)
  const waiting = c.houses.filter((h) => h.tier === 1 && h.residents >= TIERS[1].maxResidents && h.happy >= 0.85).length;
  const goodsReady = TIERS.map((t, i) => (t.next?.goods ?? []).some((group) => group.some(has)) || (i === 1 && waiting >= 8));
  for (const h of c.houses) {
    const cov = g.coverage.get(h.id);
    const list = h.tier < lim && grow && goodsReady[h.tier] ? [...TIERS[h.tier].services, ...(TIERS[h.tier].next?.services ?? [])] : TIERS[h.tier].services;
    for (const s of list) if (s !== 'markt' && !cov?.has(s)) need.set(s, (need.get(s) ?? 0) + 1);
  }
  // Dienste für den nächsten Aufstieg schon ab 4 Häusern, die ihn brauchen (ein Platz deckt dann mindestens 4 ab)
  const order = [...need].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]);
  // Dienste sind für den Aufstieg unverzichtbar (ohne Wirtshaus und Schule keine Bürger): sie gelten als nötig –
  // dafür muss nicht die halbe Reserve in der Kasse liegen, ein Polster von 1 000 Talern genügt
  for (const [s] of order) {
    if (!allowed(g, p, s) || p.money < (BUILDINGS[s].cost.taler ?? 0) + 1000) continue;
    const mode = c.mode;
    c.mode = 'noetig';
    const ok = place(g, p, c, s);
    c.mode = mode;
    if (ok) return true;
  }
  return false;
}

/** Feuerwehr und Arzt, sobald es sie gibt (ihr Spielteil gibt sie frei) und genug Häuser ohne Schutz sind */
function safety(g: Game, p: Player, c: City): boolean {
  if (c.houses.length < 10) return false;
  for (const type of ['feuerwehr', 'arzt'] as BuildingId[]) {
    if (!allowed(g, p, type) || p.money < (BUILDINGS[type].cost.taler ?? 0) + reserve(p)) continue;
    const r = BUILDINGS[type].radius ?? 15;
    const at = c.mine.filter((o) => o.type === type).map((o) => g.center(o));
    const N = g.size, lacking = new Set<number>();
    for (const h of c.houses) {
      const [hx, hy] = g.center(h);
      if (!at.some(([x, y]) => (x - hx) ** 2 + (y - hy) ** 2 <= r * r)) lacking.add(h.y * N + h.x);
    }
    if (lacking.size < Math.max(5, c.houses.length * 0.3)) continue;
    if (place(g, p, c, type, false, serviceSites(g, p, c, type, lacking))) return true;
  }
  return false;
}

/** Kontor ausbauen, sobald erlaubt und bezahlbar (mehr Lager, mehr Aufträge beim Händler) */
function upgradeKontor(g: Game, p: Player, c: City): boolean {
  const next = KONTOR_LEVELS[(c.kontor.level ?? 0) + 1];
  if (!next || (next.unlock && !g.reached(next.unlock, p.id))) return false;
  if (p.money < (next.cost.taler ?? 0) + reserve(p)) return false;
  const buy = shopping(g, p, c, next.cost, reserve(p));
  if (!buy) return false;
  for (const [gd, k] of buy) if (sofort(g, p.id, c.island, gd, k) < k) return false;
  return g.kontorUpgrade(c.kontor).ok;
}

/** Kleine Werft ab 120 Siedlern und ein zweites Handelsschiff (für Handelsroute und Erweiterung) */
function shipyard(g: Game, p: Player, c: City): boolean {
  if (g.maxPop(1, p.id) < WERFT_SETTLERS) return false;
  const w = c.mine.find((o) => o.type === 'werft' || o.type === 'grosswerft');
  // Werft (1 100 Taler): mit etwas Polster in der Kasse – die Eroberin früher (sie baut dort Kriegsschiffe)
  if (!w) return p.money > (persoenlichkeit(p).ruestetFrueh ? 1600 : 2000) && place(g, p, c, 'werft');
  const traders = g.ships.filter((s) => s.owner === p.id && (s.type ?? 'handel_klein').startsWith('handel')).length;
  if (w.job || traders >= 2 || p.money < 1400) return false;
  const sd = SHIPS.handel_klein;
  for (const [gd, n] of [['holz', sd.cost.holz], ['stoff', sd.cost.stoff]] as [GoodId, number][]) {
    const lack = Math.ceil(n - c.lager[gd]);
    if (lack > 0 && sofort(g, p.id, c.island, gd, lack) < lack) return false;
  }
  return g.orderShip(w, 'handel_klein').ok;
}

/** Muss der Gegner jetzt rüsten? Ab 200 Siedlern (dann darf er Burg und Soldaten haben): die Eroberin immer, die
 *  anderen bei Gefahr (Krieg, Vorwarnung, Ärger über den Spieler) oder ab 350 Einwohnern – und nur, solange Burg
 *  oder Soldaten fehlen (unter 60 % der Soll-Zahl). */
function mustArm(g: Game, p: Player, c: City): boolean {
  if (g.maxPop(1, p.id) < MIL_SETTLERS) return false;
  const b = p.brain as Brain, per = persoenlichkeit(p);
  const threat = atWar(g, p.id, HUMAN) || p.warnAt !== undefined || (b.aerger ?? 0) >= per.geduld * 0.5;
  if (!per.ruestetFrueh && !threat && c.pop < 350) return false;
  if (!g.buildings.some((o) => o.owner === p.id && BUILDINGS[o.type].trains)) return true;
  let units = 0;
  for (const u of g.units) if (u.owner === p.id) units++;
  for (const o of g.buildings) if (o.owner === p.id) units += o.train?.length ?? 0;
  return units < sollTruppen(g, p) * 0.6;
}

/** Burg und Wachtürme ab 200 Siedlern (die Eroberin gleich, die anderen bei Gefahr oder großer Stadt), dazu
 *  Waffenschmieden, wenn die Insel Erz hat: Schwerter, ab 400 Bürgern Kanonen. Ausbildung und Schiffe: combat.ts */
function military(g: Game, p: Player, c: City): boolean {
  if (g.maxPop(1, p.id) < MIL_SETTLERS) return false;
  const b = p.brain as Brain, per = persoenlichkeit(p);
  const threat = atWar(g, p.id, HUMAN) || p.warnAt !== undefined || (b.aerger ?? 0) >= per.geduld * 0.5;
  if (!per.ruestetFrueh && !threat && c.pop < 350) return false;
  // Burg 600 Taler, Turm 200–300: dafür muss nicht die ganze Reserve in der Kasse liegen (sonst rüstet nie jemand)
  if (p.money < (threat ? 900 : 1300)) return false;
  const n = (t: BuildingId) => c.n[t] ?? 0;
  if (!n('burg') && !n('grosseburg') && !n('festung') && place(g, p, c, 'burg')) return true;
  if (n('holzturm') + n('wachturm') < per.tuerme + (threat ? 2 : 0) && place(g, p, c, n('steinbruch') || c.lager.stein >= 6 ? 'wachturm' : 'holzturm')) return true;
  if (sollTruppen(g, p) > 0 && (c.out.schwerter ?? 0) < 0.4 && canMake(g, p, 'schwerter', c.island, true) && growChain(g, p, c, 'schwerter')) return true;
  if ((per.ruestetFrueh || threat) && (c.out.kanonen ?? 0) < 0.2 && canMake(g, p, 'kanonen', c.island, true) && growChain(g, p, c, 'kanonen')) return true;
  return false;
}

/** Waffen, die der Gegner gerade braucht (Tonnen im Lager): Schwerter für Soldaten, Kanonen für Kanoniere,
 *  Türme und Kriegsschiffe */
export function waffenBedarf(g: Game, p: Player): Partial<Record<GoodId, number>> {
  const soll = sollTruppen(g, p);
  if (!soll) return {};
  let units = 0;
  for (const u of g.units) if (u.owner === p.id) units++;
  const out: Partial<Record<GoodId, number>> = {};
  if (units < soll) out.schwerter = Math.min(30, (soll - units) * 3);
  const per = persoenlichkeit(p);
  const navy = g.ships.filter((s) => s.owner === p.id && (s.type ?? '').startsWith('krieg'));
  const guns = navy.reduce((a, s) => a + Math.max(0, SHIPS[s.type ?? 'krieg_klein'].kanonen - (s.guns ?? 0)), 0);
  if (guns > 0 || per.ruestetFrueh || atWar(g, p.id, HUMAN)) out.kanonen = Math.min(20, guns + 4);
  if (g.reached({ tier: 3, n: 400 }, p.id)) out.musketen = 8;
  return out;
}

// ---------- Handel ----------

/** nächste Prüfung der Aufträge je Kontor */
const orderT = new WeakMap<Game, Map<number, number>>();

/**
 * Aufträge beim Händlerschiff (wie der Spieler, alle 30 Sekunden geprüft): Mangelware und Waffen kaufen,
 * Baustoffe, die die Insel nicht macht, auf Vorrat; Überschüsse verkaufen (der Händler-Charakter früher).
 * Plätze je Kontorstufe wie beim Spieler – Wichtiges zuerst.
 */
function tradeOrders(g: Game, p: Player, c: City, home: boolean) {
  let m = orderT.get(g);
  if (!m) orderT.set(g, (m = new Map()));
  if (g.time < (m.get(c.kontor.id) ?? 0)) return;
  m.set(c.kontor.id, g.time + 30);
  const b = p.brain as Brain, per = persoenlichkeit(p), k = c.kontor;
  const buy = new Map<GoodId, number>();
  const want = (gd: GoodId, t: number) => { if (PRICES[gd]) buy.set(gd, Math.max(buy.get(gd) ?? 0, Math.min(Math.round(t), Math.floor(c.cap * 0.8)))); };
  // Waren für die Bewohner und Waffen kauft die KI beim Händler nur mit voller Kasse (das ist teuer – sonst
  // fehlte das Geld für eigene Betriebe und für eine Kolonie)
  if (home && !b.sparen && p.money > reserve(p) + 2000) {
    for (const [gd, lack] of Object.entries(b.mangel ?? {}) as [GoodId, number][]) want(gd, lack * 5 + 6);
  }
  // Waffen: die Eroberin und wer bedroht ist, kaufen schon mit der Reserve in der Kasse
  const armed = persoenlichkeit(p).ruestetFrueh || atWar(g, p.id, HUMAN) || p.warnAt !== undefined;
  if (home && p.money > reserve(p) + (armed ? 0 : 2000)) {
    for (const [gd, t] of Object.entries(waffenBedarf(g, p)) as [GoodId, number][]) if ((c.out[gd] ?? 0) < 0.3) want(gd, t);
  }
  if ((c.out.werkzeug ?? 0) < 0.5) want('werkzeug', home ? 15 + Math.min(25, c.houses.length / 4) : 8);
  // Schmiede ohne eigenes Eisen (Insel ohne Erz): Eisen beim Händler
  if ((c.n.schmiede ?? 0) && (c.out.eisen ?? 0) < 1) want('eisen', 16);
  if (c.lager.holz < 15 && (c.out.holz ?? 0) < 6) want('holz', home ? 30 : 15);
  if (!(c.n.steinbruch ?? 0)) want('stein', home ? 20 : 12);
  // nicht verkaufen: was die Bewohner brauchen, Baustoffe, Waffen und was die Kolonien heimschicken
  const keep = new Set<GoodId>(['holz', 'werkzeug', 'stein', 'nahrung', 'schwerter', 'musketen', 'kanonen']);
  for (let t = 0; t < TIERS.length; t++) for (const gd of Object.keys(TIERS[t].consumes) as GoodId[]) keep.add(gd);
  for (const l of Object.values(b.kol ?? {})) for (const gd of l) keep.add(gd);
  const sell = new Map<GoodId, number>();
  for (const gd of Object.keys(c.lager) as GoodId[]) {
    if (buy.has(gd) || !PRICES[gd]) continue;
    const full = c.lager[gd] >= c.cap * per.verkauf;
    if (full && (!keep.has(gd) || (gd === 'holz' && c.lager.holz >= c.cap - 1))) sell.set(gd, Math.round(c.cap * 0.4));
  }
  // nur kaufen, was die Kasse hergibt: je Ware höchstens die Hälfte dessen, was über der Reserve liegt
  // (Waren beim Händler zu kaufen ist teuer – auf Dauer müssen eigene Betriebe her). Baustoffe (Holz, Werkzeug,
  // Steine) braucht jeder Bau und jeder Aufstieg ohnehin: die gibt es schon mit wenig Geld in der Kasse – beim
  // Händler kosten sie nur 105 %, am Kontor sofort dagegen 140 % (das war der größte Kostenfresser der KI).
  const spare = Math.max(0, p.money - reserve(p)) * 0.5;
  const spareBau = Math.max(0, p.money - NOTGROSCHEN - 400) * 0.5;
  for (const [gd, limit] of [...buy]) {
    const afford = Math.floor(c.lager[gd]) + Math.floor((BAUSTOFFE.has(gd) || gd === 'eisen' ? spareBau : spare) / priceRange(gd, true)[1]);
    if (afford <= c.lager[gd] + 1) buy.delete(gd); else buy.set(gd, Math.min(limit, afford));
  }
  // alte Aufträge, die nicht mehr passen, weg; neue setzen (Kaufen: 105 %, damit der Händler sicher liefert;
  // Verkaufen: 70 % des Grundpreises)
  for (const o of [...orders(g, k)]) if (!(o.buy ? buy : sell).has(o.g)) removeOrder(g, k, o.g);
  const sl = slots(k);
  [...buy].slice(0, sl.buy).forEach(([gd, limit]) => setOrder(g, k, { g: gd, buy: true, limit, price: priceRange(gd, true)[1] }));
  [...sell].slice(0, sl.sell).forEach(([gd, limit]) => setOrder(g, k, { g: gd, buy: false, limit, price: priceRange(gd, false)[0] }));
}

// ---------- Weitere Inseln (Phase „erweitern“) ----------

/** Kontore außerhalb der Heimatinsel */
function colonies(g: Game, p: Player, b: Brain): Building[] {
  return g.buildings.filter((o) => o.type === 'kontor' && o.owner === p.id && o.island !== b.island);
}

/** Waren der erlaubten Stufen, die die Heimat nie selbst machen kann (für die Wahl einer Kolonie) */
function futureGoods(g: Game, p: Player, c: City): GoodId[] {
  const lim = kiGrenzen(g).stufe, b = p.brain as Brain;
  const out: GoodId[] = [];
  const covered = (gd: GoodId) => makesWell(g, p, gd, c.island, false) || Object.values(b.kol ?? {}).some((l) => l.includes(gd));
  for (let t = 0; t <= lim; t++) {
    for (const gd of Object.keys(TIERS[t].consumes) as GoodId[]) if (!covered(gd) && !out.includes(gd)) out.push(gd);
    if (t < lim) for (const group of TIERS[t].next?.goods ?? []) if (!group.some(covered)) out.push(group[0]);
  }
  return out;
}

/** Zeit für eine weitere Insel? (ab ≈ 150 Einwohnern und 3 000 Talern, bis zur Inselzahl der Schwierigkeit) */
function maybeExpand(g: Game, p: Player, b: Brain, c: City) {
  b.sparen = false;
  if (b.erw || g.time < (b.erwT ?? 0)) return;
  const [minI, maxI] = kiGrenzen(g).inseln;
  const kontors = g.buildings.filter((o) => o.type === 'kontor' && o.owner === p.id).length;
  if (kontors >= maxI || c.pop < EXPAND_POP || c.plus < 50) return;
  // erst sparen (Wachsen ruht, nur Nötiges wird gebaut), dann aufbrechen
  if (p.money < EXPAND_MONEY) { b.sparen = !!freeShip(g, p, b); return; }
  const made = (gd: GoodId) => Object.values(b.kol ?? {}).some((l) => l.includes(gd));
  const noRoom = (gd: GoodId) => g.time - (b.platz?.[gd] ?? -1e9) < 600;
  let goods = (Object.keys(b.mangel ?? {}) as GoodId[]).filter((gd) => (!makesWell(g, p, gd, c.island, false) || noRoom(gd)) && !made(gd));
  if (!goods.length) goods = futureGoods(g, p, c);
  if (!goods.length && kontors >= minI) return;
  if (!goods.length) goods = ['kakao', 'gewuerze', 'tabakwaren', 'alkohol', 'gold'];
  const ship = freeShip(g, p, b);
  if (!ship) { b.erwT = g.time + 60; return; }
  const isl = chooseColony(g, p, c, goods);
  if (isl < 0) { b.erwT = g.time + 300; return; }
  b.erw = { step: 'laden', ship: ship.id, island: isl, goods: goods.filter((gd) => canMake(g, p, gd, isl, false)).slice(0, 4), t: 0 };
}

/** Insel für eine Kolonie: dort wächst möglichst viel von der Mangelware, groß genug, nicht weit */
function chooseColony(g: Game, p: Player, c: City, goods: GoodId[]): number {
  const taken = takenIslands(g, p);
  let best = -1, bs = -1e9;
  for (const isl of g.islands) {
    if (taken.has(isl.id) || isl.id === c.island || isl.land < 250) continue;
    let v = 0;
    for (const gd of goods) if (canMake(g, p, gd, isl.id, false)) v += 100;
    if (!v) continue;
    v += Math.min(isl.land, 1500) * 0.02 - Math.hypot(isl.cx - c.kx, isl.cy - c.ky) * 0.8;
    if (v > bs) { bs = v; best = isl.id; }
  }
  return best;
}

/** Erweitern Schritt für Schritt: Schiff am Heimatkontor beladen → Platz planen → hinfahren → Kontor gründen */
function expand(g: Game, p: Player, b: Brain) {
  const e = b.erw!;
  e.t++;
  const s = g.ships.find((x) => x.id === e.ship && x.owner === p.id);
  const home = g.kontor(p.id, b.island);
  const stop = (wait: number, bad = false) => { if (bad) (b.bad ??= []).push(e.island); b.erw = undefined; b.erwT = g.time + wait; };
  if (!s || !home) { stop(120); return; }
  if (e.t > 150) { stop(300, true); return; }
  switch (e.step) {
    case 'laden': {
      if (g.shipDock(s) !== home || s.path.length) {
        if (!s.path.length) { const at = dockAt(g, home); if (!at || !g.moveShip(s, at[0], at[1])) stop(300); }
        return;
      }
      const l = g.lagerOf(p.id, home.island);
      if (!l) { stop(120); return; }
      for (const [gd, n] of COLONY_LOAD) {
        const lack = Math.ceil(n - g.shipCargo(s, gd) - l[gd]);
        const pr = PRICES[gd]?.kaufen ?? 0;
        if (lack > 0 && gd !== 'stein' && p.money - lack * pr * 1.4 > NOTGROSCHEN) sofort(g, p.id, home.island, gd, lack);
        g.loadGood(s, gd, Math.max(0, n - g.shipCargo(s, gd)));
      }
      if (!hasKontorCargo(g, s)) { g.unloadAll(s); stop(180); return; }
      e.step = 'planen';
      return;
    }
    case 'planen': {
      const site = planKontor(g, p, e.island, s.x, s.y);
      if (!site) { stop(60, true); return; }
      const r = depart(g, s, [site.wx, site.wy]);
      if (!r) { stop(60, true); return; }
      e.site = [site.x, site.y];
      e.route = r;
      e.step = 'fahren';
      return;
    }
    case 'fahren': {
      const r = voyage(g, s, e.route);
      if (r === 'weiter') return;
      if (r === 'kein Weg') { stop(60, true); return; }
      e.step = 'gruenden';
      return;
    }
    case 'gruenden': {
      const [sx, sy] = e.site ?? [-1, -1];
      if (sx < 0 || !g.canPlace('kontor', sx, sy, p.id).ok) { e.step = 'planen'; return; }
      g.place('kontor', sx, sy, p.id);
      g.unloadAll(s);
      (b.kol ??= {})[e.island] = e.goods;
      b.erw = undefined;
      b.erwT = g.time + 600;
      const known = g.islandSeen(e.island);
      g.ev.message(`${p.name} hat ein weiteres Kontor auf ${known ? g.islands[e.island].name : 'einer noch unentdeckten Insel'} gegründet.`, 'info');
      ensureRoute(g, p, b, true);
    }
  }
}

/** Kolonie ausbauen: Wegeraster, Marktplatz, die Ketten ihrer Waren (solange die Heimat davon zu wenig hat) */
function buildColony(g: Game, p: Player, b: Brain, k: Building) {
  const lager = g.lagerOf(p.id, k.island);
  if (!lager) return;
  unloadRest(g, p, k);
  const c = survey(g, p, k, lager);
  const goods = (b.kol ??= {})[k.island] ??= [];
  // weitere Mangelware, die die Heimat nicht gut selbst machen kann und hier wächst (höchstens 4 Waren je Kolonie)
  for (const gd of Object.keys(b.mangel ?? {}) as GoodId[]) {
    if (goods.length >= 4 || goods.includes(gd) || Object.values(b.kol).some((l) => l.includes(gd))) continue;
    const homeOk = makesWell(g, p, gd, b.island, false) && g.time - (b.platz?.[gd] ?? -1e9) >= 600;
    if (!homeOk && canMake(g, p, gd, k.island, false)) goods.push(gd);
  }
  const out: Partial<Record<GoodId, number>> = {};
  for (const gd of goods) out[gd] = c.out[gd] ?? 0;
  (b.kolOut ??= {})[k.island] = out;
  if (!(b.kolGrid ??= []).includes(k.island)) {
    b.kolGrid.push(k.island);
    if (coreRoads(g, p, c)) return;
  }
  if (p.money > 0 && relink(g, p, c)) return;
  tradeOrders(g, p, c, false);
  ensureRoute(g, p, b);
  if (p.money < 0) return;
  if (!(c.n.markt ?? 0) && place(g, p, c, 'markt')) return;
  for (const gd of goods) {
    const lack = b.mangel?.[gd] ?? 0;
    if (lack < 0.2 || !canMake(g, p, gd, k.island, true)) continue;
    if (growChain(g, p, c, gd)) { b.mangel![gd] = Math.max(0, lack - 3); return; }
    // kein Platz mehr für den Betrieb: Gebiet mit einem Marktplatz erweitern
    if ((c.n.markt ?? 0) < 2 && p.money > 2000 && place(g, p, c, 'markt', true)) return;
  }
}

/** Handelsroute: ein Schiff holt die Waren der Kolonien heim (bis zu 3 Kolonien und die Heimat) */
function ensureRoute(g: Game, p: Player, b: Brain, now = false) {
  if (!now && g.time < (b.wait?.route ?? 0)) return;
  (b.wait ??= {}).route = g.time + 20;
  const home = g.kontor(p.id, b.island);
  if (!home) return;
  const kols = colonies(g, p, b).filter((k) => (b.kol?.[k.island] ?? []).length).slice(0, 3);
  if (!kols.length) return;
  const all = new Set<GoodId>();
  const stops: RouteStop[] = kols.map((k) => {
    const goods = b.kol![k.island];
    for (const gd of goods) all.add(gd);
    return { kontor: k.id, laden: Object.fromEntries(goods.map((gd) => [gd, 50])), entladen: {} };
  });
  stops.push({ kontor: home.id, laden: {}, entladen: Object.fromEntries([...all].map((gd) => [gd, 100])) });
  let ship = g.ships.find((s) => s.owner === p.id && route(g, s));
  const r = ship ? route(g, ship) : null;
  if (ship && r && JSON.stringify(r.stops) === JSON.stringify(stops)) { if (!r.on) startRoute(g, ship); return; }
  ship ??= freeShip(g, p, b);
  if (!ship) return;
  setRoute(g, ship, { stops, on: false, next: 0 });
  startRoute(g, ship);
}

// ---------- Anlass für Krieg ----------

/** Abstand eines Punkts zum Rand eines Gebäudes (0 = darauf) */
function gap(b: Building, x: number, y: number): number {
  const s = BUILDINGS[b.type].size;
  return Math.hypot(Math.max(b.x - x, 0, x - (b.x + s)), Math.max(b.y - y, 0, y - (b.y + s)));
}

/**
 * Reizungen wie im Vorbild (alle paar Sekunden, dt = Sekunden seit dem letzten Aufruf): ein Kontor des Spielers
 * auf einer Insel des Gegners, Soldaten des Spielers länger als 60 Sekunden auf seinem Land, ein bewaffnetes
 * Schiff des Spielers (ohne weiße Flagge) näher als 3 Felder an seinem Kontor. Jede Reizung lässt den Ärger
 * steigen, ohne Reizung sinkt er langsam. Rückgabe: der Grund, falls gerade gereizt.
 */
export function reizung(g: Game, p: Player, dt: number, white: (s: Ship) => boolean): string | null {
  const b = p.brain as Brain | undefined;
  if (!b) return null;
  const mine = g.buildings.filter((o) => o.type === 'kontor' && o.owner === p.id);
  let why: string | null = null;
  if (g.buildings.some((o) => o.type === 'kontor' && o.owner === HUMAN && mine.some((k) => k.island === o.island))) why = 'weil du ein Kontor auf seiner Insel gebaut hast';
  const N = g.size;
  const foe = g.units.some((u) => u.owner === HUMAN && u.ship === undefined && g.own[Math.floor(u.y) * N + Math.floor(u.x)] === p.id);
  if (foe) {
    b.fremdT ??= g.time;
    if (g.time - b.fremdT > 60) why ??= 'weil deine Soldaten auf seinem Land stehen';
  } else b.fremdT = undefined;
  if (!why) for (const s of g.ships) {
    if (s.owner !== HUMAN || !(s.guns ?? 0) || white(s)) continue;
    if (mine.some((k) => gap(k, s.x, s.y) <= 3)) { why = 'weil dein Kriegsschiff vor seinem Kontor kreuzt'; break; }
  }
  if (why) { b.aerger = Math.min(100, (b.aerger ?? 0) + 12 * dt / 5); b.anlass = why; }
  else b.aerger = Math.max(0, (b.aerger ?? 0) - 0.5 * dt / 5);
  return why;
}
// ---------- Suchen im eigenen Land ----------

/** Alle Plätze im eigenen Land durchgehen, die wirklich frei sind; die besten `keep` behalten.
 *  Die genaue Prüfung des Spiels (canPlace) kommt erst beim Bauen – das spart viel Rechenzeit. */
function scan(g: Game, owner: number, c: City, type: BuildingId, score: (x: number, y: number) => number | null, keep: number): Cand[] {
  const best: Cand[] = [];
  const s = BUILDINGS[type].size;
  const [x0, y0, x1, y1] = c.box;
  for (let y = y0; y <= y1 - s + 1; y++) for (let x = x0; x <= x1 - s + 1; x++) {
    if (!fits(g, owner, type, x, y)) continue;
    const v = score(x, y);
    if (v === null || (best.length >= keep && v <= best[best.length - 1].s)) continue;
    let i = best.length;
    while (i > 0 && best[i - 1].s < v) i--;
    best.splice(i, 0, { x, y, s: v, eff: 1 });
    if (best.length > keep) best.pop();
  }
  return best;
}

/** Schnelle Vorprüfung: Grundfläche auf eigenem, freiem Land, Lage am Wasser oder Berg, falls nötig */
function fits(g: Game, owner: number, type: BuildingId, x: number, y: number): boolean {
  const d = BUILDINGS[type], s = d.size, N = g.size;
  if (x < 0 || y < 0 || x + s > N || y + s > N) return false;
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const k = (y + j) * N + x + i, t = g.tiles[k];
    if (t === T.Wasser || t === T.Berg || g.occ[k] || g.roads[k] || g.own[k] !== owner) return false;
  }
  if (d.needs === 'wasser' || d.needs === 'kueste' || d.needs === 'berg') {
    const want = d.needs === 'berg' ? T.Berg : T.Wasser;
    let n = 0;
    for (let i = 0; i < s; i++) {
      if (g.tile(x + i, y - 1) === want) n++;
      if (g.tile(x + i, y + s) === want) n++;
      if (g.tile(x - 1, y + i) === want) n++;
      if (g.tile(x + s, y + i) === want) n++;
    }
    if (n < (want === T.Berg ? 1 : 2)) return false;
  }
  return true;
}

/** Liegt am Gebäude ein Weg? */
function touchesRoad(g: Game, type: BuildingId, x: number, y: number): boolean {
  const s = BUILDINGS[type].size, N = g.size;
  for (let i = 0; i < s; i++) {
    if (y > 0 && g.roads[(y - 1) * N + x + i]) return true;
    if (y + s < N && g.roads[(y + s) * N + x + i]) return true;
    if (x > 0 && g.roads[(y + i) * N + x - 1]) return true;
    if (x + s < N && g.roads[(y + i) * N + x + s]) return true;
  }
  return false;
}

/** Summenbild über ein Rechteck der Karte: danach kostet die Summe eines Teilrechtecks nur einen Schritt */
type Area = (a: number, b: number, e: number, f: number) => number;
function areaSum(N: number, x0: number, y0: number, x1: number, y1: number, val: (x: number, y: number, k: number) => number): Area {
  const W = x1 - x0 + 2, H = y1 - y0 + 2;
  const S = new Float32Array(W * H);
  for (let y = y0; y <= y1; y++) {
    let row = 0;
    for (let x = x0; x <= x1; x++) {
      row += val(x, y, y * N + x);
      S[(y - y0 + 1) * W + (x - x0 + 1)] = S[(y - y0) * W + (x - x0 + 1)] + row;
    }
  }
  return (a, b, e, f) => {
    a = Math.max(a, x0); b = Math.max(b, y0); e = Math.min(e, x1); f = Math.min(f, y1);
    if (e < a || f < b) return 0;
    return S[(f - y0 + 1) * W + (e - x0 + 1)] - S[(b - y0) * W + (e - x0 + 1)] - S[(f - y0 + 1) * W + (a - x0)] + S[(b - y0) * W + (a - x0)];
  };
}

/** Schnelle Schätzung, wie viel Rohstoff um einen Platz liegt (Fischgründe, Wald, freie Weide) –
 *  Felder, die schon gleichartige Betriebe nutzen, zählen weniger. */
function resourceNear(g: Game, c: City, type: BuildingId): (x: number, y: number) => number {
  const d = BUILDINGS[type];
  const res = d.harvest!.res;
  const R = d.work ?? 4, N = g.size;
  const x0 = Math.max(0, c.box[0] - R - 1), y0 = Math.max(0, c.box[1] - R - 1);
  const x1 = Math.min(N - 1, c.box[2] + R + 1), y1 = Math.min(N - 1, c.box[3] + R + 1);
  // wie viele gleichartige Betriebe ein Feld schon mitnutzen
  const W = x1 - x0 + 1;
  const used = new Uint8Array(W * (y1 - y0 + 1));
  for (const o of g.buildings) {
    if (o.island !== c.island || BUILDINGS[o.type].harvest?.res !== res) continue;
    const od = BUILDINGS[o.type], r = od.work ?? 4;
    const ox = o.x + od.size / 2, oy = o.y + od.size / 2;
    for (let y = Math.max(y0, Math.floor(oy - r)); y <= Math.min(y1, Math.ceil(oy + r)); y++)
      for (let x = Math.max(x0, Math.floor(ox - r)); x <= Math.min(x1, Math.ceil(ox + r)); x++)
        if ((x + 0.5 - ox) ** 2 + (y + 0.5 - oy) ** 2 <= r * r) { const i = (y - y0) * W + x - x0; if (used[i] < 250) used[i]++; }
  }
  const sum = areaSum(N, x0, y0, x1, y1, (x, y, k) => {
    if (!g.resOk(res, k)) return 0;
    const v = res === 'fisch' ? g.fishCap[k] : 1;
    return v / (1 + used[(y - y0) * W + x - x0]);
  });
  const half = d.size / 2;
  // Quadrat statt Kreis (etwas größer) – reicht, um die besten Plätze vorzuwählen
  return (x, y) => {
    const cx = x + half, cy = y + half;
    return sum(Math.ceil(cx - R - 0.5), Math.ceil(cy - R - 0.5), Math.floor(cx + R - 0.5), Math.floor(cy + R - 0.5)) * 0.8;
  };
}

// ---------- Wege ----------

/** Wegaufwand für ein Feld: alter (noch nicht angeschlossener) Weg 1, freies Land 2, Wald 5 */
function stepCost(g: Game, k: number): number {
  return g.roads[k] ? 1 : g.tiles[k] === T.Wald ? 5 : 2;
}

/** Das Wegenetz des Kontors: alle eigenen Wegefelder, die über Wege am Kontor hängen, und die Knoten daran
 *  (Kontor und Marktplätze, die an diesem Netz hängen) */
function kernOf(g: Game, c: City): Kern {
  if (c.kern) return c.kern;
  const N = g.size, roads = new Set<number>(), stack: number[] = [];
  const add = (k: number) => { if (g.roads[k] && g.own[k] === c.owner && !roads.has(k)) { roads.add(k); stack.push(k); } };
  for (const [x, y] of g.ring(c.kontor)) if (g.inMap(x, y)) add(y * N + x);
  while (stack.length) {
    const k = stack.pop()!, x = k % N, y = (k / N) | 0;
    if (x > 0) add(k - 1);
    if (x < N - 1) add(k + 1);
    if (y > 0) add(k - N);
    if (y < N - 1) add(k + N);
  }
  const hubs = new Set<number>([c.kontor.id]);
  for (const m of c.claim) if (m !== c.kontor && touches(g, m, roads, hubs)) hubs.add(m.id);
  return (c.kern = { roads, hubs });
}

/** Grenzt das Gebäude an eines dieser Wegefelder oder an einen dieser Knoten? */
function touches(g: Game, b: Building, roads: Set<number>, hubs: Set<number>): boolean {
  const N = g.size;
  for (const [x, y] of g.ring(b)) {
    if (!g.inMap(x, y)) continue;
    const k = y * N + x;
    if (roads.has(k) || (g.occ[k] > 0 && hubs.has(g.occ[k]))) return true;
  }
  return false;
}

/** Hängt das Gebäude am Wegenetz des Kontors? */
function hooked(g: Game, c: City, b: Building): boolean {
  const kern = kernOf(g, c);
  return touches(g, b, kern.roads, kern.hubs);
}

/** Aufwand bis zum Wegenetz des Kontors für jedes Feld im eigenen Land (Suche mit Eimern, weil die
 *  Kosten kleine ganze Zahlen sind). 0 = Weg am Netz oder Kontor/angeschlossener Marktplatz selbst.
 *  grid = nur über Felder des Wegerasters (für Straßen zu neuen Wohnhäusern). */
function netOf(g: Game, p: Player, c: City, grid = false): Net {
  const hit = grid ? c.gridNet : c.net;
  if (hit) return hit;
  const [x0, y0, x1, y1] = c.box;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, N = g.size;
  const cost = new Int32Array(w * h).fill(INF);
  const from = new Int32Array(w * h).fill(-1);
  const buckets: number[][] = [[]];
  const kern = kernOf(g, c);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const k = y * N + x;
    // Anschluss: Wege am Netz des Kontors oder Kontor/Marktplatz selbst (andere Netze zählen nicht)
    if (kern.roads.has(k) || (g.occ[k] > 0 && kern.hubs.has(g.occ[k]))) { const i = (y - y0) * w + x - x0; cost[i] = 0; buckets[0].push(i); }
  }
  for (let v = 0; v < buckets.length; v++) {
    const list = buckets[v];
    if (!list) continue;
    for (let q = 0; q < list.length; q++) {
      const i = list[q];
      if (cost[i] !== v) continue;
      const x = x0 + (i % w), y = y0 + ((i / w) | 0);
      for (let dir = 0; dir < 4; dir++) {
        const nx = x + (dir === 0 ? 1 : dir === 1 ? -1 : 0), ny = y + (dir === 2 ? 1 : dir === 3 ? -1 : 0);
        if (nx < x0 || ny < y0 || nx > x1 || ny > y1) continue;
        const nk = ny * N + nx, t = g.tiles[nk];
        if (g.own[nk] !== p.id || g.occ[nk] || t === T.Wasser || t === T.Berg) continue;
        if (grid && !g.roads[nk] && !onGrid(c, nx, ny)) continue;
        const ni = (ny - y0) * w + nx - x0, nv = v + stepCost(g, nk);
        if (nv < cost[ni]) { cost[ni] = nv; from[ni] = i; (buckets[nv] ??= []).push(ni); }
      }
    }
  }
  const net = { cost, from, x0, y0, w, h };
  if (grid) c.gridNet = net; else c.net = net;
  return net;
}

/** Günstigster Anschluss eines Bauplatzes: kleinster Aufwand rund um die Grundfläche */
function ringCost(net: Net, type: BuildingId, x: number, y: number): number {
  const s = BUILDINGS[type].size;
  let best = INF;
  const at = (tx: number, ty: number) => {
    const ix = tx - net.x0, iy = ty - net.y0;
    if (ix < 0 || iy < 0 || ix >= net.w || iy >= net.h) return;
    const v = net.cost[iy * net.w + ix];
    if (v < best) best = v;
  };
  for (let i = 0; i < s; i++) { at(x + i, y - 1); at(x + i, y + s); at(x - 1, y + i); at(x + s, y + i); }
  return best;
}

/** Anschlussstraße vom Gebäude (Betrieb oder Marktplatz) zum Wegenetz des Kontors bauen (über eigenes Land) */
function connect(g: Game, p: Player, c: City, b: Building): boolean {
  dirty(c); // das neue Gebäude versperrt Felder: frisch rechnen
  if (hooked(g, c, b)) return true;
  const net = netOf(g, p, c);
  const s = BUILDINGS[b.type].size;
  let bi = -1, bv = INF;
  const at = (tx: number, ty: number) => {
    const ix = tx - net.x0, iy = ty - net.y0;
    if (ix < 0 || iy < 0 || ix >= net.w || iy >= net.h) return;
    const i = iy * net.w + ix;
    if (net.cost[i] < bv) { bv = net.cost[i]; bi = i; }
  };
  for (let i = 0; i < s; i++) { at(b.x + i, b.y - 1); at(b.x + i, b.y + s); at(b.x - 1, b.y + i); at(b.x + s, b.y + i); }
  if (bi < 0 || bv >= INF) return false;
  const cells: [number, number][] = [];
  for (let i = bi; i >= 0 && net.cost[i] > 0; i = net.from[i]) {
    const x = net.x0 + (i % net.w), y = net.y0 + ((i / net.w) | 0);
    if (!g.roads[y * g.size + x]) cells.push([x, y]);
  }
  if (!cells.length || cells.length * (BUILDINGS.weg.cost.taler ?? 0) > p.money) return false;
  const ok = g.placeRoads(cells, p.id) === cells.length;
  dirty(c);
  return ok;
}

/** Betriebe und Marktplätze, die nicht am Wegenetz des Kontors hängen (z. B. weil ein Weg fehlte oder
 *  der Marktplatz ein eigenes Netz hat), nachträglich anschließen – einen je Runde */
function relink(g: Game, p: Player, c: City): boolean {
  const retry = memo(g).retry;
  for (const o of [...c.prod, ...c.claim]) {
    if (o === c.kontor || g.time < (retry.get(o.id) ?? 0) || hooked(g, c, o)) continue;
    if (connect(g, p, c, o)) { retry.delete(o.id); return true; }
    retry.set(o.id, g.time + 60);
  }
  return false;
}

/** Wie viele Felder der Grundfläche auf dem Wegeraster liegen (dort sollen später Straßen hin) */
function gridTiles(c: City, type: BuildingId, x: number, y: number): number {
  const s = BUILDINGS[type].size;
  let n = 0;
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) if (onGrid(c, x + i, y + j)) n++;
  return n;
}

/** Liegt das Feld auf dem Wegeraster (alle GRID Felder, am Kontor ausgerichtet)? */
function onGrid(c: City, x: number, y: number): boolean {
  return (((x - c.gx) % GRID) + GRID) % GRID === 0 || (((y - c.gy) % GRID) + GRID) % GRID === 0;
}

/** Gleich nach der Gründung: Wegeraster im Kern ums Kontor (12 Felder), auch durch Wald */
function coreRoads(g: Game, p: Player, c: City): boolean {
  const N = g.size;
  const cells: [number, number, number][] = [];
  const [x0, y0, x1, y1] = c.box;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const k = y * N + x, t = g.tiles[k];
    if (g.own[k] !== p.id || t === T.Wasser || t === T.Berg || g.occ[k] || g.roads[k] || !onGrid(c, x, y)) continue;
    const dd = Math.hypot(x + 0.5 - c.kx, y + 0.5 - c.ky);
    if (dd <= CORE) cells.push([x, y, dd]);
  }
  cells.sort((a, b) => a[2] - b[2]); // innen zuerst (falls das Geld nicht für alles reicht)
  return g.placeRoads(cells.map(([x, y]) => [x, y] as [number, number]), p.id) > 0;
}

/** Straße zum Bauplatz eines Wohnhauses: das Wegeraster vom angeschlossenen Netz bis an den Platz
 *  verlängern – höchstens 12 neue Felder (Wald nur, wenn es nicht anders geht) und nur mit genug
 *  Geld (über 2 500 Talern). So wächst das Netz Stück für Stück mit der Stadt (Wegefelder gestaffelt). */
function streetTo(g: Game, p: Player, c: City, site: { x: number; y: number }): boolean {
  const b = p.brain as Brain;
  if (p.money <= RESERVE || g.time < (b.wait?.raster ?? 0)) return false;
  const net = netOf(g, p, c, true);
  let bi = -1, bv = INF;
  for (let i = 0; i < 2; i++) for (const [tx, ty] of [[site.x + i, site.y - 1], [site.x + i, site.y + 2], [site.x - 1, site.y + i], [site.x + 2, site.y + i]]) {
    const ix = tx - net.x0, iy = ty - net.y0;
    if (ix < 0 || iy < 0 || ix >= net.w || iy >= net.h) continue;
    const k = iy * net.w + ix;
    if (net.cost[k] < bv) { bv = net.cost[k]; bi = k; }
  }
  const cells: [number, number][] = [];
  for (let i = bi; i >= 0 && bv < INF && net.cost[i] > 0; i = net.from[i]) {
    const x = net.x0 + (i % net.w), y = net.y0 + ((i / net.w) | 0);
    if (!g.roads[y * g.size + x]) cells.push([x, y]);
  }
  if (!cells.length || cells.length > 12) { (b.wait ??= {}).raster = g.time + 30; return false; }
  const ok = g.placeRoads(cells, p.id) > 0;
  dirty(c);
  return ok;
}

/** Restladung des Schiffs ins Kontor holen, sobald dort Platz ist */
function unloadRest(g: Game, p: Player, kontor: Building) {
  const b = p.brain as Brain;
  for (const s of g.ships) {
    // nicht das Schiff, das gerade für eine neue Insel beladen wird, und keine Schiffe auf Handelsroute
    if (s.owner !== p.id || s.path.length || s.id === b.erw?.ship || route(g, s) || !s.slots.some((sl) => sl.g && sl.n > 0)) continue;
    if (g.shipDock(s) === kontor) g.unloadAll(s);
  }
}
