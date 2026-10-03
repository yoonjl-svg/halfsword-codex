#!/usr/bin/env python3
"""Verify frozen evidence and repair derived metrics without rerunning physics."""
import argparse, collections, hashlib, json, math, subprocess
from pathlib import Path

p=argparse.ArgumentParser()
p.add_argument('--screen',required=True);p.add_argument('--duel',required=True);p.add_argument('--out',required=True)
p.add_argument('--activation-screen');p.add_argument('--activation-duel')
a=p.parse_args();repo=Path(__file__).resolve().parents[3];out=Path(a.out)
assert not out.exists(), 'Preserve evidence; use a new output file'
sha=lambda b:hashlib.sha256(b).hexdigest()
norm=lambda v:math.sqrt(sum(x*x for x in v))
dot=lambda a,b:sum(x*y for x,y in zip(a,b))
def angle(a,b):
    cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
    assert norm(a)>0 and norm(b)>0
    return math.atan2(norm(cross),dot(a,b))
def verify(filename,count):
    raw=Path(filename).read_bytes();r=json.loads(raw)
    assert r['measurementValid'] and r['sourceStable'] and len(r['rows'])==count
    assert r['sourceBefore']==r['sourceAfter'] and r['sourceCommit']==r['sourceCommitAfter']
    for f,digest in r['sourceBefore'].items():
        b=(repo/f).read_bytes() if f.startswith('node_modules/') else subprocess.check_output(['git','-C',str(repo),'show',r['sourceCommit']+':'+f])
        assert sha(b)==digest,f
    for row in r['rows']:
        screenKind='control' in row['frames'][0]
        for field,key in [('native','nativeTraceSha256'),('control' if screenKind else 'controller','controllerTraceSha256')]:
            assert sha(''.join(f[field] for f in row['frames']).encode())==row[key]
        if not screenKind:assert sha(''.join(f['input'] for f in row['frames']).encode())==row['inputSha256']
        assert all(n==len(row['frames']) for n in row['counts'].values())
    assert all(v for c in r['checks'] for v in c.values() if isinstance(v,bool))
    return r,dict(bytes=len(raw),sha256=sha(raw),sourceCommit=r['sourceCommit'],executions=count,wallSeconds=r['wallSeconds'],sourceManifestAndTraceDigestsVerified=True)

screen,sr=verify(a.screen,14);duel,dr=verify(a.duel,10)
rows=[]
for r in screen['rows']:
    if not r['observed']:continue
    ms=r['metrics'];after=[m for m in ms if m['phase']!='down'];travel=0
    # At the phase boundary, include the final stroke -> first after-step angle.
    for prev,m in zip(ms,ms[1:]):
        if m['phase']!='down':travel+=angle(prev['bladeAxis'],m['bladeAxis'])
    wrist=lambda m:next(t['T'] for t in m['torques'] if t['path']=='driveSword' and t['part']=='sword')
    rows.append(dict(weapon=r['weapon'],ending=r['ending'],mode=r['mode'],
      afterBladeDirectionTravelRad=travel,finalDirectionErrorRad=angle(ms[-1]['bladeAxis'],ms[-1]['targetAxis']),
      downPeakTipSpeedMps=max(m['tipSpeedMps'] for m in ms if m['phase']=='down'),
      peakTipSpeedMps=max(m['tipSpeedMps'] for m in ms),peakSwordKJ=max(m['swordKJ'] for m in ms),
      finalSwordKJ=ms[-1]['swordKJ'],maxGapM=max(m['maxGapM'] for m in ms),
      maxAbsBladeTwistRadps=max(abs(m['bladeTwistRadps'])/norm(m['bladeAxis']) for m in ms),
      afterExplicitWristTorqueMagnitudeIntegralNms=sum(norm(wrist(m)) for m in after)*screen['protocol']['DT']))
episodes=[]
for r in duel['rows']:
    if not r['observed']:continue
    frames=r['frames'];samples=r['samples'];summary=r['summary'];fc=summary['firstClash']
    wounds=r.get('finalEvents',samples[-1]['wounds']);assert len(wounds)==summary['wounds'], 'Recorded event list incomplete'
    positive=[w for w in wounds if w['vic']==0 and w['severity']>0]
    lower=upper=0
    if fc:
        for prev,m in zip(samples,samples[1:]):
            if prev['i']>=fc['i'] and m['playerInput']['hand']!=prev['playerInput']['hand']:lower+=1
        upper=sum(prev['input']!=m['input'] for prev,m in zip(frames,frames[1:]) if m['i']>fc['i'])
    states=collections.Counter(f['state'] for f in frames)
    episodes.append(dict(weapon=r['weapon'],seed=r['seed'],mode=r['mode'],durationS=summary['durationS'],
      finalState=frames[-1]['state'],playerAlive=summary['playerAlive'],enemyAlive=summary['enemyAlive'],
      firstClash=fc,firstPositivePlayerInjury=positive[0] if positive else None,
      positivePlayerInjuryCount=len(positive),postClashPlayerHandChangeStepBounds=[lower,upper] if fc else None,
      exactPostClashHandChangeSteps=summary.get('afterClashHandChangeSteps'),
      stateOccupancyS={k:n/120 for k,n in states.items()},
      maxGapM=summary['maxGapM'],maxPelvisHeightM=summary['maxPelvisHeightM'],
      maxPelvisUpwardSpeedMps=summary['maxPelvisUpwardSpeedMps'],maxBodySpeedMps=summary['maxBodySpeedMps'],
      maxSwordKJ=summary['maxSwordKJ'],maxBladeTwistRadps=summary['maxBladeTwistRadps']))
