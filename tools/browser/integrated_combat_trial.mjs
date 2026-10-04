// Compiled mobile entry acceptance. Native input and read-only observers only.
// Usage: node tools/browser/integrated_combat_trial.mjs --base=<base/> --out=<fresh-dir>
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
// Public configuration only; every observed game state still comes from compiled window.game.
import { MOTION_ASSIST } from '../../src/motion_assist.js';

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
const artifactRoot = '/workspace/halfsword-handoff/motion-assist-20261005';
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
    'tools/browser/integrated_combat_trial.mjs', 'tools/browser/integrated_combat_trial.test.mjs', ...await tree('dist')];
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
let expectedSettings = seed, expectedSavedBytes = seedBytes;
const common = { combatTrial: 'integrated', weapon: 'qinggang', foe: 'heinrich', foeWeapon: 'longsword',
  targetCorrection: 'none', onehandArm: 'manual', bladeShape: 'profile' };
const variants = [
  { id: 'playIntegratedLegacy', variant: 'A', comparison: 'motion', model: 'motion-none',
    thrustPlane: 'transported', finishRule: 'armorCausal', motionAssist: 'none', assistModel: 'none', assistStrength: 0 },
  { id: 'playIntegratedCombined', variant: 'B', comparison: 'motion', model: 'motion-weak',
    thrustPlane: 'transported', finishRule: 'armorCausal', motionAssist: 'weak', assistModel: 'coordinated', assistStrength: MOTION_ASSIST.strength },
];
const historicalVariants = [
  { id: 'historical-nine-key-A', variant: 'A', comparison: 'compound', model: 'baseline',
    thrustPlane: 'legacy', finishRule: 'legacy', motionAssist: 'none', assistModel: 'none', assistStrength: 0 },
  { id: 'historical-nine-key-B', variant: 'B', comparison: 'compound', model: 'combined',
    thrustPlane: 'transported', finishRule: 'armorCausal', motionAssist: 'none', assistModel: 'none', assistStrength: 0 },
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
const lab = new URL('feature-lab.html#integrated-combat-comparison', base);

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
function contract(value, variant) {
  preserved(value);
  assert.ok(value.player.finite && value.enemy.finite, 'Nonfinite physical state');
  assert.equal(value.input.gain, 1.35, 'General mobile gain must remain 1.35');
  assert.equal(value.enemy.arm, 'legacy', 'Integrated features must remain player-only');
  assert.equal(value.enemy.thrustPlane, 'legacy');
  assert.equal(value.enemy.motionAssist.modelPresent, false, 'Enemy must not acquire an optional movement model');
  assert.equal(value.enemy.motionAssist.strengthPresent, false);
  assert.equal(value.enemy.motionAssist.bodyWeight, value.enemy.motionAssist.guardWeight);
  if (!variant) {
    assert.equal(value.integrated.active, false); assert.equal(value.integrated.variant, null);
    assert.deepEqual(value.integrated.settings, {}); assert.equal(value.integrated.finishRule, 'legacy');
    assert.equal(value.integrated.thrustPlane, 'legacy'); assert.equal(value.finishRule, 'legacy');
    assert.equal(value.player.arm, 'legacy'); assert.equal(value.player.thrustPlane, 'legacy');
    assert.equal(value.player.motionAssist.modelPresent, false, 'Ordinary play must retain its existing movement policy');
    assert.equal(value.player.motionAssist.strengthPresent, false);
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
  assert.equal(value.integrated.reason, variant.comparison === 'motion' ? 'exact_motion_tuple' : 'exact_compound_tuple');
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
      assert.equal(row.snapshot.player.motionAssist.bodyWeight, variant.assistStrength, 'The selected motion policy must exist before the first healthy controller call');
    }
  }
  return observed;
}
async function gestures(row) {
  const cdp = await context.newCDPSession(page);
  const requestedInput = [];
  const send = (type, x, y, timestamp) => {
    const touchPoints = type === 'touchEnd' ? [] : [{ x, y, id: 1 }];
    requestedInput.push({ type, touchPoints });
    return cdp.send('Input.dispatchTouchEvent', { type, ...(timestamp === undefined ? {} : { timestamp }), touchPoints });
  };
  const phase = value => page.evaluate(value => { integratedProbe.phase = value; }, value);
  try {
    const before = await snap(); await phase('raise'); await send('touchStart', 620, 230);
    for (let n = 1; n <= 6; n++) { await send('touchMove', 620, 230 - 10 * n); await page.waitForTimeout(50); }
    const raised = await snap(); await phase('cut');
    for (let n = 1; n <= 9; n++) { await send('touchMove', 620, 170 + 15 * n); await page.waitForTimeout(30); }
    await send('touchEnd'); await page.waitForFunction(() => game.input.activeTouch === null && !game.player.handHeld);
    const released = await snap(); assert.ok(raised.player.held && !released.player.held);
    assert.equal(released.player.thrusts, before.player.thrusts, 'A drag must not become a tap');
    await screenshot(row.id + '-cut-release', row);
    await phase('tap'); const timestamp = Date.now() / 1000;
    await send('touchStart', 620, 220, timestamp); await page.waitForTimeout(80); await send('touchEnd', 0, 0, timestamp + .08);
    await page.waitForFunction(count => game.player.skill.thrusts === count + 1, released.player.thrusts, { timeout: 10000 });
    const tapped = await snap(); await screenshot(row.id + '-native-tap', row);
    await page.waitForFunction(() => !game.player.skill.tap, null, { timeout: 15000 });
    await phase('recut'); await send('touchStart', 620, 250);
    for (let n = 1; n <= 5; n++) { await send('touchMove', 620 - 8 * n, 250 - 12 * n); await page.waitForTimeout(45); }
    const recut = await snap(); await send('touchEnd');
    await page.waitForFunction(() => game.input.activeTouch === null && !game.player.handHeld);
    const final = await snap(); assert.ok(recut.player.held && !final.player.held);
    assert.equal(final.player.thrusts, tapped.player.thrusts); assert.ok(final.timeS > before.timeS);
    const native = await page.evaluate(() => [...integratedProbe.native]);
    assert.ok(native.length >= 26 && native.every(event => event.trusted && event.kind === 'touch'));
    assert.ok(native.some(event => event.phase === 'tap' && event.type === 'pointerup'));
    assert.ok(Math.hypot(...raised.player.hand.map((value, index) => value - before.player.hand[index])) > 1e-5, 'Native drag did not update hand intent');
    row.touch = { before, raised, released, tapped, recut, final, requestedInput,
      requestedDelaysMS: { raise: [50, 50, 50, 50, 50, 50], cut: [30, 30, 30, 30, 30, 30, 30, 30, 30], tap: 80, recut: [45, 45, 45, 45, 45] }, native };
    await screenshot(row.id + '-recut', row);
  } finally { await cdp.detach(); }
}
async function restart(row, variant, ordinary = false) {
  await page.evaluate(() => { integratedProbe.restartReference = { player: game.player, enemy: game.enemy, world: game.world, combat: game.combat }; });
  await pauseWithHeldTouch(row); row.restartChoice = await start(ordinary, 1);
  await page.waitForFunction(() => ['player', 'enemy', 'world', 'combat'].every(key => game[key] !== integratedProbe.restartReference[key]) && integratedProbe.firstCombats.length === 2, null, { timeout: 60000 });
  row.restarted = await snap(); contract(row.restarted, variant);
  row.newObjects = await page.evaluate(() => Object.fromEntries(['player', 'enemy', 'world', 'combat'].map(key => [key, game[key] !== integratedProbe.restartReference[key]])));
  assert.ok(Object.values(row.newObjects).every(Boolean)); row.firstSteps = await firstSteps(variant, 2);
  const probe = await page.evaluate(() => ({ frames: integratedProbe.frames, starts: integratedProbe.starts, navigation: integratedProbe.navigation }));
  assert.ok(probe.frames.length && probe.frames.every(value => value.player.finite && value.enemy.finite));
  assert.equal(probe.starts.length, 2); assert.ok(probe.starts.every(event => event.trusted && event.kind === 'touch'));
  row.probe = probe; await screenshot(row.id + '-restarted', row);
}

