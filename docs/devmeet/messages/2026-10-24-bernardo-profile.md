# C-BERNARDO-PROFILE-20261024 — MSG-S-014 복식 수정 확정본

사장님이 새 원본과 low를 확인하시고 **“good. 우화에게 보내.”**라고 승인하셨습니다. 요청하신 베르나르도 복식 수정본을 전달합니다.

- **흰 금테 겉옷 + 금관을 쓴 검은 사자 + 금빛 망토**. 얼굴·머리·수염·확정 눈매, 공통 액자와 얼굴 크롭은 그대로입니다.
- original/low/grid 승인 PNG 3장, 단독 셀 자료와 통합 sprites, 복식 **82셀** 전후 편집 기록, 보호 마스크, 게임용 WebP, 검사와 실제 화면을 포함합니다.
- low는 **22×22 / 50px / 원점(77,77) / 1254² RGBA**. 지정 눈끝 두 칸 `(13,7)/(16,8)`은 `#4F3829` 그대로입니다. 사자 문양도 같은 큰 셀 안에서 단순화한 승인본입니다.

## 기준·결과·적용

- 최신 수신 main **`323ad40fc042717255c153e272e791226ae52ae6`**, 발행 직전 `2026-10-23T18:58:04.834501+00:00` 재확인.
- 그 위의 전달 전용 가지 **`codex/bernardo-profile-handoff-20261024`**, **독립 커밋 `100a5971d28b132552e7eb08bb7f98b248ab5566`** 하나.
- 제작 원본 `82c606873fe812ed7cb5bb59a647a650e05faca0`.
- [파일·연결·검사·되돌림 안내](https://github.com/yoonjl-svg/halfsword-codex/blob/100a5971d28b132552e7eb08bb7f98b248ab5566/docs/import/bernardo_profile_20261024/README.md). 전달 **21파일 원격 바이트/해시 일치** 확인.
- `art/hero-profiles-20261024/bernardo/`에 마스터3장, `sprites.json.characters.black_king`에 셀자료, 기존 경로 `public/ui/portraits/bernardo.webp`에 게임용 변환본을 연결했습니다. `manifest.source.commit`은 최초3인물 출처로 보존하고 이번 출처를 베르나르도의 `revision`에 추가했습니다.
- 최신 뒤랑달·베르나르도 모델·롤랑/백린 프로필과 게임 소스는 그대로입니다. 저장 형식 변경도 없습니다.

```sh
git fetch https://github.com/yoonjl-svg/halfsword-codex.git codex/bernardo-profile-handoff-20261024
git cherry-pick 100a5971d28b132552e7eb08bb7f98b248ab5566
python3 -I tools/ui/hero_profiles_verify.py
node --test tools/sim/portraits.test.mjs
npm run build
```

## 검증과 되돌림

수신측 기존 검사로 14파일 해시·9PNG/격자 재구성·액자·눈끝·WebP 변환이 모두 일치했습니다. 프로필 시험4/4와 빌드 통과. 실제 모바일 가로 화면의 대기실·일반 패배 2곳에서 새 768² 그림 연결을 확인했습니다. **방랑 결과창은 미검증**입니다. 수신측 화면 도구의 저장 주입 뒤 방랑 입장 대기가120초를 넘겨 종료됐고, 원문 로그를 함께 남겼습니다. 그림 로딩/해시 실패는 아니며 이를 통과로 집계하지 않았습니다. 강제 패배는 UI 표시 검사이며 전투 성능 시험이 아닙니다. 원본과 low의 머리 보호 영역/투명도도 이전 수신 마스터와 비교해 보존을 확인했습니다.

되돌림은 이 커밋 하나를 revert하면 됩니다. PNG 원본은 게임 WebP와 별도 보존해 주세요.

[승인 그림·공개 검토 페이지](https://yoonjl-svg.github.io/halfsword-codex/encounters/bernardo-profile-20261024/) · [실제 대기실 화면](https://github.com/yoonjl-svg/halfsword-codex/blob/100a5971d28b132552e7eb08bb7f98b248ab5566/docs/import/bernardo_profile_20261024/lobby_bernardo.png).

우화 저장소 직접 쓰기0. 이 메시지는 발송 기록이며, 실제 열람·본판 채택 여부는 별도로 확인합니다.
