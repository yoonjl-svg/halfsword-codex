# 유파 공격 연구 전체 전달 · 2026-11-03

사용자가 **“개발일지 발행하고 조사 자료 우화에게 보내줘”**라고 승인한 전달입니다. 조사 결과·실패/정정·정본/제외 목록·원시 입력/피해·J표·재현 코드·브라우저 증거를 함께 보냅니다. 새 밸런스 패치는 없습니다.

## 기준과 전달 범위

- 수신 최신 main: `69609d345ef36c7d2ce18462b7205d2f8bae2d58`에서 전달 가지 `codex/attack-balance-handoff-20261103`을 먼저 만들었습니다. 발행 직전 다시 확인합니다.
- 실험 기준: `88a96061e8dd93e8f107b7b0df647a341e73fa5d`. 고정 연구 원본/최종 J 집계: `6806a1010d3d4146a613f9ab59562c69991270ce`, `codex/attack-balance-20261101`.
- 두 기준 사이 변경은 일지/수신 기록9파일뿐입니다. **기존 src238개 + package.json/package-lock.json/하니스 =241개가 Git blob까지 동일**하며 src 트리도 `215e00b57d0ac8b836df7fc94faaa5dd61ba770c`로 같습니다. [호환성 전수 비교](compatibility.json).
- 연구 원본377파일178,971,455bytes를 바이트 그대로 옮겼습니다. [원본 목록과 SHA256](files.json). 여기에 이 인계·검증 자료를 추가합니다.
- 기존 게임 src·물리·피해·기력·AI·유파·보법·대기실·저장·의존성 변경0. 새 `src/attack_balance_probe.js`는 연구 전용 Vite에서만 주입합니다. 일반 진입점에는 연결하지 않습니다. 변경된 기존 파일은 선택 관측 인자를 추가한 `tools/sim/special_balance.mjs`뿐입니다.

## 결과·추천 판단

[전체 보고](../../research/attack_balance_20261101/README.md)와 [등급별 한 번 효과 비교](../../research/attack_balance_20261101/GRADE_COMPARISON.md)가 정본입니다.

- 비기5·특수5·일반 고유9=19계열. 단발/조건684개, 자동 입력 내성456개, 최대 기준30초 대련120판. 별도 비기7하위 잠재252개·이탈리아 경로/심화108개. 총1,620개 관측이며 반복/대조/하위분기를 포함하므로 독립 사람 표본 수가 아닙니다.
- 사람 회복25/초·최대100·무한끔, 비기1회/동방3회, 특수 동작/끝 자세 뒤3초 식힘을 유지했습니다. 준비 공격/이동/막기 비용, 실제 발동/접촉/상처, 양측 의식·출혈·사지·무장·종결을 나눴습니다.
- Cav는 접촉이 갱신되며 탭이 이른 입력으로 소모되는 실패가 있었습니다. 직접 피해 계수보다 입력 손실/기회 규칙 검토 후보입니다. Inquartata는 보통 거리6짝에서 준 상처0.940 대0.079, 받은 상처0.274 대0으로 공격적 교환 후보입니다.
- 코테는 직접 상처0이었지만 **정적 단발18개 중 무장해제2회**가 있었습니다. 피해0을 기술 가치0으로 해석하지 마십시오. 걸음 공격은 거리별 칼길/적중 문제 후보입니다.
- 리솔루토와 격살 머리/목 갈래의 결정력은 높고, 어거·고노센은 한 번의 승부 결정력이 낮았습니다. 준비 부담·제압/방어 교환·동방3회 차이를 포함해 판단해야 합니다. 확정 너프/버프안이 아닙니다.
- [J표](../../research/attack_balance_20261101/ENERGY_TABLE.md), [CSV](../../research/attack_balance_20261101/energy_summary.csv), [154접촉 전수](../../research/attack_balance_20261101/energy_contacts.csv). 대련120판의 해당 기술 몸접촉당 최소/최대/평균/중앙값입니다. 고노센 중앙195.14J, 죽음의 일격99.28J이지만 부위/둔타 기절 때문에 J 순서가 치명성 순서는 아닙니다. 겹치기1470.57J·인콰르타타2257.42J·정수리4965.25J 등 극단값은 원본 시드/시각/부위와 함께 별도 조사할 대상입니다. 평균과 중앙값을 같이 보십시오.

