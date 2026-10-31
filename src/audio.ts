// Klänge, komplett im Spiel erzeugt (keine Sounddateien, keine Lizenzfragen):
// Bedienung (Klicks, Fehler, Münzen, Freischaltung), Spielgeschehen (Bauen, Axt, Baum, Schiff, Kanone)
// und Atmosphäre (Meer, Wind, Möwen, Vögel, ruhige Musik). iPhone: Ton startet erst nach dem ersten Tippen.

type Pos = { x: number; z: number };

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private mus!: GainNode;
  private verb!: ConvolverNode;
  private noise!: AudioBuffer;
  private sea?: { g: GainNode; f: BiquadFilterNode };
  private wind?: { g: GainNode; f: BiquadFilterNode };
  private nextGull = 0;
  private nextBird = 0;
  private nextNote = 0;
  private chord = 0;
  private last = new Map<string, number>();
  cam = { x: 0, z: 0, dist: 30 };
  soundOn = true;
  musicOn = true;

  constructor() {
    try {
      this.soundOn = localStorage.getItem('nu-ton') !== '0';
      this.musicOn = localStorage.getItem('nu-musik') !== '0';
    } catch { /* egal */ }
    // iOS/Safari: Audio darf erst nach einer Berührung starten
    const unlock = () => { this.start(); };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    // App verlassen (Sperrbildschirm, App-Wechsel): Ton anhalten, beim Zurückkommen weiter
    const vis = () => this.wake();
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', () => { if (this.ctx) void this.ctx.suspend(); });
    window.addEventListener('pageshow', vis);
  }

  /** Ton passend zum Zustand an- oder anhalten (versteckt, beides aus → anhalten spart Akku) */
  private wake() {
    if (!this.ctx) return;
    const want = !document.hidden && (this.soundOn || this.musicOn);
    if (want && this.ctx.state !== 'running') void this.ctx.resume().catch(() => { /* später nochmal */ });
    if (!want && this.ctx.state === 'running') void this.ctx.suspend();
  }

  private start() {
    // iPhone meldet nach Anruf/Sperre „interrupted“ – bei jedem Tippen wieder anwerfen
    if (this.ctx) { this.wake(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    void ctx.resume().catch(() => { /* egal */ });
    // Lautstärkebremse am Ausgang: auch wenn vieles gleichzeitig klingt, nie übersteuern
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -3; limit.knee.value = 0; limit.ratio.value = 20; limit.attack.value = 0.001; limit.release.value = 0.1;
    limit.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(limit);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    comp.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.connect(comp);
    this.amb = ctx.createGain(); this.amb.connect(comp);
    this.mus = ctx.createGain(); this.mus.connect(comp);
    this.applyVolumes();
    // Hall (künstlich erzeugt) für Glocken und Musik
    this.verb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.verb.buffer = ir;
    const vg = ctx.createGain(); vg.gain.value = 0.35;
    this.verb.connect(vg); vg.connect(comp);
    // Rauschen als Grundstoff für Wellen, Wind, Knirschen, Donner
    const nlen = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, nlen, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < nlen; i++) { // „rosa“ Rauschen klingt weicher als weißes
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
      nd[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
    }
    this.sea = this.loopNoise(this.amb, 'lowpass', 500);
    this.wind = this.loopNoise(this.amb, 'bandpass', 900);
  }

  private applyVolumes() {
    if (!this.ctx) return;
    this.sfx.gain.value = this.soundOn ? 0.8 : 0;
    this.amb.gain.value = this.soundOn ? 0.55 : 0;
    this.mus.gain.value = this.musicOn ? 0.22 : 0;
    this.wake();
  }

  setSound(on: boolean) { this.soundOn = on; this.applyVolumes(); try { localStorage.setItem('nu-ton', on ? '1' : '0'); } catch { /* egal */ } }
  setMusic(on: boolean) { this.musicOn = on; this.applyVolumes(); try { localStorage.setItem('nu-musik', on ? '1' : '0'); } catch { /* egal */ } }

  private loopNoise(out: AudioNode, type: BiquadFilterType, freq: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(out); src.start();
    return { g, f };
  }

  // ---------- Bausteine ----------

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; slide?: number; delay?: number; verb?: number; out?: AudioNode; attack?: number } = {}) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const o = ctx.createOscillator(); o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opts.slide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.vol ?? 0.3, t + (opts.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(opts.out ?? this.sfx);
    let v: GainNode | undefined;
    if (opts.verb) {
      // Hall-Anteil folgt der Lautstärke der Spur (sonst wäre die Musik im Hall lauter als selbst)
      const bus = (opts.out ?? this.sfx) as GainNode;
      v = ctx.createGain(); v.gain.value = opts.verb * bus.gain.value; g.connect(v); v.connect(this.verb);
    }
    o.onended = () => { o.disconnect(); g.disconnect(); v?.disconnect(); };
    o.start(t); o.stop(t + dur + 0.05);
  }

  private burst(dur: number, opts: { type?: BiquadFilterType; freq?: number; q?: number; vol?: number; delay?: number; slideTo?: number; out?: AudioNode } = {}) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = opts.type ?? 'bandpass'; f.frequency.setValueAtTime(opts.freq ?? 1000, t); f.Q.value = opts.q ?? 1;
    if (opts.slideTo) f.frequency.exponentialRampToValueAtTime(opts.slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.vol ?? 0.4, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(opts.out ?? this.sfx);
    src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); };
    src.start(t, Math.random() * Math.max(0, 1.9 - dur)); src.stop(t + dur + 0.05);
  }

  /** Lautstärke nach Entfernung zur Kamera (Spielgeschehen) */
  private near(p?: Pos): number {
    if (!p) return 1;
    const d = Math.hypot(p.x - this.cam.x, p.z - this.cam.z);
    const reach = 8 + this.cam.dist * 0.6;
    const zoom = Math.max(0.15, Math.min(1, 26 / this.cam.dist));
    return Math.max(0, 1 - d / reach) * zoom;
  }

  /** nicht zu oft dasselbe Geräusch */
  private throttle(key: string, ms: number) {
    const now = performance.now();
    if ((this.last.get(key) ?? 0) + ms > now) return false;
    this.last.set(key, now);
    return true;
  }

  // ---------- Geräusche ----------

  /** Spiel pausiert (Geräusche aus dem Spielgeschehen schweigen dann) */
  gamePaused = false;

  play(name: string, at?: Pos) {
    if (!this.ctx || !this.soundOn || this.ctx.state !== 'running') return;
    if (at && this.gamePaused) return;
    const v = this.near(at);
    if (v <= 0.02) return;
    switch (name) {
      case 'klick': // weicher Holzklick
        if (!this.throttle('klick', 40)) return;
        this.tone(520, 0.06, { type: 'triangle', vol: 0.18, slide: 0.6 });
        this.burst(0.03, { freq: 2500, q: 2, vol: 0.12 });
        break;
      case 'auf': this.tone(440, 0.08, { type: 'triangle', vol: 0.14 }); this.tone(660, 0.12, { type: 'triangle', vol: 0.12, delay: 0.05 }); break;
      case 'zu': this.tone(520, 0.08, { type: 'triangle', vol: 0.12 }); this.tone(390, 0.12, { type: 'triangle', vol: 0.1, delay: 0.05 }); break;
      case 'fehler': this.tone(180, 0.12, { type: 'square', vol: 0.06, slide: 0.9 }); this.tone(150, 0.16, { type: 'square', vol: 0.06, delay: 0.12, slide: 0.85 }); break;
      case 'bauen': // satter Rumms + Holzknacken + Staub
        this.tone(95 * v + 20, 0.32, { vol: 0.5 * v, slide: 0.5 });
        this.tone(210, 0.08, { type: 'triangle', vol: 0.25 * v, delay: 0.02 });
        this.burst(0.25, { type: 'lowpass', freq: 1200, slideTo: 300, vol: 0.35 * v });
        this.tone(330, 0.09, { type: 'triangle', vol: 0.15 * v, delay: 0.12 });
        break;
      case 'kontor': // großes Gebäude: tiefer + kleine Glocke
        this.play('bauen', at);
        [523, 659, 784].forEach((f, i) => this.tone(f, 0.6, { vol: 0.12, delay: 0.25 + i * 0.09, verb: 0.6 }));
        break;
      case 'weg': // Kies knirscht
        if (!this.throttle('weg', 45)) return;
        this.burst(0.07, { freq: 1800 + Math.random() * 1200, q: 0.8, vol: 0.22 });
        break;
      case 'abriss': this.burst(0.5, { type: 'lowpass', freq: 900, slideTo: 120, vol: 0.5 }); this.tone(70, 0.4, { vol: 0.35, slide: 0.6 }); break;
      case 'muenzen': // Münzen klimpern
        for (let i = 0; i < 6; i++) {
          const f = 2200 + Math.random() * 1600;
          this.tone(f, 0.18, { vol: 0.07, delay: i * 0.055 + Math.random() * 0.02, verb: 0.2 });
          this.tone(f * 1.51, 0.12, { vol: 0.035, delay: i * 0.055 });
        }
        break;
      case 'freischalten': // Glockenspiel nach oben (Pentatonik)
        [523, 587, 659, 784, 880, 1047].forEach((f, i) => { this.tone(f, 0.9, { vol: 0.11, delay: i * 0.08, verb: 0.7 }); this.tone(f * 2, 0.4, { vol: 0.03, delay: i * 0.08 }); });
        break;
      case 'aufstieg': // kleine Fanfare
        [[392, 0], [523, 0.12], [659, 0.24], [784, 0.36], [1047, 0.5]].forEach(([f, d]) => this.tone(f, d === 0.5 ? 0.9 : 0.2, { type: 'sawtooth', vol: 0.05, delay: d, verb: 0.5, attack: 0.02 }));
        [523, 659, 784].forEach((f) => this.tone(f, 1.0, { type: 'triangle', vol: 0.06, delay: 0.5, verb: 0.6 }));
        break;
      case 'glocke': // Schiffsglocke: zweimal
        for (const d of [0, 0.32]) { this.tone(880, 1.2, { vol: 0.12, delay: d, verb: 0.5 }); this.tone(2214, 0.6, { vol: 0.04, delay: d }); this.tone(1320, 0.8, { vol: 0.05, delay: d }); }
        break;
      case 'horn': this.tone(110, 1.4, { type: 'sawtooth', vol: 0.06, attack: 0.25, verb: 0.4 }); this.tone(165, 1.4, { type: 'sawtooth', vol: 0.04, attack: 0.25 }); this.burst(0.8, { type: 'lowpass', freq: 700, vol: 0.2, delay: 0.3 }); break;
      case 'axt': // dumpfer Hieb ins Holz
        if (!this.throttle('axt', 180)) return;
        this.tone(180 + Math.random() * 40, 0.06, { type: 'triangle', vol: 0.3 * v, slide: 0.5 });
        this.burst(0.05, { freq: 1500, q: 1.5, vol: 0.22 * v });
        break;
      case 'baum': // Knacken, Rauschen der Krone, Aufschlag
        this.burst(0.15, { freq: 2600, q: 3, vol: 0.25 * v });
        this.burst(1.0, { type: 'bandpass', freq: 600, slideTo: 2200, q: 0.6, vol: 0.18 * v, delay: 0.25 });
        this.tone(60, 0.5, { vol: 0.5 * v, slide: 0.6, delay: 1.2 });
        this.burst(0.4, { type: 'lowpass', freq: 600, vol: 0.3 * v, delay: 1.2 });
        break;
      case 'kanone':
        this.tone(55, 0.9, { vol: 0.7 * v, slide: 0.4 });
        this.burst(1.2, { type: 'lowpass', freq: 1800, slideTo: 80, vol: 0.8 * v });
        break;
      case 'kisten': // Ladung poltert
        for (let i = 0; i < 3; i++) { this.tone(140 + Math.random() * 60, 0.09, { type: 'triangle', vol: 0.22, slide: 0.6, delay: i * 0.09 }); this.burst(0.06, { type: 'lowpass', freq: 900, vol: 0.2, delay: i * 0.09 }); }
        break;
      case 'nachricht': this.tone(660, 0.25, { vol: 0.08, verb: 0.4 }); this.tone(990, 0.35, { vol: 0.06, delay: 0.08, verb: 0.4 }); break;
    }
  }

  // ---------- Atmosphäre & Musik (jedes Bild aufrufen) ----------

  /** landNear: 0..1 wie viel Land/Wald im Bild ist; seaNear: 0..1 wie viel Meer */
  ambience(landNear: number, forestNear: number, paused: boolean) {
    if (!this.ctx || !this.sea || !this.wind) return;
    const t = this.ctx.currentTime;
    const zoomOut = Math.min(1, this.cam.dist / 80);
    // Meer: rollende Wellen (Lautstärke schwingt langsam)
    const wave = 0.5 + 0.5 * Math.sin(t * 0.55) * Math.sin(t * 0.21 + 1);
    this.sea.g.gain.setTargetAtTime((0.25 + wave * 0.35) * (1 - landNear * 0.5), t, 0.3);
    this.sea.f.frequency.setTargetAtTime(350 + wave * 500, t, 0.3);
    // Wind: stärker, je weiter herausgezoomt
    this.wind.g.gain.setTargetAtTime(0.04 + zoomOut * 0.16 + 0.05 * Math.sin(t * 0.13), t, 0.8);
    this.wind.f.frequency.setTargetAtTime(600 + 500 * Math.sin(t * 0.09), t, 1);
    this.gamePaused = paused;
    this.music(t);
    if (paused || !this.soundOn) return;
    // Möwen über dem Wasser
    if (t > this.nextGull) {
      this.nextGull = t + 6 + Math.random() * 12;
      if (landNear < 0.9) {
        const base = 1300 + Math.random() * 500;
        for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this.tone(base, 0.28, { type: 'triangle', vol: 0.035, slide: 0.6, delay: i * 0.3, out: this.amb, attack: 0.03 });
      }
    }
    // Vögel im Wald (nur nah dran)
    if (t > this.nextBird) {
      this.nextBird = t + 2 + Math.random() * 5;
      if (forestNear > 0.2 && this.cam.dist < 40) {
        const f = 2800 + Math.random() * 1600;
        for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) this.tone(f * (1 + Math.random() * 0.15), 0.07, { vol: 0.02 * forestNear, slide: 1.3, delay: i * 0.11, out: this.amb });
      }
    }
  }

  /** Musik: ruhige, gezupfte Melodie, wechselt sanft die Akkorde (läuft auch in der Pause) */
  private music(t: number) {
    if (this.musicOn && t > this.nextNote) {
      const chords = [[146.8, 220, 293.7], [130.8, 196, 261.6], [174.6, 220, 349.2], [164.8, 246.9, 329.6]];
      const scale = [293.7, 329.6, 349.2, 392, 440, 493.9, 523.3, 587.3];
      const step = 0.42;
      this.nextNote = t + step;
      const beat = Math.floor(t / step);
      if (beat % 16 === 0) {
        this.chord = (this.chord + 1) % chords.length;
        chords[this.chord].forEach((f) => this.tone(f, 5, { type: 'sine', vol: 0.05, out: this.mus, attack: 0.6, verb: 0.3 }));
      }
      if (Math.random() < 0.6) {
        const f = scale[Math.floor(Math.random() * scale.length)];
        this.tone(f, 1.6, { type: 'triangle', vol: 0.06, out: this.mus, verb: 0.8 });
        this.tone(f * 2, 0.6, { type: 'sine', vol: 0.015, out: this.mus });
      }
    }
  }
}

export const sound = new Sound();
