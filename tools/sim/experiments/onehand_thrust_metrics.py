import json,math,argparse,hashlib
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--raw',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();assert not a.out.exists()
x=json.loads(a.raw.read_text())
def mul(q,r):
 x,y,z,w=q;X,Y,Z,W=r
 return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z]
def inv(q):return [-q[0],-q[1],-q[2],q[3]]
def rel(f):
 b=f['postPhysics']['blade'];w=f['postPhysics']['sword']['w'];fw=f['postPhysics']['bodies']['farmS']['w']
 return sum((w[i]-fw[i])*b[i] for i in range(3))
rows=[]
for r in x['rows']:
 if not r['observed']:continue
 fs=r['frames'];at=next((f['timeS'] for f in fs if f['input']['tapAccepted']),None);metrics={}
 sets={'all_frames':fs,'stop_reverse_hold':[f for f in fs if f['phase'] in ['stop','reverse','reverseHold']],'follow_cut_hold':[f for f in fs if f['phase'] in ['followCut','followHold']]}
 if at is not None:sets.update({'tap_first075':[f for f in fs if at<=f['timeS']<at+.75],'tap_push':[f for f in fs if at+.1<=f['timeS']<at+.3],'tap_recovery':[f for f in fs if at+.3<=f['timeS']<at+.5]})
 for name,frames in sets.items():
  if not frames:continue
  path=net=0.;first=fs.index(frames[0]);pf=fs[first-1] if first>0 else None;prev=mul(inv(pf['postPhysics']['bodies']['farmS']['q']),pf['postPhysics']['sword']['q']) if pf else None
  for f in frames:
   q=mul(inv(f['postPhysics']['bodies']['farmS']['q']),f['postPhysics']['sword']['q'])
   if prev is not None:
    d=mul(inv(prev),q);d=[-v for v in d] if d[3]<0 else d;angle=2*math.atan2(d[1],d[3]);path+=abs(angle);net+=angle
   prev=q
  peak=max(frames,key=lambda f:abs(rel(f)))
  metrics[name]={'frames':len(frames),'relativeQuatBladeAxisPathRad':path,'relativeQuatBladeAxisSignedRad':net,'relativeOmegaProjectedAbsArcRad':sum(abs(rel(f))*x['dt'] for f in frames),'maxAbsRelativeAxialOmegaRadS':abs(rel(peak)),'peakTimeS':peak['timeS'],'peakThrustWeight':peak['response']['before']['thrustWeight'],'meanAimErrorRad':sum(f['postCombat']['aimErrorRad'] for f in frames)/len(frames),'maxHandTargetErrorM':max(f['postCombat']['handErrorM'] for f in frames),'swordContactFrames':sum(bool(f['swordContacts']) for f in frames)}
 rows.append({'weapon':r['weapon'],'mode':r['mode'],'summary':r['summary'],'metrics':metrics})
out={'raw':str(a.raw),'rawSHA256':hashlib.sha256(a.raw.read_bytes()).hexdigest(),'dt':x['dt'],'sourceCommitLabel':x['sourceCommit'],'sourceHashes':x['sourceBefore'],'rows':rows,'scope':'Kinematic relative sword-to-forearm finite-step swing-twist decomposition about previous sword local bladeY; includes the immediately preceding frame at each window boundary. Projected postPhysics angular velocity quadrature is an independent approximation. Neither is anatomical wrist twist, full motor impulse or work. Hand target can exceed reachable arm length.'}
a.out.write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'rows':len(rows),'out':str(a.out)}))
