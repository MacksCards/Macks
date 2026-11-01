// Alle Spielwerte an einem Ort: Waren, Gebäude, Bevölkerungsstufen, Schiffe, Preise.
// Kosten, Freischaltungen und Reichweiten orientieren sich an docs/1602-INHALT.md
// (Ziegel heißen hier „Steine“ und kommen direkt aus dem Steinbruch).
import type { Pflanze } from './world';

export type GoodId =
  | 'holz' | 'stein' | 'werkzeug' | 'nahrung'
  | 'erz' | 'eisen' | 'gold'
  | 'getreide' | 'mehl' | 'schweine'
  | 'wolle' | 'stoff' | 'kleidung'
  | 'zuckerrohr' | 'alkohol' | 'tabak' | 'tabakwaren' | 'gewuerze' | 'kakao' | 'schmuck'
  | 'schwerter' | 'musketen' | 'kanonen';

export interface GoodDef { id: GoodId; name: string; icon: string }

export const GOODS: GoodDef[] = [
  { id: 'holz', name: 'Holz', icon: '🪵' },
  { id: 'stein', name: 'Steine', icon: '🪨' },
  { id: 'werkzeug', name: 'Werkzeug', icon: '🔧' },
  { id: 'nahrung', name: 'Nahrung', icon: '🍖' },
  { id: 'stoff', name: 'Stoffe', icon: '🧵' },
  { id: 'alkohol', name: 'Alkohol', icon: '🍷' },
  { id: 'tabakwaren', name: 'Tabakwaren', icon: '🚬' },
  { id: 'gewuerze', name: 'Gewürze', icon: '🌶️' },
  { id: 'kakao', name: 'Kakao', icon: '🍫' },
  { id: 'kleidung', name: 'Kleidung', icon: '👘' },
  { id: 'schmuck', name: 'Schmuck', icon: '💍' },
  { id: 'wolle', name: 'Wolle', icon: '🧶' },
  { id: 'getreide', name: 'Getreide', icon: '🌾' },
  { id: 'mehl', name: 'Mehl', icon: '🥣' },
  { id: 'schweine', name: 'Schweine', icon: '🐖' },
  { id: 'zuckerrohr', name: 'Zuckerrohr', icon: '🎋' },
  { id: 'tabak', name: 'Tabak', icon: '🍂' },
  { id: 'erz', name: 'Erz', icon: '🪨' },
  { id: 'eisen', name: 'Eisen', icon: '⚙️' },
  { id: 'gold', name: 'Gold', icon: '🥇' },
  { id: 'schwerter', name: 'Schwerter', icon: '🗡️' },
  { id: 'musketen', name: 'Musketen', icon: '🔫' },
  { id: 'kanonen', name: 'Kanonen', icon: '💣' },
];
export const GOOD: Record<GoodId, GoodDef> = Object.fromEntries(GOODS.map((g) => [g.id, g])) as Record<GoodId, GoodDef>;

export type BuildingId =
  | 'weg' | 'steinweg' | 'kontor' | 'markt' | 'haus'
  | 'kapelle' | 'wirtshaus' | 'schule' | 'kirche' | 'badehaus' | 'hochschule' | 'theater'
  | 'holzfaeller' | 'fischer' | 'jagdhuette' | 'schweinezucht' | 'fleischerei' | 'getreidefarm' | 'muehle' | 'baeckerei'
  | 'schaffarm' | 'steinbruch' | 'erzmine' | 'tiefeErzmine' | 'goldmine'
  | 'baumwollplantage' | 'tabakplantage' | 'zuckerrohrplantage' | 'weingut' | 'gewuerzplantage' | 'kakaoplantage'
  | 'weberei' | 'schneiderei' | 'rumbrennerei' | 'brauerei' | 'tabakwaren' | 'erzschmelze' | 'schmiede'
  | 'schwertschmiede' | 'buechsenmacher' | 'kanonengiesserei' | 'goldschmied'
  | 'werft' | 'grosswerft'
  | 'palisade' | 'holztor' | 'steinmauer' | 'steintor_klein' | 'steintor' | 'holzturm' | 'wachturm' | 'burg' | 'grosseburg' | 'festung' | 'triumphbogen'
  // vorbereitet (geplant): erscheinen erst, wenn ihr Spielteil fertig ist
  | 'feuerwehr' | 'arzt' | 'galgen' | 'denkmal' | 'zierbaum' | 'palast' | 'kathedrale' | 'huette' | 'haeuptling';

export type Category = 'wege' | 'wohnen' | 'nahrung' | 'rohstoffe' | 'plantagen' | 'werkstatt' | 'oeffentlich' | 'hafen' | 'militaer';

export interface Cost { taler?: number; holz?: number; werkzeug?: number; stein?: number; kanonen?: number }
/** Baumaterial-Waren, die beim Bauen aus dem Inselllager genommen werden */
export const BUILD_GOODS = ['holz', 'werkzeug', 'stein', 'kanonen'] as const;

export type Res = 'baum' | 'fisch' | 'wild' | 'weide' | 'feld';

