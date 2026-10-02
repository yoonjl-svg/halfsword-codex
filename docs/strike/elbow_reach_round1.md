# 팔꿈치 radial 입력 후보 1차 · 기각

[팔꿈치 진단](elbow_coordination_round1.md)이 확인한 보정 꺼짐의 고정 flex를 해결하려고 연구 전용 매핑 하나를 구현했다. 여섯 베기의 실제 팔꿈치 목표 변화를 만들었지만, **모든 stroke의 적용 손 목표 추종 오차·종료 검 K가 늘고 5/6 stroke의 종료 회전량이 늘어 채택을 기각한다.** 입력 경계에서도 native flex 제한을 넘는 목표를 요구했다. 재튜닝이나 일반 연결·엔진 교체·build·배포 없음.

[후보](../../tools/sim/experiments/elbow_reach_candidate.mjs), [실제 비교 도구](../../tools/sim/experiments/elbow_reach_probe.mjs), [요약·SHA·판정](elbow_reach_round1.json). 실행 기준 HEAD는 `7b72c4e3bc4a50fc56786362de6509c9d2270757`이며 디렉터의 모바일 입력 통합 뒤 worktree를 별도로 동결했다. 진단과 비교하면 input/main/cut_trial source SHA가 다르며 JSON의 실제 sourceBefore/After로 구분한다. `fighter/config/skill`·npm 엔진은 진단과 같다. 이 실행을 앞 진단과 완전히 동일한 모든 소스라고 주장하지 않는다.

## 단일 가설과 실제 관문

기존 shoulder→hand 요청 방향은 유지하고 radius만 바꿨다. 실제 native 연결 길이 .300+.265m에서 기존 slack .005m를 빼 `.560m`를 사용했다. `d = max(.08, .560*sqrt(max(0,1-(|skill.aim|/.62)²)))`로 중앙 입력은 뻗고 바깥 입력은 접는다. radial 궤적 가설이며 상완/전완에 외부 각속도나 추가 힘을 주지 않는다. 보정0·thrustPose.w0에서만 `armIK` 앞에 설치했다. Native 관절/모터·강도·gain·torque 설정·검 방향 계산 코드는 유지했다. 원래 손 요청과 실제 적용한 손 목표는 모든 호출에 따로 저장했다. 적용 목표가 가까워져 끝 hand error가 줄어도 원래 입력 도달 성공이라고 점수화하지 않는다.

sabre/zweihander × down/up/cross × target_hold/release의 **12조건×baseline/observe/candidate=36 실제 실행**, 별도 nearboundary6 실제 실행을 수행했다. 준비3초/drag.55초/종료1.2초·seed7·dt1/120·paired 측정/legacy 준비는 기존 계약이다. 후보 설치 순간 native snapshot 불변, 준비 native/controller·요청 입력 exact, original-forward observer trace exact, 매행 실제210 armIK 개입, shoulder→hand 방향 dot≥1−1e−10, source/엔진 동결·유한값 관문을 통과했다. 실행PASS는 가설 수락이 아니다. Cheap3행은 중복이며36행에 포함하지 않는다.

칼 방향 설정을 직접 수정하지 않았지만 변경된 손/몸의 feedback 때문에 실제 world desired axis/controller trace는 **12/12조건에서 baseline과 달랐다.** 따라서 ‘완전히 같은 실제 칼 방향 목표 아래 순수 팔 효율 비교’라고 해석할 수 없다. 동일 외부 입력 아래 변경된 손 경로의 비교다. native solver/constraint/contact work 미측정이며 실제 ledger 명시적 signed midpoint work만 별도로 보존했다.

## 동작과 종료 반례

아래 hold 행의 stroke와 종료 결과는 release 행과 정확히 같았다. 외부 종료 handHeld 분기는 다르지만 이 OFF 입력 경로의 측정 궤적은 같으므로 독립 성공/실패 표본으로 두 번 세지 않는다. peak는 drag 구간만, hand error는 **후보가 바꾼 적용 목표** 기준이다. Axis travel은 입력 종료 뒤 blade axis 누적 회전이고 끝 방향 오차와 다르다.