async function setupContext() {
  context = await browser.newContext({ viewport: portrait, isMobile: true, hasTouch: true, ignoreHTTPSErrors: false,
    serviceWorkers: 'block', recordVideo: { dir: path.join(out, 'video'), size: landscape } });
  contexts.push(context);
  context.setDefaultTimeout(60000);
  await context.exposeBinding('recordIntegratedNativeUI', (_source, event) => nativeUI.push({ id: current, ...event }));
  await context.addInitScript(() => document.addEventListener('pointerdown', event => {
    const element = event.target.closest?.('#playIntegratedLegacy, #playIntegratedCombined, #integratedCombatCompare, #integratedCombatExit, #btnStart, #btnPause, #btnResume, #draw button.wcard, [data-setting=moveMode] button[data-v=tilt]');
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
  for (const variant of variants) {
    assert.ok(links[variant.id], 'Missing integrated comparison CTA'); const url = new URL(links[variant.id]);
    assert.ok(confined(url.href)); assert.equal(url.pathname, base.pathname); assert.equal(url.hash, '');
    const expected = { ...common, thrustPlane: variant.thrustPlane, finishRule: variant.finishRule, motionAssist: variant.motionAssist };
    assert.equal([...url.searchParams].length, 10); assert.deepEqual(Object.fromEntries(url.searchParams), expected);
  }
  const aParams = new URL(links.playIntegratedLegacy).searchParams, bParams = new URL(links.playIntegratedCombined).searchParams;
  assert.equal(aParams.get('motionAssist'), 'none'); assert.equal(bParams.get('motionAssist'), 'weak');
  aParams.delete('motionAssist'); bParams.delete('motionAssist');
  assert.deepEqual(Object.fromEntries(aParams), Object.fromEntries(bParams), 'The new A/B links must differ only in movement assistance');
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
    await screenshot(row.id + '-fight', row); await gestures(row); contract(row.touch.final, variant);
    await restart(row, variant); await pause();
    const selector = variant.variant === 'A' ? '#integratedCombatCompare' : '#integratedCombatExit';
    const target = variant.variant === 'A' ? lab.href : base.href;
    await tapNavigate(selector, target); row.navigationTarget = page.url(); row.pass = true;
  }
  const [aTouch, bTouch] = rows.filter(row => row.touch).map(row => row.touch);
  assert.deepEqual(aTouch.requestedInput, bTouch.requestedInput, 'Motion A/B must receive the same requested native touch coordinates');
  assert.deepEqual(aTouch.requestedDelaysMS, bTouch.requestedDelaysMS, 'Motion A/B must use the same requested gesture delays');
  current = 'ordinary-return'; await page.setViewportSize(portrait); await ready(); await observe();
  const ordinary = { id: current, url: page.url(), artifacts: [] }; rows.push(ordinary);
  assert.equal(new URL(ordinary.url).search, ''); ordinary.portrait = await layout(); fit(ordinary.portrait);
  ordinary.menu = await snap(); contract(ordinary.menu, null); assert.deepEqual(ordinary.menu.player.shapeTypes, [1, 0, 1, 1]);
  await screenshot(ordinary.id + '-portrait', ordinary); await page.setViewportSize(landscape); fit(await layout());
  ordinary.firstChoice = await start(true, 0); ordinary.started = await snap(); contract(ordinary.started, null);
  await firstSteps(null, 1); await screenshot(ordinary.id + '-fight', ordinary); await restart(ordinary, null, true);
  ordinary.pass = true;
  // Old 9-key links remain valid, but these compatibility checks do not repeat combat or claim old efficacy.
  for (const variant of historicalVariants) {
    current = variant.id; const url = new URL(base.href);
    url.search = new URLSearchParams({ ...common, thrustPlane: variant.thrustPlane, finishRule: variant.finishRule }).toString();
    await page.setViewportSize(portrait); await page.goto(url.href, { waitUntil: 'load' }); await ready(); await observe();
    const row = { id: current, variant: variant.variant, comparison: variant.comparison, url: page.url(),
      menuOnly: true, artifacts: [], portrait: await layout(), menu: await snap() }; rows.push(row);
    fit(row.portrait); assert.ok(row.portrait.menuVisible); contract(row.menu, variant); transientClean(row.menu);
    row.firstSteps = await page.evaluate(() => ({ fighters: integratedProbe.firstFighters.length, worlds: integratedProbe.firstWorlds.length, combats: integratedProbe.firstCombats.length }));
    assert.deepEqual(row.firstSteps, { fighters: 0, worlds: 0, combats: 0 });
    await screenshot(current + '-portrait', row); row.pass = true;
  }
  // Invalid marked entries retain their raw URL but must sanitize every game/input override.
  for (const [id, mutate] of [
    ['malformed-finish-and-gain', url => { url.searchParams.set('finishRule', 'unsupported'); url.searchParams.set('mobileVerticalGain', '1.8'); }],
    ['malformed-missing-profile-and-cut-plane', url => { url.searchParams.delete('bladeShape'); url.searchParams.set('cutPlane', 'coherent'); }],
    ['malformed-motion-and-gain', url => { url.searchParams.set('motionAssist', 'strong'); url.searchParams.set('mobileVerticalGain', '1.8'); }],
    ['malformed-duplicate-motion', url => { url.searchParams.append('motionAssist', 'none'); }],
  ]) {
    current = id; const url = new URL(links.playIntegratedCombined); mutate(url);
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
  for (const id of ['playIntegratedLegacy', 'playIntegratedCombined', 'integratedCombatCompare', 'integratedCombatExit'])
    assert.equal(nativeUI.filter(event => event.element === id).length, 1, 'Expected exactly one trusted tap of each entry/navigation link');
  assert.equal(nativeUI.filter(event => event.element === 'btnStart').length, 6);
  assert.equal(nativeUI.filter(event => event.element.startsWith('card-')).length, 2);
  // A distinct context keeps the base seed-byte preservation proofs separate from a real preference edit.
  current = 'sensor-menu-fallback'; await setupContext(); await page.goto(lab.href, { waitUntil: 'load' });
  await page.evaluate(value => localStorage.setItem('gladiator-settings', value), seedBytes);
  await tapNavigate('#playIntegratedCombined', links.playIntegratedCombined); await ready(); await observe();
  const sensor = { id: current, artifacts: [], originalSeedBytes: seedBytes, menu: await snap(), scope: 'No sensor emulation; checks unavailable-sensor session fallback after an intentional menu preference edit.' }; rows.push(sensor);
  contract(sensor.menu, variants[1]); await page.setViewportSize(landscape); await start(); await pause();
  await page.locator('[data-setting=moveMode] button[data-v=tilt]').tap(); await page.waitForTimeout(1000);
  await page.waitForFunction(() => !game.input.useTilt && document.getElementById('moveStick').classList.contains('show'), null, { timeout: 10000 });
  sensor.fallback = await snap(); expectedSettings = { ...seed, moveMode: 'tilt' };
  assert.deepEqual(JSON.parse(sensor.fallback.savedBytes), expectedSettings, 'Only the intentional moveMode preference may change');
  expectedSavedBytes = sensor.fallback.savedBytes; contract(sensor.fallback, variants[1]); transientClean(sensor.fallback);
  assert.equal(sensor.fallback.input.useTilt, false); assert.equal(sensor.fallback.input.stickVisible, true);
  sensor.intentionalSavedBytes = expectedSavedBytes; await screenshot(sensor.id + '-fallback', sensor);
  await page.locator('#btnResume').tap(); await page.waitForFunction(() => game.state === 'fight');
  const cdp = await context.newCDPSession(page);
  try {
    sensor.beforeDrag = await snap();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 620, y: 230, id: 1 }] });
    for (let n = 1; n <= 4; n++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 620 + 8 * n, y: 230 - 8 * n, id: 1 }] });
      await page.waitForTimeout(50);
    }
    sensor.dragged = await snap(); assert.ok(sensor.dragged.player.held);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => game.input.activeTouch === null && !game.player.handHeld);
    sensor.afterDrag = await snap(); contract(sensor.afterDrag, variants[1]);
    assert.ok(Math.hypot(...sensor.dragged.player.hand.map((value, index) => value - sensor.beforeDrag.player.hand[index])) > 1e-5);
    sensor.native = await page.evaluate(() => [...integratedProbe.native]);
    assert.ok(sensor.native.length >= 6 && sensor.native.every(event => event.trusted && event.kind === 'touch'));
  } finally { await cdp.detach(); }
  // Actual browser focus transitions only. Headless focus support is recorded, never simulated.
  await page.bringToFront(); sensor.focusBefore = await page.evaluate(() => ({ focused: document.hasFocus(), visibility: document.visibilityState, state: game.state }));
  const auxiliary = await context.newPage();
  auxiliary.on('pageerror', error => errors.push({ id: current, type: 'aux-pageerror', message: sanitize(error.message) }));
  auxiliary.on('console', message => { if (message.type() === 'error') errors.push({ id: current, type: 'aux-console', message: sanitize(message.text()) }); });
  auxiliary.on('requestfailed', request => requestFailures.push({ id: current, url: sanitize(request.url()), error: sanitize(request.failure()?.errorText) }));
  auxiliary.on('response', response => { if (response.status() >= 400) httpFailures.push({ id: current, status: response.status(), url: sanitize(response.url()) }); });
  await auxiliary.goto(lab.href, { waitUntil: 'load' }); await auxiliary.bringToFront(); await page.waitForTimeout(150);
  sensor.focusAfter = await page.evaluate(() => ({ focused: document.hasFocus(), visibility: document.visibilityState, state: game.state }));
  const focusObserved = sensor.focusBefore.state === 'fight' && ((sensor.focusBefore.focused && !sensor.focusAfter.focused) ||
    (sensor.focusBefore.visibility === 'visible' && sensor.focusAfter.visibility === 'hidden'));
  sensor.focusVerification = { verified: focusObserved, mechanism: 'Actual own-origin auxiliary tab bringToFront',
    limitation: focusObserved ? null : 'This browser did not expose a qualifying focus/visibility transition; focus cleanup remains unverified.' };
  if (focusObserved) {
    assert.equal(sensor.focusAfter.state, 'paused'); sensor.focusPaused = await snap(); transientClean(sensor.focusPaused); preserved(sensor.focusPaused);
  }
  await auxiliary.close(); await page.bringToFront(); sensor.pass = true;
  await screenshot(sensor.id + '-after-native-drag', sensor); await Promise.all(responseTasks);
  assert.ok(nativeUI.every(event => event.trusted && event.kind === 'touch'));
  assert.equal(nativeUI.filter(event => event.id === sensor.id && event.element === 'moveMode-tilt').length, 1);
  assert.equal(nativeUI.filter(event => event.id === sensor.id && event.element === 'btnResume').length, 1);
  assert.deepEqual(blockedRequests, []); assert.deepEqual(redirectRefusals, []);
  assert.deepEqual(httpFailures, []); assert.deepEqual(requestFailures, []); assert.deepEqual(errors, []);
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
    links, compiled, rows, nativeUI, errors, httpFailures, requestFailures, blockedRequests, redirectRefusals, fatal,
    artifacts: ['manifest-before.json', 'feature-lab-portrait.png', 'video/'],
    scope: 'Actual frozen compiled mobile motion-none/weak CTA entry with identical manual/profile/transported/armorCausal settings, selected player-only motion model and body coordination weight before the first fighter/world/combat calls, original active enemy and combat, trusted native drag/release/tap/recut, pause/restart, real comparison/ordinary links, ordinary card choice/restart, exact saved preference bytes, layout and errors. Historical 9-key compound links and malformed tuples have menu-only acceptance; they do not repeat combat. Observers call each original method once; no injury, AI, pose, controller or input state injection. Naturalness, human movement quality, post-injury armor finish efficacy, foot support, health recovery, physical-phone performance and feel are outside this entry acceptance screen.' }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ pass, sourceStable, rows: rows.length, failure: fatal?.id ?? null, out }));
}
