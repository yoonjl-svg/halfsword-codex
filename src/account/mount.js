import config from './config.js';
import { AccountController } from './controller.js';
import { createTransport } from './supabase.js';
import './style.css';

const labels = { connecting: '계정 연결 중…', local: '이 기기에 저장됨 · 계정 서버 연결 전', saved: '계정에 저장됨', pending: '저장 대기 중', saving: '계정에 저장 중…', offline: '연결되지 않음 · 기기에서 계속 플레이', conflict: '다른 기기에 더 최근 저장이 있습니다', expired: '계정을 다시 불러와 주세요' };

export async function mountAccount(adapter) {
  const root = document.createElement('section'); root.className = 'account-panel';
  root.innerHTML = `<details><summary>내 정보 <span data-name>여행자</span></summary>
    <p data-status role="status" aria-live="polite"></p>
    <form data-profile><label>이름 <input name="nickname" autocomplete="nickname" maxlength="48" value="여행자"></label><button>저장</button></form>
    <p class="account-help">가입 없이 바로 플레이하세요. 지금은 이름과 게임 설정을 기억합니다.</p>
    <button type="button" data-link>이메일로 계정 보관</button>
    <button type="button" data-login>다른 기기 계정 불러오기</button>
    <form data-email hidden><label>이메일 <input type="email" name="email" autocomplete="email" required></label><button>인증번호 받기</button></form>
    <form data-code hidden><label>인증번호 <input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" required></label><button>확인</button></form>
    <p data-message role="status"></p>
    <button type="button" data-retry hidden>다시 연결</button>
    <button type="button" data-conflict hidden>다른 기기의 저장 불러오기</button>
    <button type="button" data-apply hidden>저장된 설정 적용</button>
    <button type="button" data-logout hidden>이 기기에서 로그아웃</button>
    <p class="account-help" data-help></p>
    <a href="account.html">저장 범위와 이용 안내</a>
  </details>`;
  document.querySelector('#menu .card').insertBefore(root, document.querySelector('#menu .actions'));
  const el = (selector) => root.querySelector(selector);
  let transport; let setupError;
  try { transport = createTransport(config); } catch (error) { setupError = error.message; }
  let storage; try { storage = window.localStorage; } catch { storage = { getItem() { throw Error(); }, setItem() { throw Error(); } }; }
  let applied = JSON.stringify(adapter.read()); let timer; let mode; let email; let authBusy = false;
  const controller = new AccountController({ appId: config.appId, transport, storage, initialSettings: adapter.read(), onChange: render });
  function render(state) {
    el('[data-name]').textContent = state.profile.display_name;
    el('[data-status]').textContent = setupError || (state.storageOK ? labels[state.status] : '기기 저장을 사용할 수 없습니다 · 닫으면 사라질 수 있습니다');
    if (document.activeElement !== el('[name=nickname]')) el('[name=nickname]').value = state.profile.display_name;
    el('[data-profile] button').disabled = !!transport && !state.ready;
    el('[data-link]').disabled = !transport || !state.user || !state.user.is_anonymous || authBusy;
    el('[data-login]').disabled = !transport || authBusy;
    el('[data-retry]').hidden = !transport || !['offline', 'pending'].includes(state.status);
    el('[data-conflict]').hidden = state.status !== 'conflict';
    el('[data-logout]').hidden = !state.user || state.user.is_anonymous;
    el('[data-help]').textContent = !transport
      ? '현재는 이 기기에만 저장합니다. 계정 서버 연결 후 이메일 보관·다른 기기 복원을 사용할 수 있습니다.'
      : state.user?.is_anonymous
        ? '게스트 계정입니다. 이메일을 연결하지 않으면 앱 데이터 삭제 후 복구할 수 없습니다.'
        : '계정을 불러오면 해당 계정의 설정을 사용합니다. 기존 게스트 저장과 자동 합치지 않습니다.';
    const settings = JSON.stringify(state.profile.settings);
    if ((state.ready || state.status === 'expired') && settings !== applied && adapter.canApply()) { adapter.apply(state.profile.settings); applied = settings; }
    el('[data-apply]').hidden = settings === applied;
  }
  const message = (text) => { el('[data-message]').textContent = text; };
  el('[data-profile]').addEventListener('submit', (event) => {
    event.preventDefault();
    try { controller.change({ display_name: el('[name=nickname]').value }); void controller.flush(); message(''); } catch (error) { message(error.message); }
  });
  adapter.subscribe((settings) => {
    applied = JSON.stringify(settings); controller.change({ settings }); clearTimeout(timer); timer = setTimeout(() => void controller.flush(), 450);
  });
  function beginEmail(nextMode) {
    mode = nextMode; email = null; el('[data-email]').hidden = false; el('[data-code]').hidden = true;
    message(mode === 'link' ? '한 번 인증하면 다른 기기에서도 이 계정을 불러올 수 있습니다.' : '기존 계정을 불러옵니다. 지금 계정의 설정은 합쳐지지 않습니다.');
    el('[name=email]').focus();
  }
  el('[data-link]').onclick = () => beginEmail('link');
  el('[data-login]').onclick = () => beginEmail('login');
  async function busyAuth(action) {
    if (authBusy) return;
    authBusy = true; root.querySelectorAll('[data-email] button,[data-code] button').forEach((b) => b.disabled = true); render(controller.snapshot());
    try { await action(); } catch { message('인증을 완료하지 못했습니다. 이메일·번호와 연결 상태를 확인하고 잠시 후 다시 시도해주세요.'); }
    finally { authBusy = false; root.querySelectorAll('[data-email] button,[data-code] button').forEach((b) => b.disabled = false); render(controller.snapshot()); }
  }
  el('[data-email]').onsubmit = (event) => {
    event.preventDefault(); const target = el('[name=email]').value.trim();
    void busyAuth(async () => {
      await transport.sendCode(target, mode); email = target; el('[data-code]').hidden = false;
      message('메일이 발송된 경우 받은 인증번호를 입력해주세요.'); el('[name=code]').focus();
    });
  };
  el('[data-code]').onsubmit = (event) => {
    event.preventDefault(); if (!email) return;
    void busyAuth(async () => {
      const user = await transport.verify(email, el('[name=code]').value.trim(), mode);
      await controller.adopt(user); el('[data-email]').hidden = true; el('[data-code]').hidden = true;
      el('[name=code]').value = ''; el('[name=email]').value = ''; email = null; message('인증했습니다.');
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
  el('[data-logout]').onclick = () => void busyAuth(async () => {
    if (controller.dirty) { await controller.flush(); if (controller.dirty) { message('아직 전송하지 못한 설정이 있습니다. 연결 후 다시 시도해주세요.'); return; } }
    await transport.signOut(); controller.sessionEnded(); message('이 기기에서 로그아웃했습니다.');
  });
  render(controller.snapshot()); await controller.start();
  // Keep async work outside the SDK auth callback's storage lock.
  transport?.client.auth.onAuthStateChange((event, session) => {
    setTimeout(() => { if (event === 'SIGNED_OUT') controller.sessionEnded(); else if (session?.user) void controller.adopt(session.user); }, 0);
  });
}
