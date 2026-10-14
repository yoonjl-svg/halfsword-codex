// Actual Etna/Artoria browser: native movement, thermal injury, existing pain HUD,
// physical knee lowering, then delayed death. A fallback initial-position fixture
// is explicitly reported; it never changes health, pain, state or simulation time.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs';

const out = process.argv[2] || '/tmp/halfsword-etna-v2-20261014/burn-browser01';
assert(out.startsWith('/tmp/'));
await fs.mkdir(out, { recursive: true });
const base = 'http://127.0.0.1:4320';
const sourcePaths = ['src/main.js', 'src/fighter.js', 'src/gait.js', 'src/etna_ground.js', 'src/input.js', 'src/terrain_navigation.js', 'src/stage_etna.js'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashes = async () => Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, sha(await fs.readFile(path))])));
const report = { pass: false, startedUTC: new Date().toISOString(), sources: await hashes(), toolSha256: sha(await fs.readFile(new URL(import.meta.url))),
  errors: [], blockedRequests: [], attempts: [], servedSources: {}, limitations: [
    'Software Chromium rendering is not physical-phone performance or human play.',
    'The close knee photograph changes only the paused observation camera; the normal camera photograph is retained.',
    'The capture hides only the pause menu after recording the paused UI; the production pain vignette remains unchanged.',
  ] };
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-background-networking', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pending = new Set();
let page, context;
try {
  context = await browser.newContext({ viewport: { width: 1000, height: 720 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) { report.blockedRequests.push(url.href); return route.abort(); }
    if (url.pathname === '/@vite/client') return route.fulfill({ contentType: 'application/javascript', body: '// No HMR during evidence capture.' });
    return route.continue();
  });
  if (context.routeWebSocket) await context.routeWebSocket('**/*', socket => socket.close());
  await context.addInitScript(() => {
    localStorage.setItem('gladiator-settings', JSON.stringify({ pixel: false, sound: false, difficulty: 'normal', skill: '0.3', fpsCap: false, moveMode: 'stick', blood: true }));
    window.etnaBurnPointers = [];
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) document.addEventListener(type, event => {
      if (window.etnaBurnPointers.length < 1000) window.etnaBurnPointers.push({ type, trusted: event.isTrusted, pointerType: event.pointerType,
        target: event.target.closest?.('button')?.id || event.target.id });
    }, true);
  });
  page = await context.newPage();
  page.on('pageerror', error => report.errors.push({ type: 'pageerror', message: String(error) }));
  page.on('console', message => { if (message.type() === 'error') report.errors.push({ type: 'console', message: message.text() }); });
  page.on('response', response => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith('/src/')) return;
    const task = response.body().then(bytes => { report.servedSources[url.pathname + url.search] = { sha256: sha(bytes), bytes: bytes.length, status: response.status() }; });
    pending.add(task); task.finally(() => pending.delete(task)).catch(() => {});
  });
  const cdp = await context.newCDPSession(page);
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const read = () => page.evaluate(() => window.etnaBurnRead());
  let selected;
  for (const mode of ['trusted-joystick', 'initial-whole-body-position-fixture']) {
    const attempt = { mode, samples: [], reason: null };
    report.attempts.push(attempt);
    await page.goto(base + '/?weapon=longsword&foe=artoria&foeWeapon=excalibur&stage=etna', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.game?.player?.bodies?.pelvis);
    await page.evaluate(async () => {
      window.etnaBurnContract = (await import('/src/etna_ground.js')).LAVA_BURN;
      window.etnaBurnRead = () => {
        const f = game.player, p = f.bodies.pelvis.translation(), v = document.getElementById('vignette');
        const lost = Math.max(0, Math.min(1, (1 - f.blood) / .5));
        return { simTime: game.stats.simTime, fightTime: f.fightT, gameState: game.state, state: f.state, alive: f.alive,
          stage: game.stage.id, enemy: game.enemy.name, enemyWeapon: game.enemy.weapon.id,
          heading: f.heading, pelvis: { ...p }, relativeHeight: p.y - f.groundHeightAt(p.x, p.z),
          legs: { legF: f.limbs.legF, legB: f.limbs.legB }, kneel: f.kneelAmount, legHealth: f.legHealth,
          blood: f.blood, bleed: f.bleed, pain: f.pain, wounds: f.wounds.map(w => ({ type: w.type, part: w.part, bleed: w.bleed, severity: w.severity })),
          burn: f.lavaBurn ? { inLava: f.lavaBurn.inLava, exposure: f.lavaBurn.exposure, contactTime: f.lavaBurn.contactTime, legs: [...f.lavaBurn.legs] } : null,
          cause: f.causeOfDeath ?? null, vignette: { style: Number(v.style.opacity), computed: Number(getComputedStyle(v).opacity),
            expectedWithoutBleedPulse: Number(Math.min(1, lost * .85 + Math.min(1, f.pain) * .35).toFixed(3)),
            background: getComputedStyle(v).backgroundImage, displayed: getComputedStyle(v.parentElement).display !== 'none' },
          camera: game.camera.position.toArray(), frame: game.renderInfo().frame };
      };
      window.etnaBurnSamples = [];
      let last = -Infinity;
      const observe = () => {
        if (window.game?.player && game.stats.simTime - last >= .09) {
          window.etnaBurnSamples.push(window.etnaBurnRead()); last = game.stats.simTime;
        }
        requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
    });
    await page.locator('#btnStart').tap();
    await page.waitForFunction(() => game.state === 'fight', null, { timeout: 90000 });
    attempt.initial = await read();
    if (mode === 'initial-whole-body-position-fixture') {
      attempt.fixture = await page.evaluate(() => {
        const f = game.player, p = f.bodies.pelvis.translation(), target = { x: 0, z: 6 };
        const delta = { x: target.x - p.x, y: f.groundHeightAt(target.x, target.z) - f.groundHeightAt(p.x, p.z), z: target.z - p.z };
        const bodies = new Set([...f.meshes.map(entry => entry.rb), f.anchor, ...Object.values(f.bodies), f.sword].filter(Boolean));
        for (const body of bodies) { const p = body.translation(); body.setTranslation({ x: p.x + delta.x, y: p.y + delta.y, z: p.z + delta.z }, true); }
        return { target, delta, bodyCount: bodies.size, simTime: game.stats.simTime,
          scope: 'One initial rigid translation of every player body and anchor. No later physical or health intervention.' };
      });
    }
    let held = false, contact = null, preContact = attempt.initial, candidate = null;
    const box = await page.locator('#moveStick').boundingBox();
    assert(box, 'Movement stick is not visible');
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const wallDeadline = Date.now() + 150000;
    while (Date.now() < wallDeadline) {
      const sample = await read();
      if (sample.burn && contact === null) { contact = sample; attempt.contact = sample; attempt.preContact = preContact; }
      if (!sample.burn) preContact = sample;
      if (sample.blood !== 1 || sample.bleed !== 0 || sample.wounds.some(w => w.type !== 'burn')) { attempt.reason = 'Combat injury prevents a thermal-only HUD attribution.'; break; }
      if (!sample.alive || sample.gameState !== 'fight') { attempt.reason = 'Fighter or round ended before a living physical knee photograph.'; break; }
      if (contact && sample.simTime - contact.simTime >= 2 && sample.kneel > .9 && preContact.relativeHeight - sample.relativeHeight > .18 && sample.vignette.style >= .3) { candidate = sample; break; }
      if (contact && sample.burn.exposure > 4.5) { attempt.reason = 'No physical knee and pain-HUD candidate before fatal exposure.'; break; }
      if (!contact && sample.simTime - attempt.initial.simTime > 18) { attempt.reason = 'Downhill entry did not reach the lava within18simulation seconds.'; break; }
      if (mode === 'trusted-joystick' && !contact) {
        const direction = await page.evaluate(() => {
          const f = game.player, p = f.bodies.pelvis.translation(), c = Math.cos(f.heading), s = Math.sin(f.heading);
          const dx = Math.max(-.5, Math.min(.5, -p.x * .2)), dz = 1;
          let side = (dx * s + dz * c) / game.config.GAIT.sideFactor;
          let forward = dx * c - dz * s;
          if (forward < 0) forward /= game.config.GAIT.backFactor;
          const scale = 1 / Math.hypot(side, forward); return { side: side * scale, forward: forward * scale };
        });
        if (!held) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...center, id: 1 }] }); held = true; }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: center.x + direction.side * 40, y: center.y - direction.forward * 40, id: 1 }] });
      } else if (held) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); held = false; }
      await page.waitForTimeout(150);
    }
    if (held) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    if (candidate) {
      await page.locator('#btnPause').tap();
      await page.waitForFunction(() => game.state === 'paused');
      await page.waitForTimeout(250); await settle();
      attempt.paused = await read();
      attempt.samples = await page.evaluate(() => window.etnaBurnSamples);
      attempt.pointers = await page.evaluate(() => window.etnaBurnPointers);
      selected = attempt; break;
    }
    attempt.reason ??= 'Browser wall-time budget exceeded before physical knee evidence.';
    attempt.final = await read(); attempt.samples = await page.evaluate(() => window.etnaBurnSamples);
    attempt.pointers = await page.evaluate(() => window.etnaBurnPointers);
    await page.screenshot({ path: out + '/' + mode + '-unsuccessful.png' });
  }
  assert(selected, 'Neither native movement nor the initial-position fixture produced a thermal-only physical knee capture.');
  const at = selected.paused;
  assert.equal(at.stage, 'etna'); assert.equal(at.enemyWeapon, 'excalibur');
  assert.equal(at.gameState, 'paused'); assert(at.alive && at.kneel > .9);
  assert(selected.preContact.relativeHeight - at.relativeHeight > .18);
  assert.equal(at.blood, 1); assert.equal(at.bleed, 0);
  assert(at.wounds.length && at.wounds.every(w => w.type === 'burn' && w.bleed === 0));
  assert.equal(at.vignette.style, at.vignette.expectedWithoutBleedPulse);
  assert(Math.abs(at.vignette.computed - at.vignette.style) < .001 && at.vignette.style >= .3 && at.vignette.displayed);
  assert(at.burn.exposure < (await page.evaluate(() => etnaBurnContract.fatalExposureSeconds)));
  assert(selected.pointers.length && selected.pointers.every(pointer => pointer.trusted && pointer.pointerType === 'touch'));
  await page.screenshot({ path: out + '/paused-ui.png' });
  const hideMenu = await page.addStyleTag({ content: '#menu{visibility:hidden!important}' });
  await settle(); await page.screenshot({ path: out + '/normal-camera-pain.png' });
  selected.observationCamera = await page.evaluate(() => {
    const p = game.player.bodies.pelvis.translation(), ground = game.player.groundHeightAt(p.x, p.z);
    game.freeCam = true; game.camera.position.set(p.x - 3.2, ground + 1.8, p.z + 2.8); game.camera.lookAt(p.x, ground + .55, p.z);
    return { position: game.camera.position.toArray(), lookAt: [p.x, ground + .55, p.z], physicsStateUnchanged: true };
  });
  await settle(); await page.screenshot({ path: out + '/knees-pain.png' });
  selected.afterPhotographs = await read();
  assert.deepEqual(selected.afterPhotographs.pelvis, at.pelvis);
  assert.equal(selected.afterPhotographs.simTime, at.simTime);
  await hideMenu.evaluate(element => element.remove());
  await page.locator('#btnResume').tap();
  await page.waitForFunction(() => !game.player.alive || game.player.lavaBurn.exposure === 0, null, { timeout: 150000 });
  selected.final = await read(); selected.samples = await page.evaluate(() => window.etnaBurnSamples);
  assert.equal(selected.final.alive, false); assert.equal(selected.final.cause, '용암');
  assert(selected.final.burn.exposure >= (await page.evaluate(() => etnaBurnContract.fatalExposureSeconds)));
  report.selectedMode = selected.mode;
  report.contract = await page.evaluate(() => ({ degrees: game.terrain.degrees, burn: window.etnaBurnContract }));
  report.summary = { nativePointerEvents: selected.pointers.length, blood: at.blood, bleed: at.bleed, pain: at.pain,
    vignetteOpacity: at.vignette.style, expectedOpacity: at.vignette.expectedWithoutBleedPulse, kneeAmount: at.kneel,
    preContactHeight: selected.preContact.relativeHeight, pausedHeight: at.relativeHeight,
    physicalHeightDrop: selected.preContact.relativeHeight - at.relativeHeight, aliveExposureSeconds: at.burn.exposure,
    fatalExposureSeconds: selected.final.burn.exposure, cause: selected.final.cause };
  assert.deepEqual(await hashes(), report.sources, 'Production source changed during the browser probe.');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.blockedRequests, []);
  report.pass = true;
} catch (error) {
  report.failure = error.stack; process.exitCode = 1;
  if (page && !page.isClosed()) await page.screenshot({ path: out + '/failure.png' }).catch(() => {});
} finally {
  await Promise.allSettled([...pending]);
  await browser.close(); report.browserClosed = true; report.completedUTC = new Date().toISOString();
  await fs.writeFile(out + '/report.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ pass: report.pass, selectedMode: report.selectedMode, attempts: report.attempts.map(({ mode, reason }) => ({ mode, reason })), summary: report.summary,
    failure: report.failure, errors: report.errors, out, browserClosed: report.browserClosed }));
}
