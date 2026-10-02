# 모바일 세로 드래그 입력 보정 1차

기준 소스 `7b72c4e` + 디렉터의 미커밋 선택형 통합. 2026-10-02. 최신 사용자 요청은 엄지의 세로 이동 폭·속도가 가로보다 작으므로 같은 조작 의도를 더 큰 세로 입력 값으로 전달하는 것이다. 실제 엄지 가동 범위의 사람 실측은 없으며, 배율1.35는 작은 초기 시험값이다. **선택형 런타임 통합·실제 입력8조건·전투 dispatch4조건·완성 빌드2조건 검증 완료, 일반 기본은1이다.**

## 현재 매핑과 보정 위치

`src/input.js`의 잠금 없는 포인터 경로는 `scale = 2.6 / max(320, innerHeight)`로 가로·세로에 같은 배율을 쓴다. 오른쪽 `Δx`는 손 목표 `+x`, 위쪽 `-Δy`는 손 목표 `+y`다. 높이390px에서 위40px 이동은 기존 `.266667m`, 배율1.35는 `.36m`가 된다. 같은 시간의 가로54px 이동과 같은 입력 이동 거리/속도다. 화면 높이 정규화와 최소320px 분모는 유지한다.

입력은 `main.js`의 `consumeHandDelta()` → `handOffset` → `Skill.update()`로 들어간다. 기존 도달 반경·속도 필터·베기 문턱1.5m/s·이어베기·자동 복귀는 그 뒤에 남는다. 보정된 손 목표 속도로 베기 문턱을 더 일찍 넘을 수 있다. 이 보고는 칼끝 속도·피해·근력·자연스러움 개선을 측정한 결과가 아니다.

새 순수 헬퍼 `src/mobile_intent.js`는 `pointerType === 'touch'`의 세로 이동만1.35배 한다. 잠금 마우스는 기존 별도 경로이며, 잠금 없는 마우스와 펜은 기존 매핑을 반환한다. 힘/에너지 배율·자동 칼 방향·시간에 따른 추가 입력을 만들지 않는다. 일정 배율이므로 이벤트를 여러 개로 나눠도 합계가 같고 손을 멈추면 입력도0이다. 원래 화면 픽셀로 계산하는 탭 거리와 화면 터치 흔적은 보정하지 않는다.

`?mobileVerticalGain=1`은 원래 매핑, `=1.35`는 초기 후보다. 허용 범위1–1.8 밖이나 잘못된 문자열은 기본 배율로 복귀한다.1.8은 실측 최적값이 아닌 입력 변경 폭을 제한하는 탐색 상한이다. URL은 현재 접속만 설정하며 저장 설정을 쓰지 않는다. 선택형 실험으로 유지할 경우 설정 함수의 두 번째 인수에1을 전달한다.

## 검증 상태

