// Bildqualität passt sich dem Gerät an.
// Gemessen wird die Bildzeit (Abstand zwischen zwei gezeichneten Bildern). Ist sie dauerhaft über 20 ms
// (also unter ca. 50 Bildern je Sekunde), wird eine Stufe tiefer geschaltet: erst feinere Auflösung weg
// (Pixelverhältnis 2 → 1,5 → 1,25 → 1), dann kleinere Schattenkarte (2048 → 1024 → aus).
// Läuft es lange ruhig (Rechenzeit je Bild unter 12 ms), wird vorsichtig wieder eine Stufe höher probiert.
// Hilft selbst die tiefste Stufe nicht (z. B. Stromsparmodus des iPhones mit fest 30 Bildern/s), geht es
// zurück zur Ausgangsstufe – dann liegt es nicht an der Grafik.

export type QualityMode = 'auto' | 'hoch' | 'sparsam';
export interface Level { pr: number; shadow: number }

/** alle Stufen von schön nach sparsam */
export const LEVELS: Level[] = [
  { pr: 2, shadow: 2048 },
  { pr: 1.5, shadow: 2048 },
  { pr: 1.25, shadow: 2048 },
  { pr: 1, shadow: 2048 },
  { pr: 1, shadow: 1024 },
  { pr: 1, shadow: 0 },
];

const WINDOW = 60; // Bilder je Messabschnitt
const SETTLE = 20; // Bilder nach einer Umschaltung, die nicht zählen

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] ?? 0; };

export class Quality {
  mode: QualityMode = 'auto';
  /** Stufe in `levels` (0 = schönste) */
  level = 0;
  /** Stufen, die auf diesem Gerät wirklich verschieden sind (Pixelverhältnis höchstens das des Geräts) */
  readonly levels: Level[];
  /** zuletzt gemessene Werte (Mittelwert eines Abschnitts), für die Messanzeige */
  lastInterval = 0;
  lastWork = 0;
  changes = 0;

  private iv: number[] = [];
  private work: number[] = [];
  private settle = SETTLE;
  private slow = 0; // aufeinanderfolgende langsame Abschnitte
  private calmSince = -1; // seit wann ruhig (ms)
  private upWait = 30000; // so lange ruhig, bevor höher probiert wird (wächst nach Fehlversuchen)
  private upAt = -1e9; // Zeitpunkt des letzten Hochschaltens
  private failedUp = new Map<number, number>(); // Fehlversuche je Stufe (nach 3 wird sie nicht mehr probiert)
  /** laufendes Herunterschalten: Ausgangsstufe und Bildzeit dort (hilft es am Ende gar nichts, zurück) */
  private episode: { from: number; last: number; flat: number } | null = null;
  private noDownUntil = 0;
  private downLock = 120000; // Sperre nach nutzlosem Herunterschalten (wächst bei Wiederholung)
  private floor = 0; // tiefer als diese Stufe nicht hochschalten (sparsam)

  constructor(private apply: (l: Level) => void, devicePR = (typeof window !== 'undefined' && window.devicePixelRatio) || 1) {
    const seen = new Set<string>();
    this.levels = [];
    for (const l of LEVELS) {
      const e = { pr: Math.min(devicePR, l.pr), shadow: l.shadow };
      const key = `${e.pr}:${e.shadow}`;
      if (!seen.has(key)) { seen.add(key); this.levels.push(e); }
    }
  }

  get current(): Level { return this.levels[this.level]; }

  /** Ziel-Bildzeit in ms (sparsam: 30 Bilder/s) */
  get budget() { return this.mode === 'sparsam' ? 1000 / 30 : 1000 / 60; }

  /** Mindestabstand zwischen zwei Bildern beim Spielen (sparsam = 30 Bilder/s) */
  get minInterval() { return this.mode === 'sparsam' ? 1000 / 30 - 3 : 0; }

  setMode(m: QualityMode) {
    this.mode = m;
    this.floor = m === 'sparsam' ? Math.min(1, this.levels.length - 1) : 0;
    this.upWait = 30000; this.failedUp.clear(); this.episode = null; this.noDownUntil = 0; this.slow = 0; this.calmSince = -1;
    this.set(m === 'hoch' ? 0 : this.floor);
  }

  private set(level: number) {
    level = Math.max(0, Math.min(this.levels.length - 1, level));
    const changed = level !== this.level;
    this.level = level;
    this.iv.length = 0; this.work.length = 0; this.settle = SETTLE;
    if (changed) this.changes++;
    this.apply(this.current);
  }

