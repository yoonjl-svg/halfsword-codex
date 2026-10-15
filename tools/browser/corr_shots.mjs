// 검술 보정 v2 장면 사진 (설계 docs/strike/correction_v2_design_2026-10-01.md '시험판 먼저'): 실제 게임 화면(844×390 가로 폰, 터치)에서
//  같은 긋기를 옛 보정(기본)과 새 보정(?corr=v2)으로 해 보고 이름 붙은 순간마다 PNG, 프레임마다 상태 JSON 을 남긴다.
//  장면 (보정 세기 보통 0.7 · 강 1 마다):
//   diag      긋기 A (짧은 사선, 끝에서 300 ms 누른 뒤 뗌): 쉼 → 베기 → ① 창 열림 → 닿음 → 뒤 → 되돌아옴 → ready   (옛 / v2)
//   flat      긋기 B (서 있는 상대를 가로지르는 납작 긋기): 쉼 → 베기 → 닿음 → 뒤                             (옛 / v2)
//   liftShort 세로로 긋다 머리 선보다 25° 위에서 멈추고 곧바로 뗌: ② 가 겨눔을 부위까지 보내나 — 옛 / v2 tip=1 / v2 tip=0
//   holdShort 같은 멈춤을 1 s 누른 채: 끝점 겨눔이 켜져 있어도 베기로 채우지 않아야 한다                   (옛 / v2 tip=1)
//  플레이어는 실제 입력 길로만 움직인다: CDP 터치(Input.dispatchTouchEvent)로 캔버스 위 손가락을 끈다 (한 프레임에 한 번 움직임).
//  장면 준비만 한다: 시작 거리 ARENA.startGap = 1.72 m (맞힘 거리 1.55 + 0.17, chain_corr 와 같음)로 판을 세우고, 상대 AI 는 가만히(move 0),
//  상대 칼 충돌 끔·죽지 않음. 판이 선 뒤로는 몸을 옮기지 않는다. ?emo=0 (공포 떨림 없음), ?foe=default&weapon=longsword&stage=castle
//  시간은 playwright 가짜 시계로 한 프레임(17 ms)씩 → 느린 그래픽에서도 같은 순간이 찍힌다. 콘솔 에러를 모은다 (있으면 종료 코드 1)
//  날 각: 페이지 안에서 combat.analyze 를 감싸 플레이어 닿음의 acos(edgeAlign) 을 combat.js:141-181 식으로 다시 잰다 (결과는 건드리지 않음)
//  실행: vite 개발 서버를 띄운 뒤
//    node tools/browser/corr_shots.mjs http://127.0.0.1:5230 <출력 폴더> [diag,flat,liftShort,holdShort] [0.7,1]
//  출력: <폴더>/<장면>/<변형>_<순간>.png · <변형>_frames.json (프레임마다 { t, pad, held, corr: { win, part, tau, tip, tipHold, tipCarried, tipOut },
//        edge(닿을 때 날 각), bladeTouch, recovering, recoverP, readies, errors }) · <폴더>/corr_shots.json (변형마다 순간·켜짐 확인)
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv[2] || 'http://127.0.0.1:5230').replace(/\/$/, '');
const out = process.argv[3] || '.';
const SCENES = (process.argv[4] || 'diag,flat,liftShort,holdShort').split(',');
const LEVELS = (process.argv[5] || '0.7,1').split(',');
const W = 844, H = 390;
const FRAME = 17; // ms (60 fps 가까이, revive_shots 와 같음)
const X0 = Math.round(W * 0.72), Y0 = Math.round(H * 0.6); // 칼 쪽 화면 (오른쪽 아래: 위로 0.8 m 끌 자리)
const SHORT_DEG = 25; // chain_corr 와 같은 선언 (머리 가운데 선보다 25° 위)
const HIT_GAP = 1.55 + 0.17;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const report = [];

// 장면마다 변형: corr (null = 기본 옛 보정), tip (null = 주지 않음)
const VARIANTS = {
  diag: [{ tag: 'old' }, { tag: 'v2', corr: 'v2' }],
  flat: [{ tag: 'old' }, { tag: 'v2', corr: 'v2' }],
  liftShort: [{ tag: 'old' }, { tag: 'v2tip1', corr: 'v2', tip: 1 }, { tag: 'v2tip0', corr: 'v2', tip: 0 }],
  holdShort: [{ tag: 'old' }, { tag: 'v2tip1', corr: 'v2', tip: 1 }],
};
// 패드 긋기 (corr_lib FAM 과 같은 값): 감기 자리 → 끝, 손가락 빠르기 m/s, 끝에서 누름 ms, 뗌
const SWIPE = {
  diag: { ch: [0.25, 0.25], end: [0.02, 0.0], v: 1.65, hold: 300, lift: true },
  flat: { ch: [0.35, 0.05], end: [-0.3, 0.05], v: 3.25, hold: 0, lift: true },
  liftShort: { ch: [0.02, 0.52], end: null, v: 3, hold: 0, lift: true },
  holdShort: { ch: [0.02, 0.52], end: null, v: 3, hold: 1000, lift: true },
};

