import assert from 'node:assert/strict';
import fs from 'node:fs';
import {implicitPointImpulse,pointInverseMass} from './spin_closure_20261006_implicit.mjs';

const cases=[],dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0),h=1/120,beta=50;
for(const [name,K] of [['diagonal',[[2,0,0],[0,20,0],[0,0,2000]]],['coupled',[[100,20,-30],[20,5,-4],[-30,-4,60]]]]){
  for(const u of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[2,-3,5]]){
    const F=u.map(x=>-beta*x),r=implicitPointImpulse(F,h,beta,K),J=r.impulse,up=u.map((x,i)=>x+r.pointVelocityChange[i]),work=dot(J,u)+.5*dot(J,r.pointVelocityChange),identity=-h*beta*dot(up,up)-.5*dot(J,r.pointVelocityChange);
    assert.ok(work<=1e-12);assert.ok(Math.abs(work-identity)<1e-12);assert.ok(Math.hypot(...J)<=h*Math.hypot(...F)*(1+1e-12));assert.ok(r.residualNorm<1e-12);
    if(name==='diagonal')for(let i=0;i<3;i++)assert.ok(Math.abs(J[i]-h*F[i]/(1+h*beta*K[i][i]))<1e-12);
    cases.push({name,u,workJ:work,identityJ:identity,budgetRatio:Math.hypot(...J)/(h*Math.hypot(...F)),residualNorm:r.residualNorm});
  }
}
const body={worldCom:()=>({x:0,y:0,z:0}),effectiveInvMass:()=>({x:0,y:2,z:3}),effectiveWorldInvInertia:()=>({m11:1,m12:0,m13:0,m21:0,m22:2,m23:0,m31:0,m32:0,m33:3})};
// r=(1,0,0), J=(0,1,0): translation (0,2,0), angular (0,3,0).
assert.deepEqual(pointInverseMass(body,{x:1,y:0,z:0},{x:0,y:1,z:0}),{x:0,y:5,z:0});
// A locked translation with a COM impulse must stay locked.
assert.deepEqual(pointInverseMass(body,{x:0,y:0,z:0},{x:1,y:0,z:0}),{x:0,y:0,z:0});
for(const K of [[[1,0,0],[0,-1,0],[0,0,1]],[[1,1,0],[0,1,0],[0,0,1]],[[NaN,0,0],[0,1,0],[0,0,1]],[[0,0,0],[0,0,0],[0,0,0]]])assert.throws(()=>implicitPointImpulse([1,2,3],h,beta,K));
const out=process.argv[2];if(out)fs.writeFileSync(out,JSON.stringify({pass:true,physicalDirectionFixtures:cases.length,lockedMassFixtures:2,invalidInputFixtures:4,cases},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:true,physicalDirectionFixtures:cases.length,lockedMassFixtures:2,invalidInputFixtures:4}));
