// Soldaten- und Flottenfenster (Paket U4: Kämpfen mit dem Finger).
// Soldaten: Art, Zustand, Lage; Knöpfe „Alle“, „Gleiche Art“, „⬚ Rahmen“ (zwei Tipps, dann ✓), Gruppen 1–3
// (antippen = wählen, lang drücken = speichern), Aufstellung „Reihe“ oder „Block“, „Zum Arzt“, „🚪 Ausmustern“
// (mit Rückfrage), dazu „+ in der Nähe“ und „Halt“. Tipp auf Wald mit gewählten Soldaten fällt Bäume (ui.ts).
// Flotte: mehrere eigene Schiffe (ein weiteres Schiff antippen nimmt es dazu), gemeinsam in einer Linie fahren
// und angreifen, Patrouille. Die Befehle selbst stehen in src/combat.ts.
import './units.css';
import { BUILDINGS, SHIPS, UNITS, UnitType } from '../data';
import { Aufstellung, dismiss, formationSlots, orderMove, patrol, shipAttack, stopPatrol } from '../combat';
import { HUMAN, Ship, Unit } from '../game';
import { GROUPS, formation, groupSize, groupUnits, saveGroup, setFormation } from '../bedienung';
import { sound } from '../audio';
import type { UI } from '../ui';
import { $ } from './util';
import { Live, esc, showLive } from './live';

/** so lange (ms) drückt man einen Gruppenknopf, um die Auswahl zu speichern */
const LONG_MS = 550;
/** Abstand der Schiffe in der Linie (Felder) */
const SHIP_GAP = 2.4;

export class UnitsPanel {
  /** Gruppenknopf lang gedrückt: der folgende „click“ wählt dann nicht */
  private longDone = false;
  private longTimer = 0;

  constructor(private ui: UI) {}

  /** eigene Soldaten an Land */
  private landUnits(): Unit[] {
    return this.ui.g.units.filter((u) => u.owner === HUMAN && u.ship === undefined);
  }

  render(list: Unit[]) {
    const ui = this.ui, g = ui.g;
    const by = new Map<UnitType, number>();
    let hp = 0, max = 0, fighting = 0, walking = 0, felling = 0;
    for (const u of list) {
      by.set(u.type, (by.get(u.type) ?? 0) + 1);
      hp += u.hp; max += UNITS[u.type].hp;
      if (u.target !== undefined) fighting++;
      else if (u.fell !== undefined) felling++;
      else if (u.path.length || u.board !== undefined || u.dest) walking++;
    }
    const one = list.length === 1 ? UNITS[list[0].type] : null;
    // Vorlage (ui/live.ts): Zustand, Lage, Zahlen und Balken werden nur ausgetauscht – Inhalt und Fußleiste
    // (✋ Halt, 🚪 Ausmustern) bleiben dieselben Knöpfe, auch im Gefecht und auf dem Marsch (kein verlorener Tipp)
    const L = new Live();
    // kompakt, damit alle Knöpfe auch auf kleinen iPhones (375 px hoch) ohne Wischen zu sehen sind
    let h = `<h3>${one ? `${one.icon} ${one.name}` : `⚔️ ${L.v(list.length)} Soldaten`}</h3>`;
    const pc = Math.min(100, Math.round((hp / Math.max(1, max)) * 10) * 10);
    const lage = fighting ? '⚔️ kämpft' : felling ? '🪓 fällt Bäume' : walking ? '🚶 unterwegs' : '🛡️ wartet';
    const kinds = one ? '' : [...by].map(([t, n]) => `<span title="${UNITS[t].plural}">${UNITS[t].icon} ${L.v(n)}</span>`).join('');
    h += `<div class="ustat">${kinds}<span>❤️ ${L.v(`${pc} %`)}</span><b>${L.v(lage)}</b></div>`;
    h += L.bar(pc / 100, pc > 60 ? '#7cc95a' : pc > 30 ? '#e8b93a' : '#e2553f').replace('class="bar"', 'class="bar thin"');
    // Auswahl erweitern: in der Nähe, alle, gleiche Art, Rahmen
    const land = this.landUnits();
    const types = new Set(list.map((u) => u.type));
    const same = land.filter((u) => types.has(u.type)).length;
    const near = land.filter((u) => !list.includes(u) && Math.hypot(u.x - list[0].x, u.y - list[0].y) < 10).length;
    const btn = (id: string, icon: string, label: string, aria: string, extra = '') => `<button class="btn" id="${id}" aria-label="${aria}"${extra}><b>${icon}</b><small>${label}</small></button>`;
    let sel = '';
    if (near && near < land.length - list.length) sel += btn('uNear', '👥', `+${L.v(near)} Nähe`, 'Soldaten in der Nähe dazunehmen');
    if (land.length > list.length) sel += btn('uAll', '👥', `Alle ${L.v(land.length)}`, 'Alle Soldaten wählen');
    if (same > list.length && same < land.length) sel += btn('uSame', '🎯', `Art ${L.v(same)}`, 'Alle Soldaten gleicher Art wählen');
    sel += btn('uFrame', '⬚', 'Rahmen', 'Rahmen: zwei Ecken tippen');
    h += `<div class="ubtns u3">${sel}</div>`;
    // Gruppen 1–3 (antippen = wählen, lang drücken = speichern)
    h += `<div class="ubtns u3 ugrp">`;
    for (let i = 0; i < GROUPS; i++) {
      const n = groupSize(g, i);
      h += `<button class="btn grp" data-grp="${i}" aria-label="Gruppe ${i + 1} – lang drücken speichert"><b>${i + 1}</b><small>${L.v(n ? `${n} 🪖` : 'leer')}</small></button>`;
    }
    h += '</div>';
    // Aufstellung beim Laufen, Arzt
    const f = formation(g);
    const doc = this.nearestDoctor(list);
    h += `<div class="ubtns u3">`
      + `<button class="btn${f === 'reihe' ? ' on' : ''}" data-form="reihe" aria-pressed="${f === 'reihe'}" aria-label="Aufstellung in einer Reihe"><b>▬</b><small>Reihe</small></button>`
      + `<button class="btn${f === 'block' ? ' on' : ''}" data-form="block" aria-pressed="${f === 'block'}" aria-label="Aufstellung im Block"><b>▦</b><small>Block</small></button>`
      + (doc ? btn('uDoc', '⚕️', 'Arzt', 'Zum Arzt: heilt, kein Sold') : '')
      + `</div>`;
    h += `<p class="sub">Gruppe lang drücken = jetzige Auswahl speichern. Tippe aufs Land, um hinzulaufen · auf Feinde, um anzugreifen · auf Wald, um Bäume zu fällen · auf dein Schiff, um einzusteigen.</p>`;
    // feste Fußleiste: Halt und Ausmustern
    const foot = `<button class="btn" id="uStop">✋ Halt</button><button class="btn danger" id="uDismiss">🚪 Ausmustern</button>`;
    if (!showLive((a, b) => ui.setInfo(a, b), L, h, foot)) return;
    this.bindUnits(list);
  }

