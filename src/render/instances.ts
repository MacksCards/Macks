// Hilfen für "Instanzen" (eine Vorlage, viele Kopien – z. B. alle Schafe in einem Zeichenaufruf):
// Platz wächst nur bei Bedarf, und zur Grafikkarte geht nur der belegte Teil.
import * as THREE from 'three';

/**
 * Sorgt dafür, dass mindestens `need` Kopien Platz haben (höchstens `max`). Der Platz wird verdoppelt;
 * der alte Grafikspeicher wird dabei freigegeben. Gibt den nutzbaren Platz zurück.
 */
export function ensureCapacity(m: THREE.InstancedMesh, need: number, max: number): number {
  const cap = m.instanceMatrix.count;
  if (need <= cap || cap >= max) return cap;
  const next = Math.min(max, Math.max(need, cap * 2));
  // alten Speicher auf der Grafikkarte freigeben (three.js legt ihn beim nächsten Zeichnen neu an)
  m.dispose();
  const mat = new Float32Array(next * 16);
  mat.set(m.instanceMatrix.array as Float32Array);
  m.instanceMatrix = new THREE.InstancedBufferAttribute(mat, 16).setUsage(THREE.DynamicDrawUsage);
  if (m.instanceColor) {
    const col = new Float32Array(next * 3).fill(1);
    col.set(m.instanceColor.array as Float32Array);
    m.instanceColor = new THREE.InstancedBufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage);
  }
  return next;
}

/** Anzahl setzen; nur die ersten n Kopien hochladen; ganz leere Gruppen nicht zeichnen */
export function flushInstances(m: THREE.InstancedMesh, n: number) {
  m.count = n;
  m.visible = n > 0;
  if (n === 0) return;
  m.instanceMatrix.clearUpdateRanges();
  m.instanceMatrix.addUpdateRange(0, n * 16);
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) {
    m.instanceColor.clearUpdateRanges();
    m.instanceColor.addUpdateRange(0, n * 3);
    m.instanceColor.needsUpdate = true;
  }
}
