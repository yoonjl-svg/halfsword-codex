# 한손 찌르기 날 흔들림 · 세이버 선택형 / 청강검 보류

2026-10-04. 목적은 **찌를 때 칼날이 불필요하게 좌우로 비틀리지 않게 하되, 큰 베기의 관성과 거두는 부담을 남기는 것**이다. 사용자 승인 범위의 선택형 연구이며 일반 물리 승격은 없다. 기준 `bf1f9246c7b652f8da89fb72e16a7e520952ca38`; 실제 측정한 dirty 소스·도구/엔진 해시·원자료·명령은 [JSON](onehand_thrust_20261004.json), 실제 공개 결과는 [영수증](onehand_thrust_release.json)에서 구분한다.

실제 컴파일 B의 터치/짧은 탭 화면에서 회전을 확인했다. 기존 날 정렬은 중점 속도로 만든 평면을 매 프레임 현재 날에 가까운 부호로 선택한다. 청강검 tick260→261에서 평면오차 +.331→−1.271rad, 적용 축토크 +.037→−.331Nm으로 바뀌었다. 찌르기 목표는 이미 고정된 구간이다. 구면 그립에는 회전 제한이 없어 검–전완 상대 회전과 팔 비틀림을 같은 현상으로 부를 수 없다.

후보는 **찌르기 가중치만큼 이동 속도 기반 날 평면의 비중을 줄여 기존 쉬는 평면으로 연결**한다. 축/토크 gain·힘 한도·반동·엔진은 유지한다. 이전 기각 평면/C2 후보를 되살리지 않았다.

| 같은 입력의 짧은 탭 | 기존 → 후보 |
|---|---|
| 세이버 · 검–전완 상대 길이축 회전 경로 | 7.747→4.395rad, 43.3% 감소 |
| 청강검 · 같은 지표 | 6.875→3.709rad, 46.1% 감소 |
| 후속 베기·유지 | 궤적 차이 작음; 탭 없는 전체 trace 두 무기 exact |

이 지표는 자세 quaternion의 유한 스텝 분해이며 **해부학적 손목 회전/전신 에너지/자연스러움 점수는 아니다.** 후보의 거두기 상대 축속도는 세이버15.02·청강검28.77rad/s까지 남았고 세이버 탭 평균 겨눔 오차는 .103→.110rad로 늘었다.

실제 접촉·부상 뒤 탭에서도 입력 전 전체 prefix는 세이버845/청강검803프레임 exact, 탭4/4 수락했다. 이전844/802는0부터 센 마지막 tick을 개수로 잘못 표기한 값이다. 원자료와 exact 비교는 보존하고 집계만 정정했다. 첫 .75초 상대 각속도 적분은 세이버5.113→2.192, 청강검6.019→5.190rad였다. 그러나 **청강검 첫 후속 베기8.05초 접촉에서 postPhysics −42.61, 기존 clash 처리 뒤 −40rad/s로 급회전**했다. 후보의 후속 베기 최대축속도3.99→40, 평균 겨눔 오차.120→.152rad로 증가했다. 청강검은 공개 보류하고 URL 후보 활성도 차단했다.

세이버는 같은 상대팔 부상 뒤 찌르기/거두기 회전이 줄고 발사·관절 이탈은 관측하지 않았다. 이후 몸 자세·피해는 분기했고 후속 베기 평균 겨눔 오차.307→.452rad, 최대 손 목표 오차.198→.349m로 늘었다. **세이버만 선택형 비교로 전달하며 개선 완료로 선언하지 않는다.** AI 기립 상태 차이를 사람 회복이나 승률 근거로 쓰지 않는다. 이 접촉 회차의 두 무기 주팔은 온전했으므로 실제 검 든 팔의 부상 검증은 미완료다. 생성부터 후보를 켠 긴 전투에서 별도 청강검 접촉 급회전55.09rad/s도 남았다.

