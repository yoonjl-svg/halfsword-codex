// ─────────────────────────────────────────────────────────────
//  감정: 판정(사건 → 세기 → 지배 감정 → 텀)과 고유 능력(트레이드오프)
//
//  두 곳에서 쓴다 — 판정은 아래 Emotions 한 곳이다.
//   - AI(ai.js): emote()가 사건을 모아 Emotions.update 를 부르고, AI 에만 있는 것(지배 감정이 없을 때 공포 통과,
//     발끈할 때 참을성, 관찰 통계)만 덧붙인다.
//   - 플레이어(main.js): 같은 규칙으로 판정한다 — 플레이어도 겁먹고 화내고 물고 늘어진다.
//
//  고유 능력(EMO_ABILITY)은 "배율표" 하나다. 상처 판정(combat.js)과 이동(ai.js·main.js)이 fighter.emoMods를 읽기만
//  한다. 감정이 없으면 전부 1(NO_MODS)이라 예전과 똑같고, enabled=false 로 두면 감정이 켜져도 능력이 사라진다 —
//  되돌리거나 값을 바꾸려면 이 표만 만지면 된다. fighter.js 는 건드리지 않는다.
// ─────────────────────────────────────────────────────────────

/** 풀리거나 자리를 뺏긴 감정이 다시 지배할 수 있기까지(초) / 어떤 감정이든 직전 감정이 풀린 뒤 다시 켜질 수 있기까지(초) */
export const EMO_REST = 9;
export const EMO_REST_ALL = 6;

/** 켜짐 문턱(세기) · 풀림 문턱 · 자리 뺏기 여유 */
export const EMO_ON = 0.3;
export const EMO_OFF = 0.15;
export const EMO_MARGIN = 0.15;

/**
 * 감정별 고유 능력 — 세기 I(0~1)에 비례해 걸린다. 이점과 대가는 다른 축에 둔다.
 *  dealt: 내가 주는 상처 배율(베기·찌르기 유효 에너지, 둔타 에너지)    +면 세진다
 *  taken: 내가 받는 상처 배율                                          +면 더 깊이 베인다
 *  pass:  파고들기(관통) 문턱 1.25에서 빼는 값 — 주는 쪽·받는 쪽 둘 다 더한다 (크리티컬)
 *  move:  이동 속도 배율                                                −면 발이 묶인다
 *  tremor: 손 떨림 크기(m) — 플레이어 조준·AI 칼끝이 잔잔히 흔들린다
 */
export const EMO_ABILITY = {
  enabled: true,
  // 집념: 더 깊이 베고 더 자주 가른다(크리티컬) — 대신 발이 묶인다
  obsession: { dealt: 0.3, pass: 0.15, move: -0.25 },
  // 분노: 힘이 오른다 — 대신 받는 상처도 깊어진다(크리티컬 피격)
  anger: { dealt: 0.2, taken: 0.2, pass: 0 }, // 감독 지시: 받는 상처 0.3 → 0.2 (단독 검증에서 조금 불리했다)
  // 공포: 발이 빨라진다 — 대신 힘이 빠지고 손이 떨린다
  fear: { move: 0.2, dealt: -0.25, tremor: 0.03 },
};

export const NO_MODS = Object.freeze({ dealt: 1, taken: 1, pass: 0, move: 1, tremor: 0 });

