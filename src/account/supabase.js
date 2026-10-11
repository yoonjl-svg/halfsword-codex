import { createClient } from '@supabase/supabase-js';
import { namespace } from './profile.js';

export function createTransport(config) {
  const { appId, url, publishableKey } = config;
  if (!url && !publishableKey) return null;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) || !publishableKey) throw new Error('계정 서버 주소를 확인해주세요.');
  let role;
  try { role = JSON.parse(atob(publishableKey.split('.')[1])).role; } catch { /* new publishable key format */ }
  if (!publishableKey.startsWith('sb_publishable_') && role !== 'anon') throw new Error('공개용 키만 사용할 수 있습니다.');
  const client = createClient(url, publishableKey, {
    global: { fetch: (input, init = {}) => fetch(input, { ...init, signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000) }) },
    auth: { storageKey: namespace(appId) + 'auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  const checked = (result) => { if (result.error) throw result.error; return result.data; };
  const bearer = async (userId) => {
    const session = checked(await client.auth.getSession()).session;
    if (!session || session.user.id !== userId) throw Object.assign(new Error('Account changed'), { code: 'PT401' });
    return `Bearer ${session.access_token}`;
  };
  return {
    client,
    session: async () => checked(await client.auth.getSession()).session?.user || null,
    guest: async () => checked(await client.auth.signInAnonymously()).user,
    load: async (userId) => {
      const token = await bearer(userId);
      return checked(await client.from('player_profiles').select('*').eq('app_id', appId).eq('user_id', userId).maybeSingle().setHeader('Authorization', token));
    },
    save: async (revision, profile, userId) => {
      const token = await bearer(userId);
      return checked(await client.rpc('save_player_profile', { p_app_id: appId, p_expected_revision: revision, p_display_name: profile.display_name, p_settings: profile.settings }).setHeader('Authorization', token));
    },
    sendCode: async (email, mode) => checked(await (mode === 'link'
      ? client.auth.updateUser({ email })
      : client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } }))),
    verify: async (email, token, mode) => checked(await client.auth.verifyOtp({ email, token, type: mode === 'link' ? 'email_change' : 'email' })).user,
    signOut: async () => checked(await client.auth.signOut({ scope: 'local' })),
  };
}
