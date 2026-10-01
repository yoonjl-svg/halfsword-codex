// 자루 무기 시제품(봉) 을 게임 화면에서 싸우게 해 본다 (docs/pole_frame_design.md §8): 짧은 영상(webm)과 장면 띠(jpg).
//  무기는 tools/sim/pole_specs.mjs 의 봉·창 시제품(POLE=proto_staff|proto_spear, 레이피어식 탭 찌르기). 게임 무기 목록에는 넣지 않는다 — 이 도구가 페이지 안에서만 WEAPONS 에 끼운다.
//  상대(적 AI)가 봉을 쥐고, 주인공은 롱소드를 든 채 AI 로 싸운다. 부위 효과표(blunt_zones)는 판정 시제품이라 화면에는 넣지 않는다.
//   vite 개발 서버를 띄운 뒤: node tools/browser/staff_clip.mjs http://127.0.0.1:5173
//  결과: 영상 CLIPS_DIR(기본 /tmp/motion_clips)/staff_fight.webm, 장면 띠 docs/handoff/staff_clip.jpg
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const outDir = process.env.CLIPS_DIR || '/tmp/motion_clips/';
const SECONDS = +(process.env.SECONDS || 9);
const POLE = process.env.POLE || 'proto_staff'; // proto_staff | proto_spear (tools/sim/pole_specs.mjs)
const tmp = fs.mkdtempSync('/tmp/claude-staffclip-');
fs.mkdirSync(outDir, { recursive: true });
const FFMPEG = process.env.FFMPEG || '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, recordVideo: { dir: tmp, size: { width: 844, height: 390 } } });
const tCtx = Date.now();
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`${e}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
await page.goto(`${base}/?weapon=longsword&foeWeapon=${POLE}&stage=arena`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 30000 });
// 봉 스펙을 끼운다 (판을 시작하기 전에 — 파이터를 만들 때 getWeapon 이 찾는다)
await page.evaluate(async () => {
  const { WEAPONS } = await import('/src/weapons.js');
  const { registerPoleWeapons } = await import('/tools/sim/pole_specs.mjs');
  registerPoleWeapons(WEAPONS);
});
await page.getByText('싸움 시작').click();
await page.waitForFunction(() => window.game.state === 'fight' || (window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6), null, { timeout: 30000 });
if ((await page.evaluate(() => window.game.state)) === 'draw') await page.locator('#draw .wcard[data-i="0"]').click();
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 30000 });
const foeW = await page.evaluate(() => window.game.enemy?.weapon?.id);
if (foeW !== POLE) errors.push(`상대 무기가 ${POLE} 가 아니다: ${foeW}`);
await page.addStyleTag({ content: 'body *{visibility:hidden!important} canvas{visibility:visible!important}' });
// 주인공도 AI 로 (롱소드 유파). LIB=1 이면 봉 쪽에 동작 라이브러리(E 자루: 봉 자세표·찌르기 + 머리 내려치기)를 입힌다
await page.evaluate(async (lib) => {
  const { AI } = await import('/src/ai.js');
  const g = window.game;
  if (lib) {
    const { applyMotionLibrary, motionFor } = await import('/src/motion_library.js');
    const { SCHOOLS } = await import('/src/schools.js');
    const m = motionFor(g.enemy.weapon);
    SCHOOLS.staff_lib = { ...SCHOOLS.longsword, id: 'staff_lib', tech: m.tech, techByName: Object.fromEntries(m.tech.map((t) => [t.name, t])), feints: m.feints, ...(m.counter ? { counter: m.counter } : {}) };
    const foeAI = new AI(g.enemy, g.player, 'normal', { school: 'staff_lib' });
    g.ai.update = (dt) => foeAI.update(dt);
    applyMotionLibrary(g.enemy, { ai: foeAI, cover: false });
  }
  const me = new AI(g.player, g.enemy, 'normal');
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    if (g.state === 'fight') me.update(Math.min(0.05, (now - last) / 1000));
    last = now;
    window.__meAI = requestAnimationFrame(tick);
  };
  tick();
  // 카메라: 두 사람 사이를 옆에서 (매 프레임 따라간다)
  g.freeCam = true;
  const T = g.THREE;
  const cam = () => {
    const a = g.player.bodies.chest.translation();
    const b = g.enemy.bodies.chest.translation();
    const mid = new T.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    const ab = new T.Vector3(b.x - a.x, 0, b.z - a.z);
    const d = Math.max(1.5, ab.length());
    ab.normalize();
    const side = new T.Vector3(-ab.z, 0, ab.x);
    g.camera.position.copy(mid).addScaledVector(side, 1.2 + d * 0.9).add(new T.Vector3(0, 0.25, 0));
    g.camera.up.set(0, 1, 0);
    g.camera.lookAt(mid.x, mid.y - 0.1, mid.z);
    window.__cam = requestAnimationFrame(cam);
  };
  cam();
}, process.env.LIB === '1');
await page.waitForTimeout(800);
const t0 = Date.now();
await page.waitForTimeout(SECONDS * 1000);
await page.evaluate(() => (cancelAnimationFrame(window.__meAI), cancelAnimationFrame(window.__cam)));
const video = page.video();
await ctx.close();
const LIB = process.env.LIB === '1';
const tag = POLE === 'proto_spear' ? 'spear' : 'staff';
const dst = path.join(outDir, `${tag}_fight${LIB ? '_lib' : ''}.webm`);
fs.copyFileSync(await video.path(), dst);
const start = (t0 - tCtx) / 1000;
const frames = [];
for (let k = 0; k < 8; k++) {
  const png = path.join(tmp, `f${k}.png`);
  try {
    execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-ss', (start + 0.3 + ((SECONDS - 1.2) * k) / 7).toFixed(2), '-i', dst, '-frames:v', '1', '-y', png]);
    frames.push(fs.readFileSync(png).toString('base64'));
  } catch (e) {
    errors.push(`frame ${k}: ${e.message.split('\n')[0]}`);
  }
}
const p2 = await browser.newPage({ viewport: { width: 1320, height: 900 } });
await p2.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#1b1410;color:#f3e9d8;font:16px system-ui,sans-serif;padding:10px}h2{margin:6px 0;font-size:17px}.row{display:flex;gap:4px;flex-wrap:wrap}img{width:320px;height:148px;object-fit:cover;border-radius:4px}</style></head><body><h2>${LIB ? (tag === 'spear' ? '창 시제품(2.4 m, 앞 1.5 m, 오른쪽)' : '봉 시제품(2.4 m, 오른쪽)') + ' + 동작 라이브러리 E — 마이어 봉 자세표 · 찌르기 + 머리 내려치기' : '봉 시제품(2.4 m, 오른쪽) 대 롱소드, 옆에서 — 탭 찌르기로 봉끝을 뻗는다 · 자세는 아직 롱소드 자세표라 지붕에서 봉이 곧게 선다'} (${SECONDS}초를 8장으로)</h2><div class="row">${frames.map((f) => `<img src="data:image/png;base64,${f}">`).join('')}</div></body></html>`);
await p2.waitForTimeout(300);
const h = await p2.evaluate(() => document.body.scrollHeight);
fs.writeFileSync(new URL(`../../docs/handoff/${tag}_clip${LIB ? '_lib' : ''}.jpg`, import.meta.url), await p2.screenshot({ type: 'jpeg', quality: 70, clip: { x: 0, y: 0, width: 1320, height: h } }));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : `ZERO console errors → ${dst} · docs/handoff/${tag}_clip${LIB ? '_lib' : ''}.jpg`);
await browser.close();
process.exit(errors.length ? 1 : 0);
