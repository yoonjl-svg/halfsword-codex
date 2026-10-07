# 3회차 공개 폰 통합 경계 · 2026-10-07

현재 일반판에서 **자연 절상 뒤 손을 누른 채 중단 → 계속하기 → 새 손 입력 → 새 판 초기화와 새 입력**을 확인했다. 상처를 넣거나 AI를 멈추지 않은 공개 전투1회와 재시작 뒤0.8917초의 최소 입력만 실행했다. 게임 변경은 없다.

기준은 `ede1807c9b4bb45f8309f00a3b748e9b2aecdcb0`, 공개 `main-CxbuHD3X.js`다. 일반 롱소드 대 하인리히/롱소드, 원래 normal 캐릭터 AI, v2·수동 팔·fresh·bounded·플레이어 centerline·팔다리 절단 ON·중력9.81·일반 마무리`legacy`를 유지했다. 새 상처의 표시 전수 검사는 반복하지 않고, 게임 소스와 컴파일 자산의 동일 해시를 확인해 [2회차 실제 상처/렌더 자료](phase3_damage_visual_20261007.md)를 재사용했다.

## 노출과 실제 판정

| 관문 | 실제 근거 | 판정 |
|---|---|---|
| 자연 플레이어 부상 | 4.5500초 복부cut120.0498J/심각도0.842241, 4.5583초 골반cut56.3746J/심각도0.163352. 원래 `applyWound`가 상처2개 저장 | 노출·확인 |
| 손을 누른 채 pause | 실제 손 터치를 유지하고 두 번째 손가락으로 중단. 5.6583초에서 입력델타·터치·press·tap·키·조이스틱 정리,180ms 대기 동안 시계/몸/상처/제어 상태 동일 | 노출·확인 |
| resume | 상처2개·혈액0.970606과 기존 Fighter/World/Combat/AI/controller6객체 유지, 입력 활성 복구 | 노출·확인 |
| 부상 뒤 새 입력 | getup 중 새 touch3이동의 delta각(.08,.09) 수신·소비. 손 입력 목표(.249137,−.173369)→(.482525,.106897). 자동복귀 생성0, 소유권`recovery` 유지 | 회복 중 입력 전달 확인 |
| restart | 기존6객체 모두 새 identity. 첫 플레이어 물리 step 직전 양쪽 wound0/blood1/bleed0/pain0/consciousness1·사지1·분리0. tap/finish/명중cooldown/이전aim·제어 의도·시작 전 발 기억 초기화 | 노출·확인 |
| 새 판 입력 | native delta3회 소비, 소유권`player`. 새 판0.8917초 만에 중단, 추가 부상·전투 반복 없음 | 노출·확인 |
| 설정·공개 일치 | 저장 설정 바이트 불변, 공개8파일 크기/SHA exact, 최종 오류0·비유한 물리 상태0 | 확인 |

복부/골반 절상 뒤 플레이어는 `getup`이었고, 중단·계속하기 후 입력에서도 검술 보정의 `phase=suspended`, `owner=recovery`, `eligible=false`를 유지했다. 새 입력은 실제로 소비되고 손 목표가 바뀌었으나, 이를 **완전 기립·회복 후 능동 타격 성공·회복 중 보정 재활성**으로 확대하지 않는다. 이 경계에서는 회복의 제어 소유권을 빼앗지 않고 입력을 이어 받는 것이 관측 결과다.

재시작에서는 생성 전후 identity를 직접 비교했다. 첫 step 직전 controller는 이미 준비 계산으로 `seeded=true`지만 `goalTick=0`, `hasIntent=false`, `lastMotionTimeS=null`, 복귀 속도/생성 delta0이었다. gait의 `started=false`, 두 발`Nf`는 아직 없었다. 첫 step 뒤 정상적으로 채워지는 발 기억이나 계속 증가하는 전역 입력 batch ID를 초기화 실패로 보지 않는다. `stats.simTime`도 페이지 누적 시계이며 새 Fighter의 `fightT`만0부터 시작한다.

bounded roll 이력은 Fighter를 키로 쓰는 비공개 WeakMap이다. 새 Fighter identity와 소스 계약으로 이전 항목을 공유하지 않음을 확인했으며 지도 내부를 직접 관측했다고 쓰지 않는다. 실제 사지 손실은 없었으므로 사지1·분리0은 새 판 기본값 확인이지 절단된 사지의 복원 장면 검증이 아니다.

## 실행 회계와 재현

**시도1 / 통과1 / 실패0 / 재실행0.** 최초 전투1회에서 계획한 최대5입력주기 중2주기만으로 자연 절상이 노출돼 다음 관문으로 넘어갔다. 이후 새 판은 입력 확인에 필요한 최소 구간만 실행했다. 총893물리step, 누적7.4417sim초, trusted touch56개, 원래 AI893호출/발 고정 해제 뒤 생존546호출, `applyWound`7호출이다. 12:20:37.869–12:21:43.494 UTC의65.625초는 네트워크/로딩/기록을 포함하며 폰 성능 측정이 아니다.

도구는 `tools/browser/phase3_closure_mobile_20261007.mjs`, 항목별 상태·시각·해시는 [JSON](phase3_closure_mobile_20261007.json)에 있다. 실제 실행 명령은 다음과 같다. 다시 실행하려면 출력 폴더를 새 경로로 바꿔야 하며, 난수·브라우저 스케줄 때문에 동일 접촉 결과를 보장하지 않는다.

```sh
PLAYWRIGHT_MODULE=/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs \
PLAYWRIGHT_BROWSERS_PATH=/workspace/cloud-onboarding/browser/cache \
node tools/browser/phase3_closure_mobile_20261007.mjs \
  --out=/workspace/halfsword-handoff/phase3-round3-20261007/browser/public01
```

원자료는 해당 외부 폴더의 `report.json`, `manifest-before.json`, `browser-tool-executed.mjs`, 중단/재시작PNG2개와 영상이다. 이전 renderer sampler 코드는 복사하지 않았으며 원래 게임 함수를 그대로 호출하는 필요한 상태 관찰자만 썼다. 상처·위치·속도·AI 주입, seed 탐색, 피 OFF·절단·실물 폰 성능·전체 UI 재검사는 하지 않았다. 실행 전후 HEAD/소스/빌드/도구 해시가 같고, 원래 프록시와 TLS 검증을 유지했다.
