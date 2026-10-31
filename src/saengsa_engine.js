// 생사전 경기 엔진 (설계 docs/design/saengsa_2026-10-29.md §8 — 동시 대전 2:2 엔진 wk/team-fight main.js launchSaengsa)
//  내 경기 = 실제 싸움: game.launchSaengsa(setup) — setup = saengsa_rules.js matchSetup 꼴 { matchId, round, seed, mineSide, entrants, sides: { a: [사람], b: [사람] }, control }
//   control = 'player'(내가 나섬 — 내 몸은 나 · 함께 나선 동료는 AI) · 'watch'(동료만 나섬 — 넷 다 AI · 지켜봄) — matchSetup 이 고른 사람으로 정한다(사장님 10/29 14:2x · 14:5x)
//   사람의 broken: true = 그 무기가 이미 부러짐(사장님 10/29 20:1x — 엔진이 부러진 채 세움 · 따로 오는 엔진 쪽 몫)
//   돌려줌 = Promise<{ winner: 'a' | 'b', fighters: { key: { hp, injuries, alive, broken? } } }> — 그만두고 나오면(정지 창 '대기실') null = 아직 하지 않은 경기(지지 않음 · 적지 않음 — saengsa_page.js)
//  상대끼리 경기는 빠른 셈(saengsa_rules.js advance · quickResolve) — 빠르게. 엔진으로 돌리는 길은 SAENGSA.engine.ai(아직 없음 — 끔)
//  엔진이 없는 판(게임 모듈에 launchSaengsa 가 없음 · SAENGSA.engine.mine 끔)은 play() 가 null → saengsa_store.js playMine 이 빠른 셈으로 끝낸다
import { SAENGSA } from './config.js';

export function makeEngine(game, cfg = SAENGSA) {
  if (cfg.engine?.mine && typeof game?.launchSaengsa === 'function') return { real: true, play: (setup) => game.launchSaengsa(setup) };
  return { real: false, play: async () => null };
}
