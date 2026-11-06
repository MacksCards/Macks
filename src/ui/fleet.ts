// „Flotte & Inseln“ (Paket U3): schneller Zugriff auf alle eigenen Schiffe und Inseln mit Kontor.
// Einstiege: Knopf ⛵ unten rechts über der Minikarte (Reiter Schiffe) und Tipp auf den Inselnamen (Reiter Inseln).
//   Schiffe: Name (✏️ umbenennen), Art, Ort und Ziel, Ladung als Symbole, Kanonen, Zustand;
//            📍 Hinschauen, ✋ Wählen, 🎥 Kamera folgt (bis man die Karte berührt oder ✕ tippt).
//   Inseln:  Name (✏️ umbenennen), Einwohner, ⚠️ wenn etwas fehlt, 📦 wenn ein Lager voll ist;
//            📍 Hinschauen, ⚓ Kontor öffnen.
import './fleet.css';
import { GOOD, SHIPS, type GoodId } from '../data';
import { HUMAN, type Building, type Ship } from '../game';
import { flows, problems } from '../stats';
import { route } from '../trade';
import type { UI } from '../ui';
import { discovered } from './minimap';
import { $, Part, el, fmt } from './util';

export type FleetTab = 'schiffe' | 'inseln';

/** Name von Schiff oder Insel: höchstens so lang */
const NAME_MAX = 24;

/** Text sicher in HTML einsetzen */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** neuen Namen bereinigen: keine Zeichen, die als HTML gelten, Leerraum zusammenfassen, Länge begrenzen */
export function cleanName(s: string): string {
  return shortName(s);
}

function cleanText(s: string): string {
  return s
    .replace(/<\/?[a-z][^<>]*>/gi, ' ') // ganze Auszeichnungen wie <b> oder </b> fallen weg (nur mit schließendem „>“), nicht nur die Klammern
    .replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim();
}

/** Name säubern und auf NAME_MAX Zeichen kürzen – möglichst an einer Wortgrenze, nicht mitten im Wort */
function shortName(s: string): string {
  const c = cleanText(s);
  if (c.length <= NAME_MAX) return c;
  const cut = c.slice(0, NAME_MAX + 1), sp = cut.lastIndexOf(' ');
  return (sp >= NAME_MAX / 2 ? cut.slice(0, sp) : c.slice(0, NAME_MAX)).trim();
}

export class FleetWindow implements Part {
  /** Schiff, dem die Kamera folgt (id) */
  private followId: number | null = null;
  private tab: FleetTab = 'schiffe';

  constructor(readonly ui: UI) {}

  get ready(): boolean { return true; }

  /** Fenster öffnen (⛵ → Schiffe, Inselname → Inseln) */
  open(tab: FleetTab = 'schiffe') {
    const ui = this.ui, g = ui.g;
    this.tab = tab;
    const ships = g.myShips().length;
    const isles = this.islands().length;
    const tabs = `<div class="ftabs" role="tablist">
      <button class="btn tab${tab === 'schiffe' ? ' active' : ''}" role="tab" aria-selected="${tab === 'schiffe'}" data-tab="schiffe">⛵ Schiffe (${ships})</button>
      <button class="btn tab${tab === 'inseln' ? ' active' : ''}" role="tab" aria-selected="${tab === 'inseln'}" data-tab="inseln">🏝️ Inseln (${isles})</button></div>`;
    ui.dialog({ title: '⛵ Flotte &amp; Inseln', cls: 'fleet', body: tabs + this.html(tab), foot: `<button class="btn wide ok" id="fleetX">▶️ Weiterspielen</button>` });
    $('#fleetX').addEventListener('click', () => ui.closeModal());
    document.querySelectorAll<HTMLElement>('#modal .ftabs .tab').forEach((b) => b.addEventListener('click', () => this.open(b.dataset.tab as FleetTab)));
    this.bind();
  }

