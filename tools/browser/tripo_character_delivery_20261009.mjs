// Optional Schwarz skin delivery: two longsword lifecycles and real revolver damage,
// read-only gameplay/skin observations, and separately labelled paused camera views.
// Run after source/dist freeze. Every served byte must match that frozen build.
// --out=/workspace/halfsword-handoff/tripo-character-20261009/mobile/<fresh-name>
// (or /tmp/halfsword-tripo-mobile-<fresh-name>) [--base=http://127.0.0.1:4173/]
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
  { id: 'ordinary-schwarz', tripo: false, foe: 'margarethe', weapon: 'longsword', stage: 'cathedral' },
  { id: 'tripo-schwarz', tripo: true, foe: 'margarethe', weapon: 'longsword', stage: 'cathedral' },
  { id: 'tripo-schwarz-revolver-damage', tripo: true, foe: 'margarethe', weapon: 'pistol', foeWeapon: 'longsword', stage: 'cathedral', damage: true, maxShots: 6 },
];
const modelArtifact = 'dist/models/tripo/schwarz-anime.glb';
const artifactRoot = '/workspace/halfsword-handoff/tripo-character-20261009/mobile';
const allowedOut = p => path.dirname(p) === artifactRoot || /^\/tmp\/halfsword-tripo-mobile-[^/]+$/.test(p);
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
  const files = ['tools/browser/tripo_character_delivery_20261009.mjs', 'index.html', 'package.json',
    'package-lock.json', 'public/feature-lab.html', ...await scan('public/models/tripo'),
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
const budgetMs = 360000;
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
  page = await context.newPage();
  page.on('pageerror', error => errors.push({ kind: 'pageerror', message: clean(error.message) }));
  page.on('console', message => { if (message.type() === 'error') errors.push({ kind: 'console', message: clean(message.text()) }); });
  page.on('requestfailed', request => errors.push({ kind: 'requestfailed', url: clean(request.url()), message: clean(request.failure()?.errorText) }));
  const wait = (predicate, arg, timeout = 45000) => page.waitForFunction(predicate, arg,
    { timeout: Math.max(100, Math.min(timeout, budgetMs - (performance.now() - start))) });
  async function observe() {
    await wait(() => window.game?.player && game.combat && game.characterModel);
    await page.evaluate(() => {
      const p = window.characterProbe = { native: [], accepted: [], acceptedTotal: 0, transitions: [], ids: new WeakMap(), next: 1 };
      const id = object => { if (!p.ids.has(object)) p.ids.set(object, p.next++); return p.ids.get(object); };
      p.bodies = () => [game.player, game.enemy].flatMap(f => [...Object.values(f.bodies), f.sword])
        .flatMap(body => [body.translation(), body.rotation(), body.linvel(), body.angvel()].flatMap(v => Object.values(v)));
      p.skins = () => {
        const meshes = [], geometries = new Set(), materials = new Set(), textures = new Set();
        game.player.scene.traverse(mesh => {
          if (!mesh.isSkinnedMesh) return;
          let visible = true; for (let object = mesh; object; object = object.parent) visible &&= object.visible;
          meshes.push({ uuid: mesh.uuid, name: mesh.name, visible, bones: mesh.skeleton.bones.length,
            pose: mesh.skeleton.bones.flatMap(b => [...b.position.toArray(), ...b.quaternion.toArray(), ...b.scale.toArray()]),
            matrix: [...mesh.matrixWorld.elements], vertices: mesh.geometry.attributes.position.count,
            skinWeights: !!mesh.geometry.attributes.skinWeight, skinIndices: !!mesh.geometry.attributes.skinIndex });
          geometries.add(mesh.geometry.uuid);
          for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            materials.add(material.uuid);
            for (const value of Object.values(material)) if (value?.isTexture) textures.add(value.uuid);
          }
        });
        return { meshes, resources: { meshes: meshes.length, geometries: geometries.size, materials: materials.size, textures: textures.size } };
      };
      p.read = () => ({ url: location.href, state: game.state, steps: game.combat.stepNo, simTime: game.stats.simTime,
        fightT: game.player.fightT, objects: { player: id(game.player), enemy: id(game.enemy), world: id(game.world), ai: id(game.ai) },
        characterModel: JSON.parse(JSON.stringify(game.characterModel)),
        skins: p.skins(), render: game.renderInfo(), stage: game.stage.id,
        nativeBodyVisible: Object.entries(game.enemy.partMesh).filter(([, mesh]) => {
          if (!mesh.layers.test(game.camera.layers)) return false;
          for (let object = mesh; object; object = object.parent) if (!object.visible) return false;
          return true;
        }).map(([part]) => part),
        player: { name: game.player.name, state: game.player.state, weapon: game.player.weapon.id, alive: game.player.alive, wounds: game.player.wounds.length,
          pelvis: { ...game.player.bodies.pelvis.translation() }, swordRotation: { ...game.player.sword.rotation() },
          hand: { x: game.player.handOffset.x, y: game.player.handOffset.y },
          gun: game.player.gun ? Object.fromEntries(['ammo', 'cool', 'shots', 'hits', 'pending', 'reloading', 'what'].map(k => [k, game.player.gun[k]])) : null,
          lastMotionTimeS: game.player.swordsmanshipState?.lastMotionTimeS ?? null },
        enemy: { name: game.enemy.name, state: game.enemy.state, weapon: game.enemy.weapon.id, alive: game.enemy.alive,
          pelvis: { ...game.enemy.bodies.pelvis.translation() }, wounds: game.enemy.wounds.length,
          helmetIntegrity: game.enemy.helmetIntegrity, plate: { ...game.enemy.plate }, cloth: { ...game.enemy.cloth }, detached: game.enemy.detachedParts?.size ?? 0 },
        physics: { gravity: { ...game.world.gravity }, startHold: game.config.ARENA.startHold,
          fighters: [game.player, game.enemy].map(f => ({ mass: f.sword.mass(), weapon: f.weapon.id,
            swordsmanship: f.swordsmanshipModel ?? 'legacy', armSupport: f.armSupportModel,
            weaponConfig: Object.fromEntries(['bladeLength', 'hiltLength', 'twoHand', 'mCut', 'mThrust', 'mBlunt', 'power',
              'aimStiffness', 'aimDamping', 'maxAimTorque', 'wristVmax'].map(key => [key, f.weaponCfg[key]])) })) },
        hits: game.stats.hits.slice(),
        input: { enabled: game.input.enabled, activeTouch: game.input.activeTouch, stick: [game.input.stickMove.x, game.input.stickMove.y] },
        accepted: p.accepted.slice(), acceptedTotal: p.acceptedTotal, transitions: p.transitions.slice(), finite: p.bodies().every(Number.isFinite), saved: localStorage.getItem('gladiator-settings'),
        layout: { width: innerWidth, scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) } });
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) document.addEventListener(type, event => {
        if (p.native.length < 500) p.native.push({ type, trusted: event.isTrusted, kind: event.pointerType,
          target: event.target.closest?.('button')?.id || event.target.id, player: id(game.player), fightT: game.player.fightT });
      }, true);
      const sample = () => {
        const controller = game.characterModel.controllers?.find(c => c.role === 'enemy');
        if (controller && (p.transitions.at(-1)?.status !== controller.status || p.transitions.at(-1)?.enemy !== id(game.enemy)))
          p.transitions.push({ enemy: id(game.enemy), status: controller.status, step: game.combat.stepNo,
            reason: controller.fallbackReason, fightT: game.player.fightT, wounds: game.enemy.wounds.length,
            helmetIntegrity: game.enemy.helmetIntegrity, plate: { ...game.enemy.plate }, detached: game.enemy.detachedParts?.size ?? 0 });
        if (game.state === 'fight' && game.player.inputActive) {
          p.acceptedTotal++;
          p.accepted.push({ player: id(game.player), step: game.combat.stepNo, held: game.player.handHeld,
            hand: { x: game.player.handOffset.x, y: game.player.handOffset.y } });
          if (p.accepted.length > 150) p.accepted.shift();
        }
        requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    });
  }
  const read = () => page.evaluate(() => characterProbe.read());
  function policy(value, fixture) {
    assert(value.finite); assert.equal(value.saved, saved); assert.equal(value.stage, fixture.stage);
    assert.equal(value.player.weapon, fixture.weapon);
    assert.equal(value.enemy.weapon, fixture.foeWeapon ?? fixture.weapon);
    assert.equal(value.player.name, '나'); assert.equal(value.enemy.name, '마르그레테 슈바르츠');
    assert(value.layout.scrollWidth <= value.layout.width + 1, 'Mobile horizontal overflow');
    assert.equal(value.characterModel.requested, fixture.tripo);
    assert(!value.characterModel.error, 'Model adapter reported an error');
    if (fixture.tripo) {
      const controller = value.characterModel.controllers.find(c => c.role === 'enemy'); assert(controller);
      assert(['ready', 'fallback'].includes(controller.status));
      if (controller.status === 'ready') {
        assert.equal(value.nativeBodyVisible.length, 0, 'Ready sample must replace the native body visual');
        assert(value.skins.meshes.length > 0, 'Loaded sample must have a real scene SkinnedMesh');
        assert(value.skins.meshes.every(m => m.visible && m.bones > 0 && m.vertices > 0 && m.skinWeights && m.skinIndices));
        assert(value.skins.meshes.every(m => [...m.pose, ...m.matrix].every(Number.isFinite)));
        assert(value.skins.resources.textures > 0, 'Textured sample must use real texture resources');
        assert(controller.skinnedMeshCount > 0 && controller.boneCount > 0 && controller.updateCount > 0);
      } else {
        assert(controller.fallbackReason, 'Fallback must explain why ordinary damage visuals replaced the sample');
        assert(value.skins.meshes.every(m => !m.visible), 'An intact sample must not cover native damage visuals');
        assert(value.nativeBodyVisible.length > 0, 'Fallback must restore actual native body visuals');
      }
    } else {
      assert.equal(value.skins.meshes.length, 0, 'Ordinary character must retain its procedural mesh');
      assert(value.nativeBodyVisible.length > 0);
    }
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
    await wait(count => characterProbe.acceptedTotal > count, flow.before.acceptedTotal);
    flow.handApplied = await read(); assert.notEqual(flow.handApplied.input.activeTouch, null);
    assert(flow.handApplied.accepted.some(s => s.player === flow.before.objects.player && s.held));
    assert.notEqual(flow.handApplied.player.lastMotionTimeS, flow.before.player.lastMotionTimeS);
    await send('touchMove', [{ x: 725, y: 310, id: 1 }]);
    await wait(steps => game.combat.stepNo > steps + 8, flow.handApplied.steps);
    flow.stroke = await read();
    const qa = Object.values(flow.before.player.swordRotation), qb = Object.values(flow.stroke.player.swordRotation);
    flow.swordRotationRadians = 2 * Math.acos(Math.min(1, Math.abs(qa.reduce((sum, q, i) => sum + q * qb[i], 0))));
    assert(flow.swordRotationRadians > .005, 'Trusted hand stroke must move the physical sword');
    await send('touchEnd', []);
    await page.screenshot({ path: path.join(out, `${row.id}-${label}-gameplay-shoulder.png`) });
    const box = await page.locator('#moveStick').boundingBox(); assert(box);
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 2 };
    flow.beforeMove = await read(); await send('touchStart', [point]);
    await send('touchMove', [{ ...point, y: point.y + 32 }]);
    await wait(steps => game.combat.stepNo > steps + 8 && Math.abs(game.player.move.y) > .1, flow.beforeMove.steps);
    flow.movement = await read();
    flow.displacementM = Math.hypot(flow.movement.player.pelvis.x - flow.beforeMove.player.pelvis.x,
      flow.movement.player.pelvis.z - flow.beforeMove.player.pelvis.z);
    assert(flow.displacementM > .001, 'Trusted stick must move the actual body');
    await send('touchEnd', []); flow.after = await read(); policy(flow.after, row);
    assert.equal(flow.after.input.activeTouch, null); assert.deepEqual(flow.after.input.stick, [0, 0]);
    assert(flow.after.render.frame > flow.before.render.frame && flow.after.render.calls > 0);
    if (row.tripo && flow.after.characterModel.controllers.some(c => c.status === 'ready')) assert.notDeepEqual(flow.after.skins.meshes.map(m => m.pose), flow.before.skins.meshes.map(m => m.pose),
      'Actual rendered skeleton must change with the gameplay motion');
  }
  async function revolverFallback(row) {
    const flow = row.revolverDamage = { before: await read(), shots: [], maxShots: row.maxShots };
    const ready = () => page.evaluate(() => game.characterModel.controllers.some(c => c.role === 'enemy' && c.status === 'ready'));
    assert.equal(flow.before.player.gun.ammo, 6);
    while (await ready() && flow.shots.length < row.maxShots) {
      await wait(() => game.state !== 'fight' || game.player.fightT > 2.05 &&
        !game.player.feetHeld && game.player.gun.cool <= 0 && !game.player.gun.reloading, null, 30000);
      const shot = { before: await read() }; flow.shots.push(shot);
      assert.equal(shot.before.state, 'fight', 'Combat ended before the bounded damage observation');
      inputRequests.push({ entry: row.id, type: 'touchscreen.tap', x: 675, y: 230 });
      await page.touchscreen.tap(675, 230);
      await wait(shots => game.player.gun.shots > shots || game.state !== 'fight', shot.before.player.gun.shots, 15000);
      shot.after = await read();
      assert.equal(shot.after.player.gun.shots, shot.before.player.gun.shots + 1, 'Trusted tap must fire exactly one actual shot');
    }
    flow.after = await read(); policy(flow.after, row);
    const controller = flow.after.characterModel.controllers.find(c => c.role === 'enemy');
    assert.equal(controller.status, 'fallback', 'Bounded trusted revolver shots must actually expose the damage fallback');
    assert(flow.after.player.gun.hits > flow.before.player.gun.hits, 'A real player bullet must hit the enemy');
    assert(flow.after.enemy.wounds > 0 || flow.after.enemy.helmetIntegrity < row.started.enemy.helmetIntegrity ||
      Object.entries(flow.after.enemy.plate).some(([part, health]) => health < row.started.enemy.plate[part]) || flow.after.enemy.detached > 0 ||
      flow.after.hits.slice(row.started.hits.length).some(hit => hit.startsWith(`${row.started.player.name}->`)),
    'Fallback must coincide with real enemy injury or armor wear');
    await page.screenshot({ path: path.join(out, `${row.id}-actual-damage-fallback.png`) });
  }
  async function pause(row) {
    if (await page.evaluate(() => game.state !== 'paused')) await page.locator('#btnPause').tap();
    await wait(() => game.state === 'paused');
    const value = await read(); policy(value, row); assert.equal(value.input.enabled, false);
    assert.equal(value.input.activeTouch, null); assert.deepEqual(value.input.stick, [0, 0]); return value;
  }
  async function frontDiagnostic(row) {
    // Separate visual inspection only. No physics, input, AI, RNG or clock changes.
    // This runs between trusted pause/resume actions. Restore camera and UI afterwards.
    const beforeView = await page.evaluate(() => ({ freeCam: game.freeCam, position: game.camera.position.toArray(),
      quaternion: game.camera.quaternion.toArray(), up: game.camera.up.toArray(), bodies: characterProbe.bodies(), steps: game.combat.stepNo }));
    let diagnosticStyle;
    try {
      diagnosticStyle = await page.addStyleTag({ content: 'body > :not(#game) { visibility: hidden !important; }' });
      await page.evaluate(() => {
        const p = game.enemy.bodies.pelvis.translation(), e = game.player.bodies.pelvis.translation();
        const length = Math.hypot(e.x - p.x, e.z - p.z) || 1;
        const dx = (e.x - p.x) / length, dz = (e.z - p.z) / length;
        game.freeCam = true; game.camera.position.set(p.x + dx * 3.2 - dz * .8, 1.6, p.z + dz * 3.2 + dx * .8);
        game.camera.lookAt(p.x, .95, p.z);
      });
      const frame = await page.evaluate(() => game.renderInfo().frame);
      await wait(f => game.renderInfo().frame > f + 1, frame);
      const file = `${row.id}-visual-diagnostic-front-paused.png`;
      await page.screenshot({ path: path.join(out, file) });
      const afterView = await page.evaluate(() => ({ bodies: characterProbe.bodies(), steps: game.combat.stepNo }));
      assert.deepEqual(afterView.bodies, beforeView.bodies); assert.equal(afterView.steps, beforeView.steps);
      row.frontDiagnostic = { file, label: 'Paused visual camera diagnostic with UI temporarily hidden; not a gameplay camera or input flow', physicsUnchanged: true };
    } finally {
      await page.evaluate(v => {
        game.camera.position.fromArray(v.position); game.camera.quaternion.fromArray(v.quaternion);
        game.camera.up.fromArray(v.up); game.freeCam = v.freeCam;
      }, beforeView);
      if (diagnosticStyle) await diagnosticStyle.evaluate(style => style.remove());
    }
  }
  async function settledRender() {
    const frame = await page.evaluate(() => game.renderInfo().frame);
    await wait(f => game.renderInfo().frame > f + 1, frame);
  }
  async function drainFlow(row) {
    const began = performance.now(), until = Math.min(began + 30000, start + budgetMs);
    const receipt = row.networkDrain = { routesAtStart: inFlightRoutes.size, checkedAtStart: compiled.length, cycles: 0 };
    const remaining = () => {
      const ms = until - performance.now(); assert(ms > 0, 'Per-flow network drain exceeded 30 seconds'); return ms;
    };
    while (true) {
      receipt.cycles++;
      await page.waitForLoadState('networkidle', { timeout: remaining() });
      while (inFlightRoutes.size) {
        let timer;
        try {
          await Promise.race([Promise.allSettled([...inFlightRoutes]), new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Per-flow route drain exceeded 30 seconds')), remaining());
          })]);
        } finally { clearTimeout(timer); }
      }
      // Audio workers can enqueue another fetch after the previous batch ends.
      // Require an additional stable quiet interval before navigating away.
      const checked = compiled.length; assert(remaining() >= 600, 'Insufficient stable-idle drain budget');
      await page.waitForTimeout(600);
      remaining();
      if (!inFlightRoutes.size && compiled.length === checked) break;
    }
    receipt.routesAtEnd = inFlightRoutes.size; receipt.checkedAtEnd = compiled.length;
    receipt.stableIdleMs = 600; receipt.wallMs = performance.now() - began;
  }
  for (const fixture of scenario) {
    await page.setViewportSize({ width: 390, height: 844 });
    const url = new URL(base); url.search = new URLSearchParams({ foe: fixture.foe, weapon: fixture.weapon,
      stage: fixture.stage, ...(fixture.foeWeapon ? { foeWeapon: fixture.foeWeapon } : {}),
      ...(fixture.tripo ? { characterModel: 'tripo' } : {}) });
    const requestedBefore = compiled.length;
    await page.goto(url.href, { waitUntil: 'load', timeout: 30000 }); await observe();
    if (fixture.tripo) await wait(() => characterProbe.read().characterModel.status === 'ready', null, 60000);
    const row = { ...fixture, entry: await read() }; entries.push(row); policy(row.entry, row);
    await page.screenshot({ path: path.join(out, `${row.id}-entry-portrait.png`) });
    await page.setViewportSize({ width: 844, height: 390 }); cdp = await context.newCDPSession(page);
    await page.locator('#btnStart').tap(); await wait(() => game.state === 'fight' && game.player.fightT > 0);
    if (row.tripo) await wait(() => characterProbe.read().characterModel.status === 'ready');
    await settledRender();
    row.started = await read(); policy(row.started, row);
    if (row.tripo && !row.damage) assert.deepEqual(row.started.physics, entries[0].started.physics,
      'Optional visual model must retain the ordinary opponent and combat settings');
    if (row.tripo) {
      await wait(steps => game.combat.stepNo > steps + 12, row.started.steps);
      row.skinMotion = await read(); policy(row.skinMotion, row);
      const beforeController = row.started.characterModel.controllers.find(c => c.role === 'enemy');
      const afterController = row.skinMotion.characterModel.controllers.find(c => c.role === 'enemy');
      assert.equal(beforeController.status, 'ready'); assert.equal(afterController.status, 'ready');
      assert.equal(afterController.rootUUID, beforeController.rootUUID);
      assert(afterController.updateCount > beforeController.updateCount);
      assert.notDeepEqual(row.skinMotion.skins.meshes.map(m => m.pose), row.started.skins.meshes.map(m => m.pose),
        'Before any damage, normal gameplay must actually update the same visible model skeleton');
    }
    await pause(row); await frontDiagnostic(row);
    await page.locator('#btnResume').tap(); await wait(() => game.state === 'fight');
    if (row.damage) await revolverFallback(row);
    else await controls(row, 'firstInput');
    row.paused = await pause(row);
    const frozen = await page.evaluate(() => ({ frame: game.renderInfo().frame, bodies: characterProbe.bodies(), steps: game.combat.stepNo }));
    await wait(frame => game.renderInfo().frame > frame + 1, frozen.frame);
    const still = await page.evaluate(() => ({ bodies: characterProbe.bodies(), steps: game.combat.stepNo }));
    assert.deepEqual(still.bodies, frozen.bodies); assert.equal(still.steps, frozen.steps); row.pauseFrozen = true;
    row.terminalDamage = !!row.damage && (!row.paused.player.alive || !row.paused.enemy.alive);
    if (row.terminalDamage) row.beforeRestart = row.paused;
    else {
      await page.locator('#btnResume').tap(); await wait(steps => game.state === 'fight' && game.combat.stepNo > steps, frozen.steps);
      row.resumed = await read(); policy(row.resumed, row); assert.deepEqual(row.resumed.objects, row.started.objects);
      assert.deepEqual(row.resumed.skins.meshes.map(m => m.uuid), row.paused.skins.meshes.map(m => m.uuid));
      if (row.damage) assert.equal(row.resumed.characterModel.controllers.find(c => c.role === 'enemy').status, 'fallback');
      row.beforeRestart = await pause(row);
    }
    await page.locator('#btnStart').tap();
    await wait(() => game.state === 'fight' && game.player.fightT > 0);
    if (row.tripo) await wait(() => characterProbe.read().characterModel.status === 'ready');
    await settledRender();
    row.restarted = await read(); policy(row.restarted, row);
    assert.deepEqual(row.restarted.physics, row.started.physics, 'Restart must retain the same combat settings');
    if (row.tripo) assert.equal(row.restarted.characterModel.controllers.find(c => c.role === 'enemy').status, 'ready');
    for (const key of Object.keys(row.restarted.objects)) assert.notEqual(row.restarted.objects[key], row.beforeRestart.objects[key]);
    assert.equal(row.restarted.player.wounds, 0); assert.equal(row.restarted.enemy.wounds, 0);
    assert.deepEqual(row.restarted.skins.resources, row.started.skins.resources, 'Attached skin resources must stay stable across restart');
    if (row.tripo) {
      assert(row.restarted.skins.meshes.every(m => !row.beforeRestart.skins.meshes.some(old => old.uuid === m.uuid)),
        'Restart must remove the previous fighter skin');
      assert.equal(row.restarted.characterModel.loads, row.started.characterModel.loads, 'Restart must reuse the loaded model asset');
      assert.equal(row.restarted.characterModel.disposals, row.beforeRestart.characterModel.disposals + 1,
        'Restart must dispose exactly the previous enemy controller');
    }
    row.renderResourceComparison = Object.fromEntries(['geometries', 'textures', 'programs'].map(key => [key,
      { first: row.started.render[key], restarted: row.restarted.render[key], delta: row.restarted.render[key] - row.started.render[key] }]));
    if (row.damage) {
      assert.equal(row.restarted.player.gun.ammo, 6); assert.equal(row.restarted.player.gun.shots, 0);
      await page.screenshot({ path: path.join(out, `${row.id}-fresh-sample-after-restart.png`) });
    } else await controls(row, 'restartInput');
    row.final = await pause(row);
    await drainFlow(row);
    row.native = await page.evaluate(() => characterProbe.native.slice());
    assert(row.native.length && row.native.every(event => event.trusted && event.kind === 'touch'));
    for (const id of ['btnStart', 'btnPause', 'btnResume']) assert(row.native.some(event => event.target === id));
    row.requestedArtifacts = compiled.slice(requestedBefore).map(item => item.name);
    assert.equal(row.requestedArtifacts.some(name => name === modelArtifact), row.tripo,
      'Ordinary entry must not fetch the optional asset; sample must fetch frozen GLB bytes');
    if (row.damage) {
      const transitions = row.final.transitions.filter(t => t.enemy === row.started.objects.enemy);
      const fallbackAt = transitions.findIndex(t => t.status === 'fallback'); assert(fallbackAt >= 0);
      assert(transitions.slice(fallbackAt).every(t => t.status === 'fallback'), 'Injured fighter must never return to the intact sample');
    }
    await cdp.detach(); cdp = null;
    console.log(JSON.stringify({ event: 'flow-complete', id: row.id, steps: row.final.steps, skins: row.final.skins.resources }));
  }
  assert(compiled.some(item => item.name === 'dist/index.html') && compiled.some(item => item.name.startsWith('dist/assets/main-')));
  assert(compiled.every(item => item.match)); assert.deepEqual(errors, []); pass = true;
} catch (error) {
  fatal = { name: error.name, message: clean(error.message), stack: clean(error.stack) }; process.exitCode = 1;
  if (page && !page.isClosed()) try {
    failureSnapshot = await page.evaluate(() => ({ state: window.characterProbe?.read(), native: window.characterProbe?.native.slice() }));
    await page.screenshot({ path: path.join(out, 'failure-scene.png') });
  } catch (snapshotError) { errors.push({ kind: 'failure-snapshot', message: clean(snapshotError.message) }); }
} finally {
  if (cdp) await cdp.detach().catch(() => {});
  try {
    if (page && !page.isClosed()) {
      await page.waitForLoadState('networkidle', { timeout: Math.max(100, Math.min(30000, budgetMs - (performance.now() - start))) });
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
    limits: ['Chromium mobile emulation; no physical-phone performance or human naturalness acceptance.',
      'Two longsword AI lifecycle flows use the same foe/weapon/stage. A separate six-shot maximum pistol versus longsword flow tests actual damage fallback. No deterministic RNG or physical equivalence claim.',
      'Trusted touch starts, moves, swings, pauses, resumes and restarts. Observers do not replace gameplay methods or alter bodies, AI, RNG or simulation time.',
      'Actual skinned scene meshes, finite bones, changed poses, physical sword rotation and body movement are required. Real revolver hits must expose enemy damage and one-way native visual fallback; no ammo, aim, hit, AI, clock or RNG writes. Damage/kill rates and melee injury probability are not assessed.',
      'Skin resource counts are compared at fresh starts; renderer counts are recorded separately because effects and shader caches may differ.',
      'Front screenshots are separate paused visual diagnostics with temporarily hidden UI, restored camera/UI state and unchanged physics. Gameplay shoulder views retain the ordinary camera and UI.',
      'Every served artifact must return 200 and byte-match the frozen build. One logged retry is allowed for GET 502/503; TLS verification and the configured public proxy remain enabled.',
      'Each paused flow drains tracked fetches and then requires 600ms of stable network idle before navigation, bounded to30s within the overall run budget. Errors are retained.',
      'Public execution requires passing local evidence from the exact same tool, source, generated GLB and build.'] };
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await fs.writeFile(path.join(out, 'manifest-after.json'), JSON.stringify(after, null, 2) + '\n');
  console.log(JSON.stringify({ pass, buildStable, sourceStable, flows: entries.length, wallMs: report.wallMs, fatal, out }));
}
