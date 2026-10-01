// ─────────────────────────────────────────────────────────────
//  기준 동작 클립 검사 규칙 (동작 연구 PM) — docs/motion/clip_format.md §6 "검사 규칙" 을 코드로 옮긴 것
//
//  node 모듈을 쓰지 않는다(브라우저에서도 돈다). 게임 자세표는 부르는 쪽이 넘긴다:
//    checkClip(clip, { guards, file })  → [{ rule, level: 'error' | 'warn', msg }]
//    checkIndex(index, clipsByFile, { guards }) → 같은 꼴 (목록 자체 + 목록과 클립이 맞는지)
//  guards = { 자세 id: { hand: [앞, 위, 칼 쪽] m, dir: 단위 벡터, pelvisYaw, chestYaw, pitch (라디안), drop m } }
//   (src/guards.js GUARDS 를 GUARD_NAMES 로 id 에 붙인 것 — validate_clip.mjs gameGuards())
//  규칙 번호(F1, G1 …)는 문서 표와 같다. 규칙을 바꾸면 문서 표도 같이 바꾼다.
// ─────────────────────────────────────────────────────────────
import { BODY, JOINTS } from './body.mjs';
import { phaseAt } from './clip.mjs';

export const CLIP_FORMAT = 'stillness-motion-clip/2';
export const INDEX_FORMAT = 'stillness-motion-index/1';
export const MARKS = ['t0', 'tw', 'tr', 'tc', 'tf', 'tg'];
export const PHI_MARKS = { t0: -1, tw: 0, tr: 0.55, tc: 0.85, tf: 1.6, tg: 2.2 };
const ANG = ['pelvisYaw', 'chestYaw', 'xFactor', 'lean', 'shoulderElevS', 'elbowS', 'elbowO', 'wrist', 'kneeL', 'kneeR'];

/** 꼭 있어야 하는 채널과 폭 (clip_format.md §3-2) */
export const CHANNELS = {
  t: 1, phi: 1,
  'pelvis.yaw': 1, 'pelvis.pitch': 1, 'pelvis.drop': 1,
  'chest.yaw': 1, 'chest.xFactor': 1, 'chest.lean': 1, 'chest.side': 1,
  handS: 3, handO: 3, sword: 3, edge: 3, elbowPoleS: 3, elbowPoleO: 3,
  girdleS: 2, girdleO: 2, guardGap: 1, openness: 1,
  'feet.L.yaw': 1, 'feet.L.lift': 1, 'feet.R.yaw': 1, 'feet.R.lift': 1,
  com: 3,
  ...Object.fromEntries(ANG.map((k) => [`ang.${k}`, 1])),
  'w.pelvis': 1, 'w.chest': 1, 'w.shoulder': 1, 'w.wrist': 1,
  'speed.tip': 1, 'speed.hand': 1,
  J: JOINTS.length * 3,
};
const UNIT = ['sword', 'edge', 'elbowPoleS', 'elbowPoleO'];

/** 허용치 — 기준 자료가 맞게 만들어졌나를 보는 검사용 값이다(게임 동작의 한도가 아니다) */
export const TOL = {
  dt: 0.0005, // s   표본 간격 (t 는 0.0001 s 로 반올림해 적는다)
  phi: 0.002, //     φ (0.001 로 반올림)
  unit: 0.01, //     방향 벡터 길이 1 에서
  guardHand: 0.02, // m  시작·끝 앞손 자리 — 디렉터 요청 ±2 cm
  guardBlade: 3, // °   시작·끝 칼 방향
  guardTrunk: 2, // °   시작·끝 골반·가슴 돌림, 숙임
  guardDrop: 0.01, // m  시작·끝 낮춤
  poseField: 0.002, // m  startPose·endPose 에 적힌 손 오차 대 다시 잰 값
  armOver: 0.04, // m   팔 넘침 — 게임 쟁기 자세 자체가 롱소드 뒷손에서 0.028 m 넘는다(게임 팔 0.565 m 로 못 닿음). 그보다 조금 크게.
  //                    시작·끝 게임 자세 자체의 넘침이 더 크면(츠바이핸더 쟁기 뒷손 0.047 m — 칼자루가 4 cm 길다) 그 값까지 (R1)
  legOver: 0.02, // m   다리 넘침 — 지금 가장 큰 값은 런지 뒷다리 0.015 m
  bone: 0.005, // m     뼈 길이 (J 는 0.001 m 로 반올림)
  ground: -0.02, // m   칼끝 높이 아래 한계 (땅 = 0, 칼끝 굵기·반올림 몫)
  round: 0.002, // m    손·어깨띠 채널 반올림(0.001 m) 두 번 몫 — R1 에서 시작·끝 자세 넘침과 견줄 때
};

