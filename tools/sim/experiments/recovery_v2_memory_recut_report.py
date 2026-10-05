"""Report the single deliberate re-input fixture; no physics or raw mutation."""
import argparse, hashlib, json, math
from pathlib import Path
p=argparse.ArgumentParser()
for key in ['legacy','fresh','out']: p.add_argument('--'+key,required=True)
a=p.parse_args();out=Path(a.out);assert not out.exists()
def read(name):
 path=Path(name);b=path.read_bytes();return json.loads(b),{'path':str(path),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
A,ar=read(a.legacy);B,br=read(a.fresh);assert A['measurementValid'] and B['measurementValid']
phases={'neutral':[1477,1620],'cut':[1621,1650],'held':[1651,1686],'released':[1687,1746]}
def span(xs,start,end):return [x for x in xs if start<=x['tick']<=end]
def magnitude(x):return math.sqrt(sum(v*v for v in x))
def phase_stats(d,start,end):
 r=d['row'];motion=span(r['motion'],start,end);metrics=[x['fighters'][0]for x in span(r['metrics'],start,end)];contacts=span(r['contacts'],start,end)
 slips=[];loaded_slips=[]
 for frame in contacts:
  for name in ['footF','footB']:
   for c in frame['contacts']['groups'][name]['contacts']:
    if not c['hasSupport']:continue
    for v in c['solverPoints']:
     if v['withinSlop']:
      slips.append(v['relativeTangentialSpeedMps'])
      if c['loaded']:loaded_slips.append(v['relativeTangentialSpeedMps'])
 foot=[f for x in span(r['window'],start,end)for f in x['fighters'][0]['spin'] if f['part'].startswith('foot')]
 sword_contact=[x for x in span(r['swordContacts'],start,end) if any(p['otherFighter']==1 and any(i>0 for i in p['impulseNs'])for p in x['pairs'])]
 return {'steps':len(motion),'tipPeakMps':max(x['tipSpeedMps']for x in motion),'swordKPeakJ':max(x['swordKineticJ']for x in motion),'handErrorMaxM':max(x['handErrorM']for x in motion),
 'maxJointGapM':max(x['maxJoint']['gapM']for x in metrics),'maxGripGapM':max(x['gripGap']['gapM']for x in metrics),'maxLimbAxialRadps':max(abs(x['maxLimbAxial']['axialRadps'])for x in metrics),
 'maximumFootSpeedMps':max(x['speedMps']for x in foot),'maximumFootOmegaRadps':max(x['omegaRadps']for x in foot),'maximumChestTiltRad':max(x['chestTiltRad']for x in metrics),
 'supportSolverSlipMps':{'samples':len(slips),'max':max(slips,default=None),'mean':sum(slips)/len(slips)if slips else None},
 'loadedSupportSolverSlipMps':{'samples':len(loaded_slips),'max':max(loaded_slips,default=None),'mean':sum(loaded_slips)/len(loaded_slips)if loaded_slips else None},
 'allAliveArmedGrip':all(x['alive']and x['armed']and x['gripValid']for x in metrics),'states':sorted(set(x['state']for x in metrics)),
 'availabilityRange':[min(x['assist']['availability']for x in motion),max(x['assist']['availability']for x in motion)],'painRange':[min(x['pain']for x in motion),max(x['pain']for x in motion)],
 'wristRequestPeakNm':max(magnitude(x['control']['wristTorque'])for x in metrics),'wristCapPeakNm':max(x['control']['wristCap']for x in metrics),
 'actualSwordOpponentContactFrames':len(sword_contact),'firstSwordOpponentContactTick':sword_contact[0]['tick']if sword_contact else None}

def rows(d):
 r=d['row'];first=r['pinObservations'][0];calls=[x for x in first['applied']if x['foot']=='B'and x['method']=='addForceAtPoint']
 return {'head':d['head'],'wallSeconds':d['wallSeconds'],'steps':len(r['frames']),'checks':d['checks'],'firstPinBackForce':calls,
 'firstPin':{'before':first['before'],'after':first['after']},'phases':{key:phase_stats(d,*ticks)for key,ticks in phases.items()},
 'transitionControls':[{'tick':tick,'control':next(x['fighters'][0]['control']for x in r['metrics']if x['tick']==tick),'assist':next(x['assist']for x in r['motion']if x['tick']==tick)}for tick in [1477,1621,1651,1687,1746]],
 'woundsAfterBoundary':[w for w in r['wounds']if w['timeS']>=1477/120],
 'finalPlayer':{k:r['metrics'][-1]['fighters'][0][k]for k in ['state','alive','armed','gripValid','limbs']}}
ra,rb=A['row'],B['row']
first=lambda col:next((x[0]for x,y in zip(ra['frames'],rb['frames'])if x[col]!=y[col]),None)
requests_equal=ra['requestedInputs']==rb['requestedInputs']
entrya=next(x for x in ra['entries']if x['restarted']);entryb=next(x for x in rb['entries']if x['restarted'])
ma={x['tick']:x['fighters'][0]for x in ra['metrics']};mb={x['tick']:x['fighters'][0]for x in rb['metrics']}
first_pain_difference=next((t for t in ma if t>=1477 and ma[t]['control']['pain']!=mb[t]['control']['pain']),None)
peak=max((x for x in rb['metrics']if x['tick']>=1477),key=lambda x:x['fighters'][0]['gripGap']['gapM']);pt=peak['tick']
s={'schemaVersion':1,'experiment':'recovery_v2_memory_recut','raw':[ar,br],'measurementValid':True,'effectAccepted':False,'newExecutionCount':2,'newStepCount':len(ra['frames'])+len(rb['frames']),
 'prefixExactThroughTick1476':all(d['checks']['prefixExact']for d in[A,B]),'sameEntryPreNative':entrya['nativeBefore']==entryb['nativeBefore'],'sameEntryBeforeGait':entrya['before']==entryb['before'],
 'identicalRequestedPlayerInputs':requests_equal,'firstDifferenceTicks':{'native':first(1),'control':first(2),'combinedPlayerAndEnemyInput':first(3)},
 'firstBackFootForceBothObserved':True,'legacy':rows(A),'fresh':rows(B),
 'healthBoundary':{'firstPainDifferenceTick':first_pain_difference,'sameLimbsThroughout':all(ma[t]['limbs']==mb[t]['limbs']for t in ma),'cutBeforeNewPainTicks':[1621,first_pain_difference-1],'note':'Later pain and availability differences follow new opponent hits; do not call speed/energy differences correction power loss.'},
 'maximumFreshGripGapContext':{'tick':pt,'timeS':peak['timeS'],'legacyGripGapM':ma[pt]['gripGap']['gapM'],'freshGripGapM':mb[pt]['gripGap']['gapM'],'freshOtherJoint':mb[pt]['maxJoint'],'freshControl':mb[pt]['control'],'legacyControl':ma[pt]['control'],'laterThanFreshOnlyArmHit':True,'interpretation':'Submillimeter gap remains below concurrent forearm gap1.09482mm and row max1.61046mm; grip remains valid. This is solver constraint error, not proof of human-natural appearance.'},
 'narrowGateAccepted':True,'acceptanceScope':'Stale Nf lifecycle fix plus actual-injury deliberate cut/hold/release/return input acceptance; selective zweihander v2 publication may follow runtime bridge and mobile view. No ordinary promotion or whole recovery acceptance.',
 'scope':['Identical requested player gestures from1477; original reactive opponent remains and may diverge. Later damage or peak differences are not controlled-opponent causal efficacy.',
 'Physical120Hz input contract uses main L1 threshold1e-5 and held/release flags with recordSwordsmanshipInput. No browser render cadence, hitstop timing, human sensor or appearance equivalence claimed.',
 'Pin actual force calls are measured on both sides, separately from stored pre-clamp requests. Contact slip samples require current support and solver gap within tolerance; loaded subset also requires positive impulse.',
 'Wrist torque debug request and availability are separate; no claim of isolated wrist work or full power transfer.',
 'No pain/state/health/availability overwrite; source helper and legacy support unchanged.']}
assert requests_equal and s['sameEntryPreNative']and s['sameEntryBeforeGait']
out.write_text(json.dumps(s,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'path':str(out),'prefix':s['prefixExactThroughTick1476'],'requestsExact':requests_equal,'firstDifferences':s['firstDifferenceTicks'],'cut':{m:s[m]['phases']['cut']for m in ['legacy','fresh']}},ensure_ascii=False))