async function open(v, level, tag) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  const push = (m) => (errs.push(m), errors.push(`${tag} ${m}`));
  page.on('pageerror', (e) => push(`pageerror: ${e}`));
  page.on('console', (m) => m.type() === 'error' && push(`console: ${m.text()}`));
  page.on('requestfailed', (r) => push(`requestfailed: ${r.url()}`));
  page.on('response', (r) => r.status() >= 400 && push(`http ${r.status()}: ${r.url()}`));
  await page.addInitScript((s) => localStorage.setItem('gladiator-settings', JSON.stringify({ skill: s })), String(level));
  await page.clock.install({ time: new Date('2026-10-01T12:00:00') });
  await page.clock.pauseAt(new Date('2026-10-01T12:00:01'));
  // openSweep=0: 판 시작을 9/30 꼴(정지 2 s)로 — 10/15 무대 훑기는 첫 판 3.3 게임 초 발을 묶어 아래 2.3 s 가 어긋난다 (docs/strike/camera_open_2026-10-15.md)
  const q = `foe=default&weapon=longsword&stage=castle&emo=0&openSweep=0${v.corr ? `&corr=${v.corr}` : ''}${v.tip != null ? `&tip=${v.tip}` : ''}`;
  await page.goto(`${base}/?${q}`, { waitUntil: 'networkidle' });
  for (let i = 0; i < 300 && !(await page.evaluate(() => !!window.game?.player?.sword)); i++) await page.waitForTimeout(100);
  await page.clock.runFor(200);
  // 판을 세우기 전: 시작 거리 (장면 준비)
  await page.evaluate((gap) => (window.game.config.ARENA.startGap = gap), HIT_GAP);
  await page.evaluate(() => document.getElementById('btnStart').click());
  await page.clock.runFor(100);
  // 장면 준비: 상대 가만히·칼 충돌 끔·죽지 않음. 날 각 탭
  const live = await page.evaluate(() => {
    const g = window.game;
    const E = g.enemy;
    g.ai.update = () => E.move.set(0, 0);
    for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
    E.die = () => {};
    const aw = E.applyWound.bind(E);
    E.applyWound = (h) => { if (!(E.decapitated && h.zone === 'neck')) aw(h); };
    const T = g.THREE;
    const C = g.combat.constructor.prototype;
    if (!C.__corrShotTap) {
      C.__corrShotTap = true;
      const orig = C.analyze;
      C.analyze = function (pr, point, S, P, predicting = false) {
        const r = orig.call(this, pr, point, S, P, predicting);
        if (r && !predicting && pr.w.fighter === window.game.player) {
          const axis = new T.Vector3(0, 1, 0).applyQuaternion(S.q);
          const edge = new T.Vector3(1, 0, 0).applyQuaternion(S.q);
          const rel = r.dir.clone().multiplyScalar(r.speed);
          const perp = rel.clone().addScaledVector(axis, -rel.dot(axis));
          const pl = perp.length();
          const ea = pl > 1e-3 ? Math.abs(perp.dot(edge)) / pl : 0;
          window.__hits = (window.__hits || 0) + 1;
          window.__lastHit = { n: window.__hits, eaDeg: +((Math.acos(Math.min(1, ea)) * 180) / Math.PI).toFixed(1), type: r.type, part: pr.v.part, speed: +r.speed.toFixed(2), energy: +r.energy.toFixed(1), t: +g.stats.simTime.toFixed(3) };
        }
        return r;
      };
    }
    const p = g.player;
    return { state: g.state, level: p.skill.level, corr: p.skill.corr ?? null, corrTip: p.skill.corrTip ?? null, humanLimits: g.config.BODY?.humanLimits ?? null, gap: +Math.abs(E.bodies.pelvis.translation().x - p.bodies.pelvis.translation().x).toFixed(2), ppm: Math.max(320, window.innerHeight) / g.config.INPUT.touchSensitivity };
  });
  live.elAtFinger = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id ?? null, [X0, Y0]);
  // 메뉴 설명 (있으면): v2 일 때 보이고, 끝점 겨눔을 끄면 가운데 구절이 빠진다
  live.caption = await page.evaluate(() => { const el = document.getElementById('corrCap'); return el ? { shown: el.style.display !== 'none', text: el.textContent } : null; });
  // 켜짐 확인: 이 트리에 skill.corr 가 있으면 요청과 같아야 한다
  if (live.corr != null && live.corr !== (v.corr ?? 'old')) push(`켜짐 다름: skill.corr ${live.corr} (요청 ${v.corr ?? 'old'})`);
  if (live.corrTip != null && v.tip != null && live.corrTip !== !!v.tip) push(`켜짐 다름: skill.corrTip ${live.corrTip} (요청 ${v.tip})`);
  if (live.elAtFinger !== 'game') push(`손가락 자리 (${X0}, ${Y0}) 의 요소 ${live.elAtFinger} (캔버스 아님)`);
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp, errs, live };
}

