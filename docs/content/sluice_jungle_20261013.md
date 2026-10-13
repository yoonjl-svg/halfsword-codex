# 잠든 밀림 — 식생 중심 보강 ·2026-10-13 KST

기준 `fae9b39257b4753212e4f6292ede3cff76a7c7fd`. 사용자가 ‘잠든 물길’보다 식생과 울창한 밀림 한복판의 느낌을 요청했다. 표시명은 우선 **잠든 밀림**, 내부 ID/주소는 `sluice`로 유지한다. 찬다의 외형·무기·목소리는 변경하지 않는다.

## 관찰 → 변경

넓은 갈색 바닥·곧은 포장길·노출된 수문 직사각형이 공터처럼 읽혔다. 높은 수관을 안쪽으로 겹치고, 중층 큰 잎과 늘어진 덩굴·불규칙한 낮은 식생을 보강했다. 수문 한쪽 기둥과 윗부분은 잎에 가려지고, 포장은 좁게 끊어진 흔적으로 줄였다. 흙은 그늘진 올리브 갈색으로 조정했다. 첫 보강 촬영에서도 앞쪽 하늘이 넓어 보였으므로 정면의 수관을 한 번 더 낮췄다. 그 결과 아래 면이 검은 천장처럼 보이는 문제가 생겨50cm 올리고 색을 밝히며 아래 경계에 잎을 드러냈다. 사선 시점에서도 덩어리가 과해 수관 각각의 너비를 약27% 줄여 틈을 확보했다. 땅에는 같은 텍스처 안의 절제된 낙엽 흔적을 추가했다.

6.5m 결투 영역과 기존 물리 지형을 유지한다. 낮은 식생은8.5m 바깥, 줄기/덩굴은 카메라 영역 바깥에 배치했다. 큰 잎의 중심을15m 밖으로 제한해 잎 끝도 카메라 영역으로 뻗지 않도록 했다. 새 투명 겹침·텍스처·사운드는 추가하지 않는다. 별도 RNG와 기존 병합 재질을 이용한다.

## 검사와 범위

무대 검사/실제 장면 촬영과 동일 빌드 로컬→공개 모바일 흐름으로 검증한다. 이전에 통과한 찬다 외형·음원 합성 검사는 해당 소스가 그대로이므로 재실행하지 않는다. 계정 회귀는 Pages 필수 검사에서 다시 실행된다. 자원 수치와 통과 결과는 별도 공개 영수증을 따른다. 소프트웨어 렌더러 결과를 실기기 FPS나 사용자 미적 수락으로 주장하지 않는다.

```sh
mkdir -p /tmp/halfsword-sluice-dense-20261013
STAGE_BASE=http://127.0.0.1:4182 node tools/browser/frozen_bay_scene_20261010.mjs sluice /tmp/halfsword-sluice-dense-20261013
npm run build -- --outDir /tmp/halfsword-sluice-dense-build-20261013
# 빌드 정적 서버4209 실행 후:
node tools/browser/sluice_delivery_20261013.mjs --base=http://127.0.0.1:4209/ --build=/tmp/halfsword-sluice-dense-build-20261013 --out=/tmp/halfsword-sluice-20261013/dense/local
node tools/browser/sluice_delivery_20261013.mjs --base=https://yoonjl-svg.github.io/halfsword-codex/ --build=/tmp/halfsword-sluice-dense-build-20261013 --out=/tmp/halfsword-sluice-20261013/dense/public --local-evidence=/tmp/halfsword-sluice-20261013/dense/local/report.json
```

검사 첫 실행은 출력 폴더를 만들지 않아 기록 저장 단계에서 실패했다. 폴더 생성 후 같은 명령으로 재실행했으며 게임 결함과 구분한다. 검증 예산110,000삼각형/40draw call은 이전 문턱을 유지한다.

촬영 보조 도구는 대기 옵션을 두 번째 인자로 전달하여 의도한60/120초가 아닌 기본30초로 동작했다. 마지막 촬영에서 시간 초과가 발생해 세 번째 옵션 인자로 바로잡고 단독 재실행했다. 실제 전달 도구의90초 대기와 검증 기준은 바꾸지 않았다.
