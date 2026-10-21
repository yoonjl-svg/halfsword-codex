# C-PORTRAITS-FINAL-20261018 — 확정 초상·그리드·액자 전달

우화에게. 사용자 “이렇게 확정하자 그리드 그려진 것까지 포함해서 우화에게 보내”에 따라 최종 자료를 보냅니다. **미나미는 B안의 화면 왼쪽 눈을 오른쪽 한 셀 옮긴 결과로 확정**했습니다.

## 1. 기준과 결과

| 구분 | 고정 커밋 |
|---|---|
| 수신 최신 main | `32b4dabaa0c2d3f2149d793e2b93516ba585db92` |
| 제작 원본 | `b6048dd379900877169d1d9e8e73f4999c2601e0` |
| 에셋 묶음 | `28e7d9d9cfb481e42bb26951ec040cef1e07b511` |
| 전달 최종 결과 | `f0f8fc45b0297fb1fe8d2811a6a15b60004aee06` |

발행 직전 `2026-10-18T07:31:26.459992+00:00`에 수신 main과 전달 원격 가지를 재확인했습니다. 전달 가지는 [`codex/portraits-handoff-20261018`](https://github.com/yoonjl-svg/halfsword-codex/tree/f0f8fc45b0297fb1fe8d2811a6a15b60004aee06), 수신 최신 main에서 시작한 2개 독립 커밋입니다. 우화 저장소에 쓰지 않았습니다.

## 2. 확정 파일

- 기본 18(플레이어1 정면·플레이어2 최초 측면 포함) + 얼터 16 = **34개 초상**.
- 각 인물 `original.png` + `low.png` + **선을 실제로 그린 `grid.png`** = 102개 PNG.
- 1254² 정사각형, low 인물 22×22 셀/50px/원점77,77. 공통 액자1은 고해상도 세부 유지. low의 인물 뒤와 바깥은 진짜 PNG alpha입니다.
- 원본은 고화질 마스터로 보존하고, **128 low가 새 기준**입니다. 예전 4px low와 혼동하거나 다시 생성하지 마세요.
- 액자1·2·3 원본 시트 및 개별 724² 디자인 파일도 포함. 실사용 공통 액자1은 별도 투명 PNG. 액자2·3은 디자인 원본으로 바탕이 포함됩니다.
- 편집 셀 JSON, 재현 도구, 파일별 해시/크기, 검증과 화면 캡처도 묶었습니다.

[전체 인계서](https://github.com/yoonjl-svg/halfsword-codex/blob/f0f8fc45b0297fb1fe8d2811a6a15b60004aee06/docs/art/pixel_profiles_handoff_20261018/HANDOFF.md) · [파일 목록/해시](https://github.com/yoonjl-svg/halfsword-codex/blob/f0f8fc45b0297fb1fe8d2811a6a15b60004aee06/docs/art/pixel_profiles_handoff_20261018/inventory.json) · [32개 수신 인물 ID/경로 대응](https://github.com/yoonjl-svg/halfsword-codex/blob/f0f8fc45b0297fb1fe8d2811a6a15b60004aee06/docs/art/pixel_profiles_handoff_20261018/integration.json) · [그리드 켠 전체 검토 페이지](https://yoonjl-svg.github.io/halfsword-codex/encounters/pixel-profiles-low128-20261017/?grid=1) · [액자 1·2·3](https://yoonjl-svg.github.io/halfsword-codex/encounters/pixel-profiles-low128-20261017/frame-options/)

## 3. 최신 외형 선택

미나미 최종 B의 눈 오른쪽 이동, 아르토리아 얼터 원래 눈 모양 보존+낮은 눈 한 셀 상승, 이졸데 얼터 눈 대칭 보완, 랴오 얼터 명확한 얼굴 색면, 브론 양눈 한 셀 상승, 마야 얼터 명암 보강을 반영했습니다. 찬다·병마용은 사용자가 더 좋아한 이전 격자판을 유지했습니다. 플레이어1/2도 같은 격자와 액자로 통일했습니다. 가림 설정은 유지하고 기본 병마용은 토우입니다.

## 4. 수신 연결 확인

현재 수신 `src/portraits.js`는 **원본 기본**, `?portrait=low`는 옛 4px판, 얼터는 `variantOf`로 기본 초상 공유라는 것을 확인했습니다. 이 설정을 이번 전달이 자동으로 바꾸지는 않습니다. 새 에셋/검토 페이지 추가만 있으며 `src` 트리는 수신 기준과 동일합니다.

새 자산 연결 시 `player -> player1`, `player2`는 선택 가능한 별도 각도입니다. 얼터 전용 초상을 적용할 때는 기본 공유 fallback보다 명시적인 `_mad` 파일을 먼저 조회하면 됩니다. 관련된 실제 32개 인물 ID를 모두 대응했습니다.

`grid.png`는 검토용입니다. 실제 게임에는 **선을 그리지 않은 low.png**를 사용합니다. `encounters`는 현재 PWA 설치 캐시에서 제외됩니다. 채택할 실제 게임용 low/원본 파생본만 새 파일명으로 `ui/portraits/`에 옮기고 PWA를 다시 빌드하세요. 큰 원본/그리드는 설치 캐시 밖에서 보존합니다. 전체 CSS를 pixelated로 강제하면 고해상도 액자도 거칠어지므로 자동 보간/정사각 크롭으로 액자 세부를 유지하는 편을 권합니다.

## 5. 검증

- 34 low의 고정 셀·공통 액자, 34 원본 해시 보존, 34 그리드 PNG 확인.
- 수신 최신판 위에서 102 PNG 디코드, 휴대폰390/데스크톱1200, 34/18/16 필터, 상세 비교, 그리드 다운로드·세 액자 확인.
- 기존 `tools/sim/portraits.test.mjs` **2개 통과**, `npm run build`와 PWA 빌드 통과. 기존 연결 유지 확인.
- 새 프로필의 실제 대기실/패배창 기본 연결은 아직 하지 않았습니다. 이 검증을 그 연결의 사용성 시험으로 확대하지 않습니다.

[브라우저 검증](https://github.com/yoonjl-svg/halfsword-codex/blob/f0f8fc45b0297fb1fe8d2811a6a15b60004aee06/docs/art/pixel_profiles_handoff_20261018/browser-verification.json) · [수신판 검증](https://github.com/yoonjl-svg/halfsword-codex/blob/f0f8fc45b0297fb1fe8d2811a6a15b60004aee06/docs/art/pixel_profiles_handoff_20261018/recipient-verification.json)

## 6. 가져오기와 되돌림

```sh
git fetch https://github.com/yoonjl-svg/halfsword-codex.git codex/portraits-handoff-20261018
git cherry-pick 28e7d9d9cfb481e42bb26951ec040cef1e07b511 f0f8fc45b0297fb1fe8d2811a6a15b60004aee06
```

에셋/문서만 추가하는 전달 범위입니다. 전체 작업 가지나 `dev-exchange`를 게임 가지에 병합하지 않습니다. 되돌릴 때는 위 두 커밋을 역순으로 revert하면 됩니다. 저장 데이터 변경은 없습니다. 사용자 확정과 기술 검증은 완료했고, 우화의 실제 열람/채택 여부는 별도입니다.
