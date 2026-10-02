# 실제 자세에서 이어지는 팔 목표 · 2차와 양손 후속

2026-10-03 KST. 사용자 지시 “1번은 기다리는 중이니 2번으로 이어가”에 따라 팔꿈치/검술 보정 간섭의 구현을 재개했다. **실제 자세에서 시작하는 연속 손 목표를 구현했으나, 양손검 횡베기의 추종·정지 후퇴로 런타임 채택하지 않았다.** 두 손 도달 범위와 목표 자세를 맞춘 후속도 같은 반례를 해결하지 못했다. 게임 src/core·근력·엔진·일반 기본값·공개판은 이 연구로 변경하지 않았다.

기준 HEAD `c810e06d09365687e101d146f9610fc8748385b3`. [수치·명령·실제 소스 해시·원자료 해시](elbow_continuity_round2.json). 본문 날짜는 KST이며 도구의 createdUTC는 UTC다. 이전 radial 후보의 파라미터를 재탐색하지 않았다. 새 근거는 첫 목표 단절, 실제 관절 길이, 양손의 서로 다른 목표 기준점이다.

## 구현과 첫 비교

[후보](../../tools/sim/experiments/elbow_continuity_candidate.mjs)와 [도구](../../tools/sim/experiments/elbow_continuity_probe.mjs)는 실제 Fighter/Gait/Skill/Combat/Rapier를 사용한다. 보정0 준비3초 뒤 same native/controller에서 개입한다. sabre/zweihander × 내려/올려/사선cross × hold/release × baseline/observe/candidate = **36실행**, 벽시계20.306초. 최초 down6행 smoke는 계측 확장 전 중복이므로 이 수에 더하지 않는다. cross는 [-.42,.25]→[.42,-.30]이며 보정3차의 y=.03 수평과 다르다.

첫 활성화 때 실제 상완 상대 회전과 native 범위 안의 팔꿈치 각도에서 FK 손 끝점을 얻고, 당시 원래 손 목표와의 차이를 가슴 좌표의 offset으로 저장한다. 이후 `Hrelative = Hraw + Qchest·offset`을 사용한다. 따라서 원래 yaw 기준 입력을 통째로 chest 추종으로 바꾸지 않는다. 이 offset은 hold/release/입력 pause에서도 유지한다. `inputActive` 상승마다 재설정하지 않는다. 해당 플래그는 렌더링 입력 delta 유무이며 제스처 시작이 아니기 때문이다. 보정/찌르기로 활성 경로를 벗어난 뒤의 재진입은 이번 측정 밖이다.

IK는 실제 anchor 길이 .300/.265m, native hinge0–2.5rad를 쓴다. 허용 반경은 .181226833–.565m이며 초기 실제 legal pose를 그대로 받아들이기 위해 기존 5mm 신전 여유를 사용하지 않았다. 이전 .560m slack 경계와 같은 값이라고 부르지 않는다. 고정 elbow pole 대신 실제 초기 굽힘 평면을 최소회전으로 운반한다. 신전 특이점의 fallback은 실제 상완 −Y 방향이다. 첫 목표의 이전 quaternion/prevRV를 실제 상대각속도로 역적분해 기존20/15rad/s feed-forward 제한을 유지한다. 첫 actual 자세 일치와 지속적인 C1 입력 매끄러움은 별개다.

기하/제어 개입은 손 목표·IK 목표·초기 target history뿐이다. native 몸 위치/속도·힘/근력·관절·질량·solver를 바꾸지 않았다. 초기 target/controller 쓰기를 native 불변으로 숨기지 않는다. 칼 방향 계산식은 유지했지만 몸 feedback으로 실제 world 목표 trace는 달라졌다. 동일 외부 입력 대조이며 완전히 동일한 실제 검 목표의 효율 비교가 아니다.

36실행 모두 prepared native/controller·외부 입력 일치, observer trace exact, 설치 native 불변, 210회 actual armIK, native target flex 한도를 통과했다. 첫 shoulder-to-actual 오차0, first flex 오차 약1e−6rad, 시작 속도 모두 기존 cap 이내였다. 최대 joint anchor gap은 원자료에 보존한다. 허공 베기이며 상대 접촉·상처·모바일·재입력의 수락은 없다. hold/release의 OFF 궤적 중복은 독립 베기로 세지 않는다.

## 개선과 기각 근거

팔꿈치 목표가 고정15.21도에서 실제 변화하는 목표가 됐다. 그러나 더 작은 적용 손 오차는 바뀐 가까운 목표에 대한 오차일 뿐 원래 손 요청을 더 잘 달성했다는 뜻이 아니다. 원래 요청→실제 손 오차도 별도로 기록했다.

| 무기/베기 | 종료 검 축 이동 rad: 기존→후보 | 끝 검 방향 오차 rad: 기존→후보 | 끝 검 K J: 기존→후보 |
|---|---:|---:|---:|
| sabre 내려 | 0.169795→0.167935 | 0.002215→0.000000 | 0.000014→0.000005 |
| sabre 올려 | 0.509531→0.506649 | 0.000315→0.000192 | 0.000019→0.000017 |
| sabre 사선 | 0.248946→0.252932 | 0.002140→0.000473 | 0.000038→0.000020 |
| zweihander 내려 | 0.398313→0.286298 | 0.014460→0.010199 | 0.000470→0.000450 |
| zweihander 올려 | 1.046094→1.062451 | 0.061104→0.053931 | 0.010492→0.006058 |
| zweihander 사선 | 0.620039→0.769079 | 0.079971→0.152861 | 0.000379→0.000580 |

