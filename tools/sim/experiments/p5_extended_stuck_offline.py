"""Counterfactual instant centerline cap on naturally observed legacy stuck states.
Never advances physics or claims the candidate naturally reached these states.
"""
import argparse,json,pathlib,math,hashlib
p=argparse.ArgumentParser();p.add_argument('--raw',required=True);p.add_argument('--out',required=True);a=p.parse_args();src=pathlib.Path(a.raw);out=pathlib.Path(a.out);assert not out.exists();d=json.loads(src.read_bytes())
v=lambda x:[x[k] for k in ['x','y','z']];dot=lambda a,b:sum(x*y for x,y in zip(a,b));sub=lambda a,b:[x-y for x,y in zip(a,b)];add=lambda a,b:[x+y for x,y in zip(a,b)]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def inv33(cm):
 a,e,i,b,f,j,c,g,k=cm;det=a*(f*k-g*j)-b*(e*k-g*i)+c*(e*j-f*i);assert det>0
 return [[(f*k-g*j)/det,(c*j-b*k)/det,(b*g-c*f)/det],[(g*i-e*k)/det,(a*k-c*i)/det,(c*e-a*g)/det],[(e*j-f*i)/det,(b*i-a*j)/det,(a*f-b*e)/det]]
def speed(b,p):return add(v(b['velocity']),cross(v(b['omega']),sub(p,v(b['com']))))
def mobility(b,p,n):
 t=cross(sub(p,v(b['com'])),n);M=inv33(b['inertia']['world']);return 1/b['mass']+dot(t,[dot(r,t) for r in M])
rows=[]
for row in d['rows']:
 if row['mode']!='legacy':continue
 for e in row['events']:
  if e['attacker']!=0 or e['regime']!='stuck':continue
  a,b=e['before']['bodies'];p=v(e['pointA']);n=v(e['dir']);s=dot(sub(speed(a,p),speed(b,p)),n);A=mobility(a,p,n)+mobility(b,p,n);cap=max(0,s/A);J=min(cap,e['J']);rows.append({'weapons':row['weapons'],'tick':e['tick'],'timeS':e['timeS'],'part':e['part'],'episodeId':e['episodeId'],'requestedJNs':e['J'],'pACapNs':cap,'counterfactualJNs':J,'retained':J/e['J'],'samePointClosingMps':s,'mobility':A,'counterfactualDeltaKJ':-J*s+.5*A*J*J,'observedLegacyDeltaKJ':e['analysis']['deltaKJ']})
r={'schemaVersion':1,'source':{'path':str(src),'sha256':hashlib.sha256(src.read_bytes()).hexdigest()},'appliedToEngine':False,'scope':'Instant arithmetic on natural legacy stuck states. Not candidate live stuck or future trajectory evidence. Same original pA, legacy direction and requested impulse; analytic free-body mobility from saved native inertia.','count':len(rows),'wouldCap':sum(x['retained']<1-1e-12 for x in rows),'rows':rows};out.write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps({'count':r['count'],'wouldCap':r['wouldCap'],'firstCap':next((x for x in rows if x['retained']<1-1e-12),None),'minRetained':min(rows,key=lambda x:x['retained']) if rows else None},indent=2))
