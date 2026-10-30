// Lädt die von Meshy erzeugten 3D-Modelle (public/models/*.glb, Liste in manifest.json).
// Fehlt ein Modell, zeigt das Spiel weiter das Platzhalter-Modell aus Code.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { BuildingId } from '../data';

interface Entry { file: string; art: string; building?: BuildingId; tier?: number; size?: number }

export class ModelLibrary {
  private buildings = new Map<string, THREE.Object3D>();
  private others = new Map<string, THREE.Object3D>();
  onLoaded: () => void = () => {};

  async load(base = 'models/') {
    let manifest: Record<string, Entry>;
    try {
      const res = await fetch(base + 'manifest.json');
      if (!res.ok) return;
      manifest = await res.json();
    } catch {
      return; // keine Modelle vorhanden (z. B. Vorschau ohne Dateien)
    }
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const jobs = Object.entries(manifest).map(async ([id, e]) => {
      try {
        const gltf = await loader.loadAsync(base + e.file);
        const root = gltf.scene;
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
        });
        if (e.building && e.size) {
          this.buildings.set(`${e.building}:${e.tier ?? 0}`, fitToFootprint(root, e.size));
        } else this.others.set(id, root);
      } catch (err) {
        console.warn('Modell konnte nicht geladen werden:', id, err);
      }
    });
    await Promise.all(jobs);
    if (this.buildings.size || this.others.size) this.onLoaded();
  }

  /** Kopie des Gebäudemodells (höchste vorhandene Stufe ≤ tier) oder null */
  building(type: BuildingId, tier = 0): THREE.Object3D | null {
    for (let t = tier; t >= 0; t--) {
      const m = this.buildings.get(`${type}:${t}`);
      if (m) return m.clone(true);
    }
    return null;
  }

  other(id: string): THREE.Object3D | null {
    return this.others.get(id)?.clone(true) ?? null;
  }
}

/** Modell so skalieren, dass es mittig auf die Grundfläche passt und auf dem Boden steht */
function fitToFootprint(obj: THREE.Object3D, size: number): THREE.Object3D {
  const box = new THREE.Box3().setFromObject(obj);
  const dim = box.getSize(new THREE.Vector3());
  const s = (size * 0.96) / Math.max(dim.x, dim.z, 0.001);
  const wrap = new THREE.Group();
  obj.scale.setScalar(s);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.set(-c.x * s, -box.min.y * s, -c.z * s);
  wrap.add(obj);
  return wrap;
}
