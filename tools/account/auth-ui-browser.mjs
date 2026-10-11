import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'vite';

// Local fixture only: real mount/controller/hub/growth modules, mocked auth transport.
// The unconfigured branch uses the real createTransport with empty test credentials.
const repo = fileURLToPath(new URL('../../', import.meta.url));
const out = path.resolve(process.argv[2] || '/tmp/halfsword-auth-ui-browser');
assert(out.startsWith('/tmp/'), 'Write fixture build and evidence outside the repository');
await fs.mkdir(out, { recursive: true });
const fixture = await fs.mkdtemp(path.join(out, 'fixture-'));
const built = path.join(fixture, 'dist');
const transportPath = path.join(fixture, 'transport.js');
const mountPath = path.join(repo, 'src/account/mount.js');
const actualTransport = path.join(repo, 'src/account/supabase.js');
const sourceHashes = {};
for (const name of ['mount.js', 'controller.js', 'profile.js', 'supabase.js', 'auth-ui.css', 'hub.js', 'hub.css', 'growth-panel.js']) {
  sourceHashes[name] = createHash('sha256').update(await fs.readFile(path.join(repo, 'src/account', name))).digest('hex');
}
await fs.writeFile(transportPath, `
import { createTransport as realTransport } from ${JSON.stringify(actualTransport)};
export function createTransport(config) {
  if (!new URLSearchParams(location.search).has('mock')) return realTransport({ ...config, url: '', publishableKey: '' });
  let user = { id: 'fixture-guest', is_anonymous: true }, callback, pendingSend;
  const profiles = new Map();
  const f = window.authFixture = { calls: [], holdSend: false, rejectSend: false,
    releaseSend(fail = false) { const pending = pendingSend; pendingSend = null; if (fail) pending.reject(Error('fixture send rejected')); else pending.resolve(); }
  };
  return {
    client: { auth: { onAuthStateChange(fn) { callback = fn; } } },
    session: async () => user,
    guest: async () => user,
    load: async id => profiles.get(id) || null,
    save: async (revision, profile, id) => { const result = { ...structuredClone(profile), revision: revision + 1 }; profiles.set(id, result); return result; },
    sendCode: async (email, mode) => {
      f.calls.push({ method: 'sendCode', email, mode });
      if (f.holdSend) { f.holdSend = false; await new Promise((resolve, reject) => { pendingSend = { resolve, reject }; }); }
      if (f.rejectSend) { f.rejectSend = false; throw Error('fixture send rejected'); }
    },
    verify: async (email, token, mode) => {
      f.calls.push({ method: 'verify', email, token, mode });
      if (token !== '123456') throw Error('fixture invalid OTP');
      user = { id: mode === 'link' ? user.id : 'fixture-restored', is_anonymous: false };
      callback?.('SIGNED_IN', { user }); return user;
    },
    signOut: async () => { f.calls.push({ method: 'signOut' }); user = null; callback?.('SIGNED_OUT', null); }
  };
}
`);
await fs.writeFile(path.join(fixture, 'index.html'), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local auth UI fixture</title><style>body{margin:0;background:#0b100d;color:#eee}#menu{padding:12px;box-sizing:border-box}.card{max-width:960px;margin:auto}button{cursor:pointer}</style></head><body><div id="menu" class="show"><div class="card"><h1 id="menuTitle">적막</h1><p id="menuSub">로컬 인증 화면 검사</p><div class="row">설정</div><div id="howto"></div><div class="actions"><button id="btnStart">시작</button></div></div></div><script type="module" src="./entry.js"></script></body></html>`);
await fs.writeFile(path.join(fixture, 'entry.js'), `
import { mountAccount } from ${JSON.stringify(mountPath)};
import { DEFAULT_SETTINGS } from ${JSON.stringify(path.join(repo, 'src/account/profile.js'))};
let settings = { ...DEFAULT_SETTINGS }, listener;
window.testUI = { ready: false, fights: 0, changeSettings(patch) { settings = { ...settings, ...patch }; listener(settings); } };
document.querySelector('#btnStart').onclick = () => window.testUI.fights++;
await mountAccount({ read: () => settings, canApply: () => true, apply(value) { settings = value; }, subscribe(fn) { listener = fn; }, growth: { connect() {} } });
document.querySelector('[data-account]').click(); window.testUI.ready = true;
`);
await build({
  configFile: false, root: fixture, base: './', logLevel: 'error', publicDir: false,
  plugins: [{ name: 'local-auth-transport-fixture', enforce: 'pre', resolveId(source, importer) {
    if (source === './supabase.js' && importer === mountPath) return transportPath;
  } }],
  build: { outDir: built, emptyOutDir: true, target: 'esnext' },
});
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer(async (request, response) => {
  try {
    const relative = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const file = path.resolve(built, '.' + (relative === '/' ? '/index.html' : relative));
    if (!file.startsWith(built + path.sep)) throw Error('Outside fixture');
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    response.end(await fs.readFile(file));
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const checks = [], errors = [], authCalls = [];
let activePage;
async function open(mock = false) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.route('**/*', async route => {
    if (new URL(route.request().url()).origin !== new URL(base).origin) { errors.push('Unexpected external request'); await route.abort(); }
    else await route.continue();
  });
  const page = await context.newPage(); activePage = page;
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.goto(base + (mock ? '?mock=1' : ''));
  await page.waitForFunction(() => window.testUI?.ready);
  return { context, page };
}
async function waitIdle(page) { await page.waitForFunction(() => !document.querySelector('[data-login]').disabled); }
async function messageContains(page, fragment) { await page.waitForFunction(text => document.querySelector('[data-message]').textContent.includes(text), fragment); }
try {
  {
    const { context, page } = await open();
    assert(await page.locator('[data-login]').isDisabled());
    assert(await page.locator('[data-link]').isDisabled());
    assert.match(await page.locator('[data-availability]').innerText(), /준비 중/);
    assert.equal(await page.locator('[data-message]').innerText(), '');
    await page.locator('[name=nickname]').fill('작성 중인 이름');
    await page.locator('#hs-auth-heading').click();
    await page.evaluate(() => window.testUI.changeSettings({ sound: false }));
    assert.equal(await page.locator('[name=nickname]').inputValue(), '작성 중인 이름');
    await page.locator('[data-profile] button').click();
    assert.equal(await page.locator('.hs-auth [data-name]').innerText(), '작성 중인 이름');
    await page.reload(); await page.waitForFunction(() => window.testUI?.ready);
    assert.equal(await page.locator('[name=nickname]').inputValue(), '작성 중인 이름');
    await page.setViewportSize({ width: 320, height: 700 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No 320px overflow');
    await page.screenshot({ path: path.join(out, 'unconfigured-320.png'), fullPage: true });
    await page.locator('[data-guest-continue]').click();
    assert.equal(await page.locator('.hs-hub').getAttribute('data-current-page'), 'journey');
    assert.equal(await page.evaluate(() => window.testUI.fights), 0);
    checks.push('Real unconfigured transport: disabled auth, no sent/success claim, 320px fit, guest exit without fight', 'Nickname survives blurred background render and persists after explicit save');
    await context.close();
  }
  {
    const { context, page } = await open(true);
    await waitIdle(page); assert(await page.locator('[data-link]').isEnabled());
    await page.locator('[data-link]').click();
    await page.locator('[name=email]').fill('traveler@example.com');
    await page.locator('[name=nickname]').fill('입력 유지');
    await page.locator('#hs-auth-heading').click();
    await page.evaluate(() => { window.testUI.changeSettings({ sound: false }); window.authFixture.holdSend = true; });
    assert.equal(await page.locator('[name=email]').inputValue(), 'traveler@example.com');
    assert.equal(await page.locator('[name=nickname]').inputValue(), '입력 유지');
    await page.locator('[data-send]').click();
    await page.evaluate(() => document.querySelector('[data-email]').requestSubmit());
    assert.equal(await page.evaluate(() => window.authFixture.calls.length), 1, 'Repeated submission while busy does not send twice');
    await page.locator('[data-auth-cancel]').click();
    assert(await page.locator('[data-auth-step]').isHidden());
    await page.evaluate(() => window.authFixture.releaseSend()); await waitIdle(page);
    assert(await page.locator('[data-code]').isHidden(), 'Canceled send does not reopen OTP');
    assert.equal(await page.locator('[data-message]').innerText(), '');
    await page.locator('[data-login]').click();
    assert.equal(await page.locator('[name=email]').inputValue(), 'traveler@example.com');
    assert(await page.locator('[data-send]').isDisabled(), 'Cancel/reopen preserves cooldown');
    await page.clock.fastForward(31000); assert(await page.locator('[data-send]').isEnabled());
    await page.locator('[data-send]').click(); await page.locator('[data-code]').waitFor({ state: 'visible' });
    assert(await page.locator('[data-resend]').isDisabled());
    await page.locator('[data-auth-cancel]').click(); assert(await page.locator('[data-code]').isHidden());
    await page.locator('[data-login]').click(); await page.clock.fastForward(31000);
    await page.locator('[data-send]').click(); await page.locator('[data-code]').waitFor({ state: 'visible' });
    await page.locator('[data-auth-back]').click();
    assert(await page.locator('[data-email]').isVisible()); assert(await page.locator('[data-code]').isHidden());
    assert.equal(await page.locator('[name=email]').inputValue(), 'traveler@example.com');
    await page.clock.fastForward(31000); await page.locator('[data-send]').click();
    await page.locator('[data-code]').waitFor({ state: 'visible' });
    const beforeResend = await page.evaluate(() => window.authFixture.calls.length);
    await page.clock.fastForward(31000); await page.locator('[data-resend]').click(); await waitIdle(page);
    assert.equal(await page.evaluate(() => window.authFixture.calls.length), beforeResend + 1);
    assert(await page.locator('[data-resend]').isDisabled());
    await page.locator('[name=code]').fill('000000'); await page.locator('[data-verify]').click();
    await messageContains(page, '인증하지 못했습니다');
    assert.equal(await page.locator('[data-message]').getAttribute('data-kind'), 'error');
    assert.equal(await page.locator('[name=code]').inputValue(), '000000');
    await page.screenshot({ path: path.join(out, 'otp-error.png'), fullPage: true });
    await page.locator('[name=code]').fill('123456'); await page.locator('[data-verify]').click();
    await messageContains(page, '인증했습니다');
    assert(await page.locator('[data-code]').isHidden());
    assert.equal(await page.locator('[data-session]').innerText(), '연결된 계정');
    assert.equal(await page.locator('[name=nickname]').inputValue(), '입력 유지', 'Account render preserves unsaved nickname');
    await page.locator('[data-logout]').click(); await messageContains(page, '로그아웃했습니다');
    assert.match(await page.locator('[data-status]').innerText(), /다시 불러와/);
    const calls = await page.evaluate(() => window.authFixture.calls); authCalls.push(...calls);
    assert.equal(calls[0].mode, 'link');
    assert(calls.filter(call => call.method === 'verify').every(call => call.mode === 'login'));
    checks.push('Busy send suppression; cancel pending send; preserved email/nickname; cooldown cannot be bypassed by reopen', 'OTP cancel/back/resend, 30s cooldown, invalid-code inline error, successful mocked login and logout');
    await context.close();
  }
  {
    const { context, page } = await open(true);
    await page.locator('[data-link]').click(); await page.locator('[name=email]').fill('linked@example.com');
    await page.locator('[data-send]').click(); await page.locator('[data-code]').waitFor({ state: 'visible' });
    await page.locator('[name=code]').fill('123456'); await page.locator('[data-verify]').click();
    await messageContains(page, '인증했습니다');
    assert.equal(await page.locator('[data-session]').innerText(), '연결된 계정');
    const calls = await page.evaluate(() => window.authFixture.calls); authCalls.push(...calls);
    assert.deepEqual(calls.map(call => [call.method, call.mode]), [['sendCode', 'link'], ['verify', 'link']]);
    await page.locator('[name=nickname]').focus(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('.hs-hub').getAttribute('data-current-page'), 'journey');
    assert.equal(await page.evaluate(() => window.testUI.fights), 0);
    checks.push('Successful mocked guest email linking; Escape exits account without starting fight');
    await context.close();
  }
  assert.deepEqual(errors, []);
  const report = { pass: true, fixtureOnly: true, at: new Date().toISOString(), checks, sourceHashes, authCalls, errors, limits: ['Auth provider and email delivery are mocked; production credentials and hosted auth are not tested.'] };
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pass: true, fixtureOnly: true, checks: checks.length, errors: errors.length, out }));
} catch (error) {
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(path.join(out, 'failure.json'), JSON.stringify({ pass: false, error: error.stack, checks, errors, sourceHashes }, null, 2));
  throw error;
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