| 무기/방향 | peak tip m/s | stroke max hand error m | 종료 axis travel rad | 끝 검 K J | 끝 blade aim error rad |
|---|---:|---:|---:|---:|---:|
| sabre down | 8.2895→8.8181 | 0.1070→0.2526 | 0.1698→0.3707 | 0.0000→0.0902 | 0.0022→0.0031 |
| sabre up | 7.5086→7.9174 | 0.0904→0.2796 | 0.5095→0.6772 | 0.0000→0.0899 | 0.0003→0.0015 |
| sabre cross | 6.3041→6.5881 | 0.1330→0.2126 | 0.2489→0.4482 | 0.0000→0.0941 | 0.0021→0.0023 |
| zweihander down | 10.7328→11.4709 | 0.2349→0.2527 | 0.3983→0.2613 | 0.0005→0.0360 | 0.0145→0.0213 |
| zweihander up | 8.2946→9.5951 | 0.4058→0.5092 | 1.0461→1.4843 | 0.0105→1.1716 | 0.0611→0.0421 |
| zweihander cross | 7.2877→8.0040 | 0.1912→0.2145 | 0.6200→0.8721 | 0.0004→0.1878 | 0.0800→0.0204 |

검끝은 여섯 stroke 모두 +.284–1.301m/s 빨라졌지만 적용 손 목표 최대 오차도 여섯 모두 +.018–.189m 늘었다. 종료 K는 여섯 모두 +.0355–1.1611J 늘었다. 츠바이핸더 down은 axis travel이 .137rad 줄었지만 끝 방향 오차가 .00682rad 늘고 K도 증가해 전체 제동 개선이 아니다. 츠바이핸더 up은 끝 방향 오차가 줄었지만 종료 이동량과 에너지가 크게 늘었다. 속도·끝 error 중 유리한 하나만으로 수락하지 않는다.

Sabre down target flex .381–2.019rad에 대해 실제 flex는 −.0016–.800rad였다. Native 관절을 건드리지 않아도 새 mapping의 준비 시점 목표 변경과 추종 지연을 감당하지 못한다. 후보를 같은 native 준비 상태에서 즉시 설치하므로 첫 목표 차이도 비교의 일부이며, 이 차이를 제거한 phase-continuous 후보는 구현/검증하지 않았다. 전체 stroke native anchor gap 최고 .001171m로 새 발사·수치 폭주가 실패 원인은 아니었다. 팔꿈치 목표가 움직인다는 것만으로 사용자 의도/정지 품질을 해결하지 못했다.

## 입력 경계 검사

각각 새 sabre OFF 게임을 중앙 입력으로 3초 준비하고, 실제 held handOffset을 normalized reach `.96/.989/(1−1e−8)/1/(1+1e−8)/1.04`로120스텝 주었다. 측정 동안 직접 aim/속도·몸 위치를 설정하지 않았다. 여섯 모두 actual bodies 유한값, ±1e−8 조건의 최종 radius/target은 연속이었다. 입력 파이프라인이 실제 필터 radius를 약 .600m까지로 제한하는 동작도 남겼다. 한 프레임 적용 목표 이동 최대는 .03682–.03859m이며 처음 설치 때 원래→후보 목표 차이는 별도 raw records에 있다.

하지만 normalized .989는74/120프레임, 1±1e−8/1/1.04는82/120프레임에서 **target flex>native2.5rad**였다. 최고2.652rad다. 순수 기하식도 radius가 .08m에 붙으면 현재 IK(.300/.270)가 flex2.880rad를 요청해 native 한도를 넘는다. sqrt 근처의 기울기는 최소 radius clamp로 유한/연속이 되지만 clamp 무릎은 미분 불연속이다. 유한성과 연속성만으로 적절한 관절 목표라고 판정하지 않는다. 자기 충돌이 꺼져 있어 팔/가슴 관통을 실제 차단하는 후보도 아니다.

## 다음 재개 위치

이 가설을 채택하거나 gain을 높이지 않는다. 다음 작은 연구는 `현재 실제 elbow flex/shoulder tracking`에서 시작하는 연속 입력 목표와 native flex 제한을 동시에 맞추고, 기존 검 방향 요청과 손 endpoint의 양립성을 먼저 확보하는 것이다. 최소 radius를 실제 joint max/길이로 계산하는 것이 필요하지만 그것만으로 초기 목표 단절·별도 검 방향/손 경로의 간섭이 해결되지는 않는다. 먼저 원래 요청·실제 적용 목표·목표속도의 첫 반례를 유지해 그 연결을 설계한다. 고정 타이밍 투구 애니메이션이나 자유 두 강체 native 교체로 건너뛰지 않는다.

재현(기존 출력 덮지 않음):

```sh
node tools/sim/experiments/elbow_reach_probe.mjs --level=0 --out=/tmp/elbow-reach-rerun.json
```

원자료 `/tmp/elbow-reach-round1.json`, 실행벽시계27.824초. SHA256·정확한 실제 source manifest·명령은 JSON에 있다. 이후 도구에 git-label 출력 메타데이터를 보탠 변경은 원자료의 실행 SHA와 구별된다. native cap 마지막 substep 검사는 이번 npm 경로에 없으며 합성/실제 부상·상대 충돌·모바일 사용자 체감은 미실행이다.
