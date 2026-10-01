# 큰 힘의 생성과 전달: 스포츠 생체역학 원문 연구

2026-10-01. 물리·조작 PM의 1차 연구. 공개 원문 5편의 표본·과제·측정 정의, 관련 Results와 Discussion/한계 절을 실제 읽었다. 초록만 읽은 논문을 아래 근거에 포함하지 않았다. 개인별 원데이터 재분석·그림 수치 추출·검술 실험·게임 코드 변경은 하지 않았다.

## 먼저 확인한 결론

큰 힘을 만들려면 지지와 몸통의 움직임이 중요하지만, **분절의 피크 순서를 맞추는 것만으로 전달된 일·충격량·타격 결과를 보장할 수 없다.** 관절 힘과 모멘트가 인접 분절에 에너지를 전달하는 것, 관절에서 에너지를 생성/흡수하는 것, 접촉에서 전달하는 것은 서로 다른 측정이다. 아래 원문은 이들을 구별할 근거를 제공하며 assist/catch, 관절 최대토크, 검 속도 상한의 정답을 제공하지 않는다.

같은 최종 속도를 내도 장비 관성과 기술에 따라 관절 부담이 달라진다. 속도·순서·몸 전체 KE 가운데 하나만 점수로 삼기보다 지면 충격량, 관절별 힘/토크의 일, 검의 실제 운동, 충돌의 접촉 조건을 함께 관찰해야 한다. 이는 [전신 물리 계획](physical_realism_plan.md)의 계층 장부를 지지하는 연구 인계다.

## 실제 열람한 출처

