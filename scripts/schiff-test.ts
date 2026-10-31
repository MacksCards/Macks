// Schiffs-Test ohne Browser: Wie fährt ein Schiff, wenn man aufs Land oder in den Nebel tippt?
// Erwartung (Wunsch des Nutzers): Tipp aufs Land = in diese Richtung, so weit es geht. Das Schiff hält
// an der zugewandten Küste und fährt nicht um die Insel. Im Nebel verrät der Kurs nichts über Land.
// Ausführen im Projektordner:
//   npx esbuild scripts/schiff-test.ts --bundle --platform=node --outfile=/tmp/schiff-test.cjs && node /tmp/schiff-test.cjs
// Beendet sich mit Fehlercode 1, wenn eine Prüfung fehlschlägt.
const g0 = globalThis as unknown as Record<string, unknown>;
g0.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
import { Game, Ship } from '../src/game';
import { T } from '../src/world';

let fails = 0;
const check = (name: string, cond: boolean, info = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK    ' : 'FEHLER'} ${name}${info ? ' – ' + info : ''}`);
};
const len = (s: Ship, path: [number, number][]) => { let d = 0, px = s.x, py = s.y; for (const [x, y] of path) { d += Math.hypot(x - px, y - py); px = x; py = y; } return d; };
const end = (s: Ship): [number, number] => s.path.length ? s.path[s.path.length - 1] : [s.x, s.y];
/** Schiff fahren lassen, bis es steht; Rückgabe: gefahrene Strecke und ob es je auf Land stand */
function sail(g: Game, s: Ship, maxSec = 300) {
  let dist = 0, onLand = false, px = s.x, py = s.y;
  for (let i = 0; i < maxSec * 4 && s.path.length; i++) {
    g.tick(0.25);
    dist += Math.hypot(s.x - px, s.y - py); px = s.x; py = s.y;
    if (!g.isWater(g.idx(Math.floor(s.x), Math.floor(s.y)))) onLand = true;
  }
  return { dist, onLand, done: !s.path.length };
}
/** erstes Landfeld der Insel auf der Linie vom Schiff zum Tippunkt und das Wasserfeld davor */
function lineStop(g: Game, x0: number, y0: number, x1: number, y1: number, isl: number): [number, number] | null {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 4);
  let last: [number, number] | null = null;
  for (let i = 0; i <= n; i++) {
    const x = Math.floor(x0 + ((x1 - x0) * i) / n), y = Math.floor(y0 + ((y1 - y0) * i) / n);
    const k = g.idx(x, y);
    if (g.isWater(k)) last = [x + 0.5, y + 0.5];
    else if (g.islandOf[k] === isl) return last;
  }
  return last;
}

// 1) Vorlage: größte Insel, Schiff westlich davon, Tipps quer über die Insel
{
  const g = Game.create(12345, 2);
  g.seen.fill(1);
  const sz = g.size;
  const cnt = new Map<number, number>();
  for (let i = 0; i < sz * sz; i++) { const id = g.islandOf[i]; if (id >= 0) cnt.set(id, (cnt.get(id) ?? 0) + 1); }
  const big = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const isl = g.islands[big];
  const cy = Math.round((isl.y0 + isl.y1) / 2);
  const ship = g.myShips()[0];
  let wx = isl.x0 - 3; while (!g.isWater(g.idx(wx, cy))) wx--;
  for (const frac of [0.2, 0.4, 0.6, 0.8, 0.95]) {
    ship.x = wx + 0.5; ship.y = cy + 0.5; ship.path = []; ship.hp = undefined;
    const tx = Math.round(isl.x0 + (isl.x1 - isl.x0) * frac);
    let ty = cy, tries = 0; while (g.islandOf[g.idx(tx, ty)] !== big && tries++ < 30) ty++;
    const okMove = g.moveShip(ship, tx + 0.5, ty + 0.5);
    const e = end(ship);
    const stop = lineStop(g, ship.x, ship.y, tx + 0.5, ty + 0.5, big)!;
    const L = len(ship, ship.path), air = Math.hypot(tx - ship.x, ty - ship.y);
    const facing = Math.hypot(e[0] - stop[0], e[1] - stop[1]) <= 1.5;
    check(`Tipp ${Math.round(frac * 100)} % quer über die Insel: Halt an der zugewandten Küste`, okMove && facing && L <= Math.hypot(e[0] - ship.x, e[1] - ship.y) * 1.2 + 2,
      `Ziel ${e.map((v) => v.toFixed(0)).join(',')} Fahrweg ${L.toFixed(0)} Luftlinie zum Tippunkt ${air.toFixed(0)}`);
    const r = sail(g, ship);
    check(`  … fährt hin, ohne an Land zu geraten`, r.done && !r.onLand, `gefahren ${r.dist.toFixed(0)}`);
  }
}

