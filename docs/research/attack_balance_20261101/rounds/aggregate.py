"""Validate the completed 96-round batch and derive exposure summaries.

Run from repository root:
  python docs/research/attack_balance_20261101/rounds/aggregate.py
"""
import hashlib
import gzip
import itertools
import json
import math
from collections import defaultdict, Counter
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean, median, variance, stdev

ROOT = Path('docs/research/attack_balance_20261101/rounds')
RAW = ROOT / 'full/rounds.jsonl'
if not RAW.exists():
    RAW = ROOT / 'full/rounds.jsonl.gz'
raw_bytes = gzip.decompress(RAW.read_bytes()) if RAW.suffix == '.gz' else RAW.read_bytes()
rows = [json.loads(line) for line in raw_bytes.decode().splitlines()]
expected = set(itertools.product(['italian', 'iberian', 'japanese', 'chinese'],
                                 ['natural', 'targeted'], ['pressure', 'spacing'], range(1, 7)))
actual = [(r['school'], r['mode'], r['opponent'], r['seed']) for r in rows]
source_hash = hashlib.sha256(Path('tools/sim/balance_rounds_20261101.mjs').read_bytes()).hexdigest()
checks = {
    'exact_96_unique_jobs': len(rows) == 96 and len(set(actual)) == 96 and set(actual) == expected,
    'all_valid': all(r['validity']['valid'] for r in rows),
    'same_current_source_hash': all(r['scriptHash'] == source_hash for r in rows),
    'config_unchanged': all(r['validity']['configUnchanged'] for r in rows),
    'registry_19_each': all(len(r['byTech']) == 19 for r in rows),
    'human_limits_preserved': all(r['limits']['humanInput'] and not r['limits']['aiControlled']
        and r['limits']['humanRecoveryPerReferenceSecond'] == 25 and r['limits']['maxStamina'] == 100
        and r['limits']['maxBonus'] == 0 and not r['limits']['infinite'] for r in rows),
    'secret_limits_preserved': all(r['validity']['secretUsesWithinLimit'] and
        sum(t['started'] for t in r['byTech'].values() if t['applicable'] and t['category'] == 'secret')
        <= (3 if r['school'] == 'chinese' else 1) for r in rows),
    'horizon_or_actual_death': all((r['duration']['endedBy'] == 'horizon' and
        30 <= r['duration']['activeReferenceSeconds'] <= 30 + r['settings']['physicsTimestep'] / r['settings']['time']['k'] + 1e-6)
        or (r['duration']['endedBy'] == 'death' and (r['inflicted']['dead'] or r['received']['dead'])
        and 0 <= r['duration']['activeReferenceSeconds'] <= 30 + 1e-6) for r in rows),
    'same_requested_persona': all(r['settings']['resolvedOpponentPers'] == r['settings']['opponentPers'] for r in rows),
    'no_viewport_escape': all(r['proxyCounts']['outsideViewportEvents'] == 0 for r in rows),
    'all_raw_pointer_coordinates_inside': all(isinstance(e.get('clientX'), (int, float))
        and isinstance(e.get('clientY'), (int, float)) and math.isfinite(e['clientX']) and math.isfinite(e['clientY'])
        and 0 <= e['clientX'] <= 844 and 0 <= e['clientY'] <= 390
        for r in rows for e in r['inputTrace'] if e['event'].startswith('pointer')),
    'starts_do_not_exceed_accepted_fires': all(t['started'] <= t['accepted'] for r in rows for t in r['byTech'].values()),
}
if not all(checks.values()):
    raise SystemExit(json.dumps({'failed': [key for key, value in checks.items() if not value]}, indent=2))

def spread(values):
    return {'n': len(values), 'mean': mean(values), 'median': median(values),
            'sampleVariance': variance(values) if len(values) > 1 else None,
            'sampleStandardDeviation': stdev(values) if len(values) > 1 else None,
            'min': min(values), 'max': max(values), 'samples': values}

