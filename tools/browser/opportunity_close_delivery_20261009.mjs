// Close rapier thrust / estoc neck cut delivery, adapted from the prior verified continuity tool.
// Trusted mobile input and read-only gameplay observations; no gameplay mutation.
// Run only after the intended source/dist freeze. Outputs stay outside the checkout.
// --out=/workspace/halfsword-handoff/close-thrust-20261009/mobile/<fresh-name> (or /tmp/halfsword-close-mobile-<fresh-name>)
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
const scenario = [
  { id: 'ordinary-longsword', model: null, weapon: 'longsword', drill: null, tempo: 1 },
  { id: 'close-rapier-near', model: 'close', weapon: 'rapier', drill: 'near', tempo: 1.2, attackKind: 'thrust' },
  { id: 'close-estoc-near', model: 'close', weapon: 'estoc', drill: 'near', tempo: 1.2, attackKind: 'cut' },
];
const opportunityModels = Object.freeze({ close: 'v4' });
const weaponProfiles = Object.freeze({ rapier: { id: 'one:thrust', twoHand: false },
  estoc: { id: 'two:thrust', twoHand: true }, longsword: { id: 'two:versatile', twoHand: true } });
const comparisonLinks = '#close-thrust a[href]';
const artifactRoot = '/workspace/halfsword-handoff/close-thrust-20261009/mobile';
const allowedOut = p => path.dirname(p) === artifactRoot || /^\/tmp\/halfsword-close-mobile-[^/]+$/.test(p);
assert(args.out && path.isAbsolute(args.out));
const out = path.resolve(args.out);
assert(allowedOut(out));
await fs.mkdir(path.dirname(out), { recursive: true });
assert.equal(await fs.realpath(path.dirname(out)), path.dirname(out));
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
const fixedFiles = ['tools/browser/opportunity_close_delivery_20261009.mjs', 'index.html', 'package.json', 'package-lock.json', 'public/feature-lab.html'];
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
  assert(allowedOut(path.dirname(evidence)));
  assert.equal(await fs.realpath(path.dirname(evidence)), path.dirname(evidence));
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
const networkAttempts = [], inFlightRoutes = new Set();
let closingRequests = false;
const teardown = { networkIdle: false, routesAtStart: null, checkedArtifactsDuringDrain: 0,
  routesBeforeClose: null, lateRequests: 0, contextClosed: false };
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
let browser, context, page, cdp, fatal = null, failureSnapshot = null, pass = false, lab = null, ordinaryMenu = null;
const budgetMs = 60000 + 120000 * scenario.length;
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
    const task = (async () => {
    const url = route.request().url();
    // Keep the confinement route installed until context.close. A request
    // arriving after the drain is a reported failure, never an unverified
    // network request slipping through an unroute/close gap.
    if (closingRequests) {
      teardown.lateRequests++;
      errors.push({ kind: 'late-request', url: clean(url) });
      return route.abort('blockedbyclient');
    }
    if (!confined(url)) { errors.push({ kind: 'blocked', url: clean(url) }); return route.abort('blockedbyclient'); }
    try {
      let response;
      for (let attempt = 1; attempt <= 2; attempt++) {
        response = await route.fetch({ maxRedirects: 0, maxRetries: 0, timeout: 30000 });
        const retry = route.request().method() === 'GET' && [502, 503].includes(response.status()) && attempt === 1;
        networkAttempts.push({ url: clean(url), method: route.request().method(), attempt, status: response.status(), retry });
        if (!retry) break;
        await response.dispose();
      }
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
    })();
    inFlightRoutes.add(task);
    try { await task; }
    catch (error) { errors.push({ kind: 'route-completion', message: clean(error.message) }); }
    finally { inFlightRoutes.delete(task); }
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
      const p = window.opportunityProbe = { native: [], accepted: [], rangeSamples: [], ids: new WeakMap(), next: 1, queues: [], attacks: [], seenQueues: new WeakSet(), seenAttacks: new WeakSet() };
      const range = f => ({ queued: f.skill.thrustRange ? { phase: f.skill.thrustRange.phase, age: f.skill.thrustRange.age, measure: { ...f.skill.thrustRange.measure }, target: [...f.skill.thrustRange.target] } : null, last: f.skill.lastThrustRange ? { ...f.skill.lastThrustRange } : null, actualThrusts: f.skill.thrusts, tapActive: !!f.skill.tap, tapSpecial: !!f.skill.tap?.opportunity, rangePrepared: !!f.skill.tap?.rangePrepared, thrustPush: !!f.skill.thrustPush, cutPlan: f.skill.tap?.opportunityCut ? JSON.parse(JSON.stringify(f.skill.tap.opportunityCut)) : null, closePlan: f.skill.tap?.opportunityClose ? JSON.parse(JSON.stringify(f.skill.tap.opportunityClose)) : null, target: f.skill.tap?.opportunity ? { target: [...f.skill.tap.opportunity.target], targetId: f.skill.tap.opportunity.targetId, zone: f.skill.tap.opportunity.zone, kind: f.skill.tap.opportunity.kind } : null, tapTiming: f.skill.tap ? { t: f.skill.tap.t, K: { ...f.skill.tap.K } } : null });
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
        opportunity: f.opportunityModel ?? 'off', getupLeadDelay: !!f.getupLeadDelay, tempo: f.thrustRangeTempo ?? 1, closeThrust: f.opportunityCloseThrust === true, tapKind: f.opportunityTapKind ?? null });
      p.read = () => ({ url: location.href, state: game.state, steps: game.combat.stepNo, simTime: game.stats.simTime,
        fightT: game.player.fightT, objects: { player: id(game.player), enemy: id(game.enemy), world: id(game.world), ai: id(game.ai) },
        player: { state: game.player.state, armed: game.player.armed, legs: [game.player.limbs.legF, game.player.limbs.legB], range: range(game.player), weapon: game.player.weapon.id, alive: game.player.alive, wounds: game.player.wounds.length, support: support(game.player),
          weaponState: weapon(game.player), profileId: game.player.swordsmanshipState?.profileId ?? null,
          hasV2State: !!game.player.swordsmanshipState, skillLevel: game.player.skill.level, autoGuard: game.player.skill.autoGuard,
          pelvis: { ...game.player.bodies.pelvis.translation() }, move: { x: game.player.move.x, y: game.player.move.y },
          stickY: game.player.stickY, handHeld: game.player.handHeld, hand: { x: game.player.handOffset.x, y: game.player.handOffset.y },
          lastMotionTimeS: game.player.swordsmanshipState?.lastMotionTimeS ?? null,
          swordInput: game.player.swordsmanshipState?.input ? { ...game.player.swordsmanshipState.input } : null },
        enemy: { fixture: game.enemy.opportunityDrillState ? { ...game.enemy.opportunityDrillState } : null, state: game.enemy.state, armed: game.enemy.armed, legs: [game.enemy.limbs.legF, game.enemy.limbs.legB], aiAttacks: game.ai.stats.attacks, range: range(game.enemy), weapon: game.enemy.weapon.id, alive: game.enemy.alive, wounds: game.enemy.wounds.length, support: support(game.enemy),
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
        recoveryTrial: { ...game.recoveryFinishTrial }, recoveryTrialPanel: document.getElementById('movementFixInfo')?.textContent ?? null,
        geometry: [game.player, game.enemy].map(f => ({ state: f.state, head: { ...f.bodies.head.translation() }, chest: { ...f.bodies.chest.translation() }, chestQ: { ...f.bodies.chest.rotation() }, pelvis: { ...f.bodies.pelvis.translation() }, bladeBase: { ...f.bladePoint(0) }, bladeTip: { ...f.bladePoint(1) }, finish: { on: f.finish.on, amt: f.finish.amt, canStart: f.finish.canStart, surfaceInside: f.finish.plunge?.surfaceInside, surfaceWalk: f.finish.plunge?.surfaceWalk } })),
        trial: { ...game.opportunityTrial }, trialPanel: document.getElementById('opportunityInfo')?.textContent ?? null,
        accepted: p.accepted.slice(), rangeSamples: p.rangeSamples.slice(), queues: p.queues.slice(), attacks: p.attacks.slice(),
        drillHUD: { exists: !!document.getElementById('opportunityDrill'), hidden: document.getElementById('opportunityDrill')?.hidden ?? true, text: document.getElementById('opportunityDrill')?.textContent ?? null, status: document.getElementById('opportunityDrillStatus')?.textContent ?? null },
        input: { enabled: game.input.enabled, activeTouch: game.input.activeTouch,
          taps: game.input.taps, stick: [game.input.stickMove.x, game.input.stickMove.y], pending: [game.input.handDX, game.input.handDY] },
        saved: localStorage.getItem('gladiator-settings'), finite: p.bodies().every(Number.isFinite),
        drawVisible: document.querySelector('#draw').classList.contains('show'),
        layout: { width: innerWidth, scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) } });
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) document.addEventListener(type, event => {
        if (p.native.length < 250) p.native.push({ type, trusted: event.isTrusted, kind: event.pointerType, fightT: game.player.fightT, player: id(game.player),
          target: event.target.closest?.('button')?.id || event.target.id, pointerId: event.pointerId, eventTimeStampMs: event.timeStamp, observedAtMs: performance.now(), pressStartMs: game.input.press?.t ?? null, pressDurationMs: game.input.press ? event.timeStamp - game.input.press.t : null });
      }, true);
      // Sample the existing consumed-input flag for both old and v2 controllers.
      // This observer never changes a game field or wraps a gameplay method.
      const sample = () => {
        if (game.state === 'fight') {
          const f = game.player, skill = f.skill;
          if (skill.thrustRange && !p.seenQueues.has(skill.thrustRange)) {
            p.seenQueues.add(skill.thrustRange);
            p.queues.push({ player: id(f), step: game.combat.stepNo, fightT: f.fightT, actualThrusts: skill.thrusts, target: [...skill.thrustRange.target] });
          }
          if (skill.tap && !p.seenAttacks.has(skill.tap)) {
            p.seenAttacks.add(skill.tap);
            p.attacks.push({ player: id(f), step: game.combat.stepNo, fightT: f.fightT, pelvis: { ...f.bodies.pelvis.translation() }, range: range(f) });
          }
        }
        if (game.state === 'fight' && p.rangeSamples.length < 1000 && (game.player.skill.thrustRange || game.player.skill.tap?.opportunity)) p.rangeSamples.push({ observedAtUTCms: Date.now(), step: game.combat.stepNo, fightT: game.player.fightT, player: range(game.player), bodyGeometry: Object.fromEntries(['head','chest','uarmS','farmS','uarmO','farmO'].map(key => [key, { p: { ...game.player.bodies[key].translation() }, q: { ...game.player.bodies[key].rotation() } }])) });
        if (game.state === 'fight' && game.player.inputActive && p.accepted.length < 100)
          p.accepted.push({ player: id(game.player), step: game.combat.stepNo, held: game.player.handHeld,
            hand: { x: game.player.handOffset.x, y: game.player.handOffset.y } });
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  }
  const read = () => page.evaluate(() => opportunityProbe.read());
  function common(row) {
    assert.equal(row.saved, saved); assert(row.finite);
    assert.equal(row.policies.gravity, -9.81); assert.equal(row.policies.startHold, 2);
    assert(row.layout.scrollWidth <= row.layout.width + 1, 'Mobile horizontal overflow');
  }
  function current(row, weapon, model = null) {
    common(row); assert.equal(row.policies.finish, 'power'); assert.equal(row.policies.finishTarget, 'both');
    assert.equal(row.trial.active, model !== null); assert.equal(row.trialPanel !== null, model !== null);
    assert.equal(row.recoveryTrial.active, false); assert.equal(row.recoveryTrialPanel, null);
    if (model !== null) {
      assert.equal(row.trial.requested, true); assert.equal(row.trial.model, model); assert.equal(row.trial.weapon, weapon);
      assert.equal(row.trial.finish, 'low'); assert.equal(row.trial.opportunity, opportunityModels[model]);
      assert.equal(row.trial.recovery, 'legacy'); assert.equal(row.trial.close, model === 'close');
    }
    for (const fighter of [row.player, row.enemy]) {
      assert.equal(fighter.support.model, 'linked');
      if (row.fightT < 2) assert(fighter.alive);
      assert.equal(fighter.weaponState.finishEntry, 'low');
      assert.equal(fighter.weaponState.opportunity, opportunityModels[model] ?? 'off');
      assert.equal(fighter.weaponState.recoverySequence, 'legacy');
      assert.equal(fighter.weaponState.getupLeadDelay, true);
      assert.equal(fighter.weaponState.closeThrust, fighter === row.player && model === 'close');
      assert(Number.isFinite(fighter.weaponState.mass) && fighter.weaponState.mass > 0);
      if (row.steps > 0) {
        const sample = fighter.support.sample;
        assert(sample, 'Active fighter must carry its real cached support sample');
        assert.equal(typeof sample.eligible, 'boolean');
        assert(sample.distance === null || Number.isFinite(sample.distance));
        for (const key of ['reachWeight', 'muscleScale', 'healthScale', 'weight']) {
          assert(Number.isFinite(sample[key]) && sample[key] >= 0 && sample[key] <= 1, `Invalid cached support ${key}`);
        }
      }
    }
    assert.equal(row.policies.defaultActive, true); assert.equal(row.policies.limb, true); assert.equal(row.policies.supportProbe, false);
    if (weapon) {
      assert.equal(row.player.weapon, weapon === 'branch' ? 'tree_branch' : weapon); assert.equal(row.enemy.weapon, model === null ? weapon : 'longsword'); assert(!row.drawVisible);
      for (const fighter of [row.player, row.enemy]) assert.equal(fighter.weaponState.gripPoint, 'midpoint');
      assert.equal(row.policies.v2, 'unified'); assert.equal(row.policies.enemyV2, 'legacy'); assert(row.player.hasV2State);
      const expectedProfile = weaponProfiles[weapon]; assert(expectedProfile, 'Explicit current weapon profile required');
      assert.equal(row.player.profileId, expectedProfile.id);
      assert.equal(row.player.support.twoHand, expectedProfile.twoHand);
      assert.equal(row.player.weaponState.config.twoHand, expectedProfile.twoHand);
      assert.equal(row.enemy.support.twoHand, true); assert.equal(row.enemy.weaponState.config.twoHand, true);
      assert.equal(row.player.skillLevel, 0); assert.equal(row.player.autoGuard, false);
      assert.equal(row.policies.arm, 'manual'); assert.equal(row.policies.enemyArm, 'legacy');
      assert.equal(row.policies.roll, 'bounded'); assert.equal(row.policies.stance, 'fresh');
      assert.equal(row.policies.cut, weapon === 'branch' ? 'legacy' : 'centerline');
      assert.equal(row.policies.cutTarget, weapon === 'branch' ? 'both' : 'player');
      assert.equal(row.policies.gripReaction, 'paired');
    }
  }
  async function send(type, touchPoints, timestamp) {
    inputRequests.push({ entry: entries.at(-1)?.id, type, touchPoints, timestamp });
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints, ...(timestamp === undefined ? {} : { timestamp }) });
  }
  async function nativeInput(row, label) {
    const flow = row[label] = { before: await read() };
    await send('touchStart', [{ x: 675, y: 240, id: 1 }]);
    await send('touchMove', [{ x: 645, y: 200, id: 1 }]);
    flow.handHeld = await read(); assert.notEqual(flow.handHeld.input.activeTouch, null);
    await wait(count => opportunityProbe.accepted.length > count, flow.before.accepted.length);
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
    flow.completed = await read(); current(flow.completed, row.weapon, row.model);
    assert.equal(flow.completed.input.activeTouch, null); assert.deepEqual(flow.completed.input.stick, [0, 0]);
  }
  async function pause() {
    await page.locator('#btnPause').tap(); await wait(() => game.state === 'paused');
    const row = await read(); common(row); assert.equal(row.input.enabled, false);
    assert.equal(row.input.activeTouch, null); assert.deepEqual(row.input.stick, [0, 0]); return row;
  }
  function practicePolicy(row, fixture) {
    current(row, fixture.weapon, fixture.model);
    assert.equal(row.trial.tempo, fixture.tempo);
    assert.equal(row.trial.drill, fixture.drill);
    assert.equal(row.player.weaponState.tempo, fixture.tempo);
    if (fixture.attackKind) assert.equal(row.player.weaponState.tapKind, fixture.attackKind);
    assert.equal(row.enemy.weaponState.tempo, fixture.tempo);
    if (fixture.drill) {
      assert.equal(row.trial.drillGap, fixture.drill === 'near' ? 1.25 : 2.15);
      assert(row.enemy.fixture); assert.deepEqual(row.enemy.legs, row.enemy.fixture.prepared ? [.2, .2] : [1, 1]); assert.equal(row.enemy.armed, true);
      assert.equal(row.enemy.aiAttacks, 0); assert.equal(row.enemy.range.actualThrusts, 0);
      assert(row.drillHUD.exists && /반격 없는 무릎 연습 상대/.test(row.drillHUD.text));
    } else {
      assert.deepEqual(row.player.legs, [1, 1]); assert.deepEqual(row.enemy.legs, [1, 1]);
      assert.equal(row.drillHUD.exists, false);
    }
  }
  async function readyPractice(row) {
    // Allow the real fall controller and the usual two-second start hold to settle.
    // No gameplay method or state is changed by the test.
    await wait(() => game.state === 'fight' && game.player.fightT >= 6 &&
      game.enemy.state === 'kneel' && game.enemy.alive && game.player.alive, null, 60000);
    const ready = await read(); practicePolicy(ready, row);
    assert(!ready.drillHUD.hidden); assert(/톡/.test(ready.drillHUD.status));
    assert((row.attackKind === 'cut' ? /목 베기 시도/ : /제자리 찌르기/).test(ready.drillHUD.status));
    return ready;
  }
  async function tapSword() {
    // Sequential CDP acknowledgements took 540ms under software rendering,
    // incorrectly turning the requested tap into a long hold. Send the actual
    // requested 80ms event timestamps through CDP; never dispatch JS events or
    // alter the game's input thresholds. Messages retain protocol order.
    const timestamp = Date.now() / 1000;
    await Promise.all([
      send('touchStart', [{ x: 675, y: 240, id: 71 }], timestamp),
      send('touchEnd', [], timestamp + .08),
    ]);
    const observed = await page.evaluate(() => opportunityProbe.native.filter(e => e.target === 'game' && e.type === 'pointerup').at(-1));
    assert(observed?.trusted && observed.pressDurationMs > 0 && observed.pressDurationMs < 120,
      'Browser must observe the requested short trusted tap, not renderer acknowledgement delay');
    return observed;
  }
  async function startVisualCapture(row, label) {
    const frames = [], pending = [];
    const receive = event => {
      pending.push(cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId })
        .catch(error => errors.push({ kind: 'screencast-ack', message: clean(error.message) })));
      if (frames.length >= 48) return;
      const name = `${row.id}-${label}-frame-${String(frames.length).padStart(3, '0')}.png`;
      frames.push({ name, metadata: event.metadata, observedAtUTCms: Date.now() });
      pending.push(fs.writeFile(path.join(out, name), Buffer.from(event.data, 'base64'))
        .catch(error => errors.push({ kind: 'screencast-write', message: clean(error.message) })));
    };
    cdp.on('Page.screencastFrame', receive);
    await cdp.send('Page.startScreencast', { format: 'png', maxWidth: 844, maxHeight: 390, everyNthFrame: 1 });
    return async () => {
      await cdp.send('Page.stopScreencast');
      cdp.off('Page.screencastFrame', receive);
      await Promise.all(pending);
      return frames;
    };
  }
  async function actualOpportunity(row, label = 'actualOpportunity') {
    const flow = row[label] = { ready: await readyPractice(row) };
    const stopVisual = label === 'actualOpportunity' ? await startVisualCapture(row, label) : null;
    try {
    flow.tap = await tapSword();
    await wait(player => opportunityProbe.attacks.some(a => a.player === player), flow.ready.objects.player);
    flow.result = await read();
    const actual = flow.result.attacks.find(a => a.player === flow.ready.objects.player && a.range.tapSpecial);
    assert(actual, 'A trusted tap must reach an actual opportunity attack; an accepted queue or ordinary thrust is insufficient');
    assert(!actual.range.rangePrepared, 'Close attack must not wait for range preparation');
    assert.equal(flow.result.queues.filter(q => q.player === flow.ready.objects.player).length, 0);
    assert.equal(flow.result.player.range.queued, null);
    assert(actual.range.target && ['head', 'face', 'neck'].includes(actual.range.target.zone));
    assert.equal(actual.range.target.kind, row.attackKind); assert(actual.range.target.target.every(Number.isFinite));
    assert(actual.range.target.targetId !== 0);
    assert(actual.range.actualThrusts > flow.ready.player.range.actualThrusts);
    flow.observedReadyToAttackSeconds = actual.fightT - flow.ready.fightT;
    flow.observedReleaseToAttackSeconds = actual.fightT - flow.tap.fightT;
    flow.pelvisDisplacementAtAttackM = Math.hypot(actual.pelvis.x - flow.ready.player.pelvis.x,
      actual.pelvis.z - flow.ready.player.pelvis.z);
    flow.actual = actual;
    assert(row.attackKind === 'cut' ? actual.range.cutPlan : actual.range.closePlan,
      'Candidate must execute its actual cut or close-thrust plan');
    if (row.attackKind === 'cut') {
      assert.equal(actual.range.target.zone, 'neck');
      assert.equal(actual.range.thrustPush, false);
      assert.equal(actual.range.closePlan, null);
    }
    if (actual.range.closePlan) {
      const plan = actual.range.closePlan;
      for (const key of ['start', 'hand', 'dir', 'target']) assert(plan[key].every(Number.isFinite));
      assert(Number.isFinite(plan.aim) && plan.aim > 0);
      assert(Number.isFinite(plan.extension) && plan.extension > 0);
    }
    await page.screenshot({ path: path.join(out, `${row.id}-${label}.png`) });
    await wait(t => game.player.fightT > t + 1 && !game.player.skill.tap, actual.fightT);
    flow.completed = await read();
    assert(flow.completed.finite); assert.equal(flow.completed.player.range.queued, null);
    if (row.attackKind === 'cut') {
      const samples = flow.completed.rangeSamples.filter(sample => sample.player.cutPlan);
      assert(samples.length); assert(samples.every(sample => sample.player.thrustPush === false));
    }
    } finally { if (stopVisual) flow.visualFrames = await stopVisual(); }
  }
  async function pausePractice(row) {
    row.paused = await pause();
    const frozen = await page.evaluate(() => ({ frame: game.renderInfo().frame, bodies: opportunityProbe.bodies(), steps: game.combat.stepNo }));
    await wait(frame => game.renderInfo().frame > frame + 1, frozen.frame);
    const still = await page.evaluate(() => ({ bodies: opportunityProbe.bodies(), steps: game.combat.stepNo }));
    assert.deepEqual(still.bodies, frozen.bodies); assert.equal(still.steps, frozen.steps); row.pauseFrozen = true;
    const settled = await read(); assert(settled.drillHUD.hidden);
    await page.locator('#btnResume').tap(); await wait(steps => game.state === 'fight' && game.combat.stepNo > steps, frozen.steps);
    row.resumed = await read(); practicePolicy(row.resumed, row);
    assert.deepEqual(row.resumed.objects, row.restarted.objects);
    row.final = await pause(); practicePolicy(row.final, row);
  }
  const labURL = new URL('feature-lab.html#close-thrust', base);
  await page.goto(labURL.href, { waitUntil: 'load', timeout: 30000 });
  lab = { url: page.url(), links: await page.locator(comparisonLinks).evaluateAll(links => links
    .filter(a => new URL(a.href).searchParams.has('opportunity'))
    .map(a => ({ id: a.id, text: a.innerText, href: a.href }))), layout: await page.evaluate(() => ({
      width: innerWidth, scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) })) };
  assert(lab.layout.scrollWidth <= lab.layout.width + 1, 'Comparison page mobile horizontal overflow');
  for (const fixture of scenario.filter(x => x.drill)) assert(lab.links.some(link => {
    const url = new URL(link.href);
    return confined(url.href) && url.searchParams.get('weapon') === fixture.weapon &&
      url.searchParams.get('opportunity') === fixture.model && url.searchParams.get('drill') === fixture.drill && [...url.searchParams].length === 3;
  }), `Missing public practice link: ${fixture.id}`);
  await page.screenshot({ path: path.join(out, 'lab-portrait.png') });
  for (const fixture of scenario) {
    const { weapon, model, drill } = fixture;
    await page.setViewportSize({ width: 390, height: 844 });
    if (!drill) {
      const url = new URL(base); url.search = new URLSearchParams({ weapon });
      await page.goto(url.href, { waitUntil: 'load', timeout: 30000 });
    } else {
      await page.goto(labURL.href, { waitUntil: 'load', timeout: 30000 });
      const selected = lab.links.find(link => {
        const q = new URL(link.href).searchParams;
        return q.get('weapon') === weapon && q.get('opportunity') === model && q.get('drill') === drill && [...q].length === 3;
      });
      const linkIndex = await page.locator(comparisonLinks).evaluateAll((links, href) => links.findIndex(a => a.href === href), selected.href);
      assert(linkIndex >= 0); const entryLink = page.locator(comparisonLinks).nth(linkIndex);
      await entryLink.scrollIntoViewIfNeeded();
      await Promise.all([page.waitForURL(selected.href), entryLink.tap()]);
    }
    await observe();
    const row = { ...fixture, entryPortrait: await read() }; entries.push(row); practicePolicy(row.entryPortrait, row);
    await page.screenshot({ path: path.join(out, `${row.id}-entry-portrait.png`) });
    await page.setViewportSize({ width: 844, height: 390 }); cdp = await context.newCDPSession(page);
    row.menu = await read(); practicePolicy(row.menu, row);
    await page.locator('#btnStart').tap(); await wait(() => game.state === 'fight' && game.player.fightT > 0);
    row.started = await read(); practicePolicy(row.started, row);
    for (const fighter of [row.started.player, row.started.enemy]) {
      assert.equal(fighter.wounds, 0); assert.equal(fighter.support.mainHealth, 1); assert.equal(fighter.support.offhandHealth, 1);
    }
    if (drill) {
      await actualOpportunity(row);
      row.beforeRestart = await read();
      await page.locator('#opportunityDrillRepeat').tap();
      await wait(player => game.state === 'fight' && opportunityProbe.read().objects.player !== player && game.player.fightT > 0, row.beforeRestart.objects.player);
      row.restarted = await read(); practicePolicy(row.restarted, row);
      for (const key of Object.keys(row.restarted.objects)) assert.notEqual(row.restarted.objects[key], row.beforeRestart.objects[key]);
      assert.equal(row.restarted.player.range.actualThrusts, 0); assert.equal(row.restarted.player.range.queued, null);
      assert.equal(row.restarted.player.wounds, 0); assert.equal(row.restarted.enemy.wounds, 0);
      await actualOpportunity(row, 'restartOpportunity');
      await pausePractice(row);
    } else {
      ordinaryMenu = row.menu;
      await nativeInput(row, 'firstInput'); row.paused = await pause();
      const frozen = await page.evaluate(() => ({ frame: game.renderInfo().frame, bodies: opportunityProbe.bodies(), steps: game.combat.stepNo }));
      await wait(frame => game.renderInfo().frame > frame + 1, frozen.frame);
      const still = await page.evaluate(() => ({ bodies: opportunityProbe.bodies(), steps: game.combat.stepNo }));
      assert.deepEqual(still.bodies, frozen.bodies); assert.equal(still.steps, frozen.steps); row.pauseFrozen = true;
      await page.locator('#btnResume').tap(); await wait(steps => game.state === 'fight' && game.combat.stepNo > steps, frozen.steps);
      row.resumed = await read(); current(row.resumed, weapon, model); assert.deepEqual(row.resumed.objects, row.started.objects);
      row.beforeRestart = await pause(); await page.locator('#btnStart').tap();
      await wait(() => game.state === 'fight' && game.player.fightT > 0);
      row.restarted = await read(); practicePolicy(row.restarted, row);
      for (const key of Object.keys(row.restarted.objects)) assert.notEqual(row.restarted.objects[key], row.beforeRestart.objects[key]);
      assert.equal(row.restarted.player.wounds, 0); assert.equal(row.restarted.enemy.wounds, 0);
      await nativeInput(row, 'restartInput'); row.final = await pause(); current(row.final, weapon, model);
    }
    row.native = await page.evaluate(() => opportunityProbe.native.slice());
    assert(row.native.length && row.native.every(event => event.trusted && event.kind === 'touch'));
    for (const id of ['btnStart', 'btnPause', 'btnResume', ...(drill ? ['opportunityDrillRepeat'] : [])]) assert(row.native.some(event => event.target === id));
    await cdp.detach(); cdp = null;
    console.log(JSON.stringify({ event: 'flow-complete', id: row.id, weapon, steps: row.final.steps, simTime: row.final.simTime }));
  }
  assert(compiled.some(item => item.name === 'dist/feature-lab.html') && compiled.some(item => item.name === 'dist/index.html') &&
    compiled.some(item => item.name.startsWith('dist/assets/main-')));
  assert(compiled.every(item => item.match)); assert.deepEqual(errors, []); pass = true;
} catch (error) {
  fatal = { name: error.name, message: clean(error.message), stack: clean(error.stack) }; process.exitCode = 1;
  if (page && !page.isClosed()) {
    try {
      failureSnapshot = await page.evaluate(() => ({ state: window.opportunityProbe?.read(), native: window.opportunityProbe?.native.slice() }));
      await page.screenshot({ path: path.join(out, 'failure-scene.png') });
    } catch (snapshotError) { errors.push({ kind: 'failure-snapshot', message: clean(snapshotError.message) }); }
  }
} finally {
  if (cdp) await cdp.detach().catch(() => {});
  teardown.routesAtStart = inFlightRoutes.size;
  const checkedBeforeDrain = compiled.length;
  try {
    if (page && !page.isClosed()) {
      await page.waitForLoadState('networkidle', {
        timeout: Math.max(100, Math.min(30000, budgetMs - (performance.now() - start))),
      });
      teardown.networkIdle = true;
    }
    // route.fetch uses the context request client. Finish status/body/hash
    // verification and fulfill/abort before disposing that client.
    while (inFlightRoutes.size) await Promise.allSettled([...inFlightRoutes]);
    closingRequests = true;
    teardown.routesBeforeClose = inFlightRoutes.size;
    assert.equal(teardown.routesBeforeClose, 0);
  } catch (error) {
    errors.push({ kind: 'teardown-drain', message: clean(error.message) });
    pass = false;
  }
  teardown.checkedArtifactsDuringDrain = compiled.length - checkedBeforeDrain;
  try { if (context) { await context.close(); teardown.contextClosed = true; } }
  catch (error) { errors.push({ kind: 'context-close', message: clean(error.message) }); pass = false; }
  try { if (browser) await browser.close(); }
  catch (error) { errors.push({ kind: 'browser-close', message: clean(error.message) }); pass = false; }
  clearTimeout(deadline);
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
    base: base.href, buildStable, sourceStable, manifestBefore: before, scenario, settings, savedSettingsRaw: saved, lab, ordinaryMenu, entries,
    compiled, networkAttempts, errors, fatal, failureSnapshot, inputRequests, teardown, tlsVerification: true, proxyRetained: !local,
    limits: ['Chromium mobile emulation, not physical-phone or human feel acceptance.',
      'Three flows: healthy ordinary longsword plus near rapier and estoc against explicitly labelled passive weak-leg practice opponents. Practice setup is game feature code; the observer writes no gameplay state, body transform, RNG, clock or method.',
      'Trusted touch must start the planned rapier thrust or estoc neck cut without a range queue, before and after restart. Read-only event capture records target, optional reachable chamber plan, pelvis movement and timing. No wound or death success rate is inferred.',
      'Tap timestamps request an 80ms trusted CDP gesture; observed pointer duration is asserted. This avoids measured 540ms sequential acknowledgement latency in software rendering, not a change to game input thresholds or evidence of physical-phone latency.',
      'Practice repeat uses its real button and new player/enemy/world/AI instances. Both repetitions must start the intended actual attack. Pause and resume preserve body state.',
      'First candidate attacks include a bounded read-only CDP screencast for visual review. Frame metadata and separate geometry samples are timestamped; these are not claimed to be synchronized mocap or a human naturalness judgement.',
      'General getup delay stays on for both fighters and survives restart. Prior unchanged compatibility checks are not repeated.',
      'Public verification requires identical source, tool and dist to passing local evidence. Every served artifact must finish 200 and byte-match. At most one explicit GET retry for 502/503 is logged; TLS and other errors are not ignored.'] };
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await fs.writeFile(path.join(out, 'manifest-after.json'), JSON.stringify(after, null, 2) + '\n');
  console.log(JSON.stringify({ pass, buildStable, sourceStable, comparisonFlows: entries.length,
    wallMs: report.wallMs, fatal, out }));
}
