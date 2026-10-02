// Q04 isolated shoulder target-speed correction. Production source remains untouched.
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const fighterURL=new URL('../../../src/fighter.js',import.meta.url);
const sha=x=>createHash('sha256').update(x).digest('hex');
function once(s,a,b){if(s.split(a).length!==2)throw Error('Source marker contract failed: '+a);return s.replace(a,b);}
export function transformBodyInputTransfer(source,{candidate=false,observe=false,budget=false}={}){
  let result=source;
  if(candidate)result=once(result,'eTw * 25 - wTw * 0.8','eTw * 25 - (wTw - wT.dot(boneAxis)) * 0.8');
  if(budget){
    result=once(result,'const cap = maxT * hill(tlen > 1e-6 ? wSw.dot(_mT) / tlen : 0, this.weaponCfg.shoulderVmax);','const cap = this.q04FixedShoulderCapNm;');
    result=once(result,'    cap *= this.wristHill;','    cap = this.q04FixedWristCapNm;');
  }
  if(observe){
    result=once(result,'    const tlen = _mT.length();','    const q04Request = _mT.clone();\n    const tlen = _mT.length();');
    result=once(result,'    j.child.addTorque(vecArg(_mT), true);',`    q04Records.set(this, {joint:j.name, targetOmegaWorld:wT.toArray(), targetTwistRadps:wT.dot(boneAxis), relativeTwistRadps:wTw,
      chestOmegaWorld:[wp.x,wp.y,wp.z], swingRequestNm:q04Request.toArray(), appliedNm:_mT.toArray(), capNm:cap,
      twistFFNm:twistFF, maxT, k, d, shoulderTarget:j.target.toArray(), prevTarget:j.prevTarget.toArray()});
    j.child.addTorque(vecArg(_mT), true);`);
    result='const q04Records=new WeakMap();\nexport function q04Read(f){return q04Records.get(f)??null;}\n'+result;
  }
  return result;
}
function imports(source){return source.replace(/from (['"])([^'"]+)\1/g,(_,q,s)=>'from '+JSON.stringify(s.startsWith('.')?new URL(s,fighterURL).href:import.meta.resolve(s)));}
export async function loadBodyInputTransfer(){
  const original=await readFile(fighterURL,'utf8'),directory=await mkdtemp(join(tmpdir(),'q04-body-input-'));
  const sources={clone:imports(original),observe:imports(transformBodyInputTransfer(original,{observe:true})),candidate:imports(transformBodyInputTransfer(original,{candidate:true,observe:true})),
    budgetBaseline:imports(transformBodyInputTransfer(original,{observe:true,budget:true})),budgetCandidate:imports(transformBodyInputTransfer(original,{candidate:true,observe:true,budget:true}))};
  const modules={};
  try{
    for(const [name,source] of Object.entries(sources)){const path=join(directory,name+'.mjs');await writeFile(path,source);modules[name]=await import(pathToFileURL(path).href);}
    return {...modules,sourceHashes:{original:sha(original),...Object.fromEntries(Object.entries(sources).map(([n,s])=>[n,sha(s)]))},cleanup:()=>rm(directory,{recursive:true,force:true})};
  }catch(e){await rm(directory,{recursive:true,force:true});throw e;}
}
