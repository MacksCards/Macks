// Alle Spielwerte an einem Ort: Waren, Gebäude, Bevölkerungsstufen, Aufgaben.

export type GoodId =
  | 'holz' | 'werkzeug' | 'stein' | 'nahrung' | 'wolle' | 'stoff'
  | 'erz' | 'getreide' | 'mehl' | 'schweine' | 'bier';

export interface GoodDef { id: GoodId; name: string; icon: string }

export const GOODS: GoodDef[] = [
  { id: 'holz', name: 'Holz', icon: '🪵' },
  { id: 'werkzeug', name: 'Werkzeug', icon: '🔧' },
  { id: 'stein', name: 'Stein', icon: '🧱' },
  { id: 'nahrung', name: 'Nahrung', icon: '🍖' },
  { id: 'wolle', name: 'Wolle', icon: '🧶' },
  { id: 'stoff', name: 'Stoff', icon: '🧵' },
  { id: 'erz', name: 'Erz', icon: '🪨' },
  { id: 'getreide', name: 'Getreide', icon: '🌾' },
  { id: 'mehl', name: 'Mehl', icon: '🥣' },
  { id: 'schweine', name: 'Schweine', icon: '🐖' },
  { id: 'bier', name: 'Bier', icon: '🍺' },
];
export const GOOD: Record<GoodId, GoodDef> = Object.fromEntries(GOODS.map((g) => [g.id, g])) as Record<GoodId, GoodDef>;

export type BuildingId =
  | 'weg' | 'kontor' | 'markt' | 'haus' | 'kapelle' | 'wirtshaus'
  | 'holzfaeller' | 'fischer' | 'jagdhuette' | 'schweinezucht' | 'fleischerei'
  | 'schaffarm' | 'weberei'
  | 'steinbruch' | 'erzmine' | 'schmiede'
  | 'getreidefarm' | 'muehle' | 'baeckerei' | 'brauerei';

export type Category = 'wege' | 'wohnen' | 'nahrung' | 'rohstoffe' | 'werkstatt' | 'oeffentlich';

