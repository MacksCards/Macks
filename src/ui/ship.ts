// Schiffsfenster: Laderaum, Zustand, die einklappbaren Blöcke Kanonen, Soldaten und „Waren umladen“ (je Ware
// −10 / +10 / Max, anfangs zu). Am Kontor ist jeder volle Laderaum ein Knopf „⬇ ausladen“. Die Hauptknöpfe (Kontor
// bauen, Alles ausladen, Bewaffnen, an Land setzen) stehen in der festen Fußleiste des Infofensters und sind so
// immer ohne Wischen erreichbar. Schalter „Weiße Flagge“, Handelsroute und „Abwracken“ (mit Rückfrage) kommen aus
// ui/trade.ts bzw. combat.ts (Paket U5).
// Lagerbestände ändern sich laufend: sie stehen nicht im HTML, sondern paint() setzt sie in die vorhandenen
// Elemente – so wird das Fenster nicht alle 0,25 s neu aufgebaut und kein Tipp geht verloren.
import './ship.css';
import { GOOD, GOODS, GoodId, SHIPS, SLOT_CAP, UNITS } from '../data';
import { armShip, atWar, disarmShip, setWhiteFlag, stopPatrol, unloadTroops, whiteFlag } from '../combat';
import { HUMAN, Ship } from '../game';
import { sound } from '../audio';
import type { UI } from '../ui';
import { $, hpHtml } from './util';

/** Umladen je Ware: −10 = ins Kontor, +10 = aufs Schiff, Max = so viel, wie Lager und Laderaum hergeben */
const STEPS: (number | 'max')[] = [-10, 10, 'max'];
/** so heißt der Segel-Hinweis im Fenster und in der Hilfe */
export const SAIL_HINT = 'Tippe aufs Meer oder auf eine Insel – das Schiff segelt so nah wie möglich heran.';

type Block = 'guns' | 'troops' | 'load';

export class ShipPanel {
  /** vom Spieler auf- oder zugeklappte Blöcke (ohne Wahl: offen bei Krieg oder wenn es dort etwas gibt) */
  private open: Partial<Record<Block, boolean>> = {};

  constructor(private ui: UI) {}

