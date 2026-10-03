#!/usr/bin/env python3
"""Verify recorded source/trace hashes and summarize actual same-state arm path contrasts.

Use --raw=RECEIVED_OR_NEW_RAW --out=NEW_SUMMARY. This script does not rerun physics.
Last-substep solver point speed is not per-point loaded slip; pre-solver power
samples are not integrated native motor or whole-body physiological work.
"""
import json, hashlib, statistics, math
from pathlib import Path
import argparse, subprocess
parser=argparse.ArgumentParser()
parser.add_argument('--raw',required=True);parser.add_argument('--out',required=True)
args=parser.parse_args();raw=Path(args.raw)
out=Path(args.out);assert not out.exists(), 'Use a new output file'
repo=Path(__file__).resolve().parents[3]
r=json.loads(raw.read_text())
assert r['measurementValid'] and r['referenceSourceExact'] and r['sourceStable'] and r['executionCount']==len(r['rows']) and r['executionCount'] in [2,6]
for file, digest in r['sourceBefore'].items():
    data=(repo/file).read_bytes() if file.startswith('node_modules/') else subprocess.check_output(['git','-C',str(repo),'show',r['sourceCommit']+':'+file])
    assert hashlib.sha256(data).hexdigest()==digest, file
for row in r['rows']:
    for field,result in [('nativeSha256','nativeTraceSha256'),('fullControllerSha256','fullControllerTraceSha256'),('physicalControllerSha256','physicalControllerTraceSha256')]:
        assert hashlib.sha256(''.join(f[field] for f in row['traceFrames']).encode()).hexdigest()==row[result], (row['mode'],field)
obs=[x for x in r['rows'] if x['observed']]
base=next(x for x in obs if x['mode']=='full')
def avg(x): return sum(x)/len(x) if x else None
def max0(x): return max(x,default=None)
def norm(x): return math.sqrt(sum(y*y for y in x))
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def aggregate(ms):
    pts=[p['horizontalMps'] for f in ms for manifold in f['support'] for p in manifold['points']]
    paths={}
    for name in ['driveSword','driveJoints','elbowGravity']:
        bypart={}
        for f in ms:
            for t in f['actualTorques']:
                if t['actuator']==name:
                    p=bypart.setdefault(t['part'],{'maxAppliedTorqueNm':0,'sumAbsPreSolverPowerTimesDtProxyJ':0})
                    p['maxAppliedTorqueNm']=max(p['maxAppliedTorqueNm'],norm(t['torqueNm']))
                    p['sumAbsPreSolverPowerTimesDtProxyJ']+=abs(t['instantaneousPowerW'])*r['protocol']['DT']
        paths[name]=bypart
    target_rates=[]; negative_sword_power=0
    for frame in ms:
        call=next(d for d in frame['pathDispatch'] if d['method']=='driveSword')
        previous,current=call['previousAim'],call['currentAim']
        if previous:
            cross=[previous[1]*current[2]-previous[2]*current[1],previous[2]*current[0]-previous[0]*current[2],previous[0]*current[1]-previous[1]*current[0]]
            target_rates.append(norm(cross)/r['protocol']['DT'])
        sword=next((t for t in frame['actualTorques'] if t['actuator']=='driveSword' and t['part']=='sword'),None)
        negative_sword_power+=int(sword is not None and sword['instantaneousPowerW']<0)
    return {'steps':len(ms),'durationS':len(ms)*r['protocol']['DT'],
      'maxUnprojectedAimCrossOverDtRadps':max0(target_rates),'meanUnprojectedAimCrossOverDtRadps':avg(target_rates),
      'negativeExplicitSwordTorquePowerSteps':negative_sword_power,
      'meanHandErrorM':avg([x['handErrorM'] for x in ms]),'meanOwnAimErrorRad':avg([x['ownAimErrorRad'] for x in ms]),
      'meanExternalAimErrorRad':avg([x['externalRawAimErrorRad'] for x in ms]),
      'maxSwordKJ':max0([x['swordKJ'] for x in ms]),'maxBodyAndSwordKJ':max0([x['bodyAndSwordKJ'] for x in ms]),
      'maxGapM':max0([x['maxGapM'] for x in ms]),'maxSolverPointHorizontalMps':max0(pts),
      'swordWholeRotationIntegralRad':sum(x['swordOmegaRadps']*r['protocol']['DT'] for x in ms),
      'maxPelvisUpwardMps':max0([x['pelvisVelocityMps'][1] for x in ms]),
      'wristBrakeSteps':sum(bool(x['wristBrake']) for x in ms),
      'maxReactionTorqueClosureNm':max0([norm(v) for x in ms for v in x['pathTorqueReactionClosureNm'].values()]),
      'appliedTorquesByPathAndRecipient':paths}
