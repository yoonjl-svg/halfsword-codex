# 채택하지 않은 연구 시제품

최신 회차는 [실험 색인](../../../docs/strike/EXPERIMENT_INDEX.md), [일지 계약](../../../docs/strike/EXPERIMENT_LOGGING.md)에서 찾는다. 아래는 실패 시제품의 역사 재현 안내다. 옛 결과를 재현할 때는 보고서의 고정source SHA·당시 패치/엔진/입력 해시를 준비한다. 현재HEAD 실행을 옛 결과의 재현으로 주장하지 않는다. 아래 `RECORDED_SOURCE_SHA`는 해당 원보고에서 확인해 지정하는 값이며 자동 최신HEAD가 아니다.

`recovery_contact_r0.patch`는 B(받침 .1 / 반사 on / 강도 1) 위에서 시험한 첫 접촉 기반 기립 제어다. 공개 게임에는 설치하지 않는다. **정상 기립을 막고, down 상태의 공중 받침을 해소하지 못해 기각했다.**

원형을 보존하는 이유는 같은 실패를 반복하지 않고 실제 실행 결과를 재검증할 수 있게 하기 위해서다. 보조 힘에서 실제 하중으로의 이전을 설계하는 근거이지 출시 후보가 아니다. 관련 계측은 `docs/strike/recovery_contact_round1_metrics.json`과 `docs/strike/physical_realism_plan.md`를 본다.

재현은 현재 독립 저장소에서 별도 worktree를 만든 뒤 그 안에서만 한다.

```sh
git worktree add --detach /tmp/halfsword-recovery-r0 RECORDED_SOURCE_SHA
cd /tmp/halfsword-recovery-r0
npm ci
git apply --check tools/sim/experiments/recovery_contact_r0.patch
git apply tools/sim/experiments/recovery_contact_r0.patch
node tools/sim/recovery_support_probe.mjs --candidates=R --conditions=healthy,hurt,wound,wound_side_pos,wound_side_neg,disabled,unsupported --out=evidence/recovery-support-r0-replay.json
```

본 probe는 패치가 없는 상태에서 R을 요청하면 오류로 중단한다. B로 몰래 대체하지 않는다. 정상 B 계측에는 이 패치가 필요 없다. 원시 전체 접촉 기록은 작업공간 `/workspace/halfsword-hybrid-evidence`에 보관하고, 저장소 요약에 원자료 해시를 남겼다.

## 지지 경로 탐색 2차

`support_transfer_discovery.mjs`는 실제 legacy 제어의 수직 골반 힘을 가로채 관절 `JᵀF`(vmc), 다리 양끝 축 방향 힘쌍(axial), 같은 외력 재적용(legacy), 제거(off)를 비교한 초기 탐색이다. 게임에서는 불러오지 않는다. 첫 vmc는 총 관절 토크 제한·기존 PD와의 분담 없이 기립을 시도해 실패했고 채택하지 않았다. 이 파일의 axial은 초기 탐색이며 실제 접촉 검증·부상별 용량 제한을 추가한 `src/support_transfer.js`와 다르다.

```sh
node tools/sim/experiments/support_transfer_discovery.mjs vmc 1 /tmp/support-vmc.json
node tools/sim/experiments/support_transfer_discovery.mjs axial 1 /tmp/support-axial-discovery.json
node tools/sim/experiments/support_transfer_discovery.mjs legacy 1 /tmp/support-legacy-control.json
```

0..1인 두 번째 인수는 제거·재분배할 수직 받침 비율이다. seed7, B .1/on/1, paired 그립, 3초 legacy 준비 뒤 서기6초·전진6초·기립8초를 사용한다. `stand` 상태 수만으로 기립 성공을 판정하지 않는다. 정식 후보와 명령·한계는 `docs/strike/support_transfer_round2.md`를 본다.

## 접촉점 미끄럼 분리 관찰

`support_slip_observation.patch`는 2차 probe에 읽기 전용 접촉점 분포를 추가한다. 실제 접촉/양의 raw 충격량/stance를 분리하며, 게임 소스는 변경하지 않는다. 최초 측정은 저장소 밖 worker로 수행했고 기존 6개 전체 물리 trace가 exact였다. 패치는 그 worker의 import/metadata 경로만 이식 가능하게 바꾼 것이며 적용 검사를 통과했다. 원자료 정의/해시는 2차 metrics의 `slipDiagnosis`를 본다.

