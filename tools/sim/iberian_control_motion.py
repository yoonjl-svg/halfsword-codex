"""Read-only paired trajectory analysis of the saved receiver-native runs."""
import gzip, json, math, statistics
from pathlib import Path
source = Path('docs/research/iberian_control_duration_20261018/raw')
out = Path('docs/research/iberian_control_playtest_20261019'); out.mkdir(exist_ok=True)
short = json.loads(gzip.decompress((source/'confirm-f0.1-h0.12.json.gz').read_bytes()))
long = json.loads(gzip.decompress((source/'confirm-f0.1-h0.6.json.gz').read_bytes()))
result = {'source':'54af75f4 receiver-native confirmation, existing runs; not new battles',
 'interpretation':'Paired trajectory divergence, NOT outward clearance, input lag, counter safety or measured human feel.', 'samples':[]}
for time in [.10,.24,.36,.50,.60,.84,1.0]:
 rows=[]
 for i,(a,b) in enumerate(zip(short,long)):
  if a['observation']['first'] is None: continue
  assert a['observation']['prefixHash']==b['observation']['prefixHash']
  assert abs(a['observation']['first']-b['observation']['first'])<1e-8
  def frame(r):
   o=r['observation']; return min(o['frames'],key=lambda f:abs(f['t']-o['first']-time))
  u,v=frame(a),frame(b)
  numerator=sum((u['tip'][j]-u['root'][j])*(v['tip'][j]-v['root'][j]) for j in range(3))
  denom=math.dist(u['tip'],u['root'])*math.dist(v['tip'],v['root'])
  angle=math.degrees(math.acos(max(-1,min(1,numerator/denom))))
  rows.append({'case':i,'seed':a['seed'],'policy':a['policy'],'shortActualTime':u['t']-a['observation']['first'],'longActualTime':v['t']-b['observation']['first'],
   'tipDifferenceMeters':math.dist(u['tip'],v['tip']),'bladeDirectionDifferenceDegrees':angle,
   'shortScale':u['scale'],'longScale':v['scale'],'shortState':u['attackerState'],'longState':v['attackerState']})
 result['samples'].append({'time':time,'pairs':len(rows),'tipDifferenceMedianMeters':statistics.median(r['tipDifferenceMeters'] for r in rows),
  'bladeDirectionDifferenceMedianDegrees':statistics.median(r['bladeDirectionDifferenceDegrees'] for r in rows),'rows':rows})
(out/'paired-motion.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('PASS: 5 identical-prefix paired trajectories, 7 post-contact samples; original raw files unchanged')
