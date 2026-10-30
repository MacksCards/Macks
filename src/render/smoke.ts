// Rauch aus Schornsteinen: weiche, aufsteigende Wolken, die mit dem Wind treiben.
import * as THREE from 'three';

const MAX = 600;

export class Smoke {
  points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private age = new Float32Array(MAX).fill(99);
  private life = new Float32Array(MAX).fill(1);
  private seed = new Float32Array(MAX);
  private next = 0;
  private acc = new Map<string, number>();

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('age', new THREE.BufferAttribute(new Float32Array(MAX), 1));
    geo.setAttribute('seed', new THREE.BufferAttribute(this.seed, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uScale: { value: 400 } },
      vertexShader: /* glsl */ `
        attribute float age; attribute float seed;
        uniform float uScale;
        varying float vA; varying float vS;
        void main() {
          vA = age; vS = seed;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.18 + age * 0.55) * uScale / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA; varying float vS;
        void main() {
          if (vA > 1.0) discard;
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float n = sin((c.x + vS) * 17.0) * sin((c.y - vS) * 13.0) * 0.08;
          float a = smoothstep(0.5, 0.15, d + n) * (1.0 - vA) * smoothstep(0.0, 0.08, vA) * 0.55;
          vec3 col = mix(vec3(0.55, 0.53, 0.5), vec3(0.85, 0.85, 0.84), vA);
          gl_FragColor = vec4(col, a);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  /** key = eindeutige Quelle, p = Weltposition der Öffnung, rate = Wölkchen pro Sekunde */
  emit(key: string, p: THREE.Vector3, dt: number, rate = 1.6) {
    let a = (this.acc.get(key) ?? Math.random()) + dt * rate;
    while (a >= 1) {
      a -= 1;
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      this.pos[i * 3] = p.x + (Math.random() - 0.5) * 0.04;
      this.pos[i * 3 + 1] = p.y;
      this.pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 0.04;
      this.age[i] = 0;
      this.life[i] = 3 + Math.random() * 1.5;
      this.seed[i] = Math.random() * 10;
    }
    this.acc.set(key, a);
  }

  update(dt: number, viewportHeight: number) {
    const ageAttr = this.points.geometry.attributes.age as THREE.BufferAttribute;
    for (let i = 0; i < MAX; i++) {
      if (this.age[i] > 1) { ageAttr.setX(i, 2); continue; }
      this.age[i] += dt / this.life[i];
      this.pos[i * 3] += dt * 0.12; // Wind
      this.pos[i * 3 + 1] += dt * (0.35 - this.age[i] * 0.15);
      this.pos[i * 3 + 2] += dt * 0.05;
      ageAttr.setX(i, this.age[i]);
    }
    ageAttr.needsUpdate = true;
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = viewportHeight * 0.9;
  }
}
