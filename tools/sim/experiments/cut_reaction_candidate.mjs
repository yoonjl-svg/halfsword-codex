/** Research source clones: candidate preserves legacy requested-J*s Eleft debit;
 * budgeted instead debits actual instantaneous passive pair loss and advances phases.
 * Node-only loading/transformation is kept here; shared physics lives in browser src.
 * Native collision, joints, muscles and wound energy are outside this candidate.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

export {applyPairedCutImpulse,pointDirectionalMobility} from '../../../src/cut_reaction.js';

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
