// ─────────────────────────────────────────────────────────────
//  소리 들어보기 페이지 (sounds.html)
//  소리마다 약·중·강으로 틀어 보고, 예전 소리와 비교하고, 녹음 소리·울림을 켜고 끌 수 있다.
//  (분석용: window.lab.render(...) 가 소리를 OfflineAudioContext 로 그려서 숫자로 돌려준다)
// ─────────────────────────────────────────────────────────────
import { Sound } from './sound.js';
import { SOUND } from './config.js';

// 아이폰: 무음 스위치를 켜 둬도 소리가 나게 ("재생" 용도로 알린다, iOS 17+)
try {
  if (navigator.audioSession) navigator.audioSession.type = 'playback';
} catch {
  /* 지원하지 않는 브라우저 */
}

// ── 예전 소리 (비교용): 사인파 3개짜리 쇳소리, 짧은 잡음 베기 소리 (c092081 까지 쓰던 방식 그대로) ──
class OldSound {
  constructor() {
    this.ctx = null;
    this.on = true;
  }
  unlock(ctx) {
    if (!this.ctx) {
      this.ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      this.out = this.ctx.createGain();
      this.out.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.4;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended' && !this.ctx.startRendering) this.ctx.resume();
  }
  noiseBurst({ type = 'bandpass', freq = 1000, q = 1, vol = 0.3, attack = 0.002, decay = 0.15, delay = 0, freqEnd = null }) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + decay);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(f).connect(g).connect(this.out);
    src.start(t);
    src.stop(t + decay + 0.05);
  }
  tone(freq, freqEnd, vol, decay, type = 'sine', delay = 0) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + decay);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + decay + 0.05);
  }
  cut(energy, through) {
    const e = Math.min(1, energy / 140);
    this.noiseBurst({ type: 'bandpass', freq: 3200, freqEnd: 900, q: 1.2, vol: 0.25 + 0.4 * e, decay: through ? 0.22 : 0.12 });
    this.noiseBurst({ type: 'lowpass', freq: 500, vol: 0.2 + 0.5 * e, decay: 0.16 });
    this.tone(160, 60, 0.2 + 0.4 * e, 0.15);
  }
  stab(energy) {
    const e = Math.min(1, energy / 100);
    this.noiseBurst({ type: 'lowpass', freq: 700, vol: 0.3 + 0.4 * e, decay: 0.12 });
    this.tone(120, 50, 0.3 + 0.4 * e, 0.14);
    this.noiseBurst({ type: 'bandpass', freq: 1800, q: 3, vol: 0.12, decay: 0.08, delay: 0.02 });
  }
  blunt(energy) {
    const e = Math.min(1, energy / 120);
    this.tone(110, 45, 0.25 + 0.5 * e, 0.18);
    this.noiseBurst({ type: 'lowpass', freq: 400 + 600 * e, vol: 0.2 + 0.4 * e, decay: 0.14 });
  }
  bone(energy) {
    this.noiseBurst({ type: 'highpass', freq: 2500, vol: Math.min(0.5, energy / 200), decay: 0.04 });
    this.noiseBurst({ type: 'bandpass', freq: 1200, q: 4, vol: Math.min(0.3, energy / 300), decay: 0.06, delay: 0.01 });
  }
  clash(intensity) {
    const c = this.ctx;
    const t = c.currentTime;
    const vol = Math.min(0.5, 0.08 + intensity / 60);
    const base = 900 + Math.random() * 500;
    for (const [mul, dec] of [
      [1, 0.6],
      [2.76, 0.35],
      [5.4, 0.2],
    ]) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * mul;
      const g = c.createGain();
      g.gain.setValueAtTime(vol / mul ** 0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dec);
      o.connect(g).connect(this.out);
      o.start(t);
      o.stop(t + dec + 0.05);
    }
  }
  // 예전 게임: 투구 = clash(E/6) (+ 타박은 목록에서 따로 부른다), 칼끼리 스침/맞대기 = 0.09초마다 clash(속도)
  helmet(energy) {
    this.clash(Math.min(20, energy / 6));
  }
  whooshLoop() {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.6;
    f.frequency.value = 300;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.out);
    src.start();
    return {
      set(speed) {
        const x = Math.min(1, Math.max(0, (speed - 4) / 16));
        const t = c.currentTime;
        g.gain.setTargetAtTime(0.3 * Math.pow(x, 2.2), t, 0.03);
        f.frequency.setTargetAtTime(250 + 1150 * x, t, 0.03);
      },
    };
  }
}

