#!/usr/bin/env python3
"""Verify and summarize recorded real-game response; never rerun physics.

Stopping faster is not an acceptance criterion. Inertia and finite strength are
intentional. Derived terms, native responses and local policy effects are separate.
"""
import argparse, hashlib, json, math, subprocess
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--baseline', required=True)
p.add_argument('--policy', required=True)
p.add_argument('--out', required=True)
args = p.parse_args()
repo = Path(__file__).resolve().parents[3]
out = Path(args.out)
assert not out.exists(), 'Use a new output file'
sha = lambda b: hashlib.sha256(b).hexdigest()
norm = lambda v: math.sqrt(sum(x*x for x in v))

def verify(filename):
    path = Path(filename); data = path.read_bytes(); r = json.loads(data)
    assert r['measurementValid'] and r['sourceStable'] and r['referenceSourceCompatible']
    assert r['executionCount'] == len(r['rows'])
    for f, digest in r['sourceBefore'].items():
        b = (repo/f).read_bytes() if f.startswith('node_modules/') else subprocess.check_output(
            ['git', '-C', str(repo), 'show', r['sourceCommit']+':'+f])
        assert sha(b) == digest, f
    assert r['sourceBefore'] == r['sourceAfter']
    checks = 0
    for row in r['rows']:
        for field, result in [('nativeSha256','nativeTraceSha256'),
                              ('fullControllerSha256','fullControllerTraceSha256'),
                              ('physicalControllerSha256','physicalControllerTraceSha256')]:
            assert sha(''.join(f[field] for f in row['traceFrames']).encode()) == row[result]
        assert row['branch'] and row['finite'] and not row['firstDeath'] and not row['firstDrop']
        assert all(n == 60 for n in row['dispatchCounts'].values())
        for m in row['metrics']:
            call = next(c for c in m['pathDispatch'] if c['method'] == 'driveSword')
            d = call['derivedResponse']; check = d['originalOutputCheck']
            errors = [check[k] for k in ['capError','torqueError','hillError']]
            assert all(isinstance(e,(int,float)) and math.isfinite(e) and e <= 1e-9 for e in errors)
            assert check['latchExact'] and all(c['restoredFilterExact'] for c in m['pathDispatch'])
            assert d['before']['incomingBrakeAngle'] == call['wristBrakeAng'], 'These episodes have no latch entry'
            a = call['wristBrakeAng']; assert a is None or math.isfinite(a)
            assert not call['wristBrake'] and d['before']['thrustWeight'] == 0
            assert d['before']['skillLevel'] == 0
            if 'latchAngleExact' in check: assert check['latchAngleExact']
            if r['protocol'].get('holdDamping'):
                assert call['holdDampingApplied'] and all(c['weaponCfgRestored'] for c in m['pathDispatch'])
                assert d['configuredReleaseDamping'] == d['configuredAimDamping'] == 11
            checks += 1
    return r, {'bytes': len(data), 'sha256': sha(data), 'sourceCommit': r['sourceCommit'],
               'executions': r['executionCount'], 'wallSeconds': r['wallSeconds'],
               'derivedRowsFiniteAndLatchAngleVerifiedOffline': checks,
               'sourceAndRecordedTraceHashesReverified': True}

baseline, br = verify(args.baseline)
policy, pr = verify(args.policy)
assert not baseline['protocol'].get('holdDamping') and policy['protocol']['holdDamping']
assert baseline['requestedScheduleSha256'] == policy['requestedScheduleSha256']
assert baseline['sourceBefore']['src/fighter.js'] == policy['sourceBefore']['src/fighter.js']
for f, digest in baseline['sourceBefore'].items():
    if not f.startswith('tools/sim/experiments/'):
        assert policy['sourceBefore'][f] == digest, f
