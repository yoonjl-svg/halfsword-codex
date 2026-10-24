# C-WHIP-FINAL-20261024 — 원형 섬네일1안 · CC0 C2 음원 확정 전달

사장님이 **“채찍 처음 만든 원형 섬네일 쓸게”**, **“c2로 할게”**로 확정하신 뒤 **“작업내용과 변경사항들 우화에게 보내”**라고 지시하셨습니다. 섬네일은 바로 가져갈 수 있게 연결했고, 사운드 적용/조정은 우화 담당이라는 지시를 유지하여 **확정 파일과 근거만 전달**합니다.

## 기준 → 결과 → 적용 묶음

- 수신 최신 main **`c2645129e2b7b7c2343dab86fc6f85dad8e73da6`**, 발행 직전 **`2026-10-24T04:59:35.931665+00:00`**에 같은 HEAD임을 재확인했습니다.
- 그 위의 전달 가지 **`codex/whip-final-handoff-20261024`**, 결과 **`3912e1ec5677344f94730a173b652cbc20a0e2f4`**. 독립 커밋 두 개입니다.
- **`537a7bd86ef5a737a99ec630e9a49a168b4f06c0`**: 원형1안 원본 PNG/게임용 WebP와 카드·인벤토리 공용 경로 연결, 무기 섬네일 재생성 시 채찍만 승인 마스터 유지.
- **`3912e1ec5677344f94730a173b652cbc20a0e2f4`**: C2 MP3·CC0 근거·선택 기록·최신/과거 음성 점검·검증·실제 카드 사진. **오디오 실행 코드와 public/sfx 변경0**.
- [최소 파일·의존·검증·되돌림 안내](https://github.com/yoonjl-svg/halfsword-codex/blob/3912e1ec5677344f94730a173b652cbc20a0e2f4/docs/import/whip_final_20261024/README.md). 전달17파일의 원격 바이트/해시를 확인했습니다.

```sh
git fetch https://github.com/yoonjl-svg/halfsword-codex.git codex/whip-final-handoff-20261024
git cherry-pick 537a7bd86ef5a737a99ec630e9a49a168b4f06c0 3912e1ec5677344f94730a173b652cbc20a0e2f4
npm run build
```

## 최종 선택과 우화 쪽 작업

1. **섬네일=처음의 넓은 원형1안.** 원본1254² RGBA와256² WebP를 함께 보존합니다. 카드/인벤토리 경로는 `public/ui/weapons/druid_whip.webp`, 승인 WebP SHA256 `a649b44ed7eaba6c4f99440af2b7fb2798c92af193f5add38dd3ec6838612175`. 2안 촘촘코일/수정8자3안은 미선택 자료입니다. [시안 비교](https://yoonjl-svg.github.io/halfsword-codex/encounters/whip-variants-20261024/).
2. **음원=C2 / SciFiSounds, Whip Crack.m4a / CC0 1.0.** [원 출처](https://freesound.org/people/SciFiSounds/sounds/529925/) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/). 크레딧 표기 의무 없이 상업 사용·편집 가능합니다. `docs/import/whip_final_20261024/audio/C2-approved-single.mp3`가 사용자가 들은 약0.534초 단발입니다. [그 파일 직접 듣기](https://yoonjl-svg.github.io/halfsword-codex/encounters/whip-cc0-20261024/audio/C2-single.mp3). SHA256 `ebff24d3fdd3e4c318c4878f650a2df5e75b22ed20ded077068b8afde81e47d0`.
3. 사이트의 HQ MP3 미리듣기도 보존했습니다. 업로드 원본 M4A라고 오인하지 말아 주세요. 비교용 가공은 모노/피크−6dBFS/시작1ms·끝35ms페이드/MP3변환이며 음높이·속도·합성레이어 변경은 없습니다. 제작 방식 자체는 소스에 미기재입니다.
4. **실제 타격음 교체·재생 시점/음량·중복 소리 조정은 우화가 맡아 주세요.** 출발 문제는 기존 `whipHit`의 물건 타격음이 채찍처럼 들리지 않는 것이었습니다. 이번 전달 가지에는 게임 음원 연결을 바꾸지 않았습니다. 예전 CC BY A안(Mike Koenig)·C1 추천은 최종 선택이 아니며, A가 연결된 예전 작업 가지 전체를 가져오지 마세요.

## 캐릭터 음성 점검의 정정

최신 수신본은 **롤랑→브론(bran), 백린의 전사→오마리(omari), 베르나르도 델 카르피오→랴오(liao)**로 이미 반영되어 있습니다. 세 묶음의 실제 Sound 로딩/피격/사망 경로가 유효함을 재확인했고 이번 전달은 그대로 보존합니다.

제가 앞서 보고한 백린의 `renji` 미연결 오류는 **과거 f29ed817 기준에서 발견된 문제이며 최신에는 해결되어 있습니다.** 당시 분산 제안은 연구 이력으로만 첨부했으며 현재 배분을 바꾸라는 지시가 아닙니다. 현재도 인물 수 기준 토메3/하인리히·랴오·브론·오마리 각2로 분산됩니다(얼터는 기본과 한 인물로 계산). 실제 등장 빈도 균등을 뜻하지는 않습니다.

## 검증·한계·되돌림

최신 수신 기준에서 섬네일 생성기를 실제 실행해 승인 원형 마스터와 일치했습니다. 실제 카드844×390/568×320/1280×800에서 이름·설명·등급/넘침 검사, 콘솔 오류0. 빌드 통과(기존 번들 크기 경고). [실제 카드 사진](https://github.com/yoonjl-svg/halfsword-codex/blob/3912e1ec5677344f94730a173b652cbc20a0e2f4/docs/import/whip_final_20261024/cards/card_844x390.jpg).

음성 연결 검사는 실제 시트·Sound 분기를 사용하되 디코딩/출력 노드를 모의 구현한 것입니다. C2 비교판은 실제 브라우저 디코딩/재생을 확인했지만 **C2의 전투 중 믹스·중복·폰 스피커 손맛은 미검증**입니다. 게임 src/index/public-sfx·최신 AI·캐릭터·물리·저장은 보존했고, 전투 변경이 없어 대련 반복은 하지 않았습니다.

되돌림은 첫 섬네일 커밋을 revert하면 됩니다. 둘째 자료 커밋은 런타임을 바꾸지 않습니다. 우화 저장소 직접 쓰기0. 발송과 실제 열람·본판 채택은 별개입니다.
