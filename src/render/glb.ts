// Lädt die von Meshy erzeugten 3D-Modelle (public/models/*.glb, Liste in manifest.json).
// Fehlt ein Modell, zeigt das Spiel weiter das Platzhalter-Modell aus Code.
// Der Lader (ca. 65 KB) kommt nur ins Spiel, wenn beim Bauen der Datei Modelle in manifest.json stehen
// (__MODELLE__ setzt vite.config.ts).
//
// Sparsam fürs iPhone: Beim Start wird nur die Liste (manifest.json) gelesen. Ein Modell wird erst
// geladen, wenn das Spiel es zum ersten Mal braucht (bis dahin gilt das Code-Modell). Jede Datei wird
// nur einmal geladen; alle Kopien teilen sich Form und Oberflächenbilder im Grafikspeicher.
import * as THREE from 'three';
import { BuildingId } from '../data';

declare const __MODELLE__: boolean;

type Loader = {
  loadAsync(url: string): Promise<{ scene: THREE.Object3D }>;
  parseAsync(data: ArrayBuffer, path: string): Promise<{ scene: THREE.Object3D }>;
};

/** Lader nur einbauen, wenn es beim Bauen Modelle gab (sonst entfernt das Bauwerkzeug diesen Teil ganz) */
// (typeof-Prüfung: in Tests ohne Bauwerkzeug ist __MODELLE__ nicht gesetzt)
const loadLoader = typeof __MODELLE__ !== 'undefined' && __MODELLE__
  ? async (): Promise<Loader> => {
    const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([import('three/examples/jsm/loaders/GLTFLoader.js'), import('three/examples/jsm/libs/meshopt_decoder.module.js')]);
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    return loader;
  }
  : null;

interface Entry {
  file: string; art: string; building?: BuildingId; tier?: number; size?: number;
  /** Drehung in Grad, damit die Vorderseite (+z) dorthin zeigt, wo das Spiel sie erwartet (Werft: Helling zum Wasser) */
  yaw?: number;
  /** Mühle: Mitte der Flügel (Nabe) in Modell-Koordinaten und Flügellänge – dort drehen sich Code-Flügel */
  nabe?: [number, number, number]; fluegel?: number;
  /** Spitze des Fahnenmasts im Modell (Modell-Koordinaten): dort hängt die Fahne in Besitzerfarbe, ohne eigenen Mast */
  fahne?: [number, number, number];
  /** Schornstein-Öffnungen im Modell (Modell-Koordinaten): dort steigt Rauch auf (geprüft an Bildern, siehe docs/GRAFIK.md) */
  rauch?: [number, number, number][];
  /** höchstens so hoch (in Feldern); sonst gilt MAX_HEIGHT je Grundfläche */
  hoehe?: number;
}

/** Was nach einem Ladevorgang neu da ist (damit nur diese Gebäude/Schiffe neu aufgebaut werden) */
export interface Loaded { buildings: Set<BuildingId>; others: Set<string> }

/** Mindest-Verhältnisse des Hüllquaders: flachere/dünnere Modelle sind meist nur Bruchstücke */
const MIN_DEPTH = 0.35, MIN_HEIGHT = 0.3;
/**
 * Höchste sinnvolle Höhe je Grundfläche (in Feldern). Schlanke Modelle (Turm auf 1×1) würden sonst
 * auf volle Breite gezogen und ragten weit über das Kontor. Das Modell wird dann gleichmäßig kleiner
 * (nie gestaucht) und steht etwas schmaler auf seinem Feld.
 * Heute betrifft das nur den Holzturm (2,8 → 1,5); Kirche (3,1 bei 3×3) und Erzschmelze (2,6 bei 2×2) bleiben.
 */
const MAX_HEIGHT: Record<number, number> = { 1: 1.5, 2: 2.8, 3: 3.6 };

export class ModelLibrary {
  private base = 'models/';
  /** Einträge aus manifest.json: „gebäude:stufe“ bzw. Name (Schiffe usw.) */
  private entries = new Map<string, Entry>();
  /** fertige Modelle; false = unbrauchbar (Code-Modell bleibt) */
  private ready = new Map<string, THREE.Object3D | false>();
  private pending = new Set<string>();
  /** jede Datei nur einmal laden (mehrere Gebäude können dieselbe Datei nutzen) */
  private files = new Map<string, Promise<THREE.Object3D | null>>();
  private loader: Promise<Loader> | null = null;
  private batch: Loaded | null = null;
  onLoaded: (what: Loaded) => void = () => {};