  /** eigene Kontore, eins je Insel */
  private islands(): Building[] {
    const g = this.ui.g;
    const seen = new Set<number>();
    return g.buildings.filter((b) => b.type === 'kontor' && b.owner === HUMAN && !seen.has(b.island) && seen.add(b.island) !== undefined)
      .sort((a, b) => a.island - b.island);
  }

  /** Inhalt des Fensters */
  html(tab: FleetTab): string {
    return tab === 'schiffe' ? this.shipsHtml() : this.islandsHtml();
  }

  /** Name der Insel in der Nähe (höchstens d Felder vom Rand), sonst null */
  private islandNear(x: number, y: number, d = 10): string | null {
    const g = this.ui.g;
    let best: string | null = null, bd = d;
    const known = discovered(g);
    for (const isl of g.islands) {
      // unentdeckte Inseln verrät die Liste nicht
      if (!known.has(isl.id)) continue;
      const dx = Math.max(isl.x0 - x, 0, x - isl.x1), dy = Math.max(isl.y0 - y, 0, y - isl.y1);
      const dist = Math.hypot(dx, dy);
      if (dist < bd) { bd = dist; best = isl.name; }
    }
    return best;
  }

  private shipLine(s: Ship): string {
    const g = this.ui.g;
    const here = this.islandNear(s.x, s.y);
    let where = here ? `bei ${esc(here)}` : 'auf See';
    const r = route(g, s);
    if (r?.on) {
      const st = r.stops[r.next];
      const k = st ? g.byId.get(st.kontor) : undefined;
      where += ` · 🧭 Handelsroute${k ? ` → ${esc(g.islands[k.island]?.name ?? '')}` : ''}${r.blocked ? ` (${esc(r.blocked)})` : ''}`;
    } else if (s.path.length) {
      const end = s.goal ?? s.path[s.path.length - 1];
      const to = this.islandNear(end[0], end[1], 8);
      where += ` · ➜ ${to ? esc(to) : 'unterwegs'}`;
    }
    return where;
  }

  private shipsHtml(): string {
    const g = this.ui.g;
    const list = g.myShips();
    if (!list.length) return '<p class="sub">Du hast gerade kein Schiff. Eine Werft baut neue.</p>';
    let h = '<ul class="frows">';
    for (const s of list) {
      const sd = SHIPS[s.type ?? 'handel_klein'];
      const cargo = s.slots.filter((sl) => sl.g && sl.n > 0)
        .map((sl) => `<span class="cg" title="${GOOD[sl.g as GoodId].name}">${GOOD[sl.g as GoodId].icon}${Math.floor(sl.n)}</span>`).join('');
      const hp = Math.round(((s.hp ?? sd.hp) / sd.hp) * 100);
      const troops = s.troops?.length ?? 0;
      h += `<li class="frow" data-ship="${s.id}">
        <div class="fhead"><b>⛵ ${esc(s.name)}</b><button class="btn sq ren" data-ren="s${s.id}" aria-label="${esc(s.name)} umbenennen">✏️</button><small>${sd.name}</small></div>
        <div class="fline">📍 ${this.shipLine(s)}</div>
        <div class="fline">${cargo || '<span class="sub0">keine Ladung</span>'}<span class="fsp"></span>${(s.guns ?? 0) > 0 ? `<span title="Kanonen">💣 ${s.guns}</span>` : ''}${troops ? `<span title="Soldaten an Bord">🪖 ${troops}</span>` : ''}<span class="${hp < 50 ? 'bad' : ''}" title="Zustand">❤️ ${hp} %</span></div>
        <div class="fbtns"><button class="btn" data-look="s${s.id}">📍 Hinschauen</button><button class="btn" data-pick="${s.id}">✋ Wählen</button><button class="btn${this.followId === s.id ? ' active' : ''}" data-follow="${s.id}">🎥 Folgen</button></div></li>`;
    }
    return h + '</ul>';
  }

