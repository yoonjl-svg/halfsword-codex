// Opt-in research: actual-contact talho/reves beat, no automatic production install.
import * as THREE from 'three';
const V = p => new THREE.Vector3().copy(p);
const along = (f, p) => {
  const a=f.bladePoint(0,new THREE.Vector3()), b=f.bladePoint(1,new THREE.Vector3()), ab=b.sub(a);
  const u=V(p).sub(a).dot(ab)/Math.max(1e-8,ab.lengthSq());
  return {u, p:a.addScaledVector(ab,u)};
};
const velocity = (s,p) => s.w.clone().cross(V(p).sub(s.com)).add(s.v);
export const IBERIAN_BEAT = Object.freeze({gain:.7, speedCap:4, impulseCap:3, minSpeed:.6, coverWeight:.15, cooldown:.6, direction:'side', yieldSeconds:0, yieldScale:.35});
export function beatArmScale(f) {
  const s=f.iberianYield;if(!s)return 1;
  const t=f.stamina.time-s.start;
  if(t>=s.duration||!f.alive||!f.armed){f.iberianYield=null;return 1;}
  return s.scale+(1-s.scale)*THREE.MathUtils.smoothstep(t,s.duration*.35,s.duration);
}
export function installIberianBeat(combat, options={}) {
  const cfg={...IBERIAN_BEAT,...options}, events=[], candidates=[], last=new Map();
  combat.iberianBeat = ({A,B,point,nrm,vn,J,gripMass,liveState,handMass}) => {
    for (const [D,O] of [[A,B],[B,A]]) {
      if (D.swordArt?.tradition!=='iberian'||D.schoolParry===false||!D.alive||!O.alive||!D.armed||!O.armed||D.stamina.exhausted) continue;
      const st=D.skill?._cover, g=D.parryGuard??st?.ai;
      const active=D.parryGuard?g.active&&g.held&&!g.broken:g?.mode==='defend'&&!g.defVoid;
      if (!active||g.mode!=='defend'||!['highL','highR'].includes(g.defLine)||!st?.own||st.w<cfg.coverWeight) continue;
      const pd=along(D,point),po=along(O,point),c=V(D.bodies.chest.translation()),right=D.right(new THREE.Vector3());
      const lat=V(point).sub(c).dot(right), toward=c.clone().sub(point).normalize(), vo=velocity(O.cache.sword,point);
      const time=combat.stepNo*combat.dt;
      const row={time,d:D.index,o:O.index,line:g.defLine,w:st.w,vn,J,atD:pd.u,atO:po.u,incoming:vo.dot(toward),lat,attackId:O.stamina.attackId};
      candidates.push(row);
      // A beat can strike an incoming blade from its side, even when the contact
      // point itself is already moving away. Require a moving opponent blade and
      // genuine closing contact; don't reward hitting a motionless held weapon.
      if(vn<cfg.minSpeed||vo.length()<1||pd.u<-.08||pd.u>1.1||po.u<-.08||po.u>1.1)continue;
      const prev=last.get(D);
      if(prev&&(time-prev.time<cfg.cooldown||prev.opponent===O&&prev.id===O.stamina.attackId))continue;
      last.set(D,{time,opponent:O,id:O.stamina.attackId});
      const sign=Math.abs(lat)>.04?Math.sign(lat):(g.defLine==='highL'?-1:1);
      const dir=right.clone().multiplyScalar(sign);
      if(cfg.direction==='normal')dir.copy(nrm).multiplyScalar(D===A?1:-1);
      const md=gripMass(D.swordProps,liveState(D.sword),pd.p,dir,handMass);
      const mo=gripMass(O.swordProps,liveState(O.sword),po.p,dir,handMass);
      const mass=1/(1/md+1/mo), dv=Math.min(cfg.speedCap,cfg.gain*vn), impulse=Math.min(cfg.impulseCap,mass*dv);
      const beforeO=V(O.sword.velocityAtPoint(po.p)),beforeD=V(D.sword.velocityAtPoint(pd.p));
      if(impulse>0){O.sword.applyImpulseAtPoint(dir.clone().multiplyScalar(impulse),po.p,true);D.sword.applyImpulseAtPoint(dir.clone().multiplyScalar(-impulse),pd.p,true);}
      if(impulse>0&&cfg.yieldSeconds>0)O.iberianYield={start:O.stamina.time,duration:cfg.yieldSeconds,scale:cfg.yieldScale};
      const e={...row,dir:dir.toArray(),md,mo,dv,impulse,point:V(point).toArray(),deltaO:V(O.sword.velocityAtPoint(po.p)).sub(beforeO).toArray(),deltaD:V(D.sword.velocityAtPoint(pd.p)).sub(beforeD).toArray()};
      events.push(e);combat.lastIberianBeat=e;return;
    }
  };
  return {cfg,events,candidates};
}
