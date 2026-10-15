// 상대 헛스윙 연습 브라우저 확인 (10/15 — src/whiff_drill.js · docs/strike/german_hold_2026-10-15.md §7): 실제 게임(테스트 경로)에서
//  ① test.html: 롱소드 · 이졸데(겉모습) · '상대 헛스윙' 켬 → 아래 줄 · 가로 넘침 · 시작 → 게임 주소에 foeWhiff=1 · 메뉴 안내 한 줄 · 다시 열면 끔(기억 안 함)
//  ② 롱소드 사람(손 안 댐 — 테스트 경로 기본 겨눔) 대 이졸데(롱소드) · castle · openSweep=0 · foeWhiff=1: 판 시작 정지가 풀린 뒤 게임 시간 30 s 동안
//     드릴 공격 수 · 공격 끝(afterStrike)의 헛침·맺힘·맞힘 · 헛침 알림(gait.foeWhiff 부름 — 게임 길 그대로, 이 도구는 세기만) · 플레이어 받을 창(gait.chase) 열림
//  ③ 헛침으로 받을 창이 열리면 0.15 s 뒤 앞(W) 1.0 s — 간격 잡기(gait.hold)가 걸리나(빠른 디딤 fastK · 받을 창 · 잡기 · AI 꼴을 바뀔 때마다 적음). 끝나면 뒤(S)로 드릴 거리 밖 — 최대 4 번
//  ④a 돌아오기: 드릴 거리 − 0.45 안으로 걸어 들어가 1.5 s(평소대로 바뀌나) → 뒤(S)로 빠지면 헛스윙으로 돌아오나 · 다음 드릴 공격 — 이 차례만 플레이어 상처 끔(죽지 않게)
//  ④b 실전: 다시 걸어 들어가 4 s 붙어 있기(1.85 m 보다 멀어지면 앞 · 0.8 s 마다 화면 톡 = 찌르기) — 상처 켬: AI 가 평소대로 싸우나(드릴 아닌 공격 · 막기). 판이 끝나면(쓰러짐) 거기까지
//  ⑤ 상대 무기 레이피어(foeWeapon=rapier — 이탈리아 유파) 20 s: 헛스윙이 나나
//  물리 스텝마다 거리·드릴 꼴·받을 창·잡기를 적는다(combat.afterStep 을 감싸 읽기만). 콘솔·페이지 오류를 센다. 차례마다 바로 찍는다. 사진은 출력 폴더에만(저장소에 넣지 않음)
//  실행: npx vite --config <자기 cacheDir 를 둔 설정> --port 5193 --strictPort (자기 포트·자기 캐시 폴더) & → node tools/browser/whiff_drill_probe.mjs http://127.0.0.1:5193 <출력 폴더>
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:5193';
const dir = process.argv[3] || '.';
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const watch = (page, tag) => {
  page.setDefaultTimeout(600000); // 기계가 바쁘면(다른 작업) 게임 시간이 느리게 흐른다 — 기다림은 게임 시간으로 재고, 실제 시간 한도는 넉넉히
  page.setDefaultNavigationTimeout(300000);
  page.on('pageerror', (e) => errors.push(`pageerror ${tag}: ${e}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console ${tag}: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`http ${r.status()} ${tag}: ${r.url()}`);
  });
};
const f2 = (v) => (v == null || !Number.isFinite(v) ? '-' : v.toFixed(2));
const rng = (o) => (o ? `${f2(o.med)} [${f2(o.lo)}~${f2(o.hi)}]` : '-');

// ── ① 고르기 화면 ──
async function pickerCheck() {
  const res = {};
  for (const [w, h, nm] of [
    [390, 844, 'portrait'],
    [844, 390, 'landscape'],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true });
    const page = await ctx.newPage();
    watch(page, `test.html ${nm}`);
    await page.goto(`${base}/test.html`, { waitUntil: 'networkidle' });
    const before = await page.evaluate(() => document.querySelector('#whiffPick .pick[aria-pressed="true"]')?.dataset.id);
    await page.click('#weaponsRest .pick[data-id="longsword"], #weaponsNew .pick[data-id="longsword"]');
    await page.click('#heroes .pick[data-id="isolde"]');
    await page.click('#whiffPick .pick[data-id="on"]');
    const r = await page.evaluate(() => ({
      on: document.querySelector('#whiffPick .pick[aria-pressed="true"]')?.dataset.id,
      summary: document.getElementById('summary').innerText.replace(/\n/g, ' / '),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      minH: Math.min(...[...document.querySelectorAll('#whiffPick .pick')].map((b) => b.getBoundingClientRect().height)),
      head: document.querySelector('#whiffPick')?.previousElementSibling?.textContent,
    }));
    await page.locator('#whiffPick').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/picker_${nm}.png` });
    res[nm] = { before, ...r };
    if (nm === 'portrait') {
      await Promise.all([page.waitForURL(/index\.html/), page.click('#btnGo')]);
      res.url = page.url();
      await page.waitForFunction(() => window.game?.player?.sword && document.getElementById('testRouteNote'), null, { timeout: 600000 });
      res.note = await page.evaluate(() => document.getElementById('testRouteNote').textContent);
      res.drillOn = await page.evaluate(() => !!window.game.ai.drill);
      await page.screenshot({ path: `${dir}/menu_note.png` });
      await page.goto(`${base}/test.html`, { waitUntil: 'networkidle' });
      res.reopen = await page.evaluate(() => ({ whiff: document.querySelector('#whiffPick .pick[aria-pressed="true"]')?.dataset.id, weapon: document.querySelector('#weaponsRest .pick[aria-pressed="true"], #weaponsNew .pick[aria-pressed="true"]')?.dataset.id }));
    }
    await ctx.close();
  }
  return res;
}

