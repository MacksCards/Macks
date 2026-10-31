// Krieg & Frieden mit den Konkurrenten, Schutz vor Piraten kaufen.
import './diplomacy.css';
import { atWar, buyProtection, declareWar, defenseAdvice, makePeace, peacePrice, pirateAdvice, pirates, protectionPrice, strength } from '../combat';
import { HUMAN } from '../game';
import { sound } from '../audio';
import type { UI } from '../ui';
import { $ } from './util';

export class Diplomacy {
  constructor(private ui: UI) {}

  open() {
    const ui = this.ui, g = ui.g;
    const me = strength(g, HUMAN);
    let h = `<p class="sub">Deine Streitmacht: ${me}</p>`;
    for (const p of g.players) {
      if (p.id === HUMAN || p.pirate || !ui.met(p.id)) continue;
      const war = atWar(g, HUMAN, p.id);
      const col = '#' + p.color.toString(16).padStart(6, '0');
      h += `<div class="row"><span><i class="dot" style="background:${col}"></i> ${p.name}${p.defeated ? ' – besiegt' : ''}</span><b>${p.defeated ? '🏳️' : war ? '⚔️ Krieg' : '🕊️ Frieden'}</b></div>`;
      if (!war && !p.defeated && p.warnAt !== undefined) h += `<p class="sub">⚠️ Rüstet zum Krieg – noch ${Math.max(1, Math.ceil((p.warnAt - g.time) / 60))} Min. ${defenseAdvice(g)}</p>`;
      if (p.defeated) continue;
      h += `<p class="sub">Streitmacht: ${strength(g, p.id)}</p>`;
      if (war) {
        const price = peacePrice(g, p.id);
        h += `<button class="btn wide ok" data-peace="${p.id}">🕊️ Frieden anbieten${price ? ` (💰${price} Entschädigung)` : ' – wird angenommen'}</button>`;
      } else h += `<button class="btn wide danger" data-war="${p.id}">⚔️ Krieg erklären</button>`;
    }
    const pir = pirates(g);
    if (pir && g.pirateSeen) {
      const prot = (g.players[HUMAN].protectedUntil ?? 0) - g.time;
      h += `<h4>🏴‍☠️ Piraten</h4><p class="sub">${prot > 0 ? `Du hast Schutz gekauft – noch ${Math.ceil(prot / 60)} Minuten.` : `Sie überfallen Schiffe und beschießen schlecht bewachte Küsten. ${pirateAdvice(g).replace(' (Menü ☰)', '')}`}</p>`;
      if (prot <= 0) h += `<button class="btn wide" id="dProt">💰 Schutz kaufen (${protectionPrice(g)} Taler, 20 Minuten)</button>`;
    }
    const m = ui.dialog({ title: '🤝 Krieg &amp; Frieden', cls: 'dipl', body: h, foot: `<button class="btn wide" id="dX">Schließen</button>` });
    $('#dX').addEventListener('click', () => ui.closeModal());
    m.querySelectorAll<HTMLElement>('[data-war]').forEach((bt) => bt.addEventListener('click', () => {
      const id = Number(bt.dataset.war);
      ui.ask(`⚔️ Krieg gegen ${g.players[id].name}?`, 'Dann greifen dich die Soldaten, Türme und Schiffe dieses Gegners an.', '⚔️ Krieg erklären',
        () => { declareWar(g, HUMAN, id); sound.play('alarm'); this.open(); }, () => this.open());
    }));
    m.querySelectorAll<HTMLElement>('[data-peace]').forEach((bt) => bt.addEventListener('click', () => {
      const id = Number(bt.dataset.peace), price = peacePrice(g, id);
      if (g.players[HUMAN].money < price) { ui.toast('Zu wenig Taler für die Entschädigung', 'bad'); return; }
      g.players[HUMAN].money -= price;
      g.players[id].money += price;
      makePeace(g, HUMAN, id);
      ui.toast(`🕊️ Frieden mit ${g.players[id].name}`, 'good');
      this.open();
    }));
    document.getElementById('dProt')?.addEventListener('click', () => {
      const r = buyProtection(g);
      ui.toast(r.ok ? '🏴‍☠️ Die Piraten lassen dich 20 Minuten in Ruhe' : r.reason ?? '', r.ok ? 'good' : 'bad');
      if (r.ok) sound.play('muenzen');
      this.open();
    });
  }
}
