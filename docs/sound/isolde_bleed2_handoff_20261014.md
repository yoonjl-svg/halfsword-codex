# 이졸데·미나미 출혈2용 별도 녹음 — 2026-10-14 KST

기준 `e955a0d`. 사용자 요청: 이전에 전달한 girl damage 녹음에는 추가 출혈 연기가 충분히 없으므로 다른 녹음을 확보한다. 사용자가 우화에게 메시지를 전달하며 별도 연락은 하지 않는다.

## 선택과 편집

같은 성우 **mvVoiceActing**의 별도 녹음 **exhaustion / sighs / woman voice acting**, Freesound **855463**, **CC0**를 확보했다. 출처 페이지의 저자·제목·CC0와 HQ MP3 주소를 실제로 확인하고 전체 파일206,818bytes를 받았다. SHA256 `608ec40ed1e59317d062db6858b8b34da8cd000eee60776aea803b865979cfb7`. 전체 공개 HQ MP3/PCM8.805578초이며 원본 WAV는 아니다. 기존855460과 별도 녹음이다.

- 출혈2 후보:7.870–8.620초,0.750초. 마지막 숨 구간.
- 예비 후보:0.640–1.320초,약0.680초. 첫 숨 구간. 자동 추가 배정하지 않는다.
- 공통:HP70Hz·LP6500Hz,피크 목표0.62,짧은 진입·마지막 감쇠. 피치/속도 변경 없음. 한 번 PCM으로 풀어 편집하고 최종MP3만 인코딩.

세 구간 RMS가 순서대로 감소하고 피크<0.60임을 실측했다. 기존 이졸데5파일과 동일 파형 재사용이 아닌지 상관 대조했다. 이 검사는 인간 청취나 연기 적합성 승인을 뜻하지 않는다. 후보 두 개의 휴대폰 재생 화면을 제공한다.

## 전달·적용 범위

`public/transfers/isolde-bleed2-20261014/` 8파일과ZIP: 전체HQ MP3,편집MP3둘,README,LICENSE,manifest,재편집script,듣기HTML. portable `render.py`를 다른 빈 경로에서 실행해 편집본 두 개의 SHA256을 정확히 재현했다. ZIP무결성과 로컬·공개9파일 해시/브라우저 디코딩·터치 재생/320·390px 가로넘침을 검사한다.

실제 채택 시 후보를 `public/sfx/voice/isolde_bleed2.mp3`로 복사하고 `src/sound.js`의 isolde `bleed[1]`만 교체한다. 기존 출혈1/기절/부활·gain1.3·이졸데/미나미 공유는 보존한다. 우화가 이미 편집한기절2는 덮어쓰지 않는다. **이번 변경은 전달용 원본·후보 공개이며 어느 게임의 프로필 배정도 변경하지 않았다.**

출혈2 별도 녹음 공개 검증 진행 중.

검증: `node tools/browser/isolde_bleed2_handoff_20261014.mjs <base> /tmp/halfsword-isolde-bleed2-20261014/<report>`.
공개:https://yoonjl-svg.github.io/halfsword-codex/transfers/isolde-bleed2-20261014/index.html
출처:https://freesound.org/people/mvVoiceActing/sounds/855463/
