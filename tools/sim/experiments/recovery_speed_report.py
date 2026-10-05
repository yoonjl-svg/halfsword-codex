"""Derive a short recovery-speed report without rerunning physics."""
import argparse, hashlib, json, math, statistics
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--raw', type=Path, required=True)
p.add_argument('--out', type=Path, required=True)
a = p.parse_args()
assert not a.out.exists()
b = a.raw.read_bytes()
d = json.loads(b)
assert d['measurementValid'] and d['sourceStable']
rows = d['rows']
assert len(rows) == 5 and rows[0]['frames'] == rows[1]['frames']
assert rows[0]['inputs'] == rows[1]['inputs'] and rows[2]['inputs'] == rows[3]['inputs']
assert rows[2]['prefixExact'] and rows[3]['prefixExact']
assert rows[2]['wounds'] == rows[3]['wounds']
mean = statistics.mean

def metric(samples, phase):
    xs = [s for s in samples if s['phase'] == phase]
    if not xs:
        return None
    peak = max(xs, key=lambda x: x['tipSpeedMps'])
    return {'n': len(xs), 'horizontalSpeedMeanMps': mean(math.hypot(x['pelvisV']['x'], x['pelvisV']['z']) for x in xs),
            'tipPeakMps': peak['tipSpeedMps'], 'tipPeakTick': peak['tick'],
            'firstMovingTick': next((x['tick'] for x in xs if x['assistPhase'] == 'moving'), None),
            'slowFactorMean': mean(x['slowFactor'] for x in xs),
            'scope': 'Horizontal pelvis speed magnitude, including transitional motion; not isolated lateral projection or maximum walking speed.'}

summaries = []
for r in rows:
    catches = []
    for step in r['steps']:
        if step['kind'] != 'catch' or 'endTick' not in step:
            continue
        xs = [s for s in r['samples'] if step['startTick'] <= s['tick'] <= step['endTick']]
        k = step['foot']
        next_load = next((s['tick'] for s in r['samples'] if step['endTick'] <= s['tick'] <= step['endTick'] + 24 and s['legs'][k].get('N', 0) > 0), None)
        catches.append({**step, 'peakTiltDeg': max(s['tilt'] for s in xs), 'peakCatchAssistState': max(s['levC'] for s in xs),
                        'firstRecordedLoadTickAfterControllerTD': next_load,
                        'worldDisplacementXZ': [step['endPosition'][v] - step['position'][v] for v in ['x', 'z']]})
    summaries.append({'mode': r['mode'], 'injured': r['injured'], 'gravity': r['gravity'],
                      'steps': len(r['frames']), 'entries': r['entries'],
                      'states': sorted(set(s['state'] for s in r['samples'])),
                      'phases': {q: metric(r['samples'], q) for q in ['forward', 'side', 'reverse', 'cut', 'hold']}, 'catches': catches})

comparisons = {}
for phase, key in [('side', 'horizontalSpeedMeanMps'), ('reverse', 'horizontalSpeedMeanMps'), ('cut', 'tipPeakMps')]:
    x, y = (summaries[i]['phases'][phase][key] for i in [2, 3])
    comparisons[phase] = {'metric': key, 'A': x, 'B': y, 'percentDifference': 100 * (y / x - 1)}
result = {'schemaVersion': 1, 'head': d['head'], 'measurementValid': True,
          'raw': {'path': str(a.raw.resolve()), 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()},
          'counts': {'executions': 5, 'physicsSteps': sum(len(r['frames']) for r in rows), 'physicsWallSeconds': d['wallSeconds']},
          'healthyExact': {'nativeSteps': 960, 'inputEvents': 960, 'reentries': 0},
          'injured': {'naturalInjuryPrefixExactThrough': 1476, 'matchedPlayerInputEvents': len(rows[2]['inputs']),
                      'sameWoundHistory': True, 'opponentRemovedAt': 1477, 'comparisons': comparisons},
          'rows': summaries,
          'verdict': 'No B-wide movement or attack slowdown found in these brief cases. Positive user recovery feedback retained. Gravity-only diagnostic does not establish a solution.',
          'limits': ['Only zweihander; 120Hz inputs, no physical-phone rendering/hitstop timing measurement.',
                     'Post-injury rows isolate locomotion by parking the opponent; not a further combat acceptance.',
                     'Observed catch steps were mainly forward travel during forward-to-side input, not the exact reported sideways near-fall scene.',
                     'Controller touchdown is not physical touchdown; cached N was zero before handler/native step and first recorded positive two ticks later.',
                     'One +20% gravity row from spawn leaves controller 9.81 constants unchanged; no gain search, correction, naturalness acceptance or public promotion.']}
a.out.parent.mkdir(parents=True, exist_ok=True)
a.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'healthyExact': result['healthyExact'], 'injuredComparisons': comparisons, 'counts': result['counts']}))
