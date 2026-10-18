"""Descriptive paired comparison; separate death, bleeding, concussion, limbs."""
import collections,gzip,hashlib,json,pathlib,statistics,sys
P=pathlib.Path(sys.argv[1])
IDS=['1','0.25','0']
def read(phase,k):return json.loads(gzip.decompress((P/'raw'/f'{phase}-{k}.json.gz').read_bytes()))
def damage(rows,side,ends):
 hs=[h for i,r in enumerate(rows) for h in r[side]['applied'] if h['t']<ends[i]]
 return {d:sum(h['delta'][d] for h in hs) for d in ['limb','concussion','bleed','balance','pain']}
def counter(rows,ends):
 out=collections.Counter()
 for i,r in enumerate(rows):
  cs=[c for c in r['commands'] if c['action'] in ['tap','swipe','counterSwipe'] and c['t']<ends[i]]
  for j,c in enumerate(cs):
   end=min(ends[i],c['t']+1,cs[j+1]['t'] if j+1<len(cs) else ends[i])
   hits=lambda side:[h for h in r[side]['applied'] if c['t']<=h['t']<end and any(v>1e-10 for v in h['delta'].values())]
   ph,eh=hits('health'),hits('enemy');out['inputs']+=1;out['withEnemyDamage']+=bool(eh);out['withPlayerDamage']+=bool(ph)
   out['playerLimb']+=sum(h['delta']['limb'] for h in ph);out['enemyLimb']+=sum(h['delta']['limb'] for h in eh)
 return dict(out)
def summarize(a,indices):
 ends=[min(a[k][i]['duration'] for k in IDS) for i in indices];out={'n':len(indices),'commonSeconds':sum(ends),'arms':{},'cases':[]}
 for k in IDS:
  rows=[a[k][i] for i in indices]
  out['arms'][k]={'player':damage(rows,'health',ends),'enemy':damage(rows,'enemy',ends),'counter':counter(rows,ends),
   'playerDeaths':sum(not r['health']['end']['alive'] for r in rows),'enemyDeaths':sum(not r['enemy']['end']['alive'] for r in rows),
   'deathCauses':dict(collections.Counter(r['health']['death']['cause'] for r in rows if r['health']['death'])),
   'effects':sum(len(r['controlEvents']) for r in rows),'effectCases':sum(bool(r['controlEvents']) for r in rows),
   'triggers':sum(len(r['observation']['triggers']) for r in rows),
   'fullDownTime':sum(r['health']['downTime'] for r in rows),'fullBloodLost':sum(r['health']['bloodLost'] for r in rows),
   'breaks':{side:sum(len(r.get('weapons',{}).get(side,{}).get('breaks',[])) for r in rows) for side in ['player','enemy']} if rows and 'weapons' in rows[0] else None}
 for j,i in enumerate(indices):
  row={'i':i,'seed':a['1'][i].get('seed'),'atk':a['1'][i]['atk'],'policy':a['1'][i].get('policy'),'end':ends[j],
   'prefixEqual':len({a[k][i]['observation']['prefixHash'] for k in IDS})==1,
   'firsts':{k:a[k][i]['observation']['first'] for k in IDS},'arms':{}}
  for k in IDS:
   r=a[k][i];row['arms'][k]={'damage':damage([r],'health',[ends[j]]),'death':r['health']['death'],'effects':len(r['controlEvents'])}
  out['cases'].append(row)
 out['prefixEqualAll']=all(r['prefixEqual'] for r in out['cases'])
 return out
def geometry(a):
 rows=[]
 for i in range(len(a['1'])):
  if any(a[k][i]['observation']['first'] is None for k in IDS):continue
  firsts=[a[k][i]['observation']['first'] for k in IDS]
  if max(firsts)-min(firsts)>1e-7:raise AssertionError(('first trigger differs',i,firsts))
  t=firsts[0]
  row={'i':i,'first':t,'samples':{},'frontReturn':{},'minHeadClearance':{},'firstSecondDamage':{}}
  for k in IDS:
   r=a[k][i];fs=r['observation']['frames'];start=None;front=None
   for f in fs:
    if f['front']:
     if start is None:start=f['t']
     if f['t']-start>=.1:front=start-t;break
    else:start=None
   row['frontReturn'][k]=front
   row['minHeadClearance'][k]=min((f['headClearance'] for f in fs),default=None)
   end=min(t+1,min(a[j][i]['duration'] for j in IDS))
   row['firstSecondDamage'][k]={d:sum(h['delta'][d] for h in r['health']['applied'] if t<=h['t']<end) for d in ['limb','concussion','bleed']}
  for dt in [.12,.24,.36,.5,1.0]:
   fs={k:min(a[k][i]['observation']['frames'],key=lambda f:abs(f['t']-t-dt)) for k in IDS}
   if any(abs(f['t']-t-dt)>.02 for f in fs.values()):continue
   row['samples'][str(dt)]={k:{'scale':f['scale'],'chest':f['chestClearance'],'head':f['headClearance'],
    'tipDifferenceFrom25':sum((v-fs['0.25']['tip'][n])**2 for n,v in enumerate(f['tip']))**.5} for k,f in fs.items()}
  rows.append(row)
 return rows
out={'definitions':{'floor':'remaining control; 0 is stronger than .25','duration':.36,'floorDuration':.12,'recoverDuration':.24,'humanTrial':False},'groups':{}}
for phase in ['live','probe','attacker']:
 if not (P/'raw'/f'{phase}-0.json.gz').exists():continue
 a={k:read(phase,k) for k in IDS};assert len({len(v) for v in a.values()})==1
 group=summarize(a,list(range(len(a['1']))));group['geometry']=geometry(a)
 if phase=='live' and a['1'][0].get('weapon')=='zweihander':
  group['prior12']=summarize(a,list(range(12)));group['fresh12']=summarize(a,list(range(12,24)))
 out['groups'][phase]=group
 print(phase,'n',group['n'],'commonSeconds',round(group['commonSeconds'],3),'prefix',group['prefixEqualAll'])
 for k,x in group['arms'].items():print(k,{**{d:round(v,4) for d,v in x['player'].items() if d in ['limb','concussion','bleed']},'dead':x['playerDeaths'],'KO':x['deathCauses'].get('기절',0),'events':x['effects'],'counter':x['counter'],'breaks':x['breaks']})
(P/'summary.json').write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n')
manifest=[]
for path in sorted((P/'raw').glob('*.json.gz')):
 b=path.read_bytes();raw=gzip.decompress(b);manifest.append({'file':str(path.relative_to(P)),'sha256':hashlib.sha256(b).hexdigest(),'rawSha256':hashlib.sha256(raw).hexdigest(),'runs':len(json.loads(raw))})
(P/'raw-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
