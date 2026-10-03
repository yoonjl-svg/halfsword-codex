# 실험 색인과 재현 입구

2026-10-04 KST. 결론은 각 원보고가 기준이며 이 색인은 경로·재현 명령만 연결한다. [짧은 일지 계약](EXPERIMENT_LOGGING.md), [전체 보고 폴더](https://github.com/yoonjl-svg/halfsword-codex/tree/main/docs/strike), [전체 실험 도구](https://github.com/yoonjl-svg/halfsword-codex/tree/main/tools/sim/experiments).

| 최근 회차 | 판정 / 소스 | 재사용 입구 |
|---|---|---|
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
