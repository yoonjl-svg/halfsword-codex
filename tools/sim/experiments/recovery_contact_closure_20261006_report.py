"""Read-only aggregation of the declared recovery/contact closure pair."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--run', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
assert not args.out.exists(), 'Preserve previous summaries'


def read(path):
    raw = path.read_bytes()
    return json.loads(raw), {'path': str(path), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}


report, report_ref = read(args.run / 'report.json')
assert report['measurementValid'] and report['sourceStable']
rows, refs, raw_rows = {}, [report_ref], []
for spec in report['rows']:
    row, ref = read(Path(spec['artifact']['path']))
    assert ref == spec['artifact']
    refs.append(ref)
    raw_rows.append(row)
    trigger = row['tapeStart']
    events = [e for e in row['events'] if e['attacker'] == 0 and trigger is not None and e['tick'] >= trigger and e['actualJ'] > 0]
    live = [e for e in events if e['victimAlive'] and e['aliveAtCombatStart']]
    candidate = [e for e in live if e['reaction']]
    fresh = [e for e in row['entries'] if e['effective']]
    first = live[0] if live else None
    player_frames = [m['fighters'][0] for m in row['metrics']]
    rows[row['key']] = {
        'steps': row['steps'], 'checks': row['checks'],
        'firstHitTick': row['firstHitTick'], 'firstHeadImpactTick': row['firstHeadImpactTick'],
        'getupTick': row['firstGetupAfterHitTick'], 'freshTick': row['firstEffectiveFreshTick'],
        'tapeStart': trigger, 'effectiveFreshEntries': len(fresh),
        'firstFreshNfBefore': {k: v['Nf'] for k, v in fresh[0]['before']['legs'].items()} if fresh else None,
        'firstFreshNfAfter': {k: v['Nf'] for k, v in fresh[0]['after']['legs'].items()} if fresh else None,
        'firstFreshActualFootForcesN': [x['magnitude'] for x in row['pinCalls'][0]['applied'] if x['method'] == 'addForceAtPoint'] if row['pinCalls'] else [],
        'authoredRequestsAfterRecovery': sum(q['relativeTick'] is not None for q in row['requests']),
        'livePositiveManualCutPairs': len(live), 'liveCandidatePairs': len(candidate),
        'livePairTicks': [e['tick'] for e in live],
        'postmortemPositivePairsExcluded': sum(not e['victimAlive'] for e in events),
        'firstLiveManualPair': {k: first[k] for k in ['tick', 'relativeTick', 'phase', 'inputActive', 'swinging', 'J', 'actualJ', 'victimAlive', 'aliveAtCombatStart', 'analysis']} if first else None,
        'firstLiveOwner': row['metrics'][first['tick']]['fighters'][0]['control']['assist']['owner'] if first else None,
        'liveCandidateCaps': sum(e['reaction']['J'] < e['reaction']['requestedJ'] - 1e-12 for e in candidate),
        'liveCandidatePositiveDeltaK': sum(e['analysis']['deltaKJ'] > 1e-5 for e in candidate),
        'liveCandidateMaxDeltaPResidualNs': max((e['analysis']['deltaPResidualNs'] for e in candidate), default=None),
        'liveCandidateMaxDeltaLResidualNms': max((e['analysis']['deltaLResidualNms'] for e in candidate), default=None),
        'candidateOpponentApplications': sum(bool(e['reaction']) and e['attacker'] != 0 for e in row['events']),
        'allPlayerAliveArmedGripValid': all(f['alive'] and f['armed'] and f['gripValid'] for f in player_frames),
        'maxPlayerJointGapM': max(g['gapM'] for f in player_frames for g in f['gaps']),
        'terminal': row['terminal'],
        'exposureGate': bool(fresh and trigger == fresh[0]['tick'] + 1 and live),
    }

a, b = raw_rows
fa = next(e for e in a['events'] if e['attacker'] == 0 and e['victimAlive'] and e['actualJ'] > 0)
fb = next(e for e in b['events'] if e['attacker'] == 0 and e['victimAlive'] and e['actualJ'] > 0)
summary = {
    'schemaVersion': 1, 'head': report['head'], 'measurementValid': report['measurementValid'],
    'sourceStable': report['sourceStable'], 'executionCount': report['executionCount'],
    'steps': report['steps'], 'wallSeconds': report['wallSeconds'], 'command': report['command'],
    'sourceManifest': str(args.run.parent / 'frozen-alber01' / 'SOURCE.json'),
    'plan': str(args.run.parent / 'alber-plan01.json'), 'artifacts': refs,
    'rows': rows, 'comparisons': {**report['comparisons'],
        'allPlayerAuthoredRequestsExact': a['requests'] == b['requests'],
        'firstLivePairBodiesExact': fa['before'] == fb['before'],
        'firstLivePairRequestedJExact': fa['J'] == fb['J'],
        'firstLivePairBudgetDebitExact': fa['analysis']['requestedBudgetDebitJ'] == fb['analysis']['requestedBudgetDebitJ'],
    },
    'exposureGate': all(r['exposureGate'] for r in rows.values()) and rows['combined']['liveCandidatePairs'] > 0,
    'scope': 'One authored low-guard fixture; normal default enemy AI, Z/LS, seed7, g9.81, player fresh/manual/v2-r2 from spawn. First manual cut contacts during held follow-through, not while pad is moving; input ownership remains player and AI2 is always null.',
    'limitations': [
        'One contact episode yields four substep impulse pairs; this is not four independent trials.',
        'Both rows stop at enemy death tick2037; 245/324 authored steps ran. Full tape/release completion was not observed.',
        'Candidate cap is inactive in these four live impulses; prior actual cap validation remains separate.',
        'Enemy input branches at1955; later trajectory or damage changes do not isolate candidate efficacy.',
        'No render-frame, hitstop, physical-phone or human naturalness equivalence claim; no general promotion.',
        'No new P4 intervention is included in this source fixture.',
    ],
}
args.out.parent.mkdir(parents=True, exist_ok=True)
args.out.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'out': str(args.out), 'exposureGate': summary['exposureGate'], 'rows': {k: {'freshTick': v['freshTick'], 'livePositiveManualCutPairs': v['livePositiveManualCutPairs']} for k, v in rows.items()}}))
