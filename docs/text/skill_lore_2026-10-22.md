# 스킬트리 칸 오의 — lore · src 55 칸 (2026-10-22)

- 사장님 10/22 00:5x: "궁극적으로는 지금과 같은 '설명'이 아니라 검술서나 참고 문헌에서의 오의를 밝힌 예전 방식이 더 나았던 거 같아."
- 10/21 전 대기실 스킬북은 책마다 출처 줄('리히테나워 전승(14세기) · 요아힘 마이어(1570)' · '미야모토 무사시 『오륜서』(1645) — 세 가지 받기' · '『장자』 각의편의 토고납신(吐故納新)')을 달았다(`git show 3a5322d^:src/skill_books.js` BOOK_TEXT). 10/21 스킬트리(유파마다 11 칸)로 바뀌며 그 줄이 빠졌다 → 칸마다 다시 단다.
- 자료: `src/skill_tree_data.js` `NODE_LORE` — 칸 id 마다 `lore`(오의 한 줄) · `src`(출처 줄). `TREE` 를 만들 때 칸에 붙는다(`n.lore` · `n.src`). `eff`(효과 한 줄 — 사장님 10/22 승인 글)는 그대로.
- 화면: 상세 카드 위에 lore + src, 그 아래 작은 줄에 eff(그리기는 `src/skill_tree.js` — 다른 작업자 몫). 닫힌 칸(일본 밖 비기 · J8)도 글은 미리 두고 화면은 '준비 중'.
- 편지 다섯 칸(G11 · I11 · B11 · J11 · C11)은 lore 만 — 출처를 쓰지 않는다(편지에 한한 예외 · 사장님 10/22 01:1x).
- 시험: `tools/sim/skill_tree.test.mjs` '칸 오의' — 모든 칸 lore · 45 자 안 · 숫자 · 로마자 · 한자 · 가나 없음 · 편지 아닌 칸 src 있음 · 편지 칸 src 없음.

## 1. 신뢰도

| 표시 | 뜻 |
|---|---|
| [원문] | 실제 원전 대목을 그대로 옮긴 줄. 대목이 그 칸의 이치를 바로 말한다. 저장소의 원본 읽기표(사장님이 주신 PDF — `docs/motion/schools/`) · 저장소 주석의 원문 인용 · Wiktenauer 전사 · 영역에서 확인했다. |
| [풀이] | 그 칸의 이치를 바로 말하는 대목을 찾지 못해 같은 원전의 가장 가까운 대목을 쓴 줄, 또는 두 대목을 합치거나 줄여 옮긴 줄. 아래 표의 원문 칸에 실제 대목과 무엇을 바꿨는지 적었다. |
| [편지] | 원전이 없는 편지 칸. 그 도시에서 온 짧은 글. |

## 2. 읽은 판

| 유파 | 원전 | 읽은 판 · 자리 |
|---|---|---|
| 독일 | 리히테나워 운문 『Zettel』(14세기 — 고타 사본 1448 · 로마 사본 1452) | Wiktenauer 'Johannes Liechtenauer' 전사 · Christian Tobler 영역. 구절 번호 = Tobler 번호(v). 저장소 인용: `docs/motion/longsword_cuts.md:89` · `:100` · `docs/strike/kron_shape_2026-10-12.md:23` · `src/schools.js:462` · `:470` |
| 이탈리아 | 리돌포 카포 페로 『Gran Simulacro dell'Arte e dell'Uso della Scherma』(시에나 1610) | Wiktenauer 'Ridolfo Capoferro' — William Wilson · W. Jherek Swanger 영역. '기술(Arte)' ¶ 번호와 '쓰임(Uso)' [n] 번호(Wiktenauer 번호 — 원문 권고 · 용어 번호와 다름, `docs/strike/italian_forte_parry_2026-10-17.md` §1 주의). 저장소 원문 PDF 인용: `src/schools.js:476` · `:481` · 비기 I4(10/22) = 살바토르 파브리스 『Lo Schermo, overo Scienza d'Arme』(코펜하겐 1606) 둘째 책 — Wiktenauer 'Salvator Fabris' 1606 전사(Michael Chidester) · A. F. Johnson 영역(ca. 1900), [n] = 1606 판 쪽 |
| 이베리아 | 디오구 고메스 드 피게이레두 『Memorial da Prattica do Montante』(1651) · 도밍구 루이스 고디뉴 『Arte de Esgrima』(1599) 몬탄테 장 | 피게이레두 = Wiktenauer 'Diogo Gomes de Figueyredo' 포르투갈어 전사 · Eric Myers · Steve Hick 영역(단순 규칙 · 복합 규칙). 고디뉴 = 저장소 독일어 역 인용(`docs/motion/iberian_montante_2026-10-10.md:25`) |
| 일본 | 미야모토 무사시 『오륜서』(1645) · 야규 무네노리 『병법가전서』(1632) · 『일본검도형』(1912) | 원본 읽기표: `docs/motion/schools/gorin_no_sho.md`(原本五輪書 1939 판) · `school_japanese_draft.md`(병법가전서 나베시마가본) · `kendo_kata.md`(전일본검도연맹 해설서) |
| 동방 | 모원의 『무비지』(1621) 권86 조선세법 · 『무예도보통지』(1790) 권2 예도 · 『장자』 | 원본 읽기표: `docs/motion/schools/choseon_sebeop.md`(무비지 국역) · `muyedobotongji_vol2.md` · `school_chinese_draft.md:58`. 장자 = 위키문헌 『남화진경』(사부총간본) 권10 설검 · 『장자』 각의 |

