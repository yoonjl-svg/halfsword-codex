// Compiled default swordsmanship acceptance. Native input and read-only observers only.
// Usage: node tools/browser/swordsmanship_default.mjs --base=<base/> --out=<fresh-dir> [--scope=full|compat|public|repair|adoption]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
// Public configuration only; every observed game state still comes from compiled window.game.
import { SWORDSMANSHIP_WEAPONS } from '../../src/swordsmanship_trial.js';
import { SWORDSMANSHIP } from '../../src/swordsmanship.js';
assert.equal(SWORDSMANSHIP.retainedAttackPlaneMotion, 1);
assert.equal(SWORDSMANSHIP.version, 'unified-20261005-r2');

const options = {};
for (const argument of process.argv.slice(2)) {
  const match = /^--(base|out|scope)=(.+)$/.exec(argument);
  assert.ok(match, 'Only --base=<URL>, --out=<fresh-directory>, and --scope=full|compat|public|repair|adoption are supported');
  assert.ok(!Object.hasOwn(options, match[1]), 'Duplicate CLI option');
  options[match[1]] = match[2];
}
const scope = options.scope || 'full';
assert.ok(['full', 'compat', 'public', 'repair', 'adoption'].includes(scope), 'Unknown execution scope');
const base = new URL(options.base || 'https://yoonjl-svg.github.io/halfsword-codex/');
const local = ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname);
assert.ok(!base.username && !base.password && !base.search && !base.hash, 'Use a base URL without credentials, query, or fragment');
assert.ok(base.pathname.endsWith('/'), 'The base path must end with a slash');
assert.ok((local && ['http:', 'https:'].includes(base.protocol)) ||
  (base.origin === 'https://yoonjl-svg.github.io' && base.pathname === '/halfsword-codex/'), 'Only loopback or own Pages base is allowed');
const artifactRoot = '/workspace/halfsword-handoff/swordsmanship-power-20261005';
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
    'tools/browser/swordsmanship_default.mjs', 'tools/browser/swordsmanship_trial.test.mjs',
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
const seed = { skill: '0', difficulty: 'hard', moveMode: 'stick', sound: false, trail: false,
  guardNames: true, pixel: false, fpsCap: false, blood: true, invertTilt: false };
const seedBytes = JSON.stringify(seed);
const fullWeapons = scope === 'adoption' ? ['qinggang', 'longsword', 'zweihander'] : ['qinggang', 'longsword'];
const smokeWeapons = ['sabre', 'rapier', 'rubber_chicken', 'frozen_tuna', 'pistol'];
const supported = new Set(SWORDSMANSHIP_WEAPONS.filter(w => w.id !== 'pistol').map(w => w.id));
const selection = {
  adoption: { cards: true, weapons: fullWeapons, withheld: [], modes: [], rows: 10, starts: 8 },
  full: { cards: true, weapons: [...fullWeapons, ...smokeWeapons], withheld: ['monohoshizao', 'lightsaber'],
    modes: ['trial', 'old-comparison', 'legacy'], rows: 13, starts: 14 },
  compat: { cards: false, weapons: [], withheld: ['monohoshizao', 'lightsaber'],
    modes: ['trial', 'old-comparison', 'legacy'], rows: 5, starts: 3 },
  public: { cards: true, weapons: fullWeapons, withheld: [], modes: [], rows: 3, starts: 6 },
  repair: { cards: false, weapons: ['rubber_chicken'], withheld: [], modes: ['trial'], rows: 2, starts: 2 },
}[scope];

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
const lab = new URL('feature-lab.html#swordsmanship-trial', base);

const layout = () => page.evaluate(() => ({ width: innerWidth, height: innerHeight,
  scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  menuVisible: !!document.getElementById('menu')?.classList.contains('show') }));