  private islandsHtml(): string {
    const g = this.ui.g;
    const ks = this.islands();
    if (!ks.length) return '<p class="sub">Noch keine eigene Insel. Gründe mit dem Schiff ein Kontor an einer Küste.</p>';
    const probs = problems(g);
    let h = '<ul class="frows">';
    for (const k of ks) {
      const isl = g.islands[k.island];
      let pop = 0;
      for (const b of g.buildings) if (b.owner === HUMAN && b.type === 'haus' && b.island === k.island) pop += b.residents;
      const pr = probs.filter((p) => p.island === k.island);
      const full = Object.entries(flows(g, HUMAN, k.island)).filter(([, f]) => f && f.cap > 0 && f.stock >= f.cap - 0.5).map(([id]) => GOOD[id as GoodId]);
      const warn = pr.length ? `<span class="fwarn" title="${esc(pr[0].text.replace(/^⚠️\s*/, ''))}">⚠️ ${pr.length === 1 ? '1 Problem' : `${pr.length} Probleme`}</span>` : '<span class="fok">✓ alles gut</span>';
      const voll = full.length ? `<span class="fvoll" title="Lager voll">📦 voll: ${full.slice(0, 4).map((gd) => gd.icon).join('')}</span>` : '';
      h += `<li class="frow" data-isl="${k.island}">
        <div class="fhead"><b>🏝️ ${esc(isl.name)}</b><button class="btn sq ren" data-ren="i${k.island}" aria-label="${esc(isl.name)} umbenennen">✏️</button><small>Kontor ${['I', 'II', 'III', 'IV'][k.level ?? 0]}</small></div>
        <div class="fline"><span>👥 ${fmt(pop)} Einwohner</span><span class="fsp"></span>${warn}${voll}</div>
        ${pr.length ? `<div class="fline fprob">${esc(pr[0].text.replace(/^⚠️\s*/, ''))}</div>` : ''}
        <div class="fbtns"><button class="btn" data-look="i${k.id}">📍 Hinschauen</button><button class="btn" data-kontor="${k.id}">⚓ Kontor öffnen</button></div></li>`;
    }
    return h + '</ul>';
  }

