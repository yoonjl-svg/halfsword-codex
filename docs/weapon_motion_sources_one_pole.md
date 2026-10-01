# 한손 무기 · 장병기 동작 라이브러리 조사 (사브르 / 메서 / 레이피어 / 창·봉 / 곤봉)

작성일 2026-09-28. 대상: 물리 기반 검투 게임의 동작 테이블(가드 테이블, 기법 경로, 오버레이).

## 0. 읽기 전에: 근거 수준과 한계

- **[원전]** = 실제로 찾은 출처에 적혀 있는 내용(URL 제시). **[해석]** = 출처에서 끌어낸 추론. **[추정]** = 물리·인체 치수로 짐작한 값. 수치(좌표·각도·시간)는 모두 [추정]이다. 도판을 직접 재서 얻은 값이 아니다.
- **중요한 한계:** 이 세션의 네트워크 프록시가 WebFetch를 막았다. wiktenauer.com, hroarr.com, archive.org, swordfight.uk, wikipedia, gutenberg, selohaar.org, bop.unibe.ch 등 시도한 모든 도메인이 EGRESS_BLOCKED였다. 그래서 **[원전] 표시는 전부 WebSearch 결과 요약에 나온 내용**이다. 요약 속 문장은 해당 URL 페이지의 내용을 옮긴 것이지만, 원문을 직접 열어 대조하지는 못했다. 쪽수는 적지 않았다(지어내지 않음). 인용이 중요한 항목은 "▶검증 필요"로 표시했다.
- 좌표계(오른손잡이 기준): 손 위치는 [전방, 위, 칼 쪽] m이고 원점은 가슴(키 1.75 m, 가슴 높이는 지면에서 약 1.3 m로 가정)이다. 참고점: 칼 쪽 어깨 [0, 0.1, 0.2], 반대 어깨 [0, 0.1, −0.2], 정수리 약 +0.45, 눈 약 +0.33, 골반(엉덩이) 약 −0.3, 무릎 약 −0.8. 팔 도달 거리는 어깨에서 0.57 m이다. 칼날 방향은 [고각(°, + 위), 방위(°, + 칼 쪽)]이다. 방위 0은 정면이고 ±180은 뒤쪽이다. 골반·가슴 요(yaw)는 + = 칼 쪽 어깨가 뒤로, − = 칼 쪽 어깨가 앞으로(측면 자세)이다.
- 표적 표기는 **상대 신체 기준**이다(예: "상대 좌상단"). 오른손잡이가 오른쪽 위에서 대각으로 내려베면 상대의 좌상단(왼뺨·왼어깨)에 맞는다.

---

## 1. 한손 사브르 / 백소드 (18~19세기 영국·이탈리아 군용)

### 출처
- Charles Roworth, *The Art of Defence on Foot with the Broad Sword and Sabre* (1798; 4판 1824). 6가지 베기의 방향 정의 [원전]. 1824년 4판 PDF: https://swordfight.uk/wp-content/uploads/2018/01/ART-OF-DEFENCE-ON-FOOT-1824-Fourth-Edition.pdf (검색으로만 확인), 개요: https://en.wikipedia.org/wiki/The_Art_of_Defence_on_Foot_with_the_Broad_Sword_and_Sabre
- Henry Angelo, *Hungarian and Highland Broadsword* (1798, Rowlandson 도판 24장 중 도보 5장), *Guards and Lessons of the Highland Broadsword* (1799, "10 lessons") [원전]: https://www.keithfarrell.net/shop/guards-lessons-highland-broadsword-1799/ , https://www.princeton.edu/~graphicarts/2012/03/the_highland_broad_sword.html
- Thomas Page, *The Use of the Broad Sword* (1746). Roworth가 일부를 베꼈다 [원전]: https://www.keithfarrell.net/blog/2018/08/thomas-page-and-timothy-buck/ ; 본문: https://linacreschoolofdefence.org/Library/Page/Page.html
- Alfred Hutton, *Cold Steel* (1889). 도판에 Medium / Inside / Outside / Hanging Guard와 St. George's Guard("after James Miller, 1737")가 있다. 장 구성은 Guards, Moulinet, Cuts [원전]: https://theoldswordclub.com/tosc35-alfred-hutton-cold-steel-medium-guard-sabre/ , https://books.google.com/books/about/Cold_Steel.html?id=qY4yAwAAQBAJ
- Giuseppe Radaelli / Del Frate, *Istruzione per la scherma di sciabola e di spada* (1876) [원전]: https://radaellianscholar.blogspot.com/2021/04/direct-cuts-in-radaellian-sabre.html , https://saladellatrespade.com/2023/08/21/leaning-into-the-molinelli/

