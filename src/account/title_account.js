import { createClient } from '@supabase/supabase-js';
import config from './config.js';

const NORMAL_KEY = 'stillness-account:v1:halfsword-codex:auth';
const LEGACY_KEY = 'stillness-account:v1:halfsword-codex-growth-trial:auth';
let client;
const memory = new Map();
const storage = {
  getItem(key) { try { return localStorage.getItem(key) ?? memory.get(key) ?? null; } catch { return memory.get(key) ?? null; } },
  setItem(key, value) { memory.set(key, value); try { localStorage.setItem(key, value); } catch { /* 이번 실행 동안 유지 */ } },
  removeItem(key) { memory.delete(key); try { localStorage.removeItem(key); } catch { /* 이번 실행 동안 유지 */ } },
};
function getClient() {
  if (!client) client = createClient(config.url, config.publishableKey, {
    global: { fetch: (input, init = {}) => fetch(input, { ...init, signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000) }) },
    auth: { storageKey: storage.getItem(NORMAL_KEY) ? NORMAL_KEY : storage.getItem(LEGACY_KEY) ? LEGACY_KEY : NORMAL_KEY,
      storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}
export const connectedEmail = user => user && !user.is_anonymous && user.email_confirmed_at && typeof user.email === 'string' ? user.email : '';
export const accountLabel = user => connectedEmail(user).split('@')[0] || '계정 연결';
const failure = error => error?.status === 429 ? '요청이 많습니다. 잠시 후 다시 시도해 주세요.'
  : ['otp_expired','otp_disabled','validation_failed'].includes(error?.code) ? '인증번호를 확인하거나 새 번호를 받아 주세요.'
  : ['email_exists','user_already_exists','identity_already_exists'].includes(error?.code) ? '이미 연결된 이메일입니다. 기존 계정으로 로그인해 주세요.'
  : error?.code === 'signup_disabled' ? '가입이 제한되어 있습니다. 기존 계정으로 로그인해 주세요.'
  : error?.status >= 500 ? '메일 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  : '연결하지 못했습니다. 인터넷 연결과 입력 내용을 확인해 주세요.';

export function mountTitleAccount(root, { auth = getClient().auth } = {}) {
  const $ = id => root.getElementById(id), events = new AbortController();
  const listen = (id, type, fn) => $(id).addEventListener(type, fn, { signal: events.signal });
  const dialog = $('accountDialog');
  let revision = 0;
  let user = null, busy = false, step = 'email', mode = 'connect', email = '', otpType = 'email', resendAt = 0, timer;
  const message = text => { if (!events.signal.aborted) $('accountStatus').textContent = text; };
  function render() {
    if (events.signal.aborted) return;
    const linked = connectedEmail(user), seconds = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
    $('openAccount').textContent = accountLabel(user);
    $('openAccount').dataset.connected = String(!!linked);
    $('openAccount').setAttribute('aria-label', linked ? `${accountLabel(user)} 계정` : '계정 연결');
    $('openAccount').title = linked ? accountLabel(user) : '';
    $('accountHeading').textContent = linked ? '연결된 계정' : '계정 연결';
    $('accountConnected').hidden = !linked; $('accountForms').hidden = !!linked;
    $('accountAddress').textContent = linked;
    $('accountEmailForm').hidden = step !== 'email'; $('accountCodeForm').hidden = step !== 'code';
    $('accountMode').textContent = mode === 'connect' ? '기존 계정으로 로그인' : '새 계정 연결로 돌아가기';
    $('accountIntro').textContent = mode === 'login' ? '기존 계정의 이메일로 인증번호를 받으세요.' : '이메일로 받은 인증번호로 연결합니다.';
    $('accountCodeHelp').textContent = `${email}로 보낸 번호를 입력하세요. 메일의 인증 링크로도 연결할 수 있습니다.`;
    for (const id of ['accountEmail','accountCode','accountVerify','accountMode','accountEditEmail','accountLogout']) $(id).disabled = busy;
    $('accountSend').disabled = busy || seconds > 0; $('accountResend').disabled = busy || seconds > 0;
    $('accountSend').textContent = busy ? '요청 중…' : seconds ? `${seconds}초 후 다시 받기` : '인증번호 받기';
    $('accountResend').textContent = seconds ? `${seconds}초 후 재전송` : '다시 받기';
    dialog.setAttribute('aria-busy', String(busy));
  }
  const checked = result => { if (result.error) throw result.error; return result.data; };
  async function refreshUser() {
    try {
      const session = checked(await auth.getSession()).session;
      if (events.signal.aborted) return;
      user = session?.user || null; render();
      if (session) {
        const stamp = revision, id = user?.id;
        const result = await auth.getUser();
        if (events.signal.aborted || revision !== stamp || user?.id !== id) return;
        if (!result.error) user = result.data.user;
        else if (result.error.status === 401 || result.error.status === 403) user = null;
        render();
      }
    } catch { /* 네트워크가 없어도 로컬 게임 진입은 막지 않는다. */ }
  }
  const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
    revision++; user = session?.user || null; render();
  });
  refreshUser(); render();
  listen('openAccount', 'click', () => { dialog.showModal(); render(); if (connectedEmail(user)) $('accountHeading').focus(); else $('accountEmail').focus(); });
  listen('closeAccount', 'click', () => dialog.close());
  listen('accountMode', 'click', () => { mode = mode === 'connect' ? 'login' : 'connect'; step = 'email'; message(''); render(); $('accountEmail').focus(); });
  listen('accountEditEmail', 'click', () => { step = 'email'; message(''); render(); $('accountEmail').focus(); });
  async function sendCode() {
    if (busy || Date.now() < resendAt) return;
    email = $('accountEmail').value.trim();
    if (!$('accountEmail').reportValidity()) return;
    busy = true; message(''); render();
    try {
      const redirect = new URL(location.pathname, location.origin).href;
      otpType = user?.is_anonymous && mode === 'connect' ? 'email_change' : 'email';
      checked(await (otpType === 'email_change' ? auth.updateUser({ email }, { emailRedirectTo: redirect })
        : auth.signInWithOtp({ email, options: { shouldCreateUser: mode !== 'login', emailRedirectTo: redirect } })));
      if (events.signal.aborted) return;
      resendAt = Date.now() + 60000; step = 'code'; $('accountCode').value = '';
      clearInterval(timer); timer = setInterval(() => { render(); if (Date.now() >= resendAt) clearInterval(timer); }, 1000);
      message('메일을 확인해 주세요. 스팸함도 확인해 주세요.');
    } catch (error) { message(failure(error)); }
    finally { busy = false; render(); if (!events.signal.aborted && step === 'code') $('accountCode').focus(); }
  }
  listen('accountEmailForm', 'submit', event => { event.preventDefault(); sendCode(); });
  listen('accountResend', 'click', sendCode);
  listen('accountCodeForm', 'submit', async event => {
    event.preventDefault(); if (busy) return;
    busy = true; message(''); render();
    try {
      const data = checked(await auth.verifyOtp({ email, token: $('accountCode').value.trim(), type: otpType }));
      if (events.signal.aborted) return;
      user = data.user; $('accountCode').value = '';
      message(connectedEmail(user) ? '계정이 연결되었습니다.' : '이메일 인증을 완료해 주세요.');
    } catch (error) { message(failure(error)); }
    finally { busy = false; render(); }
  });
  listen('accountLogout', 'click', async () => {
    if (busy) return; busy = true; render();
    try { checked(await auth.signOut({ scope: 'local' })); user = null; step = 'email'; message('이 기기에서 로그아웃했습니다.'); }
    catch (error) { message(failure(error)); }
    finally { busy = false; render(); }
  });
  return { destroy() { events.abort(); clearInterval(timer); subscription.unsubscribe(); dialog.close(); } };
}
