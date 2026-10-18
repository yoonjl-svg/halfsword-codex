import json,pathlib,sys,statistics,gzip
from iberian_compare_summary import health,counters
P=pathlib.Path('docs/research/iberian_contact_20261018'); label=sys.argv[1] if len(sys.argv)>1 else 'live';ids=sys.argv[2:] or ['base','hold','leverUp']
def read_raw(path):
 return json.loads(path.read_text() if path.exists() else gzip.decompress(path.with_suffix(path.suffix+'.gz').read_bytes()))
a={k:read_raw(P/'raw'/f'{label}-{k}.json') for k in ids};n=len(a[ids[0]])
assert all(len(v)==n for v in a.values())
ends=[min(a[k][i]['duration'] for k in ids) for i in range(n)]
out={'label':label,'n':n,'commonSeconds':sum(ends),'ends':ends,'arms':{},'pairedFirst':{}}
for k,rows in a.items():
 d={'player':health(rows,'health',ends),'enemy':health(rows,'enemy',ends),'counter':counters(rows,ends),'deathsFull':sum(not r['health']['end']['alive'] for r in rows),'enemyDeathsFull':sum(not r['enemy']['end']['alive'] for r in rows),'breaksFull':{s:sum(len(r['weapons'][s]['breaks']) for r in rows) for s in ['player','enemy']},'breaksCommon':{s:sum(sum(e['t']<ends[i] for e in r['weapons'][s]['breaks']) for i,r in enumerate(rows)) for s in ['player','enemy']},'motions':sum(len(r['motions']) for r in rows)}
 out['arms'][k]=d
 if k=='base':continue
 points={str(t):[] for t in [.1,.2,.3,.5]}
 for i,r in enumerate(rows):
  if not r['motions']:continue
  t=r['motions'][0]['t'];base=a['base'][i]
  for dt,ls in points.items():
   q=t+float(dt)
   b=min(base['samples'],key=lambda s:abs(s['t']-q));v=min(r['samples'],key=lambda s:abs(s['t']-q))
   if max(abs(b['t']-q),abs(v['t']-q))>.03:continue
   ls.append({'case':i,'chestCm':(v['chest']-b['chest'])*100,'envelopeCm':(v['envelope']-b['envelope'])*100})
 out['pairedFirst'][k]={dt:{'n':len(ls),'chestMedianCm':statistics.median(v['chestCm'] for v in ls) if ls else None,'values':ls} for dt,ls in points.items()}
(P/f'{label}-summary.json').write_text(json.dumps(out,indent=2))
for k,v in out['arms'].items():
 print(k, 'damage', {d:round(v['player'][d],3) for d in ['limb','concussion','bleed']},'dead',v['deathsFull'],'break',v['breaksFull'],'counter',v['counter'])
print('exposure',out['commonSeconds']); print('deflection', {k:{dt:v['chestMedianCm'] for dt,v in p.items()} for k,p in out['pairedFirst'].items()})
