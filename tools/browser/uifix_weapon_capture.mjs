// 대기실 무기 = 싸움 무기 맞대기 사진 (docs/import/ui_fix_2026-10-16.md §6) — docs/handoff/uifix_weapon_<무기>_<크기>.png
//  칸 셋 × 줄 둘: 싸움(실제 판 — 상대 AI 멈춤 · 상대는 숨김 · 판 시작 발 묶임 뒤 자세를 고쳐 딛고 선 때) · 대기실 고치기 전 · 대기실 고친 뒤 / 정면 · 오른쪽 옆(돌림판 90°)
//   싸움 칸: 우리 게임 카메라를 그 몸 앞(또는 오른쪽) 11.4 m 에 두고 좁은 화각 12° 로 — 거의 정사영(대기실처럼). 높이 2.4 m 를 칸 높이로 자른다
//   대기실 칸: 대기실 캐릭터 칸 그대로 (container.lobbyPreview.setWeapon — 무기 칸엔 나뭇가지뿐이라 롱소드·츠바이핸더는 이 고리로 걸어 본다)
//   '고치기 전'은 고치기 전 커밋(86b94bc)에 같은 고리만 단 빌드를 따로 띄운 주소 (없으면 칸을 비운다)
//  싸움 쪽은 책 없는 새 프로필(주소 판 — 대기실 여정과 같은 몫: 산 책 없음)
//  npm run build && npx vite preview --port 5230 →  node tools/browser/uifix_weapon_capture.mjs http://127.0.0.1:5230 [고치기 전 주소] docs/handoff
import { chromium } from 'playwright';
import { titleToLobby } from './to_lobby.mjs'; // 10/17: 첫 화면 → 곧바로 여정 → 정지 → 대기실 (사장님 '첫화면에서 바로 전투로')
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:5230', before = process.argv[3] || '', out = process.argv[4] || 'docs/handoff';
fs.mkdirSync(out, { recursive: true });
const WEAPONS = (process.env.WEAPONS || 'tree_branch,longsword,zweihander').split(',');
const SIZES = [['phone-landscape', 844, 390], ['phone-portrait', 390, 844]];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const IGNORED = /deprecated parameters for the initialization function/;
const errors = [], saved = [], info = {};
async function page(width, height, touch) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch, reducedMotion: 'reduce' });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(m.text()); });
  return { ctx, p };
}
// ── 싸움 칸 ──
async function fightShots(id) {
  const { ctx, p } = await page(844, 390, false);
  await p.goto(`${base}/?weapon=${id}&stage=castle&foe=default&emo=0`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
  await p.locator('#btnStart').click(); await p.waitForFunction(() => game.state === 'fight', null, { timeout: 30000 });
  await p.evaluate(() => {
    game.ai.update = () => {}; // 상대는 서 있기만
    for (const m of game.enemy.meshes) m.group.visible = false; // 정면 사진을 가리지 않게 (물리는 그대로)
    for (const id of ['hint', 'toast', 'foeIntro', 'stageInfo', 'guardName', 'techCue', 'topButtons', 'moveStick', 'btnParry', 'staminaHud', 'emoMsg']) { const el = document.getElementById(id); if (el) el.style.visibility = 'hidden'; }
  });
  const hold = await p.evaluate(() => game.config.ARENA.startHold);
  await p.waitForFunction((t) => game.stats.simTime >= t, hold + 4, { timeout: 180000 }); // 발 묶임 뒤 자세 고쳐 딛기까지
  const shots = {};
  for (const [view, dir] of [['front', 'forward'], ['side', 'right']]) {
    await p.evaluate(([d]) => {
      const g = game, f = g.player, pv = f.bodies.pelvis.translation(), v = f[d]();
      g.freeCam = true;
      g.camera.fov = 12; g.camera.updateProjectionMatrix();
      const D = 1.2 / Math.tan((6 * Math.PI) / 180); // 높이 2.4 m 가 화면 높이 (화각 12°)
      g.camera.position.set(pv.x + v.x * D, 1.0, pv.z + v.z * D);
      g.camera.lookAt(pv.x, 1.0, pv.z);
    }, [dir]);
    await p.waitForTimeout(400);
    // 화면 가운데 = 골반 위 1.0 m · 높이 780 px(화소 비 2) = 2.4 m → 325 px/m. 옆은 칼이 화면 오른쪽(앞)으로 — 가운데를 0.6 m 앞으로
    const pxm = 780 / 2.4, cx = 844 + (view === 'side' ? 0.6 * pxm : 0), half = 1.2 * pxm;
    shots[view] = await p.screenshot({ clip: { x: (cx - half) / 2, y: 0, width: (2 * half) / 2, height: 390 } });
  }
  info[id] = { ...(info[id] ?? {}), fightSimTime: +(await p.evaluate(() => game.stats.simTime)).toFixed(2), hold };
  await ctx.close();
  return shots;
}
// ── 대기실 칸 ──
async function lobbyShots(url, id, width, height) {
  const { ctx, p } = await page(width, height, true);
  await p.goto(`${url}/`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
  if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await p.locator('#confirmNotices').click();
  await p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 20000 });
  await titleToLobby(p);
  const view = 'document.querySelector("#gameEntrance").shadowRoot.getElementById("characterView")';
  await p.evaluate(new Function('w', `${view}.lobbyPreview.setWeapon(w)`), id);
  await p.waitForFunction(new Function(`return ${view}.dataset.rig === 'ready'`), null, { timeout: 60000 });
  await p.waitForTimeout(300);
  const box = await p.locator('#characterView').boundingBox();
  const shots = { front: await p.screenshot({ clip: box }) };
  await p.locator('#characterView').focus();
  for (let i = 0; i < 4; i++) await p.keyboard.press('ArrowRight'); // 22.5° × 4 = 90° (오른쪽 옆)
  await p.waitForFunction(new Function(`return ${view}.dataset.turning !== 'true'`), null, { timeout: 10000 });
  await p.waitForTimeout(500);
  shots.side = await p.screenshot({ clip: box });
  await ctx.close();
  return shots;
}
// ── 맞대기 한 장 ──
async function compose(id, size, fight, old, now) {
  const { ctx, p } = await page(1000, 600, false);
  const img = (b) => (b ? `<img src="data:image/png;base64,${b.toString('base64')}">` : '<div class="none">—</div>');
  const name = { tree_branch: '나뭇가지', longsword: '롱소드', zweihander: '츠바이핸더' }[id] ?? id;
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#1b1410;color:#f3e9d8;font:14px Pretendard,system-ui,sans-serif}
    #grid{display:inline-grid;grid-template-columns:auto repeat(3,auto);gap:10px 14px;padding:16px 18px;background:#1b1410}
    .h{font-weight:700;text-align:center;align-self:end}.r{width:56px;font-weight:600;color:#b8a88e;align-self:center;word-break:keep-all;line-height:1.4}
    img,.none{height:340px;display:block;border:1px solid #4b3b2a;background:#2a2119}.none{width:200px;display:grid;place-items:center;color:#b8a88e}
    .t{grid-column:1/-1;font-size:17px;font-weight:700}.t small{font-weight:400;color:#b8a88e;margin-left:8px}</style>
    <div id="grid"><div class="t">${name}<small>${size} · 싸움 = 실제 판(상대 숨김) · 대기실 = 캐릭터 칸 그대로</small></div>
    <div></div><div class="h">싸움</div><div class="h">대기실 — 고치기 전</div><div class="h">대기실 — 고친 뒤</div>
    <div class="r">정면</div>${img(fight.front)}${img(old?.front)}${img(now.front)}
    <div class="r">오른쪽 옆 (90°)</div>${img(fight.side)}${img(old?.side)}${img(now.side)}</div>`;
  await p.setContent(html); await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  const path = `${out}/uifix_weapon_${id}_${size}.png`;
  await p.locator('#grid').screenshot({ path });
  saved.push(path);
  await ctx.close();
}

for (const id of WEAPONS) {
  const fight = await fightShots(id);
  for (const [size, width, height] of SIZES) {
    const now = await lobbyShots(base, id, width, height);
    const old = before ? await lobbyShots(before, id, width, height) : null;
    await compose(id, size, fight, old, now);
  }
}
await browser.close();
console.log(JSON.stringify({ saved, info, errors }, null, 1));
if (errors.length) process.exit(1);
