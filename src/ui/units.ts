// Soldatenfenster: gewählte eigene Soldaten (Art, Zustand, Lage), weitere in der Nähe dazunehmen, Halt.
import './units.css';
import { UNITS, UnitType } from '../data';
import { HUMAN, Unit } from '../game';
import type { UI } from '../ui';
import { $, hpHtml } from './util';

export class UnitsPanel {
  constructor(private ui: UI) {}

  render(list: Unit[]) {
    const ui = this.ui, g = ui.g;
    const by = new Map<UnitType, number>();
    let hp = 0, max = 0, fighting = 0, walking = 0;
    for (const u of list) {
      by.set(u.type, (by.get(u.type) ?? 0) + 1);
      hp += u.hp; max += UNITS[u.type].hp;
      if (u.target !== undefined) fighting++; else if (u.path.length || u.board !== undefined) walking++;
    }
    const one = list.length === 1 ? UNITS[list[0].type] : null;
    let h = `<h3>${one ? `${one.icon} ${one.name}` : `⚔️ ${list.length} Soldaten`}</h3>`;
    if (one) h += `<p class="sub">${one.desc}</p>`;
    else for (const [t, n] of by) h += `<div class="row"><span>${UNITS[t].icon} ${UNITS[t].plural}</span><b>${n}</b></div>`;
    h += hpHtml(hp, max);
    h += `<div class="row"><span>Lage</span><b>${fighting ? '⚔️ kämpft' : walking ? '🚶 unterwegs' : '🛡️ wartet'}</b></div>`;
    h += `<p class="sub">Tippe aufs Land, um hinzulaufen · auf Feinde, um anzugreifen · auf dein Schiff, um einzusteigen.</p>`;
    const near = g.units.filter((u) => u.owner === HUMAN && u.ship === undefined && !list.includes(u) && Math.hypot(u.x - list[0].x, u.y - list[0].y) < 10).length;
    h += `<div class="row2">${near ? `<button class="btn ok" id="uAll">👥 +${near} in der Nähe</button>` : ''}<button class="btn" id="uStop">✋ Halt</button></div>`;
    if (!ui.setInfo(h)) return;
    document.getElementById('uAll')?.addEventListener('click', () => {
      const add = g.units.filter((u) => u.owner === HUMAN && u.ship === undefined && Math.hypot(u.x - list[0].x, u.y - list[0].y) < 10);
      ui.selectUnits([...new Set([...list, ...add])]);
    });
    $('#uStop').addEventListener('click', () => {
      for (const u of list) { u.path = []; u.target = undefined; u.ordered = false; u.board = undefined; }
      ui.renderInfo();
    });
  }
}
