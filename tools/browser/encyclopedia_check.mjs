import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { CATALOG_ITEMS, CATALOG_CHARACTERS, filterCatalog } from '../../src/encyclopedia_data.js';
import { WEAPON_LIST } from '../../src/weapons.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
const base = process.argv[2] ?? 'http://127.0.0.1:4187/';
const out = process.argv[3] ?? 'docs/design/encyclopedia_20261031';
await mkdir(out, { recursive: true });
assert.equal(CATALOG_ITEMS.length, WEAPON_LIST.length + 2);
assert.equal(CATALOG_CHARACTERS.length, Object.keys(CHARACTERS_BY_ID).length + 1);
for (const list of [CATALOG_ITEMS, CATALOG_CHARACTERS]) assert.equal(new Set(list.map(e => e.id)).size, list.length);
assert.equal(filterCatalog(CATALOG_ITEMS, { query: '황약사의검' })[0].id, 'brothers_sword');
assert.equal(filterCatalog(CATALOG_CHARACTERS, { query: '쥘리아', kind: 'alter' })[0].id, 'julia_mad');
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/usr/bin/chromium', args: ['--no-sandbox'] });
const errors = [], checks = [];
try {
  for (const [width, height] of [[1280, 720], [844, 390], [740, 360], [390, 844], [320, 700]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 1000 });
    await context.addInitScript(() => { window.realSave = window.localStorage; realSave.setItem('encyclopedia.qa', 'unchanged'); window.saveBefore = JSON.stringify(Object.entries(realSave)); });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.goto(base); await page.locator('.ec-card').first().waitFor(); await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('.ec-card').count(), CATALOG_ITEMS.length);
    // Load every catalog asset, including lazy thumbnails below the fold.
    const imageResults = await page.evaluate(async paths => Promise.all(paths.map(src => new Promise(resolve => { const img = new Image(); img.onload = () => resolve(true); img.onerror = () => resolve(src); img.src = src; }))), [...CATALOG_ITEMS, ...CATALOG_CHARACTERS].map(e => e.image).filter(Boolean));
    assert.ok(imageResults.every(v => v === true), JSON.stringify(imageResults.filter(v => v !== true)));
    await page.locator('select[aria-label="유파"]').selectOption('italian');
    await page.locator('select[aria-label="등급"]').selectOption('legend');
    assert.equal(await page.locator('.ec-card').count(), filterCatalog(CATALOG_ITEMS, { school: 'italian', tier: 'legend' }).length);
    await page.locator('.ec-reset').click();
    const search = page.locator('.ec-search input');
    await search.fill('황약사의 검'); await page.locator('.ec-card').click();
    assert.equal(await page.locator('.ec-detail h3').textContent(), '황약사의 검');
    await page.keyboard.press('Escape'); assert.equal(await search.inputValue(), '황약사의 검');
    await search.fill('없는 항목 987'); assert.ok(await page.locator('.ec-empty').isVisible()); await page.locator('.ec-reset').click();
    async function shot(name) {
      await page.evaluate(() => document.getElementById('lobbyHost').shadowRoot.activeElement?.blur());
      await page.locator('.ec-card img, .ec-hero img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode().catch(() => {}))));
      await page.screenshot({ path: `${out}/${name}.png` });
    }
    if (width === 1280 || width === 844) await shot(`items-${width}`);
    await page.locator('#ecCharactersTab').click();
    assert.equal(await page.locator('.ec-card').count(), CATALOG_CHARACTERS.length);
    await page.locator('select[aria-label="종류"]').selectOption('base'); await search.fill('쥘리아');
    assert.equal(await page.locator('.ec-card').count(), 1); await page.locator('.ec-card').click();
    assert.ok((await page.locator('.ec-facts').textContent()).includes('숙련도4'));
    await page.locator('.ec-related').click(); assert.ok((await page.locator('.ec-facts').textContent()).includes('숙련도5'));
    await page.locator('.ec-back').click();
    assert.equal(await search.inputValue(), '쥘리아');
    assert.equal(await page.locator('.ec-card:focus').getAttribute('data-entry'), 'julia');
    await page.locator('.ec-reset').click();
    // A useful comparison view: current Italian users, including the latest Julia pair.
    await page.locator('select[aria-label="유파"]').selectOption('italian');
    if (width === 1280 || width === 844) await shot(`characters-${width}`);
    if (width === 844) {
      await search.fill('쥘리아'); await page.locator('[data-entry="julia"]').tap();
      await shot('detail-844'); await page.locator('.ec-back').tap();
    }
    await page.locator('#tabItems').click(); assert.ok(await page.locator('#panelInventory').isVisible());
    await page.locator('#tabEncyclopedia').click(); assert.ok(await page.locator('#ecCharactersTab[aria-selected=true]').isVisible());
    await page.locator('#ecCharactersTab').focus(); await page.keyboard.press('ArrowLeft');
    assert.ok(await page.locator('#ecItemsTab[aria-selected=true]').isVisible());
    const overflow = await page.evaluate(() => { const r = document.querySelector('#lobbyHost').shadowRoot; return [...r.querySelectorAll('.ec-panel, .ec-scroll, .contents-panel, .profile-panel')].filter(e => !e.hidden).map(e => ({ name: e.className, overflow: e.scrollWidth - e.clientWidth })); });
    assert.ok(overflow.every(e => e.overflow <= 1), JSON.stringify({ width, overflow }));
    assert.equal(await page.evaluate(() => JSON.stringify(Object.entries(realSave)) === saveBefore), true);
    checks.push({ width, height, images: imageResults.length, filters: true, detailsAndBack: true, keyboard: true, saveUnchanged: true, overflow });
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${out}/browser-checks.json`, JSON.stringify({ base, items: CATALOG_ITEMS.length, characters: CATALOG_CHARACTERS.length, checks, errors }, null, 2));
  console.log(JSON.stringify({ views: checks.length, items: CATALOG_ITEMS.length, characters: CATALOG_CHARACTERS.length, errors }));
} finally { await browser.close(); }
