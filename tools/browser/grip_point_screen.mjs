// Compiled game, original enemy/native physics, trusted controls. Camera only.
// Run from the repository root; --out must be a fresh directory.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const opts = Object.fromEntries(process.argv.slice(2).map(arg => {
  const m = /^--(base|out|weapons|modes|entry)=(.+)$/.exec(arg);
  assert.ok(m, 'Use --base= --out= --weapons= --modes= --entry=');
  return [m[1], m[2]];
}));
const base = new URL(opts.base || 'http://127.0.0.1:4281/');
assert.ok((['127.0.0.1', 'localhost'].includes(base.hostname) && ['http:', 'https:'].includes(base.protocol)) ||
  (base.origin === 'https://yoonjl-svg.github.io' && base.pathname === '/halfsword-codex/'), 'Own Pages or localhost only');
assert.ok(!base.username && !base.password, 'No URL credentials');
const weapons = (opts.weapons || 'monohoshizao,lightsaber').split(',');
const entry = opts.entry || 'comparison';
assert.ok(['comparison','default'].includes(entry));
const modes = (opts.modes || (entry === 'default' ? 'axial' : 'midpoint,axial')).split(',');
assert.ok(entry !== 'default' || modes.every(mode => mode === 'axial'));
assert.ok(weapons.length && weapons.every(w => /^[a-z0-9_]+$/.test(w)) && new Set(weapons).size === weapons.length);
assert.ok(modes.length && modes.every(m => ['midpoint', 'axial'].includes(m)) && new Set(modes).size === modes.length);
assert.ok(opts.out, '--out=fresh-directory required');
await fs.mkdir(opts.out, {recursive: false});
const sha = b => createHash('sha256').update(b).digest('hex');
const sourceNames = ['src/fighter.js', 'src/main.js', 'src/hand_visual.js', 'src/weapons.js', 'src/config.js', 'src/skill.js',
  'tools/browser/grip_point_screen.mjs'];
const manifest = async () => Object.fromEntries(await Promise.all(sourceNames.map(async name => [name, sha(await fs.readFile(name))])));
const sourceBefore = await manifest();
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
const startedAt = new Date().toISOString();
const rows = [];
let browser, pass = false;

