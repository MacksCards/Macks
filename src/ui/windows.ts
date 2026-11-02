// Fenster in der Bildmitte: Menü, Hilfe (3 kurze Karten + „Mehr Hilfe“) und „Spiel verloren“ – dazu die große
// Weltkarte als Überlagerung (Paket U3: das Spiel läuft weiter, volle Höhe, Inselinfo mit „Hinschauen“).
// Den Rahmen (Kopf mit ✕, scrollender Inhalt, Hauptknopf fest unten) baut ui.dialog() im Kern.
import './windows.css';
import { atWar, pirateAdvice, restart } from '../combat';
import { HUMAN } from '../game';
import { sound } from '../audio';
import type { UI } from '../ui';
import { $, el } from './util';
import { battles, discovered, markColor, paintWorld, seenCount, type MapLayer } from './minimap';
import { GOOD } from '../data';
import { PFLANZEN, depositText, type Pflanze } from '../world';
import { SAIL_HINT } from './ship';

export class Windows {
  constructor(private ui: UI) {}

  openMenu() {
    const ui = this.ui, g = ui.g;
    const dipl = g.players.some((p) => p.id !== HUMAN && !p.trader && (p.pirate ? g.pirateSeen : ui.met(p.id)));
    ui.dialog({
      title: '⚓ Neue Ufer', cls: 'menu',
      body: `<div class="mgrid">
        <button class="btn" id="mSave">💾 Spielstände</button>
        <button class="btn" id="mHelp">❓ Anleitung</button>
        <button class="btn" id="mSet">⚙️ Einstellungen</button>
        <button class="btn" id="mTon" aria-label="Ton an oder aus">${sound.soundOn ? '🔊 Ton an' : '🔇 Ton aus'}</button>
        ${dipl ? '<button class="btn" id="mDipl">🤝 Krieg &amp; Frieden</button>' : ''}
        ${ui.score.ready ? '<button class="btn" id="mScore">🏆 Punkte</button>' : ''}
        <button class="btn danger" id="mNew">🏝️ Neues Spiel</button>
      </div>
      <p class="sub">Das Spiel speichert automatisch (Auto 1 und Auto 2).</p>`,
      foot: `<button class="btn wide ok" id="mResume">▶️ Weiterspielen</button>`,
    });
    $('#mResume').addEventListener('click', () => ui.closeModal());
    // Spielstände, Einstellungen (ui/settings.ts) – „Zurück“ führt ins Menü
    $('#mSave').addEventListener('click', () => void ui.settings.openSaves(() => this.openMenu()));
    $('#mSet').addEventListener('click', () => ui.settings.openOptions(() => this.openMenu()));
    $('#mHelp').addEventListener('click', () => this.openHelp());
    document.getElementById('mDipl')?.addEventListener('click', () => ui.openDiplomacy());
    document.getElementById('mScore')?.addEventListener('click', () => ui.score.open());
    $('#mTon').addEventListener('click', () => { sound.setSound(!sound.soundOn); this.openMenu(); });
    // „Neues Spiel“: Einstellungen (ui/settings.ts) – Abbrechen führt zurück ins Menü
    $('#mNew').addEventListener('click', () => ui.settings.open(() => this.openMenu()));
  }

  // ---------- Große Weltkarte (Überlagerung, das Spiel läuft weiter) ----------

  private mapTimer = 0;
  private mapLayer: MapLayer = 'none';
  private mapIsland = -1;
  private mapWorld: HTMLCanvasElement | null = null;
  private mapKey = '';
  private mapKeys: ((e: KeyboardEvent) => void) | null = null;

  /** ist die große Weltkarte offen? */
  get mapOpen(): boolean { const b = document.getElementById('worldMap'); return !!b && !b.classList.contains('hidden'); }