export interface BuildingDef {
  id: BuildingId;
  name: string;
  icon: string;
  category: Category | null; // null = nicht baubar (Kontor)
  size: number; // quadratische Grundfläche in Kacheln
  cost: Cost;
  upkeep: number; // Taler pro Minute
  desc: string;
  /** Einflussradius (Kacheln) – Bauradius (Kontor/Markt) oder Versorgung (Kapelle ...) */
  radius?: number;
  /** Produktion: Sekunden pro Zyklus, Eingang -> Ausgang (amount Stück, Standard 1) */
  prod?: { time: number; input?: Partial<Record<GoodId, number>>; output: GoodId; amount?: number };
  /** Standortbedingung */
  needs?: 'wald' | 'wasser' | 'berg' | 'kueste';
  /** Vorkommen im Berg (nur Inseln mit Erz bzw. Gold) */
  deposit?: 'erz' | 'tiefErz' | 'gold';
  /** Pflanze: wächst nur auf Inseln, die dafür fruchtbar sind (Ertrag × Fruchtbarkeit) */
  pflanze?: Pflanze;
  storage?: number; // zusätzliche Lagerkapazität je Ware
  /** Rohstoff aus der Umgebung: Art und Menge je Arbeitsgang (verbraucht sich, wächst nach) */
  harvest?: { res: Res; per: number };
  /** Arbeitsradius (Felder), in dem der Betrieb Rohstoffe findet */
  work?: number;
  /** Eigenes kleines Lager des Betriebs (Tonnen), bevor ein Marktkarren abholt */
  stock?: number;
  /** Freischaltung wie im Vorbild: n Einwohner mindestens der Stufe tier auf einer Insel */
  unlock?: { tier: number; n: number };
  /** Wege/Mauern werden als Strecke gebaut: Start und Ziel antippen, dann ✓ */
  paint?: boolean;
  /** Trefferpunkte (Standard: nach Größe) */
  hp?: number;
  /** Tor: eigene Truppen und Marktkarren gehen hindurch, fremde nicht; darf auf einem eigenen Weg stehen */
  gate?: boolean;
  /**
   * Vorbereitet: Werte stehen schon fest, das Gebäude bleibt aber unsichtbar und unbaubar,
   * bis sein Spielteil (src/systems.ts) es als „bereit“ meldet.
   */
  geplant?: boolean;
  /** schießt selbst auf Feinde in Reichweite */
  tower?: { str: number; interval: number; range: number };
  /** bildet Soldaten aus: gleichzeitig, Sekunden je Soldat */
  trains?: { slots: number; time: number };
  /** nur nach einem Sieg baubar */
  victory?: boolean;
}

