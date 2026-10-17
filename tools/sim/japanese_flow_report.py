"""Reproduce the report from preserved JSON, including explicitly superseded input trials."""
import collections, json, pathlib, sys

root = pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '/workspace/japanese-flow-20261017')
load = lambda name: json.loads((root/name).read_text())
key = lambda r: (r['seed'], r['atk'], r['policy'])

def aggregate(rows):
    n=len(rows)
    mean=lambda get:sum(get(r) for r in rows)/n
    return dict(n=n, deaths=sum(not r['health']['end']['alive'] for r in rows),
        enemyDeaths=sum(not r['enemy']['end']['alive'] for r in rows),
        exposure=sum(r['duration'] for r in rows), flows=sum(len(r['flows']) for r in rows),
        noFlow=sum(not r['flows'] for r in rows), contacts=sum(len(r['clashes']) for r in rows),
        blood=mean(lambda r:r['health']['bloodLost']), limbs=mean(lambda r:r['health']['limbLost']),
        concussion=mean(lambda r:r['health']['concussion']),
        disarmed=sum(not r['health']['end']['armed'] for r in rows),
        enemyLimbs=mean(lambda r:r['enemy']['limbLost']), enemyBlood=mean(lambda r:r['enemy']['bloodLost']),
        blockCost=mean(lambda r:r['health']['stamina']['spent'].get('block',0)),
        attackCost=mean(lambda r:r['health']['stamina']['spent'].get('attack',0)),
        actions=sum(c['action'] in ['tap','swipe'] for r in rows for c in r['commands']),
        overlap=sum(x['force']>0 for r in rows for x in r.get('slashFrames',[])))

def paired(a,b):
    bs={key(r):r for r in b};out=[]
    for r in a:
        s=bs[key(r)];end=min(r['duration'],s['duration'])
        def damage(x,who):
            hits=[h for h in x[who]['applied'] if h['t']<end-1e-8]
            return {k:sum(h['delta'][k] for h in hits) for k in ['bleed','concussion','limb','balance']}
        out.append(dict(seed=r['seed'],atk=r['atk'],policy=r['policy'],duration=[r['duration'],s['duration']],
            death=[not r['health']['end']['alive'],not s['health']['end']['alive']],
            changed=r['health']!=s['health'] or r['enemy']!=s['enemy'],commonEnd=end,
            commonPlayer=[damage(r,'health'),damage(s,'health')],commonEnemy=[damage(r,'enemy'),damage(s,'enemy')]))
    return out

result={'baseCommit':'c7c2131eb741d197be3041d4fe596171ad8ec185','screen':{},'independent':{},'pairs':{}}
for name in ['base','diagonal','diagonal-strong','release','roof-path','glance']:
    result['screen'][name]=aggregate(load(f'screen-{name}.json'))
result['screenSwipe']={name:aggregate(load(f'swipe-v4-screen-{name}.json')) for name in ['base','release','free-cut']}
samples={}
for name in ['base','free-cut']:
    # v4 changes only swipe broken-state persistence. Reuse v3 reactive/tap
    # (unchanged) and replace all v3 swipe results, including the baseline.
    samples[name]=[r for r in load(f'independent-{name}.json') if r['policy']!='slash']+load(f'swipe-v4-independent-{name}.json')
    assert len(samples[name])==36 and len({key(r) for r in samples[name]})==36
    result['independent'][name]={p:aggregate([r for r in samples[name] if p=='all' or r['policy']==p]) for p in ['all','reactive','riposte','slash']}
result['pairs']=paired(samples['base'],samples['free-cut'])
result['changedPairs']=sum(r['changed'] for r in result['pairs'])
counts=collections.Counter();phases=collections.Counter()
for r in samples['base']:
    for e in r['contacts']:
        d=next(x for x in e['details'] if x['d']==0);counts['newContacts']+=1
        if d['active']:
            counts['active']+=1
            for k,fail in [('downFail',d['down']<3.5),('lowFail',d['height']<-.1),('roofFail',d['roof']>=0)]:counts[k]+=fail
        if e['flow']==0:
            counts['flows']+=1;counts['coverAtLeastHalf']+=d['cover']>=.5;counts['zeroImpulse']+=e['impulse']<=0
            phases[e['enemyMode']+'/'+str(e['enemyPhase'])]+=1
result['gates']=dict(counts);result['flowPhases']=dict(phases)
result['window']=[dict(seed=r['seed'],atk=r['atk'],policy=r['policy'],paired=r['paired'],variants=[{k:v[k] for k in ['kind','front','commands']} for v in r['variants']]) for r in load('first-flow-window.json')]
result['caveats']=['Player input surrogate, not a human playtest.','Four independent seeds across repeated conditions, not 36 independent people.','Endpoint damage can be reduced by earlier death; use paired common-exposure deltas too.','v3 swipe trials are superseded and excluded; v3 reactive/tap is unchanged by v4.','No release candidate proved an overall combat benefit.']
(root/'report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['independent','gates','changedPairs']},ensure_ascii=False))