  /** Weltkarte: entdeckte Inseln mit Namen, Kontoren, Erz, Gold und Pflanzen, Gegner in ihrer Farbe, Schiffe und
   *  Soldaten; einblendbar die Ergiebigkeit von Fisch und Wald. Tipp auf eine Insel zeigt ihre Info mit „Hinschauen“,
   *  Tipp aufs Meer schaut dorthin. Das Spiel läuft weiter (kein Fenster in der Bildmitte). */
  openMap() {
    const ui = this.ui;
    let box = document.getElementById('worldMap');
    if (!box) {
      box = el('div', 'wmap hidden', `
        <div class="wcv"><canvas id="wmCv" aria-label="Weltkarte – Insel antippen für ihre Info, Meer antippen schaut dorthin"></canvas></div>
        <div class="wside">
          <div class="whead"><h2>🗺️ Weltkarte</h2><button class="btn sq" id="wmX" aria-label="Weltkarte schließen">✕</button></div>
          <div class="wlayers" role="group" aria-label="Was die Karte zeigt">
            <button class="btn active" data-l="none" aria-pressed="true">Karte</button><button class="btn" data-l="fisch" aria-pressed="false">🐟 Fisch</button><button class="btn" data-l="wald" aria-pressed="false">🌲 Wald</button>
          </div>
          <div class="wcard" id="wmCard"></div>
        </div>`);
      box.id = 'worldMap';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-label', 'Weltkarte');
      document.getElementById('hud')!.appendChild(box);
      $('#wmX').addEventListener('click', () => this.closeMap());
      const wbox = box;
      wbox.querySelectorAll<HTMLElement>('.wlayers .btn').forEach((b) => b.addEventListener('click', () => {
        this.mapLayer = b.dataset.l as MapLayer;
        wbox.querySelectorAll<HTMLElement>('.wlayers .btn').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
        this.mapKey = '';
        this.drawMap();
        this.mapCard();
      }));
      $('#wmCv').addEventListener('click', (e) => this.mapTap(e as MouseEvent));
    }
    ui.build.closeCat();
    this.mapIsland = -1;
    this.mapKey = '';
    box.classList.remove('hidden');
    document.body.classList.add('map-open');
    this.drawMap();
    this.mapCard();
    // das Spiel läuft weiter, Schiffe bewegen sich: einmal je Sekunde neu zeichnen
    clearInterval(this.mapTimer);
    this.mapTimer = window.setInterval(() => { if (this.mapOpen) this.drawMap(); else clearInterval(this.mapTimer); }, 1000);
    if (!this.mapKeys) {
      this.mapKeys = (e) => { if (e.key === 'Escape') this.closeMap(); };
      window.addEventListener('keydown', this.mapKeys);
    }
    sound.play('auf');
  }

  closeMap() {
    const box = document.getElementById('worldMap');
    if (!box || box.classList.contains('hidden')) return;
    box.classList.add('hidden');
    document.body.classList.remove('map-open');
    clearInterval(this.mapTimer);
    if (this.mapKeys) window.removeEventListener('keydown', this.mapKeys);
    this.mapKeys = null;
    sound.play('zu');
  }

