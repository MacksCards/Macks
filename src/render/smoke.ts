// Rauch aus Schornsteinen: weiche, aufsteigende Wolken, die mit dem Wind treiben.
// Alle Schornsteine teilen sich EINEN Vorrat an Wölkchen und werden in einem einzigen Zeichenaufruf
// gezeichnet (Leistung auf dem iPhone). Je Art ein anderer Rauch: Schmelze und Schmieden dunkel und
// kräftig, Bäckerei hell, Wohnhaus dünn.
import * as THREE from 'three';
import type { SmokeStyle } from './citysigns';

const MAX = 1400;

/** Aussehen je Art: Wölkchen je Sekunde, Dunkelheit (0 hell … 1 schwarzgrau), Größe, Lebensdauer in s */
export const SMOKE_LOOK: Record<SmokeStyle, { rate: number; tone: number; size: number; life: number; rise: number }> = {
  dunkel: { rate: 2.6, tone: 0.92, size: 1.45, life: 4.6, rise: 0.42 },
  mittel: { rate: 1.6, tone: 0.45, size: 1.1, life: 3.9, rise: 0.36 },
  hell: { rate: 1.9, tone: 0.0, size: 1.15, life: 3.6, rise: 0.38 },
  duenn: { rate: 0.75, tone: 0.18, size: 0.78, life: 3.2, rise: 0.32 },
};

export class Smoke {
  points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private age = new Float32Array(MAX).fill(2);
  private life = new Float32Array(MAX).fill(1);
  private seed = new Float32Array(MAX);
  private tone = new Float32Array(MAX);
  private size = new Float32Array(MAX).fill(1);
  private rise = new Float32Array(MAX);
  private next = 0;
  /** lebende Wölkchen (0 = nichts zu zeichnen und nichts hochzuladen) */
  private live = 0;
  private acc = new Map<number, number>();

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('age', new THREE.BufferAttribute(this.age, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('seed', new THREE.BufferAttribute(this.seed, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('tone', new THREE.BufferAttribute(this.tone, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('psize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uScale: { value: 400 } },
      vertexShader: /* glsl */ `
        attribute float age; attribute float seed; attribute float tone; attribute float psize;
        uniform float uScale;
        varying float vA; varying float vS; varying float vT;
        void main() {
          vA = age; vS = seed; vT = tone;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = age > 1.0 ? 0.0 : (0.16 + age * 0.62) * psize * uScale / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA; varying float vS; varying float vT;
        void main() {
          if (vA > 1.0) discard;
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          // ausgefranster Rand: zwei Wellenmuster je Wölkchen verschieden
          float n = sin((c.x + vS) * 17.0) * sin((c.y - vS) * 13.0) * 0.08 + sin((c.x - c.y + vS * 2.0) * 23.0) * 0.03;
          float a = smoothstep(0.5, 0.12, d + n) * (1.0 - vA) * smoothstep(0.0, 0.08, vA) * (0.62 + vT * 0.25);
          // etwas Licht von oben: Unterseite dunkler
          float shade = 0.9 + 0.2 * (0.5 - gl_PointCoord.y);
          vec3 start = mix(vec3(0.70, 0.68, 0.64), vec3(0.13, 0.12, 0.11), vT);
          vec3 end = mix(vec3(0.92, 0.92, 0.91), vec3(0.45, 0.44, 0.43), vT);
          gl_FragColor = vec4(mix(start, end, vA) * shade, a);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  /**
   * Wölkchen ausstoßen. key = eindeutige Quelle (Gebäude und Schornstein), (x, y, z) = Öffnung in Weltkoordinaten,
   * strength 0..1 (mehr Arbeit = mehr Rauch).
   */
  emit(key: number, x: number, y: number, z: number, dt: number, style: SmokeStyle, strength = 1) {
    const L = SMOKE_LOOK[style];
    let a = (this.acc.get(key) ?? Math.random()) + dt * L.rate * strength;
    while (a >= 1) {
      a -= 1;
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      if (this.age[i] > 1) this.live++;
      this.pos[i * 3] = x + (Math.random() - 0.5) * 0.04;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.04;
      this.age[i] = 0;
      this.life[i] = L.life * (0.8 + Math.random() * 0.4);
      this.seed[i] = Math.random() * 10;
      this.tone[i] = L.tone;
      this.size[i] = L.size * (0.85 + Math.random() * 0.3);
      this.rise[i] = L.rise * (0.85 + Math.random() * 0.3);
    }
    this.acc.set(key, a);
  }

  /** Quelle vergessen (Gebäude weg) */
  forget(key: number) { this.acc.delete(key); }

  /** alles löschen (neues Spiel) */
  clear() {
    this.age.fill(2);
    this.acc.clear();
    this.live = 0;
    this.points.geometry.setDrawRange(0, 0);
  }

  /** Anzahl lebender Wölkchen (für Tests und Messungen) */
  get count() { return this.live; }

  /** dt = Sekunden seit dem letzten Bild (0 in der Pause: dann steht der Rauch still) */
  update(dt: number, viewportHeight: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = viewportHeight * 0.9;
    if (!this.live) return;
    if (dt > 0) {
      let live = 0;
      for (let i = 0; i < MAX; i++) {
        if (this.age[i] > 1) continue;
        this.age[i] += dt / this.life[i];
        if (this.age[i] > 1) { this.age[i] = 2; continue; }
        live++;
        const a = this.age[i];
        this.pos[i * 3] += dt * (0.1 + a * 0.12); // Wind, oben stärker
        this.pos[i * 3 + 1] += dt * this.rise[i] * (1 - a * 0.55);
        this.pos[i * 3 + 2] += dt * (0.04 + a * 0.05);
      }
      this.live = live;
    }
    const geo = this.points.geometry;
    geo.setDrawRange(0, this.live ? MAX : 0);
    for (const n of ['position', 'age', 'seed', 'tone', 'psize']) (geo.attributes[n] as THREE.BufferAttribute).needsUpdate = true;
  }
}
