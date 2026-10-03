"""Audit archived recovery experiments and reduce physical metrics without rerunning them."""
import argparse
import hashlib
import json
import math
import pathlib
import subprocess
import sys
sys.dont_write_bytecode = True
from summarize_arm_hit_reinput import metrics as base_metrics, foot_metrics

ROOT = pathlib.Path(__file__).resolve().parents[3]
SOURCES = {
    'arm-hit-terms-seed7.json': 'eae180a',
    'arm-hit-terms-healthy.json': '1c2c6c9',
    'arm-hit-terms-seed19.json': '1c2c6c9',
    'arm-hit-terms-recovery.json': '1c2c6c9',
    'arm-hit-terms-zwei-scout.json': '1c2c6c9',
    'arm-hit-terms-kneel.json': 'f7053b8',
    'arm-hit-terms-cut-kneel.json': 'f7053b8',
    'arm-hit-terms-weapon-cut.json': 'f673e16',
    'arm-recovery-runtime-contact-2s.json': '912e0f6',
    'arm-recovery-runtime-contact-6s.json': '912e0f6',
    'arm-recovery-runtime-healthy-2s.json': '912e0f6',
    'arm-recovery-runtime-cutKneel-2s.json': '912e0f6',
}
def sha(b): return hashlib.sha256(b).hexdigest()
def git(*a): return subprocess.check_output(['git', *a], cwd=ROOT)
def mean(a): return sum(a)/len(a) if a else None

def metrics(frames):
    result = base_metrics(frames)
    for name in ['wrist', 'shoulder']:
        if not result[name]['samples']:
            result[name]['positiveExplicitWorkJ'] = None
            result[name]['negativeExplicitWorkJ'] = None
    return result

