// Stillness PWA 수명 점검 (Playwright · 진짜 서비스 워커) — docs/pwa_2026-10-13.md
//  샛별 저장소의 PWA 묶음에 든 시험(tests/lifecycle.mjs)을 우리 갱신 방식(화면 네트워크 먼저 · 곧바로 넘어감)에 맞춰 다시 쓴 것.
//
//    npm run build            (dist/sw.js · dist/pwa-build.json 까지)
//    node tools/pwa/lifecycle.mjs dist /tmp/<빈 작업 폴더> [포트=4291]
//
//  dist 를 판 A(v1)·판 B(v2: 묶음 이름·HTML 표시가 바뀐 새 판)·판 C(v3: 파일 하나가 깨진 새 판)로 복사해 하위 경로 /halfsword/ 로 띄운다.
//  서버는 GitHub Pages 처럼 Cache-Control: max-age=600 을 붙인다 (HTTP 캐시에 갇히지 않는지도 본다).
//  127.0.0.1 은 HTTPS 없이도 서비스 워커가 된다. 결과: <작업 폴더>/lifecycle-report.json · 스크린샷. 하나라도 어긋나면 종료 코드 1.
//  크로미움: PW_CHROMIUM (기본 /opt/pw-browsers/chromium). 실제 아이폰 '홈 화면에 추가'·안드로이드 설치는 여기서 못 한다 — 기기에서 확인.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const [distArg, workArg, portArg] = process.argv.slice(2);
if (!distArg || !workArg) throw new Error('쓰는 법: node tools/pwa/lifecycle.mjs <dist> <빈 작업 폴더> [포트]');
const dist = path.resolve(distArg);
const work = path.resolve(workArg);
const port = Number(portArg || 4291);
const builder = fileURLToPath(new URL('./build.mjs', import.meta.url));
await fs.mkdir(work, { recursive: true });
assert.deepEqual(await fs.readdir(work), [], '작업 폴더는 비어 있어야 한다');
const origin = `http://127.0.0.1:${port}`;
const base = origin + '/halfsword/';

// ── 판 셋 만들기 ──
const html1 = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
const mainRel = html1.match(/src="\.\/(assets\/main-[^"]+\.js)"/)[1];
for (const v of ['v1', 'v2', 'v3']) {
  const dir = path.join(work, v);
  await fs.cp(dist, dir, { recursive: true });
  if (v === 'v1') continue;
  // 새 판 흉내: 진입 묶음 이름(해시)이 바뀌고 내용도 조금 다르다 + HTML 에 표시
  const newRel = mainRel.replace(/main-[^.]+\.js$/, `main-${v.toUpperCase()}test.js`);
  const js = await fs.readFile(path.join(dir, mainRel), 'utf8');
  await fs.rm(path.join(dir, mainRel));
  await fs.writeFile(path.join(dir, newRel), js + `\n;window.__pwaTestBuild=${JSON.stringify(v)};\n`);
  const html = html1.replace(`./${mainRel}`, `./${newRel}`).replace(/<\/head>/i, `<meta name="pwa-test-release" content="${v}" />\n</head>`);
  await fs.writeFile(path.join(dir, 'index.html'), html);
  const r = spawnSync(process.execPath, [builder, dir], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}
const build = {};
for (const v of ['v1', 'v2', 'v3']) build[v] = JSON.parse(await fs.readFile(path.join(work, v, 'pwa-build.json'), 'utf8'));
assert.notEqual(build.v1.version, build.v2.version);

// ── 서버 (하위 경로 /halfsword/ — 배포 주소와 같은 꼴) ──
const state = { build: 'v1', corrupt: null, hits: {} }; // corrupt: 이 경로는 일부러 깨진 바이트로 준다
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.txt': 'text/plain', '.md': 'text/plain' };
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, origin);
    if (u.pathname === '/outside.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><title>outside</title>');
      return;
    }
    if (!u.pathname.startsWith('/halfsword/')) throw new Error('404');
    let rel = decodeURIComponent(u.pathname.slice('/halfsword/'.length));
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    if (rel.split('/').some((p) => p === '..')) throw new Error('404');
    state.hits[rel] = (state.hits[rel] || 0) + 1;
    const headers = { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' };
    if (state.corrupt && rel === state.corrupt) {
      res.writeHead(200, { ...headers, 'Cache-Control': 'no-store' }); // 깨진 바이트가 브라우저 HTTP 캐시에 남지 않게 (고친 뒤 시험이 꼬이지 않게)
      res.end('/* deliberately corrupted */'); // 문법은 맞지만 크기·해시가 다르다
      return;
    }
    const bytes = await fs.readFile(path.join(work, state.build, rel));
    res.writeHead(200, headers);
    res.end(bytes);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  }
});
await new Promise((ok) => server.listen(port, '127.0.0.1', ok));

