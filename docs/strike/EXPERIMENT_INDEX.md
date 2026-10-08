# 실험 색인과 재현 입구

10/09 · [기립 B 일반 승격](getup_adoption_20261009.md)·[거리 발동/연속 준비](opportunity_continuity_20261009.md)·[원자료/명령](opportunity_continuity_20261009.json). 기준356dd6b. 자동 손변위 취소 재현, 가까운 거리 단축/먼 거리 지연, 실패 연습 fixture 보존. 기립 일반·빠른 거리 선택형, 공개 검증 진행 중.

10/09 · [입력 분리·찌르기 거리 준비](opportunity_distance_20261009.md)·[수치/원자료 지도](opportunity_distance_20261009.json), [기립 뒷다리 시간차](getup_lead_20261009.md)·[수치/시각 근거](getup_lead_20261009.json). 입력 일반, 거리/기립 선택형. 거리별 실패와 기립 잔여 미끄럼 보존. [실제 전달](opportunity_distance_release.json).

- 2026-10-08: [급소 찌르기 목·머리 영역](opportunity_head_region_20261008.md) — v2 목 우선과 v3 영역 선택의 실제 찌르기 비교; 일반 승격 별도.

- 2026-10-08 · [급소 실제 경로 보조 v2](opportunity_precision_20261008.md) · 기준451a541. 대표6장면×v1/v2와에스톡추가2실행; 실제목베기/목찌르기/AI머리둔타확인, AI레이피어·에스톡찌르기미달. [전달·해시](opportunity_precision_release.json).

- 2026-10-08 · [라이트세이버 B 사용자 수용·일반 적용](lightsaber_adoption_20261008.md) · 기준738ef0f. 기존4실행 비교를 재사용하고 진입/배포를 검사한다. 급소 정밀 명중은 미완료. [실제 전달](lightsaber_adoption_release.json).

- 2026-10-08 · [내려찍기·모르겐 일반 적용, 급소/라이트v2 재검증](followup_release_20261008.md) · [소스·명령·해시](followup_checks_20261008.json) · 기준2af1c5f. 급소정밀명중미달·라이트후속공격감소로 두 비교는 선택형 유지. [실제 전달](followup_release_20261008.json).

- 2026-10-08 · [가지·참치·69cm 철퇴](weapon_compact_20261008.md) · [해시/원자료](weapon_compact_20261008.json) · 기준31de577. 같은입력 큰 출렁임 부담 감소/미세 안정 혼합, 가지사거리 조정, native 접촉·파손 통과. [실제 공개](weapon_compact_release.json).

- [10/08 리볼버 상반신 조준·75J](revolver_aim_20261008.md): 사용자 요청 반영. 기준 `a34eff6b5b84ef1611f73db639135da64ae6eb09`, 실제 공개는 [전달 영수증](revolver_aim_release.json).

4단계 경기 연결·파손 충돌 ·10/08: [폰 진행](phase4_progression_20261008.md)·[재현 해시](phase4_progression_20261008.json)·[파손 native 검사](broken_collider_20261008.md)·[전달](phase4_progression_release.json). 종료 fixture3회로 화면/실제 다음 상대를 검증한다. 실제 무기 파손·부활 접촉 대조와 자연 전투 빈도는 구분한다.

4단계 첫 공방 ·10/07: [판정](phase4_pacing_20261007.md)·[해시/제어 회귀](phase4_pacing_20261007.json)·[대표3상대 실제 게임 비교](phase4_opening_20261007.md)·[전달](phase4_pacing_release.json). 브란 초기화 순서와 공격 목표 범위 불일치 수정. 정상51궤적 동일, 실제 전투 빈도·재미 주장은 없음.

