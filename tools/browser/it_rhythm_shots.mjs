// 이탈리아 박자 걸음 브라우저 확인 (10/15 — docs/strike/italian_rhythm_2026-10-15.md): 테스트 경로에서 레이피어 플레이어가 짝걸음으로 물러나는 장면 —
//  셋째 걸음(보통) · 넷째 걸음(빠름) 이끄는 발 · 넷째 걸음 따라붙는 발 · 다섯째 걸음(보통)을 뗄 때 멈춰 옆에서 한 장씩(같은 카메라 자리) → <출력>/it_rhythm_N.png.
//  상대는 가슴 거리 2.3 m 를 지키게(다가오거나 물러남만 — 칼은 안 씀) 하고 둘 다 상처를 끈다(걸음·물리 그대로). 화면 왼쪽 위 글은 이 도구가 붙인 설명(게임 화면 글 아님).
//  이어서 `?itRhythm=4`·`?itRhythm=0` 으로 다시 열어 주기 값이 들어가는지와 빠른 걸음 차례(센 걸음 몇째가 빠른가)·발소리 부름(그중 강조 붙은 수)을 읽는다. 콘솔 오류 0 을 본다.
//  실행: npx vite --port 5404 --strictPort (자기 포트·자기 캐시 폴더) & → node tools/browser/it_rhythm_shots.mjs http://127.0.0.1:5404 <출력 폴더>
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:5404';
const dir = process.argv[3] || '.';
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const report = {};

async function open(extra = '') {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`);
  });
  await page.goto(`${base}/index.html?test=1&weapon=rapier&hero=player&foe=isolde&stage=castle${extra}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword && document.getElementById('btnStart'), null, { timeout: 120000 });
  await page.evaluate(() => document.getElementById('btnStart').click());
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 120000 });
  await page.evaluate(async () => {
    const g = window.game;
    const P = g.player;
    const E = g.enemy;
    const { TRADITIONS } = await import('/src/schools.js');
    const lab = document.createElement('div');
    lab.id = 'shotLabel';
    lab.style.cssText = 'position:fixed;left:8px;top:6px;z-index:99;font:600 15px sans-serif;color:#fff;background:rgba(0,0,0,.55);padding:3px 8px;border-radius:4px';
    document.body.appendChild(lab);
    document.getElementById('techCue').style.visibility = 'hidden';
    P.applyWound = () => {};
    E.applyWound = () => {};
    g.ai.update = () => E.move.set(0, Math.max(-1, Math.min(1, 2 * (P.foeDistance() - 2.3)))); // 상대는 가슴 거리 2.3 m 를 지킴
    const mv = P.move;
    const set0 = mv.set.bind(mv);
    mv.set = (x, y) => (g._ovr ? set0(g._ovr.x, g._ovr.y) : set0(x, y)); // 스틱 덮기
    // 센 걸음 기록: 짝걸음 이끄는 발(또는 지나 딛기 walk·catch) — gait.js fastBegin 과 같은 가름 · 끄는 차례(g._pauseAt = [센 걸음 번호(이끄는 발) | '번호t'(그 걸음 따라붙는 발)])
    const G = P.gait;
    const b0 = G.begin.bind(G);
    g._steps = [];
    g._pauseAt = [];
    g._pend = null;
    G.begin = (l, kind, T) => {
      b0(l, kind, T);
      if (!g._count) return;
      const fore = Math.abs(P.move.y) > Math.abs(P.move.x);
      const lead = fore && (G.pairOn ? kind === 'walk' && G.pairStep === 'lead' : kind === 'walk' || (kind === 'catch' && G.walking));
      const trail = G.pairOn && kind === 'walk' && G.pairStep === 'trail';
      if (lead) g._steps.push({ t: g.stats.simTime, fast: G.fastK > 1, n: g._steps.length + 1 });
      const n = g._steps.length;
      const key = lead ? String(n) : trail ? `${n}t` : null;
      if (key && g._pauseAt[0] === key) {
        g._pauseAt.shift();
        g._pend = { key, fast: G.fastK > 1, leg: l.k, t: g.stats.simTime };
      }
    };
    const c = g.combat;
    const o = c.afterStep.bind(c);
    c.afterStep = (...a) => {
      const res = o(...a);
      if (g._pend && !g._paused) {
        g._paused = g._pend;
        g._pend = null;
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
      }
      return res;
    };
    g._every = TRADITIONS.italian.gait.rhythm.every;
    // 발소리 세기: 셈을 켠 뒤 sound.footstep 부름 수 · 그중 강조(accent) 붙은 수 (소리가 꺼져 있어도 부름은 센다 — BodySounds 판정 그대로)
    g._fs = { n: 0, acc: 0 };
    const fs0 = g.sound.footstep.bind(g.sound);
    g.sound.footstep = (sp, pos, acc) => {
      if (g._count) {
        g._fs.n++;
        if (acc) g._fs.acc++;
      }
      return fs0(sp, pos, acc);
    };
  });
  return page;
}
const sim = (page) => page.evaluate(() => window.game.stats.simTime);
const waitState = (page, st) => page.waitForFunction((st) => window.game.state === st, st, { timeout: 120000 });
async function resume(page) {
  await page.evaluate(() => {
    window.game._paused = null;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
  });
  await waitState(page, 'fight');
}
async function camSide(page, fix) {
  return page.evaluate((fix) => {
    const g = window.game;
    document.getElementById('menu').style.visibility = 'hidden';
    const a = g.enemy.bodies.chest.translation();
    const b = fix || g.player.bodies.pelvis.translation();
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const L = Math.hypot(dx, dz) || 1;
    g.freeCam = true;
    g.camera.position.set(b.x - (dz / L) * 3.0, 0.8, b.z + (dx / L) * 3.0);
    g.camera.lookAt(b.x + (-dx / L) * 0.5, 0.55, b.z + (-dz / L) * 0.5);
    return { x: b.x, y: b.y, z: b.z };
  }, fix);
}
// 판 시작 정지 뒤 쉼 → 셈 켜고 스틱 뒤 0.6 (짝걸음 물러나기)
async function walkBack(page) {
  const t0 = await sim(page);
  await page.waitForFunction((t) => window.game.stats.simTime > t, Math.max(t0, 2.3) + 1.2, { timeout: 120000 });
  await page.evaluate(() => {
    window.game._count = true;
    window.game._ovr = { x: 0, y: -0.6 };
  });
}