헤드리스20실행은4프로토콜×2무기×2모드의16조건과 통합 replay4다. 동일 replay를 독립 효능 표본으로 세지 않는다. 기존 공개 화면2·통합 로컬4는 입력/영상 근거다. 초기 FFmpeg 준비 실패와 잘못 연결한 메뉴 world 관찰0프레임은 제외했다. 원자료/재현 도구는 보존하고 이후 수치 정정은 물리 재실행 없이 파생했다.

[폰 비교판](https://yoonjl-svg.github.io/halfsword-codex/feature-lab.html#thrust-edge-comparison): **세이버 A/B**, 검술 보정 끔/한손 팔 B/상대 보통. 올려 베고 손을 뗀 뒤 오른쪽을 짧게 톡 쳐서 찌른다. 확인할 질문은 하나다: **찌를 때 덜 흔들리면서 겨누기와 검 거두기는 나빠지지 않는가?** 실제 폰 사용자 수락은 미완료다. 손 외형·일반판 기본값은 유지한다. 플레이어의 세이버/수동 팔/정확한 `thrustEdge=steady`에서만 활성화하고 상대·다른 무기·재시작 fallback은 기존 경로다.

재현은 새 출력 경로에서 실행한다. 아래는 저장 protocol/provenance로 구성한 명령이며 당시 실제 argv는 각 sidecar에 있다. 엔진/lockfile은 JSON 해시로 고정하고 과거 raw sourceBefore와 최종 공개 main의 무기 제한을 구분한다.

```sh
node tools/sim/experiments/onehand_thrust_probe.mjs --scenario=tap --observerRepeats=false --out=/tmp/NEW-thrust-tap.json
node tools/sim/experiments/onehand_thrust_probe.mjs --scenario=stroke --observerRepeats=false --out=/tmp/NEW-thrust-stroke.json
node tools/sim/experiments/onehand_thrust_probe.mjs --scenario=live --observerRepeats=false --out=/tmp/NEW-thrust-live.json
node tools/sim/experiments/onehand_thrust_probe.mjs --scenario=live --tapTiming=contact --observerRepeats=false --out=/tmp/NEW-thrust-contact.json
python tools/sim/experiments/onehand_thrust_metrics.py --raw=/tmp/NEW-thrust-tap.json --out=/tmp/NEW-thrust-metrics.json
PLAYWRIGHT_MODULE=/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs PLAYWRIGHT_BROWSERS_PATH=/workspace/cloud-onboarding/browser-binaries node tools/browser/onehand_thrust_screen.mjs --base=http://127.0.0.1:4295/ --weapons=sabre --out=/tmp/NEW-thrust-browser
```

외부 raw root는 JSON에 기록한 실제 수령 경로이며 현재 checkout만으로 영상/과거 raw까지 자동 제공되지는 않는다. 독립 감사는 같은 원자료의 정적 판정이며 물리 재실행이 아니다. 다음30–45분은 저장한 청강검 tick965의 접촉/기존 clash 각속도 설정을 분리한다. 같은 후보의 gain/seed 전수 탐색은 하지 않는다. 사용자 체감 대기 때문에 이 작업을 멈추지 않는다. 실행시간과 실제 전달은 영수증에 추가한다.

실제 첫 전달: 게임 `a10bfc53bda1eb297b68b57959ac2361a5af368a`, Pages 성공·현재 코드의 CI6 새 실행(캐시 재사용 없음)·공개8파일 exact·390px 계획/비교판·세이버 공개 A/B2판 trusted touch/탭/새 world 재시작을 확인했다. CI 물리 측정은 인간 동작 수락이 아니다. 마지막 폰 버튼 문구만 짧게 하고 영수증을 기록하며 게임 바이트는 유지한다. 시작05:46:42UTC→공개게임 검증06:16대UTC, 약30분; 최종 전달 시간은 외부 영수증에 분리한다.
