// Schiffsfenster: am Kontor ganz oben „Alles ausladen“ und Einladen (+10 / +50 / Max), dann Laderaum,
// Kontor gründen, Zustand sowie die einklappbaren Blöcke Kanonen und Soldaten.
// Handelsrouten kommen aus dem Gerüst ui/trade.ts und erscheinen erst, wenn es sie gibt.
import './ship.css';
import { GOOD, GOODS, GoodId, SHIPS, UNITS } from '../data';
import { armShip, atWar, disarmShip, unloadTroops } from '../combat';
import { HUMAN, Ship } from '../game';
import { sound } from '../audio';
import type { UI } from '../ui';
import { $, hpHtml } from './util';

/** Einladen: so viele Tonnen je Knopf (Max = so viel, wie Lager und Laderaum hergeben) */
const STEPS: (number | 'max')[] = [10, 50, 'max'];
/** so heißt der Segel-Hinweis im Fenster und in der Hilfe */
export const SAIL_HINT = 'Tippe aufs Meer oder auf eine Insel – das Schiff segelt so nah wie möglich heran.';

type Block = 'guns' | 'troops';

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
    // Am Kontor: Löschen und Laden ganz oben
    if (dock) {
      const l = g.lagerOf(HUMAN, dock.island)!;
      const cargo = s.slots.reduce((a, sl) => a + sl.n, 0);
      h += `<h4>⚓ Am Kontor von ${g.islands[dock.island].name}</h4>
        <button class="btn wide ok" id="shipUnload"${cargo ? '' : ' disabled'}>⬇️ Alles ausladen${cargo ? ` (${cargo} t)` : ''}</button>`;
      const loadable = GOODS.filter((gd) => l[gd.id] >= 1);
      if (loadable.length) {
        h += '<p class="sub">Einladen aus dem Kontor:</p>';
        for (const gd of loadable) {
          h += `<div class="load"><span title="${gd.name}">${gd.icon} ${Math.floor(l[gd.id])}</span>` + STEPS.map((n) =>
            `<button class="btn" data-load="${gd.id}" data-n="${n}" aria-label="${gd.name}: ${n === 'max' ? 'so viel wie geht' : `${n} t`} einladen">${n === 'max' ? 'Max' : `+${n}`}</button>`).join('') + '</div>';
        }
      }
    }
    if (canFound) h += `<button class="btn wide ok" id="shipKontor">⚓ Kontor auf ${g.islands[near].name} bauen (💰100 🪵6 🔧3)</button>`;
    // Laderaum
    h += `<h4>Laderaum</h4><div class="slots">`;
    for (const sl of s.slots) h += `<div class="slot">${sl.g ? `<span>${GOOD[sl.g].icon}</span><b>${sl.n}</b>` : '<small>leer</small>'}</div>`;
    h += '</div>';
    h += hpHtml(s.hp ?? sd.hp, sd.hp);
    if ((s.hp ?? sd.hp) < sd.hp) {
      const atWerft = g.buildings.some((b) => (b.type === 'werft' || b.type === 'grosswerft') && b.owner === HUMAN && Math.hypot(g.center(b)[0] - s.x, g.center(b)[1] - s.y) < 7);
      h += `<p class="sub">🔧 ${atWerft ? 'Wird an deiner Werft ausgebessert (braucht Holz im Lager).' : 'Fahre zu deiner Werft, um das Schiff auszubessern.'}</p>`;
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
      if (kl) {
        if (canArm) h += `<button class="btn wide ok" id="shipArm">💣 Bewaffnen (${Math.min(sd.kanonen - (s.guns ?? 0), Math.floor(kl.kanonen))} Kanonen aus dem Lager)</button>`;
        else if ((s.guns ?? 0) < sd.kanonen && g.isUnlocked('kanonengiesserei')) h += `<p class="sub">Kanonen kommen aus der Kanonengießerei ins Lager.</p>`;
        if (s.guns) h += `<button class="btn wide" id="shipDisarm">Kanonen ins Lager zurück</button>`;
      } else if ((s.guns ?? 0) < sd.kanonen) h += `<p class="sub">Kanonen lädst du am Kontor auf.</p>`;
      h += '</div>';
    }
    // Soldaten (einklappbar)
    const tr = s.troops?.length ?? 0;
    if (tr || g.reached(UNITS.infanterie.unlock)) {
      const troopsOpen = this.open.troops ?? (war || tr > 0);
      h += this.foldHead('troops', '🪖 Soldaten an Bord', `${tr} / ${sd.troops}`, troopsOpen);
      if (troopsOpen) {
        h += '<div class="fold-b">';
        if (tr && near >= 0 && !s.path.length) h += `<button class="btn wide ok" id="shipLand">🪖 Soldaten an Land setzen</button>`;
        else if (tr) h += `<p class="sub">Segle an eine Küste, um sie an Land zu setzen.</p>`;
        else h += `<p class="sub">Wähle Soldaten an Land und tippe dann auf dieses Schiff – sie steigen ein.</p>`;
        h += '</div>';
      }
    }
    // Handelsrouten (Gerüst ui/trade.ts)
    if (ui.trade.ready) h += ui.trade.shipHtml(s);
    if (canFound) h += `<h4>Insel in der Nähe</h4>${ui.info.islandHtml(near).replace('<h3>', '<h3 class="small">')}`;
    else if (near < 0 && !s.path.length && !dock) h += '<p class="sub">Segle an eine Küste, um dort ein Kontor zu bauen.</p>';
    if (dock || canFound) h += `<p class="sub">${SAIL_HINT}</p>`;
    if (!ui.setInfo(h)) return;
    this.bind(s);
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
      const n = bt.dataset.n === 'max' ? 1e9 : Number(bt.dataset.n);
      const got = g.loadGood(s, bt.dataset.load as GoodId, n);
      if (got > 0) sound.play('kisten');
      else ui.toast('Kein Platz mehr im Laderaum', 'bad');
      ui.renderInfo();
    }));
    body.querySelectorAll<HTMLElement>('[data-fold]').forEach((bt) => bt.addEventListener('click', () => {
      this.open[bt.dataset.fold as Block] = bt.getAttribute('aria-expanded') !== 'true';
      ui.renderInfo();
    }));
    document.getElementById('shipArm')?.addEventListener('click', () => { const n = armShip(g, s); if (n) { sound.play('kisten'); ui.toast(n === 1 ? '💣 Eine Kanone geladen' : `💣 ${n} Kanonen geladen`, 'good'); } ui.renderInfo(); });
    document.getElementById('shipDisarm')?.addEventListener('click', () => { disarmShip(g, s); sound.play('kisten'); ui.renderInfo(); });
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
  }
}
