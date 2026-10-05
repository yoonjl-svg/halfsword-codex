// Compiled mobile sword-assistance entry acceptance. Native input and read-only observers only.
// Usage: node tools/browser/sword_assist_v2_trial.mjs --base=<base/> --out=<fresh-dir>
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
// Public configuration only; every observed game state still comes from compiled window.game.
import { MOTION_ASSIST } from '../../src/motion_assist.js';
assert.equal(MOTION_ASSIST.strength, .15, 'The sword comparison keeps the existing 15% coordination amount');

const options = {};
for (const argument of process.argv.slice(2)) {
  const match = /^--(base|out)=(.+)$/.exec(argument);
  assert.ok(match, 'Only --base=<URL> and --out=<fresh-directory> are supported');
  assert.ok(!Object.hasOwn(options, match[1]), 'Duplicate CLI option');
  options[match[1]] = match[2];
}
const base = new URL(options.base || 'https://yoonjl-svg.github.io/halfsword-codex/');
const local = ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname);
assert.ok(!base.username && !base.password && !base.search && !base.hash, 'Use a base URL without credentials, query, or fragment');
assert.ok(base.pathname.endsWith('/'), 'The base path must end with a slash');
assert.ok((local && ['http:', 'https:'].includes(base.protocol)) ||
  (base.origin === 'https://yoonjl-svg.github.io' && base.pathname === '/halfsword-codex/'), 'Only loopback or own Pages base is allowed');
