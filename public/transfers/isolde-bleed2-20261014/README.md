# 이졸데·미나미 출혈2용 별도 녹음 — 2026-10-14 KST

기존 girl damage(855460)와 **같은 성우 mvVoiceActing의 다른 녹음**이다. 제목은 “exhaustion / sighs / woman voice acting”(855463), CC0. 기존 녹음의 무음이나 같은 연기를 늘인 파일이 아니다. 모든 자료는 이 폴더와 ZIP에 있어 Freesound 접속 없이 가져갈 수 있다.

## 파일

- `mv855463-full-hq.mp3`: 전체 공개 HQ MP3. PCM8.805578초. 원본 WAV는 아니다.
- `isolde_bleed2_candidate.mp3`: 출혈2 후보. 원본7.870–8.620초의 네 번째 숨,0.750초.
- `isolde_short_exhale_reserve.mp3`: 예비 후보. 원본0.640–1.320초의 첫 번째 숨,약0.680초. 기본으로 추가 배정하지 않는다.
- `manifest.json`: 원본/편집/문서 해시, 저자·출처·라이선스, 정확한 편집 구간과 측정 결과.
- `render.py`: 재편집 도구. Python3·NumPy·ffmpeg 필요. `python render.py`로 편집본 두 개를 다시 만든다. ffmpeg 버전이 다르면 MP3 바이트 해시는 달라질 수 있다.

출처: https://freesound.org/people/mvVoiceActing/sounds/855463/
CC0: https://creativecommons.org/publicdomain/zero/1.0/

## 편집과 판정

70Hz 하이패스·6500Hz 로우패스, 피크 목표0.62로 레벨 조정, 짧은 진입과 마지막 감쇠. 음높이·길이 변조 없음. MP3 전체를 한 번 PCM으로 풀어 편집하고 최종본만 인코딩했다. 세 구간 RMS가 순서대로 감소하고 클리핑이 없음을 확인했다. 기존 이졸데 다섯 음원과 동일 PCM 재사용이 아님도 대조했다. 파형/디코딩 검사는 인간 청취나 연기 적합성 승인을 뜻하지 않는다. 원본은 소리가 작으므로 편집본과 음량이 다르다.

## 적용 위치 — 검토 후 출혈2만 교체

1. `isolde_bleed2_candidate.mp3`를 `public/sfx/voice/isolde_bleed2.mp3`로 복사.
2. `src/sound.js`의 isolde 프로필에서 `bleed`의 두 번째 항목만 `voice/isolde_bleed2`로 변경.
3. 기존 출혈1·기절·부활과 gain1.3, 이졸데/미나미 프로필 공유 유지. 상대 쪽에서 이미 만든 기절2를 덮어쓰지 않는다.
4. 새 녹음 출처/편집 구간을 상대 프로젝트의 음원 라이선스 목록에 함께 보존.

```js
bleed: ['voice/isolde_bleed1', 'voice/isolde_bleed2'],
```

이번 전달로 어느 팀의 게임 음성 배정도 자동으로 바뀌지 않는다. 후보 공개·파일 수령과 실제 게임 채택을 구분한다. 이전 원본855460은 기절2를 편집할 때 그대로 이용할 수 있다.
