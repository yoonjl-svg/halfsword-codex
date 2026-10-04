# 청강검 찌르기 · 날 방향 유지 비교

2026-10-05 KST. 목적은 **큰 베기와 무게감을 유지하며 찌르기의 불필요한 비틀림을 줄이는 것**이다. 기준 `830b705eebb82e4c63789ff1fe5a9821ae53b33d`; 변경 소스·입력·엔진·원자료 SHA는 [JSON](thrust_plane_20261005.json), 실제 공개 상태는 [전달 영수증](thrust_plane_release.json)을 따른다.

접촉 전830스텝에서 횡속도 기반 날 평면 목표는 한 스텝81.58° 움직였다. 현재 flat에 대한 signed 오차 −24.52→+63.39°와 목표 자체의 이동은 다른 지표다. 이때 cached/native 횡속도 방향 차이는2.52°여서 지연만을 단독 원인으로 단정하지 않는다. 순수 찌르기의 길이축 목표만으로 날의 회전 방향은 정해지지 않는다.

후보는 첫 탭의 기존 날 목표를 몸 yaw 좌표에서 보존하고 실제 칼 길이축 움직임을 따라 운반한다. 기존 찌르기/거두기 weight로 섞고 bound/down에서는 제외한다. abort는 기존 fade를 유지한다. 현재 flat에 가까운 부호 선택은 남아 **signed 평면 연속성을 보장하지 않는다.** 기존 베기 제어·근력 한도·모터·질량/관성·손 외형은 유지한다. 접촉 뒤 궤적이 같다는 뜻은 아니다. 청강검/manual/profile 플레이어만 `thrustPlane=transported`로 켜며 상대/일반판은 기존 방식이다. 이전 청강검 steady 후보는 계속 보류한다.

| 실제 게임 검사 | 기존 → 후보 |
|---|---|
| 전투 접촉 전803–847 축속도 peak | 34.03 → 14.95rad/s |
| 같은 구간 상대 날 비틀림 경로 | 3.456 → 1.769rad |
| 건강한 짧은 탭246–335 상대 비틀림 경로 | 6.474 → 3.383rad |
| 건강한 탭의 세계 축속도 peak | 29.82 → 30.08rad/s |
| 접촉 뒤 후속 베기960–1079 손 목표 오차 peak | .1802 → .2169m |
| 접촉 없는 탭 뒤 후속 베기396–515 손 오차/칼끝 peak | .12522→.12512m / 12.3188→12.3181m/s |
| 탭 없는 큰 베기516스텝 | native·제어·입력·사건 전부 exact |

생성부터1080스텝 실제 전투는 같은 입력/정상 반응 AI이며 탭803수락,804부터 경로가 갈라진다. 기준803–847에는 검 접촉이 없고 첫 검 접촉은848이다. 접촉 이후 peak는 같은 상태의 힘 효능 증명이 아니다. 후속 구간 접촉0→1과 손 오차+36.7mm는 남는다. precontact 평균 칼 목표 오차도 .2772→.2897rad로 약0.72° 늘었다. 낮은 회전 자체를 인간 자연스러움 점수로 쓰지 않는다. 건강한 짧은 탭에서는 전체 축속도 peak를 낮추지 않았지만 누적 비틀림과 목표 오차는 줄고 후속 베기는 거의 같았다.

**판정:** 일반 승격 없이 좁은 폰 A/B로 비교한다. 독립 감사의 초기 연구 HOLD 의견과 후속 접촉 우려를 보존했고 실제 통합 경계/production 동등성을 별도 확인했다. prototype6행과 production6행은3입력 경로의 동등성 반복이며12개 독립 효능 표본이 아니다. 목표/도메인15검사는 pure fixture이지 bound/down/abort 전투 수락이 아니다. 실제 빌드 A/B 터치·탭 수락·새 세계 재시작/오류0을 확인했으며 공개8파일 byte exact·공개 A/B 터치/탭 수락/재시작·390px 계획/메뉴와 Pages37211640958 성공을 확인했다. 근거는 영수증을 따른다. 브라우저 에뮬레이션·기립 상태는 실제 휴대폰 체감이나 해부학 수락이 아니다.

준비 실패2회는 physics 전 중단했고, tap-run04는 reference 몸 목록 추출 오류로 첫 스텝에서 중단했다. 후보 실패로 분류하지 않고 raw/생성 도구를 보존했다. 다음 명령은 production 소스에서 실행한다. 외부 reference의 실제 bytes/SHA는 JSON을 먼저 확인한다.

```sh
node tools/sim/experiments/thrust_plane_contract.test.mjs /tmp/NEW-plane-contract.json
node tools/sim/experiments/thrust_transport_probe.mjs --reference=/workspace/halfsword-handoff/contact-geometry-20261004/production-live-run06.json --out=/tmp/NEW-plane-live.json --scenario=live
node tools/sim/experiments/thrust_transport_probe.mjs --reference=/workspace/halfsword-handoff/contact-geometry-20261004/production-free-run04.json --out=/tmp/NEW-plane-free.json --scenario=free
node tools/sim/experiments/thrust_transport_probe.mjs --reference=/workspace/halfsword-handoff/onehand-thrust-20261004/integrated-tap-run04.json --out=/tmp/NEW-plane-tap.json --scenario=tap
```

외부 raw는 Git에 없으며 checkout만으로 완전 재현 가능하다고 주장하지 않는다. 건강한 tap의 옛 box reference는 기록된 몸/검·제어·입력·사건만 exact, profile과 전체 native hash 동일은 아니다. [폰 비교](https://yoonjl-svg.github.io/halfsword-codex/feature-lab.html#thrust-plane-comparison)에서 찌른 뒤 다시 베어 비틀림/거두기와 무게감을 판단한다. `thrustPlane`을 주소에서 제거하면 A다. 다음30–45분은 실제 피격 뒤 한손 조작 복귀를 기존 trace에서1장면 골라 작은 개선 가능성을 판정한다. **2단계 P-03/P-04 진행 중, P-01~P-06 전체 완료 없음.** 실패 지지·절삭·새 손/손목 모터 이전 후보는 유지 철회한다.
