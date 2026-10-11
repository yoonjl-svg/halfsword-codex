import { GROWTH_APP, emptyGrowth, checkedGrowth, TRIAL_RULES } from './growth-model.js';

const fail = (message, code = 'PT400') => { throw Object.assign(new Error(message), { code }); };
// Device-only rehearsal. This balance is NEVER imported into a server account.
export function createLocalGrowth(storage, locks, now = Date.now) {
  const key = `stillness-growth:v1:${GROWTH_APP}:practice`;
  return async (method, args) => {
    if (!locks?.request) fail('이 브라우저에서는 안전한 기기 저장을 사용할 수 없습니다.', 'STORAGE');
    return locks.request(key, async () => {
      const raw = storage.getItem(key);
      const db = raw ? JSON.parse(raw) : { state: emptyGrowth(), rounds: {}, requests: {}, active: null };
      checkedGrowth(db.state);
      const state = db.state;
      const id = args.p_request_id;
      const body = JSON.stringify([method, args]);
      if (id && db.requests[id]) {
        if (db.requests[id].body !== body) fail('같은 요청 번호에 다른 작업을 넣을 수 없습니다.', 'PT409');
        return method === 'begin_round' ? { round_id: db.requests[id].round } : structuredClone(state);
      }
      if (Object.keys(db.requests).length > 10000) fail('연습 저장 한도에 도달했습니다.', 'STORAGE');
      let result;
      if (method === 'snapshot') return structuredClone(state);
      if (method === 'begin_round') {
        if (db.active && db.rounds[db.active]) db.rounds[db.active].abandoned = true;
        db.active = id; db.rounds[id] = { started: now(), result: null };
        result = { round_id: id };
      } else if (method === 'finish_round') {
        const round = db.rounds[args.p_round_id];
        if (!round || round.abandoned) fail('중단된 경기에는 보상이 없습니다.', 'PT410');
        if (round.result !== null) {
          if (round.result !== args.p_win) fail('이미 확정된 결과입니다.', 'PT409');
          return structuredClone(state);
        }
        if (now() - round.started < 3000) fail('경기 결과를 잠시 후 다시 확인합니다.', 'PT425');
        if (now() - round.started > 86400000) fail('경기 기록이 만료됐습니다.', 'PT410');
        if (typeof args.p_win !== 'boolean') fail('Invalid outcome');
        round.result = args.p_win; db.active = null;
        if (args.p_win) { state.wins++; state.coins += TRIAL_RULES.winCoins; if (state.wins % TRIAL_RULES.milestone === 0) state.points += TRIAL_RULES.pointsPerMilestone; }
        state.revision++;
      } else if (method === 'purchase') {
        const item = state.catalog.find(x => x.id === args.p_item_id);
        if (!item) fail('없는 상품입니다.');
        if (state.inventory.includes(item.id)) fail('이미 보유하고 있습니다.', 'PT409');
        if (state.coins < item.price) fail('코인이 부족합니다.', 'PT409');
        state.coins -= item.price; state.inventory.push(item.id); state.revision++;
      } else if (method === 'allocate') {
        if (args.p_character_id !== 'player' || args.p_stat !== 'strength') fail('지원하지 않는 강화입니다.');
        if (state.points < 1 || state.characters.player.strength >= TRIAL_RULES.strengthCap) fail('포인트가 부족하거나 강화가 최대입니다.', 'PT409');
        state.points--; state.characters.player.strength++; state.revision++;
      } else if (method === 'equip') {
        if (args.p_item_id !== null && !state.inventory.includes(args.p_item_id)) fail('보유하지 않은 아이템입니다.');
        state.equipped = args.p_item_id; state.revision++;
      } else fail('Unknown operation');
      if (id) db.requests[id] = { body, round: result?.round_id };
      storage.setItem(key, JSON.stringify(db)); // Commit once, only after all checks.
      return result || structuredClone(state);
    });
  };
}
