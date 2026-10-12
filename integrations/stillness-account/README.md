# 가입 없는 적막 계정 · 2026-10-11

사용자 결정: 가입 문턱 최소화, 기존 서비스 없음. 자동 Supabase 익명 계정＋선택 이메일 OTP 보관/복원. 비밀번호 없음. 닉네임과 10개 설정에 더해, 별도 성장 시험 공간에서 승수·코인·성장 포인트·아이템·장식 표시·플레이어 힘 단계를 저장한다. 경쟁 순위·유료 재화·거래는 구현하지 않았다.

현재 코드: `/src/account/`. 원본 halfsword는 수정하지 않았으며 원본 최신 코드 호환을 검증했다고 주장하지 않는다. 우리 fork의 `?account=1`은 이름/설정 준비판, **`?account=1&growth=1`은 성장 연습판**이다. 성장 입구는 두 항목이 각 한 번 있고 다른 query 항목이 없을 때만 켜진다. 무기 고정·연구용 주소와 섞거나 중복 항목을 넣으면 성장 기능이 꺼진다. 우리 배포본은 실제 Supabase 서버에 연결했다. 배포용 게스트 저장·성장 거래는 검증했으며 이메일 인증/다른 기기 복원은 확인 중이다. 이식 ZIP의 `config.js` URL/키는 비워 두어 수신자가 자기 프로젝트를 연결한다.

## 성장 시험 범위

- 임시 규칙: 1승당 10코인, 누적 3승마다 1포인트. 1포인트로 플레이어 힘 1단계, 최대 5단계. 다음 경기부터 근력 계수에 단계당 +2%를 적용한다. 같은 비율의 피해량 증가를 뜻하지 않는다.
- 상점의 `wayfarer_seal`(여행자의 인장)은 30코인 장식이다. 구매·표시/해제를 지원하며 무기·방어구나 전투 능력은 추가하지 않는다.
- 패배·동시 사망·중도 재시작에는 승리 보상이 없다. 카드 선택 뒤 실제 전투가 시작될 때 경기 표를 요청한다. 서버 모드에서는 등록되지 않은 경기와 오프라인에서 새로 시작한 경기에 보상을 주지 않는다.
- 성장 앱 ID는 `halfsword-codex-growth-trial`이다. 이름/설정 앱 ID와 분리하며 일반판 경제는 기본 비활성이다. 원본으로 이식할 때는 성장 앱 ID·SQL 정책도 함께 별도로 정한다.
- **기기 연습의 코인·아이템·강화는 서버로 가져올 수 없다.** 실제 서버를 연결하면 해당 Auth UID의 서버 기록을 사용한다. 기존 서버 계정에 로그인해도 다른 게스트의 성장 기록을 합치지 않는다.
- 서버는 가격·보상·잔액·포인트와 중복 요청을 관리하지만 승패 자체는 클라이언트 보고다. 경기 표·3초 최소 시간·24시간 만료는 서버 심판이나 검증된 부정행위 방지 기능이 아니다.

사용자 안내는 `public/growth.html`, 운영자가 준비할 순서는 [`public/growth-setup.html`](../../public/growth-setup.html)에 있다. 계정＋성장 SQL 합본 `public/account-growth-setup.sql`은 **새 프로젝트에서 한 번만** 실행한다. 기존 계정 테이블이 있으면 `backend/progression.sql`만 추가하는 경로를 사용한다. 세부 RPC·권한·실패/재시도 규칙은 [`backend/PROGRESSION.md`](backend/PROGRESSION.md)를 따른다.

## 모바일 UI · 2026-10-12

성장 adapter를 제공하면 `hub.js`가 기존 제목·설정·시작/재개 DOM을 이동해 여정·상점·보관함·성장·계정·설정 화면을 만든다. 기존 이벤트와 전투 hook은 유지한다. 인장 SVG는 UI 장식이며 캐릭터 장비 메시를 생성하지 않는다. 일반 `?account=1` 계정 패널은 유지한다.

