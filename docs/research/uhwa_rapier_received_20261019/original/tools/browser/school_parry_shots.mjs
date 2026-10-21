// 유파 막기 자리 캡처 (10/11 …/school-slots — docs/strike/school_slots_2026-10-11.md): AI 가 한 줄을 막는 자세(또는 한 패드 자리)를 붙잡아 한 장씩.
//  AI 의 update 를 시험용으로 바꾼다: 막는 중(mode 'defend', 피하기 아님, defLine = 그 줄)으로 두고 손은 꾸러미 막기 자리(art.school.parry[줄])로 —
//  본판의 막기 덧씌우기(frames.js installCover — 유파 parryCover)가 그대로 돈다. 'pad:<G 열쇠>' 는 막지 않고 그 패드만 든다(자세표 몸꼴).
//  시험만: 플레이어는 맞지 않고 치지 않는다. 콘솔 에러 0 을 본다.
//   SHOTS=highC,thrust,lowL,pad:sideR,pad:sideL  WEAPON=qinggang  PREFIX=school_parry_after  VIEWS=front,side  QUERY=&kronShape=pad  CAM_R=<카메라 거리 m, 기본 3>
//   npx vite build && npx vite preview --port 4193 --strictPort &   node tools/browser/school_parry_shots.mjs http://127.0.0.1:4193 <폴더>
//  PLAYER=1 (10/17 이탈리아 forte 막기 연구 — docs/strike/italian_forte_parry_2026-10-17.md): AI 대신 **플레이어**(이 무기)가 막기 단추(F)를 누른 채 그 줄을 막는 자세를 찍는다.
//   막기 단추 지킴이(parry_button.js — 빈틈 지도 parry_gap_map.mjs 가 재는 그 몸)를 그 줄에 붙잡는다(따라가기 끔 · 상대 AI 는 멈춤). 플레이어 자세는 보정 v2 라 같은 자리라도 AI 와 다를 수 있다.
//   주소: ?weapon=<무기>&foeWeapon=longsword&uniqueStage=<STAGE, 기본 2 — 막기 책까지 '사용'> + QUERY. 줄 이름만(pad: 안 됨)
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4193';
const dir = process.argv[3] || '.';
const PREFIX = process.env.PREFIX || 'school_parry';
const WEAPON = process.env.WEAPON || 'qinggang';
const SHOTS = (process.env.SHOTS || 'highC,thrust,lowL').split(',').filter(Boolean);
const VIEWS = (process.env.VIEWS || 'q34').split(',').filter(Boolean);
const CAM_R = +(process.env.CAM_R ?? 3.0); // 10/17 카메라 거리 — 가까이 찍기 (기본 3 m 그대로)
const PLAYER = !!+(process.env.PLAYER ?? 0); // 10/17 플레이어 막기 단추 자세 찍기 (위 머리말)
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const out = {};
for (const sh of SHOTS) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 480 }, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror ' + e));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const url = PLAYER ? `${base}/?weapon=${WEAPON}&foeWeapon=longsword&uniqueStage=${process.env.STAGE ?? 2}` : `${base}/?weapon=longsword&foeWeapon=${WEAPON}`;
  await page.goto(`${url}${process.env.QUERY ?? ''}`, { waitUntil: 'networkidle' }); // QUERY: 덧붙일 주소 (10/12 왕관 꼴 — '&kronShape=pad')
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
  await page.getByText('여정 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.ai, null, { timeout: 60000 });
  await page.evaluate(([sh, PLAYER]) => {
    document.getElementById('techCue').style.visibility = 'hidden';
    // 10/16 판 시작 글(가운데 소개 · '대면' 알림 · 조작 안내)과 조작 단추가 몸을 가리지 않게 (자세 사진만)
    for (const id of ['toast', 'foeIntro', 'hint', 'moveStick', 'btnParry', 'guardName', 'staminaHud', 'stageInfo', 'topButtons']) {
      const el = document.getElementById(id);
      if (el) el.style.visibility = 'hidden';
    }
    const g = window.game;
    const ai = g.ai;
    g.player.applyWound = () => {};
    g.enemy.applyWound = () => {};
    if (PLAYER) {
      // 플레이어 막기 단추를 그 줄에 붙잡는다: 상대 AI 는 멈추고, 지킴이의 줄을 스텝마다 sh 로 (새 위협 · 끝내기 · 따라가기 없음 — 시험만)
      ai.update = (dt) => {
        ai.sense.record(dt);
        ai.me.move.set(0, 0);
      };
      g.config.SKILL.parryFollow = 0;
      const G = g.playerGuard;
      const st = G.step.bind(G);
      G.step = (dt) => {
        Object.assign(G, { defLine: sh, timer: 100, threatSeen: G.threatId, noThreat: 0 });
        return st(dt);
      };
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' })); // 막기 단추 누름 (keyup 없음 — 누른 채)
      return;
    }
    const pad = sh.startsWith('pad:') ? null : ai.school.parry[sh];
    const key = sh.startsWith('pad:') ? sh.slice(4) : null;
    window.__shotPad = pad ?? null;
    ai.update = (dt) => {
      ai.sense.record(dt);
      ai.me.move.set(0, 0);
      if (pad) Object.assign(ai, { mode: 'defend', phase: 'guard', defVoid: false, defLine: sh });
      else ai.mode = 'watch';
      const p = pad ?? window.__G[key];
      ai.hand.set(p[0], p[1]);
      ai.handSpeed = 2.5;
      ai.moveHand(dt);
    };
  }, [sh, PLAYER]);
  // 패드 표 (G) 를 페이지에 둔다 — 꾸러미 watch 목록에서 찾는다
  await page.evaluate(() => {
    const g = window.game;
    const G = {};
    for (const w of g.ai.school.guards) G[w.name] = w.pad;
    G.sideL = [-0.52, 0.06]; G.sideR = [0.52, 0.06]; G.tag = [0.02, 0.52]; G.langort = [0, 0.03]; G.wechselR = [0.38, -0.44]; G.ochsL = [-0.22, 0.26];
    window.__G = G;
    g.player.skill && (g.player.inputActive = false);
  });
  // 손이 자리에 붙을 때까지 판 시간으로 1.4 s (헤드리스 소프트 렌더는 판 시간이 느리게 간다 — 벽시계로 기다리지 않는다)
  const t0 = await page.evaluate(() => window.game.stats.simTime);
  await page.waitForFunction((t0) => window.game.stats.simTime > t0 + 1.4, t0, { timeout: 300000, polling: 200 });
  const info = await page.evaluate((PLAYER) => {
    const g = window.game, f = PLAYER ? g.player : g.enemy;
    const ct = f.bodies.chest.translation();
    const V = (a) => [a.x, a.y, a.z];
    const p0 = V(f.bladePoint(0)), p1 = V(f.bladePoint(1));
    const F = V(f.forward()), Rt = V(f.right());
    const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const rel = [p0[0] - ct.x, p0[1] - ct.y, p0[2] - ct.z];
    const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const L = Math.hypot(...d) || 1;
    return { mode: PLAYER ? g.playerGuard.mode : g.ai.mode, cover: +(f.skill._cover?.w ?? 0).toFixed(2), hand: [dot(rel, F), rel[1], f.side * dot(rel, Rt)].map((x) => +x.toFixed(2)),
      tip: [+((Math.asin(d[1] / L) * 180) / Math.PI).toFixed(0), +((Math.atan2(f.side * dot(d, Rt), dot(d, F)) * 180) / Math.PI).toFixed(0)] };
  }, PLAYER);
  out[sh] = info;
  await page.evaluate(() => { const g = window.game; if (g.state === 'fight') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); document.getElementById('menu').style.visibility = 'hidden'; });
  for (const view of VIEWS) {
    await page.evaluate(([view, R, PLAYER]) => {
      const g = window.game, f = PLAYER ? g.player : g.enemy, o = PLAYER ? g.enemy : g.player;
      const b = f.bodies.chest.translation(), a = o.bodies.chest.translation();
      let fx = a.x - b.x, fz = a.z - b.z;
      const L = Math.hypot(fx, fz) || 1;
      fx /= L; fz /= L;
      const rx = -fz, rz = fx, s = f.side;
      const ang = { front: [0.85, 0.53], side: [0, 1], q34: [0.5, 0.87] }[view];
      const cx = fx * ang[0] + rx * s * ang[1], cz = fz * ang[0] + rz * s * ang[1];
      g.freeCam = true;
      g.camera.position.set(b.x + cx * R, 1.5, b.z + cz * R);
      g.camera.lookAt(b.x, 1.25, b.z);
    }, [view, CAM_R, PLAYER]);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${dir}/${PREFIX}_${sh.replace(':', '-')}_${view}.png` });
  }
  await ctx.close();
}
console.log('OUT ' + JSON.stringify(out));
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
