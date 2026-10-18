import gzip,json,pathlib,collections,hashlib
P=pathlib.Path('docs/research/iberian_ai_league_20261019')
R={k:json.loads(gzip.decompress((P/f'raw/{k}.json.gz').read_bytes())) for k in ['native','outward']}
assert len(R['native'])==len(R['outward'])==72
assert all(a['case']==b['case'] for a,b in zip(R['native'],R['outward']))
def totals(rows):
    counts=collections.Counter(r['result'] for r in rows)
    out={'n':len(rows),**{k:counts[k] for k in ['W','L','D']},'score':(counts['W']+.5*counts['D'])/len(rows),
         'procRounds':sum(bool(r['events']) for r in rows),'procCount':sum(len(r['events']) for r in rows),
         'breaksSelf':sum(len(r['breakTimes']['self']) for r in rows),'breaksFoe':sum(len(r['breakTimes']['foe']) for r in rows),
         'attacksSelf':sum(r['attacks']['self'] for r in rows),'attacksFoe':sum(r['attacks']['foe'] for r in rows),
         'selfDeathCauses':dict(collections.Counter(r['health']['death']['cause'] for r in rows if r['health']['death'])),
         'foeDeathCauses':dict(collections.Counter(r['enemy']['death']['cause'] for r in rows if r['enemy']['death']))}
    for who in ['health','enemy']:
        out[who]={m:sum(r[who][m] for r in rows) for m in ['limbLost','concussion','bleedAdded','bloodLost','downTime','exhaustedTime']}
    return out
def common(ids,post=None):
    out={v:{who:{m:0 for m in ['limb','concussion','bleed']} for who in ['health','enemy']} for v in R}
    n=0;exposure=0;complete=0
    for i in ids:
        a,b=R['native'][i],R['outward'][i]
        lo=0 if post is None else a['first']
        if lo is None:continue
        hi=min(a['duration'],b['duration'],30 if post is None else lo+post)
        if hi<lo:continue
        n+=1;exposure+=hi-lo;complete+=hi>=(30 if post is None else lo+post)-1e-7
        for v in R:
            for who in ['health','enemy']:
                for h in R[v][i][who]['applied']:
                    if lo-1e-9<=h['t']<=hi+1e-9:
                        for m in out[v][who]:out[v][who][m]+=h['delta'][m]
    return {'n':n,'complete':complete,'seconds':exposure,'metrics':out}
def group(ids):
    return {**{v:totals([R[v][i] for i in ids]) for v in R},'common30':common(ids),'first5':common(ids,5)}
ids=list(range(72));primary=[i for i in ids if R['native'][i]['case']['school']!='none']
schools={s:group([i for i in ids if R['native'][i]['case']['school']==s]) for s in dict.fromkeys(r['case']['school'] for r in R['native'])}
checks={'count':72,'sameCases':True,
 'prefixEqual':sum(a['prefixHash']==b['prefixHash'] for a,b in zip(R['native'],R['outward'])),
 'firstEqual':sum(a['first']==b['first'] for a,b in zip(R['native'],R['outward'])),
 'noExperimentalEffects':all(not r['effects'] and r['minScale']==1 and r['activeFrames']==0 and r['twistFrames']==0 and not r['settings']['forceBenefit'] for rows in R.values() for r in rows),
 'bothAI':all(r['settings']['bothAI'] for rows in R.values() for r in rows)}
assert checks['prefixEqual']==72 and checks['firstEqual']==72 and checks['noExperimentalEffects'] and checks['bothAI'],checks
changed=[{'i':i,'case':R['native'][i]['case'],'native':R['native'][i]['result'],'outward':R['outward'][i]['result'],'first':R['native'][i]['first']} for i in ids if R['native'][i]['result']!=R['outward'][i]['result']]
no_proc_equal=all(a['health']==b['health'] and a['enemy']==b['enemy'] and a['duration']==b['duration'] for a,b in zip(R['native'],R['outward']) if a['first'] is None)
assert no_proc_equal
result={'checks':checks,'noProcExactReplay':no_proc_equal,'primaryFiveSchools':group(primary),'includingNone':group(ids),'schools':schools,
 'weapons':{w:group([i for i in primary if R['native'][i]['case']['weapon']==w]) for w in ['zweihander','flamberge']},
 'slots':{str(s):group([i for i in primary if R['native'][i]['case']['slot']==s]) for s in [0,1]},
 'seeds':{str(s):group([i for i in primary if R['native'][i]['case']['seed']==s]) for s in [3101,3102,3103]},'changedOutcomes':changed,
 'manifest':{str(p.relative_to(P)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((P/'raw').glob('*.gz'))}}
(P/'summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['checks','primaryFiveSchools','schools','changedOutcomes']},ensure_ascii=False,indent=2))
