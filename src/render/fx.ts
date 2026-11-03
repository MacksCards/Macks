// Kampf-Effekte: Mündungsfeuer, Pulverdampf, Kanonenkugeln im Bogen, Einschläge (Staub, Splitter, Wasserfontänen),
// Funken beim Schwertkampf, Feuer und Rauch an beschädigten Gebäuden/Schiffen, Lebensbalken.
// Alles aus festen Vorräten (Pools) – es werden zur Laufzeit keine neuen Objekte erzeugt.
import * as THREE from 'three';
import type { Game, ShotKind } from '../game';
import { T } from '../world';
import { flushInstances } from './instances';

/** Teilchen-Arten (Flamme = Feuerzunge, Qualm = dunkle Rauchsäule über einem Brand) */
const enum K { Rauch, Staub, Gischt, Blitz, Feuer, Funke, Splitter, Flamme, Qualm }

/** wind: Abdrift nach der Seite (Felder je Sekunde) – Flammen bleiben auf dem Dach, Rauch zieht ab */
interface Look { c0: number; c1: number; s0: number; s1: number; a: number; grav: number; drag: number; rise: number; wind: number }
const LOOK: Record<K, Look> = {
  [K.Rauch]: { c0: 0xe6e2da, c1: 0x8f8a83, s0: 0.35, s1: 1.5, a: 0.7, grav: 0, drag: 2.2, rise: 0.35, wind: 0.12 },
  [K.Staub]: { c0: 0xa88c66, c1: 0x6f5e48, s0: 0.3, s1: 1.1, a: 0.75, grav: 0.6, drag: 2.5, rise: 0.1, wind: 0.12 },
  [K.Gischt]: { c0: 0xffffff, c1: 0xd4e6ee, s0: 0.16, s1: 0.4, a: 0.95, grav: 7, drag: 0.4, rise: 0, wind: 0 },
  [K.Blitz]: { c0: 0xfff4c0, c1: 0xff7a1a, s0: 0.7, s1: 0.3, a: 1, grav: 0, drag: 0, rise: 0, wind: 0 },
  [K.Feuer]: { c0: 0xffc850, c1: 0xc8300e, s0: 0.42, s1: 0.12, a: 1, grav: 0, drag: 1, rise: 0.9, wind: 0.04 },
  [K.Funke]: { c0: 0xfff6c8, c1: 0xffa040, s0: 0.09, s1: 0.04, a: 1, grav: 5, drag: 0.5, rise: 0, wind: 0 },
  [K.Splitter]: { c0: 0x6a5038, c1: 0x4a3828, s0: 0.09, s1: 0.08, a: 1, grav: 6, drag: 0.3, rise: 0, wind: 0 },
  // Flammen steigen kaum (sie „sitzen“ auf dem Dach, statt als Flecken in die Luft zu steigen) und leben kurz
  [K.Flamme]: { c0: 0xffb03a, c1: 0xc0280a, s0: 1.55, s1: 0.95, a: 1, grav: 0, drag: 3, rise: 0.3, wind: 0.03 },
  [K.Qualm]: { c0: 0x2a2520, c1: 0x7d776f, s0: 0.45, s1: 1.9, a: 0.8, grav: 0, drag: 0.45, rise: 0.5, wind: 0.3 },
};

class Particles {
  points: THREE.Points;
  private n: number;
  private pos: Float32Array; private col: Float32Array; private size: Float32Array; private alpha: Float32Array;
  private vel: Float32Array; private age: Float32Array; private life: Float32Array; private kind: Uint8Array;
  private next = 0;
  private c0 = new THREE.Color(); private c1 = new THREE.Color();
  live = 0;
  /** seit dem letzten Bild neu entstanden (dann muss hochgeladen werden, auch wenn vorher nichts lebte) */
  private spawned = false;

