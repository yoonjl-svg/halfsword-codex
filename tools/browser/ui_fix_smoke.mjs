// 화면 고침 실제 흐름 점검 (사장님 10/16 08:3x · 08:4x — docs/import/ui_fix_2026-10-16.md §3~§5) — 배포판 + 미리 보기 서버, 인증 서버는 막음(부르면 실패)
//  ① 첫 화면 'Stage 1' → 곧바로 카드 (사장님 10/17 11:2x — 대기실을 거치지 않음) · 일시정지 → 대기실: 정지 창 '대기실' · 설정 줄 그대로 → 대기실('Stage 입장') · 금화 · 대면 결과 · 이어하기 지점 그대로(사장님 08:4x '깎지 마')
//     → 다시 출발 = 같은 무대 · 같은 무기 (카드 없이)
//  ② 결과 창 — 이김: '승리' · '금화 +N' · 설정 줄 없음 · '다음 여정' · '대기실' → 대기실 금화 = 전 + N → 출발 = 다음 무대
//     짐: '패배' · '금화 −N'(또는 ±0) · '다시 겨루기'(같은 무대 — 진 판은 넘어가지 않음) · '대기실'
//     14:0x (같은 문서 §11): 금화 줄은 늘든 줄든 같은 강조 색 · 위 부제와 빈 줄 하나(부제 한 줄 높이) · 앞에 대기실 금화 그림 / 패배 글 = 첫 줄 진 까닭 · 다음 줄 “대사”(이름 없이)
//     14:4x (같은 문서 §12): 결과 창 부제에서 대사를 뺌 — 진 까닭 한 줄뿐(승리 창과 같은 꼴) · 상대 대사는 결과 창이 뜨기 전 싸움 화면에만
//  ③ 테스트 경로 · 주소 판: 정지 · 결과 창에 '대기실' 없음 · 결과 창 설정 줄 그대로 (메뉴 그대로)
//  ④ 대기실 캐릭터: '드래그하여 회전' 없음 · 천천히 반 칸 끌면 180°(멈췄다 놓으면 관성 없음) · 튕기면 더 돌다 섬 · 선 뒤로는 그리지 않음 · 막는 각 없음(몇 바퀴든) · Home = 가까운 정면
//  ⑤ 대기실 무기 = 싸움 무기 (08:4x — 같은 문서 §6): 나뭇가지를 장착한 대기실 몸 ↔ 그 무기로 연 여정 판의 플레이어(상대 AI 멈춤 · 자세를 고쳐 딛고 선 뒤) — 골반 기준 손목 · 칼끝 · 칼날 축
//  10/17: ④ ⑤ 의 대기실도 첫 화면 → 곧바로 카드 → 정지 → '대기실' 로 연다 (tools/browser/to_lobby.mjs)
//  npm run build && npx vite preview --port 5230 →  node tools/browser/ui_fix_smoke.mjs http://127.0.0.1:5230 /tmp/<빈 폴더>
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { departTitle, titleToLobby } from './to_lobby.mjs';
const base = process.argv[2] || 'http://127.0.0.1:5230', out = process.argv[3] || '/tmp/ui-fix';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const errors = [], checks = [];
const IGNORED = /deprecated parameters for the initialization function/;
const watch = (p) => { p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(m.text()); }); };
const noAuth = (c) => c.route('https://*.supabase.co/**', (r) => { errors.push('auth server called: ' + r.request().url()); r.abort(); });
const inRoot = (p, body) => p.evaluate(new Function(`const root=document.querySelector('#gameEntrance')?.shadowRoot;${body}`));
async function title(p) {
  await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
  if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await p.locator('#confirmNotices').click();
  await p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 20000 });
}
async function lobby(p, url) { // 첫 화면 → 곧바로 여정 → 정지 → 대기실 (url 없으면 지금 첫 화면에서)
  if (url != null) await p.goto(base + url, { waitUntil: 'networkidle' });
  await title(p);
  return titleToLobby(p);
}
const inLobby = (p) => p.waitForFunction(() => !!document.querySelector('#gameEntrance')?.shadowRoot.querySelector('.lobby #characterView canvas') && document.documentElement.hasAttribute('data-start-open'), null, { timeout: 30000 });
const pick = async (p, i = 0) => { await p.waitForFunction(() => game.state === 'draw' && game.draw.t > 0.6, null, { timeout: 30000 }); await p.locator(`#draw .wcard[data-i="${i}"]`).click(); await p.waitForFunction(() => game.state === 'fight', null, { timeout: 30000 }); };
const depart = async (p) => { await p.locator('#lobbyDepart').click(); await p.waitForFunction(() => !document.getElementById('gameEntrance') && ['draw', 'fight'].includes(game.state), null, { timeout: 60000 }); };
const end = async (p, who) => { await p.evaluate((w) => game[w].die('기절', true), who); await p.waitForFunction(() => game.state === 'paused' && document.getElementById('menu').classList.contains('show'), null, { timeout: 40000 }); };
const menu = (p) => p.evaluate(() => {
  const vis = (id) => { const el = document.getElementById(id); return !!el && !el.hidden && getComputedStyle(el).display !== 'none'; };
  return { title: document.getElementById('menuTitle').textContent, start: document.getElementById('btnStart').textContent, resume: vis('btnResume'), lobby: vis('btnLobby'), lobbyText: document.getElementById('btnLobby').textContent, fps: vis('fpsRow'), reward: vis('menuReward') ? document.getElementById('menuReward').textContent : null, test: vis('btnTestPick') };
});
// 결과 창 꼴 (14:0x): 부제 줄들 · 금화 줄 색 · 그림 · 부제 아래 끝과 금화 줄 위 끝 사이 틈(= 빈 줄 하나 = 부제 한 줄 높이)
//  그림 = 매끈한 금화 · 주머니 그림 (10/16 15:3x ⑦ — docs/import/item_art_2026-10-16.md): 실제로 읽혔나(256 px) · 꾸밈(빈 alt · aria-hidden) · 14 px
const look = (p) => p.evaluate(async () => {
  const sub = document.getElementById('menuSub'), rw = document.getElementById('menuReward'), s = sub.getBoundingClientRect(), r = rw.getBoundingClientRect(), imgs = [...rw.querySelectorAll('img')];
  await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
  return { lines: sub.innerText.split('\n'), color: getComputedStyle(rw).color, icons: imgs.map((i) => i.getAttribute('class')), hidden: imgs.every((i) => i.getAttribute('aria-hidden') === 'true' && i.getAttribute('alt') === ''), loaded: imgs.every((i) => i.complete && i.naturalWidth === 256), size: imgs.map((i) => i.getBoundingClientRect().width), svg: rw.querySelectorAll('svg').length, gap: r.top - s.bottom, line: parseFloat(getComputedStyle(sub).lineHeight) };
});
const ACCENT = 'rgb(217, 164, 65)'; // --c-accent
const store = (p) => p.evaluate(() => ({ coins: JSON.parse(localStorage.getItem('stillness.lobby.progress.v1'))?.coins ?? 100, profile: localStorage.getItem('stillness.lobby.profile.v1'), checkpoint: localStorage.getItem('stillness.journey.checkpoint.v1') }));
const shot = (p, name) => p.screenshot({ path: `${out}/${name}.png` });

