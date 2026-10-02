# Native 팔꿈치·입력 종료 선별 2차

Q03 첫 선별의 건강 **40행**, 실제 `applyWound` 호출 **10행**에서 준비·계측·실제 dispatch·기존 관절 보존 검사를 통과했다. cheap 3행은 같은 건강 츠바이핸더 내려베기/유지의 사전검사 중복이며 독립 표본으로 세지 않는다. **Q03 전체의 충돌·결투·모바일 검증은 미완료**다. Native 엔진·public/npm 의존성·제어 기본값을 바꾸지 않았다.

실행 HEAD는 `48c9c2bf054e52d0ae290ede682a8b9a95a522cb`, Fighter SHA256은 `f482ed5a00abaaa9acac837ddeefa0a6f9ea1f22c73c70aa74b4c0d41961d675`다. [기존 API 교정](native_motor_api_round1.md)의 엔진 SHA `a3be9d8361b386b0b664ee7ba771f14ae60e93eda9a4ab825f1de1260dbb5623`과 PASS 교정 파일·교정 소스 SHA를 확인하여 재사용했다. 엔진 재빌드 없음. 소스·임시 import 모듈·원자료 SHA와 50행 지표는 [metrics](native_elbow_followthrough_round2_metrics.json)에 있다.

[wrapper](../../tools/sim/experiments/native_elbow_followthrough_probe.mjs)는 기존 runStroke/harness의 엔진 import만 연결한다. 실제 Fighter/AI/Combat/G.step, 준비 3초·drag .55초·종료 관찰 1.2초·seed7·개입 후 paired 그립을 유지한다. 건강은 sabre/zweihander × down/up × target_hold/release, 상처는 두 무기의 down/target_hold만 검사했다. 유지/놓기는 입력 종료 뒤 handHeld=true/false이며, **놓기에도 정상 자동 중앙 복귀와 자세 회복이 남는다**. 순수 관성 비행이나 순수 제동이 아니다.

다섯 경로는 baseline, observe, nativeCap, explicitCap, combined다. 조절 항목은 기존 farmS native 한도와 기존 런타임 `armTorqueModel='sharedCap'` 두 개다. NativeCap은 기존 gravity FF를 같은 모터의 target bias 안으로 옮겨 한도를 공유하고 별도 elbowGravity 토크를 억제한다. ExplicitCap은 어깨·손목 최종 벡터 한도, combined는 둘의 결합이다. 외부 FF와 native 내부 FF는 제어적으로 동등한 구현이 아니다.

10조건 모두 개입 전 native snapshot·controller·요청 입력이 같았고, baseline↔observe 전체 기존 physical/control trace, 선택한 모든 동적 native 강체 ledger trace, 실제 controller trace가 exact였다. 각 행 driveSword/driveJoints 210회, native 경로 configure/readback 210회, nativeCap/combined FF 억제 210회가 실제 실행됐다. 중복 FF 0·같은 hinge handle/앵커/frame/limits 보존·유한값·진단 오류 0이었다. 건강 max gap .001949m/골반 높이 .899420m, 상처 max gap .000988m/골반 높이 .897798m로 새 수치 폭주 관문 없음. 이는 인간 동작 성공 기준이 아니다.

한도 readback은 **마지막 solver substep의 한 축 모터 충격량만** 판정한다. 건강 츠바이핸더 내려베기의 기존 cap 비 1.035303→1.000000007, 상처 츠바이핸더는 1.314916→1.000000089였다. 전체 스텝 충격량/일·passive limit 반작용·다른 관절 예산까지 제한했다고 말하지 않는다.

상처는 farmS cut severity=.6, energy=76J, bleedPerSev=ANATOMY.arm(.012), pass=true/passing=false인 **합성 입력을 실제 applyWound API에 전달**했다. severity/energy는 단위 품질·무기 배율에서 팔 문턱 22J+.6×90J에 대응한다. armS 직접 주입 없이 실제 호출로 1→.58, pain·balance·bleed·상처 목록이 변했다. 호출 순간 native 몸 상태 불변·관절 분리/무기 놓침 없음. **검의 실제 충돌로 생긴 상처가 아니다.**

아래는 baseline→nativeCap이다. Peak는 drag 칼끝 최고속도, hand error는 전체 최대 목표 오차, axis 이동량은 종료 뒤 blade axis 누적 이동, 끝 K는 1.2초 뒤 검의 선·회전 운동에너지 합이다.

