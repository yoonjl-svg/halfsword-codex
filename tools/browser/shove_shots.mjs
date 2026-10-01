// 근접 밀치기 화면 확인 (docs/strike/shove_design_2026-09-30.md 구현 목록 7, 값은 모두 사장님 확인 전): 실제 게임 화면(844×390 가로 폰)에서
//  붙음 → 스틱을 놓았다가 새로 밂 → 딛기 → 누르기 → 되돌림 → 이어 베기, 그리고 등 뒤가 울타리인 상대를 민다.
//  시간은 playwright 가짜 시계로 한 프레임(1/60초)씩 돌린다 → 느린 그래픽(소프트웨어 렌더링)에서도 매번 같은 순간이 찍힌다.
//  플레이어는 진짜 입력 길로만 움직인다: 스틱 = 키보드 W(input.move → main.js 가 stickX/Y·move 를 쓴다), 베기 = 캔버스를 마우스로 끌기
//   (input 손 이동). 몸을 옮기지 않는다. 장면 준비만 상대를 정한다: 기본 상대(?foe=default, persona.close 없음 → 밀지 않음)의 AI 를
//   꼭두각시로 바꾼다(mouse_thrust.mjs 처럼 game.ai.update 를 바꿈, 발은 move 로만). 붙음은 시작 간격을 1.6 m 로(ARENA.startGap, 판 시작 전)
//   두고 둘 다 걸어 들어와 붙은 뒤 상대는 버틴다. 벽은 상대가 뒤로 걸어 울타리에 등을 대고 버틴다.
//  찍는 것: 이름 붙은 순간마다 PNG 두 장(게임 카메라, 옆 카메라)과 그 순간의 JSON, 모든 프레임의 JSON(frames.json):
//   d(가슴 거리), barge 단계·L, lift, closeW, 스틱 원값·걸쇠, 상대 골반이 밀린 거리(밂 시작 때 나→상대 방향), 두 사람 발(앞·뒤 x·z),
//   발 겹침(발 상자끼리, 내 앞발 중심이 상대 발 상자 안), 한 물리 스텝 손 목표 최대 변화(가슴 기준 mm), 두 골반 한 프레임 이동 최대,
//   칼 부딪힘 수, 콘솔 에러 수. 끝에 장면마다 요약(summary.json)
//  실행: vite 개발 서버를 띄운 뒤
//    node tools/browser/shove_shots.mjs http://127.0.0.1:5173 <출력 폴더> [glued,wall,glued_off,wall_off]
//   (_off = 같은 대본을 CLOSE.on=false 로: 오늘의 걸어 밀기와 견줄 대조)
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const outRoot = process.argv[3] || '.';
const scenes = (process.argv[4] || 'glued,wall').split(',');
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];

// 시험 대본의 숫자 (게임 값 아님: shove_check.mjs 의 glued 칸과 같은 엄지)
const GLUE_D = 0.6; // 붙음: 가슴 거리 이 안에서
const GLUE_HOLD = 0.5; //  이만큼 서로 밀고 있으면 붙은 것
const REL_S = 0.15; // 스틱을 놓는 시간 (엄지 한 번)
const PRESS_S = 1.0; // 발사 뒤 스틱을 미는 시간 (그 전에 물리 사건으로 끝나면 거기서 놓는다)
const WALL_X = 6.0; // 벽 장면: 상대 골반이 이만큼(m) 뒤로 가면 선다 (울타리 안쪽 면 ARENA.radius + 0.25 − 0.2 = 6.55)
const FRAME = 17; // 한 프레임 (ms)

