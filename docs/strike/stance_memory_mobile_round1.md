# 서기 진입 Nf 모바일 옵션 확인 · 1차

2026-10-02. 로컬 Vite `127.0.0.1:4201`, source HEAD `232e772fd5e4873fe0410d184832a36d3add1cac`에서 브라우저 확인 4/4행이 통과했다. [재생성 가능한 지표와 해시](stance_memory_mobile_round1_metrics.json), [raw 브라우저 JSON](/workspace/halfsword-hybrid-evidence/q07-stance-memory-browser-232e772-run1/stance-memory-trial-q07-stance-memory-232e772-run1.json)과 18개 캡처는 `/workspace/halfsword-hybrid-evidence/q07-stance-memory-browser-232e772-run1/`에 있다.

이 확인은 feature-lab 링크가 선택값을 실제 게임 URL에 전달하고, 서기 재진입 때 런타임이 그 값에 따라 Nf를 처리하는지를 다룬다. longsword 대 longsword, paired grip, legacy support, `assist=0.1`, catch on/1, 네 조합은 portrait/landscape × legacy/fresh다. arm/cut/physics/limb trial flag는 전달하지 않았다.

각 행에서 실제 A/B 링크를 눌러 게임을 시작하고 390×844 및 844×390 화면의 가로 overflow와 세로 화면 회전 안내를 확인했다. 캔버스에 touch drag/release/retouch를 보냈고 simTime 진행을 확인했다. 첫 stand와 양의 Nf를 확인한 뒤 AI를 멈추고, 입력을 분리한 상태에서 플레이어에 `knockDown(true)`를 한 번 호출했다. 일반 RAF와 실제 게임 물리 갱신으로 down→getup→stand를 거친 뒤 실제 `Gait.enter` 직전/직후 Nf와 양쪽 `plantAt` 직전값을 읽었다. 이후 pause/restart에서 새 Combat 및 두 Fighter 객체, 같은 브라우저 context의 기본 URL과 잘못 쓴 `stanceTrial=FRESH`의 legacy 복귀, localStorage에 옵션 비지속을 확인했다.

| 화면 방향 · 옵션 | 재진입 직전 Nf F/B (N) | 실제 `Gait.enter` 직후 Nf F/B (N) | 이후 실제 지원 갱신의 Nf F/B (N) | RAF finite 표본 | gap 표본 | 최대 gap (mm) |
|---|---:|---:|---:|---:|---:|---:|
| portrait · legacy | 620.385 / 186.049 | 620.385 / 186.049 | 311.800 / 183.673 | 89 | 2,492 | 1.179 |
| portrait · fresh | 630.298 / 188.206 | 0 / 0 | 28.136 / 119.772 | 90 | 2,520 | 1.207 |
| landscape · legacy | 600.142 / 194.649 | 600.142 / 194.649 | 379.371 / 277.529 | 88 | 2,464 | 1.339 |
| landscape · fresh | 582.655 / 183.257 | 0 / 0 | 41.418 / 0 | 85 | 2,380 | 1.267 |

양 fresh 행 모두 `plantAt`의 F/B 진입 전에 Nf가 0이었고, 이후 실제 물리/지지 갱신으로 양수 Nf가 관찰됐다. landscape의 후속 B Nf는 표본 시점에 0이었지만 F는 양수였다. legacy 두 행은 기존 양의 Nf를 보존했고 양쪽 plant 진입도 그 기록을 읽었다. 이 표는 제어 성능이나 기립 품질 비교가 아니라 옵션 및 수명주기 처리가 실제 런타임에서 갈리는지 확인한 값이다.

전체 렌더 프레임 표본 352회에서 nonfinite는 0회였다. 유효 joint-gap 표본 9,856개의 최대는 1.339mm였다. 표본 코드는 `requestAnimationFrame`에서 simTime이 증가한 렌더 프레임마다 한 번 읽었다. 따라서 화면 갱신 사이에 실행된 모든 physics step을 검사했다고 볼 수 없다. 네 행 모두 확인된 화면에서 가로 overflow가 없었고, portrait 전투 화면은 회전 안내가 보였으며 landscape 전투 화면에서는 숨겨졌다. console/page, HTTP, request 오류는 각각 0건이었다.

이 검사는 Chromium/SwiftShader 기반 로컬 모바일 에뮬레이션이다. 실제 휴대폰, 공개 배포, 프레임 성능, 자연스러운 사람 기립은 확인하지 않았다. AI를 멈춘 뒤 synthetic knockdown을 사용했으므로 자연 발생 전투 낙상이나 상처 후 기립을 재현한 증거가 아니다. force, clamp, 힘 계수는 시험 중 변경하지 않았다.

Raw browser JSON SHA-256은 `1be6832753941e72b12bc335e27c9c6675ea01ec16528c642058e4bb231a6d06` (61,250 bytes)다. 실행 전후 HEAD는 같았고, `main.js`, `fighter.js`, `gait.js`, `stance_trial.js`, `feature-lab.html`, 검사 모듈의 SHA-256도 모두 일치했다. 실행 명령, 파일별 해시와 네 행의 자세한 관찰값은 metrics JSON에 있다.

```sh
HALFSWORD_EVIDENCE_TAG=q07-stance-memory-232e772-run1 HALFSWORD_EVIDENCE_DIR=/workspace/halfsword-hybrid-evidence/q07-stance-memory-browser-232e772-run1 node tools/browser/stance_memory_trial.mjs
```
