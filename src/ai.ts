// Computergegner: suchen eine Insel, gründen ein Kontor und bauen eine Siedlung –
// nach denselben Regeln und Kosten wie der Spieler (kein Schummeln).
import { BUILDINGS, BuildingId } from './data';
import type { Game, Player } from './game';
import { T } from './world';

const THINK = 3; // Sekunden Spielzeit zwischen Entscheidungen

export function thinkAI(g: Game, p: Player, dt: number) {
  const b = p.brain!;
  b.t += dt;
  if (b.t < THINK) return;
  b.t = 0;
  const ship = g.ships.find((s) => s.owner === p.id);
  switch (b.phase) {
    case 'suchen': {
      if (!ship) return;
      const target = chooseIsland(g, p, ship.x, ship.y);
      if (target < 0) return;
      const spot = coastWater(g, target, ship.x, ship.y);
      if (!spot || !g.moveShip(ship, spot[0] + 0.5, spot[1] + 0.5)) { b.tries++; return; }
      b.island = target;
      b.phase = 'fahren';
      return;
    }
    case 'fahren':
      if (ship && !ship.path.length) b.phase = 'gruenden';
      return;
    case 'gruenden': {
      if (!ship) return;
      const r = 8;
      const cands: [number, number, number][] = [];
      for (let y = Math.floor(ship.y) - r; y <= Math.floor(ship.y) + r; y++) for (let x = Math.floor(ship.x) - r; x <= Math.floor(ship.x) + r; x++) {
        if (!g.inMap(x, y) || g.islandOf[g.idx(x, y)] !== b.island) continue;
        if (!g.canPlace('kontor', x, y, p.id).ok) continue;
        cands.push([x, y, landAround(g, x + 1.5, y + 1.5, 10)]);
      }
      cands.sort((a, c) => c[2] - a[2]);
      if (cands.length) {
        const [x, y] = cands[0];
        g.place('kontor', x, y, p.id);
        g.unloadAll(ship);
        b.phase = 'aufbau';
        g.ev.message(`${p.name} hat ein Kontor auf ${g.islands[b.island].name} gegründet.`, 'info');
      } else {
        // Insel inzwischen belegt oder keine Küste gefunden → neu suchen
        b.tries++;
        b.phase = 'suchen';
      }
      return;
    }
    case 'aufbau':
      build(g, p);
  }
}

function landAround(g: Game, cx: number, cy: number, r: number) {
  let n = 0;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    if (!g.inMap(x, y)) continue;
    const t = g.tiles[g.idx(x, y)];
    if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && t !== T.Wasser && t !== T.Berg) n++;
  }
  return n;
}

/** Beste freie Insel: groß, mit Erz/Gold, fruchtbar, nicht zu weit, nicht von anderen anvisiert */
function chooseIsland(g: Game, p: Player, sx: number, sy: number): number {
  const taken = new Set(g.buildings.filter((b) => b.type === 'kontor').map((b) => b.island));
  for (const o of g.players) if (o.brain && o.id !== p.id && o.brain.island >= 0) taken.add(o.brain.island);
  let best = -1, bs = -1e9;
  for (const isl of g.islands) {
    if (taken.has(isl.id) || isl.land < 120) continue;
    const fert = Object.values(isl.frucht).reduce((a, v) => a + (v ?? 0), 0);
    const score = isl.land * 0.5 + (isl.erz ? 60 : 0) + (isl.gold ? 40 : 0) + fert * 0.3 - Math.hypot(isl.cx - sx, isl.cy - sy) * 1.6;
    if (score > bs) { bs = score; best = isl.id; }
  }
  return best;
}

/** Wasserfeld direkt an der Küste der Insel, möglichst nahe am Schiff */
function coastWater(g: Game, island: number, sx: number, sy: number): [number, number] | null {
  const isl = g.islands[island];
  let best: [number, number] | null = null, bd = 1e9;
  for (let y = isl.y0 - 1; y <= isl.y1 + 1; y++) for (let x = isl.x0 - 1; x <= isl.x1 + 1; x++) {
    if (!g.inMap(x, y) || g.tiles[g.idx(x, y)] !== T.Wasser) continue;
    let coast = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g.inMap(x + dx, y + dy) && g.islandOf[g.idx(x + dx, y + dy)] === island) coast = true;
    if (!coast) continue;
    const d = Math.hypot(x - sx, y - sy);
    if (d < bd) { bd = d; best = [x, y]; }
  }
  return best;
}

