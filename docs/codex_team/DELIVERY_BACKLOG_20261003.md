# 전달 대장 · 2026-10-03

갱신: **2026-10-03 17:27 KST**. 사용자가 요청한 **승인 A4와 선택형 B4의 전달 검증을 완료**했다. C의 철회와 한손 팔 공개 보류는 유지하고 승인된 D 연구의 재개 위치를 기록한다. 연구·사람 체감 수락·일반 물리 기본값 승격은 미완료다. [기계 판독 전달 영수증](delivery_release_20261003.json)은 항목별 승인·소스·원격·웹 범위와 외부 증거의 SHA·크기를 담는다.

## 실제 소스·원격·공개 검증

게임 릴리스는 [9ba4b34](https://github.com/yoonjl-svg/halfsword-codex/commit/9ba4b34ecd7c3a7d97d718774eb86a659c3567e2), tree `458c1664a9b51076addab02e057b939b61bf6077`다. 실제 원자적 nonforce Git push 뒤 원격 `main`과 `codex/hybrid-support`의 소스·tree 일치를 확인했다. 기반 `e5d2f081de320e42634526e27a68804baf754993` 이후52커밋은 `recovered/20261003`에 HEAD `0e950b6f5074e39b94700034a56a942bfefe2cfd` / tree `da7b9dfbd8436ad40f8a6bec3845fcfe0c5a7fa1`로 별도 보존했다. 과거401·인증 지원 대기는 당시 기록이며 현재 원인으로 단정하거나 사용자에게 재연결을 요구하지 않는다.

공통6검사는 소스59df1f6에서144.59초에 PASS했다. 힘 장부11·그립12·절삭33·팔4 fixture와 실제 결투10행/새 실패0 및 외부 build를 확인했고 소스/HEAD가 안정적이었다. 검사 소스와 릴리스9ba4b34의 게임·의존성·runner·sim·fixture 및 비교/오디오 페이지는 같음도 확인했다. [원격 회귀37108533174](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/37108533174)는 API에서 SUCCESS지만 상세 시험 수를 추가로 주장하지 않는다. 복원 직후 Chromium과 겹친180초 결투 제한 실패와 이후 직렬 통과 기록도 보존했다.

[Pages37108497860](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/37108497860) SUCCESS와 인증서 검증을 유지한 공개8파일의 실제 바이트·SHA 일치를 확인했다. 로컬 완성 빌드 폰17조건 PASS다. 공개 폰은 **게임16조건 PASS(실제 CTA12·퇴역 URL3·일반판1) + 계획 단독1조건 PASS로17조건 충족**이다. 원래 통합 실행은 역사 설명을 덧붙인 대장 제목을 옛 정확 제목과 비교하여 실패했고 `pass=false`를 그대로 보존한다. 게임16행은 오류/HTTP/요청/차단0이다. 이후 제목 의미를 정정한 계획 단독검사는3.347초/390×844·844×390·본문14,228자·7H2/핵심6절·정확한 우리 대장 링크·오류0으로 PASS했다. 전체17조건 재실행이 PASS했다고 바꾸어 쓰지 않는다.

공개 오디오 Worker/대체2조건도 drawn·AudioContext running44.1kHz·강약 분기/음소거·새 라벨/이전 기본 라벨 제거·오류0 PASS다. 최초 브라우저 CA 신뢰 오류는 원래 영수증에 남기고 인증서 검증을 끄지 않은 채 신뢰 설정을 정정하여 재검사했다. 사람의 새 청취 수락이나 장시간 전투의 효능까지 증명하는 검사는 아니다.

현재 주소: [일반 게임](https://yoonjl-svg.github.io/halfsword-codex/) · [선택형 비교](https://yoonjl-svg.github.io/halfsword-codex/feature-lab.html) · [휴대폰 실행 계획](https://yoonjl-svg.github.io/halfsword-codex/development-plan.html). **이번 최신 대장·영수증·계획 문구의 후속 커밋/Pages/공개 바이트는 위 게임 릴리스와 별도로 확인한다.**

## A · 승인 항목과 수정4개 전달 완료

| 항목 | 승인·구현 | 실제 전달 범위와 남은 작업 |
|---|---|---|
| A2/B2 단축 베기음 | 사용자가 고른 약 .26초·강 .35초. `7cbac075`, 112 게임J 경계·기본 drawn·찌르기 samsho. [선택 근거](../sound/slash_selected_short.md). | 소스·Pages·공개 JS 및 Worker/대체2조건의 분기/음소거/오디오 상태 PASS. 전달 완료. 다시 선택 승인받지 않는다. |
| 휴대폰 실행 계획 | 사용자가 휴대폰에서 읽을 계획의 공개 전달을 요청했다. 생성기 `406395d`와 최신 원문을 전달. | 공개 HTML exact 바이트와 분리 계획 단독 화면/본문/목차/우리 대장 링크 PASS. 전달 완료. 이 대장의 최신 완료 문구는 후속 문서 배포로 따로 기록한다. |
| 절삭 B 권유 철회 | 최신 부정적 사용자 플레이 평가에 따라 `f18fc7b` 및 전달 수정에서 B 권유와 퇴역 실행을 철회. [회귀 근거](../strike/cut_posture_round2.md). | 공개 버튼 제거·퇴역 URL의 legacy 복귀/철회 안내 PASS. 전달 완료. 실패한 B 재시험·재권유 없음; 일반 절삭 legacy 유지. |
| 일지 발행 오류 수정 | 실패 해결·전달 요청에 따라 `f4f3d97`의 과거 원고 후속 H2 정규화/엄격한 현재 노트 검사를 전달. | 원격32검사·3노트·자체 보관 읽기 및 닫힌10/02 발행·해시/보관 tree 검증 완료. 상대 수신/열람·의미 검토는 수행하지 않았다. |

일지는 [validate37108508130](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/37108508130)와 [publish37108554334](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/37108554334)가 SUCCESS다. [자체10/02 보고](https://github.com/yoonjl-svg/halfsword-codex/blob/dev-exchange/docs/devmeet/2026-10-02.md)는6절, 뒤 무번호 H2 2개만 렌더링에서 H3로 낮췄다. 보고60,141bytes/SHA256 `20023f74757ec6b201d73cc09cb4e21b2fc2d24d1ad222f9e8b101893d281bf4`, manifest39,402bytes/SHA256 `a905fa1221e28ceab9de43282278031b1fca896144ae7a4a1f9b157a250cbedf`, 원문31,309bytes/SHA `120504b6f9bd0ade26303726c6c8ca6a6c4e9b3f3be4c3c09726b578f539d4f2` 보존을 확인했다. 보관 commit `c40af1d27c7a210344a21bb528fd704a9ff5c4e0` / tree `0173e0a8cb0289186c0cf7fc0e6abda9aa5e771e`의 실제 Git blob도 맞다. 마감 소스406395d7은 복원 main의 first-parent 커밋 시각 기준으로 재현됐으며 당시 실패의e5 로컬 보고와 동일 바이트라고 하지 않는다.

역사적 실패37054234612의 `2026-10-02T19:27:41.2934523Z`에는 `Authored note must contain exactly six H2 sections`가 실제 기록됐다. 수신 실행37056177593의 시간창 밖 보류는 버그로 되살려 재실행하지 않았다. 전체 로그·인증 출력은 공개 문서에 옮기지 않는다.

## B · 선택형 비교4개 전달 완료

최신 전달 지시는 검증된 선택형의 전달을 승인한 범위다. 공개 실제 CTA12조건과 로컬 통합/첫 스텝·재시작·저장 복귀 관문을 확인했다. **선택형 공개와 메이저 일반 기본값 승격은 별도 결정**이며 사람 체감·전신 물리의 수락을 선언하지 않는다.

| 선택형 | 소스와 공개 주소 | 완료 범위·남은 수락 |
|---|---|---|
| 다시 설 때의 발 마찰 기록 | `232e772`, [기립 비교](https://yoonjl-svg.github.io/halfsword-codex/feature-lab.html#stance-comparison). | legacy의 오래된 Nf 기록만 수정하는 선택형. 원격/웹·실제 CTA·회복/재시작/일반 복귀 PASS. 부상 기립 전체 해결은 미완료. |
| 휴대폰 수직 입력 | `f18fc7b`, [수직 비교](https://yoonjl-svg.github.io/halfsword-codex/feature-lab.html#mobile-comparison). | 세로1.35배, 일반1·가로/마우스/탭 보존. 원격/웹·실제 터치·옵션 우선순위·저장/복귀 PASS. 최적 배율·엄지 체감 수락은 미완료. |
| 검술 보정 끔·약 | `04831d8`, [보정 비교](https://yoonjl-svg.github.io/halfsword-codex/feature-lab.html#target-correction-comparison). | 플레이어 새 라운드부터 적용, 상대/저장 선호 보존. 원격/웹·첫 스텝·세로 비교 충돌·재시작/재로드/일반 복귀 PASS. 일반 보정 설정 승격 없음. |
| 날 정렬 토크 | 구현 `f029343`, 비교 `65c30a7`, [날 정렬 비교](https://yoonjl-svg.github.io/halfsword-codex/feature-lab.html#edge-comparison). | 기존 목표의 연속 토크만 사용. 원격/웹·한손/양손 첫 스텝·재입력/재시작·저장 복귀 PASS. C1/기억 결합 없음; 날 추종/회전량의 후퇴와 사람 수락은 남는다. |

**한손 팔 활성은 공개 보류**다. `912e0f6`의 구현·`0e950b6`의 보고·헬퍼7검사와 모바일4조건은 보존했지만 연구는 같은 실제 피격 뒤 분기했고 옵션은 생성부터 적용하는 후보였다. 생성부터 실제 전투·다른 한손·제동/발 지지의 수락이 미완료여서 CTA·직접 URL을 보류한다. 양손은 정지 비틀림 후퇴로 제외했다. 공개 퇴역 URL의 일반 복귀만 확인했으며 물리 효능 수락으로 계산하지 않는다. [근거와 한계](../strike/arm_recovery_activation_round1.md).

## C · 철회 유지

발사 문제의 projected 지지판과 사용자 수락 실패한 budgeted 절삭은 재공개·재권유·다른 후보에 자동 결합하지 않는다. 일반 legacy 지지/절삭과 철회 안내를 유지한다. B의 Nf 기록 선택형은 철회된 projected와 다른 후보다. 에너지·운동량 장부 PASS, stand 진입, AI 승률만으로 사람의 자연스러움이나 전체 회복을 수락하지 않는다. 기각된 회복/끝점·양손 활성·C1/기억은 재현 소스와 실패 기록으로 보존한다.

## D · 승인 연구 재개 위치

전달 검증을 마쳤으므로 첫 **60–90분**은 공개 URL 없이 실제 한손 전투 대조를 재개한다. 헤드리스 `newRound(opts.onFighter)` 콜백에서 **fighter 생성 직후·AI/첫 `G.step` 전에 index0에 `armRecoveryModel='independent'`를 직접 설정**한다. 생성 이전 직접 설정으로 설명하지 않는다. 기준/후보의 legacy support·arm·cut 및 실제 AI/일반 전투를 유지하고 첫 getup 전 동등성, 이후 접촉/부상 분기·다른 한손·중단 뒤 제동/발 지지를 구분한다. 반복 후퇴는 같은 상태의 허용 활성/어깨/손목 요구로 분리하고 gain 전수 탐색하지 않는다. 기존 skill_from_start 실행은 budgeted+parked여서 실행하지 않으며 중립 직렬화 계측만 재사용한다.

이후 Q05는 **현재 legacy 접촉·힘 전달 장부 검사**로 진행하며 budgeted 재시험·결합·재권유를 하지 않는다. 몸통→팔→검 전달/제동, 체중 지지·부상 기립, 신체 표현/휴대폰 체감과 [P-01~P-06](../strike/physical_realism_plan.md)의 미완료를 이어가고 [다음48시간 계획](ACTIVE_PLAN.md)을 실제 결과로 갱신한다. 이미 승인된 전달/좁은 연구는 다시 승인받지 않는다. 메이저 일반 기본값 승격은 비교 가능한 구현/근거를 준비한 뒤 별도 사용자 결정이다.

원래 저장소 밖 raw JSON·원래 모바일 raw·custom native engine/API 교정 원자료는 **추가 미수신**이다. 복원 소스·요약·새 일반 npm 엔진 검증과 구별하며 외부 원자료 복원까지 완료했다고 하지 않는다. 상대 신규 수신·열람은00:00–00:20 KST에만 한다. 이 대장은 실제 프로세스/예약 없이 응답 뒤 연구가 계속 실행된다고 주장하지 않는다.
