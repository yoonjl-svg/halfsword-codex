"""Paired, censoring-aware descriptive comparison; no invented single score."""
import json, pathlib, statistics
P=pathlib.Path('docs/research/iberian_compare_20261018')
IDS=['base','offset16','offset24','impulse6','impulse9']
def read(kind,id): return json.loads((P/'raw'/f'{kind}-{id}.json').read_text())
def med(a): return statistics.median(a) if a else None
def total(rows,key): return sum(r[key] for r in rows)
def damage(h): return any(x>1e-10 for x in h['delta'].values())
def health(rows,k,ends=None):
    data=[h for i,r in enumerate(rows) for h in r[k]['applied'] if ends is None or h['t']<ends[i]]
    out={d:sum(h['delta'][d] for h in data) for d in ['limb','concussion','bleed','balance','pain']}
    out.update(hits=len(data),effectiveHits=sum(damage(h) for h in data))
    if ends is None: out.update(deaths=sum(not r[k]['end']['alive'] for r in rows),bloodLost=sum(r[k]['bloodLost'] for r in rows))
    return out
def counters(rows,ends=None):
    out={'inputs':0,'withEnemyDamage':0,'withPlayerDamage':0,'withTrade':0,'enemyLimb':0,'playerLimb':0}
    for i,r in enumerate(rows):
        end=ends[i] if ends else r['duration']
        commands=[c for c in r['commands'] if c['action'] in ['tap','swipe','counterSwipe'] and c['t']<end]
        for j,c in enumerate(commands):
            stop=min(end,c['t']+1,commands[j+1]['t'] if j+1<len(commands) else end)
            p=[h for h in r['health']['applied'] if c['t']<=h['t']<stop and damage(h)]
            e=[h for h in r['enemy']['applied'] if c['t']<=h['t']<stop and damage(h)]
            out['inputs']+=1;out['withEnemyDamage']+=bool(e);out['withPlayerDamage']+=bool(p);out['withTrade']+=bool(p and e)
            out['enemyLimb']+=sum(h['delta']['limb'] for h in e);out['playerLimb']+=sum(h['delta']['limb'] for h in p)
    return out
def rhythm(rows,ends=None):
    samples=[s for i,r in enumerate(rows) for s in r['observations']['samples'] if not ends or s['t']<ends[i]]
    duration=sum(ends) if ends else total(rows,'duration')
    attacks=sum(sum(not ends or a['t']<ends[i] for a in r['observations']['attacks']) for i,r in enumerate(rows))
    windows=[w for i,r in enumerate(rows) for w in r['observations']['windows'] if w['event']['d']==0 and (not ends or w['event']['time']<ends[i])]
    first03=[f for w in windows for f in w['frames'] if 0<=f['t']-w['event']['time']<.3]
    recovery=[]
    for i,r in enumerate(rows):
        end=ends[i] if ends else r['duration']
        for w in r['observations']['windows']:
            t=w['event']['time']
            if w['event']['d']!=0 or t>=end:continue
            commands=[c['t']-t for c in r['commands'] if c['action'] in ['tap','swipe'] and t<=c['t']<min(t+1.2,end)]
            if commands:recovery.append(min(commands))
    return {'duration':duration,'meanDistance':statistics.mean(s['distance'] for s in samples),'nearFractionUnder1_35':sum(s['distance']<1.35 for s in samples)/len(samples),
      'clinchFraction':sum(s['clinch'] for s in samples)/len(samples),'enemyAttackCharges':attacks,'enemyAttackChargesPer30s':attacks/duration*30,
      'playerBeatEvents':len(windows),'aiBeatEvents':sum(b['d']==1 and (not ends or b['time']<ends[i]) for i,r in enumerate(rows) for b in r['beats']),
      'medianCounterInputAfterBeat':med(recovery),'eventsWithCounterInput':len(recovery),
      'meanChestClearanceFirst03':statistics.mean(s['chest'] for s in first03) if first03 else None,
      'envelopeClearFractionFirst03':sum(s['envelope']>0 for s in first03)/len(first03) if first03 else None}
