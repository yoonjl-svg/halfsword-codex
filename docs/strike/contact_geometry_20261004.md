# 청강검 접촉 형상 · 선택형 비교

2026-10-04. **큰 베기와 의도된 관성을 보존하면서 부딪힌 뒤 검날 뒤집힘을 줄이는 것**이 목적이다. 기준 `9bac477fbc66c89cba761962c08d788578c02841`; 변경 파일·실제 입력·엔진·명령·원자료 SHA는 [JSON](contact_geometry_20261004.json), 실제 공개 상태는 [전달 영수증](contact_geometry_release.json)을 따른다.

질량 중심을 두 번 이동한 오류는 없었다. 기존 직육면체 충돌 형상은 의도된 단순화다. 청강검의 보이는 칼날 정점으로 **같은 collider의 볼록 포락면**만 구성했다. 무게·관성·재질·힘·그립·손 외형을 유지하며 플레이어 청강검/한손 팔 B/`bladeShape=profile`에서만 켠다. 일반판과 상대는 기존 형상이다.

| 검사 | 기존 → 형상 후보 |
|---|---|
| 같은 첫 충돌의 한 스텝 날 회전 | 23.209° → 1.550° |
| 일반 찌르기 경로의 접촉 구간 축속도 최대 | 32.847 → 14.505rad/s |
| 해당 접촉 구간 손 목표 오차 최대 | .2424 → .2584m |
| 접촉 뒤 후속 베기 칼끝 속도 최대 | 9.824 → 9.448m/s |
| 무접촉 큰 베기516스텝 | 물리 상태·제어·사건 전부 exact |

첫 행은 공개 보류된 **청강검 steady 찌르기**의 저장 충돌 직전에서 형상만 바꾼 진단이다. 이를 공개판에 되살리지 않는다. 나머지는 **일반 legacy 찌르기**를 사용하는 생성부터9초 실제 전투다. 입력은1080스텝 동일하고848 첫 접촉부터 물리/AI 경로가 갈라진다. 이후 peak 차이는 같은 상태의 수용 증명이 아니다. 접촉 전 탭의 전체 최대34.027rad/s는 그대로이며, 손 추종 약16mm 증가와 칼끝 peak 약3.8% 감소도 남는다. 이후 베기960–1079의 손 오차 .1816→.1802m, 칼끝 속도/모바일 동작은 별도로 확인한다. 기립·상처 동일을 인간 동작 수락으로 쓰지 않는다.

연구→실제 공개 npm 엔진/런타임의 자유 베기·전투·국소 충돌 반복은 동등성 검사다. 독립 효능 표본으로 더하지 않는다. shape 적용 전후 실제 질량/COM/관성·그립·몸 상태·충돌 metadata와 도메인8검사를 확인했다. 법선 레버 약8.44mm와 작은 축 관성은 원인 단서이며, 미제공 접선 basis/관절 결합까지 닫힌 충격량 장부로 주장하지 않는다. 독립 좌표/질량 감사와 공개 범위 검토는 외부 자료 SHA로 연결했다.

**판정:** 청강검 접촉 형상만 선택형 비교한다. 전체 급회전 해결·일반 승격은 아니다. 속도 유지/손목 전체 모터 이전·실패 지지/절삭/새 손은 계속 철회한다. [폰 A/B](https://yoonjl-svg.github.io/halfsword-codex/feature-lab.html#blade-shape-comparison)에서 부딪힌 뒤 다시 베어, 날 뒤집힘과 다음 베기의 어색함을 비교한다. 실제 기기의 체감/자연스러움과 메이저 일반 적용은 사용자 확인이 남는다.

```sh
node tools/sim/experiments/blade_shape_contract.test.mjs /tmp/NEW-shape-contract.json
node tools/sim/experiments/qinggang_contact_probe.mjs --reference=/workspace/halfsword-handoff/onehand-thrust-20261004/no-tap-run03.json --out=/tmp/NEW-shape-free.json --modes=observe,geometrySpawn --tick=0 --after=515 --edge=original
node tools/sim/experiments/qinggang_contact_probe.mjs --reference=/workspace/halfsword-handoff/onehand-thrust-20261004/contact-tap-run06.json --out=/tmp/NEW-shape-live.json --modes=observe,geometrySpawn --tick=0 --after=1079 --edge=original
node tools/sim/experiments/qinggang_contact_probe.mjs --reference=/workspace/halfsword-handoff/onehand-thrust-20261004/contact-tap-run06.json --out=/tmp/NEW-shape-contact.json --modes=observe,geometryHull --tick=965 --after=1
```

고정 소스/외부 reference·해시를 준비하고 새 출력으로 실행한다. 외부 raw/엔진은 Git에 없으므로 checkout만으로 완전 재현 가능하다고 주장하지 않는다. `bladeShape`를 주소에서 제거하면 기존 방식으로 돌아간다. 다음30–45분은 저장된 **접촉 이전 탭831스텝**의 회전과 첫 접촉을 구별해 실용적인 다음 경로1개를 고른다. 전체2단계 P-03/P-04 진행 중이며 P-01~P-06 어느 항목도 전체 완료가 아니다.
