"""Derive the two P4 contact fixtures without running physics or scoring efficacy."""
import argparse, hashlib, json, math
from pathlib import Path
p=argparse.ArgumentParser()
for name in ['initial','corrected','out']: p.add_argument('--'+name,type=Path,required=True)
a=p.parse_args()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def describe_file(p): return {'path':str(p),'bytes':p.stat().st_size,'sha256':sha(p)}
def stats(values):
    xs=[x for x in values if x is not None]
    return {'mean':sum(xs)/len(xs),'max':max(xs),'min':min(xs)} if xs else None
def row_summary(row,dt):
    phase={}
    for name in sorted(set(f['phase'] for f in row['p4Metrics'])):
        fs=[f for f in row['p4Metrics'] if f['phase']==name]
        actual=[f['actual'] for f in fs]
        phase[name]={'ticks':[fs[0]['tick'],fs[-1]['tick']],'steps':len(fs),
            'eligibleFrames':sum(bool(f['pre'] and f['pre']['eligible']) for f in fs),
            'bodyGapM':stats([f['bodyGapM'] for f in fs]),
            'tipSpeedMps':stats([f['tipSpeedMps'] for f in actual]),
            'swordKJ':stats([f['swordKJ'] for f in actual]),
            'axialPeakRadps':max(abs(f['axialOmegaRadps']) for f in actual),
            'axialTravelRad':sum(abs(f['axialOmegaRadps'])*dt for f in actual),
            'commandSignedProgressM':sum((f['commandSignedSpeedMps'] or 0)*dt for f in actual),
            'physicalEdgeErrorDeg':stats([math.degrees(f['physicalEdgeErrorRad']) if f['physicalEdgeErrorRad'] is not None else None for f in actual]),
            'ownCommandEdgeErrorDeg':stats([math.degrees(f['commandEdgeErrorRad']) if f['commandEdgeErrorRad'] is not None else None for f in actual]),
            'allAliveArmed':all(f['alive'] and f['armed'] for f in actual),
            'playerStates':sorted(set(f['state'] for f in actual)),
            'minArmHealth':min(f['health'] for f in actual)}
    contacts=[{'tick':e['tick'],'phase':e.get('scriptPhase'),'JNs':e['J'],'part':e['part'],
               'eligibleActiveCut':e.get('qualifiedActiveCut',False),'victimState':e.get('victimState'),
               'candidateFramesBefore':e.get('commandedFramesBefore'),'pairDeltaKJ':e['analysis']['deltaKJ']}
              for e in row['events']]
    window=row.get('window',[])
    return {'mode':row['mode'],'steps':len(row['frames']),'checks':row['checks'],'exposure':row['exposure'],
            'touchStartTick':row.get('touchStartTick'),'touchStartBoundary':row.get('touchStartBoundary'),
            'candidateCommandedFrames':row['commandedFrames'],'firstCommandedTick':row['firstCommandedTick'],
            'firstPlayerCutTick':row['firstPlayerCutTick'],'firstEligiblePlayerCutTick':row.get('firstEligiblePlayerCutTick'),
            'contactQualified':row.get('contactQualified',False),'contactEvents':contacts,'wounds':row.get('wounds'),
            'phaseMetrics':phase,'postAnyCutPlayer':None if not window else {
                'maxJointGapM':max(j['gapM'] for f in window for j in f['fighters'][0]['gaps']),
                'maxChestTiltDeg':max(math.degrees(f['fighters'][0]['chestTiltRad']) for f in window),
                'allAliveArmedValidGrip':all(f['fighters'][0]['alive'] and f['fighters'][0]['armed'] and f['fighters'][0]['gripValid'] for f in window)}}
reports=[]
for label,file in [('initialMissingStartLock',a.initial),('correctedApproach',a.corrected)]:
    d=json.loads(file.read_text())
    reports.append({'label':label,'raw':describe_file(file),'head':d['head'],'sourceStable':d['sourceStable'],
        'headStable':d['headStable'],'measurementValid':d['measurementValid'],'error':d['error'],
        'command':d['command'],'protocol':d['protocol'],'wallSeconds':d['wallSeconds'],'comparisons':d['comparisons'],
        'sourceProof':describe_file(Path(str(file.parent)+'-preparation.json')),
        'rows':[row_summary(r,d['dt']) for r in d['rows']]})
result={'schemaVersion':1,'runtimeChanged':False,'publicChanged':False,'effectAccepted':False,
    'judgment':'Pending director interpretation; measurement/exposure/contact qualification are separate from gameplay effect.',
    'reports':reports,'accounting':{'newExecutions':sum(len(d['rows']) for d in reports),
        'newSteps':sum(r['steps'] for d in reports for r in d['rows']),
        'nativeWallSeconds':sum(d['wallSeconds'] for d in reports),'physicsFromPreparationOnly':0},
    'derivation':describe_file(Path(__file__).resolve()),
    'limits':['Corrected fixture preserves the same candidate and touch tape; only normal movement/start timing changes.',
              'Reactive opponent can diverge after the player candidate changes physics; later damage, contact point and pair energy are not matched-impact efficacy comparisons.',
              'Own command direction includes actual chest motion and changes after divergence. Lower peak or fewer axial turns alone do not certify intended technique.',
              'Post-step alignment uses same-step command velocity projected on the post-step blade. It is not pre-drive target slew.',
              'No from-phone timing, naturalness, general weapon acceptance or gravity comparison.']}
a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result['accounting']))
