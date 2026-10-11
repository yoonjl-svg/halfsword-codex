// node integrations/stillness-account/backend/run-progression-tests.mjs /tmp/halfsword-account-dbtest
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dependencyRoot = process.argv[2];
if (!dependencyRoot) throw new Error('Supply the directory containing the temporary PGlite installation.');
const require = createRequire(import.meta.url);
const { PGlite } = await import(pathToFileURL(require.resolve('@electric-sql/pglite', { paths: [resolve(dependencyRoot)] })).href);
const backend = fileURLToPath(new URL('.', import.meta.url));
const db = new PGlite();
try {
  await db.exec(`
    create role anon nologin noinherit;
    create role authenticated nologin noinherit;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth, public to anon, authenticated;
  `);
  // The pre-existing account migration remains independently applicable.
  await db.exec(await readFile(resolve(backend, 'schema.sql'), 'utf8'));
  await db.exec(await readFile(resolve(backend, 'progression.sql'), 'utf8'));
  const results = await db.exec(await readFile(resolve(backend, 'progression-test.sql'), 'utf8'));
  const checks = results.reduce((counts, result) => {
    for (const row of result.rows) {
      if (Object.hasOwn(row, 'assert_true')) counts.assertions++;
      if (Object.hasOwn(row, 'expect_error')) counts.expectedRejections++;
    }
    return counts;
  }, { assertions: 0, expectedRejections: 0 });
  if (!checks.assertions || !checks.expectedRejections) throw new Error('No meaningful SQL checks executed.');
  const cleanup = await db.query('select count(*)::int as users from auth.users');
  if (cleanup.rows[0].users !== 0) throw new Error('Fixture transaction did not roll back.');
  console.log(JSON.stringify({ status: 'passed', engine: 'PGlite PostgreSQL', ...checks, fixtureRollback: true }));
  console.log('Hosted Auth, PostgREST and simultaneous multi-connection races were not exercised. Client-reported wins are not verified anti-cheat.');
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', code: error.code, message: error.message, where: error.where }));
  process.exitCode = 1;
} finally {
  await db.close();
}