### 핵심 사실
- **6가지 베기(Roworth)** [원전, 검색 요약]: I 오른쪽→왼쪽 내려베기, II 왼쪽→오른쪽 내려베기, III 오른쪽→왼쪽 올려베기, IV 왼쪽→오른쪽 올려베기, V 오른쪽→왼쪽 수평, VI 왼쪽→오른쪽 수평. 7번(수직 머리 베기)은 Angelo 1817 *Infantry Sword Exercise* 계열에 있다고 기억하지만 **이번에 확인하지 못했다** [해석, ▶검증 필요]. Radaelli에는 "직접 머리 베기"가 있다. 2번 또는 3번 가드에서 손을 3번 자세로 돌리며 한 동작으로 팔을 뻗어 수직으로 내리친다 [원전].
- **4개 기본 교전 가드** [원전, 검색 요약]: 옛 사범들은 Inside, Outside, Medium, Hanging을 가르쳤다(swordfight.uk/the-guards 관련 요약).
- **Hanging guard**(Page 1746) [원전]: 오른발을 약간 뒤·옆으로 빼고, 칼 팔의 팔꿈치를 들고, 칼끝을 상대 가슴에 겨누며 자기 머리를 덮는다. 머리·어깨·얼굴·가슴을 막고, 칼끝으로 상대가 파고드는 것을 막는다(https://linacreschoolofdefence.org/Library/Page/Page.html 관련 요약). 칼자루가 머리 위에 있고 칼날이 몸 반대쪽으로 넘어가 걸린다. 기본형은 안쪽(prime) 행잉이다 [원전, swordfight.uk 요약].
- **St. George's guard**: Hutton 도판 VII에 있다 [원전]. 칼을 머리 위에 거의 수평으로 가로 들어 머리를 막는 자세로 알려져 있으나, 이번에 문장 수준 서술은 확인하지 못했다 [해석].
- **물리네(moulinet / molinello)**:
  - Hutton 계열 [원전, 검색 요약]: 유연성과 베기 방향을 익히는 수단이다. 이탈리아식에는 물리네가 많지만 꼭 필요한 것은 6가지다. 대각 내려 2, 대각 올려 2, 수평 2(좌→우, 우→좌). 차렷 자세(발뒤꿈치를 모으고 정면)로 연습한다.
  - Radaelli [원전]: 물리넬로는 **팔꿈치를 주 회전축으로 한 원형 베기**이다. 베려면 상대 칼에서 먼저 떼어야 한다. 실전에서는 원을 줄여 쓰되 축은 여전히 팔꿈치다.
- **앞에 나온 표적(손목·팔·다리) 공격**: Roworth·Angelo·Taylor는 상대가 내 다리 바깥쪽을 베면 **다리를 빼면서(slip) 동시에 머리나 손목을 베라**고 가르친다 [원전, Keith Farrell 글 요약: https://www.keithfarrell.net/blog/2018/06/how-scottish-is-the-broadsword-method-of-roworth-and-angelo/]. Roworth의 slip 정의: 상대가 노린 부위(팔·다리)를 빼서 칼이 헛치고 방어 자세가 무너지게 하는 것 [원전]. Page 1746에는 "outside half hanging guard가 손목을 노린 3번 베기를 막는다"는 서술이 있다 [원전, 검색 요약]. 즉 손목은 표준 표적이다.
- **빈손**: 사브르·브로드소드·스파드룬에서는 왼손을 **엉덩이에 얹거나** 등 뒤에 둔다 [원전, 검색 요약. Radaelli 쪽에서는 낮은 4번 막기 때 왼손을 왼쪽 엉덩이 옆에 둔다고 함]. 영국 군용 체계는 보조 무기를 쓰지 않는다 [원전, swordfight.uk 요약].

### 가드 테이블 [추정 수치]
| 가드 | 손 [전,상,칼쪽] | 칼날 [고각, 방위] | 골반/가슴 yaw | 전경 | 무릎 | 비고 |
|---|---|---|---|---|---|---|
| Medium (tierce 중간) | [0.45, −0.05, 0.20] | [+15, −5] | −45 / −55 | +5 | 0.08 | 기본 교전 자세, 칼끝은 상대 눈 |
| Inside guard (quarte 쪽) | [0.45, 0.00, 0.05] | [+20, −12] | −45 / −55 | +5 | 0.08 | 안쪽(가슴 쪽) 라인 막기 |
| Outside guard (tierce 쪽) | [0.45, −0.05, 0.32] | [+20, +12] | −45 / −55 | +5 | 0.08 | 바깥(칼 팔 쪽) 라인 막기 |
| Hanging guard | [0.40, 0.40, 0.12] | [−35, −25] | −50 / −60 | +5 | 0.10 | 팔꿈치 높이 듦, 칼끝은 상대 가슴 [원전 형태] |
| St. George / head | [0.30, 0.40, 0.08] | [+5, −80] | −40 / −50 | 0 | 0.08 | 머리 위 가로 막기 [해석] |
| Outside half-hanging | [0.40, 0.10, 0.35] | [−30, +20] | −45 / −55 | +5 | 0.08 | 손목·바깥 라인(3번 베기) 막기 [원전 이름] |

- 왼손(빈손): 엉덩이 [−0.05, −0.30, −0.18]에 고정한다 [해석]. 물리적으로는 몸통 회전 관성을 줄이고 칼 팔 쪽 측면 자세를 유지한다 [추정].
- 사거리 확인: Hanging 손까지 어깨에서 0.50 m, Medium 0.47 m로 도달 범위 안이다.

### 기법(손 경로) [경로 모양은 원전 방향 정의, 수치는 추정]
| 기법 | 시작 → 경유점 → 끝 | 표적 | 종류 |
|---|---|---|---|
| Cut 1 | Medium → 손 [0.30,0.30,0.30](칼 쪽 위로 감아 올림) → [0.55,0.05,0.05] → Inside guard | 상대 좌상단 | 베기 |
| Cut 2 | Medium → [0.30,0.30,0.00] → [0.55,0.05,0.30] → Outside guard | 상대 우상단 | 베기 |
| Cut 3 | Medium → [0.35,−0.30,0.30] → [0.55,−0.05,0.05] → Inside | 상대 좌하단(허벅지·다리) | 올려베기 |
| Cut 4 | Medium → [0.35,−0.30,0.00] → [0.55,−0.05,0.30] → Outside | 상대 우하단 | 올려베기 |
| Cut 5 / 6 | Medium → 옆 [0.35,0.0,±] → 반대편 수평 통과 | 상대 옆구리 좌/우 | 베기 |
| Cut 7 / Radaelli 직접 머리 베기 | Medium → 손목 회전만으로 [0.55,0.10,0.20], 칼날 고각 +40→−10 | 머리 | 베기(한 동작) |
| 손목 저지 베기(slip + cut) | Medium → [0.55,−0.02,0.25](짧은 손목·팔꿈치 스냅) → Medium, 동시에 앞다리 −0.3 m 뒤로 | 상대 칼 팔 손목·전완 | 베기 |
| 찌르기 | Medium → [0.57,0.02,0.18] | 중앙 찌르기 | 찌르기 |
| 물리네(6방향) | 팔꿈치 축 원: 손은 반지름 약 0.10~0.15 m 원을 그리고 칼끝은 약 0.8 m 원을 그림 | Cut 1~6과 같음 | 베기 |

### 타이밍·발놀림 [추정]
- 가드에서 베기(손목·팔꿈치 물리네): 0.25~0.35 s. 롱소드 Oberhau(0.4~0.5 s)보다 짧다. 칼 질량(약 0.8~1.0 kg)과 한손 레버 때문이다.
- 런지: 앞발 +0.6~0.8 m, 무릎 내림 0.2 m, 전경 +10°, 0.4~0.5 s. 회수 0.3~0.4 s.
- 손목 저지 베기는 뒤로 빠지면서 쓰는 "시간 베기"이다. 앞다리를 0.3 m 뺀다(slip).
- 쓰임: 거리가 길고 상대 팔이 먼저 나올 때 손목·팔을 노린다. 머리 막기는 Hanging/St. George.

### 롱소드와의 물리적 차이 [해석/추정]
1. 회전축이 어깨·몸통이 아니라 **팔꿈치·손목**이다(Radaelli [원전]). 몸통 요는 거의 고정된 측면 자세(−45 ~ −60°)다.
2. 빈손이 칼에 관여하지 않는다(엉덩이 고정). 좌측 미러 가드가 필요 없고 **한쪽(칼 쪽)으로 비대칭**이다.
3. 칼 팔과 손목이 가장 가까운 표적이다. 저지 베기가 기법 체계의 중심에 있다.
4. 막기 가드(Hanging, St. George)가 머리 위에 손을 둔다. 롱소드 Ochs와 비슷해 보이지만 칼끝이 아래로 걸린다.

---

## 2. 메서(Langes Messer) / 뒤삭(Dussack)

### 출처
- Johannes Lecküchner, *Kunst des Messerfechtens* (1478 Cpg 430 / 1482 Cgm 582). Wiktenauer 섹션 "Vier leger", "Weckerhaw", "Entrüsthaw", "Hengen", "Messernehmen" [원전 존재 확인, 본문 직접 열람 불가]: https://www.wiktenauer.com/wiki/Johannes_Leck%C3%BCchner/Vier_leger
- 해설: Freelance Academy Press, "Beating Plowshares Into Boars": https://freelanceacademypress.wordpress.com/2013/08/13/beating-plowshares-into-boars/ ; HEMA-Codex(독일어): https://hema-codex.de/de/langes-messer/huten/einfuehrung ; Cambridge 학술판 *Art of Swordsmanship by Hans Lecküchner* (Jeffrey Forgeng 역): https://www.cambridge.org/core/books/art-of-swordsmanship-by-hans-leckuchner/1DC31415413C12214CDCBCB1C9151D46
- Joachim Meyer, *Gründtliche Beschreibung* (1570) 뒤삭 편. 해설: Roger Norling, "Meyer Dussack – The Dussack in Motion" (HROARR 2014): https://www.hroarr.com/wp-content/uploads/downloads/2014/10/Norling-Roger-Meyer-dussack-article-v1-2-2014.pdf ; Adelaide Sword Academy 번역본: http://www.adelaideswordacademy.com/uploads/1/0/7/0/10705704/joachim_meyer_dussack_of_1570.pdf ; Grauenwolf: https://grauenwolf.wordpress.com/category/fencing/meyer/meyers-dussack/

### 가드 이름 검증
- **Lecküchner 4대 가드(vier leger)** [원전]: 롱소드 가드의 이름을 바꿨다.
  - Vom Tag → **Luginsland**("망루")
  - Ochs → **Stier**("황소")
  - Pflug → **Eber**("멧돼지")
  - Alber → **Pastei / Bastei**("보루")
  - (freelanceacademypress, hema-codex, hemaenthusiast 요약이 일치한다.)
- Luginsland [원전, 검색 요약]: 메서를 어깨 위로 올려 머리 한가운데 위까지 가져가고, **칼끝이 뒤로 등 너머로 늘어진다**. 엄지 그립이나 일반 그립 둘 다 쓴다.
- Stier [원전]: 얼굴 높이로 들어 상대를 수평으로 겨눈다(한손 Ochs).
- Eber [원전]: 칼자루를 오른쪽 또는 왼쪽 엉덩이 옆에 두고 칼끝은 앞이다.
- Pastei [원전]: 오른쪽 또는 왼쪽에서 칼날이 앞 무릎 안쪽에 온다.
- **Wechsel**: 4대 가드는 아니다. 칼 쪽에서 참날을 바깥으로 두는 낮은 자세로 언급된다 [원전, 검색 요약]. **"Eber?"**는 실제로 있다(Pflug를 대체). **"Bastei"**도 실제로 있다(Pastei 표기).
- **Meyer 뒤삭 가드** [원전, 검색 요약]: Zornhut, Stier, Wechsel, Bastei가 주요 가드이고, 목록에 Mittelhut, Eber, Wacht, Gerade Versetzung(Schnitt), Langort, Bogen도 있다. ▶검증 필요: 요약이 섞였을 수 있다. Meyer 뒤삭에서 **Zornhut, Stier, Wechsel, Bastei**가 핵심 4가드라는 점은 여러 결과가 일치한다.
  - Stier: 한손 Ochs 모양이고 빈손은 칼 가까이 가볍게 둔다. 칼끝은 턱 높이까지 내려온다 [원전, 검색 요약].
  - Wechsel: 칼날이 땅을 향한다 [원전].
  - Bastei: 칼날이 상대 쪽 45° 아래를 향한다 [원전].
  - Zornhut: 상대를 끌어내는 기만 자세다 [원전].
- **Luginsland와 Hangetort**는 Meyer 목록에도 나온다는 요약이 있으나 뒤삭 전용인지는 불명확하다 [▶검증 필요].

### 주요 베기
- Lecküchner의 "숨은 베기" 6가지 [원전, freelanceacademypress 요약]:
  - **Zornhau**: 롱소드와 이름·형태·기능이 거의 같다.
  - **Wecker**: Krumphau 대응.
  - **Entrüsthau**: Zwerchhau 대응.
  - **Zwinger**: Schielhau 대응.
  - **Geferhau**: Scheitelhau 대응.
  - **Wincker**: 추가된 6번째. 베는 도중 칼을 뒤집어 막기를 우회한다.
- Wecker [원전, 검색 요약]: 한쪽으로 베는 척하다 칼을 바꿔 짧은 날 베기나 찌르기를 하고, 결국 긴 날로 머리를 친다. Stier에 대한 대응이며 엄지 그립 회전과 팔꿈치 힘을 쓴다.
- Hengen(매달기) [원전]: 바인드에서 칼 면을 대고 Stier로 감는 등의 기법. 위쪽 매달기에서는 엄지가 아래로 간다.
- Nachreisen(뒤따라 치기) [원전]: 바인드 없이도, 바인드 안에서도 쓴다.
- **Messernehmen(칼 빼앗기)와 레슬링**: 빈손으로 상대 팔·칼을 잡는 기법이 체계의 큰 비중을 차지한다 [원전, 섹션 존재와 "throwing, armlocks" 요약].
- Meyer 뒤삭 4대 베기 [원전]: Oberhau, Zornhau, Mittelhau, Unterhau.

### 가드 테이블 [추정 수치] (Lecküchner 기준, 좌측은 칼쪽 좌표 부호만 반전)
| 가드 | 손 [전,상,칼쪽] | 칼날 [고각, 방위] | 골반/가슴 yaw | 전경 | 무릎 |
|---|---|---|---|---|---|
| Luginsland (우) | [0.10, 0.42, 0.10] | [−25, +165] (칼끝이 등 뒤로) | −20 / −25 | 0 | 0.10 |
| Stier (우) | [0.35, 0.30, 0.25] | [−5, −5] (얼굴 겨눔) | −30 / −35 | +5 | 0.10 |
| Eber (우) | [0.30, −0.30, 0.20] | [+15, −5] | −25 / −30 | +5 | 0.12 |
| Pastei (우) | [0.35, −0.45, 0.05] | [−40, 0] | −25 / −30 | +10 | 0.15 |
| Wechsel (우, Meyer) | [0.20, −0.45, 0.35] | [−45, +30] | −10 / −15 | +5 | 0.12 |
| Zornhut (Meyer) | [0.00, 0.25, 0.30] | [+30, +160] | +20 / +25 | 0 | 0.10 |

- 빈손: 가슴 앞 [0.25, −0.05, −0.15]에서 잡기를 준비한다 [해석, Messernehmen이 있으므로]. Meyer 뒤삭 Stier에서는 칼 가까이 둔다 [원전].
- 한손이라 롱소드보다 몸을 옆으로 틀어(yaw −20 ~ −35) 앞으로 뻗는 거리를 늘린다 [추정].

### 기법(경로) [추정]
| 기법 | 경로 | 표적 | 종류 |
|---|---|---|---|
| Zornhau | Luginsland → [0.35,0.30,0.25] → [0.55,0.05,0.00] → 반대편 Pastei | 상대 좌상단 | 베기 |
| Wecker | Luginsland → (페인트) [0.40,0.30,0.30] → 칼 뒤집어 짧은날 [0.50,0.20,−0.05] → 긴날 머리 | 머리 | 베기(페인트 포함) |
| Entrüsthau(수평) | Luginsland → [0.40,0.25,0.20] 손목 뒤집기 → 수평 [0.50,0.25,−0.10] | 상대 좌상단/머리 옆 | 베기 |
| Zwinger | Luginsland → 엄지 그립 [0.45,0.15,0.30] → 상대 칼 위로 | 상대 우상단 | 베기 |
| Geferhau | Luginsland → [0.55,0.05,0.10], 칼끝을 떨어뜨려 찌르기로 전환 | 머리 → 중앙 찌르기 | 베기→찌르기 |
| Wincker | 우 Luginsland → 대각 → 중간에 손목 반전(칼 면 180° 회전) → 반대 방향 | 상대 우상단 | 베기(우회) |
| Stier 찌르기 | Stier → [0.57,0.25,0.15] | 머리/중앙 | 찌르기 |
| 잡기(오버레이) | 빈손 → 상대 칼 팔 손목, 전진 0.4 m | – | 레슬링 |

### 타이밍·발놀림 [추정]
- Luginsland → Zornhau 명중: 0.3~0.4 s. 칼끝이 뒤에서 출발하므로 롱소드 Vom Tag보다 호가 크고 끝이 무거워 가속이 늦다.
- 한 걸음 패스 0.6~0.7 m. 바인드 뒤 잡기로 들어갈 때 전진 0.3~0.5 m.
- 쓰임: 칼끝이 무거운 한손 칼은 **큰 호로 베고, 바인드에서 빈손이 들어가는** 흐름이 핵심이다.

### 롱소드와의 차이 [해석/추정]
1. 가드 기하는 롱소드와 같다(이름만 바꿈 [원전]). 따라서 **기존 테이블을 재사용**하되 한손 도달 범위와 몸통 틀기로 보정한다.
2. 빈손이 자유롭다. 잡기·팔 누르기가 표준 기법이다(롱소드의 레슬링보다 더 자주 쓴다).
3. 칼끝이 무겁다(팔키온·뒤삭 무게중심이 칼자루에서 약 15~20 cm). 손목 반전 기법(Wincker, Wecker)은 반전 뒤 각운동량이 크므로 **회복이 느리다**. 물리 엔진에서는 자연히 드러난다 [추정].
4. 엄지 그립(칼 면에 엄지)이 있어 칼날 롤 각도가 롱소드와 다르다(Hengen [원전]).

---

## 3. 레이피어 (Capo Ferro 1610, Fabris 1606, Giganti 1606)

### 출처
- Ridolfo Capo Ferro, *Gran Simulacro dell'Arte e dell'Uso della Scherma* (Siena 1610). Tavern Knight 장별 해설: https://thetavernknight.wordpress.com/2016/09/07/capo-ferro-chapter-ix-the-thighs-the-legs-the-feet-and-the-stance/ ; 영역 "Practical Capo Ferro"(Wilson): https://mac9.ucc.nau.edu/manuscripts/pcapo/ ; Swordschool: https://wiki.swordschool.com/wiki/Interpreting_Capoferro
- Salvator Fabris, *Lo Schermo, overo Scienza d'Arme* (1606): https://en.wikipedia.org/wiki/Salvator_Fabris
- Nicoletto Giganti, *Scola, overo Teatro* (1606). **런지를 온전히 서술한 최초의 책**으로 평가된다 [원전]: https://wiktenauer.com/wiki/Scola,_overo_teatro_(Nicoletto_Giganti) , https://labirinto.ca/wp-content/uploads/2022/09/Giganti-Nicoletto-Scola-overo-teatro-1606-and-Marginalia-rev-2022-09-12.pdf
- 용어: Academie Duello 위키 https://www.academieduello.com/learn/resources/wiki/italian-swordplay-terms/ ; HROARR "A short note on strengeren": https://hroarr.com/article/a-short-note-on-strengeren-or-gaining-the-blade/

### 핵심 사실
- **4가드 = 손목 회전 상태** [원전]. Capo Ferro의 "가드"는 칼 손목을 돌린 정도를 가리키므로, 몸 자세와 칼 높이는 상당히 달라질 수 있다(Wilson 해설 요약). 회전 정의는 다음과 같다 [원전, 검색 요약].
  - prima: 참날 위, 손바닥 오른쪽
  - seconda: 참날 오른쪽, 손바닥 아래
  - terza: 참날 아래, 손바닥 왼쪽
  - quarta: 참날 왼쪽, 손바닥 위
  - 전형적 높이: prima는 머리 위(칼을 뽑은 직후 위치), seconda는 어깨 높이, terza는 그보다 낮다 [원전 요약].
- **Terza 자세**(Capo Ferro, 검색 요약. ▶검증 필요, 현대 해설 문장일 수 있음):
  - 앞발은 정면, 뒷발은 90°. 앞다리는 거의 편다. 뒷다리는 굽힌다(Capo Ferro 9장: "뒷무릎을 가능한 한 굽힌다" [원전]).
  - 몸은 세우고 오른어깨가 앞이다. 몸통은 약간 뒤로 기울이고 체중은 약간 뒤다.
  - 칼 팔은 굽히고 전완은 대략 수평이다.
  - **빈손은 가슴 중상단 높이 앞에 느슨하게** 두고 팔꿈치는 엉덩이 쪽으로 떨어뜨린다.
- **런지(passo straordinario)** [원전]: 칼 길이는 "팔 길이의 두 배이자 나의 비상 보폭(=런지)과 같고, 겨드랑이부터 발바닥까지의 길이와 같다". 찌를 때는 앞무릎을 최대한 굽혀 예각을 만들고, 뒷다리는 비스듬한 선으로 최대한 편다(9장).
- **동작 순서**: 팔 → 몸 → 다리 [원전, 검색 요약. Capo Ferro 계열 해설].
- **Fabris** [원전, 검색 요약]: 네 자세 모두 **몸을 앞으로 숙이고**, 발은 작은 보폭 안에 두고, 팔과 칼을 최대한 곧게 뻗는다. seconda 변형이 넷이다.
- **Misura** [원전, Academie Duello]:
  - misura larga: 런지로 닿는 거리
  - misura stretta: 몸을 뻗거나 기울이기만 해도 닿는 거리
  - misura strettissima: 뻗기만으로 상대 앞팔에 닿는 거리
- **Stringere**(칼 잡기) [원전]: Capo Ferro는 "내 칼의 forte로 상대 칼의 debole을 직선으로 조이되(stringa) 닿지 않고 타며, 찌를 때만 상황에 따라 안쪽 또는 바깥쪽으로 밀어낸다"고 쓴다. forte는 칼자루부터 중간까지이고 막는 데 쓴다. debole은 중간부터 끝까지이고 찌르는 데 쓴다.
  - Giganti [원전]: 상대 칼이 왼쪽(높거나 낮게)에 있으면 사거리 밖에서 **상대 칼 위로 거의 닿을 듯이** 곧고 강한 걸음으로 들어가 stringere한다. 칼은 막기와 찌르기가 둘 다 되는 위치에 둔다.
- **회피**: girata(뒷어깨를 선 밖으로 돌림), passata sotto(몸을 낮추고 뒷다리를 뒤로 차며 빈손을 바닥에 짚는 낮은 찌르기) [원전, 검색 요약].

### 가드 테이블 [추정 수치]
| 가드 | 손 [전,상,칼쪽] | 칼날 [고각, 방위] | 손목 롤 | 골반/가슴 yaw | 전경 | 무릎 |
|---|---|---|---|---|---|---|
| Terza (Capo Ferro 기본) | [0.35, −0.12, 0.25] | [+12, −3] (칼끝은 상대 얼굴) | 손바닥 왼쪽 | −60 / −70 | −5 (뒤로) | 0.12 |
| Quarta | [0.35, −0.05, 0.08] | [+10, +2] | 손바닥 위 | −60 / −70 | −5 | 0.12 |
| Seconda | [0.45, 0.10, 0.28] | [−3, −3] | 손바닥 아래 | −60 / −70 | 0 | 0.12 |
| Prima | [0.30, 0.40, 0.18] | [−20, −10] | 참날 위 | −55 / −65 | 0 | 0.10 |
| Fabris식 숙인 seconda | [0.50, 0.00, 0.22] | [0, −2] | 손바닥 아래 | −55 / −65 | +25 | 0.22 |

- 빈손: [0.25, 0.05, −0.12] 가슴 앞이고 팔꿈치는 아래다 [원전 형태, 수치 추정]. 가까이서 상대 칼을 밀어내는 데 쓴다.
- 발 간격: 평상 자세 0.5~0.6 m [추정].

### 기법·오버레이 [추정]
| 기법 | 경로 | 표적 | 종류 |
|---|---|---|---|
| Stoccata (terza 찌르기) | Terza → [0.57, 0.00, 0.20](팔 먼저) + 런지 오버레이 | 중앙/상대 우어깨 [원전: stoccata는 terza에서 상대 오른쪽 어깨로] | 찌르기 |
| Punta riversa | Quarta → [0.57, 0.05, 0.05] + 런지 | 상대 바깥 어깨 [원전] | 찌르기 |
| Imbroccata | Prima/seconda → 아래로 [0.55, 0.05, 0.15] | 가슴 | 찌르기 |
| Stringere(오버레이) | 현재 가드 유지, 손을 칼 쪽 또는 안쪽으로 ±0.05 m 옮겨 상대 debole 위에 forte를 둠. 반 걸음 0.2~0.3 m 전진 | – | 칼 잡기 |
| Cavazione(칼끝 돌려 빼기) | 손 고정, 칼끝이 상대 칼 밑으로 반지름 약 0.1 m 반원 | 반대 라인 | 전환 |
| Girata | 찌르며 골반 yaw −60 → −100, 뒷발 옆으로 | 중앙 | 찌르기+회피 |
| Passata sotto | 전경 +45, 무릎 0.5, 빈손을 바닥에, 손 [0.55,0.05,0.2] | 복부 | 찌르기+회피 |

**런지 오버레이 [추정 수치]**
- 앞발 +0.7~0.9 m(겨드랑이~발바닥 약 1.3 m는 "보폭"의 기준 길이이고, 실제 앞발 이동은 그보다 짧다고 해석).
- 앞무릎을 크게 굽혀 무릎 내림 0.25~0.30 m. 전경 +10~20°, 빈손은 뒤·아래로 뻗어 균형을 잡는다.
- 소요 0.35~0.5 s. 순서: 팔 0~0.1 s → 몸 → 발 착지. 회수(뒷다리로 밀어 복귀) 0.4~0.5 s.
- 총 도달 증가량은 손 기준 약 +0.9~1.1 m.

### 롱소드와의 차이 [해석/추정]
1. 가드가 **손목 롤(4상태)과 칼끝 라인**으로 정의된다. 손 위치 이동은 작고 칼 방향 차이도 수 도 수준이다. 롱소드 가드처럼 칼을 크게 들어 올리지 않는다.
2. 공격 대부분이 **찌르기 + 런지**이고 베기는 부수적이다. 거리(misura) 관리와 칼 잡기(stringere)가 핵심 상태 변수다.
3. 측면 자세가 극단적이다(yaw −60 ~ −70). 뒷무릎을 굽히고 체중을 뒤에 둔다(Capo Ferro). Fabris는 반대로 앞으로 숙인다. 한 무기 안에서 두 스타일을 만들 수 있다.
4. 칼이 길고(날 약 1.1 m) 끝이 가볍다. 칼끝 이동은 작고 빠르며 방향 전환 비용이 낮다.

---

## 4. 창 / 장병기 (향후 "pole" 프레임)

### 출처
- Joachim Meyer 1570, 짧은 봉(Halbe Stange)을 기반으로 미늘창(Helleparten)과 긴 봉(파이크)으로 확장. Meyer는 **"봉이 모든 장병기의 기초"**라고 했다 [원전, 검색 요약].
  - HROARR: https://hroarr.com/article/joachim-meyer-halben-stangen-techniques/
  - Norling, "Meyer Halberstangen – Trap him in his own actions" (2014): https://www.hroarr.com/wp-content/uploads/downloads/2014/12/Meyer-halberstangen-article-2014-v2-0.pdf
- George Silver, *Paradoxes of Defence* (1599) [원전]: http://www.pbm.com/~lindahl/paradoxes.html
- Fiore dei Liberi 창(lanza): Gregory Mele, "The Spear of Fiore dei Liberi": https://www.selohaar.org/CW2010/The_Spear_of_Fiore_dei_Liberi.pdf ; https://fightlikefiore.wordpress.com/category/spear/spear-on-foot/

### 핵심 사실
- **Meyer 봉의 주요 가드** [원전, HROARR]: Oberhut(좌·우), Gerade Versatzung(=Mittelhut, 가장 많이 싸우는 자세), Unterhut, Wechselhut(주 가드는 아니나 핵심 자세), Steurhut, Nebenhut(좌). 이 가드들을 교차 베기 연습 **Kreutzhauw**로 잇는다.
  - Oberhut [원전]: 왼발을 앞에 두고, **봉 꼬리를 가슴에 대며 봉끝은 하늘로 곧게 세운다**. 양쪽으로 하고, 발 간격은 너무 넓히지 않는다.
  - Steurhut [원전]: 오른쪽 Oberhut에서 봉끝을 왼쪽 아래 Nebenhut 쪽으로 끌어내린 자세. 또는 Unterhut에서 **뒷손을 겨드랑이에서 앞·위로 들어 올려** 봉 뒤로 몸을 보호한다.
  - Unterhut·Steurhut 연습 [원전]: 두 가드 중 하나에서 시작해 어느 가드로든 치면서 막는다.
- **꼬리(뒷끝) 공격** [원전, Norling 요약]: 바인드에서 상대가 누르면 뒷끝을 들고 **뒷손을 봉 가운데 쪽으로 미끄러뜨려** 뒷끝으로 위에서 대각으로 상대 얼굴을 친다. 빗나가면 뒷끝이 상대 봉을 넘어가 걸어 누른다.
- **미끄러뜨려 찌르기** [원전, 검색 요약. 역사적 쿼터스태프 문헌의 "dart"]: 앞손을 풀고 앞발을 딛으며(펜싱 런지처럼) 뒷손을 최대한 앞으로 뻗는다. Meyer 쪽에는 "교차 손을 떼고 한손으로 최대 거리까지 찌른다"는 요약도 있다 [원전 요약, ▶검증 필요].
- **Silver의 길이 공식** [원전]: 봉을 몸 옆에 세워 왼손으로 잡고, 오른손을 최대한 위로 뻗은 높이에 두 손을 놓을 공간을 더한 것이 알맞은 길이다. 보통 8~9피트(2.4~2.7 m)가 되며, 다른 장병기와 양손검도 같은 방법에 기초한다.
- **Fiore 창** [원전]: 좌우 각 3개, 모두 6개의 posta. Tutta Porta di Ferro, Mezza Porta di Ferro, Vera Croce, Finestra(좌·우), Dente di Zenghiaro(Tutta Porta di Ferro의 거울상, 창을 세우고 왼손이 위, 오른발 앞, 뒤에 체중)가 확인된다. **칼끝이 선 위에 있는 것은 좌우 Finestra뿐**이다. 찌르기 교환은 Tutta Porta di Ferro, Mezza Porta di Ferro, Finestra 오른쪽에서 연습한다.
- **Marozzo 폴액스(azza)**: *Opera Nova*(1536)에 장병기가 있다는 것만 확인했고 가드 세부는 찾지 못했다.
- **일본 창술**: 이번 조사에서 다루지 않았다.

### 손 간격 [추정]
- 짧은 봉(2.4~2.7 m): 두 손 간격 0.5~0.8 m. Oberhut에서 뒷손이 가슴이고 앞손은 약 0.6 m 위다.
- 창: 0.6~0.9 m. 미끄러뜨려 찌를 때는 뒷손이 앞손까지 0.4~0.6 m 이동해 순간 간격이 0.1~0.3 m가 된다.
- 미늘창: 0.5~0.7 m이고, 머리가 무거워 앞손이 머리 쪽으로 더 간다.

### 가드 테이블 [추정] (왼발 앞 = 골반 yaw +, 뒷손 = 칼쪽 손)
| 가드 | 뒷손 | 앞손 | 봉끝 방향 [고각, 방위] | 골반/가슴 yaw | 전경 | 무릎 |
|---|---|---|---|---|---|---|
| Mittelhut / Gerade Versatzung | [0.10, −0.25, 0.15] | [0.45, −0.05, −0.05] | [+10, 0] (상대 얼굴) | +35 / +30 | +5 | 0.12 |
| Oberhut (우) | [0.15, 0.00, 0.05] | [0.25, 0.50, 0.05] | [+85, 0] (수직) | +30 / +25 | 0 | 0.10 |
| Unterhut | [0.05, 0.00, 0.20] | [0.40, −0.25, 0.00] | [−30, 0] (낮게 앞) | +35 / +30 | +5 | 0.15 |
| Steurhut | [0.30, 0.35, 0.15] | [0.25, −0.10, −0.20] | [−60, −30] | +30 / +20 | +5 | 0.12 |
| Nebenhut (좌) | [0.15, −0.10, 0.10] | [0.05, −0.30, −0.25] | [−20, −150] (뒤로) | +45 / +50 | 0 | 0.12 |
| Wechselhut (우 아래) | [0.10, −0.15, 0.00] | [0.00, −0.35, 0.25] | [−25, +150] | +20 / +10 | 0 | 0.12 |

### 기법 [경로 추정]
| 기법 | 경로 | 표적 | 종류 |
|---|---|---|---|
| 미끄러뜨려 찌르기 | Mittelhut → 뒷손 [0.10,−0.25,0.15]→[0.50,−0.08,−0.02], 앞손 고정 후 해제, 앞발 +0.6 m | 중앙/머리 | 찌르기 |
| 한손 원거리 찌르기 | Mittelhut → 앞손 놓음, 뒷손 [0.57,0.05,0.20], 런지 +0.8 m | 중앙 | 찌르기(최대 사거리) |
| Oberhau(봉) | Oberhut → [0.40,0.30,0.00] → Unterhut | 머리 | 치기 |
| Kreutzhauw(교차) | Oberhut(우) → Unterhut → Oberhut(좌) → Nebenhut… 연속 | 좌/우 상단 | 치기(연속) |
| 뒷끝 치기 | 바인드 → 뒷손을 중간으로 0.3 m 슬라이드 → 뒷끝이 위에서 대각 → 상대 얼굴 → 상대 봉을 걸어 누름 | 머리 | 치기(근거리) |
| Steurhut 막기→치기 | Unterhut → Steurhut(뒷손 올림) → Oberhau | 머리 | 막기+치기 |

### 타이밍 [추정]
- 미끄러뜨려 찌르기: 0.25~0.35 s. 뒷손이 앞으로 가고 앞손은 가이드 역할만 한다.
- 치기: 0.4~0.6 s. 관성 모멘트가 커서 롱소드보다 느리다.
- 발 간격 0.6~0.7 m. 전진은 한 걸음(패스)으로 0.6~0.8 m.

### 롱소드와의 차이 [해석/추정]
1. **두 손이 봉 위의 서로 다른 점을 잡고, 그 점이 이동한다**. 가드 = (뒷손 위치, 앞손 위치 또는 간격). 롱소드 테이블의 "한 손 위치 + 칼 방향"과 구조가 다르다. 새 필드가 필요하다: grip_spacing(m), grip_slide(m/s).
2. 찌르기의 동력원이 팔 뻗기가 아니라 **앞손을 통한 뒷손 밀기**다.
3. 양쪽 끝이 무기다(뒷끝 치기 [원전]). 끝 선택 필드가 필요하다.
4. 기본 자세가 **왼발 앞**이다(Meyer Oberhut [원전]). 오른손잡이 뒷손이 칼 쪽이므로 골반 yaw가 +다.

---

## 5. 곤봉·메이스·플레일: 몸의 역학이 근본적으로 다른가?

**짧은 답: 근본적으로 다르다는 원전 증거는 찾지 못했다.** 원전은 오히려 같은 체계 안에서 가르친다.
- Meyer: "봉이 모든 장병기의 기초" [원전]. Silver: 다른 장병기와 양손검도 같은 방법에 기초한다 [원전, http://www.pbm.com/~lindahl/paradoxes.html 관련 요약].
- Talhoffer (1467): 결투용 방패 + **Kolben**(프랑켄식 재판 결투. 슈바벤식은 칼을 쓴다)이 나온다. 법률 문헌은 재판 결투 무기를 항상 Kolben으로 적는다. 그림으로 보면 단순한 몽둥이가 아니라 특별히 설계된 나무 메이스다 [원전, 검색 요약. Ariella Elema, "Tradition, Innovation, Re-enactment: Hans Talhoffer's Unusual Weapons", *Acta Periodica Duellatorum* 7(1), 2019: https://bop.unibe.ch/apd/article/view/6870 — 본문 미열람]. 요약에 따르면 이 결투의 주 전술은 **방패를 상대 방패와 상대 사이로 밀어 넣는 것**이다. 기법의 중심이 곤봉이 아니라 방패다 [원전 요약].
- Paulus Hector Mair (16세기 중반): 농민용 도리깨(flail)와 낫 등 약 17가지 무기를 도판으로 수록 [원전]: https://en.wikipedia.org/wiki/Paulus_Hector_Mair , 분석 PDF: http://www.weeklywarfare.net/wp-content/uploads/2012/06/The-Flail-of-Paulus-Hector-Mair-18Jun2012.pdf (본문 미열람). 도리깨의 몸 역학을 서술한 문장은 확인하지 못했다.
- **[추정] 물리적 차이**: 곤봉·메이스는 날 정렬(edge alignment)이 필요 없다. 그래서 손목 롤 제어를 생략하고, 타격 중심이 머리에 몰려 **관성이 크고 회복이 느린** "commit" 동작이 된다. 찌르기는 거의 없다. 도리깨만 사슬 때문에 2단 진자이므로 원 운동을 유지해야 하고, 가드에서 정지하기 어렵다. 따라서 **메이스는 기존 칼 가드와 베기 경로를 재사용**하고, 무기 질량 분포와 "날 정렬 불필요" 플래그만 바꿔도 충분하다고 본다. 도리깨만 새 동작 계층(지속 회전)이 필요하다.

---

## 6. 요약표: 무기군별 최소 세트

재사용 = 현재 롱소드 테이블(Vom Tag, 어깨 Vom Tag, Ochs, Langort, 옆 가드, Pflug, Wechsel, Nebenhut, Alber + 좌측 미러 / Zornhau, Oberhau, Zwerchhau, Unterhau, 찌르기, 페인트)에서 좌표만 보정해 쓸 수 있는 것.

| 무기군 | 가드 수 | 기법 수 | 오버레이 수 | 재사용(롱소드에서) | 새로 필요 |
|---|---|---|---|---|---|
| **사브르/백소드** | 5 (Medium, Inside, Outside, Hanging, St. George) — 좌측 미러 없음 | 8 (Cut 1~6, 머리 직접 베기, 찌르기) + 손목 저지 베기 = 9 | 3 (런지, 다리 빼기 slip, 팔꿈치 물리네 루프) | Langort→Medium 위치, Ochs 좌표 일부를 Hanging의 기준으로, Oberhau/Unterhau 경로 모양을 Cut 1~4에 | Hanging/St. George(칼끝 아래로 걸기), 팔꿈치 축 물리네, 손목 표적 저지 베기, 빈손 엉덩이 고정 |
| **메서/뒤삭** | 4 + 미러 = 8 (Luginsland, Stier, Eber, Pastei) + Wechsel (+ Meyer Zornhut 선택) | 6 (Zornhau, Wecker, Entrüsthau, Zwinger, Geferhau, Wincker) + Stier 찌르기 = 7 | 2 (빈손 잡기/Messernehmen, 패스 스텝) | 가드 4개가 Vom Tag/Ochs/Pflug/Alber와 거의 같음 [원전]. 한손 도달 범위와 몸통 틀기만 보정. Zornhau, Zwerchhau(→Entrüsthau), Krumphau 계열 경로 재사용 | Luginsland의 칼끝 뒤로 늘어짐, 엄지 그립 롤, Wincker 중간 반전, 빈손 잡기 |
| **레이피어** | 4 (terza, quarta, seconda, prima) + Fabris 숙인 변형 1 = 5 | 5 (stoccata, punta riversa, imbroccata, cavazione, girata 찌르기) + passata sotto = 6 | 3 (런지+회수, stringere, 거리 단계 larga/stretta) | Langort·Pflug의 손 위치를 terza/quarta 기준으로. 롱소드 찌르기 경로 일부 | 손목 롤 4상태 필드, 극단적 측면 yaw, 깊은 런지(무릎 0.25~0.3 m, +0.8 m), stringere 상태 |
| **봉·창·미늘창** | 6 (Mittelhut, Oberhut, Unterhut, Steurhut, Nebenhut, Wechselhut) — Oberhut만 좌우 | 6 (미끄러뜨려 찌르기, 한손 원거리 찌르기, Oberhau, Kreutzhauw 연속, 뒷끝 치기, Steurhut 막기→치기) | 3 (그립 슬라이드, 런지/패스, 끝 선택) | 이름(Oberhut/Unterhut/Nebenhut/Wechsel)과 Kreutzhauw의 교차 베기 개념 | **두 손 위치 + 그립 간격 필드**, 왼발 앞 기본, 슬라이드 찌르기, 뒷끝 타격 |
| **메이스/곤봉** | 롱소드 한손판 3~4 (예: 사브르 Medium, Hanging + 메서 Luginsland, Eber) | 4 (내려치기, 대각 좌/우, 올려치기) | 1 (방패 오버레이, Talhoffer 결투 기준) | 거의 전부 재사용. 날 정렬 제약만 끔 | 무거운 머리 관성 파라미터. 도리깨는 지속 회전 계층 |

**구현 우선순위 제안 [해석]**
1. **메서**: 가장 싸다. 롱소드 가드를 한손으로 보정하고 빈손 잡기만 추가하면 된다.
2. **사브르**: 가드 5개와 물리네 1종을 새로 만들어야 하지만 스타일 대비가 크다.
3. **레이피어**: 손목 롤 필드와 런지 오버레이 확장이 필요하다.
4. **봉·창**: 가드 데이터 구조(두 손)부터 바꿔야 한다.

**다음에 검증할 것(네트워크 허용 시)**
- Wiktenauer의 Lecküchner "Vier leger" 원문
- Hutton *Cold Steel*의 Hanging/St. George 문장과 Cut 7 유무
- Meyer 뒤삭 가드 전체 목록
- Capo Ferro 빈손·terza 서술(현대 해설과 원문 구분)
- Meyer 봉의 한손 찌르기 원문
