# CombatLab Unity — 리서치·구현·검증 상세 인계서

**작성 기준: 2026-09-27 08:47 KST**  
대상: 프로젝트를 이어받을 게임/애니메이션/물리 개발자  
범위: 지금까지의 무기·무술/검술·인체/해부학·물리학 조사와 실제 적용 결과  
형식: UTF-8 Markdown 단일 파일. 외부 출처는 URL로, 프로젝트 내부 자료는 루트 기준 경로로 표기했다.

## 1. 먼저 읽을 현재 상태

이 문서는 기존에 수행한 조사·소스·저장된 JSON/XML/렌더 증거를 종합한 **시점별 인계서**다. 이번 문서 작성 중 외부 원문 전체를 다시 검증한 것은 아니다. 자료 존재, 초록/서지 확인, 원문 이미지 열람, 데이터 취득·이용권, 코드 구현, 자동 검사, 화면 검토, 사용자/전문가 승인을 분리한다.

- 목표는 약1분 동안 접근·공격·방어·후퇴·승패·재시작을 경험하는 작은 1대1 결투다. 무기 선택의 최종 상품 설계는 미정이다.
- 14종 무기 프로필이 있으며 기본은 Albion Crécy. 일본 카타나·중국 관도, 창작 광검·엑스칼리버·나뭇가지·얼린 통닭을 포함한다. 강약 차이는 허용하지만 자동 무적/필패를 없애는 것이 목표다. 모든 무기의 모든 전략에서 이를 입증한 상태는 아니다.
- Unity 결투의 **무기는 유한 힘을 받는 동적 강체**다. **사람 전체는 제작 포즈/IK와 kinematic hurtbox**다. 전신 근골격 역학, 지면 반력에 의한 균형, 실제 조직 절삭은 구현하지 않았다.
- 사용자 피드백에서 기존 CMU 동작의 뻣뻣함·관절 뒤틀림·칼면 타격·어색한 자세가 거절됐다. 현재 기본 장검은 Fiore 문헌 참고 제작 동작이며, 아직 사용자/검술 전문가의 품질 승인은 없다.
- 숙련도100 고정, S 느리게 보기 유지. 상대는 반복 막힘 뒤 베기/찌르기를 전환한다. 폴암 자루 충돌은 현재 **`--duel-polearm-shaft` opt-in 후보**이며 기본OFF다. 아래 실험 성과를 기본 전체게임 완성으로 읽지 않는다.
- 현재 Mac 후보 빌드는136,995,671 bytes,11.556796초,오류0·경고0. EditMode39/39, 자루 연속 접촉 포함 PlayMode15/15를 확인했다. 최신 후보의 전체14무기/12보행/4접촉 통합 재실행은 아직 별도 필요하다.
- 마지막 완료된 iOS는 **Polearms 스냅샷**의 unsigned arm64 앱이다. 새 양손 찌르기/상대 AI/자루 후보를 포함하지 않는다. 실제 iPhone 설치·터치·햅틱·프레임·발열 검증은 없다.
- 비용 지출·프로젝트 업로드는 없다. 과거 웹 실험 문서의 구매 예산 문구를 현재 구매 승인으로 사용하지 않는다. 본 문서 생성은 다른 사람에게 전송하거나 프로젝트를 업로드한 것이 아니다.

### 읽는 순서

1. 무기별 수치와 출처/추정 구분
2. 검술·유파·동작 자료와 인체 표현의 근거
3. 물리/인체 연구 후보의 실제 채택 여부
4. 현재 제어기·충돌·피해의 구현
5. 적용 뒤 생긴 문제와 성공/실패 실험
6. 재현 경로와 다음 개발 우선순위

**수치 정밀도 주의:** 관성의 소수 여러 자리는 계산 재현을 위한 표기이며 실측 정확도가 아니다. 민감도 범위도 측정 오차나 통계적 신뢰구간이 아니다.

## 2. 무기 리서치 상세

현재 무기 카탈로그를 인계용으로 풀어 쓴 자료입니다. 기준 파일은 `Assets/DuelLab/Resources/weapon-catalog.json`, 출처·방법 요약은 `Documentation/Weapons/README.md`, 재현 스크립트는 `Documentation/Weapons/generate_catalog.py`입니다. 이 문서는 해당 로컬 기록을 대조해 정리했으며 원 출처 웹페이지를 새로 조사하거나 검증하지 않았습니다.

### 공통 해석과 추정 방법

- SI 단위입니다: 길이 m, 질량 kg, 관성 kg·m². 기록된 공표값과 모델값을 한 무기 안에서도 분리합니다. 박물관/제조사 실물은 전부 `simulationClass: reconstruction`이며, 역사적 치수 일부를 참조했다는 뜻이지 완전한 역사 복원이나 동작 검증이 아닙니다.
- 좌표 원점은 **가상 그립 구간 중점**. 로컬 +Y는 끝 방향, +X는 날/머리 폭, +Z는 두께입니다. `centerOfMassFromGuardM`는 가상 가드에서 +Y 방향 거리입니다. 비교에 혼동이 없도록 아래에는 guard 기준값과 로컬 COM Y를 함께 씁니다: `COMlocalY = gripLengthM/2 + centerOfMassFromGuardM`.
- 현재 런타임은 longsword/arming_sword/dagger/katana/energy_sword에 `strikeStart = grip/2`, `strikeLength = bladeLength`를 씁니다. hammer/axe/polearm/staff/novelty는 `strikeStart = totalLength - grip/2 - bladeLength`, 같은 `strikeLength = bladeLength` 규칙입니다. 따라서 폴액스·관도의 JSON `bladeLengthM`은 게임용 머리 축길이이지 언제나 날 길이라는 뜻이 아닙니다. 이 값은 runtime에서 계산되며 JSON 최상위에 따로 저장되지는 않습니다.
- 검류 관성은 길이방향을 8개 직육면체로 나눈 테이퍼 모형입니다. 기본 질량분율은 guard 13%, grip+tang 8%이며, 나머지 날/폼멜 질량을 총질량과 목표 COM에 맞도록 풉니다. 이 분할·단면·테이퍼는 계측이 아닙니다.
- 자루 무기는 자루와 대칭 머리 박스 두 개로 근사합니다. head fraction은 Met 짧은 망치 60%, Paço 긴 망치 55%, Met 폴액스 52%, Paço 관도 42%로 둔 모형 입력입니다. British Museum 도끼는 별도로 `mass = 0.966 kg 머리 + 650 kg/m³ × 가정 자루 박스 부피`입니다.
- 관성은 COM 주위 직육면체 관성에 평행축 항을 합산합니다: `Ixx=Σm((sy²+sz²)/12+(y-COMy)²)`, `Iyy=Σm(sx²+sz²)/12`, `Izz=Σm((sx²+sy²)/12+(y-COMy)²)`. 대칭축외 COM 및 관성곱은 생략됩니다. 관성은 모두 **derived estimate**, 진자 실험 등 실물 측정이 아닙니다.
- JSON의 `scenarioMin/Max`는 그립·테이퍼·질량배분·COM·머리길이·가정 목재밀도를 바꾼 민감도 시나리오입니다. 측정오차·통계적 신뢰구간·역사적 개체의 보장 범위가 아닙니다.
- `damageMultiplier`와 `motorStrengthMultiplier`는 유한한 게임 밸런스/제어 설정이며 실제 상해·근력·승패를 뜻하지 않습니다. fictional/playful의 수치는 전부 창작 설정입니다. 해당 프로필에서 파생한 COM/관성은 모형 내부 계산일 뿐 현실 물성은 아닙니다.

### 카탈로그 14종

#### 1. 크레시 장검 · Albion (`albion-crecy`)