def single(rows):
    out={}
    for counter in [False,True]:
        rs=[r for r in rows if r['counter']==counter];seen=[r for r in rs if r['beats']]
        out[str(counter)]={'conditions':len(rs),'eligible':len(seen),'player':health(rs,'health'),'enemy':health(rs,'enemy'),'counters':counters(rs)}
        trajectories=[]
        for r in seen:
            b=r['beats'][0];frames=r['observations'];pts={}
            for t in [.1,.2,.3,.5]:
                choices=[f for f in frames if abs(f['t']-b['time']-t)<.011]
                if choices:
                    f=min(choices,key=lambda f:abs(f['t']-b['time']-t));pts[str(t)]={k:f[k] for k in ['chest','head','envelope']}
            early=[f for f in frames if 0<=f['t']-b['time']<.4]
            trajectories.append({'attack':r['attack'],'gap':r['gap'],'event':b,'points':pts,'envelopeClearSecondsFirst04':sum(f['envelope']>0 for f in early)/120})
        out[str(counter)]['trajectories']=trajectories
    return out
if __name__=='__main__':
    live={id:read('live',id) for id in IDS};probe={id:read('probe',id) for id in IDS}
    assert all(len(v)==12 for v in live.values()),'Incomplete live matrix'
    assert all(len(v)==24 for v in probe.values()),'Incomplete diagnostic matrix'
    keys=lambda rows:[(r['seed'],r['atk'],r['policy']) for r in rows]
    assert all(keys(v)==keys(live['base']) for v in live.values())
    ends=[min(live[id][i]['duration'] for id in IDS) for i in range(12)]
    result={'design':{'liveConditionsPerArm':12,'diagnosticConditionsPerArm':24,'arms':5,'totalRuns':180,'humanPlaytests':0,'commonEnds':ends},'live':{},'probe':{},'paired':[],'matchedFirstBeat':{}}
    for id,rows in live.items():
        result['live'][id]={'full':{'player':health(rows,'health'),'enemy':health(rows,'enemy'),'counters':counters(rows),'rhythm':rhythm(rows),
          'blockSpent':sum(r['health']['stamina']['spent']['block'] for r in rows),'attackSpent':sum(r['health']['stamina']['spent']['attack'] for r in rows),
          'heldTime':sum(r['health']['heldTime'] for r in rows),'exhaustedTime':sum(r['health']['exhaustedTime'] for r in rows),'negativeStaminaTime':sum(r['health']['negativeStaminaTime'] for r in rows)},
          'common':{'player':health(rows,'health',ends),'enemy':health(rows,'enemy',ends),'counters':counters(rows,ends),'rhythm':rhythm(rows,ends)}}
        result['probe'][id]=single(probe[id])
        changes={str(t):[] for t in [.1,.2,.3,.5]}
        for i,r in enumerate(rows):
            bw=live['base'][i]['observations']['windows']
            if not bw:continue
            bw=bw[0];w=r['observations']['windows'][0]
            assert bw['event']['d']==w['event']['d']==0
            assert abs(bw['event']['time']-w['event']['time'])<1e-6
            for dt,values in changes.items():
                a=min(bw['frames'],key=lambda x:abs(x['t']-bw['event']['time']-float(dt)))
                b=min(w['frames'],key=lambda x:abs(x['t']-w['event']['time']-float(dt)))
                assert abs(a['t']-bw['event']['time']-float(dt))<.011 and abs(b['t']-w['event']['time']-float(dt))<.011
                values.append((b['chest']-a['chest'])*100)
        result['matchedFirstBeat'][id]={dt:{'n':len(v),'medianCm':med(v),'minCm':min(v),'maxCm':max(v),'positive':sum(x>.01 for x in v),'valuesCm':v} for dt,v in changes.items()}
    for i,b in enumerate(live['base']):
        result['paired'].append({'seed':b['seed'],'atk':b['atk'],'policy':b['policy'],'commonEnd':ends[i],
          'arms':{id:{'duration':v[i]['duration'],'beats':len(v[i]['beats']),'pAlive':v[i]['health']['end']['alive'],'eAlive':v[i]['enemy']['end']['alive'],
            'pLimb':v[i]['health']['limbLost'],'pConcussion':v[i]['health']['concussion'],'eLimb':v[i]['enemy']['limbLost']} for id,v in live.items()}})
    (P/'summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result['live'],ensure_ascii=False,indent=2))