async function open(tag, stage, gap, off) {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${tag} console: ${m.text()}`));
  page.on('requestfailed', (r) => errors.push(`${tag} requestfailed: ${r.url()}`));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${tag} http ${r.status()}: ${r.url()}`));
  // 가짜 시계: 처음부터 멈춰 두고 runFor 로만 돌린다
  await page.clock.install({ time: new Date('2026-09-30T12:00:00') });
  await page.clock.pauseAt(new Date('2026-09-30T12:00:01'));
  await page.goto(`${base}/?foe=default&stage=${stage}&weapon=longsword`, { waitUntil: 'networkidle' });
  for (let i = 0; i < 300 && !(await page.evaluate(() => !!window.game?.player?.sword)); i++) await page.waitForTimeout(100);
  await page.clock.runFor(200);
  // 판 시작 + 장면 준비 (같은 evaluate 안: 첫 프레임 전에 상대를 꼭두각시로)
  await page.evaluate(([g0, off]) => {
    const g = window.game;
    if (g0) g.config.ARENA.startGap = g0; // 판을 세울 때 읽는다 (main.js newRound)
    if (off) g.config.CLOSE.on = false;
    document.getElementById('btnStart').click();
    const ai = g.ai;
    window.__foeMove = 0; // 꼭두각시 상대의 앞(+)/뒤(-) 걸음: 장면 대본이 정한다
    ai.update = () => ai.me.move.set(0, window.__foeMove);
    installProbe();
    function installProbe() {
      const T = g.THREE;
      const P = g.player;
      const E = g.enemy;
      // 손 목표 한 스텝 변화 (가슴 기준·몸 방향 기준, shove_check wrapHand 와 같다): 읽기만
      const hl = new T.Vector3();
      const qi = new T.Quaternion();
      let prev = null;
      const st = P.step.bind(P);
      const S = { dhMax: 0, steps: 0 };
      P.step = (dt) => {
        st(dt);
        S.steps++;
        const ht = P.handTarget;
        if (!ht) return;
        const c = P.bodies.chest.translation();
        hl.set(ht.x - c.x, ht.y - c.y, ht.z - c.z).applyQuaternion(qi.copy(P.yaw).invert());
        if (prev) S.dhMax = Math.max(S.dhMax, hl.distanceTo(prev));
        prev = prev || new T.Vector3();
        prev.copy(hl);
      };
      const AX = [new T.Vector3(1, 0, 0), new T.Vector3(0, 1, 0), new T.Vector3(0, 0, 1)];
      const obbOf = (col) => {
        const t = col.translation();
        const r = col.rotation();
        const h = col.halfExtents();
        const q = new T.Quaternion(r.x, r.y, r.z, r.w);
        return { c: new T.Vector3(t.x, t.y, t.z), a: AX.map((v) => v.clone().applyQuaternion(q)), h: [h.x, h.y, h.z] };
      };
      const obbHit = (A, B) => {
        const R = [[], [], []];
        const AR = [[], [], []];
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) (R[i][j] = A.a[i].dot(B.a[j])), (AR[i][j] = Math.abs(R[i][j]) + 1e-9);
        const tv = B.c.clone().sub(A.c);
        const t = [tv.dot(A.a[0]), tv.dot(A.a[1]), tv.dot(A.a[2])];
        for (let i = 0; i < 3; i++) if (Math.abs(t[i]) > A.h[i] + B.h[0] * AR[i][0] + B.h[1] * AR[i][1] + B.h[2] * AR[i][2]) return false;
        for (let j = 0; j < 3; j++) if (Math.abs(t[0] * R[0][j] + t[1] * R[1][j] + t[2] * R[2][j]) > A.h[0] * AR[0][j] + A.h[1] * AR[1][j] + A.h[2] * AR[2][j] + B.h[j]) return false;
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < 3; j++) {
            const i1 = (i + 1) % 3;
            const i2 = (i + 2) % 3;
            const j1 = (j + 1) % 3;
            const j2 = (j + 2) % 3;
            if (Math.abs(t[i2] * R[i1][j] - t[i1] * R[i2][j]) > A.h[i1] * AR[i2][j] + A.h[i2] * AR[i1][j] + B.h[j1] * AR[i][j2] + B.h[j2] * AR[i][j1]) return false;
          }
        return true;
      };
      const feet = (f) => ['footF', 'footB'].map((k) => obbOf(f.bodies[k].collider(0)));
      const r3 = (v) => +v.toFixed(3);
      let ref = null; // 밂 시작 때: 상대 골반 위치와 나→상대 방향
      let lastP = null;
      let lastE = null;
      window.__shv = {
        S,
        mark() {
          const pe = E.bodies.pelvis.translation();
          const cp = P.bodies.chest.translation();
          const ce = E.bodies.chest.translation();
          const u = new T.Vector3(ce.x - cp.x, 0, ce.z - cp.z).normalize();
          ref = { x: pe.x, z: pe.z, u };
        },
        rec() {
          const mine = feet(P);
          const his = feet(E);
          const box = mine.some((a) => his.some((b) => obbHit(a, b)));
          const cp = P.bodies.chest.translation();
          const ce = E.bodies.chest.translation();
          const ux = ce.x - cp.x;
          const uz = ce.z - cp.z;
          const front = mine[0].c.x * ux + mine[0].c.z * uz >= mine[1].c.x * ux + mine[1].c.z * uz ? mine[0] : mine[1];
          const inside = his.some((b) => {
            const v = front.c.clone().sub(b.c);
            return Math.abs(v.dot(b.a[0])) <= b.h[0] && Math.abs(v.dot(b.a[2])) <= b.h[2] && Math.abs(v.dot(b.a[1])) <= b.h[1] + front.h[1];
          });
          const pp = P.bodies.pelvis.translation();
          const pe = E.bodies.pelvis.translation();
          const jumpP = lastP ? Math.hypot(pp.x - lastP.x, pp.z - lastP.z) : 0;
          const jumpE = lastE ? Math.hypot(pe.x - lastE.x, pe.z - lastE.z) : 0;
          lastP = { x: pp.x, z: pp.z };
          lastE = { x: pe.x, z: pe.z };
          const b = P.barge;
          const o = {
            t: r3(P.fightT),
            d: r3(P.foeDistance()),
            reach: r3(g.config.CLOSE.reach(P.armed ? P.weapon : null)),
            stick: [r3(P.stickX), r3(P.stickY)],
            armed: P.closeArmed,
            barge: b ? { phase: b.phase, L: r3(b.L), stepOk: b.stepOk, d0: r3(b.d0) } : null,
            bargeEnd: P.bargeEnd,
            shoves: P.shoves,
            lift: r3(P.lift),
            closeW: r3(P.closeW),
            armFull: P.armFull,
            req: P.gait?.req ? { kind: P.gait.req.kind, age: r3(P.gait.req.age ?? 0) } : null,
            swinging: P.skill.swinging,
            state: [P.state, E.state],
            foePush: ref ? r3((pe.x - ref.x) * ref.u.x + (pe.z - ref.z) * ref.u.z) : null,
            foePelvis: [r3(pe.x), r3(pe.z)],
            feetP: mine.map((a) => [r3(a.c.x), r3(a.c.z)]),
            feetE: his.map((a) => [r3(a.c.x), r3(a.c.z)]),
            footBox: box,
            footInside: inside,
            handStepMaxMm: +(S.dhMax * 1000).toFixed(1),
            physSteps: S.steps,
            pelvisFrameMax: r3(Math.max(jumpP, jumpE)),
            clashes: g.stats.clashes,
            hits: g.stats.hits.length,
            offBalance: [r3(P.offBalance ?? 0), r3(E.offBalance ?? 0)],
          };
          S.dhMax = 0;
          S.steps = 0;
          return o;
        },
      };
    }
  }, [gap, off]);
  return page;
}

