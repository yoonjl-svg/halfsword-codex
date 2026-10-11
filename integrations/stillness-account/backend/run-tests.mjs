// Run: node integrations/stillness-account/backend/run-tests.mjs /tmp/halfsword-account-dbtest
// The dependency lives outside the repository; see README.md for installation.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dependencyRoot = process.argv[2];
if (!dependencyRoot) throw new Error('Supply the directory containing the temporary PGlite installation.');
const require = createRequire(import.meta.url);
const packagePath = require.resolve('@electric-sql/pglite', { paths: [resolve(dependencyRoot)] });
const { PGlite } = await import(pathToFileURL(packagePath).href);
const backend = fileURLToPath(new URL('.', import.meta.url));
const db = new PGlite();
try {
  await db.exec(`
    create role anon nologin noinherit;
    create role authenticated nologin noinherit;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
      )::uuid
    $$;
    grant usage on schema auth, public to anon, authenticated;
  `);
  await db.exec(await readFile(resolve(backend, 'schema.sql'), 'utf8'));
  const results = await db.exec(await readFile(resolve(backend, 'test.sql'), 'utf8'));
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
  console.log('Hosted Auth, email, PostgREST and multi-connection concurrency were not exercised.');
} finally {
  await db.close();
}
