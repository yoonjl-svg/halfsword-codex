# 화면 글 방침 2판 — 기술 이름 · 자세 · 스킬북 · 무기 설명 (2026-10-19)

- 지시 (사장님 10/19 00:4x, 원문): "게임 전체 텍스트 정리를 한 번 하자. 편집과 교열. 예전에 마련했던 원칙이 시간이 흘러 무색해진 거 같아. 특히 기술명과 설명. 필수 정보는 주되 단순 간결하게. 원어를 어떻게 쓸지도 고민. 유파마다 조금씩 달라서. 무기 설명도 샛별이가 스펙 위주로 써서 거의 그대로 가져왔는데 정량적 스펙보다 흥미로운 서사성이나 역사적 사실성이 중요해. 검토 후 먼저 의견 제시해봐."
- 디렉터 의견(원칙 2판 안) 뒤 사장님 답 (10/19 01:0x, 원문): "1. 추천대로 2. 무기 설명은 역사 한 줄 + 손맛이나 특성에 대한 암시나 역사 한 줄(예: 복수의 저주를 받아 다칠 수록 매서워진다.) 특별한 서사가 없는 보통의 무기들은 역사적 용도나 객관적인 사실 위주로. 사실과 전설 구분할 필요 없어. 3. 등급 이름 섞여있어도 돼. 4. 진행해."
- 앞 판: `docs/text/naming_policy_2026-10-10.md`(유파별 원어 표기) · `docs/ui/hud_copy_rules_2026-10-10.md`(문구 규칙). 이 문서가 **이름 · 설명 · 무기 글**에서 앞 판을 대신한다. 끝말 · 가운뎃점 · 괄호 띄어쓰기 등 나머지 문구 규칙은 그대로.

## 1. 원칙

> **3차(10/19 02:0x, §6)로 바뀜**: 괄호 안은 모든 유파 **한글 소리(독음)** — 원어 글자(Zornhau · 腰擊 · 小手)는 **대기실 스킬북에서만**. 무기 스펙(종류 · 길이 · 무게)은 **대기실 아이템 창에서만** 설명 뒤에. 아래 1 · 2 의 '원어 철자 · (漢字 독음)' 꼴은 옛 판.

1. **이름 = "뜻 (원어)" — 모든 유파.** 화면은 괄호 앞을 큰 줄, 괄호 안을 작은 줄로 그린다(`src/main.js` `splitName`). 흐름 중에 뜨는 이름을 바로 알아듣게 하고, 원어의 맛은 작은 줄이 지킨다.
   - 서양(독일 · 이탈리아 · 이베리아): 원어 철자 — 굽은 베기 (Krumphau) · 위에서 내려 찌르기 (imbroccata) · 돌며 베기 (talho rodeado)
   - 일본: 일본 소리를 한글로 — 손목 치기 (코테) · 흘려 받기 (우케나가시) · 뒤에서 앞서기 (고노센). 한자 · 가나는 쓰지 않는다(10/10 방침을 작은 줄로 옮김)
   - 동방: 한자 + 한국 한자음 — 허리 베기 (腰擊 요격) · 솥 들기 (擧鼎勢 거정세)
   - 원어가 따로 없는 우리 이름(길목 지키기 · 이어 돌기 · 올려 맞받기 · 무유파 자세 · 여러 유파가 같이 쓰는 몸 틀 자세)은 한국어만.
   - 코드 열쇠로 쓰이던 글도 같은 꼴로 바꾸고 코드 참조를 함께 고쳤다(2차 — 사장님 01:5x '전체를 대상으로 고치고, 그에 따라 코드까지 고쳐버려', §5): 기본 자세 왼쪽 다섯(`src/guards.js` GUARDS — 독일 롱소드 화면 이름이자 모든 자세표의 열쇠) · 유파 속임수 넷(`feint.name`). 이탈리아 Prima · Seconda · Terza · Quarta 낱말은 이름 안에 그대로라 `hands.js` 는 그대로.
2. **설명 = 한 줄, 20자 안팎, "언제 · 무엇을".** 손 높이 · 칼끝 방향 같은 몸 모양은 화면에 보이므로 뺀다. 출처는 소스의 `src` 칸에 그대로 있다.
3. **무기 = 두 줄.** 첫 줄 역사나 전설 한 조각, 둘째 줄 손맛 · 특성의 암시 또는 역사 한 줄. 특별한 서사가 없는 보통 무기는 역사적 쓰임 · 객관적 사실. 길이 · 무게 숫자는 쓰지 않는다. 사실과 전설은 가르지 않는다. 사장님이 쓴 글(라이트세이버 · 엑스칼리버 복제 · 건슬링어의 리볼버 · 황약사의 검 — 사장님 01:5x '그런 애들은 고칠 필요 없어')과 이미 서사가 있는 글(나뭇가지 · 고무 닭 · 냉동 참치)은 그대로.
4. **스킬북 = 개발 말 빼기.** "없거나 봉인하면 …" · "개발 예정 …" · "(임시)" · "— 게임 해석" 을 뺐다. 막기 책은 무엇을 어떻게 받는지 + 막는 동안 피해 감소, 비기 책은 언제 공격하면 무엇이 나가는지(`src/skill_books.js` `SECRET_TEXT` — 비기 판 이름 열쇠라 주소 스위치로 판을 바꿔도 맞는 글).
5. **등급 이름**(쓰레기 · 커먼 · 레어 · 에픽 · 레전드)은 섞인 그대로 둔다(사장님 3).

## 2. 표기 검사기
- `tools/text/name_policy.mjs` (`texts.mjs` `chineseFormProblem`): 동방 새 꼴 '(漢字 독음)' 을 받는다 — 괄호 안 한자 수와 독음 음절 수가 같아야 한다. 옛 꼴 '독음 (漢字)'(화면에 안 뜨는 공용 기술 이름 등)도 통과. 일본 글의 한자 · 가나 금지는 그대로. 10/19 실행: 화면 글 984 줄 · 위반 0.

## 3. 이번에 손대지 않은 것
- (2차에서 바꿈) 공용 기술 이름(`TRADITIONS.*.techNames`) — 10/14 상대 기술 표기를 없앤 뒤 화면에 안 뜨지만 같은 꼴로 바꿨다(§5).
- 인물 대사 · 메뉴 · 안내 글 — 다음 차례.
- 숨은 판(주소 스위치) 비기 이름: 비켜 서며 크게 가로베기 · 멈추지 않는 흐름은 이미 '뜻 (원어)' 꼴이라 그대로 · 옛 연환삼격은 2차에서 바꿈(§5).
- 일본 소리 표기 자체(추단 · 잔신 등)는 10/10 표기 그대로 — 꼴만 바꿨다. 스킬북 '잔심'만 패시브와 같게 '잔신'으로.

## 4. 바뀐 글 전부 (git diff 에서 뽑음 — 파일:줄 · 전 → 후)

