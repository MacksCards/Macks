// Spielstände (Paket P1): mehrere Plätze, die nicht verloren gehen.
//   • „Auto 1“ und „Auto 2“: das Spiel speichert laufend in einen der beiden und wechselt alle 5 Minuten.
//     So bleibt immer ein älterer Stand übrig, falls beim Speichern einmal etwas schiefgeht.
//   • „Platz 1“ bis „Platz 3“: eigene Plätze, die nur der Spieler selbst beschreibt.
// Gespeichert wird im großen Speicher des Browsers (IndexedDB) statt im kleinen localStorage, und zwar
// gepackt (gzip, etwa ein Zehntel der Größe). Gibt es den großen Speicher nicht (z. B. in manchen privaten
// Fenstern), geht es mit localStorage weiter. Der alte Stand aus localStorage wird beim ersten Start
// übernommen (nach „Auto 1“) und erst danach dort gelöscht.
// Weitergeben: Ein Stand lässt sich als Text (oder Textdatei) ausgeben und wieder einlesen.
// Die Daten selbst (SaveData, Version in game.ts) ändern sich hier nicht – nur die Hülle drumherum.
import { Game, SAVE_VERSION, type SaveData } from './game';
import { stufe } from './schwierigkeit';

export type SlotId = 'auto1' | 'auto2' | 'platz1' | 'platz2' | 'platz3';

export const SLOTS: readonly { id: SlotId; name: string; auto: boolean }[] = [
  { id: 'auto1', name: 'Auto 1', auto: true },
  { id: 'auto2', name: 'Auto 2', auto: true },
  { id: 'platz1', name: 'Platz 1', auto: false },
  { id: 'platz2', name: 'Platz 2', auto: false },
  { id: 'platz3', name: 'Platz 3', auto: false },
];
export const AUTO_SLOTS: readonly SlotId[] = ['auto1', 'auto2'];
export const OWN_SLOTS: readonly SlotId[] = ['platz1', 'platz2', 'platz3'];
export const slotName = (id: SlotId) => SLOTS.find((s) => s.id === id)?.name ?? id;

/** nach so vielen Millisekunden wechselt die Selbstsicherung auf den anderen Auto-Platz */
export const AUTO_WECHSEL_MS = 5 * 60 * 1000;

/** Kurzinfo zu einem Stand (für die Liste, ohne die großen Daten zu lesen) */
export interface SaveMeta {
  slot: SlotId;
  /** wann gespeichert (Date.now()) */
  zeit: number;
  /** Spielzeit in Spielsekunden */
  spielzeit: number;
  einwohner: number;
  geld: number;
  /** Name der Schwierigkeit („Normal“) */
  stufe: string;
  /** Inselwelt-Nummer */
  seed: number;
  /** Version der Spieldaten (SaveData.v) */
  v: number;
  /** gz = gepackt (Uint8Array), json = ungepackter Text */
  format: 'gz' | 'json';
  /** Größe der gespeicherten Daten in Bytes */
  bytes: number;
  /** nur Auto-Plätze: seit wann dieser Platz der laufende ist (für den Wechsel alle 5 Minuten) */
  seit?: number;
}

type Data = Uint8Array | string;

/** Wo die Stände liegen (IndexedDB, localStorage oder – für Tests – im Arbeitsspeicher) */
export interface Backend {
  readonly art: 'indexeddb' | 'localstorage' | 'speicher';
  list(): Promise<SaveMeta[]>;
  read(slot: SlotId): Promise<{ meta: SaveMeta; data: Data } | null>;
  /** beginnt das Schreiben sofort (wichtig beim Schließen der App) */
  write(meta: SaveMeta, data: Data): Promise<void>;
  remove(slot: SlotId): Promise<void>;
}

// ---------- Packen ----------

const hasGzip = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

