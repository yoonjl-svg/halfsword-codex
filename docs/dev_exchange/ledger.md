# 개발 교환 누적 대장

고정 ID는 날짜 문서가 바뀌어도 유지한다. 이 대장의 채택 상태는 **우리 게임** 기준이다. 상대 팀의 실제 검토·채택은 확인한 뒤 링크로 남긴다. 처음 구성은 페이블의 대장 제안을 참고했다([초기 규약 대조](interop.md)).

| ID | 날짜 | 요지 | 판정·활성 상태 | 소스 근거 | 상대가 가져갈 때 | 상대 검토 |
|---|---|---|---|---|---|---|
| A-001 | 2026-10-01 | 공유 벡터가 보행 방향을 덮던 결함 | 기본 반영, 36조건 검사 | `7da5f3f`, `src/fighter.js` | 같은 임시 벡터 사용 여부 확인 후 작은 수정 | 미확인 |
| A-002 | 2026-10-01 | 받침/균형 회복 2×2 비교, B 우선 | 선택 시험, 일반 기본값 유지 | `e5ec64d`, `public/support-lab.html` | 사용자 체감과 제어 구조 차이를 먼저 확인 | 미확인 |
| A-003 | 2026-10-01 | 접촉 기반 기립 R0 | 실패·기각, 공개 연결 제거 | `tools/sim/experiments/recovery_contact_r0.patch` | 실패 조건과 재현 도구만 공유 | 미확인 |
| A-004 | 2026-10-01 | 신체 모델·전신 일 전달·스포츠 문헌 | 연구, 대규모 제어 변경 미반영 | `1b545e8`, `19beb12`, `docs/strike/` | 계측·공식·적용 한계 공유 | 미확인 |
| A-005 | 2026-10-01 | 승인된 35차 강베기 세트 활성화 | 기본 반영 | `d94410c`, `src/config.js` | 같은 샘플·매핑인지 확인 | 미확인 |
| A-006 | 2026-10-01 | 저체력 숨 이벤트 gain −12.5% | 기본 반영, 공개 실제 재생 확인 | `19beb12`, `src/sound.js` | 숨 이벤트 경로가 같으면 작은 수정 | 미확인 |
| A-007 | 2026-10-01 | 고정 철구 모르겐슈테른 | 선택 시험, 파손 잔여 충돌 수정 | `19beb12`, `src/weapons.js`, `src/fighter.js` | 질량/관성·파손 수정 함께 검토 | 미확인 |
| A-008 | 2026-10-01 | 팔꿈치·무릎 절단 | 선택 시험, 일반 off, 88검사 | `19beb12`, `src/limb_sever.js` | 피해·근육·기립·출혈 경로 의존성 확인 | 미확인 |
| A-009 | 2026-10-01 | API+Actions 전송과 모바일 배포 검증 | 운영에 적용, 직접 Git 인증은 미복구 | `tools/github/publish_verified.py` | 환경이 같은 경우만 참고 | 미확인 |
| A-010 | 2026-10-01 | 일일 보고·출처 검증·상호 검토 상태 분리 | 자동 발행/수신 구성, 의미 검토 연결 미구성 | `docs/dev_exchange/`, `tools/dev_exchange/` | 공통 경로·manifest·실제 공통 조상을 맞춘다 | 우화의 설정·manifest 계획·조상 정정 회신을 사용자 경유로 받음; 실행 직접 검증 대기 |
| A-011 | 2026-10-01 | 독립 탐색 유지·접촉을 자정 정기 회차로 제한 | 같은 실험의 다른 접근 허용, 분담 의무 없음; 시간 밖 API 차단 | `AGENTS.md`, `docs/devmeet/README.md`, `tools/dev_exchange/` | 00:00–00:20 KST만 접촉, 누락은 다음 회차; 별도 재확인 없음 | 새 방침 이후 추가 상대 조회 없음 |

