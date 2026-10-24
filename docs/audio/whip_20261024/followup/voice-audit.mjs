// Observe current voice loading and dispatch without changing voice assignments or playing hardware audio.
import {Sound,VOICES} from '../../../../src/sound.js';
import {CHARACTERS_BY_ID} from '../../../../src/characters.js';
import fs from 'node:fs';import assert from 'node:assert/strict';
const results=[];
for(const id of ['roland','white_scale','bernardo']){
 const ch=CHARACTERS_BY_ID[id],s=new Sound(),layers=[],synth=[];
 s.ctx={sampleRate:44100,createBuffer:(_n,len,sr)=>({data:new Float32Array(len),sampleRate:sr,getChannelData(){return this.data;}})};
 s.useSamples=true;s.runJobs=jobs=>{for(const job of jobs)s.makeOne(job.name);};
 s.loadSample=async(name,file)=>{(s.samples[name]??=[]).push({file});};
 s.event=()=>({});s.layer=(_ev,buf)=>{if(buf)layers.push(buf.file??'synth');};
 const make=s.makeOne.bind(s);s.makeOne=name=>{synth.push(name);return make(name);};
 s.prepareVoices(['player',ch.voice]);await s.voicesReady;
 const loaded=Object.keys(s.samples).filter(x=>!x.includes(':player:'));
 layers.length=0;s.hurt(ch.voice,.8);const hurt=[...layers];
 layers.length=0;synth.length=0;s.death(ch.voice,'출혈');const bleed=[...layers],synthOnDeath=[...synth];
 results.push({id,name:ch.name,declaredVoice:ch.voice,profileExists:!!VOICES[ch.voice],loaded,hurt,bleed,synthOnDeath});
}
assert(results[0].hurt.length===1&&results[2].hurt.length===1);
const w=results[1];assert.equal(w.profileExists,false);assert.equal(w.loaded.length,0);assert.equal(w.hurt.length,0);assert.deepEqual(w.synthOnDeath,['voice:generic:bleed']);
const out={receiverBase:'f29ed8178cfb652542d30f9e85ce7b3de44f8fc7',scope:'Actual character and Sound lookup/loading/dispatch, mocked file decoding and output nodes; no character assignment changes',results};
fs.writeFileSync(new URL('voice-audit.json',import.meta.url),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