const report = { console: [], pass: false, base, versions: { v1: build.v1.version, v2: build.v2.version, v3: build.v3.version }, files: build.v1.files, bytes: build.v1.totalBytes, checks: [], errors: [] };
const record = (name, data = true) => {
  report.checks.push({ name, data });
  console.log('PASS ' + name);
};
const prefix = 'stillness-pwa:' + base + ':';
const profile = path.join(work, 'profile');
const context = await chromium.launchPersistentContext(profile, {
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=user-gesture-required'],
  viewport: { width: 844, height: 390 }, // 아이폰 13·14 가로 (CSS px)
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  serviceWorkers: 'allow',
});
let diag = null; // 실패 때 워커 상태를 적을 창 (마지막으로 연 창)
const watch = (p) => {
  diag = p;
  p.on('pageerror', (e) => report.errors.push(String(e)));
  p.on('response', (r) => {
    if (r.status() >= 400) (report.console ||= []).push('http ' + r.status() + ': ' + r.url());
  });
  p.on('console', (m) => {
    if (/\[pwa\]/.test(m.text()) || m.type() === 'error') (report.console ||= []).push(m.type() + ': ' + m.text().slice(0, 300));
  });
  return p;
};
const waitGame = (p) => p.waitForFunction(() => window.game?.enemy && window.game.state, null, { timeout: 120000 });
const swState = (p) =>
  p.evaluate(async (pre) => {
    const reg = await navigator.serviceWorker.getRegistration();
    return { controller: !!navigator.serviceWorker.controller, scope: reg?.scope || null, active: reg?.active?.state || null, waiting: !!reg?.waiting, keys: (await caches.keys()).filter((k) => k.startsWith(pre)), allKeys: await caches.keys() };
  }, prefix);