| 조건 | peak m/s | hand error m | 종료 axis 이동 rad | 끝 검 K J |
|---|---:|---:|---:|---:|
| 건강 사브르 내려/유지 | 15.563→15.564 | 0.3005→0.3004 | 0.712→0.706 | 0.000851→0.000849 |
| 건강 사브르 내려/놓기 | 15.563→15.564 | 0.3005→0.3004 | 1.762→1.762 | 0.050368→0.051897 |
| 건강 사브르 올려/유지 | 11.786→11.788 | 0.3375→0.3375 | 1.039→1.039 | 0.113688→0.113795 |
| 건강 사브르 올려/놓기 | 11.786→11.788 | 0.3375→0.3375 | 3.428→3.429 | 0.218425→0.217873 |
| 건강 츠바이핸더 내려/유지 | 16.932→16.860 | 0.4322→0.4388 | 0.972→1.042 | 0.000553→0.000645 |
| 건강 츠바이핸더 내려/놓기 | 16.932→16.860 | 0.4322→0.4388 | 2.084→2.152 | 0.017150→0.016732 |
| 건강 츠바이핸더 올려/유지 | 10.143→10.147 | 0.6589→0.6586 | 1.754→1.754 | 0.344997→0.329857 |
| 건강 츠바이핸더 올려/놓기 | 10.143→10.147 | 0.6589→0.6586 | 4.374→4.443 | 0.297315→0.261104 |
| 상처 API 사브르 내려/유지 | 12.055→11.893 | 0.3253→0.3283 | 1.148→1.199 | 0.000433→0.000424 |
| 상처 API 츠바이핸더 내려/유지 | 12.088→11.291 | 0.4835→0.4608 | 1.608→1.753 | 0.004753→0.001330 |

최고속도 하락만으로 기각하지 않는다. 상처 츠바이핸더는 손 오차와 남은 K가 줄었지만 종료 회전 이동량은 늘었다. 사브르 상처는 오차와 이동량이 소폭 늘었다. 건강 츠바이핸더 내려베기도 오차·이동량 증가가 남았다. 한도 검사는 통과했으나 추종·종료 개선은 혼합 결과다.

ExplicitCap/결합도 종료 조건에 따라 다르다. 건강 츠바이핸더 올려베기/유지의 끝 K는 baseline .344997J→explicitCap 0.241699J→combined .217192J지만, 놓기는 .297315J→1.196548J→1.207463J로 커졌다. 사브르 내려베기/놓기 axis 이동량은 1.762051→1.998376→1.998980rad, 끝 K는 .050368→.152630→.152243J, 최대 hand error는 .300475→.311204→.311186m였다. 전체 제동 개선으로 승격하지 않는다.

고정 바닥의 접촉점 진단속도(상대 접선 성분)와 빈손/검자루 거리도 기록했다. 상처 츠바이핸더 내려/유지의 최대 바닥 접선 속도는 .996868→.635460m/s다. 모든 선택된 부위의 floor manifold solver point를 합하며 fresh/양의 충격량 지지 필터를 적용하지 않았다. 따라서 확인된 지지점의 미끄럼이 아니라 바닥 접촉점 진단속도이며, 발 지지 미끄럼만의 수치도 아니다. Impulse 배열과 solver-point 배열을 대응시키거나 가중하지 않는다. 상대 신체·무기끼리·판금 충돌은 이 선별에 없다.

검 COM 중력 일 midpoint 근사는 건강 drag 사브르 내려/올려 +11.2848/−9.8268J, 츠바이핸더 +29.6658/−18.3211J였다. ExplicitActuatorWorkApproxJ는 명시적 어깨·손목·elbowGravity만 포함한다. FF를 native 안으로 옮기면 관찰 경계가 달라져 그 합의 차이를 총근육 일·효율로 비교할 수 없다. Native 모터/constraint/contact 전체 일 미측정.

저장소 루트의 실제 실행 명령이다. 모듈·교정 파일은 wrapper 기본 경로로 해석되며 metrics에 expandedEquivalentCommand도 남겼다.

```sh
node tools/sim/experiments/native_elbow_followthrough_probe.mjs --screen=cheap > /workspace/halfsword-hybrid-evidence/native-elbow-followthrough-r1-cheap.log 2>&1
node tools/sim/experiments/native_elbow_followthrough_probe.mjs --screen=healthy > /workspace/halfsword-hybrid-evidence/native-elbow-followthrough-r1-healthy.log 2>&1
node tools/sim/experiments/native_elbow_followthrough_probe.mjs --screen=wound > /workspace/halfsword-hybrid-evidence/native-elbow-followthrough-r1-wound.log 2>&1
```

원자료는 저장소 밖 `/workspace/halfsword-hybrid-evidence/native-elbow-followthrough-r1-{cheap,healthy,wound}.json`이다. SHA256은 각각 `2fc16d1a4432e51a42a75949ab43c6f1384bd0a4e7554492d1806cfa6c37b489`, `23dbffddd8eedf86daf0aaf2ebfa790686b06e99d2d330e8626f92e419e63086`, `213f913e9fe2067f29d3faf624566de33e018094f686f011590254b020db669d`. 물리 실행 벽시계 2.37/22.67/6.42초이며 하드웨어 성능 비교가 아니다.

다음은 Q04 입력 의도·자동 복귀와 상대 운동/목표속도 경로의 작은 분리 대조다. Native 한도는 연구 경로로 유지하며, 실제 충돌·상처 up/release·결투·모바일 검증 전 엔진/기본 제어를 통합하지 않는다. Q03 전체와 P-01~P-06은 미완료로 유지한다.
