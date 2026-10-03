import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {applyPlaneAlignmentPotential} from '../../src/edge_torque.js';

const k=4, blade=new Vector3(0,0,1);
function torque(phi, goal=0, sign=1) {
  const f=new Vector3(Math.cos(phi),Math.sin(phi),0);
  const n=new Vector3(Math.cos(goal),Math.sin(goal),0).multiplyScalar(sign);
  const t=new Vector3().crossVectors(f,n).projectOnVector(blade).multiplyScalar(k);
  return applyPlaneAlignmentPotential(t,f,n).z;
}
const energy=phi=>.5*k*Math.sin(phi)**2;

test('force is minus the derivative of the fixed-plane potential',()=>{
  const h=1e-6;
  for(const phi of [-2.9,-1.8,-.7,-.02,.02,.7,1.8,2.9]) {
    const gradient=(energy(phi+h)-energy(phi-h))/(2*h);
    assert.ok(Math.abs(torque(phi)+gradient)<1e-8);
  }
});
test('opposite normal labels and blade faces produce the same torque',()=>{
  for(const phi of [-2.4,-.7,.2,1.6,2.8]) {
    assert.equal(torque(phi,.3,1),torque(phi,.3,-1));
    assert.ok(Math.abs(torque(phi,.3)-torque(phi+Math.PI,.3))<1e-12);
  }
});
test('orthogonal branch crossing is continuous and remains an equilibrium',()=>{
  const h=1e-7;
  assert.ok(Math.abs(torque(Math.PI/2))<1e-12);
  assert.ok(Math.abs(torque(Math.PI/2-h)-torque(Math.PI/2+h))<3*k*h);
  assert.ok(torque(Math.PI/2-h)<0 && torque(Math.PI/2+h)>0);
});
test('small-error stiffness stays k while peak torque and barrier are k/2',()=>{
  const h=1e-7;
  assert.ok(Math.abs(-torque(h)/h-k)<1e-10);
  assert.ok(Math.abs(Math.abs(torque(Math.PI/4))-k/2)<1e-12);
  assert.ok(Math.abs(energy(Math.PI/2)-k/2)<1e-12);
});