const S = (n: number) => ({ tier: 1, n });
const B = (n: number) => ({ tier: 2, n });
const K = (n: number) => ({ tier: 3, n });
const P = (n: number) => ({ tier: 0, n });
const A = (n: number) => ({ tier: 4, n });

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  // ---------- Wege ----------
  weg: { id: 'weg', name: 'Feldweg', icon: '🟫', category: 'wege', size: 1, cost: { taler: 5 }, upkeep: 0, paint: true,
    desc: 'Verbindet Betriebe mit Kontor oder Marktplatz. Tippe Start und Ziel, dann ✓.' },
  steinweg: { id: 'steinweg', name: 'Pflasterweg', icon: '⬜', category: 'wege', size: 1, cost: { taler: 5, stein: 1 }, upkeep: 0, paint: true, unlock: S(15),
    desc: 'Gepflasterter Weg aus Steinen – Marktkarren kommen darauf schneller voran.' },
  // ---------- Lager & Wohnen ----------
  kontor: { id: 'kontor', name: 'Kontor', icon: '⚓', category: null, size: 3, cost: { taler: 100, holz: 6, werkzeug: 3 }, upkeep: 15, radius: 16, storage: 30, work: 16,
    desc: 'Lager und Hafen einer Insel. Wird vom Schiff aus an der Küste gebaut und beansprucht das Land ringsum. Kann ausgebaut werden (mehr Lagerplatz).' },
  markt: { id: 'markt', name: 'Marktplatz', icon: '🏪', category: 'oeffentlich', size: 3, cost: { taler: 200, holz: 10, werkzeug: 4 }, upkeep: 10, radius: 15, storage: 10, work: 15,
    desc: 'Erweitert dein Gebiet und das Lager. Wohnhäuser brauchen einen Markt in Reichweite.' },
  haus: { id: 'haus', name: 'Wohnhaus', icon: '🏠', category: 'wohnen', size: 2, cost: { holz: 3 }, upkeep: 0,
    desc: 'Hier ziehen Pioniere ein. Sind ihre Bedürfnisse erfüllt, steigt das Haus Stufe um Stufe bis zu den Aristokraten auf.' },
  // ---------- Öffentliche Gebäude ----------
  kapelle: { id: 'kapelle', name: 'Kapelle', icon: '⛪', category: 'oeffentlich', size: 2, cost: { taler: 100, holz: 5, werkzeug: 2 }, upkeep: 5, radius: 9,
    desc: 'Glaube für Pioniere und Siedler. Nötig, damit Pioniere zu Siedlern werden.' },
  wirtshaus: { id: 'wirtshaus', name: 'Wirtshaus', icon: '🍻', category: 'oeffentlich', size: 2, cost: { taler: 250, holz: 4, werkzeug: 3, stein: 6 }, upkeep: 15, radius: 12, unlock: S(50),
    desc: 'Geselligkeit. Siedler brauchen es, um zu Bürgern zu werden.' },
  schule: { id: 'schule', name: 'Schule', icon: '🏫', category: 'oeffentlich', size: 2, cost: { taler: 490, holz: 4, werkzeug: 4, stein: 9 }, upkeep: 30, radius: 12, unlock: S(100),
    desc: 'Bildung. Siedler brauchen eine Schule, um zu Bürgern zu werden.' },
  kirche: { id: 'kirche', name: 'Kirche', icon: '⛪', category: 'oeffentlich', size: 3, cost: { taler: 1600, holz: 7, werkzeug: 7, stein: 25 }, upkeep: 50, radius: 20, unlock: B(150),
    desc: 'Große Kirche mit weiter Reichweite (ersetzt die Kapelle). Bürger brauchen sie, um Kaufleute zu werden.' },
  badehaus: { id: 'badehaus', name: 'Badehaus', icon: '🛁', category: 'oeffentlich', size: 3, cost: { taler: 1200, holz: 5, werkzeug: 6, stein: 19 }, upkeep: 60, radius: 19, unlock: B(210),
    desc: 'Hygiene. Bürger brauchen ein Badehaus, um Kaufleute zu werden.' },
  hochschule: { id: 'hochschule', name: 'Hochschule', icon: '🎓', category: 'oeffentlich', size: 3, cost: { taler: 750, holz: 5, werkzeug: 6, stein: 19 }, upkeep: 60, radius: 14, unlock: K(250),
    desc: 'Höhere Bildung. Kaufleute brauchen sie, um Aristokraten zu werden.' },
  theater: { id: 'theater', name: 'Theater', icon: '🎭', category: 'oeffentlich', size: 3, cost: { taler: 1200, holz: 5, werkzeug: 2, stein: 19 }, upkeep: 80, radius: 19, unlock: K(300),
    desc: 'Kultur. Kaufleute brauchen ein Theater, um Aristokraten zu werden.' },
  // ---------- Nahrung ----------
  fischer: { id: 'fischer', name: 'Fischerhütte', icon: '🎣', category: 'nahrung', size: 2, cost: { taler: 100, holz: 5, werkzeug: 3 }, upkeep: 5,
    stock: 4, work: 4, harvest: { res: 'fisch', per: 1 }, prod: { time: 12, output: 'nahrung' }, needs: 'wasser',
    desc: 'Fängt Fisch als Nahrung. Muss direkt am Wasser stehen – je mehr Fischgründe, desto besser.' },
  jagdhuette: { id: 'jagdhuette', name: 'Jagdhütte', icon: '🏹', category: 'nahrung', size: 2, cost: { taler: 50, holz: 2, werkzeug: 2 }, upkeep: 5,
    stock: 3, work: 7, harvest: { res: 'wild', per: 1 }, prod: { time: 16, output: 'nahrung' }, needs: 'wald',
    desc: 'Jäger erlegen Wild im Wald. Günstig, aber das Wild muss nachwachsen.' },
  schweinezucht: { id: 'schweinezucht', name: 'Schweinezucht', icon: '🐖', category: 'nahrung', size: 3, cost: { taler: 100, holz: 4, werkzeug: 1 }, upkeep: 5, unlock: P(30),
    stock: 4, work: 4, harvest: { res: 'weide', per: 3 }, prod: { time: 14, output: 'schweine' }, desc: 'Züchtet Schweine auf der Weide für die Fleischerei.' },
  fleischerei: { id: 'fleischerei', name: 'Fleischerei', icon: '🔪', category: 'nahrung', size: 2, cost: { taler: 150, holz: 4, werkzeug: 3 }, upkeep: 5, unlock: P(30),
    stock: 4, prod: { time: 10, input: { schweine: 1 }, output: 'nahrung', amount: 2 }, desc: 'Macht aus einem Schwein zwei Ladungen Nahrung.' },
  getreidefarm: { id: 'getreidefarm', name: 'Getreidefarm', icon: '🌾', category: 'nahrung', size: 3, cost: { taler: 100, holz: 5, werkzeug: 2 }, upkeep: 5, unlock: S(75),
    stock: 6, work: 3, harvest: { res: 'feld', per: 1 }, prod: { time: 10, output: 'getreide' }, desc: 'Baut Getreide auf den Feldern ringsum an – für Mühle oder Brauerei.' },
  muehle: { id: 'muehle', name: 'Windmühle', icon: '🌬️', category: 'nahrung', size: 2, cost: { taler: 100, holz: 6, werkzeug: 3 }, upkeep: 5, unlock: S(75),
    stock: 6, prod: { time: 10, input: { getreide: 2 }, output: 'mehl' }, desc: 'Mahlt zwei Getreide zu einem Sack Mehl.' },
  baeckerei: { id: 'baeckerei', name: 'Bäckerei', icon: '🥖', category: 'nahrung', size: 2, cost: { taler: 150, holz: 6, werkzeug: 2 }, upkeep: 5, unlock: S(75),
    stock: 4, prod: { time: 8, input: { mehl: 1 }, output: 'nahrung', amount: 2 }, desc: 'Backt aus Mehl Brot – sehr ergiebige Nahrung.' },
  // ---------- Rohstoffe ----------
  holzfaeller: { id: 'holzfaeller', name: 'Holzfäller', icon: '🪓', category: 'rohstoffe', size: 2, cost: { taler: 50, werkzeug: 2 }, upkeep: 5,
    stock: 10, work: 4, harvest: { res: 'baum', per: 1 }, prod: { time: 12, output: 'holz' }, needs: 'wald',
    desc: 'Fällt reife Bäume im Umkreis; neue wachsen nach. Je mehr Wald, desto besser.' },
  steinbruch: { id: 'steinbruch', name: 'Steinbruch', icon: '⛰️', category: 'rohstoffe', size: 2, cost: { taler: 150, holz: 2, werkzeug: 6 }, upkeep: 5, unlock: S(15),
    stock: 8, prod: { time: 12, output: 'stein' }, needs: 'berg', desc: 'Bricht Steine aus dem Berg – Baustoff für Pflasterwege, Mauern und große Gebäude.' },
  schaffarm: { id: 'schaffarm', name: 'Schaffarm', icon: '🐑', category: 'rohstoffe', size: 3, cost: { taler: 200, holz: 4, werkzeug: 2 }, upkeep: 5,
    stock: 8, work: 4, harvest: { res: 'weide', per: 4 }, prod: { time: 16, output: 'wolle' }, desc: 'Schafe grasen ringsum und liefern Wolle für die Weberei.' },
  erzmine: { id: 'erzmine', name: 'Erzmine', icon: '⛏️', category: 'rohstoffe', size: 2, cost: { taler: 1000, holz: 20, werkzeug: 10, stein: 5 }, upkeep: 60, unlock: S(120),
    stock: 4, prod: { time: 18, output: 'erz' }, needs: 'berg', deposit: 'erz', desc: 'Fördert Erz – nur am Berg einer Insel mit Erzvorkommen. Das Vorkommen geht irgendwann zur Neige.' },
  tiefeErzmine: { id: 'tiefeErzmine', name: 'Tiefe Erzmine', icon: '⛏️', category: 'rohstoffe', size: 2, cost: { taler: 1800, holz: 30, werkzeug: 15, stein: 7 }, upkeep: 60, unlock: K(400),
    stock: 4, prod: { time: 18, output: 'erz' }, needs: 'berg', deposit: 'tiefErz', desc: 'Gräbt tief in einen Erz-Berg – auch wenn das Vorkommen oben schon erschöpft ist. Liefert dauerhaft Erz.' },
  goldmine: { id: 'goldmine', name: 'Goldmine', icon: '🥇', category: 'rohstoffe', size: 2, cost: { taler: 1000, holz: 20, werkzeug: 10, stein: 5 }, upkeep: 60, unlock: B(150),
    stock: 4, prod: { time: 30, output: 'gold' }, needs: 'berg', deposit: 'gold', desc: 'Fördert Gold – nur auf Inseln mit Goldvorkommen (selten, eher kleine Inseln).' },
  // ---------- Plantagen (nur auf fruchtbaren Inseln) ----------
  tabakplantage: { id: 'tabakplantage', name: 'Tabakplantage', icon: '🍂', category: 'plantagen', size: 3, cost: { taler: 300, holz: 3, werkzeug: 2, stein: 8 }, upkeep: 35, unlock: S(40),
    stock: 6, work: 3, harvest: { res: 'feld', per: 1 }, pflanze: 'tabak', prod: { time: 14, output: 'tabak' }, desc: 'Tabak wächst nur, wo die Insel fruchtbar dafür ist (Norden).' },
  zuckerrohrplantage: { id: 'zuckerrohrplantage', name: 'Zuckerrohrplantage', icon: '🎋', category: 'plantagen', size: 3, cost: { taler: 300, holz: 3, werkzeug: 2, stein: 8 }, upkeep: 25, unlock: S(40),
    stock: 6, work: 3, harvest: { res: 'feld', per: 1 }, pflanze: 'zuckerrohr', prod: { time: 12, output: 'zuckerrohr' }, desc: 'Zuckerrohr für die Rumbrennerei – nur auf fruchtbaren Inseln.' },
  weingut: { id: 'weingut', name: 'Weingut', icon: '🍇', category: 'plantagen', size: 3, cost: { taler: 300, holz: 3, werkzeug: 2, stein: 8 }, upkeep: 35, unlock: S(40),
    stock: 6, work: 3, harvest: { res: 'feld', per: 1 }, pflanze: 'wein', prod: { time: 22, output: 'alkohol' }, desc: 'Weinberge mit Kelterei: liefert direkt Alkohol – nur auf fruchtbaren Inseln.' },
  gewuerzplantage: { id: 'gewuerzplantage', name: 'Gewürzplantage', icon: '🌶️', category: 'plantagen', size: 3, cost: { taler: 300, holz: 3, werkzeug: 2, stein: 8 }, upkeep: 35, unlock: S(40),
    stock: 4, work: 3, harvest: { res: 'feld', per: 1 }, pflanze: 'gewuerze', prod: { time: 20, output: 'gewuerze' }, desc: 'Gewürze für Bürger und höher – wachsen eher im Süden.' },
  kakaoplantage: { id: 'kakaoplantage', name: 'Kakaoplantage', icon: '🍫', category: 'plantagen', size: 3, cost: { taler: 300, holz: 3, werkzeug: 2, stein: 8 }, upkeep: 35, unlock: B(200),
    stock: 6, work: 3, harvest: { res: 'feld', per: 1 }, pflanze: 'kakao', prod: { time: 20, output: 'kakao' }, desc: 'Kakao für Kaufleute und Aristokraten – wächst im Süden.' },
  baumwollplantage: { id: 'baumwollplantage', name: 'Baumwollplantage', icon: '☁️', category: 'plantagen', size: 3, cost: { taler: 200, holz: 3, werkzeug: 2, stein: 6 }, upkeep: 25, unlock: B(200),
    stock: 9, work: 3, harvest: { res: 'feld', per: 1 }, pflanze: 'baumwolle', prod: { time: 10, output: 'wolle' }, desc: 'Baumwolle liefert mehr Wolle als Schafe – nur auf fruchtbaren Inseln.' },
  // ---------- Werkstätten ----------
  weberei: { id: 'weberei', name: 'Weberei', icon: '🪡', category: 'werkstatt', size: 2, cost: { taler: 200, holz: 6, werkzeug: 3 }, upkeep: 10,
    stock: 4, prod: { time: 12, input: { wolle: 2 }, output: 'stoff' }, desc: 'Webt aus zwei Wolle einen Ballen Stoff.' },
  schneiderei: { id: 'schneiderei', name: 'Schneiderei', icon: '👘', category: 'werkstatt', size: 2, cost: { taler: 150, holz: 6, werkzeug: 3, stein: 2 }, upkeep: 10, unlock: B(200),
    stock: 4, prod: { time: 12, input: { stoff: 1 }, output: 'kleidung' }, desc: 'Näht aus Stoff feine Kleidung für Aristokraten.' },
  rumbrennerei: { id: 'rumbrennerei', name: 'Rumbrennerei', icon: '🥃', category: 'werkstatt', size: 2, cost: { taler: 200, holz: 2, werkzeug: 3, stein: 5 }, upkeep: 25, unlock: S(40),
    stock: 4, prod: { time: 12, input: { zuckerrohr: 2 }, output: 'alkohol' }, desc: 'Brennt aus Zuckerrohr Alkohol.' },
  brauerei: { id: 'brauerei', name: 'Brauerei', icon: '🍺', category: 'werkstatt', size: 2, cost: { taler: 250, holz: 4, werkzeug: 2, stein: 3 }, upkeep: 15, unlock: S(75),
    stock: 4, prod: { time: 16, input: { getreide: 2 }, output: 'alkohol' }, desc: 'Braut aus Getreide Bier (zählt als Alkohol) – für Inseln ohne Wein und Zuckerrohr.' },
  tabakwaren: { id: 'tabakwaren', name: 'Tabakwarenmanufaktur', icon: '🚬', category: 'werkstatt', size: 2, cost: { taler: 200, holz: 2, werkzeug: 3, stein: 5 }, upkeep: 20, unlock: S(40),
    stock: 4, prod: { time: 14, input: { tabak: 2 }, output: 'tabakwaren' }, desc: 'Dreht aus Tabak Zigarren und Pfeifentabak.' },
  erzschmelze: { id: 'erzschmelze', name: 'Erzschmelze', icon: '🔥', category: 'werkstatt', size: 2, cost: { taler: 200, holz: 1, werkzeug: 3, stein: 4 }, upkeep: 25, unlock: S(120),
    stock: 5, prod: { time: 14, input: { erz: 1, holz: 1 }, output: 'eisen' }, desc: 'Schmilzt Erz mit Holz zu Eisen.' },
  schmiede: { id: 'schmiede', name: 'Werkzeugschmiede', icon: '🔨', category: 'werkstatt', size: 2, cost: { taler: 150, holz: 2, werkzeug: 3, stein: 5 }, upkeep: 25, unlock: S(100),
    stock: 4, prod: { time: 14, input: { eisen: 1 }, output: 'werkzeug', amount: 2 }, desc: 'Schmiedet aus Eisen Werkzeug (1 Eisen → 2 Werkzeug).' },
  schwertschmiede: { id: 'schwertschmiede', name: 'Schwertschmiede', icon: '🗡️', category: 'werkstatt', size: 2, cost: { taler: 450, holz: 4, werkzeug: 5, stein: 10 }, upkeep: 30, unlock: S(200),
    stock: 4, prod: { time: 20, input: { eisen: 1 }, output: 'schwerter' }, desc: 'Schmiedet Schwerter für Infanterie und Reiter.' },
  buechsenmacher: { id: 'buechsenmacher', name: 'Büchsenmacher', icon: '🔫', category: 'werkstatt', size: 2, cost: { taler: 600, holz: 4, werkzeug: 9, stein: 10 }, upkeep: 45, unlock: K(400),
    stock: 4, prod: { time: 24, input: { eisen: 2, holz: 1 }, output: 'musketen' }, desc: 'Baut Musketen für Musketiere.' },
  // ab 400 Bürgern – gleichzeitig mit dem Kanonier, damit man Kanonen nicht nur kaufen muss
  kanonengiesserei: { id: 'kanonengiesserei', name: 'Kanonengießerei', icon: '💣', category: 'werkstatt', size: 3, cost: { taler: 750, holz: 5, werkzeug: 6, stein: 15 }, upkeep: 60, unlock: B(400),
    stock: 4, prod: { time: 28, input: { eisen: 1, holz: 1 }, output: 'kanonen' }, desc: 'Gießt Kanonen für Kriegsschiffe, Wachtürme und Kanoniere.' },
  goldschmied: { id: 'goldschmied', name: 'Goldschmied', icon: '💍', category: 'werkstatt', size: 2, cost: { taler: 1500, holz: 2, werkzeug: 7, stein: 10 }, upkeep: 45, unlock: K(250),
    stock: 4, prod: { time: 20, input: { gold: 2 }, output: 'schmuck', amount: 4 }, desc: 'Fertigt aus Gold Schmuck für Aristokraten (2 Gold → 4 Schmuck).' },
  // ---------- Hafen ----------
  werft: { id: 'werft', name: 'Kleine Werft', icon: '🛠️', category: 'hafen', size: 3, cost: { taler: 1100, holz: 12, werkzeug: 8, stein: 3 }, upkeep: 20, unlock: S(120), needs: 'kueste',
    desc: 'Baut kleine Handels- und Kriegsschiffe. Muss an der Küste stehen.' },
  grosswerft: { id: 'grosswerft', name: 'Große Werft', icon: '⚓', category: 'hafen', size: 3, cost: { taler: 2800, holz: 25, werkzeug: 10, stein: 63 }, upkeep: 30, unlock: K(500), needs: 'kueste',
    desc: 'Baut auch große Handels- und Kriegsschiffe – schneller als die kleine Werft.' },
  // ---------- Militär ----------
  palisade: { id: 'palisade', name: 'Palisade', icon: '🪵', category: 'militaer', size: 1, cost: { taler: 10, holz: 2 }, upkeep: 0, unlock: S(30), paint: true, hp: 20,
    desc: 'Holzzaun zur Verteidigung. Tippe Start und Ziel, dann ✓. Feinde müssen ihn erst zerschlagen.' },
  holztor: { id: 'holztor', name: 'Holztor', icon: '🚪', category: 'militaer', size: 1, cost: { taler: 12, holz: 2 }, upkeep: 0, unlock: S(30), hp: 20, gate: true,
    desc: 'Tor in der Palisade: deine Leute und Karren gehen durch, Feinde nicht. Kann direkt auf einen Weg gesetzt werden.' },
  steinmauer: { id: 'steinmauer', name: 'Steinmauer', icon: '🧱', category: 'militaer', size: 1, cost: { taler: 18, stein: 2 }, upkeep: 0, unlock: S(200), paint: true, hp: 45,
    desc: 'Feste Stadtmauer aus Steinen. Tippe Start und Ziel, dann ✓.' },
  steintor_klein: { id: 'steintor_klein', name: 'Tor', icon: '🚪', category: 'militaer', size: 1, cost: { taler: 15, stein: 3 }, upkeep: 0, unlock: S(200), hp: 40, gate: true,
    desc: 'Einfaches Tor in der Steinmauer: deine Leute und Karren gehen durch, Feinde nicht. Kann direkt auf einen Weg gesetzt werden.' },
  steintor: { id: 'steintor', name: 'Stadttor', icon: '⛩️', category: 'militaer', size: 1, cost: { taler: 25, stein: 4 }, upkeep: 0, unlock: S(200), hp: 45, gate: true,
    desc: 'Großes Tor in der Stadtmauer: deine Leute und Karren gehen durch, Feinde nicht. Kann direkt auf einen Weg gesetzt werden.' },
  holzturm: { id: 'holzturm', name: 'Holzturm', icon: '🛖', category: 'militaer', size: 1, cost: { taler: 200, holz: 7, werkzeug: 2, kanonen: 2 }, upkeep: 5, unlock: S(200), radius: 8, hp: 37,
    tower: { str: 4, interval: 3, range: 8 }, desc: 'Wachturm aus Holz mit 2 Kanonen. Schießt auf Feinde und Schiffe (Reichweite 8).' },
  wachturm: { id: 'wachturm', name: 'Steinturm', icon: '🗼', category: 'militaer', size: 1, cost: { taler: 300, holz: 1, werkzeug: 2, stein: 6, kanonen: 2 }, upkeep: 5, unlock: S(200), radius: 8, hp: 55,
    tower: { str: 4, interval: 3, range: 8 }, desc: 'Wachturm aus Stein mit 2 Kanonen – hält mehr aus als der Holzturm (Reichweite 8).' },
  burg: { id: 'burg', name: 'Burg', icon: '🏰', category: 'militaer', size: 2, cost: { taler: 600, holz: 3, werkzeug: 4, stein: 10 }, upkeep: 55, unlock: S(200), hp: 160,
    trains: { slots: 3, time: 100 }, desc: 'Bildet Soldaten aus – bis zu 3 gleichzeitig. Waffen kommen aus dem Lager der Insel.' },
  grosseburg: { id: 'grosseburg', name: 'Große Burg', icon: '🏯', category: 'militaer', size: 3, cost: { taler: 1300, holz: 5, werkzeug: 8, stein: 18 }, upkeep: 90, unlock: K(400), hp: 260,
    trains: { slots: 5, time: 70 }, desc: 'Bildet schneller aus – bis zu 5 Soldaten gleichzeitig.' },
  festung: { id: 'festung', name: 'Festung', icon: '🛡️', category: 'militaer', size: 3, cost: { taler: 2500, holz: 8, werkzeug: 12, stein: 25 }, upkeep: 130, unlock: A(600), hp: 380,
    trains: { slots: 8, time: 50 }, desc: 'Die stärkste Anlage: bis zu 8 Soldaten gleichzeitig, am schnellsten.' },
  triumphbogen: { id: 'triumphbogen', name: 'Triumphbogen', icon: '🏛️', category: 'militaer', size: 2, cost: { taler: 1500, stein: 20, werkzeug: 5 }, upkeep: 0, victory: true, hp: 200,
    desc: 'Denkmal für einen Sieg über einen Gegner oder die Piraten (einer je Sieg). Jeder Triumphbogen erlaubt ein Schiff mehr.' },
  // ---------- Vorbereitet (geplant): Werte nach docs/1602-INHALT.md §5, sichtbar erst mit ihrem Spielteil ----------
  // Ereignisse (src/events.ts): Feuer, Pest, Kriminalität
  feuerwehr: { id: 'feuerwehr', name: 'Feuerwehr', icon: '🚒', category: 'oeffentlich', size: 2, cost: { taler: 150, holz: 5, werkzeug: 3 }, upkeep: 15, radius: 15, unlock: S(15), geplant: true,
    desc: 'Löscht Brände in der Nähe. Braucht einen Weg, damit der Löschwagen hinkommt.' },
  arzt: { id: 'arzt', name: 'Arzt', icon: '⚕️', category: 'oeffentlich', size: 2, cost: { taler: 450, holz: 4, werkzeug: 4, stein: 9 }, upkeep: 30, radius: 16, unlock: B(50), geplant: true,
    desc: 'Heilt Kranke in der Nähe (gegen die Pest) und pflegt verwundete Soldaten.' },
  galgen: { id: 'galgen', name: 'Galgen', icon: '🪢', category: 'oeffentlich', size: 1, cost: { taler: 100, holz: 2, werkzeug: 1 }, upkeep: 20, radius: 16, unlock: B(100), geplant: true,
    desc: 'Schreckt Diebe ab, die sonst Geld und Waren stehlen.' },
  // Prachtbauten (Stadt-Inhalte): Kosten des Denkmals sind im Vorbild nicht belegt
  denkmal: { id: 'denkmal', name: 'Denkmal', icon: '🗿', category: 'oeffentlich', size: 1, cost: {}, upkeep: 0, unlock: B(200), geplant: true,
    desc: 'Ehrt deine Bürger – erst baubar, wenn die Stadt lange zufrieden ist.' },
  zierbaum: { id: 'zierbaum', name: 'Zierbaum', icon: '🌳', category: 'oeffentlich', size: 1, cost: { taler: 5, stein: 1 }, upkeep: 0, unlock: K(250), geplant: true,
    desc: 'Ein gepflegter Baum im Steinbeet – schmückt Straßen und Plätze.' },
  palast: { id: 'palast', name: 'Palast', icon: '👑', category: 'oeffentlich', size: 4, cost: { taler: 5000, holz: 20, werkzeug: 15, stein: 50 }, upkeep: 40, unlock: A(1500), geplant: true,
    desc: 'Prachtvoller Palast für deine Aristokraten. Nur einmal baubar.' },
  kathedrale: { id: 'kathedrale', name: 'Kathedrale', icon: '⛪', category: 'oeffentlich', size: 4, cost: { taler: 7500, holz: 25, werkzeug: 25, stein: 70 }, upkeep: 90, radius: 22, unlock: A(2500), geplant: true,
    desc: 'Die größte Kirche des Reiches. Nur einmal baubar.' },
  // Ureinwohner (src/natives.ts): nie vom Spieler gebaut, sondern vom Spiel gesetzt
  huette: { id: 'huette', name: 'Hütte der Ureinwohner', icon: '🛖', category: null, size: 1, cost: {}, upkeep: 0, geplant: true,
    desc: 'Hier leben Ureinwohner.' },
  haeuptling: { id: 'haeuptling', name: 'Häuptlingshütte', icon: '🪶', category: null, size: 2, cost: {}, upkeep: 0, geplant: true,
    desc: 'Sitz des Häuptlings. Hier kannst du Waren mit den Ureinwohnern tauschen.' },
};

