import json,pathlib,collections
p=pathlib.Path(__file__).resolve().parent.parent;raw=p/'raw'
load=lambda n:json.loads((raw/(n+'.json')).read_text())['results']
inj=lambda r:r['why'] in ('cut','pushed','wind')
summary={}
for group in ['candidate','validation']:
 b=load(group+'-base'); rows={}
 for v in (['base','read','shape','combined'] if group=='candidate' else ['base','shape']):
  a=load(group+'-'+v);rows[v]={'n':len(a),'injured':sum(map(inj,a)),'firstSwordArm':sum(x.get('bp') in ['uarmS','farmS'] for x in a),'saved':sum(inj(x) and not inj(y) for x,y in zip(b,a)),'new':sum(not inj(x) and inj(y) for x,y in zip(b,a)),'limbEnd':sum(sum(1-z for z in x['end']['limbs'].values()) for x in a),'conEnd':sum(1-x['end']['consciousness'] for x in a),'bloodEnd':sum(1-x['end']['blood'] for x in a),'byPress':{str(pr):sum(inj(x) for x in a if x.get('press')==pr) for pr in sorted(set(x['press'] for x in a if 'press' in x))}}
 summary[group]=rows
for role in ['defender','attacker']:
 b,a=load('fight-'+role+'-base'),load('fight-'+role+'-shape'); out={}; triggers=[i for i,x in enumerate(a) if x['firstCover'] is not None]
 for window in ['1s','5s','30s']:
  ids=range(len(a)) if window=='30s' else triggers
  rows={}
  for v,rr in [('base',b),('shape',a)]:
   s=collections.Counter()
   for i in ids:
    r=rr[i];start=0 if window=='30s' else a[i]['firstCover'];end=min(b[i]['t'],a[i]['t'],30 if window=='30s' else start+float(window[:-1]));
    if end<start:continue
    s['pairs']+=1;s['seconds']+=end-start
    for e in r['events']:
     if start<=e['t']<=end:
      prefix='received' if e['vic']==0 else 'dealt'
      for k in ['limb','con','bleed']:s[prefix+'_'+k]+=e[k]
   rows[v]=dict(s)
  out[window]=rows
 out['outcomes']={v:{'pDead':sum(not x['p']['alive'] for x in rr),'aDead':sum(not x['a']['alive'] for x in rr),'pCauses':dict(collections.Counter(x['p']['cause'] for x in rr if not x['p']['alive'])),'taps':sum(x['taps'] for x in rr),'hits':sum(x['hits'] for x in rr),'triggered':sum(x['firstCover'] is not None for x in rr),'coverSeconds':sum(x['coverTime'] for x in rr)} for v,rr in [('base',b),('shape',a)]}
 out['changedOutcomes']=[{'weapon':y['weapon'],'seed':y['seed'],'delay':y['delay'],'pBefore':x['p']['cause'],'pAfter':y['p']['cause'],'aBefore':x['a']['cause'],'aAfter':y['a']['cause'],'trigger':y['firstCover']} for x,y in zip(b,a) if (x['p']['alive'],x['a']['alive'])!=(y['p']['alive'],y['a']['alive'])]
 summary[role]=out
(p/'analysis.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));print(json.dumps(summary,ensure_ascii=False,indent=2))
