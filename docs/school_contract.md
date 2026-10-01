# 유파 꾸러미 계약 — 무기 PM · 캐릭터 PM 사이의 약속

`src/schools.js`가 이 계약의 코드 쪽 형태다. 무기 로스터를 만드는 담당은 무기 하나마다 꾸러미 하나를
여기 규격대로 채워 넣기만 하면 되고, `src/ai.js`는 꾸러미를 **읽기만** 한다(무기 이름을 직접 알지 않는다).
캐릭터 시트(`src/characters.js`)는 `persona.school`로 꾸러미 id를 가리킨다.

## 꾸러미 한 벌의 모양

| 항목 | 형태 | 누가 정하나 | 비고 |
|---|---|---|---|
| `id` | 문자열 | 무기 PM | `persona.school`이 가리키는 키 |
| `weapon` | 무기 로스터 id | 무기 PM | 참고용. 무기 물리(질량·길이)는 여기서 정하지 않는다 |
| `measure.contact` | m | 무기 PM (실측) | 베기가 머리·목에 제대로 닿는 거리 (칼날 70% 지점) |
| `measure.reach` | m | 무기 PM (실측) | 서서 휘두르며 한 걸음 내디디면 닿는 거리 = 이 안은 위험 |
| `measure.clinch` | m | 무기 PM (실측) | 너무 붙어 칼을 못 쓰는 거리 |
| `measure.cutTime` | s | 무기 PM (실측) | 베기 시작에서 닿기까지 |
| `guards` | `WATCH_GUARDS` 모양 배열 | 캐릭터 PM (무기 PM 자문) | 간 볼 때 쓰는 자세. `name·pad·threat·high·low` |
| `tech` / `techByName` | `TECH` 모양 배열 + 이름 색인 | 캐릭터 PM (무기 PM 자문) | `from·path·open(UL/UR/LL/LR/C/H)·kind·reach·base·presses·fast` |
| `feints` | `FEINTS` 모양 배열 | 캐릭터 PM | 가짜 기술 이름 `fake`는 `tech`에 있어야 한다 |
| `parry` | `{highL, highR, highC, lowL, lowR, thrust}` → 패드 위치 | 캐릭터 PM (무기 PM 자문) | 들어오는 줄별 막기 손 위치 |
| `counter` | `{ <줄>: [기술 이름...], default: [...] }` | 캐릭터 PM | 맞받아 베기(Indes)에 쓸 기술, 앞에 있을수록 우선 |
| `withdraw` | `{ pressed: 이름, calm: [이름, 이름] }` | 캐릭터 PM | 물러날 때 겨누는 자세 |
| `pose` | `{ cover: 패드, point: 패드 }` | 캐릭터 PM | 쓰러졌을 때 가리기 · 칼끝 겨누기 |

## 무기 PM이 실측해야 할 것 (`measure`)

`tools/sim`의 하네스에 새 무기를 달고, 가만히 선 상대에게 베기를 반복해 세 거리와 한 시간을 잰다 — 롱소드
값(`contact 1.62 / reach 2.0 / clinch 1.25 / cutTime 0.3`)이 그렇게 나온 값이다. `TECH[].reach`(기술별 거리
보정)도 무기 길이에 따라 다시 재야 한다.

**간단한 길**: 무기 길이 차이가 크지 않으면(예: 롱소드 ↔ 카타나 ↔ 검) 롱소드 꾸러미를 통째로 쓰되
`measure`만 바꿔도 된다. 자세·기술 목록은 지금 `guards.js`(자세 지도)가 롱소드 기준이라, 자세 지도가
무기별로 갈리기 전까지는 어차피 같은 손 위치를 쓸 수밖에 없다.

## 지켜야 할 회귀

- `persona.school`을 안 주면 롱소드 꾸러미가 기본이고, 이때 `node tools/sim/fights12.mjs`는 예전과
  바이트 단위로 같아야 한다(꾸러미 도입 커밋에서 확인).
- 꾸러미를 새로 붙였으면 `node tools/sim/characters_eval.mjs passive 6`로 그 꾸러미를 쓰는 캐릭터의
  더미 처치 시간이 20~30초 안에 드는지 본다(롱소드 다섯 캐릭터 기준 13~26초).

## 아직 없는 것 (무기 PM에게)

- `claude/pm-weapons` 브랜치·세션이 아직 저장소에 없다. 생기면 이 문서와 `src/schools.js`를 기준으로
  무기별 `measure` 실측치를 보내 주면, 캐릭터 PM이 꾸러미를 붙이고 캐릭터의 `school`을 바꾼다.
- 지금 캐릭터 다섯의 `weapon`(`branch`·`jian`·`excalibur` 등)은 로스터 id만 적어 둔 것이고, 유파는 전부
  `longsword` 꾸러미다.
