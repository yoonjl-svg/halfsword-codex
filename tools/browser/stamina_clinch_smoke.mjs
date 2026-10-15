// 준비한 스틱 입력으로 실제 게임의 밀기·접촉·기력·HUD를 검증하고 촬영한다.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:4173';
const out = process.argv[3] ?? '/tmp/stamina-clinch-browser';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [], results = [];
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', r => errors.push(r.url()));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.clock.install({ time: new Date('2026-10-15T10:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-15T10:00:01Z'));
  await page.goto(`${base}/?weapon=longsword&foe=default&stage=castle&emo=0&uniqueStage=0`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { game.renderCap.tick = () => false; game.config.ARENA.startGap = 1.6; document.getElementById('btnStart').click(); });
  for (let i = 0; i < 90 && !(await page.evaluate(() => game.state === 'fight')); i++) await page.clock.runFor(16);
  assert.equal(await page.evaluate(() => game.state), 'fight');
  await page.evaluate(() => {
    const fs = [game.player, game.enemy];
    fs.forEach(f => { f.canShove = true; });
    const fixture = window.clinchFixture = { phase: 'approach', releaseAt: null, pressAt: null, release: false };
    game.ai.update = dt => {
      const t = fs[0].fightT;
      if (t > 2 && fixture.phase === 'approach' && fs[0].foeDistance() < 0.7) { fixture.phase = 'release'; fixture.releaseAt = t; }
      if (fixture.phase === 'release' && t - fixture.releaseAt > 0.15) { fixture.phase = 'press'; fixture.pressAt = t; }
      if (fixture.release || fs.some(f => f.stamina.exhausted)) fixture.phase = 'after';
      for (const f of fs) {
        const v = t < 2 ? 0 : ['approach', 'press'].includes(fixture.phase) ? 1 : 0;
        f.move.set(0, v); f.stickX = 0; f.stickY = v;
        const off = f.handOffset, dx = 0.18 - off.x, dy = -0.28 - off.y;
        const k = Math.min(1, dt / Math.max(Math.hypot(dx, dy), 1e-9));
        off.x += dx * k; off.y += dy * k;
      }
    };
  });
  const snap = () => page.evaluate(() => ({ sim: game.player.fightT, phase: clinchFixture.phase,
    fighters: [game.player, game.enemy].map(f => ({ value: f.stamina.value, cost: f.stamina.spent.clinch, seconds: f.stamina.clinchSeconds, recovered: f.stamina.recovered, walking: f.stamina.spent.move, active: f.stamina.clinching, exhausted: f.stamina.exhausted, left: f.stamina.exhaustLeft, barge: f.barge?.phase, state: f.state })),
    bars: [...document.querySelectorAll('.stamina-bar')].map(el => ({ hidden: el.hidden, fill: el.firstElementChild.style.transform, value: el.getAttribute('aria-valuenow'), x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y })) }));
  const shot = async name => {
    await page.evaluate(() => {
      // 두 검객이 돌아도 양쪽 바를 함께 볼 수 있도록 같은 상대 각도의 측면 관찰 카메라.
      const a = game.player.bodies.chest.translation(), b = game.enemy.bodies.chest.translation();
      const dx = b.x - a.x, dz = b.z - a.z, n = Math.max(1e-6, Math.hypot(dx, dz));
      const x = (a.x + b.x) / 2, z = (a.z + b.z) / 2;
      game.freeCam = true;
      game.camera.position.set(x + (-dz * 2.3 + dx * 0.1) / n, 1.55, z + (dx * 2.3 + dz * 0.1) / n);
      game.camera.lookAt(x, 1.0, z);
      game.renderCap.tick = () => true;
    });
    await page.clock.runFor(32);
    await page.screenshot({ path: `${out}/${name}.png` });
    await page.evaluate(() => { game.renderCap.tick = () => false; });
    return snap();
  };
  let s;
  for (let i = 0; i < 140; i++) { await page.clock.runFor(50); s = await snap(); if (s.fighters.every(f => f.active)) break; }
  assert.ok(s.fighters.every(f => f.active), JSON.stringify(s));
  results.push({ check: 'actual press and contact start one shared drain', ...s });
  await page.evaluate(() => {
    [game.player, game.enemy].forEach(f => { f.stamina.value = 80; f.stamina.rest = 0; });
  });
  const before = await shot('clinch-before');
  results.push({ check: 'before capture', ...before });
  await page.clock.runFor(2000);
  const after = await shot('clinch-after');
  const delta = after.fighters.map((f, i) => f.cost - before.fighters[i].cost);
  assert.ok(delta[0] > 15 && Math.abs(delta[0] - delta[1]) < 1e-8, JSON.stringify({ before, after }));
  for (let i = 0; i < 2; i++) {
    const a = before.fighters[i], b = after.fighters[i];
    assert.ok(Math.abs(a.value - b.value - delta[i]) < 1e-6);
    assert.equal(a.recovered, b.recovered); assert.equal(a.walking, b.walking);
    assert.ok(Math.abs(delta[i] - (b.seconds - a.seconds) * 10) < 1e-6);
  }
  assert.ok(after.bars.every(b => !b.hidden));
  results.push({ check: 'both meters continuously lose the same ten per contact second', delta, ...after });
  await page.locator('#btnPause').click(); await page.clock.runFor(32);
  const paused = await snap(); await page.clock.runFor(500); s = await snap();
  assert.deepEqual(s.fighters, paused.fighters);
  results.push({ check: 'pause stops clinch drain', ...s });
  await page.locator('#btnResume').click(); await page.clock.runFor(32);
  await page.evaluate(() => { game.player.stamina.value = 50; game.enemy.stamina.value = -49.5; game.ai.mode = 'defend'; game.ai.defVoid = false; });
  for (let i = 0; i < 60; i++) { await page.clock.runFor(16); s = await snap(); if (s.fighters[1].exhausted) break; }
  assert.ok(s.fighters[1].exhausted, JSON.stringify(s));
  assert.ok(s.fighters.every(f => !f.active));
  results.push({ check: 'clinch exhausts one fighter and stops paired drain', ...s });
  const spent = s.fighters.map(f => f.cost);
  await page.clock.runFor(400); results.push({ check: 'exhaustion capture', ...await shot('clinch-exhaustion') });
  await page.clock.runFor(2200); s = await snap();
  assert.equal(s.fighters[1].exhausted, false); assert.ok(Math.abs(s.fighters[1].value) < 1e-7);
  assert.deepEqual(s.fighters.map(f => f.cost), spent);
  results.push({ check: 'held AI defense cannot stop forced recovery to zero', ...s });
  assert.deepEqual(errors, []);
} finally {
  fs.writeFileSync(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
  await browser.close();
}
console.log(`PASS ${results.length} clinch browser checks; errors ${errors.length}`);
