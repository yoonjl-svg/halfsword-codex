// ─────────────────────────────────────────────────────────────
//  츠바이핸더 크게 벌 v0 (동작 연구 PM) — 롱소드 크게 벌 키를 무기 무게에 맞춰 늘이고 몸통 몫을 키운 것 [제안·근거]
//   node tools/motion/build_zweihander.mjs          → docs/motion/clips/zweihander/<베기>_<쪽>_large.json + index.json
//                                                     + docs/motion/zweihander_table.md (롱소드 크게 벌과 나란히)
//   node tools/motion/build_zweihander.mjs --print  → 숫자만 (파일 안 씀)
//
//  근거: docs/motion/weapon_body.md §1·§3 — 앞손 둘레 관성 롱소드의 2.81배, 같은 돌림힘이면 시간 √2.81 = 1.68배,
//   팔 힘은 같으니 몸통·다리가 돌림힘을 더 보태는 만큼 짧아진다: 돌림힘 1.7배면 √(2.81 / 1.7) ≈ 1.27배.
//   배율 목표(무기별 칼끝 비율 등)는 쓰지 않는다 — 사장님 Q26(9/29): 무기 차이는 물리에 맡김. 근거는 관성과 몸 몫뿐.
//  뼈대와 키 모양은 롱소드와 같다. 손 자리(뒷손 −0.18 m)·칼 길이·무게는 게임 스펙(src/weapons.js)에서 읽는다(lib/weapons.mjs).
//  배율은 모두 제안이다(사람 측정값이 아니다). 사장님·디렉터가 바꿀 수 있게 여기 한곳(PROPOSAL)에 둔다.
// ─────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUTS } from './lib/cuts.mjs';
import { SOURCES } from './lib/sources.mjs';
import { toKeys, marksOf, mirror, clipExtras, chainWithProfiles } from './lib/sets.mjs';
import { sampleClip, measure, summarize, toJSONFrames, toColumns, HZ } from './lib/clip.mjs';
import { JOINTS, BONES } from './lib/body.mjs';
import { weaponGeom, gripField } from './lib/weapons.mjs';
import { validateFile, report } from './validate_clip.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'docs', 'motion', 'clips', 'zweihander');
const args = process.argv.slice(2);
const PRINT = args.includes('--print');

const ZW = weaponGeom('zweihander');
const LS = weaponGeom('longsword');

/** 제안 배율 (롱소드 크게 벌 대비) — 근거는 basis 에 한 줄씩 */
export const PROPOSAL = {
  time: { wind: 1.3, release: 1.27, follow: 1.5, recover: 1.3 },
  trunk: 1.2,
  chain: { lead: 1.0, dur: 1.27 },
  basis: {
    inertia: `앞손 둘레 관성 ${ZW.inertia} / ${LS.inertia} kg·m² = ${(ZW.inertiaExact / LS.inertiaExact).toFixed(2)}배 (게임 부품 값) → 같은 돌림힘이면 시간 ${Math.sqrt(ZW.inertiaExact / LS.inertiaExact).toFixed(2)}배`,
    wind: '감기 1.3배: 같은 힘이면 1.68배지만 몸통·다리가 더 보태 1.27~1.3배 (weapon_body.md §3: 0.45~0.5 s)',
    release: '풀기 → 겨눈 선 1.27배: 관성 2.81배를 팔 힘 그대로에 몸통·다리가 돌림힘을 1.7배로 보태 휘두르면 √(2.81 / 1.7) ≈ 1.27 (몸통 몫은 weapon_body.md §3)',
    follow: '지나가기 1.5배: 겨눈 선의 칼 돌림 운동량이 롱소드의 2.81 / 1.27 ≈ 2.2배 — 세우는 힘이 휘두르는 힘만큼(1.7배)이면 1.3배, 팔만이면 2.2배, 그 사이',
    recover: '복귀 1.3배: 감기와 같은 까닭(무거운 칼을 다시 자세로 들어 올림)',
    trunk: '몸통 돌림 폭 1.2배(저작 키의 골반·가슴 돌림, 시작·끝 게임 자세는 그대로): 1.27배 시간에 휘두르려면 돌림힘이 1.7배 필요 — 팔만으로는 못 낸다',
    chain: '운동 사슬: 골반·가슴이 겨눈 선보다 앞서는 시간은 롱소드와 같게(130·90 ms), 돌림 곡선 길이만 1.27배 — 몸통이 더 오래 밀어 칼끝 최고 때도 돈다. 무거운 도구는 마디 사이 늦춤(채찍)을 늘리기보다 함께 민다(투포환: 마지막 동작 앞 60% 는 다리·엉덩이가 함께 펴고 그 뒤 팔 차례 [검색 요약]). 앞섬도 1.27배로 늘이면 몸통 몫이 거의 안 는다(33 → 34%), 0.8배로 줄이면 Oberhau 순서가 뒤섞인다',
  },
};
const FAMILIES = ['zornhau', 'oberhau', 'mittelhau', 'unterhau'];
const GROUND = 0.05; // m — 칼끝이 땅 위 이만큼보다 낮아지면 칼을 덜 숙인다 (롱소드 크게 벌 가장 낮은 칼끝 0.03 m)

