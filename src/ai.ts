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
//  - Nahrung: Gezählt wird, was die angeschlossenen Betriebe wirklich liefern. Neue Häuser
//    gibt es nur, solange 4 × Häuser < Nahrung (in satten Einwohnern) + 30.
//  - Kasse: Beim Händler kauft die KI nur, was dem nächsten Bau fehlt, und nur, solange danach
//    noch 2 500 Taler bleiben. Im Minus darf im Spiel niemand bauen (auch kein Wohnhaus); dann
//    verkauft die KI Überschüsse (Holz, Werkzeug …), bis wieder Guthaben da ist.
//  - Marktkarren: Sie holen zuerst, wovon am meisten bereitliegt – also Holz. Ist das Holzlager voll,
//    reißt die KI überzählige Holzfäller ab, sonst bliebe die Nahrung liegen.
//  - Rechenzeit: Die Gegner denken versetzt (nicht alle im selben Rechenschritt), prüfen zuerst
//    Freischaltung, Geld und Material und suchen Bauplätze nur im eigenen Land. Die Küstenplätze
//    einer Insel werden nur einmal berechnet. Die Überfahrt plant die KI in kurzen Etappen über eine
//    grobe Seekarte, und den Start (Insel wählen, Platz planen, losfahren) verteilt sie auf drei Schritte.
import { BUILDINGS, BUILD_GOODS, BuildingId, Cost, GoodId, PRICES, TIERS } from './data';
import type { AIState, Building, Game, Player } from './game';
import { T, rng } from './world';

/** Sekunden Spielzeit zwischen zwei Entscheidungen eines Gegners */
export const THINK = 3;
/** Kern ums Kontor: hier entsteht das Wegeraster gleich nach der Gründung, auch durch Wald */
const CORE = 12;
/** Wegeraster: alle 4 Felder ein Weg, dazwischen 3 × 3 Felder Bauland */
const GRID = 4;
/** Beim Händler nur kaufen, wenn danach noch mehr als so viel Geld bleibt */
const RESERVE = 2500;
/** So viele Wohnhäuser baut die KI höchstens (mehr Stufen und Ketten plant sie noch nicht) */
const MAX_HOUSES = 40;
/** Höchstens so viele Marktplätze (sie kosten Unterhalt) */
const MAX_MARKETS = 3;
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
const INF = 1 << 29;

// ---------- Gedächtnis ----------

/** Gedächtnis eines Gegners: die Felder aus AIState plus eigene Zusätze. Die Zusätze sind
 *  freiwillig – ältere Spielstände haben sie nicht, dann gelten die Standardwerte. */
interface Brain extends AIState {
  /** Denkzeit schon versetzt (damit nicht alle Gegner im selben Rechenschritt denken) */
  off?: boolean;
  /** Gebäudeart (oder 'raster' / 'abriss') → Spielzeit, ab der nach einem vergeblichen Versuch (oder einem Abriss) wieder gesucht wird */
  wait?: Partial<Record<BuildingId | 'raster' | 'abriss', number>>;
  /** Überfahrt zur gewählten Insel in Etappen: nächste Etappenziele, zuletzt der Ankerplatz am Kontor */
  route?: [number, number][];
  /** Insel gewählt, Fahrt wird im nächsten Denkschritt geplant (verteilt die Rechenarbeit) */
  pick?: number;
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
}

/** Grobe Seekarte: freie Zellen (nur Wasser) und davon das offene Meer (mit dem Kartenrand verbunden) */
interface Sea { w: number; open: Uint8Array; ocean: Uint8Array }
const memos = new WeakMap<Game, Memo>();
function memo(g: Game): Memo {
  let m = memos.get(g);
  if (!m) { m = { coast: new Map(), retry: new Map() }; memos.set(g, m); }
  return m;
}

// ---------- Ablauf ----------

