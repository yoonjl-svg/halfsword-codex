/** Opt-in observers for actual Rapier calls. No forces, solver settings, or mass recomputation.
 * installForceLedger(G, {fighters:[G.player]}) wraps G.step/world.step; restore() uninstalls.
 * Angular momentum/torque use the fixed world origin (options.origin). LCOM is also reported.
 * Work is midpoint-in-time quadrature of the stored world force/COM torque, NOT native motor work.
 *
 * const ledger = installForceLedger(G, {fighters:[G.player], maxSamples:32, sampleEvery:8});
 * G.step();
 * ledger.latest.physics[0]: {pre, post, dt, forceBook, balance, contactsRaw}
 * ledger.latest: {preGame, postGame, operations, balance} includes post-physics Combat impulses/overrides.
 * ledger.summary(): cumulative totals + byPath net-wrench magnitude mean/RMS/max over ALL physics steps.
 * ledger.samples: retained sampled frames only; latest is refreshed every step regardless of sampleEvery.
 * ledger.snapshot(): current selected dynamic-body state; ledger.restore(): remove observers idempotently.
 * Force/torque units N/Nm; impulses Ns/Nms; P kg m/s; L kg m^2/s; K,V,work J; power W.
 * Each path's body entries retain signed work and reactions. Internal/external status is NOT inferred
 * from method names: net sums must be interpreted using the chosen boundary and application bodies.
 * User-accumulator forces are authoritative; float rounding/unattributed bookkeeping differences are explicit.
 * Mass requests never trigger recomputation here; changed mass/COM/principal I or membership invalidates
 * a fixed-mass balance. Native motor/contact/upright residuals and approximate energy residuals are not errors.
 */
