// ─────────────────────────────────────────────────────────────
//  디렉터 온몸 베기 구현(claude/wbs-impl)을 기준 동작과 같은 관절 형식으로 기록 (동작 연구 PM)
//
//   git worktree add --detach <경로> origin/claude/wbs-impl && ln -s $PWD/node_modules <경로>/node_modules
//   node tools/motion/record_wbs.mjs --root=<경로> [--v=12] [--hz=60]
//     → docs/motion/records/wbs_<무리>_<arm|commit>.json (+ records/index.json)
//
//  그 체크아웃의 src/ 를 읽기만 한다(고치지 않는다). 조건은 디렉터 측정 도구 tools/redesign_probes/tseq.mjs 와 같다:
//   hybrid 걸음, 롱소드, skill 0.7, 거리 2.0 m(상대는 서 있기만, 칼 충돌 끔), 쟁기에서 2초 → 감기 자리로 1.2 m/s 획 + 1초 머묾
//   → 끝 자리로 v m/s 획(손가락 뗌). arm = WHOLE.commit 끔(팔 베기), commit = 켬(결심 베기).
//  무리: diagR = 분노의 베기(오른 어깨 → 왼쪽 바꿈), vert = 위에서 베기(지붕 → 바보), horizR = 가로(옆 → 왼쪽 옆), riseR = 아래에서 베기(바꿈 → 왼쪽 황소)
//  시각 0 = 베기 획 시작 − 0.6 s (감기 머묾 끝이 들어가게)
// ─────────────────────────────────────────────────────────────
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JOINTS, BONES } from './lib/body.mjs';
import { jointsOf, speeds } from './lib/game_joints.mjs';
import { writeRecord, gitRev } from './lib/records.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'docs', 'motion', 'records');
const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const WROOT = resolve(arg('root', ''));
if (!arg('root')) throw new Error('--root=<claude/wbs-impl 체크아웃 경로> 가 필요하다');
const V = +arg('v', 12);
const HZ = +arg('hz', 60);
const PRE = 0.6;
const POST = 1.0;

const cfg = await import(pathToFileURL(join(WROOT, 'src/config.js')).href);
cfg.BODY.weightMode = 'hybrid'; // 게임과 같게 (config 기본값과 같다)
const H = await import(pathToFileURL(join(WROOT, 'tools/sim/harness_m.mjs')).href);
const { newRound, DT, THREE, CONFIG, feedTrace, inputPump } = H;
const rev = process.env.WBS_REV || gitRev(WROOT); // 기록에 남길 커밋 (체크아웃의 HEAD, WBS_REV 로 덮어쓸 수 있음)
const SEED = 7;
const GAP = 2.0;

const PAD = { Pflug: [0.18, -0.28], ShR: [0.42, 0.42], WechselL: [-0.4, -0.42], Tag: [0.02, 0.52], Alber: [0, -0.5], Side: [0.52, 0.03], SideL: [-0.52, 0.03], Wechsel: [0.38, -0.44], OchsL: [-0.22, 0.26] };
const padName = (xy) => Object.keys(PAD).find((k) => PAD[k] === xy);
const FAM = {
  diagR: { ch: PAD.ShR, end: PAD.WechselL, cut: 'zornhau' },
  vert: { ch: PAD.Tag, end: PAD.Alber, cut: 'oberhau' },
  horizR: { ch: PAD.Side, end: PAD.SideL, cut: 'mittelhau' },
  riseR: { ch: PAD.Wechsel, end: PAD.OchsL, cut: 'unterhau' },
};

function stroke(dx, dy, v, { hold = 0, lift = true, down = true } = {}) {
  const T = (Math.hypot(dx, dy) / v) * 1000;
  return { fn: (t) => { const u = T > 0 ? Math.min(1, t / T) : 1; return [dx * u, dy * u]; }, T: T + hold, lift, down };
}
function setPad(P, xy) {
  P.handOffset.set(xy[0], xy[1]);
  const k = P.skill;
  for (const v of [k.prev, k.aim, k.aimRaw, k.anchor]) v?.set(xy[0], xy[1]);
  k.aimVel?.set(0, 0);
  k.vel?.set(0, 0);
  k.follow?.set(0, 0);
}

