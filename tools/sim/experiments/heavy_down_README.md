# 실제 heavy down 진단 재현

이 도구는 실제 `harness_m`/Fighter/Combat/Rapier를 재사용한다. 게임이 import하지 않는 진단이며, 원본·상대 저장소나 네트워크에 접근하지 않는다. `observed`, `finite`, 종료코드 0은 관찰·재현 관문 완료를 뜻한다. 기립 성공·자연스러움·공개 합격 판정이 아니다. 큰 발사·관절 분리도 유한값일 수 있다.

## 현재 소스의 지면 유지 heavy down

```sh
node tools/sim/experiments/heavy_down_launch_probe.mjs --models=legacy,axial --scenarios=healthy_getup,hurt_getup,disabled_getup --seed=7 --seconds=25 --ledger=1 --stride=12 --out=/tmp/heavy-down.json
```

legacy로 3초 자연 준비 후 실제 `knockDown(true)`를 호출하고 모델을 바꾼다. 바닥을 유지하고, 상대만 harness의 park를 사용한다. 피해 조건은 controller leg-health 직접 설정이며 실제 검 충돌 부상이 아니다. 건강/편측 .45/양쪽 .2를 구별한다. DT는 1/120이며 몸의 순간 이동·회전·속도 설정·freeze가 없다. `downToGetupObserved`, 실제 높이/기울기/접촉과 dense/per-step 자료를 확인한다. `stand` 자동 전이는 실제 기립과 다르다. 짧은 실행은 경로·자세를 검증하지 못한다.

실행 경로 확인만 하는 짧은 1행 검사는 다음과 같다.

```sh
node tools/sim/experiments/heavy_down_launch_probe.mjs --models=legacy --scenarios=healthy_getup --seconds=0.1 --out=/tmp/heavy-smoke.json
```

## 고정 커밋의 지연 힘쌍/upright 삭제 대조

```sh
node tools/sim/experiments/heavy_down_delayed_ablation.mjs --source-ref=b6483ea --seed=7 --seconds=25 --switch=2 --out=/tmp/heavy-delayed.json
```

**절대 출력 경로를 사용한다.** 우리 git의 지정 커밋 `src/tools/package`를 임시 디렉터리에 archive하고 core SHA256을 git blob과 대조한다. 현재 node_modules를 링크하므로 package-lock 동일성도 검사한다. 새 portable 도구 두 파일만 임시 사본에 복사하고 종료 시 사본을 지운다. 저장소 checkout이나 core를 바꾸지 않는다. 결과에는 archive SHA256, core SHA256, 실행 전후 전체 src SHA256이 남는다. 작업트리에서 새 도구와 관련 core가 동시에 수정되고 있으면 실행하지 않는다.

네 조건은 원래 axial로 2초까지 동일하게 넘어지고 이후 기존제어/힘쌍만 삭제/upright만 삭제/둘 다 삭제를 비교한다. switch 전 wrapper는 passthrough다. driveBalance 범위의 pelvis/foot addForceAtPoint만 가로채며, native upright의 회전3축 k/d만 driveBalance 뒤 0으로 한다. 다른 PD·목표·입력은 바꾸지 않는다. controller 계산값 balanceProbe.supportTransfer는 삭제 조건에서도 남으므로 실제 적용힘으로 읽지 않는다. ledger는 실제 전달된 explicit 힘만 관찰하고 native motor/contact 일은 직접 측정하지 않는다.

동일 초기/입력/switch 전체 상태 SHA, 소스 고정, finite를 관문으로 검사한다. b6483ea·seed7·25초 baseline trace는 `dd37acfde6fee03dc3b15d762b2256c66c4158d41567950a43dc5f8d376c8df6`과 exact 비교한다. 다른 커밋은 `--expected-baseline-trace=SHA256`을 지정하거나 미검사(null)로 남긴다.

**switch=2는 완전히 낮게 누운 자세를 보장하지 않는다.** 최초 재현의 switch 골반은 .5993m, 가슴 기울기83.755°였고 최저 .215m는 이후였다. 반드시 switchWitness를 읽는다. 자세에 맞춘 별도 `same_lying_recovery_probe.mjs`와 구별한다. 삭제 조건의 회복 불능·폭발은 실패 관찰로 보존하며 삭제를 해결책으로 채택하지 않는다. 원자료는 수십 MB가 될 수 있으므로 저장소에 커밋하지 않는다.

## 같은 낮은 누움에서 회복만 비교

```sh
node tools/sim/experiments/same_lying_recovery_probe.mjs --out=/tmp/same-lying.json
```

우리 고정 원판 b6483ea의 driveBalance로 건강2.2초/편측 손상2.8초까지 자연 낙하한다. 원판 전체 trace, 낮은 down 자세, 분기 직전 native snapshot·물리/제어 상태의 동일성을 먼저 검사한다. 두 분기에서 동일한 메모리 주소일 필요는 없으므로 제어와 무관한 collider wrapper/WASM 포인터는 추가 제어 해시에서 제외한다. 원본 자료는 보존한다. 현재 projected 회복은 부상 재넘어짐3회가 남아 공개 불가다.

## 기각한 stand 전환 문턱 실험

`recovery_readiness_rejected.patch`는 **위 진단 도구만** 바꾸며 게임에 적용하지 않는다. 기존 관찰용 높이/기울기/발접촉 조건을 충족해야 stand로 바꾸는 단순 가설이다. 같은 누움 관문은 유지한다. 건강/손상 모두25초 뒤 getup에 갇히므로 기각했다. 실패의 재현이며 권장 수정이 아니다.

```sh
git apply --check tools/sim/experiments/recovery_readiness_rejected.patch
git apply tools/sim/experiments/recovery_readiness_rejected.patch
node tools/sim/experiments/same_lying_recovery_probe.mjs --out=/tmp/readiness-rejected.json
git apply -R tools/sim/experiments/recovery_readiness_rejected.patch
```

진단 후에는 실행 성공 여부와 무관하게 역적용하여 도구를 복원한다. 공개 코드나 이미 적용한 변경 위에 중복 적용하지 않는다. 이 문턱은 인체 실측 기반 한계가 아니며 게임의 숨은 제한으로 옮기지 않는다.
