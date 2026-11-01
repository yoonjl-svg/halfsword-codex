// Fresh-body normal-damage probes for the eight non-German/non-Italian unique families.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {ROWS,drillRun,fightRun} from './special_balance.mjs';
import {observeRound,summary,BASE} from './balance_core_20261101.mjs';
import {MEASURED} from '../../src/weapon_measured.js';
import {TECH_BY_NAME} from '../../src/ai_techniques.js';
import * as CONFIG from '../../src/config.js';
import {DT} from './harness_m.mjs';
import {ScriptedTouchInput} from './balance_german_20261101.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const configHash=()=>hash(JSON.stringify(CONFIG));
const sourceHashes=Object.fromEntries(['src/config.js','src/combat.js','src/unique_assist.js','src/fighter.js','src/skill.js'].filter(f=>fs.existsSync(f)).map(f=>[f,hash(fs.readFileSync(f))]));
const driverHash=hash(fs.readFileSync(fileURLToPath(import.meta.url)));
const stroke=n=>({from:TECH_BY_NAME[n].from,path:TECH_BY_NAME[n].path});
Object.assign(ROWS,{
 abTalho:{trad:'iberian',w:'zweihander',name:'talhoRodeado',base:'zornhau',ko:'나선 걸음 베기',strokes:[stroke('zornhau')],researchStick:{x:.9,y:0}},
 abHiraki:{trad:'japanese',w:'uchigatana',name:'hirakiGiri',base:'zornhauL',ko:'비껴 베기',strokes:[stroke('zornhauL')],researchStick:{x:.9,y:0}},
 abChebu:{trad:'chinese',w:'hwando',name:'chebuYaoji',base:'zwerch',ko:'끌어 딛고 허리 베기',strokes:[stroke('zwerch')],researchStick:{x:0,y:.9}},
});
export const CASES=[
 {row:'rdHold',tech:'redondo',school:'iberian',category:'special'},
 {row:'abTalho',tech:'talhoRodeado',school:'iberian',category:'unique'},
 {row:'japanese',tech:'tsubameGaeshi',school:'japanese',category:'special'},
 {row:'abHiraki',tech:'hirakiGiri',school:'japanese',category:'unique'},
 {row:'kote',tech:'kote',school:'japanese',category:'unique'},
 {row:'lianTap',tech:'lianchi',school:'chinese',category:'special'},
 {row:'chinese',tech:'yaoji',school:'chinese',category:'unique'},
 {row:'abChebu',tech:'chebuYaoji',school:'chinese',category:'unique'},
];
export function trial(c,{variant='on',seed=1,range='normal',inputProfile='clean',mode='single',duration=18,replayCommands=null,foe='still'}={}){
 const R=ROWS[c.row],reach=MEASURED[R.w]?.[1]??1.6;
 const distance={close:Math.max(.9,reach-.5),normal:Math.max(1.0,reach-.2),edge:reach+.06}[range];
 const bankSpeed=3.6+((seed-101+600)%6)*.16;
 const noise={clean:{sjit:0,jit:0,spd:[bankSpeed,bankSpeed]},small:{sjit:.035,jit:.025,spd:[3.5,4.5]},large:{sjit:.07,jit:.055,spd:[3,5.5]}}[inputProfile];
 let rec=null,steps=0,io=null,commandFrame=null,replayIndex=0,inFeed=false;const attemptObjects=new Set(),beforeConfig=configHash(),commands=[];
 const opts={variant,foe,dur:CONFIG.realS(duration),...noise,normalDamage:true,oneShot:true,distance,preCombo:false,
  onInit(G,P,E,uq,{bot}){
   rec=observeRound(G,{...c,row:c.row,category:c.category,weapon:R.w,mode,variant,seed,range,inputProfile,requestedDistance:distance,inputBank:{...noise,bankSpeed,units:'pad_m'},controller:'actual Input pointer methods; stick command proxy; hold/tap driver proxy for redondo/lianchi',fixture:'stationary foe, normal wounds and reactions, no forced contact, target enhancement only; legacy all passive/perk flags; no pre-combo cut'});
   io=new ScriptedTouchInput();
   const consumePointer=frame=>{
    const input=io.frame(frame[0],frame[1],frame[2],G.t/CONFIG.TIME.k);
    uq.feed(input.dx,input.dy,2*DT,false);
    if(!(uq.holdsHand??uq.running)){P.handOffset.x+=input.dx;P.handOffset.y+=input.dy;}
    P.handHeld=input.down;P.inputActive=Math.abs(input.dx)+Math.abs(input.dy)>1e-5;
    P.handGrip=(io.input.press?.moved??0)>=(CONFIG.INPUT.holdPx??CONFIG.INPUT.tapPx);
    if(input.taps&&P.alive&&!P.stamina.exhausted)P.skill.thrust();
   };
   const oldHold=uq.holdInput;
   uq.holdInput=function(...args){if(commandFrame&&!replayCommands)commandFrame.ops.push({kind:'hold',args});return oldHold.apply(this,args);};
   const oldThrust=P.skill.thrust;
   P.skill.thrust=function(...args){if(commandFrame&&!replayCommands&&!inFeed)commandFrame.ops.push({kind:'tap',args});return oldThrust.apply(this,args);};
   bot.feed=()=>{
    if((bot.step++&1)!==0)return;
    const frame=bot.queue.shift()??[0,0,false];bot.fed++;
    const pointer=[frame[0],frame[1],frame[2]||!!bot.hold];
    commandFrame?.ops.push({kind:'pointer',frame:pointer});
    inFeed=true;consumePointer(pointer);inFeed=false;
   };
   const before=G.before;
   G.before=()=>{
    if(replayCommands){
     const frame=replayCommands[replayIndex++];
     if(frame){
      for(const op of frame.ops){if(op.kind==='hold')uq.holdInput(...op.args);else if(op.kind==='tap')P.skill.thrust(...op.args);else consumePointer(op.frame);}
      P.move.set(frame.stick[0],frame.stick[1]);P.stickX=frame.stick[0];P.stickY=frame.stick[1];
     }else{P.move.set(0,0);P.stickX=0;P.stickY=0;}
     return;
    }
    commandFrame={t:G.t,ops:[],stick:null};before();
    commandFrame.stick=[P.stickX,P.stickY];commands.push(commandFrame);commandFrame=null;
   };
  },
  probe(G,P,D,cur){steps++;if(cur)attemptObjects.add(cur);},
 };
 const wall=performance.now();const raw=drillRun(c.row,seed,opts);
 const afterConfig=configHash();
 const viewportValid=(io?.events??[]).every(e=>e.clientX>=0&&e.clientX<=844&&e.clientY>=0&&e.clientY<=390);
 const commandPlan=replayCommands??commands;
 const result=rec.finish({foe,requestedInputSequences:1,attempted:replayCommands?(commandPlan.some(f=>f.ops.some(o=>o.kind==='hold'||o.kind==='tap'||o.kind==='pointer'&&o.frame[2]))?1:0):attemptObjects.size,completedSequences:raw.atts?.length??null,raw,inputEvents:io?.events??[],commandHash:hash(JSON.stringify(commandPlan)),commandFrames:commandPlan,replayedFrames:replayCommands?replayIndex:null,replayComplete:replayCommands?replayIndex>=replayCommands.length:null,control:replayCommands?'exact enhanced-input replay':'condition-responsive input policy',wallSeconds:(performance.now()-wall)/1000,steps,sourceHashes,driverHash,config:{before:beforeConfig,after:afterConfig},
  validity:{valid:beforeConfig===afterConfig&&viewportValid,viewportValid,configUnchanged:beforeConfig===afterConfig,normalDamage:true,ghostMode:false,directRequest:false,scope:'conditional single input sequence; prepare hits retained and individually tagged',note:c.tech==='tsubameGaeshi'?'Previous downward strike must actually miss or bind; absence of opportunity is not zero power':null}});
 result.targetContacts=result.events.filter(e=>e.kind==='contact'&&e.attacker==='player'&&e.tech===c.tech);
 result.targetSeverity=result.targetContacts.reduce((a,e)=>a+(e.severity??0),0);
 result.preparationSeverity=result.events.filter(e=>e.kind==='contact'&&e.attacker==='player'&&e.tech!==c.tech).reduce((a,e)=>a+(e.severity??0),0);
 return result;
}
function parse(){const o=Object.fromEntries(process.argv.slice(2).filter(x=>x.startsWith('--')).map(x=>{const [k,...v]=x.slice(2).split('=');return[k,v.join('=')||'1'];}));return o;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const a=parse(),mode=a.mode??'pilot',out=a.out??'docs/research/attack_balance_20261101/generic';fs.mkdirSync(out,{recursive:true});
 const selected=a.techs?CASES.filter(c=>a.techs.split(',').includes(c.tech)):CASES;
 const ranges=(a.ranges??(mode==='pilot'?'normal':'close,normal,edge')).split(',');
 const seeds=a.seeds?a.seeds.split(',').map(Number):mode==='pilot'?[101]:[101,102,103,104,105,106];
 const variants=(a.variants??(mode==='pilot'?'on':'on,off')).split(',');
 const profiles=(a.profiles??(mode==='input'?'clean,small,large':'clean')).split(',');
 const dest=path.join(out,mode+'.jsonl'),rows=[],t=performance.now(),pairs=new Map();fs.writeFileSync(dest,'');
 for(const c of selected)for(const range of ranges)for(const seed of seeds)for(const variant of variants)for(const inputProfile of profiles){
  const key=[c.tech,range,seed,inputProfile].join('/'),replayCommands=variant==='off'?pairs.get(key)??null:null;
  const r=trial(c,{variant,seed,range,inputProfile,mode,duration:+(a.duration??18),replayCommands,foe:a.foe??'still'});if(variant==='on')pairs.set(key,r.commandFrames);rows.push(r);fs.appendFileSync(dest,JSON.stringify(r)+'\n');
  console.log(JSON.stringify({tech:c.tech,range,seed,variant,inputProfile,started:r.started,targetContacts:r.targetContacts.length,targetSeverity:r.targetSeverity,preparationSeverity:r.preparationSeverity,wall:r.wallSeconds}));
 }
 fs.writeFileSync(path.join(out,mode+'.summary.json'),JSON.stringify({build:BASE,mode,n:rows.length,wallSeconds:(performance.now()-t)/1000,groups:summary(rows)},null,2)+'\n');
}
