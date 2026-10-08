// Bounded diagnosis of current finish entry; no candidate controller or damage changes.
// node tools/sim/experiments/finish_entry_audit_20261008.mjs NEW_ABSOLUTE_OUTPUT
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=process.argv[2];
assert(out&&path.isAbsolute(out)&&!fs.existsSync(out));
assert(!path.resolve(out).startsWith(path.resolve(root)+'/'));
const own='tools/sim/experiments/finish_entry_audit_20261008.mjs';
const names=fs.readdirSync(path.join(root,'src')).filter(n=>n.endsWith('.js')).map(n=>'src/'+n)
  .concat(own,'tools/sim/harness_m.mjs','package.json','package-lock.json').sort();
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=dir=>Object.fromEntries(names.map(n=>[n,sha(fs.readFileSync(path.join(dir,n)))]));
const before=manifest(root),frozen=path.join(out,'source');
const write=(name,data)=>fs.writeFileSync(path.join(out,name),JSON.stringify(data,null,2)+'\n',{flag:'wx'});
for(const name of names){const dest=path.join(frozen,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,name),dest);}
fs.symlinkSync(path.join(root,'node_modules'),path.join(frozen,'node_modules'),'dir');
assert.deepEqual(manifest(root),before);assert.deepEqual(manifest(frozen),before);
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const load=name=>import(pathToFileURL(path.join(frozen,name)).href);
const {newRound,DT,CONFIG}=await load('tools/sim/harness_m.mjs');
const {applySwordsmanship,recordSwordsmanshipInput}=await load('src/swordsmanship.js');
const {configureCombatDefaults}=await load('src/combat_defaults.js');
assert.equal(CONFIG.PHYSICS.gravity,-9.81);assert(CONFIG.COMBAT.limbSeverTrial);
const protocol={head,command:process.argv,sourceHashes:before,seed:7,gapM:1.5,stepsPerRun:1080,
  preparation:'At tick240 call enemy.knockDown(true) for early/low tap. Kneel case sets both enemy leg functions=.2 and knockDown(false). No forced body position/velocity, no extra impulse, no down-time override. Enemy AI inputs idle. These are prepared cases, not natural injury frequency.',
  policy:'Player current unified/manual/fresh/bounded. Both linked support. Player centerline cut. Both power finish. Gravity9.81, limb severing on.',
  input:'One tap at first on+amt>.5 (early), same but torso centers<=.55m (low), or first kneel state. No joystick/drag. .55m is an observation trigger only, not a selected runtime gate.'};
write('protocol.json',protocol);
const rows=[];
for(const name of ['early','low','kneel']){
  let G;const row={name,frames:[],tap:null,hits:[],error:null};rows.push(row);
  try{
    G=newRound({seed:7,weapon:'longsword',weapon2:'longsword',gap:1.5,walls:false,onFighter:f=>{
      f.armSupportModel='linked';if(f.index===0){const d=configureCombatDefaults({active:true},f.weapon);f.stanceMemoryModel=d.stance;f.rollTargetModel=d.roll;f.onehandArmModel='manual';}
    }});
    const f=G.player,e=G.enemy,C=G.combat;assert(applySwordsmanship(f));f.canShove=true;
    C.cutReactionModel='centerline';C.cutReactionFighter=f;C.finishRuleModel='power';C.finishRuleFighter=null;
    G.ai.update=()=>{e.move.set(0,0);};
    let tick=0;G.onWound=(att,vic,r)=>row.hits.push({tick,attacker:att.index,victim:vic.index,type:r.type,zone:r.zone,energy:r.energy,severity:r.severity});
    const sample=()=>{
      const pl=f.finish.plunge,tp=f.skill.tap;
      return {tick,time:G.t,attackerState:f.state,foeState:e.state,alive:[f.alive,e.alive],
        chestY:e.bodies.chest.translation().y,pelvisY:e.bodies.pelvis.translation().y,headY:e.bodies.head.translation().y,
        targetY:f.bodies.chest.translation().y+pl.T[1],finishOn:f.finish.on,finishAmount:f.finish.amt,
        skillLevel:f.skill.level,moveY:f.move.y,inside:pl.inside,walk:pl.walk,short:pl.short,
        tap:tp?{t:tp.t,down:tp.down,walking:!!tp.walking,go:!!tp.go,ended:!!tp.ended,abort:!!tp.abort,
          upDone:!!tp.upDone,lineDone:!!tp.lineDone,walkEnd:tp.walkEnd??null}:null};
    };
    G.before=()=>{
      f.move.set(0,0);f.stickX=0;f.stickY=0;f.handHeld=false;f.inputActive=false;
      assert(recordSwordsmanshipInput(f,{id:tick,timeS:G.t,dx:0,dy:0,held:false,active:false}));
      if(tick===240){if(name==='kneel'){e.limbs.legF=.2;e.limbs.legB=.2;e.knockDown(false);}else e.knockDown(true);}
      const low=Math.max(e.bodies.chest.translation().y,e.bodies.pelvis.translation().y)<=.55;
      const eligible=name==='kneel'?e.state==='kneel':f.finish.on&&f.finish.amt>.5&&(name==='early'||low);
      if(tick>240&&!row.tap&&eligible){row.tap={before:sample(),accepted:f.skill.thrust(),down:!!f.skill.tap?.down};}
    };
    for(tick=0;tick<1080;tick++){
      G.step();row.frames.push(sample());
      assert([f,e].every(x=>x.meshes.every(({rb})=>[rb.translation(),rb.rotation(),rb.linvel(),rb.angvel()].every(v=>Object.values(v).every(Number.isFinite)))));
    }
    row.summary={tap:row.tap,firstOn:row.frames.find(x=>x.finishOn),
      firstLowDown:row.frames.find(x=>x.foeState==='down'&&Math.max(x.chestY,x.pelvisY)<=.55),
      enabledAbove55:row.frames.filter(x=>x.finishOn&&Math.max(x.chestY,x.pelvisY)>.55).length,
      walkingZeroCommand:row.frames.filter(x=>x.tap?.walking&&!x.tap.go&&x.moveY===0).length,
      firstGo:row.frames.find(x=>x.tap?.go),firstAbort:row.frames.find(x=>x.tap?.abort),
      final:row.frames.at(-1),hits:row.hits.length};
  }catch(error){row.error=error.stack;}finally{G?.eventQueue.free();G?.world.free();write(name+'.json',row);}
}
assert.deepEqual(manifest(root),before);assert.deepEqual(manifest(frozen),before);
const result={head,sourceStable:true,sourceHashes:before,executionCount:rows.length,steps:rows.reduce((n,r)=>n+r.frames.length,0),
  pass:rows.every(r=>!r.error),scope:'Current entry diagnosis; no proposed gate/controller was installed, no win-rate/realism claim.',
  rows:rows.map(r=>({name:r.name,error:r.error,summary:r.summary,rawSHA256:sha(fs.readFileSync(path.join(out,r.name+'.json')))}))};
write('report.json',result);console.log(JSON.stringify(result.rows.map(r=>({name:r.name,error:r.error,summary:r.summary}))));
if(!result.pass)process.exitCode=1;
