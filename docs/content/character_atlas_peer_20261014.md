# 캐릭터 도감: 우화 적용본 갱신 · 2026-10-14

사용자가 우화의 최신 튜닝을 기존 도감에 반영하도록 요청했다. 11:40 KST에 조회한 원본 main `37b618c5b5c94e701cce2ae9e39c7f6abe00f86c`는 Pages38502034140에서 실제 배포에 성공한 커밋이다. 이번 요청의 열람 허가로 정기 회차 밖에서 읽었으며 상대에게 쓰거나 연락하지 않았다.

[같은 도감 주소](https://yoonjl-svg.github.io/halfsword-codex/characters.html?v=2)에 본게임14개 캐릭터 외형(하인리히 별도 모습 포함)＋플레이어1개, 우리 제작 시안3개를 표시한다. 다라이시·찬다·사용 보류 세르파는 상대 등록부에 없어 시안으로 구분한다. 게임의 외형/물리 코드를 병합한 작업이 아니다.

## 반영 내용

- 상대 Fighter·외형 모듈·공식 손 연결에서 다시 촬영했다. 마야 앙가르카, 미나미 머리/무녀복, 토메 사서복, 투야나 사제복/묵주, 김씨 검집 덮개, 라트나 얼굴/무릎/원숭이 배치 등을 포함한다.
- 브란 오소리·가장, 토메의 아르키진나시오의 사서, 미나미의 수호자, 아르토리아의 왕, 김씨의 걷는 남자를 적용했다. 오마리 무기는 츠바이핸더, 라트나는 북부 대공의 검으로 표시한다.
- 상대 ID minami/samira는 도감의 yeongman/crown_boss에 연결한다. 상대 등록부에 빠진 토메64·오마리51·미나미19세와 출신은 기존 확정 설정을 보존하고 필드별 출처를 남겼다.
- 이전 도감의 직접 Fighter 생성에는 별도 손 외형 연결이 빠져 있었다. 이번에는 양쪽 소스의 서로 다른 공식 손 연결을 호출하고, 우리 시안3장도 이를 반영했다.
- 같은 정면 정사영·720×960·축척·중립 조명·내린 팔 자세를 유지한다. 무기는 생략하고 비무장 손 상태로 촬영한다. 하인리히 붉은 눈은 포함한다. 전투 자세·무대 조명·무기 후광 사진은 아니다.
- 18장 총258,314바이트. 출처 커밋/등록부 ID/이미지 SHA는 `public/character-roster/source-catalog.json`; 생성기는 이미지 해시 불일치나 인물 누락 시 중단한다. 재생성 때 서로 다른 소스가 섞이지 않게 한다.

## 근거와 재현

상대 소스의 안전한 스냅샷은 저장소 밖에 보관했다. Vite가 실제 제공하는 모든 src JS를 선택한 소스와 해시 비교한 뒤 촬영했고 촬영 전후 소스 안정성/프레임/디코딩을 확인했다. 캐릭터별 카메라 조정은 없다. 손과 의상 보존을 포함한 전체 모음 이미지를 육안 점검했다.

```sh
SOURCE_ROOT=/tmp/halfsword-peer-atlas-20261014/source SOURCE_HEAD=37b618c5b5c94e701cce2ae9e39c7f6abe00f86c CAPTURE_BASE=http://127.0.0.1:4331 CAPTURE_ASSET_DIR=/tmp/halfsword-peer-atlas-20261014/peer-assets CAPTURE_OUT=/tmp/halfsword-peer-atlas-20261014/capture node tools/browser/character_roster_capture_20261014.mjs
CAPTURE_IDS=silver_wanderer,chanda,sherpa CAPTURE_ASSET_DIR=/tmp/halfsword-peer-atlas-20261014/ours-assets CAPTURE_OUT=/tmp/halfsword-peer-atlas-20261014/ours-extras node tools/browser/character_roster_capture_20261014.mjs
node tools/content/build_character_roster.mjs
```

촬영 후 ID 매핑과 출처 카탈로그의 해시를 함께 갱신해야 한다. 로컬/공개 전달 검사는 같은 고정 빌드와 검사 도구를 사용한다. 320/390/844/1200px ×2배열,18장 확대/순환/닫기,22파일 일치를 확인한다. 실제 휴대폰의 미적 판단은 사용자에게 남는다. 전투 변경이 없어 물리 실험은 반복하지 않는다. 상세 완료 상태와 근거 보존은 [영수증](character_atlas_peer_release.json)을 따른다.

`74e09a7`/Pages38503451922 공개 완료. 로컬/공개 각8배열·18사진 확대·22파일 해시 일치·오류0.
