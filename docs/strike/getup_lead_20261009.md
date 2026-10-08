# 기립 뒷다리 시간차 · 10/09

**`.3` 지연을 선택형으로 전달하며 일반판은 기존 기립을 유지한다.** 사용자가 승인한 [우화 S-038](https://github.com/yoonjl-svg/halfsword/blob/fc1bbbb0716aadc2384f524e202c50c45321df87/docs/strike/getup_lead_2026-10-08.md)의 관절 목표 시간차를 이식했다. 뒷다리만 늦게 펴며 골반·지지력·기립 시간표는 바꾸지 않는다. 기각한 다섯 지지 후보를 복원하지 않았다.

기준 `9171874a880024010a87ad793fd6fd58a7817f3e`. 실제 게임15실행·19,913step, 소스 전후 해시 일치. 도입 OFF는 기존1,106step과 native exact다. `.5`의 높은 발 들림을 줄이려고 `.3` 한 안만 추가했으며 기존 대조군을 재사용했다.

| 조건 | 뒤발 중심 최고 높이 A→.3 | 실제 양 무릎 신전 차 A→.3 |
|---|---:|---:|
| 누움 | 25.7→34.7cm | −.025→.092초 |
| 옆넘어짐 | 17.8→27.6cm | .075→.175초 |
| 앞다리 기능.45 | 19.2→27.5cm | .017→.158초 |
| 실제 피격seed1 | 22.0→28.1cm | .008→.075초 |

신전 차는 실제 무릎각−.8rad 통과 간격이다. rise의 앞발·양발 접촉 상실은 모두0이나 옆/손상 조건의 미끄럼은 일부 증가했다. 자연 후보는 선 뒤 새 머리 타격으로 사망했다. 직전33step은 양쪽 모두stand·양발 무접점0이므로 **자발적 기립 붕괴와 구별한다.** 자연2초 인계는 미완료다.

브라우저 제조 누움의 중반·후반·기립6장을 확인했다. 중반 다리 비대칭은 개선됐지만 떠오르는 인상·체중 인계까지 해결하지 않았다. 첫 ON 대기는60초 timeout, 작은 viewport 재시도는3장 성공·JS오류0·빌드 해시 동일이다. A/B 해상도와 시점이 조금 달라 픽셀 비교나 실물 폰 검증으로 부르지 않는다.

[상세 수치·소스/원자료 SHA·시각 기록](getup_lead_20261009.json). 저장소 밖 보존 경로는 `/workspace/halfsword-handoff/input-getup-range-20261009/getup/`다. frozen source에서 새 출력 경로로 재현한다.

```sh
cd /workspace/halfsword-handoff/input-getup-range-20261009/getup/candidate-lag03
node tools/sim/experiments/getup_sequence_20261009_probe.mjs --mode=side --models=on --seed=7 --out=/tmp/NEW-getup-side
```

계획 주소는 `?movementFix=getup-base&weapon=zweihander`와 `?movementFix=getup-lead&weapon=zweihander`다. **이 기록 작성 시 공개 전달은 미검증**이며 최종 전달 영수증을 따른다. 다른 다리 손상·절단·반대 방향·전 무기 검증은 남는다.