async function runScene(tag) {
  const wall = tag.startsWith('wall');
  const off = tag.endsWith('_off'); // 대조: CLOSE.on=false 로 같은 대본 (오늘: 붙은 채 스틱을 밀면 걸어 밀기)
  const out = path.join(outRoot, tag);
  fs.mkdirSync(out, { recursive: true });
  const page = await open(tag, 'castle', wall ? null : 1.6, off);
  const frames = [];
  const shots = [];
  let nShot = 0;
  let W = false;
  const key = async (down) => {
    if (down === W) return;
    W = down;
    if (down) await page.keyboard.down('KeyW');
    else await page.keyboard.up('KeyW');
  };
  const frame = async () => {
    await page.clock.runFor(FRAME);
    const r = await page.evaluate(() => window.__shv.rec());
    r.W = W;
    r.errors = errors.length;
    frames.push(r);
    return r;
  };
  const shot = async (name, r) => {
    nShot++;
    const stem = `${String(nShot).padStart(2, '0')}_${name}`;
    const f1 = path.join(out, `${stem}.png`);
    fs.writeFileSync(f1, await page.screenshot());
    // 옆에서 한 장 (기본 카메라는 내 어깨 너머라 내 몸이 상대 발·팔을 가린다). 한 프레임 그리고 카메라를 그대로 되돌린다
    await page.evaluate(() => {
      const g = window.game;
      const T = g.THREE;
      const a = g.player.pelvisPos;
      const b = g.enemy.pelvisPos;
      const m = new T.Vector3().addVectors(a, b).multiplyScalar(0.5);
      const d = new T.Vector3().subVectors(b, a).setY(0).normalize();
      // 옆 두 쪽 가운데 경기장 안쪽에 가까운 쪽. 둘 다 울타리(반지름 6.3) 밖이면(벽 장면) 내 쪽으로 45° 돌려 비스듬히 안에서 본다
      const cands = [1, -1].flatMap((sg) => [new T.Vector3(-d.z * sg, 0, d.x * sg), new T.Vector3(-d.z * sg, 0, d.x * sg).multiplyScalar(0.7).addScaledVector(d, -0.7)]);
      const r = (v) => m.clone().addScaledVector(v, 3).setY(0).length();
      const side = cands.slice(0, 2).find((v) => r(v) <= 6.3) ?? cands.slice(2).sort((a, b) => r(a) - r(b))[0];
      g.__cam = { p: g.camera.position.clone(), q: g.camera.quaternion.clone() };
      g.freeCam = true;
      g.camera.position.copy(m).addScaledVector(side, 3.0).setY(1.2);
      g.camera.lookAt(m.x, 0.8, m.z);
    });
    await page.clock.runFor(FRAME);
    const rs = await page.evaluate(() => window.__shv.rec());
    rs.W = W;
    rs.errors = errors.length;
    frames.push(rs);
    const f2 = path.join(out, `${stem}_side.png`);
    fs.writeFileSync(f2, await page.screenshot());
    await page.evaluate(() => {
      const g = window.game;
      g.camera.position.copy(g.__cam.p);
      g.camera.quaternion.copy(g.__cam.q);
      g.freeCam = false;
    });
    await frame(); // 게임 카메라로 한 프레임 다시 그린다 (안 그리면 다음 컷이 옆 카메라 그림을 그대로 찍는다)
    const rec = { name, frame: r, side: rs, png: [f1, f2] };
    fs.writeFileSync(path.join(out, `${stem}.json`), JSON.stringify(rec, null, 1));
    shots.push(rec);
  };
  const until = async (fn, maxS) => {
    let r = frames[frames.length - 1] ?? (await frame());
    for (let t = 0; t < maxS && !fn(r); t += FRAME / 1000) r = await frame();
    return r;
  };

  // 1) 시작 정지(발 묶임)가 풀릴 때까지
  let r = await until((x) => x.t >= 2.05, 4);
  // 2) 장면 준비. 붙음: 둘 다 걸어 들어와 GLUE_D 안에서 GLUE_HOLD 동안 서로 밂. 벽: 상대가 뒤로 걸어 울타리에 등을 대고, 나는 따라가 붙는다
  let tG = null;
  for (let t = 0; t < 14; t += FRAME / 1000) {
    const ex = r.foePelvis[0];
    if (wall) {
      await page.evaluate((v) => (window.__foeMove = v), ex < WALL_X ? -1 : 0);
      await key(ex >= WALL_X || r.d > 1.4); // 상대가 물러나는 동안은 1.4 m 밖에서만 따라간다
    } else {
      await page.evaluate(() => (window.__foeMove = 1));
      await key(true);
    }
    r = await frame();
    if (tG == null && r.d < GLUE_D && (!wall || ex >= WALL_X)) tG = r.t;
    if (tG != null && r.t >= tG + GLUE_HOLD) break;
  }
  await page.evaluate(() => (window.__foeMove = 0)); // 이제 상대는 버틴다 (발 0)
  await shot('glued', r);
  // 3) 스틱을 놓는다 → 걸쇠
  await key(false);
  const tRel = r.t;
  r = await until((x) => x.t >= tRel + REL_S, 1);
  await shot('released', r);
  // 4) 새로 민다 → 발사
  await page.evaluate(() => window.__shv.mark());
  await key(true);
  const sh0 = r.shoves;
  const tPush = frames[frames.length - 1].t; // 옆 카메라 한 프레임까지 지난 뒤
  r = await until((x) => x.shoves > sh0 || (off && x.t > tPush), 0.5); // 끔: 발사가 없다 (민 뒤 첫 프레임)
  const tFire = r.t;
  const fire = { fired: r.shoves > sh0, t: tFire, barge: r.barge, bargeEnd: r.bargeEnd, d: r.d };
  await shot(fire.fired ? 'fire' : 'push', r);
  if (!fire.fired) {
    // 발사가 없으면(끔 대조) 같은 시간 동안 걸어 민다 (오늘: 스틱 걷기의 다리 힘)
    r = await until((x) => x.t >= tPush + 0.45, 1);
    await shot('push_mid', r);
  }
  if (r.barge?.phase === 'step') {
    r = await until((x) => x.t >= tFire + 0.12 || x.barge?.phase !== 'step', 1);
    await shot('step', r);
    r = await until((x) => x.barge?.phase !== 'step', 1.5);
  }
  // 5) 누르기: 단계가 press 가 된 뒤 0.3 s
  if (r.barge?.phase === 'press') {
    const tP = r.t;
    r = await until((x) => x.t >= tP + 0.3 || !x.barge, 1);
    await shot('press', r);
  }
  r = await until((x) => x.t >= tFire + PRESS_S || (fire.fired && !x.barge), 2);
  // 6) 놓는다 (이미 물리 사건으로 끝났으면 그 까닭이 bargeEnd 에) → 되돌림
  await key(false);
  r = await until((x) => !x.barge, 1);
  const end = { t: r.t, bargeEnd: r.bargeEnd, afterFire: +(r.t - tFire).toFixed(3) };
  r = await until((x) => x.lift <= 0.5, 1);
  await shot('return', r);
  r = await until((x) => x.lift <= 0.02 && x.closeW <= 0.02, 1.5);
  await shot('returned', r);
  // 7) 이어 베기: 캔버스를 마우스로 끈다 (오른쪽 위 → 왼쪽 아래로 빠르게). 손짓 길 그대로 (input.onDown/onMove/onUp)
  const X = 560;
  const Y = 150;
  await page.mouse.move(X, Y);
  await page.mouse.down();
  let cut = null;
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(X - 14 * i, Y + 11 * i);
    r = await frame();
    if (r.swinging && !cut) cut = { t: r.t, i, locked: await page.evaluate(() => !!document.pointerLockElement) };
    if (cut && i === cut.i + 4) await shot('cut', r); // 휘두르기가 된 뒤 네 프레임: 칼이 한창 지나가는 때
  }
  await page.mouse.up();
  r = await until((x) => x.t >= (cut?.t ?? r.t) + 0.6, 1);
  await shot('after_cut', r);
  await page.close();
  const post = frames.filter((x) => x.t >= tRel);
  const mx = (a, k) => (a.length ? Math.max(...a.map((x) => x[k])) : null);
  const tCut = cut?.t ?? Infinity;
  const plant = frames.find((x) => x.t > tFire && x.barge?.phase === 'press'); // req 다리가 디딘 프레임 (L = 0 이면 발사 프레임)
  const sum = {
    scene: tag,
    off: !!off,
    fire,
    end,
    cut,
    // 손 목표 한 물리 스텝 최대 변화 (mm): 놓은 뒤 발사 전 / 밀치는 중 / 되돌림(끝 ~ 베기 전) / 베기
    handStepMm: {
      pre: mx(post.filter((x) => x.t < tFire), 'handStepMaxMm'),
      barge: mx(post.filter((x) => x.t >= tFire && x.t <= end.t && x.t < tCut), 'handStepMaxMm'),
      ret: mx(post.filter((x) => x.t > end.t && x.t < tCut), 'handStepMaxMm'),
      cut: mx(post.filter((x) => x.t >= tCut), 'handStepMaxMm'),
    },
    plant: plant ? { t: plant.t, footBox: plant.footBox, footInside: plant.footInside, feetP: plant.feetP, feetE: plant.feetE } : null,
    maxPelvisFrame: mx(frames.slice(1), 'pelvisFrameMax'),
    footBoxFrames: post.filter((x) => x.footBox).length,
    footInsideFrames: post.filter((x) => x.footInside).length,
    footBoxFramesBarge: post.filter((x) => x.footBox && x.barge).length,
    foePushMax: Math.max(...post.filter((x) => x.foePush != null).map((x) => x.foePush)),
    foePushEnd: frames[frames.length - 1].foePush,
    clashes: frames[frames.length - 1].clashes - (frames.find((x) => x.t >= tRel)?.clashes ?? 0),
    hits: frames[frames.length - 1].hits - (frames.find((x) => x.t >= tRel)?.hits ?? 0),
    states: [...new Set(post.map((x) => x.state.join('/')))],
    frames: frames.length,
    errors: errors.filter((e) => e.startsWith(tag)).length,
    shots: shots.map((s) => s.png).flat(),
  };
  fs.writeFileSync(path.join(out, 'frames.json'), JSON.stringify(frames));
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(sum, null, 1));
  return sum;
}

