"""Reduce archived real-contact runs; validate source, branch and observation contracts."""
import argparse
import hashlib
import json
import math
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[3]
SOURCES = {
    'arm-hit-delta-scout.json': '3e93fc8',
    'arm-hit-reinput-r1.json': '3e93fc8',
    'arm-hit-recovery-legacy.json': 'cd4b1fe',
    'arm-hit-recovery-fresh.json': 'ee39290',
    'arm-hit-recovery-legacy-v2.json': 'ee39290',
}
def sha(x): return hashlib.sha256(x).hexdigest()
def git(*a): return subprocess.check_output(['git', *a], cwd=ROOT)
def mean(xs): return sum(xs)/len(xs) if xs else None
def peak(xs): return max(xs, default=None)
def act_metrics(fs, name):
    ds = [s for f in fs for s in f['actuators'] if s['actuator'] == name]
    return {'samples': len(ds), 'maxCapRatio': peak(s['capRatio'] for s in ds),
            'positiveExplicitWorkJ': sum(max(0, s['explicitRecipientPowerW'])/120 for s in ds),
            'negativeExplicitWorkJ': sum(min(0, s['explicitRecipientPowerW'])/120 for s in ds)}
def metrics(fs):
    armed = [f for f in fs if f['health']['alive'] and f['health']['armed']]
    return {'steps': len(fs), 'durationS': len(fs)/120, 'armedSteps': len(armed),
        'peakOmegaRadps': peak(f['swordOmegaRadps'] for f in armed),
        'twistTravelRad': sum(f['swordTwistRadps']/120 for f in armed),
        'meanOwnAimErrorRad': mean([f['ownAimErrorRad'] for f in armed]),
        'meanRawAimErrorRad': mean([f['rawAimErrorRad'] for f in armed]),
        'meanHandErrorM': mean([f['handErrorM'] for f in armed]),
        'maxHandErrorM': peak(f['handErrorM'] for f in armed),
        'maxJointGapM': peak(j['m'] for f in fs for j in f['gaps']),
        'peakPlayerBodyAndSwordKJ': peak(f['bodyAndSwordKJ'] for f in fs),
        'minMuscle': min((f['health']['muscle'] for f in fs), default=None),
        'states': sorted(set(f['health']['state'] for f in fs)),
        'wrist': act_metrics(armed, 'wrist'), 'shoulder': act_metrics(armed, 'shoulder')}
def foot_metrics(fs):
    points = [p['horizontalMps'] for f in fs for c in f['detail']['support']
              if c['normalImpulseNs'] > 1e-6 for p in c['points'] if p['distanceM'] <= .01]
    return {'frames': len(fs), 'supportPointSamples': len(points), 'maxHorizontalContactSpeedMps': peak(points),
            'meanHorizontalContactSpeedMps': mean(points),
            'maxGapM': peak(j['m'] for f in fs for j in f['gaps']),
            'peakPlayerBodyAndSwordKJ': peak(f['bodyAndSwordKJ'] for f in fs),
            'maxPelvisHeightM': peak(f['pelvisM'][1] for f in fs),
            'maxPelvisUpVelocityMps': peak(f['detail']['pelvisVelocity'][1] for f in fs)}