// ── 소리 목록: [이름, 설명, [약, 중, 강] 값, 트는 함수(엔진, 값)] ──
// 값은 게임 속 실제 범위(AI 대결 통계)에서 골랐다: 칼 충돌 속도 중간값 2m/s·상위 10% 6m/s, 베기 에너지 30~200J
// 세기 눈금 A/B (29차, 디렉터 R3 대비): A = 지금 눈금(hitScale 'legacy'), B = 로그 무게('log'). 게임은 아직 A 다
const AB_LABELS = ['A 150', 'B 150', 'A 300', 'B 300', 'A 500', 'B 500'];
const AB_VALS = ['A150', 'B150', 'A300', 'B300', 'A500', 'B500'];
function withScale(s, v, fn) {
  const prev = s._hitScale;
  s.hitScale = v[0] === 'B' ? 'log' : 'legacy';
  try {
    fn(+v.slice(1));
  } finally {
    s._hitScale = prev;
  }
}
// 칼→몸 소리 비교: 누르는 동안만 fleshHit 을 바꾼다. 게임 기본은 승인된 35차 SOUND.fleshHit
function withFlesh(s, mode, fn) {
  const prev = s._fleshHit;
  s.fleshHit = mode;
  try {
    fn();
  } finally {
    s._fleshHit = prev;
  }
}
const FLESH_SCENE = (s) => [[40, 'cut'], [90, 'cut'], [140, 'cut'], [110, 'through'], [60, 'stab'], [110, 'stab'], [40, 'blunt']].forEach(([J, k], i) =>
  setTimeout(() => (k === 'stab' ? s.stab(J) : k === 'blunt' ? s.blunt(J) : s.cut(J, k === 'through')), i * 650));
const ROWS = [
  ['칼끼리 부딪힘', '맞닿는 속도 2 / 5 / 10 m/s', [2, 5, 10], (s, v) => s.clash(v, 0)],
  ['스치며 긁고 지나감', '빗맞은 칼: 부딪힘 1.5 / 3 / 6 + 미끄러짐 7 m/s', [1.5, 3, 6], (s, v) => s.clash(v, 7)],
  ['투구', '투구 + 타박 30 / 70 / 120 J (게임에서 함께 난다)', [30, 70, 120], (s, v) => (s.helmet(v), s.blunt(v))],
  ['베기', '35 / 70 / 140 J', [35, 70, 140], (s, v) => s.cut(v, false)],
  ['베고 지나감', '60 / 110 / 180 J', [60, 110, 180], (s, v) => s.cut(v, true)],
  ['찌르기', '20 / 50 / 100 J', [20, 50, 100], (s, v) => s.stab(v)],
  ['타박 (칼 면·손잡이)', '10 / 35 / 100 J', [10, 35, 100], (s, v) => s.blunt(v)],
  ['뼈 (머리·팔·다리 베기)', '베기 + 뼈 80 / 130 / 200 J', [80, 130, 200], (s, v) => (s.cut(v, false), s.bone(v))],
  ['칼→몸 소리 비교', '35차 강베기 적용 / 날 선 칼 녹음 / 날 선 칼 합성 / 이전 기본 — 각각 베기 40·90·140, 베고 지나감 110, 찌르기 60·110, 칼 면 40 J 을 차례로 (칼 면은 모두 같다)', ['samsho', 'rec', 'synth', 'legacy'], (s, v) => withFlesh(s, v, () => {}) || FLESH_SCENE({ cut: (J, t) => withFlesh(s, v, () => s.cut(J, t)), stab: (J) => withFlesh(s, v, () => s.stab(J)), blunt: (J) => withFlesh(s, v, () => s.blunt(J)) }), ['35차 강베기 (적용)', '녹음', '합성', '이전 기본']],
  ['세기 눈금 A/B: 베기', 'A 지금 / B 로그 무게 — 150 / 300 / 500 J (200 J 까지는 같다)', AB_VALS, (s, v) => withScale(s, v, (J) => s.cut(J, false)), AB_LABELS],
  ['세기 눈금 A/B: 찌르기', 'A 지금 / B 로그 무게 — 150 / 300 / 500 J', AB_VALS, (s, v) => withScale(s, v, (J) => s.stab(J)), AB_LABELS],
  ['세기 눈금 A/B: 강철 × 강철', 'A 지금 / B 로그 무게 — 150 / 300 / 500 J', AB_VALS, (s, v) => withScale(s, v, (J) => s.impact({ a: 'steel', b: 'steel', energy: J })), AB_LABELS],
];