  render(s: Ship) {
    const ui = this.ui, g = ui.g;
    const sd = SHIPS[s.type ?? 'handel_klein'];
    const dock = g.shipDock(s);
    const near = g.shipNearIsland(s);
    const canFound = near >= 0 && !g.kontor(HUMAN, near) && !s.path.length;
    // Krieg mit einem Konkurrenten (Piraten zählen hier nicht – mit ihnen gilt immer „Krieg“)
    const war = g.players.some((p) => p.id !== HUMAN && !p.pirate && atWar(g, HUMAN, p.id));
    let h = `<h3>⛵ ${s.name}</h3><p class="sub">${sd.name} · ${s.path.length ? 'unterwegs …' : 'liegt vor Anker'}</p>`;
    if (!dock && !canFound) h += `<p class="sub">${SAIL_HINT}</p>`;
    // Hauptknöpfe (Kontor bauen, Ausladen, Bewaffnen, an Land setzen) stehen in der festen Fußleiste
    let foot = '';
    if (canFound) foot += `<button class="btn ok" id="shipKontor">⚓ Kontor auf ${g.islands[near].name} bauen<small>💰100 🪵6 🔧3</small></button>`;
    // Am Kontor: Ausladen unten in der Fußleiste, Einladen einklappbar (anfangs zu, damit nichts verdeckt wird)
    if (dock) {
      const l = g.lagerOf(HUMAN, dock.island)!;
      const cargo = s.slots.reduce((a, sl) => a + sl.n, 0);
      h += `<p class="sub">⚓ Am Kontor von ${g.islands[dock.island].name}</p>`;
      if (cargo) foot += `<button class="btn ok" id="shipUnload">⬇️ Alles ausladen<small>${cargo} t an Bord</small></button>`;
      // Waren, die im Kontor liegen oder an Bord sind (die Liste ändert sich selten; die Mengen setzt paint())
      const movable = GOODS.filter((gd) => l[gd.id] >= 1 || g.shipCargo(s, gd.id) > 0);
      if (movable.length) {
        const loadOpen = this.open.load ?? false;
        h += this.foldHead('load', '📦 Umladen', `${movable.length} Waren`, loadOpen);
        if (loadOpen) {
          h += '<div class="fold-b"><p class="sub">⚓ im Kontor · ⛵ an Bord. −10 bringt Ware ins Kontor, +10 und Max aufs Schiff.</p>';
          for (const gd of movable) {
            h += `<div class="load" data-lg="${gd.id}"><span title="${gd.name}"><em>${gd.icon}</em><b>${gd.name}</b><small class="lk">⚓ –</small><small class="ls">⛵ –</small></span>` + STEPS.map((n) =>
              `<button class="btn" data-load="${gd.id}" data-n="${n}" aria-label="${gd.name}: ${n === 'max' ? 'so viel wie geht einladen' : n < 0 ? `${-n} t ausladen` : `${n} t einladen`}">${n === 'max' ? 'Max' : n < 0 ? `−${-n}` : `+${n}`}</button>`).join('') + '</div>';
          }
          h += '</div>';
        }
      }
    }
    // Laderaum: am Kontor ist jeder volle Laderaum ein Knopf zum Ausladen
    h += `<h4>Laderaum</h4><div class="slots">`;
    s.slots.forEach((sl, i) => {
      if (sl.g && dock) h += `<button class="slot btn" data-unl="${i}" aria-label="Laderaum ${i + 1}: ${sl.n} t ${GOOD[sl.g].name} ausladen"><span>${GOOD[sl.g].icon}</span><b>${sl.n}</b><small>⬇ aus</small></button>`;
      else h += `<div class="slot">${sl.g ? `<span>${GOOD[sl.g].icon}</span><b>${sl.n}</b>` : '<small>leer</small>'}</div>`;
    });
    h += '</div>';
    h += hpHtml(s.hp ?? sd.hp, sd.hp);
    if ((s.hp ?? sd.hp) < sd.hp) {
      const atWerft = g.buildings.some((b) => (b.type === 'werft' || b.type === 'grosswerft') && b.owner === HUMAN && Math.hypot(g.center(b)[0] - s.x, g.center(b)[1] - s.y) < 7);
      h += `<p class="sub">🔧 ${atWerft ? 'Wird an deiner Werft ausgebessert (braucht Holz im Lager).' : 'Fahre zu deiner Werft, um das Schiff auszubessern.'}</p>`;
    }
    // Weiße Flagge (erst, wenn Piraten gesichtet wurden oder Krieg herrscht): friedliche Fahrt
    if (g.pirateSeen || war) {
      // Schalter: an = friedliche Fahrt
      const wf = whiteFlag(g, s);
      h += `<div class="switchrow sflag"><span>🏳️ Weiße Flagge<small>${wf ? (s.troops?.length ? 'Schützt nicht, solange Soldaten an Bord sind.' : 'Piraten und Gegner lassen das Schiff in Ruhe; deine Kanonen schweigen.') : 'Gehisst lassen Piraten und Gegner das Schiff in Ruhe.'}</small></span>`
        + `<button class="btn${wf ? ' on' : ''}" id="shipFlag" role="switch" aria-checked="${wf}" aria-label="Weiße Flagge">${wf ? '🏳️ Gehisst' : 'Eingeholt'}</button></div>`;
    }
    // Kanonen (einklappbar; ohne eigene Wahl offen bei Krieg, wenn Kanonen an Bord sind
    // oder wenn das Kontor hier Kanonen zum Bewaffnen hat)
    const kl = dock ? g.lagerOf(HUMAN, dock.island) : null;
    const canArm = !!kl && (s.guns ?? 0) < sd.kanonen && kl.kanonen >= 1;
    const gunsOpen = this.open.guns ?? (war || (s.guns ?? 0) > 0 || canArm);
    h += this.foldHead('guns', '💣 Kanonen', `${s.guns ?? 0} / ${sd.kanonen}`, gunsOpen);
    if (gunsOpen) {
      h += '<div class="fold-b">';
      if (s.guns) h += `<p class="sub">Tippe auf ein feindliches Schiff oder Gebäude, um es zu beschießen.</p>`;
      // (U4) Patrouille und Flotte (Bedienung in ui/units.ts)
      if (s.guns) h += `<button class="btn wide" id="shipPatrol">🔁 ${s.patrol ? 'Patrouille beenden' : 'Patrouille fahren'}</button>`;
      if (g.ships.filter((o) => o.owner === HUMAN).length > 1) h += `<p class="sub">Ein weiteres eigenes Schiff antippen nimmt es dazu – dann fahren und kämpfen sie gemeinsam.</p>`;
      if (kl) {
        if (!canArm && (s.guns ?? 0) < sd.kanonen && g.isUnlocked('kanonengiesserei')) h += `<p class="sub">Kanonen kommen aus der Kanonengießerei ins Lager.</p>`;
        if (s.guns) h += `<button class="btn wide" id="shipDisarm">Kanonen ins Lager zurück</button>`;
      } else if ((s.guns ?? 0) < sd.kanonen) h += `<p class="sub">Kanonen lädst du am Kontor auf.</p>`;
      h += '</div>';
    }
    if (canArm) foot += `<button class="btn ok" id="shipArm">💣 Bewaffnen<small>${Math.min(sd.kanonen - (s.guns ?? 0), Math.floor(kl!.kanonen))} Kanonen aus dem Lager</small></button>`;
    // Soldaten (einklappbar)
    const tr = s.troops?.length ?? 0;
    if (tr || g.reached(UNITS.infanterie.unlock)) {
      const troopsOpen = this.open.troops ?? (war || tr > 0);
      h += this.foldHead('troops', '🪖 Soldaten an Bord', `${tr} / ${sd.troops}`, troopsOpen);
      if (troopsOpen) {
        h += '<div class="fold-b">';
        // mit Soldaten an der Küste steht „An Land setzen“ unten in der Fußleiste
        if (tr && (near < 0 || s.path.length)) h += `<p class="sub">Segle an eine Küste, um sie an Land zu setzen.</p>`;
        else if (!tr) h += `<p class="sub">Wähle Soldaten an Land und tippe dann auf dieses Schiff – sie steigen ein.</p>`;
        h += '</div>';
      }
      if (tr && near >= 0 && !s.path.length) foot += `<button class="btn ok" id="shipLand">🪖 An Land setzen<small>${tr} Soldaten</small></button>`;
    }
    // Handelsroute und Abwracken (ui/trade.ts)
    if (ui.trade.ready) h += ui.trade.shipHtml(s);
    h += ui.trade.scrapHtml(s);
    if (canFound) h += `<h4>Insel in der Nähe</h4>${ui.info.islandHtml(near).replace('<h3>', '<h3 class="small">')}`;
    else if (near < 0 && !s.path.length && !dock) h += '<p class="sub">Segle an eine Küste, um dort ein Kontor zu bauen.</p>';
    if (dock || canFound) h += `<p class="sub">${SAIL_HINT}</p>`;
    if (ui.setInfo(h, foot)) this.bind(s);
    this.paint(s);
  }

