import './style.css';
import { Game, newSeed } from './game';
import { View } from './render/scene';
import { UI } from './ui';
import { sound } from './audio';
import { T } from './world';
import { DebugOverlay, QualityMode } from './render/quality';

const TICK = 0.25; // Sekunden Spielzeit pro Simulationsschritt

function boot() {
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const loaded = Game.load();
  let game = loaded ?? Game.create(newSeed());
  const view = new View(canvas, game);
  const ui = new UI(game, view, (g) => {
    game = g;
    view.setGame(g);
    ui.setGame(g);
    g.save();
  });

  let firstRun = false;
  try { firstRun = !localStorage.getItem('neue-ufer-help-seen'); localStorage.setItem('neue-ufer-help-seen', '1'); } catch { firstRun = !loaded; }
  if (firstRun) ui.openHelp();
  else if (loaded) ui.toast('Willkommen zurück! Dein Spiel wurde geladen.', 'good');

  const resize = () => view.resize(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();

  // Qualität: ?q=hoch|sparsam|auto in der Adresse (für Tests und das spätere Einstellungsmenü)
  const params = new URLSearchParams(location.search);
  const q = params.get('q');
  if (q === 'hoch' || q === 'sparsam' || q === 'auto') view.setQuality(q as QualityMode);
  const debug = params.has('debug') ? new DebugOverlay() : null;

  // Speichern: regelmäßig und beim Verlassen – aber nur, wenn sich seit dem letzten Mal etwas getan hat
  // (Spielzeit weitergelaufen oder gebaut/abgerissen). Klappt es zweimal hintereinander nicht, Bescheid geben.
  let savedKey = '';
  let fails = 0;
  const stateKey = () => `${game.seed ?? ''}:${game.time.toFixed(2)}:${game.buildings.length}:${game.nextId}:${Math.round(game.players[0]?.money ?? 0)}`;
  const save = () => {
    const key = stateKey();
    if (key === savedKey) return;
    if (game.save()) { savedKey = key; fails = 0; return; }
    fails++;
    if (fails === 2) ui.toast('💾 Speichern nicht möglich – der Speicher des Browsers ist voll oder gesperrt (z. B. privates Surfen).', 'bad');
  };
  if (loaded) savedKey = stateKey(); // ein neues Spiel wird beim ersten Mal auf jeden Fall gespeichert
  setInterval(save, 20000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);

  // Hochformat: Spiel hält an wie bei offenem Menü (Hinweis „Bitte drehen“ liegt darüber)
  const portraitMq = window.matchMedia('(orientation: portrait) and (max-width: 700px)');

  let last = performance.now();
  let lastDraw = 0;
  let pendingDt = 0;
  let acc = 0;
  let hudT = 0;
  let iconT = 0;
  const loop = (now: number) => {
    requestAnimationFrame(loop);
    try { step(now); } catch (e) { console.warn('Spielschleife', e); }
  };
  const step = (now: number) => {
    const t0 = performance.now();
    const real = Math.min(0.1, (now - last) / 1000);
    last = now;
    let gameDt = 0;
    // Spiel friert ein, wenn pausiert, Menü offen, Hochformat oder App im Hintergrund
    const modalOpen = !document.getElementById('modal')!.classList.contains('hidden') || portraitMq.matches;
    if (!ui.paused && !modalOpen && !document.hidden) {
      acc += real * ui.speed;
      let steps = 0;
      while (acc >= TICK && steps < 40) { game.tick(TICK); acc -= TICK; steps++; gameDt += TICK; }
      if (steps >= 40) acc = 0;
    }
    // Anteil bis zum nächsten Rechenschritt: Bewegungen werden dazwischen flüssig dargestellt
    game.alpha = Math.min(1, acc / TICK);
    hudT += real;
    iconT += real;
    // Fehler in der Anzeige dürfen das Spiel nie anhalten
    if (hudT > 0.25) { hudT = 0; try { ui.updateHud(); } catch (e) { console.warn('HUD', e); } }
    if (iconT > 0.6) { iconT = 0; try { view.refreshIcons(); } catch (e) { console.warn('Icons', e); } }
    // Zeichnen: beim Spielen jedes Bild (sparsam: 30 je Sekunde); in Pause, Menü und Hochformat nur,
    // wenn sich Kamera oder Bild geändert haben, sonst höchstens 10 Bilder je Sekunde (schont den Akku)
    const idle = ui.paused || modalOpen;
    pendingDt += idle ? 0 : real * ui.speed;
    const since = now - lastDraw;
    const draw = idle ? (view.needsRedraw() || since >= 100) : since >= view.quality.minInterval;
    if (draw) {
      view.frame(now / 1000, pendingDt);
      pendingDt = 0;
      if (!view.preparing) {
        // Bildzeit messen und Qualität anpassen (nur beim flüssigen Spielen, nicht in der Pause)
        if (idle || since > 1000) view.quality.pause();
        else view.quality.sample(since, performance.now() - t0, now);
        debug?.frame(now, since, () => {
          const i = view.quality.info(), r = view.renderer.info.render;
          return `${i.modus} Stufe ${i.stufe}: Pixel ×${i.pixel}, Schatten ${i.schatten || 'aus'}\nBildzeit ${i.bildMs || '–'} ms, Rechnen ${i.rechenMs || '–'} ms (Mittel je 60 Bilder)\n${r.calls} Aufrufe, ${(r.triangles / 1000).toFixed(0)} Tsd. Dreiecke`;
        });
      }
      lastDraw = now;
    }
    // Klangkulisse: was ist gerade im Bild – Meer, Land, Wald?
    const r = view.rig;
    sound.cam = { x: r.tx, z: r.tz, dist: r.dist };
    ambT += real;
    if (ambT > 0.5) {
      ambT = 0;
      let land = 0, forest = 0, n = 0;
      const R = Math.max(6, r.dist * 0.5);
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
        const x = Math.floor(r.tx + (i * R) / 2), z = Math.floor(r.tz + (j * R) / 2);
        n++;
        if (!game.inMap(x, z)) continue;
        const t = game.tiles[game.idx(x, z)];
        if (t !== T.Wasser) land++;
        if (t === T.Wald) forest++;
      }
      landNear = land / n; forestNear = forest / n;
    }
    sound.ambience(landNear, forestNear, ui.paused || modalOpen);
  };
  let ambT = 0, landNear = 0, forestNear = 0;
  requestAnimationFrame(loop);

  // Für automatische Tests
  (window as unknown as { __game: () => Game; __ui: UI; __view: View }).__game = () => game;
  (window as unknown as { __ui: UI }).__ui = ui;
  (window as unknown as { __view: View }).__view = view;
  (window as unknown as { __sound: typeof sound }).__sound = sound;
}

boot();
