// ─────────────────────────────────────────────────────────────
//  기준 동작 ↔ 게임 기록 모양 비교표 (동작 연구 PM)
//   node tools/motion/compare.mjs   → docs/motion/compare_game.md
//  관절 위치만으로 같은 식으로 잰다(lib/shape_metrics.mjs). 기록이 있는 것만 적는다.
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shapeMetrics } from './lib/shape_metrics.mjs';
import { score, SCORE_VERSION } from './score.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const D = join(ROOT, 'docs', 'motion');
const load = (p) => JSON.parse(readFileSync(join(D, p), 'utf8'));
const recIndex = existsSync(join(D, 'records', 'index.json')) ? load('records/index.json').records : [];

const CUTS = [
  ['zornhau', '분노의 베기 Zornhau', { game: 'game_zornhau', arm: 'wbs_diagR_arm', commit: 'wbs_diagR_commit' }],
  ['oberhau', '위에서 베기 Oberhau', { game: 'game_oberhau', arm: 'wbs_vert_arm', commit: 'wbs_vert_commit' }],
  ['mittelhau', '가운데 베기 Mittelhau (게임 가로베기)', { game: 'game_mittelhau', arm: 'wbs_horizR_arm', commit: 'wbs_horizR_commit' }],
  ['unterhau', '아래에서 베기 Unterhau', { game: 'game_unterhau', arm: 'wbs_riseR_arm', commit: 'wbs_riseR_commit' }],
];
const has = (id) => recIndex.some((r) => r.id === id);