const run = (page, ms) => page.clock.runFor(ms);
const state = (page) =>
  page.evaluate(() => {
    const g = window.game, p = g.player, c = p.corr, k = p.skill;
    const r = (x, n = 3) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(n));
    return {
      t: r(g.stats.simTime), pad: [r(p.handOffset.x), r(p.handOffset.y)], held: !!p.handHeld,
      corr: c ? { win: !!c.win, part: c.part ?? null, tau: r(c.tau), tip: !!c.tip, tipHold: !!c.tipHold, tipCarried: r(c.tipCarried), tipOut: r(c.tipOut, 4), tipEnd: c.tipEnd ?? null } : null,
      edge: window.__lastHit ?? null, hits: window.__hits || 0, bladeTouch: p.bladeTouch ?? null, recovering: !!k.recovering, recoverP: r(k.recoverP), readies: k.readies ?? null,
      foeWounds: g.enemy.wounds.length, tip: r(p.tipVel.length(), 2), state: p.state,
    };
  });

async function scene(name, v, level) {
  const tag = `${name}/${v.tag}_s${level}`;
  const { ctx, page, cdp, errs, live } = await open(v, level, tag);
  const dir = path.join(out, name);
  fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  const moments = {};
  const pre = `${v.tag}_s${level}`;
  const snapFrame = async () => {
    const s = await state(page);
    s.errors = errs.length;
    frames.push(s);
    return s;
  };
  const shot = async (m) => {
    const file = path.join(dir, `${pre}_${m}.png`);
    fs.writeFileSync(file, await page.screenshot());
    moments[m] = { file, frame: frames.length - 1, t: frames[frames.length - 1]?.t ?? null };
  };
  let fx = X0, fy = Y0, down = false;
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  /** 한 획: 패드 변위 (dx, dy) m 를 v m/s 로, 프레임마다 한 번 움직임. each = 프레임마다 부름 */
  const drag = async (dx, dy, vel, { hold = 0, lift = true, each } = {}) => {
    if (!down) (await touch('touchStart', [{ x: fx, y: fy, id: 1 }]), (down = true));
    const T = (Math.hypot(dx, dy) / vel) * 1000;
    const bx = fx, by = fy;
    const n = Math.max(1, Math.ceil(T / FRAME));
    for (let k = 1; k <= n; k++) {
      const u = Math.min(1, (k * FRAME) / T);
      fx = bx + dx * u * live.ppm;
      fy = by - dy * u * live.ppm;
      await touch('touchMove', [{ x: fx, y: fy, id: 1 }]);
      await run(page, FRAME);
      await each?.(await snapFrame(), k);
    }
    for (let t = 0; t < hold; t += FRAME) (await run(page, FRAME), await each?.(await snapFrame(), -1));
    if (lift) (await touch('touchEnd', []), (down = false));
  };
  const until = async (pred, maxMs, each) => {
    for (let t = 0; t < maxMs; t += FRAME) {
      await run(page, FRAME);
      const s = await snapFrame();
      await each?.(s);
      if (pred(s)) return s;
    }
    return null;
  };
  // 시작 정지(ARENA.startHold) 가 풀릴 때까지
  await until(() => false, 2300);
  await shot('rest');
  const sw = SWIPE[name];
  // 감기: 지금 패드 → 감기 자리 (1 m/s, 누른 채)
  const pad0 = frames[frames.length - 1].pad;
  await drag(sw.ch[0] - pad0[0], sw.ch[1] - pad0[1], 1, { lift: false });
  await until(() => false, 500); // 감기 자리에서 쥔 채 0.5 s (chain_corr FAM chHold 와 같음: 칼이 자리 잡을 시간)
  let end = sw.end;
  if (!end) {
    const elHead = await page.evaluate(() => {
      const g = window.game;
      const h = g.enemy.bodies.head.translation();
      const a = g.player.bladePoint(0, new g.THREE.Vector3());
      return Math.atan2(h.y - a.y, Math.hypot(h.x - a.x, h.z - a.z));
    });
    const el = elHead + (SHORT_DEG * Math.PI) / 180;
    end = [sw.ch[0], Math.min(sw.ch[1], el > 0 ? 0.1 + (el * 0.5) / 1.65 : 0.1 + el / 1.1)]; // guardDir 높이 매핑의 역 (corr_lib padYForEl)
  }
  const cur = frames[frames.length - 1].pad;
  const h0 = frames[frames.length - 1].hits;
  const w0 = frames[frames.length - 1].foeWounds;
  const once = new Set();
  const watch = async (s, k) => {
    if (k === 3 && !once.has('cut')) (once.add('cut'), await shot('cut'));
    if (s.corr?.win && !once.has('winOpen')) (once.add('winOpen'), await shot('winOpen'));
    if (s.corr?.tip && !once.has('tipOn')) (once.add('tipOn'), await shot('tipOn'));
    if ((s.hits > h0 || s.foeWounds > w0 || s.bladeTouch) && !once.has('contact')) (once.add('contact'), await shot('contact'));
  };
  await drag(end[0] - cur[0], end[1] - cur[1], sw.v, { hold: name === 'holdShort' ? 0 : sw.hold, lift: name !== 'holdShort', each: watch });
  if (name === 'liftShort' || name === 'holdShort') await shot('stop');
  if (name === 'holdShort') {
    await until(() => false, 500, watch);
    await shot('hold500');
    await until(() => false, sw.hold - 500, watch);
    await shot('hold1000');
    await touch('touchEnd', []);
    down = false;
  }
  const tLift = frames[frames.length - 1].t;
  // 닿음·② 를 뗀 뒤 0.6 s 까지 더 본다
  await until(() => false, 600, watch);
  if (once.has('contact') || name !== 'liftShort') await shot('after');
  else await shot('end');
  if (name === 'diag') {
    const r0 = frames[frames.length - 1].readies;
    const rec = await until((s) => s.recovering, 1500);
    if (rec) await shot('recovery');
    let wasRec = !!rec;
    const rdy = await until((s) => {
      const arrived = wasRec && !s.recovering; // 옛 보정: 되돌아옴 도착
      wasRec = wasRec || s.recovering;
      return (s.readies != null && r0 != null && s.readies > r0) || arrived;
    }, 3000);
    if (rdy) await shot('ready');
  }
  const r = { scene: name, variant: v.tag, level, url: v, live, tLift, moments: Object.fromEntries(Object.entries(moments).map(([k, m]) => [k, { t: m.t, frame: m.frame, png: path.relative(out, m.file) }])), missing: ['rest', 'cut', 'winOpen', 'contact', 'after', 'recovery', 'ready', 'tipOn', 'stop', 'hold500', 'hold1000', 'end'].filter((m) => !moments[m]), hits: frames[frames.length - 1].hits - h0, lastHit: frames[frames.length - 1].edge, errors: errs };
  fs.writeFileSync(path.join(dir, `${pre}_frames.json`), JSON.stringify(frames));
  await ctx.close();
  return r;
}

for (const name of SCENES) {
  if (!VARIANTS[name]) throw new Error(`모르는 장면 ${name}`);
  for (const level of LEVELS) for (const v of VARIANTS[name]) report.push(await scene(name, v, level));
}
fs.writeFileSync(path.join(out, 'corr_shots.json'), JSON.stringify(report, null, 1));
for (const r of report) console.log(`${r.scene.padEnd(9)} ${r.variant.padEnd(6)} s${r.level}: corr ${r.live.corr ?? 'n/a'} tip ${r.live.corrTip ?? 'n/a'} 거리 ${r.live.gap} m · 순간 ${Object.keys(r.moments).join(',')} · 닿음 ${r.hits}${r.lastHit ? ` (${r.lastHit.type} ${r.lastHit.part} 날 각 ${r.lastHit.eaDeg}°)` : ''}`);
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : '\nZERO console errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