summary={'schemaVersion':1,'probe':r['probe'],'sourceCommit':r['sourceCommit'],'sourceBefore':r['sourceBefore'],
 'sourceStable':r['sourceStable'],'measurementValid':True,'sourceAndRecordedTraceHashesReverified':True,'referenceSourceExact':True,'raw':{'path':str(raw),'bytes':raw.stat().st_size,'sha256':hashlib.sha256(raw.read_bytes()).hexdigest()},
 'reference':r['reference'],'wallSeconds':r['wallSeconds'],'protocol':r['protocol'],'executionCount':r['executionCount'],
 'prefixChecks':r['prefixChecks'],'observerChecks':r['observerChecks'],'branch':base['branch'],'firstActualArmWound':base['firstArmWound'],'aggregationScriptSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
 'comparisons':[], 'publicReleaseAccepted':False,'generalDefaultPromotionAccepted':False,
 'definitions':{'pathClosure':'Sum of explicit recipient torques, a reaction-pair closure residual, not force budget.',
 'preSolverPower':'Instantaneous actual explicit-recipient power; summed absolute power*DT is only a pre-solver effort proxy, not integrated native/constraint/muscle work.',
 'directWindow':'Same recorded strike/clash prefix and alive+armed+getup state. Persistent solver contacts may already differ; direct first-step path requests are the strongest same-state contrast.',
 'fullWindow':'Same external schedule from same candidate-history branch with reactive AI. Changed subsequent events are part of the total local episode effect. Not population efficacy.',
 'footSpeed':'All fixed-ground solver point horizontal speeds at last solver substep, not loaded-foot slip or COP.',
 'allOrdinary':'Ablation of activation consumption after an independent-from-spawn history; not an ordinary-from-spawn treatment.'}}
