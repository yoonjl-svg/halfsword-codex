# 완전히 떨어진 상자 부품의 잔류 충돌 · 2026-10-08

**실제 동적 무기에서 `setEnabled(false)`만 한 완전 제거 상자 부품이 계속 접촉력을 내는 결함을 확인했다.** `Fighter.trimSword`의 해당 분기에 `setCollisionGroups(0)` 한 줄을 추가한 후보는 같은 통제 장면에서 절단 뒤·부활 유령 상태·복원 뒤의 반응이 모두 0이었다. 공 부품의 기존 질량0 처리, 잔존 부품, 무기 질량·무게중심·관성은 유지됐다. `revive.js` 수정은 없다.

- 기준 HEAD: `5014a54b23037106512ece79d7e7baf56a60178f`; npm Rapier `0.19.3`. 실제 실행은 2026-10-07 UTC, 문서 날짜는 KST다.
- [검사 도구](../../tools/sim/broken_collider_20261008.mjs), [기계 판독 기록](broken_collider_20261008.json). 원자료·실행 도구 스냅샷·소스 SHA256은 JSON에 보존했다.
- 이 작업의 출발점은 이미 허용 회차에 작성한 [우리 검토 기록](../dev_exchange/reviews/2026-10-08-peer.md)이다. 상대 파일·원격·수신 원본을 새로 열거나 상대 수치를 우리 측정값으로 쓰지 않았다.

## 진단과 반례

엔진 중력 `-9.81m/s²`, 현재 시간 간격 `1/120s`, solver6을 사용했다. primitive fixture는 마찰·반발0, 질량1kg probe를 `vx=-1m/s`로 겹친 상자에 접근시켰다. 고정 소유 몸체와 동적 소유 몸체를 구분하고, 새로운 겹침과 이미2step 접촉한 쌍 각각에 활성/비활성/비활성+그룹0 세 조건을 측정했다. 각 조건16step, 뒤의12–15step도 따로 확인했다. 게임 소스의 물리 계수를 바꾼 것은 아니다.

| 소유 몸체·조건 | 새 접촉 최대 충격량 / probe Δvx | 기존 접촉 최대 충격량 / probe Δvx | 판정 |
|---|---|---|---|
| 고정·활성 | 1.092536 Ns / 1.092536 m/s | 동일 | 양성 대조 |
| 고정·비활성 | 0 / 0 | 0 / 0 | 정상 비활성. 최초 반례를 보존 |
| 고정·비활성+그룹0 | 0 / 0 | 0 / 0 | 반응 없음 |
| 동적·활성 | 0.728357 Ns / 0.728357 m/s | 0.742474 Ns / 0.742474 m/s | 양성 대조 |
| 동적·비활성 | **0.527156 Ns / 0.527156 m/s** | **0.742474 Ns / 0.742474 m/s** | 실제 반응. 새 접촉은12–15step에도 지속 |
| 동적·비활성+그룹0 | **0 / 0** | **0 / 0** | 반응 제거 |

동적 비활성 조건은 측정 중 같은 handle이고 `isValid=true`, `isEnabled=false`였다. 현재 contact-force event와 probe 속도 변화가 함께 기록되므로 오래 남은 manifold만 본 결과가 아니다. 소유 몸체의 속도·질량도 매step 기록했다. 동적 활성 대조와 비활성 대조의 native 질량 갱신까지 동일하다고 가정하지 않았다. 핵심 A/B는 같은 비활성 상태에서 그룹0 여부다.

## 실제 `Fighter.trimSword` 비교

기존 실험용 무기 Morgenstern의 `cutY=.385m`를 사용했다. 한 번의 실제 `trimSword` 호출로 자루 일부 유지, 끝 공 유지, 금속 고리 상자 완전 제거, 머리 공 완전 제거가 함께 실행된다. 손목 관절을 제거하고 다른 신체는 멀리 둔 채, 같은 무기·probe 위치와 속도로 각 구간을 시작했다. 실제 무기 collider가 요청하는 physics hooks에는 미등록 probe에 대한 보통 충돌 응답1을 반환했다. 이는 해당 probe에서 production `Combat.filterContactPair`와 같은 분기 결과이며, 피해 판정이나 자연 전투를 재현한 것은 아니다.

| 구간 | 수정 전16step | 후보16step |
|---|---|---|
| 절단 직후 | 매step 실제 force·Δvx, 최대0.004889005 Ns / 0.004889011 m/s | force·Δvx·제거 부품 manifold 모두0 |
| 실제 ghost 진입 뒤 | 같은 잔류 반응 | 모두0 |
| 실제 ghost 종료 뒤 | 같은 잔류 반응 | 모두0 |

수정 전후의 활성 양성 대조2step은 프레임 전체가 정확히 같았다. 각50step 전체의 무기 질량·무게중심·관성과 잔존 두 collider 상태가 정확히 같았고, 후보의 제거 부품은 같은 유효 handle·비활성 상태를 유지했다. 절단 후 질량 `0.362903237kg`, local COM y `0.107022211m`다. 완전 제거 상자의 collider 내부 질량0.1kg은 그대로여도 native 몸체 질량에서는 이미 제외된다. 따라서 이 값이나 질량 계산을 추가로 바꾸지 않았다.

ghost 중 그룹 값 `0→1`은 membership가 여전히0이므로 충돌 재활성화가 아니다. 이번 실제 호출도 반응0이었다. 부활 전에 이미 절단된 경우의 진입/종료만 확인했으며, ghost 진입 후 새 절단이나 칼 회수·재부착 경로를 실행하지 않았다. 이를 새로운 부활 결함으로 단정하거나 범용 helper/filter 수정을 덧붙이지 않았다.

## 보존·재현과 한계

성공4실행은 고정 primitive102 + 동적 primitive102 + 실제 함수 기준50 + 후보50 = **304 native step**이다. 최초 실제 Fighter 실행 `fighter01`은 요청된 physics hooks를 생략한 계측 오류로 첫 native step 전에 실패했다. cleanup의 borrow 예외가 원 예외를 가렸으며 이 실패 원자료도 보존했다. hooks를 제공한 `fighter02`와 후보는 같은 도구 바이트로 완료됐다. 무거운 전투 sweep이나 브라우저 실행은 하지 않았다.

```sh
node tools/sim/broken_collider_20261008.mjs --mode=api --out=/tmp/collider-api-fresh
node tools/sim/broken_collider_20261008.mjs --mode=dynamic --out=/tmp/collider-dynamic-fresh
node tools/sim/broken_collider_20261008.mjs --mode=fighter --out=/tmp/collider-fighter-fresh
python /workspace/halfsword-handoff/phase4-progression-20261008/colliders/comparison01/DERIVE.py
```

각 `--out`은 없는 디렉터리여야 한다. 마지막 명령은 기존 원자료만 읽는15조건 파생 감사이며 물리를 재실행하지 않는다. `measurementPass`는 측정 완료·소스 안정성 판정이며 결함 부재를 의미하지 않는다. 별도 `comparison.json.accepted=true`가 후보의15조건 통과다.

자연 파손 빈도, 전투 승률, 모든 무기·부활 경로, 시각적 절단 결과는 이번 결론에 포함하지 않는다. 실제 `trimSword`를 직접 호출했으며 `breakWeapon`의 확률·시각 효과·무기 길이 변경 전체를 실행한 것은 아니다. 이번 수정은 완전 제거된 상자 collider의 접촉 제외 한 줄에 한정한다.
