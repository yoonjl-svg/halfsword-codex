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