- 상단 코인/계정, 결과 보상, 구매 확인/취소, 보유/장착 상태, 성장 확인. 요청 완료 전 잔액을 미리 바꾸지 않는다.
- 보상/구매/강화 요청이 남아 있으면 다음 경기 시작을 잠시 막고 모든 화면에서 재연결 상태를 표시한다. 보류 결과 때문에 다음 경기 등록이 사라지는 것을 막는다.
- 로그인과 이메일 연결은 별도 단계, 인증번호 취소/수정/재전송 30초 제한, 입력값 보존을 지원한다. 서버 미설정이면 이메일 버튼을 비활성화한다.
- `GrowthController.onSettled`는 처리 완료 알림이다. snapshot 불러오기는 보상 획득 알림이 아니며 알림 예외가 완료된 요청을 재전송하지 않는다.
- 이번 사용자 허가로 원본 `bb181e1590cde3097b66ecab1c0587fbcc8e6129`의 공개 UI만 참고했다. 갈색/크림/금색 색상과 터치 버튼 분위기를 맞췄다. 원본에는 현재 이 성장 UI가 없으며 원본 저장소를 수정하지 않았다.

## 서버 연결 · 2026-10-12

우리 별도 시험판에 공개 Supabase 설정을 연결했다. 게스트 저장·RLS·성장 거래의 실제 서버 검사를 통과했으며 이메일 수신/복원은 별도 확인이 필요하다. ZIP의 config.js는 의도적으로 비워 두므로 이식 시 대상 프로젝트와 고유 appId를 설정한다. 이식받는 앱이 우리 시험 계정/성장 공간에 자동 연결되지 않게 한다.

## 이식

1. 패키지의 `src/account/`를 대상 Vite 프로젝트에 복사한다. 기존 파일이 있으면 덮어쓰지 말고 비교한다.
2. `npm install --save-exact @supabase/supabase-js@2.117.3`로 공식 SDK와 lockfile을 갱신한다.
3. `public/growth-setup.html`과 `backend/README.md`에 따라 본인 소유 Supabase 프로젝트, SQL, 익명 가입, 이메일 보관/복원 발송을 구성한다. 수동 identity linking 설정도 켠다. 앱 연결에 필요한 값은 프로젝트 URL와 **publishable 키**뿐이다. 운영용 이메일 발송은 별도로 구성한다. 서비스 비밀 키·DB 비밀번호·개인 토큰은 배포하거나 채팅에 올리지 않는다.
4. `config.js`의 appId를 원본이라면 `halfsword`처럼 고유하게 설정한다. 두 fork가 같은 GitHub Pages origin이면 앱ID별 저장키를 사용하되 동일 origin 자체는 보안 경계가 아님에 유의한다.
5. 게임 초기화/설정 UI 준비 후 아래 adapter로 `mountAccount`를 한 번 호출한다. 계정 전용 게임 설정키도 appId별로 구분한다. `game-adapter.patch`는 우리 계정 추가 전 기준 `97f5f42`부터 현재 `src/main.js`까지의 전체 adapter 차이다. 원본에 자동 적용하지 말고 생명주기와 설정 side effect를 비교한다.

```js
import { mountAccount } from './account/mount.js';
mountAccount({
  read: () => ({ ...settings }),
  subscribe: listener => settingsChangeListeners.add(listener),
  canApply: () => menuIsOpen(),
  apply: values => {
    // 검증된 설정만 적용. 설정 UI·소리·피·입력 방식·기존 캐릭터 skill과
    // 난이도·pixel resize의 실제 side effect도 갱신한다.
    // 이 함수에서는 subscribe 알림을 다시 발생시키지 않는다.
  },
});
```

설정 변경 완료 시 listener에 전체 설정을 전달한다. 메뉴가 닫혀 있으면 계정의 설정을 보류하고 다음 메뉴에서 '저장된 설정 적용'을 사용한다. 게임 플레이/렌더 루프는 네트워크를 기다리지 않는다. `public/account.html`, `public/growth.html`, `public/growth-setup.html`, `public/account-growth-setup.sql`도 복사한다.

성장을 연결할 때는 `mountAccount`에 `growth: { connect: controller => { /* 게임 adapter에 보관 */ } }`를 제공한다. 경기 재시작 때 `cancel()`, 카드 선택을 마친 전투 시작 때 `applyGrowthStrength(player, controller.state)`와 `begin()`, 최초 종료 판정 때 `finish(player.alive && !enemy.alive)`를 호출한다. 선택적 입구 검사는 `growthEntry`를 사용한다. 힘은 매 경기 snapshot의 절대 계수로 설정하므로 여러 번 적용해도 중첩되지 않는다. 실제 게임 hook 위치는 patch를 따른다.