def summarize(batch):
    exposure = sum(r['duration']['activeReferenceSeconds'] for r in batch)
    techs = {}
    for name, first in batch[0]['byTech'].items():
        if not first['applicable']:
            continue
        fields = ['opportunities', 'intents', 'requests', 'accepted', 'started', 'contacts',
                  'effectiveWounds', 'severity', 'consciousnessLost', 'limbFunctionLost', 'bleedAdded']
        values = {key: sum(r['byTech'][name][key] for r in batch) for key in fields}
        values.update(category=first['category'], roundsWithExecution=sum(r['byTech'][name]['started'] > 0 for r in batch),
            zeroExecutionRounds=sum(r['byTech'][name]['started'] == 0 for r in batch),
            zeroIntentRounds=sum(r['byTech'][name]['intents'] == 0 for r in batch),
            zeroOpportunityRounds=sum(r['byTech'][name]['opportunities'] == 0 for r in batch),
            executionsPerRound=values['started'] / len(batch), executionsPer30ActiveSeconds=30 * values['started'] / exposure,
            meanAttributedSeverityPerExecution=values['severity'] / values['started'] if values['started'] else None,
            executionsPerRoundSpread=spread([r['byTech'][name]['started'] for r in batch]),
            attributedSeverityPerRoundSpread=spread([r['byTech'][name]['severity'] for r in batch]))
        techs[name] = values
    return {
        'n': len(batch), 'activeReferenceSeconds': exposure, 'meanActiveReferenceSeconds': exposure / len(batch),
        'horizonRounds': sum(r['duration']['endedBy'] == 'horizon' for r in batch),
        'playerDeaths': sum(r['received']['dead'] for r in batch), 'enemyDeaths': sum(r['inflicted']['dead'] for r in batch),
        'playerTerminations': sum(r['received']['dead'] for r in batch),
        'enemyTerminations': sum(r['inflicted']['dead'] for r in batch),
        'playerTerminalCauseLabels': dict(Counter((r['received']['cause'] or '<none>') for r in batch if r['received']['dead'])),
        'enemyTerminalCauseLabels': dict(Counter((r['inflicted']['cause'] or '<none>') for r in batch if r['inflicted']['dead'])),
        'playerKnockoutTerminations': sum(r['received']['dead'] and r['received']['cause'] == '기절' for r in batch),
        'enemyKnockoutTerminations': sum(r['inflicted']['dead'] and r['inflicted']['cause'] == '기절' for r in batch),
        'playerBleedingTerminations': sum(r['received']['dead'] and r['received']['cause'] == '출혈' for r in batch),
        'enemyBleedingTerminations': sum(r['inflicted']['dead'] and r['inflicted']['cause'] == '출혈' for r in batch),
        'playerKnockdownEvents': sum(r['received']['knockdowns'] for r in batch),
        'enemyKnockdownEvents': sum(r['inflicted']['knockdowns'] for r in batch),
        'meanInflictedSeverity': mean(r['inflicted']['cutStabSeverity'] for r in batch),
        'meanReceivedSeverity': mean(r['received']['cutStabSeverity'] for r in batch),
        'meanInflictedBloodLoss': mean(r['inflicted']['bloodLost'] for r in batch),
        'meanReceivedBloodLoss': mean(r['received']['bloodLost'] for r in batch),
        'meanInflictedConsciousnessLoss': mean(r['inflicted']['consciousnessLost'] for r in batch),
        'meanReceivedConsciousnessLoss': mean(r['received']['consciousnessLost'] for r in batch),
        'meanPlayerStaminaSpent': mean(r['stamina']['totalSpent'] for r in batch),
        'meanEnemyStaminaSpent': mean(r['enemyStamina']['totalSpent'] for r in batch),
        'playerWeaponBreaks': sum(r['final']['player']['weaponBroken'] for r in batch),
        'enemyWeaponBreaks': sum(r['final']['enemy']['weaponBroken'] for r in batch), 'byTech': techs,
        'spread': {
            'activeReferenceSeconds': spread([r['duration']['activeReferenceSeconds'] for r in batch]),
            'inflictedSeverity': spread([r['inflicted']['cutStabSeverity'] for r in batch]),
            'receivedSeverity': spread([r['received']['cutStabSeverity'] for r in batch]),
            'playerStaminaSpent': spread([r['stamina']['totalSpent'] for r in batch]),
            'inflictedConsciousnessLoss': spread([r['inflicted']['consciousnessLost'] for r in batch]),
            'receivedConsciousnessLoss': spread([r['received']['consciousnessLost'] for r in batch]),
        },
        'earlyDeathExposure': {
            'n': sum(r['duration']['endedBy'] == 'death' for r in batch),
            'totalActiveReferenceSeconds': sum(r['duration']['activeReferenceSeconds'] for r in batch if r['duration']['endedBy'] == 'death'),
            'rounds': [{'mode': r['mode'], 'opponent': r['opponent'], 'seed': r['seed'],
                        'activeReferenceSeconds': r['duration']['activeReferenceSeconds'],
                        'playerDead': r['received']['dead'], 'enemyDead': r['inflicted']['dead'],
                        'playerCauseOfDeathLabel': r['received']['cause'], 'enemyCauseOfDeathLabel': r['inflicted']['cause']}
                       for r in batch if r['duration']['endedBy'] == 'death'],
        },
        'zeroAnyUniqueExecutionRounds': sum(not any(t['started'] for t in r['byTech'].values()) for r in batch),
        'zeroSecretExecutionRounds': sum(not any(t['started'] for t in r['byTech'].values() if t['category'] == 'secret') for r in batch),
        'roundKeys': [{'school': r['school'], 'mode': r['mode'], 'opponent': r['opponent'], 'seed': r['seed']} for r in batch],
    }

