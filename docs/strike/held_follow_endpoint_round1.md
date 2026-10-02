# Q04 hold 끝점 유지 연구 구현 1차

2026-10-02. **후보 한 가지를 실제 게임에 격리 연결하고 lifecycle·동일 상태·입력·같은 수치 토크 예산을 검증했다. 일반 적용은 하지 않는다.** 내려베기 hold의 종료 회전량/끝 에너지는 줄었지만, follow가 더한 끝점을 고정하면 현재 팔 길이 밖 요청을 더 오래 유지했다. 이 결과를 재현 가능한 연구 구현으로 보존하며 추가 후보·확장은 이번 회차에 실행하지 않는다.

[후보](../../tools/sim/experiments/held_follow_endpoint_candidate.mjs), [실제 probe](../../tools/sim/experiments/held_follow_endpoint_probe.mjs), [metrics](held_follow_endpoint_round1_metrics.json). core·이전 완료 파일·엔진·공용 도구·강도·gain·몸/속도는 바꾸지 않았다. HEAD는 `86a9fa06e64bd216f8952b4f3f2ef6754f18a6f1`이며 정확한 파일/임시 모듈/엔진 SHA는 metrics에 있다.

## 구현 계약

[직전 진단](release_intent_diagnosis_round1.md)의 hold/release 공통 .725초 반전은 follow 감쇠→aimRaw→필터에서 시작했다. 후보는 그 경로 한 곳에만 개입한다. 실제 입력이 있었고, `handHeld=true`인 채 실제 handOffset 변화와 `inputActive`가 멈추고 `swinging=false`로 넘어간 첫 경계에서 **기존 aimRaw와 follow 및 실제 입력 끝점**을 저장한다. 그동안 follow 감쇠를 멈추고 aimRaw를 저장한 끝점으로 유지한다. 기존 2차 필터/근육 제어는 계속 실행한다.

새 실제 handOffset 변화 또는 `inputActive=true`이면 latch를 해제하고 현재 상태에서 원래 follow/filter 경로를 다시 실행한다. release도 같은 스텝에 해제한다. 재입력이 다시 멈추면 새 끝점을 잡는다. 새로운 몸 위치·각속도·근력·숨은 gain을 주입하지 않는다. 감지 기준은 입력 offset의 수치 변화이며 **손가락 떨림과 사람의 의도를 구별하는 정책은 검증하지 않았다.** 변화 문턱 1e−12m는 수치 동일성 판정이고 인체 입력 deadband가 아니다.

## 첫 두 조건과 실제 실행 관문

롱소드 down/up, 각각 hold만 검사했다. 준비 legacy 3초, 측정 paired 그립, 동일 drag .55초와 hold 1.2초, seed7, 실제 `G.step`/native solver를 썼다. 각 조건에 original/observe/원문 clone/candidate/sharedCap 기준/같은 수치 cap 기준/같은 수치 cap 후보의 7행, 총 **최종 14행**이다.

observe/clone의 전체 기존 physical/control trace·매 스텝 native trace는 original과 exact다. candidate는 실제 67번째 skill update(.550초)에서 한 번 latch했고 나머지 144스텝을 유지했다. 후보/각 예산 기준의 전체 drag native trace와 **첫 latch 개입 전 실제 native snapshot·입력/Skill 제어 상태**가 exact였다. 첫 latch의 제어 해시는 전체 Fighter/Gait가 아닌 해당 부분집합이며 준비 단계의 전체 controller 관문과 구분한다. 요청 입력도 같고 후보 `Skill.update` dispatch는 210회였다. 유지 중 aimRaw가 저장된 endpoint와 모든 프레임에서 정확히 같았다.

동일 수치 예산은 기존 도구를 동결한 채 sharedCap 기준의 210개 어깨·손목 cap 쌍을 두 행에 그대로 재생했다. budget 기준의 기존 전체 physical/control trace는 sharedCap 기준과 exact였고, 두 행의 한도 수치·schedule SHA가 같았다. 실제 최종 벡터는 한도 오차 1e−9Nm 이하였다. native 팔꿈치·별도 elbowGravity·빈손 그립까지 포함한 전신 예산은 아니다.

실제 G.step lifecycle fixture도 통과했다. 첫 hold 끝점 유지 → `inputActive=false`인 상태에서 실제 offset +.03m 재입력으로 해제 → 새 hold에서 두 번째 latch → release 즉시 해제 순서를 확인했다. release의 follow가 원래 `exp(−dt/followDecay)`만큼 줄어드는 값과 1e−12m 안에서 같았다. 이것은 script 입력의 제어 계약 검증이며 모바일 사용자 수락이 아니다.