for run in obs:
    a=base['metrics'];b=run['metrics'];assert len(a)==len(b)==60
    aa=base['traceFrames'][base['branch']['tick']:];bb=run['traceFrames'][run['branch']['tick']:]
    input_request_exact=all(x['requestSha256']==y['requestSha256'] and x['plannedRequestSha256']==y['plannedRequestSha256'] for x,y in zip(aa,bb))
    pad_exact=all(x['appliedOffsetM']==y['appliedOffsetM'] for x,y in zip(aa,bb))
    request_zero=all(not r['schedule'][x['tick']]['active'] and r['schedule'][x['tick']]['held'] and max(abs(v) for v in r['schedule'][x['tick']]['deltaM'])<=1e-12 for x in b)
    direct=[];common=[];wounded=[];boundary=None
    for x,y,fx,fy in zip(a,b,aa,bb):
        comparable=all(z['health']['alive'] and z['health']['armed'] and z['enemyHealth']['alive'] and z['health']['state']=='getup' for z in [x,y])
        if comparable:
            common.append((x,y))
            if x['health']['armHealth']<1 and y['health']['armHealth']<1: wounded.append((x,y))
        if boundary is None:
            if fx['eventsPrefixSha256']!=fy['eventsPrefixSha256'] or not comparable or x['health']['state']!=y['health']['state']:
                boundary={'tick':y['tick'],'postStepTimeS':y['timeS'],'cause':'recordedEventOrLifecycleDivergence'}
            else: direct.append((x,y))
    f=b[0]
    first={'timeS':f['timeS'],'health':f['health'],'activationFilter':f['armActivation'],
      'pathDispatch':f['pathDispatch'],'actualTorques':f['actualTorques'],'shoulderRequests':f['shoulderRequests'],
      'elbowMotorRequests':f['elbowMotorRequests'],'jointTargets':f['jointTargets'],'wristCapNm':f['wristCapNm'],
      'wristSwingBeforeTwistNm':f['wristSwingBeforeTwistNm'],'wristBrake':f['wristBrake'],
      'wristHill':f['wristHill'],'swordKJ':f['swordKJ'],'bodyAndSwordKJ':f['bodyAndSwordKJ'],
      'handErrorM':f['handErrorM'],'ownAimErrorRad':f['ownAimErrorRad'],'maxGapM':f['maxGapM'],
      'maxSolverPointHorizontalMps':max0([p['horizontalMps'] for m in f['support'] for p in m['points']])}
    consumed={name:sum(any(d['method']==name and d['consumedActivation']-d['ordinaryActivation']>1e-12 for d in x['pathDispatch']) for x in b) for name in ['driveSword','driveJoints','elbowGravity']}
    summary['comparisons'].append({'mode':run['mode'],'zeroDeltaToleranceM':1e-12,'maxRequestedDeltaM':max(abs(v) for f in b for v in r['schedule'][f['tick']]['deltaM']),'requestExact':input_request_exact,'livePadExact':pad_exact,'allRequestsHeldZeroDelta':request_zero,
      'latentFilterRecoverySteps':run['latentFilterRecoverySteps'],'actualExtraActivationStepsByPath':consumed,
      'firstStep':first,'firstRecordedEventOrLifecycleBoundary':boundary,
      'directWindow':{'full':aggregate([x for x,y in direct]),'variant':aggregate([y for x,y in direct])},
      'commonRecoveryWindow':{'full':aggregate([x for x,y in common]),'variant':aggregate([y for x,y in common])},
      'commonWoundedRecoveryWindow':{'full':aggregate([x for x,y in wounded]),'variant':aggregate([y for x,y in wounded])},
      'entireWindow':aggregate(b),'firstDrop':run['firstDrop'],'firstDeath':run['firstDeath']})
assert all(c['requestExact'] and c['livePadExact'] and c['allRequestsHeldZeroDelta'] for c in summary['comparisons'])
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print('summary',out,'raw',summary['raw'],'wallSeconds',r['wallSeconds'])
print('branch',base['branch']['timeS'],base['branch']['health'],'activation',base['branch']['activation'])
for c in summary['comparisons']:
 print('\nMODE',c['mode'],'exposure',c['actualExtraActivationStepsByPath'],'directSteps',c['directWindow']['variant']['steps'],'boundary',c['firstRecordedEventOrLifecycleBoundary'])
 f=c['firstStep'];print('FIRST',json.dumps({'pathDispatch':f['pathDispatch'],'torques':f['actualTorques'],'shoulder':f['shoulderRequests'],'elbow':f['elbowMotorRequests'],'capNm':f['wristCapNm'],'handErrorM':f['handErrorM'],'aimErrorRad':f['ownAimErrorRad'],'swordKJ':f['swordKJ'],'bodyKJ':f['bodyAndSwordKJ'],'footSpeedMps':f['maxSolverPointHorizontalMps']},ensure_ascii=False))
 for scope in ['directWindow','commonRecoveryWindow','commonWoundedRecoveryWindow']:
  print(scope,json.dumps({k:v for k,v in c[scope]['variant'].items() if k!='appliedTorquesByPathAndRecipient'},ensure_ascii=False))
