# Daily developer exchange 지연 실행·보류 분리

기준: `2c782f220d2bd9c75afab596e9b37996bef27a76` (`main`). 변경 범위는 교환 도구·워크플로·회귀 검사·운영 문서다. 게임 코드, 상대 저장소, 기존 수신/발행 원문은 변경하지 않는다.

## 확인한 원인

[실행40572529260](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/40572529260)의 API 메타데이터와 [작업 로그122430229764](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/40572529260/job/122430229764)를 직접 확인했다.

| 단계 | UTC | KST |
|---|---|---|
| 로그의 예약식 `0 15 * * *` 기준 시각 | 10/27 15:00 | 10/28 00:00 |
| 실행 created_at / run_started_at | 10/27 19:49:17 | 10/28 04:49:17 |
| 실제 job started_at | 10/27 19:49:19 | 10/28 04:49:19 |
| 시간 검사·보류 영수증 | 10/27 19:50:05.210705 | 10/28 04:50:05.210705 |

예정 대비 실행 생성 지연은4시간49분17초, 생성 후 job 시작은2초다. source checkout은약41초였다. 스크립트 내부 대기나 checkout이 수시간 지연의 원인은 아니다. GitHub 내부에서 이벤트 생성/전달이 늦어진 구체적인 원인과 원래 큐 진입 시각은 공개 메타데이터로 확정하지 못했다. `run_started_at`과 job의 실제 시작 시각도 구별한다.

로그에는 `deferred_outside_exchange_window`, `ExchangeWindowClosed`, 종료1, 보류 영수증의 `dev-exchange` 커밋 `ab83834` 저장, 마지막 실패 단계의 종료1이 연속해 기록되어 있다. 시간 가드는 의도대로 상대 요청을 차단했다. 그런데 CLI 성공 상태 목록에 보류가 없고 Actions가 `continue-on-error`로 기록 저장 후 실패를 다시 발생시켜 일반 오류와 동일한 알림이 됐다. 기존23:45/00:45 재시도는 발행용이며 수신용 재시도가 아니었다.

최근 실행 목록에도10/26 UTC의40394459564, 10/25 UTC의40219818627 예약 실행 실패가 있다. 이 두 실행의 오류 종류까지 이 조사에서 단정하지 않는다. 미해결 관련 open PR은 조사 시점에 없었다.

GitHub 공식 문서는 예약 실행의 지연·누락 가능성과 정각 혼잡을 명시한다. 분을 옮기거나 재시도를 추가해도 정시 실행을 보장하지 않는다.

- [예약 이벤트 제약](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [예약 실행 지연 문제 해결](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows#scheduled-workflows-running-at-unexpected-times)

## 수정과 재시도 정책

- 수신 시도는00:02/07/12/17 KST. 실시간 검사 `00:00 <= now < 00:20`, 요청 timeout, 응답 후 검사와 부분 snapshot 정리는 유지한다. sleep, 시간 위조 CLI, 시간 제한 우회는 없다.
- 예정된 수신은 생성일 기준 전날을 먼저 처리하고, 기록상 과거 보류 최대3개를 오래된 순으로 처리한다. 같은 날짜·보고 ID를 유지하고 보류나 실제 오류에서 멈춘다. backlog가 커도 한 번에 무제한 읽지 않는다.
- 보류는 종료0과 `outcome=deferred`로 나타낸다. 이를 수신 완료라고 쓰지 않는다. 의미 검토도 수행하지 않는다. API/권한·손상·출처 오류, 미확인 상태, 결과 JSON 누락과 archive push 실패는 실패다.
- 기존 시간 보류 영수증도 재시도 대상으로 인식한다. 완료 영수증이 있는 날짜는 늦은 중복 실행 때문에 큐로 돌아가지 않는다. 과거 날짜의 실제 오류는 운영자 확인 후 수동 날짜 지정으로 재시도한다.
- 단일 `dev-exchange-archive` concurrency와 `cancel-in-progress: false`를 유지해 문서 가지 쓰기를 직렬화한다. GitHub가 pending 실행을 대체하거나 지연할 수 있으므로 각 cron을 독립적 실행 보장으로 해석하지 않는다.
- 수동 `receive --date`는 그 날짜만 처리한다. `--retry-deferred`는 명시적으로 추가할 수 있으며 같은 시간 가드를 통과해야 한다. 오래된 실행을 rerun해도 보고 날짜는 최초 created_at에 고정된다.

## 검증과 적용

로컬 Python 표준 라이브러리로 실행한다. 회귀 테스트의 상대 API는 전부 모의 응답이고 실제 상대 요청은 없다.

```sh
python3 -B -m unittest discover -s tools/dev_exchange -p 'test_*.py'
python3 -B tools/dev_exchange/exchange.py validate-notes --repo-root .
git diff --check
```

기존39검사와 추가18검사, 총57검사가 통과했다. 실제 YAML에서 추출한 날짜 결정 shell과 수집 shell도 모의 gh/수신 프로세스로 실행하여 날짜 출력, 재시도 인자, 정상·보류·오류 종료와 Actions 요약을 확인했다. 기존 경계 검사에는00:00/00:19:59/00:20, 중간 응답 종료, timeout, 부분 snapshot 정리와 다음 자정 재시도가 포함된다. 새 검사는 관찰된04:50 상황의 상대 요청0건, 과거 날짜 회수, 상한3개, 중복 수신0건, 실제 오류 유지와 기존 영수증 호환성을 포함한다.

새 `Developer exchange regression tests` 워크플로는 PR에서 read-only 권한으로 로컬 fixture 검사만 실행한다. PR을 검토한 뒤 main에 병합해야 예약 정책이 적용된다. 병합 전에 실제 수신 워크플로를 우회 실행하지 않는다. 병합 후 첫 허용 회차에서 `outcome`, 개별 상태, 남은 날짜 목록과 archive 단계를 확인한다. 외부 시간 기반 실행기는 연결하지 않았다.

수동 복구 예시: 다음 허용 회차 안에 Actions의 `Daily developer exchange` → `Run workflow` → `mode=receive`, `date=2026-10-27`. 같은 날짜가 이미 검증됐으면 원문을 덮어쓰거나 상대에 다시 요청하지 않는다. 모든 예약이 수시간씩 늦거나 이벤트 자체가 누락되면 엄격한20분 제약 아래에서는 그날 수신을 보장할 수 없다. 영수증 없는 누락 날짜는 수동 지정이 필요하며, 별도 외부 실행기 연결은 이후 운영 선택이다.

되돌림은 이 PR의 코드·워크플로 커밋을 revert한다. `dev-exchange`의 날짜별 원문·보류 영수증은 삭제하거나 main에 병합하지 않는다. 구버전은 보류를 다시 종료1로 분류하지만 새 영수증이 기존 수신 원문 형식을 바꾸지는 않는다.