// 2) Viele Welten: Schiff irgendwo auf dem Meer, Tipp mitten auf eine Insel → nie um die Insel herum
{
  let cases = 0, facing = 0, longWay = 0, noWay = 0;
  for (let w = 0; w < 12; w++) {
    const g = Game.create(31000 + w * 101, 0);
    g.seen.fill(1);
    const ship = g.myShips()[0];
    for (const isl of g.islands) {
      for (let k = 0; k < 6; k++) {
        // Startpunkt auf dem Meer 15–35 Felder vom Inselrand
        const a = (k / 6) * Math.PI * 2 + w;
        const r = Math.max(isl.x1 - isl.x0, isl.y1 - isl.y0) / 2 + 15 + (k % 3) * 10;
        const sx = Math.floor(isl.cx + Math.cos(a) * r), sy = Math.floor(isl.cy + Math.sin(a) * r);
        if (!g.inMap(sx, sy) || !g.isWater(g.idx(sx, sy))) continue;
        // Tipp nahe der Inselmitte (auf Land)
        let tx = Math.floor(isl.cx), ty = Math.floor(isl.cy);
        if (g.islandOf[g.idx(tx, ty)] !== isl.id) continue;
        ship.x = sx + 0.5; ship.y = sy + 0.5; ship.path = [];
        const res = g.moveShip(ship, tx + 0.5, ty + 0.5);
        cases++;
        if (!res) { noWay++; continue; }
        const e = end(ship);
        const stop = lineStop(g, ship.x, ship.y, tx + 0.5, ty + 0.5, isl.id);
        if (stop && Math.hypot(e[0] - stop[0], e[1] - stop[1]) <= 1.5) facing++;
        const L = len(ship, ship.path), direct = Math.hypot(e[0] - ship.x, e[1] - ship.y);
        if (L > direct * 1.5 + 12) longWay++;
        void tx; void ty;
      }
    }
  }
  check(`Viele Welten: ${cases} Tipps auf Inselmitten – nie „kein Weg“`, noWay === 0, `${noWay} ohne Weg`);
  check('Viele Welten: fast immer Halt an der zugewandten Küste', facing >= cases * 0.9, `${facing}/${cases}`);
  check('Viele Welten: kein großer Umweg um die Insel', longWay <= cases * 0.03, `${longWay} mit großem Umweg`);
}

