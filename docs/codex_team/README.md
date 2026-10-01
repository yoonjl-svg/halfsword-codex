# 혼합안 독립 개발 인계

이 문서는 이번 작업에서 새로 작성한 인계서다. 최초 첨부 패치와 원래 `AGENTS.md`/팀 README는 확보하지 못했다.

## 목표와 기준

- 총괄은 **조율자이자 에이스**: 효율적인 분업, 비용 관리, 결과 검증·통합, 어려운 핵심 문제의 직접 해결을 책임진다.
- 게임의 현재 목적은 손으로 검을 조작하며 거리·무게·힘·허점을 읽는 긴장된 결투다. 사용자 플레이가 자연스러움의 최종 판단이다.
- 독립 기준은 `14bcf1fe6bd205c775db91aa4ca36b9841b6d2bd`, 작업 가지는 `codex/hybrid-support`다.
- 원본 저장소는 수정하지 않는다. 원격은 `https://github.com/yoonjl-svg/halfsword-codex.git`다. 생성은 승인됐지만 현재 GitHub 연결이 생성 요청을 HTTP 403으로 거절한다. 로컬 커밋과 원격 게시를 구분한다.
- 최신 원본 `/support/`와 `/corr/`의 빌드 산출물은 조사했으나 해당 탐색 소스 커밋은 확보하지 못했다. 이번 소스 빌드는 본판 검술 보정 기준이며 corr v2 5차 통합판이 아니다.

## 현재 작업

사용자는 반사를 완전히 끄면 다리가 흐물거리고 **무릎을 꿇었다가 일어나기 어렵다**, 기본 받침도 0보다 조금 있는 편이 자연스럽다고 보고했다. 확인된 결함을 고친 뒤 동일 코드에서 지원 조합을 비교하는 혼합안을 승인했다.

- `7da5f3f`: 기울기 계산의 임시 벡터가 보행 전방 벡터를 덮던 결함 수정.
- `d36d66d`: 반사 방식·강도 조절, 선택적 실제 받침 힘 관찰, 비교 화면과 기립 검사.
- 후속 도구는 부상·동시 손 입력의 무릎 기립, 기립 보조 종료 뒤 관찰, 부상에 따른 의도된 자세 낮춤을 구분한다.
- 결과와 잠정 후보는 `docs/strike/hybrid_support_round1.md`를 본다. 세부 운영 기록·원문 연구 인계는 작업공간의 저장소 밖에 보관한다.
- 사용자가 추가로 지적한 것은 **기립 중 옆으로 흐느적거림과 검의 중력·관성 체감 부족**이다. `docs/strike/knee_gravity_diagnosis.md`에 별도 계측과 구조상 한계를 기록했다. 후보 A는 해결값으로 확정하지 않았다. 실제 사용자 최신 빌드의 같은 장면은 아직 재현하지 못했다.
- 사용자에게 당시 상황의 추가 특정을 요구하지 않고 전투 중 부상·옆 충격 자동 시험으로 넓힌다. 반복 검사는 [헤드리스 실행 원칙](headless_workflow.md)을 따른다. 작업 시작에 예상 시간을 알리며, 답변이 없어도 독립 가능한 개발을 계속하고 메이저 변경의 본판 반영은 사용자 컨펌을 받는다.

## 실행과 검증

```sh
npm ci
npm run dev
# /support-lab.html 에서 비교 후보를 연다.
node tools/sim/balance_axes.test.mjs
node tools/sim/catch_response.test.mjs
node tools/sim/support_options.test.mjs
node tools/sim/support_probe.mjs --assist=0.2 --catch=on --scale=0.5 --seeds=7 --out=/tmp/support-candidate.json
node tools/sim/gravity_probe.mjs /tmp/gravity.json
node tools/sim/knee_lateral_probe.mjs --candidates=baseline,mixed,off --conditions=healthy,hurt --seeds=7 --out=/tmp/lateral.json > /tmp/lateral.stdout.log
npm run build
```

- `?supportProbe=1&assist=0.2&catch=on&catchScale=0.5`는 이번 접속에서만 적용된다. 일반 접속의 비교 기준값은 받침 0.3·반사 on·강도 1이다.
- `catch=fall`은 균형 이탈만으로 반사를 요청한다는 뜻이다. 실제 쓰러짐 상태를 검사하는 옵션은 아니다.
- 반사 off에서도 기립 직후 넘겨받기 `levH`, 높이 스프링·감쇠와 균형 걸음은 남는다. 강도를 낮추거나 끄면 이전 `levC`가 새 설정보다 크게 남지 않게 한다.
- `balanceProbe`의 적용 힘과 적용 전 요구 성분을 구분한다. 이 계측은 전체 외력·관절 총토크 장부가 아니다.
- `ok`는 명시된 관찰 조건을 충족했다는 뜻이다. 인간 동작에 가장 가깝다거나 사용자 체감 문제를 해결했다는 뜻이 아니다.
- 동일 궤적의 중복 시드를 독립 표본으로 세지 않는다. 원문 연구 결과를 근거 없는 관절 한도·반사 이득으로 복사하지 않는다.
