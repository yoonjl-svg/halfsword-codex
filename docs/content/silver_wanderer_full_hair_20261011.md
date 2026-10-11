# 은발의 검사 · 원래 긴 머리 기반 숱 보강(v4)

기준 `27ba2a1`. 사용자가 v3 우쿄풍 머리를 “더듬이 같다, 원래가 낫다”라고 평가하고 더 풍성한 머리를 요청했다. **v3는 미채택**, 원래v2의 은회색 긴 머리와 현재 의상 장식을 기준으로 v4를 제작한다. 기존 얼굴/눈/몸/전투 수치는 그대로다.

## 변경·판정

가슴까지 고립되어 내려오던 두 앞머리를 짧게 되돌린다. 관자놀이→옆머리→어깨 뒤의 다발을 겹쳐 연결하고, 긴 뒷머리에는 속면과 넓은 다발을 더해 틈을 메운다. 두피 전체를 크게 키우는 대신 옆과 뒤의 밀도를 높였다. 머리 끝은 엇갈리게 두되 가는 바늘 형태가 반복되지 않도록 한다.

첫 렌더는 숱은 채워졌으나 뿌리의 잘린 단면과 두꺼운 다발 때문에 붙인 조각처럼 보였다. 뿌리를 두피 안으로 좁혀 넣고, 다발의 넓이는 유지한 채 두께를 줄였다. 앞머리까지 새로 두껍게 만드는 것은 피하고 원래v2의 정수리·가르마·얼굴 옆 머리 생성 함수를 그대로 재사용한다. 숱 보강은 그 뒤의 연결 면과 옆/뒷머리에서 한다. 이전 우쿄풍의 기술 검사 성공을 사용자 미적 수락으로 간주하지 않는다. v2는 비교 버튼으로 유지하고 미채택v3는 추천 입구에서 제공하지 않는다.

## 검증과 재현

- 촬영: `CAPTURE_IDS=silver_wanderer CAPTURE_VIEWS=front,threeq,back,detail,fittings CAPTURE_BASE=http://127.0.0.1:4280 CAPTURE_OUT=/tmp/halfsword-silver-20261011/full-hair/portraits-release node tools/browser/native_character_portrait.mjs`
- 게임 검사: `node tools/sim/experiments/silver_wanderer_gate.mjs /tmp/halfsword-silver-20261011/full-hair/native.json` (장식 유무의 물리 snapshot·공통 얼굴/눈·480step 실제 입력·합성 상처 후 부착)
- 빌드: `npm run build -- --outDir /tmp/halfsword-silver-20261011/full-hair/build`
- 모바일: `node tools/browser/new_pair_delivery_20261010.mjs --encounter=silver_wanderer --base=http://127.0.0.1:4290/ --build=/tmp/halfsword-silver-20261011/full-hair/build --out=/tmp/halfsword-new-pair-20261010/silver-full-hair-local`
- 공개는 같은 도구/빌드로 `--base=https://yoonjl-svg.github.io/halfsword-codex/ --out=/tmp/halfsword-new-pair-20261010/silver-full-hair-public --local-evidence=/tmp/halfsword-new-pair-20261010/silver-full-hair-local/report.json`.

9사진·320px 소개·진입/공격/이동/일시정지/재시작과 실제 공개 파일 해시를 확인한다. 카메라 사진은 실제 게임 메시를 표준 관찰 조명으로 촬영한다. 고정된 부위 장식이며 머리카락 물리, 모든 자세의 관통 방지, 실물 휴대폰 성능을 검증한 것은 아니다. 최종 수치는 [영수증](silver_wanderer_full_hair_release.json)에 기록한다.

최종 native8항목 통과,112메시/33,782삼각형(native 집계). 원래v2의31,274삼각형보다2,508개 늘었다. FPS 또는 실기기 성능 변화는 측정하지 않았다.

## 공개 결과

`e23d6a7` 공개 완료: native8항목·빌드·로컬/공개 모바일 각1흐름·9사진, 공개186파일 해시 일치·오류0. 원래v2 비교 사진의 해시도 보존됨을 확인했다. 휴대폰 검사는 Chromium 에뮬레이션이며, 최종 사용자의 미적 평가와 실기기 성능은 별개다. 정면/후면 독립 화면 검토에서는v3의 고립된 긴 앞머리가 없어지고 숱 증가가 보임을 확인했다.