def summarize(directory):
    datasets, raw = [], {}
    for name, commit in SOURCES.items():
        data = (directory/name).read_bytes(); d = json.loads(data); raw[name] = d
        assert d['sourceStable'] and d['executionPass'], name
        archive = git('rev-parse', commit).decode().strip()
        for p, h in d['sourceBefore'].items():
            b = (ROOT/p).read_bytes() if p.startswith('node_modules/') else git('show', archive+':'+p)
            assert sha(b) == h, (name, p)
        assert all(v is not False for c in d['observers'] for v in c.values()), name
        assert all(c['samePrefix'] and c['inputExact'] and c['sameDuration'] for c in d['checks']), name
        datasets.append({'rawFile': name, 'rawSHA256': sha(data), 'rawBytes': len(data),
                         'sourceArchive': archive, 'sourceRecordedAtStart': d['sourceCommit'],
                         'sourceArchiveExact': True, 'sourceStable': True, 'command': d['command'],
                         'executionCount': d['executionCount'], 'wallSeconds': d['wallSeconds'],
                         'checks': d['checks'], 'observers': d['observers'], 'protocol': d['protocol']})
    scouts = [{k: r[k] for k in ['weapon','seed','hit','stopReason','durationS','final']}
              for r in raw['arm-hit-delta-scout.json']['rows']]
    branches = []
    main = raw['arm-hit-reinput-r1.json']['rows']
    for seed in [7, 19]:
        group = [r for r in main if r['seed'] == seed]
        cutoff = min([r['nextContact']['timeS'] for r in group if r['nextContact']]
                     + [group[0]['branch']['timeS']+2])
        for r in group:
            fs = [f for f in r['frames'] if f['relativeS'] is not None]
            branches.append({k: r[k] for k in ['weapon','seed','mode','hit','branch','nextHit','nextContact','firstDrop','firstDeath','durationS','stopReason','final']} |
                {'phases': {p: metrics([f for f in fs if f['phase'] == p]) for p in dict.fromkeys(f['phase'] for f in fs)},
                 'whole': metrics(fs), 'commonBeforeNewContactEndS': cutoff,
                 'commonBeforeNewContact': metrics([f for f in fs if f['timeS'] <= cutoff+1e-10])})
    recovery, recovery_checks, metadata_replays = [], [], []
    arows = raw['arm-hit-recovery-legacy-v2.json']['rows']; brows = raw['arm-hit-recovery-fresh.json']['rows']
    for a,b,old in zip(arows,brows,raw['arm-hit-recovery-legacy.json']['rows']):
        c = {'seed': a['seed'], 'sameHitBranch': a['branch']==b['branch'],
             'firstEntryNativeExact': a['entries'][0]['beforeNative']==b['entries'][0]['beforeNative'],
             'firstEntryControlExact': a['entries'][0]['beforeControl']==b['entries'][0]['beforeControl'],
             'firstEntryInputExact': a['entries'][0]['inputPrefix']==b['entries'][0]['inputPrefix'],
             'firstEntryTimeExact': a['entries'][0]['timeS']==b['entries'][0]['timeS'],
             'onlyNfChangesAtClear': all(e['onlyNf'] for e in b['entries']),
             'bothNfZeroAtClear': all(all(x['Nf']==0 for x in e['afterClear'].values()) for e in b['entries'])}
        assert all(v is not False for v in c.values()), c
        recovery_checks.append(c)
        c2 = {'seed': a['seed'], 'nativeExact': a['nativeTraceSha256']==old['nativeTraceSha256'],
              'controlExact': a['controlTraceSha256']==old['controlTraceSha256'], 'inputExact': a['inputSha256']==old['inputSha256']}
        assert all(v is not False for v in c2.values()), c2
        metadata_replays.append(c2)
        t = a['entries'][0]['timeS']
        common = min([e['timeS'] for r in [a,b] for e in r['events']+r['clashes'] if e['timeS']>t+1e-10] + [min(a['durationS'], b['durationS'])])
        for r in [a,b]:
            fs = [f for f in r['frames'] if f['relativeS'] is not None]
            early = [f for f in fs if f['relativeS']<=2+1e-10 and f['health']['armed']]
            assert all(abs(f['detail']['ikMaximumM']-.565)<1e-12 for f in fs)
            recovery.append({k:r[k] for k in ['seed','stance','entries','firstDrop','firstDeath','final','durationS','stopReason']} |
                {'firstTwoSecondsArm': metrics(early),
                 'firstTwoSecondsReach': {'ikMaximumM': .565, 'steps': len(early),
                    'exceededSteps': sum(f['detail']['requestedArmReachM']>.565 for f in early),
                    'maxRequestedReachM': peak(f['detail']['requestedArmReachM'] for f in early)},
                 'postFirstEntry': foot_metrics([f for f in fs if f['timeS']>t+1e-10]),
                 'firstEntryStep': foot_metrics([f for f in fs if t+1e-10<f['timeS']<=t+1/120+1e-10]),
                 'entryQuarterSecond': foot_metrics([f for f in fs if t+1e-10<f['timeS']<=t+.25+1e-10]),
                 'commonBeforeNewContactEndS': common,
                 'commonAfterEntryBeforeContact': foot_metrics([f for f in fs if t+1e-10<f['timeS']<=common+1e-10]),
                 'stateTransitions': [{k:f[k] for k in ['timeS','health','pelvisM']} for i,f in enumerate(fs) if i==0 or f['health']['state']!=fs[i-1]['health']['state']]})
    return {'schemaVersion':1,'executionCount':sum(d['executionCount'] for d in datasets),
        'summedRunWallSeconds':sum(d['wallSeconds'] for d in datasets),'datasets':datasets,
        'scouting':scouts,'branches':branches,'recovery':recovery,'recoveryChecks':recovery_checks,'metadataReplayChecks':metadata_replays,
        'limits':{'cost':'Counts include4scouts,12arm branches/observers,6recovery/observers,3metadata repeats. Not independent trials or token/development time.',
         'causality':'Same full native and selected controller/event/input prefix. New contacts/reactive AI change after intervention; two full seconds are not identical hits. Same-step chest+arm injuries retained.',
         'observer':'Arm4 and each recovery dataset1 observer pair all seed7. Seed19 physical runs are instrumented; no claim of separate seed19 clone/original full-trace verification.',
         'geometryCorrection':'Initial recovery legacy metadata mistakenly hardcoded .595m; corrected to actual ARM.upper+fore-slack=.565m and replayed. Original/fixed native/control/input exact. No physics change.',
         'support':'Actual foot-fixed-body manifold solver points <=.01m separation and raw normal impulse sum>1e-6Ns. Per-manifold last-substep impulse, not positive-load proof for every point or whole-step force/COP. Speed evaluated at native solver point.',
         'power':'Explicit shoulder/wrist recipient-power rectangle sums. Native joint muscles, pinFeet, constraints and contacts excluded. K includes actual player body+sword, even dropped sword; not work or conserved energy.',
         'acceptance':'No runtime/default/UI/published change. Actual geometry/input in headless runtime, no browser time dilation/user naturalness acceptance.'}}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--evidence-dir',type=pathlib.Path,required=True);p.add_argument('--out',type=pathlib.Path,required=True);a=p.parse_args()
    result=summarize(a.evidence_dir);a.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'executions':result['executionCount'],'wallSeconds':result['summedRunWallSeconds'],'sourceArchivesExact':True,'sameRecoveryPrefix':True,'metadataReplayExact':True}))