// ── 재질 쌍 API(Sound.impact) 들어보기: 앞으로 다른 무기들이 쓸 sound.impact({a,b,energy}) ──
const MATERIAL_ROWS = [
  ['재질: 강철 × 강철', '에너지 20 / 50 / 90', [20, 50, 90], 'steel', 'steel'],
  ['재질: 강철 × 투구·판금', '에너지 30 / 70 / 120', [30, 70, 120], 'steel', 'armor'],
  ['재질: 강철 × 나무', '에너지 20 / 45 / 80', [20, 45, 80], 'steel', 'wood'],
  ['재질: 강철 × 살', '에너지 20 / 55 / 100', [20, 55, 100], 'steel', 'flesh'],
  ['재질: 플라즈마 × 강철', '에너지 20 / 45 / 70', [20, 45, 70], 'plasma', 'steel'],
  ['재질: 플라즈마 × 살', '에너지 25 / 60 / 100', [25, 60, 100], 'plasma', 'flesh'],
  ['재질: 고무 닭', '에너지 15 / 35 / 60 (무엇에 맞든 삑삑이가 튄다)', [15, 35, 60], 'rubber', 'steel'],
  ['재질: 언 참치 × 강철', '에너지 20 / 50 / 90', [20, 50, 90], 'frozen', 'steel'],
];
for (const [name, desc, vals, a, b] of MATERIAL_ROWS) {
  ROWS.push([name, desc, vals, (s, v) => (s.impact ? s.impact({ a, b, energy: v }) : s.clash(v / 10))]);
}

// ── 몸 소리: 발소리·쓰러짐·무기 부러짐 (게임에선 BodySounds 가 몸 상태를 보고 부른다) ──
ROWS.push(
  ['발소리 (모래)', '발이 내려오는 속도 0.6 / 1.0 / 1.8 m/s (걸음 · 보통 · 크게 내딛음)', [0.6, 1, 1.8], (s, v) => s.footstep?.(v)],
  ['쓰러짐', '몸통이 떨어지는 속도 1.2(무릎이 꺾임) / 2 / 3 m/s', [1.2, 2, 3], (s, v) => s.bodyFall?.(v, { light: v < 1.5 })],
  ['판금이 막음', '막은 타격 30 / 70 / 120 J (전투 판정이 판금을 알게 되면 부른다)', [30, 70, 120], (s, v) => (s.plateBlock ? s.plateBlock(v) : s.helmet(v))],
  ['판금이 부서짐', '부서지는 타격 60 / 100 / 150 J (깨짐 → 조각 둘~셋이 바닥에 철컥)', [60, 100, 150], (s, v) => (s.plateBreak ? s.plateBreak(v) : s.helmet(v))],
  ['참수 (32차)', '베고 지나감 150 J + 절단감(목소리 없음) → 떨어진 머리가 굴러 닿음. 맨머리 / 투구째', ['bare', 'helmet'], (s, v) => { s.cut(150, true); s.decapitate?.({}); [[0.55, 3.2], [0.85, 1.6], [1.05, 0.95]].forEach(([t, sp]) => setTimeout(() => s.headLand?.(sp, { helmet: v === 'helmet' }), t * 1000)); setTimeout(() => s.bodyFall(2.2), 900); }, ['맨머리', '투구째']],
  ['머리가 바닥에 닿음', '떨어지던 속도 1 / 2.5 / 4 m/s (맨머리)', [1, 2.5, 4], (s, v) => s.headLand?.(v, {})],
  ['리볼버 총성', '한 발 / 세 발 연사. 지금 배경의 울림을 따른다 (배경 소리 바꾸기로 포세이돈·성·성당 비교)', [1, 3], (s, v) => { for (let i = 0; i < v; i++) setTimeout(() => s.gunshot?.({}), i * 380); }, ['한 발', '세 발']],
  ['디딤 (지나는 걸음의 무거운 딛기)', 'footStrike 세기 0.3 / 0.7 / 1.0 (아직 게임에서 안 부른다 — 디렉터가 R2/R4 에서 잇는다)', [0.3, 0.7, 1], (s, v) => s.footStrike?.(v), ['0.3', '0.7', '1.0']],
  ['무기 부러짐', '강철 칼(쇠 팅) / 나뭇가지 / 언 참치 / 나무·참치 둘 다', ['steel', 'wood', 'frozen', 'both'], (s, v) => (v === 'both' ? (s.weaponBreak?.('wood'), s.weaponBreak?.('frozen')) : s.weaponBreak?.(v)), ['강철', '나무', '참치', '둘']],
);

