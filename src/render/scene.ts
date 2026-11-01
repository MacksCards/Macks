// 3D-Darstellung mit three.js: Insel, Wasser, Bäume, Berge, Wege, Gebäude.
import * as THREE from 'three';
import { BUILDINGS, BuildingId, GOOD, UNITS } from '../data';
import { Building, Game, Unit } from '../game';
import { T } from '../world';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { WALLS, WALL_LINKS, buildingModel } from './models';
import { UnitLayer } from './units';
import { Fx } from './fx';
import { LAND_Y, Terrain, TileRect } from './terrain';
import { Vegetation, windTime } from './vegetation';
import { ModelLibrary } from './glb';
import { ShipLayer } from './ships';
import { CartLayer } from './carts';
import { LifeLayer } from './life';
import { buildingMaterial } from './materials';
import { Builder, ModelDef } from './kit';
import { Level, Quality, QualityMode } from './quality';
import { ensureCapacity } from './instances';
import { Cloth, MarkDef, OwnerMarks, Pole, POLE_H, POLE_H_SMALL } from './marks';


interface BView {
  mesh: THREE.Object3D; spin: { m: THREE.Mesh; axis: 'x' | 'z'; speed: number }[]; icon: THREE.Sprite; iconKey: string; tier: number;
  owner: number; mask: number; top: number;
  /** gezeigtes Meshy-Modell („gebäude:stufe“) oder null, dann die Form des Code-Modells (geo) */
  glbKey: string | null; geo: THREE.BufferGeometry | null;
}

/** Größen des Schattenausschnitts (halbe Breite in Feldern); dazwischen wird nicht stufenlos gewechselt */
const SHADOW_SPANS = [20, 26, 32, 38, 45];

/** läuft die Grafik nur in Software (z. B. automatische Tests)? Dann passt sich die Qualität nicht an. */
function softwareRenderer(r: THREE.WebGLRenderer): boolean {
  try {
    const gl = r.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
    return /swiftshader|llvmpipe|software/i.test(name);
  } catch {
    return false;
  }
}

/**
 * Mühlenflügel für das Meshy-Modell (dessen feste Flügel wurden aus der Datei entfernt):
 * vier Ruten mit Gitterrahmen und Segeltuch, Länge 1 (wird auf die Flügellänge skaliert).
 * Dreht sich um die z-Achse; Vorderseite = +z.
 */
const MILL_BLADES = (() => {
  const b = new Builder();
  const wood = { c: 0x5a4332, p: 0 }, cloth = { c: 0xd8ccb0, p: 0 };
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4; // als X stehend, wie das Original-Modell
    const dx = Math.sin(a), dy = Math.cos(a), px = Math.cos(a), py = -Math.sin(a);
    const at = (r: number, off: number): [number, number] => [dx * r + px * off, dy * r + py * off];
    // Rute (Hauptbalken) von der Nabe bis zur Spitze
    b.add(new THREE.BoxGeometry(0.045, 1.0, 0.035), wood, ...at(0.5, 0), 0.03, 0, 0, -a);
    // Gitterrahmen: zwei Längsleisten und Querstreben
    for (const off of [0.04, 0.25]) b.add(new THREE.BoxGeometry(0.016, 0.8, 0.018), wood, ...at(0.6, off), 0.035, 0, 0, -a);
    for (let k = 0; k <= 10; k++) b.add(new THREE.BoxGeometry(0.24, 0.012, 0.014), wood, ...at(0.2 + k * 0.08, 0.145), 0.04, 0, 0, -a);
    // Segeltuch hinter dem Gitter
    b.add(new THREE.BoxGeometry(0.2, 0.76, 0.004), cloth, ...at(0.6, 0.145), 0.02, 0, 0, -a);
  }
  b.add(new THREE.CylinderGeometry(0.05, 0.065, 0.12, 8), wood, 0, 0, 0.0, 0, Math.PI / 2);
  return b.geometry();
})();
/** Meshy-Gebäude, die eine große Fahne in Besitzerfarbe tragen (wie die Code-Modelle) */
const BIG_FLAG = new Set<BuildingId>(['kontor', 'markt', 'werft', 'grosswerft', 'burg', 'grosseburg', 'festung', 'holzturm', 'wachturm', 'triumphbogen']);

