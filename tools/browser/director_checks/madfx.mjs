import { chromium } from '/home/user/halfsword/node_modules/playwright/index.mjs';
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const open = async (q) => {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  page.on('pageerror', (e) => errors.push(q + ' pageerror: ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(q + ' console: ' + m.text()); });
  await page.goto('http://127.0.0.1:5173/?' + q, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 150000 });
  await page.tap('#btnStart');
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 150000 });
  await page.waitForTimeout(1500);
  return page;
};
const redSprites = (page) => page.evaluate(() => { let n = 0; (() => { let o = window.game.player.meshes[0].group; while (o.parent) o = o.parent; return o; })().traverse((o) => { if (o.isSprite && o.visible && o.material?.color && o.material.color.r > 0.5 && o.material.color.g < 0.5) n++; }); return n; });
const visSprites = (page) => page.evaluate(() => { let n = 0; (() => { let o = window.game.player.meshes[0].group; while (o.parent) o = o.parent; return o; })().traverse((o) => { if ((o.isSprite || o.isPoints) && o.visible) n++; }); return n; });
const SKIP = false;
if (!SKIP) {
// 1) 밤의 포세이돈 (스테이지 모드 → 광기의 하인리히)
let p = await open('stage=poseidon_night&weapon=longsword');
const info = await p.evaluate(() => ({ stage: window.game.stage.id, foe: document.querySelector('#foeIntro b')?.textContent }));
console.log('night', JSON.stringify(info), 'visible sprites', await visSprites(p));
await p.screenshot({ path: out + '/mad_night.png' });
await p.close();
// 1b) 낮 포세이돈 하인리히 → 안광 없어야
p = await open('stage=poseidon&weapon=longsword');
console.log('day heinrich visible sprites', await visSprites(p));
await p.close();
}
// 2) 권총 섬광·연기
let p = await open('stage=castle&foe=bran&weapon=pistol');
const before = await visSprites(p);
const fired = await p.evaluate(() => window.game.player.skill.thrust());
const after = await p.evaluate(async () => { const sc = (() => { let o = window.game.player.meshes[0].group; while (o.parent) o = o.parent; return o; })(); const r = []; for (let i = 0; i < 40; i++) { await new Promise((z) => setTimeout(z, 25)); let n = 0; sc.traverse((o) => { if ((o.isSprite || o.isPoints) && o.visible) n++; }); r.push(n); } return r.join(','); });
await p.screenshot({ path: out + '/gunfx_fix_30.png' });
console.log('pistol fired', fired, 'visible sprites/points before', before, 'after', after);
await p.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ZERO console errors');
await browser.close();
