// 3D-Darstellung mit three.js: Insel, Wasser, Bäume, Berge, Wege, Gebäude.
import * as THREE from 'three';
import { BUILDINGS, BuildingId, GOOD } from '../data';
import { Building, Game } from '../game';
import { T } from '../world';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { buildingModel } from './models';
import { LAND_Y, Terrain } from './terrain';
import { Vegetation, windTime } from './vegetation';
import { ModelLibrary } from './glb';
import { ShipLayer } from './ships';
import { CartLayer } from './carts';
import { buildingMaterial } from './materials';
import { ModelDef } from './kit';


interface BView { mesh: THREE.Object3D; spin: { m: THREE.Mesh; axis: 'x' | 'z'; speed: number }[]; icon: THREE.Sprite; iconKey: string; tier: number }

export class View {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.5, 900);
  rig = { tx: 32, tz: 32, dist: 30, yaw: Math.PI * 0.25, pitch: 0.95 };

  private g: Game;
  private terrain!: Terrain;
  ships!: ShipLayer;
  private carts!: CartLayer;
  private seenTex!: THREE.DataTexture;
  private seenCount: number[] = [];
  private border: THREE.LineSegments | null = null;
  private veg!: Vegetation;
  private water!: THREE.Mesh;
  private waterUniforms: Record<string, THREE.IUniform> = { uTime: { value: 0 } };
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
    this.renderer.toneMappingExposure = 0.82;
    this.scene.fog = new THREE.Fog(0xc9dbe6, 90, 260);
    const sun = new THREE.DirectionalLight(0xffe9cf, 2.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 140;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun, sun.target);
    this.sun = sun;
    this.setupSky();
    // Meshy-Modelle laden; sobald da, alle Gebäude neu darstellen
    this.lib.onLoaded = () => { for (const b of this.g.buildings) { this.removeBuilding(b); this.addBuilding(b); } };
    void this.lib.load();

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

  /** Physikalischer Himmel: färbt Hintergrund und beleuchtet die Szene (Spiegelungen, Umgebungslicht) */
  private sunDir = new THREE.Vector3();
  private setupSky() {
    const sky = new Sky();
    sky.scale.setScalar(800);
    const u = sky.material.uniforms;
    u.turbidity.value = 3.5;
    u.rayleigh.value = 1.2;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.82;
    const elevation = 38, azimuth = 215;
    this.sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elevation), THREE.MathUtils.degToRad(azimuth));
    u.sunPosition.value.copy(this.sunDir);
    const pm = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.add(sky.clone());
    this.scene.environment = pm.fromScene(envScene, 0.02).texture;
    this.scene.environmentIntensity = 0.6;
    pm.dispose();
    this.sky = sky;
    this.scene.add(sky);
  }
  private sky!: Sky;
  lib = new ModelLibrary();

  /** Alles (neu) aufbauen – z. B. nach "Neues Spiel" */
  setGame(g: Game) {
    this.g = g;
    for (const v of this.views.values()) { this.scene.remove(v.mesh, v.icon); }
    this.views.clear();
    if (this.terrain) { this.scene.remove(this.terrain.group); this.terrain.dispose(); }
    if (this.water) { this.scene.remove(this.water); this.water.geometry.dispose(); }
    this.ships?.setGame(g);
    if (this.veg) { this.scene.remove(this.veg.group); this.veg.dispose(); }
    this.buildWorld();
  }

  private buildWorld() {
    const g = this.g;
    const k = g.kontor();
    const ship = g.myShips()[0];
    if (k) { const [cx, cy] = g.center(k); this.rig.tx = cx; this.rig.tz = cy + 3; }
    else if (ship) { this.rig.tx = ship.x + 4; this.rig.tz = ship.y - 4; this.rig.dist = 34; }
    this.terrain = new Terrain(g);
    this.scene.add(this.terrain.group);
    if (!this.ships) { this.ships = new ShipLayer(g); this.scene.add(this.ships.group); }
    const h = (x: number, z: number) => this.terrain.heightAt(x, z);
    if (!this.carts) { this.carts = new CartLayer(g, h); this.scene.add(this.carts.group); } else this.carts.setGame(g, h);
    this.seenCount = g.islands.map(() => -1);
    this.areaShown = false;
    this.buildWater();
    this.veg = new Vegetation(g, this.terrain);
    this.scene.add(this.veg.group);
    this.onSeen();
    this.onTerritory();
    this.buildRoads();
    for (const b of g.buildings) this.addBuilding(b);
  }

  // ---------- Gelände ----------

  /** Bereiche außerhalb des Baugebiets abdunkeln (beim Bauen) */
  showArea(on: boolean) {
    this.terrain.showArea(on);
    this.areaShown = on;
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
      const v = Math.round(Math.min(1, dist[i] / 9) * 255);
      data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
    }
    const depthTex = new THREE.DataTexture(data, N, N);
    depthTex.magFilter = THREE.LinearFilter;
    depthTex.minFilter = THREE.LinearFilter;
    depthTex.needsUpdate = true;

    const geo = new THREE.PlaneGeometry(N * 5, N * 5, 160, 160).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, transparent: true, roughness: 0.09, metalness: 0.0, envMapIntensity: 0.75,
    });
    const uni = this.waterUniforms as Record<string, THREE.IUniform>;
    uni.uDepth = { value: depthTex };
    this.seenTex = new THREE.DataTexture(new Uint8Array(N * N * 4), N, N);
    this.seenTex.magFilter = THREE.LinearFilter;
    this.seenTex.minFilter = THREE.LinearFilter;
    uni.uSeen = { value: this.seenTex };
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
  objectNormal = normalize(vec3(-dx * 1.4, 1.0, -dz * 1.4));
}`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
uniform float uTime;
uniform sampler2D uDepth;
uniform sampler2D uSeen;
uniform float uN;
varying vec3 vW;
float wh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float wn(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wh(i), wh(i + vec2(1, 0)), f.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), f.x), f.y); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
vec2 uv = vW.xz / uN;
vec2 uvc = clamp(uv, 0.0, 1.0);
float d = max(texture2D(uDepth, uvc).r, smoothstep(0.0, 0.2, length(uv - uvc)));
vec3 shallow = vec3(0.10, 0.48, 0.46);
vec3 mid = vec3(0.03, 0.26, 0.38);
vec3 deep = vec3(0.012, 0.09, 0.20);
vec3 col = mix(shallow, mid, smoothstep(0.0, 0.25, d));
col = mix(col, deep, smoothstep(0.3, 1.0, d));
// Glitzern / Strömungsmuster
float n = wn(vW.xz * 1.3 + vec2(uTime * 0.25, uTime * 0.18)) * 0.6 + wn(vW.xz * 3.1 - vec2(uTime * 0.3, -uTime * 0.2)) * 0.4;
col *= 0.9 + 0.2 * n;
// Schaum an der Küste, rollt in Wellen heran
float shore = 1.0 - smoothstep(0.0, 0.1, d);
float waves = smoothstep(0.55, 1.0, sin(d * 70.0 - uTime * 2.2 + n * 3.0) * 0.5 + 0.5) * (1.0 - smoothstep(0.02, 0.13, d));
float foam = clamp(shore * smoothstep(0.35, 0.75, n + 0.25) + waves * 0.8, 0.0, 1.0);
col = mix(col, vec3(0.85, 0.9, 0.9), foam * 0.6);
diffuseColor.rgb = col;
diffuseColor.a = mix(0.62, 0.97, smoothstep(0.0, 0.35, d)) + foam * 0.3;
// Nebel über Unentdecktem
float seenV = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 0.0 : texture2D(uSeen, uvc).r;
float cl = wn(vW.xz * 0.12 + uTime * 0.02) * 0.6 + wn(vW.xz * 0.45 - uTime * 0.03) * 0.4;
vec3 mist = mix(vec3(0.36, 0.42, 0.50), vec3(0.62, 0.67, 0.73), cl);
diffuseColor.rgb = mix(mist, diffuseColor.rgb, smoothstep(0.0, 1.0, seenV));
diffuseColor.a = mix(1.0, diffuseColor.a, smoothstep(0.0, 1.0, seenV));`);
    };
    mat.customProgramCacheKey = () => 'wasser-v2';
    this.water = new THREE.Mesh(geo, mat);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(N * 5, N * 5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0a2a3c }));
    floor.position.set(0, -2.4, 0);
    this.water.add(floor);
    this.water.position.set(N / 2, 0, N / 2);
    this.water.renderOrder = 1;
    this.water.receiveShadow = true;
    this.scene.add(this.water);
  }

  /** Grenze des eigenen Gebiets als Linie in Spielerfarbe */
  onTerritory() {
    const g = this.g, N = g.size;
    if (this.border) { this.scene.remove(this.border); this.border.geometry.dispose(); }
    const pts: number[] = [];
    const y = (x: number, z: number) => Math.max(this.terrain.heightAt(x, z), 0.05) + 0.07;
    const mine = (x: number, z: number) => x >= 0 && z >= 0 && x < N && z < N && g.own[z * N + x] === 0;
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      if (!mine(x, z) || g.tiles[z * N + x] === 0) continue;
      if (!mine(x, z - 1)) pts.push(x, y(x, z), z, x + 1, y(x + 1, z), z);
      if (!mine(x, z + 1)) pts.push(x, y(x, z + 1), z + 1, x + 1, y(x + 1, z + 1), z + 1);
      if (!mine(x - 1, z)) pts.push(x, y(x, z), z, x, y(x, z + 1), z + 1);
      if (!mine(x + 1, z)) pts.push(x + 1, y(x + 1, z), z, x + 1, y(x + 1, z + 1), z + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.border = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x8fc0ff, transparent: true, opacity: 0.85, depthWrite: false }));
    this.border.renderOrder = 3;
    this.scene.add(this.border);
  }

  /** Neu entdeckte Gebiete: Nebel lichten, Pflanzen zeigen */
  onSeen() {
    const g = this.g, N = g.size;
    const data = this.seenTex.image.data as Uint8Array;
    for (let i = 0; i < N * N; i++) { const v = g.seen[i] ? 255 : 0; data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255; }
    this.seenTex.needsUpdate = true;
    this.terrain.updateFog();
    const changed: number[] = [];
    g.islands.forEach((isl, id) => {
      let n = 0;
      for (let y = isl.y0; y <= isl.y1; y++) for (let x = isl.x0; x <= isl.x1; x++) if (g.seen[y * N + x]) n++;
      if (n !== this.seenCount[id]) { this.seenCount[id] = n; changed.push(id); }
    });
    if (changed.length) this.veg.refresh(changed);
  }

  onTreesChanged() {
    this.terrain.updateSplat();
    this.veg.refresh();
  }

  private buildRoads() {
    const N = this.g.size;
    const geo = new THREE.BoxGeometry(1, 0.05, 1);
    if (!this.roadMesh) {
      this.roadMesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x8a7151, roughness: 1 }), N * N);
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
    this.veg?.refresh();
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

  /** Bodenhöhe unter einer Grundfläche */
  groundY(x: number, y: number, s: number): number {
    return this.terrain.groundY(x, y, s);
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
    const glb = this.lib.building(b.type, b.tier);
    const mesh: THREE.Object3D = glb ?? new THREE.Mesh(model.geo, this.mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(b.x + d.size / 2, this.groundY(b.x, b.y, d.size), b.y + d.size / 2);
    mesh.rotation.y = this.facing(b);
    mesh.userData.id = b.id;
    this.scene.add(mesh);
    const spin = glb ? [] : this.attachSpinners(mesh, model);
    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, sizeAttenuation: false }));
    icon.scale.set(0.055, 0.055, 1);
    icon.position.set(mesh.position.x, mesh.position.y + 2.6, mesh.position.z);
    icon.visible = false;
    icon.renderOrder = 10;
    this.scene.add(icon);
    this.views.set(b.id, { mesh, spin, icon, iconKey: '', tier: b.tier });
  }

  private attachSpinners(mesh: THREE.Object3D, model: ModelDef) {
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
      // neue Ausbaustufe → Modell austauschen
      this.removeBuilding(b);
      this.addBuilding(b);
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
    this.showRadius(d.work ?? d.radius ?? 0, x + d.size / 2, y + d.size / 2, d.work && d.prod ? 0xffb347 : 0xffffff);
  }

  showRadius(r: number, x = 0, z = 0, color = 0xffffff) {
    if (!r) { this.radiusRing.visible = false; return; }
    this.radiusRing.visible = true;
    (this.radiusRing.material as THREE.MeshBasicMaterial).color.setHex(color);
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
    this.showRadius(d.work ?? d.radius ?? 0, b.x + d.size / 2, b.y + d.size / 2, d.work && d.prod ? 0xffb347 : 0xffffff);
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
    r.tx = Math.min(N - 2, Math.max(2, r.tx));
    r.tz = Math.min(N - 2, Math.max(2, r.tz));
    r.dist = Math.min(110, Math.max(7, r.dist));
    // Je näher, desto flacher der Blick
    r.pitch = Math.min(1.3, 0.62 + (r.dist - 7) / 63 * 0.5);
    const cp = Math.cos(r.pitch), sp = Math.sin(r.pitch);
    this.camera.position.set(
      r.tx + Math.sin(r.yaw) * cp * r.dist,
      LAND_Y + sp * r.dist,
      r.tz + Math.cos(r.yaw) * cp * r.dist,
    );
    this.camera.lookAt(r.tx, LAND_Y, r.tz);
    // Sonne folgt der Kamera, damit Schatten immer scharf sind
    this.sun.position.set(r.tx + this.sunDir.x * 60, this.sunDir.y * 60, r.tz + this.sunDir.z * 60);
    this.sky.position.set(r.tx, 0, r.tz);
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
    const hit = withBuildings ? this.raycaster.intersectObjects(meshes, true)[0] : undefined;
    if (hit) {
      let o: THREE.Object3D | null = hit.object;
      while (o && o.userData.id === undefined) o = o.parent;
      const b = o ? this.g.byId.get(o.userData.id) : undefined;
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

  /** Schiff unter dem Finger */
  pickShip(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.ships.pick(this.raycaster);
  }

  frame(t: number, gameDt: number) {
    this.ships.update(t);
    this.carts.update(t);
    this.waterUniforms.uTime.value = t;
    windTime.value = t;
    for (const v of this.views.values()) for (const sp of v.spin) sp.m.rotation[sp.axis] -= gameDt * sp.speed;
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  }
}
