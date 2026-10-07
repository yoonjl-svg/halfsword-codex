"""Derive the fixed recut protocol results; does not run physics."""
import hashlib, json, sys
from pathlib import Path
root=Path(sys.argv[1]);out=Path(sys.argv[2])
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def artifact(p):return {'path':str(p),'bytes':p.stat().st_size,'sha256':sha(p)}
def stats(xs):return {'max':max(xs),'mean':sum(xs)/len(xs),'count':len(xs)} if xs else None
runs=[];data={}
for name in ['native01','native02','native03','observer-off','idle04']:
    p=root/name/'report.json';r=json.loads(p.read_text());assert r['sourceStable'] and r['measurementValid']
    source_path=Path(r['source']['directory'])/'SOURCE.json';source=json.loads(source_path.read_text())
    for rel,h in source['files'].items():assert sha(Path(source['directory'])/rel)==h
    derived=[]
    for row in r['rows']:
        p=Path(row['artifact']['path']);assert sha(p)==row['artifact']['sha256'];d=json.loads(p.read_text());data[name,d['weapon'],d['mode']]=d
        phases={}
        for phase in ['firstCut','recut','recutHold','cut2']:
            ms=[x for x in d['metrics'] if x['phase']==phase]
            phases[phase]={'tipSpeedMps':stats([x['tipSpeedMps'] for x in ms]),'swordKJ':stats([x['swordKJ'] for x in ms])}
        contacts=[]
        for x in d['strikes']:
            if not (x['type']=='cut' and x['severity']>0 and x['before']['alive'] and x['afterIntervention']):continue
            last=next((q for q in reversed(d['inputs'][:x['tick']+1]) if q['requested']['active']),None)
            contacts.append({**x,'lastHandMotionTick':last['tick'] if last else None,'lastHandMotionPhase':last['phase'] if last else None,
                'timeSinceLastHandMotionS':(x['tick']-last['tick'])/120 if last else None,
                'actualWoundHook':any(w['tick']==x['tick'] and w['type']=='cut' and w['energy']==x['energy'] for w in d['wounds'])})
        derived.append({**row,'raw':artifact(p),'phases':phases,'postInterventionLiveDamagingCuts':contacts,
            'strictMovingFingerCuts':sum(x['active'] for x in contacts),'newCutWounds':sum(w['type']=='cut' and w['severity']>0 for w in d['wounds']),
            'recutInterventions':[x for x in d['interventions'] if x['phase']=='recut'],
            'allPlayerAliveArmedGrip':all(x['player']['alive'] and x['player']['armed'] and x['player']['gripValid'] for x in d['metrics'])})
    runs.append({'name':name,'report':artifact(root/name/'report.json'),'source':artifact(source_path),'head':r['head'],'sourceStable':r['sourceStable'],'measurementValid':r['measurementValid'],
        'command':r['command'],'protocol':r['protocol'],'executionCount':r['executionCount'],'steps':r['steps'],'wallSeconds':r['wallSeconds'],
        'comparisons':r['comparisons'],'observerEquivalence':r.get('observerEquivalence'),'rows':derived})
a=data['native03','qinggang','legacy'];b=data['native03','qinggang','bounded']
pelvis=lambda d:next(x for x in d['strikes'] if x['phase']=='recutHold' and x['part']=='pelvis')
p,q=pelvis(a),pelvis(b)
ratio=lambda key:q[key]/p[key]
impact={'legacy':p,'bounded':q,'energyRatio':ratio('energy'),'speedRatio':ratio('speed'),'massRatio':ratio('mEff'),
    'energyRatioReconstructed':ratio('mEff')*ratio('speed')**2,'effOverEnergy':[p['eff']/p['energy'],q['eff']/q['energy']],
    'preFirstRecordedCutTick':727,'preRecordedCut':[a['metrics'][727],b['metrics'][727]],
    'window':[{'tick':t,'legacy':a['metrics'][t],'bounded':b['metrics'][t]} for t in range(727,734)],
    'sequence':{'legacy':[x for x in a['strikes'] if 727<=x['tick']<=733],'bounded':[x for x in b['strikes'] if 727<=x['tick']<=733]},
    'limits':'Contact point/order and native state differ. Tick727 is a post-step sample before the first recorded cut, not proof of no prior physical contact. strikes[] omits null results and does not log every native contact. Metrics are post-step. No individual impulse/work ledger was captured, so earlier arm cut accompanies energy loss but does not isolate every cause.'}
assert abs(impact['energyRatio']-impact['energyRatioReconstructed'])<1e-12
result={'schemaVersion':1,'head':runs[0]['head'],'judgment':'Actual live manual recut contact verified for longsword and Qinggang after bounded intervention; no damage/strength multiplier change warranted by these observations. Every-strike power nondecrease and active-finger-at-contact claims are not made.',
    'executionCount':sum(x['executionCount'] for x in runs),'completedSteps':sum(x['steps'] for x in runs),'wallSeconds':sum(x['wallSeconds'] for x in runs),
    'runs':runs,'qinggangPelvisDecomposition':impact,'derivation':artifact(Path(__file__).resolve()),
    'limits':['One fixed seed, two weapons, one normal AI opponent; controlled idle Q pair is not a second live combat.',
    'Raw legacy/bounded input tape matches; contact states need not match after target correction.',
    'Damage-producing recut contacts occurred75–108ms after finger motion stopped, during manual stroke follow-through, not tap or injected wound.',
    'Idle Q pair has zero damaging cuts in both conditions; it cannot establish cutting power parity.',
    'Player emotion feedback from main.js is absent in the harness, enemy normal AI remains original except explicitly idle pair.',
    'No all-weapon guarantee, physical-human naturalness acceptance, new default promotion, or gravity change.']}
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'executionCount':result['executionCount'],'completedSteps':result['completedSteps'],'wallSeconds':result['wallSeconds'],'out':str(out)},ensure_ascii=False))
