// 카메라 따라가기 브라우저 확인 (10/15 — docs/strike/camera_open_2026-10-15.md §2): 실제 게임 페이지(main.js updateCamera)를 가상 시계 60 fps 로 돌려
//  키보드(S 뒤 · W 앞 · A 왼 · D 오른, 끝까지)로 걸으며 화면마다 카메라 자리 · 내 무게중심을 적는다 → 지연(진행 방향으로 있어야 할 자리에서 뒤처진 몫 ÷ 빠르기, 실제 초) · 카메라-몸 수평 거리 · 흔들림.
//  끝에 서 있다가 S 를 0.3 s 만 누르는 뒤 박차기 셋(첫 걸음 박차기 GAIT.stepBurst — 0.3 s 에 ≈ 0.40 m): 박차기마다 카메라-몸 거리 최소 · 뒤처짐 최대 · 올림.
//  가상 시계: requestAnimationFrame · performance.now 를 바꿔 한 화면 = 1/60 s (소프트웨어 그리기가 느려도 게임 시간은 60 fps 그대로). 그리기를 빨리 하려고 작은 창.
//  실행: 개발 서버를 띄운 뒤  node tools/browser/cam_follow_browser.mjs http://127.0.0.1:5191 [추가 주소 인자 …]
//   예: 새 카메라 = 인자 없음 · 옛 카메라 = camFollow=old · 전 걷기 빠르기 = walk=old (둘 다: camFollow=old walk=old)
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:5191';
const extra = process.argv.slice(3).filter((a) => !a.startsWith('--')).map((a) => `&${a}`).join('');
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 420, height: 200 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.addInitScript(() => {
  let vt = 0;
  performance.now = () => vt;
  let q = [];
  window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
  window.__tick = (n, rec) => {
    for (let i = 0; i < n; i++) {
      vt += 1000 / 60;
      const list = q; q = [];
      for (const cb of list) cb(vt);
      if (rec) {
        const g = window.game;
        const c = g.player.com || g.player.bodies.pelvis.translation();
        const r = g.camRig;
        window.__rec.push({ t: vt / 1000, fightT: g.player.fightT, cx: g.camera.position.x, cy: g.camera.position.y, cz: g.camera.position.z, px: c.x, pz: c.z, dx: r.dir.x, dz: r.dir.z, lift: r.lift, stand: g.player.state === 'stand', key: window.__key });
      }
    }
  };
  window.__rec = [];
  window.__key = '';
});
await page.goto(`${base}/?stage=poseidon&weapon=longsword${extra}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
await page.evaluate(() => window.__tick(5));
await page.evaluate(() => document.getElementById('btnStart').click());
await page.evaluate(() => window.__tick(2));
// 판 시작이 끝나 발이 풀릴 때까지 + 0.5 s
for (let k = 0; k < 40; k++) {
  const free = await page.evaluate(() => { window.__tick(15); return window.game.state === 'fight' && !window.game.player.feetHeld; });
  if (free) break;
}
await page.evaluate(() => window.__tick(30));
const plan = [['KeyS', 2.0], ['', 1.0], ['KeyW', 2.0], ['', 1.0], ['KeyA', 2.0], ['', 1.0], ['KeyD', 2.0], ['', 1.0], ['KeyW', 1.2], ['', 1.5], ['KeyS*', 0.3], ['', 1.5], ['KeyS*', 0.3], ['', 1.5], ['KeyS*', 0.3], ['', 1.0]]; // KeyS* = 박차기(짧게)
for (const [key, sec] of plan) {
  await page.evaluate((key) => { window.__key = key; if (key) window.dispatchEvent(new KeyboardEvent('keydown', { code: key.replace('*', '') })); }, key);
  const frames = Math.round(sec * 60);
  for (let f = 0; f < frames; f += 30) await page.evaluate((n) => window.__tick(n, true), Math.min(30, frames - f));
  await page.evaluate((key) => { if (key) window.dispatchEvent(new KeyboardEvent('keyup', { code: key.replace('*', '') })); }, key);
}
const R = await page.evaluate(() => window.__rec);
const info = await page.evaluate(() => ({ gait: [window.game.config.GAIT.moveSpeed, window.game.config.GAIT.backFactor, window.game.config.GAIT.sideFactor], tempo: window.game.tempo, state: window.game.state }));
await browser.close();

const C = window_free_metrics(R);
console.log(`브라우저 따라가기 — 주소 인자 '${extra || '(없음)'}' · 걷기 ${info.gait.join(' / ')} · 템포 ${info.tempo} · 화면 ${R.length} · 콘솔 오류 ${errors.length}`);
for (const r of C.bursts) console.log(`  뒤 박차기 0.3 s 간 ${r.moved.toFixed(2)} m · 몸 최고 ${r.vmax.toFixed(2)} m/s · 카메라-몸 거리 최소 ${r.dmin.toFixed(2)} m · 뒤처짐 최대 ${(r.lagMax * 1000).toFixed(0)} mm · 카메라 높이 변화 ${r.lift.toFixed(2)} m`);
for (const r of C.rows) console.log(`  ${r.name.padEnd(5)} 빠르기 ${r.sp.toFixed(2)} m/s · 지연 ${(r.lag * 1000).toFixed(0).padStart(4)} ms · 거리 평균 ${r.dMean.toFixed(2)} (최소 ${r.dMin.toFixed(2)} · 최대 ${r.dMax.toFixed(2)}) m · 올림 최대 ${r.lift.toFixed(2)} m`);
console.log(`  흔들림 (mm, 둘째 차분 · 0.033 s 가우스 나머지): 서 있기 ${C.still.d2.toFixed(2)} · ${C.still.hp.toFixed(2)} · 걷기 ${C.walk.d2.toFixed(2)} · ${C.walk.hp.toFixed(2)}`);
if (errors.length) console.log('  ' + errors.slice(0, 10).join('\n  '));

function window_free_metrics(R) {
  const NAME = { KeyS: '뒤', KeyW: '앞', KeyA: '왼', KeyD: '오른', 'KeyS*': '박차기' };
  const BACK = 2.9, SH = 0.9;
  const rows = [];
  const segs = [];
  for (let i = 0; i < R.length; i++) if (!i || R[i].key !== R[i - 1].key) segs.push({ key: R[i].key, a: i, b: i });
  for (let i = 0, s = 0; i < R.length; i++) { while (s + 1 < segs.length && segs[s + 1].a <= i) s++; segs[s].b = i; }
  const bursts = [];
  for (const s of segs) {
    if (s.key !== 'KeyS*') continue;
    const end = R[s.b].t + 0.6;
    const idx = [];
    for (let i = s.a; i < R.length && R[i].t <= end; i++) idx.push(i);
    const i0 = idx[0], i3 = idx.find((i) => R[i].t >= R[i0].t + 0.3 / 1.1) ?? idx.at(-1); // 0.3 게임 초 = 0.273 실제 초
    const mx = R[i3].px - R[i0].px, mz = R[i3].pz - R[i0].pz, moved = Math.hypot(mx, mz), ux = mx / (moved || 1), uz = mz / (moved || 1);
    let vmax = 0, dmin = Infinity, lagMax = 0;
    for (let j = 1; j < idx.length; j++) {
      const a = R[idx[j - 1]], c = R[idx[j]];
      vmax = Math.max(vmax, Math.hypot(c.px - a.px, c.pz - a.pz) / (c.t - a.t));
      dmin = Math.min(dmin, Math.hypot(c.cx - c.px, c.cz - c.pz));
      const ix = c.px - c.dx * BACK - c.dz * SH, iz = c.pz - c.dz * BACK + c.dx * SH;
      lagMax = Math.max(lagMax, (ix - c.cx) * ux + (iz - c.cz) * uz);
    }
    const ys = idx.map((i) => R[i].cy);
    bursts.push({ moved, vmax, dmin, lagMax, lift: Math.max(...ys) - Math.min(...ys) });
  }
  for (const s of segs) {
    if (!s.key || s.key === 'KeyS*' || s.key === 'KeyW' && s.b - s.a < 90) continue;
    const idx = [];
    for (let i = s.a; i <= s.b; i++) if (R[i].t >= R[s.a].t + 0.5) idx.push(i);
    if (idx.length < 5) continue;
    const i0 = idx[0], i1 = idx.at(-1);
    const vx = (R[i1].px - R[i0].px) / (R[i1].t - R[i0].t), vz = (R[i1].pz - R[i0].pz) / (R[i1].t - R[i0].t);
    const sp = Math.hypot(vx, vz), ux = vx / sp, uz = vz / sp;
    let lag = 0; const d = [];
    for (const i of idx) {
      const c = R[i];
      const ix = c.px - c.dx * BACK - c.dz * SH, iz = c.pz - c.dz * BACK + c.dx * SH;
      lag += (ix - c.cx) * ux + (iz - c.cz) * uz;
      d.push(Math.hypot(c.cx - c.px, c.cz - c.pz));
    }
    rows.push({ name: NAME[s.key], sp, lag: lag / idx.length / sp, dMean: d.reduce((a, b) => a + b, 0) / d.length, dMin: Math.min(...d), dMax: Math.max(...d), lift: Math.max(...R.slice(s.a, s.b + 1).map((r) => r.cy)) - Math.min(...R.slice(s.a, s.b + 1).map((r) => r.cy)) });
  }
  const gauss = (v, sg) => { const r = Math.ceil(4 * sg); const w = []; let ws = 0; for (let i = -r; i <= r; i++) { const x = Math.exp(-0.5 * (i / sg) ** 2); w.push(x); ws += x; } return v.map((_, i) => { let a = 0; for (let j = -r; j <= r; j++) a += w[j + r] * v[Math.min(v.length - 1, Math.max(0, i + j))]; return a / ws; }); };
  const jit = (idx) => {
    const X = R.map((r) => r.cx), Z = R.map((r) => r.cz), sx = gauss(X, 2), sz = gauss(Z, 2);
    const hp = idx.map((i) => Math.hypot(X[i] - sx[i], Z[i] - sz[i]) * 1000);
    const d2 = idx.filter((i) => i > 0 && i < R.length - 1).map((i) => Math.hypot(X[i + 1] - 2 * X[i] + X[i - 1], Z[i + 1] - 2 * Z[i] + Z[i - 1]) * 1000);
    const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / Math.max(1, a.length));
    return { d2: rms(d2), hp: rms(hp) };
  };
  const still = [], walk = [];
  for (const s of segs) for (let i = s.a; i <= s.b; i++) { const age = R[i].t - R[s.a].t; if (!s.key && age > 0.6) still.push(i); if (s.key && age > 0.3) walk.push(i); }
  return { rows, bursts, still: jit(still), walk: jit(walk) };
}