// ── 게임 ──
async function open(extra, tag) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true });
  const page = await ctx.newPage();
  watch(page, tag);
  await page.goto(`${base}/index.html?test=1&weapon=longsword&hero=player&foe=isolde&stage=castle&openSweep=0&foeWhiff=1${extra}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword && document.getElementById('btnStart'), null, { timeout: 600000 });
  await page.evaluate(() => document.getElementById('btnStart').click());
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 600000 });
  await page.evaluate(() => {
    const g = window.game;
    const P = g.player;
    const ai = g.ai;
    const G = P.gait;
    const lab = document.createElement('div');
    lab.id = 'shotLabel';
    lab.style.cssText = 'position:fixed;left:8px;top:6px;z-index:99;font:600 15px sans-serif;color:#fff;background:rgba(0,0,0,.55);padding:3px 8px;border-radius:4px';
    document.body.appendChild(lab);
    const pr = (g._pr = { log: [], strikes: [], whiffCalls: 0, opens: [], ai, gap: ai.drill?.gap ?? null, dist: ai.drill ? ai.drill.dist(ai) : null, weapon: ai.me.weapon?.id, tradition: ai.art?.tradition, wound: P.applyWound });
    // 공격 끝: 드릴 공격인가 · 맞힘(상대 통증 오름)·맺힘(칼끼리)·헛침 — ai.js afterStrike 와 같은 가름 (그 뒤 원래 함수를 그대로 부른다)
    const oa = ai.afterStrike.bind(ai);
    ai.afterStrike = (d) => {
      pr.strikes.push({ t: g.stats.simTime, drill: ai.drillAtk, why: ai.why, k: ai.hitLanded ? 'landed' : ai.bound ? 'bound' : 'missed', real: P.foeDistance(), tech: ai.tech?.name });
      return oa(d);
    };
    // 헛침 알림을 세기만 (gait.foeWhiff 는 게임이 부른다 — 받을 창이 새로 열렸나)
    const of = G.foeWhiff.bind(G);
    G.foeWhiff = () => {
      pr.whiffCalls++;
      const b = G.chase;
      of();
      if (G.chase && G.chase !== b) pr.opens.push({ t: g.stats.simTime, d: P.foeDistance() });
    };
    const c = g.combat;
    const oc = c.afterStep.bind(c);
    c.afterStep = (...a) => {
      const r = oc(...a);
      pr.log.push({
        t: g.stats.simTime,
        d: P.foeDistance(),
        out: ai.drillOut,
        mode: ai.mode,
        phase: ai.phase,
        atk: ai.mode === 'attack' && ai.drillAtk,
        why: ai.mode === 'attack' ? ai.why : '',
        chase: G.chase ? `${G.chase.got ? 'got' : 'open'}${G.chase.left}` : '-',
        hold: !!G.hold,
        fastK: G.fastK,
        ps: P.state,
        es: ai.me.state,
        thr: P.skill.thrusts ?? 0,
        G: ai.drill ? ai.drill.dist(ai) : null, // 지금 드릴 거리 (칼이 부러지면 M.reach 와 같이 준다)
        broken: !!ai.me.weaponBroken,
      });
      if (pr.log.length > 80000) pr.log.splice(0, 40000);
      return r;
    };
  });
  return page;
}
const sim = (page) => page.evaluate(() => window.game.stats.simTime);
// 게임 시간 t 까지 (판이 끝나 싸움이 멈추면 거기서 — 시간이 더 흐르지 않는다)
const waitSim = (page, t, ms = 1200000) => page.waitForFunction((t) => window.game.stats.simTime >= t || window.game.state !== 'fight', t, { timeout: ms });
const fighting = (page) => page.evaluate(() => window.game.state === 'fight');
const label = (page, s) => page.evaluate((s) => (document.getElementById('shotLabel').textContent = s), s);
const sameRound = (page) => page.evaluate(() => window.game.ai === window.game._pr.ai);
// 판 시작 정지가 풀릴 때까지 (fighter.feetHeld)
const waitUnheld = (page) => page.waitForFunction(() => !window.game.player.feetHeld, null, { timeout: 900000 });

/** [t0, t1] 게임 시간 동안의 공격 끝·헛침 알림·받을 창·드릴 꼴 몫 */
function windowStats(page, t0, t1) {
  return page.evaluate(
    ([t0, t1]) => {
      const pr = window.game._pr;
      const S = pr.strikes.filter((s) => s.t >= t0 && s.t < t1);
      const D = S.filter((s) => s.drill);
      const L = pr.log.filter((q) => q.t >= t0 && q.t < t1);
      const starts = [];
      for (let i = 1; i < L.length; i++) if (L[i].atk && !L[i - 1].atk) starts.push(L[i].d);
      const med = (a) => {
        const b = [...a].sort((x, y) => x - y);
        return b.length ? { med: b[Math.floor(b.length / 2)], lo: b[0], hi: b[b.length - 1] } : null;
      };
      return {
        drillAtk: starts.length,
        startD: med(starts),
        endD: med(D.map((s) => s.real)),
        missed: D.filter((s) => s.k === 'missed').length,
        bound: D.filter((s) => s.k === 'bound').length,
        landed: D.filter((s) => s.k === 'landed').length,
        other: S.filter((s) => !s.drill).length,
        techs: D.map((s) => `${s.tech}:${s.k}`).join(' '),
        opens: pr.opens.filter((o) => o.t >= t0 && o.t < t1).length,
        outShare: L.length ? L.filter((q) => q.out).length / L.length : 0,
        Gend: L.at(-1)?.G ?? null,
        broken: L.some((q) => q.broken),
        states: `${L.at(-1)?.ps}/${L.at(-1)?.es}`,
      };
    },
    [t0, t1],
  );
}

async function phase2(page) {
  await waitUnheld(page);
  const t0 = await sim(page);
  // 드릴 공격 베는 순간 한 장
  try {
    await page.waitForFunction(() => window.game.ai.drillAtk && window.game.ai.phase === 'strike', null, { timeout: 600000 });
    await label(page, '상대 헛스윙 (foeWhiff=1) · 드릴 거리에서 보통 기술로 베기');
    await page.screenshot({ path: `${dir}/drill_strike.png` });
  } catch {}
  await waitSim(page, t0 + 30);
  const r = { t0, ...(await windowStats(page, t0, t0 + 30)), same: await sameRound(page), G: await page.evaluate(() => window.game._pr.dist), gap: await page.evaluate(() => window.game._pr.gap) };
  console.log(`\n② 롱소드 대 이졸데(롱소드) · gap ${f2(r.gap)} · 드릴 거리 ${f2(r.G)} m · 게임 시간 30 s (정지 풀린 뒤 ${f2(r.t0)} s 부터)`);
  console.log(`- 드릴 공격 ${r.drillAtk} · 공격 끝: 헛침 ${r.missed} · 맺힘 ${r.bound} · 맞힘 ${r.landed} · 드릴 아닌 공격 끝 ${r.other} · 받을 창 열림 ${r.opens} · 헛스윙 꼴 몫 ${(r.outShare * 100).toFixed(0)} %`);
  console.log(`- 공격 시작 거리 ${rng(r.startD)} · 공격 끝 거리 ${rng(r.endD)} · 기술 ${r.techs} · 끝 상태 ${r.states} · 끝 드릴 거리 ${f2(r.Gend)} · 상대 칼 부러짐 ${r.broken} · 같은 판 ${r.same}`);
  return r;
}

async function retreat(page, over = 0.35) {
  // 드릴 거리 + over 밖까지 뒤(S)로 (최대 게임 시간 3 s), 놓고 0.5 s
  const G = await page.evaluate(() => window.game._pr.dist);
  const t = await sim(page);
  await page.keyboard.down('KeyS');
  try {
    await page.waitForFunction(([G, t, over]) => window.game.player.foeDistance() >= G + over || window.game.stats.simTime > t + 3 || window.game.state !== 'fight', [G, t, over], { timeout: 600000 });
  } catch {}
  await page.keyboard.up('KeyS');
  await waitSim(page, (await sim(page)) + 0.5);
}

/** 드릴 거리 − 0.45 안까지 앞(W)으로 (최대 게임 시간 4 s) — 걸린 시간 */
async function walkIn(page) {
  const G = await page.evaluate(() => window.game._pr.dist);
  const t0 = await sim(page);
  await page.keyboard.down('KeyW');
  try {
    await page.waitForFunction(([G, t0]) => window.game.player.foeDistance() <= G - 0.45 || window.game.stats.simTime > t0 + 4 || window.game.state !== 'fight', [G, t0], { timeout: 600000 });
  } catch {}
  await page.keyboard.up('KeyW');
  return (await sim(page)) - t0;
}

/** [a, b] 동안 바뀔 때마다 한 줄 (거리 · 빠른 디딤 · 받을 창 · 잡기 · AI 꼴) — 기준 시각 t0 에서 */
function series(page, a, b, t0) {
  return page.evaluate(
    ([a, b, t0]) => {
      const L = window.game._pr.log.filter((q) => q.t >= a && q.t <= b);
      const out = [];
      let last = '';
      for (const q of L) {
        const k = `${q.fastK > 1 ? 'F' : '-'} ${q.chase} ${q.hold ? 'H' : '-'} ${q.out ? '헛스윙' : '평소'} ${q.mode}`;
        if (k !== last) out.push(`${(q.t - t0 >= 0 ? '+' : '') + (q.t - t0).toFixed(2)} s ${q.d.toFixed(2)} m · ${k}`);
        last = k;
      }
      return out;
    },
    [a, b, t0],
  );
}

async function phase3(page) {
  console.log('\n③ 헛침 → 0.15 s 뒤 앞(W) 1.0 s  (줄: 앞 누름 요청 기준 시각 · 가슴-가슴 거리 · F 빠른 디딤 · 받을 창(open/got + 남은 걸음) · H 잡기 · AI 꼴)');
  const tries = [];
  for (let k = 0; k < 4; k++) {
    const n0 = await page.evaluate(() => window.game._pr.opens.length);
    try {
      await page.waitForFunction((n0) => window.game._pr.opens.length > n0 || window.game.state !== 'fight', n0, { timeout: 900000 });
    } catch {}
    if (!(await fighting(page)) || (await page.evaluate(() => window.game._pr.opens.length)) <= n0) {
      console.log(`- ${k + 1}: 받을 창 안 열림 (판 끝 또는 시간 넘김)`);
      break;
    }
    const open = await page.evaluate(() => window.game._pr.opens.at(-1));
    await waitSim(page, open.t + 0.15);
    const tPush = await sim(page);
    await page.keyboard.down('KeyW');
    let held = true;
    try {
      await page.waitForFunction((t) => window.game._pr.log.some((q) => q.t >= t && q.hold) || window.game.stats.simTime > t + 1.0 || window.game.state !== 'fight', tPush, { timeout: 600000 });
      held = await page.evaluate((t) => window.game._pr.log.some((q) => q.t >= t && q.hold), tPush);
    } catch {
      held = false;
    }
    if (held && !tries.some((q) => q.hold)) {
      await waitSim(page, (await sim(page)) + 0.15);
      await label(page, '헛침 → 0.15 s 뒤 앞(W) → 간격 잡기(gait.hold) 걸림');
      await page.screenshot({ path: `${dir}/hold.png` });
    }
    await waitSim(page, tPush + 1.0);
    await page.keyboard.up('KeyW');
    const q = await page.evaluate(
      ([tOpen, tPush]) => {
        const all = window.game._pr.log.filter((q) => q.t >= tOpen && q.t <= tPush + 1.0); // 창 열림부터 (빠른 디딤은 누름이 닿은 스텝에 시작 — 요청 시각과 같은 스텝일 수 있다)
        const L = all.filter((q) => q.t >= tPush);
        const h = L.find((q) => q.hold);
        const f = all.find((q) => q.fastK > 1);
        const fastS = all.filter((q) => q.fastK > 1).length / 120;
        const normal = L.find((q) => !q.out);
        return { openD: window.game._pr.opens.at(-1).d, wAfter: tPush - tOpen, hold: h ? { dt: h.t - tPush, d: h.d, out: h.out, mode: `${h.mode}/${h.phase}` } : null, fastAt: f ? f.t - tPush : null, fastS, minD: Math.min(...L.map((q) => q.d)), normal: normal ? { dt: normal.t - tPush, d: normal.d, mode: `${normal.mode}/${normal.phase}` } : null };
      },
      [open.t, tPush],
    );
    q.series = await series(page, open.t, tPush + 1.0, tPush);
    tries.push(q);
    console.log(`- ${k + 1}: 창 열린 때 거리 ${f2(q.openD)} · W 요청 창 뒤 ${f2(q.wAfter)} s · 간격 잡기 ${q.hold ? `걸림 (요청 뒤 ${f2(q.hold.dt)} s · ${f2(q.hold.d)} m · 그때 AI ${q.hold.out ? '헛스윙' : '평소'} ${q.hold.mode})` : '안 걸림'} · 빠른 디딤 ${q.fastAt != null ? `요청 뒤 ${f2(q.fastAt)} s 부터 ${f2(q.fastS)} s` : '없음'} · 가장 가까움 ${f2(q.minD)} m · AI 평소대로 ${q.normal ? `요청 뒤 ${f2(q.normal.dt)} s · ${f2(q.normal.d)} m · ${q.normal.mode}` : '-'}`);
    for (const l of q.series) console.log(`    ${l}`);
    await retreat(page);
    if (!(await fighting(page)) || !(await sameRound(page))) {
      console.log('  (판 끝 — 여기까지)');
      break;
    }
  }
  return tries;
}

/** [t0, t1] 동안 AI 꼴 몫 · 공격 시작(드릴/까닭) · 막기 들어감 · 공격 끝 · 찌르기 수 */
function insideStats(page, t0, t1) {
  return page.evaluate(
    ([t0, t1]) => {
      const pr = window.game._pr;
      const L = pr.log.filter((q) => q.t >= t0 && q.t < t1);
      const S = pr.strikes.filter((s) => s.t >= t0 && s.t < t1);
      const modes = {};
      for (const q of L) modes[q.mode] = (modes[q.mode] ?? 0) + 1;
      const atk = [];
      let defend = 0;
      for (let i = 1; i < L.length; i++) {
        if (L[i].mode === 'attack' && L[i - 1].mode !== 'attack') atk.push(`${L[i].atk ? 'drill' : L[i].why}`);
        if (L[i].mode === 'defend' && L[i - 1].mode !== 'defend') defend++;
      }
      const firstNormal = L.find((q) => !q.out);
      return {
        outShare: L.length ? L.filter((q) => q.out).length / L.length : 0,
        firstNormal: firstNormal ? firstNormal.t - t0 : null,
        modes: Object.fromEntries(Object.entries(modes).map(([k, v]) => [k, +(v / L.length).toFixed(2)])),
        atk: atk.join(' '),
        defend,
        strikes: S.map((s) => `${s.drill ? 'drill' : s.why}:${s.tech}:${s.k}`).join(' '),
        thrusts: L.length ? L.at(-1).thr - L[0].thr : 0,
        dMed: L.length ? [...L.map((q) => q.d)].sort((a, b) => a - b)[Math.floor(L.length / 2)] : null,
        span: L.length ? L.at(-1).t - L[0].t : 0,
        G: L.length ? [Math.min(...L.map((q) => q.G)), Math.max(...L.map((q) => q.G))] : null,
        broken: L.some((q) => q.broken),
        states: `${L.at(-1)?.ps}/${L.at(-1)?.es}`,
      };
    },
    [t0, t1],
  );
}

async function phase4(page) {
  // ④a 돌아오기 — 이 차례만 플레이어 상처 끔 (죽지 않게)
  await retreat(page);
  await page.evaluate(() => (window.game.player.applyWound = () => {}));
  let outSeen = true;
  try {
    await page.waitForFunction(() => (window.game.ai.drillOut && window.game.ai.mode === 'watch') || window.game.state !== 'fight', null, { timeout: 600000 });
    outSeen = await page.evaluate(() => window.game.ai.drillOut);
  } catch {
    outSeen = false;
  }
  const dA = await page.evaluate(() => window.game.player.foeDistance());
  const walkA = await walkIn(page);
  const tA = await sim(page);
  const dInA = await page.evaluate(() => window.game.player.foeDistance());
  await waitSim(page, tA + 1.5);
  const A = await insideStats(page, tA - walkA, tA + 1.5);
  const tOut0 = await sim(page);
  await retreat(page);
  const tBack = await sim(page);
  const dBack = await page.evaluate(() => window.game.player.foeDistance());
  let backOut = null;
  try {
    await page.waitForFunction(() => window.game.ai.drillOut || window.game.state !== 'fight', null, { timeout: 600000 });
    if (await page.evaluate(() => window.game.ai.drillOut)) backOut = (await sim(page)) - tBack;
  } catch {}
  const n0 = await page.evaluate(() => window.game.ai.drill.attacks);
  let again = null;
  try {
    await page.waitForFunction((n0) => window.game.ai.drill.attacks > n0 || window.game.state !== 'fight', n0, { timeout: 600000 });
    if (await page.evaluate((n0) => window.game.ai.drill.attacks > n0, n0)) again = (await sim(page)) - tBack;
  } catch {}
  await page.evaluate(() => (window.game.player.applyWound = window.game._pr.wound)); // 상처 다시 켬
  console.log(`\n④a 돌아오기 (상처 끔): 밖에서 헛스윙 꼴 ${outSeen} (${f2(dA)} m) → 앞(W) ${f2(walkA)} s 에 ${f2(dInA)} m → 1.5 s: 평소대로 바뀐 때 걷기 시작 뒤 ${f2(A.firstNormal)} s · 헛스윙 꼴 몫(걷기 포함) ${(A.outShare * 100).toFixed(0)} % · 꼴 ${JSON.stringify(A.modes)} · 공격 시작 ${A.atk || '-'} · 드릴 거리 ${f2(A.G?.[0])}~${f2(A.G?.[1])} · 상대 칼 부러짐 ${A.broken}`);
  console.log(`- 뒤로 빠짐 ${f2(tBack - tOut0)} s (${f2(dBack)} m) → 헛스윙 꼴 다시 ${backOut != null ? `${f2(backOut)} s 뒤` : '안 돌아옴'} · 다음 드릴 공격 ${again != null ? `${f2(again)} s 뒤` : '없음'}`);
  // ④b 실전 — 상처 켬: 걸어 들어가 4 s 붙어 있기(1.85 m 보다 멀어지면 앞(W)) · 0.8 s 마다 화면 톡(찌르기 — 상대가 받아 내나)
  await retreat(page);
  const walkB = await walkIn(page);
  const tB = await sim(page);
  const dInB = await page.evaluate(() => window.game.player.foeDistance());
  let wDown = false;
  let taps = 0;
  for (let k = 1; k <= 10 && (await fighting(page)); k++) {
    await waitSim(page, tB + k * 0.4);
    const d = await page.evaluate(() => window.game.player.foeDistance());
    if (d > 1.85 && !wDown) await page.keyboard.down('KeyW');
    if (d <= 1.85 && wDown) await page.keyboard.up('KeyW');
    wDown = d > 1.85;
    if (k % 2 === 0 && (await fighting(page))) {
      await page.touchscreen.tap(640, 150);
      taps++;
    }
  }
  if (wDown) await page.keyboard.up('KeyW');
  const B = await insideStats(page, tB, tB + 4);
  await label(page, '드릴 거리 안 — 평소대로 싸움');
  await page.screenshot({ path: `${dir}/inside.png` });
  console.log(`\n④b 실전 (상처 켬): 앞(W) ${f2(walkB)} s 에 ${f2(dInB)} m → ${f2(B.span)} s 붙어 있기 (0.8 s 마다 톡 ${taps} 번 → 찌르기 ${B.thrusts} 번): 헛스윙 꼴 몫 ${(B.outShare * 100).toFixed(0)} % · 꼴 ${JSON.stringify(B.modes)}`);
  console.log(`- AI 공격 시작 ${B.atk || '-'} · 막기 들어감 ${B.defend} · 공격 끝 ${B.strikes || '-'} · 가운데 거리 ${f2(B.dMed)} · 끝 상태 ${B.states} · 드릴 거리 ${f2(B.G?.[0])}~${f2(B.G?.[1])} · 상대 칼 부러짐 ${B.broken} · 싸움 중 ${await fighting(page)}`);
}

const picker = await pickerCheck();
console.log('① test.html');
for (const nm of ['portrait', 'landscape']) {
  const q = picker[nm];
  console.log(`- ${nm}: 열 때 '${q.before}' → 켬 '${q.on}' · 제목 '${q.head}' · 아래 줄 "${q.summary}" · 가로 넘침 ${q.overflow} px · 칸 높이 최소 ${f2(q.minH)} px`);
}
console.log(`- 시작 → ${picker.url}\n- 메뉴 안내: ${picker.note} · 상대 AI 드릴 붙음 ${picker.drillOn}\n- 다시 열기: 무기 ${picker.reopen?.weapon} · 헛스윙 '${picker.reopen?.whiff}'`);
const page = await open('', 'longsword');
await phase2(page);
await phase3(page);
if (await fighting(page)) await phase4(page);
await page.context().close();
const rp = await open('&foeWeapon=rapier', 'rapier');
await waitUnheld(rp);
const r0 = await sim(rp);
await waitSim(rp, r0 + 20);
const p5 = { ...(await windowStats(rp, r0, r0 + 20)), same: await sameRound(rp), G: await rp.evaluate(() => window.game._pr.dist), gap: await rp.evaluate(() => window.game._pr.gap), weapon: await rp.evaluate(() => window.game._pr.weapon), tradition: await rp.evaluate(() => window.game._pr.tradition) };
try {
  await rp.waitForFunction(() => window.game.ai.drillAtk && window.game.ai.phase === 'strike', null, { timeout: 600000 });
  await label(rp, '상대 레이피어 (foeWeapon=rapier) · 헛스윙');
  await rp.screenshot({ path: `${dir}/rapier_strike.png` });
} catch {}
await rp.context().close();
await browser.close();
console.log(`\n⑤ 상대 ${p5.weapon} (${p5.tradition}) · gap ${f2(p5.gap)} · 드릴 거리 ${f2(p5.G)} m · 20 s: 드릴 공격 ${p5.drillAtk} · 헛침 ${p5.missed} · 맺힘 ${p5.bound} · 맞힘 ${p5.landed} · 받을 창 ${p5.opens} · 시작 거리 ${rng(p5.startD)} · 기술 ${p5.techs} · 끝 드릴 거리 ${f2(p5.Gend)} · 상대 칼 부러짐 ${p5.broken} · 같은 판 ${p5.same}`);
console.log(`\n오류 ${errors.length}${errors.length ? '\n' + errors.join('\n') : ''}`);
