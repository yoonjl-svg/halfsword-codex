# 새 라운드 목표 보정 분리 후보

작성: 2026-10-03 KST. 기준 `c810e06d09365687e101d146f9610fc8748385b3` + 미커밋 선택형 연결. 사용자 승인 범위는 보정 간섭·팔꿈치 협응 개발이다. 이 후보는 입력·목표 보정의 분리이며 팔꿈치 수정안이나 일반판 승격이 아니다. **정상 라운드 전투·입력 계약을 확인한 뒤 로컬 A/B 버튼을 연결했다. 완성 빌드 모바일 검증 완료, 공개 웹은 아직 미배포다.**

## 동작 계약

`?targetCorrection=none|weak`를 새 라운드의 플레이어 생성 단계에서 적용한다. 첫 `Fighter.step()`과 첫 `world.step()` 이전에 아래 값이 들어간다. 런타임 중 보정 메뉴 전환은 허용하지 않으며 새 라운드·재로드에도 URL의 선택을 유지한다.

| 요청 | 플레이어 level | autoGuard | 범위 |
|---|---:|---|---|
| `none` | 0 | false | 목표 보정·자동 복귀 분리 |
| `weak` | .4 | true | 기존 약 보정·자동 복귀 |
| 없음·잘못된 값 | 저장값 | 기존 true | 일반 동작 유지 |
| 세로 비교와 동시 지정 | 기존 세로 비교의0 | 기존 세로 비교의true | 세로 비교 우선, 보정 후보는 비활성·안내 표시 |

none은 수동 입력·anchor·목표 필터·관성·근력·관절 한도나 명시적 탭 찌르기를 없애지 않는다. 전역 `SKILL.followGain` 등을 변경하지 않는다. 새 라운드가 기존 follow/복귀 이력을 이어받지 않으므로 진행 중인 라운드의 level만 바꾼 연구와 구별된다. 짧은 칼의 `enterParry`(막은 뒤 내딛기)는 level0에서도 남으며 메뉴에 이를 간단히 표시한다.

상대의 검술 보정과 전역 follow 설정은 변경하지 않는다. **기본 상대의 난이도는 두 조건 모두 이번 접속에서 normal로 고정한다.** 저장된 hard/easy 선호는 보존하므로 기존 저장값 hard에서 들어가면 실제 상대 난이도는 이번 접속에서 normal로 달라진다. 이를 상대 행동·난이도의 완전 불변으로 부르지 않는다. 이름/스테이지로 고른 상대는 고유 난이도·성격을 유지한다. 같은 설정이 같은 무작위 성격이나 결투 궤적을 보장하지 않는다.

일반 게임의 기본값과 저장 설정은 유지한다. `comparisonSettings`는 표시·생성에만 쓰며 `settings`나 localStorage에 비교값을 저장하지 않는다. 보정/난이도 버튼을 고정하고 다른 설정을 저장해도 원래0.7/hard가 남는다. 일반 URL로 돌아가면 저장값을 다시 사용한다.

## 구현과 노출

- `src/target_correction_trial.js`: 엄격한 URL 파싱, 새 플레이어에만 적용, 메뉴 상태 안내.
- `src/main.js`: 세션 표시값·새 라운드 초기화·메뉴·debug에 최소 연결. 물리 core/엔진은 수정하지 않았다.
- `public/feature-lab.html`: 한손 sabre/큰 양손 zweihander 각각 A·약 보정/B·보정 끔4링크를 추가했다. 무기별 A/B는 `targetCorrection`만 다르다. 보정 간섭 비교·팔꿈치/전신 물리 완성판 아님·일반 미승격을 표시했다. 처음에는 안내만 뒀으나 디렉터의 정상 종료 계약 전투8회+관찰 대조 통과 후 로컬 버튼을 연결했다. 공개 웹 배포 완료를 뜻하지 않는다.

기술 검증은 sabre/zweihander, 상대 longsword·기본 상대normal, 팔/절삭legacy, paired 그립, legacy 지지 .3/on/1, 입력 배율1로 고정했다. none/weak 사이의 URL 차이는 `targetCorrection`뿐이다. `inputComparison=vertical` 동시 요청은 기존 세로 비교 계약을 그대로 우선한다. 팔꿈치 후보는 이 옵션에 연결하지 않았다.

## 로컬 검증

`tools/browser/target_correction_probe.mjs` 최초 단일 실행으로 **4무기/모드 + 세로 충돌 + 일반 설정 복귀 PASS**를 얻었다. 기존 browser/Playwright/Chrome을 재사용했다. 이후 승인된 버튼/설명 변경과 build72모듈·완성 빌드2조건을 추가 검증했다. 서버 시작/재시작·커밋·원격 전송은 하지 않았다.

