# 힘 전달 1차 릴리스 확인

선택형 시험 주소: https://yoonjl-svg.github.io/halfsword-codex/force-lab.html

일반 게임은 legacy 그립을 유지한다. 두 비교 링크는 같은 B 설정·longsword로 시작하고 후보만 `physicsTrial=grip`을 쓴다. 상세 결과는 [개발 보고](force_path_round1.md)와 [타격 비교](whole_body_strike_probe.md)에 있다.

구현 소스: [`077c1cd113238c29e025b1e7851975417934d7f7`](https://github.com/yoonjl-svg/halfsword-codex/commit/077c1cd113238c29e025b1e7851975417934d7f7).

독립 main 반영: [`9cb3f9b79e6a97f2319743a399d24048f99e3560`](https://github.com/yoonjl-svg/halfsword-codex/commit/9cb3f9b79e6a97f2319743a399d24048f99e3560). [전송36880409555](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/36880409555) 성공 뒤 실제 fetch로 소스 tree 동일, source 선조, main/작업 가지 동일을 확인했다. 원본 저장소에는 쓰지 않았다.

Pages 배포: [36880518629](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/36880518629). build/deploy가 성공했다. 공개 index·force-lab·feature-lab·main asset은 HTTP200이며 로컬 산출물 SHA256과 모두 일치했다. 공개 모바일 터치/재시작 검사도 **통과**했다. 세로 CTA 두 개→가로 전투 시작→3초 이상 실행→실제 드래그/해제→재시작에서 옵션·무기·그립·유한 상태를 확인했다. 일반 URL은 legacy/받침 .3으로 돌아갔다. 화면 넘침·JS/HTTP 오류는 없었다.

로컬 검증: ledger 9교정·그립12fixture·타격8조건 및 종료 제어2조건·지지8조건·기본960프레임 두 trace 일치·AI결투/기립4장면·기존 balance36조건/catch/options·프로덕션 빌드 통과. 독립 감사에서 출시를 막는 코드 결함을 발견하지 못했다. 실제 폰의 사실감/성능은 사용자 평가 전이다.

공개 검증의 [기계 기록](force_path_public_metrics.json)에는 페이지 SHA256·실제 입력 전후·설정·검사 범위를 남겼다. 스크린샷은 저장소 밖 원자료 디렉터리에 보관한다. 소프트웨어 렌더의 입력 검증이 실제 휴대폰 성능·사람 체감 수락을 대신하지 않는다.