const marker = (p) => p.evaluate(() => ({ meta: document.querySelector('meta[name="pwa-test-release"]')?.content || 'v1', js: window.__pwaTestBuild || 'v1' }));
async function hideShow(p) {
  // 앱을 내렸다가 다시 연 것처럼: visibilitychange (숨김 → 보임)
  await p.evaluate(() => {
    const set = (v) => {
      Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
      Object.defineProperty(document, 'hidden', { value: v === 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    set('hidden');
    set('visible');
  });
}

// page.evaluate 로 되풀이해 묻는다 (waitForFunction 은 async 함수의 Promise 를 참으로 본다)
async function until(p, fn, arg, timeout = 120000) {
  const end = Date.now() + timeout;
  for (;;) {
    if (await p.evaluate(fn, arg).catch(() => false)) return;
    if (Date.now() > end) throw new Error('until: 시간 초과 ' + String(fn).slice(0, 120));
    await new Promise((ok) => setTimeout(ok, 250));
  }
}
const installedAs = async (key) => {
  const reg = await navigator.serviceWorker.getRegistration();
  return !!reg && reg.active?.state === 'activated' && !reg.installing && !reg.waiting && (await caches.keys()).includes(key);
};
let page;
try {
  // 1) 처음 열기: 매니페스트 · 아이콘 · 워커 등록 · 판 A 를 통째로 담음
  page = watch(await context.newPage());
  await page.goto(base, { waitUntil: 'load' });
  await waitGame(page);
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    const json = await (await fetch(link.href)).json();
    const icons = [];
    for (const ic of json.icons) {
      const u = new URL(ic.src, link.href).href;
      const img = new Image();
      img.src = u;
      await img.decode();
      icons.push({ src: u, sizes: ic.sizes, purpose: ic.purpose, w: img.naturalWidth, h: img.naturalHeight });
    }
    const apple = document.querySelector('link[rel="apple-touch-icon"]').href;
    const ai = new Image();
    ai.src = apple;
    await ai.decode();
    return { url: link.href, json, icons, apple: { href: apple, w: ai.naturalWidth }, title: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content };
  });
  assert.equal(manifest.url, base + 'manifest.webmanifest');
  assert.equal(new URL(manifest.json.start_url, manifest.url).href, base);
  assert.equal(new URL(manifest.json.scope, manifest.url).href, base);
  assert.equal(new URL(manifest.json.id, manifest.url).href, base);
  assert.equal(manifest.json.name, 'Stillness');
  assert.equal(manifest.json.short_name, 'Stillness');
  assert.equal(manifest.json.display, 'standalone');
  assert.equal(manifest.title, 'Stillness');
  for (const ic of manifest.icons) assert.equal(`${ic.w}x${ic.h}`, ic.sizes);
  assert(manifest.icons.some((i) => i.purpose === 'maskable'));
  assert.equal(manifest.apple.w, 192); // 도트 6배 정수 확대 (180 은 칸이 고르지 않다)
  await until(page, installedAs, prefix + build.v1.version);
  const s1 = await swState(page);
  assert.equal(s1.scope, base);
  const cdp = await context.newCDPSession(page);
  const inst = await cdp.send('Page.getInstallabilityErrors');
  assert.deepEqual(inst.installabilityErrors, []);
  const appManifest = await cdp.send('Page.getAppManifest');
  assert.deepEqual(appManifest.errors, []);
  record('매니페스트(이름·start_url·scope·아이콘 크기) · 설치 가능 조건 · 워커 등록 · 판 A 통째로 담음', { manifest, sw: s1, installabilityErrors: inst.installabilityErrors });

  // 2) 다시 열기: 워커가 화면을 맡음 (clients.claim)
  await page.reload({ waitUntil: 'load' });
  await waitGame(page);
  const s2 = await swState(page);
  assert(s2.controller);
  record('다시 열면 워커가 화면을 맡음', s2);

  // 남의 캐시 (같은 출처의 다른 앱) — 나중에 그대로 있어야 한다
  await page.evaluate(async () => {
    await (await caches.open('other-app-keep')).put('/sentinel', new Response('keep'));
    await (await caches.open('stillness-pwa:' + location.origin + '/other-game/:keep')).put('/other-sentinel', new Response('other'));
  });

  // 3) 오프라인으로 새로 열기: 판 A 로 열리고 소리 파일도 나온다
  await context.setOffline(true);
  const off = watch(await context.newPage());
  await off.goto(base + '?offline=1', { waitUntil: 'load' });
  await waitGame(off);
  const offAudio = await off.evaluate(async () => {
    const r = await fetch('sfx/breath/breath1.mp3');
    return { ok: r.ok, bytes: (await r.arrayBuffer()).byteLength };
  });
  assert(offAudio.ok && offAudio.bytes > 0);
  assert.deepEqual(await marker(off), { meta: 'v1', js: 'v1' });
  // 첫 터치로 소리 켜짐 (자동 재생 막힘 설정에서 '싸움 시작' 한 번)
  await off.locator('#btnStart').tap();
  await off.waitForFunction(() => window.game.sound?.ctx?.state === 'running', null, { timeout: 20000 });
  record('오프라인 새로 열기 → 판 A · 소리 파일 · 첫 터치로 소리 켜짐', { audio: offAudio });
  await off.close();
  await context.setOffline(false);

  // 4) 판 B 를 올림 → 다음 여는 화면은 곧바로 판 B (워커가 아직 판 A 여도, HTTP 캐시 max-age=600 이어도)
  const keepA = page; // 판 A 첫 화면(아직 싸움 전)으로 열려 있는 창 — 안전한 순간에 새로 고쳐지는지 볼 것
  const fightA = watch(await context.newPage()); // 판 A 로 싸우는 중인 창 — 새로 고치면 안 된다
  await fightA.goto(base + '?weapon=longsword', { waitUntil: 'load' });
  await waitGame(fightA);
  await fightA.locator('#btnStart').tap();
  await fightA.waitForFunction(() => window.game.state === 'fight', null, { timeout: 60000 });
  const fightOrigin = await fightA.evaluate(() => performance.timeOrigin);
  const hitsBefore = { ...state.hits };
  state.build = 'v2';
  const t0 = Date.now();
  const nb = watch(await context.newPage());
  await nb.goto(base, { waitUntil: 'load' });
  await waitGame(nb);
  assert.deepEqual(await marker(nb), { meta: 'v2', js: 'v2' });
  record('판 B 를 올리면 다음 여는 화면이 곧바로 판 B (화면 네트워크 먼저)', { ms: Date.now() - t0 });
  await until(nb, installedAs, prefix + build.v2.version);
  await until(nb, async (a) => !(await caches.keys()).includes(a), prefix + build.v1.version, 30000);
  const sB = await swState(nb);
  assert(sB.allKeys.includes('other-app-keep') && sB.allKeys.some((k) => k.includes('/other-game/')));
  // 판 B 설치는 바뀐 파일만 받았어야 한다 (나머지는 판 A 캐시에서 옮겨 담음)
  const fetchedAgain = Object.keys(state.hits).filter((k) => state.hits[k] > (hitsBefore[k] || 0));
  assert(!fetchedAgain.some((k) => k.startsWith('sfx/') || k.startsWith('ui/') || (k.startsWith('assets/') && !k.includes('V2test'))), fetchedAgain.join(','));
  report.fetchedForB = fetchedAgain;
  record('새 워커가 판 B 를 담고 곧바로 넘어감 · 판 A 캐시만 지움 · 남의 캐시 그대로 · 바뀐 파일만 받음', { ...sB, fetchedForB: report.fetchedForB });

  // 5) 안전한 순간: 판 A 첫 화면 창은 앱으로 돌아오면 새로 고쳐져 판 B, 싸우는 창은 그대로
  await new Promise((ok) => setTimeout(ok, 31000)); // 확인 간격 하한 30 s
  const nav = keepA.waitForEvent('load', { timeout: 30000 });
  await hideShow(keepA);
  await nav;
  await waitGame(keepA);
  assert.deepEqual(await marker(keepA), { meta: 'v2', js: 'v2' });
  await hideShow(fightA);
  await new Promise((ok) => setTimeout(ok, 3000));
  assert.equal(await fightA.evaluate(() => performance.timeOrigin), fightOrigin);
  assert.deepEqual(await marker(fightA), { meta: 'v1', js: 'v1' });
  record('첫 화면에서 돌아오면 판 B 로 새로 고침 · 싸우는 창은 그대로');
  await fightA.close();

  // 6) 오프라인으로 새로 열기 → 판 B
  await context.setOffline(true);
  const offB = watch(await context.newPage());
  await offB.goto(base, { waitUntil: 'load' });
  await waitGame(offB);
  assert.deepEqual(await marker(offB), { meta: 'v2', js: 'v2' });
  record('판 B 로 넘어간 뒤 오프라인 새로 열기 → 판 B');
  await offB.close();
  await context.setOffline(false);

  // 7) 깨진 판 C: 워커 설치를 통째로 버리고 판 B 캐시를 지킨다 (온라인 화면은 네트워크라 판 C HTML)
  state.build = 'v3';
  state.corrupt = mainRel.replace(/main-[^.]+\.js$/, 'main-V3test.js'); // 새 판에서 바뀐 파일이 깨짐
  const failed = await keepA.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    try {
      await reg.update();
    } catch {
      /* 설치 실패는 여기서 안 잡힐 수 있다 */
    }
    await new Promise((ok) => setTimeout(ok, 4000));
    return { waiting: !!reg.waiting, installing: !!reg.installing, active: reg.active?.scriptURL };
  });
  await until(keepA, async (k) => {
    const reg = await navigator.serviceWorker.getRegistration();
    return !reg.installing && !reg.waiting && !(await caches.keys()).includes(k);
  }, prefix + build.v3.version, 30000);
  const sC = await swState(keepA);
  assert(sC.keys.includes(prefix + build.v2.version));
  record('파일 하나 깨진 판 C → 설치 통째로 버림 · 판 B 캐시 유지', { failed, keys: sC.keys });
  state.corrupt = null; // 판 C 를 고쳐 다시 올린 셈 (판 B 로 되돌리지 않는다 — HTTP 캐시에 판 C HTML 이 있어 되돌리면 시험이 아니라 서버가 어긋남)

  // 8) 비상 스위치 ?nosw=1 → 워커 내림 · 이 scope 캐시 지움 · 남의 캐시 그대로
  const ns = watch(await context.newPage());
  await ns.goto(base + '?nosw=1', { waitUntil: 'load' });
  await ns.waitForFunction(() => document.documentElement.dataset.pwa === 'off', null, { timeout: 30000 });
  await until(ns, async (pre) => !(await navigator.serviceWorker.getRegistration()) && !(await caches.keys()).some((k) => k.startsWith(pre)), prefix, 30000);
  await ns.screenshot({ path: path.join(work, 'nosw.png') });
  const sN = await swState(ns);
  assert(sN.allKeys.includes('other-app-keep') && sN.allKeys.some((k) => k.includes('/other-game/')));
  record('?nosw=1 → 워커 내림 · 이 scope 캐시 지움 · 남의 캐시 그대로', sN);
  // 그 뒤 그냥 열면 다시 깔린다
  await ns.goto(base, { waitUntil: 'load' });
  await until(ns, installedAs, prefix + build.v3.version);
  record('?nosw 없이 다시 열면 새로 설치 (고친 판 C)');

  // 9) 다른 웹 주소(test.html · voices.html · sounds.html)도 그대로 열림
  for (const p of ['test.html', 'voices.html', 'sounds.html']) {
    const r = await ns.goto(base + p, { waitUntil: 'load' });
    assert.equal(r.status(), 200);
  }
  record('test.html · voices.html · sounds.html 그대로 열림');
  await ns.close();

  assert.deepEqual(report.errors, []);
  report.pass = true;
} catch (e) {
  report.failure = { message: e.message, stack: e.stack };
  if (diag && !diag.isClosed()) report.failure.sw = await swState(diag).catch((x) => String(x));
  process.exitCode = 1;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(work, 'failure.png') }).catch(() => {});
} finally {
  report.completedUTC = new Date().toISOString();
  await fs.writeFile(path.join(work, 'lifecycle-report.json'), JSON.stringify(report, null, 2) + '\n');
  await context.close();
  server.close();
  console.log(JSON.stringify({ pass: report.pass, checks: report.checks.length, failure: report.failure?.message, errors: report.errors }));
}
