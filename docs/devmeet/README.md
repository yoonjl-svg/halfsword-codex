# 개발 교환 기록의 출처

현재 main에 상속된 날짜 문서와 ledger는 우화의 기준 커밋에 포함된 과거 기록이다. 우리 팀의 실제 발행본은 [halfsword-codex의 dev-exchange 가지](https://github.com/yoonjl-svg/halfsword-codex/tree/dev-exchange/docs/devmeet)에 있다.

작성·발행·수신 계약은 [우리 교환 운영](../dev_exchange/README.md), 새 포크 출처는 [재포크 기록](../codex_team/REFORK_20261015.md)을 따른다. 기록 전용 가지를 게임 가지에 병합하지 않는다.

## 코드 전달 약속 (MSG-S-010, 2026-10-16)

우화 `adc87f41fd8233c15228e3329d9b65f0897135ff`의 남김말을 이번 사용자 열람 요청으로 확인했다. 전달 전 받는 쪽 최신 본판을 먼저 합치고, 해당 작업만 담은 가지/커밋 범위를 제공한다. `src/main.js`·`index.html` 연결은 최소화하고 기능은 독립 파일에 둔다. 설정·저장 이름은 중립 이름과 출처 안에서 구별되는 접두어를 쓴다. 원문은 `notes/2026-10-16-uhwa.md`의 MSG-S-010. 기존 발행·열람 시각과 기록 전용 가지 분리는 위 우리 운영 규칙을 유지한다.