/** 롱소드 크게 벌 → 츠바이핸더 크게 벌: 표시 사이를 배율로 늘이고(키·걸음 시각을 구간마다 곧게 옮김), 저작 키의 몸통 돌림을 키운다 */
function zweiSet(large) {
  const mL = marksOf(large);
  const T = PROPOSAL.time;
  const mZ = { t0: mL.t0 };
  mZ.tw = mZ.t0 + (mL.tw - mL.t0) * T.wind;
  mZ.tc = mZ.tw + (mL.tc - mL.tw) * T.release;
  mZ.tr = mZ.tw + (mL.tr - mL.tw) * T.release;
  mZ.tf = mZ.tc + (mL.tf - mL.tc) * T.follow;
  mZ.tg = mZ.tf + (mL.tg - mL.tf) * T.recover;
  // 표시는 표본 격자(1/120 s) 위에 둔다 — 끝 표본이 tg 에 닿아야 φ 가 2.2 로 끝난다 (검사 P3)
  for (const k of Object.keys(mZ)) mZ[k] = Math.round(mZ[k] * HZ) / HZ;
  const pts = ['t0', 'tw', 'tr', 'tc', 'tf', 'tg'];
  const tmap = (t) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = mL[pts[i]], b = mL[pts[i + 1]];
      if (t <= b + 1e-9) return +(mZ[pts[i]] + ((mZ[pts[i + 1]] - mZ[pts[i]]) * (t - a)) / (b - a)).toFixed(4);
    }
    return mZ.tg;
  };
  const k = PROPOSAL.trunk;
  // 칼자루가 길어 뒷손이 앞손에서 ${-ZW.offHand} m (롱소드 ${-LS.offHand} m) — 저작 키는 두 손을 칼 방향으로 그 차이만큼 밀어 뒷손을 롱소드 자리에 둔다
  //  (그대로 두면 뒷손이 가슴 쪽으로 4 cm 들어와 빈 팔 아래팔이 몸통을 파고든다 — qa_clips). 시작·끝 게임 자세 키는 게임 손 자리 그대로
  const slide = LS.offHand - ZW.offHand;
  const keys = large.keys.map((key) =>
    key.guard
      ? { ...key, t: tmap(key.t) }
      : { ...key, t: tmap(key.t), p: [key.p[0] * k, key.p[1], key.p[2] ?? 0], c: [key.c[0] * k, key.c[1], key.c[2] ?? 0], h: key.h.map((v, j) => v + key.d[j] * slide) },
  );
  const steps = large.steps.map((s) => ({ ...s, t: tmap(s.t) }));
  const q = large.chain.seq;
  const { lead, dur } = PROPOSAL.chain;
  const chain = { ...large.chain, ramp: large.chain.ramp * T.wind, seq: { pelvis: q.pelvis * lead, chest: q.chest * lead, dur: q.dur * dur } };
  return { keys, steps, chain };
}

