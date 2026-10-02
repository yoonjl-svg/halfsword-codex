/** Reuse the actual manual-combat/round-end harness with one research edge option. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const originalURL = new URL('./skill_manual_combat_probe.mjs', import.meta.url);
const original = fs.readFileSync(originalURL, 'utf8');
const rawPath = process.argv[2];
if (!rawPath || !process.argv.includes('--round-window')) throw Error('Usage: probe.mjs fresh.json --round-window');
const isolated = process.argv.includes('--isolated-tap');
const noTap = process.argv.includes('--no-tap');
if (noTap && !isolated) throw Error('--no-tap requires --isolated-tap');
let source = original;
const replace = (before, after) => {
  if (source.split(before).length !== 2) throw Error('Expected one transformation: ' + before);
  source = source.replace(before, after);
};
replace("const root=fileURLToPath(new URL('../../../',import.meta.url)),rawPath", 'const root=' + JSON.stringify(root) + ',rawPath');
replace("new URL('./skill_from_start_probe.mjs',import.meta.url)", 'new URL(' + JSON.stringify(new URL('./skill_from_start_probe.mjs', import.meta.url).href) + ')');
replace("const modes={weak:{level:.4,autoGuard:true},off:{level:0,autoGuard:false}}", "const modes={legacy:{level:0,autoGuard:false},edge:{level:0,autoGuard:false}}");
replace("f.skill.autoGuard=modes[mode].autoGuard;f.armTorqueModel='legacy'", "f.skill.autoGuard=modes[mode].autoGuard;if(mode==='edge')f.edgeIntentModel='commandedPlane';f.armTorqueModel='legacy'");
source = source.replaceAll("['weak','off']", "['legacy','edge']").replaceAll("'off'", "'edge'");
replace("probe:'skill_manual_combat_probe'", "probe:'intent_edge_combat_probe'");
replace("'tools/sim/experiments/skill_manual_combat_probe.mjs','package-lock.json'", "'tools/sim/experiments/skill_manual_combat_probe.mjs','tools/sim/experiments/intent_edge_combat_probe.mjs','package-lock.json'");
source = source.replace(/^(import .*? from )(['"])([^'"]+)\2/gm, (_, prefix, q, p) => prefix + JSON.stringify(p.startsWith('.') ? new URL(p, originalURL).href : import.meta.resolve(p)));
source = source.replace('weak/off8rows + sabre7off', 'legacy/commandedPlane8rows + sabre7commandedPlane').replace('Different correction modes', 'Different edge models');
if (isolated) {
  replace("gap:1.85,skill:modes[mode].level,difficulty:'normal'});const f=G.player;", "gap:6,skill:modes[mode].level,difficulty:'normal'});G.ai.update=()=>{};const f=G.player;");
  replace('seconds:18,rawAimMeanErrorRad', 'seconds:6,rawAimMeanErrorRad');
  replace("for(const seed of narrowDiagnosis?[19]:[7,19])", "for(const seed of [7])");
  replace("f.move.set(0,time<2?.25:((time%4.4)<.6?.08:0));", "f.move.set(0,0);");
  replace("combat:'18s scripted player versus original reactive normal AI longsword, sabre/zweihander×seed7/19×legacy/commandedPlane8rows + sabre7commandedPlane exact observer duplicate. Start gap1.85m, no walls, paired grip, both arm legacy, cut legacy.'", "combat:'Isolated tap: six seconds from spawn, gap6m, enemy AI.update disabled, manual move0. Scripted real tap at2.2s, original lunge/recovery and hand reinput. Both weapons seed7, two edge modes4rows plus candidate sabre observer1. Contact/wound count must be0; enemy bodies remain dynamic. Not a real duel or same prepared-state comparison.'");
  replace("input:'External hand path/tap commands fixed by time; forward stick .25 first2s then .08 during guard phases. No player AI. Enemy original AI reacts normally. Once player dies external hand writes obey alive gate.'", "input:'External hand/tap script unchanged, movement stick zero. Enemy AI disabled; foe exists for actual Skill.thrust. Both fighters native physics remain active.'");
  if (noTap) {
    replace('[2.2,6.6,11,15.4].findIndex', '[].findIndex');
    source = source.replace('Scripted real tap at2.2s, original lunge/recovery and hand reinput.', 'Tap-free counterpart: no thrust request, identical external hand script.');
  }
}
replace("primary:'12 reinput rows (2weapons×3directions×2modes) + zweihander cross hold weak/off2rows; observer repeats weak/off cross reinput2rows'", "primary:'Skipped: round-window combat only. Both modes correction0/autoGuardfalse; candidate enabled before first game step. No gain or body-state changes.'");
const sha = v => crypto.createHash('sha256').update(v).digest('hex');
replace("helper:{originalSourceSha256", 'transform:' + JSON.stringify({isolated,originalScript:'tools/sim/experiments/skill_manual_combat_probe.mjs',originalSHA256:sha(original),wrapperSHA256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),contract:'Rebased imports/root/helper URL; two modes correction0/autoGuardfalse; only edge mode sets edgeIntentModel before first step. Uses existing actual tap/release/reinput/round-window implementation. Isolated mode additionally changes gap/AI/manual move/duration/seeds as recorded in protocol.'}) + ',helper:{originalSourceSha256');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-edge-combat-'));
try {
  const file = path.join(dir, 'probe.mjs');
  fs.writeFileSync(file, source);
  await import(pathToFileURL(file).href);
} finally {
  fs.rmSync(dir, {recursive:true, force:true});
}
