// Research: derive a guard line from visible blade position/velocity only.
// No AI intent, named attacks, scripted phases or future contact timestamps.
export function bladeFrame(s,c,right) {
 const points=[['t','tv'],['m','mv']].map(([p,v])=>{
  const x=s[p+'x']-c.x,y=s[p+'y']-c.y,z=s[p+'z']-c.z;
  const vx=s[v+'x'],vy=s[v+'y'],vz=s[v+'z'];
  const lat=x*right.x+z*right.z;
  const h=Math.hypot(x,z),closing=h>1e-5?-(x*vx+z*vz)/h:0;
  const t=Math.max(0,Math.min(.25,-(x*vx+z*vz)/(vx*vx+vz*vz+1e-6)));
  return {y,lat,h,closing,vy,speed:Math.hypot(vx,vy,vz),miss:Math.hypot(x+vx*t,z+vz*t),eta:t};
 });
 return {points,low:points.reduce((a,b)=>a.y<b.y?a:b),high:points.reduce((a,b)=>a.y>b.y?a:b),incoming:points.some(p=>p.closing>.35&&p.speed>3.5&&p.miss<.65)};
}
export class PathReader {
 constructor(kind){this.kind=kind;this.lowHeld=false;this.lock=null;this.age=0;this.clear=0;}
 update(s,{c,right,d,reach,dt,th}) {
  const f=bladeFrame(s,c,right);const near=d<reach+.3;
  if(!near){this.lowHeld=false;this.lock=null;return {line:null,reason:'outside',...f};}
  // Low left blade stays low until it has cleared the lower body.
  if(f.low.y<-.55&&f.low.lat<-.08)this.lowHeld=true;
  if(f.low.y>-.15||f.low.lat>.15)this.lowHeld=false;
  if(this.kind==='low-preview')return {line:this.lowHeld?'lowL':null,reason:'low-blade',...f};
  let line;
  if(f.low.y<-.35)line=f.low.lat<=0?'lowL':'lowR';
  else if(f.high.y>.45)line=Math.abs(f.high.lat)<.25?'highC':f.high.lat<0?'highL':'highR';
  else line='thrust';
  if(this.kind==='blade-hold'){
   this.age+=dt;this.clear=f.incoming?0:this.clear+dt;
   if(this.lock&&(this.age>.35||this.clear>.08))this.lock=null;
   if(!this.lock&&f.incoming){this.lock=line;this.age=0;this.clear=0;}
   if(this.lock)line=this.lock;
  }
  return {line,reason:this.lock?'incoming-hold':'blade-height',...f};
 }
}
