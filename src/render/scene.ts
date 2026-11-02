// 3D-Darstellung mit three.js: Insel, Wasser, Bäume, Berge, Wege, Gebäude.
import * as THREE from 'three';
import { BUILDINGS, BuildingId, UNITS } from '../data';
import { Building, Game, HUMAN, Unit } from '../game';
import { fireStrength, iconFor } from '../events';
import { sound } from '../audio';
import { T } from '../world';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { WALLS, WALL_LINKS, buildingModel } from './models';
import { UnitLayer } from './units';
import { Fx } from './fx';
import { createWater } from './water';
import { borderGeometry, borderMaterial } from './border';
import { LAND_Y, Terrain, TileRect } from './terrain';
import { Vegetation, windTime } from './vegetation';
import { calmClock, tickCalm } from './cloth';
import { ModelLibrary } from './glb';
import { ShipLayer } from './ships';
import { CartLayer } from './carts';
import { LifeLayer } from './life';
import { buildingMaterial } from './materials';
import { Builder, ModelDef } from './kit';
import { Level, Quality, QualityMode } from './quality';
import { Cloth, MarkDef, OwnerMarks, Pole, POLE_H, POLE_H_SMALL } from './marks';
import { Smoke } from './smoke';
import { SignLayer, paintCluster, paintIsland, paintUnit, paintWarn } from './signs';
import { BuildAnims } from './buildanim';
import { GroundRing, PlaceHelp } from './placehelp';
import type { RenderLayer } from './layers';
import { SelectionMarks } from './selmark';
import {
  CLUSTER_DIST, ISLAND_DIST, IslandSymbol, Pin, SMOKE_DIST, SMOKE_STYLE, Sign, UNIT_MARK_DIST, UNIT_MARK_PX,
  buildingSign, clusterPins, effColor, islandSymbols, smokeStrength, tapRadius, working,
} from './citysigns';


