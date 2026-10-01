# 동작 채점 — `stillness-motion-score/1` (동작 연구 PM)

- 작성: 2026-09-29. 코드: `tools/motion/score.mjs` (`score(ref, rec, opts)`). 정의를 바꾸면 버전 번호를 올리고 §6 에 적는다.
- **무엇을 재나**: 기준 클립(`stillness-motion-clip/2`) 대비 기록 한 벌(`stillness-motion-record/1` 또는 다른 클립)이 얼마나 같은가. 디렉터 `chain.mjs` 가 부르고, `compare.mjs` 도 같은 함수로 `compare_game.md` 의 채점 표를 만든다.
- **사람 값은 참고이지 한도가 아니다.** 동작 범위는 모자란 것만 깎는다(기준보다 크거나 빠른 것은 깎지 않는다). 척도·무게는 동작 연구 PM 의 **제안**이다 — `opts.scales`·`opts.weights` 로 바꿀 수 있다.
- 입력은 둘 다 같은 23 관절 `J` 만 있으면 된다(`clip_format.md` §3·§5). 브라우저에서도 돈다(명령줄 부분 빼고).

## 1. 쓰는 법

```js
import { score, SCORE_VERSION } from './tools/motion/score.mjs';
const s = score(refClip, record);           // refClip = docs/motion/clips/zornhau_right_large.json 등
s.total;                                     // 0~1
s.terms.hand.rms;                            // m
```

```bash
node tools/motion/score.mjs docs/motion/clips/zornhau_right_large.json docs/motion/records/game_zornhau.json
```

돌려주는 값:

```text
{ format: 'stillness-motion-score/1', ref, rec,
  align: { method, refTipPeak, recTipPeak, refHalfWidth, recHalfWidth, refStart, recStart, timeScale, refWindow },
  terms: { hand:  { rms, max, samples, score },
           phase: { deltaMs: { pelvis, chest, hand }, meanAbsMs, refSeq, recSeq, score },
           order: { inversions, refInversions, ordered, score },
           blade: { meanDeg, atTipPeakDeg, score },
           range: { items: { chestRange|pelvisRange|xMax|handPath|tipPath|cross: { ref, rec, ratio } }, score } },
  scales, weights, total }
```

## 2. 시간 맞춤

- **칼끝 최고끼리** 맞춘다. 칼끝 최고는 기준 클립이면 감기 끝(`tw`) 뒤에서, 기록이면 `swingStart`·`cutStroke` 뒤에서 찾는다(`lib/shape_metrics.mjs` 와 같다 — 감기 중 빠른 칼 돌림을 베기로 잡지 않게).
- **시간 배율** = 칼끝 빠르기 봉우리 반너비(최고의 50% 넘는 이어진 구간)의 비, 기록 / 기준. 기록이 느리거나 빨라도 같은 동작 단계끼리 견준다.
- 기준 시각 x ↔ 기록 시각 = 기록 칼끝 최고 + (x − 기준 칼끝 최고) × 배율.
- '움직임 시작' 표시는 배율에 쓰지 않는다: 게임 기록의 `swingStart` 는 손가락이 **기술의 시작 자세**를 떠난 때인데, 기술마다 시작 자세가 다르다(지금 게임 Zornhau 는 어깨 지붕 = 감기 끝 자세에서 시작). `opts.align = 'start'` 면 (시작, 칼끝 최고) 두 점으로 맞춘다. `opts.timeScale` 로 직접 줄 수도 있다.

## 3. 항목

| 항목 | 어떻게 재나 | 점수 | 척도 (제안) | 무게 (제안) |
|---|---|---|---|---|
| **손 오차** `hand` | 기준 창(`tw` → `tf`)의 표본마다, 가슴 가운데에서 본 앞손 자리(`J` 의 hS − chest, 땅 틀 축 = 게임이 손 목표를 두는 바라보는 틀)의 거리. RMS·최대 | 1 / (1 + (RMS / 0.08 m)²) | 0.08 m | 0.3 |
| **위상 오차** `phase` | 칼끝 최고를 0 으로 한 골반·가슴·손 최고 시각(ms, `shape_metrics.mjs` `seq`)의 차이, 세 개 평균 절댓값 | 1 / (1 + (평균 / 40 ms)²) | 40 ms | 0.2 |
| **최고 순서** `order` | 골반 → 가슴 → 손 → 칼끝 순서의 뒤바뀜 수(4개 → 쌍 6개). 기준도 같은 식으로 재어 **기준보다 더 뒤바뀐 만큼만** 깎는다 | 1 − max(0, 기록 − 기준) / 6 | — | 0.15 |
| **칼 방향** `blade` | 손 오차와 같은 표본에서 칼(자루 끝 → 칼끝) 방향 사이 각 평균. 칼끝 최고 때 각도 따로 | 1 / (1 + (평균 / 20°)²) | 20° | 0.2 |
| **동작 범위** `range` | 가슴·골반 회전 범위, 척추 비틀림 최대, 손·칼끝 길(칼끝 최고 앞뒤 0.35 s), 지나가기 손 옆 거리(반대쪽으로 넘어간 크기) — 기록 / 기준 비율 | 항목마다 min(1, 비율)의 평균 (기준보다 크면 만점) | — | 0.15 |

합 `total` = 무게 합으로 나눈 가중 평균. 자기 자신과 견주면 모든 항목 1 (확인함).

- 가슴·골반 돌림은 **어깨선·엉덩이선**으로 잰다(기록에는 가슴 틀이 없다). 어깨띠가 앞으로 나가면 어깨선 돌림 최고가 늦게 잡혀 기준도 순서가 하나 뒤바뀌어 보일 수 있다 — 그래서 순서는 기준 대비로 깎는다.
- 손 오차는 몸통과 팔이 합쳐진 손 자리 차이다. 몸통을 뺀 팔만의 차이가 필요하면 다음 버전에서 가슴 틀 손(`handS`)을 더한다(기록에 가슴 틀이 생기면).

## 4. 지금 기록으로 본 것 (9/29, `compare_game.md`)

- 게임 기록(지금 게임·시험판)과 **작게 벌**의 손 오차 RMS 가 0.11~0.39 m 로 크다 — 작게 벌은 게임 자세표를 이어 저작한 것이지 게임 기술 길을 그대로 옮긴 것이 아니다. 예: 지금 게임 Zornhau 는 손이 먼저 가슴 위 0.3 m 로 올라갔다가 내려오는데, 작게 벌은 어깨 지붕에서 곧장 앞·아래로 온다. 게임 쪽 비교에는 작게 벌보다 **게임 기록 자체**를 기준으로 쓰는 편이 맞을 수 있다(디렉터 판단).
- 크게 벌 대비 합: 지금 게임 팔 베기 0.17~0.34, 시험판 결심(온몸) 베기 0.29~0.31 — 동작 범위 점수 0.42~0.77 로 모자라고 손 오차 RMS 가 0.25~0.52 m.

## 5. 한계

- 시간 맞춤은 곧은 배율 하나다(구간마다 늘고 주는 것은 못 맞춘다). 필요하면 다음 버전에서 동적 시간 맞춤(DTW).
- 척도·무게는 추정이다(사람 측정의 흩어짐으로 정한 값이 아니다).

## 6. 바뀐 기록

| 버전 | 날짜 | 바뀐 것 |
|---|---|---|
| score/1 | 2026-09-29 | 처음 (디렉터 요청: compare.mjs 에서 채점 함수를 떼어 버전을 붙임) |
