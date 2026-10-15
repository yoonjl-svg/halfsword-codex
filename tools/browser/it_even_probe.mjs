// 이탈리아 고른 바탕 걸음 브라우저 확인 (10/15 — docs/strike/italian_rhythm_2026-10-15.md §10): 테스트 경로 레이피어 플레이어가
//  ① 키보드 W 3 s(앞 끝 — 상대는 물러남) ② S 3 s(뒤 끝 — 상대는 다가옴) ③ 스틱 뒤 0.5 · 3 s(가까이 짝걸음 — 상대는 가슴 2.3 m 를 지킴)로 걸을 때
//  게임이 부른 발소리(game.sound.footstep — 소리가 꺼져 있어도 부름은 남음)의 게임 시각·강조(세기 배율)와 플레이어 디딤(gait.touchdown)을 적어
//  디딤 간격 줄(보통·빠름)을 옛/새로 견준다. 발소리는 플레이어 디딤 ±0.06 s 안의 것만 플레이어 것으로 침(상대 발소리가 섞이므로).
//  주소 갈래: 새(기본 — 고른 짝걸음 · 보폭 규칙 · 박자 ×1.5) / 옛 `&itGait=old&strideRule=0&itRhythm=2%2B2x1.3`(지금 판과 같은 걸음) / 옛 바탕 ×1.5 `&itGait=old&strideRule=0`.
//  ③ 동안 이끄는 발이 떠 있는 때 옆에서 두 장(출력 폴더 — 저장소에 넣지 않음). 콘솔·페이지 오류를 센다. 상대 AI 판단은 끄고 둘 다 상처 끔(걸음·물리 그대로).
//  실행: npx vite --config <자기 cacheDir 설정> --port 5196 --strictPort & → node tools/browser/it_even_probe.mjs http://127.0.0.1:5196 <출력 폴더>
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:5196';
const dir = process.argv[3] || '.';
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const VARS = [
  ['new', ''],
  ['old', '&itGait=old&strideRule=0&itRhythm=2%2B2x1.3'],
  ['old15', '&itGait=old&strideRule=0'],
];
const out = [];
for (const [name, q] of VARS) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${name} http ${r.status()}: ${r.url()}`);
  });
  await page.goto(`${base}/index.html?test=1&weapon=rapier&hero=player&foe=isolde&stage=castle&openSweep=0${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword && document.getElementById('btnStart'), null, { timeout: 120000 });
  await page.evaluate(() => document.getElementById('btnStart').click());
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 120000 });
  const R = await page.evaluate(() => {
    const g = window.game;
    const P = g.player;
    const E = g.enemy;
    P.applyWound = () => {};
    E.applyWound = () => {};
    document.getElementById('techCue').style.visibility = 'hidden';
    g._ai = 'still';
    g.ai.update = () => {
      if (g._ai === 'away') E.move.set(0, -1);
      else if (g._ai === 'come') E.move.set(0, 1);
      else if (g._ai === 'keep') E.move.set(0, Math.max(-1, Math.min(1, 2 * (P.foeDistance() - 2.3))));
      else E.move.set(0, 0);
    };
    const mv = P.move;
    const set0 = mv.set.bind(mv);
    mv.set = (x, y) => (g._ovr ? set0(g._ovr.x, g._ovr.y) : set0(x, y)); // 스틱 덮기 (③)
    g._ph = null;
    g._tds = [];
    g._snd = [];
    const G = P.gait;
    const td0 = G.touchdown.bind(G);
    G.touchdown = (l, sp) => {
      const kind = l.kind;
      const fast = !!l.fastStep;
      const r = td0(l, sp);
      if (g._ph) g._tds.push([g._ph, g.stats.simTime, l.k, kind, fast, !!G.pairOn]);
      return r;
    };
    const fs0 = g.sound.footstep.bind(g.sound);
    g.sound.footstep = (sp, pos, acc) => {
      if (g._ph) g._snd.push([g._ph, g.stats.simTime, acc ? acc.gain : 1]);
      return fs0(sp, pos, acc);
    };
    // 옆에서 찍기 갈고리: ③ 동안 이끄는 발(짝걸음)이 60~90 % 떠 있는 물리 스텝에서 멈춤(P)
    g._shotWant = 0;
    g._shots = [];
    const c = g.combat;
    const o = c.afterStep.bind(c);
    c.afterStep = (...a) => {
      const res = o(...a);
      if (g._shotWant > 0 && g.state === 'fight') {
        const sw = !G.legs.F.stance ? G.legs.F : !G.legs.B.stance ? G.legs.B : null;
        if (sw && sw.kind === 'walk' && G.pairOn && G.pairStep === 'lead') {
          const u = sw.t / sw.T;
          if (u > 0.6 && u < 0.9 && g.stats.simTime > (g._shotAfter ?? 0)) {
            g._shotWant--;
            g._shotAfter = g.stats.simTime + 0.7;
            const pv = P.bodies.pelvis.translation();
            g._shots.push({ t: +g.stats.simTime.toFixed(2), u: +u.toFixed(2), pelvisY: +pv.y.toFixed(3), fast: !!sw.fastStep, gap: +Math.hypot(G.legs.F.plant.x - G.legs.B.plant.x, G.legs.F.plant.z - G.legs.B.plant.z).toFixed(2) });
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
          }
        }
      }
      return res;
    };
    const r = G.P.rhythm;
    return { count: r.count, normal: r.normal, fast: r.fast, mul: r.mul, even: !!G.P.pair?.even, maxStride: +(G.P.maxStride ?? 0).toFixed(3), cadence0: +(G.P.cadence0 ?? 0).toFixed(3) };
  });
  // 판 시작 정지(openSweep=0 — 2 s) 뒤
  await page.waitForFunction(() => window.game.stats.simTime > 2.6, null, { timeout: 180000 });
  const shots = [];
  const phase = async (ph, ai, key, ovr, secs) => {
    await page.evaluate(([ph, ai, ovr]) => {
      const g = window.game;
      g._ai = ai;
      g._ovr = ovr;
      g._ph = ph;
      g._phT0 = g.stats.simTime;
    }, [ph, ai, ovr]);
    if (key) await page.keyboard.down(key);
    const t0 = await page.evaluate(() => window.game._phT0);
    // 게임 시간이 secs 지날 때까지 — 찍기 갈고리가 멈추면(P) 옆에서 찍고 다시 풂
    for (let guard = 0; guard < 4000; guard++) {
      const st = await page.evaluate(() => ({ t: window.game.stats.simTime, state: window.game.state }));
      if (st.t > t0 + secs) break;
      if (st.state === 'paused') {
        await page.evaluate(() => {
          const g = window.game;
          const f = g.player;
          const o = g.enemy;
          document.getElementById('menu').style.visibility = 'hidden';
          const a = o.bodies.chest.translation();
          const b = f.bodies.pelvis.translation();
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const L = Math.hypot(dx, dz) || 1;
          g.freeCam = true;
          g.camera.position.set(b.x - (dz / L) * 2.6, 0.75, b.z + (dx / L) * 2.6);
          g.camera.lookAt(b.x, 0.45, b.z);
        });
        await page.waitForTimeout(300);
        const path = `${dir}/it_even_${name}_${shots.length + 1}.png`;
        await page.screenshot({ path });
        shots.push(path);
        await page.evaluate(() => {
          const g = window.game;
          g.freeCam = false;
          document.getElementById('menu').style.visibility = '';
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
        });
        await page.waitForTimeout(200);
        continue;
      }
      await page.waitForTimeout(100);
    }
    if (key) await page.keyboard.up(key);
    await page.evaluate(() => {
      const g = window.game;
      g._ph = null;
      g._ovr = null;
    });
  };
  const rest = async (ai, secs) => {
    await page.evaluate((ai) => (window.game._ai = ai), ai);
    const t0 = await page.evaluate(() => window.game.stats.simTime);
    await page.waitForFunction((t) => window.game.stats.simTime > t, t0 + secs, { timeout: 180000 });
  };
  await phase('fwd', 'away', 'KeyW', null, 3);
  await rest('still', 1.2);
  await phase('back', 'come', 'KeyS', null, 3);
  await rest('keep', 2.0);
  await page.evaluate(() => (window.game._shotWant = 2));
  await phase('pair', 'keep', null, { x: 0, y: -0.5 }, 3);
  const D = await page.evaluate(() => ({ tds: window.game._tds, snd: window.game._snd, shots: window.game._shots }));
  out.push({ name, R, D, shots });
  await ctx.close();
}
await browser.close();
const f3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : '-');
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const sd = (a) => {
  const m = mean(a);
  return a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length) : NaN;
};
console.log('| 갈래 | 읽힌 걸음 | 구간 | 걷는 디딤 (빠른) | 그 디딤의 발소리 (강조) | 디딤 간격 줄 s (· 빠른 디딤 F) — 처음 둘 뺌 | 보통 간격 CV · 빠름 ÷ 보통 |');
console.log('|---|---|---|---|---|---|---|');
for (const { name, R, D } of out) {
  for (const ph of ['fwd', 'back', 'pair']) {
    const tds = D.tds.filter((x) => x[0] === ph && (x[3] === 'walk' || x[3] === 'catch'));
    const snd = D.snd.filter((x) => x[0] === ph);
    let heard = 0;
    let acc = 0;
    for (const t of tds) {
      const s = snd.find((x) => Math.abs(x[1] - t[1]) < 0.06);
      if (s) {
        heard++;
        if (s[2] > 1.01) acc++;
      }
    }
    const seq = [];
    const ivN = [];
    const ivF = [];
    for (let i = 3; i < tds.length; i++) {
      const iv = tds[i][1] - tds[i - 1][1];
      seq.push(`${iv.toFixed(2)}${tds[i][4] ? 'F' : ''}`);
      (tds[i][4] ? ivF : ivN).push(iv);
    }
    const nm = { fwd: '① W 3 s 앞 끝', back: '② S 3 s 뒤 끝', pair: '③ 가까이 뒤 0.5 · 3 s' }[ph];
    console.log(`| ${name} | ${R.even ? '고른 짝' : '옛 짝'} · 보폭 ${R.maxStride} · 박자 ${R.cadence0} · ${R.normal} + ${R.fast} ×${R.mul} | ${nm} | ${tds.length} (${tds.filter((x) => x[4]).length}) | ${heard} (${acc}) | ${seq.join(' ')} | ${f3(sd(ivN) / mean(ivN))} · ${f3(mean(ivF) / mean(ivN))} |`);
  }
}
for (const { name, shots, D } of out) console.log(`찍은 것 ${name}: ${shots.join(' ')} ${JSON.stringify(D.shots)}`);
console.log(`콘솔·페이지 오류: ${errors.length}`);
for (const e of errors.slice(0, 10)) console.log('  ' + e);
