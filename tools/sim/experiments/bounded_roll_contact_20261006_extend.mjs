// One declared normal-input extension. The previous frozen source/raw is intact.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(parent|out)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
assert(opts.parent&&opts.out&&path.isAbsolute(opts.parent)&&path.isAbsolute(opts.out)&&!fs.existsSync(opts.out)&&!fs.existsSync(opts.out+'-runtime'));
const sha=x=>createHash('sha256').update(x).digest('hex'),parent=JSON.parse(fs.readFileSync(path.join(opts.parent,'SOURCE.json'))),directory=opts.out+'-runtime';
for(const[p,h]of Object.entries(parent.files)){
 assert.equal(sha(fs.readFileSync(path.join(opts.parent,p))),h,'Parent source intact: '+p);
 if(p.startsWith('node_modules/'))continue;
 const dest=path.join(directory,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(opts.parent,p),dest);
}
fs.symlinkSync(fs.realpathSync(path.join(opts.parent,'node_modules')),path.join(directory,'node_modules'),'dir');
const probe='tools/sim/experiments/bounded_roll_contact_20261006_probe.mjs';let text=fs.readFileSync(path.join(directory,probe),'utf8');
function edit(a,b){assert.equal(text.split(a).length,2,'Unique extension anchor: '+a);text=text.replace(a,b);}
edit("['release',60,[0,0],false]];","['release',60,[0,0],false],['extensionRaise',48,[-.28,.38],true],['extensionHold',24,[0,0],true],['extensionCut',30,[.56,-.76],true],['extensionFollowHold',36,[0,0],true]];");
edit('assert.equal(tape.length,444)','assert.equal(tape.length,582)');
edit('local===null||local<=347','local===null||local<=347||local>=444');
edit('tick<1404','tick<1542');
edit('tapeLength:444','tapeLength:582');
edit("Full tape including release while player alive/armed/grip-valid and enemy alive; otherwise preserve first terminal state. No new fixture/seed search.","Original444-step tape unchanged, then one normal138-step raise/hold/cut/hold extension with forward stick1. Stop after this extension or first player death/disarm/grip loss or enemy death; preserve partial exposure. No seed/angle/gap search.");
fs.writeFileSync(path.join(directory,probe),text);
const producer='tools/sim/experiments/bounded_roll_contact_20261006_extend.mjs';fs.copyFileSync(fileURLToPath(import.meta.url),path.join(directory,producer));
const files=Object.fromEntries([...Object.keys(parent.files),producer].sort().map(p=>[p,sha(fs.readFileSync(path.join(directory,p)))]));
const runtimeExact=Object.keys(parent.files).filter(p=>p.startsWith('src/')||p.startsWith('node_modules/')||p==='tools/sim/harness_m.mjs'||p==='tools/sim/force_ledger.mjs').every(p=>files[p]===parent.files[p]);assert(runtimeExact);
const source={...parent,directory,files,parentFrozenSource:{path:opts.parent,metadataSHA256:sha(fs.readFileSync(path.join(opts.parent,'SOURCE.json')))},extension:{runtimeExact,physicsExecutionsDuringPreparation:0,steps:138,forwardStick:1,originalStepsUnchanged:444,protocol:'One same-delta raise48/hold24/cut30/hold36 after original release. Production helper and all dynamics unchanged.'}};
fs.writeFileSync(path.join(directory,'SOURCE.json'),JSON.stringify(source,null,2)+'\n');
const command=[process.execPath,path.join(directory,probe),'--out='+opts.out];
fs.writeFileSync(opts.out+'-preparation.json',JSON.stringify({source,executionCommand:command,producerSHA256:sha(fs.readFileSync(fileURLToPath(import.meta.url)))},null,2)+'\n');
console.log(JSON.stringify({prepared:true,physicsExecutions:0,runtimeExact,executionCommand:command}));