4단계 첫 품질 개선 ·10/07: [판정](phase4_quality_20261007.md)·[소유권/해시](phase4_quality_20261007.json)·[3판 반복 비교](phase4_repeat_20261007.md)·[가독성 미채택 이유](phase4_readability_20261007.md)·[일반 진입](phase4_entry_20261007.md)·[전달](phase4_quality_release.json). 재시작 재질 해제 누락 수정, 물리 수치 변경0. GPU bytes·실물 폰 FPS 개선량은 미측정.

3단계3회차 ·10/07: [대표 통합 최종 판정](phase3_round3_20261007.md)·[수치/해시/재사용 감사](phase3_round3_20261007.json)·[실제 공개 부상 뒤 입력/재시작](phase3_closure_mobile_20261007.md)·[전달](phase3_round3_release.json). 현재 일반 회복→수동 타격과 부상 뒤 조작/초기화 관문 완료, 게임 변경0. 갑옷B선택형·보조팔/v2유보·전체물리 한계는 유지.

3단계2회차 ·10/07: [통합 판정](phase3_round2_20261007.md)·[절삭](phase3_cut_link_20261007.md)·[받아내기](phase3_parry_20261007.md)·[공개 상처 표시](phase3_damage_visual_20261007.md)·[전달](phase3_round2_release.json). 대표 연결 통과/게임 변경0. 실제 피해·콜백·새 상처 수를 분리하고 기존 절단 근거를 재사용한다. 자연 절단·전체 물리 완성 주장은 없다.

3단계1회차 ·10/07: [갑옷 마무리의 현재 일반판 비교](phase3_round1_20261007.md)·[경계 수치/해시](phase3_round1_20261007.json)·[실제 접촉](phase3_finish_contact_20261007.md)·[공개/모바일](phase3_round1_release.json). 일반판 legacy, 과거 armorCausal 유지; 새 armorGuard만 선택형. 자연 전투 미노출과 통제 down 접촉을 구분한다.

질문 진단 ·10/07: [한 팔 부상과 한손/양손 차이](arm_function_question_20261007.md)·[6행 수치/해시](arm_function_question_20261007.json). 보조손 파지 상실은 실제지만 일괄 속도/피해 저하는 보장되지 않는다. 통제 팔 기능 검사이며 게임 변경 없음.

최신 유보 검증: [재베기 실제 절삭](recut_power_20261007.md)·[수치/해시](recut_power_20261007.json), [잔여 회전](spin_followup_20261007.md)·[수치/해시](spin_followup_20261007.json). 수동 베기 후 관성 타격과 접촉 순간 입력을 구분하고, 기존 복귀가 안정되는 것을 확인했다. 신체 접촉 후 속도 제한 후보는 미채택. [기록/폰 계획 전달](deferred_followup_release.json).

최신 승인 활성화: [팔다리 절단 일반 적용](limb_general_status_20261007.md)·[검사/전달 영수증](limb_default_release.json). 기존 절단 조건을 유지하고 현재 일반 조합의 후속 제어와 공개 모바일 전달을 확인한다.

최신: [무기명 제한 제거·기능별 공통 적용](common_defaults_20261007.md), [전달 영수증](common_defaults_release.json), [사지 절단 일반판 상태 조사](limb_general_status_20261007.md). 기존 물리식을 유지하고 확대 연결의 회귀만 검사한다.

최신 일반 채택: [승인·무기 범위·후속 유보](general_adoption_20261007.md), [전달 영수증](general_adoption_release.json). 새 절삭 위력/잔여 회전 연구 실행은0회다.

- 2026-10-06 · 세 우선 과제: [재베기 목표 속도 제한](recut_closure_20261006.md) 선택형 / [부상 후 제어·재활성 이력 오류](injury_followup_20261006.md) 기능 검사·수정 / [두 무기 시작 급회전](spin_closure_20261006.md) 힘점 기본 교정·새 그립 공식 미공개 / [실제 회복 후 수동 생존 타격](recovery_contact_closure_20261006.md) 통합 장면 확보. [공개·모바일 전달](phase2_closure_release.json). 각각의 JSON이 동결 소스·실행 명령·원자료 SHA·한계의 기준이다.

