// Freeze current production physics; callbacks only observe completed roll goals.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const out=process.argv[2];assert(path.isAbsolute(out)&&!fs.existsSync(out));
const sha=x=>createHash('sha256').update(x).digest('hex');
const scan=p=>fs.readdirSync(path.join(root,p),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(p+'/'+e.name):e.name.endsWith('.js')?[p+'/'+e.name]:[]);
const copied=[...scan('src'),'package.json','package-lock.json','tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/recut_power_20261007_prepare.mjs','tools/sim/experiments/recut_power_20261007_probe.mjs'];
const dependencies=['node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm','node_modules/three/build/three.module.js','node_modules/three/build/three.core.js'];
const files=[...copied,...dependencies].sort(),manifest=dir=>Object.fromEntries(files.map(p=>[p,sha(fs.readFileSync(path.join(dir,p)))]));
const before=manifest(root);
for(const p of copied){const dest=path.join(out,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,p),dest);}
fs.symlinkSync(path.join(root,'node_modules'),path.join(out,'node_modules'),'dir');
assert.deepEqual(manifest(root),before);assert.deepEqual(manifest(out),before);
let fighter=fs.readFileSync(path.join(out,'src/fighter.js'),'utf8');
const marker='    // Isolated research mode; ordinary games keep their existing edge alignment.';
assert.equal(fighter.split(marker).length,2);fighter=fighter.replace(marker,'    const observedRollRaw=this.recutRead?flatTarget.clone():null;\n'+marker);
const after='    else clearRollTarget(this);';assert.equal(fighter.split(after).length,2);
fighter=fighter.replace(after,after+'\n    this.recutRead?.({blade,flat,raw:observedRollRaw,target:flatTarget,moving});');
if(process.argv[3]!=='--observer-off')fs.writeFileSync(path.join(out,'src/fighter.js'),fighter);
fs.writeFileSync(path.join(out,'SOURCE.json'),JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),preparedUTC:new Date().toISOString(),directory:out,original:before,files:manifest(out),observerDisabled:process.argv[3]==='--observer-off',transform:'Two read-only clone/callback insertions around existing completed roll-target branch; no new controller.'},null,2)+'\n');
console.log(out);
