// 동작 라이브러리 새 기술을 게임 화면에서 움직여 본다 (docs/weapon_motions.md §3·§4): 짧은 영상(webm)과 장면 띠(jpg).
//  주인공에게 라이브러리를 입히고 손가락 자리(패드)를 기술 길대로 움직인다(보기 좋게 AI 보통 빠르기의 절반). 상대는 가만히 선다.
//  결과: 영상 CLIPS_DIR(기본 /tmp/motion_clips)/<이름>.webm, 장면 띠 docs/handoff/motion_clips.jpg (기술마다 장면 4개)
//   vite 개발 서버를 띄운 뒤: node tools/browser/motion_clips.mjs http://127.0.0.1:5173
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const outDir = process.env.CLIPS_DIR || '/tmp/motion_clips/'; // 영상은 저장소에 넣지 않는다(파일이 크다) — 장면 띠(jpg)만 docs/handoff 에
const tmp = fs.mkdtempSync('/tmp/claude-motionclips-');
fs.mkdirSync(outDir, { recursive: true });
const FFMPEG = process.env.FFMPEG || '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const G = { tag: [0.02, 0.52], tagR: [0.42, 0.42], ochsR: [0.22, 0.26], langort: [0.0, 0.03], wechselL: [-0.4, -0.42], wechselR: [0.38, -0.44], tagL: [-0.4, 0.42], pflugR: [0.18, -0.28], nebenR: [0.55, -0.26] };
// [파일 이름, 무기, 라벨, 시작 패드, 길(패드 점들), 패드 빠르기 m/s, 탭 찌르기?]
const CLIPS = [
  ['talho_reves', 'zweihander', '츠바이핸더 · 몬탄테 탈류→레베스 (멈추지 않고 8자로 두 번 벤다)', G.tagR, [[0.12, 0.14], G.wechselL, [-0.5, 0.05], G.tagL, [-0.1, 0.14], G.wechselR], 5, false],
  ['zornhau_longsword', 'longsword', '롱소드 · 분노의 베기 (비교)', G.tagR, [[0.12, 0.14], G.wechselL], 5, false],
  ['wrist_cut', 'sabre', '세이버 · 손목 베기 (어깨에서 짧게 앞손을 끊는다)', G.tagR, [[0.2, 0.1], [0.05, -0.08]], 5, false],
  ['molinello', 'sabre', '세이버 · 몰리넬로 (한 바퀴 돌려 벤다 — 사람 손가락 길)', G.langort, [[0.25, -0.35], G.nebenR, G.tagR, [0.12, 0.14], G.wechselL], 5, false],
  ['lunge', 'rapier', '레이피어 · 3번 자세에서 런지 찌르기', G.langort, [], 5, true],
];
const strips = [];
for (const [name, wid, label, from, pathPts, speed, tap] of CLIPS) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 400 }, recordVideo: { dir: tmp, size: { width: 640, height: 400 } } });
  const tCtx = Date.now(); // 영상은 페이지를 열 때부터 찍힌다 — 장면을 고를 때 기준
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name} console: ${m.text()}`));
  await page.goto(`${base}/?weapon=${wid}&foeWeapon=longsword&stage=arena`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 30000 });
  await page.getByText('싸움 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight' || (window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6), null, { timeout: 30000 });
  if ((await page.evaluate(() => window.game.state)) === 'draw') await page.locator('#draw .wcard[data-i="0"]').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 30000 });
  await page.addStyleTag({ content: 'body *{visibility:hidden!important} canvas{visibility:visible!important}' });
  await page.evaluate(async ([from]) => {
    const lib = await import('/src/motion_library.js');
    const g = window.game;
    if (g.ai) g.ai.update = () => {};
    lib.applyMotionLibrary(g.player);
    const P = g.player;
    window.__pad = from.slice();
    clearInterval(window.__hold);
    window.__hold = setInterval(() => {
      P.handOffset.set(window.__pad[0], window.__pad[1]);
      P.skill.aimRaw?.set?.(window.__pad[0], window.__pad[1]);
    }, 4);
    // 카메라: 칼 든 쪽 옆, 조금 앞에서 (매 프레임 따라간다)
    g.freeCam = true;
    const T = g.THREE;
    const cam = () => {
      const c = P.bodies.chest.translation();
      const fw = P.forward(new T.Vector3());
      const side = new T.Vector3(-fw.z, 0, fw.x);
      g.camera.position.set(c.x, c.y, c.z).addScaledVector(side, 1.9).addScaledVector(fw, 0.7).add(new T.Vector3(0, 0.15, 0));
      g.camera.up.set(0, 1, 0);
      g.camera.lookAt(c.x + fw.x * 0.6, c.y + 0.05, c.z + fw.z * 0.6);
      window.__cam = requestAnimationFrame(cam);
    };
    cam();
  }, [from]);
  await page.waitForTimeout(1200);
  const t0 = Date.now();
  if (tap) {
    const ok = await page.evaluate(() => window.game.player.skill.thrust());
    if (!ok) errors.push(`${name}: 탭 찌르기가 나가지 않았다`);
  }
  else
    await page.evaluate(
      ([pts, speed]) =>
        new Promise((res) => {
          const q = pts.map((p) => p.slice());
          let last = performance.now();
          const step = () => {
            const now = performance.now();
            let d = (speed * (now - last)) / 1000;
            last = now;
            while (d > 0 && q.length) {
              const [tx, ty] = q[0];
              const dx = tx - window.__pad[0], dy = ty - window.__pad[1], dd = Math.hypot(dx, dy);
              if (dd <= d) (window.__pad = [tx, ty]), q.shift(), (d -= dd);
              else (window.__pad = [window.__pad[0] + (dx / dd) * d, window.__pad[1] + (dy / dd) * d]), (d = 0);
            }
            if (q.length) requestAnimationFrame(step);
            else res();
          };
          step();
        }),
      [pathPts, speed],
    );
  const moveDur = (Date.now() - t0) / 1000; // 기술 길을 다 따라간 시간
  await page.waitForTimeout(1200);
  const dur = Math.max(0.8, moveDur + 0.5); // 장면을 고르는 폭: 움직임 + 뒤 0.5초
  await page.evaluate(() => (clearInterval(window.__hold), cancelAnimationFrame(window.__cam)));
  const video = page.video();
  await ctx.close();
  const src = await video.path();
  const dst = path.join(outDir, `${name}.webm`);
  fs.copyFileSync(src, dst);
  // 장면 6개: 움직임이 시작한 뒤부터 고르게
  const start = Math.max(0, (t0 - tCtx) / 1000 - 0.1);
  const frames = [];
  for (let k = 0; k < 4; k++) {
    const at = start + (dur * k) / 3;
    const png = path.join(tmp, `${name}_${k}.png`);
    try {
      execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-ss', at.toFixed(2), '-i', dst, '-frames:v', '1', '-y', png]);
      frames.push(fs.readFileSync(png).toString('base64'));
    } catch (e) {
      errors.push(`${name} frame ${k}: ${e.message.split('\n')[0]}`);
    }
  }
  strips.push({ label, frames });
}
const page = await browser.newPage({ viewport: { width: 1320, height: 1500 } });
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#1b1410;color:#f3e9d8;font:16px system-ui,sans-serif;padding:10px}
  h2{margin:10px 0 5px;font-size:17px}
  .row{display:flex;gap:4px;flex-wrap:wrap} img{width:320px;height:200px;object-fit:cover;border-radius:4px}
</style></head><body>${strips.map((s) => `<h2>${s.label}</h2><div class="row">${s.frames.map((f) => `<img src="data:image/png;base64,${f}">`).join('')}</div>`).join('')}</body></html>`);
await page.waitForTimeout(300);
const h = await page.evaluate(() => document.body.scrollHeight);
fs.writeFileSync(new URL('../../docs/handoff/motion_clips.jpg', import.meta.url), await page.screenshot({ type: 'jpeg', quality: 66, clip: { x: 0, y: 0, width: 1320, height: h } }));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : `ZERO console errors → ${outDir} · docs/handoff/motion_clips.jpg`);
await browser.close();
process.exit(errors.length ? 1 : 0);