- `node tools/sim/mobile_intent.test.mjs`: **51검사 PASS**. URL 유효/무효·경계·원래 매핑 exact·가로 유지·마우스/펜 유지·상하 대칭·같은 거리/속도·1/4/12/120이벤트 분할·hold0·왕복·원본 픽셀 불변을 확인했다.
- `node --check src/mobile_intent.js`, `node --check tools/browser/mobile_vertical_probe.mjs`: 문법 검사 PASS.
- 실제 런타임 파일의 통합은 디렉터가 측정 동결 해제 뒤 순차 수행했다. 이 담당자는 기존 런타임·build·서버 재시작·커밋·push를 수행하지 않았다.
- **실제 Input8조건 PASS**: 세로390×844/가로844×390 화면×기본1/명시1/1.35/1.8. Chrome의 원래 터치 이벤트로 가로/상하/대각선·같은250ms로 요청한20/40/60px 이동·분할·170ms/11px 탭·60ms/14px 드래그·취소·마우스/펜 fallback을 검사했다. 마우스/펜 fallback은 실제 핸들러에 합성 포인터를 전달한 범위다. 잠금 마우스 브라우저 실측은 하지 않았다.
- **실제 전투 dispatch4조건 PASS**: 공개 비교 HTML의 A/B URL, B 재로드, 일반 복귀. 원래 메서드를 한 번 호출하는 관찰 wrapper로 frame 소비 전/후 delta를 기록했다. A/B URL은 배율만 다르고, 둘 다 한손 sabre·상대 longsword·기본 팔/절삭·보정0/난이도normal이다. 저장값0.7/hard로 진입해 UI·실행값0/normal, 고정 버튼 disabled, 다른 trail 설정 저장 뒤 원래0.7/hard 보존, 재로드 유지, 일반 접속의0.7/hard 복귀를 확인했다.12제스처 모두 world가 진행했고 두 전투자의 강체 상태가 유한했다. 적의 성격 난수까지 같은 실제 결투는 아니며 동일 설정 검증이다.
- **완성 빌드4202의 A/B2조건 PASS**: source 모듈을 import하지 않고 실제 비교 링크→메뉴/runtime0/normal·저장0.7/hard·기본 팔/절삭·world 진행을 확인했다. 이 검사는 입력 이동량을 다시 계측한 검사가 아니다.
- 브라우저 pageerror0. 실제 모바일 좌표의 float32 반올림에는 입력 거리1µm 허용값을 사용했다. 순수 헬퍼 검사의 허용값은1e-12m이며 원래 매핑 exact 검사는 `assert.equal`이다.

가로 화면 높이390px의 실제 전투 입력 합계는 아래와 같다. 손 위치·칼끝 속도가 아닌 `consumeHandDelta` 합계 + 남은 pending delta다.

| 조건 | 위20px | 위40px | 아래40px | UI/runtime | 저장값 |
|---|---:|---:|---:|---|---|
| A·기존1 | .133333m | .266667m | -.266667m | 0/normal | .7/hard |
| B·1.35 | .18m | .36m | -.36m | 0/normal | .7/hard |
| B·재로드 | .18m | .36m | -.36m | 0/normal | .7/hard |
| 일반 복귀 | .133333m | .266667m | -.266667m | .7/hard | .7/hard |

## 실행 근거와 실패

세 원자료의 JSON 내용과 원본 SHA256을 [커밋 대상 보관본](mobile_vertical_input_round1_metrics.json)에 함께 보존했다. 원래 JSON 바이트를 다시 직렬화한 내용 보관이므로 보관본 자체의 해시와 각 원본 파일 해시는 다르다. GitHub 전송 전에는 이 보관본도 로컬 저장소에만 있다.

실제 입력8조건의 원자료는 `/tmp/mobile-vertical-browser.json`이며 SHA256은 `312fe8f788da5a94edf6921f3fcc43ff559c9a0c0fadf13dfe36feeef351d1d0`다. 초기 all 회차의 입력8조건은 완료했지만 이어진 전투 관찰 harness가 멈춰, 전투만 분리 재실행했다. 전투4조건 원자료 `/tmp/mobile-vertical-live-browser.json`의 SHA256은 `0e10365928e536552e987634e75e6ab68c290cab452073c98a76113afc0fdcf8`다. 완성 빌드2조건 `/tmp/mobile-vertical-production.json`의 SHA256은 `ded2c3a5c14d1a0946ed3b4e2f67eb4304b7ca898f0cfc2be1c3f5e201c08ae3`다. 이 경로는 로컬 임시 원자료이며 외부 백업을 뜻하지 않는다.

