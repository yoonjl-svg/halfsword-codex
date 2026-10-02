/** Browser-safe cutting reaction math and opt-in budgeted resistance.
 * Equal/opposite impulses share a world point and consume instant pair kinetic loss.
 * Native collision, joints/muscles, wound energy and later native work remain separate.
 */
const copy = v => ({x:v.x,y:v.y,z:v.z});
const dot = (a,b) => a.x*b.x+a.y*b.y+a.z*b.z;
const sub = (a,b) => ({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const cross = (a,b) => ({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const scale = (v,s) => ({x:v.x*s,y:v.y*s,z:v.z*s});
const finiteVector = v => v && ['x','y','z'].every(k=>Number.isFinite(v[k]));

/** Actual Rapier point mobility, including world inertia and axis constraints.
 * Constraints can exchange momentum with supports; conservation tests use free bodies.
 * Rapier uses Float32; no guessed inertia floor or additional hand mass is used.
 */
export function pointDirectionalMobility(body,point,n) {
  const m=body.effectiveInvMass(), I=body.effectiveWorldInvInertia();
  const t=cross(sub(point,body.worldCom()),n);
  const angular=t.x*(I.m11*t.x+I.m12*t.y+I.m13*t.z)
    +t.y*(I.m21*t.x+I.m22*t.y+I.m23*t.z)
    +t.z*(I.m31*t.x+I.m32*t.y+I.m33*t.z);
  return n.x*n.x*m.x+n.y*n.y*m.y+n.z*n.z*m.z+angular;
}

/** n is the direction of weapon motion relative to victim, not a contact normal.
 * Equal/opposite impulses act at precisely one shared WORLD point. For a>0,s>0,
 * J<=s/a prevents reversal along n and gives dK=-J*s+.5*a*J^2<=0.
 * The bound concerns the instant free-body response; subsequent native joints differ.
 */
export function applyPairedCutImpulse(sw,victim,point,direction,requestedJ) {
  if(sw===victim) throw new TypeError('Cutting requires two distinct bodies');
  if(!finiteVector(point)||!finiteVector(direction)||!Number.isFinite(requestedJ)||requestedJ<0)
    throw new TypeError('Finite point, direction and nonnegative requested impulse required');
  const length=Math.hypot(direction.x,direction.y,direction.z);
  if(!(length>0)) throw new TypeError('Nonzero direction required');
  const n=scale(direction,1/length), p=copy(point);
  const relative=sub(sw.velocityAtPoint(p),victim.velocityAtPoint(p));
  const s=dot(relative,n);
  const weaponMobility=pointDirectionalMobility(sw,p,n);
  const victimMobility=pointDirectionalMobility(victim,p,n);
  const a=weaponMobility+victimMobility;
  if(!Number.isFinite(a)||a<0||!Number.isFinite(s)) throw new Error('Invalid native point mobility/speed');
  const cap=s>0&&a>0?s/a:0;
  const J=Math.min(requestedJ,cap);
  const deltaKPredicted=-J*s+.5*a*J*J;
  if(J>0){
    sw.applyImpulseAtPoint(scale(n,-J),p,true);
    victim.applyImpulseAtPoint(scale(n,J),p,true);
  }
  return {requestedJ,J,cap,s,a,weaponMobility,victimMobility,deltaKPredicted,
    sAfterPredicted:s-a*J,sAfterMeasured:dot(sub(sw.velocityAtPoint(p),victim.velocityAtPoint(p)),n),
    point:p,direction:n,impulseWeapon:scale(n,-J),impulseVictim:scale(n,J)};
}

/** Preserve the researched budgeted request, phase and timer policy exactly.
 * `s` and `dir` are the already-computed contact relative speed/direction.
 * `strike` supplies the game's unchanged STRIKE parameters; no hidden mass/strength.
 * Returns null for no requested impulse, otherwise optional-observer diagnostics.
 */
export function applyBudgetedCutResistance({sw,vb,point,dir,s,dt,cut:c,strike,step,key}) {
  const cutDragActive = c.Eleft > 0 && !c.cutBudgetDone;
  const cutEnergyBefore = c.Eleft;
  const cutStuckBefore = c.stuckT;
  let J = 0;
  if (cutDragActive) {
    const Estep = Math.min(c.Eleft, strike.dragC * s * s * dt);
    J = Math.min(Estep / s, strike.dragCap * c.mFree * s);
  } else if (c.stuckT > 0) {
    J = Math.min(Math.min(strike.stuckDamp * s, strike.stuckForce) * dt, 0.8 * (c.mFree + strike.armAssist) * s);
    c.stuckT -= dt;
    c.seen = step;
  }
  if (!(J > 0)) return null;
  const cutReaction = applyPairedCutImpulse(sw, vb, point, dir, J);
  const budgetDebitJ = cutDragActive ? Math.max(0, -cutReaction.deltaKPredicted) : 0;
  if (cutDragActive) {
    c.Eleft = Math.max(0, cutEnergyBefore - budgetDebitJ);
    if (c.Eleft <= 1e-3) {
      // Keep the residual energy while advancing the phase once, without timer rearm.
      c.cutBudgetDone = true;
      if (c.stuck) c.stuckT = strike.stuckTime;
    }
  }
  return { ...cutReaction, key, step, mode: 'budgeted',
    regime: cutDragActive ? 'drag' : 'stuck', requestedApproxJs: J * s,
    budgetBeforeJ: cutEnergyBefore, budgetAfterJ: c.Eleft, budgetDebitJ,
    stuckTimerBefore: cutStuckBefore, stuckTimerAfter: c.stuckT,
    budgetDone: !!c.cutBudgetDone };
}
