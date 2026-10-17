/* Stillness 서비스 워커 — tools/pwa/build.mjs 가 빌드 끝에 이 틀로 dist/sw.js 를 만든다 (docs/pwa_2026-10-13.md).
 *
 *  - 화면(HTML) 요청: 네트워크 먼저(HTTP 캐시도 다시 확인). 안 되면(오프라인) 이 워커가 깔아 둔 판의 HTML.
 *    → 새 판을 올리면 다음에 여는 순간 새 HTML · 새 묶음(이름에 해시)이 바로 온다. 워커가 옛 판이어도 마찬가지.
 *  - 나머지(묶음 JS·CSS·소리·그림): 이 판 캐시 먼저, 없으면 네트워크. 목록에 없는 주소(옛 실험판 corr/r2p/support/wb 등)는 건드리지 않는다.
 *  - 캐시 이름 = 'stillness-pwa:' + scope + ':' + 판 번호(파일 목록·내용의 해시). 내용이 바뀐 빌드마다 바뀐다.
 *  - 설치: 목록 전부를 받아 크기·SHA-256 을 확인한다(하나라도 어긋나면 이 판 설치를 버리고 옛 판 유지).
 *    옛 판 캐시에 같은 해시의 파일이 있으면 다시 받지 않고 옮겨 담는다(거의 매시간 새 판 — 바뀐 파일만 받는다).
 *  - 다 깔리면 곧바로 넘어간다(skipWaiting + clients.claim). 열린 화면을 새로 고치지는 않는다 —
 *    이미 읽은 게임은 그대로 돌고, 새 판은 다음 열 때(또는 src/pwa.js 가 고른 안전한 순간) 열린다.
 *  - 주소에 ?nosw=1 로 화면을 열면: 네트워크로만 열고, 이 scope 의 캐시를 지우고, 워커를 내린다.
 */
'use strict';
const VERSION = __PWA_VERSION__;
const FILES = __PWA_FILES__;
const NAV_TIMEOUT_MS = __PWA_NAV_TIMEOUT_MS__; // 화면 요청이 이만큼 늦으면 깔린 판으로 연다(깔린 판이 있을 때만)
const SCOPE = self.registration.scope;
const SCOPE_PATH = new URL(SCOPE).pathname;
const PREFIX = 'stillness-pwa:' + SCOPE + ':';
const CACHE = PREFIX + VERSION;
const INDEX_KEY = new URL('__pwa-index__', SCOPE).href; // 캐시 안 파일 목록(경로 → sha256) — 다음 판이 옮겨 담을 때 쓴다
const byUrl = new Map(FILES.map((f) => [new URL(f.path, SCOPE).href, f]));

const hex = async (buf) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map((n) => n.toString(16).padStart(2, '0')).join('');

async function ownOldCaches() {
  const names = await caches.keys();
  return names.filter((n) => n.startsWith(PREFIX) && n !== CACHE);
}

/** 옛 판 캐시들에서 (경로 → { cacheName, sha }) — 같은 해시면 다시 받지 않는다 */
async function reusable() {
  const out = new Map();
  for (const name of await ownOldCaches()) {
    try {
      const c = await caches.open(name);
      const res = await c.match(INDEX_KEY);
      if (!res) continue;
      const idx = await res.json();
      for (const [p, sha] of Object.entries(idx.files || {})) if (!out.has(p)) out.set(p, { name, sha });
    } catch {
      /* 옛 캐시를 못 읽으면 그냥 새로 받는다 */
    }
  }
  return out;
}

/** 목록 전부를 이 판 캐시에 담는다 (옛 판 캐시의 같은 해시는 옮겨 담음). 하나라도 어긋나면 이 판 캐시를 통째로 버리고 실패 */
async function precache() {
  const cache = await caches.open(CACHE);
  const old = await reusable();
  let cursor = 0;
  try {
    // 폰에서 한꺼번에 너무 많이 받지 않게 넷씩
    const workers = Array.from({ length: Math.min(4, FILES.length) }, async () => {
      while (cursor < FILES.length) {
        const f = FILES[cursor++];
        const url = new URL(f.path, SCOPE).href;
        const prev = old.get(f.path);
        if (prev && prev.sha === f.sha256) {
          const hit = await (await caches.open(prev.name)).match(url);
          if (hit) {
            await cache.put(url, hit);
            continue;
          }
        }
        const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin', redirect: 'error' });
        if (res.status !== 200) throw new Error('PWA download failed: ' + f.path);
        const bytes = await res.clone().arrayBuffer();
        if (bytes.byteLength !== f.bytes || (await hex(bytes)) !== f.sha256) throw new Error('PWA build mismatch: ' + f.path);
        await cache.put(url, res);
      }
    });
    const results = await Promise.allSettled(workers);
    const bad = results.find((r) => r.status === 'rejected');
    if (bad) throw bad.reason;
    const files = Object.fromEntries(FILES.map((f) => [f.path, f.sha256]));
    await cache.put(INDEX_KEY, new Response(JSON.stringify({ version: VERSION, files }), { headers: { 'Content-Type': 'application/json' } }));
  } catch (err) {
    await caches.delete(CACHE); // 반쯤 깔린 판은 남기지 않는다 (옛 판은 그대로)
    throw err;
  }
}