export async function gzip(text: string): Promise<Uint8Array> {
  const s = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

export async function gunzip(bytes: Uint8Array): Promise<string> {
  const s = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(s).text();
}

export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function fromBase64(text: string): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function unpack(format: SaveMeta['format'], data: Data): Promise<string> {
  if (format === 'json') return typeof data === 'string' ? data : new TextDecoder().decode(data);
  return gunzip(typeof data === 'string' ? fromBase64(data) : data);
}

/** Text → Spiel. Wirft einen Fehler mit verständlicher Meldung, wenn der Stand nicht passt. */
export function gameFromJson(json: string): Game {
  let d: SaveData;
  try { d = JSON.parse(json) as SaveData; } catch { throw new Error('Der Spielstand ist beschädigt.'); }
  if (!d || typeof d !== 'object' || typeof d.v !== 'number') throw new Error('Das ist kein Spielstand von Neue Ufer.');
  if (d.v > SAVE_VERSION) throw new Error('Dieser Spielstand stammt aus einer neueren Fassung des Spiels.');
  if (d.v < 3) throw new Error('Dieser Spielstand ist zu alt.');
  try { return Game.fromSave(d); } catch { throw new Error('Der Spielstand ist beschädigt.'); }
}

// ---------- Speicherorte ----------

const DB_NAME = 'neue-ufer';
const DB_VER = 1;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, bad) => { r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error); });
}
function done(tx: IDBTransaction): Promise<void> {
  return new Promise((ok, bad) => { tx.oncomplete = () => ok(); tx.onerror = () => bad(tx.error); tx.onabort = () => bad(tx.error ?? new Error('abgebrochen')); });
}

/** Großer Speicher des Browsers: Kurzinfo („meta“) und Daten („daten“) getrennt, damit die Liste schnell ist */
class IdbBackend implements Backend {
  readonly art = 'indexeddb' as const;
  constructor(private db: IDBDatabase) {}
  static open(timeoutMs = 4000): Promise<IdbBackend> {
    return new Promise((ok, bad) => {
      if (typeof indexedDB === 'undefined') { bad(new Error('kein IndexedDB')); return; }
      const t = setTimeout(() => bad(new Error('IndexedDB antwortet nicht')), timeoutMs);
      let r: IDBOpenDBRequest;
      try { r = indexedDB.open(DB_NAME, DB_VER); } catch (e) { clearTimeout(t); bad(e); return; }
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'slot' });
        if (!db.objectStoreNames.contains('daten')) db.createObjectStore('daten');
      };
      r.onsuccess = () => { clearTimeout(t); ok(new IdbBackend(r.result)); };
      r.onerror = () => { clearTimeout(t); bad(r.error); };
      r.onblocked = () => { clearTimeout(t); bad(new Error('IndexedDB blockiert')); };
    });
  }
  async list() { return (await req(this.db.transaction('meta').objectStore('meta').getAll())) as SaveMeta[]; }
  async read(slot: SlotId) {
    const tx = this.db.transaction(['meta', 'daten']);
    const [meta, data] = await Promise.all([req(tx.objectStore('meta').get(slot)), req(tx.objectStore('daten').get(slot))]);
    return meta && data !== undefined ? { meta: meta as SaveMeta, data: data as Data } : null;
  }
  write(meta: SaveMeta, data: Data) {
    // Transaktion sofort beginnen (ohne await davor), damit sie auch beim Schließen der App noch durchläuft
    const tx = this.db.transaction(['meta', 'daten'], 'readwrite');
    tx.objectStore('daten').put(data, meta.slot);
    tx.objectStore('meta').put(meta);
    return done(tx);
  }
  remove(slot: SlotId) {
    const tx = this.db.transaction(['meta', 'daten'], 'readwrite');
    tx.objectStore('daten').delete(slot);
    tx.objectStore('meta').delete(slot);
    return done(tx);
  }
}

/** Ersatz ohne IndexedDB: localStorage (klein, daher gepackt und als Text) */
class LocalBackend implements Backend {
  readonly art = 'localstorage' as const;
  private key = (slot: SlotId) => `neue-ufer-stand-${slot}`;
  async list() {
    const out: SaveMeta[] = [];
    for (const s of SLOTS) {
      try { const m = localStorage.getItem(this.key(s.id) + '-info'); if (m) out.push(JSON.parse(m) as SaveMeta); } catch { /* übergehen */ }
    }
    return out;
  }
  async read(slot: SlotId) {
    const m = localStorage.getItem(this.key(slot) + '-info'), d = localStorage.getItem(this.key(slot));
    return m && d ? { meta: JSON.parse(m) as SaveMeta, data: d } : null;
  }
  async write(meta: SaveMeta, data: Data) {
    const text = typeof data === 'string' ? data : toBase64(data);
    // erst die Daten, dann die Kurzinfo: so zeigt die Liste nie einen Stand ohne Daten
    localStorage.setItem(this.key(meta.slot), text);
    localStorage.setItem(this.key(meta.slot) + '-info', JSON.stringify(meta));
  }
  async remove(slot: SlotId) { localStorage.removeItem(this.key(slot)); localStorage.removeItem(this.key(slot) + '-info'); }
}

