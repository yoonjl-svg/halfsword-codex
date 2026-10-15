// ─────────────────────────────────────────────────────────────
//  시험 도구: 헛스윙 연습 상대 (사장님 10/15 20:3x "테스트 경로에 헛스윙 넣어." — docs/strike/german_hold_2026-10-15.md §7)
//
//  독일 보법 '간격 잡기'(상대가 헛친 뒤 0.6 s 안에 앞으로 걸으면 빠른 디딤으로 다가가 칼이 제대로 들어가는 거리에서 선다)는
//  상대가 헛쳐야 켜진다 — AI 와 싸울 때는 그 순간이 드물어 시험이 어려웠다(사장님). 그래서 상대 AI 가 일부러 허공을 베는 시험 스위치.
//  켜는 법: test.html '상대 헛스윙' 고르기(→ 게임 주소 foeWhiff=1) 또는 주소에 ?foeWhiff=1 (test=1 없이도). main.js 가 판마다 새 상대 AI 에 붙인다(ai.drill).
//  없으면(기본) 아무것도 붙지 않는다 — ai.js 의 드릴 자리(drill*)는 this.drill 이 null 이면 아무 일도 안 해 본판·시뮬·관문이 바이트 그대로.
//
//  상대가 하는 일 (ai.js drillWatch · moveFeet · startAttack · attack · stepTime):
//   ① 제 칼이 닿지 않는 거리 = 제 간격 M.reach(서 있다가 휘두르며 한 걸음 내디디면 닿는 거리) + gap 에 머문다 — gap 은 판마다 [0.35, 0.40] m 에서 하나(처음 [0.25, 0.45] — 10/15 22:5x 좁힘).
//      멀면 걸어서 다가가고, 플레이어가 다가와도 물러나지 않는다(옆으로 돌지도 않는다). 제 걸음이 지나쳐 안쪽에 섰으면(상대는 가만히) 그 거리로 물러난다
//   ② 공격 시작부터 every s(공격마다 [2, 3] 에서 하나) 지나면 드릴 거리 근처(− back ~ + near)에서 보통 기술(pickTech — 그 유파 기술 고르기 그대로, 속임수 없음)로 친다.
//      그 자리에서: 다가가기·베며 내딛기·기술 걸음이 없다(atkFeet — 검술 층 자동 내딛기만 막는다).
//      몸에도 칼에도 닿지 않고 끝나면 게임의 진짜 헛침 길(ai.js afterStrike → gait.foeWhiff)이 알린다 — 여기서 foeWhiff 를 부르지 않는다(사람이 상대가 허공을 베는 것을 눈으로 본다)
//   ③ 플레이어가 다가와 그 거리 − inside 안으로 들어오면(또는 − deep 안에 있으면) 평소대로 싸운다(막고 친다 — 연습이 아니라 실전으로 이어지게).
//      평소대로 싸우다 그 거리 + outside 밖으로 멀어지면 헛스윙으로 돌아간다
//   ④ 판 시작 정지 · 마무리(쓰러진·낮은 상대 간격) · 넘어짐(나든 상대든 서 있지 않음) · 칼 놓침(나 · 상대 — 쫓기) · 부활 · 비기 중에는 하지 않는다(평소대로)
//   헛스윙 동안(①②)은 드릴이 판단을 맡는다: 비기 사건 보기 · 발도·길목 준비 · 미룬 패시브 · 낌새 앞지르기·붙잡기 · 빈틈 공격을 쉬고, 들어오는 칼 받기(respond)만 평소대로
//  값은 시험 도구 값이라 게임 확인표(docs/strike/owner_defaults_table.md)에 넣지 않는다 — 문서에만
// ─────────────────────────────────────────────────────────────

export const WHIFF_DRILL = {
  gap: [0.35, 0.4], // 제 M.reach 밖으로 이만큼 (m) — 판마다 하나 (감독 10/15 22:5x: 처음 0.25~0.45 에서 아래 끝 0.25 는 팔뚝에 닿고(시뮬 맞힘 3/36) 0.40 넘으면 간격 잡기가 덜 걸려(2/4) 좁힘 — 시험 도구 값)
  every: [2, 3], // 공격 시작 사이 (s) — 공격마다 하나 (감독 지시 값)
  // 아래는 걸음이 한 디딤(0.1~0.2 m)씩이라 드릴 거리에 딱 서지 못해 둔 띠 (작업 시뮬로 고름)
  stop: 0.1, // 다가가기: 드릴 거리 + 이만큼 안이면 선다 (m)
  lead: 0.4, // 다가가기: 내 다가가는 빠르기 × 이 시간(s)만큼 먼저 선다 — 걷던 몸이 서기까지 미끄러지는 몫
  back: 0.05, // 드릴 거리 − 이만큼보다 안쪽에 섰고 상대가 다가오지 않으면 물러난다 · 공격도 이 안쪽에선 내지 않는다 (m)
  near: 0.15, // 공격은 드릴 거리 + 이만큼 안에서만 낸다 — 멀면 먼저 다가간다 (허공이 너무 멀지 않게, m)
  closing: 0.2, // 상대가 다가오는 빠르기(m/s)가 이보다 크면 '다가온다'
  inside: 0.15, // 상대가 다가와 드릴 거리 − 이만큼 안으로 들어오면 평소대로 (m)
  deep: 0.3, // 다가오지 않았어도 드릴 거리 − 이만큼 안이면 평소대로 (m)
  outside: 0.15, // 평소대로 싸우다 드릴 거리 + 이만큼보다 멀어지면 헛스윙으로 (m)
};

