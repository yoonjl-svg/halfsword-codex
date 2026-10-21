import json,pathlib,math,hashlib
P=pathlib.Path(__file__).parent
rs={p.stem:json.loads(p.read_text())['results'] for p in (P/'raw').glob('*.json') if p.stem.endswith(('-fresh','-extra','-confirm'))}
check={'runs':sum(map(len,rs.values())),'finiteGoals':0,'rollSamples':0,'uniqueAttackIds':True,'oneBeatPerActivation':True}
for name,rows in rs.items():
 for r in rows:
  starts={e['serial']:e for e in r['triggers'] if e['type']=='start'};ids=[e['foeAttackId'] for e in starts.values()];assert len(ids)==len(set(ids)),name
  beats=[e for e in r['triggers'] if e['type']=='beat'];assert len({e['serial'] for e in beats})==len(beats)
  assert all(e['serial'] in starts and math.isfinite(e['J']) and e['J']>=0 for e in beats)
  for s in r['samples']:
   assert all(math.isfinite(v) for v in s['hand']+s['dir']),name
   assert abs(sum(v*v for v in s['dir'])-1)<1e-5,name
   check['finiteGoals']+=1
  for s in r['rollChecks']:
   assert all(math.isfinite(v) for v in s['world']) and math.isfinite(s['lag']),name
   check['rollSamples']+=1
for v in ['current','gentleNear']:
 b=next(r for r in rs[v+'-counter-confirm'] if r['weapon']=='zweihander' and r['seed']==10307 and r['delay']==.22)
 a=json.loads((P/'raw'/f'{v}-capture.json').read_text())['results'][0]
 for k in ['events','triggers','p','a','t']:assert a[k]==b[k],(v,k)
check['captureParity']=2;check['browser']=json.loads((P/'raw/browser.json').read_text());assert not check['browser']['errors']
for name in ['near','roll','beat']:
 text=(P/'raw'/f'checks-{name}.log').read_text();assert 'pass 22' in text and 'fail 0' in text,name
check['lifecycleTests']=66
(P/'verification.json').write_text(json.dumps(check,indent=2)+'\n');print(check)
