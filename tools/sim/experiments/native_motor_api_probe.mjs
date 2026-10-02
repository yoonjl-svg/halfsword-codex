// Isolated native API calibration. No game imports, no engine/package mutation.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const args=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(module|out|baseline)=(.+)$/.exec(s);if(!m)throw Error('Use --module=PATH --out=PATH [--baseline=PATH]');return[m[1],m[2]];}));
const modulePath=args.module||process.env.RAPIER_MODULE;
if(!modulePath)throw Error('Supply standalone RAPIER_MODULE or --module');
const output=args.out||'/workspace/halfsword-hybrid-evidence/native-motor-api-r1.json';
try{await access(output);throw Error('Refusing to overwrite '+output);}catch(e){if(e.code!=='ENOENT')throw e;}
const url=p=>p.startsWith('file:')?p:pathToFileURL(resolve(p)).href;
const imported=await import(url(modulePath)),R=imported.default?.World?imported.default:imported;
await R.init();
const hash=x=>createHash('sha256').update(x).digest('hex'),sourceBefore=hash(await readFile(new URL(import.meta.url)));
const Z={x:0,y:0,z:1},zero={x:0,y:0,z:0},V=v=>({x:v.x,y:v.y,z:v.z});
const moduleSourceBefore=hash(await readFile(new URL(url(modulePath))));
const tests=[],rows=[],calibration=[],TOL={impulse:2e-5,body:2e-5,inertia:2e-6};
function near(a,b,e=TOL.body){assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=e,`${a} != ${b} tol ${e}`);}
function body(b){const v=V(b.linvel()),w=V(b.angvel()),I=V(b.principalInertia());near(I.x,1,TOL.inertia);near(I.y,1,TOL.inertia);near(I.z,1,TOL.inertia);return {handle:String(b.handle),p:V(b.translation()),com:V(b.worldCom()),q:{...b.rotation()},v,w,m:b.mass(),I,inertiaFrame:{...b.principalInertiaLocalFrame()},force:V(b.userForce()),torque:V(b.userTorque()),sleeping:b.isSleeping(),K:.5*b.mass()*(v.x*v.x+v.y*v.y+v.z*v.z)+.5*I.z*(w.x*w.x+w.y*w.y+w.z*w.z)};}
function pair(g){return [body(g.a),body(g.b)];}
function structural(g){return {bodies:pair(g),joint:{handle:String(g.j.handle),a1:g.j.anchor1(),a2:g.j.anchor2(),f1:g.j.frameX1(),f2:g.j.frameX2(),type:g.j.type(),limits:g.j.limitsEnabled(),min:g.j.limitsMin(),max:g.j.limitsMax()},count:g.world.impulseJoints.len()};}
function axisInvariant(s){for(const b of s){for(const k of ['x','y','z']){near(b.p[k],0);near(b.v[k],0);}near(b.w.x,0);near(b.w.y,0);near(b.q.x,0);near(b.q.y,0);assert.ok(Object.values(b.w).every(Number.isFinite));}}
function make(api,dt=1/120,iterations=6){const world=new api.World(zero);world.timestep=dt;world.integrationParameters.numSolverIterations=iterations;
 const add=()=>{const b=world.createRigidBody(api.RigidBodyDesc.dynamic().setCanSleep(false).setLinearDamping(0).setAngularDamping(0));world.createCollider(api.ColliderDesc.cuboid(.5,.5,.5).setMass(6).setCollisionGroups(0),b);return b;};
 const a=add(),b=add(),j=world.createImpulseJoint(api.JointData.revolute(zero,zero,Z),a,b,true);j.setContactsEnabled(false);world.step();return {world,a,b,j};}
