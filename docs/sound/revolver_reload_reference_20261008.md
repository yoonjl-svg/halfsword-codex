# 실제 리볼버 녹음으로 장전음 교체 · 2026-10-08 KST

기준 `54119dda23f1dd56c5066f75c3388e71a3a0cb02`. 사용자가 기존 합성 장전음을 거부하고 실제 참고 소리를 요청했다. 기본 장전음에 **Ruger GP100 .357 Magnum 조작 녹음**을 편집해 사용한다. 총성 +15%, 여섯 발·9초 장전 스케줄은 그대로다. 실제 게임 스케줄·공개 전달 판정은 통합 담당의 별도 결과를 따른다.

## 출처와 편집

[AugustSandberg, “Revolver Reload”, Freesound #508744](https://freesound.org/people/AugustSandberg/sounds/508744/)의 공개 페이지와 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)을 확인했다. 저자는 자신의 Ruger GP100을 실내에서 Sony PCM M-10으로 녹음했다고 설명한다. 게임/영화에서 추출한 음원이나 장난감 녹음을 사용하지 않았다. 로그인해야 받는 원본 WAV 대신 페이지가 공개 제공하는 [HQ MP3](https://cdn.freesound.org/previews/508/508744_1934171-hq.mp3)를 사용했다. 원본 설명은 96 kHz/24-bit이며 실제 내려받은 미리보기는 48 kHz MP3다.

원본에는 dryfire와 reload가 함께 있다. 파형의 짧은 조작 구간을 골라 열기·삽입 6종·닫기에 배치했다. **각 구간의 행동명은 게임 편집상의 배정**이며 저자가 시각별 행동을 주석으로 인증한 것은 아니다. 소리를 사람이 듣고 수락했다고 주장하지 않는다. 후보 중 LuannWepener #326117은 비상업 제한, Dredile #177863은 소품, ajoyce86 #240698은 airsoft, smill.and.welson #698483은 외부 영상 재업로드여서 채택하지 않았다.

| 게임 용도 | 미리보기 원본 시각(초) | 출력 길이(초) |
|---|---|---:|
| 열기 | 4.88–5.18 + 5.83–6.40 | 0.87 |
| 삽입 1 | 8.85–9.28 | 0.43 |
| 삽입 2 | 10.69–11.02 | 0.33 |
| 삽입 3 | 12.55–12.92 | 0.37 |
| 삽입 4 | 14.28–14.70 | 0.42 |
| 삽입 5 | 15.91–16.48 | 0.57 |
| 삽입 6 | 17.99–18.29 | 0.30 |
| 닫기 | 19.22–19.56 | 0.34 |

모노 변환, 90 Hz high-pass/9.5 kHz low-pass, 경계 페이드, peak 0.78 정규화만 적용했다. 음정 변경이나 합성음을 녹음에 섞지 않았다. PCM WAV 8개 총 348,832 bytes. 라이선스·원본 SHA-256·출력별 편집 수치와 해시는 [자산 설명](../../public/sfx/revolver/README.md), [자산 provenance](../../public/sfx/revolver/provenance.json), [검사 JSON](revolver_reload_reference_20261008.json)에 남겼다. 재생 시 외부 사이트에 연결하지 않고 게임에 포함된 파일을 받는다.

## 연결과 실제 검사

`prepareRevolverReload(snd)`는 첫 총성 시점에 파일을 미리 읽는다. `playRevolverReload(snd, pos, kind, roundNumber)`는 기존 tick의 이벤트 하나만 재생한다. 삽입 번호 1–6을 명시해 두 검객이 하나의 Sound를 공유해도 선택 순서가 섞이지 않는다. Sound.event/layer를 사용해 전체 음량·mute·공간 버스·소스 수명 관리를 따른다. 비동기 다운로드가 끝난 뒤 늦게 소리를 재생하거나 장전 타이머를 새로 만들지 않는다.

파일이 아직 준비되지 않았거나 실패/샘플 비활성 상태면 짧은 광대역 접촉 합성음을 대체 사용한다. 이 대체음은 실제 녹음이 아니다. 이전의 좁은 Q=6 금속 공명음을 사용하지 않으며 자체 seed만 쓴다. 실패한 다운로드는 문맥별로 저장되어 같은 AudioContext에서 자동 재시도하지 않는다. gun.js 래퍼는 기존 전투 난수 순서를 위해 7 + 6×2 + 2회의 Math.random 호출을 보존한다.

실행: `node tools/audio/revolver_reload_reference_20261008.mjs /tmp/revolver-reference-integrated-20261008` (Vite :4160).

- 실제 Chromium OfflineAudioContext 48 kHz에서 녹음 경로와 대체 경로 각각 10초를 렌더링했다. 녹음 경로는 통합된 gun.js 래퍼를 호출했다.
- 파일 8개 HTTP 200/decode 성공. 두 경로 모두 열기 1 + 삽입 6 + 닫기 1, 각 이벤트 소스 1개·비영 RMS·유한 PCM·1초 미만 수명을 확인했다.
- 출력 peak 녹음 0.55243 / 대체 0.35588: 이 단독 렌더에서 clipping 없음. 녹음 경로 전역 난수 21회, 대체 모듈 경로 0회.
- mute 상태 새 이벤트 없음, 종료된 목소리 정리, 다른 검객의 열기·삽입 이후에도 명시한 세 번째 녹음의 buffer identity 유지 통과.
- 결과 JSON과 재생 가능한 `recorded-six.wav`/`fallback-six.wav`는 위 산출물 디렉터리에 있다. 해시·수치는 저장소 JSON에도 보존했다. 추가 기기/사람 청취 품질 수락을 이 검사로 대신하지 않는다.

최종 검사 전 공유 Vite가 중단되어 한 재실행은 동적 import 실패로 끝났다. 자체 Vite를 시작한 뒤 같은 검사와 최종 래퍼 통합 검사를 정상 완료했다. 실패를 소리 코드 결함이나 성공 결과로 세지 않았다.
