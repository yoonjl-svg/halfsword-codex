// node tools/sim/stamina_gates.mjs on|off /tmp/stamina-gates
// 기준 기대값을 바꾸지 않고 동일 소스의 기력 켬/끔을 비교한다.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const mode = process.argv[2];
if (!['on', 'off'].includes(mode)) throw Error('on 또는 off 인자를 명시하세요');
const out = resolve(process.argv[3] ?? '/tmp/stamina-gates');
mkdirSync(out, { recursive: true });
const baseline = JSON.parse(readFileSync(new URL('../../docs/codex_team/refork_20261015_gates.json', import.meta.url))).results;
const cases = [
  ['fights12', 'fights12', []],
  ['live_battery', 'live_battery', []],
  ['finish_thrust', 'finish_thrust', ['1', '--stand']],
  ['corr', 'corr_s0', ['--limits=off,on', '--scenes=a,b']],
  ['weapon_smoke', 'weapon_smoke', []],
];
async function run([name, file, args]) {
  const script = `tools/sim/${file}.mjs`;
  const source = `const {STAMINA}=await import('./src/config.js'); STAMINA.on=${mode === 'on'}; process.argv=${JSON.stringify(['node', script, ...args])}; await import('./${script}');`;
  const child = spawn(process.execPath, ['--input-type=module', '--eval', source], { cwd: root });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const exit = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  writeFileSync(`${out}/${mode}-${name}.stdout`, stdout);
  writeFileSync(`${out}/${mode}-${name}.stderr`, stderr);
  const filtered = stdout.replace(/^using deprecated parameters for the initialization function; pass a single object instead\r?\n/gm, '');
  const sha256 = createHash('sha256').update(filtered).digest('hex');
  const expected = baseline.find(row => row.name === file);
  const identical = name === 'corr' ? (stdout.match(/: IDENTICAL/g) ?? []).length : null;
  const baselineMatches = name === 'corr' ? identical === 12 : sha256 === expected.filtered_stdout_sha256;
  const pass = exit === 0 && (mode === 'off' ? baselineMatches : name !== 'corr' || identical === 12);
  return { name, command: ['node', script, ...args], stamina: mode === 'on', exit, sha256, baselineMatches, ...(identical != null ? { identical } : {}), pass };
}
const results = [];
for (let i = 0; i < cases.length; i += 2) results.push(...await Promise.all(cases.slice(i, i + 2).map(run)));
writeFileSync(`${out}/${mode}-gates.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (results.some(row => !row.pass)) process.exitCode = 1;
