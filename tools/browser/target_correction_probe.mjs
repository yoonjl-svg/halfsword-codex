// Local runtime contract verification; internal URLs, never public recommendations.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = new URL(process.argv[2] || 'http://127.0.0.1:4201/');
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw Error('Internal candidate: use a local server');
const out = process.env.TARGET_CORRECTION_OUT || '/tmp/target-correction-browser.json';
const phase = process.env.TARGET_CORRECTION_PHASE || 'full';
assert.ok(['full', 'production-min'].includes(phase));
const files = ['src/main.js', 'src/target_correction_trial.js', 'src/skill.js', 'src/input.js', 'src/fighter.js', 'src/config.js'];
const hashes = async () => Object.fromEntries(await Promise.all(files.map(async p => [p, createHash('sha256').update(await readFile(p)).digest('hex')])));
const before = await hashes(), started = new Date(), rows = [], errors = [];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(String(e)));
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
const query = (weapon, model) => new URLSearchParams({ weapon, foeWeapon: 'longsword', foe: 'default', supportProbe: '1', assist: '.3', catch: 'on', catchScale: '1', armTrial: 'legacy', cutTrial: 'legacy', targetCorrection: model });
const layout = () => page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth }));
const assertLayout = r => assert.ok(r.scrollWidth <= r.width + 1 && r.bodyScrollWidth <= r.width + 1);
const snap = () => page.evaluate(() => {
  const g = game, p = g.player;
  const finite = f => [...Object.values(f.bodies), f.sword].every(b => [b.translation(), b.rotation(), b.linvel(), b.angvel()].every(v => Object.values(v).every(Number.isFinite)));
  return { url: location.href, state: g.state, simTime: g.stats.simTime, trial: g.targetCorrectionTrial,
    level: p.skill.level, autoGuard: p.skill.autoGuard, difficulty: g.ai.levelName, enemyLevel: g.enemy.skill.level,
    saved: JSON.parse(localStorage.getItem('gladiator-settings')), settings: { skill: g.settings.skill, difficulty: g.settings.difficulty },
    ui: Object.fromEntries(['skill', 'difficulty'].map(k => [k, { selected: document.querySelector(`[data-setting=${k}] button.on`)?.dataset.v, locked: [...document.querySelectorAll(`[data-setting=${k}] button`)].every(b => b.disabled) }])),
    weapon: p.weapon.id, arm: g.armTrial.model, cut: g.combat.cutReactionModel, grip: g.config.GRIP.reactionModel, support: g.config.BODY.supportModel,
    assist: g.config.GAIT.assist, catchMode: g.config.GAIT.catchMode, catchScale: g.config.GAIT.catchScale,
    held: p.handHeld, inputActive: p.inputActive, handOffset: p.handOffset.toArray(), thrusts: p.skill.thrusts,
    finite: finite(p) && finite(g.enemy), info: document.getElementById('targetCorrectionTrialInfo')?.textContent || '',
    firstController: window.targetProbe?.controllerFirst || [], firstWorld: window.targetProbe?.worldFirst || [] };
});
const install = () => page.evaluate(() => {
  const probe = window.targetProbe = { controllerFirst: [], worldFirst: [] };
  const seenPlayer = new WeakSet(), seenWorld = new WeakSet();
  const record = () => ({ level: game.player.skill.level, autoGuard: game.player.skill.autoGuard, difficulty: game.ai.levelName, enemyLevel: game.enemy.skill.level, simTime: game.stats.simTime, state: game.state });
  const playerProto = Object.getPrototypeOf(game.player), playerStep = playerProto.step;
  playerProto.step = function (...args) {
    if (this === game.player && !seenPlayer.has(this)) { seenPlayer.add(this); probe.controllerFirst.push(record()); }
    return playerStep.apply(this, args);
  };
  const worldProto = Object.getPrototypeOf(game.world), worldStep = worldProto.step;
  worldProto.step = function (...args) {
    if (this === game.world && !seenWorld.has(this)) { seenWorld.add(this); probe.worldFirst.push(record()); }
    return worldStep.apply(this, args);
  };
});
const assertPreferences = s => {
  assert.equal(s.saved.skill, '0.7'); assert.equal(s.saved.difficulty, 'hard');
  assert.deepEqual(s.settings, { skill: '0.7', difficulty: 'hard' });
};
const assertTrial = (s, weapon, model) => {
  assertPreferences(s); assert.equal(s.trial.active, true); assert.equal(s.trial.model, model);
  assert.equal(s.level, model === 'none' ? 0 : .4); assert.equal(s.autoGuard, model === 'weak');
  assert.equal(s.difficulty, 'normal'); assert.equal(s.enemyLevel, .7);
  assert.equal(s.ui.skill.selected, model === 'none' ? '0' : '0.4'); assert.equal(s.ui.skill.locked, true); assert.equal(s.ui.difficulty.locked, true);
  assert.equal(s.weapon, weapon); assert.equal(s.arm, 'legacy'); assert.equal(s.cut, 'legacy'); assert.equal(s.grip, 'paired'); assert.equal(s.support, 'legacy');
  assert.equal(s.assist, .3); assert.equal(s.catchMode, 'on'); assert.equal(s.catchScale, 1); assert.ok(s.finite && s.info.includes('비교 후보'));
  for (const first of [...s.firstController, ...s.firstWorld]) { assert.equal(first.level, s.level); assert.equal(first.autoGuard, s.autoGuard); assert.equal(first.difficulty, 'normal'); assert.equal(first.enemyLevel, .7); }
};
const start = async () => {
  await page.locator('#btnStart').tap();
  await page.waitForFunction(() => game.state === 'fight' && targetProbe.worldFirst.length > 0);
  const from = await page.evaluate(() => game.stats.simTime);
  await page.waitForFunction(from => game.stats.simTime > from + .1, from, { timeout: 60000 });
};
const nativeInputs = async () => {
  const cdp = await ctx.newCDPSession(page);
  const dispatch = (type, points, stamp) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points, timestamp: stamp });
  const point = (x, y) => [{ x, y, id: 1 }];
  const beforeTap = await snap(), stamp = Date.now() / 1000;
  await dispatch('touchStart', point(620, 170), stamp);
  await dispatch('touchEnd', [], stamp + .08);
  await page.waitForFunction(n => game.player.skill.thrusts === n + 1, beforeTap.thrusts, { timeout: 10000 });
  const tap = await snap();
  await page.waitForFunction(() => !game.player.skill.tap, null, { timeout: 60000 });
  const beforeDrag = await snap(), t = Date.now() / 1000;
  await dispatch('touchStart', point(620, 170), t);
  await page.waitForFunction(() => game.player.handHeld);
  for (let n = 1; n <= 3; n++) { await dispatch('touchMove', point(620 + 8 * n, 170 - 6 * n), t + n * .06); await page.waitForTimeout(60); }
  const drag = await snap();
  await dispatch('touchEnd', [], t + .25);
  await page.waitForFunction(() => !game.player.handHeld);
  const released = await snap();
  const t2 = Date.now() / 1000;
  await dispatch('touchStart', point(644, 152), t2); await page.waitForFunction(() => game.player.handHeld);
  await dispatch('touchMove', point(636, 164), t2 + .10); await page.waitForTimeout(120);
  const reinput = await snap();
  await dispatch('touchEnd', [], t2 + .25); await page.waitForFunction(() => !game.player.handHeld);
  const final = await snap();
  assert.equal(drag.held, true); assert.equal(reinput.held, true); assert.equal(released.held, false); assert.equal(final.held, false);
  assert.equal(final.thrusts, beforeDrag.thrusts); assert.ok(final.simTime > beforeDrag.simTime && final.finite);
  assert.ok(Math.hypot(...drag.handOffset.map((v, i) => v - beforeDrag.handOffset[i])) > 1e-5);
  await cdp.detach();
  return { beforeTap, tap, beforeDrag, drag, released, reinput, final };
};
try {
  await page.goto(new URL('feature-lab.html', base).href, { waitUntil: 'networkidle' });
  const landing = await layout(); assertLayout(landing);
  assert.equal(await page.locator('#target-correction-comparison a[href*="targetCorrection="]').count(), 4);
  const links = await page.evaluate(() => Object.fromEntries(['Sabre', 'Zwei'].flatMap(weapon => ['Weak', 'None'].map(mode => {
    const id = 'playCorrection' + weapon + mode;
    return [id, document.getElementById(id).href];
  }))));
  for (const weapon of ['Sabre', 'Zwei']) {
    const a = new URL(links['playCorrection' + weapon + 'Weak']), b = new URL(links['playCorrection' + weapon + 'None']);
    assert.equal(a.searchParams.get('targetCorrection'), 'weak'); assert.equal(b.searchParams.get('targetCorrection'), 'none');
    a.searchParams.delete('targetCorrection'); b.searchParams.delete('targetCorrection'); assert.equal(a.href, b.href);
  }
  await page.evaluate(() => localStorage.setItem('gladiator-settings', JSON.stringify({ skill: '0.7', difficulty: 'hard', moveMode: 'stick', sound: false })));
  for (const weapon of phase === 'production-min' ? ['sabre'] : ['sabre', 'zweihander']) for (const model of ['none', 'weak']) {
    await page.setViewportSize({ width: 390, height: 844 });
    const url = new URL(links['playCorrection' + (weapon === 'sabre' ? 'Sabre' : 'Zwei') + (model === 'none' ? 'None' : 'Weak')]);
    await page.goto(url.href, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.game?.player?.sword);
    const row = { weapon, model, technicalURL: url.href, landing, portrait: await layout(), menu: await snap() }; rows.push(row);
    assertLayout(row.portrait); assertTrial(row.menu, weapon, model);
    await page.setViewportSize({ width: 844, height: 390 }); assertLayout(await layout());
    await page.locator('[data-setting=trail]').tap(); row.afterPreferenceToggle = await snap(); assertTrial(row.afterPreferenceToggle, weapon, model);
    await install(); await start(); row.started = await snap(); assertTrial(row.started, weapon, model);
    assert.equal(row.started.firstController.length, 1); assert.equal(row.started.firstWorld.length, 1);
    row.native = await nativeInputs(); assertTrial(row.native.final, weapon, model);
    await page.locator('#btnPause').tap(); await page.waitForFunction(() => game.state === 'paused');
    await start(); await page.waitForFunction(() => targetProbe.worldFirst.length === 2); row.newRound = await snap(); assertTrial(row.newRound, weapon, model);
    assert.equal(row.newRound.firstController.length, 2);
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.game?.player?.sword);
    await install(); await start(); row.reload = await snap(); assertTrial(row.reload, weapon, model);
  }
  if (phase === 'full') {
  const conflictURL = new URL(base); conflictURL.search = query('sabre', 'weak').toString(); conflictURL.searchParams.set('inputComparison', 'vertical');
  await page.goto(conflictURL.href, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.game?.player?.sword);
  const conflict = await snap(); assertPreferences(conflict); assert.equal(conflict.level, 0); assert.equal(conflict.autoGuard, true); assert.equal(conflict.trial.active, false); assert.equal(conflict.trial.blockedByVertical, true); assert.ok(conflict.info.includes('우선 적용')); rows.push({ type: 'verticalConflict', menu: conflict });
  await install(); await start(); const conflicted = await snap(); assert.equal(conflicted.firstController[0].level, 0); assert.equal(conflicted.firstController[0].autoGuard, true);
  const ordinary = new URL(base); ordinary.search = 'weapon=sabre&foe=default';
  await page.goto(ordinary.href, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.game?.player?.sword);
  const returned = await snap(); assertPreferences(returned); assert.equal(returned.level, .7); assert.equal(returned.autoGuard, true); assert.equal(returned.difficulty, 'hard'); assert.equal(returned.trial.active, false); assert.equal(returned.ui.skill.locked, false); assert.equal(returned.ui.difficulty.locked, false); rows.push({ type: 'preferenceReturn', menu: returned });
  }
  assert.deepEqual(await hashes(), before); assert.deepEqual(errors, []);
  console.log(phase === 'full' ? 'Target correction mobile:4 weapon/mode contracts + vertical conflict + ordinary preference return PASS' : 'Target correction production:2 actual comparison links/first steps/native taps/drags/new rounds/reloads PASS');
} finally {
  const after = await hashes(), finished = new Date();
  await writeFile(out, JSON.stringify({ sourceBefore: before, sourceAfter: after, sourceStable: JSON.stringify(before) === JSON.stringify(after), phase, links: typeof links !== 'undefined' ? links : undefined, startedAt: started.toISOString(), finishedAt: finished.toISOString(), wallTimeMs: finished - started, rows, errors, scope: 'Local candidate contract and native input; ordinary round timing; not naturalness or long combat acceptance' }, null, 2));
  await browser.close();
}
