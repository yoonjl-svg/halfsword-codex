# 지지 반작용 2차 릴리스

**철회:** 사용자가 누운 뒤 공중으로 치솟는 중대한 오동작을 보고했다. 지지 연구판 공개 진입을 중단하며 기존 `physicsTrial=support` 주소도 legacy 지지와 철회 안내로 돌린다. 아래 출시 검사는 당시 실행/입력의 확인 기록이며 누운 자세 회복의 안전성을 입증하지 못했다. 근본 수정과 재검증 완료 전 재공개하지 않는다.

구현/측정: [개발 보고](support_transfer_round2.md), [조건·소스 해시·원자료 요약](support_transfer_round2_metrics.json).

사용자가 수용한 paired 그립을 기본 반영한다. 이전 그립은 `force-lab.html`의 `legacyGrip` 비교로 보존한다. 새 지지 후보는 `support-transfer-lab.html` → `physicsTrial=support` 접속에서만 사용한다. 일반 지지는 legacy이며 기립 전환/전진 미끄럼의 알려진 후퇴를 연구판 화면에 표시한다. 인간 자연스러움이나 전신 강타 개선을 수락한 상태가 아니다.

로컬 검증: 접촉12·축 방향18·그립12 교정, paired 승격의 이전 paired 대비 AI결투/부상기립 각960프레임 trace exact, 같은 준비/입력20장면의 유한 상태 및 상태별 무접촉 보조 차단, 실제 양쪽 AI coldstart 결투30초×2의 충돌/부상과 유한 상태, 절단 교차600프레임, 기존 balance36/catch/options, 프로덕션 빌드 완료. 로컬 모바일 네 비교 경로에서 실제 세로 CTA 탭→가로 시작→3초 실행→드래그/해제→재시작 및 일반 URL 복귀를 확인했다. 소프트웨어 브라우저 검사이며 실제 휴대폰 성능/체감은 미수락이다.

구현 소스: [`b2e49bf862b40ddc868d5379c30273088817284a`](https://github.com/yoonjl-svg/halfsword-codex/commit/b2e49bf862b40ddc868d5379c30273088817284a).

독립 main 반영: [`0aba9cc3be3f5b9b31ad17f55dcbad5cc703f579`](https://github.com/yoonjl-svg/halfsword-codex/commit/0aba9cc3be3f5b9b31ad17f55dcbad5cc703f579). [전송36891602875](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/36891602875) 성공 후 fetch로 main/작업 가지 동일, source tree 동일, source 선조를 확인했다. 원본 저장소에는 쓰지 않았다.

공개 Pages: [36891671166](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/36891671166) build/deploy 성공. [휴대폰 지지 비교](https://yoonjl-svg.github.io/halfsword-codex/support-transfer-lab.html) · [이전/현재 그립 비교](https://yoonjl-svg.github.io/halfsword-codex/force-lab.html).

공개 index/support-transfer-lab/force-lab/feature-lab/main asset은 HTTP200·로컬 SHA256과 전부 동일했다. 실행 asset은 `main-BkjSVIkx.js`다. 공개 모바일 네 경로와 일반 URL도 실제 탭·3초 이상 전투·손 드래그/해제·재시작 모두 통과했다. 화면 넘침·JS/HTTP 오류0, 임시 설정 저장 없음, 일반 URL paired/legacy 지지 복귀를 확인했다. [공개 기계 기록](support_transfer_public_metrics.json)에 범위와 증거를 남겼다.

출시 판단은 **그립 수용에 따른 작은 기본 반영 + 알려진 후퇴를 표시한 선택형 지지 연구판**이다. 공개 플레이 검증 통과를 보행/기립 자연스러움 수락으로 바꾸지 않는다.
