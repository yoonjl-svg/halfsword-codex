// Round 2 listening-only synthesis. No runtime import or commercial samples.
import { makeRng } from '../../src/sound.js';

class Filter {
  constructor(type, frequency, q, sr) { this.type=type; this.sr=sr; this.z1=this.z2=0; this.set(frequency,q); }
  set(f,q) {
    const w=2*Math.PI*f/this.sr, c=Math.cos(w), a=Math.sin(w)/(2*q), d=1+a;
    const b=this.type==='highpass' ? [(1+c)/2,-(1+c),(1+c)/2] : this.type==='lowpass' ? [(1-c)/2,1-c,(1-c)/2] : [a,0,-a];
    [this.b0,this.b1,this.b2]=b.map(x=>x/d); this.a1=-2*c/d; this.a2=(1-a)/d;
  }
  run(x) { const y=this.b0*x+this.z1; this.z1=this.b1*x-this.a1*y+this.z2; this.z2=this.b2*x-this.a2*y; return y; }
}

export function slashDraw(sr, seed, kind='heavy', variant='draw') {
  const r=makeRng(seed), n=()=>r()*2-1, fiber=variant==='fiber';
  const duration=kind==='cut' ? .28 : kind==='through' ? (fiber?.62:.53) : (fiber?.49:.39);
  const out=new Float32Array(Math.round(.95*sr));
  const hp=new Filter('highpass',fiber?650:1000,.707,sr);
  const edge=new Filter('bandpass',5400,.68,sr), flesh=new Filter('bandpass',1800,.62,sr);
  const sheen=new Filter('bandpass',7300,1.3,sr), finish=new Filter('lowpass',10500,.707,sr);
  // Smooth continuous resistance, with irregular microscopic changes. No
  // initial impulse, low sine/thump, fixed-rate buzz or long metallic ring.
  let drift=0, target=0, next=0;
  for(let i=0;i<duration*sr;i++) {
    const t=i/sr, u=t/duration;
    if(i>=next) { target=.68+r()*.45; next=i+Math.round((.007+r()*.013)*sr); }
    drift+=(target-drift)*(1-Math.exp(-1/(sr*.004)));
    const attack=1-Math.exp(-Math.pow(t/(fiber?.021:.017),1.7));
    const envelope=attack*Math.pow(Math.max(0,1-u),.68)*(.88+.12*Math.sin(Math.PI*u));
    if(i%32===0) {
      // Pressure builds while the edge moves, then exits. The broad moving
      // bands describe friction, not a tonal whistle or a separate air whoosh.
      const pressure=Math.sin(Math.PI*Math.min(1,u*1.25));
      edge.set(4500+1900*pressure-1700*u,.68);
      flesh.set((fiber?2000:2400)-800*u,.62);
      sheen.set(7600-2400*u,1.3);
    }
    const x=hp.run(n());
    out[i]=finish.run((.95*edge.run(x)+(fiber?.48:.23)*flesh.run(x)+.13*sheen.run(x))*envelope*drift);
  }
  // Short overlapping tear grains ride the continuous cut; they do not form
  // a second impact or a rhythmic chain of clicks.
  for(let t=.026;t<duration*.9;t+=.008+r()*(fiber?.012:.018)) {
    const d=.010+r()*.018, start=Math.round(t*sr), band=new Filter('bandpass',2500+r()*3000,.8,sr);
    const strength=(fiber?.40:.14)*(.55+r()*.45)*Math.sin(Math.PI*t/duration)**.6;
    for(let k=0;k<d*sr && start+k<out.length;k++) {
      const u=k/(d*sr);
      out[start+k]+=strength*band.run(n())*Math.sin(Math.PI*u)**2;
    }
  }
  // Filter the entire sum, including grains. Very little sub-300 Hz energy.
  const dc=new Filter('highpass',fiber?500:750,.707,sr), lp=new Filter('lowpass',10800,.707,sr);
  let peak=0;
  for(let i=0;i<out.length;i++) { out[i]=lp.run(dc.run(out[i])); peak=Math.max(peak,Math.abs(out[i])); }
  for(let i=0;i<out.length;i++) out[i]*=.85/Math.max(peak,1e-9);
  return out;
}
