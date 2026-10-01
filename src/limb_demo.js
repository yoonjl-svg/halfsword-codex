// Explicit, opt-in synthetic injury preview. Never an impact-strength test.
import * as THREE from 'three';
import { COMBAT, ANATOMY } from './config.js';

export function previewLimbInjury(f, limb) {
  if (!COMBAT.limbSeverTrial || !['armS', 'legF'].includes(limb)) return false;
  const part = limb === 'armS' ? 'farmS' : 'shinF';
  const joint = f.jointByName[part]?.joint;
  if (!joint || f.state === 'dead') return false;
  const zone = limb === 'armS' ? 'arm' : 'leg';
  f.applyWound({ part, zone, type: 'cut', severity: 1.3, energy: 150,
    bleedPerSev: ANATOMY[zone].bleed, local: new THREE.Vector3().copy(joint.anchor2()),
    dir: new THREE.Vector3(1, 0, 0), pass: true, passing: true, stuck: false });
  if (f.severedLimbs?.length) f.severedLimbs.at(-1).source = 'synthetic-preview';
  return !!f.detachedParts?.has(part);
}