// ── 무기 뽑기 카드 ──
ROWS.push([
  '카드 뒤집기',
  '고른 카드·상대 카드 "촥 → 둥" (커먼 / 에픽 / 레전드 — 엑스칼리버도 레전드대로) · 고르지 않은 내 카드 한 장 "촥"',
  [{ pick: true, tier: 'common' }, { pick: true, tier: 'epic' }, { pick: true, tier: 'legend' }, { pick: false }],
  (s, v) => s.cardFlip?.(v),
  ['커먼', '에픽', '레전드', '나머지'],
]);

// ── 배경(스테이지)별 소리 ── 줄을 누르면 그 배경으로 바뀐다 (발소리·쓰러짐·전투 소리의 울림이 따라 바뀐다)
const at = (id, fn) => (s, v) => (s.setStage?.(id), fn(s, v));
ROWS.push(
  ['산사: 마사토 발소리', '굵은 자갈 "자박" (모래보다 알갱이가 또렷). 살살 / 보통 / 비틀', [0.5, 1.2, 2.2], at('temple', (s, v) => s.footstep(v)), ['살살', '보통', '비틀']],
  ['산사: 쓰러짐', '마사토 위로 쓰러지며 자갈이 "자르륵"', [1.2, 2.4, 3.4], at('temple', (s, v) => s.bodyFall(v))],
  ['산사: 먼 산새', '작은 산새 "찌찌찟" / 휘파람새 "호오— 호케쿄" (평소 14~40초마다 저절로)', ['song', 'warbler'], (s, v) => s.bird?.(v), ['산새', '휘파람새']],
  ['산사: 풍경', '처마 끝 작은 종 "댕-그랑" (평소 9~26초마다 저절로)', [0.2, 0.5, 1], (s, v) => s.windChime?.(v)],
  ['산사: 큰 타격', '단풍잎 바스락 + 솔바람, 세면 풍경', [0.3, 0.6, 1], at('temple', (s, v) => ((s._gustT = 0), s.gust?.(v)))],
  ['성 안뜰: 눈 발소리', '다져진 눈 "뽀득". 살살 / 보통 / 비틀', [0.5, 1.2, 2.2], at('castle', (s, v) => s.footstep(v)), ['살살', '보통', '비틀']],
  ['성 안뜰: 쓰러짐', '눈밭에 쓰러지며 눈이 "푸석"', [1.2, 2.4, 3.4], at('castle', (s, v) => s.bodyFall(v))],
  ['성 안뜰: 칼 부딪힘', '성벽에 짧게 튕기는 메아리', [4, 8, 12], at('castle', (s, v) => s.clash(v, 1))],
  ['성 안뜰: 마구간 말', '콧바람 "푸르르" / 발굽 "쿵 쿵" + 굴레 "찰랑" (평소 50~110초마다 저절로)', ['snort', 'stamp'], at('castle', (s, v) => s.stageCall?.(v)), ['콧바람', '발굽']],
  ['성 안뜰: 종탑 종', '흔들린 종을 추가 치는 "댕—" 약 / 중 / 강 (게임에서는 큰 타격 뒤 1.5초마다 점점 약하게)', [0.15, 0.33, 0.55], at('castle', (s, v) => s.stageEvent?.('bell', { amp: v, max: 0.55 }))],
  ['성 안뜰: 큰 타격', '눈보라 바람 + 화로 불길 "화르륵"', [0.3, 0.6, 1], at('castle', (s, v) => ((s._gustT = 0), s.gust?.(v)))],
  ['대성당: 돌바닥 발소리', '판석 위 "턱" + 돌 울림. 살살 / 보통 / 비틀', [0.5, 1.2, 2.2], at('cathedral', (s, v) => s.footstep(v)), ['살살', '보통', '비틀']],
  ['대성당: 쓰러짐', '판석에 쓰러지는 "쿵"이 길게 울린다', [1.2, 2.4, 3.4], at('cathedral', (s, v) => s.bodyFall(v))],
  ['대성당: 칼 부딪힘', '돌벽에 길게 되울린다 (2.5초)', [4, 8, 12], at('cathedral', (s, v) => s.clash(v, 1))],
  ['대성당: 가끔 나는 소리', '비둘기 "구구—" / 날아오름 / 돌 부스러기 (평소 18~80초마다 저절로)', ['dove', 'wings', 'debris'], at('cathedral', (s, v) => s.stageCall?.(v)), ['비둘기', '날갯짓', '부스러기']],
  ['대성당: 판 시작 오르간', '라단조 화음 하나 2.6초 (판이 시작될 때만)', [1], at('cathedral', (s) => s.roundStart?.()), ['울리기']],
  ['대성당: 큰 타격', '천장에서 돌 부스러기, 세면 비둘기가 날아오름', [0.3, 0.6, 1], at('cathedral', (s, v) => ((s._gustT = 0), s.gust?.(v)))],
  ['밤의 포세이돈: 천 펄럭임', '찢어진 검은 천이 바람에 "퍼덕퍼덕" (평소 15~40초마다 저절로)', [0.2, 0.7], (s, v) => s.stageCall?.('flap', v), ['살짝', '세게']],
  ['밤의 포세이돈: 큰 타격', '바람이 잠깐 세지고 화로 불길이 "화르륵", 천이 펄럭 (낮 신전은 큰 타격 소리가 없다)', [0.3, 0.6, 1], at('poseidon_night', (s, v) => ((s._gustT = 0), s.gust?.(v)))],
  ['화전 터: 젖은 흙 발소리', '탄 재와 젖은 흙 "저벅". 살살 / 보통 / 비틀', [0.5, 1.2, 2.2], at('clearing', (s, v) => s.footstep(v)), ['살살', '보통', '비틀']],
  ['화전 터: 쓰러짐', '젖은 흙에 쓰러지는 "쿵"', [1.2, 2.4, 3.4], at('clearing', (s, v) => s.bodyFall(v))],
  ['화전 터: 먼 까마귀', '숲 쪽에서 "까악" (평소 20~55초마다 저절로, 가끔 두 번)', [1], (s) => s.crow?.(), ['까마귀']],
  ['화전 터: 큰 타격', '바람만 잠깐 (크게 튀는 소리는 없다)', [0.3, 0.6, 1], at('clearing', (s, v) => ((s._gustT = 0), s.gust?.(v)))],
  ['화전 터: 까마귀들이 날아오름', '참나무의 까마귀들이 놀라 "푸드득 까악" (배경이 onEvent(\'crows\') 로 알릴 때)', [0.3, 0.8], at('clearing', (s, v) => ((s._crowsT = 0), s.stageEvent?.('crows', { amp: v }))), ['조금', '많이']],
  ['어두운 홀: 칼 부딪힘', '돌 홀의 울림 (성당보다 짧고 어둡다)', [4, 8, 12], at('darkhall', (s, v) => s.clash(v, 1))],
  ['어두운 홀: 큰 타격', '박쥐가 놀라 "푸드득", 세면 벽난로 불길', [0.3, 0.6, 1], at('darkhall', (s, v) => ((s._gustT = 0), s.gust?.(v)))],
  ['배경 소리 바꾸기', '포세이돈 / 밤의 포세이돈 / 화전 터(비) / 화전 터 1안(비 없음) / 산사 / 성 안뜰 / 대성당 / 어두운 홀. 켜 두면 계속 깔린다', ['poseidon', 'poseidon_night', 'clearing', 'clearing_a_dry', 'temple', 'castle', 'cathedral', 'darkhall'], (s, v) => (s.setStage?.(v), s.ambience?.()), ['포세이돈', '밤 포세이돈', '화전 터', '화전 1안(마름)', '산사', '성', '성당', '홀']],
);

