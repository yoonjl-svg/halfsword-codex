// Actual game distance comparison; archived input tape, explicit impaired-leg fixture.
// No pose/velocity/wound/force injection. Frozen source is immutable; concurrent live edits are metadata.
// node tools/sim/experiments/opportunity_distance_20261009.mjs NEW_EXTERNAL_OUT [thrustGuard,aiThrustOpenLow|thrustGuardEstoc] [--models=v3,v4] [--gap=1.65] [--seeds=7]
// Default: four rows (rapier player + rapier AI, v3/v4, seed 7). No automatic sweep.
// Local cancellation/pause input contracts are separate; this native probe never invents browser pause events.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const out=process.argv[2];
const allowedOut=p=>p.startsWith('/workspace/halfsword-handoff/input-getup-range-20261009/')||/^\/tmp\/halfsword-distance-[^/]+(?:\/|$)/.test(p);
assert(out&&path.isAbsolute(out)&&path.resolve(out)===out&&allowedOut(out)&&!fs.existsSync(out),'fresh authorized external /workspace handoff or /tmp/halfsword-distance-* directory required');
const own='tools/sim/experiments/opportunity_distance_20261009.mjs';
const archive='/workspace/halfsword-handoff/followup-release-20261008/opportunity/run01';
const cases={thrustGuard:{weapon:'rapier',tap:true,guard:true},aiThrustOpenLow:{weapon:'rapier',ai:true,unarmed:true,lowHands:true},thrustGuardEstoc:{weapon:'estoc',tap:true,guard:true,tapeCase:'thrustGuard'}};
const selection=(process.argv[3]??'thrustGuard,aiThrustOpenLow').split(',');
assert(selection.length&&new Set(selection).size===selection.length&&selection.every(n=>cases[n]));
const flags=process.argv.slice(4);assert(flags.every(x=>/^--(?:seeds|models|gap|compact)=/.test(x)));
assert(new Set(flags.map(x=>x.split('=')[0])).size===flags.length,'duplicate flag');
const seeds=(flags.find(x=>x.startsWith('--seeds='))?.slice(8)??'7').split(',').map(Number);
assert(seeds.length&&new Set(seeds).size===seeds.length&&seeds.every(s=>Number.isInteger(s)&&s>0&&s<=0xffffffff));
const models=(flags.find(x=>x.startsWith('--models='))?.slice(9)??'v3,v4').split(',');
assert(models.length&&new Set(models).size===models.length&&models.every(m=>['v3','v4'].includes(m)));
const gapOption=flags.find(x=>x.startsWith('--gap=')),gapOverride=gapOption?Number(gapOption.slice(6)):null;
assert(gapOverride===null||Number.isFinite(gapOverride)&&gapOverride>0&&gapOverride<=10);
const compactOption=flags.find(x=>x.startsWith('--compact='))?.slice(10)??'true';
assert(['true','false'].includes(compactOption));
const compactFrames=compactOption==='true',seededNames=seeds.length>1||seeds[0]!==7;
const sha=x=>createHash('sha256').update(x).digest('hex');
const scan=p=>fs.readdirSync(path.join(root,p),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(p+'/'+e.name):e.name.endsWith('.js')?[p+'/'+e.name]:[]);
const testSources=fs.readdirSync(path.join(root,'tools/sim/experiments')).filter(n=>/^opportunity.*\.test\.mjs$/.test(n)).map(n=>'tools/sim/experiments/'+n);
const names=[...scan('src'),...testSources,own,'tools/sim/harness_m.mjs','tools/browser/input_lifecycle.test.mjs','package.json','package-lock.json'].sort();
const hashes=dir=>Object.fromEntries(names.map(n=>[n,fs.existsSync(path.join(dir,n))?sha(fs.readFileSync(path.join(dir,n))):null]));
const head=()=>execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const headBefore=head(),liveBeforeFreeze=hashes(root),frozen=fs.mkdtempSync('/tmp/halfsword-distance-source-');
fs.mkdirSync(out,{recursive:true});
// Hash the exact bytes written, instead of rejecting unrelated concurrent live edits.
const sourceBefore={};
for(const n of names){const bytes=fs.readFileSync(path.join(root,n));sourceBefore[n]=sha(bytes);const dest=path.join(frozen,n);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes,{flag:'wx'});}
fs.symlinkSync(path.join(root,'node_modules'),path.join(frozen,'node_modules'),'dir');
assert.deepEqual(hashes(frozen),sourceBefore,'frozen copy must match its own recorded bytes');
const liveAfterFreeze=hashes(root);
const write=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v)+'\n',{flag:'wx'});
const writeRow=(n,v)=>fs.writeFileSync(path.join(out,n),gzipSync(Buffer.from(JSON.stringify(v)+'\n'),{level:6}),{flag:'wx'});
const load=n=>import(pathToFileURL(path.join(frozen,n)).href);
const [{newRound,DT,CONFIG,THREE},{applySwordsmanship,recordSwordsmanshipInput},{configureCombatDefaults},{captureOpportunityPose,findOpportunity}]=await Promise.all([load('tools/sim/harness_m.mjs'),load('src/swordsmanship.js'),load('src/combat_defaults.js'),load('src/opportunity_target.js')]);
const enginePaths=['node_modules/@dimforge/rapier3d-compat/package.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const engineSHA=Object.fromEntries(enginePaths.filter(n=>fs.existsSync(path.join(root,n))).map(n=>[n,sha(fs.readFileSync(path.join(root,n)))]));
const protocol={headBefore,sourceBefore,sourceManifestSHA:sha(JSON.stringify(sourceBefore)),frozen,liveBeforeFreeze,liveAfterFreeze,engineSHA,argv:process.argv,selection,seeds,compactFrames,models,gapOverride,inputOrigin:archive,contracts:{requestVsStart:'A true thrust() result may accept a queued range request. Only a newly observed tap object counts as an actual thrust start; opportunity metadata distinguishes special starts.',followupInput:'Archive requests after an accepted request are retained and observed. No extra followup input injection.',pause:'Not exercised by this native loop. Browser pause/new-round reset and input-cancellation tests remain separate.',sourceSnapshot:'Frozen file and engine stability are required; concurrent live source/head changes are recorded but do not invalidate this run.'},settings:'Current common ordinary policy: player manual/current swordsmanship, linked both, low finish entry both, current weapon cut capability, power finish, gravity -9.81, sever ON. Only opportunityModel differs within each seed pair.',preparation:'Actual game newRound/step. Selected RNG seeds; every requested input reuses the archived seed7 off tape. Walls false; default gap 1.65, explicit --gap changes only normal newRound spawn separation. At tick240 victim leg controller health is set .2/.2 and knockDown(false), optional actual dropSword. This is a manufactured controller impairment/state preparation, not a wound or spontaneous duel. Player cases use passive enemy input. AI cases hold enemy AI passive until tick720 then call its original AI; player target remains scripted. No AI2, park, body transform/velocity injection, forced applyWound, or separate engine.',interpretation:'analyze is a contact calculation; onWound is an accepted callback; applyWound is directly intercepted with before/after health. Head-zone stab is not proof of a face stab. Command crossing is not native impact. Energy/ephys are game combat model outputs, not laboratory measurements. Same requested player tape does not mean identical AI output or human-input equivalence.'};
write('protocol.json',protocol);
const xyz=p=>p?[p.x,p.y,p.z]:null;
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o?.[k]!==undefined).map(k=>[k,o[k]]));
const plain=(v,depth=0)=>{if(v==null||typeof v!=='object')return v;if(depth>5)return '[depth omitted]';if(v.isVector3||v.isVector2||v.isQuaternion)return v.toArray();if(Array.isArray(v))return v.map(x=>plain(x,depth+1));return Object.fromEntries(Object.entries(v).filter(([k])=>!['foe','f','fighter','victim','world'].includes(k)).map(([k,x])=>[k,plain(x,depth+1)]));};
const compact=r=>plain(pick(r,['type','zone','energy','ephys','mFree','mEff','eff','thr','quality','speed','severity','pass','helmet','helmetBlunt','plate','t','finishingStrike','finishPower','finish','dir','bladeAxis','local']));
const health=f=>({state:f.state,alive:f.alive,armed:f.armed,armHealth:f.armHealth,blood:f.blood,pain:f.pain,balance:f.balance,wounds:f.wounds.length,limbs:{...f.limbs},headOff:!!f.headOff});
const nativeVelocity=(body,p)=>{const c=body.worldCom(),v=body.linvel(),w=body.angvel();return new THREE.Vector3(w.x,w.y,w.z).cross(new THREE.Vector3(p.x-c.x,p.y-c.y,p.z-c.z)).add(new THREE.Vector3(v.x,v.y,v.z));};
function blade(f){const base=f.bladePoint(0),tip=f.bladePoint(1),q=f.sword.rotation(),qq=new THREE.Quaternion(q.x,q.y,q.z,q.w),axis=new THREE.Vector3(0,1,0).applyQuaternion(qq),edge=new THREE.Vector3(1,0,0).applyQuaternion(qq),velocity=nativeVelocity(f.sword,tip);return{base:xyz(base),tip:xyz(tip),axis:xyz(axis),edge:xyz(edge),tipVelocity:xyz(velocity),tipSpeed:velocity.length(),cachedTipSpeed:f.tipVel.length()};}
function tap(f){const t=f.skill.tap;if(!t)return null;const K=t.K;return{...plain(pick(t,['t','h0','down','go','abort','head','bound','dir','K','opportunityPrecision','rangePrepared'])),stage:t.abort?'abort':t.t<K.aim?'aim':t.t<K.aim+K.extend?'extend':t.t<K.aim+K.extend+K.hold?'hold':'recover',opportunity:t.opportunity?plain(t.opportunity):null};}
const rangeView=skill=>skill?.thrustRange?plain(pick(skill.thrustRange,['phase','age','measure','target','reason','cancelReason','state','ready','started','episode'])):null;
const rangeDiagnostics=skill=>({lastThrustRange:plain(skill?.lastThrustRange??null),rangePose:skill?.rangePose?plain(pick(skill.rangePose,['age','measure'])):null,thrusts:skill?.thrusts??0});
function observation(f){const pose=captureOpportunityPose(f);return{health:health(f),chest:pose.chest,head:pose.head,neck:pose.neck,face:pose.face,blade:blade(f),hand:[f.handOffset.x,f.handOffset.y],handHeld:f.handHeld,inputActive:f.inputActive,handBase:plain(f.handBase),handTarget:xyz(f.handTarget),aimDir:xyz(f.aimDirW),baseHand:plain(f.swordsmanshipState?.baseHand),baseAim:plain(f.swordsmanshipState?.baseAim),thrustPush:f.skill.thrustPush,range:rangeView(f.skill),rangeDiagnostics:rangeDiagnostics(f.skill),tap:tap(f),opportunity:f.opportunityPlayer?plain(f.opportunityPlayer):null};}
function aiView(ai){return{range:plain(ai.opportunityRange??ai.me?.skill?.rangeAI??null),rangeReason:plain(pick(ai,['opportunityRangeCancelReason','opportunityRangeResult','opportunityRangeLast'])),...pick(ai,['mode','phase','why','chain']),tech:ai.tech?.name,state:plain(ai.opportunityState),attack:ai.opportunityAttack?plain(pick(ai.opportunityAttack,['zone','kind','started','target','observedAt','episode','padY','lateral','crossing','handY','pitch','precision','region','selection','candidate','distance'])):null};}
const rows=[];
for(const name of selection){
 const spec=cases[name], archivedPath=path.join(archive,(spec.tapeCase??name)+'-off.json'), archivedBytes=fs.readFileSync(archivedPath), archived=JSON.parse(archivedBytes), tape=archived.inputs;
 const tapeSHA=sha(JSON.stringify(tape)), expectedSteps=spec.ai?2160:1200;assert.equal(tape.length,expectedSteps);
 write(name+'-archive-receipt.json',{path:archivedPath,rawSHA:sha(archivedBytes),inputSHA:tapeSHA,steps:archived.steps,spawn:archived.spawn,oldModel:archived.model,changedWeapon:spec.tapeCase?spec.weapon:null,interpretation:spec.tapeCase?'Archived rapier requests only; estoc has different geometry/dynamics. Do not compare effect directly across weapons.':'Same archived scene requests.',oldSourceProtocol:path.join(archive,'protocol.json')});
 for(const seed of seeds)for(const model of models){
  const fileStem=seededNames?name+'-seed'+seed:name;
  const started=Date.now(), row={name,seed,model,gap:gapOverride??spec.gap??1.65,fileStem,compactFrames,expectedSteps,steps:0,nativeSteps:0,inputs:[],frames:[],analyses:[],accepted:[],applied:[],clashes:[],tapCalls:[],actualStarts:[],rangeEvents:[],preparation:[],error:null,archivedInputSHA:tapeSHA,archiveRawSHA:sha(archivedBytes)};
  rows.push(row);let G,tick=0,activeStrike=null,strikeSeq=0,eventSeq=0;const undo=[],counters={strike:0,analyze:0,applyWound:0,onWound:0,onClash:0,originalStrike:0,originalAnalyze:0,originalApplyWound:0,originalOnWound:0,originalOnClash:0};
  const resultIDs=new WeakMap(),seenTaps=new WeakMap();let nextTapId=0,lastRangeKey=null,lastRange=null,callContext='fighter-step';
  function noteStart(f,source){const tp=f.skill.tap;if(!tp||seenTaps.has(tp))return;const id=nextTapId++;seenTaps.set(tp,id);row.actualStarts.push({tick,timeS:G.t,attacker:f.index,id,source,special:!!tp.opportunity,down:!!tp.down,tap:tap(f),range:rangeView(f.skill),ai:spec.ai?aiView(G.ai):null});}
  function noteRange(att){const range=rangeView(att.skill),aiRange=spec.ai?plain(G.ai.opportunityRange??att.skill.rangeAI??null):null,diagnostics=rangeDiagnostics(att.skill);const key=JSON.stringify({phase:range?.phase??null,reason:range?.reason??range?.cancelReason??null,aiPhase:aiRange?.phase??null,lastThrustRange:diagnostics.lastThrustRange,thrusts:diagnostics.thrusts});if(key!==lastRangeKey){row.rangeEvents.push({tick,timeS:G.t,range,aiRange,diagnostics,previousRange:lastRange,interpretation:!range&&lastRange?'Queue ended; only explicit diagnostics establish cancellation reason. Check actualStarts separately.':null});lastRangeKey=key;}lastRange=range;}
  function wrap(obj,key,make){const had=Object.hasOwn(obj,key),descriptor=Object.getOwnPropertyDescriptor(obj,key),original=obj[key];obj[key]=make(original);undo.push(()=>{if(had)Object.defineProperty(obj,key,descriptor);else delete obj[key];assert.equal(obj[key],original);});}
  function action(att){const ai=spec.ai&&att===G.enemy?G.ai:null,a=ai?.opportunityAttack,t=att.skill.tap,p=att.opportunityPlayer;return{role:att.index===(spec.ai?1:0)?'designated-attacker':'other',actualSpecialTap:!!t?.opportunity,phase:ai?(t?.opportunity?'special-tap':a?.started?'special':a?'preparation':ai.opportunityState?.attempts>=2?'ordinary-after-budget':'ordinary'):t?.opportunity?'special-tap':p?.phase==='committed'?'special-cut':p?.phase==='releasing'?'special-followthrough':p?`preparation-${p.phase}`:'ordinary',kind:a?.kind??t?.opportunity?.kind??p?.kind,selectedZone:a?.zone??t?.opportunity?.zone??p?.zone,target:plain(a?.target??t?.opportunity?.target??p?.target),episode:a?.episode??ai?.opportunityState?.episode,attempt:ai?.opportunityState?.attempts,tech:ai?.tech?.name,tap:tap(att)};}
  function event(){return{seq:eventSeq++,tick,timeS:G.t,postTimeS:G.t+DT,strikeId:activeStrike?.id??null};}
  try{
   assert.deepEqual(hashes(frozen),sourceBefore,'frozen source changed before row');
   G=newRound({seed,weapon:spec.ai?'longsword':spec.weapon,weapon2:spec.ai?spec.weapon:'longsword',gap:row.gap,walls:false,onFighter:f=>{f.armSupportModel='linked';f.finishEntryModel='low';f.opportunityModel=model;if(f.index===0){f.onehandArmModel='manual';const p=configureCombatDefaults({active:true},f.weapon);f.stanceMemoryModel=p.stance;f.rollTargetModel=p.roll;}}});
   const f=G.player,e=G.enemy,att=spec.ai?e:f,vic=spec.ai?f:e,C=G.combat;
   applySwordsmanship(f);f.canShove=true;C.cutReactionModel=configureCombatDefaults({active:true},f.weapon).cut;C.cutReactionFighter=f;C.finishRuleModel='power';C.finishRuleFighter=null;
   assert(CONFIG.COMBAT.limbSeverTrial);assert.equal(CONFIG.PHYSICS.gravity,-9.81);
   row.spawn=sha(G.world.takeSnapshot());row.oldSpawnExact=row.spawn===archived.spawn;
   row.initCommon=[f,e].map(x=>({index:x.index,weapon:x.weapon.id,skill:x.skill.level,onehandArmModel:x.onehandArmModel,armSupportModel:x.armSupportModel,finishEntryModel:x.finishEntryModel,stanceMemoryModel:x.stanceMemoryModel,rollTargetModel:x.rollTargetModel,hand:xyz(x.handOffset),state:x.state,health:health(x),swordsmanship:plain(x.swordsmanshipState)}));
   wrap(G.ai,'update',original=>function(dt){const before=callContext;callContext='ai-update';try{return !spec.ai||tick<720?e.move.set(0,0):original.call(this,dt);}finally{callContext=before;}});
   wrap(att.skill,'thrust',original=>function(...args){const before=tap(att),rangeBefore=rangeView(this),prior=!!this.tap,accepted=original.apply(this,args);noteStart(att,'thrust-call');row.tapCalls.push({tick,timeS:G.t,attacker:att.index,origin:callContext,accepted:!!accepted,before,after:tap(att),rangeBefore,rangeAfter:rangeView(this),queued:!!accepted&&!this.tap&&!!this.thrustRange,immediateStart:!prior&&!!this.tap,diagnostics:rangeDiagnostics(this)});return accepted;});
   wrap(G.world,'step',original=>function(...args){row.nativeSteps++;return original.apply(this,args);});
   wrap(C,'strike',original=>function(pr,p,passing){counters.strike++;const previous=activeStrike;activeStrike={id:strikeSeq++,attacker:pr.w.fighter.index,victim:pr.v.fighter.index,part:pr.v.part,point:xyz(p),passing,action:action(pr.w.fighter)};try{counters.originalStrike++;return original.call(this,pr,p,passing);}finally{activeStrike=previous;}});
   wrap(C,'analyze',original=>function(pr,p,S,P,pred=false){counters.analyze++;counters.originalAnalyze++;const r=original.call(this,pr,p,S,P,pred);if(!pred&&pr.w.fighter===att){const vAt=s=>p.clone().sub(s.com).cross(s.w).negate().add(s.v),relative=vAt(S).sub(vAt(P)),axis=new THREE.Vector3(0,1,0).applyQuaternion(S.q),edge=new THREE.Vector3(1,0,0).applyQuaternion(S.q),perp=relative.clone().addScaledVector(axis,-relative.dot(axis)),head=vic.bodies.head,ht=head.translation(),hq=head.rotation(),headLocal=p.clone().sub(new THREE.Vector3(ht.x,ht.y,ht.z)).applyQuaternion(new THREE.Quaternion(hq.x,hq.y,hq.z,hq.w).invert());const ev={...event(),id:row.analyses.length,attacker:att.index,victim:pr.v.fighter.index,part:pr.v.part,point:xyz(p),headLocal:xyz(headLocal),action:action(att),result:r?compact(r):null,preSolverGeometry:{relativeVelocity:xyz(relative),along:relative.length()>0?relative.dot(axis)/relative.length():null,edgeAlign:perp.length()>0?Math.abs(perp.dot(edge))/perp.length():0,axis:xyz(axis),edge:xyz(edge)}};row.analyses.push(ev);if(r)resultIDs.set(r,ev.id);}return r;});
   for(const victim of [f,e])wrap(victim,'applyWound',original=>function(h){counters.applyWound++;const before=health(this),ev={...event(),victim:this.index,attacker:activeStrike?.attacker??null,action:activeStrike?.action??null,part:h.part,passing:h.passing,result:compact(h),before};counters.originalApplyWound++;const r=original.call(this,h);ev.after=health(this);row.applied.push(ev);return r;});
   wrap(C.hooks,'onWound',original=>function(a,v,r,p,pr){counters.onWound++;row.accepted.push({...event(),analysisId:resultIDs.get(r)??null,attacker:a.index,victim:v.index,part:pr?.v?.part,point:xyz(p),action:action(a),result:compact(r)});counters.originalOnWound++;return original.call(this,a,v,r,p,pr);});
   wrap(C.hooks,'onClash',original=>function(p,speed,info){counters.onClash++;row.clashes.push({...event(),point:xyz(p),speed,info:plain(info),actions:[action(f),action(e)]});counters.originalOnClash++;return original.call(this,p,speed,info);});
   G.before=()=>{
    if(tick===240){const before=health(vic);vic.limbs.legF=.2;vic.limbs.legB=.2;vic.knockDown(false);if(spec.unarmed)vic.dropSword();row.preparation.push({tick,timeS:G.t,before,after:health(vic),actualDrop:!!spec.unarmed});}
    const req=tape[tick];row.inputs.push(req);f.move.set(0,0);f.stickX=f.stickY=0;f.handHeld=req.active;f.inputActive=req.active;f.handOffset.x+=req.dx;f.handOffset.y+=req.dy;const len=f.handOffset.length();if(len>.62)f.handOffset.multiplyScalar(.62/len);
    recordSwordsmanshipInput(f,{id:tick,timeS:G.t,dx:req.dx,dy:req.dy,held:req.active,active:req.active});
    if(!spec.ai&&spec.guard){e.handOffset.set(.02,.4);e.inputActive=false;e.handHeld=true;}
    if(req.tap){const before=callContext;callContext='archive-request';try{f.skill.thrust();}finally{callContext=before;}}
   };
   for(tick=0;tick<expectedSteps;tick++){
    G.step();row.steps++;noteStart(att,'step');noteRange(att);
    let opening=null;if(att.alive&&vic.alive)opening=findOpportunity(att,captureOpportunityPose(vic),spec.tap?'thrust':att.weaponCfg.edged?'cut':'blunt');
    const ai=spec.ai?aiView(G.ai):null;
    row.frames.push(compactFrames?{tick,timeS:G.t,native:sha(G.world.takeSnapshot()),att:{health:health(att),chest:xyz(att.bodies.chest.translation()),blade:blade(att),tap:tap(att),range:rangeView(att.skill),rangeDiagnostics:rangeDiagnostics(att.skill),move:[att.move.x,att.move.y]},vic:{health:health(vic),chest:xyz(vic.bodies.chest.translation()),head:xyz(vic.bodies.head.translation()),headRadius:captureOpportunityPose(vic).headRadius},eligible:!!opening,ai:ai?{phase:ai.phase,tech:ai.tech,state:ai.state,range:ai.range,rangeReason:ai.rangeReason,attack:ai.attack?pick(ai.attack,['zone','kind','started','episode','target','observedAt','region','selection','candidate','distance']):null}:null}:{tick,timeS:G.t,native:sha(G.world.takeSnapshot()),att:observation(att),vic:observation(vic),eligible:!!opening,target:opening?{zone:opening.zone,point:xyz(opening.target)}:null,ai});
    assert([f,e].every(x=>x.meshes.every(({rb})=>[rb.translation(),rb.rotation(),rb.linvel(),rb.angvel()].every(v=>Object.values(v).every(Number.isFinite)))),'nonfinite native state');
   }
   row.final={attacker:health(att),victim:health(vic),clashes:G.clashes,aiStats:spec.ai?plain(G.ai.stats):null};
  }catch(error){row.error=error.stack;}finally{
   try{for(const restore of undo.reverse())restore();row.wrappersRestored=true;}catch(error){row.restorationError=error.stack;}
   try{G?.eventQueue.free();G?.world.free();}catch(error){row.cleanupError=error.stack;}
  }
  row.counters=counters;row.wallSeconds=(Date.now()-started)/1000;row.inputSHA=sha(JSON.stringify(row.inputs));
  row.oldFirstNativeDifference=row.frames.findIndex((f,i)=>f.native!==archived.frames[i]?.native);
  row.summary={steps:row.steps,nativeSteps:row.nativeSteps,eligibleSteps:row.frames.filter(f=>f.eligible).length,accepted:row.accepted.length,applied:row.applied.length,analyses:row.analyses.length,clashes:row.clashes.length,tapCalls:row.tapCalls.map(x=>({tick:x.tick,attacker:x.attacker,origin:x.origin,accepted:x.accepted,queued:x.queued,immediateStart:x.immediateStart,selectedZone:x.after?.opportunity?.zone,precision:!!x.after?.opportunityPrecision})),acceptedRequests:row.tapCalls.filter(x=>x.accepted&&x.origin!=='fighter-step').length,queuedRequests:row.tapCalls.filter(x=>x.queued&&x.origin!=='fighter-step').length,actualThrustStarts:row.actualStarts,actualSpecialStarts:row.actualStarts.filter(x=>x.special),rangeEvents:row.rangeEvents,final:row.final,wallSeconds:row.wallSeconds,error:row.error};
  const designated=spec.ai?1:0,isSpecial=a=>a&&['special','special-tap','special-cut','special-followthrough'].includes(a.phase);
  row.summary.specialAccepted=row.accepted.filter(e=>e.attacker===designated&&isSpecial(e.action));
  row.summary.specialApplied=row.applied.filter(e=>e.attacker===designated&&isSpecial(e.action));
  row.summary.ordinaryAfterBudget=row.accepted.filter(e=>e.attacker===designated&&e.action?.phase==='ordinary-after-budget');
  row.summary.aiSpecialStarts=row.frames.filter((f,i)=>f.ai?.attack?.started&&(!row.frames[i-1]?.ai?.attack?.started||f.ai.attack.episode!==row.frames[i-1].ai.attack.episode)).map(f=>({tick:f.tick,attack:f.ai.attack,state:f.ai.state}));
  row.summary.specialHeadNeckApplied=row.summary.specialApplied.filter(e=>e.result?.type==='stab'&&['head','neck'].includes(e.result.zone));
  row.summary.explicitRangeCancellations=row.rangeEvents.filter(e=>e.diagnostics?.lastThrustRange?.phase==='cancelled'&&e.diagnostics.lastThrustRange.reason!=='committed');
  writeRow(fileStem+'-'+model+'.json.gz',row);
  console.log(JSON.stringify({name,seed,model,gap:row.gap,steps:row.steps,nativeSteps:row.nativeSteps,acceptedRequests:row.summary.acceptedRequests,queuedRequests:row.summary.queuedRequests,actualStarts:row.actualStarts.length,actualSpecialStarts:row.summary.actualSpecialStarts.length,specialApplied:row.summary.specialApplied.map(e=>({tick:e.tick,zone:e.result.zone,type:e.result.type,energy:e.result.energy,woundDelta:e.after.wounds-e.before.wounds})),specialHeadNeckApplied:row.summary.specialHeadNeckApplied.length,rangeTransitions:row.rangeEvents.length,explicitRangeCancellations:row.summary.explicitRangeCancellations.length,wallSeconds:row.wallSeconds,error:row.error}));
 }
}
const sourceAfter=hashes(root),frozenAfter=hashes(frozen),headAfter=head();
const same=a=>JSON.stringify(a)===JSON.stringify(sourceBefore),sourceStable=same(frozenAfter);
const liveConcurrentChanges=names.filter(n=>liveBeforeFreeze[n]!==sourceAfter[n]).map(n=>({path:n,before:liveBeforeFreeze[n],frozen:sourceBefore[n],after:sourceAfter[n]}));
const engineAfter=Object.fromEntries(enginePaths.filter(n=>fs.existsSync(path.join(root,n))).map(n=>[n,sha(fs.readFileSync(path.join(root,n)))]));
const engineStable=JSON.stringify(engineAfter)===JSON.stringify(engineSHA);
const comparisons=[];for(let i=0;i<rows.length;i+=models.length){const group=rows.slice(i,i+models.length),a=group[0];for(const b of group.slice(1))comparisons.push({name:a.name,seed:a.seed,models:[a.model,b.model],sameSpawn:a.spawn===b.spawn,sameInitCommon:JSON.stringify(a.initCommon)===JSON.stringify(b.initCommon),sameRequestedInput:a.inputSHA===b.inputSHA&&a.inputSHA===a.archivedInputSHA,firstNativeDifference:a.frames.findIndex((f,j)=>f.native!==b.frames[j]?.native),oldSpawnExact:[a.oldSpawnExact,b.oldSpawnExact],oldFirstNativeDifference:[a.oldFirstNativeDifference,b.oldFirstNativeDifference]});}
const valid=rows.every(r=>r.inputSHA===r.archivedInputSHA&&!r.error&&!r.cleanupError&&!r.restorationError&&r.wrappersRestored&&r.steps===r.expectedSteps&&r.nativeSteps===r.expectedSteps&&Object.entries(r.counters).filter(([k])=>!k.startsWith('original')).every(([k,v])=>r.counters['original'+k[0].toUpperCase()+k.slice(1)]===v));
const report={sourceStable,sourceBefore,sourceManifestSHA:sha(JSON.stringify(sourceBefore)),sourceAfter,frozenAfter,frozen,headBefore,headAfter,liveBeforeFreeze,liveAfterFreeze,liveConcurrentChanges,liveHeadChanged:headBefore!==headAfter,engineSHA,engineAfter,engineStable,argv:process.argv,seeds,models,compactFrames,executions:rows.length,steps:rows.reduce((n,r)=>n+r.steps,0),comparisons,rows:rows.map(r=>({name:r.name,seed:r.seed,model:r.model,file:r.fileStem+'-'+r.model+'.json.gz',summary:r.summary,rawSHA:sha(fs.readFileSync(path.join(out,r.fileStem+'-'+r.model+'.json.gz')))})),measurementValid:sourceStable&&engineStable&&valid&&comparisons.every(c=>c.sameSpawn&&c.sameInitCommon&&c.sameRequestedInput),efficacyAccepted:false,interpretation:protocol.interpretation};
write('report.json',report);console.log(JSON.stringify({measurementValid:report.measurementValid,sourceStable,steps:report.steps,comparisons}));if(!report.measurementValid)process.exitCode=1;
