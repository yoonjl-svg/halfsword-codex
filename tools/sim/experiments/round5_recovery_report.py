#!/usr/bin/env python3
"""Derive exposure bounds from preserved round5 rows; never executes physics."""
import argparse, hashlib, json
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--run', type=Path, required=True)
p.add_argument('--out', type=Path, required=True)
a = p.parse_args()
assert not a.out.exists()

def read(path):
    raw = path.read_bytes()
    return json.loads(raw), {'path': str(path), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}

report, report_ref = read(a.run / 'report.json')
rows, artifacts = [], [report_ref]
for descriptor in report['rows']:
    row, ref = read(Path(descriptor['artifact']['path']))
    assert ref == descriptor['artifact']
    artifacts.append(ref)
    player_events = [e for e in row['events'] if e['attacker'] == 0]
    candidate = [e for e in player_events if e['reaction'] is not None]
    tape_events = [e for e in player_events if e['relativeTick'] is not None]
    live_actual = [e for e in tape_events if e['victimAlive'] and e['actualJ'] > 0]
    # Fatal wound contacts are listed separately: pre-Combat alive is a bound,
    # not proof that every later pair within that step preceded death.
    fatal_step_possible = [e for e in tape_events if not e['victimAlive'] and e['aliveAtCombatStart'] and e['actualJ'] > 0]
    first_hit = next((w for w in row['woundCalls'] if w['fighter'] == 0 and w['request'].get('energy', 0) > 0), None)
    first_tick_wounds = [] if first_hit is None else [w for w in row['woundCalls'] if w['fighter'] == 0 and w['tick'] == first_hit['tick']]
    rows.append({
        'key': row['key'], 'fixture': report['protocol'].get('fixture', 'passive'),
        'steps': row['steps'], 'terminal': row['terminal'], 'handover': row.get('handover'),
        'firstHitTick': row['firstHitTick'], 'firstGetupAfterHitTick': row['firstGetupAfterHitTick'],
        'firstEffectiveFreshTick': row['firstEffectiveFreshTick'], 'trigger': row['trigger'],
        'tapeStart': row['tapeStart'], 'tapeRequests': sum(r['relativeTick'] is not None for r in row['requests']),
        'allInputRequestsAccepted': all(r['accepted'] for r in row['requests']),
        'effectiveFreshEntries': sum(e['effective'] for e in row['entries']),
        'initialEntries': sum(not e['reentry'] for e in row['entries']),
        'pinCallsAfterFresh': len(row['pinCalls']),
        'playerCutPairs': len(player_events), 'candidateCalls': len(candidate),
        'livingPlayerPairs': sum(e['victimAlive'] for e in player_events),
        'livingCandidateActualPairs': sum(e['victimAlive'] and e['actualJ'] > 0 for e in candidate),
        'candidateCapPairs': sum(e['actualJ'] < e['J'] for e in candidate),
        'candidateZeroImpulsePairs': sum(e['actualJ'] == 0 for e in candidate),
        'candidateInstantPositiveKAbove1eMinus5J': sum(e['analysis']['deltaKJ'] > 1e-5 for e in candidate),
        'candidateInstantMaxKJ': max((e['analysis']['deltaKJ'] for e in candidate), default=None),
        'candidateMaxMomentumResidualNs': max((e['analysis']['deltaPResidualNs'] for e in candidate), default=None),
        'candidateMaxAngularMomentumResidualNms': max((e['analysis']['deltaLResidualNms'] for e in candidate), default=None),
        'tapeCutPairs': len(tape_events), 'livingTargetActualTapePairs': len(live_actual),
        'fatalSameStepPossiblePairs': len(fatal_step_possible),
        'fastLivingActualTapePairs': sum(e['swinging'] or e['inputActive'] for e in live_actual),
        'firstHitWounds': [{'tick': w['tick'], 'part': w['request']['part'], 'energyJ': w['request']['energy'],
                            'severity': w['request'].get('severity'), 'before': w['before'], 'after': w['after']}
                           for w in first_tick_wounds],
        'finalPlayer': {k: row['finalStates'][0][k] for k in ['state', 'alive', 'armed', 'limbs', 'blood', 'pain']},
        'finalEnemy': {k: row['finalStates'][1][k] for k in ['state', 'alive', 'armed', 'limbs', 'blood', 'pain']},
        'playerObservedStates': sorted(set(m['fighters'][0]['state'] for m in row['metrics'])),
        'checks': row['checks'], 'error': row['error'],
        'exposurePassed': bool(row['trigger'] and live_actual),
    })

raw_rows = [json.loads(Path(d['artifact']['path']).read_text()) for d in report['rows']]
common_length = min(len(r['frames']) for r in raw_rows)
exact = all(raw_rows[0]['frames'][i] == raw_rows[1]['frames'][i] for i in range(common_length))
summary = {
    'schemaVersion': 1, 'head': report['head'], 'sourceStable': report['sourceStable'],
    'measurementValid': report['measurementValid'], 'executionCount': report['executionCount'],
    'steps': report['steps'], 'wallSeconds': report['wallSeconds'], 'command': report['command'],
    'protocol': report['protocol'], 'sourceManifest': report['source'],
    'rows': rows, 'comparisons': {**report['comparisons'], 'commonRecordedSteps': common_length,
                               'allCommonFramesExact': exact},
    'artifacts': artifacts,
    'verdict': 'from_spawn_manual_recovery_contact_gate_exposed' if all(r['exposurePassed'] for r in rows)
               else 'from_spawn_manual_recovery_contact_gate_unexposed',
    'limits': [
        'Measurement validity does not imply the recovery/contact gate was reached.',
        'Initial Gait.enter and vacuous productionFreshClear do not prove recovery reset.',
        'Positive wound energy alone is not a limb injury; severity and before/after health are separate.',
        'Conditional recovery start may differ: relative tape equality is not absolute input or causal efficacy equality.',
        'No browser frame timing, hitstop, rendered emotion-update or arena-wall equivalence claim.',
        'No P2/P5 completion, naturalness acceptance, or ordinary-default promotion.',
    ],
}
a.out.parent.mkdir(parents=True, exist_ok=True)
a.out.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'out': str(a.out), 'verdict': summary['verdict'], 'steps': summary['steps'],
                  'allCommonFramesExact': exact}, ensure_ascii=False))