/** 깔린 판 캐시가 사라졌으면(기기가 저장 공간을 비움 · ?nosw=1 뒤 같은 워커가 다시 쓰임) 뒤에서 다시 담는다 */
let healing = null;
async function ensureCache() {
  if (healing) return healing;
  try {
    if (await caches.match(INDEX_KEY, { cacheName: CACHE })) return; // caches.open 은 없는 캐시를 새로 만들어 버려서 쓰지 않는다
  } catch {
    return;
  }
  healing = precache()
    .catch(() => {})
    .finally(() => {
      healing = null;
    });
  return healing;
}

// 화면이 등록할 때마다 'ensure' 를 보낸다 — 워커가 화면을 맡지 않은 채 되살아난 경우(?nosw=1 직후 다른 창이 열려 있을 때)에도 캐시를 다시 담게
// 'pwa:skip': 기다리는 새 워커에게 화면이 다시 '넘어가라'고 한다 — 설치 때 부른 skipWaiting 이 가끔 걸리지 않는 일이 있어서
//  (크로미움에서 재어 봄: 옛 판 창이 열려 있으면 새 워커가 '설치됨'에 멈춰 있다가 이 말 한 번에 넘어감)
self.addEventListener('message', (event) => {
  if (event.data === 'pwa:ensure') event.waitUntil(ensureCache());
  else if (event.data === 'pwa:skip') event.waitUntil(self.skipWaiting());
});

self.addEventListener('install', (event) => {
  self.skipWaiting(); // 설치가 끝나면 곧바로 넘어간다 (설치가 실패하면 이 워커는 버려지므로 안전)
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        // 이 scope 의 옛 판 캐시만 지운다 (같은 출처의 다른 게임·앱 캐시는 건드리지 않는다)
        await Promise.allSettled((await ownOldCaches()).map((n) => caches.delete(n)));
      } catch {
        /* 정리 실패가 새 판을 막지 않게 */
      }
      await self.clients.claim();
    })(),
  );
});

/** ?nosw=1: 이 scope 의 캐시를 모두 지우고 워커를 내린다 */
async function teardown() {
  try {
    const names = await caches.keys();
    await Promise.allSettled(names.filter((n) => n.startsWith(PREFIX)).map((n) => caches.delete(n)));
  } catch {
    /* 그래도 내린다 */
  }
  await self.registration.unregister();
}

const offline = () =>
  new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="background:#1b1410;color:#f3e9d8;font-family:system-ui;padding:24px">인터넷에 연결되어 있지 않고, 이 기기에 저장된 판도 없습니다. 연결한 뒤 다시 열어 주세요.</body>', {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });

async function fromCache(key) {
  try {
    return (await caches.match(key, { cacheName: CACHE })) || null; // (caches.open 은 지워진 캐시를 빈 채로 되살린다)
  } catch {
    return null; // 저장 공간을 못 읽게 되어도 네트워크로
  }
}

async function networkFirst(request, key, navigate) {
  // 화면 요청은 HTTP 캐시(Pages 는 10 분)도 건너뛰지 않고 서버에 다시 묻는다 — 새 판이 곧바로 닿게
  const net = fetch(navigate ? new Request(request, { cache: 'no-cache' }) : request);
  const timer = new Promise((ok) => setTimeout(ok, NAV_TIMEOUT_MS, 'timeout'));
  const first = await Promise.race([net.catch(() => null), timer]);
  if (first && first !== 'timeout' && first.status < 500) return first;
  const cached = key && (await fromCache(key));
  if (cached) return cached;
  if (first === 'timeout') {
    try {
      return await net; // 깔린 판이 없으면 늦어도 네트워크를 기다린다
    } catch {
      /* 아래로 */
    }
  }
  return first && first !== 'timeout' ? first : offline();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE_PATH)) return;
  const navigate = request.mode === 'navigate';
  if (navigate && url.searchParams.get('nosw') === '1') {
    event.respondWith(fetch(request));
    event.waitUntil(teardown());
    return;
  }
  let rel = url.pathname.slice(SCOPE_PATH.length);
  if (rel === '') rel = 'index.html';
  const isHtml = navigate || /\.html$/.test(rel);
  const key = new URL(rel, SCOPE).href;
  if (!byUrl.has(key)) return; // 목록에 없는 것(옛 실험판·다른 앱·API)은 그냥 네트워크 — 캐시하지도 가로채지도 않는다
  if (isHtml) {
    // 주소 인자(?test=1·?weapon=… 등)는 오프라인 대체 열쇠에서만 뺀다 — 네트워크로는 주소 그대로 묻는다
    event.respondWith(networkFirst(request, key, navigate));
    if (navigate && !healing) event.waitUntil(ensureCache());
    return;
  }
  if (url.search) return; // 인자 붙은 자료 요청은 그냥 네트워크
  event.respondWith(
    (async () => {
      const hit = await fromCache(key);
      if (hit) return hit;
      return fetch(request);
    })(),
  );
});
