// Post-integration test of actual Input class with native Chrome touch events.
// First isolates Input on feature-lab's origin, then observes live combat dispatch.
// Usage: node tools/browser/mobile_vertical_probe.mjs http://127.0.0.1:4201/
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = new URL(process.argv[2] || 'http://127.0.0.1:4201/');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) throw Error('This source-module probe requires the local development server');
const out = process.env.HALFSWORD_MOBILE_INPUT_OUT || '/tmp/mobile-vertical-browser.json';
const expectedDefault = Number(process.env.HALFSWORD_MOBILE_GAIN_DEFAULT || '1.35');
const startedAt = new Date();
const phase = process.env.HALFSWORD_MOBILE_PHASE || 'all';
assert.ok(['all', 'live'].includes(phase));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const rows = [], liveRows = [], errors = [];
// Native mobile coordinates have float32 rounding; allow one micrometre of intent.
const toleranceMeters = 1e-6;
const close = (a, b) => assert.ok(Math.abs(a - b) < toleranceMeters, `${a} != ${b}`);

try {
  for (const viewport of phase === 'live' ? [] : [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    for (const query of ['', 'mobileVerticalGain=1', 'mobileVerticalGain=1.35', 'mobileVerticalGain=1.8']) {
      const ctx = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
      try {
        const page = await ctx.newPage();
        page.on('pageerror', e => errors.push(String(e)));
        const url = new URL('feature-lab.html', base); url.search = query;
        await page.goto(url.href, { waitUntil: 'networkidle' });
        // Replace this page's comparison UI with a test canvas; no game instance is loaded.
        await page.evaluate(async () => {
          const { Input } = await import('/src/input.js');
          document.querySelector('meta[name=viewport]')?.setAttribute('content', 'width=device-width,initial-scale=1');
          const canvas = document.createElement('canvas');
          canvas.id = 'inputProbe';
          canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;touch-action:none';
          document.body.replaceChildren(canvas);
          window.mobileInput = new Input(canvas);
          mobileInput.enabled = true;
        });
        const height = await page.evaluate(() => innerHeight);
        const scale = 2.6 / Math.max(320, height);
        const gain = query ? Number(new URLSearchParams(query).get('mobileVerticalGain')) : expectedDefault;
        const cdp = await ctx.newCDPSession(page);
        let stamp = Date.now() / 1000;
        const dispatch = async (type, x, y, ms) => {
          await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y, id: 1 }], timestamp: stamp + ms / 1000 });
          // CDP acknowledgment can precede delivery of the queued pointermove.
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        };
        const consume = () => page.evaluate(() => ({ delta: mobileInput.consumeHandDelta(), taps: mobileInput.consumeTaps(), held: mobileInput.activeTouch !== null }));
        const gesture = async (dx, dy, duration = 250, steps = 4, end = 'touchEnd') => {
          stamp += 1;
          const x = viewport.width * .6, y = viewport.height * .5;
          await dispatch('touchStart', x, y, 0);
          for (let n = 1; n <= steps; n++) await dispatch('touchMove', x + dx * n / steps, y + dy * n / steps, duration * n / (steps + 1));
          const held = await consume();
          await dispatch(end, 0, 0, duration);
          return { held, ended: await consume() };
        };
        const row = { viewport, actualHeight: height, query, expectedGain: gain, gestures: {} };
        for (const [name, dx, dy] of [['horizontal', 54, 0], ['up', 0, -40], ['down', 0, 40], ['diagonal', 24, -32], ['shortUp', 0, -20], ['longUp', 0, -60]]) {
          const got = await gesture(dx, dy);
          close(got.held.delta.x, dx * scale); close(got.held.delta.y, -dy * scale * gain);
          assert.equal(got.held.held, true); assert.equal(got.held.taps, 0);
          assert.equal(got.ended.held, false); assert.equal(got.ended.taps, 0);
          close(Math.hypot(...Object.values(got.ended.delta)), 0);
          row.gestures[name] = got;
        }
        const single = await gesture(0, -40, 250, 1), split = await gesture(0, -40, 250, 12);
        close(single.held.delta.y, split.held.delta.y);
        row.partition = { single, split };
        const nearTap = await gesture(0, 11, 170, 1);
        assert.equal(nearTap.ended.taps, 1); // raw 11px remains below 12px, even with gain
        const shortDrag = await gesture(0, 14, 60, 1);
        assert.equal(shortDrag.ended.taps, 0);
        const cancel = await gesture(0, 0, 80, 1, 'touchCancel');
        assert.equal(cancel.ended.taps, 0); assert.equal(cancel.ended.held, false);
        row.tap = { nearTap, shortDrag, cancel };
        for (const pointerType of ['mouse', 'pen']) {
          const got = await page.evaluate(pointerType => {
            // Exercise unlocked mouse fallback; acquiring pointer lock is a separate path.
            mobileInput.canvas.requestPointerLock = undefined;
            const a = { pointerId: 77, pointerType, button: 0, clientX: 100, clientY: 150, timeStamp: 1 };
            mobileInput.onDown(a);
            mobileInput.onMove({ ...a, clientX: 125, clientY: 130, timeStamp: 301 });
            const d = mobileInput.consumeHandDelta();
            mobileInput.onUp({ ...a, type: 'pointerup', timeStamp: 501 });
            mobileInput.consumeTaps(); return d;
          }, pointerType);
          close(got.x, 25 * scale); close(got.y, 20 * scale);
          row[pointerType + 'SyntheticFallback'] = got;
        }
        rows.push(row);
      } finally { await ctx.close(); }
    }
  }

  // Observe the production instance: original methods execute exactly once.
  // Pending input is sampled before the frame consumes it, and consumed deltas
  // are summed separately from physical handOffset (which has downstream limits).
  const liveContext = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  try {
    const page = await liveContext.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(new URL('feature-lab.html', base).href, { waitUntil: 'networkidle' });
    const bookmarks = await page.evaluate(() => {
      localStorage.setItem('gladiator-settings', JSON.stringify({ skill: '0.7', difficulty: 'hard', moveMode: 'stick', sound: false }));
      return Object.fromEntries(['playMobileLegacy', 'playMobileVertical'].map(id => [id, document.getElementById(id)?.href]));
    });
    const a = new URL(bookmarks.playMobileLegacy), b = new URL(bookmarks.playMobileVertical);
    assert.equal(a.searchParams.get('mobileVerticalGain'), '1'); assert.equal(b.searchParams.get('mobileVerticalGain'), '1.35');
    a.searchParams.delete('mobileVerticalGain'); b.searchParams.delete('mobileVerticalGain');
    assert.equal(a.href, b.href, 'A/B bookmarks differ only in vertical input gain');
    assert.equal(a.searchParams.get('inputComparison'), 'vertical');
    assert.equal(a.searchParams.get('armTrial'), 'legacy'); assert.equal(a.searchParams.get('cutTrial'), 'legacy');
    const install = () => page.evaluate(async () => {
      // Vite's production instance can use ?t= cache tags; match its exact module URL.
      const source = await (await fetch('/src/main.js')).text();
      const specifier = source.match(/import\s*\{[^}]*\bInput\b[^}]*\}\s*from\s*['"]([^'"]+)['"]/)[1];
      const { Input } = await import(new URL(specifier, location.origin + '/src/main.js').href);
      const probe = window.liveMobileProbe = { consumed: [], moves: [] };
      const consume = Input.prototype.consumeHandDelta;
      Input.prototype.consumeHandDelta = function () {
        probe.input = this;
        const delta = consume.call(this);
        if (delta.x || delta.y) probe.consumed.push({ ...delta, simTime: game.stats.simTime });
        return delta;
      };
      const onMove = Input.prototype.onMove;
      Input.prototype.onMove = function (event) {
        const pre = { x: this.handDX, y: this.handDY };
        onMove.call(this, event);
        if (this.enabled && event.pointerType === 'touch' && event.pointerId === this.activeTouch) {
          probe.moves.push({ pre, post: { x: this.handDX, y: this.handDY }, raw: { x: event.clientX, y: event.clientY } });
        }
      };
    });
    const start = async (comparison) => {
      await page.waitForFunction(() => window.game?.player?.sword);
      const menuState = () => page.evaluate(() => ({
        stored: JSON.parse(localStorage.getItem('gladiator-settings')),
        skill: game.player.skill.level, difficulty: game.ai.levelName,
        selected: Object.fromEntries(['skill', 'difficulty'].map(key => [key, document.querySelector(`[data-setting=${key}] button.on`)?.dataset.v])),
        disabled: Object.fromEntries(['skill', 'difficulty'].map(key => [key, [...document.querySelectorAll(`[data-setting=${key}] button`)].every(b => b.disabled)])),
        info: document.getElementById('mobileIntentInfo')?.textContent || '',
        comparison: game.inputComparison,
      }));
      const assertMenu = s => {
        assert.equal(s.stored.skill, '0.7'); assert.equal(s.stored.difficulty, 'hard');
        assert.equal(s.skill, comparison ? 0 : .7); assert.equal(s.difficulty, comparison ? 'normal' : 'hard');
        assert.equal(s.selected.skill, comparison ? '0' : '0.7'); assert.equal(s.selected.difficulty, comparison ? 'normal' : 'hard');
        assert.equal(s.disabled.skill, comparison); assert.equal(s.disabled.difficulty, comparison);
        assert.equal(s.comparison, comparison);
        if (comparison) assert.ok(s.info.includes('보정 끔') && s.info.includes('보통'));
      };
      const beforeToggle = await menuState(); assertMenu(beforeToggle);
      await page.locator('[data-setting=trail]').tap();
      const afterToggle = await menuState(); assertMenu(afterToggle);
      assert.notEqual(afterToggle.stored.trail, beforeToggle.stored.trail);
      await install();
      await page.locator('#btnStart').tap();
      await page.waitForFunction(() => game.state === 'fight' && liveMobileProbe.input);
      const from = await page.evaluate(() => game.stats.simTime);
      await page.waitForFunction(from => game.stats.simTime >= from + .15, from, { timeout: 60000 });
      return { beforeToggle, afterToggle };
    };
    const snapshot = () => page.evaluate(() => {
      const p = liveMobileProbe, input = p.input;
      const finite = f => [...Object.values(f.bodies), f.sword].every(b =>
        [b.translation(), b.rotation(), b.linvel(), b.angvel()].every(v => Object.values(v).every(Number.isFinite)));
      return { url: location.href, simTime: game.stats.simTime, state: game.state, gain: input.mobileIntent?.verticalGain,
        consumed: p.consumed, moves: p.moves, pending: { x: input.handDX, y: input.handDY }, held: input.activeTouch !== null,
        handOffset: game.player.handOffset.toArray(), skill: game.player.skill.level, difficulty: game.ai.levelName,
        armTrial: game.armTrial.model, cutModel: game.combat.cutReactionModel, finite: finite(game.player) && finite(game.enemy) };
    });
    const cdp = await liveContext.newCDPSession(page);
    for (const [name, query, gain, reload] of [
      ['legacy', 'mobileVerticalGain=1', 1, false],
      ['candidate', 'mobileVerticalGain=1.35', 1.35, false],
      ['restartCandidate', 'mobileVerticalGain=1.35', 1.35, true],
      ['defaultReturn', '', expectedDefault, false],
    ]) {
      const comparison = name !== 'defaultReturn';
      const url = comparison ? new URL(name === 'legacy' ? bookmarks.playMobileLegacy : bookmarks.playMobileVertical) : new URL(base);
      if (!comparison) { url.search = ''; url.searchParams.set('weapon', 'sabre'); url.searchParams.set('foe', 'default'); }
      if (reload) await page.reload({ waitUntil: 'networkidle' });
      else await page.goto(url.href, { waitUntil: 'networkidle' });
      const menu = await start(comparison);
      const actualHeight = await page.evaluate(() => innerHeight);
      const row = { name, expectedGain: gain, actualHeight, restart: reload, bookmarkedComparison: comparison, menu, gestures: [] };
      liveRows.push(row);
      for (const dy of [-20, -40, 40]) {
        await page.evaluate(() => { liveMobileProbe.consumed = []; liveMobileProbe.moves = []; });
        const before = await snapshot(), stamp = Date.now() / 1000;
        close(Math.hypot(before.pending.x, before.pending.y), 0);
        const send = (type, points, ms) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points, timestamp: stamp + ms / 1000 });
        await send('touchStart', [{ x: 600, y: 175, id: 1 }], 0);
        for (let n = 1; n <= 4; n++) {
          await send('touchMove', [{ x: 600, y: 175 + dy * n / 4, id: 1 }], n * 50);
          await page.waitForTimeout(50);
        }
        const holding = await snapshot();
        await send('touchEnd', [], 250);
        await page.waitForFunction(from => game.stats.simTime >= from + .15 && liveMobileProbe.input.activeTouch === null, holding.simTime, { timeout: 60000 });
        const after = await snapshot();
        close(after.gain, gain); assert.equal(holding.held, true); assert.equal(after.held, false);
        assert.equal(after.skill, comparison ? 0 : .7); assert.equal(after.difficulty, comparison ? 'normal' : 'hard');
        if (comparison) { assert.equal(after.armTrial, 'legacy'); assert.equal(after.cutModel, 'legacy'); }
        assert.ok(after.simTime > before.simTime && after.finite);
        close(after.consumed.reduce((sum, d) => sum + d.x, after.pending.x), 0);
        close(after.consumed.reduce((sum, d) => sum + d.y, after.pending.y), -dy * 2.6 / Math.max(320, actualHeight) * gain);
        assert.ok(after.moves.length > 0 && after.moves.some(m => m.post.y !== m.pre.y));
        row.gestures.push({ dy, requestedDurationMs: 250, before, holding, after });
      }
    }
  } finally { await liveContext.close(); }
  assert.deepEqual(errors, []);
  console.log(`Mobile vertical browser: ${rows.length} isolated viewport/URL conditions + ${liveRows.length} live/restart/default-return conditions PASS`);
} finally {
  const finishedAt = new Date();
  await writeFile(out, JSON.stringify({ rows, liveRows, errors, phase, toleranceMeters,
    startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), wallTimeMs: finishedAt - startedAt,
    runtimeIntegrationRequired: true, scope: 'Actual Input mapping and live world advance; native touch and synthetic mouse/pen fallback; no physical quality claim' }, null, 2));
  await browser.close();
}