import * as THREE from 'three';
const INSTALLED=Symbol.for('stillness.forceLedger');
const z=()=>({x:0,y:0,z:0});
const v=a=>({x:a.x,y:a.y,z:a.z});
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const mul=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const norm=a=>Math.hypot(a.x,a.y,a.z);
const clone=a=>a==null?a:Array.isArray(a)?a.map(clone):typeof a==='object'?Object.fromEntries(Object.entries(a).filter(([,x])=>typeof x!=='function').map(([k,x])=>[k,clone(x)])):a;
const qcopy=q=>({x:q.x,y:q.y,z:q.z,w:q.w});
const id=b=>String(b.handle);
function tensor(b){
 const I=b.principalInertia(),frame=new THREE.Quaternion().copy(b.rotation()).multiply(new THREE.Quaternion().copy(b.principalInertiaLocalFrame()));
 const R=new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(frame));
 const W=R.clone().multiply(new THREE.Matrix3().set(I.x,0,0,0,I.y,0,0,0,I.z)).multiply(R.clone().transpose());
 return {principal:v(I),localFrame:qcopy(b.principalInertiaLocalFrame()),world:[...W.elements]}; // column-major
}
function mv(M,x){return {x:M[0]*x.x+M[3]*x.y+M[6]*x.z,y:M[1]*x.x+M[4]*x.y+M[7]*x.z,z:M[2]*x.x+M[5]*x.y+M[8]*x.z};}
function bodyState(b,meta={},origin=z(),gravity=z()){
 const mass=b.mass(),com=v(b.worldCom()),velocity=v(b.linvel()),omega=v(b.angvel()),I=tensor(b),P=mul(velocity,mass),spin=mv(I.world,omega),L=add(spin,cross(sub(com,origin),P));
 return {handle:id(b),...meta,mass,com,localCom:v(b.localCom()),position:v(b.translation()),rotation:qcopy(b.rotation()),velocity,omega,inertia:I,
  effectiveInvMass:v(b.effectiveInvMass()),gravityScale:b.gravityScale(),linearDamping:b.linearDamping(),angularDamping:b.angularDamping(),sleeping:b.isSleeping(),
  P,L,spinL:spin,Ktranslation:.5*mass*dot(velocity,velocity),Krotation:.5*dot(omega,spin),K:.5*mass*dot(velocity,velocity)+.5*dot(omega,spin),
  V:-mass*b.gravityScale()*dot(gravity,sub(com,origin)),userForce:v(b.userForce()),userTorque:v(b.userTorque())};
}
function sumStates(bodies,origin){
 let mass=0,weighted=z(),P=z(),L=z(),K=0,V=0,Ktranslation=0,Krotation=0;
 for(const b of bodies){mass+=b.mass;weighted=add(weighted,mul(b.com,b.mass));P=add(P,b.P);L=add(L,b.L);K+=b.K;V+=b.V;Ktranslation+=b.Ktranslation;Krotation+=b.Krotation;}
 const COM=mass?mul(weighted,1/mass):z();
 return {mass,COM,P,L,LaboutCOM:sub(L,cross(sub(COM,origin),P)),K,Ktranslation,Krotation,V,E:K+V,bodyCount:bodies.length};
}
function propertyChanges(a,b){
 const A=new Map(a.bodies.map(x=>[x.handle,x])),B=new Map(b.bodies.map(x=>[x.handle,x])),changes=[];
 for(const key of new Set([...A.keys(),...B.keys()])){
  const x=A.get(key),y=B.get(key);
  if(!x||!y){changes.push({handle:key,label:(x||y).label,kind:x?'leftBoundary':'enteredBoundary',beforeMass:x?.mass??0,afterMass:y?.mass??0});continue;}
  if(x.mass!==y.mass||JSON.stringify(x.localCom)!==JSON.stringify(y.localCom)||JSON.stringify(x.inertia.principal)!==JSON.stringify(y.inertia.principal)||JSON.stringify(x.inertia.localFrame)!==JSON.stringify(y.inertia.localFrame))changes.push({handle:key,label:y.label,kind:'massPropertiesChanged',beforeMass:x.mass,afterMass:y.mass,beforeLocalCOM:x.localCom,afterLocalCOM:y.localCom,beforePrincipalI:x.inertia.principal,afterPrincipalI:y.inertia.principal});
 }
 return changes;
}
/** Read-only state utility. If bodies is omitted, includes every current dynamic rigid body. */
export function snapshotWorld(world,{bodies,origin=z(),metadata=()=>({})}={}){
 const selected=bodies??(()=>{const xs=[];world.forEachRigidBody(b=>{if(b.isDynamic())xs.push(b);});return xs;})();
 const records=[...selected].filter(b=>b.isValid()&&b.isDynamic()).map(b=>bodyState(b,metadata(b),origin,world.gravity));
 return {origin:v(origin),angularReference:'fixedWorldOrigin',gravity:v(world.gravity),bodies:records,total:sumStates(records,origin)};
}

