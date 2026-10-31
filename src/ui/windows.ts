// Fenster in der Bildmitte: Menü, Weltkarte, Hilfe (3 kurze Karten + „Mehr Hilfe“) und „Spiel verloren“.
// Den Rahmen (Kopf mit ✕, scrollender Inhalt, Hauptknopf fest unten) baut ui.dialog() im Kern.
import './windows.css';
import { atWar, pirateAdvice, restart } from '../combat';
import { Game, HUMAN, newSeed } from '../game';
import { sound } from '../audio';
import type { UI } from '../ui';
import { $ } from './util';
import { SAIL_HINT } from './ship';

export class Windows {
  constructor(private ui: UI) {}

  openMenu() {
    const ui = this.ui, g = ui.g;
    const dipl = g.players.some((p) => p.id !== HUMAN && (p.pirate ? g.pirateSeen : ui.met(p.id)));
    ui.dialog({
      title: '⚓ Neue Ufer', cls: 'menu',
      body: `<div class="mgrid">
        <button class="btn" id="mSave">💾 Speichern</button>
        <button class="btn" id="mHelp">❓ Anleitung</button>
        <button class="btn" id="mTon">${sound.soundOn ? '🔊 Ton an' : '🔇 Ton aus'}</button>
        <button class="btn" id="mMusik">${sound.musicOn ? '🎵 Musik an' : '🔕 Musik aus'}</button>
        ${dipl ? '<button class="btn" id="mDipl">🤝 Krieg &amp; Frieden</button>' : ''}
        ${ui.score.ready ? '<button class="btn" id="mScore">🏆 Punkte</button>' : ''}
        <button class="btn danger" id="mNew">🏝️ Neues Spiel</button>
      </div>
      <p class="sub">Das Spiel speichert automatisch.</p>`,
      foot: `<button class="btn wide ok" id="mResume">▶️ Weiterspielen</button>`,
    });
    $('#mResume').addEventListener('click', () => ui.closeModal());
    $('#mSave').addEventListener('click', () => {
      const ok = g.save();
      ui.toast(ok ? 'Gespeichert ✔' : 'Speichern nicht möglich (privater Modus?)', ok ? 'good' : 'bad');
      ui.closeModal();
    });
    $('#mHelp').addEventListener('click', () => this.openHelp());
    document.getElementById('mDipl')?.addEventListener('click', () => ui.openDiplomacy());
    document.getElementById('mScore')?.addEventListener('click', () => ui.score.open());
    $('#mTon').addEventListener('click', () => { sound.setSound(!sound.soundOn); this.openMenu(); });
    $('#mMusik').addEventListener('click', () => { sound.setMusic(!sound.musicOn); this.openMenu(); });
    // „Neues Spiel“: Einstellungen (ui/settings.ts) – Abbrechen führt zurück ins Menü
    $('#mNew').addEventListener('click', () => ui.settings.open(() => this.openMenu()));
  }