base = next(r for r in baseline['rows'] if r['mode'] == 'full' and r['observed'])
variant = next(r for r in policy['rows'] if r['observed'])
assert base['branch'] == variant['branch']
fields = ['nativeSha256','fullControllerSha256','physicalControllerSha256',
          'requestSha256','plannedRequestSha256','appliedInputPrefixSha256','eventsPrefixSha256']
assert all(all(a[k] == b[k] for k in fields) for a,b in
           zip(base['traceFrames'][:base['branch']['tick']], variant['traceFrames'][:variant['branch']['tick']]))

def stats(values):
    return {'min': min(values), 'mean': sum(values)/len(values), 'max': max(values)}

def aggregate(ms):
    ds = [next(c for c in m['pathDispatch'] if c['method']=='driveSword')['derivedResponse'] for m in ms]
    return {'steps':len(ms),
      'beforeCallAngleRad':stats([d['angleRad'] for d in ds]),
      'postSolverMeanAngleRad':sum(m['ownAimErrorRad'] for m in ms)/len(ms),
      'postSolverMeanHandErrorM':sum(m['handErrorM'] for m in ms)/len(ms),
      'postSolverFinalAngleRad':ms[-1]['ownAimErrorRad'],
      'meanSwordKJ':sum(m['swordKJ'] for m in ms)/len(ms),
      'meanTotalSwordOmegaRadps':sum(m['swordOmegaRadps'] for m in ms)/len(ms),
      'maxTotalSwordOmegaRadps':max(m['swordOmegaRadps'] for m in ms),
      'towardRadps':stats([d['towardRadps'] for d in ds]),
      'targetTowardRadps':stats([d['targetTowardRadps'] for d in ds]),
      'targetBeforeClampRadps':stats([norm(d['targetOmegaBeforeClamp']) for d in ds]),
      'yawOnlyCounterfactualRadps':stats([norm(d['yawOnlyCounterfactualRate']) for d in ds]),
      'localOnlyCounterfactualRadps':stats([norm(d['localOnlyCounterfactualRate']) for d in ds]),
      'positionRequestNm':stats([norm(d['positionTorqueNm']) for d in ds]),
      'dampingRequestNm':stats([norm(d['dampingTorqueNm']) for d in ds]),
      'capAfterHillNm':stats([d['capAfterHillNm'] for d in ds]),
      'capSaturatedSteps':sum(d['capSaturated'] for d in ds),
      'lowerDampingSteps':sum(d['releaseSelected'] for d in ds),
      'releaseBranchSteps':sum(d.get('releaseBranchEntered', d['releaseSelected']) for d in ds),
      'negativeInstantaneousDampingSwordPowerSteps':sum(d['dampingInstantaneousSwordPowerW']<0 for d in ds),
      'maxSwordKJ':max(m['swordKJ'] for m in ms),
      'maxBodyAndSwordKJ':max(m['bodyAndSwordKJ'] for m in ms),
      'maxGapM':max(m['maxGapM'] for m in ms),
      'maxSolverPointHorizontalMps':max(p['horizontalMps'] for m in ms for s in m['support'] for p in s['points']),
      'maxPelvisUpwardMps':max(m['pelvisVelocityMps'][1] for m in ms)}