// 3) Nebel: Kurs verrät nichts; das Schiff hält vor der Küste, die es beim Fahren entdeckt
{
  const g = Game.create(12345, 0);
  const ship = g.myShips()[0];
  // eine noch unentdeckte Insel suchen, die vom Startpunkt aus übers Meer erreichbar ist
  const isl = g.islands.filter((i) => !g.islandSeen(i.id)).sort((a, b) => Math.hypot(a.cx - ship.x, a.cy - ship.y) - Math.hypot(b.cx - ship.x, b.cy - ship.y))[0];
  let tx = Math.floor(isl.cx), ty = Math.floor(isl.cy);
  for (let r = 0; r < 10 && g.islandOf[g.idx(tx, ty)] !== isl.id; r++) tx++;
  const landTap = g.moveShip(ship, tx + 0.5, ty + 0.5);
  const e = end(ship);
  const straight = Math.hypot(tx + 0.5 - e[0], ty + 0.5 - e[1]) < 1;
  // zum Vergleich: Tipp in den Nebel aufs Wasser daneben – gleicher Ablauf (gerade Linie)
  const copy = Game.create(12345, 0); const s2 = copy.myShips()[0];
  let wx = tx, wy = ty; for (let r = 1; r < 60 && !copy.isWater(copy.idx(wx, wy)); r++) wx = tx + r;
  copy.moveShip(s2, wx + 0.5, wy + 0.5);
  check('Nebel: Tipp auf unentdecktes Land wird angenommen und geradeaus geplant (wie auf Wasser)', landTap && straight && s2.path.length > 0, `Kurs endet ${straight ? 'am Tippunkt' : 'woanders'}`);
  const stopFull = lineStop(g, ship.x, ship.y, tx + 0.5, ty + 0.5, isl.id);
  const r = sail(g, ship, 400);
  const dStop = stopFull ? Math.hypot(ship.x - stopFull[0], ship.y - stopFull[1]) : 99;
  check('Nebel: beim Näherkommen wird neu geplant – Halt an der zugewandten Küste, nie an Land', r.done && !r.onLand && dStop <= 4, `Abstand zum Küstenpunkt ${dStop.toFixed(1)}, gefahren ${r.dist.toFixed(0)}`);
}

// 3b) Nebel in vielen Welten: Tipp auf die Mitte der nächsten unentdeckten Insel. Das Schiff darf um schon
//     sichtbares Land herum planen, an neu entdecktem Land aber nicht entlangkriechen: höchstens 6 Felder mehr
//     als der erste Kurs, und es hält direkt vor einer Küste.
{
  let n = 0, good = 0, worstExtra = 0;
  for (let w = 0; w < 16; w++) {
    const g = Game.create(61000 + w * 53, 0);
    const ship = g.myShips()[0];
    const isl = g.islands.filter((i) => !g.islandSeen(i.id)).sort((a, b) => Math.hypot(a.cx - ship.x, a.cy - ship.y) - Math.hypot(b.cx - ship.x, b.cy - ship.y))[0];
    if (!isl) continue;
    let tx = Math.floor(isl.cx), ty = Math.floor(isl.cy);
    for (let r = 0; r < 10 && g.islandOf[g.idx(tx, ty)] !== isl.id; r++) tx++;
    if (g.islandOf[g.idx(tx, ty)] !== isl.id) continue;
    if (!g.moveShip(ship, tx + 0.5, ty + 0.5)) continue;
    n++;
    const first = len(ship, ship.path);
    const r = sail(g, ship, 600);
    let coast = 99;
    for (let y = Math.floor(ship.y) - 3; y <= ship.y + 3; y++) for (let x = Math.floor(ship.x) - 3; x <= ship.x + 3; x++) if (g.inMap(x, y) && !g.isWater(g.idx(x, y))) coast = Math.min(coast, Math.hypot(x + 0.5 - ship.x, y + 0.5 - ship.y));
    const extra = r.dist - Math.min(first, r.dist);
    worstExtra = Math.max(worstExtra, r.dist > first ? r.dist - first : 0);
    if (r.done && !r.onLand && coast <= 2.5 && r.dist <= first + 6.5) good++;
    else console.log(`   Welt ${w}: gefahren ${r.dist.toFixed(0)} (erster Kurs ${first.toFixed(0)}), Küste ${coast.toFixed(1)} entfernt`);
    void extra;
  }
  check('Nebel in vielen Welten: kein Entlangkriechen, Halt vor der Küste', n >= 10 && good === n, `${good}/${n}, größter Umweg ${worstExtra.toFixed(1)} Felder`);
}

