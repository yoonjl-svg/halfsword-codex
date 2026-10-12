# 마야 출혈을 한 호흡으로 — 2026-10-13 KST

기준 `f9a42e0009efbe14e6400ee3d4b3e529c2703a84`. 사용자가 출혈1·2에서 죽어가다 다시 외치는 느낌을 지적했다. 후속 지시: 나눈 조각 중 더 어울리는2개만 출혈로, 남은1개로 피격1을 교체한다. 피격·기절·출혈 각2개 유지.

| 적용 | 기존 원본 구간 | 처리 | 실제 길이 |
|---|---|---|---|
| 출혈1 | 원래 출혈1 앞,4.925–5.520초 | 음높이 유지·약12%늘임·200ms끝감쇠 | 0.668초 |
| 출혈2 | 원래 출혈2 뒤,9.805–10.285초 | 음높이 유지·약12%늘임·180ms끝감쇠 | 0.538초 |
| 피격1 | 원래 출혈1 뒤,5.565–6.095초 | 늘이지 않고 짧게·55ms끝감쇠 | 0.534초 |

출혈1의 무음 골은 현재파일 약0.65–0.70초. 출혈2는 완전한 무음이 없고 앞부분 안에도 작은 골이 있어, 뒤의 지속된 덩어리를 선택하고 경계25ms페이드로 클릭을 줄인다. 남은 출혈2 앞부분은 미사용. 두 덩어리를 다시 이어붙이지 않는다. 기존 피격2·기절1/2·다른 인물은 유지한다.

AuraVoice CC0 원본 OGG는 기존 파일의 SHA를 확인해 재사용했다. 새 녹음3개가 아니라 기존 연기를 나눈 서로 겹치지 않는3구간이다. 출혈1·피격1은 같은 연기의 앞/뒤임을 명시한다. [원본 구간·가공·출력 SHA](voice_refresh_assets_20261012.json), [공개 출처](../../public/sfx/LICENSE.txt). MP3합계23,327바이트. 시간 늘이기는 FFmpeg `rubberband=tempo=0.892857142857:pitch=1`이며 전체 게임 재생속도를 바꾸지 않는다.

## 검증·전달

마야 실제 Sound의6변주×44.1/48kHz=12렌더, 전수 배정/해시 검사, 부분 다운로드 재시도, 기존 계정32검사·빌드 통과. [수치/구간/검사 근거](maya_single_breath_checks_20261013.json). 모바일 번호별 재생과 마야 대전 입력·재시작을 검사한다. 표적 구간의 경계와 출력 수치는 신호 분석이며 청취 만족도의 증명이 아니다. 로컬 모바일2묶음/184파일 해시 일치·오류0 통과. `b75013b`/Pages38273742229 공개 완료. 로컬/공개 모바일 각2묶음·공개184파일 일치·오류0. [전달 영수증](maya_single_breath_release.json).

재현:
```sh
node tools/audio/voice_inventory_20261012.mjs /tmp/maya-inventory.json --strict
node tools/audio/voice_refresh_20261012.mjs http://127.0.0.1:4182/ /tmp/maya-audio.json --profiles=maya
npm run build -- --outDir /tmp/maya-breath-build
python3 -m http.server 4186 --bind 127.0.0.1 --directory /tmp/maya-breath-build
node tools/browser/voice_refresh_20261012.mjs http://127.0.0.1:4186/ /tmp/maya-local /tmp/maya-breath-build --characters=crown_boss --game=crown_boss
```
