// Finite sound synthesis and unchanged existing cues against pre-stage commit2579bc9.
import {synthStageDetail,STAGE_DETAIL_PROFILES} from '../../src/stage_detail_sound.js';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../..',import.meta.url));
const output=process.argv[2];
assert(output?.startsWith('/tmp/'), 'Provide an output JSON under /tmp');
import {createHash} from 'node:crypto';
const beforeText=execFileSync('git',['show','2579bc9:src/stage_detail_sound.js'],{cwd:root,encoding:'utf8'});
const before=await import('data:text/javascript;base64,'+Buffer.from(beforeText).toString('base64'));
const rng=()=>{let s=173;return()=>((s=s*16807%2147483647)/2147483647);};
const digest=p=>createHash('sha256').update(Buffer.from(p.buffer)).digest('hex');
const rows=[];
for(const kind of Object.keys(STAGE_DETAIL_PROFILES))for(const sr of [22050,44100,48000]){
const p=synthStageDetail(kind,sr,rng());let peak=0,power=0;for(const v of p){assert(Number.isFinite(v));peak=Math.max(peak,Math.abs(v));power+=v*v;}
assert(peak>0&&peak<1);assert(Math.abs(p[0])<.001&&Math.abs(p.at(-1))<.001);
let unchanged=null;if(before.STAGE_DETAIL_PROFILES[kind]){unchanged=digest(p)===digest(before.synthStageDetail(kind,sr,rng()));assert(unchanged,kind+' existing PCM changed');}
rows.push({kind,sr,duration:p.length/sr,peak,rms:Math.sqrt(power/p.length),unchanged,sha256:digest(p)});
}
fs.writeFileSync(output,JSON.stringify({pass:true,method:'Synthetic PCM finite/nonzero/clip and smooth edges; all previously available cues byte-identical to2579bc9 with same RNG. Does not establish auditory realism.',rows},null,2));
console.log(JSON.stringify({pass:true,renders:rows.length,existingUnchanged:rows.filter(r=>r.unchanged).length,newRenders:rows.filter(r=>r.unchanged===null).length}));
