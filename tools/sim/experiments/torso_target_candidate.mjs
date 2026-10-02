// Research only. This file is never imported by the public game.
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const fighterUrl = new URL('../../../src/fighter.js', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');

export const torsoTargetScope = Object.freeze({
  name: 'checkpoint-relative calibrated chest frame',
  calibration: 'C = inverse(heading at checkpoint) * actual chest at checkpoint; frame = actual chest now * inverse(C). The checkpoint can already be bent/twisted; it is not an anatomical neutral stance.',
  contract: 'The frame equals heading at capture. Later actual chest rotation, including chest following a heading change, transports the hand offset, blade aim and resting blade face together. Origin remains actual chest translation.',
  yawOnly: 'rotation=yaw projects the corrected frame +X forward onto world XZ and uses atan2(-forward.z,forward.x) around world Y. Pitch/roll transport is excluded. Horizontal squared length < 1e-12 is a numerical axis singularity fallback to heading, not a human motion acceptance threshold.',
  offHand: 'Existing offHand uses the transported aimDirW * gripAlong + actual sword translation. Actual pommel, grip spring and common-point paired reaction are unchanged.',
  worldAim: 'Existing driveSword arithmetic uses heading whenever skill.tap is active, thrustPose.w > 0, finish.amt > 0, or weapon.gun is true; these commands derive local coordinates from world targets using heading.',
  untouched: ['armIK', 'offArmIK', 'offHand', 'manualMuscle', 'wrist gravity compensation', 'muscle strengths/caps', 'body pose', 'all force application and reaction code'],
  limitation: 'This tests removing target counterrotation after a matched checkpoint. It is not a finished input coordinate redesign, and does not establish natural stance, impact improvement, or motor energy closure.',
});

function replaceOnce(source, marker, replacement) {
  if (source.split(marker).length !== 2) throw Error('Expected one Fighter marker: ' + marker.slice(0, 100));
  return source.replace(marker, replacement);
}

// Kept in the transformed module so THREE is the same import as the actual source.
const frameHelpers = `
const torsoTargetCheckpoints = new WeakMap();
function torsoTargetReadChest(f) {
  const q = f.bodies.chest.rotation();
  return new THREE.Quaternion(q.x, q.y, q.z, q.w).normalize();
}
function torsoTargetYawFrame(frame) {
  const forward=new THREE.Vector3(1,0,0).applyQuaternion(frame);
  const horizontalSquared=forward.x*forward.x+forward.z*forward.z;
  if (!Number.isFinite(horizontalSquared) || horizontalSquared<1e-12) return null;
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(-forward.z,forward.x));
}
export function captureTorsoTargetCalibration(f, {rotation='full'}={}) {
  if (!['full','yaw'].includes(rotation)) throw TypeError('rotation must be full or yaw');
  if (!f?.yaw || !f.bodies?.chest || !f.handTarget || !f.aimDirW) throw TypeError('Provide an actual Fighter at the matched checkpoint');
  const chest = torsoTargetReadChest(f);
  const heading = f.yaw.clone().normalize();
  const relative = heading.clone().invert().multiply(chest).normalize();
  const inverse = relative.clone().invert();
  let frame = chest.clone().multiply(inverse).normalize();
  if (rotation==='yaw') frame=torsoTargetYawFrame(frame) || heading;
  const c = f.bodies.chest.translation();
  const offset = f.handTarget.clone().sub(new THREE.Vector3(c.x,c.y,c.z));
  const reproject = offset.clone().applyQuaternion(heading.clone().invert()).applyQuaternion(frame);
  const aimReproject = f.aimDirW.clone().applyQuaternion(heading.clone().invert()).applyQuaternion(frame);
  const state = {inverse, rotation, calls:0, transportedCalls:0, fallbackCalls:0, fallbackReasons:{}, last:null,
    calibration:{name:'checkpoint-relative calibrated chest frame', rotation, heading:heading.toArray(),
      chest:chest.toArray(), relative:relative.toArray(), frame:frame.toArray(),
      frameAgreementChord:Math.min(Math.hypot(frame.x-heading.x,frame.y-heading.y,frame.z-heading.z,frame.w-heading.w),Math.hypot(frame.x+heading.x,frame.y+heading.y,frame.z+heading.z,frame.w+heading.w)),
      targetOffsetReprojectionErrorM:reproject.distanceTo(offset), aimReprojectionError:aimReproject.distanceTo(f.aimDirW)}};
  torsoTargetCheckpoints.set(f,state);
  return structuredClone(state.calibration);
}
export function torsoTargetCalibrationInfo(f) {
  const s=torsoTargetCheckpoints.get(f);
  return s ? structuredClone({calibration:s.calibration,calls:s.calls,transportedCalls:s.transportedCalls,fallbackCalls:s.fallbackCalls,fallbackReasons:s.fallbackReasons,last:s.last}) : null;
}
export function clearTorsoTargetCalibration(f) { return torsoTargetCheckpoints.delete(f); }
function torsoTargetFrame(f) {
  const s=torsoTargetCheckpoints.get(f);
  if (!s) throw Error('Capture checkpoint-relative torso calibration before candidate driveSword');
  s.calls++;
  const reasons=[];
  if (f.skill?.tap) reasons.push('skill.tap');
  if (f.skill?.thrustPose?.w>0) reasons.push('thrustPose.w');
  if (f.finish?.amt>0) reasons.push('finish.amt');
  if (f.weapon?.gun) reasons.push('weapon.gun');
  if (reasons.length) {
    s.fallbackCalls++;
    for (const reason of reasons) s.fallbackReasons[reason]=(s.fallbackReasons[reason]||0)+1;
    s.last={transported:false,reasons,frame:f.yaw.toArray()};
    return f.yaw;
  }
  let frame=torsoTargetReadChest(f).multiply(s.inverse).normalize();
  if (s.rotation==='yaw') {
    const projected=torsoTargetYawFrame(frame);
    if (!projected) {
      const reason='yawForwardHorizontalDegenerate';
      s.fallbackCalls++;
      s.fallbackReasons[reason]=(s.fallbackReasons[reason]||0)+1;
      s.last={transported:false,reasons:[reason],frame:f.yaw.toArray()};
      return f.yaw;
    }
    frame=projected;
  }
  s.transportedCalls++;
  s.last={transported:true,reasons:[],frame:frame.toArray()};
  return frame;
}
`;

/** Only changes the three frame applications in driveSword; no gain/force code changes. */
export function transformTorsoTargetFighter(source) {
  if (typeof source !== 'string') throw TypeError('Provide Fighter source text');
  if (/\btorsoTargetCheckpoints\b/.test(source)) throw Error('Fighter source already transformed');
  const start = source.indexOf('  driveSword() {');
  const end = source.indexOf('\n  /**', start);
  if (start < 0 || end < 0) throw Error('Cannot isolate actual driveSword');
  let method = source.slice(start, end);
  method = replaceOnce(method, '    const mus = this.muscle;', '    const mus = this.muscle;\n    const torsoFrame = torsoTargetFrame(this);');
  method = replaceOnce(method, 'this.handTarget.copy(handLocal).applyQuaternion(this.yaw)', 'this.handTarget.copy(handLocal).applyQuaternion(torsoFrame)');
  method = replaceOnce(method, '    aim.applyQuaternion(this.yaw);', '    aim.applyQuaternion(torsoFrame);');
  method = replaceOnce(method, 'RIGHT_LOCAL.clone().applyQuaternion(this.yaw)', 'RIGHT_LOCAL.clone().applyQuaternion(torsoFrame)');
  return frameHelpers + source.slice(0, start) + method + source.slice(end);
}

function resolveSharedImports(source) {
  return source.replace(/from (['"])([^'"]+)\1/g, (all, quote, specifier) => {
    const resolved = specifier.startsWith('.') ? new URL(specifier, fighterUrl).href : import.meta.resolve(specifier);
    return 'from ' + JSON.stringify(resolved);
  });
}

/** Import temporary clones with actual shared THREE/config dependencies. Caller owns cleanup. */
export async function loadTorsoTargetCandidates() {
  const original = await readFile(fighterUrl, 'utf8');
  const cloneSource = resolveSharedImports(original);
  const candidateSource = resolveSharedImports(transformTorsoTargetFighter(original));
  const directory = await mkdtemp(join(tmpdir(), 'halfsword-torso-target-'));
  const clonePath = join(directory, 'clone.mjs'), candidatePath = join(directory, 'candidate.mjs');
  try {
    await writeFile(clonePath, cloneSource);
    await writeFile(candidatePath, candidateSource);
    const [clone, candidate] = await Promise.all([import(pathToFileURL(clonePath).href), import(pathToFileURL(candidatePath).href)]);
    const cleanup = () => rm(directory, {recursive:true, force:true});
    const api = {
      clone:clone.Fighter.prototype.driveSword, candidate:candidate.Fighter.prototype.driveSword,
      baselineDriveSword:clone.Fighter.prototype.driveSword, candidateDriveSword:candidate.Fighter.prototype.driveSword,
      captureCalibration:candidate.captureTorsoTargetCalibration,
      calibrationInfo:candidate.torsoTargetCalibrationInfo,
      clearCalibration:candidate.clearTorsoTargetCalibration,
      sourceHashes:{original:hash(original),clone:hash(cloneSource),candidate:hash(candidateSource)},
      scope:torsoTargetScope, cleanup,
    };
    api.installer = ({f, ledger, variant}) => {
      if (!['clone','chest','chestYaw'].includes(variant)) throw TypeError('variant must be clone, chest or chestYaw');
      if (!ledger?.replaceObservedMethod) throw TypeError('Provide the actual force ledger');
      const calibrated=variant!=='clone';
      const summary={variant,dispatchCalls:0,calibration:calibrated?api.captureCalibration(f,{rotation:variant==='chestYaw'?'yaw':'full'}):null,controller:null};
      const implementation=variant==='clone'?api.clone:api.candidate;
      const restoreDispatch=ledger.replaceObservedMethod(f,'driveSword',function(...args){
        summary.dispatchCalls++;
        try {return implementation.apply(this,args);}
        finally {if(calibrated)summary.controller=api.calibrationInfo(this);}
      });
      return {summary,restore(){restoreDispatch();if(calibrated)api.clearCalibration(f);}};
    };
    return api;
  } catch (error) {
    await rm(directory, {recursive:true, force:true});
    throw error;
  }
}

export const prepareTorsoTargetCandidate = loadTorsoTargetCandidates;