export class View {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.5, 900);
  rig = { tx: 32, tz: 32, dist: 30, yaw: Math.PI * 0.25, pitch: 0.95 };

  private g: Game;
  private terrain!: Terrain;
  ships!: ShipLayer;
  /** Soldaten */
  units!: UnitLayer;
  /** Kampf-Effekte und Lebensbalken */
  fx!: Fx;
  /** alle Fahnen, Wimpel und Fahnenmasten in Besitzerfarbe (wenige Zeichenaufrufe für alle Gebäude) */
  private marks!: OwnerMarks;
  private carts!: CartLayer;
  private life!: LifeLayer;
  private seenTex!: THREE.DataTexture;
  /** true, bis das Nebel-Datenbild einmal ganz hochgeladen ist (vorher keine Teil-Uploads) */
  private seenTexFresh = true;
  private border: THREE.Mesh | null = null;
  private roadCol = new THREE.Color();
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
  /** Bildqualität (automatisch, hoch, sparsam) */
  quality: Quality;
  /** true, solange die Grafik-Programme vorbereitet werden (dann wird nicht gezeichnet) */
  preparing = false;
  private prepToken = 0;
  private prepHint: HTMLDivElement | null = null;
  /** etwas hat sich geändert, das im Bild sichtbar ist (für das gedrosselte Zeichnen in der Pause) */
  private dirty = true;
  private drawn = { tx: NaN, tz: NaN, dist: NaN, yaw: NaN, w: 0, h: 0, ship: null as number | null, units: -1 };
  private borderMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
  /** bleibt immer bestehen, damit das Programm für Warnsymbole nicht wieder freigegeben wird */
  private warmSprite = new THREE.SpriteMaterial({ transparent: true, depthTest: false, sizeAttenuation: false });
  private cam = { x: 0, z: 0, dist: 0 };

  constructor(canvas: HTMLCanvasElement, g: Game) {
    this.g = g;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.quality = new Quality((l) => this.applyLevel(l));
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
    // reine Software-Grafik (Testumgebung ohne Grafikchip): Messen sinnlos, immer die schöne Stufe zeigen
    if (softwareRenderer(this.renderer)) this.quality.setMode('hoch');
    this.setupSky();
    // Meshy-Modelle: beim Start nur die Liste lesen
    // (jedes Modell kommt erst, wenn ein Gebäude/Schiff es braucht; dann nur die Betroffenen neu darstellen)
    this.lib.onLoaded = (what) => {
      if (!this.terrain) return;
      // nur Gebäude neu aufbauen, deren gezeigtes Modell sich wirklich ändert
      // (shownKey stößt beim ersten Mal auch das Laden an: Liste da → gebrauchte Modelle holen)
      for (const b of this.g.buildings) {
        if (!what.buildings.has(b.type)) continue;
        const v = this.views.get(b.id);
        if (v && this.lib.shownKey(b.type, b.tier) !== v.glbKey) { this.removeBuilding(b, false); this.addBuilding(b, false); }
      }
      if (what.others.size) this.ships?.resetViews();
    };
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

    this.marks = new OwnerMarks(this.mat);
    this.scene.add(this.marks.group);

    this.buildWorld();
  }

  /** Physikalischer Himmel: färbt Hintergrund und beleuchtet die Szene (Spiegelungen, Umgebungslicht) */
  private sunDir = new THREE.Vector3();
  /** Achsen der Schattenkarte (quer und hoch zur Lichtrichtung) */
  private sunRight = new THREE.Vector3();
  private sunUp = new THREE.Vector3();
  private setupSky() {
    const sky = new Sky();
    sky.scale.setScalar(800);
    const u = sky.material.uniforms;
    u.turbidity.value = 3.5;
    u.rayleigh.value = 1.2;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.72;
    const elevation = 56, azimuth = 215;
    this.sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elevation), THREE.MathUtils.degToRad(azimuth));
    // so richtet three.js die Schattenkamera aus (lookAt mit "oben" = y)
    this.sunRight.crossVectors(new THREE.Vector3(0, 1, 0), this.sunDir).normalize();
    this.sunUp.crossVectors(this.sunDir, this.sunRight).normalize();
    u.sunPosition.value.copy(this.sunDir);
    const pm = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.add(sky.clone());
    this.scene.environment = pm.fromScene(envScene, 0.02).texture;
    this.scene.environmentIntensity = 0.6;
    pm.dispose();
    // Himmel erst nach dem Wasser zeichnen: dann rechnet er nur dort, wo kein Wasser ist
    // (er liegt ganz hinten; die Tiefenprüfung verwirft verdeckte Punkte)
    sky.material.transparent = true;
    sky.renderOrder = 1.5;
    this.sky = sky;
    this.scene.add(sky);
  }
  private sky!: Sky;
  lib = new ModelLibrary();

  /** Alles (neu) aufbauen – z. B. nach "Neues Spiel" */
  setGame(g: Game) {
    this.g = g;
    for (const v of this.views.values()) { this.scene.remove(v.mesh, v.icon); v.icon.material.dispose(); }
    this.views.clear();
    this.marks.clear();
    // Meshy-Modelle, die das neue Spiel (noch) nicht braucht, aus dem Grafikspeicher nehmen;
    // sie werden bei Bedarf neu geladen. Gebraucht = Gebäudearten im neuen Spiel (geladener Spielstand).
    this.lib.release(new Set(g.buildings.map((b) => b.type)));
    if (this.terrain) { this.scene.remove(this.terrain.group); this.terrain.dispose(); }
    if (this.water) this.disposeWater();
    if (this.border) { this.scene.remove(this.border); this.border.geometry.dispose(); this.border = null; }
    for (const f of this.falling) this.scene.remove(f.mesh);
    this.falling = [];
    this.setGhost(null);
    this.setSelected(null);
    this.ships?.setGame(g);
    if (this.veg) { this.scene.remove(this.veg.group); this.veg.dispose(); }
    // Zeichenlisten des alten Spiels loslassen (sonst bleiben alte Objekte im Speicher)
    this.renderer.renderLists.dispose();
    this.buildWorld();
  }

  /** Wasser samt Boden, Material und beiden Datenbildern freigeben */
  private disposeWater() {
    const w = this.water;
    this.scene.remove(w);
    w.geometry.dispose();
    (w.material as THREE.Material).dispose();
    for (const c of w.children) { const m = c as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose(); }
    (this.waterUniforms.uDepth?.value as THREE.Texture | undefined)?.dispose();
    this.seenTex?.dispose();
  }

  private buildWorld() {
    const g = this.g;
    const k = g.kontor();
    const ship = g.myShips()[0];
    if (k) { const [cx, cy] = g.center(k); this.rig.tx = cx; this.rig.tz = cy + 3; }
    else if (ship) { this.rig.tx = ship.x + 4; this.rig.tz = ship.y - 4; this.rig.dist = 34; }
    this.terrain = new Terrain(g);
    this.scene.add(this.terrain.group);
    if (!this.ships) { this.ships = new ShipLayer(g); this.scene.add(this.ships.group); this.ships.models = (id) => this.lib.other(id); }
    const h = (x: number, z: number) => this.terrain.heightAt(x, z);
    if (!this.carts) { this.carts = new CartLayer(g, h); this.scene.add(this.carts.group); } else this.carts.setGame(g, h);
    if (!this.life) { this.life = new LifeLayer(g, h); this.scene.add(this.life.group); } else this.life.setGame(g, h);
    if (!this.units) { this.units = new UnitLayer(g, h); this.scene.add(this.units.group); } else this.units.setGame(g, h);
    if (!this.fx) { this.fx = new Fx(g, h); this.scene.add(this.fx.group); } else this.fx.setGame(g, h);
    this.ships.fx = this.fx;
    this.areaShown = false;
    this.buildWater();
    this.veg = new Vegetation(g, this.terrain);
    this.veg.setDetail(this.quality.mode === 'sparsam');
    this.scene.add(this.veg.group);
    // Ausgangsstand merken: spätere Änderungen werden damit verglichen (nur Geändertes wird neu gebaut)
    this.takeSnapshot();
    this.pend = 0;
    this.writeSeen(null);
    this.onTerritory();
    this.buildRoads();
    for (const b of g.buildings) this.addBuilding(b);
    this.dirty = true;
    void this.prewarm();
  }

  // ---------- Leistung: Vorwärmen, Qualität, gedrosseltes Zeichnen ----------

  /**
   * Alle Grafik-Programme (Rechenvorschriften der Grafikkarte) vorab übersetzen, auch die erst später
   * gebrauchten (Bau-Vorschau, Ringe, Wegvorschau, Warnsymbol, fallende Bäume, Untergang, Teilchen).
   * Sonst ruckelt es beim ersten Gebrauch. Solange wird nicht gezeichnet und ein Hinweis gezeigt.
   */
  private async prewarm() {
    const token = ++this.prepToken;
    this.preparing = true;
    this.showPrepHint(true);
    const grp = new THREE.Group();
    const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const mats: THREE.Material[] = [this.ghostMatOk, this.ghostMatBad, this.mat, this.veg.material, ...this.ships.warmMaterials()];
    for (const m of mats) {
      const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
      // fallende Bäume werfen Schatten mit dem Baum-Schattenmaterial
      if (m === this.veg.material) mesh.customDepthMaterial = this.veg.depthMaterial;
      grp.add(mesh);
    }
    // Schatten von Instanz-Gruppen mit dem gewöhnlichen Schattenmaterial (Soldaten, Tiere …): Bäume haben ein eigenes
    for (const colored of [false, true]) {
      const inst = new THREE.InstancedMesh(geo, this.mat, 1);
      if (colored) inst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array([1, 1, 1]), 3);
      inst.castShadow = true; inst.frustumCulled = false;
      grp.add(inst);
    }
    grp.add(...this.marks.warm());
    this.warmSprite.map = this.iconTexture('🚧');
    const spr = new THREE.Sprite(this.warmSprite);
    spr.frustumCulled = false;
    spr.scale.set(1e-4, 1e-4, 1); // Warnsymbole werden über allem gezeichnet: hier winzig klein
    grp.add(spr);
    // unter dem Meeresboden: wird gezeichnet (und damit vorbereitet), ist aber nie zu sehen
    grp.position.set(this.rig.tx, -6, this.rig.tz);
    this.scene.add(grp);
    // (unsichtbare Dinge wie Bau-Vorschau, Ringe und Wegvorschau nimmt compileAsync von selbst mit)
    // Pflanzen: je nach Entfernung ausgeblendet – je eine Baum- und Grasgruppe vorübergehend zeigen
    this.veg.warm();
    try {
      this.updateCamera();
      await this.compileAll(token);
      // einmal wirklich zeichnen: bereitet auch die Schatten-Programme vor
      if (token === this.prepToken) this.renderer.render(this.scene, this.camera);
    } catch (e) {
      console.warn('Vorbereiten der Grafik', e);
    } finally {
      this.scene.remove(grp);
      geo.dispose();
      for (const c of grp.children) if (c instanceof THREE.InstancedMesh) c.dispose();
      if (token === this.prepToken) { this.preparing = false; this.showPrepHint(false); this.dirty = true; }
    }
  }

  /**
   * Wie renderer.compileAsync, aber robust: Materialien, die währenddessen freigegeben werden
   * (z. B. schnell hintereinander „Neues Spiel“), werden übersprungen; spätestens nach 12 s geht es weiter.
   */
  private compileAll(token: number): Promise<void> {
    const r = this.renderer;
    const mats = [...r.compile(this.scene, this.camera)];
    const t0 = performance.now();
    return new Promise((resolve) => {
      const check = () => {
        if (token !== this.prepToken || performance.now() - t0 > 12000) { resolve(); return; }
        let waiting = false;
        for (const m of mats) {
          const prog = (r.properties.get(m) as { currentProgram?: { isReady?: () => boolean } }).currentProgram;
          if (prog?.isReady && !prog.isReady()) { waiting = true; break; }
        }
        if (waiting) setTimeout(check, 16); else resolve();
      };
      setTimeout(check, 0);
    });
  }

  private showPrepHint(on: boolean) {
    if (typeof document === 'undefined') return;
    if (on && !this.prepHint) {
      const el = document.createElement('div');
      el.textContent = 'Insel wird vorbereitet …';
      Object.assign(el.style, {
        position: 'fixed', left: '50%', bottom: 'max(18px, env(safe-area-inset-bottom))', transform: 'translateX(-50%)',
        zIndex: '60', pointerEvents: 'none', padding: '7px 14px', borderRadius: '16px', color: '#f6ecd6',
        background: 'rgba(30,24,16,0.78)', font: '15px/1.2 "Alegreya Sans", system-ui, sans-serif', letterSpacing: '0.02em',
      } as Partial<CSSStyleDeclaration>);
      document.body.appendChild(el);
      this.prepHint = el;
    } else if (!on && this.prepHint) { this.prepHint.remove(); this.prepHint = null; }
  }

  /** Qualität wählen: 'auto' (passt sich an), 'hoch' (immer schönste Stufe) oder 'sparsam' (30 Bilder/s, schont den Akku) */
  setQuality(mode: QualityMode) { this.quality.setMode(mode); this.veg?.setDetail(mode === 'sparsam'); this.dirty = true; }

  /** Stufe anwenden: Pixelverhältnis und Schattenkarte */
  private applyLevel(l: Level) {
    if (Math.abs(this.renderer.getPixelRatio() - l.pr) > 0.001) this.renderer.setPixelRatio(l.pr);
    const sun = this.sun;
    const shadowOn = l.shadow > 0;
    if (shadowOn && sun.shadow.mapSize.x !== l.shadow) {
      sun.shadow.mapSize.set(l.shadow, l.shadow);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    if (shadowOn !== this.renderer.shadowMap.enabled) {
      // Schatten an/aus ändert alle Grafik-Programme: kurz neu vorbereiten statt zu ruckeln
      this.renderer.shadowMap.enabled = shadowOn;
      sun.castShadow = shadowOn;
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      if (this.terrain) void this.prewarm();
    }
    this.dirty = true;
  }

  /** Bild zeichnen nötig? (Kamera bewegt, Fenstergröße, Auswahl oder sonst etwas Sichtbares geändert) */
  needsRedraw(): boolean {
    if (this.dirty) return true;
    const r = this.rig, d = this.drawn, el = this.renderer.domElement;
    return r.tx !== d.tx || r.tz !== d.tz || r.dist !== d.dist || r.yaw !== d.yaw || el.width !== d.w || el.height !== d.h
      || this.ships.selected !== d.ship || this.units.selected.size !== d.units;
  }

  /** im Bild sichtbare Änderung melden (z. B. nach Bauen in der Pause) */
  invalidate() { this.dirty = true; }

  // ---------- Gelände ----------

  /** Bereiche außerhalb des Baugebiets abdunkeln (beim Bauen) */
  showArea(on: boolean) {
    this.dirty = true;
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
      color: 0xffffff, transparent: true, roughness: 0.22, metalness: 0.0, envMapIntensity: 0.7,
    });
    const uni = this.waterUniforms as Record<string, THREE.IUniform>;
    uni.uDepth = { value: depthTex };
    this.seenTex = new THREE.DataTexture(new Uint8Array(N * N * 4), N, N);
    this.seenTexFresh = true;
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
    // Wasser empfängt keine Schatten: spart auf fast jedem Bildpunkt 16 Schatten-Abfragen
    this.water.receiveShadow = false;
    this.scene.add(this.water);
  }

  /** Grenze des eigenen Gebiets als Linie in Spielerfarbe */
  onTerritory() {
    const g = this.g, N = g.size;
    if (this.border) { this.scene.remove(this.border); this.border.geometry.dispose(); }
    this.dirty = true;
    const pts: number[] = [];
    const cols: number[] = [];
    const c = new THREE.Color();
    const y = (x: number, z: number) => Math.max(this.terrain.heightAt(x, z), 0.05) + 0.07;
    const ownAt = (x: number, z: number) => (x >= 0 && z >= 0 && x < N && z < N ? g.own[z * N + x] : -1);
    // Band (0,16 Felder breit) statt dünner Linie – gut sichtbar auf dem Handy
    const w = 0.08;
    const seg = (x0: number, z0: number, x1: number, z1: number) => {
      const horiz = z0 === z1;
      const ox = horiz ? 0 : w, oz = horiz ? w : 0;
      const a = [x0 - ox, z0 - oz], b = [x1 - ox, z1 - oz], c2 = [x1 + ox, z1 + oz], d = [x0 + ox, z0 + oz];
      for (const [px, pz] of [a, b, c2, a, c2, d]) { pts.push(px, y(px, pz), pz); cols.push(c.r, c.g, c.b); }
    };
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const o = ownAt(x, z);
      if (o < 0 || g.tiles[z * N + x] === 0 || !g.seen[z * N + x]) continue;
      c.setHex(o === 0 ? 0x8fc0ff : g.players[o]?.color ?? 0xffffff);
      if (ownAt(x, z - 1) !== o) seg(x, z, x + 1, z);
      if (ownAt(x, z + 1) !== o) seg(x, z + 1, x + 1, z + 1);
      if (ownAt(x - 1, z) !== o) seg(x, z, x, z + 1);
      if (ownAt(x + 1, z) !== o) seg(x + 1, z, x + 1, z + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    // ein Material für alle Neuberechnungen (vorher bei jedem Aufruf ein neues, nie freigegeben)
    this.border = new THREE.Mesh(geo, this.borderMat);
    this.border.renderOrder = 3;
    this.scene.add(this.border);
  }

  /** Neu entdeckte Gebiete: Nebel lichten, Pflanzen zeigen (wird beim nächsten Bild gebündelt erledigt) */
  onSeen() {
    this.pend |= 2;
    this.dirty = true;
  }

  // ---------- Änderungen bündeln: nur Geändertes neu bauen ----------

  /** gemerkte Kopien (Geländeart, Wege, entdeckt, belegt) – zum Erkennen geänderter Felder */
  private snapT = new Uint8Array(0);
  private snapR = new Uint8Array(0);
  private snapS = new Uint8Array(0);
  private snapO = new Int32Array(0);
  /** Feld steht schon in der Änderungsliste */
  private marked = new Uint8Array(0);
  private changed: number[] = [];
  /** ausstehende Änderungen: 1 = auf dem Land (Bäume, Wege, Gebäude), 2 = Entdecken */
  private pend = 0;
  /** Messhilfe: Dauer des letzten Abgleichs in ms */
  lastFlushMs = 0;

  private takeSnapshot() {
    const g = this.g;
    this.snapT = g.tiles.slice(); this.snapR = g.roads.slice(); this.snapS = g.seen.slice(); this.snapO = g.occ.slice();
    this.marked = new Uint8Array(g.tiles.length);
  }

  /**
   * Alle Änderungen seit dem letzten Bild auf einmal übernehmen: geänderte Felder selbst erkennen
   * (Vergleich mit den gemerkten Kopien, je vier Felder auf einmal) und nur betroffene Pflanzen-Blöcke,
   * Bodenfarben, Nebel, Wege und Tiere neu aufbauen. Läuft am Anfang jedes Bildes – auch für Bauten der Gegner.
   */
  flushChanges() {
    if (!this.pend) return;
    const t0 = performance.now();
    this.pend = 0;
    const g = this.g, N = g.size;
    if (this.snapT.length !== g.tiles.length) { this.setGame(g); return; } // andere Kartengröße: alles neu
    const list = this.changed, mark = this.marked;
    list.length = 0;
    diffTiles(g.tiles, this.snapT, list, mark);
    diffTiles(g.roads, this.snapR, list, mark);
    diffTiles(g.seen, this.snapS, list, mark);
    diffTiles(g.occ, this.snapO, list, mark);
    const splat: number[] = [];
    const roads: number[] = [];
    const seen: TileRect = { x0: N, y0: N, x1: -1, y1: -1 };
    const land: TileRect = { x0: N, y0: N, x1: -1, y1: -1 };
    let nSeen = 0, islandSeen = false, ownedSeen = false;
    const grow = (r: TileRect, x: number, y: number) => { if (x < r.x0) r.x0 = x; if (x > r.x1) r.x1 = x; if (y < r.y0) r.y0 = y; if (y > r.y1) r.y1 = y; };
    for (const i of list) {
      mark[i] = 0;
      const t = g.tiles[i], r = g.roads[i], sn = g.seen[i], o = g.occ[i];
      const tOld = this.snapT[i], rOld = this.snapR[i], sOld = this.snapS[i], oOld = this.snapO[i];
      this.snapT[i] = t; this.snapR[i] = r; this.snapS[i] = sn; this.snapO[i] = o;
      const x = i % N, y = (i / N) | 0;
      this.veg.markTile(i);
      if (t !== tOld) splat.push(i);
      if (t !== tOld || r !== rOld || (o !== 0) !== (oOld !== 0)) grow(land, x, y);
      if (sn !== sOld) { nSeen++; grow(seen, x, y); if (g.islandOf[i] >= 0) islandSeen = true; if (g.own[i] >= 0) ownedSeen = true; }
      if (r !== rOld || sn !== sOld) roads.push(i);
    }
    // sehr viel auf einmal (z. B. ganze Karte aufgedeckt): einmal alles statt vieler kleiner Stücke
    const big = nSeen > 3000;
    if (splat.length) this.terrain.updateSplat(splat);
    if (nSeen) {
      this.terrain.updateFog(big ? undefined : seen);
      this.writeSeen(big ? null : seen);
      this.life.rebuild(big ? undefined : seen, 3);
    }
    if (land.x1 >= 0 && !(nSeen && big)) this.life.rebuild(land, 2);
    this.veg.flush();
    if (roads.length) this.updateRoads(roads);
    // Gebietsgrenze nur neu, wenn ein Feld mit Besitzer neu entdeckt wurde
    if (ownedSeen) this.onTerritory();
    if (islandSeen) {
      // fremde Gebäude erst zeigen, wenn ihr Platz entdeckt ist
      for (const [id, v] of this.views) {
        const b = g.byId.get(id);
        if (b) { v.mesh.visible = g.seen[g.idx(b.x, b.y)] === 1; v.icon.visible = v.icon.visible && v.mesh.visible; }
      }
      this.marks.touch();
    }
    this.dirty = true;
    this.lastFlushMs = performance.now() - t0;
  }

  /** Nebel-Datenbild fürs Wasser: ganz (r = null) oder nur das Rechteck schreiben und hochladen */
  private writeSeen(r: TileRect | null) {
    const g = this.g, N = g.size, tex = this.seenTex;
    const data = tex.image.data as Uint8Array;
    const put = (i: number) => { const v = g.seen[i] ? 255 : 0; data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255; };
    if (!r || this.seenTexFresh) {
      for (let i = 0; i < N * N; i++) put(i);
      tex.clearUpdateRanges();
    } else {
      for (let y = r.y0; y <= r.y1; y++) {
        for (let x = r.x0; x <= r.x1; x++) put(y * N + x);
        tex.addUpdateRange((y * N + r.x0) * 4, (r.x1 - r.x0 + 1) * 4);
      }
    }
    tex.needsUpdate = true;
  }

  /** Baum gefällt: Bäume des Feldes kippen um, ein Setzling bleibt stehen */
  private falling: { mesh: THREE.Mesh; t: number; axis: THREE.Vector3; base: THREE.Quaternion }[] = [];
  onFelled(k: number) {
    this.dirty = true;
    const list = this.veg.slots.get(k);
    if (!list || !this.g.seen[k]) return;
    for (const t of list) {
      const mesh = new THREE.Mesh(t.mesh.geometry, this.veg.material);
      mesh.position.set(t.x, t.y, t.z);
      const base = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
      mesh.quaternion.copy(base);
      mesh.scale.set(t.s * 0.9, t.sy * 0.9, t.s * 0.9);
      mesh.castShadow = true;
      mesh.customDepthMaterial = this.veg.depthMaterial;
      const a = Math.random() * Math.PI * 2;
      this.scene.add(mesh);
      this.falling.push({ mesh, t: 0, axis: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), base });
    }
    this.veg.updateGrowth();
  }

  private fq = new THREE.Quaternion();
  private animateFalling(dt: number) {
    if (!this.falling.length) return;
    const q = this.fq;
    for (const f of this.falling) {
      f.t += dt;
      // erst langsam, dann schneller umkippen; danach liegen lassen und im Boden versinken
      const fall = Math.min(1, (f.t / 1.4) ** 2);
      q.setFromAxisAngle(f.axis, fall * Math.PI * 0.48);
      f.mesh.quaternion.copy(q).multiply(f.base);
      if (f.t > 3) f.mesh.position.y -= dt * 0.25;
    }
    for (const f of this.falling.filter((x) => x.t > 5)) this.scene.remove(f.mesh);
    this.falling = this.falling.filter((x) => x.t <= 5);
  }

  /** Wald gerodet oder nachgepflanzt: beim nächsten Bild nur die betroffenen Blöcke neu */
  onTreesChanged() {
    this.pend |= 1;
    this.dirty = true;
  }

  /** angezeigter Weg je Feld (0 = keiner), sein Platz in der Weg-Gruppe und das Feld je Platz */
  private roadShown = new Uint8Array(0);
  private roadSlot = new Int32Array(0);
  private roadTile: number[] = [];

  private buildRoads() {
    const N = this.g.size;
    if (!this.roadMesh) {
      const geo = new THREE.BoxGeometry(1, 0.05, 1);
      // klein anfangen (2 048 Felder) und bei Bedarf verdoppeln
      this.roadMesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), 2048);
      this.roadMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.roadMesh.receiveShadow = true;
      this.previewRoads = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }), 400);
      this.previewRoads.count = 0;
      this.previewRoads.renderOrder = 2;
      // Farbfeld gleich anlegen: sonst braucht der erste Weg ein neues Grafik-Programm (Ruckler)
      this.roadMesh.setColorAt(0, this.roadCol.setHex(0xffffff));
      this.previewRoads.setColorAt(0, this.roadCol.setHex(0xffffff));
      // Instanzen ändern sich laufend → nicht anhand alter Grenzen ausblenden
      this.roadMesh.frustumCulled = false;
      this.previewRoads.frustumCulled = false;
    }
    this.scene.add(this.roadMesh, this.previewRoads);
    // neues Spiel: alle Wege neu eintragen
    this.roadShown = new Uint8Array(N * N);
    this.roadSlot = new Int32Array(N * N).fill(-1);
    this.roadTile = [];
    const all: number[] = [];
    for (let i = 0; i < N * N; i++) if (this.g.roads[i] && this.g.seen[i]) all.push(i);
    this.roadMesh.count = 0;
    this.updateRoads(all);
  }

  /** Wege gebaut, abgerissen oder gepflastert: beim nächsten Bild nur die geänderten Felder */
  onRoadsChanged() {
    this.pend |= 1;
    this.dirty = true;
  }

  /** Weg-Felder nachtragen, entfernen oder umfärben (nur die geänderten Plätze werden hochgeladen) */
  private updateRoads(tiles: number[]) {
    const g = this.g, N = g.size, mesh = this.roadMesh;
    const m = this.roadM;
    const touched: number[] = [];
    for (const i of tiles) {
      const v = g.seen[i] ? g.roads[i] : 0;
      if (v === this.roadShown[i]) continue;
      this.roadShown[i] = v;
      let s = this.roadSlot[i];
      if (!v) {
        if (s < 0) continue;
        // letzten Platz in die Lücke schieben
        const last = this.roadTile.length - 1, lt = this.roadTile[last];
        if (s !== last) {
          mesh.getMatrixAt(last, m); mesh.setMatrixAt(s, m);
          mesh.getColorAt(last, this.roadCol); mesh.setColorAt(s, this.roadCol);
          this.roadTile[s] = lt; this.roadSlot[lt] = s;
          touched.push(s);
        }
        this.roadTile.pop();
        this.roadSlot[i] = -1;
        continue;
      }
      if (s < 0) {
        s = this.roadTile.length;
        if (s >= mesh.instanceMatrix.count) ensureCapacity(mesh, s + 1, N * N);
        this.roadTile.push(i);
        this.roadSlot[i] = s;
        const x = i % N, y = (i / N) | 0;
        m.makeTranslation(x + 0.5, this.groundY(x, y, 1) + 0.005, y + 0.5);
        mesh.setMatrixAt(s, m);
      }
      mesh.setColorAt(s, this.roadCol.setHex(v === 2 ? 0xa9a39a : 0x8a7151));
      touched.push(s);
    }
    const n = this.roadTile.length;
    mesh.count = n;
    if (!touched.length) return;
    const im = mesh.instanceMatrix, ic = mesh.instanceColor!;
    if (touched.length > 32) {
      // viele Änderungen: belegten Teil auf einmal hochladen
      im.clearUpdateRanges(); im.addUpdateRange(0, Math.max(1, n) * 16);
      ic.clearUpdateRanges(); ic.addUpdateRange(0, Math.max(1, n) * 3);
    } else for (const s of touched) if (s < n) { im.addUpdateRange(s * 16, 16); ic.addUpdateRange(s * 3, 3); }
    im.needsUpdate = true;
    ic.needsUpdate = true;
    this.dirty = true;
  }
  private roadM = new THREE.Matrix4();

  setRoadPreview(cells: [number, number][], ok: boolean[]) {
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    let n = 0;
    for (let k = 0; k < cells.length && n < 400; k++) {
      const [x, y] = cells[k];
      m.makeTranslation(x + 0.5, this.groundY(x, y, 1) + 0.04, y + 0.5);
      this.previewRoads.setMatrixAt(n, m);
      // Start und Ziel heller hervorheben (dorthin tippt man zum Bestätigen)
      const end = k === 0 || k === cells.length - 1;
      this.previewRoads.setColorAt(n, c.setHex(ok[k] ? (end ? 0xfff27a : 0x66ff66) : (end ? 0xffa0a0 : 0xff5555)));
      n++;
    }
    this.previewRoads.count = n;
    this.previewRoads.instanceMatrix.needsUpdate = true;
    if (this.previewRoads.instanceColor) this.previewRoads.instanceColor.needsUpdate = true;
    this.dirty = true;
  }

  /** Bodenhöhe unter einer Grundfläche */
  groundY(x: number, y: number, s: number): number {
    return this.terrain.groundY(x, y, s);
  }

  // ---------- Gebäude ----------

  private facing(b: Building): number {
    // Kontor, Fischer und Werften zum Wasser drehen, Häuser leicht variieren
    const g = this.g;
    const s = BUILDINGS[b.type].size;
    if (b.type === 'kontor' || b.type === 'fischer' || b.type === 'werft' || b.type === 'grosswerft') {
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

  /** Nachbarmaske für Mauern (1 = -z, 2 = +x, 4 = +z, 8 = -x) */
  private wallMask(b: Building): number {
    let m = 0;
    const link = (x: number, y: number) => { const n = this.g.buildingAt(x, y); return !!n && n !== b && WALL_LINKS.has(n.type); };
    if (link(b.x, b.y - 1)) m |= 1;
    if (link(b.x + 1, b.y)) m |= 2;
    if (link(b.x, b.y + 1)) m |= 4;
    if (link(b.x - 1, b.y)) m |= 8;
    return m;
  }

  /** Mauer-Nachbarn neu zeichnen, wenn sich ihre Verbindungen geändert haben */
  private refreshWallNeighbors(b: Building) {
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const n = this.g.buildingAt(b.x + dx, b.y + dy);
      if (!n || n === b || !WALL_LINKS.has(n.type)) continue;
      const v = this.views.get(n.id);
      if (v && v.mask !== (WALLS.has(n.type) ? this.wallMask(n) : this.gateTurn(n))) { this.removeBuilding(n, false); this.addBuilding(n, false); }
    }
  }

  /** Tore quer stellen, wenn die Mauer in Nord-Süd-Richtung verläuft */
  private gateTurn(b: Building): number {
    const m = this.wallMask(b);
    return (m & 5) && !(m & 10) ? 1 : 0;
  }

  private ownerColor(owner: number): number {
    return this.g.players[owner]?.color ?? 0x2f6fd0;
  }

  addBuilding(b: Building, neighbors = true) {
    const d = BUILDINGS[b.type];
    const isWall = WALLS.has(b.type), isGate = !!d.gate;
    const mask = isWall ? this.wallMask(b) : isGate ? this.gateTurn(b) : 0;
    const model = buildingModel(b.type, isWall ? mask : b.tier);
    const glbKey = this.lib.shownKey(b.type, b.tier);
    const glb = glbKey ? this.lib.building(b.type, b.tier) : null;
    const mesh: THREE.Object3D = glb ?? new THREE.Mesh(model.geo, this.mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(b.x + d.size / 2, this.groundY(b.x, b.y, d.size), b.y + d.size / 2);
    mesh.rotation.y = isGate && mask ? Math.PI / 2 : this.facing(b);
    mesh.userData.id = b.id;
    mesh.visible = this.g.seen[this.g.idx(b.x, b.y)] === 1;
    this.scene.add(mesh);
    const spin = glb ? this.glbSpinners(glb) : this.attachSpinners(mesh, model);
    // Fahnen in Besitzerfarbe (gemeinsam für alle Gebäude gezeichnet, siehe marks.ts)
    mesh.updateMatrixWorld(true);
    const marks: MarkDef[] = [];
    if (glb) marks.push(this.ownerMark(glb, b));
    else for (const [fx, fy, fz] of model.flags ?? []) {
      const p = mesh.localToWorld(new THREE.Vector3(fx, fy, fz));
      marks.push({ cloth: Cloth.Flag, x: p.x, y: p.y, z: p.z, scale: 1, pole: Pole.None, px: 0, py: 0, pz: 0 });
    }
    this.marks.set(b.id, mesh, this.ownerColor(b.owner), marks);
    if (!model.geo.boundingBox) model.geo.computeBoundingBox();
    const top = glb ? (glb.userData.height as number | undefined) ?? d.size * 0.6 + 0.6 : model.geo.boundingBox!.max.y;
    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, sizeAttenuation: false }));
    icon.scale.set(0.055, 0.055, 1);
    icon.position.set(mesh.position.x, mesh.position.y + 2.6, mesh.position.z);
    icon.visible = false;
    icon.renderOrder = 10;
    this.scene.add(icon);
    this.views.set(b.id, { mesh, spin, icon, iconKey: '', tier: b.tier, owner: b.owner, mask, top, glbKey, geo: glb ? null : model.geo });
    this.dirty = true;
    this.pend |= 1; // Gras und Tiere unter dem Gebäude anpassen
    if (neighbors && WALL_LINKS.has(b.type)) this.refreshWallNeighbors(b);
  }

  /**
   * Besitzerfarbe an einem Meshy-Modell: große Fahne (Kontor, Werft, Burg, Türme …) oder kleiner Wimpel,
   * jeweils auf einem Mast an der höchsten Stelle des Modells. Hat das Modell selbst einen Fahnenmast
   * ("fahne" in manifest.json, z. B. Kontor), hängt die Fahne dort – ohne zweiten Mast.
   * (glb muss schon an seinem Platz stehen: Lage in Weltkoordinaten)
   */
  private ownerMark(glb: THREE.Object3D, b: Building): MarkDef {
    const big = BIG_FLAG.has(b.type);
    const cloth = big ? Cloth.Flag : Cloth.Pennant, scale = big ? 1.25 : 1;
    const at = glb.userData.flagAt as [number, number, number] | undefined;
    if (at) {
      const f = glb.localToWorld(new THREE.Vector3(at[0], at[1] - 0.01, at[2]));
      return { cloth, x: f.x, y: f.y, z: f.z, scale, pole: Pole.None, px: 0, py: 0, pz: 0 };
    }
    const [px, py, pz] = (glb.userData.peak as [number, number, number] | undefined) ?? [0, 1, 0];
    const h = big ? POLE_H : POLE_H_SMALL;
    const foot = glb.localToWorld(new THREE.Vector3(px, py - 0.03, pz));
    return { cloth, x: foot.x, y: foot.y + h - 0.02, z: foot.z, scale, pole: big ? Pole.Big : Pole.Small, px: foot.x, py: foot.y, pz: foot.z };
  }

  /** Drehende Teile am Meshy-Modell (Mühle: Flügel an der Nabe, die in manifest.json steht) */
  private glbSpinners(glb: THREE.Object3D): BView['spin'] {
    const hub = glb.userData.hub as [number, number, number] | undefined;
    if (!hub) return [];
    const m = new THREE.Mesh(MILL_BLADES, this.mat);
    m.position.set(...hub);
    m.scale.setScalar((glb.userData.hubR as number) ?? 0.9);
    m.castShadow = true;
    glb.add(m);
    return [{ m, axis: 'z', speed: 1.2 }];
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

  removeBuilding(b: Building, neighbors = true) {
    const v = this.views.get(b.id);
    if (!v) return;
    this.scene.remove(v.mesh, v.icon);
    v.icon.material.dispose();
    this.views.delete(b.id);
    this.marks.remove(b.id);
    this.dirty = true;
    this.pend |= 1;
    // zerstört (nicht abgerissen): Staubwolke und Trümmer
    if (neighbors && b.hp !== undefined && b.hp <= 0 && !this.g.byId.has(b.id) && v.mesh.visible) {
      const s = BUILDINGS[b.type].size;
      this.fx.dust(v.mesh.position.x, v.mesh.position.y + 0.1, v.mesh.position.z, 10 + s * 8, 0.6 + s * 0.4);
    }
    if (neighbors && WALL_LINKS.has(b.type)) this.refreshWallNeighbors(b);
  }

  changedBuilding(b: Building) {
    const v = this.views.get(b.id);
    if (!v) return;
    if (v.owner !== b.owner) {
      // erobert: nur die Fahnen bekommen die neue Farbe
      v.owner = b.owner;
      this.marks.recolor(b.id, this.ownerColor(b.owner));
      this.dirty = true;
    }
    if (v.tier !== b.tier) {
      // neue Ausbaustufe → Modell nur austauschen, wenn sich das gezeigte Modell wirklich ändert
      v.tier = b.tier;
      const key = this.lib.shownKey(b.type, b.tier);
      if (key !== v.glbKey || (!key && buildingModel(b.type, b.tier).geo !== v.geo)) {
        this.removeBuilding(b, false);
        this.addBuilding(b, false);
      }
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
      if (b.owner === 0) switch (b.status) {
        case 'keinWeg': key = '🚧'; break;
        case 'rohstoff': key = b.missing[0] ? GOOD[b.missing[0]].icon : '📦'; break;
        case 'lagerVoll': key = '📦'; break;
        case 'keinWald': key = '🌲'; break;
        case 'keinWasser': key = '🌊'; break;
        case 'erschoepft': key = BUILDINGS[b.type].deposit ? '⛏️' : ({ baum: '🌲', fisch: '🐟', wild: '🦌', weide: '🌿', feld: '🌾' } as Record<string, string>)[BUILDINGS[b.type].harvest?.res ?? 'baum']; break;
        case 'wohnen': key = b.happy < 0.45 ? '😠' : ''; break;
      }
      if (key !== v.iconKey) {
        v.iconKey = key;
        this.dirty = true;
        v.icon.visible = !!key;
        if (key) { (v.icon.material as THREE.SpriteMaterial).map = this.iconTexture(key); (v.icon.material as THREE.SpriteMaterial).needsUpdate = true; }
      }
    }
  }

  // ---------- Vorschau / Auswahl ----------

  setGhost(type: BuildingId | null, x = 0, y = 0, ok = true) {
    this.dirty = true;
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
    this.dirty = true;
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
    this.dirty = true;
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
    this.sky.position.set(r.tx, 0, r.tz);
    // Schattenausschnitt nur in festen Stufen ändern (sonst flimmern die Schatten beim Zoomen)
    const want = Math.min(45, 12 + r.dist * 0.9);
    let span = SHADOW_SPANS[SHADOW_SPANS.length - 1];
    for (const s of SHADOW_SPANS) if (s >= want) { span = s; break; }
    const sc = this.sun.shadow.camera;
    if (sc.right !== span) {
      sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span;
      sc.updateProjectionMatrix();
    }
    // Sonne folgt der Kamera, damit Schatten immer scharf sind – auf das Raster der Schattenkarte
    // gerundet, damit die Schattenkanten beim Verschieben nicht "wandern"
    const d = this.sunDir, sr = this.sunRight, su = this.sunUp;
    const texel = (2 * span) / Math.max(1, this.sun.shadow.mapSize.x);
    const u = Math.round((r.tx * sr.x + r.tz * sr.z) / texel) * texel;
    const v = Math.round((r.tx * su.x + r.tz * su.z) / texel) * texel;
    const w = r.tx * d.x + r.tz * d.z; // Lage entlang der Lichtrichtung (beliebig)
    const px = sr.x * u + su.x * v + d.x * w, py = sr.y * u + su.y * v + d.y * w, pz = sr.z * u + su.z * v + d.z * w;
    this.sun.target.position.set(px, py, pz);
    this.sun.position.set(px + d.x * 60, py + d.y * 60, pz + d.z * 60);
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

  /** Soldat unter dem Finger (großzügig: nächster in ca. 0,9 Feldern) */
  pickUnit(clientX: number, clientY: number): Unit | undefined {
    const p = this.groundPoint(clientX, clientY);
    return p ? this.units.pick(p.x, p.z, 0.9) : undefined;
  }

  /** Soldat gefallen */
  onUnitDied(u: Unit) { this.units.die(u); }

  /** Lebensbalken, Feuer und Rauch für Beschädigtes */
  private damage(dt: number) {
    const g = this.g, fx = this.fx, bars = fx.bars;
    bars.begin();
    for (const s of this.units.shown) {
      const max = UNITS[s.u.type]?.hp ?? 20;
      if (s.u.hp < max) bars.bar(s.x, s.top + 0.08, s.z, s.u.hp / max);
    }
    for (const s of this.ships.shown) {
      if (s.frac < 1) bars.bar(s.x, 0.08 + 1.35 * s.scale, s.z, s.frac);
      if (s.frac < 0.5) fx.burn('s' + s.s.id, s.x, 0.35, s.z, 1 - s.frac * 2, dt, 0.25);
    }
    for (const b of g.buildings) {
      if (b.hp === undefined) continue;
      const v = this.views.get(b.id);
      if (!v || !v.mesh.visible) continue;
      const frac = b.hp / g.maxHp(b);
      if (frac >= 1) continue;
      const p = v.mesh.position, s = BUILDINGS[b.type].size;
      bars.bar(p.x, p.y + v.top + 0.25, p.z, frac);
      if (frac < 0.75) fx.burn('b' + b.id, p.x, p.y + v.top * 0.75, p.z, frac < 0.5 ? 1 - frac * 2 : 0.1, dt, s * 0.28);
    }
    bars.end();
  }

  private growT = 0;
  private lastT = 0;
  private lifeT = 0;

  frame(t: number, gameDt: number) {
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    this.flushChanges();
    this.animateFalling(dt);
    this.growT += dt;
    if (this.growT > 1.5) { this.growT = 0; this.veg.updateGrowth(); }
    this.ships.update(t);
    this.carts.update(t);
    const cam = this.cam;
    cam.x = this.rig.tx; cam.z = this.rig.tz; cam.dist = this.rig.dist;
    // Tiere und Arbeiter laufen nach der Spieluhr (stehen in der Pause still)
    this.lifeT += gameDt;
    this.life.update(this.lifeT, cam);
    this.units.update(t, cam);
    this.damage(dt);
    this.fx.update(dt, this.renderer.domElement.clientHeight || 400);
    this.marks.update(t);
    this.waterUniforms.uTime.value = t;
    windTime.value = t;
    for (const v of this.views.values()) for (const sp of v.spin) sp.m.rotation[sp.axis] -= gameDt * sp.speed;
    this.updateCamera();
    if (this.preparing) return; // Grafik-Programme werden noch vorbereitet: altes Bild bleibt stehen
    // Pflanzen: je nach Entfernung volle Dichte, halbe Dichte oder einfache Formen; Schatten nur nah
    this.veg.update(this.camera.position, this.rig.tx, this.rig.tz, this.rig.dist);
    this.renderer.render(this.scene, this.camera);
    this.seenTexFresh = false;
    const r = this.rig, d = this.drawn, el = this.renderer.domElement;
    d.tx = r.tx; d.tz = r.tz; d.dist = r.dist; d.yaw = r.yaw; d.w = el.width; d.h = el.height;
    d.ship = this.ships.selected; d.units = this.units.selected.size;
    this.dirty = false;
  }
}

/** Felder, in denen sich cur von old unterscheidet, in out sammeln (doppelte über mark vermeiden); vergleicht je vier Felder auf einmal */
function diffTiles(cur: Uint8Array | Int32Array, old: Uint8Array | Int32Array, out: number[], mark: Uint8Array) {
  const n = cur.length;
  if (cur instanceof Uint8Array && old instanceof Uint8Array && n % 4 === 0 && cur.byteOffset % 4 === 0 && old.byteOffset % 4 === 0) {
    const a = new Uint32Array(cur.buffer, cur.byteOffset, n >> 2), b = new Uint32Array(old.buffer, old.byteOffset, n >> 2);
    for (let w = 0; w < a.length; w++) {
      if (a[w] === b[w]) continue;
      for (let i = w * 4; i < w * 4 + 4; i++) if (cur[i] !== old[i] && !mark[i]) { mark[i] = 1; out.push(i); }
    }
    return;
  }
  for (let i = 0; i < n; i++) if (cur[i] !== old[i] && !mark[i]) { mark[i] = 1; out.push(i); }
}
