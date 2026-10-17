import {PlayerParryGuard} from '../../src/parry_button.js';
import {PathResearchGuard} from './chinese_path_guard.mjs';
import {TRADITIONS} from '../../src/schools.js';

export const POSES = {
 compact: {hand:[.30,-.30,-.04],blade:[-65,-50],pelvisYaw:2,chestYaw:-15,pitch:4,drop:.08},
 cross: {hand:[.32,.22,.16],blade:[58,-75],pelvisYaw:0,chestYaw:-12,pitch:0,drop:.05},
 hang: {hand:[.35,-.12,-.16],blade:[-75,-15],pelvisYaw:0,chestYaw:-10,pitch:0,drop:.05},
 roof: {hand:[.28,.32,.12],blade:[10,-80],pelvisYaw:0,chestYaw:-10,pitch:0,drop:.05},
};
export function guardClass(kind) {
 const Parent=kind==='base'?PlayerParryGuard:PathResearchGuard;
 return class extends Parent {
  constructor(me,foe) {
   const tr=TRADITIONS.chinese,original=tr.parryCover;
   const applies=me.swordArt?.tradition==='chinese'&&me.schoolParry!==false;
   if(applies&&['compact','compact-native','cross'].includes(kind)){
    tr.parryCover={...original,lowL:{...original.lowL,...POSES.compact}};
    if(kind==='cross')tr.parryCover.highL={...original.thrust,...POSES.cross,name:'전방 사선 가림 (연구 후보)'};
   }
   if(applies&&kind==='hang')tr.parryCover={...original,lowL:{...original.lowL,...POSES.hang,name:'전방 드리운 가림 (연구 후보)'}};
   if(applies&&kind==='roof')tr.parryCover={...original,highL:{...original.highC,...POSES.roof,name:'머리·목 앞 가로 가림 (연구 후보)'}};
   try{super(me,foe);}finally{tr.parryCover=original;}
   this.researchKind=kind;
   if(applies&&kind==='speed20')this.L={...this.L,parrySpeed:this.L.parrySpeed*1.2};
  }
  step(dt){
   const keep=process.env.PATH_KIND,line=process.env.PATH_LINE;
   process.env.PATH_KIND=['base','compact-native','upper-retain','upper-peak','speed20'].includes(this.researchKind)?'':'low-preview';process.env.PATH_LINE='';
   try{const active=super.step(dt);if(!active)this.upperMemory=null;return active;}finally{process.env.PATH_KIND=keep??'';process.env.PATH_LINE=line??'';}
  }
  selectResearchLine({s,c,d,foeReach,dt}){
   if(!['upper-retain','upper-peak'].includes(this.researchKind)||this.me.swordArt?.tradition!=='chinese'||this.me.schoolParry===false)return null;
   const height=Math.max(s.ty,s.my)-c.y;
   if(d>foeReach+.3||height<.10){this.upperMemory=null;return null;}
   if(s.hy>.15&&height>.25){
    if(this.researchKind==='upper-retain'||!this.upperMemory||s.hy>this.upperMemory.peak+.02){this.upperMemory={line:s.hx>.15?'highL':s.hx<-.15?'highR':'highC',age:0,peak:s.hy};return null;}
    if(s.hy>this.upperMemory.peak-.08){this.upperMemory.age=0;return null;}
   }
   if(this.upperMemory){this.upperMemory.age+=dt;if(this.upperMemory.age<=.35&&height>.25)return this.upperMemory.line;}
   return null;
  }
 };
}

export function vitals(f){return {alive:f.alive,blood:f.blood,bleed:f.bleed,consciousness:f.consciousness,pain:f.pain,balance:f.balance,limbs:{...f.limbs},armed:f.armed,state:f.state,stamina:f.stamina.value};}
export function observeHealth(f,time){
 const r={applied:[],death:null,concussion:0,painAdded:0,balanceLost:0,bleedAdded:0,limbLost:0,downTime:0,exhaustedTime:0,negativeStaminaTime:0,heldTime:0,minBlood:1,minConsciousness:1,minStamina:f.stamina.value};
 const original=f.applyWound.bind(f),die=f.die.bind(f);
 f.die=(cause,...args)=>{const alive=f.alive;const out=die(cause,...args);if(alive&&!f.alive&&!r.death)r.death={t:time(),cause};return out;};
 f.applyWound=h=>{
  if(!f.alive||f.revival)return original(h);
  const a=vitals(f);const out=original(h),b=vitals(f);
  const delta={bleed:Math.max(0,b.bleed-a.bleed),concussion:Math.max(0,a.consciousness-b.consciousness),pain:Math.max(0,b.pain-a.pain),balance:Math.max(0,a.balance-b.balance),limb:Object.keys(a.limbs).reduce((s,k)=>s+Math.max(0,a.limbs[k]-b.limbs[k]),0)};
  r.applied.push({t:time(),zone:h.zone,part:h.part,type:h.type,severity:h.severity,energy:h.energy,delta});
  r.bleedAdded+=delta.bleed;r.concussion+=delta.concussion;r.painAdded+=delta.pain;r.balanceLost+=delta.balance;r.limbLost+=delta.limb;
  return out;
 };
 return {r,step(dt,guard){if(f.alive){if(['down','kneel','getup'].includes(f.state))r.downTime+=dt;if(f.stamina.exhausted)r.exhaustedTime+=dt;if(f.stamina.value<0)r.negativeStaminaTime+=dt;if(guard?.active)r.heldTime+=dt;}r.minBlood=Math.min(r.minBlood,f.blood);r.minConsciousness=Math.min(r.minConsciousness,f.consciousness);r.minStamina=Math.min(r.minStamina,f.stamina.value);},finish(){return {...r,end:vitals(f),bloodLost:1-f.blood,stamina:{spent:{...f.stamina.spent},recovered:f.stamina.recovered,counts:{...f.stamina.counts}},cutHits:r.applied.filter(h=>h.type!=='blunt'&&h.severity>0).length,hits:r.applied.length};}};
}