export const CATEGORIES: { id: Category; name: string; icon: string }[] = [
  { id: 'wege', name: 'Wege', icon: '🛤️' },
  { id: 'wohnen', name: 'Wohnen', icon: '🏠' },
  { id: 'nahrung', name: 'Nahrung', icon: '🍖' },
  { id: 'rohstoffe', name: 'Rohstoffe', icon: '🌲' },
  { id: 'plantagen', name: 'Plantagen', icon: '🍇' },
  { id: 'werkstatt', name: 'Werkstätten', icon: '⚒️' },
  { id: 'oeffentlich', name: 'Öffentlich', icon: '⛪' },
  { id: 'hafen', name: 'Hafen', icon: '⚓' },
  { id: 'militaer', name: 'Militär', icon: '🛡️' },
];

export interface TierDef {
  name: string;
  /** für „ab 30 Pionieren“ */
  dat: string;
  maxResidents: number;
  tax: number; // Taler pro Bewohner und Minute bei voller Zufriedenheit
  /** Verbrauch pro Bewohner und Minute */
  consumes: Partial<Record<GoodId, number>>;
  /** Öffentliche Gebäude, die diese Stufe in der Nähe haben will */
  services: BuildingId[];
  /** Baumaterial, um auf diese Stufe aufzusteigen */
  upgradeCost: Cost;
  /** Was zusätzlich da sein muss, um in die nächste Stufe aufzusteigen (Waren: je Gruppe eine davon) */
  next?: { goods: GoodId[][]; services: BuildingId[] };
}

