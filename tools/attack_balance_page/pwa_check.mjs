import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.ATTACK_BALANCE_PLAYWRIGHT || '/workspace/halfsword-encyclopedia-20261031/node_modules/playwright/index.mjs'));
const base = process.argv[2] || 'http://127.0.0.1:5299';
const out = path.resolve(process.argv[3] || '/tmp/attack-balance-20261101/pwa');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 1000, height: 500 }, hasTouch: true, isMobile: true, acceptDownloads: true });
  await context.addInitScript(() => {
    window.__pwaCalls = { register: 0, getRegistration: 0, getRegistrations: 0, unregister: 0, cacheKeys: 0, cacheDelete: 0 };
    for (const key of ['register', 'getRegistration', 'getRegistrations']) {
      const original = ServiceWorkerContainer.prototype[key];
      ServiceWorkerContainer.prototype[key] = function(...args) { __pwaCalls[key]++; return original.apply(this, args); };
    }
    const unregister = ServiceWorkerRegistration.prototype.unregister;
    ServiceWorkerRegistration.prototype.unregister = function(...args) { __pwaCalls.unregister++; return unregister.apply(this, args); };
    for (const [key, count] of [['keys', 'cacheKeys'], ['delete', 'cacheDelete']]) {
      const original = CacheStorage.prototype[key];
      CacheStorage.prototype[key] = function(...args) { __pwaCalls[count]++; return original.apply(this, args); };
    }
    const P = Storage.prototype, nativeGet = P.getItem, nativeSet = P.setItem, nativeKey = P.key, nativeLength = Object.getOwnPropertyDescriptor(P, 'length').get;
    nativeSet.call(localStorage, 'normal-game-control-sentinel', 'unchanged');
    window.__pwaStorageAudit = () => ({ sentinel: nativeGet.call(localStorage, 'normal-game-control-sentinel'), rawKeys: Array.from({ length: nativeLength.call(localStorage) }, (_, i) => nativeKey.call(localStorage, i)), isolated: !!P.__attackBalanceResearch });
  });
  const page = await context.newPage(), errors = [], warnings = [], swRequests = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'warning' && /pwa|service.?worker/i.test(m.text())) warnings.push(m.text()); });
  page.on('request', r => { if (/\/sw\.js(?:\?|$)/.test(r.url())) swRequests.push(r.url()); });
  await page.goto(`${base}/?test=1&skillNodes=all&weapon=longsword&foe=heinrich&stage=castle&technique=schielhau&trial=condition&actor=automated`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword && window.attackBalance, null, { timeout: 120000 });
  const storage = await page.evaluate(() => { localStorage.setItem('__pwa-mini-check', 'research'); const written = __pwaStorageAudit(); localStorage.clear(); return { written, cleared: __pwaStorageAudit() }; });
  await page.locator('#btnStart').click();
  await page.waitForFunction(() => game.state === 'fight');
  await page.locator('#ab-record').click();
  await page.waitForTimeout(120);
  await page.locator('#ab-finish').click();
  const pendingDownload = page.waitForEvent('download'); await page.locator('#ab-download').click();
  await (await pendingDownload).saveAs(path.join(out, 'download.json'));
  await page.screenshot({ path: path.join(out, 'page-no-pwa.png') });
  const game = await page.evaluate(() => ({ calls: __pwaCalls, gameState: window.game.state, renderVisible: window.game.scene.visible, catalog: attackBalance.catalog.length, condition: document.querySelector('#ab-condition').textContent }));
  const testPageResponse = await page.goto(`${base}/test.html`, { waitUntil: 'networkidle' });
  const testPage = await page.evaluate(() => ({ calls: __pwaCalls, storage: __pwaStorageAudit(), title: document.title, probeLoaded: !!window.attackBalance }));
  const result = { game, storage, testPage: { status: testPageResponse.status(), ...testPage }, swRequests, warnings, errors };
  await fs.writeFile(path.join(out, 'pwa-verification.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  if (errors.length || warnings.length || swRequests.length || Object.values(game.calls).some(Boolean) || Object.values(testPage.calls).some(Boolean) || storage.cleared.sentinel !== 'unchanged' || !storage.written.rawKeys.includes('stillness.research.attack-balance-20261101.__pwa-mini-check') || !testPage.storage.isolated || testPageResponse.status() !== 200 || testPage.probeLoaded) process.exitCode = 1;
} finally { await browser.close(); }
