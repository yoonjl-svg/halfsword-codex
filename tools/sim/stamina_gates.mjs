// node tools/sim/stamina_gates.mjs on|off [출력 폴더]
// 기력 켬/끔으로 관문 다섯을 돌려 기대값과 견준다 (샛별 저장소 9db75870 의 도구 — 우리 본판 기대값으로 고침, docs/strike/stamina_import_2026-10-15.md §6).
//  해시 = stdout 에서 'deprecated parameters' 줄을 뺀 sha256 앞 8 자리. 끔은 기력이 들어오기 전 본판(91d4646) 기대값과 같아야 하고,
//  켬은 fights12 만 바뀐다(AI 숨 고르기 — 문서 §6). corr 는 출력에 걸린 시간이 있어 IDENTICAL 12 로 본다.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const mode = process.argv[2];
if (!['on', 'off'].includes(mode)) throw Error('on 또는 off 인자를 명시하세요');
const out = resolve(process.argv[3] ?? '/tmp/stamina-gates');
mkdirSync(out, { recursive: true });
// 기대값 (앞 8 자리): 끔 = 91d4646 본판 · 켬 = 기력 들여온 판
const EXPECT = {
  off: { fights12: '7f5860c7', live_battery: '648aca66', finish_thrust: '2de06c03', weapon_smoke: '7085b282' },
  on: { fights12: 'a071c0af', live_battery: '648aca66', finish_thrust: '2de06c03', weapon_smoke: '7085b282' },
};
const cases = [
  ['fights12', 'fights12', []],
  ['live_battery', 'live_battery', []],
  ['finish_thrust', 'finish_thrust', ['1', '--stand']],
  ['corr', 'corr_s0', ['--limits=on,off', '--scenes=a,b']],
  ['weapon_smoke', 'weapon_smoke', []],
];
async function run([name, file, args]) {
  const script = `tools/sim/${file}.mjs`;
  const source = `const {STAMINA}=await import('./src/config.js'); STAMINA.on=${mode === 'on'}; process.argv=${JSON.stringify(['node', script, ...args])}; await import('./${script}');`;
  const child = spawn(process.execPath, ['--input-type=module', '--eval', source], { cwd: root });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const exit = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });
  writeFileSync(`${out}/${mode}-${name}.stdout`, stdout);
  writeFileSync(`${out}/${mode}-${name}.stderr`, stderr);
  const filtered = stdout.replace(/^.*deprecated parameters.*\r?\n/gm, '');
  const sha8 = createHash('sha256').update(filtered).digest('hex').slice(0, 8);
  const identical = name === 'corr' ? (stdout.match(/: IDENTICAL/g) ?? []).length : null;
  const ok = name === 'corr' ? identical === 12 : sha8 === EXPECT[mode][name];
  const smokeOk = name === 'weapon_smoke' ? (stdout.match(/ OK /g) ?? []).length : null;
  return { name, command: ['node', script, ...args], stamina: mode === 'on', exit, sha8, ...(identical != null ? { identical } : {}), ...(smokeOk != null ? { ok: smokeOk } : {}), expect: EXPECT[mode][name] ?? 'IDENTICAL 12', pass: exit === 0 && ok };
}
const results = [];
for (let i = 0; i < cases.length; i += 2) results.push(...(await Promise.all(cases.slice(i, i + 2).map(run))));
writeFileSync(`${out}/${mode}-gates.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (results.some((row) => !row.pass)) process.exitCode = 1;
