// Run the already-preserved actual-game recut fixture with one new candidate.
// The generated producer freezes src/engine/tool hashes before stepping.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(out|activate|weapons)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
assert(opts.out&&path.isAbsolute(opts.out)&&!fs.existsSync(opts.out));
let source=fs.readFileSync(path.join(root,'tools/sim/experiments/p4_recut_probe.mjs'),'utf8');
const sha=b=>createHash('sha256').update(b).digest('hex');
function replace(a,b){assert.equal(source.split(a).length,2,a);source=source.replace(a,b);}
replace("const root = fileURLToPath(new URL('../../../', import.meta.url));",'const root = '+JSON.stringify(root)+';');
source=source.replaceAll('p4_continued_plane_candidate.mjs','bounded_roll_candidate.mjs')
  .replaceAll('continueCutPlane','advanceRollTarget').replaceAll('continuedNormal','boundedRoll');
replace('advanceRollTarget(this, flatTarget, p4Rest, p4EdgeVelocity, blade, moving)','advanceRollTarget(this, flatTarget, blade)');
replace("requests.findIndex(r => r.phase === 'firstCut')","requests.findIndex(r => r.phase === 'recut')");
replace("'tools/sim/experiments/p4_recut_probe.mjs'];","'tools/sim/experiments/p4_recut_probe.mjs', 'tools/sim/experiments/bounded_roll_probe_20261006.mjs'];");
replace('target:flatTarget, moving});','target:flatTarget, moving, slew:this.rollSlewDiagnostic});');
replace('Oriented target continuation only; existing gains, twist torque law, damping, forces, damage and native body state unchanged.',
  'Completed ordinary roll target rate bounded by existing wristVmax; existing gains, twist torque law, damping, forces, damage and native body state unchanged.');
fs.mkdirSync(path.dirname(opts.out),{recursive:true});
const runner=opts.out.replace(/\.json$/,'')+'-runner.mjs';
fs.writeFileSync(runner,source,{flag:'wx'});
const link=path.join(path.dirname(runner),'node_modules');if(!fs.existsSync(link))fs.symlinkSync(path.join(root,'node_modules'),link,'dir');
const command=[runner,'--out='+opts.out,'--activate='+(opts.activate??'firstCut'),'--weapons='+(opts.weapons??'qinggang,longsword')];
let status=0;try{execFileSync(process.execPath,command,{stdio:'inherit'});}catch(e){status=e.status??1;}
fs.writeFileSync(opts.out.replace(/\.json$/,'')+'-producer.json',JSON.stringify({producerSHA256:sha(fs.readFileSync(new URL(import.meta.url))),runnerSHA256:sha(source),command,status},null,2)+'\n',{flag:'wx'});
process.exitCode=status;