수치는 위 JSON 원자료의 hold 행에서 생성하고 소수점6자리로 반올림했다. 검끝 속도나 실제 굽힘 범위가 늘었다는 것만으로 수락하지 않는다. 특히 양손 사선의 종료 이동+.149040rad, 끝 방향 오차+.072890rad가 실패 근거다.

양손 목표의 기하 진단: `Happlied + gripAlong·현재 desiredAxis`가 빈 어깨의 native 길이 annulus 밖인 프레임은 zweihander 사선에서 **기존 observe162→후보166/210**이었다. 이는 실제 offArmIK 요청의 실패 횟수가 아니라 두 손이 동시에 원하는 검 자세의 **필요조건 검사**다. 빈어깨 회전 제한은 포함하지 않는다. 실제 offArmIK는 `현재 sword.translation + gripAlong·desiredAxis`를 사용하며 그 거리도 별도 저장했다. 기준도 이미 대부분 도달 불가능하므로 이 진단만으로 후퇴 원인을 확정하지 않는다.

첫 probe의 raw `deltas.secondaryUnreachableFrames`는 baseline metric의 null을0으로 빼므로 유효 차이가 아니다. 원자료는 보존하고 비교에는 observe162→166(+4)를 쓴다. 후속 probe는 이 계산을 observe 기준으로 고쳤다. 독립 읽기 감사가 실제 데이터와 범위·복원 순서를 확인했다.

## 양손 도달 범위와 공통 목표 대조

[양손 후보](../../tools/sim/experiments/elbow_bimanual_candidate.mjs)·[도구](../../tools/sim/experiments/elbow_bimanual_probe.mjs): 주손 목표를 두 native reach ball 교집합의 가장 가까운 점으로 투영했다. 같은 스텝의 검 방향이 필요해 IK를 driveSword 끝으로 미룬다. **defer-only fulltrace가 기준과 exact**임을 먼저 확인했다. shoulder/hinge 안쪽 한도는 별도로 검사한다. 두손 연결이 물리적으로 접촉했다거나 어깨 제한까지 만족한다는 보장은 아니다.

zweihander 사선 hold의 baseline/observe/defer/relative(raw mode=candidate)/coupled **5실행**에서 실행 관문은 통과했으나, 도달 불가능 프레임0으로 바꿔도 종료 이동 .620→1.022rad, 끝 K .000379→.824882J로 악화했다. 기하 일치만으로 동역학 문제를 해결할 수 없어 즉시 선별 기각하고 무기/방향 전체 전수실행을 하지 않았다.

[공통 검 자세 후보](../../tools/sim/experiments/elbow_coherent_candidate.mjs)·[도구](../../tools/sim/experiments/elbow_coherent_probe.mjs)는 추가로 offArmIK의 원점을 actual sword.translation에서 같은 primary handTarget으로 바꿨다. 스프링의 실제 양쪽 작용점·힘·한도는 유지했다. 기존 경로가 두 팔에 서로 다른 원점을 요구한다는 소스 근거로 분리한 대조다.

동일 사선 hold의 앞5대조+coherent **6실행**에서 native/observer/defer 관문은 통과했다. coupled와 비교해 끝 K .824882→.051292J, 끝 방향 오차 .038087→.016397rad는 줄었지만 종료 이동1.022→1.261rad와 베는 중 최대 방향 오차 .206584→.377401rad가 늘었다. 기준 종료 이동.620rad와도 차이가 크다. 두 손을 같은 목표로 몰아주는 것 역시 후보로 채택하지 않는다.

5/6실행에는 앞선 대조의 반복이 포함되어 독립 성공 표본수가 아니다. 세 배치 합47실행은 실행비용 기록이며 서로 다른 외부 베기 입력은 첫 배치의6개다. 후속 두 배치는 그중 같은 양손 사선 반례의 후보/대조 확장이다. 운동에너지 감소는 모든 관절의 일·효율 측정이 아니다. native motor/constraint/contact work는 미측정이며 explicit ledger signed midpoint work만 기록했다.

## 다음 과제

- static endpoint 투영·공통 목표만 바꾸는 추가 파라미터 검색은 멈춘다. 근력 gain을 키우지 않는다.
- 현재 입력 목표와 실제 검 자세의 오차가 있을 때 주팔·빈팔·손목이 각각 어떤 방향의 힘/일을 요구하는지, 첫 후퇴 스텝의 실제 관절 반응과 함께 분리한다. 공통 목표 채택 자체를 해법으로 가정하지 않는다.
- 시작부터 검술 보정 none의 선택형은 별도 [3차](skill_from_start_round3.md)와 실제 충돌 회귀를 사용한다. 이 팔꿈치 후보를 그 옵션에 숨겨 결합하지 않는다.
- 실전/폰 수락 전 일반판에 연결하지 않는다. 자료·실패 후보·명령을 보존해 동일 가설의 반복 비용을 줄인다.

## 실행 뒤 메타데이터 정정

양손/공통 목표 probe의 초기 raw `limitations` 문자열에는 복사 원본의 “no enforcement”가 남아 있었다. 실제 실행은 mode coupled/coherent의 투영·빈손 목표 개입을 수행했으며 raw의 모드/targets/소스 manifest가 증거다. 실행 뒤 도구의 설명 문자열만 정정했고 재실행하지 않았다. raw의 실행 SHA는 과거 실행 파일을 나타내며 현재 probe 파일과 이 설명 변경만큼 다르다. 런타임/수치에는 영향이 없다.
