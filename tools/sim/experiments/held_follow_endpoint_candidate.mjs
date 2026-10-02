// Isolated Q04 held endpoint; only Skill follow/aimRaw transition changes.
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const skillURL=new URL('../../../src/skill.js',import.meta.url),sha=x=>createHash('sha256').update(x).digest('hex');
function once(s,a,b){if(s.split(a).length!==2)throw Error('Held endpoint marker mismatch:'+a);return s.replace(a,b);}
const helpers=`
const heldEndpointStates=new WeakMap();
export function heldEndpointInfo(skill){const s=heldEndpointStates.get(skill);return s?{calls:s.calls,latched:!!s.endpoint,latchedCalls:s.latchedCalls,events:structuredClone(s.events),endpoint:s.endpoint?.toArray()??null,inputEndpoint:s.inputEndpoint?.toArray()??null,followEndpoint:s.followEndpoint?.toArray()??null}:null;}
function heldEndpointBegin(skill,enabled,swinging){
 const f=skill.f,off=f.handOffset;
 let s=heldEndpointStates.get(skill);
 if(!s){s={calls:0,latchedCalls:0,events:[],endpoint:null,inputEndpoint:null,followEndpoint:null,previousOff:off.clone(),previousActive:false,previousSwinging:false,sawInput:false};heldEndpointStates.set(skill,s);}
 s.calls++;
 const changed=off.distanceToSquared(s.previousOff)>1e-24;
 const actualInput=!!f.inputActive||changed;
 if(s.endpoint&&(!f.handHeld||actualInput)){
  s.events.push({kind:!f.handHeld?'release_reset':'new_input_rearm',call:s.calls,off:off.toArray()});s.endpoint=null;s.inputEndpoint=null;s.followEndpoint=null;
 }
 if(actualInput)s.sawInput=true;
 const stoppedHeld=enabled&&f.handHeld&&!actualInput&&!swinging&&s.sawInput&&(s.previousActive||s.previousSwinging);
 if(!s.endpoint&&stoppedHeld){
  s.endpoint=skill.aimRaw.clone();s.inputEndpoint=off.clone();s.followEndpoint=skill.follow.clone();
  s.events.push({kind:'latch',call:s.calls,off:off.toArray(),endpoint:s.endpoint.toArray(),follow:skill.follow.toArray()});
 }
 s.previousOff.copy(off);s.previousActive=actualInput;s.previousSwinging=swinging;
 if(s.endpoint)s.latchedCalls++;
 return s;
}
`;
export function transformHeldFollowEndpoint(source,{enabled=true}={}){
 let s=once(source,'    this.swinging = swinging;','    this.swinging = swinging;\n    const heldEndpoint = heldEndpointBegin(this,'+enabled+',swinging);');
 s=once(s,'    this.follow.multiplyScalar(Math.exp(-dt / SKILL.followDecay));','    if (!heldEndpoint.endpoint) this.follow.multiplyScalar(Math.exp(-dt / SKILL.followDecay));');
 s=once(s,'    this.aimRaw.copy(this.anchor).add(this.follow);','    if (heldEndpoint.endpoint) this.aimRaw.copy(heldEndpoint.endpoint);\n    else this.aimRaw.copy(this.anchor).add(this.follow);');
 return helpers+s;
}
function imports(s){return s.replace(/from (['"])([^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(p.startsWith('.')?new URL(p,skillURL).href:import.meta.resolve(p)));}
export async function loadHeldFollowEndpoint(){
 const original=await readFile(skillURL,'utf8'),directory=await mkdtemp(join(tmpdir(),'q04-held-follow-')),sources={clone:imports(original),observe:imports(transformHeldFollowEndpoint(original,{enabled:false})),candidate:imports(transformHeldFollowEndpoint(original))},modules={};
 try{for(const [n,s] of Object.entries(sources)){const p=join(directory,n+'.mjs');await writeFile(p,s);modules[n]=await import(pathToFileURL(p).href);}return {...modules,sourceHashes:{original:sha(original),...Object.fromEntries(Object.entries(sources).map(([n,s])=>[n,sha(s)]))},cleanup:()=>rm(directory,{recursive:true,force:true})};}catch(e){await rm(directory,{recursive:true,force:true});throw e;}
}
