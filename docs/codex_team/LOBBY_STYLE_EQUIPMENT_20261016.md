# 대기실 스타일·장착 미리보기 · 2026-10-16

- 사용자 요청: 첫 화면의 글자·버튼 스타일 유지, 캐릭터 창 약80% 및 화려한 실제 카드 프레임, 창 아래 출발 버튼, 인벤토리5×4 및 한 칸 아이템, 선택에 따른 장착/해제/즉시 교체.
- 기준 `3aa7f224e41c204f5418cc806e2d3ed97ef10d77`. 구현 `b73a9c82`.
- **포크 yoonjl-svg/halfsword-codex만 수정.** 공통 몸·입력·AI·유파·보법·기력·대련 무기 선택 규칙은 수정하지 않았다.

## 최종 동작

1. 첫 화면의 `start_pixel.css` 버튼 스타일과 `createPixelGrove` 숲·바람을 재사용한다. 제목도 기존 픽셀 글자 함수로 그린다. 버튼 색/글꼴/테두리/모서리/나무 결이 첫 화면과 일치하는지 브라우저에서 비교했다. 작은 화면에서 높이와 폭만 배치에 맞춘다.
2. 가로/PC 캐릭터 프레임은 기존 열의 폭·높이80%. 세로에서는 좁은 폭을 보완해90%, 높이는80%다. 출발 버튼은 캐릭터 창 바로 아래다. 실제 무기 카드의 `px_clearing_frame.png`를14px(모바일12px) border-image로 사용하고 기존 타일·원판을 유지한다. 인벤토리에도 같은 프레임을 쓴다.
3. 5×4 정사각형 격자에 나뭇가지/롱소드가 각각 한 칸을 차지한다. 기존 섬네일 재사용. 기존 설명 영역은 제거했다. ‘타이틀로’는 ‘첫 화면으로’로 변경했다.
4. 선택 없음: 장착/해제 모두 disabled. 미장착 아이템 선택: 장착만 활성. 장착한 아이템 선택: 해제만 활성. 다른 무기 장착은 기존 무기를 즉시 교체한다. 선택한 칸 재클릭 또는 빈 칸 클릭은 선택만 해제하며 장비를 벗지 않는다.
5. 기존 무기 `buildParts → partMesh → decorate`로 실제 모델을 만들어 복제된 캐릭터의 손에 표시한다. 무기 포함360도 회전 가능. 해제하면 무기 모델이 사라지고 교체 시 이전 모델의 소유 geometry/material을 정리한다. 게임과 공유하는 캐릭터 자원·환경 텍스처·전투 몸은 해제/변경하지 않는다. 같은 카메라 축척을 유지해 장착 때 인물 크기가 변하지 않는다.
6. 대기실 장착 상태는 `stillness.fork.lobbyEquipment.v1`에 저장한다. 이름/승패/여정 저장과 분리한다. 재접속/이름 수정/첫 화면 왕복 후 유지하며 선택 표시는 다시 비운다. 저장 거부 시 이번 실행 동안 유지한다. 이번 범위는 **대기실 캐릭터의 장착 표시**다. 대련 시작은 기존 카드 또는 이어하기 무기를 사용한다.

## 검증

[기계 결과](lobby_style_equipment_20261016_checks.json) · [배포 기록](lobby_style_equipment_20261016_release.json).

- `npm run build`: 성공. 기존 큰 청크 경고 유지.
- `node tools/browser/lobby_equipment_smoke.mjs http://127.0.0.1:4173 /workspace/lobby-v2-validation/equipment`:9개 통합 확인 / 브라우저 오류0. 첫 화면 버튼 실제 CSS 비교,5×4/한 칸 정사각형/더 큰 셀,80%프레임/출발 위치, 선택과 장착 구분, 장착/교체/해제/8회 반복, 장착 후 실제 터치90° 회전, 물리 몸 위치·회전 동일, 재접속/이름/왕복 저장,1440·844·390·320·568×320, 저장 거부, 기존 카드 진입.
- `node tools/browser/game_entry_smoke.mjs http://127.0.0.1:4173 /workspace/lobby-v2-validation/entry`:20개 / 오류0. 실제 터치 이동·찌르기, 카드/이어하기, 일시정지/재개, 전적/이름/해금/설정, 직접 테스트 격리.
- `/workspace/lobby-v2-validation/offline-equipment.mjs`:Service Worker 캐시 완료 후 네트워크 차단·재접속·로비·두 모델 장착/교체/해제·카드 진입 통과. 최종 공지 한 항목 추가 전 동일 기능 코드에서 검사했다.
- `node tools/sim/stamina_gates.mjs on /workspace/lobby-v2-validation/gates`:5관문 통과. fights12 `18a6e736`, live `e7ee3d96`, finish `433ac984`, corr12/12 IDENTICAL, weapon23OK/FAIL0/NaN0 `27b922fc`. 기력 적용 후 기준값 유지.
- `node tools/browser/lobby_capture.mjs /workspace/lobby-v2-validation/final`:최종 프로덕션에서 PC1440×900, 가로844×390, 세로390×844, 롱소드/나뭇가지/해제/회전/이름 창 촬영. 초기 disabled 버튼에 모바일 hover 색이 남아 마지막 CSS에서 배경·불투명도를 고쳤다. 실제 가상 모바일 Chromium 검증이며 실기기 Safari 성능을 측정한 것은 아니다.

## 화면과 이식

[첫 화면 비교 기준](../screenshots/lobby_v2/title-reference.png) · [이전 대기실](../screenshots/lobby/lobby-phone.png) · [새 대기실](../screenshots/lobby_v2/lobby-phone.png) · [롱소드 장착](../screenshots/lobby_v2/longsword-equipped.png) · [나뭇가지로 교체](../screenshots/lobby_v2/branch-equipped.png) · [해제](../screenshots/lobby_v2/unequipped.png) · [PC](../screenshots/lobby_v2/lobby-desktop.png) · [세로](../screenshots/lobby_v2/lobby-portrait.png).

모두 실제 로컬 프로덕션 브라우저 촬영이며 합성/이미지 편집 없음. 공개 Pages 직접 접속은 환경 정책403으로 미확인, 공개 배포는 Actions HTML의 성공으로 구별해 기록한다.

최소 이식은 기존 로비 위의 `lobby.js/css`, `lobby_character.js`, 신규 `lobby_weapon.js`, `lobby_equipment.js`와 첫 화면 스타일/숲·카드 자산이다. `main.js`·전투 파일 변경 없음. 구현 커밋을 revert하면 기존 인벤토리 정보 보기로 돌아가며 새 장착 키는 이전 코드가 읽지 않는다.
