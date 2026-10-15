"""Summarize half-scale runs without changing gates or selecting a winning seed subset."""
import json, math, statistics, pathlib, sys, hashlib, gzip
root=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
def read(p):return json.loads(p.read_text())
def wilson(k,n):
 z=1.95996398454;a=k/n;b=1+z*z/n;c=(a+z*z/(2*n))/b;d=z*math.sqrt(a*(1-a)/n+z*z/(4*n*n))/b
 return [c-d,c+d]
def ci(a):
 m=statistics.mean(a);d=1.96*statistics.stdev(a)/math.sqrt(len(a)) if len(a)>1 else 0
 return [max(0,m-d),m+d]
def summary(g):
 n=len(g);T=sum(r['t'] for r in g);wins=sum(r['res']=='W' for r in g)
 heavy=[sum(w['E']>45 and w['zone'] in ['head','neck','face'] for w in r['wX']) for r in g]
 falls=[r['falls'] for r in g];clinch=[r['clinchT']/r['t']*100 for r in g]
 return dict(n=n,wins=wins,losses=sum(r['res']=='L' for r in g),draws=sum(r['res']=='D' for r in g),winRate=wins/n,win95=wilson(wins,n),meanSeconds=T/n,heavyHead=sum(heavy),heavyPerBout95=ci(heavy),falls=sum(falls),fallsPerBout95=ci(falls),clinchPercent=sum(r['clinchT'] for r in g)/T*100,meanBoutClinchPercent=statistics.mean(clinch),boutClinch95=ci(clinch),cutsPerMinute=sum(r['cuts'] for r in g)/T*60,attackDecisionsPerMinute=sum(r['decides'] for r in g)/T*60,opponentStepIn=sum(r['yWhy'].get('stepin',0) for r in g),opponentStrikes=sum(r['yStrikes'] for r in g),opponentBound=sum(r['yBound'] for r in g),withdrawSecondsPerBout=sum(r['modeT'].get('withdraw',0) for r in g)/n,nonfinite=sum(r['nan'] for r in g))
sets={};raw=[]
for weapon in ['qinggang','goujian']:
 for arm in ['off','on','ai']:
  g=[g for seed in [0,48] for a in read(root/f'baseline/cn-{weapon}-{seed}.json') if a['arm']==arm for g in a['games']]
  sets[weapon+'-'+arm]=summary(g);raw.append(dict(label=weapon+'-'+arm,games=g))
 for candidate in ['','2','3','4']:
  paths=[root/f'cn-candidate{candidate}-{weapon}{suffix}.json' for suffix in ['', '-48']]
  paths=[p for p in paths if p.exists()];g=[g for p in paths for a in read(p) for g in a['games']]
  if g:
   label=weapon+'-candidate'+(candidate or '1');sets[label]=summary(g);raw.append(dict(label=label,parameters=read(paths[0])[0].get('feet'),games=g))
 for ab in ['noshuffle','noflee','nohold']:
  p=root/f'ablations/{weapon}-{ab}.json';g=[g for a in read(p) for g in a['games']]
  sets[weapon+'-'+ab]=summary(g);raw.append(dict(label=weapon+'-'+ab,seedNote='1..48 per side; exploratory, not the paired 1..24+49..72 final sample',games=g))
for candidate in ['1','4']:
 for weapon in ['qinggang','goujian']:
  c=sets[weapon+'-candidate'+candidate];a=sets[weapon+'-ai'];o=sets[weapon+'-off']
  c['checks']={'perWeaponWinsAtLeastOff':c['wins']>=o['wins'],'heavyNotAboveBaseline95':c['heavyHead']/c['n']<=a['heavyPerBout95'][1], 'fallsWithinBaseline95':a['fallsPerBout95'][0]<=c['falls']/c['n']<=a['fallsPerBout95'][1], 'clinchWithinBaseline95':a['boutClinch95'][0]<=c['meanBoutClinchPercent']<=a['boutClinch95'][1]}
 cn=sum(sets[w+'-candidate'+candidate]['wins'] for w in ['qinggang','goujian']);old=sum(sets[w+'-ai']['wins'] for w in ['qinggang','goujian']);sets['candidate'+candidate+'-combined']={'wins':cn,'baselineWins':old,'pass':cn>=old}
(out/'cn-summary.json').write_text(json.dumps(sets,indent=2)+'\n')
with gzip.GzipFile(str(out/'cn-raw.json.gz'),'wb',mtime=0) as f:f.write(json.dumps(raw,separators=(',',':')).encode())
md=['| 무기/갈래 | 승/패/무 | 승률 (95%) | 베기/분 | 머리>45J | 넘어짐 | 클린치% |','|---|---|---|---:|---:|---:|---:|']
for name,s in sets.items():
 if 'n' not in s:continue
 lo,hi=s['win95'];md.append(f"| {name} ({s['n']}판) | {s['wins']}/{s['losses']}/{s['draws']} | {100*s['winRate']:.1f}% ({100*lo:.1f}–{100*hi:.1f}) | {s['cutsPerMinute']:.1f} | {s['heavyHead']} | {s['falls']} | {s['clinchPercent']:.2f} |")
(out/'cn-table.md').write_text('\n'.join(md)+'\n')
# No imputed contact energies or ratio for a trial with no collision.
b=read(root/'tempo-final-baseline/rows.json');c=read(root/'tempo-final-candidate/rows.json')
assert len(b)==len(c)
fresh=[(x,y) for x,y in zip(b,c) if x['level']==0]
result={'freshRows':len(fresh),'freshByteIdentical':all(x==y for x,y in fresh),'before':read(root/'tempo-final-baseline/summary.json'),'candidate':read(root/'tempo-final-candidate/summary.json'),'tiredMeasured':sum(x['level']>0 and x['status']=='measured' for x in b),'tiredPassBefore':sum(x['level']>0 and x.get('pass',False) for x in b),'tiredPassCandidate':sum(x['level']>0 and x.get('pass',False) for x in c),'noContactBefore':sum(x['status']=='measured' and x['impactEnergy'] is None for x in b),'noContactCandidate':sum(x['status']=='measured' and x['impactEnergy'] is None for x in c)}
(out/'tempo-summary.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