const fit = value => assert.ok(value.scrollWidth <= value.width + 1, 'Mobile page has horizontal overflow');
async function ready() {
  await page.waitForFunction(() => window.game?.player?.sword && window.game?.combat && window.game?.swordsmanshipDefault, null, { timeout: 60000 });
  const modules = await page.locator('script[type="module"][src]').evaluateAll(nodes => nodes.map(node => node.src));
  assert.equal(modules.length, 1);
  await Promise.all(responseTasks);
  for (const url of modules) assert.ok(confined(url) && /\/assets\/[^/]+\.js$/.test(new URL(url).pathname) &&
    compiled.some(row => row.url === url && row.matchesFrozenDist), 'Compiled entry differs from the frozen dist');
}
async function observe() {
  await page.evaluate(() => {
    const p = window.swordsmanshipProbe = { phase: 'menu', frames: [], firstFighters: [], firstWorlds: [],
      firstCombats: [], native: [], starts: [], navigation: [] };
    const finite = f => [...Object.values(f.bodies), f.sword].every(body =>
      [body.translation(), body.rotation(), body.linvel(), body.angvel()].every(v => Object.values(v).every(Number.isFinite)));
    const fighter = f => ({ weapon: f.weapon.id, gun: !!f.weapon.gun, alive: f.alive, armed: f.armed, state: f.state,
      wounds: f.wounds.length, armHealth: f.armHealth, legF: f.limbs.legF, legB: f.limbs.legB, pain: f.pain,
      stance: f.stanceMemoryModel ?? 'legacy', roll: f.rollTargetModel ?? 'legacy',
      skill: f.skill.level, autoGuard: f.skill.autoGuard, arm: f.onehandArmModel, thrustPlane: f.thrustEdgeModel ?? 'legacy',
      swordsmanship: { modelPresent: 'swordsmanshipModel' in f, model: f.swordsmanshipModel ?? null,
        statePresent: 'swordsmanshipState' in f, state: f.swordsmanshipState ? JSON.parse(JSON.stringify({ ...f.swordsmanshipState, profile: undefined })) : null,
        input: f.swordsmanshipState?.input ? { ...f.swordsmanshipState.input } : null },
      timingModel: f.motionTimingModel ?? null, assistModel: f.motionAssistModel ?? null,
      hand: f.handOffset.toArray(), held: !!f.handHeld, active: !!f.inputActive, thrusts: f.skill.thrusts, swinging: !!f.skill.swinging,
      oldSwordModel: f.swordAssistModel ?? null,
      tap: f.skill.tap ? { t: f.skill.tap.t, down: !!f.skill.tap.down, bound: !!f.skill.tap.bound } : null,
      thrustWeight: f.skill.thrustPose.w, finishAmt: f.finish?.amt ?? 0,
      shapeTypes: f.swordColliders.map(c => c.shape.type), finite: finite(f) });
    p.read = () => ({ timeS: game.stats.simTime, state: game.state, phase: p.phase, url: location.href,
      trial: { ...game.swordsmanshipTrial }, default: { ...game.swordsmanshipDefault },
      defaultApplied: game.defaultSwordsmanshipApplied, integrated: { ...game.integratedCombatTrial },
      player: fighter(game.player), enemy: fighter(game.enemy), settings: { ...game.settings },
      savedBytes: localStorage.getItem('gladiator-settings'), difficulty: game.ai.levelName,
      cut: game.combat.cutReactionModel, cutTarget: game.combat.cutReactionFighter === game.player ? 'player' : null,
      finishRule: game.combat.finishRuleModel,
      finishTarget: game.combat.finishRuleFighter === game.player ? 'player' : 'other',
      bladeShape: { ...game.bladeShapeTrial }, thrustPlaneTrial: game.thrustPlaneTrial,
      input: { activeTouch: game.input.activeTouch, enabled: game.input.enabled,
        gain: game.input.mobileIntent.verticalGain, source: game.input.mobileIntent.source,
        pending: { x: game.input.handDX, y: game.input.handDY }, taps: game.input.taps,
        press: game.input.press ? { id: game.input.press.id } : null, keys: [...game.input.keys],
        stickMove: { ...game.input.stickMove } },
      ui: Object.fromEntries(['skill', 'difficulty'].map(key => [key, {
        selected: document.querySelector(`[data-setting=${key}] .on`)?.dataset.v ?? null,
        locked: [...document.querySelectorAll(`[data-setting=${key}] button`)].every(button => button.disabled),
        rowHidden: document.querySelector(`[data-setting=${key}]`)?.closest('.row')?.style.display === 'none',
      }])), navigation: Object.fromEntries(['swordsmanshipLab', 'swordsmanshipExit'].map(id => [id, document.getElementById(id)?.href ?? null])) });
    const fighters = new WeakSet(), worlds = new WeakSet(), combats = new WeakSet();
    const fp = Object.getPrototypeOf(game.player), fs = fp.step;
    fp.step = function (...args) {
      if ((this === game.player || this === game.enemy) && !fighters.has(this)) {
        fighters.add(this); p.firstFighters.push({ role: this === game.player ? 'player' : 'enemy', snapshot: p.read() });
      }
      return fs.apply(this, args);
    };
    const wp = Object.getPrototypeOf(game.world), ws = wp.step;
    wp.step = function (...args) {
      if (this === game.world && !worlds.has(this)) { worlds.add(this); p.firstWorlds.push(p.read()); }
      return ws.apply(this, args);
    };
    const cp = Object.getPrototypeOf(game.combat), cs = cp.afterStep;
    cp.afterStep = function (...args) {
      if (this === game.combat && !combats.has(this)) { combats.add(this); p.firstCombats.push(p.read()); }
      const result = cs.apply(this, args);
      if (this === game.combat && p.frames.length < 20000) p.frames.push(p.read());
      return result;
    };
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(type, event => {
      const row = { type, trusted: event.isTrusted, kind: event.pointerType, x: event.clientX, y: event.clientY,
        phase: p.phase, timeS: game.stats.simTime, target: event.target.id || '' };
      if (event.target === game.input.canvas) {
        if (type === 'pointerdown') row.stateBeforeInput = fighter(game.player).swordsmanship.state;
        p.native.push(row);
      }
      if (type === 'pointerdown' && event.target.closest?.('#btnStart')) p.starts.push(row);
      if (type === 'pointerdown' && event.target.closest?.('#swordsmanshipLab, #swordsmanshipExit')) p.navigation.push(row);
    }, true);
  });
}
const snap = () => page.evaluate(() => swordsmanshipProbe.read());
function transientClean(v) {
  assert.deepEqual(v.input.pending, { x: 0, y: 0 }); assert.equal(v.input.activeTouch, null);
  assert.equal(v.input.taps, 0); assert.equal(v.input.press, null); assert.deepEqual(v.input.keys, []);
  assert.deepEqual(v.input.stickMove, { x: 0, y: 0 });
}
const phases = ['ready', 'returning', 'holding', 'moving', 'waiting', 'command', 'suspended'];
const owners = ['player', 'return', 'thrust', 'finish', 'recovery', 'inactive'];
function policyState(state) {
  assert.ok(state && phases.includes(state.phase), 'Missing/unknown unified controller phase');
  assert.ok(owners.includes(state.owner), 'Unknown unified goal owner');
  for (const key of ['idleS', 'generatedDX', 'generatedDY', 'returnVX', 'returnVY', 'goalTick'])
    assert.ok(Number.isFinite(state[key]), 'Nonfinite controller telemetry: ' + key);
  for (const key of ['handCorrection', 'aimCorrection', 'hand', 'aim', 'baseHand', 'baseAim', 'body'])
    assert.ok(state[key] && Object.values(state[key]).every(Number.isFinite), 'Nonfinite goal: ' + key);
}
function contract(v, weapon, mode = 'default') {
  assert.equal(v.savedBytes, seedBytes, 'Stored preference bytes changed'); assert.deepEqual(v.settings, seed);
  assert.ok(v.player.finite && v.enemy.finite); assert.equal(v.input.gain, 1.35);
  assert.equal(v.enemy.swordsmanship.modelPresent, false); assert.equal(v.enemy.swordsmanship.statePresent, false);
  assert.equal(v.enemy.arm, 'legacy');
  if (weapon) assert.equal(v.player.weapon, weapon);
  const adopted = mode === 'default';
  assert.equal(v.player.stance, adopted && v.player.weapon === 'zweihander' ? 'fresh' : 'legacy');
  assert.equal(v.player.roll, adopted && ['longsword','qinggang'].includes(v.player.weapon) ? 'bounded' : 'legacy');
  const cutB = adopted && ['longsword','zweihander'].includes(v.player.weapon);
  assert.equal(v.cut, cutB ? 'centerline' : 'legacy');
  assert.equal(v.cutTarget, cutB ? 'player' : null);
  assert.equal(v.enemy.stance, 'legacy'); assert.equal(v.enemy.roll, 'legacy');
  if (mode === 'default') {
    assert.equal(v.default.active, true); assert.equal(v.default.model, 'unified'); assert.equal(v.default.playerOnly, true);
    assert.deepEqual(v.default.settings, { skill: '0.7' }); assert.equal(v.trial.active, false);
    assert.equal(v.ui.skill.rowHidden, true); assert.equal(v.ui.skill.locked, true);
    assert.equal(v.ui.skill.selected, '0.7'); assert.equal(v.ui.difficulty.selected, 'hard');
    assert.equal(v.ui.difficulty.locked, false); assert.equal(v.defaultApplied, supported.has(v.player.weapon));
  } else {
    assert.equal(v.default.active, false); assert.equal(v.defaultApplied, false);
    if (mode === 'trial') {
      assert.equal(v.trial.active, true); assert.equal(v.trial.model, 'unified');
      assert.equal(v.ui.skill.rowHidden, true); assert.equal(v.ui.skill.locked, true);
      assert.equal(v.ui.difficulty.selected, 'normal'); assert.equal(v.ui.difficulty.locked, true);
    } else if (mode === 'old-comparison') {
      assert.equal(v.integrated.active, true); assert.equal(v.integrated.model, 'sword-v2');
      assert.equal(v.ui.skill.rowHidden, true); assert.equal(v.ui.skill.locked, true);
      assert.equal(v.ui.skill.selected, '0'); assert.equal(v.ui.difficulty.selected, 'normal');
      assert.equal(v.player.swordsmanship.modelPresent, false); assert.equal(v.player.swordsmanship.statePresent, false);
      assert.equal(v.player.oldSwordModel, 'v2'); assert.equal(v.player.skill, 0); assert.equal(v.player.autoGuard, false);
      assert.equal(v.player.arm, 'manual'); assert.equal(v.player.thrustPlane, 'transported');
      assert.equal(v.finishRule, 'armorCausal'); assert.deepEqual(v.player.shapeTypes, [1, 0, 1, 9]);
      return;
    } else {
      assert.equal(mode, 'legacy'); assert.equal(v.trial.active, false); assert.equal(v.integrated.active, false);
      assert.equal(v.ui.skill.rowHidden, false); assert.equal(v.ui.skill.locked, false); assert.equal(v.ui.skill.selected, '0');
      assert.equal(v.ui.difficulty.selected, 'hard'); assert.equal(v.ui.difficulty.locked, false);
      assert.equal(v.player.swordsmanship.modelPresent, false); assert.equal(v.player.swordsmanship.statePresent, false);
      assert.equal(v.player.skill, 0); assert.equal(v.player.autoGuard, true); assert.equal(v.player.arm, 'legacy');
      assert.equal(v.player.thrustPlane, 'legacy'); assert.equal(v.finishRule, 'legacy');
      assert.deepEqual(v.player.shapeTypes, [1, 0, 1, 1]); return;
    }
  }
  const active = supported.has(v.player.weapon);
  if (active) {
    assert.equal(v.player.swordsmanship.model, 'unified'); policyState(v.player.swordsmanship.state);
    assert.equal(v.player.swordsmanship.state.version, 'unified-20261005-r2');
    assert.equal(v.player.skill, 0); assert.equal(v.player.autoGuard, false); assert.equal(v.player.arm, 'manual');
  } else {
    assert.equal(v.player.swordsmanship.modelPresent, false); assert.equal(v.player.swordsmanship.statePresent, false);
    assert.equal(v.player.skill, .7); assert.equal(v.player.autoGuard, true); assert.equal(v.player.arm, 'legacy');
  }
  if (v.player.weapon === 'qinggang' && mode === 'trial') {
    assert.equal(v.player.thrustPlane, 'transported'); assert.equal(v.player.timingModel, 'none'); assert.equal(v.player.assistModel, 'none');
    assert.deepEqual(v.player.shapeTypes, [1, 0, 1, 9]); assert.equal(v.finishRule, 'armorCausal'); assert.equal(v.finishTarget, 'player');
  } else {
    assert.equal(v.player.thrustPlane, 'legacy'); assert.equal(v.finishRule, 'legacy');
    assert.equal(v.bladeShape.applied, false);
    if (v.player.weapon === 'qinggang') assert.deepEqual(v.player.shapeTypes, [1, 0, 1, 1]);
  }
}

