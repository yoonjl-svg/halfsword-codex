// Actual native startup. Component removals are diagnosis, not playable candidates.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {newRound, DT, THREE, AI} from '../harness_m.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(s => {
  const m = /^--(out|weapons|modes|seconds|scene)=(.+)$/.exec(s);
  assert.ok(m, 'Use --out=, --weapons=, --modes=, --seconds=, --scene=');
  return [m[1], m[2]];
}));
assert.ok(args.out && !fs.existsSync(args.out), 'Use a fresh output');
const weapons = (args.weapons || 'monohoshizao,lightsaber,longsword,zweihander').split(',');
const modes = (args.modes || 'baseline').split(',');
assert.ok(modes.every(x => ['baseline', 'axial', 'noOffhand', 'noTwist', 'noWristDamping'].includes(x)));
const seconds = +(args.seconds || 1.9);
assert.ok(seconds > 0 && seconds <= 10);
const scene = args.scene || 'idle';
assert.ok(['idle','duel'].includes(scene));
const sha = b => createHash('sha256').update(b).digest('hex');
const scan = d => fs.readdirSync(d, {withFileTypes:true}).flatMap(e => e.isDirectory() ? scan(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d,e.name)] : []);
const files = [...scan('src'), 'package-lock.json', 'tools/sim/harness_m.mjs', 'tools/sim/experiments/startup_wrist_probe.mjs', 'node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const manifest = () => Object.fromEntries(files.sort().map(p => [p,sha(fs.readFileSync(p))]));
const before = manifest(), started = new Date(), begin = performance.now(), random = Math.random;
const v = x => new THREE.Vector3(x.x,x.y,x.z), q = x => new THREE.Quaternion(x.x,x.y,x.z,x.w);
const norm = x => Math.hypot(x.x,x.y,x.z);
const point = (b,p) => v(p).applyQuaternion(q(b.rotation())).add(v(b.translation()));
const rows = [];
try {
  for (const weapon of weapons) for (const mode of modes) {
    let G;
    try {
      G = newRound({seed:7,weapon,weapon2:'longsword',skill:.7,walls:false,...(scene==='duel'?{AI2Class:AI}:{})});
      const f = G.player, sword = f.sword;
      f.skill.autoGuard = true;
      if (mode === 'axial') f.gripPointModel = 'axial';
      if (mode === 'noTwist') f.twistScale = 0;
      if (mode === 'noWristDamping') f.weaponCfg.aimDamping = f.weaponCfg.releaseDamping = 0;
      const originalOffhand = f.offHand;
      const originalDrive = f.driveSword;
      let wristTorque, gripTorque, gripForce, gripAxialTorque, gripDistanceM;
      f.driveSword = function(...a) {
        const t0 = v(sword.userTorque());
        const result = originalDrive.apply(this,a);
        wristTorque = v(sword.userTorque()).sub(t0);
        return result;
      };
      f.offHand = function(...a) {
        const t0 = v(sword.userTorque()), f0 = v(sword.userForce());
        const result = mode === 'noOffhand' ? (this.gripping = false) : originalOffhand.apply(this,a);
        gripTorque = v(sword.userTorque()).sub(t0);
        gripForce = v(sword.userForce()).sub(f0);
        const blade = new THREE.Vector3(0,1,0).applyQuaternion(q(sword.rotation()));
        const pommel = point(sword,{x:0,y:this.weaponCfg.gripAlong,z:0});
        const hand = point(this.bodies.farmO,{x:0,y:-.135,z:0});
        gripAxialTorque = gripTorque.dot(blade);
        gripDistanceM = hand.distanceTo(pommel);
        return result;
      };
      const trace = createHash('sha256'), frames = [], initialNativeSHA = sha(G.world.takeSnapshot());
      const properties = {mass:sword.mass(),principalInertia:sword.principalInertia(),principalFrame:sword.principalInertiaLocalFrame(),localCom:sword.localCom(),swordIhand:f.swordIhand,twistScale:f.twistScale,control:{...f.weaponCfg}};
      for (let tick = 0; tick < Math.round(seconds / DT); tick++) {
        const preOmega = sword.angvel();
        G.step();
        const blade = new THREE.Vector3(0,1,0).applyQuaternion(q(sword.rotation()));
        const omega = sword.angvel();
        let jointGapMaxM = 0;
        for (const j of f.joints) if (j.joint?.isValid()) jointGapMaxM = Math.max(jointGapMaxM,point(j.parent,j.joint.anchor1()).distanceTo(point(j.child,j.joint.anchor2())));
        const frame = {timeS:G.t,targetElevationDeg:Math.asin(THREE.MathUtils.clamp(f.aimDirW.y,-1,1))*180/Math.PI,actualElevationDeg:Math.asin(THREE.MathUtils.clamp(blade.y,-1,1))*180/Math.PI,aimErrorRad:blade.angleTo(f.aimDirW),preOmega,omega,swingOmega:v(omega).addScaledVector(blade,-v(omega).dot(blade)).length(),twistOmega:v(omega).dot(blade),wristTorque:wristTorque.toArray(),gripTorque:gripTorque.toArray(),gripForce:gripForce.toArray(),gripAxialTorque,gripDistanceM,wristCap:f.debug.wristCap,gripping:f.gripping,jointGapMaxM,state:f.state,wounds:f.wounds.length,finite:[...Object.values(f.bodies),sword].every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(x=>Object.values(x).every(Number.isFinite)))};
        assert.ok(frame.finite);
        frames.push(frame);
        trace.update(JSON.stringify([Object.values(f.bodies).map(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()]),sword.translation(),sword.rotation()]));
      }
      const firstLarge = frames.find(x => x.aimErrorRad > .5);
      const summary = {weapon,mode,scene,initialNativeSHA,nativeTraceSHA:trace.digest('hex'),maxOmega:Math.max(...frames.map(x=>norm(x.omega))),maxSwingOmega:Math.max(...frames.map(x=>x.swingOmega)),maxAimErrorRad:Math.max(...frames.map(x=>x.aimErrorRad)),minElevationDeg:Math.min(...frames.map(x=>x.actualElevationDeg)),maxElevationDeg:Math.max(...frames.map(x=>x.actualElevationDeg)),firstLargeErrorS:firstLarge?.timeS??null,maxGripTorque:Math.max(...frames.map(x=>Math.hypot(...x.gripTorque))),maxGripAxialTorque:Math.max(...frames.map(x=>Math.abs(x.gripAxialTorque))),maxWristTorque:Math.max(...frames.map(x=>Math.hypot(...x.wristTorque))),maxJointGapM:Math.max(...frames.map(x=>x.jointGapMaxM)),wounds:frames.at(-1).wounds,actualClashes:G.clashes,actualWounds:G.wounds.map(w=>({timeS:w.t,att:w.att.name,vic:w.vic.name,zone:w.zone,type:w.type,severity:w.severity})),final:{player:f.state,enemy:G.enemy.state,armed:f.armed}};
      rows.push({...summary,properties,frames});
      console.log(JSON.stringify(summary));
    } finally { G?.world.free(); }
  }
} finally {
  Math.random = random;
  const after = manifest();
  fs.writeFileSync(args.out, JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceBefore:before,sourceAfter:after,sourceStable:JSON.stringify(before)===JSON.stringify(after),startedUTC:started.toISOString(),wallSeconds:(performance.now()-begin)/1000,settings:{dt:DT,seconds,seed:7,skill:.7,scene,foe:'original reactive longsword AI'},scope:'Actual passive player startup or original two-AI native combat (scene). Measurement wrappers read user force/torque only. noOffhand/noTwist/noWristDamping remove components for diagnosis, not approved gameplay. axial changes only player force point. No injected pose, force, injury or velocity. Native trace and snapshot permit wrapper invariance comparison to existing startup raw. Different combat contacts/injuries are not matched-state efficacy or win-rate evidence. Finite/stand is not human naturalness.',rows},null,2)+'\n',{flag:'wx'});
}
