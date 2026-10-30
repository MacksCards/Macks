import './style.css';
import { Game, newSeed } from './game';
import { View } from './render/scene';
import { UI } from './ui';

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

  // Speichern: regelmäßig und beim Verlassen
  const save = () => game.save();
  setInterval(save, 20000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);

  let last = performance.now();
  let acc = 0;
  let hudT = 0;
  let iconT = 0;
  const loop = (now: number) => {
    requestAnimationFrame(loop);
    try { step(now); } catch (e) { console.warn('Spielschleife', e); }
  };
  const step = (now: number) => {
    const real = Math.min(0.1, (now - last) / 1000);
    last = now;
    let gameDt = 0;
    // Spiel friert ein, wenn pausiert, Menü offen oder App im Hintergrund
    const modalOpen = !document.getElementById('modal')!.classList.contains('hidden');
    if (!ui.paused && !modalOpen && !document.hidden) {
      acc += real * ui.speed;
      let steps = 0;
      while (acc >= TICK && steps < 40) { game.tick(TICK); acc -= TICK; steps++; gameDt += TICK; }
    }
    hudT += real;
    iconT += real;
    // Fehler in der Anzeige dürfen das Spiel nie anhalten
    if (hudT > 0.25) { hudT = 0; try { ui.updateHud(); } catch (e) { console.warn('HUD', e); } }
    if (iconT > 0.6) { iconT = 0; try { view.refreshIcons(); } catch (e) { console.warn('Icons', e); } }
    view.frame(now / 1000, ui.paused || modalOpen ? 0 : real * ui.speed);
  };
  requestAnimationFrame(loop);

  // Für automatische Tests
  (window as unknown as { __game: () => Game; __ui: UI; __view: View }).__game = () => game;
  (window as unknown as { __ui: UI }).__ui = ui;
  (window as unknown as { __view: View }).__view = view;
}

boot();
