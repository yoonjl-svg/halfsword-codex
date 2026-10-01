// 브라우저 터치 시험: 탭 = 찌르기, 끌기·누르고 있기·짧게 긋기는 예전 그대로(찌르기 안 됨)
//  hasTouch 모바일 화면에서 page.touchscreen.tap 과 CDP 터치 이벤트로 손가락을 흉내 낸다. 콘솔 에러도 센다
//  무기 카드 뽑기는 건너뛴다 (?weapon=longsword: 뽑기 없이 롱소드로 바로 싸움)
//  실행: vite 개발 서버를 띄운 뒤 (npm run dev) playwright 가 설치된 곳에서
//    node tools/browser/touch_thrust.mjs http://127.0.0.1:5173
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 860, height: 420 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
await page.goto(base + '/?weapon=longsword', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 30000 });
await page.getByText('싸움 시작').click();
await page.waitForTimeout(2500);
await page.evaluate(() => { window.game.ai.update = () => {}; }); // 시험 중엔 적이 가만히 (넘어지면 찌를 수 없다)
const cdp = await ctx.newCDPSession(page);
const W = 860, H = 420;
const X = W * 0.72, Y = H * 0.42; // 칼 쪽(오른쪽) 화면
const snap = () => page.evaluate(() => { const p = window.game.player; return { thrusts: p.skill.thrusts, tap: !!p.skill.tap, w: p.skill.thrustPose.w, hx: +p.handOffset.x.toFixed(3), hy: +p.handOffset.y.toFixed(3), alive: p.alive }; });
// CDP 터치: 이벤트가 생긴 시각(timestamp)을 직접 준다 → 헤드리스가 느려도 누른 시간·움직임이 정확하다
const gesture = async (evs) => {
  const T0 = Date.now() / 1000;
  for (const [type, x, y, ms] of evs) await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }], timestamp: T0 + ms / 1000 });
};
const results = [];
async function check(name, fn, expectThrust) {
  // 이전 찌르기가 끝날 때까지 (헤드리스 소프트웨어 렌더링은 프레임이 느려 게임 시간이 실제보다 늦게 흐른다)
  await page.waitForFunction(() => !window.game.player.skill.tap, null, { timeout: 8000 });
  await page.waitForTimeout(300);
  const a = await snap();
  await fn();
  let b = null;
  if (expectThrust) {
    try { await page.waitForFunction((n) => window.game.player.skill.thrusts > n, a.thrusts, { timeout: 4000 }); } catch {}
    b = await snap();
  } else {
    await page.waitForTimeout(1500); // 찌르기가 늦게라도 나오는지 충분히 기다린다
    b = await snap();
  }
  const thrusted = b.thrusts - a.thrusts;
  const moved = Math.hypot(b.hx - a.hx, b.hy - a.hy);
  const ok = expectThrust ? thrusted === 1 : thrusted === 0;
  results.push({ name, ok, thrusted, active: b.tap, w: b.w, handMoved: +moved.toFixed(3) });
}
// 1) 탭 (page.touchscreen.tap)
await check('탭 (touchscreen.tap)', () => page.touchscreen.tap(X, Y), true);
// 2) 탭 (80ms, 5px 움직임)
await check('탭 80ms·5px', () => gesture([['touchStart', X, Y, 0], ['touchMove', X + 5, Y, 40], ['touchEnd', 0, 0, 80]]), true);
// 3) 끌기 (300ms 동안 120px)
await check('끌기 300ms·120px', () => gesture([['touchStart', X, Y, 0], ...Array.from({ length: 10 }, (_, i) => ['touchMove', X - 12 * (i + 1), Y + 6 * (i + 1), 30 * (i + 1)]), ['touchEnd', 0, 0, 310]]), false);
// 4) 짧게 긋기 (100ms 동안 60px) — 시간은 탭처럼 짧아도 움직임이 크면 끌기
await check('짧게 긋기 100ms·60px', () => gesture([['touchStart', X, Y, 0], ...Array.from({ length: 4 }, (_, i) => ['touchMove', X, Y - 15 * (i + 1), 25 * (i + 1)]), ['touchEnd', 0, 0, 105]]), false);
// 5) 누르고 있기 (400ms, 움직임 없음)
await check('누르고 있기 400ms', () => gesture([['touchStart', X, Y, 0], ['touchEnd', 0, 0, 400]]), false);
// 6) 누르고 있다가 끌기 (250ms 가만히 → 끌기)
await check('누른 채 250ms 뒤 끌기', () => gesture([['touchStart', X, Y, 0], ...Array.from({ length: 6 }, (_, i) => ['touchMove', X + 10 * (i + 1), Y, 250 + 25 * (i + 1)]), ['touchEnd', 0, 0, 420]]), false);
// 6b) 탭 한계 근처: 170ms·11px → 탭 / 200ms·0px → 탭 아님 / 60ms·14px → 탭 아님
await check('170ms·11px (탭)', () => gesture([['touchStart', X, Y, 0], ['touchMove', X + 11, Y, 100], ['touchEnd', 0, 0, 170]]), true);
await check('200ms·0px (길게)', () => gesture([['touchStart', X, Y, 0], ['touchEnd', 0, 0, 200]]), false);
await check('60ms·14px (움직임)', () => gesture([['touchStart', X, Y, 0], ['touchMove', X + 14, Y, 30], ['touchEnd', 0, 0, 60]]), false);
// 7) 탭 한 번 더 (연속 사용)
await check('탭 다시', () => page.touchscreen.tap(X - 40, Y + 60), true);
await page.waitForTimeout(3000);
const fin = await page.evaluate(() => ({ p: window.game.player.state, e: window.game.enemy.state }));
for (const r of results) console.log(`${r.ok ? 'OK ' : 'NG '} ${r.name}: 찌르기 ${r.thrusted}회 · 찌르는 중 ${r.active} (w=${r.w.toFixed(2)}) · 손 목표 이동 ${r.handMoved}m`);
console.log('끝 상태', JSON.stringify(fin));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : '콘솔 에러 0');
await browser.close();
process.exit(results.every((r) => r.ok) && !errors.length ? 0 : 1);
