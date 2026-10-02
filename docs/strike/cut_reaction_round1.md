# 절삭 반작용 1차: 공통 작용점과 소모 에너지

2026-10-02. [P-05](physical_realism_plan.md)의 절삭 경로만 다룬다. 기존 `Combat.afterStep`는 칼에 −J, 상대에 +0.8J를 서로 다른 점에 적용하고 예산에서 요청량 J×상대속도를 뺀다. **순간 선·각운동량과 실제 소모 에너지에 맞춘 후보**를 구현했다. 손상 모델·튕김·native 충돌·기립·전신 에너지의 완성은 별개다. 일반 게임 기본값은 legacy다.

## 왜 크기만 같게 바꾸면 안 되는가

같은 점의 ±J는 순간 선·각운동량을 보존하지만, 관성에 비해 너무 큰 J는 상대 운동을 역전시켜 운동에너지를 만들 수 있다. 실제 native 강체의 방향별 역질량과 월드 역관성으로 접촉점 응답을 계산한다.

`a = Σ[nᵀ M⁻¹ n + (r×n)ᵀ I⁻¹(r×n)]`, `s = (v_weapon(point) − v_victim(point))·n`.

여기서 n은 접촉 법선이 아니라 순간 상대 운동 방향이다. 양쪽에 같은 world point에서 `J = min(J_requested, s/a)`를 적용하면 이 경로의 순간 운동에너지 변화는 `ΔK = −J s + ½aJ² ≤ 0`이며 그 방향의 상대속도를 역전시키지 않는다. 임의 관성 바닥값이나 추가 팔 질량으로 이 상한을 정하지 않는다. axis lock 등이 있는 강체의 운동량은 지지와 교환될 수 있으므로 보존 fixture는 자유 dynamic 강체를 사용한다.

낮은 검 축 관성 fixture에서 공통점에 무제한 J=1N·s를 넣으면 약 +1796.31J를 만들었다. native 응답에서 얻은 약 0.00173945N·s 상한은 약 −0.00545437J였다. ‘작용·반작용 크기만 맞춤’으로는 충분하지 않은 반례다.

## 예산과 박힘 전이

첫 `candidate` 모드는 impulse만 교정하고 기존 J×s 차감을 남겨 원인을 분리했다. 이것은 출시 후보가 아니다. `budgeted` 모드는 실제 pair 손실 `max(0, −ΔK)`만 `Eleft`에서 뺀다. 기존 요청 규칙이 J×s≤Eleft를 보장하므로 추가 피해 배율이나 새로운 에너지 상한이 필요하지 않다.

100J 예산 fixture에서 차감 0.873882294J, actual pair 감소 0.873881859J로 Float32 허용오차 안에서 일치했다. 요청량으로 차감하던 방식과 차이가 있다. 잔량이 기존 1e−3J 문턱 아래로 내려가면 작은 잔량은 보존하면서 `cutBudgetDone`으로 drag 단계를 끝낸다. 이 표시가 없었던 중간 후보는 작은 양의 잔량 때문에 다음 스텝에서도 drag에 들어가 박힘 타이머를 다시 설정할 수 있어 수정했다.

native 3스텝 fixture에서 잔량 약 6.44×10⁻⁷J 유지, 타이머 0.25→0.241667→0.233333초를 확인했다. 같은 cut 객체의 재접촉은 완료 표시를 유지하고, 삭제 뒤 새 cut 객체는 새 예산으로 시작한다. 이 수명 fixture는 map 삭제·predict·strike 결과를 통제했으며 자연 전투의 모든 이탈/재충돌 조합을 검증했다는 뜻이 아니다.

## 검증 범위

32개의 fixture는 실제 Rapier 몸체와 실제 `Combat.afterStep` 복제에 연결한다. world 회전/평행이동, 무거운 검/가벼운 상대와 반대, 작은 축 관성, 0요청/0응답/반대 방향, drag/stuck/접촉 종료, 작은 예산 및 위 상태 전이를 포함한다. 원본과 미변경 clone의 실제 결과도 대조한다.

fixture의 `sourceStable`은 **src/combat.js 한 파일**의 전후 일치다. helper와 test 해시는 통합 실험의 freeze manifest에 별도로 기록했으며 모든 파일의 전후 불변을 fixture 하나가 증명한다고 쓰지 않는다. 초기 타이머 검사의 JS 1/120과 native Float32 timestep 차이 약 4.35×10⁻¹⁰초는 원자료를 보존한 뒤 명시적 5×10⁻⁹초 허용오차로 교정했다.

실제 전투는 양쪽 모두 원래 AI를 사용하여 롱소드/츠바이핸더의 공격자 순서 2개 × seed 7/17 × original/clone/candidate/budgeted로 각 30초, 총 16행을 실행했다. native 준비·제어 시작·original/clone 전체 궤적과 입력이 일치했다. 후보는 물리 변화 뒤 AI 입력도 달라지므로 같은 입력의 인과 대조로 해석하지 않는다. 안정모드·부상 억제·상대 고정은 사용하지 않았다.

최종 budgeted 네 전투에서 순간 pair 최대 운동량 잔차는 약 1.16×10⁻⁶N·s, 각운동량 잔차 7.24×10⁻⁶N·m·s, 에너지 예측 오차 3.57×10⁻⁵J였다. 예산 음수·과다 차감·허용오차 밖 상대 운동 역전은 없었다. 상처 수는 기준 35/39/67/24 → 후보 18/37/32/33으로 서로 다르게 바뀌었다. 이를 피해 개선·밸런스 동등·자연스러움으로 판정하지 않는다.

