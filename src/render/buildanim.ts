// Kurze Bau-Animationen (rein optisch, ändern nichts am Spiel):
//  - Neubau: das Gebäude wächst in gut einer Sekunde aus dem Boden, dazu Staub und Hammerschläge.
//  - Aufstieg (Wohnhaus) und Kontor-Ausbau: kurz steht ein Holzgerüst um das Haus, das neue Haus streckt sich.
//  - Abriss und Zerstörung: Staubwolke, das Gebäude sinkt in den Boden und verschwindet.
// Die Animationen laufen in echter Zeit (auch in der Pause – man sieht sofort, dass gebaut wurde).
import * as THREE from 'three';
import { Builder, M } from './kit';

/** Dauer in Sekunden */
export const RISE_TIME = 1.3, SINK_TIME = 1.1, SCAFFOLD_TIME = 2.0, STRETCH_TIME = 0.7;

interface Rise { id: number; mesh: THREE.Object3D; t: number; done: () => void; dust: (k: number) => void; puffs: number }
interface Sink { mesh: THREE.Object3D; t: number; y0: number; depth: number; tilt: THREE.Vector3 }
interface Scaffold { mesh: THREE.Mesh; t: number; host: THREE.Object3D | null }

/** Gerüst um eine Grundfläche size × size, Höhe h: Stangen, Laufbretter, Querstreben (Fuß bei y = 0) */
function scaffoldGeo(size: number, h: number): THREE.BufferGeometry {
  const b = new Builder();
  const q = size * 0.47, H = Math.max(0.6, h * 0.92);
  const poles: [number, number][] = [];
  const n = Math.max(2, Math.round(size * 1.5));
  for (let i = 0; i <= n; i++) {
    const t = -q + (2 * q * i) / n;
    poles.push([t, -q], [t, q]);
    if (i > 0 && i < n) poles.push([-q, t], [q, t]);
  }
  for (const [x, z] of poles) b.cyl(0.018, 0.022, H, 5, M.holz, x, 0, z);
  // Laufbretter und Geländer auf zwei bis drei Ebenen
  const levels = H > 1.4 ? 3 : 2;
  for (let l = 1; l <= levels; l++) {
    const y = (H * l) / (levels + 0.3);
    for (const s of [-1, 1]) {
      b.box(2 * q + 0.06, 0.025, 0.12, M.bretter, 0, y, s * (q + 0.04));
      b.box(0.12, 0.025, 2 * q + 0.06, M.bretter, s * (q + 0.04), y, 0);
      b.box(2 * q, 0.018, 0.018, M.holz, 0, y + 0.16, s * (q + 0.09));
      b.box(0.018, 0.018, 2 * q, M.holz, s * (q + 0.09), y + 0.16, 0);
    }
  }
  // Querstreben an den Seiten (schräg)
  const diag = Math.hypot(2 * q, H * 0.8);
  const ang = Math.atan2(H * 0.8, 2 * q);
  for (const s of [-1, 1]) {
    b.add(new THREE.BoxGeometry(diag, 0.016, 0.016), M.holz, 0, H * 0.45, s * q, 0, 0, s * ang);
    b.add(new THREE.BoxGeometry(0.016, 0.016, diag), M.holz, s * q, H * 0.45, 0, 0, s * ang, 0);
  }
  return b.geometry();
}

export class BuildAnims {
  private rises: Rise[] = [];
  private sinks: Sink[] = [];
  private scaffolds: Scaffold[] = [];
  private geoCache = new Map<string, THREE.BufferGeometry>();

  constructor(private scene: THREE.Scene, private mat: THREE.Material) {}

  /** Läuft gerade etwas? (dann muss auch in der Pause gezeichnet werden) */
  get busy() { return this.rises.length + this.sinks.length + this.scaffolds.length > 0; }

  /** Gebäude wächst aus dem Boden; done kommt am Ende (z. B. Fahnen setzen), dust(k) bei k = 0 und 0,5 */
  rise(id: number, mesh: THREE.Object3D, done: () => void, dust: (k: number) => void, t0 = 0) {
    mesh.scale.set(0.9, 0.02, 0.9);
    // weiter wachsen (t0 > 0, neues Modell geladen): schon gezeigten Staub nicht wiederholen
    this.rises.push({ id, mesh, t: t0, done, dust, puffs: t0 > 0 ? (t0 / RISE_TIME > 0.5 ? 2 : 1) : 0 });
  }

  /** wächst das Gebäude gerade noch? */
  rising(id: number) { return this.rises.some((r) => r.id === id); }

  /** wie lange das Gebäude schon wächst (s), -1 = wächst nicht */
  riseTime(id: number) { return this.rises.find((r) => r.id === id)?.t ?? -1; }

