# 청강검 충돌 급회전 · 원인 확인 / 관절 수용 후보 보존

2026-10-04. 목적은 **충돌 순간 칼날이 크게 뒤집히는 현상을 줄이면서 큰 베기의 관성과 몸의 부담을 남기는 것**이다. 선택형 연구 승인 범위이며 게임·손·공개 엔진 변경은 없다. 기준 `4becf57dcf28ca7bde96d6745ba7dc2ff39b8596`; 실제 dirty 도구·원자료·엔진·명령·실패 경계는 [JSON](qinggang_contact_20261004.json)에 기록했다.

저장된 실제 청강검 수동 입력/보통 AI 전투를 생성부터 재실행했다. tick965/8.05초 전 **965스텝의 native·입력·제어·사건과 충돌 직전 상태가 exact**다. 관찰 실행은 이후도 원자료와 일치했다. 무기 접촉 응답만 한 스텝 끈 진단에서 축속도 −42.61→+1.42rad/s로 바뀌어 이 장면의 native 무기 충돌이 필요한 원인임을 확인했다. 충돌을 끄는 플레이 후보는 아니다. 명령 축토크는 −.0061Nm였고 기존 clash 처리는 이미 돌아간 자세를 고치지 못한다.

| 같은 첫 충돌 | 기존 → 기존 관절 모터 후보 |
|---|---|
| 물리 후 검 길이축 속도 | −42.61→−3.85rad/s |
| 첫 스텝 검날 비틀림 | 23.21°→9.49° |
| 검–전완 상대 비틀림 | 27.63°→13.81° |
| 이후31스텝 상대 비틀림 경로 | 1.409→1.494rad, 약6% 증가 |

연구 엔진의 기존 그립 관절에 **충돌 직전 상대 속도를 목표로 둔 모터를 한 스텝만** 연결했다. 관절·몸·접촉을 보존하고 설정 시 상태 불변을 확인했다. 손목 요청8.50Nm/기존11.64Nm에서 남은3.13Nm를 축3개로 나눴고 마지막 solver substep의 scalar 충격량은 각 한도 아래였다. **실제 상대 자세에서 native Jacobian의 세계 토크 배율·목표 속도 투영은 미검증이다.** 요청 예산과 실제 vector 힘 한도를 혼동하지 않는다. 연구 엔진도 공개 npm 게임을 대체하지 않았다. 첫 회전 감소를 사실감·전체 개선 수락으로 쓰지 않는다.

충돌 뒤 검·전완에 반대 충격을 주는 별도 후보는 엄격한 각운동량 판독 잔차2.572e−7이 기준1e−7N·m·s를 넘어 중단했다. 관성 재구성/Float32 수치 오차로 설명되지만 기준을 완화해 합격시키지 않았다. 이미 적분된 첫 자세도 그대로여서 공개 보류다.

게임 재생6명령/7궤적에는 같은 조건의 실패 진단 반복과 native 관찰·후속 확장이 포함된다. 독립 효능7조건이 아니다. API 분리 검사12조건+질량 초기화 정정 반복12행은 게임 효능 검사가 아니다. 최초 자료/도구와 실패를 보존했다. 이전 찌르기 일지의844/802는 마지막 tick을 개수로 오기한 값이며845/803으로 집계만 정정했다.

재현에는 실제 수령한 외부 reference와 연구 엔진이 필요하다. 아래는 최종 도구 명령이며 당시 각 실행의 argv·도구 해시는 JSON의 원자료 지도에서 확인한다. 같은 게임 소스와 기록된 도구를 준비하고 기존 출력을 덮어쓰지 않는다.

```sh
node tools/sim/experiments/qinggang_contact_probe.mjs --reference=/workspace/halfsword-handoff/onehand-thrust-20261004/contact-tap-run06.json --out=/tmp/NEW-contact.json --modes=observe,noSwordPair
node tools/sim/experiments/qinggang_contact_probe.mjs --reference=/workspace/halfsword-handoff/onehand-thrust-20261004/contact-tap-run06.json --out=/tmp/NEW-native-contact.json --modes=nativeGrip --after=30 --module=/workspace/halfsword-research-import-20261003/engine/rapier.mjs
node tools/sim/experiments/qinggang_contact_metrics.mjs --root=/workspace/halfsword-handoff/qinggang-contact-20261004 --reference=/workspace/halfsword-handoff/onehand-thrust-20261004/contact-tap-run06.json --out=/tmp/NEW-contact-metrics.json
```

**판정: 원인 확인·native 후보 연구 보존, 공개 보류.** 새 사용자 테스트 요청은 없다. 기존 [세이버 비교판](https://yoonjl-svg.github.io/halfsword-codex/feature-lab.html#thrust-edge-comparison)을 유지한다. 다음30–45분은 저장된 상대 자세에서 motor scalar→실제 세계 힘/목표 속도 계약을 확인하고 무접촉 베기의 보존을 좁게 검사한다. 통과하기 전 생성부터 전투·다른 무기·모바일 공개 검증으로 확장하지 않는다. 실패 지지·절삭·새 손 후보를 되살리지 않는다. 전체2단계 P-03/P-04 진행 중이며 P-01~P-06 전체 완료는 없다.

**후속 판정:** [그립 힘·속도 회차](native_grip_wrench_20261004.md)에서 실제 자세의 모터 좌표/이론적 힘 예산은 확인했다. 다만 생성부터 연속 적용은 날 비틀림과 실제 찌르기·접촉 분기가 남아 공개 기각했다. 위23.21°→9.49°는 같은 상태의 첫 스텝 진단으로 보존하며 연속 적용 권고가 아니다.