- **분류:** `longsword` / `reconstruction`. 참조유형: `manufacturer-specification`.
- **게임 프로필:** 전체 1.1370 m; 타격구간 시작 0.0900 m, 길이 0.9000 m; 그립 0.1800 m; 질량 1.39000 kg.
- **COM:** 가상 가드 기준 +0.10160 m; 그립중점 기준 로컬 Y 0.19160 m. **관성 (X,Y,Z):** (0.105692774, 0.000939474, 0.106544974) kg·m².
- **필드 근거:** 전체길이 `published`; 날/머리 축길이 `published`; 그립 `inferred`; 질량 `published`; COM `published-reference-interpreted`; 폭 `published`; 관성 `derived`. source access 메모: Primary page read directly.
- **출처:** [원 제공자 기록](https://albion-swords.com/product/the-crecy/)
- **해석 경계:** Albion의 해당 Crécy 제품 값만 사용합니다. 근사 질량모형은 날을 8개 테이퍼 직육면체로 나누며, 원본 메시나 실측 관성이 아닙니다. Crecy 1.39 kg / 10.16 cm는 Liechtenauer와 섞지 않습니다.

#### 2. 리히테나워 연습검 · Albion (`albion-liechtenauer`)

- **분류:** `longsword` / `reconstruction`. 참조유형: `manufacturer-specification`.
- **게임 프로필:** 전체 1.2065 m; 타격구간 시작 0.1100 m, 길이 0.9270 m; 그립 0.2200 m; 질량 1.58000 kg.
- **COM:** 가상 가드 기준 +0.09800 m; 그립중점 기준 로컬 Y 0.20800 m. **관성 (X,Y,Z):** (0.137452284, 0.001139374, 0.138493771) kg·m².
- **필드 근거:** 전체길이 `published`; 날/머리 축길이 `published`; 그립 `inferred`; 질량 `published`; COM `published-reference-interpreted`; 폭 `published`; 관성 `derived`. source access 메모: Primary page read directly.
- **출처:** [원 제공자 기록](https://albion-swords.com/product/the-liechtenauer/)
- **해석 경계:** 해당 Liechtenauer 제품은 무딘 연습용 Feder입니다. 1.58 kg / 9.8 cm는 이 제품의 공표값이며 날 선 검의 성능 자료가 아닙니다. 근사 질량모형은 별도 8분할 테이퍼 상자입니다.

#### 3. 나이트 한손검 · Albion (`albion-knight`)

- **분류:** `arming_sword` / `reconstruction`. 참조유형: `manufacturer-specification`.
- **게임 프로필:** 전체 0.9680 m; 타격구간 시작 0.0525 m, 길이 0.8000 m; 그립 0.1050 m; 질량 1.20000 kg.
- **COM:** 가상 가드 기준 +0.11430 m; 그립중점 기준 로컬 Y 0.16680 m. **관성 (X,Y,Z):** (0.063617915, 0.000713706, 0.064261665) kg·m².
- **필드 근거:** 전체길이 `published`; 날/머리 축길이 `published`; 그립 `inferred`; 질량 `published`; COM `published-reference-interpreted`; 폭 `published`; 관성 `derived`. source access 메모: Primary page read directly.
- **출처:** [원 제공자 기록](https://albion-swords.com/product/the-knight/)
- **해석 경계:** Albion Knight(Type XII) 한손검의 제품 프로필입니다. 제품 공표 길이·날 길이·질량·폭과 guard 기준 해석 COM 외의 그립·테이퍼·관성은 추정입니다.

#### 4. 론델 단검 · Worcester 2018.3 (`worcester-rondel-2018-3`)

- **분류:** `dagger` / `reconstruction`. 참조유형: `museum-object`.
- **게임 프로필:** 전체 0.3490 m; 타격구간 시작 0.0500 m, 길이 0.2100 m; 그립 0.1000 m; 질량 0.31600 kg.
- **COM:** 가상 가드 기준 +0.02000 m; 그립중점 기준 로컬 Y 0.07000 m. **관성 (X,Y,Z):** (0.002201310, 0.000030110, 0.002215609) kg·m².
- **필드 근거:** 전체길이 `published`; 날/머리 축길이 `published`; 그립 `inferred`; 질량 `published`; COM `inferred`; 폭 `inferred`; 관성 `derived`. source access 메모: Publisher search index returned the primary record; direct page request returned 403.
- **출처:** [원 제공자 기록](https://worcester.emuseum.com/objects/55157/rondel-dagger)
- **해석 경계:** Worcester 원 기록에서 전체·날 길이와 질량을 가져온다고 카탈로그에 기록돼 있습니다. 45 mm는 론델 지름이지 날 폭이 아니므로 게임 headWidth 23 mm와 구분합니다. COM은 가드 앞 20 mm로 놓은 모델 가정입니다.

#### 5. 전투망치 · Met 14.25.1342 (`met-warhammer-14-25-1342`)

- **분류:** `hammer` / `reconstruction`. 참조유형: `museum-object`.
- **게임 프로필:** 전체 0.5020 m; 타격구간 시작 0.3720 m, 길이 0.0700 m; 그립 0.1200 m; 질량 0.99220 kg.
- **COM:** 가상 가드 기준 +0.25360 m; 그립중점 기준 로컬 Y 0.31360 m. **관성 (X,Y,Z):** (0.020509326, 0.000697285, 0.021066546) kg·m².
- **필드 근거:** 전체길이 `published`; 날/머리 축길이 `inferred`; 그립 `inferred`; 질량 `published`; COM `inferred`; 폭 `inferred`; 관성 `derived`. source access 메모: Primary page read directly.
- **출처:** [원 제공자 기록](https://www.metmuseum.org/art/collection/search/33853)
- **해석 경계:** Met가 제공한 전체 길이와 질량 외에 그립, 머리축 길이·폭, 머리 60% 질량배분, COM은 추정입니다. 대칭 박스가 비대칭 부리·갈고리를 단순화합니다.

#### 6. 긴 전투망치 · Paço PD1058 (`paco-warhammer-pd1058`)

- **분류:** `hammer` / `reconstruction`. 참조유형: `museum-object`.
- **게임 프로필:** 전체 0.8400 m; 타격구간 시작 0.6950 m, 길이 0.0800 m; 그립 0.1300 m; 질량 1.64700 kg.
- **COM:** 가상 가드 기준 +0.49000 m; 그립중점 기준 로컬 Y 0.55500 m. **관성 (X,Y,Z):** (0.105371217, 0.005077365, 0.110170788) kg·m².
- **필드 근거:** 전체길이 `published`; 날/머리 축길이 `inferred`; 그립 `inferred`; 질량 `published`; COM `inferred`; 폭 `inferred`; 관성 `derived`. source access 메모: Primary page read directly.
- **출처:** [원 제공자 기록](https://pacodosduques.gov.pt/monumentos/paco-dos-duques/colecao/armas/martelo-armas-pd1058/?lang=en)
- **해석 경계:** Paço의 84 × 3.8 × 25.5 cm와 질량을 참조합니다. 게임에서 치수를 축에 대응시키고, 머리 55% 배분·그립·COM은 추정입니다.

#### 7. 폴액스 · Met 14.25.302 (`met-pollaxe-14-25-302`)

- **분류:** `polearm` / `reconstruction`. 참조유형: `museum-object`.
- **게임 프로필:** 전체 2.0800 m; 타격구간 시작 1.4620 m, 길이 0.3180 m; 그립 0.6000 m; 질량 2.46640 kg.
- **COM:** 가상 가드 기준 +0.85996 m; 그립중점 기준 로컬 Y 1.15996 m. **관성 (X,Y,Z):** (0.943005181, 0.005013139, 0.947633495) kg·m².
- **필드 근거:** 전체길이 `published`; 날/머리 축길이 `published`; 그립 `inferred`; 질량 `published`; COM `inferred`; 폭 `published`; 관성 `derived`. source access 메모: Primary page read directly.
- **출처:** [원 제공자 기록](https://www.metmuseum.org/art/collection/search/26720)
- **해석 경계:** Met가 게시한 208 cm 전체, 31.8 cm 머리축 길이, 21 cm 폭, 2,466.4 g을 사용합니다. 60 cm 손 구간, 52% 머리 질량분율, COM·관성은 모델 추정이며 갈고리와 축외 질량을 포함하지 않습니다.

#### 8. 긴 도끼 · BM 머리 기반 추정 (`bm-dane-axe-reconstruction`)

- **분류:** `axe` / `reconstruction`. 참조유형: `museum-head-with-inferred-shaft`.
- **게임 프로필:** 전체 1.5000 m; 타격구간 시작 0.9560 m, 길이 0.2440 m; 그립 0.6000 m; 질량 1.73988 kg.
- **COM:** 가상 가드 기준 +0.47154 m; 그립중점 기준 로컬 Y 0.77154 m. **관성 (X,Y,Z):** (0.331362725, 0.006515133, 0.337602069) kg·m².
- **필드 근거:** 전체길이 `inferred`; 날/머리 축길이 `inferred`; 그립 `inferred`; 질량 `derived`; COM `inferred`; 폭 `inferred`; 관성 `derived`. source access 메모: Publisher search index returned the primary record; direct page request returned 403.
- **출처:** [원 제공자 기록](https://www.britishmuseum.org/collection/object/H_1838-0110-2)
- **해석 경계:** British Museum 출품은 도끼머리만입니다: 머리 966 g, 28 × 24.4 × 3.36 cm. 게임 자루 포함 전체 길이 1.50 m는 가정, 전체 질량은 966 g + 650 kg/m³ 가정 목재 밀도 × 직육면체 자루 부피로 계산합니다. 완성 무기 실측값이 아닙니다.

#### 9. 카타나 · Met 36.25.1685 (`met-katana-36-25-1685`)

- **분류:** `katana` / `reconstruction`. 참조유형: `museum-object`.
- **게임 프로필:** 전체 1.0280 m; 타격구간 시작 0.1250 m, 길이 0.7230 m; 그립 0.2500 m; 질량 1.25000 kg.
- **COM:** 가상 가드 기준 +0.12000 m; 그립중점 기준 로컬 Y 0.24500 m. **관성 (X,Y,Z):** (0.070438974, 0.000189698, 0.070581710) kg·m².
- **필드 근거:** 전체길이 `published`; 날/머리 축길이 `published`; 그립 `inferred`; 질량 `inferred`; COM `inferred`; 폭 `inferred`; 관성 `derived`. source access 메모: Primary page read directly.
- **출처:** [원 제공자 기록](https://www.metmuseum.org/art/collection/search/24361)
- **해석 경계:** The Met 수치는 전체 102.8 cm, 탱 포함 날 91.8 cm, 절삭날 72.3 cm입니다. 카탈로그의 유효 타격 길이 72.3 cm는 절삭날을 사용합니다. 1.25 kg 질량, 그립·COM·폭·관성은 창작된 gameplay 추정입니다.

#### 10. 관도 · Paço PD1055 (`paco-guandao-pd1055`)

- **분류:** `polearm` / `reconstruction`. 참조유형: `museum-object`.
- **게임 프로필:** 전체 2.7950 m; 타격구간 시작 2.1200 m, 길이 0.3500 m; 그립 0.6500 m; 질량 4.98600 kg.
- **COM:** 가상 가드 기준 +1.21020 m; 그립중점 기준 로컬 Y 1.53520 m. **관성 (X,Y,Z):** (3.760560872, 0.005912981, 3.765324995) kg·m².
- **필드 근거:** 전체길이 `published`; 날/머리 축길이 `inferred`; 그립 `inferred`; 질량 `published`; COM `inferred`; 폭 `published`; 관성 `derived`. source access 메모: Primary page read directly.
- **출처:** [원 제공자 기록](https://pacodosduques.gov.pt/monumentos/paco-dos-duques/colecao/armas/lanca-alabarda-partasana-pd1055/?lang=en)
- **해석 경계:** Paço가 분류명 “Lance (Guan dao)”로 기록한 279.5 cm, 폭 17 cm, 4,986 g을 사용합니다. 게임의 .35 m 머리축 타격길이는 추정(원문 길이값 아님), 65 cm 그립, 42% 머리 질량분율, COM·관성도 추정입니다.

#### 11. 엑스칼리버 · 전설 기반 오리지널 (`excalibur`)

- **분류:** `longsword` / `fictional`. 참조유형: `author-created-gameplay-profile`.
- **게임 프로필:** 전체 1.0500 m; 타격구간 시작 0.1100 m, 길이 0.7800 m; 그립 0.2200 m; 질량 1.35000 kg.
- **COM:** 가상 가드 기준 +0.08000 m; 그립중점 기준 로컬 Y 0.19000 m. **관성 (X,Y,Z):** (0.090314458, 0.000656664, 0.090891252) kg·m².
- **필드 근거:** 전체길이 `authored`; 날/머리 축길이 `authored`; 그립 `authored`; 질량 `authored`; COM `derived`; 폭 `authored`; 관성 `derived`. source access 메모: No external source asserted for this creative profile.
- **출처:** 없음(창작 프로필; 외부 실물 출처 주장 안 함)
- **해석 경계:** 아서왕 전설에서 영감을 얻은 창작 게임 프로필입니다. 역사적 유물 치수나 특정 문헌 묘사를 재현하지 않습니다. COM·관성은 창작된 성분 박스의 수학적 결과입니다.

#### 12. 에너지 광검 · 오리지널 SF (`lightsaber`)

- **분류:** `energy_sword` / `fictional`. 참조유형: `author-created-gameplay-profile`.
- **게임 프로필:** 전체 1.0000 m; 타격구간 시작 0.1400 m, 길이 0.7200 m; 그립 0.2800 m; 질량 1.15000 kg.
- **COM:** 가상 가드 기준 -0.14000 m; 그립중점 기준 로컬 Y 0.00000 m. **관성 (X,Y,Z):** (0.006230146, 0.000492292, 0.006230146) kg·m².
- **필드 근거:** 전체길이 `authored`; 날/머리 축길이 `authored`; 그립 `authored`; 질량 `authored`; COM `derived`; 폭 `authored`; 관성 `derived`. source access 메모: No external source asserted for this creative profile.
- **출처:** 없음(창작 프로필; 외부 실물 출처 주장 안 함)
- **해석 경계:** Star Wars에서 영감을 얻은 오리지널 게임 프로필이며 영화 소품·로고·모델을 복제하지 않습니다. .72 m 타격 구간은 금속 날이 아닌 창작 에너지장이고, 물성 상자모형은 손잡이 구성품만 포함합니다.

#### 13. 나뭇가지 (`branch`)

- **분류:** `staff` / `playful`. 참조유형: `author-created-gameplay-profile`.
- **게임 프로필:** 전체 1.1000 m; 타격구간 시작 0.5200 m, 길이 0.3800 m; 그립 0.4000 m; 질량 0.55000 kg.
- **COM:** 가상 가드 기준 +0.15000 m; 그립중점 기준 로컬 Y 0.35000 m. **관성 (X,Y,Z):** (0.055514479, 0.000112292, 0.055514479) kg·m².
- **필드 근거:** 전체길이 `authored`; 날/머리 축길이 `authored`; 그립 `authored`; 질량 `authored`; COM `derived`; 폭 `authored`; 관성 `derived`. source access 메모: No external source asserted for this creative profile.
- **출처:** 없음(창작 프로필; 외부 실물 출처 주장 안 함)
- **해석 경계:** 나뭇가지형 자루의 playful 창작 프록시입니다. 치수·질량·그립·모양은 계측이 아닙니다. COM과 관성은 단순 상자 프록시 계산값입니다.

#### 14. 얼린 통닭 (`frozen-chicken`)

- **분류:** `novelty` / `playful`. 참조유형: `author-created-gameplay-profile`.
- **게임 프로필:** 전체 0.4200 m; 타격구간 시작 0.1100 m, 길이 0.2500 m; 그립 0.1200 m; 질량 0.80000 kg.
- **COM:** 가상 가드 기준 +0.04813 m; 그립중점 기준 로컬 Y 0.10812 m. **관성 (X,Y,Z):** (0.006305521, 0.001569375, 0.006436562) kg·m².
- **필드 근거:** 전체길이 `authored`; 날/머리 축길이 `authored`; 그립 `authored`; 질량 `authored`; COM `derived`; 폭 `authored`; 관성 `derived`. source access 메모: No external source asserted for this creative profile.
- **출처:** 없음(창작 프로필; 외부 실물 출처 주장 안 함)
- **해석 경계:** 얼린 통닭을 본뜬 playful 게임 프록시입니다. 식품 제품의 계측값이 아닙니다. 타격구간과 구성 박스·질량은 모두 게임 설정이며, COM·관성은 해당 박스에서 계산했습니다.

### 구분과 환산에서 특히 주의할 점

- **Albion Crécy와 Liechtenauer는 각기 다른 제품입니다.** Crécy 1.137 m / 1.39 kg / guard 기준 0.1016 m와 Liechtenauer 1.2065 m / 1.58 kg / 0.0980 m를 섞지 않습니다. 후자는 무딘 Feder 연습검으로 기록돼 있어 날 선 검의 성능을 대표하지 않습니다.
- **카타나 길이의 세 항목은 다릅니다.** Met 36.25.1685a,b 원문 설명의 전체 1.028 m, 탱 포함 날 0.918 m, 절삭날 0.723 m 중 카탈로그 `totalLengthM`은 전체, `bladeLengthM`/게임 타격길이는 절삭날을 사용합니다. 0.918 m를 타격 길이로 옮기면 안 됩니다. 전체 무게 1.25 kg은 박물관 측정으로 제시된 값이 아니라 추정입니다.
- **관도 머리길이 0.35 m는 공표치가 아닙니다.** Paço PD1055의 로컬 provenance는 전체 2.795 m·폭 0.17 m·질량 4.986 kg을 published로, `.35 m` 축방향 타격부·그립·COM·질량배분·관성을 inferred/derived로 구별합니다. 원문 분류 표기는 “Lance (Guan dao)”입니다.
- **British Museum 도끼는 완성 무기가 아닌 머리 단품 기록입니다.** 0.966 kg과 머리 치수는 원물 자료이며, 1.50 m 자루 포함 전체 길이/질량/COM/관성은 재구성 추정입니다. 가정 목재 밀도는 특정 수종 측정이 아닙니다.
- **제조사 균형점 원점도 완전히 명확하지 않습니다.** Albion의 CoB/PoB/CoG 거리를 통상적인 guard-forward 표기로 해석했지만, provenance는 원문이 그 기준점을 명시하지 않는다고 적습니다. 따라서 여기의 guard 기준 COM은 `published-reference-interpreted`이지 독립 계측값이 아닙니다.
- Worcester와 British Museum 기록은 local README/provenance에 공개 검색 색인의 원기록 값을 썼고 직접 페이지 요청은 403이었다고 기록돼 있습니다. 다른 제조사·기관의 수치와 합치거나, 모든 자료를 이번 문서 작성 중 새로 원문 확인했다고 주장하지 않습니다.

### 적용 범위

이 프로필은 Unity에서 형상·충돌구간·질량·COM·관성의 일관된 게임용 시작점을 만들기 위한 데이터입니다. 데이터 원문·파생 계산·실제 콜라이더는 동일한 것이 아닙니다. 실제 관성, 무기 손상, 손가락 압력, 실전 기법, 사람/전문가의 동작 승인, 승률은 이 표만으로 검증되지 않습니다. 더 자세한 모델 성분·필드별 출처·민감도는 `Assets/DuelLab/Resources/weapon-catalog.json`의 `provenance`, `massModel`, `modelInputs`를 확인하고 `python3 Documentation/Weapons/generate_catalog.py`로 재현할 수 있습니다.

## 3. 무술·검술·동작 및 해부학 리서치 상세

이 절의 경로는 저장소 루트 기준이다. 2026-09-27 현재 로컬 문서, 구현, 저장된 검사 결과를 읽어 정리했다. 새 외부 검색이나 교본 원문 대조, Unity 재실행은 하지 않았다. 그러므로 “직접 확인”은 아래에 명시한 **기존 조사 기록에서 확인한 범위**를 가리킨다. 코드가 재생된다는 사실, 자동 수치 검사, 제한된 정지 화면 검토, 사용자의 동작 품질 승인, 검술 전문가 검증은 서로 다른 단계다.

### 자료의 계보와 실제로 읽은 범위

| 자료 | 확인·사용 범위 | 현재 동작과의 관계 |
|---|---|---|
| Fiore dei Liberi, *Il Fior di Battaglia*, 약 1410년, Getty Ms. Ludwig XV 13 | `Documentation/Motion/SWORD_TECHNIQUE_REFERENCE.md`의 조사 기록은 [Getty 소장 원고](https://www.getty.edu/art/collection/object/103RW1)와 [공식 IIIF 목차](https://media.getty.edu/iiif/manifest/3/928f4025-a697-4b9f-b5ee-9a5d7e15a6ff)를 특정한다. [22r](https://media.getty.edu/iiif/image/0f59503a-eb04-4baf-9d95-ea08b2e168b7/full/max/0/default.jpg)의 발 전환, [23r](https://media.getty.edu/iiif/image/03000fe6-2c8a-4d95-9a83-082be881ef9b/full/max/0/default.jpg)의 *colpi fendenti*, [23v](https://media.getty.edu/iiif/image/41f938f6-6a8f-4aa4-97d2-185777c47396/full/max/0/default.jpg)의 오른쪽 *Posta di Donna*를 근거로 정리했다. 기존 기록상 23r·23v의 공식 이미지를 열어 보았고, 글은 [22r](https://wiktenauer.com/wiki/Page:MS_Ludwig_XV_13_22r.jpg)·[23r](https://wiktenauer.com/wiki/Page:MS_Ludwig_XV_13_23r.jpg)·[23v](https://wiktenauer.com/wiki/Page:MS_Ludwig_XV_13_23v.jpg)의 공개 원문 전사와 대조했다. Wiktenauer 전사는 원고 자체가 아니며 해당 페이지에도 대조 검증 대기 표시가 있다. | 기본 양손검의 오른쪽 어깨 부근 가드와 내려베기 방향에 **참고**했다. 정지 그림·문장은 연속 관절 궤적, 보법의 시간, 힘, 손목 각도를 제공하지 않는다. 특히 23v의 가로질러 딛는 설명은 찌르기 교환 문맥이므로 모든 내려베기의 필수 보법으로 전용하지 않았다. `FendenteStudy`는 그 사이와 복귀를 직접 만든 게임 동작이다. 현대 번역 문장이나 그림을 게임 에셋으로 복제하지 않았다. |
| CMU Graphics Lab subject 02 swordplay | `Documentation/Motion/README.md`, `MOTION_REVIEW.md`, 원본 `02.asf`, `02_07/08/09.amc`, 로컬 보존 공식 `cmu-home/info/faq.html`을 참조. [공식 subject 목록](http://mocap.cs.cmu.edu/search.php?subjectnumber=2)은 이 테이크들을 swordplay로 표기한다. ASF/AMC 합계 4,784프레임의 좌표 변환·뼈 길이·유한성 구조 검사는 통과했다. AMC 개별 샘플레이트는 없으며 120 Hz는 촬영 시스템 설명에서 가져온 미리보기 가정이다. | 실제 사람 캡처이지만 어떤 역사 유파의 정확한 검술인지 입증하지 않는다. 02_07 일부의 양손 간격이 비교적 일정하다는 것은 검토 후보일 뿐 양손 그립의 증거가 아니다. 이 자료를 사용한 첫 프리뷰와 관절 수정판 모두 사용자가 뻣뻣함, 관절 뒤틀림, 칼면 타격, 어색한 자세를 지적했다. 현재 기본 베기는 CMU 프레임에서 나오지 않는다. 자료·변환물·출처·이용 조건은 보존했다. CMU를 CC0나 자유 재판매 가능 자료로 표시하지 않는다. |
| 단검 교본 후보: *Fechtbuch von 1467*, BSB Cod.icon. 394 a | [바이에른 주립도서관 소장 페이지](https://www.digitale-sammlungen.de/en/details/bsb00020451)의 제목·식별자는 `Documentation/Motion/DAGGER_REFERENCE.md`에 기록됐다. 기존 검토 때 뷰어와 원본 이미지 요청이 오류를 반환해 손잡이, 빈손, 몸통, 발 자세를 **직접 보지 못했다**. | 현재 단검 찌르기를 이 교본에서 복원했다고 주장하지 않는다. 현대 색인이나 미러를 원본 관찰로 바꾸어 쓰지 않는다. |
| MakeHuman 본체·의복 | `Documentation/MakeHuman/HUMAN-ASSET-CREDITS.md`가 [MakeHuman 원본 라이선스](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md)와 [공식 시스템 자산 목록](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html)을 기록한다. | 외형·리그 재사용의 출처다. 검술, 생체역학, 체형 정확도의 독립 검증 자료는 아니다. |

Unity Animation Rigging 1.4.1의 예제 애니메이션 17개에는 사람 검술 FBX가 없었다(`Documentation/Motion/README.md`). 무료 외부 검술팩은 계정·체크아웃과 이용조건 확인이 필요한 후보로만 기록됐고 프로젝트에 취득·통합하지 않았다. 폴액스·관도의 무기 자료와 치수 출처는 `Documentation/Weapons/README.md`에 별도로 있으나, **현재 횡베기 연속 동작의 교본 근거**로 승격하지 않는다.

### 동작 변천과 코드 진입점

1. **CMU 시도와 거절.** `Documentation/Motion/MOTION_REVIEW.md`는 `02_07` 1057–1167과 `02_09` 195–305를 단지 잘라 볼 후보로 제안했다. 손끝 속도 봉우리를 칼 충격 시점이라고 부르지 않았고, 원본 동영상 비교·칼 그립·보행 접지·리타깃을 미검증으로 남겼다. 과거 `WholeBodyStroke`의 `manualTechnique=false` 경로는 `02_07` 구간과 가드 프레임을 섞었다. 사용자에게 관절 수정까지 두 차례 품질 미달 판정을 받아 기본값에서 제외했다. `Documentation/Motion/README.md`, `VALIDATION.md`, `Logs/Validation/StrokeRevision/README.md`를 함께 볼 것. `StrokeRevision`의 중간 파일 일부는 정확한 CMU 전후 비교 증거가 아니라고 자체 명시한다.
2. **Fiore 참고 기본 장검.** `Assets/DuelLab/Runtime/FendenteStudy.cs`의 `Times`·`Grips`·`BladeAngles`·몸통 yaw·발 스텝 곡선을 직접 만들고, `Assets/DuelLab/Runtime/WholeBodyStroke.cs`의 `ApplyManualPose`가 재사용 리그에 적용한다. 오른쪽 어깨 가드 → 오른쪽 위에서 왼쪽 아래로 내려베기 → 낮은 끝 자세에서 가드 회수다. 베기 유효 구간은 진행도 0.23–0.48, 왼발 지지와 오른발 전진·복귀 목표, 오른쪽 발목의 수평 이동 약 0.56 m다. 곡선의 구체적 좌표·1.90초 기본 길이·골반/가슴 회전량·발 들림은 원고에서 계측한 값이 아닌 제작값이다. `manualTechnique=true`, `mastery=1`이 현재 기본이고 숙련도 조작은 노출하지 않는다. 0/0.5/1 숙련도 곡선은 이전 오프라인 비교용으로 남았다. “숙련도”는 학습 AI나 실제 검술 실력 계측이 아니라 손으로 정한 날 정렬 오차·손잡이 흔들림·시간 계수다.
3. **준비 중 급회전 수정.** 처음에는 검 방향을 순간적인 궤적 속도에 맞춰 준비 구간에서 원치 않는 회전이 있었다. `StrokeRollFix`에서 전체 베기 평면의 법선을 고정했다. 같은 진행도 121표본의 준비 구간 누적 검 회전은 294.43° → 34.55°, 한 표본의 최대 회전은 134.43° → 4.75°로 줄었다(`Logs/Validation/StrokeRollFix/rotation-comparison.json`). 누적 쿼터니언 경로는 의도한 검 기울기도 포함하므로 “순수 축 회전” 수치가 아니다. 실제 IK 뒤 검면 법선(+Z)과 횡속도로 본 숙련도 1의 최대 날 오차는 유효 베기 30표본에서 약 1.16°였다(`Logs/Validation/StrokeRollFix/technique-validation.json`). 이 수치는 자체 회귀 목표이지 실제 베기의 질·상해·사용자 승인·역사 고증 판정이 아니다.
4. **짧은 무기.** `Assets/DuelLab/Runtime/ShortWeaponStudy.cs`는 단검에 1.25초 한손 찌르기, 냉동 통닭에 1.60초 짧은 둔타 목표를 따로 둔다. 단검은 어깨·손잡이와 작은 전진으로 짧은 날을 보내고, 통닭은 들어 올린 둔한 머리를 앞·아래로 보낸다. `WholeBodyStroke.ApplyShortWeaponPose`는 자유 왼손을 따로 배치한다. 두 동작은 현재 역사 유파 자료에서 가져온 정식 기술이 아니며 시간도 게임 조정값이다. `Documentation/Motion/DAGGER_REFERENCE.md`의 열람 실패를 결론에 반영해야 한다. `Logs/Validation/Overnight/ShortStylesFinalRendered/short-motion-probe.json`은 두 동작의 0/0.17/0.30/0.42/0.57/0.80/1.0 자세와 유한성·그립·발 수치를 담는다. 제한된 정지 화면 검토에서 빈손 팔꿈치 과도 들림과 얼굴 가림을 조정했지만 연속 동작의 자연스러움이나 사용자 승인은 확인되지 않았다.
5. **장병기.** 긴 무기에 기존 장검 내려베기 목표를 적용하자 관도 머리가 바닥을 치고 높은 각속도·자세 오차가 발생했다. `Assets/DuelLab/Runtime/PolearmStudy.cs`는 높은 가드 → 허리/가슴 높이의 얕은 횡베기 → 원래 가드라는 독립 게임 동작을 만든다. `WholeBodyStroke.ApplyPolearmPose`와 `DuelWeaponMotion.UsePolearmStudy`가 폴액스·관도에 적용한다. 최초 수평 동작의 표본에서 관도 바닥 접촉 1→0, 최고 회전속도 17.41→2.36 rad/s로 줄었고, 뒤의 yaw·팔꿈치·그립 여유 수정 후 별도 마지막 headless 표본은 두 무기 바닥 접촉 0회, 최대 각속도 약 3.64/2.30 rad/s였다(`Documentation/Motion/POLEARM_STUDY.md`, `Logs/Validation/Overnight/PolearmHorizontalExperiment/ClearancePhysics/polearms/polearm-motion-probe.json`). 공격 길이 3.93/5.78초는 질량 중심 거리로 늘린 **게임 동작 시간**이며 실제 역사 무기 사용자 속도가 아니다. 화면에서 몸통 yaw 부호와 뒤팔의 옷 관통을 찾아 폴암만 팔꿈치 목표, 양손 간격 약 32 cm, 회수 시 몸통 앞 그립 여유 최대 10 cm로 손봤다. p≈0.57 뒤손목의 흉부 기준 앞쪽 위치 변화와 제한된 렌더는 `Logs/Validation/Overnight/PolearmHorizontalExperiment/README.md`에 기록돼 있다. 일부 가드에서 뒤팔 가림과 손 겹침이 남고, 정지 상대 접촉은 실제 AI전 유효 전략을 증명하지 않는다.
6. **양손 찌르기.** `Assets/DuelLab/Runtime/TwoHandThrustStudy.cs`와 `WholeBodyStroke.ApplyTwoHandThrustPose`는 왼쪽 어깨 바깥으로 칼끝을 빼는 준비, 몸통 높이 전진 찌르기, 기본 Fendente 가드 복귀를 만든다. 시작·끝 가드 목표가 기본 베기와 같아 스타일 전환 때 정지 자세의 스냅을 줄이려 한다. 기본 1.90초이며 고증·실측 운동이 아니다. `Documentation/Motion/TWO_HAND_THRUST_STUDY.md`의 물리·정지 상대 접촉·카메라 전용 렌더 기록은 실행 가능 범위를 보여 주지만, 실제 창의 첫 찌르기 3장을 보았다는 사실도 전체 연속 동작 또는 사용자 승인과 다르다. 상대 AI의 베기/찌르기 전환은 `Assets/DuelLab/Runtime/DuelArena.cs`의 게임 규칙이지 학습된 검술 지능이 아니다.

### 인체·해부학·리깅의 근거와 한계

**Delp(1996) 손목 근력과 Holzbaur(2005) 상지 모델의 초록·서지 수준 후보 검토는 있었다. 그러나 원문/원데이터를 사용해 이 게임의 관절 가동 범위나 근육 힘을 보정·검증한 기록은 없다.** 관련 수치와 미채택 이유는 뒤의 연구 출처 표에 구분했다. 재사용한 MakeHuman 기반 성인 남성 형상의 출처는 실제지만, 이는 피험자 스캔이나 인체 계측으로 이 프로젝트의 움직임을 검증했다는 뜻이 아니다. `Documentation/MakeHuman/HUMAN-ASSET-CREDITS.md`에 따르면 본체 `base.obj`, 기본 리그·웨이트, 형태 target, 셔츠·바지·신발·머리·피부 자료를 가져와 약 1.78 m 체형으로 맞췄다. 55개 변형 뼈(몸 25·손가락 30), 정점당 정규화된 최대 네 개 skin weight, 의복 웨이트 이전·튜닉 밑단 조정 등을 거쳤다. 의복은 역사 복식 연구물이 아니며 천 시뮬레이션, 근육 수축, 연부조직·자기 몸 충돌은 없다. 원본 아트워크 CC0 출처와 변환 크레딧을 보존한다.

`WholeBodyStroke.Initialize`는 MakeHuman Transform·rest 위치와 기존 CMU 형식의 관절 이름/배열을 읽고, 기본 수동 동작에는 CMU의 시간별 프레임을 쓰지 않는다. `StrokeRetargetMath.Joint`는 두 뼈 길이를 유지하며 목표점을 닿을 수 있는 반경으로 제한하고 pole 방향으로 팔꿈치·무릎을 선택하는 해석적 IK다. 이는 길이 보존과 목표점 추적을 위한 수학적 제약이지 해부학적 관절면·인대·통증이나 힘 생성 모델이 아니다. `WholeBodyStroke`의 손목 swing 32° 제한, forearm pronation `85*sin(angle)` 경계, 복귀 중 분기 뒤집힘 방지, 무릎 최소 굽힘 약 15°와 골반 높이 보정, 발바닥 높이 보정·발 목표 고정은 **게임·리깅 설정**이다. 이를 실제 사람의 정상 관절 가동 범위 실측치라고 쓰지 말 것. 손가락 굴곡도 촬영 데이터가 아닌 일정한 닫힌 그립이다. CMU 공식 설명은 손가락·엄지 관절 동작이 실제로 캡처되지 않았다고 한다(`Documentation/Motion/README.md`).

`Logs/Validation/Fendente/pose-audit.json`과 `Logs/Validation/StrokeRollFix/pose-audit.json`의 손목·팔꿈치·무릎 수치는 121개 제작 자세에서 두 선분 사이의 **서명 없는 기하학 각도**다. 이 로그 자체가 손목 각도에는 원본 손바닥 형상, 상대 쿼터니언에는 축 비틀림이 섞이며 skin 변형·자기관통·해부학적 비틀림은 별도 화면 검사가 필요하다고 명시한다. `Logs/Validation/StrokeRollFix/validation.json`의 손잡이·발 목표 오차가 각각 최대 약 4.3e-7 m·2.0e-7 m이고 BakeMesh 신발 최저점이 약 4 mm라는 사실은 해당 정지 표본의 IK·좌표 제약을 확인할 뿐, 체중지지·균형·마찰·자연스러운 보행을 검증하지 않는다. `ApplyExternalWalkingFeet`는 발목 세계 목표를 두 뼈 IK로 따라가고 골반 시각 위치를 최대 12 cm 보정한다. 발을 디딜 때 힘으로 몸통을 옮기는 전신 동역학이 아니다.

결투 장면에서는 무기 `PhysicalSwordMotor`만 질량·질량중심·관성·Collider를 갖는 동적 Rigidbody이고 유한한 힘·토크로 움직인다. 몸 자세와 발·상체는 제작 포즈/IK이며 몸의 피격 Collider는 kinematic이다(`Assets/DuelLab/Runtime/DuelFencer.cs`, `PhysicalSwordMotor.cs`). `DuelFencer.LateUpdate`는 `WholeBodyStroke.RetargetHeldWeapon`을 불러 **실제 무기 위치에 손과 최대 12°의 시각적 허리 기울임을 맞춘다**. 그래서 작은 손–그립 오차는 손 모델이 무기를 잘 따른다는 뜻이지, 무기가 저항 없이 목표 궤적을 정확히 수행하거나 손가락 접촉 압력·근육 반응을 계산했다는 뜻이 아니다. 폴암 뒤팔 옷 관통, 짧은 무기 빈손 가림, 의복/피부 겹침은 별도 화면에서 찾아 수정해야 한다. 단일 프레임 또는 오프스크린 카메라 이미지는 움직임 전체와 UI·실제 조작 품질을 대신하지 않는다.

### 개발자가 이어서 확인할 것

- Fiore에 연결한 표현은 “오른쪽 가드와 내려베기의 **문헌 참고 제작**”으로 유지한다. 22r/23r/23v 이미지는 소장처 1차자료, Wiktenauer는 검토에 사용한 전사, BSB 단검은 미열람 후보라고 각각 적는다. 다른 유파 이름이나 해부학 논문을 확인 없이 추가하지 않는다.
- 기본 장검의 준비 **전체**, 베기 날 정렬, 복귀, 손목/팔꿈치 뒤집힘, 발 접지와 의복 관통을 실제 연속 화면으로 함께 검토한다. `StrokeRollFix` 수치나 초단위 캡처만으로 품질 승인을 적지 않는다.
- 단검·통닭·폴암·찌르기는 서로 다른 게임 제작 동작이다. 각 목표 궤적의 물리 추적·정지 상대 접촉·일반 AI 대결·사람이 보기에 자연스러운지의 검사를 분리한다. 역사 재현, 인간 승률 0%/100%, 실측 근력, 임상 관절 안전성, AI 학습, 검술 전문가/사용자 승인으로 확대하지 않는다.

### 유파 이름과 구현의 대응

| 범주 | 실제 확인 범위 | 현재 구현/미실시 |
|---|---|---|
| 이탈리아 Fiore | Getty 원고와 공개 전사에서 특정 가드·내려베기 방향 참고 | Fendente 목표 제작. 유파 전체·연속 공방·역사적 정확성 검증 없음 |
| 독일 Liechtenauer 계열 | 무기 카탈로그에는 그 이름의 현대 연습검이 있음. 독일 검술 데이터 연구 후보도 검토 | 제품 이름을 독일 검술 동작 연구/이수로 간주하지 않음. Zettel·특정 Meisterhau 복원은 없음 |
| 일본 검술·거합 | 카타나 소장품 치수와 일본/독일 동작 데이터 연구 후보 | 특정 일본 유파·형/카타·거합 기술을 원전에서 복원하지 않음. 카타나에도 현재 공통 제작 경로 사용 |
| 중국 관도술 | 관도 소장품의 치수·질량 | 특정 무술 유파/권보를 채택하지 않음. 횡베기는 게임 제작 동작 |
| 단검술 | BSB 교본 식별자 확인, 원본 뷰어 열람 실패 | 현재 단검 찌르기는 자체 제작. 교본 복원으로 표시하지 않음 |
| 판타지·재미 무기 | 창작 설정 | 역사적 유파나 현실 생체역학 정확성을 주장하지 않음 |

## 4. 물리·인체 연구 출처: 검토와 채택을 구분

- **무기 개체·제품의 공개 자료:** `Documentation/Weapons/README.md`와 `Assets/DuelLab/Resources/weapon-catalog.json`은 Albion Crécy·Liechtenauer·Knight 제품 페이지, Worcester 론델, Met 전투망치·폴액스·카타나, Paço의 망치·관도, British Museum 도끼머리의 공개 길이·폭·질량·일부 균형점에 개별 URL과 `published`/`inferred`/`derived` 표시를 붙인다. 이는 해당 물체의 **치수·질량 원출처**이지 근력·충격 손상·절삭 성능의 실험 출처가 아니다. Worcester·British Museum 값은 당시 공개 검색 색인의 박물관 기록으로 확인했고 원문 직접 접근은 403이었다는 제한을 README가 명시한다. 제조사 균형점의 “가드 앞” 원점은 프로젝트 해석이며 제조사가 명시한 정의로 확정하지 않았다.
- **엔진 기술 참고:** `Documentation/History/GAME_BRIEF.md`는 Unity 공식 Configurable Joint 구동력·CCD 문서와 Rapier 공식 CCD 문서를 인용한다. `Documentation/History/PHYSICS_LAB.md`는 이전 **웹 Rapier 0.19.3** 실험을 기록한다. `Documentation/History/REACTION_LAB.md`는 Rapier 접촉 API와 Met의 갑옷 설명을 참고했다. 이들은 Unity 결투의 근력 상수나 손상 식을 실측 보정한 근거가 아니다. Configurable Joint 문서를 검토했더라도 현재 결투 인체에 그 Joint가 구현됐다고 쓰면 안 된다.
- **초기 기준 검 후보:** `PHYSICS_DEVELOPMENT_PLAN.md`는 현 카탈로그와 별도로 [Met 14.25.1196](https://www.metmuseum.org/art/collection/search/35888)의 공개 길이·질량을 비교 후보로 기록했고, Unity 6.3 공식 `Rigidbody.inertiaTensor`·`centerOfMass` 문서를 좌표계 참고로 링크했다. Met 후보의 관성 실측이 확보되었다는 뜻은 아니다.
- **물리·인체 연구의 초기 조사:** `PHYSICS_DEVELOPMENT_PLAN.md`는 아래 자료의 초록·서지·원 제공자 설명을 검토해 적용 조건과 한계를 적었다. **자료 조사는 실제 런타임 값 채택과 다르다.**

  | 검토 자료 | 로컬 조사에서 확인한 내용 | 현재 채택 여부 |
  |---|---|---|
  | [Delp 등 1996, PubMed 8884484](https://pubmed.ncbi.nlm.nih.gov/8884484/) | 건강한 남성 10명의 고정 자세 최대 등척성 손목 굴곡 토크 평균 12.2 N·m, 범위 5.2–18.7 N·m이라는 초록 수치. 한 손목·특정 자세·정적 측정이다. | **미채택.** 24 N·m을 이 논문으로 보정했다고 할 수 없으며 양손검 전체 토크·어깨/팔꿈치/손가락 한계로 전용할 수 없다. 원문 전체·실험 원데이터 확보 기록은 없다. |
  | [Holzbaur 등 2005, PubMed 16078622](https://pubmed.ncbi.nlm.nih.gov/16078622/) | 어깨부터 손가락까지 다루는 상지 모델과 실험 비교의 서지/초록 후보. | **미채택.** 근육·관절 모델이나 개별 파라미터를 현재 Unity 인체에 이식하지 않았다. 원문 전체/모델 원데이터 확보 기록은 없다. |
  | [전통 일본·독일 무술 기준 데이터 연구](https://experts.arizona.edu/en/publications/reference-datasets-for-analysis-of-traditional-japanese-and-germa/), [5MUDM 출판사 소개](https://link.springer.com/chapter/10.1007/978-3-031-25312-6_59), [ISBS/NMU 검 충격 측정 연구](https://commons.nmu.edu/isbs/vol40/iss1/49/) | 롱소드 기술의 운동학·힘·영상 데이터, 2020년 5기술 데이터베이스, 센서/변형률 게이지 방법을 **후보**로 확인했다. | **미채택.** 5MUDM 원 모션 파일·재사용 라이선스, 각 연구의 원 측정 데이터·동작 리타깃 검증을 확보했다는 기록이 없다. 17세기 측정 무기를 현 롱소드와 동일시하지 않는다. |
  | [SwordSTEM의 Sean Franklin Crécy 기록](https://swordstem.com/2018/08/22/how-fast-do-swords-move-try-1/), [Subcaelo 계산기 설명](https://subcaelo.net/ensis/dynamics-computer/walkThrough.html) | 소유 검의 관성 추정/계산 단서로 검토했다. 표의 약 0.11은 단위 표기가 잘못되고 회전축·기준점이 불명확하다. | **미채택.** 이를 Vincent의 직접 실측값이나 현 Rigidbody의 `inertiaKgM2` 정답으로 입력하지 않았다. |
  | [BasSDK 공식 JSON/아이템 설명](https://kospy.github.io/BasSDK/Components/Guides/SDK-HowTo/JSONModding.html), [저장소](https://github.com/KospY/BasSDK) | 질량·드래그·그립·충돌/조작 설정을 분리하는 구조를 참고했다. 저장소 버전과 라이선스 조건도 별도로 검토했다. | **수치/코드 미채택.** VR 손 추적 설정을 iPhone 터치에 그대로 이식하거나 SDK 코드·에셋 사용권을 확보했다는 뜻이 아니다. |

- **그 밖의 미채택 후보:** `Documentation/History/COMBAT_REBUILD_PROPOSAL.md`의 OpenSim·DeepMimic·PuppetMaster·Final IK는 검토 방향/도구 후보이다. 현재 Unity 전신 물리나 근육 파라미터의 공급원이 아니다. 따라서 **인체 근력·검 실측 관성 연구를 조사한 사실은 있으나, 현 코드에 논문 계측값이나 실측 관성 텐서를 채택한 기록은 없다.** 조직 절삭계수에 관한 채택된 실험 자료도 확인하지 못했다.

## 5. 물리 구현 상세와 연구의 적용 경계

### 현재 동작을 결정하는 구조

`DuelArena`가 입력·AI·라운드를 관리하고, `DuelFencer`가 공격 단계와 캐릭터 이동을 진행한다. `WholeBodyStroke`가 목표 자세와 그립 목표를 만든다. `PhysicalSwordMotor`가 유한한 힘과 토크로 실제 무기 Rigidbody를 구동하며, 마지막에 팔·손 IK가 실제 무기 손잡이를 따라간다.

```
자료/게임 제작 포즈 → 몸·발의 authored pose와 IK → 무기의 목표 그립·방향
                                                    ↓ 유한 힘·토크
                                                 동적 Rigidbody
                                                    ↓ 실제 접촉
                                   무기 감속·튕김 + 피해/막힘 게임 규칙
                                                    ↓
                                        실제 무기를 따라가는 팔·손 IK
```

- **동적인 것:** 무기 Rigidbody의 질량·COM·3축 관성·중력·가속·각가속·속도·접촉 충격량.
- **제작/제어하는 것:** 몸의 뼈 자세, 보행과 발 고정, 공격 순서·시간, AI, 피해·팔 약화·반동의 게임 규칙.
- **kinematic인 것:** 몸통·팔 등의 hurtbox. 골격 전체가 힘으로 균형을 잡는 구조가 아니다.
- 현재 Unity 결투는 양손에 각각 물리 관절을 연결한 근골격 시뮬레이터가 아니다. `ConfigurableJoint` 문서는 검토했지만, 무기를 두 손의 실제 Joint가 당기는 방식으로 구현했다고 말하면 안 된다.
- 이전 `WholeBodyStroke` 단독 프리뷰는 Transform 재생이었다. 여기서 계산한 `BladeVelocity`는 궤적 진단이며 동역학 솔버가 아니다. 새 `DuelArena`의 동적 무기와 구분한다.

### 단위·좌표·관성

SI 단위를 사용한다. 거리 m, 질량 kg, 힘 N, 토크 N·m, 관성 kg·m², 각속도 rad/s다. 원점은 게임용 그립 중점, 로컬 +Y는 끝/머리 방향이다. 카탈로그의 `centerOfMassFromGuardM`는 그립 중점 기준이 아니므로 다음 변환이 필요하다.

```
COM_local_y = gripLengthM / 2 + centerOfMassFromGuardM
I_grip_x,z = I_COM_x,z + massKg * COM_local_y²
```

Rigidbody에는 COM 기준 관성을 입력한다. 그립 축 관성을 그대로 넣고 다시 COM을 옮기면 평행축 항이 중복될 수 있다. 현재 모형은 축외 COM·관성곱을 생략한 대칭 근사라 `inertiaTensorRotation = identity`를 사용한다. 실제 비대칭 머리의 주축을 측정한 결과가 아니다.

### 유한 힘과 토크의 제어기

주요 코드: `Assets/DuelLab/Runtime/PhysicalSwordMotor.cs`.

| 항목 | 현재 기본값 | 의미/근거 구분 |
|---|---:|---|
| 위치 강성 | 650 N/m | 게임 제어기 설정 |
| 위치 감쇠 | 55 N·s/m | 게임 제어기 설정 |
| 회전 강성 | 150 rad/s² per rad | 목표 각가속도 생성용 설정 |
| 회전 감쇠 | 24 s⁻¹ | 각속도 오차의 감쇠 설정 |
| 모터 힘 상한 | 160 N | 실측 인체 근력 아님 |
| 모터 토크 상한 | 24 N·m | 실측 양손검·손목 토크 아님 |
| 목표 속도 필터 | 0.045 s | 미분 신호 완화 |
| 목표 이동/회전 속도 상한 | 8 m/s / 24 rad/s | 제어기 목표의 상한 |
| 폴암 축방향 비틀림 강성/감쇠 | 3 N·m/rad / 0.3 N·m·s/rad | 가는 자루의 작은 축관성에 대한 게임 그립 보정 |
| 물리 스텝 | 1/120 s | Unity 결투 설정; 60fps 렌더 성능의 증거는 아님 |
| solver iterations / velocity iterations | 16 / 8 | 접촉 안정성 설정 |
| 충돌 검출 | ContinuousDynamic | 유한 스텝 근사; 무관통 보장 아님 |
| contact offset | 0.003 m | 충돌 근사 설정 |

위 상한에는 `Strength`가 곱해진다. Fencer가 팔 상태와 무기별 `motorStrengthMultiplier`를 적용하고, 피격/막힘 뒤 `ReduceDrive`가 일시적으로 구동을 낮춘다. 따라서 모든 무기가 언제나 160 N/24 N·m로 움직이는 것은 아니다. **상한은 모터가 가하는 구동 힘·토크의 상한이며, PhysX 접촉 충격량이나 모든 외력을 그 값으로 제한한다는 뜻도 아니다.**

그립 위치를 유지할 때 현재 무기의 회전으로 COM 오프셋을 계산한다. 회전 목표를 아직 따라가지 못한 무기의 COM을 목표 회전 위치로 먼저 끌어당기면, 긴 무기의 손잡이가 크게 휘둘리는 문제가 생긴다. 현재 코드는 이를 피한다.

```
currentOffset = actualRotation * body.centerOfMass
wantedCOM = targetGrip + currentOffset
wantedCOMVelocity = filteredGripVelocity + actualAngularVelocity × currentOffset
F = Kp * (wantedCOM - actualCOM) + Kd * (wantedCOMVelocity - actualCOMVelocity)
F += gravity compensation                         # 사용 시
F = magnitude-clamp(F * strength, maxForce * strength)

rotationError = rotation-vector(targetRotation * inverse(actualRotation))
alpha = Kr * rotationError + Dr * (filteredTargetOmega - actualOmega)
tau = principalToWorld * diag(I) * worldToPrincipal * alpha
# 폴암은 자루축의 유한한 추가 비틀림 저항을 합친 뒤 전체 상한 적용
tau = magnitude-clamp(tau * strength, maxTorque * strength)
```

실제 운동은 `Rigidbody.AddForce(..., ForceMode.Force)`와 `AddTorque`로 진행한다. 일반 공격 중 매 프레임 실제 검을 목표 Transform으로 덮어쓰지 않는다. `ResetPose`의 순간이동은 생성·재시작에만 사용한다. 이 제어기는 가속도/관성의 영향을 포함하지만, 관절별 근육 토크를 역동역학으로 계산하는 모델은 아니다.

### 충돌 형상과 자루 추가 후보

기본 타격부는 BoxCollider 근사다. 검/단검은 날 구간, 도끼·망치·폴암은 머리 구간에 배치한다. 나뭇가지·통닭은 별도로 정한 타격 구간을 사용한다. 실제 날의 날카로움, 단면, 곡률 전체를 재현한 collider가 아니다. 관도처럼 휘어진 날도 간단한 타격부로 근사한다.

`--duel-polearm-shaft` 후보는 폴액스·관도에만 같은 Rigidbody 소속의 관리되는 CapsuleCollider를 추가한다. 반경은 카탈로그 `massModel`의 `shaft-equivalent` 폭/두께 중 큰 값의 절반이다. 아래끝부터 금속 머리 시작까지 자루를 채우며 머리와 겹치는 상단은 머리 Box가 담당한다. 임의의 다른 solid collider는 계속 거부한다.

| 무기 | 자루 반경 | 충돌 자루 Y 범위(그립 중점 기준) | 상태 |
|---|---:|---:|---|
| 폴액스 | 0.0165 m | 약 −0.300 ~ 1.462 m | opt-in 후보 |
| 관도 | 0.0175 m | 약 −0.325 ~ 2.120 m | opt-in 후보 |

추가한 것은 물리 접촉 형상이다. 원래 질량·COM·관성·구동 상한은 유지한다. 자루는 현재 휘거나 부러지지 않는다. 나무 대 금속의 마찰계수·탄성계수를 실험에서 보정한 것도 아니다.

접촉점의 **내 collider/상대 collider**를 확인해 머리와 자루를 구분한다. 자루 대 몸 접촉은 물리적으로 해결하되 금속 머리의 전량 피해 경로에 넣지 않는다. 이 후보의 자루 몸 피해는 0이다. 이는 안전한 초기 게임 정책이며, 나무 자루가 현실에서 아무 상해도 주지 않는다는 주장이 아니다. 무기 대 무기에서 자루에 막혀도 `AttackWasBlocked`는 참이 된다. 금속 막힘 집계와 `WoodWeaponBlocks`는 분리했다. 소리·햅틱은 재질/특수 무기에 따른 게임 연출이다.

### 실제 접촉과 게임 피해의 경계

`DuelFencer.OnContact`는 실제 충돌 이벤트를 요구한다. 거리만 가까워졌다고 피해를 주지 않는다. 동작 품질 검사에서 사용하는 Fendente의 베기 구간(23–48%)과 아래 게임의 피해 수락 구간은 서로 다른 기준이다. 기본 몸 명중은 공격 중 20–57% 단계, 아직 막히지 않은 공격, 상대방의 실제 몸 collider, 접촉점 상대 속도 >1.2 m/s, 법선 방향 접근 속도 >0.35 m/s, 동일 공격의 동일 피해자 중복 방지 조건을 거친다.

```
impact = clamp((speed - 1.2) * sqrt(massKg) * 5.5, 0, 38)
edgeFactor = bluntPath ? 1 : lerp(0.2, 1, clamp01(edgeAlignment))
glanceFactor = glancing ? 0.32 : 1
damage = impact * edgeFactor * glanceFactor * weapon.damageMultiplier
```

이 식은 **게임 피해 공식**이다. 운동에너지 `½mv²`를 그대로 피해로 바꾼 식도, 조직 절삭·칼끝 관통·갑옷 손상 모델도 아니다. 현재 `Weapon.IsShafted`와 에너지 검은 위의 `bluntPath`로 들어간다. 따라서 도끼날/관도날의 실제 절삭 효과까지 구현됐다고 말하면 안 된다. 양손 찌르기도 기존 공식을 사용하므로 찌르기 고유의 관통 모델은 없다.

저질량 단검에서는 실제 접근 접촉이 있어도 solver 충격량이 작아 누락되는 문제가 있었다. 보존 표본은 진행률 0.3715, 접촉점 속도 4.787 m/s, 접근 속도 2.063 m/s, 충격량 0.0543 N·s다. 이전 0.08 N·s 전역 게이트가 이를 버렸다. 수정은 몸 명중에 접근 속도를 요구하고, 0.08 N·s 게이트는 비신체 피드백에 유지하는 방식이다. 이후 단검 정지 명중 반복 3/3을 확인했지만 AI전 승리를 보장하지 않았다. 피해 이벤트 표시가 작은 충격량 때문에 사라지지 않도록 화면 Hits/피드백 경로도 분리했다.

팔 상태 감소·짧은 stagger·몸의 recoil 이동은 게임 규칙이다. 충돌을 받은 전신이 실제 관절 힘과 지면 반력으로 움직이는 것은 아니다. 동일 프레임 치명타 무승부 검사는 별도의 로직 주입 시험이며, 실제 접촉/정상 AI 대전 증거와 구분한다.

## 6. 적용 후 확인한 성과와 새로 생긴 문제

### 변경별 결과

| 문제/실험 | 조치와 관측 | 현재 판단 |
|---|---|---|
| CMU 기반 베기가 뻣뻣하고 칼면으로 때림 | Fiore 도판을 참고해 준비→내려베기→회수 목표를 별도 제작 | 기존 CMU를 개선된 검술 모션이라고 재명명하지 않음; 사용자 품질 승인 대기 |
| 베기 전 검이 한 바퀴 돌아감 | 속도 방향에 따라 날의 방향을 고르던 경로를 전 주기 고정 베기 평면으로 변경 | `StrokeRollFix`에서 준비·활성·회수 전체 검사; 숙련도100 기본 유지 |
| 긴 무기의 회전 지연이 손잡이를 멀리 끌고 감 | 목표 회전 대신 실제 회전을 기준으로 COM 목표/속도 계산 | 토크를 의도적으로 낮춘 실제 물리 검사에서도 회전 지연과 그립 위치를 분리 |
| 롱소드 동작을 긴 무기에 재사용하자 바닥에 닿고 급격히 회전 | 폴암 전용 얕은 횡베기 제작 | 초기 A/B에서 지면 접촉 두 무기 각1→0, 관도 최고 각속도 약17.41→2.36 rad/s |
| 폴암 동작의 몸통 yaw와 팔 교차·회수 시 전완 관통 | yaw 부호, 앞/아래 팔꿈치 방향, 양손 간격32 cm, 회수 때 전방 여유 최대10 cm 조정 | 제한된 렌더에서 p57 관통 개선; 이전 잘못된 단계도 보존 |
| 가벼운 단검의 진짜 접촉이 피해로 인정되지 않음 | 몸 명중 게이트와 비신체 피드백 게이트 분리 | 실제 접촉 반복 성공; 단검의 AI전 승리 문제는 별도 |
| 폴암을 들고 가만히 있으면 같은 상대 베기를 계속 막음 | 상대가 피해 없는 실제 막힘을 두 번 겪으면 내려베기/찌르기 전환 | 일반 무기·힘·피해를 유지한 실제 대기 패배 확인; 정교한 검술 AI나 학습 AI는 아님 |
| 보이는 긴 자루가 몸/검을 통과 | 관리되는 자루 CapsuleCollider와 접촉 부위 분류 추가 후보 | 실제 자루 접촉/머리 접촉과 무피해 자루 경로 확인; 대전 검증 중 |
| 긴 무기가 정지 표적에는 맞지만 일반 AI전에서는 공격 기회를 못 만듦 | 시작거리 확대, 템포, 옆걸음 AI, 회수 이동, 입력 정책을 분리 비교 | 정지 명중 ≠ 승리 전략. 실패한 후보를 기본값으로 강제 채택하지 않음 |

### 네 접촉의 같은 빌드 비교

증거: `Logs/Validation/Overnight/PolearmHorizontalExperiment/FinalIntegration/contact/duel-scenario-probe.json`. 크레시 장검의 해당 안정 버전이며 후속 자루 후보 전체의 통합 합격 기록으로 재사용하지 않는다.

| 상황 | 실제 Hits / Blocks / Glances | 상대 최종 HP | 해석 |
|---|---|---:|---|
| 허공 | 0 / 0 / 0 | 100.00 | 실제 비접촉 |
| 검 막힘 | 0 / 1 / 0 | 100.00 | 무기 접촉으로 몸 피해 차단 |
| 몸 명중 | 1 / 0 / 0 | 64.83 | 실제 피해 약35.17 |
| 스침 | 1 / 0 / 1 | 88.37 | 실제 피해 약11.63 |

손 마커의 아주 작은 오차는 IK 목표 일치를 보여준다. 같은 검사에서 실제 검의 목표 위치 차이는 최대 약0.076–0.103 m였다. **손 마커 오차와 물리 무기가 애니메이션 목표를 따라간 오차를 혼동하지 않는다.**

### 폴암 자루 후보의 같은 빌드 A/B

`PolearmShaftExperiment/PhysicsLegacy`와 `PhysicsShaft`의 비교다. 실제 무기와 목표의 최대 각도 차이를 기록했다.

| 무기/조건 | 공격 시간 s | 최고 각속도 rad/s | 최대 각도 차이 ° | 지면 접촉 |
|---|---:|---:|---:|---:|
| 폴액스, 머리만 | 3.925 | 3.431 | 5.018 | 0 |
| 폴액스, 자루 포함 | 3.925 | 3.449 | 5.011 | 0 |
| 관도, 머리만 | 5.779 | 2.350 | 2.872 | 0 |
| 관도, 자루 포함 | 5.779 | 2.348 | 2.901 | 0 |

자루 포함 도달성 시험(`ReachShaft`)은 각 거리당 제한된 한 번의 표본이다. 콜백 수는 접촉점 개수나 피해 횟수와 다르다.

| 거리 m | 폴액스: 머리/자루 몸 콜백 · 피해 HP | 관도: 머리/자루 몸 콜백 · 피해 HP |
|---:|---|---|
| 0.95 | 1 / 3 · 17.17 | 0 / 3 · 0 |
| 1.05 | 2 / 3 · 1.92 | 0 / 10 · 0 |
| 1.20 | 0 / 2 · 0 | 0 / 4 · 0 |
| 1.60 | 1 / 1 · 4.28 | 0 / 6 · 0 |
| 2.10 | 5 / 0 · 15.71 | 0 / 2 · 0 |
| 2.60 | 0 / 0 · 0 | 4 / 1 · 13.73 |

이 표에서 자루만 접촉한 표본은 피해0이었다. 모든 시험의 플레이어 소유 hurtbox와 머리/자루 collider 사이 `Physics.GetIgnoreCollision`이 확인됐다. 이것은 본인 신체 메시를 물리적으로 충돌 방지한다는 뜻이 아니다. 자신의 hurtbox를 의도적으로 무시하므로, 자기 몸 관통은 자세·IK·렌더로 따로 검토해야 한다.

PlayMode 15/15에는 실제 자루-벽/무기/몸 접촉, 별도 머리 접촉, 임의 collider 거부, 질량·COM·관성 유지, 재Configure 중복 방지, 연속 자루→머리 접촉 검사가 포함된다. 마지막 fixture는 자루 Stay 160, 머리 Enter 4, 모터에 전달된 머리 Enter 4를 관측했다. 계획한 0.8 m 하강을 전부 완료한 것은 아니며 접촉으로 최종 Y가1.842427 m에 멈췄다. 이 한 조건에서 새 머리 접촉이 누락되지 않았다는 결과이지 모든 복합 접촉의 보증은 아니다.

### 채택하지 않은 비교와 남은 위험

- **시작거리:** 2.3 m와3.8 m를 비교했지만 폴암 정책의 승리로 이어지지 않았다. 기본2.3 m 유지.
- **템포:** 기본/0.8/0.65배를 비교했다. 0.65배 관도는 최대 회전 지연 약19.76°, 토크 포화 약48.3%로 증가했다. 0.8배 일반 AI 네 표본도 패배했다. 기본 공격 시간 유지.
- **상대 옆걸음만 추가:** 폴액스 비조작25초에서 여전히 양쪽 체력100. 단독 해결책으로 채택하지 않았다.
- **회수 보행:** 공격60% 이후 일반 보행 속도로 부드럽게 복귀하는 opt-in 후보. 실제 지지발 목표와 제한된 화면을 확인했으나 승리 전략 문제는 해결하지 않았다. 기본OFF.
- **단검 우회 반격:** 한90초 표본은 상대 HP4.63/플레이어14.66에서 시간초과였다. 별도120초 허용 표본은80.35초에 패배했고 상대 HP43.55였다. 두 결과를 함께 남기며 성공 사례처럼 취사선택하지 않는다.
- **판타지 무기:** 엑스칼리버/광검은 제한된 기본 공격·반격 정책에서 승리했고 비조작하면 패배했다. 자동 무적의 반례는 얻었지만 모든 전략·무기 조합의 승률0%/100% 부재를 증명한 것은 아니다.
- **렌더 진단:** 오프스크린 Metal+CPU BakeMesh 캡처는 실제 물리/IK 상태를 그린 이미지다. 앱 UI·터치·실제60fps 성능 검증과 다르다. 초기 카메라가 벽 안에 있던 무효 캡처와 timeout 기록을 보존했다.
- **실행별 차이:** Headless와 실제 창, 프레임 타이밍·접촉 위상에 따라 결과가 달라질 수 있다. 한 번의 자동 정책 승패를 통계적 승률로 해석하지 않는다.

### 최신 자루 후보의 정상 AI 대전 결과

모두 실제 대전 AI와 정상 이동/방어/공격 입력만 사용했다. 아래 흐름 검사에서 피해나 승리를 주입하지 않았다. `PolearmShaftExperiment/`의 해당 폴더에 JSON·Player.log·빌드/소스 해시가 있다. 표의 HP는 **상대가 끝에 보유한 체력**이다.

| 실행 / 플레이어 무기 | 입력 정책 | 결과 | 경과 s | 상대 최종 HP | 나무 무기 막힘 수 |
|---|---|---|---:|---:|---:|
| `PollaxeRendered` / 폴액스·실제 창 | idle | loss | 57.85 | 100.00 | 8 |
| `PollaxeRendered` / 폴액스·실제 창 | reckless | loss | 27.44 | 100.00 | 11 |
| `PollaxeRendered` / 폴액스·실제 창 | counter | loss | 25.04 | 100.00 | 13 |
| `GuandaoFlow` / 관도·headless | idle | loss | 22.02 | 100.00 | 12 |
| `GuandaoFlow` / 관도·headless | reckless | loss | 42.37 | 100.00 | 28 |
| `GuandaoFlow` / 관도·headless | counter | loss | 42.54 | 100.00 | 23 |
| `PollaxeCounter` / 폴액스·우회/거리 반격 | polearm-counter | loss | 42.82 | 76.69 | 15 |
| `GuandaoCounter` / 관도·우회/거리 반격 | polearm-counter | loss | 41.90 | 100.00 | 16 |
| `DefaultFlow` / 기본 장검·회귀 | idle | loss | 11.10 | 100.00 | 0 |
| `DefaultFlow` / 기본 장검·회귀 | reckless | win | 20.02 | 0.00 | 0 |
| `DefaultFlow` / 기본 장검·회귀 | counter | win | 20.11 | 0.00 | 0 |

두 `*Counter` 실행의 idle은 중복 대기 검사를 줄이기 위해 **1초만 관측**했으며 timeout이다. 따라서 해당 JSON의 `passivePlayerCanLose=false`는 무적 판정이 아니다. 긴 idle 검사는 별도의 PollaxeRendered/GuandaoFlow에서 실제 패배를 확인했다. 반면 활성 반격 정책의 실패는 그대로다. 폴액스 새 정책은 약23.31 HP 피해를 주었지만 패배했고, 관도는 준비거리를 확보하지 못해 공격 수락0회였다. 관도 전략 실패를 곧바로 무기 자체의 승률0%로 결론내리지 않는다.

폴액스 실제 창에서 자루 막힘이 집계되고 상대 찌르기 명중도 확인했다. 그러나 자루 후보의 모든 연속 자세·모든 무기 조합을 화면으로 통과시킨 것은 아니므로 아직 기본 적용 판단과 전체 회귀가 남아 있다.

## 7. 개발자가 이어받을 때의 재현·우선순위

### 환경과 실행

- 기준 호스트: macOS, Apple silicon MacBook. Unity **6000.3.25f1**.
- 고정 패키지: URP17.3.0, Animation Rigging1.4.1, Input System1.14.2, Test Framework1.6.0. `Packages/manifest.json`, `packages-lock.json` 보존.
- 실제 결투 장면: `Assets/DuelLab/Generated/Duel/DuelArena.unity`.
- Mac 앱: `Builds/Mac/DuelPreview.app`. Return/Space 시작, 방향키 또는 W/A/X/D 이동, Space 공격, Shift 방어, S 느리게, R 재시작, T 접촉 연습, C 상황 전환, Tab 개발용 무기 전환.
- 기존 Stroke 장면/앱과 CMU·Fiore 이전 증거를 삭제하거나 최신 합격 증거로 덮어쓰지 않는다.
- Unity Editor·빌드·테스트는 **같은 프로젝트에서 동시에 실행하지 않는다**. 무거운 Xcode 빌드와 런타임 성능 검사를 겹치지 않는다.

Mac 빌드는 Unity CLI에 `-batchmode -nographics -quit -projectPath <ROOT> -buildTarget StandaloneOSX -executeMethod DuelLab.Editor.DuelArenaBuild.BuildMacBatch -logFile <새 로그 경로>`를 전달한다. 테스트는 `-runTests -testPlatform EditMode` 또는 `PlayMode`와 `-testResults <새 XML>`을 사용하고, **테스트 명령에는 `-quit`를 추가하지 않는다**. 실제 XML의 passed/failed/skipped와 종료코드를 함께 확인한다.

런타임 진단 예시(프로젝트 루트에서, 기존 실행을 종료한 뒤):

```sh
python3 Tools/run-duel-probes.py Logs/Validation/NewReachRun \
  --probes reach --headless \
  --player-arg=--duel-polearm-shaft \
  --player-arg=--duel-reach-shaft-diagnostics \
  --player-arg=--duel-reach-weapons \
  --player-arg=met-pollaxe-14-25-302,paco-guandao-pd1055
```

새 evidence 폴더를 쓴다. 도구가 반환하는 모드/캡처 metadata boolean을 합격 boolean으로 세지 않도록 한다. 실패 JSON을 지우거나 성공 결과로 덮어쓰지 않는다. headless, camera-only offscreen, 실제 앱 창은 각각 별개의 검증 방식이다.

### 우선순위와 다음 연구가 필요한 이유

1. **자루 후보의 최종 통합 판단:** 실제 몸/무기 접촉의 화면, 피해0 자루 정책, 전체14무기·12보행·4접촉과 정상 기본 대전을 재검사한다. 코드의 opt-in 상태와 사용자에게 보여주는 앱 상태를 일치시킨다.
2. **긴 무기의 공격 기회:** 정지 표적 명중을 넘어서 좁은 경기장·준비시간·상대 안쪽 진입에서 실제로 유효한 전략을 만든다. 콜라이더·접촉 부위와 거리 문제를 먼저 분석하고 무조건 피해/힘을 올리지 않는다. 관도의 필요한 준비거리와 경기장 크기/보행 제약을 함께 검토한다.
3. **사람이 보는 동작 검수:** 준비–베기–회수 전체를 연속 화면으로 확인한다. 손목/팔꿈치의 뒤집힘, 양손 그립, 발 미끄럼, 자기 몸/의복 관통을 별도 항목으로 검토한다. 현재 마커 오차 통과만으로 자연스러움을 판단하지 않는다.
4. **필요에 따른 생체역학 자료 확장:** 현재 문제가 관절/그립이라면 상지 모델과 자세별 토크·ROM·두 손 협응 자료의 원문/원데이터를 확보한다. 피험자 조건·축·정적/동적 차이를 확인한 뒤 민감도 실험으로 적용한다. Delp의 한 손목 수치를 전신의24 N·m 상한으로 대체하지 않는다.
5. **필요에 따른 관성 계측:** 같은 개체의 진자/회전 측정 자료와 단면·테이퍼를 확보한다. COM과 관성이 다른 검의 값을 혼합하지 않는다. 비대칭 머리의 축외 COM/주축이 필요한지 실제 오차로 판단한다.
6. **iPhone:** 최신 채택 소스로 새 export/unsigned build를 만들고, 기기 연결·서명 뒤 실제 입력/멀티터치·햅틱·프레임·발열을 측정한다. 현재 기기 시험이 없으므로60fps나 촉각 품질을 약속하지 않는다.
7. **후순위:** 세밀한 피로/근육 모델, 무기 탄성/파단, 절삭·갑옷 파괴, 성장/숙련도, 무기 선택 제품 설계는 핵심 접촉/대전 품질 이후 필요에 따라 추가한다.

### 빌드·검증 스냅샷과 파일 안내

| 범위 | 확인 결과 | 증거 위치 |
|---|---|---|
| 자루 후보 통합 시점의 자세/데이터 회귀 | EditMode39/39 | `Logs/Validation/Overnight/PolearmShaftExperiment/EditMode-results.xml` |
| 실제 물리 회귀 | PlayMode15/15 | `Logs/Validation/Overnight/PolearmShaftExperiment/transition-playmode-results.xml` |
| 폴암 자루 후보 Mac 빌드 | 136,995,671 bytes /11.556796s /0오류·0경고 | `PolearmShaftExperiment/PhysicsShaft/build-evidence.json` |
| 이전 안정 통합 | 14무기·12보행·4접촉 | `PolearmHorizontalExperiment/FinalIntegration/` |
| 양손 찌르기 | 241자세 회귀·실제 접촉·offscreen7장·게임창3장 | `TwoHandThrustExperiment/` |
| 자루 물리/접촉 A/B | PhysicsLegacy/Shaft, ReachLegacy/Shaft | `PolearmShaftExperiment/` |
| 최신 대전 정책 | 위 표의5실행 | `PolearmShaftExperiment/` |
| 마지막 완료 iOS export | 1,232,135,677 bytes /36.424158s /0오류·0경고 | `Logs/Validation/Overnight/iOSPolearms/build-evidence.json` |
| 같은 iOS 전체 unsigned Xcode | 281.153534s /0오류·36경고 줄, 앱156,319,694 bytes | 같은 증거 파일, `Builds/iOS/DerivedDataPolearms/` |

위 표의 축약 실험 경로는 `Logs/Validation/Overnight/` 아래다. iOS 앱/UnityFramework는 arm64·최소iOS15·무서명이며, 네이티브 햅틱3함수·ARC·CoreHaptics 약한 연결과 export 전후 소스 해시 일치를 확인했다. 이는 설치/기기 재생/손맛 확인과 별개이고 **최신 Mac 후보와 동일 소스 버전이 아니다**.

주요 소스는 `WeaponCatalog.cs`, `PhysicalSwordMotor.cs`, `DuelFencer.cs`, `DuelArena.cs`, `WholeBodyStroke.cs`, `FendenteStudy.cs`, `PolearmStudy.cs`, `ShortWeaponStudy.cs`, `TwoHandThrustStudy.cs`다(모두 `Assets/DuelLab/Runtime/` 아래). 장면·실행·규칙 인계는 `MAC_START_HERE.md`, `NEXT_SESSION.md`, `ONE_MINUTE_SPEC.md`, `VALIDATION.md`, 가장 최근 작업 상태는 `OVERNIGHT_PROGRESS.md`를 본다. 옛 문서의 “진행 중”·“미구현” 문구는 작성 시점과 해당 장면을 확인한다.

### 권리·외형·소리

무기 사진/상용 메시/영화 로고를 프로필 숫자와 함께 취득한 것으로 간주하지 않는다. MakeHuman 재사용과 원본 CC0 크레딧, CMU의 별도 이용조건, 교본/박물관 자료의 출처를 보존한다. 이미지/모션 재배포는 숫자 인용과 다른 권리 범위다.

소리는 문서화한 CC0 녹음3종과 자체 합성한 나무/전기/스침음을 연결했다(`Documentation/Audio/SOURCES.md`). 모든 음이 실녹음이라고 하지 않는다. 실제 청감과 iPhone 햅틱은 아직 검증하지 않았다. `ContactSurface`의 Steel/Cloth/Wood·`hapticHardness`는 피드백 분류이며, 실측 마찰/반발계수와 다르다.

## 부록 A. 추가 게임 프로필 값

표의 폭은 collider/외형 근사에 쓰는 `headWidthM`이며, 물리적으로 정확한 전체 외곽 형상은 아니다. 배율은 창작 게임 설정이다.

| ID | 머리/날 폭 m | 두 손 정책 | 피해 배율 | 모터 배율 |
|---|---:|---|---:|---:|
| `albion-crecy` | 0.0500 | 양손 | 1.00 | 1.00 |
| `albion-liechtenauer` | 0.0490 | 양손 | 1.00 | 1.00 |
| `albion-knight` | 0.0524 | 한손 | 1.00 | 1.00 |
| `worcester-rondel-2018-3` | 0.0230 | 한손 | 1.00 | 1.00 |
| `met-warhammer-14-25-1342` | 0.1110 | 한손 | 1.00 | 1.00 |
| `paco-warhammer-pd1058` | 0.2550 | 한손 | 1.00 | 1.00 |
| `met-pollaxe-14-25-302` | 0.2100 | 양손 | 1.00 | 1.00 |
| `bm-dane-axe-reconstruction` | 0.2800 | 양손 | 1.00 | 1.00 |
| `met-katana-36-25-1685` | 0.0300 | 양손 | 1.00 | 1.00 |
| `paco-guandao-pd1055` | 0.1700 | 양손 | 1.00 | 1.00 |
| `excalibur` | 0.0450 | 양손 | 2.20 | 1.30 |
| `lightsaber` | 0.0250 | 한손 | 1.65 | 1.20 |
| `branch` | 0.0350 | 양손 | 0.25 | 0.55 |
| `frozen-chicken` | 0.1200 | 한손 | 0.70 | 0.80 |

## 부록 B. 추정 모델 입력과 재현 주의

다음은 카탈로그의 `modelInputs`를 옮긴 것이다. 길이는 m, 밀도는 kg/m³다. `_range`는 민감도 비교의 가정 범위다. 구성 부품 질량·중심·크기의 전체 목록은 JSON의 `massModel.components`에 있으며, 카탈로그 재생성기는 네트워크 없이 계산한다. 아래 배열 범위를 측정 불확도로 해석하지 않는다.

```json
{
  "albion-crecy": {
    "grip_range": [
      0.16,
      0.21
    ],
    "thickness": 0.0055,
    "guard_width": 0.22,
    "pommel_width": 0.05
  },
  "albion-liechtenauer": {
    "grip_range": [
      0.2,
      0.25
    ],
    "thickness": 0.006,
    "guard_width": 0.23,
    "pommel_width": 0.05
  },
  "albion-knight": {
    "grip_range": [
      0.095,
      0.115
    ],
    "thickness": 0.0055,
    "guard_width": 0.2,
    "pommel_width": 0.054
  },
  "worcester-rondel-2018-3": {
    "grip_range": [
      0.085,
      0.11
    ],
    "com_range": [
      -0.01,
      0.055
    ],
    "thickness": 0.009,
    "guard_width": 0.045,
    "pommel_width": 0.045
  },
  "met-warhammer-14-25-1342": {
    "grip_range": [
      0.1,
      0.14
    ],
    "head_length_range": [
      0.05,
      0.1
    ],
    "shaft_width": 0.022,
    "shaft_thickness": 0.022,
    "head_thickness": 0.033,
    "head_fraction": 0.6,
    "head_fraction_range": [
      0.45,
      0.7
    ],
    "com_range": [
      0.18769999999999998,
      0.30545
    ],
    "mass_range": [
      0.9922,
      0.9922
    ]
  },
  "paco-warhammer-pd1058": {
    "grip_range": [
      0.11,
      0.16
    ],
    "head_length_range": [
      0.05,
      0.11
    ],
    "shaft_width": 0.022,
    "shaft_thickness": 0.022,
    "head_thickness": 0.038,
    "head_fraction": 0.55,
    "head_fraction_range": [
      0.4,
      0.7
    ],
    "com_range": [
      0.3895,
      0.5827499999999998
    ],
    "mass_range": [
      1.647,
      1.647
    ]
  },
  "met-pollaxe-14-25-302": {
    "grip_range": [
      0.45,
      0.75
    ],
    "head_length_range": [
      0.29,
      0.34
    ],
    "shaft_width": 0.033,
    "shaft_thickness": 0.029,
    "head_thickness": 0.032,
    "head_fraction": 0.52,
    "head_fraction_range": [
      0.4,
      0.65
    ],
    "com_range": [
      0.5870000000000001,
      1.146375
    ],
    "mass_range": [
      2.4664,
      2.4664
    ]
  },
  "bm-dane-axe-reconstruction": {
    "grip_range": [
      0.45,
      0.75
    ],
    "head_length_range": [
      0.22,
      0.28
    ],
    "shaft_width": 0.032,
    "shaft_thickness": 0.027,
    "head_thickness": 0.0336,
    "head_mass": 0.966,
    "shaft_density": 650,
    "shaft_density_range": [
      550,
      750
    ],
    "com_range": [
      0.2855930882161881,
      0.6577626453402584
    ],
    "mass_range": [
      1.612272,
      1.86672
    ]
  },
  "met-katana-36-25-1685": {
    "grip_range": [
      0.22,
      0.28
    ],
    "com_range": [
      0.07,
      0.16
    ],
    "thickness": 0.006,
    "guard_width": 0.09,
    "pommel_width": 0.035,
    "mass_estimated": true
  },
  "paco-guandao-pd1055": {
    "grip_range": [
      0.55,
      0.8
    ],
    "head_length_range": [
      0.3,
      0.42
    ],
    "shaft_width": 0.035,
    "shaft_thickness": 0.035,
    "head_thickness": 0.04,
    "head_fraction": 0.42,
    "head_fraction_range": [
      0.3,
      0.55
    ],
    "published_head": false,
    "com_range": [
      0.8802499999999999,
      1.4998750000000003
    ],
    "mass_range": [
      4.986,
      4.986
    ]
  }
}
```

카탈로그 SHA-256(이 인계서 작성 시점): `b307901cd960edd344bfde90f66e982451285229b5a55aea2407de2473052d0b`. 후속 수정 시 이 문서와 카탈로그가 같은 버전인지 다시 확인한다.