- 2026-10-06 · [5회차 최종 선별](phase2_round5_20261006.md) · [회복 통합 원자료 지도](round5_recovery_20261006.json). 생성부터4실행·9,102step, B 생존169충격/상한72회. 회복 뒤 손 재베기 미노출로 새 통합 공개 보류. 준비판 코드/로컬5흐름 보존, 기존 공개 게임 유지. [기록 전달](phase2_round5_release.json).

- 2026-10-06 · [4회차 통합 판정](phase2_round4_20261006.md) · [기존 후보 결합](round4_integrated_20261006.md), [P4 실제 첫 베기 접촉](p4_round4_20261006.md). 실제 노출/좁은 관문과 통합판 공개 보류를 구분. 별도 사용자 요청 [중력3수준 임시판](gravity_v2_20261006.md)·[전달](gravity_v2_release.json).

- 2026-10-05 · [2·3회차 통합 판정](phase2_round23_20261005.md) · P1/P3 [올림·버팀](raise_hold_20261005.md), P2 [하중 인계](support_handover_v2_20261005.md)·[디딤 시간 후보 보류](catch_clock_20261005.md), P6 [현재 v2 주팔 부분손상](injury_v2_gate_20261005.md). 완료 관찰·미노출·미완료 목표 구분, 게임 변경0.

- 2026-10-05 · [회복 B 속도·발 디딤·중력 간단 조사](recovery_speed_20261005.md) · [수치·재현·SHA](recovery_speed_20261005.json) · 건강/동일 부상 격리에서 상시 감속 미관측, 중력20% 단일 진단 미채택. 사용자 옆넘어짐·실물 폰 체감은 미확정. 게임 변경0.

- 2026-10-05 · [P1/P3 기존 v2 중력 일 재사용](v2_weight_work_20261005.md) · [수치·SHA·명령](v2_weight_work_20261005.json) · 기존2원자료/6행 파생, 새 물리0회. 내려베기 중력 기여와 부분 토크 일을 분리하고 올림·버팀의 다음4행만 남김.

- 2026-10-05 · [P4 명령한 베기 면](p4_command_plane_20261005.md) · [수치·재현](p4_command_plane_20261005.json) · 현재 v2에서 입력 의도와 실제 날 정렬의 교환관계를 분리. 무접촉 개선과 청강검 급변 반례를 함께 보존하며 공개 판정은 원보고를 따른다.

- 2026-10-05 · [P5 연속 접촉·박힘 경계](p5_extended_contact_20261005.md) · [수치·재현](p5_extended_contact_20261005.json) · 기존 전투30초 연장과 실제 박힘 직전의 단일 개입. 생존/사망 뒤 접촉, 생성부터 선택/늦은 활성화를 구분하며 일반 승격은 보류.

- 2026-10-05 · [P2/P6 회복 경계](recovery_next_contract_20261005.md) · [수치·재현](recovery_next_contract_20261005.json) · 과거 실패를 반복하지 않고 P5의 현재 v2 실제 부상 장면을 재사용. 기존 발 지지 기록 초기화의 작동과 재입력·인간 동작의 수락을 구분.

- 2026-10-05 · [v2 기반 재베기 경계](p4_recut_v2_20261005.md) · [재현/해시](p4_recut_v2_20261005.json) · 기준 e0ed9e5, 새 목표2안 기각·최신 속도 진단도 경계 잔존. 실제5실행/2,109스텝, 게임 제어 변경 없음.

- 2026-10-05 · [절삭 중심선 반작용](p5_centerline_contact_20261005.md) · [재현/해시](p5_centerline_contact_20261005.json) · 기준 e0ed9e5, 실제8실행/8,072스텝은 두 장면의 관찰/대조 포함. 첫 검 반동·피해 보존, 운동량 불일치 교정·1초 선별. 2종 선택형이며 [실제 전달](phase2_v2_release.json)과 에너지/장시간 미완료를 구분.

