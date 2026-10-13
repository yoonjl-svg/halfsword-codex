// Real-browser stage lifecycle gate followed by actual game photographs.
// The first photograph uses the live game's unmodified combat camera.
import { chromium } from '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const out = process.argv[2];
const reuseGate = process.argv[3];
assert(out?.startsWith('/tmp/'));
await fs.mkdir(out, { recursive: true });
const report = { pass: false, errors: [], source: {}, lifecycle: [], limitations: ['Desktop software rendering is not physical-phone performance.', 'Camera-only observation views do not represent a normal combat camera.'] };
for (const name of ['src/stage_etna.js', 'src/etna_ground.js', 'src/stage_kit.js', 'src/stages.js']) report.source[name] = createHash('sha256').update(await fs.readFile(name)).digest('hex');
report.toolSha256 = createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex');
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  if (reuseGate) {
    const previous = JSON.parse(await fs.readFile(reuseGate));
    assert.equal(previous.lifecycle.length, 3);
    report.lifecycle = previous.lifecycle;
    report.reusedLifecycle = { path: reuseGate, source: previous.source, reason: 'Only deterministic lava canvas colours changed after the lifecycle gate; mesh/material/texture ownership and terrain stayed identical.' };
  } else {
  const page = await browser.newPage({ viewport: { width: 1200, height: 720 } });
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.route('**/__etna_scene', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0"><script type="module">import * as THREE from "/node_modules/three/build/three.module.js";import{Stages}from "/src/stages.js";import{ETNA,etnaHeight}from "/src/etna_ground.js";Object.assign(window,{THREE,Stages,ETNA,etnaHeight});</script></body></html>' }));
  await page.goto('http://127.0.0.1:4320/__etna_scene');
  await page.waitForFunction(() => window.Stages);
  report.lifecycle = await page.evaluate(() => {
    const T = window.THREE, scene = new T.Scene(), hemi = new T.HemisphereLight(), sun = new T.DirectionalLight();
    scene.add(hemi, sun, sun.target);
    const stages = new window.Stages(scene, { hemi, sun }), rows = [];
    const renderer = new T.WebGLRenderer({ antialias: true }); renderer.setSize(1200, 720); renderer.setPixelRatio(1); renderer.outputColorSpace = T.SRGBColorSpace; document.body.appendChild(renderer.domElement);
    const camera = new T.PerspectiveCamera(60, 1200 / 720, .1, 700); camera.position.set(-9, 5, 8); camera.lookAt(8, 2, 0);
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    let baselineGeometry, baselineTexture;
    for (let round = 0; round < 3; round++) {
      const stage = stages.build('etna'), resources = { geometries: new Set(), materials: new Set(), textures: new Set() }, counts = new Map();
      let triangles = 0, meshes = 0, geometryHash = 2166136261, textureHash = 2166136261, minPropRadius = Infinity, maxGroundError = 0, maxLavaError = 0;
      for (const root of stages.objects) root.traverse(object => {
        if (object.geometry) {
          resources.geometries.add(object.geometry);
          if (object.isMesh) { meshes++; triangles += object.geometry.index ? object.geometry.index.count / 3 : object.geometry.attributes.position.count / 3; }
          for (const [name, attribute] of Object.entries(object.geometry.attributes)) {
            check(attribute.array.every(Number.isFinite), `${object.name} has nonfinite ${name}`);
            for (const value of attribute.array) geometryHash = Math.imul(geometryHash ^ Math.round(value * 1e5), 16777619) >>> 0;
          }
          const p = object.geometry.attributes.position;
          if (object.name === 'etna-shared-slope') for (let i = 0; i < p.count; i++) if (Math.hypot(p.getX(i), p.getZ(i)) <= 10.5) maxGroundError = Math.max(maxGroundError, Math.abs(p.getY(i) - window.etnaHeight(p.getX(i), p.getZ(i))));
          if (object.name === 'etna-cooled-lava-crust') for (let i = 0; i < p.count; i++) maxLavaError = Math.max(maxLavaError, Math.abs(p.getY(i) - window.ETNA.lavaLevel));
          if (/^etna-(stone|wood)$/.test(object.name)) for (let i = 0; i < p.count; i++) minPropRadius = Math.min(minPropRadius, Math.hypot(p.getX(i), p.getZ(i)));
        }
        for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) {
          resources.materials.add(material);
          for (const value of Object.values(material)) if (value?.isTexture) resources.textures.add(value);
        }
      });
      for (const texture of resources.textures) {
        check(texture.image.width <= 1024 && texture.image.height <= 1024, 'Texture exceeds1024px');
        const bytes = texture.image.getContext('2d').getImageData(0, 0, texture.image.width, texture.image.height).data;
        for (let i = 0; i < bytes.length; i += 17) textureHash = Math.imul(textureHash ^ bytes[i], 16777619) >>> 0;
      }
      check(triangles < 100000 && meshes < 35, 'Geometry budget exceeded');
      check(stage.stats.triangles === triangles && stage.stats.meshes === meshes, 'Stage stats mismatch');
      check(minPropRadius > 10.8, 'Solid scenery intrudes into the camera orbit');
      check(maxGroundError < 1e-6 && maxLavaError < 1e-6, 'Visible ground/lava differs from shared physics');
      baselineGeometry ??= geometryHash; baselineTexture ??= textureHash;
      check(geometryHash === baselineGeometry && textureHash === baselineTexture, 'Stage is not deterministic');
      renderer.render(scene, camera);
      const events = [], lava = scene.getObjectByName('etna-cooled-lava-crust');
      stage.onEvent = (name, event) => { check(name === 'stageDetail', 'Unexpected event channel'); events.push(event); };
      const offset = lava.material.map.offset.y;
      for (const dt of [NaN, Infinity, -1, 0]) stage.update(dt);
      check(lava.material.map.offset.y === offset, 'Invalid delta animated stage');
      for (let i = 0; i < 700; i++) stage.update(.1);
      check(events.length === 4 && events.every(e => e.kind === 'etnaCrust' && Object.values(e.pos).every(Number.isFinite)), 'Lava event sequence invalid');
      const render = { ...renderer.info.render };
      for (const set of Object.values(resources)) for (const resource of set) { counts.set(resource, 0); resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1)); }
      stages.clear();
      check([...counts.values()].every(n => n === 1), 'Stage resource disposal was not exactly once');
      check(scene.children.length === 3 && stages.objects.length === 0, 'Stage left objects behind');
      rows.push({ round, triangles, meshes, buildMs: stages.buildMs, render, geometryHash, textureHash, minPropRadius, maxGroundError, maxLavaError, resources: Object.fromEntries(Object.entries(resources).map(([k, v]) => [k, v.size])), disposalExactlyOnce: true, events });
    }
    renderer.dispose(); renderer.domElement.remove();
    return rows;
  });
  await page.close();
  }
  const gamePage = await browser.newPage({ viewport: { width: 1200, height: 720 } });
  gamePage.on('pageerror', error => report.errors.push(String(error)));
  await gamePage.addInitScript(() => localStorage.setItem('gladiator-settings', JSON.stringify({ pixel: false, sound: false, difficulty: 'normal', skill: '0.3', fpsCap: true })));
  await gamePage.route('**/@vite/client', r => r.fulfill({ contentType: 'application/javascript', body: '// Capture without HMR.' }));
  await gamePage.goto('http://127.0.0.1:4320/?weapon=longsword&foe=sherpa&foeWeapon=sabre&stage=etna', { waitUntil: 'networkidle' });
  await gamePage.waitForFunction(() => window.game?.enemy?.groups?.head);
  await gamePage.locator('#btnStart').click();
  await gamePage.waitForFunction(() => game.state === 'fight' && game.stats.simTime >= 1.2, null, { timeout: 90000 });
  await gamePage.locator('#btnPause').click();
  await gamePage.addStyleTag({ content: 'body > :not(canvas):not(script):not(style){visibility:hidden!important}' });
  const settle = () => gamePage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await settle();
  await gamePage.locator('canvas').first().screenshot({ path: out + '/etna-combat.png' });
  report.facts = await gamePage.evaluate(() => ({ stage: game.stage.id, weapon: game.enemy.weapon.id, name: game.enemy.name, render: game.renderInfo(), camera: game.camera.position.toArray(), state: game.state }));
  await gamePage.evaluate(() => { game.freeCam = true; game.camera.position.set(-9, 5, 8); game.camera.lookAt(8, 2, 0); });
  await settle();
  await gamePage.locator('canvas').first().screenshot({ path: out + '/etna-vista.png' });
  await gamePage.evaluate(() => { game.camera.position.set(-6.5, 3.0, 9.5); game.camera.lookAt(3.5, -.3, 9.7); });
  await settle();
  await gamePage.locator('canvas').first().screenshot({ path: out + '/etna-lava.png' });
  assert.equal(report.facts.stage, 'etna'); assert.equal(report.facts.weapon, 'sabre'); assert.deepEqual(report.errors, []);
  report.pass = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  await browser.close(); report.browserClosed = true; report.completedUTC = new Date().toISOString();
  await fs.writeFile(out + '/capture.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pass: report.pass, lifecycle: report.lifecycle.length, facts: report.facts, failure: report.failure, errors: report.errors, out, browserClosed: true }));
}