  /** Karte zeichnen: Weltbild (nur neu bei Änderungen), Namen, Zeichen, Schiffe, Soldaten, Kämpfe, Sichtfeld */
  private drawMap() {
    const ui = this.ui, g = ui.g, N = g.size;
    const cv = $('#wmCv') as HTMLCanvasElement;
    const W = Math.round(cv.clientWidth * Math.min(2, window.devicePixelRatio || 1)) || N * 2;
    if (cv.width !== W) { cv.width = W; cv.height = W; }
    // Weltbild 1 Bildpunkt je Feld; Fisch und Wald wachsen nach: dann alle 5 Spielsekunden neu
    const key = `${N}:${this.mapLayer}:${seenCount(g)}:${g.buildVersion}:${g.buildings.length}:${this.mapLayer === 'none' ? '' : Math.floor(g.time / 5)}`;
    if (!this.mapWorld || this.mapWorld.width !== N || key !== this.mapKey) {
      this.mapKey = key;
      const w = this.mapWorld && this.mapWorld.width === N ? this.mapWorld : Object.assign(document.createElement('canvas'), { width: N, height: N });
      const wc = w.getContext('2d')!;
      const img = wc.createImageData(N, N);
      paintWorld(g, img, this.mapLayer);
      wc.putImageData(img, 0, 0);
      this.mapWorld = w;
    }
    const ctx = cv.getContext('2d')!;
    const s = W / N, u = W / 480;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.mapWorld, 0, 0, W, W);
    const known = discovered(g);
    // gewählte Insel umranden
    const sel = g.islands[this.mapIsland];
    if (sel) {
      ctx.lineWidth = 2 * u; ctx.strokeStyle = '#ffe066'; ctx.setLineDash([6 * u, 4 * u]);
      ctx.strokeRect((sel.x0 - 1) * s, (sel.y0 - 1) * s, (sel.x1 - sel.x0 + 3) * s, (sel.y1 - sel.y0 + 3) * s);
      ctx.setLineDash([]);
    }
    // Kontore: Anker im Kreis in der Farbe des Besitzers
    for (const b of g.buildings) {
      if (b.type !== 'kontor' || (b.owner !== HUMAN && !g.seen[g.idx(b.x, b.y)])) continue;
      const [cx, cy] = g.center(b);
      ctx.beginPath(); ctx.arc(cx * s, cy * s, 9 * u, 0, Math.PI * 2);
      ctx.fillStyle = b.owner === HUMAN ? '#4a86ff' : markColor(g, b.owner); ctx.fill();
      ctx.lineWidth = 2 * u; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.font = `${11 * u}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.fillText('⚓', cx * s, cy * s + u);
    }
    // Inselnamen und Zeichen für Erz, Gold und Pflanzen (nur entdeckte Inseln)
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (const isl of g.islands) {
      if (!known.has(isl.id)) continue;
      const x = isl.cx * s, y = Math.max(16 * u, (isl.y0 - 1.5) * s);
      ctx.font = `600 ${13 * u}px 'Alegreya Sans', sans-serif`;
      ctx.lineWidth = 3 * u; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(isl.name, x, y);
      ctx.fillStyle = g.kontor(HUMAN, isl.id) ? '#ffe9a8' : '#f4ead2'; ctx.fillText(isl.name, x, y);
      const icons: string[] = [];
      if (isl.gold) icons.push(GOOD.gold.icon);
      if (isl.erzStart || isl.erz) icons.push(GOOD.erz.icon);
      for (const p of Object.keys(PFLANZEN) as Pflanze[]) if ((isl.frucht[p] ?? 0) >= 100) icons.push(PFLANZEN[p].icon);
      if (icons.length) {
        ctx.font = `${12 * u}px sans-serif`; ctx.textBaseline = 'middle';
        ctx.fillText(icons.join(''), x, (isl.cy + 2) * s);
        ctx.textBaseline = 'alphabetic';
      }
    }
    // Soldaten: eigene hellblau, fremde in ihrer Farbe, Feinde im Krieg rot (nur im entdeckten Gebiet)
    for (const un of g.units) {
      if (un.ship !== undefined) continue;
      if (un.owner !== HUMAN && !g.seen[g.idx(Math.floor(un.x), Math.floor(un.y))]) continue;
      ctx.beginPath(); ctx.arc(un.x * s, un.y * s, 2.6 * u, 0, Math.PI * 2);
      ctx.fillStyle = un.owner === HUMAN ? '#9fd0ff' : markColor(g, un.owner); ctx.fill();
    }
    // Schiffe
    for (const sh of g.ships) {
      if (sh.owner !== HUMAN && !g.seen[g.idx(Math.floor(sh.x), Math.floor(sh.y))]) continue;
      ctx.beginPath(); ctx.arc(sh.x * s, sh.y * s, (sh.owner === HUMAN ? 5 : 4.4) * u, 0, Math.PI * 2);
      ctx.fillStyle = markColor(g, sh.owner); ctx.fill();
      ctx.lineWidth = 1.5 * u; ctx.strokeStyle = g.players[sh.owner]?.pirate ? '#fff' : '#000'; ctx.stroke();
    }
    // Kämpfe blinken
    if (Math.floor(performance.now() / 1000) % 2 === 0) for (const [x, y] of battles(g)) {
      ctx.beginPath(); ctx.arc(x * s, y * s, 10 * u, 0, Math.PI * 2);
      ctx.lineWidth = 3 * u; ctx.strokeStyle = '#ff9a3c'; ctx.stroke();
    }
    // was gerade im Bild ist (aus den vier Bildecken unter der Oberleiste)
    const v = ui.view;
    v.updateCamera(); v.camera.updateMatrixWorld();
    const rc = v.renderer.domElement.getBoundingClientRect();
    const pts = [[rc.left, rc.top + 52], [rc.right, rc.top + 52], [rc.right, rc.bottom], [rc.left, rc.bottom]].map(([x, y]) => v.groundPoint(x, y));
    if (pts.every((p) => p)) {
      ctx.beginPath();
      pts.forEach((p, i) => { if (i) ctx.lineTo(p!.x * s, p!.z * s); else ctx.moveTo(p!.x * s, p!.z * s); });
      ctx.closePath(); ctx.lineWidth = 2 * u; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
    }
  }

  /** Tipp auf die Karte: Insel (auch knapp daneben) → ihre Info, Meer → dorthin schauen */
  private mapTap(e: MouseEvent) {
    const ui = this.ui, g = ui.g, N = g.size;
    const rect = $('#wmCv').getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * N, y = ((e.clientY - rect.top) / rect.height) * N;
    if (!g.inMap(Math.floor(x), Math.floor(y))) return;
    const known = discovered(g);
    const hit = g.islandOf[g.idx(Math.floor(x), Math.floor(y))];
    let isl = hit >= 0 && known.has(hit) ? hit : -1;
    if (isl < 0) {
      // in Fingernähe: nächste entdeckte Insel, deren Rahmen höchstens 3 Felder entfernt ist
      let bd = 3;
      for (const i of g.islands) {
        if (!known.has(i.id)) continue;
        const d = Math.hypot(Math.max(i.x0 - x, 0, x - i.x1 - 1), Math.max(i.y0 - y, 0, y - i.y1 - 1));
        if (d < bd) { bd = d; isl = i.id; }
      }
    }
    if (isl >= 0) { this.mapIsland = isl; sound.play('klick'); this.mapCard(); this.drawMap(); return; }
    this.closeMap();
    ui.input.flyTo({ tx: x, tz: y }, 650);
  }

  /** rechte Spalte: Inselinfo mit „Hinschauen“, sonst die Zeichenerklärung */
  private mapCard() {
    const ui = this.ui, g = ui.g;
    const card = $('#wmCard');
    const isl = g.islands[this.mapIsland];
    if (!isl) {
      const layer = this.mapLayer === 'fisch' ? '<p class="sub">Hell türkis = viel Fisch, dunkel = abgefischt. Fischerhütten an hellen Stellen bauen.</p>'
        : this.mapLayer === 'wald' ? '<p class="sub">Hellgrün = ausgewachsener Wald, dunkel = gefällt oder jung.</p>' : '';
      card.innerHTML = `<p class="sub">Tippe auf eine Insel für ihre Info. Tippe aufs Meer, um dorthin zu schauen.</p>${layer}
        <p class="legend"><span><i style="background:#4a86ff"></i>Dein Land, ⚓ Kontor</span><span><i style="background:#ffe066"></i>Deine Schiffe</span><span><i style="background:#9fd0ff"></i>Deine Soldaten</span><span><i style="background:#ff3b2f"></i>Feinde im Krieg</span><span><i style="background:#111;border:1px solid #fff"></i>Piraten</span>${ui.trade.ready ? '<span><i style="background:#f4f1e8"></i>Händler</span>' : ''}<span><i style="background:#2c3846;border:1px solid #556"></i>Unentdeckt</span></p>
        <p class="legend">${GOOD.erz.icon} Erz · ${GOOD.gold.icon} Gold · Pflanzen auf 100 %: ${(Object.keys(PFLANZEN) as Pflanze[]).map((p) => `${PFLANZEN[p].icon} ${PFLANZEN[p].name}`).join(' · ')}</p>`;
      return;
    }
    const kon = g.buildings.find((b) => b.type === 'kontor' && b.island === isl.id && (b.owner === HUMAN || g.seen[g.idx(b.x, b.y)]));
    const owner = g.kontor(HUMAN, isl.id) ? 'Deine Insel' : kon ? `Besiedelt von ${g.players[kon.owner]?.name ?? 'jemandem'}` : 'Unbesiedelt';
    const gr = { klein: 'klein', mittel: 'mittelgroß', gross: 'groß' }[isl.groesse];
    const fr = (Object.keys(PFLANZEN) as Pflanze[]).filter((p) => isl.frucht[p]).map((p) => `<span>${PFLANZEN[p].icon} ${PFLANZEN[p].name} <b>${isl.frucht[p]} %</b></span>`).join('');
    card.innerHTML = `<h3>🏝️ ${isl.name}</h3><p class="sub">${gr} · ${isl.klima === 'nord' ? 'nördlich' : 'südlich'} · ${owner}</p>
      <p class="wfr">${fr || '<span class="sub">keine Plantagenpflanzen</span>'}</p>
      <p class="wdep">⛰️ Im Berg: <b>${depositText(isl)}</b></p>
      <div class="row2"><button class="btn" id="wmBack">◂ Zurück</button><button class="btn ok" id="wmLook">📍 Hinschauen</button></div>`;
    $('#wmBack').addEventListener('click', () => { this.mapIsland = -1; this.mapCard(); this.drawMap(); });
    $('#wmLook').addEventListener('click', () => {
      this.closeMap();
      const own = g.kontor(HUMAN, isl.id);
      if (own) ui.select(own); else ui.showIsland(isl.id);
      const [cx, cy] = own ? g.center(own) : [isl.cx, isl.cy];
      ui.input.flyTo({ tx: cx, tz: cy, dist: Math.max(28, Math.min(60, ui.view.rig.dist)) }, 750);
    });
  }

  /** Hilfe: drei kurze Karten (Segeln, Kontor, Bauen), Details unter „Mehr Hilfe“ */
  openHelp() {
    const ui = this.ui, g = ui.g;
    const war = g.isUnlocked('burg') || g.units.some((u) => u.owner === HUMAN) || g.players.some((p) => !p.pirate && atWar(g, HUMAN, p.id));
    ui.dialog({
      title: 'Willkommen, Kapitän!', cls: 'help',
      body: `<p class="lead">Dein Schiff ist mit Werkzeug, Holz und Nahrung an Bord in einer unbekannten Inselwelt angekommen. Die meisten Inseln liegen noch im Nebel.</p>
        <div class="hcards">
          <div class="hcard"><b><span class="ic">⛵</span>Segeln</b><p>Tippe dein Schiff an. ${SAIL_HINT}</p></div>
          <div class="hcard"><b><span class="ic">⚓</span>Kontor</b><p>An einer guten Insel im Schiff „Kontor bauen“ wählen und auf die Küste tippen. Danach „Alles ausladen“.</p></div>
          <div class="hcard"><b><span class="ic">🔨</span>Bauen</b><p>Links ein Gebäude wählen, auf die Insel tippen, dann ✓. Betriebe brauchen einen Weg 🛤️ zum Kontor.</p></div>
        </div>
        <div class="more hidden" id="hMoreBox"><ul>
          <li><b>Insel prüfen:</b> Schiff an eine Küste fahren oder Land antippen – du siehst, was dort wächst (z. B. Tabak 100 %) und ob der Berg Erz oder Gold hat.</li>
          <li><b>Kontor:</b> Es beansprucht das Land ringsum – dort darfst du bauen. Marktplätze vergrößern dein Gebiet.</li>
          <li><b>Karte:</b> ein Finger verschiebt, zwei Finger zoomen und drehen, zweimal schnell tippen zoomt näher. Unten rechts: + und − zum Zoomen, 🧭 antippen = Norden nach oben, lang drücken = zum Kontor. Die kleine Karte unten rechts zeigt, wo du bist – antippen oder ziehen schaut dorthin. 🗺️ öffnet die große Weltkarte.</li>
          <li><b>Überblick:</b> 🔔 unten rechts sammelt alle Meldungen (📍 springt zum Ort), ⛵ daneben zeigt deine Schiffe und Inseln. Tippe auf eine Ware oben, um Menge und Fluss zu sehen; 📦 zeigt alle Waren.</li>
          <li><b>Bauen:</b> Links erscheinen die Gebäude, sobald du sie nutzen kannst. Neue kommen mit mehr Einwohnern dazu. Nochmal auf dieselbe Stelle tippen baut auch.</li>
          <li><b>Wege 🛤️:</b> Start antippen, Ziel antippen, ✓ – der Weg sucht sich selbst den Weg um Wasser und Gebäude.</li>
          <li><b>Abreißen 💥</b> (oben): danach auf ein Gebäude oder einen Weg tippen. Du bekommst die Hälfte des Materials zurück.</li>
          <li>Tippe auf ein Gebäude, um zu sehen, was ihm fehlt. Das 📜 unten führt dich Schritt für Schritt – antippen zeigt alle Aufgaben, „Zeig mir“ führt hin.</li>
          ${war ? `<li><b>Kampf ⚔️:</b> In der Burg bildest du Soldaten aus (Waffen aus dem Lager). Soldat antippen → aufs Land tippen = hinlaufen, auf Feinde tippen = angreifen, auf dein Schiff tippen = einsteigen. „+ in der Nähe“ wählt mehrere aus.</li>
          <li><b>Eroberung:</b> Fällt das Kontor oder ein Marktplatz des Gegners, während deine Soldaten daneben stehen, gehört es dir – samt Land und Häusern ringsum.</li>
          <li><b>Seeschlacht:</b> Kanonen am Kontor aufs Schiff laden („Bewaffnen“), dann ein feindliches Schiff antippen. Beschädigte Schiffe werden an deiner Werft ausgebessert.</li>
          <li><b>Krieg &amp; Frieden:</b> im Menü ☰.</li>` : ''}
          ${ui.trade.ready ? `<li><b>Handel ⚖️:</b> Im Kontor unter „Handel“ stellst du ein, was der freie Händler dir verkaufen oder abkaufen soll (Ware, Menge, Preis). Er kommt alle paar Minuten mit seinem Schiff (weiße Flagge). Ab zwei Kontoren fährt ein Schiff auf einer Handelsroute allein hin und her.</li>` : ''}
          ${g.pirateSeen ? `<li><b>Piraten 🏴‍☠️</b> überfallen Schiffe – ${pirateAdvice(g)}</li>` : ''}
          <li><b>Spielstände und neues Spiel:</b> im Menü ☰. Das Spiel sichert sich selbst; auf drei eigenen Plätzen hebst du Stände auf. Bei „Neues Spiel“ wählst du Schwierigkeit, Gegner und Piraten.</li>
          <li>🔇 Kein Ton? Den Stummschalter am iPhone prüfen.</li></ul></div>`,
      foot: `<div class="row2"><button class="btn" id="hMore" aria-expanded="false">❓ Mehr Hilfe</button><button class="btn ok" id="hClose">Los geht's!</button></div>`,
    });
    $('#hClose').addEventListener('click', () => ui.closeModal());
    $('#hMore').addEventListener('click', () => {
      const box = $('#hMoreBox'), bt = $('#hMore');
      const open = box.classList.toggle('hidden') === false;
      bt.setAttribute('aria-expanded', String(open));
      bt.textContent = open ? '▴ Weniger Hilfe' : '❓ Mehr Hilfe';
      if (open) box.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }

  /** Niederlage: das Fenster nennt den Grund – alles verloren (weiter mit neuem Schiff) oder Bankrott
   *  (Schuldenerlass mit Punktabzug) –, dazu „Neues Spiel“ (nach Rückfrage in den Einstellungen) */
  showLost() {
    const ui = this.ui, p = ui.g.players[HUMAN];
    this.closeMap();
    if (p.lost === 'bankrott') {
      const n = (p.erlass ?? 0) + 1;
      ui.dialog({
        title: '🏳️ Spiel verloren', dismiss: false,
        body: `<p class="lgrund"><b>Grund: Bankrott.</b> Du warst zu lange mit über 10 000 Talern verschuldet.</p>
          <p class="sub">Mit einem Schuldenerlass geht es weiter: Die Kasse beginnt bei 0 Talern, deine Stadt bleibt. Dafür gibt es einen Punktabzug in der Endwertung${n > 1 ? ` (das wäre dein ${n}. Erlass)` : ''}.</p>`,
        foot: `<button class="btn wide ok" id="lostGo">💰 Schuldenerlass mit Punktabzug</button><button class="btn wide danger" id="lostNew">🏝️ Neues Spiel</button>`,
      });
      $('#lostGo').addEventListener('click', () => { ui.g.forgiveDebt(HUMAN); ui.closeModal(); ui.toast('Die Schulden sind erlassen (Punktabzug). Achte auf Steuern und Unterhalt!', 'info'); });
      $('#lostNew').addEventListener('click', () => ui.settings.open(() => this.showLost()));
      return;
    }
    ui.dialog({
      title: '🏳️ Spiel verloren', dismiss: false,
      body: `<p class="lgrund"><b>Grund: alles verloren.</b> Du hast keine Gebäude und keine Schiffe mehr.</p>
        <p class="sub">Du kannst mit einem neuen Schiff weiterspielen und noch einmal ein Kontor gründen.</p>`,
      foot: `<button class="btn wide ok" id="lostGo">⛵ Weiterspielen mit neuem Schiff</button><button class="btn wide danger" id="lostNew">🏝️ Neues Spiel</button>`,
    });
    $('#lostGo').addEventListener('click', () => { restart(ui.g); ui.closeModal(); });
    // Neues Spiel mit Einstellungen (ui/settings.ts); Abbrechen führt hierher zurück
    $('#lostNew').addEventListener('click', () => ui.settings.open(() => this.showLost()));
  }
}
