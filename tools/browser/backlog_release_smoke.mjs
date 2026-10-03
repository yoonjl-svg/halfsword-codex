// Local production and public delivery contracts using the compiled window.game.
// Usage: node tools/browser/backlog_release_smoke.mjs <base-url> <fresh-output-dir> [--plan-only]
// No source imports, synthetic wounds, AI replacement, or physical state injection.
import assert from 'node:assert/strict';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
const positional = [];
let planOnly = false;
for (const arg of process.argv.slice(2)) {
  if (arg === '--plan-only') { assert.equal(planOnly, false, 'Do not repeat --plan-only'); planOnly = true; }
  else if (arg.startsWith('-')) throw Error(`Unknown argument: ${arg}`);
  else positional.push(arg);
}
assert.ok(positional.length <= 2, 'Usage: <base-url> <fresh-output-dir> [--plan-only]');
const mode = planOnly ? 'plan-only' : 'full';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = new URL(positional[0] || process.env.HALFSWORD_TEST_URL || 'http://127.0.0.1:4191/');
assert.equal(base.username + base.password, '', 'Do not put credentials in the base URL');
base.search = ''; base.hash = '';
if (!base.pathname.endsWith('/')) base.pathname += '/';
const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
assert.ok(['http:', 'https:'].includes(base.protocol), 'Use an HTTP or HTTPS deployment URL');
assert.ok(local || (base.protocol === 'https:' && base.hostname === 'yoonjl-svg.github.io' && base.pathname === '/halfsword-codex/'), 'Use a local server or the independent repository Pages URL');
const out = positional[1] || process.env.HALFSWORD_EVIDENCE_DIR || '/tmp/halfsword-backlog-release';
await mkdir(out, { recursive: true });
try { await access(join(out, 'result.json')); throw Error('Use a fresh output directory'); }
catch (e) { if (e.code !== 'ENOENT') throw e; }
const launch = { executablePath: process.env.PW_CHROMIUM || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-background-networking', '--use-gl=angle', '--use-angle=swiftshader'] };
if (!local) {
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  assert.ok(proxy, 'Public verification requires the configured session proxy');
  const p = new URL(proxy);
  launch.proxy = { server: `${p.protocol}//${p.host}` };
}
// Certificate verification remains enabled, including when a proxy is used.
const startedAt = new Date(), rows = [], errors = [], httpFailures = [], requestFailures = [], blockedRequests = [];
const ids = [
  'playStanceLegacy', 'playStanceFresh',
  'playCorrectionSabreWeak', 'playCorrectionSabreNone', 'playCorrectionZweiWeak', 'playCorrectionZweiNone',
  'playMobileLegacy', 'playMobileVertical',
  'playEdgeSabreLegacy', 'playEdgeSabreContinuous', 'playEdgeZweiLegacy', 'playEdgeZweiContinuous',
];
const pairs = [
  ['playStanceLegacy', 'playStanceFresh', 'stanceTrial', 'legacy', 'fresh'],
  ['playCorrectionSabreWeak', 'playCorrectionSabreNone', 'targetCorrection', 'weak', 'none'],
  ['playCorrectionZweiWeak', 'playCorrectionZweiNone', 'targetCorrection', 'weak', 'none'],
  ['playMobileLegacy', 'playMobileVertical', 'mobileVerticalGain', '1', '1.35'],
  ['playEdgeSabreLegacy', 'playEdgeSabreContinuous', 'edgeTrial', 'legacy', 'continuous'],
  ['playEdgeZweiLegacy', 'playEdgeZweiContinuous', 'edgeTrial', 'legacy', 'continuous'],
];
const portrait = { width: 390, height: 844 }, landscape = { width: 844, height: 390 };
let browser, context, page, pass = false, fatal = null, current = 'setup', links;
const confined = value => {
  const url = new URL(value);
  return ['data:', 'blob:'].includes(url.protocol) || (url.origin === base.origin && url.pathname.startsWith(base.pathname));
};
const layout = () => page.evaluate(() => ({
  width: innerWidth, height: innerHeight, scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  menuVisible: document.getElementById('menu')?.classList.contains('show') || false,
  rotateVisible: !!document.getElementById('rotate')?.getClientRects().length,
}));
const fit = value => assert.ok(value.scrollWidth <= value.width + 1, `Horizontal overflow at ${current}`);
async function ready() {
  await page.waitForFunction(() => window.game?.player?.sword && window.game?.input, null, { timeout: 60000 });
  const modules = await page.locator('script[type="module"][src]').evaluateAll(nodes => nodes.map(node => node.src));
  assert.ok(modules.some(url => /\/assets\/[^/]+\.js(?:$|\?)/.test(url)), 'Use the compiled production build for delivery verification');
  assert.ok(modules.every(url => !new URL(url).pathname.startsWith('/src/')), 'A development source entry cannot establish production delivery');
}
const snap = () => page.evaluate(() => {
  const g = window.game, p = g.player, e = g.enemy, i = g.input;
  const finite = f => [...Object.values(f.bodies), f.sword].every(b => [b.translation(), b.rotation(), b.linvel(), b.angvel()].every(v => Object.values(v).every(Number.isFinite)));
  const record = f => ({ level: f.skill.level, autoGuard: f.skill.autoGuard, arm: f.armTorqueModel,
    edge: f.edgeTorqueModel ?? 'legacy', edgeOwn: Object.hasOwn(f, 'edgeTorqueModel'),
    recovery: f.armRecoveryModel ?? 'legacy', recoveryOwn: Object.hasOwn(f, 'armRecoveryModel') });
  return { url: location.href, state: g.state, simTime: g.stats.simTime, weapon: p.weapon.id, foeWeapon: e.weapon.id,
    player: record(p), enemy: record(e), alive: p.alive, difficulty: g.ai.levelName,
    cut: g.combat.cutReactionModel, cutTrial: g.cutTrial, stance: g.stanceTrial, stanceMemory: g.config.GAIT.stanceMemory,
    correction: g.targetCorrectionTrial, edge: g.edgeTorqueTrial, recovery: g.armRecoveryTrial, physical: g.physicalTrial,
    support: g.config.BODY.supportModel, grip: g.config.GRIP.reactionModel,
    inputComparison: g.inputComparison, input: { gain: i.mobileIntent.verticalGain, source: i.mobileIntent.source, enabled: i.enabled,
      activeTouch: i.activeTouch, pending: { x: i.handDX, y: i.handDY } },
    held: p.handHeld, inputActive: p.inputActive, handOffset: p.handOffset.toArray(), thrusts: p.skill.thrusts,
    saved: JSON.parse(localStorage.getItem('gladiator-settings')), settings: { skill: g.settings.skill, difficulty: g.settings.difficulty },
    ui: Object.fromEntries(['skill', 'difficulty'].map(k => [k, { selected: document.querySelector(`[data-setting=${k}] button.on`)?.dataset.v,
      locked: [...document.querySelectorAll(`[data-setting=${k}] button`)].every(b => b.disabled) }])),
    info: Object.fromEntries(['stanceTrialInfo', 'targetCorrectionTrialInfo', 'edgeTorqueTrialInfo', 'mobileIntentInfo', 'cutTrialInfo', 'armRecoveryTrialInfo', 'physicalTrialInfo'].map(id => [id, document.getElementById(id)?.textContent || ''])),
    finite: finite(p) && finite(e), first: window.backlogProbe ? { controllers: window.backlogProbe.controllers, worlds: window.backlogProbe.worlds } : null,
  };
});
function expected(url) {
  const q = new URL(url).searchParams, vertical = q.get('inputComparison') === 'vertical';
  const target = ['none', 'weak'].includes(q.get('targetCorrection')) && !vertical ? q.get('targetCorrection') : null;
  const edgeActive = ['legacy', 'continuous'].includes(q.get('edgeTrial'));
  return { weapon: q.get('weapon') || 'sabre', foeWeapon: q.get('foeWeapon') || 'longsword',
    stance: q.get('stanceTrial') === 'fresh' ? 'fresh' : 'legacy', stanceActive: ['legacy', 'fresh'].includes(q.get('stanceTrial')),
    target, vertical, level: vertical || target === 'none' ? 0 : target === 'weak' ? .4 : .7,
    autoGuard: target !== 'none', difficulty: vertical || target ? 'normal' : 'hard',
    edge: q.get('edgeTrial') === 'continuous' ? 'planePotential' : 'legacy', edgeActive,
    gain: ['1', '1.35'].includes(q.get('mobileVerticalGain')) ? Number(q.get('mobileVerticalGain')) : 1,
    cutWithdrawn: q.get('cutTrial') === 'budgeted', recoveryPending: ['legacy', 'independent'].includes(q.get('armRecoveryTrial')),
    supportWithdrawn: q.get('physicsTrial') === 'support' };
}
function contract(s, want) {
  assert.equal(s.saved.skill, '0.7'); assert.equal(s.saved.difficulty, 'hard');
  assert.deepEqual(s.settings, { skill: '0.7', difficulty: 'hard' });
  for (const key of ['stanceTrial', 'targetCorrection', 'mobileVerticalGain', 'edgeTrial', 'armRecoveryTrial', 'armRecoveryModel', 'cutTrial']) assert.equal(Object.hasOwn(s.saved, key), false, `Trial persisted: ${key}`);
  assert.equal(s.weapon, want.weapon); assert.equal(s.foeWeapon, want.foeWeapon); assert.equal(s.player.level, want.level);
  assert.equal(s.player.autoGuard, want.autoGuard); assert.equal(s.difficulty, want.difficulty);
  assert.equal(s.enemy.level, want.difficulty === 'hard' ? .85 : .7);
  assert.equal(s.player.arm, 'legacy'); assert.equal(s.enemy.arm, 'legacy'); assert.equal(s.cut, 'legacy');
  assert.equal(s.stance.model, want.stance); assert.equal(s.stance.active, want.stanceActive); assert.equal(s.stanceMemory, want.stance);
  assert.equal(s.correction.active, !!want.target); assert.equal(s.correction.model, want.target || 'legacy');
  assert.equal(s.inputComparison, want.vertical); assert.equal(s.input.gain, want.gain);
  assert.equal(s.edge.active, want.edgeActive); assert.equal(s.player.edge, want.edge); assert.equal(s.player.edgeOwn, want.edgeActive);
  assert.equal(s.enemy.edge, 'legacy'); assert.equal(s.enemy.edgeOwn, false);
  assert.equal(s.player.recovery, 'legacy'); assert.equal(s.player.recoveryOwn, false); assert.equal(s.enemy.recovery, 'legacy');
  assert.equal(s.support, 'legacy'); assert.equal(s.grip, 'paired'); assert.ok(s.finite);
  const locked = want.vertical || !!want.target;
  assert.equal(s.ui.skill.locked, locked); assert.equal(s.ui.difficulty.locked, locked);
  assert.equal(s.ui.skill.selected, String(want.level)); assert.equal(s.ui.difficulty.selected, want.difficulty);
  if (want.stanceActive) assert.ok(s.info.stanceTrialInfo.includes('기립 비교'));
  if (want.target) assert.ok(s.info.targetCorrectionTrialInfo.includes('비교 후보'));
  if (want.vertical) assert.ok(s.info.mobileIntentInfo.includes('보정 끔'));
  if (want.edgeActive) assert.ok(s.info.edgeTorqueTrialInfo.includes('날 정렬 비교'));
  if (want.cutWithdrawn) {
    assert.equal(s.cutTrial.withdrawn, true); assert.equal(s.cutTrial.active, false); assert.equal(s.cutTrial.model, 'legacy');
    assert.ok(s.info.cutTrialInfo.includes('철회'));
  }
  if (want.recoveryPending) {
    assert.equal(s.recovery.pending, true); assert.equal(s.recovery.active, false); assert.equal(s.recovery.model, 'legacy');
    assert.ok(s.info.armRecoveryTrialInfo.length > 0);
  }
  if (want.supportWithdrawn) {
    assert.equal(s.physical.withdrawn, true); assert.equal(s.physical.active, false); assert.equal(s.physical.supportModel, 'legacy');
    assert.ok(s.info.physicalTrialInfo.includes('철회'));
  }
}
// Observe existing methods. Every original call runs exactly once; native events
// keep their ordinary path and no controller, AI, or physical value is replaced.
async function install() {
  await page.evaluate(() => {
    const g = window.game, probe = window.backlogProbe = { controllers: [], worlds: [], consumed: [], moves: [], native: [] };
    const players = new WeakSet(), worlds = new WeakSet();
    const record = () => ({ level: game.player.skill.level, autoGuard: game.player.skill.autoGuard, difficulty: game.ai.levelName,
      stance: game.config.GAIT.stanceMemory, edge: game.player.edgeTorqueModel ?? 'legacy', recovery: game.player.armRecoveryModel ?? 'legacy',
      cut: game.combat.cutReactionModel, gain: game.input.mobileIntent.verticalGain, simTime: game.stats.simTime });
    const fp = Object.getPrototypeOf(g.player), originalFighter = fp.step;
    fp.step = function (...args) { if (this === game.player && !players.has(this)) { players.add(this); probe.controllers.push(record()); } return originalFighter.apply(this, args); };
    const wp = Object.getPrototypeOf(g.world), originalWorld = wp.step;
    wp.step = function (...args) { if (this === game.world && !worlds.has(this)) { worlds.add(this); probe.worlds.push(record()); } return originalWorld.apply(this, args); };
    const input = g.input, consume = input.consumeHandDelta, onMove = input.onMove;
    input.consumeHandDelta = function (...args) { const d = consume.apply(this, args); if (d.x || d.y) probe.consumed.push({ ...d, simTime: game.stats.simTime }); return d; };
    input.onMove = function (e) { const pre = { x: this.handDX, y: this.handDY }; const result = onMove.call(this, e);
      if (e.pointerType === 'touch' && this.enabled && e.pointerId === this.activeTouch) probe.moves.push({ pre, post: { x: this.handDX, y: this.handDY }, x: e.clientX, y: e.clientY }); return result; };
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) document.addEventListener(type, e => {
      if (e.target === document.getElementById('game')) probe.native.push({ type, trusted: e.isTrusted, pointerType: e.pointerType, x: e.clientX, y: e.clientY });
    }, true);
    probe.originalRound = { player: g.player, enemy: g.enemy, world: g.world, combat: g.combat };
  });
}
function firstContract(s, want, count) {
  assert.equal(s.first.controllers.length, count); assert.equal(s.first.worlds.length, count);
  for (const f of [...s.first.controllers, ...s.first.worlds]) {
    assert.equal(f.level, want.level); assert.equal(f.autoGuard, want.autoGuard); assert.equal(f.difficulty, want.difficulty);
    assert.equal(f.stance, want.stance); assert.equal(f.edge, want.edge); assert.equal(f.recovery, 'legacy'); assert.equal(f.cut, 'legacy'); assert.equal(f.gain, want.gain);
  }
}
async function start() {
  await page.locator('#btnStart').tap();
  await page.waitForFunction(() => game.state === 'fight' && backlogProbe.worlds.length > 0, null, { timeout: 60000 });
  const from = await page.evaluate(() => game.stats.simTime);
  await page.waitForFunction(from => game.stats.simTime > from + .15, from, { timeout: 60000 });
}
async function gestures(want) {
  const cdp = await context.newCDPSession(page), point = (x, y) => [{ x, y, id: 1 }];
  const send = (type, touchPoints, timestamp) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints, timestamp });
  try {
    const beforeTap = await snap(), stamp = Date.now() / 1000;
    await send('touchStart', point(620, 170), stamp); await send('touchEnd', [], stamp + .07);
    await page.waitForFunction(n => game.player.skill.thrusts === n + 1, beforeTap.thrusts, { timeout: 60000 });
    const tap = await snap(); await page.waitForFunction(() => !game.player.skill.tap, null, { timeout: 60000 });
    await page.evaluate(() => { backlogProbe.consumed = []; backlogProbe.moves = []; backlogProbe.native = []; });
    const before = await snap(), t = Date.now() / 1000;
    await send('touchStart', point(620, 170), t); await page.waitForFunction(() => game.player.handHeld);
    for (let n = 1; n <= 4; n++) { await send('touchMove', point(620 + 6 * n, 170 - 6 * n), t + n * .06); await page.waitForTimeout(60); }
    const drag = await snap(); await send('touchEnd', [], t + .30); await page.waitForFunction(() => !game.player.handHeld && game.input.activeTouch === null);
    const released = await snap(), t2 = Date.now() / 1000;
    await send('touchStart', point(644, 146), t2); await page.waitForFunction(() => game.player.handHeld);
    for (let n = 1; n <= 3; n++) { await send('touchMove', point(644 - 4 * n, 146 + 4 * n), t2 + n * .06); await page.waitForTimeout(60); }
    const reinput = await snap(); await send('touchEnd', [], t2 + .25);
    await page.waitForFunction(from => !game.player.handHeld && game.input.activeTouch === null && game.stats.simTime > from + .15, reinput.simTime, { timeout: 60000 });
    const final = await snap(), trace = await page.evaluate(() => ({ consumed: backlogProbe.consumed, moves: backlogProbe.moves, native: backlogProbe.native, height: innerHeight }));
    assert.ok(drag.held && reinput.held && !released.held && !final.held); assert.equal(final.thrusts, before.thrusts);
    assert.ok(final.simTime > before.simTime && final.finite); assert.ok(Math.hypot(...drag.handOffset.map((v, n) => v - before.handOffset[n])) > 1e-5);
    assert.equal(trace.moves.length, 7); assert.ok(trace.native.length >= 11 && trace.native.every(e => e.trusted && e.pointerType === 'touch'));
    const total = trace.consumed.reduce((s, d) => ({ x: s.x + d.x, y: s.y + d.y }), { ...final.input.pending });
    assert.ok(Math.abs(total.x - 12 * 2.6 / Math.max(320, trace.height)) < 1e-6, 'Actual consumed X input differs from native drag');
    assert.ok(Math.abs(total.y - 12 * 2.6 / Math.max(320, trace.height) * want.gain) < 1e-6, 'Actual consumed Y input differs from selected gain');
    return { beforeTap, tap, before, drag, released, reinput, final, trace };
  } finally { await cdp.detach(); }
}
async function exercise(row, want) {
  await ready(); row.portrait = await layout(); fit(row.portrait); assert.ok(row.portrait.menuVisible);
  row.menu = await snap(); contract(row.menu, want);
  await page.setViewportSize(landscape); row.landscape = await layout(); fit(row.landscape);
  await page.locator('[data-setting=trail]').tap(); row.afterPreferenceToggle = await snap(); contract(row.afterPreferenceToggle, want);
  assert.notEqual(row.afterPreferenceToggle.saved.trail, row.menu.saved.trail);
  await install(); await start(); row.started = await snap(); contract(row.started, want); firstContract(row.started, want, 1);
  row.touch = await gestures(want); contract(row.touch.final, want);
  await page.setViewportSize(portrait); row.playPortrait = await layout(); fit(row.playPortrait); assert.ok(row.playPortrait.rotateVisible);
  await page.setViewportSize(landscape); await page.locator('#btnPause').tap(); await page.waitForFunction(() => game.state === 'paused');
  await start(); row.restarted = await snap(); contract(row.restarted, want); firstContract(row.restarted, want, 2);
  row.newObjects = await page.evaluate(() => Object.fromEntries(['player', 'enemy', 'world', 'combat'].map(k => [k, game[k] !== backlogProbe.originalRound[k]])));
  assert.ok(Object.values(row.newObjects).every(Boolean), 'Restart did not create a new game round');
  await page.screenshot({ path: join(out, `${row.id}-landscape.png`) });
  await page.reload({ waitUntil: 'networkidle' }); await ready(); row.reloadMenu = await snap(); contract(row.reloadMenu, want);
  await install(); await start(); row.reloaded = await snap(); contract(row.reloaded, want); firstContract(row.reloaded, want, 1);
  // Return in the same browser context: comparison settings must not become saved defaults.
  const ordinary = new URL(base); ordinary.search = 'weapon=sabre&foeWeapon=longsword&foe=default';
  await page.goto(ordinary.href, { waitUntil: 'networkidle' }); await ready(); row.generalReturn = await snap(); contract(row.generalReturn, expected(ordinary));
  assert.equal(row.generalReturn.correction.active, false); assert.equal(row.generalReturn.edge.active, false);
  assert.equal(row.generalReturn.stance.active, false); assert.equal(row.generalReturn.recovery.active, false);
}
function ordinaryDefaults(s) {
  assert.equal(s.saved.skill, '0.7'); assert.equal(s.saved.difficulty, 'hard');
  assert.deepEqual(s.settings, { skill: '0.7', difficulty: 'hard' });
  assert.equal(s.player.level, .7); assert.equal(s.player.autoGuard, true); assert.ok(s.finite);
  assert.equal(s.correction.active, false); assert.equal(s.edge.active, false); assert.equal(s.recovery.active, false);
  assert.equal(s.stance.active, false); assert.equal(s.stanceMemory, 'legacy'); assert.equal(s.support, 'legacy');
  assert.equal(s.player.edge, 'legacy'); assert.equal(s.player.recovery, 'legacy'); assert.equal(s.cut, 'legacy');
  assert.equal(s.input.gain, 1); assert.equal(s.inputComparison, false); assert.equal(s.ui.skill.locked, false);
}
async function chooseCard(index) {
  await page.locator('#btnStart').tap();
  await page.waitForFunction(() => game.state === 'draw' && game.draw.stage === 'choose' && game.draw.t >= 1, null, { timeout: 60000 });
  assert.equal(await page.locator('#draw button.wcard').count(), 2, 'Ordinary entry must offer two player cards');
  const before = await page.evaluate(() => ({ state: game.state, ids: [...game.draw.ids], pick: game.draw.pick }));
  const bounds = await page.locator(`#draw button[data-i="${index}"]`).boundingBox();
  assert.ok(bounds && bounds.width > 0 && bounds.height > 0, 'The player card is not visible');
  await page.locator(`#draw button[data-i="${index}"]`).tap();
  await page.waitForFunction(index => game.draw.pick === index, index);
  await page.waitForFunction(() => game.state === 'fight', null, { timeout: 60000 });
  const from = await page.evaluate(() => game.stats.simTime);
  await page.waitForFunction(from => game.stats.simTime > from + .35, from, { timeout: 60000 });
  const after = await snap(); ordinaryDefaults(after);
  assert.equal(after.weapon, before.ids[index], 'The fight did not use the actually tapped card');
  return { index, before, bounds, after };
}
async function checkDevelopmentPlan() {
  current = 'development-plan'; await page.setViewportSize(portrait);
  await page.goto(new URL('development-plan.html', base).href, { waitUntil: 'networkidle' });
  const plan = { id: current, kind: 'development-plan', portrait: await layout(), characters: (await page.locator('main').innerText()).length,
    headings: await page.locator('main h2').allTextContents(), ledgerLinks: await page.locator('a[href*="DELIVERY_BACKLOG"]').evaluateAll(nodes => nodes.map(a => ({ text: a.textContent, href: a.href }))) };
  rows.push(plan);
  fit(plan.portrait); assert.ok(plan.characters > 1000);
  for (const title of ['중장기 방향', '24시간 작업표', '비용과 실험 규칙', '사용자 무응답·중단·승인 처리', '실제 실행 대장 · 복원 전 연구·전달 역사', '다음 승인 작업 · 재개 위치']) assert.ok(plan.headings.includes(title), `Development plan section missing: ${title}`);
  assert.ok(plan.ledgerLinks.some(a => a.href === 'https://github.com/yoonjl-svg/halfsword-codex/blob/main/docs/codex_team/DELIVERY_BACKLOG_20261003.md'), 'Development plan has no independent-repository delivery ledger link');
  await page.screenshot({ path: join(out, 'development-plan-portrait.png'), fullPage: true });
  await page.setViewportSize(landscape); plan.landscape = await layout(); fit(plan.landscape);
  await page.screenshot({ path: join(out, 'development-plan-landscape.png'), fullPage: true });
  plan.pass = true;
}
try {
  browser = await chromium.launch(launch);
  context = await browser.newContext({ viewport: portrait, isMobile: true, hasTouch: true });
  context.setDefaultTimeout(60000);
  await context.route('**/*', async route => {
    if (confined(route.request().url())) return route.continue();
    blockedRequests.push({ id: current, url: route.request().url() }); return route.abort('blockedbyclient');
  });
  page = await context.newPage();
  page.on('pageerror', e => errors.push({ id: current, type: 'pageerror', message: String(e) }));
  page.on('console', m => { if (m.type() === 'error') errors.push({ id: current, type: 'console', message: m.text() }); });
  page.on('response', r => { if (r.status() >= 400) httpFailures.push({ id: current, status: r.status(), url: r.url() }); });
  page.on('requestfailed', r => requestFailures.push({ id: current, url: r.url(), error: r.failure()?.errorText }));
  if (!planOnly) {
  const lab = new URL('feature-lab.html', base);
  await page.goto(lab.href, { waitUntil: 'networkidle' }); fit(await layout());
  links = await page.evaluate(ids => Object.fromEntries(ids.map(id => [id, document.getElementById(id)?.href || null])), ids);
  assert.equal(Object.values(links).filter(Boolean).length, 12, 'Expected all 12 delivery comparison CTAs');
  assert.equal(await page.locator('a[href*="cutTrial=budgeted"], a[href*="armRecoveryTrial=independent"], a[href*="physicsTrial=support"]').count(), 0, 'Withdrawn or pending candidate still has a trial CTA');
  for (const [aID, bID, parameter, aValue, bValue] of pairs) {
    const a = new URL(links[aID]), b = new URL(links[bID]); assert.ok(confined(a) && confined(b));
    assert.equal(a.searchParams.get(parameter), aValue); assert.equal(b.searchParams.get(parameter), bValue);
    a.searchParams.delete(parameter); b.searchParams.delete(parameter); assert.equal(a.href, b.href, `${aID}/${bID} differ in more than the intended option`);
  }
  await page.evaluate(() => localStorage.setItem('gladiator-settings', JSON.stringify({ skill: '0.7', difficulty: 'hard', moveMode: 'stick', sound: false, trail: false })));
  await page.screenshot({ path: join(out, 'feature-lab-portrait.png'), fullPage: true });
  for (const id of ids) {
    current = id; await page.setViewportSize(portrait); await page.goto(lab.href, { waitUntil: 'networkidle' }); fit(await layout());
    const row = { id, kind: 'actual-feature-lab-CTA', url: links[id] }; rows.push(row);
    await Promise.all([page.waitForURL(links[id], { waitUntil: 'networkidle' }), page.locator(`#${id}`).tap()]);
    assert.equal(page.url(), links[id]); await exercise(row, expected(links[id])); row.pass = true;
  }
  for (const [id, option] of [['oldCutBudgeted', 'cutTrial=budgeted'], ['oldArmIndependent', 'armRecoveryTrial=independent'], ['oldSupportWithdrawn', 'physicsTrial=support']]) {
    current = id; const url = new URL(base); url.search = `weapon=sabre&foeWeapon=longsword&foe=default&${option}`;
    await page.setViewportSize(portrait); await page.goto(url.href, { waitUntil: 'networkidle' });
    const row = { id, kind: 'old-URL-fallback', url: url.href }; rows.push(row); await exercise(row, expected(url)); row.pass = true;
  }
  current = 'ordinary-root-card-entry'; await page.setViewportSize(portrait);
  await page.goto(base.href, { waitUntil: 'networkidle' }); await ready();
  const ordinaryRow = { id: current, url: page.url(), portrait: await layout(), menu: await snap() }; rows.push(ordinaryRow);
  assert.equal(new URL(ordinaryRow.url).search, '', 'Ordinary entry must use the root URL without a weapon override');
  fit(ordinaryRow.portrait); ordinaryDefaults(ordinaryRow.menu); assert.ok(ordinaryRow.portrait.menuVisible);
  await page.setViewportSize(landscape); fit(await layout()); await install(); ordinaryRow.firstChoice = await chooseCard(0);
  await page.screenshot({ path: join(out, 'ordinary-root-card-entry-landscape.png') });
  await page.evaluate(() => { backlogProbe.restartReference = { player: game.player, enemy: game.enemy, world: game.world, combat: game.combat }; });
  await page.locator('#btnPause').tap(); await page.waitForFunction(() => game.state === 'paused');
  ordinaryRow.secondChoice = await chooseCard(1);
  ordinaryRow.newObjects = await page.evaluate(() => Object.fromEntries(['player', 'enemy', 'world', 'combat'].map(k => [k, game[k] !== backlogProbe.restartReference[k]])));
  assert.ok(Object.values(ordinaryRow.newObjects).every(Boolean)); ordinaryRow.pass = true;
  }
  await checkDevelopmentPlan();
  assert.deepEqual(blockedRequests, []); assert.deepEqual(httpFailures, []); assert.deepEqual(requestFailures, []); assert.deepEqual(errors, []);
  pass = true;
} catch (e) { fatal = { id: current, name: e.name, message: e.message, stack: e.stack }; process.exitCode = 1; }
finally {
  if (!pass && page) { try { await page.screenshot({ path: join(out, 'failure.png'), fullPage: true }); } catch {} }
  const finishedAt = new Date();
  await writeFile(join(out, 'result.json'), JSON.stringify({ pass, mode, base: base.href, publicHTTPS: !local,
    startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), wallSeconds: (finishedAt - startedAt) / 1000,
    expectedCTAIds: planOnly ? [] : ids, links, rows, errors, httpFailures, requestFailures, blockedRequests, fatal,
    scope: planOnly
      ? 'Development plan only: actual body length, six current core section titles, independent-repository delivery ledger href, portrait/landscape overflow, and browser/network errors. No game, input, combat, audio, or public-byte checks are performed in this mode.'
      : 'Compiled-game mobile entry, native input mapping, first-step selection, restart/reload, ordinary preference return, withdrawn/pending URL fallbacks, and development plan. AI and normal combat remain active; no device-performance, long-combat efficacy, or human-feel claim. Public bytes and audio routing are separate checks.' }, null, 2) + '\n');
  if (browser) await browser.close();
  console.log(JSON.stringify({ pass, mode, rows: rows.length, failure: fatal?.id || null, out }));
}