  /** laufende Zahlen setzen (Lager im Kontor, Ladung je Ware, Zustand der Route) – ohne neu aufzubauen */
  private paint(s: Ship) {
    const ui = this.ui, g = ui.g, body = $('#infoBody');
    const dock = g.shipDock(s);
    const l = dock ? g.lagerOf(HUMAN, dock.island) : null;
    if (l) {
      const free = s.slots.some((sl) => !sl.g);
      const cap = g.capOf(HUMAN, dock!.island);
      body.querySelectorAll<HTMLElement>('[data-lg]').forEach((row) => {
        const id = row.dataset.lg as GoodId;
        const have = Math.floor(l[id]), on = g.shipCargo(s, id);
        const lk = row.querySelector('.lk'), ls = row.querySelector('.ls');
        if (lk && lk.textContent !== `⚓ ${have}`) lk.textContent = `⚓ ${have}`;
        if (ls && ls.textContent !== `⛵ ${on}`) ls.textContent = `⛵ ${on}`;
        // Knöpfe, die gerade nichts bewirken, blass (antippen erklärt, warum)
        const canLoad = have >= 1 && (free || s.slots.some((sl) => sl.g === id && sl.n < SLOT_CAP));
        row.querySelectorAll<HTMLElement>('[data-n]').forEach((bt) => {
          const off = bt.dataset.n === '-10' ? on <= 0 || have >= cap : !canLoad;
          if ((bt.getAttribute('aria-disabled') === 'true') !== off) bt.setAttribute('aria-disabled', String(off));
        });
      });
    }
    ui.trade.paintShip(body, s);
  }

  /** Kopfzeile eines einklappbaren Blocks */
  private foldHead(k: Block, title: string, value: string, open: boolean): string {
    return `<button class="fold-h" data-fold="${k}" aria-expanded="${open}"><span>${title}</span><b>${value} <i>${open ? '▾' : '▸'}</i></b></button>`;
  }

