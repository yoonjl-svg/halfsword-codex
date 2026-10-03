/** Reuse actual-hit replay with same-prefix arm-term observation/one activation hypothesis. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url)),url=new URL('./arm_hit_reinput_probe.mjs',import.meta.url);
const original=fs.readFileSync(url,'utf8'),sha=x=>createHash('sha256').update(x).digest('hex');let source=original;
function replace(a,b){if(source.split(a).length!==2)throw Error('Expected one replay marker: '+a);source=source.replace(a,b);}
replace("import {loadArmCapacityCandidates}", "import {loadArmRecoveryActivation} from './arm_recovery_activation_candidate.mjs';\nimport {loadArmCapacityCandidates}");
replace("\nconst root=fileURLToPath(new URL('../../../',import.meta.url));\n",'\nconst root='+JSON.stringify(root)+';\n');
replace("new URL('./skill_from_start_probe.mjs',import.meta.url)",'new URL('+JSON.stringify(new URL('./skill_from_start_probe.mjs',import.meta.url).href)+')');
replace("modes=(opts.modes??'legacy,plane,cap,planeCap')", "modes=(opts.modes??'legacy,activation')");
replace("!['legacy','plane','cap','planeCap'].includes(m)","!['legacy','activation'].includes(m)");
replace("'tools/sim/experiments/arm_hit_reinput_probe.mjs','package-lock.json'","'tools/sim/experiments/arm_hit_reinput_probe.mjs','tools/sim/experiments/arm_hit_terms_probe.mjs','tools/sim/experiments/arm_target_terms_candidate.mjs','tools/sim/experiments/arm_recovery_activation_candidate.mjs','package-lock.json'");
replace('let modules;', 'let modules,armResearch;');
replace('modules=await loadArmCapacityCandidates();', 'modules=await loadArmCapacityCandidates();armResearch=await loadArmRecoveryActivation();');
replace('let G,undoDiagnostic;', 'let G,undoDiagnostic;');
const install="if(observed){for(const method of ['driveSword','manualMuscle'])Object.defineProperty(f,method,{value:modules.clone[method],configurable:true});undoDiagnostic=modules.clone.setDiagnostics(f,s=>diagnostics.push({timeS:G.t,...s}));}";
replace(install,`if(observed||mode==='activation'){for(const method of ['step','driveSword','driveJoints','manualMuscle','elbowGravity'])Object.defineProperty(f,method,{value:armResearch.module.Fighter.prototype[method],configurable:true});}`);
replace("f.edgeTorqueModel=['plane','planeCap'].includes(mode)?'planePotential':'legacy';f.armTorqueModel=['cap','planeCap'].includes(mode)?'sharedCap':'legacy';", "if(mode==='activation')armResearch.module.enableRecoveryArm(f);");
replace('actuators:ds};',`actuators:ds,armTerms:armResearch.module.readArmTerms(f)??null,armActivation:armResearch.module.readRecoveryArm(f),jointTargets:{shoulder:f.jointByName.uarmS.target.toArray(),elbow:f.jointByName.farmS.target.toArray()}};`);
replace("const diagnosticInfo=observed?modules.clone.diagnosticInfo(f):null;", "const diagnosticInfo=null;");
replace('helperSHA256:sha(helper),cloneSHA256:modules.sourceHashes.clone,', 'helperSHA256:sha(helper),cloneSHA256:armResearch.generatedSHA256,wrapper:'+JSON.stringify({originalProbeSHA256:sha(original),wrapperSHA256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),purpose:'Actual injury replay; legacy versus main-arm activation separated from getup ramp. Original before-hit path and all actual contact/wounds preserved. No gain or body/health edits.'})+',');
replace("branch:'Existing runtime edge torque/arm final-cap options switched after identical native/controller/event/input prefix. Research causal branch only, not proposed automatic injury-triggered product switch. Enemy remains reactive. Next contacts and wounds are confound boundaries, not controlled identical hits.'", "branch:'Activation candidate starts an independent main-arm activation filter at existing muscle after identical actual-hit prefix. Only getup target becomes vigor instead of postural kneel ramp times vigor; injury/Hill/gains/targets/reactions unchanged. Main shoulder/elbow/wrist/gravity only; offhand/legs/body still use original muscle. Runtime defaults untouched. Reactive enemy/new contacts confound later comparisons.'");
replace("observations:'Observed clone driveSword/manualMuscle versus original runtime. Extra observers do not control motion. Valid native joints only; explicit actuator torque/power excludes native muscles/constraint/contact work. Candidate power includes actual sword/forearm/chest reaction split; totalK is not work.'", "observations:'Legacy compares observed clone versus original runtime, activation compares frame observers on/off with required transformed methods shared. ArmTerms are pre-solver requests: not actual native torque. Post-solver body quaternions/omega are actual response. Wrist instantaneous relative power uses actual reaction recipients; no full native work. No browser time dilation.'");
replace('await modules?.cleanup();', 'await modules?.cleanup();await armResearch?.cleanup();');
source=source.replace(/^(import .*? from )(['"])([^'"]+)\2/gm,(_,p,q,v)=>p+JSON.stringify(v.startsWith('.')?new URL(v,url).href:import.meta.resolve(v)));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'arm-hit-terms-'));
try{const file=path.join(dir,'probe.mjs');fs.writeFileSync(file,source);await import(pathToFileURL(file).href);}finally{fs.rmSync(dir,{recursive:true,force:true});}