/** 게임 자세 id (build 도구·clip 필드 이름) → src/guards.js 자세 이름 */
export const GUARD_NAMES = {
  tag: '지붕 (Vom Tag)', tagR: '어깨 지붕 (Vom Tag)', ochs: '황소 (Ochs)', langort: '긴 자세 (Langort)', side: '옆 자세',
  pflug: '쟁기 (Pflug)', wechsel: '바꿈 (Wechsel)', neben: '옆 지킴 (Nebenhut)', alber: '바보 (Alber)',
  tagL: '왼쪽 어깨 지붕', ochsL: '왼쪽 황소', sideL: '왼쪽 옆 자세', pflugL: '왼쪽 쟁기', wechselL: '왼쪽 바꿈',
};

const J = Object.fromEntries(JOINTS.map((n, i) => [n, i]));
const fin = (x) => typeof x === 'number' && Number.isFinite(x);
const f3 = (x) => (fin(x) ? x.toFixed(3) : String(x));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const angDeg = (a, b) => (Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (len(a) * len(b))))) * 180) / Math.PI;
const R2D = 180 / Math.PI;

/** 표본 i 의 채널 값 (폭 1 이면 수, 아니면 배열) */
function at(clip, ch, i) {
  const w = clip.data.width[ch];
  const a = clip.data.cols[ch];
  return w === 1 ? a[i] : a.slice(i * w, i * w + w);
}
function joint(clip, i, name) {
  const a = clip.data.cols.J;
  const k = (i * JOINTS.length + J[name]) * 3;
  return [a[k], a[k + 1], a[k + 2]];
}

/** 게임 자세와 대조할 한 표본의 값 — 앞손(가슴 가운데 원점, 땅 틀 = 바라보는 틀)·칼 방향·몸통 */
export function poseAt(clip, i) {
  const hS = joint(clip, i, 'hS');
  const C = joint(clip, i, 'chest');
  return {
    hand: sub(hS, C),
    dir: sub(joint(clip, i, 'tip'), joint(clip, i, 'pommel')),
    pelvisYaw: at(clip, 'pelvis.yaw', i),
    chestYaw: at(clip, 'chest.yaw', i),
    lean: at(clip, 'chest.lean', i),
    drop: at(clip, 'pelvis.drop', i),
  };
}

/** 한 표본을 게임 자세와 대조 → 어긋남 목록 (G1~G4) */
function guardDiff(clip, i, g) {
  const p = poseAt(clip, i);
  return {
    hand: len(sub(p.hand, g.hand)),
    blade: angDeg(p.dir, g.dir),
    chest: Math.abs(p.chestYaw - g.chestYaw * R2D),
    // 게임은 골반을 자세표 값의 절반만 튼다 (src/fighter.js: follow('pelvisYaw', -G.pelvisYaw * 0.5 …))
    pelvis: Math.abs(p.pelvisYaw - g.pelvisYaw * R2D * 0.5),
    lean: Math.abs(p.lean - g.pitch * R2D),
    drop: Math.abs(p.drop - g.drop),
  };
}

/** 가장 가까운 게임 자세 (앞손 거리) — clip 의 startPose·endPose 와 같은 셈 */
export function nearestOf(hand, guards) {
  const list = Object.entries(guards)
    .map(([id, g]) => ({ id, err: len(sub(hand, g.hand)) }))
    .sort((a, b) => a.err - b.err);
  return list[0];
}

/**
 * 클립 한 벌 검사. 돌려주는 값: [{ rule, level, msg }] (빈 배열 = 통과)
 * opts.guards: 이 클립 무기의 게임 자세표 (없으면 G 규칙은 G0 실패)
 * opts.file: 읽은 파일 이름 (F3 에 쓴다)
 */