| 자리 | 전 | 후 |
|---|---|---|
| `src/frames.js:72` | 조단 | 높이 들기 |
| `src/frames.js:72` | 칼자루를 이마 위로, 칼끝은 뒤로 눕힌다 · 한 칼로 내려벤다 | 한 칼로 내려벤다 |
| `src/frames.js:73` | 핫소 · 어깨 메기 | 어깨 메기 |
| `src/frames.js:73` | 칼자루를 오른 어깨 앞에 세우고 칼끝을 뒤로 · 사선으로 내려벤다 | 어깨에서 비스듬히 내려벤다 |
| `src/frames.js:74` | 왼 핫소 · 레베스 준비 | 왼 어깨 메기 |
| `src/frames.js:74` | 칼을 왼 어깨에 세운 자세 · 반대쪽 사선 베기 (revez) | 왼 어깨에서 비스듬히 내려벤다 |
| `src/frames.js:78` | 추단 | 가운데 겨눔 |
| `src/frames.js:78` | 칼끝을 상대 목에 두고 손은 배꼽 앞 · 무거운 칼을 오래 뻗지 않는다 | 무거운 칼을 오래 뻗지 않는다 |
| `src/frames.js:79` | 와키가마에 | 허리 뒤 숨김 |
| `src/frames.js:79` | 칼을 오른 허리 뒤로 숨겨 칼끝을 뒤 아래로 · 길이를 감춘다 | 칼 길이를 감춘다 |
| `src/frames.js:85` | 팔을 곧게 뻗어 칼끝으로 겨누고 몸을 옆으로 세운다 · 런지로 찌른다 | 뻗어 겨누고 런지로 찌른다 |
| `src/frames.js:86` | 손을 허리 바깥에, 칼끝은 상대 얼굴 · 바깥 선을 닫는다 | 바깥 선을 닫는다 |
| `src/frames.js:88` | 손바닥을 위로 돌려 안쪽 선에, 칼끝은 상대 얼굴 · 안쪽 선을 닫는다 | 안쪽 선을 닫는다 |
| `src/frames.js:106` | 팔을 뻗어 칼끝으로 상대 얼굴을 겨누고 몸을 옆으로 세운다 · 런지로 찌른다 | 뻗어 겨누고 런지로 찌른다 |
| `src/frames.js:107` | 손을 어깨 높이로 뻗고 손바닥을 아래로 · 칼끝은 상대 가슴 | 어깨 높이에서 가슴을 찌른다 |
| `src/frames.js:118` | 칼을 머리 위로 가로 눕힌다 · 위에서 오는 칼을 받아 곧바로 되벤다 | 머리 위로 받아 곧장 되벤다 |
| `src/frames.js:119` | 팔꿈치를 들어 손을 머리 높이로, 칼끝은 상대 가슴으로 늘어뜨린다 · 머리·어깨·가슴을 한 번에 덮는다 | 머리·어깨·가슴을 한 번에 덮는다 |
| `src/guards.js:25` | 칼을 머리 위로 세운 자세 · 위에서 내려베기 준비 | 머리 위에서 내려벤다 |
| `src/guards.js:27` | 칼을 오른 어깨에 얹은 자세 · 사선 베기 준비 | 어깨에서 비스듬히 내려벤다 |
| `src/guards.js:28` | 칼자루는 머리 옆, 칼끝은 상대 얼굴 · 찌르기 준비 | 머리 옆에서 얼굴을 찌른다 |
| `src/guards.js:29` | 팔을 쭉 뻗어 칼끝으로 겨눈 자세 | 칼끝을 뻗어 거리를 잰다 |
| `src/guards.js:31` | 칼을 옆으로 눕혀 뒤로 뺀 자세 · 가로베기 준비 | 옆으로 젖혀 가로로 벤다 |
| `src/guards.js:32` | 칼자루는 허리, 칼끝은 상대 얼굴 · 기본 자세 | 허리에서 겨누는 기본 자세 |
| `src/guards.js:33` | 칼끝을 오른쪽 아래로 · 올려베기 준비 | 아래에서 올려벤다 |
| `src/guards.js:34` | 칼을 오른쪽 뒤 아래로 숨긴 자세 | 칼을 뒤로 숨겨 길이를 감춘다 |
| `src/guards.js:35` | 칼끝을 땅으로 내린 자세 · 상대를 끌어들인다 | 빈틈을 보여 끌어들인다 |
| `src/guards.js:37` | 칼을 왼 어깨에 얹은 자세 · 반대쪽 사선 베기 준비 | 왼 어깨에서 비스듬히 내려벤다 |
| `src/guards.js:38` | 칼자루는 머리 왼쪽, 칼끝은 상대 얼굴 | 왼쪽 머리 옆에서 찌른다 |
| `src/guards.js:39` | 칼을 왼쪽으로 눕혀 뒤로 뺀 자세 · 반대쪽 가로베기 준비 | 왼쪽으로 젖혀 가로로 벤다 |
| `src/guards.js:40` | 칼자루는 왼 허리, 칼끝은 상대 얼굴 | 왼 허리에서 겨눈다 |
| `src/guards.js:41` | 칼끝을 왼쪽 아래로 · 사선 베기가 끝나는 자리 | 사선 베기가 끝나는 자리 |
| `src/guards.js:62` | 두 손을 머리 위로 들고 칼날을 아래로 돌려 쥐어 쓰러진 상대를 겨눈다 | 쓰러진 상대를 내려 겨눈다 |
| `src/guards.js:63` | 쓰러진 상대를 칼끝이 땅에 닿도록 찍는다 · 위에서 오면 내려베기 | 쓰러진 상대를 찍는다 |
| `src/gun.js:20` | 총이 저절로 상대를 겨누며 흔들린다 · 레이저가 몸에 걸린 순간 탭으로 쏜다 | 레이저가 몸에 걸리면 탭으로 쏜다 |
| `src/main.js:2226` | 고노센 준비 | 뒤에서 앞서기 준비 |
| `src/schools.js:120` | 조단 | 높은 자세 (조단) |
| `src/schools.js:120` | 두 손을 이마 위로 들고 칼끝은 뒤로 비스듬히, 왼발 앞 · 상대가 치려는 박자에 한 칼로 내려벤다 | 치려는 박자에 한 칼로 내려벤다 |
| `src/schools.js:122` | 핫소 | 어깨 세움 (핫소) |
| `src/schools.js:122` | 조단에서 오른 주먹을 오른 어깨까지 내린 꼴 · 날밑은 입 높이, 칼은 서고 날은 상대 쪽, 왼발 앞 | 어깨에 세워 비스듬히 내려벤다 |
| `src/schools.js:125` | 히키나가시 | 끌어 흘리기 (히키나가시) |
| `src/schools.js:125` | 칼끝으로 상대 눈을 찌를 듯 겨누며 손을 오른 어깨 앞으로 끌어 상대 칼을 흘려 받는다 · 왼쪽에서 올려벤 칼이 끝나는 자리 | 손을 끌어 상대 칼을 흘린다 |
| `src/schools.js:128` | 추단 | 가운데 겨눔 (추단) |
| `src/schools.js:128` | 칼끝을 상대 두 눈 사이에 두고 두 손은 배꼽 앞 · 오른발 앞, 몸은 바로 · 자세의 본뜻, 쉴 자세 | 칼끝을 두 눈 사이에 둔 기본 자세 |
| `src/schools.js:130` | 미기와키 | 오른 옆구리 (미기와키) |
| `src/schools.js:130` | 칼을 오른 어깨 높이에 가로로 눕힌다 · 받아서 조단으로 올려 곧장 내려벤다 (오모테 5) · 위나 옆이 막힌 곳의 자세 | 받아서 곧장 내려벤다 |
| `src/schools.js:133` | 히라세이간 | 눕힌 겨눔 (히라세이간) |
| `src/schools.js:133` | 추단에서 손을 조금 오른쪽·아래로 내리고 칼끝은 상대 왼눈 · 칼날을 오른쪽으로 비튼다 | 날을 비틀어 왼눈을 겨눈다 |
| `src/schools.js:135` | 우게조 | 오른 아래 감춤 (우게조) |
| `src/schools.js:135` | 친 칼을 오른쪽 아래로 감춘다 · 여기서 올려베거나 (키리아게) 다시 머리 위로 든다 | 여기서 올려베거나 다시 든다 |
| `src/schools.js:137` | 와키가마에 | 숨긴 칼 (와키가마에) |
| `src/schools.js:137` | 오른발을 뒤로 왼 반신, 칼을 오른 옆에 두고 칼끝은 뒤 아래로 · 칼 길이를 상대에게 감춘다 | 칼 길이를 상대에게 감춘다 |
| `src/schools.js:140` | 게단 | 낮은 겨눔 (게단) |
| `src/schools.js:140` | 손은 추단 그대로 두고 칼끝을 상대 무릎 조금 아래로 내린다 · 아래에서 상대 손을 친다 | 아래에서 상대 손을 친다 |
| `src/schools.js:145` | 사타이켄 | 왼 어깨 세움 (사타이켄) |
| `src/schools.js:145` | 왼손·왼발 쪽으로 칼을 들어 왼 어깨 위에 세운다 · 왼쪽 사선 베기가 지나는 자리 | 왼쪽 사선 베기가 지나는 자리 |
| `src/schools.js:148` | 우케나가시 | 흘려 받기 (우케나가시) |
| `src/schools.js:148` | 몸을 왼쪽으로 열며 칼을 왼쪽 위로 들어 상대 칼을 칼 옆면으로 흘린다 · 오른쪽 아래에서 올려벤 칼이 끝나는 자리 | 칼 옆면으로 상대 칼을 흘린다 |
| `src/schools.js:150` | 히다리와키 | 왼 옆구리 (히다리와키) |
| `src/schools.js:150` | 칼을 왼 옆구리에 가로로 · 아래에서 상대 손을 치고 내 어깨 위로 비스듬히 벤다 (오모테 4) | 아래에서 손을 치고 비스듬히 벤다 |
| `src/schools.js:152` | 사사에 | 받치기 (사사에) |
| `src/schools.js:152` | 두 손을 뻗어 칼끝을 왼쪽 아래로 비스듬히 · 칼 옆면으로 상대 찌르기를 받친다 (7본) | 칼 옆면으로 찌르기를 받친다 |
| `src/schools.js:154` | 사조 | 왼 아래 감춤 (사조) |
| `src/schools.js:154` | 칼끝을 왼쪽 아래로 감춘다 · 케사가 끝나는 자리, 여기서 갸쿠케사로 되올린다 | 여기서 비스듬히 되올린다 |
| `src/schools.js:205` | 츠바메가에시 | 제비 베기 (츠바메가에시) |
| `src/schools.js:207` | 코테 | 손목 치기 (코테) |
| `src/schools.js:210` | 코코 연타 | 범 타기 연타 (코코) |
| `src/schools.js:214` | 히라키기리 | 비껴 베기 (히라키기리) |
| `src/schools.js:218` | 오모테 5 | 다섯째 겉수 (오모테 5) |
| `src/schools.js:225` | 표두세 (豹頭勢) | 표범 머리 (豹頭勢 표두세) |
| `src/schools.js:225` | 높이 든 손에서 벼락같이 위로부터 친다 | 높이 든 칼로 벼락같이 내려친다 |
| `src/schools.js:226` | 우익세 (右翼勢) | 오른 날개 (右翼勢 우익세) |
| `src/schools.js:226` | 오른 날개 — 오른 어깨 높이에서 친다 | 오른 어깨 높이에서 벤다 |
| `src/schools.js:227` | 역린세 (逆鱗勢) | 턱밑 비늘 (逆鱗勢 역린세) |
| `src/schools.js:227` | 손을 어깨 높이에, 칼끝은 상대 목 줄로 곧게 · 비늘을 거슬러 목구멍·목을 곧게 찌른다 | 목을 곧게 찌른다 |
| `src/schools.js:228` | 직부송서 (直符送書) | 곧게 보내기 (直符送書 직부송서) |
| `src/schools.js:228` | 팔을 뻗어 칼끝을 가운데 높이로 곧게 보낸다 · 쉴 자세 | 칼끝을 곧게 뻗는 쉬는 자세 |
| `src/schools.js:229` | 요격세 (腰擊勢) | 허리 베기 (腰擊勢 요격세) |
| `src/schools.js:229` | 칼을 오른 허리 높이에 수평으로 눕혀 든다 · 허리를 가로질러 가운데를 친다 — 검 중 으뜸 치기 | 허리를 가로질러 벤다 |
| `src/schools.js:230` | 탄복세 (坦腹勢) | 배 겨눔 (坦腹勢 탄복세) |
| `src/schools.js:230` | 칼자루를 오른 허리에, 칼끝은 상대 배 높이로 수평 · 산이 무너지듯 나아가 가운데(배)를 찌른다 · 쉴 자세 안 B | 산이 무너지듯 나아가 배를 찌른다 |
| `src/schools.js:231` | 요략세 (撩掠勢) | 걷어 올리기 (撩掠勢 요략세) |
| `src/schools.js:231` | 칼을 낮게 앞으로 수평, 칼끝을 왼쪽으로 비껴 왼쪽을 가린다 · 걷어 올려 막고 아래로 친다 | 걷어 올려 막고 아래로 친다 |
| `src/schools.js:232` | 간수세 (看守勢) | 지켜보기 (看守勢 간수세) |
| `src/schools.js:232` | 호준 (虎蹲) — 웅크린 범처럼 몸을 낮추고 칼을 오른 아래에, 칼끝은 앞 아래로 · 굳게 지키며 살피다 기미를 따라 굴려 친다 | 웅크린 범처럼 낮게 기다린다 |
| `src/schools.js:233` | 점검세 (點劍勢) | 점 찍기 (點劍勢 점검세) |
| `src/schools.js:233` | 점 찍듯 찌른다 — 칼끝을 낮게 겨눈다 | 점 찍듯 낮게 찌른다 |
| `src/schools.js:234` | 좌익세 (左翼勢) | 왼 날개 (左翼勢 좌익세) |
| `src/schools.js:234` | 치켜 올렸다 눌러 상대 손아귀인 호구 (虎口)를 바로 친다 | 눌러서 상대 손아귀를 친다 |
| `src/schools.js:235` | 봉두세 (鳳頭勢) | 봉황 머리 (鳳頭勢 봉두세) |
| `src/schools.js:235` | 칼을 머리 높이에 비껴 든다 · 씻어 찌르고 얽어 친다 | 쳐내고 찌르고 끊어 벤다 |
| `src/schools.js:236` | 왼 요격세 (腰擊勢) | 왼 허리 베기 (腰擊勢 요격세) |
| `src/schools.js:236` | 왼쪽에서 허리를 가로질러 친다 — 오른쪽 요격 (腰擊)과 번갈아 | 왼쪽에서 허리를 가로질러 벤다 |
| `src/schools.js:237` | 좌협세 (左夾勢) | 왼 끼기 (左夾勢 좌협세) |
| `src/schools.js:237` | 칼자루를 왼 허리에 끼고 칼끝은 배 높이로 수평 · 가운데를 찌른다 | 왼 허리에 끼고 배를 찌른다 |
| `src/schools.js:238` | 과좌세 (跨左勢) | 왼 걸치기 (跨左勢 과좌세) |
| `src/schools.js:238` | 왼편을 걸쳐 쓸어 아래로 친다 | 왼편을 걸쳐 쓸어 내린다 |
| `src/schools.js:246` | 두 손을 머리 위로(날밑이 머리를 덮음), 칼은 어깨 뒤로 넘어가는 길 · 곧게 내려친다 | 머리 위에서 곧게 내려친다 |
| `src/schools.js:247` | 탈류 준비 (talho) | 오른 베기 준비 (talho) |
| `src/schools.js:247` | 손은 머리 오른쪽 높이, 칼은 오른 어깨 뒤로 늘어뜨려 칼끝은 땅 쪽 · 뒤에서 감아 비스듬히 벤다 | 뒤로 감았다가 오른쪽에서 벤다 |
| `src/schools.js:248` | 칼자루를 오른 귀 앞 높이에, 칼끝은 오른 대각으로 들어 · 올려 벤 레베스가 멈추는 자리 | 올려 벤 칼이 멈추는 자리 |
| `src/schools.js:249` | 칼을 얼굴 앞 가운데에 곧게 · 베기마다 여기 멈춘다 | 베기마다 여기서 멈춘다 |
| `src/schools.js:250` | 가로 탈류 (talho orizontal) | 오른 가로베기 (talho orizontal) |
| `src/schools.js:250` | 칼을 오른쪽 몸 가운데 높이에 눕혀 뒤로 감는다 · 가로로 벤다 | 몸 가운데 높이로 가로 벤다 |
| `src/schools.js:251` | 오른손을 허리띠 앞에, 칼은 오른 대각으로 비껴 · 찌르기를 받아 탈류로 쳐낸다 | 찌르기를 받아 쳐낸다 |
| `src/schools.js:252` | 아래 탈류 (talho de baxo) | 오른 올려베기 (talho de baxo) |
| `src/schools.js:252` | 오른쪽으로 떨어진 칼, 칼끝은 오른쪽 아래 뒤로 · 뒤에서 아래에서 위로 탈류를 올린다 | 아래에서 위로 벤다 |
| `src/schools.js:253` | 뒤 탈류 (talho por detras) | 뒤에서 오른 베기 (talho por detras) |
| `src/schools.js:253` | 칼이 오른 옆구리를 휘감아 뒤로 · 뒤에서 앞으로 탈류 | 옆구리를 휘감아 뒤에서 벤다 |
| `src/schools.js:254` | 몸을 곧게, 칼끝을 앞 땅으로 · 모든 규칙이 여기서 시작해 여기로 끝난다 | 모든 규칙이 여기서 시작해 끝난다 |
| `src/schools.js:255` | 레베스 준비 (revez) | 왼 베기 준비 (revez) |
| `src/schools.js:255` | 머리 위로 넘긴 칼을 왼 어깨에 떨군다 · 왼쪽에서 감아 벤다 | 왼 어깨에서 감아 벤다 |
| `src/schools.js:256` | 칼을 머리 앞 왼쪽 높이에 비껴 멈춘다 | 머리 앞 왼쪽에 비껴 멈춘다 |
| `src/schools.js:257` | 가로 레베스 (revez orizontal) | 왼 가로베기 (revez orizontal) |
| `src/schools.js:257` | 오른팔이 엇갈려 칼을 왼쪽 몸 가운데 높이에 뒤로 감는다 · 왼쪽에서 가로로 벤다 | 왼쪽에서 가로로 벤다 |
| `src/schools.js:258` | 칼을 왼 대각으로 비껴 · 찌르기를 레베스로 쳐낸다 | 찌르기를 왼쪽으로 쳐낸다 |
| `src/schools.js:259` | 아래 레베스 (revez de baxo) | 왼 올려베기 (revez de baxo) |
| `src/schools.js:259` | 왼쪽으로 떨군 칼(오른팔이 왼팔 위로 엇갈림), 칼끝은 왼쪽 아래 뒤로 · 아래에서 위로 레베스를 올린다 | 왼쪽 아래에서 올려벤다 |
| `src/schools.js:264` | 칼을 머리 위로 · 위에서 곧게 내려벤다 | 위에서 곧게 내려벤다 |
| `src/schools.js:265` | 칼을 오른 어깨에 메어 칼날은 뒤로 · 비스듬히 내려벤다 | 어깨에서 비스듬히 내려벤다 |
| `src/schools.js:266` | 칼자루를 머리 오른쪽에, 칼끝은 상대 얼굴 · 위에서 찌른다 | 위에서 찌른다 |
| `src/schools.js:267` | 팔을 쭉 뻗어 칼끝으로 겨눈다 · 막기가 끝나는 자리 | 막기가 끝나는 자리 |
| `src/schools.js:268` | 칼을 오른 옆 뒤로 눕힌다 · 가로로 벤다 (가운데 베기) | 가로로 벤다 |
| `src/schools.js:269` | 칼자루를 오른 허리 아래에, 칼끝은 상대 얼굴 · 아래에서 찌르고 올려벤다 | 아래에서 찌르고 올려벤다 |
| `src/schools.js:270` | 칼끝을 오른쪽 아래 땅으로 · 올려베기 준비 | 아래에서 올려벤다 |
| `src/schools.js:271` | 칼을 오른 허리 뒤로 숨긴다 | 칼을 허리 뒤로 숨긴다 |
| `src/schools.js:272` | 칼끝을 앞 땅으로 멀리 · 아래를 막고 올려친다 | 아래를 막고 올려친다 |
| `src/schools.js:273` | 칼을 왼 어깨에 메어 칼날은 뒤로 · 왼쪽에서 비스듬히 내려벤다 | 왼쪽에서 비스듬히 내려벤다 |
| `src/schools.js:274` | 칼자루를 머리 왼쪽에, 칼끝은 상대 얼굴 | 왼쪽 위에서 찌른다 |
| `src/schools.js:275` | 가로베기가 끝나 칼이 왼 옆에 눕는다 · 되받아 가로로 | 왼쪽에서 되받아 가로 벤다 |
| `src/schools.js:276` | 칼자루를 왼 허리에, 칼끝은 상대 얼굴 | 왼 허리에서 겨눈다 |
| `src/schools.js:277` | 칼끝을 왼쪽 아래로 · 분노의 베기가 끝나는 자리 | 분노의 베기가 끝나는 자리 |
| `src/schools.js:281` | 머리 위로 높이 든다 · 내려친다 | 높이 들어 내려친다 |
| `src/schools.js:282` | 오른 어깨에 메어 끝을 뒤로 · 비스듬히 내려친다 | 어깨에서 비스듬히 내려친다 |
| `src/schools.js:283` | 손을 머리 오른쪽에, 끝은 상대 얼굴 | 머리 옆에서 얼굴을 겨눈다 |
| `src/schools.js:284` | 끝을 상대에게 곧게 겨눈다 · 쉴 때 돌아오는 자리 | 쉴 때 돌아오는 자리 |
| `src/schools.js:285` | 오른쪽 뒤로 젖혀 둔다 · 옆으로 후려친다 | 옆으로 후려친다 |
| `src/schools.js:286` | 손을 오른 허리에, 끝은 상대 얼굴 | 허리에서 얼굴을 겨눈다 |
| `src/schools.js:287` | 끝을 오른쪽 아래로 · 올려친다 | 아래에서 올려친다 |
| `src/schools.js:288` | 오른 허리 뒤로 숨겨 길이를 감춘다 | 칼 길이를 감춘다 |
| `src/schools.js:289` | 끝을 앞 아래로 늘어뜨린다 · 머리를 비워 끌어들인다 | 머리를 비워 끌어들인다 |
| `src/schools.js:290` | 왼 어깨에 메어 끝을 뒤로 · 반대쪽으로 비스듬히 내려친다 | 왼 어깨에서 비스듬히 내려친다 |
| `src/schools.js:291` | 손을 머리 왼쪽에, 끝은 상대 얼굴 | 왼쪽 머리 옆에서 겨눈다 |
| `src/schools.js:292` | 왼쪽 뒤로 젖혀 둔다 · 반대쪽으로 후려친다 | 반대쪽으로 후려친다 |
| `src/schools.js:293` | 손을 왼 허리에, 끝은 상대 얼굴 | 왼 허리에서 겨눈다 |
| `src/schools.js:294` | 끝을 왼쪽 아래로 · 내려친 끝, 여기서 되올린다 | 내려친 끝, 여기서 되올린다 |
| `src/schools.js:437` | 요격 (腰擊) | 허리 베기 (腰擊 요격) |
| `src/schools.js:439` | 좌익격 (左翼擊) | 왼 날개 치기 (左翼擊 좌익격) |
| `src/schools.js:445` | 체보요격 (掣步腰擊) | 끌어 딛고 허리 베기 (掣步腰擊 체보요격) |
| `src/schools.js:526` | 위아래 사슬 (altibaxo) | 위아래 베기 (altibaxo) |
| `src/schools.js:534` | 둥근 걸음 탈류 (talho rodeado) | 돌며 베기 (talho rodeado) |
| `src/schools.js:564` | 맞물림에서 빼 찌르기 (cavazione) | 빼서 찌르기 (cavazione) |
| `src/schools.js:586` | 잔신 | 남은 마음 (잔신) |
| `src/schools.js:588` | 데바나 | 나설 때 치기 (데바나) |
| `src/schools.js:590` | 카에시 | 되받아 치기 (카에시) |
| `src/schools.js:596` | 자→격 (刺→擊) 고리 | 찌르고 이어 베기 (刺→擊 자→격) |
| `src/schools.js:623` | 박자 밑 찌르기 (passata in contratempo) | 엇박 찌르기 (passata in contratempo) |
| `src/schools.js:713` | 고노센 | 뒤에서 앞서기 (고노센) |
| `src/schools.js:747` | 요격 (腰擊) | 허리 베기 (腰擊 요격) |
| `src/schools.js:749` | 요략 (撩掠) · 걷어 올려 베기 | 걷어 올려 베기 (撩掠 요략) |
| `src/schools.js:750` | 탄복자 (坦腹刺) | 배 찌르기 (坦腹刺 탄복자) |
| `src/schools.js:775` | 연환 (連環) | 이어 치기 (連環 연환) |
| `src/schools.js:775` | 연환삼격 (連環三擊) | 세 번 이어 치기 (連環三擊 연환삼격) |
| `src/schools.js:796` | 거정격 → 요격 → 역린자 | 솥 들기 → 허리 베기 → 목 찌르기 |
| `src/schools.js:800` | 요격 (腰擊) · 당겨 벰 | 당겨 허리 베기 (腰擊 요격) |
| `src/schools.js:801` | 역린자 (逆鱗刺) | 목 찌르기 (逆鱗刺 역린자) |
| `src/schools.js:808` | 표두세 → 역린자 → 좌익격 | 표범 머리 → 목 찌르기 → 왼 날개 치기 |
| `src/schools.js:819` | 봉두세 → 찌름(刺) → 끊어 벰(剪) | 봉황 머리 → 찌르기 → 끊어 베기 |
| `src/schools.js:832` | 역린자 (逆鱗刺) | 목 찌르기 (逆鱗刺 역린자) |
| `src/schools.js:833` | 좌익격 (左翼擊) | 왼 날개 치기 (左翼擊 좌익격) |
| `src/schools.js:836` | 찌름 (刺) | 찌르기 (刺 자) |
| `src/schools.js:837` | 끊어 벰 (剪) | 끊어 베기 (剪 전) |
| `src/schools.js:851` | 거정격 → 중살 → 역린자 → 퇴보 요격 | 솥 들기 → 내려 베기 → 목 찌르기 → 물러 허리 베기 |
| `src/schools.js:851` | 표두세 → 역린자 → 우익 → 철보 좌익격 | 표범 머리 → 목 찌르기 → 오른 날개 → 물러 왼 날개 |
| `src/schools.js:851` | 봉두세 → 찌름(刺) → 끊어 벰(剪) → 물러 벰(殺) | 봉황 머리 → 찌르기 → 끊어 베기 → 물러 베기 |
| `src/schools.js:855` | 중살 (中殺) · 내려 벰 | 내려 베기 (中殺 중살) |
| `src/schools.js:856` | 역린자 (逆鱗刺) | 목 찌르기 (逆鱗刺 역린자) |
| `src/schools.js:857` | 퇴보 요격 (退步腰擊) | 물러 허리 베기 (退步腰擊 퇴보요격) |
| `src/schools.js:862` | 역린자 (逆鱗刺) | 목 찌르기 (逆鱗刺 역린자) |
| `src/schools.js:863` | 우익 (右翼) | 오른 날개 (右翼 우익) |
| `src/schools.js:864` | 철보 좌익격 (掣步左翼擊) | 물러 왼 날개 치기 (掣步左翼擊 체보좌익격) |
| `src/schools.js:869` | 찌름 (刺) | 찌르기 (刺 자) |
| `src/schools.js:870` | 끊어 벰 (剪) | 끊어 베기 (剪 전) |
| `src/schools.js:871` | 물러 벰 (殺) | 물러 베기 (殺 살) |
| `src/schools.js:930` | 요격 (腰擊) | 허리 베기 (腰擊 요격) |
| `src/schools.js:931` | 탄복자 (坦腹刺) | 배 찌르기 (坦腹刺 탄복자) |
| `src/schools.js:932` | 역린자 (逆鱗刺) | 목 찌르기 (逆鱗刺 역린자) |
| `src/schools.js:991` | 칼자루를 머리 위로 높이 들고 코등이를 가로로 세워 위에서 떨어지는 칼을 코등이·밑동으로 받는다 · 거기서 뛰어든다 | 칼자루로 받고 그대로 뛰어든다 |
| `src/schools.js:1022` | 팔을 앞·위로 뻗어 손을 얼굴 높이에, 칼끝은 곧게 상대에게 · 몸을 숙인다 · 팔이 쉬 지친다 | 위에서 내려 찌르는 자세 |
| `src/schools.js:1024` | 팔을 뻗어 손을 어깨 높이에, 손바닥을 아래로 · 칼끝은 곧게 상대에게 | 어깨 높이에서 곧게 찌른다 |
| `src/schools.js:1026` | 칼 팔을 조금 굽혀 손을 몸 가운데 높이에, 칼끝은 상대 몸 가운데 · 몸을 옆으로 세워 뒤로 기댄다 · 여기서 찌른다 (stoccata) | 가운데를 지키는 으뜸 자세 |
| `src/schools.js:1028` | 팔을 곧게 뻗어 칼끝으로 상대 얼굴을 겨눈다 · 찌르기가 끝나는 자리 | 찌르기가 끝나는 자리 |
| `src/schools.js:1030` | 손바닥을 위로 돌려 팔을 안쪽 줄로 뻗는다 · 칼끝은 곧게 상대에게 | 안쪽 줄을 닫고 찌른다 |
| `src/schools.js:1153` | 우케나가시 (受け流し) | 흘려 받기 (우케나가시) |
| `src/schools.js:1153` | 두 손을 머리 앞으로 높이 들고 칼끝을 오른쪽 뒤로 조금 낮춰 지붕처럼 받는다 · 떨어지는 칼이 칼등을 타고 미끄러져 흘러내린다 | 머리 위로 오는 칼을 흘려 받는다 |
| `src/schools.js:1177` | 팔을 곧게 뻗어 칼자루를 어깨 높이 바깥에, 손바닥은 아래로 · 칼끝은 곧게 상대에게 — 칼 가운데 ~ 코등이(forte)로 받는다 | 뻗은 칼 밑동으로 받는다 |
| `src/schools.js:1178` | 팔을 곧게 뻗어 칼끝으로 상대 얼굴을 겨눈다 · 곧은 줄로 치며 막는다 — 곧게 뻗은 칼의 forte 가 몸을 가린다 | 곧은 줄로 치며 막는다 |
| `src/schools.js:1208` | 칼을 뽑아 든 그대로 손을 오른 어깨 앞 높이에, 칼끝은 상대 쪽으로 내려 온몸을 덮는다 · 위에서 찌른다 | 칼을 뽑아 든 그대로의 자세 |
| `src/schools.js:1210` | 팔을 오른 바깥으로 넓게 벌리되 칼끝은 안쪽으로 굽혀 상대를 겨눈다 | 팔을 넓게 벌리고 겨눈다 |
| `src/schools.js:1213` | 손을 오른 무릎 바깥 쪽 아래로 내리고 칼끝은 상대 쪽 조금 아래 · 밑으로 들어가 찌르기 (passata sotto)가 여기서 나간다 | 밑으로 들어가 찌른다 |
| `src/schools.js:1215` | 손을 오른 허리 곁으로 당겨 팔을 굽히고 칼끝은 상대 쪽 · 3번 자세에서 손만 당긴 꼴 | 손을 당겨 찌를 힘을 모은다 |
| `src/schools.js:1216` | 팔을 앞으로 내리고 칼끝을 낮게 상대 쪽으로 · 밑으로 들어가 찌른 칼이 머무는 자리 | 밑으로 찌른 칼이 머무는 자리 |
| `src/schools.js:1218` | 손바닥을 위로 돌려 손을 왼 어깨 앞 높이에, 칼끝은 상대 쪽 | 왼 어깨 앞에서 안쪽을 겨눈다 |
| `src/schools.js:1219` | 손바닥을 위로 돌려 손을 머리 높이 안쪽에, 칼끝은 상대 쪽 | 머리 높이에서 안쪽을 겨눈다 |
| `src/schools.js:1221` | 팔을 굽혀 손을 안쪽 가슴 높이에, 손바닥은 위로 · 칼끝은 상대 쪽 | 가슴 높이에서 안쪽을 겨눈다 |
| `src/schools.js:1223` | 손바닥을 위로 돌려 손을 안쪽 넓적다리 높이로 내리고 칼끝은 상대 쪽 조금 아래 | 낮게 안쪽을 겨눈다 |
| `src/schools.js:1248` | 탈류 쳐내기 (talho) | 오른 쳐내기 (talho) |
| `src/schools.js:1248` | 왼쪽으로 오는 칼을 오른 어깨에서 비스듬히 베어 쳐낸다 · 쳐낸 칼은 머리 앞 왼쪽에 비스듬히 선다 | 왼쪽으로 오는 칼을 베어 쳐낸다 |
| `src/schools.js:1252` | 레베스 쳐내기 (revés) | 왼 쳐내기 (revés) |
| `src/schools.js:1252` | 오른쪽으로 오는 칼을 왼 어깨에서 비스듬히 베어 쳐낸다 · 쳐낸 칼은 머리 앞 오른쪽에 비스듬히 선다 | 오른쪽으로 오는 칼을 베어 쳐낸다 |
| `src/schools.js:1272` | 거정세 (擧鼎勢) | 솥 들기 (擧鼎勢 거정세) |
| `src/schools.js:1272` | 솥을 들어 올리듯 칼을 머리 위로 가로 들어 위에서 오는 칼을 받는다 · 거정격 | 머리 위로 가로 들어 받는다 |
| `src/schools.js:1276` | 어거세 (御車勢) | 수레 몰기 (御車勢 어거세) |
| `src/schools.js:1276` | 고삐를 쥔 듯 손을 가슴 앞으로 내밀고 칼끝을 앞 위로 세워 가운데로 오는 칼을 위아래로 눌러 다스린다 · 어거격 | 가운데로 오는 칼을 눌러 막는다 |
| `src/schools.js:1286` | 요략세 (撩掠勢) | 걷어 올리기 (撩掠勢 요략세) |
| `src/schools.js:1286` | 칼자루를 배꼽 아래 앞에 두고 칼끝을 왼 앞 아래로 드리워 왼 다리까지 가린다 — 아래에서 걷어 올라오는 칼을 덮어 받는다 · 요략격 「왼쪽을 가리고 오른쪽을 지킨다」 | 아래로 오는 칼을 걷어 올린다 |
| `src/skill_books.js:42` | 리히테나워 전승(14세기) · 걸음은 마이어 1570 I.23v | 리히테나워 전승(14세기) · 요아힘 마이어(1570) |
| `src/skill_books.js:46` | 링게크 주해 · 마이어(1570) — 게임 해석 | 링게크 주해 · 마이어(1570) |
| `src/skill_books.js:53` | 카포 페로(1610) 박자·낮은 찌르기 — 게임 해석 | 카포 페로(1610)의 박자와 낮은 찌르기 |
| `src/skill_books.js:60` | 피게이레두 규칙 VII · XI — 게임 해석 | 피게이레두(1651) 규칙 7 · 11 |
| `src/skill_books.js:66` | 잔심 | 잔신 |
| `src/skill_books.js:67` | 받아서 먼저 치는 박자의 전승 — 게임 해석 | 받아서 먼저 치는 박자의 전승 |
| `src/skill_books.js:74` | 조선세법의 이어 치기 — 게임 해석 | 조선세법의 이어 치기 |
| `src/skill_books.js:80` | 뒤로 박차는 첫걸음 · 상대가 헛치면 간격 잡기 | 뒤로 박차 빠지고, 헛친 상대와 거리를 잰다 |
| `src/skill_books.js:81` | 짧은 디딤 둘 · 긴 디딤 둘을 번갈아 밟는 박자 걸음 | 짧게 둘, 길게 둘 — 박자를 타는 걸음 |
| `src/skill_books.js:82` | 넓은 보폭 · 옆으로 박차는 첫걸음 | 넓은 보폭으로 옆으로 박차 돈다 |
| `src/skill_books.js:83` | 낮은 자세 · 흔들려도 버티는 몸 | 낮게 깔려 흔들려도 버티는 몸 |
| `src/skill_books.js:87` | (5줄) | (18줄 — 덩이 바뀜) |
| `src/skill_books.js:119` | 고유 공격 넷이 한꺼번에 열린다 | 고유 공격 넷을 쓸 수 있다 |
| `src/skill_books.js:123` | 개발 예정 — 사람이 쓰는 패시브는 아직 없다 | 준비 중 |
| `src/skill_books.js:125` | ${short(T.secret?.nameKo)} |  |
| `src/skill_tree.js:142` |  (임시) ·  |  |
| `src/unique_assist.js:75` |  | 날개 접기 (斂翅 염시) |
| `src/unique_assist.js:77` | 자→격 (刺→擊) | 찌르고 베기 (刺→擊 자→격) |
| `src/weapons.js:407` | 두 손으로 쥐는 균형 잡힌 장검. / 베기도 찌르기도 두루 잘한다. | 중세 말 독일 검객들이 익히던 양손 장검. / 리히테나워는 그 비결을 수수께끼 같은 시로 남겼다. |
| `src/weapons.js:464` | 정예 용병이 쓰던 거대한 양손검. / 느리지만 맞으면 묵직하게 부순다. | 두 배 급료를 받고 창 숲 맨 앞을 깨던 용병의 칼. / 느리지만 맞으면 묵직하게 부순다. |
| `src/weapons.js:526` | 갑옷 틈을 파고드는 찌르기검. / 찌르기로 싸워야 제값을 한다. | 판금 갑옷의 틈을 찌르려 날 대신 끝을 벼린 칼. / 찌르기로 싸워야 제값을 한다. |
| `src/weapons.js:562` | 가볍게 휘어진 기병의 한손 칼. / 빠르게 베고 빠지기 좋다. | 말 위에서 내리베기 좋게 휘어진 기병의 칼. / 빠르게 베고 빠진다. |
| `src/weapons.js:608` | 길고 가는 르네상스 결투검. / 가장 빨리 찌르지만 베기는 약하다. | 르네상스 신사들이 평상복에 차고 다니던 결투검. / 가장 빨리 찌르지만 베기는 약하다. |
| `src/weapons.js:652` | 끝이 넓고 무거운 외날 칼. / 내려찍듯 베면 도끼처럼 들어간다. | 잉글랜드의 한 가문은 이 칼로 용을 베었다고 전한다. / 내려찍듯 베면 도끼처럼 들어간다. |
| `src/weapons.js:704` | 사사키 코지로의 노다치. / 빨랫줄 장대라 불린 칼, 매섭게 벤다. | 간류지마에서 무사시와 겨룬 사사키 코지로의 긴 칼. / 빨래 장대라 불릴 만큼 길었다. |
| `src/weapons.js:781` | 무사가 허리에 꽂던 보통 크기의 카타나. / 한 칼에 내려벤다. | 날을 위로 하여 허리띠에 꽂던 무사의 칼. / 뽑는 동작이 곧 베기다. |
| `src/weapons.js:842` | 쇠도 진흙처럼 벤다던 전설의 검. / 가볍고 빠른 한손 양날검. | 장판파에서 조자룡이 조조의 장수에게서 빼앗은 보검. / 쇠를 진흙처럼 벤다. |
| `src/weapons.js:953` | 금빛 기운이 감도는 진짜 왕의 검. | 호수의 여인이 아서왕에게 내린 왕의 검. / 금빛 기운이 감돈다. |
| `src/weapons.js:1205` | 가시 박은 쇠 공을 자루 끝에 단 둔기. / 갑옷 위로도 충격이 들어가고 투구를 벗긴다. | 독일 말로 ‘샛별’. 가시 돋친 쇠머리를 별에 빗댔다. / 갑옷 위로도 충격이 들어가고 투구를 벗긴다. |
| `src/weapons.js:1372` | 막야와 한 쌍인 회금빛 귀갑문 명검. / 전체 95 cm, 질량 0.95 kg의 한손 양날검. | 오나라 대장장이 간장이 아내 막야와 벼린 한 쌍의 칼. / 거북 등 무늬가 회금빛으로 감돈다. |
| `src/weapons.js:1374` | 간장과 한 쌍인 은빛 물결무늬 명검. / 전체 91 cm, 질량 1.12 kg의 한손 양날검. | 쇠가 녹지 않자 막야는 머리카락과 손톱을 화로에 던졌다. / 은빛 물결무늬가 감도는 간장의 짝. |
| `src/weapons.js:1395` | 별자리와 금은 명문을 새긴 의례검. / 전체 100 cm, 질량 1 kg의 한손 양날검. | 범의 해·달·날·시에 벼린 조선 왕실의 벽사검. / 칼몸에 새긴 별자리가 삿된 것을 벤다. |
| `src/weapons.js:1420` | 세 줄의 홈과 황동 장식을 지닌 대검. / 전체 168 cm, 질량 3.5 kg의 양손검. | 세 줄의 홈과 황동 장식을 지닌 북부의 대검. / 두 손으로도 버거울 만큼 무겁다. |
| `src/weapons.js:1473` | 불꽃처럼 물결치는 날을 지닌 대검. / 전체 169 cm, 질량 3.0 kg의 양손검. | 독일 용병 란츠크네히트가 들던 불꽃 날 대검. / 물결 날은 벼리기 어려워 값비싼 칼이었다. |
| `src/weapons.js:1510` | 월왕 구천의 청동검. / 전체 85 cm, 1.21 kg의 한손검. | 이천오백 년을 묻혀 있고도 녹슬지 않은 월왕의 청동검. / 복수의 저주를 받아 다칠수록 매서워진다. |

