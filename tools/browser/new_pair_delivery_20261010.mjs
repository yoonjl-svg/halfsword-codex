// Frozen-build mobile delivery for independent encounters and their introduction pages.
// --encounter=renji|eira|sherpa|silver_wanderer --base=http://127.0.0.1:PORT/ --build=/absolute/build --out=/tmp/halfsword-new-pair-20261010/local-renji
// Public runs also require --local-evidence=/absolute/passing-local/report.json.
// One real card/input/pause/resume/restart flow; no campaign or combat-balance fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WEAPONS } from '../../src/weapons.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { LOOKS } from '../../src/looks.js';

const own = fileURLToPath(import.meta.url), root = path.resolve(path.dirname(own), '../..'), args = {};
for (const arg of process.argv.slice(2)) {
  const match = /^--(base|build|out|local-evidence|encounter)=(.+)$/.exec(arg);
  assert(match && !Object.hasOwn(args, match[1]), 'Unknown or duplicate argument'); args[match[1]] = match[2];
}
const encounterId = args.encounter;
assert(['renji', 'eira', 'sherpa', 'silver_wanderer'].includes(encounterId), 'Specify --encounter=renji, eira, sherpa or silver_wanderer');
const encounters = encounterId === 'silver_wanderer' ? [
  { id: 'silver_wanderer', weapon: 'longsword', stage: 'crown_sanctum', image: 'silver-wanderer' },
] : encounterId === 'sherpa' ? [
  { id: 'sherpa', weapon: 'sabre', stage: 'qinglan', image: 'sherpa' },
] : [
  { id: 'renji', weapon: 'morgenstern', stage: 'qinglan', image: 'kim-straw' },
  { id: 'eira', weapon: 'rapier', stage: 'frozen_bay', image: 'eira' },
  { id: 'crown_boss', weapon: 'pistol', stage: 'crown_sanctum', image: 'samira-v8' },
];
for (const item of encounters) assert.equal(CHARACTERS_BY_ID[item.id]?.weapon, item.weapon, `Registered weapon: ${item.id}`);
const routeSpec = encounters.find(item => item.id === encounterId), encounter = CHARACTERS_BY_ID[encounterId];
assert(encounter.look?.stockEyes, 'New encounters must use stock eye dimensions');
const playerWeapon = 'sain', stageId = routeSpec.stage;
const queryFor = item => `?cards=sain,ice&foe=${item.id}&stage=${item.stage}`;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

// Derive expected native collider geometry and total mass from each registered weapon.
// These three weapons use unrotated box/ball parts; visual spikes are not collider length.
function registeredWeapon(id, look) {
  const spec = WEAPONS[id]; assert(spec);
  const parts = spec.buildParts(look).map(([shape, y, mass, _color, _blade, pose]) => {
    assert(['box', 'ball'].includes(shape[0]) && !pose?.rotZ, `Unsupported delivery measurement: ${id}`);
    const half = shape[0] === 'box' ? shape[2] : shape[1];
    return { kind: shape[0], position: [pose?.x ?? 0, y, 0],
      dimensions: shape.slice(1), range: [y - half, y + half], mass: mass[0] };
  });
  return { id, tier: spec.tier, fragility: spec.fragility, fragile: spec.fragile, parts,
    mass: parts.reduce((sum, part) => sum + part.mass, 0),
    length: Math.max(...parts.map(part => part.range[1])) - Math.min(...parts.map(part => part.range[0])) };
}
const registryContract = {
  landing: encounters.map(item => ({ ...item, name: CHARACTERS_BY_ID[item.id].name })),
  encounter: { id: encounterId, name: encounter.name, outfit: encounter.look.outfit,
    eyeColor: encounter.look.eyeColor ?? 0x1a1210, lookVersion: encounter.lookVersion ?? null },
  player: registeredWeapon(playerWeapon, LOOKS.player), enemy: registeredWeapon(encounter.weapon, encounter.look),
};
assert(args.build && path.isAbsolute(args.build) && args.out && path.isAbsolute(args.out));
const build = await fs.realpath(args.build), out = path.resolve(args.out);
assert(out.startsWith('/tmp/halfsword-new-pair-20261010/'));
const base = new URL(args.base || 'https://yoonjl-svg.github.io/halfsword-codex/');
const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
assert(local && base.protocol === 'http:' || base.href === 'https://yoonjl-svg.github.io/halfsword-codex/');
assert(!base.search && !base.hash && !base.username && !base.password && base.pathname.endsWith('/'));
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
assert(before['new-pair.html'], 'Frozen build must include new-pair.html');
if (!local) {
  assert(args['local-evidence'], 'Public run requires passing local evidence');
  const previous = JSON.parse(await fs.readFile(args['local-evidence'], 'utf8'));
  assert(previous.pass && previous.local); assert.equal(previous.encounterId, encounterId);
  assert.equal(previous.toolHash, toolHash); assert.deepEqual(previous.registryContract, registryContract);
  assert.deepEqual(previous.buildManifest, before, 'Local/public checks must use the same frozen build');
}
await fs.mkdir(path.dirname(out), { recursive: true });
assert.equal(await fs.realpath(path.dirname(out)), path.dirname(out)); await fs.mkdir(out);
const settings = { difficulty: 'normal', pixel: false, blood: true, sound: false, invertTilt: false,
  moveMode: 'stick', skill: '0.3', guardNames: true, trail: false, fpsCap: false };