  /** Nur die Liste lesen – die Modelle selbst kommen erst, wenn sie gebraucht werden */
  async load(base = 'models/') {
    this.base = base;
    let manifest: Record<string, Entry>;
    try {
      const res = await fetch(base + 'manifest.json');
      if (!res.ok) return;
      manifest = await res.json();
    } catch {
      return; // keine Modelle vorhanden (z. B. Vorschau ohne Dateien)
    }
    if (!manifest || typeof manifest !== 'object' || !Object.keys(manifest).length) return;
    if (!loadLoader) { console.warn('Modelle vorhanden, aber diese Datei wurde ohne Modell-Lader gebaut (npm run build neu ausführen).'); return; }
    const what: Loaded = { buildings: new Set(), others: new Set() };
    for (const [id, e] of Object.entries(manifest)) {
      if (!e?.file) continue;
      if (e.building && e.size) { this.entries.set(`${e.building}:${e.tier ?? 0}`, e); what.buildings.add(e.building); } else { this.entries.set(id, e); what.others.add(id); }
    }
    // Liste ist da: Gebäude und Schiffe einmal fragen lassen (das stößt das Laden der gebrauchten Modelle an)
    if (this.entries.size) this.onLoaded(what);
  }

  /**
   * Welches Modell building() jetzt liefern würde (Schlüssel „gebäude:stufe“, null = Code-Modell).
   * Stößt das Laden fehlender Modelle an. Solange eine höhere Stufe noch lädt, bleibt die nächstniedrige
   * fertige Stufe sichtbar (kein kurzes Zurückspringen auf das Code-Modell beim Aufstieg).
   */
  shownKey(type: BuildingId, tier = 0): string | null {
    for (let t = tier; t >= 0; t--) {
      const key = `${type}:${t}`;
      if (!this.entries.has(key)) continue;
      const m = this.ready.get(key);
      if (m === false) continue; // unbrauchbar: nächstniedrige Stufe versuchen
      if (m) return key;
      this.request(key);
    }
    return null;
  }

  /** Kopie des Gebäudemodells (höchste fertige Stufe ≤ tier) oder null (dann Code-Modell) */
  building(type: BuildingId, tier = 0): THREE.Object3D | null {
    const key = this.shownKey(type, tier);
    const m = key ? this.ready.get(key) : null;
    return m ? m.clone(true) : null;
  }

  /**
   * Grafikspeicher freigeben (bei „Neues Spiel“): Gebäudemodelle, die im neuen Spiel nicht gebraucht werden
   * (Gebäudearten nicht in keep), werden losgelassen und bei Bedarf einfach neu geladen.
   * Schiffsmodelle bleiben (jedes Spiel beginnt mit einem Schiff).
   * Vorher müssen alle Gebäude des alten Spiels aus der Szene genommen sein.
   */
  release(keep: Set<BuildingId>) {
    const keepFiles = new Set<string>();
    for (const [key, e] of this.entries) if (!e.building || keep.has(e.building) || this.pending.has(key)) keepFiles.add(e.file);
    for (const [key, e] of this.entries) {
      if (keepFiles.has(e.file)) continue;
      const m = this.ready.get(key);
      if (m) disposeModel(m);
      this.ready.delete(key);
    }
    for (const [file, p] of this.files) {
      if (keepFiles.has(file)) continue;
      this.files.delete(file);
      void p.then((raw) => { if (raw) disposeModel(raw); });
    }
  }

  other(id: string): THREE.Object3D | null {
    if (!this.entries.has(id)) return null;
    const m = this.ready.get(id);
    if (m) return m.clone(true);
    if (m === undefined) this.request(id);
    return null;
  }

  /** Wie viele Modelle schon geladen sind (für Tests und Messungen) */
  stats() {
    return { listed: this.entries.size, loaded: [...this.ready.values()].filter(Boolean).length, files: this.files.size };
  }

  private request(key: string) {
    if (this.pending.has(key)) return;
    this.pending.add(key);
    void this.fetchModel(key);
  }

  private async fetchModel(key: string) {
    const e = this.entries.get(key)!;
    const raw = await this.file(e.file);
    let model: THREE.Object3D | false = false;
    if (raw) {
      if (e.building && e.size) {
        if (plausible(raw, key)) model = fitToFootprint(raw.clone(true), e);
      } else model = raw.clone(true);
    }
    this.ready.set(key, model);
    this.pending.delete(key);
    if (!model && !(e.building && (e.tier ?? 0) > 0)) return; // nichts Neues zu zeigen
    // mehrere fertige Modelle kurz sammeln und gemeinsam melden
    if (!this.batch) {
      this.batch = { buildings: new Set(), others: new Set() };
      setTimeout(() => { const b = this.batch!; this.batch = null; this.onLoaded(b); }, 30);
    }
    if (e.building && e.size) this.batch.buildings.add(e.building); else this.batch.others.add(key);
  }

