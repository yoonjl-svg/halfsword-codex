# 베르나르도 프로필 복식 확정본 — MSG-S-014 답신

사장님이 수정 그림을 보신 뒤 **“good. 우화에게 보내.”**라고 승인하셨습니다. 얼굴·머리·수염·확정 눈매는 보존하고 **흰 금테 겉옷, 금관을 쓴 검은 사자, 금빛 망토**를 반영한 최종본입니다. 참고 시안 C가 아닌 새 승인본입니다.

## 기준과 적용 단위

- 수신 main 기준: `323ad40fc042717255c153e272e791226ae52ae6`.
- 전달 가지: `codex/bernardo-profile-handoff-20261024`. 이 기준 위의 독립 커밋 하나입니다. 최종 SHA는 교환 메시지에 고정합니다.
- 승인 그림 원본: `82c606873fe812ed7cb5bb59a647a650e05faca0`의 `public/encounters/bernardo-profile-20261024/`.
- 원본/low/grid PNG 3장은 승인 파일의 바이트 그대로입니다.
- 수신 ID `bernardo`, 편집 자료 키 `black_king` 연결을 유지합니다. `manifest.source.commit`은 최초 3인물 묶음 출처이며, 이번 후속 출처는 베르나르도의 `revision.sourceCommit`에 별도로 기록했습니다.

## 변경 파일과 연결

- `art/hero-profiles-20261024/bernardo/{original,low,grid}.png`.
- 같은 폴더의 `sprites.json`: `characters.black_king`만 교체. 롤랑/백린 자료는 동일합니다.
- `manifest.json`: 베르나르도와 셀 자료의 해시·출처 갱신.
- `public/ui/portraits/bernardo.webp`: 기존 변환 규칙 그대로, low에서 768² LANCZOS/WebP 품질95·alpha100·method6. 약30KB.
- 이 문서 폴더: 단독 `sprite.json`, 복식82셀 전후 `cell-edits.json`, 얼굴 보호/복식 마스크, 승인 비교 그림, 검사 결과와 실제 화면.

게임 소스·대기실 기능·3D 모델·무기·전투 수치 변경은 없습니다. 최신 뒤랑달과 수신측 모델 변경을 보존합니다. 기존 베르나르도 프로필 경로를 사용하므로 별도 등록 코드는 필요하지 않습니다. 저장 형식도 동일합니다. 원본 PNG를 게임용 WebP로 덮어쓰지 마세요.

## 재현과 검증

```sh
python3 -I tools/ui/hero_profiles_verify.py
node --test tools/sim/portraits.test.mjs
npm run build
```

- 기존 수신측 검사: 14개 파일 해시·9개 PNG, 공통 액자, 22×22/50px/원점(77,77) 셀 재구성, grid 재구성, 지정 눈끝(13,7)/(16,8) `#4F3829`, 게임 WebP 변환 일치 통과.
- 프로필 연결 시험 4/4 통과. 빌드/PWA 성공. 기존 대형 묶음 경고는 남습니다.
- 실제 수신 기준의 이전 원본/low와 비교해 머리·얼굴 보호 영역, 투명도 보존 확인(`integration.json`). 제작단계 검사는 `authoring-validation.json`입니다.
- 브라우저는 수신측 `hero_profiles_shots.mjs`를 베르나르도 한 명으로 한정한 `browser.mjs`로 확인합니다. UI 연결 확인용 강제 패배이며 전투 성능 시험이 아닙니다. 대기실·일반 패배 2곳에서 새 768² 그림이 정상 표시됐습니다. 방랑은 저장 주입 뒤 입장 대기에서 120초 시간 초과해 결과창 검증을 완료하지 못했습니다(그림 비교 실패가 아님). 이 제한과 원문 로그 `browser.txt`, 통과한 실제 화면 PNG를 함께 보냅니다.
- low 사자 무늬는 고정된 큰 셀에 맞춘 단순화입니다. 사용자 승인 이후 다시 그리거나 셀을 잘게 쪼개지 않았습니다.

[승인 원본과 low](original-low.png) · [실제 대기실](lobby_bernardo.png) · [검토 페이지](https://yoonjl-svg.github.io/halfsword-codex/encounters/bernardo-profile-20261024/)

## 되돌림과 상태

이 전달 커밋 하나를 revert하면 이전 마스터·셀 자료·manifest·게임 WebP가 함께 돌아갑니다. 옛 임시 마스터와 다른 인물 그림은 그대로 보존했습니다.

이 가지는 우리 저장소의 전달 준비본입니다. 상대 저장소에는 직접 쓰지 않습니다. 교환 메시지 발행 및 원격 검증과 우화의 실제 열람·본판 적용 여부는 구별합니다.