/** nur im Arbeitsspeicher (Tests, oder wenn der Browser gar nichts speichern lässt) */
export class MemoryBackend implements Backend {
  readonly art = 'speicher' as const;
  readonly map = new Map<SlotId, { meta: SaveMeta; data: Data }>();
  /** für Tests: Schreiben schlägt fehl */
  fail = false;
  async list() { return [...this.map.values()].map((e) => e.meta); }
  async read(slot: SlotId) { return this.map.get(slot) ?? null; }
  async write(meta: SaveMeta, data: Data) { if (this.fail) throw new Error('voll'); this.map.set(meta.slot, { meta, data }); }
  async remove(slot: SlotId) { this.map.delete(slot); }
}

// ---------- Spielstände ----------

/** Text am Anfang eines weitergegebenen Stands (1 = gepackt, 0 = ungepackt) */
const EXPORT_GZ = 'NEUE-UFER-1:';
const EXPORT_TXT = 'NEUE-UFER-0:';

export class SaveStore {
  backend: Backend = new MemoryBackend();
  /** der Auto-Platz, in den gerade laufend gespeichert wird */
  cur: SlotId = 'auto1';
  /** seit wann (Date.now()) */
  private curSince = Date.now();
  /** fortlaufende Nummer je Platz: ein langsames Packen darf keinen neueren Stand überschreiben */
  private seq = new Map<SlotId, number>();
  /** Fehler beim Selbstsichern hintereinander (zweimal = Meldung an den Spieler) */
  fails = 0;
  /** Meldung bei wiederholtem Fehler (setzt main.ts) */
  onFail: ((text: string) => void) | null = null;
  /** Uhr (für Tests austauschbar) */
  now = () => Date.now();

  /** Speicherort wählen (IndexedDB, sonst localStorage, sonst nur Arbeitsspeicher) und dauerhaften Speicher erbitten */
  async init(backend?: Backend): Promise<void> {
    if (backend) this.backend = backend;
    else {
      try { this.backend = await IdbBackend.open(); } catch {
        try { localStorage.setItem('neue-ufer-probe', '1'); localStorage.removeItem('neue-ufer-probe'); this.backend = new LocalBackend(); } catch { this.backend = new MemoryBackend(); }
      }
      // Bitte an den Browser, die Stände nicht bei Platzmangel zu löschen (Antwort ist egal)
      try { void navigator.storage?.persist?.().catch(() => undefined); } catch { /* egal */ }
    }
    // weiter im zuletzt laufenden Auto-Platz
    const autos = (await this.list()).filter((m) => AUTO_SLOTS.includes(m.slot)).sort((a, b) => b.zeit - a.zeit);
    if (autos[0]) { this.cur = autos[0].slot; this.curSince = autos[0].seit ?? autos[0].zeit; } else this.curSince = this.now();
  }

  async list(): Promise<SaveMeta[]> {
    try { return (await this.backend.list()).filter((m) => m && SLOTS.some((s) => s.id === m.slot)); } catch { return []; }
  }

  /** der zuletzt gespeicherte Stand (zum Weiterspielen beim Start) */
  async latest(): Promise<SaveMeta | null> {
    return (await this.list()).sort((a, b) => b.zeit - a.zeit)[0] ?? null;
  }

  private meta(g: Game, slot: SlotId, format: SaveMeta['format'], bytes: number): SaveMeta {
    const m: SaveMeta = {
      slot, zeit: this.now(), spielzeit: g.time, einwohner: g.population(), geld: Math.floor(g.money),
      stufe: stufe(g.opts.schwierigkeit).name, seed: g.seed, v: SAVE_VERSION, format, bytes,
    };
    if (slot === this.cur) m.seit = this.curSince;
    return m;
  }

  /**
   * Stand auf einen Platz schreiben. pack = false: ungepackt, aber das Schreiben beginnt sofort
   * (beim Schließen der App). Ergebnis: true = gespeichert.
   */
  async save(g: Game, slot: SlotId, pack = true): Promise<boolean> {
    const n = (this.seq.get(slot) ?? 0) + 1;
    this.seq.set(slot, n);
    try {
      const json = JSON.stringify(g.serialize());
      if (!pack || !hasGzip()) {
        await this.backend.write(this.meta(g, slot, 'json', json.length), json);
        return true;
      }
      const bytes = await gzip(json);
      if (this.seq.get(slot) !== n) return true; // inzwischen kam ein neuerer Stand – der gilt
      await this.backend.write(this.meta(g, slot, 'gz', bytes.length), bytes);
      return true;
    } catch (e) {
      console.warn('Speichern', e);
      return false;
    }
  }