async function screenshot(name, row) {
  const file = name + '.png', before = await snap();
  await page.screenshot({ path: path.join(out, file) });
  const after = await snap();
  row.artifacts.push(file);
  (row.screenshotWindows ??= []).push({ file, beforeTimeS: before.timeS, afterTimeS: after.timeS,
    phase: before.phase, beforePlayer: before.player, afterPlayer: after.player });
}
async function navigate(selector, url) {
  await Promise.all([page.waitForURL(url, { waitUntil: 'load' }), page.locator(selector).tap()]); assert.equal(page.url(), url);
}
async function start(ordinary = false, card = 0) {
  await page.locator('#btnStart').tap();
  if (ordinary) {
    await page.waitForFunction(() => game.state === 'draw' && game.draw.stage === 'choose' && game.draw.t >= 1);
    const offered = await page.evaluate(() => [...game.draw.ids]);
    await page.locator(`#draw button[data-i="${card}"]`).tap();
    await page.waitForFunction(() => game.state === 'fight' && swordsmanshipProbe.firstCombats.length > 0);
    assert.equal((await snap()).player.weapon, offered[card]); return { offered, card, chosen: offered[card] };
  }
  await page.waitForFunction(() => game.state === 'fight' && swordsmanshipProbe.firstCombats.length > 0);
}
async function firstSteps(weapon, rounds, mode = 'default') {
  const first = await page.evaluate(() => ({ fighters: swordsmanshipProbe.firstFighters, worlds: swordsmanshipProbe.firstWorlds, combats: swordsmanshipProbe.firstCombats }));
  assert.equal(first.fighters.filter(v => v.role === 'player').length, rounds);
  assert.equal(first.fighters.filter(v => v.role === 'enemy').length, rounds);
  assert.equal(first.worlds.length, rounds); assert.equal(first.combats.length, rounds);
  for (const v of [...first.fighters.map(row => row.snapshot), ...first.worlds, ...first.combats]) contract(v, weapon, mode);
  return first;
}
async function pause() {
  await page.locator('#btnPause').tap(); await page.waitForFunction(() => game.state === 'paused');
  const value = await snap(); transientClean(value); return value;
}
async function heldPauseRestart(row, weapon, ordinary = false, mode = 'default') {
  const cdp = await context.newCDPSession(page), hand = { x: 620, y: 220, id: 1 };
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [hand] });
    hand.y = 190; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [hand] });
    await page.waitForFunction(() => game.player.handHeld && game.input.activeTouch !== null);
    await page.evaluate(() => { swordsmanshipProbe.restartReference = { player: game.player, enemy: game.enemy, world: game.world, combat: game.combat,
      controller: game.player.swordsmanshipState }; });
    const box = await page.locator('#btnPause').boundingBox(); assert.ok(box);
    const button = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [hand, button] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [hand] });
    await page.waitForFunction(() => game.state === 'paused'); row.paused = await snap(); transientClean(row.paused);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await cdp.detach(); }
  await page.waitForTimeout(160); row.pausedAfterWallWait = await snap();
  assert.equal(row.pausedAfterWallWait.timeS, row.paused.timeS);
  assert.deepEqual(row.pausedAfterWallWait.player.swordsmanship.state, row.paused.player.swordsmanship.state, 'Pause must not age the controller');
  row.restartChoice = await start(ordinary, 1);
  await page.waitForFunction(() => ['player', 'enemy', 'world', 'combat'].every(key => game[key] !== swordsmanshipProbe.restartReference[key]) && swordsmanshipProbe.firstCombats.length === 2);
  row.restarted = await snap(); contract(row.restarted, weapon, mode); row.firstSteps = await firstSteps(weapon, 2, mode);
  if (row.restarted.player.swordsmanship.statePresent) assert.ok(await page.evaluate(() => game.player.swordsmanshipState !== swordsmanshipProbe.restartReference.controller));
  await screenshot(row.id + '-restart', row);
}
async function nativeGesture(row, full = false) {
  const cdp = await context.newCDPSession(page), requests = [];
  const send = async (type, x, y, timestamp) => {
    const points = type === 'touchEnd' ? [] : [{ x, y, id: 1 }]; requests.push({ type, points });
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points, ...(timestamp === undefined ? {} : { timestamp }) });
  };
  const phase = value => page.evaluate(value => { swordsmanshipProbe.phase = value; }, value);
  try {
    const before = await snap(); await phase('drag'); await send('touchStart', 620, 220);
    for (let n = 1; n <= 4; n++) { await send('touchMove', 620 + 10 * n, 220 - 8 * n); await page.waitForTimeout(full ? 120 : 35); }
    await page.waitForFunction(() => swordsmanshipProbe.native.at(-1)?.x === 660 && game.input.handDX === 0 && game.input.handDY === 0 && game.player.handHeld);
    const dragged = await snap(); await screenshot(row.id + '-dragged', row); await phase('held-stop');
    const heldNative = await page.evaluate(() => swordsmanshipProbe.native.length), startTime = dragged.timeS;
    await page.waitForFunction(time => game.stats.simTime >= time + .12, startTime);
    const held = await snap(); assert.equal(held.player.held, true);
    assert.equal(await page.evaluate(() => swordsmanshipProbe.native.length), heldNative, 'Stationary hold must send no movement');
    await screenshot(row.id + '-held-stop', row);
    if (full) {
      await phase('reverse');
      for (let n = 1; n <= 5; n++) { await send('touchMove', 660 - 12 * n, 188 + 8 * n); await page.waitForTimeout(35); }
      await screenshot(row.id + '-reverse', row);
    }
    await phase('release'); await send('touchEnd');
    await page.waitForFunction(() => game.input.activeTouch === null && !game.player.handHeld);
    const released = await snap(); assert.equal(released.player.thrusts, before.player.thrusts, 'Drag became a tap');
    let tapped = null;
    if (full) {
      await phase('tap'); const timestamp = Date.now() / 1000;
      await send('touchStart', 620, 220, timestamp); await page.waitForTimeout(70); await send('touchEnd', 0, 0, timestamp + .07);
      await page.waitForFunction(count => game.player.skill.thrusts === count + 1, released.player.thrusts, { timeout: 10000 });
      tapped = await snap(); await screenshot(row.id + '-tap', row); await page.waitForFunction(() => !game.player.skill.tap, null, { timeout: 15000 });
    }
    const final = await snap(), native = await page.evaluate(() => [...swordsmanshipProbe.native]);
    assert.ok(native.length >= 6 && native.every(event => event.trusted && event.kind === 'touch'));
    assert.ok(final.timeS > before.timeS); row.touch = { before, dragged, held, released, tapped, final, requests, native,
      requestedDragMoveIntervalMS: full ? 120 : 35, requestedReverseMoveIntervalMS: full ? 35 : null };
    await screenshot(row.id + '-touch', row);
  } finally { await cdp.detach(); }
}
async function returnFlow(row) {
  const cdp = await context.newCDPSession(page), requests = [];
  const send = async (type, x, y) => { const points = type === 'touchEnd' ? [] : [{ x, y, id: 1 }];
    requests.push({ type, points }); await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points }); };
  const phase = value => page.evaluate(value => { swordsmanshipProbe.phase = value; }, value);
  try {
    const before = await snap(); await phase('return-drag'); await send('touchStart', 620, 220);
    await send('touchMove', 645, 195); await page.waitForTimeout(40); await send('touchMove', 670, 170);
    await page.waitForFunction(() => swordsmanshipProbe.native.at(-1)?.x === 670 && game.input.handDX === 0 && game.input.handDY === 0);
    await phase('return-release'); await send('touchEnd');
    await page.waitForFunction(() => !game.player.handHeld && game.input.activeTouch === null);
    const released = await snap(), frameStart = await page.evaluate(() => swordsmanshipProbe.frames.length);
    await phase('return-wait');
    // Wait for an actual return state; a disabled controller is explicitly not a completion.
    await page.waitForFunction(time => ['returning', 'ready', 'suspended'].includes(game.player.swordsmanshipState.phase) ||
      game.stats.simTime > time + 2 || game.state !== 'fight', released.timeS);
    const returning = await snap(); await screenshot(row.id + '-returning', row); await phase('return-retouch'); await send('touchStart', 670, 170);
    await page.waitForFunction(() => game.player.handHeld && game.input.activeTouch !== null && game.player.swordsmanshipState.generatedDX === 0 && game.player.swordsmanshipState.generatedDY === 0);
    const retouched = await snap(), retouchEvent = await page.evaluate(() => swordsmanshipProbe.native.findLast(e => e.phase === 'return-retouch' && e.type === 'pointerdown'));
    assert.ok(retouchEvent?.trusted);
    const heldNative = await page.evaluate(() => swordsmanshipProbe.native.length), holdStart = await page.evaluate(() => swordsmanshipProbe.frames.length);
    await phase('return-held'); await page.waitForFunction(start => swordsmanshipProbe.frames.length >= start + 30, holdStart);
    const heldFrames = await page.evaluate(start => swordsmanshipProbe.frames.slice(start, start + 30), holdStart);
    assert.equal(await page.evaluate(() => swordsmanshipProbe.native.length), heldNative);
    for (const v of heldFrames) {
      assert.equal(v.player.held, true); assert.equal(v.player.swordsmanship.state.generatedDX, 0); assert.equal(v.player.swordsmanship.state.generatedDY, 0);
    }
    await phase('return-new-move'); await send('touchMove', 690, 190); await page.waitForTimeout(35); await send('touchMove', 710, 210);
    await page.waitForFunction(() => swordsmanshipProbe.native.at(-1)?.x === 710 && game.input.handDX === 0 && game.input.handDY === 0);
    const moved = await snap(); await screenshot(row.id + '-return-new-move', row); await phase('ready-release'); await send('touchEnd');
    await page.waitForFunction(() => !game.player.handHeld && game.input.activeTouch === null);
    const readyReleased = await snap(); await phase('ready-wait');
    await page.waitForFunction(time => game.stats.simTime >= time + 1.5 || game.state !== 'fight', readyReleased.timeS);
    await page.waitForFunction(time => ['ready', 'suspended'].includes(game.player.swordsmanshipState.phase) ||
      game.stats.simTime >= time + 4 || game.state !== 'fight', readyReleased.timeS);
    const readyState = await snap(); await screenshot(row.id + '-ready', row); await phase('ready-retouch'); await send('touchStart', 710, 210);
    await page.waitForFunction(() => game.player.handHeld && game.input.activeTouch !== null && game.player.swordsmanshipState.generatedDX === 0 && game.player.swordsmanshipState.generatedDY === 0);
    const readyEvent = await page.evaluate(() => swordsmanshipProbe.native.findLast(e => e.phase === 'ready-retouch' && e.type === 'pointerdown'));
    const readyHoldStart = await page.evaluate(() => swordsmanshipProbe.frames.length), nativeCount = await page.evaluate(() => swordsmanshipProbe.native.length);
    await phase('ready-held'); await page.waitForFunction(start => swordsmanshipProbe.frames.length >= start + 90, readyHoldStart);
    const readyHeldFrames = await page.evaluate(start => swordsmanshipProbe.frames.slice(start, start + 90), readyHoldStart);
    assert.equal(await page.evaluate(() => swordsmanshipProbe.native.length), nativeCount);
    for (const v of readyHeldFrames) { assert.equal(v.player.held, true); assert.equal(v.player.swordsmanship.state.generatedDX, 0); assert.equal(v.player.swordsmanship.state.generatedDY, 0); }
    // End with a real drag, so the long stationary touch cannot become a tap.
    await send('touchMove', 730, 190); await page.waitForTimeout(35); await send('touchMove', 750, 170); await send('touchEnd');
    await page.waitForFunction(() => !game.player.handHeld && game.input.activeTouch === null);
    const final = await snap(); assert.equal(final.player.thrusts, before.player.thrusts);
    const frames = await page.evaluate(start => swordsmanshipProbe.frames.slice(start), frameStart);
    const consumedMovement = frames.filter(v => v.phase === 'return-new-move' && v.player.held &&
      v.player.swordsmanship.input?.active && Math.hypot(v.player.swordsmanship.input.dx, v.player.swordsmanship.input.dy) > 1e-5);
    for (const v of consumedMovement) {
      assert.equal(v.player.swordsmanship.state.generatedDX, 0); assert.equal(v.player.swordsmanship.state.generatedDY, 0);
      assert.notEqual(v.player.swordsmanship.state.owner, 'return');
    }
    row.return = { before, released, returning, retouchEvent, retouched, heldFrames, moved, readyReleased, readyState,
      readyEvent, readyHeldFrames, final, requests, frames, consumedMovement, movementObserved: consumedMovement.length > 0,
      returnObserved: frames.some(v => v.player.swordsmanship.state.phase === 'returning'),
      activeReturnInterrupted: retouchEvent.stateBeforeInput?.phase === 'returning' && retouched.player.swordsmanship.state.owner === 'player',
      completedBeforeRetouch: readyEvent?.stateBeforeInput?.phase === 'ready',
      heldInputProtected: true,
      limitation: 'Actual goal ownership, released return and held-input protection; no claim of anatomical naturalness or physical stopping.' };
    await screenshot(row.id + '-return-held', row);
  } finally { await cdp.detach(); }
}
async function setupContext() {
  context = await browser.newContext({ viewport: portrait, isMobile: true, hasTouch: true, ignoreHTTPSErrors: false,
    serviceWorkers: 'block', recordVideo: { dir: path.join(out, 'video'), size: landscape } });
  contexts.push(context);
  context.setDefaultTimeout(60000);
  await context.exposeBinding('recordSwordsmanshipNativeUI', (_source, event) => nativeUI.push({ id: current, ...event }));
  await context.addInitScript(() => document.addEventListener('pointerdown', event => {
    const element = event.target.closest?.('#playSwordsmanshipDefault, #playUnifiedSwordsmanship, #playSwordAssistV2, #swordsmanshipLab, #swordsmanshipExit, #btnStart, #btnPause, #btnResume, #draw button.wcard, [data-setting=moveMode] button[data-v=tilt]');
    if (element) window.recordSwordsmanshipNativeUI({ url: location.href, element: element.id || (element.matches('.wcard') ? 'card-' + element.dataset.i : 'moveMode-tilt'),
      trusted: event.isTrusted, kind: event.pointerType, x: event.clientX, y: event.clientY });
  }, true));
  await context.route('**/*', async route => {
    if (!confined(route.request().url())) {
      blockedRequests.push({ id: current, url: sanitize(route.request().url()) }); await route.abort('blockedbyclient'); return;
    }
    try {
      // Playwright can follow redirects after route.continue without rerouting them.
      // Fetch the authorized URL once with redirects disabled, then give its bytes to the browser.
      const response = await route.fetch({ maxRedirects: 0, maxRetries: 2 });
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
}async function collect(row) {
  row.observations = await page.evaluate(() => ({ frames: swordsmanshipProbe.frames,
    starts: swordsmanshipProbe.starts, native: swordsmanshipProbe.native, navigation: swordsmanshipProbe.navigation }));
  assert.ok(row.observations.frames.length && row.observations.frames.every(v => v.player.finite && v.enemy.finite));
  for (const frame of row.observations.frames) if (frame.player.swordsmanship.statePresent) policyState(frame.player.swordsmanship.state);
}
async function openFixture(url) {
  await page.setViewportSize(portrait); await page.goto(url.href, { waitUntil: 'load' }); await ready();
  await page.waitForLoadState('networkidle'); await observe(); fit(await layout());
}
const ordinaryUrl = weapon => {
  const url = new URL(base); url.search = new URLSearchParams({ weapon, foe: 'heinrich', foeWeapon: 'longsword' }).toString(); return url;
};
try {
  browser = await chromium.launch(launch); await setupContext();
  current = 'feature-lab'; await page.goto(lab.href, { waitUntil: 'load' }); fit(await layout());
  const defaultLink = await page.locator('#playSwordsmanshipDefault').getAttribute('href');
  assert.equal(new URL(defaultLink, base).href, base.href, 'Default play link must have no experimental query');
  await page.evaluate(value => localStorage.setItem('gladiator-settings', value), seedBytes);
  await page.screenshot({ path: path.join(out, 'feature-lab-portrait.png'), fullPage: true });
  if (selection.cards) {
    current = 'ordinary-card-game';
    const ordinary = { id: current, mode: 'default', artifacts: [] }; rows.push(ordinary);
    await navigate('#playSwordsmanshipDefault', base.href); await ready(); await observe();
    ordinary.menu = await snap(); ordinary.portrait = await layout(); fit(ordinary.portrait); contract(ordinary.menu, null);
    await screenshot(ordinary.id + '-portrait', ordinary); await page.setViewportSize(landscape); fit(await layout());
    ordinary.firstChoice = await start(true, 0); contract(await snap(), null); await firstSteps(null, 1);
    await screenshot(ordinary.id + '-first-card', ordinary); await heldPauseRestart(ordinary, null, true);
    await collect(ordinary); await pause(); ordinary.pass = true;
  }
  for (const weapon of selection.weapons) {
      current = weapon;
      const row = { id: weapon, weapon, mode: 'default', full: fullWeapons.includes(weapon), artifacts: [] }; rows.push(row);
      const url = ordinaryUrl(weapon); await openFixture(url); row.url = page.url(); row.menu = await snap(); contract(row.menu, weapon);
      await screenshot(weapon + '-portrait', row); await page.setViewportSize(landscape); fit(await layout());
      await start(); row.started = await snap(); contract(row.started, weapon); row.firstSteps = await firstSteps(weapon, 1);
      await screenshot(weapon + '-start', row); await nativeGesture(row, row.full); contract(row.touch.final, weapon);
      if (row.full) {
        await heldPauseRestart(row, weapon); await returnFlow(row); contract(row.return.final, weapon);
      }
      await collect(row); await pause(); row.pass = true;
  }
  for (const weapon of selection.withheld) {
    current = 'withheld-default-' + weapon;
    const row = { id: current, weapon, mode: 'default', menuOnly: true, artifacts: [] }; rows.push(row);
    await openFixture(ordinaryUrl(weapon)); row.menu = await snap(); contract(row.menu, weapon); transientClean(row.menu);
    const calls = await page.evaluate(() => [swordsmanshipProbe.firstFighters.length, swordsmanshipProbe.firstWorlds.length, swordsmanshipProbe.firstCombats.length]);
    assert.deepEqual(calls, [0, 0, 0]); await screenshot(row.id + '-portrait', row);
    await page.waitForLoadState('networkidle'); row.pass = true;
  }
  if (scope === 'adoption') {
    const comparisons = [
      ['recutV2=baseline&weapon=longsword', 'legacy','legacy','legacy'],
      ['recutV2=bounded&weapon=qinggang', 'legacy','bounded','legacy'],
      ['recoveryContactV2=baseline', 'fresh','legacy','legacy'],
      ['recoveryContactV2=combined', 'fresh','legacy','centerline'],
      ['contactV2=legacy&weapon=longsword', 'legacy','legacy','legacy'],
      ['stanceV2=legacy&weapon=zweihander', 'legacy','legacy','legacy'],
    ];
    for (const [query, stance, roll, cut] of comparisons) {
      current = 'comparison-menu-' + query;
      const url = new URL(base); url.search = query; await openFixture(url);
      const menu = await snap();
      assert.equal(menu.default.active, false);
      assert.equal(menu.player.stance, stance); assert.equal(menu.player.roll, roll);
      assert.equal(menu.cut, cut); assert.equal(menu.cutTarget, cut === 'centerline' ? 'player' : null);
      assert.equal(menu.enemy.stance, 'legacy'); assert.equal(menu.enemy.roll, 'legacy');
      assert.equal(menu.savedBytes, seedBytes); fit(await layout());
      rows.push({id: current, url: url.href, menuOnly: true, menu, pass: true});
    }
  }
  for (const mode of selection.modes) {
    current = 'compat-' + mode;
    const row = { id: current, mode, weapon: 'qinggang', artifacts: [] }; rows.push(row);
    await page.setViewportSize(portrait);
    if (mode === 'trial') {
      await page.goto(lab.href, { waitUntil: 'load' });
      await page.locator('#swordsmanshipWeapon').selectOption('qinggang');
      const url = new URL(base); url.search = 'swordsmanshipTrial=unified&weapon=qinggang';
      await navigate('#playUnifiedSwordsmanship', url.href);
    } else if (mode === 'old-comparison') {
      await page.goto(lab.href, { waitUntil: 'load' });
      const href = await page.locator('#playSwordAssistV2').getAttribute('href');
      const url = new URL(href, base); assert.equal(url.searchParams.get('swordAssist'), 'v2');
      assert.equal([...url.searchParams].length, 12); await navigate('#playSwordAssistV2', url.href);
    } else {
      const url = ordinaryUrl('qinggang'); url.searchParams.set('swordsmanship', 'legacy'); await page.goto(url.href, { waitUntil: 'load' });
    }
    await ready(); await page.waitForLoadState('networkidle'); await observe(); row.url = page.url();
    row.menu = await snap(); contract(row.menu, 'qinggang', mode); fit(await layout());
    await screenshot(row.id + '-portrait', row); await page.setViewportSize(landscape); fit(await layout());
    await start(); row.started = await snap(); contract(row.started, 'qinggang', mode); row.firstSteps = await firstSteps('qinggang', 1, mode);
    await nativeGesture(row, false); contract(row.touch.final, 'qinggang', mode); await collect(row); await pause(); row.pass = true;
  }
  await page.waitForLoadState('networkidle'); await Promise.all(responseTasks);
  assert.deepEqual(errors, []); assert.deepEqual(httpFailures, []); assert.deepEqual(requestFailures, []);
  assert.deepEqual(blockedRequests, []); assert.deepEqual(redirectRefusals, []);
  assert.ok(nativeUI.length && nativeUI.every(event => event.trusted && event.kind === 'touch'));
  assert.equal(nativeUI.filter(event => event.element === 'playUnifiedSwordsmanship').length, selection.modes.includes('trial') ? 1 : 0);
  assert.equal(nativeUI.filter(event => event.element === 'playSwordAssistV2').length, selection.modes.includes('old-comparison') ? 1 : 0);
  assert.equal(nativeUI.filter(event => event.element === 'playSwordsmanshipDefault').length, selection.cards ? 1 : 0);
  assert.equal(nativeUI.filter(event => event.element === 'btnStart').length, selection.starts);
  assert.equal(nativeUI.filter(event => event.element.startsWith('card-')).length, selection.cards ? 2 : 0);
  assert.equal(rows.length, selection.rows);
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
  for (const item of contexts) await item.close(); if (browser) await browser.close();
  sourceAfter = await manifest(); commitAfter = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim();
  const sourceStable = sourceCommit === commitAfter && JSON.stringify(sourceBefore) === JSON.stringify(sourceAfter);
  pass = pass && sourceStable; if (!pass) process.exitCode = 1;
  const returnObservations = rows.filter(row => row.return).map(row => ({ id: row.id, returnObserved: row.return.returnObserved,
    activeReturnInterrupted: row.return.activeReturnInterrupted, completedBeforeRetouch: row.return.completedBeforeRetouch,
    heldInputProtected: row.return.heldInputProtected, movementObserved: row.return.movementObserved }));
  const summary = { pass, sourceStable, sourceCommit, commitAfter, sourceBefore, sourceAfter, startedUTC,
    completedUTC: new Date().toISOString(), base: base.href, seedSettings: seed,
    tlsVerification: true, environmentProxyRetained: !local, redirectsFollowed: false, networkScope: base.href,
    executionScope: scope, executedFullWeapons: selection.weapons.filter(w => fullWeapons.includes(w)),
    executedSmokeWeapons: selection.weapons.filter(w => smokeWeapons.includes(w)),
    routeFetchRetryPolicy: { maxRetries: 2, retriesOnlyECONNRESET: true, errorsFiltered: false,
      attemptCountExposed: false, limitation: 'Successful bounded GET retries do not prove zero underlying TCP resets.' },
    weaponSelectionMethod: 'Real ordinary card choice, fixed ordinary weapon URL fixture, and legacy trial native select configuration with trusted form submission.',
    returnObservations, returnReviewRequired: ['full', 'public', 'adoption'].includes(scope) ? (returnObservations.length !== fullWeapons.length || returnObservations.some(row =>
      !row.returnObserved || !row.activeReturnInterrupted || !row.completedBeforeRetouch || !row.heldInputProtected || !row.movementObserved)) : null,
    compiled, rows, nativeUI, errors, httpFailures, requestFailures, blockedRequests, redirectRefusals, fatal,
    scope: scope === 'adoption' ? 'Approved ordinary defaults: real query-free card choice/restart and Q/LS/Z trusted input/reverse/tap/restart/return/retouch; player-only Z fresh, LS/Z centerline, LS/Q bounded checked before first native steps and after new-object restart. Six prior A/B menus check isolation, not new comparison play. Stored preferences/ordinary v2/legacy Q shape-thrust-finish retained. Compiled bytes, strict TLS and mobile viewport errors checked. No new power, residual-spin research or physical-iPhone claim.' : scope === 'repair' ? 'Only the prior audio-error-affected rubber-chicken ordinary input and old unified Qinggang trial input flows, with up to two ECONNRESET-only GET retries, no error filtering, unchanged game/observer/input contracts. This does not repeat the full thirteen-flow suite.' :
      scope === 'public' ? 'Public default delivery acceptance only: query-free default CTA/card selection/restart, Qinggang and Longsword default play/reverse/tap/restart/return/retouch/90-frame hold, saved preference bytes, player-only r2, hidden old strength UI, legacy default collision/thrust/finish, compiled asset match, TLS/proxy and final network errors. This release locally checked query-free cards, Q/LS/Z full input flows and six previous comparison menus (ten rows); public repeats cards and Q/LS only (three rows). Earlier weapon smoke results are reused, not rerun. Current ordinary fresh/centerline/bounded policies are checked. No full-roster public pass or human realism/force-efficiency assertion.' :
      scope === 'compat' ? 'Only two withheld-weapon ordinary menus and three existing comparison/fallback entry play flows. No new default fighting/return acceptance in this scoped follow-up.' :
      'Compiled default acceptance: query-free public default CTA with real random card choices and restart; default Qinggang/Longsword drag/hold/reverse/tap, fresh-state restart and released return/retouch; sabre, rapier, rubber chicken, frozen tuna and pistol input smokes; two withheld weapons remain legacy in ordinary menu; existing unified trial, twelve-key v2 comparison and explicit legacy fallback still select their documented paths. Old stored skill=0 remains byte-identical while the default policy uses fixed preparation. Qinggang ordinary collision/thrust/finish stay legacy; optional trial preserves its previous profile/transported/armorCausal bundle. Player-only r2 policy before first controller/physics/combat, no old level UI in ordinary mode, pause clocks, portrait/landscape, asset bytes and errors. Observers call original functions without changing game/AI/physics state. Native select and fixed weapon URLs configure fixtures; input/start/card/form actions use trusted touch. No human anatomy, optimal strength, injury recovery, blade-power benefit, phone performance or physical iPhone assertion.' };
  await fs.writeFile(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ pass, sourceStable, executionScope: scope, rows: rows.length, returnReviewRequired: summary.returnReviewRequired, failure: fatal?.id ?? null, out }));
}
