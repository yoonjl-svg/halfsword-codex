// Optional in-place thrust: choose a reachable chamber around the shoulders,
// then use ordinary muscle targets. No native pose, force or damage override.
import * as THREE from 'three';
import { ARM } from './config.js';

export const closeThrustEnabled = f => f?.opportunityCloseThrust === true;
const V = a => new THREE.Vector3(...a);
const smooth = t => t * t * (3 - 2 * t);
const clamp = THREE.MathUtils.clamp;

export function captureCloseThrust(f, target, hand, reach) {
  if (!closeThrustEnabled(f) || !target || !hand) return null;
  const c = f.bodies.chest.translation(), inv = f.yaw.clone().invert();
  const local = target.clone().sub(new THREE.Vector3(c.x,c.y,c.z)).applyQuaternion(inv);
  const cq = f.bodies.chest.rotation();
  const bodyQ = new THREE.Quaternion(cq.x,cq.y,cq.z,cq.w).premultiply(inv);
  const shoulder = V(ARM.shoulder); shoulder.z *= f.side ?? 1; shoulder.applyQuaternion(bodyQ);
  const other = V(ARM.shoulder); other.z *= -(f.side ?? 1); other.applyQuaternion(bodyQ);
  const radius = ARM.upper + ARM.fore - ARM.slack;
  const length = f.weaponCfg.hiltLength + f.weaponCfg.bladeLength;
  const old = V(hand), sq = f.sword.rotation();
  const axis = new THREE.Vector3(0,1,0).applyQuaternion(new THREE.Quaternion(sq.x,sq.y,sq.z,sq.w)).applyQuaternion(inv);
  const hp = f.bodies.head.translation();
  const head = new THREE.Vector3(hp.x-c.x,hp.y-c.y,hp.z-c.z).applyQuaternion(inv);
  let best = null;
  // Same 6cm inner reach margin as distance preparation. The captured head
  // volume and actual collision still decide whether the point can enter.
  const distance = length - .06;
  for (let xi=0;xi<=15;xi++) for (let zi=0;zi<=18;zi++) {
    const x = -.35 + xi*.05, z = (f.side ?? 1)*(-.3+zi*.05);
    const yy = distance*distance-(x-local.x)**2-(z-local.z)**2;
    if (yy < 0) continue;
    for (const sign of [1,-1]) {
      const grip = new THREE.Vector3(x,local.y+sign*Math.sqrt(yy),z);
      if (grip.y < -.3 || grip.y > .66 || grip.distanceTo(shoulder)>radius ||
          (grip.x<0 && grip.y<.32)) continue;
      const dir=local.clone().sub(grip).normalize();
      const end=grip.clone().addScaledVector(dir,Math.min(.28,reach));
      if (end.distanceTo(shoulder)>radius) continue;
      if (f.weaponCfg.twoHand && [grip,end].some(p=>p.clone().addScaledVector(dir,f.weaponCfg.gripAlong).distanceTo(other)>radius)) continue;
      // Hilt and blade must clear our head/torso, including the interpolation
      // from the current hand. This geometric guard supplements native contact.
      let clear=true;
      for (let s=0;s<=8 && clear;s++) {
        const a=s/8, g=old.clone().lerp(grip,a), d=axis.clone().lerp(dir,a).normalize();
        for (let j=0;j<=12;j++) {
          const p=g.clone().addScaledVector(d,-.12+(length+.12)*j/12);
          if (p.distanceTo(head)<(f.headR??.12)+.035 ||
              (Math.abs(p.x)<.14 && p.y>-.3 && p.y<.23 && Math.abs(p.z)<.23)) { clear=false;break; }
        }
      }
      if (!clear) continue;
      const score=grip.distanceTo(old)+axis.angleTo(dir)*.08;
      if (!best || score<best.score) best={score,hand:grip.toArray(),dir:dir.toArray(),extension:Math.min(.28,reach)};
    }
  }
  if (!best) return null;
  return {...best,start:hand.slice(),startDir:axis.toArray(),target:local.toArray(),phase:'aim',
    aim:clamp(best.score/2.5,.11,.36)};
}

export function updateCloseThrust(f,tap,pose) {
  const s=tap.opportunityClose;
  if (!s) return false;
  const a=smooth(clamp(tap.t/tap.K.aim,0,1));
  const e=smooth(clamp((tap.t-tap.K.aim)/tap.K.extend,0,1));
  for(let i=0;i<3;i++) {
    pose.hand[i]=s.start[i]+(s.hand[i]-s.start[i])*a+s.dir[i]*s.extension*e;
    pose.dir[i]=s.startDir[i]+(s.dir[i]-s.startDir[i])*a;
  }
  const direction=V(pose.dir).normalize(); pose.dir.splice(0,3,...direction.toArray());
  s.phase=tap.t<tap.K.aim?'aim':tap.t<tap.K.aim+tap.K.extend?'extend':'recover';
  tap.dir=s.dir.slice();
  return true;
}