function restore(snapshot,handles){const world=R.World.restoreSnapshot(snapshot);return {world,a:world.getRigidBody(handles.a),b:world.getRigidBody(handles.b),j:world.getImpulseJoint(handles.j)};}
function raw(g){return g.j.rawSet;}
function configure(g,{k=1600,d=100,pos=.3125,vel=0}={}){g.j.configureMotorModel(R.MotorModel.ForceBased);g.j.configureMotor(pos,vel,k,d);}
function delta(pre,post){const d=post.map((b,i)=>b.I.z*b.w.z-pre[i].I.z*pre[i].w.z);return {bodyAngularImpulseZ:d,totalAngularImpulseZ:d[0]+d[1],deltaK:post.reduce((s,b)=>s+b.K,0)-pre.reduce((s,b)=>s+b.K,0)};}
async function test(name,fn){try{const details=await fn();tests.push({name,pass:true,details});console.log('PASS '+name);}catch(e){tests.push({name,pass:false,error:e.stack});console.error('FAIL '+name+': '+e.message);}}
await test('API presence, local Z/raw axis3, setter invariants and invalid caps atomic rejection',()=>{const g=make(R);try{
 const q=raw(g),axis=g.j.rawAxis();assert.equal(axis,3);for(const name of ['jointSetMotorMaxForce','jointMotorMaxForce','jointSetMotorEnabled','jointMotorEnabled','jointMotorImpulse'])assert.equal(typeof q[name],'function',name);
 const s=structural(g);assert.equal(q.jointMotorEnabled(g.j.handle,axis),false);q.jointSetMotorMaxForce(g.j.handle,axis,123);near(q.jointMotorMaxForce(g.j.handle,axis),123);assert.equal(q.jointMotorEnabled(g.j.handle,axis),false);assert.deepEqual(structural(g),s);
 const rejected=[];for(const cap of [-1,NaN,Infinity,-Infinity]){assert.throws(()=>q.jointSetMotorMaxForce(g.j.handle,axis,cap));near(q.jointMotorMaxForce(g.j.handle,axis),123);assert.deepEqual(structural(g),s);rejected.push(String(cap));}
 q.jointSetMotorMaxForce(g.j.handle,axis,0);near(q.jointMotorMaxForce(g.j.handle,axis),0);q.jointSetMotorEnabled(g.j.handle,axis,true);assert.equal(q.jointMotorEnabled(g.j.handle,axis),true);q.jointSetMotorEnabled(g.j.handle,axis,false);assert.equal(q.jointMotorEnabled(g.j.handle,axis),false);assert.deepEqual(structural(g),s);
 return {axis,rejected,poseVelocityMassFramesHandleUnchanged:true,maxForceSetterDoesNotEnable:true};
 }finally{g.world.free();}});
