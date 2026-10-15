# 첫 화면 계정 연결 · 2026-10-16 KST

구현 `3688f3913acdffed3fbad8c1b47e4d2cab389d4c`. 사용자 요청1 먼저 적용. 포크만 수정하며 유파/보법/전투는 변경하지 않았다. [검사 기록](title_account_20261016_checks.json).

공개 배포: 소스 `8874c7358c154ffd75ea78031569b6b8e0dc2080`, [Pages 실행38764437308](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/38764437308) **Success / 53초** 확인. [포크 게임](https://yoonjl-svg.github.io/halfsword-codex/) · [릴리스 기록](title_account_20261016_release.json). 공개 서버 브라우저 실접속 및 실제 이메일 인증은 아래 한계와 별개로 확인하지 못했다.

## 동작

- 첫 화면 설정을 계정 연결로 교체. 이메일 인증번호/메일 인증 링크로 연결하고, 인증된 이메일 세션에만 `@` 앞 아이디를 표시한다. 긴 아이디는220px까지 늘리고 넘치면 생략하며 전체 아이디는 접근성 이름/툴팁에 제공한다.
- 신규 이메일은 `signInWithOtp(shouldCreateUser:true)`, 기존 계정 로그인은false. 기존 익명 계정은 `updateUser({email})`와 `email_change` OTP로 UID 유지. 메일 요청 응답만으로 연결 완료를 표시하지 않는다.
- 재포크 전 `7ea8162`의 실제 Supabase 공개 설정과 공식SDK2.117.3 재사용. 비밀 관리자 키 사용 없음. 기존 일반/성장 시험판 Auth 저장키 인식(일반 우선). 새 익명 사용자는 자동 생성하지 않는다.
- 이 기기에서 로그아웃,60초 재전송 제한, 오류/만료/미확인 이메일 처리, 인증 변경 구독과 화면 종료 후 응답 폐기. 이메일/토큰을 로그에 출력하지 않는다.
- **범위는 계정 인증 연결. 대기실·여정 서버 동기화는 미포함.** 화면에도 ‘여정 기록은 현재 기기에 저장됩니다.’라고 표시한다. 과거 성장 시험 경제/능력치/프로필을 가져오지 않는다.
- ‘막’만 원본 도트1px 아래.18px 글꼴 대비5.6%로 약5%를 도트 단위로 맞췄다. ‘적’·영문·대기실 제목은 유지.

## 검증·한계

- 빌드 성공. 기본 npm 캐시 경로가 쓰기 불가여서 `/tmp/codex-npm-cache` 사용. 기존 Playwright 도구 설치 재사용.
- `tools/browser/title_account_smoke.mjs`:9통과/예외0. 실제 UI/공식SDK를 실행하고 Auth HTTP 응답만 대체했다. 번호 오류/확인/재전송 제한/재접속/화면 왕복/로그아웃/기존키/익명연결/기존계정/메일 한도 실패/320·390·844·1440폭. **실제 서버나 메일 수신 성공 증거가 아니다.** 최초 모의 오류 응답이 API버전 헤더 없이 `code`를 써 SDK가 구버전으로 읽었다. 검사의 응답을 문서화된 `error_code` 형식으로 수정했다.
- 진입 검사20통과/오류0: 실제 터치 이동·공격·카드·이어하기·전적·설정 보존·재시작.
- 오프라인 재접속/계정 창/기존 장착·출발 통과. 미연결 상태에서 인증 서버를 기다리지 않고 플레이 가능.
- 공통5관문 기력 적용 후 값 유지: fights12 `18a6e736`, live `e7ee3d96`, finish `433ac984`, corr12/12동일, weapon23OK/FAIL0/NaN0 `27b922fc`.
- **실서버 미검증:** 기존 프로젝트 `/auth/v1/settings` GET이 실행 환경 프록시 CONNECT403으로 차단됐다. 우회/메일 발송 없음. 현재 SMTP/수동 이메일 연결/Redirect URL 설정과 실제 메일 수신은 미확인. 이전 `7ea8162:docs/account/live_20261012.md`도 실제 이메일 수신은 미검증이었다.
- 최종 공지 항목은 기능 검사 후 동일 구현 빌드에 추가했다. 공개 Pages 직접 접속도 환경 제한으로 미확인; 배포는 Actions 성공과 구별한다.

## 촬영·이식

[첫 화면](../screenshots/title_account/title-phone.png) · [연결 창](../screenshots/title_account/account-open.png): 실제 로컬 프로덕션 촬영. 합성 없음.

[연결 아이디](../screenshots/title_account/account-linked-mock.png)는 **모의 인증 응답으로 만든 검사 세션**이다. 실계정 인증 사진으로 사용하지 않는다.

이식은 `src/account/config.js`, `title_account.js`, SDK/lockfile, 시작 화면 HTML/CSS/진입 및 도트 글자 함수. 기존 유파·장비·여정 저장키는 변경하지 않았다.