try {
  // ①② 첫 화면·대기실 여정
  {
    const c = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, reducedMotion: 'reduce', hasTouch: true }); await noAuth(c);
    const p = await c.newPage(); watch(p);
    await p.goto(base + '/?title=1&cards=longsword,rapier', { waitUntil: 'networkidle' }); await title(p);
    assert.equal(await departTitle(p), 'draw'); // 첫 화면 'Stage 1' → 곧바로 카드 (덮개 걷힘 · 대기실 없음)
    await pick(p, 0);
    const stage0 = await p.evaluate(() => game.stage.id);
    // ① 일시정지 → 대기실
    await p.locator('#btnPause').click(); await p.waitForFunction(() => game.state === 'paused', null, { timeout: 10000 });
    const paused = await menu(p);
    assert.deepEqual({ ...paused, reward: undefined }, { title: '일시정지', start: '처음부터 다시', resume: true, lobby: true, lobbyText: '대기실', fps: true, reward: undefined, test: false });
    await shot(p, 'pause-journey');
    const before = await store(p);
    await p.locator('#btnLobby').click(); await inLobby(p);
    assert.equal(await p.evaluate(() => game.state), 'menu');
    assert.equal(await inRoot(p, `return root.getElementById('lobbyDepart').textContent`), 'Stage 입장');
    assert.deepEqual(await store(p), before); // 금화 · 대면 결과 · 이어하기 지점 그대로
    assert.equal(await inRoot(p, `return root.getElementById('lobbyCoins').textContent`), String(before.coins));
    await p.waitForTimeout(400); await shot(p, 'lobby-after-pause');
    await depart(p);
    assert.equal(await p.evaluate(() => game.state), 'fight'); // 고른 무기로 그 무대 시작부터 — 카드 없이
    assert.deepEqual(await p.evaluate(() => [game.stage.id, game.player.weapon.id]), [stage0, 'longsword']);
    checks.push({ check: 'title Stage 1 → straight to the card draw (no lobby); pause → 대기실: menu has 대기실 + settings row; lobby opens as Stage 입장; coins · duel record · checkpoint unchanged; departing resumes the same stage with the same weapon', stage0, coins: before.coins });
    // ② 이긴 판 결과 창
    await end(p, 'enemy');
    const won = await menu(p);
    assert.equal(won.title, '승리'); assert.equal(won.start, '다음 여정'); assert.equal(won.lobby, true); assert.equal(won.lobbyText, '대기실'); assert.equal(won.fps, false); assert.equal(won.resume, false);
    assert.match(won.reward, /^금화 \+(\d+)$/);
    const gain = Number(won.reward.match(/\+(\d+)/)[1]);
    assert.ok(gain >= 5 && gain <= 15, won.reward);
    const wonLook = await look(p);
    assert.equal(wonLook.lines.length, 1); assert.equal(wonLook.color, ACCENT); assert.deepEqual(wonLook.icons, ['coin-icon']); assert.ok(wonLook.hidden);
    assert.ok(wonLook.loaded, JSON.stringify(wonLook)); assert.deepEqual(wonLook.size, [14]); assert.equal(wonLook.svg, 0); // 매끈한 금화 그림이 실제로 읽힘 (옛 도트 svg 없음)
    assert.ok(Math.abs(wonLook.gap - wonLook.line) < 0.6, JSON.stringify(wonLook)); // 빈 줄 하나
    await shot(p, 'result-win');
    await p.locator('#btnLobby').click(); await inLobby(p);
    assert.equal(await inRoot(p, `return root.getElementById('lobbyCoins').textContent`), String(before.coins + gain));
    assert.equal(JSON.parse((await store(p)).checkpoint).stage !== stage0, true); // 이긴 순간 다음 무대로 적혀 있다
    await depart(p); await pick(p, 0);
    const stage1 = await p.evaluate(() => game.stage.id);
    assert.notEqual(stage1, stage0);
    checks.push({ check: 'win popup: 승리 · 금화 +N (accent · coin icon · one blank line above) · no settings row · 다음 여정 + 대기실; 대기실 shows the new coins; departing opens the next stage', reward: won.reward, look: wonLook, stage1 });
    // ② 진 판 결과 창 — 상대 대사는 결과 창이 뜨기 전 싸움 화면에만 (14:4x)
    await p.evaluate(() => game.player.die('기절', true));
    const said = await (await p.waitForFunction(() => { const el = document.getElementById('foeIntro'); return el.classList.contains('show') && document.getElementById('menu').classList.contains('show') === false && el.querySelector('span').textContent; }, null, { timeout: 20000 })).jsonValue();
    assert.match(said, /^“[^“”]+”$/); // 싸움 화면 = 이름 + “대사”
    await p.waitForFunction(() => game.state === 'paused' && document.getElementById('menu').classList.contains('show'), null, { timeout: 40000 });
    const lost = await menu(p);
    assert.equal(lost.title, '패배'); assert.equal(lost.start, '다시 겨루기'); assert.equal(lost.lobby, true); assert.equal(lost.fps, false);
    assert.match(lost.reward, /^금화 (−[1-5]|±0)$/);
    const lostLook = await look(p);
    assert.deepEqual(lostLook.lines, ['기절했다']); // 부제 = 진 까닭 한 줄뿐 — 승리 창과 같은 꼴 (14:4x — 전 14:0x 다음 줄 “대사”)
    assert.equal(lostLook.lines.length, wonLook.lines.length);
    assert.equal(lostLook.color, wonLook.color); assert.deepEqual(lostLook.icons, ['coin-icon']); assert.ok(lostLook.loaded && lostLook.hidden); // 잃어도 같은 색 · 같은 금화 그림
    assert.ok(Math.abs(lostLook.gap - lostLook.line) < 0.6, JSON.stringify(lostLook));
    await shot(p, 'result-loss');
    await p.locator('#btnStart').click(); await pick(p, 0);
    assert.equal(await p.evaluate(() => game.stage.id), stage1); // 진 판은 넘어가지 않는다 — 같은 무대
    // 정지 창의 설정 줄은 그대로 (결과 창에서만 뺀다)
    await p.locator('#btnPause').click(); await p.waitForFunction(() => game.state === 'paused', null, { timeout: 10000 });
    assert.equal((await menu(p)).fps, true);
    await p.locator('#btnResume').click();
    checks.push({ said, check: 'loss popup: the foe line shows on the fight screen before the popup · 패배 · cause line only (same shape as the win popup) · 금화 −N in the same accent color with the coin icon after one blank line · no settings row · 다시 겨루기 (same stage) + 대기실; the pause menu keeps the settings row', reward: lost.reward, look: lostLook });
    await c.close();
  }
  // ③ 테스트 경로 · 주소 판 — 메뉴 그대로
  for (const [name, url] of [['test route', '/?test=1&weapon=longsword&stage=castle&foe=isolde'], ['URL fight', '/?weapon=longsword&stage=castle&foe=default']]) {
    const c = await browser.newContext({ viewport: { width: 844, height: 390 }, reducedMotion: 'reduce' }); await noAuth(c);
    const p = await c.newPage(); watch(p);
    await p.goto(base + url, { waitUntil: 'networkidle' }); await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
    assert.equal(await p.locator('#gameEntrance').count(), 0);
    await p.locator('#btnStart').click(); await p.waitForFunction(() => game.state === 'fight', null, { timeout: 30000 });
    await p.locator('#btnPause').click(); await p.waitForFunction(() => game.state === 'paused', null, { timeout: 10000 });
    const paused = await menu(p);
    assert.equal(paused.lobby, false); assert.equal(paused.fps, true);
    await p.locator('#btnResume').click();
    await end(p, 'enemy');
    const won = await menu(p);
    assert.equal(won.lobby, false); assert.equal(won.fps, true); assert.equal(won.reward, null);
    checks.push({ check: `${name}: no 대기실 in the pause or result menu; the result keeps its settings row`, paused, won });
    await c.close();
  }
  // ④ 대기실 캐릭터 돌림판
  {
    const c = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, reducedMotion: 'reduce', hasTouch: true, isMobile: true }); await noAuth(c);
    const p = await c.newPage(); watch(p);
    assert.equal(await lobby(p, '/'), 'draw');
    assert.ok(!/드래그/.test(await inRoot(p, `return root.querySelector('.lobby').textContent`)), 'drag hint text is gone');
    assert.equal(await inRoot(p, `return root.querySelectorAll('.rotate-hint').length`), 0);
    const view = p.locator('#characterView'), box = await view.boundingBox(), cdp = await c.newCDPSession(p);
    const attr = async (k) => view.getAttribute(`data-${k}`);
    const rest = () => p.waitForFunction(() => document.querySelector('#gameEntrance').shadowRoot.getElementById('characterView').dataset.turning === 'false', null, { timeout: 10000 });
    const y = box.y + box.height * 0.5;
    const touch = async (xs, gap, hold) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: xs[0], y }] });
      for (const x of xs.slice(1)) { await p.waitForTimeout(gap); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); }
      if (hold) await p.waitForTimeout(hold);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const x0 = box.x + box.width * 0.2, w = box.width;
    // 천천히 반 칸 · 멈췄다 놓음 → 180° 그대로 (관성 없음)
    await touch([0, 0.1, 0.2, 0.3, 0.4, 0.5].map((f) => x0 + f * w), 40, 250); await rest();
    const slow = Number(await attr('angle'));
    assert.ok(Math.abs(slow - 180) <= 3, `slow half drag → ${slow}`);
    // 튕김 → 손가락이 간 만큼(+108°)보다 더 돌다 선다 · 선 뒤로는 그리지 않음
    const f0 = Number(await attr('frames'));
    await touch([0, 0.1, 0.2, 0.3].map((f) => x0 + f * w), 16, 0);
    await rest();
    const flick = Number(await attr('angle')), f1 = Number(await attr('frames'));
    assert.ok(flick - slow > 108 + 20, `flick coasts: ${slow} → ${flick}`);
    assert.ok(f1 - f0 >= 5, `rendered while turning: ${f0} → ${f1}`);
    await p.waitForTimeout(700);
    assert.equal(Number(await attr('frames')), f1, 'no renders at rest');
    // 막는 각 없음 — 두 바퀴 더(천천히)
    const a0 = Number(await attr('angle'));
    for (let k = 0; k < 2; k++) await touch([0, 0.25, 0.5, 0.75, 1].map((f) => box.x + 0.02 * w + f * w * 0.96), 40, 250), await rest();
    const two = Number(await attr('angle'));
    assert.ok(Math.abs(two - a0 - 2 * 0.96 * 360) <= 6, `two more turns: ${a0} → ${two}`);
    // Home = 가까운 정면 (360 의 배수)
    await view.focus(); await p.keyboard.press('Home'); await rest();
    const home = Number(await attr('angle'));
    assert.equal(((home % 360) + 360) % 360, 0, `home → ${home}`);
    await shot(p, 'lobby-turntable');
    checks.push({ check: 'lobby turntable: no drag hint; slow half drag = 180° with no coast; a flick coasts and stops; no renders at rest; no clamp (two more turns); Home = nearest front', slow, flick, two, home, frames: [f0, f1] });
    await c.close();
  }
  // ⑤ 대기실 무기 = 싸움 무기
  {
    const c = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, reducedMotion: 'reduce' }); await noAuth(c);
    const p = await c.newPage(); watch(p);
    assert.equal(await lobby(p, '/?title=1&cards=longsword,rapier'), 'draw');
    await p.locator('[data-weapon=tree_branch]').click(); await p.locator('#equipItem').click();
    const ready = () => p.waitForFunction(() => document.querySelector('#gameEntrance').shadowRoot.getElementById('characterView').dataset.rig === 'ready', null, { timeout: 60000 });
    await ready();
    // 골반 기준 몸 틀(앞 x · 위 y · 오른쪽 z): 손목(아래팔 끝 = 칼 원점) · 칼끝 · 칼날 축
    const POSE = `const T=game.THREE,V=(v)=>new T.Vector3(v.x,v.y,v.z),Q=(r)=>new T.Quaternion(r.x,r.y,r.z,r.w);const pv=V(f.bodies.pelvis.translation()),inv=f.yaw.clone().invert(),loc=(q)=>q.clone().sub(pv).applyQuaternion(inv);
      const wrist=loc(new T.Vector3(0.13,0,0).applyQuaternion(Q(f.bodies.farmS.rotation())).add(V(f.bodies.farmS.translation()))),tip=loc(f.bladePoint(1)),axis=new T.Vector3(0,1,0).applyQuaternion(Q(f.sword.rotation())).applyQuaternion(inv);
      return {weapon:f.weapon.id,wrist:wrist.toArray(),tip:tip.toArray(),axis:axis.toArray()};`;
    const lobbyPose = await p.evaluate(new Function(`const f=document.querySelector('#gameEntrance').shadowRoot.getElementById('characterView').lobbyPreview.fighter;${POSE}`));
    await depart(p);
    assert.equal(await p.evaluate(() => game.player.weapon.id), 'tree_branch');
    await p.evaluate(() => { game.ai.update = () => {}; });
    const hold = await p.evaluate(() => game.config.ARENA.startHold);
    await p.waitForFunction((t) => game.stats.simTime >= t, hold + 4, { timeout: 180000 });
    const fightPose = await p.evaluate(new Function(`const f=game.player;${POSE}`));
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const ang = (a, b) => (Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180) / Math.PI;
    const diff = { wristCm: +(d(lobbyPose.wrist, fightPose.wrist) * 100).toFixed(2), tipCm: +(d(lobbyPose.tip, fightPose.tip) * 100).toFixed(2), axisDeg: +ang(lobbyPose.axis, fightPose.axis).toFixed(2) };
    assert.equal(lobbyPose.weapon, 'tree_branch');
    assert.ok(diff.wristCm < 2 && diff.tipCm < 3 && diff.axisDeg < 2, JSON.stringify({ diff, lobbyPose, fightPose }));
    checks.push({ check: 'lobby weapon = fight weapon: the equipped branch in the lobby body and in the journey fight (AI paused, settled) — wrist · tip · blade axis relative to the pelvis', diff, hold });
    await c.close();
  }
  assert.deepEqual(errors, []);
} finally {
  fs.writeFileSync(`${out}/ui_fix.json`, JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
console.log(`PASS ${checks.length} ui-fix checks; errors ${errors.length}`);
