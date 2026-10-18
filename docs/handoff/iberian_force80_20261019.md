# 사용자 승인 전달 — 바깥 밀어내기 힘 상한 후속

수신 기준: `63ec58647c677e44d5ba6a7429cb40b5e957964d` (전달 전 최신 main 재확인). 연구·시험 원본: `4f7370de78e9cbce3e0bd4e6644933271839cd66`, 이전120전 원본: `7322285b1e4deaee5b41488221d2a3e7c8b09681`.

사용자 결정: **힘 상한80% 감소(20% 남김),0.60초 유지+0.40초 복구**를 단기 이득과 손맛 체감 가능성이 있는 새 후보로 우화에게 전달. 정식 게임 적용 지시나 검증된 전투 우위 선언은 아니다.

## 전달 묶음·연결

이번 묶음은 force-cap120전 원자료/요약/실패, 새80% 인간시험·검증·스크린샷과 실행에 필요한 tools 의존 파일만 포함한다. 이전 제어력25/10/0 연구는 이미 전달한 d0755fe8 및 일본0620f3d7 고정 원본을 참조한다. 공개 페이지의 컴파일 에셋은 별도 own main에 있고 본판 이식 묶음에는 중복하지 않는다.

`PlayerParryGuard`/`skill._cover`/`feel`에서 실제 접촉의 바깥 방향을 확인해 같은outward24 자기 손길을 낸다. `linkSweepRecovery`가 접촉 이벤트를 읽고 상대 `driveJoints`의 팔max와 `driveSword`의maxAimTorque에만 임시 계수를 적용한다. 추종k/d·속도·명령·이동을 바꾸지 않는다. 현행AI가 선택한 방어 외에는 발동하지 않는다. 반복연습 AI 동작 고정은 시험 전용이다. src 전체는 수신판과 동일하며, 저장/PWA는 시험에서 격리한다.

## 근거·검증·미검증

[새 시험과 정확한 수치](../research/iberian_force80_playtest_20261019/README.md), [120전 수치와 실패](../research/iberian_force_cap_20261019/README.md).

새80% 수치검사·모바일 브라우저 실제접촉 양역할20%/총1초·복구·3모드·터치/재시작/저장격리 통과. 정확한80%안의5초/30초 전투실험과 실제 인간손맛은 미확인이다. 75%/.60/.24의단기평균 이득은30초 사지/출혈악화와 함께 읽는다. 모든팔에가해지는실제힘 전체20%라는의미도 아니다(기존감쇠/그립/중력보상은 별도).

## 재현·되돌림

`node tools/sim/iberian_force80_checks.mjs`; `node tools/browser/build_iberian_force80_lab.mjs`; `/tmp/iberian-force80-lab`를4343에서서비스한후 `node tools/browser/iberian_force80_smoke.mjs`, `node tools/browser/iberian_force80_touch.mjs`.

이 전달 커밋 하나를 되돌리면 연구자료/시험 도구가 제거된다. 기본게임src 변경이 없어 전투 본판의 롤백은 필요 없다. 기존 연구가 이미 이식되어 중복 파일이 있으면 새80%파일과forceRecovery설정만 검토하고 과거 자료를 덮어쓰지 않는다. 최신 receiver와 결과SHA/범위는 발행 메시지JSON에 고정한다.