// ── 캐릭터별 죽음: 머리를 맞아 기절 / 피가 빠짐 / 목을 베임. 0.7초 뒤 몸이 쓰러지는 소리가 따라온다 ──
const DEATH_ROWS = [
  ['player', '나 (주인공)', '목소리 대신 이명(삐—)과 먹먹해짐. 4초 뒤 돌아온다'],
  ['bran', '오소리 브란', '굵고 거친 목, 흐느끼며'],
  ['isolde', '이졸데', '짧게 맞는 소리 "흣"·"읏" (녹음)'],
  ['liao', '랴오 쓰위엔', '거의 소리 없이 한숨'],
  ['heinrich', '하인리히', '쉰 웃음이 신음으로 끊김'],
  ['margarethe', '마르그레테', '지친 날숨 섞인 낮은 "하아…" (녹음)'],
];
for (const [id, name, desc] of DEATH_ROWS) {
  ROWS.push([
    `죽음: ${name}`,
    desc + ' · "녹음 소리 섞기"를 끄면 합성 목소리',
    ['기절', '출혈', '목'],
    (s, cause) => {
      if (!s.death) return s.blunt(90);
      s.death(id, cause, { me: id === 'player' });
      setTimeout(() => s.bodyFall(2.4), 700);
      if (id === 'player') setTimeout(() => s.resetRound(), 4000);
    },
    ['기절', '출혈', '목'],
  ]);
}

