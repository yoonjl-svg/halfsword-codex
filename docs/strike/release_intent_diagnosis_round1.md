# Q04 입력 종료·자동 복귀 진단 1차

2026-10-02. **최초 목표속도 반전은 release 전용 중앙 복귀에서 시작되지 않았다.** 실제 롱소드/츠바이핸더 down/up의 네 쌍 모두 hold와 release에서 똑같이 .725초에 필터 목표와 손목 목표속도가 반전했다. 중앙 복귀는 .800초에 시작했고 실제 손/검 목표의 release↔hold 차이는 down .825초, up .833333초에 처음 생겼다. 새 후보·gain·기본 제어 변경 없이 입력 경로의 최초 원인을 확인했다.

기준 HEAD `86a9fa06e64bd216f8952b4f3f2ef6754f18a6f1`. [metrics](release_intent_diagnosis_round1_metrics.json)에 전체 소스/엔진 SHA, 타임라인, 실제 토크 요청 성분, 적용 토크, 명시적 경로별 일과 검 중력 일을 보존했다. [probe](../../tools/sim/experiments/release_intent_diagnosis_probe.mjs)는 기존 Fighter의 `driveSword`/`manualMuscle`를 임시 모듈에 복제하고 read-only 계측을 붙인다. core·기존 도구·이전 Q04 산출물은 수정하지 않았다.

## 실제 실행과 동일 조건

건강 8조건 = 무기 2 × 방향 down/up × release/target_hold. 각 조건에 계측 없음/있음 대조를 더해 16행을 실행했다. 실제 `G.step`/Rapier/Fighter·준비 legacy 그립 3초·측정 paired 그립·drag .55초·종료 관찰 1.2초·seed7을 유지했다. 관찰 전후 native/controller/요청 입력, 전체 기존 physical/control trace와 매 스텝 native snapshot trace가 모두 exact였다. 계측 dispatch는 각 행 `driveSword`/`manualMuscle` 210회였다. hold↔release 네 쌍도 시작 상태·요청 drag·전체 drag native trace가 같았다. 유한값/sourceStable 모두 통과했다.

아래 시각은 **준비 뒤 측정 시작을 0으로 한 pre-physics control 시각**이다. post-physics sample 시각은 한 스텝(.008333초) 뒤다. 입력 종료는 .550초부터 `inputActive=false`, release는 `handHeld=false`, hold는 true다. handOffset은 그 뒤 실제 게임 제어가 수정하는 값을 그대로 기록했다. 충돌/상처/결투/휴대폰 검증과 사람의 자연스러움 판정은 아니다.

## 최초 반전의 유한 시퀀스

네 쌍에서 이 순서가 동일했다.

1. .541667초: 마지막 drag. follow의 y 성분은 down −.105m/up +.105m, 필터 aimVel은 −/+1.77140m/s였다.
2. .550초: `swinging=false`, 손/anchor는 마지막 입력 위치를 유지한다. follow가 −/+ .102123m로 줄고 `aimRaw=anchor+follow`가 입력 방향의 반대로 이동하기 시작한다. 자동 중앙 복귀는 아직 false다.
3. .716667초: 필터 aimVel은 down −.001016m/s/up +.001016m/s다.
4. .725초: 필터 aimVel이 down +.018467m/s/up −.018467m/s로 반전한다. 같은 스텝의 손목 목표 각속도도 마지막 drag 방향의 반대로 바뀐다. **hold와 release의 손 목표·검 목표·명시적 제어·실제 물리 상태가 이때 같다.**
5. .800초: release만 `recovering=true`와 실제 handOffset 이동을 시작한다. 이 이동은 `Skill.update`의 aimRaw/filter 계산 뒤에 쓰인다. hold에는 이 복귀가 없다.
6. .808333초: release의 raw 입력 속도가 반전한다. 입력 dead radius로 anchor는 아직 유지된다.
7. .825초(down)/.833333초(up): anchor·필터·손/검 목표·어깨/손목 요청·실제 응답에 release↔hold 차이가 처음 나타난다.

