// Stillness PWA (설치되는 앱 · 오프라인 · 새 판 갱신) — docs/pwa_2026-10-13.md
//  화면은 하나도 더하지 않는다(메뉴·버튼 없음). 게임 상태·설정은 main.js 몫이고 여기서는 읽기만 한다(window.game.state).
//
//  - 배포판(vite build)에서만 서비스 워커(sw.js — tools/pwa/build.mjs 가 만든다)를 등록한다. 개발 서버에서는 등록하지 않는다.
//  - 주소 ?nosw=1 : 이 주소(scope)의 서비스 워커를 내리고 그 캐시를 지운다(비상 스위치). 그 화면에서는 다시 등록하지 않는다.
//    다음에 그냥 열면 새로 등록된다. 앱(주소창 없음)에서는 쓸 수 없다 → 아래 PWA_ENABLED 를 false 로 배포하면
//    HTML 이 늘 네트워크 먼저라서 다음 온라인 실행 때 모든 기기에서 내려간다.
//  - 새 판 확인: 화면으로 돌아올 때(앱 다시 열기 · 탭 돌아오기)마다 워커 갱신을 묻고, 첫 화면(아직 싸움을 시작하지 않은 'menu')이면
//    서버의 index.html 이 지금 판과 다른지(묶음 파일 이름) 본다 — 다르면 그 자리에서 새로 고친다(안전한 순간).
//    싸움·뽑기·결과 화면(여정 도중)에서는 새로 고치지 않는다 → 다음에 열 때 새 판.
const PWA_ENABLED = true; // 비상: false 로 배포하면 모든 기기에서 워커를 내리고 캐시를 지운다
const CHECK_EVERY_MS = 30000; // 화면으로 돌아올 때 새 판 확인 간격 하한 — 사장님 확인 전
const PREFIX = 'stillness-pwa:';

const scope = new URL('./', document.baseURI).href; // index.html 이 놓인 곳 = 배포 뿌리 (…/halfsword/)
const params = new URLSearchParams(location.search);
const supported = 'serviceWorker' in navigator && window.isSecureContext;

/** 이 scope 의 워커를 모두 내리고, 이 scope 의 캐시만 지운다 (같은 출처의 다른 앱 캐시는 건드리지 않는다) */
async function teardown() {
  let regs = 0;
  let removed = 0;
  try {
    for (const r of await navigator.serviceWorker.getRegistrations()) {
      if (r.scope.startsWith(scope) && (await r.unregister())) regs++;
    }
  } catch {
    /* 못 읽어도 캐시는 지운다 */
  }
  try {
    if (window.caches) {
      for (const n of await caches.keys()) {
        if (n.startsWith(PREFIX + scope) && (await caches.delete(n))) removed++;
      }
    }
  } catch {
    /* 저장 공간을 못 읽음 */
  }
  return { regs, removed };
}

