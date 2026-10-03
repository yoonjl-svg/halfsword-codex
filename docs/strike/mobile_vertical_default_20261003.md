# 휴대폰 세로 입력 B 기본 적용

2026-10-03 UTC / 10-04 KST. 사용자 결정: “b가 나아. 손으로 같은 거리를 그을 때 속도에도 거리에도 보정이 생기는 거 맞지? 둘 다 필요해.” 선택형으로만 남아 있던 B의 세로 입력1.35배를 일반 휴대폰 조작에도 적용한다. 새 메이저 물리 변경이 아니라 기존에 검증한 입력 매핑의 기본 경로 연결이다.

`Input` 생성자에서 선택형 fallback1을 제거하고 기존 `MOBILE_VERTICAL_GAIN.default=1.35`를 사용한다. touch Y만 같은 픽셀 이동·시간에서 목표 거리/속도가35% 늘며, 힘·질량·관성·추가 지연·자동 칼 조향을 만들지 않는다. 같은 높이390px에서 위40px/.25초는 .266667m/1.066667m/s→.36m/1.44m/s다. 입력 목표의 값이며 실제 손/검의 이동·속도를 강제하지 않는다. 가로·마우스/펜·픽셀 탭 판정·홀드0/반전 합계·이벤트 분할을 유지한다.

`?mobileVerticalGain=1`로 이전 배율을 실행할 수 있다. 잘못된 override는1.35로 돌아온다. `inputComparison=vertical`의 비교판은 계속 검술 보정0/보통 고정이고, 일반 게임은 기존 저장한 검술 보정·난이도를 사용한다. fresh profile 검술 보정.7/보통/autoGuardtrue를 입력 배율과 혼동하지 않는다. 사용자 엄지의 실측 최적값이나 전신 물리 완성을 선언하지 않는다.

소스 `41bbe61`의 실제 전달을 완료했다. 순수 매핑51검사, 단독 전체 회귀6묶음, 로컬/공개 완성 게임4조건 및 폰 계획1조건 PASS다. 공개 root 실제 카드0 플레이/카드1 새 world 재시작, native trusted tap·drag·중단·재입력의 소비 합계, 이전1배/잘못된 override1.35/보류 제동 URL, 계획 세로/가로 화면을 확인했다. 오류/HTTP 실패0, 공개8파일이 build와 byte exact다. Pages37136157289·회귀37136156786 성공과 실제 checkout/source stable을 확인했다. [전달 영수증](mobile_vertical_default_release.json). 실제 기기 엄지의 추가 최적화나 접촉 효능 검사는 아니다.

- 일반 게임: https://yoonjl-svg.github.io/halfsword-codex/
- 이전 배율: https://yoonjl-svg.github.io/halfsword-codex/?mobileVerticalGain=1
- 비교 설정 고정 이유/이전 A/B: https://yoonjl-svg.github.io/halfsword-codex/feature-lab.html#mobile-comparison

새 [검 거두기 후보](wrist_braking_round1.md)는 목적 효과가 부족해 공개하지 않는다. 일반 물리·한손 공개·철회 지지/절삭을 별도 승격하지 않는다.