```sh
git worktree add --detach /tmp/halfsword-slip-observation RECORDED_SOURCE_SHA
cd /tmp/halfsword-slip-observation
npm ci
git apply --check tools/sim/experiments/support_slip_observation.patch
git apply tools/sim/experiments/support_slip_observation.patch
node tools/sim/support_transfer_probe.mjs --models=legacy,axial --scenarios=walk_front,healthy_getup,hurt_getup --seed=7 --ledger=1 --stride=60 --out=/tmp/support-slip.json
```

`rows[].filteredSlip`에 접촉점별 mean/p95/max와 peak 당시 상태가 생긴다. 기존 probe의 프레임별 최대 점속도 평균과 정의가 다르다. raw 충격량은 매니폴드 합이며 개별 solver점의 하중으로 대응시키지 않는다.

## 내부 힘쌍 경로 원인 분리

`support_pair_cause_observation.patch`는 위 slip 관찰을 포함한 별도 진단이다. **패치하지 않은 probe에 이것 하나만** 적용한다. 두 패치를 겹쳐 적용하지 않는다. 게임 소스는 바꾸지 않지만, 진단 C는 실행 중 driveBalance의 내부 힘쌍을 가로채 골반 외력으로 바꾼다. 플레이 후보가 아니다.

위와 같은 별도 worktree에서 이 패치를 적용한 뒤 실행한다.

```sh
git apply --check tools/sim/experiments/support_pair_cause_observation.patch
git apply tools/sim/experiments/support_pair_cause_observation.patch
node tools/sim/support_transfer_probe.mjs --models=legacy,axial,axial_external_diag --scenarios=walk_front --seed=7 --ledger=1 --stride=60 --out=/tmp/support-pair-cause.json
```

A/B 물리 trace exact와 세 조건 준비/입력 동일을 확인한 최초 외부 worker 측정은 `docs/strike/support_pair_cause_metrics.json`에 있다. 이식 패치는 경로만 정규화하고 적용 검사를 통과했다. C는 평균/p95 미끄럼을 줄이지만 최대값은 더 나빠져 채택하지 않는다. 내부 수평 성분·발 반작용·골반 모멘트·전체 외력이 함께 달라지므로 특정 항 하나의 원인으로 단정하지 않는다.

## 2026-10-06 통합 준비판 — 미노출로 공개 보류

`round5_recovery_contact_staged.patch`는 `43f2ee5108decb5884841973557cf81a5d6eafef`의 게임 소스 위에 준비한 회복+타격 비교 연결이다. 실제 회복 뒤 손 재베기 관문 미노출로 공개하지 않았다. 실패 후보의 재권유가 아니라 준비물 보존이다. [5회차](../../../docs/strike/phase2_round5_20261006.md)를 먼저 읽는다.

`round5_recovery_probe.mjs`, `round5_entry_contracts.mjs`, `tools/browser/recovery_contact_v2_delivery.mjs`는 이 패치의 helper/연결을 전제로 한다. 현재 공개 소스에서 그대로 실행하지 않는다. 별도 checkout에 패치를 적용하고, 원보고의 frozen `SOURCE.json`·해당 probe 버전·engine/lockfile SHA를 확인한다. 첫 passive와 helmet 보완은 probe 버전이 다르며 원본은 보고의 외부 frozen 경로에 보존했다. 같은 경로명만으로 원자료가 존재한다고 가정하지 않는다.

```sh
git apply --check tools/sim/experiments/round5_recovery_contact_staged.patch
git apply tools/sim/experiments/round5_recovery_contact_staged.patch
node tools/sim/experiments/round5_entry_contracts.mjs
# 물리 실행은 보고의 SOURCE.json을 검증한 별도 frozen checkout에서만:
node tools/sim/experiments/round5_recovery_probe.mjs --fixture=helmet-duel --out=/tmp/halfsword-round5-replay
```

고정 소스의 정확한 재실행과 현재 준비판의 재검사는 구분한다. `round5_recovery_report.py`는 보존된 실행의 JSON을 읽기만 하며 물리를 실행하지 않는다.