export function checkClip(clip, opts = {}) {
  const out = [];
  const err = (rule, msg) => out.push({ rule, level: 'error', msg });
  const warn = (rule, msg) => out.push({ rule, level: 'warn', msg });

  // ── F 형식 ──
  if (!clip || typeof clip !== 'object') return err('F1', '클립이 JSON 객체가 아니다'), out;
  if (clip.format !== CLIP_FORMAT) return err('F1', `format 이 '${clip.format}' — '${CLIP_FORMAT}' 이어야 한다`), out;
  const str = (k) => typeof clip[k] === 'string' && clip[k].length > 0;
  for (const k of ['id', 'cut', 'side', 'size', 'weapon', 'handedness', 'nameKo', 'family', 'provenance']) if (!str(k)) err('F2', `${k} 가 없거나 글자가 아니다`);
  if (!['right', 'left'].includes(clip.side)) err('F2', `side '${clip.side}' — right 또는 left`);
  if (!['small', 'medium', 'large'].includes(clip.size)) err('F2', `size '${clip.size}' — small·medium·large`);
  if (clip.handedness !== 'right') err('F2', `handedness '${clip.handedness}' — right 만 있다(왼쪽 베기도 오른손잡이 몸을 거울에 비춘 것)`);
  if (!(Number.isInteger(clip.hz) && clip.hz > 0)) err('F2', `hz '${clip.hz}' — 양의 정수`);
  if (!Array.isArray(clip.sources) || !clip.sources.length) err('F2', 'sources 가 없다');
  else clip.sources.forEach((s, k) => (typeof s?.license === 'string' && s.license) || err('F2', `sources[${k}] (${s?.id}) 에 license 가 없다`));
  if (!clip.summary || typeof clip.summary !== 'object' || !clip.summary.checks) err('F2', 'summary.checks 가 없다');
  if (!Array.isArray(clip.joints) || clip.joints.join() !== JOINTS.join()) err('F2', `joints 가 정한 23 관절 순서와 다르다 (${JOINTS.join(' ')})`);
  if (!Array.isArray(clip.bones) || clip.bones.some((b) => !Array.isArray(b) || !(b[0] in J) || !(b[1] in J))) err('F2', 'bones 에 joints 에 없는 이름이 있다');
  if (str('id') && !clip.id.endsWith(`_${clip.side}_${clip.size}`)) err('F3', `id '${clip.id}' 가 '_${clip.side}_${clip.size}' 로 끝나지 않는다`);
  if (opts.file != null) {
    const base = String(opts.file).split(/[\\/]/).pop();
    if (base !== `${clip.id}.json`) err('F3', `파일 이름 '${base}' ≠ id + '.json'`);
  }
  // F4: clip/2 필드
  const gid = (k) => clip[k] === null || (typeof clip[k] === 'string' && clip[k]);
  if (!('startFrom' in clip) || !gid('startFrom')) err('F4', 'startFrom 이 없다 (자세 id 또는 null)');
  if (!('recoverTo' in clip) || !gid('recoverTo')) err('F4', 'recoverTo 가 없다 (자세 id 또는 null)');
  for (const k of ['startPose', 'endPose']) {
    const p = clip[k];
    if (!p || typeof p.nearest !== 'string' || !fin(p.handError) || !Array.isArray(p.next)) err('F4', `${k} 가 { nearest, handError, next } 꼴이 아니다`);
  }
  const rc = clip.recovery;
  if (!rc || !fin(rc.from) || !fin(rc.to) || !Number.isInteger(rc.samples)) err('F4', 'recovery 가 { from, to, samples } 꼴이 아니다');
  if (!('step' in clip)) err('F4', 'step 이 없다 (걸음이 없으면 null)');
  else if (clip.step !== null) {
    for (const [k, s] of (Array.isArray(clip.step) ? clip.step : [clip.step]).entries()) {
      const bad = [];
      if (!['L', 'R'].includes(s?.foot)) bad.push('foot');
      for (const q of ['from', 'to']) if (!Array.isArray(s?.[q]) || s[q].length !== 2 || !s[q].every(fin)) bad.push(q);
      for (const q of ['liftT', 'landT', 'liftPhi', 'landPhi']) if (!(s?.[q] === null || fin(s?.[q]))) bad.push(q);
      if (bad.length) err('F4', `step${Array.isArray(clip.step) ? `[${k}]` : ''} 의 ${bad.join('·')} 이(가) 어긋났다`);
    }
  }

  // stance (v1, 있으면): { swordFoot L·R, start·end front·rear } — 모양은 여기서, J 와 맞는지는 표본 검사 뒤 T1 에서
  const stanceOk = 'stance' in clip && clip.stance !== null;
  if (stanceOk) {
    const s = clip.stance;
    if (!['L', 'R'].includes(s?.swordFoot) || !['front', 'rear'].includes(s?.start) || !['front', 'rear'].includes(s?.end))
      err('F5', `stance 가 { swordFoot: L·R, start·end: front·rear } 꼴이 아니다`);
  }

  // ── 표시·위상 (표본 검사 전에: 표본 수 계산에 쓴다) ──
  const marks = clip.marks;
  const marksOk = (m, name) => {
    if (!m || MARKS.some((k) => !fin(m[k]))) return err('P1', `${name} 에 ${MARKS.join('·')} 가 다 수로 있지 않다`), false;
    for (let i = 1; i < MARKS.length; i++) {
      if (!(m[MARKS[i]] - m[MARKS[i - 1]] >= 1 / clip.hz - 1e-9)) return err('P1', `${name} 순서: ${MARKS[i - 1]} ${m[MARKS[i - 1]]} → ${MARKS[i]} ${m[MARKS[i]]} (한 표본 1/${clip.hz} s 이상 뒤여야 한다)`), false;
    }
    return true;
  };
  const mOk = marksOk(marks, 'marks');
  if (!clip.phiMarks || MARKS.some((k) => clip.phiMarks[k] !== PHI_MARKS[k])) err('P2', `phiMarks 가 ${JSON.stringify(PHI_MARKS)} 와 다르다`);
  const flow = clip.marks1 || clip.marks2;
  let flowOk = true;
  if (flow) {
    flowOk = marksOk(clip.marks1, 'marks1') & marksOk(clip.marks2, 'marks2');
    if (flowOk && Math.abs(clip.marks1.tf - clip.marks2.tw) > 1e-6) (flowOk = false), err('P1', `흐름 클립: marks1.tf ${clip.marks1.tf} ≠ marks2.tw ${clip.marks2.tw}`);
  }

  // ── C 채널·L 길이·S 표본 수·N 값 ──
  const d = clip.data;
  if (!d || typeof d !== 'object' || !d.width || !d.cols) return err('C1', 'data { n, width, cols } 가 없다'), out;
  const n = d.n;
  if (!Number.isInteger(n) || n < 2) return err('S1', `data.n '${n}' — 2 이상 정수`), out;
  for (const [ch, w] of Object.entries(CHANNELS)) {
    if (!(ch in d.width)) err('C1', `채널 ${ch} 가 없다`);
    else if (d.width[ch] !== w) err('C1', `채널 ${ch} 폭 ${d.width[ch]} ≠ ${w}`);
  }
  const extra = Object.keys(d.width).filter((ch) => !(ch in CHANNELS));
  if (extra.length) warn('C2', `표에 없는 채널 ${extra.join(', ')} (읽는 쪽은 무시해도 된다)`);
  let colsOk = true;
  for (const [ch, w] of Object.entries(d.width)) {
    const a = d.cols[ch];
    if (!Array.isArray(a)) (colsOk = false), err('L1', `cols.${ch} 가 배열이 아니다`);
    else if (!(Number.isInteger(w) && w > 0) || a.length !== n * w) (colsOk = false), err('L1', `cols.${ch} 길이 ${a.length} ≠ n ${n} × 폭 ${w}`);
    else {
      const bad = a.findIndex((x) => !fin(x));
      if (bad >= 0) (colsOk = false), err('N1', `cols.${ch} 표본 ${Math.floor(bad / w)} 값이 수가 아니다 (${a[bad]}) — NaN·무한이 JSON 에 null 로 적힌 것`);
    }
  }
  if (Object.keys(CHANNELS).some((ch) => d.width[ch] !== CHANNELS[ch])) colsOk = false;
  if (mOk) {
    const want = Math.round((marks.tg - marks.t0) * clip.hz) + 1;
    if (n !== want) err('S1', `표본 수 ${n} ≠ round((tg ${marks.tg} − t0 ${marks.t0}) × ${clip.hz}) + 1 = ${want}`);
  }
  if (!colsOk) return out; // 아래 검사는 채널이 온전해야 한다

  const t = d.cols.t;
  if (mOk && Math.abs(t[0] - marks.t0) > TOL.dt) err('S2', `첫 표본 t ${t[0]} ≠ marks.t0 ${marks.t0}`);
  for (let i = 1; i < n; i++) {
    if (Math.abs(t[i] - t[i - 1] - 1 / clip.hz) > TOL.dt) {
      err('S2', `표본 ${i}: 간격 ${(t[i] - t[i - 1]).toFixed(4)} s ≠ 1/${clip.hz}`);
      break;
    }
  }

  // P3: φ 는 표시 사이에서 시간에 선형. 흐름 클립은 marks2.tw 에서 한 번 되돌아간다
  if (mOk && flowOk) {
    const want = flow ? (x) => (x < clip.marks2.tw ? phaseAt({ ...clip.marks1, tf: clip.marks2.tw, tg: clip.marks2.tc }, x) : phaseAt(clip.marks2, x)) : (x) => phaseAt(marks, x);
    const phi = d.cols.phi;
    let worst = { i: -1, e: 0 };
    let drops = 0;
    for (let i = 0; i < n; i++) {
      const e = Math.abs(phi[i] - want(t[i]));
      if (e > worst.e) worst = { i, e };
      if (i && phi[i] < phi[i - 1] - 1e-9) drops++;
    }
    if (worst.e > TOL.phi) err('P3', `φ 가 표시에서 셈한 값과 ${worst.e.toFixed(3)} 어긋남 (표본 ${worst.i}, t ${t[worst.i]}) — 허용 ${TOL.phi}`);
    if (drops > (flow ? 1 : 0)) err('P3', `φ 가 ${drops}번 줄어든다 (${flow ? '흐름 클립은 marks2.tw 에서 한 번만' : '줄면 안 된다'})`);
    if (phi[0] !== -1 || phi[n - 1] !== 2.2) err('P3', `φ 첫 값 ${phi[0]}·끝 값 ${phi[n - 1]} — −1 과 2.2 여야 한다`);
  }

  // U: 방향 벡터 길이, 범위
  for (const ch of UNIT) {
    const a = d.cols[ch];
    for (let i = 0; i < n; i++) {
      const l = Math.hypot(a[3 * i], a[3 * i + 1], a[3 * i + 2]);
      if (Math.abs(l - 1) > TOL.unit) {
        err('U1', `${ch} 표본 ${i} 길이 ${l.toFixed(3)} — 단위 벡터여야 한다`);
        break;
      }
    }
  }
  const range = (ch, lo, hi) => {
    const i = d.cols[ch].findIndex((x) => x < lo - 1e-9 || x > hi + 1e-9);
    if (i >= 0) err('U2', `${ch} 표본 ${i} 값 ${d.cols[ch][i]} — ${lo} ~ ${hi} 밖`);
  };
  // U3: 칼끝이 땅(y = 0) 밑으로 들어가지 않는다
  {
    const Jc = d.cols.J;
    let lo = { y: Infinity, i: 0 };
    for (let i = 0; i < n; i++) {
      const y = Jc[(i * JOINTS.length + J.tip) * 3 + 1];
      if (y < lo.y) lo = { y, i };
    }
    if (lo.y < TOL.ground) err('U3', `칼끝이 땅 밑 ${lo.y.toFixed(3)} m (표본 ${lo.i}, t ${t[lo.i]}) — 허용 ${TOL.ground} m`);
  }
  range('openness', 0, 1);
  range('guardGap', 0, Infinity);
  range('feet.L.lift', 0, 1);
  range('feet.R.lift', 0, 1);

  // ── R 뼈 길이·팔다리 넘침 ──
  // R1 팔: 어깨(가슴 틀) = [어깨띠 내밂, 0.1 + 어깨띠 들림, ±0.2] → 손까지 거리 − (위팔 0.30 + 아래팔 0.265).
  //  허용 = max(0.04 m, 첫·끝 표본의 넘침): 시작·끝은 게임 자세(G1)라, 그 자세 자체의 넘침(게임 자세표 × 그 무기 칼자루 길이)까지는 봐준다
  const reach = BODY.upper + BODY.fore;
  const overAt = (i) => {
    let best = { over: -1, i, which: '' };
    for (const [hand, gird, sz, which] of [['handS', 'girdleS', 1, '칼 팔'], ['handO', 'girdleO', -1, '빈 팔']]) {
      const h = at(clip, hand, i), g = at(clip, gird, i);
      const sh = [BODY.shoulder[0] + g[1], BODY.shoulder[1] + g[0], sz * BODY.shoulder[2]];
      const o = len(sub(h, sh)) - reach;
      if (o > best.over) best = { over: o, i, which };
    }
    return best;
  };
  let arm = { over: -1, i: 0, which: '' };
  for (let i = 0; i < n; i++) {
    const o = overAt(i);
    if (o.over > arm.over) arm = o;
  }
  const armTol = Math.max(TOL.armOver, overAt(0).over + TOL.round, overAt(n - 1).over + TOL.round);
  if (arm.over > armTol) err('R1', `${arm.which} 넘침 ${arm.over.toFixed(3)} m (표본 ${arm.i}, t ${t[arm.i]}) — 손이 어깨에서 팔 길이 ${reach} m 보다 멀다, 허용 ${armTol.toFixed(3)} m (0.04 또는 시작·끝 게임 자세 자체의 넘침)`);
  // R2 다리: 발목 목표 = 뒤꿈치 + 0.06 m × 발 방향(뒤꿈치 → 앞꿈치, 수평) + 0.06 m 위 (body.mjs 발 모양) → 엉덩이에서 거리 − (0.43 + 0.42)
  let leg = { over: -1, i: 0, foot: '' };
  for (let i = 0; i < n; i++) {
    for (const f of ['L', 'R']) {
      const heel = joint(clip, i, `heel${f}`), toe = joint(clip, i, `toe${f}`), hip = joint(clip, i, `hip${f}`);
      const fx = toe[0] - heel[0], fz = toe[2] - heel[2];
      const fl = Math.hypot(fx, fz) || 1;
      const ank = [heel[0] + (BODY.heel * fx) / fl, heel[1] + 0.06, heel[2] + (BODY.heel * fz) / fl];
      const o = len(sub(ank, hip)) - (BODY.thigh + BODY.shin);
      if (o > leg.over) leg = { over: o, i, foot: f };
    }
  }
  if (leg.over > TOL.legOver) err('R2', `다리(${leg.foot}) 넘침 ${leg.over.toFixed(3)} m (표본 ${leg.i}, t ${t[leg.i]}) — 발이 엉덩이에서 다리 길이 ${BODY.thigh + BODY.shin} m 보다 멀다, 허용 ${TOL.legOver} m`);
  // R3 뼈 길이: 게임 뼈대와 같은 치수, 칼과 두 손 사이는 표본마다 같다(굳은 칼)
  const boneRule = [
    ['hipC', 'waist', BODY.waistUp], ['waist', 'chest', BODY.chestUp], ['shS', 'elS', BODY.upper], ['shO', 'elO', BODY.upper],
    ['hipL', 'kneeL', BODY.thigh], ['kneeL', 'ankleL', BODY.shin], ['hipR', 'kneeR', BODY.thigh], ['kneeR', 'ankleR', BODY.shin],
  ];
  // 한손 무기(grip.hands 1)는 빈손이 칼자루를 잡지 않으니 두 손 사이는 보지 않는다
  const rigid = [...(clip.grip?.hands === 1 ? [] : [['hS', 'hO', '두 손 사이']]), ['pommel', 'tip', '자루 끝 ↔ 칼끝']];
  const L0 = Object.fromEntries(rigid.map(([a, b]) => [a + b, len(sub(joint(clip, 0, a), joint(clip, 0, b)))]));
  for (let i = 0; i < n; i++) {
    for (const [a, b, want] of boneRule) {
      const l = len(sub(joint(clip, i, a), joint(clip, i, b)));
      if (Math.abs(l - want) > TOL.bone) {
        err('R3', `뼈 ${a}–${b} 길이 ${l.toFixed(3)} m ≠ 게임 ${want} m (표본 ${i})`);
        i = n;
        break;
      }
    }
  }
  for (const [a, b, what] of rigid) {
    for (let i = 1; i < n; i++) {
      const l = len(sub(joint(clip, i, a), joint(clip, i, b)));
      if (Math.abs(l - L0[a + b]) > TOL.bone) {
        err('R3', `${what} 거리가 표본 ${i} 에서 ${l.toFixed(3)} m — 첫 표본 ${L0[a + b].toFixed(3)} m 와 다르다 (칼은 굳은 몸)`);
        break;
      }
    }
  }
  if (clip.grip) {
    const g = clip.grip;
    if (g.hands !== 1 && Math.abs(L0.hShO - Math.abs(g.offHand)) > TOL.bone) err('R3', `두 손 사이 ${L0.hShO.toFixed(3)} m ≠ grip.offHand ${g.offHand}`);
    if (Math.abs(L0.pommeltip - (g.tip - g.pommel)) > TOL.bone) err('R3', `자루 끝 ↔ 칼끝 ${L0.pommeltip.toFixed(3)} m ≠ grip.tip − grip.pommel ${(g.tip - g.pommel).toFixed(3)}`);
  }

  // ── G 시작·끝 자세 ──
  const guards = opts.guards;
  if (!guards) err('G0', `무기 '${clip.weapon}' 의 게임 자세표를 검사기가 모른다 — 시작·끝 자세를 검사할 수 없다`);
  else {
    for (const [key, i, name] of [['startFrom', 0, '시작'], ['recoverTo', n - 1, '끝']]) {
      const id = clip[key];
      if (id == null) {
        warn('G0', `${key} 가 null — ${name} 목표 자세가 없어 대조하지 않았다`);
        continue;
      }
      const g = guards[id];
      if (!g) {
        err('G0', `${key} '${id}' 가 게임 자세표에 없다`);
        continue;
      }
      const df = guardDiff(clip, i, g);
      if (df.hand > TOL.guardHand) err('G1', `${name} 자세 앞손이 목표 ${id} 에서 ${df.hand.toFixed(3)} m (허용 ${TOL.guardHand} m)`);
      if (df.blade > TOL.guardBlade) err('G2', `${name} 자세 칼 방향이 목표 ${id} 와 ${df.blade.toFixed(1)}° (허용 ${TOL.guardBlade}°)`);
      const trunk = [['chest', '가슴 돌림', TOL.guardTrunk, '°'], ['pelvis', '골반 돌림(자세표의 절반)', TOL.guardTrunk, '°'], ['lean', '숙임', TOL.guardTrunk, '°'], ['drop', '낮춤', TOL.guardDrop, ' m']];
      for (const [k, what, tol, u] of trunk) if (df[k] > tol) err('G3', `${name} 자세 ${what}가 목표 ${id} 와 ${k === 'drop' ? df[k].toFixed(3) : df[k].toFixed(1)}${u} 어긋남 (허용 ${tol}${u})`);
    }
    // G4: 적어 둔 startPose·endPose·recovery 가 데이터와 맞나
    for (const [key, i] of [['startPose', 0], ['endPose', n - 1]]) {
      const p = clip[key];
      if (!p) continue;
      const near = nearestOf(poseAt(clip, i).hand, guards);
      if (p.nearest !== near.id || Math.abs(p.handError - near.err) > TOL.poseField) err('G4', `${key} 에 ${p.nearest} ${p.handError} m 라 적혔는데 데이터로 다시 재면 ${near.id} ${near.err.toFixed(3)} m`);
    }
    if (rc && mOk) {
      const cnt = t.filter((x) => x >= marks.tf - 1e-6 && x <= marks.tg + 1e-6).length;
      if (Math.abs(rc.from - marks.tf) > 1e-3 || Math.abs(rc.to - marks.tg) > 1e-3 || rc.samples !== cnt) err('G4', `recovery ${JSON.stringify(rc)} ≠ { from: tf ${marks.tf}, to: tg ${marks.tg}, samples: ${cnt} }`);
    }
  }
  // ── T1 선 자세 표시 ↔ J (칼 쪽 발 발목이 앞인가) ──
  if (stanceOk && ['L', 'R'].includes(clip.stance.swordFoot)) {
    const sf = clip.stance.swordFoot, of = sf === 'R' ? 'L' : 'R';
    const n = clip.data.n;
    const side = (i) => (joint(clip, i, `ankle${sf}`)[0] >= joint(clip, i, `ankle${of}`)[0] ? 'front' : 'rear');
    if (side(0) !== clip.stance.start) err('T1', `stance.start '${clip.stance.start}' — 첫 표본 J 는 칼 쪽 발(${sf})이 ${side(0)}`);
    if (side(n - 1) !== clip.stance.end) err('T1', `stance.end '${clip.stance.end}' — 끝 표본 J 는 칼 쪽 발(${sf})이 ${side(n - 1)}`);
  }
  return out;
}

