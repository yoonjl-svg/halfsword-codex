// 겹치기 단순 길 · 앞 박차기 — 실제 빌드 옆 모습 장면 (사장님 10/31 19:xx '손 동작과 발 동작이 어우러져야 하니까. 그게 최우선.' — 기록 docs/strike/duplieren_simple_2026-10-31.md)
//  빌드(dist)를 정적 서버로 · 롱소드 대 롱소드 · `?skillNodes=G7` · 상대 멈춤(긴 자세 · 안 다침) · 시작 가슴 사이 GAP · 칼끼리 닿음만 손으로 놓음(bladeTouch 참 — 겹치기 자동 'bind' 0.6 s 가 차서 나감).
//  화면 프레임을 손으로 넘김(requestAnimationFrame 를 붙잡아 한 프레임 = 물리 한 스텝 1/120 s) → 겹치기 운동학 칼이 시작한 스텝부터 STEP 스텝마다 옆 카메라로 찍음 · 그때 몸 값(발 딛음 · 골반 · 칼끝)을 함께 적음.
//  판: old = `?dupOld=1`(10/28 길 · 몫 0.5 · 박차기 없음) · new = 이 가지 기본(단순 길 · 앞 박차기 · 몫)
//  실행: npx vite build → python3 -m http.server <포트> --directory dist --bind 127.0.0.1 & · node tools/browser/duplieren_simple_shots.mjs http://127.0.0.1:<포트> [폴더 (기본 .tmp/dup_simple_shots)]
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // 전역 설치(NODE_PATH)도 찾음
const base = process.argv[2] || 'http://127.0.0.1:5412';
const out = process.argv[3] || '.tmp/dup_simple_shots';
fs.mkdirSync(out, { recursive: true });
const GAP = +(process.env.GAP || 1.25);
const STEP = +(process.env.STEP || 6); // 찍는 간격 (물리 스텝 — 6 = 0.05 게임 초)
const N = +(process.env.N || 7);
const PAD = (process.env.PAD || '-0.05,0.2').split(',').map(Number); // 맞대는 손 자리 (패드)
const SH = (process.env.SHARES || '').split(',').filter(Boolean); // 몫 견줌 (예 SHARES=0.1,0.2,0.3 → new_0.1 · new_0.2 · …)
const CASES = [
  ['old', '&dupOld=1'],
  ['new', ''],
  ...SH.map((x) => [`new_${x}`, `&specialShare=duplieren:${x}`]),
].filter(([t]) => !process.env.TAGS || process.env.TAGS.split(',').includes(t));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const res = {};
for (const [tag, extra] of CASES) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 400 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => {
    // 손으로 넘기는 화면 프레임: __manual 이 참이면 rAF 콜백을 모아 두고 __frames(n, ms) 가 n 번 부름 (now 는 ms 씩 늘림)
    const real = window.requestAnimationFrame.bind(window);
    window.__manual = false;
    window.__q = [];
    window.__now = 0;
    window.requestAnimationFrame = (cb) => {
      if (window.__manual) {
        window.__q.push(cb);
        return 1;
      }
      return real((t) => {
        window.__now = t;
        cb(t);
      });
    };
    window.__frames = (n, ms) => {
      for (let i = 0; i < n; i++) {
        const q = window.__q;
        window.__q = [];
        window.__now += ms;
        for (const cb of q) cb(window.__now);
      }
    };
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/?weapon=longsword&foeWeapon=longsword&skillNodes=G7&slowMo=0&camOpen=old${extra}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 240000 });
  await page.evaluate((gap) => { game.config.ARENA.startGap = gap; game.config.ARENA.startHold = 0; if (game.settings) game.settings.fpsCap = false; }, GAP);
  await page.getByText('여정 시작', { exact: true }).click();
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.stats.simTime > 0.3, null, { timeout: 240000 });
  const kit = await page.evaluate((pad) => {
    const g = window.game, p = g.player, e = g.enemy, u = p.skill.uniq;
    const UA = g.config.UNIQUE_ASSIST;
    g.ai.update = () => e.move.set(0, 0);
    e.applyWound = () => {};
    if (!u) return { err: 'no uniq' };
    u.bladeTouch = () => !p.feetHeld; // 칼끼리 닿음 (bind 쌓임) — 판 시작 발 묶임(브라우저는 카메라 길이만큼)이 풀린 뒤부터 (묶인 발은 걸음을 안 받음)
    window.__pad = pad;
    const st0 = p.step.bind(p);
    p.step = function (dt) {
      // 맞대는 손 자리 (손가락 대신 — 겹치기가 나가기 전까지만)
      if (!p.iai && !window.__fired) {
        p.handOffset.set(window.__pad[0], window.__pad[1]);
        const sk = p.skill;
        for (const k of ['prev', 'aim', 'aimRaw', 'anchor']) sk[k]?.set(window.__pad[0], window.__pad[1]);
        for (const k of ['aimVel', 'vel']) sk[k]?.set(0, 0);
      }
      if (p.iai?.tech === 'duplieren') window.__fired = true;
      return st0(dt);
    };
    return { dupOld: UA.dupOld, share: UA.specialShare.duplieren, burst: UA.dupBurst, axisMax: UA.dupAxisMax, tempo: g.config.TIME.tempo, dist: +p.foeDistance().toFixed(3) };
  }, PAD);
  // 쌓임이 거의 찰 때까지 그대로 돌림 → 손 넘김
  await page.waitForFunction(() => { const u = window.game.player.skill.uniq; return (u.dupA?.st ?? 0) > window.game.config.UNIQUE_ASSIST.dupStackS - 0.08 || window.game.player.iai; }, null, { timeout: 600000, polling: 50 });
  const ms = 1000 / 120 / (await page.evaluate(() => window.game.config.TIME.tempo)); // 한 프레임 = 물리 한 스텝
  await page.evaluate(() => { window.__manual = true; });
  await page.waitForTimeout(300);
  // 운동학 칼 시작까지 한 스텝씩
  let k = 0;
  for (; k < 200; k++) {
    const on = await page.evaluate((m) => { window.__frames(1, m); return window.game.player.iai?.tech === 'duplieren'; }, ms);
    if (on) break;
  }
  const shots = [];
  const side = (tagN) =>
    page.evaluate(() => {
      const g = window.game, p = g.player, e = g.enemy;
      const a = window.__c0 ?? (window.__c0 = { ...p.bodies.chest.translation() });
      const b = e.bodies.chest.translation();
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      const dx = b.x - a.x, dz = b.z - a.z;
      const L = Math.hypot(dx, dz) || 1;
      g.freeCam = true;
      // 내 칼 든 쪽(오른쪽)에서 본 옆 — 상대 쪽이 화면 오른쪽
      g.camera.position.set(mx + (dz / L) * 3.0, 1.25, mz - (dx / L) * 3.0);
      g.camera.lookAt(mx, 1.05, mz);
      const pel = p.bodies.pelvis.translation();
      const L2 = p.gait?.legs;
      const tip = p.bladePoint(1);
      const loc = (q) => +(((q.x - a.x) * dx + (q.z - a.z) * dz) / L).toFixed(3);
      return { sim: +g.stats.simTime.toFixed(3), iai: p.iai?.tech ?? null, t: p.iai ? +p.iai.t.toFixed(3) : null, pel: loc(pel), tip: loc(tip), tipY: +tip.y.toFixed(3), F: L2 ? { st: L2.F.stance ? 1 : 0, k: L2.F.kind, x: loc(L2.F.plant) } : null, B: L2 ? { st: L2.B.stance ? 1 : 0, k: L2.B.kind, x: loc(L2.B.plant) } : null, d: +p.foeDistance().toFixed(3), burst: p.iai?.burst ?? null, dup: p.iai?.dup ? { sweep: p.iai.dup.sweep, psi: p.iai.dup.psi } : null };
    });
  for (let i = 0; i < N; i++) {
    const info = await side();
    await page.evaluate((m) => window.__frames(1, 0.001), ms); // 같은 자리에서 한 번 더 그림 (카메라 옮긴 것 반영)
    const path = `${out}/${tag}_${String(i).padStart(2, '0')}.png`;
    await page.screenshot({ path });
    shots.push({ i, step: i * STEP, path, ...info });
    // 다음 찍을 때까지 게임 시간으로 STEP 스텝 (맞는 순간 멈칫 IMPACT_FX 동안은 화면 프레임이 더 듦 — 게임 시간으로 셈)
    await page.evaluate(([m, n]) => {
      const g = window.game;
      const goal = g.stats.simTime + n / 120 - 1e-6;
      for (let j = 0; j < 600 && g.stats.simTime < goal; j++) window.__frames(1, m);
    }, [ms, STEP]);
  }
  res[tag] = { kit, shots, errors: errors.slice(0, 5), preSteps: k };
  console.log(tag, JSON.stringify({ kit, preSteps: k, errors, burst: shots[0]?.burst, dup: shots[0]?.dup, shots: shots.map((s) => ({ i: s.i, iai: s.iai, t: s.t, pel: s.pel, tip: s.tip, F: s.F, B: s.B, d: s.d })) }));
  await ctx.close();
}
fs.writeFileSync(`${out}/result.json`, JSON.stringify(res, null, 1));
await browser.close();
