// 동작 라이브러리 자세 모음 (docs/weapon_motions.md §2): 무기마다 새 자세를 게임 화면에서 옆·앞 비스듬히 찍어 한 장으로.
//  src/motion_library.js 를 페이지에서 불러와 주인공에게 입히고(applyMotionLibrary), 손가락 자리(패드)를 자세 자리에 붙들어 둔다.
//  결과: docs/handoff/motion_gallery.jpg. 콘솔 에러도 센다.
//   vite 개발 서버를 띄운 뒤: node tools/browser/motion_gallery.mjs http://127.0.0.1:5173
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const out = new URL('../../docs/handoff/motion_gallery.jpg', import.meta.url);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
// [무기, 라벨, [[패드 x, y, 이름]...]]
const SETS = [
  ['longsword', '롱소드 (A 양손 보통) — 지금 표', [[0.02, 0.52], [0.42, 0.42], [0.0, 0.03], [0.55, -0.26]]],
  ['zweihander', '츠바이핸더 (B 양손 앞무게)', [[0.02, 0.52], [0.42, 0.42], [0.0, 0.03], [0.55, -0.26]]],
  ['sabre', '세이버 (C 한손)', [[0.42, 0.42], [0.0, 0.03], [0.18, -0.28], [-0.18, -0.28]]],
  ['sabre', '세이버 — 막기 자세 (다음 버전: 막을 때만 덧씌움)', [[0.02, 0.52], [0.22, 0.26]], 'covers'],
  ['rapier', '레이피어 (C 한손 · 찌르기)', [[0.22, 0.26], [0.18, -0.28], [0.0, 0.03], [-0.18, -0.28]]],
];
const shots = [];
for (const [wid, label, pads, mode] of SETS) {
  const page = await browser.newPage({ viewport: { width: 520, height: 520 } });
  page.on('pageerror', (e) => errors.push(`${wid}: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${wid} console: ${m.text()}`));
  await page.goto(`${base}/?weapon=${wid}&foeWeapon=longsword&stage=arena`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 30000 });
  await page.getByText('싸움 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight' || (window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6), null, { timeout: 30000 });
  if ((await page.evaluate(() => window.game.state)) === 'draw') await page.locator('#draw .wcard[data-i="0"]').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 30000 });
  await page.addStyleTag({ content: 'body *{visibility:hidden!important} canvas{visibility:visible!important}' }); // 화면 글자·조이스틱 숨김
  // 상대 AI 를 멈추고(가만히) 주인공에게 라이브러리를 입힌다
  await page.evaluate(async () => {
    const lib = await import('/src/motion_library.js');
    const g = window.game;
    if (g.ai) g.ai.update = () => {};
    if (g.player.weapon.id !== 'longsword') lib.applyMotionLibrary(g.player, { overlay: false });
    window.__lib = lib;
  });
  if (mode === 'covers') await page.evaluate(() => { const P = window.game.player; P.guardPose.table = P.bodyGuard.table = window.__lib.frameTableWithCovers(P.weapon.frame, P.weapon.style); });
  const row = [];
  for (const [x, y] of pads) {
    await page.evaluate(([x, y]) => {
      const g = window.game;
      const P = g.player;
      clearInterval(window.__hold);
      window.__hold = setInterval(() => {
        P.handOffset.set(x, y);
        P.skill.aimRaw?.set?.(x, y);
      }, 5);
    }, [x, y]);
    await page.waitForTimeout(1600);
    const name = await page.evaluate(() => {
      const P = window.game.player;
      const T = P.guardPose.table;
      const i = P.guardPose.nearest;
      return (T ? T[i]?.name : null) ?? ['지붕 (Vom Tag)', '어깨 지붕 (Vom Tag)', '황소 (Ochs)', '긴 자세 (Langort)', '옆 자세', '쟁기 (Pflug)', '바꿈 (Wechsel)', '옆 지킴 (Nebenhut)', '바보 (Alber)', '왼쪽 어깨 지붕', '왼쪽 황소', '왼쪽 옆 자세', '왼쪽 쟁기', '왼쪽 바꿈'][i];
    });
    // 카메라: 주인공 칼 든 쪽 앞 비스듬히, 가슴 높이
    await page.evaluate(() => {
      const g = window.game;
      const P = g.player;
      const T = g.THREE;
      g.freeCam = true;
      const c = P.bodies.chest.translation();
      const fw = P.forward(new T.Vector3());
      const side = new T.Vector3(-fw.z, 0, fw.x);
      g.camera.position.set(c.x, c.y, c.z).addScaledVector(side, 2.3).addScaledVector(fw, 0.9).add(new T.Vector3(0, 0.15, 0)); // 칼 든 쪽 옆에서 조금 앞으로
      g.camera.up.set(0, 1, 0);
      g.camera.lookAt(c.x + fw.x * 0.3, c.y + 0.05, c.z + fw.z * 0.3);
    });
    await page.waitForTimeout(120);
    const img = (await page.screenshot({ type: 'jpeg', quality: 78 })).toString('base64');
    await page.evaluate(() => (window.game.freeCam = false));
    row.push({ img, name });
  }
  await page.evaluate(() => clearInterval(window.__hold));
  shots.push({ label, row });
  await page.close();
}
const page = await browser.newPage({ viewport: { width: 1320, height: 2200 } });
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#1b1410;color:#f3e9d8;font:16px system-ui,sans-serif;padding:12px}
  h2{margin:10px 0 6px;font-size:19px}
  .row{display:flex;gap:8px}
  figure{margin:0;width:320px}
  figure img{width:320px;height:320px;display:block;border-radius:6px}
  figcaption{font-size:14px;text-align:center;padding:3px 0 6px}
</style></head><body>${shots.map((s) => `<h2>${s.label}</h2><div class="row">${s.row.map((r) => `<figure><img src="data:image/jpeg;base64,${r.img}"><figcaption>${r.name}</figcaption></figure>`).join('')}</div>`).join('')}</body></html>`);
await page.waitForTimeout(300);
const h = await page.evaluate(() => document.body.scrollHeight);
fs.writeFileSync(out, await page.screenshot({ type: 'jpeg', quality: 62, clip: { x: 0, y: 0, width: 1320, height: h } }));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : `ZERO console errors → ${out.pathname}`);
await browser.close();
process.exit(errors.length ? 1 : 0);
