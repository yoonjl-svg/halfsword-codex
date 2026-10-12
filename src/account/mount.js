import config from './config.js';
import { AccountController } from './controller.js';
import { createTransport } from './supabase.js';
import { createHub } from './hub.js';
import './style.css';
import './auth-ui.css';

const labels = { connecting: '계정 연결 중…', local: '이 기기에 저장됨 · 계정 서버 연결 전', saved: '계정에 저장됨', pending: '저장 대기 중', saving: '계정에 저장 중…', offline: '연결되지 않음 · 기기에서 계속 플레이', conflict: '다른 기기에 더 최근 저장이 있습니다', expired: '계정을 다시 불러와 주세요' };

export async function mountAccount(adapter) {
  const hub = adapter.growth ? createHub() : null;
  const root = document.createElement('section'); root.className = hub ? 'account-panel hs-auth' : 'account-panel';
  const emailForms = `<div class="hs-auth-step" data-auth-step hidden>
    <p class="hs-auth-step-title" data-auth-title></p>
    <form data-email hidden><label for="hs-auth-email">이메일<input id="hs-auth-email" type="email" name="email" autocomplete="email" autocapitalize="none" spellcheck="false" required></label><button type="submit" data-send>인증번호 받기</button></form>
    <form data-code hidden><label for="hs-auth-code">인증번호<input id="hs-auth-code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" minlength="6" maxlength="10" placeholder="메일로 받은 번호" required></label><button type="submit" data-verify>인증하고 계속하기</button></form>
    <p class="hs-auth-note" data-code-help hidden>메일이 오지 않으면 스팸함을 확인해주세요.</p>
    <div class="hs-auth-step-actions"><button type="button" data-resend hidden>인증번호 다시 받기</button><button type="button" data-auth-back hidden>이메일 수정</button><button type="button" data-auth-cancel>취소</button></div>
  </div>`;
  const accountActions = `<p data-message role="status" aria-live="polite" aria-atomic="true"></p>
    <div class="hs-auth-account-actions"><button type="button" data-retry hidden>다시 연결</button>
    <button type="button" data-conflict hidden>다른 기기의 저장 불러오기</button>
    <button type="button" data-apply hidden>저장된 설정 적용</button>
    <button type="button" data-logout hidden>이 기기에서 로그아웃</button></div>`;
  if (hub) {
    root.setAttribute('aria-labelledby', 'hs-auth-heading');
    root.innerHTML = `<header class="hs-auth-header"><p class="hs-auth-eyebrow">여행자의 기록</p><h2 id="hs-auth-heading">내 기록과 계정</h2><p>가입 없이 시작하고, 원할 때 계정을 연결하세요.</p></header>
      <div class="hs-auth-columns">
        <section class="hs-auth-guest" aria-label="현재 기록">
          <span class="hs-auth-badge" data-session>이 기기의 게스트</span><h3><span data-name>여행자</span></h3>
          <p data-status role="status" aria-live="polite"></p>
          <form data-profile><label for="hs-auth-nickname">여행자 이름 <span class="hs-auth-optional">선택</span><input id="hs-auth-nickname" name="nickname" autocomplete="nickname" maxlength="48" placeholder="여행자" value="여행자" aria-describedby="hs-auth-name-help"></label><button type="submit">이름 저장</button></form>
          <p id="hs-auth-name-help" class="hs-auth-note">이름은 24자까지 쓸 수 있습니다.</p><p class="hs-auth-note" data-profile-message role="status"></p>
          <button type="button" class="hs-auth-continue" data-guest-continue>가입 없이 계속하기 <span aria-hidden="true">→</span></button>
          <p class="hs-auth-note" data-device-help>이 브라우저에 기록합니다. 브라우저 데이터를 지우면 사라질 수 있습니다.</p>
        </section>
        <section class="hs-auth-recovery" aria-labelledby="hs-auth-recovery-heading">
          <h3 id="hs-auth-recovery-heading">이메일로 기록 연결</h3><p class="hs-auth-note">기록을 보관하거나 다른 기기에서 불러옵니다.</p>
          <p class="hs-auth-availability" data-availability></p>
          <div class="hs-auth-choices" data-auth-choices><button type="button" data-login aria-describedby="hs-auth-help">이메일로 로그인</button><button type="button" data-link aria-describedby="hs-auth-help">게스트 계정에 이메일 연결</button></div>
          ${emailForms}${accountActions}<p id="hs-auth-help" class="hs-auth-note" data-help></p>
        </section>
      </div><button type="button" class="hs-auth-back" data-account-back>← 여정으로 돌아가기</button>`;
    hub.panel('account').append(root);
  } else {
    root.innerHTML = `<details><summary>내 정보 <span data-name>여행자</span></summary>
      <p data-status role="status" aria-live="polite"></p>
      <form data-profile><label>이름 <input name="nickname" autocomplete="nickname" maxlength="48" value="여행자"></label><button>저장</button></form>
      <p class="account-help">가입 없이 바로 플레이하세요. 지금은 이름과 게임 설정을 기억합니다.</p>
      <button type="button" data-link>이메일로 계정 보관</button><button type="button" data-login>다른 기기 계정 불러오기</button>
      ${emailForms}${accountActions}<p class="account-help" data-help></p><a href="account.html">저장 범위와 이용 안내</a>
    </details>`;
    document.querySelector('#menu .card').insertBefore(root, document.querySelector('#menu .actions'));
  }
  const el = (selector) => root.querySelector(selector);
  let transport; let setupError;
  try { transport = createTransport(config); } catch (error) { setupError = error.message; }
  let storage; try { storage = window.localStorage; } catch { storage = { getItem() { throw Error(); }, setItem() { throw Error(); } }; }
  let applied = JSON.stringify(adapter.read()); let timer; let mode; let email; let authBusy = false;
  let nicknameEdited = false; let authStep = 'choose'; let authVersion = 0; let resendAt = 0; let resendTimer;
  const controller = new AccountController({ appId: config.appId, transport, storage, initialSettings: adapter.read(), onChange: render });
  function renderAuth(state) {
    el('[data-auth-step]').hidden = authStep === 'choose';
    el('[data-email]').hidden = authStep !== 'email';
    el('[data-code]').hidden = authStep !== 'code';
    el('[data-code-help]').hidden = authStep !== 'code';
    el('[data-auth-back]').hidden = authStep !== 'code';
    el('[data-resend]').hidden = authStep !== 'code';
    if (hub) el('[data-auth-choices]').hidden = authStep !== 'choose';
    el('[data-link]').disabled = !transport || !state.user?.is_anonymous || !state.ready || authBusy;
    el('[data-login]').disabled = !transport || authBusy;
    const seconds = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
    el('[data-send]').disabled = !transport || authBusy || seconds > 0;
    el('[data-resend]').disabled = !transport || authBusy || seconds > 0;
    el('[data-verify]').disabled = !transport || authBusy;
    el('[data-send]').textContent = authBusy && authStep === 'email' ? '인증번호 요청 중…' : seconds ? `${seconds}초 후 다시 받기` : '인증번호 받기';
    el('[data-resend]').textContent = seconds ? `${seconds}초 후 다시 받기` : '인증번호 다시 받기';
    el('[data-verify]').textContent = authBusy && authStep === 'code' ? '확인 중…' : '인증하고 계속하기';
    el('[data-auth-step]').setAttribute('aria-busy', String(authBusy));
  }
  function render(state) {
    hub?.updateAccount(state);
    el('[data-name]').textContent = state.profile.display_name;
    el('[data-status]').textContent = !state.storageOK ? '기기 저장을 사용할 수 없습니다 · 닫으면 사라질 수 있습니다' : hub && !transport ? '현재 기록은 이 기기에만 저장됩니다.' : setupError || labels[state.status];
    if (!nicknameEdited) el('[name=nickname]').value = state.profile.display_name;
    el('[data-profile] button').disabled = !!transport && !state.ready;
    el('[data-retry]').hidden = !transport || !['offline', 'pending'].includes(state.status);
    el('[data-conflict]').hidden = state.status !== 'conflict';
    el('[data-logout]').hidden = !state.user || state.user.is_anonymous;
    el('[data-logout]').disabled = authBusy;
    el('[data-help]').textContent = !transport
      ? '이메일 연결과 계정 불러오기는 아직 사용할 수 없습니다. 가입 없이 계속할 수 있습니다.'
      : state.user?.is_anonymous
        ? '게스트 계정입니다. 이메일을 연결하지 않으면 앱 데이터 삭제 후 복구할 수 없습니다.'
        : '계정을 불러오면 해당 계정의 기록을 사용합니다. 현재 기기 기록과 자동으로 합쳐지지 않습니다.';
    if (hub) {
      const signedIn = state.user && !state.user.is_anonymous;
      el('[data-session]').textContent = signedIn ? '연결된 계정' : transport && state.user ? '게스트 계정' : '이 기기의 게스트';
      el('[data-guest-continue]').innerHTML = `${signedIn ? '이 계정으로 계속하기' : '가입 없이 계속하기'} <span aria-hidden="true">→</span>`;
      el('[data-availability]').textContent = !transport ? '계정 연결 준비 중 · 지금은 기기 저장으로 이용하세요.' : state.status === 'connecting' ? '계정을 연결하고 있습니다.' : state.status === 'offline' ? '연결이 원활하지 않습니다. 잠시 후 다시 시도해주세요.' : state.status === 'expired' ? '이메일로 로그인하면 이전 계정을 불러올 수 있습니다.' : '이메일로 받은 인증번호를 사용합니다.';
      el('[data-device-help]').textContent = signedIn ? '이 계정에 기록을 보관합니다. 저장 상태를 확인해주세요.' : transport && state.user ? '게스트 계정에 저장합니다. 이메일을 연결해야 브라우저 데이터를 지운 뒤에도 불러올 수 있습니다.' : '이 브라우저에 기록합니다. 브라우저 데이터를 지우면 사라질 수 있습니다.';
    }
    renderAuth(state);
    const settings = JSON.stringify(state.profile.settings);
    if ((state.ready || state.status === 'expired') && settings !== applied && adapter.canApply()) { adapter.apply(state.profile.settings); applied = settings; }
    el('[data-apply]').hidden = settings === applied;
  }
  const message = (text, kind = '') => { el('[data-message]').textContent = text; el('[data-message]').dataset.kind = kind; };
  el('[name=nickname]').addEventListener('input', () => { nicknameEdited = true; if (hub) el('[data-profile-message]').textContent = ''; });
  el('[data-profile]').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const value = el('[name=nickname]').value;
      controller.change({ display_name: hub ? value.trim() || '여행자' : value }); nicknameEdited = false; render(controller.snapshot()); void controller.flush();
      const savedMessage = controller.storageOK ? '이름을 기억했습니다.' : '이름을 바꿨지만 기기에 저장하지 못했습니다.';
      if (hub) el('[data-profile-message]').textContent = savedMessage;
      else message(savedMessage, controller.storageOK ? 'success' : 'error');
    } catch (error) { if (hub) el('[data-profile-message]').textContent = error.message; else message(error.message, 'error'); }
  });
  adapter.subscribe((settings) => {
    applied = JSON.stringify(settings); controller.change({ settings }); clearTimeout(timer); timer = setTimeout(() => void controller.flush(), 450);
  });
  function beginEmail(nextMode) {
    const state = controller.snapshot();
    if (!transport || authBusy || (nextMode === 'link' && (!state.user?.is_anonymous || !state.ready))) return;
    authVersion++; mode = nextMode; email = null; authStep = 'email'; el('[name=code]').value = '';
    el('[data-auth-title]').textContent = mode === 'link' ? '게스트 계정에 이메일 연결' : '이메일로 로그인';
    message(mode === 'link' ? '이메일을 연결하면 다른 기기에서도 이 계정을 불러올 수 있습니다.' : '기존 계정을 불러옵니다. 현재 기기 기록과 자동으로 합쳐지지 않습니다.');
    renderAuth(state); el('[name=email]').focus();
  }
  function cancelAuth() {
    authVersion++; mode = null; email = null; authStep = 'choose'; el('[name=code]').value = ''; message(''); renderAuth(controller.snapshot());
  }
  function focusAfterCancel() { el(authBusy ? hub ? '[data-guest-continue]' : 'summary' : '[data-login]').focus(); }
  el('[data-link]').onclick = () => beginEmail('link');
  el('[data-login]').onclick = () => beginEmail('login');
  el('[data-auth-cancel]').onclick = () => { cancelAuth(); focusAfterCancel(); };
  el('[data-auth-back]').onclick = () => {
    authVersion++; email = null; authStep = 'email'; el('[name=code]').value = ''; message('이메일을 확인하고 인증번호를 다시 받아주세요.'); renderAuth(controller.snapshot()); el('[name=email]').focus();
  };
  function leaveAccount() { cancelAuth(); hub?.show('journey'); }
  if (hub) {
    el('[data-guest-continue]').onclick = leaveAccount;
    el('[data-account-back]').onclick = leaveAccount;
  }
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault(); event.stopPropagation();
    if (authStep !== 'choose') { cancelAuth(); focusAfterCancel(); }
    else if (hub) leaveAccount();
    else { el('details').open = false; el('summary').focus(); }
  });
  async function busyAuth(action) {
    if (authBusy || !transport) return;
    const version = authVersion; authBusy = true; render(controller.snapshot());
    const current = () => version === authVersion;
    try { await action(current); } catch { if (current()) message('인증하지 못했습니다. 이메일·번호와 연결 상태를 확인하고 다시 시도해주세요.', 'error'); }
    finally { authBusy = false; render(controller.snapshot()); }
  }
  function tickCooldown() {
    clearTimeout(resendTimer); renderAuth(controller.snapshot());
    if (resendAt > Date.now()) resendTimer = setTimeout(tickCooldown, 1000);
  }
  function sendCode(target) {
    if (!target || !mode || authBusy || Date.now() < resendAt || !transport) return;
    const sendMode = mode;
    void busyAuth(async (current) => {
      resendAt = Date.now() + 30000; tickCooldown();
      await transport.sendCode(target, sendMode);
      if (!current()) return;
      email = target; authStep = 'code'; el('[name=code]').value = '';
      message(`${target}로 메일이 도착했다면 인증번호를 입력해주세요.`, 'success');
      renderAuth(controller.snapshot()); el('[name=code]').focus();
    });
  }
  el('[data-email]').onsubmit = (event) => { event.preventDefault(); if (event.currentTarget.reportValidity()) sendCode(el('[name=email]').value.trim()); };
  el('[data-resend]').onclick = () => sendCode(email);
  el('[data-code]').onsubmit = (event) => {
    event.preventDefault(); if (!email || !mode || !event.currentTarget.reportValidity()) return;
    const target = email; const verifyMode = mode; const token = el('[name=code]').value.trim();
    void busyAuth(async (current) => {
      const user = await transport.verify(target, token, verifyMode);
      await controller.adopt(user);
      if (!current()) return;
      authStep = 'choose'; el('[name=code]').value = ''; el('[name=email]').value = ''; email = null; mode = null;
      message('인증했습니다. 계정의 저장 상태를 확인해주세요.', 'success');
    });
  };
  el('[data-conflict]').onclick = () => {
    if (window.confirm('이 기기의 미전송 설정을 대신해 다른 기기의 저장을 불러올까요?')) void controller.reloadRemote();
  };
  el('[data-apply]').onclick = () => { if (adapter.canApply()) { adapter.apply(controller.profile.settings); applied = JSON.stringify(controller.profile.settings); render(controller.snapshot()); } };
  const retry = async () => {
    if (!controller.user) await controller.start();
    else if (controller.dirty) await controller.flush();
    else await controller.reloadRemote();
  };
  el('[data-retry]').onclick = () => void retry(); window.addEventListener('online', retry);
  el('[data-logout]').onclick = () => void busyAuth(async (current) => {
    if (controller.dirty) { await controller.flush(); if (controller.dirty) { if (current()) message('아직 전송하지 못한 설정이 있습니다. 연결 후 다시 시도해주세요.', 'error'); return; } }
    await transport.signOut(); controller.sessionEnded(); if (current()) { cancelAuth(); message('이 기기에서 로그아웃했습니다.'); }
  });
  if (adapter.growth) {
    const { mountGrowth } = await import('./growth-panel.js');
    mountGrowth({ account: controller, transport, storage, adapter: adapter.growth, hub });
  }
  render(controller.snapshot()); await controller.start();
  // Keep async work outside the SDK auth callback's storage lock.
  transport?.client.auth.onAuthStateChange((event, session) => {
    setTimeout(() => { if (event === 'SIGNED_OUT') controller.sessionEnded(); else if (session?.user) void controller.adopt(session.user); }, 0);
  });
}
