// 기력 UI/게임 연결: 가짜 시계로 물리 시간을 진행. 중간 GPU 그리기만 생략하고 사진 때 실제로 그린다.
// PW_CHROMIUM=/usr/bin/chromium node tools/browser/stamina_smoke.mjs http://127.0.0.1:5173 /tmp/stamina-shots
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:5173';
const out = process.argv[3] || '/tmp/stamina-shots';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', r => errors.push(r.url()));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.clock.install({ time: new Date('2026-10-15T06:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-15T06:00:01Z'));
  await page.goto(`${base}/?weapon=longsword&foe=default&stage=castle&emo=0`, { waitUntil: 'networkidle' });
  assert.ok(await page.evaluate(() => !!window.game?.player));
  await page.evaluate(() => {
    game.renderCap.tick = () => false;
    document.getElementById('btnStart').click();
    // UI/입력 검사를 위해 상대 AI만 멈춰 피격으로 검사가 끝나지 않게 한다.
    game.ai.update = () => {};
  });
  await page.clock.runFor(2300);
  const snapshot = () => page.evaluate(() => ({
    state: game.state, sim: game.stats.simTime,
    value: game.player.stamina.value, power: game.player.stamina.power,
    activity: game.player.stamina.action, rest: game.player.stamina.rest,
    guard: game.playerGuard.active, move: game.player.move.toArray(),
    spent: { ...game.player.stamina.spent },
    bars: [...document.querySelectorAll('.stamina-bar')].map(el => ({
      hidden: el.hidden, color: getComputedStyle(el.firstElementChild).backgroundColor,
      width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height,
      x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y,
      value: el.getAttribute('aria-valuenow'), exhausted: el.dataset.exhausted,
    })),
    messageColor: getComputedStyle(document.querySelector('#guardName b')).color,
  }));
  let s = await snapshot();
  assert.equal(s.state, 'fight');
  assert.equal(s.bars.length, 2);
  assert.ok(s.bars.every(b => !b.hidden), JSON.stringify(s));
  assert.ok(s.bars.every(b => b.color === s.messageColor && b.height === 3 && b.width === 56));
  results.push({ check: 'bar placement and shared beige', ...s });

  await page.keyboard.down('KeyD');
  await page.clock.runFor(800);
  await page.keyboard.up('KeyD');
  s = await snapshot();
  assert.ok(s.spent.move > 0 && s.value < 100);
  results.push({ check: 'movement', ...s });

  const beforeBlock = s.spent.block;
  const beforeAttack = s.spent.attack;
  await page.keyboard.down('KeyF');
  await page.clock.runFor(700);
  await page.keyboard.up('KeyF');
  s = await snapshot();
  assert.ok(s.spent.block > beforeBlock);
  assert.equal(s.spent.attack, beforeAttack);
  results.push({ check: 'guard costs only block', ...s });

  // 실제 터치 사건을 게임 입력 처리기로 보내 찌른다.
  await page.evaluate(() => {
    const canvas = document.getElementById('game');
    const o = { pointerId: 81, pointerType: 'touch', clientX: 620, clientY: 160, bubbles: true, isPrimary: true, button: 0 };
    canvas.dispatchEvent(new PointerEvent('pointerdown', o));
    window.dispatchEvent(new PointerEvent('pointerup', o));
  });
  await page.clock.runFor(600);
  s = await snapshot();
  assert.ok(s.spent.attack > beforeAttack);
  results.push({ check: 'touch attack', ...s });

  // 긴 연타 대신 잔량만 준비한다. 고갈 판정·효과·회복은 실제 물리 스텝을 거친다.
  await page.evaluate(() => { game.player.stamina.value = 0.01; });
  await page.keyboard.down('KeyF');
  await page.clock.runFor(350);
  await page.keyboard.up('KeyF');
  s = await snapshot();
  assert.equal(s.value, 0);
  assert.equal(s.power, 0.6);
  assert.equal(s.bars[0].exhausted, 'true');
  results.push({ check: 'exhaustion', ...s });
  await page.evaluate(() => { game.renderCap.tick = () => true; });
  await page.clock.runFor(17);
  await page.screenshot({ path: `${out}/exhausted-landscape.png` });
  await page.evaluate(() => { game.renderCap.tick = () => false; });
  // 칼이 맞닿아 버티는 중은 휴식이 아니다. 실제 후퇴 입력으로 떨어진 뒤 쉰다.
  await page.keyboard.down('KeyS');
  await page.clock.runFor(2000);
  await page.keyboard.up('KeyS');
  await page.clock.runFor(4000);
  s = await snapshot();
  results.push({ check: 'rest recovery', ...s });
  assert.ok(s.value >= 20 && s.power === 1, JSON.stringify(s));

  await page.keyboard.press('KeyP');
  await page.clock.runFor(32);
  s = await snapshot();
  const pausedValue = s.value;
  assert.equal(s.state, 'paused');
  assert.ok(s.bars.every(b => b.hidden));
  await page.clock.runFor(1500);
  assert.equal((await snapshot()).value, pausedValue);
  results.push({ check: 'pause freezes stamina and hides bars', ...s });
  await page.evaluate(() => document.getElementById('btnStart').click());
  await page.clock.runFor(32);
  assert.ok((await snapshot()).value > 99);
  assert.equal(await page.locator('.stamina-bar').count(), 2);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { game.ai.update = () => {}; game.renderCap.tick = () => true; });
  await page.clock.runFor(32);
  s = await snapshot();
  assert.ok(s.bars.every(b => !b.hidden && b.x >= 0 && b.x + b.width <= 390 && b.height === 3), JSON.stringify(s));
  assert.ok(await page.locator('#rotate').isVisible());
  await page.screenshot({ path: `${out}/full-portrait.png` });
  results.push({ check: 'restart and portrait rotation prompt', ...s });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.clock.runFor(32);
  assert.ok(!(await page.locator('#rotate').isVisible()));
  await page.screenshot({ path: `${out}/full-landscape.png` });
  assert.deepEqual(errors, []);
} finally {
  fs.writeFileSync(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
  await browser.close();
}
console.log(`PASS ${results.length} browser checks; errors ${errors.length}`);
