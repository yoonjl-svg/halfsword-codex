# 사망음 후속 교정 — 2026-10-13 KST

기준 `587425d16dbfbc3619cd2970564612167ed400ab`. 사용자가 플레이어 사망음 추가 변주를 원치 않았고, 슈바르츠 기절2는 기합 같으며 출혈2는 상승하는 톤이라고 지적했다. 이어 투야나/아르토리아의 기절1=출혈2,출혈1=기절2 중복도 지적했다. 실제 중복이었다. 개수 충족을 용도·고유성 검증으로 대신한 이전 판단을 철회한다.

## 변경

- 플레이어: 기절/출혈 모두 원래 `player_exhale`1개만 사용. 피격2개·이명·기존 파일 불변. `player_exhale2`는 선택/다운로드/번호 버튼에서 제외한다.
- 슈바르츠(마르그레테): 기존1번들과 피격 유지. 거부된 SkyRae 기절2/출혈2는 배정에서 제외한다. 기절2는0.515초의 Cici Type3 날숨 구간, 출혈2는0.9초의 Reitanna 하강 한숨 구간으로 교체한다.
- 투야나/아르토리아: 기절1 Reitanna gasp, 출혈1 Reitanna sigh 유지. 기절2 Cici Type2 healed2(.375초), 출혈2 별도 healed3(.325초)로 교체한다. 피격2개도 별도 원본이며 기절/출혈4개가 서로 다른 연기다.
- 음높이·재생속도를 조작하거나 한 연기를 둘로 잘라 별개 변주로 세지 않는다. 4개 교체 파일은 서로 다른 원본 연기다. 슈바르츠 출혈2는 다른 인물의 Reitanna 한숨과 원본을 공유한다. 인물 간 공유와 동일 인물의 이벤트 중복을 구분한다.

새4MP3 합계28,701바이트. [원본/출력 SHA·구간·가공](voice_refresh_assets_20261012.json), [공개 라이선스](../../public/sfx/LICENSE.txt). Cici 원본 분류는 `healed`이며 사망 연기라고 원작자가 분류한 것이 아니다. 힘이 빠지는 구간을 추출한 후보이고, 감정·인물 적합성은 인간 청취 수락과 구분한다.

기존 슈바르츠1번의 KO/출혈 공용 날숨은 이번 사용자 지적 대상이 아니므로 유지한다. 미나미/이졸데의 승인된 음성도 변경하지 않는다. 모든 캐릭터의 KO/출혈이 전부 독립이라고 주장하지 않는다.

## 검증

전수 감사·영향받은3음성군의32렌더·부분 다운로드 재시도·기존 계정32검사·빌드 통과. 로컬 모바일4묶음(16번호 버튼＋2대전＋플레이어 사망 경로),185파일 일치·오류0. [검사/편집 수치](voice_soften_checks_20261013.json).

- 전수 감사의 플레이어 목표를 명시적2/1/1 예외로 바꾸고, 원래 날숨만 선택됨을 검사한다. 나머지2/2/2 조건은 유지한다.
- 투야나/아르토리아 KO/출혈 전쌍 분리, 슈바르츠 새2번의 교차 중복을 PCM 및 원본 SHA/구간으로 검사한다. 이미 승인된 슈바르츠1번 쌍만 예외다.
- 새4파일의 처음/중간/마지막 RMS가 순서대로 감소한다. 출혈2 원본 추정F0는 슈바르츠254→219→205Hz, 투야나315→231Hz. 음높이 추정은 오차가 있으며 청취를 대체하지 않는다.
- 영향받은3음성군의 실제 Sound 렌더32개만 검사한다. 다른8음성군은 이전132렌더/공개 확인을 재사용한다.
- 모바일: 플레이어4버튼, 상대6버튼; 새 파일 실제 재생·정지·삭제된 변주 미요청·320/390/844px; 슈바르츠/투야나 실제 입력·재시작 및 플레이어 사망 경로. 아르토리아는 같은 음성군 공유를 전수 감사에서 확인한다.

첫 렌더 시도는 이전 개발 서버가 종료돼 import에 실패했다. 서버를 다시 시작하여 재검사하며 음원/게임 결함으로 기록하지 않는다. 전체 원본 재조사나 물리 실험은 반복하지 않았다.

재현:
```sh
node tools/audio/voice_inventory_20261012.mjs /tmp/voice-soften-inventory.json --strict
npm run dev -- --host 127.0.0.1 --port 4182
node tools/audio/voice_refresh_20261012.mjs http://127.0.0.1:4182/ /tmp/voice-soften-audio.json --profiles=player,margarethe,soft_female
npm run build -- --outDir /tmp/voice-soften-build
python3 -m http.server 4184 --bind 127.0.0.1 --directory /tmp/voice-soften-build
node tools/browser/voice_refresh_20261012.mjs http://127.0.0.1:4184/ /tmp/voice-soften-local /tmp/voice-soften-build --characters=player,margarethe,eira,artoria --game=margarethe,eira
```

공개 상태와 결과는 [전달 영수증](voice_soften_release.json)에 확정한다. [슈바르츠 청취](https://yoonjl-svg.github.io/halfsword-codex/voices.html#character-margarethe) · [투야나 청취](https://yoonjl-svg.github.io/halfsword-codex/voices.html#character-eira).
