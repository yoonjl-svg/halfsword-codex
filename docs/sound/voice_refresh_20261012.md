# 마야 독립 음성 · 전 인물 변주 통일 — 2026-10-12 KST

기준 `c5afbb569961d6bb8e57e48bbed69d0d1ffeaf54`. 사용자가 마야 분리와 전수조사 후 모든 인물의 피격/기절 분리 및 같은 변주 수를 승인했다. 미나미는 사용자가 선택한 원래 이졸데 음성을 유지한다.

## 이름의 현재 기준

| 내부 ID(유지) | 현재 이름 | 이전 이름 |
|---|---|---|
| crown_boss | 마야 라토르 | 사미라 미르자 |
| yeongman | 미나미 | 영만 |
| eira | 투야나 니콜라예바 · 빙판의 사제 | 에이라 린드 |

마야·미나미 변경은 사용자 지시. 투야나 조회는 이번 턴의 명시적 열람 요청으로 수행했다. 원본 main `c8dd376d8b73e94c846e74f6f8ef0482b9d355e8`의 `src/characters.js`(마야466행, 투야나523–524행), `docs/devmeet/2026-10-11.md`의 해당 개명 부분을 확인했다. 마야 성도 같은 원본에서 확인했다. 원본 수정은 없다. 기존 링크/저장 ID와 역사 문서의 이름은 유지하고 현재 게임·안내에 새 이름을 표시한다.

## 조사와 최종 배정

[변경 전 전체 조사](voice_inventory_20261012.json)는 변경 전에 생성했으며 덮어쓰지 않았다. 원래10프로필,47MP3 중39선택. generic/tome/bran/heinrich만2/2/2였고, 전체14개 변주 슬롯이 부족했다. soft_female은 같은 녹음을 피격·기절에 중복 배정했다.

최종 공통 이벤트는 **피격2 / 기절2 / 출혈2**, 각 이벤트 안에서 독립된 실제 녹음을 사용한다. 피격과 기절은 서로 다른 녹음이다. 기절·출혈 간 공유는 일부 유지한다. 이졸데만 가진 부활 전용 효과는 공통 이벤트가 아니다.

| 인물 | 음성군 | 이번 처리 |
|---|---|---|
| 마야 | maya | AuraVoice의 서로 다른 연기6개로 독립 |
| 이졸데·미나미 | isolde | 기존 연기 유지; 별도 부활/기절 녹음 참조로 부족분 보충 |
| 투야나·아르토리아 | soft_female | 기존 Reitanna 날숨 유지; Cici Fyre 피격2개로 기절과 분리 |
| 마르그레테 | margarethe | 기존 hisoul 첫 변주 유지; SkyRae 별도 연기3개 보충 |
| 랴오·세르파 | liao | HaelDB 기절/출혈 보충; 거부된 옛 출혈2번은 계속 제외 |
| 오마리 | omari | 같은 배우의 별도 기절/출혈 연기 보충; 기존 단축본 유지 |
| 플레이어 | player | 기존 조용한 날숨＋MLaudio 날숨; 이명/피격 유지 |
| 토메·김씨·은발의 검사 | tome | 기존2/2/2 유지 |
| 브란 | bran | 기존2/2/2 유지 |
| 하인리히·광기의 하인리히 | heinrich | 기존2/2/2 유지 |

신규16MP3 합계173,103바이트. [자산·원본 해시/구간/가공 명세](voice_refresh_assets_20261012.json), [공개 라이선스](../../public/sfx/LICENSE.txt). 속도나 음높이만 바꾼 복제본을 새 변주로 세지 않았다. 세르파 전용 음성은 만들지 않았다. 한 세트의 배우가 모두 동일하다고 주장하지 않는다: 투야나/아르토리아, 마르그레테, 플레이어 보충분은 다른 배우다.

원본 음원 서버 일부가403을 반환하여 재시도를 중단하고 OpenGameArt의 허용된 원본을 사용했다. 오래된 랴오 실패 녹음을 되살리거나 미나미 배정을 바꾸지 않았다.

## 검증·전달

[자동 검사 요약·입력 해시](voice_refresh_checks_20261012.json).

- 전수검사:15캐릭터＋플레이어＋generic 예비군,11프로필,선택55파일. 모든 공통 이벤트2개·피격/기절 중복0·누락0·출처 미상0·새 자산 해시 불일치0.
- 실제 Sound 렌더:11프로필×3이벤트×2변주×44.1/48kHz =132. 선택한 AudioBuffer가 실제 출력에 사용됨, 유한/비무음/클리핑 없음. 렌더 피크0.1814–0.8569.
- 부분 다운로드503: 마야 피격1개만 받은 다음 재시도로2개가 됨. 일부 성공 후 두 번째 파일 재시도를 생략하던 로더를 수정했다.
- 배포에 필요한 기존 계정 검사32개와 빌드 통과. 물리/피해/게임 진행 코드는 변경하지 않았다.
- 로컬 모바일5묶음 통과: 실제66개 번호 버튼 재생/정지,320/390/844px, 마야·투야나·오마리 진입/입력/일시정지/재시작, 플레이어 조용한 사망 경로.227파일 빌드 해시 일치·오류0. 공개 전달은 후속 영수증에 확정한다. 기술 검사는 인물에 어울리는지에 관한 인간 청취 판단을 대신하지 않는다.

재현(원본 음원 재다운로드 불필요):
```sh
node tools/audio/voice_inventory_20261012.mjs /tmp/voice-final.json --strict
npm run dev -- --host 127.0.0.1 --port 4182
node tools/audio/voice_refresh_20261012.mjs http://127.0.0.1:4182/ /tmp/voice-render.json
npm run build -- --outDir /tmp/voice-build
python3 -m http.server 4183 --bind 127.0.0.1 --directory /tmp/voice-build
node tools/browser/voice_refresh_20261012.mjs http://127.0.0.1:4183/ /tmp/voice-local /tmp/voice-build
node tools/browser/voice_refresh_20261012.mjs https://yoonjl-svg.github.io/halfsword-codex/ /tmp/voice-public /tmp/voice-build
```

브라우저 도구는 지정 Playwright/Chromium 환경이 필요하다. 공개 검사에서 환경 프록시와 정상 TLS 검증을 유지한다. 계정/SQL을 변경하거나 실제 이메일을 발송하지 않는다.

[휴대폰 번호별 청취](https://yoonjl-svg.github.io/halfsword-codex/voices.html) · [마야 대전](https://yoonjl-svg.github.io/halfsword-codex/?foe=crown_boss)
