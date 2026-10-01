# 유파 꾸러미 + 감정층 제안 검토 (캐릭터 PM 회신)

`claude/pm-ai-tactics` 세션이 리서처로 역할을 바꾸며 넘긴 제안(유파=무기 꾸러미, 감정 5개층, 데이터 계약)에
대한 캐릭터 PM의 검토 의견이다. 감독(사용자) 확인용으로 이 문서를 `claude/pm-characters`에 남긴다.

## 결론부터: 컨펌하되, 단계를 나눈다

방향 자체(성격 벡터를 캐릭터 시트로, 감정을 기술로 굴절, 유파를 무기에 묶기)는 동의한다. 다만 이번에
5인 캐릭터 밸런스를 잡으면서 직접 겪은 것: **`ai.js`의 상수 하나(자세 옮기기 페널티, 힘, 인내심 같은
값 한둘)만 바꿔도 라운드로빈 승률이 크게 흔들린다.** 브란(쉬움) 하나를 두 번 다시 튜닝하는 데만
`characters_eval.mjs rr` 10판짜리 시뮬레이션을 세 번 돌려야 했다(문서: `docs/characters.md`의 "균형"
절). 유파 5종 × 감정 5종을 한 번에 얹으면 튜닝 차원이 곱으로 늘어 회귀를 못 잡는다 — 리서치 보고서
스스로도 "감정은 한 번에 하나씩" 권했는데, 전적으로 동의한다. 그래서:

1. **1단계 (지금 상태, 완료)**: `persona.level`/`persona.pers` + `guardStick`/`guardSpeed` 손잡이로
   캐릭터마다 "숫자가 다른 같은 유파(롱소드/리히테나워)" — 이미 병합되어 main에 있음.
2. **2단계 (제안)**: 유파를 무기에 묶어 꾸러미로 뺀다. 아래 스키마 초안 참고. **무기 PM의 실측
   간격 상수(리치·간격)가 나온 뒤에** 시작하는 게 맞다 — 지금 저장소에 `claude/pm-weapons` 브랜치가
   아직 없어(2026-09-26 기준 `git branch -a`로 확인) 계약을 맺을 상대가 없다. 감독님이 그 세션을
   만들어 주시거나 주소를 알려주시면 제가 계약 문서를 먼저 초안해 넘기겠다.
3. **3단계 (제안)**: 감정층은 **딱 하나(공포)부터** 파일럿으로 넣고, `fights12`/`characters_eval rr`
   회귀를 다시 잡은 뒤에야 두 번째(분노)를 얹는다. 아래 우선순위 참고.

담당 제안: **캐릭터 시트(성격 벡터 + 유파 id + 숙련도 + 감정 문턱값)는 제가(캐릭터 PM) 계속 소유**하고,
**유파 꾸러미의 "무기 쪽 절반"(MEASURE·리치)은 무기 PM 확정 수치를 받아서 제가 `ai_techniques.js`
일반화 작업까지 이어 하겠다** — 이번에 `characters.js`/persona 계층을 만들며 `ai.js`/`ai_techniques.js`
구조를 이미 파악했고, 회귀 시뮬레이션 도구(`tools/sim/characters_eval.mjs`, `duel_pair.mjs`)도 이미
갖춰 놔서 이어 하는 게 가장 빠르다. 단, `pm-ai-tactics`가 방금 병합한 변경(stop-hit 편향, `noticedThreat`
한 공격 한 번 굴림, 무릎 상태 전투, Nachschlag 완화)과 `pm-input-feel`의 입력 가죽끈이 막 안정화된
참이라, 이 위에서 새 회귀 기준선을 한 번 다시 잡고 시작한다(아래 "회귀 기준선" 절).

## 제안 1: 유파 꾸러미 스키마 (초안)

```js
// src/schools.js (가칭) — 무기 PM 수치 확정 후 작성
export const SCHOOLS = {
  longsword_liechtenauer: {
    weapon: 'longsword', // 무기 PM 로스터의 id
    measure: { contact: 1.62, reach: 2.0, clinch: 1.25, cutTime: 0.3 }, // 지금 ai.js의 MEASURE 그대로 = 기본값
    guards: WATCH_GUARDS, // 지금 ai_techniques.js 그대로
    tech: TECH,
    feints: FEINTS,
    parry: PARRY, // ai.js의 줄별 막기 자세
    counterRole: { highR: ['zornhauL', 'oberhau', 'zornhau'], default: ['zornhau', 'oberhau', 'zornhauL'] }, // counterTech() 역할화
  },
  // jian_wandering, meyer_showman 등은 무기 PM 수치 확정 후 추가
};
```

`ai.js` 변경은 두 곳뿐이라고 본다(리서치 보고서와 같은 진단):
- `import { G, WATCH_GUARDS, TECH, ... }` 직접 참조 → `this.school.guards`/`this.school.tech`/...
- `counterTech()`의 `'zornhauL'` 같은 이름 직접 호출 → `this.school.counterRole[line] ?? counterRole.default`

