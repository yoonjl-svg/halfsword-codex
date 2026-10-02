# 기립 인계 중 발의 하중 확인 — 독립 연구 2차

공개 지지 연구판은 계속 철회 상태다. 이 실험은 실제 게임의 Gait를 임시 모듈로 복제해 같은 자연 누움 checkpoint 이후에만 개입한다. 게임 소스·일반 설정·공개 URL을 변경하지 않는다.

## 가설과 개입

기존 코드의 catch 걸음은 reach/air 조건과 F→B 순서로 발을 고르고, 일반 walk에 있는 하중 인계 확인을 건너뛴다. `levH=1`일 때 정지 중 중심 유지 보정은0이며 catch는 sway에서도 제외된다. 이는 발을 들기 전에 체중을 옮기는 절차가 부족할 가능성이지, 모든 재넘어짐의 원인 확정은 아니다.

- `catchLoad`: 기존 reach/air 후보 중 실제 비지지 발을 우선하고, 지지 여부가 같으면 직전 native solver의 수직 투영 하중이 작은 발을 고른다. 선택한 발에 하중이 실려 있고 상대 발이 기존 `liftLoad=.35`의 체중 몫을 아직 받지 못하면 들기를 유예한다.
- `catchPreload`: 같은 유예 중, 지지 중인 상대 발의 대표 접점 쪽으로 기존 `want`에 COM 위치 보정을 더한다. 기존 `holdGain`과 보정분0.3m/s 상한을 사용한다.
- `nativeCatchPreload`: 위 후보에 연구 1차의 실제 모터 비활성화 helper를 함께 적용한다.

새 Gait 발 선택·하중 유예·중심 보정은 `levH>0`인 stand 인계 기간에만 작동한다. 인계 시간이 끝나면 기존 보행이 다시 제어한다. 조합된 native helper는 checkpoint 이후 upright 요청 전반을 처리한다. 기립 상태를 고정하거나 실패 판정을 늦추는 변경은 없다. 지지 하중은 직전 solver 결과이며 다음 순간의 지지 능력이 아니다. 대표 접점은 압력중심(COP)이 아니다. 0.3m/s는 새 보정 성분의 상한이며, 뒤따르는 기존 중심 유지 보정과 합친 최종 속도·힘의 상한이 아니다.

## 증거의 범위

건강/앞다리 controller health .45, longsword, seed7, B(.1/on/1), paired, 각25초. 실제 상처·입력 중 공격·다양한 누움 방향으로 확대하기 전의 선별 실험이다. 같은 입력·native world·controller checkpoint 일치, 보관된 original 전체 궤적 일치, 수정 없는 cloned Gait의 projected 대조 궤적 일치, 소스 불변과 접촉 미끄럼 표본 존재를 필수 관문으로 둔다. 관찰용 game geometry는 인간 자연스러움 판정이나 제어 문턱이 아니다.

## 실행 여부 검증을 먼저 고친 이유

이전 prototype 교체 방식은 force-ledger가 객체에 설치한 own 메서드 wrapper 뒤에 가려져 후보를 실행하지 못했다. 첫 contactAir 실험과 이번 첫 catch-load 12행(wall79.964초)은 후보 효과 판정에서 제외한다. 궤적 exact·동일 native 상태·소스 해시가 모두 맞아도 개입 코드 실행을 증명하지는 못했다.

계측기의 `replaceObservedMethod`는 경로 wrapper를 유지한 채 실제 호출 함수를 교체하고, idle 상태·소유 wrapper·undo 순서를 검사한다. 수정 없는 복제본도 모든 실제 메서드를 교체하고 update 호출 횟수를 검증한다. load 후보는 변환된 함수 몸체 내부의 recoveryLoadProbe 실행까지 확인한다. 직접 native motor 호출을 가로챈 연구 1차 모터 대조는 이 결함의 영향을 받지 않는다.

관련11개 검사와 실제 게임240프레임의 계측 on/off 궤적 exact를 확인했다. 실패한 실행 기록은 삭제하지 않고, 이전 보고·지표의 판정을 명시적으로 정정했다.

## 실행을 확인한 대조 결과

| 후보 | 건강 재넘어짐 | 손상 재넘어짐 | 손상 최대 COM 상향속도 | 손상 최장 native 접점 부재 | 판단 |
|---|---:|---:|---:|---:|---|
| 투영 축력 대조 | 0 | 3 | 1.192m/s | 0.100초 | 기존 실패 |
| 접촉 air만 | 0 | 1 | 1.668m/s | 0.183초 | 부분 변화·보류 |
| 하중 선택+보류 | 0 | 4 | 6.889m/s | 1.308초 | 기각 |
| 하중 선택+보류+중심 보정 | 0 | 4 | 6.889m/s | 1.308초 | 기각 |
| 앞 후보+실제 모터 끄기 | 0 | 6 | 1.279m/s | 0.200초 | 기각 |

