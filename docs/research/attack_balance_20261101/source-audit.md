# 현재 기술·조건·기존 도구 조사

실행 계획과 표본 수는 [PLAN.md](PLAN.md)가 우선이다. 아래는 별도 에이전트가 현재 코드에서 확인한 목록과 도구의 한계이며 측정 결과가 아니다.

# 유파 공격 밸런스 연구 설계 — 현재 코드 확인본

조사 기준은 `/workspace/halfsword-refork-029f08a`, 가지 `codex/saengsa-main-20261101`, 병합 커밋 **`88a96061`**입니다. 현재 파일을 읽었으며 게임 소스 수정, 대규모 실험, 밸런스 변경은 하지 않았습니다. 아래 **확인**은 코드에서 읽은 사실이며, **제안**은 앞으로 실행할 실험입니다. 과거 문서의 승률·상처 수치를 현재 결과로 재사용하지 않습니다.

## 1. 대상과 실제 기술 목록 — 확인

`TRADITIONS`에는 독일·이탈리아·이베리아·일본·동방·무유파 **6개 전통**이 있습니다. 비기와 특수 공격을 가진 비교 대상은 무유파를 제외한 **5개 유파**입니다. 무유파는 비기 `null`, 고유 목록 `[]`이며 대조용 기본 공격을 낼 수 있습니다.

플레이어 구현 `PLAYER_UNIQUE`는 **14항목**이며 `special:true` 5개, 그 외 고유 공격 9개입니다. 별도의 현재 플레이어 비기 5개를 합쳐 **19개 공격 계열**을 조사 대상으로 잡을 수 있습니다. 특수 공격도 UI 분류상 '고유 공격' 칸에 들어가므로, 이 보고서의 '일반 고유 9개'는 특수 공격과 중복 집계하지 않은 표현입니다.