`pickTech()`의 빈틈 코드(UL/UR/LL/LR/C/H) 매칭은 무기 무관이라 그대로 둔다는 진단에 동의한다.
**리스크**: `MEASURE`가 지금 모듈 최상단 상수라 `ai.js` 곳곳(`stepTime`, `contactDist`, `threat`,
`respond`, `moveFeet`)에서 직접 참조한다 — `this.school.measure`로 바꾸는 diff가 생각보다 넓다.
무기 PM 계약이 "무기마다 간격 배수 하나만 다르다" 수준(예: `measureScale`)으로 단순화된다면 이 전체를
`MEASURE.reach * this.school.measureScale` 식으로 훨씬 작은 diff로 줄일 수 있다 — 계약 논의 때
제안하겠다.

## 제안 2: 감정 5개 — 우선순위와 근거

표 자체(공포/분노/집념/자포자기/교활함, 사건→손잡이→표정)에 동의한다. 순서를 매기면:

1. **공포** — 가장 먼저. 기존 `hurry()`의 `desperate`와 정반대 극성이라 구조를 그대로 재사용할 수 있고
   (margin↑·defVoid↑·counter↓), `MEASURE`/유파 변경 없이도 지금 당장(1단계 위에) 실험 가능하다.
2. **분노** — `foeParried`(이미 존재, 속임수 확률에 씀)를 그대로 트리거로 재사용 가능. `patience` 급감은
   기존 `hurry()`/`aggression` 경로에 자연히 올라탄다.
3. **교활함** — `foeAggro`(이미 존재)를 트리거로 재사용. `alber` 유인은 `pickGuard()`의 기존 `margin`
   보정(-0.12) 확장.
4. **집념** — `chain`(이미 존재, 이어 치기 카운터)을 확장. 우선순위가 낮은 이유는 "방어는 유지"라는
   조건이 다른 감정과 동시에 켜졌을 때 우선순위 충돌(예: 집념 중에 공포 트리거가 뜨면?)을 규칙으로
   정해야 하는데, 단일 지배감정 원칙과 가장 자주 부딪히는 조합이라 뒤로 미룬다.
5. **자포자기** — 이미 `desperate`가 사실상 이 역할을 하고 있어(문서에도 "기존 desperate 확장"이라
   적혀 있음) 신규성이 가장 적다. "방어 판단 생략"은 신중하게: 5인 캐릭터 밸런스에서 확인했듯
   막기 확률을 조금만 낮춰도(guardChance -0.1) 승률이 10%p 넘게 흔들렸다 — 이 감정은 도입 즉시 사망률
   급증으로 이어질 가능성이 커서 가장 늦게, 가장 작은 폭으로 넣는다.

**구조**: 리서치 보고서의 "지배 감정 1개 + 세기 + 시간 감쇠" 원칙에 동의. `persona`에 이미 있는
`level`/`pers` 위에 `persona.emotion = { fear: {onset, decay, ...} }` 식으로 얹으면, 이번에 만든
persona 병합 방식(안 주면 예전과 동일)을 그대로 재사용해 회귀를 지킬 수 있다.

## 제안 3: 데이터 계약 — 소유권 제안

| 조각 | 소유 | 비고 |
|---|---|---|
| 캐릭터 시트(`pers` + 유파 id + 숙련도 + 감정 문턱값) | 캐릭터 PM(본 세션) | `characters.js`가 이미 이 역할 — 확장만 하면 됨 |
| 무기 제원 → `MEASURE`/`measureScale` | 무기 PM | 브랜치 아직 없음 — 감독 확인 필요 |
| 유파 꾸러미(무기 쪽 절반: guards/tech/feints/parry) | 캐릭터 PM ↔ 무기 PM 공동 | 무기 제원 확정 후 캐릭터 PM이 `ai_techniques.js` 일반화 작업 |
| `ai.js` 일반 로직(school/emotion을 "읽기만" 하게) | 캐릭터 PM | 이미 persona 계층으로 진입점을 만들어 둠 |

## 회귀 기준선 (다음에 손대기 전에)

`pm-ai-tactics` + `pm-input-feel` 병합 직후 `fights12.mjs`가 `사망 9/12`로 나온다(제 이전 기준 7~8/12
대비 소폭 상승 — stop-hit 편향·Nachschlag 완화가 치명도를 올린 것으로 보이며, 방향 자체는 두 PM의
의도된 변경이라 문제 삼지 않는다). 유파/감정 작업을 시작하기 전에 이 숫자를 **새 기준선**으로 한 번
더 굳히고(`characters_eval.mjs rr`도 다섯 캐릭터로 재확인), 그 위에서 감정 파일럿(공포) 하나만 얹어
다시 재는 순서로 진행하겠다.

## 감독님께 확인 요청

1. 이 단계 구분(2단계=유파 꾸러미, 3단계=감정 파일럿 1개부터)에 동의하시는지.
2. 무기 PM 세션/브랜치를 어디서 찾을 수 있는지(현재 `claude/pm-weapons` 없음) — 없다면 제가 임시로
   `docs/school_emotion_proposal.md`의 스키마를 기준 계약안으로 먼저 공유해도 되는지.
3. 캐릭터 PM(본 세션)이 2·3단계 구현을 이어 받는 것으로 확정할지.
