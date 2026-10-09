// Three native encounters: real selector taps, mobile combat, pause/resume/restart.
// Read-only observations; natural wounds are reported only when actually observed.
// Run after source/dist freeze. Every served byte must match that frozen build.
// --out=/workspace/halfsword-handoff/content-expansion-20261009/mobile/<fresh-name>
// (or /tmp/halfsword-content-mobile-<fresh-name>) [--base=http://127.0.0.1:4173/]
// Public runs require --local-evidence=<passing-local-report.json> from this exact tool/build.
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
  { id: 'loggia-tome', foe: 'tome', weapon: 'rapier', stage: 'loggia', outfit: 'tome_rapier' },
  { id: 'corsair-omari', foe: 'omari', weapon: 'falchion', stage: 'corsair', outfit: 'omari_seafarer' },
  { id: 'sacred-grove-yeongman', foe: 'yeongman', weapon: 'monohoshizao', stage: 'sacred_grove', outfit: 'yeongman_shrine' },
];
const { CHARACTERS_BY_ID } = await import('../../src/characters.js');
const { WEAPONS } = await import('../../src/weapons.js');
for (const row of scenario) {
  const character = CHARACTERS_BY_ID[row.foe];
  assert(character && character.weapon === row.weapon && character.look.outfit === row.outfit,
    `Missing native content contract: ${row.foe}`);
  row.name = character.name;
}
const artifactRoot = '/workspace/halfsword-handoff/content-expansion-20261009/mobile';
const allowedOut = p => path.dirname(p) === artifactRoot || /^\/tmp\/halfsword-content-mobile-[^/]+$/.test(p);
assert(args.out && path.isAbsolute(args.out));
const out = path.resolve(args.out); assert(allowedOut(out));
await fs.mkdir(path.dirname(out), { recursive: true });
assert.equal(await fs.realpath(path.dirname(out)), path.dirname(out));
await fs.mkdir(out); // Preserve earlier evidence; never overwrite a run.
const base = new URL(args.base || 'https://yoonjl-svg.github.io/halfsword-codex/');
const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
assert(local && base.protocol === 'http:' || base.href === 'https://yoonjl-svg.github.io/halfsword-codex/');
assert(!base.search && !base.hash && !base.username && !base.password && base.pathname.endsWith('/'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function scan(dir) {
  const found = [];
  for (const entry of await fs.readdir(path.join(root, dir), { withFileTypes: true })) {
    assert(!entry.isSymbolicLink()); const name = dir + '/' + entry.name;
    if (entry.isDirectory()) found.push(...await scan(name));
    else if (entry.isFile()) found.push(name);
  }
  return found.sort();
}
async function manifest() {
  const files = ['tools/browser/content_expansion_delivery_20261009.mjs', 'index.html', 'package.json',
    'package-lock.json', ...await scan('public'),
    ...await scan('src'), ...await scan('dist')];
  return Object.fromEntries(await Promise.all(files.map(async name => {
    const bytes = await fs.readFile(path.join(root, name));
    return [name, { bytes: bytes.length, sha256: sha(bytes) }];
  })));
}
const before = await manifest();
if (!local) {
  assert(args['local-evidence'], 'Public verification requires passing same-build local evidence');
  const evidence = path.resolve(args['local-evidence']); assert(allowedOut(path.dirname(evidence)));
  assert.equal(await fs.realpath(path.dirname(evidence)), path.dirname(evidence));
  const previous = JSON.parse(await fs.readFile(evidence, 'utf8'));
  assert(previous.pass && previous.local); assert.deepEqual(previous.scenario, scenario);
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
const nativeEvents = [];
let closingRequests = false;
const teardown = { networkIdle: false, routesBeforeClose: null, lateRequests: 0, contextClosed: false };
const launch = { executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-background-networking', '--use-gl=angle', '--use-angle=swiftshader'] };
if (!local) {
  const raw = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  assert(raw); const proxy = new URL(raw);
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
let browser, context, page, cdp, fatal = null, failureSnapshot = null, pass = false;
// Software-rendered CI frames can run well below real time; this wall budget is
// a bounded correctness check, not evidence of physical-phone frame performance.
const budgetMs = 420000;
const deadline = setTimeout(() => {
  errors.push({ kind: 'budget', message: `Delivery exceeded ${budgetMs / 1000} seconds` });
  browser?.close().catch(() => {});
}, budgetMs); deadline.unref();
try {
  browser = await chromium.launch(launch);
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    ignoreHTTPSErrors: false, serviceWorkers: 'block',
    storageState: { cookies: [], origins: [{ origin: base.origin, localStorage: [{ name: 'gladiator-settings', value: saved }] }] } });
  context.setDefaultTimeout(20000);
  await context.route('**/*', async route => {
    const task = (async () => {
      const url = route.request().url();
      if (closingRequests) {
        teardown.lateRequests++; errors.push({ kind: 'late-request', url: clean(url) });
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
        assert.equal(response.status(), 200, 'Artifact must return 200 without redirect');
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
    try { await task; } catch (error) { errors.push({ kind: 'route-completion', message: clean(error.message) }); }
    finally { inFlightRoutes.delete(task); }
  });
  if (context.routeWebSocket) await context.routeWebSocket('**/*', socket => {
    errors.push({ kind: 'websocket', url: clean(socket.url()) }); socket.close();
  });
  await context.exposeBinding('__recordDeliveryPointer', (_source, event) => {
    if (nativeEvents.length < 1200) nativeEvents.push(event);
  });
  await context.addInitScript(() => {
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture'])
      document.addEventListener(type, event => window.__recordDeliveryPointer({ type, trusted: event.isTrusted,
        kind: event.pointerType, target: event.target.closest?.('button, a')?.id || event.target.id,
        cardIndex: event.target.closest?.('.wcard')?.dataset.i ?? null,
        href: event.target.closest?.('a')?.href || null, url: location.href }), true);
  });
  page = await context.newPage();
  page.on('pageerror', error => errors.push({ kind: 'pageerror', message: clean(error.message) }));
  page.on('console', message => { if (message.type() === 'error') errors.push({ kind: 'console', message: clean(message.text()) }); });
  page.on('requestfailed', request => errors.push({ kind: 'requestfailed', url: clean(request.url()), message: clean(request.failure()?.errorText) }));
  const wait = (predicate, arg, timeout = 60000) => page.waitForFunction(predicate, arg,
    { timeout: Math.max(100, Math.min(timeout, budgetMs - (performance.now() - start))) });
  async function observe() {
    await wait(() => window.game?.player && game.combat && game.characterModel);
    await page.evaluate(() => {
      const p = window.encounterProbe = { accepted: [], acceptedTotal: 0, wounds: [], ids: new WeakMap(), next: 1,
        baselines: new Map(), injured: new Set() };
      const id = object => { if (!p.ids.has(object)) p.ids.set(object, p.next++); return p.ids.get(object); };
      const visible = mesh => {
        if (!mesh.layers.test(game.camera.layers)) return false;
        for (let object = mesh; object; object = object.parent) if (!object.visible) return false;
        return true;
      };
      p.bodies = () => [game.player, game.enemy].flatMap(f => [...Object.values(f.bodies), f.sword])
        .flatMap(body => [body.translation(), body.rotation(), body.linvel(), body.angvel()].flatMap(v => Object.values(v)));
      p.appearance = fighter => {
        const parts = Object.entries(fighter.partMesh).map(([part, mesh]) => ({ part, uuid: mesh.uuid,
          visible: visible(mesh), geometry: mesh.geometry.uuid, color: mesh.material.color?.getHex() }));
        const tags = [], meshes = [];
        for (const [part, group] of Object.entries(fighter.groups)) group.traverse(object => {
          if (object.userData.outfit) tags.push({ part, uuid: object.uuid,
            outfit: object.userData.outfit, outfitPart: object.userData.outfitPart });
          if (object.isMesh) meshes.push({ part, uuid: object.uuid, visible: visible(object),
            vertices: object.geometry.attributes.position?.count ?? 0,
            color: object.material.color?.getHex(), skinned: !!object.isSkinnedMesh });
        });
        return { parts, tags, meshes, signature: meshes.map(({ part, vertices, color, skinned }) => ({ part, vertices, color, skinned })) };
      };
      const weapon = f => ({ weapon: f.weapon.id, mass: f.sword.mass(), swordsmanship: f.swordsmanshipModel ?? 'legacy',
        config: Object.fromEntries(['bladeLength', 'hiltLength', 'twoHand', 'mCut', 'mThrust', 'mBlunt', 'power',
          'aimStiffness', 'aimDamping', 'maxAimTorque', 'wristVmax'].map(key => [key, f.weaponCfg[key]])) });
      p.read = () => ({ url: location.href, state: game.state, steps: game.combat.stepNo, simTime: game.stats.simTime,
        fightT: game.player.fightT, objects: { player: id(game.player), enemy: id(game.enemy), world: id(game.world), ai: id(game.ai) },
        characterModel: JSON.parse(JSON.stringify(game.characterModel)), appearance: p.appearance(game.enemy),
        render: game.renderInfo(), stage: game.stage.id,
        player: { name: game.player.name, state: game.player.state, weapon: game.player.weapon.id, alive: game.player.alive,
          wounds: game.player.wounds.length, pelvis: { ...game.player.bodies.pelvis.translation() },
          swordRotation: { ...game.player.sword.rotation() }, handHeld: game.player.handHeld,
          hand: { x: game.player.handOffset.x, y: game.player.handOffset.y },
          lastMotionTimeS: game.player.swordsmanshipState?.lastMotionTimeS ?? null },
        enemy: { name: game.enemy.name, state: game.enemy.state, weapon: game.enemy.weapon.id, alive: game.enemy.alive,
          wounds: game.enemy.wounds.length, helmetIntegrity: game.enemy.helmetIntegrity,
          plate: { ...game.enemy.plate }, detached: game.enemy.detachedParts?.size ?? 0 },
        physics: { gravity: { ...game.world.gravity }, startHold: game.config.ARENA.startHold,
          fighters: [game.player, game.enemy].map(weapon) },
        hits: game.stats.hits.slice(),
        input: { enabled: game.input.enabled, activeTouch: game.input.activeTouch, stick: [game.input.stickMove.x, game.input.stickMove.y] },
        accepted: p.accepted.slice(), acceptedTotal: p.acceptedTotal, woundObservations: p.wounds.slice(),
        finite: p.bodies().every(Number.isFinite), saved: localStorage.getItem('gladiator-settings'),
        layout: { width: innerWidth, scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) } });
      const sample = () => {
        const key = id(game.enemy);
        if (!p.baselines.has(key)) p.baselines.set(key, p.appearance(game.enemy));
        if (game.enemy.wounds.length > 0 && !p.injured.has(key)) {
          p.injured.add(key);
          p.wounds.push({ enemy: key, step: game.combat.stepNo, fightT: game.player.fightT,
            wounds: game.enemy.wounds.length, hits: game.stats.hits.slice(), before: p.baselines.get(key),
            after: p.appearance(game.enemy), characterModel: JSON.parse(JSON.stringify(game.characterModel)) });
        }
        if (game.state === 'fight' && game.player.inputActive) {
          p.acceptedTotal++;
          p.accepted.push({ player: id(game.player), step: game.combat.stepNo, held: game.player.handHeld,
            hand: { x: game.player.handOffset.x, y: game.player.handOffset.y } });
          if (p.accepted.length > 80) p.accepted.shift();
        }
        requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    });
  }
  const read = () => page.evaluate(() => encounterProbe.read());
  function policy(value, row) {
    assert(value.finite); assert.equal(value.saved, saved); assert.equal(value.stage, row.stage);
    if (row.playerWeapon) assert.equal(value.player.weapon, row.playerWeapon);
    assert.equal(value.enemy.weapon, row.weapon);
    assert.equal(value.player.name, '나'); assert.equal(value.enemy.name, row.name);
    assert(value.layout.scrollWidth <= value.layout.width + 1, 'Mobile horizontal overflow');
    assert.equal(value.characterModel.requested, false); assert.equal(value.characterModel.model, 'procedural');
    assert.equal(value.characterModel.status, 'off'); assert.equal(value.characterModel.loads, 0);
    assert.deepEqual(value.characterModel.controllers, []);
    assert(value.appearance.parts.length >= 14 && value.appearance.parts.some(part => part.visible));
    assert(value.appearance.meshes.every(mesh => !mesh.skinned), 'Native encounter must not use a whole-body skin');
    assert(value.appearance.tags.length > 0 && value.appearance.tags.every(tag => tag.outfit === row.outfit),
      'Actual ragdoll visual groups must carry this opponent outfit');
    assert(value.appearance.meshes.length > value.appearance.parts.length, 'Native decorative geometry must actually exist');
  }
  async function send(type, touchPoints) {
    inputRequests.push({ entry: entries.at(-1)?.id, type, touchPoints });
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  }
  async function controls(row, label) {
    await wait(() => game.state === 'fight' && game.player.fightT > 2.05);
    const flow = row[label] = { before: await read() };
    await send('touchStart', [{ x: 690, y: 270, id: 1 }]);
    await send('touchMove', [{ x: 640, y: 170, id: 1 }]);
    await wait(count => encounterProbe.acceptedTotal > count, flow.before.acceptedTotal);
    flow.handApplied = await read(); assert.notEqual(flow.handApplied.input.activeTouch, null);
    assert(flow.handApplied.accepted.some(sample => sample.player === flow.before.objects.player && sample.held));
    assert.notEqual(flow.handApplied.player.lastMotionTimeS, flow.before.player.lastMotionTimeS);
    await send('touchMove', [{ x: 725, y: 310, id: 1 }]);
    await wait(steps => game.combat.stepNo > steps + 8, flow.handApplied.steps);
    flow.stroke = await read();
    const qa = Object.values(flow.before.player.swordRotation), qb = Object.values(flow.stroke.player.swordRotation);
    flow.swordRotationRadians = 2 * Math.acos(Math.min(1, Math.abs(qa.reduce((sum, q, i) => sum + q * qb[i], 0))));
    assert(flow.swordRotationRadians > .005, 'Trusted sword stroke must move the physical sword');
    await send('touchEnd', []);
    const box = await page.locator('#moveStick').boundingBox(); assert(box);
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 2 };
    flow.beforeMove = await read(); await send('touchStart', [point]);
    await send('touchMove', [{ ...point, y: point.y + 32 }]);
    await wait(steps => game.combat.stepNo > steps + 8 && Math.abs(game.player.move.y) > .1, flow.beforeMove.steps);
    flow.movement = await read();
    flow.displacementM = Math.hypot(flow.movement.player.pelvis.x - flow.beforeMove.player.pelvis.x,
      flow.movement.player.pelvis.z - flow.beforeMove.player.pelvis.z);
    assert(flow.displacementM > .001, 'Trusted stick must move the physical body');
    await send('touchEnd', []); flow.after = await read(); policy(flow.after, row);
    assert.equal(flow.after.input.activeTouch, null); assert.deepEqual(flow.after.input.stick, [0, 0]);
    assert(flow.after.render.frame > flow.before.render.frame && flow.after.render.calls > 0);
    assert.deepEqual(flow.after.appearance.parts.map(part => part.uuid), flow.before.appearance.parts.map(part => part.uuid));
    assert.deepEqual(flow.after.appearance.tags, flow.before.appearance.tags, 'Movement must preserve the same native outfit groups');
  }
  async function chooseWeapon(row, label) {
    await wait(() => game.state === 'draw' && game.draw.stage === 'choose' && game.draw.t >= .45);
    const cards = await page.evaluate(() => ({ stage: game.draw.stage, ids: [...game.draw.ids],
      labels: [...document.querySelectorAll('.wcard')].map(card => card.getAttribute('aria-label')) }));
    assert.equal(cards.ids[2], row.weapon, 'Opponent card must retain the native encounter weapon');
    const index = cards.ids.slice(0, 2).findIndex(id => WEAPONS[id] && !WEAPONS[id].gun);
    assert(index >= 0, 'Ordinary deck must offer at least one melee card for the touch stroke check');
    row[label] = { cards, index, selected: cards.ids[index], selectionPolicy: 'First available ordinary melee card; deck and RNG unchanged' };
    if (label === 'firstChoice') await page.screenshot({ path: path.join(out, `${row.id}-weapon-choice-landscape.png`) });
    await page.locator(`.wcard[data-i="${index}"]`).tap();
    await wait(() => game.state === 'fight' && game.player.fightT > 0);
    row.playerWeapon = cards.ids[index];
    assert.equal(await page.evaluate(() => game.player.weapon.id), row.playerWeapon, 'Chosen card must become the actual player weapon');
  }
  async function pause(row) {
    await page.locator('#btnPause').tap();
    await wait(() => game.state === 'paused');
    const value = await read(); policy(value, row); assert.equal(value.input.enabled, false);
    assert.equal(value.input.activeTouch, null); assert.deepEqual(value.input.stick, [0, 0]); return value;
  }
  async function drainFlow(row) {
    const began = performance.now(), until = Math.min(began + 20000, start + budgetMs);
    const remaining = () => { const ms = until - performance.now(); assert(ms > 0, 'Network drain exceeded its budget'); return ms; };
    do {
      await page.waitForLoadState('networkidle', { timeout: remaining() });
      while (inFlightRoutes.size) {
        let timer;
        try {
          await Promise.race([Promise.allSettled([...inFlightRoutes]), new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Route drain exceeded its budget')), remaining());
          })]);
        } finally { clearTimeout(timer); }
      }
      const checked = compiled.length;
      await page.waitForTimeout(600); remaining();
      if (!inFlightRoutes.size && compiled.length === checked) break;
    } while (true);
    row.networkDrain = { routesAtEnd: inFlightRoutes.size, stableIdleMs: 600, wallMs: performance.now() - began };
  }
  for (const fixture of scenario) {
    const row = { ...fixture }, flowStart = performance.now(), requestedBefore = compiled.length, eventsBefore = nativeEvents.length;
    entries.push(row);
    await page.setViewportSize({ width: 390, height: 844 });
    const selector = new URL('new-encounters.html', base);
    await page.goto(selector.href, { waitUntil: 'load', timeout: 30000 });
    const candidates = await page.locator('a[href]').evaluateAll(anchors => anchors.map((anchor, index) => ({ index,
      href: anchor.href, text: anchor.textContent.trim() })));
    const choice = candidates.filter(anchor => {
      const url = new URL(anchor.href);
      return url.origin === base.origin && url.pathname === base.pathname && url.searchParams.get('foe') === row.foe &&
        url.searchParams.get('stage') === row.stage &&
        [...url.searchParams.keys()].every(key => ['stage', 'foe'].includes(key));
    });
    assert.equal(choice.length, 1, `Selector must expose one exact encounter link: ${row.id}`);
    row.selection = choice[0];
    const selectorLayout = await page.evaluate(() => ({ width: innerWidth,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) }));
    assert(selectorLayout.scrollWidth <= selectorLayout.width + 1);
    if (entries.length === 1) await page.screenshot({ path: path.join(out, 'selector-portrait.png'), fullPage: true });
    await Promise.all([page.waitForURL(choice[0].href, { waitUntil: 'load' }), page.locator('a[href]').nth(choice[0].index).tap()]);
    await observe(); row.entry = await read(); policy(row.entry, row);
    await page.screenshot({ path: path.join(out, `${row.id}-entry-portrait.png`) });
    await page.setViewportSize({ width: 844, height: 390 }); cdp = await context.newCDPSession(page);
    await page.locator('#btnStart').tap();
    await chooseWeapon(row, 'firstChoice');
    row.started = await read(); policy(row.started, row);
    await controls(row, 'firstInput');
    await page.screenshot({ path: path.join(out, `${row.id}-gameplay-landscape.png`) });
    row.paused = await pause(row);
    const frozen = await page.evaluate(() => ({ frame: game.renderInfo().frame, bodies: encounterProbe.bodies(), steps: game.combat.stepNo }));
    await wait(frame => game.renderInfo().frame > frame + 1, frozen.frame);
    const still = await page.evaluate(() => ({ bodies: encounterProbe.bodies(), steps: game.combat.stepNo }));
    assert.deepEqual(still.bodies, frozen.bodies); assert.equal(still.steps, frozen.steps); row.pauseFrozen = true;
    await page.locator('#btnResume').tap();
    await wait(steps => game.state === 'fight' && game.combat.stepNo > steps, frozen.steps);
    row.resumed = await read(); policy(row.resumed, row); assert.deepEqual(row.resumed.objects, row.started.objects);
    assert.deepEqual(row.resumed.appearance.tags, row.started.appearance.tags);
    row.beforeRestart = await pause(row);
    await page.locator('#btnStart').tap();
    await chooseWeapon(row, 'restartChoice');
    row.restarted = await read(); policy(row.restarted, row);
    assert.deepEqual(row.restarted.physics.fighters[1], row.started.physics.fighters[1], 'Restart must retain the opponent weapon and combat settings');
    assert.deepEqual(row.restarted.physics.gravity, row.started.physics.gravity);
    assert.equal(row.restarted.physics.startHold, row.started.physics.startHold);
    for (const key of Object.keys(row.restarted.objects)) assert.notEqual(row.restarted.objects[key], row.beforeRestart.objects[key]);
    assert.equal(row.restarted.player.wounds, 0); assert.equal(row.restarted.enemy.wounds, 0);
    assert.deepEqual(row.restarted.appearance.signature, row.started.appearance.signature,
      'Restart must rebuild the same native outfit geometry and colors');
    assert(row.restarted.appearance.parts.every(part => !row.beforeRestart.appearance.parts.some(old => old.uuid === part.uuid)),
      'Restart must create fresh fighter visual objects');
    await controls(row, 'restartInput'); row.final = await pause(row);
    for (const injury of row.final.woundObservations) {
      assert.deepEqual(injury.after.parts.map(part => part.uuid), injury.before.parts.map(part => part.uuid));
      assert.deepEqual(injury.after.tags, injury.before.tags, 'Actual injury must retain the native outfit groups');
      assert.equal(injury.characterModel.requested, false); assert.equal(injury.characterModel.loads, 0);
    }
    row.damageObservation = { actualEnemyWoundObserved: row.final.woundObservations.length > 0,
      samples: row.final.woundObservations.length,
      verdict: row.final.woundObservations.length ? 'Native identity persisted across naturally observed wounds' :
        'No enemy wound observed during bounded touch flow; damage continuity remains a separate native test' };
    await drainFlow(row);
    row.native = nativeEvents.slice(eventsBefore);
    assert(row.native.length && row.native.every(event => event.trusted && event.kind === 'touch'));
    assert(row.native.some(event => event.href === row.selection.href), 'Encounter must be selected with a trusted touch');
    for (const id of ['btnStart', 'btnPause', 'btnResume']) assert(row.native.some(event => event.target === id));
    assert(row.native.some(event => event.cardIndex !== null), 'Weapon choice must include a trusted card tap');
    row.requestedArtifacts = compiled.slice(requestedBefore).map(item => item.name);
    assert(!row.requestedArtifacts.some(name => /\.(glb|gltf|fbx)(?:$|\?)/i.test(name) || /models\/tripo|tripo_character/.test(name)),
      'Native encounter must not request optional model assets or the skin adapter');
    row.wallMs = performance.now() - flowStart;
    await cdp.detach(); cdp = null;
    console.log(JSON.stringify({ event: 'flow-complete', id: row.id, steps: row.final.steps, wallMs: row.wallMs,
      naturalWoundObserved: row.damageObservation.actualEnemyWoundObserved }));
  }
  assert(compiled.some(item => item.name === 'dist/new-encounters.html') && compiled.some(item => item.name === 'dist/index.html') &&
    compiled.some(item => item.name.startsWith('dist/assets/main-')));
  assert(compiled.every(item => item.match)); assert.deepEqual(errors, []); pass = true;
} catch (error) {
  fatal = { name: error.name, message: clean(error.message), stack: clean(error.stack) }; process.exitCode = 1;
  if (page && !page.isClosed()) try {
    failureSnapshot = await page.evaluate(() => ({ state: window.encounterProbe?.read() }));
    await page.screenshot({ path: path.join(out, 'failure-scene.png') });
  } catch (snapshotError) { errors.push({ kind: 'failure-snapshot', message: clean(snapshotError.message) }); }
} finally {
  if (cdp) await cdp.detach().catch(() => {});
  try {
    if (page && !page.isClosed()) {
      await page.waitForLoadState('networkidle', { timeout: Math.max(100, Math.min(15000, budgetMs - (performance.now() - start))) });
      teardown.networkIdle = true;
    }
    while (inFlightRoutes.size) await Promise.allSettled([...inFlightRoutes]);
    closingRequests = true; teardown.routesBeforeClose = inFlightRoutes.size; assert.equal(teardown.routesBeforeClose, 0);
  } catch (error) { errors.push({ kind: 'teardown-drain', message: clean(error.message) }); pass = false; }
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
    base: base.href, buildStable, sourceStable, manifestBefore: before, scenario, settings, entries, compiled,
    networkAttempts, errors, fatal, failureSnapshot, inputRequests, teardown, tlsVerification: true, proxyRetained: !local,
    limits: ['Chromium mobile emulation on SwiftShader with a 420-second wall budget; physical-phone performance and human appearance acceptance are not assessed.',
      'Three exact stage/opponent entries are chosen by trusted selector-link taps. Ordinary weapon cards are selected by touch at first start and restart; opponents retain their own rapier/falchion/monohoshizao.',
      'Observers do not replace gameplay methods or alter bodies, wounds, AI, RNG, simulation time, camera or control settings.',
      'Only naturally observed enemy wounds count as browser damage evidence. Absence is reported explicitly; native damage tests remain separate.',
      'Screenshots use the ordinary gameplay camera. Native part meshes, tagged outfit groups and restart geometry are checked; no whole-body model asset is requested.',
      'Every served artifact must return 200 and byte-match the frozen build. One logged retry is allowed for GET 502/503; configured public proxy and TLS verification remain enabled.',
      'Source, public files, this tool and dist are frozen before/after each run. Public execution requires passing local evidence from that exact frozen source/tool/build.'] };
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await fs.writeFile(path.join(out, 'manifest-after.json'), JSON.stringify(after, null, 2) + '\n');
  console.log(JSON.stringify({ pass, buildStable, sourceStable, flows: entries.length, wallMs: report.wallMs, fatal, out }));
}