const report = [];
for (const s of scenes) report.push(await runScene(s));
for (const s of report) {
  console.log(`\n== ${s.scene}: 발사 ${s.fire.fired ? `t ${s.fire.t} d ${s.fire.d} ${JSON.stringify(s.fire.barge)}` : '없음'} · 끝 ${s.end.bargeEnd} (발사 뒤 ${s.end.afterFire} s) · 베기 ${s.cut ? `t ${s.cut.t}` : '없음'}`);
  console.log(`   손 목표 한 스텝 최대 mm ${JSON.stringify(s.handStepMm)} · 디딘 발 ${s.plant ? `상자 ${s.plant.footBox} 안 ${s.plant.footInside}` : '-'} · 골반 한 프레임 최대 ${s.maxPelvisFrame} m · 발 상자 겹침 ${s.footBoxFrames} 프레임(밀치는 중 ${s.footBoxFramesBarge}) · 앞발 중심 안 ${s.footInsideFrames} · 상대 밀림 최대 ${s.foePushMax} m, 끝 ${s.foePushEnd} m · 칼 부딪힘 ${s.clashes} · 상처 ${s.hits} · 상태 ${s.states.join(' ')} · 프레임 ${s.frames}`);
}
fs.writeFileSync(path.join(outRoot, 'shove_shots.json'), JSON.stringify(report, null, 1));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : '\nZERO console errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