// ① 연속 사진 넷 (기본 3 + 1)
{
  const page = await open();
  await page.evaluate(() => (window.game._pauseAt = ['3', '4', '4t', '5']));
  await walkBack(page);
  const NAME = { 3: '셋째 걸음 — 보통', 4: '넷째 걸음 — 빠름 · 이끄는 발', '4t': '넷째 걸음 — 빠름 · 따라붙는 발', 5: '다섯째 걸음 — 보통' };
  const shots = [];
  let fix = null;
  for (let i = 0; i < 4; i++) {
    await waitState(page, 'paused');
    const p = await page.evaluate(() => {
      const g = window.game;
      const s = g._steps;
      return { ...g._paused, t1: s[0]?.t ?? 0, dt: s.length > 1 ? s[s.length - 1].t - s[s.length - 2].t : null };
    });
    fix = await camSide(page, fix);
    const rel = p.t - p.t1;
    const txt = `레이피어 짝걸음 물러나기 (3 + 1) · ${NAME[p.key]} · 첫 걸음부터 +${rel.toFixed(2)} s${p.dt != null && !String(p.key).endsWith('t') ? ` · 앞 걸음과 ${p.dt.toFixed(2)} s` : ''}`;
    await page.evaluate((t) => (document.getElementById('shotLabel').textContent = t), txt);
    await page.waitForTimeout(250);
    const file = `${dir}/it_rhythm_${i + 1}.png`;
    await page.screenshot({ path: file });
    shots.push({ key: p.key, fast: p.fast, leg: p.leg, t: +rel.toFixed(3), file });
    await resume(page);
  }
  report.shots = shots;
  report.steps = await page.evaluate(() => window.game._steps.map((s) => ({ n: s.n, t: +s.t.toFixed(3), fast: s.fast })));
  report.footsteps = await page.evaluate(() => window.game._fs);
  await page.context().close();
}

// ② 주기 손잡이: ?itRhythm=4 · ?itRhythm=0 — 값이 들어가는지 · 열 걸음 동안 빠른 걸음 차례
for (const q of ['4', '0']) {
  const page = await open(`&itRhythm=${q}`);
  await walkBack(page);
  await page.waitForFunction(() => window.game._steps.length >= 11, null, { timeout: 120000 });
  report[`itRhythm=${q}`] = await page.evaluate(() => ({ every: window.game._every, fastAt: window.game._steps.slice(0, 10).filter((s) => s.fast).map((s) => s.n), footsteps: window.game._fs }));
  await page.context().close();
}
report.errors = errors;
console.log(JSON.stringify(report, null, 1));
console.log(errors.length ? `ERRORS ${errors.length}` : 'ZERO console errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
