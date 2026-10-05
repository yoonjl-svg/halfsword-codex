"""Derive the bounded-roll contact pair. No simulation or effect acceptance."""
import argparse, hashlib, json, math
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('--report',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--reference',type=Path)
p.add_argument('--parent',type=Path)
a=p.parse_args()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
artifact=lambda p:{'path':str(p),'bytes':p.stat().st_size,'sha256':sha(p)}
stats=lambda x:({'min':min(x),'mean':sum(x)/len(x),'max':max(x),'count':len(x)} if x else None)
report=json.loads(a.report.read_text());dt=report['protocol']['dt'];rows=[];raw=[]
for item in report['rows']:
    path=Path(item['artifact']['path']);assert sha(path)==item['artifact']['sha256'];r=json.loads(path.read_text());raw.append(r)
    phases={}
    for name in dict.fromkeys(m['phase'] for m in r['metrics']):
        fs=[m for m in r['metrics'] if m['phase']==name];act=[f['actual'] for f in fs];pre=[f['pre'] for f in fs if f['pre']]
        real_edges=[x for x in act if x['transverseSpeedMps']>.5 and x['physicalEdgeErrorRad'] is not None]
        phases[name]={'ticks':[fs[0]['tick'],fs[-1]['tick']],'steps':len(fs),'tipSpeedMps':stats([x['tipSpeedMps'] for x in act]),
          'swordKJ':stats([x['swordKJ'] for x in act]),'axialPeakRadps':max(abs(x['axialOmegaRadps']) for x in act),
          'axialTravelRad':sum(abs(x['axialOmegaRadps'])*dt for x in act),'ownCommandSignedProgressM':sum((x['commandSignedSpeedMps'] or 0)*dt for x in act),
          'physicalEdgeErrorDegAboveHalfMps':stats([math.degrees(x['physicalEdgeErrorRad']) for x in real_edges]),
          'ownCommandEdgeErrorDeg':stats([math.degrees(x['commandEdgeErrorRad']) for x in act if x['commandEdgeErrorRad'] is not None]),
          'changedGoalFrames':sum(x['changed'] for x in pre),'maxRawSlewDeg':max([abs(math.degrees(x['rawSlewRad'])) for x in pre],default=0),
          'maxTargetSlewDeg':max([abs(math.degrees(x['targetSlewRad'])) for x in pre],default=0),
          'maxTargetErrorDeg':max([math.degrees(x['targetErrorRad']) for x in pre],default=0),
          'targetErrorOver90Ticks':[x['tick'] for x in pre if x['targetErrorRad']>math.pi/2+1e-8],
          'maxPlayerJointGapM':max([j['gapM'] for f in fs for j in f['state']['fighters'][0]['gaps']],default=0),
          'allPlayerAliveArmedGrip':all(f['state']['fighters'][0]['alive'] and f['state']['fighters'][0]['armed'] and f['state']['fighters'][0]['gripValid'] for f in fs)}
    contact=[{'tick':e['tick'],'phase':e['phase'],'part':e['part'],'qualified':e['qualified'],'victimAliveBeforePair':e['victimState']['alive'],
              'attackerAliveBeforePair':e['attackerState']['alive'],'JNs':e['J'],'pairDeltaKJ':e['analysis']['deltaKJ']} for e in r['events']]
    rows.append({**item,'raw':artifact(path),'touchStartBoundary':r['touchStartBoundary'],'exposure':r['exposure'],'tapAccepted':r['tapAccepted'],
      'fullTapeCompleted':r['terminal']['reason']=='full_touch_tape_complete','phases':phases,'contacts':contact,'wounds':r['wounds'],
      'woundCalls':r['woundCalls'],'finalStates':r['finalStates']})
reference=None
if a.reference and raw:
    old=json.loads(a.reference.read_text());baseline=next(r for r in old['rows'] if r['mode']=='legacy');now=raw[0];n=min(len(now['frames']),len(baseline['frames']))
    native=[i for i in range(n) if now['frames'][i][1]!=baseline['frames'][i][1]]
    controls=[i for i in range(n) if now['frames'][i][2]!=baseline['frames'][i][2]]
    reference={'artifact':artifact(a.reference),'commonSteps':n,'allNativeExact':not native,'firstNativeDifference':native[0] if native else None,
      'allControlExact':not controls,'firstControlDifference':controls[0] if controls else None,
      'limits':'Current baseline compared with preserved round4 baseline, not a new independent historical observation. Input hash layout differs; requested tape contract is preserved by source and new pair hashes.'}
parent_bridge=None
if a.parent:
    parent=json.loads(a.parent.read_text());parent_bridge={'report':artifact(a.parent),'rows':[]}
    for r in raw:
        saved=next(x for x in parent['rows'] if x['mode']==r['mode']);file=Path(saved['artifact']['path']);assert sha(file)==saved['artifact']['sha256'];old=json.loads(file.read_text());n=len(old['frames'])
        full=len(r['frames'])>=n and r['frames'][:n]==old['frames'];inputs=r['inputTape'][:len(old['inputTape'])]==old['inputTape']
        parent_bridge['rows'].append({'mode':r['mode'],'parent':artifact(file),'parentSteps':n,'allNativeControlRequestedAppliedEnemyFramesExact':full,'allInputRecordsExact':inputs})
        assert full and inputs,'Extended fixture changed its recorded parent prefix'
result={'schemaVersion':1,'effectAccepted':False,'judgment':'Pending director evaluation; exposure and valid measurement are separate from gameplay acceptance.',
 'report':artifact(a.report),'head':report['head'],'sourceStable':report['sourceStable'],'measurementValid':report['measurementValid'],
 'executionCount':report['executionCount'],'stepCalls':report['stepCalls'],'completedSteps':report['completedSteps'],'wallSeconds':report['wallSeconds'],
 'comparison':report['comparison'],'rows':rows,'historicalBaselineBridge':reference,'parentPrefixBridge':parent_bridge,'derivation':artifact(Path(__file__).resolve()),
 'limits':['Physical edge error uses post-step native .7-blade point velocity and requires transverse speed >.5m/s; it is an unsigned plane angle.',
  'Own command progress contains actual chest/heading motion and can change after candidate intervention.',
  'Target error >90 is a directed pre-drive error, not unsigned physical cutting-plane error.',
  'First target intervention changes subsequent physical states; later contact energies and damage are not matched-impact power comparisons.',
  'Reactive enemy divergence is recorded separately; preserving player requests does not preserve enemy input.',
  'No naturalness, all-weapon, gravity comparison or general-promotion acceptance.']}
a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'measurementValid':result['measurementValid'],'executionCount':result['executionCount'],'completedSteps':result['completedSteps'],
 'comparison':result['comparison'],'historicalBaselineBridge':reference,'rows':[{'mode':r['mode'],'terminal':r['terminal'],'contact':r['firstQualifiedContactTick'],
 'over90':{k:v['targetErrorOver90Ticks'] for k,v in r['phases'].items() if v['targetErrorOver90Ticks']}} for r in rows]},ensure_ascii=False))
