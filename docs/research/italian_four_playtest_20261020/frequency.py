from pathlib import Path
import json,statistics,random
P=Path(__file__).parent;names=['usefulNear','usefulRoll','strongBind','strongThrust'];out={}
for name in names:
 rs=json.loads((P/'raw-window1'/f'{name}.json').read_text())['results'];assert len(rs)==48 and all(r['pressWindow']==1 for r in rs)
 ns=[sum(e['type']=='start' for e in r['triggers']) for r in rs];sec=sum(r['t'] for r in rs)
 assert all(sum(e['type']=='beat' for e in r['triggers'])==n for r,n in zip(rs,ns))
 old=[r for fld in ['raw','raw2'] for r in json.loads((P/fld/f'{name}.json').read_text())['results']]
 oldmap={(r['weapon'],r['seed'],r['delay']):r for r in old};assert len(oldmap)==48
 out[name]={'n':48,'starts':sum(ns),'perRound':statistics.mean(ns),'activatedRounds':sum(n>0 for n in ns),'activatedRate':sum(n>0 for n in ns)/48,'maxInRound':max(ns),'seconds':sec,'per30seconds':sum(ns)/sec*30,'startsAt032':sum(sum(e['type']=='start' for e in r['triggers']) for r in old),'playerDeaths':sum(not r['p']['alive'] for r in rs),'enemyDeaths':sum(not r['a']['alive'] for r in rs),'byWeapon':{w:sum(sum(e['type']=='start' for e in r['triggers']) for r in rs if r['weapon']==w) for w in sorted({r['weapon'] for r in rs})},'rows':[{'weapon':r['weapon'],'seed':r['seed'],'delay':r['delay'],'count':n,'seconds':r['t']} for r,n in zip(rs,ns)]}
rank=sorted(names,key=lambda n:out[n]['starts'],reverse=True);top=rank[0]
for other in rank[1:]:
 m={(r['weapon'],r['seed'],r['delay']):r['count'] for r in out[other]['rows']};delta=[r['count']-m[(r['weapon'],r['seed'],r['delay'])] for r in out[top]['rows']]
 rng=random.Random(317);boots=sorted(sum(rng.choices(delta,k=48))/48 for _ in range(4000));out[top].setdefault('pairedDifferenceVs',{})[other]={'mean':statistics.mean(delta),'better':sum(d>0 for d in delta),'tied':sum(d==0 for d in delta),'worse':sum(d<0 for d in delta),'bootstrap95':[boots[100],boots[3899]]}
(P/'frequency.json').write_text(json.dumps({'window':1,'totalRounds':192,'ranking':rank,'results':out},indent=2))
for n in rank:print(n,json.dumps({k:v for k,v in out[n].items() if k!='rows'}))
