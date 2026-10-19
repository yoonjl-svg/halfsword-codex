import json,pathlib,math,subprocess,hashlib
P=pathlib.Path(__file__).parent
rs={p.stem:json.loads(p.read_text())['results'] for p in (P/'raw').glob('*.json') if p.stem.endswith(('-pilot','-hold','-follow'))}
checks={'comparisonRuns':sum(map(len,rs.values())),'finiteSamples':0,'uniqueAttacks':True,'boundedHandGoals':True,'replayParity':[]}
for name,rows in rs.items():
 for r in rows:
  starts={e['serial']:e for e in r['triggers'] if e['type']=='start'}
  ids=[e['foeAttackId'] for e in starts.values()];assert len(ids)==len(set(ids)),name
  for s in r['samples']:
   assert all(math.isfinite(x) for x in s['hand']+s['dir']),name
   assert abs(sum(x*x for x in s['dir'])-1)<1e-5,name
   d=math.sqrt(sum((x-y)**2 for x,y in zip(s['hand'],starts[s['serial']]['hand'])))
   # Original logging occurs before its update, so the first sample is ordinary guard hand, not this module's goal.
   if not name.startswith(('current-','currentforte-')):assert d<=.28+.04+.12+1e-6,(name,d)
   checks['finiteSamples']+=1
for variant,batch,weapon,seed,delay,file in [('current','pilot','longsword',10301,.12,'capture'),('bind26','pilot','longsword',10301,.12,'capture'),('current','hold','zweihander',10303,.12,'failure'),('bind26','hold','zweihander',10303,.12,'failure')]:
 a=next(r for r in rs[variant+'-'+batch] if (r['weapon'],r['seed'],r['delay'])==(weapon,seed,delay));b=json.loads((P/'raw'/f'{variant}-{file}.json').read_text())['results'][0]
 for key in ['events','triggers','p','a','t']:assert a[key]==b[key],(variant,key)
 checks['replayParity'].append({'variant':variant,'weapon':weapon,'seed':seed,'matched':True})
checks['checkCorrection']='Initial hand-bound check included original pre-update guard samples (0.688m). Bounds apply only to candidate-owned post-update goals; raw original samples retained.'
checks['source']= (P/'base.txt').read_text().strip()
checks['browser']=json.loads((P/'raw/browser.json').read_text());checks['browserFailure']=json.loads((P/'raw/browser-failure.json').read_text())
assert not checks['browser']['errors'] and not checks['browserFailure']['errors']
(P/'verification.json').write_text(json.dumps(checks,indent=2));print(json.dumps(checks))