/** 지배 감정과 세기 → fighter.emoMods 에 넣을 배율표 (감정 없음·능력 꺼짐이면 NO_MODS) */
export function emoMods(emotion, I) {
  if (!EMO_ABILITY.enabled || !emotion || !(I > 0)) return NO_MODS;
  const a = EMO_ABILITY[emotion];
  if (!a) return NO_MODS;
  return {
    dealt: 1 + (a.dealt || 0) * I,
    taken: 1 + (a.taken || 0) * I,
    pass: (a.pass || 0) * I,
    move: 1 + (a.move || 0) * I,
    tremor: (a.tremor || 0) * I,
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ORDER = ['fear', 'anger', 'obsession']; // 생존 우선

/**
 * 감정 판정 (AI·플레이어 공통): 사건 → 세기 → 감쇠 → 지배 감정 → 텀.
 * thresholds = { fearful, angry, dogged } (0이면 그 감정은 꺼진 것과 같다)
 * ev(사건) = { hurt, bleeding, nearMiss, weaponBroken, disarmed, foeLegendNear, foeBroke, parried, winning, foeBleeding, landed }
 * update 는 판정했으면 true, 문턱값이 전부 0이면 시계만 가고 false (AI 는 그때 제 몫도 건너뛴다)
 */
export class Emotions {
  constructor(thresholds = {}) {
    this.th = { fearful: 0, angry: 0, dogged: 0, ...thresholds };
    this.E = { fear: 0, anger: 0, obsession: 0 };
    this.emotion = null; // 지배 감정
    this.t = 0;
    this.rest = { fear: -1, anger: -1, obsession: -1 };
    this.restAll = -1;
    this.parryTimes = [];
    this.sawBroken = this.sawDisarmed = this.sawFoeBroken = false;
    this.count = { fear: 0, anger: 0, obsession: 0 }; // 켜진 횟수 (관찰용)
  }

  /** 지배 감정의 세기 (없으면 0) */
  get intensity() {
    return this.emotion ? this.E[this.emotion] : 0;
  }

  /** 배율표 (fighter.emoMods 에 넣는다) */
  get mods() {
    return emoMods(this.emotion, this.intensity);
  }

  update(dt, ev) {
    const P = this.th;
    const E = this.E;
    this.t += dt;
    if (P.fearful <= 0 && P.angry <= 0 && P.dogged <= 0) return false; // 감정층 꺼짐 (시계만 간다)
    const decay = (v, tau) => v - (v * dt) / tau;
    // 공포: 베였다(+0.4), 피가 난다(+0.12/s), 상대 칼이 코앞(+0.3/s), 내 무기가 부러졌다(+0.5)·놓쳤다(+0.4, 각 한 번),
    //  상대 레전드 무기 근접(+0.08/s), 상대 무기 부러짐(−0.2, 한 번). 9초 감쇠
    let up = 0;
    if (ev.hurt) up += 0.4;
    if (ev.bleeding) up += dt * 0.12;
    if (ev.nearMiss) up += dt * 0.3;
    if (ev.weaponBroken && !this.sawBroken) { this.sawBroken = true; up += 0.5; }
    if (ev.disarmed) { if (!this.sawDisarmed) { this.sawDisarmed = true; up += 0.4; } } else this.sawDisarmed = false;
    if (ev.foeLegendNear) up += dt * 0.08;
    const foeBrokeNow = ev.foeBroke && !this.sawFoeBroken;
    if (foeBrokeNow) this.sawFoeBroken = true;
    E.fear = clamp(decay(E.fear, 9) + (up - (foeBrokeNow ? 0.2 : 0)) * P.fearful, 0, 1);
    // 분노: 10초 안에 두 번 이상 막혔다(+0.35), 이기고 있는데 맞았다(+0.3). 12초 감쇠
    up = 0;
    if (ev.parried) {
      this.parryTimes.push(this.t);
      this.parryTimes = this.parryTimes.filter((x) => this.t - x < 10);
      if (this.parryTimes.length >= 2) up += 0.35;
    }
    if (ev.hurt && ev.winning) up += 0.3;
    E.anger = clamp(decay(E.anger, 12) + up * P.angry, 0, 1);
    // 집념: 상대가 피 흘린다(+0.2/s), 방금 맞혔다(+0.3), 상대 무기 부러짐(+0.3). 8초 감쇠
    up = 0;
    if (ev.foeBleeding) up += dt * 0.2;
    if (ev.landed) up += 0.3;
    if (foeBrokeNow) up += 0.3;
    E.obsession = clamp(decay(E.obsession, 8) + up * P.dogged, 0, 1);

    // 지배 감정 + 텀
    const t = this.t;
    const cur = this.emotion;
    const release = (k) => {
      this.rest[k] = t + EMO_REST;
      this.restAll = t + EMO_REST_ALL;
    };
    if (cur && E[cur] < EMO_OFF) {
      this.emotion = null;
      release(cur);
    }
    const cand = t >= this.restAll ? ORDER.find((k) => E[k] > EMO_ON && k !== this.emotion && t >= this.rest[k]) : null;
    if (cand) {
      const c = this.emotion;
      const higher = c && ORDER.indexOf(cand) < ORDER.indexOf(c);
      if (!c || (higher ? E[cand] > E[c] - EMO_MARGIN : E[cand] > E[c] + EMO_MARGIN)) {
        if (c) release(c);
        this.emotion = cand;
        this.count[cand]++;
      }
    }
    return true;
  }
}
