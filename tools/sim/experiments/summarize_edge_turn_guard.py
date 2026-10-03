"""Recompute turn/guard measurements from archived native runs, without rerunning physics."""
import argparse
import json
import math
import pathlib
import sys
sys.dont_write_bytecode = True
from summarize_edge_transition import sha, git, phase, alignment

SOURCES = {
    'edge-turn-guard-absolute-smoke.json': 'd0b56d8',
    'edge-turn-guard-from-spawn.json': '3451fcf',
    'edge-turn-guard-same-prefix.json': '3451fcf',
    'edge-turn-guard-split.json': '716b100',
    'edge-turn-guard-mixture.json': '0573f07',
    'edge-turn-guard-mixture-start.json': '0573f07',
}


def yaw_of(q):
    x, y, z, w = q
    return math.atan2(-(2*(x*z-w*y)), 1-2*(y*y+z*z))


def yaw_travel(frames, key):
    angles = [yaw_of(f[key]) for f in frames]
    return sum(abs(math.atan2(math.sin(b-a), math.cos(b-a))) for a, b in zip(angles, angles[1:]))


def reduced(r):
    fs = [f for f in r['frames'] if round(f['timeS']*120) > 360]
    phases = {}
    for name in dict.fromkeys(f['phase'] for f in fs):
        rows = [f for f in fs if f['phase'] == name]
        phases[name] = phase(rows, 3, 9) | {
            'ownAimMeanErrorRad': sum(f['ownAimErrorRad'] for f in rows)/len(rows),
            'actualPlane': alignment(rows, 3, 9, .5),
            'peak': {k: max(rows, key=lambda f: f['swordTwistRadps'])[k]
                     for k in ['timeS', 'swordTwistRadps', 'ownAimErrorRad']}}
    windows = {}
    for a, b in [(3, 9), (6, 9)]:
        rows = [f for f in fs if a*120 < round(f['timeS']*120) <= b*120]
        windows[f'{a}to{b}'] = phase(rows, a, b) | {
            'ownAimMeanErrorRad': sum(f['ownAimErrorRad'] for f in rows)/len(rows),
            'actualPlane': [alignment(rows, a, b, threshold) for threshold in [.5, 2.5]],
            'actualPelvisProjectedYawTravelRad': yaw_travel(rows, 'actualPelvisRotation'),
            'actualChestProjectedYawTravelRad': yaw_travel(rows, 'actualChestRotation'),
            'distinctNearestGuards': sorted(set(f['guardNearest'] for f in rows)),
            'nearOrthogonalSamples': sum(abs(f['transition']['flatErrorRad']) >= math.radians(80) for f in rows)}
    return {k: r[k] for k in ['weapon', 'scenario', 'level', 'mode', 'first', 'atSwitch', 'prepared', 'summary',
                              'nativeTraceSha256', 'controllerTraceSha256', 'inputSha256']} | {'phases': phases, 'windows': windows}


