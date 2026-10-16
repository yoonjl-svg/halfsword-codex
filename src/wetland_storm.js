// Visual clock only. One or two flashes per ten-second block, one optional
// delayed rumble for the entire group. No combat RNG or wall-clock timers.
export function createWetlandStorm(seed = 161026) {
  let s=seed>>>0,time=0,block=0,lastFlash=-100,amp=0,duration=.25;
  const random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
  const queue=[];
  const state={time:0,flash:0,flashes:0,thunders:0,group:0};
  function schedule(){
    const group=block++,first=(group*10)+2+random()*4;
    const times=random()<.58?[first,first+.65+random()*1.05]:[first];
    for(const at of times)queue.push({type:'flash',at,amp:.75+random()*.25,duration:.22+random()*.09,group});
    if(random()<.8)queue.push({type:'thunder',at:times.at(-1)+1.3+random()*1.1,amp:.65+random()*.3,group,flashes:times.length});
    queue.sort((a,b)=>a.at-b.at);
  }
  schedule();
  return {state,update(dt,onEvent){
    if(!Number.isFinite(dt)||dt<=0)return state;
    time+=dt;while(time>=(block-1)*10)schedule();
    while(queue.length&&queue[0].at<=time){
      const e=queue.shift();state.group=e.group;
      if(e.type==='flash'){lastFlash=e.at;amp=e.amp;duration=e.duration;state.flashes++}
      else state.thunders++;
      onEvent?.(e);
    }
    const age=time-lastFlash;
    // Fast rise, a brief crest, then a soft tail; no rapid secondary strobe.
    state.flash=age<0||age>=duration?0:amp*Math.min(1,age/.018)*Math.exp(-Math.max(0,age-.055)*16);
    state.time=time;return state;
  }};
}
