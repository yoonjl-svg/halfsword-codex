// 마우스: 잠금을 거는 첫 클릭은 찌르기 아님, 잠긴 뒤 끌지 않은 (왼쪽 버튼) 클릭 = 찌르기, 오른쪽 버튼 클릭·끌면서 클릭 = 찌르기 아님
//  무기 카드 뽑기는 건너뛴다 (?weapon=longsword: 뽑기 없이 롱소드로 바로 싸움. 안 그러면 첫 클릭이 카드를 고른다)
//  실행: vite 개발 서버를 띄운 뒤 (npm run dev) playwright 가 설치된 곳에서
//    node tools/browser/mouse_thrust.mjs http://127.0.0.1:5173
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 650 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto((process.argv[2] || 'http://127.0.0.1:5173') + '/?weapon=longsword', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 30000 });
await page.getByText('싸움 시작').click();
await page.waitForTimeout(2000);
await page.evaluate(() => { window.game.ai.update = () => {}; });
const th = () => page.evaluate(() => window.game.player.skill.thrusts);
const locked = () => page.evaluate(() => !!document.pointerLockElement);
const idle = () => page.waitForFunction(() => !window.game.player.skill.tap, null, { timeout: 8000 });
const X = 700, Y = 300;
const r = [];
let n0 = await th();
await page.mouse.click(X, Y); // 잠금 거는 클릭
await page.waitForTimeout(1500);
r.push(`첫 클릭(잠금): 잠김=${await locked()} 찌르기 ${(await th()) - n0}회 (기대 0)`);
await idle(); n0 = await th();
await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
try { await page.waitForFunction((n) => window.game.player.skill.thrusts > n, n0, { timeout: 4000 }); } catch {}
r.push(`잠긴 뒤 클릭: 찌르기 ${(await th()) - n0}회 (기대 1, 잠김=${await locked()})`);
await idle(); n0 = await th();
await page.mouse.down({ button: 'right' }); await page.waitForTimeout(60); await page.mouse.up({ button: 'right' });
await page.waitForTimeout(1500);
r.push(`오른쪽 버튼 클릭: 찌르기 ${(await th()) - n0}회 (기대 0, 잠김=${await locked()})`);
await idle(); n0 = await th();
await page.mouse.down();
for (let i = 1; i <= 8; i++) { await page.mouse.move(X + 15 * i, Y - 6 * i); await page.waitForTimeout(15); }
await page.mouse.up();
await page.waitForTimeout(1500);
r.push(`끌면서 클릭: 찌르기 ${(await th()) - n0}회 (기대 0)`);
console.log(r.join('\n'));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : '콘솔 에러 0');
await browser.close();
