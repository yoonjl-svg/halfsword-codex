// 권총 겉모습 시안 비교 (디렉터 12:49, 사장님 "권총이 아니라 라이플처럼 생겼어"): 두 풍을 나란히 찍어 한 장으로 만든다.
//  A 'flintlock'(부싯돌식) · B 'revolver'(리볼버) — weapon_looks.js drawPistol(group, style), 시안은 window.__pistolStyle 로 바꾼다.
//  위: 카드 그림(weapon_thumbs 와 같은 틀) / 가운데: 게임 화면 기본 카메라 844×390(줄여서 붙임) / 아래: 손에 든 권총을 바로 옆에서.
//  결과: docs/handoff/pistol_look_v1.png. 콘솔 에러도 센다.
//   vite 개발 서버를 띄운 뒤: node tools/browser/pistol_look.mjs http://127.0.0.1:5173
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const out = new URL('../../docs/handoff/pistol_look_v1.png', import.meta.url);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const STYLES = [
  ['flintlock', 'A 부싯돌식 (세계관)'],
  ['revolver', 'B 리볼버 (어디서 굴러 들어온)'],
];
const shots = {};
for (const [style] of STYLES) {
  // 카드 그림
  let page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  page.on('pageerror', (e) => errors.push(`${style} thumb: ${e}`));
  await page.addInitScript((s) => (window.__pistolStyle = s), style);
  await page.goto(`${base}/tools/browser/weapon_thumbs.html?ids=pistol`);
  await page.waitForFunction(() => window.thumbs?.done, null, { timeout: 60000 });
  const thumb = await page.evaluate(() => window.thumbs.list[0].url);
  await page.close();
  // 게임 화면 (기본 카메라) + 가까이
  page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  page.on('pageerror', (e) => errors.push(`${style} game: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${style} console: ${m.text()}`));
  await page.addInitScript((s) => (window.__pistolStyle = s), style);
  await page.goto(`${base}/?weapon=pistol&foeWeapon=longsword&stage=arena`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 30000 });
  await page.getByText('싸움 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight' || (window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6), null, { timeout: 30000 });
  if ((await page.evaluate(() => window.game.state)) === 'draw') await page.locator('#draw .wcard[data-i="0"]').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const game = (await page.screenshot({ type: 'jpeg', quality: 82 })).toString('base64');
  // 가까이: 총을 정확히 옆(칼 몸체 z 축)에서, 화면 위 = 칼 −x (겨누는 자세에서 위쪽)
  await page.evaluate(() => {
    const g = window.game, f = g.player, T = g.THREE;
    g.freeCam = true;
    const r = f.sword.rotation();
    const q = new T.Quaternion(r.x, r.y, r.z, r.w);
    const c = f.bladePoint(0.3, new T.Vector3());
    g.camera.position.copy(c).addScaledVector(new T.Vector3(0, 0, 1).applyQuaternion(q), 0.35);
    g.camera.up.copy(new T.Vector3(-1, 0, 0).applyQuaternion(q));
    g.camera.lookAt(c);
  });
  await page.waitForTimeout(120);
  const close = (await page.screenshot({ type: 'jpeg', quality: 82, clip: { x: 122, y: 60, width: 600, height: 320 } })).toString('base64');
  await page.close();
  shots[style] = { thumb, game, close };
}
// 한 장으로
const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
const col = (style, label) => `
  <div class="col"><h2>${label}</h2>
    <div class="card"><img src="${shots[style].thumb}"></div>
    <img class="game" src="data:image/jpeg;base64,${shots[style].game}">
    <img class="close" src="data:image/jpeg;base64,${shots[style].close}">
  </div>`;
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#1b1410;color:#f3e9d8;font:18px system-ui,sans-serif;display:flex;gap:24px;padding:16px}
  .col{display:flex;flex-direction:column;align-items:center;gap:10px}
  h2{margin:0;font-size:22px}
  .card{width:160px;height:160px;border-radius:10px;background:radial-gradient(circle at 50% 45%,#3a2c20,#17110d 70%);display:grid;place-items:center}
  .card img{width:128px;height:128px}
  .game{width:560px;height:259px}
  .close{width:560px;height:299px}
</style></head><body>${STYLES.map(([s, l]) => col(s, l)).join('')}</body></html>`);
await page.waitForTimeout(300);
const h = await page.evaluate(() => document.body.scrollHeight);
fs.writeFileSync(out, await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1180, height: h } }));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : `ZERO console errors → ${out.pathname}`);
await browser.close();
process.exit(errors.length ? 1 : 0);
