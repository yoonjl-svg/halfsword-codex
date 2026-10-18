"""Re-analyse existing raw fights: first-contact 5s and merged all-contact 5s windows."""
import gzip,json,pathlib,sys,collections,datetime
P=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path('docs/research/iberian_control_duration_20261018')
DS=['limb','concussion','bleed','balance','pain']
def read(phase,k):return json.loads(gzip.decompress((P/'raw'/f'{phase}-{k}.json.gz').read_bytes()))
def damage(r,side,intervals):
    return {d:sum(h['delta'][d] for h in r[side]['applied'] if any(a<=h['t']<b for a,b in intervals)) for d in DS}
def add(rows):return {d:sum(r[d] for r in rows) for d in DS}
def merge(intervals):
    out=[]
    for a,b in sorted(intervals):
        if b<=a:continue
        if out and a<=out[-1][1]:out[-1][1]=max(out[-1][1],b)
        else:out.append([a,b])
    return out
def death_in(r,t,end):return bool(r['health']['death'] and t<=r['health']['death']['t']<=end+1e-8)
out={'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Existing raw data only. Pairwise common exposure; first activation matched. Deaths within nominal 5 seconds retained separately, never excluded. All activation windows merged per arm; descriptive, not matched causal effects.','phases':{}}
for phase in ['screen','confirm']:
    plan=json.loads((P/f'{phase}-plan.json').read_text());base=read(phase,'alone');phaseout={}
    for cfg in plan['configs']:
        if cfg['id']=='alone':continue
        rows=read(phase,cfg['id']);details=[];all_player=[[],[]];cohort_player=[[],[]];all_windows=[[],[]];seconds=[0,0];counts=[0,0];total_seconds=0
        for i,(a,b) in enumerate(zip(base,rows)):
            end=min(a['duration'],b['duration']);total_seconds+=end
            assert a['observation']['prefixHash']==b['observation']['prefixHash']
            for j,r in enumerate((a,b)):
                all_player[j].append(damage(r,'health',[(0,end)]))
                times=[e['t'] for e in r['observation']['triggers'] if e['t']<end]
                windows=merge([(t,min(t+5,end)) for t in times]);seconds[j]+=sum(y-x for x,y in windows);counts[j]+=len(times);all_windows[j].append(damage(r,'health',windows))
            t=a['observation']['first']
            if t is None:continue
            assert abs(t-b['observation']['first'])<1e-8
            stop=min(t+5,end);detail={'i':i,**plan['cases'][i],'first':t,'commonSeconds':stop-t,'complete5s':stop>=t+5-1e-8,'arms':{}}
            for j,(name,r) in enumerate((('alone',a),('candidate',b))):
                cohort_player[j].append(damage(r,'health',[(0,end)]))
                detail['arms'][name]={'first1':damage(r,'health',[(t,min(t+1,end))]),'first5':damage(r,'health',[(t,stop)]),'after1to5':damage(r,'health',[(t+1,stop)]),'enemy5':damage(r,'enemy',[(t,stop)]),'deathWithin5s':death_in(r,t,t+5),'death':r['health']['death'],'post5ToEnd':damage(r,'health',[(t+5,end)])}
            details.append(detail)
        value={'cases':len(rows),'firstCases':len(details),'complete5Cases':sum(d['complete5s'] for d in details),'common5Seconds':sum(d['commonSeconds'] for d in details),'commonFightSeconds':total_seconds,'arms':{},'pairedCases':details}
        for j,name in enumerate(['alone','candidate']):
            value['arms'][name]={'first1':add([d['arms'][name]['first1'] for d in details]),'first5':add([d['arms'][name]['first5'] for d in details]),'after1to5':add([d['arms'][name]['after1to5'] for d in details]),'enemy5':add([d['arms'][name]['enemy5'] for d in details]),'deathWithin5s':sum(d['arms'][name]['deathWithin5s'] for d in details),'deathFull':sum(not r['health']['end']['alive'] for r in (base if j==0 else rows)),'sameCohortFull':add(cohort_player[j]),'allCasesFull':add(all_player[j]),'allActivation5sMerged':{'damage':add(all_windows[j]),'seconds':seconds[j],'activations':counts[j]}}
        value['first5Changes']={d:{'better':sum(c['arms']['candidate']['first5'][d]<c['arms']['alone']['first5'][d]-1e-8 for c in details),'worse':sum(c['arms']['candidate']['first5'][d]>c['arms']['alone']['first5'][d]+1e-8 for c in details),'same':sum(abs(c['arms']['candidate']['first5'][d]-c['arms']['alone']['first5'][d])<=1e-8 for c in details)} for d in DS}
        phaseout[cfg['id']]=value
        fmt=lambda d:'/'.join(f'{d[k]:.4f}' for k in DS[:3])
        print(phase,cfg['id'],'n',len(details),'complete',value['complete5Cases'],'seconds',round(value['common5Seconds'],3),'5s',fmt(value['arms']['alone']['first5']),'->',fmt(value['arms']['candidate']['first5']),'deaths5',value['arms']['alone']['deathWithin5s'],value['arms']['candidate']['deathWithin5s'],'30s',fmt(value['arms']['alone']['allCasesFull']),'->',fmt(value['arms']['candidate']['allCasesFull']))
    out['phases'][phase]=phaseout
(P/'windows5.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