function build(g: Game, p: Player) {
  const b = p.brain!;
  const kontor = g.kontor(p.id, b.island);
  if (!kontor) return;
  const [kx, ky] = g.center(kontor);
  const isl = g.islands[b.island];
  // 1. Wegenetz (alle 4 Felder) auf freiem, nicht bewaldetem Eigenland
  if (!b.grid) {
    const cells: [number, number][] = [];
    for (let y = isl.y0; y <= isl.y1; y++) for (let x = isl.x0; x <= isl.x1; x++) {
      const k = g.idx(x, y);
      if (g.own[k] !== p.id || g.tiles[k] === T.Wald) continue;
      if ((x - Math.floor(kx)) % 4 === 0 || (y - Math.floor(ky)) % 4 === 0) cells.push([x, y]);
    }
    g.placeRoads(cells, p.id);
    b.grid = true;
    return;
  }
  const count = (t: BuildingId) => g.buildings.filter((o) => o.owner === p.id && o.type === t).length;
  const pop = g.buildings.filter((o) => o.owner === p.id && o.type === 'haus').reduce((a, o) => a + o.residents, 0);
  const lager = g.lagerOf(p.id, b.island);
  const food = count('fischer') * 50 + count('jagdhuette') * 35 + count('schweinezucht') * 60;
  // Baumaterial beim Händler nachkaufen, solange das Geld reicht
  if (lager && lager.werkzeug < 6 && p.money > 1200) g.trade(p.id, b.island, 'werkzeug', 10);
  if (lager && lager.holz < 6 && p.money > 800) g.trade(p.id, b.island, 'holz', 10);
  const wish: BuildingId[] = [];
  if (!count('holzfaeller')) wish.push('holzfaeller');
  if (food < pop + 25) wish.push('fischer', 'jagdhuette', 'schweinezucht');
  if (!count('markt')) wish.push('markt');
  if (pop >= 20 && !count('kapelle')) wish.push('kapelle');
  if (pop >= 35 && !count('schaffarm')) wish.push('schaffarm');
  if (pop >= 35 && count('schaffarm') && !count('weberei')) wish.push('weberei');
  if (count('schweinezucht') > count('fleischerei')) wish.push('fleischerei');
  if (lager && lager.holz < 8 && count('holzfaeller') < 3) wish.push('holzfaeller');
  if (count('haus') < 40 && p.money > 400) wish.push('haus');
  for (const t of wish) if (tryPlace(g, p, t, kx, ky)) return;
  // Gebiet erweitern: neuer Marktplatz am Rand, wenn es eng wird
  if (count('haus') >= 10 * Math.max(1, count('markt')) && p.money > 1500) tryPlace(g, p, 'markt', kx, ky, true);
}

/** Besten Bauplatz für ein Gebäude im eigenen Gebiet suchen und bauen */
function tryPlace(g: Game, p: Player, type: BuildingId, kx: number, ky: number, far = false): boolean {
  const d = BUILDINGS[type];
  const isl = g.islands[p.brain!.island];
  const markets = g.buildings.filter((o) => o.owner === p.id && (o.type === 'markt' || o.type === 'kontor'));
  let best: [number, number] | null = null, bs = -1e9;
  for (let y = isl.y0; y <= isl.y1; y++) for (let x = isl.x0; x <= isl.x1; x++) {
    if (g.own[g.idx(x, y)] !== p.id) continue;
    if (!g.canPlace(type, x, y, p.id).ok) continue;
    const cx = x + d.size / 2, cy = y + d.size / 2;
    const dist = Math.hypot(cx - kx, cy - ky);
    let road = false;
    for (const [rx, ry] of g.ring({ type, x, y })) if (g.inMap(rx, ry) && g.roads[g.idx(rx, ry)]) road = true;
    let score = far ? dist : -dist * 0.15;
    if (d.prod) {
      score += g.siteEfficiency(type, x, y) * 10 + (road ? 6 : -50);
      if (d.needs && g.siteEfficiency(type, x, y) < 0.35) continue;
    } else if (type === 'haus') {
      const covered = markets.some((m) => { const [mx, my] = g.center(m); return Math.hypot(mx - cx, my - cy) < (BUILDINGS[m.type].radius ?? 8) - 1; });
      score += (covered ? 8 : -20) + (road ? 2 : 0);
    }
    if (score > bs) { bs = score; best = [x, y]; }
  }
  if (!best) return false;
  return g.place(type, best[0], best[1], p.id).ok;
}
