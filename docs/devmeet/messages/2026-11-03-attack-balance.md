# C-ATTACK-BALANCE-20261103 — 유파 공격 연구 전체 전달

사장님이 “개발일지 발행하고 조사 자료 우화에게 보내줘”라고 승인하셨습니다. 비기·특수·일반 고유19계열의 연구와 후속 등급 비교·J표를 모두 전달합니다. **실제 사람 성공률·확정 밸런스 패치로 보고하지 않습니다.**

## 최신 수신 기준 → 독립 결과

- 받는 쪽 최신 main `69609d345ef36c7d2ce18462b7205d2f8bae2d58`에서 전달 가지 `codex/attack-balance-handoff-20261103`을 만들었습니다. 준비 중 새 일지 커밋이 올라와 그 커밋으로 다시 맞췄습니다.
- 독립 결과/커밋 **`65dab6f1941e6d1d11ed9d90fb59a336debde079`**. 실험 기준 `6806a101`의 게임 기반은 `88a96061e8dd93e8f107b7b0df647a341e73fa5d`입니다.
- 기존 src238개·package/lock/하니스3개, 총241개가 수신 기준과 Git blob 동일합니다. 기존 게임 소스·수치·저장 변경0. 새 연구 probe는 전용 Vite에만 주입하며 본판 진입점에 연결하지 않습니다.
- 원 연구377파일178,971,455bytes 바이트 동일 + 인계/검증 자료. [인계/재현/되돌림](https://github.com/yoonjl-svg/halfsword-codex/blob/65dab6f1941e6d1d11ed9d90fb59a336debde079/docs/import/attack_balance_20261103/README.md), [호환성](https://github.com/yoonjl-svg/halfsword-codex/blob/65dab6f1941e6d1d11ed9d90fb59a336debde079/docs/import/attack_balance_20261103/compatibility.json), [파일해시](https://github.com/yoonjl-svg/halfsword-codex/blob/65dab6f1941e6d1d11ed9d90fb59a336debde079/docs/import/attack_balance_20261103/files.json).

```sh
git fetch https://github.com/yoonjl-svg/halfsword-codex.git codex/attack-balance-handoff-20261103
git cherry-pick 65dab6f1941e6d1d11ed9d90fb59a336debde079
```

이것은 자료와 연구 도구 전달입니다. 적용만으로 새 전투 동작이나 밸런스 보정이 활성화되지 않습니다. 실험 실행기는 고정 HEAD 가드가 있으므로 새 전달 HEAD에서 바로 실행하지 말고 인계서의 **88a96061 격리 작업 트리+도구 overlay** 방법을 따르십시오.

## 무엇을 조사했나

[전체 보고](https://github.com/yoonjl-svg/halfsword-codex/blob/65dab6f1941e6d1d11ed9d90fb59a336debde079/docs/research/attack_balance_20261101/README.md): 비기5+특수5+일반 고유9계열. 단발/조건684·자동입력내성456·최대 기준30초 대련120판, 별도 비기 잠재252·이탈리아 경로/심화108. 총1,620개 관측으로 독립 사람 표본 수가 아닙니다. 원시 입력·접촉·피해·생리·조건/실패·설정·도구 snapshot/hash와 정본/제외 목록이 있습니다.

사람 회복25/초·최대100·무한끔·비기1회/동방3회·특수 식힘3초를 지켰습니다. 한 번의 성능은 양측 상처/출혈/의식/사지/무장 상실·1초/5초 교환으로 보며 승패·30초 누적 피해만으로 드문 비기를 기각하지 않았습니다. 준비 베기를 목표 기술에 합치지 않았습니다.

## 검토 후보와 정정

- Cav의 접촉 갱신/이른 탭 소모는 사람 입력 손실 후보입니다. Inquartata의 보통 거리6짝은 준 상처0.940 대0.079·받은0.274 대0으로 공격적 교환 이득 후보입니다.
- 코테는 직접 상처0이지만 정적 단발18개 중 무장해제2회가 있었습니다. 효과 전체가0이라고 읽지 마십시오. 걸음 공격은 특정 거리의 칼길/적중 문제 후보입니다.
- 리솔루토·격살 머리/목 분기의 결정력, 어거·고노센의 한 번 보상 차이를 관측했습니다. 준비 부담·방어/제압·동방3회까지 포함한 판단이 필요합니다. [등급별 검토](https://github.com/yoonjl-svg/halfsword-codex/blob/65dab6f1941e6d1d11ed9d90fb59a336debde079/docs/research/attack_balance_20261101/GRADE_COMPARISON.md).
- `dead`에는 기절 패배가 포함됩니다. 모르트 가까움6건은 기절6·사망0입니다. 제비 베기 정적 미발동은 첫 칼 적중으로 조건이 없었던 것이며 대련에서는 발동/상처가 있었습니다.
- 초기 redondo 입력 차이·lianchi 논리 탭·화면 밖 좌표·부분 window/Rapier 오류는 보완/제외 목록에 명시했습니다. 같은 정적 궤적6반복은 독립 표본6개가 아닙니다.

## J표의 뜻

[최소/최대/평균/중앙값](https://github.com/yoonjl-svg/halfsword-codex/blob/65dab6f1941e6d1d11ed9d90fb59a336debde079/docs/research/attack_balance_20261101/ENERGY_TABLE.md), [CSV](https://github.com/yoonjl-svg/halfsword-codex/blob/65dab6f1941e6d1d11ed9d90fb59a336debde079/docs/research/attack_balance_20261101/energy_summary.csv), [154접촉 전수](https://github.com/yoonjl-svg/halfsword-codex/blob/65dab6f1941e6d1d11ed9d90fb59a336debde079/docs/research/attack_balance_20261101/energy_contacts.csv). **대련120판의 기술 이름이 붙은 몸 접촉당 에너지**입니다. 헛침 제외·무상처 둔타 포함, 격살4분기 합산. 여러 부위의 J를 더해 한 공격의 총에너지라고 부르지 않습니다. 이전 인콰르타타58.47J는 거리 통제6회로 분모가 다릅니다.

겹치기1470.57J·인콰르타타2257.42J·정수리4965.25J 등은 평균을 크게 올린 실제 관측 극단값이며 일반적인 위력이나 이론적 상한이 아닙니다. 삭제하지 않고 원본 시드/시각/부위/타격 종류를 보존했습니다. 중앙값과 실제 상처/기절을 함께 보며 별도 장면 검토가 필요합니다.

[19종 연습](https://yoonjl-svg.github.io/halfsword-codex/encounters/attack-balance-20261101/) · [휴대폰 결과표](https://yoonjl-svg.github.io/halfsword-codex/encounters/attack-balance-20261101/report.html). 저장 분리·SW/캐시 작업0·실제 JSON 다운로드·공개 HTTP/페이지 오류0 확인 자료도 포함합니다. 실제 휴대폰 손맛·인간 성공률은 미측정입니다.

되돌림은 위 독립 커밋 하나 revert, 저장 스키마 변경 없음. 우화 저장소 직접 쓰기0. 실제 열람·검토·채택은 아직 확인하지 않았습니다.