function notice(text) {
  // 비상 스위치를 썼을 때만 잠깐 뜨는 한 줄 (게임 화면 구성은 그대로)
  const el = document.createElement('div');
  el.textContent = text;
  el.setAttribute('role', 'status');
  el.style.cssText =
    'position:fixed;left:50%;top:max(10px,env(safe-area-inset-top));transform:translateX(-50%);z-index:99;padding:8px 14px;border-radius:6px;background:rgba(24,18,14,.92);color:#f3e9d8;font:13px/1.4 system-ui,sans-serif;pointer-events:none';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

/** 화면에 걸린 묶음 파일 이름들 (assets/…) — 판마다 해시가 바뀐다 */
const assetSig = (names) => [...new Set(names)].filter((n) => /(^|\/)assets\//.test(n)).map((n) => n.slice(n.lastIndexOf('assets/'))).sort().join('|');
//  <script src> 만 센다 (10/16 — docs/import/lobby_port_2026-10-16.md §7): 첫 화면(game_entry.js)이 게임 묶음을 나중에 받을 때 Vite 가 머리에 넣는 modulepreload <link> 는
//  받아 온 HTML 에 없는 이름이라, 그것까지 세면 같은 판인데도 늘 '새 판'으로 읽어 첫 화면·메뉴에서 돌아올 때마다 새로 고친다. 진입 묶음 이름은 그 아래 묶음이 바뀌면 같이 바뀐다
const currentSig = () => assetSig([...document.querySelectorAll('script[src]')].map((el) => el.getAttribute('src') || ''));

let lastCheck = 0;
let reloading = false;
async function checkForNewBuild(registration) {
  if (reloading || !navigator.onLine || Date.now() - lastCheck < CHECK_EVERY_MS) return;
  lastCheck = Date.now();
  registration?.waiting?.postMessage('pwa:skip');
  registration?.update().catch(() => {}); // 워커 갱신 (새 판이면 뒤에서 받아 깔고 넘어간다 — 오프라인용)
  if (window.game?.state !== 'menu') return; // 첫 화면이 아니면(여정 도중) 새로 고치지 않는다
  try {
    const res = await fetch(new URL('index.html', scope), { cache: 'no-store' });
    if (!res.ok) return;
    const sig = assetSig((await res.text()).match(/src="[^"]*assets\/[^"]+"/g)?.map((s) => s.replace(/^src="|"$/g, '')) || []);
    const mine = currentSig();
    if (sig && mine && sig !== mine && window.game?.state === 'menu' && document.visibilityState === 'visible') {
      reloading = true;
      location.reload();
    }
  } catch {
    /* 오프라인이거나 서버가 안 받음 — 다음에 */
  }
}

async function start() {
  const nosw = params.get('nosw') === '1';
  if (!supported) return;
  if (nosw || !PWA_ENABLED) {
    const r = await teardown();
    document.documentElement.dataset.pwa = 'off';
    if (nosw) notice(`서비스 워커를 내렸습니다 (워커 ${r.regs} · 캐시 ${r.removed} 지움). 다음에 그냥 열면 새로 설치됩니다.`);
    console.info('[pwa] teardown', r);
    return;
  }
  if (!import.meta.env.PROD) return; // 개발 서버에서는 등록하지 않는다 (옛 워커가 개발판을 가리지 않게)
  let registration = null;
  try {
    registration = await navigator.serviceWorker.register(new URL('sw.js', scope).href, { scope, updateViaCache: 'none' });
    document.documentElement.dataset.pwa = 'on';
    navigator.serviceWorker.ready.then((r) => r.active?.postMessage('pwa:ensure')).catch(() => {}); // 깔린 판 캐시가 비었으면 워커가 다시 담는다
  } catch (e) {
    console.warn('[pwa] 등록 실패 — 웹으로는 그대로 돈다', e);
    return;
  }
  lastCheck = Date.now(); // 방금 연 화면은 이미 새 HTML (네트워크 먼저)
  // 새 워커가 '설치됨'에 머물러 있으면 넘어가라고 한 번 더 말한다 (sw-template.js 'pwa:skip')
  const nudge = () => registration.waiting?.postMessage('pwa:skip');
  const watchInstalling = () => {
    const w = registration.installing;
    if (w) w.addEventListener('statechange', () => w.state === 'installed' && setTimeout(nudge, 1000));
  };
  registration.addEventListener('updatefound', watchInstalling);
  watchInstalling();
  nudge();
  // ?nosw=1 직후 다른 창이 옛 워커를 붙들고 있으면 등록이 그 워커를 되살리기만 하고 새 판을 묻지 않는 일이 있다 → 한 번 더 묻는다
  if (!navigator.serviceWorker.controller) registration.update().catch(() => {});
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForNewBuild(registration);
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) checkForNewBuild(registration); // 뒤로 가기 캐시(bfcache)에서 되살아남
  });
  window.addEventListener('online', () => checkForNewBuild(registration));
}

// 게임 자료를 먼저 받게: 페이지가 다 뜬 뒤에 등록한다
if (document.readyState === 'complete') start();
else window.addEventListener('load', () => start(), { once: true });
