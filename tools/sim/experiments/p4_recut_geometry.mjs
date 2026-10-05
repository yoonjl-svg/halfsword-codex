// Archived-state geometry screen only: no Rapier, world or body mutation.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';

const opts = Object.fromEntries(process.argv.slice(2).map(value => {
  const match = /^--(observed|out)=(.+)$/.exec(value); assert(match); return [match[1], match[2]];
}));
assert(opts.observed && opts.out && path.isAbsolute(opts.out) && !fs.existsSync(opts.out));
const bytes = fs.readFileSync(opts.observed), saved = JSON.parse(bytes);
assert(saved.pass && saved.sourceStable);
const sha = value => createHash('sha256').update(value).digest('hex');
const V = values => new THREE.Vector3(...values);
const carry = (normal, from, to) => normal.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(from, to));
const signed = (a, b, axis) => Math.atan2(new THREE.Vector3().crossVectors(a, b).dot(axis), a.dot(b));
const deg = radians => radians * 180 / Math.PI;

// Diagnostic continuation differs from the rejected temporal candidate only
// in the causal seam: it never reselects the completed goal against actual flat.
// Its possible >90-degree physical error and winding are reported, not hidden.
function continued(rest, motion, moving, flat, blade, previous) {
  const reference = previous ? carry(previous.target, previous.blade, blade) : flat.clone();
  if (rest.dot(reference) < 0) rest.negate();
  if (moving > 0) {
    if (motion.dot(reference) < 0) motion.negate();
    rest.lerp(motion, moving);
    if (rest.lengthSq() < 1e-8) rest.copy(reference);
    rest.normalize();
  }
  return rest;
}
const rows = ['legacy', 'continuedNormal'].map(model => {
  let previous = null;
  const frames = saved.frames.map(frame => {
    const stages = Object.fromEntries(frame.stages.map(stage => [stage.stage, stage.values]));
    const a = stages.beforeMotion, b = stages.beforeTransport;
    const flat = V(a.flat), blade = V(a.blade), rest = V(a.flatTarget), moving = b.moving;
    const motion = new THREE.Vector3().crossVectors(blade, V(a.edgeDir)).normalize();
    const target = model === 'legacy' || !previous ? V(b.flatTarget)
      : continued(rest, motion, moving, flat, blade, previous);
    const error = signed(flat, target, blade);
    const normalizedPositionTorque = new THREE.Vector3().crossVectors(flat, target).dot(blade);
    const row = {tick: frame.tick, moving, thrustWeight: frame.stages.find(s => s.stage === 'afterTransport').weight,
      target: target.toArray(), signedErrorDeg: deg(error), unsignedPlaneErrorDeg: deg(Math.acos(Math.min(1, Math.abs(flat.dot(target))))),
      targetSlewDeg: previous ? deg(signed(carry(previous.target, previous.blade, blade), target, blade)) : null,
      normalizedPositionTorque, positionTorqueDelta: previous ? normalizedPositionTorque - previous.positionTorque : null};
    previous = {target, blade, positionTorque: normalizedPositionTorque};
    return row;
  });
  return {model, frames, maxTargetSlewDeg: Math.max(...frames.map(f => Math.abs(f.targetSlewDeg ?? 0))),
    maxSignedErrorDeg: Math.max(...frames.map(f => Math.abs(f.signedErrorDeg))),
    maxNormalizedPositionTorqueDelta: Math.max(...frames.map(f => Math.abs(f.positionTorqueDelta ?? 0)))};
});
const out = {schemaVersion: 1, createdUTC: new Date().toISOString(), pureDerivation: true, physicsSteps: 0,
  source: {path: opts.observed, bytes: bytes.length, sha256: sha(bytes)}, producerSHA256: sha(fs.readFileSync(new URL(import.meta.url))),
  contract: 'Same 23 archived baseline physical states. Seed at first recorded beforeTransport target. Rest/motion signs follow transported previous goal; no final actual-flat nearest-sign projection. Existing linear weights and normalized positional torque remain.',
  limitations: ['No candidate native dynamics, contact or gameplay claim.', 'Before-transport targets only; active thrust transport is not replayed.', 'A directed continuous lift can retain an error greater than90deg and require a longer physical turn. This is a candidate risk, not masked as plane equivalence.'], rows};
fs.mkdirSync(path.dirname(opts.out), {recursive: true});
fs.writeFileSync(opts.out, JSON.stringify(out, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify(rows.map(({model, frames, ...summary}) => ({model, ...summary, recut: frames.filter(f => f.tick >= 1203)}))));
