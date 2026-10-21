import {newRound,DT,CONFIG,THREE} from './harness_m.mjs';
import {PlayerParryGuard} from '../../src/parry_button.js';
import {installPress,installPressDamage} from '../../src/italian_press_research.js';
import {installStep} from '../../src/italian_step_research.js';
import {CHARACTERS} from '../../src/characters.js';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const baseline={...CONFIG.SKILL.itOppositionVals,window:Infinity,relaxedContact:false};
const variant=process.env.VARIANT??'strongBind';
const seeds=(process.env.SEEDS??'941,10304,11020,11021').split(',').map(Number);
const policies=(process.env.POLICIES??'spaced,cadence').split(',');
const bron=CHARACTERS.find(c=>c.id==='bran');
const snap=f=>({alive:f.alive,armed:f.armed,cause:f.causeOfDeath,limbs:{...f.limbs},consciousness:f.consciousness,blood:f.blood,bleed:f.bleed,stamina:f.stamina.value,exhausted:f.stamina.exhausted,broken:f.weaponBroken});
function trial(seed,policy,mode){
 const relaxed=true;
 CONFIG.SKILL.itOppositionVals={...baseline,...(relaxed?{relaxedContact:true,minVn:.2,maxGap:Infinity,injuryGrace:0}:{})};
 const g=newRound({weapon:'rapier',weapon2:'sain',seed,gap:2.2,look2:bron.look,difficulty:bron.ai.level,persona:{...bron.ai.persona,school:'sain'}}),p=g.player,a=g.enemy;
 p.skill.corr=CONFIG.SKILL.corr;p.skill.corrTip=CONFIG.SKILL.corrTip;p.skill.autoGuard=true;
 const guard=new PlayerParryGuard(p,a);p.stamina.controller=guard;
 const variants={near:{v2:true,targetPart:'uarmS',coverBlend:.4,lead:.15,steer:12,recover:.16,shieldTail:.16,shieldCap:.85,damageCut:.65,closeChamber:true},wide:{v2:true,targetPart:'uarmS',coverBlend:.4,lead:.15,steer:20,recover:.16,shieldTail:.16,shieldCap:.85,damageCut:.65,closeChamber:true},withdraw:{v2:true,targetPart:'uarmS',coverBlend:.4,lead:.15,steer:12,recover:.16,shieldTail:.16,shieldCap:.85,damageCut:.65,hitRecover:true},bothNone:{v2:true,targetPart:'uarmS',coverBlend:.4,lead:.15,steer:12,recover:.16,shieldTail:.16,shieldCap:.85,damageCut:0},leadShort:{v2:true,targetPart:'uarmS',coverBlend:.4,lead:.15,recover:.16,shieldTail:.16,shieldCap:.85,damageCut:.65},steerShort:{v2:true,targetPart:'uarmS',coverBlend:.4,steer:12,recover:.16,shieldTail:.16,shieldCap:.85,damageCut:.65},bothShort:{v2:true,targetPart:'uarmS',coverBlend:.4,lead:.15,steer:12,recover:.16,shieldTail:.16,shieldCap:.85,damageCut:.65},both45:{v2:true,targetPart:'uarmS',coverBlend:.4,lead:.15,steer:12,recover:.16,shieldTail:.16,shieldCap:.85,damageCut:.45},lead:{v2:true,targetPart:'uarmS',coverBlend:.4,lead:.15,shieldTail:.24,shieldCap:1,damageCut:.65},steer:{v2:true,targetPart:'uarmS',coverBlend:.4,steer:12,shieldTail:.24,shieldCap:1,damageCut:.65},chestSteer:{v2:true,coverBlend:.4,steer:12,shieldTail:.24,shieldCap:1,damageCut:.65},armSteer:{v2:true,targetChest:false,coverBlend:.4,steer:12,shieldTail:.24,shieldCap:1,damageCut:.65},compact65:{v2:true,targetPart:'uarmS',coverBlend:.4,shieldTail:.24,shieldCap:1,damageCut:.65},short:{v2:true,targetPart:'uarmS',coverBlend:.4,recover:.16,shieldTail:.16,shieldCap:.85,damageCut:.45},arm:{v2:true,targetChest:false,shieldTail:.18,shieldCap:.85,damageCut:.45},upper:{v2:true,targetPart:'uarmS',shieldTail:.18,shieldCap:.85,damageCut:.45},compact:{v2:true,targetPart:'uarmS',coverBlend:.4,shieldTail:.18,shieldCap:.85,damageCut:.45},point:{v2:true,coverBlend:.4,shieldTail:.18,shieldCap:.85,damageCut:.45},old:{v2:false,damageCut:.45},aligned:{v2:true,shieldTail:.18,shieldCap:.85,damageCut:.45},covered:{v2:true,shieldTail:.24,shieldCap:1,damageCut:.65}};
 const cfg={...JSON.parse(process.env.PATH_CONFIG??'{}'),...(variants[mode]??{damageCut:mode==='none'?0:mode==='shield45'?.45:mode==='shield65'?.65:.30})};
 const mod=mode==='contact'?installStep(p,a,guard,variant,true,true):installPress(p,a,guard,cfg);installPressDamage(g.combat);
 // Identical practice attacker selection logic to the public lab; absent tech leaves native AI.
 const tech=g.ai.school.tech.find(t=>t.name==='zwerchL');
 if(tech){g.ai.pickTech=()=>tech;const update=g.ai.update.bind(g.ai);let next=.8;g.ai.update=dt=>{update(dt);const f=a,t=f.stamina.time;if(t>=next&&f.alive&&f.armed&&f.state==='stand'&&!f.stamina.exhausted&&g.ai.mode!=='attack'&&f.foeDistance()<2.3)if(g.ai.startAttack(tech,'research-practice',{noFeint:true,noPending:true}))next=t+2;};}
 const events=[],contacts=[],timeline=[],actions=[],deaths=[],breaks=[];
 const fingerprint=()=>createHash('sha256').update(JSON.stringify([p,a].map(f=>({state:f.state,health:snap(f),rbs:f.meshes.map(({rb})=>[rb.translation(),rb.rotation(),rb.linvel(),rb.angvel()])})))).digest('hex');
 for(const f of [p,a]){const apply=f.applyWound.bind(f);f.applyWound=h=>{const b=snap(f),ret=apply(h),e=snap(f);const limb=Object.keys(e.limbs).reduce((n,k)=>n+Math.max(0,b.limbs[k]-e.limbs[k]),0),con=Math.max(0,b.consciousness-e.consciousness),bleed=Math.max(0,e.bleed-b.bleed);if(limb||con||bleed||(h.severity??0)>0)events.push({t:g.t,vic:f.index,part:h.part,type:h.type,severity:h.severity??0,limb,con,bleed,autoRunning:!!mod.run,autoPush:p.skill.thrustPush,trade:h.pressTrade,serial:mod.run?.serial??null});return ret;};}
 let nextEngaged=.6,engagedUntil=-1,firstCommand=null,pendingReaction=null;
 let prevHeld=false,lastCycle=-1,exhausted=[false,false],down=[false,false],broken=[false,false];
 g.before=()=>{
  const t=g.t,period=policy==='cadence'?1.4:6,phase=(t-.6)%period;
  let held=t>=.6&&(policy==='hold'||phase<.85);
  if(policy==='engaged'){if(t>=nextEngaged&&p.foeDistance()<+(process.env.INPUT_GAP??1.75)){engagedUntil=t+.80;nextEngaged=t+1.5;}held=t<engagedUntil;}
  if(policy.startsWith('single')){
   if(firstCommand===null){
    if(policy==='single-react'&&g.ai.mode==='attack'&&pendingReaction===null)pendingReaction=t+.18;
    const ready=policy==='single-react'?pendingReaction!==null&&t>=pendingReaction:p.foeDistance()<+(process.env.INPUT_GAP??1.75);
    if(t>=.6&&ready)firstCommand=t;
   }
   held=firstCommand!==null&&t<firstCommand+.12;
  }
  p.move.set(0,p.foeDistance()>1.50?.30:0);p.stickX=p.stickY=0;
  if(policy==='single-retreat'&&firstCommand!==null&&t<firstCommand+.70)p.move.y=-.30;
  if(held!==prevHeld){actions.push({t,kind:held?'press':'release',hash:fingerprint(),p:snap(p),a:snap(a)});prevHeld=held;}
  p.stickY=p.move.y;guard.held=held;guard.step(DT);p.inputActive=guard.active||!!p.skill.tap;

 };
 const initial=fingerprint();
 for(let i=0;i<Math.round((+(process.env.SECONDS??30))/DT);i++){
  g.step();
  for(const f of [p,a]){const j=f.index;if(!f.alive&&!down[j]){deaths.push({t:g.t,vic:j,cause:f.causeOfDeath});down[j]=true;}if(f.weaponBroken&&!broken[j]){breaks.push({t:g.t,vic:j});broken[j]=true;}if(f.stamina.exhausted&&!exhausted[j])actions.push({t:g.t,kind:'exhaust',vic:j});exhausted[j]=f.stamina.exhausted;}
  if(i%12===0)timeline.push({t:g.t,p:snap(p),a:snap(a),held:guard.held,active:guard.active,gap:p.foeDistance()});
  if(!p.alive||!a.alive||(policy.startsWith('single')&&firstCommand!==null&&g.t>=firstCommand+5.05))break;
 }
 if(mod.run)mod.cancel('round-end');
 const row={variant,seed,policy,mode,relaxed,initial,config:cfg,t:g.t,p:snap(p),a:snap(a),practiceTech:tech?.name??null,events,contacts,timeline,actions,deaths,breaks,triggers:mod.events,samples:mod.samples,bodySamples:[]};
 g.world.free();return row;
}
const rows=[];
for(const seed of seeds)for(const policy of policies)for(const mode of (process.env.MODES??'contact,none,shield30').split(',')){const r=trial(seed,policy,mode);rows.push(r);console.log(JSON.stringify({variant,seed,policy,mode,t:r.t,starts:r.triggers.filter(x=>x.type==='start').length,pDead:!r.p.alive,aDead:!r.a.alive}));writeFileSync(process.env.OUT,JSON.stringify({variant,baseline,inputGap:+(process.env.INPUT_GAP??1.75),pathConfig:JSON.parse(process.env.PATH_CONFIG??'{}'),rows}));}
