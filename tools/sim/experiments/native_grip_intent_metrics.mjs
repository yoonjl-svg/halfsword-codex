// Derive this round's direction and first-contact summaries; no physics runs.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
const o=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(free|route|contact|out)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
for(const k of ['free','route','contact','out'])assert(o[k]&&path.isAbsolute(o[k]));assert(!fs.existsSync(o.out));
const sha=b=>createHash('sha256').update(b).digest('hex'),read=p=>{const b=fs.readFileSync(p),d=JSON.parse(b);assert(d.pass&&d.sourceStable);return {path:p,bytes:b.length,sha256:sha(b),data:d};};
const free=read(o.free),route=read(o.route),contact=read(o.contact);
const [fb,fc]=free.data.rows,[rb,rc]=route.data.rows,[cb,cc]=contact.data.rows;
assert.deepEqual(fb.creation,fc.creation);assert.deepEqual(fb.creation,rb.creation);assert.deepEqual(cb.creation,cc.creation);
const inputExact=(a,b)=>a.frames.every((f,i)=>JSON.stringify(f.input)===JSON.stringify(b.frames[i].input));
assert(inputExact(fb,fc)&&inputExact(rb,rc)&&inputExact(cb,cc));
assert.deepEqual(cb.frames.find(f=>f.tick===965).before,cc.frames.find(f=>f.tick===965).before,'Common contact boundary body state except changed aggregate torques');
const motors=fc.frames.flatMap(f=>f.nativeGrip.rows.map(m=>({tick:f.tick,phase:f.input.request.phase,...m}))),eligible=motors.filter(m=>m.cap>1e-5);
// Prior isolated +target6 gives positive body2 delta while getter is negative.
const opposing=eligible.filter(m=>-m.lastSubstepImpulseNms*m.requestedTorqueNm<-1e-9);
const flat=s=>new T.Vector3(0,0,1).applyQuaternion(new T.Quaternion(...s.q));
const deg=(a,b)=>T.MathUtils.radToDeg(Math.acos(T.MathUtils.clamp(a.dot(b),-1,1)));
const boundary=r=>{const f=r.frames.find(f=>f.tick===965);return {prefixFrames:r.prefixFrames,prefixSHA256:r.prefixSHA256,tick:f.tick,physicsAxisRadS:f.postPhysics.axial,afterCombatAxisRadS:f.afterCombat.axial,bladePlaneRotationDeg:deg(flat(f.before),flat(f.postPhysics)),relativeAxisRadS:f.postPhysics.relativeAxial,contacts:f.contactsAfterPhysics.length,firstStepEvents:f.events,pairDiagnostic:f.pairDiagnostic??null};};
const diagnosticScales=rc.frames.filter(f=>f.pairDiagnostic?.applied).map(f=>f.pairDiagnostic.requestScale);
const out={schema:1,toolSHA256:sha(fs.readFileSync(new URL(import.meta.url))),argv:process.argv.slice(2),references:[free,route,contact].map(({data,...meta})=>meta),fullInputExact:true,
 lastSubstep:{rows:motors.length,nontrivialRows:eligible.length,opposingRequestedComponentRows:opposing.length,below95PercentCapRows:eligible.filter(m=>Math.abs(m.lastSubstepImpulseNms)<.95*m.lastSubstepCapNms).length,firstOpposing:opposing[0]??null,scope:'Minus raw getter is signed body2 coefficient, calibrated by prior operator9. Last substep only, not whole-step impulse or fixed-world torque direction.'},
 routeFinalCap:{appliedFrames:diagnosticScales.length,boundedFrames:diagnosticScales.filter(s=>s<1).length,minScale:Math.min(...diagnosticScales)},
 contact:{baseline:boundary(cb),routeOnly:boundary(cc),scope:'Exact965-step prefix, one target-step reaction reroute only. Same incoming body poses/velocities and actual input, without motor. Aggregated torque/reaction requests differ by design. Not a from-spawn full combat candidate or evidence of whole-arm injury recovery.'},
 scope:'Free intent and route-only replay plus one-step saved contact diagnosis. Later diverged feedback requests prevent additive cause attribution. Reduced axial speed alone does not establish useful gameplay/naturalness.'};
fs.writeFileSync(o.out,JSON.stringify(out,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({lastSubstep:out.lastSubstep,routeFinalCap:out.routeFinalCap,contact:out.contact}));
