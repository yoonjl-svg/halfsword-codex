// 첫 걸음 박차기 브라우저 확인 (10/15 — docs/strike/step_burst_2026-10-15.md): 실제 게임(테스트 경로)에서 플레이어가 서 있다가 키보드로 뒤(S)·옆(D)을 0.5 s 누를 때
//  가슴이 간 거리(게임 시간 0.2 · 0.3 · 0.5 s)와 첫 걸음이 박차기였나(gait.fastK > 1)를 켬(기본)·끔(`&stepBurst=0`)으로 읽고, 누른 뒤 0.3 s 에 멈춰 옆에서 한 장씩 찍는다.
//  상대(AI 판단 끔)는 제자리에 세우고 둘 다 상처를 끈다(걸음·물리 그대로). 화면 왼쪽 위 글은 이 도구가 붙인 설명(게임 화면 글 아님). 콘솔 오류를 센다.
//  이탈리아(레이피어 — 박차기 받지 않는 유파) 한 번: 켬·끔 같아야 한다.
//  10/15 15:1x 옆 박차기는 이베리아만(문서 §8): 롱소드 옆(D)은 이제 보통 첫 걸음(fastK 1) · 츠바이핸더(이베리아) 켬 한 번 — 옆도 박차기.
//  10/15 20:4x 박차기는 독일 보법(문서 §10 — GAIT.burstDe): 기본 판 묶음(SBP_CASES=de)은 롱소드(독일 — 뒤만) · 우치가타나 · 청강검(없음) · 츠바이핸더(옆만) · 츠바이핸더 `&burstDe=0`(지금 판 — 뒤도) ·
//   전 묶음은 SBP_CASES=old. 사진은 롱소드 판만(출력 폴더 — 저장소에 넣지 않음)
//  주소에 openSweep=0(9/30 판 시작 — 정지 2 s): 첫 판 무대 훑기(3.3 게임 초) 동안은 발이 묶여 '두 발로 선' 때 누른 키가 먹지 않는다
//  10/15 15:2x 박차기 발소리 강조(문서 §9): 누른 뒤 1.2 s 동안 게임이 부른 발소리(game.sound.footstep — 소리가 꺼져 있어도 부름은 남음)와 그 강조 배율,
//   플레이어 발 디딤(gait.touchdown)을 적는다 — 강조가 박찬 발 디딤에만 나나 (상대는 제자리라 발소리는 거의 플레이어 것 — 상대 디딤 수도 적음)
//  실행: npx vite --port 5191 --strictPort (자기 포트·자기 캐시 폴더) & → node tools/browser/step_burst_probe.mjs http://127.0.0.1:5191 <출력 폴더>
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:5191';
const dir = process.argv[3] || '.';
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];

