"""Read-only derivation of explicit upper-body work; no native residual attribution."""
import argparse
import hashlib
import json
import math
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--raw', type=Path, required=True)
p.add_argument('--failed', type=Path, required=True)
p.add_argument('--out', type=Path, required=True)
a = p.parse_args()
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
raw, failed = (json.loads(f.read_text()) for f in (a.raw, a.failed))
assert raw['measurementValid'] and raw['sourceStable']
assert not failed['measurementValid'] and failed['physicsSteps'] == 1
norm = lambda v: math.sqrt(sum(x*x for x in v.values()))
stats = lambda xs: {'mean': sum(xs)/len(xs), 'rms': math.sqrt(sum(x*x for x in xs)/len(xs)), 'max': max(xs)}
roles = ['manualMuscle', 'elbowGravity', 'driveSword', 'offHand']


def derive(row, phase):
    fs = [f for f in row['frames'] if f['phase'] == phase]
    assert fs and all(f['fixedMassBoundary'] for f in fs)
    duration = len(fs)*raw['dt']
    bodies = {}
    for part in [b['part'] for b in fs[0]['selected']]:
        bs = [next(b for b in f['selected'] if b['part'] == part) for f in fs]
        bodies[part] = {'massKg': bs[0]['mass'], 'COMRiseM': bs[-1]['comAfter']['y']-bs[0]['comBefore']['y'],
                        'gravityWorkJ': sum(b['gravityWorkJ'] for b in bs),
                        'deltaKJ': bs[-1]['KAfter']-bs[0]['KBefore'],
                        'COMSpeedMps': stats([norm(b['velocityAfter']) for b in bs])}
    paths = {}
    for role in roles:
        ps = [f['paths'].get(role, {}) for f in fs]
        parts = sorted(set(b for x in ps for b in x.get('bodies', {})))
        result = {'observedFrames': sum(bool(x) for x in ps),
                  'midpointWorkApproxJ': sum(x.get('midpointWorkApproxJ', 0) for x in ps),
                  'atCallWorkApproxJ': sum(c['powerAtCallW']*raw['dt'] for f in fs for c in f['calls'] if c['role'] == role),
                  'maxNetForceN': max(norm(x.get('netForceN', dict(x=0, y=0, z=0))) for x in ps),
                  'maxNetTorqueAboutFixedOriginNm': max(norm(x.get('netTorqueAboutOriginNm', dict(x=0, y=0, z=0))) for x in ps), 'bodies': {}}
        for part in parts:
            bs = [x.get('bodies', {}).get(part, {}) for x in ps]
            result['bodies'][part] = {
                'midpointWorkApproxJ': sum(x.get('midpointWorkApproxJ', 0) for x in bs),
                'atCallWorkApproxJ': sum(c['powerAtCallW']*raw['dt'] for f in fs for c in f['calls'] if c['role'] == role and c['body'] == part),
                'torqueCOMNm': stats([norm(x.get('torqueCOMNm', dict(x=0, y=0, z=0))) for x in bs]),
                'forceN': stats([norm(x.get('forceN', dict(x=0, y=0, z=0))) for x in bs])}
        paths[role] = result
    gravity = {}
    for key, predicate in {
        'shoulderRawMoment': lambda c: c['localX'] < 0,
        'elbowRawMoment': lambda c: c['pivot'] == 'uarmS' and c['localX'] > 0,
        'wristRawMoment': lambda c: c['pivot'] == 'farmS',
    }.items():
        values = [norm(c['rawGravityMomentNm']) for f in fs for c in f['gravityCalls'] if predicate(c)]
        gravity[key] = stats(values) if values else None
    return {'weapon': row['weapon'], 'phase': phase, 'ticksInclusive': [fs[0]['tick'], fs[-1]['tick']], 'durationS': duration,
            'bodies': bodies, 'paths': paths, 'rawGravityMomentNm': gravity,
            'handErrorM': stats([f['actual']['handErrorM'] for f in fs]),
            'aimErrorDeg': stats([math.degrees(f['actual']['aimErrorRad']) for f in fs]),
            'tipSpeedMps': stats([f['actual']['tipSpeedMps'] for f in fs]),
            'exposure': {'heldFrames': sum(f['actual']['handHeld'] for f in fs), 'activeFrames': sum(f['actual']['inputActive'] for f in fs),
                         'grippingFrames': sum(f['actual']['gripping'] for f in fs), 'swingingFrames': sum(f['actual']['swinging'] for f in fs),
                         'owners': sorted(set(f['actual']['owner'] for f in fs)), 'controllerPhases': sorted(set(f['actual']['phase'] for f in fs))}}