function trial(fam, mode) {
  CONFIG.WHOLE.commit = mode !== 'arm';
  const G = newRound({ walls: false, gap: GAP + 0.17, seed: SEED, weapon: 'longsword' });
  const P = G.player, E = G.enemy;
  G.ai.update = () => E.move.set(0, 0);
  for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  for (let i = 0; i < P.sword.numColliders(); i++) P.sword.collider(i).setCollisionGroups(0);
  E.die = () => {};
  P.skill.level = 0.7;
  setPad(P, PAD.Pflug);
  inputPump(G, { hz: HZ });
  let commits = 0;
  if (P.onCommit) {
    const oc = P.onCommit.bind(P);
    P.onCommit = (...a) => (commits++, oc(...a));
  }
  for (let i = 0; i < Math.round(2.0 / DT); i++) G.step();
  const F = FAM[fam];
  const off = [P.handOffset.x, P.handOffset.y];
  // 감기 자리로 천천히 + 머묾. 월드 관절을 굴려 두다가(최근 PRE 초) 베기 획 시작 PRE 초 앞을 원점으로 삼는다
  const W = { origin: new THREE.Vector3(0, 0, 0), yaw0: 0 };
  const keep = Math.round(PRE / DT);
  const buf = [];
  const snap = () => {
    const p = P.bodies.pelvis.translation();
    const fw = P.forward();
    return { J: jointsOf(P, THREE, W), o: [p.x, p.z], yaw: Math.atan2(fw.z, fw.x) };
  };
  const chq = feedTrace(G, stroke(F.ch[0] - off[0], F.ch[1] - off[1], 1.2, { hold: 1000, lift: false }), HZ);
  while (!chq.done) {
    G.step();
    buf.push(snap());
    if (buf.length > keep) buf.shift();
  }
  const cur = [P.handOffset.x, P.handOffset.y];
  const cut = feedTrace(G, stroke(F.end[0] - cur[0], F.end[1] - cur[1], V, { down: false, lift: true }), HZ);
  const tStart = buf.length * DT; // 베기 획을 건 때 (기록 시각)
  let guard = 0;
  do {
    G.step();
    buf.push(snap());
  } while (cut.t0 == null && ++guard < 120);
  for (let i = 0; i < Math.round(POST / DT); i++) {
    G.step();
    buf.push(snap());
  }
  // 첫 표본의 골반 밑 땅·바라보는 방향을 원점으로 다시 적는다
  const [ox, oz] = buf[0].o;
  const c = Math.cos(-buf[0].yaw), sn = Math.sin(-buf[0].yaw);
  const frames = buf.map((q, i) => {
    const J = new Array(q.J.length);
    for (let k = 0; k < q.J.length; k += 3) {
      const dx = q.J[k] - ox, dz = q.J[k + 2] - oz;
      J[k] = +(dx * c - dz * sn).toFixed(3);
      J[k + 1] = q.J[k + 1];
      J[k + 2] = +(dx * sn + dz * c).toFixed(3);
    }
    return { t: +(i * DT).toFixed(4), J };
  });
  return { frames, tStart, commits, cutT: cut.T };
}

mkdirSync(OUT, { recursive: true });
for (const fam of Object.keys(FAM)) {
  for (const mode of ['arm', 'commit']) {
    const { frames, tStart, commits } = trial(fam, mode);
    const tip = speeds(frames, DT, 'tip');
    const hand = speeds(frames, DT, 'hS');
    const peakI = tip.indexOf(Math.max(...tip));
    const r = {
      format: 'stillness-motion-record/1',
      id: `wbs_${fam}_${mode}`,
      cut: FAM[fam].cut,
      kind: mode === 'arm' ? 'wbs-arm' : 'wbs-commit',
      source: `디렉터 온몸 베기 구현 ${rev} (${mode === 'arm' ? '팔 베기, WHOLE.commit 끔' : '결심 베기, WHOLE.commit 켬'}), tseq.mjs 조건: hybrid, 롱소드, skill 0.7, 2.0 m, 감기 자리 1.2 m/s + 1 s 머묾 → 끝 자리 ${V} m/s 획, 입력 ${HZ} Hz, 칼 충돌 끔. 결심 ${commits}번`,
      cond: {
        code: `claude/wbs-impl ${rev}`,
        seed: SEED,
        physicsHz: Math.round(1 / DT),
        recordHz: Math.round(1 / DT),
        inputHz: HZ,
        weapon: 'longsword',
        gait: cfg.BODY.weightMode,
        skill: 0.7,
        gap: GAP,
        input: `패드: Pflug ${JSON.stringify(PAD.Pflug)} 2 s → ${padName(FAM[fam].ch)} ${JSON.stringify(FAM[fam].ch)} 1.2 m/s + 1 s 머묾 → ${padName(FAM[fam].end)} ${JSON.stringify(FAM[fam].end)} ${V} m/s (tseq.mjs)`,
        commit: mode === 'arm' ? '끔' : `켬 (결심 ${commits}번)`,
      },
      hz: Math.round(1 / DT),
      marks: { cutStroke: +tStart.toFixed(4), tipPeak: frames[peakI].t },
      summary: { tipPeak: Math.max(...tip), handPeak: Math.max(...hand), tipPeakT: frames[peakI].t, commits },
      joints: JOINTS,
      bones: BONES,
      data: { n: frames.length, cols: { t: frames.map((q) => q.t), 'speed.tip': tip, 'speed.hand': hand, J: frames.flatMap((q) => q.J) } },
    };
    writeRecord(OUT, r);
    console.log(`${r.id.padEnd(20)} 칼끝 최고 ${r.summary.tipPeak} m/s (t ${r.summary.tipPeakT}s) · 손 ${r.summary.handPeak} m/s · 결심 ${commits} · ${r.data.n} 표본`);
  }
}