## 수치와 수락 범위

아래는 기준→후보다. drag 중 peak는 개입 전 동일하다. hand error는 **입력 종료 이후 최대값**, reach는 실제 pre-clamp `armIK` 호출에서 목표↔어깨 거리다. 현재 IK 도달 한도는 .565m다. 종료 axis는 blade axis 누적 이동각이며 정지 거리/순 회전량과 다르다.

| 조건 / 예산 | 종료 axis rad | 끝 검 K J | 종료 최대 hand error m | 최대 요청 reach m | 한도 밖 요청 스텝 /144 |
|---|---:|---:|---:|---:|---:|
| down · 기존 | .372420→.248672 | .000196→.000035 | .286421→.286635 | .572355→.575412 | 95→141 |
| up · 기존 | 1.368689→1.353477 | .002696→.002813 | .489439→.489492 | .564591→.565351 | 0→4 |
| down · 같은 수치 cap | .373861→.251915 | .000197→.000036 | .291507→.291755 | .572562→.575624 | 94→141 |
| up · 같은 수치 cap | 1.342359→1.329548 | .003171→.003096 | .498439→.498492 | .563702→.564621 | 0→0 |

down의 종료 axis는 약 33% 줄고 끝 K도 줄었다. 종료 최대 손 오차 증가는 약 .21~.25mm다. 그러나 한도 밖 요청은 기존보다 **46/47스텝**, 약 .383/.392초 길어졌다. up의 K는 기존 예산에서 소폭 늘고 같은 수치 예산에서는 줄었다. 자연스러운 종료나 전달 효율의 전반적 해결을 선언하지 않는다. 모든 행 stand·유한값이며 최대 관절 gap은 metrics에 보존했다. 실제 새 폭주/제어 상실은 관찰되지 않았지만 추가 도달 요청의 악화 때문에 일반 채택은 보류한다.

저장한 끝점은 down `aimRaw=(.02,−.535)m`, 실제 입력 `(.02,−.45)m`, follow `(0,−.105)m`다. up은 `aimRaw=(.02,.605)m`, 실제 입력 `(.02,.52)m`, follow `(0,.105)m`다. 필터가 이 끝점으로 가는 동안 몸통·IK·native 모터는 계속 반응하므로 latch를 정적 팔 유지나 근육 일 0으로 해석하지 않는다.

종료 1.2초 명시적 순 일은 down 기존 어깨 +4.242→+4.470J, 손목 +.070→+.030J이며 같은 수치 cap은 어깨 +4.621→+4.789J, 손목 +.136→+.118J다. up 기존 어깨 +36.305→+36.940J, 손목 −13.329→−13.245J이며 같은 수치 cap은 어깨 +37.473→+37.624J, 손목 −12.384→−12.442J다. 검 COM 중력 일은 down 기존 −2.411→−1.945J, up −6.476→−6.542J다. 원자료에는 elbowGravity·빈손·각 강체의 실제 요청 토크도 있다. 경로 일은 반작용을 포함한 midpoint 순 일이고, 개별 근육 양의 일 총합·전체 native/contact 일은 아니다. 더 작은 끝 K를 근력/전달 효율 개선으로 포장하지 않는다.

## 재현과 이번 회차 종료

```sh
node tools/sim/experiments/held_follow_endpoint_probe.mjs /workspace/halfsword-hybrid-evidence/q04-held-follow-rerun.json
```

기존 출력은 덮어쓰지 않는다. 최종 원자료 `q04-held-follow-r1-final.json`과 SHA256은 metrics에 있다. 최초 같은 14행 원자료 `q04-held-follow-r1.json`은 post-step 가슴을 기준으로 reach를 진단했으며, 최종에서는 실제 pre-clamp armIK 시점으로 바로잡았다. 반복 물리 궤적은 독립 표본에 더하지 않는다. original은 계측이 없어 일 카운터가 실제 0을 뜻하지 않으며 일 비교에는 exact observe를 쓴다.

**검증된 연구 구현과 한계까지 사용자에게 전달할 수 있는 상태다.** 공개 선택형 게임/일반 제어에는 연결하지 않았고, 실제 부상·충돌·횡베기·다른 무기·탭/찌르기·휴대폰·사용자 입력 의도는 미검증이다. 다음 별도 회차의 endpoint 설계는 현재처럼 도달 불가능한 follow 끝점을 오래 유지하는 문제를 먼저 다뤄야 한다. 이번 timebox에서는 두 번째 후보, 자동 clipping, gain 검색 또는 추가 확장을 하지 않는다.