const L = [];
L.push('# 기준 동작 ↔ 게임 동작 모양 비교 (자동 생성)');
L.push('');
L.push('> `node tools/motion/compare.mjs` 가 만든다. 관절 위치만으로 같은 식으로 잰다(`tools/motion/lib/shape_metrics.mjs`) — 기준 클립과 게임 기록의 측정 방법이 같다.');
L.push('> 가슴 돌림 = 어깨선, 골반 돌림 = 엉덩이선. 베기 창 = 칼끝 최고 앞뒤 0.35 s (손·칼끝 길은 이 창 안). 사슬 순서 = 칼끝 최고 기준 ms (− 가 앞).');
L.push('> 기록: 지금 게임 = `record_game.mjs`(main, 손가락을 AI 기술 길로), 시험판 = `record_wbs.mjs`(claude/wbs-impl, tseq.mjs 와 같은 조건, 손가락 12 m/s).');
L.push('> **사람 값은 참고이지 한도가 아니다.** 게임이 기준보다 크거나 빠른 것은 문제가 아니고, 작거나 느린 것이 "모자람"이다.');
L.push('');
// 기록 조건 (디렉터 요청: 커밋·시드·Hz·무기). 기록 파일의 cond 를 그대로 옮긴다
const used = CUTS.flatMap(([, , ids]) => Object.values(ids)).filter(has);
if (used.length) {
  const idx = Object.fromEntries(recIndex.map((r) => [r.id, r]));
  L.push('## 기록 조건');
  L.push('');
  L.push('| 기록 | 코드 (커밋) | 시드 | 물리 / 기록 / 입력 Hz | 무기 | 걸음 | skill | 거리 m | 결심 (WHOLE.commit) | 입력 |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const id of used) {
    const c = idx[id].cond ?? load(`records/${id}.json`).cond;
    if (!c) {
      L.push(`| ${id} | (조건 없음 — 다시 기록할 것) |||||||||`);
      continue;
    }
    L.push(`| ${id} | ${c.code} | ${c.seed} | ${c.physicsHz} / ${c.recordHz} / ${c.inputHz} | ${c.weapon} | ${c.gait} | ${c.skill} | ${c.gap == null ? '상대 치움' : c.gap.toFixed(1)} | ${c.commit ?? '없음'} | ${c.input} |`);
  }
  L.push('');
  L.push('- 기준 클립(`docs/motion/clips`)은 저작 키프레임을 120 Hz 로 뽑은 것이라 시드·물리가 없다. 롱소드, 오른손잡이.');
  L.push('- 같은 코드·시드면 같은 기록이 나온다(2026-09-29 다시 기록해 관절 자리가 한 자리도 안 바뀐 것을 확인).');
  L.push('');
}
const COLS = [
  ['tipPeak', '칼끝 최고 m/s'],
  ['handTop', '손 최고 높이 (머리 꼭대기 위) m'],
  ['handBack', '손이 가슴 앞면보다 뒤 (최대) m'],
  ['tipBack', '칼끝이 가슴보다 뒤 (최대) m'],
  ['chestRange', '가슴 회전 범위°'],
  ['pelvisRange', '골반 회전 범위°'],
  ['xMax', '척추 비틀림 최대°'],
  ['cross', '지나가기: 손 옆 거리 (가슴 가운데 기준, 반대쪽 −) m'],
  ['handPath', '손 길 (베기 창) m'],
  ['tipPath', '칼끝 길 (베기 창) m'],
  ['step', '발 옮김 최대 m'],
];
for (const [cut, title, ids] of CUTS) {
  const rows = [];
  for (const size of ['small', 'large']) {
    const clip = load(`clips/${cut}_right_${size}.json`);
    rows.push([`기준 ${size === 'small' ? '작게 (= 지금 게임 자세표)' : '크게 (온몸)'}`, shapeMetrics(clip)]);
  }
  if (has(ids.game)) rows.push(['지금 게임 · 팔 베기', shapeMetrics(load(`records/${ids.game}.json`))]);
  if (has(ids.arm)) rows.push(['시험판 · 팔 베기', shapeMetrics(load(`records/${ids.arm}.json`))]);
  if (has(ids.commit)) rows.push(['시험판 · 결심(온몸) 베기', shapeMetrics(load(`records/${ids.commit}.json`))]);
  L.push(`## ${title}`);
  L.push('');
  L.push(`| | ${rows.map((r) => r[0]).join(' | ')} |`);
  L.push(`|---|${rows.map(() => '---').join('|')}|`);
  for (const [k, label] of COLS) L.push(`| ${label} | ${rows.map((r) => r[1][k]).join(' | ')} |`);
  L.push(`| 사슬: 골반 / 가슴 / 손 (칼끝 최고 기준 ms) | ${rows.map((r) => `${r[1].seq.pelvis} / ${r[1].seq.chest} / ${r[1].seq.hand}`).join(' | ')} |`);
  L.push(`| 골반 / 가슴 최고 각속도 °/s | ${rows.map((r) => `${r[1].pelvisPeakRate} / ${r[1].chestPeakRate}`).join(' | ')} |`);
  L.push('');
  // 채점 (score.mjs): 기록마다 작게·크게 기준 대비
  const recs = [['지금 게임 · 팔 베기', ids.game], ['시험판 · 팔 베기', ids.arm], ['시험판 · 결심(온몸) 베기', ids.commit]].filter(([, id]) => has(id));
  if (recs.length) {
    L.push(`채점 (\`${SCORE_VERSION}\`, \`score.mjs\` — 정의는 [score.md](score.md)). 점수 0~1, 1 = 기준과 같음. 괄호 = 그 항목 점수.`);
    L.push('');
    L.push('| 기록 | 기준 | 합 | 손 오차 RMS m | 사슬 시각 차 평균 ms | 순서 뒤바뀜 (기준) | 칼 방향 차 평균° | 동작 범위 | 시간 배율 |');
    L.push('|---|---|---|---|---|---|---|---|---|');
    for (const [label, id] of recs) {
      const rec = load(`records/${id}.json`);
      for (const size of ['small', 'large']) {
        const sc = score(load(`clips/${cut}_right_${size}.json`), rec);
        const T = sc.terms;
        L.push(`| ${label} | ${size === 'small' ? '작게' : '크게'} | **${sc.total}** | ${T.hand.rms} (${T.hand.score}) | ${T.phase.meanAbsMs} (${T.phase.score}) | ${T.order.inversions} (${T.order.refInversions}) | ${T.blade.meanDeg?.toFixed(0)} (${T.blade.score}) | ${T.range.score} | ${sc.align.timeScale} |`);
      }
    }
    L.push('');
  }
}
writeFileSync(join(D, 'compare_game.md'), L.join('\n') + '\n');
console.log(L.join('\n'));
