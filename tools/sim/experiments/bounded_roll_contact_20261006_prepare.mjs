// Prepare only: current production source plus an artifact-local roll limiter.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const out=process.argv[2]?.replace(/^--out=/,'');
assert(process.argv.length===3&&process.argv[2].startsWith('--out=')&&path.isAbsolute(out)&&!fs.existsSync(out));
const sha=x=>createHash('sha256').update(x).digest('hex');
const scan=p=>fs.readdirSync(path.join(root,p),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(p+'/'+e.name):e.name.endsWith('.js')?[p+'/'+e.name]:[]);
const copied=[...scan('src'),'package.json','package-lock.json','tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs',
 'tools/sim/experiments/round4_integrated_observer.mjs','tools/sim/experiments/p4_command_candidate.mjs',
 'tools/sim/experiments/bounded_roll_candidate.mjs','tools/sim/experiments/bounded_roll_contact_20261006_probe.mjs',
 'tools/sim/experiments/bounded_roll_contact_20261006_prepare.mjs'];
const dependencies=['node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm','node_modules/three/build/three.module.js','node_modules/three/build/three.core.js'];
const files=[...copied,...dependencies].sort(),manifest=dir=>Object.fromEntries(files.map(p=>[p,sha(fs.readFileSync(path.join(dir,p)))]));
const before=manifest(root),directory=out+'-runtime';assert(!fs.existsSync(directory));
for(const p of copied){const dest=path.join(directory,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,p),dest);}
fs.symlinkSync(path.join(root,'node_modules'),path.join(directory,'node_modules'),'dir');
assert.deepEqual(manifest(root),before,'Source changed while freezing');assert.deepEqual(manifest(directory),before,'Frozen copy differs');
let fighter=fs.readFileSync(path.join(directory,'src/fighter.js'),'utf8');
fighter="import {observeCommandPoint} from '../tools/sim/experiments/p4_command_candidate.mjs';\n"+fighter;
const marker='    // Isolated research mode; ordinary games keep their existing edge alignment.';
assert.equal(fighter.split(marker).length,2);
fighter=fighter.replace(marker,`    const observedRollRaw=this.boundedRollRead?flatTarget.clone():null;
    const observedRollCommand=this.boundedRollRead?observeCommandPoint(this,aim,blade):null;
${marker}`);
const after='    else clearRollTarget(this);';assert.equal(fighter.split(after).length,2);
fighter=fighter.replace(after,after+`\n    this.boundedRollRead?.({blade,flat,raw:observedRollRaw,target:flatTarget,command:observedRollCommand,moving});`);
fs.writeFileSync(path.join(directory,'src/fighter.js'),fighter);
const frozen=manifest(directory),head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const metadata={schemaVersion:1,head,preparedUTC:new Date().toISOString(),directory,original:before,files:frozen,
 transforms:[{file:'src/fighter.js',marker,after,scope:'Observe completed legacy target before and after the production rollTargetModel=bounded branch. Production helper is the only limiter. Command-point helper observes only; old command-direction branch is absent.'}],
 protocol:'Baseline establishes the unchanged normal approach tape start; candidate replays that absolute requested input time. From-spawn limiter, ordinary v2/manual, original enemy AI, original legacy cut, g9.81. No physical execution in prepare.'};
fs.writeFileSync(path.join(directory,'SOURCE.json'),JSON.stringify(metadata,null,2)+'\n');
const command=[process.execPath,path.join(directory,'tools/sim/experiments/bounded_roll_contact_20261006_probe.mjs'),'--out='+out];
const proof={...metadata,executionCommand:command,sourceMetadataSHA256:sha(fs.readFileSync(path.join(directory,'SOURCE.json')))};
fs.writeFileSync(out+'-preparation.json',JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({prepared:true,physicsExecutions:0,directory,executionCommand:command}));