async function open(weapon, extra = '') {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`);
  });
  await page.goto(`${base}/index.html?test=1&weapon=${weapon}&hero=player&foe=isolde&stage=castle&openSweep=0${extra}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword && document.getElementById('btnStart'), null, { timeout: 120000 });
  await page.evaluate(() => document.getElementById('btnStart').click());
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 120000 });
  await page.evaluate(() => {
    const g = window.game;
    const P = g.player;
    const E = g.enemy;
    const lab = document.createElement('div');
    lab.id = 'shotLabel';
    lab.style.cssText = 'position:fixed;left:8px;top:6px;z-index:99;font:600 15px sans-serif;color:#fff;background:rgba(0,0,0,.55);padding:3px 8px;border-radius:4px';
    document.body.appendChild(lab);
    document.getElementById('techCue').style.visibility = 'hidden';
    P.applyWound = () => {};
    E.applyWound = () => {};
    g.ai.update = () => E.move.set(0, 0); // 상대는 제자리
    // 물리 스텝마다: 게임 시간 · 가슴 자리 · 스틱 · 첫 걸음 박차기 (걸음을 뗄 때 fastK)
    g._log = [];
    g._firstK = null;
    g._snd = [];
    g._tds = [];
    g._eSteps = 0;
    const G = P.gait;
    const b0 = G.begin.bind(G);
    G.begin = (l, kind, T) => {
      b0(l, kind, T);
      if (g._arm && g._firstK == null && kind !== 'settle') g._firstK = { k: G.fastK, kind, T, t: g.stats.simTime, leg: l.k };
    };
    const td0 = G.touchdown.bind(G);
    G.touchdown = (l, sp) => {
      if (g._arm) g._tds.push([g.stats.simTime, l.k, l.kind]);
      return td0(l, sp);
    };
    const eb0 = E.gait.begin.bind(E.gait);
    E.gait.begin = (l, kind, T) => {
      eb0(l, kind, T);
      if (g._arm) g._eSteps++;
    };
    const fs0 = g.sound.footstep.bind(g.sound);
    g.sound.footstep = (sp, pos, acc) => {
      if (g._arm) g._snd.push([g.stats.simTime, acc ? acc.gain : 0, acc ? acc.rate : 0]);
      return fs0(sp, pos, acc);
    };
    const c = g.combat;
    const o = c.afterStep.bind(c);
    c.afterStep = (...a) => {
      const res = o(...a);
      if (g._arm) {
        const p = P.bodies.chest.translation();
        g._log.push([g.stats.simTime, p.x, p.z, P.move.x, P.move.y]);
        if (g._pauseAt != null && g.stats.simTime >= g._pauseAt) {
          g._pauseAt = null;
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
        }
      }
      return res;
    };
  });
  return page;
}
const sim = (page) => page.evaluate(() => window.game.stats.simTime);
const waitSim = (page, t) => page.waitForFunction((t) => window.game.stats.simTime >= t, t, { timeout: 180000 });
const waitState = (page, st) => page.waitForFunction((st) => window.game.state === st, st, { timeout: 120000 });
async function camSide(page) {
  await page.evaluate(() => {
    const g = window.game;
    document.getElementById('menu').style.visibility = 'hidden';
    const a = g.enemy.bodies.chest.translation();
    const b = g.player.bodies.pelvis.translation();
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const L = Math.hypot(dx, dz) || 1;
    g.freeCam = true;
    g.camera.position.set(b.x - (dz / L) * 3.2, 0.9, b.z + (dx / L) * 3.2);
    g.camera.lookAt(b.x - (dx / L) * 0.6, 0.6, b.z - (dz / L) * 0.6);
  });
}
// 두 발로 0.6 s 선 때까지 기다림 (자세 고치기 끝)
async function settle(page) {
  await page.waitForFunction(() => {
    const G = window.game.player.gait;
    return window.game.stats.simTime > 3 && G.active && G.legs.F.stance && G.legs.B.stance && G.sinceTD > 0.6 && !G.walking;
  }, null, { timeout: 180000 });
}
async function press(page, key, label, shot) {
  await settle(page);
  const t0 = await sim(page);
  await page.evaluate((t) => {
    const g = window.game;
    g._log = [];
    g._firstK = null;
    g._snd = [];
    g._tds = [];
    g._eSteps = 0;
    g._arm = true;
    g._pauseAt = null;
  }, t0);
  await page.keyboard.down(key);
  // 누른 뒤 첫 스텝(스틱이 들어온 때)부터 0.3 s 에 멈춰 찍기
  await page.waitForFunction(() => window.game._log.some((r) => r[3] !== 0 || r[4] !== 0), null, { timeout: 60000 });
  const tPush = await page.evaluate(() => window.game._log.find((r) => r[3] !== 0 || r[4] !== 0)[0]);
  if (shot) {
    await page.evaluate((t) => (window.game._pauseAt = t), tPush + 0.3);
    await waitState(page, 'paused');
    await page.keyboard.up(key);
    await camSide(page);
    await page.evaluate((s) => (document.getElementById('shotLabel').textContent = s), label);
    await page.screenshot({ path: `${dir}/${shot}.png` });
    await page.evaluate(() => {
      window.game.freeCam = false;
      document.getElementById('menu').style.visibility = '';
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
    });
    await waitState(page, 'fight');
    await page.keyboard.down(key); // 0.5 s 까지 마저 누름
  }
  await waitSim(page, tPush + 0.5);
  await page.keyboard.up(key);
  await waitSim(page, tPush + 1.2);
  return page.evaluate((tPush) => {
    const g = window.game;
    const L = g._log;
    const i0 = L.findIndex((r) => r[3] !== 0 || r[4] !== 0);
    const r0 = L[Math.max(0, i0 - 1)];
    // 스틱 쪽(첫 스텝의 스틱 방향을 몸 틀로 — 가슴이 간 쪽 거리)
    const P = g.player;
    const h = P.heading;
    const fx = Math.cos(h);
    const fz = -Math.sin(h);
    const rx = Math.sin(h);
    const rz = Math.cos(h);
    const mx = L[i0][3];
    const my = L[i0][4];
    const ux = fx * my + rx * mx;
    const uz = fz * my + rz * mx;
    const n = Math.hypot(ux, uz) || 1;
    const at = (dt) => {
      const r = L.find((q) => q[0] >= tPush + dt - 1e-6) || L[L.length - 1];
      return ((r[1] - r0[1]) * ux + (r[2] - r0[2]) * uz) / n;
    };
    const snd = g._snd.filter((q) => q[0] <= tPush + 1.2).map(([t, ga, ra]) => [t - tPush, ga, ra]);
    const tds = g._tds.filter((q) => q[0] <= tPush + 1.2).map(([t, k, kind]) => [t - tPush, k, kind]);
    g._arm = false;
    return { d02: at(0.2), d03: at(0.3), d05: at(0.5), first: g._firstK, stick: Math.hypot(mx, my), emo: P.emoMods?.move ?? 1, t0: tPush, snd, tds, eSteps: g._eSteps };
  }, tPush);
}