/** Fünf Stufen wie im Vorbild. Verbrauch ≈ Original × 8 (das Spiel läuft schneller). */
export const TIERS: TierDef[] = [
  { name: 'Pioniere', dat: 'Pionieren', maxResidents: 3, tax: 1.0, consumes: { nahrung: 0.1 }, services: ['markt'], upgradeCost: {},
    next: { goods: [['stoff']], services: ['kapelle'] } },
  { name: 'Siedler', dat: 'Siedlern', maxResidents: 7, tax: 1.8, consumes: { nahrung: 0.1, stoff: 0.045, alkohol: 0.035 }, services: ['markt', 'kapelle'], upgradeCost: { holz: 3, werkzeug: 1 },
    next: { goods: [['alkohol'], ['tabakwaren', 'gewuerze']], services: ['wirtshaus', 'schule'] } },
  { name: 'Bürger', dat: 'Bürgern', maxResidents: 15, tax: 2.8, consumes: { nahrung: 0.1, stoff: 0.05, alkohol: 0.045, gewuerze: 0.035, tabakwaren: 0.035 }, services: ['markt', 'kapelle', 'wirtshaus', 'schule'], upgradeCost: { holz: 2, werkzeug: 2, stein: 6 },
    next: { goods: [['kakao']], services: ['kirche', 'badehaus'] } },
  { name: 'Kaufleute', dat: 'Kaufleuten', maxResidents: 25, tax: 4.2, consumes: { nahrung: 0.1, stoff: 0.055, alkohol: 0.05, gewuerze: 0.045, tabakwaren: 0.045, kakao: 0.05 }, services: ['markt', 'kirche', 'wirtshaus', 'schule', 'badehaus'], upgradeCost: { holz: 3, werkzeug: 3, stein: 9 },
    next: { goods: [['schmuck'], ['kleidung']], services: ['hochschule', 'theater'] } },
  { name: 'Aristokraten', dat: 'Aristokraten', maxResidents: 40, tax: 6.0, consumes: { nahrung: 0.1, alkohol: 0.055, gewuerze: 0.045, tabakwaren: 0.045, kakao: 0.045, kleidung: 0.035, schmuck: 0.012 }, services: ['markt', 'kirche', 'wirtshaus', 'badehaus', 'hochschule', 'theater'], upgradeCost: { holz: 3, werkzeug: 3, stein: 12 } },
];

