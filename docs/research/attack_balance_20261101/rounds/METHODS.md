# 30초 완성 키트 입력 프록시 관측

대상 빌드는 `88a96061e8dd93e8f107b7b0df647a341e73fa5d`이다. 본판 상수와 기존 하니스는 수정하지 않는다. 담당 드라이버는 `tools/sim/balance_rounds_20261101.mjs`이며 이탈리아·이베리아·일본·동방 4유파 × 두 정책 × pressure/spacing × seeds 1–6, 총 96판을 한 Node 프로세스에서 순서대로 실행한다. 독일 24판은 별도 담당이다.

`natural`은 **혼합 우선순위 대본 입력**, `targeted`는 **기술 우선순위 대본 입력**이라는 파일 열쇠다. 두 정책에서 바뀌는 상수는 기술 행동을 고르는 확률 0.25/0.8뿐이다. 관측 항목, 0.22초 지연, 행동 구현, 손 떨림, 보통 공격·막기·이동 후보, 장비와 생리 규칙은 같다. 인간 성공률이나 자연 인간 빈도로 해석하지 않는다. 정책의 대기·준비·동작 길이가 달라질 수 있으므로 피해 차이를 기술 하나의 인과 효과로 해석하지 않는다.

## 조건

- 각 유파 `kitFromNodes(school, allNodeIds(school))`로 정상 완성 키트를 연다. 보법·막기·패시브·심화와 일반 고유·특수·비기가 함께 적용된다.
- 외형/방어구는 모든 판에서 기본 `LOOKS.player`(케틀햇)와 `LOOKS.enemy`(투구 없음)를 유지한다. 케틀햇 외형이 있어도 장비 장부의 최대 기력 덧은 0이다. 양쪽 외형 차이도 결과 조건에 포함된다.
- 사람 무기는 rapier/zweihander/uchigatana/hwando, 상대는 모두 longsword·숙련 3이다. `pressure={aggr:1.2,margin:.1,patienceTime:4,circleRate:.15}`, `spacing={aggr:.7,margin:.45,patienceTime:12,circleRate:.25}`를 실제 해석된 persona와 함께 기록한다.
- `humanInput=true`, AI2 없음, 기준 초당 회복 25, 최대 100, 장비 덧 0, 무한 false이다. 비기 사용은 유파당 1회·동방 3회, 특수 식힘은 기본 3초(`TIME.k=1.1`에서 게임 3.3초), 시작점은 동작 후 자유를 되찾은 때(`specialCoolFrom='free'`)다.
- 기본 출발 간격 5.6m와 바닥·벽을 유지한다. 최초 `openHold=false` 시점 뒤 기준 30초를 센다. `activeReferenceSeconds=(G.t-activeStartGame)/TIME.k`이며 물리 스텝 끝에서 종료하므로 한 스텝 이하 초과할 수 있다. 조기 종결은 그 즉시 종료하고 실제 시간을 남긴다. 출발 대기 동안의 피해도 총 피해에 포함한다.
- 60Hz 기준 입력 시계와 기본 물리 스텝을 사용한다. 화면 타격 멈칫·비기 슬로모션·렌더링은 재현하지 않는다. 결과의 초는 이 효과를 뺀 기준 시간이며 실측 벽시계 시간도 별도로 남긴다.

## 실제 입력과 정상 발동

손 입력은 실제 `Input.onDown/onMove/onUp → consumeHandDelta/consumeTaps`를 통과한다. 이동은 `Input.stickMove → Input.move` 프록시다. DOM 조이스틱의 좌표 계산과 trusted 브라우저 이벤트는 재현하지 않는다. 입력 핸들러 호출 동안에만 `window` shim을 설치하고 즉시 복원한다. 물리 스텝 중에는 `window`가 없다.

`main.playerInputFrame`의 비기 입력·spinCircle·미리 받기·막기 깨짐·unique.feed·holdInput·손 잠금·탭·걸음 순서를 따른다. 물리 스텝은 `PlayerSecretWatch.update → queued 자동 격살/미리 받은 입력 → PlayerParryGuard.step → Fighter.step → world/combat`로 이어진다. 비기 실행은 열린 watcher 창에서 실제 공격 입력을 받거나 watcher가 정상 조건으로 자동 대기한 격살만 요청한다. 비기를 얻기 위한 직접·강제 request, 비기 사용 회수 보충, 적 순간 이동, 상처·넘어짐·파손·종결 억제는 없다.

관측 프록시는 가슴 거리, 적 공격 상태, 자신의 실제 창/준비/닿음/이어긋기 신호와 날 기하를 0.22초 지연한 뒤 본다. 적 내부 상태·정확한 창 진실·기하를 볼 수 있으므로 사람 시각 실험이 아니다. 자신의 현재 입력·손·기력·실행 잠금은 즉시 읽는다. 두 정책에서 관측과 지연은 동일하다.

## 원본 정의와 한계

각 JSONL 줄은 한 판이다. `byTech`는 전체 19종을 고정 열로 두고 해당 유파만 `applicable=true`로 표시한다. `researchEvents`, `inputTrace`, 기본 관측기의 `events/requests/states/stateChanges`를 보존한다.