  private bindUnits(list: Unit[]) {
    const ui = this.ui, g = ui.g;
    const on = (id: string, fn: () => void) => document.getElementById(id)?.addEventListener('click', fn);
    on('uNear', () => {
      const add = g.units.filter((u) => u.owner === HUMAN && u.ship === undefined && Math.hypot(u.x - list[0].x, u.y - list[0].y) < 10);
      ui.selectUnits([...new Set([...list, ...add])]);
    });
    on('uAll', () => ui.selectUnits(this.landUnits()));
    on('uSame', () => { const t = new Set(list.map((u) => u.type)); ui.selectUnits(this.landUnits().filter((u) => t.has(u.type))); });
    on('uFrame', () => ui.setMode({ kind: 'frame', back: { units: list.map((u) => u.id), ships: [] } }));
    on('uDoc', () => {
      const d = this.nearestDoctor(list);
      if (!d) return;
      const [cx, cy] = g.center(d);
      // neben das Haus des Arztes (in seinem Umkreis heilen sie schneller und kosten keinen Sold)
      const n = orderMove(g, list, cx + BUILDINGS.arzt.size / 2 + 1.5, cy + 0.5, formation(g));
      if (n) { sound.play('marsch'); ui.toast('⚕️ Die Soldaten gehen zum Arzt', 'info'); } else ui.toast('Zum Arzt kommen die Soldaten nicht', 'bad');
    });
    on('uStop', () => {
      for (const u of list) { u.path = []; u.target = undefined; u.ordered = false; u.board = undefined; u.dest = undefined; u.fell = undefined; u.chop = undefined; }
      ui.renderInfo();
    });
    on('uDismiss', () => {
      const n = list.length;
      ui.ask(`🚪 ${n === 1 ? 'Diesen Soldaten' : `${n} Soldaten`} ausmustern?`, `${n === 1 ? 'Er verlässt' : 'Sie verlassen'} das Heer, der Sold endet. Die Waffen bekommst du nicht zurück.`, '🚪 Ausmustern', () => {
        const k = dismiss(g, list);
        ui.select(null);
        ui.toast(k === 1 ? '🚪 Ein Soldat ausgemustert' : `🚪 ${k} Soldaten ausgemustert`, 'info');
      });
    });
    const body = $('#infoBody');
    body.querySelectorAll<HTMLElement>('[data-form]').forEach((b) => b.addEventListener('click', () => {
      const f = b.dataset.form as Aufstellung;
      setFormation(g, f);
      // wer gerade steht, stellt sich gleich so auf (sichtbare Rückmeldung); sonst gilt es beim nächsten Laufbefehl
      const idle = list.filter((u) => u.target === undefined && u.fell === undefined && !u.path.length && !u.dest && u.board === undefined);
      if (idle.length > 1 && idle.length === list.length) {
        let cx = 0, cy = 0;
        for (const u of idle) { cx += u.x; cy += u.y; }
        if (orderMove(g, idle, cx / idle.length, cy / idle.length, f)) sound.play('marsch');
      }
      ui.toast(f === 'reihe' ? '▬ Aufstellung in einer Reihe' : '▦ Aufstellung im Block', 'info');
      ui.renderInfo();
    }));
    body.querySelectorAll<HTMLElement>('[data-grp]').forEach((b) => {
      const i = Number(b.dataset.grp);
      const clear = () => { if (this.longTimer) { clearTimeout(this.longTimer); this.longTimer = 0; } };
      b.addEventListener('pointerdown', () => {
        clear();
        this.longDone = false;
        this.longTimer = window.setTimeout(() => {
          this.longTimer = 0;
          this.longDone = true;
          saveGroup(g, i, ui.selUnits);
          sound.play('nachricht');
          ui.toast(`🪖 Gruppe ${i + 1} gespeichert (${ui.selUnits.length} ${ui.selUnits.length === 1 ? 'Soldat' : 'Soldaten'})`, 'good');
          ui.renderInfo();
        }, LONG_MS);
      });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) b.addEventListener(ev, clear);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      b.addEventListener('click', () => {
        if (this.longDone) { this.longDone = false; return; }
        const us = groupUnits(g, i);
        if (us.length) ui.selectUnits(us);
        else ui.toast(`Gruppe ${i + 1} ist leer – lang drücken speichert die jetzige Auswahl`, 'info');
      });
    });
  }

  /** nächster eigener Arzt (nur wenn es einen gibt – sonst kein Knopf) */
  private nearestDoctor(list: Unit[]) {
    const g = this.ui.g;
    let best: (typeof g.buildings)[number] | undefined, bd = Infinity;
    const x = list[0]?.x ?? 0, y = list[0]?.y ?? 0;
    for (const b of g.buildings) {
      if (b.type !== 'arzt' || b.owner !== HUMAN) continue;
      const [cx, cy] = g.center(b);
      const d = Math.hypot(cx - x, cy - y);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  // ---------- Flotte ----------

  renderFleet(list: Ship[]) {
    const ui = this.ui;
    // Vorlage (ui/live.ts): Zustand je Schiff, Lebenspunkte und Kanonen werden nur ausgetauscht
    const L = new Live();
    let h = `<h3>⛵ ${list.length} Schiffe</h3>`;
    for (const s of list) {
      const sd = SHIPS[s.type ?? 'handel_klein'];
      const pc = Math.round(((s.hp ?? sd.hp) / sd.hp) * 10) * 10;
      const state = s.target !== undefined ? '⚔️' : s.patrol ? '🔁' : s.path.length ? '🚢' : '⚓';
      h += `<div class="fship"><span><b>${L.v(state)} ${esc(s.name)}</b><small>❤️ ${L.v(`${pc} %`)} · 💣 ${L.v(s.guns ?? 0)}</small></span><button class="btn" data-only="${s.id}" aria-label="Nur ${esc(s.name)} wählen">nur dieses</button></div>`;
    }
    h += `<div class="ubtns"><button class="btn" id="fFrame">⬚ Rahmen<small>zwei Ecken</small></button></div>`;
    h += `<p class="sub">Tippe aufs Meer: die Schiffe fahren in einer Linie dorthin. Auf Feinde: alle mit Kanonen greifen gemeinsam an. Ein eigenes Schiff antippen nimmt es dazu oder heraus.</p>`;
    const armed = list.filter((s) => (s.guns ?? 0) > 0);
    const patrolling = list.some((s) => s.patrol);
    let foot = '';
    if (patrolling) foot += `<button class="btn" id="fPatrolEnd">🔁 Patrouille beenden</button>`;
    else if (armed.length) foot += `<button class="btn ok" id="fPatrol">🔁 Patrouille<small>${armed.length} mit Kanonen</small></button>`;
    foot += `<button class="btn" id="fStop">✋ Halt</button>`;
    if (!showLive((a, b) => ui.setInfo(a, b), L, h, foot)) return;
    const g = ui.g;
    $('#infoBody').querySelectorAll<HTMLElement>('[data-only]').forEach((b) => b.addEventListener('click', () => {
      const s = g.ships.find((x) => x.id === Number(b.dataset.only));
      if (s) ui.selectShip(s);
    }));
    document.getElementById('fFrame')?.addEventListener('click', () => ui.setMode({ kind: 'frame', back: { units: [], ships: list.map((s) => s.id) } }));
    document.getElementById('fPatrol')?.addEventListener('click', () => this.startPatrol(armed));
    document.getElementById('fPatrolEnd')?.addEventListener('click', () => { for (const s of list) stopPatrol(g, s); ui.toast('Patrouille beendet', 'info'); ui.renderInfo(); });
    document.getElementById('fStop')?.addEventListener('click', () => {
      for (const s of list) { stopPatrol(g, s); s.path = []; s.target = undefined; }
      ui.renderInfo();
    });
  }

  /** Patrouille: nächster Tipp aufs Meer setzt den zweiten Wendepunkt */
  startPatrol(ships: Ship[]) {
    if (!ships.length) return;
    this.ui.setMode({ kind: 'patrol', ships: ships.map((s) => s.id) });
  }

  /** Tipp im Patrouillen-Werkzeug: aufs Meer = los; sonst Hinweis */
  patrolTap(ids: number[], x: number, y: number) {
    const ui = this.ui, g = ui.g;
    const t = ui.view.pick(x, y, false);
    const ships = ids.map((id) => g.ships.find((s) => s.id === id)).filter((s): s is Ship => !!s);
    if (!ships.length) { ui.setMode({ kind: 'none' }); return; }
    if (!t || !g.isWater(g.idx(t[0], t[1]))) { ui.toast('Tippe aufs Meer – dorthin fährt die Patrouille', 'info'); return; }
    const slots = this.lineSlots(ships, t[0] + 0.5, t[1] + 0.5);
    let n = 0;
    ships.forEach((s, i) => { if (patrol(g, s, slots[i][0], slots[i][1]) || patrol(g, s, t[0] + 0.5, t[1] + 0.5)) n++; });
    ui.setMode({ kind: 'none' });
    ui.selectShipsById(ids);
    if (n) { sound.play('glocke'); ui.toast(`🔁 Patrouille: ${n === 1 ? 'das Schiff fährt' : `${n} Schiffe fahren`} hin und her und greifen Feinde an`, 'info'); }
    else ui.toast('Dorthin findet kein Schiff einen Weg', 'bad');
  }

  /** Plätze in einer Linie quer zur Fahrtrichtung, auf Wasser (sonst der Zielpunkt selbst) */
  private lineSlots(ships: Ship[], x: number, y: number): [number, number][] {
    const g = this.ui.g;
    let cx = 0, cy = 0;
    for (const s of ships) { cx += s.x; cy += s.y; }
    cx /= ships.length; cy /= ships.length;
    const raw = formationSlots(ships.length, cx, cy, x, y, 'reihe');
    return raw.map(([sx, sy]) => {
      const px = x + (sx - x) * SHIP_GAP, py = y + (sy - y) * SHIP_GAP;
      const tx = Math.floor(px), ty = Math.floor(py);
      return g.inMap(tx, ty) && g.isWater(g.idx(tx, ty)) ? [px, py] as [number, number] : [x, y] as [number, number];
    });
  }

  /** Flotte fährt in einer Linie zum Ziel; Rückgabe: wie viele losfahren */
  fleetMove(ships: Ship[], x: number, y: number): number {
    const g = this.ui.g;
    const slots = this.lineSlots(ships, x, y);
    let n = 0;
    ships.forEach((s, i) => {
      stopPatrol(g, s);
      s.target = undefined;
      if (g.moveShip(s, slots[i][0], slots[i][1]) || g.moveShip(s, x, y)) n++;
    });
    return n;
  }

  /** alle bewaffneten Schiffe der Flotte greifen dasselbe Ziel an; Rückgabe: wie viele */
  fleetAttack(ships: Ship[], targetId: number): number {
    const g = this.ui.g;
    let n = 0;
    for (const s of ships) {
      if (!(s.guns ?? 0)) continue;
      stopPatrol(g, s);
      shipAttack(g, s, targetId);
      n++;
    }
    return n;
  }

  /** eigene Soldaten (an Land) bzw. Schiffe im Rahmen zwischen zwei Ecken */
  inFrame(a: readonly [number, number], b: readonly [number, number]): { units: Unit[]; ships: Ship[] } {
    const g = this.ui.g;
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]) + 1, y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]) + 1;
    const inside = (x: number, y: number) => x >= x0 && x < x1 && y >= y0 && y < y1;
    return {
      units: g.units.filter((u) => u.owner === HUMAN && u.ship === undefined && inside(u.x, u.y)),
      ships: g.ships.filter((s) => s.owner === HUMAN && inside(s.x, s.y)),
    };
  }
}
