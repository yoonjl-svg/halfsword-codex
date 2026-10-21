# 채찍 반복 사용: 자기 몸 감김 보완 · 2026-10-22 KST

사용자 실제 플레이 피드백: 한 번 휘두르면 몸에 감겨 다시 쓰기 어렵다. 소스749a7b36 / codex/druid-whip-20261021, 이전f902e298 위. 우리 포크 별도검토판만 갱신하며 우화 전달·쓰기 없음.

## 원인과 변경

humanLimits=true일 때 모든 무기에 붙는 자기 몸통·허벅지 충돌 비트를 채찍 마디가 그대로 상속했다. 마찰.65의8마디가 자기 몸에 걸렸다. 유연한 줄에 한해 owner torso bit만 제거, 단단한 손잡이와 상대 몸/상대 무기/바닥·장애물 충돌은 유지. 선수0/1 및 limits off/on4경우 마스크 검사 통과.

근원2마디의 굽힘 스프링+.08, 나머지+.025, 꺾임60도 이후 점진+.12×(.5−dot). 양쪽에 크기가 같고 방향이 반대인 토크만 사용. 순간이동·목표추적·끝 추가충격 없음.770g/끝마디122.35g/173cm/8관절/둔타1.5/파손불가 유지.

표준측정 재실행 후 채찍 AI 측정표 contact/reach.99→1.19m, clinch.76→.92m, raw cut.48→.45초 갱신. AI 기술/유파몸꼴/보법은 변경하지 않음. 인간 사거리나 명중률 보장 수치 아님.

## 반복 입력 비교

repeat.mjs: 기존/자기몸충돌해제만/해제+굽힘3군 × 가로·세로·대각3입력 ×8연속 휘두름. 처음을 제외한2~8번째 평균. 실제접촉은 contactPairsWith 후보 개수가 아니라 contactPair의 numSolverContacts로 확인했다. 초기 후보쌍 집계 오류는 수정 후 다시 실행했다.

|입력|최대 전방도달 기존→최종|접힌 시간 기존→최종|자기 몸 실제접촉 기존→최종|
|---|---|---|---|
|가로|.971→1.355m|.235→.060초|.175→0초|
|세로|.993→.959m|.199→.101초|.036→0초|
|대각|.857→1.199m|.138→.063초|.152→0초|

접힘은 끝과 손잡이 거리.60m미만인 시간이며 물리적으로 몸에 감겼음을 뜻하지 않는다. 세로 도달−3.4%, 몸통높이 도달.727→.486m 손해가 남아 모든 방향 개선이라고 주장하지 않는다.

## 실제 브라우저 반복 터치·사진

touch_repeat.mjs: 실제 CDP 터치로6회 준비/대각 휘두르기, 대략8초. 기존 자기몸접촉1.183초→0, 최종끝-손잡이거리.582→1.068m. 실제사진 before/after-swing-1~6 및 ready.png 보존. 상대를3m 옮겨 숨기고 관찰 카메라만 변경. 이 시험의 접힘시간은.992→1.208초로 늘었으므로 항상 곧게 펴진다고 말하지 않는다. 자기 몸에 고정되는 원인을 없앤 것이며 사람 손맛·전체밸런스 완성 판정 아님.

Vite가 촬영 파일 저장 때 reload하여 wrapProbe가 사라진 첫 브라우저 시도는 실패. 고정된 dist서버로 변경해 완료. 두판 저장 불변/오류0/8마디·파손없음/전투유지.

## 검증

기존31무기 정의/부품 그대로. 정지·반복입력·AI·양쪽채찍 각12초 안정성/상대피해·칼접촉 확인, 마디벌어짐3cm 미만·속도30m/s미만. 강충격1000회+직접break 호출에도8마디/144cm줄/770g 유지.

공통5관문: fights12/live_battery/finish_thrust1--stand 기존stdout동일(공통의존성 경고제외), corr off/on×a,b12/12동일, weapon_smoke32종정상·NaN0·기존31줄동일. build통과. 공개경로/모바일 갤러리 검사는 public-checks.json, 실제 배포 검증은 publication.json.

## 재현

- node docs/design/druid_whip_release_20261022/repeat.mjs
- node docs/design/druid_whip_release_20261022/verify.mjs
- node docs/design/druid_whip_release_20261022/collision_masks.mjs
- npm run build 후 dist를5199에 제공하고 node docs/design/druid_whip_release_20261022/touch_repeat.mjs
- public폴더5200 제공 후 node docs/design/druid_whip_release_20261022/public_check.mjs
