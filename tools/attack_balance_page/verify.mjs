import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.ATTACK_BALANCE_PLAYWRIGHT || '/workspace/halfsword-encyclopedia-20261031/node_modules/playwright/index.mjs'));
const base = process.argv[2] || 'http://127.0.0.1:5299';
const out = path.resolve(process.argv[3] || '/tmp/attack-balance-20261101/ui');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const rows = [];
try {
  for (const viewport of [{ width: 667, height: 375 }, { width: 1000, height: 500 }, { width: 1366, height: 768 }]) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width < 1200, isMobile: viewport.width < 1200, acceptDownloads: true });
    await context.addInitScript(() => {
      const P = Storage.prototype, get = P.getItem, set = P.setItem, key = P.key, len = Object.getOwnPropertyDescriptor(P, 'length').get;
      const accesses = [];
      set.call(localStorage, 'normal-game-control-sentinel', 'unchanged');
      P.getItem = function(k) { accesses.push({ key: k, isolatedAtCall: !!P.__attackBalanceResearch }); return get.call(this, k); };
      window.__storageAudit = () => ({ sentinel: get.call(localStorage, 'normal-game-control-sentinel'), rawKeys: Array.from({ length: len.call(localStorage) }, (_, i) => key.call(localStorage, i)), accesses });
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`${base}/?test=1&skillNodes=all&weapon=longsword&foe=heinrich&stage=castle&technique=schielhau&trial=condition&actor=automated`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.game?.player?.sword && window.attackBalance, null, { timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#ab-progress')?.textContent.includes('요청'));
    const ui = await page.evaluate(() => {
      const panel = document.querySelector('#attackBalancePanel'), box = panel.getBoundingClientRect();
      localStorage.setItem('__research-isolation-check', 'research-only');
      const afterWrite = __storageAudit(); localStorage.clear(); const afterClear = __storageAudit();
      return { catalog: attackBalance.catalog.length, gameState: game.state, panel: { x: box.x, y: box.y, width: box.width, height: box.height, insideViewport: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight }, conditionText: document.querySelector('#ab-condition').textContent, progressText: document.querySelector('#ab-progress').textContent, optionCount: document.querySelector('#ab-tech').options.length, storage: { afterWrite, afterClear }, ordinaryGameRenderVisible: game.scene.visible };
    });
    await page.locator('#btnStart').click();
    await page.waitForFunction(() => game.state === 'fight', null, { timeout: 120000 });
    await page.locator('#ab-record').click();
    await page.waitForTimeout(300);
    await page.locator('#ab-finish').click();
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#ab-download').click();
    const download = await downloadEvent;
    const downloadPath = path.join(out, `download-${viewport.width}.json`);
    await download.saveAs(downloadPath);
    const json = JSON.parse(await fs.readFile(downloadPath, 'utf8'));
    await page.screenshot({ path: path.join(out, `page-${viewport.width}.png`) });
    rows.push({ viewport, ui, downloaded: { schema: json.schema, selected: json.selected.id, actor: json.session?.actor, mode: json.session?.mode, ended: !!json.session?.ended, prefix: json.session?.storagePrefix, bytes: (await fs.stat(downloadPath)).size }, errors });
    console.log(JSON.stringify(rows.at(-1)));
    await context.close();
  }
} finally { await browser.close(); await fs.writeFile(path.join(out, 'ui-verification.json'), JSON.stringify(rows, null, 2)); }
if (rows.length !== 3 || rows.some(r => r.errors.length || !r.ui.panel.insideViewport || r.ui.catalog !== 19 || !r.downloaded.ended || r.ui.storage.afterWrite.sentinel !== 'unchanged' || r.ui.storage.afterClear.sentinel !== 'unchanged' || r.ui.storage.afterWrite.accesses.some(x => !x.isolatedAtCall))) process.exitCode = 1;
