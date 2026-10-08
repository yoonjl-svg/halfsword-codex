// Arm recovery fix delivery: ordinary controls, trusted mobile input, read-only gameplay observations.
// Run only after the intended source/dist freeze. Outputs stay outside the checkout.
// --out=/workspace/halfsword-handoff/arm-recovery-20261008/mobile/<fresh-name>
// [--base=http://127.0.0.1:4173/] [--local-evidence=<passing-local-report.json>]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const own = fileURLToPath(import.meta.url), root = path.resolve(path.dirname(own), '../..');
const args = {};
for (const value of process.argv.slice(2)) {
  const match = /^--(out|base|local-evidence)=(.+)$/.exec(value);
  assert(match && !Object.hasOwn(args, match[1]), 'Unknown or duplicate argument');
  args[match[1]] = match[2];
}
const scenario = ['sabre', 'longsword', 'morgenstern'].map(weapon => ({
  id: 'ordinary-' + weapon, weapon, cards: weapon + ',' + (weapon === 'longsword' ? 'sabre' : 'longsword'),
  note: weapon === 'morgenstern' ? 'Explicit offered-card fixture; trialOnly weapon stays outside ordinary random pool' : 'Explicit offered-card fixture with ordinary controllers',
}));
const artifactRoot = '/workspace/halfsword-handoff/arm-recovery-20261008/mobile';
assert(args.out && path.isAbsolute(args.out));
const out = path.resolve(args.out);
assert.equal(path.dirname(out), artifactRoot);
await fs.mkdir(artifactRoot, { recursive: true });
assert.equal(await fs.realpath(artifactRoot), artifactRoot);
await fs.mkdir(out); // Never overwrite earlier evidence.
const base = new URL(args.base || 'https://yoonjl-svg.github.io/halfsword-codex/');
const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
assert(local && base.protocol === 'http:' || base.href === 'https://yoonjl-svg.github.io/halfsword-codex/');
assert(!base.search && !base.hash && !base.username && !base.password && base.pathname.endsWith('/'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function scan(dir) {
  const found = [];
  for (const entry of await fs.readdir(path.join(root, dir), { withFileTypes: true })) {
    assert(!entry.isSymbolicLink());
    const name = dir + '/' + entry.name;
    if (entry.isDirectory()) found.push(...await scan(name));
    else if (entry.isFile()) found.push(name);
  }
  return found.sort();
}
const fixedFiles = ['tools/browser/arm_recovery_delivery_20261008.mjs', 'index.html', 'package.json', 'package-lock.json'];
const manifest = async () => {
  const files = [...fixedFiles, ...await scan('src'), ...await scan('dist')];
  return Object.fromEntries(await Promise.all(files.map(async name => {
    const bytes = await fs.readFile(path.join(root, name));
    return [name, { bytes: bytes.length, sha256: sha(bytes) }];
  })));
};
const before = await manifest();
if (!local) {
  assert(args['local-evidence'], 'Public verification requires passing same-build local evidence');
  const evidence = path.resolve(args['local-evidence']);
  assert.equal(path.dirname(path.dirname(evidence)), artifactRoot);
  const previous = JSON.parse(await fs.readFile(evidence, 'utf8'));
  assert(previous.pass && previous.local);
  assert.deepEqual(previous.scenario, scenario, 'Public flow must exactly match passing local flow');
  assert.deepEqual(previous.manifestBefore, before, 'Local evidence must use this exact source, tool and build');
}
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const startedUTC = new Date().toISOString(), start = performance.now();
await fs.writeFile(path.join(out, 'manifest-before.json'), JSON.stringify({ head, files: before }, null, 2) + '\n');
await fs.copyFile(own, path.join(out, 'executed-tool.mjs'));
const settings = { difficulty: 'normal', pixel: false, blood: true, sound: false, invertTilt: false,
  moveMode: 'stick', skill: '0.3', guardNames: true, trail: false, fpsCap: false };
const saved = JSON.stringify(settings), errors = [], compiled = [], entries = [], inputRequests = [], secrets = [];
const launch = { executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-background-networking', '--use-gl=angle', '--use-angle=swiftshader'] };
if (!local) {
  const raw = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  assert(raw);
  const proxy = new URL(raw);
  launch.proxy = { server: proxy.protocol + '//' + proxy.host };
  if (proxy.username) launch.proxy.username = decodeURIComponent(proxy.username);
  if (proxy.password) launch.proxy.password = decodeURIComponent(proxy.password);
  secrets.push(raw, proxy.username, proxy.password, launch.proxy.username, launch.proxy.password);
}
const clean = value => {
  let text = String(value);
  for (const secret of secrets.filter(Boolean)) text = text.split(secret).join('[redacted]');
  return text.replace(/https?:\/\/[^\s/@:]+:[^\s/@]+@/gi, 'https://[redacted]@')
    .replace(/\b(authorization|token|password|secret)\s*[:=]\s*[^\s"'<>]+/gi, '$1=[redacted]').slice(0, 5000);
};
const confined = value => {
  try {
    const url = new URL(value);
    if (url.protocol === 'data:') return true;
    if (url.protocol === 'blob:') return new URL(url.pathname).origin === base.origin;
    const decoded = decodeURIComponent(url.pathname);
    return !url.username && !url.password && url.origin === base.origin && url.pathname.startsWith(base.pathname) &&
      !decoded.includes('\\') && !decoded.split('/').some(part => part === '..' || part === '.');
  } catch { return false; }
};
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs');
let browser, context, page, cdp, fatal = null, pass = false;
const budgetMs = 300000;
const deadline = setTimeout(() => {
  errors.push({ kind: 'budget', message: `Mobile delivery exceeded its ${budgetMs / 1000} second budget` });
  browser?.close().catch(() => {});
}, budgetMs);
deadline.unref();
try {
  browser = await chromium.launch(launch);
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    ignoreHTTPSErrors: false, serviceWorkers: 'block',
    storageState: { cookies: [], origins: [{ origin: base.origin, localStorage: [{ name: 'gladiator-settings', value: saved }] }] } });
  context.setDefaultTimeout(20000);
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (!confined(url)) { errors.push({ kind: 'blocked', url: clean(url) }); return route.abort('blockedbyclient'); }
    try {
      const response = await route.fetch({ maxRedirects: 0, maxRetries: 2, timeout: 30000 });
      assert.equal(response.status(), 200, 'Requested artifact must return 200 without redirects');
      const rel = decodeURIComponent(new URL(url).pathname.slice(base.pathname.length));
      const name = 'dist/' + (rel || 'index.html'), body = await response.body(), wanted = before[name];
      const digest = sha(body), match = !!wanted && wanted.bytes === body.length && wanted.sha256 === digest;
      compiled.push({ name, sha256: digest, bytes: body.length, match });
      assert(match, `Served bytes differ from frozen build: ${name}`);
      await route.fulfill({ response, body });
    } catch (error) {
      errors.push({ kind: 'route', url: clean(url), message: clean(error.message) });
      await route.abort('failed');
    }
  });
  if (context.routeWebSocket) await context.routeWebSocket('**/*', socket => {
    errors.push({ kind: 'websocket', url: clean(socket.url()) }); socket.close();
  });
  page = await context.newPage();
  page.on('pageerror', error => errors.push({ kind: 'pageerror', message: clean(error.message) }));
  page.on('console', message => { if (message.type() === 'error') errors.push({ kind: 'console', message: clean(message.text()) }); });
  page.on('requestfailed', request => errors.push({ kind: 'requestfailed', url: clean(request.url()), message: clean(request.failure()?.errorText) }));
  const wait = (predicate, arg, timeout = 40000) => page.waitForFunction(predicate, arg,
    { timeout: Math.max(100, Math.min(timeout, budgetMs - (performance.now() - start))) });
  async function observe() {
    await wait(() => window.game?.ai && game.combat && game.opportunityTrial);
    await page.evaluate(() => {
      const p = window.armRecoveryProbe = { native: [], accepted: [], ids: new WeakMap(), next: 1 };
      const id = object => { if (!p.ids.has(object)) p.ids.set(object, p.next++); return p.ids.get(object); };
      p.bodies = () => [game.player, game.enemy].flatMap(f => [...Object.values(f.bodies), f.sword])
        .flatMap(body => [body.translation(), body.rotation(), body.linvel(), body.angvel()].flatMap(v => Object.values(v)));
      const support = f => ({ model: f.armSupportModel ?? 'legacy', twoHand: !!f.weaponCfg.twoHand,
        mainHealth: f.armHealth, offhandHealth: f.limbs.armO, gripping: !!f.gripping,
        sample: f.cache?.armSupport ? { ...f.cache.armSupport } : null });
      const weapon = f => ({ gripPoint: f.gripPointModel, mass: f.sword.mass(),
        config: Object.fromEntries(['bladeLength', 'hiltLength', 'gripAlong', 'edged', 'mCut', 'mThrust', 'mBlunt', 'power', 'ignoreArmor', 'twoHand',
          'aimStiffness', 'aimDamping', 'maxAimTorque', 'wristVmax'].map(key => [key, f.weaponCfg[key]])),
        finishEntry: f.finishEntryModel ?? 'legacy', recoverySequence: f.recoverySequenceModel ?? 'legacy',
        opportunity: f.opportunityModel ?? 'off' });
      p.read = () => ({ draw: { stage: game.draw.stage, t: game.draw.t, ids: [...game.draw.ids], pick: game.draw.pick }, url: location.href, state: game.state, steps: game.combat.stepNo, simTime: game.stats.simTime,
        fightT: game.player.fightT, objects: { player: id(game.player), enemy: id(game.enemy), world: id(game.world), ai: id(game.ai) },
        player: { weapon: game.player.weapon.id, alive: game.player.alive, wounds: game.player.wounds.length, support: support(game.player),
          weaponState: weapon(game.player), profileId: game.player.swordsmanshipState?.profileId ?? null,
          hasV2State: !!game.player.swordsmanshipState, skillLevel: game.player.skill.level, autoGuard: game.player.skill.autoGuard,
          pelvis: { ...game.player.bodies.pelvis.translation() }, move: { x: game.player.move.x, y: game.player.move.y },
          stickY: game.player.stickY, handHeld: game.player.handHeld, hand: { x: game.player.handOffset.x, y: game.player.handOffset.y },
          lastMotionTimeS: game.player.swordsmanshipState?.lastMotionTimeS ?? null,
          swordInput: game.player.swordsmanshipState?.input ? { ...game.player.swordsmanshipState.input } : null },
        enemy: { weapon: game.enemy.weapon.id, alive: game.enemy.alive, wounds: game.enemy.wounds.length, support: support(game.enemy),
          weaponState: weapon(game.enemy) },
        policies: { finish: game.combat.finishRuleModel,
          finishTarget: game.combat.finishRuleFighter === null ? 'both' : game.combat.finishRuleFighter === game.player ? 'player' : 'other',
          v2: game.player.swordsmanshipModel ?? 'legacy', enemyV2: game.enemy.swordsmanshipModel ?? 'legacy',
          arm: game.player.onehandArmModel, enemyArm: game.enemy.onehandArmModel ?? 'legacy',
          roll: game.player.rollTargetModel ?? 'legacy', stance: game.player.stanceMemoryModel ?? 'legacy',
          gripReaction: game.config.GRIP.reactionModel,
          cut: game.combat.cutReactionModel,
          cutTarget: game.combat.cutReactionFighter === game.player ? 'player' : game.combat.cutReactionFighter === null ? 'both' : 'other',
          gravity: game.world.gravity.y, startHold: game.config.ARENA.startHold, limb: game.config.COMBAT.limbSeverTrial,
          defaultActive: game.swordsmanshipDefault.active, supportProbe: game.supportProbe.active },
        trial: { ...game.opportunityTrial }, trialPanel: document.getElementById('opportunityInfo')?.textContent ?? null,
        accepted: p.accepted.slice(),
        input: { enabled: game.input.enabled, activeTouch: game.input.activeTouch,
          stick: [game.input.stickMove.x, game.input.stickMove.y], pending: [game.input.handDX, game.input.handDY] },
        saved: localStorage.getItem('gladiator-settings'), finite: p.bodies().every(Number.isFinite),
        drawVisible: document.querySelector('#draw').classList.contains('show'),
        layout: { width: innerWidth, scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) } });
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(type, event => {
        if (p.native.length < 250) p.native.push({ type, trusted: event.isTrusted, kind: event.pointerType,
          target: event.target.closest?.('button')?.id || event.target.id });
      }, true);
      // Sample the existing consumed-input flag for both old and v2 controllers.
      // This observer never changes a game field or wraps a gameplay method.
      const sample = () => {
        if (game.state === 'fight' && game.player.inputActive && p.accepted.length < 100)
          p.accepted.push({ player: id(game.player), step: game.combat.stepNo, held: game.player.handHeld,
            hand: { x: game.player.handOffset.x, y: game.player.handOffset.y } });
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  }
  const read = () => page.evaluate(() => armRecoveryProbe.read());
  function common(row) {
    assert.equal(row.saved, saved); assert(row.finite);
    assert.equal(row.policies.gravity, -9.81); assert.equal(row.policies.startHold, 2);
    assert(row.layout.scrollWidth <= row.layout.width + 1, 'Mobile horizontal overflow');
  }
  function current(row, weapon = null) {
    common(row); assert.equal(row.policies.finish, 'power'); assert.equal(row.policies.finishTarget, 'both');
    assert.equal(row.trial.active, false); assert.equal(row.trial.requested, false); assert.equal(row.trialPanel, null);
    for (const fighter of [row.player, row.enemy]) {
      assert.equal(fighter.support.model, 'linked'); assert(fighter.alive);
      assert.equal(fighter.weaponState.finishEntry, 'legacy');
      assert.equal(fighter.weaponState.opportunity, 'off');
      assert.equal(fighter.weaponState.recoverySequence, 'legacy');
      assert(Number.isFinite(fighter.weaponState.mass) && fighter.weaponState.mass > 0);
      if (row.steps > 0) {
        const sample = fighter.support.sample;
        assert(sample, 'Active fighter must carry its real cached support sample');
        assert.equal(typeof sample.eligible, 'boolean');
        assert(sample.distance === null || Number.isFinite(sample.distance));
        for (const key of ['reachWeight', 'muscleScale', 'healthScale', 'weight'])
          assert(Number.isFinite(sample[key]) && sample[key] >= 0 && sample[key] <= 1, `Invalid cached support ${key}`);
      }
    }
    assert.equal(row.policies.defaultActive, true); assert.equal(row.policies.limb, true); assert.equal(row.policies.supportProbe, false);
    if (weapon) {
      assert.equal(row.player.weapon, weapon); assert.equal(row.enemy.weapon, 'longsword'); assert(!row.drawVisible);
      for (const fighter of [row.player, row.enemy]) assert.equal(fighter.weaponState.gripPoint, 'midpoint');
      assert.equal(row.policies.v2, 'unified'); assert.equal(row.policies.enemyV2, 'legacy'); assert(row.player.hasV2State);
      assert.equal(row.player.skillLevel, 0); assert.equal(row.player.autoGuard, false);
      assert.equal(row.policies.arm, 'manual'); assert.equal(row.policies.enemyArm, 'legacy');
      assert.equal(row.policies.roll, 'bounded'); assert.equal(row.policies.stance, 'fresh');
      assert.equal(row.policies.cut, weapon === 'morgenstern' ? 'legacy' : 'centerline');
      assert.equal(row.policies.cutTarget, weapon === 'morgenstern' ? 'both' : 'player');
      assert.equal(row.policies.gripReaction, 'paired');
    }
  }
  async function send(type, touchPoints) {
    inputRequests.push({ entry: entries.at(-1)?.id, type, touchPoints });
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  }
  async function nativeInput(row, label) {
    const flow = row[label] = { before: await read() };
    await send('touchStart', [{ x: 675, y: 240, id: 1 }]);
    await send('touchMove', [{ x: 645, y: 200, id: 1 }]);
    flow.handHeld = await read(); assert.notEqual(flow.handHeld.input.activeTouch, null);
    await wait(count => armRecoveryProbe.accepted.length > count, flow.before.accepted.length);
    flow.handApplied = await read();
    assert.equal(flow.handApplied.accepted.at(-1).player, flow.handApplied.objects.player);
    assert.equal(flow.handApplied.accepted.at(-1).held, true);
    assert.notEqual(flow.handApplied.player.lastMotionTimeS, flow.before.player.lastMotionTimeS);
    await send('touchEnd', []);
    await page.screenshot({ path: path.join(out, `${row.id}-${label}-after-stroke.png`) });
    await wait(() => game.player.fightT > 2.05 && game.state === 'fight');
    const box = await page.locator('#moveStick').boundingBox(); assert(box);
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 2 };
    flow.beforeMove = await read();
    await send('touchStart', [point]);
    await send('touchMove', [{ ...point, y: point.y + 30 }]);
    flow.stickHeld = await read(); assert(flow.stickHeld.input.stick.some(value => Math.abs(value) > .1));
    await wait(steps => game.combat.stepNo >= steps + 8 && Math.abs(game.player.stickY) > .1 &&
      Math.abs(game.player.move.y) > .1, flow.stickHeld.steps);
    flow.stickApplied = await read();
    assert(Math.hypot(flow.stickApplied.player.pelvis.x - flow.beforeMove.player.pelvis.x,
      flow.stickApplied.player.pelvis.z - flow.beforeMove.player.pelvis.z) > .001);
    await send('touchEnd', []);
    flow.completed = await read(); current(flow.completed, row.weapon);
    assert.equal(flow.completed.input.activeTouch, null); assert.deepEqual(flow.completed.input.stick, [0, 0]);
  }
  async function pause() {
    await page.locator('#btnPause').tap(); await wait(() => game.state === 'paused');
    const row = await read(); common(row); assert.equal(row.input.enabled, false);
    assert.equal(row.input.activeTouch, null); assert.deepEqual(row.input.stick, [0, 0]); return row;
  }
  async function startSelected(row, label) {
    await page.locator('#btnStart').tap();
    await wait(() => game.state === 'draw' && game.draw.stage === 'choose' && game.draw.t >= .5);
    row[label + 'Cards'] = await read(); common(row[label + 'Cards']);
    assert.deepEqual(row[label + 'Cards'].draw.ids.slice(0, 2), row.cards.split(','));
    assert.equal(row[label + 'Cards'].draw.ids[2], 'longsword');
    assert.equal(row[label + 'Cards'].policies.defaultActive, true);
    await page.screenshot({ path: path.join(out, `${row.id}-${label}-cards.png`) });
    await page.locator('#draw button[data-i="0"]').tap();
    await wait(() => game.state === 'fight' || game.draw.stage === 'fly' || game.draw.stage === 'reveal' && game.draw.t >= 1);
    if (await page.evaluate(() => game.state === 'draw' && game.draw.stage === 'reveal'))
      await page.locator('#draw button[data-i="0"]').tap();
    await wait(() => game.state === 'fight' && game.player.fightT > 0);
    row[label] = await read(); current(row[label], row.weapon);
    assert.equal(row[label].player.wounds, 0); assert.equal(row[label].enemy.wounds, 0);
  }
  for (const fixture of scenario) {
    const { weapon } = fixture;
    await page.setViewportSize({ width: 390, height: 844 });
    const url = new URL(base); url.search = new URLSearchParams({ cards: fixture.cards, foe: 'default', foeWeapon: 'longsword' }).toString();
    await page.goto(url.href, { waitUntil: 'load', timeout: 30000 }); await observe();
    const row = { ...fixture, url: url.href, entryPortrait: await read() }; entries.push(row); current(row.entryPortrait);
    assert.equal(row.entryPortrait.state, 'menu');
    await page.screenshot({ path: path.join(out, `${row.id}-entry-portrait.png`) });
    await page.setViewportSize({ width: 844, height: 390 });
    cdp = await context.newCDPSession(page);
    row.menu = await read(); current(row.menu);
    await startSelected(row, 'started');
    for (const fighter of [row.started.player, row.started.enemy]) {
      assert.equal(fighter.support.mainHealth, 1); assert.equal(fighter.support.offhandHealth, 1);
    }
    await page.screenshot({ path: path.join(out, `${row.id}-first-ready.png`) });
    await nativeInput(row, 'firstInput');
    row.paused = await pause();
    const frozen = await page.evaluate(() => ({ frame: game.renderInfo().frame, bodies: armRecoveryProbe.bodies(), steps: game.combat.stepNo }));
    await wait(frame => game.renderInfo().frame > frame + 1, frozen.frame);
    const still = await page.evaluate(() => ({ bodies: armRecoveryProbe.bodies(), steps: game.combat.stepNo }));
    assert.deepEqual(still.bodies, frozen.bodies); assert.equal(still.steps, frozen.steps); row.pauseFrozen = true;
    await page.locator('#btnResume').tap(); await wait(steps => game.state === 'fight' && game.combat.stepNo > steps, frozen.steps);
    row.resumed = await read(); current(row.resumed, weapon); assert.deepEqual(row.resumed.objects, row.started.objects);
    row.beforeRestart = await pause(); await startSelected(row, 'restarted');
    for (const key of Object.keys(row.restarted.objects)) assert.notEqual(row.restarted.objects[key], row.beforeRestart.objects[key]);
    await nativeInput(row, 'restartInput'); row.final = await pause(); current(row.final, weapon);
    row.native = await page.evaluate(() => armRecoveryProbe.native.slice());
    assert(row.native.length && row.native.every(event => event.trusted && event.kind === 'touch'));
    for (const id of ['btnStart', 'btnPause', 'btnResume']) assert(row.native.some(event => event.target === id));
    await cdp.detach(); cdp = null;
    console.log(JSON.stringify({ event: 'flow-complete', id: row.id, weapon, steps: row.final.steps, simTime: row.final.simTime }));
  }
  assert(compiled.some(item => item.name === 'dist/index.html') &&
    compiled.some(item => item.name.startsWith('dist/assets/main-')));
  assert(compiled.every(item => item.match)); assert.deepEqual(errors, []); pass = true;
} catch (error) {
  fatal = { name: error.name, message: clean(error.message), stack: clean(error.stack) }; process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  if (cdp) await cdp.detach().catch(() => {});
  if (context) await context.close(); if (browser) await browser.close();
  const after = await manifest(), same = name => JSON.stringify(before[name]) === JSON.stringify(after[name]);
  const stable = isBuild => {
    const names = Object.keys(before).filter(name => name.startsWith('dist/') === isBuild);
    const current = Object.keys(after).filter(name => name.startsWith('dist/') === isBuild);
    return JSON.stringify(names) === JSON.stringify(current) && names.every(same);
  };
  const buildStable = stable(true), sourceStable = stable(false);
  pass = pass && buildStable && sourceStable && errors.length === 0 && performance.now() - start < budgetMs;
  if (!pass) process.exitCode = 1;
  const report = { pass, local, head, startedUTC, completedUTC: new Date().toISOString(), wallMs: performance.now() - start,
    base: base.href, buildStable, sourceStable, manifestBefore: before, scenario, settings, savedSettingsRaw: saved, entries,
    compiled, errors, fatal, inputRequests, tlsVerification: true, proxyRetained: !local,
    limits: ['Chromium mobile emulation, not physical-phone or human feel acceptance.',
      'Each explicit card offering is selected through trusted Start/card touch; ordinary controllers start, drag, move, pause, resume and restart with fresh player/enemy/world/AI instances and re-input.',
      'Only saved-settings fixture and observer bookkeeping are written; no gameplay, AI, RNG, physics or prototype changes.',
      'Ordinary entry keeps opportunity off and existing finish entry. Player v2/manual/fresh/bounded and edged centerline, both linked/power, paired midpoint grip and gravity 9.81 are asserted. Morgenstern remains trialOnly outside random draws; cards query explicitly offers it.',
      'No state/pose/AI/physics changes or forced fall, no anatomical or recovery outcome claim. This verifies browser input and served runtime policy delivery; native recovery is separately measured.',
      'Every requested served artifact matches the frozen local dist bytes; screenshots use the native camera.'] };
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await fs.writeFile(path.join(out, 'manifest-after.json'), JSON.stringify(after, null, 2) + '\n');
  console.log(JSON.stringify({ pass, buildStable, sourceStable, ordinaryFlows: entries.length,
    wallMs: report.wallMs, fatal, out }));
}