/** Schiffstypen (Werte nach dem Vorbild): Laderäume à 50 t, Tempo, höchstens ladbare Kanonen, Treffer, Truppen an Bord */
export type ShipType = 'handel_klein' | 'handel_gross' | 'krieg_klein' | 'krieg_gross' | 'pirat';
export interface ShipDef { name: string; slots: number; speed: number; kanonen: number; hp: number; troops: number; cost: { taler: number; holz: number; stoff: number }; time: number; werft: 'werft' | 'grosswerft'; unlock: { tier: number; n: number }; build?: false }
export const SHIPS: Record<ShipType, ShipDef> = {
  handel_klein: { name: 'Kleines Handelsschiff', slots: 4, speed: 1.0, kanonen: 6, hp: 50, troops: 8, cost: { taler: 400, holz: 25, stoff: 3 }, time: 60, werft: 'werft', unlock: S(120) },
  krieg_klein: { name: 'Kleines Kriegsschiff', slots: 3, speed: 1.1, kanonen: 8, hp: 65, troops: 6, cost: { taler: 600, holz: 32, stoff: 4 }, time: 75, werft: 'werft', unlock: S(120) },
  handel_gross: { name: 'Großes Handelsschiff', slots: 6, speed: 0.85, kanonen: 10, hp: 80, troops: 12, cost: { taler: 520, holz: 45, stoff: 5 }, time: 55, werft: 'grosswerft', unlock: K(500) },
  krieg_gross: { name: 'Großes Kriegsschiff', slots: 8, speed: 1.2, kanonen: 14, hp: 120, troops: 16, cost: { taler: 900, holz: 60, stoff: 7 }, time: 70, werft: 'grosswerft', unlock: K(500) },
  pirat: { name: 'Piratenschiff', slots: 4, speed: 0.95, kanonen: 10, hp: 95, troops: 0, cost: { taler: 0, holz: 0, stoff: 0 }, time: 0, werft: 'grosswerft', unlock: A(99999), build: false },
};
/** Kanonen eines Schiffs: Schaden je Kanone und Salve, Sekunden zwischen Salven, Reichweite */
export const SHIP_GUN = { dmg: 0.5, interval: 2, range: 7 };

