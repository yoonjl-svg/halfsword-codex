import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3, MathUtils} from 'three';
import {smoothIntentElevation} from '../../src/edge_intent.js';

function original(x,y) {
  const e=y<=.1?Math.max(-.6,(y-.1)*1.1):Math.min(1.75,((y-.1)/.5)*1.65);
  const a=MathUtils.clamp((x-.05)*1.7,-1.1,1.3);
  return new Vector3(Math.cos(e)*Math.cos(a),Math.sin(e),Math.cos(e)*Math.sin(a));
}
function aim(x,y) {const v=original(x,y);smoothIntentElevation(v,x,y);return v;}
const elevation=y=>Math.asin(aim(.05,y).y);

test('research join leaves both boundaries and outside targets exactly intact',()=>{
  for(const x of [-2,0,.42,2])for(const y of [-2,-.45,.05,.15,.52,2])
    assert.deepEqual(aim(x,y).toArray(),original(x,y).toArray());
});
test('elevation has continuous slope at both joins and former seam',()=>{
  const h=1e-6;
  for(const [y,slope]of [[.05,1.1],[.1,2.2],[.15,3.3]]) {
    const l=(elevation(y)-elevation(y-h))/h,r=(elevation(y+h)-elevation(y))/h;
    assert.ok(Math.abs(l-slope)<3e-5 && Math.abs(r-slope)<3e-5);
  }
});
test('interior preserves azimuth and unit length, with bounded monotone elevation',()=>{
  let previous=-Infinity;
  for(let i=0;i<=100;i++) {
    const y=.05+i*.001,v=aim(.42,y),e=Math.asin(v.y),old=Math.asin(original(.42,y).y);
    assert.ok(Math.abs(v.length()-1)<1e-12);
    assert.ok(Math.abs(Math.atan2(v.z,v.x)-(.42-.05)*1.7)<1e-12);
    assert.ok(e>=previous && e-old>=-1e-12 && e-old<=.0275+1e-12);
    previous=e;
  }
});
