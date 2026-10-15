// Actual game captures and floor sampling. Same inspection camera before/after;
// no extra geometry or retouching. Use a dev server (THREE is exposed by game).
// node tools/browser/stage_area_probe.mjs URL OUT [stage,stage,...]
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4190';
const out = process.argv[3] || '/tmp/stage-area';
const ids = (process.argv[4] || 'poseidon,clearing,temple,castle,cathedral,loggia,corsair,sacred_grove,frozen_bay,qinglan,sluice,dunhuang,etna,dayr,poseidon_night,clearing_a,clearing_a_dry,darkhall').split(',');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const rows = [];
try {
  for (const id of ids) {
    const page = await browser.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.clock.install({ time: new Date('2026-10-16T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-16T12:00:01Z'));
    await page.goto(`${base}/?stage=${id}&weapon=longsword&foe=default&emo=0`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
    await page.evaluate(() => {
      game.freeCam = true;
      game.camera.position.set(0, 24, 16);
      game.camera.lookAt(0, 0, 0);
      game.camera.fov = 50;
      game.camera.updateProjectionMatrix();
      game.renderCap.tick = () => true;
    });
    await page.addStyleTag({ content: 'body > :not(canvas) { visibility: hidden !important; }' });
    await page.clock.runFor(32);
    const row = await page.evaluate(() => {
      const T = game.THREE, radius = game.config.ARENA.radius;
      const fighters = new Set();
      for (const root of game.fighterMeshes) root.traverse(o => fighters.add(o));
      const meshes = [];
      game.scene.updateMatrixWorld(true);
      game.scene.traverse(o => { if (o.isMesh && !fighters.has(o) && o.visible) meshes.push(o); });
      const ray = new T.Raycaster(), missing = [], raised = [];
      let sampled = 0;
      for (const r of [6, radius - 1, radius - 0.15]) for (let i = 0; i < 32; i++) {
        const a = i * Math.PI / 16, x = Math.cos(a) * r, z = Math.sin(a) * r;
        const y = game.terrain?.heightAt(x, z) ?? 0;
        ray.set(new T.Vector3(x, y + 0.2, z), new T.Vector3(0, -1, 0));
        ray.far = 0.4;
        const floor = ray.intersectObjects(meshes, false).find(h => h.face?.normal.y > 0.35 || Math.abs(h.point.y - y) < 0.08);
        if (!floor) missing.push({ x, z, y });
        ray.set(new T.Vector3(x, y + 1.8, z), new T.Vector3(0, -1, 0));
        ray.far = 1.55;
        const hit = ray.intersectObjects(meshes, false).find(h => {
          const m = h.object.material;
          return !m.transparent && h.object.name !== 'etna-cooled-lava-crust'; // 빛줄기·용암면은 장애물이 아님
        });
        if (hit) raised.push({ x, z, height: hit.point.y - y, mesh: hit.object.name });
        sampled++;
      }
      // Actual main.js colliders: the old wall must be gone and the new wall
      // must close the ring, including segment joins. Ray height follows Etna.
      const walls = [];
      game.world.colliders.forEach(c => {
        const p = c.translation();
        if (c.parent()?.isFixed() && Math.abs(Math.hypot(p.x, p.z) - radius - 0.25) < 0.001) walls.push(c);
      });
      const wallFailures = [];
      for (let i = 0; i < 128; i++) {
        const a = i * Math.PI / 64, x = Math.cos(a), z = Math.sin(a);
        const y = (game.terrain?.heightAt(x * radius, z * radius) ?? 0) + 0.4;
        const ray = { origin: { x: 0, y, z: 0 }, dir: { x, y: 0, z } };
        const hits = walls.map(c => c.castRay(ray, radius + 2, true)).filter(t => t >= 0);
        const distance = Math.min(...hits);
        if (!(distance > radius && distance < radius + 0.15)) wallFailures.push({ a, distance });
      }
      return { stage: game.stage.id, radius, area: Math.PI * radius ** 2, sampled, missing, raised, wallCount: walls.length, wallFailures,
        startGap: game.config.ARENA.startGap, render: game.renderInfo() };
    });
    await page.screenshot({ path: `${out}/${id}.png`, timeout: 120000 });
    rows.push({ ...row, errors });
    fs.writeFileSync(`${out}/report.json`, JSON.stringify(rows, null, 2) + '\n');
    console.log(JSON.stringify({ stage: row.stage, radius: row.radius, missing: row.missing.length, raised: row.raised.length, errors }));
    await page.close();
  }
} finally { await browser.close(); }
if (rows.some(r => r.errors.length || r.missing.length || r.raised.length || r.wallCount !== 32 || r.wallFailures.length)) process.exitCode = 1;
