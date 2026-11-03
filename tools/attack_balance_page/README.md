# 유파 공격 연구 시험 페이지

기준 게임 `88a96061e8dd93e8f107b7b0df647a341e73fa5d`를 그대로 재사용한다. 연구용 Vite 설정의 `transformIndexHtml`만 저장격리 bootstrap과 `src/attack_balance_probe.js`를 넣는다. 기본 `vite.config.js`, `index.html`, `game_entry.js`, 전투·입력·밸런스 파일에는 연결하지 않았다.

## 실행과 배포 산출물

저장소 루트에서:

```sh
node node_modules/vite/bin/vite.js --config tools/attack_balance_page/vite.config.mjs
node node_modules/vite/bin/vite.js build --config tools/attack_balance_page/vite.config.mjs
node node_modules/vite/bin/vite.js preview --config tools/attack_balance_page/vite.config.mjs --host 127.0.0.1 --port 5299 --strictPort
```

개발 주소는 `http://127.0.0.1:5298/`, 빌드 디렉터리는 `tools/attack_balance_page/dist/`다. 디렉터리 내용을 `/encounters/attack-balance-20261101/`에 놓을 수 있게 base는 `./`다. 이 담당에서는 외부 공개를 실행하지 않았다. 기본 게임 빌드·PWA 설정은 바꾸지 않는다. 연구 빌드에서만 export 없는 PWA 진입을 빈 모듈로 치환해 SW 등록·해제·캐시 작업을 모두 하지 않는다. 기존 test.html도 연구 저장격리를 적용해 함께 빌드한다.

첫 주소는 `?test=1&skillNodes=all&weapon=...`의 기존 시험 규칙을 붙인다. 시작 메뉴의 기존 **여정 시작**을 누른 뒤 작은 연구 패널에서 기술과 시험 방식을 고른다. **새 판 열기**는 선택한 무기의 새 몸을 연다.

- **단발 조건 연습**: **조건 준비**가 기록을 시작하고 거리·칼손 시작 자세를 한 번 준비한다. 대부분은 상대 AI를 정지시킨다. 리솔루토·인콰르타타·고노센·격살은 상대 AI가 정상 움직인다. 실제 발동조건·피해·기력·비기 횟수·특수 식힘을 바꾸지 않는다. 준비만으로 기회가 보장되지는 않는다.
- **자연 30초**: **기록 시작** 후 화면이 보이는 fight 상태의 벽시계 30초를 기록한다. 메뉴·일시정지·백그라운드는 제외하고 죽으면 즉시 끝낸다. 조건 준비는 막는다. 물리 시간과 `TIME.k`를 나눈 기준 시간도 별도 보존한다.
- **기록 끝** / **JSON 받기**: 실제 입력·요청·동작·기술 표시·양측 상처와 생리·기력·원본 접촉 결과를 받는다. 패널은 입력 시도(누름)·요청·실행 확인을 구분하고 현재 거리·맞댐·기력·횟수·식힘 등 부족조건을 표시한다. 한 페이지에서 한 기록이며 다시 하려면 새 판을 연다. 패널 제목을 눌러 접으면 게임 화면을 넓게 볼 수 있다.

연구 저장은 `stillness.research.attack-balance-20261101.` 접두사를 사용한다. 동기 bootstrap은 빌드된 모듈의 static import보다 먼저 실행된다. `clear()`도 연구 키만 지우며 본판 저장을 읽거나 덮어쓰지 않는다.

## 실제 브라우저 입력 재현

```sh
FAST_GEOMETRY=1 node tools/browser/attack_balance_inputs_20261101.mjs http://127.0.0.1:5298 /tmp/attack-balance-20261101/browser-all all
FAST_GEOMETRY=1 INPUT_JITTER=small node tools/browser/attack_balance_inputs_20261101.mjs http://127.0.0.1:5298 /tmp/attack-balance-20261101/browser-small mordschlag,duplieren,schielhau
FAST_GEOMETRY=1 node tools/browser/attack_balance_inputs_20261101.mjs http://127.0.0.1:5298 /tmp/attack-balance-20261101/browser-cingir cingir
node tools/attack_balance_page/verify.mjs http://127.0.0.1:5299 /tmp/attack-balance-20261101/ui-final
node tools/attack_balance_page/clock_check.mjs http://127.0.0.1:5299 /tmp/attack-balance-20261101/clock
node tools/attack_balance_page/pwa_check.mjs http://127.0.0.1:5299 /tmp/attack-balance-20261101/pwa
```

Playwright 기본 위치는 `/workspace/halfsword-encyclopedia-20261031/node_modules/playwright/index.mjs`, Chromium은 `/usr/bin/chromium`이다. `ATTACK_BALANCE_PLAYWRIGHT`와 `PW_CHROMIUM`으로 운전기의 위치를 바꿀 수 있다. 게임 의존성이나 lockfile에 Playwright를 추가하지 않았다.

운전기는 CDP의 trusted touch를 실제 Input·스틱·막기 DOM 리스너로 보낸다. `skill.secret`, `openWindow`, `fire`를 직접 호출하지 않는다. probe의 기존 함수 래핑은 관측만 한다. **자동 입력의 발동 관측**이며 인간 성공률이 아니다. `FAST_GEOMETRY=1`은 자동 검증에서만 `game.scene.visible=false`로 그리기 부하를 줄이고 PNG 전에 복원한다. 사람 페이지는 정상 렌더다. 조건 참값을 보는 운전이므로 화면 단서에 반응하는 사람의 능력으로 해석하지 않는다.

`INPUT_JITTER=small`은 각 좌표 ±3 px, 송신 간격 ±25 ms, 창 반응 지연 최대60 ms다. `large`는 ±12 px·±90 ms·최대220 ms다. 실제 전달된 이벤트 시각과 궤적이 원본에 있으므로 설정치만으로 실제 입력을 추정하지 않는다. `INPUT_SEED`는 입력 흔들림, `SIM_SEED`는 초기 게임 난수(기본 둘 다20261101)를 고정한다. 매 표본 새 BrowserContext와 새 몸을 쓴다. 같은 시드를 다시 돌린 파일을 독립 표본으로 세지 않는다.

## 기록 해석

`request_result.accepted`, `unique_counter_change`, `motion_start`, `body_contact_result`는 서로 다른 사건이다. `episodeId`는 긋기 또는 동작 객체의 새 시작을 식별한다. callback 수는 프레임 수·독립 공격 수·상처 수가 아니다. 방어구 둔타의 severity가0이어도 의식 손실이 있을 수 있다. `state='dead'`도 `causeOfDeath='기절'`과 생리적 사망을 나누어 읽어야 한다. 엔진의 비기 landed counter가 사망 프레임에 늦게 반영될 수 있으므로 원본 접촉과 몸 상태를 함께 본다.

초기19종 smoke와 보완 결과·제약은 [입력 연구 기록](../../docs/research/attack_balance_20261101/inputs/REPORT.md)에 있다. 조건 미충족은 위력0이 아니며, 456회 내성·120판 자연 빈도나 사람 성공률을 이 브라우저 smoke로 대신하지 않는다.
