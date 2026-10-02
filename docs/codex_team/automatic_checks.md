# 자동 회귀 검사와 근거 수집

`Development regression checks`는 사람이 없는 동안 기존 실제 게임 검사와 빌드를 실행한다. 현재 대화를 깨우거나 새 코드를 작성하는 AI scheduler/API가 아니며, 자동 수정·merge·배포·메시지 발송·상대 자료 접촉을 하지 않는다. 새 가설·설계·개선 구현과 결과 해석은 별도 개발 작업이다. 검사의 PASS는 아래 범위에 한정하며 인간 자연스러움·전신 힘 전달·기립 완료를 뜻하지 않는다.

## 실행 계약

- UTC `17 */2 * * *`(매2시간 17분), 수동 `workflow_dispatch`, 우리 main의 `Import verified Codex development commits` 성공 뒤 `workflow_run`으로 실행한다. push trigger는 없다.
- 대상은 `yoonjl-svg/halfsword-codex`로 제한하고 실제 **main checkout SHA**를 기록한다. 전달 workflow의 시작 SHA는 API 준비 commit일 수 있으므로 검사한 소스 SHA와 같다고 하지 않는다. 검사 시작/종료 SHA 및 파일 해시가 바뀌면 실패한다.
- `contents: read`, 15분 timeout, 동일 main의 실행 중인 검사는 concurrency로 취소하지 않으며 대기 실행은 GitHub 정책에 따라 합쳐질 수 있다. 원격 저장소 쓰기 권한·게임 변경·공개 연결은 없다. workflow 파일은 전송 도구가 먼저 API로 도입하는 기존 절차를 따른다.
- Node22에서 `npm ci`로 lock을 사용한다. 출력·Vite build·캐시는 runner.temp 또는 `/tmp` 등 저장소 밖에 두며 HOME를 바꾸지 않는다. 새 실제 실행의 JSON/log와 checkout/install 기록은 GitHub artifact에 14일 보존한다. cache hit는 이번 result.json·checkout/install meta만 올리고 기존 큰 raw/log를 다시 올리지 않는다. 원 실행의 originRun ID/URL과 이번 currentRun ID/URL을 보존하여 원 근거를 찾을 수 있게 한다.

```sh
python tools/automation/run_checks.py --self-test-guards
python tools/automation/run_checks.py --out /tmp/halfsword-check-run-1 --cache-dir /tmp/halfsword-check-cache
# 새 출력 폴더로 같은 입력을 강제 재검사
python tools/automation/run_checks.py --force --out /tmp/halfsword-check-run-2 --cache-dir /tmp/halfsword-check-cache
```

출력 폴더는 매 실행 새 이름을 사용한다. 기존 결과를 덮어쓰지 않는다. `--fingerprint`는 읽기만 하며 캐시 키를 출력한다. `result.json`은 command/exit/walltime/검사 범위, 실제 checkout SHA, 실행 전후 소스 해시, 원자료·로그 SHA, 전체 PASS와 캐시 사용 여부를 기록한다. 실패해도 남은 독립 검사를 계속하고 실패 결과는 exit1이다. 개별 명령 timeout은 duel180초·나머지90초이며 subprocess processgroup을 TERM/KILL로 정리한다.

## 실제 검사 범위

| 검사 | 실행 | PASS의 의미 |
|---|---|---|
| force ledger | 기존 `force_ledger.test.mjs` | 실제 Rapier 장부 교정, 계측 on/off trace 일치 |
| grip reaction | 기존 `grip_reaction.test.mjs` | 실제 offHand 자유강체 wrench/power 및 dt 수렴 fixture |
| cut reaction | 기존 `cut_reaction_candidate.test.mjs` | 실제 manifold/afterStep impulse·에너지·runtime/clone phase fixture |
| arm candidate | 기존 `arm_capacity_candidate.test.mjs` | source guard, native torque accumulator, 준비 상태 original/clone 일치, callback 실패 보고 |
| arm duel | 기존 `arm_capacity_duel_probe.mjs` | 두 실제 AI, seed7, 준비3초→10초, sabre/zwei 대 longsword × original/clone/finalCap/runtimeFinalCap/runtimeFresh 10행; 준비·물리 trace·입력의 해당 exact 대조와 기존 이상 탐지 문턱 |
| build | `npm run build -- --outDir <외부출력>/build` | Vite exit0와 index 산출물 생성; 브라우저/배포 검사는 아님 |

JSON 검사에서는 exit0 + 명시적 `pass:true`를 모두 요구하며 `tests[].pass`와 `runs[].executionPass`, 제공되는 `executionPass`도 확인한다. `sourceStable:true`는 ledger/cut/arm candidate/duel의 필수 필드다. grip fixture에는 해당 필드가 없으므로 전체 runner의 전후 파일 해시로 보완한다. build는 JSON을 직접 제공하지 않아 runner가 exit/index/산출물 해시로 별도 build.json을 만든다.