근거: [schools.js:1082](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/schools.js#L1082), [playerSecretDef:1108](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/schools.js#L1108), [PLAYER_UNIQUE:90](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/unique_assist.js#L90), [TREE_SCHOOLS:11](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/skill_tree_data.js#L11).

### 해금과 공통 조건

- 사람의 실제 해금은 **스킬트리의 해당 칸**입니다. `PlayerUniqueAssist`에 넘기는 `names`, 비기의 `locked:!kit.secret`가 이를 반영합니다. 아래의 AI 단계는 사람 해금 조건이 아닙니다.
- 표의 선행 칸은 직접 선행 조건입니다. 선행 칸의 선행 조건과 독일의 관문도 함께 충족해야 정상 구매할 수 있습니다. 비기 다섯은 해당 칸 가격 400금화·머리 10개입니다. 일반/특수 칸의 가격은 표에 적었습니다.
- 테스트 경로 `test=1`는 기본적으로 모든 칸이 열립니다. `skillNodes=`가 이를 우선 덮으며 `uniqueStage=`는 옛 분류 단계 필터입니다. 테스트용 `kitFromNodes()` 자체는 구매 선행 조건을 재검사하지 않으므로, 임의 노드 집합을 '정상 육성 상태'로 부르지 않습니다.
- 사람 비기: 살아 있고, 서 있고, 무기가 있으며, 상대가 살아 있어야 합니다. 다른 비기·탭·손잡이 공격 및 탈진 등 실행 불가 사유도 통과해야 합니다. **현재 기력 > 0**일 때 발동할 수 있으며, 비기 비용 35를 미리 모두 갖고 있을 필요는 없습니다. 창은 보통 실제 0.6초이며 `secretHold=1`로 첫 0.6초를 지킵니다. 사망·넘어짐·무기 없음·기력 부족은 별도입니다.
- 특수 공격 5개: 판당 정수 횟수 제한은 없으며 **해당 동작·굳음·풀기가 끝나 몸이 다시 자유로워진 때부터 실제 3초 식힘**입니다. 기술마다 별도 시계이며, 식힘 동안 같은 입력은 보통 공격이 될 수 있습니다. '30초에 10회' 같은 실제 횟수는 미리 단정할 수 없습니다.
- 일반 고유 9개에는 위 특수 식힘·비기 판당 제한이 없습니다. 살아 있음·무기·자세·다른 동작·입력 조건과 기력, 조건별 한 기회 제한은 여전히 적용됩니다.

근거: [playerKit:159](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/skill_tree_store.js#L159), [kitFromNodes:271](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/skill_tree_data.js#L271), [main.newRound:948](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/main.js#L948), [Skill.secret:629](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/skill.js#L629), [PlayerSecretWatch.update:801](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/secret.js#L801), [cooling/coolTick:630](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/unique_assist.js#L630).

### 비기 5개

| 유파 | 현재 이름 / 코드 ID / 칸 | 해금 | 실제 발동 조건·입력 | 구현 / 판당 제한 |
|---|---|---|---|---|
| 독일 | **죽음의 일격** — 화면 '모르트슐라크' / `mordschlag` / G10 | G9·G6·G7 이후, 400금화·머리10 | 나·상대가 선 채 **가슴 사이 ≤0.8m인 시간 2초**가 쌓이면 창입니다. 떨어진 틈 0.4초 안에는 쌓임을 보존하되 그 틈은 세지 않습니다. 현재 기본은 `mordRule:'close'`여서 밀치기 동작이나 특정 스틱이 필수는 아닙니다. 창 안의 탭 또는 빠른 긋기로 냅니다. | `pressTick → pressStep → openWindow → Skill.secret → mordschlag.js → requestCombo/모르트 길`. **1회** |
| 이탈리아 | 안다레 리솔루토 / `andareRisoluto` / I4 | I8 이후, 400금화·머리10 | 나와 상대가 휘두르지 않고, 나는 막기 단추를 쥐지 않으며, 칼의 덮음/맞닿음이 성립해야 합니다. 현재 덮음 거리는 0.15m입니다. 상대가 물러서면 나는 스틱 앞, 상대가 들어오면 나는 스틱 뒤입니다. 가슴 사이가 `lungeGap()` 이상이어야 합니다. 현재 `risolutoTouch=1`이라 이 조건이 선 첫 스텝에 곧장 창이 생기며, 0.6초 유지 경로와 0.2초 이상 덮은 뒤 상대 공격/덮음 해제 경로도 있습니다. 창 안의 탭·빠른 긋기 모두 같은 런지입니다. | `RisolutoWatch.tick → risoTick → Skill.secret → requestCombo(겨눈 찌름)`. **1회**. AI 현재 닫힘 |
| 이베리아 | 싱지르 / `ibSpin` / B7 | B10·B3·B5 이후, 400금화·머리10 | 실제 공격이 가능해진 뒤, 상대가 **내 칼끝 거리 `view.reach` 밖에서 2초** 머물면 준비입니다. 안으로 와도 0.6초 유예가 있으며, 상처·비기·준비 전 휘두름 등으로 풀립니다. 준비 후 **공격 손으로 어느 방향이든 360° 원**을 1.5초 안에 그립니다. 최소 원 반지름은 0, 원 안쪽 건너뜀 판정은 0.5, 멈춤 0.2초가 획 경계입니다. 보통 탭 하나로는 나가지 않습니다. 원을 그리는 동안의 보통 칼 움직임도 남습니다. | `spinTick / spinCircle → attack_circle.circleStep → Skill.secret → requestSpin`. **1회** |
| 일본 | 고노센 / `goNoSen` / J5 | J4 이후, 400금화·머리10 | 거리와 무관하게 **이동·공격·막기·맞음 없이 2초** 기다려 준비합니다. 준비된 뒤에는 걸어도 유지됩니다. 이후 발도가 닿는 거리 안에서 상대의 칼 들기·빠른 접근·요건을 갖춘 헛침이 창을 엽니다. 현재 발도 거리 상한은 `contact + iaiStep(0.6) + iaiMargin(0.15)`입니다. 헛침은 칼끝 추정 에너지 67J 조건도 봅니다. 느린 걸어 들어옴 창은 `gnsWalkIn=0`으로 꺼져 있습니다. 창 안 탭·빠른 긋기로 냅니다. | `gnsArmTick / secretEvent / secretCond → openWindow → Skill.secret → requestIai`. **1회** |
| 동방 | 격살 / `gyeoksal` / C9 | C5·C8 이후, 400금화·머리10. C7 막기 몸꼴도 실제 필요 | **막기 새 누름 후 0.6초 안**에 상대 칼과 새 맞댐이 생겨야 하며, 그때 단추를 쥐고 있고 스틱 앞 `stickY > abs(stickX)`이어야 합니다. 상대 최근 칼끝 속도 ≥3.5, 최근 0.6초 내 내 상처 없음, 내 공격 없음, 적합한 받은 자세가 필요합니다. 받는 동안 내가 베이지 않고 칼이 갈라지면 창/자동 대기열이 생깁니다. 현재 `auto=1`이므로 받아 내면 별도 탭 없이 실행할 수 있습니다. | `gyeoksalTick / gyeoksalStance → queued → main의 자동 실행 → requestCombo`. **3회**. 거정→머리, 어거→팔, 요략→다리, 봉두→허파 찌르기 **4가지 결과 경로** |

비기 정의 근거: [mordschlag:1025](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/schools.js#L1025), [andareRisoluto:672](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/schools.js#L672), [ibSpin:774](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/schools.js#L774), [goNoSen:784](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/schools.js#L784), [gyeoksal:969](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/schools.js#L969). 조건 근거: [pressTick:940](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/secret.js#L940), [RisolutoWatch.tick:192](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/italian_risoluto.js#L192), [spinTick:961](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/secret.js#L961), [secretCond:355](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/secret.js#L355), [gyeoksalTick:1148](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/secret.js#L1148), [secretUses:1618](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/config.js#L1618).

### 특수 공격 5개

| 유파 | 현재 이름 / 코드 ID / 칸 | 직접 선행·가격 / AI 단계 | 사람의 현재 조건·입력 | 실행 |
|---|---|---|---|---|
| 독일 | 겹치기 / `duplieren` / G7 | G4, 300금화 / 3 | 현재 **자동**입니다. 가슴 사이 **0.8m 초과~1.6m 이하**에서 칼 맞댐이 0.6초 쌓여야 합니다. 실제 칼 접촉 또는 칼날 선분 사이 <0.07m를 맞댐으로 봅니다. 0.2초 안 끊김은 쌓임만 보존, 넘으면 0입니다. 막기 단추로 맞댄 것도 셉니다. 손가락이 휘두르는 동안은 발사를 미룹니다. 탭은 현재 기본에서 보통 탭 찌르기이며 옛 `dupAuto=0` 조건과 다릅니다. | `dupAutoTick → launchTap(auto) → requestArtDup → comboPlanDupLine`. 얼굴 베기와 최적 거리로 앞 박차기, 현재 박차기 추가 기력 0. 같은 칼 고노센 **칼끝 속도 몫 0.25** |
| 이탈리아 | 비껴서며 찌르기(인콰르타타) / `inquartata` / I9 | I6, 300금화 / 3 | `PlayerParryGuard`가 상대 공격을 위협으로 읽는 동안 또는 마지막 위협 후 0.25초 안, **스틱 옆 + 탭**입니다. 옆은 `abs(x)≥0.5 && abs(x)≥abs(y)`입니다. 한 위협 번호에 한 번입니다. 카바치오네와 조건이 겹치면 이 특수가 우선하며, 식힘 중에는 카바치오네가 나갈 수 있습니다. | `TAP_TRIG.inq → tapChain → requestArtThrust(voidStep)`. 옆 0.3m·앞 0.15m 걸음, 속도 몫 **0.3** |
| 이베리아 | **정수리 가르기(알티바슈 포르트)** / 저장 ID `redondo` / B4 | B5, 300금화 / 3 | 칼 쪽 화면을 끌지 않고 **0.6초 길게 누르면 어깨에 메기**, 떼면 내려 가릅니다. 움직이며 시점을 고를 수 있습니다. 식힘·비기 창·다른 동작·탈진에서는 그 누름으로 메지 않습니다. 메는 동안 상처·막기·비기·탈진·강한 흔들림 등은 취소, 기력 0 이하는 자동 내려침입니다. 현재는 옛 풍차 회전 기본이 아닙니다. | `holdInput / holdTick / windBegin / windFire → requestArtRedondo → comboPlanRdTajo`. 속도 몫 **0.25**, 메는 동안 실제 1초마다 베기 한 번의 기력, 내려침도 베기 한 번 |
| 일본 | 제비 베기 / `tsubameGaeshi` / J9 | J6·J7, 300금화 / 3 | 정수리/좌우 사선 내려베기가 **빗나가거나 막힌 뒤**, 끝난 후 0.6초 창 안에 위로 긋습니다. 현재 올려베기 경로는 `tsuHook=0` 곧은 길이며 몸통 띠 보정을 사용합니다. 모노호시자오의 무기 비검은 별도 예외이므로 기본 시험에서 제외합니다. | `condOk / choose / start → requestArtSnap`. 속도 몫 **0.6** |
| 동방 | 날개 접기(염시) / `lianchi` / C6 | C3, 300금화 / 3 | **스틱 뒤 + 탭**, 또는 뒤 스틱을 놓은 뒤 실제 0.6초 안의 탭입니다. 뒤는 `-y≥0.5 && -y>abs(x)`입니다. 상대 칼 맞댐은 필수 조건이 아닙니다. | `TAP_TRIG.lian → tapChain → requestArtFold`. 앞으로 0.45m 내디디며 허리 베기, 속도 몫 **0.6** |

속도 몫은 **피해 배율이 아닙니다**. 질량·날 방향·맞는 부위·방어구·접촉 경로를 거친 상처/의식 손실을 실제로 재야 합니다. 현재 `tsu/cav/inq/lian/dup/rd`의 새 칼 시간 상한들은 0(길 끝까지)입니다. 실험 편의를 위해 공격 시간 상한을 다시 넣지 않습니다.

근거: [TAP_TRIG:288](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/unique_assist.js#L288), [tapChain:536](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/unique_assist.js#L536), [holdTick:694](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/unique_assist.js#L694), [dupAutoTick:865](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/unique_assist.js#L865), [specialShare:1625](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/config.js#L1625), [rdLoad:1741](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/config.js#L1741).

### 일반 고유 공격 9개 — 모두 포함

| 유파 | 현재 이름 / 코드 ID / 칸 | 직접 선행·가격 / AI 단계 | 사람 조건·역할 / 개별 제한 |
|---|---|---|---|
| 독일 | **실하우(곁눈 베기)** / `schielhau` / G5 | G1, 200금화 / 4 | 분노의 베기 `zornhau` 입력을 강화합니다. 기본 방향은 오른 위→왼 아래입니다. 길·칼끝 덧칸과 몸·끝 힘 강화가 붙습니다. G6 심화를 익혔을 때만 대상 부위 적중 후 무릎 꺾기 확률 효과가 붙습니다. 판당/특수 식힘 없음 |
| 독일 | 비껴 딛는 가로베기 / `zwerchAbtritt` / G8 | G1, 200금화 / 1 | **스틱 옆 + 가로 긋기 `zwerch`**입니다. 실제 가로베기와 옆·앞 걸음이 함께 나가는 공격입니다. 자세만 바꾸는 보조가 아닙니다. 판당/특수 식힘 없음 |
| 이탈리아 | 내려 찌르기(임브로카타) / `imbroccata` / I7 | I3, 200금화 / 1 | 황소 찌르기 입력 및 **어느 높이에서든 아래로 가는 베기**를 찌르기로 바꿉니다. 아래 기준 ±67.5°이며 수평·올려 긋기·보통 탭과는 다릅니다. 일반 찌르기 실행을 사용하고 긋기 기력 대신 찌르기 한 번을 청구합니다. 판당/특수 식힘 없음 |
| 이탈리아 | 칼끝 돌려 빼기(카바치오네) / `cavazione` / I2 | I7, 300금화 / 2 | 내 베는 긋기 동안의 닿음이 아닌 **실제 칼 맞댐** 뒤 박자에 맞춰 탭입니다. 첫 맞댐에서 ≥0.2초, **마지막 닿음에서 ≤1.2초**여야 합니다. 이른 탭은 보통 탭이 되고 그 닿음의 기회를 없애며, 한 닿음에 한 번입니다. 상대 칼 밑으로 빼 반대쪽을 찌릅니다. 보통 탭 속도×1.2, 잔상/특수 식힘 없음. I8 심화가 있으면 상대 팔 1.2초 늦춤 |
| 이베리아 | 나선 걸음 베기 / `talhoRodeado` / B3 | B1, 200금화 / 1 | **스틱 옆 + 사선 내려 긋기 `zornhau`**입니다. 베기와 큰 걸음이 함께 나갑니다. 공격 없는 단순 옆걸음으로 집계하지 않습니다. 판당/특수 식힘 없음 |
| 일본 | 비껴 베기 / `hirakiGiri` / J6 | J1, 200금화 / 1 | **스틱 옆 + 왼 사선 내려 긋기 `zornhauL`**입니다. 실제 베기와 비껴 딛기를 결합합니다. 판당/특수 식힘 없음 |
| 일본 | 손목 치기(코테) / `kote` / J7 | J1, 200금화 / 2 | **가운데 겨눔 `langort`에서 짧게 아래로 긋기**를 강화합니다. J8 심화가 있으면 별도 칼 떨구기 효과가 붙습니다. 판당/특수 식힘 없음 |
| 동방 | 허리 베기(요격) / `yaoji` / C3 | C1, 200금화 / 4 | 가로 긋기 `zwerch`를 강화합니다. C4 심화를 익혔을 때 몸통 베기의 출혈이 증가합니다. 판당/특수 식힘 없음 |
| 동방 | 끌어 딛고 허리 베기(체보요격) / `chebuYaoji` / C5 | C3, 300금화 / 1 | **스틱 앞 + 가로 긋기 `zwerch`**입니다. 앞은 `y≥0.5 && y>abs(x)`입니다. 가로베기와 앞으로 끌어 딛기를 결합합니다. C4 심화의 몸통 출혈 이점도 적용될 수 있습니다. 판당/특수 식힘 없음 |

아홉은 모두 `uniqueDef()`에서 칼 경로를 갖고 실제 베기/찌르기에 연결됩니다. 다만 걸음 공격 4종은 '기본 칼 + 보법/몸 강화', 실하우·코테·요격은 '기본 칼 강화', 임브로카타는 '입력 전환', 카바치오네는 '접촉 후 찌름'이라 같은 형태의 새 궤적만 비교하는 연구로 축소하면 안 됩니다.

**19종 밖에 따로 통제할 층:** 왕관·세 자세 받기 등 막기 자세, B5 흐르는 긋기, B6 이어지는 흐름, 보법, 유파 패시브, G6/J8/I8/C4 심화. 이들은 준비·기회·결과를 바꾸지만 별도 제20 공격으로 세지 않습니다. 단, 실제 전투가 이 보조를 포함하는 경우가 있으므로 '공격만의 이득'과 '실제로 익힌 꾸러미 성능' 두 실험을 분리합니다.

### 사람과 AI를 같은 기술로 간주하면 안 되는 부분

AI 비기는 숙련도 5 이상이며 현재 열린 유파가 **일본·이베리아·독일만**입니다. 이탈리아·동방 AI의 비기가 닫힌 사실을 그 비기의 인간 성능 저하로 해석하지 않습니다. 사람과 AI의 특수 식힘 수치는 같아도 입력/선택 경로는 다릅니다. 예를 들어 사람 겹치기는 자동 맞댐 누적, AI는 자기 공격/패시브 경로를 씁니다. AI 승패는 물리 상호작용과 상대 유형 민감도 확인에만 보조로 사용합니다.

## 2. 재사용할 하니스와 계측 지점 — 확인 및 정상화 제안

| 파일·함수 | 재사용할 부분 | 현재 그대로 쓸 때 한계 / 조치 |
|---|---|---|
| `tools/sim/special_balance.mjs`: `drillRun`, `fightRun`, `fingerBot`, `strokeLog`, `addHit`, `attSummary`, `fireDiag` | 입력 흔들림·지연·켬/끔 짝 비교, 실제 고유 실행, 적중 부위·에너지·상처·막힘·헛침 진단 | `german/italian/chinese` 행은 각각 실하우/임브로카타/요격이고 현재 특수 5개 목록이 아닙니다. `cavTap`은 옛 막아찌르기 뒤 입력, `dupTap`은 옛 탭 전제이며, `iberian`은 옛 강화 레돈두입니다. 최신 조건용 행·운전이 필요합니다. `cavTouch/inqVoid/lianTap/rdHold`도 이름보다 실제 실행 ID를 검사해야 합니다. |
| 같은 파일 `drillRun` / `freshOutcome` | 새 몸에서라면 치명/깊음 등 진단, 무피해 표적의 경로 탐색 | **상대 `applyWound`, `knockDown`, `dropSword`를 막는 모드**입니다. 실제 의식·사지·사망·맞교환 결과로 사용할 수 없습니다. 잠재 경로 탐색에만 남기고 본 단발 시험은 새 몸에서 정상 상처를 적용합니다. `freshOutcome`은 머리/목 조건 등의 근사 분류이며 실제 사망 판정 대체물이 아닙니다. |
| `tools/sim/duplieren_auto.mjs`: `fight`, `B`, `applySet`; `duplieren_simple.mjs`; `duplieren_check.mjs` | 자동 겹치기 띠·맞댐·쌓임·거절 상태, 정상 손/노리는 손, 얼굴 경로·몸 안정성 | `sweep`은 고정 기록에서 '냈을' 기회만 셉니다. 겹치기가 바꾼 이후 전투는 재현하지 못합니다. 실제 발동 횟수는 닫힌 고리 재실행으로 확인합니다. |
| `tools/sim/italian_swap_measure.mjs`: `summarize`; `special_balance.fightRun('cavTouch'/'inqVoid')` | 접촉→탭, 내 베기 닿음 제외, 위협별 시도, 팔 묶임, 나/상대 상처, 넘어짐 원인 | 최신 카바치오네·인콰르타타에 가장 가까운 경로입니다. 기존 짧은 사후 창/판당 합계에 전체 사건 로그와 양측 생리 변화를 추가해야 합니다. |
| `tools/sim/mordschlag_hits.mjs`; `risoluto_play.mjs`; `gyeoksal_probe.mjs`; `secret_kill.mjs` | 실제 `PlayerSecretWatch` 조건과 `Skill.secret` 실행, 거절 까닭·맞기까지 시간·막힘·부위·노출·회수·사망 시각 | `mordschlag_hits`는 **`UA.secretUses=null`로 판당 제한을 풉니다**. 제한을 유지한 자연 빈도에는 그대로 쓰면 안 됩니다. `risoluto_play` 기본 인자가 hold/beat를 덮으므로 현 기본을 보존하는 실행 경로가 필요합니다. `secret_kill`의 '사람' 표시는 AI 여부로 붙인 것이어서 실제 사람이 조작했다는 증거가 아닙니다. |
| `tools/sim/schielhau_strike.mjs`: `playerRun`, `tsubameRun`, `playerFight`; `tsubame_trace.mjs`; `b4_probe.mjs`/`redondo_check.mjs` | 기본 베기 대조, 전후 경로·날 방향·접촉 높이·준비/베기 구간·자기 몸 겹침 | `ghostDown`·상처 억제·옛 설정을 쓴 결과는 진단으로 표시합니다. 조건 재현을 위해 첫 칼의 몸 충돌을 끄는 방식은 실제 인간 성공률에 넣지 않습니다. |
| `tools/sim/unique_assist_probe.mjs`; `unique_enhance_measure.mjs` | 실제 `feed → 손 목표 → 물리 스텝`, 기본 칼 판독·조건 대조, 손/칼 경로·강화·보법 측정 | 옛 조건/단계·대본 입력 중심입니다. 터치·조이스틱·해금·현재 기력까지 동일하다고 볼 수 없습니다. 최신 동작별로 작은 실행 확인부터 합니다. |
| `tools/sim/unique_study_player.mjs` / `unique_study_ai.mjs`; `unique_study_agg.py` | 짝 차이·공통 관측시간·양측 상처/의식/사지/출혈이라는 설계 아이디어 | **현재 JS는 빠진 파일을 import합니다.** player는 `chinese_benefit_model.mjs`와 `japanese_flow_model.mjs`, AI는 전자를 요구합니다. 현재 트리에 없어 그대로 실행 불가입니다. 집계의 옛 기술 매핑도 갱신해야 합니다. |
| `tools/sim/harness_m.mjs`: `newRound`; `jelly_harness.mjs`: `newRound`, `newMatch`; `src/match.js`: `stepMatch` | 실제 Fighter·Combat·AI 물리와 고정 dt, 판 생성·시드·관측 hook | 기본 `newRound`의 자리0은 **사람이 아니라 가만히 있는 몸**이며 자동 AI 대 AI도 아닙니다. 이 하니스들이 `PlayerSecretWatch`·실제 입력을 자동 설치하지도 않습니다. 연구 운전자와 해금·기력·스텝 순서를 명시해야 합니다. |
| `tools/browser/italian_swap_shots.mjs`, `touch_thrust.mjs`, `unique_assist_shots.mjs`, `player_secret_shots.mjs` | 실제 페이지의 CDP 터치·키·조이스틱·화면 크기, `window.game` 관찰 | 일부는 직접 상태/자세를 세우거나 키보드로 옆 이동합니다. 물리 fixture와 입력 자동화 부분을 구분하여, 인간 조작성은 실제 사람이 터치/스틱을 만진 기록으로 냅니다. |

`player_specials`라는 파일은 **현재 트리에서 찾지 못했습니다**. 이름만 보고 존재하는 공용 하니스로 가정하지 않습니다. 위 파일들의 직접 상대경로 import 존재 여부는 읽기 전용으로 확인했으며, 실행 정상성 검증까지 끝냈다는 뜻은 아닙니다.

### 실제 코드의 계측 위치

- **입력 원본:** `src/input.js`의 `onDown/onMove/onUp`, `consumeTaps`, `consumeHandDelta`, `holdState`, `attachStick`. 터치 좌표·이벤트 시각·스틱 원값·정규화값·누름/떼기·끌림·취소를 기록합니다. 터치→패드 변환과 스틱 보호 구역/데드존도 그대로 통과시킵니다.
- **입력 라우팅:** `src/main.js` 3438 부근의 `atkWin/secSwipe/secArm`, `spinCircle`, `feed`, `holdInput`, `thrust`, 물리 스텝의 `playerSecret.update` 및 자동 `queued` 실행. 비기와 특수/보통 탭 중 **어느 경로가 입력을 소비했는지**를 기록합니다.
- **조건·거절:** `PlayerSecretWatch.openWindow/fire/update`, `poor`, `pressTick`, `spinTick`, `gyeoksalTick`, `RisolutoWatch.tick`; `PlayerUniqueAssist.choose/tapChain/launchTap/dupAutoTick/holdTick/start/coolTick`. 창 수와 실제 실행 수가 같지 않음을 유지합니다.
- **실행과 제어 회복:** `Skill.secret`, `requestIai/requestCombo/requestArt*`, `stepCombo/endCombo`, `iaiBusy`, `skill.sec/secretPhase`, `iai/iaiReq/iaiHoldT/iaiFade`, `stats.coolRuns`. `stats.fired`만으로 물리 칼이 실제 시작했다고 판정하지 말고 요청 수락·실행 시작도 확인합니다.
- **접촉·상처:** `Combat.afterStep/bladeClash/strike/analyze`, 기존 `onWound(att,vic,r,point,pr)`에 기록을 연결합니다. 칼끼리 접촉, 몸 접촉, 에너지 문턱/방어구에 막힌 타격, 실제 상처를 각각 구분합니다. 물리 이벤트 큐를 다른 관찰자가 다시 비우지 않습니다. `onWound`는 모든 무상해 접촉을 보장하지 않으므로 접촉 여부는 기존 물리 처리에 읽기 전용 hook/접촉 조회로 보완합니다.
- **생리·결과:** `Fighter.applyWound`, `die`, `knockDown`, `dropSword`, `blood/bleed/consciousness/limbs/missing*`, 갑옷·투구·무기 손상. 특히 **죽음의 일격 같은 둔타는 베인 상처 수/심각도가 0이어도 의식 손실로 강할 수 있습니다**.
- **기력:** `Stamina.spend/chargeAttack/secret/stages`, `spent`, `counts`, `recovered`, `value`, `level`, `exhaustLeft`, `recoverRate`. 사람 입력 몸의 `humanInput=true`는 회복 **25/실제초**, 대본 몸은21, AI는15입니다. 사람 재현 운전에서 `humanInput`과 `skillKit`을 누락하면 비용/회복 비교가 어긋납니다. 생리와 입력자 종류는 별도 필드로 둡니다.

근거 파일: [input.js:12](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/input.js#L12), [main.js:3438](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/main.js#L3438), [Combat.strike:947](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/combat.js#L947), [Fighter.applyWound:1671](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/fighter.js#L1671), [Stamina:17](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/stamina.js#L17). 페이지에는 `window.game.player/playerGuard/playerUnique/playerSecret/combat`가 이미 노출돼 있습니다([main.js:3661](https://github.com/yoonjl-svg/halfsword/blob/88a96061e8dd93e8f107b7b0df647a341e73fa5d/src/main.js#L3661)).
