// Narrow implementation/contact diagnostic, not an estimate of human win rate.
import {live} from './japanese_flow_live.mjs';
import {FLOW_REDESIGN} from '../../src/nagashi_redesign.js';
import {installFlowPoses,installAdaptiveFlowPoses} from './japanese_flow_redesign_poses.mjs';
import {FLOW_RECOVERY} from '../../src/nagashi_recovery.js';
export function redesignedTrial({enabled=true,window=.12,naturalExhaust=true,poses='none',onStart,onFrame,...options}={}){
 const restorePoses=installFlowPoses(enabled?poses:'none');
 const prior={...FLOW_REDESIGN},recovery={...FLOW_RECOVERY},flows=[],contacts=[];
 Object.assign(FLOW_REDESIGN,{on:enabled,window,naturalExhaust:enabled&&naturalExhaust});
 Object.assign(FLOW_RECOVERY,{seconds:0,release:enabled});
 try {
  const result=live({...options,onStart(G,g){
   if(poses==='horizontal')installAdaptiveFlowPoses(G);
   const original=G.combat.nagashi.bind(G.combat);
   G.combat.nagashi=(A,B,SA,SB,p,n,vn)=>{
    const D=original(A,B,SA,SB,p,n,vn);
    if(D)flows.push({t:G.t,...G.combat.lastNagashi,dir:G.combat.lastNagashi.dir.toArray()});
    if(enabled)for(const [d,o] of [[A.fighter,B.fighter],[B.fighter,A.fighter]]){
      const e=o.flowContactWindows?.get(d);
      if(e&&d.skill?._cover?.nagashi)contacts.push({t:G.t,d:d.index,o:o.index,point:p.toArray(),vn,active:d.parryGuard?.active??false,line:d.parryGuard?.line,entry:{...e},check:d.flowCheck,attacker:{phase:o.stamina.controller?.phase,time:o.stamina.time,until:o.stamina.attackUntil,kind:o.stamina.flowAttackKind,swinging:!!o.skill.swinging},flow:D===d,spent:o.flowSpentAttack??null});
    }
    return D;
   };onStart?.(G,g);
  },onFrame});
  return {...result,redesign:enabled,window,naturalExhaust,poses,redesignedFlows:flows,redesignedContacts:contacts};
 } finally {restorePoses();Object.assign(FLOW_REDESIGN,prior);Object.assign(FLOW_RECOVERY,recovery);}
}
if(process.argv?.[1]?.endsWith('/japanese_flow_redesign.mjs')){
 const {writeFileSync,mkdirSync}=await import('node:fs');
 const out=process.env.OUT??'/workspace/japanese-flow-redesign-20261017';mkdirSync(out,{recursive:true});
 const cases=JSON.parse(process.env.CASES??'null')??[
  {seed:511,atk:'longsword',policy:'reactive',seconds:23.2},
  {seed:511,atk:'zweihander',policy:'riposte',seconds:20.9},
  {seed:512,atk:'qinggang',policy:'riposte',seconds:6},
  {seed:513,atk:'longsword',policy:'riposte',seconds:10.1},
  {seed:502,atk:'qinggang',policy:'slash',seconds:6},
  {seed:514,atk:'longsword',policy:'riposte',seconds:7.8}];
 for(const enabled of [false,true]){
  const rows=[];for(const c of cases){const r=redesignedTrial({...c,enabled});rows.push(r);
   console.log(JSON.stringify({enabled,...c,flow:r.redesignedFlows.map(f=>({t:f.t,age:f.age,entry:f.entry,penalty:f.penalty})),contacts:r.redesignedContacts.length}));
   writeFileSync(`${out}/contacts-${enabled?'candidate':'base'}.json`,JSON.stringify(rows));
  }
 }
}