function build(set, sword) {
  const marks = marksOf(set);
  // 느린 지나가기 곡선의 최고: 롱소드 겨눈 선 + 0.1 s (build_clips 와 같게), 츠바이핸더는 지나가기 배율만큼 늦게
  const chain = chainWithProfiles(set, marks, { peak2After: sword === ZW ? 0.1 * PROPOSAL.time.follow : 0.1 });
  // 칼이 0.18 m 길어 롱소드 키 그대로면 칼끝이 땅을 판다(Zornhau 지나가기 −0.11 m) → 땅 위 0.05 m 에서 칼을 덜 숙인다 (clip.mjs groundLimit)
  const { frames } = sampleClip({ keys: toKeys(set), marks, chain, sword, ground: sword === ZW ? GROUND : undefined }, 1);
  const rows = measure(frames, marks);
  return { marks, rows, summary: summarize(rows, marks), extra: clipExtras(set, rows, marks) };
}

const index = [];
const table = [];
if (!PRINT) mkdirSync(OUT, { recursive: true });
for (const id of FAMILIES) {
  const cut = CUTS.find((c) => c.id === id);
  for (const side of ['right', 'left']) {
    const lsSet = side === 'left' ? mirror(cut.large) : cut.large;
    const zwSet = side === 'left' ? mirror(zweiSet(cut.large)) : zweiSet(cut.large);
    const ls = build(lsSet, LS);
    const zw = build(zwSet, ZW);
    const name = `${id}_${side}_large`;
    const s = zw.summary;
    console.log(
      `zweihander ${name.padEnd(22)} 칼끝 ${String(s.tipPeak).padStart(5)} m/s (선 ${s.tipAtLine}) 손 ${s.handPeak} | 시간 ${s.time.wind}/${s.time.releaseToLine}/${s.time.follow}/${s.time.recover} s | 가슴 ${s.range.chestYaw}° 골반 ${s.range.pelvisYaw}° | 몸통 몫 ${s.shareAtTipPeak.trunk} (롱소드 ${ls.summary.shareAtTipPeak.trunk}) | ${s.ordered ? '순서 OK' : '순서 뒤섞임'} | 넘침 팔 ${s.checks.reachOver} 다리 ${s.checks.legOver} | 손목 ${s.checks.wristMax}°`,
    );
    table.push({ id, side, nameKo: cut.nameKo, nameDe: cut.nameDe, ls: ls.summary, zw: s, mL: ls.marks, mZ: zw.marks });
    if (PRINT) continue;
    const clip = {
      format: 'stillness-motion-clip/2',
      id: name,
      cut: id,
      nameKo: cut.nameKo,
      nameDe: cut.nameDe,
      family: cut.family,
      desc: `${cut.desc} (츠바이핸더: 감기·지나가기가 길고 몸통을 더 크게 돌린다)`,
      side,
      size: 'large',
      hz: HZ,
      weapon: 'zweihander',
      handedness: 'right',
      grip: gripField('zweihander'),
      units: 'm, 도(°), 초, rad/s(w), m/s(speed)',
      frame: '롱소드 클립과 같다 (clip_format.md §2)',
      marks: Object.fromEntries(Object.entries(zw.marks).map(([k, v]) => [k, +v.toFixed(4)])),
      phiMarks: { t0: -1, tw: 0, tr: 0.55, tc: 0.85, tf: 1.6, tg: 2.2 },
      proposal: PROPOSAL,
      sources: [...cut.sources, 'figueyredo_montante', 'heavy_implement', 'game_weapons'].map((sid) => ({ id: sid, ...SOURCES[sid] })),
      provenance: '롱소드 크게 벌(교본 서술 + 운동 사슬로 저작한 v0)을 무기 관성 배율로 늘이고 몸통 돌림을 키운 것 — 배율은 제안·근거(proposal), 모캡 실측 아님',
      summary: s,
      ...zw.extra,
      joints: JOINTS,
      bones: BONES,
      data: toColumns(toJSONFrames(zw.rows)),
    };
    writeFileSync(join(OUT, `${name}.json`), JSON.stringify(clip));
    index.push({ id: name, cut: id, weapon: 'zweihander', nameKo: cut.nameKo, nameDe: cut.nameDe, family: cut.family, desc: clip.desc, side, size: 'large', file: `${name}.json`, summary: s, ...zw.extra });
  }
}
if (!PRINT) {
  const ip = join(OUT, 'index.json');
  writeFileSync(ip, JSON.stringify({ format: 'stillness-motion-index/1', weapon: 'zweihander', generated: new Date().toISOString().slice(0, 10), grip: gripField('zweihander'), proposal: PROPOSAL, clips: index }, null, 1));
  writeFileSync(join(ROOT, 'docs', 'motion', 'zweihander_table.md'), zweiTable(table));
  console.log(`\n츠바이핸더 클립 ${index.length}개 → docs/motion/clips/zweihander, 표 → docs/motion/zweihander_table.md`);
  if (!report([validateFile(ip)], { quiet: true })) process.exit(1); // 검사 (clip_format.md §6)
}