손상 catchLoad와 catchPreload는 전체 궤적 exact이며 유예/preload 실행 횟수 모두0이다. 따라서 실패를 중심 보정의 효과로 귀속하지 않는다.5.983초 선택이 F→B로 달라진 뒤 실패했고, 최고 골반2.832m·관절 간격27.90mm·최대 운동에너지4,166.9J가 나왔다. 최종 stand와 무관하게 기각한다. native 조합은25초에도 getup이며 기립 기하 충족 구간0이므로 채택하지 않는다.

발 목표 투영도 실제 발 거리와 나눠 측정했다. 손상 첫 catch에서 앞발 hip→실제 ankle .770m와 hip→plant .867m, plant 오프셋 .099m였다. 뒷발 실제 거리도 .735m였다. plant 보정만 지워도 긴 실제 다리 배치가 해소된다고 볼 수 없다.

뒤이은 실제 모터 끄기+contactAir 조합은 건강/손상 모두 nativeGate 단독과 전체 궤적 exact였으며 재넘어짐0/1을 유지했다. 서로의 효과가 더해지는 새 개선은 아니었다.6행에서 실행 관문·원판/동일 checkpoint 관문·소스 불변을 다시 확인했다.

## 발 선택을 유지한 추가 분리

하중이 작다는 이유로 강한 다리를 먼저 들어 버리는 실패를 분리하려고 `selectByLoad=false` 대조를 추가했다. `catchHold`는 인계 중 접촉 air 보정을 유지하며 기존 F→B 선택으로 되돌린 뒤 하중 유예를 더하고, `catchShift`는 그 위에 중심 보정을 더하며, `nativeCatchShift`는 실제 모터 끄기까지 적용한다. 기존 보행 인계 시간과 실패 판정은 그대로다.

손상 조건은 각각 재넘어짐2/2/2회다. 앞 두 후보의 COM 상향 최고1.761m/s·최장 native 접점 부재.250초, native 조합은1.148m/s·.167초였다. 실제 유예는 각1회, 중심 보정은 해당 두 후보에서 각1회였다. 마지막 연속 기립 기하 구간은9.942/9.942/10.817초이며 모두25초 종료 stand였다. 그래도 재넘어짐과 접점 부재가 남고 native 단독의 손상1회보다 나빠, 새 후보를 채택하지 않는다. 건강 조건도 재넘어짐0만 유지할 뿐 접점 부재가 늘었다.

## 판정과 다음 실행

현재 결과로 공개할 새 회복 후보는 없다. 실제 비활성화 helper는 유효한 별도 수정 후보지만, 재넘어짐·짧은 도약까지 해결했다는 뜻은 아니다. 공개 게임·철회 URL은 이전 상태를 유지한다.

다음은 기립 시간/관찰 높이 문턱이나 하중 수치를 더 맞추는 작업보다, 최초 발 선택 분기→첫 재넘어짐→에너지 급증을 기존 원자료로 연결하고 관절 모터의 감쇠·목표속도를 포함한 총회전력 한계를 분리하는 작업이다. `j.max`만으로 실제 총모터 토크가 제한됐다고 간주하지 않는다. 발의 추가 질량이 인계 중 바뀌는 경로도 분리해야 한다. 낮은 자세의 손/무릎 지지에서 실제로 발을 몸 아래로 모으는 제어는 아직 구현·검증되지 않았다.

```sh
node tools/sim/force_ledger.test.mjs /tmp/force-ledger-tests.json
node tools/sim/experiments/recovery_control_probe.mjs --variants=projected,cloneGait,contactAirborne,catchLoad,catchPreload,nativeCatchPreload --out=/tmp/recovery-load.json
node tools/sim/experiments/recovery_control_probe.mjs --variants=projected,nativeContactAirborne --out=/tmp/recovery-native-contact.json
node tools/sim/experiments/recovery_control_probe.mjs --variants=projected,catchHold,catchShift,nativeCatchShift --out=/tmp/recovery-shift.json
```

실행을 검증한 배치는14행93.741초,6행40.837초,10행67.604초다. 반복 대조를 독립 표본으로 세지 않는다. 소스 해시·실행 관문·실패 수치·대조 궤적·원자료 해시는 [지표 파일](support_recovery_load_round2_metrics.json)에 보존한다. 파일당 수백 MB의 원자료는 저장소 밖 로컬에 남아 있으며 외부 백업을 확인한 것은 아니다.