## 5. 2차 — 열쇠로 쓰이던 이름까지 (사장님 10/19 01:5x)

- 원문: "일부 자세 이름은 코드가 참조하는 키값이라, 고쳐도 되는 칸만 선별하는 중 -> 아니 전체를 대상으로 고치고, 그에 따라 코드까지 고쳐버려. 건슬링어의 리볼버랑 황약사의 검처럼 특정 에픽은 내가 써둔 거야. 그런 애들은 고칠 필요 없어."
- 열쇠 이름은 따옴표째 저장소 전체(src · tools)에서 한꺼번에 바꿨다 — 자세표 열쇠 · 몸 틀 표 · 도구가 같이 바뀐다. 바꾼 뒤 옛 이름이 코드(주석 밖)에 남은 곳 0. 판 결과(시뮬 해시)는 관문에서 확인.
- 무기 설명: 사장님이 쓴 넷은 처음부터 손대지 않았다(1차 그대로).

| 자리 (바꾼 수) | 갈래 | 전 | 후 |
|---|---|---|---|
| src/guards.js 7 · src/frames.js 1 · src/schools.js 7 · tools/browser/motion_gallery.mjs 1 · tools/sim/qinggang_swing_wrap.mjs 1 · tools/sim/qinggang_diag.mjs 1 · tools/motion/lib/clip_rules.mjs 1 | 기본 자세 이름(열쇠) | 왼쪽 어깨 지붕 | 왼 어깨 지붕 (Vom Tag) |
| src/guards.js 5 · src/schools.js 7 · tools/browser/motion_gallery.mjs 1 · tools/motion/lib/clip_rules.mjs 1 | 기본 자세 이름(열쇠) | 왼쪽 황소 | 왼 황소 (Ochs) |
| src/guards.js 7 · src/schools.js 10 · tools/browser/motion_gallery.mjs 1 · tools/sim/qinggang_swing_wrap.mjs 1 · tools/sim/qinggang_diag.mjs 1 · tools/motion/lib/clip_rules.mjs 1 | 기본 자세 이름(열쇠) | 왼쪽 옆 자세 | 왼 옆 자세 |
| src/guards.js 5 · src/frames.js 1 · src/schools.js 7 · tools/browser/motion_gallery.mjs 1 · tools/motion/lib/clip_rules.mjs 1 | 기본 자세 이름(열쇠) | 왼쪽 쟁기 | 왼 쟁기 (Pflug) |
| src/guards.js 6 · src/frames.js 1 · src/schools.js 7 · tools/browser/motion_gallery.mjs 1 · tools/sim/qinggang_swing_wrap.mjs 1 · tools/sim/qinggang_diag.mjs 1 · tools/motion/lib/clip_rules.mjs 1 | 기본 자세 이름(열쇠) | 왼쪽 바꿈 | 왼 바꿈 (Wechsel) |
| src/schools.js 1 | 속임수 이름(열쇠) | cavazione (위 찌르는 척 → 밑으로 돌려 찌름) | 칼끝 돌려 빼기 (cavazione) |
| src/schools.js 1 | 속임수 이름(열쇠) | 염시 (斂翅) · 찌르는 척 → 거둬 요격 | 날개 접기 (斂翅 염시) |
| src/schools.js 1 | 속임수 이름(열쇠) | 갓토츠 | 외쳐 치기 (갓토츠) |
| src/schools.js 1 | 속임수 이름(열쇠) | 니노코시 | 두 박자 치기 (니노코시) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 왼 분노의 베기 | 왼 분노의 베기 (Zornhau) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 정수리 베기 (Oberhau·Scheitelhau 꼴) | 정수리 베기 (Scheitelhau) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 왼 가로베기 | 왼 가로베기 (Zwerchhau) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 왼 올려베기 | 왼 올려베기 (Unterhau) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 왼 쟁기 찌르기 | 왼 쟁기 찌르기 (Pflug) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 왼 황소 찌르기 | 왼 황소 찌르기 (Ochs) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 분노의 베기 좌우 이어 (Zornhau 8자) | 좌우 이어 베기 (Zornhau) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 손 베기 (Abschneiden 꼴) | 손 끊기 (Abschneiden) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 돌려 베기 (Radschlag 꼴) | 바퀴 베기 (Radschlag) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | mandritto squalembrato (오른쪽 사선 내려베기) | 오른 사선 내려베기 (mandritto squalembrato) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | riverso squalembrato (왼쪽 사선) | 왼 사선 내려베기 (riverso squalembrato) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | fendente (곧게 내려베기) | 곧게 내려베기 (fendente) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | mandritto tondo (가로) | 오른 가로베기 (mandritto tondo) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | riverso tondo | 왼 가로베기 (riverso tondo) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | montante (올려베기 — 이탈리아 말) | 올려베기 (montante) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | riverso montante | 왼 올려베기 (riverso montante) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | stoccata (terza 에서 아래로부터) | 아래서 찌르기 (stoccata) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | punta riversa (quarta 에서) | 안쪽 찌르기 (punta riversa) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | punta dritta alta (seconda) | 높이 찌르기 (punta dritta alta) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | punta riversa alta | 왼 높이 찌르기 (punta riversa alta) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | stoccata bassa | 낮게 찌르기 (stoccata bassa) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | mandritto e riverso | 좌우 이어 베기 (mandritto e riverso) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | stramazzone (손목 끝 베기) | 손목 끝 베기 (stramazzone) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | molinello | 돌려 베기 (molinello) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | talho (오른쪽 사선) | 오른 사선 베기 (talho) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | revez (왼쪽 사선) | 왼 사선 베기 (revez) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | altibaxo (위에서 아래로) | 내려베기 (altibaxo) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | talho horizontal | 오른 가로베기 (talho orizontal) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | revez horizontal | 왼 가로베기 (revez orizontal) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | talho de baxo (올려베기) | 오른 올려베기 (talho de baxo) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | revez de baxo | 왼 올려베기 (revez de baxo) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | estocada | 찌르기 (estocada) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | estocada (왼쪽) | 왼 찌르기 (estocada) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | estocada alta | 높이 찌르기 (estocada alta) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | estocada alta (왼쪽) | 왼 높이 찌르기 (estocada alta) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | estocada baixa | 낮게 찌르기 (estocada baixa) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | talho e revez (규칙 Ⅰ) | 좌우 이어 베기 (talho e revez) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | talho curto (손 베기) | 짧게 손 베기 (talho curto) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | molinete | 돌려 베기 (molinete) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 케사기리 | 사선 베기 (케사기리) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 히다리케사 | 왼 사선 베기 (히다리케사) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 맛코 (정수리 베기) · 쇼멘우치 | 정수리 베기 (쇼멘우치) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 도 | 허리 베기 (도) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 갸쿠도 | 왼 허리 베기 (갸쿠도) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 키리아게 | 올려베기 (키리아게) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 갸쿠케사 | 왼 올려베기 (갸쿠케사) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 츠키 (세이간에서) | 찌르기 (츠키) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 츠키 (왼 허리에서) | 왼 허리 찌르기 (츠키) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 츠키 (머리 옆에서) | 높이 찌르기 (츠키) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 츠키 (왼 머리 옆에서) | 왼 높이 찌르기 (츠키) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 츠키 (게단에서) | 아래서 찌르기 (츠키) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 사유스이켄다 | 좌우 이어 베기 (사유스이켄다) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 카타테코테 | 한 손 손목 치기 (카타테코테) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 손목 돌려 베기 (원전 없음) | 손목 돌려 베기 |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 과우격 (跨右擊) | 오른 걸쳐 치기 (跨右擊 과우격) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 과좌격 (跨左擊) | 왼 걸쳐 치기 (跨左擊 과좌격) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 표두격 (豹頭擊) | 표범 머리 치기 (豹頭擊 표두격) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 좌요격 (左腰擊) | 왼 허리 베기 (左腰擊 좌요격) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 요략 (撩掠) | 걷어 올려 베기 (撩掠 요략) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 흔격 (掀擊) | 치켜 올려 치기 (掀擊 흔격) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 좌협자 (左夾刺) | 왼 끼고 찌르기 (左夾刺 좌협자) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 우협자 (右夾刺) | 오른 끼고 찌르기 (右夾刺 우협자) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 점검 (點劍) | 점 찍어 찌르기 (點劍 점검) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 과좌·과우 (跨左·跨右) 번갈아 | 좌우 걸쳐 치기 (跨左·跨右 과좌·과우) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 어거 (御車) 손 깎기 | 손 깎기 (御車 어거) |
| src/schools.js TECH_NAMES | 공용 기술 이름(화면에 안 뜸) | 살화개정 (撒花蓋頂) | 꽃 뿌려 머리 덮기 (撒花蓋頂 살화개정) |
| src/schools.js CHINESE_SECRET (옛 판) | 비기(숨은 판) | 옛 연환삼격 (첫 칼이 맞으면 잇는 판) · 가칭 | 첫 칼 이어 치기 (連環三擊 연환삼격) |

