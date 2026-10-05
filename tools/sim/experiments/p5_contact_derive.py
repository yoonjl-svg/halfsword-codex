"""Read-only instantaneous alternatives from saved real legacy cut pair states.
No engine stepping, state changes, gain search or previously rejected path execution.
"""
import argparse,json,hashlib,math,pathlib
p=argparse.ArgumentParser();p.add_argument('--raw',required=True);p.add_argument('--out',required=True);a=p.parse_args();src=pathlib.Path(a.raw);out=pathlib.Path(a.out);assert not out.exists()
d=json.load(open(src));v=lambda x:[x[k] for k in ['x','y','z']];add=lambda a,b:[x+y for x,y in zip(a,b)];sub=lambda a,b:[x-y for x,y in zip(a,b)];scale=lambda a,s:[x*s for x in a];dot=lambda a,b:sum(x*y for x,y in zip(a,b));norm=lambda a:math.sqrt(dot(a,a))
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def inv33(column_major):
 A=[[column_major[c*3+r] for c in range(3)] for r in range(3)];a,b,c=A[0];e,f,g=A[1];i,j,k=A[2];det=a*(f*k-g*j)-b*(e*k-g*i)+c*(e*j-f*i);assert det>0
 return [[(f*k-g*j)/det,(c*j-b*k)/det,(b*g-c*f)/det],[(g*i-e*k)/det,(a*k-c*i)/det,(c*e-a*g)/det],[(e*j-f*i)/det,(b*i-a*j)/det,(a*f-b*e)/det]]
def mv(M,x):return [dot(r,x) for r in M]
def rotate(q,x):
 xyz=[q[k] for k in ['x','y','z']];t=scale(cross(xyz,x),2);return add(x,add(scale(t,q['w']),cross(xyz,t)))
def response(body,point,J):
 r=sub(point,v(body['com']));tau=cross(r,J);dw=mv(inv33(body['inertia']['world']),tau);dv=scale(J,1/body['mass']);dk=dot(v(body['velocity']),J)+dot(v(body['omega']),tau)+.5*(dot(J,dv)+dot(tau,dw));return {'dv':dv,'dw':dw,'deltaKJ':dk,'impulse':J,'angularImpulse':cross(point,J)}
def at(body,point):return add(v(body['velocity']),cross(v(body['omega']),sub(point,v(body['com']))))
def mobility(body,point,n):
 rn=cross(sub(point,v(body['com'])),n);return 1/body['mass']+dot(rn,mv(inv33(body['inertia']['world']),rn))
