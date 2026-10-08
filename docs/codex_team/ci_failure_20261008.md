# 회귀 검사 실패와 개발 교환 상태 · 10/08

사용자가 `1628db8`의 회귀 실패 알림을 전달했다. [실패 실행37735533331](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/37735533331)은 KST15:03:18에 시작해15:05:52에 종료했다. 실제 main checkout도 `1628db8b33eb8632325608d425e9d817b091b161`이며, 캐시 재사용이나 시간 초과가 아닌 새 검사 실패였다.

## 회귀 실패 원인과 수정

주석3개는 실패1·경고1·안내1이다. 실패는 exit1, 나머지는 Actions의 Node20 지원 종료 및 ubuntu-latest 이미지 변경 안내였다. 6묶음 중 `cut_reaction`만 실패했고 force ledger·grip reaction·arm capacity·arm duel·build는 통과했다.

모르겐슈테른 가시 판정 추가(`af4d2d03`)로 실제 `Combat.afterStep()`이 공격자의 `weaponCfg.edged`를 읽는다. 오래된 `cuttingFixture()`는 실제 Fighter 대신 부분 객체를 만들면서 `weaponCfg`를 생략했다. 최신 기준 `e6feea744e0ccfcec664ae10a5a8a75e0db1bbcd`에서도 기존33검사 중14개가 같은 TypeError로 실패했다. 실제 Fighter는 무기 콜라이더를 등록하기 전에 이 설정을 생성한다.

테스트용 공격자에 기존 검사 대상인 `edged:true, spike:false`와 기존 팔 도움 정책 `armSupportModel:'legacy'`를 명시했다. 게임 코드·물리 계수·assertion·허용 오차를 바꾸지 않았다. 수정 뒤 기존33검사 전체가 통과했다. 이는 날붙이 절삭 반작용 준비물 교정이며 가시·linked 보조팔의 새 검증을 뜻하지 않는다.

전체6묶음 및 실제 GitHub 후속 실행 결과는 [검증 기록](ci_failure_20261008.json)을 따른다. 원자료는 저장소 밖 `/workspace/halfsword-handoff/ci-audit-20261008/`에 보존한다. 공개 게임 바이트가 바뀌지 않는 도구 수정이므로 같은 모바일 플레이 검사를 반복하지 않는다.

## 개발 교환은 별도 상태

- 우리10/07 일지는 [37637248807](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/37637248807)에서 KST23:30:33 발행 성공했다. 최신 예약 발행 [37679439177](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/37679439177)도 성공했다.
- 최신 실패 [37681792476](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/37681792476)은10/08 KST05:24:46 생성됐다. 프로토콜32검사는 통과했으나 수신 실행이00:00–00:20 KST 밖이어서 `deferred_outside_exchange_window`를 기록하고 실패로 표시했다. 수신되지 않은 것을 성공으로 바꾸지 않는다.
- 전체 실행 이력에서 마지막 성공 수신은 [36881022419](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/36881022419),10/02 KST00:01:51의10/01분이다. 이후 예약 수신7회는 모두 시간 밖 차단이다.10/01분은 앞서 받았으므로7회 차단을7일분 미수신이라고 환산하지 않는다. 이 워크플로에는10/02–07분 수신 성공이 없으며, 다른 경로의 수령 여부나 의미 검토 완료를 추정하지 않는다.
- 10/02분 발행의 옛 실패는 작성 노트의 필수 제목 형식 문제였고 `f4f3d97`에서 고쳤다. [37108554334](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/37108554334)의 해당 날짜 발행 성공으로 복구됐다.

이 조사는 우리 저장소의 실행·오류·수령 상태만 확인했다. 상대 신규 자료·코드·게임·수신 본문은 열람하지 않았다. 다음 허용 시간에 날짜를 명시한 누락분 수신이 필요하다. GitHub 예약 실행은 지연될 수 있어 현재 cron만으로20분 창 안의 실행을 보장할 수 없으며, 대화 종료 후 AI가 자동 재기동된다는 뜻도 아니다.

## 배포 확인 절차

Pages 성공은 별도 회귀 검사 성공을 대신하지 않는다. 공통 전투 경로를 바꿀 때 변경 관련 검사와 이6묶음을 확인하고, `Development regression checks`의 실제 checkout SHA·판정·최초 실패 원인을 확인한다. 현재 workflow는 직접 push를 실행 조건으로 삼지 않으므로, 즉시 원격 결과가 필요하면 새 main을 대상으로 수동 실행한다. 같은 실패의 무의미한 재시도나 문서만 바뀐 동일 물리의 반복은 피한다.
