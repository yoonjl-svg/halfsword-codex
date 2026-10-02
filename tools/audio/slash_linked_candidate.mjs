// Round 3 listening candidates: one connected cut -> resistance -> clearing.
// Original procedural audio. Never imported by the game runtime.
import { makeRng } from '../../src/sound.js';

class Filter {
  constructor(type,f,q,sr) {this.type=type;this.sr=sr;this.z1=this.z2=0;this.set(f,q);}
  set(f,q) {
    const w=2*Math.PI*f/this.sr,c=Math.cos(w),a=Math.sin(w)/(2*q),d=1+a;
    const b=this.type==='highpass'?[(1+c)/2,-(1+c),(1+c)/2]:this.type==='lowpass'?[(1-c)/2,1-c,(1-c)/2]:[a,0,-a];
    [this.b0,this.b1,this.b2]=b.map(x=>x/d);this.a1=-2*c/d;this.a2=(1-a)/d;
  }
  run(x) {const y=this.b0*x+this.z1;this.z1=this.b1*x-this.a1*y+this.z2;this.z2=this.b2*x-this.a2*y;return y;}
}
const smooth=u=>{u=Math.min(1,Math.max(0,u));return u*u*(3-2*u);};
const curves={
  stroke:[[0,0],[.004,.38],[.014,1],[.032,.88],[.066,.32],[.100,.43],[.160,.24],[.235,.035],[.285,0]],
  hew:[[0,0],[.005,.34],[.016,1],[.038,.87],[.078,.48],[.120,.64],[.180,.29],[.275,.04],[.345,0]],
};
export function slashLinked(sr,seed,kind='heavy',variant='stroke') {
  if(!curves[variant])throw Error('Unknown linked slash variant');
  const r=makeRng(seed),n=()=>r()*2-1,bold=variant==='hew';
  const scale=kind==='cut'?.78:kind==='through'?1.2:1;
  const curve=curves[variant],duration=curve.at(-1)[0]*scale;
  const out=new Float32Array(Math.round(.95*sr));
  const hp=new Filter('highpass',420,.707,sr),edge=new Filter('bandpass',4200,.65,sr);
  const tissue=new Filter('bandpass',1900,.68,sr),sheen=new Filter('bandpass',6000,1.05,sr);
  const lp=new Filter('lowpass',9500,.707,sr);
  let segment=0,grain=1,target=1,next=0;
  for(let i=0;i<duration*sr;i++) {
    const t=i/sr,local=t/scale;
    while(segment<curve.length-2 && local>curve[segment+1][0])segment++;
    const [ta,aa]=curve[segment],[tb,ab]=curve[segment+1];
    const envelope=aa+(ab-aa)*smooth((local-ta)/(tb-ta));
    // Grain begins at full value: no additional slow fade-in hiding the cut.
    if(i>=next){target=.86+r()*.28;next=i+Math.round((.004+r()*.008)*sr);}
    grain+=(target-grain)*(1-Math.exp(-1/(sr*.0018)));
    const transition=smooth((local-.035)/.10);
    const clearing=smooth((local-.095)/.12);
    if(i%24===0){
      edge.set(4300-1400*transition+1100*clearing,.65);
      tissue.set((bold?1850:2200)-700*transition,.68);
      sheen.set(6200-1700*transition,1.05);
    }
    const x=hp.run(n());
    // The material layer is strongest during entry/resistance; as the edge
    // clears it thins continuously. No separate thud or appended hiss burst.
    const material=(bold?1.13:.94)*(1-.70*clearing);
    out[i]=lp.run((.83*edge.run(x)+material*tissue.run(x)+.065*sheen.run(x))*envelope*grain);
  }
  // A few smoothly windowed micro-tears under the same pressure arc. They
  // occur inside the connected cut, never as an isolated final impact.
  for(let t=.007;t<.15*scale;t+=(.009+r()*.016)*scale){
    const d=(.007+r()*.011)*scale,start=Math.round(t*sr);
    const bp=new Filter('bandpass',1500+r()*2600,.75,sr);
    const amp=(bold?.21:.13)*Math.exp(-t/(.11*scale));
    for(let k=0;k<d*sr && start+k<out.length;k++)out[start+k]+=amp*bp.run(n())*Math.sin(Math.PI*k/(d*sr))**2;
  }
  const clean=new Filter('highpass',350,.707,sr),finish=new Filter('lowpass',10000,.707,sr);
  let peak=0;
  for(let i=0;i<out.length;i++){out[i]=finish.run(clean.run(out[i]));peak=Math.max(peak,Math.abs(out[i]));}
  for(let i=0;i<out.length;i++)out[i]*=.85/Math.max(peak,1e-9);
  return out;
}