function zweiTable(list) {
  const R = list.filter((x) => x.side === 'right');
  const f = (a, b, d = 2) => `${a} → **${b}**`;
  const L = [];
  L.push('# 츠바이핸더 크게 벌 v0 — 롱소드 크게 벌과 나란히 (자동 생성)');
  L.push('');
  L.push('> `node tools/motion/build_zweihander.mjs` 가 만든다. 손으로 고치지 말 것. 오른쪽에서 베기만 적는다(왼쪽은 거울).');
  L.push('> 롱소드 크게 벌 키를 무기 무게에 맞춰 늘이고 몸통 돌림을 키운 것이다. **배율은 모두 제안·근거**(아래 표) — 사람 측정값이 아니다. 사람 값은 참고이지 한도가 아니다.');
  L.push(`> 칼 치수는 게임 스펙(src/weapons.js)에서 읽었다: 롱소드 뒷손 ${LS.offHand} m · 칼끝 ${LS.tip} m · ${LS.mass} kg → 츠바이핸더 뒷손 **${ZW.offHand} m** · 칼끝 **${ZW.tip} m** · **${ZW.mass} kg** (무게중심 ${LS.com} → ${ZW.com} m, 앞손 둘레 관성 ${LS.inertia} → ${ZW.inertia} kg·m²).`);
  L.push('');
  L.push('## 1. 제안 배율과 근거');
  L.push('');
  L.push('| 무엇 | 배율 (롱소드 크게 = 1) | 근거 |');
  L.push('|---|---|---|');
  L.push(`| 감기 (준비 → 감기 끝) | ${PROPOSAL.time.wind} | ${PROPOSAL.basis.wind} |`);
  L.push(`| 풀기 → 겨눈 선 | ${PROPOSAL.time.release} | ${PROPOSAL.basis.release} |`);
  L.push(`| 지나가기 (겨눈 선 → 지나가기 끝) | ${PROPOSAL.time.follow} | ${PROPOSAL.basis.follow} |`);
  L.push(`| 복귀 | ${PROPOSAL.time.recover} | ${PROPOSAL.basis.recover} |`);
  L.push(`| 몸통 돌림 폭 | ${PROPOSAL.trunk} | ${PROPOSAL.basis.trunk} |`);
  L.push(`| 운동 사슬 앞섬 · 돌림 곡선 길이 | ${PROPOSAL.chain.lead} · ${PROPOSAL.chain.dur} | ${PROPOSAL.basis.chain} |`);
  L.push(`| (계산) 관성 | ${(ZW.inertiaExact / LS.inertiaExact).toFixed(2)} | ${PROPOSAL.basis.inertia} |`);
  L.push('');
  L.push('## 2. 시간 (s)');
  L.push('');
  L.push('| 베기 | 감기 | 풀기→선 | 지나가기 | 복귀 | 합 |');
  L.push('|---|---|---|---|---|---|');
  for (const x of R) {
    const a = x.ls.time, b = x.zw.time;
    L.push(`| ${x.nameKo} ${x.nameDe} | ${f(a.wind, b.wind)} | ${f(a.releaseToLine, b.releaseToLine)} | ${f(a.follow, b.follow)} | ${f(a.recover, b.recover)} | ${f(a.total, b.total)} |`);
  }
  L.push('');
  L.push('## 3. 빠르기·몸통 몫·크기 (롱소드 → 츠바이핸더)');
  L.push('');
  L.push('| 베기 | 칼끝 최고 m/s | 칼끝 (겨눈 선) m/s | 손 최고 m/s | 칼끝 빠르기 중 몸통 몫 | 가슴 회전 범위° | 골반 회전 범위° | 척추 비틀림 최대° | 칼끝 길 m | 순서 |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const x of R) {
    const a = x.ls, b = x.zw;
    const pct = (v) => `${Math.round(v * 100)}%`;
    L.push(`| ${x.nameKo} | ${f(a.tipPeak, b.tipPeak)} | ${f(a.tipAtLine, b.tipAtLine)} | ${f(a.handPeak, b.handPeak)} | ${pct(a.shareAtTipPeak.trunk)} → **${pct(b.shareAtTipPeak.trunk)}** | ${f(a.range.chestYaw, b.range.chestYaw)} | ${f(a.range.pelvisYaw, b.range.pelvisYaw)} | ${f(a.range.xFactorMax, b.range.xFactorMax)} | ${f(a.range.tipPath, b.range.tipPath)} | ${b.ordered ? '골반→가슴→손→칼끝' : '뒤섞임'} |`);
  }
  L.push('');
  L.push('## 4. 반동·허점 (롱소드 → 츠바이핸더)');
  L.push('');
  L.push('| 베기 | 앞이 빈 시간 s | 칼끝이 몸 뒤에 있는 시간 s | 가장 많이 돌아선 각° | 지나가기 손 옆 거리 (가슴 가운데 기준) m | 무게중심 옮김 m | 팔 넘침 m | 아래팔-칼 각 최대° |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const x of R) {
    const a = x.ls, b = x.zw;
    L.push(`| ${x.nameKo} | ${f(a.opening.openTime, b.opening.openTime)} | ${f(a.opening.bladeBehindTime, b.opening.bladeBehindTime)} | ${f(a.opening.maxTurn, b.opening.maxTurn)} | ${f(a.followThrough.handSideChest, b.followThrough.handSideChest)} | ${f(a.range.comShift, b.range.comShift)} | ${f(a.checks.reachOver, b.checks.reachOver)} | ${f(a.checks.wristMax, b.checks.wristMax)} |`);
  }
  L.push('');
  L.push('## 5. 읽는 법');
  L.push('');
  L.push('- 같은 베기라도 츠바이핸더는 감기가 길고 크다 — 준비가 더 잘 읽힌다(무거운 칼의 대가). 지나가기가 길어 앞이 빈 시간이 늘어난다 — 사장님 "반동·허점"이 가장 크게 드러나는 무기.');
  L.push('- 칼끝 빠르기: 칼이 0.18 m 길어 같은 돌림이면 칼끝이 15% 빠르지만, 시간이 1.27배라 롱소드와 비슷하거나 조금 느리다. 같은 빠르기라도 칼 무게가 1.8배라 맞는 힘(운동량)은 훨씬 크다.');
  L.push('- 몸통 몫은 도는 베기(Zornhau·Mittelhau·Unterhau)에서 10%p 안팎 는다. 세로 베기(Oberhau)는 몸을 거의 안 틀어 그대로다(8%) — 숙임을 1.2~1.3배로 키워 봐도 칼끝 최고 때는 숙임이 이미 멈춰 있어 안 늘었다. 무거운 칼의 세로 베기는 숙임·낮춤·걸음의 때를 칼끝 최고에 맞추는 저작이 더 필요하다(다음 차례).');
  L.push('- 한계: 롱소드 키 모양을 늘인 것이라 무거운 칼만의 몸 쓰기(칼을 등 뒤로 돌려 잇는 몬탄테 흐름, 리카소 쥐기)는 아직 없다. 모캡 실측이 아니다.');
  L.push('');
  return L.join('\n');
}
