# 실제 팔 절상 뒤 재입력 · 공개 B 후속 검사

2026-10-05 KST, 기준 `376d79159d1f3ab2e16eb44b0ea980009082bb84`. 목적은 **다친 뒤에도 다시 베기를 요청할 수 있는지, 의도된 힘 저하와 오류를 구분하는 것**이다. 사용자는 “최근 테스트는 둘 다 b가 낫다. 하지만 짧은 플레이였기 때문에 내가 오류를 잡아내진 못했을 수 있어.”라고 평가했다. 최근 두 비교판 선호로 기록하며 정확한 URL은 재명시되지 않았다. 오류 검증 완료·일반 승격 승인이 아니다. [수치·입력·해시·독립 감사](injured_input_20261005.json).

legacy/box 청강검 실제 절상 tick1535까지 새 두 실행의 native/controller/input/events **1536프레임 exact**, 기존 양쪽 post-Combat 관찰도 exact다. 다음1536부터 플레이어 AI만 중단하고 손 떼기→반전→hold→다시 베기→release와 발 스틱0을 공급했다. 실제 상처·몸·힘 한도·기존 Skill/자동 내딛기는 보존했다. autoGuard는 AI에서 가져온 false이며, 실제 main의 true를 바꾼 시험이 아니다. 따라서 자동 가드 귀환 수락으로 읽지 않는다.

| 다친 팔 입력 | 손 목표 오차 peak → 종료 |
|---|---|
| 손 떼기 .30s | .0977 → .0269m |
| 반전 .25s / hold .25s | .4633 → .0837m |
| 다시 베기 .25s / release .45s | .2959 → .0778m |

새 베기 계수7→8→9, 실제 상대 상처가 생겼고 NaN/관절 소실은 없었다. 그러나 뒤 접촉 중 축 회전72.79rad/s가 남는다. 이것을 정상 관성·인간 동작으로 수락하지 않는다. 서로 다른 손/발 명령과 상처 이력을 원래 AI보다 낫다는 효능 비교로 쓰지 않는다. 목표/cap은 마지막 pre-native 요청, 몸/건강은 post-Combat이다.

**공개 찌르기 A/B 후속:** 생성부터 현재 manual/profile과 기존/transported를 켜고 기존9초 각1080 native hash exact 뒤20초까지 탭·release·recut를3회 더 했다. B는4탭 모두 수락, 주팔 기능1 유지, 실제 흉부 상처 뒤 getup/사망은 관측했다. B에는 주팔 손상·tap 거절/down/bound/abort가 없어 그 관문은 미완료다. 후속 무접촉 recut 축속도26.36rad/s·탭 손 오차 최대.6914m·관절 gap3.98mm가 남는다. A는 실제 주팔 절상9.808333초 뒤 tick1177/9.816667초에 기능.3386, getup12.833→15.058초를 보였다. 접촉/AI/건강 분기 뒤 생존시간·peak를 상대 효능으로 바꾸지 않는다.

**판정:** [접촉 형상](https://yoonjl-svg.github.io/halfsword-codex/feature-lab.html#blade-shape-comparison)과 [찌르기](https://yoonjl-svg.github.io/halfsword-codex/feature-lab.html#thrust-plane-comparison) 선택형 공개를 유지한다. 이번 게임·손·엔진·일반 기본값 변경0, 회복 활성 후보 공개 보류다. 새 실행4행은 legacy 부상/기존 공개 전투의2문맥이며 prefix 반복은 독립 효능 표본이 아니다. 기존6회귀와73src 동일을 확인하고 물리는 중복 수행하지 않았다. 원자료는 외부이며 checkout만으로 reference를 제공하지 않는다.

```sh
node tools/sim/experiments/onehand_injured_input_probe.mjs --out=/tmp/NEW-injured.json --reference=/workspace/halfsword-handoff/recovery-selection-20261005/current-observed-run03.json
node tools/sim/experiments/thrust_followup_probe.mjs --out=/tmp/NEW-followup.json --reference=/workspace/halfsword-handoff/precontact-thrust-20261004/production-live-run06.json
python tools/sim/experiments/summarize_injured_input.py --injury=/tmp/NEW-injured.json --followup=/tmp/NEW-followup.json --out=/tmp/NEW-metrics.json
```

run01 실행 원도구를 외부에 보존했다. 이후 alive gate/실패 검증 flag만 정정했고 당시 전 프레임 alive이므로 물리를 재실행하지 않았다. 미실행 death 분기의 수락은 없다. 도구의 실행 SHA와 현재 SHA는 JSON에서 구분한다.

**다음30–45분:** 방금 확보한 manual/profile/기존 찌르기의 actual arm+getup prefix로 기존 회복 활성 후보를 **생성부터** 검사한다. 최초 실제 차이, 제동·발 지지·다음 입력을 보고하며 중간 활성/강제 부상·gain/seed 탐색은 하지 않는다. P-03/P-04 진행 중이고 전체2단계는 미완료다.
