// Frozen-build delivery: real card selection, mobile combat and restart for Ganjiang/Moye.
// --base=http://127.0.0.1:4198/ --build=/tmp/.../build --out=/tmp/halfsword-jian-20261010/local
// Public verification also requires --local-evidence=<passing local report.json>.
// --visual-only reuses the preserved public-v1 attack/movement evidence below.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WEAPONS } from '../../src/weapons.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const scenarios = [
  { id: 'ganjiang', mass: 0.95, length: 1.00, aura: 'white' },
  { id: 'moye', mass: 1.12, length: 0.96, aura: 'ink' },
];
assert(CHARACTERS_BY_ID.liao?.weapon === 'qinggang');
const query = '?cards=ganjiang,moye&foe=liao&stage=poseidon';

const own = fileURLToPath(import.meta.url), root = path.resolve(path.dirname(own), '../..'), args = {};
for (const arg of process.argv.slice(2)) {
  if (arg === '--visual-only') { assert(!args.visualOnly, 'Duplicate --visual-only'); args.visualOnly = true; continue; }
  const match = /^--(base|build|out|local-evidence)=(.+)$/.exec(arg);
  assert(match && !Object.hasOwn(args, match[1]), 'Unknown or duplicate argument'); args[match[1]] = match[2];
}
assert(args.build && path.isAbsolute(args.build) && args.out && path.isAbsolute(args.out));
const build = await fs.realpath(args.build), out = path.resolve(args.out);
assert(out.startsWith('/tmp/halfsword-jian-20261010/'));
await fs.mkdir(path.dirname(out), { recursive: true });
assert.equal(await fs.realpath(path.dirname(out)), path.dirname(out)); await fs.mkdir(out);
const base = new URL(args.base || 'https://yoonjl-svg.github.io/halfsword-codex/');
const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
assert(local && base.protocol === 'http:' || base.href === 'https://yoonjl-svg.github.io/halfsword-codex/');
assert(!base.search && !base.hash && !base.username && !base.password && base.pathname.endsWith('/'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const visualOnly = args.visualOnly === true;
let interactionEvidence = null;
if (visualOnly) {
  const evidencePath = '/tmp/halfsword-jian-20261010/mobile-public-v1/report.json';
  const body = await fs.readFile(evidencePath), evidence = JSON.parse(body);
  assert(evidence.pass && !evidence.local && evidence.buildStable && !evidence.visualOnly);
  assert.equal(evidence.base, 'https://yoonjl-svg.github.io/halfsword-codex/');
  assert.deepEqual(evidence.errors, []); assert.equal(evidence.fatal, null);
  assert.deepEqual(evidence.flows.map(flow => flow.id), scenarios.map(fixture => fixture.id));
  for (const flow of evidence.flows) {
    assert(flow.native.length && flow.native.every(event => event.trusted && event.kind === 'touch'));
    for (const phase of ['first', 'restart']) {
      assert(flow[phase].rotationRadians > .005 && flow[phase].movementM > .001);
      assert(flow[phase].state.finite && flow[phase].stroke.active !== null);
    }
  }
  interactionEvidence = { path: evidencePath, sha256: sha(body), head: evidence.head, toolHash: evidence.toolHash,
    reused: ['Trusted sword stroke and resulting physical rotation', 'Trusted movement input and actual translation'],
    scope: 'Prior public-v1 mechanics only; prior palette/aura appearance is superseded.' };
}
async function manifest(dir, prefix = '') {
  const result = {};
  for (const entry of (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    assert(!entry.isSymbolicLink(), 'Build contents must be ordinary files');
    const name = prefix + entry.name, full = path.join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(result, await manifest(full, name + '/'));
    else if (entry.isFile()) { const body = await fs.readFile(full); result[name] = { bytes: body.length, sha256: sha(body) }; }
  }
  return result;
}
const before = await manifest(build), toolHash = sha(await fs.readFile(own));
if (!local) {
  assert(args['local-evidence'], 'Public run requires passing local evidence');
  const previous = JSON.parse(await fs.readFile(args['local-evidence'], 'utf8'));
  assert(previous.pass && previous.local); assert.equal(previous.toolHash, toolHash);
  assert.equal(previous.visualOnly, visualOnly); assert.deepEqual(previous.interactionEvidence, interactionEvidence);
  assert.deepEqual(previous.buildManifest, before, 'Public and local checks must use the same build');
}
const settings = { difficulty: 'normal', pixel: false, blood: true, sound: false, invertTilt: false,
  moveMode: 'stick', skill: '0.3', guardNames: true, trail: false, fpsCap: false };
const saved = JSON.stringify(settings), head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const start = performance.now(), startedUTC = new Date().toISOString(), requests = [], attempts = [], errors = [], flows = [], native = [];
const secrets = [], pending = new Set(), launch = { executablePath: '/usr/bin/chromium', args: [
  '--no-sandbox', '--disable-background-networking', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
if (!local) {
  const raw = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  assert(raw, 'Configured public proxy is required'); const proxy = new URL(raw);
  launch.proxy = { server: proxy.protocol + '//' + proxy.host };
  if (proxy.username) launch.proxy.username = decodeURIComponent(proxy.username);
  if (proxy.password) launch.proxy.password = decodeURIComponent(proxy.password);
  secrets.push(raw, proxy.username, proxy.password, launch.proxy.username, launch.proxy.password);
}
const clean = value => {
  let text = String(value); for (const secret of secrets.filter(Boolean)) text = text.split(secret).join('[redacted]');
  return text.replace(/https?:\/\/[^\s/@:]+:[^\s/@]+@/gi, 'https://[redacted]@').slice(0, 3000);
};
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs');
let browser, context, page, cdp, landing = null, fatal = null, pass = false, closing = false;
const deadline = setTimeout(() => { errors.push({ kind: 'budget', message: '600-second budget exceeded' }); browser?.close().catch(() => {}); }, 600000);
deadline.unref();
try {
  browser = await chromium.launch(launch);
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', ignoreHTTPSErrors: false,
    storageState: { cookies: [], origins: [{ origin: base.origin, localStorage: [{ name: 'gladiator-settings', value: saved }] }] } });
  context.setDefaultTimeout(30000);
  await context.route('**/*', async route => {
    const task = (async () => {
      const url = new URL(route.request().url());
      try {
        assert(!closing && !url.username && !url.password && url.origin === base.origin && url.pathname.startsWith(base.pathname));
        const rel = decodeURIComponent(url.pathname.slice(base.pathname.length)) || 'index.html';
        assert(!rel.includes('\\') && !rel.split('/').some(part => part === '..' || part === '.'));
        assert.equal(route.request().method(), 'GET');
        let response;
        for (let attempt = 1; attempt <= 2; attempt++) {
          response = await route.fetch({ maxRedirects: 0, maxRetries: 0, timeout: 30000 });
          const retry = attempt === 1 && [502, 503].includes(response.status());
          attempts.push({ name: rel, status: response.status(), attempt, retry });
          if (!retry) break; await response.dispose();
        }
        assert.equal(response.status(), 200); const body = await response.body(), digest = sha(body);
        const match = before[rel]?.bytes === body.length && before[rel]?.sha256 === digest;
        requests.push({ name: rel, bytes: body.length, sha256: digest, match }); assert(match, `Served bytes differ: ${rel}`);
        await route.fulfill({ response, body });
      } catch (error) { errors.push({ kind: 'route', url: clean(url.href), message: clean(error.message) }); await route.abort('failed'); }
    })();
    pending.add(task); try { await task; } finally { pending.delete(task); }
  });
  if (context.routeWebSocket) await context.routeWebSocket('**/*', socket => { errors.push({ kind: 'websocket', url: clean(socket.url()) }); socket.close(); });
  await context.exposeBinding('__jianPointer', (_source, event) => { if (native.length < 800) native.push(event); });
  await context.addInitScript(() => {
    for (const type of ['pointerdown', 'pointerup']) document.addEventListener(type, event => window.__jianPointer({
      type, trusted: event.isTrusted, kind: event.pointerType, target: event.target.closest?.('button,a')?.id || event.target.id,
      card: event.target.closest?.('.wcard')?.dataset.i ?? null, href: event.target.closest?.('a')?.href || null }), true);
  });
  page = await context.newPage();
  page.on('pageerror', error => errors.push({ kind: 'pageerror', message: clean(error.message) }));
  page.on('console', message => { if (message.type() === 'error') errors.push({ kind: 'console', message: clean(message.text()) }); });
  page.on('requestfailed', request => errors.push({ kind: 'requestfailed', message: clean(request.failure()?.errorText), url: clean(request.url()) }));
  const wait = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 90000 });
  const read = () => page.evaluate(() => {
    const p = game.player, weaponMeshes = [], aura = [], auraMarkers = [], lights = [];
    const shown = object => { for (let node = object; node; node = node.parent) if (!node.visible) return false; return true; };
    p.swordGroup.traverse(object => {
      if (object.userData.legendaryAura) auraMarkers.push({ ...object.userData.legendaryAura });
      if (object.isPointLight) lights.push({ intensity: object.intensity, color: object.color.toArray() });
      if (object.isMesh) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        weaponMeshes.push({ uuid: object.uuid, name: object.name, visible: shown(object),
          vertices: object.geometry.attributes.position?.count ?? 0, color: materials[0].color?.getHex(),
          shader: materials[0].isShaderMaterial === true });
        for (const mat of materials) if (mat.isShaderMaterial) aura.push({ uuid: object.uuid, visible: shown(object),
          uniforms: Object.fromEntries(Object.entries(mat.uniforms).map(([key, uniform]) => [key,
            uniform.value?.isColor ? uniform.value.toArray() : typeof uniform.value === 'number' ? uniform.value : null])) });
      }
    });
    const ranges = p.swordColliders.map(collider => {
      const y = collider.translationWrtParent().y, shape = collider.shape;
      const half = shape.halfExtents?.y ?? shape.radius;
      return [y - half, y + half];
    });
    const bodies = [p, game.enemy].flatMap(who => [...Object.values(who.bodies), who.sword])
      .flatMap(body => [body.translation(), body.rotation(), body.linvel(), body.angvel()].flatMap(value => Object.values(value)));
    return { state: game.state, steps: game.combat.stepNo, frame: game.renderInfo().frame, stage: game.stage.id,
      enemyName: game.enemy.name, enemyWeapon: game.enemy.weapon.id, playerWeapon: p.weapon.id,
      mass: p.sword.mass(), length: Math.max(...ranges.map(range => range[1])) - Math.min(...ranges.map(range => range[0])),
      tier: p.weapon.tier, fragile: p.weapon.fragile, fragility: p.weapon.fragility, broken: p.weaponBroken,
      weaponId: p.swordGroup.uuid, weaponMeshes, aura, auraMarkers, lights, bodies, finite: bodies.every(Number.isFinite),
      model: game.characterModel, gravity: { ...game.world.gravity }, saved: localStorage.getItem('gladiator-settings'),
      accepted: window.jianAccepted || 0, active: game.input.activeTouch, swordRotation: { ...p.sword.rotation() },
      pelvis: { ...p.bodies.pelvis.translation() }, width: innerWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  function policy(value, fixture, selected = true) {
    assert.equal(value.stage, 'poseidon'); assert.equal(value.enemyName, CHARACTERS_BY_ID.liao.name); assert.equal(value.enemyWeapon, 'qinggang');
    assert(value.finite && value.scrollWidth <= value.width + 1); assert.equal(value.saved, saved);
    assert.equal(value.model.requested, false); assert.equal(value.model.loads, 0);
    if (!selected) return;
    assert.equal(value.playerWeapon, fixture.id); assert(Math.abs(value.mass - fixture.mass) < 1e-5);
    assert(Math.abs(value.length - fixture.length) < 1e-5); assert.equal(value.tier, 'legend');
    assert.equal(value.fragility, 0); assert.equal(value.fragile, false); assert.equal(value.broken, false);
    assert.deepEqual(value.auraMarkers, [{ weapon: fixture.id, tone: fixture.aura, strength: .5 }]);
    assert.equal(value.lights.length, fixture.aura === 'ink' ? 0 : 1);
    if (value.lights.length) assert(value.lights[0].intensity > 0);
    assert(value.weaponMeshes.some(mesh => mesh.visible && !mesh.shader && mesh.vertices > 20));
    assert(value.aura.length >= 2 && value.aura.every(item => item.visible), 'Live blade must carry visible aura planes');
    assert(value.aura.every(item => item.uniforms.uStrength > 0 && Number.isFinite(item.uniforms.uTime)));
    const color = value.aura[0].uniforms.uColor;
    assert(color && color.length === 3);
    assert(fixture.aura === 'ink' ? Math.max(...color) < 0.2 : Math.min(...color) > 0.6, 'Wrong black/white aura color');
  }
  const geometry = value => value.weaponMeshes.map(({ name, visible, vertices, color, shader }) => ({ name, visible, vertices, color, shader }));
  const landingURL = new URL('legendary-jian.html', base).href;
  const destination = new URL(query, base).href;
  await page.goto(landingURL, { waitUntil: 'load' });
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  landing = await page.evaluate(() => ({ title: document.title, width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    images: [...document.images].map(image => ({ path: new URL(image.src).pathname, width: image.naturalWidth, height: image.naturalHeight })),
    play: [...document.querySelectorAll('a.play')].map(link => ({ href: link.href, text: link.textContent.trim() })) }));
  assert(landing.scrollWidth <= landing.width + 1);
  assert.deepEqual(landing.images.map(image => image.path), scenarios.map(fixture => new URL(`ui/weapons/${fixture.id}.webp`, base).pathname));
  assert(landing.images.every(image => image.width > 0 && image.height > 0));
  assert.equal(landing.play.length, 1); assert.equal(landing.play[0].href, destination);
  await page.screenshot({ path: path.join(out, 'landing-portrait.png') });
  for (const fixture of scenarios) {
    const row = { ...fixture }, eventStart = native.length; flows.push(row);
    await page.setViewportSize({ width: 390, height: 844 });
    if (page.url() !== landingURL) await page.goto(landingURL, { waitUntil: 'load' });
    await Promise.all([page.waitForURL(destination, { waitUntil: 'load' }), page.locator('a.play').tap()]);
    await wait(() => window.game?.enemy && game.combat && game.characterModel);
    row.entry = await read(); policy(row.entry, fixture, false);
    await page.evaluate(() => { window.jianAccepted = 0; const sample = () => {
      if (game.state === 'fight' && game.player.inputActive && game.player.handHeld) window.jianAccepted++;
      requestAnimationFrame(sample);
    }; requestAnimationFrame(sample); });
    await page.setViewportSize({ width: 844, height: 390 }); cdp = await context.newCDPSession(page);
    async function startRound(label) {
      await page.locator('#btnStart').tap(); await wait(() => game.state === 'draw' && game.draw.stage === 'choose' && game.draw.t >= .45);
      const cards = await page.evaluate(() => [...game.draw.ids]);
      assert.deepEqual(cards, ['ganjiang', 'moye', 'qinggang']);
      const index = cards.indexOf(fixture.id); assert(index >= 0 && index < 2 && WEAPONS[fixture.id]);
      if (label === 'first') await page.screenshot({ path: path.join(out, `${fixture.id}-cards.png`) });
      await page.locator(`.wcard[data-i="${index}"]`).tap(); await wait(() => game.state === 'fight' && game.player.fightT > 2.05);
      const state = await read(); assert.equal(state.playerWeapon, cards[index]); policy(state, fixture); row[label] = { cards, selected: index, state };
      if (visualOnly) {
        await wait(step => game.state === 'fight' && game.combat.stepNo > step + 8, state.steps);
        row[label].animation = await read(); policy(row[label].animation, fixture);
        assert(row[label].animation.aura[0].uniforms.uTime > state.aura[0].uniforms.uTime, 'Aura must animate during actual gameplay');
        row[label].interactionEvidenceReused = true;
        return;
      }
      const count = state.accepted;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 690, y: 270, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 635, y: 175, id: 1 }] });
      await wait(previous => window.jianAccepted > previous, count);
      row[label].stroke = await read(); assert.notEqual(row[label].stroke.active, null);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 720, y: 295, id: 1 }] });
      await wait(step => game.combat.stepNo > step + 8, row[label].stroke.steps);
      row[label].swing = await read();
      assert(row[label].swing.aura[0].uniforms.uTime > state.aura[0].uniforms.uTime, 'Aura must animate during actual gameplay');
      const qa = Object.values(state.swordRotation), qb = Object.values(row[label].swing.swordRotation);
      row[label].rotationRadians = 2 * Math.acos(Math.min(1, Math.abs(qa.reduce((sum, q, i) => sum + q * qb[i], 0))));
      assert(row[label].rotationRadians > .005, 'Actual touch must move the physical sword');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const box = await page.locator('#moveStick').boundingBox(); assert(box);
      const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 2 }, beforeMove = await read();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y + 32 }] });
      await wait(step => game.combat.stepNo > step + 8 && Math.abs(game.player.move.y) > .1, beforeMove.steps);
      const moved = await read(); row[label].movementM = Math.hypot(moved.pelvis.x - beforeMove.pelvis.x, moved.pelvis.z - beforeMove.pelvis.z);
      assert(row[label].movementM > .001); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    async function pause() {
      await page.locator('#btnPause').tap(); await wait(() => game.state === 'paused'); const value = await read(); policy(value, fixture); return value;
    }
    await startRound('first'); await page.screenshot({ path: path.join(out, `${fixture.id}-gameplay-landscape.png`) });
    row.paused = await pause(); await wait(frame => game.renderInfo().frame > frame + 1, row.paused.frame);
    const still = await read(); assert.deepEqual(still.bodies, row.paused.bodies); assert.equal(still.steps, row.paused.steps);
    await page.locator('#btnResume').tap(); await wait(step => game.state === 'fight' && game.combat.stepNo > step, still.steps);
    row.resumed = await read(); assert.equal(row.resumed.weaponId, row.first.state.weaponId); await pause();
    await startRound('restart'); assert.notEqual(row.restart.state.weaponId, row.first.state.weaponId);
    assert.deepEqual(geometry(row.restart.state), geometry(row.first.state)); assert.deepEqual(row.restart.state.gravity, row.first.state.gravity);
    row.final = await pause(); row.native = native.slice(eventStart);
    assert(row.native.length && row.native.every(event => event.trusted && event.kind === 'touch'));
    assert(row.native.some(event => event.href === destination), 'Play link must be opened by actual touch');
    assert(row.native.some(event => event.card === String(scenarios.findIndex(item => item.id === fixture.id))));
    for (const id of ['btnStart', 'btnPause', 'btnResume']) assert(row.native.some(event => event.target === id));
    // Separate visual capture after the complete unmodified mobile flow. Only
    // the existing game camera is reframed; paused physics/body state is checked.
    await page.setViewportSize({ width: 1200, height: 800 });
    const frozen = await read();
    row.closeup = await page.evaluate(() => {
      const group = game.player.swordGroup, V = game.THREE.Vector3;
      group.updateWorldMatrix(true, true); game.freeCam = true;
      game.camera.position.copy(group.localToWorld(new V(.75, .55, 1.65)));
      game.camera.up.copy(new V(0, 1, 0).transformDirection(group.matrixWorld));
      game.camera.fov = 36; game.camera.updateProjectionMatrix();
      game.camera.lookAt(group.localToWorld(new V(0, .43, 0)));
      return { position: game.camera.position.toArray(), up: game.camera.up.toArray(), fov: game.camera.fov,
        weaponLocalEye: [.75, .55, 1.65], weaponLocalTarget: [0, .43, 0] };
    });
    await wait(frame => game.renderInfo().frame > frame + 1, frozen.frame);
    assert.deepEqual((await read()).bodies, frozen.bodies, 'Close-up camera must not change paused physics');
    await page.screenshot({ path: path.join(out, `${fixture.id}-closeup.png`) });
    await page.waitForLoadState('networkidle'); await cdp.detach(); cdp = null;
    console.log(JSON.stringify({ event: 'flow-complete', id: fixture.id, steps: row.final.steps }));
  }
  assert(requests.some(item => /^assets\/main-/.test(item.name))); assert(requests.every(item => item.match)); assert.deepEqual(errors, []); pass = true;
} catch (error) {
  fatal = { message: clean(error.message), stack: clean(error.stack) }; process.exitCode = 1;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
} finally {
  if (cdp) await cdp.detach().catch(() => {});
  try { if (page && !page.isClosed()) await page.waitForLoadState('networkidle', { timeout: 15000 });
    while (pending.size) await Promise.allSettled([...pending]); closing = true;
  } catch (error) { errors.push({ kind: 'drain', message: clean(error.message) }); }
  if (context) await context.close().catch(error => errors.push({ kind: 'context-close', message: clean(error.message) }));
  if (browser) await browser.close().catch(error => errors.push({ kind: 'browser-close', message: clean(error.message) }));
  clearTimeout(deadline); const buildStable = JSON.stringify(before) === JSON.stringify(await manifest(build));
  pass = pass && buildStable && errors.length === 0 && toolHash === sha(await fs.readFile(own)); if (!pass) process.exitCode = 1;
  const report = { pass, local, head, startedUTC, completedUTC: new Date().toISOString(), wallMs: performance.now() - start,
    base: base.href, toolHash, buildStable, buildManifest: before, visualOnly, interactionEvidence, scenarios, settings, landing, flows, requests, attempts, errors, fatal,
    tlsVerification: true, proxyRetained: !local,
    limits: ['Chromium touch/mobile emulation; physical-phone frame performance and human visual acceptance are not assessed.',
      visualOnly
        ? 'Visual-only revision check: trusted card selection, gameplay time and aura updates, pause/resume, restart and byte verification rerun. Sword stroke/movement mechanics reuse the preserved passing public-v1 report identified in interactionEvidence; no claim of newly repeated attack/movement testing.'
        : 'Read-only mobile scene observations with trusted card taps and touch strokes; no AI, damage or physics state is overridden.',
      'No AI, damage or physics state is overridden. Separate paused close-ups reframe only the existing game camera; pause-menu overlays can obscure those images.',
      'Ganjiang and Moye retain native geometry and black/white aura through actual card selection and restart. This bounded flow does not establish combat balance, naturally occurring injury or random draw rates.',
      'All served bytes match the frozen build, including the main bundle and requested weapon assets. One logged retry is allowed for GET 502/503.'] };
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ pass, buildStable, flows: flows.length, requests: requests.length, wallMs: report.wallMs, fatal, out }));
}