const pick = ([a, b]) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export class WhiffDrill {
  constructor() {
    this.gap = pick(WHIFF_DRILL.gap); // 이번 판 바깥 거리 (m)
    this.next = pick(WHIFF_DRILL.every); // 다음 공격까지 남은 시간 (s — 헛스윙 동안만 줄어든다)
    this.inside = false; // 평소대로 싸우는 중인가 (플레이어가 드릴 거리 안으로 들어옴 — 띠)
    this.attacks = 0; // 낸 헛스윙 공격 수 (재기만)
  }

  /** 드릴 거리 (m): 제 간격 M.reach + 이번 판 gap — 칼이 부러져 간격이 줄면 같이 준다 */
  dist(ai) {
    return ai.M.reach + this.gap;
  }

  /** 이번 스텝 헛스윙을 하나 (ai.js updateCombat 이 거리 d — 늦게 본 상대 가슴까지 — 를 잰 뒤 한 번 부른다). 하면 다음 공격 시계를 줄인다 */
  out(ai, d, dt) {
    const me = ai.me;
    const foe = ai.foe;
    const G = this.dist(ai);
    const D = WHIFF_DRILL;
    if (this.inside) this.inside = d < G + D.outside;
    else this.inside = (d < G - D.inside && ai.foeClosing > D.closing) || d < G - D.deep;
    const on = !this.inside && me.state === 'stand' && !me.feetHeld && me.armed && !me.revival && !ai.reviving && !ai.secretRun && !ai.Mup && foe.alive && foe.state === 'stand' && !ai.chasing;
    if (on) this.next -= dt;
    return on;
  }

  /** 지금 칠 때인가: 시계가 다 됐고 드릴 거리 − back ~ + near 안 */
  due(ai, d) {
    const G = this.dist(ai);
    return this.next <= 0 && d > G - WHIFF_DRILL.back && d < G + WHIFF_DRILL.near;
  }

  /** 쳤다: 다음 공격 시계를 새로 */
  fired() {
    this.attacks++;
    this.next = pick(WHIFF_DRILL.every);
  }

  /**
   * 헛스윙 동안 발 (스틱 앞 몫): 드릴 거리 + stop 보다 멀면 다가가고(남은 거리에 비례 0.15 ~ 0.6 — 다가가는 빠르기 × lead 만큼 먼저 섬),
   *  제 걸음이 지나쳐 드릴 거리 − back 보다 안쪽이면(상대가 다가오는 중이 아닐 때만) 뒤로 물러나고(0.2 ~ 0.6), 그 사이면 선다
   */
  feet(ai, d) {
    const G = this.dist(ai);
    const D = WHIFF_DRILL;
    const far = d - G - D.stop - Math.max(0, ai.myClosing) * D.lead;
    if (far > 0) return clamp(far * 1.2, 0.15, 0.6);
    const near = G - D.back - d - Math.max(0, -ai.myClosing) * D.lead;
    if (near > 0 && ai.foeClosing <= D.closing) return -clamp(near * 1.2, 0.2, 0.6);
    return 0;
  }

  /**
   * 헛스윙 공격 동안 발 (스틱 앞 몫): 그 자리에서 친다. 검술 층 자동 내딛기(skill.js — 칼을 빠르게 움직이기 시작하면 lungeTime 0.3 s 동안,
   *  스틱 앞 몫이 −0.2 보다 크면 앞으로 민다)가 걸릴 수 있는 동안(준비·베기 단계, 그리고 skill.lunge 가 남은 동안)만 −0.2 를 막 넘게 뒤로
   *  (감정 발 배수 emoMods.move 가 1 아래면 나눠서 — 곱한 뒤에도 −0.2 넘게), 그 밖(준비 자세에서 잠깐 멈춤·칼이 지나가는 동안)엔 선다.
   *  공격 내내 뒤로 −0.21(보통 공격의 값)이면 공격마다 0.10~0.19 m 뒤로 밀려 헛침 때 거리가 드릴 거리보다 멀었다(작업 시뮬)
   */
  atkFeet(ai) {
    const busy = ai.phase === 'windup' || ai.phase === 'strike' || ai.me.skill.lunge > 0;
    return busy ? -0.201 / Math.min(1, ai.me.emoMods?.move ?? 1) : 0;
  }
}
