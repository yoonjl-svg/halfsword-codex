# 전체 작업 재전달 — 2026-10-21

사장님: **“여기까지의 모든 작업을 다시 우화의 규약에 맞추어 전달해.”** 화면 검토 뒤의 이번 직접 지시를 전달 승인으로 삼았다. 우화 최신 본판 `2362985fd74c5e14fd3bfde87f85dd7c12b514ff`에서 전용 가지 **`codex/content-handoff-20261021-final`**를 만들고 이번 기능만 얹었다. 우화 저장소 쓰기0. 실제 열람·채택은 발행과 별개다. 결과 SHA와 범위는 전달 메시지/manifest에 고정한다.

## 1. 가져갈 커밋과 변경 범위

1. `e78e90b2dbbbb7d77b1935ba11d215456e58ec21` — 환도·크리그스메서 최종 모델/물리/썸네일,6파일. 이전 시안1.65kg/중간1.48kg가 아닌 **최종1.50kg**.
2. `2d392f6459e00efbd5e728bb0a7fe7d2fa4a5926` — 밤 중정/중앙 정수탑 파손·누수,8파일. 새 형상3파일과 작은 등록/음향/엄폐 연결, 마야 backstory 한 항목.
3. 뒤따르는 자료 커밋 — 기존 원본279파일·과거 전달 메시지31파일, 연구 계보/검증/재현 도구. 원본은 [manifest](source-manifest.json)의 SHA256과 동일하다.

`src/main.js`·`index.html`·설정/저장/계정·AI·보법·유파 몸꼴·기력·막아찌르기·쿠사나기 기운·스킬트리 설계는 수신판 그대로. 공용 fighter에는 선택적 칼집 시각소품 연결2줄만 추가했다. [보존 검사](verification/compatibility.json): 기존26무기 정의·물리와 보호 대상18파일 동일. 새 모델은 별도 파일에 있고 기존 무기 코드를 전체 교체하지 않았다. 저장 형식/새 저장 키 없음.

## 2. 최종 구현

