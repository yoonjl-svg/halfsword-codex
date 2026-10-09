// Frozen-build delivery: comparison images + trusted mobile play/restart for three native encounters.
// --base=http://127.0.0.1:4180/ --build=/tmp/.../build --out=/tmp/halfsword-nature-polish-20261009/local
// Public verification also requires --local-evidence=<passing local report.json>.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WEAPONS } from '../../src/weapons.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const scenarios = [
  { id: 'yeongman-v2', foe: 'yeongman', stage: 'sacred_grove', weapon: 'monohoshizao', outfit: 'yeongman_grove', query: '?look=yeongman:v2&stage=sacred_grove' },
  { id: 'omari', foe: 'omari', stage: 'corsair', weapon: 'falchion', outfit: 'omari_seafarer', query: '?foe=omari&stage=corsair' },
  { id: 'isolde-default', foe: 'isolde', stage: 'cathedral', weapon: 'longsword', outfit: 'isolde_longhair', query: '?foe=isolde&stage=cathedral' },
];

const own = fileURLToPath(import.meta.url), root = path.resolve(path.dirname(own), '../..'), args = {};
for (const arg of process.argv.slice(2)) {
  const match = /^--(base|build|out|local-evidence)=(.+)$/.exec(arg);
  assert(match && !Object.hasOwn(args, match[1]), 'Unknown or duplicate argument'); args[match[1]] = match[2];
}
assert(args.build && path.isAbsolute(args.build) && args.out && path.isAbsolute(args.out));
const build = await fs.realpath(args.build), out = path.resolve(args.out);
assert(out.startsWith('/tmp/halfsword-nature-polish-20261009/'));
await fs.mkdir(path.dirname(out), { recursive: true });
assert.equal(await fs.realpath(path.dirname(out)), path.dirname(out)); await fs.mkdir(out);
const base = new URL(args.base || 'https://yoonjl-svg.github.io/halfsword-codex/');
const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
assert(local && base.protocol === 'http:' || base.href === 'https://yoonjl-svg.github.io/halfsword-codex/');
assert(!base.search && !base.hash && !base.username && !base.password && base.pathname.endsWith('/'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
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
let browser, context, page, cdp, fatal = null, pass = false, gallery, closing = false;
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
  await context.exposeBinding('__naturePointer', (_source, event) => { if (native.length < 800) native.push(event); });
  await context.addInitScript(() => {
    for (const type of ['pointerdown', 'pointerup']) document.addEventListener(type, event => window.__naturePointer({
      type, trusted: event.isTrusted, kind: event.pointerType, target: event.target.closest?.('button,a')?.id || event.target.id,
      card: event.target.closest?.('.wcard')?.dataset.i ?? null, href: event.target.closest?.('a')?.href || null }), true);
  });
  page = await context.newPage();
  page.on('pageerror', error => errors.push({ kind: 'pageerror', message: clean(error.message) }));
  page.on('console', message => { if (message.type() === 'error') errors.push({ kind: 'console', message: clean(message.text()) }); });
  page.on('requestfailed', request => errors.push({ kind: 'requestfailed', message: clean(request.failure()?.errorText), url: clean(request.url()) }));
  const wait = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 90000 });
  const read = () => page.evaluate(() => {
    const f = game.enemy, tags = [], signature = [];
    for (const [part, group] of Object.entries(f.groups)) group.traverse(object => {
      if (object.userData.outfit) tags.push({ part, outfit: object.userData.outfit, uuid: object.uuid });
      if (object.isMesh) signature.push({ part, vertices: object.geometry.attributes.position?.count ?? 0, color: object.material.color?.getHex() });
    });
    const bodies = [game.player, f].flatMap(who => [...Object.values(who.bodies), who.sword])
      .flatMap(body => [body.translation(), body.rotation(), body.linvel(), body.angvel()].flatMap(value => Object.values(value)));
    return { state: game.state, steps: game.combat.stepNo, frame: game.renderInfo().frame, stage: game.stage.id,
      name: f.name, weapon: f.weapon.id, playerWeapon: game.player.weapon.id, tags, signature, finite: bodies.every(Number.isFinite),
      partIds: Object.values(f.partMesh).map(mesh => mesh.uuid), bodies, model: game.characterModel, gravity: { ...game.world.gravity },
      saved: localStorage.getItem('gladiator-settings'), accepted: window.natureAccepted || 0, active: game.input.activeTouch,
      pelvis: { ...game.player.bodies.pelvis.translation() }, width: innerWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  function policy(value, fixture) {
    assert.equal(value.stage, fixture.stage); assert.equal(value.name, CHARACTERS_BY_ID[fixture.foe].name); assert.equal(value.weapon, fixture.weapon);
    assert(value.finite && value.tags.length > 0 && value.scrollWidth <= value.width + 1); assert.equal(value.saved, saved);
    assert(value.tags.every(tag => tag.outfit === fixture.outfit), `Wrong outfit: ${fixture.id}`);
    assert.equal(value.model.requested, false); assert.equal(value.model.loads, 0); assert.equal(value.model.model, 'procedural');
  }
  const galleryUrl = new URL('nature-detail.html', base).href;
  await page.goto(galleryUrl, { waitUntil: 'networkidle' });
  for (const disclosure of await page.locator('details').all()) await disclosure.locator('summary').tap();
  for (const image of await page.locator('img').all()) {
    await image.scrollIntoViewIfNeeded(); await image.evaluate(img => img.decode());
  }
  gallery = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    images: [...document.images].map(img => ({ src: img.src, loaded: img.complete && img.naturalWidth > 0, width: img.naturalWidth, height: img.naturalHeight })),
    links: [...document.querySelectorAll('a.play')].map(a => ({ id: a.id, href: a.href })) }));
  assert.equal(gallery.images.length, 12); assert(gallery.images.every(img => img.loaded)); assert(gallery.scrollWidth <= gallery.width + 1);
  await page.screenshot({ path: path.join(out, 'gallery-portrait.png'), fullPage: true });
  for (const fixture of scenarios) {
    const row = { ...fixture }, eventStart = native.length; flows.push(row);
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(galleryUrl, { waitUntil: 'load' });
    const destination = new URL(fixture.query, base).href;
    await Promise.all([page.waitForURL(destination, { waitUntil: 'load' }), page.locator(`#play-${fixture.id}`).tap()]);
    await wait(() => window.game?.enemy && game.combat && game.characterModel);
    row.entry = await read(); policy(row.entry, fixture);
    await page.evaluate(() => { window.natureAccepted = 0; const sample = () => {
      if (game.state === 'fight' && game.player.inputActive && game.player.handHeld) window.natureAccepted++;
      requestAnimationFrame(sample);
    }; requestAnimationFrame(sample); });
    await page.setViewportSize({ width: 844, height: 390 }); cdp = await context.newCDPSession(page);
    async function startRound(label) {
      await page.locator('#btnStart').tap(); await wait(() => game.state === 'draw' && game.draw.stage === 'choose' && game.draw.t >= .45);
      const cards = await page.evaluate(() => [...game.draw.ids]); assert.equal(cards[2], fixture.weapon);
      const index = cards.slice(0, 2).findIndex(id => WEAPONS[id] && !WEAPONS[id].gun); assert(index >= 0);
      await page.locator(`.wcard[data-i="${index}"]`).tap(); await wait(() => game.state === 'fight' && game.player.fightT > 2.05);
      const state = await read(); assert.equal(state.playerWeapon, cards[index]); policy(state, fixture); row[label] = { cards, selected: index, state };
      const count = state.accepted;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 690, y: 270, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 635, y: 175, id: 1 }] });
      await wait(previous => window.natureAccepted > previous, count);
      row[label].stroke = await read(); assert.notEqual(row[label].stroke.active, null);
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
    row.resumed = await read(); assert.deepEqual(row.resumed.partIds, row.first.state.partIds); await pause();
    await startRound('restart'); assert.notDeepEqual(row.restart.state.partIds, row.first.state.partIds);
    assert.deepEqual(row.restart.state.signature, row.first.state.signature); assert.deepEqual(row.restart.state.gravity, row.first.state.gravity);
    row.final = await pause(); row.native = native.slice(eventStart);
    assert(row.native.length && row.native.every(event => event.trusted && event.kind === 'touch'));
    assert(row.native.some(event => event.href === destination)); assert(row.native.some(event => event.card !== null));
    for (const id of ['btnStart', 'btnPause', 'btnResume']) assert(row.native.some(event => event.target === id));
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
    base: base.href, toolHash, buildStable, buildManifest: before, scenarios, settings, gallery, flows, requests, attempts, errors, fatal,
    tlsVerification: true, proxyRetained: !local,
    limits: ['Chromium touch/mobile emulation; physical-phone frame performance and human visual acceptance are not assessed.',
      'Read-only scene observations with trusted taps and touch strokes; no camera, AI, damage or physics state is overridden.',
      'Yeongman v2, unchanged Omari and default Isolde v2 retain their outfits through play/restart. This flow does not guarantee naturally occurring injury.',
      'All served bytes match the frozen build, including comparison images. One logged retry is allowed for GET 502/503.'] };
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ pass, buildStable, flows: flows.length, requests: requests.length, wallMs: report.wallMs, fatal, out }));
}
