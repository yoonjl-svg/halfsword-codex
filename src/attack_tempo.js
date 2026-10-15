import { STAMINA } from './config.js';

// Gesture recognition keeps the original, real-time input clock. The delayed
// physical command must not split one stroke or change a school's input rule.
export function observeTempoInput(skill, dt) {
  const f = skill.f;
  if (!STAMINA.attackTempo || !STAMINA.tempoInput || f.aiControlled || f.stamina.guarding) {
    skill.inputMotion = null;
    return;
  }
  const m = skill.inputMotion ??= { prev: skill.prev.clone(), vel: skill.vel.clone() };
  const k = 1 - Math.exp(-dt * 25);
  m.vel.x += ((f.handOffset.x - m.prev.x) / dt - m.vel.x) * k;
  m.vel.y += ((f.handOffset.y - m.prev.y) / dt - m.vel.y) * k;
  m.prev.copy(f.handOffset);
}

// Preserve a freehand stroke's ordered path while advancing its command clock.
// It affects human attack targets only; defence and scripted moves own their clocks.
export function tempoHand(skill, dt) {
  const f=skill.f, raw=f.handOffset, speed=f.stamina.attackSpeed;
  const enabled=STAMINA.attackTempo&&STAMINA.tempoInput&&!f.aiControlled&&speed>0&&speed<1&&!f.stamina.guarding&&!skill.tap&&!skill.pom&&!skill.sec&&!f.iai&&!skill.recovering&&f.state==='stand';
  if(!enabled){
    if(skill.recovering&&!f.inputActive&&skill.tempoInput)raw.copy(skill.tempoInput.out);
    skill.tempoInput=null;return raw;
  }
  let q=skill.tempoInput;
  if(!q) q=skill.tempoInput={now:0,play:0,points:[{t:0,x:skill.prev.x,y:skill.prev.y}],out:raw.clone()};
  q.now+=dt;
  q.points.push({t:q.now,x:raw.x,y:raw.y});
  q.play+=dt*speed;
  // Bound latency during a continuous gesture. Once a stroke settles, drain its tail.
  q.play=Math.max(q.play,q.now-0.6);
  while(q.points.length>2&&q.points[1].t<=q.play)q.points.shift();
  const a=q.points[0],b=q.points[1]??a,k=Math.min(1,Math.max(0,(q.play-a.t)/(b.t-a.t||1)));
  q.out.set(a.x+(b.x-a.x)*k,a.y+(b.y-a.y)*k);
  q.pending=q.out.distanceTo(raw)>=1e-7||q.points.some(p=>Math.hypot(p.x-raw.x,p.y-raw.y)>=1e-7);
  if(q.out.distanceTo(raw)<1e-7&&q.points.every(p=>Math.hypot(p.x-raw.x,p.y-raw.y)<1e-7)){
    q.now=q.play=0;q.points=[{t:0,x:raw.x,y:raw.y}];
    q.pending=false;
  }
  return q.out;
}
