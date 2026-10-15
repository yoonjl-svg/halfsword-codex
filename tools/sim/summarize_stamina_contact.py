"""Compare frozen first-contact trials; misses remain in coverage denominators."""
import json, sys, statistics
from pathlib import Path

old, new, dest = map(Path, sys.argv[1:4])
a, b = [json.loads(p.read_text()) for p in (old, new)]
key = lambda r: (r['weapon'], r['action'], r['driver'], r['level'])
A = {key(r): r for r in a}
target = [1, 1/.8, 1/.6]
B = {key(r): r for r in b}
def err(r, table):
    base = table.get((*key(r)[:3], 0))
    if not r.get('firstContact') or not base or not base.get('firstContact'): return None
    return abs(r['firstContact']['time']/base['firstContact']['time']/target[r['level']]-1)
def summarize(rows):
    rows = [r for r in rows if r['level'] and r.get('status') == 'measured']
    pairs = [(A[key(r)], r) for r in rows if err(r,B) is not None and err(A[key(r)],A) is not None]
    mean = lambda xs: round(statistics.mean(xs)*100,3) if xs else None
    return dict(conditions=len(rows), oldHits=sum(bool(A[key(r)].get('firstContact')) for r in rows),
        newHits=sum(bool(r.get('firstContact')) for r in rows), paired=len(pairs),
        pairedOldErrorPct=mean([err(x,A) for x,y in pairs]), pairedNewErrorPct=mean([err(y,B) for x,y in pairs]),
        newAllHitsErrorPct=mean([err(r,B) for r in rows if err(r,B) is not None]),
        lostHits=[list(key(r)) for r in rows if A[key(r)].get('firstContact') and not r.get('firstContact')],
        gainedHits=[list(key(r)) for r in rows if not A[key(r)].get('firstContact') and r.get('firstContact')])
fresh = [r for r in b if r['level']==0 and r.get('status')=='measured']
result = dict(target=target, totalRows=len(b), validBaselines=len(fresh),
    missingBaselines=sum(r['level']==0 and r.get('status')=='no-valid-baseline' for r in b),
    notApplicable=sum(r['level']==0 and r.get('status')=='not-applicable' for r in b),
    nonfinite=sum(r.get('finite') is False for r in b),
    freshPhysicsEqual=all(all(r.get(k)==A[key(r)].get(k) for k in ['contacts','activePeak','endAt','state']) for r in fresh),
    overall=summarize(b), byAction={x:summarize([r for r in b if r['action']==x]) for x in ['cut','thrust','pommel','secret']},
    byTradition={x:summarize([r for r in b if r.get('tradition')==x]) for x in sorted({r['tradition'] for r in b if 'tradition' in r})},
    byWeapon={x:summarize([r for r in b if r['weapon']==x]) for x in dict.fromkeys(r['weapon'] for r in b)})
dest.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['byWeapon','byTradition']},ensure_ascii=False,indent=2))
