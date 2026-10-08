/** Replay an archived, rejected recovery candidate from its exact frozen source.
 * This launcher installs nothing in the game and never runs against live src.
 * --source=<absolute frozen runtime> --mode=natural|lying|side|hurt --out=<fresh directory>
 * --source=<absolute frozen runtime> --validate-only
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Pass --source=<frozen runtime> and --mode=natural|lying|side|hurt --out=<fresh absolute directory>; --validate-only verifies without running physics.');
  process.exit(0);
}
const validateOnly = args.includes('--validate-only');
const opts = Object.fromEntries(args.filter(x => x !== '--validate-only').map(x => {
  const m = /^--(source|mode|out)=(.+)$/.exec(x); assert(m, 'Unknown option: ' + x); return [m[1], m[2]];
}));
assert(opts.source && path.isAbsolute(opts.source), 'An external frozen --source is required; live source is never a fallback.');
const source = fs.realpathSync(opts.source);
const sourceFile = path.join(source, 'SOURCE.json');
const manifest = JSON.parse(fs.readFileSync(sourceFile));
const sha = x => createHash('sha256').update(x).digest('hex');
for (const [name, expected] of Object.entries(manifest.files)) {
  assert(!path.isAbsolute(name) && !name.split('/').includes('..'), 'Invalid manifest path');
  assert.equal(sha(fs.readFileSync(path.join(source, name))), expected, 'Frozen source changed: ' + name);
}
const script = path.join(source, 'tools/sim/experiments/recovery_sequence_20261008_probe.mjs');
assert.notEqual(fs.realpathSync(script), fs.realpathSync(fileURLToPath(import.meta.url)), 'Refusing recursive or live-source invocation');
assert(fs.existsSync(path.join(source, 'src/recovery_sequence.js')), 'Archived candidate source is missing');
if (validateOnly) {
  console.log(JSON.stringify({ source, head: manifest.head, manifestSHA256: sha(fs.readFileSync(sourceFile)), filesChecked: Object.keys(manifest.files).length, nativeRuns: 0 }));
  process.exit(0);
}
const mode = opts.mode ?? 'natural';
assert(['natural', 'lying', 'side', 'hurt'].includes(mode), 'Unknown fixture');
assert(opts.out && path.isAbsolute(opts.out) && !fs.existsSync(opts.out), 'A fresh absolute --out directory is required');
const result = spawnSync(process.execPath, [script, '--mode=' + mode, '--out=' + opts.out], { cwd: source, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
