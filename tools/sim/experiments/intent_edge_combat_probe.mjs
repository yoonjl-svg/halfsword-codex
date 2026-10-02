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
replace("primary:'12 reinput rows (2weapons×3directions×2modes) + zweihander cross hold weak/off2rows; observer repeats weak/off cross reinput2rows'", "primary:'Skipped: round-window combat only. Both modes correction0/autoGuardfalse; candidate enabled before first game step. No gain or body-state changes.'");
const sha = v => crypto.createHash('sha256').update(v).digest('hex');
replace("helper:{originalSourceSha256", 'transform:' + JSON.stringify({originalScript:'tools/sim/experiments/skill_manual_combat_probe.mjs',originalSHA256:sha(original),wrapperSHA256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),contract:'Rebased imports/root/helper URL; two modes correction0/autoGuardfalse; only edge mode sets edgeIntentModel before first step. Uses existing actual tap/release/reinput/reactive AI/round-window implementation.'}) + ',helper:{originalSourceSha256');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-edge-combat-'));
try {
  const file = path.join(dir, 'probe.mjs');
  fs.writeFileSync(file, source);
  await import(pathToFileURL(file).href);
} finally {
  fs.rmSync(dir, {recursive:true, force:true});
}
