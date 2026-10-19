import json,pathlib,math,statistics
P=pathlib.Path(__file__).parent
DT=1/120
fields=['limb','con','bleed']
def load(n):return json.loads((P/'raw'/f'{n}.json').read_text())['results']
def starts(r):return [e for e in r['triggers'] if e['type']=='start']
def ends(r):return [e for e in r['triggers'] if e['type']=='end']
def damage(r,vic,lo=0,hi=1e9):return {k:sum(e[k] for e in r['events'] if e['vic']==vic and lo-1e-7<=e['t']+DT<=hi+1e-7) for k in fields}
def hitstats(r,vic,lo,hi):
 ev=[e for e in r['events'] if e['vic']==vic and lo+1e-7<e['t']+DT<=hi+1e-7 and (e['limb']>0 or e['con']>0 or e['bleed']>0)]
 return {'count':len(ev),'first':min((e['t']+DT-lo for e in ev),default=None),'severity':sum(e['severity'] for e in ev),'parts':{k:sum(e['part']==k for e in ev) for k in sorted(set(e['part'] for e in ev))}}
def plus(dst,d):
 for k in fields:dst[k]+=d[k]
def blank():return dict.fromkeys(fields,0.)
def summary(n):
 rs=load(n);ss=[s for r in rs for s in starts(r)];ee=[s for r in rs for s in ends(r)]
 return dict(n=len(rs),activated=len(ss),perRound=len(ss)/len(rs),rounds=sum(bool(starts(r)) for r in rs),targets={k:sum(s['target']==k for s in ss) for k in ['chest','forearm']},ownForte=sum(-.08<=s['ownAt']<=.5 for s in ss),foeWeak=sum(.5<=s['otherAt']<=1.08 for s in ss),contactSeconds=sum(x['contactT'] for x in ee)/max(1,len(ee)),contactFraction=sum(x['contactT'] for x in ee)/max(1e-9,sum(x['activeT'] for x in ee)),withdrawals=sum(x['type']=='withdraw' for r in rs for x in r['triggers']),givenStabs=sum(any(e['vic']==1 and e['type']=='stab' and s['t']<=e['t']+DT<=next((q['t'] for q in r['triggers'] if q['type']=='end' and q['serial']==s['serial']),s['t']+1) for e in r['events']) for r in rs for s in starts(r)),pDead=sum(not r['p']['alive'] for r in rs),aDead=sum(not r['a']['alive'] for r in rs),pBroken=sum(bool(r['p']['weaponBroken']) for r in rs),aBroken=sum(bool(r['a']['weaponBroken']) for r in rs))
def compare(bn,cn):
 bs,cs=load(bn),load(cn);assert len(bs)==len(cs)
 out={str(w):{'pairs':0,'samePrefix':0,'baseline':{'received':blank(),'given':blank(),'deathP':0,'deathA':0},'candidate':{'received':blank(),'given':blank(),'deathP':0,'deathA':0},'rows':[]} for w in [1,5,30]}
 for b,c in zip(bs,cs):
  assert all(b[k]==c[k] for k in ['weapon','seed','delay'])
  sb,sc=starts(b),starts(c)
  same=bool(sb and sc and abs(sb[0]['t']-sc[0]['t'])<1e-7)
  if same:
   t=sc[0]['t'];be=[e for e in b['events'] if e['t']+DT<t-DT/2];ce=[e for e in c['events'] if e['t']+DT<t-DT/2];same=be==ce
  for w in [1,5,30]:
   if w!=30 and not same:continue
   t0=0 if w==30 else sc[0]['t'];end=min(b['t'],c['t']) if w==30 else t0+w
   o=out[str(w)];o['pairs']+=1;o['samePrefix']+=int(same)
   row={'weapon':c['weapon'],'seed':c['seed'],'delay':c['delay'],'anchor':t0}
   for tag,r in [('baseline',b),('candidate',c)]:
    row[tag]={}
    for name,vic in [('received',0),('given',1)]:
     d=damage(r,vic,t0,end);plus(o[tag][name],d);row[tag][name]=d;row[tag][name+'Hits']=hitstats(r,vic,t0,end)
    for fld,f in [('deathP','p'),('deathA','a')]:o[tag][fld]+=int(not r[f]['alive'] and t0<=r['t']<=end+DT)
   o['rows'].append(row)
 for o in out.values():
  o['hits']={tag:{side:{'count':sum(row[tag][side+'Hits']['count'] for row in o['rows']),'pairs':sum(row[tag][side+'Hits']['count']>0 for row in o['rows']),'firstMedian':statistics.median([row[tag][side+'Hits']['first'] for row in o['rows'] if row[tag][side+'Hits']['first'] is not None]) if any(row[tag][side+'Hits']['first'] is not None for row in o['rows']) else None} for side in ['received','given']} for tag in ['baseline','candidate']}
  o['leaveOneOutDelta']={side:{k:[round(sum(row['candidate'][side][k]-row['baseline'][side][k] for row in o['rows'] if row is not omit),6) for omit in o['rows']] for k in fields} for side in ['received','given']}
  o['deltaPercent']={side:{k:100*(o['candidate'][side][k]/o['baseline'][side][k]-1) if o['baseline'][side][k]>1e-9 else None for k in fields} for side in ['received','given']}
 return out

names=[p.stem for p in (P/'raw').glob('*.json') if p.stem.endswith(('-fresh','-extra','-confirm'))]
out={'summary':{},'compared':{}}
for name in names:
 r=load(name)[0];baseline='current-'+r['after']+'-'+('confirm' if name.endswith('-confirm') else 'fresh')
 if not (P/'raw'/f'{baseline}.json').exists():continue
 out['summary'][name]=summary(name)
 if name==baseline:continue
 a=compare(baseline,name)
 for w in ['1','5','30']:
  o=a[w];o['net']={}
  for k in fields:
   b=o['baseline']['given'][k]-o['baseline']['received'][k];c=o['candidate']['given'][k]-o['candidate']['received'][k]
   rows=[(r['candidate']['given'][k]-r['candidate']['received'][k])-(r['baseline']['given'][k]-r['baseline']['received'][k]) for r in o['rows']]
   o['net'][k]={'baseline':b,'candidate':c,'improvement':c-b,'better':sum(v>1e-9 for v in rows),'same':sum(abs(v)<=1e-9 for v in rows),'worse':sum(v<-1e-9 for v in rows),'dropOneRange':[min((sum(rows)-v for v in rows),default=0),max((sum(rows)-v for v in rows),default=0)]}
 out['compared'][name]=a
out['components']={}
for candidate in ['gentleNear','gentleRoll20','gentleRoll40','gentleReturn','gentleTier','gentleBeat','gentleBeatSmall']:
 n=candidate+'-counter-extra'
 if n in out['summary']:out['components'][n]=compare('gentle26-counter-fresh',n)
for candidate in ['gentleNear','gentleRoll40','gentleCombo']:
 n=candidate+'-counter-confirm'
 if n in out['summary']:out['components'][n]=compare('gentle26-counter-confirm',n)
(P/'analysis.json').write_text(json.dumps(out,indent=2))
for name,a in out['compared'].items():
 print(name, 'activation',out['summary'][name]['activated'],'stab',out['summary'][name]['givenStabs'])
 for w in ['1','5']:
  o=a[w];print(w,'pairs',o['pairs'],'net',{k:round(v['improvement'],4) for k,v in o['net'].items()},'deaths',o['baseline']['deathP'],o['candidate']['deathP'],o['baseline']['deathA'],o['candidate']['deathA'])
