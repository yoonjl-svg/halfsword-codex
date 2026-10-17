// Research: preserve acquired lines only during the corresponding physical stroke.
export function bladeDanger(s,c,horizon=.12) {
  // Test the tip-to-hit-point span, not just the closest horizontal instant.
  let first=null;
  for(let i=0;i<=4;i++){
    const k=i/4;
    const p={x:s.mx+(s.tx-s.mx)*k,y:s.my+(s.ty-s.my)*k,z:s.mz+(s.tz-s.mz)*k};
    const v={x:s.mvx+(s.tvx-s.mvx)*k,y:s.mvy+(s.tvy-s.mvy)*k,z:s.mvz+(s.tvz-s.mvz)*k};
    if(Math.hypot(v.x,v.y,v.z)<3.5)continue;
    for(let t=0;t<=horizon+1e-9;t+=.02){
      const x=p.x+v.x*t-c.x,y=p.y+v.y*t-c.y,z=p.z+v.z*t-c.z;
      if(x*x+z*z<.45*.45&&y> -1.2&&y<.65&&(!first||t<first.t))first={t,y};
    }
  }
  return first;
}
export class BladeReader {
  constructor(kind='hybrid'){this.kind=kind;this.t=0;this.fast=false;this.lock=null;this.lastFast=-Infinity;this.safe=0;}
  update(s,{c,d,reach,prior,th,dt}){
    this.t+=dt;
    const speed=Math.hypot(s.hvx,s.hvy),fast=speed>=4.5,tipH=s.ty-c.y;
    if(fast)this.lastFast=this.t;
    const incoming=bladeDanger(s,c);
    if(fast&&!this.fast&&d<reach+.9){
      if(['central','hybrid'].includes(this.kind)&&prior==='highC'&&Math.abs(s.hx)<.10&&tipH>.5)this.lock={line:prior,t:this.t,kind:'central'};
      if(['rise','hybrid'].includes(this.kind)&&/^low/.test(prior??'')&&s.hvy>3&&tipH<.1)this.lock={line:prior,t:this.t,kind:'rise'};
    }
    this.fast=fast;
    if(this.kind==='danger'&&prior&&incoming&&this.t-this.lastFast<.3){
      this.lock??={line:prior,t:this.t,kind:'danger'};
    }
    if(this.lock){
      const k=this.lock.kind;
      this.safe=incoming?0:this.safe+dt;
      if(th?.thrust||d>reach+.9||this.t-this.lock.t>.5||
        (k==='central'&&(Math.abs(s.hx)>.15||(tipH<.15&&s.tvy<0)))||
        (k==='rise'&&tipH>.25)||
        (k==='danger'&&this.safe>.05))this.lock=null;
    }
    return this.lock?.line??null;
  }
}
