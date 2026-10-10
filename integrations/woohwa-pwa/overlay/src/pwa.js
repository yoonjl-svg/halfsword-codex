import './pwa.css';

// This module owns only the PWA menu. Game state and saved settings stay with main.js.
const production = import.meta.env.PROD;
const updateInterval = 60_000;

function mountPwaMenu() {
  const card = document.querySelector('#menu .card');
  const actions = card?.querySelector('.actions');
  if (!card || !actions || document.getElementById('pwaMenu')) return;

  const panel = document.createElement('details');
  panel.id = 'pwaMenu';
  panel.className = 'pwa-menu';
  panel.innerHTML = `
    <summary>앱 설치 · 오프라인</summary>
    <div class="pwa-menu__body">
      <p id="pwaStatus" class="pwa-menu__status" role="status" aria-live="polite" aria-atomic="true"></p>
      <p class="pwa-menu__note">처음에는 인터넷에 연결해 다운로드가 끝날 때까지 기다려 주세요. 저장된 데이터는 기기나 브라우저가 지울 수 있습니다.</p>
      <p id="pwaInstallHint" class="pwa-menu__note"></p>
      <div class="pwa-menu__buttons">
        <button id="pwaInstall" class="pwa-menu__button" type="button" hidden>앱 설치</button>
        <button id="pwaRetry" class="pwa-menu__button" type="button" hidden>오프라인 준비 다시 시도</button>
      </div>
    </div>
  `;
  card.insertBefore(panel, actions);

  const status = panel.querySelector('#pwaStatus');
  const hint = panel.querySelector('#pwaInstallHint');
  const installButton = panel.querySelector('#pwaInstall');
  const retryButton = panel.querySelector('#pwaRetry');
  const displayMode = window.matchMedia('(display-mode: standalone)');
  const appleTouch = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (/Mac/.test(navigator.platform) && navigator.maxTouchPoints > 1);
  const watchedWorkers = new WeakSet();
  let registration;
  let registering = false;
  let checking = false;
  let failure = null;
  let lastUpdateAt = 0;
  let installPrompt = null;
  let prompting = false;
  let installedThisSession = false;
  let installMessage = '';

  function installed() {
    return installedThisSession || displayMode.matches || navigator.standalone === true;
  }

  function renderInstall() {
    const isInstalled = installed();
    panel.dataset.installed = String(isInstalled);
    installButton.hidden = !production || !installPrompt || isInstalled;
    installButton.disabled = prompting;
    if (isInstalled) {
      hint.textContent = '앱으로 설치되어 있습니다.';
    } else if (!production) {
      hint.textContent = '배포된 게임을 열면 설치 기능을 사용할 수 있습니다.';
    } else if (installMessage) {
      hint.textContent = installMessage;
    } else if (installPrompt) {
      hint.textContent = '홈 화면에서 바로 실행하려면 앱 설치를 눌러 주세요.';
    } else if (appleTouch) {
      hint.textContent = 'Safari에서 공유 → 홈 화면에 추가를 선택해 설치하세요.';
    } else {
      hint.textContent = '브라우저 메뉴의 앱 설치 또는 홈 화면에 추가를 선택하세요. 설치 메뉴가 없으면 다른 지원 브라우저에서 열어 주세요.';
    }
  }

  function renderStatus() {
    let state;
    let message;
    if (!production) {
      state = 'development';
      message = '이 미리보기에서는 오프라인 저장을 사용하지 않습니다.';
    } else if (!window.isSecureContext) {
      state = 'insecure';
      message = '앱 설치와 오프라인 플레이는 HTTPS로 접속해야 사용할 수 있습니다. 온라인 게임은 계속할 수 있습니다.';
    } else if (!('serviceWorker' in navigator)) {
      state = 'unsupported';
      message = '이 브라우저에서는 오프라인 저장을 지원하지 않습니다. 온라인 게임은 계속할 수 있습니다.';
    } else if (registration?.waiting) {
      state = 'update-ready';
      message = '새 버전이 준비됐습니다. 게임 창을 모두 닫았다가 다시 열면 적용됩니다.';
    } else if (failure) {
      state = 'error';
      message = failure === 'update'
        ? '새 버전을 확인하지 못했습니다. 온라인에서는 게임을 계속할 수 있습니다. 연결과 저장 공간을 확인한 뒤 다시 시도하세요.'
        : '오프라인 저장을 준비하지 못했습니다. 온라인에서는 게임을 계속할 수 있습니다. 연결과 저장 공간을 확인한 뒤 다시 시도하세요.';
    } else if (registration?.active?.state === 'activated') {
      state = 'ready';
      message = navigator.onLine
        ? '오프라인 플레이 준비가 끝났습니다. 인터넷 없이도 다시 열 수 있습니다.'
        : '현재 오프라인입니다. 저장된 게임으로 플레이할 수 있습니다.';
    } else if (registration) {
      state = 'preparing';
      message = '오프라인 플레이를 준비하고 있습니다. 다운로드가 끝날 때까지 인터넷 연결을 유지해 주세요.';
    } else {
      state = 'registering';
      message = navigator.onLine
        ? '오프라인 저장을 준비하고 있습니다.'
        : '아직 오프라인 준비가 끝나지 않았습니다. 인터넷에 연결한 뒤 다시 시도하세요.';
    }
    panel.dataset.state = state;
    panel.dataset.online = String(navigator.onLine);
    if (status.textContent !== message) status.textContent = message;
    retryButton.hidden = state !== 'error';
    retryButton.disabled = registering || checking;
  }

  function watchWorker(worker) {
    if (!worker || watchedWorkers.has(worker)) return;
    watchedWorkers.add(worker);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'redundant') failure = 'registration';
      renderStatus();
    });
  }

  function watchRegistration(nextRegistration) {
    if (registration !== nextRegistration) {
      registration = nextRegistration;
      registration.addEventListener('updatefound', () => {
        failure = null;
        watchWorker(registration.installing);
        renderStatus();
      });
    }
    watchWorker(registration.installing);
    watchWorker(registration.waiting);
    watchWorker(registration.active);
    renderStatus();
  }

  async function registerWorker() {
    if (!production || !window.isSecureContext || !('serviceWorker' in navigator) || registering) return;
    registering = true;
    failure = null;
    renderStatus();
    try {
      const base = new URL(import.meta.env.BASE_URL, document.baseURI);
      const workerUrl = new URL('sw.js', base);
      lastUpdateAt = Date.now();
      const nextRegistration = await navigator.serviceWorker.register(workerUrl.href, {
        scope: new URL('./', workerUrl).href,
        updateViaCache: 'none',
      });
      watchRegistration(nextRegistration);
    } catch {
      failure = 'registration';
    } finally {
      registering = false;
      renderStatus();
    }
  }

  async function checkForUpdate() {
    if (!registration || registering || checking || !navigator.onLine
      || document.visibilityState !== 'visible' || Date.now() - lastUpdateAt < updateInterval) return;
    checking = true;
    lastUpdateAt = Date.now();
    try {
      await registration.update();
      failure = null;
      watchWorker(registration.installing);
    } catch {
      failure = 'update';
    } finally {
      checking = false;
      renderStatus();
    }
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    if (!production) return;
    event.preventDefault();
    installPrompt = event;
    installMessage = '';
    renderInstall();
  });
  window.addEventListener('appinstalled', () => {
    installedThisSession = true;
    installPrompt = null;
    installMessage = '';
    renderInstall();
  });
  if (displayMode.addEventListener) displayMode.addEventListener('change', renderInstall);
  else if (displayMode.addListener) displayMode.addListener(renderInstall);

  installButton.addEventListener('click', async () => {
    if (!installPrompt || prompting || installed()) return;
    const prompt = installPrompt;
    prompting = true;
    renderInstall();
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      installMessage = choice.outcome === 'accepted'
        ? '설치 요청을 보냈습니다. 홈 화면이나 앱 목록에서 확인해 주세요.'
        : '설치를 취소했습니다. 나중에 브라우저 메뉴에서 다시 설치할 수 있습니다.';
    } catch {
      installMessage = '설치 창을 열지 못했습니다. 브라우저 메뉴의 앱 설치 또는 홈 화면에 추가를 이용해 주세요.';
    } finally {
      if (installPrompt === prompt) installPrompt = null;
      prompting = false;
      renderInstall();
    }
  });

  retryButton.addEventListener('click', () => { void registerWorker(); });
  window.addEventListener('online', () => {
    renderStatus();
    if (registration) void checkForUpdate();
    else void registerWorker();
  });
  window.addEventListener('offline', renderStatus);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      renderInstall();
      renderStatus();
      void checkForUpdate();
    }
  });
  if (production && 'serviceWorker' in navigator) {
    // Observe activation without reloading or taking control of a running game.
    navigator.serviceWorker.addEventListener('controllerchange', renderStatus);
  }

  renderInstall();
  renderStatus();
  void registerWorker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountPwaMenu, { once: true });
} else {
  mountPwaMenu();
}
