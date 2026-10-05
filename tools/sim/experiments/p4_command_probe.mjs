// Reuse the preserved recut protocol on a new explicit artifact copy. Transform
// guards fail closed if the reference probe or fighter source is different.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(reference|out|weapons|activate|reuse)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
assert(opts.reference&&opts.out&&!fs.existsSync(opts.out));
assert(['recut','spawn'].includes(opts.activate??'recut'));
assert(!opts.reuse||opts.reuse==='true');assert(!opts.reuse||opts.activate==='spawn');
const bytes=fs.readFileSync(opts.reference),reference=JSON.parse(bytes),sha=b=>createHash('sha256').update(b).digest('hex');
assert(reference.pass&&reference.sourceStable);
const root=reference.directory;
for(const [name,expected]of Object.entries(reference.frozenBefore))assert.equal(sha(fs.readFileSync(path.join(root,name))),expected,name);
const basePath=path.join(root,'tools/sim/experiments/p4_recut_probe.mjs');
let source=fs.readFileSync(basePath,'utf8');
const originalProbeSHA256=sha(source);
const helper=fileURLToPath(new URL('./p4_command_candidate.mjs',import.meta.url));
function replace(a,b){assert.equal(source.split(a).length,2,'Unique transform: '+a);source=source.replace(a,b);}
replace("const root = fileURLToPath(new URL('../../../', import.meta.url));",'const root = '+JSON.stringify(root)+';');
replace("const sourceCommit = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();",'const sourceCommit = '+JSON.stringify(reference.sourceCommit)+';');
replace("const dirtyBefore = execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim();","const dirtyBefore = 'preserved frozen artifact; hashes verified by command probe';");
const begin=source.indexOf("const fighterPath = path.join(directory,'src/fighter.js');"),end=source.indexOf('const frozenNames =');assert(begin>0&&end>begin);
source=source.slice(0,begin)+`
const helperName='tools/sim/experiments/p4_command_candidate.mjs';
fs.copyFileSync(${JSON.stringify(helper)},path.join(directory,helperName),fs.constants.COPYFILE_EXCL);
const fighterPath=path.join(directory,'src/fighter.js');
let fighterSource=fs.readFileSync(fighterPath,'utf8');
const injectedMarkers=[];
function inject(a,b){assert.equal(fighterSource.split(a).length,2,'Unique fighter transform: '+a);fighterSource=fighterSource.replace(a,b);injectedMarkers.push(a);}
fighterSource="import {observeCommandPoint} from '../tools/sim/experiments/p4_command_candidate.mjs';\\n"+fighterSource;
inject('    const p4Rest = flatTarget.clone(), p4EdgeVelocity = edgeDir.clone();','    const p4Command = observeCommandPoint(this, aim, blade);\\n    const p4Rest = flatTarget.clone(), p4EdgeVelocity = edgeDir.clone();');
inject('      const mf = edgeDir.crossVectors(blade, edgeDir).normalize();',"      const mf = this.edgePlaneModel === 'commandDirection' && p4Command.eligible ? new THREE.Vector3().crossVectors(blade, p4Command.transverse).normalize() : edgeDir.crossVectors(blade, edgeDir).normalize();");
inject('    const p4LegacyTarget = flatTarget.clone();',"    const p4LegacyTarget = p4Rest.clone();\\n    if(moving > 0) { const n = new THREE.Vector3().crossVectors(blade,p4EdgeVelocity).normalize(); if(n.dot(flat)<0)n.negate(); p4LegacyTarget.lerp(n,moving); if(p4LegacyTarget.lengthSq()<1e-4)p4LegacyTarget.copy(n); p4LegacyTarget.normalize(); }");
inject('legacyTarget:p4LegacyTarget, target:flatTarget, moving});','legacyTarget:p4LegacyTarget, target:flatTarget, moving, command:p4Command});');
fs.writeFileSync(fighterPath,fighterSource);
`+source.slice(end);
replace('const frozenNames = [...srcNames,...tools,...dependencies];','const frozenNames = [...srcNames,...tools,...dependencies,helperName];');
replace("const requests = schedule(), interventionTick = activate === 'spawn' ? 0 : requests.findIndex(r => r.phase === 'firstCut');","const requests = schedule(), interventionTick = activate === 'spawn' ? 0 : requests.findIndex(r => r.phase === 'recut');");
// The original optional continuation helper stays in the artifact but its flag
// is never selected. Only this new command-direction branch can be activated.
replace("for(const weapon of weapons) for(const mode of ['legacy','continuedNormal'])", "for(const weapon of weapons) for(const mode of ['legacy','commandDirection'])");
replace("if(tick===interventionTick && mode==='continuedNormal')f.edgePlaneModel='continuedNormal';","if(tick===interventionTick && mode==='commandDirection')f.edgePlaneModel='commandDirection';");
replace("contract:'Ordinary unified-r2 + manual player, Qinggang legacy shape/thrust/finish, paired grip, original AI at14m. Equal creation and native/controller prefix before firstCut intervention. Four actual game runs. Oriented target continuation only; existing gains, twist torque law, damping, forces, damage and native body state unchanged.',", "contract:'Preserved ordinary unified-r2+manual protocol; original AI at14m, paired grip, legacy cut. Matched native/controller prefix until recut. Active non-thrust cuts substitute only the motion-normal direction with resolved world .7blade command-point motion; physical moving weight and torque laws remain unchanged. No stored plane at rest.',");
replace("'Directed continuation may keep a long turn; lower target slew or axial peak alone is not a success.'", "'Command motion can be unreachable; actual cutting progress and edge alignment are required, not target smoothness alone.'");
if(opts.reuse){
  replace("for(const weapon of weapons) for(const mode of ['legacy','commandDirection'])", "for(const weapon of weapons) for(const mode of ['commandDirection'])");
  replace('const rows=[],comparisons=[],started=',`const rows=JSON.parse(fs.readFileSync(${JSON.stringify(opts.reference)})).rows.filter(r=>r.mode==='legacy'&&weapons.includes(r.weapon)).map(r=>({...r,reusedBaseline:true,interventionTick:0,prefixNative:sha(''),prefixControl:sha(''),summary:{...r.summary,afterIntervention:stats(r.frames)}})),comparisons=[],started=`);
  replace('physicsSteps:rows.reduce((v,r)=>v+r.frames.length,0),','newPhysicsExecutions:rows.filter(r=>!r.reusedBaseline).length,reusedBaselineRows:rows.filter(r=>r.reusedBaseline).length,physicsSteps:rows.filter(r=>!r.reusedBaseline).reduce((v,r)=>v+r.frames.length,0),');
}
fs.mkdirSync(path.dirname(opts.out),{recursive:true});
const runner=opts.out.replace(/\.json$/,'')+'-runner.mjs';assert(!fs.existsSync(runner));fs.writeFileSync(runner,source,{flag:'wx'});
// The runner itself imports three before it constructs the frozen copy.
const link=path.join(path.dirname(runner),'node_modules');if(!fs.existsSync(link))fs.symlinkSync(path.join(root,'node_modules'),link,'dir');
const command=[runner,'--out='+opts.out,'--weapons='+(opts.weapons??'longsword'),'--activate='+((opts.activate??'recut')==='spawn'?'spawn':'firstCut')];
let status=0;try{execFileSync(process.execPath,command,{stdio:'inherit'});}catch(e){status=e.status??1;}
const generated=fs.existsSync(opts.out)?JSON.parse(fs.readFileSync(opts.out)):null;
const baselineChecks=generated?.rows.filter(r=>r.mode==='legacy').map(r=>{const old=reference.rows.find(x=>x.weapon===r.weapon&&x.mode==='legacy');return{weapon:r.weapon,creationExact:old?.creationNative===r.creationNative,allNativeExact:!!old&&r.frames.every((f,i)=>f.native===old.frames[i]?.native),allAppliedPadExact:!!old&&r.frames.every((f,i)=>JSON.stringify(f.actual.pad)===JSON.stringify(old.frames[i]?.actual.pad))};})??[];
const proof={schemaVersion:1,pass:status===0&&baselineChecks.length>0&&baselineChecks.every(c=>c.creationExact&&c.allNativeExact&&c.allAppliedPadExact),
  reference:{path:opts.reference,bytes:bytes.length,sha256:sha(bytes)},originalProbeSHA256,runner:{path:runner,sha256:sha(source)},
  helper:{path:helper,sha256:sha(fs.readFileSync(helper))},producerSHA256:sha(fs.readFileSync(new URL(import.meta.url))),
  invocation:process.argv,executionCommand:[process.execPath,...command],baselineChecks,reusedBaselineRows:generated?.reusedBaselineRows??0,
  newPhysicsExecutions:generated?.newPhysicsExecutions??generated?.rows.length??0,result:opts.out,resultSHA256:generated?sha(fs.readFileSync(opts.out)):null};
fs.writeFileSync(opts.out.replace(/\.json$/,'')+'-proof.json',JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({proof:proof.pass,baselineChecks}));if(!proof.pass)process.exitCode=1;
