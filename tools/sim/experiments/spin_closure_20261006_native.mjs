// Synthetic pure-damper contract fixtures using actual game sword/forearm bodies.
// No world.step, AI, contacts, motor or gameplay efficacy claims.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {newRound,DT,THREE} from '../harness_m.mjs';
import {implicitPointImpulse,pointInverseMass} from './spin_closure_20261006_implicit.mjs';
const V=x=>new THREE.Vector3(x.x,x.y,x.z),Q=x=>new THREE.Quaternion(x.x,x.y,x.z,x.w),rows=[],random=Math.random;
function bodyState(b){const v=V(b.linvel()),w=V(b.angvel()),frame=Q(b.rotation()).multiply(Q(b.principalInertiaLocalFrame())),local=w.clone().applyQuaternion(frame.clone().invert()),I=V(b.principalInertia()),P=v.clone().multiplyScalar(b.mass());return {K:.5*b.mass()*v.lengthSq()+.5*local.dot(local.clone().multiply(I)),P,L:local.multiply(I).applyQuaternion(frame).add(V(b.worldCom()).cross(P))};}
try{for(const weapon of ['monohoshizao','lightsaber']){
  const G=newRound({seed:7,weapon,weapon2:'longsword',walls:false});
  try{
    const f=G.player,s=f.sword,fo=f.bodies.farmO,p=new THREE.Vector3(0,f.weaponCfg.gripAlong,0).applyQuaternion(Q(s.rotation())).add(V(s.translation())),beta=50;
    const columns=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)].map(j=>V(pointInverseMass(fo,p,j)).add(V(pointInverseMass(s,p,j))).toArray()),K=[0,1,2].map(i=>columns.map(col=>col[i]));
    for(const u of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
      s.setLinvel({x:0,y:0,z:0},true);s.setAngvel({x:0,y:0,z:0},true);fo.setLinvel({x:u[0],y:u[1],z:u[2]},true);fo.setAngvel({x:0,y:0,z:0},true);
      const pre=[bodyState(fo),bodyState(s)],solved=implicitPointImpulse(u.map(x=>-beta*x),DT,beta,K),J=new THREE.Vector3(...solved.impulse),up=new THREE.Vector3(...u).add(new THREE.Vector3(...solved.pointVelocityChange));
      fo.applyImpulseAtPoint(J,p,true);s.applyImpulseAtPoint(J.clone().negate(),p,true);
      const post=[bodyState(fo),bodyState(s)],actual=post[0].K+post[1].K-pre[0].K-pre[1].K,predicted=-DT*beta*up.lengthSq()-.5*J.dot(new THREE.Vector3(...solved.pointVelocityChange)),actualUp=V(fo.velocityAtPoint(p)).sub(V(s.velocityAtPoint(p))),velocityError=actualUp.distanceTo(up),deltaP=post[0].P.clone().add(post[1].P).sub(pre[0].P).sub(pre[1].P).length(),deltaL=post[0].L.clone().add(post[1].L).sub(pre[0].L).sub(pre[1].L).length();
      assert.ok(actual<=1e-6);assert.ok(Math.abs(actual-predicted)<1e-4);assert.ok(velocityError<1e-4);assert.ok(deltaP<1e-5);assert.ok(deltaL<1e-4);
      rows.push({weapon,u,actualDeltaKJ:actual,predictedDeltaKJ:predicted,velocityError,deltaMomentumNs:deltaP,deltaAngularMomentumNms:deltaL,impulseBudgetRatio:J.length()/(DT*beta)});
    }
  }finally{G.eventQueue.free();G.world.free();}
}}finally{Math.random=random;}
const out=process.argv[2];assert.ok(out&&!fs.existsSync(out));fs.writeFileSync(out,JSON.stringify({pass:true,scope:'12 synthetic pure damping immediate impulse fixtures on game-created sword and off-arm bodies, no native world steps and no gameplay evidence',rows},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:true,fixtures:rows.length,maxVelocityError:Math.max(...rows.map(r=>r.velocityError)),maxWorkError:Math.max(...rows.map(r=>Math.abs(r.actualDeltaKJ-r.predictedDeltaKJ)))}));
