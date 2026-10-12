# 토메 기절1 음색 교정 — 2026-10-13 KST

기준 `8023ae90a9f671da5352c5c62e154c84bc503c65`. 사용자가 토메 기절1에만 다른 음성과 다른 높은 쇳소리 느낌을 지적해 튜닝을 요청했다.

## 변경

HaelDB `yell12.wav`의 기존 연기를 유지했다. 보관 원본 SHA를 확인하고, 기존MP3와 상관0.964인 원본0.144625–0.944625초를 사용했다. 새 `tome_ko1_warm`을 토메 음성군의 KO1에만 연결한다. 김씨·은발의 검사는 같은 음성군이므로 함께 적용되며 generic 기본 음성군의 기존파일은 불변이다.

- Rubber Band로 **−2반음**,tempo1. 길이0.8초 유지.
- 1.8kHz 중심 bell−3dB(Q0.8),3kHz 이상 shelf−2dB로 날카로운 울림을 완화.
- 시작12ms·끝60ms페이드. 목표는 기존대비RMS−1.5dB였으나 피크상한0.8에 먼저 도달하여 최종RMS는0.241→0.153(약−3.9dB),기절2의0.162와 약0.5dB차이다. 피크를 다시 높여 목표 음량을 강제하지 않았다.
- 출력 주파수 무게중심1047→908Hz,2–5kHz에너지 비율1.65→0.93%. 이는 신호수치이고 쇳소리 느낌이 해소됐다는 인간 청취 수락의 증명이 아니다.

다른5변주와 음성군 전체gain/rate는 그대로다. 새 녹음이나 성우가 아니며 이전 배우의 동일 연기를 가공했다. [원본·구간·SHA·가공](voice_refresh_assets_20261012.json), [공개 출처](../../public/sfx/LICENSE.txt).

## 검증·전달

변경된 토메 음성군만6변주×44.1/48kHz의 실제 Sound렌더, 기존 배정/출처 감사와 배포필수검사를 실행한다. 모바일에서는 공유음성6번호 재생·정지,공유인물배정,토메대전입력·일시정지·재시작을 검사한다. 12실제렌더·감사·계정32검사·빌드 통과. [수치/검사 근거](tome_ko1_tone_checks_20261013.json). 로컬 모바일2묶음·179파일 일치·오류0,기존KO1 미요청 확인. 공개 전달 확인 중.

F0추정은 비주기/옥타브오류에 민감하다. 기절1·2의 추정 중앙값은 원래부터 비슷하므로 ‘기절1만 기본 주파수가 유독 높다’고 단정하지 않는다. 사용자가 느낀 음색·강도 차이를 기준으로 작은 교정을 한다.

재현:
```sh
node tools/audio/voice_inventory_20261012.mjs /tmp/tome-inventory.json --strict
node tools/audio/voice_refresh_20261012.mjs http://127.0.0.1:4182/ /tmp/tome-audio.json --profiles=tome
npm run build -- --outDir /tmp/tome-tone-build
python3 -m http.server 4187 --bind 127.0.0.1 --directory /tmp/tome-tone-build
node tools/browser/voice_refresh_20261012.mjs http://127.0.0.1:4187/ /tmp/tome-local /tmp/tome-tone-build --characters=tome,renji,silver_wanderer --game=tome
```