try {
  const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const launch = {executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-background-networking', '--use-gl=angle', '--use-angle=swiftshader']};
  if (base.protocol === 'https:' && (process.env.HTTPS_PROXY || process.env.HTTP_PROXY)) {
    const p = new URL(process.env.HTTPS_PROXY || process.env.HTTP_PROXY);
    launch.proxy = {server: `${p.protocol}//${p.host}`};
    if (p.username) launch.proxy.username = decodeURIComponent(p.username);
    if (p.password) launch.proxy.password = decodeURIComponent(p.password);
  }
  browser = await chromium.launch(launch);
  for (const weapon of weapons) for (const mode of modes) {
    const dir = path.join(opts.out, `${weapon}-${mode}`);
    await fs.mkdir(dir);
    const context = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
    await context.addInitScript(() => localStorage.setItem('gladiator-settings', JSON.stringify({skill: '0.7', difficulty: 'normal'})));
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    const url = new URL(base);
    // Replace preexisting query parameters: both modes share all ordinary defaults.
    url.search = new URLSearchParams({weapon, foeWeapon: 'longsword', foe: 'default', ...(entry === 'comparison' ? {targetCorrection: 'normal', gripPoint: mode} : {})}).toString();
    url.hash = '';
    try {
      await page.goto(url.href);
      await page.waitForFunction(() => window.game?.player?.sword, null, {timeout: 60000});
      const portrait = await page.evaluate(() => ({width: innerWidth, scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)}));
      assert.equal(portrait.width, 390);
      assert.ok(portrait.scrollWidth <= portrait.width + 1, 'Portrait overflow');
      const assets = await page.locator('script[type="module"][src]').evaluateAll(nodes => nodes.map(n => n.src));
      assert.ok(assets.length && assets.every(u => new URL(u).pathname.includes('/assets/')), 'Serve the compiled build');
      const compiled = [];
      for (const asset of assets) {
        const response = await page.request.get(asset);
        assert.equal(response.status(), 200);
        const body = await response.body();
        compiled.push({url: asset, bytes: body.length, sha256: sha(body)});
      }
      await page.setViewportSize({width: 844, height: 390});
      await page.evaluate(() => {
        window.gripProbe = {steps: 0, first: [], idle: [], samples: [], touch: [], starts: [], consumed: [], taps: [], thrustCalls: [], phase: 'idle'};
        const seen = new WeakSet();
        const body = b => ({p: b.translation(), q: b.rotation(), v: b.linvel(), w: b.angvel()});
        const finite = f => [...Object.values(f.bodies), f.sword].every(b => [b.translation(), b.rotation(), b.linvel(), b.angvel()].every(v => Object.values(v).every(Number.isFinite)));
        const read = f => {
          const q = f.sword.rotation(), w = f.sword.angvel();
          const blade = new game.THREE.Vector3(0, 1, 0).applyQuaternion(new game.THREE.Quaternion(q.x, q.y, q.z, q.w));
          const aim = f.aimDirW.clone().normalize();
          return {timeS: game.stats.simTime, phase: gripProbe.phase, mode: f.gripPointModel || 'midpoint', weapon: f.weapon.id,
            reactionModel: game.config.GRIP.reactionModel, twoHand: f.weaponCfg.twoHand, gripping: f.gripping,
            state: f.state, alive: f.alive, armed: f.armed, wounds: f.wounds.length, finite: finite(f),
            held: f.handHeld, inputActive: f.inputActive, hand: f.handOffset.toArray(), aim: f.skill.aim.toArray(),
            target: f.handTarget.toArray(), aimDir: f.aimDirW.toArray(), skill: f.skill.level,
            targetDeg: Math.asin(Math.max(-1, Math.min(1, aim.y))) * 180 / Math.PI,
            actualDeg: Math.asin(Math.max(-1, Math.min(1, blade.y))) * 180 / Math.PI,
            aimErrorRad: Math.acos(Math.max(-1, Math.min(1, blade.dot(aim)))),
            omega: Math.hypot(w.x, w.y, w.z), omegaAxial: w.x * blade.x + w.y * blade.y + w.z * blade.z,
            bodies: Object.fromEntries(['pelvis', 'chest', 'uarmS', 'farmS', 'uarmO', 'farmO'].map(n => [n, body(f.bodies[n])])), sword: body(f.sword)};
        };
        window.gripRead = () => ({simTime: game.stats.simTime, state: game.state, player: read(game.player), enemy: read(game.enemy),
          saved: JSON.parse(localStorage.getItem('gladiator-settings')), input: {enabled: game.input.enabled, activeTouch: game.input.activeTouch}});
        const proto = Object.getPrototypeOf(game.player), step = proto.step;
        proto.step = function (...args) {
          const result = step.apply(this, args);
          if (this === game.player) {
            gripProbe.steps++;
            const r = read(this);
            if (!seen.has(this)) { seen.add(this); gripProbe.first.push(r); }
            if (gripProbe.first.length === 1 && gripProbe.phase === 'idle' && r.timeS <= 2) gripProbe.idle.push(r);
            if (gripProbe.steps % 12 === 0) gripProbe.samples.push(r);
            if (game.freeCam) {
              const p = this.bodies.pelvis.translation();
              game.camera.position.set(p.x - 1.8, 1.65, p.z + 2.7);
              game.camera.lookAt(p.x + .3, 1.25, p.z);
            }
          }
          return result;
        };
        for (const [name, dest] of [['consumeHandDelta', 'consumed'], ['consumeTaps', 'taps']]) {
          const original = game.input[name];
          game.input[name] = function (...args) {
            const result = original.apply(this, args);
            if (name === 'consumeTaps' ? result > 0 : result.x || result.y) gripProbe[dest].push({timeS: game.stats.simTime, phase: gripProbe.phase, value: result});
            return result;
          };
        }
        const skillProto = Object.getPrototypeOf(game.player.skill), thrust = skillProto.thrust;
        skillProto.thrust = function (...args) {
          const before = {state: this.f.state, alive: this.f.alive, armed: this.f.armed, pending: !!this.tap, hasFoe: !!this.f.foe, thrusts: this.thrusts};
          const accepted = thrust.apply(this, args);
          if (this.f === game.player) gripProbe.thrustCalls.push({timeS: game.stats.simTime, before, accepted, thrusts: this.thrusts});
          return accepted;
        };
        document.getElementById('btnStart').addEventListener('pointerdown', e => gripProbe.starts.push({trusted: e.isTrusted, kind: e.pointerType}));
        for (const type of ['pointerdown', 'pointermove', 'pointerup']) document.addEventListener(type, e => {
          if (e.target === document.getElementById('game')) gripProbe.touch.push({type, phase: gripProbe.phase, timeS: game.stats.simTime,
            trusted: e.isTrusted, kind: e.pointerType, x: e.clientX, y: e.clientY, eventTimeMs: e.timeStamp,
            pressBefore: game.input.press ? {...game.input.press} : null});
        }, true);
      });
      const initial = await page.evaluate(() => gripRead());
      assert.equal(initial.player.mode, mode);
      assert.equal(initial.enemy.mode, 'midpoint', 'Player-only mode');
      assert.equal(initial.player.reactionModel, 'paired', 'Ordinary paired GRIP expected');
      assert.equal(initial.player.skill, .7);
      assert.equal(initial.player.weapon, weapon);
      assert.equal(initial.enemy.weapon, 'longsword');
      await page.locator('#btnStart').tap();
      await page.waitForFunction(() => game.state === 'fight' && gripProbe.first.length === 1, null, {timeout: 60000});
      await page.waitForFunction(() => game.stats.simTime >= .45, null, {timeout: 60000});
      await page.screenshot({path: path.join(dir, '01-idle-default.png')});
      await page.evaluate(() => { game.freeCam = true; });
      await page.waitForFunction(() => game.stats.simTime >= 1.85, null, {timeout: 60000});
      await page.screenshot({path: path.join(dir, '02-idle-oblique.png')});
      await page.waitForFunction(() => game.stats.simTime >= 2, null, {timeout: 60000});
      const idle = await page.evaluate(() => ({state: gripRead(), frames: gripProbe.idle, touch: gripProbe.touch, consumed: gripProbe.consumed}));
      assert.ok(idle.frames.length && idle.frames.every(r => r.finite && !r.held && !r.inputActive));
      assert.equal(idle.touch.length, 0, 'First two seconds have no game-canvas input');
      assert.equal(idle.consumed.length, 0);
      assert.equal(idle.state.state, 'fight');
      const cdp = await context.newCDPSession(page);
      const send = (type, x, y, timestamp) => cdp.send('Input.dispatchTouchEvent', {type,
        ...(timestamp === undefined ? {} : {timestamp}), touchPoints: type === 'touchEnd' ? [] : [{x, y, id: 1}]});
      await page.evaluate(() => { gripProbe.phase = 'drag'; });
      await send('touchStart', 620, 215);
      for (let i = 1; i <= 10; i++) { await send('touchMove', 620 + i * 6, 215 - i * 4); await page.waitForTimeout(50); }
      await page.waitForTimeout(250);
      await page.screenshot({path: path.join(dir, '03-held.png')});
      const held = await page.evaluate(() => gripRead());
      assert.ok(held.player.held && held.input.activeTouch !== null);
      await page.evaluate(() => { gripProbe.phase = 'extend'; });
      await send('touchMove', 700, 160);
      await page.waitForTimeout(250);
      await page.screenshot({path: path.join(dir, '04-extended.png')});
      const extended = await page.evaluate(() => gripRead());
      await page.evaluate(() => { gripProbe.phase = 'release'; });
      await send('touchEnd');
      await page.waitForTimeout(250);
      await page.screenshot({path: path.join(dir, '05-released.png')});
      const released = await page.evaluate(() => gripRead());
      assert.equal(released.input.activeTouch, null);
      assert.equal(released.player.held, false);
      const beforeTap = await page.evaluate(() => ({taps: gripProbe.taps.length, calls: gripProbe.thrustCalls.length, thrusts: game.player.skill.thrusts}));
      await page.evaluate(() => { gripProbe.phase = 'tap'; });
      const stamp = Date.now() / 1000;
      await send('touchStart', 620, 170, stamp);
      await page.waitForTimeout(80);
      await send('touchEnd', 0, 0, stamp + .08);
      await page.waitForFunction(n => gripProbe.taps.length > n, beforeTap.taps, {timeout: 10000});
      const tap = await page.evaluate(before => ({before, after: gripRead(), thrusts: game.player.skill.thrusts, events: gripProbe.touch.filter(e => e.phase === 'tap'),
        consumed: gripProbe.taps.slice(before.taps), calls: gripProbe.thrustCalls.slice(before.calls)}), beforeTap);
      assert.equal(tap.events.length, 2);
      assert.equal(tap.events[0].type, 'pointerdown');
      assert.equal(tap.events[1].type, 'pointerup');
      assert.ok(Math.abs(tap.events[1].eventTimeMs - tap.events[0].eventTimeMs - 80) < 2, '80ms explicit event-time contract');
      assert.equal(tap.consumed.reduce((sum, r) => sum + r.value, 0), 1);
      // Rejected thrusts from native injury/fall state are recorded, never hidden by state writes.
      if (tap.calls.some(c => c.accepted)) assert.equal(tap.thrusts, beforeTap.thrusts + 1);
      await page.evaluate(() => { window.gripRestartPlayer = game.player; gripProbe.phase = 'restart'; });
      await page.locator('#btnPause').tap();
      await page.waitForFunction(() => game.state === 'paused', null, {timeout: 10000});
      await page.locator('#btnStart').tap();
      await page.waitForFunction(() => game.state === 'fight' && game.player !== gripRestartPlayer && gripProbe.first.length === 2, null, {timeout: 60000});
      const restarted = await page.evaluate(() => ({newPlayer: game.player !== gripRestartPlayer, ...gripRead()}));
      assert.ok(restarted.newPlayer && restarted.player.finite && restarted.enemy.finite);
      assert.equal(restarted.player.mode, mode);
      assert.equal(restarted.enemy.mode, 'midpoint');
      assert.equal(restarted.player.skill, .7);
      assert.deepEqual(restarted.saved, {skill: '0.7', difficulty: 'normal'});
      const probe = await page.evaluate(() => gripProbe);
      assert.ok(probe.starts.length === 2 && probe.starts.every(e => e.trusted && e.kind === 'touch'));
      assert.ok(probe.touch.length > 10 && probe.touch.every(e => e.trusted && e.kind === 'touch'));
      assert.ok(probe.consumed.length >= 10);
      assert.ok(probe.consumed.some(e => e.phase === 'extend'));
      assert.ok(probe.samples.every(r => r.finite) && [held, extended, released, tap.after].every(r => r.player.finite && r.enemy.finite));
      assert.ok(probe.first.every(r => r.mode === mode && r.skill === .7));
      assert.equal(errors.length, 0);
      const metrics = {idleSamples: probe.idle.length, idleMaxOmega: Math.max(...probe.idle.map(r => r.omega)),
        idleMaxAbsAxialOmega: Math.max(...probe.idle.map(r => Math.abs(r.omegaAxial))),
        idleMaxAimErrorRad: Math.max(...probe.idle.map(r => r.aimErrorRad)), thrustAccepted: tap.calls.some(c => c.accepted)};
      const row = {weapon, mode, entry, url: url.href, portrait, compiled, initial, idle, held, extended, released, tap, restarted, probe, metrics, errors};
      await fs.writeFile(path.join(dir, 'result.json'), JSON.stringify(row, null, 2), {flag: 'wx'});
      rows.push({weapon, mode, entry, url: url.href, portrait, compiled, metrics, restarted, errors});
      console.log(JSON.stringify({weapon, mode, metrics, errors}));
    } catch (failure) {
      await fs.writeFile(path.join(dir, 'failure.json'), JSON.stringify({error: String(failure), errors,
        state: await page.evaluate(() => ({current: window.gripRead?.(), probe: window.gripProbe})).catch(() => null)}, null, 2), {flag: 'wx'});
      throw failure;
    } finally { await context.close(); }
  }
  pass = true;
} finally {
  if (browser) await browser.close();
  const sourceAfter = await manifest(), sourceStable = JSON.stringify(sourceBefore) === JSON.stringify(sourceAfter);
  await fs.writeFile(path.join(opts.out, 'summary.json'), JSON.stringify({pass: pass && sourceStable, sourceStable, sourceBefore, sourceAfter,
    sourceCommit, scriptSHA256: sourceBefore['tools/browser/grip_point_screen.mjs'], startedAt, finishedAt: new Date().toISOString(),
    argv: process.argv.slice(2), rows,
    scope: 'Compiled assets SHA/body bytes, portrait390 overflow, trusted Start, first2s no-input native angle/omega, trusted drag/extend/release and 80ms event-time tap contract, new Fighter restart and saved .7/normal. Default world/AI and paired GRIP; player-only URL mode or constructor default (entry field). Read-only return-preserving wrappers; camera presentation only. Large finite omega is recorded, not a failure threshold. Native injury can reject a consumed tap. These browser scenes are not matched AI/contact comparisons, candidate physics acceptance, anatomical/hand penetration acceptance, or human gameplay acceptance.'}, null, 2), {flag: 'wx'});
  assert.ok(sourceStable, 'Source files changed during probe');
}
