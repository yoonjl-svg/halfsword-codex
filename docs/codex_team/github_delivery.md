# GitHub 전송과 휴대폰용 웹 배포

**2026-10-02 21:02 KST 상태 변경:** 아래 API+Actions 성공은 과거 확인 기록이다. 현재 같은 환경의 API 조회는 `401 Bad credentials`, git 읽기는 비대화형 인증 실패다. 환경 초안의 GH_TOKEN 요구사항 저장도 초안/요구사항 충돌로 실패했다. 새 기립 후보 `232e772`는 로컬 검증만 완료했고 원격 쓰기/Pages 배포를 하지 못했다. 환경 설정에서 독립 저장소의 GitHub 인증을 복구한 뒤 아래 절차를 재개한다. 기존 공개 팔·절삭 페이지는200으로 열리지만 새 기립 수정은 없다. [현재 후보 상태](../strike/stance_memory_trial.md).

## 실제 확인한 범위

대상은 `yoonjl-svg/halfsword-codex` 하나다. 원본 `yoonjl-svg/halfsword`는 공개 기준 커밋을 읽을 때만 사용하고 절대 푸시하지 않는다.

처음 연결 앱은 코드/워크플로 쓰기 권한은 있었지만 저장소 생성 권한이 없어 생성 API가 403을 반환했다. 사용자가 빈 독립 저장소를 만들었다. 그 뒤 직접 Git 업로드 POST는 인증 401이었고, HTTP/1.1·고정 본문 길이·4바이트 무변경 요청에서도 같았다. 비공개 저장소 요금이나 대용량 파일 때문이라고 진단하지 않는다.

같은 연결의 GitHub API 쓰기는 정상이다. 이를 사용해 검증한 Git bundle과 전송 workflow를 업로드하고, GitHub Actions의 해당 저장소 전용 토큰으로 비강제 push했다. 최초 전송 작업 `36856266137`이 성공했고, 원격 `756858e5a2c03764382670e539bb2af45e895790`에 개발 HEAD `093cc79aebb529fcc9748e50f156f7cafca2dff7`과 기존 기준 이력이 보존됐다. 파일 트리는 정확히 일치했으며 실제 `git fetch`로 다시 받아 확인했다.

이것은 직접 Git 업로드 인증을 고쳤다는 뜻이 아니다. 현재 환경에서 검증한 쓰기 경로는 API+Actions이고, Git 읽기/fetch는 정상이다. 생성·조회·푸시·웹 배포를 각각 검증하기 전 전체가 준비됐다고 부르지 않는다.

## 후속 전송

작업을 커밋하고 아래 도구로 사전 검사를 한다. 기본은 검사만 수행한다.

```sh
python3 tools/github/publish_verified.py --check
python3 tools/github/publish_verified.py --publish
```

도구는 대상 URL과 작업 가지, 깨끗한 작업 트리, 원격 main이 로컬의 선조인지 확인한다. 원격 main 이후의 커밋만 bundle에 담아 이전 전송 파일이 중복 재포장되는 것을 줄인다. 준비 파일은 API로 올리고 CI를 건너뛰는 메시지를 쓴다. 최종 준비 커밋과 원래 소스 HEAD를 workflow 입력으로 고정한다. 동시 원격 변경이 발견되면 중단하며 force push하지 않는다.

전송 workflow는 입력 SHA, 기준14bcf1f 선조, workflow 파일 일치를 검사한다. 준비 이력과 개발 이력을 두 부모로 남기면서 소스 파일 트리가 정확히 같은 통합 커밋을 만든다. 준비 bundle은 최종 파일 목록에서 빠지지만 준비 커밋 이력에는 남는다. 비밀 값은 bundle/로그/설정 파일에 넣지 않는다.

dispatch 성공은 전송 완료가 아니다. 도구가 반환한 작업을 확인한 다음 `git fetch origin main codex/hybrid-support`, 원격 두 ref의 일치, 소스 tree의 일치, 개발 커밋의 선조 관계를 확인한다. 성공한 통합 커밋으로 작업 가지를 fast-forward한다. 전송 후 사용자 변경 때문에 fast-forward가 불가능하면 자동으로 덮어쓰지 않는다.

## 웹 배포

사용자는 ZIP이 아닌 **휴대폰에서 바로 여는 웹 주소**로 비교판을 받는다. ZIP/bundle은 복구 자료다.

기존 `deploy.yml`과 상대 경로 빌드는 독립 저장소 경로를 지원한다. GitHub 무료 플랜의 Pages는 공개 저장소를 대상으로 한다. 비공개 저장소 Pages는 지원하는 유료 플랜이 필요하다. 공개 여부 변경은 소스와 개발 문서까지 공개하므로 사용자의 결정을 받는다. 현재 앱에는 저장소 관리/Pages 설정 권한이 없어 계정 소유자가 Settings → Pages → Source → GitHub Actions를 설정해야 한다.

Actions 토큰의 push는 후속 push 기반 workflow를 자동으로 시작시키지 않는다. 전송 완료와 Pages 설정 확인 뒤 아래처럼 배포를 명시적으로 실행한다.

```sh
gh workflow run deploy.yml --repo yoonjl-svg/halfsword-codex --ref main
```

배포 작업 성공과 실제 발급 URL을 확인한다. 그 URL에서 게임 초기화·상대 asset 경로·해당 시험 설정·390×844/844×390 화면·터치/재시작·콘솔 오류를 검사한 뒤 링크를 보낸다. 예상 URL이나 localhost를 배포 완료 링크로 제공하지 않는다. 계정 설정 또는 배포가 막히면 정확한 단계와 필요한 조치만 보고한다.
