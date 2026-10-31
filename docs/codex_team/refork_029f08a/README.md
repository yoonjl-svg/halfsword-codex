# 우화 임시 대행을 위한 기준 포크 · 2026-11-01 KST

사용자가 우화의 작업을 잠시 대신하도록 지시하고 `029f08a`를 지정했다. 해당 커밋을 직접 fetch해 **아무 수정 없이** 우리 저장소에 보존했다. 조회 당시 우화 main도 이 SHA와 같았다. 다음 게임 작업은 아래 새 작업 공간에서 시작한다.

- 원본: `yoonjl-svg/halfsword@029f08a43d0a255134c3870242b01c3189e40ae2`
- 트리: `23f7c2a5916c80f41b0d0a21e3cfbb1d2abe361d` · 추적 파일 6,204개 · 변경 0개.
- 자체 원격: [codex/refork-029f08a](https://github.com/yoonjl-svg/halfsword-codex/tree/codex/refork-029f08a). 원격 HEAD도 지정 SHA와 일치함을 fresh ls-remote로 확인했다.
- 실제 작업 공간: `/workspace/halfsword-refork-029f08a`.
- 기존 자체 main `93752ce8a1db80460f010ec2b7deab39f45a4c6e`는 원격 `archive/pre-refork-029f08a`에 보존했다.
- 이전 4열 도감 소스 `ce67557080daa4810632cf2334b64717425a1e0c` / `codex/encyclopedia-20261031`도 보존했다. 최신 게임에 이식하지 않았으며 예전 대기실 파일로 덮어쓰지 않는다.

이번은 작업 기준 확보다. 우화 저장소 쓰기·메시지 발송은 없으며 자체 공개 main의 게임도 교체하지 않았다. 포크 기준과 운영 기록을 분리해 지정 SHA의 트리를 그대로 유지했다. 우리 지침·교환 자동화·이전 검수자료는 기존 자체 main에 남아 있다.

## 최신 기록 확인

지정 트리에는 AGENTS.md가 없다. `docs/director_handoff.md`, `docs/handoff/director_state.md`, `docs/devmeet/2026-10-31.md`, `docs/decisions.md`의 최신 결정을 확인했다. 초기 인계서와 상태표는 오래되었으므로 최신 코드·결정 기록보다 우선하지 않는다. 우화 기록은 우화의 성과로 구분한다.

이전 확인 기준 `91151212` 이후 326파일, 44,607줄 추가·836줄 삭제. 상점, 이동 기력 비용, 자연 바인드, 특수 공격, 대검 팔·손가락 제어가 바뀌었다. 확인한 중요한 최종 결정:

- 상점은 세 상품, 4시간 주기 갱신과 머리 한 개를 쓰는 새로고침.
- 걷기 기준 0.6m, 동방 2 / 독일·이탈리아·이베리아 4 / 일본 6, 후퇴 비용 1.5배. 과거 자체 기력 설정을 재적용하지 않는다.
- 자연 바인드 기본 활성화. AI 밀기 상태와 모르트슐라크 입력 상태의 충돌 수정.
- 여섯 특수 공격의 시간 상한 제거. 정수리 가르기와 겹치기의 빠르기 몫 0.25. 정수리 가르기를 메는 동안 초당 베기 한 번에 해당하는 기력 비용.
- 겹치기는 실제 첫 걸음 물리와 디딤 시점·칼날 위치를 맞추는 최종 변경까지 포함한다.
- 지정 커밋은 대검 자세/팔 제어 작업을 합친 커밋이며, 같은 날 일지 마감 당시의 ‘진행 중’ 표시보다 뒤의 상태다.

전체 326개 변경의 균형·손맛을 완전히 재평가했다는 뜻은 아니다. 다음 요청에 해당하는 최신 모듈과 결정부터 확인한다. 기존 존댓말, 가시적 변화의 실제 스크린샷 보고, 매일 개발일지, 사용자 승인 전 미완성 시안 전달 금지 등은 계속 적용한다.

## 실행과 확인

Node 24.19.0 / npm 11.9.0. 새 작업 공간에서 `npm ci` 후 `npm run build` 성공. PWA `5f77fbedf4eac0eeab9ef851`, 515파일 / 13,022,898바이트. 기존 Vite 큰 묶음 안내와 Rapier 초기화 경고는 존재한다.

| 검사 | 결과 |
|---|---|
| `node tools/sim/fights12.mjs` | 성공 · `ee193a89` |
| `node tools/sim/live_battery.mjs` | 성공 · `e8127a92` |
| `node tools/sim/finish_thrust.mjs 1 --stand` | 성공 · `9630b5d3` |
| `node tools/sim/corr_s0.mjs --limits=off,on --scenes=a,b` | 12/12 IDENTICAL |
| `node tools/sim/weapon_smoke.mjs` | 34/34 OK · FAIL/NaN 0 |
| 최근 관련 기존 검사 8파일 | 84통과 / 실패 0 |
| 컴파일 게임, 844×390 터치 | 공지→첫 화면→대기실→Stage→카드 선택→전투 진행, 오류 0 |

해시는 Rapier 경고 한 줄을 제외한 출력 SHA256 앞 8자리다. 앞의 세 해시는 우화 최신 일지 기준값과 일치한다. 추가 검사는 `guard_arms`, `skill_cmd`, `duplieren_simple`, `natural_bind`, `shop`, `stamina`, `secret_stamina`, `redondo_hold`의 기존 `.test.mjs`를 사용했다.

브라우저 검사는 Chromium/SwiftShader로 기본 흐름과 물리 진행을 확인했다. 실제 휴대폰 성능이나 모든 전투 상황을 검증한 것은 아니다. 기존 브라우저 검사기는 이전 첫 화면 버튼을 기대하므로, 게임 코드는 그대로 두고 임시 검사기에 현재 첫 화면·대기실 경로를 적용했다.

- [전체 결과/정확한 SHA](receipt.json) · [브라우저 재현](browser-smoke.mjs)
- [실제 대기실](lobby.png) · [실제 전투](fight.png)
- 원본 검사 로그는 이 폴더의 대응 `.log` 파일, 작업 중 원본은 `/tmp/refork-029f08a-checks/`.

## 개발일지 복구

시작 검사에서 10/31 미발행을 발견해 이미 완성된 자체 원고를 발행했다. [Actions 41224683375](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/41224683375) 성공, 보고 가지 `fa63e89f6434dc8cf41c3d6ecea9f91e675a1376`, 원고 소스 `93752ce8a1db80460f010ec2b7deab39f45a4c6e`. 날짜·본문·manifest 해시를 fresh HTTPS fetch로 확인했다. [영수증](diary-publication.json).

정시 자동 발행이 아니라 지연 복구다. 이번 포크 작업은 KST 11/01 활동이므로 10/31 발행본을 고치지 않고 11/01 작성 노트에 기록했다.
