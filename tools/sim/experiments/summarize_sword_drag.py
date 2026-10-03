#!/usr/bin/env python3
"""Verify frozen evidence and repair derived metrics without rerunning physics."""
import argparse, collections, hashlib, json, math, subprocess
from pathlib import Path

p=argparse.ArgumentParser()
p.add_argument('--screen',required=True);p.add_argument('--duel',required=True);p.add_argument('--out',required=True)
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
        for field,key in [('native','nativeTraceSha256'),('control' if count==14 else 'controller','controllerTraceSha256')]:
            assert sha(''.join(f[field] for f in row['frames']).encode())==row[key]
        if count==10:assert sha(''.join(f['input'] for f in row['frames']).encode())==row['inputSha256']
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
    corrections={'angle':'Scale-invariant atan2(cross length,dot) from recorded axes; frozen raw acos travel/error excluded.',
      'input':'Raw afterClashInputSteps invalid: AI inputActive is undefined. Lower bound uses disjoint changed player-hand sample intervals; upper bound uses changed combined input hashes. No exact attack count.',
      'injury':'Severity-zero callbacks are contacts; positive injuries recovered from complete cumulative lists.',
      'observers':'Off rows validated by exact frames only; unobserved maxima zeros excluded.'},
    limitations=['Selected explicit torques/power exclude native motors, offhand/grip and contacts. No total muscle work claim.',
      'Later reactive AI inputs diverge; episode outcomes and unequal durations are not equal-input braking efficiency.',
      'Finite values and small gaps do not prove human motion or perceived realism.'])
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(out=str(out),screenRows=len(rows),episodes=len(episodes),sourceAndTraceChecks='PASS',uniqueNativeTrajectories=result['uniqueScreenNativeTrajectories'])))