실패/수정은 런타임 결함으로 판정하지 않았다.1) sandbox 내 Chromium은 socket 권한으로 SIGTRAP, 자동 승인된 실행 범위 밖 프로세스로 재시도했다.2) CDP 확인이 마지막 pointermove 전달보다 빨라 측정 시점에2RAF를 기다리도록 수정했다.3) Chrome 좌표 반올림 약2e-7m에 맞춰1µm 허용값을 명시했다.4) Vite가 실제 Input import에 `?t=`를 붙여 별도 클래스의 wrapper를 관찰하던 오류를 실제 module URL로 고쳤다.5) main의 `{ Input, attachStick }` import를 단독 Input으로 가정했던 정규식을 수정했다. 제어 메서드 호출 횟수·반환값은 바꾸지 않았다.

작업량은 헬퍼1개·Node 검사1개·browser 도구1개·보고1개와 browser harness 재시도다. 이번 회차의 전체 벽시계 소요는 정밀 기록하지 않았으며 속도/비용 개선 배수를 선언하지 않는다. 다음 실행부터 browser 도구가 UTC 시작/종료와 `wallTimeMs`를 원자료에 남긴다. 실제 전투의 각 요청250ms 제스처에서 관찰 world 진행은 .792–.933초였으므로 해당 자료를 같은 시뮬레이션 속도로 실행한 물리 비교로 사용하지 않는다.

검증 뒤 현재 입력 관련 파일 SHA256: `src/input.js`=`f6a73744e19090c0406b6cf4229081e7fea24435d89d18e1af682de201ff9ae7`, `src/main.js`=`e5f01393f57476fab08db632ed5c9071f698109f9d043a8e8fea70118fbe3c0d`, `src/mobile_intent.js`=`b0f1ccc7fd66fb1d083c69f19562cfe09d9198141f48b61f25a82bfcf7a23606`다. 원자료의 입력8조건 중에는 main 표시 문구만 고치는 디렉터 작업이 겹쳤으나 해당 독립 페이지는 main을 import하지 않았다. 전투 단계는 그 뒤 새 페이지로 진입했다.

## 적용한 통합 계약과 재현

`src/input.js`에 import를 추가한다.

```js
import { configureMobileIntent, mapMobileHandDelta } from './mobile_intent.js';
```

생성자에서 접속 URL을 한 번 읽는다. 디렉터의 통합 방침은 일반 기본1을 유지하고 URL1.35로 보정 후보를 비교하는 것이다.

```js
this.mobileIntent = configureMobileIntent(new URLSearchParams(window.location.search), 1);
```

`onMove()`의 잠금 없는 포인터에서 기존 scale/handDX/handDY 세 줄만 다음으로 바꾼다. 앞선 `press.moved`와 뒤의 `lastX/lastY/trail`은 유지한다.

```js
const d = mapMobileHandDelta({
  dx: e.clientX - this.lastX,
  dy: e.clientY - this.lastY,
  height: window.innerHeight,
  sensitivity: INPUT.touchSensitivity,
  pointerType: e.pointerType,
  verticalGain: this.mobileIntent.verticalGain,
});
this.handDX += d.x;
this.handDY += d.y;
```

개발 서버를 이용해 실행한다. 서버 시작/재시작을 이 도구가 수행하지 않는다.

```sh
node tools/sim/mobile_intent.test.mjs
HALFSWORD_MOBILE_GAIN_DEFAULT=1 node tools/browser/mobile_vertical_probe.mjs http://127.0.0.1:4201/
# 이번 전투 단계의 실제 성공 명령:
HALFSWORD_MOBILE_GAIN_DEFAULT=1 HALFSWORD_MOBILE_PHASE=live HALFSWORD_MOBILE_INPUT_OUT=/tmp/mobile-vertical-live-browser.json node tools/browser/mobile_vertical_probe.mjs http://127.0.0.1:4201/
```

브라우저 원자료는 기본 `/tmp/mobile-vertical-browser.json`에 쓴다. 실제 게임 검증으로 넓힐 때는 보정 꺼짐/약/보통·같은 입력과 도달 반경을 확인하고 입력 보정과 검술 보정의 상호작용을 따로 판정한다.1.35 수락과 배포는 이 순수 매핑 검사로 선언하지 않는다.
