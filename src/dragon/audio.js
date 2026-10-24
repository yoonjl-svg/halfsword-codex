// 첫 조작판의 절제된 합성 효과. 외부 녹음이나 인물 음성 세트를 변경하지 않는다.
export class DragonAudio {
  constructor(){this.ctx=null;this.master=null;this.lastBreath=0;}
  async unlock(){
    if(!this.ctx){const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)return;this.ctx=new C();this.master=this.ctx.createGain();this.master.gain.value=.4;this.master.connect(this.ctx.destination);this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate);const a=this.noise.getChannelData(0);let v=0;for(let i=0;i<a.length;i++){v=(v+(Math.random()*2-1)*.035)/1.035;a[i]=v*5;}}
    await this.ctx.resume();
  }
  pause(on){if(this.ctx)this.master.gain.setTargetAtTime(on?0:.4,this.ctx.currentTime,.05);}
  noiseSound(seconds,frequency,level){if(!this.ctx||this.ctx.state!=='running')return;const c=this.ctx,t=c.currentTime,s=c.createBufferSource(),filter=c.createBiquadFilter(),g=c.createGain();s.buffer=this.noise;s.loop=true;filter.type='lowpass';filter.frequency.setValueAtTime(frequency,t);filter.frequency.exponentialRampToValueAtTime(Math.max(70,frequency*.35),t+seconds);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(level,t+.035);g.gain.exponentialRampToValueAtTime(.001,t+seconds);s.connect(filter);filter.connect(g);g.connect(this.master);s.start();s.stop(t+seconds+.02);}
  tone(freq,seconds,level){if(!this.ctx)return;const c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type='triangle';o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(freq*.76,t+seconds);g.gain.setValueAtTime(level,t);g.gain.exponentialRampToValueAtTime(.001,t+seconds);o.connect(g);g.connect(this.master);o.start();o.stop(t+seconds);}
  event(e){
    if(e.type==='tell'){this.noiseSound(e.attack==='fire'?1.4:.6,230,e.attack==='fire'?.32:.2);this.tone(55,.6,.12);}
    if(e.type==='attack')this.noiseSound(e.attack==='fire'?2.2:.3,e.attack==='fire'?2100:650,.25);
    if(e.type==='block'){this.tone(780,.18,.10);this.tone(1270,.10,.04);this.noiseSound(.12,2300,.13);}
    if(e.type==='hit')this.noiseSound(.15,900,.2);
    if(e.type==='hurt')this.noiseSound(.22,500,.25);
    if(e.type==='victory'){this.noiseSound(1.7,180,.33);this.tone(44,1.6,.15);}
  }
}
