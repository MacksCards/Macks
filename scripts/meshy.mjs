// Erzeugt 3D-Modelle bei Meshy (meshy.ai) aus assets/modelle.json.
//
//   MESHY_API_KEY=… node scripts/meshy.mjs                 alle fehlenden Modelle
//   MESHY_API_KEY=… node scripts/meshy.mjs --nur haus-0,kontor
//   node scripts/meshy.mjs --test                          nur Liste anzeigen, nichts bestellen
//
// Ablauf je Modell: Vorschau (Form) → Verfeinern (realistische Oberflächen) → GLB herunterladen
// → für das iPhone verkleinern (gltf-transform) → public/models/<id>.glb + manifest.json.
// Figuren bekommen zusätzlich ein Skelett und Animationen (Rigging).
// Der Fortschritt steht in assets/meshy-status.json; ein Abbruch kann einfach neu gestartet werden.
//
// HINWEIS: Die API-Felder entsprechen der Meshy-Dokumentation (openapi v1/v2), konnten beim
// Schreiben aber nicht live geprüft werden. Fehler der API werden vollständig ausgegeben.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const API = 'https://api.meshy.ai/openapi';
const KEY = process.env.MESHY_API_KEY;
const args = process.argv.slice(2);
const TEST = args.includes('--test');
const only = (() => { const i = args.indexOf('--nur'); return i >= 0 ? args[i + 1].split(',') : null; })();
const STATUS_FILE = 'assets/meshy-status.json';
const MANIFEST = 'public/models/manifest.json';

const list = JSON.parse(readFileSync('assets/modelle.json', 'utf8')).modelle;
const status = existsSync(STATUS_FILE) ? JSON.parse(readFileSync(STATUS_FILE, 'utf8')) : {};
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const saveStatus = () => writeFileSync(STATUS_FILE, JSON.stringify(status, null, 1));
const saveManifest = () => writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
mkdirSync('assets/raw', { recursive: true });
mkdirSync('public/models', { recursive: true });

// Ziel-Polygonzahl je Art (iPhone-Budget)
const POLY = { gebaeude: 12000, figur: 6000, tier: 4000, schiff: 15000, pflanze: 3000 };

async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Meshy ${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wait(path, label) {
  for (;;) {
    const t = await api('GET', path);
    if (t.status === 'SUCCEEDED') return t;
    if (t.status === 'FAILED' || t.status === 'CANCELED') throw new Error(`${label} fehlgeschlagen: ${JSON.stringify(t.task_error ?? t)}`);
    process.stdout.write(`\r  ${label}: ${t.status} ${t.progress ?? 0}%   `);
    await sleep(8000);
  }
}

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download ${url} → ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

function optimize(src, dst) {
  // Texturen auf 1024 px (WebP), Geometrie komprimiert (meshopt) → klein und schnell auf dem iPhone
  try {
    execFileSync('npx', ['--yes', '@gltf-transform/cli@4', 'optimize', src, dst,
      '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '1024'], { stdio: 'inherit' });
  } catch (e) {
    console.warn('  Verkleinern fehlgeschlagen, nehme Original:', e.message);
    writeFileSync(dst, readFileSync(src));
  }
}

async function makeModel(m) {
  const st = (status[m.id] ??= {});
  // 1) Vorschau (Form)
  if (!st.preview) {
    const r = await api('POST', '/v2/text-to-3d', {
      mode: 'preview', prompt: m.prompt.slice(0, 600), art_style: 'realistic',
      should_remesh: true, topology: 'triangle', target_polycount: POLY[m.art] ?? 10000,
    });
    st.preview = r.result; saveStatus();
  }
  await wait(`/v2/text-to-3d/${st.preview}`, 'Form');
  // 2) Verfeinern (realistische Oberflächen)
  if (!st.refine) {
    const r = await api('POST', '/v2/text-to-3d', { mode: 'refine', preview_task_id: st.preview, enable_pbr: true });
    st.refine = r.result; saveStatus();
  }
  const ref = await wait(`/v2/text-to-3d/${st.refine}`, 'Oberflächen');
  const raw = `assets/raw/${m.id}.glb`;
  await download(ref.model_urls.glb, raw);
  const entry = { file: `${m.id}.glb`, art: m.art };
  if (m.building) Object.assign(entry, { building: m.building, tier: m.tier ?? 0, size: m.size });

  // 3) Figuren: Skelett + Animationen
  if (m.art === 'figur') {
    if (!st.rig) {
      const r = await api('POST', '/v1/rigging', { input_task_id: st.refine, height_meters: 1.75 });
      st.rig = r.result; saveStatus();
    }
    const rig = await wait(`/v1/rigging/${st.rig}`, 'Skelett');
    const res = rig.result ?? {};
    if (res.rigged_character_glb_url) await download(res.rigged_character_glb_url, raw);
    const anims = res.basic_animations ?? {};
    entry.animationen = {};
    for (const [name, url] of Object.entries({ gehen: anims.walking_glb_url, laufen: anims.running_glb_url })) {
      if (!url) continue;
      const f = `assets/raw/${m.id}-${name}.glb`;
      await download(url, f);
      optimize(f, `public/models/${m.id}-${name}.glb`);
      entry.animationen[name] = `${m.id}-${name}.glb`;
    }
    // Weitere Animationen (Arbeiten, Kämpfen) kommen aus der Meshy-Animationsbibliothek (/v1/animations);
    // die passenden action_id-Werte tragen wir nach dem ersten Lauf ein.
  }
  optimize(raw, `public/models/${m.id}.glb`);
  manifest[m.id] = entry;
  saveManifest();
  st.fertig = true; saveStatus();
  console.log(`\n✔ ${m.id} fertig`);
}

const todo = list.filter((m) => (!only || only.includes(m.id)) && !status[m.id]?.fertig);
console.log(`${todo.length} Modelle zu erzeugen:`, todo.map((m) => m.id).join(', '));
if (TEST) process.exit(0);
if (!KEY) { console.error('MESHY_API_KEY fehlt (in den Umgebungseinstellungen eintragen).'); process.exit(1); }

// 3 gleichzeitig, damit es schneller geht, ohne Meshy zu überlasten
const queue = [...todo];
const errors = [];
await Promise.all([0, 1, 2].map(async () => {
  while (queue.length) {
    const m = queue.shift();
    console.log(`\n▶ ${m.id}`);
    try { await makeModel(m); } catch (e) { console.error(`✘ ${m.id}:`, e.message); errors.push(m.id); }
  }
}));
console.log(errors.length ? `\nFehler bei: ${errors.join(', ')}` : '\nAlle Modelle fertig.');
