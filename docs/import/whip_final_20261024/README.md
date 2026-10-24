# 드루이드의 채찍 최종 섬네일 · C2 음원 전달

사장님 확정: **처음 만든 넓은 원형 섬네일(1안)**, **C2 / SciFiSounds — Whip Crack.m4a / CC0 1.0**. 최신 지시 “작업내용과 변경사항들 우화에게 보내”에 따른 전달이다. 사운드 적용/조정은 우화 담당이라는 지시는 유지한다.

## 기준과 최소 적용 묶음

- 수신 최신 main 기준 `c2645129e2b7b7c2343dab86fc6f85dad8e73da6`에서 우리 `codex/whip-final-handoff-20261024`를 새로 만들었다. 발행 직전 최신 원격 재확인 결과와 전달 결과 SHA/범위는 메시지·영수증에 기록한다.
- 첫 독립 커밋 `537a7bd86ef5a737a99ec630e9a49a168b4f06c0`: 승인 원형 원본 PNG/256 WebP, `public/ui/weapons/druid_whip.webp`, `tools/browser/weapon_thumbs.mjs`의 채찍만 마스터 복사 예외.
- 다음 자료 커밋은 이 안내·C2 파일·검증·음성 점검을 담는다. 오디오 실행 코드와 `public/sfx`는 수정하지 않는다.
- 원본 1254² RGBA. 게임용 256² WebP SHA256 `a649b44ed7eaba6c4f99440af2b7fb2798c92af193f5add38dd3ec6838612175`.
- 카드/인벤토리가 기존 같은 WebP 경로를 사용한다. 다른 무기 재생성 방식, 유파·보법, AI/전투, 무기 수치·물리, 저장 형식은 건드리지 않는다.
- 되돌림: 첫 커밋을 revert하면 게임 섬네일/재생성 연결이 원래대로 돌아간다. 자료 커밋은 런타임을 바꾸지 않는다.

## 우화가 적용할 확정 소리

- **C2**: SciFiSounds, “Whip Crack.m4a”, https://freesound.org/people/SciFiSounds/sounds/529925/ . **CC0 1.0**, https://creativecommons.org/publicdomain/zero/1.0/ . 저작자 표시 의무 없이 상업용 복제/편집/사용 가능. 출처는 기록을 위해 보존한다.
- `audio/C2-approved-single.mp3`: 사용자가 들은 비교용 단발, 약0.534초. SHA256 `ebff24d3fdd3e4c318c4878f650a2df5e75b22ed20ded077068b8afde81e47d0`.
- `audio/C2-hq-preview.mp3`: 사이트 제공 HQ 미리듣기. 업로드 원본 M4A라고 표시하지 않는다. SHA256 `5273b7064ed9da3807f97d48e7d6e806097fef816b797c363567e780a19546e7`.
- 비교용 가공은 모노44.1kHz/피크−6dBFS/시작1ms·끝35ms 페이드/MP3변환. EQ·음높이·재생속도·합성 레이어 변경 없음. 선택 파일과 상세 출처는 `selection.json`, 페이지의 라이선스/설명 발췌는 `cc0-source-evidence.html`.
- 기존 `whipHit`의 물건 타격음(Thwack)을 채찍다운 소리로 바꾸려는 요청에서 출발했다. **실제 라우팅·발동 시점·음량·다른 채찍 소리와의 중복 처리는 우화 쪽에서 적용/검증**해 달라. 이 전달본에는 C2를 실행 경로에 연결하지 않았다. 게임에 자동 적용됐다고 오인하지 말 것.
- 과거 **CC BY A안(Mike Koenig)** 및 C1 추천은 폐기된 선택 이력이다. A안의 별도 작업 가지를 통째 가져오지 말고 이번 최신 기준의 전달 가지를 사용한다.

## 캐릭터 음성 — 최신 수신본에서 이미 변경됨

최신 수신 시트는 **롤랑=bran(브론), 백린의 전사=omari(오마리), 베르나르도 델 카르피오=liao(랴오)**다. 최신 정의와 Sound의 로딩/피격/사망 경로를 다시 계측해 세 인물 모두 유효한 녹음 묶음 사용을 확인했다. 이번 전달은 그 배분을 보존한다.

예전 f29ed817 기준 점검에서는 롤랑·베르나르도=tome, 백린=존재하지 않는 renji였다. 이것은 **해결 전 이력**이며 현재 오류로 보고하지 않는다. `voice-audit-historical.json`을 참조. 당시 우리의 분산 제안(롤랑→랴오/백린→브론/베르나르도→오마리)은 사용자 확정안이 아니며 최신 수신 배분을 덮어쓰는 지시가 아니다. `voice-proposal-historical.json`은 과거 연구 기록이다. 두 배분 모두 기본·얼터를 한 인물로 세면 토메3/하인리히·랴오·브론·오마리 각2로 인원 분산은 같다. 실제 등장 빈도까지 같다는 뜻은 아니다.

현재 계측 `voice-audit-current.mjs`/`.json`은 실제 시트·Sound 분기 사용, 디코딩/출력 노드는 모의 구현이다. 실제 사람 청취/스피커 평가로 표시하지 않는다. 과거 서로 다른 음성 ID라도 랴오와 하인리히는 같은 원본 녹음 계열이라는 점은 여전히 유효하다.

## 검증과 공개 자료

- 최신 수신본에서 섬네일 생성기를 실제 실행해 승인 마스터와 바이트 동일 확인.
- 실제 카드 844×390 /568×320 /1280×800에서 새 섬네일과 이름/설명·등급, 넘침/페이지 오류 확인. 원자료 `cards/`.
- `npm run build` 결과 `build.log`; 기존 번들 크기 경고는 유지. 새 물리 변경이 없어 대련 반복은 하지 않았다.
- `verification.json`은 승인 에셋/음원 해시·관련 런타임 보존과 전체 변경 파일을 기록한다.
- C2는 이전 공개 비교판에서 브라우저 디코딩/재생 확인한 정확한 바이트다. **C2 실제 전투 믹스·중복 소리·폰 스피커 손맛은 미검증**이며 우화의 적용 작업 범위다.

[확정 원형1안·다른 시안 비교](https://yoonjl-svg.github.io/halfsword-codex/encounters/whip-variants-20261024/): 2안 촘촘 코일과 수정8자3안은 미선택이다. 8자는 잘못된 분기/단절을 고쳤지만 최종 사용 대상은 아니다. 마스터/수정 이력은 우리 main의 `art/weapons/druid_whip_variants_20261024/`에 보존했다.

[C2 포함 CC0 청취판](https://yoonjl-svg.github.io/halfsword-codex/encounters/whip-cc0-20261024/) · [C2 단발 직접 듣기](https://yoonjl-svg.github.io/halfsword-codex/encounters/whip-cc0-20261024/audio/C2-single.mp3).

우화 저장소 직접 쓰기는 하지 않는다. 발송과 실제 열람·본판 채택은 별개이며 메시지 영수증을 확인한다.