초기 integration의 손↔검 gap 정의는 잘못되어 해석에서 제외했다. 교정 후에도 무기를 놓은 이후의 거리는 파지 관절 오차와 다르므로, 살아 있는 native grip joint의 anchor gap과 joint 없는 구간을 구분하여 한 차례 재계측했다. 최종 원자료·해시·그 범위의 판정은 [metrics](cut_reaction_round1_metrics.json)에 남긴다.

재계측한 16행은 계측 추가 전의 모든 물리/입력 궤적과 정확히 같았다. 4.765m/3.610m/1.125m의 큰 손–검 거리는 모두 `gripJoint`가 유효하지 않고 `armed=false`인 프레임이었다. 이를 파지 관절 붕괴로 해석하지 않는다. 후보의 유효 주손 관절 최대 anchor gap은 1.608mm, armed와 관절 유효성의 불일치 프레임은 0이었다. 무기를 놓은 시점과 기간도 남겼으며, 그 원인이 모두 바람직한 실제 부상 반응이라는 뜻은 아니다.

## 재현 및 활성 상태

```sh
node tools/sim/experiments/cut_reaction_candidate.test.mjs /tmp/cut-reaction-tests.json
node tools/sim/experiments/cut_reaction_integration_probe.mjs --seconds=30 --seeds=7,17 --out=/tmp/cut-reaction-integration.json
```

메타데이터의 기준 커밋·파일별 해시와 실제 호출 수를 확인한다. fixture의 작은 관문을 인간 수락 기준으로 바꾸지 않는다. 공개 비교를 연결하려면 순수 helper를 브라우저와 공유하고 기본 궤적 exact, 후보 실제 실행, 재시작/일반 URL 복귀, 모바일 입력·빌드를 추가로 검증해야 한다. 선택형 비교 공개와 일반 기본값 승격은 별도이며 후자는 사용자 확인을 따른다.

## 선택형 웹 통합 검증

연구 소스 `298cd69`를 고정한 뒤 순수 수학을 `src/cut_reaction.js`로 옮겨 실제 Combat과 연구 fixture가 공유한다. `cutTrial=budgeted`만 후보를 켜고, `cutTrial=legacy`·누락·오타는 기존 방식이다. 설정을 저장하지 않으며 매 판 새 Combat에 현재 페이지 옵션을 적용한다. 기존 상처 초기화 뒤의 절삭 저항만 바꾸고 일반 충돌·튕김 루프는 계속 실행한다.

[통합 metrics](cut_reaction_trial_metrics.json)에 다음 결과와 해시를 보존했다.

- 기존 32fixture와 실제 runtime↔변환 모듈의 drag/stuck/접촉 종료/3스텝 전이/새 cut deepEqual 묶음, 총 33검사 PASS.
- 원래 네 모드에 실제 runtime 모드를 더한 20×30초 양방향 AI 전투 PASS. runtime의 4전투 전체 물리/입력 궤적이 검증한 budgeted와 exact이며, 기존 연구16행도 native/제어 시작과 전체 물리/입력이 exact다. runtime의 실제 절삭쌍은 각각 106/197/349/281회였다. 같은 결과의 복제·회귀를 새로운 독립 전투 표본으로 세지 않는다.
- core/harness 7개 파일의 실행 전후 해시 일치. 이후 `main.js`·메뉴 연결은 모바일 검사로 별도 확인했다.
- build 성공, `assets/main-87Mueu1p.js` SHA256 `d533a3ccdedb31eef02bbab8cc90b4fb2936e2acfd9182d711342d334d489633`. 기존 큰 bundle 경고는 남는다.
- 로컬 모바일 390×844/844×390 × A/B 4조건 모두 통과했다. 실제 링크·싸움 시작·끌기/놓기/재입력·새 Combat 재시작·일반 및 오타 URL 복귀, 화면 넘침·sim 전진을 확인했다. JS/HTTP/요청 오류 0. 세로 플레이는 기존 가로 회전 안내를 따랐다. 입력 검사에서만 AI를 멈췄으며 절삭 물리·자연스러움·휴대폰 성능 합격으로 바꾸지 않는다.

재현 도구는 `tools/browser/cut_trial.mjs`다. **후속 사용자 자세 붕괴 보고로 B 추천 버튼을 제거했으므로 이 도구의 링크 검증은 당시 소스 전용이다. 현재 UI 검사로 쓰지 않는다.** Playwright는 기존 브라우저 도구처럼 저장소 설치 의존성이 아니며 `PLAYWRIGHT_MODULE`로 설치 경로, `PW_CHROMIUM`으로 실행 파일, `HALFSWORD_EVIDENCE_DIR/TAG`로 원자료 위치를 정할 수 있다. HTTPS는 세션 proxy와 TLS 검증을 유지한다. 공개 배포의 실제 주소/바이트/동작 확인은 전달 기록으로 따로 남긴다.

**공개 검증 완료:** 소스 `3ad893a` → main `7362025`, 전송 `36961428526`·Pages `36961476733` 성공. [A/B 모바일 비교](https://yoonjl-svg.github.io/halfsword-codex/feature-lab.html#cut-comparison)의 index·비교 HTML·실제 asset SHA가 로컬 build와 같다. 공개 주소에서도 동일 모바일4조건·새 Combat 재시작·일반/오타 legacy 복귀가 모두 통과했고 JS/HTTP/요청 오류 0이었다. [전달·공개 검증 기록](cut_reaction_trial_release.json)을 본다. 검증 환경의 읽기 전용 인증서 저장소 문제로 첫 두 시도는 페이지 로드 전에 실패했으며, 승인된 브라우저 실행 환경에서 정상 CA 신뢰 접근으로 재검증했다. TLS 검증을 우회하지 않았고 이 과정의 게임 소스 변경은 없다.
