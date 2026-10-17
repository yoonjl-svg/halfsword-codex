import {PlayerParryGuard} from '../../src/parry_button.js';
import {PathResearchGuard} from './chinese_path_guard.mjs';
import {TRADITIONS} from '../../src/schools.js';
export const INSIDE_POSE={hand:[.28,.18,-.08],blade:[65,-65],pelvisYaw:0,chestYaw:-10,pitch:0,drop:.05};
// Research only. No speed, force, damage rule or AI intent change.
export function gapGuard(kind){
 if(kind==='base')return PlayerParryGuard;
 return class extends PathResearchGuard{
  constructor(me,foe){
   const tr=TRADITIONS.chinese,original=tr.parryCover;
   if(kind.startsWith('inside')&&me.swordArt?.tradition==='chinese'&&me.schoolParry!==false)
    tr.parryCover={...original,highL:{...original.highC,...INSIDE_POSE,name:'안쪽 사선 가림 (연구)',watch:kind==='inside-ready'}};
   try{super(me,foe);}finally{tr.parryCover=original;}
   this.researchKind=kind;
  }
  step(dt){
   const a=process.env.PATH_KIND,b=process.env.PATH_LINE;process.env.PATH_KIND='';process.env.PATH_LINE='';
   try{const v=super.step(dt);if(!v)this.upperWait=null;return v;}finally{process.env.PATH_KIND=a??'';process.env.PATH_LINE=b??'';}
  }
  researchCoverSense({s,c,d,foeReach,dt}){
   if(this.me.swordArt?.tradition!=='chinese'||this.me.schoolParry===false)return s;
   if(d>foeReach+.3){this.upperWait=null;return s;}
   if(kind==='delay12'){const old=this.sense.seen(.12);return {...s,hx:old.hx,hy:old.hy};}
   if(kind==='gate20'){
    const high=Math.max(s.ty,s.my)-c.y;
    if(s.hy>.15&&high>.3){this.upperWait={hx:s.hx,hy:s.hy,age:0};return s;}
    if(this.upperWait){
     this.upperWait.age+=dt;
     if(high>.3&&this.upperWait.age<=.20)return {...s,hx:this.upperWait.hx,hy:this.upperWait.hy};
     this.upperWait=null;
    }
   }
   return s;
  }
 };
}