  /** flame = Feuerzungen: unten breit und hell, oben spitz und rot, die Ränder züngeln (statt runder Kugeln) */
  constructor(n: number, additive: boolean, private flame = false) {
    // Feuerzungen werden normal gemischt (nicht addiert): sonst summieren sich viele Zungen zu einem weiß-gelben
    // Leuchtfleck, und die roten Spitzen gehen verloren. Das Leuchten kommt vom Glutschein darunter (additiv).
    this.n = n;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.age = new Float32Array(n).fill(1); this.life = new Float32Array(n).fill(1);
    this.kind = new Uint8Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('pcol', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('psize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('palpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      blending: additive && !flame ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 400 }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute vec3 pcol; attribute float psize; attribute float palpha;
        uniform float uScale; varying vec3 vC; varying float vA; varying float vS;
        void main() {
          vC = pcol; vA = palpha;
          vS = fract(sin(float(gl_VertexID) * 12.9898) * 43758.5453);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = palpha <= 0.0 ? 0.0 : psize * uScale / -mv.z;
        }`,
      fragmentShader: flame ? /* glsl */ `
        uniform float uTime;
        varying vec3 vC; varying float vA; varying float vS;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float y = c.y + 0.5; // 0 = Spitze oben, 1 = Fuß unten
          float wob = sin(y * 9.0 - uTime * (9.0 + vS * 5.0) + vS * 40.0) * 0.07 * (1.0 - y)
                    + sin(y * 23.0 - uTime * 17.0 + vS * 11.0) * 0.025 * (1.0 - y);
          float w = 0.04 + 0.34 * pow(y, 0.62);
          float dx = abs(c.x + wob) / w;
          float body = smoothstep(1.0, 0.4, dx) * smoothstep(0.0, 0.32, y) * smoothstep(1.0, 0.74, y);
          float a = body * vA;
          if (a < 0.01) discard;
          // Farbe von unten nach oben: heller gelber Kern am Fuß, orange Mitte, dunkelrote Spitze
          vec3 tip = vec3(0.7, 0.05, 0.01), mid = vec3(1.0, 0.38, 0.04), base = vec3(1.0, 0.86, 0.45);
          vec3 col = mix(tip, mid, smoothstep(0.1, 0.5, y));
          col = mix(col, base, smoothstep(0.55, 0.9, y) * smoothstep(0.95, 0.15, dx));
          // die Farbe des Teilchens (wird mit dem Alter röter) tönt das Ganze
          col *= mix(vec3(1.0), vC * 1.25, 0.45);
          gl_FragColor = vec4(col, a * mix(0.75, 1.0, y));
          #include <colorspace_fragment>
        }` : /* glsl */ `
        varying vec3 vC; varying float vA;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float n = sin(c.x * 23.0 + vC.r * 9.0) * sin(c.y * 19.0) * 0.06;
          float a = smoothstep(0.5, 0.12, d + n) * vA;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vC, a);
          #include <colorspace_fragment>
        }`,
    });
    for (const a of Object.values(geo.attributes)) (a as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    this.points.visible = false;
  }

  spawn(kind: K, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number) {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.age[i] = 0; this.life[i] = life; this.kind[i] = kind;
    this.spawned = true;
  }

  update(dt: number, vh: number) {
    // nichts lebt und nichts Neues: keine Rechnung, kein Hochladen, nicht zeichnen
    if (this.live === 0 && !this.spawned) { this.points.visible = false; return; }
    this.spawned = false;
    let live = 0, lo = this.n, hi = -1;
    for (let i = 0; i < this.n; i++) {
      if (this.age[i] >= 1) {
        // gerade erloschen: einmal unsichtbar hochladen
        if (this.alpha[i] !== 0) { this.alpha[i] = 0; if (i < lo) lo = i; if (i > hi) hi = i; }
        continue;
      }
      live++;
      if (i < lo) lo = i;
      if (i > hi) hi = i;
      const L = LOOK[this.kind[i] as K];
      const a = (this.age[i] += dt / this.life[i]);
      const dr = Math.max(0, 1 - L.drag * dt);
      this.vel[i * 3] *= dr; this.vel[i * 3 + 2] *= dr;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - L.grav * dt + L.rise * dt;
      this.pos[i * 3] += (this.vel[i * 3] + L.wind) * dt; // leichter Wind
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += (this.vel[i * 3 + 2] + L.wind * 0.4) * dt;
      if (L.grav && this.pos[i * 3 + 1] < -0.05) this.age[i] = 1;
      const t = Math.min(1, a);
      this.c0.setHex(L.c0); this.c1.setHex(L.c1); this.c0.lerp(this.c1, t);
      this.col[i * 3] = this.c0.r; this.col[i * 3 + 1] = this.c0.g; this.col[i * 3 + 2] = this.c0.b;
      this.size[i] = L.s0 + (L.s1 - L.s0) * t;
      const k = this.kind[i];
      this.alpha[i] = a >= 1 ? 0 : L.a * Math.min(1, a * (k === K.Qualm ? 4 : 12)) * (1 - t) ** (k === K.Rauch ? 1.2 : k === K.Qualm ? 0.6 : 0.8);
    }
    this.live = live;
    this.points.visible = live > 0;
    if (hi < lo) return;
    // nur den Bereich mit lebenden (oder gerade erloschenen) Teilchen hochladen
    const g = this.points.geometry, n = hi - lo + 1;
    for (const name of ['position', 'pcol', 'psize', 'palpha']) {
      const a = g.attributes[name] as THREE.BufferAttribute;
      a.clearUpdateRanges();
      a.addUpdateRange(lo * a.itemSize, n * a.itemSize);
      a.needsUpdate = true;
    }
    g.setDrawRange(lo, n);
    const u = (this.points.material as THREE.ShaderMaterial).uniforms;
    u.uScale.value = vh * 0.9;
    if (this.flame) u.uTime.value += dt;
  }
}

interface Ball { on: boolean; fx: number; fy: number; fz: number; tx: number; ty: number; tz: number; t: number; dur: number; arc: number; water: boolean; hit: boolean }
interface Delayed { t: number; fn: () => void }

/** Lebensbalken über beschädigten Dingen (immer zur Kamera gedreht, feste Bildschirmgröße) */
export class HpBars {
  group = new THREE.Group();
  private bg: THREE.Sprite[] = [];
  private fg: THREE.Sprite[] = [];
  private used = 0;
  private static W = 0.045;
  private static H = 0.0075;

  constructor(private max = 160) {
    for (let i = 0; i < max; i++) {
      const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x1a1410, depthTest: false, sizeAttenuation: false, transparent: true, opacity: 0.75 }));
      const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x5ad04a, depthTest: false, sizeAttenuation: false }));
      bg.scale.set(HpBars.W + 0.003, HpBars.H + 0.003, 1);
      bg.renderOrder = 11; fg.renderOrder = 12;
      bg.visible = fg.visible = false;
      this.bg.push(bg); this.fg.push(fg);
      this.group.add(bg, fg);
    }
  }

  begin() { this.used = 0; }

  bar(x: number, y: number, z: number, frac: number) {
    if (this.used >= this.max) return;
    const i = this.used++;
    const f = Math.max(0.02, Math.min(1, frac));
    const bg = this.bg[i], fg = this.fg[i];
    bg.position.set(x, y, z); fg.position.set(x, y, z);
    fg.scale.set(HpBars.W * f, HpBars.H, 1);
    fg.center.set(0.5 / f, 0.5);
    (fg.material as THREE.SpriteMaterial).color.setHex(f > 0.6 ? 0x5ad04a : f > 0.3 ? 0xf0c030 : 0xe2452f);
    bg.visible = fg.visible = true;
  }

  end() { for (let i = this.used; i < this.max; i++) { if (!this.bg[i].visible) break; this.bg[i].visible = this.fg[i].visible = false; } }
}

export class Fx {
  group = new THREE.Group();
  bars = new HpBars();
  private soft = new Particles(1400, false);
  private glow = new Particles(700, true);
  /** Feuerzungen brennender Gebäude (eigene Form, siehe Particles) */
  private flames = new Particles(500, true, true);
  private balls: Ball[] = [];
  private ballMesh: THREE.InstancedMesh;
  private delayed: Delayed[] = [];
  private burnAcc = new Map<string, number>();
  private m = new THREE.Matrix4();
  private time = 0;

  constructor(private g: Game, private height: (x: number, z: number) => number) {
    this.ballMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.5, metalness: 0.6 }), 96);
    this.ballMesh.count = 0;
    this.ballMesh.visible = false;
    this.ballMesh.frustumCulled = false;
    for (let i = 0; i < 96; i++) this.balls.push({ on: false, fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0, t: 0, dur: 1, arc: 0, water: false, hit: false });
    this.group.add(this.soft.points, this.flames.points, this.glow.points, this.ballMesh, this.bars.group);
  }

  setGame(g: Game, height: (x: number, z: number) => number) { this.g = g; this.height = height; }

  private isWater(x: number, y: number) {
    const tx = Math.floor(x), ty = Math.floor(y);
    return !this.g.inMap(tx, ty) || this.g.tiles[this.g.idx(tx, ty)] === T.Wasser;
  }
  private ground(x: number, y: number) { return this.isWater(x, y) ? 0.02 : Math.max(0.02, this.height(x, y)); }

  /** Mündungsfeuer + Pulverdampf an (x,y,z), Richtung (dx,dz) */
  private muzzle(x: number, y: number, z: number, dx: number, dz: number, big: number) {
    this.glow.spawn(K.Blitz, x + dx * 0.08, y, z + dz * 0.08, dx * 0.4, 0, dz * 0.4, 0.12 + big * 0.04);
    this.glow.spawn(K.Blitz, x + dx * 0.18, y, z + dz * 0.18, dx * 0.8, 0.05, dz * 0.8, 0.09);
    for (let i = 0; i < 5 + big * 7; i++) {
      const s = 0.4 + Math.random() * 1.4 * (0.6 + big * 0.4);
      this.soft.spawn(K.Rauch, x + dx * 0.12, y, z + dz * 0.12, dx * s + (Math.random() - 0.5) * 0.5, 0.1 + Math.random() * 0.3, dz * s + (Math.random() - 0.5) * 0.5, 2 + Math.random() * 2 * (big + 0.5));
    }
  }

  /** Einschlag: Staub + Splitter an Land, Fontäne im Wasser */
  private impact(x: number, y: number, z: number, water: boolean, hit: boolean, big = 1) {
    if (water && !hit) {
      for (let i = 0; i < 14 * big; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 0.5;
        this.soft.spawn(K.Gischt, x, 0.05, z, Math.cos(a) * r, 1.8 + Math.random() * 1.6 * big, Math.sin(a) * r, 0.9);
      }
      this.soft.spawn(K.Rauch, x, 0.1, z, 0, 0.2, 0, 1.2);
      return;
    }
    this.glow.spawn(K.Blitz, x, y + 0.08, z, 0, 0.3, 0, 0.12);
    for (let i = 0; i < 6 * big; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.3 + Math.random() * 0.6;
      this.soft.spawn(K.Staub, x, y + 0.05, z, Math.cos(a) * r, 0.3 + Math.random() * 0.5, Math.sin(a) * r, 1.2 + Math.random());
    }
    for (let i = 0; i < 7 * big; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 1.2;
      this.soft.spawn(K.Splitter, x, y + 0.1, z, Math.cos(a) * r, 1.2 + Math.random() * 1.5, Math.sin(a) * r, 1.1);
      this.glow.spawn(K.Funke, x, y + 0.1, z, Math.cos(a) * r * 1.3, 1 + Math.random() * 1.5, Math.sin(a) * r * 1.3, 0.5);
    }
  }

  private ball(fx: number, fy: number, fz: number, tx: number, ty: number, tz: number, water: boolean, hit: boolean, delay = 0) {
    const start = () => {
      const b = this.balls.find((x) => !x.on);
      if (!b) { this.impact(tx, ty, tz, water, hit); return; }
      const d = Math.hypot(tx - fx, tz - fz);
      Object.assign(b, { on: true, fx, fy, fz, tx, ty, tz, t: 0, dur: 0.2 + d / 13, arc: 0.15 + d * 0.07, water, hit });
    };
    if (delay > 0) this.delayed.push({ t: this.time + delay, fn: start }); else start();
  }

  /** Schuss oder Schlag zeigen (Spielfeld-Koordinaten) */
  shot(kind: ShotKind, fx: number, fy: number, tx: number, ty: number, hit: boolean) {
    let dx = tx - fx, dz = ty - fy;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    if (!hit) { // daneben: Ziel etwas versetzen
      const a = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 0.8;
      tx += Math.cos(a) * r; ty += Math.sin(a) * r;
    }
    const water = this.isWater(tx, ty);
    const gy = this.ground(tx, ty);
    const ty3 = gy + (hit ? 0.25 : 0);
    switch (kind) {
      case 'schwert': {
        const x = fx + dx * d * 0.55, z = fy + dz * d * 0.55, y = this.ground(x, z) + 0.28;
        for (let i = 0; i < 5; i++) this.glow.spawn(K.Funke, x, y, z, (Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 1.2, (Math.random() - 0.5) * 1.6, 0.35);
        if (hit) this.soft.spawn(K.Staub, x, y - 0.2, z, 0, 0.2, 0, 0.8);
        break;
      }
      case 'muskete': {
        const y = this.ground(fx, fy) + 0.32;
        this.muzzle(fx + dx * 0.15, y, fy + dz * 0.15, dx, dz, 0);
        this.delayed.push({ t: this.time + 0.06 + d * 0.01, fn: () => {
          if (water && !hit) for (let i = 0; i < 4; i++) this.soft.spawn(K.Gischt, tx, 0.05, ty, (Math.random() - 0.5) * 0.3, 0.8 + Math.random(), (Math.random() - 0.5) * 0.3, 0.6);
          else { this.soft.spawn(K.Staub, tx, ty3, ty, 0, 0.3, 0, 0.7); this.glow.spawn(K.Funke, tx, ty3, ty, 0, 0.8, 0, 0.3); }
        } });
        break;
      }
      case 'kanone': {
        const y = this.ground(fx, fy) + 0.16;
        this.muzzle(fx + dx * 0.25, y, fy + dz * 0.25, dx, dz, 1);
        this.ball(fx + dx * 0.3, y, fy + dz * 0.3, tx, ty3, ty, water, hit);
        break;
      }
      case 'turm': {
        const y = this.ground(fx, fy) + 1.65;
        this.muzzle(fx + dx * 0.35, y, fy + dz * 0.35, dx, dz, 1);
        this.ball(fx + dx * 0.4, y, fy + dz * 0.4, tx, ty3, ty, water, hit);
        break;
      }
      case 'schiff': {
        // Breitseite: mehrere Kanonen entlang der Bordwand feuern kurz nacheinander
        const ax = -dz, az = dx; // Schiffsachse quer zur Schussrichtung
        const n = 4;
        for (let i = 0; i < n; i++) {
          const o = (i / (n - 1) - 0.5) * 1.1;
          const sx = fx + ax * o + dx * 0.3, sz = fy + az * o + dz * 0.3;
          this.delayed.push({ t: this.time + i * 0.11, fn: () => this.muzzle(sx, 0.32, sz, dx, dz, 1) });
          if (i % 2 === 0) this.ball(sx, 0.32, sz, tx + ax * o * 0.4, ty3, ty + az * o * 0.4, this.isWater(tx + ax * o * 0.4, ty + az * o * 0.4), hit, i * 0.11);
        }
        break;
      }
    }
  }

  /** Feuer und Rauch an einer Stelle (für beschädigte Gebäude und Schiffe), stark = 0..1; spread = halbe Breite
   *  der Fläche, auf der es brennt (die Flammen bleiben darauf – nichts schwebt neben dem Dach) */
  burn(key: string, x: number, y: number, z: number, strength: number, dt: number, spread = 0.3, drop = 0) {
    let a = (this.burnAcc.get(key) ?? Math.random()) + dt * (2 + strength * 10);
    while (a >= 1) {
      a -= 1;
      const ox = (Math.random() - 0.5) * spread * 1.4, oz = (Math.random() - 0.5) * spread * 1.4;
      if (strength > 0.2) {
        // Feuerzungen: unten breit und hell, oben spitz und rot, flackernd; dazu ein Glutschein am Fuß.
        // drop: so viel tiefer liegt das Dach am Rand der Fläche als am First – die Zungen folgen der Dachschräge
        // (vorher standen sie am Rand in der Luft neben dem Dach)
        for (let n = 0; n < 3 + Math.round(strength * 3); n++) {
          const dx = ox + (Math.random() - 0.5) * spread * 0.5, dz = oz + (Math.random() - 0.5) * spread * 0.5;
          const edge = Math.min(1, Math.max(Math.abs(dx), Math.abs(dz)) / Math.max(0.01, spread * 0.95));
          this.flames.spawn(K.Flamme, x + dx, y - 0.05 - drop * edge, z + dz, (Math.random() - 0.5) * 0.05, 0.08 + Math.random() * 0.14, (Math.random() - 0.5) * 0.05, 0.55 + Math.random() * 0.4 * strength + 0.15);
        }
        if (Math.random() < 0.4) this.glow.spawn(K.Feuer, x + ox, y - 0.1 - drop * 0.5, z + oz, 0, 0.1, 0, 0.55);
        if (strength > 0.4 && Math.random() < 0.3) this.glow.spawn(K.Funke, x + ox, y + 0.25, z + oz, (Math.random() - 0.5) * 0.6, 0.9 + Math.random() * 0.9, (Math.random() - 0.5) * 0.6, 0.18);
        // dunkle, dichte Rauchsäule, die hoch aufsteigt und mit dem Wind abzieht
        if (Math.random() < 0.7) this.soft.spawn(K.Qualm, x + ox * 0.5, y + 0.45, z + oz * 0.5, (Math.random() - 0.5) * 0.15, 0.4 + Math.random() * 0.3, (Math.random() - 0.5) * 0.15, 3 + Math.random() * 1.6);
      } else this.soft.spawn(K.Rauch, x + ox, y + 0.15, z + oz, 0, 0.25 + Math.random() * 0.2, 0, 2.5 + Math.random() * 2);
    }
    this.burnAcc.set(key, a);
  }

  /** Blasen und Wrackteile (sinkendes Schiff) */
  bubbles(x: number, z: number, n = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.5;
      this.soft.spawn(K.Gischt, x + Math.cos(a) * r, 0.04, z + Math.sin(a) * r, 0, 0.5 + Math.random() * 0.6, 0, 0.6);
    }
    if (Math.random() < 0.3) this.soft.spawn(K.Splitter, x + (Math.random() - 0.5), 0.1, z + (Math.random() - 0.5), (Math.random() - 0.5) * 0.4, 0.6, (Math.random() - 0.5) * 0.4, 1.4);
  }

  /** Staubwolke (z. B. eingestürztes Gebäude) */
  dust(x: number, y: number, z: number, n = 12, r = 0.8) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * r;
      this.soft.spawn(K.Staub, x + Math.cos(a) * s * 0.5, y, z + Math.sin(a) * s * 0.5, Math.cos(a) * s, 0.2 + Math.random() * 0.4, Math.sin(a) * s, 1.5 + Math.random());
    }
  }

  update(dt: number, viewportHeight: number) {
    this.time += dt;
    if (this.delayed.length) {
      const due = this.delayed.filter((d) => d.t <= this.time);
      if (due.length) { this.delayed = this.delayed.filter((d) => d.t > this.time); for (const d of due) d.fn(); }
    }
    let n = 0;
    for (const b of this.balls) {
      if (!b.on) continue;
      b.t += dt / b.dur;
      if (b.t >= 1) { b.on = false; this.impact(b.tx, b.ty, b.tz, b.water, b.hit); continue; }
      const x = b.fx + (b.tx - b.fx) * b.t, z = b.fz + (b.tz - b.fz) * b.t;
      const y = b.fy + (b.ty - b.fy) * b.t + Math.sin(b.t * Math.PI) * b.arc;
      this.m.makeTranslation(x, y, z);
      this.ballMesh.setMatrixAt(n++, this.m);
      if (Math.random() < 0.5) this.soft.spawn(K.Rauch, x, y, z, 0, 0.05, 0, 0.5); // feine Rauchspur
    }
    if (n || this.ballMesh.count) flushInstances(this.ballMesh, n);
    this.soft.update(dt, viewportHeight);
    this.flames.update(dt, viewportHeight);
    this.glow.update(dt, viewportHeight);
  }
}
