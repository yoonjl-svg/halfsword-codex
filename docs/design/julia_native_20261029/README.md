# 쥘리아 크리스테바 — 기존 게임 모델로 재제작

이전 `julia_20261029/model.glb`는 사용자가 게임 스타일과 다르다고 거절한 시안이다. 현재 모델로 재사용하지 않는다. 이번 것은 기존 Fighter, 얼굴, 눈, 신체 비례, 손, 관절과 outfit 부위별 훅을 그대로 사용하는 실제 게임 캐릭터다. 마야·이졸데와 같은 카메라/축척으로 함께 확인했다.

## 사용자 확정과 범위

- 이름 쥘리아 크리스테바, 이탈리아 유파, 숙련도4. 실제 AI도4로 확인했다.
- 녹색 조끼/아이보리 셔츠·적갈색 숄과 겹치마, 붉은 머릿수건/갈색 땋은 머리·작은 돈주머니/장부통.
- 검토용 기본 레이피어, 음성 미배정. 전용 무기나 목소리 확정이 아니다.
- 캐릭터 ID는 `julia`, outfit `julia_merchant`. 테스트 경로를 위한 ID 조회에만 등록한다. 일반 여정/방랑 추첨·상점 기능은 이번에 추가하지 않는다.
- 바탕: 우화 main `4f1faf07b25366bb533eb5223856cc67e2ad7e34`. 자체 저장소 가지에서만 수정. 우화 쓰기·전달 없음.

## 구현

`src/outfit_julia.js`와 `src/character_julia.js` 추가, outfits/characters 등록 각1곳. 기존 얼굴 구체/코/작은 눈과 손을 쓰며 전체 몸을 새로 만들거나 장신 비례로 늘리지 않는다. 치마는 양 허벅지를 각각 따라 움직이는 갈래로 구성했다. 기존 물리·신체 질량·콜라이더·관절·공격·보법 정의는 변경하지 않았다.

## 화면

`game-close.png`, `foe-gameplay.png`, `hero-gameplay.png`: 실제 컴파일 게임에서 촬영. 확대 사진은 게임 카메라만 가까이 이동했다.
`front/`, `angle/`, `rear/`: 실제 Fighter 생성자를 쓰는 정형 도감 촬영. 정지 신체의 팔 그림만 공통 편안한 자세로 낮췄으며, 무기 없는 검사 장면이지 전투 스크린샷은 아니다. 같은 조건의 마야·이졸데도 front에 있다.

## 검증 및 재현

기준5관문 통과. fights12/live_battery/finish_thrust/weapon_smoke는 최근 공통 소스 기준과 출력 해시 동일, corr_s0는12건 IDENTICAL. `checks/gates-comparison.json` 참조. 공통 Fighter/손/유파/AI/보법/config/main 파일은 기준과 바이트 동일(`shared-pipeline.json`). 실제 AI 유파와 숙련도, 플레이어 터치 막기/공격 드래그, 부위좌표 유한성, 저장 불변, HTTP/JS오류0은 `browser-qa.json` 참조. 휴대폰 실기 성능이나 사용자 미감 승인으로 간주하지 않는다.

`python docs/design/julia_native_20261029/gates.py`
`SOURCE_ROOT=$PWD CAPTURE_BASE=http://127.0.0.1:5232 CAPTURE_IDS=julia,samira,isolde CAPTURE_OUT=... CAPTURE_ASSET_DIR=... node docs/design/julia_native_20261029/capture.mjs`
`npx vite build --config vite.julia.config.js` 후 public의 fonts/icons/sfx/ui/wb/support를 dist-julia에 복사. 5233에서 정적으로 서비스하고 `node docs/design/julia_native_20261029/browser.mjs` 실행.

초기 브라우저 탐침은 Fighter에 없는 `look` 속성을 읽어 실패했다. 실제 생성된 이름·머리 그룹·유파·AI 숙련도 검사로 수정 후 두 역할 모두 통과했다. 게임 런타임 실패가 아닌 검증 코드의 오류다.

공개 검증: 자체 main0b840bb3 / Pages40880752978 성공. 갤러리·핵심 컴파일 자산26파일 원격해시일치, 공개 실제게임 두역할·터치막기/공격·AI숙련도4·저장불변/HTTP·JS오류0, 휴대폰폭390갤러리와 이전주소리디렉션 통과. 상세 publication.json/public-check 참조. 소스는 자체 codex/julia-native-20261029의46fa690c.
