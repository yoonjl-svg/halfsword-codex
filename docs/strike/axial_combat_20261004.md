# 전투 급회전 분리 · 2026-10-04

게임 목적은 의도된 무게·관성을 살리면서 손 입력 밖의 비인간적 급회전을 줄이는 것이다. 시작04:26 UTC, 예상30–45분, 기준 `f2601a89b7e3bc205af1b5b8fd2fba543b3c6ebe`. 기존 양손 B/일반 코드·손 모양·npm 엔진은 유지했다. 실제 두AI seed7, 보정.7, player axial/상대 longsword, 동일 prefix 뒤 mono4.45/light6.091667초부터 분리했다.

## 확인과 판정

- 두 무기의 관찰10초 native snapshot/전체 trace와 기존 원자료가 exact다. Mono4.541667초는 검 접촉0, 길이축34.496→50.930rad/s가 native physics에서 생겼다. 손목 twist는 −.743Nm로 제동했고 보조손 직접 축토크는 약.000004Nm였다. Combat 후속 단계에서 추가 회전은 없었다. Light6.125초에는 실제 검/골반 접촉이 있어 별도 장면이다.
- 중력 보상 축 성분 제거는 충분한 해결이 아니었고 날 정렬 제거는 더 악화됐다. 현재120Hz의 고정축 감쇠식 자체는 안정 범위다. 전체 관절/접촉/회전 적분의 안정성을 뜻하지 않는다.
- Mono의 같은 native checkpoint는 원래 한 스텝과 exact다. 관절 제거는50.930→−14.132rad/s, world torque 유지한1/4 step은188.465, 보조손 torque만 body 회전에 따라 운반하면24.174였다. **관절 결합과 횡토크의 유한 스텝 운반에 민감함**을 확인했다. 뒤 두 모델은 고정된 제어 출력의 진단이며 실제 개선판/수렴 증거가 아니다. 축회전 감소도 전체 회전 에너지 감소와 같지 않았다.

| 실제 제어·AI·접촉을 재계산 |120Hz→240Hz→480Hz 구간 최대각속도 |
|---|---|
| Mono |112→57→54rad/s|
| Light |82→140→63rad/s|

동일 prefix 이후 접촉·상처·AI 분기가 달라지므로 전체 구간을 같은 상태 효능으로 비교하지 않는다. Mono에서 줄었지만 Light는 단조 수렴하지 않았고 모바일 성능/사람 수락도 검사하지 않았다. 엔진 결함 확정이나 일반 dt 변경을 승인하지 않는다.

**작은 후보 기각:** 현재 각속도로 예측한 반 스텝 공통 힘점에 양쪽 속도·±힘을 함께 평가했다. Mono의 무접촉·무상처 초기구간 축회전 최고84.382→129.977rad/s로 악화했다. Light도 개선 근거가 없었다. 공개 버튼/런타임 flag로 추가하지 않으며 추가 gain/예측점 탐색을 권하지 않는다. 순간 damper 소산·순 applied wrench0만으로 전체/이산 소산을 주장하지 않는다.

## 실증 경계와 재현

Light의 contact snapshot fork는 원래 스텝을 재현하지 못해 **분기 해석 전체를 제외**했다. 최초 재계산 루프는 `faceTarget` 두 갱신을 빠뜨려 parity가 깨진6행을 제외하고 보존했다. 정정 후 두 무기120Hz 전체 trace가 원래와 exact다. 총 채택 자료21행/고유진단조건16, 제외6행이며 관찰·동등성 반복/one-step fork를 새 효능 표본으로 세지 않는다. Native motor/constraint/contact angular impulse·총일과 gyroscopic 적분 폐합은 미완료다. 높은 얇은 축 각속도만으로 과도한 에너지나 사람 관성 결함을 확정하지 않는다.

원자료·당시 도구 byte·독립 검토·크기/SHA·판정은 [수치 지도](axial_combat_20261004.json), 원래 공개 B는 [전달 영수증](startup_grip_release.json)을 따른다. 저장소 밖 원자료를 덮어쓰지 않았다. 현재 도구는 실제 Fighter/AI/Combat/native를 쓰며 아래처럼 실행한다.

```sh
node tools/sim/experiments/axial_combat_probe.mjs --out=/tmp/axial-observe.json --modes=observe --seconds=10
node tools/sim/experiments/axial_combat_probe.mjs --out=/tmp/axial-transport.json --weapons=monohoshizao --modes=observe --seconds=4.6 --forks=on
node tools/sim/experiments/axial_combat_probe.mjs --out=/tmp/axial-dt.json --modes=recomputeOriginal,recomputeHalf,recomputeQuarter --seconds=10
```

반 스텝 예측점과 제동 제거는 실패/진단 경로로만 보존한다. 다음은 이미 검증된 native 팔꿈치 한도/중력 공유 후보의 빠진 실제 전투를 선별한다. 관절 재생성·자유 두 강체 교체·실패 지지/절삭 후보를 되살리지 않는다.
