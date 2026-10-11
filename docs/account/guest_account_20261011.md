# 가입 없이 시작하는 계정 준비 · 2026-10-11

사용자 요청: PWA에서 정보를 기억하는 계정, 가입 절차는 최대한 단순하게. 기존 인증/저장 서비스 없음.

결정: 자동 Supabase 익명 계정, 닉네임 선택, 원할 때만 이메일 OTP 보관. 비밀번호/필수 가입 화면 없음. 첫 저장은 이름과 설정 10개다. 기존 PWA처럼 원본에 옮길 수 있는 패키지이며 우리 fork에는 `?account=1` 선택 입구만 적용한다. 일반판 설정/물리와 원본 저장소를 바꾸지 않았다.

**현재 실제 서비스 상태: Supabase 프로젝트 미생성·미연결.** 공개 준비판은 기기 저장만 한다. 가입 완료/서버 저장/다른 기기 복원이라고 표시하지 않는다. 실제 개통은 프로젝트＋익명 가입/수동 identity linking＋DB SQL＋운영 메일 발송 연결 후 live checklist가 필요하다. 설치된 홈 화면 앱의 실제 OS 저장 경계도 미검증이다.

## 구현/검사

기준 `97f5f42`, Supabase SDK2.117.3. 앱/UID별 저장키, SQL own-UID RLS, 직접 쓰기 차단, RPC revision CAS, 입력 whitelist. SDK 세션 갱신을 사용하고 data request는 확인한 UID의 bearer를 고정해 로그인 전환 중 잘못된 계정에 쓰는 것을 막는다. 동시 startup은 게스트 요청 하나로 합친다. 로컬 변경은 응답 성공 전까지 dirty로 보존한다. 충돌은 사용자에게 선택을 요구하며 임의 덮어쓰기를 하지 않는다.

- 실제 SQL(PGlite PostgreSQL fixture): 23assertions＋28예상 거부 통과, 테스트 데이터 rollback 확인. Auth 자체/SMTP/PostgREST/여러 연결 동시 CAS 검증이 아니다.
- node controller/공식 SDK의 HTTP fixture: 16검사 통과. 재접속, 이름/설정 검증, blocked storage, 첫 오프라인, 잃은 인증, 저장 중 편집, 계정 전환, 지연 응답, CAS/backup, 이메일 OTP 종류와 wrong UID/비밀 키 거부.
- Vite production build 통과. 계정 모듈은 선택 입구에서만 lazy load한다. 첫 빌드 계정 JS 약226KB(gzip 약60KB), 일반판은 이를 다운로드할 필요가 없다.
- 로컬 모바일 6흐름 통과: 320px 안내, 이름/설정 reload, offline edit, 전투 진입/입력/일시정지/재시작, 일반판 분리. 초기 브라우저 검사 스크립트가 기존 상태 이름을 잘못 사용해 timeout했고 실제 `choose`/`fight` 값으로 교정한 후 통과했다. 제품 실패를 숨기기 위해 문턱을 낮춘 것이 아니다.
- 공개 배포/파일 일치는 별도 release.json에 기록한다. 원본 PWA 최신본은 이번에 열람/수정하지 않아 이식 호환은 미검증이다.

## 재현/후속

`node --test tools/account/*.test.mjs`; `node integrations/stillness-account/backend/run-tests.mjs /tmp/halfsword-account-dbtest`; `npm run build -- --outDir /tmp/halfsword-account-build-20261011`; `node tools/account/browser.mjs URL OUTDIR BUILD`; `python3 -B tools/account/package.py`.

[준비판 안내](https://yoonjl-svg.github.io/halfsword-codex/account.html), [코드/연결 인계](../../integrations/stillness-account/README.md). 계정 삭제 UI·재화/성장·전적/순위는 이번 범위 밖이다. 라이브 서비스 개통은 별도 공급자 계정/권한 없이는 완료할 수 없다. 기본 Supabase 발송은 수신자와 발송량 제한이 있어 일반 이용자 이메일 인증을 보장하지 않는다. 운영 메일 발송 설정 후 실제 이메일/새 기기 복원부터 검사한다.
