#!/usr/bin/env python3
"""Read-only derivation of controlled injury and target-history contracts."""
import argparse, hashlib, json, math
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();assert not a.out.exists()
def read(p):
 b=p.read_bytes();return json.loads(b),{'path':str(p),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def smooth(x,lo,hi):
 t=max(0,min(1,(x-lo)/(hi-lo)));return t*t*(3-2*t)
def limits(xs):return {'min':min(xs),'max':max(xs)} if xs else None
r,rr=read(a.root/'run01/report.json');artifacts=[rr];rows=[]
for desc in r['rows']:
 d,ref=read(Path(desc['artifact']['path']));assert ref==desc['artifact'];artifacts.append(ref)
 ms=d['metrics'];drive=d['drive'];valid=[x for x in drive if x['after']['called']]
 avail_errors=[abs(m['assist']['availability']-smooth(m['player']['armHealth'],.25,.8)*(1-smooth(m['player']['pain'],.15,.5))) for m in ms if m['tick']!=300]
 cap_error=max(abs(x['after']['wristCapNm']-x['after']['expectedWristCapNm'])for x in valid)
 phase_rows=[]
 for cycle in ['immediate','pain_recovered_window']:
  selected=[m for m in ms if m['request']['cycle']==cycle];ds=[drive[m['tick']]for m in selected];active=[m for m in selected if m['request']['dx'] or m['request']['dy']]
  release=[x for x in selected if x['request']['phase']=='releaseAfter'];rd=[drive[m['tick']]for m in release]
  phase_rows.append({'cycle':cycle,'steps':len(selected),'activeInputSteps':len(active),'activeMovingSteps':sum(m['assist']['phase']=='moving' for m in active),'phases':sorted(set(m['assist']['phase']for m in selected)),
   'pain':limits([m['player']['pain']for m in selected]),'availability':limits([m['assist']['availability']for m in selected]),'returnFrames':sum(m['assist']['phase'] in ['returning','ready']for m in selected),
   'actualSwordTorqueCallSteps':sum(x['after']['called']for x in ds),'preTwistOpposingSwingSteps':sum(x['after']['called'] and x['after']['preTwistSwingPowerW']<0 for x in ds),'wristBrakeSteps':sum(x['after']['wristBrake']for x in ds),
   'tipSpeedPeakMps':max(m['tipSpeedMps']for m in selected),'releaseAfterRecut':{'steps':len(rd),'firstTick':rd[0]['tick'],'lastTick':rd[-1]['tick'],'swingOmegaStartRadps':rd[0]['after']['swingOmegaRadps'],'swingOmegaEndRadps':rd[-1]['after']['swingOmegaRadps'],'opposingPreTwistSwingSteps':sum(x['after']['preTwistSwingPowerW']<0 for x in rd),'brakeSteps':sum(x['after']['wristBrake']for x in rd)}})
 gaps=[g['gapM']for m in ms for g in m['fighters'][0]['gaps']]
 axial=[abs(s['axialRadps'])for m in ms for s in m['fighters'][0]['spin']if s['part']=='sword']
 row={'key':d['key'],'weapon':d['weapon'],'level':d['level'],'steps':d['steps'],'checks':d['checks'],'injuries':d['injuries'],'final':d['final'],'phases':phase_rows,
  'availabilityFormulaMaxError':max(avail_errors),'wristCapFormulaMaxErrorNm':cap_error,'allAliveArmedGripValid':all(m['player']['alive']and m['player']['armed']and m['player']['gripValid']for m in ms),
  'observedStates':sorted(set(m['player']['state']for m in ms)),'maxJointGapM':max(gaps),'maxSwordAxialRadps':max(axial),'lowMuscleEarlyReturnSteps':sum(x['after']['earlyReturnLowMuscle']for x in drive),
  'swordContactSteps':sum(bool(m['swordContacts'])for m in ms),'swordOpponentContactSteps':sum(any(c['otherFighter']==1 for c in m['swordContacts'])for m in ms),
  'limits':['Pre-twist swing cap and added axial torque are separate; the total applied vector can exceed the swing-only cap.','Opposing torque and falling swing speed show active deceleration, not zero latency or human naturalness.','The forearm wound location/direction is a declared diagnostic center; no collision impulse is replayed.']}
 rows.append(row)
before,br=read(a.root/'stale-before01/report.json');fixed,fr=read(a.root/'stale-fixed01/report.json');artifacts.extend([br,fr])
b=before['row'];f=fixed['row'];first=f['firstResumed'];assert first==b['firstResumed']
changed=[p for p,h in before['sourceBefore'].items()if fixed['sourceBefore'].get(p)!=h]
native_diff=next((i for i,(x,y)in enumerate(zip(b['frames'],f['frames']))if x[1]!=y[1]),None)
ctrl_diff=next((i for i,(x,y)in enumerate(zip(b['frames'],f['frames']))if x[2]!=y[2]),None)
input_exact=all(x[3]==y[3]for x,y in zip(b['frames'],f['frames']))
prefix_exact=all(x==y for x,y in zip(b['frames'][:first],f['frames'][:first]))
stale={'kind':'controlled_knockDown_API_actual_Fighter_contract','beforeArtifact':br,'fixedArtifact':fr,'beforeCommand':before['command'],'fixedCommand':fixed['command'],
 'steps':len(b['frames'])+len(f['frames']),'sourceDifferences':changed,'firstDisabled':f['firstDisabled'],'firstResumed':first,'beforeResume':b['drive'][first],'fixedResume':f['drive'][first],
 'nativeControlInputPrefixBeforeResumeExact':prefix_exact,'firstNativeDifference':native_diff,'firstControlDifference':ctrl_diff,'allInputsExact':input_exact,'beforeFinal':b['final'],'fixedFinal':f['final'],
 'fixedFirstResumeAimRateIsZero':f['drive'][first]['after']['actualAimRateRadps']==0,'limits':'API-induced down state, normal muscle decay/getup. No body transform/velocity/direct state assignment. Not an observed collision or natural fall/standing acceptance.'}
valid=r['measurementValid']and before['measurementValid']and fixed['measurementValid']and changed==['src/fighter.js']and prefix_exact and input_exact and stale['fixedFirstResumeAimRateIsZero']
summary={'schemaVersion':1,'head':r['head'],'measurementValid':valid,'counts':{'woundRows':6,'woundSteps':r['steps'],'historyRows':2,'historySteps':stale['steps'],'newRows':8,'newSteps':r['steps']+stale['steps']},
 'woundCommand':r['command'],'woundPlan':r['plan'],'woundSourceManifest':r['source'],'woundComparisons':r['comparisons'],'rows':rows,'historyContract':stale,'artifacts':artifacts,
 'functionalDecision':'Input/release/reverse/recut, injury-scaled force and optional-assistance return are supported by controlled-wound rows plus prior natural injury evidence. Target-history bug is reproduced and corrected in the actual Fighter contract.',
 'limits':['Current-v2 natural .80847 and legacy-Q .36657 late handover remain reused evidence, not fresh executions.','Controlled replay is not a new naturally collided large-injury sample; obtaining another such sample is not imposed as an extra gate for this functional contract.','Axial peaks up to roughly34rad/s remain; finite state, stand and valid grip do not certify human naturalness.','All wound rows use ordinary v2, legacy cutting/stance and an idle opponent without body relocation.','Runtime changes after these frozen sources require an explicit source bridge; this report does not automatically validate future physics patches.']}
a.out.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'out':str(a.out),'measurementValid':valid,'counts':summary['counts'],'firstNativeDifference':native_diff,'prefixExact':prefix_exact},ensure_ascii=False))
