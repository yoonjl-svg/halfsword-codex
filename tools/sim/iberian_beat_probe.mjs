import {newRound,DT} from './harness_m.mjs';
import {SKILL} from '../../src/config.js';
import {TECH} from '../../src/ai_techniques.js';
import {PlayerParryGuard} from '../../src/parry_button.js';
import {installIberianBeat} from '../../src/iberian_beat.js';
import {observeHealth} from './iberian_health.mjs';
import * as THREE from 'three';
import {writeFileSync,mkdirSync} from 'node:fs';
export function probe({attack='zornhau',atk='longsword',gap=1.5,gain=0,press=-99,seed=1,counter=false,track=false,direction='side',yieldSeconds=0,impulseCap=3,recoilDegrees=0,recoilSeconds=.28}={}) {
  const tech=TECH.find(t=>t.name===attack);if(!tech)throw Error(attack);
  SKILL.parryAssist=0;
  const G=newRound({weapon:'zweihander',weapon2:atk,gap,seed}),D=G.player,A=G.enemy;
  D.skill.corr=SKILL.corr;D.skill.corrTip=SKILL.corrTip;D.skill.autoGuard=true;D.schoolParry=true;
  const guard=new PlayerParryGuard(D,A);D.stamina.controller=guard;
  const study=installIberianBeat(G.combat,{gain,direction,yieldSeconds,impulseCap,recoilDegrees,recoilSeconds}),health=observeHealth(D,()=>G.t),enemy=observeHealth(A,()=>G.t);
  G.ai.update=()=>{};A.move.set(0,0);
  let phase=0,t0=0,points=null,start=null,first=null,react=Infinity,swipeEnd=0,swipeSign=1;
  const clashes=[],frames=[],commands=[];
  G.combat.hooks.onClash=(p,s,i)=>{if(i.fresh){clashes.push({t:G.t,phase,line:guard.defLine,w:D.skill._cover?.w??0,vn:i.vn,J:i.impulse});if(phase>=3&&first==null){first=G.t;if(counter)react=G.t+.25;}}};
  const go=(f,x,y,speed)=>{const d=new THREE.Vector2(x-f.handOffset.x,y-f.handOffset.y),n=d.length(),st=speed*DT;f.handOffset.add(d.multiplyScalar(n>st?st/n:1));f.skill.aimRaw?.copy(f.handOffset);return n<=st;};
  G.before=()=>{
    guard.held=press===-99||start!=null&&G.t>=start+press;
    guard.broken=G.t<swipeEnd;
    if(G.t>=react){react=Infinity;guard.broken=true;swipeEnd=G.t+.22;swipeSign=-Math.sign(D.handOffset.x||1);commands.push({t:G.t,action:'counterSwipe'});}
    guard.step(DT);D.inputActive=guard.active;D.handHeld=G.t<swipeEnd;
    if(D.handHeld&&!D.stamina.exhausted){D.handOffset.x+=swipeSign*4.5*DT;D.handOffset.y-=4.5*DT;D.inputActive=true;}
    if(phase===0&&G.t>.6)phase=1;
    else if(phase===1&&go(A,...tech.from,3)){phase=2;t0=G.t;start=G.t+.15;}
    else if(phase===2&&G.t-t0>=.15){phase=3;points=tech.path.map(p=>p.slice());}
    else if(phase===3&&go(A,...points[0],11)){points.shift();if(!points.length){phase=4;t0=G.t;}}
  };
  try{
    while(G.t<5&&!(phase===4&&G.t-t0>1.1)&&D.alive&&A.alive){
      G.step();health.step(DT,guard);enemy.step(DT);
      if(track||first!=null&&G.t-first<.8){
        const c=new THREE.Vector3().copy(D.bodies.chest.translation()),r=D.right(new THREE.Vector3()),a=A.bladePoint(0,new THREE.Vector3()),b=A.bladePoint(1,new THREE.Vector3()),ab=b.clone().sub(a);
        const u=THREE.MathUtils.clamp(c.clone().sub(a).dot(ab)/ab.lengthSq(),0,1),near=a.clone().addScaledVector(ab,u),off=b.clone().sub(c);
        frames.push({t:G.t,phase,tip:b.toArray(),root:a.toArray(),defRoot:D.bladePoint(0,new THREE.Vector3()).toArray(),defTip:D.bladePoint(1,new THREE.Vector3()).toArray(),chest:c.toArray(),lat:off.dot(r),height:off.y,clearance:near.distanceTo(c),stamina:D.stamina.value,cover:D.skill._cover?.w??0});
      }
    }
    return {attack,atk,gap,gain,press,seed,counter,direction,yieldSeconds,impulseCap,recoilDegrees,recoilSeconds,start,first,commands,duration:G.t,clashes,beats:study.events,candidates:study.candidates,health:health.finish(),enemy:enemy.finish(),frames};
  }finally{G.eventQueue.free();G.world.free();}
}
if(process.argv[1]?.endsWith('/iberian_beat_probe.mjs')){
 const out=process.env.OUT??'docs/research/iberian_beat_20261018/raw';mkdirSync(out,{recursive:true});
 const attacks=(process.env.ATTACKS??'zornhau,zornhauL,zwerch,zwerchL,oberhau,stichPflug').split(','),atks=(process.env.ATKS??'longsword,zweihander').split(','),gaps=(process.env.GAPS??'1.4,1.6').split(',').map(Number),gains=(process.env.GAINS??'0,.35,.7,1.05,1.4').split(',').map(Number),presses=(process.env.PRESSES??'-99').split(',').map(Number);
 for(const gain of gains){const rows=[];for(const attack of attacks)for(const atk of atks)for(const gap of gaps)for(const press of presses){const r=probe({attack,atk,gap,gain,press,counter:process.env.COUNTER==='1',track:process.env.TRACK==='1',direction:process.env.DIRECTION??'side',yieldSeconds:+(process.env.YIELD??0),impulseCap:+(process.env.CAP??3),recoilDegrees:+(process.env.DEGREES??0),recoilSeconds:+(process.env.RECOIL??.28)});rows.push(r);}
 writeFileSync(`${out}/${process.env.LABEL??'probe'}-${gain}.json`,JSON.stringify(rows));
 console.log(JSON.stringify({gain,n:rows.length,contacts:rows.filter(r=>r.first!=null).length,eligible:rows.filter(r=>r.beats.length).length,beats:rows.reduce((n,r)=>n+r.beats.length,0),cuts:rows.filter(r=>r.health.cutHits).length,dead:rows.filter(r=>!r.health.end.alive).length,limbs:rows.reduce((n,r)=>n+r.health.limbLost,0),enemyLimbs:rows.reduce((n,r)=>n+r.enemy.limbLost,0)}));}
}