  private bind(s: Ship) {
    const ui = this.ui, g = ui.g;
    const body = $('#infoBody');
    document.getElementById('shipUnload')?.addEventListener('click', () => {
      const dock = g.shipDock(s);
      const n = g.unloadAll(s);
      if (n > 0) sound.play('kisten');
      const left = s.slots.reduce((a, sl) => a + sl.n, 0);
      const cap = dock ? g.capOf(HUMAN, dock.island) : 0;
      ui.toast(n ? `${n} t ins Kontor geladen${left ? ` – ${left} t bleiben an Bord (Lager voll, ${cap} t je Ware)` : ''}` : `Kontor ist voll (${cap} t je Ware)`, n ? 'good' : 'bad');
      ui.renderInfo();
    });
    body.querySelectorAll<HTMLElement>('[data-load]').forEach((bt) => bt.addEventListener('click', () => {
      const id = bt.dataset.load as GoodId;
      const n = bt.dataset.n === 'max' ? 1e9 : Number(bt.dataset.n);
      if (n < 0) {
        // −10: ins Kontor (nur so viel, wie im Lager Platz ist)
        const got = g.unloadGood(s, id, -n);
        if (got > 0) sound.play('kisten');
        else if (g.shipCargo(s, id) <= 0) ui.toast(`${GOOD[id].name}: nichts an Bord`, 'info');
        else { const dock = g.shipDock(s); ui.toast(`Kontor ist voll (${dock ? g.capOf(HUMAN, dock.island) : 0} t je Ware)`, 'bad'); }
      } else {
        const got = g.loadGood(s, id, n);
        if (got > 0) sound.play('kisten');
        else ui.toast(g.shipDock(s) && (g.lagerOf(HUMAN, g.shipDock(s)!.island)?.[id] ?? 0) < 1 ? `${GOOD[id].name}: nichts im Kontor` : 'Kein Platz mehr im Laderaum', 'bad');
      }
      ui.renderInfo();
    }));
    // ein Laderaum: ⬇ ausladen
    body.querySelectorAll<HTMLElement>('[data-unl]').forEach((bt) => bt.addEventListener('click', () => {
      const sl = s.slots[Number(bt.dataset.unl)];
      if (!sl?.g) return;
      const got = g.unloadGood(s, sl.g, sl.n);
      if (got > 0) sound.play('kisten');
      else { const dock = g.shipDock(s); ui.toast(`Kontor ist voll (${dock ? g.capOf(HUMAN, dock.island) : 0} t je Ware)`, 'bad'); }
      ui.renderInfo();
    }));
    body.querySelectorAll<HTMLElement>('[data-fold]').forEach((bt) => bt.addEventListener('click', () => {
      this.open[bt.dataset.fold as Block] = bt.getAttribute('aria-expanded') !== 'true';
      ui.renderInfo();
    }));
    document.getElementById('shipArm')?.addEventListener('click', () => { const n = armShip(g, s); if (n) { sound.play('kisten'); ui.toast(n === 1 ? '💣 Eine Kanone geladen' : `💣 ${n} Kanonen geladen`, 'good'); } ui.renderInfo(); });
    document.getElementById('shipFlag')?.addEventListener('click', () => {
      const on = !whiteFlag(g, s);
      setWhiteFlag(g, s, on);
      sound.play('klick');
      ui.toast(on ? '🏳️ Weiße Flagge gehisst' : 'Weiße Flagge eingeholt', 'info');
      ui.renderInfo();
    });
    document.getElementById('shipDisarm')?.addEventListener('click', () => { disarmShip(g, s); sound.play('kisten'); ui.renderInfo(); });
    // (U4) Patrouille: Ziel aufs Meer tippen bzw. beenden
    document.getElementById('shipPatrol')?.addEventListener('click', () => { if (s.patrol) { stopPatrol(g, s); ui.toast('Patrouille beendet', 'info'); ui.renderInfo(); } else ui.units.startPatrol([s]); });
    document.getElementById('shipLand')?.addEventListener('click', () => {
      const n = unloadTroops(g, s);
      ui.toast(n ? (n === 1 ? '🪖 Ein Soldat an Land' : `🪖 ${n} Soldaten an Land`) : 'Hier ist kein Platz an der Küste', n ? 'good' : 'bad');
      if (n) sound.play('marsch');
      ui.renderInfo();
    });
    document.getElementById('shipKontor')?.addEventListener('click', () => {
      ui.selectShip(null);
      ui.setMode({ kind: 'build', type: 'kontor', gx: 0, gy: 0, has: false });
      ui.toast('Tippe auf die Küste neben dem Schiff', 'info');
    });
    if (ui.trade.ready) ui.trade.bindShip(body, s);
    ui.trade.bindScrap(body, s);
  }
}
