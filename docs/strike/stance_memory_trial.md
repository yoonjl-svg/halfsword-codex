# 기립 마찰 기록 수정 · 선택형 실제 게임 연결

2026-10-02 21:02 KST. **구현과 로컬 검증 완료, 공개 배포 미완료.** 소스 커밋은 `232e772fd5e4873fe0410d184832a36d3add1cac`다. 일반판 기본값은 그대로 `legacy`이며 사용자 체감 수락이나 메이저 일반 적용을 선언하지 않는다. [전달 상태와 감사](stance_memory_trial_release.json).

## 바뀐 동작

기존 서기에서 기록한 발 마찰 하중 peak Nf가 down/getup 동안 갱신되지 않은 채 다음 서기로 넘어왔다. 새 옵션 `stanceTrial=fresh`는 **legacy 지지의 Gait.enter에서 양발 Nf만0**으로 초기화한다. 실제 접촉 하중 N, 질량·위치·속도, 발 plant, 근력·반사 gain을 직접 바꾸지 않는다. 이후 pinFeet가 현재 접촉에서 하중을 다시 계산한다.

`src/stance_memory.js`의 작은 helper를 실제 `src/gait.js`에서 호출한다. `src/stance_trial.js`는 정확한 URL 값만 선택하며 일반/잘못된 값은 legacy다. localStorage에 남기지 않는다. 양쪽 검객에 적용하고 재시작에도 같은 URL 설정을 쓴다. 철회한 axial 지지 경로는 열지 않았다.

비교 화면의 새 `#stance-comparison`은 A=`stanceTrial=legacy`, B=`stanceTrial=fresh`, 같은 longsword/longsword·assist.1·catch on/1이다. 팔/절삭 후보를 동시에 켜지 않는다. 새 페이지는 아직 로컬에만 있으므로 이 앵커를 공개 완료 링크로 안내하지 않는다.

## 검증과 판단

- [격리 연구24행](recovery_contact_memory_round10.md): legacy 건강/부상×무외란/좌/우 6조건에서 최대 발 미끄럼 감소. 부상 무외란4.319→.893m/s. K 증가와 일부 미세 gap 후퇴도 기록했다. projected 부상 재넘어짐3회는 그대로라 해당 연구판은 계속 철회 상태다.
- [실제 전투8행](stance_memory_combat_round1.md): 실제 상처·회복을 관찰했다. 회복 이후 AI/접촉/생존 상황이 달라졌고 회전 peak·손 목표 오차는 혼합 결과다. 같은 입력의 회복 효능이나 전투 전반 개선으로 해석하지 않는다.
- [실제 runtime6행](stance_memory_runtime_metrics.json): 건강/부상 무외란×baseline/관찰/fresh이며 격리 연구의 해당 물리·제어 trace와 모두 exact다. 연구 helper를 중복 주입하지 않고 production Gait.enter를 실행했다. 이전6조건 선별과 다른 분모이며 새 독립 효능 표본으로 더하지 않는다.
- [로컬 모바일4조건](stance_memory_mobile_round1.md): 세로/가로×A/B, 링크→실제 게임 시작·터치·회전 안내·재시작·일반/오타 복귀·설정 미지속 통과. fresh 진입 직후 양발 Nf0, 이후 실제 접촉에서 양의 하중 재계산을 관찰했다. 실제 폰이나 공개 사이트의 새 후보 검증은 아니다.
- `npm run build` 통과. Vite8.3.1,69modules, 기존 큰 chunk 경고는 남아 있다. 독립 감사는 새 옵션/기본값/지지 조건과 runtime 증거에서 차단 결함을 찾지 않았다.

이 증거는 작은 접촉 기록 수명 수정의 선택형 비교를 지지한다. 전체 기립·지면 반력·전신 강타·자연스러움의 완성 근거가 아니다. 사용자 비교에서는 부상 후 다시 설 때 발이 옆으로 튀는지, 몸이 버티거나 주저앉는 과정이 자연스러운지를 본다.

## 전송이 막힌 단계와 재개

이번에는 이전에 정상 동작했던 GitHub API가 `401 Bad credentials`를 반환했다. 기존 HTTPS 경로의 git ls-remote도 비대화형 사용자명 인증 실패로 종료했다. Git push는 실행하지 않았다. 환경 설정 초안에 GH_TOKEN 요구사항을 저장하려 했으나 `INVALID_ARGUMENT`의 초안/요구사항 충돌로 실패했고 재조회에서도 저장되지 않았다. 새 자격 증명이나 예약 개발이 설정됐다고 하지 않는다.

기존 공개 feature-lab은200이고 팔·절삭 영역이 있으나 새 stance 영역은 없다. 소스/연구·검증 기록은 로컬 커밋하고 저장소 밖 복구 bundle로 보존한다. 로컬 복구본은 외부 백업을 뜻하지 않는다. 환경 설정에서 **독립 저장소용 GitHub 인증을 복구**한 뒤 [전송 절차](../codex_team/github_delivery.md)로 API 점검→Actions 전송→원격 트리/배포→공개 모바일 검증을 수행한다. 토큰 값을 채팅에 요구하지 않는다.

새 공개 기립 링크를 기다리는 동안 기존 [팔·절삭 비교](../codex_team/PLAYTEST_STAGES.md)는 평가할 수 있고, follow 입력 끝점과 전신 힘 전달 연구도 독립적으로 진행할 수 있다.

## 재현

```sh
node tools/sim/experiments/stance_memory_runtime_probe.mjs --support=legacy --pulse=none --out=/tmp/stance-memory-runtime-new.json
npm run build
```

runtime 원자료는 `/workspace/halfsword-hybrid-evidence/stance-memory-runtime-r1.json`, 브라우저 실행 명령과 원자료 식별자는 모바일 보고서에 있다. 재실행은 새 출력 경로로 수행하며 source/HEAD를 배치 중 동결한다.