const artifactRoot = '/workspace/halfsword-handoff/sword-assist-v2-20261005';
assert.ok(options.out, 'Provide --out under the external batch artifact directory');
const out = path.resolve(options.out), relativeOut = path.relative(artifactRoot, out);
assert.ok(relativeOut && !relativeOut.startsWith('../') && !path.isAbsolute(relativeOut), 'Output must be under the external batch artifact directory');
await fs.mkdir(artifactRoot, { recursive: true });
assert.equal(await fs.realpath(artifactRoot), artifactRoot, 'Artifact root must not traverse a symlink');
let parent = artifactRoot;
for (const segment of relativeOut.split(path.sep).slice(0, -1)) {
  parent = path.join(parent, segment);
  try { await fs.mkdir(parent); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  const info = await fs.lstat(parent);
  assert.ok(info.isDirectory() && !info.isSymbolicLink(), 'Artifact parents must be ordinary directories');
}
await fs.mkdir(out, { recursive: false }); // Refuse reuse, including an existing symlink.

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function tree(directory) {
  const names = [];
  for (const entry of (await fs.readdir(path.join(repository, directory), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    assert.ok(!entry.isSymbolicLink(), 'Frozen source/build tree must not contain symlinks');
    const name = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) names.push(...await tree(name));
    else if (entry.isFile()) names.push(name);
  }
  return names;
}
async function manifest() {
  const names = [...(await tree('src')).filter(name => name.endsWith('.js')),
    'index.html', 'public/feature-lab.html', 'package.json', 'package-lock.json',
    'tools/browser/sword_assist_v2_trial.mjs', 'tools/browser/sword_assist_v2_trial.test.mjs',
    'tools/browser/motion_force_trial.test.mjs',
    'tools/browser/integrated_combat_trial.test.mjs', ...await tree('dist')];
  return Object.fromEntries(await Promise.all(names.sort().map(async name => {
    const bytes = await fs.readFile(path.join(repository, name));
    return [name, { bytes: bytes.length, sha256: hash(bytes) }];
  })));
}
const sourceBefore = await manifest();
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim();
const startedUTC = new Date().toISOString();
await fs.writeFile(path.join(out, 'manifest-before.json'), JSON.stringify({ sourceCommit, sourceBefore }, null, 2) + '\n', { flag: 'wx' });

const portrait = { width: 390, height: 844 }, landscape = { width: 844, height: 390 };
const seed = { skill: '0.7', difficulty: 'hard', moveMode: 'stick', sound: false, trail: false,
  guardNames: true, pixel: false, fpsCap: false, blood: true, invertTilt: false };
const seedBytes = JSON.stringify(seed);
const expectedSettings = seed, expectedSavedBytes = seedBytes;
const common = { combatTrial: 'integrated', weapon: 'qinggang', foe: 'heinrich', foeWeapon: 'longsword',
  targetCorrection: 'none', onehandArm: 'manual', bladeShape: 'profile',
  thrustPlane: 'transported', finishRule: 'armorCausal', motionAssist: 'weak', motionTiming: 'sequenced' };
const variants = [
  { id: 'playSwordAssistNone', label: '▶ A · 기존 몸 선행', variant: 'A', comparison: 'sword', model: 'sword-none', swordAssist: 'none', motionTiming: 'sequenced', timingModel: 'sequenced',
    thrustPlane: 'transported', finishRule: 'armorCausal', motionAssist: 'weak', assistModel: 'coordinated', assistStrength: MOTION_ASSIST.strength },
  { id: 'playSwordAssistV2', label: '▶ B · 자세 안내·복귀', variant: 'B', comparison: 'sword', model: 'sword-v2', swordAssist: 'v2', motionTiming: 'sequenced', timingModel: 'sequenced',
    thrustPlane: 'transported', finishRule: 'armorCausal', motionAssist: 'weak', assistModel: 'coordinated', assistStrength: MOTION_ASSIST.strength },
];
const launch = { executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-background-networking', '--use-gl=angle', '--use-angle=swiftshader'] };
const secretStrings = [];
if (!local) {
  const proxyText = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  assert.ok(proxyText, 'Own Pages verification requires the configured environment proxy');
  const proxy = new URL(proxyText);
  launch.proxy = { server: `${proxy.protocol}//${proxy.host}` };
  if (proxy.username) launch.proxy.username = decodeURIComponent(proxy.username);
  if (proxy.password) launch.proxy.password = decodeURIComponent(proxy.password);
  secretStrings.push(proxyText, proxy.username, proxy.password, launch.proxy.username, launch.proxy.password);
}
const sanitize = value => {
  let text = String(value);
  for (const secret of secretStrings.filter(Boolean)) text = text.split(secret).join('[redacted]');
  return text.replace(/https?:\/\/[^\s/@:]+:[^\s/@]+@/gi, 'https://[redacted]@')
    .replace(/\b(authorization|token|password|secret)\s*[:=]\s*[^\s"'<>]+/gi, '$1=[redacted]').slice(0, 4000);
};
const confined = value => {
  try {
    const url = new URL(value);
    if (url.protocol === 'data:') return true;
    if (url.protocol === 'blob:') return new URL(url.pathname).origin === base.origin;
    const decoded = decodeURIComponent(url.pathname);
    return !url.username && !url.password && url.origin === base.origin && url.pathname.startsWith(base.pathname) &&
      decoded.startsWith(decodeURIComponent(base.pathname)) && !decoded.includes('\\') && !decoded.split('/').some(part => part === '..' || part === '.');
  } catch { return false; }
};
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const rows = [], errors = [], httpFailures = [], requestFailures = [], blockedRequests = [], redirectRefusals = [], compiled = [], nativeUI = [];
const responseTasks = [], contexts = [];
let browser, context, page, current = 'setup', fatal = null, pass = false, links, sourceAfter, commitAfter;
const lab = new URL('feature-lab.html#sword-assist-v2-comparison', base);

const layout = () => page.evaluate(() => ({ width: innerWidth, height: innerHeight,
  scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  menuVisible: !!document.getElementById('menu')?.classList.contains('show') }));
const fit = value => assert.ok(value.scrollWidth <= value.width + 1, 'Mobile page has horizontal overflow');
async function ready() {
  await page.waitForFunction(() => window.game?.player?.sword && window.game?.combat && window.game?.integratedCombatTrial, null, { timeout: 60000 });
  const modules = await page.locator('script[type="module"][src]').evaluateAll(nodes => nodes.map(node => node.src));
  assert.equal(modules.length, 1, 'Expected one compiled entry module');
  for (const url of modules) assert.ok(confined(url) && /\/assets\/[^/]+\.js$/.test(new URL(url).pathname), 'Use the compiled production entry');
  await Promise.all(responseTasks);
  for (const url of modules) assert.ok(compiled.some(row => row.url === url && row.matchesFrozenDist), 'Loaded compiled module differs from the frozen dist');
}
async function observe() {
  await page.evaluate(() => {
    const probe = window.integratedProbe = { phase: 'menu', firstFighters: [], firstWorlds: [], firstCombats: [],
      frames: [], native: [], starts: [], navigation: [], initial: { player: game.player, enemy: game.enemy, world: game.world, combat: game.combat } };
    const finite = fighter => [...Object.values(fighter.bodies), fighter.sword].every(body =>
      [body.translation(), body.rotation(), body.linvel(), body.angvel()].every(value => Object.values(value).every(Number.isFinite)));
    const fighter = f => ({ weapon: f.weapon.id, arm: f.onehandArmModel, thrustPlane: f.thrustEdgeModel ?? 'legacy',
      skill: f.skill.level, autoGuard: f.skill.autoGuard, alive: f.alive, armed: f.armed, state: f.state,
      motionAssist: { modelPresent: 'motionAssistModel' in f, strengthPresent: 'motionAssistStrength' in f,
        model: f.motionAssistModel ?? null, strength: f.motionAssistStrength ?? null,
        bodyWeight: typeof f.bodyGuardWeight === 'function' ? f.bodyGuardWeight() : null,
        guardWeight: f.guardWeight(), bodyPose: { ...f.bodyPose } },
      timing: { modelPresent: 'motionTimingModel' in f, statePresent: 'motionTimingState' in f, inputPresent: 'motionTimingInput' in f,
        model: f.motionTimingModel ?? null, state: f.motionTimingState ? { ...f.motionTimingState } : null,
        input: f.motionTimingInput ? { ...f.motionTimingInput } : null,
        sourceGateFields: { index: f.index, oneHand: !!f.guardPose.oneHand, twoHand: !!f.weaponCfg.twoHand,
          armHealth: f.armHealth, limbs: { armS: f.limbs.armS, legF: f.limbs.legF, legB: f.limbs.legB } } },
      swordAssist: { modelPresent: 'swordAssistModel' in f, statePresent: 'swordAssistState' in f,
        model: f.swordAssistModel ?? null, state: f.swordAssistState ? { ...f.swordAssistState } : null,
        sourceGateFields: { alive: f.alive, armed: f.armed, state: f.state, index: f.index,
          armHealth: f.armHealth, legF: f.limbs.legF, legB: f.limbs.legB, pain: f.pain,
          tap: !!f.skill.tap, thrustWeight: f.skill.thrustPose.w, finishAmt: f.finish?.amt ?? 0,
          barge: !!f.barge, lift: f.lift ?? 0, closeW: f.closeW ?? 0,
          held: !!f.handHeld, inputActive: !!f.inputActive, filteredHandSpeed: f.skill.vel.length() } },
      held: !!f.handHeld, inputActive: !!f.inputActive, hand: f.handOffset.toArray(), thrusts: f.skill.thrusts,
      tap: f.skill.tap ? { t: f.skill.tap.t, down: !!f.skill.tap.down, bound: !!f.skill.tap.bound } : null,
      thrustWeight: f.skill.thrustPose.w, finishAmt: f.finish.amt, wounds: f.wounds.length,
      shapeTypes: f.swordColliders.map(collider => collider.shape.type),
      bladeShapeTypes: f.bladeColliders.map(collider => collider.shape.type),
      plate: { ...f.plate }, plateBoxParts: Object.keys(f.plateBoxes), finite: finite(f) });
    probe.read = () => ({ url: location.href, state: game.state, timeS: game.stats.simTime, phase: probe.phase,
      integrated: { ...game.integratedCombatTrial }, finishRule: game.combat.finishRuleModel,
      finishRuleTarget: { available: 'finishRuleFighter' in game.combat,
        identity: game.combat.finishRuleFighter === game.player ? 'player' : game.combat.finishRuleFighter === game.enemy ? 'enemy' : game.combat.finishRuleFighter == null ? 'none' : 'other' },
      thrustPlaneTrial: game.thrustPlaneTrial, bladeShape: { ...game.bladeShapeTrial },
      correction: { ...game.targetCorrectionTrial }, difficulty: game.ai.levelName,
      player: fighter(game.player), enemy: fighter(game.enemy), savedBytes: localStorage.getItem('gladiator-settings'),
      settings: { ...game.settings }, input: { activeTouch: game.input.activeTouch, enabled: game.input.enabled,
        gain: game.input.mobileIntent.verticalGain, source: game.input.mobileIntent.source,
        pending: { x: game.input.handDX, y: game.input.handDY }, taps: game.input.taps,
        press: game.input.press ? { id: game.input.press.id } : null, keys: [...game.input.keys],
        stickMove: { ...game.input.stickMove }, resetAvailable: typeof game.input.resetTransient === 'function',
        useTilt: game.input.useTilt, tiltActive: game.input.tiltActive,
        stickVisible: !!document.getElementById('moveStick')?.classList.contains('show') },
      ui: Object.fromEntries(['skill', 'difficulty'].map(key => [key, {
        selected: document.querySelector(`[data-setting=${key}] button.on`)?.dataset.v,
        locked: [...document.querySelectorAll(`[data-setting=${key}] button`)].every(button => button.disabled) }])),
      navigation: Object.fromEntries(['integratedCombatCompare', 'integratedCombatExit'].map(id => [id, document.getElementById(id)?.href ?? null])) });
    const fighters = new WeakSet(), worlds = new WeakSet(), combats = new WeakSet();
    const fp = Object.getPrototypeOf(game.player), originalFighter = fp.step;
    fp.step = function (...args) {
      if ((this === game.player || this === game.enemy) && !fighters.has(this)) {
        fighters.add(this); probe.firstFighters.push({ role: this === game.player ? 'player' : 'enemy', snapshot: probe.read() });
      }
      return originalFighter.apply(this, args);
    };
    const wp = Object.getPrototypeOf(game.world), originalWorld = wp.step;
    wp.step = function (...args) {
      if (this === game.world && !worlds.has(this)) { worlds.add(this); probe.firstWorlds.push(probe.read()); }
      return originalWorld.apply(this, args);
    };
    const cp = Object.getPrototypeOf(game.combat), originalCombat = cp.afterStep;
    cp.afterStep = function (...args) {
      if (this === game.combat && !combats.has(this)) { combats.add(this); probe.firstCombats.push(probe.read()); }
      const result = originalCombat.apply(this, args);
      if (this === game.combat && probe.frames.length < 20000) probe.frames.push(probe.read());
      return result;
    };
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(type, event => {
      const row = { type, trusted: event.isTrusted, kind: event.pointerType, x: event.clientX, y: event.clientY,
        phase: probe.phase, timeS: game.stats.simTime, eventTime: event.timeStamp, target: event.target.id || '' };
      if (type === 'pointerdown' && ['sword-retouch', 'sword-ready-retouch'].includes(probe.phase) && event.target === game.input.canvas)
        row.swordAssistBeforeInput = fighter(game.player).swordAssist;
      if (event.target === game.input.canvas) probe.native.push(row);
      if (type === 'pointerdown' && event.target.closest?.('#btnStart')) probe.starts.push(row);
      if (type === 'pointerdown' && event.target.closest?.('#integratedCombatCompare, #integratedCombatExit')) probe.navigation.push(row);
    }, true);
  });
}
const snap = () => page.evaluate(() => integratedProbe.read());
function preserved(value) { assert.equal(value.savedBytes, expectedSavedBytes, 'The complete saved settings bytes changed'); assert.deepEqual(value.settings, expectedSettings); }
function transientClean(value) {
  assert.equal(value.input.resetAvailable, true, 'Input must expose resetTransient');
  assert.deepEqual(value.input.pending, { x: 0, y: 0 }); assert.equal(value.input.taps, 0);
  assert.equal(value.input.press, null); assert.equal(value.input.activeTouch, null);
  assert.deepEqual(value.input.keys, []); assert.deepEqual(value.input.stickMove, { x: 0, y: 0 });
}
const swordPhases = { none: ['off'], v2: ['guidance', 'waiting', 'returning', 'ready', 'suspended'] };
const swordNumericFields = ['idleS', 'returnVX', 'returnVY', 'generatedDX', 'generatedDY',
  'homeBlend', 'requestedHomeBlend', 'handDeltaM', 'aimDeltaRad'];
function swordStateContract(state, model) {
  assert.ok(state && swordPhases[model].includes(state.phase), 'Unknown sword-assistance phase');
  for (const key of swordNumericFields) assert.ok(Number.isFinite(state[key]), 'Nonfinite sword telemetry: ' + key);
  assert.ok(state.idleS >= 0 && state.homeBlend >= 0 && state.homeBlend <= 1 &&
    state.requestedHomeBlend >= 0 && state.requestedHomeBlend <= 1, 'Invalid sword telemetry range');
  if (model === 'none') for (const key of swordNumericFields) assert.equal(state[key], 0, 'Baseline sword assistance must stay observational');
}
function swordReset(state, model) {
  swordStateContract(state, model);
  assert.equal(state.phase, model === 'v2' ? 'waiting' : 'off');
  for (const key of swordNumericFields) assert.equal(state[key], 0, 'Fresh sword state must reset: ' + key);
}
function heldSwordProtection(value, variant) {
  swordStateContract(value.player.swordAssist.state, variant.swordAssist);
  const state = value.player.swordAssist.state;
  assert.equal(state.returnVX, 0); assert.equal(state.returnVY, 0);
  assert.equal(state.generatedDX, 0); assert.equal(state.generatedDY, 0);
}
function swordGateEligible(value) {
  const gate = value.player.swordAssist.sourceGateFields;
  return gate.alive && gate.armed && gate.state === 'stand' && gate.index === 0 && !gate.tap &&
    gate.thrustWeight === 0 && !(gate.finishAmt > 0) && !gate.barge && !(gate.lift > 0) &&
    !(gate.closeW > 0) && gate.armHealth >= .75 && gate.legF >= .75 && gate.legB >= .75 && gate.pain < .2;
}
function actualSwordMovement(frames, variant) {
  const samples = frames.filter(value => value.player.held && value.player.inputActive &&
    value.player.timing.input?.active && Math.hypot(value.player.timing.input.dx, value.player.timing.input.dy) > 1e-5);
  for (const value of samples) {
    heldSwordProtection(value, variant);
    // Actual consumed movement cancels the home goal. Existing homeBlend may
    // decay continuously; it is never required to vanish on that input frame.
    assert.equal(value.player.swordAssist.state.requestedHomeBlend, 0);
  }
  return { observed: samples.length > 0, samples,
    limitation: samples.length ? null : 'No post-combat nonzero consumed input sample captured; movement cancellation is unverified. Timing state records retain any zero-step carry.' };
}
async function swordReturnFlow(row, variant) {
  const cdp = await context.newCDPSession(page), requestedInput = [], requestedDelaysMS = [];
  const phase = value => page.evaluate(value => { integratedProbe.phase = value; }, value);
  const send = (type, x, y) => {
    const touchPoints = type === 'touchEnd' ? [] : [{ x, y, id: 1 }];
    requestedInput.push({ type, touchPoints });
    return cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  };
  const delay = async ms => { requestedDelaysMS.push(ms); await page.waitForTimeout(ms); };
  try {
    const before = await snap(); await phase('sword-initial-drag'); await send('touchStart', 620, 230);
    for (let n = 1; n <= 4; n++) { await send('touchMove', 620 + 9 * n, 230 - 9 * n); await delay(35); }
    await page.waitForFunction(() => {
      const event = integratedProbe.native.at(-1);
      return event?.phase === 'sword-initial-drag' && event.type === 'pointermove' &&
        event.trusted && event.x === 656 && event.y === 194 && game.input.handDX === 0 && game.input.handDY === 0;
    }, null, { timeout: 60000 });
    const dragged = await snap(); assert.equal(dragged.player.held, true);
    await phase('sword-release'); await send('touchEnd');
    await page.waitForFunction(() => {
      const event = integratedProbe.native.at(-1);
      return event?.phase === 'sword-release' && event.type === 'pointerup' && event.trusted &&
        game.input.activeTouch === null && !game.player.handHeld && !game.player.inputActive &&
        game.input.handDX === 0 && game.input.handDY === 0 && game.input.taps === 0;
    }, null, { timeout: 60000 });
    const released = await snap(); assert.equal(released.player.thrusts, before.player.thrusts);
    const idleFrameStart = await page.evaluate(() => integratedProbe.frames.length);
    const idleNativeStart = await page.evaluate(() => integratedProbe.native.length);
    await phase('sword-released-idle'); await delay(450);
    await page.waitForFunction(time => game.stats.simTime > time + .37, released.timeS, { timeout: 60000 });
    const idle = await snap(); assert.equal(idle.player.held, false); assert.equal(idle.input.activeTouch, null);
    assert.equal(await page.evaluate(() => integratedProbe.native.length), idleNativeStart, 'Released idle must send no new native input');
    const idleFrames = await page.evaluate(start => integratedProbe.frames.slice(start), idleFrameStart);
    for (const value of idleFrames) swordStateContract(value.player.swordAssist.state, variant.swordAssist);
    const returnObserved = idleFrames.some(value => ['returning', 'ready'].includes(value.player.swordAssist.state.phase));
    await phase('sword-retouch'); const retouchFrameStart = await page.evaluate(() => integratedProbe.frames.length);
    await send('touchStart', 656, 194);
    await page.waitForFunction(start => {
      const event = integratedProbe.native.at(-1);
      return event?.phase === 'sword-retouch' && event.type === 'pointerdown' && event.trusted &&
        game.player.handHeld && game.input.activeTouch !== null &&
        integratedProbe.frames.slice(start).some(value => value.player.held);
    }, retouchFrameStart, { timeout: 60000 });
    const retouched = await snap(); heldSwordProtection(retouched, variant);
    const retouchEvent = await page.evaluate(() => integratedProbe.native.findLast(event => event.phase === 'sword-retouch' && event.type === 'pointerdown'));
    assert.ok(retouchEvent?.trusted && retouchEvent.swordAssistBeforeInput?.state);
    const returnWasActiveAtRetouch = variant.swordAssist === 'v2' && retouchEvent.swordAssistBeforeInput.state.phase === 'returning';
    const interruptionVerified = returnWasActiveAtRetouch && retouched.player.swordAssist.state.phase === 'guidance';
    const heldNativeStart = await page.evaluate(() => integratedProbe.native.length);
    const heldFrameStart = await page.evaluate(() => integratedProbe.frames.length);
    await phase('sword-retouch-held'); await delay(180);
    await page.waitForFunction(time => game.stats.simTime > time + .08, retouched.timeS, { timeout: 60000 });
    const held = await snap(); assert.equal(held.player.held, true); heldSwordProtection(held, variant);
    assert.equal(await page.evaluate(() => integratedProbe.native.length), heldNativeStart, 'Same-point held retouch must send no movement');
    const heldFrames = await page.evaluate(start => integratedProbe.frames.slice(start), heldFrameStart);
    for (const value of heldFrames) { assert.equal(value.player.held, true); heldSwordProtection(value, variant); }
    // Move far enough to make the retouch a drag before releasing it.
    await phase('sword-retouch-drag'); const movementFrameStart = await page.evaluate(() => integratedProbe.frames.length);
    await send('touchMove', 676, 182); await delay(35);
    await send('touchMove', 696, 170); await delay(35);
    await page.waitForFunction(() => {
      const event = integratedProbe.native.at(-1);
      return event?.phase === 'sword-retouch-drag' && event.type === 'pointermove' && event.trusted &&
        event.x === 696 && event.y === 170 && game.input.handDX === 0 && game.input.handDY === 0;
    }, null, { timeout: 60000 });
    const movementFrames = await page.evaluate(start => integratedProbe.frames.slice(start), movementFrameStart);
    const movementCancellation = actualSwordMovement(movementFrames, variant);
    await phase('sword-ready-release'); await send('touchEnd');
    await page.waitForFunction(() => game.input.activeTouch === null && !game.player.handHeld && game.input.handDX === 0 && game.input.handDY === 0);
    const readyReleased = await snap(), readyFrameStart = await page.evaluate(() => integratedProbe.frames.length);
    const readyNativeStart = await page.evaluate(() => integratedProbe.native.length);
    await phase('sword-ready-idle'); await delay(900);
    await page.waitForFunction(time => game.stats.simTime >= time + 1.5, readyReleased.timeS, { timeout: 60000 });
    // The same minimum wait applies to both variants. B additionally waits for
    // actual completion while eligible; lost eligibility is diagnostic, not ready.
    if (variant.swordAssist === 'v2') await page.waitForFunction(() => {
      const f = game.player;
      const eligible = f.alive && f.armed && f.state === 'stand' && f.index === 0 && !f.skill.tap &&
        f.skill.thrustPose.w === 0 && !(f.finish?.amt > 0) && !f.barge && !(f.lift > 0) &&
        !(f.closeW > 0) && f.armHealth >= .75 && f.limbs.legF >= .75 && f.limbs.legB >= .75 && f.pain < .2;
      return f.swordAssistState?.phase === 'ready' || !eligible || game.state !== 'fight';
    }, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => integratedProbe.native.length), readyNativeStart, 'Completed-return wait must send no native input');
    const readyIdle = await snap(), readyIdleFrames = await page.evaluate(start => integratedProbe.frames.slice(start), readyFrameStart);
    const readyWaitEligible = swordGateEligible(readyIdle);
    const readyWait = row.readyWait = { minimumSimSeconds: 1.5, elapsedSimSeconds: readyIdle.timeS - readyReleased.timeS,
      additionalReadyCondition: variant.swordAssist === 'v2', phase: readyIdle.player.swordAssist.state.phase,
      gameState: readyIdle.state, eligible: readyWaitEligible, sourceGateFields: readyIdle.player.swordAssist.sourceGateFields,
      outcome: variant.swordAssist === 'none' ? 'baseline-minimum-wait' :
        readyIdle.state !== 'fight' ? 'not-fighting' : !readyWaitEligible ? 'unavailable' :
        readyIdle.player.swordAssist.state.phase === 'ready' ? 'ready' : 'completion-unverified' };
    for (const value of readyIdleFrames) swordStateContract(value.player.swordAssist.state, variant.swordAssist);
    await phase('sword-ready-retouch'); const readyRetouchFrameStart = await page.evaluate(() => integratedProbe.frames.length);
    await send('touchStart', 696, 170);
    await page.waitForFunction(start => {
      const event = integratedProbe.native.at(-1);
      return event?.phase === 'sword-ready-retouch' && event.type === 'pointerdown' && event.trusted &&
        game.player.handHeld && game.input.activeTouch !== null &&
        integratedProbe.frames.slice(start).some(value => value.player.held);
    }, readyRetouchFrameStart, { timeout: 60000 });
    const readyRetouchEvent = await page.evaluate(() => integratedProbe.native.findLast(event => event.phase === 'sword-ready-retouch' && event.type === 'pointerdown'));
    assert.ok(readyRetouchEvent?.trusted && readyRetouchEvent.swordAssistBeforeInput?.state);
    const completedAtRetouch = variant.swordAssist === 'v2' && readyWait.outcome === 'ready' &&
      swordGateEligible({ player: { swordAssist: readyRetouchEvent.swordAssistBeforeInput } }) &&
      readyRetouchEvent.swordAssistBeforeInput.state.phase === 'ready' &&
      readyRetouchEvent.swordAssistBeforeInput.state.homeBlend > 0;
    const readyHeldNativeStart = await page.evaluate(() => integratedProbe.native.length);
    const readyHeldFrameStart = await page.evaluate(() => integratedProbe.frames.length);
    await phase('sword-ready-held-90');
    await page.waitForFunction(start => integratedProbe.frames.length >= start + 90, readyHeldFrameStart, { timeout: 60000 });
    const readyHeldFrames = await page.evaluate(start => integratedProbe.frames.slice(start, start + 90), readyHeldFrameStart);
    assert.equal(readyHeldFrames.length, 90);
    assert.equal(await page.evaluate(() => integratedProbe.native.length), readyHeldNativeStart, '90 physics frames of same-point hold must send no new native input');
    const homeAtRetouch = readyRetouchEvent.swordAssistBeforeInput.state.homeBlend;
    let continuousEligible = completedAtRetouch, eligiblePrefixFrames = 0;
    for (const value of readyHeldFrames) {
      assert.equal(value.player.held, true); heldSwordProtection(value, variant);
      continuousEligible = continuousEligible && swordGateEligible(value);
      if (continuousEligible) {
        eligiblePrefixFrames++;
        assert.equal(value.player.swordAssist.state.homeBlend, homeAtRetouch, 'Unmoving eligible touch must preserve completed home blend exactly');
        assert.equal(value.player.swordAssist.state.requestedHomeBlend, homeAtRetouch, 'Unmoving eligible touch must preserve the home goal');
      }
    }
    const completedHomeHoldVerified = continuousEligible;
    const readyHeld = await snap(); heldSwordProtection(readyHeld, variant);
    // A second real drag avoids turning the long held touch into a thrust.
    await phase('sword-ready-drag'); const readyMoveFrameStart = await page.evaluate(() => integratedProbe.frames.length);
    await send('touchMove', 716, 158); await delay(35); await send('touchMove', 736, 146); await delay(35);
    await page.waitForFunction(() => {
      const event = integratedProbe.native.at(-1);
      return event?.phase === 'sword-ready-drag' && event.type === 'pointermove' && event.trusted &&
        event.x === 736 && event.y === 146 && game.input.handDX === 0 && game.input.handDY === 0;
    }, null, { timeout: 60000 });
    const readyMoveFrames = await page.evaluate(start => integratedProbe.frames.slice(start), readyMoveFrameStart);
    const completedHomeMovementCancellation = actualSwordMovement(readyMoveFrames, variant);
    await send('touchEnd');
    await page.waitForFunction(() => game.input.activeTouch === null && !game.player.handHeld && game.input.handDX === 0 && game.input.handDY === 0);
    const final = await snap(); assert.equal(final.player.thrusts, before.player.thrusts);
    const native = await page.evaluate(() => integratedProbe.native.filter(event => event.phase.startsWith('sword-')));
    assert.ok(native.length >= 14 && native.every(event => event.trusted && event.kind === 'touch'));
    row.swordReturn = { before, dragged, released, idle, idleFrames, retouchEvent, retouched, held, heldFrames, final,
      movementFrames, movementCancellation, readyReleased, readyIdle, readyIdleFrames, readyWait, readyRetouchEvent,
      readyHeld, readyHeldFrames, completedAtRetouch, completedHomeHoldVerified, eligiblePrefixFrames,
      readyMoveFrames, completedHomeMovementCancellation,
      requestedInput, requestedDelaysMS, native, returnObserved,
      returnWasActiveAtRetouch,
      retouchProtectionVerified: true,
      interruptionVerified,
      completedHoldLimitation: variant.swordAssist === 'none' ? 'Baseline telemetry only.' : !completedAtRetouch ?
        'A completed return with positive homeBlend was not present at the actual second retouch; 90-frame completed-home retention is unverified.' :
        !completedHomeHoldVerified ? 'Eligibility was lost during the 90-frame hold; completed-home retention is unverified for the full window.' : null,
      limitation: variant.swordAssist === 'none' ? 'Baseline telemetry only.' : !returnObserved ?
        'Return was not observed; actual eligibility and phase records require review. No return efficacy claim.' :
        !returnWasActiveAtRetouch ? 'Return was observed earlier, but was not active at delivered retouch; active-return interruption remains unverified.' :
        !interruptionVerified ? 'Return was active at delivered retouch, but the poststep state was unavailable; input protection passed and eligible-return interruption remains unverified.' :
        'Actual return velocity interruption observed at native retouch; the existing home goal is retained until actual movement. Geometry and efficacy remain unverified.' };
    await screenshot(row.id + '-released-idle-retouch', row);
  } finally { await cdp.detach(); }
}
function contract(value, variant) {
  preserved(value);
  assert.ok(value.player.finite && value.enemy.finite, 'Nonfinite physical state');
  assert.equal(value.input.gain, 1.35, 'General mobile gain must remain 1.35');
  assert.equal(value.enemy.arm, 'legacy', 'Integrated features must remain player-only');
  assert.equal(value.enemy.thrustPlane, 'legacy');
  assert.equal(value.enemy.swordAssist.modelPresent, false); assert.equal(value.enemy.swordAssist.statePresent, false);
  assert.equal(value.enemy.timing.modelPresent, false); assert.equal(value.enemy.timing.statePresent, false); assert.equal(value.enemy.timing.inputPresent, false);
  assert.equal(value.enemy.motionAssist.modelPresent, false, 'Enemy must not acquire an optional movement model');
  assert.equal(value.enemy.motionAssist.strengthPresent, false);
  assert.equal(value.enemy.motionAssist.bodyWeight, value.enemy.motionAssist.guardWeight);
  if (!variant) {
    assert.equal(value.integrated.active, false); assert.equal(value.integrated.variant, null);
    assert.equal(value.integrated.motionTiming, null);
    assert.equal(value.integrated.swordAssist, null);
    assert.deepEqual(value.integrated.settings, {}); assert.equal(value.integrated.finishRule, 'legacy');
    assert.equal(value.integrated.thrustPlane, 'legacy'); assert.equal(value.finishRule, 'legacy');
    assert.equal(value.player.arm, 'legacy'); assert.equal(value.player.thrustPlane, 'legacy');
    assert.equal(value.player.motionAssist.modelPresent, false, 'Ordinary play must retain its existing movement policy');
    assert.equal(value.player.motionAssist.strengthPresent, false);
    assert.equal(value.player.swordAssist.modelPresent, false); assert.equal(value.player.swordAssist.statePresent, false);
    assert.equal(value.player.timing.modelPresent, false); assert.equal(value.player.timing.statePresent, false); assert.equal(value.player.timing.inputPresent, false);
    assert.equal(value.player.motionAssist.bodyWeight, value.player.motionAssist.guardWeight);
    assert.equal(value.player.skill, .7); assert.equal(value.player.autoGuard, true);
    assert.equal(value.bladeShape.active, false); assert.equal(value.bladeShape.model, 'box'); assert.equal(value.bladeShape.applied, false);
    assert.equal(value.thrustPlaneTrial, false); assert.equal(value.correction.active, false);
    assert.equal(value.ui.skill.selected, '0.7'); assert.equal(value.ui.difficulty.selected, 'hard');
    assert.equal(value.ui.skill.locked, false); assert.equal(value.ui.difficulty.locked, false);
    return;
  }
  assert.equal(value.integrated.active, true); assert.equal(value.integrated.variant, variant.variant);
  assert.equal(value.integrated.comparison, variant.comparison); assert.equal(value.integrated.model, variant.model);
  assert.equal(value.integrated.motionAssist, variant.motionAssist);
  assert.equal(value.integrated.reason, 'exact_sword_tuple');
  assert.equal(value.integrated.swordAssist, variant.swordAssist);
  assert.equal(value.player.swordAssist.modelPresent, true); assert.equal(value.player.swordAssist.statePresent, true);
  assert.equal(value.player.swordAssist.model, variant.swordAssist);
  swordStateContract(value.player.swordAssist.state, variant.swordAssist);
  assert.equal(value.integrated.motionTiming, variant.motionTiming);
  assert.equal(value.player.timing.modelPresent, true); assert.equal(value.player.timing.statePresent, true);
  assert.equal(value.player.timing.model, variant.timingModel);
  assert.ok(['idle', 'drive', 'brake', 'reverse'].includes(value.player.timing.state?.phase), 'Unknown actual timing phase');
  assert.deepEqual(value.integrated.settings, { skill: '0', difficulty: 'normal' });
  assert.equal(value.integrated.playerOnly, true); assert.equal(value.integrated.finishRule, variant.finishRule);
  assert.equal(value.integrated.thrustPlane, variant.thrustPlane); assert.equal(value.finishRule, variant.finishRule);
  if (variant.finishRule === 'armorCausal' && value.finishRuleTarget.available) assert.equal(value.finishRuleTarget.identity, 'player');
  assert.equal(value.player.weapon, 'qinggang'); assert.equal(value.enemy.weapon, 'longsword');
  assert.equal(value.player.arm, 'manual'); assert.equal(value.player.thrustPlane, variant.thrustPlane);
  assert.equal(value.player.skill, 0); assert.equal(value.player.autoGuard, false); assert.equal(value.difficulty, 'normal');
  assert.equal(value.player.motionAssist.modelPresent, true); assert.equal(value.player.motionAssist.strengthPresent, true);
  assert.equal(value.player.motionAssist.model, variant.assistModel); assert.equal(value.player.motionAssist.strength, variant.assistStrength);
  assert.equal(value.player.motionAssist.guardWeight, 0, 'Motion coordination must remain separate from learned attack guidance');
  const coordinated = value.player.alive && value.player.armed && ['stand', 'kneel'].includes(value.player.state);
  assert.ok(Number.isFinite(value.player.finishAmt), 'Nonfinite finishing weight');
  const finish = Math.max(0, Math.min(1, value.player.finishAmt));
  assert.equal(value.player.motionAssist.bodyWeight, coordinated ? variant.assistStrength * (1 - finish) ** 2 : 0);
  assert.ok(Object.keys(value.player.motionAssist.bodyPose).length >= 4, 'Missing actual body motor goals');
  assert.ok(Object.values(value.player.motionAssist.bodyPose).every(Number.isFinite), 'Nonfinite body motor goal');
  assert.ok(value.bladeShape.active && value.bladeShape.applied); assert.equal(value.bladeShape.model, 'profile');
  assert.deepEqual(value.player.shapeTypes, [1, 0, 1, 9]); assert.deepEqual(value.enemy.shapeTypes, [1, 0, 1, 1]);
  assert.equal(value.thrustPlaneTrial, variant.thrustPlane === 'transported');
  assert.equal(value.ui.skill.selected, '0'); assert.equal(value.ui.difficulty.selected, 'normal');
  assert.ok(value.ui.skill.locked && value.ui.difficulty.locked);
  assert.equal(value.navigation.integratedCombatCompare, lab.href);
  assert.equal(value.navigation.integratedCombatExit, base.href);
}
async function screenshot(name, row) {
  const artifact = name + '.png'; await page.screenshot({ path: path.join(out, artifact) });
  row.artifacts.push(artifact);
}
async function tapNavigate(selector, target) {
  await Promise.all([page.waitForURL(target, { waitUntil: 'load' }), page.locator(selector).tap()]);
  assert.equal(page.url(), target);
}
async function start(ordinary = false, card = 0) {
  await page.locator('#btnStart').tap();
  if (ordinary) {
    await page.waitForFunction(() => game.state === 'draw' && game.draw.stage === 'choose' && game.draw.t >= 1, null, { timeout: 60000 });
    const offered = await page.evaluate(() => [...game.draw.ids]);
    assert.equal(await page.locator('#draw button.wcard').count(), 2);
    await page.locator(`#draw button[data-i="${card}"]`).tap();
    await page.waitForFunction(index => game.draw.pick === index, card);
    await page.waitForFunction(() => game.state === 'fight' && integratedProbe.firstCombats.length > 0, null, { timeout: 60000 });
    assert.equal((await snap()).player.weapon, offered[card]);
    return { card, offered, chosen: offered[card] };
  }
  await page.waitForFunction(() => game.state === 'fight' && integratedProbe.firstCombats.length > 0, null, { timeout: 60000 });
}
async function pause() {
  await page.locator('#btnPause').tap(); await page.waitForFunction(() => game.state === 'paused');
  const paused = await snap(); transientClean(paused); return paused;
}
async function pausedSwordClock(row, variant) {
  if (!variant) return;
  const before = await snap(); await page.waitForTimeout(160); const after = await snap();
  assert.equal(before.state, 'paused'); assert.equal(after.state, 'paused');
  assert.equal(after.timeS, before.timeS, 'Paused simulation time must not advance');
  assert.equal(after.player.swordAssist.state.idleS, before.player.swordAssist.state.idleS, 'Paused sword idle timer must not advance');
  row.pausedSwordClock = { before, after, wallWaitMS: 160 };
}
async function pauseWithHeldTouch(row) {
  assert.equal((await snap()).input.resetAvailable, true);
  const cdp = await context.newCDPSession(page);
  const hand = { x: 620, y: 220, id: 1 };
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [hand] });
    hand.y = 190; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [hand] });
    await page.waitForFunction(() => game.player.handHeld && game.input.activeTouch !== null);
    row.heldBeforePause = await snap(); assert.ok(row.heldBeforePause.input.press && row.heldBeforePause.player.held);
    const bounds = await page.locator('#btnPause').boundingBox(); assert.ok(bounds);
    const button = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, id: 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [hand, button] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [hand] });
    await page.waitForFunction(() => game.state === 'paused'); row.paused = await snap(); transientClean(row.paused);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await cdp.detach(); }
}
async function firstSteps(variant, rounds) {
  const observed = await page.evaluate(() => ({ fighters: integratedProbe.firstFighters, worlds: integratedProbe.firstWorlds, combats: integratedProbe.firstCombats }));
  assert.equal(observed.fighters.filter(row => row.role === 'player').length, rounds);
  assert.equal(observed.fighters.filter(row => row.role === 'enemy').length, rounds);
  assert.equal(observed.worlds.length, rounds); assert.equal(observed.combats.length, rounds);
  for (const value of [...observed.fighters.map(row => row.snapshot), ...observed.worlds, ...observed.combats]) contract(value, variant);
  for (const row of observed.fighters.filter(row => row.role === 'player')) {
    transientClean(row.snapshot);
    if (variant) {
      assert.equal(row.snapshot.player.alive, true); assert.equal(row.snapshot.player.armed, true);
      assert.equal(row.snapshot.player.state, 'stand'); assert.equal(row.snapshot.player.wounds, 0);
      assert.equal(row.snapshot.player.finishAmt, 0);
      assert.equal(row.snapshot.player.timing.state.phase, 'idle', 'Fresh player controller must begin with idle timing state');
      swordReset(row.snapshot.player.swordAssist.state, variant.swordAssist);
      assert.equal(row.snapshot.player.motionAssist.bodyWeight, variant.assistStrength, 'The selected motion policy must exist before the first healthy controller call');
    }
  }
  return observed;
}
async function gestures(row) {
  const cdp = await context.newCDPSession(page), requestedInput = [], requestedDelaysMS = [];
  const send = (type, x, y, timestamp) => {
    const touchPoints = type === 'touchEnd' ? [] : [{ x, y, id: 1 }];
    requestedInput.push({ type, touchPoints });
    return cdp.send('Input.dispatchTouchEvent', { type, ...(timestamp === undefined ? {} : { timestamp }), touchPoints });
  };
  const phase = value => page.evaluate(value => { integratedProbe.phase = value; }, value);
  const delay = async value => { requestedDelaysMS.push(value); await page.waitForTimeout(value); };
  try {
    const before = await snap(); await phase('side-drag'); await send('touchStart', 620, 210);
    for (let n = 1; n <= 4; n++) { await send('touchMove', 620 + 12 * n, 210); await delay(45); }
    const side = await snap(); await phase('diagonal-drag');
    for (let n = 1; n <= 6; n++) { await send('touchMove', 668 + 8 * n, 210 + 8 * n); await delay(45); }
    // CDP completion can precede page delivery. Begin the no-event hold only
    // after the final native move arrived and its queued hand delta was consumed.
    await page.waitForFunction(() => {
      const last = integratedProbe.native.at(-1);
      return last?.type === 'pointermove' && last.phase === 'diagonal-drag' &&
        last.trusted && last.kind === 'touch' && last.x === 716 && last.y === 258 &&
        game.input.handDX === 0 && game.input.handDY === 0;
    }, null, { timeout: 60000 });
    const diagonal = await snap(); assert.ok(side.player.held && diagonal.player.held);
    // No repeated zero-motion events: the same native pointer remains held through the stop.
    await phase('held-stop'); const stopStart = await snap(), stopWallStart = Date.now();
    const stopFrameStart = await page.evaluate(() => integratedProbe.frames.length);
    const stopNativeStart = await page.evaluate(() => integratedProbe.native.length);
    await delay(280);
    await page.waitForFunction(time => game.stats.simTime > time + .12 && game.player.handHeld && game.input.activeTouch !== null, stopStart.timeS, { timeout: 60000 });
    const stopped = await snap(), stopWallMS = Date.now() - stopWallStart;
    const stopFrames = await page.evaluate(start => integratedProbe.frames.slice(start), stopFrameStart);
    assert.ok(stopFrames.length && stopped.player.held && stopped.input.activeTouch === diagonal.input.activeTouch);
    const variant = variants.find(value => value.variant === row.variant);
    for (const value of stopFrames) { assert.equal(value.player.held, true); heldSwordProtection(value, variant); }
    assert.equal(await page.evaluate(() => integratedProbe.native.length), stopNativeStart, 'Stationary hold must not send new native input');
    await screenshot(row.id + '-held-stop', row); await phase('reverse');
    for (let n = 1; n <= 6; n++) { await send('touchMove', 716 - 14 * n, 258 - 7 * n); await delay(45); }
    const reversed = await snap(); assert.ok(reversed.player.held); await phase('recut');
    for (let n = 1; n <= 5; n++) { await send('touchMove', 632 + 10 * n, 216 + 10 * n); await delay(45); }
    const recut = await snap(); assert.ok(recut.player.held); await send('touchEnd');
    await page.waitForFunction(() => game.input.activeTouch === null && !game.player.handHeld);
    const released = await snap(); assert.equal(released.player.thrusts, before.player.thrusts, 'Continuous native drags must not become a tap');
    await screenshot(row.id + '-reverse-recut-release', row); await phase('tap');
    const timestamp = Date.now() / 1000;
    await send('touchStart', 620, 220, timestamp); await delay(80); await send('touchEnd', 0, 0, timestamp + .08);
    await page.waitForFunction(count => game.player.skill.thrusts === count + 1, released.player.thrusts, { timeout: 10000 });
    const tapped = await snap(); await screenshot(row.id + '-native-tap', row);
    await page.waitForFunction(() => !game.player.skill.tap, null, { timeout: 15000 });
    await phase('after-release'); const final = await snap();
    assert.ok(!final.player.held && final.input.activeTouch === null && final.timeS > before.timeS);
    const native = await page.evaluate(() => [...integratedProbe.native]);
    assert.ok(native.length >= 25 && native.every(event => event.trusted && event.kind === 'touch'));
    for (const name of ['side-drag', 'diagonal-drag', 'reverse', 'recut']) {
      const moves = native.filter(event => event.phase === name && event.type === 'pointermove');
      assert.ok(moves.length > 0, 'Missing native motion phase: ' + name);
    }
    const sideMoves = native.filter(event => event.phase === 'side-drag' && event.type === 'pointermove');
    const reverseMoves = native.filter(event => event.phase === 'reverse' && event.type === 'pointermove');
    assert.ok(sideMoves.at(-1).x > sideMoves[0].x && reverseMoves.at(-1).x < reverseMoves[0].x, 'Requested reversal must reverse native lateral direction');
    assert.ok(native.some(event => event.phase === 'recut' && event.type === 'pointerup'));
    assert.ok(native.some(event => event.phase === 'tap' && event.type === 'pointerup'));
    row.touch = { before, side, diagonal, stopStart, stopped, stopWallMS,
      stopFrames, reversed, recut, released, tapped, final, requestedInput, requestedDelaysMS, native };
  } finally { await cdp.detach(); }
}
function timingSummary(frames) {
  const knownPhases = ['idle', 'drive', 'brake', 'reverse'];
  const phaseCounts = Object.fromEntries(knownPhases.map(phase => [phase, 0])), transitions = [], samples = [], batches = [];
  const seenSamples = new Set(), seenBatches = new Set(); let previous = null;
  for (const frame of frames) {
    const actualPhase = frame.player.timing.state?.phase ?? null;
    phaseCounts[actualPhase ?? 'absent'] = (phaseCounts[actualPhase ?? 'absent'] ?? 0) + 1;
    const sampleKey = JSON.stringify(frame.player.timing.input);
    if (frame.player.timing.input && !seenSamples.has(sampleKey)) {
      seenSamples.add(sampleKey); samples.push({ timeS: frame.timeS, input: frame.player.timing.input });
    }
    const state = frame.player.timing.state;
    if (state) {
      const key = JSON.stringify([state.lastBatchId, state.consumedBatchId, state.lastInputTimeS]);
      if (!seenBatches.has(key)) {
        seenBatches.add(key); batches.push({ timeS: frame.timeS, lastBatchId: state.lastBatchId,
          consumedBatchId: state.consumedBatchId, batchCount: state.batchCount, consumeCount: state.consumeCount,
          lastInputTimeS: state.lastInputTimeS, lastMotionTimeS: state.lastMotionTimeS,
          directionX: state.directionX, directionY: state.directionY, held: state.held, released: state.released });
      }
    }
    if (actualPhase !== previous) transitions.push({ from: previous, to: actualPhase, timeS: frame.timeS,
      gesturePhase: frame.phase, input: frame.player.timing.input, state: frame.player.timing.state,
      sourceGateFields: { ...frame.player.timing.sourceGateFields, alive: frame.player.alive, armed: frame.player.armed,
        state: frame.player.state, arm: frame.player.arm, weapon: frame.player.weapon,
        tap: frame.player.tap, thrustWeight: frame.player.thrustWeight, finishAmt: frame.player.finishAmt } });
    previous = actualPhase;
  }
  const unobserved = ['drive', 'brake', 'reverse'].filter(phase => !phaseCounts[phase]);
  return { observedFrames: frames.length, phaseCounts, transitions, actualPhaseChanged: transitions.length > 1,
    knownPhases, unknownPhases: Object.keys(phaseCounts).filter(phase => !knownPhases.includes(phase)),
    consumedInputSamples: samples, inputSamplesObserved: samples.length > 0, batchObservations: batches,
    inputSampleLimitation: samples.length ? null : 'Raw consumed dx/dy samples are not exposed. Actual timing-state batch IDs, times, normalized direction and counters are recorded; requested CDP coordinates do not prove consumed delta bytes.',
    unobserved, timingObservationComplete: unobserved.length === 0,
    reviewRequired: unobserved.length > 0,
    observationStatus: transitions.length <= 1 ? 'Only model/input entry acceptance; timing intervention unverified and requires root review.' :
      unobserved.length ? 'Some timing phases observed; missing phases require root review.' : 'Required timing phases observed; force efficacy remains unverified.',
    scope: 'Actual post-combat timing-state observations; gesture labels are observer metadata, and phase changes do not prove force or movement efficacy.' };
}
function swordSummary(frames, model) {
  const knownPhases = swordPhases[model], phaseCounts = Object.fromEntries(knownPhases.map(phase => [phase, 0]));
  const transitions = [], unavailable = []; let previous = null;
  for (const frame of frames) {
    const state = frame.player.swordAssist.state; swordStateContract(state, model);
    phaseCounts[state.phase] = (phaseCounts[state.phase] ?? 0) + 1;
    if (state.phase !== previous) transitions.push({ from: previous, to: state.phase, timeS: frame.timeS,
      gesturePhase: frame.phase, state, sourceGateFields: frame.player.swordAssist.sourceGateFields });
    if (state.phase === 'suspended' && unavailable.length < 100) unavailable.push({ timeS: frame.timeS,
      gesturePhase: frame.phase, state, sourceGateFields: frame.player.swordAssist.sourceGateFields });
    previous = state.phase;
  }
  const returnObserved = !!(phaseCounts.returning || phaseCounts.ready);
  return { model, knownPhases, observedFrames: frames.length, phaseCounts, transitions, unavailable,
    returnObserved, reviewRequired: model === 'v2' && !returnObserved,
    observationStatus: model === 'none' ? 'Observational baseline off state only.' : returnObserved ?
      'Actual return state observed; geometry and efficacy remain unverified.' :
      'Return not observed; actual eligibility, filtered hand speed, phase and timing records require review.',
    scope: 'Actual post-combat sword telemetry and eligibility facts. Numerical command and pose deltas do not prove geometry efficacy or optimal force.' };
}
async function restart(row, variant, ordinary = false) {
  await page.evaluate(() => { integratedProbe.restartReference = { player: game.player, enemy: game.enemy, world: game.world,
    combat: game.combat, swordState: game.player.swordAssistState }; });
  await pauseWithHeldTouch(row); await pausedSwordClock(row, variant); row.restartChoice = await start(ordinary, 1);
  await page.waitForFunction(() => ['player', 'enemy', 'world', 'combat'].every(key => game[key] !== integratedProbe.restartReference[key]) && integratedProbe.firstCombats.length === 2, null, { timeout: 60000 });
  row.restarted = await snap(); contract(row.restarted, variant);
  row.newObjects = await page.evaluate(() => Object.fromEntries(['player', 'enemy', 'world', 'combat'].map(key => [key, game[key] !== integratedProbe.restartReference[key]])));
  if (variant) row.newObjects.swordState = await page.evaluate(() => game.player.swordAssistState !== integratedProbe.restartReference.swordState);
  assert.ok(Object.values(row.newObjects).every(Boolean)); row.firstSteps = await firstSteps(variant, 2);
  const probe = await page.evaluate(() => ({ frames: integratedProbe.frames, starts: integratedProbe.starts, navigation: integratedProbe.navigation }));
  assert.ok(probe.frames.length && probe.frames.every(value => value.player.finite && value.enemy.finite));
  assert.equal(probe.starts.length, 2); assert.ok(probe.starts.every(event => event.trusted && event.kind === 'touch'));
  row.probe = probe; if (variant) {
    row.timingSummary = timingSummary(probe.frames);
    assert.deepEqual(row.timingSummary.unknownPhases, [], 'Controller exposed an unknown timing phase');
    row.swordSummary = swordSummary(probe.frames, variant.swordAssist);
  }
  await screenshot(row.id + '-restarted', row);
}

