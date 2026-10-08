// Linked offhand delivery: trusted mobile input and read-only game observations.
// Run only after the intended source/dist freeze. Outputs stay outside the checkout.
// --out=/workspace/halfsword-handoff/offhand-support-20261008/browser/<fresh-name>
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
const artifactRoot = '/workspace/halfsword-handoff/offhand-support-20261008/browser';
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
const fixedFiles = ['tools/browser/offhand_support_delivery.mjs', 'index.html', 'package.json', 'package-lock.json', 'public/feature-lab.html'];
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
  assert.deepEqual(previous.manifestBefore, before, 'Local evidence must use this exact source, tool and build');
}
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const startedUTC = new Date().toISOString(), start = performance.now();
await fs.writeFile(path.join(out, 'manifest-before.json'), JSON.stringify({ head, files: before }, null, 2) + '\n');
await fs.copyFile(own, path.join(out, 'executed-tool.mjs'));
const settings = { difficulty: 'normal', pixel: false, blood: true, sound: false, invertTilt: false,
  moveMode: 'stick', skill: '0.3', guardNames: true, trail: false, fpsCap: false };
const saved = JSON.stringify(settings), errors = [], compiled = [], entries = [], archived = [], inputRequests = [], secrets = [];
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
let browser, context, page, cdp, fatal = null, pass = false, lab = null, ordinaryEntry = null, onehandMenu = null;
const deadline = setTimeout(() => {
  errors.push({ kind: 'budget', message: 'Mobile delivery exceeded its 300 second budget' });
  browser?.close().catch(() => {});
}, 300000);
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
    { timeout: Math.max(100, Math.min(timeout, 300000 - (performance.now() - start))) });
  async function observe() {
    await wait(() => window.game?.ai && game.combat && game.finishV2Trial);
    await page.evaluate(() => {
      const p = window.offhandSupportProbe = { native: [], ids: new WeakMap(), next: 1 };
      const id = object => { if (!p.ids.has(object)) p.ids.set(object, p.next++); return p.ids.get(object); };
      p.bodies = () => [game.player, game.enemy].flatMap(f => [...Object.values(f.bodies), f.sword])
        .flatMap(body => [body.translation(), body.rotation(), body.linvel(), body.angvel()].flatMap(v => Object.values(v)));
      const support = f => ({ model: f.armSupportModel ?? 'legacy', twoHand: !!f.weaponCfg.twoHand,
        mainHealth: f.armHealth, offhandHealth: f.limbs.armO, gripping: !!f.gripping,
        sample: f.cache?.armSupport ? { ...f.cache.armSupport } : null });
      p.read = () => ({ url: location.href, state: game.state, steps: game.combat.stepNo, simTime: game.stats.simTime,
        fightT: game.player.fightT, objects: { player: id(game.player), enemy: id(game.enemy), world: id(game.world), ai: id(game.ai) },
        player: { weapon: game.player.weapon.id, alive: game.player.alive, wounds: game.player.wounds.length, support: support(game.player),
          pelvis: { ...game.player.bodies.pelvis.translation() }, move: { x: game.player.move.x, y: game.player.move.y },
          stickY: game.player.stickY, handHeld: game.player.handHeld, hand: { x: game.player.handOffset.x, y: game.player.handOffset.y },
          lastMotionTimeS: game.player.swordsmanshipState?.lastMotionTimeS ?? null,
          swordInput: game.player.swordsmanshipState?.input ? { ...game.player.swordsmanshipState.input } : null },
        enemy: { weapon: game.enemy.weapon.id, alive: game.enemy.alive, wounds: game.enemy.wounds.length, support: support(game.enemy) },
        policies: { finish: game.combat.finishRuleModel,
          finishTarget: game.combat.finishRuleFighter === null ? 'both' : game.combat.finishRuleFighter === game.player ? 'player' : 'other',
          v2: game.player.swordsmanshipModel, arm: game.player.onehandArmModel, roll: game.player.rollTargetModel,
          gravity: game.world.gravity.y, startHold: game.config.ARENA.startHold, limb: game.config.COMBAT.limbSeverTrial,
          defaultActive: game.swordsmanshipDefault.active, supportProbe: game.supportProbe.active },
        trial: { ...game.finishV2Trial }, trialPanel: document.getElementById('finishV2TrialInfo')?.textContent ?? null,
        recoveryContactTrial: { ...game.recoveryContactV2Trial },
        input: { enabled: game.input.enabled, activeTouch: game.input.activeTouch,
          stick: [game.input.stickMove.x, game.input.stickMove.y], pending: [game.input.handDX, game.input.handDY] },
        saved: localStorage.getItem('gladiator-settings'), finite: p.bodies().every(Number.isFinite),
        drawVisible: document.querySelector('#draw').classList.contains('show'),
        layout: { width: innerWidth, scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) } });
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(type, event => {
        if (p.native.length < 250) p.native.push({ type, trusted: event.isTrusted, kind: event.pointerType,
          target: event.target.closest?.('button')?.id || event.target.id });
      }, true);
    });
  }
  const read = () => page.evaluate(() => offhandSupportProbe.read());
  function common(row) {
    assert.equal(row.saved, saved); assert(row.finite);
    assert.equal(row.policies.gravity, -9.81); assert.equal(row.policies.startHold, 2);
    assert(row.layout.scrollWidth <= row.layout.width + 1, 'Mobile horizontal overflow');
  }
  function ordinary(row, weapon) {
    common(row); assert.equal(row.policies.finish, 'power'); assert.equal(row.policies.finishTarget, 'both');
    assert.equal(row.trial.active, false); assert.equal(row.trialPanel, null);
    for (const fighter of [row.player, row.enemy]) {
      assert.equal(fighter.support.model, 'linked');
      if (row.steps > 0) {
        const sample = fighter.support.sample;
        assert(sample, 'Active ordinary fighter must carry its real cached support sample');
        assert.equal(typeof sample.eligible, 'boolean');
        assert(sample.distance === null || Number.isFinite(sample.distance));
        for (const key of ['reachWeight', 'muscleScale', 'healthScale', 'weight']) {
          assert(Number.isFinite(sample[key]), `Non-finite cached support ${key}`);
          assert(sample[key] >= 0 && sample[key] <= 1, `Out-of-range cached support ${key}`);
        }
      }
    }
    if (weapon) {
      assert.equal(row.player.weapon, weapon); assert.equal(row.enemy.weapon, 'longsword'); assert(!row.drawVisible);
      assert.equal(row.policies.v2, 'unified'); assert.equal(row.policies.arm, 'manual'); assert.equal(row.policies.roll, 'bounded');
      assert.equal(row.policies.defaultActive, true); assert.equal(row.policies.limb, true); assert.equal(row.policies.supportProbe, false);
    }
  }
  async function send(type, touchPoints) {
    inputRequests.push({ entry: entries.at(-1)?.weapon, type, touchPoints });
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  }
  async function nativeInput(row, label) {
    const flow = row[label] = { before: await read() };
    await send('touchStart', [{ x: 675, y: 240, id: 1 }]);
    await send('touchMove', [{ x: 645, y: 200, id: 1 }]);
    flow.handHeld = await read(); assert.notEqual(flow.handHeld.input.activeTouch, null);
    await wait(previous => game.player.swordsmanshipState.lastMotionTimeS !== null &&
      game.player.swordsmanshipState.lastMotionTimeS !== previous, flow.before.player.lastMotionTimeS);
    flow.handApplied = await read();
    await send('touchEnd', []);
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
    flow.completed = await read(); ordinary(flow.completed, row.weapon);
    assert.equal(flow.completed.input.activeTouch, null); assert.deepEqual(flow.completed.input.stick, [0, 0]);
  }
  async function pause() {
    await page.locator('#btnPause').tap(); await wait(() => game.state === 'paused');
    const row = await read(); common(row); assert.equal(row.input.enabled, false);
    assert.equal(row.input.activeTouch, null); assert.deepEqual(row.input.stick, [0, 0]); return row;
  }
  const labURL = new URL('feature-lab.html#finish-v2-comparison', base);
  await page.goto(labURL.href, { waitUntil: 'load', timeout: 30000 });
  lab = await page.locator('#finish-v2-comparison, #recovery-contact-v2-comparison').evaluateAll(sections => ({
    text: sections.map(section => section.innerText).join('\n'),
    links: sections.flatMap(section => [...section.querySelectorAll('a')].map(a => ({ id: a.id, text: a.innerText, href: a.href }))) }));
  assert(/이전|보존|과거/.test(lab.text), 'The old comparison must be labeled historical');
  const current = page.locator('#playFinishPower');
  const currentURL = new URL(await current.getAttribute('href'), labURL);
  assert(confined(currentURL.href));
  assert.deepEqual([...currentURL.searchParams], [['weapon', 'longsword'], ['foe', 'heinrich']]);
  await current.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(out, 'lab-portrait.png') });
  await Promise.all([page.waitForURL(currentURL.href), current.tap()]); await observe();
  ordinaryEntry = await read(); ordinary(ordinaryEntry);
  await page.screenshot({ path: path.join(out, 'ordinary-entry-portrait.png') });
  await page.setViewportSize({ width: 844, height: 390 });
  for (const weapon of ['longsword', 'zweihander']) {
    const url = new URL(base); url.search = new URLSearchParams({ weapon, foeWeapon: 'longsword', foe: 'default' }).toString();
    await page.goto(url.href, { waitUntil: 'load', timeout: 30000 }); await observe();
    cdp = await context.newCDPSession(page);
    const row = { weapon, menu: await read() }; entries.push(row); ordinary(row.menu, weapon);
    await page.locator('#btnStart').tap(); await wait(() => game.state === 'fight' && game.player.fightT > 0);
    row.started = await read(); ordinary(row.started, weapon);
    await nativeInput(row, 'firstInput'); await page.screenshot({ path: path.join(out, `${weapon}-ingame.png`) });
    row.paused = await pause();
    const frozen = await page.evaluate(() => ({ frame: game.renderInfo().frame, bodies: offhandSupportProbe.bodies(), steps: game.combat.stepNo }));
    await wait(frame => game.renderInfo().frame > frame + 1, frozen.frame);
    const still = await page.evaluate(() => ({ bodies: offhandSupportProbe.bodies(), steps: game.combat.stepNo }));
    assert.deepEqual(still.bodies, frozen.bodies); assert.equal(still.steps, frozen.steps); row.pauseFrozen = true;
    await page.locator('#btnResume').tap(); await wait(steps => game.state === 'fight' && game.combat.stepNo > steps, frozen.steps);
    row.resumed = await read(); ordinary(row.resumed, weapon); assert.deepEqual(row.resumed.objects, row.started.objects);
    row.beforeRestart = await pause(); await page.locator('#btnStart').tap();
    await wait(() => game.state === 'fight' && game.player.fightT > 0);
    row.restarted = await read(); ordinary(row.restarted, weapon);
    for (const key of Object.keys(row.restarted.objects)) assert.notEqual(row.restarted.objects[key], row.beforeRestart.objects[key]);
    assert.equal(row.restarted.player.wounds, 0); assert.equal(row.restarted.enemy.wounds, 0);
    await nativeInput(row, 'restartInput'); row.final = await pause();
    await page.screenshot({ path: path.join(out, `${weapon}-restarted-paused.png`) });
    row.native = await page.evaluate(() => offhandSupportProbe.native.slice());
    assert(row.native.length && row.native.every(event => event.trusted && event.kind === 'touch'));
    for (const id of ['btnStart', 'btnPause', 'btnResume']) assert(row.native.some(event => event.target === id));
    await cdp.detach(); cdp = null;
    console.log(JSON.stringify({ event: 'ordinary-complete', weapon, steps: row.final.steps, simTime: row.final.simTime }));
  }
  const onehandURL = new URL(base); onehandURL.search = new URLSearchParams({ weapon: 'qinggang', foeWeapon: 'longsword', foe: 'default' }).toString();
  await page.goto(onehandURL.href, { waitUntil: 'load', timeout: 30000 }); await observe();
  onehandMenu = await read(); ordinary(onehandMenu, 'qinggang');
  assert.equal(onehandMenu.player.support.twoHand, false);
  assert.equal(onehandMenu.player.support.mainHealth, 1); assert.equal(onehandMenu.player.support.offhandHealth, 1);
  if (onehandMenu.player.support.sample) {
    assert.equal(onehandMenu.player.support.sample.eligible, false); assert.equal(onehandMenu.player.support.sample.weight, 0);
  }
  for (const [mode, letter] of [['baseline', 'A'], ['armor', 'B']]) {
    const weapon = 'longsword';
    const link = lab.links.find(link => link.id === `playFinishV2Long${letter}`); assert(link);
    const url = new URL(link.href); assert(confined(url.href));
    assert.deepEqual([...url.searchParams], [['finishV2', mode], ['weapon', weapon]]);
    await page.goto(url.href, { waitUntil: 'load', timeout: 30000 }); await observe();
    const row = { trial: 'finishV2', weapon, mode, observed: await read() }; archived.push(row); common(row.observed);
    assert.equal(row.observed.trial.active, true); assert.equal(row.observed.trial.playerOnly, true);
    assert.equal(row.observed.policies.finish, mode === 'armor' ? 'armorGuard' : 'legacy');
    assert.equal(row.observed.policies.finishTarget, 'player'); assert.equal(row.observed.player.weapon, weapon);
    for (const fighter of [row.observed.player, row.observed.enemy]) assert.equal(fighter.support.model, 'legacy');
    assert(/이전|보존|과거/.test(row.observed.trialPanel), 'Archived trial panel must identify historical comparison');
  }
  for (const [mode, suffix] of [['baseline', 'Baseline'], ['combined', 'Combined']]) {
    const link = lab.links.find(link => link.id === `playRecoveryContactV2${suffix}`); assert(link);
    const url = new URL(link.href); assert(confined(url.href));
    assert.deepEqual([...url.searchParams], [['recoveryContactV2', mode]]);
    await page.goto(url.href, { waitUntil: 'load', timeout: 30000 }); await observe();
    const row = { trial: 'recoveryContactV2', weapon: 'zweihander', mode, observed: await read() }; archived.push(row); common(row.observed);
    assert.equal(row.observed.recoveryContactTrial.active, true); assert.equal(row.observed.recoveryContactTrial.model, mode);
    assert.equal(row.observed.player.weapon, 'zweihander');
    for (const fighter of [row.observed.player, row.observed.enemy]) assert.equal(fighter.support.model, 'legacy');
  }
  await page.screenshot({ path: path.join(out, 'archived-recovery-combined-menu.png') });
  const malformedURL = new URL(base); malformedURL.search = 'finishV2=invalid&weapon=longsword';
  await page.goto(malformedURL.href, { waitUntil: 'load', timeout: 30000 }); await observe();
  const malformed = { trial: 'finishV2', mode: 'invalid', observed: await read() }; archived.push(malformed); common(malformed.observed);
  assert.equal(malformed.observed.trial.active, false); assert.equal(malformed.observed.trial.requested, true);
  for (const fighter of [malformed.observed.player, malformed.observed.enemy]) assert.equal(fighter.support.model, 'legacy');
  assert(compiled.some(item => item.name === 'dist/feature-lab.html') && compiled.some(item => item.name === 'dist/index.html') &&
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
  pass = pass && buildStable && sourceStable && errors.length === 0 && performance.now() - start < 300000;
  if (!pass) process.exitCode = 1;
  const report = { pass, local, head, startedUTC, completedUTC: new Date().toISOString(), wallMs: performance.now() - start,
    base: base.href, buildStable, sourceStable, manifestBefore: before, settings, lab, ordinaryEntry, onehandMenu, entries, archived,
    compiled, errors, fatal, inputRequests, tlsVerification: true, proxyRetained: !local,
    limits: ['Chromium mobile emulation, not physical-phone or human feel acceptance.',
      'Ordinary longsword and zweihander start/drag/move/pause/resume/restart; healthy qinggang menu and five historical/malformed menu observations.',
      'Only saved-settings fixture and observer bookkeeping are written; no gameplay, AI, RNG, physics or prototype changes.',
      'Ordinary linked support and power finish policies apply to both fighters; cached support is observed after real physics steps.',
      'Healthy onehand menu checks policy/spec identity only. Injury effects, contact energy and damage need separate combat evidence.',
      'Every requested served artifact matches the frozen local dist bytes; screenshots use the native camera.'] };
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await fs.writeFile(path.join(out, 'manifest-after.json'), JSON.stringify(after, null, 2) + '\n');
  console.log(JSON.stringify({ pass, buildStable, sourceStable, ordinaryFlows: entries.length, archivedMenus: archived.length,
    wallMs: report.wallMs, fatal, out }));
}
