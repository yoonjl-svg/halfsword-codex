"""Archive-check and summarize blade-plane torque experiments; no game execution."""
import argparse
import json
import math
import pathlib
import sys
sys.dont_write_bytecode = True
from summarize_edge_transition import sha, git, phase, alignment

SOURCES = {
    'edge-plane-causal.json': 'bfc16b1',
    'edge-plane-half.json': '15d1538',
    'edge-plane-point-start.json': '15d1538',
    'edge-plane-legacy-start.json': '15d1538',
    'edge-plane-runtime.json': 'f029343',
    'edge-plane-combat.json': 'f029343',
    'edge-plane-tap.json': 'f029343',
    'edge-plane-strokes.json': 'ab23a8d',
}
PHASES = {'all0to6': (0, 6), 'crossTransition': (2.175, 2.4),
          'hold': (3, 3.6), 'reinput': (3.6, 4.4), 'wholeTransition': (3, 5)}


def near_orthogonal(frames):
    count = longest = streak = 0
    peak = None
    for f in frames:
        r = f.get('transition')
        if not r:
            continue
        u, v = r['blade'], r['actualCutPointVelocityMps']
        n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
        speed = math.hypot(*n)
        error = math.acos(min(1, abs(sum(a*b/speed for a, b in zip(r['flat'], n))))) if speed > .5 else None
        if error is not None:
            peak = max(peak or 0, error)
        if error is not None and error >= math.radians(80):
            count += 1
            streak += 1
            longest = max(longest, streak)
        else:
            streak = 0
    return {'speedThresholdMps': .5, 'errorThresholdDegrees': 80,
            'samplesAboveThreshold': count, 'longestContinuousSeconds': longest/120,
            'maxErrorRadAboveSpeedThreshold': peak}


def reduced(r, strokes):
    f = r['frames']
    if strokes:
        phases = {}
        for label in ['stroke', 'pause', 'reinput', 'after', 'all']:
            rows = f if label == 'all' else [v for v in f if v['phase'] == label]
            phases[label] = {'samples': len(rows),
                'peakTwistRadps': max((v['swordTwistRadps'] for v in rows), default=None),
                'twistTravelRad': sum(v['swordTwistRadps']/120 for v in rows),
                'meanRawAimErrorRad': sum(v['originalRawAimErrorRad'] for v in rows)/len(rows) if rows else None}
        return {k: r[k] for k in ['weapon', 'motion', 'ending', 'mode', 'summary', 'firstStepContract', 'prepared', 'nativeTraceSha256', 'traceSha256', 'inputSha256']} | {'phases': phases}
    live = [v for v in f if v['alive'][0] and v['armed'][0]]
    tap = [v for v in live if v['tapActive']]
    def peak(rows):
        p = max(rows, key=lambda v: v['swordTwistRadps'], default=None)
        return {k: p[k] for k in ['timeS', 'phase', 'swordTwistRadps']} if p else None
    return {k: r.get(k) for k in ['weapon', 'seed', 'mode', 'summary', 'final', 'prefixSHA256', 'nativeTraceSha256', 'controllerTraceSha256', 'externalRequestedInputSha256']} | {
        'phases': {key: phase(f, *bounds) for key, bounds in PHASES.items()},
        'actualPlaneAlignment': {key: [alignment(f, *bounds, t) for t in [.5, 2.5]] for key, bounds in PHASES.items()} if any(v.get('transition') for v in f) else None,
        'nearOrthogonal': near_orthogonal(f) if any(v.get('transition') for v in f) else None,
        'wholeLiveArmedPeak': peak(live), 'wholeLiveArmedTapPeak': peak(tap)}


