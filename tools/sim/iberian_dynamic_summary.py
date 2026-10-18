import json, statistics as st
from pathlib import Path
P=Path('docs/research/iberian_dynamic_20261018')
names=[p.stem[5:] for p in sorted((P/'raw').glob('live-*.json'))]
a={k:json.loads((P/'raw'/f'live-{k}.json').read_text()) for k in names}
end=[min(a[k][i]['duration'] for k in names) for i in range(12)]
out={'commonExposureSeconds':sum(end),'cases':12,'commonCuts':end,'modes':{}}
for k,rows in a.items():
 d={s:{'damage':{j:0 for j in ['limb','concussion','bleed']},'breaks':0,'probabilitySum':0,'impacts':0} for s in ['player','enemy']}; js=[]
 for i,r in enumerate(rows):
  for s,h in [('player','health'),('enemy','enemy')]:
   for hit in r[h]['applied']:
    if hit['t']<=end[i]:
     for j in d[s]['damage']:d[s]['damage'][j]+=hit['delta'][j]
   w=r['weapons'][s];d[s]['breaks']+=sum(e['t']<=end[i] for e in w['breaks'])
   for e in w['impacts']:
    if e['t']<=end[i]:d[s]['probabilitySum']+=e['p'];d[s]['impacts']+=1;js.append(e['J'])
 d['deathsFull']=sum(not r['health']['end']['alive'] for r in rows)
 d['motionStarts']=sum(len(r['motions']) for r in rows)
 d['breaksFull']=[sum(len(r['weapons'][s]['breaks']) for r in rows) for s in ['player','enemy']]
 d['impactMedian']=st.median(js) if js else 0
 out['modes'][k]=d
(P/'summary.json').write_text(json.dumps(out,indent=2))
print(json.dumps(out,indent=2))