// 판 묶음 (SBP_CASES): de(기본 — 10/15 20:4x 박차기는 독일 보법, 문서 §10: 롱소드(독일) 뒤만 박참 · 우치가타나(일본)·청강검(동방) 없음 · 츠바이핸더(이베리아) 옆만 ·
//  `&burstDe=0` = 지금 판 — 츠바이핸더 뒤도 박참) · old(§8·§9 판 — 롱소드 켬·끔 · 레이피어 켬·끔 · 츠바이핸더)
const CASES = {
  de: [
    ['longsword', '', '롱소드(독일) 켬'],
    ['uchigatana', '', '우치가타나(일본) 켬'],
    ['qinggang', '', '청강검(동방) 켬'],
    ['zweihander', '', '츠바이핸더(이베리아) 켬'],
    ['zweihander', '&burstDe=0', '츠바이핸더(이베리아) burstDe=0'],
  ],
  old: [
    ['longsword', '', '롱소드 켬'],
    ['longsword', '&stepBurst=0', '롱소드 끔'],
    ['rapier', '', '레이피어(이탈리아) 켬'],
    ['rapier', '&stepBurst=0', '레이피어(이탈리아) 끔'],
    ['zweihander', '', '츠바이핸더(이베리아) 켬'],
  ],
};
const out = [];
for (const [weapon, extra, nm] of CASES[process.env.SBP_CASES || 'de']) {
  const page = await open(weapon, extra);
  const tag = `${weapon}${extra ? '_off' : '_on'}`;
  const back = await press(page, 'KeyS', `${nm} · 뒤(S) 누른 뒤 0.3 s`, weapon === 'longsword' ? `burst_${tag}_back` : null);
  const side = await press(page, 'KeyD', `${nm} · 옆(D) 누른 뒤 0.3 s`, weapon === 'longsword' ? `burst_${tag}_side` : null);
  out.push({ nm, back, side });
  await page.context().close();
}
await browser.close();
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '-');
console.log('| 판 | 뒤(S): 0.2 · 0.3 · 0.5 s 간 거리 m · 첫 걸음 fastK · 발 뜬 s · 첫 걸음 뗀 때 s · 스틱 크기 | 옆(D): 0.2 · 0.3 · 0.5 s · 첫 걸음 fastK · 발 뜬 s · 뗀 때 s · 스틱 크기 |');
console.log('|---|---|---|');
const row = (q, t0) => `${f2(q.d02)} · ${f2(q.d03)} · ${f2(q.d05)} · ${f2(q.first?.k)} · ${f2(q.first?.T)} · ${f2(q.first ? q.first.t - q.t0 : NaN)} · ${f2(q.stick)}`;
for (const r of out) console.log(`| ${r.nm} | ${row(r.back)} | ${row(r.side)} |`);
// 발소리: 누른 뒤 s (* = 강조 — 배율 gain × rate) · 플레이어 디딤(발 · 꼴) · 첫 걸음 발 · 상대 걸음 수
console.log('\n| 판 · 쪽 | 발소리 누른 뒤 s (* 강조 gain·rate) | 플레이어 디딤 s (발 꼴) | 첫 걸음 발 · fastK | 상대 걸음 |\n|---|---|---|---|---|');
const sn = (q) => q.snd.map(([t, ga, ra]) => `${f2(t)}${ga ? `*${ga}·${ra}` : ''}`).join(' ') || '-';
const tdl = (q) => q.tds.map(([t, k, kind]) => `${f2(t)} ${k} ${kind}`).join(' · ') || '-';
for (const r of out) for (const [nm, q] of [['뒤', r.back], ['옆', r.side]]) console.log(`| ${r.nm} · ${nm} | ${sn(q)} | ${tdl(q)} | ${q.first?.leg ?? '-'} · ${f2(q.first?.k)} | ${q.eSteps} |`);
console.log(`콘솔·페이지 오류: ${errors.length}`);
for (const e of errors.slice(0, 10)) console.log('  ' + e);
