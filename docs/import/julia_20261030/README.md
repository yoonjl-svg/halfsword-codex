# 쥘리아 크리스테바 기본·얼터 캐릭터와 프로필 전달

사용자 승인: “크리스테바 기본+얼터 프로필과 캐릭터 우화에게 규약에 맞게 보내”. 검토된 현재 모델과 프로필을 함께 전달한다. 이전 독립 GLB/전신 시안이나 작은 가슴 노출안은 전달 대상이 아니다.

## 최신 기준과 적용

- 수신측 최신 main 기준: `61a7270b1b68dd4d774687c5f80038e4a7be57df` (2026-10-30 수신).
- 자체 전달 가지: `codex/julia-handoff-20261030`. 위 기준 위에 이번 캐릭터·프로필만 추가했다. 첫 독립 커밋 `0753eb9e02dd05cf795397587c89d35d3fe34a28`은 캐릭터/외형/손 장식 연결, 다음 커밋은 프로필·연결·자료다.
- 검토된 소스: 기본 `46fa690c`, 최종 얼터 `f51d7820`; 프로필 `a2efc31b`의 기본 b-05와 얼터 최종본.
- 최종 결과 SHA·발행 직전 수신 HEAD 재확인·원격 전체파일 해시는 별도 전달 메시지와 영수증에 고정한다. 수신 저장소 직접 쓰기0.

```sh
git fetch https://github.com/yoonjl-svg/halfsword-codex.git codex/julia-handoff-20261030
git cherry-pick 61a7270b1b68dd4d774687c5f80038e4a7be57df..FETCH_HEAD
```

수신 main이 더 바뀌면 위 기준 이후 차이를 먼저 확인한다. 기존 파일 전체 교체나 과거 게임 가지 병합이 아니다.

## 캐릭터와 연결 범위

| 항목 | 기본 | 얼터 |
|---|---|---|
| ID | julia | julia_mad |
| 이름 | 쥘리아 크리스테바 | 광기의 쥘리아 크리스테바 |
| 유파·숙련 | 이탈리아·4 | 이탈리아·4 (proficiencyFixed:4) |
| 검토 무기 | 레이피어 | 레이피어 |
| 외형 | 녹색 조끼/아이보리 셔츠·적갈 숄/치마·붉은 머릿수건·갈색 땋기 | 먹남/회백 복식·오른 얼굴/검든 오른팔 금속·왼쪽 목/가슴/등/복부 기계 반신 |
| 음성 | 아직 미배정(silent) | 동일 |

얼터의 정체·기원·새 대사/서사는 만들지 않는다. 기계는 외형이며 체력·적극성·힘·갑옷 혜택을 추가하지 않는다. 숙련4 유지가 이번 전달 사양이며 일반 얼터 +1 규칙으로 자동 상향하지 않는다. 기존 인간 생리·출혈·죽음 판정을 따른다.

네 독립 모듈 `character_julia*.js`, `outfit_julia*.js`와 characters/outfits 등록을 넣었다. 기존 Fighter·신체 비례/콜라이더·질량·관절을 사용한다. `hands.js`의 7줄 훅은 기계 손등 장식이 편손/쥔손을 따라 보이고 해제 때 정리되게 한다. 기존 캐릭터에는 훅 데이터가 없어 새 동작을 하지 않는다.

`CHARACTERS_BY_ID`에 두 ID를 등록했다. **정규 여정/방랑/생사전 추첨·상점 기능·모집 편성에는 아직 넣지 않았다.** 해당 게임 기능 연결은 별도 결정 범위다. 주소 `?test=1&foe=julia` 또는 `?test=1&foe=julia_mad`로 만나고, `hero=`로 직접 조작할 수 있다. 저장 형식 변경 없음.

## 프로필

`art/julia-profiles-20261030/<id>/`에 각각 original.png/low.png/grid.png/cells.png/sprites.json/master.png. 공통 frame1.png와 manifest.json, standalone rebuild.py 포함. 기본은 최신 b-05(눈 한줄 차이/오른눈 한줄·입꼬리만 미세하게)이며 최초 후보나 b-04로 되돌리지 않는다.

