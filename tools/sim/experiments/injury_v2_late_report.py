"""Read the one archived-injury late-v2 diagnostic; never run physics."""
import argparse, hashlib, json, math
from pathlib import Path
from collections import Counter

p = argparse.ArgumentParser()
p.add_argument('--raw', required=True)
p.add_argument('--out', required=True)
a = p.parse_args()
raw = Path(a.raw)
blob = raw.read_bytes()
d = json.loads(blob)
assert d['measurementValid']
out = Path(a.out)
assert not out.exists()
r = d['row']
frames = [f for f in r['frames'] if f['tick'] > d['protocol']['boundary']]
drives = {x['tick']: x for x in r['drive']}
requests = {x['tick']: x for x in r['requests']}
phases = {}
for name in [x['name'] for x in d['protocol']['phases']]:
    fs = [x for x in frames if x['phase'] == name]
    ds = [drives[x['tick']] for x in fs]
    calls = [c for x in ds for c in x['calls'] if c['part'] == 'sword']
    phases[name] = {
        'ticks': [fs[0]['tick'], fs[-1]['tick']], 'steps': len(fs),
        'acceptedRequests': sum(requests[x['tick']]['accepted'] for x in fs),
        'controllerPhases': dict(Counter(x['post']['v2']['phase'] for x in fs)),
        'controllerOwners': dict(Counter(x['post']['v2']['owner'] for x in fs)),
        'availabilityRange': [min(x['post']['v2']['availability'] for x in fs), max(x['post']['v2']['availability'] for x in fs)],
        'preDrivePainRange': [min(x['pre']['pain'] for x in ds), max(x['pre']['pain'] for x in ds)],
        'mainArmHealthRange': [min(x['p']['armHealth'] for x in fs), max(x['p']['armHealth'] for x in fs)],
        'actualSwordTorqueCalls': len(calls),
        'actualSwordTorquePeakNm': max((c['magnitudeNm'] for c in calls), default=0),
        'swingCapRangeNm': [min(x['postDebug']['swingCap'] for x in ds), max(x['postDebug']['swingCap'] for x in ds)],
        'maxCappedSwingToCapRatio': max(math.sqrt(sum(v*v for v in x['postDebug']['swing'])) / x['postDebug']['swingCap'] for x in ds),
        'actualTotalToSwingCapRatioMax': max(c['magnitudeNm']/x['postDebug']['swingCap'] for x in ds for c in x['calls'] if c['part'] == 'sword'),
        'handRequestedTargetErrorPeakM': max(x['p']['measurement']['handErrorM'] for x in fs),
        'handRequestedTargetErrorEndM': fs[-1]['p']['measurement']['handErrorM'],
        'tipSpeedPeakMps': max(x['observed']['tipVelocityMps'] for x in fs),
        'swordAxialPeakRadps': max(abs(x['observed']['axialOmegaRadS']) for x in fs),
        'jointGapPeakM': max(x['p']['gapM'] for x in fs),
        'gripGapPeakM': max(x['observed']['gripGapM'] for x in fs),
        'playerStates': dict(Counter(x['p']['state'] for x in fs)),
        'allAliveArmedValidGrip': all(x['post']['alive'] and x['post']['armed'] and x['post']['gripValid'] for x in fs),
        'postWoundCountAtEnd': len(fs[-1]['p']['wounds']),
    }

arm = r['handover']['before']['armHealth']
t = max(0, min(1, (arm-.25)/(.8-.25)))
first_available = next((x for x in frames if x['post']['v2']['availability'] > 0), None)
axial_peak = max(frames, key=lambda x: abs(x['observed']['axialOmegaRadS']))
result = {
    'schemaVersion': 1, 'head': d['head'],
    'scope': d['protocol']['scope'],
    'decision': {'lateHandoverInputAndPartialArmAvailabilityObserved': True,
                 'fromSpawnCurrentV2MajorInjuryGateComplete': False,
                 'runtimeChanged': False, 'naturalnessAccepted': False,
                 'AorBEfficacyAccepted': False},
    'newPhysicsExecutions': 1, 'newSteps': len(r['frames']), 'wallSeconds': d['wallSeconds'],
    'raw': {'path': str(raw), 'bytes': len(blob), 'sha256': hashlib.sha256(blob).hexdigest()},
    'reference': d['reference'], 'sourceStable': d['sourceStable'], 'bridge': d['bridge'],
    'controllerCompatibility': d['controllerCompatibility'], 'checks': d['checks'],
    'command': d['command'], 'protocol': d['protocol'], 'handover': r['handover'],
    'firstActualDrive': r['drive'][0]['pre'],
    'largestObservedAxialRotation': {
        'tick': axial_peak['tick'], 'phase': axial_peak['phase'],
        'axialRadps': axial_peak['observed']['axialOmegaRadS'],
        'context': axial_peak['post'], 'contacts': axial_peak['observed']['contacts'],
        'preHandoverAxialRadps': r['frames'][d['protocol']['boundary']]['observed']['axialOmegaRadS'],
        'interpretation': 'Large axial rotation remains with actual opposing contacts. Diverged controls/contact history preclude attributing it to v2, pain or inheritance alone. No stability/naturalness acceptance.'},
    'firstPositiveAvailability': None if first_available is None else {
        'tick': first_available['tick'], 'timeS': first_available['timeS'],
        'context': first_available['post']},
    'physicalArmStrengthFactor': .35+.65*arm,
    'painFreeArmAvailabilityExpected': t*t*(3-2*t),
    'phases': phases, 'final': r['final'],
    'limits': [
        'The actual injury occurred in legacy Qinggang/box gameplay, then current v2 plus manual was applied. This does not expose severe injury reached from ordinary v2 spawn.',
        'Handover deliberately changes Skill level, assist goals and manual mapping. Native body state/health/pain remain unchanged at the instant, but subsequent pose behavior cannot establish an efficacy effect of v2 alone.',
        '240 fixed release steps permit natural pain decay before the180-step input tape; the enemy remains active. No health, pain, availability, strength, velocity or wound overwrite.',
        'Availability is optional guidance strength, not overall muscle health or the percentage of all player input accepted.',
        'Immediately after applySwordsmanship the stored availability1 is an initialization value. The first actual drive updates it to0 under existing pain; it is not evidence of full guidance acting at handover.',
        'Actual sword/farmS addTorque calls inside driveSword are observed, excluding other motor work and the chest share. Capped swing torque precedes unchanged separate axial alignment torque, so final magnitude can exceed that scalar swing cap.',
        'Hand error uses requested world handTarget before IK reach clamp, not joint-target error. No naturalness or precise tracking acceptance.',
        'Scripted physics-time gestures use the main held/L1 contract, not mobile wall-time/hitstop cadence.',
    ],
    'next': 'Keep the independent from-spawn-v2 large-partial-injury gate open. Reuse an exposed natural injury from an already-needed combat; do not repeat this late-handover row or search seeds merely to add samples.',
}
out.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'out': str(out), 'firstPositiveAvailability': result['firstPositiveAvailability'],
                  'phases': {k: {x: v[x] for x in ['steps','acceptedRequests','controllerPhases','availabilityRange','allAliveArmedValidGrip']} for k,v in phases.items()}}, ensure_ascii=False))