export function thinkAI(g: Game, p: Player, dt: number) {
  const b = p.brain as Brain;
  if (!b.off) stagger(g, p, b);
  b.t += dt;
  if (b.t < THINK) return;
  b.t = 0;
  const ship = g.ships.find((s) => s.owner === p.id);
  switch (b.phase) {
    case 'suchen': {
      if (!ship) return;
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
      const dock = b.route[b.route.length - 1];
      let route: [number, number][] = [...(seaRoute(g, ship.x, ship.y, dock[0], dock[1]) ?? []), dock];
      if (!g.moveShip(ship, route[0][0] + 0.5, route[0][1] + 0.5)) {
        // erste Etappe geht nicht: direkt zum Ankerplatz (teurer, aber selten)
        if (route.length === 1 || !g.moveShip(ship, dock[0] + 0.5, dock[1] + 0.5)) { giveUp(); return; }
        route = [dock];
      }
      b.route = route;
      b.pick = undefined;
      b.phase = 'fahren';
      return;
    }
    case 'fahren': {
      if (!ship) return;
      const r = b.route;
      if (r && r.length > 1) {
        // Etappenziel fast erreicht (oder Schiff steht): die nächste Etappe planen, ohne anzuhalten
        const [wx, wy] = r[0];
        if (!ship.path.length || Math.hypot(ship.x - wx - 0.5, ship.y - wy - 0.5) < 10) {
          r.shift();
          if (!g.moveShip(ship, r[0][0] + 0.5, r[0][1] + 0.5)) {
            const [dx, dy] = r[r.length - 1];
            b.route = undefined;
            // auch direkt kein Weg: diese Insel nicht noch einmal versuchen
            if (!g.moveShip(ship, dx + 0.5, dy + 0.5)) { (b.bad ??= []).push(b.island); b.island = -1; b.phase = 'suchen'; }
          }
        }
        return;
      }
      if (!ship.path.length) { b.route = undefined; b.phase = 'gruenden'; }
      return;
    }
    case 'gruenden': {
      if (!ship) return;
      const [sx, sy] = b.site ?? [-1, -1];
      if (sx >= 0 && g.canPlace('kontor', sx, sy, p.id).ok) {
        g.place('kontor', sx, sy, p.id);
        g.unloadAll(ship);
        b.phase = 'aufbau';
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
    case 'aufbau':
      build(g, p);
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

/** Beste freie Insel: groß, mit Erz/Gold, fruchtbar, nicht zu weit, nicht von anderen anvisiert */
function chooseIsland(g: Game, p: Player, sx: number, sy: number): number {
  const taken = new Set(g.buildings.filter((b) => b.type === 'kontor').map((b) => b.island));
  for (const o of g.players) if (o.brain && o.id !== p.id && o.brain.island >= 0) taken.add(o.brain.island);
  for (const id of p.brain?.bad ?? []) taken.add(id);
  let best = -1, bs = -1e9;
  for (const isl of g.islands) {
    if (taken.has(isl.id) || isl.land < 120) continue;
    const fert = Object.values(isl.frucht).reduce((a, v) => a + (v ?? 0), 0);
    const score = isl.land * 0.5 + (isl.erz ? 60 : 0) + (isl.gold ? 40 : 0) + fert * 0.3 - Math.hypot(isl.cx - sx, isl.cy - sy) * 1.6;
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
  let pop = 0, hungry = 0;
  for (const o of g.buildings) {
    if (o.owner !== p.id || o.island !== island) continue;
    mine.push(o);
    n[o.type] = (n[o.type] ?? 0) + 1;
    if (o.type === 'haus') { houses.push(o); pop += o.residents; if (o.short.nahrung) hungry++; }
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
  const out = output(g, prod);
  return { owner: p.id, island, kontor, kx, ky, gx: Math.floor(kx), gy: Math.floor(ky), lager, cap: g.capOf(p.id, island), n, mine, houses, hungry, prod, claim, pop, out, food: (out.nahrung ?? 0) / PER_HEAD, box };
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
 *  nach ihrer Ergiebigkeit (geteilte Felder, Nachwachsen, Fruchtbarkeit), Werkstätten nur so viel,
 *  wie ihre Rohstoffe hergeben (z. B. Fleischerei nicht mehr, als die Schweinezucht liefert). */
function output(g: Game, prod: Building[]): Partial<Record<GoodId, number>> {
  const out: Partial<Record<GoodId, number>> = {};
  const list = prod.filter((o) => g.linked.has(o.id) && o.status !== 'keinWeg' && o.eff > 0)
    .sort((a, b) => (DEPTH[a.type] ?? 0) - (DEPTH[b.type] ?? 0));
  for (const o of list) {
    const pr = BUILDINGS[o.type].prod!;
    const runs = 60 / pr.time; // Arbeitsgänge je Minute bei voller Arbeit
    const inputs = Object.entries(pr.input ?? {}) as [GoodId, number][];
    let f = Math.min(1, o.eff);
    for (const [gd, k] of inputs) f = Math.min(f, (out[gd] ?? 0) / (runs * k));
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
  // 5. Bauwünsche der Reihe nach – der erste, der klappt, wird gebaut
  decide(g, p, c);
}

/** Überschüsse, die die KI im Minus verkauft: Ware und die Menge, die sie für die nächsten Bauten behält */
const SELL: [GoodId, number][] = [['werkzeug', 4], ['holz', 6], ['wolle', 6], ['stoff', 6]];

/** Im Minus darf niemand bauen – das Spiel verlangt Guthaben, auch für ein Wohnhaus, das nur Holz kostet.
 *  Darum verkauft die KI dann Überschüsse beim Händler, bis wieder etwas Guthaben da ist (z. B. nach
 *  Kriegsschäden: erst Geld, dann Häuser neu bauen, dann fließen wieder Steuern). Aus einem tiefen Loch
 *  hilft das nicht – dort bleibt nur das Steuergeld. */
function rescue(g: Game, p: Player, c: City): boolean {
  if (p.money >= 0) return false;
  let sold = false;
  for (const [gd, keep] of SELL) {
    const pr = PRICES[gd];
    const surplus = Math.floor(c.lager[gd] - keep);
    if (!pr || surplus <= 0 || p.money >= 200) continue;
    if (g.trade(p.id, c.island, gd, -Math.min(surplus, Math.ceil((200 - p.money) / pr.verkaufen))) > 0) sold = true;
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
  const full = c.lager.holz >= g.capOf(p.id, c.island) - 1 && (c.n.haus ?? 0) >= MAX_HOUSES;
  const starving = c.hungry >= Math.max(2, c.houses.length * 0.1) && c.lager.holz >= 20;
  // fertig gebaut und das Lager voll: auch der letzte Holzfäller ist überflüssig (bei Bedarf kommt ein neuer)
  if (saws.length < (full ? 1 : 2) || (!full && !starving)) return false;
  const weakest = saws.reduce((a, o) => (o.eff < a.eff ? o : a));
  const wait = (b.wait ??= {});
  wait.abriss = g.time + 60;
  wait.holzfaeller = g.time + 300;
  g.removeBuilding(weakest);
  return true;
}

/** Braucht die Stadt mehr Holz? Solange gebaut wird oder das Holzlager fast leer ist */
function woodWanted(c: City): boolean {
  return c.lager.holz < 8 || ((c.n.haus ?? 0) < MAX_HOUSES && (c.out.holz ?? 0) < 4);
}

/** Die Bauwünsche in ihrer Reihenfolge; true = es wurde etwas gebaut */
function decide(g: Game, p: Player, c: City): boolean {
  const n = (t: BuildingId) => c.n[t] ?? 0;
  if (p.money >= 0) {
    if (!n('holzfaeller') && (n('haus') < MAX_HOUSES || c.lager.holz < 8) && place(g, p, c, 'holzfaeller')) return true;
    // zu jeder Schweinezucht gehört eine Fleischerei (erst sie macht Nahrung daraus)
    if (n('schweinezucht') > n('fleischerei') && place(g, p, c, 'fleischerei')) return true;
    if (c.food < c.pop + 25 && placeFood(g, p, c)) return true;
    if (!n('markt') && place(g, p, c, 'markt')) return true;
    if (c.pop >= 20 && !n('kapelle') && place(g, p, c, 'kapelle')) return true;
    if (c.pop >= 35 && !n('schaffarm') && place(g, p, c, 'schaffarm')) return true;
    if (n('schaffarm') && !n('weberei') && place(g, p, c, 'weberei')) return true;
    // Karren: kommen viele Betriebe auf wenige Karren (oder staut es sich schon: Häuser hungern, oder die Nahrung
    // im Lager wird knapp, während Betriebe voll liegen), ein weiterer Marktplatz dort, wo er die Wege am meisten
    // verkürzt
    if (n('markt') && n('markt') < MAX_MARKETS && p.money > 1500) {
      const waiting = c.prod.filter((o) => o.status === 'lagerVoll' && c.lager[BUILDINGS[o.type].prod!.output] < c.cap - 3).length;
      const jammed = c.hungry >= 2 || (c.pop >= 60 && c.lager.nahrung < 10 && waiting >= 2);
      if ((jammed || c.prod.length >= 10 * n('markt')) && ready(g, p, c, 'markt')
        && place(g, p, c, 'markt', false, hubSites(g, p, c, jammed ? HUB_GAIN_JAM : HUB_GAIN))) return true;
    }
    // weitere Holzfäller nur, solange gebaut wird (Holzbedarf) oder das Holzlager fast leer ist
    if (n('holzfaeller') < 3 && woodWanted(c) && place(g, p, c, 'holzfaeller')) return true;
  }
  // Wohnhäuser bringen Steuern und kosten nur Holz – aber nur so viele, wie satt werden
  if (n('haus') < MAX_HOUSES && 4 * n('haus') < c.food + 30 && c.lager.holz >= (BUILDINGS.haus.cost.holz ?? 0)) {
    const sites = ready(g, p, c, 'haus') ? houseSites(g, p, c) : [];
    // Liegt der beste Platz an keiner Straße: erst das Wegeraster bis dorthin verlängern (Haus im nächsten Schritt)
    if (sites.length && !touchesRoad(g, 'haus', sites[0].x, sites[0].y) && streetTo(g, p, c, sites[0])) return true;
    if (place(g, p, c, 'haus', false, sites)) return true;
    // kein Platz mehr im Bereich der Marktplätze: Gebiet mit einem neuen Marktplatz erweitern
    if (p.money > 1500 && n('markt') && n('markt') < MAX_MARKETS && place(g, p, c, 'markt', true)) return true;
  }
  return false;
}

/** Nahrung: den Betrieb wählen, der an seinem besten Platz am meisten liefert */
function placeFood(g: Game, p: Player, c: City): boolean {
  let best: { type: BuildingId; v: number; sites: Cand[] } | null = null;
  for (const type of ['fischer', 'jagdhuette', 'schweinezucht'] as BuildingId[]) {
    if (!ready(g, p, c, type)) continue;
    const sites = sitesFor(g, p, c, type);
    if (!sites.length) continue;
    const pr = BUILDINGS[type].prod!;
    // Nahrung je Minute; Schweine werden erst in der Fleischerei zu je 2 Nahrung (die kostet extra)
    const v = (60 / pr.time) * (pr.amount ?? 1) * sites[0].eff * (pr.output === 'nahrung' ? 1 : 2 * 0.7);
    if (!best || v > best.v) best = { type, v, sites };
  }
  return !!best && place(g, p, c, best.type, false, best.sites);
}

/** Bauplatz-Kandidat: Ecke, Bewertung, Ergiebigkeit */
interface Cand { x: number; y: number; s: number; eff: number }

/** Darf und kann die KI das bauen (Freischaltung, Wartezeit, Geld und Material notfalls vom Händler)? */
function ready(g: Game, p: Player, c: City, type: BuildingId): [GoodId, number][] | null {
  const d = BUILDINGS[type];
  const wait = (p.brain as Brain).wait?.[type];
  if (wait !== undefined && g.time < wait) return null;
  if (d.category && d.unlock && g.maxPop(d.unlock.tier, p.id) < d.unlock.n) return null;
  return shopping(p, c, d.cost);
}

/** Fehlendes Baumaterial für einen Bau. null = geht nicht: zu wenig Taler, oder der Kauf beim
 *  Händler würde die Reserve von 2 500 Talern angreifen. Gekauft wird nie auf Vorrat. */
function shopping(p: Player, c: City, cost: Cost): [GoodId, number][] | null {
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
    spend += lack * pr.kaufen;
  }
  if (spend > 0 && (p.money - spend <= RESERVE || p.money - spend < taler)) return null;
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
  for (const [gd, k] of buy) if (g.trade(p.id, c.island, gd, k) < k) return false;
  for (const s of cands) {
    if (!g.place(type, s.x, s.y, p.id).ok) continue;
    const nb = g.buildingAt(s.x, s.y);
    if (nb && (d.prod || type === 'markt')) connect(g, p, c, nb);
    return true;
  }
  return false;
}

/** Bauplätze für Betriebe, Dienste und Wohnhäuser – beste zuerst */
function sitesFor(g: Game, p: Player, c: City, type: BuildingId): Cand[] {
  const d = BUILDINGS[type];
  if (type === 'haus') return houseSites(g, p, c);
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

/** Reichweite der Marktkarren: Sie holen nur Waren von Betrieben, die höchstens so weit (Arbeitsradius) vom
 *  Kontor oder von einem angeschlossenen Marktplatz entfernt sind – weiter draußen bliebe alles liegen. */
function cartReach(g: Game, c: City): (cx: number, cy: number) => boolean {
  const kern = kernOf(g, c);
  const homes = c.claim.filter((m) => kern.hubs.has(m.id)).map((m) => ({ at: g.center(m), r: (BUILDINGS[m.type].work ?? 9) - 0.5 }));
  return (cx, cy) => homes.some(({ at, r }) => (at[0] - cx) ** 2 + (at[1] - cy) ** 2 <= r * r);
}

/** Dienste (Kapelle …): so viele Wohnhäuser wie möglich in Reichweite, nicht weit vom Kontor */
function serviceSites(g: Game, p: Player, c: City, type: BuildingId): Cand[] {
  const d = BUILDINGS[type];
  const r = (d.radius ?? 8) - 0.5, half = d.size / 2;
  const homes = c.houses.map((h) => g.center(h));
  return scan(g, p.id, c, type, (x, y) => {
    const cx = x + half, cy = y + half;
    let covered = 0;
    for (const [hx, hy] of homes) if ((hx - cx) ** 2 + (hy - cy) ** 2 <= r * r) covered++;
    return covered * 2 - Math.hypot(cx - c.kx, cy - c.ky) * 0.1 - gridTiles(c, type, x, y);
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
  const reach = (BUILDINGS.markt.work ?? 15) - 0.5;
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
  for (const s of g.ships) {
    if (s.owner !== p.id || s.path.length || !s.slots.some((sl) => sl.g && sl.n > 0)) continue;
    if (g.shipDock(s) === kontor) g.unloadAll(s);
  }
}