async function setupContext() {
  context = await browser.newContext({ viewport: portrait, isMobile: true, hasTouch: true, ignoreHTTPSErrors: false,
    serviceWorkers: 'block', recordVideo: { dir: path.join(out, 'video'), size: landscape } });
  contexts.push(context);
  context.setDefaultTimeout(60000);
  await context.exposeBinding('recordIntegratedNativeUI', (_source, event) => nativeUI.push({ id: current, ...event }));
  await context.addInitScript(() => document.addEventListener('pointerdown', event => {
    const element = event.target.closest?.('#playSwordAssistNone, #playSwordAssistV2, #integratedCombatCompare, #integratedCombatExit, #btnStart, #btnPause, #btnResume, #draw button.wcard, [data-setting=moveMode] button[data-v=tilt]');
    if (element) window.recordIntegratedNativeUI({ url: location.href, element: element.id || (element.matches('.wcard') ? 'card-' + element.dataset.i : 'moveMode-tilt'),
      trusted: event.isTrusted, kind: event.pointerType, x: event.clientX, y: event.clientY });
  }, true));
  await context.route('**/*', async route => {
    if (!confined(route.request().url())) {
      blockedRequests.push({ id: current, url: sanitize(route.request().url()) }); await route.abort('blockedbyclient'); return;
    }
    try {
      // Playwright can follow redirects after route.continue without rerouting them.
      // Fetch the authorized URL once with redirects disabled, then give its bytes to the browser.
      const response = await route.fetch({ maxRedirects: 0 });
      if (response.status() >= 300 && response.status() < 400) {
        redirectRefusals.push({ id: current, url: sanitize(route.request().url()), status: response.status() });
        await route.abort('blockedbyclient'); return;
      }
      await route.fulfill({ response });
    } catch (error) {
      requestFailures.push({ id: current, type: 'route-fetch', message: sanitize(error.message) }); await route.abort('failed');
    }
  });
  if (context.routeWebSocket) await context.routeWebSocket('**/*', socket => {
    blockedRequests.push({ id: current, type: 'websocket', url: sanitize(socket.url()) }); socket.close({ code: 1008, reason: 'Network scope excludes WebSockets' });
  });
  page = await context.newPage();
  page.on('pageerror', error => errors.push({ id: current, type: 'pageerror', message: sanitize(error.message) }));
  page.on('console', message => { if (message.type() === 'error') errors.push({ id: current, type: 'console', message: sanitize(message.text()) }); });
  page.on('requestfailed', request => requestFailures.push({ id: current, url: sanitize(request.url()), error: sanitize(request.failure()?.errorText) }));
  page.on('response', response => {
    const id = current;
    if (response.status() >= 400) httpFailures.push({ id, status: response.status(), url: sanitize(response.url()) });
    const url = new URL(response.url());
    if (!confined(url.href) || !/\/assets\/[^/]+\.js$/.test(url.pathname)) return;
    responseTasks.push((async () => {
      const bytes = await response.body(), name = 'dist/' + decodeURIComponent(url.pathname.slice(base.pathname.length));
      const expected = sourceBefore[name], sha256 = hash(bytes);
      compiled.push({ id, url: url.href, bytes: bytes.length, sha256, matchesFrozenDist: !!expected && expected.bytes === bytes.length && expected.sha256 === sha256 });
    })().catch(error => errors.push({ id, type: 'compiled-response', message: sanitize(error.message) })));
  });
}