  /** Wachsen sofort beenden (Gebäude wird ersetzt oder abgerissen) */
  finish(id: number, runDone = true) {
    const i = this.rises.findIndex((r) => r.id === id);
    if (i < 0) return;
    const r = this.rises[i];
    this.rises.splice(i, 1);
    r.mesh.scale.set(1, 1, 1);
    if (runDone) r.done();
  }

  /** Abriss: Gebäude sinkt ein und wird danach aus der Szene genommen (es muss noch in der Szene stehen) */
  sink(mesh: THREE.Object3D, height: number) {
    const a = Math.random() * Math.PI * 2;
    this.sinks.push({ mesh, t: 0, y0: mesh.position.y, depth: height + 0.3, tilt: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)) });
  }

  /** Aufstieg/Ausbau: Gerüst um das (neue) Gebäude, das sich dabei kurz streckt */
  scaffold(host: THREE.Object3D, size: number, height: number) {
    const key = `${size}:${Math.round(height * 5)}`;
    let geo = this.geoCache.get(key);
    if (!geo) { geo = scaffoldGeo(size, Math.round(height * 5) / 5); this.geoCache.set(key, geo); }
    const m = new THREE.Mesh(geo, this.mat);
    m.position.copy(host.position);
    m.rotation.y = host.rotation.y;
    m.castShadow = true;
    m.scale.set(1, 0.01, 1);
    this.scene.add(m);
    host.scale.set(1, 0.86, 1);
    this.scaffolds.push({ mesh: m, t: 0, host });
  }

  update(dt: number) {
    if (!this.busy) return;
    for (const r of this.rises) {
      r.t += dt;
      const k = Math.min(1, r.t / RISE_TIME);
      // erst zügig, dann sanft auslaufen, ganz am Ende ein kleines Nachfedern
      const e = 1 - (1 - k) ** 3;
      const settle = k > 0.75 ? Math.sin((k - 0.75) * 4 * Math.PI) * 0.03 * (1 - k) * 4 : 0;
      r.mesh.scale.set(0.9 + 0.1 * e, Math.max(0.02, e + settle), 0.9 + 0.1 * e);
      if (r.puffs === 0) { r.puffs = 1; r.dust(0); }
      if (r.puffs === 1 && k > 0.5) { r.puffs = 2; r.dust(0.5); }
    }
    for (const r of this.rises.filter((x) => x.t >= RISE_TIME)) this.finish(r.id);
    for (const s of this.sinks) {
      s.t += dt;
      const k = Math.min(1, s.t / SINK_TIME);
      s.mesh.position.y = s.y0 - s.depth * k * k;
      // leicht zur Seite kippen beim Einstürzen
      s.mesh.rotation.x = s.tilt.x * 0.12 * k;
      s.mesh.rotation.z = s.tilt.z * 0.12 * k;
    }
    for (const s of this.sinks.filter((x) => x.t >= SINK_TIME)) this.scene.remove(s.mesh);
    this.sinks = this.sinks.filter((x) => x.t < SINK_TIME);
    for (const s of this.scaffolds) {
      s.t += dt;
      const k = s.t / SCAFFOLD_TIME;
      // Gerüst steht schnell, bleibt, und wird am Ende abgebaut (sinkt nach unten weg)
      const up = Math.min(1, s.t / 0.3), down = Math.min(1, Math.max(0, (k - 0.8) / 0.2));
      s.mesh.scale.y = Math.max(0.01, up * (1 - down));
      if (s.host) {
        const st = Math.min(1, s.t / STRETCH_TIME);
        s.host.scale.y = 0.86 + 0.14 * (1 - (1 - st) ** 3);
        if (st >= 1) { s.host.scale.y = 1; s.host = null; }
      }
    }
    for (const s of this.scaffolds.filter((x) => x.t >= SCAFFOLD_TIME)) this.scene.remove(s.mesh);
    this.scaffolds = this.scaffolds.filter((x) => x.t < SCAFFOLD_TIME);
  }

  /** Gebäude wird ersetzt: ein laufendes Gerüst-Strecken auf das neue Modell nicht mehr anwenden */
  detach(host: THREE.Object3D) {
    for (const s of this.scaffolds) if (s.host === host) { host.scale.y = 1; s.host = null; }
  }

  /** alles sofort beenden (neues Spiel) */
  clear() {
    for (const r of this.rises) r.mesh.scale.set(1, 1, 1);
    this.rises = [];
    for (const s of this.sinks) this.scene.remove(s.mesh);
    this.sinks = [];
    for (const s of this.scaffolds) this.scene.remove(s.mesh);
    this.scaffolds = [];
  }
}