rows=[]
for row in d['rows']:
 if not row['observer']:continue
 for i,e in enumerate(row['events']):
  sw,vic=e['before']['bodies'];swAfter,vicAfter=e['after']['bodies'];n=v(e['dir']);J=e['J'];pA=v(e['pointA']);pV=v(e['pointV']);point=v(e['point']);M=sw['mass']+vic['mass'];origin=v(e['before']['total']['COM']);P0=v(e['before']['total']['P']);P1=v(e['after']['total']['P']);dp=v(e['analysis']['deltaP']);dl=v(e['analysis']['deltaL']);dk=e['analysis']['deltaKJ']
  axis=rotate(sw['rotation'],[0,1,0]);victimAxis=rotate(vic['rotation'],[1,0,0] if e['part'] in ['uarmS','farmS'] else [0,1,0]);oldw=response(sw,pA,scale(n,-J));oldv=response(vic,pV,scale(n,.8*J))
  s=dot(sub(at(sw,pA),at(vic,pA)),n);aa=mobility(sw,pA,n)+mobility(vic,pA,n);cap=max(0,s/aa);newJ=min(J,cap);candidates={}
  for mode,j in [('sameCenterlineRequestedJ',J),('sameCenterlineNonReversingJ',newJ)]:
   x=response(sw,pA,scale(n,-j));y=response(vic,pA,scale(n,j));deltaP=add(x['impulse'],y['impulse']);deltaL=add(x['angularImpulse'],y['angularImpulse']);change=sub(y['dw'],oldv['dw'])
   candidates[mode]={'appliedToEngine':False,'JNs':j,'retainedJ':j/J,'samePointRelativeSpeedMps':s,'mobilityPerKg':aa,'nonReversingCapNs':cap,'deltaP':deltaP,'deltaL':deltaL,'deltaKJ':x['deltaKJ']+y['deltaKJ'],'relativeSpeedAfterMps':s-aa*j,'weaponDeltaOmega':x['dw'],'victimDeltaOmega':y['dw'],'victimOmegaChangeFromLegacy':change,'victimOmegaChangeFromLegacyNormRadps':norm(change),'victimAxialDeltaOmegaRadps':dot(y['dw'],victimAxis),'victimOmegaAfter':add(v(vic['omega']),y['dw']),'weaponAxialDeltaOmegaRadps':dot(x['dw'],axis)}
  c=e['analysis']['counterfactualLinearCompletion'];newL=v(c['remainingDeltaL']);newP=v(c['remainingDeltaP'])
  rows.append({'weapons':row['weapons'],'event':i,'tick':e['tick'],'timeS':e['timeS'],'victimPart':e['part'],'regime':e['regime'],'JNs':J,'pointGapM':e['analysis']['pointSeparationM'],'original':{'deltaP':dp,'deltaPNormNs':norm(dp),'deltaLWorldOrigin':dl,'deltaLWorldOriginNormNms':norm(dl),'deltaLPairCOMOrigin':sub(dl,cross(origin,dp)),'deltaLPairCOMNormNms':norm(sub(dl,cross(origin,dp))),'deltaKWorldJ':dk,'deltaKInternalJ':dk-(dot(P1,P1)-dot(P0,P0))/(2*M),'requestedBudgetDebitJ':e['analysis']['requestedBudgetDebitJ'],'victimDeltaOmega':oldv['dw'],'victimAxialDeltaOmegaRadps':dot(oldv['dw'],victimAxis),'weaponAxialDeltaOmegaRadps':dot(oldw['dw'],axis),'maxPredictedVsMeasuredOmegaErrorRadps':max(norm(sub(oldw['dw'],sub(v(swAfter['omega']),v(sw['omega'])))),norm(sub(oldv['dw'],sub(v(vicAfter['omega']),v(vic['omega'])))))},'linearCompletionReadOnly':{'deltaLWorldOriginNormNms':norm(newL),'deltaLPairCOMOriginNormNms':norm(sub(newL,cross(origin,newP))),'deltaKWorldJ':c['pairDeltaKJ']},'candidates':candidates})
r={'schemaVersion':1,'scope':'Offline instantaneous algebra from the exact pre-legacy-pair snapshot. Alternatives are not applied and no dynamics or gameplay acceptance is inferred. The new centerline hypothesis preserves weapon pA and original request/budget/timer rather than using old actual-surface paired/budgeted policy.','source':{'path':str(src),'bytes':src.stat().st_size,'sha256':hashlib.sha256(src.read_bytes()).hexdigest()},'definitions':{'angularOrigin':'World-origin and initial pair-COM-origin deltaL are separated. Legacy nonzero deltaP makes deltaL origin-dependent; closed pair deltaL is origin-independent.','internalEnergy':'Delta of K-|P|^2/(2M), using fixed masses over the instantaneous pair; lab K with unbalanced P is frame-dependent.','axial':'Angular-velocity increment projected on pre-event sword local +Y and victim onBone axis. Not later joint/pose response.','cap':'Same pA signed relative speed and exact free rigid-body point mobility, no guessed inertia floor or added arm mass. A cap preserves only instantaneous direction/passivity.'},'events':rows,'count':len(rows)}
out.write_text(json.dumps(r,indent=2)+'\n')
for ws in sorted(set(tuple(r['weapons']) for r in rows)):
 rr=[r for r in rows if tuple(r['weapons'])==ws];print(ws,'events',len(rr))
 for r0 in [rr[0],max(rr,key=lambda r:r['candidates']['sameCenterlineNonReversingJ']['victimOmegaChangeFromLegacyNormRadps'])]:
  c=r0['candidates']['sameCenterlineNonReversingJ'];print('event',r0['event'],'t',r0['timeS'],'part',r0['victimPart'],'P',r0['original']['deltaPNormNs'],'Lworld',r0['original']['deltaLWorldOriginNormNms'],'Lcom',r0['original']['deltaLPairCOMNormNms'],'newJratio',c['retainedJ'],'dk',c['deltaKJ'],'victimDWdiff',c['victimOmegaChangeFromLegacyNormRadps'],'victimAxial',r0['original']['victimAxialDeltaOmegaRadps'],c['victimAxialDeltaOmegaRadps'],'COMcompletion',r0['linearCompletionReadOnly'])
 print('capEvents',sum(r['candidates']['sameCenterlineNonReversingJ']['retainedJ']<1-1e-12 for r in rr),'uncappedKPositive',sum(r['candidates']['sameCenterlineRequestedJ']['deltaKJ']>0 for r in rr))
