# 사운드 PM 인수 보고 (사이트 연결 환경)

작성: 2026-09-28. 새 클라우드 환경에서 사운드 PM을 이어받았다. 아직 구현은 하지 않았고, 디렉터·사장님 지시를 기다린다.

## 1. 인수 확인

- 브랜치 `claude/pm-sound-impact` = main `00c560d` + 인계서 커밋 `1f31d47`(`sound_pm_handoff.md`). `git merge origin/main`은 "이미 최신"이다.
- 읽은 것:
  - `pm-sound-impact.md` 전부(1~14차)
  - `sound_pm_handoff.md`
  - `git log --oneline -40`
- 관문 도구가 이 환경에서 도는 것을 확인했다(아래 4장).

## 2. 사이트 접속 (2026-09-28, 이 환경에서 curl로 확인)

| 사이트 | 페이지·검색 | 파일 받기 | 라이선스 확인 | 비고 |
|---|---|---|---|---|
| freesound.org | 됨 (CC0 거르기 검색도 됨) | **미리듣기 mp3만** 됨 (`cdn.freesound.org/previews/…-hq.mp3`, 128kbps). 원본 받기는 **로그인 필요** | 됨 (소리 페이지마다 라이선스 링크) | API(`/apiv2/`)는 **키 필요**(401). 미리듣기로 충분해서 키는 없어도 된다 |
| opengameart.org | 됨 | 됨 (ogg·mp3 직접) | 됨 (페이지마다 표시, FAQ) | 로그인 필요 없음 |
| kenney.nl | 됨 | 됨 (zip, 예: impact-sounds 800KB) | 됨 (CC0 표시) | |
| raw.githubusercontent.com | - | 됨 (`open-game-sfx-index` 목록 2.5MB) | 목록에 적혀 있음 | |
| archive.org | 검색·메타데이터 API 됨 | **막힘**: 파일이 `dn…ca.archive.org` 등 하위 서버로 넘어가는데 그 주소가 차단된다 | 메타데이터에 라이선스가 비어 있는 경우가 많음 | |
| pixabay.com (+ cdn.pixabay.com) | **막힘** (프록시 403) | 막힘 | 막힘 | |
| sonniss.com | **막힘** (403) | 막힘 | 막힘 | |
| zapsplat.com | **막힘** (403) | 막힘 | 막힘 | 열려도 받으려면 로그인이 필요하다고 알려져 있다 |
| mixkit.co (+ assets.mixkit.co) | **막힘** (403) | 막힘 | 막힘 | |

- 막힌 곳은 모두 이 환경의 네트워크 정책이 거절한 것이다. 사이트 자체의 문제가 아니다.
- 열려면 환경 설정 → 네트워크 접근의 허용 도메인에 추가한다: `pixabay.com`, `cdn.pixabay.com`, `sonniss.com`, `www.zapsplat.com`, `mixkit.co`, `assets.mixkit.co`, `*.archive.org`.
- **로그인 때문에 막히는 곳**:
  - Freesound 원본 파일(미리듣기로 대신할 수 있다)
  - Freesound API(키)
  - Zapsplat 다운로드(열려도 로그인 필요)
- **라이선스 주의**(접속되면 원문을 다시 확인한다):
  - Pixabay·Mixkit·Zapsplat·Sonniss는 CC0가 아니라 각자의 라이선스다.
  - 게임 안에서 쓰는 것은 대체로 허용한다. 하지만 **파일을 따로 재배포하는 것은 금지**하는 편이다.
  - 이 저장소는 `public/sfx`를 공개로 올리므로 걸릴 수 있다. 그래서 CC0(없으면 CC-BY) 출처를 우선한다.

## 3. 사이트 연결이 필요해 미뤄 둔 일

라이선스 원칙:
- CC0를 우선한다. CC-BY는 `public/sfx/LICENSE.txt`와 인계 문서 출처 표에 이름을 적으면 쓸 수 있다.
- CC-BY-SA(같은 라이선스로 공개해야 함)와 NC(비상업)는 피한다.

괄호 안 숫자는 Freesound의 CC0 필터 검색 결과 수다.

| # | 할 일 | 어디서 찾나 | 라이선스 | 출처(문서) |
|---|---|---|---|---|
| 1 | **슈바르츠(margarethe) 죽음 목소리**: 차분한 노장 여검사. 비명이 아닌 낮은 한숨·신음·"하아…", 음 낮추기는 최소 | Freesound "woman sigh"(5), "female groan"(3), "female exhale"(2), "female death"(4) / OGA 목소리 팩 | CC0 우선 | 인계서 5장 2번, 4·9차 |
| 2 | **이졸데(isolde) 죽음 목소리**: 21살 차분한 검사. 짧은 헉·숨 섞인 신음, 비명은 안 됨 | 1과 같은 곳 ("female breath"(2), "woman moan pain"(2) 등) | CC0 우선 | 5장 3번, 6차 |
| 3 | 배경 동물 녹음과 합성 비교 (산새, 말 콧바람·발굽, 비둘기·날갯짓, 박쥐) | Freesound "songbird"(24), "horse snort"(3), "pigeon coo"(7), "wings flap"(7) / OGA | CC0 | 5장 5번(선택) |
| 4 | (선택) VoiceBosch CC-BY-SA 파일 3개(`generic_bleed2`·`bran_bleed2`·`heinrich_bleed2`)를 CC0 남성 신음으로 바꾸기 | Freesound "male groan", OGA | CC0 | 1차 라이선스 표 |
| 5 | (사장님 결정 필요) 1차 때 미룬 소리: 피격 신음·기합, 숨소리, 무기 떨어뜨리는 소리, 관중 함성 | Freesound, OGA, Kenney | CC0 | 1차 "아직 안 한 것" |

- 1·2번 진행 방법(인계서대로):
  - 후보 2~4개를 게임 엔진으로 장면(투구 타격 → 목소리 → 쓰러짐)과 함께 녹음해 사장님께 들려드린다.
  - 사장님이 고른 것만 `public/sfx/voice/`에 넣는다. 추가 용량은 한 번에 약 600KB 이내로 한다.
- 3번의 말 울음은 사장님이 합성본을 뺀 적이 있다. 녹음이 낫더라도 다시 여쭌다.
- 사이트와 관계없이 기다리는 일: **판금 소리 연결**(`plateBlock`·`plateBreak`, 디렉터의 `r.plate` 병합을 기다림). → 방어구 병합에서 연결됐다. 실제 게임에서 들어 보는 확인만 남았다.

## 4. 관문 도구 확인

- 시뮬 3종: main 워크트리(`00c560d`)와 이 브랜치에서 각각 돌려 `cmp`로 비교했다. 모두 **바이트 동일**하다.

| 명령 | 결과 |
|---|---|
| `node tools/sim/live_battery.mjs` | 1344B, 같음 |
| `node tools/sim/fights12.mjs` | 499B, 같음 |
| `node tools/sim/hybrid.mjs fights12.mjs` | 497B, 같음 |

- 브라우저 스모크(`tools/browser/smoke.mjs`, vite 5179): 싸움까지 흘렀고, 콘솔 에러는 0이다.