## 6. 3차 — 모든 유파 한글 소리 · 원어는 스킬북에서만 · 무기 스펙은 아이템 창에서만 (사장님 10/19 02:0x)

- 원문: "일본어처럼 다른 유파도 모두 독음 방식으로 바꾸자. 대기실 스킬북애서만 원어 병기. 무기는 대기실 아이탬 창에서만 스펙 병기. 원래 정해진 설명 뒤에 한 칸 띄고 (무기 종류(예를 들어 한손검, 길이, 무기)"
- 이름 = **'뜻 (한글 소리)'** — 모든 유파. 서양은 원어 발음을 한글로(외래어 표기 — 독일 Zornhau → 초른하우 · 이탈리아 imbroccata → 임브로카타 · 포르투갈 talho → 탈류), 동방은 한국 한자음(腰擊 → 요격), 일본은 그대로(코테). 싸움 화면 · 자세 칸 · 기술 칸 어디에도 원어 글자가 없다.
- **원어는 대기실 스킬북에서만**: 책 제목 '보법: 리히테나워 (Liechtenauer)' · 비기 '비기: 받아 베기 (페어제첸 · Versetzen)' · 고유 공격 목록 '굽은 베기 (크룸프하우 · Krumphau)' · 일본은 원어 글자 그대로(뒤에서 앞서기 (고노센 · 後の先)). 원어는 자료의 `orig` 칸(고유 동작 · 패시브 · 비기 · 사람 고유 동작 표)과 `src/skill_books.js` `BOOK_ORIG` 에 있고 `bookLabel` 이 붙인다. 표기 검사기는 `orig` 를 읽지 않는다(스킬북 전용).
- **무기 스펙은 대기실 아이템 창에서만**: 설명 뒤에 한 칸 띄고 '(종류, 길이, 무게)' — 예 '… (한손 양날검, 95 cm, 0.95 kg)'. 길이 · 무게는 몸체 자료(`buildParts` — 물리와 같은 수)에서 셈(`src/weapons.js` `weaponSpecText` · 종류 이름 `KIND_KO`). 카드 뽑기 · 싸움 화면에는 없다. 사장님이 쓴 설명도 설명은 그대로, 뒤에 스펙만.
- 코드: 기본 자세 이름(열쇠 12)은 따옴표째 같은 글만 저장소 전체에서 바꿈 · 레이피어 손 돌림(`src/hands.js`)은 이름 속 '프리마 · 세콘다 · 테르차 · 콰르타' 를 읽음. 인물 대사 · 출처(src · cite) · 연구 도구 글은 그대로.
- 남긴 것: 자루 무기 초안 표(`frames.js` POLE_GUARDS — 화면에 안 나옴)의 독일 이름.