  private file(name: string): Promise<THREE.Object3D | null> {
    let p = this.files.get(name);
    if (!p) {
      p = (async () => {
        try {
          if (!this.loader) this.loader = loadLoader!();
          const loader = await this.loader;
          // Vorschau-Seite auf claude.ai liefert keine .glb-Dateien aus: dort liegen die Modelle als Text (base64, *.glb.txt)
          const gltf = name.endsWith('.txt')
            ? await loader.parseAsync(await base64File(this.base + name), '')
            : await loader.loadAsync(this.base + name);
          gltf.scene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
          });
          return gltf.scene;
        } catch (err) {
          console.warn('Modell konnte nicht geladen werden:', name, err);
          return null;
        }
      })();
      this.files.set(name, p);
    }
    return p;
  }
}

/** Liest eine Textdatei mit base64-Inhalt und gibt die Bytes zurück */
async function base64File(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bin = atob((await res.text()).trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** Zu flache oder zu dünne Modelle (Hüllquader) sind meist nur Bruchstücke: nicht verwenden */
function plausible(obj: THREE.Object3D, key: string): boolean {
  const dim = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  const w = Math.max(dim.x, dim.z, 0.001), d = Math.min(dim.x, dim.z);
  if (d / w < MIN_DEPTH || dim.y / w < MIN_HEIGHT) {
    console.warn(`Modell ${key} sieht unvollständig aus (Tiefe/Breite ${(d / w).toFixed(2)}, Höhe/Breite ${(dim.y / w).toFixed(2)}) – das Code-Modell bleibt.`);
    return false;
  }
  return true;
}

/**
 * Modell so skalieren, dass es mittig auf die Grundfläche passt und auf dem Boden steht.
 * Merkt sich die höchste Stelle (userData.peak, für die Fahne in Besitzerfarbe).
 */
function fitToFootprint(obj: THREE.Object3D, e: Entry): THREE.Object3D {
  const size = e.size ?? 1;
  obj.rotation.y = ((e.yaw ?? 0) * Math.PI) / 180;
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const dim = box.getSize(new THREE.Vector3());
  // auf die Grundfläche passen, aber nicht höher als sinnvoll (gleichmäßig verkleinern, nie stauchen)
  const maxH = e.hoehe ?? MAX_HEIGHT[size] ?? size * 1.2;
  const s = Math.min((size * 0.96) / Math.max(dim.x, dim.z, 0.001), maxH / Math.max(dim.y, 0.001));
  const wrap = new THREE.Group();
  obj.scale.multiplyScalar(s);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.set(-c.x * s, -box.min.y * s, -c.z * s);
  wrap.add(obj);
  wrap.updateMatrixWorld(true);
  wrap.userData.peak = highestPoint(wrap);
  wrap.userData.height = dim.y * s;
  if (e.nabe) {
    wrap.userData.hub = new THREE.Vector3(...e.nabe).applyMatrix4(obj.matrix).toArray();
    wrap.userData.hubR = (e.fluegel ?? 0.9) * s;
  }
  if (e.fahne) wrap.userData.flagAt = new THREE.Vector3(...e.fahne).applyMatrix4(obj.matrix).toArray();
  if (e.rauch?.length) wrap.userData.smokeAt = e.rauch.map((p) => new THREE.Vector3(...p).applyMatrix4(obj.matrix).toArray());
  return wrap;
}

/** Form, Oberflächen und Bilder eines geladenen Modells im Grafikspeicher freigeben */
function disposeModel(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
      mat.dispose();
    }
  });
}

/** höchster Punkt des Modells (x, y, z in der Grundfläche) */
function highestPoint(root: THREE.Object3D): [number, number, number] {
  const best = new THREE.Vector3(0, -Infinity, 0), v = new THREE.Vector3();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    const pos = m.isMesh ? m.geometry.getAttribute('position') : null;
    if (!pos) return;
    // jeden Punkt prüfen (wenige zehntausend – geht schnell, nur einmal je Modell)
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (v.y > best.y) best.copy(v);
    }
  });
  return best.y === -Infinity ? [0, 1, 0] : [best.x, best.y, best.z];
}