  /** Weltkarte: entdeckte Inseln, eigene Gebiete, Schiffe – antippen springt dorthin */
  openMap() {
    const ui = this.ui, g = ui.g, N = g.size;
    ui.dialog({
      title: 'Weltkarte', cls: 'map',
      body: `<canvas id="mapCv" width="${N * 2}" height="${N * 2}"></canvas>
        <div class="mside"><p class="sub">Tippe auf einen Ort, um dorthin zu schauen.</p>
          <p class="legend"><span><i style="background:#4678dc"></i>Dein Land</span> <span><i style="background:#ffe066"></i>Deine Schiffe</span> <span><i style="background:#ff6b5b"></i>Fremde Schiffe</span> <span><i style="background:#343c46"></i>Unentdeckt</span></p></div>`,
      foot: `<button class="btn wide" id="mapX">Schließen</button>`,
    });
    const cv = $('#mapCv') as HTMLCanvasElement;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(N * 2, N * 2);
    const col = (k: number): [number, number, number] => {
      if (!g.seen[k]) return [52, 60, 70];
      const t = g.tiles[k];
      if (g.own[k] === HUMAN && t !== 0) return [70, 120, 220];
      if (g.own[k] > 0 && t !== 0) { const c = g.players[g.own[k]]?.color ?? 0xc8463b; return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; }
      return t === 0 ? [40, 110, 160] : t === 1 ? [220, 200, 140] : t === 3 ? [50, 110, 50] : t === 4 ? [130, 125, 115] : [110, 170, 80];
    };
    for (let y = 0; y < N * 2; y++) for (let x = 0; x < N * 2; x++) {
      const c = col(((y >> 1) * N) + (x >> 1));
      const i = (y * N * 2 + x) * 4;
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    for (const sh of g.ships) {
      if (sh.owner !== HUMAN && !g.seen[g.idx(Math.floor(sh.x), Math.floor(sh.y))]) continue;
      ctx.fillStyle = sh.owner === HUMAN ? '#ffe066' : '#ff6b5b';
      ctx.beginPath(); ctx.arc(sh.x * 2, sh.y * 2, 4, 0, Math.PI * 2); ctx.fill();
    }
    const r = ui.view.rig;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(r.tx * 2 - 20, r.tz * 2 - 12, 40, 24);
    cv.addEventListener('click', (e) => {
      const rect = cv.getBoundingClientRect();
      ui.input.stop();
      r.tx = ((e.clientX - rect.left) / rect.width) * N;
      r.tz = ((e.clientY - rect.top) / rect.height) * N;
      ui.closeModal();
    });
    $('#mapX').addEventListener('click', () => ui.closeModal());
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
          <li><b>Karte:</b> ein Finger verschiebt, zwei Finger zoomen und drehen, zweimal schnell tippen zoomt näher. Unten rechts: + und − zum Zoomen, 🧭 antippen = Norden nach oben, lang drücken = zum Kontor. 🗺️ oben zeigt die Weltkarte.</li>
          <li><b>Bauen:</b> Links erscheinen die Gebäude, sobald du sie nutzen kannst. Neue kommen mit mehr Einwohnern dazu. Nochmal auf dieselbe Stelle tippen baut auch.</li>
          <li><b>Wege 🛤️:</b> Start antippen, Ziel antippen, ✓ – der Weg sucht sich selbst den Weg um Wasser und Gebäude.</li>
          <li><b>Abreißen 💥</b> (oben): danach auf ein Gebäude oder einen Weg tippen. Du bekommst die Hälfte des Materials zurück.</li>
          <li>Tippe auf ein Gebäude, um zu sehen, was ihm fehlt. Das 📜 unten führt dich Schritt für Schritt.</li>
          ${war ? `<li><b>Kampf ⚔️:</b> In der Burg bildest du Soldaten aus (Waffen aus dem Lager). Soldat antippen → aufs Land tippen = hinlaufen, auf Feinde tippen = angreifen, auf dein Schiff tippen = einsteigen. „+ in der Nähe“ wählt mehrere aus.</li>
          <li><b>Eroberung:</b> Fällt das Kontor oder ein Marktplatz des Gegners, während deine Soldaten daneben stehen, gehört es dir – samt Land und Häusern ringsum.</li>
          <li><b>Seeschlacht:</b> Kanonen am Kontor aufs Schiff laden („Bewaffnen“), dann ein feindliches Schiff antippen. Beschädigte Schiffe werden an deiner Werft ausgebessert.</li>
          <li><b>Krieg &amp; Frieden:</b> im Menü ☰.</li>` : ''}
          ${g.pirateSeen ? `<li><b>Piraten 🏴‍☠️</b> überfallen Schiffe – ${pirateAdvice(g)}</li>` : ''}
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

  /** Niederlage: weiterspielen mit neuem Schiff – oder (nach Rückfrage) ein neues Spiel */
  showLost() {
    const ui = this.ui;
    ui.dialog({
      title: '🏳️ Spiel verloren', dismiss: false,
      body: `<p class="sub">Du hast keine Gebäude und keine Schiffe mehr.</p>`,
      foot: `<button class="btn wide ok" id="lostGo">⛵ Mit einem neuen Schiff weiterspielen</button><button class="btn wide danger" id="lostNew">🏝️ Neues Spiel</button>`,
    });
    $('#lostGo').addEventListener('click', () => { restart(ui.g); ui.closeModal(); });
    $('#lostNew').addEventListener('click', () => {
      const opp = Math.max(0, ui.g.players.filter((p) => p.ai).length);
      ui.ask('🏝️ Wirklich ein neues Spiel?', 'Eine neue Inselwelt beginnt – dein bisheriges Spiel ist dann weg.', '🏝️ Neues Spiel', () => {
        Game.clearSave();
        ui.onNewGame(Game.create(newSeed(), opp));
        ui.toast('Eine neue Inselwelt wartet auf dich!', 'good');
      }, () => this.showLost());
    });
  }
}
