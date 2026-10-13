// One frozen-build delivery flow for the sluice introduction and Ratna encounter.
// Derived from new_pair_delivery_20261010.mjs; no campaign, account or physics fixtures.
// --base=http://127.0.0.1:PORT/ --build=/absolute/build --out=/tmp/halfsword-sluice-20261013/local
// Public: same build, --out=/tmp/halfsword-sluice-20261013/public --local-evidence=/absolute/local/report.json
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const own = fileURLToPath(import.meta.url), root = path.resolve(path.dirname(own), '../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const photos = ['sluice-game', 'sluice-vista', 'ratna-front', 'ratna-back'].map(name => `encounters/${name}.webp`);
const query = '?cards=sain,ice&foe=ratna&stage=sluice';
async function manifest(dir, prefix = '') {
  const result = {};
  for (const entry of (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    assert(!entry.isSymbolicLink(), 'Frozen build must not contain symlinks');
    const name = prefix + entry.name, full = path.join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(result, await manifest(full, name + '/'));
    else if (entry.isFile()) { const body = await fs.readFile(full); result[name] = { bytes: body.length, sha256: sha(body) }; }
  }
  return result;
}

async function main() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const match = /^--(base|build|out|local-evidence)=(.+)$/.exec(arg);
    assert(match && !Object.hasOwn(args, match[1]), 'Unknown or duplicate argument'); args[match[1]] = match[2];
  }
  assert(args.build && path.isAbsolute(args.build) && args.out && path.isAbsolute(args.out), 'Absolute --build and --out required');
  const build = await fs.realpath(args.build), out = path.resolve(args.out);
  assert(out.startsWith('/tmp/halfsword-sluice-20261013/'), 'Output must be under /tmp/halfsword-sluice-20261013/');
  const base = new URL(args.base || 'https://yoonjl-svg.github.io/halfsword-codex/');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  assert((local && base.protocol === 'http:') || base.href === 'https://yoonjl-svg.github.io/halfsword-codex/');
  assert(!base.search && !base.hash && !base.username && !base.password && base.pathname.endsWith('/'));
  const character = CHARACTERS_BY_ID.ratna;
  assert(character, 'Ratna must be registered'); assert.equal(character.weapon, 'falchion'); assert.equal(character.voice, 'tome');
  const contract = { enemy: 'ratna', name: character.name, stage: 'sluice', weapon: 'falchion', voice: 'tome',
    outfit: character.look.outfit, lookVersion: character.lookVersion, wetlandImmunity: character.terrainTraits?.wetlandImmunity === true, colliderCount: 8, playerWeapon: 'sain', query, photos };
  const before = await manifest(build), toolHash = sha(await fs.readFile(own));
  for (const name of ['index.html', 'sluice.html', ...photos]) assert(before[name], `Missing frozen file: ${name}`);
  if (!local) {
    assert(args['local-evidence'], 'Public verification requires passing local evidence');
    const previous = JSON.parse(await fs.readFile(args['local-evidence'], 'utf8'));
    assert(previous.pass && previous.local); assert.equal(previous.toolHash, toolHash);
    assert.deepEqual(previous.contract, contract); assert.deepEqual(previous.buildManifest, before, 'Local/public frozen build differs');
  }
  await fs.mkdir(path.dirname(out), { recursive: true });
  assert.equal(await fs.realpath(path.dirname(out)), path.dirname(out)); await fs.mkdir(out);
  const settings = { difficulty: 'normal', pixel: false, blood: true, sound: true, invertTilt: false,
    moveMode: 'stick', skill: '0.3', guardNames: true, trail: false, fpsCap: false };
  const saved = JSON.stringify(settings), head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const startedUTC = new Date().toISOString(), started = performance.now();
  const requests = [], attempts = [], errors = [], pending = new Set(), secrets = [], flow = {};
  const native = { total: 0, allTrustedTouch: true, counts: {}, events: [] };
  const launch = { executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-background-networking',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
  if (!local) {
    const raw = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
    assert(raw, 'Public verification requires the inherited proxy'); const proxy = new URL(raw);
    launch.proxy = { server: proxy.protocol + '//' + proxy.host };
    if (proxy.username) launch.proxy.username = decodeURIComponent(proxy.username);
    if (proxy.password) launch.proxy.password = decodeURIComponent(proxy.password);
    secrets.push(raw, proxy.username, proxy.password, launch.proxy.username, launch.proxy.password);
  }
  const clean = value => {
    let text = String(value); for (const secret of secrets.filter(Boolean)) text = text.split(secret).join('[redacted]');
    return text.replace(/https?:\/\/[^\s/@:]+:[^\s/@]+@/gi, 'https://[redacted]@').slice(0, 2000);
  };
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs');
  let browser, context, page, cdp, landing, fatal = null, pass = false, closing = false;
  const deadline = setTimeout(() => {
    errors.push({ kind: 'budget', message: '600-second budget exceeded' }); browser?.close().catch(() => {});
  }, 600000); deadline.unref();
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
          assert(!closing && !url.username && !url.password && url.origin === base.origin && url.pathname.startsWith(base.pathname), 'Request outside selected own deployment');
          const rel = decodeURIComponent(url.pathname.slice(base.pathname.length)) || 'index.html';
          assert(!rel.includes('\\') && !rel.split('/').some(part => part === '..' || part === '.'));
          assert.equal(route.request().method(), 'GET'); let response;
          for (let attempt = 1; attempt <= 2; attempt++) {
            response = await route.fetch({ maxRedirects: 0, maxRetries: 0, timeout: 30000 });
            const retry = attempt === 1 && [502, 503].includes(response.status());
            attempts.push({ name: rel, status: response.status(), attempt, retry });
            if (!retry) break; await response.dispose();
          }
          assert.equal(response.status(), 200, `HTTP response: ${rel}`);
          const body = await response.body(), digest = sha(body);
          const match = before[rel]?.bytes === body.length && before[rel]?.sha256 === digest;
          requests.push({ name: rel, status: response.status(), bytes: body.length, sha256: digest, match });
          assert(match, `Served bytes differ: ${rel}`); await route.fulfill({ response, body });
        } catch (error) {
          errors.push({ kind: 'route', url: clean(url.href), message: clean(error.message) }); await route.abort('failed').catch(() => {});
        }
      })();
      pending.add(task); try { await task; } finally { pending.delete(task); }
    });
    if (context.routeWebSocket) await context.routeWebSocket('**/*', socket => {
      errors.push({ kind: 'websocket', url: clean(socket.url()) }); socket.close();
    });
    await context.exposeBinding('__sluicePointer', (_source, event) => {
      native.total++; native.allTrustedTouch &&= event.trusted && event.kind === 'touch';
      native.counts[event.type] = (native.counts[event.type] || 0) + 1;
      if (native.events.length < 160) native.events.push(event);
    });
    await context.addInitScript(() => {
      for (const type of ['pointerdown', 'pointermove', 'pointerup']) document.addEventListener(type, event => window.__sluicePointer({
        type, trusted: event.isTrusted, kind: event.pointerType,
        target: event.target.closest?.('button,a')?.id || event.target.id,
        card: event.target.closest?.('.wcard')?.dataset.i ?? null, href: event.target.closest?.('a')?.href || null }), true);
    });
    page = await context.newPage();
    page.on('pageerror', error => errors.push({ kind: 'pageerror', message: clean(error.message) }));
    page.on('console', message => { if (message.type() === 'error') errors.push({ kind: 'console', message: clean(message.text()) }); });
    page.on('requestfailed', request => errors.push({ kind: 'requestfailed', message: clean(request.failure()?.errorText), url: clean(request.url()) }));
    const wait = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 90000 });
    const read = () => page.evaluate(() => {
      const p = game.player, e = game.enemy, s = game.sound, detail = s._stageDetails;
      const shown = object => { for (let node = object; node; node = node.parent) if (!node.visible) return false; return true; };
      const outfit = []; for (const group of Object.values(e.groups)) group.traverse(object => {
        if (object.userData.outfit) outfit.push({ uuid: object.uuid, outfit: object.userData.outfit,
          part: object.userData.outfitPart, visible: shown(object) });
      });
      const bodies = [p, e].flatMap(f => [...Object.values(f.bodies), f.sword])
        .flatMap(body => [body.translation(), body.rotation(), body.linvel(), body.angvel()].flatMap(value => Object.values(value)));
      return { state: game.state, steps: game.combat.stepNo, frame: game.renderInfo().frame, stage: game.stage,
        terrain: [p,e].map(f=>({model:f.movementSurface,scale:f.surfaceSpeedScale,immune:f.terrainTraits?.wetlandImmunity===true})), mudLabelHidden:document.getElementById('wetlandFooting').hidden,
        companionVisible: !!e.groups.chest.getObjectByName('ratna-monkey') && shown(e.groups.chest.getObjectByName('ratna-monkey')),
        arenaObstacle: game.arenaObstacle, enemyName: e.name, enemyWeapon: e.weapon.id, playerWeapon: p.weapon.id,
        playerUUID: p.swordGroup.uuid, enemyUUID: e.swordGroup.uuid, outfit,
        finite: bodies.every(Number.isFinite), bodies, pelvis: { ...p.bodies.pelvis.translation() }, swordRotation: { ...p.sword.rotation() },
        active: game.input.activeTouch, accepted: window.sluiceAccepted || 0,
        sound: { mudSteps: s.samples.stepMud?.length ?? 0, on: s.on, context: s.ctx?.state ?? null, stage: s.stage, primed: s.primed ?? false,
          voiceSamples: Object.fromEntries(Object.entries(s.samples).filter(([key]) => key.startsWith('voice:')).map(([key, values]) => [key, values.length])),
          events: s.stats.events, detail: detail ? { stage: detail.stage, paused: detail.paused,
            ambientNodes: detail.ambient?.nodes.length ?? 0, activeVoices: detail.voices.size, ...detail.stats } : null },
        saved: localStorage.getItem('gladiator-settings'), width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        model: game.characterModel, gravity: { ...game.world.gravity } };
    });
    const outfitIds = value => value.outfit.map(item => item.uuid);
    const outfitSignature = value => value.outfit.map(({ outfit, part }) => ({ outfit, part }));
    function policy(value, selected = true, audible = true) {
      assert(value.terrain.every(f=>f.model==='wetland' && f.scale>=0.4 && f.scale<=1));
      assert.equal(value.terrain[1].immune, true); assert.equal(value.terrain[1].scale, 1);
      assert.equal(value.arenaObstacle?.colliderCount, contract.colliderCount);
      assert.equal(value.stage.id, contract.stage); assert.equal(value.stage.pinned, contract.stage);
      assert.equal(value.enemyName, contract.name); assert.equal(value.enemyWeapon, contract.weapon);
      if (selected) assert.equal(value.playerWeapon, contract.playerWeapon);
      assert(value.finite && value.scrollWidth <= value.width + 1); assert.equal(value.saved, saved);
      assert.equal(value.model.requested, false); assert.equal(value.model.loads, 0);
      assert(value.outfit.length && value.outfit.every(item => item.outfit === contract.outfit));
      assert(value.outfit.some(item => item.visible), 'Ratna outfit must be visible');
      assert(value.companionVisible, 'Shoulder monkey must be present');
      assert.equal(value.sound.on, true); assert.equal(value.sound.stage, contract.stage);
      if (audible) {
        assert.equal(value.sound.mudSteps, 8); assert.equal(value.sound.context, 'running'); assert(value.sound.primed);
        for (const kind of ['hurt', 'ko', 'bleed']) assert.equal(value.sound.voiceSamples[`voice:tome:${kind}`], 2);
        assert(Object.keys(value.sound.voiceSamples).every(key => /^voice:(tome|player):/.test(key)));
        assert.equal(value.sound.detail?.stage, contract.stage); assert(value.sound.detail.ambientNodes > 0);
      }
    }
    const destination = new URL(query, base).href;
    await page.goto(new URL('sluice.html', base).href, { waitUntil: 'load' });
    await page.locator('img').evaluateAll(images => Promise.all(images.map(image => { image.loading = 'eager'; return image.decode(); })));
    landing = await page.evaluate(() => ({ title: document.title,
      links: [...document.querySelectorAll('a[href]')].map(a => ({ href: a.href, text: a.textContent.trim() })),
      images: [...document.images].map(img => ({ path: new URL(img.src).pathname, width: img.naturalWidth, height: img.naturalHeight })) }));
    assert.equal(landing.title, '잠든 습지 · 라트나 — 적막'); assert(landing.links.some(link => link.href === destination));
    assert.deepEqual(landing.images.map(img => img.path).sort(), photos.map(name => new URL(name, base).pathname).sort());
    assert(landing.images.every(img => img.width > 0 && img.height > 0));
    for (const link of landing.links) {
      const url = new URL(link.href); assert(url.origin === base.origin && url.pathname.startsWith(base.pathname), 'Landing links must remain on own deployment');
    }
    landing.linkStatus = await page.evaluate(async links => Promise.all([...new Set(links.map(link => link.href))].map(async href => ({
      href, status: (await fetch(href)).status,
    }))), landing.links);
    assert(landing.linkStatus.every(link => link.status === 200));
    landing.widths = [];
    for (const width of [320, 390, 844]) {
      await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
      const size = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      assert(size.scrollWidth <= size.width + 1, `Landing overflow at ${width}px`); landing.widths.push(size);
      await page.screenshot({ path: path.join(out, `landing-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const playIndex = await page.locator('a[href]').evaluateAll((links, href) => links.findIndex(link => link.href === href), destination);
    assert(playIndex >= 0);
    await Promise.all([page.waitForURL(destination, { waitUntil: 'load' }), page.locator('a[href]').nth(playIndex).tap()]);
    await wait(() => window.game?.enemy && game.combat && game.characterModel);
    flow.entry = await read(); policy(flow.entry, false, false); assert.equal(flow.entry.sound.context, null, 'Audio must wait for Start gesture');
    await page.evaluate(() => { window.sluiceAccepted = 0; const observe = () => {
      if (game.state === 'fight' && game.player.inputActive && game.player.handHeld) window.sluiceAccepted++;
      requestAnimationFrame(observe);
    }; requestAnimationFrame(observe); });
    await page.setViewportSize({ width: 844, height: 390 }); cdp = await context.newCDPSession(page);
    async function startRound(label) {
      await page.locator('#btnStart').tap(); await wait(() => game.state === 'draw' && game.draw.stage === 'choose' && game.draw.t >= .45);
      const cards = await page.evaluate(() => [...game.draw.ids]); assert.deepEqual(cards, ['sain', 'ice', 'falchion']);
      await wait(() => game.sound.ctx?.state === 'running' && ['hurt', 'ko', 'bleed'].every(kind => game.sound.samples[`voice:tome:${kind}`]?.length === 2));
      if (label === 'first') {
        await wait(() => game.sound._stageDetails?.stats.accepted > 0);
        await page.screenshot({ path: path.join(out, 'cards.png') });
      }
      await page.locator('.wcard[data-i="0"]').tap(); await wait(() => game.state === 'fight' && game.player.fightT > 2.05);
      const state = await read(); policy(state); flow[label] = { cards, selected: 0, state };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 690, y: 270, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 635, y: 175, id: 1 }] });
      await wait(previous => window.sluiceAccepted > previous, state.accepted);
      flow[label].stroke = await read(); assert.notEqual(flow[label].stroke.active, null);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 720, y: 295, id: 1 }] });
      await wait(step => game.combat.stepNo > step + 8, flow[label].stroke.steps);
      const swing = await read(); policy(swing); flow[label].swing = swing;
      assert.deepEqual(outfitIds(swing), outfitIds(state));
      const qa = Object.values(state.swordRotation), qb = Object.values(swing.swordRotation);
      flow[label].rotationRadians = 2 * Math.acos(Math.min(1, Math.abs(qa.reduce((sum, q, i) => sum + q * qb[i], 0))));
      assert(flow[label].rotationRadians > .005, 'Trusted touch must move the physical weapon');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const box = await page.locator('#moveStick').boundingBox(); assert(box);
      const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 2 }, beforeMove = await read();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y + 32 }] });
      await wait(step => game.combat.stepNo > step + 8 && Math.abs(game.player.move.y) > .1, beforeMove.steps);
      const moved = await read(); policy(moved);
      flow[label].movementM = Math.hypot(moved.pelvis.x - beforeMove.pelvis.x, moved.pelvis.z - beforeMove.pelvis.z);
      assert(flow[label].movementM > .001, 'Stick touch must move the player');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      if (label === 'first') {
        // Enter the nearby rear-right puddle using the actual on-screen stick.
        const origin = await read();
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, x: point.x + 32, y: point.y + 12 }] });
        await wait(step => game.player.surfaceSpeedScale < .95 || game.combat.stepNo > step + 720 || game.state !== 'fight', origin.steps);
        flow[label].puddle = await read();
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        policy(flow[label].puddle);
        assert(flow[label].puddle.terrain[0].scale < .95, 'Actual stick movement must enter a visible puddle');
        assert.equal(flow[label].puddle.mudLabelHidden, false, 'Puddle entry must show the slow-ground cue');
        await page.screenshot({ path: path.join(out, 'puddle-entry.png') });
      }
    }
    async function pause() {
      await page.locator('#btnPause').tap(); await wait(() => game.state === 'paused' && game.sound._stageDetails?.paused);
      const value = await read(); policy(value); return value;
    }
    await startRound('first'); await page.screenshot({ path: path.join(out, 'gameplay-landscape.png') });
    flow.paused = await pause(); await wait(frame => game.renderInfo().frame > frame + 2, flow.paused.frame);
    const still = await read(); assert.deepEqual(still.bodies, flow.paused.bodies); assert.equal(still.steps, flow.paused.steps);
    assert.equal(still.sound.detail.accepted, flow.paused.sound.detail.accepted); assert.equal(still.sound.detail.activeVoices, 0);
    await page.locator('#btnResume').tap(); await wait(step => game.state === 'fight' && game.combat.stepNo > step && !game.sound._stageDetails?.paused, still.steps);
    flow.resumed = await read(); policy(flow.resumed); assert.equal(flow.resumed.playerUUID, flow.first.state.playerUUID);
    assert.deepEqual(outfitIds(flow.resumed), outfitIds(flow.first.state)); await pause();
    await startRound('restart');
    assert.notEqual(flow.restart.state.playerUUID, flow.first.state.playerUUID); assert.notEqual(flow.restart.state.enemyUUID, flow.first.state.enemyUUID);
    assert.deepEqual(outfitSignature(flow.restart.state), outfitSignature(flow.first.state));
    assert.notDeepEqual(outfitIds(flow.restart.state), outfitIds(flow.first.state));
    assert.deepEqual(flow.restart.state.gravity, flow.first.state.gravity);
    flow.final = await pause();
    assert(flow.final.sound.detail.accepted > 0);
    assert(['sluiceDrip', 'jungleRustle', 'jungleBird'].includes(flow.final.sound.detail.last?.kind));
    assert(native.total && native.allTrustedTouch && native.counts.pointermove > 0);
    assert(native.events.some(event => event.href === destination) && native.events.some(event => event.card === '0'));
    for (const id of ['btnStart', 'btnPause', 'btnResume']) assert(native.events.some(event => event.target === id));
    for (const name of ['sluice.html', ...photos]) assert(requests.some(item => item.name === name && item.match));
    assert(requests.filter(item => /^sfx\/step\/mud[1-8]\.mp3$/.test(item.name) && item.match).length >= 8, 'Wetland mud footsteps must be delivered');
    assert(requests.some(item => /^assets\/main-/.test(item.name)));  assert(requests.every(item => item.match));
    assert.deepEqual(errors, []); pass = true;
  } catch (error) {
    fatal = { message: clean(error.message), stack: clean(error.stack) }; process.exitCode = 1;
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  } finally {
    if (cdp) await cdp.detach().catch(() => {});
    try {
      if (page && !page.isClosed()) await page.waitForLoadState('networkidle', { timeout: 15000 });
      while (pending.size) await Promise.allSettled([...pending]); closing = true;
    } catch (error) { errors.push({ kind: 'drain', message: clean(error.message) }); }
    if (context) await context.close().catch(error => errors.push({ kind: 'context-close', message: clean(error.message) }));
    if (browser) await browser.close().catch(error => errors.push({ kind: 'browser-close', message: clean(error.message) }));
    clearTimeout(deadline);
    const buildStable = JSON.stringify(before) === JSON.stringify(await manifest(build));
    pass = pass && buildStable && !errors.length && toolHash === sha(await fs.readFile(own)); if (!pass) process.exitCode = 1;
    const report = { pass, local, head, startedUTC, completedUTC: new Date().toISOString(), wallMs: performance.now() - started,
      base: base.href, toolHash, buildStable, buildManifest: before, contract, settings, landing, flow, native, requests, attempts, errors, fatal,
      tlsVerification: true, proxyRetained: !local,
      limits: ['Chromium mobile/touch emulation; physical-phone performance and human appearance/sound acceptance are not established.',
        'One Sain card flow with trusted touch attack/movement, pause/resume and fresh restart; no account or campaign tests.',
        'Sound context, Tome sample decoding and naturally accepted sluice details are observed; no injury or sound event is injected.',
        'No AI, damage, health, pose, physics clock or progression state is overridden. This is delivery validation, not physics equivalence or combat balance.',
        'Every fetched own file must match the frozen build. Public run requires the same passing local tool/build contract; one logged GET 502/503 retry is allowed.'] };
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ pass, buildStable, requests: requests.length, errors: errors.length, wallMs: report.wallMs, failure: fatal?.message ?? null, out }));
  }
}
main().catch(error => { console.error(JSON.stringify({ pass: false, phase: 'preflight', error: String(error.message).slice(0, 1000) })); process.exitCode = 1; });
