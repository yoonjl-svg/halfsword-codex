# 이졸데·미나미 음원 원본 전달 — 2026-10-13

Freesound에 접속하지 않아도 편집을 계속할 수 있도록 보관된 전체 HQ MP3 미리보기를 전달합니다. 원본 WAV라고 주장하지 않습니다. 기존 사용 녹음과 같은 mvVoiceActing의 “girl damage”(#855460)입니다.

## 파일과 출처

- 전체 HQ MP3: `girl-damage-855460-hq.mp3` (219,034 bytes)
- SHA-256: `ce834bc7c0755ec0b73dc3c93d38eddf7f51fd10b852be5e42ba4a6ae243ef7c`
- 재생되는 PCM 길이 9.322812초 (MP3 컨테이너 9.351837초), 스테레오 44.1kHz.
- 저자: mvVoiceActing. 제목: girl damage.
- 출처: https://freesound.org/people/mvVoiceActing/sounds/855460/
- 공개 HQ URL: https://cdn.freesound.org/previews/855/855460_3298571-hq.mp3
- 라이선스: CC0 1.0. https://creativecommons.org/publicdomain/zero/1.0/
- 10월12일 보관본의 실제 파일을 확인하고, 10월13일 출처 페이지의 저자/제목/CC0/공개 HQ URL을 다시 확인했습니다. 이 환경에서는 이번 출처 페이지 요청이 성공했습니다. 상대 환경의403 원인은 확정하지 않습니다.

## 이미 사용한 구간 — 중복 방지

| 용도 | 원본 시간(초) |
|---|---|
| 피격1 | 0.40–1.30 |
| 피격2 | 1.90–2.70 |
| 기절1 | 3.30–4.40 |
| 부활1 | 6.55–7.02 |
| 출혈1 | 7.80–8.90 |

4.40–6.55초에는 약5.6초 부근의 짧은 발성 하나가 있습니다. 8.90초 이후는 약0.42초 남으며 파형상 거의 바닥 잡음입니다(peak−55.48dBFS, RMS−67.83dBFS). 새로운 출혈 연기가 남아 있다고 가정하지 마세요. 이 자료는 새 기절2·출혈2 완성본이 아닙니다. 직접 청취해 용도를 판정해야 합니다. 무음/잡음만 늘이거나 같은 연기의 피치를 바꾸어 별개 녹음으로 계산하면 안 됩니다.

현재 게임 편집본은 70Hz 하이패스·피크 정규화를 거쳤으므로 이 전체 원본은 더 작게 들립니다. 이 MP3를 다시 MP3로 중간 저장하지 말고, 한 번 PCM으로 풀어 편집한 뒤 최종 파일만 인코딩하세요.

## 최종 교체 위치

두 독립 녹음을 확보했을 때 `public/sfx/voice/isolde_ko2.mp3`, `isolde_bleed2.mp3`를 추가하고 `src/sound.js`의 isolde 프로필에서 두 번째 참조만 바꿉니다:

```js
ko: ['voice/isolde_ko1', 'voice/isolde_ko2'],
bleed: ['voice/isolde_bleed1', 'voice/isolde_bleed2'],
```

`isolde_ko1.mp3`와 `isolde_revive1.mp3`는 각각 기절1/부활용으로 계속 쓰므로 덮어쓰거나 삭제하지 마세요. 기존 hurt:2, revive:1, gain:1.3은 유지합니다. 이졸데와 미나미(내부ID yeongman)가 같은 프로필을 공유하므로 캐릭터 배정 변경은 필요 없습니다.

확인: sha256sum girl-damage-855460-hq.mp3