for(const dt of [1/240,1/120,1/60])for(const initialRelativeOmega of [0,-15]){
 const base=make(R,dt);base.a.setAngvel({x:0,y:0,z:-initialRelativeOmega/2},true);base.b.setAngvel({x:0,y:0,z:initialRelativeOmega/2},true);
 const snapshot=base.world.takeSnapshot(),handles={a:base.a.handle,b:base.b.handle,j:base.j.handle},initialHash=hash(JSON.stringify(pair(base)));base.world.free();
 const plans=initialRelativeOmega===0?[{name:'position',k:1600,d:100,pos:.3125,vel:0},{name:'position_velocity',k:1600,d:100,pos:.3125,vel:15}]:[{name:'damping_brake',k:0,d:100,pos:0,vel:0}];
 for(const cap of [0,5,500])for(const plan of plans)await test(`cap dt=${dt} omega=${initialRelativeOmega} cap=${cap} ${plan.name}`,()=>{const g=restore(snapshot,handles);try{
  assert.equal(hash(JSON.stringify(pair(g))),initialHash);assert.equal(g.j.rawAxis(),3);const s=structural(g);configure(g,plan);raw(g).jointSetMotorMaxForce(g.j.handle,3,cap);assert.deepEqual(structural(g),s);assert.equal(raw(g).jointMotorEnabled(g.j.handle,3),true);
  const before=pair(g);g.world.step();const after=pair(g),d=delta(before,after),readout=raw(g).jointMotorImpulse(g.j.handle,3),nativeDt=g.world.timestep;
  const row={dt:nativeDt,solverIterations:6,capNm:cap,plan,initialRelativeOmega,snapshotSha256:hash(snapshot),initialBodyHash:initialHash,before,after,...d,reportedMotorImpulse:readout,capTimesDt:cap*nativeDt,bodyToReportedAbsRatio:Math.abs(readout)>1e-12?Math.abs(d.bodyAngularImpulseZ[1]/readout):null};rows.push(row);
  axisInvariant(after);near(d.totalAngularImpulseZ,0);assert.ok(Math.abs(d.bodyAngularImpulseZ[1])<=cap*nativeDt+TOL.impulse,'Integrated per-body torque impulse exceeded cap*dt');assert.ok(Number.isFinite(readout));
  if(cap===0)near(d.bodyAngularImpulseZ[1],0);else assert.ok(Math.abs(d.bodyAngularImpulseZ[1])>0);
  if(plan.name==='damping_brake')assert.ok(d.deltaK<=TOL.body);
  return {row:rows.length-1,bodyImpulse:d.bodyAngularImpulseZ,readout,ratio:row.bodyToReportedAbsRatio};
 }finally{g.world.free();}});
}
for(const iterations of [1,2,6])await test(`readout full-step versus solver substep calibration n=${iterations}`,()=>{const g=make(R,1/120,iterations);try{
 configure(g,{pos:10,vel:100,k:1600,d:100});raw(g).jointSetMotorMaxForce(g.j.handle,3,5);const pre=pair(g);g.world.step();const post=pair(g),d=delta(pre,post),readout=raw(g).jointMotorImpulse(g.j.handle,3);
 const row={iterations,dt:g.world.timestep,bodyImpulse:d.bodyAngularImpulseZ[1],readout,bodyToReadoutSignedRatio:d.bodyAngularImpulseZ[1]/readout,capTimesFullDt:5*g.world.timestep,capTimesSubDt:5*g.world.timestep/iterations};calibration.push(row);near(d.totalAngularImpulseZ,0);assert.ok(Math.abs(row.bodyImpulse)<=row.capTimesFullDt+TOL.impulse);assert.ok(Number.isFinite(row.bodyToReadoutSignedRatio));return row;
 }finally{g.world.free();}});
await test('disabled motor preserves free motion on the same handle; zero coefficients are measured separately',()=>{const base=make(R);try{
 configure(base,{pos:.2,vel:4});raw(base).jointSetMotorMaxForce(base.j.handle,3,50);base.world.step();base.a.setAngvel({x:0,y:0,z:-1.5},true);base.b.setAngvel({x:0,y:0,z:1.5},true);
 const snapshot=base.world.takeSnapshot(),handles={a:base.a.handle,b:base.b.handle,j:base.j.handle},results=[];
 for(const mode of ['disable','zeroCoefficients','remove']){const g=restore(snapshot,handles);try{
  const before=pair(g),s=structural(g),oldReadout=raw(g).jointMotorImpulse(g.j.handle,3);
  if(mode==='disable'){raw(g).jointSetMotorEnabled(g.j.handle,3,false);assert.equal(raw(g).jointMotorEnabled(g.j.handle,3),false);assert.deepEqual(structural(g),s);}
  if(mode==='zeroCoefficients'){g.j.configureMotor(0,0,0,0);assert.equal(raw(g).jointMotorEnabled(g.j.handle,3),true);assert.deepEqual(structural(g),s);}
  if(mode==='remove')g.world.removeImpulseJoint(g.j,true);
  g.world.step();const after=pair(g),d=delta(before,after),newReadout=mode==='remove'?null:raw(g).jointMotorImpulse(g.j.handle,3);
  if(mode!=='zeroCoefficients'){near(after[0].w.z,before[0].w.z);near(after[1].w.z,before[1].w.z);near(d.deltaK,0);}
  if(mode==='disable'){configure(g,{pos:0,vel:0});assert.equal(raw(g).jointMotorEnabled(g.j.handle,3),true);near(raw(g).jointMotorMaxForce(g.j.handle,3),50);}
  results.push({mode,before,after,...d,oldReadout,newReadout,disabledReadoutMustNotBeUsedAsCurrentImpulse:mode==='disable'});
 }finally{g.world.free();}}
 return {results,zeroCoeffEqualsDisabled:Math.abs(results[0].after[1].w.z-results[1].after[1].w.z)<TOL.body};
 }finally{base.world.free();}});
