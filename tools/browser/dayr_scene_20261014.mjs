// Standalone Dayr rendering/lifecycle gate; does not exercise combat or claim
// physical-phone performance. Requires the project's running Vite server.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs';

const base = process.argv[2] || 'http://127.0.0.1:4320/';
const output = process.argv[3] || '/tmp/halfsword-dayr-scene-20261014';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Local scene gate only');
assert(output.startsWith('/tmp/'));
await fs.mkdir(output, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { pass: false, errors: [], source: {}, rounds: [], limitations: ['Standalone scene: combat, mobile input and physical-phone performance are not covered.'] };
for (const name of ['src/stage_dayr.js', 'src/stage_kit.js', 'src/stages.js']) report.source[name] = hash(await fs.readFile(name));
report.toolSha256 = hash(await fs.readFile(new URL(import.meta.url)));
let browser;
try {
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-background-networking'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', error => report.errors.push(error.message));
  await page.route('**/__dayr_scene', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0"><script type="module">import * as THREE from "/node_modules/three/build/three.module.js";import{Stages}from "/src/stages.js";window.THREE=THREE;window.Stages=Stages;</script></body></html>' }));
  await page.goto(new URL('__dayr_scene', base).href);
  await page.waitForFunction(() => window.Stages);
  report.rounds = await page.evaluate(() => {
    const T = window.THREE, scene = new T.Scene();
    const hemi = new T.HemisphereLight(), sun = new T.DirectionalLight(); scene.add(hemi, sun, sun.target);
    const stages = new window.Stages(scene, { hemi, sun }), rows = [];
    const renderer = new T.WebGLRenderer({ antialias: true }); renderer.setSize(1400, 900); renderer.setPixelRatio(1); renderer.outputColorSpace = T.SRGBColorSpace; document.body.appendChild(renderer.domElement);
    const camera = new T.PerspectiveCamera(60, 1400 / 900, .1, 700); camera.position.set(-9, 2.7, 0); camera.lookAt(10, 3.2, 0);
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    let baselineHash;
    for (let round = 0; round < 3; round++) {
      const stage = stages.build('dayr'), resources = { geometries: new Set(), materials: new Set(), textures: new Set() }, counts = new Map();
      let triangles = 0, meshCount = 0, geometryHash = 2166136261, minPropRadius = Infinity;
      for (const root of stages.objects) root.traverse(object => {
        if (object.geometry) {
          resources.geometries.add(object.geometry);
          if (object.isMesh) { meshCount++; triangles += object.geometry.index ? object.geometry.index.count / 3 : object.geometry.attributes.position.count / 3; }
          for (const [name, attribute] of Object.entries(object.geometry.attributes)) {
            check(attribute.array.every(Number.isFinite), `${object.name} has nonfinite ${name}`);
            if (name === 'position' || name === 'color') for (const value of attribute.array) geometryHash = Math.imul(geometryHash ^ Math.round(value * 1e5), 16777619) >>> 0;
          }
          if (object.name === 'dayr-floor') check(object.geometry.attributes.position.array.every((value, i) => i % 3 !== 1 || Math.abs(value) < 1e-6), 'Duel floor must remain y=0');
          if (/^dayr-(brick|trim|wood|pot|rubble|leaf)$/.test(object.name)) {
            const p = object.geometry.attributes.position;
            for (let i = 0; i < p.count; i++) minPropRadius = Math.min(minPropRadius, Math.hypot(p.getX(i), p.getZ(i)));
          }
        }
        for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) {
          resources.materials.add(material);
          for (const value of Object.values(material)) if (value?.isTexture) resources.textures.add(value);
        }
      });
      check(triangles < 120000 && meshCount < 25, 'Stage geometry/draw budget exceeded');
      check(stage.stats.triangles === triangles && stage.stats.meshes === meshCount, 'Reported geometry statistics differ');
      check(minPropRadius > 10.5, 'Scenery intrudes into clear camera orbit');
      check([...resources.textures].every(t => t.image.width <= 1024 && t.image.height <= 1024), 'Texture exceeds budget');
      baselineHash ??= geometryHash; check(baselineHash === geometryHash, 'Geometry/vertex colors changed between rebuilds');
      renderer.render(scene, camera);
      const ray = new T.Raycaster(new T.Vector3(-9, 2.7, 0), new T.Vector3(1, 0, 0));
      check(ray.intersectObject(scene.getObjectByName('dayr-brick')).length === 0, 'Gate blocks the low-camera desert sightline');
      const events = [], rope = scene.getObjectByName('dayr-well-rope');
      stage.onEvent = (name, event) => { check(name === 'stageDetail', 'Unexpected event channel'); check(Math.abs(rope.rotation.z - .032) < .00002, 'Ring cue missed sway peak'); events.push(event); };
      const initialAngle = rope.rotation.z; for (const dt of [NaN, Infinity, -1, 0]) stage.update(dt); check(rope.rotation.z === initialAngle, 'Invalid delta changed the animation');
      for (let i = 0; i < 1200; i++) stage.update(.1);
      check(events.length === 4 && events.every(e => e.kind === 'caravanRing' && e.amp === .75 && [e.pos.x, e.pos.y, e.pos.z].every(Number.isFinite)), 'Ring cue sequence invalid');
      check(events.every((e, i) => i === 0 ? e.time >= 11 && e.time < 11.2 : e.time - events[i - 1].time > 32.9 && e.time - events[i - 1].time < 33.2), 'Ring cue timing changed');
      const render = { ...renderer.info.render };
      for (const set of Object.values(resources)) for (const resource of set) { counts.set(resource, 0); resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1)); }
      stages.clear();
      check([...counts.values()].every(n => n === 1), 'A stage resource was leaked or disposed more than once');
      check(scene.children.length === 3 && stages.objects.length === 0, 'Stage left scene objects after clear');
      rows.push({ round, buildMs: stages.buildMs, triangles, meshCount, render, geometryHash, minPropRadius, resources: Object.fromEntries(Object.entries(resources).map(([name, set]) => [name, set.size])), disposalExactlyOnce: true, eventTimes: events.map(e => e.time), eventPosition: events[0].pos });
    }
    stages.build('dayr'); renderer.render(scene, camera); window.dayrView = { scene, renderer, camera, stages };
    return rows;
  });
  await page.screenshot({ path: `${output}/low-camera.png` });
  await page.evaluate(() => { const { scene, renderer, camera } = window.dayrView; camera.position.set(-28, 19, 24); camera.lookAt(4, 3, 0); renderer.render(scene, camera); });
  await page.screenshot({ path: `${output}/overview.png` });
  await page.evaluate(() => { const { scene, renderer, camera } = window.dayrView; camera.position.set(7, 2.3, 9); camera.lookAt(18, 5, 0); renderer.render(scene, camera); });
  await page.screenshot({ path: `${output}/vault-depth.png` });
  assert.deepEqual(report.errors, []); report.pass = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  if (browser) await browser.close();
  report.completedUTC = new Date().toISOString(); await fs.writeFile(`${output}/result.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ pass: report.pass, rounds: report.rounds.length, triangles: report.rounds[0]?.triangles, meshes: report.rounds[0]?.meshCount, failure: report.failure, output }));
}