// ── 깊은 상처의 짧은 신음 ──
ROWS.push([
  '상처 신음',
  '깊은 상처에만, 한 사람당 2초에 한 번까지 짧게 "윽". 목소리는 캐릭터마다 죽음 목소리와 같은 배우',
  DEATH_ROWS.map(([id]) => id),
  (s, id) => {
    s.cut?.(80, false);
    s.hurt?.(id, 0.9, { me: id === 'player' });
  },
  ['나', '브란', '이졸데', '랴오', '하인리히', '슈바르츠'],
]);

// ── 다시 일어남 (이졸데) ──
ROWS.push([
  '부활: 이졸데',
  '하늘에서 성스러운 빛 — 짧은 그레고리안 성가 한 구절 (녹음, 약 4초), 숨 들이켬 곁들임 / 없이. 부르는 자리는 main.js',
  [true, false],
  (s, b) => s.revive?.('isolde', { breath: b }),
  ['숨 곁들임', '숨 없이'],
]);

// ── 피를 흘리는 내 숨 ──
ROWS.push([
  '내 숨 (피를 흘릴 때)',
  '피 80% 아래에서 아직 흐르거나 60% 아래일 때, 5초(위험도 0) → 2초(위험도 1)마다 한 번. 목소리보다 약 10dB 작다',
  [0, 0.5, 1],
  (s, d) => s.breath?.(d),
  ['위험도 0', '위험도 0.5', '위험도 1'],
]);

// ── 칼이 바닥에 떨어짐 ──
ROWS.push([
  '칼이 바닥에 떨어짐',
  '놓친 칼, 또는 쥔 채 쓰러진 칼이 땅에 닿는 순간 (지금 배경의 바닥 알갱이가 섞인다)',
  ['steel', 'wood', 'rubber'],
  (s, m) => s.swordLand?.(3, m),
  ['강철', '나무', '고무 닭'],
]);

const $ = (id) => document.getElementById(id);
const engines = { new: null, old: null };
let which = 'new';
function engine() {
  if (!engines[which]) {
    engines[which] = which === 'new' ? new Sound() : new OldSound();
    engines[which].unlock(); // 새 소리: 소리 조각은 일꾼 스레드가 뒤에서 만든다
    engines[which].prepareVoices?.(DEATH_ROWS.map((d) => d[0])); // 모든 캐릭터의 죽음 목소리(녹음·합성)
  }
  engines[which].unlock(); // 폰이 잠깐 소리를 멈췄으면 다시 켠다
  return engines[which];
}

