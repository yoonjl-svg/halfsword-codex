// Frozen actual-game comparison. No physical pose/velocity injection.
// node tools/sim/experiments/opportunity_20261008.mjs NEW_EXTERNAL_OUTPUT [case,...]
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url)), out=process.argv[2];
assert(out&&path.isAbsolute(out)&&!fs.existsSync(out)&&!out.startsWith(root));
const own='tools/sim/experiments/opportunity_20261008.mjs', sha=x=>createHash('sha256').update(x).digest('hex');
const scan=p=>fs.readdirSync(path.join(root,p),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(p+'/'+e.name):e.name.endsWith('.js')?[p+'/'+e.name]:[]);
const names=[...scan('src'),own,'tools/sim/harness_m.mjs','package.json','package-lock.json'].sort();
const hashes=dir=>Object.fromEntries(names.map(n=>[n,sha(fs.readFileSync(path.join(dir,n)))]));
const sources=hashes(root), frozen=path.join(out,'source');
for(const n of names){const dest=path.join(frozen,n);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,n),dest);}
fs.symlinkSync(path.join(root,'node_modules'),path.join(frozen,'node_modules'),'dir');assert.deepEqual(hashes(root),sources);assert.deepEqual(hashes(frozen),sources);
const write=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const load=n=>import(pathToFileURL(path.join(frozen,n)).href);
const [{newRound,DT,CONFIG},{applySwordsmanship,recordSwordsmanshipInput},{configureCombatDefaults},{captureOpportunityPose,findOpportunity},{LOOKS}]=await Promise.all([load('tools/sim/harness_m.mjs'),load('src/swordsmanship.js'),load('src/combat_defaults.js'),load('src/opportunity_target.js'),load('src/looks.js')]);
const cases={cut:{weapon:'longsword'},cutRaised:{weapon:'longsword',raised:true},blunt:{weapon:'branch',gap:1.35},thrust:{weapon:'rapier',tap:true,noPrepare:true},healthy:{weapon:'longsword',healthy:true},guard:{weapon:'longsword',guard:true},thrustGuard:{weapon:'rapier',tap:true,guard:true},bluntHelmet:{weapon:'branch',helmet:true,gap:1.35},far:{weapon:'rapier',tap:true,gap:3.2},aiCut:{weapon:'longsword',ai:true},aiCutOpen:{weapon:'longsword',ai:true,unarmed:true},aiCutOpenLow:{weapon:'longsword',ai:true,unarmed:true,lowHands:true},aiThrustOpenLow:{weapon:'rapier',ai:true,unarmed:true,lowHands:true},aiThrustOpen:{weapon:'rapier',ai:true,unarmed:true},aiBluntOpen:{weapon:'branch',ai:true,unarmed:true,gap:1.35},aiBlunt:{weapon:'branch',ai:true,gap:1.35},aiThrust:{weapon:'rapier',ai:true}};
const selection=(process.argv[3]??'cut,blunt,thrust,healthy,guard,thrustGuard,bluntHelmet,far,aiCut,aiBlunt,aiThrust').split(',');assert(selection.every(n=>cases[n]));
const protocol={head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sources,selection,settings:'Current ordinary player v2/manual/fresh/bounded, linked both, cut by current weapon capability, power both, gravity9.81,severON. Both finishEntry low. Only opportunity flag differs.',preparation:'seed7. AI attacker is held passive through tick719; then normal AI begins. Target is passive input, controller legs both .2 and knockDown(false) at tick240, no wound/pose/velocity injection. Target optional high hand command, actual helmet look, or actual dropSword on the Open cases. OpenLow also commands the victim hands fromhome y-.28 to-.5 at360..480 thenholds there, testing an exposed neck rather than arms intercepting the cut. Preparation starts continuously from settled hand position with fixed hand height. Raised case first commands y=-.28→.1 duringticks480..600 thenholds to660. Fixed player hand preparation tick660..720 (thrust case has no hand preparation), cut tick720..744, release/re-input at840..900 or tap720/900. AI attacker uses actual unmodified AI calls. Artificial injury/state preparation is not spontaneous-combat evidence.',argv:process.argv};write('protocol.json',protocol);
const rows=[];const point=p=>[p.x,p.y,p.z];const compact=r=>Object.fromEntries(['type','zone','energy','eff','thr','quality','speed','severity','pass','helmet','finishingStrike','finishPower'].map(k=>[k,r?.[k]]));
function observation(f){const p=f.bodies.chest.translation(),h=f.bodies.head.translation();return{state:f.state,chest:point(p),head:point(h),blade:[point(f.bladePoint(0)),point(f.bladePoint(1))],baseHand:f.swordsmanshipState?.baseHand?.toArray(),baseAim:f.swordsmanshipState?.baseAim?.toArray(),alive:f.alive,tipSpeed:f.tipVel.length(),hand:[f.handOffset.x,f.handOffset.y],tap:f.skill.tap?{t:f.skill.tap.t,down:!!f.skill.tap.down,go:!!f.skill.tap.go,abort:!!f.skill.tap.abort,head:f.skill.tap.head,opportunity:f.skill.tap.opportunity?{zone:f.skill.tap.opportunity.zone,target:f.skill.tap.opportunity.target}:null}:null,opportunity:f.opportunityPlayer?Object.fromEntries(Object.entries(f.opportunityPlayer).filter(([k])=>k!=='foe')):null};}
for(const name of selection){const spec=cases[name];let tape;
 for(const model of ['off','v1']){
  let G,tick=0,prepareFrom=null;const row={name,model,steps:0,inputs:[],frames:[],hits:[],contacts:[],error:null};rows.push(row);
  try{
   G=newRound({seed:7,weapon:spec.ai?'longsword':spec.weapon,weapon2:spec.ai?spec.weapon:'longsword',gap:spec.gap??1.65,walls:false,...(spec.helmet?{look2:{...LOOKS.enemy,helmet:'kettle'}}:{}),onFighter:f=>{f.armSupportModel='linked';f.finishEntryModel='low';f.opportunityModel=model;if(f.index===0){f.onehandArmModel='manual';const p=configureCombatDefaults({active:true},f.weapon);f.stanceMemoryModel=p.stance;f.rollTargetModel=p.roll;}}});
   const f=G.player,e=G.enemy,att=spec.ai?e:f,vic=spec.ai?f:e,C=G.combat;
   applySwordsmanship(f);f.canShove=true;C.cutReactionModel=configureCombatDefaults({active:true},f.weapon).cut;C.cutReactionFighter=f;C.finishRuleModel='power';C.finishRuleFighter=null;
   assert(CONFIG.COMBAT.limbSeverTrial);assert.equal(CONFIG.PHYSICS.gravity,-9.81);
   if(!spec.ai)G.ai.update=()=>e.move.set(0,0);
   else {const originalAI=G.ai.update.bind(G.ai);G.ai.update=dt=>tick>=720?originalAI(dt):e.move.set(0,0);}
   row.spawn=sha(G.world.takeSnapshot());row.victimLook={hasHelmet:vic.hasHelmet,helmetType:vic.helmetType,hasPlate:vic.hasPlate};
   const analyze=C.analyze;C.analyze=function(pr,p,S,P,pred=false){const r=analyze.call(this,pr,p,S,P,pred);if(!pred&&r&&pr.w.fighter===att)row.contacts.push({tick,...compact(r),part:pr.v.part,point:point(p),special:spec.ai?G.ai.opportunityAttack?{started:G.ai.opportunityAttack.started,kind:G.ai.opportunityAttack.kind,zone:G.ai.opportunityAttack.zone,tech:G.ai.tech?.name,episode:G.ai.opportunityAttack.episode}:null:att.skill.tap?.opportunity?{kind:'thrust',zone:att.skill.tap.opportunity.zone}:att.opportunityPlayer?{phase:att.opportunityPlayer.phase,kind:att.opportunityPlayer.kind,zone:att.opportunityPlayer.zone}:null});return r;};
   G.onWound=(a,v,r)=>row.hits.push({tick,attacker:a.index,victim:v.index,...compact(r)});
   G.before=()=>{
    if(tick===240&&!spec.healthy){vic.limbs.legF=.2;vic.limbs.legB=.2;vic.knockDown(false);if(spec.unarmed)vic.dropSword();}
    let req;if(tape)req=tape[tick];else{
     let x=f.handOffset.x,y=f.handOffset.y,active=false;
     if(spec.lowHands&&tick>=360&&tick<480){const t=(tick-360+1)/120;x=.18;y=-.28-.22*t;active=true;}
     if(spec.lowHands&&tick>=480){x=.18;y=-.5;active=true;}
     if(!spec.ai){
      if(tick===660)prepareFrom={x:f.handOffset.x,y:f.handOffset.y};
      if(spec.raised&&tick>=480&&tick<600){const t=(tick-480+1)/120;x=.18;y=-.28+.38*t;active=true;}
      if(spec.raised&&tick>=600&&tick<660){x=.18;y=.1;active=true;}
      if(tick>=660&&tick<720&&!spec.noPrepare){const t=(tick-660+1)/60;x=prepareFrom.x+(.46-prepareFrom.x)*t;y=prepareFrom.y;active=true;}
      if(tick>=720&&tick<744&&!spec.tap){const t=(tick-720+1)/24;x=.46-.92*t;y=prepareFrom.y;active=true;}
      if(tick>=840&&tick<900&&!spec.tap){const t=(tick-840+1)/60;x=-.46+.92*t;y=prepareFrom.y;active=true;}
     }
     req={dx:active?x-f.handOffset.x:0,dy:active?y-f.handOffset.y:0,active,tap:!spec.ai&&spec.tap&&(tick===720||tick===900)};
    }
    row.inputs.push(req);f.move.set(0,0);f.stickX=f.stickY=0;f.handHeld=req.active;f.inputActive=req.active;
    f.handOffset.x+=req.dx;f.handOffset.y+=req.dy;const len=f.handOffset.length();if(len>.62)f.handOffset.multiplyScalar(.62/len);
    recordSwordsmanshipInput(f,{id:tick,timeS:G.t,dx:req.dx,dy:req.dy,held:req.active,active:req.active});
    if(!spec.ai&&spec.guard){e.handOffset.set(.02,.4);e.inputActive=false;e.handHeld=true;}
    if(req.tap)f.skill.thrust();
   };
   for(tick=0;tick<(spec.ai?2160:1200);tick++){
    G.step();row.steps++;
    let opportunity=null;
    if(att.alive&&vic.alive)opportunity=findOpportunity(att,captureOpportunityPose(vic),spec.tap?'thrust':att.weaponCfg.edged?'cut':'blunt');
    row.frames.push({tick,native:sha(G.world.takeSnapshot()),att:observation(att),vic:observation(vic),eligible:!!opportunity,target:opportunity?{zone:opportunity.zone,point:point(opportunity.target)}:null,ai:spec.ai?{mode:G.ai.mode,phase:G.ai.phase,why:G.ai.why,chain:G.ai.chain,tech:G.ai.tech?.name,opportunity:G.ai.opportunityState?{...G.ai.opportunityState}:null,attack:G.ai.opportunityAttack?{zone:G.ai.opportunityAttack.zone,kind:G.ai.opportunityAttack.kind,started:G.ai.opportunityAttack.started,target:G.ai.opportunityAttack.target.toArray(),observedAt:G.ai.opportunityAttack.observedAt,episode:G.ai.opportunityAttack.episode,padY:G.ai.opportunityAttack.padY,lateral:G.ai.opportunityAttack.lateral,crossing:G.ai.opportunityAttack.crossing,handY:G.ai.opportunityAttack.handY,pitch:G.ai.opportunityAttack.pitch}:null}:null});
    assert([f,e].every(x=>x.meshes.every(({rb})=>[rb.translation(),rb.rotation(),rb.linvel(),rb.angvel()].every(v=>Object.values(v).every(Number.isFinite)))));
   }
   row.final={states:[f.state,e.state],alive:[f.alive,e.alive],wounds:[f.wounds.length,e.wounds.length],clashes:G.clashes,aiStats:spec.ai?G.ai.stats:undefined};
  }catch(e){row.error=e.stack;}finally{try{G?.eventQueue.free();G?.world.free();}catch(e){row.cleanupError=e.message;}}
  row.summary={eligibleSteps:row.frames.filter(f=>f.eligible).length,hits:row.hits,final:row.final,error:row.error};write(name+'-'+model+'.json',row);if(!tape)tape=row.inputs;
  console.log(JSON.stringify({name,model,steps:row.steps,...row.summary}));
 }
}
assert.deepEqual(hashes(frozen),sources);
const comparisons=[];for(let i=0;i<rows.length;i+=2){const a=rows[i],b=rows[i+1];comparisons.push({name:a.name,sameSpawn:a.spawn===b.spawn,sameRequestedInput:JSON.stringify(a.inputs)===JSON.stringify(b.inputs),firstNativeDifference:a.frames.findIndex((r,j)=>r.native!==b.frames[j]?.native)});}
const report={sourceStable:true,head:protocol.head,executions:rows.length,steps:rows.reduce((n,r)=>n+r.steps,0),comparisons,rows:rows.map(r=>({name:r.name,model:r.model,summary:r.summary,sha256:sha(fs.readFileSync(path.join(out,r.name+'-'+r.model+'.json')))})),executionPassed:rows.every(r=>!r.error)&&comparisons.every(c=>c.sameSpawn&&c.sameRequestedInput)};write('report.json',report);if(!report.executionPassed)process.exitCode=1;