## 3. 55 칸

### 독일

| id | 칸 | lore | src | 원문 (원어 · 자리 / 저장소 근거) | 신뢰도 |
|---|---|---|---|---|---|
| G1 | 뒤 박차기 | 걸음을 내딛거든 굼뜨지 마라 | 리히테나워 『Zettel』(14세기) — 속임 베기 | v57 「Zwifach es fürpas / Scheitt in linck vnd pis nicht las」 (Do it further twice, stride to the left and do not be slow) — 로마 사본. '왼쪽으로'를 빼고 '굼뜨지 마라'만 살림. 뒤로 박차는 걸음을 말하는 구절은 운문에 없다(Ringeck · Meyer 의 물러서기 대목은 이번에 확인 못 함) | [풀이] |
| G2 | 간격 잡기 | 따라 들기는 두 겹으로 익혀라, 아니면 칼을 베어 들어라 | 리히테나워 『Zettel』(14세기) — 따라 들기 | v75 「Nach reyßenn lere czwiuach oder sneÿd in dÿ were」 (Learn the chasing twice, or slice into the weapon) — 고타 사본. 상대 헛침 뒤 두 걸음 빠르게 = 두 겹 따라 들기 | [원문] |
| G5 | 곁눈 베기 | 곁눈 베기는 들소 같은 자가 치고 찌르는 것을 꺾는다 | 리히테나워 『Zettel』(14세기) — 곁눈 베기 | v58 「Schiler enpricht waß puffler slecht oder sticht」 (The squinter breaks into whatever the buffalo strikes or thrusts) · 저장소 `src/schools.js:462` · `docs/motion/longsword_cuts.md:100` | [원문] |
| G8 | 비껴 딛는 가로베기 | 가로베기를 잘하는 자는 뛰어 딛으며 머리를 위협한다 | 리히테나워 『Zettel』(14세기) — 가로베기 | v52 「Was sich wol twert / mit sprüngen dem haupt gevert」 (He who thwarts well, with springing endangers the head) — 로마 사본. 같은 묶음 v49 「Zwerch benimpt / was vom tag dar kümpt」 는 `src/schools.js:470` · `docs/motion/longsword_cuts.md:89` | [원문] |
| G3 | 세워 받기 | 젖혀 막기를 배워, 치고 찌르는 것을 솜씨 있게 막아라 | 리히테나워 『Zettel』(14세기) — 젖혀 막기 | v83 「leren abseczenn hawe stich chunstiglichenn leczenn」 (Learn to set aside, to skillfully hinder stroke and thrust) — 고타 사본 | [원문] |
| G11 | 뉘른베르크에서 온 편지 | 뉘른베르크 장인 조합이 네 칼의 길이와 무게를 적어 갔다 (10/23 고침) | (없음) | — | [편지] |
| G7 | 겹치기 | 위에서는 겹쳐 치고, 아래에서는 바르게 바꿔 쳐라 | 리히테나워 『Zettel』(14세기) — 겹치기와 바꾸기 | v39 「Oben duplir / Nyden recht mutir」 (double above, transmute below correctly) — 로마 사본. 맞물림에서 다시 그어 듦은 Ringeck 주해 Duplieren(`src/schools.js:464`) | [원문] |
| G6 | 무릎 꺾기 | 세게 몰아치려거든 온몸으로 싸워라 | 리히테나워 『Zettel』(14세기) — 긴 칼 첫 가르침 | v14 「mit ganczem leib / vicht waß du starck gerest czu treyben」 (Fight with the entire body, what you powerfully want to do) — 고타 사본. 곁눈 베기 구절(v58~62)에 쓰러뜨림 · 무릎 말이 없어 힘의 이치로 가장 가까운 첫 가르침을 씀 | [풀이] |
| G4 | 왕관 | 그에게서 오는 것은 무엇이든 왕관이 걷어 낸다 | 리히테나워 『Zettel』(14세기) — 정수리 베기와 왕관 | v65 「waß võ Im chömet dy kron das abnymet」 (Whatever comes from him, the crown will take it) · Ringeck 주해 「versetzt er mit dem gehiltz hoch ob seinem haupt, die versatzung heist die kran」 — 저장소 `docs/strike/kron_shape_2026-10-12.md:23` · `src/schools.js:983` | [원문] |
| G9 | 인데스 | 앞과 뒤가 모든 기예의 샘이니, 약함과 셈, 그 사이라는 말을 새겨라 | 리히테나워 『Zettel』(14세기) — 앞과 뒤 · 인데스 | v17~18 「Vor und nach dy zway ding」 · 「Swech vnd sterck / Inndes Das wort do mit merck」 (Before and after, these two things … weak and strong, the word 'within' remember) — 로마 사본. 사장님 승인 갈래(리히테나워 인데스 · Ringeck) | [원문] |
| G10 | 죽음의 일격 (10/22 — 전 받아 베기) | 위 자세에서 때가 맞거든, 칼자루 끝으로 쳐라 | 지그문트 링엑 『Kampffechten』(15세기) — 갑옷 싸움 | 링엑 갑옷 싸움 주해 §35 — 드레스덴 사본(Mscr.Dresd.C.487 · 1504~1519) 99v 「magst du vsß der obern hůt mitt dem knopff wol schlachen wann es dir eben ist」(Rawlings 영역 'you'll also strike him with the pommel from the upper guard' · Castro 2024) · 로스토크 사본 108v 같은 대목 — Wiktenauer 'Sigmund ain Ringeck' 전사 · 영역에서 확인. 죽음의 일격(칼날을 거꾸로 쥐고 코등이 · 폼멜로 치기) 자체를 말하는 글귀는 탈호퍼 그림책(1459 · 1467 — 짧은 그림 풀이 · Hull 정리 'mortschlag · mordstreich · tunrschlag')에서 원문을 찾지 못해 같은 갑옷 싸움 전통의 가장 가까운 대목(위 자세에서 칼자루 끝으로 치기)을 씀. 옛 칸 글(받아 베기 — v70)은 커밋 기록 | [풀이] |

### 이탈리아

| id | 칸 | lore | src | 원문 (원어 · 자리 / 저장소 근거) | 신뢰도 |
|---|---|---|---|---|---|
| I1 | 박자 걸음 | 박자란 고요와 움직임을 재는 것일 뿐이다 | 리돌포 카포 페로 『Gran Simulacro』(1610) — 박자 | 기술 ¶53 'tempo is not other than the measure of the stillness and of the motion'. 짧은 둘 · 긴 둘 박자는 사장님 10/15 결정(`docs/strike/italian_gait_speed_2026-10-21.md:9`) — 원전의 박자 정의를 씀 | [원문] |
| I11 | 시에나에서 온 편지 | 시에나의 칼 장인들이 이제 네 이름을 안다 | (없음) | — | [편지] |
| I3 | 물러서기 | 왼 다리로 물러서고 오른 다리가 따르면, 상대에게서 안전하다 | 리돌포 카포 페로 『Gran Simulacro』(1610) — 물러서기 | 쓰임 [23] (원문 용어 9) 'you will go back with the left leg, accompanied by the right; thus will you be safe from the adversary' — 저장소 `docs/strike/italian_retreat_2026-10-17.md:58` | [원문] |
| I2 | 비껴서며 찌르기 | 몸을 비켜 빼며, 넷째 자세로 돌려 찌른다 | 리돌포 카포 페로 『Gran Simulacro』(1610) — 그림 풀이 | 쓰임 [46] 「B. inquartando con lo scanso della vita」 (B executing an inquartata with a void of his body) · [37] 같은 말. 주의: 기술 ¶92 는 인콰르타타 때 발을 엇걸거나 오른 다리를 빼는 것을 낮게 친다 — 그림 풀이의 몸 빼기만 옮김 | [원문] |
| I5 | 뻗어 받기 | 팔을 잘 뻗어 두면, 상대의 칼을 모두 몸에서 멀리 쳐낸다 | 리돌포 카포 페로 『Gran Simulacro』(1610) — 막기 | 쓰임 [3] (원문 권고 3) 'hold your arm well extended, because you will come to deflect all your adversary's blows at a distance from your body' · [21] 'all the parries require an extended arm' — 저장소 `docs/strike/italian_forte_parry_2026-10-17.md:33` · `:34` | [원문] |
| I7 | 위에서 내려 찌르기 | 첫째 자세에서 떠나 상대의 왼 어깨에서 오른 무릎으로, 던지듯 찔러라 | 리돌포 카포 페로 『Gran Simulacro』(1610) — 찌르기 이름 | 용어 풀이 「l'imbroccata si parte dalla prima guardia, & và à ferire dalla spalla sinistra dell'avversario fino al suo ginocchio dritto … e vuol esser buttata」 PDF 53쪽 — 저장소 `src/schools.js:476` · Wiktenauer 쓰임 [31] | [원문] |
| I6 | 막아찌르기 | 좋은 검객은 막고서 되받아 치지 않는 일이 결코 없다 | 리돌포 카포 페로 『Gran Simulacro』(1610) — 막고 치기 | 쓰임 [2] (원문 권고 2) 'The good player … must never parry without responding with striking' — 저장소 `docs/strike/italian_retreat_2026-10-17.md:61` | [원문] |
| I8 | 틈 파고들기 | 언제나 찌르기로 쳐라, 찌르기가 더 치명적이다 | 리돌포 카포 페로 『Gran Simulacro』(1610) — 찌르기 | 쓰임 [27] 'always strike with a thrust because it is more mortal' | [원문] |
| I9 | 칼끝 돌려 빼기 | 그 순간 칼끝을 빼 돌리고 조이며 나아가, 가슴을 찔러라 | 리돌포 카포 페로 『Gran Simulacro』(1610) — 칼 빼기 | 「in quell'istante si caverà, & stringerà caminando innanzi … si ferirà di quarta di punta nel petto」 PDF 80쪽 — 저장소 `src/schools.js:481` | [원문] |
| I4 | 거침없이 나아가 찌르기 (10/22 — 전 엇박 찌르기) | 팔을 굳게 두고 상대 칼날을 놓지 말고, 따라 미끄러져 몸까지 가라 | 살바토르 파브리스 『Lo Schermo』(1606) — 결연히 나아가기 | 둘째 책 첫째 규칙 [156] 「tenendo fermo il braccio andare scorrendo il filo di detta nimica sino al corpo auerso senza mai abbandonarla」 (Keeping your arm steady you should glide along his blade to his body, without ever leaving the blade — A. F. Johnson 영역). 같은 장 [155] 「che siano sempre unite」(두 칼이 늘 붙어 있게) · [156] 「quanto più uicina sarà alla lama nimica tanto meglio … guardare di toccarla niente」(가까울수록 좋되 닿지 말 것). 옛 줄(카포 페로 엇박)은 `?itSecret=contratempo` 옛 비기 몫 — 칸 글은 이 줄 하나. 출처 줄은 680 × 360 카드 넘침으로 '둘째 책'을 뺌 | [원문] |
| I10 | 곧은 선 | 곧은 선은 하나이니, 기예를 아는 자만이 그것을 긋는다 | 리돌포 카포 페로 『Gran Simulacro』(1610) — 곧은 선 | 기술 ¶18 「una è la linea retta, la quale non sa fare se non l'artefice」 (one is the straight line, which none but the artful knows how to do). 사장님 승인 갈래(카포 페로 linea retta) | [원문] |

### 이베리아

| id | 칸 | lore | src | 원문 (원어 · 자리 / 저장소 근거) | 신뢰도 |
|---|---|---|---|---|---|
| B1 | 넓은 옆걸음 | 박자 맞고 무게 실린 잰 걸음으로 가되, 춤추듯 걷지 마라 | 고디뉴 『Arte de Esgrima』(1599) — 몬탄테 장 | 장 1 주 「mit getimten, gewichteten und wohlbemessenen Schritten, und nicht wie jene die tanzen」 (독일어 역) — 저장소 `docs/motion/iberian_montante_2026-10-10.md:25` | [원문] |
| B2 | 옆 박차기 | 오른발을 오른쪽 끝없는 선으로 옮기고, 왼발이 따르게 하라 | 피게이레두 『Memorial da Prattica do Montante』(1651) — 복합 규칙 12 | 「metendo o pé dereyto pella linha infinita do lado dereyto, acompanhandoo o esquerdo」 (moving the right foot along the line of infinity on the right side, accompanying it with the left) — 저장소 `docs/strike/school_gait_iberian_chinese_2026-10-10.md:128` | [원문] |
| B10 | 손목 힘 | 왼손을 낮춰 몸에 붙여 굳게 하면, 칼이 더 큰 힘으로 나간다 | 피게이레두 『Memorial da Prattica do Montante』(1651) — 복합 규칙 13 | 「com a mão esquerda baxa e junto ao corpo para estar mais firme, e serem os golpes executados com mais forsa」 (with the left hand low and against the body to be more firm, and so the blows will be executed with more force) — 큰 칼을 돌려 베는 규칙. 피게이레두 영역 · 저장소 고디뉴 인용 어디에도 '손목' 말이 없어, 큰 칼을 돌리는 손과 힘의 대목으로 가장 가까운 것을 씀 · 저장소 `docs/motion/iberian_montante_2026-10-10.md:22` | [풀이] |
| B3 | 돌며 베기 | 같은 오른발을 다시 들이며, 왼발 위로 나사처럼 돌아 걸어라 | 피게이레두 『Memorial da Prattica do Montante』(1651) — 단순 규칙 13 | 「e outro tornando a meter o mesmo pé dereyto andando como em parafuzo sobre o esquerdo」 (and another again putting in the same right foot, walking like a screw over the left) — 저장소 `src/schools.js:536` · `docs/motion/iberian_montante_2026-10-10.md:885` | [원문] |
| B4 | 머리 위 돌려 베기 | 칼을 머리 위로 넘겨 어깨 뒤로 보내, 왼팔 위로 떨어뜨리며 둘러 벤다 | 피게이레두 『Memorial da Prattica do Montante』(1651) — 복합 규칙 2 | 「para o passar por sima da cabeça às espaldas de sorte que caya sobre o braço esquerdo para dar hũ revez cingido」 (pass it over the head and behind the shoulders, such that it falls over the left arm to give a circling revez) — 저장소 `docs/motion/iberian_montante_2026-10-10.md:602` · `src/schools.js:526` | [원문] |
| B8 | 쳐내기 | 맞선 무기가 오는 쪽에 따라, 탈류로 아니면 레베스로 쳐내라 | 피게이레두 『Memorial da Prattica do Montante』(1651) — 단순 규칙 14 | 「desviandoo para o lado esquerdo … ou desviar de revez conforme o lado a que se dirigir a armas contraria」 (deflect it to the left side … or else deflect with a revez, according to which side the opposing weapon is aimed) — 저장소 `docs/strike/ukenagashi_talho_2026-10-17.md:114` | [원문] |
| B11 | 리스본에서 온 편지 | 부두에 큰 칼이 내릴 때마다, 선원들이 네게 먼저 보이자고 한다 (10/23 고침) | (없음) | — | [편지] |
| B5 | 흐르는 긋기 | 탈류에서 다른 탈류가 나고, 레베스에서 다른 레베스가 난다 | 피게이레두 『Memorial da Prattica do Montante』(1651) — 맺음말 | 「E que ultimamente do talhos nacem outros talhos, e dos revezes outros revezes」 (from talhos are born other talhos, and from revezes other revezes) — 저장소 `docs/motion/iberian_montante_2026-10-10.md:29` | [원문] |
| B9 | 굳은 받기 | 큰 칼의 쳐내기와 막기와 치기는 모두 몸놀림이 거들어야 한다 | 피게이레두 『Memorial da Prattica do Montante』(1651) — 복합 규칙 6 | 'all the deflections, parries and attacks of the montante must be helped by the movements of the body' (영역) — 저장소 `docs/motion/iberian_montante_2026-10-10.md:25` · `src/schools.js:1230` | [원문] |
| B7 | 휘감아 돌기 (10/22 — 전 길목 지키기) | 큰 칼로 갈비를 온통 휘감고, 온몸을 돌려라 | 고디뉴 『Arte de Esgrima』(1599) — 몬탄테 장 규칙 8 | 「umgürtet das Montante die gesamten Rippen, auch den gesamten Körper herumdrehend」 (독일어 역 — 몬탄테가 갈비 전체를 휘감고, 온몸을 돌리며) — 저장소 `docs/motion/iberian_montante_2026-10-10.md:25` · `:612` · 원문은 서술(…하며)이라 명령꼴로 옮김 | [풀이] |
| B6 | 거듭 돌려 베기 | 걸음마다 한 칼씩, 늘 아래에서 위로, 사람들이 멈출 때까지 번갈아 쳐라 | 피게이레두 『Memorial da Prattica do Montante』(1651) — 복합 규칙 7 | 'in each step you must give a blow, always from low to high, alternating talho and revez, until the people stop' (영역) — 저장소 `docs/motion/iberian_montante_2026-10-10.md:882` · `src/schools.js:581` | [원문] |

### 일본

| id | 칸 | lore | src | 원문 (원어 · 자리 / 저장소 근거) | 신뢰도 |
|---|---|---|---|---|---|
| J1 | 낮은 걸음 | 발끝을 조금 띄우고 뒤꿈치를 세게 디뎌, 늘 걷듯이 걸어라 | 미야모토 무사시 『오륜서』(1645) — 물의 권 발 쓰기 | 足づかひ p20 「つま先を少しうけて、きびすを強く踏むべし。…常にあゆむが如し」 — `docs/motion/schools/gorin_no_sho.md:62` | [원문] |
| J6 | 비껴 베기 | 벨 때도 물러설 때도 받을 때도, 좌우를 번갈아 디뎌라 | 미야모토 무사시 『오륜서』(1645) — 물의 권 음양의 발 | 足づかひ p20 「きる時、ひく時、うくる時迄も、陰陽とて左右々々踏む足なり」 — `gorin_no_sho.md:62` · 저장소 `src/schools.js:214` | [원문] |
| J7 | 손목 치기 | 적이 치고 들 때, 아래에서 그 손을 쳐라 | 미야모토 무사시 『오륜서』(1645) — 물의 권 다섯 겉 | 다섯 겉 셋째(下段) p23 「敵の打ちかく所を下より手をはる也」 — `gorin_no_sho.md:15` · 저장소 `src/schools.js:207` 「手をはる」 | [원문] |
| J2 | 머리 위 받기 | 받는 것도 쳐내는 것도 붙는 것도, 모두 적을 베는 계기로 여겨라 | 미야모토 무사시 『오륜서』(1645) — 물의 권 자세 있고 자세 없음 | 有構無構 p25-26 「敵の太刀を受くる、はる、あたる、ねばる、さはるなどいふ事あれども、皆々敵を切る縁也と心得べし」 — `gorin_no_sho.md:24` | [원문] |
| J11 | 에도에서 온 편지 | 도공이 새 칼을 벼리다 말고, 이 칼의 주인은 너라 하였다 (10/23 고침) | (없음) | — | [편지] |
| J9 | 제비 베기 | 빗나간 칼을 그대로 두었다가, 적이 칠 때 아래에서 퍼 올려 쳐라 | 미야모토 무사시 『오륜서』(1645) — 물의 권 다섯 겉 | 다섯 겉 둘째(上段) p23 「敵を打ちはづしたる太刀其儘置きて、又敵の打つ所を下よりすくひ上げて打つ」 — `gorin_no_sho.md:13` · 저장소 `src/schools.js:205` | [원문] |
| J8 | 손목 치기 심화 (닫힘) | 손을 친 칼을 적이 쳐 떨구려 하면, 넘기는 박자로 팔을 가로 베라 | 미야모토 무사시 『오륜서』(1645) — 물의 권 다섯 겉 | 다섯 겉 셋째 p23-24 「手をはる所を亦敵そのはる太刀を打落さんとする所をこす拍子にて、敵打ちたるあと二腕を(?)横にきる心也」 — `gorin_no_sho.md:15`. 「二腕」 읽기가 불확실(읽기표 불확실 1)해 '팔'로 줄여 옮김 | [풀이] |
| J3 | 흘려 받기 | 적의 눈을 찌르듯 하며, 그 칼을 오른 어깨로 끌어 흘려 받아라 | 미야모토 무사시 『오륜서』(1645) — 세 가지 받기 | 三つの受 (1) p32-33 「我太刀にて敵の目をつく樣にして、敵の太刀を我が右の肩へ引流して受くべし」 — `gorin_no_sho.md:45` · 저장소 `src/schools.js:183` | [원문] |
| J10 | 기다림과 침 | 몸과 발은 걸어 들고, 칼은 기다린다 | 야규 무네노리 『병법가전서』(1632) — 걸기와 기다림 | p14/10 「身をば敵にちかくふりかけて、懸になして太刀をば待になして…身足は懸に、太刀は待也」 — `docs/motion/schools/school_japanese_draft.md:211` · `:250`. 사장님 승인 갈래(병법가전서 懸待) | [원문] |
| J4 | 흘린 칼 | 몸을 왼쪽으로 열며, 칼 옆면으로 흘려 받는다 | 『일본검도형』(1912) — 소태도 둘째 본 | 소태도 2본 「左足を左斜め前に、右足をその後ろに」 体を左に開き 「右鎬で受け流し」 (해설서 p17) — `docs/motion/schools/kendo_kata.md:41` · 저장소 `src/schools.js:184`. 형은 1912 제정, 글은 해설서 | [원문] |
| J5 | 뒤에서 앞서기 | 적이 내게 걸어올 때의 앞섬, 이를 기다림의 앞섬이라 한다 | 미야모토 무사시 『오륜서』(1645) — 불의 권 세 가지 앞섬 | 三つの先 p41-43 「敵より我方へかゝる時の先、是はたいの先といふ」 — `gorin_no_sho.md:76`. 같은 이치: 병법가전서 p17/17 「敵にせんをさせ、うたれて敵をうつ」(`school_japanese_draft.md:213`) | [원문] |

### 동방

| id | 칸 | lore | src | 원문 (원어 · 자리 / 저장소 근거) | 신뢰도 |
|---|---|---|---|---|---|
| C1 | 가벼운 발 | 한 걸음 한 걸음, 잰걸음으로 파고든다 | 모원의 『무비지』(1621) 권86 조선세법 — 게격세 | 揭擊勢 쪽169 「步步套進」(국역 '한 걸음 한 걸음 걷는 식으로 잰걸음') — `docs/motion/schools/choseon_sebeop.md:46` · 무예도보통지 권2 p042 「法能剪格上殺步步套進」(`muyedobotongji_vol2.md:68`) | [원문] |
| C2 | 덜 지치는 걸음 | 열 걸음에 한 사람을 베고, 천 리를 가도 걸음을 멈추지 않는다 | 『장자』 설검편 | 「臣之劍，十步一人，千里不留行」 — 위키문헌 『남화진경』(사부총간본) 권10 설검. 조선세법 · 예도에 지치지 않는 걸음을 말하는 대목이 없어, 동방 유파가 이미 쓰는 『장자』에서 걸음을 멈추지 않는 칼의 대목을 씀 | [풀이] |
| C3 | 허리 베기 | 몸과 걸음과 손과 칼이 빠른 우레 같으니, 이 한 칼이 칼의 으뜸이다 | 모원의 『무비지』(1621) 권86 조선세법 — 요격세 | 쪽166/0580 「腰擊勢者, 卽腰擊也. 法能橫衝中殺. 身步手劍疾若迅雷, 此一擊者, 劍中之首擊也」 — `docs/motion/schools/school_chinese_draft.md:58` · `choseon_sebeop.md:47` · 저장소 `src/schools.js:439` | [원문] |
| C7 | 세 자세 받기 | 손을 굴려 이어 가며 위아래를 막는다 | 모원의 『무비지』(1621) 권86 — 검결가 | 검결가 쪽151 「搖頭進步風雷嚮, 滾手連環上下防」 — `choseon_sebeop.md:6` | [원문] |
| C11 | 한양에서 온 편지 | 훈련도감 군기 장부 끝에 네 이름을 올려 두었으니 기다려라 (10/23 고침) | (없음) | — | [편지] |
| C4 | 깊은 허리 베기 | 가로로 내질러 가운데를 죽이는 것이 그 법이다 | 『무예도보통지』(1790) 권2 예도 — 요격세 | p041 「腰擊勢 卽腰擊, 法能橫衝中殺」 — `docs/motion/schools/muyedobotongji_vol2.md:65` | [원문] |
| C5 | 끌어 딛고 허리 베기 | 앞발을 내딛고 뒷발을 끌어 붙이며, 나아가 허리를 친다 | 모원의 『무비지』(1621) 권86 조선세법 — 체보 | 掣步 국역 쪽156 '앞발을 내딛고 뒷발은 당겨 붙여 끌면서'(`choseon_sebeop.md:45`) + 「向前進步腰擊」 쪽158/0572(저장소 `src/schools.js:447`). 걸음 대목과 허리 베기 대목을 합쳐 옮김 | [풀이] |
| C6 | 날개 접기 | 거짓으로 지는 척 적을 꾀어, 물러나다 문득 나아가 허리를 친다 | 모원의 『무비지』(1621) 권86 조선세법 — 염시세 | 斂翅勢 쪽174/0588 「法能佯北誘賺 … 倒退進步腰擊」 — 저장소 `src/schools.js:444` · `choseon_sebeop.md:36`. 무예도보통지 권2 p045 읽기는 「法能伴佯誘賺」(`muyedobotongji_vol2.md:73`) | [원문] |
| C8 | 단단한 받기 | 솥을 들 듯 막아 위로 죽이는 것이 그 법이다 | 『무예도보통지』(1790) 권2 예도 — 거정세 | p035 「擧鼎勢者卽擧鼎格也 法能鼎格上殺」 — `muyedobotongji_vol2.md:53` · 무비지 쪽154(`choseon_sebeop.md:16`) | [원문] |
| C10 | 숨 바꾸기 | 숨을 불고 내쉬어, 묵은 것을 뱉고 새것을 들인다 | 『장자』 각의편 — 토고납신 | 「吹呴呼吸，吐故納新，熊經鳥申，爲壽而已矣」 — 위키문헌 『장자』 각의. 사장님 승인 갈래(각의편 吐故納新 — `src/school_passive.js:13`) | [원문] |
| C9 | 막아 죽이기 (10/22 — 전 세 번 이어 치기) | 수레를 몰 듯 막아, 가운데를 죽이고 두 손을 깎아 죽인다 | 모원의 『무비지』(1621) 권86 조선세법 — 어거세 | 쪽161/0575 「御車勢者, 卽御車格也. 法能駕御中殺 削殺兩手」 — `docs/strike/school_slots_2026-10-11.md:29` · 무예도보통지 권2 p038 「卽御車格, 法能駕御中殺削殺」(`muyedobotongji_vol2.md:60`) · 저장소 `src/schools.js` CHINESE_PARRY_SLOTS.eogeo src. 駕御 = 수레를 몰다 · 格 = 막다(받다)로 풀어 씀 | [원문] |

## 4. 셈

- [원문] 44 · [풀이] 6(G1 · G6 · B10 · J8 · C2 · C5) · [편지] 5.
- 출처 줄의 원어는 『』 안 책 이름에만(Zettel · Gran Simulacro · Arte de Esgrima · Memorial da Prattica do Montante — 옛 BOOK_TEXT 와 같은 꼴). lore 는 한글만.
- 바탕 원전을 끝내 찾지 못한 칸은 없다. 가장 멀리 간 줄은 G1(운문에 뒤로 박차는 걸음이 없음) · B10(손목 말이 없음) · C2(조선세법 · 예도에 걷기 기력 대목이 없음) — 위 표에 실제 대목과 바꾼 곳을 적었다.

## 5. 남은 일

- 화면: 상세 카드에 lore + src 를 위에, eff 를 작은 줄로(다른 작업자 — `src/skill_tree.js`).
- 확인하면 더 단단해질 곳: Ringeck · Meyer 의 물러서기 대목(G1 을 [원문] 으로 바꿀 수 있음) · 고디뉴 포르투갈어 원문(저장소는 독일어 역 인용뿐) · 오륜서 「二腕」 읽기(J8).
