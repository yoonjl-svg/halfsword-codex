import { GrowthController } from './growth-controller.js';
import { createLocalGrowth } from './growth-local.js';

export function mountGrowth({ account, transport, storage, adapter }) {
  const root = document.createElement('section'); root.className = 'account-panel growth-panel';
  root.innerHTML = `<details open><summary>나의 성장 <span data-seal></span></summary>
    <p data-growth-status role="status" aria-live="polite"></p>
    <p><b data-wins>0</b>승 · <b data-coins>0</b>코인 · 성장 포인트 <b data-points>0</b></p>
    <p data-milestone></p>
    <p>힘 <b data-strength>0</b> / 5 <button type="button" data-allocate>힘 강화 · 1포인트</button></p>
    <p class="account-help">힘 단계마다 근력 계수 +2%. 다음 경기부터 적용하며 피해량 +2%를 뜻하지 않습니다.</p>
    <p>여행자의 인장 · 30코인 <button type="button" data-purchase>구매</button> <button type="button" data-equip>표시하기</button></p>
    <p class="account-help">인장은 이름 옆에 표시하는 시험용 장식입니다. 전투 능력은 바뀌지 않습니다.</p>
    <p data-growth-error role="status"></p><button type="button" data-growth-retry>저장 확인·재연결</button>
    <p class="account-help" data-growth-mode></p><a href="growth.html">성장 규칙·서버 연결 안내</a>
  </details>`;
  document.querySelector('#menu .card').insertBefore(root, document.querySelector('#menu .actions'));
  const el = selector => root.querySelector(selector);
  const rpc = transport?.growthRpc || createLocalGrowth(storage, navigator.locks);
  const growth = new GrowthController({ rpc, storage, onChange: render });
  function render(view) {
    const s = view.state;
    el('[data-wins]').textContent = s.wins; el('[data-coins]').textContent = s.coins; el('[data-points]').textContent = s.points;
    el('[data-strength]').textContent = s.characters.player.strength;
    el('[data-growth-status]').textContent = view.status;
    el('[data-growth-error]').textContent = view.error;
    el('[data-milestone]').textContent = `다음 성장 포인트까지 ${3 - s.wins % 3}승 · 승리마다 10코인`;
    el('[data-growth-mode]').textContent = transport
      ? '시험용 성장 계정 · 온라인에서 등록된 경기만 보상합니다. 보상 수치는 임시입니다.'
      : '기기에만 저장하는 성장 연습판입니다. 이 코인·강화는 실제 계정으로 이월하지 않습니다. 서버 연결 후 새 계정 기록을 사용합니다.';
    const owned = s.inventory.includes('wayfarer_seal');
    el('[data-purchase]').disabled = !view.ready || view.busy || owned || s.coins < 30;
    el('[data-purchase]').textContent = owned ? '보유 중' : '구매';
    el('[data-equip]').disabled = !view.ready || view.busy || !owned;
    el('[data-equip]').textContent = s.equipped ? '표시 해제' : '표시하기';
    el('[data-allocate]').disabled = !view.ready || view.busy || s.points < 1 || s.characters.player.strength >= 5;
    el('[data-seal]').textContent = s.equipped ? '✦ 여행자의 인장' : '';
    // A menu badge, not equipment colliders or an unannounced physics modifier.
    const name = document.querySelector('.account-panel [data-name]'); if (name) name.dataset.seal = s.equipped ? '✦' : '';
    el('[data-growth-retry]').disabled = view.busy;
  }
  el('[data-purchase]').onclick = () => void growth.enqueue('purchase', { p_item_id: 'wayfarer_seal' });
  el('[data-allocate]').onclick = () => void growth.enqueue('allocate', { p_character_id: 'player', p_stat: 'strength' });
  el('[data-equip]').onclick = () => void growth.enqueue('equip', { p_item_id: growth.state.equipped ? null : 'wayfarer_seal' });
  el('[data-growth-retry]').onclick = () => void growth.refresh();
  window.addEventListener('online', () => void growth.refresh());
  window.addEventListener('storage', event => { if (event.key?.startsWith(growth.prefix())) void growth.refresh(); });
  account.subscribe(state => { void growth.identify(transport ? state.user?.id || null : 'practice'); });
  adapter.connect(growth);
  render({ state: growth.state, ready: growth.ready, busy: false, status: growth.status, error: growth.error });
  return growth;
}
