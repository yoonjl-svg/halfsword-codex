# 인수인계서 · AI 검객 전술 개선 세션 → 무기·검술 연구 세션

- 작성: 2026-09-27, AI 전술 세션(`claude/pm-ai-tactics`) 종료 시점
- 대상: 무기 제원·검술(유파) 연구를 잇는 세션
- 관련 브랜치: `claude/pm-ai-tactics`(감독 검토 대기, 6커밋), `claude/pm-characters`(캐릭터 PM), `claude/pm-weapons`(무기 PM)
- 손댄 파일: `src/ai.js`만. `ai_sense.js`, `ai_techniques.js`, `config.js AI_LEVELS`는 읽기만 했고 바꾸지 않았다.

---

## 1. 한 줄 요약

AI 검객의 여섯 가지 약점(돌진형 상대에 약함, 방어 판단 매 스텝 재굴림, 접근 중 느린 손, 약한 이어치기, 읽히는 속임수, 무릎 꿇으면 무저항)을 `src/ai.js` 안에서만 고쳐 밀어 넣었다. 회귀 기준(passive/aiai/fights12)은 유지 범위 안. 그 과정에서 **"AI가 무기·유파에 어떻게 묶여 있는가"**를 파악했고, 이것이 다음 세션의 출발점이다.

---

## 2. 무기·검술 연구에 직접 쓰일 정보 (가장 중요)

### 2.1 AI가 롱소드에 묶인 지점 — 무기가 바뀌면 깨지는 순서

| 위치 | 내용 | 무기 바뀌면 |
|---|---|---|
| `ai.js` `MEASURE` | `contact 1.62`(베기가 머리·목에 닿는 거리), `reach 2.0`(한 걸음 내디디며 닿는 거리 = 위험 반경), `clinch 1.25`, `cutTime 0.3`(베기 시작→닿기까지) | **가장 먼저 깨진다.** 간격 판단(holdDist, contactDist, canChain, seize, threat 반경)이 전부 여기서 나온다. 무기 길이·질량마다 실측해 다시 넣어야 한다 |
| `ai_techniques.js` `TECH[].reach` / `base` | 기술마다 닿는 거리 보정과 "믿을 만함" 점수. 주석대로 **가만히 선 상대(자세 6가지)에게 거리별로 물리로 쳐 본 결과**로 정한 값 | 무기별로 같은 실험을 다시 해야 한다. 절차: 자세 6 × 거리 여러 개 × 기술 → 적중/막힘 비율 |
| `ai_techniques.js` `G`, `WATCH_GUARDS`, `FEINTS` | 패드 좌표로 적힌 리히테나워 자세·기술·속임수 | 유파 꾸러미로 분리할 대상 |
| `ai.js` `PARRY` | 들어오는 줄(highL/highR/highC/lowL/lowR/thrust) → 막는 손 위치. 주석: 공격 5 × 자세 13을 물리로 부딪쳐 고른 값 | 무기별 재실험 필요 |
| `ai.js` `counterTech()` | `'zornhauL' / 'oberhau' / 'zornhau'` 이름을 직접 부른다 | 유파화하려면 "맞받아 베기 역할" 기술 목록으로 바꿔야 한다 |
| `ai.js` `pickTech()` | 빈틈 코드(UL/UR/LL/LR/C/H)와 `presses`/`fast`/`kind` 플래그로 고른다 | **무기 무관.** 유파가 기술을 이 스키마로 기술하면 그대로 쓴다 |
| `ai.js` `threat()` | 칼끝·타격점 속도 3.5 m/s 이상, 0.45초 안에 가슴 축 0.55m 원통에 닿는가 | 짧은 무기·찌르기 무기에서는 임계값 재검토 |

### 2.2 유파 = 무기에 묶인 꾸러미 (제안, 캐릭터 PM에 전달됨)

```
school = {
  weapon: 'longsword',            // 무기 종류 — 꾸러미 선택 키
  guards:  WATCH_GUARDS,          // 간 볼 때 자세
  tech:    TECH,                  // 기술 (open/kind/reach/base/presses/fast 스키마 유지)
  feints:  FEINTS,
  parry:   PARRY,                 // 줄별 막기 자세
  counter: ['zornhauL','oberhau','zornhau'],  // 맞받아 베기 역할 (지금은 counterTech에 하드코딩)
  measure: { contact, reach, clinch, cutTime }, // 무기 실측값
}
```
- 숙련도 = 기술별 배율(성공 편차 noise, 챔버 속도, 읽기 정확도). "같은 유파, 다른 깊이."
- `ai.js` 쪽 리팩터는 작다: import된 TECH/PARRY 대신 `this.school.*`을 읽게 하고, `counterTech()`의 이름 직접 호출을 역할 목록으로 바꾸는 두 곳.
- 데이터 계약: **캐릭터 시트 → pers + 유파 id + 숙련도 + 감정 문턱값**, **무기 제원 → measure + 유파 꾸러미 선택**. AI는 일반화된 채로 읽기만 한다.

