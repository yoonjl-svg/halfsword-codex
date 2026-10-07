# 게임 문구 편집과 반영

[검토용 XLSX](https://yoonjl-svg.github.io/halfsword-codex/text-review/game-text-20261008.xlsx) · [전체 CSV](https://yoonjl-svg.github.io/halfsword-codex/text-review/all-text-20261008.csv). 이것은 다운로드 파일이며 Google 공유 시트 URL이 아니다. 현재 환경에 Google Sheets 연결·인증이 없어 Google 문서는 생성하지 않았다. 공개 XLSX/CSV의 HTTP200·원본 SHA 일치와 게임8파일 일치를 확인했다. 실제 전달 상태는 `delivery_20261008.json`을 따른다.

`tools/text/catalog.mjs`는 현재 게임 소스의 문구와 위치를 CSV/manifest로 만들고, `tools/text/workbook.py`는 Google 스프레드시트로 열 수 있는 XLSX를 만든다. Google 문서 생성·공유·계정 연결은 이 도구의 기능이 아니다. 게임 코드에 번역 프레임워크를 추가하지 않는다.

## 사용자 편집

1. `game-text.xlsx`를 Google Drive에 업로드하고 Google 스프레드시트로 연다.
2. **게임 문구** 탭의 노란 **수정 문안** 열에 원하는 문구를 입력한다. 빈칸은 변경 없음이다. 실제로 지우려면 **작업**에 `clear`를 쓴다.
3. 비교판·소리 실험실은 별도 탭이다. **미노출 설정과 대사**는 현재 UI에서 사용하지 않는 저장된 설명·대사·무기 영문명이다.
4. `{{expr:1}}` 같은 자리표시자는 개수와 순서를 유지한다. 기존 HTML 태그/속성도 그대로 둔다. 따옴표, 쉼표, 줄바꿈은 사용할 수 있다.
5. 현재 문구와 숨겨진 ID/해시는 유지한다. 수정한 XLSX를 내려받아 전달한다. CSV도 가능하다.

시트의 한 행은 하나의 소스 문자열/템플릿/HTML 텍스트 노드다. 이어 붙인 문장과 HTML 강조 부분은 여러 행으로 나뉠 수 있다. 사용 위치와 참고 열을 함께 읽는다. 중복 문구도 사용처마다 별도 행이며, 같은 말의 모든 사용처를 바꾸려면 해당 행들을 각각 편집한다.

## 내보내기

저장소의 기존 Node 의존성(`npm ci`)과 Python `openpyxl`이 필요하다. Node 20 이상 권장. 저장소 루트에서 실행한다.

```bash
node tools/text/catalog.mjs export --out /workspace/halfsword-handoff/game-text-20261008
python tools/text/workbook.py export /workspace/halfsword-handoff/game-text-20261008/manifest.json /workspace/halfsword-handoff/game-text-20261008/game-text.xlsx
```

`all-text.csv`와 scope별 CSV, `game-text.xlsx`, `manifest.json`, `coverage.json`을 함께 보존한다. **manifest는 원본 스냅샷이며 편집한 시트로 덮어쓰지 않는다.** 각 파일/문구의 SHA-256, 원본 소스 범위, 템플릿 식을 포함한다. ID는 파일·의미 문맥·그 안의 등장 순서에서 만들므로 줄 이동과 일반 문구 수정에 안정적이다. 같은 문맥의 문자열 삽입/정렬·코드 구조 변경 뒤에는 새 내보내기와 편집 대조가 필요하다.

## 변경 검토와 명시적 적용

```bash
python tools/text/workbook.py csv edited.xlsx /tmp/edited-game-text.csv
node tools/text/catalog.mjs import --manifest /workspace/halfsword-handoff/game-text-20261008/manifest.json --csv /tmp/edited-game-text.csv --report /tmp/game-text-report.json --patch /tmp/game-text.patch
```

이 인계본의 보존 원본은 `docs/text/snapshots/20261008/manifest.json.gz`이다. 위 `--manifest`에 그 저장소 경로를 사용할 수 있다. import와 `workbook.py export` 모두 일반 JSON과 `.json.gz`를 동일하게 읽는다. 후속 작업에서는 수정한 시트와 같은 날짜의 원본 스냅샷을 선택한다.

기본값은 **dry-run**이다. XLSX의 숨겨진 열까지 보존하여 CSV로 변환하고, 실제 수정 문안만 패치와 JSON 보고서로 만든다. CSV 직접 다운로드의 경우 기계용 CSV 헤더를 유지한다. 한국어 표시 헤더의 XLSX는 위 변환기를 거친다. 필터링된 행 일부만 담은 기계용 CSV도 지원한다. 빠진 행은 삭제로 해석하지 않는다.

검토된 변경을 사용자가 요청한 범위 안에서 반영할 때만 같은 import 명령에 `--apply`를 추가한다. 공개 배포는 별도 기존 절차를 따른다. 적용 후 관련 UI와 빌드를 확인하고 새 기준 파일을 내보낸다. 저장소 코드가 바뀌어 같은 파일의 SHA가 달라졌다면 **강제 적용하지 않는다**. 새 소스 기준으로 내보내고 기존 수정안을 ID/문맥/원문과 대조해 옮긴 뒤 다시 검토한다.

검증은 중복/알 수 없는 ID, 현재 문구/기준 해시 변조, 원본 파일 충돌, 템플릿 자리표시자 누락/순서 변경, HTML 태그/속성 변경, 깨진 JavaScript를 거절한다. 모든 파일을 먼저 확인한 뒤에만 `--apply`가 쓴다. 원본 체크와 쓰기 사이 외부 프로세스 변경도 다시 검사한다. 복수 파일 쓰기는 OS 트랜잭션이 아니므로 쓰기 도중 디스크 오류에는 버전 관리에서 복구해야 한다.

자세 표시 이름은 일부 동작 표의 조회 키이기도 하다. manifest에 기록한 `guards.js`/`motion_library.js`의 실제 조회 키와 `weapons.js`의 `motionSkip` 참조만 함께 치환한다. 중복/빈 자세 이름을 거절하고, 같은 글자의 사망 사유 등은 바꾸지 않는다. 링크된 참조도 보고서/패치에 명시된다.

## 현재 조사 범위와 한계

2026-10-08 인계본은 현재 `src/*.js` 전체와 `index.html`, `sounds.html`, 공개 보조 HTML 4개를 **98개 파일** 기준으로 조사했다. 실행 메뉴·무기 카드 이름/설명/능력·등급·자세 이름/설명·캐릭터 이름/호칭/인트로/승리/부활 대사·알림·접근성 문구와 비교판/소리 페이지를 포함한다. 영어 `Battle`, `Stillness`, `???`, A/B·수치 버튼도 포함한다.

미노출 캐릭터 설정/나머지 대사와 무기 영문명은 별도 탭에 보존한다. 내부 물리 이름·사망 사유 코드·GLSL 셰이더·개발 로그·성능 오버레이·주석은 편집 대상에서 제외했다. `motion_library.js`의 미노출 자세 별명·연구 출처와 `weapon_class.js`의 내부 분류명도 제외했다. 외부 문서/도구/의존성과 `public/development-plan.html`, 동결된 생성 빌드 `public/wb`, `public/corr`는 현재 게임 문구 원본이 아니다. CSS의 장식 구분점 ` · `은 제외했다. 이미지/음성/모델 내부 글자는 전수 OCR/전사하지 않았다. 모든 가능한 런타임 분기 화면을 자동으로 열어 완전성을 증명한 것은 아니다.

`coverage.json`에 조사 파일별 포함/제외 수와 한국어 제외 후보의 이유를 남긴다. 새 텍스트 발생 위치가 기존 표시 모듈 밖으로 확장되면 추출 규칙도 갱신해야 한다. 추출에는 실제 게임 모듈을 실행하지 않는 AST/HTML 분석을 쓴다.

안전 검사는 다음 명령으로 실행한다.

```bash
node --test tools/text/catalog.test.mjs
```
