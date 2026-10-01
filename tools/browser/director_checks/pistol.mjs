import { chromium } from '/home/user/halfsword/node_modules/playwright/index.mjs';
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
// 1) 내가 권총 (카드로 뽑기)
await page.goto('http://127.0.0.1:5173/?stage=castle&foe=bran&cards=pistol,longsword', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
await page.tap('#btnStart');
await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6, null, { timeout: 90000 });
await page.locator('#draw .wcard').nth(0).tap();
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/pistol_card.png` });
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 90000 });
const w = await page.evaluate(() => window.game.player.weapon.id);
let shots = 0;
for (let i = 0; i < 6; i++) {
  const r = await page.evaluate(() => window.game.player.skill.thrust());
  if (r) shots++;
  await page.waitForTimeout(1200);
}
await page.screenshot({ path: `${out}/pistol_fight.png` });
const st = await page.evaluate(() => ({ foeBlood: +window.game.enemy.blood.toFixed(2), foeState: window.game.enemy.state, wounds: window.game.enemy.wounds.length }));
console.log('player weapon', w, 'shots accepted', shots, JSON.stringify(st));
// 2) AI 가 권총
await page.goto('http://127.0.0.1:5173/?stage=castle&foe=liao&foeWeapon=pistol&weapon=longsword', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
await page.tap('#btnStart');
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 90000 });
await page.waitForTimeout(12000);
const st2 = await page.evaluate(() => ({ foeW: window.game.enemy.weapon.id, pBlood: +window.game.player.blood.toFixed(2), pState: window.game.player.state, pWounds: window.game.player.wounds.length }));
console.log('AI pistol', JSON.stringify(st2));
await page.screenshot({ path: `${out}/pistol_ai.png` });
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ZERO console errors');
await browser.close();
