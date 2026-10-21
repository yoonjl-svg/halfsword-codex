import json,pathlib
P=pathlib.Path(__file__).parent
x=json.loads((P/'analysis.json').read_text());out={}
for name,a in x['compared'].items():
 out[name]={}
 for w in ['1','5']:
  o=a[w];out[name][w]={'pairs':o['pairs'],'fields':{}}
  for k in ['limb','con','bleed']:
   b=o['baseline']['given'][k]-o['baseline']['received'][k];c=o['candidate']['given'][k]-o['candidate']['received'][k]
   rows=[(r['candidate']['given'][k]-r['candidate']['received'][k])-(r['baseline']['given'][k]-r['baseline']['received'][k]) for r in o['rows']]
   out[name][w]['fields'][k]={'baselineNet':b,'candidateNet':c,'improvement':c-b,'better':sum(v>1e-9 for v in rows),'same':sum(abs(v)<=1e-9 for v in rows),'worse':sum(v<-1e-9 for v in rows),'leaveOneOutRange':[min((sum(rows)-v for v in rows),default=0),max((sum(rows)-v for v in rows),default=0)]}
  out[name][w]['deaths']={side:{tag:o[tag]['death'+side] for tag in ['baseline','candidate']} for side in ['P','A']}
(P/'tradeoff.json').write_text(json.dumps({'definition':'Within each separate damage domain: given minus received. Never sum limb/con/bleed into an arbitrary score. Improvement may justify taking more damage.','comparisons':out},indent=2)+'\n')