- **opportunities**: 비기 watcher의 실제 창, 실제 입력을 받은 unique chooser의 조건 일치, 유효한 닿음 박자, 위협+옆 스틱, 물러남 박자, 실제 readyChain, 길게 누름 진입 가능한 몸·식힘 상태를 구분해 기록한다. 이 조건은 서로 종류가 다르다. 특히 강화동작 chooser 사건은 입력이 있어야 생기므로 독립적인 전체 기회 분모가 아니다. 기회 대비 성공률로 합치지 않는다.
- **intents**: 정책이 해당 기술을 노리며 시작한 행동이다. 대기·준비가 포함되고 실패·창 없음도 포함된다. 뜻하지 않게 실제 입력에서 발동한 기술은 의도 0이면서 요청·실행이 양수일 수 있다.
- **requests/accepted**: 실제 `Skill.secret`, `PlayerUniqueAssist.start/launchTap/windFire` 호출과 엔진 fired 증가를 분리한다. 강화의 두 번째 이어긋기(`part=2`)는 새 fired를 늘리지 않는 연속 동작이어서 raw request의 `accepted=false`는 새 발동을 늘리지 않았다는 뜻이다. 저수준 실행 request를 수동으로 생성하지 않는다.
- **started**: 강화의 실제 start, 비기의 첫 `Skill.updateSecret` 콜백, 운동학 기술의 새 실제 `Fighter.iai` 객체를 센다. 같은 강화가 운동학 객체도 만들면 두 번 세지 않는다. 요청 수·fired 수·실행 수는 다른 열이다.
- **contacts**: 실제 onWound 계열 몸 접촉 콜백이다. 무기끼리의 steel clash와 가까운 날 기하 episode는 별도 사건이다. 엔진 콜백을 만들지 않은 무상처 몸 스침 전체 수는 이 하니스에서 측정하지 못한다.
- **effectiveWounds**: `applyWound` 전후 상처 목록이 실제로 증가한 수다. 접촉의 심각도 합, 실제 출혈 증가, 의식 감소, 사지 기능 감소를 따로 남긴다. 피해 기술 귀속은 그 순간 실행 중인 비기/고유 기술 태그이며 독립적인 원인 공격 토큰은 아니다.

양쪽의 혈액·의식·사지·엔진 생사·상처·기력 장부·전이·무기 파손·넘어짐·칼 놓침을 기록한다. 매 판 후 config 해시 불변, 비기 사용 한도와 사람 기력 설정을 확인한다. 고정 씨앗은 시뮬레이터 반복에 쓰며 독립적인 인간 표본을 뜻하지 않는다.

## 파일럿 보존

`pilot/`에는 첫 4유파 실행을 남겼다. 일본은 TECH 기본 목록에 없는 `langortDown` 경로를 드라이버가 찾다가 오류를 냈으므로 `valid=false`이고 본배치에 합치지 않는다. 드라이버에 기존 코테와 같은 긴 자세 → 짧은 아래 긋기 입력 경로를 추가한 뒤 `pilot_fixed/`에서 정상 실행을 확인했다. 이 수정은 게임 코드·기술 수치 변경이 아니다.

첫 이탈리아 파일럿은 30.008초 동안 카바치오네 3·내려찌르기 12·인콰르타타 3, 이베리아는 7.682초 조기 종결까지 정수리 가르기 1·싱지르 1, 수정 일본은 22.424초 조기 종결까지 고노센 1·비껴베기 3·코테 4·제비 2, 동방은 18.409초 조기 종결까지 격살 1·체보 3·염시 2·요격 3의 실제 실행을 확인했다. 파일럿의 시행착오와 원본은 삭제하지 않는다.

본배치 실행:

```sh
node tools/sim/balance_rounds_20261101.mjs --out=docs/research/attack_balance_20261101/rounds/full
```

`full/manifest.json`은 실제 소스 해시·빌드·설정·시작 시각과 계획을, `full/rounds.jsonl.gz`은 원본을, `full/summary.json`은 현재까지 완료한 묶음을 담는다.

완료 뒤 `python docs/research/attack_balance_20261101/rounds/aggregate.py`는 96개 조합과 제한을 검증하고 `full/validation.json`, `full/rates.json`, `RESULTS.md`를 만든다. 활성 30초당 실행 밀도는 `30 × 실제 실행 합 / 실제 활성 관측 초 합`이며 조기 종결이 포함된 관측 밀도이다. 30초 생존 판의 예상 빈도로 외삽하지 않는다.

`dead/alive=false`와 `endedBy=death`는 엔진 종결이다. `causeOfDeath=기절`도 이 플래그를 사용하므로 생리적 사망과 합치지 않는다. 최종 요약은 원인 문자열(기절·출혈·목·머리 등)과 넘어짐 사건을 별도 집계한다.

독일 별도 배치는 seeds 301–306, 이 4유파 배치는 seeds 1–6이다. 유파 간 같은 씨앗으로 짝지은 비교가 아니며, 작은 씨앗 집합과 정책 차이 때문에 유파 간 순위를 확정하는 자료로 쓰지 않는다.
