# 은발의 검사 머리 변경 · v3

기준 `a1bece4`. 사용자 요청: 사무라이 쇼다운 우쿄를 참고한 머리, **기존 은회색 유지**. v2 의상/장식과 공통 얼굴/눈/체격·전투는 유지한다. v1/v2도 선택 가능하다.

## 근거와 적용

[SNK 공식 우쿄 원화](https://www.snk-corp.co.jp/official/samuraispirits/characters/ukyo.php)를 실제 열람했다. 드러난 이마, 치우친 가르마, 양볼 옆을 지나 가슴까지 내려오는 납작한 긴 앞머리, 뒤로 빗은 정수리를 참고했다. 처음 말한 높은 묶음은 원화에서 확인되지 않아 채택하지 않았다. 가려진 뒤통수의 결속 방식을 고증했다고 주장하지 않는다.

기존 등 뒤의 긴 머리와 그 위의 결을 함께 제외하고 목 뒤를 짧고 단정하게 정리한다. 새 머리는 머리에 붙은 곡면 띠로 제작해 공통 얼굴 메시를 건드리지 않는다. 앞머리를 높은 깃 바깥으로 배치했다. 첫 렌더의 깃 관통과 잘못된 표면 법선은 보완 후 다시 촬영했다. 정수리의 겹친 띠에서 생긴 뜬 가장자리와 불연속 하이라이트도 제거하고 머리 표면의 미세한 굴곡으로 정리했다. 옷과 뒤쪽 장식이 잘 보이도록 머리 윤곽을 좁혔다. 별도 머리카락 물리나 전 자세 관통 방지를 구현한 것은 아니다.

## 재현·판정

- 실제 모델 촬영: `CAPTURE_IDS=silver_wanderer CAPTURE_VIEWS=front,threeq,back,detail,fittings CAPTURE_BASE=http://127.0.0.1:4280 CAPTURE_OUT=/tmp/halfsword-silver-20261011/hair/portraits-release node tools/browser/native_character_portrait.mjs`
- 공통 물리/얼굴, 실제 입력480step, 합성 피격 후 부착 검사: `node tools/sim/experiments/silver_wanderer_gate.mjs /tmp/halfsword-silver-20261011/hair/native-release.json`
- 빌드: `npm run build -- --outDir /tmp/halfsword-silver-20261011/hair/build`
- 모바일: `node tools/browser/new_pair_delivery_20261010.mjs --encounter=silver_wanderer --base=http://127.0.0.1:4290/ --build=/tmp/halfsword-silver-20261011/hair/build --out=/tmp/halfsword-new-pair-20261010/silver-hair-local`
- 공개 검사는 같은 도구·빌드를 사용하고 `--base=https://yoonjl-svg.github.io/halfsword-codex/ --out=/tmp/halfsword-new-pair-20261010/silver-hair-public --local-evidence=/tmp/halfsword-new-pair-20261010/silver-hair-local/report.json`으로 수행한다.

9개 사진(현재5/최초2/직전 머리2),320px 소개, 카드 선택·공격·이동·일시정지/재개·재시작과 공개 파일 해시를 확인한다. 사진은 실제 게임 메시를 표준 관찰 조명에서 촬영한 것이며, 실물 휴대폰 성능·모든 전투 자세의 자연스러움·사용자 미적 수락까지 검증한 것은 아니다. 현재 결과는 [전달 영수증](silver_wanderer_hair_release.json)에 기록한다.

최종 native8항목 통과.108메시/28,082삼각형(native 집계)이며 직전v2의112메시/31,274삼각형보다 작다. 실제 FPS 개선 측정으로 해석하지 않는다.

## 공개 결과

`285d2a3` 공개 완료: native8항목·빌드·로컬/공개 모바일 각1흐름·9사진·오류0, 공개194파일 해시 일치. 모바일은 Chromium 에뮬레이션이며 실기기 성능 측정은 아니다. 오늘11일 교환 노트는 다음23:30 발행 대상 초안이다. 지난10일 발행분의 원격 해시 확인과 이번 Actions 성공을11일 발행 또는 상대 열람으로 표시하지 않는다.
