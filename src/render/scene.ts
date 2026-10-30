// 3D-Darstellung mit three.js: Insel, Wasser, Bäume, Berge, Wege, Gebäude.
import * as THREE from 'three';
import { BUILDINGS, BuildingId, GOOD } from '../data';
import { Building, Game } from '../game';
import { T, rng } from '../world';
import { mountainGeometry, treeGeometry } from './models_old';
import { buildingModel } from './models';
import { buildingMaterial } from './materials';
import { ModelDef } from './kit';

const LAND_Y = 0.3;

interface BView { mesh: THREE.Mesh; spin: { m: THREE.Mesh; axis: 'x' | 'z'; speed: number }[]; icon: THREE.Sprite; iconKey: string; tier: number }

export class View {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400);
  rig = { tx: 32, tz: 32, dist: 30, yaw: Math.PI * 0.25, pitch: 0.95 };

  private g: Game;
  private terrain!: THREE.Mesh;
  private terrainColors!: Float32Array;
  private baseColors!: Float32Array;
  private water!: THREE.Mesh;
  private waterUniforms: Record<string, THREE.IUniform> = { uTime: { value: 0 } };
  private trees!: THREE.InstancedMesh;
  private mountains!: THREE.InstancedMesh;
  private roadMesh!: THREE.InstancedMesh;
  private previewRoads!: THREE.InstancedMesh;
  private views = new Map<number, BView>();
  private mat = buildingMaterial();
  private ghost: THREE.Mesh | null = null;
  private ghostType: BuildingId | null = null;
  private ghostMatOk = buildingMaterial({ transparent: true, opacity: 0.75, color: 0xb8ffb8 });
  private ghostMatBad = buildingMaterial({ transparent: true, opacity: 0.6, color: 0xff7a7a });
  private footprint: THREE.Mesh;
  private radiusRing: THREE.Mesh;
  private selectRing: THREE.Mesh;
  private heights!: Float32Array;
  private iconTex = new Map<string, THREE.Texture>();
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -LAND_Y);
  private sun: THREE.DirectionalLight;
  areaShown = false;

  constructor(canvas: HTMLCanvasElement, g: Game) {
    this.g = g;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.background = this.skyTexture();
    this.scene.fog = new THREE.Fog(0xb7dcef, 70, 170);

    this.scene.add(new THREE.HemisphereLight(0xdcefff, 0x6b5a3a, 1.6));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 140;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun, sun.target);
    this.sun = sun;

    const fpMat = new THREE.MeshBasicMaterial({ color: 0x55ff55, transparent: true, opacity: 0.35, depthWrite: false });
    this.footprint = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), fpMat);
    this.footprint.visible = false;
    this.footprint.renderOrder = 2;
    this.scene.add(this.footprint);

    this.radiusRing = new THREE.Mesh(
      new THREE.RingGeometry(0.97, 1, 72).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }),
    );
    this.radiusRing.visible = false;
    this.radiusRing.renderOrder = 3;
    this.scene.add(this.radiusRing);

    this.selectRing = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.selectRing.visible = false;
    this.selectRing.renderOrder = 3;
    this.scene.add(this.selectRing);

    this.buildWorld();
  }

  private skyTexture(): THREE.Texture {
    const cv = document.createElement('canvas');
    cv.width = 4; cv.height = 256;
    const ctx = cv.getContext('2d')!;
    const gr = ctx.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#4f9fd8');
    gr.addColorStop(0.55, '#9fd0ee');
    gr.addColorStop(1, '#e6f2f2');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /** Alles (neu) aufbauen – z. B. nach "Neues Spiel" */
  setGame(g: Game) {
    this.g = g;
    for (const v of this.views.values()) { this.scene.remove(v.mesh, v.icon); }
    this.views.clear();
    for (const o of [this.terrain, this.water, this.trees, this.mountains, this.roadMesh, this.previewRoads]) {
      if (o) { this.scene.remove(o); o.geometry.dispose(); }
    }
    this.buildWorld();
  }

  private buildWorld() {
    const g = this.g;
    const k = g.kontor();
    if (k) { const [cx, cy] = g.center(k); this.rig.tx = cx; this.rig.tz = cy + 3; }
    this.buildTerrain();
    this.buildWater();
    this.buildMountains();
    this.buildTrees();
    this.buildRoads();
    for (const b of g.buildings) this.addBuilding(b);
  }

  // ---------- Gelände ----------

  private buildTerrain() {
    const g = this.g;
    const N = g.size;
    // Abstand jeder Wasserkachel zum Land (für Wassertiefe)
    const dist = new Float32Array(N * N).fill(99);
    const q: number[] = [];
    for (let i = 0; i < N * N; i++) if (g.tiles[i] !== T.Wasser) { dist[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      const x = i % N, y = (i / N) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const ni = ny * N + nx;
        if (dist[ni] > dist[i] + 1) { dist[ni] = dist[i] + 1; q.push(ni); }
      }
    }
    const r = rng(g.seed + 5);
    // Höhe der Eckpunkte
    const H = new Float32Array((N + 1) * (N + 1));
    for (let y = 0; y <= N; y++) {
      for (let x = 0; x <= N; x++) {
        let land = 0, tot = 0, dmin = 99;
        for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
          const tx = x + dx, ty = y + dy;
          if (tx < 0 || ty < 0 || tx >= N || ty >= N) { tot++; continue; }
          tot++;
          if (g.tiles[ty * N + tx] !== T.Wasser) land++;
          dmin = Math.min(dmin, dist[ty * N + tx]);
        }
        let h: number;
        if (land === tot) h = LAND_Y;
        else if (land > 0) h = 0.04 + (land / tot) * 0.1;
        else h = -0.35 - Math.min(dmin, 8) * 0.22 - r() * 0.08;
        H[y * (N + 1) + x] = h;
      }
    }
    this.heights = H;
    const pos: number[] = [];
    const col: number[] = [];
    const c = new THREE.Color();
    const tileColor = (t: number, d: number): number => {
      switch (t) {
        case T.Sand: return 0xe6d398;
        case T.Gras: return 0x86b84c;
        case T.Wald: return 0x5f9338;
        case T.Berg: return 0x8f8677;
        default: return d <= 1 ? 0xd9c487 : d <= 3 ? 0x6fa7a8 : 0x2f6a8c;
      }
    };
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const h00 = H[y * (N + 1) + x], h10 = H[y * (N + 1) + x + 1];
        const h01 = H[(y + 1) * (N + 1) + x], h11 = H[(y + 1) * (N + 1) + x + 1];
        // zwei Dreiecke (gegen den Uhrzeigersinn von oben)
        pos.push(x, h00, y, x, h01, y + 1, x + 1, h10, y);
        pos.push(x + 1, h10, y, x, h01, y + 1, x + 1, h11, y + 1);
        c.setHex(tileColor(g.tiles[i], dist[i]));
        const j = 0.93 + r() * 0.12;
        for (let v = 0; v < 6; v++) col.push(c.r * j, c.g * j, c.b * j);
      }
    }
    // Meeresboden außerhalb der Karte
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.terrainColors = new Float32Array(col);
    this.baseColors = new Float32Array(col);
    geo.setAttribute('color', new THREE.BufferAttribute(this.terrainColors, 3));
    geo.computeVertexNormals();
    this.terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
    this.areaShown = false;
  }

  /** Bereiche außerhalb des Baugebiets abdunkeln (beim Bauen) */
  showArea(on: boolean) {
    const g = this.g;
    const N = g.size;
    for (let i = 0; i < N * N; i++) {
      const dark = on && !g.area[i] && g.tiles[i] !== T.Wasser;
      const f = dark ? 0.55 : 1;
      for (let v = 0; v < 18; v++) this.terrainColors[i * 18 + v] = this.baseColors[i * 18 + v] * f;
    }
    (this.terrain.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    this.areaShown = on;
  }

  /** Farben neu, wenn Wald gerodet wurde */
  private refreshTileColors() {
    const g = this.g;
    const N = g.size;
    const c = new THREE.Color();
    for (let i = 0; i < N * N; i++) {
      const t = g.tiles[i];
      if (t !== T.Gras) continue;
      const cur = this.baseColors[i * 18 + 1];
      c.setHex(0x86b84c);
      if (Math.abs(cur - c.g) < 0.12) continue; // schon Gras
      for (let v = 0; v < 6; v++) {
        this.baseColors[i * 18 + v * 3] = c.r; this.baseColors[i * 18 + v * 3 + 1] = c.g; this.baseColors[i * 18 + v * 3 + 2] = c.b;
      }
    }
    this.showArea(this.areaShown);
  }

  private buildWater() {
    const g = this.g;
    const N = g.size;
    // Tiefenkarte: 0 an der Küste, 1 im tiefen Meer → Farbe, Schaum, Durchsichtigkeit
    const data = new Uint8Array(N * N * 4);
    const dist = new Float32Array(N * N).fill(99);
    const q: number[] = [];
    for (let i = 0; i < N * N; i++) if (g.tiles[i] !== T.Wasser) { dist[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      const x = i % N, y = (i / N) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const ni = ny * N + nx;
        if (dist[ni] > dist[i] + 1) { dist[ni] = dist[i] + 1; q.push(ni); }
      }
    }
    for (let i = 0; i < N * N; i++) {
      const v = Math.round(Math.min(1, dist[i] / 7) * 255);
      data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
    }
    const depthTex = new THREE.DataTexture(data, N, N);
    depthTex.magFilter = THREE.LinearFilter;
    depthTex.minFilter = THREE.LinearFilter;
    depthTex.needsUpdate = true;

    const geo = new THREE.PlaneGeometry(N * 5, N * 5, 160, 160).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshPhongMaterial({
      color: 0xffffff, transparent: true, shininess: 140, specular: 0xbfe6ff,
    });
    const uni = this.waterUniforms as Record<string, THREE.IUniform>;
    uni.uDepth = { value: depthTex };
    uni.uN = { value: N };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
uniform float uTime;
varying vec3 vW;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
float w1 = sin(wp.x * 0.7 + uTime * 1.3) * 0.045;
float w2 = cos(wp.z * 0.55 + uTime * 0.9) * 0.045;
float w3 = sin((wp.x + wp.z) * 1.6 + uTime * 2.1) * 0.018;
transformed.y += w1 + w2 + w3;
vW = wp;`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
{
  vec3 wq = (modelMatrix * vec4(position, 1.0)).xyz;
  float dx = cos(wq.x * 0.7 + uTime * 1.3) * 0.7 * 0.045 + cos((wq.x + wq.z) * 1.6 + uTime * 2.1) * 1.6 * 0.018;
  float dz = -sin(wq.z * 0.55 + uTime * 0.9) * 0.55 * 0.045 + cos((wq.x + wq.z) * 1.6 + uTime * 2.1) * 1.6 * 0.018;
  objectNormal = normalize(vec3(-dx * 3.0, 1.0, -dz * 3.0));
}`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
uniform float uTime;
uniform sampler2D uDepth;
uniform float uN;
varying vec3 vW;
float wh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float wn(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wh(i), wh(i + vec2(1, 0)), f.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), f.x), f.y); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
vec2 uv = vW.xz / uN;
float d = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 1.0 : texture2D(uDepth, uv).r;
vec3 shallow = vec3(0.32, 0.80, 0.78);
vec3 mid = vec3(0.10, 0.52, 0.70);
vec3 deep = vec3(0.04, 0.24, 0.45);
vec3 col = mix(shallow, mid, smoothstep(0.0, 0.3, d));
col = mix(col, deep, smoothstep(0.3, 1.0, d));
// Glitzern / Strömungsmuster
float n = wn(vW.xz * 1.3 + vec2(uTime * 0.25, uTime * 0.18)) * 0.6 + wn(vW.xz * 3.1 - vec2(uTime * 0.3, -uTime * 0.2)) * 0.4;
col *= 0.9 + 0.2 * n;
// Schaum an der Küste, rollt in Wellen heran
float shore = 1.0 - smoothstep(0.0, 0.16, d);
float waves = smoothstep(0.55, 1.0, sin(d * 70.0 - uTime * 2.2 + n * 3.0) * 0.5 + 0.5) * (1.0 - smoothstep(0.03, 0.2, d));
float foam = clamp(shore * smoothstep(0.35, 0.75, n + 0.25) + waves * 0.8, 0.0, 1.0);
col = mix(col, vec3(0.97, 0.99, 1.0), foam * 0.85);
diffuseColor.rgb = col;
diffuseColor.a = mix(0.55, 0.93, smoothstep(0.0, 0.45, d)) + foam * 0.3;`);
    };
    mat.customProgramCacheKey = () => 'wasser-v2';
    this.water = new THREE.Mesh(geo, mat);
    this.water.position.set(N / 2, 0, N / 2);
    this.water.renderOrder = 1;
    this.water.receiveShadow = true;
    this.scene.add(this.water);
  }

  private buildMountains() {
    const g = this.g;
    const cells: number[] = [];
    for (let i = 0; i < g.tiles.length; i++) if (g.tiles[i] === T.Berg) cells.push(i);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.mountains = new THREE.InstancedMesh(mountainGeometry(), mat, Math.max(1, cells.length * 2));
    const r = rng(g.seed + 11);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    let n = 0;
    for (const i of cells) {
      const x = i % g.size, y = (i / g.size) | 0;
      // Abstand zum Bergrand → höher in der Mitte
      let inner = 0;
      for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) if (g.tile(x + k, y + j) === T.Berg) inner++;
      const hgt = 0.8 + (inner / 25) * 2.6 + r() * 0.6;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI);
      m.compose(new THREE.Vector3(x + 0.5 + (r() - 0.5) * 0.3, LAND_Y - 0.05, y + 0.5 + (r() - 0.5) * 0.3), q, new THREE.Vector3(1.05 + r() * 0.3, hgt, 1.05 + r() * 0.3));
      this.mountains.setMatrixAt(n, m);
      c.setHex(hgt > 2.6 ? 0xd9d6cf : r() < 0.5 ? 0x8a8174 : 0x9a8f7e);
      this.mountains.setColorAt(n, c);
      n++;
    }
    this.mountains.count = n;
    this.mountains.frustumCulled = false;
    this.mountains.castShadow = true;
    this.mountains.receiveShadow = true;
    this.scene.add(this.mountains);
  }

  private buildTrees() {
    const g = this.g;
    let forest = 0;
    for (const t of g.tiles) if (t === T.Wald) forest++;
    if (!this.trees) {
      this.trees = new THREE.InstancedMesh(treeGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), forest * 3 + 10);
      this.trees.castShadow = true;
      this.trees.receiveShadow = true;
    } else if (this.trees.instanceMatrix.count < forest * 3) {
      this.scene.remove(this.trees);
      this.trees = new THREE.InstancedMesh(this.trees.geometry, this.trees.material, forest * 3 + 10);
      this.trees.castShadow = true;
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    let n = 0;
    for (let i = 0; i < g.tiles.length; i++) {
      // gleiche Zufallsfolge für jede Kachel, damit Bäume beim Roden nicht "springen"
      const rr = rng(g.seed * 31 + i);
      if (g.tiles[i] !== T.Wald) continue;
      const x = i % g.size, y = (i / g.size) | 0;
      const count = 2 + (rr() < 0.4 ? 1 : 0);
      for (let k = 0; k < count; k++) {
        const s = 0.8 + rr() * 0.6;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rr() * 6);
        m.compose(new THREE.Vector3(x + 0.2 + rr() * 0.6, LAND_Y, y + 0.2 + rr() * 0.6), q, new THREE.Vector3(s, s * (0.9 + rr() * 0.4), s));
        this.trees.setMatrixAt(n, m);
        c.setRGB(0.8 + rr() * 0.35, 0.85 + rr() * 0.25, 0.75 + rr() * 0.3);
        this.trees.setColorAt(n, c);
        n++;
      }
    }
    this.trees.count = n;
    this.trees.frustumCulled = false;
    this.trees.instanceMatrix.needsUpdate = true;
    if (this.trees.instanceColor) this.trees.instanceColor.needsUpdate = true;
    this.scene.add(this.trees);
  }

  onTreesChanged() {
    this.buildTrees();
    this.refreshTileColors();
  }

  private buildRoads() {
    const N = this.g.size;
    const geo = new THREE.BoxGeometry(1, 0.05, 1);
    if (!this.roadMesh) {
      this.roadMesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xb59a6a }), N * N);
      this.roadMesh.receiveShadow = true;
      this.previewRoads = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }), 400);
      this.previewRoads.count = 0;
      this.previewRoads.renderOrder = 2;
      // Instanzen ändern sich laufend → nicht anhand alter Grenzen ausblenden
      this.roadMesh.frustumCulled = false;
      this.previewRoads.frustumCulled = false;
    }
    this.scene.add(this.roadMesh, this.previewRoads);
    this.onRoadsChanged();
  }

  onRoadsChanged() {
    const g = this.g;
    const m = new THREE.Matrix4();
    let n = 0;
    for (let i = 0; i < g.roads.length; i++) {
      if (!g.roads[i]) continue;
      const x = i % g.size, y = (i / g.size) | 0;
      m.makeTranslation(x + 0.5, this.groundY(x, y, 1) + 0.005, y + 0.5);
      this.roadMesh.setMatrixAt(n++, m);
    }
    this.roadMesh.count = n;
    this.roadMesh.instanceMatrix.needsUpdate = true;
  }

  setRoadPreview(cells: [number, number][], ok: boolean[]) {
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    let n = 0;
    for (let k = 0; k < cells.length && n < 400; k++) {
      const [x, y] = cells[k];
      m.makeTranslation(x + 0.5, this.groundY(x, y, 1) + 0.04, y + 0.5);
      this.previewRoads.setMatrixAt(n, m);
      this.previewRoads.setColorAt(n, c.setHex(ok[k] ? 0x66ff66 : 0xff5555));
      n++;
    }
    this.previewRoads.count = n;
    this.previewRoads.instanceMatrix.needsUpdate = true;
    if (this.previewRoads.instanceColor) this.previewRoads.instanceColor.needsUpdate = true;
  }

  /** höchster Eckpunkt unter einer Grundfläche */
  groundY(x: number, y: number, s: number): number {
    const N = this.g.size;
    let h = -1;
    for (let j = 0; j <= s; j++) for (let i = 0; i <= s; i++) {
      const cx = Math.min(N, Math.max(0, x + i)), cy = Math.min(N, Math.max(0, y + j));
      h = Math.max(h, this.heights[cy * (N + 1) + cx]);
    }
    return Math.max(h, 0.05);
  }

  // ---------- Gebäude ----------

  private facing(b: Building): number {
    // Kontor & Fischer zum Wasser drehen, Häuser leicht variieren
    const g = this.g;
    const s = BUILDINGS[b.type].size;
    if (b.type === 'kontor' || b.type === 'fischer') {
      const sides = [0, 0, 0, 0]; // +z, +x, -z, -x
      for (let k = 0; k < s; k++) {
        if (g.tile(b.x + k, b.y + s) === T.Wasser) sides[0]++;
        if (g.tile(b.x + s, b.y + k) === T.Wasser) sides[1]++;
        if (g.tile(b.x + k, b.y - 1) === T.Wasser) sides[2]++;
        if (g.tile(b.x - 1, b.y + k) === T.Wasser) sides[3]++;
      }
      const best = sides.indexOf(Math.max(...sides));
      return best * (Math.PI / 2);
    }
    if (b.type === 'haus') return ((b.id * 7) % 4) * (Math.PI / 2);
    return 0;
  }

  addBuilding(b: Building) {
    const d = BUILDINGS[b.type];
    const model = buildingModel(b.type, b.tier);
    const mesh = new THREE.Mesh(model.geo, this.mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(b.x + d.size / 2, this.groundY(b.x, b.y, d.size), b.y + d.size / 2);
    mesh.rotation.y = this.facing(b);
    mesh.userData.id = b.id;
    this.scene.add(mesh);
    const spin = this.attachSpinners(mesh, model);
    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, sizeAttenuation: false }));
    icon.scale.set(0.055, 0.055, 1);
    icon.position.set(mesh.position.x, mesh.position.y + 2.6, mesh.position.z);
    icon.visible = false;
    icon.renderOrder = 10;
    this.scene.add(icon);
    this.views.set(b.id, { mesh, spin, icon, iconKey: '', tier: b.tier });
  }

  private attachSpinners(mesh: THREE.Mesh, model: ModelDef) {
    return model.spinners.map((sp) => {
      const m = new THREE.Mesh(sp.geo, this.mat);
      m.position.set(...sp.pos);
      m.castShadow = true;
      mesh.add(m);
      return { m, axis: sp.axis, speed: sp.speed };
    });
  }

  removeBuilding(b: Building) {
    const v = this.views.get(b.id);
    if (!v) return;
    this.scene.remove(v.mesh, v.icon);
    this.views.delete(b.id);
  }

  changedBuilding(b: Building) {
    const v = this.views.get(b.id);
    if (!v) return;
    if (v.tier !== b.tier) {
      const model = buildingModel(b.type, b.tier);
      v.mesh.geometry = model.geo;
      for (const sp of v.spin) v.mesh.remove(sp.m);
      v.spin = this.attachSpinners(v.mesh, model);
      v.tier = b.tier;
    }
  }

  private iconTexture(key: string): THREE.Texture {
    let t = this.iconTex.get(key);
    if (t) return t;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(32, 32, 29, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#d33'; ctx.stroke();
    ctx.font = '34px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(key, 32, 35);
    t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    this.iconTex.set(key, t);
    return t;
  }

  /** Warnsymbole über Gebäuden aktualisieren (selten aufrufen) */
  refreshIcons() {
    for (const b of this.g.buildings) {
      const v = this.views.get(b.id);
      if (!v) continue;
      let key = '';
      switch (b.status) {
        case 'keinWeg': key = '🚧'; break;
        case 'rohstoff': key = b.missing[0] ? GOOD[b.missing[0]].icon : '📦'; break;
        case 'lagerVoll': key = '📦'; break;
        case 'keinWald': key = '🌲'; break;
        case 'keinWasser': key = '🌊'; break;
        case 'wohnen': key = b.happy < 0.45 ? '😠' : ''; break;
      }
      if (key !== v.iconKey) {
        v.iconKey = key;
        v.icon.visible = !!key;
        if (key) { (v.icon.material as THREE.SpriteMaterial).map = this.iconTexture(key); (v.icon.material as THREE.SpriteMaterial).needsUpdate = true; }
      }
    }
  }

  // ---------- Vorschau / Auswahl ----------

  setGhost(type: BuildingId | null, x = 0, y = 0, ok = true) {
    if (!type) {
      if (this.ghost) this.scene.remove(this.ghost);
      this.ghost = null;
      this.ghostType = null;
      this.footprint.visible = false;
      this.radiusRing.visible = false;
      return;
    }
    const d = BUILDINGS[type];
    if (this.ghostType !== type) {
      if (this.ghost) this.scene.remove(this.ghost);
      this.ghost = new THREE.Mesh(buildingModel(type, 0).geo, this.ghostMatOk);
      this.ghost.renderOrder = 4;
      this.scene.add(this.ghost);
      this.ghostType = type;
    }
    const gy = this.groundY(x, y, d.size);
    this.ghost!.material = ok ? this.ghostMatOk : this.ghostMatBad;
    this.ghost!.position.set(x + d.size / 2, gy + 0.02, y + d.size / 2);
    this.footprint.visible = true;
    this.footprint.scale.set(d.size, 1, d.size);
    this.footprint.position.set(x + d.size / 2, gy + 0.03, y + d.size / 2);
    (this.footprint.material as THREE.MeshBasicMaterial).color.setHex(ok ? 0x55ff55 : 0xff4444);
    this.showRadius(d.radius ?? 0, x + d.size / 2, y + d.size / 2);
  }

  showRadius(r: number, x = 0, z = 0) {
    if (!r) { this.radiusRing.visible = false; return; }
    this.radiusRing.visible = true;
    this.radiusRing.scale.set(r, 1, r);
    this.radiusRing.position.set(x, LAND_Y + 0.06, z);
  }

  setSelected(b: Building | null) {
    if (!b) { this.selectRing.visible = false; this.showRadius(0); return; }
    const d = BUILDINGS[b.type];
    this.selectRing.visible = true;
    const r = d.size * 0.75;
    this.selectRing.scale.set(r, 1, r);
    this.selectRing.position.set(b.x + d.size / 2, this.groundY(b.x, b.y, d.size) + 0.06, b.y + d.size / 2);
    this.showRadius(d.radius ?? 0, b.x + d.size / 2, b.y + d.size / 2);
  }

  // ---------- Kamera & Picking ----------

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  updateCamera() {
    const r = this.rig;
    const N = this.g.size;
    r.tx = Math.min(N - 4, Math.max(4, r.tx));
    r.tz = Math.min(N - 4, Math.max(4, r.tz));
    r.dist = Math.min(70, Math.max(7, r.dist));
    // Je näher, desto flacher der Blick
    r.pitch = 0.62 + (r.dist - 7) / 63 * 0.5;
    const cp = Math.cos(r.pitch), sp = Math.sin(r.pitch);
    this.camera.position.set(
      r.tx + Math.sin(r.yaw) * cp * r.dist,
      LAND_Y + sp * r.dist,
      r.tz + Math.cos(r.yaw) * cp * r.dist,
    );
    this.camera.lookAt(r.tx, LAND_Y, r.tz);
    // Sonne folgt der Kamera, damit Schatten immer scharf sind
    this.sun.position.set(r.tx - 18, 40, r.tz - 10);
    this.sun.target.position.set(r.tx, 0, r.tz);
    const span = Math.min(45, 12 + r.dist * 0.9);
    const sc = this.sun.shadow.camera;
    if (Math.abs(sc.right - span) > 1) {
      sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span;
      sc.updateProjectionMatrix();
    }
  }

  /** Bildschirmposition → Kachel */
  pick(clientX: number, clientY: number, withBuildings = true): [number, number] | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    // Erst Gebäude treffen (hohe Häuser), dann Boden
    const meshes = Array.from(this.views.values(), (v) => v.mesh);
    const hit = withBuildings ? this.raycaster.intersectObjects(meshes, false)[0] : undefined;
    if (hit) {
      const b = this.g.byId.get(hit.object.userData.id);
      if (b) return [b.x, b.y];
    }
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, p)) return null;
    const x = Math.floor(p.x), y = Math.floor(p.z);
    return this.g.inMap(x, y) ? [x, y] : null;
  }

  /** Bodenpunkt (für Kamerasteuerung) */
  groundPoint(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, p) ? p : null;
  }

  frame(t: number, gameDt: number) {
    this.waterUniforms.uTime.value = t;
    for (const v of this.views.values()) for (const sp of v.spin) sp.m.rotation[sp.axis] -= gameDt * sp.speed;
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  }
}