def summarize(directory):
    datasets, rawdata = [], {}
    for name, commit in SOURCES.items():
        raw = (directory/name).read_bytes()
        x = json.loads(raw)
        source = git('rev-parse', commit).decode().strip()
        assert x['executionPass'] and x['sourceStable'], name
        assert all(v is not False for c in x['checks']+x['observers'] for v in c.values()), name
        assert all(p.startswith('node_modules/') or sha(git('show', source+':'+p)) == h
                   for p, h in x['sourceBefore'].items()), name
        rawdata[name] = x
        datasets.append({'rawFile': name, 'rawSHA256': sha(raw), 'rawBytes': len(raw),
            'sourceArchive': source, 'sourceRecordedAtStart': x['sourceCommit'], 'sourceArchivesExact': True,
            'sourceStable': x['sourceStable'], 'command': x['command'], 'wallSeconds': x['wallSeconds'],
            'executionCount': len(x['rows'])+len(x['observers']),
            'supersededInputContract': 'absolute-smoke' in name,
            'protocol': x['protocol'], 'checks': x['checks'], 'observers': x['observers'],
            'rows': [reduced(r) for r in x['rows']]})
    baseline = rawdata['edge-turn-guard-from-spawn.json']['rows']
    archive = []
    # Research-source edits must leave the continuous candidate's entire native/control trace intact.
    for name in ['edge-turn-guard-split.json', 'edge-turn-guard-mixture.json', 'edge-turn-guard-mixture-start.json']:
        for row in rawdata[name]['rows']:
            if row['mode'] != 'planePotential':
                continue
            old = next(v for v in baseline if all(v[k] == row[k] for k in ['weapon', 'scenario', 'level', 'mode']))
            entry = {'file': name, 'weapon': row['weapon'], 'scenario': row['scenario'], 'level': row['level'],
                     'nativeExact': old['nativeTraceSha256'] == row['nativeTraceSha256'],
                     'controllerExact': old['controllerTraceSha256'] == row['controllerTraceSha256'],
                     'externalInputExact': old['inputSha256'] == row['inputSha256']}
            assert all(v is not False for v in entry.values()), entry
            archive.append(entry)
    return {'schemaVersion': 1, 'executionCount': sum(d['executionCount'] for d in datasets),
        'supersededAbsoluteInputExecutions': 4,
        'summedRunWallSeconds': sum(d['wallSeconds'] for d in datasets),
        'datasets': datasets, 'archiveReplay': archive,
        'definitions': {'cost': 'Execution counts include observer/control repeats and4 superseded absolute-input smoke runs. Not independent samples, development duration, token cost or a speedup.',
        'state': 'Same spawn/prefix native and selected controller hashes. Start0 is actual from-spawn option; start3/6 branches are diagnosis only. Mode-specific prepared states may differ at start0.',
        'inputs': 'After initial4-run smoke, requests accumulate touch deltas on live handOffset including auto-return, plus actual lateral stick. No direct body/velocity/yaw change. Foe physics active, AI disabled, gap6m.',
        'alignment': 'Delayed cached velocity, pre-solver blade/flat projected plane with abs dot, speed-weighted; not instantaneous native/contact velocity or cutting power. New hypotheses retain this external benchmark.',
        'yaw': 'heading is controller reference. Separate actual pelvis/chest projected forward-yaw travel uses native quaternions. Projection is not full3D body rotation or transferred work.',
        'observer': 'Legacy/planePotential compared with uninstrumented runtime; intervention cases compare frame observation on/off with shared required intervention instrumentation.',
        'limits': 'No injury, contact duel, browser or human acceptance in this batch. No full native work/passivity. Threshold80deg is a reporting metric only.'}}


def summarize_wounds(directory):
    datasets, loaded = [], {}
    source = git('rev-parse', '26fd635').decode().strip()
    for name in ['edge-arm-healthy.json', 'edge-arm-cut.json']:
        raw = (directory/name).read_bytes()
        x = json.loads(raw)
        loaded[name] = x
        assert x['executionPass'] and x['sourceStable']
        assert all(v is not False for c in x['checks']+x['observers'] for v in c.values())
        assert all(p.startswith('node_modules/') or sha(git('show', source+':'+p)) == h
                   for p, h in x['sourceBefore'].items())
        rows = []
        for r in x['rows']:
            health = [f['health'] for f in r['frames'] if round(f['timeS']*120) > 360]
            event = r['woundEvent']
            assert event['beforeNative'] == event['afterNative']
            rows.append(reduced(r) | {'woundEvent': event,
                'minMuscleAfterWound': min(h['muscle'] for h in health),
                'maxPainAfterWound': max(h['pain'] for h in health),
                'aliveArmedThroughout': all(h['alive'] and h['armed'] for h in health)})
        datasets.append({'rawFile': name, 'rawSHA256': sha(raw), 'rawBytes': len(raw),
            'sourceArchive': source, 'sourceRecordedAtStart': x['sourceCommit'], 'sourceArchivesExact': True,
            'sourceStable': True, 'executionCount': len(rows)+len(x['observers']),
            'wallSeconds': x['wallSeconds'], 'command': x['command'], 'protocol': x['protocol'],
            'checks': x['checks'], 'observers': x['observers'], 'rows': rows})
    pairs = []
    for cut in loaded['edge-arm-cut.json']['rows']:
        healthy = next(r for r in loaded['edge-arm-healthy.json']['rows'] if (r['weapon'], r['mode']) == (cut['weapon'], cut['mode']))
        entry = {k: cut[k] for k in ['weapon', 'mode']} | {
            'nativeBeforeWoundExact': healthy['woundEvent']['beforeNative'] == cut['woundEvent']['beforeNative'],
            'controllerBeforeWoundExact': healthy['woundEvent']['beforeControl'] == cut['woundEvent']['beforeControl'],
            'prefixExact': healthy['atSwitch']['prefix'] == cut['atSwitch']['prefix'],
            'externalInputExact': healthy['inputSha256'] == cut['inputSha256']}
        assert all(v is not False for v in entry.values())
        pairs.append(entry)
    return {'schemaVersion': 1, 'executionCount': 12,
            'summedRunWallSeconds': sum(d['wallSeconds'] for d in datasets), 'datasets': datasets, 'healthyWoundPairs': pairs,
            'scope': 'Two weapons, correction0, actual lateral movement/guard deltas, same3s preparation before torque branch and healthy/no-op versus synthetic applyWound payload.4rows+2observer each. No simulated blade impact, severe injury, drop/regrip, knockdown/recovery, mobile or human acceptance. Damage changes health/controller fields, not native pose/velocity immediately. Full wound handling is actual runtime API; severity/energy are prescribed inputs.'}