first_effect = None; first_event_difference = None; exact_steps_before_effect = 0
tick0 = base['branch']['tick']
for i, (a,b) in enumerate(zip(base['metrics'], variant['metrics'])):
    fa = base['traceFrames'][tick0+i]; fb = variant['traceFrames'][tick0+i]
    assert fa['requestSha256'] == fb['requestSha256'] and fa['plannedRequestSha256'] == fb['plannedRequestSha256']
    assert fa['appliedOffsetM'] == fb['appliedOffsetM']
    request = baseline['schedule'][tick0+i]
    assert request['held'] and not request['active'] and max(abs(x) for x in request['deltaM']) <= 1e-12
    da = next(c['derivedResponse'] for c in a['pathDispatch'] if c['method']=='driveSword')
    db = next(c['derivedResponse'] for c in b['pathDispatch'] if c['method']=='driveSword')
    if first_effect is None:
        if a['wristSwingBeforeTwistNm'] != b['wristSwingBeforeTwistNm']:
            assert da['before'] == db['before'], 'First changed dispatch must begin at same real call state'
            assert da['releaseSelected'] and db['releaseBranchEntered']
            first_effect = {'tick':a['tick'], 'callTimeS':a['timeS']-baseline['protocol']['DT'],
              'postStepTimeS':a['timeS'], 'beforeCallStateExact':True,
              'baselineDerived':da, 'policyDerived':db,
              'baselineFinalTorques':a['actualTorques'], 'policyFinalTorques':b['actualTorques'],
              'baselinePostSolverSwordOmega':a['postSolverSwordOmega'], 'policyPostSolverSwordOmega':b['postSolverSwordOmega'],
              'baselinePostSolverElbow':a['postSolverElbow'], 'policyPostSolverElbow':b['postSolverElbow']}
        else:
            assert all(fa[k] == fb[k] for k in fields)
            exact_steps_before_effect += 1
    if first_event_difference is None and fa['eventsPrefixSha256'] != fb['eventsPrefixSha256']:
        first_event_difference = {'tick':a['tick'], 'postStepTimeS':a['timeS']}
assert first_effect, 'Policy never affected the original dispatch'
summary = {'schemaVersion':1,'measurementValid':True, 'raw':{'observation':br,'policy':pr},
  'executionCount':br['executions']+pr['executions'], 'branch':base['branch'],
  'audioCompatibility':baseline['audioCompatibility'],
  'observerChecks':baseline['observerChecks']+policy['observerChecks'],
  'prefixChecks':baseline['prefixChecks']+policy['prefixChecks'],
  'aggregationScriptSHA256':sha(Path(__file__).read_bytes()),
  'observations':[{'activationMode':r['mode'],'entireWindow':aggregate(r['metrics'])}
                  for r in baseline['rows'] if r['observed']],
  'policyEntireWindow':aggregate(variant['metrics']),
  'affectedWindow':{'baseline':aggregate(base['metrics'][exact_steps_before_effect:]),
                    'policy':aggregate(variant['metrics'][exact_steps_before_effect:])},
  'postBranchExactStepsBeforeFirstPolicyEffect':exact_steps_before_effect,
  'firstPolicyEffect':first_effect, 'firstRecordedEventDifference':first_event_difference,
  'publicCandidateAccepted':False, 'generalDefaultPromotionAccepted':False,
  'definitions':{
    'purpose':'Separate target filtering, low-damping release policy and bounded physical response. Faster stopping is not an acceptance criterion; inertia and finite strength are intentional.',
    'episodes':'One recorded sabre19 recovery scene with healthy main arm and injured off-arm. Six executions include two activation diagnostics and observer checks, not six independent injury cases.',
    'derived':'Read-only source reconstruction agrees with original cap/Hill/latch/pre-twist outputs; agreement does not independently instrument every intermediate.',
    'counterfactualRates':'Yaw-only and local-only finite-angle rates are not an additive decomposition.',
    'power':'Instantaneous pre-solver sword power, not native integrated work. Relative-target residual power is a controller diagnostic, not recipient mechanical work.',
    'policy':'Temporary original driveSword config substitution releaseDamping=aimDamping changes damping policy; same configured strength/cap is not equal delivered torque or equal budget.',
    'wholeWindow':'Later reactive AI and contact changes are episode effects, not same-state direct mechanism.',
    'foot':'Last-solver contact point speed, not loaded slip, whole ground impulse or COP.'}}
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'output':str(out),'raw':summary['raw'],'firstPolicyEffectTick':first_effect['tick'],
                  'exactStepsBeforePolicyEffect':exact_steps_before_effect,
                  'firstRecordedEventDifference':first_event_difference,
                  'observations':summary['observations'],'policy':summary['policyEntireWindow']},ensure_ascii=False))
