#!/usr/bin/env python3
"""Derive compact evidence from saved runs; never rerun physics or overwrite raw."""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path

def sha(data):
    return hashlib.sha256(data).hexdigest()

def load(path):
    data = path.read_bytes()
    doc = json.loads(data)
    assert doc['pass'] and doc['sourceStable'] and doc['headStable']
    return doc, {'path': str(path), 'bytes': len(data), 'sha256': sha(data)}

def windows(frames, first, injury):
    groups = defaultdict(list)
    for frame in frames[first:]:
        groups[frame['phase']].append(frame)
    result = {}
    for phase, samples in groups.items():
        def values(frame):
            p = frame['p']
            if injury:
                o = frame['observed']
                return {'arm': p['armHealth'], 'leg': p['legHealth'], 'state': p['state'],
                        'alive': p['alive'], 'armed': p['armed'],
                        'handErrorM': p['measurement']['handErrorM'],
                        'axialRadS': o['axialOmegaRadS'], 'tipMps': o['tipVelocityMps'],
                        'gapM': p['gapM'], 'gripM': o['gripGapM'] or 0, 'contacts': o['contacts'],
                        'missing': o['missingJoints']}
            h = p['health']
            return {'arm': h['arm'], 'leg': h['leg'], 'state': h['state'],
                    'alive': h['alive'], 'armed': h['armed'], 'handErrorM': p['handErrorM'],
                    'axialRadS': p['axialRadS'], 'tipMps': p['tipMps'],
                    'gapM': p['maxJointGapM'], 'gripM': p['gripGapM'] or 0,
                    'contacts': p['contacts'], 'missing': p['missingJoints']}
        all_values = [values(f) for f in samples]
        result[phase] = {
            'ticksInclusive': [samples[0]['tick'], samples[-1]['tick']], 'frames': len(samples),
            'armHealthRange': [min(v['arm'] for v in all_values), max(v['arm'] for v in all_values)],
            'states': sorted({v['state'] for v in all_values}),
            'aliveArmedStandAll': all(v['alive'] and v['armed'] and v['state'] == 'stand' for v in all_values),
            'handTargetErrorPeakM': max(v['handErrorM'] for v in all_values),
            'handTargetErrorEndM': all_values[-1]['handErrorM'],
            'worldAxialPeakRadS': max(abs(v['axialRadS']) for v in all_values),
            'bladeTipPeakMps': max(v['tipMps'] for v in all_values),
            'bodyJointGapPeakM': max(v['gapM'] for v in all_values),
            'gripGapPeakM': max(v['gripM'] for v in all_values),
            'swordContactFrames': sum(bool(v['contacts']) for v in all_values),
            'missingJoints': sorted({n for v in all_values for n in v['missing']}),
        }
    return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--injury', type=Path, required=True)
    parser.add_argument('--followup', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    assert not args.out.exists(), 'Fresh derived output required'
    injury, injury_raw = load(args.injury)
    followup, followup_raw = load(args.followup)
    a, b = injury['rows']
    first_difference = {key: next((y['tick'] for x, y in zip(a['frames'], b['frames'])
                                  if x['trace'][key] != y['trace'][key]), None)
                        for key in ('native', 'controller', 'input', 'events')}
    result = {
        'schemaVersion': 1, 'baselineCommit': injury['sourceCommit'],
        'userFeedback': {
            'quote': '최근 테스트는 둘 다 b가 낫다. 하지만 짧은 플레이였기 때문에 내가 오류를 잡아내진 못했을 수 있어.',
            'scope': 'Recent two comparisons preferred B; exact test URLs were not restated. Context suggests contact shape and thrust plane, but this mapping is an inference. Brief play is not bug-free verification, recovery acceptance, or approval of general physics promotion.',
            'firstObservedTurnUTC': '2026-10-04T16:09:41Z', 'utteranceTimestampKnown': False,
        },
        'injuredInput': {
            'raw': injury_raw, 'sourceStable': injury['sourceStable'], 'headStable': injury['headStable'],
            'engineModuleSHA256': injury['sourceBefore']['node_modules/@dimforge/rapier3d-compat/rapier.mjs'],
            'engineWasmSHA256': injury['sourceBefore']['node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'],
            'options': injury['options'], 'scheduleSHA256': injury['scheduleSHA256'],
            'command': injury['command'], 'wallSeconds': injury['wallSeconds'],
            'prefixSteps': 1536, 'freshPrefixNativeControllerInputEventsExact': injury['freshPrefixNativeControllerInputEventsExact'],
            'savedObservationScope': 'Both fighters saved post-Combat observations; old per-step full native/controller hashes absent. Full native/controller/input/events prefix exact is between two fresh rows.',
            'firstDifference': first_difference,
            'windows': {r['mode']: windows(r['frames'], 1536, True) for r in injury['rows']},
            'scriptedSuppliedZeroJoystickOverwrittenByExistingSkillSteps': sum(f['observed']['input']['move'] != [0, 0] for f in b['frames'][1536:]),
            'autoGuardRetained': b['frames'][1535]['observed']['skill']['autoGuard'],
            'allScriptedFramesAlive': all(f['p']['alive'] for f in b['frames']),
            'eventsAfterInjury': {r['mode']: [w for w in r['frames'][-1]['events']['wounds'] if w['timeS'] >= 12.8] for r in injury['rows']},
            'sourceBefore': injury['sourceBefore'],
        },
        'publicFollowup': {
            'raw': followup_raw, 'sourceStable': followup['sourceStable'], 'headStable': followup['headStable'],
            'command': followup['command'], 'wallSeconds': followup['wallSeconds'],
            'sourceBefore': followup['sourceBefore'], 'scheduleSHA256': followup['scheduleSHA256'],
            'scope': followup['scope'],
            'rows': [{
                'model': r['model'], 'prefixNativeStepsValidated': r['prefixNativeStepsValidated'],
                'taps': r['taps'], 'transitions': r['transitions'],
                'firstActualMainArmLoss': next(({'tick': f['tick'], 'postCombatTimeS': f['timeS'], 'armHealth': f['p']['health']['arm']}
                                                for f in r['frames'] if f['p']['health']['arm'] < 1), None),
                'tapDownFrames': sum(f['p']['skill']['tapDown'] for f in r['frames']),
                'tapBoundFrames': sum(f['p']['skill']['tapBound'] for f in r['frames']),
                'tapAbortFrames': sum(f['p']['skill']['tapAbort'] for f in r['frames']),
                'windows': windows(r['frames'], 1080, False), 'wounds': r['wounds'],
            } for r in followup['rows']],
        },
        'decision': 'Keep preferred public trials optional; no game/source/default/engine/hand change. Injury input accepted with intended force limits but residual contact roll remains; B followup has no actual main-arm loss or tap down/bound/abort. Do not declare naturalness, complete stage2, relative causal efficacy or win rate.',
        'next': 'Reuse current manual/profile/original fixed prefix: first main-arm cut event9.808333s, postCombat tick1177/9.816667s health.338634, then getup12.833333–15.058333. Check already-implemented armRecovery independent from spawn, first true difference and support/braking; no midinjury enable, forced state, seed/gain sweep or user release yet.',
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open('x', encoding='utf-8') as output:
        json.dump(result, output, ensure_ascii=False, indent=2)
        output.write('\n')
    print(json.dumps({'out': str(args.out), 'firstDifference': first_difference, 'rawVerified': 2}))

if __name__ == '__main__':
    main()
