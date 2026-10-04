# 실험 색인과 재현 입구

- 2026-10-05 · [연속 동작의 힘 전달 재설계](motion_force_design_20261005.md) · 기준 `e90193ac030ba291ceb5418c7029551cea292f59`. 설계/정적 검토만, 새 물리 실행·공개판 변경 없음. 첫 후보는 좌우·사선 협조 시점 한 경로.

- 2026-10-05 · [동작 보정·통합 시험](motion_assist_20261005.md) · [수치/소스](motion_assist_20261005.json) · [전달](motion_assist_release.json). 약15% 입력 깊이/몸 협조, 큰 베기 보존, 초기 wall fixture 제외와 미채택 초안을 구분.


2026-10-04 KST. 결론은 각 원보고가 기준이며 이 색인은 경로·재현 명령만 연결한다. [짧은 일지 계약](EXPERIMENT_LOGGING.md), [전체 보고 폴더](https://github.com/yoonjl-svg/halfsword-codex/tree/main/docs/strike), [전체 실험 도구](https://github.com/yoonjl-svg/halfsword-codex/tree/main/tools/sim/experiments).

| 최근 회차 | 판정 / 소스 | 재사용 입구 |
|---|---|---|
| [P4/P5/P6 병렬 회차](p456_batch_20261005.md) | P4 목표 점프 확인·두 기하 수정 기각, P5 선택형/P6 입력 결함 수정·전체 목표 미완료 | native prefix1211 exact·P5 경계61·[소스/명령/원자료](p456_batch_20261005.json)·[전달](p456_batch_release.json) |
| [실제 절상 뒤 입력·공개 B 후속](injured_input_20261005.md) | 두 B 잠정 선호·재입력 수락/회전 잔존, game 변경0·일반 승격 보류 | 실제 prefix1536 exact·현재 공개20초 후속·[수치/명령/해시](injured_input_20261005.json) |
| [피격 뒤 한손 재현 선별](recovery_selection_20261005.md) | 과거 manual 팔 절상 현재 비재현·actual legacy 주팔 절상 경계 선정, game 변경0 | 고정2문맥·현재4행/관찰 동등성2행·[수치/명령/해시](recovery_selection_20261005.json) |
| [청강검 찌르기 날 방향](thrust_plane_20261005.md) | 접촉 전 비틀림 감소·큰 베기 exact, 후속 접촉 추종 후퇴·청강검 선택형 | 3입력 경로/production 동등성·[수치/명령/해시](thrust_plane_20261005.json)·[전달](thrust_plane_release.json) |
| [청강검 접촉 형상](contact_geometry_20261004.md) | 무접촉 베기 exact·접촉 회전 감소, 손 추종 후퇴/앞선 탭 급회전 남음·청강검 플레이어 선택형 | 같은 첫 충돌/생성부터 일반 전투·[수치/명령/해시](contact_geometry_20261004.json)·[전달](contact_geometry_release.json) |
| [손목 요청의 그립 이전](native_grip_intent_20261004.md) | 큰 베기 날 비틀림 후퇴·공개 기각; 반작용 경로는 진단만 | 실제 최종3호출·free/같은 첫 충돌·6궤적(반복/prefix 포함)·[수치/명령/해시](native_grip_intent_20261004.json) |
| [그립 힘·속도 계약](native_grip_wrench_20261004.md) | 모터 좌표/힘 예산 확인·연속 속도 유지판 공개 기각 | source/operator9·생성부터 큰 베기/실제 전투4궤적·[수치/명령/해시](native_grip_wrench_20261004.json) |
| [청강검 충돌 급회전](qinggang_contact_20261004.md) | 접촉 원인 확인·native 첫 회전 감소, 후속 비틀림/세계 힘 계약 미완료·공개 보류 | 동일965 prefix·7궤적(실패/관찰/확장 포함)·[수치/명령/해시](qinggang_contact_20261004.json) |
| [찌르기 날 흔들림](onehand_thrust_20261004.md) | 세이버 선택형·청강검 접촉 급회전 보류, 일반 승격 없음 | 20실행/16조건·접촉 전 prefix exact·[수치/명령/해시](onehand_thrust_20261004.json)·[전달](onehand_thrust_release.json) |
| [한손 B 멈춤·반전](onehand_stop_20261004.md) | 명령 연결 조작 이득 미확정·native 마지막 substep은 cap 아래, 공개 보류·game 변경0 | 입력24실행/12조건·native6·관찰/격리 exact·[수치/명령/해시](onehand_stop_20261004.json) |
| [전투 급회전 분리](axial_combat_20261004.md) | 관절/횡토크 운반 민감도, 예측 힘점 악화·기각; game 변경0 | 실제 observer2 exact·같은 prefix·native fork/dt/실패 경계·[수치/명령](axial_combat_20261004.json) |
| [native 팔꿈치 실제 전투](native_elbow_combat_20261004.md) | scalar 한도 측정6 PASS·손 오차 증가/공개 보류 | 관절 보존·actual2AI·player 부상0·분기/840 dispatch·[수치/명령](native_elbow_combat_20261004.json) |
| [준비 자세·그립 교정](ready_grip_20261004.md) | B 시작 교정·새 손/소매 철회, 깊은 접기 떨림 기각 | native27·손3쌍·명목 유한자루5·첫 입력6·[재현/수치](ready_grip_20261004.json)·[전달](ready_grip_release.json) |
| [첫 자세 근거 확인](first_guard_review_20261004.md) | 확장 가드 실재·공통 시작 미검증, 게임 변경 없음 | 원전 해당 문단 직접 열람·native 좁은관찰3회·기존trace3/3 exact·[수치/재현](first_guard_review_20261004.json) |
| [쥔 손 엄지 정정](hand_opposition_20261004.md) | 이전 방향 검증 누락 정정, 일반 표시만 | 손3쌍·5무기 양손 양측+손바닥 화면·[원자료](hand_opposition_20261004.json)·[전달](hand_opposition_release.json) |
| [첫 자세·엄지 손](initial_pose_and_hands_20261004.md) | manual 시작 수평·일반 외형, 양손2종 시작 진동 남음 | native27 전/후·손3쌍·화면16·[수치/원자료](initial_pose_and_hands_20261004.json)·[전달](initial_pose_and_hands_release.json) |
| [검 거두기 예측20실행](wrist_braking_round1.md) | 공개 보류, 방향오차 후퇴. `63be055002eb617bb2d7283207b78ee855d768e9` | 아래 명령, wrist_braking_probe / sword_drag_duel_probe, [수치/해시](wrist_braking_round1.json) |
| [관성56실행](inertia_followthrough_round1.md) | 작은/혼합 효과·공개 보류. 6소스/원자료 구분 | 아래 소스별 명령, [수치/해시](inertia_followthrough_round1.json) |
| [회복 경로8실행](arm_recovery_path_round1.md) | 원인 분리, 공개 미수락. `601dec3`/`62dd47d` | 원보고의 재현3명령·raw command·[수치](arm_recovery_path_round1.json) |
| [목표/감쇠6실행](hold_response_round1.md) | 측정 유효/기각. `ac1cbcd`/`58fc62f` | 원보고의 재현3명령·raw command·[수치](hold_response_round1.json) |
| [생성부터 한손 전투10실행](arm_recovery_from_spawn_round1.md) | 공개 보류, 후속 같은 상태의 참조. `d351c53` | raw reference / [수치](arm_recovery_from_spawn_round1.json) |
| [세로 터치 기본 반영](mobile_vertical_default_20261003.md) | 사용자 선택 전달 완료. `41bbe61` | 입력51검사·[실제 배포 영수증](mobile_vertical_default_release.json); 물리 실험과 구분 |
| [한손 팔 고정 선택형](onehand_manual_round1.md) | swivel2종 기각, 수동 목표 공개 비교 전달. core `458195d` | 물리32(관찰반복6 포함)·[명령/해시 지도](onehand_manual_round1.json)·[전달 영수증](onehand_manual_release.json); 일반 승격 보류 |

## 이번 감사의 범위

[감사 수치/원자료 지도](experiment_log_audit_20261004.json): 기존strike MD85개/JSON78개와 실험 도구78개를 목록으로 확인했다. 도구76개는 직접 보고 연결, derive_wrist_response는4 probe의 간접 helper, wrist_braking_probe는 이 색인/원보고 보충으로 연결했다. 같은 이름의MD가 없는25JSON도 다른 문서에 연결돼 있어 누락으로 세지 않았다. 이 목록 검사는 모든 옛 실험의 완전 재현 보장이 아니다.

최근4회차 raw12개와 생성부터 reference1개 **13개/620,188,255bytes**의 실제 접근·크기·SHA가 일치했고 보존 소스 객체가 존재한다. 감사 JSON의 `currentRawVerification.files`가 현재 보존 경로·bytes·SHA·full source의 단일 지도다. 외부 자료는 이식한 환경에서 경로를 매핑하고 해당SHA를 확인해야 한다. 현재checkout만으로 외부raw/연구엔진까지 자동 제공된다고 주장하지 않는다. 과거943자료/엔진6/빌드근거34/보충118은 기존 복원 영수증과 목록을 이용했고 전체 해시·실험을 반복하지 않았다.

## 고정 소스로 재현할 때

현재HEAD에서 옛 숫자를 재현했다고 주장하지 않는다. 원보고의 full SHA로 **새 detached worktree**를 만들고 npm ci 후 해당 명령을 쓴다. 기록된 패치/엔진/입력/reference가 있으면 같은 해시로 준비한다. 출력은 기존 파일을 덮어쓰지 않는 새 절대경로다. 아래 명령은 원자료 protocol·고정 소스의 허용 옵션으로 **재구성했으며 당시 argv 기록이 아니다**. 명령 보완을 위해 물리실행을 반복하지 않았다.

검 거두기의 두 raw는 모두 `63be055002eb617bb2d7283207b78ee855d768e9`다.

```sh
git worktree add --detach /tmp/halfsword-wrist-replay-NEW 63be055002eb617bb2d7283207b78ee855d768e9
cd /tmp/halfsword-wrist-replay-NEW
npm ci
mkdir -p /workspace/halfsword-handoff/research-wrist-braking-20261003
node tools/sim/experiments/wrist_braking_probe.mjs --weapons=sabre,zweihander --endings=hold,reverse --seed=7 --response=on --out=/workspace/halfsword-handoff/research-wrist-braking-20261003/NEW-controlled.json
node tools/sim/experiments/sword_drag_duel_probe.mjs --trial=available --weapons=sabre,zweihander --seeds=7,19 --response=on --out=/tmp/NEW-wrist-duel.json
```

당시 wrist_braking_probe는 `/workspace/halfsword-handoff/research-wrist-braking-20261003/` 아래 새 출력만 허용한다. 이 경로를 만들 권한이 없는 환경에서는 그대로 실행할 수 없다. 경로 guard를 이식한 경우 도구SHA 변경을 기록하고 역사원본의 byte-exact 재현으로 쓰지 않는다. 현재 공개URL의 wristBraking=available은 보류 상태라 켠 비교를 재현하지 않는다. 켠 화면 검사는 당시 `cd0eabc` 빌드/영상이 별도 근거다.

관성 원자료는 각 행의SHA를 별도 worktree에 고정한 뒤 명령을 실행한다. 초기 두 소스는out만, dc019소스는out/trial만 허용하므로 최신옵션을 과거소스에 덧붙이지 않는다.

| 원자료 / full source | 재구성 명령 |
|---|---|
| screen-01 / `1aa5e53b4c1040249da5b3a6be88d3d7c4ef906a` | `node tools/sim/experiments/sword_drag_probe.mjs --out=/tmp/NEW-screen.json` |
| duel-01 / `7208f9fe07cc300c4b7d196979bfe2aee25885f7` | `node tools/sim/experiments/sword_drag_duel_probe.mjs --out=/tmp/NEW-duel.json` |
| brake-screen-01 / `dc0198068385cf082d383a917bc86ef6d0d24e42` | `node tools/sim/experiments/sword_drag_probe.mjs --trial=brake --out=/tmp/NEW-brake-screen.json` |
| brake-duel-01 / `dc0198068385cf082d383a917bc86ef6d0d24e42` | `node tools/sim/experiments/sword_drag_duel_probe.mjs --trial=brake --out=/tmp/NEW-brake-duel.json` |
| brake-activation-01 / `e8bcec461b052f6d044ddb5348084aa3d2c2b2bb` | `node tools/sim/experiments/sword_drag_probe.mjs --trial=brake --weapons=zweihander --endings=reverse --response=on --out=/tmp/NEW-brake-activation.json` |
| brake-combat-activation-01 / `99c2b42738db5772f34061fa8a772ee40c4b3fb4` | `node tools/sim/experiments/sword_drag_duel_probe.mjs --trial=brake --weapons=sabre --seeds=19 --response=on --out=/tmp/NEW-brake-combat-activation.json` |

원자료 지도에서 관성root는 `research-sword-drag-20261003`, 경로root는 `research-arm-path-20261003`, 응답root는 `research-hold-response-20261003`, 공통reference는 `research-from-spawn/run-01.json`이다. 보존root는 현재 `/workspace/halfsword-handoff/`이며 13파일의 모든정확해시는 감사JSON과 기존 원보고JSON을 함께 확인한다. 파일명만 같은 다른 파일을 쓰지 않는다.

- 2026-10-04 [양손 파지 시작 폭주](startup_grip_20261004.md): 축 위 공통힘점 선택형. 시작 안정화/기존 default27 exact·보존 fixture 확인, 전투 급회전은 남아 일반 승격 보류. [수치](startup_grip_20261004.json)/[전달](startup_grip_release.json).