/** Soldaten wie im Vorbild (Treffer, Stärke je Schlag/Schuss, Sekunden dazwischen, Reichweite in Feldern) */
export type UnitType = 'infanterie' | 'reiter' | 'musketier' | 'kanonier';
export interface UnitDef { name: string; plural: string; icon: string; hp: number; str: number; interval: number; range: number; speed: number; cost: Partial<Record<GoodId, number>>; upkeep: number; unlock: { tier: number; n: number }; desc: string }
export const UNITS: Record<UnitType, UnitDef> = {
  infanterie: { name: 'Schwertkämpfer', plural: 'Schwertkämpfer', icon: '⚔️', hp: 20, str: 1.0, interval: 0.8, range: 1.2, speed: 1.3, cost: { schwerter: 3 }, upkeep: 5, unlock: S(200),
    desc: 'Robuster Nahkämpfer. Schützt deine Kanoniere.' },
  reiter: { name: 'Reiter', plural: 'Reiter', icon: '🐎', hp: 18, str: 1.6, interval: 1.0, range: 1.3, speed: 2.4, cost: { schwerter: 3 }, upkeep: 8, unlock: S(200),
    desc: 'Schnell und kräftig im Nahkampf – gut gegen Kanoniere.' },
  musketier: { name: 'Musketier', plural: 'Musketiere', icon: '🔫', hp: 15, str: 2.4, interval: 2.0, range: 4, speed: 1.2, cost: { musketen: 4 }, upkeep: 10, unlock: K(400),
    desc: 'Schießt auf 4 Felder Entfernung.' },
  kanonier: { name: 'Kanonier', plural: 'Kanoniere', icon: '💥', hp: 12, str: 7.0, interval: 4.5, range: 7, speed: 0.8, cost: { kanonen: 2 }, upkeep: 14, unlock: B(400),
    desc: 'Feldkanone, sehr stark gegen Gebäude und Türme, aber verwundbar. Reichweite 7.' },
};
export const MAX_UNITS = 99;