def summarize(directory):
    datasets, loaded = [], {}
    for name, short in SOURCES.items():
        raw = (directory/name).read_bytes()
        x = json.loads(raw)
        loaded[name] = x
        source = git('rev-parse', short).decode().strip()
        assert all(p.startswith('node_modules/') or sha(git('show', source+':'+p)) == h for p, h in x['sourceBefore'].items()), name
        assert x['sourceStable'] and x.get('executionPass', True), name
        if 'combatObserver' in x:
            assert x['optionsRestored'] and all(v is not False for v in x['combatObserver'].values())
        strokes = name == 'edge-plane-strokes.json'
        rows = x.get('rows', x.get('combat'))
        count = len(rows)+(len(x.get('observers', [])) if strokes else int('combatObserver' in x))
        datasets.append({'rawFile': name, 'rawSHA256': sha(raw), 'rawBytes': len(raw),
            'sourceArchive': source, 'sourceRecordedAtStart': x['sourceCommit'],
            'trackedSourceArchiveExact': True, 'sourceStable': x['sourceStable'],
            'command': x['command'], 'wallSeconds': x['wallSeconds'], 'executionCount': count,
            'checks': x.get('checks', x.get('combatObserver')), 'observers': x.get('observers'),
            'rows': [reduced(r, strokes) for r in rows]})
    # Independent archived sources, not two modes using the same new observer.
    old = json.loads((directory/'edge-transition-point.json').read_bytes())
    replay = []
    for r in loaded['edge-plane-causal.json']['rows']:
        if r['mode'] != 'pointIntent':
            continue
        p = next(v for v in old['rows'] if v['mode'] == r['mode'] and v['weapon'] == r['weapon'])
        c = {'scope': 'old point candidate versus new observation', 'weapon': r['weapon'],
             'nativeExact': p['nativeTraceSha256'] == r['nativeTraceSha256'],
             'controllerExact': p['controllerTraceSha256'] == r['controllerTraceSha256']}
        assert c['nativeExact'] and c['controllerExact']
        replay.append(c)
    for r in loaded['edge-plane-runtime.json']['rows']:
        if r['mode'] == 'runtimePlane':
            continue
        p = next(v for v in loaded['edge-plane-legacy-start.json']['rows'] if v['mode'] == r['mode'] and v['weapon'] == r['weapon'])
        c = {'scope': 'before versus after runtime addition', 'weapon': r['weapon'], 'mode': r['mode'],
             'nativeExact': p['nativeTraceSha256'] == r['nativeTraceSha256'],
             'controllerExact': p['controllerTraceSha256'] == r['controllerTraceSha256']}
        assert c['nativeExact'] and c['controllerExact']
        replay.append(c)
    return {'schemaVersion': 1, 'executionCount': sum(d['executionCount'] for d in datasets),
        'summedRunWallSeconds': sum(d['wallSeconds'] for d in datasets), 'datasets': datasets, 'archiveReplay': replay,
        'definitions': {'twist': 'World sword angular velocity projected on blade axis; absolute integral in rad, peak in rad/s. Not forearm-relative wrist travel.',
        'alignment': 'Velocity-weighted acos(abs(flat dot normalize(blade cross cached velocity))). Cached position-difference velocity is delayed; no leading/trailing-edge distinction or cutting-loss measure.',
        'nearOrthogonal': 'All available pre-step records with transverse cached speed>.5m/s. Threshold80deg is reporting only, never a game limit.',
        'windows': 'Simulation frame phases use integer120Hz ticks. all0to6 is not whole combat. WholeLiveArmedPeak covers the full available combat duration. Different death/contact paths prevent same-hit causal comparisons.',
        'strokes': 'From-spawn source includes3s preparation then2.05s observations. Existing summary includes preparation for maxima; reduced phases use only the recorded2.05s. 48paired rows +2unobserved repeats.',
        'cost': 'Run wall time sum includes controls and observer repeats; not independent samples, token cost, project elapsed time or speedup.',
        'limits': 'No full native work/passivity, user/mobile or general-default acceptance.'}}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--evidence', type=pathlib.Path, required=True)
    parser.add_argument('--out', type=pathlib.Path, required=True)
    args = parser.parse_args()
    report = summarize(args.evidence)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'executions': report['executionCount'], 'wallSeconds': report['summedRunWallSeconds'], 'sourceArchivesExact': True, 'archiveReplayExact': True}))
