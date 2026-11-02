import './style.css';
import { Game, newSeed } from './game';
import { View } from './render/scene';
import { UI } from './ui';
import { sound } from './audio';
import { T } from './world';
import { DebugOverlay, QualityMode } from './render/quality';
import { saves, slotName } from './saves';
import { grafikWahl } from './ui/settings';
import { calmClock } from './render/cloth';
import { ZOOM_STEP } from './input';
import * as THREE from 'three';
import * as events from './events'; // (S3) nur für automatische Tests (window.__events)

const TICK = 0.25; // Sekunden Spielzeit pro Simulationsschritt

async function boot() {
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  // Spielstände (src/saves.ts): großer Speicher des Browsers, alter Stand aus localStorage wird übernommen,
  // sonst der zuletzt gespeicherte Stand; lässt er sich nicht laden, der nächstältere
  const notes: [string, 'good' | 'bad'][] = [];
  await saves.init();
  const old = await saves.migrate();
  if (old.note) notes.push([old.note, 'bad']);
  let loaded: Game | null = old.game;
  if (!loaded) {
    const list = (await saves.list()).sort((a, b) => b.zeit - a.zeit);
    for (const m of list) {
      try { loaded = await saves.load(m.slot); break; } catch (e) {
        notes.push([`„${slotName(m.slot)}“ ließ sich nicht laden: ${(e as Error).message}`, 'bad']);
      }
    }
  }
  let game = loaded ?? Game.create(newSeed());
  // Merkmal des Spielstands: hat sich seit dem letzten Speichern etwas getan?
  let savedKey = '';
  const stateKey = () => `${game.seed ?? ''}:${game.time.toFixed(2)}:${game.buildings.length}:${game.nextId}:${Math.round(game.players[0]?.money ?? 0)}`;
  // Game.save() (z. B. „Speichern“ in Tests) schreibt in den laufenden Auto-Platz
  Game.saveHook = (g) => { void saves.autosave(g); return true; };
  const view = new View(canvas, game);
  const ui = new UI(game, view, (g) => {
    // neues oder geladenes Spiel: der bisherige Stand bleibt im anderen Auto-Platz erhalten
    if (g !== game) saves.wechsel();
    game = g;
    view.setGame(g);
    ui.setGame(g);
    savedKey = '';
    save();
  });
  saves.onFail = (text) => ui.toast(text, 'bad');

  let firstRun = false;
  try { firstRun = !localStorage.getItem('neue-ufer-help-seen'); localStorage.setItem('neue-ufer-help-seen', '1'); } catch { firstRun = !loaded; }
  if (firstRun) ui.openHelp();
  else if (loaded) ui.toast('Willkommen zurück! Dein Spiel wurde geladen.', 'good');
  for (const [t, k] of notes) ui.toast(t, k);
  // Leisten gleich füllen (nicht erst nach dem ersten, langsamen Bild)
  try { ui.updateHud(); } catch (e) { console.warn('HUD', e); }

  const resize = () => view.resize(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();

  // Qualität: ?q=hoch|sparsam|auto in der Adresse (für Tests), sonst die Wahl aus den Einstellungen
  const params = new URLSearchParams(location.search);
  const q = params.get('q') ?? grafikWahl();
  if (q === 'hoch' || q === 'sparsam' || q === 'auto') view.setQuality(q as QualityMode);
  const debug = params.has('debug') ? new DebugOverlay() : null;

  // Selbstsicherung (Auto 1/Auto 2, siehe src/saves.ts): alle 20 Sekunden und beim Verlassen – aber nur,
  // wenn sich seit dem letzten Mal etwas getan hat (Spielzeit weitergelaufen oder gebaut/abgerissen).
  // Beim Verlassen ungepackt, damit das Schreiben sofort beginnt. Klappt es zweimal nicht, meldet saves.ts es.
  function save(leaving = false) {
    const key = stateKey();
    if (key === savedKey) return;
    savedKey = key;
    void saves.autosave(game, !leaving).then((ok) => { if (!ok && savedKey === key) savedKey = ''; });
  }
  if (loaded) savedKey = stateKey();
  else save(); // ein neues Spiel gleich sichern, damit „Auto“ nicht leer bleibt
  setInterval(() => save(), 20000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });
  window.addEventListener('pagehide', () => save(true));

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
    // Zeichnen: beim Spielen jedes Bild (sparsam: 30 je Sekunde). In Pause, Menü und Hochformat steht das ganze
    // Bild still – Wasser, Wind in Bäumen und Gras, Fahnen, Schiffe, Auswahl-Pfeil laufen nach der Ruhe-Uhr, die
    // dann anhält (cloth.ts). Gezeichnet wird dann nur, wenn sich Kamera oder Bild geändert haben (Verschieben und
    // Zoomen bleiben flüssig: jedes Bild), sonst zur Sicherheit 4 Bilder je Sekunde. Das schont den Akku mehr als
    // flüssiges Weiterzeichnen eines bewegten Bilds, und nichts ruckelt mehr (vorher liefen Wasser und Bäume mit
    // nur 10 Bildern je Sekunde weiter).
    const idle = ui.paused || modalOpen;
    calmClock.still = idle;
    pendingDt += idle ? 0 : real * ui.speed;
    const since = now - lastDraw;
    const draw = idle ? (view.needsRedraw() || since >= 250) : since >= view.quality.minInterval;
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
      keepArrowVisible(now);
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

  // Auswahl-Pfeil nicht unter der oberen Leiste: Beim Anwählen schiebt die Kamera das Ding schon in den freien
  // Bereich (ui.keepLeft), rechnet dabei aber mit dem Boden. Hohe Schiffe/Gebäude samt Pfeil können oben noch
  // unter der Leiste stecken – dann einmal, kurz nach dem Anwählen, sanft ein Stück nachschieben. Dasselbe nach
  // dem Zoomen mit den Fingern oder dem Mausrad (erst, wenn der Zoom zur Ruhe gekommen ist und kein Finger mehr
  // auf dem Bild liegt). Zoomen per Knopf (+/−) hält den Pfeil gleich an seiner Stelle (siehe unten).
  let selKey = '';
  let checkAt = 0;
  let zoomDist = 0;
  let zoomSeen = 0;
  const fingers = new Set<number>();
  canvas.addEventListener('pointerdown', (e) => fingers.add(e.pointerId));
  for (const ev of ['pointerup', 'pointercancel'] as const) window.addEventListener(ev, (e) => fingers.delete(e.pointerId));
  const hasSelection = () => !!ui.selected || view.ships.selected !== null || view.units.selected.size > 0;
  const barBottom = () => document.querySelector<HTMLElement>('#hud .top')?.getBoundingClientRect().bottom ?? 0;
  function keepArrowVisible(now: number) {
    const key = `${ui.selected?.id ?? ''}|${view.ships.selected ?? ''}|${view.units.selected.size}`;
    if (key !== selKey) { selKey = key; checkAt = key === '||' ? 0 : now + 450; zoomDist = view.rig.dist; zoomSeen = 0; return; }
    if (key === '||') return;
    // Zoom beobachten: geändert → merken; 300 ms ruhig und kein Finger mehr auf dem Bild → einmal prüfen
    const d = view.rig.dist;
    if (Math.abs(d - zoomDist) > 1e-4) { zoomDist = d; zoomSeen = now; }
    if (zoomSeen && now - zoomSeen > 300 && !fingers.size) { zoomSeen = 0; checkAt = now; }
    if (!checkAt || now < checkAt) return;
    checkAt = 0;
    nudgeArrow();
  }
  function nudgeArrow() {
    const top = view.selMarks.topNdc;
    const bar = barBottom();
    if (!top.on || !bar) return;
    const rc = view.renderer.domElement.getBoundingClientRect();
    const ax = rc.left + ((top.x + 1) / 2) * rc.width, ay = rc.top + ((1 - top.y) / 2) * rc.height;
    if (ax < rc.left || ax > rc.right) return;
    const want = Math.min(bar + 14, ay + rc.height * 0.35);
    if (want <= ay) return;
    // Richtung am Boden, in die die Kamera rücken muss, damit das Bild nach unten wandert
    const a = view.groundPoint(ax, rc.top + rc.height * 0.5), b = view.groundPoint(ax, rc.top + rc.height * 0.5 + 40);
    if (!a || !b) return;
    const dx = a.x - b.x, dz = a.z - b.z;
    // wie weit genau? Kamera probeweise verschieben und die Pfeilspitze nachmessen (halbieren, 14 Schritte)
    const r = view.rig, tx0 = r.tx, tz0 = r.tz, P = view.selMarks.topWorld, q = P.clone();
    const yAt = (k: number) => {
      r.tx = tx0 + dx * k; r.tz = tz0 + dz * k;
      view.updateCamera(); view.camera.updateMatrixWorld();
      q.copy(P).project(view.camera);
      return rc.top + ((1 - q.y) / 2) * rc.height;
    };
    let lo = 0, hi = 1;
    while (yAt(hi) < want && hi < 64) hi *= 2;
    for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (yAt(m) < want) lo = m; else hi = m; }
    r.tx = tx0; r.tz = tz0;
    view.updateCamera(); view.camera.updateMatrixWorld();
    const k = hi;
    ui.input.animate(420, (e) => { r.tx = tx0 + dx * k * e; r.tz = tz0 + dz * k * e; });
  }

  // Zoomen per Knopf, während etwas angewählt ist: Die Kamera zoomt auf das angewählte Ding zu – sein Pfeil bleibt
  // am Bildschirm, wo er ist (das Ding wird nach unten hin größer), statt beim Heranzoomen um die Bildmitte unter
  // die obere Leiste zu wandern. Ohne Auswahl (oder wenn der Pfeil gerade nicht frei zu sehen ist) wie gewohnt.
  const zRay = new THREE.Raycaster(), zPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const zHit = new THREE.Vector3(), zNdc = new THREE.Vector2();
  /** Kamera so verschieben, dass der Weltpunkt Q an der Bildstelle (nx, ny) erscheint (wenige Schritte genügen) */
  const holdAt = (Q: THREE.Vector3, nx: number, ny: number) => {
    const r = view.rig;
    zPlane.constant = -Q.y;
    for (let i = 0; i < 4; i++) {
      view.updateCamera(); view.camera.updateMatrixWorld();
      zRay.setFromCamera(zNdc.set(nx, ny), view.camera);
      if (!zRay.ray.intersectPlane(zPlane, zHit)) return;
      const dx = Q.x - zHit.x, dz = Q.z - zHit.z;
      if (dx * dx + dz * dz < 1e-8) return;
      r.tx += dx; r.tz += dz;
    }
    view.updateCamera(); view.camera.updateMatrixWorld();
  };
  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement | null)?.closest?.('#zoomIn, #zoomOut');
    if (!btn || !hasSelection() || !view.selAnchor.on || !view.selMarks.topNdc.on) return;
    const rc = view.renderer.domElement.getBoundingClientRect();
    const top = view.selMarks.topNdc, ay = rc.top + ((1 - top.y) / 2) * rc.height;
    if (ay < barBottom() || Math.abs(top.x) > 1) return; // Pfeil gerade nicht frei zu sehen: normal zoomen
    view.updateCamera(); view.camera.updateMatrixWorld();
    const P = view.selAnchor.p.clone(), q = P.clone().project(view.camera);
    if (q.z > 1 || Math.abs(q.x) > 1 || Math.abs(q.y) > 1) return;
    // ab hier zoomt diese Stelle (der Knopf selbst würde um die Bildmitte zoomen)
    e.stopPropagation();
    const f = btn.id === 'zoomIn' ? ZOOM_STEP : 1 / ZOOM_STEP;
    const r = view.rig, d0 = r.dist;
    ui.input.animate(280, (k) => { r.dist = d0 * Math.pow(f, k); holdAt(P, q.x, q.y); });
  }, true);
  requestAnimationFrame(loop);

  // Für automatische Tests
  (window as unknown as { __game: () => Game; __ui: UI; __view: View }).__game = () => game;
  (window as unknown as { __ui: UI }).__ui = ui;
  (window as unknown as { __view: View }).__view = view;
  (window as unknown as { __sound: typeof sound }).__sound = sound;
  (window as unknown as { __events: typeof events }).__events = events; // (S3) Feuer, Pest, Dürre im Test auslösen
}

void boot().catch((e) => {
  console.warn('Start', e);
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:#1d1610;color:#f3e6c8;font:17px system-ui;text-align:center;z-index:99';
  d.textContent = 'Das Spiel konnte nicht starten. Bitte die Seite neu laden.';
  document.body.appendChild(d);
});
