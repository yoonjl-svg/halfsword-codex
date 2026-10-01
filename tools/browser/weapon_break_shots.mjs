// 무기 파손 연속 사진: 실제 게임 화면에서 싸움을 시작한 뒤 주인공 무기를 강제로 부러뜨리고
//  부러지기 직전 → 부러진 순간 → 0.3초 뒤(조각이 날아감) → 2초 뒤(조각이 사라지고 톱니 끝만 남음)을 찍는다.
//  콘솔 에러도 함께 센다. 결과: docs/weapon_shots/break_<무기>_<순번>.jpg (0 직전 · 1 순간 · 2 0.3초 뒤 · 3 2초 뒤)
//  실행: vite 개발 서버(npm run dev)를 띄운 뒤
//    node tools/browser/weapon_break_shots.mjs http://127.0.0.1:5173 [longsword sabre tree_branch]
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const ids = process.argv.slice(3).length ? process.argv.slice(3) : ['longsword', 'sabre', 'tree_branch'];
const outDir = new URL('../../docs/weapon_shots/', import.meta.url);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
for (const id of ids) {
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  page.on('pageerror', (e) => errors.push(`${id} pageerror: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${id} console: ${m.text()}`));
  await page.goto(`${base}/?weapon=${id}&foeWeapon=longsword&stage=arena`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 30000 });
  await page.getByText('싸움 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight' || (window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6), null, { timeout: 30000 });
  if ((await page.evaluate(() => window.game.state)) === 'draw') await page.locator('#draw .wcard[data-i="0"]').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  // 칼 옆에서 절단 자리를 본다 (몸 옆쪽 0.8 m · 조금 뒤 · 위 0.3 m)
  const aim = () =>
    page.evaluate(() => {
      const g = window.game;
      const f = g.player;
      const T = g.THREE;
      g.freeCam = true;
      const c = f.bladePoint(f.weaponBroken ? 1 : 0.5, new T.Vector3()); // 절단 자리
      const side = f.right(new T.Vector3()).multiplyScalar(-0.8).add(f.forward(new T.Vector3()).multiplyScalar(-0.25));
      g.camera.position.copy(c).add(side).add(new T.Vector3(0, 0.3, 0));
      g.camera.lookAt(c);
    });
  const shot = async (n) => {
    await aim();
    await page.waitForTimeout(60);
    fs.writeFileSync(new URL(`break_${id}_${n}.jpg`, outDir), await page.screenshot({ type: 'jpeg', quality: 80 }));
  };
  await shot(0);
  const info = await page.evaluate(() => {
    const f = window.game.player;
    const L0 = f.weaponCfg.bladeLength;
    f.breakWeapon();
    return { L0, L1: f.weaponCfg.bladeLength, broken: f.weaponBroken };
  });
  await shot(1);
  await page.waitForTimeout(300);
  await shot(2);
  await page.waitForTimeout(2000);
  await shot(3);
  const after = await page.evaluate(() => ({ sim: window.game.stats.simTime, state: window.game.state }));
  console.log(id.padEnd(12), JSON.stringify(info), JSON.stringify(after));
  await page.close();
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ZERO console errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