export interface Cost { taler?: number; holz?: number; werkzeug?: number; stein?: number }

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
  needs?: 'wald' | 'wasser' | 'berg';
  storage?: number; // zusätzliche Lagerkapazität je Ware
  /** Arbeitsradius (Felder), in dem der Betrieb Rohstoffe findet (Wald, Wild, Fischgründe …) */
  work?: number;
  /** Eigenes kleines Lager des Betriebs (Tonnen), bevor ein Marktkarren abholt */
  stock?: number;
  /** Freischaltung wie im Vorbild: n Einwohner mindestens der Stufe tier auf einer Insel */
  unlock?: { tier: number; n: number };
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  weg: { id: 'weg', name: 'Feldweg', icon: '🟫', category: 'wege', size: 1, cost: { taler: 5 }, upkeep: 0,
    desc: 'Verbindet Betriebe mit Kontor oder Marktplatz. Mit dem Finger ziehen, um mehrere Felder zu bauen.' },
  kontor: { id: 'kontor', name: 'Kontor', icon: '⚓', category: null, size: 3, cost: { taler: 100, holz: 6, werkzeug: 3 }, upkeep: 15, radius: 16, storage: 30, work: 16,
    desc: 'Lager und Hafen einer Insel. Wird vom Schiff aus an der Küste gebaut und beansprucht das Land ringsum.' },
  markt: { id: 'markt', name: 'Marktplatz', icon: '🏪', category: 'oeffentlich', size: 3, cost: { taler: 300, holz: 6, werkzeug: 2 }, upkeep: 10, radius: 15, storage: 10, work: 15,
    desc: 'Erweitert den Baubereich und das Lager. Wohnhäuser brauchen einen Markt in Reichweite.' },
  haus: { id: 'haus', name: 'Wohnhaus', icon: '🏠', category: 'wohnen', size: 2, cost: { holz: 3 }, upkeep: 0,
    desc: 'Hier ziehen Pioniere ein. Sind sie zufrieden, steigt das Haus zu Siedlern und Bürgern auf.' },
  kapelle: { id: 'kapelle', name: 'Kapelle', icon: '⛪', category: 'oeffentlich', size: 2, cost: { taler: 150, holz: 6, werkzeug: 2 }, upkeep: 5, radius: 9,
    desc: 'Siedler und Bürger wollen eine Kapelle in der Nähe.' },
  wirtshaus: { id: 'wirtshaus', name: 'Wirtshaus', icon: '🍻', category: 'oeffentlich', size: 2, cost: { taler: 400, holz: 4, werkzeug: 3, stein: 6 }, upkeep: 15, unlock: { tier: 1, n: 50 }, radius: 9,
    desc: 'Bürger wollen ein Wirtshaus in der Nähe, um ihr Bier zu trinken.' },
  holzfaeller: { id: 'holzfaeller', name: 'Holzfäller', icon: '🪓', category: 'rohstoffe', size: 2, cost: { taler: 50, holz: 2 }, upkeep: 4, stock: 10, work: 4,
    prod: { time: 12, output: 'holz' }, needs: 'wald',
    desc: 'Fällt Bäume. Je mehr Wald in der Nähe, desto schneller.' },
  fischer: { id: 'fischer', name: 'Fischerhütte', icon: '🎣', category: 'nahrung', size: 2, cost: { taler: 100, holz: 3, werkzeug: 1 }, upkeep: 5, stock: 4, work: 4,
    prod: { time: 10, output: 'nahrung' }, needs: 'wasser',
    desc: 'Fängt Fisch als Nahrung. Muss direkt am Wasser stehen.' },
  jagdhuette: { id: 'jagdhuette', name: 'Jagdhütte', icon: '🏹', category: 'nahrung', size: 2, cost: { taler: 60, holz: 3 }, upkeep: 3, stock: 3, work: 6,
    prod: { time: 16, output: 'nahrung' }, needs: 'wald',
    desc: 'Jäger erlegen Wild im Wald. Günstig, aber langsamer als der Fischer.' },
  schweinezucht: { id: 'schweinezucht', name: 'Schweinezucht', icon: '🐖', category: 'nahrung', size: 3, cost: { taler: 200, holz: 5, werkzeug: 2 }, upkeep: 7, stock: 4, work: 3, unlock: { tier: 0, n: 30 },
    prod: { time: 14, output: 'schweine' }, desc: 'Züchtet Schweine für die Fleischerei.' },
  fleischerei: { id: 'fleischerei', name: 'Fleischerei', icon: '🔪', category: 'nahrung', size: 2, cost: { taler: 250, holz: 3, werkzeug: 2, stein: 3 }, upkeep: 8, stock: 4, unlock: { tier: 0, n: 30 },
    prod: { time: 10, input: { schweine: 1 }, output: 'nahrung', amount: 2 },
    desc: 'Macht aus einem Schwein zwei Ladungen Nahrung. Sehr ergiebig.' },
  schaffarm: { id: 'schaffarm', name: 'Schaffarm', icon: '🐑', category: 'rohstoffe', size: 3, cost: { taler: 200, holz: 4, werkzeug: 1 }, upkeep: 8, stock: 8, work: 3,
    prod: { time: 16, output: 'wolle' },
    desc: 'Liefert Wolle für die Weberei.' },
  getreidefarm: { id: 'getreidefarm', name: 'Getreidefarm', icon: '🌱', category: 'rohstoffe', size: 3, cost: { taler: 150, holz: 3, werkzeug: 1 }, upkeep: 5, stock: 6, work: 2, unlock: { tier: 1, n: 75 },
    prod: { time: 12, output: 'getreide' },
    desc: 'Baut Getreide an – für die Mühle oder die Brauerei.' },
  steinbruch: { id: 'steinbruch', name: 'Steinbruch', icon: '⛰️', category: 'rohstoffe', size: 2, cost: { taler: 250, holz: 4, werkzeug: 2 }, upkeep: 10, stock: 8, unlock: { tier: 1, n: 15 },
    prod: { time: 15, output: 'stein' }, needs: 'berg',
    desc: 'Schlägt Steine. Muss direkt am Berg stehen.' },
  erzmine: { id: 'erzmine', name: 'Erzmine', icon: '⛏️', category: 'rohstoffe', size: 2, cost: { taler: 300, holz: 4, werkzeug: 2 }, upkeep: 12, stock: 4, unlock: { tier: 1, n: 120 },
    prod: { time: 18, output: 'erz' }, needs: 'berg',
    desc: 'Fördert Erz. Muss direkt am Berg stehen.' },
  weberei: { id: 'weberei', name: 'Weberei', icon: '🪡', category: 'werkstatt', size: 2, cost: { taler: 200, holz: 3, werkzeug: 2 }, upkeep: 8, stock: 4,
    prod: { time: 12, input: { wolle: 1 }, output: 'stoff' },
    desc: 'Webt aus Wolle Stoff für die Kleidung deiner Siedler.' },
  schmiede: { id: 'schmiede', name: 'Werkzeugschmiede', icon: '🔨', category: 'werkstatt', size: 2, cost: { taler: 300, holz: 3, werkzeug: 2, stein: 4 }, upkeep: 12, stock: 4, unlock: { tier: 1, n: 100 },
    prod: { time: 15, input: { erz: 1, holz: 1 }, output: 'werkzeug' },
    desc: 'Schmiedet aus Erz und Holz neues Werkzeug.' },
  muehle: { id: 'muehle', name: 'Mühle', icon: '🌬️', category: 'werkstatt', size: 2, cost: { taler: 250, holz: 5, werkzeug: 2, stein: 2 }, upkeep: 8, stock: 6, unlock: { tier: 1, n: 75 },
    prod: { time: 10, input: { getreide: 1 }, output: 'mehl' },
    desc: 'Mahlt Getreide zu Mehl.' },
  baeckerei: { id: 'baeckerei', name: 'Bäckerei', icon: '🥖', category: 'werkstatt', size: 2, cost: { taler: 200, holz: 3, werkzeug: 1, stein: 2 }, upkeep: 8, stock: 4, unlock: { tier: 1, n: 75 },
    prod: { time: 10, input: { mehl: 1 }, output: 'nahrung', amount: 2 },
    desc: 'Backt aus Mehl Brot: zwei Ladungen Nahrung je Sack Mehl.' },
  brauerei: { id: 'brauerei', name: 'Brauerei', icon: '🍺', category: 'werkstatt', size: 2, cost: { taler: 300, holz: 4, werkzeug: 2, stein: 3 }, upkeep: 10, stock: 4, unlock: { tier: 1, n: 40 },
    prod: { time: 14, input: { getreide: 1 }, output: 'bier' },
    desc: 'Braut aus Getreide Bier für deine Bürger.' },
};

