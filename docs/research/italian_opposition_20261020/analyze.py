import json,pathlib
P=pathlib.Path(__file__).parent
def read(name):return json.loads((P/'raw'/f'{name}.json').read_text())['results']
def dmg(rows,vic,start=0,end=1e9):
 return {k:sum(e[k] for r in rows for e in r['events'] if e['vic']==vic and start<=e['t']<=end) for k in ['limb','con','bleed']}
def summary(name):
 rs=read(name)
 return dict(n=len(rs),fired=sum(sum(e['type']=='start' for e in r['triggers']) for r in rs),triggered=sum(any(e['type']=='start' for e in r['triggers']) for r in rs),pDead=sum(not r['p']['alive'] for r in rs),aDead=sum(not r['a']['alive'] for r in rs),pDisarmed=sum(not r['p']['armed'] for r in rs),aDisarmed=sum(not r['a']['armed'] for r in rs),pBroken=sum(r['p'].get('weaponBroken',False) for r in rs) if all('weaponBroken' in r['p'] for r in rs) else None,aBroken=sum(r['a'].get('weaponBroken',False) for r in rs) if all('weaponBroken' in r['a'] for r in rs) else None,received=dmg(rs,0),given=dmg(rs,1))
def paired(bname,cname):
 bs,cs=read(bname),read(cname);assert len(bs)==len(cs)
 sums={kind:{'n':0,'base':{v:{k:0 for k in ['limb','con','bleed']} for v in ['received','given']},'candidate':{v:{k:0 for k in ['limb','con','bleed']} for v in ['received','given']}} for kind in ['common30','first1','first5']}
 for b,c in zip(bs,cs):
  assert all(b[k]==c[k] for k in ['weapon','seed','delay'])
  first=next((e['t'] for e in c['triggers'] if e['type']=='start'),None)
  for kind in sums:
   if kind!='common30' and first is None:continue
   start=0 if kind=='common30' else first
   end=min(b['t'],c['t'],30 if kind=='common30' else first+int(kind[-1]))
   if end<start:continue
   o=sums[kind];o['n']+=1
   for tag,r in [('base',b),('candidate',c)]:
    for v,vic in [('received',0),('given',1)]:
     for k,value in dmg([r],vic,start,end).items():o[tag][v][k]+=value
 return sums
out={'summary':{p.stem:summary(p.stem) for p in (P/'raw').glob('*.json') if 'results' in json.loads(p.read_text())}}
for name in ['defensive-slow','v3-defensive-slow','v3-defensive-32','v3-defensive-middle32','v3-defensive-normal32']:
 if (P/'raw'/f'{name}.json').exists():out[name]=paired('defensive-base',name)
for name in ['held-fight-slow','held-fight-middle']:
 if (P/'raw'/f'{name}.json').exists():out[name]=paired('held-fight-base',name)
for name in ['combined-slow','final-short']:
 if (P/'raw'/f'{name}.json').exists():
  rr=json.loads((P/'raw'/f'{name}.json').read_text());rr['results'].sort(key=lambda x:(x['weapon'],x['seed'],x['delay']));(P/'raw'/f'{name}.json').write_text(json.dumps(rr));out[name]=paired('combined-base',name)
(P/'analysis.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))