## 저장/계정 전환 원칙

- SDK가 인증 세션을 appId별 키로 유지/갱신한다. 비밀 관리자 키를 사용하지 않는다.
- 설정 snapshot은 앱＋사용자UID별 분리. 새로운 계정으로 로그인할 때 이전 계정 설정을 합치지 않는다.
- 서버 CAS revision으로 다른 탭/기기의 최근 저장을 무단 덮어쓰지 않는다. 충돌 시 명시적으로 서버 저장을 불러오며 기존 로컬본은 UID별 backup에 남긴다.
- 게스트→이메일 연결은 `updateUser`＋`email_change` OTP, 기존 계정 로그인은 `signInWithOtp(shouldCreateUser:false)`＋`email` OTP. 기존 게스트 UID 유지와 이메일 실발송은 라이브 검증이 필요하다.
- 기기 보관/계정 저장/미전송 상태를 구분한다. 세션을 잃었다고 새 게스트를 몰래 만들지 않는다.
- 로그아웃은 연결된 계정만 제공하며 해당 기기의 세션을 끝낸다. 서버 데이터/다른 기기 세션은 삭제하지 않는다. 계정 삭제 UI는 아직 없고 관리자 Auth 삭제 시 SQL cascade로 저장이 삭제된다.
- 성장 RPC는 현재 UID의 토큰을 고정해 요청하고, 응답 중 계정이 바뀌면 이전 응답을 적용하지 않는다. 미전송 요청도 앱＋UID별 분리하며 동일 UUID로 재시도한다. 시간 부족 `PT425`만 지연 재시도하고 결과/UUID 충돌 `PT409`는 재보상으로 바꾸지 않는다.

## PWA와 운영 연결

기존 PWA SW는 동일 origin 정적 허용 목록만 캐시하므로 외부 Supabase Auth/REST 응답을 캐시하지 않는다. 새 코드가 포함된 정적 build/manifest를 다시 생성해야 한다. cache 안에 계정 세션/개인 저장을 넣지 않는다. 홈 화면 설치나 오프라인 자산 보존은 별도 PWA 검증이며 이 패키지로 완료되었다고 보지 않는다.

공개 URL에서 자동 게스트 생성을 켜기 전 익명 가입 한도·용량 모니터링, 운영 메일 발송 설정, 기본 개인정보 안내와 삭제 요청 경로를 마련한다. CAPTCHA를 켜면 해당 토큰 UI 연결이 필요하며 현재 구현에는 없으므로 설정만 켜면 게스트 생성이 막힌다. 이메일/토큰을 로그에 출력하지 않는다.

## 재현 검사

- `node --test tools/account/controller.test.mjs`
- `node integrations/stillness-account/backend/run-tests.mjs /tmp/halfsword-account-dbtest` (PGlite 임시 설치는 backend README)
- `node --test tools/account/growth.test.mjs`
- `node integrations/stillness-account/backend/run-progression-tests.mjs /tmp/halfsword-account-dbtest`
- `node tools/account/growth-browser.mjs <base URL> <artifact directory> <frozen build directory>`
- `growth-physics.test.mjs`는 우리 게임의 `tools/sim/harness_m.mjs`가 필요한 실제 물리 검사다. 다른 프로젝트에는 해당 게임 연결에 맞춰 이식한다.
- `node tools/account/auth-ui-browser.mjs` (실제 UI＋모의 인증 transport; 실제 메일 증거 아님)
- `npm run build`
- `node tools/account/browser.mjs <base URL> <artifact directory>`

SQL fixture와 클라이언트 가짜 transport 검사는 실제 Supabase Auth/메일/PostgREST 개통 증거가 아니다. 운영 전 backend README의 live checklist를 완료한다.

`tools/account/package.py`는 `src/account/`, `backend/`, `tools/account/` 전체와 위 네 공개 파일, README, adapter patch를 SHA-256 manifest와 함께 묶는다. 코드를 고정한 뒤 patch를 다시 생성하고 패키지를 만든다. ZIP 생성은 서버 개통이나 공개 전달 완료를 뜻하지 않는다.

근거: Supabase 공식 [anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous), [passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless), [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod). 초기 계정 기반 작업에는 원본 열람이 없었다. 10/12 UI 작업에서는 위에 명시한 공개 화면만 사용자 허가로 참고했다.
