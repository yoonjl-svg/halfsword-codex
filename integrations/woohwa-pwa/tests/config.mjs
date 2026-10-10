import path from 'node:path';

export function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required; see tests/README.md`);
  return value;
}

// All mutable fixtures, browser profiles, screenshots and reports stay here.
export const root = path.resolve(requiredEnv('PWA_TEST_ROOT'));
export const port = Number(process.env.PWA_TEST_PORT || '4255');
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PWA_TEST_PORT must be an integer from 1 to 65535');
}
export const origin = `http://127.0.0.1:${port}`;
