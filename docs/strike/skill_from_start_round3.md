# 첫 물리 스텝부터 검술 보정을 끄는 계약 · 3차

2026-10-02. **처음부터 off(level0/autoGuardfalse)로 시작한 실제 게임은 이번18개 약(.4)과의 비교 모두에서 종료 뒤 원래 raw 입력의 평균·최종 각오차와 축 이동량을 줄였다. 생성부터 설정하는 선택형 후보의 첫 물리 관문을 통과했다.** 일반 기본값·core·엔진·공개 게임은 변경하지 않았다. 팔꿈치 후보와 결합한 검증, 실제 전투·휴대폰·사용자 수락은 별도다.

기준 HEAD `c810e06d09365687e101d146f9610fc8748385b3`. [도구](../../tools/sim/experiments/skill_from_start_probe.mjs), [수치·전체 소스/엔진 hash·원자료 SHA](skill_from_start_round3.json). 저장소 밖 원자료는 `/workspace/halfsword-hybrid-evidence/skill-from-start-round3.json`, SHA256 `3bae8355c18419f0a6c6f5e4a822c5c3e5fd09216afc85be9a4a020218e3c0e7`이다.

## 실제 실행과 동일 조건

actual Fighter/Skill/Gait/Combat·설치된 Rapier를 실행했다. **sabre/zweihander × 내려/올려/수평 × hold/release/재입력 × weak/off =36조건**, 조건마다 관찰 없는 기준 실행을 더해72행이다. root의 별도 팔꿈치 후보나 native 엔진은 연결하지 않았다.

`newRound`의 실제 skill 옵션으로 .4 또는0을 전달했고, autoGuard true/false와 sharedCap·paired grip·budgeted cut을 **첫 G.step 전에** 설정했다. 초기 raw 손 위치/필터도 외부 시작 위치에 맞춘 뒤3초 준비했다. 모든 설정은 측정 중 유지했다. 상대를 멀리 옮겨 접촉0이다.

- 내려 `[.02,.52]→[.02,-.45]`, 올려 반대 방향, 수평 `[-.42,.03]→[.42,.03]`. `cross`라는 기록 이름은 y=.03이 고정된 실제 수평 입력이다.
- 첫 drag .55초 뒤 hold/release는1.5초 관찰한다. 재입력은 .4초 hold→.35초 역방향 drag→.75초 hold이며, 마지막 stop 구간을 종료 지표로 계산한다. 앞선 pause의 이동을 마지막 stop 값에 더하지 않는다.
- 외부 입력 경로·handHeld/inputActive는 weak/off18쌍 exact다. 두 설정의 최초 native 상태도 exact지만 **준비 뒤 native/controller는 모두 다르다.** 각각의 보정으로 생긴 정상 자세 차이를 보존한 from-start 비교이며 동일 준비 상태의 순간 제거 실험이 아니다.
- 각 설정별 관찰 유무36쌍은 첫 native·준비 native/controller/전체 준비 trace·외부 입력·측정 **전체 native snapshot/직렬화 controller trace**가 exact다. 소스 전체/엔진/probe/HEAD 전후 동결·설정/난수 복구·finite를 통과했다. 관찰이 게임 제어를 바꾸지 않는 대조다.

벽시계94.91초, 준비와 대조를 포함한 시뮬레이션363.6초였다. 매 step 전체 native snapshot 해시 비용을 포함하며 개발 속도 배수나 독립 표본수로 해석하지 않는다.

## 원래 입력과 실제 칼의 종료 응답

원래 입력 오차는 기존 보정 없는 `guardDir` 매핑을 **외부 요청 위치**에 적용하고, stop 동안 마지막 위치를 유지하여 실제 칼 축과 비교한다. 후보가 자동 복귀로 바꾼 현재 목표의 `ownAimError`도 따로 저장했다. 현재 body yaw/시작 world yaw 두 기준을 기록했다. 이 raw 기준은 명시적인 비교 계약이며 인간의 의도 각도 전체를 입증하는 것은 아니다.

아래 각 값은 **약→처음부터off**, 이동과 각오차 단위는 rad다. 누적 축 이동은 정지거리·비틀림 총량·끝 방향 오차와 다르다.

| 무기·방향 | 종료 | 마지막 stop 축 이동 | 원래 입력 평균 각오차 |
|---|---|---:|---:|
| sabre 내려 | hold | .504→.173 | .056→.018 |
| sabre 내려 | release | 1.234→.173 | .513→.018 |
| sabre 내려 | 재입력 | 1.218→.849 | .182→.111 |
| sabre 올려 | hold | .737→.510 | .148→.073 |
| sabre 올려 | release | 2.568→.510 | .826→.073 |
| sabre 올려 | 재입력 | 1.048→.277 | .093→.024 |
| sabre 수평 | hold | 1.645→.223 | 1.321→.033 |
| sabre 수평 | release | 4.585→.223 | .923→.033 |
| sabre 수평 | 재입력 | 3.905→.382 | 1.335→.037 |
| zweihander 내려 | hold | .701→.401 | .070→.042 |
| zweihander 내려 | release | 1.520→.401 | .515→.042 |
| zweihander 내려 | 재입력 | 1.659→1.309 | .340→.227 |
| zweihander 올려 | hold | 1.318→1.062 | .224→.123 |
| zweihander 올려 | release | 3.640→1.062 | .887→.123 |
| zweihander 올려 | 재입력 | 1.641→.909 | .198→.098 |
| zweihander 수평 | hold | 2.557→.760 | .862→.066 |
| zweihander 수평 | release | 4.747→.760 | .810→.066 |
| zweihander 수평 | 재입력 | 2.446→.768 | .713→.095 |