## 원본 해석과 한계

- 동일 정적 궤적의6시드 반복은 독립 확률 표본이 아닙니다. 사람 성공률·실기기 손맛·전체 무기/방어구 범위를 검증하지 않았습니다. 승패/30초 누적 피해는 드문 기술의 주평가 지표로 쓰지 않았습니다.
- 요청 수락과 실제 운동 시작을 분리했습니다. `state=dead`는 기절 패배를 포함합니다. 모르트 가까움6건은 기절6·사망0입니다. 조건 실패는 위력0이 아닙니다.
- 제비 베기의 정적 첫 칼이 맞아 조건이 없었던 시행을 약한 한 방으로 세지 않았습니다. 대련에는 실제 발동/상처가 있습니다. 준비 베기를 겹치기/특수 피해에 합치지 않았습니다.
- redondo의 초기 on/off 입력 갈림은 프레임 명령 재생으로 보완, lianchi의 논리 탭은 실제 Input/프레임 사이 떼기로 보완했습니다. 보완 전 원본은 진단용으로 남기고 정본에 중복 합산하지 않았습니다. [정본 목록](../../research/attack_balance_20261101/canonical-manifest.json).
- 기록부 유무의 원시 결과 동일, 기존 src238개 불변, Chromium 초기19종 trusted pointer160·페이지 오류0, 보완 포함13계열 동작을 확인했습니다. 나머지6계열은 해당 브라우저 장면에서 미확인입니다. 자동 입력456개 모두 DOM을 통과했다는 뜻이 아닙니다.

## 재현 방법

자료 분석만 다시 할 때는 이 전달 가지의 루트에서 아래 명령을 사용합니다. 새 전투를 돌리지 않습니다.

```sh
python3 tools/sim/balance_energy_summary_20261101.py
python3 tools/sim/balance_generic_analyze_20261101.py
python3 docs/import/attack_balance_20261103/verify.py
```

원 실험의 고정 HEAD 가드 때문에 **새 전달 HEAD에서 전투 실행기를 바로 돌리지 마십시오.** 당시처럼 HEAD는88a96061로 두고 연구 도구만 작업 트리에 얹는 격리 체크아웃을 사용합니다. 아래는 코드/노드 의존성만 준비하는 예시이며 main을 바꾸지 않습니다.

```sh
git fetch https://github.com/yoonjl-svg/halfsword-codex.git codex/attack-balance-20261101
git worktree add --detach ../attack-balance-repro 88a96061e8dd93e8f107b7b0df647a341e73fa5d
git -C ../attack-balance-repro restore --source=6806a1010d3d4146a613f9ab59562c69991270ce --worktree -- tools/sim/special_balance.mjs 'tools/sim/balance*20261101*' tools/attack_balance_page tools/browser/attack_balance_inputs_20261101.mjs src/attack_balance_probe.js docs/research/attack_balance_20261101
cd ../attack-balance-repro
npm ci
```

이후 각 분야 README의 명령을 따르되 기존 정본과 다른 `--out` 경로를 지정하십시오. 실행 당시 도구 변형은 각 run의 snapshot/hash를 확인합니다. 최종 도구로 모든 초기 진단 버전까지 동일하다고 주장하지 않습니다. 계측/압축/화면 검수만 재검증한 전달이며 새1,620개 실험을 다시 한 것으로 세지 않습니다.

## 직접 확인·적용·되돌림

[19종 연습](https://yoonjl-svg.github.io/halfsword-codex/encounters/attack-balance-20261101/) · [휴대폰 결과표](https://yoonjl-svg.github.io/halfsword-codex/encounters/attack-balance-20261101/report.html). 고정 연구판이며 본판 저장과 분리했습니다. 연구 빌드는 SW·캐시 작업0입니다. 공개검증은 publication/에 보존했고 이번에 실기기 체감을 새 측정한 것은 아닙니다.

이번 전달은 검토·재현 자료입니다. 기존 게임을 교체하거나 후보를 자동 활성화하지 않습니다. 가져올 때는 전달 독립 커밋 하나를 cherry-pick, 되돌릴 때는 해당 커밋 하나를 revert하면 됩니다. 저장 스키마 변경 없습니다. 우화 저장소 직접 쓰기0. 발송 완료와 실제 열람/검토/채택은 구별해 기록합니다.