- 2026-10-05 · [베기 속도·힘 보존 검사](swordsmanship_power_20261005.md) · [실행/수치/재현 지도](swordsmanship_power_20261005.json) · 빠른 베기 목표 보존의 작은 계수 조정, 일반 근접12종 적용 결정·회전2종 보류. 레이피어 후속 감속/고무닭 순간 급등은 사용자 판정으로 구분. [실제 전달](swordsmanship_power_release.json).

- 2026-10-05 · [공통 검술 보정](swordsmanship_20261005.md) · [재현 지도](swordsmanship_20261005.json) · 이전 단일 자세/몸/복귀 정책의 다종 무기 통합 후보. 초기 입력·홈 복귀 결함 수정, 모노호시자오/라이트세이버 회전 잔존으로 새 선택 보류. 일반 승격 미수락.

- 2026-10-05 · [검술 보정 v2 근거·설계](sword_assist_v2_design_20261005.md) · [짧은 결과](sword_assist_v2_20261005.md) · [소스/명령/원자료 지도](sword_assist_v2_20261005.json) · 첫 찌르기 종료 후보 기각·회복 인계 수정, 청강검 선택형. 복귀 목적과 손 추적 반례를 함께 보존, 일반 승격 미수락.

- 2026-10-05 · [몸 선행 협조 비교 회차](motion_force_trial_20261005.md) · 골반 뒤 가슴 지연 첫4회는 목적 후퇴로 기각. 현재 손 요청과 팔 필터 차의 작은 몸통 선행을 청강검 선택형으로 [공개 전달](motion_force_release.json). 실제 접촉/회귀/모바일 확인·최대 힘/일반 승격 미수락.

- 2026-10-05 · [연속 동작의 힘 전달 재설계](motion_force_design_20261005.md) · 기준 `e90193ac030ba291ceb5418c7029551cea292f59`. 설계/정적 검토만, 새 물리 실행·공개판 변경 없음. 첫 후보는 좌우·사선 협조 시점 한 경로.

- 2026-10-05 · [동작 보정·통합 시험](motion_assist_20261005.md) · [수치/소스](motion_assist_20261005.json) · [전달](motion_assist_release.json). 약15% 입력 깊이/몸 협조, 큰 베기 보존, 초기 wall fixture 제외와 미채택 초안을 구분.