공통 액자1·1254² RGBA·22×22/50px/원점77. low 인물 배경 실제 투명·셀마다 단색·액자는 원래 고해상도. ‘128’은 승인된 화풍 이름이다. 기본과 얼터는 반대 각도. 얼굴 폭/턱/눈·윗가슴 크롭을 확인했고 원본/low/격자를 모두 보존했다.

현재 수신판과 같은 방식으로 low에서 768² WebP(품질95/alpha100/method6)를 만들어 `public/ui/portraits/julia.webp`, `julia_mad.webp`에 넣고 `src/portraits.js`에 연결했다. 기본 pixel 모드와 예비 모드 fallback, 패배 창에서 실제 로드 확인. 기존 36개 프로필/게임 이미지는 수정하지 않았다. 전체 목록은38개. 재생성 도구 `tools/ui/portraits_px_build.py`에 새 두 작업만 추가했다.

## 검증과 한계

- 최신 기준과 전달판 각각 5관문 실행. fights12/live_battery/finish_thrust/weapon_smoke stdout 해시 동일. corr_s0 12건 IDENTICAL, stdout 차이는 실행 시간뿐. 이전 제작 때의 오래된 관문 해시 대신 최신 기준과 비교했다.
- 기존35캐릭터의 시트·AI·여정/방랑 배열 불변. Fighter/AI/config/gait/main/lobby/학교/저장/패키지 파일 불변. 기본·얼터의 승인 외형 geometryHash 동일, 새 두 캐릭터의 물리/AI 동일. 몸·손 장식 보임/정리·갑옷0 검사.
- 프로필 원본/low/grid를 보존 master/셀/액자에서 재구성해 RGBA 픽셀 동일. 기본 원본·low·grid는 b-05와 바이트 동일. PNG6개 및 게임 WebP2개·투명/두눈/상반신 크롭 검사. 기존 프로필 테스트5개 통과; 총수36→38과 새 마스터 경로만 갱신.
- 전체 npm run build/PWA 빌드 통과. 컴파일 게임에서 기본/얼터 각각 상대·직접조작, 터치 막기/공격·물리좌표 유한·저장 불변·프로필 패배창 로드/표시 확인. 수치 밸런스/실물 휴대폰 GPU 성능을 보장하는 시험은 아니다.
- 브라우저 촬영 첫 시도에서 확대 사진용 UI 숨김 스타일이 패배창 촬영에도 남는 검수 도구 오류를 발견했다. 해당 스타일을 제거하고 실제 visible 조건까지 확인하도록 수정해 재검증했다. 게임 코드 오류나 자산 변경은 아니었다.

`gates-comparison.json`, `compatibility.json`, `checks.json`, `profile-validation.json`, `portraits-tests.log`, `browser-qa.json`과 실제 사진 참조. 초기 source checks에서 물리비교는 최신판 기본/얼터끼리, 승인 외형 보존은 이전 소스와 geometryHash로 확인한다.

```sh
node docs/import/julia_20261030/check.mjs
node docs/import/julia_20261030/compatibility.mjs
python art/julia-profiles-20261030/rebuild.py --check
node --test tools/sim/portraits.test.mjs
python docs/import/julia_20261030/gates.py
npm run build
# dist를 HTTP로 띄운 뒤 JULIA_GAME/BROWSER_OUT을 지정해 browser.mjs 실행
```

check.mjs는 함께 보낸 approved-geometry.json의 승인 외형 해시와 비교한다. compatibility.mjs는 위 수신 기준을 별도 worktree로 연 절대 경로를 RECEIVER_ROOT에 지정한다. gates.py는 GATE_ROOT/GATE_OUT으로 기준판/전달판을 각각 지정할 수 있다. 이미 수행된 결과는 JSON으로 보존했다.

되돌림: 전달 두 커밋을 역순 revert. 새 ID 두 개·외형 훅·프로필 목록/이미지만 제거하며 저장 마이그레이션은 없다. 코드 발송·상대 열람·본판 적용·배포 완료는 별개 상태다.