## 동일 결과 재사용

캐시 키는 src·public·검사 도구·workflow·루트 source/config/lock 내용, 검사 목록/duel 조건, Node/npm/Python/OS/CPU architecture를 포함한다. `docs/` 문서 변경만으로 같은 물리를 다시 실행하지 않는다. 루트 AGENTS 등 운영 입력은 키에 포함한다. 캐시 원자료/log SHA를 검증하고, PASS 행은 JSON도 반드시 있어야 한다. JSON 생성 전 assertion/timeout 실패도 log가 있으면 동일 실패로 보존한다. **cached failure는 PASS로 바꾸지 않고 exit1**을 유지한다. source 변경이나 증거 손상은 캐시를 무효화한다.

캐시를 읽어 복사한 뒤에도 현재 파일·시작 HEAD를 다시 대조한다. 그동안 변경되면 이번 실행은 실패이며 이전 유효 캐시는 수정하지 않는다. 현재 checkout SHA와 원 실행의 evidenceCheckoutSHA, 이번 force 여부와 원 실행 force 여부를 구분한다. 수동 force는 캐시를 우회하고 새 결과를 만들며, Actions는 같은 fingerprint의 최신 evidence를 복원한다. 캐시 저장은 실패 때도 수행하되 정상적으로 result를 생성한 실행에 한정한다.

guard selftest는 비정상 exit/JSON false/sourceStable false/JSON 미생성/timeout, 실패 뒤 후속 실행과 결과 보존, 실제 runner child exit1, 실패 캐시 유지·artifact 변조 거부를 검사한다. 이 문서와 workflow의 실제 원격 작동 여부는 로컬 suite PASS와 별도이며, 전송·Actions run 결과로 확인한다.

## 로컬 도입 검사 기록

최초 실제6검사 실행은 `/tmp/halfsword-development-checks-local-r1/result.json`에 보존했다. 각 검사는 통과했으나 실행 중 `.github/workflows/development-checks.yml`과 별도 `tools/sim/experiments/native_recovery_candidate.mjs`가 추가되어 전체 sourceStable이 false였고 최종 exit1로 실패를 보존했다(106.07초). 이 실패를 정상 완료로 숨기지 않는다. 이후 파일을 고정한 실제 실행과 metadata/실패처리 후속 검증의 소스 SHA를 구분해 기록한다. 원격 schedule/workflow_run 작동과 최종 업로드 바이트 기준 검증은 Actions 결과로 확인할 별도 항목이다.

파일을 고정한 `/tmp/halfsword-development-checks-final-r1/result.json`은 실제6검사 전체 PASS(106.98초), HEAD·sourceStable=true였다. checkout `5e6ef218eef0e3b3aba0f389cec6239045544458`, ledger11/grip12/cut33/arm fixture4/duel10행(newFailureReview0)/외부 build를 통과했다. 이 실행의 runner SHA256은 `09d7b6a0a04de3169e7b726488285dfbf4b7df2dcc85e5c2e58ff1e43acd1c50`, workflow SHA256은 `f758458c758eb1c6ceda7816dbf2e500f9ff8bcad6740ce2c6adb4cf7fd27fb4`다. 동일 입력 cache 조회는 `/tmp/halfsword-development-checks-cached-r1/result.json`에서 0.207초 PASS였다.

그 뒤 originRun/currentRun metadata, cache-hit 원자료 중복 업로드 방지와 malformed tests/runs JSON의 TypeError 격리를 추가했다. 이 마지막 도구/워크플로 버전은 guard selftest·기존6개 원자료의 계약 재확인·문법/정책 검사로 확인했고, 같은 물리suite를 반복하지 않았다. 마지막 바이트 기준 실제 Actions schedule/dispatch/workflow_run 결과는 아직 미검증이며 전송 후 run 영수증으로 확인한다.

[로컬 원자료 해시·실행 소스·후속 검증 영수증](automatic_checks_validation.json)에 성공과 최초 실패를 함께 보존했다.

첫 GitHub dispatch는 HTTP422로 거부됐다. job 수준 `env`에서 `runner.temp` 표현식을 지원하지 않는다는 실제 서버 검증 결과다. 로컬 YAML 구문 검사는 Actions의 context 유효성까지 보장하지 못했다. 첫 shell step의 `RUNNER_TEMP`로 경로를 만들고 `GITHUB_ENV`로 다음 step에 전달하도록 수정했다. 등록 상태 active만으로 실행 성공이라고 판정하지 않으며, 수정 뒤 실제 run을 검증한다.