interface BView {
  mesh: THREE.Object3D; spin: { m: THREE.Mesh; axis: 'x' | 'z'; speed: number }[]; tier: number;
  /** Warnsymbol (null = keins) und sein Schlüssel (zum Erkennen von Änderungen) */
  sign: Sign | null; signKey: string;
  /** Kontorstufe (0 = Kontor I) */
  level: number;
  /** Schornstein-Öffnungen in Weltkoordinaten (x, y, z hintereinander) */
  smoke: number[];
  /** Drehtempo der Flügel 0..1 (Mühle dreht nur, wenn sie arbeitet; läuft sanft an und aus) */
  spinV: number;
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
/** Gebäude, die zum Wasser schauen und vor denen Schiffe liegen: Fahne auf der Landseite (siehe landSideMark) */
const LAND_SIDE_FLAG = new Set<BuildingId>(['kontor', 'werft', 'grosswerft']);
/** Meshy-Gebäude, die eine große Fahne in Besitzerfarbe tragen (wie die Code-Modelle) */
const BIG_FLAG = new Set<BuildingId>(['kontor', 'markt', 'werft', 'grosswerft', 'burg', 'grosseburg', 'festung', 'holzturm', 'wachturm', 'triumphbogen']);

/** (U4) höchstens so viele Vorschau-Felder (Wege, Häuserfeld, Abrissbereich bis 26 × 26) */
const PREVIEW_MAX = 1200;

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
  /** Rauch aus allen Schornsteinen (ein Zeichenaufruf) */
  readonly smoke = new Smoke();
  /** Warnsymbole, Sammelmarken, Insel-Symbole, Soldaten-Marken (ein Zeichenaufruf) */
  readonly signs = new SignLayer();
  /** goldener Pfeil über Angewähltem (Gebäude, Schiff, Soldaten) */
  readonly selMarks = new SelectionMarks();
  private selB: Building | null = null;
  /** Bau-Animationen: Wachsen, Gerüst, Einsinken */
  private anims!: BuildAnims;
  /** weitere Bild-Ebenen (Andockstelle, z. B. Bewohner und Felder aus G3b) */
  private layers: RenderLayer[] = [];
  /** entdeckte Inseln (für die Insel-Symbole) und deren Symbole */
  private seenIslands = new Set<number>();
  private islandSyms = new Map<number, IslandSymbol[]>();
  /** Gebäude, deren Meshy-Modell mitten im Wachsen fertig geladen wurde: Zeit, ab der das neue Modell weiterwächst */
  private resumeRise = new Map<number, number>();
  /** true, solange buildWorld die Gebäude aufstellt (dann keine Bau-Animation) */
  private settingUp = false;
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
  private previewRoads!: THREE.InstancedMesh;
  private views = new Map<number, BView>();
  private mat = buildingMaterial();
  private ghost: THREE.Mesh | null = null;
  private ghostType: BuildingId | null = null;
  private ghostMatOk = buildingMaterial({ transparent: true, opacity: 0.8, color: 0xc8ffc0, emissive: 0x1e3c1a });
  private ghostMatBad = buildingMaterial({ transparent: true, opacity: 0.7, color: 0xff8a7a, emissive: 0x3c1410 });
  /** Rahmen der Grundfläche, Bäume dort ausblenden (Bau-Vorschau) */
  private place = new PlaceHelp();
  /** Ring des Arbeitsbereichs und Fläche im Arbeitsradius, gefärbt nach Ergiebigkeit (beim Antippen eines Betriebs) */
  private workRing = new GroundRing();
  /** Geländehöhe (für Dinge, die dem Boden folgen) */
  private hAt = (x: number, z: number) => (this.terrain ? this.terrain.heightAt(x, z) : LAND_Y);
  private selectRing: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -LAND_Y);
  /** Ebene für Wischen und Zoomen: liegt auf der Höhe des Blickziels (updateCamera) */
  private panPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -LAND_Y);
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
  private borderMat = borderMaterial();
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
        if (v && this.lib.shownKey(b.type, b.tier) !== v.glbKey) {
          // wächst das Gebäude gerade noch aus dem Boden, wächst das neue Modell an derselben Stelle weiter
          const t = this.anims.riseTime(b.id);
          if (t >= 0) this.resumeRise.set(b.id, t);
          this.removeBuilding(b, false); this.addBuilding(b, false);
        }
      }
      if (what.others.size) this.ships?.resetViews();
    };
    void this.lib.load();

    this.scene.add(this.place.group);

    // Ring des Arbeitsbereichs und Scheibe der Ergiebigkeit: folgen dem Gelände (placehelp.ts)
    this.scene.add(this.workRing.group);

    this.selectRing = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.selectRing.visible = false;
    this.selectRing.renderOrder = 3;
    this.scene.add(this.selectRing);

    this.marks = new OwnerMarks(this.mat);
    this.scene.add(this.marks.group);
    this.anims = new BuildAnims(this.scene, this.mat);
    this.scene.add(this.smoke.points, this.signs.mesh, this.selMarks.group);

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
    for (const v of this.views.values()) this.scene.remove(v.mesh);
    this.views.clear();
    this.marks.clear();
    this.workRing.reset();
    this.anims.clear();
    this.smoke.clear();
    this.resumeRise.clear();
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
    else if (ship) {
      // Schiff und die nächste Küste der Heimatinsel zugleich ins Bild (liegt sie nah genug)
      const c = g.homeCoast();
      const sep = c ? Math.hypot(c[0] + 0.5 - ship.x, c[1] + 0.5 - ship.y) : 99;
      if (c && sep < 30) {
        this.rig.tx = (ship.x + c[0] + 0.5) / 2; this.rig.tz = (ship.y + c[1] + 0.5) / 2;
        this.rig.dist = Math.max(28, Math.min(46, 16 + sep * 1.4));
      } else { this.rig.tx = ship.x + 4; this.rig.tz = ship.y - 4; this.rig.dist = 34; }
    }
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
    this.settingUp = true;
    try { for (const b of g.buildings) this.addBuilding(b); } finally { this.settingUp = false; }
    // entdeckte Inseln (für ihre Symbole)
    this.seenIslands.clear(); this.islandSyms.clear();
    for (const il of g.islands) if (g.islandSeen(il.id)) this.seenIslands.add(il.id);
    for (const l of this.layers) l.setGame(g, h);
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
    grp.add(...this.marks.warm(), ...this.selMarks.warm());
    // (Rauch und Symbole hängen immer in der Szene – auch leer –, ihre Programme werden also mit vorbereitet)
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
    if (this.dirty || this.anims.busy) return true;
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

  /** Meer (src/render/water.ts): Tiefenfarbe, feine Wellen, Glitzern, weicher Küstenschaum */
  private buildWater() {
    const w = createWater(this.g, this.terrain, this.waterUniforms);
    this.water = w.mesh;
    this.seenTex = w.seenTex;
    this.seenTexFresh = true;
    this.scene.add(this.water);
  }

  /** Grenze der Gebiete als weiche, runde Linie in Besitzerfarbe (src/render/border.ts) */
  onTerritory() {
    const g = this.g;
    if (this.border) { this.scene.remove(this.border); this.border.geometry.dispose(); }
    this.dirty = true;
    const geo = borderGeometry(g, (x, z) => this.terrain.heightAt(x, z), (o) => this.ownerColor(o));
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
      if (sn !== sOld) {
        nSeen++; grow(seen, x, y);
        if (g.islandOf[i] >= 0) { islandSeen = true; if (sn) this.seenIslands.add(g.islandOf[i]); }
        if (g.own[i] >= 0) ownedSeen = true;
      }
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
    if (land.x1 >= 0) for (const l of this.layers) l.rebuild?.(land);
    this.veg.flush();
    if (roads.length) this.updateRoads(roads);
    // Gebietsgrenze nur neu, wenn ein Feld mit Besitzer neu entdeckt wurde
    if (ownedSeen) this.onTerritory();
    if (islandSeen) {
      // fremde Gebäude erst zeigen, wenn ihr Platz entdeckt ist
      for (const [id, v] of this.views) {
        const b = g.byId.get(id);
        if (b) v.mesh.visible = g.seen[g.idx(b.x, b.y)] === 1;
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

  // Wege werden in das Bodenbild gemalt (terrain.ts: Fahrspuren, Pflastersteine, weiche Ränder);
  // hier bleibt nur die Vorschau beim Bauen.
  private buildRoads() {
    if (!this.previewRoads) {
      const geo = new THREE.BoxGeometry(1, 0.05, 1);
      this.previewRoads = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }), PREVIEW_MAX);
      this.previewRoads.count = 0;
      this.previewRoads.renderOrder = 2;
      // Farbfeld gleich anlegen: sonst braucht die erste Vorschau ein neues Grafik-Programm (Ruckler)
      this.previewRoads.setColorAt(0, this.roadCol.setHex(0xffffff));
      this.previewRoads.frustumCulled = false;
    }
    this.scene.add(this.previewRoads);
    this.terrain.updateRoads();
  }

  /** Wege gebaut, abgerissen oder gepflastert: beim nächsten Bild nur die geänderten Felder */
  onRoadsChanged() {
    this.pend |= 1;
    this.dirty = true;
  }

  /** Weg-Felder im Bodenbild nachtragen, entfernen oder umfärben */
  private updateRoads(tiles: number[]) {
    if (this.terrain.updateRoads(tiles)) this.dirty = true;
  }

  /** (U4) cols = eigene Farbe je Feld (Häuserfeld, Abrissbereich, Rahmen); sonst grün/rot mit hellem Start und Ziel */
  setRoadPreview(cells: [number, number][], ok: boolean[], cols?: readonly number[]) {
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    let n = 0;
    for (let k = 0; k < cells.length && n < PREVIEW_MAX; k++) {
      const [x, y] = cells[k];
      m.makeTranslation(x + 0.5, this.groundY(x, y, 1) + 0.04, y + 0.5);
      this.previewRoads.setMatrixAt(n, m);
      // Start und Ziel heller hervorheben (dorthin tippt man zum Bestätigen)
      const end = k === 0 || k === cells.length - 1;
      this.previewRoads.setColorAt(n, c.setHex(cols ? cols[k] : ok[k] ? (end ? 0xfff27a : 0x66ff66) : (end ? 0xffa0a0 : 0xff5555)));
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

  /**
   * Gebäude darstellen. neighbors = true heißt „wirklich neu gebaut“ (Ereignis aus dem Spiel): dann auch
   * Mauer-Nachbarn anpassen und – wenn es im Bild ist – die kurze Bau-Animation zeigen.
   */
  addBuilding(b: Building, neighbors = true) {
    const d = BUILDINGS[b.type];
    const isWall = WALLS.has(b.type), isGate = !!d.gate;
    const mask = isWall ? this.wallMask(b) : isGate ? this.gateTurn(b) : 0;
    const level = b.level ?? 0;
    const model = buildingModel(b.type, isWall ? mask : b.tier, { level, variant: b.id % 4 });
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
    // Schornstein-Öffnungen in Weltkoordinaten (Meshy-Modell: aus manifest.json „rauch“; Code-Modell: aus dem Modell)
    const smoke: number[] = [];
    if (SMOKE_STYLE[b.type]) {
      const pts = glb ? (glb.userData.smokeAt as [number, number, number][] | undefined) ?? [] : model.smoke;
      const p = new THREE.Vector3();
      for (const [sx, sy, sz] of pts) { mesh.localToWorld(p.set(sx, sy, sz)); smoke.push(p.x, p.y + 0.02, p.z); }
    }
    const setMarks = () => this.marks.set(b.id, mesh, this.ownerColor(b.owner), marks);
    // neu gebaut und im Bild: wächst aus dem Boden (Fahnen erst, wenn es steht)
    const r = this.rig;
    const near = Math.hypot(mesh.position.x - r.tx, mesh.position.z - r.tz) < r.dist * 1.6 + 10;
    const resume = this.resumeRise.get(b.id);
    this.resumeRise.delete(b.id);
    if ((neighbors && !this.settingUp && mesh.visible && near) || resume !== undefined) {
      const at = { x: mesh.position.x, z: mesh.position.z };
      this.anims.rise(b.id, mesh, () => { if (this.views.get(b.id)?.mesh === mesh) setMarks(); this.dirty = true; }, (k) => {
        const n = d.size === 1 ? 4 : 6 + d.size * 4;
        this.fx.dust(at.x, mesh.position.y + 0.05, at.z, k ? Math.ceil(n / 2) : n, 0.35 + d.size * 0.3);
      }, resume ?? 0);
      if (b.owner === HUMAN && resume === undefined) sound.play('hammer', at);
    } else setMarks();
    if (!model.geo.boundingBox) model.geo.computeBoundingBox();
    const top = glb ? (glb.userData.height as number | undefined) ?? d.size * 0.6 + 0.6 : model.geo.boundingBox!.max.y;
    this.views.set(b.id, {
      mesh, spin, tier: b.tier, level, sign: null, signKey: '', smoke, spinV: 0,
      owner: b.owner, mask, top, glbKey, geo: glb ? null : model.geo,
    });
    this.dirty = true;
    this.pend |= 1; // Gras und Tiere unter dem Gebäude anpassen
    if (neighbors && WALL_LINKS.has(b.type)) this.refreshWallNeighbors(b);
  }

  /**
   * Besitzerfarbe an einem Meshy-Modell: große Fahne (Kontor, Werft, Burg, Türme …) oder kleiner Wimpel,
   * jeweils auf einem Mast an der höchsten Stelle des Modells. Hat das Modell selbst einen Fahnenmast
   * ("fahne" in manifest.json; heute bei keinem Modell mehr), hängt die Fahne dort – ohne zweiten Mast.
   * Kontor und Werften: Fahne auf der Landseite (landSideMark); den Mast auf der Wasserseite hat das
   * Kontor-Modell nicht mehr (herausgeschnitten, siehe scripts/modell-schnitt.mjs).
   * (glb muss schon an seinem Platz stehen: Lage in Weltkoordinaten)
   */
  private ownerMark(glb: THREE.Object3D, b: Building): MarkDef {
    const big = BIG_FLAG.has(b.type);
    const cloth = big ? Cloth.Flag : Cloth.Pennant, scale = big ? 1.25 : 1;
    if (LAND_SIDE_FLAG.has(b.type)) {
      const m = this.landSideMark(glb, b, cloth, scale, big);
      if (m) return m;
    }
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

  /**
   * Fahne auf der Landseite eines Gebäudes, das zum Wasser schaut (Kontor, Werften): Am Kontor ankern Schiffe
   * direkt vor der Wasserseite – hing die Fahne dort (am Mast des Modells), lag sie in der üblichen Schrägansicht
   * genau auf den Segeln des Schiffs („zwei blaue Flecken über dem Schiff“). Jetzt steht ein eigener Mast auf dem
   * Dach, auf der vom Wasser abgewandten Seite. Die Stelle wird einmal beim Aufbau gesucht: senkrecht von oben
   * auf das Modell „getastet“, höchste Stelle der hinteren Dachhälfte. null = nichts gefunden (dann wie bisher).
   * (Das Modell schaut mit seiner Vorderseite, lokal +z, zum Wasser – siehe facing().)
   */
  private landSideMark(glb: THREE.Object3D, b: Building, cloth: Cloth, scale: number, big: boolean): MarkDef | null {
    glb.updateMatrixWorld(true);
    // je Modell nur einmal tasten (Lage im Modell merken; alle Kontore desselben Modells sind gleich)
    const key = this.lib.shownKey(b.type, b.tier) ?? b.type;
    let local = this.landSideAt.get(key);
    if (local === undefined) {
      const s = BUILDINGS[b.type].size;
      const rc = this.raycaster, down = new THREE.Vector3(0, -1, 0), from = new THREE.Vector3();
      let best: THREE.Vector3 | null = null;
      for (const fz of [-0.12, -0.2, -0.28]) for (const fx of [-0.24, -0.12, 0, 0.12, 0.24]) {
        glb.localToWorld(from.set(fx * s, 30, fz * s));
        rc.set(from, down);
        const hit = rc.intersectObject(glb, true)[0];
        if (hit && (!best || hit.point.y > best.y + 0.02)) best = hit.point.clone();
      }
      local = best && best.y >= glb.position.y + 0.4 ? glb.worldToLocal(best) : null;
      this.landSideAt.set(key, local);
    }
    if (!local) return null;
    const best = glb.localToWorld(local.clone());
    const pole = big ? Pole.Big : Pole.Small, h = big ? POLE_H : POLE_H_SMALL;
    const fy = best.y - 0.03;
    return { cloth, x: best.x, y: fy + h - 0.02, z: best.z, scale, pole, px: best.x, py: fy, pz: best.z };
  }

  /** Fahnenplatz auf der Landseite je Modell (Lage im Modell; null = keiner gefunden), siehe landSideMark */
  private landSideAt = new Map<string, THREE.Vector3 | null>();

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

  /** Gebäude aus dem Bild nehmen. neighbors = true heißt „wirklich abgerissen/zerstört“: dann Staub und Einsinken. */
  removeBuilding(b: Building, neighbors = true) {
    const v = this.views.get(b.id);
    if (!v) return;
    this.anims.finish(b.id, false);
    this.anims.detach(v.mesh);
    this.views.delete(b.id);
    this.marks.remove(b.id);
    for (let i = 0; i < v.smoke.length / 3; i++) this.smoke.forget(b.id * 8 + i);
    this.dirty = true;
    this.pend |= 1;
    const gone = neighbors && !this.g.byId.has(b.id) && v.mesh.visible;
    if (gone) {
      // abgerissen oder zerstört: Staubwolke, das Gebäude sinkt ein (zerstört: mehr Staub und Trümmer)
      const s = BUILDINGS[b.type].size, p = v.mesh.position;
      const destroyed = b.hp !== undefined && b.hp <= 0;
      this.fx.dust(p.x, p.y + 0.1, p.z, (destroyed ? 10 : 6) + s * (destroyed ? 8 : 5), 0.5 + s * 0.4);
      this.anims.sink(v.mesh, v.top);
    } else this.scene.remove(v.mesh);
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
    const level = b.level ?? 0;
    if (v.tier !== b.tier || v.level !== level) {
      // neue Ausbaustufe (Haus) oder Kontorstufe → Modell nur austauschen, wenn sich das gezeigte Modell wirklich ändert
      const up = b.tier > v.tier || level > v.level;
      v.tier = b.tier; v.level = level;
      const key = this.lib.shownKey(b.type, b.tier);
      let cur = v;
      if (key !== v.glbKey || (!key && buildingModel(b.type, b.tier, { level, variant: b.id % 4 }).geo !== v.geo)) {
        this.removeBuilding(b, false);
        this.addBuilding(b, false);
        cur = this.views.get(b.id) ?? v;
      }
      // Aufstieg sichtbar machen: kurz ein Gerüst, das neue Haus streckt sich; Abstieg: nur etwas Staub
      if (cur.mesh.visible) {
        const d = BUILDINGS[b.type], p = cur.mesh.position;
        if (up) {
          this.anims.scaffold(cur.mesh, d.size, cur.top);
          if (b.owner === HUMAN) sound.play('hammer', { x: p.x, z: p.z });
        }
        this.fx.dust(p.x, p.y + 0.05, p.z, 4 + d.size * 2, 0.4 + d.size * 0.3);
      }
      this.dirty = true;
    }
  }

  /** Warnsymbole und Insel-Symbole neu bestimmen (selten aufrufen, etwa zweimal je Sekunde) */
  refreshIcons() {
    const g = this.g;
    for (const b of g.buildings) {
      const v = this.views.get(b.id);
      if (!v) continue;
      // nur die eigenen Gebäude zeigen Warnungen; ein laufendes Ereignis (🔥 Brand, 💀 Pest …) geht vor
      const sign = b.owner === HUMAN ? buildingSign(b, iconFor(g, b)) : null;
      const key = sign ? sign.icon + sign.level : '';
      if (key !== v.signKey) { v.signKey = key; v.sign = sign; this.dirty = true; }
    }
    // Insel-Symbole (Erz wird weniger, Gold kann versiegen)
    for (const id of this.seenIslands) {
      const il = g.islands[id];
      if (!il) continue;
      const syms = islandSymbols(il);
      const old = this.islandSyms.get(id);
      if (!old || old.length !== syms.length || old.some((o, i) => o.icon !== syms[i].icon || o.text !== syms[i].text)) {
        this.islandSyms.set(id, syms);
        this.dirty = true;
      }
    }
  }

  /**
   * Alle Symbole für dieses Bild setzen (ein Zeichenaufruf): Warnsymbole bzw. – weit herausgezoomt –
   * Sammelmarken je 6 × 6 Felder, Insel-Symbole ab Abstand 20, Soldaten-Marken ab Abstand 45.
   */
  private updateSigns() {
    const sl = this.signs, r = this.rig, el = this.renderer.domElement;
    sl.setView(el.clientWidth || el.width, el.clientHeight || el.height);
    sl.begin();
    // zuerst die Insel-Symbole: Warnungen und Soldaten-Marken liegen darüber (spätere Symbole decken frühere)
    if (r.dist >= ISLAND_DIST) {
      // sanft einblenden (Abstand 20 bis 30), damit die Symbole beim Zoomen nicht plötzlich aufspringen
      // und nah an der eigenen Stadt kaum stören
      const alpha = Math.min(1, (r.dist - ISLAND_DIST) / 10);
      for (const id of this.seenIslands) {
        const il = this.g.islands[id], syms = this.islandSyms.get(id);
        if (!il || !syms?.length) continue;
        const w = 40;
        syms.forEach((sym, i) => sl.add(il.cx + 0.5, LAND_Y + 3, il.cy + 0.5, `i${sym.icon}${sym.text}`, paintIsland(sym.icon, sym.text), 38, (i - (syms.length - 1) / 2) * w, 0, alpha));
      }
    }
    if (r.dist < CLUSTER_DIST) {
      for (const [id, v] of this.views) {
        const s = v.sign;
        if (!s || !v.mesh.visible || this.anims.rising(id)) continue;
        const p = v.mesh.position;
        sl.add(p.x, p.y + v.top + 0.4, p.z, `w${s.icon}${s.level}`, paintWarn(s.icon, s.level), 30);
      }
    } else {
      const pins: Pin[] = [];
      for (const v of this.views.values()) {
        const s = v.sign;
        if (s && v.mesh.visible) pins.push({ x: v.mesh.position.x, z: v.mesh.position.z, level: s.level, icon: s.icon });
      }
      for (const c of clusterPins(pins)) sl.add(c.x, LAND_Y + 1.6, c.z, `c${c.icon}${c.level}${c.count}`, paintCluster(c.icon, c.level, c.count), 40);
    }
    if (r.dist >= UNIT_MARK_DIST) {
      const col = this.ownerColor(HUMAN), sel = this.units.selected;
      for (const s of this.units.shown) {
        if (s.u.owner !== HUMAN) continue;
        const on = sel.has(s.u.id);
        sl.add(s.x, s.top + 0.3, s.z, `u${col}${on ? 1 : 0}`, paintUnit(col, on), UNIT_MARK_PX);
      }
    }
    sl.end();
  }

  /** Fußpunkt des (ersten) Auswahl-Pfeils in der Welt: Oberkante des angewählten Dings (für das Zoomen per Knopf) */
  readonly selAnchor = { on: false, p: new THREE.Vector3() };

  /** goldener Pfeil über dem angewählten Gebäude, Schiff bzw. den angewählten Soldaten */
  private updateSelMarks(t: number) {
    const sm = this.selMarks;
    sm.begin();
    const an = this.selAnchor;
    an.on = false;
    const anchor = (x: number, y: number, z: number) => { if (!an.on) { an.on = true; an.p.set(x, y, z); } };
    const b = this.selB, v = b && this.views.get(b.id);
    if (v && v.mesh.visible) {
      // steht ein Warnsymbol über dem Gebäude, schwebt der Pfeil darüber (nicht davor)
      const sign = !!v.sign && this.rig.dist < CLUSTER_DIST && !this.anims.rising(b!.id);
      sm.add(v.mesh.position.x, v.mesh.position.y + v.top + (sign ? 0.4 : 0), v.mesh.position.z, false, sign ? 17 : 0);
      anchor(v.mesh.position.x, v.mesh.position.y + v.top, v.mesh.position.z);
    }
    const sel = this.ships.selected;
    if (sel !== null) for (const s of this.ships.shown) if (s.s.id === sel) { sm.add(s.x, s.top, s.z); anchor(s.x, s.top, s.z); break; }
    // (U4) mehrere gewählte Schiffe (Flotte)
    const fl = this.ships.multi;
    if (fl.size) for (const s of this.ships.shown) if (fl.has(s.s.id)) { sm.add(s.x, s.top, s.z); anchor(s.x, s.top, s.z); }
    const us = this.units.selected;
    if (us.size) for (const s of this.units.shown) if (us.has(s.u.id)) { sm.add(s.x, s.top + 0.1, s.z, true); anchor(s.x, s.top + 0.1, s.z); }
    sm.end(t, this.camera, this.renderer.domElement.clientHeight || 400);
  }

  /** Rauch aus arbeitenden Betrieben und bewohnten Häusern nahe der Kamera (dt = 0 in der Pause) */
  private emitSmoke(dt: number) {
    const r = this.rig;
    if (dt <= 0 || r.dist >= SMOKE_DIST) return;
    const reach = r.dist * 1.3 + 6;
    for (const [id, v] of this.views) {
      if (!v.smoke.length || !v.mesh.visible) continue;
      const p = v.mesh.position;
      if (Math.abs(p.x - r.tx) > reach || Math.abs(p.z - r.tz) > reach) continue;
      if (this.anims.rising(id)) continue;
      const b = this.g.byId.get(id);
      if (!b) continue;
      const k = smokeStrength(b);
      if (k <= 0) continue;
      const style = SMOKE_STYLE[b.type]!;
      for (let i = 0; i < v.smoke.length; i += 3) this.smoke.emit(id * 8 + i / 3, v.smoke[i], v.smoke[i + 1], v.smoke[i + 2], dt, style, k);
    }
  }

  /** Drehende Teile: Betriebe (Mühle) drehen nur, wenn sie arbeiten – sanft an- und auslaufend, in der Pause still */
  private spinParts(gameDt: number) {
    if (gameDt <= 0) return;
    for (const [id, v] of this.views) {
      if (!v.spin.length) continue;
      const b = this.g.byId.get(id);
      const on = !b || !BUILDINGS[b.type].prod || working(b) ? 1 : 0;
      v.spinV += (on - v.spinV) * Math.min(1, gameDt * 0.6);
      if (v.spinV < 0.002) continue;
      for (const sp of v.spin) sp.m.rotation[sp.axis] -= gameDt * sp.speed * v.spinV;
    }
  }

  /** weitere Bild-Ebene anmelden (Andockstelle, siehe layers.ts) */
  addLayer(l: RenderLayer) {
    this.layers.push(l);
    this.scene.add(l.group);
    if (this.terrain) l.setGame(this.g, (x, z) => this.terrain.heightAt(x, z));
  }

  // ---------- Vorschau / Auswahl ----------

  setGhost(type: BuildingId | null, x = 0, y = 0, ok = true) {
    this.dirty = true;
    if (!type) {
      if (this.ghost) this.scene.remove(this.ghost);
      this.ghost = null;
      this.ghostType = null;
      this.place.hide();
      this.workRing.show(0, 0, 0, 0, this.hAt);
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
    this.place.show(this.ghost!.geometry, x, y, d.size, gy, ok);
    this.showRadius(d.work ?? d.radius ?? 0, x + d.size / 2, y + d.size / 2, d.work && d.prod ? 0xffb347 : 0xffffff);
  }

  showRadius(r: number, x = 0, z = 0, color = 0xffffff) {
    this.dirty = true;
    this.workRing.show(r, x, z, color, this.hAt);
  }

  setSelected(b: Building | null) {
    this.workRing.showDisc(0, 0, 0, 0, this.hAt);
    this.selB = b;
    if (!b) { this.selectRing.visible = false; this.showRadius(0); return; }
    const d = BUILDINGS[b.type];
    this.selectRing.visible = true;
    const r = d.size * 0.75;
    this.selectRing.scale.set(r, 1, r);
    this.selectRing.position.set(b.x + d.size / 2, this.groundY(b.x, b.y, d.size) + 0.06, b.y + d.size / 2);
    const cx = b.x + d.size / 2, cz = b.y + d.size / 2, rad = d.work ?? d.radius ?? 0;
    if (d.harvest && rad) {
      // fertiger Betrieb, der aus der Umgebung erntet: Arbeitsradius in der Farbe seiner Ergiebigkeit
      // (wie die Skala beim Bauen: grün ergiebig, gelb mäßig, rot kaum etwas da)
      const col = effColor(b.eff);
      this.showRadius(rad, cx, cz, col);
      this.workRing.showDisc(rad, cx, cz, col, this.hAt);
    } else this.showRadius(rad, cx, cz, d.work && d.prod ? 0xffb347 : 0xffffff);
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
    const cx = r.tx + Math.sin(r.yaw) * cp * r.dist, cz = r.tz + Math.cos(r.yaw) * cp * r.dist;
    // Blickziel: nah herangezoomt auf der Höhe des Geländes (über einem Berg schaut man auf den Berg, nicht
    // in den Fels darunter); weiter weg sanft zurück auf Meereshöhe, damit das Bild beim Verschieben ruhig bleibt
    const near = Math.min(1, Math.max(0, (25 - r.dist) / 18));
    // (Mittel über die Umgebung, nicht der Punkt allein: so hebt und senkt sich das Ziel beim Verschieben sanft
    // statt jeder Felskante zu folgen, und das Gelände bleibt unter dem Finger)
    let ty = LAND_Y;
    if (this.terrain && near > 0) {
      let sum = 0;
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) sum += Math.max(LAND_Y, this.terrain.heightAt(r.tx + i * 1.5, r.tz + j * 1.5));
      ty = LAND_Y + (sum / 25 - LAND_Y) * near;
    }
    // nah am Hang nie in den Berg tauchen: Kamera bleibt mindestens 1,5 über dem Gelände unter ihr
    const ground = this.terrain ? Math.max(this.terrain.heightAt(cx, cz), this.terrain.heightAt((cx + r.tx) / 2, (cz + r.tz) / 2) - 0.5) : 0;
    this.camera.position.set(cx, Math.max(ty + sp * r.dist, ground + 1.5), cz);
    this.camera.lookAt(r.tx, ty, r.tz);
    // Wischen und Zoomen rechnen auf der Höhe des Blickziels – so bleibt auch über einem Berg das Gelände unter dem Finger
    this.panPlane.constant = -ty;
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
    return this.raycaster.ray.intersectPlane(this.panPlane, p) ? p : null;
  }

  /** Schiff unter dem Finger */
  pickShip(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.ships.pick(this.raycaster);
  }

  /**
   * Soldat unter dem Finger: nächster in 0,9 Feldern – weit herausgezoomt mindestens in Fingerbreite
   * (24 Bildpunkte), damit man die kleinen Soldaten bzw. ihre Marken sicher trifft.
   */
  pickUnit(clientX: number, clientY: number): Unit | undefined {
    const p = this.groundPoint(clientX, clientY);
    return p ? this.units.pick(p.x, p.z, tapRadius(0.9, this.pxPerTile(p))) : undefined;
  }

  /** Wie viele Bildpunkte (CSS) ein Feld an diesem Bodenpunkt auf dem Bildschirm misst */
  pxPerTile(p: THREE.Vector3): number {
    const el = this.renderer.domElement, w = el.clientWidth || el.width, h = el.clientHeight || el.height;
    this.camera.updateMatrixWorld();
    const a = p.clone().project(this.camera), b = new THREE.Vector3(p.x + 1, p.y, p.z).project(this.camera);
    const c = new THREE.Vector3(p.x, p.y, p.z + 1).project(this.camera);
    const dx = (b.x - a.x) * w / 2, dy = (b.y - a.y) * h / 2, ex = (c.x - a.x) * w / 2, ey = (c.y - a.y) * h / 2;
    return Math.max(Math.hypot(dx, dy), Math.hypot(ex, ey), 1e-3);
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
      // (S3) laufender Brand (events.ts): kräftige Flammen gleich vom Ausbruch an, beim Löschen kleiner
      const fire = fireStrength(g, b);
      if (fire > 0) fx.burn('b' + b.id, p.x, p.y + v.top * 0.75, p.z, fire, dt, s * 0.28);
      else if (frac < 0.75) fx.burn('b' + b.id, p.x, p.y + v.top * 0.75, p.z, frac < 0.5 ? 1 - frac * 2 : 0.1, dt, s * 0.28);
    }
    bars.end();
  }

  private growT = 0;
  private lastT = 0;
  private lifeT = 0;

  frame(t: number, gameDt: number) {
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    // Ruhe-Uhr (cloth.ts): läuft beim Spielen mit der echten Zeit, steht in Pause/Menü still. Nach ihr laufen
    // Wasser, Wind in Bäumen und Gras, Fahnen, Schiffe, Pfeil, fallende Bäume und Funken/Feuer – in der Pause
    // steht so das ganze Bild still (wie das Spiel) statt bei wenigen Bildern je Sekunde zu ruckeln.
    // Ausnahme: Wird in der Pause gebaut, laufen Staub und fallende Bäume mit dem Aufbau mit (dann wird ohnehin
    // jedes Bild gezeichnet).
    const c0 = calmClock.value;
    tickCalm(t);
    const cdt = this.anims.busy ? dt : calmClock.value - c0;
    this.flushChanges();
    this.animateFalling(cdt);
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
    this.damage(cdt);
    const vh = this.renderer.domElement.clientHeight || 400;
    this.fx.update(cdt, vh);
    this.marks.update(calmClock.value);
    this.anims.update(dt);
    // Rauch: läuft in echter Zeit, steht aber in der Pause still (wie das ganze Spiel)
    const sdt = gameDt > 0 ? dt : 0;
    this.emitSmoke(sdt);
    this.smoke.update(sdt, vh);
    for (const l of this.layers) l.update(t, gameDt, cam);
    this.waterUniforms.uTime.value = calmClock.value;
    windTime.value = calmClock.value;
    this.spinParts(gameDt);
    this.updateCamera();
    this.updateSigns();
    this.updateSelMarks(t);
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