cells = defaultdict(list)
policies = defaultdict(list)
for row in rows:
    cells['/'.join([row['school'], row['mode'], row['opponent']])].append(row)
    policies['/'.join([row['school'], row['mode']])].append(row)
result = {'schemaVersion': 1, 'build': rows[0]['buildObserved'], 'scriptHash': source_hash,
          'terminalDefinition': 'dead/alive=false, endedBy=death, and legacy *Deaths fields are engine termination flags. Cause labels (기절/출혈/목/머리/etc) are separate and do not independently establish biological death. Knockdown events are separate.',
          'rows': len(rows), 'rateDefinition': '30 * actual executions / actual active reference seconds; observed event density, not an expected surviving 30s round or human frequency',
          'cells': {key: summarize(batch) for key, batch in cells.items()},
          'bySchoolPolicy': {key: summarize(batch) for key, batch in policies.items()}}
(ROOT / 'full/rates.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
validation = {'checkedUTC': datetime.now(timezone.utc).isoformat(), 'rows': len(rows), 'checks': checks,
              'rawSHA256': hashlib.sha256(raw_bytes).hexdigest(), 'scriptSHA256': source_hash,
              'sumRoundWallSeconds': sum(r['duration']['wallSeconds'] for r in rows),
              'activeReferenceSeconds': sum(r['duration']['activeReferenceSeconds'] for r in rows),
              'totalReferenceSeconds': sum(r['duration']['totalReferenceSeconds'] for r in rows)}
(ROOT / 'full/validation.json').write_text(json.dumps(validation, indent=2) + '\n')
lines = ['# 4유파 96판 관측 결과', '',
         f"96/96판 유효. 단일 프로세스 판별 실측 시간 합 {validation['sumRoundWallSeconds']:.2f}초, 실제 활성 관측 합 {validation['activeReferenceSeconds']:.2f}초.", '',
         '기본 30초를 채운 판과 조기 종결 판을 함께 싣는다. natural=혼합 우선순위 대본, targeted=기술 우선순위 대본이다. 인간 성공률·자연 인간 빈도가 아니다. 자세한 조건·분모 제약은 [METHODS.md](METHODS.md), 원본은 `full/rounds.jsonl.gz`, 16개 세부 묶음은 `full/rates.json`을 본다.', '',
         '| 유파/정책 | n | 평균 활성 초 | 30초 완료 | 사람 종결 | 상대 종결 | 준/받은 심각도 평균 | 기력 지출 평균 |',
         '|---|---:|---:|---:|---:|---:|---:|---:|']
for key, cell in result['bySchoolPolicy'].items():
    lines.append(f"| {key} | {cell['n']} | {cell['meanActiveReferenceSeconds']:.2f} | {cell['horizonRounds']} | {cell['playerDeaths']} | {cell['enemyDeaths']} | {cell['meanInflictedSeverity']:.3f}/{cell['meanReceivedSeverity']:.3f} | {cell['meanPlayerStaminaSpent']:.1f} |")
lines += ['', '종결은 엔진 `alive=false/dead`를 뜻한다. `causeOfDeath=기절`도 포함하므로 생리적 사망과 동일시하지 않는다. 아래 원인별 표와 넘어짐을 분리해 본다. 원본의 `endedBy=death`, `*Deaths`, `earlyDeathExposure` 필드는 이 엔진 종결의 원래 열 이름이다.', '',
          '| 유파/정책 | 사람 종결 원인 문자열 | 상대 종결 원인 문자열 | 사람/상대 넘어짐 사건 |',
          '|---|---|---|---:|']
for key, cell in result['bySchoolPolicy'].items():
    causes = lambda labels: ', '.join(f'{k}:{v}' for k, v in labels.items()) or '없음'
    lines.append(f"| {key} | {causes(cell['playerTerminalCauseLabels'])} | {causes(cell['enemyTerminalCauseLabels'])} | {cell['playerKnockdownEvents']}/{cell['enemyKnockdownEvents']} |")
lines += ['', '| 세부 조건(n=6) | 활성 초 평균 ± 표본 SD | 준 심각도 평균 ± SD | 받은 심각도 평균 ± SD | 고유 전체 0회 판 | 비기 0회 판 | 조기 종결 판/실제 활성 초 합 |',
          '|---|---:|---:|---:|---:|---:|---:|']
for key, cell in result['cells'].items():
    d, a, b = [cell['spread'][k] for k in ['activeReferenceSeconds', 'inflictedSeverity', 'receivedSeverity']]
    lines.append(f"| {key} | {d['mean']:.2f} ± {d['sampleStandardDeviation']:.2f} | {a['mean']:.3f} ± {a['sampleStandardDeviation']:.3f} | {b['mean']:.3f} ± {b['sampleStandardDeviation']:.3f} | {cell['zeroAnyUniqueExecutionRounds']} | {cell['zeroSecretExecutionRounds']} | {cell['earlyDeathExposure']['n']}/{cell['earlyDeathExposure']['totalActiveReferenceSeconds']:.2f}s |")
lines += ['', '표본분산·표준편차·중앙값·최솟값·최댓값·씨앗별 값과 조기 종결 개별 노출시간은 `full/rates.json`에 남겼다. 분산은 게임/정책 씨앗 간 기술통계이며 인간 모집단의 추정치가 아니다.', '',
          '| 기술 | 정책 | 의도 | 조건 사건 | 요청 | 새 발동 수용 | 실제 실행 | 실행 0회 판(n=12) | 접촉 콜백 | 실제 추가 상처 | 활성 30초당 실행 밀도 |',
          '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
for key, cell in result['bySchoolPolicy'].items():
    mode = key.split('/')[1]
    for name, tech in cell['byTech'].items():
        lines.append(f"| {name} | {mode} | {tech['intents']} | {tech['opportunities']} | {tech['requests']} | {tech['accepted']} | {tech['started']} | {tech['zeroExecutionRounds']} | {tech['contacts']} | {tech['effectiveWounds']} | {tech['executionsPer30ActiveSeconds']:.2f} |")
lines += ['', '활성 30초당 실행 밀도는 `30 × 실제 실행 / 실제 활성 관측 초 합`이다. 조기 종결의 영향을 포함한 관측 밀도이며, 30초 생존을 가정한 예측 빈도가 아니다. 강화동작 조건 사건은 실제 입력의 chooser 일치이므로 기술 간 기회 분모를 직접 비교하거나 성공률로 합치지 않는다.', '',
          '요청·수용과 실행을 분리하고, 심각도와 실제 추가 상처도 분리했다. 태그로 귀속되지 않은 보통 공격의 피해는 판 전체 피해에 포함된다. 고정 씨앗 6개는 인간 독립 표본이 아니다.', '',
          '검증: 요청한 96개 조합 중복·누락 없음, 전 판 사람 회복25/최대100/덧0/무한false·AI2없음, 실제 persona 일치, 비기 횟수 한도 보존, 설정 해시 불변, 소스 해시 일치, 19종 레지스트리, 정상 30초 시계/실제 엔진 종결 시점 종료를 확인했다. 첫 일본 파일럿 오류는 본배치에서 제외하고 원본을 보존했다.', '']
lines += ['', '독일 별도 배치는 seeds 301–306, 이 4유파 배치는 seeds 1–6이다. 유파 간 같은 씨앗으로 짝지은 비교가 아니며, 작은 씨앗 집합과 정책 차이 때문에 유파 간 순위를 확정하는 자료로 쓰지 않는다.', '']
(ROOT / 'RESULTS.md').write_text('\n'.join(lines))
print(json.dumps({'rows': len(rows), 'checks': checks, 'wallSeconds': validation['sumRoundWallSeconds']}, ensure_ascii=False))
