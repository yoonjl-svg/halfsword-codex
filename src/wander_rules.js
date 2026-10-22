// 방랑(작업명): 일반 무대를 모두 마친 뒤 여는 무작위 연속 대전.
// 보스 추가 보상은 일반 승리 보상 2배를 계산한 뒤 더한다. 패배 차감은 그대로.
export const WANDER_NAME = '방랑';
export const WANDER_EXCLUSIVE = Object.freeze(['artoria', 'artoria_mad', 'sebastian', 'white_scale']);
export function wanderBonus(foe) {
  return { coins: ['artoria', 'artoria_mad', 'sebastian'].includes(foe) ? 200 : 0, heads: foe === 'white_scale' ? 5 : 0 };
}
export function wanderReward(win, foe, ordinaryCoins) {
  const bonus = win ? wanderBonus(foe) : { coins: 0, heads: 0 };
  return { coins: win ? ordinaryCoins * 2 + bonus.coins : -ordinaryCoins, heads: bonus.heads, bonus };
}
const id = v => typeof v === 'string' && /^[a-z0-9_]{1,64}$/.test(v);
export function normalizeWander(value) {
  const cleared = Array.isArray(value?.cleared) ? [...new Set(value.cleared.filter(id))] : [];
  let run = value?.run;
  if (!run || typeof run.id !== 'string' || run.id.length > 100 || !['active', 'won', 'lost'].includes(run.status)
    || !Number.isSafeInteger(run.round) || run.round < 1 || !Number.isSafeInteger(run.wins) || run.wins < 0
    || !id(run.stage) || !id(run.foe) || !id(run.foeWeapon)
    || ['weapon', 'lastWeapon'].some(k => run[k] != null && !id(run[k]))
    || (run.cards != null && (!Array.isArray(run.cards) || run.cards.length !== 2 || !run.cards.every(id)))) run = null;
  else run = { ...run, headTaken: !!run.headTaken };
  return { cleared, unlocked: value?.unlocked === true, legacyChecked: value?.legacyChecked === true, run };
}
export function chooseWanderEncounter(stages, foes, random = Math.random) {
  if (!stages.length || !foes.length) throw new Error('Empty wander pool');
  // 두 추첨은 독립이다. 특정 인물에 특정 무대를 다시 묶지 않는다.
  const pick = pool => pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))];
  return { stage: pick(stages), foe: pick(foes) };
}