def summarize_boundary(directory):
    source = git('rev-parse', '60edb76').decode().strip()
    datasets = []
    for name, prior in [('edge-turn-input-boundary.json', 'edge-turn-guard-from-spawn.json'),
                        ('edge-arm-input-boundary.json', 'edge-arm-cut.json')]:
        raw = (directory/name).read_bytes()
        x, old = json.loads(raw), json.loads((directory/prior).read_bytes())
        assert x['executionPass'] and x['sourceStable']
        assert all(v is not False for c in x['checks']+x['observers'] for v in c.values())
        assert all(p.startswith('node_modules/') or sha(git('show', source+':'+p)) == h
                   for p, h in x['sourceBefore'].items())
        pairs = []
        fields = ['timeS', 'phase', 'heading', 'actualChestRotation', 'actualPelvisRotation', 'pelvisM',
                  'bodyPose', 'guardNearest', 'guardWeight', 'recovering', 'handOffsetM', 'followM',
                  'swordTwistRadps', 'swordOmegaRadps', 'rawAimErrorRad', 'ownAimErrorRad', 'swordKJ', 'maxJointGapM', 'state']
        for row in x['rows']:
            prev = next(r for r in old['rows'] if all(r[k] == row[k] for k in ['weapon', 'scenario', 'level', 'mode']))
            check = {k: row[k] for k in ['weapon', 'scenario', 'level', 'mode']} | {
                'nativeTraceExact': row['nativeTraceSha256'] == prev['nativeTraceSha256'],
                'physicalAndGoalFramesExact': [{k: f[k] for k in fields} for f in row['frames']] == [{k: f[k] for k in fields} for f in prev['frames']],
                'currentInputActiveMatchesDelta': all(f['request']['active'] == (sum(abs(v) for v in f['inputDeltaM']) > 1e-5) for f in row['frames']),
                'oldInputActiveMismatches': sum(f['request']['active'] != (sum(abs(v) for v in f['inputDeltaM']) > 1e-5) for f in prev['frames']),
                'controllerTraceExact': row['controllerTraceSha256'] == prev['controllerTraceSha256']}
            assert check['nativeTraceExact'] and check['physicalAndGoalFramesExact'] and check['currentInputActiveMatchesDelta']
            pairs.append(check)
        datasets.append({'rawFile': name, 'rawSHA256': sha(raw), 'rawBytes': len(raw), 'sourceArchive': source,
                         'sourceArchivesExact': True, 'sourceStable': True, 'command': x['command'],
                         'executionCount': len(x['rows'])+len(x['observers']), 'wallSeconds': x['wallSeconds'],
                         'priorFile': prior, 'nativeAndSelectedFramePairs': pairs, 'pairedChecks': x['checks'], 'observers': x['observers']})
    return {'schemaVersion': 1, 'executionCount': 16, 'summedRunWallSeconds': sum(d['wallSeconds'] for d in datasets),
            'datasets': datasets, 'scope': 'One zero-delta segment-boundary tick at5.1s was erroneously marked active in earlier probes. Main-compatible delta gating changes idle/controller history, so controller hashes are not expected equal to old runs. Twelve representative observed runs plus4observer repeats verify native and listed physical/goal frames exact. These are verification repeats, not new independent successes. Other original hypotheses remain rejected research; no game code changed.'}


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--evidence', type=pathlib.Path, required=True)
    p.add_argument('--out', type=pathlib.Path, required=True)
    p.add_argument('--wound-out', type=pathlib.Path)
    p.add_argument('--boundary-out', type=pathlib.Path)
    args = p.parse_args()
    report = summarize(args.evidence)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'executions': report['executionCount'], 'supersededInputExecutions': 4,
                      'wallSeconds': report['summedRunWallSeconds'], 'archiveReplayExact': True}))
    if args.wound_out:
        wound = summarize_wounds(args.evidence)
        args.wound_out.write_text(json.dumps(wound, ensure_ascii=False, indent=2)+'\n')
        print(json.dumps({'woundExecutions': wound['executionCount'], 'wallSeconds': wound['summedRunWallSeconds'], 'healthyWoundPrefixExact': True}))
    if args.boundary_out:
        boundary = summarize_boundary(args.evidence)
        args.boundary_out.write_text(json.dumps(boundary, ensure_ascii=False, indent=2)+'\n')
        print(json.dumps({'boundaryExecutions': boundary['executionCount'], 'wallSeconds': boundary['summedRunWallSeconds'], 'nativeAndSelectedFramesExact': True}))
