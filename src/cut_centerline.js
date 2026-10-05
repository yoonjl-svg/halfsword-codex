/** Optional centerline contact pair. The caller retains the legacy request,
 * energy-budget debit and stuck timer; this helper changes only the two impulses.
 * Unlike the rejected surface-point policy, the weapon's original pA is retained.
 */
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const mul=(v,k)=>({x:v.x*k,y:v.y*k,z:v.z*k});
const finite=v=>v&&['x','y','z'].every(k=>Number.isFinite(v[k]));

export function centerlineCutEnabled(combat,attacker) {
  return combat.cutReactionModel==='centerline' && attacker?.index===0
    && combat.cutReactionFighter===attacker;
}

function mobility(body,p,n) {
  const m=body.effectiveInvMass(),I=body.effectiveWorldInvInertia();
  const t=cross(sub(p,body.worldCom()),n);
  return n.x*n.x*m.x+n.y*n.y*m.y+n.z*n.z*m.z
    +t.x*(I.m11*t.x+I.m12*t.y+I.m13*t.z)
    +t.y*(I.m21*t.x+I.m22*t.y+I.m23*t.z)
    +t.z*(I.m31*t.x+I.m32*t.y+I.m33*t.z);
}

export function applyCenterlineCutImpulse(sw,victim,pointA,direction,requestedJ) {
  if(sw===victim||!finite(pointA)||!finite(direction)||!Number.isFinite(requestedJ)||requestedJ<0)
    throw new TypeError('Distinct bodies, finite point/direction and nonnegative impulse required');
  const length=Math.hypot(direction.x,direction.y,direction.z);
  if(Math.abs(length-1)>1e-6)throw new TypeError('Legacy unit direction required');
  // Preserve the exact caller vector, so an uncapped weapon impulse is unchanged.
  const n={...direction},p={...pointA};
  const s=dot(sub(sw.velocityAtPoint(p),victim.velocityAtPoint(p)),n);
  const weaponMobility=mobility(sw,p,n),victimMobility=mobility(victim,p,n);
  const a=weaponMobility+victimMobility;
  if(!Number.isFinite(s)||!Number.isFinite(a)||a<0)throw new Error('Invalid native mobility/speed');
  const cap=s>0&&a>0?s/a:0,J=Math.min(requestedJ,cap);
  if(J>0){sw.applyImpulseAtPoint(mul(n,-J),p,true);victim.applyImpulseAtPoint(mul(n,J),p,true);}
  return {requestedJ,J,cap,s,a,weaponMobility,victimMobility,point:p,direction:n,
    deltaKPredicted:-J*s+.5*a*J*J,sAfterPredicted:s-a*J,
    sAfterMeasured:dot(sub(sw.velocityAtPoint(p),victim.velocityAtPoint(p)),n)};
}