/** 두 JSON 값이 같은가 (수는 1e-9 안) */
function same(a, b) {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => same(a[k], b[k]));
}

/**
 * 목록(index.json) 검사. clips = { file: 클립 객체 | Error } (부르는 쪽이 읽어 넘긴다)
 * 돌려주는 값: { list: [{ rule, level, msg }], perClip: { file: [{ rule, level, msg }] } }
 */
export function checkIndex(index, clips, guardsFor) {
  const list = [];
  const perClip = {};
  const err = (rule, msg) => list.push({ rule, level: 'error', msg });
  if (!index || index.format !== INDEX_FORMAT) return err('I1', `format 이 '${index?.format}' — '${INDEX_FORMAT}' 이어야 한다`), { list, perClip };
  if (!Array.isArray(index.clips) || !index.clips.length) return err('I1', 'clips 가 비었다'), { list, perClip };
  const ids = new Set();
  for (const [k, e] of index.clips.entries()) {
    const where = `clips[${k}] ${e?.id ?? ''}`;
    const bad = ['id', 'cut', 'side', 'size', 'file'].filter((q) => typeof e?.[q] !== 'string' || !e[q]);
    if (bad.length) {
      err('I2', `${where}: ${bad.join('·')} 가 없다`);
      continue;
    }
    if (ids.has(e.id)) err('I2', `${where}: id 가 겹친다`);
    ids.add(e.id);
    if (e.file !== `${e.id}.json`) err('I2', `${where}: file '${e.file}' ≠ id + '.json'`);
    const c = clips[e.file];
    if (!c || c instanceof Error) {
      err('I2', `${where}: 파일 ${e.file} 를 못 읽었다${c instanceof Error ? ` (${c.message})` : ''}`);
      continue;
    }
    perClip[e.file] = checkClip(c, { guards: guardsFor(c.weapon), file: e.file });
    // I3: 목록 항목 = 클립의 같은 칸
    const diff = ['cut', 'side', 'size', 'family', 'nameKo', 'summary', 'step', 'startFrom', 'startPose', 'recoverTo', 'endPose', 'recovery', 'weapon', 'base', 'flow', 'lunge'].filter((q) => q in e && !same(e[q], c[q]));
    if (diff.length) err('I3', `${where}: 목록 칸 ${diff.join('·')} 가 클립 파일과 다르다 (목록을 다시 만들 것)`);
  }
  // I4: 크기 벌 — 한 베기(cut)는 small·medium·large 셋 다 또는 large 하나. 있는 크기마다 right·left 둘 다
  const byCut = {};
  for (const e of index.clips) if (e?.cut) ((byCut[`${e.weapon ?? ''}|${e.cut}`] ??= { right: new Set(), left: new Set() })[e.side] ??= new Set()).add(e.size);
  for (const [key, s] of Object.entries(byCut)) {
    const cut = key.split('|')[1];
    const r = [...(s.right ?? [])].sort().join(','), l = [...(s.left ?? [])].sort().join(',');
    if (r !== l) err('I4', `${cut}: 오른쪽 크기 [${r}] ≠ 왼쪽 크기 [${l}]`);
    if (![['large', 'medium', 'small'].join(','), 'large'].includes(r)) err('I4', `${cut}: 크기 [${r}] — small·medium·large 셋 또는 large 하나여야 한다`);
  }
  // I5: 좌우 짝은 표시·표본 수가 같다 (왼쪽 = 오른쪽 거울)
  for (const e of index.clips) {
    if (e?.side !== 'right') continue;
    const m = index.clips.find((x) => x?.side === 'left' && x.cut === e.cut && x.size === e.size && (x.weapon ?? '') === (e.weapon ?? ''));
    const a = clips[e.file], b = m && clips[m.file];
    if (!a || !b || a instanceof Error || b instanceof Error) continue;
    if (!same(a.marks, b.marks) || a.data?.n !== b.data?.n) err('I5', `${e.id} ↔ ${m.id}: 좌우 짝의 marks·표본 수가 다르다`);
  }
  return { list, perClip };
}
