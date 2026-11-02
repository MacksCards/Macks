// Schiffsfenster: Laderaum, Zustand, die einklappbaren Blöcke Kanonen, Soldaten und Einladen (+10 / +50 / Max,
// anfangs zu). Die Hauptknöpfe (Kontor bauen, Alles ausladen, Bewaffnen, an Land setzen) stehen in der festen
// Fußleiste des Infofensters und sind so immer ohne Wischen erreichbar.
// Handelsrouten kommen aus dem Gerüst ui/trade.ts und erscheinen erst, wenn es sie gibt.
import './ship.css';
import { GOOD, GOODS, GoodId, SHIPS, UNITS } from '../data';
import { armShip, atWar, disarmShip, setWhiteFlag, stopPatrol, unloadTroops, whiteFlag } from '../combat';
import { HUMAN, Ship } from '../game';
import { sound } from '../audio';
import type { UI } from '../ui';
import { $, hpHtml } from './util';

/** Einladen: so viele Tonnen je Knopf (Max = so viel, wie Lager und Laderaum hergeben) */
const STEPS: (number | 'max')[] = [10, 50, 'max'];
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
      const loadable = GOODS.filter((gd) => l[gd.id] >= 1);
      if (loadable.length) {
        const loadOpen = this.open.load ?? false;
        h += this.foldHead('load', '📦 Einladen', `${loadable.length} Waren`, loadOpen);
        if (loadOpen) {
          h += '<div class="fold-b"><p class="sub">Aus dem Kontor aufs Schiff:</p>';
          for (const gd of loadable) {
            h += `<div class="load"><span title="${gd.name}">${gd.icon} ${Math.floor(l[gd.id])}</span>` + STEPS.map((n) =>
              `<button class="btn" data-load="${gd.id}" data-n="${n}" aria-label="${gd.name}: ${n === 'max' ? 'so viel wie geht' : `${n} t`} einladen">${n === 'max' ? 'Max' : `+${n}`}</button>`).join('') + '</div>';
          }
          h += '</div>';
        }
      }
    }
    // Laderaum
    h += `<h4>Laderaum</h4><div class="slots">`;
    for (const sl of s.slots) h += `<div class="slot">${sl.g ? `<span>${GOOD[sl.g].icon}</span><b>${sl.n}</b>` : '<small>leer</small>'}</div>`;
    h += '</div>';
    h += hpHtml(s.hp ?? sd.hp, sd.hp);
    if ((s.hp ?? sd.hp) < sd.hp) {
      const atWerft = g.buildings.some((b) => (b.type === 'werft' || b.type === 'grosswerft') && b.owner === HUMAN && Math.hypot(g.center(b)[0] - s.x, g.center(b)[1] - s.y) < 7);
      h += `<p class="sub">🔧 ${atWerft ? 'Wird an deiner Werft ausgebessert (braucht Holz im Lager).' : 'Fahre zu deiner Werft, um das Schiff auszubessern.'}</p>`;
    }
    // Weiße Flagge (erst, wenn Piraten gesichtet wurden oder Krieg herrscht): friedliche Fahrt
    if (g.pirateSeen || war) {
      const wf = whiteFlag(g, s);
      h += `<button class="btn wide" id="shipFlag" aria-pressed="${wf}">🏳️ ${wf ? 'Weiße Flagge einholen' : 'Weiße Flagge hissen'}</button>`;
      h += `<p class="sub">${wf ? 'Piraten und Gegner lassen das Schiff in Ruhe (nicht mit Soldaten an Bord). Deine Kanonen schießen nicht von selbst.' : 'Mit weißer Flagge lassen Piraten und Gegner das Schiff in Ruhe.'}</p>`;
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
    // Handelsrouten (Gerüst ui/trade.ts)
    if (ui.trade.ready) h += ui.trade.shipHtml(s);
    if (canFound) h += `<h4>Insel in der Nähe</h4>${ui.info.islandHtml(near).replace('<h3>', '<h3 class="small">')}`;
    else if (near < 0 && !s.path.length && !dock) h += '<p class="sub">Segle an eine Küste, um dort ein Kontor zu bauen.</p>';
    if (dock || canFound) h += `<p class="sub">${SAIL_HINT}</p>`;
    if (!ui.setInfo(h, foot)) return;
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
  }
}
