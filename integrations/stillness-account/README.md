# 가입 없는 적막 계정 · 2026-10-11

사용자 결정: 가입 문턱 최소화, 기존 서비스 없음. 자동 Supabase 익명 계정＋선택 이메일 OTP 보관/복원. 비밀번호 없음. 첫 범위는 닉네임과 10개 설정. 진행/전적/순위/인벤토리는 아직 저장하지 않는다.

현재 코드: `/src/account/`. 원본 halfsword는 수정하지 않았으며 원본 최신 코드 호환을 검증했다고 주장하지 않는다. 우리 fork의 `?account=1`에만 연결했다. `config.js` URL/키는 빈 값이라 공개 준비판은 **기기 저장만** 한다. 준비판의 상태 문구가 계정 저장 성공으로 표시되어서는 안 된다.

## 이식

1. 패키지의 `src/account/`를 대상 Vite 프로젝트에 복사한다. 기존 파일이 있으면 덮어쓰지 말고 비교한다.
2. `npm install --save-exact @supabase/supabase-js@2.117.3`로 공식 SDK와 lockfile을 갱신한다.
3. `backend/README.md`에 따라 본인 소유 Supabase 프로젝트, SQL, 익명 가입, 이메일 보관/복원 발송을 구성한다. 수동 identity linking 설정도 켠다. 설정에 필요한 값은 프로젝트 URL와 **publishable 키**뿐이다. 서비스 비밀 키는 배포하지 않는다.
4. `config.js`의 appId를 원본이라면 `halfsword`처럼 고유하게 설정한다. 두 fork가 같은 GitHub Pages origin이면 앱ID별 저장키를 사용하되 동일 origin 자체는 보안 경계가 아님에 유의한다.
5. 게임 초기화/설정 UI 준비 후 아래 adapter로 `mountAccount`를 한 번 호출한다. 계정 전용 게임 설정키도 appId별로 구분한다. 우리 구현 예시는 `game-adapter.patch`지만 원본에 자동 적용하지 않는다.

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

설정 변경 완료 시 listener에 전체 설정을 전달한다. 메뉴가 닫혀 있으면 계정의 설정을 보류하고 다음 메뉴에서 '저장된 설정 적용'을 사용한다. 게임 플레이/렌더 루프는 네트워크를 기다리지 않는다. 페이지 안내 `account.html`도 복사한다.

## 저장/계정 전환 원칙

- SDK가 인증 세션을 appId별 키로 유지/갱신한다. 비밀 관리자 키를 사용하지 않는다.
- 설정 snapshot은 앱＋사용자UID별 분리. 새로운 계정으로 로그인할 때 이전 계정 설정을 합치지 않는다.
- 서버 CAS revision으로 다른 탭/기기의 최근 저장을 무단 덮어쓰지 않는다. 충돌 시 명시적으로 서버 저장을 불러오며 기존 로컬본은 UID별 backup에 남긴다.
- 게스트→이메일 연결은 `updateUser`＋`email_change` OTP, 기존 계정 로그인은 `signInWithOtp(shouldCreateUser:false)`＋`email` OTP. 기존 게스트 UID 유지와 이메일 실발송은 라이브 검증이 필요하다.
- 기기 보관/계정 저장/미전송 상태를 구분한다. 세션을 잃었다고 새 게스트를 몰래 만들지 않는다.
- 로그아웃은 연결된 계정만 제공하며 해당 기기의 세션을 끝낸다. 서버 데이터/다른 기기 세션은 삭제하지 않는다. 계정 삭제 UI는 아직 없고 관리자 Auth 삭제 시 SQL cascade로 저장이 삭제된다.
- 저장 내용은 설정뿐이며 클라이언트 수치를 신뢰하는 순위/재화 시스템이 아니다.

## PWA와 운영 연결

기존 PWA SW는 동일 origin 정적 허용 목록만 캐시하므로 외부 Supabase Auth/REST 응답을 캐시하지 않는다. 새 코드가 포함된 정적 build/manifest를 다시 생성해야 한다. cache 안에 계정 세션/개인 저장을 넣지 않는다. 홈 화면 설치나 오프라인 자산 보존은 별도 PWA 검증이며 이 패키지로 완료되었다고 보지 않는다.

공개 URL에서 자동 게스트 생성을 켜기 전 익명 가입 한도·용량 모니터링, 운영 메일 발송 설정, 기본 개인정보 안내와 삭제 요청 경로를 마련한다. CAPTCHA를 켜면 해당 토큰 UI 연결이 필요하며 현재 구현에는 없으므로 설정만 켜면 게스트 생성이 막힌다. 이메일/토큰을 로그에 출력하지 않는다.

## 재현 검사

- `node --test tools/account/controller.test.mjs`
- `node integrations/stillness-account/backend/run-tests.mjs /tmp/halfsword-account-dbtest` (PGlite 임시 설치는 backend README)
- `npm run build`
- `node tools/account/browser.mjs <base URL> <artifact directory>`

SQL fixture와 클라이언트 가짜 transport 검사는 실제 Supabase Auth/메일/PostgREST 개통 증거가 아니다. 운영 전 backend README의 live checklist를 완료한다.

근거: Supabase 공식 [anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous), [passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless), [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod). 원격 원본 자료나 상대 신규 기록은 이번 작업에서 열람하지 않았다.
