# 한손 그립 자세 이식 — 2026-10-02

사용자 요청: “그리고 한손무기 그립이 지금 이상하거든. 이 문제를 해결한 우화의 패치내역이 있울거야. 그거 그대로 가져와.”

## 출처와 적용 범위

기준은 우리 `5f806a1944f3da16d3edf8b42262f3d852969f2a`다. 이번 명시적 패치 조회·이식 요청에 한해 정기 열람 창 밖에서 관련 커밋과 해당 파일을 읽었다. 일반적인 상대 접촉 시간은 확대하지 않았고, 상대 저장소 쓰기·게임 플레이·즉시 연락은 하지 않았다.

- 우화 [`f53b330`](https://github.com/yoonjl-svg/halfsword/commit/f53b330e80e90254c90e265861fa70ef38a10af4)의 THRUST/SABRE 한손 자세표와 선택 함수를 가져왔다. 기존의 한손 예외 4개를 14개 자세 전체의 전용 표로 바꾼다. `src/guards.js` 전체가 이 원본과 바이트 단위로 같고 SHA256은 `0574da4595093bbeb96eb778a3c05ee12e04a952c5467868e0fdc15599e08e9d`다.
- [`9763484`](https://github.com/yoonjl-svg/halfsword/commit/976348469615f2acff9770660d1c754f4ce237df)의 Fighter 생성자 선택 규칙 중 **한손 부분만** 연결했다. `classifyStyle`의 thrust/versatile은 THRUST, 나머지는 SABRE이며 플레이어와 AI가 같은 경로를 쓴다. 수치를 임의 조정하지 않았다. 같은 커밋의 두손 에스토크 변경은 이식 범위에서 제외했다.
- 별도 [`27d26b6`](https://github.com/yoonjl-svg/halfsword/commit/27d26b682d84c1b8eff56ea29e1ae8a389294a4f)는 corr v2의 복귀/옆 입력 매핑 수정이다. 우리 본판에는 그 제어 체계가 없어 이식하지 않았다. 손 안의 역회전 문제 전부를 해결했다고 주장하지 않는다.

활성 본판의 자세표를 바꾸는 수정이다. 원본의 오프라인 동작 클립/생성 도구는 가져오지 않았다. 별도 motion library를 수동 활성화하면 그 도구가 표를 덮어쓰므로 해당 경로는 이번 검증 범위 밖이다. 문헌을 참고한 저작 자세값이며 새 근육·손가락·관절 모델이나 인체 실측치가 아니다. 기존 paired 그립과 legacy 지지, 지지 연구판 철회는 유지한다.

## 검증

[측정 원문 요약과 해시](onehand_grip_port_metrics.json). 실제 Fighter/Skill/native physics를 사용했으며 별도 근사 물리 모형이 아니다.

```sh
# 기준 커밋에서 같은 도구로 before.json을 먼저 생성한다.
node tools/sim/onehand_guard_probe.mjs --out=/tmp/onehand-before.json
# 적용 뒤
node tools/sim/onehand_guard_probe.mjs --compare=/tmp/onehand-before.json --out=/tmp/onehand-after.json
node tools/sim/grip_reaction.test.mjs
npm run build
```

설정은 seed7, B(.1/on/1), paired/legacy, 건강한 정지 상태 3초 준비 후 잡기→드래그→놓기→다시 잡기 8초다. sabre, rapier, tree_branch, falchion, qinggang, pistol, rubber_chicken, morgenstern, longsword, zweihander, estoc 총 11종이 각 960프레임 통과했다. 모든 입력 기록이 전후 일치했고, 두손 3종은 준비 상태와 전체 물리 궤적 해시까지 정확히 일치했다. 측정 중 소스 변경 없음. 전/후 wall7.599/7.500초. 한손의 최대 손목/그립 앵커 간격은 0.134mm였다. 자연스러움 합격 문턱으로 사용하지 않는다.

추가 native smoke: pistol 실제 Skill.thrust 6회로 6발 발사·탄약 소모·유한 상태 확인(명중률 미검증). sabre/rapier 대 longsword의 실제 양측 AI 결투는 각 20초/2,400프레임, 충돌44/99회·상처20/19건, 최대 관절 간격2.525/2.999mm였다. down 진입이 없어 누운 기립 검증으로 세지 않는다. 기존 그립/철회 테스트 12개와 빌드 통과.

로컬 모바일 브라우저는 세이버·레이피어·나뭇가지에서 실제 Start·터치·옆 드래그·해제·재입력을 수행했다. 동일 손 입력(.52/.03), 이동 입력0, 세 구간 held=true/false/true, JS 오류0, legacy 지지를 확인했다. 세이버/나뭇가지는 SABRE, 레이피어는 THRUST 표가 활성화되고 화면의 팔/칼 방향이 달라졌다. 이미지와 입력 계측은 실제 브라우저 결과이며 사람의 체감 승인을 대신하지 않는다.

## 배포

소스 검증 완료. 공개 배포 SHA·Actions·최종 모바일 확인은 완료 후 아래에 기록한다.
