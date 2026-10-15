# 대기실 프로필·투구·작은 메뉴 — 2026-10-16 KST

기준 `4602e7419fa5fa02eaba6bc135ba5d8aa79f5a0d`, 구현 `3b280a1bf2898b811ac3853002039348795b3584`. 포크 `yoonjl-svg/halfsword-codex`만 변경했다. [검사 결과](lobby_profile_armor_20261016_checks.json).

## 사용자 결정과 적용

- 프로필은 **Lv.1 여행자 → 이름(수정 아이콘) → 대표 유파** 순서. ‘대면 결과’ 아래 정사각형 도트 금화와 기본100 표시.
- 사용자 답변에 따라 레벨은 **1 + 시작 지급품을 제외한 획득 아이템 수 + 획득 스킬북 수**. `lobby_progress.js`의 `recordAcquisition({receipt,kind,source})`는 고유 획득 사건으로 중복 상승을 방지하고 `source:'starter'`는 제외한다. 같은 종류의 두 아이템도 서로 다른 획득 사건이면 각각+1이다. 장착/해제·기존 유파 숙련으로 레벨을 올리지 않는다.
- 호칭은 유파/레벨과 분리했다. 기본 ‘여행자’, 이벤트 해금 기록 API만 마련했다. 실제 이벤트 조건/호칭 목록·선택 UI는 아직 미정이다. 기존 스킬북 화면은 유파 기술 해금 조회이며, 신규 스킬북 아이템 지급 규칙은 만들지 않았다. 신규 전리품/거래가 없으므로 지금 정상 최초 프로필은Lv.1이다.
- 메뉴는 **무기·방어구 / 상점·스킬북** 두 줄이다. 상점은 빈 상품 목록이며 가격·구매는 추가하지 않았다.
- 방어구에는 실제 플레이어 케틀햇을 ‘투구’ 이름으로1개 넣었다. 등급 **커먼**, 설명 **여행자의 필수품. 뒤집으면 요리를 할 수 있다.** 선택하면 격자 안에 작은 정보창이 열려 장착 버튼을 화면 밖으로 밀지 않는다.
- `tools/browser/armor_thumb.mjs`가 실제 `game.player.helmetGroup`을 복제하여 기존 무기 섬네일과 같은 조명/256px/투명WebP로 촬영한다. 신규 모델을 만들거나 전투 모델을 바꾸지 않았다. `public/ui/armor/kettle.webp`2,342bytes.
- 무기/투구는 독립 장착 슬롯. 투구 기본 장착, 해제하면 복제 캐릭터에서도 벗겨진다. 실제 전투의 투구·물리 몸은 유지한다. 이번 장착 범위는 앞선 요청과 동일한 **대기실 캐릭터 미리보기**이며, 출발 뒤 기존 카드/이어하기 규칙은 그대로다.
- 설정은 첫 화면의 공지사항 오른쪽으로 이동. 두 버튼 모두70×32px(짧은 가로29px), 이전 공지 박스 대비 약10% 축소. 기존60fps 제한 저장 API를 재사용한다. 비교 시안의 설정은 게임 저장소를 건드리지 않는 메모리 상태다.
- 여정 시작 버튼 크기는 유지. 대기실 메뉴12px·높이36/가로30px, 장착/해제64px폭·32/가로30px높이. 기존 나무 버튼·픽셀 숲·카드 프레임·5×4 한 칸 아이템 원칙 유지.

새 로컬 저장은 `stillness.fork.progress.v1`(획득/호칭/금화), `stillness.fork.lobbyArmor.v1`(투구)이며 기존 무기·프로필·여정 저장은 유지한다. 저장 거부 시 이번 실행 동안 유지한다. 서버 계정 연동은 추가하지 않았다.

## 검증과 한계

- `npm run build`: 성공, PWA `518f92ce1d0f984d47837658`,355파일/6,862,350bytes. 기존 큰 청크 경고 유지.
- `node --test tools/sim/lobby_progress.test.mjs`:3통과. 지급품 제외/두 획득 종류/동일 사건 중복/호칭 독립/잘못된 저장/저장 거부.
- `node tools/browser/lobby_equipment_smoke.mjs http://127.0.0.1:4173 /workspace/lobby-v3-validation/equipment`:10통과, 오류0. 프로필 순서/초기값,2×2메뉴, 설정 이동/저장, 실제 투구 로드·설명·독립 장착/해제, 기존 무기 교체, 재접속, 물리 몸 동일, 터치 회전,320/390/568/844/1440폭.
- `node tools/browser/game_entry_smoke.mjs http://127.0.0.1:4173 /workspace/lobby-v3-validation/entry`:20통과, 오류0. 실제 터치 이동/공격, 카드/이어하기, 이름/전적/설정/유파 숙련 보존, 일시정지/재개, 직접 테스트 링크 격리.
- `node tools/sim/stamina_gates.mjs on /workspace/lobby-v3-validation/gates`:5통과. fights12 `18a6e736`, live `e7ee3d96`, finish `433ac984`, corr12/12 IDENTICAL, weapon23OK/FAIL0/NaN0 `27b922fc`. 기력 적용 후 기준 유지. 전투/AI/유파/보법 파일 변경 없음.
- 최초 브라우저 검사는 새 `data-armor`가 캐릭터와 칸 양쪽에 있어 선택자 중복으로 중지됐다. 검사 대상을 `button[data-armor=kettle]`로 한정하고 해당 검사를 재실행했다. 최초 오류 로그를 별도 보존했다.
- 마지막 설명창 배치 변경은 최종 프로덕션 촬영 및 오프라인 재접속에서 확인했다. `node tools/browser/lobby_capture.mjs /workspace/lobby-v3-validation/screens`: PC/가로/세로, 투구 유무·설명·장착 버튼 화면 내 위치, 오류0.
- `/workspace/lobby-v3-validation/offline-equipment.mjs`:355파일 캐시 완료 후 네트워크 차단/재접속, 새 투구 섬네일·장착/해제, 설정, 무기 교체, 여정 출발 통과.

실제 Chromium 모바일 에뮬레이션이며 실기기 Safari 성능은 미측정. 공개 Pages 직접 접속은 환경 정책 제한으로 미확인, 배포는 Actions 성공으로 별도 기록한다. [릴리스 기록](lobby_profile_armor_20261016_release.json).

## 실제 화면

모두 **로컬 프로덕션**의 실제 브라우저 촬영이다. 합성/이미지 편집 없음.

- [프로필·작은 메뉴·무기](../screenshots/lobby_v3/lobby-phone.png)
- [투구 설명·장착](../screenshots/lobby_v3/armor-equipped.png) / [해제](../screenshots/lobby_v3/armor-unequipped.png)
- [첫 화면 공지·설정](../screenshots/lobby_v3/title-phone.png) / [설정 창](../screenshots/lobby_v3/title-settings.png)
- [PC](../screenshots/lobby_v3/lobby-desktop.png) / [세로](../screenshots/lobby_v3/lobby-portrait.png)

되돌림은 구현 커밋 revert. 기존 로비/첫 화면 모듈과 신규 progress/투구 자산을 함께 이식하고 전투 파일은 포함하지 않는다.
