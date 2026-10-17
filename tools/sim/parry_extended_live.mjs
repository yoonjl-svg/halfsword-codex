import {newRound,DT} from './harness_m.mjs';
import {PlayerParryGuard} from '../../src/parry_button.js';
import {ExtendedGuard} from './parry_extended_guard.mjs';
import {SKILL,NAGASHI} from '../../src/config.js';
import {writeFileSync} from 'node:fs';
const Guard=process.env.READ_KIND?ExtendedGuard:PlayerParryGuard;
const [a,b]=(process.env.SEEDS??'1-10').split('-').map(Number),seconds=+(process.env.SECONDS??120),damage=process.env.DAMAGE==='1';
const result=[];
for(let seed=a;seed<=b;seed++){
 SKILL.parryAssist=0;NAGASHI.on=1;
 const G=newRound({weapon:process.env.DEF??'uchigatana',weapon2:process.env.ATK??'longsword',gap:2.2,seed});
 const D=G.player,A=G.enemy;D.skill.corr=SKILL.corr;D.skill.corrTip=SKILL.corrTip;D.skill.autoGuard=true;
 if(!damage)D.applyWound=()=>{};
 const guard=new Guard(D,A);guard.held=true;
 const r={seed,kind:process.env.READ_KIND??'baseline',damage,fresh:0,flows:0,threatTime:0,switches:0,wounds:[],activations:0,changes:[]};let line=null,lock=false;
 const prev=G.combat.hooks.onClash;
 G.combat.hooks.onClash=(p,s,info)=>{prev?.(p,s,info);if(info.fresh)r.fresh++;if(info.nagashi)r.flows++;};
 G.onWound=(att,vic,w)=>{if(vic===D)r.wounds.push({t:G.t,type:w.type,zone:w.zone,energy:w.energy,severity:w.severity});};
 G.before=()=>{guard.step(DT);D.inputActive=guard.active;if(guard.mode==='defend')r.threatTime+=DT;if(line!==guard.line){if(line)r.switches++;line=guard.line;}const locked=!!guard.readDebug;if(locked&&!lock){r.activations++;r.changes.push({t:G.t,line,foeMode:G.ai.mode});}lock=locked;};
 while(G.t<seconds&&A.alive&&D.alive)G.step();
 r.duration=G.t;r.alive=D.alive;r.blood=D.blood;r.cuts=r.wounds.filter(w=>w.type!=='blunt').length;r.significant=r.wounds.filter(w=>w.type!=='blunt'&&w.severity>0).length;r.energy=r.wounds.filter(w=>w.type!=='blunt').reduce((s,w)=>s+w.energy,0);
 G.eventQueue.free();G.world.free();result.push(r);
 const {wounds,changes,...summary}=r;console.log(JSON.stringify(summary));
}
if(process.env.OUT)writeFileSync(process.env.OUT,JSON.stringify(result,null,1));