const saved = JSON.stringify(settings), head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const start = performance.now(), startedUTC = new Date().toISOString(), requests = [], attempts = [], errors = [], native = [];
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
let browser, context, page, cdp, landing = null, proposal = null, fatal = null, pass = false, closing = false;
const flow = {}, deadline = setTimeout(() => {
  errors.push({ kind: 'budget', message: '600-second budget exceeded' }); browser?.close().catch(() => {});
}, 600000);
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
        assert.equal(route.request().method(), 'GET'); let response;
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
  await context.exposeBinding('__newPairPointer', (_source, event) => { if (native.length < 800) native.push(event); });
  await context.addInitScript(() => {
    for (const type of ['pointerdown', 'pointerup']) document.addEventListener(type, event => window.__newPairPointer({
      type, trusted: event.isTrusted, kind: event.pointerType, target: event.target.closest?.('button,a')?.id || event.target.id,
      card: event.target.closest?.('.wcard')?.dataset.i ?? null, href: event.target.closest?.('a')?.href || null }), true);
  });
  page = await context.newPage();
  page.on('pageerror', error => errors.push({ kind: 'pageerror', message: clean(error.message) }));
  page.on('console', message => { if (message.type() === 'error') errors.push({ kind: 'console', message: clean(message.text()) }); });
  page.on('requestfailed', request => errors.push({ kind: 'requestfailed', message: clean(request.failure()?.errorText), url: clean(request.url()) }));
  const wait = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 90000 });
  const read = () => page.evaluate(() => {
    const shown = object => { for (let n = object; n; n = n.parent) if (!n.visible) return false; return true; };
    const weapon = fighter => {
      const meshes = [], parts = fighter.swordColliders.map(collider => {
        const shape = collider.shape, p = collider.translationWrtParent(), half = shape.halfExtents?.y ?? shape.radius;
        return { kind: shape.halfExtents ? 'box' : 'ball', position: [p.x, p.y, p.z],
          dimensions: shape.halfExtents ? [shape.halfExtents.x, shape.halfExtents.y, shape.halfExtents.z] : [shape.radius],
          range: [p.y - half, p.y + half] };
      });
      fighter.swordGroup.traverse(object => { if (object.isMesh) meshes.push({ name: object.name, visible: shown(object),
        vertices: object.geometry.attributes.position?.count ?? 0 }); });
      return { id: fighter.weapon.id, uuid: fighter.swordGroup.uuid, mass: fighter.sword.mass(), parts, meshes,
        length: Math.max(...parts.map(part => part.range[1])) - Math.min(...parts.map(part => part.range[0])),
        tier: fighter.weapon.tier, fragility: fighter.weapon.fragility, fragile: fighter.weapon.fragile, broken: fighter.weaponBroken };
    };
    const p = game.player, e = game.enemy, outfit = [];
    for (const group of Object.values(e.groups)) group.traverse(object => {
      if (object.userData.outfit) outfit.push({ uuid: object.uuid, outfit: object.userData.outfit,
        part: object.userData.outfitPart, visible: shown(object) });
    });
    const eyes = e.groups.head.children.slice(1, 3).map(eye => ({ type: eye.geometry.type,
      dimensions: [eye.geometry.parameters.width, eye.geometry.parameters.height, eye.geometry.parameters.depth],
      scale: eye.scale.toArray(), visible: shown(eye), color: eye.material.color.getHex() }));
    const bodies = [p, e].flatMap(who => [...Object.values(who.bodies), who.sword])
      .flatMap(body => [body.translation(), body.rotation(), body.linvel(), body.angvel()].flatMap(value => Object.values(value)));
    return { state: game.state, steps: game.combat.stepNo, frame: game.renderInfo().frame, stage: game.stage.id,
      enemyName: e.name, player: weapon(p), enemy: weapon(e), outfit, eyes, bodies, finite: bodies.every(Number.isFinite),
      enemyWounds: e.wounds.map(w => ({ part: w.part, type: w.type, severity: w.severity })), enemyArmor: { ...e.plate },
      model: game.characterModel, gravity: { ...game.world.gravity }, saved: localStorage.getItem('gladiator-settings'),
      accepted: window.newPairAccepted || 0, active: game.input.activeTouch, swordRotation: { ...p.sword.rotation() },
      pelvis: { ...p.bodies.pelvis.translation() }, width: innerWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  const near = (actual, expected, label) => assert(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-5, `${label}: ${actual} vs ${expected}`);
  function weaponPolicy(actual, expected) {
    assert.equal(actual.id, expected.id); assert.equal(actual.parts.length, expected.parts.length);
    near(actual.mass, expected.mass, `${actual.id} collider mass`); near(actual.length, expected.length, `${actual.id} collider span`);
    actual.parts.forEach((part, i) => {
      const wanted = expected.parts[i]; assert.equal(part.kind, wanted.kind);
      for (const key of ['position', 'dimensions', 'range']) {
        assert.equal(part[key].length, wanted[key].length);
        part[key].forEach((value, j) => near(value, wanted[key][j], `${actual.id} part${i}/${key}${j}`));
      }
    });
    assert.equal(actual.tier, expected.tier); assert.equal(actual.fragility, expected.fragility);
    assert.equal(actual.fragile, expected.fragile); assert.equal(actual.broken, false);
    assert(actual.meshes.some(mesh => mesh.visible && mesh.vertices > 20));
  }
  function policy(value, selected = true) {
    assert.equal(value.stage, stageId); assert.equal(value.enemyName, encounter.name);
    assert(value.finite && value.scrollWidth <= value.width + 1); assert.equal(value.saved, saved);
    assert.equal(value.model.requested, false); assert.equal(value.model.loads, 0);
    assert(value.outfit.length >= 5 && value.outfit.every(item => item.outfit === encounter.look.outfit));
    for (const part of ['head', 'chest']) assert(value.outfit.some(item => item.part === part && item.visible));
    assert.equal(value.eyes.length, 2);
    for (const eye of value.eyes) {
      assert.equal(eye.type, 'BoxGeometry'); assert.deepEqual(eye.dimensions, [.012, .015, .02]);
      assert.deepEqual(eye.scale, [1, 1, 1]); assert(eye.visible); assert.equal(eye.color, registryContract.encounter.eyeColor);
    }
    weaponPolicy(value.enemy, registryContract.enemy);
    if (selected) weaponPolicy(value.player, registryContract.player);
  }
  const outfitIds = value => value.outfit.map(item => item.uuid);
  const outfitSignature = value => value.outfit.map(({ outfit, part }) => ({ outfit, part }));
  const landingURL = new URL(encounterId === 'silver_wanderer' ? 'silver-wanderer.html' : encounterId === 'sherpa' ? 'sherpa.html' : 'new-pair.html', base).href, destination = new URL(queryFor(routeSpec), base).href;
  await page.goto(landingURL, { waitUntil: 'load' });
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => { image.loading = 'eager'; return image.decode(); })));
  landing = await page.evaluate(() => ({ title: document.title, width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    headings: [...document.querySelectorAll('h1,h2,h3')].map(node => node.textContent.trim()),
    images: [...document.images].map(image => ({ path: new URL(image.src).pathname, width: image.naturalWidth, height: image.naturalHeight })),
    play: [...document.querySelectorAll('a.play')].map(link => ({ href: link.href, text: link.textContent.trim() })) }));
  assert(landing.title.trim() && landing.scrollWidth <= landing.width + 1);
  assert.deepEqual(landing.play.map(link => link.href), encounters.map(item => new URL(queryFor(item), base).href));
  const expectedNames = registryContract.landing.map(item => item.name);
  assert.deepEqual(landing.headings.map(text => expectedNames.find(name => text.includes(name))).filter(Boolean), expectedNames);
  const expectedImages = encounters.flatMap(item => (item.id === 'silver_wanderer' ? ['front', 'threeq', 'back', 'detail', 'fittings', 'before-threeq', 'before-detail'] : item.id === 'renji' ? ['front', 'threeq', 'back', 'feet'] : ['sherpa', 'silver_wanderer'].includes(item.id) ? ['front', 'threeq', 'back'] : ['front', 'threeq']).map(view => new URL(`encounters/${item.image}-${view}.webp`, base).pathname));
  assert.deepEqual(landing.images.map(image => image.path).sort(), expectedImages.sort());
  assert(landing.images.every(image => image.width > 0 && image.height > 0));
  await page.screenshot({ path: path.join(out, 'landing-portrait.png') });
  if (!['sherpa', 'silver_wanderer'].includes(encounterId)) {
    const proposalFile = encounterId === 'renji' ? 'kim-qinglan-proposal.html' : 'eira-frozen-bay.html';
    const backAnchor = encounterId === 'renji' ? 'renji' : 'eira';
    const proposalURL = new URL(proposalFile, base).href;
    await Promise.all([page.waitForURL(proposalURL), page.locator(`a[href="${proposalFile}"]`).tap()]);
    await page.setViewportSize({ width: 320, height: 740 });
    assert.equal(await page.locator('a.return').first().getAttribute('href'), `./${queryFor(routeSpec)}`);
    await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    assert(await page.locator('img').evaluateAll(images => images.length >= 2 && images.every(i => i.naturalWidth > 0)));
    await page.locator('details summary').first().tap();
    proposal = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      heading: document.querySelector('h1')?.textContent, text: document.body.innerText }));
    assert(proposal.scrollWidth <= proposal.width + 1, 'Proposal must fit a narrow phone');
    for (const word of (encounterId === 'renji' ? ['한낮의 청람잔도', '플레이', '맑고 화창한', '초여름', '구도 개념도'] : ['새벽의 얼음만', '플레이', '성 안뜰', '구도 개념도', '호수', '이졸데'])) assert(proposal.text.includes(word));
    await page.screenshot({ path: path.join(out, 'proposal-320.png'), fullPage: true });
    if (encounterId === 'renji') {
      await Promise.all([page.waitForURL(new URL('roster-gaps.html',base).href),page.locator('a[href="roster-gaps.html"]').tap()]);
      await page.locator('details').evaluateAll(nodes=>nodes.forEach(node=>node.open=true));
      const widths=[];
      for(const width of [320,390,844]){
        await page.setViewportSize({width,height:740});
        widths.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})));
      }
      assert(widths.every(v=>v.scrollWidth<=v.width+1),'Roster must fit phones');
      assert.equal(await page.locator('details').count(),12);
      proposal.roster={widths,people:12};
      await page.setViewportSize({width:320,height:740});
      await Promise.all([page.waitForURL(proposalURL),page.locator('a[href="./kim-qinglan-proposal.html"]').first().tap()]);
    }
    await Promise.all([page.waitForURL(new URL(`new-pair.html#${backAnchor}`, base).href), page.locator(`a[href="./new-pair.html#${backAnchor}"]`).first().tap()]);
  } else {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.locator('details summary').first().tap();
    const mobile = await page.evaluate(() => ({width: innerWidth, scrollWidth: document.documentElement.scrollWidth, text: document.body.innerText}));
    assert(mobile.scrollWidth <= mobile.width + 1);
    for (const term of (encounterId === 'silver_wanderer' ? ['은발의 검사', '시안', '롱소드'] : ['성별 불명', '조사', '세이버'])) assert(mobile.text.includes(term));
    await page.screenshot({path: path.join(out, `${encounterId}-320.png`), fullPage:true});
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await Promise.all([page.waitForURL(destination, { waitUntil: 'load' }), page.locator('a.play').nth(encounters.indexOf(routeSpec)).tap()]);
  await wait(() => window.game?.enemy && game.combat && game.characterModel);
  flow.entry = await read(); policy(flow.entry, false);
  await page.evaluate(() => { window.newPairAccepted = 0; const sample = () => {
    if (game.state === 'fight' && game.player.inputActive && game.player.handHeld) window.newPairAccepted++;
    requestAnimationFrame(sample);
  }; requestAnimationFrame(sample); });
  await page.setViewportSize({ width: 844, height: 390 }); cdp = await context.newCDPSession(page);
  async function startRound(label) {
    await page.locator('#btnStart').tap(); await wait(() => game.state === 'draw' && game.draw.stage === 'choose' && game.draw.t >= .45);
    const cards = await page.evaluate(() => [...game.draw.ids]); assert.deepEqual(cards, ['sain', 'ice', encounter.weapon]);
    const index = cards.indexOf(playerWeapon); assert.equal(index, 0);
    if (label === 'first') await page.screenshot({ path: path.join(out, 'cards.png') });
    await page.locator(`.wcard[data-i="${index}"]`).tap(); await wait(() => game.state === 'fight' && game.player.fightT > 2.05);
    const state = await read(); policy(state); flow[label] = { cards, selected: index, state };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 690, y: 270, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 635, y: 175, id: 1 }] });
    await wait(previous => window.newPairAccepted > previous, state.accepted);
    flow[label].stroke = await read(); assert.notEqual(flow[label].stroke.active, null);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 720, y: 295, id: 1 }] });
    await wait(step => game.combat.stepNo > step + 8, flow[label].stroke.steps);
    const swing = await read(); policy(swing); flow[label].swing = swing;
    assert.deepEqual(outfitIds(swing), outfitIds(state), 'Outfit objects persist during actual gameplay');
    const qa = Object.values(state.swordRotation), qb = Object.values(swing.swordRotation);
    flow[label].rotationRadians = 2 * Math.acos(Math.min(1, Math.abs(qa.reduce((sum, q, i) => sum + q * qb[i], 0))));
    assert(flow[label].rotationRadians > .005, 'Actual touch must move the physical weapon');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const box = await page.locator('#moveStick').boundingBox(); assert(box);
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 2 }, beforeMove = await read();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y + 32 }] });
    await wait(step => game.combat.stepNo > step + 8 && Math.abs(game.player.move.y) > .1, beforeMove.steps);
    const moved = await read(); policy(moved);
    flow[label].movementM = Math.hypot(moved.pelvis.x - beforeMove.pelvis.x, moved.pelvis.z - beforeMove.pelvis.z);
    assert(flow[label].movementM > .001); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  async function pause() {
    await page.locator('#btnPause').tap(); await wait(() => game.state === 'paused'); const value = await read(); policy(value); return value;
  }
  await startRound('first'); await page.screenshot({ path: path.join(out, 'gameplay-landscape.png') });
  flow.paused = await pause(); await wait(frame => game.renderInfo().frame > frame + 1, flow.paused.frame);
  const still = await read(); assert.deepEqual(still.bodies, flow.paused.bodies); assert.equal(still.steps, flow.paused.steps);
  await page.locator('#btnResume').tap(); await wait(step => game.state === 'fight' && game.combat.stepNo > step, still.steps);
  flow.resumed = await read(); policy(flow.resumed); assert.equal(flow.resumed.player.uuid, flow.first.state.player.uuid);
  assert.deepEqual(outfitIds(flow.resumed), outfitIds(flow.first.state)); await pause();
  await startRound('restart'); assert.notEqual(flow.restart.state.player.uuid, flow.first.state.player.uuid);
  assert.notEqual(flow.restart.state.enemy.uuid, flow.first.state.enemy.uuid);
  assert.deepEqual(flow.restart.state.player.meshes, flow.first.state.player.meshes);
  assert.deepEqual(flow.restart.state.enemy.meshes, flow.first.state.enemy.meshes);
  assert.deepEqual(flow.restart.state.gravity, flow.first.state.gravity);
  assert.deepEqual(outfitSignature(flow.restart.state), outfitSignature(flow.first.state));
  assert.notDeepEqual(outfitIds(flow.restart.state), outfitIds(flow.first.state), 'Restart constructs a fresh outfit');
  flow.final = await pause(); flow.native = native;
  assert(native.length && native.every(event => event.trusted && event.kind === 'touch'));
  assert(native.some(event => event.href === destination) && native.some(event => event.card === '0'));
  for (const id of ['btnStart', 'btnPause', 'btnResume']) assert(native.some(event => event.target === id));
  const observed = [flow.first.state, flow.first.stroke, flow.first.swing, flow.paused, flow.resumed,
    flow.restart.state, flow.restart.stroke, flow.restart.swing, flow.final];
  observed.forEach(value => policy(value));
  flow.injuryObservation = { woundObserved: observed.some(value => value.enemyWounds.length > 0),
    armorWearObserved: observed.some(value => Object.values(value.enemyArmor).some(wear => wear < 1)),
    outfitPersisted: observed.every(value => JSON.stringify(outfitSignature(value)) === JSON.stringify(outfitSignature(flow.first.state))) };
  assert(flow.injuryObservation.outfitPersisted);
  assert(requests.some(item => /^assets\/main-/.test(item.name))); assert(requests.every(item => item.match));
  assert.deepEqual(errors, []); pass = true;
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
    base: base.href, toolHash, buildStable, buildManifest: before, encounterId, registryContract, settings, proposal,
    landing, flows: [flow], requests, attempts, errors, fatal, tlsVerification: true, proxyRetained: !local,
    limits: ['Chromium touch/mobile emulation; no physical-phone performance or human appearance acceptance claim.',
      'One selected Sain card, real hand/stick input, pause/resume and restart. Both registered enemy weapons are checked in separate encounter runs.',
      'Measured native collider mass, shapes and axial span are compared with registry.buildParts; visual-only spike lengths are not collision dimensions.',
      'Only observed outfit/weapon/stock-eye persistence is checked. Unobserved injury behavior, all-animation clipping and combat balance are not established.',
      'No AI, damage, health, pose, physics clock or campaign progression state is overridden. These independent entries do not test main-journey order.',
      'Every fetched file is matched to the frozen build. Public verification requires matching passing local evidence; one logged GET 502/503 retry is allowed.'] };
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ pass, buildStable, encounterId, flows: 1, requests: requests.length, wallMs: report.wallMs, fatal, out }));
}