2026-10-04 KST. 결론은 각 원보고가 기준이며 이 색인은 경로·재현 명령만 연결한다. [짧은 일지 계약](EXPERIMENT_LOGGING.md), [전체 보고 폴더](https://github.com/yoonjl-svg/halfsword-codex/tree/main/docs/strike), [전체 실험 도구](https://github.com/yoonjl-svg/halfsword-codex/tree/main/tools/sim/experiments).

| 최근 회차 | 판정 / 소스 | 재사용 입구 |
|---|---|---|
| [P4/P5/P6 병렬 회차](p456_batch_20261005.md) | P4 목표 점프 확인·두 기하 수정 기각, P5 선택형/P6 입력 결함 수정·전체 목표 미완료 | native prefix1211 exact·P5 경계61·[소스/명령/원자료](p456_batch_20261005.json)·[전달](p456_batch_release.json) |
| [실제 절상 뒤 입력·공개 B 후속](injured_input_20261005.md) | 두 B 잠정 선호·재입력 수락/회전 잔존, game 변경0·일반 승격 보류 | 실제 prefix1536 exact·현재 공개20초 후속·[수치/명령/해시](injured_input_20261005.json) |
| [피격 뒤 한손 재현 선별](recovery_selection_20261005.md) | 과거 manual 팔 절상 현재 비재현·actual legacy 주팔 절상 경계 선정, game 변경0 | 고정2문맥·현재4행/관찰 동등성2행·[수치/명령/해시](recovery_selection_20261005.json) |
| [청강검 찌르기 날 방향](thrust_plane_20261005.md) | 접촉 전 비틀림 감소·큰 베기 exact, 후속 접촉 추종 후퇴·청강검 선택형 | 3입력 경로/production 동등성·[수치/명령/해시](thrust_plane_20261005.json)·[전달](thrust_plane_release.json) |
| [청강검 접촉 형상](contact_geometry_20261004.md) | 무접촉 베기 exact·접촉 회전 감소, 손 추종 후퇴/앞선 탭 급회전 남음·청강검 플레이어 선택형 | 같은 첫 충돌/생성부터 일반 전투·[수치/명령/해시](contact_geometry_20261004.json)·[전달](contact_geometry_release.json) |
| [손목 요청의 그립 이전](native_grip_intent_20261004.md) | 큰 베기 날 비틀림 후퇴·공개 기각; 반작용 경로는 진단만 | 실제 최종3호출·free/같은 첫 충돌·6궤적(반복/prefix 포함)·[수치/명령/해시](native_grip_intent_20261004.json) |
| [그립 힘·속도 계약](native_grip_wrench_20261004.md) | 모터 좌표/힘 예산 확인·연속 속도 유지판 공개 기각 | source/operator9·생성부터 큰 베기/실제 전투4궤적·[수치/명령/해시](native_grip_wrench_20261004.json) |
| [청강검 충돌 급회전](qinggang_contact_20261004.md) | 접촉 원인 확인·native 첫 회전 감소, 후속 비틀림/세계 힘 계약 미완료·공개 보류 | 동일965 prefix·7궤적(실패/관찰/확장 포함)·[수치/명령/해시](qinggang_contact_20261004.json) |
| [찌르기 날 흔들림](onehand_thrust_20261004.md) | 세이버 선택형·청강검 접촉 급회전 보류, 일반 승격 없음 | 20실행/16조건·접촉 전 prefix exact·[수치/명령/해시](onehand_thrust_20261004.json)·[전달](onehand_thrust_release.json) |
| [한손 B 멈춤·반전](onehand_stop_20261004.md) | 명령 연결 조작 이득 미확정·native 마지막 substep은 cap 아래, 공개 보류·game 변경0 | 입력24실행/12조건·native6·관찰/격리 exact·[수치/명령/해시](onehand_stop_20261004.json) |
| [전투 급회전 분리](axial_combat_20261004.md) | 관절/횡토크 운반 민감도, 예측 힘점 악화·기각; game 변경0 | 실제 observer2 exact·같은 prefix·native fork/dt/실패 경계·[수치/명령](axial_combat_20261004.json) |
| [native 팔꿈치 실제 전투](native_elbow_combat_20261004.md) | scalar 한도 측정6 PASS·손 오차 증가/공개 보류 | 관절 보존·actual2AI·player 부상0·분기/840 dispatch·[수치/명령](native_elbow_combat_20261004.json) |
| [준비 자세·그립 교정](ready_grip_20261004.md) | B 시작 교정·새 손/소매 철회, 깊은 접기 떨림 기각 | native27·손3쌍·명목 유한자루5·첫 입력6·[재현/수치](ready_grip_20261004.json)·[전달](ready_grip_release.json) |
| [첫 자세 근거 확인](first_guard_review_20261004.md) | 확장 가드 실재·공통 시작 미검증, 게임 변경 없음 | 원전 해당 문단 직접 열람·native 좁은관찰3회·기존trace3/3 exact·[수치/재현](first_guard_review_20261004.json) |
| [쥔 손 엄지 정정](hand_opposition_20261004.md) | 이전 방향 검증 누락 정정, 일반 표시만 | 손3쌍·5무기 양손 양측+손바닥 화면·[원자료](hand_opposition_20261004.json)·[전달](hand_opposition_release.json) |
| [첫 자세·엄지 손](initial_pose_and_hands_20261004.md) | manual 시작 수평·일반 외형, 양손2종 시작 진동 남음 | native27 전/후·손3쌍·화면16·[수치/원자료](initial_pose_and_hands_20261004.json)·[전달](initial_pose_and_hands_release.json) |
| [검 거두기 예측20실행](wrist_braking_round1.md) | 공개 보류, 방향오차 후퇴. `63be055002eb617bb2d7283207b78ee855d768e9` | 아래 명령, wrist_braking_probe / sword_drag_duel_probe, [수치/해시](wrist_braking_round1.json) |
| [관성56실행](inertia_followthrough_round1.md) | 작은/혼합 효과·공개 보류. 6소스/원자료 구분 | 아래 소스별 명령, [수치/해시](inertia_followthrough_round1.json) |
| [회복 경로8실행](arm_recovery_path_round1.md) | 원인 분리, 공개 미수락. `601dec3`/`62dd47d` | 원보고의 재현3명령·raw command·[수치](arm_recovery_path_round1.json) |
| [목표/감쇠6실행](hold_response_round1.md) | 측정 유효/기각. `ac1cbcd`/`58fc62f` | 원보고의 재현3명령·raw command·[수치](hold_response_round1.json) |
| [생성부터 한손 전투10실행](arm_recovery_from_spawn_round1.md) | 공개 보류, 후속 같은 상태의 참조. `d351c53` | raw reference / [수치](arm_recovery_from_spawn_round1.json) |
| [세로 터치 기본 반영](mobile_vertical_default_20261003.md) | 사용자 선택 전달 완료. `41bbe61` | 입력51검사·[실제 배포 영수증](mobile_vertical_default_release.json); 물리 실험과 구분 |
| [한손 팔 고정 선택형](onehand_manual_round1.md) | swivel2종 기각, 수동 목표 공개 비교 전달. core `458195d` | 물리32(관찰반복6 포함)·[명령/해시 지도](onehand_manual_round1.json)·[전달 영수증](onehand_manual_release.json); 일반 승격 보류 |

## 이번 감사의 범위

[감사 수치/원자료 지도](experiment_log_audit_20261004.json): 기존strike MD85개/JSON78개와 실험 도구78개를 목록으로 확인했다. 도구76개는 직접 보고 연결, derive_wrist_response는4 probe의 간접 helper, wrist_braking_probe는 이 색인/원보고 보충으로 연결했다. 같은 이름의MD가 없는25JSON도 다른 문서에 연결돼 있어 누락으로 세지 않았다. 이 목록 검사는 모든 옛 실험의 완전 재현 보장이 아니다.

최근4회차 raw12개와 생성부터 reference1개 **13개/620,188,255bytes**의 실제 접근·크기·SHA가 일치했고 보존 소스 객체가 존재한다. 감사 JSON의 `currentRawVerification.files`가 현재 보존 경로·bytes·SHA·full source의 단일 지도다. 외부 자료는 이식한 환경에서 경로를 매핑하고 해당SHA를 확인해야 한다. 현재checkout만으로 외부raw/연구엔진까지 자동 제공된다고 주장하지 않는다. 과거943자료/엔진6/빌드근거34/보충118은 기존 복원 영수증과 목록을 이용했고 전체 해시·실험을 반복하지 않았다.

## 고정 소스로 재현할 때

현재HEAD에서 옛 숫자를 재현했다고 주장하지 않는다. 원보고의 full SHA로 **새 detached worktree**를 만들고 npm ci 후 해당 명령을 쓴다. 기록된 패치/엔진/입력/reference가 있으면 같은 해시로 준비한다. 출력은 기존 파일을 덮어쓰지 않는 새 절대경로다. 아래 명령은 원자료 protocol·고정 소스의 허용 옵션으로 **재구성했으며 당시 argv 기록이 아니다**. 명령 보완을 위해 물리실행을 반복하지 않았다.

검 거두기의 두 raw는 모두 `63be055002eb617bb2d7283207b78ee855d768e9`다.

```sh
git worktree add --detach /tmp/halfsword-wrist-replay-NEW 63be055002eb617bb2d7283207b78ee855d768e9
cd /tmp/halfsword-wrist-replay-NEW
npm ci
mkdir -p /workspace/halfsword-handoff/research-wrist-braking-20261003
node tools/sim/experiments/wrist_braking_probe.mjs --weapons=sabre,zweihander --endings=hold,reverse --seed=7 --response=on --out=/workspace/halfsword-handoff/research-wrist-braking-20261003/NEW-controlled.json
node tools/sim/experiments/sword_drag_duel_probe.mjs --trial=available --weapons=sabre,zweihander --seeds=7,19 --response=on --out=/tmp/NEW-wrist-duel.json
```

당시 wrist_braking_probe는 `/workspace/halfsword-handoff/research-wrist-braking-20261003/` 아래 새 출력만 허용한다. 이 경로를 만들 권한이 없는 환경에서는 그대로 실행할 수 없다. 경로 guard를 이식한 경우 도구SHA 변경을 기록하고 역사원본의 byte-exact 재현으로 쓰지 않는다. 현재 공개URL의 wristBraking=available은 보류 상태라 켠 비교를 재현하지 않는다. 켠 화면 검사는 당시 `cd0eabc` 빌드/영상이 별도 근거다.

관성 원자료는 각 행의SHA를 별도 worktree에 고정한 뒤 명령을 실행한다. 초기 두 소스는out만, dc019소스는out/trial만 허용하므로 최신옵션을 과거소스에 덧붙이지 않는다.

| 원자료 / full source | 재구성 명령 |
|---|---|
| screen-01 / `1aa5e53b4c1040249da5b3a6be88d3d7c4ef906a` | `node tools/sim/experiments/sword_drag_probe.mjs --out=/tmp/NEW-screen.json` |
| duel-01 / `7208f9fe07cc300c4b7d196979bfe2aee25885f7` | `node tools/sim/experiments/sword_drag_duel_probe.mjs --out=/tmp/NEW-duel.json` |
| brake-screen-01 / `dc0198068385cf082d383a917bc86ef6d0d24e42` | `node tools/sim/experiments/sword_drag_probe.mjs --trial=brake --out=/tmp/NEW-brake-screen.json` |
| brake-duel-01 / `dc0198068385cf082d383a917bc86ef6d0d24e42` | `node tools/sim/experiments/sword_drag_duel_probe.mjs --trial=brake --out=/tmp/NEW-brake-duel.json` |
| brake-activation-01 / `e8bcec461b052f6d044ddb5348084aa3d2c2b2bb` | `node tools/sim/experiments/sword_drag_probe.mjs --trial=brake --weapons=zweihander --endings=reverse --response=on --out=/tmp/NEW-brake-activation.json` |
| brake-combat-activation-01 / `99c2b42738db5772f34061fa8a772ee40c4b3fb4` | `node tools/sim/experiments/sword_drag_duel_probe.mjs --trial=brake --weapons=sabre --seeds=19 --response=on --out=/tmp/NEW-brake-combat-activation.json` |

원자료 지도에서 관성root는 `research-sword-drag-20261003`, 경로root는 `research-arm-path-20261003`, 응답root는 `research-hold-response-20261003`, 공통reference는 `research-from-spawn/run-01.json`이다. 보존root는 현재 `/workspace/halfsword-handoff/`이며 13파일의 모든정확해시는 감사JSON과 기존 원보고JSON을 함께 확인한다. 파일명만 같은 다른 파일을 쓰지 않는다.

- 2026-10-04 [양손 파지 시작 폭주](startup_grip_20261004.md): 축 위 공통힘점 선택형. 시작 안정화/기존 default27 exact·보존 fixture 확인, 전투 급회전은 남아 일반 승격 보류. [수치](startup_grip_20261004.json)/[전달](startup_grip_release.json).
