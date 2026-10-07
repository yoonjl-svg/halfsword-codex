// One query-free card -> opening movement -> held pause/resume -> restart flow.
// Real browser touch and natural game time only. No RNG, pose, AI or state injection.
// Execution is coordinated by the root agent; preparation/syntax check is not a run.
// PLAYWRIGHT_MODULE=... PLAYWRIGHT_BROWSERS_PATH=... node tools/browser/phase4_entry_20261007.mjs --out=<fresh-directory> [--base=<own-base/>]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const own = 'tools/browser/phase4_entry_20261007.mjs';
const artifactRoot = '/workspace/halfsword-handoff/phase4-20261007/entry';
const args = {};
for (const value of process.argv.slice(2)) {
  const match = /^--(out|base)=(.+)$/.exec(value);
  assert(match && !Object.hasOwn(args, match[1]), 'Only unique --out and --base arguments are accepted');
  args[match[1]] = match[2];
}
assert(args.out, 'Use a fresh external output directory');
const out = path.resolve(args.out);
assert.equal(path.dirname(out), artifactRoot);
await fs.mkdir(artifactRoot, {recursive: true});
assert.equal(await fs.realpath(artifactRoot), artifactRoot);
await fs.mkdir(out);
const base = new URL(args.base || 'https://yoonjl-svg.github.io/halfsword-codex/');
const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
assert(!base.username && !base.password && !base.search && !base.hash && base.pathname.endsWith('/'));
assert(local && ['http:', 'https:'].includes(base.protocol) || base.href === 'https://yoonjl-svg.github.io/halfsword-codex/');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function scan(dir) {
  const files = [];
  for (const item of (await fs.readdir(path.join(root, dir), {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name))) {
    assert(!item.isSymbolicLink());
    const name = dir + '/' + item.name;
    if (item.isDirectory()) files.push(...await scan(name));
    else if (item.isFile()) files.push(name);
  }
  return files;
}
const files = [...(await scan('src')).filter(name => name.endsWith('.js')), own, 'index.html',
  'package.json', 'package-lock.json', ...await scan('dist')].sort();
async function manifest() {
  return Object.fromEntries(await Promise.all(files.map(async name => {
    const bytes = await fs.readFile(path.join(root, name));
    return [name, {bytes: bytes.length, sha256: sha(bytes)}];
  })));
}
const before = await manifest();
const head = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
const startedUTC = new Date().toISOString();
await fs.writeFile(path.join(out, 'manifest-before.json'), JSON.stringify({head, files: before}, null, 2) + '\n', {flag: 'wx'});
await fs.copyFile(path.join(root, own), path.join(out, 'browser-tool-executed.mjs'));
const settings = {difficulty: 'normal', pixel: false, blood: true, sound: false, invertTilt: false,
  moveMode: 'stick', skill: '0.7', guardNames: true, trail: true, fpsCap: true};
const settingsBytes = JSON.stringify(settings);
const errors = [], compiled = [], responseTasks = [], inputRequests = [], shots = [], flow = {}, checks = {};
const launch = {executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-background-networking', '--use-gl=angle', '--use-angle=swiftshader']};
const secrets = [];
if (!local) {
  const raw = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  assert(raw, 'Use the configured session proxy');
  const proxy = new URL(raw);
  launch.proxy = {server: proxy.protocol + '//' + proxy.host};
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
    return !url.username && !url.password && url.origin === base.origin && url.pathname.startsWith(base.pathname)
      && decoded.startsWith(decodeURIComponent(base.pathname)) && !decoded.includes('\\') && !decoded.split('/').some(part => part === '.' || part === '..');
  } catch { return false; }
};
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs');
let browser, context, page, cdp, episode = null, fatal = null, pass = false;
const snap = () => page.evaluate(() => entryProbe.read());
async function shot(name) {
  const before = await snap();
  await page.screenshot({path: path.join(out, name + '.png')});
  const after = await snap();
  shots.push({file: name + '.png', before: {wallMs: before.wallMs, simTime: before.simTime, fightT: before.player.fightT},
    after: {wallMs: after.wallMs, simTime: after.simTime, fightT: after.player.fightT}});
}
function clearInput(row) {
  assert.deepEqual(row.input.stick, {x: 0, y: 0});
  assert.deepEqual(row.input.pending, {x: 0, y: 0});
  assert.equal(row.input.activeTouch, null); assert.equal(row.input.press, null);
  assert.equal(row.input.taps, 0); assert.deepEqual(row.input.keys, []);
}
function policy(row) {
  assert.equal(row.url, base.href, 'The whole flow must stay query-free');
  assert.equal(row.saved, settingsBytes); assert.deepEqual(row.settings, settings);
  assert.equal(row.policies.startHold, 2); assert.equal(row.policies.gravity, -9.81);
  assert.equal(row.policies.finish, 'legacy'); assert.equal(row.policies.limb, true);
  assert.equal(row.policies.default, true);
  // Random cards may offer a gun or a withheld v2 weapon. Do not force the draw or claim all cards use v2.
  assert.equal(row.policies.stance, 'fresh');
  assert.equal(row.player.finite, true); assert.equal(row.enemy.finite, true);
}
try {
  browser = await chromium.launch(launch);
  context = await browser.newContext({viewport: {width: 844, height: 390}, isMobile: true, hasTouch: true,
    ignoreHTTPSErrors: false, serviceWorkers: 'block', recordVideo: {dir: path.join(out, 'video'), size: {width: 844, height: 390}}});
  context.setDefaultTimeout(60000);
  await context.addInitScript(bytes => localStorage.setItem('gladiator-settings', bytes), settingsBytes);
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (!confined(url)) {errors.push({kind: 'blocked', url: clean(url)}); await route.abort('blockedbyclient'); return;}
    try {
      const response = await route.fetch({maxRedirects: 0, maxRetries: 2});
      if (response.status() >= 300 && response.status() < 400) {
        errors.push({kind: 'redirect', url: clean(url), status: response.status()}); await route.abort('blockedbyclient'); return;
      }
      await route.fulfill({response});
    } catch (error) {errors.push({kind: 'route', url: clean(url), message: clean(error.message)}); await route.abort('failed');}
  });
  if (context.routeWebSocket) await context.routeWebSocket('**/*', socket => {errors.push({kind: 'websocket', url: clean(socket.url())}); socket.close();});
  page = await context.newPage();
  page.on('pageerror', error => errors.push({kind: 'pageerror', message: clean(error.message)}));
  page.on('console', message => {if (message.type() === 'error') errors.push({kind: 'console', message: clean(message.text())});});
  page.on('requestfailed', request => errors.push({kind: 'requestfailed', url: clean(request.url()), message: clean(request.failure()?.errorText)}));
  page.on('response', response => {
    if (response.status() >= 400) errors.push({kind: 'http', url: clean(response.url()), status: response.status()});
    const url = new URL(response.url());
    if (!confined(url.href)) return;
    const relative = url.pathname.slice(base.pathname.length);
    if (relative && !(relative.startsWith('assets/') && relative.endsWith('.js'))) return;
    responseTasks.push((async () => {
      const bytes = await response.body(), name = 'dist/' + (relative || 'index.html'), expected = before[name];
      compiled.push({name, bytes: bytes.length, sha256: sha(bytes), match: !!expected && expected.bytes === bytes.length && expected.sha256 === sha(bytes)});
    })().catch(error => errors.push({kind: 'asset', message: clean(error.message)})));
  });
  await page.goto(base.href, {waitUntil: 'load'});
  await page.waitForFunction(() => window.game?.player?.sword && game?.combat && game?.swordsmanshipDefault);
  await page.waitForLoadState('networkidle');
  cdp = await context.newCDPSession(page);
  await page.evaluate(() => {
    const p = window.entryProbe = {phase: 'menu', samples: [], uiEvents: [], native: [], firstRounds: [], steps: 0,
      ids: new WeakMap(), nextId: 1, seen: new WeakSet(), lastT: new WeakMap(), wants: new WeakMap(), nonfinite: 0, uiSignature: null};
    const id = object => {if (!p.ids.has(object)) p.ids.set(object, p.nextId++); return p.ids.get(object);};
    const xyz = vector => [vector.x, vector.y, vector.z];
    const visible = element => !!element && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden';
    const ui = () => ({toast: {text: document.getElementById('toast').textContent, shown: document.getElementById('toast').classList.contains('show')},
      hint: {text: document.getElementById('hint').textContent, shown: document.getElementById('hint').classList.contains('show')},
      joystickShown: visible(document.getElementById('moveStick')), cardStage: game.draw.stage,
      cardClock: game.draw.t, cardIds: [...game.draw.ids], state: game.state});
    const health = f => ({id: id(f), weapon: f.weapon.id, gun: !!f.weapon.gun, alive: f.alive, armed: f.armed,
      state: f.state, fightT: f.fightT, feetHeld: f.feetHeld, position: xyz(f.bodies.pelvis.translation()),
      velocity: xyz(f.bodies.pelvis.linvel()), move: [f.move.x, f.move.y], stumble: [f.stumble.x, f.stumble.y],
      blood: f.blood, pain: f.pain, wounds: f.wounds.length, detached: [...(f.detachedParts ?? [])],
      finite: [...Object.values(f.bodies), f.sword].every(body => [body.translation(), body.rotation(), body.linvel(), body.angvel()].every(value => Object.values(value).every(Number.isFinite)))});
    p.read = () => ({wallMs: performance.now(), simTime: game.stats.simTime, phase: p.phase, url: location.href,
      ui: ui(), objects: {player: id(game.player), enemy: id(game.enemy), world: id(game.world), combat: id(game.combat), ai: id(game.ai)},
      player: health(game.player), enemy: health(game.enemy), footing: p.wants.get(game.player) ?? null,
      policies: {default: game.swordsmanshipDefault.active, v2: game.player.swordsmanshipModel ?? 'legacy',
        stance: game.player.stanceMemoryModel, roll: game.player.rollTargetModel, cut: game.combat.cutReactionModel,
        limb: game.config.COMBAT.limbSeverTrial, finish: game.combat.finishRuleModel,
        startHold: game.config.ARENA.startHold, gravity: game.world.gravity.y, camera: {...game.config.CAMERA}},
      input: {enabled: game.input.enabled, stick: {...game.input.stickMove}, pending: {x: game.input.handDX, y: game.input.handDY},
        activeTouch: game.input.activeTouch, press: game.input.press ? {id: game.input.press.id} : null,
        taps: game.input.taps, keys: [...game.input.keys]}, settings: {...game.settings}, saved: localStorage.getItem('gladiator-settings')});
    const fp = Object.getPrototypeOf(game.player), footing = fp.updateFooting;
    fp.updateFooting = function(dt, forward, right, want) {
      const result = footing.call(this, dt, forward, right, want);
      if (this === game.player) p.wants.set(this, {fightT: this.fightT, feetHeld: this.feetHeld,
        move: [this.move.x, this.move.y], stumble: [this.stumble.x, this.stumble.y], want: xyz(want), dt});
      return result;
    };
    const cp = Object.getPrototypeOf(game.combat), afterStep = cp.afterStep;
    cp.afterStep = function(...args) {
      const result = afterStep.apply(this, args);
      if (this !== game.combat) return result;
      p.steps++;
      const first = !p.seen.has(game.player);
      if (first || game.player.fightT - (p.lastT.get(game.player) ?? -1) >= 0.095) {
        const row = p.read(); p.lastT.set(game.player, game.player.fightT);
        p.samples.push(row);
        if (!row.player.finite || !row.enemy.finite) p.nonfinite++;
        if (first) {p.seen.add(game.player); p.firstRounds.push(row);}
      }
      return result;
    };
    const observeUi = () => {
      const state = ui(), signature = JSON.stringify({...state, cardClock: undefined});
      if (signature === p.uiSignature) return;
      p.uiSignature = signature;
      p.uiEvents.push({wallMs: performance.now(), simTime: game.stats.simTime, fightT: game.player.fightT,
        player: id(game.player), phase: p.phase, state});
    };
    const observer = new MutationObserver(observeUi);
    for (const name of ['toast', 'hint', 'moveStick', 'draw']) observer.observe(document.getElementById(name), {attributes: true, childList: true, subtree: name !== 'draw'});
    p.observer = observer; observeUi();
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(type, event => {
      if (p.native.length < 400) p.native.push({type, trusted: event.isTrusted, kind: event.pointerType,
        target: event.target.closest?.('button')?.id || event.target.id, card: event.target.closest?.('.wcard')?.dataset.i ?? null,
        wallMs: performance.now(), simTime: game.stats.simTime, fightT: game.player.fightT, phase: p.phase,
        x: event.clientX, y: event.clientY});
    }, true);
  });
  flow.menu = await snap(); policy(flow.menu); clearInput(flow.menu);
  async function send(type, points) {
    inputRequests.push({type, points: points.map(point => ({...point}))});
    await cdp.send('Input.dispatchTouchEvent', {type, touchPoints: points});
  }
  async function enter(label, card) {
    await page.evaluate(phase => {entryProbe.phase = phase;}, label + '-cards');
    await page.locator('#btnStart').tap();
    await page.waitForFunction(() => game.state === 'draw' && game.draw.stage === 'choose' && game.draw.t >= 0.5);
    const offered = await snap(); policy(offered); assert.equal(offered.input.enabled, false);
    if (label === 'first') await shot('ordinary-cards');
    await page.locator(`#draw button[data-i="${card}"]`).tap();
    await page.waitForFunction(() => game.state === 'fight');
    const started = await snap(); policy(started);
    assert.equal(started.player.weapon, offered.ui.cardIds[card]);
    assert.equal(started.input.enabled, true); assert.equal(started.ui.joystickShown, true);
    return {offered, card, selected: offered.ui.cardIds[card], started};
  }
  async function opening(label) {
    await page.evaluate(phase => {entryProbe.phase = phase;}, label + '-walk');
    const box = await page.locator('#moveStick').boundingBox(); assert(box);
    const stick = {x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1};
    await send('touchStart', [stick]); stick.y -= 36; await send('touchMove', [stick]);
    const requested = await snap(); policy(requested);
    await page.waitForFunction(() => game.player.fightT >= 2.8 || game.state !== 'fight' || !game.player.alive, null, {timeout: 45000});
    const after = await snap(); policy(after);
    assert.equal(after.ui.state, 'fight'); assert(after.player.alive, 'Opening ended before movement could be observed');
    assert(after.player.fightT < 5, 'Opening exceeded the narrow observation window');
    const samples = await page.evaluate(({id, phase}) => entryProbe.samples.filter(row => row.player.id === id && row.phase === phase), {id: requested.player.id, phase: label + '-walk'});
    const held = samples.filter(row => row.player.feetHeld && Math.hypot(row.input.stick.x, row.input.stick.y) > 0.2);
    const released = samples.filter(row => !row.player.feetHeld && Math.hypot(row.input.stick.x, row.input.stick.y) > 0.2);
    const gap = held.filter(row => row.ui.joystickShown && row.ui.hint.shown && row.ui.hint.text.includes('걷기') && !row.ui.toast.shown);
    const distance = rows => rows.length < 2 ? null : Math.hypot(rows.at(-1).player.position[0] - rows[0].player.position[0], rows.at(-1).player.position[2] - rows[0].player.position[2]);
    const metrics = {earlyHeldInputExposed: held.length > 0, releasedInputExposed: released.length > 0,
      walkingHintWithoutBattleWhileHeld: gap.length > 0, heldSamples: held.length, releasedSamples: released.length,
      heldDisplacementM: distance(held), releasedDisplacementM: distance(released),
      firstHeld: held[0] ?? null, lastHeld: held.at(-1) ?? null, firstReleased: released[0] ?? null, lastReleased: released.at(-1) ?? null,
      guidanceGapFirst: gap[0] ?? null, guidanceGapLast: gap.at(-1) ?? null,
      interpretation: 'feetHeld gates commanded movement; balance motion can remain. Displacement alone is not proof of accepted walking. Compare recorded move/stumble/want. Wall and simulation clocks remain separate.'};
    return {requested, after, metrics, stick};
  }
  async function heldPause(stick, label) {
    await page.evaluate(phase => {entryProbe.phase = phase;}, label);
    const before = await snap(); assert(Math.hypot(...Object.values(before.input.stick)) > 0.2);
    const box = await page.locator('#btnPause').boundingBox(); assert(box);
    const button = {x: box.x + box.width / 2, y: box.y + box.height / 2, id: 2};
    await send('touchStart', [stick, button]); await send('touchEnd', [stick]);
    await page.waitForFunction(() => game.state === 'paused');
    const paused = await snap(); clearInput(paused); assert.equal(paused.input.enabled, false);
    await send('touchEnd', []); await page.waitForTimeout(150);
    const later = await snap(); clearInput(later); policy(later);
    assert.equal(later.simTime, paused.simTime); assert.deepEqual(later.player, paused.player);
    assert.deepEqual(later.enemy, paused.enemy); assert.deepEqual(later.objects, paused.objects);
    return {before, paused, later};
  }
  flow.first = await enter('first', 0);
  flow.first.walk = await opening('first');
  flow.pause = await heldPause(flow.first.walk.stick, 'held-pause');
  await shot('opening-paused');
  await page.locator('#btnResume').tap(); await page.waitForFunction(() => game.state === 'fight');
  flow.resumed = await snap(); policy(flow.resumed); clearInput(flow.resumed);
  assert.deepEqual(flow.resumed.objects, flow.pause.paused.objects);
  await page.locator('#btnPause').tap(); await page.waitForFunction(() => game.state === 'paused');
  flow.beforeRestart = await snap(); clearInput(flow.beforeRestart);
  flow.restart = await enter('restart', 1);
  for (const key of Object.keys(flow.beforeRestart.objects)) assert.notEqual(flow.restart.started.objects[key], flow.beforeRestart.objects[key], 'Restart retained ' + key);
  assert.equal(flow.restart.started.player.wounds, 0); assert.equal(flow.restart.started.enemy.wounds, 0);
  assert.deepEqual(flow.restart.started.player.detached, []); assert.deepEqual(flow.restart.started.enemy.detached, []);
  flow.restart.walk = await opening('restart');
  flow.finalPause = await heldPause(flow.restart.walk.stick, 'restart-held-pause');
  await shot('restart-paused');
  episode = await page.evaluate(() => ({samples: entryProbe.samples, uiEvents: entryProbe.uiEvents, native: entryProbe.native,
    firstRounds: entryProbe.firstRounds, steps: entryProbe.steps, nonfiniteSamples: entryProbe.nonfinite, final: entryProbe.read()}));
  assert(episode.final.simTime < 9, 'One entry flow and restart exceeded the cumulative scope');
  assert.equal(episode.firstRounds.length, 2); assert.equal(episode.nonfiniteSamples, 0);
  assert(episode.native.length > 0 && episode.native.every(event => event.trusted && event.kind === 'touch'));
  assert.equal(episode.native.filter(event => event.type === 'pointerdown' && event.card !== null).length, 2);
  assert.equal(episode.native.filter(event => event.type === 'pointerdown' && event.target === 'btnStart').length, 2);
  checks.queryFreeCardsPauseResumeRestart = 'exposed_pass';
  checks.earlyMovementRequest = [flow.first, flow.restart].every(row => row.walk.metrics.earlyHeldInputExposed) ? 'exposed_both' : 'partially_unexposed';
  checks.postHoldMovementRequest = [flow.first, flow.restart].every(row => row.walk.metrics.releasedInputExposed) ? 'exposed_both' : 'partially_unexposed';
  checks.guidanceGap = [flow.first, flow.restart].some(row => row.walk.metrics.walkingHintWithoutBattleWhileHeld) ? 'observed_overlap_not_user_confusion_proof' : 'not_observed_in_this_flow';
  await Promise.all(responseTasks);
  assert(compiled.some(row => row.name === 'dist/index.html') && compiled.some(row => row.name.startsWith('dist/assets/main-')));
  assert(compiled.every(row => row.match)); assert.deepEqual(errors, []);
  pass = true;
} catch (error) {
  fatal = {name: error.name, message: clean(error.message), stack: clean(error.stack)}; process.exitCode = 1;
  try {
    if (page) {
      episode = await page.evaluate(() => window.entryProbe ? {samples: entryProbe.samples, uiEvents: entryProbe.uiEvents,
        native: entryProbe.native, firstRounds: entryProbe.firstRounds, steps: entryProbe.steps, nonfiniteSamples: entryProbe.nonfinite, final: entryProbe.read()} : null);
      await page.screenshot({path: path.join(out, 'failure.png')});
    }
  } catch {}
} finally {
  if (cdp) await cdp.detach(); await Promise.all(responseTasks);
  if (context) await context.close(); if (browser) await browser.close();
  const after = await manifest(), headAfter = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  const sourceStable = JSON.stringify(before) === JSON.stringify(after) && head === headAfter;
  pass = pass && sourceStable; if (!pass) process.exitCode = 1;
  const report = {pass, passMeaning: 'Entry/card/native-input/pause/restart/source integrity only. Opening exposure and interpretation are reported separately.',
    sourceStable, head, headAfter, startedUTC, completedUTC: new Date().toISOString(), base: base.href,
    scenario: 'One query-free ordinary card entry, opening movement, held pause/resume and one card-based restart; first card0 then card1 without forcing offers.',
    settings, checks, compiled, errors, fatal, shots, flow, episode, inputRequests,
    observer: 'Original Fighter.updateFooting and Combat.afterStep are forwarded unchanged. 10Hz post-step snapshots plus UI transitions and trusted touch events. No every-step finite-state claim.',
    limitations: ['Random weapon cards and opponent are not fixed; no RNG assignment, seed search or state/pose/force/AI injection.',
      'Watching natural simulation time does not step or accelerate the game. Pause freezes through the real UI.',
      'Opening foot hold is a user-selected policy. No duration, camera or movement correction is changed.',
      'Holding feet suppresses requested walking; balance movement may remain. Measured movement is not identical to command acceptance.',
      'Battle toast uses wall time, feetHeld uses simulation time, cards use capped frame delta. Do not add these clocks into claimed phone latency.',
      'One browser flow cannot establish human confusion, all-card balance, physical-phone performance or overall readability.'],
    tlsVerification: true, proxyRetained: !local, redirectsFollowed: false};
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({pass, sourceStable, checks, steps: episode?.steps, simTime: episode?.final?.simTime, fatal, out}));
}