### 2.3 AI가 이미 가진 "성격" 손잡이 (캐릭터 데이터가 채울 자리)

`ai.js` 생성자 `this.pers`: `margin`(간격 여유 0.2~0.5m), `aggr`(0.85~1.2), `circleDir/circleRate`, `rhythm`(자세 바꾸는 박자 2.4~4.5s), `vor`(달려드는 상대를 맞받는 성향 0.15~0.6), `patienceTime`(7~12s), `guardPref`, `techPref`. 지금은 판마다 무작위. 이걸 데이터에서 읽으면 그대로 "인물"이 된다.

원시 감정: `hurry()`의 `cautious`(상대가 피 흘리면 기다림), `desperate`(내가 지면 서두름). 바보 자세 -0.12 유인은 교활함의 원형. 감정층 5개(공포·분노·집념·자포자기·교활함) 제안은 캐릭터 PM 세션에 표로 전달했다(§6 참고).

---

## 3. 이번 세션에서 바꾼 것 (브랜치 `claude/pm-ai-tactics`, 커밋 순서대로)

| 커밋 | 약점 | 변경 | 근거 |
|---|---|---|---|
| `2ea5d1c` | #2 방어 게이트 재굴림 | `attack()` windup/approach의 `Math.random() < L.read`가 매 물리 스텝 재실행 → `noticedThreat()`로 threat id당 1회 | 0.3초 베기 동안 ~36번 굴려 실질 확률 ≈ 1 |
| `2a73364` | #3 접근 중 느린 손 | `fastChamber = opt.fastChamber \|\| this.quick` — recover/stepin/press/counter/stop/follow 공격은 parrySpeed로 챔버 | seize()·follow가 fastChamber를 안 넘기고 있었다 |
| `98b25c3` | #4 약한 Nachschlag | `canChain` 하한 `clinch+0.1`(1.35m) → `clinch-0.5`(0.75m), 헛친 뒤 확률 0.3→0.4배 | 밀려서 간격이 좁아진 뒤엔 이어치기가 아예 안 나갔다 |
| `9f3f8b3` | #5 읽히는 속임수 | `feintHold` 0.14 고정 → `clamp(0.16 - 0.08*read, 0.06, 0.16)` | 숙련될수록 빨리 다시 챔버 |
| `87093a7` | #1 돌진형 | `preThreat()` charging 판단 `pers.vor` → `max(pers.vor, foeAggro*0.75)` | 계속 몰아치면 성격과 무관하게 맞받는 쪽으로 |
| `06dfddf` | #6 무릎 꿇으면 무저항 | `down`만 왕관 자세 가리기. `getup/kneel`은 위협 오면 막고, contact+0.15 안이면 0.3~0.6s마다 `0.5*read` 확률로 짧게 찌르기, 아니면 긴 자세로 겨눔. 발은 0. `gaitStep()`도 stand일 때만 | fighter.js가 getup/kneel에서 팔·쥐기를 이미 허용 |

**버린 것**: withdraw 중 옆걸음(off-line step). 직관과 달리 aggro를 더 나쁘게 만들었다(사거리 안에 더 오래 머묾). 측정 후 제거.

---

## 4. 최종 수치 (seeds 1~4, normal)

| 지표 | 기준선 | 최종 | 허용 범위 |
|---|---|---|---|
| passive 처치 시간(s) | 10.1 / 35.9 / 40.3 / 31.9 | 10.8 / 37.1 / 41.3 / 19.9 | 20~30s 근방, 즉사 아님 ✅ |
| aiai clinch 비율 평균 | 2.35% | **4.18%** | "낮게 유지" — 기준선보다 높음 ⚠️ |
| aggro AI 적중 vs 피격 합계 | 67 vs 108 (지는 교환) | **82 vs 68 (이기는 교환)** | 뚜렷한 개선 ✅ |
| aggro 승/패/무 | 1 / 1 / 2 | 2 / 2 / 0 | — |
| fights12 사망 | 7/12 | **9/12** | 6~9 ✅ (상한) |
| fights12 넘어짐/판 | 2.3 | 2.0 | — |

