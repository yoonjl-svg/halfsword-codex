"""First-event paired short windows plus common-exposure full fights; no HP composite."""
import collections,gzip,hashlib,json,pathlib,sys
P=pathlib.Path('docs/research/iberian_control_duration_20261018')
KEYS=['limb','concussion','bleed','balance','pain']
def damage(r,side,start,end):
    return {k:sum(h['delta'][k] for h in r[side]['applied'] if start<=h['t']<end) for k in KEYS}
def add(rows):return {k:sum(r[k] for r in rows) for k in KEYS}
def opportunities(r,start,end):
    cmds=[c for c in r['commands'] if c['action'] in ['tap','swipe','counterSwipe'] and start<=c['t']<end]
    hits=[h for h in r['enemy']['applied'] if start<=h['t']<end and any(h['delta'][k]>1e-10 for k in KEYS)]
    return {'commands':len(cmds),'commandThenEnemyDamage':sum(any(c['t']<=h['t']<min(end,c['t']+1,cmds[j+1]['t'] if j+1<len(cmds) else end) for h in hits) for j,c in enumerate(cmds)),'enemyDamageWindow':int(bool(hits))}
def phase_summary(phase):
    plan=json.loads((P/f'{phase}-plan.json').read_text());n=len(plan['cases']);arms={}
    for cfg in plan['configs']:
        file=P/'raw'/f"{phase}-{cfg['id']}.json.gz"
        if file.exists():
            rows=json.loads(gzip.decompress(file.read_bytes()))
            if len(rows)==n:arms[cfg['id']]=rows
    if 'alone' not in arms:return None
    ids=list(arms);ends=[min(arms[k][i]['duration'] for k in ids) for i in range(n)]
    firsts=[i for i in range(n) if arms['alone'][i]['observation']['first'] is not None]
    prefixes=all(len({arms[k][i]['observation']['prefixHash'] for k in ids})==1 for i in range(n))
    assert prefixes,'Different first-event prefix'
    assert all(len({arms[k][i]['observation']['first'] for k in ids})==1 for i in firsts)
    out={'n':n,'completeArms':len(ids),'expectedArms':len(plan['configs']),'firstEventCases':firsts,'prefixEqualAll':prefixes,'commonSeconds':sum(ends),'arms':{},'cases':[]}
    for k,rows in arms.items():
        full={'player':add([damage(r,'health',0,ends[i]) for i,r in enumerate(rows)]),'enemy':add([damage(r,'enemy',0,ends[i]) for i,r in enumerate(rows)]),'deaths':sum(not r['health']['end']['alive'] for r in rows),'KO':sum(r['health']['death'] and r['health']['death']['cause']=='기절' or False for r in rows),'ownBreaks':sum(len(r['weapons']['player']['breaks']) for r in rows),'enemyBreaks':sum(len(r['weapons']['enemy']['breaks']) for r in rows),'effects':sum(len(r['controlEvents']) for r in rows)}
        short={}
        for window in [.5,1,1.5]:
            pairs=[];ops=[];pairrows=[]
            for i in firsts:
                t=rows[i]['observation']['first'];end=min(t+window,ends[i])
                if end+1e-8<t+window:continue
                player=damage(rows[i],'health',t,end);enemy=damage(rows[i],'enemy',t,end);base=damage(arms['alone'][i],'health',t,end)
                pairs.append((player,enemy,base));ops.append(opportunities(rows[i],t,end));pairrows.append({'i':i,'t':t,'player':player,'enemy':enemy,'base':base})
            short[str(window)]={'n':len(pairs),'player':add([p[0] for p in pairs]),'enemy':add([p[1] for p in pairs]),'opportunities':dict(sum((collections.Counter(o) for o in ops),collections.Counter())),'changes':{d:{'better':sum(p[0][d]<p[2][d]-1e-8 for p in pairs),'worse':sum(p[0][d]>p[2][d]+1e-8 for p in pairs),'same':sum(abs(p[0][d]-p[2][d])<=1e-8 for p in pairs)} for d in KEYS},'pairs':pairrows}
        out['arms'][k]={'config':rows[0]['controlConfig'],'full':full,'short':short}
    for i in range(n):out['cases'].append({'i':i,**plan['cases'][i],'first':arms['alone'][i]['observation']['first'],'arms':{k:{'death':arms[k][i]['health']['death'],'player':damage(arms[k][i],'health',0,ends[i])} for k in ids}})
    return out
out={'generatedAt':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'phases':{}}
for phase in ['screen','confirm']:
    if not (P/f'{phase}-plan.json').exists():continue
    s=phase_summary(phase)
    if s is None:continue
    out['phases'][phase]=s
    print(phase,'complete',s['completeArms'],'/',s['expectedArms'],'n',s['n'],'first',len(s['firstEventCases']),'common',round(s['commonSeconds'],2))
    for k,a in s['arms'].items():
        def fmt(d):return '/'.join(f'{d[x]:.3f}' for x in KEYS[:3])
        print(k,'short .5',fmt(a['short']['0.5']['player']),'short 1',fmt(a['short']['1']['player']),'enemy1',fmt(a['short']['1']['enemy']),'opp',a['short']['1']['opportunities'],'full',fmt(a['full']['player']),'dead',a['full']['deaths'],'KO',a['full']['KO'],'break',a['full']['ownBreaks'])
(P/'summary.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
manifest=[]
for p in sorted((P/'raw').glob('*.gz')):
    b=p.read_bytes();raw=gzip.decompress(b);manifest.append({'path':str(p.relative_to(P)),'sha256':hashlib.sha256(b).hexdigest(),'rawSha256':hashlib.sha256(raw).hexdigest(),'runs':len(json.loads(raw))})
(P/'raw-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
