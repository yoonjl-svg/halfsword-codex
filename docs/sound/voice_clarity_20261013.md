# 슈바르츠1번 중복·투야나 말소리 교정 — 2026-10-13 KST

기준 `0e7eb9e944186d0426849b5b5fc9d7acdb5af544`. 사용자 청취에서 슈바르츠 기절1=출혈1, 투야나 출혈2의 말소리 느낌이 확인됐다.

- 슈바르츠: 출혈1 `margarethe_bleed1` 유지, 기절1을 기존 별도 녹음 `reitanna_gasp`로 교체. 투야나와 이 녹음을 공유하지만 슈바르츠 안의 기절·출혈 네 녹음은 서로 다르다.
- 투야나/아르토리아: 말소리 같다고 거부된 `tuyana_bleed2_fade` 배정 제외. Reitanna **deep sigh and exhale.wav (351160)**의1.10–1.60초 날숨을 `tuyana_bleed2_breath`로 제작. 기존 기절/출혈/피격과 다른 원본이며, 음높이·속도 변경 없음.
- 플레이어 기존 사망음1개와 이명, 나머지 승인 음성 유지. 미나미/이졸데의 기존 교차 공유까지 제거했다는 뜻은 아니다.

새 파일6,940바이트,0.5초. 원본은 CC0. [출처·구간·SHA·가공](voice_refresh_assets_20261012.json), [공개 라이선스](../../public/sfx/LICENSE.txt). 출처 제목/설명은 날숨이며 말/주문/회복 음원을 자른 후보가 아니다. 원본의 자연스러움과 대사 부재를 인간이 청취해 승인했다는 주장은 하지 않는다.

## 잘못된 판단과 검사 보완

직전 보고에서 슈바르츠1번 공용을 ‘이미 승인된 예외’라고 적은 것은 잘못이었다. 이전 파일을 유지한 우리 판단일 뿐 사용자 승인이 아니었다. 그 예외를 제거하고 두 음성군의 KO×출혈 전쌍을 PCM·원본 녹음 기준으로 검사한다. `healed` 클립과 감쇠 수치만으로 사망음 용도를 판단한 것도 부족했다. 사용자 청취 피드백을 우선해 명시적 날숨 원본으로 바꾼다.

## 검증과 한계

전수 감사: 파일/출처/개수/피격-기절 분리 통과, 두 음성군 KO/출혈8쌍 중복 없음. 영향받은2음성군만 실제 Sound24렌더(44.1/48kHz)·부분 로딩 재시도, 기존 계정32검사·빌드 통과. 새 음원 RMS는 처음/중간/끝0.1295→0.0430→0.0055, peak0.4821. 불규칙한 날숨이므로 신뢰할 음높이 추세를 주장하지 않는다. [검사 수치](voice_clarity_checks_20261013.json).

원본 전체 재조사와 물리 실험은 반복하지 않는다. 모바일 검사는 두 음성군12번호 버튼,아르토리아 공유 배정,320/390/844px,투야나 실제 입력·일시정지·재시작을 확인한다. 파일 SHA 일치와 실제 재생은 음색 적합성의 수락을 대신하지 않는다. 로컬 모바일2묶음/184파일 해시 일치·오류0 통과. `b728e34`/Pages38271683254 공개 완료. 공개 모바일2묶음/184파일 해시 일치·오류0 통과. [전달 영수증](voice_clarity_release.json). [휴대폰 청취](https://yoonjl-svg.github.io/halfsword-codex/voices.html?v=b728e34).

재현:
```sh
node tools/audio/voice_inventory_20261012.mjs /tmp/voice-clarity-inventory.json --strict
node tools/audio/voice_refresh_20261012.mjs http://127.0.0.1:4182/ /tmp/voice-clarity-audio.json --profiles=margarethe,soft_female
npm run build -- --outDir /tmp/voice-clarity-build
python3 -m http.server 4185 --bind 127.0.0.1 --directory /tmp/voice-clarity-build
node tools/browser/voice_refresh_20261012.mjs http://127.0.0.1:4185/ /tmp/voice-clarity-local /tmp/voice-clarity-build --characters=margarethe,eira,artoria --game=eira
```
