// Reuse the measured onehand protocol with one research-only thrust-edge gate.
// The generated runner lives outside src. Public exposure is independently
// restricted in main.js; this research protocol can still compare both weapons.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(out|scenario|modes|observerRepeats|tapTiming)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
assert(opts.out&&path.isAbsolute(opts.out)&&!fs.existsSync(opts.out),'Fresh absolute output required');
const origin=new URL('onehand_stop_reverse_probe.mjs',import.meta.url);
const original=fs.readFileSync(origin,'utf8'),sha=b=>createHash('sha256').update(b).digest('hex');
let script=original.replaceAll('continuous','steady').replaceAll('onehandAimModel','thrustEdgeModel');
const once=(a,b)=>{assert.equal(script.split(a).length,2,'Expected unique protocol marker');script=script.replace(a,b);};
const begin=script.indexOf(' let patched='),end=script.indexOf(' const rewrite=',begin);assert(begin>0&&end>begin);
script=script.slice(0,begin)+` let patched=source;
 const marker='const moving = THREE.MathUtils.smoothstep(ev, 0.5, 2.5);';
 assert.equal(patched.split(marker).length,2,'Unique existing edge weight');
 patched=patched.replace(marker,'const moving = THREE.MathUtils.smoothstep(ev, 0.5, 2.5) * ((manualOnehand && this.thrustEdgeModel === \\'steady\\') ? 1 - th.w : 1);');
`+script.slice(end);
// The reused helper is not an implementation dependency of this gate.
once("helperSHA256:sha(fs.readFileSync(helper)),","generatorProbeSHA256:"+JSON.stringify(sha(fs.readFileSync(new URL(import.meta.url))))+",");
once("'tools/sim/experiments/onehand_aim_candidate.mjs',", "'tools/sim/experiments/onehand_thrust_probe.mjs',");
once("scenario==='tap'&&request.phase==='stop'", "(scenario==='tap'||scenario==='live')&&request.phase==='stop'");
once("['reverseHold',scenario==='live'?5.4:.70,[.10,.45]]", "['reverseHold',scenario==='live'?5.4:.70,[.10,.45]],['followCut',.25,[.10,-.45]],['followHold',.75,[.10,-.45]]");
script=script.replace('Source-identical Fighter except optional centre-preserving C2 guard elevation.','Actual Fighter except optional manual-onehand moving edge weight multiplied by 1-thrustPose.w; existing projected yaw-right rest plane retained.');
script=script.replace('steady uses documented research-only transformed Fighter/harness','steady uses a documented thrust-only edge-weight gate in the actual transformed Fighter/harness');
if(opts.tapTiming==='contact') {
 assert.equal(opts.scenario,'live','Contact trigger needs the original reactive live duration');
 once('let G;const undo=[],frames=[],trace=[],operations=[],motors=[],stack=[];', 'let G;let tapAttempted=false;const undo=[],frames=[],trace=[],operations=[],motors=[],stack=[];');
 once("const tapAccepted=(scenario==='tap'||scenario==='live')&&request.phase==='stop'&&schedule[request.tick-1]?.phase!=='stop'?f.skill.thrust():null;G.step();", "const encountered=contacts(G,f).length>0||G.wounds.length>0;let tapAccepted=null;if(!tapAttempted&&encountered){tapAttempted=true;tapAccepted=f.skill.thrust();}G.step();");
}
// Once integrated, the actual Fighter already implements this same gate.
// Keep the original runner for both modes instead of applying the gate twice.
const currentFighter=fs.readFileSync(new URL('../../../src/fighter.js',import.meta.url),'utf8');
if(currentFighter.includes("if (manualOnehand && this.thrustEdgeModel === 'steady') moving *= 1 - th.w;")) {
 once("if(modes.includes('steady')){","if(false){ // Gate is already in the actual Fighter.");
}
script=script.replaceAll('import.meta.url',JSON.stringify(origin.href));
const packages={three:import.meta.resolve('three')};
script=script.replaceAll('import.meta.resolve(p)',`(${JSON.stringify(packages)}[p] ?? p)`);
script=script.replace(/^(import[^\n]+?\sfrom\s)(['"])([^'"\n]+)\2/gm,(_,lead,q,p)=>lead+JSON.stringify(p.startsWith('.')?new URL(p,origin).href:p==='three'?packages.three:p));
fs.mkdirSync(path.dirname(opts.out),{recursive:true});
const dir=fs.mkdtempSync(path.join(path.dirname(opts.out),'thrust-protocol-')),runner=path.join(dir,'runner.mjs');fs.writeFileSync(runner,script,{flag:'wx'});
const argv=process.argv;
process.argv=[argv[0],runner,'--modes='+(opts.modes??'original,steady'),'--scenario='+(opts.scenario??'tap'),'--observerRepeats='+(opts.observerRepeats??'false'),'--out='+opts.out];
try{await import(pathToFileURL(runner).href);}finally{
 process.argv=argv;
 if(fs.existsSync(opts.out)){
  const raw=JSON.parse(fs.readFileSync(opts.out));
  raw.thrustGateGenerator={referenceTool:origin.pathname,referenceSHA256:sha(original),generatorTool:new URL(import.meta.url).pathname,generatorSHA256:sha(fs.readFileSync(new URL(import.meta.url))),generatedRunner:runner,generatedRunnerSHA256:sha(script),tapTiming:opts.tapTiming??'scheduled',change:'Manual-onehand steady mode only: existing moving edge weight multiplied by 1-thrustPose.w. Rest plane, gains, axes, cap and reaction untouched. Full recovery and following cut added to original delta-input schedule; live also requests the same first tap before longer original reactive combat.',argv:argv.slice(2)};
  // Preserve the engine runner's original bytes; add provenance separately.
  fs.writeFileSync(opts.out+'.provenance.json',JSON.stringify(raw.thrustGateGenerator,null,2)+'\n',{flag:'wx'});
 }
}
