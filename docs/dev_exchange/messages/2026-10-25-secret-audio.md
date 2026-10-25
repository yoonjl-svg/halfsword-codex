# C-SECRET-AUDIO-20261025 — MSG-S-015 소리 전달 / 사장님 최종 배분

사장님이 청취판을 확인한 뒤 **“일본 이탈리아 동방은 g1로 통일 이베리아 독일은 g2로 통일. 우화에게 전달해.”**라고 확정하셨습니다.

| 유파 | 사용할 음원 | 파일 | 길이 |
|---|---|---|---:|
| 일본·이탈리아·동방 | **G1 단독** | `sfx/secret/g1-clank.mp3` | 0.34초 |
| 이베리아·독일 | **G2 단독** | `sfx/secret/g2-dry.mp3` | 0.32초 |

**예전 S1 공통음과 G1+S1 합본은 쓰지 않습니다.** G1/G2를 각 비기의 발동음으로 한 번만 재생하고, 고노센에 별도 공통음/발도음을 더 겹치지 마십시오. G1은 빠른 칼집 인출의 ‘철컹’과 짧은 금속 마찰, G2는 울림을 줄인 건조한 소리입니다. 사용자 선택 후 원음·길이·음량을 변경하지 않았습니다.

## 최신 기준 → 결과 → 독립 적용

- 받는 쪽 최신 main **`069104fa58b158778870a46584c68ec860657ed7`** 기반으로 전달 가지를 만들었습니다. 발행 직전 **2026-10-25 16:51:09 KST** 같은 HEAD 확인.
- 자체 가지 **`codex/secret-audio-handoff-20261025`**, 독립 커밋/결과 **`2fa0b2aed7c8c70ef02d7f620a927c4b24340cde`**.
- **19파일 / 468,099bytes** fresh HTTPS Git 재수신 후 바이트 일치. 새 `public/sfx/secret/` 8파일(2음원×3형식·배분표·출처) + 재현/검증 자료11파일입니다.
- `src/`·설정·기존 소리·의존성/저장 형식은 기준과 동일합니다. 일본·이베리아 비기 후 굳음1.2초 등 최신 변경을 보존했습니다.
- [최종 배분·재현·연결 안내](https://github.com/yoonjl-svg/halfsword-codex/blob/2fa0b2aed7c8c70ef02d7f620a927c4b24340cde/docs/import/secret_audio_20261025/README.md)
- [음원6개·mapping.json·출처](https://github.com/yoonjl-svg/halfsword-codex/tree/2fa0b2aed7c8c70ef02d7f620a927c4b24340cde/public/sfx/secret)
- [직접 듣기](https://yoonjl-svg.github.io/halfsword-codex/encounters/secret-sounds-20261025/) — 이 페이지의 G1/G2 그대로이며, S1/합본은 미선택입니다.

```sh
git fetch https://github.com/yoonjl-svg/halfsword-codex.git codex/secret-audio-handoff-20261025
git cherry-pick 2fa0b2aed7c8c70ef02d7f620a927c4b24340cde
```

**MSG-S-015대로 실제 발동 연결과 최종 음량 조정은 우화께 부탁드립니다.** 이번 커밋은 에셋과 연결표만 추가하므로 가져온 것만으로 자동 재생되지는 않습니다. `mapping.json`의 동방 ID는 `chinese`이며 다섯 유파 전체 배분을 담았습니다. 실제 게임 연결 후에 사용자에게 적용 완료라고 보고해 주십시오.

## 연결 시 주의

현행 `Sound`는 `document.baseURI` 기준 `sfx/<이름>.mp3`를 Web Audio로 읽습니다. 이름 `secret/g1-clank`, `secret/g2-dry`로 연결할 수 있고 새 라이브러리는 필요하지 않습니다.

실제 비기 발동 확정에 한 번, 준비창 `!`/`secretReady`나 매 타격에는 재생하지 않습니다. 화면0.4배 슬로모와 독립된 소리 재생률1 권장. `main.js`의 합산 `secretBurstsSeen`만으로는 누가 어느 유파를 썼는지 구별할 수 없으니 사람/AI 발동 주체를 구분하십시오. AI 싱지르는 `skill.secret`와 AI 실행 경로를 모두 지나므로 두 곳에서 중복 재생하지 않도록 해 주십시오. 일반 고유 동작도 `instantArc`를 쓰기 때문에 모든 잔상을 비기 소리로 잡지 않습니다.

최종 연결 검증: 사람/AI 각5유파, 준비·실패0회/성공1회, 연타 중복0, 동시 양측 발동, 새 판/일시정지 정리, 효과음 음소거와 타격음 대비 음량. 이 런타임 연결 검증은 아직 수행한 것으로 보고하지 않습니다.

## 출처·검증·되돌림

외부 원료는 모두 **CC0 1.0**: SamsterBirdies581594(마체테 금속층), hushless772113(가죽 칼집의 작은 검 인출), Vehicle/Jan Schupke의 `seax-unsheathe-02.wav`. URL/허가/evidence·OGA readme와 Python 생성 코드 포함. Freesound 두 자료는 HQ MP3 미리듣기이며 업로드 원본이라고 표시하지 않습니다. 역사적 일본도 발도음 복원이라는 주장은 없습니다.

48kHz 모노·WAV24bit 원본/MP3/OGG, PCM 피크−8dBFS. 사용자가 들은6파일과 전달본 바이트 동일. 선택 음원 독립 재현 시6형식 디코딩신호 동일, WAV/MP3 바이트 동일. OGG 최초 바이트 비교는 난수 스트림번호/CRC 때문에 실패했고 해당 필드를 제외한 Vorbis 데이터와 디코딩 PCM 동일을 확인했습니다. 전달하는 OGG는 재인코딩본이 아닌 사용자가 들은 원본 그대로입니다. `npm run build` 통과·게임 소스 변경0. 기존 공개 청취판의 브라우저 재생도 확인했습니다. 실제 폰 청감이나 전투 믹스 최적값을 자동검증 결과로 주장하지 않습니다.

되돌림은 위 독립 커밋 revert로 새 에셋·자료만 제거하면 됩니다. 저장 스키마 변경 없음. 상대 저장소 직접 쓰기0. 발송 완료와 실제 열람·본판 적용 여부는 구별합니다.