hold는 필터/이어베기 목표를 동결하는 명령이 아니다. 손가락을 유지해 중앙 복귀는 막지만 follow 감쇠는 유지하므로, 추가로 밀린 목표가 되돌아오는 .725초의 반전은 hold에서도 생긴다. 코드 추측이 아니라 같은 native 상태에서의 두 종료 조건과 실제 수치로 확인했다.

## 어깨 상대 회전과 손목 월드 회전을 구별

어깨 `wT`는 가슴 상대 quaternion 목표의 속도를 월드 좌표로 표현한 값이다. 실제 parent omega를 더한 `wT+ωchest`는 원하는 위팔 월드 각속도의 작은 시간간격 근사다. 손목 `wAim`은 원래 월드 방향 목표의 차분을 현재 blade 축에 수직으로 투영한 값이다. 근사/투영을 native 모터의 실제 일로 바꾸지 않는다.

반전은 마지막 drag 6프레임 목표 각속도의 평균 방향에 내적한 값이 −.001rad/s보다 작아진 첫 프레임으로 정의했다. 어깨의 상대/월드 근사 비교는 **같은 어깨 기준 축**을 쓴다.

| 무기 / 방향 | 어깨 상대 목표 최초 반전 s | 그때 상대 / 가슴 / 월드 근사 rad/s | 손목 목표 최초 반전 s |
|---|---:|---:|---:|
| longsword/down | .658333 | −.004780 / +.043781 / +.039001 | .725 |
| longsword/up | release 1.075; hold 1.191667 | release −.045112 / −.844064 / −.889176 | .725 |
| zweihander/down | .591667 | −.263854 / −1.158872 / −1.422726 | .725 |
| zweihander/up | .733333 | −.336069 / −.045809 / −.381878 | .725 |

롱소드 down의 최초 어깨 상대 반전은 월드 목표의 반전이 아니다. 가슴 속도를 상쇄한 결과 상대 목표가 음수가 되어도 월드 근사는 아직 +.039001rad/s다. 다른 조건은 IK/가슴 응답이 섞이고 시점도 달랐다. 몸통 보상 전체를 제거할 근거로 쓰지 않는다. **네 쌍 공통의 입력 반전 원인은 follow/filter이고, 월드 손목 목표에서 같은 .725초에 확인된다.** 어깨만의 zero-twist 감쇠 수정으로 이 상위 입력 경로를 해결할 수 없다.

목표속도 토크 요청의 부호와 최종 토크도 같지 않다. .725초 롱소드 down에서 손목의 목표속도 항은 마지막 drag 축으로 −.2053Nm지만 실제 손목 토크는 +.9546Nm다. 어깨는 목표속도 항 −6.2472Nm/실제 −4.2782Nm였다. 츠바이핸더 down은 손목 −.2082/−9.9576Nm, 어깨 +3.2292/+45.7845Nm였다. 위치오차·실제 각속도 감쇠·중력 FF·Hill 한도·twist를 함께 거친 벡터이므로, 목표속도 항만으로 실제 제동 일을 단정하지 않는다.

## 복귀 이후의 추가 회전과 명시적 일

.550≤t<.800초의 경로별 일은 hold/release가 모두 exact였다. 그 뒤 .800≤t<1.050초의 결과는 아래와 같다. 값은 **hold→release**, 명시적 경로에서 반작용 강체를 포함한 signed midpoint 순 일이다.

| 조건 | 어깨 경로 J | 손목 경로 J | 손목 목표속도 RMS rad/s |
|---|---:|---:|---:|
| longsword/down | −1.695→−7.373 | +.364→+6.540 | .190→3.569 |
| longsword/up | −1.458→+2.453 | +.232→+1.975 | .017→.978 |
| zweihander/down | +.262→−7.588 | −.060→+6.320 | .190→3.569 |
| zweihander/up | −6.308→+.898 | +4.772→+7.228 | .017→.977 |