// ── 화면 만들기 ──
function buildUI() {
  const list = $('rows');
  for (const [name, desc, vals, fn, labels = ['약', '중', '강']] of ROWS) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<div><b>${name}</b><small>${desc}</small></div>`;
    const btns = document.createElement('div');
    btns.className = 'btns';
    labels.forEach((label, i) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('click', () => {
        fn(engine(), vals[i]);
        showInfo();
      });
      btns.appendChild(b);
    });
    row.appendChild(btns);
    list.appendChild(row);
  }
  // 누르고 있는 동안: 칼 맞대고 긁기(바인드), 휘두르기(강철 / 플라즈마)
  const holds = [
    ['칼 맞대고 밀며 긁기 (누르고 있기)', '미끄러짐 1 / 2.5 / 4.5 m/s', [1, 2.5, 4.5], 'bind'],
    ['휘두르는 바람 소리 (누르고 있기)', '칼끝 10 / 15 / 20 m/s', [10, 15, 20], 'whoosh'],
    ['플라즈마 날 훔+바람 (누르고 있기)', '칼끝 10 / 15 / 20 m/s', [10, 15, 20], 'whoosh', 'plasma'],
  ];
  for (const [name, desc, vals, kind, material] of holds) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<div><b>${name}</b><small>${desc}</small></div>`;
    const btns = document.createElement('div');
    btns.className = 'btns';
    ['약', '중', '강'].forEach((label, i) => {
      const b = document.createElement('button');
      b.textContent = label;
      const down = (e) => {
        e.preventDefault();
        startHold(kind, vals[i], material);
      };
      b.addEventListener('pointerdown', down);
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stopHold);
      btns.appendChild(b);
    });
    row.appendChild(btns);
    list.appendChild(row);
  }
  $('demo').addEventListener('click', demo);
  document.querySelectorAll('[data-engine]').forEach((b) =>
    b.addEventListener('click', () => {
      stopHold();
      which = b.dataset.engine;
      document.querySelectorAll('[data-engine]').forEach((x) => x.classList.toggle('on', x === b));
      engine();
    }),
  );
  $('samples').addEventListener('click', (e) => {
    const s = engine();
    if (!(s instanceof Sound)) return;
    s.useSamples = !s.useSamples;
    if (s.useSamples && !Object.keys(s.samples).length) s.loadSamples();
    e.target.classList.toggle('on', s.useSamples);
  });
  $('reverb').addEventListener('click', (e) => {
    const s = engine();
    if (!(s instanceof Sound)) return;
    const on = !e.target.classList.contains('on');
    s.setReverb(on ? SOUND.reverb : 0);
    e.target.classList.toggle('on', on);
  });
}

// ── 누르고 있는 동안 도는 소리 ──
let hold = null;
function startHold(kind, v, material = 'steel') {
  stopHold();
  const s = engine();
  const t0 = performance.now();
  if (kind === 'whoosh') {
    const key = which + 'Whoosh' + material;
    const loop = (engines[key] = engines[key] || s.whooshLoop(material));
    // 한 번 휘두르기 = 0.45초 동안 빨라졌다 느려짐, 누르고 있으면 되풀이
    const id = setInterval(() => {
      const u = ((performance.now() - t0) / 450) % 1;
      loop.set(v * Math.sin(Math.PI * u) ** 1.5);
    }, 16);
    hold = { id, stop: () => loop.set(0) };
  } else {
    let lastTick = 0;
    const id = setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      // 미끄러지는 속도가 조금씩 흔들린다 (사람이 밀고 당기니까)
      const slide = v * (0.75 + 0.25 * Math.sin(t * 7.3) + 0.1 * Math.sin(t * 19));
      const press = 40 + 60 * v;
      if (s instanceof Sound) s.scrape(slide, press);
      else if (slide >= 2.5 && t - lastTick > 0.09) {
        // 예전 게임은 칼을 맞댄 동안 0.09초마다 "딩"을 다시 냈다
        s.clash(slide);
        lastTick = t;
      }
    }, 16);
    hold = { id, stop: () => s instanceof Sound && s.scrape(0, 0) };
  }
}
function stopHold() {
  if (!hold) return;
  clearInterval(hold.id);
  hold.stop();
  hold = null;
}

// ── 짧은 공방 한 장면: 휘두름 → 부딪힘 → 맞대고 긁기 → 스침 → 베기 + 뼈 ──
async function demo() {
  const s = engine();
  const w = (engines[which + 'Whoosh'] = engines[which + 'Whoosh'] || s.whooshLoop());
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const swing = async (peak, ms) => {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      w.set(peak * Math.sin((Math.PI * (performance.now() - t0)) / ms) ** 1.5);
      await wait(16);
    }
    w.set(0);
  };
  await swing(17, 380);
  s.clash(8, 1);
  await wait(120);
  for (let t = 0; t < 600; t += 16) {
    if (s instanceof Sound) s.scrape(1.5 + 2 * Math.sin(t / 90) ** 2, 120);
    else if (t % 96 === 0) s.clash(2.6);
    await wait(16);
  }
  if (s instanceof Sound) s.scrape(0, 0);
  await wait(200);
  await swing(14, 300);
  s.clash(2.5, 7);
  await wait(500);
  await swing(19, 350);
  s.cut(150, false);
  s.bone(150);
  await wait(700);
  await swing(15, 300);
  s.helmet(90);
  s.blunt(90);
  await wait(500);
  s.stab(60);
  showInfo();
}

