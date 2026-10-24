import { TRADITIONS } from '../schools.js';
import { AI_LEVELS, SKILL } from '../config.js';
import { installCover } from '../frames.js';

// 비인간 표적의 약공격을 받는 전용 컨트롤러. 기존 유파 자세 표를 읽기만 한다.
export class DragonGuard {
  constructor(f) {
    this.me=f; this.held=false; this.broken=false; this.mode='idle'; this.line='highC'; this.defLine=null;
    f.stamina.controller=this; f.parryGuard=this;
    const covers=TRADITIONS[f.swordArt?.tradition]?.parryCover;
    if(covers) installCover(f,this,covers);
  }
  step(dt) {
    const f=this.me,sk=f.skill;
    sk.guardDrive=0;
    const on=this.held&&!this.broken&&f.alive&&f.armed&&!f.weapon?.gun&&!f.stamina.exhausted&&!sk.tap&&!sk.sec;
    this.mode=on?'defend':'idle'; this.defLine=on?this.line:null;
    if(!on) return;
    const school=f.swordArt?.school;
    const p=school?.parry?.[this.line]||school?.pose?.point||[0.1,.3];
    const dx=p[0]-f.handOffset.x,dy=p[1]-f.handOffset.y,dd=Math.hypot(dx,dy);
    const speed=AI_LEVELS.normal.parrySpeed*(f.swordArt?.tradition==='chinese'?SKILL.cnParrySpeedK:1);
    const k=Math.min(1,speed*dt/(dd||1)),mx=dx*k,my=dy*k;
    f.handOffset.x+=mx; f.handOffset.y+=my; sk.prev.x+=mx; sk.prev.y+=my;
    sk.guardDrive=Math.hypot(mx,my)/dt; sk.recovering=false; sk.cutPending=false;
  }
  woundKeep(){return 1;}
}
