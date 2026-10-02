# Q06 팔 한도·절삭 옵션의 모바일 실행 확인

2026-10-02. 기존 선택형 `armTrial=legacy/sharedCap` × `cutTrial=legacy/budgeted` 네 조합을 모바일 브라우저 모드의 세로/가로 시작에서 각각 검사해 **8/8 PASS**, console/page/request/HTTP 오류 0이었다. 게임 제어·기본값·공개 비교 링크를 새로 바꾼 결과가 아니다. Q06 전체 물리 수락이나 기립 연구판 재공개를 뜻하지 않는다.

[검사 도구](../../tools/browser/arm_cut_interaction.mjs)는 실제 `feature-lab.html`의 arm/cut 링크 값을 조합해 게임 URL로 접속한다. 검사한 무기는 **zweihander 대 longsword**다. 캐릭터 옵션을 evaluate로 직접 주입하지 않는다. 양측 Fighter의 armTorqueModel과 Combat.cutReactionModel을 메뉴·플레이·재시작에서 확인했다.

- 390×844/844×390의 회전 안내와 가로 넘침.
- 실제 Start와 정상 RAF 물리 시간 진행.
- CDP 터치로 검 조작 영역 잡기/끌기/놓기/재입력. 입력 분리 동안만 AI update를 멈췄다.
- pause 후 시작으로 새 양측 Fighter/Combat이 만들어지며 옵션이 유지되는지 확인.
- 같은 브라우저 context의 일반 URL로 돌아가 두 옵션이 legacy가 되고 localStorage에 남지 않는지 확인.

주소는 로컬 Vite `http://127.0.0.1:4201/`였다. 이는 데스크톱 Chromium의 모바일 입력/뷰포트 모드이며 실제 휴대폰 성능·사용자 자연스러움·재현 가능한 동일 물리 궤적의 검사는 아니다. 현재 공개 URL에 같은 소스가 배포되어 있다는 별도 바이트 검증도 이 도구는 수행하지 않는다.

[원자료 SHA·실행 요약](arm_cut_mobile_round1_metrics.json)을 보존했다. 원자료와 28개 최종 화면은 저장소 밖 `/workspace/halfsword-hybrid-evidence/q06-mobile-options/`에 있다. 초기 실행은 명시적 legacy 옵션에도 안내 패널이 생기는 기존 UI를 잘못 기대해 실패했다. 그 검사 기대값을 수정한 후 최종 8행을 다시 실행했다. 초기 실패 화면은 보존되지 않았으며 최종 성공과 합쳐 표본으로 세지 않는다.

```sh
HALFSWORD_EVIDENCE_TAG=rerun HALFSWORD_EVIDENCE_DIR=/tmp/q06-mobile-new node tools/browser/arm_cut_interaction.mjs http://127.0.0.1:4201/
```

새 경로/tag로 증거를 보존한다. [Q05 실제 충돌 비교](arm_cut_interaction_round1.md)와 함께 옵션의 연결을 확인하는 근거이며, 조합 후보의 전체 제동·부상·물리적 사실감을 수락한 것은 아니다.