1. 390×844 세로 메뉴·비교 안내와844×390 가로 메뉴에서 가로 넘침이 없다. 최초 검사 시 링크0개였으며, 최종 완성 빌드에서는4개 실제 링크와 무기별 A/B의 동일 조건을 확인했다.
2. sabre/zwei 각각 none/weak로 시작한 첫 제어 스텝과 첫 물리 스텝의 level/autoGuard·상대normal/.7이 일치한다.
3. 일시정지→처음부터 다시 만든 새 라운드와 페이지 재로드에서도 첫 스텝 설정이 유지된다. 실제 클래스 prototype의 원래 메서드를 한 번 호출하는 관찰 wrapper와 새 객체 WeakSet을 써서 새 세계/플레이어를 관찰했다. 제어값·반환값을 바꾸지 않는다.
4. Chrome native 터치 탭은 명시적 찌르기1회, 드래그·놓기·재입력은 추가 찌르기0회다. 이는 `Skill.thrust()`의 찌르기 명령 횟수이며 드래그 이동량이0이라는 뜻이 아니다. 손가락 held/해제·손 목표 변화·실제 world 진행과 강체 유한 상태를 확인했다. 상대 AI는 중단하지 않았다.
5. 저장된0.7/hard로 진입해 비교 UI/생성값만0 또는.4/normal로 고정된다. trail 설정을 저장한 뒤에도0.7/hard가 유지된다. 일반 접속은0.7/hard와 활성 메뉴로 돌아간다.
6. `targetCorrection=weak&inputComparison=vertical`는 후보 비활성·우선 안내·기존 level0/autoGuardtrue를 첫 스텝에서 확인했다.

순수 Node 파싱/적용 검사도 none/weak, 잘못된 여섯 값, 두 모드의 세로 충돌, 비활성 시 플레이어 무변경을 통과했다. 문법 검사·`git diff --check`가 통과했다. 브라우저 pageerror/HTTP 실패0이며 측정 전/후6런타임 파일의 SHA가 같다.

원자료: [target_correction_trial.json](target_correction_trial.json), 통합 SHA256 `e182faf2b04a31fbfd20a2b359f8785d11528068ac3db206fd6875dbb538240e`. `development`는 UTC16:16:36.413→16:18:07.775, **91.362초**의 최초4+2조건 결과다. `production`은 완성 빌드 실제 sabre none/weak 링크2조건의 **37.508초** 결과다. 소스 SHA·메뉴/입력/첫 스텝·새 라운드/재로드·충돌/복귀를 보존했다. 두 브라우저 실행 모두 첫 시도에 통과했고 각 실행의 런타임 소스는 stable이다. 전체 설계·동결 대기·구현의 벽시계는 별도 정밀 기록하지 않았다.

최종 UI/버튼 변경 전후 파싱·적용12조건과 실행 함수 `toString()`의 SHA가 exact다. 상태 SHA `71e1b5b00d3b15d066639577387e35dc6b7f0b4aba409ad4eb94a3f2497d916b`, 함수 SHA `24ef08fe0102a94b87711f4fd9d3e9d1028d0aed90d928c1129ebab6ebd2b92c`다. 실제 제어 함수는 바꾸지 않아 이전4조건·충돌/복귀 근거를 재사용했다. 완성 빌드에서는 두 실제 링크의 최초 제어/solver 스텝, native 탭·드래그·재입력, 새 라운드·재로드를 확인했다. 다른 설정 저장 뒤 선호0.7/hard도 유지된다.

최종 `npm run build`는72모듈 PASS이며 `/assets/main-BNU7lcsR.js`다. 디렉터가 갱신한 계획 페이지를 마지막 빌드에 포함해 `public/development-plan.html`↔`dist/development-plan.html`, feature-lab 두 파일의 바이트 일치도 확인했다. 메이저 일반 승격·공개 Pages 전달 검증은 이 빌드 결과와 구분한다.

재현 명령:

```sh
node --check src/target_correction_trial.js
node --check src/main.js
node tools/browser/target_correction_probe.mjs http://127.0.0.1:4201/
TARGET_CORRECTION_PHASE=production-min TARGET_CORRECTION_OUT=/tmp/target-correction-production.json node tools/browser/target_correction_probe.mjs http://127.0.0.1:4202/
```

아래는 로컬 재현용 URL 구성 예시다. 현재 로컬 feature-lab의4버튼과 같은 설정이며 공개 배포 URL이 아니다.

```text
http://127.0.0.1:4201/?weapon=sabre&foeWeapon=longsword&foe=default&supportProbe=1&assist=.3&catch=on&catchScale=1&armTrial=legacy&cutTrial=legacy&targetCorrection=none
# targetCorrection=weak 또는 weapon=zweihander로 같은 설정을 비교
```

## 남은 판단

이 검사는 옵션·새 라운드·입력·저장 선호 계약이다. 장시간 전투 자세, 팔 gap/회전, 사용자 손가락 체감의 수락을 대신하지 않는다. 선행 headless 연구의 팔 벌어짐 반례는 상대 사망 뒤 계속 탭을 준 stress에서 관측됐다. 실제 main은 판끝3.5초 뒤 일시정지하므로 그 늦은 입력 시점은 정상 라운드에서 도달하지 않는다. 반례 자체와 실제 게임 종료 계약 아래의 위험 범위를 구분하며 정상 전투 폭주로 확정하지 않는다.

디렉터의 [실제 종료 계약 전투 회귀](skill_manual_combat_round1.md)8회+관찰 대조는 통과했다. 이전 zwei19 off의15.666초 stress 입력은 정상 main의 실제4.5초/physics2.74초 일시정지 범위 밖이었다. 정상 창에서 해당 player 최대 gap3.094mm를 확인했으며 이것으로 장시간/전신 품질을 완결하지 않는다. 이 근거로 로컬 비교 버튼 추가를 허용했다. 공개 전달은 인증/배포 결과 확인 뒤 별도 처리하며, 팔꿈치 조합 후보는 계속 미채택이다.
