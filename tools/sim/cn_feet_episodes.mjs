// Read-only episode telemetry. It never sets movement, draws random numbers,
// or changes AI state. Distance is chest-to-chest; displacement is pelvis path.
export function feetEpisodes(ai, world, dt) {
  const f=ai.me, out={shuffle:[],withdraw:[],defend:[]};
  let current=null, sampled=null, serial=0;
  const original=ai.moveFeet;
  ai.moveFeet=function(...args){
    const before=this.shuffleTimer;
    const result=original.apply(this,args);
    const d=args[1],err=d-this.holdDist();
    const kind=this.mode==='watch'&&Math.abs(err)<.12&&Math.abs(this.foeClosing)<.3?'shuffle':['withdraw','defend'].includes(this.mode)?this.mode:null;
    if(kind==='shuffle'&&this.shuffleTimer>before)serial++;
    sampled={kind,serial};
    return result;
  };
  const finish=()=>{if(current){current.endGap=f.foeDistance();current.endError=current.endGap-ai.holdDist();out[current.kind].push(current);current=null;}};
  return {
    tick(t){
      const kind=f.alive&&f.state==='stand'?sampled?.kind:null;
      if(current&&(current.kind!==kind||(kind==='shuffle'&&current.serial!==sampled.serial)))finish();
      const p=f.bodies.pelvis.translation(),d=f.foeDistance();
      if(kind&&!current)current={kind,serial:sampled.serial,start:t,startGap:d,seconds:0,path:0,exposed:0,hits:0,heavyHead:0,guardContacts:0,x:p.x,z:p.z,block:f.stamina.counts.block,wounds:world.wounds.length};
      if(current){
        current.seconds+=dt;current.path+=Math.hypot(p.x-current.x,p.z-current.z);current.x=p.x;current.z=p.z;
        if(d<ai.foeReach)current.exposed+=dt;
        current.guardContacts+=Math.max(0,f.stamina.counts.block-current.block);current.block=f.stamina.counts.block;
        for(;current.wounds<world.wounds.length;current.wounds++){const w=world.wounds[current.wounds];if(w.vic===f){current.hits++;if(w.energy>45&&/head|neck|face/.test(w.zone))current.heavyHead++;}}
      }
      sampled=null;
    },
    finish(){finish();ai.moveFeet=original;return out;},
  };
}
