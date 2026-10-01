# 채택하지 않은 연구 시제품

`recovery_contact_r0.patch`는 B(받침 .1 / 반사 on / 강도 1) 위에서 시험한 첫 접촉 기반 기립 제어다. 공개 게임에는 설치하지 않는다. **정상 기립을 막고, down 상태의 공중 받침을 해소하지 못해 기각했다.**

원형을 보존하는 이유는 같은 실패를 반복하지 않고 실제 실행 결과를 재검증할 수 있게 하기 위해서다. 보조 힘에서 실제 하중으로의 이전을 설계하는 근거이지 출시 후보가 아니다. 관련 계측은 `docs/strike/recovery_contact_round1_metrics.json`과 `docs/strike/physical_realism_plan.md`를 본다.

재현은 현재 독립 저장소에서 별도 worktree를 만든 뒤 그 안에서만 한다.

```sh
git worktree add --detach /tmp/halfsword-recovery-r0 HEAD
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
git worktree add --detach /tmp/halfsword-slip-observation HEAD
cd /tmp/halfsword-slip-observation
npm ci
git apply --check tools/sim/experiments/support_slip_observation.patch
git apply tools/sim/experiments/support_slip_observation.patch
node tools/sim/support_transfer_probe.mjs --models=legacy,axial --scenarios=walk_front,healthy_getup,hurt_getup --seed=7 --ledger=1 --stride=60 --out=/tmp/support-slip.json
```

`rows[].filteredSlip`에 접촉점별 mean/p95/max와 peak 당시 상태가 생긴다. 기존 probe의 프레임별 최대 점속도 평균과 정의가 다르다. raw 충격량은 매니폴드 합이며 개별 solver점의 하중으로 대응시키지 않는다.
