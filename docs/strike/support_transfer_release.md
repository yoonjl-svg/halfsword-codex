# 지지 반작용 2차 릴리스

구현/측정: [개발 보고](support_transfer_round2.md), [조건·소스 해시·원자료 요약](support_transfer_round2_metrics.json).

사용자가 수용한 paired 그립을 기본 반영한다. 이전 그립은 `force-lab.html`의 `legacyGrip` 비교로 보존한다. 새 지지 후보는 `support-transfer-lab.html` → `physicsTrial=support` 접속에서만 사용한다. 일반 지지는 legacy이며 기립 전환/전진 미끄럼의 알려진 후퇴를 연구판 화면에 표시한다. 인간 자연스러움이나 전신 강타 개선을 수락한 상태가 아니다.

로컬 검증: 접촉12·축 방향18·그립12 교정, paired 승격의 이전 paired 대비 AI결투/부상기립 각960프레임 trace exact, 같은 준비/입력20장면의 유한 상태 및 상태별 무접촉 보조 차단, 실제 양쪽 AI coldstart 결투30초×2의 충돌/부상과 유한 상태, 절단 교차600프레임, 기존 balance36/catch/options, 프로덕션 빌드 완료. 로컬 모바일 네 비교 경로에서 실제 세로 CTA 탭→가로 시작→3초 실행→드래그/해제→재시작 및 일반 URL 복귀를 확인했다. 소프트웨어 브라우저 검사이며 실제 휴대폰 성능/체감은 미수락이다.

원격 반영과 공개 URL·산출물·모바일 검증은 배포 완료 후 이 문서에 정확한 SHA/Actions run으로 갱신한다.
