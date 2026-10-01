// ─────────────────────────────────────────────────────────────
//  기준 동작 클립 만들기 (동작 연구 PM)
//   node tools/motion/build_clips.mjs            → docs/motion/clips/*.json, docs/motion/clips/index.json, docs/motion/spec_table.md
//   node tools/motion/build_clips.mjs --print    → 요약만 찍는다 (파일 안 씀)
//   node tools/motion/build_clips.mjs zornhau    → 이 베기만
//
//  키프레임(lib/cuts.mjs) → 크기 세 벌(small·medium·large) × 좌우 → 120 Hz 표본 + 측정값.
// ─────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUTS, GAME_GUARDS } from './lib/cuts.mjs';
import { SOURCES } from './lib/sources.mjs';
import { sampleClip, measure, summarize, toJSONFrames, toColumns, fromGameGuard, HZ } from './lib/clip.mjs';
import { JOINTS, BONES } from './lib/body.mjs';
import { v3, m3, frame } from './lib/body.mjs';
import { toKeys, marksOf, mirror, clipExtras, chainWithProfiles } from './lib/sets.mjs';
import { validateFile, report } from './validate_clip.mjs';
import { gripField } from './lib/weapons.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'docs', 'motion', 'clips');
const args = process.argv.slice(2);
const PRINT = args.includes('--print');
const only = args.filter((a) => !a.startsWith('--'));

/** 크기 섞기: small 과 large 키를 u 만큼 (키 개수·표시가 같아야 한다) */
function blend(small, large, u) {
  if (small.keys.length !== large.keys.length) throw new Error('small·large 키 개수가 다르다');
  const L = (a, b) => a.map((v, i) => v + (b[i] - v) * u);
  const keys = small.keys.map((a, i) => {
    const b = large.keys[i];
    return { t: a.t + (b.t - a.t) * u, tag: a.tag ?? b.tag, p: L(a.p, b.p), c: L(a.c, b.c), h: L(a.h, b.h), d: v3.norm(L(a.d, b.d)) };
  });
  // 걸음: large 걸음을 시간은 새 표시에 맞춰 옮기고, 발 옮김은 u 만큼만
  const mL = marksOf(large);
  const mB = marksOf({ keys });
  const tmap = (t) => {
    const pts = ['t0', 'tw', 'tr', 'tc', 'tf', 'tg'];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = mL[pts[i]], b = mL[pts[i + 1]];
      if (t <= b + 1e-9) return mB[pts[i]] + ((mB[pts[i + 1]] - mB[pts[i]]) * (t - a)) / (b - a);
    }
    return mB.tg;
  };
  const base = large.steps[0];
  const steps = large.steps.map((s) => {
    const f = {};
    for (const side of ['L', 'R']) f[side] = L(base.feet[side], s.feet[side]);
    return { t: tmap(s.t), feet: f, px: (s.px ?? 0) * u, pz: (s.pz ?? 0) * u };
  });
  const chain = {};
  for (const k of Object.keys(large.chain)) {
    if (k === 'seq') {
      chain.seq = {};
      for (const j of Object.keys(large.chain.seq)) chain.seq[j] = small.chain.seq[j] + (large.chain.seq[j] - small.chain.seq[j]) * u;
    } else chain[k] = small.chain[k] + (large.chain[k] - small.chain[k]) * u;
  }
  return { keys, steps, chain };
}

/** 보통 벌 걸음: 크게 벌 걸음 시각을 보통 벌 표시로 옮긴다 */
function retimeSteps(med, large) {
  const mL = marksOf(large);
  const mM = marksOf(med);
  const pts = ['t0', 'tw', 'tr', 'tc', 'tf', 'tg'];
  const tmap = (t) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = mL[pts[i]], b = mL[pts[i + 1]];
      if (t <= b + 1e-9) return mM[pts[i]] + ((mM[pts[i + 1]] - mM[pts[i]]) * (t - a)) / (b - a);
    }
    return mM.tg;
  };
  return { ...med, steps: med.steps.map((s) => ({ ...s, t: tmap(s.t) })) };
}

