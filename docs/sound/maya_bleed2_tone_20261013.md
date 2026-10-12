# 마야 출혈2 미세 음색 교정 — 2026-10-13 KST

기준 `64f76e0ded29cb1a37fcce28edd6c9b64da14405`. 사용자는 출혈2만 굵고 중성적으로 들린다며 늘이기의 영향과 작은 교정을 요청했다.

같은 원본9.805–10.285초,같은필터·비례페이드·RMS0.09 조건으로 12%늘이기 전후를 비교했다. 피치설정은1이었다. 주파수 무게중심883→914Hz,150–600Hz에너지비율27.9→23.0%,추정F0중앙값314→308Hz. 이 측정은 ‘늘여서 저음이 증가했다’는 설명을 뒷받침하지 않는다. 다만 스트레칭이 어택·질감에 영향을 줄 수 있으며,배음/거칠기와 사람이 느끼는 굵기는 별도다. 원인을 확정하지 않는다.

**교정은 출혈2에350Hz벨EQ−1dB(Q0.7)만 추가**하고 음량을 맞추는 것으로 제한한다. 동일 원본·구간·12%늘이기·피치1·25ms시작/180ms끝페이드 유지. 길이0.5376초 불변,RMS차이+0.0045dB,추정F0중앙값308Hz불변,피크0.438. 파일은`maya_bleed2_light`로 교체하고 이전파일은 보존한다. 다른5변주는 불변이다.

[원본 구간/출력 SHA/가공](voice_refresh_assets_20261012.json),[공개 출처](../../public/sfx/LICENSE.txt). 기존 AuraVoice CC0 연기의 미세편집이며 새로운성우/변주추가가 아니다. 낮은중역감쇄와피치상승을 함께 하지 않아 과한변형을 피한다. 비교수치는 청취적합성이나 성별인상 개선의 증거가 아니다.

## 검증·전달

마야 실제12렌더,기존배정/출처감사,배포필수검사와 휴대폰 마야재생·플레이·재시작을 확인한다. 실제 렌더와 배정 감사·빌드 통과. [비교 수치와 검사 근거](voice_texture_checks_20261013.json). 로컬 모바일2묶음·18번호재생·190파일일치·오류0 통과. 공개 전달 확인 중.

재현:
```sh
node tools/audio/voice_inventory_20261012.mjs /tmp/maya-tone-inventory.json --strict
node tools/audio/voice_refresh_20261012.mjs http://127.0.0.1:4182/ /tmp/maya-tone-audio.json --profiles=maya
npm run build -- --outDir /tmp/maya-tone-build
python3 -m http.server 4188 --bind 127.0.0.1 --directory /tmp/maya-tone-build
node tools/browser/voice_refresh_20261012.mjs http://127.0.0.1:4188/ /tmp/maya-tone-local /tmp/maya-tone-build --characters=crown_boss --game=crown_boss
```
