// 적막 PWA: vite build 뒤에 dist/sw.js 와 dist/pwa-build.json 을 만든다 (npm run build 가 부른다 — docs/pwa_2026-10-13.md)
//  node tools/pwa/build.mjs [dist 폴더]
//  - 오프라인 목록 = dist − 옛 실험판 − 검토용 사진/영상(encounters) − 생성 파일. 파일마다 크기·SHA-256
//  - 판 번호 = (목록 + 워커 틀)의 해시 앞 24 자 → 내용이 바뀐 빌드마다 캐시 이름이 바뀐다. 같은 내용이면 같은 판(쓸데없이 다시 받지 않는다)
//  - 의존성·네트워크·시각 없음 (같은 dist → 같은 sw.js)
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dist = path.resolve(root, process.argv[2] || 'dist');
// encounters contains review-page captures, not runtime game assets. Keep them
// available online without downloading every historical screenshot on install.
const EXCLUDED_DIRS = new Set(['corr', 'r2p', 'support', 'wb', 'encounters']);
const GENERATED = new Set(['sw.js', 'pwa-build.json']);
const BUDGET_BYTES = 30 * 1024 * 1024; // 넘으면 담을 목록을 다시 보라고 멈춘다
const NAV_TIMEOUT_MS = 10000; // 화면 요청이 이보다 늦으면 깔린 판으로 연다 (깔린 판이 있을 때만) — 사장님 확인 전
const REQUIRED = ['index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];

const sha = (b) => createHash('sha256').update(b).digest('hex');
const files = [];
async function walk(dir, prefix = '') {
  const entries = (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const e of entries) {
    if (!prefix && (EXCLUDED_DIRS.has(e.name) || GENERATED.has(e.name))) continue;
    const rel = prefix + e.name;
    if (e.isSymbolicLink()) throw new Error('PWA: dist 안에 심볼릭 링크가 있으면 안 된다: ' + rel);
    if (e.isDirectory()) await walk(path.join(dir, e.name), rel + '/');
    else if (e.isFile()) {
      const bytes = await fs.readFile(path.join(dir, e.name));
      files.push({ path: rel, bytes: bytes.length, sha256: sha(bytes) });
    }
  }
}
await walk(dist);
for (const r of REQUIRED) if (!files.some((f) => f.path === r)) throw new Error('PWA: 빠진 파일 ' + r);
const html = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
if (!/rel="manifest"/.test(html)) throw new Error('PWA: index.html 에 manifest 링크가 없다');
const totalBytes = files.reduce((n, f) => n + f.bytes, 0);
if (totalBytes > BUDGET_BYTES) throw new Error(`PWA: 오프라인 목록이 ${(totalBytes / 1048576).toFixed(1)} MB — 30 MB 넘음, 목록을 다시 볼 것`);

const template = await fs.readFile(new URL('./sw-template.js', import.meta.url), 'utf8');
const version = sha(JSON.stringify(files) + template + NAV_TIMEOUT_MS).slice(0, 24);
const worker = template
  .replace('__PWA_VERSION__', () => JSON.stringify(version))
  .replace('__PWA_FILES__', () => JSON.stringify(files))
  .replace('__PWA_NAV_TIMEOUT_MS__', () => String(NAV_TIMEOUT_MS));
if (/__PWA_[A-Z_]+__/.test(worker)) throw new Error('PWA: 워커 틀 자리표가 남았다');
await fs.writeFile(path.join(dist, 'sw.js'), worker);
await fs.writeFile(path.join(dist, 'pwa-build.json'), JSON.stringify({ version, files: files.length, totalBytes, excludedDirectories: [...EXCLUDED_DIRS], commit: process.env.GITHUB_SHA || null }, null, 2) + '\n');
console.log(JSON.stringify({ pwa: true, version, files: files.length, totalBytes }));