function build(cut, sizeName, sideName) {
  let set = sizeName === 'small' ? cut.small : sizeName === 'large' ? cut.large : cut.medium ? retimeSteps(cut.medium, cut.large) : blend(cut.small, cut.large, 0.5);
  if (sideName === 'left') set = mirror(set);
  const marks = marksOf(set);
  // 운동 사슬 곡선 (lib/sets.mjs chainWithProfiles)
  const chain = chainWithProfiles(set, marks);
  const def = { keys: toKeys(set), marks, chain };
  const { frames } = sampleClip(def, 1);
  const rows = measure(frames, marks);
  const summary = summarize(rows, marks);
  const over = rows.filter((r) => r.J.overS > 0.01 || r.J.overO > 0.01).map((r) => `${r.t.toFixed(2)}:${Math.max(r.J.overS, r.J.overO).toFixed(2)}`);
  const extra = clipExtras(set, rows, marks);
  return { marks, rows, summary, def, over, extra };
}

const SIZES = ['small', 'medium', 'large'];
const SIDES = ['right', 'left'];
const index = [];
if (!PRINT) mkdirSync(OUT, { recursive: true });
for (const cut of CUTS) {
  if (only.length && !only.includes(cut.id)) continue;
  for (const side of SIDES) {
    for (const size of SIZES) {
      const { marks, rows, summary, over, extra } = build(cut, size, side);
      const name = `${cut.id}_${side}_${size}`;
      const s = summary;
      const seq = s.sequence.map((q) => `${q.part} ${q.t > 0 ? '+' : ''}${q.t}`).join(' → ');
      console.log(
        `${name.padEnd(26)} 칼끝 ${String(s.tipPeak).padStart(5)} m/s (선 ${s.tipAtLine}) 손 ${s.handPeak} | 가슴 ${s.range.chestYaw}° 골반 ${s.range.pelvisYaw}° X ${s.range.xFactorMax}° | 손 위 ${s.wind.handAboveHeadTop} 뒤 ${s.wind.handBehindTorsoFront} 어깨 ${s.wind.shoulderElev}° | 지나감 ${s.followThrough.handSideChest} | 손길 ${s.range.handPath} m | 몸통 ${s.shareAtTipPeak.trunk} 손목 ${s.shareAtTipPeak.wrist} | ${s.ordered ? '순서 OK' : '순서 뒤섞임'} | 넘침 팔 ${s.checks.reachOver} 다리 ${s.checks.legOver} | 손목 ${s.checks.wristMax}° 칼끝 최저 ${s.checks.tipMin} m`,
      );
      if (args.includes('--seq')) console.log('   ', seq);
      if (args.includes('--over') && over.length) console.log('    팔 넘침', over.filter((_, i) => i % 3 === 0).join(' '));
      // --trace: 겨눈 선 → 복귀 끝, 0.05 s 마다 손 옆 거리(가슴 가운데 기준)·앞 거리·손 높이(엉덩이 위)·가슴 돌림·칼끝 높이
      if (args.includes('--trace'))
        for (const r of rows.filter((r, i) => r.t >= marks.tc - 1e-9 && i % 6 === 0))
          console.log(`    t ${r.t.toFixed(2)} 옆 ${(r.J.hS[2] - r.J.C[2]).toFixed(2)} 앞 ${(r.J.hS[0] - r.J.C[0]).toFixed(2)} 손높이 ${(r.J.hS[1] - r.J.hipC[1]).toFixed(2)} 가슴 ${r.yawC.toFixed(0)}° 칼끝 ${r.J.tip[1].toFixed(2)} m`);
      if (PRINT) continue;
      const clip = {
        format: 'stillness-motion-clip/2', // data.cols[채널] = 120 Hz 표본 (벡터는 3칸씩 평면), J = joints 순서 관절 위치. clip/1 + 채널·필드 더함 (clip_format.md §7)
        id: name,
        cut: cut.id,
        nameKo: cut.nameKo,
        nameDe: cut.nameDe,
        family: cut.family,
        desc: cut.desc,
        side,
        size,
        hz: HZ,
        weapon: 'longsword',
        handedness: 'right',
        grip: gripField('longsword'), // 칼 치수 (앞손에서 칼 축 m) — src/weapons.js 에서 읽음
        units: 'm, 도(°), 초, rad/s(w), m/s(speed)',
        frame:
          '월드 = 클립 시작 때 골반 밑 땅, x 앞(상대 쪽) · y 위 · z 칼 든 쪽(오른쪽). 가슴 틀 값(handS·handO·sword·edge·elbow·shoulderS) = 가슴 가운데 원점, 가슴 상자와 함께 돈다. handS_face = 골반이 향하는 쪽 틀(게임의 지금 손 목표 틀과 같은 종류). yaw + = 칼 든 쪽 어깨·골반이 뒤로 (게임 guards.js 부호).',
        marks: Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, +v.toFixed(4)])),
        phiMarks: { t0: -1, tw: 0, tr: 0.55, tc: 0.85, tf: 1.6, tg: 2.2 },
        sources: cut.sources.map((id) => ({ id, ...SOURCES[id] })),
        provenance:
          size === 'small'
            ? '지금 게임의 팔 베기 자세표(src/guards.js) 값을 그대로 옮김 + 저작 사이 키'
            : size === 'large'
              ? '교본 서술(시작·끝 자세·걸음)과 스포츠 생체역학의 운동 사슬 시간차로 저작한 v0 [추정 포함] — 모캡 실측 아님'
              : '크게 벌을 겨눈 선 자세 쪽으로 줄임(몸·손 75%, 칼 각 85%), 시각은 작게와 크게의 가운데 [추정]',
        summary,
        ...extra,
        joints: JOINTS,
        bones: BONES,
        data: toColumns(toJSONFrames(rows)),
      };
      writeFileSync(join(OUT, `${name}.json`), JSON.stringify(clip));
      index.push({ id: name, cut: cut.id, nameKo: cut.nameKo, nameDe: cut.nameDe, family: cut.family, desc: cut.desc, side, size, file: `${name}.json`, summary, ...extra });
    }
  }
}
if (!PRINT && !only.length) {
  // 다른 도구(build_flow.mjs 흐름, build_lunge.mjs 런지)가 끼워 둔 항목은 지킨다
  let kept = [];
  try {
    kept = JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8')).clips.filter((c) => !CUTS.some((k) => k.id === c.cut));
  } catch {}
  writeFileSync(join(OUT, 'index.json'), JSON.stringify({ format: 'stillness-motion-index/1', generated: new Date().toISOString().slice(0, 10), clips: [...index, ...kept] }, null, 1));
  writeFileSync(join(ROOT, 'docs', 'motion', 'spec_table.md'), specTable(index));
  console.log(`\n${index.length}개 클립 → ${OUT}, 사양표 → docs/motion/spec_table.md`);
}
// 검사 (validate_clip.mjs, clip_format.md §6): 다 만들었으면 목록째, 몇 베기만 만들었으면 그 파일만. 어긋나면 종료 코드 1
if (!PRINT && !report((only.length ? index.map((e) => join(OUT, e.file)) : [join(OUT, 'index.json')]).map(validateFile), { quiet: true })) process.exit(1);

