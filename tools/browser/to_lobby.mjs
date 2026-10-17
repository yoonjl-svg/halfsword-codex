// 대기실 가는 길 (점검 도구 공통) — 사장님 10/17 11:2x '첫화면-대기실-전투 흐름이 아니라 첫화면에서 바로 전투로 이동'
//  첫 화면 'Stage 1'(#newJourney) · '이어하기'(#continueJourney) → 곧바로 여정(카드 고르기, 또는 장착한 무기로 싸움)
//  → 정지(카드 고르기 중에도 열림 — main.js pause) → '대기실'(#btnLobby — main.js toLobby → game_entry.js backToLobby).
//  대기실은 언제나 choice 'continue' 로 열린다(출발 단추 'Stage 입장' — 사장님 10/17 12:1x, 전 '여정 이어가기'). how = 'click' | 'tap' (터치 문맥이면 tap)
//  첫 화면에서 출발하면 그 판이 이어하기 지점으로 저장된다(카드를 펼칠 때 — main.js saveJourneyRound) — 지점을 보는 점검은 이것을 셈에 넣는다.

/** 첫 화면에서 출발: 덮개가 걷히고 카드 고르기나 싸움이 될 때까지. 돌려줌: 'draw' | 'fight' */
export async function departTitle(p, sel = '#newJourney', how = 'click') {
  await p.locator(sel)[how]();
  await p.waitForFunction(() => !document.getElementById('gameEntrance') && ['draw', 'fight'].includes(window.game?.state), null, { timeout: 90000 });
  return p.evaluate(() => window.game.state);
}

/** 싸움(또는 카드 고르기)에서 정지 → '대기실'. 대기실 몸이 설 때까지 기다린다 */
export async function lobbyFromBattle(p, how = 'click') {
  await p.evaluate(() => document.getElementById('btnPause').click()); // 정지 단추는 판 시작 정지 동안 숨어 있을 수 있어 직접 누른다
  await p.waitForFunction(() => window.game.state === 'paused' && !document.getElementById('btnLobby').hidden, null, { timeout: 30000 });
  await p.locator('#btnLobby')[how]();
  await p.locator('#characterView canvas').waitFor({ timeout: 60000 });
  await p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('characterView')?.dataset.rig === 'ready', null, { timeout: 90000 }).catch(() => {});
}

/** 첫 화면 → (곧바로 여정) → 정지 → 대기실 */
export async function titleToLobby(p, sel = '#newJourney', how = 'click') {
  const state = await departTitle(p, sel, how);
  await lobbyFromBattle(p, how);
  return state;
}