// 4) Nebel: eine Insel liegt unbekannt zwischen Schiff und bekanntem Ziel → Umweg nach dem Entdecken
{
  let tested = 0, arrived = 0;
  for (let w = 0; w < 8 && tested < 3; w++) {
    const g = Game.create(52000 + w * 17, 0);
    const ship = g.myShips()[0];
    // Ziel auf dem Wasser hinter einer Insel (Linie Schiff → Ziel kreuzt die Insel)
    for (const isl of g.islands) {
      const dx = isl.cx - ship.x, dy = isl.cy - ship.y, d = Math.hypot(dx, dy);
      const gx = Math.floor(isl.cx + (dx / d) * ((isl.x1 - isl.x0) / 2 + 12)), gy = Math.floor(isl.cy + (dy / d) * ((isl.y1 - isl.y0) / 2 + 12));
      if (!g.inMap(gx, gy) || !g.isWater(g.idx(gx, gy)) || g.islandSeen(isl.id)) continue;
      g.reveal(gx + 0.5, gy + 0.5, 3); // Ziel ist bekannt, die Insel davor nicht
      ship.path = [];
      if (!g.moveShip(ship, gx + 0.5, gy + 0.5)) continue;
      tested++;
      const r = sail(g, ship, 500);
      if (r.done && !r.onLand && Math.hypot(ship.x - gx - 0.5, ship.y - gy - 0.5) < 1.5) arrived++;
      break;
    }
  }
  check('Nebel: Insel auf dem Weg zum bekannten Ziel wird umfahren', tested > 0 && arrived === tested, `${arrived}/${tested}`);
}

// 5) Nie „kein Weg“, solange sich das Schiff bewegen kann; beschädigt = langsamer
{
  const g = Game.create(12345, 0);
  g.seen.fill(1);
  const ship = g.myShips()[0];
  // Schiff direkt an eine Küste setzen und gleich daneben aufs Land tippen
  let done = false;
  for (let y = 5; y < g.size - 5 && !done; y++) for (let x = 5; x < g.size - 5 && !done; x++) {
    if (!g.isWater(g.idx(x, y)) || g.isWater(g.idx(x + 1, y))) continue;
    ship.x = x + 0.5; ship.y = y + 0.5; ship.path = [];
    check('Tipp aufs Land direkt neben dem Schiff: kein „kein Weg“', g.moveShip(ship, x + 1.5, y + 0.5));
    done = true;
  }
  // außerhalb der Karte: wird an den Rand geklemmt, kein Absturz
  ship.path = [];
  check('Tipp außerhalb der Karte: kein Fehler', typeof g.moveShip(ship, -20, 9999) === 'boolean');
  // Tempo
  let row = -1;
  for (let y = 5; y < 230 && row < 0; y++) { let free = true; for (let x = 5; x < 40; x++) if (!g.isWater(g.idx(x, y))) { free = false; break; } if (free) row = y; }
  const v = (hp: number | undefined) => { ship.x = 6.5; ship.y = row + 0.5; ship.hp = hp; ship.path = [[38.5, row + 0.5]]; ship.goal = undefined; const x0 = ship.x; g.tick(1); return ship.x - x0; };
  const full = v(undefined), half = v(25);
  check('beschädigtes Schiff fährt langsamer (halbe Treffer → 75 %)', Math.abs(half / full - 0.75) < 0.02, `${full.toFixed(2)} → ${half.toFixed(2)} Felder/s`);
  ship.hp = undefined;
}

// 6) Fahrzeit der Kursplanung (darf das Spiel nicht spürbar anhalten)
{
  const g = Game.create(777, 0);
  g.seen.fill(1);
  const ship = g.myShips()[0];
  let worst = 0;
  for (const isl of g.islands) {
    const t0 = performance.now();
    g.moveShip(ship, isl.cx, isl.cy);
    worst = Math.max(worst, performance.now() - t0);
    ship.path = [];
  }
  check('Kursplanung schnell genug', worst < 60, `langsamste ${worst.toFixed(1)} ms`);
}

void T;
console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden');
if (fails) (globalThis as unknown as { process: { exit(n: number): void } }).process.exit(1);
