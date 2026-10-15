// 이베리아 비기 흐름 확인 (10/11 — docs/strike/iberian_secret_v5_2026-10-11.md): 플레이어 츠바이핸더로 비기를 내고, 물리 스텝마다 칼끝 빠르기·비기 단계·수 이름·손 패드를 적는다.
//  비기를 낸 끌기가 첫 수의 쪽을 정하는지(흐름 이어받기), 수 사이에 칼끝이 멈추지 않는지(칼끝 빠르기 바닥)를 본다. 수마다 한 번 멈춰(일시정지) 옆에서 찍는다.
//  상대 AI 는 멈춰 둔다(game.ai.update 비움 — 비기 길만 보려고. 상대는 서 있는 몸). 창은 직접 연다(조건 '호 안쪽'을 기다리지 않음).
//  실행: npx vite build && npx vite preview --port 4190 --strictPort &
//        node tools/browser/iberian_flow_probe.mjs http://127.0.0.1:4190 <폴더> [flow|v4] [무기 id (기본 zweihander)] [끌기 dx,dy px (기본 -16,12 = 왼 아래)]
//  내놓는 것: <폴더>/ibflow_<판>_<무기>.json (스텝 기록) · ibflow_<판>_<무기>_<n>.png (수마다 옆 모습) · 콘솔 SUMMARY · ERRORS. 끝 코드 0 = 콘솔 에러 0 + 비기가 끝까지 감
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4190';
const dir = process.argv[3] || '.';
const ver = process.argv[4] || 'flow';
const weapon = process.argv[5] || 'zweihander';
const [DX, DY] = (process.argv[6] || '-16,12').split(',').map(Number);
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
// openSweep=0: 판 시작을 9/30 꼴(정지 2 s)로 — 10/15 무대 훑기는 첫 판 3.3 게임 초 발을 묶어 아래 2.6 s 가 어긋난다 (docs/strike/camera_open_2026-10-15.md)
await page.goto(`${base}/?weapon=${weapon}&foeWeapon=longsword&ibSecret=${ver}&slowMo=0&openSweep=0`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
await page.getByText('여정 시작').click();
await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret, null, { timeout: 60000 });
await page.waitForFunction(() => window.game.stats.simTime > 2.6, null, { timeout: 120000 }); // 시작 정지(startHold) 뒤
// 상대 멈춤 + 스텝 기록기
const S = await page.evaluate(() => {
  const g = window.game;
  g.ai.update = () => {};
  const p = g.player;
  const rec = (window.__rec = []);
  const step0 = p.step.bind(p);
  p.step = (dt) => {
    step0(dt);
    const sec = p.skill.sec;
    rec.push({ t: +g.stats.simTime.toFixed(4), v: +p.tipVel.length().toFixed(3), st: sec?.stage ?? null, n: sec?.cur?.name ?? (sec ? sec.S.name : null), q: sec?.queue?.length ?? 0, pl: sec?.path?.length ?? 0, hx: +p.handOffset.x.toFixed(3), hy: +p.handOffset.y.toFixed(3), d: +p.foeDistance().toFixed(2) });
  };
  return { S: g.playerSecret.S?.name, reach: p.swordArt.measure.reach };
});
console.log(`WEAPON ${weapon} 판 ${ver} 비기 ${S.S} reach ${S.reach.toFixed(2)}`);
// 상대에게 다가간다 (W) — 닿는 거리 안쪽까지
await page.keyboard.down('KeyW');
await page.waitForFunction((r) => window.game.player.foeDistance() < r - 0.2, S.reach, { timeout: 120000 }).catch(() => {});
await page.keyboard.up('KeyW');
await page.waitForTimeout(300);
// 창을 열고 끌기 한 번 (비기를 낸 끌기 = 흐름의 방향)
await page.evaluate(() => {
  const ps = window.game.playerSecret;
  if (!ps.open) ps.openWindow(null);
  ps.open.t = 5;
  window.__fireT = window.game.stats.simTime;
});
const dragDone = page.evaluate(
  async ([dx, dy]) => {
    const cv = document.getElementById('game');
    let x = 640, y = 150;
    const o = () => ({ pointerId: 81, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true, button: 0 });
    cv.dispatchEvent(new PointerEvent('pointerdown', o()));
    for (let i = 0; i < 10; i++) {
      x += dx;
      y += dy;
      window.dispatchEvent(new PointerEvent('pointermove', o()));
      await new Promise((r) => setTimeout(r, 25));
    }
    window.dispatchEvent(new PointerEvent('pointerup', o()));
  },
  [DX, DY],
);
// 수마다 한 번 멈춰 옆에서 찍는다: 흐름은 올려베기 둘 · 둘러 베는 큰 칼 — 그 토막의 길 점이 하나 이하 남았을 때(칼이 그 토막 끝으로 가는 중), v4 는 휩쓸기 동안 시간 몫
const freeze = (on) => page.evaluate((on) => { const g = window.game; if (on && g.state === 'fight') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); if (!on && g.state === 'paused') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); document.getElementById('menu').style.visibility = on ? 'hidden' : ''; }, on);
const shoot = async (k, label) => {
  await freeze(true);
  const info = await page.evaluate(() => {
    const g = window.game, f = g.player, o = g.enemy;
    const b = f.bodies.chest.translation(), a = o.bodies.chest.translation();
    let fx = a.x - b.x, fz = a.z - b.z;
    const L = Math.hypot(fx, fz) || 1;
    fx /= L; fz /= L;
    const rx = -fz, rz = fx, s = -f.side;
    const R = 3.0;
    g.freeCam = true;
    g.camera.position.set(b.x + fx * 0.6 + rx * s * R, 1.3, b.z + fz * 0.6 + rz * s * R);
    g.camera.lookAt(b.x + fx * 0.6, 1.15, b.z + fz * 0.6);
    const sec = f.skill.sec;
    return { t: +g.stats.simTime.toFixed(3), n: sec?.cur?.name ?? sec?.stage ?? null, v: +f.tipVel.length().toFixed(2), h: [+f.handOffset.x.toFixed(2), +f.handOffset.y.toFixed(2)] };
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/ibflow_${ver}_${weapon}_${k}.png` });
  await page.evaluate(() => (window.game.freeCam = false));
  await freeze(false);
  console.log(`SHOT ${k} ${label} ${JSON.stringify(info)}`);
};
const t0 = Date.now();
const seen = new Set();
let k = 0;
let fired = false;
let lastStage = null;
const stages = [];
while (Date.now() - t0 < 240000) {
  const r = await page.evaluate(() => { const s = window.game.player.skill.sec; return s ? { st: s.stage, n: s.cur?.name ?? null, pl: s.path?.length ?? 0, t: s.t, ins: !!s.instant } : null; });
  if (r) fired = true;
  const st = r ? `${r.st}:${r.n ?? ''}` : null;
  if (st !== lastStage) stages.push(st);
  lastStage = st;
  if (fired && !r) break;
  if (r && ver === 'flow' && r.st === 'strike' && r.n && !/Fall|Over/.test(r.n) && r.pl <= 1 && !seen.has(r.n)) {
    seen.add(r.n);
    await shoot(++k, r.n);
  }
  if (r && ver !== 'flow' && r.st === 'instant' && k < 3) {
    const want = [0.06, 0.13, 0.2][k];
    const tt = await page.evaluate(() => window.game.stats.simTime - window.__fireT);
    if (tt >= want) await shoot(++k, `sweep ${want}s`);
  }
  if (r && r.st === 'stiff' && !seen.has('stiff')) {
    seen.add('stiff');
    if (ver !== 'flow' && k < 3) await shoot(++k, 'stiff');
  }
  await page.waitForTimeout(15);
}
await dragDone;
await page.waitForTimeout(400);
const rec = await page.evaluate(() => ({ rec: window.__rec, fireT: window.__fireT }));
fs.writeFileSync(`${dir}/ibflow_${ver}_${weapon}.json`, JSON.stringify(rec));
// 요약: 비기 낸 때부터 끝(경직 끝)까지 — 수마다 칼끝 최고·바닥, 수 사이 이음새 칼끝 빠르기, 경직 동안
const R = rec.rec.filter((x) => x.t >= rec.fireT - 0.3);
const segs = [];
for (const x of R) {
  const key = x.st === 'stiff' ? 'stiff' : x.st ? x.n : 'off';
  if (!segs.length || segs[segs.length - 1].key !== key) segs.push({ key, t0: x.t, t1: x.t, vmax: 0, vmin: Infinity, h0: [x.hx, x.hy] });
  const s = segs[segs.length - 1];
  s.t1 = x.t;
  s.vmax = Math.max(s.vmax, x.v);
  s.vmin = Math.min(s.vmin, x.v);
}
const run = R.filter((x) => x.st && x.st !== 'stiff');
const vMinRun = run.length ? Math.min(...run.slice(3).map((x) => x.v)) : null;
console.log('STAGES ' + JSON.stringify(stages));
console.log('SEGS ' + segs.map((s) => `${s.key} ${(s.t1 - s.t0).toFixed(2)}s 최고 ${s.vmax.toFixed(1)} 바닥 ${s.vmin.toFixed(1)} 시작 손 [${s.h0}]`).join(' | '));
console.log(`SUMMARY 비기 동안(경직 앞) ${run.length} 스텝 · ${(run.length / 120).toFixed(2)} s · 칼끝 최고 ${run.length ? Math.max(...run.map((x) => x.v)).toFixed(1) : '-'} m/s · 바닥(첫 3 스텝 뺌) ${vMinRun?.toFixed(1)} m/s`);
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
process.exit(!errors.length && fired ? 0 : 1);