/** 사양표 (오른쪽에서 베기만 — 왼쪽은 거울이라 같은 값) */
function specTable(list) {
  const R = list.filter((c) => c.side === 'right');
  const L = [];
  L.push('# 롱소드 베기 기준 동작 — 측정 사양표 (자동 생성)');
  L.push('');
  L.push('> `node tools/motion/build_clips.mjs` 가 만든다. 손으로 고치지 말 것. 오른쪽에서 베기만 적는다(왼쪽은 거울이라 같은 값).');
  L.push('> 값은 v0 기준 동작(교본 서술 + 생체역학 운동 사슬로 저작, 게임 뼈대 치수)에서 잰 것이다. 모캡 실측이 아니다 — 출처와 믿을 정도는 `docs/motion/sources.md`.');
  L.push('> small = 지금 게임의 팔 베기(자세표를 그대로 이음), large = 온몸 베기, medium = 크게 벌을 겨눈 선 자세 쪽으로 줄인 것(몸·손 75%, 칼 각 85%, 시각은 작게와 크게의 가운데).');
  L.push('');
  L.push('## 1. 빠르기·시간');
  L.push('');
  L.push('| 베기 | 크기 | 칼끝 최고 m/s | 칼끝 (겨눈 선) m/s | 손 최고 m/s | small 대비 칼끝 | 감기 s | 풀기→선 s | 지나가기 s | 복귀 s | 합 s |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of R) {
    const s = c.summary;
    const sm = R.find((x) => x.cut === c.cut && x.size === 'small').summary;
    L.push(`| ${c.nameKo} ${c.nameDe} | ${c.size} | ${s.tipPeak} | ${s.tipAtLine} | ${s.handPeak} | ${(s.tipPeak / sm.tipPeak).toFixed(2)}× | ${s.time.wind} | ${s.time.releaseToLine} | ${s.time.follow} | ${s.time.recover} | ${s.time.total} |`);
  }
  L.push('');
  L.push('## 2. 운동 사슬 — 최고 속도 시각 (ms, 칼이 겨눈 선을 지나는 때 = 0) · 최고값');
  L.push('');
  L.push('골반·가슴 = 수직축 둘레 각속도(rad/s), 어깨 = 가슴 틀에서 위팔 방향이 도는 빠르기(rad/s), 손목 = 칼과 아래팔 사이 각이 바뀌는 빠르기(rad/s), 손·칼끝 = m/s.');
  L.push('최고 시각은 최고값의 95% 이상 구간의 가운데다. 어깨·손목은 방향 변화율이라 흔들림이 커서 참고로만 본다.');
  L.push('');
  L.push('| 베기 | 크기 | 골반 | 가슴 | 어깨 | 손 | 손목 | 칼끝 | 순서 | 칼끝 최고 때 가슴 각속도 (자기 최고 대비) | 칼끝 빠르기 중 몸통 몫 |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of R) {
    const s = c.summary;
    const q = Object.fromEntries(s.sequence.map((x) => [x.part, x]));
    const f = (k) => `${q[k].t} · ${q[k].value}`;
    L.push(`| ${c.nameKo} | ${c.size} | ${f('골반')} | ${f('가슴')} | ${f('어깨(위팔)')} | ${f('손')} | ${f('손목(칼)')} | ${f('칼끝')} | ${s.ordered ? '골반→가슴→손→칼끝' : '뒤섞임'} | ${Math.round(s.trunkCarry * 100)}% | ${Math.round(s.shareAtTipPeak.trunk * 100)}% |`);
  }
  L.push('');
  L.push('## 3. 크기 — 몸 둘레 어디까지 가나');
  L.push('');
  L.push('| 베기 | 크기 | 가슴 회전 범위° | 골반 회전 범위° | 척추 비틀림 최대° | 감기 손 높이 (머리 꼭대기 위) m | 감기 손 (가슴 앞면보다 뒤) m | 감기 어깨 들림° | 지나가기 손 옆 거리 (가슴 가운데 기준, 반대쪽 −) m | 지나가기 끝 손 높이 (엉덩이 위) m | 손 길 m | 칼끝 길 m |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of R) {
    const s = c.summary;
    L.push(`| ${c.nameKo} | ${c.size} | ${s.range.chestYaw} | ${s.range.pelvisYaw} | ${s.range.xFactorMax} | ${s.wind.handAboveHeadTop} | ${s.wind.handBehindTorsoFront} | ${s.wind.shoulderElev} | ${s.followThrough.handSideChest} | ${s.followThrough.handHeightOverHip} | ${s.range.handPath} | ${s.range.tipPath} |`);
  }
  L.push('');
  L.push('## 4. 반동·허점 (어림값)');
  L.push('');
  L.push('| 베기 | 크기 | 앞이 빈 시간 s | 칼끝이 몸 뒤에 있는 시간 s | 가장 많이 돌아선 각° | 무게중심 옮김 m | 팔 넘침 m | 칼끝 가장 낮은 높이 m | 아래팔-칼 각 최대° | 135° 넘은 시간 s | 160° 넘은 시간 s |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of R) {
    const s = c.summary;
    L.push(`| ${c.nameKo} | ${c.size} | ${s.opening.openTime} | ${s.opening.bladeBehindTime} | ${s.opening.maxTurn} | ${s.range.comShift} | ${s.checks.reachOver} | ${s.checks.tipMin} | ${s.checks.wristMax} | ${s.checks.wristClampTime} | ${s.checks.wristOver160} |`);
  }
  L.push('');
  L.push('## 6. 몸 신호 시간표 — 칼이 겨눈 선을 지나는 때(0) 기준 ms (− = 앞)');
  L.push('');
  L.push('상대·AI·플레이어가 몸에서 읽을 수 있는 것이 언제 나타나나. 빈칸 = 그 베기에는 없음. "앞이 열림/닫힘" = 칼이 가슴 앞 띠를 0.3 m 넘게 비우기 시작한 때/마지막으로 비운 때(§4 와 같은 정의).');
  L.push('');
  L.push('| 베기 | 크기 | 손이 어깨 위로 | 손이 머리 위로 | 칼끝이 몸 뒤로 | 골반이 돌기 시작 | 발 뗌 | 발 디딤 | 앞이 열림 (겨눈 선 뒤 첫) | 앞이 마지막으로 열린 때 |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  const sv = (x) => (x == null ? '' : x);
  for (const c of R) {
    const g = c.summary.signals;
    L.push(`| ${c.nameKo} | ${c.size} | ${sv(g.handsAboveShoulder)} | ${sv(g.handsAboveHead)} | ${sv(g.bladeBehind)} | ${sv(g.pelvisTurns)} | ${sv(g.footLifts)} | ${sv(g.footLands)} | ${sv(g.frontOpenAfterLine)} | ${sv(g.frontCloses)} |`);
  }
  L.push('');
  L.push('## 7. 복귀 구간 · 시작·끝 자세 (게임 자세표 14개와 대조, 좌우 모두)');
  L.push('');
  L.push('> 복귀 구간 = 지나가기 끝(tf) → 복귀 끝(tg) 표본. 가장 가까운 자세 = 앞손 자리(가슴 가운데 원점, 바라보는 틀 — `src/guards.js` 손과 같은 틀) 오차가 가장 작은 게임 자세. 목표 = 그 클립 키에 적은 자세.');
  L.push('');
  L.push('| 클립 | 복귀 구간 s (표본) | 시작: 목표 → 가장 가까움 (손 오차 m) | 끝: 목표 → 가장 가까움 (손 오차 m) | 끝 다음 가까움 |');
  L.push('|---|---|---|---|---|');
  for (const c of list) {
    const e = c.endPose, st = c.startPose;
    L.push(`| ${c.id} | ${c.recovery.from} → ${c.recovery.to} (${c.recovery.samples}) | ${c.startFrom ?? '—'} → ${st.nearest} (${st.handError}) | ${c.recoverTo ?? '—'} → ${e.nearest} (${e.handError}) | ${e.next.map((x) => `${x.id} ${x.err}`).join(', ')} |`);
  }
  L.push('');
  L.push('## 5. 표시 자세 — 관절각과 몸 둘레 자리 (large, 오른쪽)');
  L.push('');
  L.push('각: 골반·가슴 = 월드 돌림(+ = 칼 쪽으로 감음), 척추 = 가슴−골반, 숙임 + = 앞. 어깨 들림 = 가슴 아래 방향과 위팔 사이(180 = 머리 위로 곧게). 팔꿈치·무릎 = 굽힘(0 = 곧음). 손목 = 아래팔과 칼 사이.');
  L.push('자리: 손(가슴 틀) = [앞, 위, 칼 쪽] m · 칼끝(땅 틀) = [앞, 높이, 칼 쪽] m · 칼 방향 = [올려본 각, 옆 각](옆 + = 칼 쪽, ±180 = 뒤) · 발 = 발목 [앞, 옆] m.');
  L.push('');
  L.push('| 베기 | 때 | 시각 s | 골반° | 가슴° | 척추° | 숙임° | 어깨 들림° | 칼 팔꿈치° | 손목° | 무릎 L/R° | 손 (가슴 틀) | 칼끝 (땅 틀) | 칼 방향 | 왼발 / 오른발 |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const TAG = { t0: '준비', tw: '감기 끝', tr: '손목 풀림', tc: '겨눈 선', tf: '지나가기 끝' };
  for (const c of R.filter((x) => x.size === 'large')) {
    for (const [k, p] of Object.entries(c.summary.keyPoses)) {
      L.push(`| ${c.nameKo} | ${TAG[k]} | ${p.t} | ${p.pelvisYaw} | ${p.chestYaw} | ${p.xFactor} | ${p.lean} | ${p.shoulderElev} | ${p.elbowS} | ${p.wrist} | ${p.kneeL}/${p.kneeR} | ${p.handChest.join(', ')} | ${p.tipWorld.join(', ')} | ${p.swordElAz.join(', ')} | ${p.footL.join(', ')} / ${p.footR.join(', ')} |`);
    }
  }
  L.push('');
  L.push('아래팔-칼 각은 칼과 칼 든 아래팔 사이 각이다. 사람 어림 [추정, 측정 자료 없음]: 두손 망치 쥐기 약 90° + 손목 옆굽힘으로 약 135°, 손목 폄(최대 70°)까지 보태면 약 160°. 160° 를 넘는 순간은 저작한 칼이 손목으로 낼 수 없는 늦춤을 요구한 것이다(v0 는 막지 않고 적기만 한다 — `tools/motion/lib/body.mjs` WRIST_MAX 주석). 크게 벌은 대부분 160° 안이다. 작게(게임 자세)와 크게를 곧게 섞으면 사이 자세가 165~177° 까지 간다(v0 보통 벌) — 게임에서 작은 벌과 큰 벌을 곧게 섞어도 같은 일이 생긴다. 지금 보통 벌은 크게 벌을 줄여 만들어 대부분 안이다.');
  L.push('');
  L.push('칼끝 가장 낮은 높이가 0 가까이거나 − 이면 칼끝이 땅에 닿는다. 작게 벌의 왼쪽 바꿈·바보 자세는 게임 자세표 값 그대로라 칼끝이 땅 높이까지 내려간다(게임에서는 땅이 막는다). ');
  L.push('');
  L.push('앞이 빈 시간 = 감기 끝~복귀 동안 칼(폼멜~칼끝)이 가슴 앞 0.45 m 의 세로 띠(가슴 아래 0.25 ~ 위 0.4 m)에서 0.3 m 넘게 떨어져 있던 시간. 팔 넘침 0.028 m 는 지금 게임 쟁기 자세 자체에서 뒷손(빈손)이 게임 팔 길이보다 조금 먼 것이다.');
  L.push('');
  return L.join('\n');
}