- aiai clinch 4.18%는 Nachschlag 완화 때문. 완화를 되돌리면 2.8%로 돌아오지만 aggro가 네 시드 모두 패배로 뒤집힌다. 우선순위 #1이 돌진형 대응이라 완화를 유지했다. **감독 판단 필요.**
- 8시드로 넓히면 aggro 승패는 4-2-2 → 4-4-0으로 평평하다(적중비는 비슷). 시드별 결과는 카오스적이라 개별 시드 비교는 신뢰하지 말 것(§5.1).

---

## 5. 인사이트 — 다음 세션이 알아야 할 것

### 5.1 이 시뮬레이션은 카오스계다
- `Math.random()` 호출 **횟수**가 하나만 바뀌어도 같은 시드의 전투가 통째로 갈린다. 로직 한 줄 바꾸면 시드별 결과는 재현 불가.
- 그래서 **단일 변수 A/B는 잡음에 묻힌다.** 이번에도 개별 revert 실험이 9/12, 11/12, 12/12로 흔들렸다. 판단은 4시드 합계(적중 비율, 승패 합)와 fights12 총합으로만 할 것.
- fights12는 시드 고정이라 "같은 코드 → 같은 결과"는 보장된다. 회귀 기준선을 남기려면 코드 해시와 함께 기록하라.

### 5.2 무기별 실측이 먼저다
- `MEASURE`, `TECH.reach/base`, `PARRY`는 전부 **물리 실측값**이지 이론값이 아니다. 새 무기(에스톡·츠바이핸더 등, `claude/pm-weapons`에서 quick-test 진행 중)는 같은 절차로 표를 다시 만들어야 AI가 거리 판단을 한다. 이론 리치를 넣으면 헛베거나 몸으로 부딪친다.
- 실측 도구: `tools/sim/harness_m.mjs`로 두 파이터를 세우고 `eval_m.mjs passive`의 `GUARDS`처럼 상대를 고정 자세로 세운 뒤 거리·기술을 스윕하면 된다. 별도 스크립트는 없으니 만들어야 한다(§7).

### 5.3 "인간 같음"은 손잡이가 아니라 굴절이다
- 이번 개선이 잘 먹힌 이유는 새 행동을 추가한 게 아니라 **이미 있는 판단의 확률·속도·거리 문턱을 상황에 따라 굴절**시켰기 때문이다(foeAggro → stop-hit, quick → fastChamber). 감정층·유파도 같은 방식으로 얹는 게 안전하다.
- 굴절은 한 번에 하나씩 넣고 §4의 네 지표를 다시 재라. 두 개를 동시에 넣으면 무엇이 회귀를 냈는지 알 수 없다(실제로 겪음).

### 5.4 "낮은 자세" 문제는 AI 쪽 보수성이었다
- `fighter.js`는 getup/kneel에서 팔·쥐기를 허용하고 있었다(`muscle`이 getup 중 0.35→1 회복, grip 조건에 kneel/getup 포함). AI가 스스로 손을 묶고 있었을 뿐. **엔진 제약이라고 짐작하지 말고 fighter.js를 먼저 읽을 것.**

### 5.5 난이도 계층의 기존 이상 (내가 만든 게 아님, `git stash`로 확인)
- `hard`가 aggro 돌진형에게 `easy`보다 **더** 못 싸우는 시드가 있다(기준선 hard seed1: 공격 1회, apm 3.1 — 거의 얼어 있음). 내 변경 후 hard의 활동량은 apm 55로 올랐지만 승패는 그대로 진다. 원인 미조사. 유파·숙련도를 난이도에 얹기 전에 봐야 할 문제.
- passive에서 easy가 hard보다 빨리 죽이는 시드도 기준선부터 그렇다(discipline↑ = 간격 유지 = 느린 마무리). 설계 의도로 보이나 "난이도 = 처치 속도"가 아니라는 점을 유파 설계에 반영할 것.

### 5.6 seed 8 aggro는 AI 적중 0
- 기준선과 최종 모두 seed 8에서 AI가 유효 타격을 **한 번도** 못 냈다. 특정 CUTS 조합·타이밍에서 AI 공격이 전부 무효 판정되는 코너 케이스. 무기·판정 연구 쪽에서 볼 가치가 있다.

---

## 6. 캐릭터 PM 세션에 이미 전달한 내용