/** Kontor-Ausbaustufen: Lagerplatz je Ware und Kosten des Ausbaus */
export const KONTOR_LEVELS: { storage: number; cost: Cost; unlock?: { tier: number; n: number } }[] = [
  { storage: 30, cost: {} },
  { storage: 50, cost: { taler: 180, holz: 7, werkzeug: 3 }, unlock: S(30) },
  { storage: 75, cost: { taler: 250, holz: 4, werkzeug: 4, stein: 6 }, unlock: B(100) },
  { storage: 100, cost: { taler: 250, holz: 4, werkzeug: 5, stein: 10 }, unlock: K(250) },
];

/** Ladung des Startschiffs (4 Laderäume à 50 t) */
export const START_CARGO: [GoodId, number][] = [['werkzeug', 40], ['holz', 50], ['nahrung', 30], ['stoff', 10]];
export const START_MONEY = 8000;
export const SLOT_CAP = 50;

/** Preise des freien Händlers (Taler je Tonne): kaufen = du zahlst, verkaufen = du bekommst.
 *  Nach den Handelspreisen des Vorbilds (Händler etwas teurer als Direkthandel). */
export const PRICES: Partial<Record<GoodId, { kaufen: number; verkaufen: number }>> = {
  holz: { kaufen: 20, verkaufen: 12 },
  stein: { kaufen: 30, verkaufen: 20 },
  werkzeug: { kaufen: 90, verkaufen: 60 },
  nahrung: { kaufen: 18, verkaufen: 11 },
  stoff: { kaufen: 34, verkaufen: 23 },
  alkohol: { kaufen: 55, verkaufen: 36 },
  tabakwaren: { kaufen: 68, verkaufen: 45 },
  gewuerze: { kaufen: 41, verkaufen: 27 },
  kakao: { kaufen: 34, verkaufen: 23 },
  kleidung: { kaufen: 135, verkaufen: 90 },
  schmuck: { kaufen: 610, verkaufen: 400 },
  wolle: { kaufen: 16, verkaufen: 10 },
  getreide: { kaufen: 3, verkaufen: 2 },
  mehl: { kaufen: 7, verkaufen: 4 },
  zuckerrohr: { kaufen: 20, verkaufen: 13 },
  tabak: { kaufen: 23, verkaufen: 15 },
  erz: { kaufen: 60, verkaufen: 40 },
  eisen: { kaufen: 88, verkaufen: 58 },
  gold: { kaufen: 475, verkaufen: 315 },
  schwerter: { kaufen: 122, verkaufen: 80 },
  musketen: { kaufen: 170, verkaufen: 112 },
  kanonen: { kaufen: 340, verkaufen: 225 },
};