  /** Knöpfe im Fenster verbinden */
  private bind() {
    const ui = this.ui, g = ui.g;
    const box = document.getElementById('modal');
    if (!box) return;
    box.querySelectorAll<HTMLElement>('[data-look]').forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.look!, id = Number(v.slice(1));
      let to: [number, number] | null = null;
      if (v[0] === 's') { const s = g.ships.find((x) => x.id === id); if (s) to = [s.x, s.y]; }
      else { const k = g.byId.get(id); if (k) to = g.center(k); }
      if (!to) return;
      ui.closeModal();
      this.stopFollow();
      ui.input.flyTo({ tx: to[0], tz: to[1], dist: Math.min(ui.view.rig.dist, 28) }, 650);
    }));
    box.querySelectorAll<HTMLElement>('[data-pick]').forEach((b) => b.addEventListener('click', () => {
      const s = g.ships.find((x) => x.id === Number(b.dataset.pick));
      if (!s) return;
      ui.closeModal();
      ui.selectShip(s);
    }));
    box.querySelectorAll<HTMLElement>('[data-follow]').forEach((b) => b.addEventListener('click', () => {
      const s = g.ships.find((x) => x.id === Number(b.dataset.follow));
      if (!s) return;
      ui.closeModal();
      this.follow(s);
    }));
    box.querySelectorAll<HTMLElement>('[data-kontor]').forEach((b) => b.addEventListener('click', () => {
      const k = g.byId.get(Number(b.dataset.kontor));
      if (!k) return;
      ui.closeModal();
      this.stopFollow();
      ui.select(k);
    }));
    box.querySelectorAll<HTMLElement>('[data-ren]').forEach((b) => b.addEventListener('click', () => this.rename(b.dataset.ren!)));
  }

  /** Umbenennen (s<id> = Schiff, i<Insel> = Insel); danach zurück in die Liste */
  private rename(what: string) {
    const ui = this.ui, g = ui.g, id = Number(what.slice(1));
    const ship = what[0] === 's' ? g.ships.find((s) => s.id === id && s.owner === HUMAN) : undefined;
    const isl = what[0] === 'i' ? g.islands[id] : undefined;
    const old = ship?.name ?? isl?.name;
    if (old === undefined) return;
    const back = this.tab;
    ui.dialog({
      title: ship ? '✏️ Schiff umbenennen' : '✏️ Insel umbenennen', cls: 'rename', dismiss: false,
      body: `<label class="sub" for="renIn">Neuer Name (höchstens ${NAME_MAX} Zeichen)</label><input id="renIn" class="renin" type="text" maxlength="${NAME_MAX * 3}" autocomplete="off" enterkeyhint="done" value="${esc(old)}">`,
      foot: `<div class="row2"><button class="btn" id="renNo">Abbrechen</button><button class="btn ok" id="renOk">✓ Übernehmen</button></div>`,
    });
    const inp = $('#renIn') as HTMLInputElement;
    const done = (ok: boolean) => {
      if (ok) {
        const n = cleanName(inp.value);
        if (!n) { inp.focus(); return; }
        if (ship) ship.name = n;
        if (isl) isl.name = n;
        if (n !== old) ui.toast(`✏️ ${ship ? 'Schiff' : 'Insel'} heißt jetzt „${n}“`, 'good');
      }
      this.open(back);
    };
    $('#renNo').addEventListener('click', () => done(false));
    $('#renOk').addEventListener('click', () => done(true));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(true); } });
    setTimeout(() => { try { inp.focus(); inp.select(); } catch { /* ohne Tastatur */ } }, 50);
  }

  // ---------- Kamera folgt einem Schiff ----------

  /** Kamera folgt dem Schiff, bis man die Karte berührt, ✕ tippt oder das Schiff sinkt */
  follow(s: Ship) {
    const ui = this.ui;
    ui.input.stop();
    const first = this.followId === null;
    this.followId = s.id;
    let chip = document.getElementById('followChip');
    if (!chip) {
      chip = el('button', 'follow', '');
      chip.id = 'followChip';
      chip.addEventListener('click', () => this.stopFollow());
      document.getElementById('hud')?.appendChild(chip);
      // Karte berühren beendet das Folgen (Verschieben bleibt so wie gewohnt)
      document.getElementById('c')?.addEventListener('pointerdown', () => this.stopFollow());
    }
    chip.innerHTML = `🎥 Kamera folgt der ${esc(s.name)} <i>✕</i>`;
    chip.setAttribute('aria-label', `Kamera folgt der ${esc(s.name)} – antippen beendet`);
    chip.classList.remove('hidden');
    if (first) requestAnimationFrame(() => this.frame());
  }

  stopFollow() {
    this.followId = null;
    document.getElementById('followChip')?.classList.add('hidden');
  }

  /** je Bild: Kamera weich zur (flüssig dargestellten) Lage des Schiffs */
  private frame() {
    const ui = this.ui, g = ui.g;
    if (this.followId === null) return;
    const s = g.ships.find((x) => x.id === this.followId);
    if (!s) { this.stopFollow(); ui.toast('Das Schiff, dem die Kamera folgte, gibt es nicht mehr', 'info'); return; }
    requestAnimationFrame(() => this.frame());
    const [x, y] = g.ip(s), r = ui.view.rig;
    const dx = x - r.tx, dz = y - r.tz;
    if (Math.abs(dx) + Math.abs(dz) < 1e-3) return;
    // weit weg: schneller heranholen, in der Nähe sanft nachführen
    const k = Math.hypot(dx, dz) > 12 ? 0.18 : 0.12;
    r.tx += dx * k; r.tz += dz * k;
    ui.hud.needle();
  }
}
