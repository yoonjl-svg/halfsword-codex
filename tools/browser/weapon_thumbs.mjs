// 무기 뽑기 카드의 작은 그림 만들기: 게임 속 무기 모델(src/weapons.js)을 그대로 찍어
//  public/ui/weapons/<id>.webp (256×256, 투명 배경, 칼끝이 오른쪽 위로 가는 대각선) 로 저장한다.
//  무기 겉모습(weapon_looks.js·weapons.js)을 바꾸거나 무기를 새로 넣으면 다시 돌린다.
//  실행: vite 개발 서버를 띄운 뒤 (npm run dev) playwright 가 설치된 곳에서
//    node tools/browser/weapon_thumbs.mjs http://127.0.0.1:5173            (전체)
//    node tools/browser/weapon_thumbs.mjs http://127.0.0.1:5173 estoc sabre (몇 개만)
//  찍는 쪽은 tools/browser/weapon_thumbs.html (+ weapon_thumbs_page.js) — 브라우저로 열면 결과를 눈으로 볼 수 있다.
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로를 바꾸려면 PW_CHROMIUM
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const ids = process.argv.slice(3);
const outDir = new URL('../../public/ui/weapons/', import.meta.url);
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
await page.goto(`${base}/tools/browser/weapon_thumbs.html${ids.length ? '?ids=' + ids.join(',') : ''}`);
await page.waitForFunction(() => window.thumbs?.done, null, { timeout: 180000 });
const list = await page.evaluate(() => window.thumbs.list);
for (const { id, url } of list) {
  if (!url.startsWith('data:image/webp')) throw new Error(`${id}: webp 로 저장되지 않았다 (${url.slice(0, 30)})`);
  const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  fs.writeFileSync(new URL(`${id}.webp`, outDir), buf);
  console.log(`${id.padEnd(18)} ${(buf.length / 1024).toFixed(1)} KB${buf.length > 20 * 1024 ? '  (20KB 넘음)' : ''}`);
}
console.log(errors.length ? '에러:\n' + errors.join('\n') : `${list.length}장 저장 → public/ui/weapons/`);
await browser.close();
if (errors.length) process.exit(1);
