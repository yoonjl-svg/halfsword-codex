# 우화 원본용 PWA 전달 묶음 · 2026-10-10

대상: https://github.com/yoonjl-svg/halfsword
검증 기준: `f3792633f5fbb9f66ff643f89879e911c3f75415`

사용자 요청으로 샛별의 게임 개발을 잠시 멈추고 원본용으로 분리 제작했다. 원본 원격/기존 작업공간에는 쓰지 않았다. 게임 소스·물리·콘텐츠·설정 저장 방식과 의존성/lockfile은 변경하지 않는다. 이 묶음은 전달용 소스이며, 원본에 적용·배포되었다는 뜻은 아니다.

## 적용

새 작업 브랜치에서 아래 명령을 실행한다. Node는 원본 Vite 요구 버전에 맞춘다(권장22.12+; 제작 검증24).

```sh
node /path/to/unpacked/apply.mjs /path/to/halfsword --check
node /path/to/unpacked/apply.mjs /path/to/halfsword
cd /path/to/halfsword
npm ci
npm run build
```

`--check`는 쓰지 않고 변경 목록만 표시한다. 실제 적용은 새 파일8개, `index.html`·`package.json` 연결만 추가한다. 기존 동명 파일이 다르거나 빌드 명령이 다르면 쓰기 전에 중단한다. 기존 파일 백업 경로를 출력하며, 같은 패키지의 재실행은 변경하지 않는다. 작업 중인 파일의 동시 편집은 피한다. 원본이 갱신됐다면 diff를 확인하고 다시 검사한다.

`integration.patch`는 기준 커밋에 대한 전체 Git 바이너리 패치다. 자동 도구 대신 `git apply --check /path/integration.patch` 후 `git apply`를 선택할 수 있다. 두 방식을 함께 실행할 필요는 없다.

## 수동 통합이 필요한 경우

1. `overlay/`의8개 파일을 상대 경로 그대로 복사한다.
2. HTML head에 `./manifest.webmanifest`와 `./pwa/apple-touch-icon.png` 링크, apple-mobile-web-app-title을 추가한다.
3. 기존 게임 모듈 옆에 `<script type="module" src="/src/pwa.js"></script>`를 추가한다.
4. 빌드 끝에 `node tools/pwa/build.mjs`를 실행한다. 출력 경로가 다르면 `vite build --outDir OTHER && node tools/pwa/build.mjs OTHER`처럼 양쪽을 맞춘다.
5. 메뉴 구조 `#menu .card .actions`가 바뀌었다면 `src/pwa.js`의 삽입 지점도 조정한다.

## 배포와 사용자 설치

기존 Pages 빌드가 `npm run build` 후 **dist 전체**를 올리면 새 워크플로는 필요 없다. `sw.js`, manifest, 아이콘을 빼고 배포하면 안 된다. HTTPS와 같은 출처/하위경로를 사용하며 GitHub Pages `/halfsword/` 경로를 기준으로 검사했다. manifest id/start_url/scope와 SW는 배포 위치 기준 상대 경로다. `vite dev`에서는 등록하지 않는다.

- iPhone: Safari에서 게임을 열고 공유 → 홈 화면에 추가.
- Android: 지원 브라우저의 앱 설치/홈 화면에 추가. 설치 버튼은 브라우저가 설치 요청을 허용했을 때 표시한다.
- 처음 온라인으로 열고 메뉴의 ‘오프라인 플레이 준비’ 완료를 기다린다.
- 이후 저장된 게임·음향은 오프라인에서 실행한다. 브라우저/OS의 저장 공간 정리까지 막는 영구 보관은 아니다.
- 새 패치는 온라인에서 다운로드한다. 모든 해당 게임 탭/PWA 창을 닫았다 다시 열면 적용한다. 전투 중 강제 새로고침하지 않는다. GitHub push만으로 설치 기기에 즉시 적용되는 것은 아니다.

## 설계와 검증 한계

현재 기준238개 파일, 4,791,875바이트(약4.8MB)를 버전별 SHA-256으로 검증해 저장한다. 과거 독립 실험판 `corr/r2p/support/wb`는 제외한다. 빌드가30MiB를 넘으면 대상 파일을 검토하도록 실패한다. 새 외부 URL/API 리소스는 자동 오프라인 지원 대상이 아니다.

일부 다운로드/해시 실패는 새 버전 전체를 거절한다. 기존 정상 캐시를 유지하고, 동일 Pages 출처의 다른 게임 캐시는 지우지 않는다. `skipWaiting`, `clients.claim`, 강제 reload를 사용하지 않는다. 새 버전 확인은 온라인 재진입/탭 복귀 등을 통해 이뤄지며 백그라운드 즉시 배포를 보장하지 않는다.

검증 결과는 `verification.json`, 재현 코드는 `tests/`를 따른다. Chromium 실제 SW·모바일 터치 에뮬레이션으로 검사했다. 실제 iPhone/Android 홈 화면 설치, OS 오프라인 보존 정책과 음향 청취는 실기기 확인이 남는다. 설치형 외관과 오프라인 실행을 제공하며 네이티브 성능 향상이나 앱스토어 배포를 의미하지 않는다.

## 되돌리기

우선 작업 브랜치의 이 패치만 되돌린다. 이미 공개한 SW는 파일 삭제만으로 모든 기기에서 사라지지 않는다. 공개 뒤 철회할 때는 같은 `sw.js` 주소로 정리용 워커를 배포해 해당 scope의 `stillness-pwa:` 캐시만 삭제하고 unregister해야 한다. 전체 출처 캐시/localStorage를 삭제하면 안 된다. 이 묶음은 아직 원본에 배포되지 않았다.