| A-012 | 2026-10-02 | 실제 힘·일·운동량 장부 | 연구 도구, 9교정·계측 trace 동일 | `tools/sim/force_ledger*`, [결과](../strike/force_path_round1.md) | native 미계측·질량 변화·일 근사 한계 함께 가져감 | 미확인 |
| A-013 | 2026-10-02 | 양손 힘쌍 공통 작용점 | 사용자 수용 후 기본 paired 승격; 강타 개선 미입증 | [소스/배포](../strike/support_transfer_release.md) | offHand/점속도 경로·cap·좌표계 확인 | 미확인 |
| A-014 | 2026-10-02 | 네 자세의 바닥 없는 직접 골반 받침 | 진단 완료, 지지 재설계는 다음 단계 | `body_support_ledger_probe.mjs`, [계측](../strike/force_path_round1_metrics.json) | 상태 고정 없이 같은 준비 상태에서 대조 | 미확인 |
| A-015 | 2026-10-02 | 실제 접촉 기반 축 방향 지지 힘쌍 | 선택 시험 출시 후 사용자 발사 보고로 철회 | [당시 구현](../strike/support_transfer_round2.md), [철회](../strike/support_launch_incident.md) | 현재 후보 전체 채택은 권하지 않음 | 미확인 |
| A-016 | 2026-10-02 | 초기 VMC 토크 이관 | 과도한 토크/기립 실패로 기각 | `experiments/support_transfer_discovery.mjs` | 실패 조건만 참고 | 미확인 |
| A-017 | 2026-10-02 | 전진 내부 힘쌍/직접 외력 경로 대조 | 내부 전달도 미끄럼에 관여; 외력 치환은 기각 | [진단](../strike/support_pair_cause_metrics.json) | 접촉 gate와 힘 방향을 함께 검토 | 미확인 |
| A-018 | 2026-10-02 | 누움 후 발사 사용자 보고·공개 철회 | 기존 직접 URL까지 비활성, 공개 검증 완료 | `b6483ea`→`c8a179be`, [기록](../strike/support_launch_incident.md) | URL 체계 확인 후 철회 조치 이식 가능 | 미확인 |
| A-019 | 2026-10-02 | 수평 다리 축력 불연속·근육 상한 수정 | 격리 연구 유지; 동일 누움 부상 재넘어짐3회로 재공개 불가 | [소스·측정 해시](../strike/support_launch_incident_metrics.json) | 수정과 실패 재현 함께 검토; 전체 지지 채택 보류 | 미확인 |

| A-020 | 2026-10-02 | 우화 한손 자세표 이식 | 사용자 직접 요청; 한손 8종·두손 3종/모바일 검증 완료 | `guards.js`, `fighter.js`, [출처·소스·배포](../strike/onehand_grip_port.md) | `f53b330` 표 그대로, `9763484` 한손 부분만; corr v2 제외 | 원본 코드 채택 |
| A-021 | 2026-10-02 | native 0계수 모터 의미 정정·비활성화 helper | 별도8변형/6그룹 검증, 같은누움 건강0·손상1재넘어짐; 공개 미반영 | [출처·수치·코드](../strike/support_control_semantics_round1.md) | 실제 제거/재생성은 solver 이력도 초기화; 전체 기립 채택 보류 | 미확인 |
| A-022 | 2026-10-02 | 지지·보행 인계 원인 분리 | air 접촉 초기실험은 후보 미실행으로 무효·재검증, gain/질량 삭제는 부분변화만; 보류 | 같은 보고의 대조표·해시, `tools/sim/experiments/recovery_control_probe.mjs` | 기존 same-lying/force-ledger 의존, 새 인체 한도 아님 | 미확인 |

결정 이유·실패 조건·실제 배포는 [첫 기록](notes/2026-10-01.md), [다음 기록](notes/2026-10-02.md) 및 그 근거 링크를 읽는다. 이 대장은 일별 보고서를 대신하지 않는다.
| A-023 | 2026-10-02 | 실제 실행을 검증한 발 하중 인계 대조 | 계측 dispatch 결함 수정·11검사 통과, 후보30행·모든 새 보행 후보 기각/보류 | [후보·실패·명령·해시](../strike/support_recovery_load_round2.md) | source gait 모듈 복제+같은 누움+force-ledger 의존; 원본 파일 수정 없음 | 미확인 |

| A-024 | 2026-10-02 | 동일 폭주 직전 분리·전체 모터 토크 상한 | native0 제약 기여/위치오차 cap 결함 확인; bounded 전신·질량 조합 채택 보류 | [소스·관문·명령·수치](../strike/support_motor_limits_round3.md) | 같은 Rapier/누움 checkpoint/계측기 의존; bounded helper의 자유 두 강체 근사를 전신 해결로 이식하지 않음 | 미확인 |
| A-025 | 2026-10-02 | 회복 네 자세의 결합 관절 응답 | 72분기 관문 통과; 방향/크기/접촉 의존, 회복 후보 미채택 | `566bd78` 도구, [소스·수치·명령](../strike/recovery_joint_response_round4.md) | `experiments/recovery_joint_response_probe.mjs`·같은누움 runner·native 재생성 의존. 고정 gain으로 복사하지 않음 | 미확인 |
| A-026 | 2026-10-02 | 몸통 목표 수송·관절별 중력 보상 대조 | 42+48행·6fixture, 18반복 exact. full/yaw·보상 일괄 off 미채택 | `566bd78` 첫 도구, [최종 파일 해시·수치](../strike/whole_body_control_round2.md) | `whole_body_strike_probe`·`force_ledger`·torso 후보 모듈 의존, 충돌 예상 파일 도구/README. 게임 driveSword 직접 치환 권하지 않음 | 미확인 |
| A-027 | 2026-10-02 | 절삭 공통점 반작용·passive 상한·실제 소모 예산 | 연구32fixture/16전투 뒤 공유helper33검사·runtime포함20전투 exact·로컬모바일4조건 통과. 선택형, 일반 legacy | `298cd69`, [결함·통합·수치·해시](../strike/cut_reaction_round1.md) | `combat.afterStep`/STRIKE/native effective inverse inertia 의존. 충돌 예상 combat/main/feature-lab, damage/튕김/전신 해결과 구별 | 미확인 |