export function installForceLedger(G,options={}){
 if(!G?.world||typeof G.step!=='function')throw new TypeError('Requires {world, step}; existing harness G is supported.');
 if(G[INSTALLED]||G.world[INSTALLED])throw new Error('Force ledger is already installed on this game/world.');
 const world=G.world,origin=v(options.origin||z()),maxSamples=options.maxSamples??600,sampleEvery=options.sampleEvery??1;
 if(!Number.isInteger(sampleEvery)||sampleEvery<1||!Number.isInteger(maxSamples)||maxSamples<0)throw new RangeError('sampleEvery>=1, maxSamples>=0 must be integers.');
 const fighters=[...new Set([G.player,G.enemy,...(options.fighters||[])].filter(Boolean))],selectedOwners=options.fighters?new Set(options.fighters):null;
 const selectedHandles=options.bodies?new Set([...options.bodies].map(b=>String(typeof b==='object'?b.handle:b))):null;
 const bodyMeta=new Map(),books=new Map(),restorers=[],warnings=[],stack=[],samples=[],pending=[],knownBodies=new Map(),observedMethods=new WeakMap();
 let frame=null,phase='idle',restored=false,index=0,lastEnd=null,latest=null;
 const totals={frames:0,physicsSteps:0,explicitForceImpulse:z(),gravityImpulse:z(),explicitAngularImpulse:z(),gravityAngularImpulse:z(),directImpulse:z(),directAngularImpulse:z(),forceWorkApproxJ:0,gravityWorkApproxJ:0,impulseDeltaKJ:0,stateOverrideDeltaKJ:0,massChangingFrames:0,velocityOverrideCalls:0,residualP:z(),residualL:z(),energyResidualApproxJ:0,byPath:{},maxForceBookMismatch:0};
 const ownership=()=>{
  for(const f of fighters){
   const owner=f.index??f.name??'fighter';
   for(const {rb,kind} of f.meshes||[])bodyMeta.set(id(rb),{owner,ownerName:f.name,label:`${owner}:${kind||'mesh'}:${id(rb)}`,ownerObject:f});
   for(const [part,b] of Object.entries(f.bodies||{}))bodyMeta.set(id(b),{owner,ownerName:f.name,label:`${owner}:${part}`,part,detached:!!f.detachedParts?.has(part),ownerObject:f});
   if(f.sword)bodyMeta.set(id(f.sword),{owner,ownerName:f.name,label:`${owner}:sword`,part:'sword',ownerObject:f});
   if(f.anchor)bodyMeta.set(id(f.anchor),{owner,ownerName:f.name,label:`${owner}:kinematicAnchor`,ownerObject:f});
  }
 };
 const metadata=b=>{const m=bodyMeta.get(id(b))||{owner:null,label:`unowned:${id(b)}`};const {ownerObject,...publicMeta}=m;return {...publicMeta,colliderCount:b.numColliders(),colliderMasses:Array.from({length:b.numColliders()},(_,i)=>({handle:String(b.collider(i).handle),mass:b.collider(i).mass(),kind:G.combat?.info?.get(b.collider(i).handle)?.kind??null}))};};
 const included=b=>b.isValid()&&b.isDynamic()&&(!selectedHandles||selectedHandles.has(id(b)))&&(!selectedOwners||selectedOwners.has(bodyMeta.get(id(b))?.ownerObject))&&(!options.bodyFilter||options.bodyFilter(b,metadata(b)));
 const snapshot=()=>{ownership();const bodies=[];world.forEachRigidBody(b=>{if(included(b))bodies.push(b);});return snapshotWorld(world,{bodies,origin,metadata});};
 const label=()=>stack.length?stack.map(x=>x.label).join(' > '):'external/unlabelled';
 const push=event=>{event.phase=phase;event.path=label();if(frame)frame.operations.push(event);else pending.push(event);};
 function replace(obj,name,make){
  if(typeof obj[name]!=='function')return;
  const own=Object.getOwnPropertyDescriptor(obj,name),original=obj[name],wrapped=make(original);
  obj[name]=wrapped;
  restorers.push(()=>{if(obj[name]!==wrapped){warnings.push(`Not restored: ${name} was replaced by another observer.`);return;}if(own)Object.defineProperty(obj,name,own);else delete obj[name];});
 }
 function pathMethods(obj,prefix,ownerObject){
  if(!obj)return;
  const names=new Set();let proto=Object.getPrototypeOf(obj);
  while(proto&&proto!==Object.prototype){for(const n of Object.getOwnPropertyNames(proto))if(n!=='constructor'&&typeof Object.getOwnPropertyDescriptor(proto,n)?.value==='function')names.add(n);proto=Object.getPrototypeOf(proto);}
  const methods=new Map();observedMethods.set(obj,methods);
  for(const name of names)replace(obj,name,original=>{
   const entry={dispatch:{implementation:original},wrapper:null};
   entry.wrapper=function(...args){stack.push({label:`${prefix}.${name}`,ownerObject});try{return entry.dispatch.implementation.apply(this,args);}finally{stack.pop();}};
   methods.set(name,entry);return entry.wrapper;
  });
 }
 // Change only a labelled method's implementation; its observer and path stay installed.
 // Undo is LIFO for each method and is valid only while this ledger still owns the wrapper.
 function replaceObservedMethod(obj,name,implementation){
  function current(){
   if(restored)throw new Error('Force ledger has been restored');
   if(frame||phase!=='idle'||stack.length)throw new Error('Observed methods may only be replaced while idle');
   const entry=observedMethods.get(obj)?.get(name);
   if(!entry)throw new Error(`Unknown observed method: ${String(name)}`);
   if(obj[name]!==entry.wrapper)throw new Error(`Observed wrapper is no longer current: ${String(name)}`);
   return entry;
  }
  const entry=current();
  if(typeof implementation!=='function'||implementation===entry.wrapper)throw new TypeError('Provide an implementation function, not the observer wrapper');
  const previous=entry.dispatch,replacement={implementation};entry.dispatch=replacement;
  let undone=false;
  return ()=>{
   const active=current();
   if(undone||active.dispatch!==replacement)throw new Error(`Observed method undo is no longer current: ${String(name)}`);
   active.dispatch=previous;undone=true;
  };
 }
 const addBook=(map,key,force)=>map.set(key,add(map.get(key)||z(),force));
 function observeBody(b){
  if(knownBodies.get(id(b))===b)return;knownBodies.set(id(b),b);
  books.set(id(b),{F:new Map([['preinstall/persistent',v(b.userForce())]]),T:new Map([['preinstall/persistent',v(b.userTorque())]])});
  for(const method of ['addForce','addForceAtPoint','addTorque','applyImpulse','applyImpulseAtPoint','applyTorqueImpulse','resetForces','resetTorques','setLinvel','setAngvel','setTranslation','setRotation','setNextKinematicTranslation','setNextKinematicRotation','setAdditionalMass','setAdditionalMassProperties','recomputeMassPropertiesFromColliders','setGravityScale'])replace(b,method,original=>function(...args){
   const dynamic=this.isDynamic(),meta=metadata(this),scope=included(this)?'included':'outside',key=id(this),book=books.get(key),path=label();
   const impulse=method.startsWith('apply'),override=['setLinvel','setAngvel','setTranslation','setRotation'].includes(method),detailed=(impulse||override)&&dynamic;
   const before=detailed?bodyState(this,meta,origin,world.gravity):null,com=v(this.worldCom()),point=method.endsWith('AtPoint')?v(args[1]):null,input=args[0]&&typeof args[0]==='object'?clone(args[0]):args[0];
   const value=original.apply(this,args); // same this, same argument identities/order, same result/throw
   const event={method,handle:key,label:meta.label,owner:meta.owner,scope,input,point,wakeUp:args.at(-1),com};
   if(method==='addForce'||method==='addForceAtPoint'){event.pointVelocityAtCall=v(this.velocityAtPoint(point||com));event.instantPowerAtCallW=dot(v(args[0]),event.pointVelocityAtCall);}
   if(method==='addTorque')event.instantPowerAtCallW=dot(v(args[0]),v(this.angvel()));
   if(method==='resetForces')book.F.clear();
   else if(method==='resetTorques')book.T.clear();
   else if(method==='addForce'||method==='addForceAtPoint'){addBook(book.F,path,v(args[0]));if(point)addBook(book.T,path,cross(sub(point,com),v(args[0])));}
   else if(method==='addTorque')addBook(book.T,path,v(args[0]));
   if(impulse){event.kind='explicitImpulse';event.J=method==='applyTorqueImpulse'?z():v(args[0]);event.angularImpulse=method==='applyTorqueImpulse'?v(args[0]):cross(sub(point||com,origin),v(args[0]));}
   if(override)event.kind='stateOverride';
   if(method.includes('Mass')||method==='setGravityScale')event.kind='massOrGravityPropertyRequest';
   if(before){const after=bodyState(this,meta,origin,world.gravity);event.deltaP=sub(after.P,before.P);event.deltaL=sub(after.L,before.L);event.deltaK=after.K-before.K;event.deltaV=after.V-before.V;event.deltaE=after.K+after.V-before.K-before.V;event.beforeVelocity=before.velocity;event.afterVelocity=after.velocity;event.beforeOmega=before.omega;event.afterOmega=after.omega;}
   push(event);return value;
  });
 }
 function forceBook(pre){
  return pre.bodies.map(state=>{
   const b=books.get(state.handle),paths=new Map();
   for(const [path,F] of b.F){const x=paths.get(path)||{path,F:z(),torqueCOM:z()};x.F=add(x.F,F);paths.set(path,x);}
   for(const [path,T] of b.T){const x=paths.get(path)||{path,F:z(),torqueCOM:z()};x.torqueCOM=add(x.torqueCOM,T);paths.set(path,x);}
   let F=z(),T=z();for(const x of paths.values()){F=add(F,x.F);T=add(T,x.torqueCOM);}
   const mismatchF=sub(state.userForce,F),mismatchT=sub(state.userTorque,T);
   if(norm(mismatchF)>1e-8||norm(mismatchT)>1e-8)paths.set('nativeUserAccumulator/roundingOrUnattributed',{path:'nativeUserAccumulator/roundingOrUnattributed',F:mismatchF,torqueCOM:mismatchT});
   return {handle:state.handle,label:state.label,F:state.userForce,torqueCOM:state.userTorque,torqueAboutOrigin:add(state.userTorque,cross(sub(state.com,origin),state.userForce)),byPath:[...paths.values()],mismatchF,mismatchT};
  });
 }
 function contactsRaw(dt){
  if(options.contacts===false)return [];
  const pairs=[],seen=new Set();world.forEachRigidBody(b=>{if(!included(b))return;for(let i=0;i<b.numColliders();i++){const c=b.collider(i);world.contactPairsWith(c,other=>{
   const key=[String(c.handle),String(other.handle)].sort().join(':');if(seen.has(key))return;seen.add(key);const a=c.parent(),bb=other.parent();
   world.contactPair(c,other,(m,flipped)=>{
    const impulses=[];for(let j=0;j<m.numContacts();j++)impulses.push({normalImpulseNs:m.contactImpulse(j),tangentImpulseXNs:m.contactTangentImpulseX(j),tangentImpulseYNs:m.contactTangentImpulseY(j),contactDist:m.contactDist(j)});
    const points=[];for(let j=0;j<m.numSolverContacts();j++){const p=v(m.solverContactPoint(j)),va=a?v(a.velocityAtPoint(p)):z(),vb=bb?v(bb.velocityAtPoint(p)):z();points.push({point:p,velocityA:va,velocityB:vb,horizontalSpeedA:Math.hypot(va.x,va.z),horizontalSpeedB:Math.hypot(vb.x,vb.z),contactDist:m.solverContactDist(j)});}
    const rawNormalImpulseNs=impulses.reduce((s,x)=>s+x.normalImpulseNs,0);
    pairs.push({colliderA:String(c.handle),colliderB:String(other.handle),bodyA:a?id(a):null,bodyB:bb?id(bb):null,labelA:a?metadata(a).label:null,labelB:bb?metadata(bb).label:null,aIncluded:!!a&&included(a),bIncluded:!!bb&&included(bb),normal:v(m.normal()),flipped,rawNormalImpulseNs,rawNormalForceN:rawNormalImpulseNs/dt,impulses,solverPoints:points,calibrationApplied:false,arrayCorrespondence:'Impulse entries and solver points are separate arrays; no index pairing.'});
   });
  });}});return pairs;
 }
 function segmentBook(pre,post,forces,dt){
  const after=new Map(post.bodies.map(b=>[b.handle,b])),paths={},netF=z();let J=z(),H=z(),Jg=z(),Hg=z(),work=0,gravityWork=0;
  for(const f of forces){
   const a=pre.bodies.find(b=>b.handle===f.handle),b=after.get(f.handle)||a,vmid=mul(add(a.velocity,b.velocity),.5),wmid=mul(add(a.omega,b.omega),.5),Fg=mul(pre.gravity,a.mass*a.gravityScale),Tg=cross(sub(a.com,origin),Fg);
   J=add(J,mul(f.F,dt));H=add(H,mul(f.torqueAboutOrigin,dt));Jg=add(Jg,mul(Fg,dt));Hg=add(Hg,mul(Tg,dt));work+=dt*(dot(f.F,vmid)+dot(f.torqueCOM,wmid));gravityWork+=dt*dot(Fg,vmid);
   for(const x of f.byPath){const p=paths[x.path]||={forceImpulse:z(),angularImpulse:z(),workApproxJ:0,bodies:{}};p.forceImpulse=add(p.forceImpulse,mul(x.F,dt));p.angularImpulse=add(p.angularImpulse,mul(add(x.torqueCOM,cross(sub(a.com,origin),x.F)),dt));const W=dt*(dot(x.F,vmid)+dot(x.torqueCOM,wmid));p.workApproxJ+=W;const q=p.bodies[f.label]||={forceImpulse:z(),torqueCOMImpulse:z(),angularImpulse:z(),workApproxJ:0};q.forceImpulse=add(q.forceImpulse,mul(x.F,dt));q.torqueCOMImpulse=add(q.torqueCOMImpulse,mul(x.torqueCOM,dt));q.angularImpulse=add(q.angularImpulse,mul(add(x.torqueCOM,cross(sub(a.com,origin),x.F)),dt));q.workApproxJ+=W;}
  }
  for(const p of Object.values(paths)){p.netForceN=mul(p.forceImpulse,1/dt);p.netTorqueAboutOriginNm=mul(p.angularImpulse,1/dt);p.meanPowerApproxW=p.workApproxJ/dt;}
  const changes=propertyChanges(pre,post),deltaP=sub(post.total.P,pre.total.P),deltaL=sub(post.total.L,pre.total.L),deltaK=post.total.K-pre.total.K,deltaE=post.total.E-pre.total.E;
  return {explicitForceImpulse:J,explicitAngularImpulse:H,gravityImpulse:Jg,gravityAngularImpulse:Hg,forceWorkApproxJ:work,gravityWorkApproxJ:gravityWork,byPath:paths,massPropertyChanges:changes,
   deltaP,deltaL,deltaK,deltaE,residualP:sub(deltaP,add(J,Jg)),residualL:sub(deltaL,add(H,Hg)),energyResidualApproxJ:deltaE-work,
   fixedMassBoundary:changes.length===0,unmeasured:['native joint/motor/upright constraint impulses and work','contact/friction/damping/CCD numerical effects','elastic storage not modelled'],workDefinition:'dt*(F dot midpoint COM velocity + torqueCOM dot midpoint angular velocity); approximate, not motor work'};
 }
 function begin(){if(frame)throw new Error('Nested game steps are not supported.');ownership();world.forEachRigidBody(observeBody);frame={index:index++,timeStart:G.t??null,origin,preGame:lastEnd,operations:pending.splice(0),physics:[]};phase='control';}
 function finish(){
  phase='postGame';const post=snapshot(),events=frame.operations.filter(e=>e.scope==='included'),impulses=events.filter(e=>e.kind==='explicitImpulse'),overrides=events.filter(e=>e.kind==='stateOverride');
  let J=z(),H=z(),Jg=z(),Hg=z(),W=0,Wg=0,Wi=0,overrideP=z(),overrideL=z(),overrideK=0;
  for(const s of frame.physics){const e=s.balance;J=add(J,e.explicitForceImpulse);H=add(H,e.explicitAngularImpulse);Jg=add(Jg,e.gravityImpulse);Hg=add(Hg,e.gravityAngularImpulse);W+=e.forceWorkApproxJ;Wg+=e.gravityWorkApproxJ;}
  let Ji=z(),Hi=z();for(const e of impulses){Ji=add(Ji,e.J);Hi=add(Hi,e.angularImpulse);Wi+=e.deltaK??0;}
  for(const e of overrides){overrideP=add(overrideP,e.deltaP??z());overrideL=add(overrideL,e.deltaL??z());overrideK+=e.deltaK??0;}
  const changes=propertyChanges(frame.preGame,post),deltaP=sub(post.total.P,frame.preGame.total.P),deltaL=sub(post.total.L,frame.preGame.total.L);
  const balance={deltaP,deltaL,deltaK:post.total.K-frame.preGame.total.K,deltaE:post.total.E-frame.preGame.total.E,explicitForceImpulse:J,explicitAngularImpulse:H,gravityImpulse:Jg,gravityAngularImpulse:Hg,directImpulse:Ji,directAngularImpulse:Hi,forceWorkApproxJ:W,gravityWorkApproxJ:Wg,impulseDeltaKJ:Wi,stateOverride:{deltaP:overrideP,deltaL:overrideL,deltaK:overrideK,calls:overrides.length},
   residualP:sub(deltaP,add(add(J,Jg),Ji)),residualL:sub(deltaL,add(add(H,Hg),Hi)),residualAfterStateOverridesP:sub(sub(deltaP,add(add(J,Jg),Ji)),overrideP),residualAfterStateOverridesL:sub(sub(deltaL,add(add(H,Hg),Hi)),overrideL),
   energyResidualApproxJ:post.total.E-frame.preGame.total.E-W-Wi,massPropertyChanges:changes,fixedMassBoundary:changes.length===0,residualInterpretation:'Unmeasured native constraint/contact/damping, state overrides, mass/membership changes and quadrature; not automatically engine error.'};
  frame.postGame=post;frame.balance=balance;frame.timeEnd=G.t??null;latest=frame;
  totals.frames++;for(const k of ['explicitForceImpulse','explicitAngularImpulse','gravityImpulse','gravityAngularImpulse','directImpulse','directAngularImpulse','residualP','residualL'])totals[k]=add(totals[k],balance[k]);
  for(const k of ['forceWorkApproxJ','gravityWorkApproxJ','impulseDeltaKJ','energyResidualApproxJ'])totals[k]+=balance[k];totals.stateOverrideDeltaKJ+=overrideK;totals.velocityOverrideCalls+=overrides.length;if(changes.length||frame.physics.some(s=>s.balance.massPropertyChanges.length))totals.massChangingFrames++;
  totals.physicsSteps+=frame.physics.length;
  for(const s of frame.physics)for(const [path,p] of Object.entries(s.balance.byPath)){
   const t=totals.byPath[path]||={forceImpulse:z(),angularImpulse:z(),workApproxJ:0,activePhysicsSteps:0,sumForceMagnitude:0,sumForceMagnitudeSquared:0,maxForceN:0,sumTorqueMagnitude:0,sumTorqueMagnitudeSquared:0,maxTorqueAboutOriginNm:0};
   t.forceImpulse=add(t.forceImpulse,p.forceImpulse);t.angularImpulse=add(t.angularImpulse,p.angularImpulse);t.workApproxJ+=p.workApproxJ;t.activePhysicsSteps++;
   const F=norm(p.netForceN),T=norm(p.netTorqueAboutOriginNm);t.sumForceMagnitude+=F;t.sumForceMagnitudeSquared+=F*F;t.maxForceN=Math.max(t.maxForceN,F);t.sumTorqueMagnitude+=T;t.sumTorqueMagnitudeSquared+=T*T;t.maxTorqueAboutOriginNm=Math.max(t.maxTorqueAboutOriginNm,T);
  }
  for(const s of frame.physics)for(const f of s.forceBook)totals.maxForceBookMismatch=Math.max(totals.maxForceBookMismatch,norm(f.mismatchF),norm(f.mismatchT));
  if(frame.index%sampleEvery===0&&maxSamples>0){samples.push(frame);if(samples.length>maxSamples)samples.shift();}
  lastEnd=post;frame=null;phase='idle';
 }
 ownership();world.forEachRigidBody(observeBody);
 for(const f of fighters){pathMethods(f,`fighter[${f.index??f.name}]`,f);pathMethods(f.gait,`gait[${f.index??f.name}]`,f);}
 pathMethods(G.combat,'combat',null);
 replace(world,'createRigidBody',original=>function(...args){const b=original.apply(this,args),ownerObject=[...stack].reverse().find(x=>x.ownerObject)?.ownerObject;if(ownerObject)bodyMeta.set(id(b),{owner:ownerObject.index??ownerObject.name,ownerName:ownerObject.name,label:`${ownerObject.index??ownerObject.name}:created:${id(b)}`,ownerObject});observeBody(b);push({kind:'bodyCreated',handle:id(b),label:metadata(b).label});return b;});
 replace(world,'removeRigidBody',original=>function(b,...args){push({kind:'bodyRemoved',handle:id(b),label:metadata(b).label,before:b.isDynamic()?bodyState(b,metadata(b),origin,world.gravity):null});return original.call(this,b,...args);});
 replace(world,'step',original=>function(...args){
  if(!frame)return original.apply(this,args); // automatic contract is G.step(), not arbitrary world stepping
  phase='prePhysics';const pre=snapshot(),forceRows=forceBook(pre),dt=this.timestep;phase='physics';let value;
  try{value=original.apply(this,args);}finally{phase='postPhysics';}
  const post=snapshot(),segment={dt,pre,post,forceBook:forceRows,balance:segmentBook(pre,post,forceRows,dt),contactsRaw:contactsRaw(dt)};frame.physics.push(segment);return value;
 });
 replace(G,'step',original=>function(...args){begin();try{const r=original.apply(this,args);finish();return r;}catch(e){warnings.push(`Step aborted: ${e.message}`);frame=null;phase='idle';throw e;}});
 lastEnd=snapshot();
 const initial=lastEnd;
 const boundary={mode:selectedHandles?'explicitBodies':selectedOwners?'selectedFighters':'allDynamic',origin,angularReference:'fixed world origin; LaboutCOM separately',initialBodies:initial.bodies.map(b=>({handle:b.handle,label:b.label,owner:b.owner,mass:b.mass,colliderMasses:b.colliderMasses})),
  included:'Selected dynamic rigid bodies, sword and armor collider mass counted once per body; loose dynamic bodies included according to owner/body selection.',excluded:'Fixed ground/walls and kinematic upright anchors, plus dynamic bodies outside the selection.',forceClassification:'Direct-body calls include internal reaction pairs and external helpers; byPath net sums and application-body entries preserve the distinction without guessing from method names.',nativeUnmeasured:'Impulse joint/motor/upright forces and work are not read. Contact impulses stay raw and are not used to close the residual; no 6/7 correction.',potentialDefinition:'V=-sum(m*gravityScale*g dot (worldCOM-origin)); uniform gravity, geometric potential zero at origin.'};
 const api={samples,boundary,snapshot,replaceObservedMethod,get latest(){return latest;},summary:()=>({boundary,initial:initial.total,final:lastEnd.total,totals:{...clone(totals),byPath:Object.fromEntries(Object.entries(totals.byPath).map(([path,p])=>[path,{...clone(p),meanForceMagnitudeN:p.sumForceMagnitude/(totals.physicsSteps||1),rmsForceN:Math.sqrt(p.sumForceMagnitudeSquared/(totals.physicsSteps||1)),meanTorqueMagnitudeNm:p.sumTorqueMagnitude/(totals.physicsSteps||1),rmsTorqueAboutOriginNm:Math.sqrt(p.sumTorqueMagnitudeSquared/(totals.physicsSteps||1)),statisticDefinition:'Magnitude mean/RMS across all observed physics steps, with zero for absent path; force/moment are net across selected bodies, work is signed.'}]))},retainedSamples:samples.length,sampleEvery,maxSamples,warnings:[...warnings],unmeasured:['native motor/constraint reactions','contact tangential impulse world basis/work','mass insertion/removal energy flux','spring potential and native damping work'],residualIsNotError:true}),restore(){if(restored)return;for(const f of restorers.reverse())f();delete G[INSTALLED];delete world[INSTALLED];restored=true;}};
 G[INSTALLED]=world[INSTALLED]=api;return api;
}