1회성 Routine(`trig_01ExvMPAARoWDSGh3Y1Wevow`)으로 `session_01HSrct4UE9qVgfTi4hd59qi`("PM · 상대 캐릭터 5인 창조")에 보냈다. 내용: §2.2 유파 꾸러미, 감정 5개 표(공포/분노/집념/자포자기/교활함 — 트리거·굴절 손잡이·tell), "지배 감정 하나 + 세기 + 감쇠" 구조, 데이터 계약, 회귀 주의. 컨펌은 감독에게 회신하도록 요청했다. **무기 PM과의 계약 조율 주체는 미정** — 이 세션이 그 역할을 맡는 것이 자연스럽다.

---

## 7. 보완이 필요한 것 (우선순위순)

1. **무기별 실측 스크립트** `tools/sim/measure_weapon.mjs`(가칭): 상대 고정 자세 × 거리 × 기술 스윕 → `MEASURE`와 `TECH.reach/base` 표 출력. 무기 로스터가 늘면 손으로는 못 한다.
2. **`ai.js` 유파 주입 리팩터**: `this.school` 도입, `counterTech()`/`PARRY` 역할화. 기능 변화 없이 롱소드 꾸러미를 그대로 옮기는 것부터. fights12가 7~9/12에서 안 움직이면 성공.
3. **aiai clinch 4.18% 판단**: 감독이 허용하지 않으면 Nachschlag 하한을 0.75→0.95m 사이에서 재탐색. -0.3 시도에서는 차이가 없었으니 1.0 이상에서 찾아야 한다.
4. **hard 난이도의 aggro 얼어붙음**(§5.5) 원인 조사. `preThreat`의 `preArmed` 재장전(0.3s 조용해야 함)이 쉬지 않는 상대에게 한 번만 발화하는 구조가 의심된다.
5. **stopBias 효과 검증**: aggro 스크립트에서는 `charging` 분기가 사실상 안 밟혀 결과가 비트 단위로 동일했다. 실제 플레이어 돌진(속도 프로필이 다름)에서 재확인 필요. 해가 없어 남겼다.
6. `gaitStep()`은 지금 죽은 코드(`me.gait` 없음). 다리 재작업이 들어오면 `state !== 'stand'` 가드가 살아난다.

---

## 8. 재현 명령

```bash
npm install
node tools/sim/eval_m.mjs passive          # seeds 1~4, normal
node tools/sim/eval_m.mjs aiai
node tools/sim/eval_m.mjs aggro
node tools/sim/eval_m.mjs aggro new hard 1 8   # 시나리오 ai 난이도 시드범위
node tools/sim/fights12.mjs
TRACE=1 node tools/sim/eval_m.mjs aggro new normal 1 1 15   # 스텝별 모드/거리/손 위치
```
기준선이 필요하면 `git stash` 후 같은 명령. 기준선 커밋: `23dda69`.

---

## 9. 무기·검술 세션 통합 판정 (2026-09-27, `claude/pm-weapons`에서 흡수)

이 인수인계서는 `claude/pm-weapons` 세션이 이어받았다. 위 §3의 여섯 수정은 모두 `origin/main`에
이미 들어가 있어(merge-base `06dfddf`, main의 `ai.js`가 그 위에 유파·감정층을 얹은 상태) 다시 손대지
않는다. 아래는 §2·§5·§7 항목마다 "이미 해결됨 / 이 세션이 맡음 / 다른 담당"을 갈라 둔 것이다.
이미 다른 쪽에서 해결되거나 새로 판정된 항목은 재작업하지 않고 과정 기록으로만 남긴다.