| 출처·원문 접근 | 근거 종류·조건 | 실제 읽은 범위·게임 적용 범위 | 주요 한계 |
|---|---|---|---|
| Matsuda, Hirano, Umakoshi, Kimura (2025), *Energy flows with intentional changes in leg movements during baseball pitching*. [DOI:10.3389/fspor.2025.1534596](https://doi.org/10.3389/fspor.2025.1534596), [PMC12011807](https://pmc.ncbi.nlm.nih.gov/articles/PMC12011807/), [실제로 연 XML](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12011807/fullTextXML) | 사람 실측 + 역동역학 추정. 건강한 남자 대학 투수20명,19.9±1.1세. 정상 보폭과 ±20% 보폭을 무작위 순서로 비교, 조건 사이1주. 평지 힘판에서16m 표적에 최대 노력 fastball. | Methods §2 표본·보폭·측정·power 정의, Results §3, Discussion §4/결론. 다리 입력 증가와 몸통/원위부 전달을 분리하는 가설에 사용. | 실험실 평지·특정 투수·표적 과제. 관절 힘/토크는 직접 센서 실측이 아닌 모델 추정. 검·부상·판금·연속 결투 외삽 불가. |
| Köhler, Witt (2023), *Energy flow in men's javelin throw and its relationship to joint load and performance*. [DOI:10.7717/peerj.16081](https://doi.org/10.7717/peerj.16081), [PMC10516106](https://pmc.ncbi.nlm.nih.gov/articles/PMC10516106/), [XML](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10516106/fullTextXML) | 사람 실측 + 역동역학·회귀 추정. 독일 국가/주니어 국가대표 오른손 남자10명,21.8±3.6세. 실내 그물로800g 창 투척, 최소3회 중 release speed 최고3회 분석. | Methods의 SP/TGA 정의와 Table1, Results, Discussion의 전달/생성·소표본/모델 한계. 각 관절에서 생성한 에너지와 통과시킨 에너지를 분리하는 데 사용. | 실제 경기보다 낮은 release speed,6분절 모델·관성/관절중심 추정·소표본 회귀. 탄성 재사용과 근육 생성의 분리는 불완전. |
| Rogowski, Creveaux, Chèze, Macé, Dumas (2014), *Effects of the racket polar moment of inertia on dominant upper limb joint moments during tennis serve*. [DOI:10.1371/journal.pone.0104785](https://doi.org/10.1371/journal.pone.0104785), [PMC4130553](https://pmc.ncbi.nlm.nih.gov/articles/PMC4130553/), [XML](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4130553/fullTextXML) | 사람 실측 + 3D 역동역학. 남자8명,26.7±4.9세,ITN3. 두 라켓의 polar inertia만 다르게 하여 실내 flat serve, 각10회. 비슷한 post-impact ball speed가 목표. | Methods, Results 및 Table1/2 해석, Discussion/한계. 같은 목표 속도에서도 관성·제동 부담을 관찰할 근거. | 성공하고 비슷한 속도인3회 선택, 작은 남성 표본, 다리 marker 없음. 최대 속도를 겨룬 실험이 아니며 검의 회전축·양손 파지와 다름. |
| Aguinaldo, Escamilla (2019), *Segmental Power Analysis of Sequential Body Motion and Elbow Valgus Loading During Baseball Pitching: Comparison Between Professional and High School Baseball Players*. [DOI:10.1177/2325967119827924](https://doi.org/10.1177/2325967119827924), [PMC6390228](https://pmc.ncbi.nlm.nih.gov/articles/PMC6390228/), [XML](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6390228/fullTextXML) | 횡단 사람 실측 + segment power/회귀. 건강한 프로16명·고교15명,각21.9±3.6/15.5±1.1세. 실제 mound fastball15회 중 표적에 맞은 빠른3회, 최종 최고1회 분석. | Methods, Results, Discussion 전체 관련 문단·한계. 피크 시각과 몸통 power를 함께 읽으며 고정 순서의 한계를 확인. | 두 집단의 체격·나이가 다름. 하체 모델 제외, motion-dependent interactive torque를 분해하지 않음. 상관·회귀를 인과적 최적 기술로 해석 불가. |
| Menzel, Potthast (2021), *Application of a Validated Innovative Smart Wearable for Performance Analysis by Experienced and Non-Experienced Athletes in Boxing*. [DOI:10.3390/s21237882](https://doi.org/10.3390/s21237882), [PMC8659887](https://pmc.ncbi.nlm.nih.gov/articles/PMC8659887/), [XML](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8659887/fullTextXML) | 사람 센서 실측.31명: 경험≥3년11명/그 미만20명.12oz 센서 glove·40kg 매달린 bag, jab/cross/hook/uppercut 각 저강도와 최대 노력5회. | Methods, Results의 힘/속도·Table6 설명, Discussion의 유효질량 가설/접촉시간·한계. 속도·힘·충격량을 분리하는 관찰 근거. | 독립 최대 단타·bag 과제이며 스파링/연타 아님. 유효질량은 **직접 측정 결과가 아니라 저자의 후속 가설**. 장비의 선행 validation은 이 논문이 인용한 연구이며 이번에 그 원데이터를 재검증하지 않았다. |

다섯 편은 리뷰가 아니라 원실험 논문이다. 원문 속 다른 연구의 주장까지 새로 열람한 근거로 계산하지 않는다. 원문 XML·본문 읽기용 텍스트·접근 결과·SHA256은 저장소 밖 `/workspace/halfsword-physics-research-20261001/`에 보존했다(`access-manifest.json`, `research-cards.json`, 각 PMC XML/reading.txt). 자동 추출한 본문 전체가 모두 정독됐다는 뜻은 아니며, 위 표가 실제 읽은 판정 범위다.

## 1. 지지에서 몸통으로 더 넣어도 최종 출력이 단순 증가하지 않는다

Matsuda의250Hz 모캡(13카메라)과1,000Hz 양쪽 힘판 데이터를16분절 모델로 분석했다. MKH(무릎 최고)→SFC(앞발 접촉)→MER(어깨 최대 외회전)→REL(공 놓기)을 구분하고 하부 몸통으로 들어오고 나가는 joint force power와 segment torque power를 적분했다.

짧은/정상/긴 보폭의 ball velocity는 각각32.48±1.72,33.90±1.86,32.48±1.70m/s였다(Results §3). 긴 보폭은 pivot hip에서 하부 몸통으로의 유입과 일부 시기의 상부 방향 유출을 증가시켰지만, 두 분석 단계 전체의 하부 몸통→trunk joint 유출 총량은 조건 간 유의차가 없었다(Discussion §4, Figure8 설명). 정상 보폭이 더 빨랐으며 길고 짧은 조건끼리는 유의차가 없었다.

따라서 ‘다리 힘/보폭/하체 에너지를 크게 만들면 칼도 항상 더 세진다’는 가설은 그대로 채택할 수 없다. 몸통과 팔로 어떤 방향·시각에 전달되었는지, 원위부가 그 전달을 받아 가속할 수 있었는지까지 봐야 한다. 원문도 하체 결과만으로 공 속도를 설명하기 어렵다고 명시한다. ±20%와 공 속도는 이 과제의 조건·결과이며 게임 상수가 아니다.

고정된 미끄럼 없는 지면의 실제 접촉점 속도가0이면 `F_ground·v_contact`의 접촉 일도0이다. 지면 반력은 필요한 충격량·회전 지지와 제약을 제공하지만, 지면 자체가 자유 에너지를 공급한다고 설명하지 않는다. 새 기계에너지의 공급원은 근육을 나타내는 actuator의 일이며, 이동하는 지면·미끄럼·탄성·알고리즘 보조가 있으면 별도 계정이다. 이 문단은 기본 역학 해석이며 논문에서 직접 측정한 대사 에너지 결과가 아니다.

## 2. 전달·생성·흡수를 따로 계산한다

Köhler/Witt는300Hz 모캡(12카메라)·150Hz 보조 영상, hand/forearm/upperarm/thorax/abdomen/javelin의6분절 모델과 Newton–Euler 역동역학을 사용했다. 평균 release speed22.73±1.28m/s는 실내 과제의 결과다. 그립이나 어깨의 실제 근육 토크를 직접 센서로 잰 값이 아니다.

관절을 건너는 힘의 power는 `F_joint·v_joint`, 각 분절 끝의 segment torque power는 `τ_on_segment·ω_segment`다. 힘/토크는 인접 분절에 크기가 같고 방향이 반대지만 두 분절의 각속도는 다를 수 있다. 따라서 토크가 한 분절의 에너지를 다른 분절로 전달하는 동시에 관절의 기계에너지를 생성하거나 흡수할 수도 있다. 원문은 SP와 transfer/generation/absorption(TGA)을 별도 분석했다(Methods, Table1).

이 표본에서는 어깨를 통한 전달이 큰 비중을 차지했고, elbow/wrist에서 추가 생성하는 에너지의 peak가 release speed와 유의한 관계를 보이지 않았다. 어깨의 생성과 전달은 부하에 미치는 회귀 계수가 달랐다. 저자는 원위부에서 무조건 더 생성시키기보다 근위부 전달을 효율적으로 이용하는 방향을 제안했지만, 탄성 재사용인지 근육 생성인지와 생성의 정확한 기여를 현재 자료로 확정하지 못한다고도 밝혔다(Discussion).

게임에서 `τ·ω`를 무조건 모든 관절의 ‘새 생성 에너지’로 합하면 내부 전달을 중복 계산할 수 있다. 부모/자식 torque power를 함께 기록하고, actuator 쌍의 합 `τ·(ω_child−ω_parent)`와 각 분절을 통과한 power를 구별한다. 관절 힘의 전달도 기록하며, 적분한 총 일과 단일 peak를 함께 본다. net joint moment는 여러 근육·수동 조직의 합이므로 개별 근육의 최대 힘을 그대로 주지 않는다.

## 3. 순서와 최종 속도만 같아도 부담·출력은 다를 수 있다

Aguinaldo/Escamilla는300Hz 모캡·radar로 프로/고교 투수를 비교했다. peak 시각은 앞발 접촉→공 놓기 구간을 %PC로 정규화했다. 프로가 더 빠른 공을 던졌지만 단순 body-mass-normalized trunk peak power는 두 집단에서 유의하게 다르지 않았다(Results). 몸통 회전 timing과 power를 함께 넣은 전체 표본 회귀는 ball speed 분산의53.4%를 설명했으며, 집단별 설명 양상도 달랐다.

이는 순서나 한 peak로 충분하다는 증명이 아니다. timing은 기술·체격·근력·모델링과 묶인 관찰 변수이며, 설명되지 않은 분산과 집단 차이가 남는다. 논문 자체가 하체 제외 및 motion-dependent interactive torque 미분해를 한계로 적었다. 정규화된 peak 순서를 게임의 고정 발동 시간표로 복사하지 않는다.

Rogowski의 테니스 실험은 질량0.327kg·COM0.336m·swingweight0.0339kg·m²를 같게 유지하고 polar inertia를0.00152/0.00197kg·m²로 달리했다.500Hz 모캡·3D 역동역학으로 순기능/음의 joint power를 계산했다. 선택된 serve는 racket face 속도22.1/21.8m/s, 공 속도 양쪽37.5m/s로 유의차가 없었지만 여러 어깨·팔꿈치·손목 부하와 forward swing의 음의 power가 달랐다.

동일한 입력 목표를 강한 servo가 달성하면 관성의 차이가 속도 대신 필요한 토크·제동 부담에 나타날 수 있다. 이 가능성을 게임에서 검증할 수 있지만, 논문은 사람이 적응한 동작과 선택된 비슷한 출력의 실험이므로 게임 servo의 특정 결함을 입증하지는 않는다. ‘더 큰 관성인데 같은 속도면 관성이 구현되지 않았다’는 판정도 성립하지 않는다.

원문 점검 사항: 테니스 Results의 일부 I_L/I_H 방향 문장이 Table1 및 Discussion과 불일치하는 표현을 보인다. 해당 방향은 표를 다시 확인했고, 이 인계에서는 불일치 문장 하나만으로 부하 방향을 단정하지 않는다. 정규화된 Table1 값을 절대 Nm 최대토크로 복사하지 않는다.

## 4. 힘의 peak·충격량·유효질량·전달 에너지는 별개다

Menzel/Potthast는1,000Hz 센서로 attack/contact/retraction을 분리하고 glove의 힘·속도·방향·충격량을 기록했다. 경험 집단 간 최대 fist speed의 유의차가 없었지만 일부 punch 종류의 peak force 차이가 있었다(Results, Table6 설명). 낮은 속도의 hook/uppercut이 높은 힘을 보인 결과에서 저자는 더 큰 유효질량을 **가정**하고 후속 조사를 제안했다(Discussion: “leads to the assumption”). 유효질량을 직접 실측한 결론으로 인용하면 안 된다.

논문은 경험이 적은 집단의 긴 contact time이 일부 punch의 큰 impulse와 연결될 수 있으며, impulse 하나만으로 기술의 효과를 판정하기 어렵다고 설명했다. bag/패딩의 순응성, 작용 방향, 접촉 시간과 접촉 중 추가 밀기가 모두 중요하다. peak force가 크다는 사실만으로 질량·에너지·관통 효과를 역추정하지 않는다. 이 연구는 절단·검날·인체 조직 손상에 대한 직접 근거가 아니다.

## 5. 사용할 공식과 3D·다물체 적용 범위

아래 식은 **기본 역학 모델의 정의/유도**이며, 위 사람 논문들이 모든 항을 직접 실측하거나 Stillness에 검증했다는 의미가 아니다. 벡터·관성 텐서·속도는 같은 좌표계에 놓는다.

| 공식 | 적용 조건·게임에서 확인할 것 |
|---|---|
| `ΣF_ext = m a_COM` | 관성계·고정 질량인 계의 COM에 대한 순외력이다. 단일 근육 힘이나 팔 목표속도와 전체 체중을 곱한 값이 아니다. 내부 힘은 계의 경계에 따라 상쇄된다. footExtra처럼 질량을 바꾸는 게임 사건은 별도 장부에 남긴다. |
| `τ_ext,COM = dL_COM/dt = I_world α + ω×(I_world ω)` | 강체의 일반3D 회전은 tensor 및 gyroscopic 항이 필요하다. 고정 단일축/적절한 조건에서만 scalar `τ=Iα`로 줄인다. 다관절 시스템에서는 M(q),속도 의존항,중력,접촉 제약을 함께 푼다. |
| `J_contact = ∫F_contact dt` | 충격량 단위N·s. 전체 `Δp`와 비교할 때 중력·지면·actuator 등 같은 구간의 다른 외력을 포함한다. peak force에 임의 고정시간을 곱하지 않는다. |
| `K = Σ(½m v_COM² + ½ωᵀI_worldω)`, `V = Σmg h_COM` | 공격자 전체 K와 접촉 법선 방향에서 교환 가능한 에너지는 다르다. 무기 COM 낙차로 계산한 중력 일과 actuator/감쇠/접촉의 일을 분리한다. |
| `P_force = F·v_at_application`, `P_torque = τ·ω`, `W=∫Pdt` | 힘 작용점의 속도를 쓰며 rigid-body COM 속도로 모든 접촉/그립 power를 대신하지 않는다. joint actuator의 생성/흡수 power는 반작용을 포함한 상대 각속도와 구별한다. |

일반 다물체 식은 `M(q)q̈ + C(q,q̇)q̇ + g(q) = τ_act + J_cᵀλ + Q_other`로 쓸 수 있다. kinematic upright·직접 골반 보조는 사람 근육의 내부 제어로 조용히 합치지 말고 경계에 맞는 외부/추상 제어 항으로 표시한다.

### 접촉 방향의 다물체 유효질량: 계산 모델

고정 자세에서 순간적인 contact impulse `j n`만 가하고 활성 제약을 고정하는 이상 모델을 생각한다. 질량 행렬M, 접촉점 JacobianJ에 대해 `Δq̇ = M⁻¹Jᵀn j`이므로:

`k = nᵀ J M⁻¹ Jᵀ n`, `Δv_contact,n = k j`, `m_eff = 1/k`.

두 동적 계의 상대 접촉속도라면 `k_rel = k_A + k_B`, `m_eff,rel = 1/k_rel`이다. 이상적인 고정 바닥은 자체 inverse effective mass가0이다. 기존 발 지지가 강체 제약A로 활성화되어 있으면 단순한 M⁻¹ 대신 제약을 투영한 값을 써야 한다:

`M_c⁻¹ = M⁻¹ − M⁻¹Aᵀ (A M⁻¹Aᵀ)† A M⁻¹`.

여기서 †는 필요 시 의사역행렬이다. 지지/미끄럼·그립·관절 잠김에 따라 활성 제약과 Jacobian이 달라지며, k가0에 가까운 경우 단순 역수를 안전하게 해석할 수 없다. 게임에서는 finite motor torque·그립 compliance·접촉 시간·마찰 전환이 있으므로 이 순간 선형 모델만으로 전체 타격을 설명할 수 없다. 모터나 다른 외력까지 섞인 긴 구간의 `J/Δv`를 유효질량 실측값으로 바로 부르지 않는다.

`½ m_eff,rel v_rel,n²`도 위 축약 모델의 법선 방향 상대 운동량 교환을 설명하는 에너지 척도다. 곧바로 피해·절단 에너지나 항상 실제로 흡수된 에너지로 쓰지 않는다. 반발·마찰·변형·접촉 중 actuator의 일과 표적의 자유도를 더 알아야 한다. **온몸 KE를 피해로 더하는 규칙**은 이 식이나 이번 논문의 결론에서 나오지 않는다.

## 게임에 적용할 검증 가설과 작은 순서

1. **지면 지지의 역할:** 고정 지지가 전신 선/각 운동량 변화와 몸통 회전을 가능하게 하는지 확인한다. 실제 지면 충격량·점속도와 직접 골반/upright 보조를 분리한다. ground reaction이 존재한다고 온몸 에너지가 검에 전달됐다고 판정하지 않는다.
2. **힘 생성과 전달:** 몸통/팔 actuator의 새 일과 관절을 통과한 SP를 구별한다. 같은 총 입력/예산에서 timing만 바꾼 조건과 몸통 회전 자체를 바꾼 조건을 구분하고, 실제 전달·검 K·관절 부하를 함께 관찰한다. 더 나은 peak 순서를 먼저 정답으로 고정하지 않는다.
3. **관성·제동:** 같은 목표 궤적/출력 조건과 같은 실제 토크 예산 조건을 나누어 비교한다. 질량뿐 아니라 COM와 각 축 관성이 달라질 때 토크·지지 부담·release 뒤 진행/제동·그립 반작용이 어떻게 달라지는지 기록한다. 관성 체감의 원인을 속도 한 항으로 환원하지 않는다.
4. **접촉:** 충돌 직전 실제 점속도·법선·자세·지지/그립 상태, 접촉 J와 양쪽 운동량 변화·제어 일을 전투 PM의 유효질량/접촉 모델과 연결한다. 소스가 같은 동일 초기 상태 비교를 먼저 마련하며 위 스포츠의 ball/punch 속도를 검 상한으로 쓰지 않는다.
5. **수락:** 장부 잔차·계측 교정·시뮬 회귀는 공학 판정이다. 몸/검의 무게·조작·강타·반작용의 자연스러움은 사용자의 연속 플레이 판정으로 확인한다. AI 승률·저작 클립의 peak 오차는 이 판정을 대신하지 않는다.

이번 자료는 무기를 계속 쥐고 상대와 부딪히는 검술, 부상/판금, 연속 강타의 직접 실측을 포함하지 않는다. 다음 연구에서 그 공백을 따로 채우되 현재 논문의 소표본 회귀·순서·peak·속도·힘 숫자를 숨은 제어 한도로 옮기지 않는다.