  /** Messpause (z. B. Spiel pausiert, Menü offen): nächste Bilder nicht mitzählen */
  pause() { this.iv.length = 0; this.work.length = 0; this.settle = Math.max(this.settle, 5); this.calmSince = -1; }

  /**
   * Nach jedem gezeichneten Bild beim Spielen aufrufen.
   * interval = Abstand zum vorigen Bild (ms), work = eigene Rechenzeit dieses Bildes (ms), now = Uhrzeit (ms)
   */
  sample(interval: number, work: number, now: number) {
    if (this.mode === 'hoch') return;
    if (this.settle > 0) { this.settle--; return; }
    this.iv.push(Math.min(interval, 250));
    this.work.push(work);
    if (this.iv.length < WINDOW) return;
    const mi = median(this.iv), mw = median(this.work);
    this.lastInterval = mi; this.lastWork = mw;
    this.iv.length = 0; this.work.length = 0;
    const B = this.budget;

    if (mi > B * 1.2) { // über 20 ms (sparsam: über 40 ms)
      this.calmSince = -1;
      if (++this.slow < 2 || now < this.noDownUntil) return;
      this.slow = 0;
      const ep = this.episode;
      if (ep) {
        // hat die letzte Stufe etwas gebracht?
        ep.flat = mi > ep.last * 0.9 ? ep.flat + 1 : 0;
        ep.last = mi;
        // zweimal hintereinander nichts gebracht (oder ganz unten und nichts gebracht): es liegt nicht an der
        // Grafik (z. B. Stromsparmodus mit fest 30 Bildern/s) → zurück zur Ausgangsstufe, länger nicht probieren
        if (ep.flat >= 2 || (ep.flat >= 1 && this.level >= this.levels.length - 1)) {
          this.episode = null;
          this.noDownUntil = now + this.downLock;
          this.downLock = Math.min(this.downLock * 2, 600000);
          this.set(ep.from);
          return;
        }
      }
      if (this.level >= this.levels.length - 1) return;
      // gerade erst hochgeschaltet und schon zu langsam: länger warten bis zum nächsten Versuch
      if (now - this.upAt < 15000) {
        this.upWait = Math.min(this.upWait * 2, 600000);
        this.failedUp.set(this.level, (this.failedUp.get(this.level) ?? 0) + 1);
      }
      if (!ep) this.episode = { from: this.level, last: mi, flat: 0 };
      this.set(this.level + 1);
      return;
    }
    this.slow = 0;
    this.episode = null; // flüssig: die gewählte Stufe passt
    // lange ruhig: eine Stufe höher probieren
    if (mi <= B * 1.06 && mw < 12 && this.level > this.floor && (this.failedUp.get(this.level - 1) ?? 0) < 3) {
      if (this.calmSince < 0) this.calmSince = now;
      else if (now - this.calmSince >= this.upWait) {
        this.calmSince = -1;
        this.upAt = now;
        this.set(this.level - 1);
      }
    } else this.calmSince = -1;
  }

  info() {
    const l = this.current;
    return { modus: this.mode, stufe: this.level, pixel: l.pr, schatten: l.shadow, bildMs: +this.lastInterval.toFixed(1), rechenMs: +this.lastWork.toFixed(1), wechsel: this.changes };
  }
}

/** kleine Messanzeige (mit ?debug in der Adresse): Bilder/s, Bildzeit, Stufe, Zeichenaufrufe */
export class DebugOverlay {
  private el: HTMLDivElement;
  private frames = 0;
  private t0 = 0;
  private maxIv = 0;

  constructor() {
    const el = document.createElement('div');
    el.id = 'debugInfo';
    Object.assign(el.style, {
      position: 'fixed', left: 'max(6px, env(safe-area-inset-left))', bottom: 'max(6px, env(safe-area-inset-bottom))',
      zIndex: '9999', pointerEvents: 'none', font: '11px/1.3 ui-monospace, Menlo, monospace', color: '#fff',
      background: 'rgba(0,0,0,0.55)', padding: '3px 6px', borderRadius: '6px', whiteSpace: 'pre',
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(el);
    this.el = el;
  }

  /** je gezeichnetem Bild */
  frame(now: number, interval: number, read: () => string) {
    if (!this.t0) this.t0 = now;
    this.frames++;
    if (interval > this.maxIv) this.maxIv = interval;
    if (now - this.t0 < 500) return;
    const fps = (this.frames * 1000) / (now - this.t0);
    this.el.textContent = `${fps.toFixed(0)} Bilder/s · längstes ${this.maxIv.toFixed(0)} ms\n${read()}`;
    this.frames = 0; this.t0 = now; this.maxIv = 0;
  }
}
