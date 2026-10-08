// Native mobile trial entry and restart acceptance; no RNG/pose/physics assignments.
// --out=/fresh/evidence-directory [--base=http://127.0.0.1:4173/]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const own = 'tools/browser/morgenstern_trial_20261008.mjs';
const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const match = /^--(out|base)=(.+)$/.exec(value);
  assert(match, `Unknown argument: ${value}`);
  return [match[1], match[2]];
}));
assert(args.out && path.isAbsolute(args.out));
const artifactRoot = '/workspace/halfsword-handoff/morgenstern-heavy-20261008/browser';
const out = path.resolve(args.out);
assert.equal(path.dirname(out), artifactRoot);
await fs.mkdir(artifactRoot, { recursive: true });
assert.equal(await fs.realpath(artifactRoot), artifactRoot);
await fs.mkdir(out); // Evidence must always be a fresh directory.
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
const files = [own, 'package.json', 'package-lock.json', 'public/feature-lab.html', ...await scan('src'), ...await scan('dist')];
const manifest = async () => Object.fromEntries(await Promise.all(files.map(async name => {
  const bytes = await fs.readFile(path.join(root, name));
  return [name, { bytes: bytes.length, sha256: sha(bytes) }];
})));
const before = await manifest();
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const startedUTC = new Date().toISOString(), start = performance.now();
await fs.writeFile(path.join(out, 'manifest-before.json'), JSON.stringify({ head, files: before }, null, 2) + '\n');
await fs.copyFile(path.join(root, own), path.join(out, 'executed-tool.mjs'));
const settings = { difficulty: 'normal', pixel: false, blood: true, sound: false, invertTilt: false, moveMode: 'stick', skill: '0.3', guardNames: true, trail: false, fpsCap: false };
const settingsBytes = JSON.stringify(settings);
const errors = [], compiled = [], entries = [], inputRequests = [], secrets = [];
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
  return text.replace(/https?:\/\/[^\s/@:]+:[^\s/@]+@/gi, 'https://[redacted]@').slice(0, 5000);
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
let browser, context, page, cdp, fatal = null, pass = false, lab = null, sourceRoster = null;
const deadline = setTimeout(() => {
  errors.push({ kind: 'budget', message: 'Browser acceptance exceeded the 235 second active budget' });
  browser?.close().catch(() => {});
}, 235000);
deadline.unref();
try {
  const { WEAPON_LIST, TRIAL_WEAPON_LIST } = await import(new URL('../../src/weapons.js', import.meta.url));
  sourceRoster = { ordinary: WEAPON_LIST.map(w => w.id), trial: TRIAL_WEAPON_LIST.map(w => w.id) };
  assert(!sourceRoster.ordinary.includes('morgenstern'));
  assert(sourceRoster.trial.includes('morgenstern'));
  browser = await chromium.launch(launch);
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: false, serviceWorkers: 'block',
    storageState: { cookies: [], origins: [{ origin: base.origin, localStorage: [{ name: 'gladiator-settings', value: settingsBytes }] }] } });
  context.setDefaultTimeout(15000);
  // Context storageState seeds once; navigation never repairs changed/deleted settings.
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (!confined(url)) {
      errors.push({ kind: 'blocked', url: clean(url) });
      return route.abort('blockedbyclient');
    }
    try {
      const response = await route.fetch({ maxRedirects: 0, maxRetries: 2, timeout: 30000 });
      assert(!(response.status() >= 300 && response.status() < 400), 'Unexpected redirect');
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
  page.on('response', response => { if (response.status() >= 400) errors.push({ kind: 'http', url: clean(response.url()), status: response.status() }); });
  const wait = (predicate, arg, timeout = 30000) => page.waitForFunction(predicate, arg, { timeout: Math.max(100, Math.min(timeout, 235000 - (performance.now() - start))) });
  const read = () => page.evaluate(() => morgensternProbe.read());
  async function install() {
    await page.evaluate(() => {
      const p = window.morgensternProbe = { steps: 0, native: [], accepted: [], ids: new WeakMap(), next: 1 };
      const id = object => { if (!p.ids.has(object)) p.ids.set(object, p.next++); return p.ids.get(object); };
      const bodies = () => [game.player, game.enemy].flatMap(f => [...Object.values(f.bodies), f.sword])
        .flatMap(body => [body.translation(), body.rotation(), body.linvel(), body.angvel()].flatMap(value => Object.values(value)));
      p.read = () => ({
        url: location.href, state: game.state, steps: p.steps, simTime: game.stats.simTime, fightT: game.player.fightT,
        objects: { player: id(game.player), enemy: id(game.enemy), world: id(game.world), ai: id(game.ai) },
        player: { weapon: game.player.weapon.id, mass: game.player.sword.mass(), trialOnly: !!game.player.weapon.trialOnly,
          spike: !!game.player.weapon.spike, ignoreArmor: !!game.player.weapon.ignoreArmor, edged: game.player.weapon.edged,
          mBlunt: game.player.weapon.mBlunt, mThrust: game.player.weapon.mThrust, mCut: game.player.weapon.mCut,
          alive: game.player.alive, wounds: game.player.wounds.length, handHeld: game.player.handHeld,
          move: { x: game.player.move.x, y: game.player.move.y }, stickY: game.player.stickY,
          handOffset: { x: game.player.handOffset.x, y: game.player.handOffset.y }, version: game.player.swordsmanshipState?.version ?? null },
        enemy: { weapon: game.enemy.weapon.id, alive: game.enemy.alive, wounds: game.enemy.wounds.length },
        policies: { v2: game.player.swordsmanshipModel ?? 'legacy', arm: game.player.onehandArmModel,
          stance: game.player.stanceMemoryModel ?? 'legacy', roll: game.player.rollTargetModel ?? 'legacy', cut: game.combat.cutReactionModel,
          gravity: game.world.gravity.y, startHold: game.config.ARENA.startHold, defaultActive: game.swordsmanshipDefault.active,
          supportProbe: game.supportProbe.active },
        input: { enabled: game.input.enabled, activeTouch: game.input.activeTouch, stick: [game.input.stickMove.x, game.input.stickMove.y], pending: [game.input.handDX, game.input.handDY] },
        accepted: p.accepted.slice(), saved: localStorage.getItem('gladiator-settings'), finite: bodies().every(Number.isFinite),
        draw: { ids: [...game.draw.ids], visible: document.querySelector('#draw').classList.contains('show') },
      });
      p.bodies = bodies;
      const prototype = Object.getPrototypeOf(game.combat), afterStep = prototype.afterStep;
      prototype.afterStep = function (...args) {
        const result = afterStep.apply(this, args);
        if (this === game.combat) {
          p.steps++;
          const input = game.player.swordsmanshipState?.input;
          if (input?.active && Math.hypot(input.dx, input.dy) > 1e-5 && p.accepted.length < 100 && p.accepted.at(-1)?.id !== input.id)
            p.accepted.push({ ...input, player: id(game.player), step: p.steps });
        }
        return result;
      };
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(type, event => {
        if (p.native.length < 250) p.native.push({ type, trusted: event.isTrusted, kind: event.pointerType, target: event.target.closest?.('button')?.id || event.target.id });
      }, true);
    });
  }
  function common(row) {
    assert.equal(row.saved, settingsBytes);
    assert(row.finite);
    assert.equal(row.enemy.weapon, 'longsword');
    assert.equal(row.policies.gravity, -9.81);
    assert.equal(row.policies.startHold, 2);
    assert(!row.draw.visible, 'Fixed weapon entry must skip card draw');
  }
  function expected(row, kind) {
    common(row);
    assert.equal(row.player.weapon, kind === 'longsword' ? 'longsword' : 'morgenstern');
    const legacy = kind === 'research';
    assert.equal(row.policies.defaultActive, !legacy);
    assert.equal(row.policies.v2, legacy ? 'legacy' : 'unified');
    assert.equal(row.policies.arm, legacy ? 'legacy' : 'manual');
    assert.equal(row.policies.stance, legacy ? 'legacy' : 'fresh');
    assert.equal(row.policies.roll, legacy ? 'legacy' : 'bounded');
    assert.equal(row.policies.cut, kind === 'longsword' ? 'centerline' : 'legacy');
    assert.equal(row.policies.supportProbe, legacy);
    if (kind !== 'longsword') {
      assert(Math.abs(row.player.mass - 2.2) < 1e-5);
      assert.equal(row.player.trialOnly, true);
      assert.equal(row.player.spike, true);
      assert.equal(row.player.ignoreArmor, false);
      assert.equal(row.player.edged, false);
      assert.equal(row.player.mCut, 0);
      assert.equal(row.player.mBlunt, 2.1);
      assert.equal(row.player.mThrust, .35);
    }
  }
  async function send(type, touchPoints) {
    inputRequests.push({ type, touchPoints });
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  }
  async function nativeInput(row) {
    const beforeInput = await read();
    await send('touchStart', [{ x: 675, y: 240, id: 1 }]);
    await send('touchMove', [{ x: 645, y: 200, id: 1 }]);
    row.handHeld = await read();
    assert.notEqual(row.handHeld.input.activeTouch, null);
    await wait(count => morgensternProbe.accepted.length > count, beforeInput.accepted.length, 15000);
    await send('touchEnd', []);
    const box = await page.locator('#moveStick').boundingBox(); assert(box);
    await send('touchStart', [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 2 }]);
    await send('touchMove', [{ x: box.x + box.width / 2, y: box.y + box.height / 2 - 25, id: 2 }]);
    row.stickHeld = await read();
    assert(row.stickHeld.input.stick.some(value => Math.abs(value) > .1));
    await wait(steps => morgensternProbe.steps > steps && Math.abs(game.player.stickY) > .1 && Math.abs(game.player.move.y) > .1, row.stickHeld.steps, 15000);
    row.stickApplied = await read();
    await send('touchEnd', []);
    row.inputCompleted = await read();
    assert(row.inputCompleted.steps > beforeInput.steps);
    common(row.inputCompleted);
  }
  async function pause(row) {
    await page.locator('#btnPause').tap();
    await wait(() => game.state === 'paused');
    row.paused = await read();
    assert.equal(row.paused.input.activeTouch, null);
    assert.deepEqual(row.paused.input.stick, [0, 0]);
    assert.equal(row.paused.input.enabled, false);
    common(row.paused);
  }
  const labURL = new URL('feature-lab.html', base);
  await page.goto(labURL.href, { waitUntil: 'load', timeout: 30000 });
  const link = page.locator('#playMorgenstern');
  await link.scrollIntoViewIfNeeded();
  lab = { url: page.url(), viewport: page.viewportSize(), href: await link.getAttribute('href'), text: await link.innerText(), saved: await page.evaluate(() => localStorage.getItem('gladiator-settings')) };
  const trialURL = new URL(lab.href, labURL);
  assert.equal(trialURL.origin, base.origin);
  assert.equal(trialURL.pathname, base.pathname);
  assert.deepEqual([...trialURL.searchParams], [['weapon', 'morgenstern'], ['foeWeapon', 'longsword'], ['foe', 'default']]);
  assert.equal(lab.saved, settingsBytes);
  await page.screenshot({ path: path.join(out, 'lab-portrait.png') });
  await Promise.all([page.waitForURL(trialURL.href), link.tap()]);
  await wait(() => window.game?.ai && game?.combat);
  await page.setViewportSize({ width: 844, height: 390 });
  await install();
  cdp = await context.newCDPSession(page);
  for (let round = 1; round <= 2; round++) {
    const row = { kind: 'trial', round }; entries.push(row);
    await page.locator('#btnStart').tap();
    await wait(() => game.state === 'fight' && game.player.fightT > 0);
    row.started = await read(); expected(row.started, 'trial');
    if (round === 2) {
      for (const key of Object.keys(row.started.objects)) assert.notEqual(row.started.objects[key], entries[0].pausedAgain.objects[key]);
      assert.equal(row.started.player.wounds, 0); assert.equal(row.started.enemy.wounds, 0);
    }
    await nativeInput(row);
    await page.screenshot({ path: path.join(out, `trial-${round}-ingame.png`) });
    await pause(row);
    const frozen = await page.evaluate(() => ({ frame: game.renderInfo().frame, bodies: morgensternProbe.bodies(), steps: morgensternProbe.steps }));
    await wait(frame => game.renderInfo().frame > frame + 1, frozen.frame);
    const still = await page.evaluate(() => ({ bodies: morgensternProbe.bodies(), steps: morgensternProbe.steps }));
    assert.deepEqual(still.bodies, frozen.bodies); assert.equal(still.steps, frozen.steps);
    row.pauseFrozen = true;
    await page.locator('#btnResume').tap();
    await wait(steps => game.state === 'fight' && morgensternProbe.steps > steps, frozen.steps);
    row.resumed = await read(); expected(row.resumed, 'trial');
    assert.deepEqual(row.resumed.objects, row.started.objects);
    await nativeInput(row);
    await pause(row); row.pausedAgain = row.paused;
    await page.screenshot({ path: path.join(out, `trial-${round}-paused.png`) });
    row.native = await page.evaluate(() => morgensternProbe.native.slice());
    assert(row.native.length > 0 && row.native.every(event => event.trusted && event.kind === 'touch'));
    console.log(JSON.stringify({ event: 'trial-round', round, steps: row.pausedAgain.steps, simTime: row.pausedAgain.simTime }));
  }
  await cdp.detach(); cdp = null;
  const controls = [
    ['longsword', { weapon: 'longsword', foeWeapon: 'longsword', foe: 'default' }],
    ['research', { supportProbe: '1', assist: '0.1', catch: 'on', catchScale: '1', weapon: 'morgenstern', foeWeapon: 'longsword', foe: 'default' }],
  ];
  for (const [kind, query] of controls) {
    const url = new URL(base); url.search = new URLSearchParams(query).toString();
    await page.goto(url.href, { waitUntil: 'load', timeout: 30000 });
    await wait(() => window.game?.ai && game?.combat); await install();
    const row = { kind, round: 1 }; entries.push(row);
    await page.locator('#btnStart').tap();
    await wait(() => game.state === 'fight' && game.player.fightT > 0);
    row.started = await read(); expected(row.started, kind);
    await pause(row); expected(row.paused, kind);
    await page.screenshot({ path: path.join(out, `${kind}-paused.png`) });
    console.log(JSON.stringify({ event: 'control-entry', kind, policies: row.started.policies }));
  }
  assert(compiled.some(item => item.name === 'dist/feature-lab.html') && compiled.some(item => item.name === 'dist/index.html') && compiled.some(item => item.name.startsWith('dist/assets/main-')));
  assert(compiled.every(item => item.match)); assert.deepEqual(errors, []); pass = true;
} catch (error) {
  fatal = { name: error.name, message: clean(error.message), stack: clean(error.stack) }; process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  if (cdp) await cdp.detach().catch(() => {});
  if (context) await context.close();
  if (browser) await browser.close();
  const after = await manifest();
  const same = name => JSON.stringify(before[name]) === JSON.stringify(after[name]);
  const buildStable = files.filter(name => name.startsWith('dist/') || name === own).every(same);
  const sourceStable = files.filter(name => !name.startsWith('dist/') && name !== own).every(same);
  pass = pass && buildStable && errors.length === 0 && performance.now() - start < 240000;
  if (!pass) process.exitCode = 1;
  const report = { pass, head, startedUTC, completedUTC: new Date().toISOString(), wallMs: performance.now() - start, base: base.href,
    buildStable, sourceStable, settings, lab, sourceRoster, entries, compiled, errors, fatal, inputRequests,
    tlsVerification: true, proxyRetained: !local,
    limits: ['Chromium mobile emulation; not a physical-phone or human feel acceptance.',
      'Two short trial rounds plus ordinary longsword and explicit old research entry; no long-combat, natural damage or balance claim.',
      'Only saved-settings fixture, observer state, and forwarding afterStep wrapper are written; no RNG, pose, camera, physics, AI or damage assignments.',
      'Screenshots show the native game camera. Card exclusion is a source roster check, not a probability claim from sampled draws.',
      'All requested served artifacts match the frozen dist bytes. Concurrent source edits are reported separately.'] };
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await fs.writeFile(path.join(out, 'manifest-after.json'), JSON.stringify(after, null, 2) + '\n');
  console.log(JSON.stringify({ pass, buildStable, sourceStable, rounds: entries.length, wallMs: report.wallMs, fatal, out }));
}