report = {
    'schemaVersion': 1, 'measurementAccepted': True, 'runtimeChange': False, 'effectAccepted': False,
    'judgment': 'Observation complete for two weapons and raising/holding. Gravity opposes the actual rise; explicit active support and paired reactions are present. No new runtime candidate is warranted by this observation alone. P1 human weight feel and P3 full native body-energy transfer remain unestablished.',
    'baseCommit': raw['baseCommit'], 'artifactHead': raw['artifactHead'],
    'raw': {'path': str(a.raw), 'sha256': sha(a.raw)}, 'failedRaw': {'path': str(a.failed), 'sha256': sha(a.failed)},
    'derive': {'path': str(Path(__file__).resolve()), 'sha256': sha(Path(__file__))},
    'reproduceDerivation': f'python tools/sim/experiments/raise_hold_report.py --raw={a.raw} --failed={a.failed} --out=/tmp/raise-hold-derived.json',
    'physicsCommand': raw['command'], 'sourceManifest': raw['sourceBefore'], 'sourceStable': raw['sourceStable'],
    'protocol': raw['protocol'], 'definitions': raw['definitions'], 'limitations': raw['limitations'],
    'runAccounting': {'actualExecutions': raw['newPhysicsExecutions']+failed['newPhysicsExecutions'],
                      'actualSteps': raw['physicsSteps']+failed['physicsSteps'], 'validExecutions': 2, 'validAnalysisRows': 4,
                      'failedExecutions': 1, 'failedSteps': 1, 'nativeWallSeconds': raw['wallSeconds']+failed['wallSeconds'],
                      'repeatDownwardPhysics': 0, 'newRuntimeCandidates': 0},
    'fixtureCorrection': {'failure': failed['error']['message'],
        'explanation': 'Original fixed-property assertion included the initialization tick. Corrected runs expose principal-inertia initialization of the main upper/forearm at tick0. The 60-step ready window is excluded from analysis; all measured raise/hold steps have fixed properties. Analysis boundary is explicit upper body, excluding dynamic gait foot mass.',
        'unchangedFirstStepNative': raw['rows'][0]['frames'][0]['nativeSHA256'] == failed['rows'][0]['frames'][0]['nativeSHA256'],
        'initializationChanges': {r['weapon']: [{'tick': f['tick'], 'changes': f['massPropertyChanges']} for f in r['frames'] if f['massPropertyChanges']] for r in raw['rows']}},
    'rows': [derive(r, ph) for r in raw['rows'] for ph in ['raise', 'hold_late']],
    'settlingSupplement': [derive(r, 'hold_settle') for r in raw['rows']],
    'previousDownwardEvidence': 'docs/strike/v2_weight_work_20261005.json; reused only, different schedule and quadrature. Not a matched up/down causal comparison.',
    'nextMinimum': 'Use these observed support paths when a concrete weight/effort defect is reproduced; no automatic gravity or force changes. A full native transfer claim needs actual native joint/motor impulse/work observation, not an energy residual. Human weight feel needs a playable comparison reviewed by the user.'}
assert report['fixtureCorrection']['unchangedFirstStepNative']
a.out.parent.mkdir(parents=True, exist_ok=True)
a.out.write_text(json.dumps(report, indent=2, ensure_ascii=False)+'\n')
print(json.dumps({'out': str(a.out), 'rows': len(report['rows']), 'accounting': report['runAccounting']}, ensure_ascii=False))