def summarize(directory):
    raw, datasets, cache = {}, [], {}
    for name, commit in SOURCES.items():
        data = (directory/name).read_bytes(); d = json.loads(data); raw[name] = d
        assert d['executionPass'] and d['sourceStable'], name
        archive = git('rev-parse', commit).decode().strip()
        for p, h in d['sourceBefore'].items():
            key = archive, p
            if key not in cache:
                b = (ROOT/p).read_bytes() if p.startswith('node_modules/') else git('show', archive+':'+p)
                cache[key] = sha(b)
            assert cache[key] == h, (name, p, archive)
        assert all(v is not False for c in d['observers'] for v in c.values()), name
        assert all(c['samePrefix'] and c['inputExact'] and c['sameDuration'] for c in d['checks']), name
        datasets.append({'rawFile': name, 'rawSHA256': sha(data), 'rawBytes': len(data),
            'sourceArchive': archive, 'sourceRecordedAtStart': d['sourceCommit'], 'sourceArchiveExact': True,
            'sourceStable': True, 'command': d['command'], 'cloneSHA256': d['cloneSHA256'],
            'executionCount': d['executionCount'], 'wallSeconds': d['wallSeconds'],
            'checks': d['checks'], 'observers': d['observers'], 'protocol': d['protocol']})

    summaries = []
    for name, d in raw.items():
        for r in d['rows']:
            if not r['branch']: continue
            group = [x for x in d['rows'] if (x['weapon'], x['seed']) == (r['weapon'], r['seed'])]
            cutoff = min([x['nextContact']['timeS'] for x in group if x['nextContact']] + [r['durationS']])
            fs = [f for f in r['frames'] if f['relativeS'] is not None]
            entry = {'dataset': name} | {k:r[k] for k in ['weapon','seed','mode','hit','branch','nextContact','firstDrop','firstDeath','durationS','stopReason','final']}
            entry |= {'whole': metrics(fs), 'phases': {p:metrics([f for f in fs if f['phase']==p]) for p in dict.fromkeys(f['phase'] for f in fs)},
                'commonBeforeNewContactEndS': cutoff, 'commonBeforeNewContact': metrics([f for f in fs if f['timeS']<=cutoff+1e-10]),
                'grippingFrames': sum(f['gripping'] for f in fs)}
            if fs and 'detail' in fs[0]: entry['bodySupport'] = foot_metrics(fs)
            # Research requests are pre-solver; current native poses/hand error are post-solver.
            ts = [f for f in fs if f.get('armTerms',{} ) and f['armTerms'].get('elbow') and f['armTerms'].get('shoulder')]
            if ts:
                e = [abs(f['armTerms']['elbow']['requestedPositionRad']-f['armTerms']['elbow']['currentPositionRad']) for f in ts]
                s = [math.sqrt(sum(v*v for v in f['armTerms']['shoulder']['errorWorld'])) for f in ts]
                entry['preSolverRequests'] = {'frames': len(ts),'meanElbowErrorRad':mean(e),'maxElbowErrorRad':max(e),
                    'meanShoulderErrorRad':mean(s),'maxShoulderErrorRad':max(s)}
            summaries.append(entry)

    pairs = [('contact-2s','arm-hit-terms-seed7',7),('contact-2s','arm-hit-terms-seed19',19),
             ('contact-6s','arm-hit-terms-recovery',7),('healthy-2s','arm-hit-terms-healthy',7),
             ('cutKneel-2s','arm-hit-terms-cut-kneel',7)]
    parity = []
    physical_keys = ['timeS','relativeS','phase','request','health','enemyHealth','actualHandM','externalGoalM',
        'handErrorM','ownAimErrorRad','rawAimErrorRad','actualAxis','ownAim','swordOmegaRadps','swordTwistRadps',
        'swordKJ','bodyAndSwordKJ','pelvisM','gaps','bodyMotion','elbowTarget','gripping','cutContacts','detail']
    for runtime, research, seed in pairs:
        for r in raw['arm-recovery-runtime-'+runtime+'.json']['rows']:
            if r['seed'] != seed: continue
            mode = 'legacy' if r['weapon']=='zweihander' and r['mode']=='activation' else r['mode']
            ref = next(x for x in raw[research+'.json']['rows'] if (x['weapon'],x['seed'],x['mode']) == (r['weapon'],seed,mode))
            checked = {k:r[k]==ref[k] for k in ['nativeTraceSha256','inputSha256','events','clashes','durationS','final']}
            # Older healthy/cut tools may not include detail unless requested: compare common fields.
            common_keys = set(r['frames'][0]) & set(ref['frames'][0]) & set(physical_keys)
            checked['physicalFramesExact'] = ([{k:f[k] for k in common_keys} for f in r['frames']] == [{k:f[k] for k in common_keys} for f in ref['frames']])
            assert all(checked.values()), (runtime,research,r['weapon'],r['mode'],checked)
            controller_equal = r['controlTraceSha256']==ref['controlTraceSha256']
            if r['mode']=='legacy': assert controller_equal
            parity.append({'runtime':runtime,'research':research,'weapon':r['weapon'],'seed':seed,'mode':r['mode'],'referenceMode':mode,
                'checks':checked,'fullControllerExact':controller_equal,
                'controllerContract':'Legacy must match. Runtime activation has an own armRecoveryModel field absent from isolated research WeakMap; full controller digest equality is not claimed.'})

    brow = (directory/'arm-recovery-mobile.json').read_bytes(); browser=json.loads(brow)
    assert browser['pass'] and browser['sourceStable'] and not browser['errors']
    for p,h in browser['sourceBefore'].items(): assert sha(git('show','912e0f6:'+p))==h,p
    return {'schemaVersion':1,'executionCount':sum(d['executionCount'] for d in datasets),
        'researchExecutionCount':sum(d['executionCount'] for d in datasets if d['rawFile'].startswith('arm-hit-terms')),
        'runtimeExecutionCount':sum(d['executionCount'] for d in datasets if d['rawFile'].startswith('arm-recovery-runtime')),
        'summedRunWallSeconds':sum(d['wallSeconds'] for d in datasets),'datasets':datasets,'summaries':summaries,'runtimeParity':parity,
        'twoHandScouts':[{k:r[k] for k in ['weapon','seed','hit','stopReason','durationS','final']} for r in raw['arm-hit-terms-zwei-scout.json']['rows']],
        'browser':{'rawFile':'arm-recovery-mobile.json','rawSHA256':sha(brow),'pass':True,'sourceStable':True,'sourceArchive':'912e0f6',
            'wallSeconds':browser['wallSeconds'],'cases':len(browser['rows']),'scope':browser['scope'],'toolSHA256':sha((ROOT/'tools/browser/arm_recovery_trial.mjs').read_bytes())},
        'unitTests':{'command':'node tools/tests/arm_recovery_activation.mjs','passed':7,'sourceArchive':'912e0f6'},
        'limits':{
            'cost':'58 physical executions include scouts, research controls, observers and runtime repeats, not58 independent combat trials. Wall time sum is execution time, not total development/token cost. Some batches ran concurrently.',
            'causality':'Actual contact seed7/19 uses same native/controller/events/input prefix. Next contacts diverge; full2s metrics are regression observations, not identical subsequent hits. Common pre-contact windows retained.',
            'synthetic':'healthy/kneel/cutKneel use gap6m and disable AI updates with native bodies still dynamic. kneel calls knockDown(false); cutKneel additionally calls applyWound. These are not observed combat injury scenes.',
            'runtime':'Only explicit independent one-hand flag. Main shoulder/elbow/wrist/elbow-gravity uses filtered vigor during getup; body/legs/offarm keep ordinary muscle. Damage/vigor/strength/Hill/gains/reactions unchanged. Increased permitted arm activation is not improved efficiency at equal torque/work.',
            'twoHand':'Research primary and both-weapon-arm activation worsen stop twist. No two-hand product activation. Two scouts3/11 produced no qualifying arm wound; synthetic cases are not actual-hit two-hand acceptance.',
            'observer':'Research arm terms are pre-solver requests, not native joint applied torque/work. Runtime clone observers wrap only driveSword/manualMuscle. No full native work or contact-point load/COP claims.',
            'lifecycle':'Long6s runs have different new contacts and armed durations; never compare whole-window arm means as drop-prevention proof. No pose/velocity correction, browser time dilation or real phone human acceptance.',
            'publication':'Local optional implementation and built-game mobile smoke only. General defaults unchanged; no new push/deploy/auth retry/peer read.'}}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--evidence-dir',type=pathlib.Path,required=True);p.add_argument('--out',type=pathlib.Path,required=True);a=p.parse_args()
    d=summarize(a.evidence_dir);a.out.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'executions':d['executionCount'],'wallSeconds':d['summedRunWallSeconds'],'parityRows':len(d['runtimeParity']),'browserPass':True}))
