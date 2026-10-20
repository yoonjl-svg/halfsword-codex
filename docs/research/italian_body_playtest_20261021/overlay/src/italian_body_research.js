// Isolated human trial: C hand path with coordinated trunk, no requested step.
import * as THREE from 'three';
import {FollowupOpposition} from './italian_followup_research.js';

const smooth = x => { x = Math.max(0, Math.min(1, x)); return x*x*(3-2*x); };
const rad = Math.PI/180;
export const BODY_TARGET = Object.freeze({
  pelvisYaw: 10*rad, chestYaw: 12*rad, pitch: 2*rad, drop: .02,
});

export class BodyOpposition extends FollowupOpposition {
  constructor(f, foe, guard, variant = 'strongBind', bodyEnabled = true) {
    super(f, foe, guard, variant);
    this.bodyEnabled = bodyEnabled;
    this.cueAt = -Infinity;
    this.pendingCue = null;
    this.bodySamples = [];
  }

  onClash(...args) {
    const serial = this.serial;
    super.onClash(...args);
    const r = this.run;
    if (!r || this.serial === serial) return;
    r.bodyFrom = {...r.body};
    // Direction of the receiving blade; reuse flowSparks without a fake nagashi.
    const dir = this.f.bladePoint(1, new THREE.Vector3())
      .sub(this.f.bladePoint(0, new THREE.Vector3())).normalize();
    this.cueAt = this.guard.clock;
    this.pendingCue = {serial: r.serial, dir};
    this.events.push({type: 'cue', t: this.cueAt, serial: r.serial});
  }

  takeCue() {
    const cue = this.pendingCue;
    this.pendingCue = null;
    return cue;
  }

  update(dt) {
    const r = this.run;
    if (r && this.bodyEnabled) {
      // The same progress drives shoulder/trunk and hand extension.
      // Existing withdrawal/release still blends this pose out through th.w.
      const blend = smooth((r.t + dt*this.f.stamina.attackSpeed)/.12);
      for (const key of Object.keys(BODY_TARGET))
        r.body[key] = r.bodyFrom[key] + (BODY_TARGET[key])*blend;
    }
    super.update(dt);
    if (this.run && this.bodySamples.length < 10000) {
      const f = this.f;
      this.bodySamples.push({
        t: this.guard.clock, serial: this.run.serial,
        target: {...this.run.body}, weight: f.skill.thrustPose.w,
        body: {...f.bodyPose},
        chest: {...f.bodies.chest.translation()},
        head: {...f.bodies.head.translation()},
        sword: {...f.sword.translation()},
        tip: f.bladePoint(1, new THREE.Vector3()).toArray(),
      });
    }
  }
}

export function installBody(f, foe, guard, variant = 'strongBind', bodyEnabled = true) {
  const mod = new BodyOpposition(f, foe, guard, variant, bodyEnabled);
  guard.opposition = mod;
  return mod;
}