try {
  browser = await chromium.launch(launch); await setupContext();
  current = 'feature-lab'; await page.goto(lab.href, { waitUntil: 'load' }); fit(await layout());
  links = await page.evaluate(ids => Object.fromEntries(ids.map(id => [id, document.getElementById(id)?.href ?? null])), variants.map(row => row.id));
  const labels = await page.evaluate(ids => Object.fromEntries(ids.map(id => [id, document.getElementById(id)?.textContent?.trim() ?? null])), variants.map(row => row.id));
  for (const variant of variants) {
    assert.equal(labels[variant.id], variant.label, 'The entry label must describe the current sword-assistance comparison');
    assert.ok(links[variant.id], 'Missing integrated comparison CTA'); const url = new URL(links[variant.id]);
    assert.ok(confined(url.href)); assert.equal(url.pathname, base.pathname); assert.equal(url.hash, '');
    const expected = { ...common, swordAssist: variant.swordAssist };
    assert.equal([...url.searchParams].length, 12); assert.deepEqual(Object.fromEntries(url.searchParams), expected);
  }
  const aParams = new URL(links.playSwordAssistNone).searchParams, bParams = new URL(links.playSwordAssistV2).searchParams;
  assert.equal(aParams.get('swordAssist'), 'none'); assert.equal(bParams.get('swordAssist'), 'v2');
  aParams.delete('swordAssist'); bParams.delete('swordAssist');
  assert.deepEqual(Object.fromEntries(aParams), Object.fromEntries(bParams), 'Sword A/B links must differ only in sword assistance');
  // Deliberately seed once, on the feature page; later navigation must preserve these exact bytes.
  await page.evaluate(value => localStorage.setItem('gladiator-settings', value), seedBytes);
  await page.screenshot({ path: path.join(out, 'feature-lab-portrait.png'), fullPage: true });
  for (const variant of variants) {
    current = variant.id; await page.setViewportSize(portrait); fit(await layout());
    const row = { id: variant.id, variant: variant.variant, url: links[variant.id], artifacts: [] }; rows.push(row);
    await tapNavigate('#' + variant.id, links[variant.id]); await ready(); await observe();
    row.portrait = await layout(); fit(row.portrait); assert.ok(row.portrait.menuVisible);
    row.menu = await snap(); contract(row.menu, variant);
    assert.ok(Object.values(row.menu.enemy.plate).some(value => value > 0) && row.menu.enemy.plateBoxParts.length, 'Selected enemy must have actual initialized plate armor');
    await screenshot(row.id + '-portrait', row); await page.setViewportSize(landscape); fit(await layout());
    await start(); row.started = await snap(); contract(row.started, variant); await firstSteps(variant, 1);
    // Run the short gesture/tap acceptance before the long idle-return hold.
    // Use the actual restart for a fresh second round; AI and physics stay live.
    // Otherwise a normal late knockdown can correctly reject the explicit tap.
    await screenshot(row.id + '-fight', row); await gestures(row); contract(row.touch.final, variant);
    await restart(row, variant);
    await swordReturnFlow(row, variant); contract(row.swordReturn.final, variant);
    row.probe = await page.evaluate(() => ({ frames: integratedProbe.frames, starts: integratedProbe.starts, navigation: integratedProbe.navigation }));
    assert.ok(row.probe.frames.every(value => value.player.finite && value.enemy.finite));
    row.timingSummary = timingSummary(row.probe.frames);
    row.swordSummary = swordSummary(row.probe.frames, variant.swordAssist);
    await pause();
    const selector = variant.variant === 'A' ? '#integratedCombatCompare' : '#integratedCombatExit';
    const target = variant.variant === 'A' ? lab.href : base.href;
    await tapNavigate(selector, target); row.navigationTarget = page.url(); row.pass = true;
  }
  const [aTouch, bTouch] = rows.filter(row => row.touch).map(row => row.touch);
  assert.deepEqual(aTouch.requestedInput, bTouch.requestedInput, 'Sword A/B must receive the same requested native touch coordinates');
  assert.deepEqual(aTouch.requestedDelaysMS, bTouch.requestedDelaysMS, 'Sword A/B must use the same requested gesture delays');
  const [aReturn, bReturn] = rows.filter(row => row.swordReturn).map(row => row.swordReturn);
  assert.deepEqual(aReturn.requestedInput, bReturn.requestedInput);
  assert.deepEqual(aReturn.requestedDelaysMS, bReturn.requestedDelaysMS);
  current = 'ordinary-return'; await page.setViewportSize(portrait); await ready(); await observe();
  const ordinary = { id: current, url: page.url(), artifacts: [] }; rows.push(ordinary);
  assert.equal(new URL(ordinary.url).search, ''); ordinary.portrait = await layout(); fit(ordinary.portrait);
  ordinary.menu = await snap(); contract(ordinary.menu, null); assert.deepEqual(ordinary.menu.player.shapeTypes, [1, 0, 1, 1]);
  await screenshot(ordinary.id + '-portrait', ordinary); await page.setViewportSize(landscape); fit(await layout());
  ordinary.firstChoice = await start(true, 0); ordinary.started = await snap(); contract(ordinary.started, null);
  await firstSteps(null, 1); await screenshot(ordinary.id + '-fight', ordinary); await restart(ordinary, null, true);
  ordinary.pass = true;
  // Invalid marked entries retain their raw URL but must sanitize every game/input override.
  for (const [id, mutate] of [
    ['malformed-unknown-sword', url => { url.searchParams.set('swordAssist', 'unsupported'); url.searchParams.set('mobileVerticalGain', '1.8'); }],
    ['malformed-duplicate-sword', url => { url.searchParams.append('swordAssist', 'none'); }],
  ]) {
    current = id; const url = new URL(links.playSwordAssistV2); mutate(url);
    await page.setViewportSize(portrait); await page.goto(url.href, { waitUntil: 'load' }); await ready(); await observe();
    const row = { id, url: page.url(), menuOnly: true, artifacts: [], portrait: await layout(), menu: await snap() }; rows.push(row);
    fit(row.portrait); assert.ok(row.portrait.menuVisible); contract(row.menu, null); transientClean(row.menu);
    assert.equal(row.menu.integrated.requested, true); assert.equal(row.menu.integrated.reason, 'unsupported_or_incomplete_tuple');
    assert.equal(row.menu.input.source, 'default'); assert.equal(row.menu.input.gain, 1.35);
    row.firstSteps = await page.evaluate(() => ({ fighters: integratedProbe.firstFighters.length, worlds: integratedProbe.firstWorlds.length, combats: integratedProbe.firstCombats.length }));
    assert.deepEqual(row.firstSteps, { fighters: 0, worlds: 0, combats: 0 });
    await screenshot(id + '-portrait', row); row.pass = true;
  }
  await Promise.all(responseTasks);
  assert.deepEqual(blockedRequests, []); assert.deepEqual(redirectRefusals, []);
  assert.deepEqual(httpFailures, []); assert.deepEqual(requestFailures, []); assert.deepEqual(errors, []);
  assert.ok(nativeUI.length && nativeUI.every(event => event.trusted && event.kind === 'touch'));
  for (const id of ['playSwordAssistNone', 'playSwordAssistV2', 'integratedCombatCompare', 'integratedCombatExit'])
    assert.equal(nativeUI.filter(event => event.element === id).length, 1, 'Expected exactly one trusted tap of each entry/navigation link');
  assert.equal(nativeUI.filter(event => event.element === 'btnStart').length, 6);
  assert.equal(nativeUI.filter(event => event.element.startsWith('card-')).length, 2);
  pass = true;
} catch (error) {
  fatal = { id: current, name: error.name, message: sanitize(error.message), stack: sanitize(error.stack) };
  process.exitCode = 1;
} finally {
  if (!pass && page) {
    try { await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }); } catch {}
    try { await fs.writeFile(path.join(out, 'failure-state.json'), JSON.stringify(await snap(), null, 2) + '\n', { flag: 'wx' }); } catch {}
  }
  await Promise.all(responseTasks);
  for (const scenarioContext of contexts) await scenarioContext.close();
  if (browser) await browser.close();
  sourceAfter = await manifest(); commitAfter = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim();
  const sourceStable = sourceCommit === commitAfter && JSON.stringify(sourceBefore) === JSON.stringify(sourceAfter);
  pass = pass && sourceStable; if (!pass) process.exitCode = 1;
  await fs.writeFile(path.join(out, 'summary.json'), JSON.stringify({ pass, sourceStable, sourceCommit, commitAfter,
    sourceBefore, sourceAfter, startedUTC, completedUTC: new Date().toISOString(), base: base.href,
    tlsVerification: true, environmentProxyRetained: !local, redirectsFollowed: false, networkScope: base.href, outputArtifactsAreRelative: true,
    seedSettings: seed, savedSettingsExpectedBytes: seedBytes, motionAssistStrength: MOTION_ASSIST.strength,
    passMeaning: 'Compiled entry, model selection, native input, return telemetry, lifecycle and preference acceptance only; sword and force efficacy remain unverified. Missing actual return, active-return velocity interruption, eligible completed-home hold or actual movement cancellation requires review.',
    timingObservations: rows.filter(row => row.timingSummary).map(row => ({ id: row.id, variant: row.variant, ...row.timingSummary })),
    swordObservations: rows.filter(row => row.swordSummary).map(row => ({ id: row.id, variant: row.variant, ...row.swordSummary })),
    returnObservationReviewRequired: rows.some(row => row.variant === 'B' && (!row.swordReturn?.returnObserved ||
      !row.swordReturn?.interruptionVerified || !row.swordReturn?.completedHomeHoldVerified ||
      !row.swordReturn?.movementCancellation?.observed || !row.swordReturn?.completedHomeMovementCancellation?.observed)),
    swordAssistEfficacyVerified: false,
    forceEfficacyVerified: false,
    links, compiled, rows, nativeUI, errors, httpFailures, requestFailures, blockedRequests, redirectRefusals, fatal,
    artifacts: ['manifest-before.json', 'feature-lab-portrait.png', 'video/'],
    scope: 'Actual frozen compiled mobile sword-none/v2 CTA entry with identical weak assistance, sequenced body lead, manual/profile/transported/armorCausal settings. Checks player-only sword state before first healthy controller calls, original active enemy/combat, short first-round gestures/tap then actual-restart second-round native drag/released idle/real retouch velocity interruption, stationary held zero return motion without requiring the existing home goal to vanish, completed positive-home retouch and exact home goal retention across 90 eligible physics frames with no new native events, actual consumed nonzero movement cancelling the home goal while stored blend may decay, lateral/diagonal drag, delivered stationary hold barrier, same-pointer reverse/recut, tap/release, pause without simulated timer aging, held-pause/new-state restart, real comparison/ordinary navigation, ordinary card choice/restart, exact saved preference bytes, layout and errors. Identical coordinates and requested delays apply to A/B; A remains observational off. Actual telemetry and source gate facts distinguish missing return, nonactive interruption, eligibility loss during the hold, and uncaptured actual movement as explicitly unverified. Malformed sword tuples are menu-only. Historical 9/10/11-key compatibility and unchanged sensor fallback are covered separately. No injury, AI, pose, controller or input state injection. Geometry efficacy, optimal force, historical authenticity, human maximum force, work/efficiency, stronger impacts, naturalness, post-injury recovery, foot support, physical stopping, phone performance and feel are outside this entry acceptance screen.' }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ pass, sourceStable, rows: rows.length, failure: fatal?.id ?? null, out }));
}
