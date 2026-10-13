# 잠든 물길 · 찬다 첫 시안 — 2026-10-13 KST

기준 `2579bc92922f4aea5607f14d21516a8716112a11`. 사용자 요청은 승인한 정글 무대와 찬다를 실제로 보고 판단할 수 있게 만드는 것이다. 동남아 우림과 옛 수리시설에서 모티브를 얻은 창작이며, 특정 유적·복식의 고증 복원으로 주장하지 않는다.

## 구현

- `sluice`: 우기 초입 소나기 뒤 한낮. 뿌리가 들어 올린 돌 수문, 수위 눈금·물때·이끼, 낮은 수조, 여러 높이의 활엽수와 양치식물. 평평한 기존 결투면과 카메라 영역은 비운다.
- 같은 무대 시계로 물방울/파문·잎 움직임·새의 움직임과 소리를 연결한다. 기존 마스터 음량·일시정지·음소거를 사용하며 지속적인 동물 합창은 없다. 새 소리는 절차적 합성 해석이지 특정 종의 현장 녹음이 아니다.
- `chanda`: 38세 여성 수문 관리인. 남색 짧은 상의/바지, 한쪽 황색 어깨천, 구릿빛 피부, 검은 올림머리, 허리 도구와 눈금 막대, 종아리 천과 샌들. 공통 얼굴/눈/흉곽 규격과 기존 물리를 유지한다.
- 이번 시안은 기존 `sabre`와 검술 보정 v2, 현재 `maya` 음성군을 사용한다. 전용 도검·새 음성 제작 완료가 아니다. 피격/기절/출혈은 각2개다.
- 별도 입구 `sluice.html` → `?cards=sain,ice&foe=chanda&stage=sluice`. 기존 여정 순서는 유지한다.

## 시각 점검과 교정

첫 화면에서 숲의 중간 높이와 수문 너머가 비어 성긴 숲처럼 보였다. 수관/덤불 층과 뿌리 곡선을 보강했고, 먼 덤불층으로 빈 수평선을 메우고 바깥 지면을 숲색으로 연결했다. 찬다의 모인 머리카락 사이가 격자처럼 비어 보였으므로 검은 안쪽 덩어리로 메우고 어깨천의 윗부분을 낮췄다. 이는 첫 시안의 자체 교정이며 사용자의 미적 수락이 아니다.

소개 사진은 실제 게임 렌더다. 인물 정면/사선은 외형 확인용 중립 조명, 무대 사선은 같은 장면의 검사 카메라다. 별도의 그림 생성 결과를 구현 화면으로 쓰지 않는다.

로컬 전달 첫 검사에서 전용 카드 이미지가 없는 `sluice`를 카드 배경 목록에 넣어 404가 발생했다. 목록 추가를 취소하여 기존 기본 카드 배경으로 복귀하고 빌드·모바일 흐름을 다시 검사했다. 실패 결과도 별도 보존한다.

## 검증과 재현

외형6항목, 무대 재생성/정리3회(98,781삼각형·16draw call), 합성음39렌더(기존30출력 동일), 음성 전수조사, 계정32검사, 빌드를 통과했다. 로컬 모바일은320/390/844px 소개 화면과 실제 터치·재시작을 확인했고190응답 해시 일치·오류0이었다. `675233e`/Pages38393351767 공개 성공 후 동일 빌드의 모바일 전달도 통과했다(182고유 파일 해시 일치·오류0). [공개 영수증](chanda_sluice_release.json)과 압축한 검사 원문을 보존한다. 실제 기기 FPS나 인간 청취 만족도는 자동 검사로 선언하지 않는다.

```sh
node tools/sim/experiments/chanda_appearance_gate.mjs /tmp/halfsword-chanda-20261013/appearance-native.json
node tools/audio/stage_sluice_checks_20261013.mjs /tmp/halfsword-sluice-20261013/audio-synthesis.json
node tools/audio/voice_inventory_20261012.mjs /tmp/halfsword-sluice-20261013/voice-inventory.json --strict
STAGE_BASE=http://127.0.0.1:4182 node tools/browser/frozen_bay_scene_20261010.mjs sluice /tmp/halfsword-sluice-20261013
node --test tools/account/*.test.mjs
npm run build -- --outDir /tmp/halfsword-sluice-build-20261013
node tools/browser/sluice_delivery_20261013.mjs --base=http://127.0.0.1:4198/ --build=/tmp/halfsword-sluice-build-20261013 --out=/tmp/halfsword-sluice-20261013/local
node tools/browser/sluice_delivery_20261013.mjs --base=https://yoonjl-svg.github.io/halfsword-codex/ --build=/tmp/halfsword-sluice-build-20261013 --out=/tmp/halfsword-sluice-20261013/public --local-evidence=/tmp/halfsword-sluice-20261013/local/report.json
```

개발 서버/정적 서버를 각각 실행한 상태의 명령이다. 공개 검사는 로컬에서 통과한 동일 빌드·도구·등록값과 실제 응답 바이트를 비교한다.