# Observer-off copies contain no physical samples; validate hashes, never zeros as maxima.
for report in [screen,duel]:
    for off in [r for r in report['rows'] if not r['observed']]:
        on=next(r for r in report['rows'] if r['observed'] and all(r[k]==off[k] for k in (['weapon','ending','mode'] if report is screen else ['weapon','seed','mode'])))
        assert on['frames']==off['frames']
result=dict(schemaVersion=1,screenReceipt=sr,duelReceipt=dr,screen=rows,episodes=episodes,
    uniqueScreenNativeTrajectories=len({r['nativeTraceSha256'] for r in screen['rows']}),
    corrections={'angle':'All direction metrics recomputed using scale-invariant atan2(cross length,dot). First drag raw batch acos travel/error is excluded; later source already uses atan2.',
      'input':'First drag raw afterClashInputSteps is invalid: AI inputActive is undefined. New batches count actual hand changes. Bounds use disjoint player-hand sample intervals and changed combined input hashes. No exact attack count.',
      'injury':'Severity-zero callbacks are contacts; positive injuries recovered from complete cumulative lists.',
      'observers':'Off rows validated by exact frames only; unobserved maxima zeros excluded.'},
    limitations=['Selected explicit torques/power exclude native motors, offhand/grip and contacts. No total muscle work claim.',
      'Later reactive AI inputs diverge; episode outcomes and unequal durations are not equal-input braking efficiency.',
      'Finite values and small gaps do not prove human motion or perceived realism.'])
activation={}
for filename,key,reference in [(a.activation_screen,'screen',screen),(a.activation_duel,'duel',duel)]:
    if not filename:continue
    data,receipt=verify(filename,4);observed=[r for r in data['rows'] if r['observed']]
    assert len(observed)==2
    for row in data['rows']:
        # The larger batch may put its observer-off check on another seed.
        # Compare every narrow execution to that case's recorded observed frames;
        # separate observer-off checks still establish invariance within this run.
        prior=next(r for r in reference['rows'] if r['observed'] and r['weapon']==row['weapon'] and r['mode']==row['mode'] and (r['ending']==row['ending'] if key=='screen' else r['seed']==row['seed']))
        assert prior['frames']==row['frames'], 'Read-only activation reconstruction changed the previous trajectory'
    original,candidate=observed;field='metrics' if key=='screen' else 'responses';responseKey='wristResponse' if key=='screen' else 'response'
    outputChecks=0;first=None
    for x,y in zip(original[field],candidate[field]):
        for item in [x,y]:
            d=item[responseKey]
            if d:
                c=d['originalOutputCheck'];assert all(c[k]<=1e-9 for k in ['capError','torqueError','hillError']) and c['latchExact'] and c['latchAngleExact'];outputChecks+=1
        u,v=x[responseKey],y[responseKey]
        if first is None and u and v and u['selectedDamping']!=v['selectedDamping']:
            assert u['before']==v['before'] and u['aimWorld']==v['aimWorld'], 'First selected damping contrast does not have equal incoming observations'
            first=dict(i=x['i'],timeS=x['timeS'],incomingObservationsExact=True,aimExact=True,
              angleRad=u['angleRad'],towardRadps=u['towardRadps'],targetTowardRadps=u['targetTowardRadps'],stopAngleRad=u['stopAngleRad'],
              original={k:u[k] for k in ['releaseThresholdRad','selectedDamping','baseCapBeforeHillNm','capAfterHillNm','releaseSelected','gate']},
              candidate={k:v[k] for k in ['releaseThresholdRad','selectedDamping','baseCapBeforeHillNm','capAfterHillNm','releaseSelected','gate']})
            if key=='duel':
                first['originalActualWristTorque']=x['actualWristTorque'];first['candidateActualWristTorque']=y['actualWristTorque']
                assert x['actualWristTorque']!=y['actualWristTorque']
    activation[key]=dict(receipt=receipt,eligibleOriginalOutputChecks=outputChecks,previousFullFramesExact=True,firstDifferentSelectedDamping=first)
if activation:result['activation']=activation
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(out=str(out),screenRows=len(rows),episodes=len(episodes),sourceAndTraceChecks='PASS',uniqueNativeTrajectories=result['uniqueScreenNativeTrajectories'])))
