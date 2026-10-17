import json, pathlib, math, hashlib
root=pathlib.Path(__file__).resolve().parents[2]
p=pathlib.Path(__import__('os').environ.get('OUT','/workspace/japanese-recovery-20261017'))
def read(name): return json.loads((p/name).read_text())
def summary(rows):
 n=len(rows)
 return {'conditions':n,'exposure':sum(r['duration'] for r in rows),'dead':sum(not r['health']['end']['alive'] for r in rows),'enemyDead':sum(not r['enemy']['end']['alive'] for r in rows),'disarmed':sum(not r['health']['end']['armed'] for r in rows),'flows':sum(len(r['flows']) for r in rows),'flowConditions':sum(bool(r['flows']) for r in rows),'penalties':sum(len(r['events']) for r in rows),'mean':{side:{k:sum(r[side][k] for r in rows)/n for k in ['bloodLost','limbLost','concussion']} for side in ['health','enemy']}}
data={v:read(f'independent-{v}.json') for v in ['base','0','0.36']}
pairs=[]
for a,b,c in zip(data['base'],data['0'],data['0.36']):
 end=min(r['duration'] for r in [a,b,c]);rows=[]
 for r in [a,b,c]:
  rows.append({side:{k:sum(h['delta'][k] for h in r[side]['applied'] if h['t']<=end+1e-8) for k in ['bleed','limb','concussion','pain']} for side in ['health','enemy']})
 pairs.append({'seed':a['seed'],'weapon':a['atk'],'policy':a['policy'],'seconds':end,'damage':dict(zip(['base','0','0.36'],rows)),'survived':{k:r['health']['end']['alive'] for k,r in zip(['base','0','0.36'],[a,b,c])}})
screen={v:read(f'screen-window-{v}.json') for v in ['base','0','0.18','0.24','0.30','0.36','0.45']}
windows=[]
for i,b in enumerate(screen['0']):
 variants=[]
 for v,rs in screen.items():
  r=rs[i];assert r['prefix']==b['prefix']
  variants.append({'value':v,'prefixIdentical':True,'returnFront':r['flows'][0]['front'],'maxTipDifferenceVsRelease':max(math.dist(x['tip'],y['tip']) for x,y in zip(b['frames'],r['frames'])),'penalties':len(r['events'])})
 windows.append({'seed':b['seed'],'weapon':b['atk'],'policy':b['policy'],'variants':variants})
result={'recommendation':{'seconds':.36,'floor':.25,'earlySeconds':.12,'recoverSeconds':.24,'status':'provisional human-test recommendation, not a proven natural maximum'},'independent':{k:summary(v) for k,v in data.items()},'commonExposurePairs':pairs,'windows':windows,'attacker':{str(v):summary(read(f'attacker-{v}.json')) for v in [0,.36]},'practiceAttacker':{str(v):summary(read(f'attacker-practice-{v}.json')) for v in [0,.36]}}
result['commonExposureMean']={v:{side:{k:sum(row['damage'][v][side][k] for row in pairs)/len(pairs) for k in ['bleed','limb','concussion','pain']} for side in ['health','enemy']} for v in ['base','0','0.36']}
(p/'report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['independent','commonExposureMean','attacker','practiceAttacker']},ensure_ascii=False,indent=2))
