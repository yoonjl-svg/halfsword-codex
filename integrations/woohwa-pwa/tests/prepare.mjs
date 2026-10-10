// Usage: PWA_TEST_ROOT=/empty/test/directory node tests/prepare.mjs /built/dist [builder.mjs]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { root } from './config.mjs';

const args = process.argv.slice(2);
if (args.length < 1 || args.length > 2) {
  throw new Error('Usage: node tests/prepare.mjs /built/dist [builder.mjs]');
}
const source = await fs.realpath(path.resolve(args[0]));
const builder = await fs.realpath(path.resolve(args[1] || process.env.PWA_BUILD_SCRIPT
  || fileURLToPath(new URL('../overlay/tools/pwa/build.mjs', import.meta.url))));
assert((await fs.stat(source)).isDirectory(), 'The built dist must be a directory');
assert((await fs.stat(builder)).isFile(), 'The builder must be a JavaScript file');
const originalHtml = await fs.readFile(path.join(source, 'index.html'), 'utf8');
assert(!originalHtml.includes('pwa-test-release'), 'Use an unmodified built dist without a test release marker');
assert.equal((originalHtml.match(/<\/head\s*>/gi) || []).length, 1, 'Expected exactly one HTML head closing tag');
const originalBuild = JSON.parse(await fs.readFile(path.join(source, 'pwa-build.json'), 'utf8'));
assert(originalBuild.version && originalBuild.files?.length, 'Build the PWA before preparing fixtures');
await fs.access(path.join(source, 'sw.js'));

// Resolve missing path components without creating anything inside a mistaken source path.
async function prospectiveRealpath(value) {
  try { return await fs.realpath(value); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return path.join(await prospectiveRealpath(path.dirname(value)), path.basename(value));
  }
}
const destination = await prospectiveRealpath(root);
const relative = path.relative(source, destination);
assert(relative && (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)),
  'PWA_TEST_ROOT must be outside the source dist');
// Refuse an existing test tree so a mistaken environment variable cannot overwrite work.
await fs.mkdir(root, { recursive: true });
assert.deepEqual(await fs.readdir(root), [], 'PWA_TEST_ROOT must be empty; create a fresh temporary directory');

for (const version of ['v1', 'v2', 'v3']) {
  const fixture = path.join(root, version);
  await fs.cp(source, fixture, { recursive: true, errorOnExist: true, force: false });
  if (version !== 'v1') {
    const html = originalHtml.replace(/<\/head\s*>/i,
      `<meta name="pwa-test-release" content="${version}" />\n$&`);
    await fs.writeFile(path.join(fixture, 'index.html'), html);
    const result = spawnSync(process.execPath, [builder, fixture], { stdio: 'inherit' });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `Builder failed for ${version}`);
    const build = JSON.parse(await fs.readFile(path.join(fixture, 'pwa-build.json'), 'utf8'));
    assert.notEqual(build.version, originalBuild.version, 'HTML marker must change the fixture build version');
  }
}
await fs.writeFile(path.join(root, 'server-state.json'), JSON.stringify({ build: 'v1', corrupt: false }) + '\n');
console.log(JSON.stringify({ prepared: true, root, source, builder, fixtures: ['v1', 'v2', 'v3'] }));
