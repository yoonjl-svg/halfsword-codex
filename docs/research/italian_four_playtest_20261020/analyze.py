from pathlib import Path
import json,statistics,math
P=Path(__file__).parent;DT=1/120;fields=['limb','con','bleed'];out={}
def starts(r):return [x for x in r['triggers'] if x['type']=='start']
def damage(r,vic,t,w):return {k:sum(e[k] for e in r['events'] if e['vic']==vic and t-1e-7<=e['t']+DT<=t+w+1e-7) for k in fields}
for name in ['usefulNear','usefulRoll','strongBind','strongThrust']:
 pairs=[];full=[];disp=[];js=[];batches={}
 for folder in ['raw','raw2']:
  if not (P/folder/(name+'.json')).exists() or not (P/folder/(name+'Off.json')).exists():continue
  on=json.loads((P/folder/(name+'.json')).read_text())['results'];off=json.loads((P/folder/(name+'Off.json')).read_text())['results'];n=0
  for b,c in zip(off,on):
   assert all(b[k]==c[k] for k in ['weapon','seed','delay'])
   full.append((b,c));sb,sc=starts(b),starts(c)
   # Starts happen on same physics tick, all preceding damage must match.
   if not sb or not sc or abs(sb[0]['t']-sc[0]['t'])>1e-7:continue
   t=sc[0]['t'];prev=lambda r:[e for e in r['events'] if e['t']+DT<t-DT/2]
   assert prev(b)==prev(c)
   pairs.append((b,c,t));n+=1
   beat=[e for e in c['triggers'] if e['type']=='beat'];assert len({e['serial'] for e in beat})==len(beat)
   js.extend(e['J'] for e in beat)
   if b['tipSamples'] and c['tipSamples'] and beat:
    a,z=b['tipSamples'][0],c['tipSamples'][0];v=beat[0]['dir'];disp.append(sum(((z['tip'][i]-z['chest'][i])-(a['tip'][i]-a['chest'][i]))*v[i] for i in range(3)))
  batches[folder]=n
 row={'roundsPerArm':len(full),'matchedFirstStarts':len(pairs),'batchPairs':batches,'outward15cm':100*statistics.mean(disp) if disp else None,'outwardMedianCm':100*statistics.median(disp) if disp else None,'Jmedian':statistics.median(js) if js else None,'Jmax':max(js,default=0),'windows':{}}
 for w in [1,5]:
  z={'pairs':len(pairs),'off':{},'on':{},'improvement':{},'counts':{},'dropOneRange':{}}
  for side,idx in [('off',0),('on',1)]:
   z[side]={s:{k:sum(damage(pair[idx],vic,pair[2],w)[k] for pair in pairs)/max(1,len(pairs)) for k in fields} for s,vic in [('given',1),('received',0)]}
   z[side]['playerDeaths']=sum(not pair[idx]['p']['alive'] and pair[2]<=pair[idx]['t']<=pair[2]+w+DT for pair in pairs)
   z[side]['enemyDeaths']=sum(not pair[idx]['a']['alive'] and pair[2]<=pair[idx]['t']<=pair[2]+w+DT for pair in pairs)
  for k in fields:
   ds=[(damage(c,1,t,w)[k]-damage(c,0,t,w)[k])-(damage(b,1,t,w)[k]-damage(b,0,t,w)[k]) for b,c,t in pairs]
   z['improvement'][k]=statistics.mean(ds) if ds else None
   z['counts'][k]={'better':sum(x>1e-8 for x in ds),'same':sum(abs(x)<=1e-8 for x in ds),'worse':sum(x< -1e-8 for x in ds)}
   z['dropOneRange'][k]=[min((sum(ds)-x)/(len(ds)-1) for x in ds),max((sum(ds)-x)/(len(ds)-1) for x in ds)] if len(ds)>1 else None
  row['windows'][str(w)]=z
 row['roundReference']={side:{'starts':sum(len(starts(x[idx])) for x in full),'pBroken':sum(bool(x[idx]['p']['weaponBroken']) for x in full),'aBroken':sum(bool(x[idx]['a']['weaponBroken']) for x in full),'pDead':sum(not x[idx]['p']['alive'] for x in full),'aDead':sum(not x[idx]['a']['alive'] for x in full)} for side,idx in [('off',0),('on',1)]}
 out[name]=row
 print(name,'N',len(full),'pairs',len(pairs),'outwardCm',round(row['outward15cm'] or 0,2),'reference',row['roundReference'])
 for w,z in row['windows'].items():print(w,{k:round(v,4) for k,v in z['improvement'].items()},z['counts']['limb'],z['dropOneRange']['limb'],'death',z['off']['playerDeaths'],z['on']['playerDeaths'])
(P/'analysis.json').write_text(json.dumps(out,indent=2))