복귀의 영향이 손목에 더 많은 양의 순 일을 요청/실행하는 조건은 확인했지만 총 제동 개선/악화로 일반화하지 않는다. 롱소드 up의 1.050≤t<1.750초 손목 순 일은 hold −.850→release +31.471J였다. 같은 구간 츠바이핸더 up의 검 COM 중력 일은 −.315→+41.041J다. 검 높이 경로가 바뀌므로 중앙 복귀의 에너지를 모두 근육 토크로 돌릴 수 없다.

| 조건 | 종료 blade axis 누적 이동 rad, hold→release | 관찰 끝 검 K J, hold→release |
|---|---:|---:|
| longsword/down | .3724→1.3440 | .000196→.003806 |
| longsword/up | 1.3687→3.8523 | .002696→1.072406 |
| zweihander/down | .9722→2.0840 | .000553→.017150 |
| zweihander/up | 1.7543→4.3739 | .344997→.297315 |

츠바이핸더 up은 종료 회전 경로가 늘면서도 끝 K는 줄었다. 누적 axis 이동량은 정지 거리나 순 회전량이 아니며 release는 자유 비행이 아니다. native elbow/관절/contact 전체 일은 미측정이다. 관찰기의 손목/어깨 요청 성분은 Hill/cap 전 값과 최종 적용값을 구별했고, 현재 기존 명목 예산을 유지했지만 두 종료 조건에 동일 수치 토크 시퀀스를 강제한 대조는 아니다. 검 물성·관찰/engine 계약은 앞선 [Q04 1차](body_input_transfer_round1.md)와 exact SHA로 재사용했다.

up hold에서는 입력 필터의 움직임이 작아도 어깨 목표속도가 커지는 별도 문제가 남는다. 츠바이핸더 up hold의 1.050≤t<1.750초 어깨 목표 RMS는 상대 8.011/월드 근사 7.960rad/s인 반면 손목 목표 RMS는 .012rad/s다. 이를 자동 복귀나 몸통 counterrotation 하나로 환원하지 않는다. IK/몸통 되먹임의 다음 별도 분리 관찰이 필요하다.

## 다음 최소 구현 표적과 재현

다음 구현 표적은 `Skill.update`의 **hold 종료에서 follow를 바로 감쇠시키는 전환**이다. 향후 격리 후보 한 가지로 `handHeld=true`, 실제 drag 종료·`swinging=false`에서 현재 follow/aimRaw 끝점을 잠시 유지하고, 다음 실제 입력 또는 회복에 들어가면 정상 경로로 돌아오는 끝점 latch를 비교한다. 현재 진단에서는 구현하지 않았다. 첫 down/up hold 두 조건에서 입력 재개 연속성·도달 가능성·같은 수치 어깨/손목 예산을 확인한 뒤 확장한다. 기존처럼 어깨 gain을 키우거나 상대 목표속도를 0으로 보내는 수정은 이 첫 원인에 대응하지 않는다. latch가 up hold의 큰 IK 목표속도나 전신 전달을 해결한다고 미리 주장하지 않는다.

원자료 `/workspace/halfsword-hybrid-evidence/q04-release-intent-r1.json`, SHA256 `bfacac9877f661d3b28f78cebcd8746d8cdf027523391cb82af149509d4cfdbb`. 최종 물리 배치 벽시계 7.44초이며 하드웨어 성능 배수 주장은 없다.

```sh
node tools/sim/experiments/release_intent_diagnosis_probe.mjs /workspace/halfsword-hybrid-evidence/q04-release-intent-rerun.json
```

기존 출력은 덮어쓰지 않는다. Q04는 입력 전환의 최초 경로를 좁혔으며 일반 채택 후보와 실제 충돌/모바일 수락은 여전히 미완료다.