function showInfo() {
  const s = engines.new;
  if (!s || which !== 'new') {
    $('info').textContent = which === 'old' ? '예전 소리: 사인파·잡음을 그때그때 만든다' : '';
    return;
  }
  const smp = Object.values(s.samples).reduce((n, l) => n + l.length, 0);
  $('info').textContent = `소리 조각 ${Object.values(s.bank).reduce((n, l) => n + l.length, 0)}개 (만드는 데 ${s.stats.genMs.toFixed(0)}ms) · 녹음 ${smp}개 · 지금까지 ${s.stats.events}번, 노드 ${s.stats.nodes}개 · 동시에 울리는 소리 ${s.voices.length}/${SOUND.maxVoices}`;
}

// ─────────────────────────────────────────────────────────────
//  분석용: 소리를 OfflineAudioContext 로 그려서 돌려준다 (헤드리스 브라우저 시험에서 쓴다)
//  events: [{ t: 초, call: '이름', args: [...] }]
// ─────────────────────────────────────────────────────────────
window.lab = {
  async render({ engine: kind = 'new', events, dur = 2, sr = 48000, samples = true, reverb = SOUND.reverb, returnAudio = true, seed = 1234 }) {
    const off = new OfflineAudioContext(2, Math.round(dur * sr), sr);
    // 만든 노드 수 세기
    const count = {};
    for (const k of Object.getOwnPropertyNames(BaseAudioContext.prototype)) {
      if (!k.startsWith('create') || k === 'createBuffer' || k === 'createPeriodicWave' || typeof off[k] !== 'function') continue;
      const orig = off[k].bind(off);
      off[k] = (...a) => {
        count[k] = (count[k] || 0) + 1;
        return orig(...a);
      };
    }
    let s;
    const tg = performance.now();
    if (kind === 'new') {
      s = new Sound();
      s.seed = seed;
      s.useSamples = samples;
      const r0 = SOUND.reverb;
      SOUND.reverb = reverb;
      s.unlock(off);
      SOUND.reverb = r0;
      s.prepareAll();
      if (samples) await s.samplesReady;
    } else {
      s = new OldSound();
      s.unlock(off);
    }
    const genMs = performance.now() - tg;
    const setupNodes = Object.values(count).reduce((a, b) => a + b, 0);
    const loops = {};
    const call = (e) => {
      if (e.call === 'whoosh') (loops[e.args[1] || 0] = loops[e.args[1] || 0] || s.whooshLoop()).set(e.args[0]);
      else if (e.call === 'scrape') s.scrape?.(...e.args);
      else s[e.call](...e.args);
    };
    // 같은 순간(128샘플 단위)의 소리는 한 번에 부른다 (멈춤 지점은 한 순간에 하나만 걸 수 있다)
    const groups = new Map();
    for (const e of events) {
      const q = Math.round((e.t * sr) / 128);
      if (!groups.has(q)) groups.set(q, []);
      groups.get(q).push(e);
    }
    for (const [q, list] of groups) {
      if (q <= 0) list.forEach(call);
      else off.suspend((q * 128) / sr).then(() => {
        try {
          list.forEach(call);
        } catch (err) {
          console.error(err); // 오류가 나도 그리기는 계속 (멈추면 결과가 안 나온다)
        }
        off.resume();
      });
    }
    const t0 = performance.now();
    const buf = await off.startRendering();
    const renderMs = performance.now() - t0;
    const L = buf.getChannelData(0);
    const R = buf.getChannelData(1);
    let peak = 0;
    for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    const nodes = Object.values(count).reduce((a, b) => a + b, 0);
    return {
      genMs,
      renderMs,
      peak,
      nodes: nodes - setupNodes,
      setupNodes,
      count,
      stolen: s.stats?.stolen || 0,
      audio: returnAudio === 'b64' ? b64(L) : returnAudio ? Array.from(L) : null,
    };
  },
};

function b64(f32) {
  const u8 = new Uint8Array(f32.buffer.slice(0));
  let str = '';
  for (let i = 0; i < u8.length; i += 0x8000) str += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(str);
}

buildUI();
