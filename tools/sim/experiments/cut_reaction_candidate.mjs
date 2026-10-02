/** Research only: common-point passive cutting impulse. Never imported by game src.
 * Keeps the existing requested-J/Eleft/damage/stuck rules in the source clone.
 * Eleft still subtracts requested J*s, not actual exact pair energy dissipation.
 * Native collision, joints, muscles and wound energy are outside this candidate.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

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

// Exact source anchors intentionally fail on upstream edits; no silent legacy fallback.
const LEGACY_BLOCK=`      if (J > 0) {
        // 칼에는 칼날 중심선 위에 건다 (날 끝에 걸면 칼이 길이 방향으로 팽이처럼 돈다)
        const ax = _a.set(0, 1, 0).applyQuaternion(rotQ(sw));
        const o = tv(sw.translation());
        const pA = o.clone().addScaledVector(ax, _b.copy(point).sub(o).dot(ax));
        sw.applyImpulseAtPoint({ x: -dir.x * J, y: -dir.y * J, z: -dir.z * J }, vp(pA), true);
        const pv = onBone(c.pr.v, point);
        vb.applyImpulseAtPoint({ x: dir.x * J * 0.8, y: dir.y * J * 0.8, z: dir.z * J * 0.8 }, vp(pv), true);
      }`;
const CANDIDATE_BLOCK=`      if (J > 0) {
        const cutReaction = applyPairedCutImpulse(sw, vb, point, dir, J);
        this.onCutReaction?.({ ...cutReaction, key, step: this.stepNo,
          regime: c.Eleft > 0 ? 'drag' : c.stuckT > 0 ? 'stuck_or_drag_exhausted' : 'drag_exhausted' });
      }`;

export function transformCutReactionSource(source) {
  const count=source.split(LEGACY_BLOCK).length-1;
  if(count!==1) throw new Error(`Expected exactly one unchanged cutting impulse block; found ${count}`);
  return `import { applyPairedCutImpulse } from ${JSON.stringify(import.meta.url)};\n`
    +source.replace(LEGACY_BLOCK,CANDIDATE_BLOCK);
}

/** Separate budgeted hypothesis: consume only instantaneous paired kinetic loss.
 * The native engine can supply/remove energy on later steps; that is not Eleft debit.
 * The legacy request rule already guarantees J*s<=Eleft; the passive pair loss is
 * J*s-.5*a*J²<=J*s, so no new gameplay energy cap or guessed mass is necessary.
 */
export function transformBudgetedCutReactionSource(source) {
  const requestAnchor='      let J = 0;\n      if (c.Eleft > 0) {';
  const debitAnchor='        c.Eleft -= J * s;\n        if (c.Eleft <= 1e-3 && c.stuck) c.stuckT = STRIKE.stuckTime;';
  for(const [name,anchor] of [['request',requestAnchor],['legacy debit',debitAnchor],['impulses',LEGACY_BLOCK]]){
    const count=source.split(anchor).length-1;
    if(count!==1)throw new Error(`Budgeted ${name}: expected exactly one unchanged anchor; found ${count}`);
  }
  const budgetedBlock=`      if (J > 0) {
        const cutReaction = applyPairedCutImpulse(sw, vb, point, dir, J);
        const budgetDebitJ = cutDragActive ? Math.max(0, -cutReaction.deltaKPredicted) : 0;
        if (cutDragActive) {
          c.Eleft = Math.max(0, cutEnergyBefore - budgetDebitJ);
          if (c.Eleft <= 1e-3) {
            // Retain the small residual in the budget, but advance the resistance phase.
            c.cutBudgetDone = true;
            if (c.stuck) c.stuckT = STRIKE.stuckTime;
          }
        }
        this.onCutReaction?.({ ...cutReaction, key, step: this.stepNo, mode: 'budgeted',
          regime: cutDragActive ? 'drag' : 'stuck', requestedApproxJs: J * s,
          budgetBeforeJ: cutEnergyBefore, budgetAfterJ: c.Eleft, budgetDebitJ,
          stuckTimerBefore: cutStuckBefore, stuckTimerAfter: c.stuckT,
          budgetDone: !!c.cutBudgetDone });
      }`;
  const body=source.replace(requestAnchor,
    '      const cutDragActive = c.Eleft > 0 && !c.cutBudgetDone;\n      const cutEnergyBefore = c.Eleft;\n      const cutStuckBefore = c.stuckT;\n      let J = 0;\n      if (cutDragActive) {')
    .replace(debitAnchor,'        // Budgeted mode debits actual passive paired kinetic loss after application.')
    .replace(LEGACY_BLOCK,budgetedBlock);
  return `import { applyPairedCutImpulse } from ${JSON.stringify(import.meta.url)};\n`+body;
}

/** Read and clone the complete real combat module; no source writes or prototype edits.
 * mode='legacy' loads the same untouched source through the same module mechanism.
 * The original Combat export stays available for a direct afterStep comparison.
 */
export async function loadCutReactionCombat({mode='candidate',sourceURL=new URL('../../../src/combat.js',import.meta.url)}={}) {
  if(!['candidate','legacy','budgeted'].includes(mode)) throw new TypeError('Unknown cutting mode');
  const source=fs.readFileSync(sourceURL,'utf8');
  const transformed=mode==='candidate'?transformCutReactionSource(source):mode==='budgeted'?transformBudgetedCutReactionSource(source):source;
  const absolute=transformed.replace(/from (['"])([^'"]+)\1/g,(_,quote,spec)=>
    `from ${JSON.stringify(spec.startsWith('.')?new URL(spec,sourceURL).href:import.meta.resolve(spec))}`);
  const module=await import('data:text/javascript;base64,'+Buffer.from(absolute).toString('base64'));
  return {...module,metadata:{mode,sourcePath:fileURLToPath(sourceURL),
    sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),
    transformedSHA256:crypto.createHash('sha256').update(transformed).digest('hex'),
    scope:mode==='budgeted'?'paired cutting impulses plus actual paired loss Eleft debit; request/damage/native/rebound preserved'
      :'cutting impulse block only; requested-J/Eleft, damage, native collisions and rebound preserved'}};
}