| 항목 | 최종 내용 | 원자료/사진 |
|---|---|---|
| 환도 | 동방 커먼, 한손 외날. 날72cm/전체88.9cm/.90kg. 부산 군용 환도 사진의 완만한 휨·투각 코등이·갈색 감개·검은 칼집/고리 | [최종 모델/사양](../../design/weapon_historical_finish_20261021/README.md) |
| 크리그스메서 | 독일 레어, 양손 외날. 날95cm/전체123cm/**1.50kg**. Knecht MkII 날85→95cm, 홈·벌어진 나겔·관형 리벳 | 같은 문서, [질량 추산](../../design/weapon_historical_finish_20261021/MASS_REVIEW.md) |
| 밤의 봉인의 중정 | `courtyard_night`/`samira_mad`(현재 세이버).03:00 포격 폐허·검은 연기·무너진 회담 자리 | [포격 폐허](../../design/courtyard_ruins_20261021/README.md) |
| 중앙 정수탑 | 한쪽 지붕/처마·물받이 부분 파손, 불규칙한 물방울/누수/파문·젖은 자국. 엄폐9충돌/시작점1.10·1.60 유지 | [최종 파손/누수](../../design/courtyard_cover_damage_20261021/README.md) |

중정 확정 서사: 평화 사절단의 비밀회담에 관한 명령서가 제때 전해지지 않아 오인 교전이 큰 전쟁으로 번짐. 화포가 표준화된 세계의 포격 폐허. 소금 사막의 상인 위장 암살단/술탄 암살 모의·다라이시 살육 서사와 다르다. 중정 탈출/군마/장맛비/문서고 초기안은 폐기된 구상으로만 보존했다.

**밤 중정은 빌더·이름·상대 등록까지이며 정식 `STAGE_ORDER` 편성은 이번 전달에서 바꾸지 않았다.** 여정29판/아르토리아의 낮·밤 대성당 공유는 수신판 그대로. 새 밤 중정은 직접 테스트할 수 있고, 정식 여정에 언제 배치할지는 우화 쪽 채택 단계다. 기본 마야 리볼버와 광기 마야 세이버를 혼동하지 않는다.

환도 유물의 무게는 공개되지 않았고 .90kg는 게임 추정값이다. 칼날72cm는 실물47cm를 게임용으로 늘린 사용자 선택이다. Knecht MkII는 박물관 유물 하나의 정밀 복제가 아니라 현대 역사 재현 제작검이다. 부품 고정300~500g 가정에서 날+10cm의 증가104~127g, 최종+120g. 구천검 전체55.7cm/875g에서85cm로 길이비례하면1.335kg, 현행1.2129kg는 약9% 가벼운 각색이며 이번에는 변경하지 않았다. 원유물 사진은 공공누리 조건을 고려해 배포 에셋에 복제하지 않았다.

검토 링크: [무기 사진·대련](https://yoonjl-svg.github.io/halfsword-codex/encounters/weapons-historical-20261021/) · [밤 중정 사진·대련](https://yoonjl-svg.github.io/halfsword-codex/encounters/courtyard-ruins-20261021/). 이 공개판은 각각 당시 소스 기준이다. 이번 최신 수신판 통합 화면은 [verification/shots](verification/shots), [환도](verification/hwando-front.png), [크리그스메서](verification/kriegsmesser-front.png)에 새로 촬영했다.

## 3. 신규/미전달 연구도 포함

- [이베리아 어깨 포함 비교](../../research/iberian_talho_outward_20261019/README.md): 두 동작 모두 힘 상한80% 감소/.60유지+.40복구.96전+연장8전. 첫1초 이득이5초에 뒤집히고30초 패배가 기존4→6/쓸기4→7. **두 조합 모두 정식 채택 추천하지 않음.** 앞서 보낸 어깨 축 제외80% 시험과 구별한다.
- [무혜택 AI144판·기존 자세 빈도](../../research/iberian_ai_league_20261019/README.md): 다섯 유파 기존11승16패33무/쓸기11승17패32무. 발동3/60이라 우위 근거 없음. 기존 탈류·레베스 자세13회/60판(11판 사용), 신선한 칼 접촉7회/4판. 자세 선택·접촉·깨끗한 방어 성공을 같은 분모로 세지 않는다.
- **설계 차이 정정:** 기존 outward24는 탈류·레베스가 선택되고 실제 접촉한 뒤 쓸기를 덧붙이는 방식이었다. 사용자가 기대한 ‘방어를 선택하는 즉시, 접촉 전부터 새로운 손길로 방어’의 완성 구현이 아니었다. 기존 쳐내기 몸꼴을 대체했다고 설명하지 않는다. 현재 우화의 탈류/레베스 튕김과 팔힘 설정을 이번 자료로 다시 덮어쓰지 않는다.
- [중정 엄폐 원문 검토](../../research/courtyard_cover_review_20261019/README.md), [48전·카메라 연구](../../research/courtyard_cover_study_20261019/README.md): 사람 대본의 엄폐 둘레 이동에는 이득, 접근/공격에는 확인 못 함. 사용자가 마야 행동 수정을 우화에 맡겼고 이후 우화가 사선·시작점·카메라를 채택한 최신판을 이번 밤 무대의 기준으로 보존했다. 과거 후보 패치를 다시 적용할 필요 없음.
- [추첨 책 검토](../../design/weapon_draw_books_20261021/README.md)는 당시5권 구조의 역사 자료다. **최신 우화11칸 스킬트리/편지 설계를 대체하는 지시가 아니다.** 사용자의 장기 방향은 등급별 유파 빈칸을 고르게 채우기. 별도 등급 우대 책은 검토안이며 확정 구현하지 않았다.

새 카드24종/추첨23묶음(간장·막야1묶음) 기준 첫 카드 확률과 해당 유파 편지×2의 계산을 갱신했다. 직전 무기 제외는 최신 우화에서 삭제된 상태다. [재계산 원자료](verification/probabilities.json), 실제 추첨550경로와 대조한 [계약 검사](verification/contracts.json). 이 편지 배율은 계산 예시이며 게임 추첨 코드를 바꾸지 않았다.

| 유파 | 기본 첫 카드 | 해당 편지×2 예시 |
|---|---:|---:|
| 독일 |18.70%|30.63%|
| 이탈리아 |10.29%|17.33%|
| 이베리아 |17.04%|28.13%|
| 일본 |11.95%|19.83%|
| 동방 |20.99%|33.74%|
| 무유파 |21.04%|—|

환도 단독8.00%, 크리그스메서 단독6.75%. 두 무기가 들어오면서 동방 커먼/독일 레어 빈칸이 채워진다. 따라서 우화의 편지 표에 남아 있는 종전 독일14.0/동방15.2% 등은 이 새 무기 묶음을 채택할 때 함께 갱신해야 한다.

## 4. 이전 작업 전체 색인

이전 전달 메시지31파일(MD/JSON)은 [prior-messages](prior-messages)에 원문 보존했고 [manifest](prior-messages-manifest.json)로 확인한다. 관련13개 소스 커밋도 이번에 원격 존재를 확인했다. 아래는 원자료 주소이며 **옛 패치를 최신판에 전부 다시 합치라는 뜻이 아니다.** 이미 적용된 것을 재적용하면 후속 변경이 되돌아갈 수 있다.

| 묶음 | 고정 원본 |
|---|---|
| 기력 · 실제 접촉 시간 보정 | [47b2e16e](https://github.com/yoonjl-svg/halfsword-codex/tree/47b2e16e0be328c21e703b2322a46e1c945bc4e5) |
| 밤 무대 · 얼터 1차 · 습지 날씨 | [c09e074b](https://github.com/yoonjl-svg/halfsword-codex/tree/c09e074bd3b6ba59ac950e18bc6680f15c6b9c72) |
| 밤 후속 · 황약사의 검 · 다라이시 · 마야 · 아르토리아 | [3854cc41](https://github.com/yoonjl-svg/halfsword-codex/tree/3854cc41a1e56df6cc02ea98d880e971fe831b89) |
| 막기 읽기 · 동방 안정성 전체 | [c7c2131e](https://github.com/yoonjl-svg/halfsword-codex/tree/c7c2131eb741d197be3041d4fe596171ad8ec185) |
| 일본 막기 · 흘림 전체 | [c8ca9c34](https://github.com/yoonjl-svg/halfsword-codex/tree/c8ca9c340527de0d60e88d4117f555f248d45d7e) |
| 기본/얼터/플레이어1·2 원본·low·grid · 액자1·2·3 | [f0f8fc45](https://github.com/yoonjl-svg/halfsword-codex/tree/f0f8fc45b0297fb1fe8d2811a6a15b60004aee06) |
| 앱 아이콘 · 오프라인 정정 | [d1eaf676](https://github.com/yoonjl-svg/halfsword-codex/tree/d1eaf676e3c7437d033da915f86377460c654ff2) |
| 이베리아 충격/동작/제어 연구 원본 | [512716b3](https://github.com/yoonjl-svg/halfsword-codex/tree/512716b3cd00e3c41675a0d3c04f9b8a385c5f54) |
| 이베리아 유지 시간 · 1/5/30초 재평가 | [d0755fe8](https://github.com/yoonjl-svg/halfsword-codex/tree/d0755fe8bf644eada33baad9db31ef3ac6a2b1d7) |
| 이베리아 힘 상한 · 80% 공개 시험 | [7eafdf5f](https://github.com/yoonjl-svg/halfsword-codex/tree/7eafdf5f329c6ddcbac33d7acb9af29c6afbe830) |
| 이베리아 어깨 포함 비교 · 무혜택 AI · 기존 자세 빈도 | [48ab6a2c](https://github.com/yoonjl-svg/halfsword-codex/tree/48ab6a2c1037d1c3be663c55d9289a8e2f4ad1f5) |
| 레이피어/막아찌르기 전체 · 입력형 최종 연구 | [0a918469](https://github.com/yoonjl-svg/halfsword-codex/tree/0a9184692af7330052f549ea7a4911ff614f0cfe) |
| 달타냥 · 쿠사나기 · 동방 실물/확률 · 유파 전체 지시 | [c1b01487](https://github.com/yoonjl-svg/halfsword-codex/tree/c1b01487410017e1c1a5310f1d9f29d29efd059a) |

### 최신 수신판에서 확인한 반영 상태

- 참치 둔타2.4, 닭1.2, AI만 리볼버 간격×1.8: 실제 코드에 있음. 미전달/미구현 메모로 다시 내지 않는다.
- 입력형 막아찌르기: 실제 이탈리아 유파 전체, 새 누름에1회, 계속 누르면 일반 막기로 복귀. 현재 우화 값 받는 피해50%감소/.60초·주는 피해60%. 우리 과거65%·접촉형 조건으로 되돌리지 않는다.
- 우치가타나 파지 A안·모노호시자오/라이트세이버 자루 외형·쿠사나기 기운: 최신 수신판 그대로 보존. 과거 ‘쿠사나기 기운 미연결’ 메모는 해소됨.
- 스킬트리: 우화2362985f의11칸/관문·편지·확정 이름 보존. 새 스킬트리 코드 자체를 이번 전달에서 구현한 것으로 기록하지 않는다.
- 프로필/아이콘·밤 후속·일본 흘림은 우화가 이후 채택·각색한 현재 상태를 보존했다. 원본/low/grid·실패 실험은 참고 원자료로 다시 찾을 수 있다.

## 5. 검증·재현·한계

- 최신 수신 전후5관문 정상 종료. fights12 `05b9c6f2`, live_battery `289eeb43`, finish_thrust `015fdd7c` stdout 동일. corr12/12 IDENTICAL(전체 파일 해시 차이는 실행시간 꼬리). 기존26무기 smoke 줄 보존+신규2 정상. [전후 로그/해시](verification/gates.json).
- 새 무기8조건·양손 파지/원래 기력 질량·파손·투각/날 콜라이더 검사 통과. 기존26무기 정의/물리 동일, 새 카드550경로 정확 열거.
- 실제 총탄 중앙3발 차단/열린 양옆2발 명중, 양방향 신체 충돌·마야 우회·카메라64조건·전환 정리. [엄폐 검사](verification/night-cover.json).
- `npm run build` 통과. 최종 정적 빌드에서844×390 터치 막기 유지/해제·공격/저장 불변, 두 무기 장착 사진. 밤 중정 연기 이동, 방울16→24/착수15→24, 낮밤4회 전환·충돌9 유지·이전 연출 정리, 브라우저 오류0. 데스크톱 Chromium 모바일 에뮬레이션이지 실제 휴대폰 성능/인간 손맛 검증은 아니다.
- 기존 연구 결과는 당시 원본 엔진의 값이다. 이번 최신 통합에서 대규모 밸런스를 다시 잰 수치로 주장하지 않는다. 새 게임 동작을 채택하지 않은 과거 실패 실험을 재실행할 필요도 없다.
- 준비 중 첫 binary diff에 `--binary`가 없어 적용이 거절됐다. 작업 트리 불변을 확인하고 binary 포함 패치를 다시 만들었다. 첫 corr 요약 집계가12조건+한글 완료줄을13 IDENTICAL로 기대한 실수는12조건 확인으로 수정했다. 게임 결과나 기대 물리값은 바꾸지 않았다.

```sh
npm ci
npm run build
node docs/import/saetbyeol_all_20261021/verification/verify.mjs
node docs/import/saetbyeol_all_20261021/verification/geometry_check.mjs
node tools/sim/courtyard_night_cover_review.mjs /tmp/night-cover.json
# 기본 관문 명령은 verification/{before,after} 로그와 기존 tools/sim/README.md 참조
# 정적 dist 서버의 URL을 다음 도구에 전달(Playwright + Chromium 필요)
node docs/import/saetbyeol_all_20261021/verification/touch.mjs http://127.0.0.1:4541
node tools/browser/courtyard_ruins_review.mjs http://127.0.0.1:4541 /tmp/night-review
```

옛 이베리아 실험을 재현할 때는 원본 커밋48ab6a2c/82102af2 또는 각 README에 지정한 원본을 별도 checkout하고 그곳의 tools/sim 도구를 사용한다. 연구 helper/구판 설정을 이번 정식 src에 섞지 않는다. [과거 소스 확인](prior-sources.json). 원본279파일은 이번 전달에서 바이트 보존한다.

## 6. 적용/되돌림/남은 선택

전달 범위를 순서대로 cherry-pick한다. 우화 main이 더 전진했으면 새 차이만 검토한다. 전체 파일을 과거 포크판으로 덮어쓰지 않는다. 변경 파일 목록은 [package-files.json](package-files.json), 결과 SHA와 마지막 수신 확인 시각은 교환 메시지에 있다.

밤 기능만 되돌리려면2d392f64, 새 무기만 되돌리려면e78e90b2를 revert한다. 자료 커밋은 보존할 수 있다. 실제 사용자 저장에 새 무기 ID가 이미 들어간 뒤 무기 코드를 제거한다면, 사전에 소유/장착 hwando·kriegsmesser를 유지하거나 대응 무기로 이관할 정책이 필요하다. 이번에는 저장 형식·기존 소유품을 바꾸지 않았다. 밤 무대는 정식 여정에 넣지 않아 진행 번호 이동이 없다.

남은 선택: 밤 중정의 정식 여정 위치, 아르토리아 독립 전용 무대, 아직 빈 등급의 새 무기. 이것들을 이미 완성했다고 보고하지 않는다. 실제 코드 채택/배포와 이번 메시지 게시·원격 검증도 구별한다.
