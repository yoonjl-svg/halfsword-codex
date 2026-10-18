"""First activation only: verify identical physical prefix before comparison."""
import json, gzip, math, statistics
from pathlib import Path
P=Path('docs/research/iberian_contact_20261018')
def read(label,arm):
 p=P/'raw'/f'{label}-{arm}.json'
 return json.loads(p.read_bytes() if p.exists() else gzip.decompress(p.with_suffix('.json.gz').read_bytes()))
out={'pairs':[],'common':{}}
for label in ['validation','fresh']:
 for i,(x,y) in enumerate(zip(read(label,'base'),read(label,'outward24'))):
  if not y['motions']: continue
  t=y['motions'][0]['t'];before=[s for s in y['samples'] if s['t']<t-1/120]
  if not before: continue
  v=before[-1];u=min(x['samples'],key=lambda z:abs(z['t']-v['t']))
  err=max(abs(u[k][j]-v[k][j]) for k in ['tip','root','dChest'] for j in range(3))
  assert err<1e-8,(label,i,err)
  pair={'label':label,'case':i,'seed':y['seed'],'atk':y['atk'],'t':t,'preContactError':err,'measurements':{},'firstSecondDamage':{}}
  for dt in [.1,.2,.3,.5]:
   v=min(y['samples'],key=lambda s:abs(s['t']-t-dt));u=min(x['samples'],key=lambda s:abs(s['t']-t-dt))
   if max(abs(v['t']-t-dt),abs(u['t']-t-dt))>.03:continue
   pair['measurements'][str(dt)]={'tipSeparationCm':math.dist(u['tip'],v['tip'])*100,'chestClearanceChangeCm':(v['chest']-u['chest'])*100,'envelopeChangeCm':(v['envelope']-u['envelope'])*100}
  for name,r in [('base',x),('candidate',y)]:
   hs=[h for h in r['health']['applied'] if t<h['t']<=t+1]
   pair['firstSecondDamage'][name]={k:sum(h['delta'][k] for h in hs) for k in ['limb','concussion','bleed']}
  out['pairs'].append(pair)
for dt in ['0.1','0.2','0.3','0.5']:
 vals=[x['measurements'][dt] for x in out['pairs'] if dt in x['measurements']]
 out['common'][dt]={'n':len(vals),**{k:statistics.median(x[k] for x in vals) for k in vals[0]}}
(P/'first-contact-analysis.json').write_text(json.dumps(out,indent=2));print(out['common'])