await test('limit reaction changes angular momentum while enabled zero-cap motor readout remains zero',()=>{const g=make(R,1/60);try{
 g.j.setLimits(-.01,.01);configure(g,{pos:1,vel:20});raw(g).jointSetMotorMaxForce(g.j.handle,3,0);g.a.setAngvel({x:0,y:0,z:-5},true);g.b.setAngvel({x:0,y:0,z:5},true);
 const trace=[];for(let i=0;i<12;i++){const pre=pair(g);g.world.step();const post=pair(g),d=delta(pre,post),motor=raw(g).jointMotorImpulse(g.j.handle,3);near(motor,0);near(d.totalAngularImpulseZ,0);trace.push({step:i,...d,motor});}
 assert.ok(trace.some(x=>Math.abs(x.bodyAngularImpulseZ[1])>.01),'Fixture must exercise a native angular limit');return {trace,limitResponseNotMotorImpulse:true};
 }finally{g.world.free();}});
if(args.baseline)await test('unmodified simple native fixture: installed npm versus rebuilt engine motion comparison',async()=>{const m=await import(url(args.baseline)),old=m.default?.World?m.default:m;await old.init();
 function trace(api){const g=make(api);try{g.j.configureMotorModel(api.MotorModel.ForceBased);g.j.configureMotor(.2,4,1600,100);const out=[];for(let i=0;i<24;i++){g.world.step();out.push(pair(g));}return out;}finally{g.world.free();}}
 const a=trace(old),b=trace(R);let maxOmegaDifference=0,maxPositionDifference=0;for(let i=0;i<a.length;i++)for(let j=0;j<2;j++)for(const k of ['x','y','z']){maxOmegaDifference=Math.max(maxOmegaDifference,Math.abs(a[i][j].w[k]-b[i][j].w[k]));maxPositionDifference=Math.max(maxPositionDifference,Math.abs(a[i][j].p[k]-b[i][j].p[k]));}
 return {baselineVersion:old.version?.(),rebuiltVersion:R.version?.(),baselineMotionSHA256:hash(JSON.stringify(a)),rebuiltMotionSHA256:hash(JSON.stringify(b)),exact:JSON.stringify(a)===JSON.stringify(b),maxOmegaDifference,maxPositionDifference,interpretation:'A difference alone is not an engine bug; compiler/toolchain changes may alter Float32 motion.'};
});
const sourceAfter=hash(await readFile(new URL(import.meta.url)));
const moduleSourceAfter=hash(await readFile(new URL(url(modulePath))));
const result={schema:1,modulePath,moduleSourceBefore,moduleSourceAfter,moduleSourceStable:moduleSourceBefore===moduleSourceAfter,rapierVersion:R.version?.(),createdUTC:new Date().toISOString(),sourceBefore,sourceAfter,sourceStable:sourceBefore===sourceAfter,tolerances:TOL,
 scope:'Per-axis native motor bound on a 2-dynamic-body isotropic COM revolute pair. No gravity/contact/body damping/sleep; 6 kg one-metre cube gives each I=1. Numeric engineering diagnostics, not human strength, vector torque norm, gravity feedforward or whole-body recovery evidence.',
 readoutInterpretation:'Signed writeback is preserved raw. Compare calibration across solverIterations to distinguish whole-step from final substep; disabled values may be stale. Delta body momentum includes limits when enabled; motor readout excludes limit impulses.',tests,rows,readoutCalibration:calibration};
result.pass=result.sourceStable&&result.moduleSourceStable&&tests.every(x=>x.pass);await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output,pass:result.pass,tests:tests.length,failed:tests.filter(x=>!x.pass).map(x=>x.name),readoutCalibration:calibration}));process.exitCode=result.pass?0:1;
