"""Summarize one partial-injury input gate without executing game physics."""
import argparse, json, hashlib, math
from pathlib import Path
from collections import Counter
p=argparse.ArgumentParser()
for key in ['raw','selection','out']:p.add_argument('--'+key,required=True)
a=p.parse_args();raw=Path(a.raw);blob=raw.read_bytes();d=json.loads(blob);assert d['measurementValid']
out=Path(a.out);assert not out.exists();sel=Path(a.selection);inventory=json.loads(sel.read_text())
r=d['row'];drive={x['tick']:x for x in r['drive']};requests={x['tick']:x for x in r['requests']}
phases={}
def norm(v):return math.sqrt(sum(x*x for x in v))
for phase in ['release','reverse','hold','recut','releaseAfter']:
 fs=[x for x in r['observations']if x['phase']==phase];ds=[drive[x['tick']]for x in fs];calls=[c for dr in ds for c in dr['torqueCalls']]
 pp=[f['fighters'][0]for f in fs]
 phases[phase]={'ticks':[fs[0]['tick'],fs[-1]['tick']],'steps':len(fs),'acceptedRequests':sum(requests[x['tick']]['accepted']for x in fs),
 'v2Phases':dict(Counter(x['v2']['phase']for x in fs)),'owners':dict(Counter(x['v2']['owner']for x in fs)),
 'availabilityRange':[min(x['v2']['availability']for x in fs),max(x['v2']['availability']for x in fs)],
 'preDriveMainArmRange':[min(x['pre']['armHealth']for x in ds),max(x['pre']['armHealth']for x in ds)],
 'preDrivePainRange':[min(x['pre']['pain']for x in ds),max(x['pre']['pain']for x in ds)],
 'preDriveMuscleRange':[min(x['pre']['muscle']for x in ds),max(x['pre']['muscle']for x in ds)],
 'actualTorqueCalls':len(calls),'actualSwordTorquePeakNm':max((c['magnitudeNm']for c in calls if c['part']=='sword'),default=0),
 'lastDriveWristCapRangeNm':[min(x['postDebug']['wristCap']for x in ds),max(x['postDebug']['wristCap']for x in ds)],
 'maxCappedSwingTorqueToCapRatio':max(norm(x['postDebug']['wristTorque'])/x['postDebug']['wristCap']for x in ds),
 'maxActualTotalTorqueToSwingCapRatio':max(c['magnitudeNm']/x['postDebug']['wristCap']for x in ds for c in x['torqueCalls']if c['part']=='sword'),
 'framesWithNoDriveTorqueCall':sum(not x['torqueCalls']for x in ds),
 'handErrorPeakM':max(x['handErrorM']for x in fs),'handErrorEndM':fs[-1]['handErrorM'],
 'handTargetFirst':fs[0]['handTarget'],'handTargetLast':fs[-1]['handTarget'],
 'tipSpeedPeakMps':max(x['tipSpeedMps']for x in fs),
 'maxJointGapM':max(j['gapM']for f in pp for j in f['gaps']),
 'maxGripGapM':max((j['gapM']for f in pp for j in f['gaps']if j['name']=='grip'),default=None),
 'maxLimbAxialRadps':max(abs(s['axialRadps'])for f in pp for s in f['spin']if s['part'].startswith(('uarm','farm','thigh','shin'))),
 'playerStates':dict(Counter(f['state']for f in pp)),
 'allAliveArmedValidGrip':all(f['alive']and f['armed']and f['gripValid']for f in pp),
 'limbsAtEnd':fs[-1]['postCombat']['limbs']}
first=d['protocol']['firstInputTick'];injury=d['protocol']['injuryTick'];pre=drive[injury]['pre'];post=next(x['postCombat']for x in r['observations']if x['tick']==injury)
s={'schemaVersion':1,'head':d['head'],'status':'Current partial injury input gate; severe partial injury remains unexposed','newExecutions':1,'newSteps':len(r['frames']),'wallSeconds':d['wallSeconds'],
 'raw':{'path':str(raw),'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest()},'selection':{'path':str(sel),'sha256':hashlib.sha256(sel.read_bytes()).hexdigest()},
 'measurementValid':d['measurementValid'],'checks':d['checks'],'sourceChanges':d['sourceChanges'],'sourceStable':d['sourceStable'],'command':d['command'],'protocol':d['protocol'],
 'boundary':r['boundary'],'injuryStepOrder':{'preDrive':pre,'postCombat':post,'warning':'Injury is applied after the tick1066 drive; its pre-drive availability/cap was computed with healthy main arm. Next drive uses reduced arm health and updated pain.'},
 'phases':phases,'woundsAfterInput':[w for w in r['wounds']if w['timeS']>=first*d['protocol']['dt']],
 'completeLossYield':inventory['completeLossEvidence'],
 'limits':['No alive+armed major partial main-arm damage in available ordinary-v2 traces: nearest is0.80847, not a substitute for0.25–0.5 control. It is above the v2 arm-availability upper edge0.8, although the original physical strength still scales with arm health.','Availability0 can legitimately reflect pain while raw input/physical wrist still works within original limits; absence of optional guidance is not input rejection.','Actual torque call observation covers sword/farmS addTorque in driveSword, not native joint motor impulses or total force/energy. The debug wrist cap bounds swing torque BEFORE the unchanged separate axial alignment contribution; final applied vector can exceed that scalar cap.','Hand error is distance to the requested world handTarget before IK reach clamping, not joint-target error; it includes reach saturation and inertial lag. Input acceptance does not establish accurate target following or naturalness.','Post-Combat debug torque/cap alone can be stale after loss; complete-loss evidence is existing controller yield plus current armed guard, not new motor measurement.','Input sequence is scripted120Hz with main held/L1 contract. No browser/device/hitstop equivalence or human-naturalness acceptance.','Original opponent remains, so subsequent wounds/body dynamics may change after replacing player AI; no efficacy comparison with old AI after the branch.'],
 'nextLargePartialGate':inventory['nextLargeDamageGate']}
out.write_text(json.dumps(s,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'out':str(out),'checks':d['checks'],'phases':{k:{z:v[z]for z in ['steps','acceptedRequests','v2Phases','availabilityRange','actualSwordTorquePeakNm','tipSpeedPeakMps','allAliveArmedValidGrip']}for k,v in phases.items()}},ensure_ascii=False))
