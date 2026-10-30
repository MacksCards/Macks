// Modell-Vorschau: rendert Gebäude nebeneinander, so wie sie im Spiel aussehen.
// Aufruf über scripts/modelshot.mjs (Hash: #haus:0,haus:1,kontor:0  optional  &nah)
import * as THREE from 'three';
import { BuildingId, BUILDINGS } from '../src/data';
import { buildingModel } from '../src/render/models';
import { buildingMaterial } from '../src/render/materials';

const [list, opt] = location.hash.slice(1).split('&');
const items = list.split(',').filter(Boolean).map((s) => { const [t, tier] = s.split(':'); return { type: t as BuildingId, tier: Number(tier || 0) }; });
const close = opt === 'nah';
const W = innerWidth, H = innerHeight;
const r = new THREE.WebGLRenderer({ antialias: true });
r.setSize(W, H);
r.setPixelRatio(2);
r.shadowMap.enabled = true;
r.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.style.margin = '0';
document.body.appendChild(r.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd3ee);
scene.add(new THREE.HemisphereLight(0xdcefff, 0x6b5a3a, 1.6));
const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 100 });
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x86b84c }));
ground.receiveShadow = true;
scene.add(ground);
const mat = buildingMaterial();
let x = 0;
const gapX = 0.8;
let total = 0;
for (const it of items) total += BUILDINGS[it.type].size + gapX;
x = -total / 2;
for (const it of items) {
  const s = BUILDINGS[it.type].size;
  const m = buildingModel(it.type, it.tier);
  const mesh = new THREE.Mesh(m.geo, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.position.set(x + s / 2, 0.02, 0);
  scene.add(mesh);
  for (const sp of m.spinners) {
    const sm = new THREE.Mesh(sp.geo, mat);
    sm.position.set(...sp.pos);
    sm.rotation[sp.axis] = 0.4;
    sm.castShadow = true;
    mesh.add(sm);
  }
  for (const p of m.smoke) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: 0xdddddd }));
    puff.position.set(x + s / 2 + p[0], p[1] + 0.1, p[2]);
    scene.add(puff);
  }
  x += s + gapX;
}
const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 200);
const dist = close ? Math.max(4, total * 0.9) : Math.max(6, total * 1.15);
const yaw = Math.PI * 0.25 * (opt === 'hinten' ? -3 : 1);
cam.position.set(Math.sin(yaw) * dist * 0.75, dist * 0.62, Math.cos(yaw) * dist * 0.75);
cam.lookAt(0, 0.5, 0);
sun.position.set(-12, 30, 6);
r.render(scene, cam);
(window as unknown as { done: boolean }).done = true;