| 항목 | 상태 | 근거 |
|---|---|---|
| §2.1 `MEASURE` 무기별 재실측 | **해결** | `tools/sim/weapon_measure.mjs`로 18종 실측, `docs/weapons.md` §2. 캐릭터 PM에게 전달됨 |
| §2.1 `TECH[].reach` 무기별 재실측 | **이 세션이 맡음 → 도구 완성** | `tools/sim/weapon_tech_reach.mjs`. §9.1 참고 — 절대값은 kinematic 방법으로 안 나오므로 "롱소드 원래 값 + 무기 차이"로 낸다 |
| §2.1 `PARRY` 무기별 재실험 | 미착수 (다른 담당 우선) | 유파가 롱소드 하나뿐인 지금은 필요 없음. 무기별 유파를 만들 때 캐릭터 PM 요청으로 진행 |
| §2.1 `counterTech()` 역할화, `pickTech()` 스키마 | **해결(캐릭터 PM)** | main `schools.js`의 `counter`/`tech` 꾸러미로 이미 분리됨 |
| §2.1 `threat()` 짧은 무기 임계값 | 미착수 | 무기 밸런스(§4 docs/weapons.md)에서 짧은 무기가 5~10%대로 약한 원인 후보. 유파 통합 뒤 재검토 |
| §2.2 유파 꾸러미 제안 | **해결(캐릭터 PM)** | `src/schools.js`, `docs/school_contract.md`가 그 제안 그대로. 무기 PM 쪽 계약 조율은 이 세션이 맡아 `docs/weapons.md`로 회신 중 |
| §2.3 성격 손잡이 → 캐릭터 데이터 | **해결(캐릭터 PM)** | main `characters.js` persona, 감정층(fear/anger/obsession) |
| §4 aiai clinch 4.18% 판단 | 감독 판단 대기 | 이 세션은 건드리지 않는다(ai.js는 캐릭터 PM 소유) |
| §5.1 카오스계, 시드 개별 비교 금지 | **채택** | 무기 밸런스도 25판×2방향 합계로만 판단한다(`weapon_balance.mjs`). 엑스칼리버 복제품 "차이" 오판 사례가 같은 원인이었다(한 프로세스에서 판 여럿을 만든 뒤 돌리면 난수가 섞인다) |
| §5.2 무기별 실측 우선 | **채택·완료** | 위 measure·tech reach 도구 |
| §5.4 엔진 제약 짐작 금지 | **채택** | — |
| §5.5 hard가 aggro에 얼어붙음 | 미착수 (ai.js 소유자) | `preArmed` 재장전 의심은 캐릭터 PM에게 전달 |
| §5.6 seed 8 aggro AI 적중 0 | **원인 판명 — 판정 버그 아님** | §9.2 참고 |
| §7.1 실측 스크립트 | **해결** | `weapon_measure.mjs` + `weapon_tech_reach.mjs` |
| §7.2 ai.js 유파 주입 | **해결(캐릭터 PM)** | main 1bad77e |
| §7.6 `gaitStep()` 죽은 코드 | 확인만 | main에 hybrid gait가 들어와 `me.gait` 존재 가능 — 캐릭터 PM 몫 |

### 9.1 기술별 reach 실측 방법의 한계 (검증 결과)

`weapon_tech_reach.mjs`를 롱소드로 돌려 원래 `TECH[].reach`(개발자가 실제 충돌로 정한 값)와 견주면
**절대값은 맞지 않는다**: 횡베기(zwerch)는 머리 높이 띠를 몸 가까이서만 지나 −1.06(원래 0), 찌르기는
팔을 다 뻗은 순간까지 세면 +0.40(원래 +0.10)이 나온다. 상대 몸과 실제로 부딪히는 판정(칼날 어느
지점이 닿는지, 막히는지)이 빠져 있어서다. 그래서 무기별 값은 `원래 TECH.reach + (무기 reachCorr −
롱소드 reachCorr)`로 낸다 — 롱소드 보정은 개발자 실측을 그대로 믿고 **무기가 바뀌어 생긴 차이만**
얹는다. 실제 충돌 기반 스윕(고정 자세 6 × 거리 × 기술)은 §5.2가 말한 대로 별도 스크립트가 필요하고,
1차 시도에서 몸 흔들림 때문에 단조롭게 안 나왔던 문제(`docs/weapons.md` §2)를 먼저 풀어야 한다.

### 9.2 seed 8 aggro "AI 적중 0"의 원인

`TRACE=1 node tools/sim/eval_m.mjs aggro new normal 8 8`로 보면 **1.70초에 플레이어의 첫 베기가 AI의
칼 든 팔에 123 J(severity 1.07)로 꽂힌다.** 그 뒤 AI의 공격 13회는 전부 6~24 J 둔기 접촉으로 끝난다 —
팔 부상으로 근력이 깎여 칼이 실리지 않는 것이지, 특정 CUTS 조합이 판정에서 무효 처리되는 코너
케이스가 아니다(판정 코드는 정상 동작). 즉 "부상은 실제로 싸움을 바꾼다"는 설계가 작동한 결과다.
남는 질문은 AI 쪽: 칼 든 팔을 다쳤을 때 자세·기술을 바꿀지(한손 무기로 취급, 찌르기 위주 등)는
캐릭터 PM의 감정층·유파 설계에 넘긴다.
