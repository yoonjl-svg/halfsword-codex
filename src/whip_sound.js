// 드루이드의 채찍 소리 걸쇠 (10/23 사장님 '휘두르고 때릴 때 실제 채찍 소리' — 10/24 main.js 에서 옮김: 게임 · 노드 도구 · 시험이 같은 셈을 쓴다).
//  소리만 — 판정 · 물리와 무관. 녹음 · 음량은 src/sound.js whip (확인표 2259 · 2260 · 2442 ~ 2445).
//  끝 빠르기(fighter.tipVel · m/s)를 화면마다 넣으면: swishOn 을 넘어 오를 때 '휙' 한 번(swishOff 아래로 내려오면 다시 걸림) ·
//  crack 을 넘게 오른 뒤 최고점에서 15 % 꺾이면 그 최고 빠르기로 '딱' 한 번(crack × 0.6 아래로 내려오면 다시 걸림).
export const WHIP_SOUND = { swishOn: 9, swishOff: 5, crack: 14 };

/** 이번 화면에 낼 채찍 소리 [['swish', 빠르기] | ['crack', 최고 빠르기]] — W 는 채찍마다 따로 두는 상태 객체(처음엔 빈 객체) */
export function whipTipStep(W, v) {
  const out = [];
  W.up ??= false; W.pk ??= 0; W.lock ??= false;
  if (!W.up && v > WHIP_SOUND.swishOn) { W.up = true; out.push(['swish', v]); }
  else if (W.up && v < WHIP_SOUND.swishOff) W.up = false;
  if (W.lock) { if (v < WHIP_SOUND.crack * 0.6) W.lock = false; return out; }
  if (v > WHIP_SOUND.crack && v > W.pk) W.pk = v;
  else if (W.pk > 0 && v < W.pk * 0.85) { out.push(['crack', W.pk]); W.pk = 0; W.lock = true; }
  return out;
}

/** 기본 contact = 가죽 찰싹. ?whipHit=c2/old 는 이전 피격음 비교; main.js가 SOUND.whipHit에 넣는다. */
export const whipHitMode = (params, base = 'contact') => ['old', 'c2', 'contact'].includes(params.get('whipHit')) ? params.get('whipHit') : base;

/**
 * C2 맞음('lash') · 끝 '딱'('crack') 겹침 막기 (10/24 — C2 는 그 자체가 채찍 '딱' 이라 한 맞음이 두 번 터지지 않게). 낼 소리면 true (그때만 G 에 때를 적음).
 *  now = 소리 시계(초) · o.whipLashGap: C2 맞음 뒤 이 시간 안의 끝 '딱' · 다른 C2 맞음은 안 냄 (맞아 끝이 꺾여 나는 '딱' · 한 획에 마디 여럿이 닿음)
 *  o.whipFlam: 끝 '딱' 뒤 이 시간 안의 C2 맞음은 안 냄 (거의 같은 때 — 이미 난 '딱'이 맞음 소리를 대신). 그보다 늦으면 공중 '딱' + 맞음 '짝' 둘 다
 */
export function whipCrackGate(G, kind, now, o) {
  if (now - (G.lash ?? -Infinity) < o.whipLashGap) return false;
  if (kind === 'lash' && now - (G.crack ?? -Infinity) < o.whipFlam) return false;
  G[kind] = now;
  return true;
}