재입력12조건 모두 정확히 한 번 역방향 입력에 들어갔고 첫 재입력 frame의 held/active와 요청 위치를 확인했다. off에도 기존 anchor/aim filter와 근육 제어가 남아 목표를 즉시 고정하거나 각속도를 강제로0으로 만들지 않는다. 두 무기 모든 행의 종료 state는stand, 관찰된 down 진입은0이었다.

`ownAimError`가 모든 조건에서 좋아진 것은 아니다. 예를 들어 sabre 내려 hold는 평균 .00983→.01234rad, zweihander 내려 hold는 .02737→.03782rad였다. 각 설정이 만든 서로 다른 목표에 대한 오차이며, 원래 raw 입력의 평균·끝 오차가 줄었다는 별도 결과를 대체하지 않는다.

## 에너지·관절 간격·비틀림의 반례

측정 구간의 peak sword K와 body+sword K, native 관절 anchor gap은18쌍 모두 off에서 줄었다. 이는 에너지 효율·피해 증가·제동 전체 해결의 증거가 아니다. 기존 발 질량 변경을 포함한 실제 동적 신체·검의 snapshot K이며 native 전체 일은 측정하지 않았다.

**끝 sword K가 늘어난 재입력 반례를 보존한다.** zweihander 내려 재입력은 .3927→.4601J, 올려 재입력은 .08942→.11709J였다. 두 조건 모두 원래 입력의 평균·끝 각오차와 축 이동량은 줄었지만 끝 에너지까지 일괄 개선한 후보는 아니다. 느린/무거운 검의 도달과 제동 잔류는 root 팔꿈치 후보와 함께 후속 비교할 범위다.

준비까지 포함한 최대 native gap은 약2.132mm/off2.117mm. sabre 수평의 전체 최대는1.565→2.117mm로 늘었다. **이 증가를 숨기지 않되, 측정 구간의 증가로 잘못 읽지 않는다.** 같은 조건의 측정 구간 최대 gap은 .897→.454mm이고, off의2.117mm 최대는 저장된 측정 frame 밖인 준비 구간에 있다. 원자료 run summary는 준비 peak를 포함하며 `measurementOnlySummaries`는 저장된 측정 frame만으로 따로 산출했다.

[2차](skill_interference_round2.md)의 같은 상태 .7→0 전환에서 나온 zweihander 수평32.80rad/s/.075초 peak는 이번 from-start 측정에서 나오지 않았다. off 최대는24.72rad/s/.758초이며 그때 **twist24.721/swing .209rad/s**다. 단, 다른 준비/입력의 실행이므로 두 peak 차이를 설정 전환 하나의 순수 효과로 환산하지 않는다.

off에서도 비틀림은 남는다. sabre 수평 hold의 omega peak는 약19.76→off22.995rad/s로 오히려 커졌다. off peak(.675초)는 twist22.988/swing .593rad/s로 대부분 blade 축 비틀림이다. 같은 조건의 종료 축 이동과 원래 입력 오차는 줄었다. 따라서 ‘모든 회전을 낮췄다’고 선언하거나 검 축 회전과 날 세우기를 혼동하지 않는다.

## runtime 적용 권고와 남은 관문

첫 물리 검사는 **생성부터 off인 선택형 연결**을 진행할 근거가 된다. 테스트한 계약은 `targetCorrection=none` 선택 라운드의 첫 physical step 전에 플레이어 `skill.level=0`, `skill.autoGuard=false`를 적용하고 끝까지 유지하는 것이다. root가 실제 runtime·URL/설정 연결을 별도 구현할 수 있으나 이 보고서가 연결·배포 완료를 뜻하지 않는다.

- 터치 감도·화면 좌표 매핑·기존2cm anchor dead radius·입력 목표 필터는 유지한다. 자동 authored 손/검/몸 목표 조향을 제거하는 것과 ergonomic 입력 보정을 제거하는 것은 별개다.
- 상대 AI level, 전역 followGain, 근력/cap/물성/기본 native 모터를 바꾸지 않는다. 현재 숫자와 실제 동작으로 비교했고 gain이나 속도 제한을 숨겨 넣지 않았다. 일반 기본값 승격은 아직 하지 않는다.
- 라운드 중 설정 전환으로 남아 있는 bodyPose/필터 상태를 끊기보다 다음 라운드 생성에 적용한다. 탭 찌르기는 기존 명시적 입력 명령으로 level0에서도 유지한다.
- **level0는 모든 자동 행동 off가 아니다.** `src/skill.js:499`의 짧은 한손 `enterParry`는 level과 무관하게 `gait.requestStep`를 부른다. sabre는 해당 경로의 실제 충돌/상대가 있는 검증이 이번에 없다. 완전 수동 이동을 제공하려면 별도 옵션 계약으로 분리해야 한다.

다음 실제 수락 관문은 root 팔꿈치 후보와의 개별/결합 비교, 실제 충돌·부상·받아내기, 재입력과 tap, 모바일 입력/브라우저 초기 설정·새 라운드 적용 확인이다. 이 단계의 일반 조작감·인간 자연스러움·전신 물리 해결이나 사용자 장면 재현을 주장하지 않는다.

이 작업은 신규 tool/report/metrics만 작성했다. src/core·공용 도구·엔진은 수정하지 않았고, 빌드·commit·원격 작업·상대 신규 자료 열람은 수행하지 않았다.

```sh
node tools/sim/experiments/skill_from_start_probe.mjs /workspace/halfsword-hybrid-evidence/skill-from-start-round3-new.json
```
