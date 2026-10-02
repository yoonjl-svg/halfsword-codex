// Isolated listening candidates. Never imported by game runtime.
// Original procedural layers; no sampled commercial game audio.
import { makeRng } from '../../src/sound.js';

class Filter {
  constructor(type, f, q, sr) { this.type = type; this.sr = sr; this.z1 = this.z2 = 0; this.set(f, q); }
  set(f, q) {
    const w = 2 * Math.PI * f / this.sr, c = Math.cos(w), a = Math.sin(w) / (2 * q), d = 1 + a;
    let b;
    if (this.type === 'highpass') b = [(1+c)/2, -(1+c), (1+c)/2];
    else if (this.type === 'lowpass') b = [(1-c)/2, 1-c, (1-c)/2];
    else b = [a, 0, -a];
    [this.b0,this.b1,this.b2] = b.map(x=>x/d); this.a1 = -2*c/d; this.a2 = (1-a)/d;
  }
  run(x) { const y = this.b0*x+this.z1; this.z1=this.b1*x-this.a1*y+this.z2; this.z2=this.b2*x-this.a2*y; return y; }
}

export function slashReview(sr, seed, kind = 'heavy', variant = 'edge') {
  const r = makeRng(seed), noise = () => 2*r()-1;
  const bold = variant === 'cleave', heavy = kind !== 'cut', through = kind === 'through';
  const out = new Float32Array(Math.round(.9*sr));
  // A blade entering material: broad, brief, moving band, no metallic resonator/click.
  const hp = new Filter('highpass', 1500, .65, sr), edge = new Filter('bandpass', 5700, .58, sr);
  const duration = heavy ? .065 : .049;
  for (let i=0; i<duration*sr; i++) {
    const t=i/sr, u=t/duration;
    if (i%32===0) edge.set(6200*Math.pow(.40,u),.58);
    const e=(1-Math.exp(-t/.0011))*Math.pow(1-u,1.9);
    out[i]+=(bold ? .84 : 1.2)*edge.run(hp.run(noise()))*e;
  }
  // Material resistance: irregular overlapping grains, not 70 Hz modulation or bit crush.
  const tearDur = through ? .24 : heavy ? (bold ? .185 : .142) : .102;
  const band = new Filter('bandpass',bold ? 1500 : 2000,.62,sr);
  const high = new Filter('bandpass',4000,.65,sr);
  const grains=[];
  for(let t=.003; t<tearDur; t+=.006+r()*.014) grains.push({t,d:.012+r()*.022,a:.45+r()*.55});
  for(let i=0;i<(tearDur+.045)*sr;i++) {
    const t=i/sr, u=Math.min(1,t/tearDur);
    let env=0;
    for(const g of grains) { const p=(t-g.t)/g.d; if(p>0&&p<1) env+=g.a*Math.sin(Math.PI*p)**1.6; }
    env=Math.min(1.25,env)*Math.pow(1-u, .8);
    if(i%32===0) { band.set((bold?1800:2400)*Math.pow(.42,u),.62); high.set(4500*Math.pow(.55,u),.65); }
    const n=noise(), x=band.run(n), h=high.run(n);
    out[i]+=(bold?1.55:1.03)*(Math.tanh(x*1.25)/1.25+.29*h)*env;
  }
  // A short displacement, audible in lower mids as well as bass. No sustained cinematic boom.
  const meat = new Filter('bandpass',bold?340:450,.6,sr);
  let ph=0;
  for(let i=0;i<.22*sr;i++) {
    const t=i/sr; ph+=2*Math.PI*(82+43*Math.exp(-t/.015))/sr;
    const e=(1-Math.exp(-t/.002))*Math.exp(-t/(bold?.036:.025));
    out[i]+=(bold?.20:.11)*Math.sin(ph)*e+(bold?.24:.15)*meat.run(noise())*e;
  }
  // Uneven wet release. Each packet dies away; no long, uniform spray/noise bed.
  const packets=through ? [.036,.088,.16,.245,.33] : heavy ? [.031,.074,.13,.205] : [.026,.061,.105];
  packets.forEach((start,j)=>{
    const d=(bold?.105:.072)*(1+.13*j), bp=new Filter('bandpass',2700-j*260,.65,sr);
    const onset=start+(r()-.5)*.007, amp=(bold?.39:.27)*Math.pow(.63,j);
    for(let k=0;k<d*sr;k++) {
      const u=k/(d*sr), idx=Math.round(onset*sr)+k;
      if(idx<out.length) out[idx]+=amp*bp.run(noise())*Math.sin(Math.PI*u)**1.2*Math.exp(-2*u);
    }
  });
  const dc = new Filter('highpass',35,.707,sr), lp=new Filter('lowpass',10500,.707,sr);
  let peak=0;
  for(let i=0;i<out.length;i++){out[i]=lp.run(dc.run(out[i])); peak=Math.max(peak,Math.abs(out[i]));}
  for(let i=0;i<out.length;i++) out[i]*=.85/Math.max(peak,1e-9);
  return out;
}
