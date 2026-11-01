# 이탈리아 시험 정본 목록

본문 비교는 **seeded108개(54쌍)**를 사용합니다. 입력 내성은 inputs72개, 경로·심화 효과 분해는 paths72개+perks36개입니다. 이 주 자료288개와 진단·검증117개를 합한405개를 독립 표본으로 풀링하지 마십시오. 초기에 거리만 점검한 exploration2개는 본문 비교에서 제외했습니다. 총 새 world 실행은407개입니다.

| 묶음 | 용도 | 시행 | 계산 명령 벽시간(초) | 원본 |
|---|---|---:|---:|---|
| cooldown_validation | cooldown_observation | 3 | 6.616 | [JSONL.gz](cooldown_validation/raw.jsonl.gz) |
| exploration/imbro_close | excluded_early_exploration | 1 | 4.696 | [JSONL.gz](exploration/imbro_close/raw.jsonl.gz) |
| exploration/imbro_edge | excluded_early_exploration | 1 | 3.141 | [JSONL.gz](exploration/imbro_edge/raw.jsonl.gz) |
| inputs | input_tolerance | 72 | 67.996 | [JSONL.gz](inputs/raw.jsonl.gz) |
| matrix | diagnostic_deterministic_repeats | 108 | 119.133 | [JSONL.gz](matrix/raw.jsonl.gz) |
| paths | input_path_sensitivity | 72 | 60.573 | [JSONL.gz](paths/raw.jsonl.gz) |
| perks | I8_ablation | 36 | 39.416 | [JSONL.gz](perks/raw.jsonl.gz) |
| pilot | initial_pilot | 3 | 5.507 | [JSONL.gz](pilot/raw.jsonl.gz) |
| pilot_validated | validated_pilot | 3 | 3.240 | [JSONL.gz](pilot_validated/raw.jsonl.gz) |
| seeded | primary_paired_comparison | 108 | 185.521 | [JSONL.gz](seeded/raw.jsonl.gz) |

모든 원본 gzip을 해제한 바이트의 SHA-256과 압축 파일의 SHA-256을 검증했습니다. 각 폴더의 archive.json과 [archive_manifest.json](archive_manifest.json)에 해시·용량·명령·시행 수가 있습니다. 모든 실행은 baseline, humanInput=true, 사람 기력 회복25, 정상피해 적용을 확인했습니다. 기존 고정 명령 matrix의108개는 실제 서로 다른 입력 궤적이7개뿐이므로 독립108개로 해석하지 않습니다.

초기 pilot/검증pilot/matrix 및 exploration의 운전기 코드는 당시 manifest의 SHA-256과 완전히 같은 snapshot을 보존했습니다. 초기 단계에는 공통 관측부를 별도 복사하지 않았으므로 그 core snapshot은 미보존입니다. 주 정본4묶음 및 최종 식힘 검증의 core는 실행 시점에 복사하고 manifest 해시를 검증했습니다. 연구 도중 공통 관측부의 운동 시작 기록 개선 전후 버전도 이 snapshot으로 구분됩니다. 원본의 대상 기술 requestAccepted/executed는 이탈리아 운전기의 별도 요청·운동 상태 관측입니다.

최종 식힘 관측판과 앞선 검증pilot의 실제 피해·기력·입력궤적·생리 사건·실행 시각이 완전히 같음을 확인했습니다. 추가된 telemetry는 물리를 바꾸지 않았습니다.

```sh
gzip -dc docs/research/attack_balance_20261101/italian/seeded/raw.jsonl.gz > /tmp/italian-seeded-raw.jsonl
node docs/research/attack_balance_20261101/italian/analyze.mjs
```

정확히 과거 명령을 재현할 때는 별도 baseline 작업 사본의 원래 tools/sim 경로에 해당 run의 code_snapshot.mjs와 core_snapshot.mjs를 복원하고 manifest의 명령을 실행하십시오. 현재 운전기의 마지막 변경은 식힘·제어 가능 상태 telemetry와 KO 중복 집계 방지입니다. 실제 새 손/발 입력 반응 시간은 미측정(null)이며, 자연판과 사람 손 입력 기록도 이 자료에는 없습니다.