  /** Selbstsicherung: in den laufenden Auto-Platz, alle 5 Minuten in den anderen */
  async autosave(g: Game, pack = true): Promise<boolean> {
    if (this.now() - this.curSince >= AUTO_WECHSEL_MS) this.wechsel();
    const ok = await this.save(g, this.cur, pack);
    if (ok) this.fails = 0;
    else if (++this.fails === 2) this.onFail?.('💾 Speichern nicht möglich – der Speicher des Browsers ist voll oder gesperrt (z. B. privates Surfen).');
    return ok;
  }

  /** auf den anderen Auto-Platz wechseln (alle 5 Minuten und bei einem neuen oder geladenen Spiel) */
  wechsel() {
    this.cur = this.cur === 'auto1' ? 'auto2' : 'auto1';
    this.curSince = this.now();
  }

  async load(slot: SlotId): Promise<Game> {
    let e: { meta: SaveMeta; data: Data } | null;
    try { e = await this.backend.read(slot); } catch { throw new Error('Der Speicher des Browsers ließ sich nicht lesen.'); }
    if (!e) throw new Error('Dieser Platz ist leer.');
    let json: string;
    try { json = await unpack(e.meta.format, e.data); } catch { throw new Error('Der Spielstand ist beschädigt.'); }
    return gameFromJson(json);
  }

  async remove(slot: SlotId): Promise<boolean> {
    try { await this.backend.remove(slot); return true; } catch { return false; }
  }

  /** Spiel als Text zum Weitergeben */
  async exportText(g: Game): Promise<string> {
    const json = JSON.stringify(g.serialize());
    if (!hasGzip()) return EXPORT_TXT + toBase64(new TextEncoder().encode(json));
    return EXPORT_GZ + toBase64(await gzip(json));
  }

  /** weitergegebenen Text einlesen (Leerzeichen und Zeilenumbrüche stören nicht) */
  async importText(text: string): Promise<Game> {
    const t = text.trim();
    const body = t.replace(/^NEUE-UFER-[01]:/, '').replace(/\s+/g, '');
    if (t.startsWith('{')) return gameFromJson(t); // ungepackter Spielstand (z. B. aus einer Sicherung)
    if (!/^NEUE-UFER-[01]:/.test(t)) throw new Error('Das ist kein Spielstand von Neue Ufer.');
    let json: string;
    try {
      const bytes = fromBase64(body);
      json = t.startsWith(EXPORT_GZ) ? await gunzip(bytes) : new TextDecoder().decode(bytes);
    } catch { throw new Error('Der Text ist unvollständig oder beschädigt.'); }
    return gameFromJson(json);
  }

  /**
   * Alter Stand aus localStorage (bis zu diesem Paket gab es nur den einen): beim ersten Start nach „Auto 1“
   * übernehmen. Gelöscht wird er dort erst, wenn er sicher im neuen Speicher liegt.
   * Ergebnis: das geladene Spiel (oder null) und ggf. ein Hinweis für den Spieler.
   */
  async migrate(): Promise<{ game: Game | null; note: string | null }> {
    if (this.backend.art !== 'indexeddb' && this.backend.art !== 'localstorage') return { game: null, note: null };
    if ((await this.list()).length) return { game: null, note: null };
    const game = Game.load();
    const note = Game.loadNote;
    if (!game) return { game: null, note };
    this.cur = 'auto1';
    this.curSince = this.now();
    if (await this.save(game, 'auto1')) Game.clearSave();
    return { game, note };
  }
}

/** die Spielstände dieses Spiels (main.ts ruft init() beim Start auf) */
export const saves = new SaveStore();

// ---------- Anzeige ----------

/** Spielzeit lesbar: „1 Std 05 Min“ bzw. „12 Min“ */
export function spielzeitText(sec: number): string {
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} Min`;
  return `${Math.floor(min / 60)} Std ${String(min % 60).padStart(2, '0')} Min`;
}

/** Datum lesbar: „heute 14:05“, „gestern 09:12“ oder „28.10. 18:30“ */
export function datumText(ms: number, jetzt = Date.now()): string {
  const d = new Date(ms), n = new Date(jetzt);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const day = (x: Date) => Math.floor((x.getTime() - x.getTimezoneOffset() * 60000) / 86400000);
  const diff = day(n) - day(d);
  if (diff === 0) return `heute ${hm}`;
  if (diff === 1) return `gestern ${hm}`;
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear() !== n.getFullYear() ? d.getFullYear() : ''} ${hm}`;
}
