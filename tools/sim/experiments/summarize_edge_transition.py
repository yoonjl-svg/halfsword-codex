"""Recompute round-two measurements from immutable external raw evidence."""
import argparse
import hashlib
import json
import math
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[3]
SOURCES = {
    'edge-transition-split.json': '7760fc9',
    'edge-transition-c1.json': '70fee0e',
    'edge-transition-motion.json': 'c2183ba',
    'edge-transition-from-start.json': 'c2183ba',
    'edge-transition-runtime-c1.json': 'bc69b22',
    'edge-c1-combat.json': 'bc69b22',
    'edge-transition-alignment.json': 'f84ba88',
    'edge-c1-tap.json': 'f84ba88',
    'edge-transition-point.json': '9a58185',
    'edge-transition-legacy-c1.json': '6e86ca6',
}
PHASES = {'all': (0, 6), 'hold': (3, 3.6), 'reinput': (3.6, 4.4),
          'secondHold': (4.4, 5), 'wholeTransition': (3, 5)}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, check=True, capture_output=True).stdout


def phase(frames, a, b):
    # Post-step samples: integer ticks prevent overlap at floating-point seams.
    rows = [f for f in frames if a*120 < round(f['timeS']*120) <= b*120]
    return {'samples': len(rows),
            'twistTravelRad': sum(abs(f['swordTwistRadps'])/120 for f in rows),
            'twistPeakRadps': max((abs(f['swordTwistRadps']) for f in rows), default=None),
            'rawAimMeanErrorRad': sum(f['rawAimErrorRad'] for f in rows)/len(rows) if rows else None}


def alignment(frames, a, b, threshold):
    weighted = weight = 0
    count = 0
    for frame in frames:
        r = frame.get('transition')
        if not r or 'actualCutPointVelocityMps' not in r or not a*120 <= round(r['timeS']*120) < b*120:
            continue
        u, v = r['blade'], r['actualCutPointVelocityMps']
        n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
        speed = math.hypot(*n)
        if speed <= threshold:
            continue
        dot = abs(sum(f*x/speed for f, x in zip(r['flat'], n)))
        angle = math.acos(min(1, dot))
        weighted += angle*speed
        weight += speed
        count += 1
    return {'samples': count, 'transverseSpeedThresholdMps': threshold,
            'weightedMeanErrorRad': weighted/weight if weight else None}


def summarize(directory):
    datasets, loaded = [], {}
    for name, short in SOURCES.items():
        raw = (directory/name).read_bytes()
        x = json.loads(raw)
        loaded[name] = x
        source = git('rev-parse', short).decode().strip()
        mismatches = [p for p, h in x['sourceBefore'].items()
                      if not p.startswith('node_modules/') and sha(git('show', source+':'+p)) != h]
        assert not mismatches, (name, mismatches)
        assert x['sourceStable'], name
        assert x.get('executionPass', True), name
        if 'combatObserver' in x:
            assert x['optionsRestored'] and all(v is not False for v in x['combatObserver'].values())
        rows = x.get('rows', x.get('combat'))
        reduced = []
        for r in rows:
            f = r['frames']
            live = [v for v in f if v['alive'][0] and v['armed'][0]]
            reduced.append({'weapon': r['weapon'], 'seed': r['seed'], 'mode': r['mode'],
                'summary': r['summary'], 'nativeTraceSha256': r['nativeTraceSha256'],
                'controllerTraceSha256': r['controllerTraceSha256'],
                'prefixSHA256': r.get('prefixSHA256'), 'final': r['final'],
                'liveArmedPlayerPeakTwistRadps': max((abs(v['swordTwistRadps']) for v in live), default=None),
                'phases': {key: phase(f, *bounds) for key, bounds in PHASES.items()},
                'edgeAlignment': {key: [alignment(f, *bounds, t) for t in [.5, 2.5]]
                                  for key, bounds in PHASES.items()} if any(v.get('transition') for v in f) else None})
        datasets.append({'rawFile': name, 'rawSHA256': sha(raw), 'rawBytes': len(raw),
                         'sourceArchive': source, 'sourceRecordedAtStart': x['sourceCommit'],
                         'trackedSourceArchiveExact': True, 'sourceStable': x['sourceStable'],
                         'command': x['command'], 'wallSeconds': x['wallSeconds'],
                         'executionCount': len(rows)+(1 if 'combatObserver' in x else 0),
                         'checks': x.get('checks', x.get('combatObserver')), 'rows': reduced})
    old, new = loaded['edge-transition-from-start.json'], loaded['edge-transition-runtime-c1.json']
    retained = []
    for r in old['rows']:
        n = next(v for v in new['rows'] if v['weapon'] == r['weapon'] and v['mode'] == r['mode'])
        c = {'weapon': r['weapon'], 'mode': r['mode'],
             'nativeExact': r['nativeTraceSha256'] == n['nativeTraceSha256'],
             'controllerExact': r['controllerTraceSha256'] == n['controllerTraceSha256']}
        assert c['nativeExact'] and c['controllerExact']
        retained.append(c)
    return {'schemaVersion': 1, 'datasets': datasets, 'oldSourceReplay': retained,
            'executionCount': sum(d['executionCount'] for d in datasets),
            'summedRunWallSeconds': sum(d['wallSeconds'] for d in datasets),
            'definitions': {'twistTravelRad': 'Sum abs(world sword angular velocity dot current blade axis)*dt, 120Hz. Not forearm-relative wrist travel.',
              'phaseBoundaries': 'Post-step integer ticks a*120 < tick <= b*120; alignment uses corresponding pre-step ticks a*120 <= tick < b*120.',
              'edgeAlignment': 'acos(abs(flat dot normalize(blade cross cached cut-point velocity))), weighted by transverse speed above .5 or2.5m/s. Cached position-difference velocity is delayed; not instantaneous native point velocity, contact-relative speed, loss or damage.',
              'cost': 'Measured run wall seconds summed, including observer/control repeats. Not unique samples, token cost, project elapsed time or speedup.',
              'limits': 'No user/mobile acceptance. Reactive combat follows different contacts and deaths, so same seed is not same-hit comparison. Explicit twist work and free-body torque response are not full native/coupled work.'}}


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--evidence', type=pathlib.Path, required=True)
    p.add_argument('--out', type=pathlib.Path, required=True)
    args = p.parse_args()
    report = summarize(args.evidence)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'executions': report['executionCount'], 'wallSeconds': report['summedRunWallSeconds'],
                      'oldSourceReplayExact': True, 'trackedSourceArchivesExact': True}))