| 자리 (처음 나온 곳) | 전 | 후 |
|---|---|---|
| `src/frames.js:72` | 지붕 (Vom Tag) | 지붕 (폼 타크) |
| `src/frames.js:73` | 어깨 지붕 (Vom Tag) | 어깨 지붕 (폼 타크) |
| `src/frames.js:74` | 왼 어깨 지붕 (Vom Tag) | 왼 어깨 지붕 (폼 타크) |
| `src/frames.js:78` | 긴 자세 (Langort) | 긴 자세 (랑오르트) |
| `src/frames.js:79` | 옆 지킴 (Nebenhut) | 옆 지킴 (네벤후트) |
| `src/frames.js:85` | 3번 자세 (Terza) | 3번 자세 (테르차) |
| `src/frames.js:86` | 쟁기 (Pflug) | 쟁기 (플루크) |
| `src/frames.js:86` | 바깥 막기 (Seconda) | 바깥 막기 (세콘다) |
| `src/frames.js:88` | 왼 쟁기 (Pflug) | 왼 쟁기 (플루크) |
| `src/frames.js:88` | 안쪽 막기 (Quarta) | 안쪽 막기 (콰르타) |
| `src/frames.js:107` | 2번 자세 (Seconda) | 2번 자세 (세콘다) |
| `src/frames.js:118` | 머리 막기 (St. George) | 머리 막기 (세인트 조지) |
| `src/frames.js:119` | 걸친 막기 (Hanging guard) | 걸친 막기 (행잉 가드) |
| `src/frames.js:128` | 황소 (Ochs) | 황소 (옥스) |
| `src/frames.js:149` | 바보 (Alber) | 바보 (알버) |
| `src/frames.js:151` | 왼 바꿈 (Wechsel) | 왼 바꿈 (베크셀) |
| `src/guards.js:33` | 바꿈 (Wechsel) | 바꿈 (베크셀) |
| `src/guards.js:38` | 왼 황소 (Ochs) | 왼 황소 (옥스) |
| `src/hands.js:29` | Prima | 프리마 |
| `src/hands.js:30` | Seconda | 세콘다 |
| `src/hands.js:31` | Terza | 테르차 |
| `src/hands.js:32` | Quarta | 콰르타 |
| `src/schools.js:205` |  | 燕返し |
| `src/schools.js:207` |  | 小手 |
| `src/schools.js:210` |  | 跨虎 |
| `src/schools.js:214` |  | 開き斬り |
| `src/schools.js:218` |  | 表五 |
| `src/schools.js:225` | 표범 머리 (豹頭勢 표두세) | 표범 머리 (표두세) |
| `src/schools.js:226` | 오른 날개 (右翼勢 우익세) | 오른 날개 (우익세) |
| `src/schools.js:227` | 턱밑 비늘 (逆鱗勢 역린세) | 턱밑 비늘 (역린세) |
| `src/schools.js:228` | 곧게 보내기 (直符送書 직부송서) | 곧게 보내기 (직부송서) |
| `src/schools.js:229` | 허리 베기 (腰擊勢 요격세) | 허리 베기 (요격세) |
| `src/schools.js:230` | 배 겨눔 (坦腹勢 탄복세) | 배 겨눔 (탄복세) |
| `src/schools.js:231` | 걷어 올리기 (撩掠勢 요략세) | 걷어 올리기 (요략세) |
| `src/schools.js:232` | 지켜보기 (看守勢 간수세) | 지켜보기 (간수세) |
| `src/schools.js:233` | 점 찍기 (點劍勢 점검세) | 점 찍기 (점검세) |
| `src/schools.js:234` | 왼 날개 (左翼勢 좌익세) | 왼 날개 (좌익세) |
| `src/schools.js:235` | 봉황 머리 (鳳頭勢 봉두세) | 봉황 머리 (봉두세) |
| `src/schools.js:236` | 왼 허리 베기 (腰擊勢 요격세) | 왼 허리 베기 (요격세) |
| `src/schools.js:237` | 왼 끼기 (左夾勢 좌협세) | 왼 끼기 (좌협세) |
| `src/schools.js:238` | 왼 걸치기 (跨左勢 과좌세) | 왼 걸치기 (과좌세) |
| `src/schools.js:246` | 머리 위 (altibaxo) | 머리 위 (알티바슈) |
| `src/schools.js:247` | 오른 베기 준비 (talho) | 오른 베기 준비 (탈류) |
| `src/schools.js:248` | 귀 앞 겨눔 (orelha direyta) | 귀 앞 겨눔 (오렐랴 디레이타) |
| `src/schools.js:249` | 곧은 자세 (postura recta) | 곧은 자세 (포스투라 레타) |
| `src/schools.js:250` | 오른 가로베기 (talho orizontal) | 오른 가로베기 (탈류 오리존탈) |
| `src/schools.js:251` | 비낀 자세 (postura obtusa) | 비낀 자세 (포스투라 옵투자) |
| `src/schools.js:252` | 오른 올려베기 (talho de baxo) | 오른 올려베기 (탈류 드 바슈) |
| `src/schools.js:253` | 뒤에서 오른 베기 (talho por detras) | 뒤에서 오른 베기 (탈류 포르 드트라스) |
| `src/schools.js:254` | 칼끝 땅에 (ponta no chão) | 칼끝 땅에 (폰타 누 샹) |
| `src/schools.js:255` | 왼 베기 준비 (revez) | 왼 베기 준비 (레베스) |
| `src/schools.js:256` | 왼 높이 비낌 (linha obtusa) | 왼 높이 비낌 (리냐 옵투자) |
| `src/schools.js:257` | 왼 가로베기 (revez orizontal) | 왼 가로베기 (레베스 오리존탈) |
| `src/schools.js:258` | 왼 비낀 자세 (postura obtusa) | 왼 비낀 자세 (포스투라 옵투자) |
| `src/schools.js:259` | 왼 올려베기 (revez de baxo) | 왼 올려베기 (레베스 드 바슈) |
| `src/schools.js:264` | 망루 (Wacht) | 망루 (바흐트) |
| `src/schools.js:265` | 분노 자세 (Zornhut) | 분노 자세 (초른후트) |
| `src/schools.js:266` | 황소 (Stier) | 황소 (슈티어) |
| `src/schools.js:268` | 가운데 지킴 (Mittelhut) | 가운데 지킴 (미텔후트) |
| `src/schools.js:269` | 멧돼지 (Eber) | 멧돼지 (에버) |
| `src/schools.js:272` | 보루 (Bastei) | 보루 (바스타이) |
| `src/schools.js:273` | 왼 분노 자세 (Zornhut) | 왼 분노 자세 (초른후트) |
| `src/schools.js:274` | 왼 황소 (Stier) | 왼 황소 (슈티어) |
| `src/schools.js:275` | 왼 가운데 지킴 (Mittelhut) | 왼 가운데 지킴 (미텔후트) |
| `src/schools.js:437` | 허리 베기 (腰擊 요격) | 허리 베기 (요격) · 腰擊 |
| `src/schools.js:439` | 왼 날개 치기 (左翼擊 좌익격) | 왼 날개 치기 (좌익격) · 左翼擊 |
| `src/schools.js:442` | 날개 접기 (斂翅 염시) | 날개 접기 (염시) |
| `src/schools.js:445` | 끌어 딛고 허리 베기 (掣步腰擊 체보요격) | 끌어 딛고 허리 베기 (체보요격) · 掣步腰擊 |
| `src/schools.js:458` | 굽은 베기 (Krumphau) | 굽은 베기 (크룸프하우) · Krumphau |
| `src/schools.js:460` | 곁눈 베기 (Schielhau) | 곁눈 베기 (실하우) · Schielhau |
| `src/schools.js:462` | 겹치기 (Duplieren) | 겹치기 (두플리렌) · Duplieren |
| `src/schools.js:468` | 비껴 딛는 가로베기 (Zwerch mit Abtritt) | 비껴 딛는 가로베기 (츠베르히 미트 압트리트) · Zwerch mit Abtritt |
| `src/schools.js:474` | 위에서 내려 찌르기 (imbroccata) | 위에서 내려 찌르기 (임브로카타) |
| `src/schools.js:477` | 밑으로 들어가 찌르기 (passata sotto) | 밑으로 들어가 찌르기 (파사타 소토) · passata sotto |
| `src/schools.js:479` | 칼끝 돌려 빼기 (cavazione) | 칼끝 돌려 빼기 (카바치오네) |
| `src/schools.js:481` | 비껴서며 찌르기 (inquartata) | 비껴서며 찌르기 (인콰르타타) |
| `src/schools.js:524` | 머리 위 돌려 베기 (redondo) | 머리 위 돌려 베기 (레돈두) |
| `src/schools.js:526` | 위아래 베기 (altibaxo) | 위아래 베기 (알티바슈) · altibaxo |
| `src/schools.js:533` | 번갈아 올려베기 (talho e revez de baxo) | 번갈아 올려베기 (탈류 이 레베스 드 바슈) · talho e revez de baxo |
| `src/schools.js:534` | 돌며 베기 (talho rodeado) | 돌며 베기 (탈류 로데아두) · talho rodeado |
| `src/schools.js:554` | 맞받기 (Indes) | 맞받기 (인데스) · Indes |
| `src/schools.js:556` | 따라 들어가기 (Nachreisen) | 따라 들어가기 (나흐라이젠) · Nachreisen |
| `src/schools.js:564` | 빼서 찌르기 (cavazione) | 빼서 찌르기 (카바치오네) |
| `src/schools.js:570` | 베어서 막기 (talho) | 베어서 막기 (탈류) · talho |
| `src/schools.js:586` |  | 残心 |
| `src/schools.js:588` |  | 出鼻 |
| `src/schools.js:590` |  | 返し |
| `src/schools.js:596` | 찌르고 이어 베기 (刺→擊 자→격) | 찌르고 이어 베기 (자→격) · 刺→擊 |
| `src/schools.js:612` | 받아 베기 (Versetzen) | 받아 베기 (페어제첸) · Versetzen |
| `src/schools.js:623` | 엇박 찌르기 (passata in contratempo) | 엇박 찌르기 (파사타 인 콘트라템포) · passata in contratempo |
| `src/schools.js:633` | 비켜 서며 크게 가로베기 (talho de través) | 비켜 서며 크게 가로베기 (탈류 드 트라베스) · talho de través |
| `src/schools.js:656` | 멈추지 않는 흐름 (talho e revez) | 멈추지 않는 흐름 (탈류 이 레베스) · talho e revez |
| `src/schools.js:713` |  | 後の先 |
| `src/schools.js:738` | 첫 칼 이어 치기 (連環三擊 연환삼격) | 첫 칼 이어 치기 (연환삼격) · 連環三擊 |
| `src/schools.js:749` | 걷어 올려 베기 (撩掠 요략) | 걷어 올려 베기 (요략) · 撩掠 |
| `src/schools.js:750` | 배 찌르기 (坦腹刺 탄복자) | 배 찌르기 (탄복자) · 坦腹刺 |
| `src/schools.js:801` | 당겨 허리 베기 (腰擊 요격) | 당겨 허리 베기 (요격) · 腰擊 |
| `src/schools.js:802` | 목 찌르기 (逆鱗刺 역린자) | 목 찌르기 (역린자) · 逆鱗刺 |
| `src/schools.js:837` | 찌르기 (刺 자) | 찌르기 (자) · 刺 |
| `src/schools.js:838` | 끊어 베기 (剪 전) | 끊어 베기 (전) · 剪 |
| `src/schools.js:856` | 내려 베기 (中殺 중살) | 내려 베기 (중살) |
| `src/schools.js:857` | 목 찌르기 (逆鱗刺 역린자) | 목 찌르기 (역린자) |
| `src/schools.js:858` | 물러 허리 베기 (退步腰擊 퇴보요격) | 물러 허리 베기 (퇴보요격) |
| `src/schools.js:864` | 오른 날개 (右翼 우익) | 오른 날개 (우익) |
| `src/schools.js:865` | 물러 왼 날개 치기 (掣步左翼擊 체보좌익격) | 물러 왼 날개 치기 (체보좌익격) |
| `src/schools.js:870` | 찌르기 (刺 자) | 찌르기 (자) |
| `src/schools.js:871` | 끊어 베기 (剪 전) | 끊어 베기 (전) |
| `src/schools.js:872` | 물러 베기 (殺 살) | 물러 베기 (살) |
| `src/schools.js:886` | 감아 들기 (Indes) | 감아 들기 (인데스) · Indes |
| `src/schools.js:897` | 왕관 → 뛰어들기 (Einlaufen) · 뛰어들기 (Einlaufen) | 왕관 → 뛰어들기 (아인라우펜) · Einlaufen · 뛰어들기 (아인라우펜) · Einlaufen |
| `src/schools.js:898` | 황소 걸이 → 겹치기 (Duplieren) · 겹치기 (Duplieren) | 황소 걸이 → 겹치기 (두플리렌) · Duplieren · 겹치기 (두플리렌) · Duplieren |
| `src/schools.js:899` | 왼 걸이 → 바꾸기 (Mutieren) · 바꾸기 (Mutieren) | 왼 걸이 → 바꾸기 (무티렌) · Mutieren · 바꾸기 (무티렌) · Mutieren |
| `src/schools.js:910` | 분노의 베기 (Zornhau) | 분노의 베기 (초른하우) |
| `src/schools.js:910` | 왼 분노의 베기 (Zornhau) | 왼 분노의 베기 (초른하우) |
| `src/schools.js:910` | 정수리 베기 (Scheitelhau) | 정수리 베기 (샤이텔하우) |
| `src/schools.js:910` | 가로베기 (Zwerchhau) | 가로베기 (츠베르히하우) |
| `src/schools.js:910` | 왼 가로베기 (Zwerchhau) | 왼 가로베기 (츠베르히하우) |
| `src/schools.js:911` | 올려베기 (Unterhau) | 올려베기 (운터하우) |
| `src/schools.js:911` | 왼 올려베기 (Unterhau) | 왼 올려베기 (운터하우) |
| `src/schools.js:911` | 쟁기 찌르기 (Pflug) | 쟁기 찌르기 (플루크) |
| `src/schools.js:911` | 왼 쟁기 찌르기 (Pflug) | 왼 쟁기 찌르기 (플루크) |
| `src/schools.js:911` | 황소 찌르기 (Ochs) | 황소 찌르기 (옥스) |
| `src/schools.js:911` | 왼 황소 찌르기 (Ochs) | 왼 황소 찌르기 (옥스) |
| `src/schools.js:911` | 바보 찌르기 (Alber) | 바보 찌르기 (알버) |
| `src/schools.js:912` | 좌우 이어 베기 (Zornhau) | 좌우 이어 베기 (초른하우) |
| `src/schools.js:912` | 손 끊기 (Abschneiden) | 손 끊기 (압슈나이덴) |
| `src/schools.js:912` | 바퀴 베기 (Radschlag) | 바퀴 베기 (라트슐라크) |
| `src/schools.js:915` | 오른 사선 내려베기 (mandritto squalembrato) | 오른 사선 내려베기 (만드리토 스콸렘브라토) |
| `src/schools.js:915` | 왼 사선 내려베기 (riverso squalembrato) | 왼 사선 내려베기 (리베르소 스콸렘브라토) |
| `src/schools.js:915` | 곧게 내려베기 (fendente) | 곧게 내려베기 (펜덴테) |
| `src/schools.js:915` | 오른 가로베기 (mandritto tondo) | 오른 가로베기 (만드리토 톤도) |
| `src/schools.js:915` | 왼 가로베기 (riverso tondo) | 왼 가로베기 (리베르소 톤도) |
| `src/schools.js:916` | 올려베기 (montante) | 올려베기 (몬탄테) |
| `src/schools.js:916` | 왼 올려베기 (riverso montante) | 왼 올려베기 (리베르소 몬탄테) |
| `src/schools.js:916` | 아래서 찌르기 (stoccata) | 아래서 찌르기 (스토카타) |
| `src/schools.js:916` | 안쪽 찌르기 (punta riversa) | 안쪽 찌르기 (푼타 리베르사) |
| `src/schools.js:917` | 높이 찌르기 (punta dritta alta) | 높이 찌르기 (푼타 드리타 알타) |
| `src/schools.js:917` | 왼 높이 찌르기 (punta riversa alta) | 왼 높이 찌르기 (푼타 리베르사 알타) |
| `src/schools.js:917` | 낮게 찌르기 (stoccata bassa) | 낮게 찌르기 (스토카타 바사) |
| `src/schools.js:918` | 좌우 이어 베기 (mandritto e riverso) | 좌우 이어 베기 (만드리토 에 리베르소) |
| `src/schools.js:918` | 손목 끝 베기 (stramazzone) | 손목 끝 베기 (스트라마초네) |
| `src/schools.js:918` | 돌려 베기 (molinello) | 돌려 베기 (몰리넬로) |
| `src/schools.js:921` | 오른 사선 베기 (talho) | 오른 사선 베기 (탈류) |
| `src/schools.js:921` | 왼 사선 베기 (revez) | 왼 사선 베기 (레베스) |
| `src/schools.js:921` | 내려베기 (altibaxo) | 내려베기 (알티바슈) |
| `src/schools.js:922` | 찌르기 (estocada) | 찌르기 (에스토카다) |
| `src/schools.js:922` | 왼 찌르기 (estocada) | 왼 찌르기 (에스토카다) |
| `src/schools.js:922` | 높이 찌르기 (estocada alta) | 높이 찌르기 (에스토카다 알타) |
| `src/schools.js:922` | 왼 높이 찌르기 (estocada alta) | 왼 높이 찌르기 (에스토카다 알타) |
| `src/schools.js:922` | 낮게 찌르기 (estocada baixa) | 낮게 찌르기 (에스토카다 바이샤) |
| `src/schools.js:923` | 좌우 이어 베기 (talho e revez) | 좌우 이어 베기 (탈류 이 레베스) |
| `src/schools.js:923` | 짧게 손 베기 (talho curto) | 짧게 손 베기 (탈류 쿠르투) |
| `src/schools.js:923` | 돌려 베기 (molinete) | 돌려 베기 (몰리네트) |
| `src/schools.js:931` | 오른 걸쳐 치기 (跨右擊 과우격) | 오른 걸쳐 치기 (과우격) |
| `src/schools.js:931` | 왼 걸쳐 치기 (跨左擊 과좌격) | 왼 걸쳐 치기 (과좌격) |
| `src/schools.js:931` | 표범 머리 치기 (豹頭擊 표두격) | 표범 머리 치기 (표두격) |
| `src/schools.js:931` | 허리 베기 (腰擊 요격) | 허리 베기 (요격) |
| `src/schools.js:931` | 왼 허리 베기 (左腰擊 좌요격) | 왼 허리 베기 (좌요격) |
| `src/schools.js:932` | 걷어 올려 베기 (撩掠 요략) | 걷어 올려 베기 (요략) |
| `src/schools.js:932` | 치켜 올려 치기 (掀擊 흔격) | 치켜 올려 치기 (흔격) |
| `src/schools.js:932` | 배 찌르기 (坦腹刺 탄복자) | 배 찌르기 (탄복자) |
| `src/schools.js:932` | 왼 끼고 찌르기 (左夾刺 좌협자) | 왼 끼고 찌르기 (좌협자) |
| `src/schools.js:933` | 오른 끼고 찌르기 (右夾刺 우협자) | 오른 끼고 찌르기 (우협자) |
| `src/schools.js:933` | 점 찍어 찌르기 (點劍 점검) | 점 찍어 찌르기 (점검) |
| `src/schools.js:934` | 좌우 걸쳐 치기 (跨左·跨右 과좌·과우) | 좌우 걸쳐 치기 (과좌·과우) |
| `src/schools.js:934` | 손 깎기 (御車 어거) | 손 깎기 (어거) |
| `src/schools.js:934` | 꽃 뿌려 머리 덮기 (撒花蓋頂 살화개정) | 꽃 뿌려 머리 덮기 (살화개정) |
| `src/schools.js:992` | 왕관 (Kron) | 왕관 (크론) |
| `src/schools.js:1023` | 1번 자세 (Prima) | 1번 자세 (프리마) |
| `src/schools.js:1029` | 뻗은 3번 자세 (Terza) | 뻗은 3번 자세 (테르차) |
| `src/schools.js:1031` | 4번 자세 (Quarta) | 4번 자세 (콰르타) |
| `src/schools.js:1178` | 뻗은 2번 자세 (Seconda) | 뻗은 2번 자세 (세콘다) |
| `src/schools.js:1209` | 높은 자세 (guardia alta) | 높은 자세 (과르디아 알타) |
| `src/schools.js:1211` | 넓은 자세 (guardia larga) | 넓은 자세 (과르디아 라르가) |
| `src/schools.js:1214` | 낮은 3번 자세 (Terza) | 낮은 3번 자세 (테르차) |
| `src/schools.js:1216` | 당긴 3번 자세 (Terza) | 당긴 3번 자세 (테르차) |
| `src/schools.js:1217` | 낮은 자세 (guardia bassa) | 낮은 자세 (과르디아 바사) |
| `src/schools.js:1219` | 높은 4번 자세 (Quarta) | 높은 4번 자세 (콰르타) |
| `src/schools.js:1220` | 머리 높이 4번 자세 (Quarta) | 머리 높이 4번 자세 (콰르타) |
| `src/schools.js:1222` | 굽힌 4번 자세 (Quarta) | 굽힌 4번 자세 (콰르타) |
| `src/schools.js:1224` | 낮은 4번 자세 (Quarta) | 낮은 4번 자세 (콰르타) |
| `src/schools.js:1249` | 오른 쳐내기 (talho) | 오른 쳐내기 (탈류) |
| `src/schools.js:1253` | 왼 쳐내기 (revés) | 왼 쳐내기 (레베스) |
| `src/schools.js:1273` | 솥 들기 (擧鼎勢 거정세) | 솥 들기 (거정세) |
| `src/schools.js:1277` | 수레 몰기 (御車勢 어거세) | 수레 몰기 (어거세) |
| `src/secret.js:358` | 오른쪽으로 떨어뜨림 (altibaxo) | 오른쪽으로 떨어뜨림 (알티바슈) |
| `src/secret.js:358` | 왼쪽으로 떨어뜨림 (altibaxo de revez) | 왼쪽으로 떨어뜨림 (알티바슈 드 레베스) |
| `src/secret.js:359` | 올려 탈류 (talho de baxo) | 올려 탈류 (탈류 드 바슈) |
| `src/secret.js:359` | 올려 레베스 (revez de baxo) | 올려 레베스 (레베스 드 바슈) |
| `src/test_pick.js:78` | 기본 · 받아 베기 (Versetzen) | 기본 · 받아 베기 (페어제첸) |
| `src/test_pick.js:79` | 시험 · 감아 들기 (Indes) | 시험 · 감아 들기 (인데스) |
| `src/unique_assist.js:75` | 날개 접기 (斂翅 염시) | 날개 접기 (염시) · 斂翅 |
| `src/unique_assist.js:77` | 찌르고 베기 (刺→擊 자→격) | 찌르고 베기 (자→격) · 刺→擊 |
| `tools/ui/hud_shots.mjs:92` | 맞받기 (Indes) | 맞받기 (인데스) |
| `tools/ui/hud_shots.mjs:92` | 받아 베기 (Versetzen) | 받아 베기 (페어제첸) |
| `tools/ui/hud_shots.mjs:92` | 따라 들어가기 (Nachreisen) | 따라 들어가기 (나흐라이젠) |