export const CATEGORIES: { id: Category; name: string; icon: string }[] = [
  { id: 'wege', name: 'Wege', icon: '🛤️' },
  { id: 'wohnen', name: 'Wohnen', icon: '🏠' },
  { id: 'nahrung', name: 'Nahrung', icon: '🍖' },
  { id: 'rohstoffe', name: 'Rohstoffe', icon: '🌲' },
  { id: 'werkstatt', name: 'Werkstätten', icon: '⚒️' },
  { id: 'oeffentlich', name: 'Öffentlich', icon: '⛪' },
];

export interface TierDef {
  name: string;
  maxResidents: number;
  tax: number; // Taler pro Bewohner und Minute bei voller Zufriedenheit
  /** Verbrauch pro Bewohner und Minute */
  consumes: Partial<Record<GoodId, number>>;
  services: BuildingId[];
  /** Baumaterial, um auf diese Stufe aufzusteigen */
  upgradeCost: Cost;
}

export const TIERS: TierDef[] = [
  { name: 'Pioniere', maxResidents: 4, tax: 1.2, consumes: { nahrung: 0.12 }, services: ['markt'], upgradeCost: {} },
  { name: 'Siedler', maxResidents: 8, tax: 2.0, consumes: { nahrung: 0.12, stoff: 0.06 }, services: ['markt', 'kapelle'], upgradeCost: { holz: 2, werkzeug: 1 } },
  { name: 'Bürger', maxResidents: 15, tax: 3.0, consumes: { nahrung: 0.13, stoff: 0.07, bier: 0.06 }, services: ['markt', 'kapelle', 'wirtshaus'], upgradeCost: { holz: 2, werkzeug: 2, stein: 4 } },
];

export const BASE_STORAGE = 0; // Kontor bringt seine Kapazität selbst mit
/** Ladung des Startschiffs (4 Laderäume à 50 t) */
export const START_CARGO: [GoodId, number][] = [['werkzeug', 40], ['holz', 50], ['nahrung', 30], ['stoff', 10]];
export const START_MONEY = 8000;
export const SLOT_CAP = 50;

/** Preise des freien Händlers (Taler je Tonne): kaufen = du zahlst, verkaufen = du bekommst.
 *  Orientiert an den Handelspreisen des Vorbilds (Händler etwas teurer als Direkthandel). */
export const PRICES: Partial<Record<GoodId, { kaufen: number; verkaufen: number }>> = {
  werkzeug: { kaufen: 90, verkaufen: 60 },
  holz: { kaufen: 20, verkaufen: 12 },
  stein: { kaufen: 30, verkaufen: 20 },
  nahrung: { kaufen: 18, verkaufen: 11 },
  wolle: { kaufen: 15, verkaufen: 10 },
  stoff: { kaufen: 34, verkaufen: 23 },
  erz: { kaufen: 60, verkaufen: 40 },
  getreide: { kaufen: 4, verkaufen: 2 },
  mehl: { kaufen: 8, verkaufen: 5 },
  schweine: { kaufen: 8, verkaufen: 5 },
  bier: { kaufen: 55, verkaufen: 36 },
};
