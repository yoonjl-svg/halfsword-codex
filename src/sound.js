// ─────────────────────────────────────────────────────────────
//  효과음: 무거운 강철 롱소드의 소리를 코드로 "물리처럼" 만든다 (모드 합성)
//
//  쇠붙이를 치면 그 물체가 가진 "고유 진동(모드)"들이 한꺼번에 울린다.
//   - 롱소드 칼날은 길고 얇은 쇠막대(1m, 두께 6mm → 끝 2mm)라서 굽힘 진동이 200Hz~9kHz에
//     수십 개가 촘촘히 있다. 배음이 정수배가 아니라서(비조화음) 실로폰 같은 "딩"이 아니라 "쟁그렁"이 된다.
//   - 날끼리 부딪히면 칼날 폭 방향 굽힘(훨씬 단단 → 7배쯤 높은 음), 비틀림 진동도 함께 울린다.
//   - 칼자루를 쥔 두 손이 낮은 진동을 금방 죽이고, 1~5kHz 울림만 길게 남는다.
//   - 세게 칠수록 두 칼이 맞닿는 시간이 짧아져서(헤르츠 접촉) 높은 모드까지 울린다 → 밝고 크다.
//   - 부딪힐 때의 "딱"(넓은 대역 잡음), 두 손이 받는 "쿵"(낮은 몸통 소리), 날이 서로 긁히는 "지익"을 더하고,
//     살짝 찌그러뜨려(포화) 거친 맛을 낸다. 두 칼의 모드가 조금씩 어긋나 "우웅" 하고 맥놀이가 생긴다.
//
//  이런 소리 조각(버퍼)을 게임을 시작할 때 여러 벌 미리 만들어 두고, 칠 때마다 골라서
//  높낮이·밝기·세기를 조금씩 바꿔 튼다 → 매번 조금씩 다른 소리, 폰에서도 가볍다 (소리 하나에 노드 몇 개).
//  몸통 타격·뼈·칼이 스치는 소리엔 녹음된 무료(CC0) 소리를 조금 섞는다 (public/sfx, Kenney.nl).
//
//  들어보기: 메뉴의 "소리 들어보기" (sounds.html)
// ─────────────────────────────────────────────────────────────
import { SOUND, VITALS } from './config.js';
import { drawnSlash, DRAWN_SLASH } from './slash_draw.js';

// 무기 재질 쌍 API(Sound.impact)가 알아듣는 재질 이름들. 다른 무기를 추가하는 쪽에서 이 목록을 참고한다
export const MATERIALS = ['steel', 'armor', 'flesh', 'wood', 'plasma', 'rubber', 'frozen'];

// ── 난수: 같은 씨앗이면 같은 소리 (시험할 때 똑같이 다시 만들 수 있게) ──
export function makeRng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r, a, b) => a + (b - a) * r();
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const TAU = Math.PI * 2;

// ─────────────────────────────────────────────────────────────
//  소리 만들기 도구 (모두 Float32Array 에 직접 계산)
// ─────────────────────────────────────────────────────────────

/**
 * 공명 모드 묶음. 두드림(x)을 받아 모드마다 "감쇠하며 울리는 사인파"로 반응한다.
 * 모드 하나 = 2차 공명 필터: y[n] = g·x[n] + 2r·cos(w)·y[n-1] − r²·y[n-2]
 * @param modes [{ f: 주파수(Hz), a: 세기, t60: 60dB 줄어드는 시간(초) }]
 * @param xEnd  x 에서 두드림이 있는 구간의 끝 (그 뒤는 울림만 계산)
 */
function resonate(x, out, sr, modes, xEnd = x.length) {
  const n = out.length;
  for (const m of modes) {
    if (m.f <= 20 || m.f >= sr * 0.45 || !m.a) continue;
    const w = (TAU * m.f) / sr;
    const r = Math.exp(-6.91 / (m.t60 * sr));
    const c1 = 2 * r * Math.cos(w);
    const c2 = -r * r;
    const g = m.a * Math.sin(w); // 두드림 1 → 진폭 1인 사인파
    const e1 = Math.min(n, xEnd);
    const end = Math.min(n, xEnd + Math.ceil(m.t60 * 1.4 * sr)); // −84dB 아래는 안 들리니 계산 생략
    let y1 = 0;
    let y2 = 0;
    let i = 0;
    for (; i < e1; i++) {
      const y = g * x[i] + c1 * y1 + c2 * y2;
      out[i] += y;
      y2 = y1;
      y1 = y;
    }
    for (; i < end; i++) {
      const y = c1 * y1 + c2 * y2;
      out[i] += y;
      y2 = y1;
      y1 = y;
    }
  }
}

/** 두 물체가 맞닿아 미는 힘 = 반쪽 사인 모양 펄스. 면적(충격량)이 amp 가 되게 한다 */
function pulse(x, sr, t0, dur, amp) {
  const n0 = Math.round(t0 * sr);
  const len = Math.max(2, Math.round(dur * sr));
  const peak = (amp * Math.PI) / 2 / len;
  for (let i = 0; i < len && n0 + i < x.length; i++) x[n0 + i] += peak * Math.sin((Math.PI * (i + 0.5)) / len);
}

/** 2차 필터 (RBJ 요리책 공식). type: lowpass | highpass | bandpass */
class Filt {
  constructor(type, f, q, sr) {
    this.type = type;
    this.sr = sr;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(f, q);
  }
  set(f, q) {
    const w = (TAU * Math.min(f, this.sr * 0.45)) / this.sr;
    const al = Math.sin(w) / (2 * q);
    const c = Math.cos(w);
    const a0 = 1 + al;
    let b0, b1, b2;
    if (this.type === 'lowpass') [b0, b1, b2] = [(1 - c) / 2, 1 - c, (1 - c) / 2];
    else if (this.type === 'highpass') [b0, b1, b2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
    else [b0, b1, b2] = [al, 0, -al];
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * c) / a0;
    this.a2 = (1 - al) / a0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** 잡음 한 번: 흰 잡음 → 필터 → 지수 감쇠 (attack, tau = 초) */
function noiseHit(out, sr, r, { t0 = 0, amp = 1, attack = 0.0003, tau = 0.004, type = 'highpass', f = 1000, q = 0.7, len = 8 }) {
  const fl = new Filt(type, f, q, sr);
  const n0 = Math.round(t0 * sr);
  const n = Math.min(out.length - n0, Math.round(tau * len * sr));
  const na = Math.max(1, attack * sr);
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / na) * Math.exp(-i / (tau * sr)) * Math.min(1, (n - i) / (0.2 * n));
    out[n0 + i] += amp * env * fl.run(r() * 2 - 1);
  }
}

/** 몸통 "쿵": 음높이가 뚝 떨어지는 낮은 사인파 (f0 → f0/(1+drop)) */
function thumpTone(out, sr, { t0 = 0, f0 = 80, drop = 0.8, dropTau = 0.015, attack = 0.0015, tau = 0.04, amp = 1 }) {
  const n0 = Math.round(t0 * sr);
  const n = Math.min(out.length - n0, Math.round(tau * 10 * sr));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ph += (TAU * f0 * (1 + drop * Math.exp(-t / dropTau))) / sr;
    const fade = Math.min(1, (n - i) / (0.2 * n)); // 끝을 부드럽게 (뚝 끊기면 "틱" 소리가 난다)
    out[n0 + i] += amp * Math.min(1, t / attack) * Math.exp(-t / tau) * fade * Math.sin(ph);
  }
}

function peakOf(a) {
  let p = 0;
  for (let i = 0; i < a.length; i++) p = Math.max(p, Math.abs(a[i]));
  return p;
}
function normalize(a, peak = 0.9) {
  const p = peakOf(a);
  if (p > 0) for (let i = 0; i < a.length; i++) a[i] *= peak / p;
  return a;
}
/** 포화(찌그러뜨림): 큰 소리 부분만 둥글게 눌러서 배음·혼변조를 만든다 → 거칠고 꽉 찬 소리 */
function saturate(a, drive, asym = 0.12) {
  normalize(a, 1);
  const k = Math.tanh(drive);
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    a[i] = Math.tanh(drive * (x + asym * x * x)) / k;
  }
  return a;
}
/** 끝을 부드럽게 줄인다 (뚝 끊기는 소리 방지) */
function fadeOut(a, sr, dur = 0.03) {
  const n = Math.min(a.length, Math.round(dur * sr));
  for (let i = 0; i < n; i++) a[a.length - 1 - i] *= i / n;
  return a;
}
/** 우그러들거나 긁히는 "우두둑" 그릿: 짧은 대역 잡음 조각을 무작위 시간에 흩뿌린다 (투구 찌그러짐, 나무 쪼개짐 등) */
function gritBurst(out, sr, r, { t0 = 0, span = 0.04, count = 10, amp = 1, fLo = 500, fHi = 3000 }) {
  for (let k = 0; k < count; k++) {
    const t = t0 + r() * span;
    const f = Math.exp(between(r, Math.log(fLo), Math.log(fHi)));
    noiseHit(out, sr, r, { t0: t, amp: amp * between(r, 0.3, 1), attack: 0.0002, tau: between(r, 0.0015, 0.004), type: 'bandpass', f, q: between(r, 0.8, 2) });
  }
}
/** 냄비 대역 깎기: 원래 소리에서 f 근처(대역 통과) 성분을 빼서 그 대역만 움푹 낮춘다 (amount 0.6 ≈ −8dB) */
function potCut(a, sr, f = 550, amount = 0.6, q = 0.7) {
  const bp = new Filt('bandpass', f, q, sr);
  for (let i = 0; i < a.length; i++) a[i] -= amount * bp.run(a[i]);
  return a;
}
/**
 * 쇠가 찢어지듯 갈라지는 "짝-치직": 아주 짧고 높은(2.5kHz 위) 딸깍이 몇 ms 사이에 연달아 터진다 (금이 번져 나가는 파열).
 * 첫 딸깍이 가장 크고 뒤로 갈수록 작아진다
 */
function crackBurst(out, sr, r, { t0 = 0.001, count = 4, span = 0.012, amp = 1, f = 2800 }) {
  for (let k = 0; k < count; k++) {
    const t = t0 + (k ? span * (k / count) * between(r, 0.6, 1.3) : 0);
    noiseHit(out, sr, r, { t0: t, amp: amp * (k ? between(r, 0.25, 0.6) : 1), attack: 0.00005, tau: between(r, 0.0004, 0.0012), type: 'highpass', f: f * between(r, 0.9, 1.4), q: 0.8, len: 6 });
  }
}
/** 낮은 주파수 잡음(흔들림)을 하나 만든다: 0 근처에서 천천히 움직이는 값 */
function wobble(r, sr, rate) {
  let v = 0;
  let target = 0;
  let cnt = 0;
  const hold = Math.max(1, Math.round(sr / rate));
  return () => {
    if (cnt-- <= 0) {
      target = r() * 2 - 1;
      cnt = hold;
    }
    v += (target - v) * (4 / hold);
    return v;
  };
}

// ─────────────────────────────────────────────────────────────
//  롱소드의 고유 진동 (모드) 목록
// ─────────────────────────────────────────────────────────────
// 양 끝이 자유로운 막대의 굽힘 모드: f_n = f1 × (β_n / β_1)²,  β = 4.730, 7.853, 10.996, 14.137, 17.279, (2n+1)π/2 …
const BETA = [4.73, 7.8532, 10.9956, 14.1372, 17.2788];
const beta = (n) => (n <= 5 ? BETA[n - 1] : ((2 * n + 1) * Math.PI) / 2);

/**
 * 칼 한 자루의 모드.
 * f1: 첫 굽힘 진동(Hz). 강철 칼날 1.2m·두께 6mm → 약 22Hz (E=200GPa로 계산)
 * at: 맞은 자리(칼날 길이 비율). 모드의 "마디" 근처를 맞으면 그 모드는 약하게 울린다
 * edge: 날끼리(폭 방향 굽힘) 맞은 정도 0~1, 나머지는 칼 면 방향 굽힘
 */
function swordModes(r, { f1 = 22, at = 0.6, edge = 0.6, damp = 1, fmax = 9500, even = false }) {
  const modes = [];
  // even: 긁기·스치기처럼 계속 이어지는 소리용 고른 음색 (부딪힘처럼 날카롭게 올리면 오래 들을 때 귀가 아프다)
  const tiltEven = (f) => (0.3 + 0.9 * Math.exp(-(Math.log2(f / 650) ** 2) / (2 * 0.7 ** 2)) + 0.9 * Math.exp(-(Math.log2(f / 3000) ** 2) / (2 * 0.8 ** 2))) * (f > 6500 ? (6500 / f) ** 1.5 : 1);
  const tilt = (f) => {
    if (even) return tiltEven(f);
    // 소리 설계용 음색 곡선. 300~900Hz를 키우면 폰 스피커(200Hz 아래는 거의 안 나온다)에서 "냄비 두드리는 퉁"만 남는다
    //  → 그 대역은 낮추고, 쇠가 찢어지듯 날카로운 3~5kHz를 올린다 (무게감은 따로 넣는 200Hz 아래 "쿵"이 맡는다)
    const body = 0.45 * Math.exp(-(Math.log2(f / 450) ** 2) / (2 * 0.7 ** 2));
    const bite = 1.3 * Math.exp(-(Math.log2(f / 3800) ** 2) / (2 * 0.7 ** 2));
    return (0.25 + body + bite) * (f > 7500 ? (7500 / f) ** 1.5 : 1);
  };
  const decay = (f) => {
    // 손이 쥐고 있어서 낮은 진동은 금방 죽고, 예전엔 1~5kHz 울림이 0.8초까지 남아 종처럼 울렸다 →
    // 전 대역을 확 줄여서(약 1/5) "쟁그렁"은 남기되 "댕~"하고 우는 꼬리는 없앤다
    const t = f < 350 ? 0.03 + (0.045 * (f - 150)) / 200 : f < 1400 ? 0.075 + (0.08 * (f - 350)) / 1050 : f < 5000 ? 0.13 : 0.13 - (0.07 * (f - 5000)) / 4500;
    return Math.max(0.018, t) * damp * between(r, 0.7, 1.15);
  };
  const add = (f, a) => {
    if (f < 140 || f > fmax) return;
    modes.push({ f, a: a * tilt(f), t60: decay(f) });
    // 맥놀이: 거의 같은 높이의 모드 쌍 (칼이 완전히 대칭이 아니라서 갈라진다) → "우웅~" 떨림
    if (f > 700 && r() < 0.55) modes.push({ f: f * (1 + between(r, 0.0005, 0.003)), a: a * tilt(f) * between(r, 0.5, 1), t60: decay(f) });
  };
  // 1) 칼 면 방향 굽힘 (두께 방향: 촘촘하다). 칼날이 끝으로 갈수록 가늘어져서 정수비에서 3~4% 벗어난다
  for (let n = 3; n < 40; n++) {
    const f = f1 * (beta(n) / BETA[0]) ** 2 * (1 + 0.035 * gauss(r));
    if (f > fmax) break;
    add(f, (1 - edge * 0.6) * Math.sin(beta(n) * at + 0.8) * between(r, 0.6, 1.2));
  }
  // 2) 날 방향 굽힘 (폭 45mm / 두께 6mm → 약 7.5배 높다). 날끼리 부딪히면 이게 크게 울린다
  const f1e = f1 * between(r, 6.8, 8);
  for (let n = 1; n < 12; n++) {
    const f = f1e * (beta(n) / BETA[0]) ** 2 * (1 + 0.03 * gauss(r));
    if (f > fmax) break;
    add(f, (0.4 + edge) * Math.sin(beta(n) * at + 0.8) * between(r, 0.6, 1.2));
  }
  // 3) 비틀림 (칼날을 비트는 진동, 약 350Hz 간격)
  const ft = between(r, 320, 390);
  for (let n = 1; n < 10; n++) add(ft * n * (1 + 0.03 * gauss(r)), 0.35 * Math.sin(n * 2.1 + at * 5) * r());
  return modes;
}

/** 코등이(가로막대 25cm): 830Hz 근처의 "깡" — 너무 크면 종소리처럼 깨끗해져서 조금만 */
function guardModes(r, amp = 0.35) {
  const f0 = between(r, 700, 980);
  return [1, 2.756, 5.404].map((k, i) => ({ f: f0 * k * (1 + 0.02 * gauss(r)), a: amp * (i === 0 ? 1 : 0.6) * between(r, 0.6, 1.1), t60: between(r, 0.03, 0.06) })); // 길게 울리면 종·마림바 같은 "통"이 된다
}

// ─────────────────────────────────────────────────────────────
//  목소리: 모음별 입안 공명대(포먼트) [F1~F4 (Hz), 대역폭 B1~B4 (Hz)] — 성인 남성 기준 (Peterson & Barney 1952 평균값 근처)
// ─────────────────────────────────────────────────────────────
const VOWELS = {
  a: [730, 1090, 2440, 3400, 90, 110, 160, 250],
  ʌ: [640, 1190, 2390, 3400, 80, 100, 150, 250],
  u: [300, 870, 2240, 3300, 60, 90, 150, 250],
  o: [570, 840, 2410, 3400, 70, 90, 150, 250],
  e: [530, 1840, 2480, 3500, 70, 110, 160, 250],
  ə: [500, 1500, 2500, 3500, 80, 110, 160, 250],
  // 입을 다문 콧소리 "음": 낮은 공명 하나가 대부분이고 위 공명은 거의 없다 (뒤 4개 = 공명대별 세기)
  m: [250, 1000, 2200, 3300, 60, 150, 200, 300, 1, 0.12, 0.05, 0.02],
};

/**
 * 캐릭터별 목소리 (characters.js 의 id 로 찾는다. 없으면 generic).
 *  f0: 평소 목소리 높이(Hz), tract: 입안 공명대 배율(성도가 짧을수록 큼 — 여성 약 1.15),
 *  breath: 숨 섞인 정도, rough: 목 긁힘(보컬 프라이), style: 죽을 때의 버릇 (voiceScript)
 *  rec: 녹음된 목소리 (public/sfx/voice/<id>_<ko|bleed|hurt><번호>.mp3, 출처는 public/sfx/LICENSE.txt).
 *       ko·bleed = 파일 개수(0이면 그 죽음은 합성 목소리), hurt = 깊은 상처에 짧게 내는 신음 개수(0이면 신음 없음),
 *       revive = 부활 때 곁들이는 짧은 숨 들이켬 개수(이졸데만),
 *       rate = 재생 속도(목소리 높이), gain = 음량
 *       녹음은 들어 보지 않고 음높이·길이 분석으로 골랐다 — 귀로 듣고 바꾸려면 파일만 갈아 끼우면 된다
 *  mute: 목소리 없이 몸이 "쿵" 쓰러지는 소리만 (BodySounds 가 쓰러짐을 꼭 한 번, 무겁게 낸다). 지금은 쓰는 캐릭터가 없다
 */
export const VOICES = {
  player: { f0: 118, tract: 1.0, breath: 0.35, rough: 0.3, style: 'grunt', rec: { ko: 2, bleed: 2, hurt: 2 } }, // HaelDB 3번 목소리
  generic: { f0: 124, tract: 1.0, breath: 0.35, rough: 0.3, style: 'grunt', rec: { ko: 2, bleed: 2, hurt: 2 } }, // HaelDB 첫 목소리 (전부 CC0)
  bran: { f0: 98, tract: 0.93, breath: 0.3, rough: 0.55, style: 'sob', rec: { ko: 2, bleed: 2, hurt: 2, rate: 0.92 } }, // Baradari(거칠고 낮음) + 지친 신음 kanyonwyvern(CC0). 굵고 거친 목
  isolde: { f0: 215, tract: 1.17, breath: 0.55, rough: 0.1, style: 'gasp', rec: { ko: 1, bleed: 1, hurt: 2, revive: 1, gain: 1.3 } }, // 짧게 맞는 소리 "흣"·"읏" 녹음(mvVoiceActing, CC0, 사장님 선택). 비명(450~525Hz)은 차분한 스물한 살 검사에게 부자연스러웠다
  liao: { f0: 112, tract: 1.0, breath: 0.65, rough: 0.35, style: 'sigh', rec: { ko: 1, bleed: 2, hurt: 2, gain: 0.6, rate: 0.95 } }, // 하인리히와 같은 배우(HaelDB 2번 목소리)를 작고 조금 낮게 — 설정상 하인리히와 닮은 사람(사장님). 예전 합성 한숨은 증기처럼 "치이익" 새어 기차 소리 같았다
  heinrich: { f0: 132, tract: 1.03, breath: 0.3, rough: 0.35, style: 'laugh', rec: { ko: 2, bleed: 2, hurt: 2 } }, // HaelDB 가장 높은 목소리(과장된 외침, 전부 CC0)
  margarethe: { f0: 160, tract: 1.12, breath: 0.6, rough: 0.25, style: 'exhale', rec: { ko: 1, bleed: 1, hurt: 1, gain: 1.1 } }, // 지친 날숨 섞인 낮은 "하아…" 녹음 하나를 두 죽음에 같이 쓴다(hisoul, CC0, 사장님 선택 — 노장이라). 음은 낮추지 않았다: 여성 녹음을 낮추면 익룡·괴수처럼 들렸고, 합성 날숨은 폰에서 뭉개졌다
};

/**
 * 죽을 때 목소리의 "대본": 조각(모음·길이·음높이·세기·성대 울림 정도·바람 소리)을 시간 순서로 늘어놓는다.
 * kind 'ko' = 머리를 맞아 정신을 잃음(짧게 뚝 끊김), 'bleed' = 피가 빠져 숨이 잦아듦(길게)
 */
function voiceScript(r, prof, kind) {
  const F = prof.f0 * between(r, 0.95, 1.05);
  const S = [];
  let t = 0.005;
  const add = (dur, vowel, a, b, amp, voice, air = 0, attack = 0.012, release = 0.05, gap = 0) => {
    S.push({ t, dur, vowel, f0a: F * a, f0b: F * b, amp, voice, air, attack, release });
    t += dur + gap;
  };
  const inhale = (dur, amp) => add(dur, 'a', 1, 1, amp, 0, 1, dur * 0.4, dur * 0.3, 0.02); // 들숨: 성대 안 울리고 바람만
  const exhale = (dur, amp, vowel = 'ə') => add(dur, vowel, 0.9, 0.7, amp, 0.12, 0.9, 0.02, dur * 0.6); // 날숨: 끝이 스르르
  const ko = kind === 'ko';
  switch (prof.style) {
    case 'sob':
      if (ko) {
        add(0.14, 'a', 1.5, 1.15, 1, 1, 0.2, 0.006, 0.02);
        add(0.06, 'ʌ', 1.1, 0.9, 0.6, 0.8, 0.1, 0.005, 0.012);
        exhale(0.3, 0.25);
      } else {
        for (let i = 0; i < 3; i++) {
          inhale(0.12, 0.25);
          add(0.18 + 0.05 * i, 'u', 1.35 - 0.05 * i, 1.05, 0.7 - 0.15 * i, 0.85, 0.25, 0.02, 0.06, 0.05);
        }
        exhale(0.6, 0.3, 'ʌ');
      }
      break;
    case 'gasp':
      // 비명 없이: 짧게 "헉" 하고 숨을 들이켜고, 목에서 작게 걸린 뒤 조용히 잦아든다
      if (ko) {
        inhale(0.1, 0.5);
        add(0.06, 'ə', 1, 0.9, 0.25, 0.35, 0.7, 0.004, 0.02, 0.03);
        exhale(0.35, 0.18);
      } else {
        inhale(0.18, 0.35);
        add(0.3, 'e', 1.05, 0.85, 0.28, 0.35, 0.7, 0.03, 0.15, 0.2);
        inhale(0.12, 0.2);
        exhale(0.5, 0.2);
      }
      break;
    case 'sigh':
      if (ko) {
        add(0.07, 'ʌ', 1, 0.9, 0.5, 0.8, 0.2, 0.004, 0.02);
        exhale(0.25, 0.2);
      } else {
        exhale(0.9, 0.35);
        add(0.25, 'ə', 0.75, 0.6, 0.25, 0.5, 0.3, 0.05, 0.15);
      }
      break;
    case 'laugh':
      if (ko) {
        add(0.12, 'a', 1.35, 1.1, 1, 1, 0.15, 0.005, 0.02);
        exhale(0.25, 0.2);
      } else {
        for (let i = 0; i < 4; i++) {
          add(0.035, 'a', 1, 1, 0.35, 0, 1, 0.005, 0.01); // "ㅎ"
          add(0.09, 'a', 1.25 - 0.06 * i, 1.15 - 0.06 * i, 0.75 - 0.12 * i, 0.9, 0.2, 0.008, 0.03, 0.06);
        }
        add(0.4, 'ʌ', 0.85, 0.7, 0.5, 0.8, 0.3, 0.03, 0.2, 0.05);
        exhale(0.5, 0.2);
      }
      break;
    // 마르그레테 새 목소리 후보 (성대 울림 위주, 바람 소리 적게)
    case 'sighV': // A. 숨 섞인 "하아…"가 낮게 내려가며 끝난다
      if (ko) {
        add(0.05, 'ʌ', 1, 0.9, 0.4, 0.6, 0.3, 0.004, 0.02, 0.02);
        add(0.45, 'a', 1.05, 0.75, 0.45, 0.75, 0.35, 0.03, 0.3);
      } else {
        inhale(0.2, 0.15);
        add(0.8, 'a', 1.1, 0.7, 0.5, 0.7, 0.4, 0.05, 0.5);
        add(0.25, 'ə', 0.7, 0.6, 0.15, 0.5, 0.4, 0.03, 0.2);
      }
      break;
    case 'mumble': // B. 입을 거의 닫고 "음… 으음…" 웅얼거리다 잦아든다
      if (ko) {
        add(0.12, 'm', 1, 0.95, 0.45, 1, 0, 0.02, 0.03);
        add(0.18, 'ə', 1, 0.85, 0.4, 0.9, 0.1, 0.02, 0.1);
      } else {
        add(0.14, 'm', 1, 0.97, 0.5, 1, 0, 0.02, 0.03);
        add(0.16, 'ə', 0.97, 0.93, 0.45, 0.9, 0.1, 0.02, 0.05, 0.06);
        add(0.12, 'm', 0.95, 0.92, 0.4, 1, 0, 0.02, 0.03);
        add(0.2, 'o', 0.92, 0.85, 0.35, 0.9, 0.1, 0.02, 0.08, 0.1);
        add(0.35, 'm', 0.85, 0.7, 0.3, 1, 0.05, 0.02, 0.25);
      }
      break;
    case 'groanSigh': // C. 짧고 낮은 "읏…" 뒤에 한숨
      if (ko) {
        add(0.1, 'ʌ', 0.95, 0.8, 0.7, 0.85, 0.2, 0.005, 0.03, 0.03);
        add(0.3, 'ə', 0.85, 0.7, 0.3, 0.6, 0.4, 0.02, 0.2);
      } else {
        add(0.15, 'ʌ', 0.95, 0.85, 0.6, 0.85, 0.2, 0.01, 0.05, 0.12);
        add(0.7, 'a', 1, 0.72, 0.45, 0.65, 0.45, 0.05, 0.45);
      }
      break;
    case 'hum': // D. 입을 다문 채 체념하듯 "흠…"
      if (ko) {
        add(0.25, 'm', 1, 0.85, 0.6, 1, 0.05, 0.01, 0.12);
      } else {
        add(0.1, 'm', 1.05, 1, 0.5, 1, 0.1, 0.01, 0.02);
        add(0.9, 'm', 1, 0.72, 0.55, 1, 0.05, 0.03, 0.6);
      }
      break;
    case 'exhale':
      // 비명·신음 없이 숨으로만: 맞는 순간 짧고 낮게 "흡" 하고 막히고, 숨이 한 번 새어 나간다
      if (ko) {
        add(0.07, 'ʌ', 0.9, 0.8, 0.45, 0.35, 0.8, 0.004, 0.025, 0.03);
        exhale(0.5, 0.22, 'o');
      } else {
        inhale(0.25, 0.18);
        add(0.7, 'o', 0.9, 0.75, 0.35, 0.35, 0.8, 0.06, 0.4);
      }
      break;
    default:
      if (ko) {
        add(0.16, 'ʌ', 1.3, 0.9, 1, 0.95, 0.15, 0.006, 0.03);
        exhale(0.3, 0.22);
      } else {
        inhale(0.22, 0.35);
        add(0.45, 'ʌ', 1.05, 0.75, 0.6, 0.7, 0.3, 0.03, 0.2, 0.2);
        exhale(0.6, 0.28);
      }
  }
  return S;
}

// ─────────────────────────────────────────────────────────────
//  소리 조각 만들기 (각각 Float32Array 하나를 돌려준다)
// ─────────────────────────────────────────────────────────────
export const SYNTH = {
  /**
   * 칼끼리 부딪힘. hard = 세게(짧은 접촉 → 밝고 긴 울림), 아니면 약하게(둔탁한 "텅")
   */
  clash(sr, r, hard) {
    const dur = hard ? 0.4 : 0.32; // 울림을 확 줄였으니 조각 길이도 짧게 (메모리·CPU 절약)
    const n = Math.round(dur * sr);
    const x = new Float32Array(n);
    const out = new Float32Array(n);
    // 두 칼이 맞닿는 시간: 세게 = 0.15~0.25ms (9kHz까지 울림), 약하게 = 0.5~0.9ms (3kHz까지)
    const tc = hard ? between(r, 0.00015, 0.00025) : between(r, 0.0005, 0.0009);
    pulse(x, sr, 0.001, tc, 1);
    // 부딪힌 뒤 칼이 튀었다가 다시 닿는 "따닥" (몇 ms 뒤 작게)
    let xEnd = 0.001 + tc;
    if (r() < 0.65) {
      const t = 0.001 + between(r, 0.002, 0.009);
      pulse(x, sr, t, tc * 1.3, between(r, -0.5, 0.5));
      xEnd = t + tc * 1.3;
    }
    if (r() < 0.35) {
      const t = 0.001 + between(r, 0.01, 0.025);
      pulse(x, sr, t, tc * 1.6, between(r, -0.3, 0.3));
      xEnd = t + tc * 1.6;
    }
    // 날이 서로 파고들며 긁히는 짧은 마찰 (모드를 무작위 위상으로 흔든다 → "치익" 섞인 울림)
    const grind = hard ? 0.05 : 0.02;
    const gTau = between(r, 0.006, 0.02);
    for (let i = 0, m = Math.round(gTau * 5 * sr); i < m; i++) x[i + 20] += grind * (r() * 2 - 1) * Math.exp(-i / (gTau * sr)) * (0.3 + 0.7 * r());
    xEnd = Math.max(xEnd, 20 / sr + gTau * 5);
    const edge = between(r, 0.3, 1);
    const modes = [
      ...swordModes(r, { f1: between(r, 19, 25), at: between(r, 0.35, 0.9), edge, damp: hard ? 0.6 : 0.35 }),
      ...swordModes(r, { f1: between(r, 19, 25), at: between(r, 0.35, 0.9), edge, damp: hard ? 0.6 : 0.35 }),
      ...guardModes(r, hard ? 0.12 : 0.08), // 코등이 "깡"(700~980Hz)은 냄비 소리의 주범이라 아주 조금만
    ];
    resonate(x, out, sr, modes, Math.ceil(xEnd * sr) + 2);
    normalize(out, 1);
    potCut(out, sr, 560, 0.75);
    // 울림(음정)이 앞에 나서면 마림바처럼 "통" 한다 → 울림을 줄이고 칼날끼리 긁히며 부서지는 거친 알갱이를 덮는다
    for (let i = 0; i < n; i++) out[i] *= hard ? 0.7 : 0.55;
    gritBurst(out, sr, r, { t0: 0.001, span: hard ? 0.025 : 0.015, count: hard ? 16 : 10, amp: hard ? 0.4 : 0.35, fLo: 1500, fHi: 7000 });
    // 쇠가 찢어지는 "짝-치직": 맞은 순간 높은 딸깍이 연달아 (세게 칠수록 많이, 크게)
    crackBurst(out, sr, r, { t0: 0.001, count: hard ? 6 : 3, span: hard ? 0.014 : 0.008, amp: hard ? 1.1 : 0.55, f: hard ? 3000 : 2400 });
    saturate(out, hard ? 2.2 : 1.6);
    // "쿵": 두 손과 팔이 받는 충격. 찌그러뜨린 뒤에 깨끗한 저음으로 더한다 (찌그러뜨리면 300~600Hz 배음 = 냄비 소리가 생긴다)
    thumpTone(out, sr, { t0: 0.001, f0: between(r, hard ? 60 : 85, hard ? 85 : 120), drop: 0.65, dropTau: 0.012, tau: hard ? 0.03 : 0.024, amp: hard ? 0.55 : 0.35 });
    return fadeOut(normalize(out, 0.9), sr, hard ? 0.06 : 0.08);
  },

  /**
   * 투구: 두꺼운 강철 사발 + 안쪽 누비 + 머리 무게 → 짧고 둔탁한 "퍽-크덕" (종소리 성분을 빼고 그릿·저역 위주로)
   * heavy = 세게 맞음(찌그러짐이 큼): 저역을 더 밀고 그릿을 더 두껍게 깐다
   */
  helmet(sr, r, heavy = false) {
    const dur = 0.4;
    const n = Math.round(dur * sr);
    const x = new Float32Array(n);
    const out = new Float32Array(n);
    const tc = between(r, 0.0003, 0.0006);
    pulse(x, sr, 0.001, tc, 1);
    if (r() < 0.5) pulse(x, sr, 0.001 + between(r, 0.003, 0.012), tc * 1.5, between(r, -0.4, 0.4));
    const modes = [];
    // 사발 모양 껍데기: 모드가 촘촘하고 아주 짧게 죽는다. 300~900Hz(냄비 소리)는 약하게, 2~5kHz(쇠가 찢기는 소리)를 세게
    for (let i = 0; i < 30; i++) {
      const f = Math.exp(between(r, Math.log(600), Math.log(6000)));
      const a = (f < 1500 ? 0.35 : f < 5000 ? 1 : 0.6) * between(r, 0.25, 0.85) * (r() < 0.5 ? -1 : 1);
      modes.push({ f, a, t60: between(r, 0.008, 0.022) });
    }
    // 비조화 금속 "칭" 두세 개, 아주 짧게만 (긴 종소리 대신)
    for (let i = 0; i < 3; i++) modes.push({ f: between(r, 2200, 5000), a: between(r, 0.35, 0.6), t60: between(r, 0.015, 0.03) });
    // 칼도 아주 조금, 아주 짧게 울린다
    const blade = swordModes(r, { f1: between(r, 19, 25), at: between(r, 0.4, 0.9), edge: 0.8, damp: 0.3 });
    for (const m of blade) m.a *= 0.28;
    resonate(x, out, sr, [...modes, ...blade], Math.ceil(0.012 * sr));
    normalize(out, 1);
    potCut(out, sr, 560, 0.75);
    // 쇠판이 우그러지며 갈라지는 "까각": 연쇄 파열 + 거친 잔가루(그릿)
    crackBurst(out, sr, r, { t0: 0.001, count: heavy ? 6 : 4, span: heavy ? 0.02 : 0.012, amp: heavy ? 1 : 0.7, f: 2600 });
    gritBurst(out, sr, r, { t0: 0.002, span: heavy ? 0.045 : 0.025, count: heavy ? 16 : 9, amp: heavy ? 0.45 : 0.3, fLo: 1200, fHi: 5000 });
    saturate(out, heavy ? 2.6 : 2.2);
    // "퍽": 머리 무게가 받는 낮은 몸통 충격 (40~100Hz). 찌그러뜨린 뒤에 깨끗하게 더한다 (배음이 냄비 소리를 만들지 않게)
    thumpTone(out, sr, { t0: 0.001, f0: between(r, heavy ? 45 : 60, heavy ? 65 : 85), drop: 0.75, dropTau: 0.015, tau: heavy ? 0.021 : 0.015, amp: heavy ? 0.8 : 0.5 });
    return fadeOut(normalize(out, 0.9), sr, heavy ? 0.045 : 0.035);
  },

  /**
   * 칼날이 칼날을 긁는 소리 (맞대고 밀 때 계속 도는 고리). 끝과 처음이 이어지게 만든다.
   * 미끄러지면서 작은 흠·요철에 걸렸다 풀리는 "걸림-미끄럼"(stick-slip): 아주 짧은 두드림이 1초에 천 번 넘게
   * → 칼날 모드를 계속 흔든다 → "지이익". 가끔 크게 걸리는 "득"도 섞는다.
   */
  scrape(sr, r) {
    const L = Math.round(2 * sr);
    const tail = Math.round(0.9 * sr);
    const x = new Float32Array(L + tail);
    const out = new Float32Array(L + tail);
    let t = 0;
    while (t < L) {
      t += Math.max(1, Math.round((-Math.log(r() + 1e-9) / 1400) * sr));
      if (t < L) x[t] += Math.exp(0.7 * gauss(r)) * (r() < 0.5 ? -1 : 1) * 0.12;
    }
    // 크게 걸리는 순간 (1초에 8번쯤): 그 뒤로 잠깐 두드림이 몰린다
    t = 0;
    while (t < L) {
      t += Math.round((-Math.log(r() + 1e-9) / 8) * sr);
      for (let k = 0, tt = t; k < 12 && tt < L; k++, tt += Math.round(between(r, 0.0003, 0.002) * sr)) x[tt] += between(r, -1, 1) * 0.5;
    }
    for (let i = 0; i < L; i++) x[i] += 0.02 * (r() * 2 - 1); // 마찰 잡음
    const modes = [...swordModes(r, { f1: 22, at: 0.5, edge: 0.9, damp: 0.22, fmax: 9800, even: true }), ...swordModes(r, { f1: 23.5, at: 0.7, edge: 0.9, damp: 0.22, even: true })];
    // 낮은 모드는 빼고(쥔 손이 죽인다), 종처럼 안 울리게 나머지도 짧게 눌러 거친 "지이익"에 가깝게 만든다
    for (const m of modes) {
      if (m.f < 600) m.a *= 0.3;
      m.t60 = Math.min(m.t60, 0.1);
      if (r() < 0.06 && m.f > 1500) m.t60 = between(r, 0.15, 0.3);
    }
    resonate(x, out, sr, modes, L);
    // 쇠 가루 "쉬익" (높은 잡음)
    const hp = new Filt('highpass', 3500, 0.7, sr);
    const wb = wobble(r, sr, 30);
    for (let i = 0; i < L; i++) out[i] += 0.4 * hp.run(r() * 2 - 1) * (0.4 + 0.6 * Math.abs(wb()));
    // 이음새: 끝에 남은 울림을 처음에 더한다 → 고리로 돌려도 틈이 없다
    const loop = out.slice(0, L);
    for (let i = 0; i < tail; i++) loop[i] += out[L + i];
    return normalize(loop, 0.8);
  },

  /** 스치듯 긁고 지나가는 한 번 "스르릉" (빗맞은 칼, 칼날 위로 미끄러진 타격) */
  shing(sr, r) {
    const dur = between(r, 0.35, 0.5);
    const n = Math.round((dur + 0.7) * sr);
    const x = new Float32Array(n);
    const out = new Float32Array(n);
    const L = Math.round(dur * sr);
    let t = 0;
    while (t < L) {
      const u = t / L;
      const rate = 2600 * (1 - u) + 250; // 미끄러지는 속도가 줄어든다
      t += Math.max(1, Math.round((-Math.log(r() + 1e-9) / rate) * sr));
      const env = Math.min(1, t / (0.006 * sr)) * (1 - u) ** 1.5;
      if (t < L) x[t] += Math.exp(0.6 * gauss(r)) * (r() < 0.5 ? -1 : 1) * env * 0.15;
    }
    const modes = [...swordModes(r, { f1: between(r, 20, 24), at: between(r, 0.4, 0.9), edge: 1, damp: 0.7, even: true }), ...guardModes(r, 0.15)];
    for (const m of modes) if (m.f < 700) m.a *= 0.35;
    resonate(x, out, sr, modes, L);
    const bp = new Filt('bandpass', 6000, 0.8, sr);
    for (let i = 0; i < L; i++) {
      const u = i / L;
      if (i % 64 === 0) bp.set(7000 - 4000 * u, 0.8);
      out[i] += 0.35 * bp.run(r() * 2 - 1) * Math.min(1, i / (0.004 * sr)) * (1 - u) ** 2;
    }
    return fadeOut(normalize(out, 0.9), sr, 0.2);
  },

  /**
   * 젖은 살: 살·피 속 공기 방울이 터지는 작은 "뽁" 수십 개 (방울 소리 모델: 음이 살짝 올라가며 금방 죽는 사인파)
   * + 질척한 낮은 잡음. heavy = 깊이 베인 큰 상처: 방울을 더 촘촘히, 물컹한 저역 "우두둑" 크런치를 더한다
   */
  wet(sr, r, heavy = false) {
    const dur = 0.36;
    const n = Math.round(dur * sr);
    const out = new Float32Array(n);
    const count = Math.round(between(r, heavy ? 55 : 30, heavy ? 90 : 55));
    for (let k = 0; k < count; k++) {
      const t0 = Math.min(0.3, -Math.log(r() + 1e-9) * 0.045);
      const f0 = Math.exp(between(r, Math.log(220), Math.log(1700)));
      const d = (0.13 * f0 + 0.0072 * f0 ** 1.5) * between(r, 0.6, 1.2); // 감쇠(1/초): 작은 방울일수록 빨리 죽는다
      const sigma = 0.1 * d * between(r, 0.5, 1.5); // 음이 올라가는 정도
      const amp = between(r, 0.2, 1) * (f0 / 500) ** -0.5 * Math.exp(-t0 / 0.12);
      const n0 = Math.round(t0 * sr);
      const len = Math.min(n - n0, Math.round((6 / d) * sr));
      let ph = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        ph += (TAU * f0 * (1 + sigma * t)) / sr;
        out[n0 + i] += amp * Math.exp(-d * t) * Math.sin(ph);
      }
    }
    // 질척한 잡음: 필터 주파수가 흔들리는 저음 잡음
    const lp = new Filt('lowpass', 900, 2.5, sr);
    const wb = wobble(r, sr, 60);
    const am = wobble(r, sr, 45);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      if (i % 32 === 0) lp.set(750 + 450 * wb(), 2.5);
      out[i] += 0.5 * lp.run(r() * 2 - 1) * Math.min(1, t / 0.004) * Math.exp(-t / 0.07) * (0.3 + 0.7 * Math.abs(am()));
    }
    // 크게 베였을 때: 물컹한 살·연골이 눌리며 나는 낮은 "우두둑" 크런치 (그릿을 낮은 대역으로)
    if (heavy) gritBurst(out, sr, r, { t0: 0.002, span: 0.09, count: 14, amp: 0.5, fLo: 150, fHi: 700 });
    return fadeOut(normalize(out, 0.9), sr, 0.05);
  },

  /**
   * 베는 소리: 누비옷 천이 찢기는 "지직"(섬유가 끊어지는 틱 수천 번) + 칼날이 살을 가르는 "쉭"(높은음 → 낮은음)
   */
  slice(sr, r) {
    const dur = between(r, 0.18, 0.26);
    const n = Math.round((dur + 0.05) * sr);
    const out = new Float32Array(n);
    const L = Math.round(dur * sr);
    const env = (i) => Math.min(1, i / (0.004 * sr)) * (i < L ? (1 - i / L) ** 0.7 : 0);
    const bp = new Filt('bandpass', 2600, 0.8, sr);
    let next = 0;
    for (let i = 0; i < n; i++) {
      let v = 0;
      if (i >= next) {
        v = (r() * 2 - 1) * 2.5;
        next = i + Math.max(1, Math.round((-Math.log(r() + 1e-9) / 3200) * sr));
      }
      out[i] += bp.run(v) * env(i);
    }
    const sw = new Filt('bandpass', 4000, 1.2, sr);
    for (let i = 0; i < n; i++) {
      if (i % 32 === 0) sw.set(4200 * Math.pow(900 / 4200, Math.min(1, i / L)), 1.2);
      out[i] += 0.9 * sw.run(r() * 2 - 1) * env(i);
    }
    return fadeOut(normalize(out, 0.9), sr, 0.03);
  },

  /** 몸통을 치는 둔탁한 "퍽". 세게 찌그러뜨려 폰 스피커에서도 들리는 200~600Hz 배음을 만든다 */
  thump(sr, r) {
    const n = Math.round(0.3 * sr);
    const out = new Float32Array(n);
    // 살덩이는 울리지 않는다: 예전엔 170~560Hz 사인파 울림을 넣었더니 마림바 건반처럼 "통" 하고 음정이 났다 →
    // 음정 없는 잡음 뭉치(살이 눌리는 "퍽") + 누비옷 "철썩" + 아주 낮은 몸통 "쿵"(찌그러뜨린 뒤에 깨끗하게)만 쓴다
    noiseHit(out, sr, r, { amp: 0.8, attack: 0.0015, tau: between(r, 0.014, 0.02), type: 'lowpass', f: between(r, 350, 500), q: 0.6 });
    noiseHit(out, sr, r, { amp: 0.45, attack: 0.001, tau: 0.01, type: 'lowpass', f: 900, q: 0.6 });
    noiseHit(out, sr, r, { amp: 0.28, attack: 0.0005, tau: 0.004, type: 'bandpass', f: between(r, 1100, 1600), q: 0.9 }); // 누비옷 "철썩"
    gritBurst(out, sr, r, { t0: 0.001, span: 0.02, count: 6, amp: 0.12, fLo: 400, fHi: 1500 });
    saturate(out, 2.5, 0.15);
    thumpTone(out, sr, { f0: between(r, 55, 75), drop: 0.8, dropTau: 0.012, tau: between(r, 0.025, 0.035), amp: 0.7 });
    return fadeOut(normalize(out, 0.9), sr, 0.05);
  },

  /** 뼈: 날카로운 "딱"이 몇 번 겹치고(금이 가며 부러짐), 단단하지만 금방 멎는 울림 (700Hz~4kHz) */
  bone(sr, r) {
    const n = Math.round(0.2 * sr);
    const x = new Float32Array(n);
    const out = new Float32Array(n);
    const times = [0.001];
    const k = Math.round(between(r, 3, 6));
    for (let i = 0; i < k; i++) times.push(0.001 + between(r, 0.003, 0.045) * (i + 1) / k);
    for (const [i, t] of times.entries()) pulse(x, sr, t, 0.00015, (i === 0 ? 1 : between(r, 0.2, 0.7)) * (r() < 0.5 ? -1 : 1));
    const modes = [];
    for (let i = 0; i < 9; i++) modes.push({ f: Math.exp(between(r, Math.log(700), Math.log(4200))), a: between(r, 0.4, 1) * (r() < 0.5 ? -1 : 1), t60: between(r, 0.02, 0.07) });
    resonate(x, out, sr, modes, Math.ceil(0.06 * sr));
    normalize(out, 1);
    for (const t of times) noiseHit(out, sr, r, { t0: t, amp: between(r, 0.3, 0.6), tau: 0.0015, f: 2000 });
    saturate(out, 1.8);
    return fadeOut(normalize(out, 0.9), sr, 0.03);
  },

  /** 나무(방패·둔기 자루): 두꺼운 각재를 친 "퍽-톡". 낮은~중간 대역 모드가 금방 죽고, 섬유 쪼개지는 잔가루가 섞인다 */
  wood(sr, r) {
    const n = Math.round(0.3 * sr);
    const x = new Float32Array(n);
    const out = new Float32Array(n);
    pulse(x, sr, 0.001, between(r, 0.0006, 0.0012), 1);
    const modes = [];
    for (let i = 0; i < 10; i++) modes.push({ f: Math.exp(between(r, Math.log(180), Math.log(2500))), a: between(r, 0.4, 1) * (r() < 0.5 ? -1 : 1), t60: between(r, 0.012, 0.03) }); // 짧게: 길면 마림바(나무 건반)가 된다
    resonate(x, out, sr, modes, Math.ceil(0.01 * sr));
    normalize(out, 1);
    noiseHit(out, sr, r, { t0: 0.001, amp: 0.5, attack: 0.0004, tau: 0.006, type: 'bandpass', f: 900, q: 1 });
    gritBurst(out, sr, r, { t0: 0.001, span: 0.02, count: 6, amp: 0.35, fLo: 1200, fHi: 4500 });
    thumpTone(out, sr, { t0: 0.001, f0: between(r, 90, 130), drop: 0.6, dropTau: 0.02, tau: 0.045, amp: 0.5 });
    saturate(out, 2.2);
    return fadeOut(normalize(out, 0.9), sr, 0.06);
  },

  /** 플라즈마 날이 다른 것과 부딪힘: 지지직 튀는 전기 스파크 + 짧게 부풀었다 죽는 "웅" 훔 (SF 무기용) */
  plasmaZap(sr, r) {
    const n = Math.round(0.3 * sr);
    const out = new Float32Array(n);
    let t = 0;
    while (t < n) {
      t += Math.max(1, Math.round((-Math.log(r() + 1e-9) / 900) * sr));
      if (t < n) noiseHit(out, sr, r, { t0: t / sr, amp: between(r, 0.2, 0.7), attack: 0.0001, tau: between(r, 0.0008, 0.003), type: 'highpass', f: between(r, 2500, 7000), q: between(r, 0.6, 1.3) });
    }
    const f0 = between(r, 85, 130);
    const dur = 0.09;
    for (let i = 0; i < n; i++) {
      const tt = i / sr;
      if (tt > dur) break;
      let s = 0;
      for (let h = 1; h <= 5; h++) s += (Math.sin(TAU * f0 * h * tt) / h) * (1 + 0.02 * Math.sin(TAU * 7 * tt));
      out[i] += 0.22 * s * Math.min(1, tt / 0.006) * Math.exp(-tt / 0.05);
    }
    saturate(out, 2.0);
    return fadeOut(normalize(out, 0.85), sr, 0.05);
  },

  /** 플라즈마가 살을 지지는 "치이익": 기름 튀듯 잔 크랙이 촘촘하고, 위로 김 새듯 잡음이 스민다 */
  plasmaSizzle(sr, r) {
    const dur = 0.4;
    const n = Math.round(dur * sr);
    const out = new Float32Array(n);
    let t = 0;
    while (t < n) {
      t += Math.max(1, Math.round((-Math.log(r() + 1e-9) / 2600) * sr));
      if (t < n) noiseHit(out, sr, r, { t0: t / sr, amp: between(r, 0.15, 0.5), attack: 0.0001, tau: between(r, 0.0006, 0.002), type: 'bandpass', f: between(r, 2000, 6500), q: between(r, 1, 2.2) });
    }
    const hp = new Filt('highpass', 3200, 0.7, sr);
    const wb = wobble(r, sr, 18);
    for (let i = 0; i < n; i++) {
      const tt = i / sr;
      out[i] += 0.3 * hp.run(r() * 2 - 1) * Math.min(1, tt / 0.01) * Math.exp(-tt / 0.3) * (0.4 + 0.6 * Math.abs(wb()));
    }
    return fadeOut(normalize(out, 0.85), sr, 0.08);
  },

  /** 고무 닭(코미디 무기): 삑삑이 "끽" + 짧은 경적 "빵" — 진지한 재질들 사이에서 일부러 튀는 소리 */
  rubberHonk(sr, r) {
    const n = Math.round(0.35 * sr);
    const out = new Float32Array(n);
    const f0 = between(r, 900, 1500);
    let ph = 0;
    const len1 = Math.round(0.09 * sr);
    for (let i = 0; i < len1; i++) {
      const t = i / sr;
      const f = f0 * (1 - (0.3 * t) / 0.09) * (1 + 0.05 * Math.sin(TAU * 40 * t));
      ph += (TAU * f) / sr;
      out[i] += 0.35 * Math.sign(Math.sin(ph)) * Math.exp(-t / 0.05) * Math.min(1, i / (0.002 * sr));
    }
    const f1 = between(r, 210, 260);
    const start = Math.round(0.05 * sr);
    const len2 = Math.round(0.22 * sr);
    for (let i = 0; i < len2 && start + i < n; i++) {
      const t = i / sr;
      const v = Math.sign(Math.sin(TAU * f1 * t)) * 0.5 + Math.sign(Math.sin(TAU * f1 * 1.5 * t)) * 0.3;
      out[start + i] += 0.4 * v * Math.min(1, i / (0.004 * sr)) * Math.exp(-t / 0.11);
    }
    saturate(out, 1.4, 0);
    return fadeOut(normalize(out, 0.85), sr, 0.05);
  },

  /**
   * 모래 위 발소리: 뒤꿈치의 낮은 "툭" + 모래가 눌리는 "사각" + 알갱이 부서지는 잔소리 + 앞꿈치 "사박".
   * heavy = 비틀거리며 크게 디딘 발 (더 낮고 길게, 모래를 더 많이 흩뜨린다)
   */
  footstep(sr, r, heavy = false) {
    // "저-벅": 뒤꿈치가 먼저 닿고(저) 50~90ms 뒤 발바닥·앞꿈치가 눌린다(벅). 둘 다 낮고 굵은 자갈 크런치
    const n = Math.round(0.3 * sr);
    const out = new Float32Array(n);
    const t2 = between(r, 0.05, 0.09);
    for (const [t0, k] of [[0.002, 1], [t2, 0.75]]) {
      noiseHit(out, sr, r, { t0, amp: 0.5 * k, attack: 0.005, tau: heavy ? 0.035 : 0.025, type: 'lowpass', f: between(r, 280, 420), q: 0.8 });
      gritBurst(out, sr, r, { t0: t0 + 0.003, span: heavy ? 0.06 : 0.045, count: heavy ? 18 : 12, amp: 0.26 * k, fLo: 220, fHi: 1000 });
    }
    gritBurst(out, sr, r, { t0: 0.006, span: 0.1, count: 4, amp: 0.06, fLo: 2000, fHi: 5000 }); // 튀는 잔모래 아주 조금 (밝기)
    saturate(out, 1.6);
    // 몸무게가 실리는 낮은 "쿵" 두 번 (찌그러뜨린 뒤에 더해 깨끗하게)
    thumpTone(out, sr, { t0: 0.002, f0: between(r, 42, 58), drop: 0.4, dropTau: 0.01, attack: 0.004, tau: heavy ? 0.03 : 0.024, amp: heavy ? 1.3 : 1.05 });
    thumpTone(out, sr, { t0: t2, f0: between(r, 45, 60), drop: 0.3, dropTau: 0.01, attack: 0.006, tau: 0.022, amp: heavy ? 0.9 : 0.7 });
    return fadeOut(normalize(out, 0.9), sr, 0.05);
  },

  /**
   * 사람이 모래 위로 쓰러짐: 몸통 무게의 낮은 "쿵"이 부위마다 몇십 ms 차이로 겹치고(골반 → 어깨 → 팔),
   * 모래가 튀어 흩어지는 "촤르르", 누비옷이 부딪히는 "퍽". heavy = 통나무처럼 그대로 넘어짐
   */
  bodyFall(sr, r, heavy = true) {
    const n = Math.round(0.6 * sr);
    const out = new Float32Array(n);
    const parts = heavy ? 3 : 2;
    for (let k = 0; k < parts; k++) {
      const t0 = 0.002 + (k ? between(r, 0.025, 0.08) * k : 0);
      thumpTone(out, sr, { t0, f0: between(r, 45, 70), drop: 0.6, dropTau: 0.015, attack: 0.004, tau: between(r, 0.035, 0.05), amp: k ? between(r, 0.35, 0.6) : 1 });
      noiseHit(out, sr, r, { t0, amp: k ? 0.35 : 0.6, attack: 0.004, tau: 0.03, type: 'lowpass', f: between(r, 350, 600), q: 0.7 });
    }
    const n0 = Math.round(0.006 * sr);
    const bp = new Filt('bandpass', 3500, 0.6, sr);
    const wb = wobble(r, sr, 40);
    for (let i = 0; i < Math.round(0.25 * sr) && n0 + i < n; i++) {
      const t = i / sr;
      out[n0 + i] += 0.18 * bp.run(r() * 2 - 1) * Math.min(1, t / 0.01) * Math.exp(-t / 0.07) * (0.3 + 0.7 * Math.abs(wb()));
    }
    gritBurst(out, sr, r, { t0: 0.004, span: 0.15, count: heavy ? 30 : 18, amp: 0.18, fLo: 1500, fHi: 6000 });
    noiseHit(out, sr, r, { t0: 0.004, amp: 0.3, attack: 0.001, tau: 0.008, type: 'bandpass', f: 1300, q: 1 });
    saturate(out, 2.4, 0.15);
    return fadeOut(normalize(out, 0.9), sr, 0.1);
  },

  /**
   * 무기가 부러짐. wood(나뭇가지): 섬유가 연달아 끊기는 "우지끈" + 둔한 "딱".
   * frozen(언 참치): 얼음이 쩍 갈라지는 날카롭고 짧은 금속성 "쩍" + 잔금 + 물컹한 살덩이의 둔한 "퍽"
   */
  weaponBreak(sr, r, material = 'wood') {
    const frozen = material === 'frozen';
    const n = Math.round(0.5 * sr);
    const x = new Float32Array(n);
    const out = new Float32Array(n);
    const cracks = [0.001];
    const k = Math.round(between(r, 3, 6));
    for (let i = 0; i < k; i++) cracks.push(0.001 + (between(r, 0.004, frozen ? 0.03 : 0.07) * (i + 1)) / k);
    for (const [i, t] of cracks.entries()) pulse(x, sr, t, frozen ? 0.0001 : 0.0002, (i === 0 ? 1 : between(r, 0.25, 0.7)) * (r() < 0.5 ? -1 : 1));
    const modes = [];
    for (let i = 0; i < 9; i++) {
      const f = Math.exp(between(r, Math.log(frozen ? 1800 : 300), Math.log(frozen ? 7000 : 2500)));
      modes.push({ f, a: between(r, 0.4, 1) * (r() < 0.5 ? -1 : 1), t60: between(r, 0.02, frozen ? 0.06 : 0.07) });
    }
    resonate(x, out, sr, modes, Math.ceil(0.09 * sr));
    normalize(out, 1);
    for (const t of cracks) noiseHit(out, sr, r, { t0: t, amp: between(r, 0.3, 0.6), tau: 0.0015, f: frozen ? 3000 : 1500 });
    gritBurst(out, sr, r, { t0: 0.002, span: 0.12, count: 40, amp: 0.3, fLo: frozen ? 2500 : 900, fHi: frozen ? 9000 : 5000 });
    thumpTone(out, sr, { t0: 0.001, f0: frozen ? between(r, 75, 95) : between(r, 100, 130), drop: 0.5, tau: 0.03, amp: 0.5 });
    saturate(out, 2.5);
    return fadeOut(normalize(out, 0.9), sr, 0.06);
  },

  /**
   * 목소리 (성대 + 입안 공명을 흉내 낸 합성). 녹음이 없을 때 쓰는 죽음 소리.
   *  - 성대: 로젠버그 성문 파형(열렸다 닫히는 공기 흐름)의 변화량. 주기마다 음높이·세기가 조금씩 흔들린다(지터·시머)
   *  - 거친 목(rough): 주기마다 세기를 번갈아 바꿔 "끄륵" 하는 목 긁힘(보컬 프라이)을 만든다
   *  - 숨(breath): 성대가 열릴 때 새는 바람 소리 + 순수한 날숨
   *  - 입안: 모음마다 다른 공명대(포먼트) 4개. 성도 길이(tract)가 짧을수록(여성·젊음) 공명대가 높다
   * @param prof VOICES 항목, kind: 'ko'(머리를 맞아 뚝 끊김) | 'bleed'(피가 빠져 숨이 잦아듦)
   */
  voice(sr, r, prof, kind = 'ko') {
    const segs = voiceScript(r, prof, kind);
    const total = segs.reduce((m, s) => Math.max(m, s.t + s.dur), 0) + 0.15;
    const n = Math.round(total * sr);
    const out = new Float32Array(n);
    const F = [0, 1, 2, 3].map(() => new Filt('bandpass', 500, 5, sr));
    const FG = [1, 0.55, 0.28, 0.14];
    const rough = prof.rough;
    // 숨(바람) 잡음은 입안 공명대에 통과시키지 않고 따로 어둡게 거른다: 공명대(2~4kHz)를 지나면 증기가 새는 "치이익"이 되어
    // 기차 소리처럼 들렸다 (합성 목소리의 2~8kHz 쉿 비중 19~25% vs 사람 녹음 3~6%). 진짜 숨은 대부분 2kHz 아래의 "하—"
    const airLp1 = new Filt('lowpass', 1100, 0.6, sr);
    const airLp2 = new Filt('lowpass', 1900, 0.6, sr);
    const airHp = new Filt('highpass', 140, 0.6, sr);
    const turb = wobble(r, sr, 25);
    for (const s of segs) {
      const V = VOWELS[s.vowel] || VOWELS['ə'];
      F.forEach((fl, i) => fl.set(V[i] * prof.tract, (V[i] * prof.tract) / (V[4 + i] * (s.voice > 0.3 ? 1 : 1.8))));
      const G = V.length > 8 ? V.slice(8) : FG;
      const n0 = Math.round(s.t * sr);
      const len = Math.round(s.dur * sr);
      let ph = 0;
      let per = 0;
      let pAmp = 1;
      let pF = s.f0a;
      let g1 = 0;
      for (let i = 0; i < len && n0 + i < n; i++) {
        const u = i / len;
        const f0 = (s.f0a + (s.f0b - s.f0a) * u) * (per % 2 && rough > 0.2 ? 1 + 0.04 * rough : 1);
        ph += pF / sr;
        if (ph >= 1) {
          ph -= 1;
          per++;
          pF = f0 * (1 + 0.012 * gauss(r));
          pAmp = (1 + 0.08 * gauss(r)) * (per % 2 ? 1 - 0.55 * rough : 1);
        }
        const g = ph < 0.4 ? 0.5 * (1 - Math.cos((Math.PI * ph) / 0.4)) : ph < 0.62 ? Math.cos((Math.PI / 2) * ((ph - 0.4) / 0.22)) : 0;
        const exc = (g - g1) * 18 * pAmp * s.voice + (r() * 2 - 1) * prof.breath * 0.2 * (0.3 + g) * s.voice;
        g1 = g;
        const env = Math.min(1, i / (s.attack * sr)) * Math.min(1, (len - i) / (s.release * sr));
        let y = 0;
        for (let k = 0; k < 4; k++) y += G[k] * F[k].run(exc);
        const air = airHp.run(airLp2.run(airLp1.run(r() * 2 - 1))) * (0.75 + 0.25 * turb());
        out[n0 + i] += s.amp * env * (y + air * s.air * 1.6);
      }
    }
    saturate(out, 1.3, 0.05);
    const lp = new Filt('lowpass', 6500, 0.7, sr); // 남은 쉿 소리를 한 번 더 누른다 (사람 녹음 수준 3~6%)
    for (let i = 0; i < n; i++) out[i] = lp.run(out[i]);
    return fadeOut(normalize(out, 0.9), sr, 0.08);
  },

  /**
   * 대전 게임식 칼 피격음 (사무라이 쇼다운처럼 짧고 크고 또렷하게). 네 겹을 쌓고 세게 눌러 붙인다:
   *  1) "챡": 맞는 순간의 아주 짧고 높은 파열   2) "촤악": 베는 방향으로 쓸어내리는 칼바람 (높은음 → 낮은음)
   *  3) "징": 칼날이 짧게 우는 3~7kHz 금속 광택   4) "퍽": 묵직한 저음 펀치 (찌그러뜨린 뒤에 깨끗하게)
   * kind: 'cut'(베기) | 'stab'(찌르기: 칼바람 짧게) | 'blunt'(칼 면·손잡이: 칼바람 없이 "퍽!") | 'armor'(판금·투구: "징"을 크게)
   */
  hitSlash(sr, r, kind = 'cut') {
    const n = Math.round(0.35 * sr);
    const out = new Float32Array(n);
    const cut = kind === 'cut';
    const blunt = kind === 'blunt';
    const armor = kind === 'armor';
    noiseHit(out, sr, r, { t0: 0.001, amp: 1.2, attack: 0.0001, tau: blunt ? 0.004 : 0.0035, type: 'highpass', f: blunt ? 1500 : 2500, q: 0.7 });
    // 10ms 남짓 밝게 튀는 "챡"(베기·찌르기) / "팍"(칼 면) — 너무 짧으면 무거운 "퍽"에 묻힌다
    noiseHit(out, sr, r, { t0: 0.001, amp: blunt ? 0.8 : 0.7, attack: 0.0003, tau: blunt ? 0.006 : 0.008, type: 'bandpass', f: blunt ? 2000 : 4000, q: 0.8 });
    crackBurst(out, sr, r, { t0: 0.001, count: armor ? 6 : 3, span: 0.01, amp: armor ? 0.9 : 0.5, f: 3000 });
    if (!blunt) {
      const L = Math.round((cut ? between(r, 0.16, 0.22) : armor ? 0.06 : 0.09) * sr);
      const bp = new Filt('bandpass', 7000, 1.1, sr);
      const end = cut ? 1400 : 2500;
      for (let i = 0; i < L && i < n; i++) {
        const u = i / L;
        if (i % 32 === 0) bp.set(7000 * Math.pow(end / 7000, u), 1.1);
        out[i] += (cut ? 0.7 : 0.45) * bp.run(r() * 2 - 1) * Math.min(1, i / (0.002 * sr)) * (1 - u) ** 1.6;
      }
    }
    const sheen = [];
    for (let i = 0; i < 6; i++) sheen.push({ f: between(r, 3000, 7500), a: between(r, 0.4, 1), t60: between(r, 0.06, armor ? 0.18 : 0.11) });
    const x = new Float32Array(n);
    const ring = new Float32Array(n);
    pulse(x, sr, 0.001, 0.00012, 1);
    resonate(x, ring, sr, sheen, Math.ceil(0.002 * sr));
    normalize(ring, 1);
    const sk = armor ? 0.55 : blunt ? 0.08 : 0.28;
    for (let i = 0; i < n; i++) out[i] += sk * ring[i];
    saturate(out, 2.6);
    thumpTone(out, sr, { t0: 0.001, f0: between(r, blunt ? 60 : 70, blunt ? 80 : 95), drop: 0.8, dropTau: 0.01, attack: 0.001, tau: blunt ? 0.045 : 0.035, amp: blunt ? 1.1 : 0.85 });
    noiseHit(out, sr, r, { t0: 0.001, amp: 0.5, attack: 0.001, tau: 0.012, type: 'lowpass', f: 450, q: 0.7 });
    return fadeOut(normalize(out, 0.95), sr, 0.05);
  },

  /**
   * 날 선 칼이 살을 벰 (33차, 사장님: 31차 두 안이 "둔기나 죽도 소리 같다 — 고기가 날카로운 금속에 베이는 소리가 나야"). 세 겹:
   *  1) 칼날 "슉": 1.5kHz 위의 매끈한 잡음 덩이 — 어택 3ms, 45~70ms 머물다 빠르게 사라지고 가운데가 7k→3k 로 내려간다.
   *     날카로움은 여기서 나온다. 전기 "파직"의 원인(딱딱 튀는 클릭, 3~7kHz 금속 울림, 세게 누른 찌그러짐)은 넣지 않는다
   *  2) 살이 갈라지는 "쯔억": 0.9~2.2kHz 잡음을 불규칙하게 떨어 젖은 결을 낸다 (8ms 뒤부터, 베고 지나가면 길게)
   *  3) 작은 "툭": 90~110Hz 짧게 — 몽둥이·죽도처럼 치는 무게와 1~2kHz "팍"은 없다
   * kind: 'cut' | 'stab'(짧고 좁게, 툭이 조금 더) | 'through'(베고 지나감: 갈라지는 소리를 길게)
   */
  bladeCut(sr, r, kind = 'cut') {
    const stab = kind === 'stab';
    const thru = kind === 'through';
    const n = Math.round((thru ? 0.4 : 0.3) * sr);
    const out = new Float32Array(n);
    const E = Math.round((stab ? between(r, 0.035, 0.05) : between(r, 0.045, 0.07)) * sr);
    const hp = new Filt('highpass', 1500, 0.7, sr);
    const bp = new Filt('bandpass', 7000, 0.5, sr);
    for (let i = 0; i < E + Math.round(0.03 * sr) && i < n; i++) {
      const u = i / E;
      if (i % 32 === 0) bp.set(7000 * Math.pow(3000 / 7000, Math.min(1, u)), 0.5);
      const env = Math.min(1, i / (0.003 * sr)) * (u < 1 ? 1 - 0.3 * u : 0.7 * Math.exp(-(i - E) / (0.008 * sr)));
      const x = r() * 2 - 1;
      out[i] += (1.1 * hp.run(x) + 1.4 * bp.run(x)) * env;
    }
    const t0 = Math.round(0.008 * sr);
    const P = Math.round((thru ? between(r, 0.18, 0.24) : stab ? between(r, 0.07, 0.1) : between(r, 0.09, 0.15)) * sr);
    const f1 = thru ? 2200 : 1800;
    const pb = new Filt('bandpass', f1, 0.8, sr);
    const am = wobble(r, sr, 110);
    for (let i = 0; i < P && t0 + i < n; i++) {
      const u = i / P;
      if (i % 32 === 0) pb.set(f1 * Math.pow(900 / f1, u), 0.8);
      out[t0 + i] += 0.6 * pb.run(r() * 2 - 1) * Math.min(1, i / (0.004 * sr)) * (1 - u) ** 1.2 * (0.35 + 0.65 * Math.abs(am()));
    }
    thumpTone(out, sr, { t0: 0.002, f0: between(r, 90, 110), drop: 0.5, dropTau: 0.01, attack: 0.001, tau: stab ? 0.03 : 0.022, amp: stab ? 0.3 : 0.18 });
    return fadeOut(normalize(out, 0.9), sr, 0.03);
  },

  /**
   * 대전 게임식 베기 2 (34·35차, 사장님 "사무라이 쇼다운의 피격음" → "하오마루·갠주로·한조의 강베기 소리처럼").
   *  5차 hitSlash 도 같은 참고였지만 3~7.5kHz 금속 울림·딱딱 튀는 클릭·세게 누른 찌그러짐이 겹쳐 전기 "파직"이 됐다(9/30).
   *  그 셋 없이 층을 나눠 쌓는다 — 강베기일수록 두껍고 길게:
   *  1) "자": 칼날이 들어가는 밝은 잡음, 1.5kHz 위, 어택 1.5ms (강베기는 짧게 — 몸통에 묻힌다)
   *  2) "쩌억": 살덩이가 크게 갈라지는 두꺼운 잡음 — 900Hz 가운데·400~2.5kHz, 거칠게 떨리고(70Hz) 잡음만 따로 눌러 두껍게,
   *     아케이드 기판 샘플처럼 16kHz 로 성기게 잡아 9kHz 위를 닫는다(금속 울림이 아니라 "거친 결"). 강베기 160~200ms
   *  3) "쿵": 50~65Hz 저음 — 대전 게임의 과장된 무게. 저음만 따로 눌러 붙인다
   *  4) "촤아아악": 피가 뿜어지는 잡음 — 2.8k→1kHz 로 내려가며 두세 번 울컥. 강베기 0.65~0.85초
   * kind: 'cut'(보통 베기) | 'heavy'(강베기) | 'through'(베고 지나감: 강베기 + 길게) | 'stab'(찌르기: "자-푹", 피는 짧게)
   */
  slashHit(sr, r, kind = 'cut') {
    const stab = kind === 'stab';
    const heavy = kind === 'heavy' || kind === 'through';
    const thru = kind === 'through';
    const n = Math.round((heavy ? 1.1 : 0.75) * sr);
    const out = new Float32Array(n);
    // 1) 자
    const E = Math.round((heavy ? between(r, 0.03, 0.04) : stab ? between(r, 0.04, 0.05) : between(r, 0.05, 0.065)) * sr);
    const hp = new Filt('highpass', 1500, 0.7, sr);
    const bp = new Filt('bandpass', 8000, 0.5, sr);
    for (let i = 0; i < E + Math.round(0.02 * sr); i++) {
      const u = i / E;
      if (i % 32 === 0) bp.set(8000 * Math.pow(3500 / 8000, Math.min(1, u)), 0.5);
      const env = Math.min(1, i / (0.0015 * sr)) * (u < 1 ? 1 - 0.4 * u : 0.6 * Math.exp(-(i - E) / (0.008 * sr)));
      const x = r() * 2 - 1;
      out[i] += (heavy ? 0.7 : 1) * (hp.run(x) + 1.2 * bp.run(x)) * env;
    }
    // 2) 쩌억 — 따로 만들어 눌러 두껍게, 성기게 잡아 거친 결
    const B = Math.round((thru ? between(r, 0.2, 0.24) : heavy ? between(r, 0.16, 0.2) : stab ? between(r, 0.08, 0.1) : between(r, 0.1, 0.13)) * sr);
    const body = new Float32Array(B + Math.round(0.05 * sr));
    const fc = stab ? 700 : 900;
    const bb = new Filt('bandpass', fc * 1.6, 0.6, sr);
    const flick = wobble(r, sr, 70);
    for (let i = 0; i < body.length; i++) {
      const u = Math.min(1, i / B);
      if (i % 32 === 0) bb.set(fc * 1.6 * Math.pow(0.6, u), 0.6);
      const env = Math.min(1, i / (0.002 * sr)) * (i < B ? (1 - u) ** 0.8 : 0);
      body[i] = bb.run(r() * 2 - 1) * env * (0.45 + 0.55 * Math.abs(flick()));
    }
    saturate(body, heavy ? 2.6 : 2);
    let held = 0;
    for (let i = 0; i < body.length; i++) {
      if (i % 3 === 0) held = body[i];
      body[i] = held;
    }
    const lp9 = new Filt('lowpass', 9000, 0.7, sr);
    const b0 = Math.round(0.004 * sr);
    const bk = heavy ? 1.3 : 1;
    for (let i = 0; i < body.length && b0 + i < n; i++) out[b0 + i] += bk * lp9.run(body[i]);
    // 4) 촤아아악 (피)
    const g0 = Math.round((heavy ? 0.04 : 0.025) * sr);
    const G = Math.round((thru ? between(r, 0.75, 0.9) : heavy ? between(r, 0.65, 0.8) : stab ? between(r, 0.25, 0.32) : between(r, 0.4, 0.5)) * sr);
    const gb = new Filt('bandpass', 2800, 0.7, sr);
    const spurts = stab ? 2 : heavy ? 3 : 2;
    const fl = wobble(r, sr, 60);
    for (let i = 0; i < G && g0 + i < n; i++) {
      const u = i / G;
      if (i % 32 === 0) gb.set(2800 * Math.pow(1000 / 2800, u), 0.7);
      const pulse = 0.5 + 0.5 * Math.cos(Math.PI * spurts * u) ** 2; // 울컥울컥
      out[g0 + i] += (heavy ? 0.7 : 0.55) * gb.run(r() * 2 - 1) * Math.min(1, i / (0.012 * sr)) * (1 - u) ** 1.2 * pulse * (0.7 + 0.3 * Math.abs(fl()));
    }
    // 3) 쿵 (저음만 따로 눌러서 더한다)
    const lo = new Float32Array(n);
    thumpTone(lo, sr, { t0: 0.001, f0: between(r, 50, 65), drop: 0.6, dropTau: 0.025, attack: 0.002, tau: heavy ? 0.14 : stab ? 0.08 : 0.1, amp: 1 });
    saturate(lo, 1.8);
    normalize(lo, 1);
    const pk = peakOf(out) || 1;
    for (let i = 0; i < n; i++) out[i] = out[i] / pk + (heavy ? 0.5 : 0.4) * lo[i];
    return fadeOut(normalize(out, 0.9), sr, heavy ? 0.12 : 0.06);
  },

  /**
   * 판금이 부서짐: 금이 연달아 번지는 "짝-짝-짝" + 리벳이 튕겨 나가는 짧은 "틱-틱" + 가죽끈이 끊기는 "탁"
   * + 판이 짧게 우는 "깡"(투구보다 조금 길게) + 묵직한 "쿵". 조각이 떨어지는 소리는 Sound.plateBreak 이 _shard 로 따로 낸다
   */
  plateBreak(sr, r) {
    const n = Math.round(0.5 * sr);
    const out = new Float32Array(n);
    const x = new Float32Array(n);
    const ring = new Float32Array(n);
    pulse(x, sr, 0.001, 0.0002, 1);
    const modes = [];
    for (let i = 0; i < 24; i++) {
      const f = Math.exp(between(r, Math.log(700), Math.log(6500)));
      modes.push({ f, a: (f < 1500 ? 0.4 : 1) * between(r, 0.3, 1) * (r() < 0.5 ? -1 : 1), t60: between(r, 0.02, 0.05) });
    }
    resonate(x, ring, sr, modes, Math.ceil(0.004 * sr));
    normalize(ring, 1);
    potCut(ring, sr, 560, 0.75);
    for (let i = 0; i < n; i++) out[i] += 0.6 * ring[i];
    crackBurst(out, sr, r, { t0: 0.001, count: 8, span: 0.03, amp: 1.2, f: 2500 });
    // 리벳이 튕겨 나가는 "틱": 작고 높은 쇳조각 울림이 20~140ms 사이에 몇 번
    const pops = Math.round(between(r, 3, 5));
    for (let k = 0; k < pops; k++) {
      const t0 = between(r, 0.02, 0.14);
      const px = new Float32Array(n);
      const py = new Float32Array(n);
      pulse(px, sr, t0, 0.0001, 1);
      resonate(px, py, sr, [0, 1, 2].map(() => ({ f: between(r, 2500, 7000), a: between(r, 0.5, 1), t60: between(r, 0.02, 0.04) })), Math.ceil((t0 + 0.002) * sr));
      const a = between(r, 0.15, 0.35) / (peakOf(py) || 1);
      for (let i = 0; i < n; i++) out[i] += a * py[i];
    }
    noiseHit(out, sr, r, { t0: between(r, 0.03, 0.06), amp: 0.4, attack: 0.0005, tau: 0.006, type: 'bandpass', f: between(r, 1200, 1800), q: 1 }); // 가죽끈 "탁"
    gritBurst(out, sr, r, { t0: 0.002, span: 0.08, count: 20, amp: 0.3, fLo: 1200, fHi: 6000 });
    saturate(out, 2.4);
    thumpTone(out, sr, { t0: 0.001, f0: between(r, 55, 75), drop: 0.7, dropTau: 0.012, tau: 0.035, amp: 0.8 });
    return fadeOut(normalize(out, 0.95), sr, 0.08);
  },

  /**
   * 리볼버 총성 (30차, 사장님 "비비탄 딱총 같다 → 더 파괴력 있는 소리"). .357/.44급을 겨눈다:
   *  0.2ms 어택의 넓은 "딱" 크랙(총구 압력파) + 200~1200Hz 잡음이 잦아드는 "쾅" 몸통 + 110→38Hz 충격파와 60Hz 밑 무게(근거리 압력감)
   *  + 화약 튀는 "치직" 조금. 마지막에 세게 눌러(saturate) 귀가 눌리는 느낌. 0.7초. 꼬리는 gunTail·무대 방 울림이 맡는다.
   */
  gunshot(sr, r) {
    const n = Math.round(0.7 * sr);
    const out = new Float32Array(n);
    noiseHit(out, sr, r, { t0: 0, amp: 2.4, attack: 0.0002, tau: 0.007, type: 'highpass', f: 2500, q: 0.7 }); // 크랙 (폰 스피커에서 살아남는 몫이라 크게)
    noiseHit(out, sr, r, { t0: 0.0005, amp: 1.8, attack: 0.0003, tau: 0.014, type: 'bandpass', f: 4200, q: 1.2 });
    noiseHit(out, sr, r, { t0: 0.0008, amp: 1.2, attack: 0.0004, tau: 0.02, type: 'bandpass', f: 1600, q: 0.9 }); // 크랙과 몸통 사이를 잇는 "탁"
    noiseHit(out, sr, r, { t0: 0.001, amp: 1.7, attack: 0.0008, tau: 0.045, type: 'bandpass', f: 600, q: 0.6 }); // 폭발 몸통 (폰 스피커가 내는 몫)
    noiseHit(out, sr, r, { t0: 0.002, amp: 1.2, attack: 0.002, tau: 0.09, type: 'lowpass', f: 700, q: 0.7 });
    thumpTone(out, sr, { t0: 0.001, f0: between(r, 100, 120), drop: 0.65, dropTau: 0.03, attack: 0.001, tau: 0.1, amp: 0.8 }); // 충격파
    thumpTone(out, sr, { t0: 0.004, f0: between(r, 52, 62), drop: 0.3, dropTau: 0.05, attack: 0.003, tau: 0.16, amp: 0.5 }); // 무게
    gritBurst(out, sr, r, { t0: 0.003, span: 0.05, count: 14, amp: 0.25, fLo: 2000, fHi: 7000 }); // 화약 "치직"
    saturate(out, 2.2, 0.2);
    return fadeOut(normalize(out, 0.95), sr, 0.08);
  },

  /**
   * 총성 꼬리 (바깥 무대용): 절벽·건물·숲에 되울리는 메아리 3~4번(80~260ms, 갈수록 낮고 작게) + 1.4초에 걸쳐 퍼지며 높은 쪽이 먼저
   * 사라지는 울림. 방 울림이 있는 무대에서는 작게만 깐다(방 울림이 나머지를 낸다). 1.6초.
   */
  gunTail(sr, r) {
    const n = Math.round(1.6 * sr);
    const out = new Float32Array(n);
    let t = between(r, 0.07, 0.11);
    for (let i = 0; i < 4 && t < 0.7; i++) {
      noiseHit(out, sr, r, { t0: t, amp: 0.55 * 0.6 ** i, attack: 0.003, tau: 0.03 + 0.02 * i, type: 'lowpass', f: 2200 - 400 * i, q: 0.6 });
      thumpTone(out, sr, { t0: t, f0: between(r, 70, 90), drop: 0.4, dropTau: 0.03, attack: 0.004, tau: 0.08, amp: 0.35 * 0.7 ** i });
      t += between(r, 0.09, 0.16);
    }
    const lp = new Filt('lowpass', 1800, 0.7, sr);
    for (let i = Math.round(0.03 * sr); i < n; i++) {
      const tt = i / sr;
      if (i % 256 === 0) lp.set(1800 * Math.exp(-tt / 0.5) + 250, 0.7);
      out[i] += 0.28 * Math.exp(-tt / 0.42) * lp.run(r() * 2 - 1);
    }
    return fadeOut(normalize(out, 0.8), sr, 0.15);
  },

  /** 칼이 바닥에 떨어짐: 칼자루와 칼끝이 잇달아 닿는 "철-컥" (모래·돌이 받아서 짧게 멎는다 — 음이 오래 남으면 냄비처럼 들리므로 울림은 0.05초 안) */
  swordLand(sr, r) {
    const n = Math.round(0.45 * sr);
    const out = new Float32Array(n);
    let t = between(r, 0, 0.01);
    for (let i = 0; i < 2; i++) {
      const amp = i ? between(r, 0.45, 0.8) : 1;
      const px = new Float32Array(n);
      const py = new Float32Array(n);
      pulse(px, sr, t, 0.0003, 1);
      resonate(px, py, sr, [0, 1, 2, 3, 4].map(() => ({ f: between(r, 900, 5200), a: between(r, 0.4, 1), t60: between(r, 0.02, 0.05) })), Math.ceil((t + 0.002) * sr));
      const a = (0.5 * amp) / (peakOf(py) || 1);
      for (let j = 0; j < n; j++) out[j] += a * py[j];
      noiseHit(out, sr, r, { t0: t, amp: 0.5 * amp, attack: 0.002, tau: 0.02, type: 'lowpass', f: between(r, 300, 500), q: 0.7 }); // 바닥에 받히는 "퍽"
      gritBurst(out, sr, r, { t0: t + 0.002, span: 0.03, count: 5, amp: 0.1 * amp, fLo: 1500, fHi: 5000 }); // 튀는 알갱이
      t += between(r, 0.04, 0.11);
    }
    saturate(out, 1.5);
    return fadeOut(normalize(out, 0.9), sr, 0.06);
  },

  /**
   * 잔잔한 봄비 (화전 터): 6초 되풀이. 잎·탄 흙에 떨어지는 잔 빗방울 "사락사락"(짧은 고음 알갱이) + 웅덩이에 가끔 굵은 방울 "톡" + 먼 빗발의 옅은 바닥.
   * 치찰음처럼 새지 않게 4kHz 위를 닫는다. 끝 0.25초를 처음에 겹쳐 이어 되풀이 자리가 안 들린다
   */
  rainLoop(sr, r) {
    const len = Math.round(6 * sr);
    const fade = Math.round(0.25 * sr);
    const n = len + fade;
    const out = new Float32Array(n);
    const bp = new Filt('bandpass', 2600, 0.5, sr);
    let a = 0.8;
    for (let i = 0; i < n; i++) {
      if (i % 1024 === 0) a = Math.min(1, Math.max(0.6, a + (r() - 0.5) * 0.1)); // 빗발이 조금씩 굵어졌다 가늘어진다
      out[i] = 0.12 * a * bp.run(r() * 2 - 1); // (연속 잡음은 낮게 — 빗소리는 알갱이가 낸다. 계속 나는 쉿 소리는 사장님이 싫어한다)
    }
    const drops = Math.round((n / sr) * 90); // 잔 빗방울 초당 약 90개
    for (let j = 0; j < drops; j++) noiseHit(out, sr, r, { t0: r() * (n / sr - 0.02), amp: 0.05 + 0.35 * r() ** 3, attack: 0.0002, tau: between(r, 0.0006, 0.002), type: 'bandpass', f: between(r, 2500, 6000), q: 1.2 });
    const big = Math.round((n / sr) * 2); // 굵은 방울 초당 약 2개
    for (let j = 0; j < big; j++) noiseHit(out, sr, r, { t0: r() * (n / sr - 0.08), amp: 0.25 + 0.5 * r(), attack: 0.0004, tau: between(r, 0.004, 0.01), type: 'lowpass', f: between(r, 700, 1600), q: 0.8 });
    const lp = new Filt('lowpass', 4000, 0.7, sr);
    for (let i = 0; i < n; i++) out[i] = lp.run(out[i]);
    for (let i = 0; i < fade; i++) {
      const x = i / fade;
      out[i] = out[i] * x + out[len + i] * (1 - x);
    }
    return normalize(out.subarray(0, len).slice(), 0.9);
  },

  /**
   * 찢어진 검은 천이 바람에 펄럭임 (밤의 포세이돈, 석상 옆 장대 둘): 2~5번 "퍼덕퍼덕" — 천이 꺾이며 공기를 치는 낮은 "퍽"(좁게 거른 잡음)에
   * 천 끝이 튀는 짧은 "탁"을 얹고, 사이는 점점 느려진다. 위를 2.6kHz에서 닫아 멀리 들리게
   */
  clothFlap(sr, r) {
    const n = Math.round(1.4 * sr);
    const out = new Float32Array(n);
    const k = Math.round(between(r, 2, 5));
    let t = between(r, 0.02, 0.08);
    for (let i = 0; i < k && t < 1.2; i++) {
      noiseHit(out, sr, r, { t0: t, amp: between(r, 0.5, 1), attack: 0.004, tau: between(r, 0.02, 0.04), type: 'bandpass', f: between(r, 350, 900), q: 0.8 });
      noiseHit(out, sr, r, { t0: t + 0.006, amp: between(r, 0.2, 0.4), attack: 0.002, tau: 0.01, type: 'highpass', f: 1800, q: 0.7 });
      t += between(r, 0.12, 0.28) * (1 + (0.3 * i) / k);
    }
    const lp = new Filt('lowpass', 2600, 0.7, sr);
    for (let i = 0; i < n; i++) out[i] = lp.run(out[i]);
    return fadeOut(normalize(out, 0.9), sr, 0.1);
  },

  /**
   * 울림(잔향)용 충격 응답: 벽에 되울리는 초기 반사 몇 개 + 부드럽게 사라지는 꼬리 (스테레오).
   * 기본값은 경기장. 배경마다 다른 방(STAGE_SOUND.room): dur 길이(초), rt 꼬리가 60dB 줄어드는 시간,
   * e0·e1 초기 반사가 오는 때(벽까지 거리), lp 꼬리의 처음 밝기(Hz)
   */
  reverbIR(sr, r, { dur = 0.9, rt = 0.85, e0 = 0.018, e1 = 0.075, lp = 6000 } = {}) {
    const n = Math.round(dur * sr);
    const L = new Float32Array(n);
    const R = new Float32Array(n);
    for (let k = 0; k < 8; k++) {
      const t = between(r, e0, e1);
      const a = between(r, 0.2, 0.5) * (r() < 0.5 ? -1 : 1);
      (r() < 0.5 ? L : R)[Math.round(t * sr)] += a;
    }
    const lpL = new Filt('lowpass', 5000, 0.7, sr);
    const lpR = new Filt('lowpass', 5000, 0.7, sr);
    for (let i = Math.round(0.012 * sr); i < n; i++) {
      const t = i / sr;
      if (i % 256 === 0) {
        // 높은 소리일수록 먼저 사라진다
        const f = lp * Math.exp(-t / (0.4 * rt)) + 900;
        lpL.set(f, 0.7);
        lpR.set(f, 0.7);
      }
      const e = 0.35 * Math.exp((-6.91 * t) / rt) * Math.min(1, (t - 0.012) / 0.03);
      L[i] += e * lpL.run(r() * 2 - 1);
      R[i] += e * lpR.run(r() * 2 - 1);
    }
    // 에너지를 1로 맞춘다 → 보내는 양(SOUND.reverb)이 곧 "원래 소리 대비 울림의 크기"가 된다
    let en = 0;
    for (let i = 0; i < n; i++) en += (L[i] * L[i] + R[i] * R[i]) / 2;
    const k = 1 / Math.sqrt(en);
    for (let i = 0; i < n; i++) {
      L[i] *= k;
      R[i] *= k;
    }
    return [L, R];
  },

  /**
   * 산사의 먼 산새 (오너가 고른 두 가지). 사인파 한 가닥의 높이를 움직여 울음을 그리고, 멀리서 들리게
   * 고음을 조금 깎은 뒤 짧은 산 울림(되먹임 지연 셋)을 섞는다.
   *  kind 'song' = 작은 산새: 위에서 내려꽂는 "찌찌찟" 4~6번 + 짧은 떨림
   *  kind 'warbler' = 휘파람새: 길게 "호오—" 뒤에 "호케쿄"
   */
  bird(sr, r, kind = 'song') {
    const n = Math.round((kind === 'song' ? 1.4 : 2.4) * sr) + Math.round(0.9 * sr);
    const out = new Float32Array(n);
    // 한 음: 길이, 시작·끝 높이(Hz), 휨(1 = 곧게), 세기. 끝을 둥글게 여닫아 딸깍이지 않게
    const note = (t0, dur, f0, f1, curve, amp, fade = 'arch') => {
      const i0 = Math.round(t0 * sr);
      const m = Math.round(dur * sr);
      let ph = 0;
      for (let i = 0; i < m && i0 + i < n; i++) {
        const x = i / m;
        const f = f0 + (f1 - f0) * x ** curve;
        ph += (2 * Math.PI * f) / sr;
        const e = fade === 'swell' ? Math.min(1, x * 3) * (1 - x ** 6) : Math.sin(Math.PI * x) ** 0.7;
        out[i0 + i] += amp * e * (Math.sin(ph) + 0.08 * Math.sin(2 * ph));
      }
    };
    if (kind === 'song') {
      let t = 0.01;
      const k = 4 + Math.floor(r() * 3);
      for (let j = 0; j < k; j++) {
        note(t, between(r, 0.04, 0.07), between(r, 5200, 6000), between(r, 3300, 3800), 0.6, between(r, 0.6, 1));
        t += between(r, 0.08, 0.12);
      }
      const ft = between(r, 4200, 4500);
      for (let j = 0; j < 8; j++) {
        note(t, 0.025, ft, ft + 400, 1, 0.5);
        t += 0.035;
      }
    } else {
      const f = between(r, 1180, 1320);
      note(0.01, 1.0, f, f + 40, 1, 0.8, 'swell');
      let t = 1.16;
      const s = f / 1250;
      for (const [dur, f0, f1] of [[0.09, 2300, 2500], [0.07, 1900, 1700], [0.28, 2700, 2450]]) {
        note(t, dur, f0 * s, f1 * s, 1, 1);
        t += dur + 0.03;
      }
    }
    // 멀리서: 한 번 거른 저역 통과(약 4.5kHz)로 날카로움을 덜고, 산에 부딪혀 돌아오는 울림을 조금
    const lp = new Filt('lowpass', 4500, 0.6, sr);
    for (let i = 0; i < n; i++) out[i] = lp.run(out[i]);
    const wet = new Float32Array(n);
    for (const [d, g] of [[0.043, 0.55], [0.071, 0.5], [0.097, 0.45]]) {
      const D = Math.round(d * sr);
      const buf = new Float32Array(n);
      for (let i = 0; i < n; i++) buf[i] = out[i] + (i >= D ? g * buf[i - D] : 0);
      for (let i = 0; i < n; i++) wet[i] += buf[i] - out[i];
    }
    for (let i = 0; i < n; i++) out[i] = out[i] * 0.8 + wet[i] * 0.18;
    return fadeOut(normalize(out, 0.9), sr, 0.2);
  },

  /** 대성당의 비둘기 "구우— 구구— 구우": 낮고 둥근 울음 다섯 마디 (목 울림 배음 + 숨소리 조금) */
  dove(sr, r) {
    const n = Math.round(2.6 * sr);
    const out = new Float32Array(n);
    const base = between(r, 440, 500);
    let t = 0.01;
    for (const [dur, g, gap] of [[0.42, 0.8, 0.12], [0.22, 1, 0.05], [0.5, 0.9, 0.25], [0.22, 0.8, 0.05], [0.45, 0.7, 0]]) {
      const i0 = Math.round(t * sr);
      const m = Math.round(dur * sr);
      let ph = 0;
      for (let i = 0; i < m && i0 + i < n; i++) {
        const x = i / m;
        ph += (TAU * (base + 70 * Math.sin(Math.PI * x) - 40 * x)) / sr;
        const e = Math.sin(Math.PI * x ** 0.6) ** 1.5;
        out[i0 + i] += g * e * (Math.sin(ph) + 0.25 * Math.sin(2 * ph) + 0.08 * Math.sin(3 * ph) + 0.05 * (r() * 2 - 1));
      }
      t += dur + gap;
    }
    const lp = new Filt('lowpass', 2500, 0.6, sr);
    for (let i = 0; i < n; i++) out[i] = lp.run(out[i]);
    return fadeOut(normalize(out, 0.9), sr, 0.1);
  },

  /** 새·박쥐의 날갯짓 "푸드득": 넓은 대역 잡음 뭉치를 초당 11~14번, 점점 약하게 */
  wings(sr, r) {
    const n = Math.round(1.0 * sr);
    const out = new Float32Array(n);
    const bp = new Filt('bandpass', between(r, 900, 1500), 1, sr);
    const k = 10 + Math.floor(r() * 5);
    let t = 0.005;
    for (let j = 0; j < k; j++) {
      const a = (1 - (0.6 * j) / k) * between(r, 0.7, 1);
      const i0 = Math.round(t * sr);
      for (let i = 0; i < Math.round(0.06 * sr) && i0 + i < n; i++) {
        const x = i / sr;
        out[i0 + i] += a * Math.min(1, x / 0.005) * Math.exp(-x / 0.02) * (r() * 2 - 1);
      }
      t += between(r, 0.07, 0.09);
    }
    for (let i = 0; i < n; i++) out[i] = bp.run(out[i]);
    return fadeOut(normalize(out, 0.9), sr, 0.1);
  },

  /** 무너진 천장에서 떨어지는 돌 부스러기: 작은 돌이 판석에 "톡 톡 토독" + 뒤따르는 먼지 "사르르" */
  debris(sr, r) {
    const n = Math.round(1.4 * sr);
    const out = new Float32Array(n);
    const k = 5 + Math.floor(r() * 6);
    for (let j = 0; j < k; j++) {
      noiseHit(out, sr, r, { t0: 0.02 + r() ** 1.5 * 0.9, amp: between(r, 0.3, 1), attack: 0.0004, tau: 0.006, type: 'bandpass', f: between(r, 1800, 4000), q: 3 });
    }
    noiseHit(out, sr, r, { t0: 0.05, amp: 0.15, attack: 0.05, tau: 0.35, type: 'lowpass', f: 1500, q: 0.6, len: 5 });
    return fadeOut(normalize(out, 0.9), sr, 0.1);
  },

  /**
   * 화로·벽난로의 불 (4초, 되풀이): 낮게 웅웅대는 불길 + 장작이 "탁 타닥" 튀는 소리(대부분 작고 가끔 크게).
   * 끝과 처음을 겹쳐 이어서 되풀이 이음매가 들리지 않는다
   */
  fireLoop(sr, r) {
    const len = Math.round(4 * sr);
    const fade = Math.round(0.2 * sr);
    const n = len + fade;
    const out = new Float32Array(n);
    const lp = new Filt('lowpass', 260, 0.7, sr);
    let a = 0.8;
    for (let i = 0; i < n; i++) {
      if (i % 512 === 0) a = Math.min(1, Math.max(0.55, a + (r() - 0.5) * 0.12)); // 불길이 느리게 일렁인다
      out[i] = 0.9 * a * lp.run(r() * 2 - 1);
    }
    const pops = Math.round(4.2 * 13);
    for (let j = 0; j < pops; j++) {
      noiseHit(out, sr, r, { t0: r() * (n / sr - 0.02), amp: 0.08 + 0.9 * r() ** 4, attack: 0.0002, tau: between(r, 0.0008, 0.003), type: 'highpass', f: between(r, 900, 2200), q: 0.7 });
    }
    // 끝 0.2초를 처음에 겹쳐 잇는다
    for (let i = 0; i < fade; i++) {
      const x = i / fade;
      out[i] = out[i] * x + out[len + i] * (1 - x);
    }
    return normalize(out.subarray(0, len).slice(), 0.9);
  },
  /**
   * 마구간의 말 (성 안뜰). 멀리서 들리게 고음을 깎는다.
   *  'snort' 코로 "푸르르르" (입술·콧구멍이 떨리는 바람) · 'stamp' 짚 깔린 바닥을 발굽으로 "쿵 쿵" + 굴레 쇠붙이 "찰랑"
   *  (울음 "흐흐흥"·"히히힝"도 만들어 봤지만 합성이라 부자연스러워 오너가 뺐다)
   */
  horse(sr, r, kind = 'snort') {
    const n = Math.round(1.0 * sr);
    const out = new Float32Array(n);
    if (kind === 'snort') {
      // 콧바람: 잡음을 초당 26~34번 떨리게(입술·콧방울) + 콧구멍 울림(약 350Hz)
      const fl = between(r, 26, 34);
      const dur = between(r, 0.5, 0.75);
      const bp = new Filt('bandpass', between(r, 300, 420), 1.4, sr);
      const lp = new Filt('lowpass', 1100, 0.7, sr);
      for (let i = 0; i < Math.round(dur * sr); i++) {
        const t = i / sr;
        const e = Math.min(1, t / 0.04) * Math.exp(-Math.max(0, t - 0.1) / (dur * 0.45));
        const flap = 0.25 + 0.75 * Math.abs(Math.sin(Math.PI * fl * t)) ** 3;
        const x = r() * 2 - 1;
        out[i] += e * flap * (1.4 * bp.run(x) + 0.5 * lp.run(x));
      }
      noiseHit(out, sr, r, { t0: 0.005, amp: 0.2, attack: 0.02, tau: 0.08, type: 'bandpass', f: 1800, q: 0.8, len: 6 }); // 처음의 "흥" 날숨
    } else if (kind === 'stamp') {
      const k = 1 + (r() < 0.6 ? 1 : 0);
      for (let j = 0; j < k; j++) {
        const t0 = 0.01 + j * between(r, 0.28, 0.4);
        thumpTone(out, sr, { t0, f0: between(r, 70, 95), drop: 0.5, dropTau: 0.01, attack: 0.002, tau: 0.03, amp: j ? 0.7 : 1 });
        noiseHit(out, sr, r, { t0, amp: 0.4, attack: 0.002, tau: 0.02, type: 'lowpass', f: 700, q: 0.7 });
        gritBurst(out, sr, r, { t0: t0 + 0.004, span: 0.08, count: 10, amp: 0.12, fLo: 1500, fHi: 4000 }); // 짚이 눌리는 "사각"
      }
      // 굴레·재갈 쇠붙이가 흔들려 "찰랑" (아주 작게)
      const tj = 0.06 + r() * 0.1;
      for (const [f, a] of [[between(r, 3100, 3600), 0.05], [between(r, 4700, 5300), 0.03]]) {
        for (let h = 0; h < 2; h++) {
          const i0 = Math.round((tj + h * 0.07) * sr);
          for (let i = 0; i < Math.round(0.15 * sr) && i0 + i < n; i++) out[i0 + i] += a * (h ? 0.6 : 1) * Math.exp(-i / sr / 0.03) * Math.sin((TAU * f * i) / sr);
        }
      }
    }
    // 멀리 마구간에서: 날카로운 위를 깎는다
    const far = new Filt('lowpass', 3500, 0.6, sr);
    for (let i = 0; i < n; i++) out[i] = far.run(out[i]);
    return fadeOut(normalize(out, 0.9), sr, 0.1);
  },
  /**
   * 성 안뜰 종탑의 큰 청동 교회 종: 흔들린 종 안쪽을 추가 쳐서 "댕—". 교회 종의 비조화 배음
   * (험 = 이름음의 절반, 프라임, 단3도 티어스, 퀸트, 이름음, 그 위 둘)이 각자 다른 빠르기로 사라지고, 낮은 험이 가장 오래(약 8초) 남는다.
   * 짝 배음이 아주 조금 어긋나 느리게 일렁인다(종이 완전한 원이 아니라서). 추가 닿는 순간의 쇳소리 "짱"은 짧게.
   * 20m 떨어진 탑 위라 날카로운 위를 깎는다 (성벽 메아리는 성 안뜰 방 울림이 더한다)
   */
  castleBell(sr, r) {
    const n = Math.round(7.5 * sr);
    const out = new Float32Array(n);
    const prime = between(r, 500, 540); // 프라임 (이름음은 그 두 배)
    // [프라임 대비 비율, 세기, 사라지는 시간(초, 60dB), 짝 배음과 어긋난 정도(Hz)]
    const P = [
      [0.5, 0.55, 8, 0.4], // 험
      [1.0, 0.5, 5.5, 0.7], // 프라임
      [1.2, 0.45, 4, 0.9], // 티어스 (단3도 → 교회 종 특유의 쓸쓸한 빛깔)
      [1.5, 0.25, 2.8, 1.2], // 퀸트
      [2.0, 0.6, 3.5, 1.5], // 이름음 (nominal, "댕" 하고 들리는 높이)
      [2.5, 0.2, 1.8, 2], // 위 3도
      [3.0, 0.18, 1.4, 2.5], // 슈퍼퀸트
      [4.0, 0.1, 0.9, 3], // 옥타브 이름음
    ];
    for (const [ratio, a, t60, beat] of P) {
      const f = prime * ratio * between(r, 0.997, 1.003);
      const k = 6.91 / t60;
      for (const d of [0, beat]) {
        const w = (TAU * (f + d)) / sr;
        const ph = r() * TAU;
        const g = a * (d ? 0.45 : 1);
        for (let i = 0; i < n; i++) {
          const t = i / sr;
          const e = Math.exp(-k * t) * Math.min(1, t / 0.002);
          if (t > 0.01 && e < 1e-4) break; // (처음 2ms 는 차오르는 중이라 작다)
          out[i] += g * e * Math.sin(w * i + ph);
        }
      }
    }
    noiseHit(out, sr, r, { t0: 0, amp: 0.35, attack: 0.0005, tau: 0.012, type: 'bandpass', f: between(r, 2200, 3200), q: 1.5 }); // 추가 닿는 "짱"
    thumpTone(out, sr, { t0: 0, f0: prime * 0.25, drop: 0.3, dropTau: 0.01, attack: 0.001, tau: 0.03, amp: 0.3 }); // 청동 몸통이 받는 "퉁"
    const lp = new Filt('lowpass', 2800, 0.6, sr);
    for (let i = 0; i < n; i++) out[i] = lp.run(out[i]);
    return fadeOut(normalize(out, 0.9), sr, 0.4);
  },

  /**
   * 대성당의 파이프 오르간 (전형적인 성당 오르간 소리). 파이프 한 줄(rank) = 배음이 많은 한 주기 파형을 되풀이해 읽는다(가볍다).
   * 16'·8'·4'·2' 네 줄을 겹치고, 줄마다 아주 조금 음을 어긋나게 해 여러 파이프가 함께 우는 "합창" 느낌을 낸다.
   * 건반을 누를 때 파이프가 "츄" 하고 트는 바람 소리(chiff)와 늘 새는 바람 소리를 조금 섞는다. 울림은 성당 방 울림이 더한다.
   * 라단조 화음 하나를 2.6초 (그 뒤는 성당 울림). 대성당에서 판이 시작될 때만 한 번 울린다.
   * (오너가 후보 셋 — 화음 하나·세 화음·바흐 토카타 첫머리 — 을 들어 보고 화음 하나를 2.6초로 골랐다)
   */
  organ(sr, r) {
    const TL = 2048;
    const table = new Float32Array(TL); // 원통 파이프(프린시펄): 배음이 천천히 약해진다
    for (let h = 1; h <= 14; h++) {
      const a = h ** -0.95 * (h % 2 ? 1 : 0.8);
      for (let i = 0; i < TL; i++) table[i] += a * Math.sin((TAU * h * i) / TL);
    }
    let pk = 0;
    for (let i = 0; i < TL; i++) pk = Math.max(pk, Math.abs(table[i]));
    for (let i = 0; i < TL; i++) table[i] /= pk;
    const hz = (m) => 440 * 2 ** ((m - 69) / 12); // MIDI 번호 → Hz
    // [시작(초), 길이(초), MIDI 음들, 페달(16' 까지 내림)인가]
    const D2 = 38;
    const notes = [[0.05, 2.6, [D2], true], [0.05, 2.6, [50, 53, 57, 62], false]]; // 페달 낮은 레 + 레·파·라·레
    const end = Math.max(...notes.map(([t, d]) => t + d));
    const n = Math.round((end + 0.4) * sr);
    const out = new Float32Array(n);
    for (const [t0, d, ms, pedal] of notes) {
      const ranks = pedal ? [[0.5, 1], [1, 0.6]] : [[1, 1], [2, 0.6], [4, 0.35]];
      for (const m of ms) {
        for (const [mul, ga] of ranks) {
          const f = hz(m) * mul * (1 + (r() - 0.5) * 0.004);
          const inc = (f * TL) / sr;
          let ph = r() * TL;
          const i0 = Math.round(t0 * sr);
          const len = Math.round(d * sr);
          const rel = Math.round(0.12 * sr);
          const g = ga / Math.sqrt(ms.length);
          for (let i = 0; i < len + rel && i0 + i < n; i++) {
            const e = i < 0.035 * sr ? i / (0.035 * sr) : i < len ? 1 : 1 - (i - len) / rel;
            out[i0 + i] += g * e * table[ph | 0];
            ph += inc;
            if (ph >= TL) ph -= TL;
          }
        }
        noiseHit(out, sr, r, { t0, amp: 0.05, attack: 0.004, tau: 0.03, type: 'bandpass', f: Math.min(6000, hz(m) * 6), q: 2 }); // 파이프가 트는 "츄"
      }
    }
    // 늘 새는 바람 소리 (아주 조금)
    const bw = new Filt('bandpass', 1200, 0.7, sr);
    for (let i = 0; i < n; i++) out[i] += 0.02 * bw.run(r() * 2 - 1);
    const lp = new Filt('lowpass', 3200, 0.6, sr); // 제단 위 높은 곳에서, 멀리
    for (let i = 0; i < n; i++) out[i] = lp.run(out[i]);
    return fadeOut(normalize(out, 0.9), sr, 0.15);
  },
};

// 미리 만들어 둘 소리 조각: [이름, 벌 수, 만드는 함수] (자주·먼저 필요한 것부터)
const BANK = [
  ['clashSoft', 4, (sr, r) => SYNTH.clash(sr, r, false)],
  ['clashHard', 5, (sr, r) => SYNTH.clash(sr, r, true)],
  ['thump', 3, SYNTH.thump],
  ['slice', 3, SYNTH.slice],
  ['wet', 3, (sr, r) => SYNTH.wet(sr, r, false)],
  ['shing', 3, SYNTH.shing],
  ['scrape', 1, SYNTH.scrape],
  ['helmet', 3, (sr, r) => SYNTH.helmet(sr, r, false)],
  ['bone', 3, SYNTH.bone],
  ['helmetHeavy', 2, (sr, r) => SYNTH.helmet(sr, r, true)],
  ['wetHeavy', 2, (sr, r) => SYNTH.wet(sr, r, true)],
  ['wood', 2, SYNTH.wood],
  ['plasmaZap', 2, SYNTH.plasmaZap],
  ['plasmaSizzle', 2, SYNTH.plasmaSizzle],
  ['rubberHonk', 2, SYNTH.rubberHonk],
  ['step', 6, (sr, r) => SYNTH.footstep(sr, r, false)],
  ['stepHeavy', 3, (sr, r) => SYNTH.footstep(sr, r, true)],
  ['fall', 3, (sr, r) => SYNTH.bodyFall(sr, r, true)],
  ['fallLight', 2, (sr, r) => SYNTH.bodyFall(sr, r, false)],
  ['breakWood', 2, (sr, r) => SYNTH.weaponBreak(sr, r, 'wood')],
  ['breakFrozen', 2, (sr, r) => SYNTH.weaponBreak(sr, r, 'frozen')],
  ['hitCut', 3, (sr, r) => SYNTH.hitSlash(sr, r, 'cut')],
  ['hitStab', 2, (sr, r) => SYNTH.hitSlash(sr, r, 'stab')],
  ['hitBlunt', 3, (sr, r) => SYNTH.hitSlash(sr, r, 'blunt')],
  ['hitArmor', 3, (sr, r) => SYNTH.hitSlash(sr, r, 'armor')],
  ['bladeCut', 3, (sr, r) => SYNTH.bladeCut(sr, r, 'cut')],
  ['bladeStab', 2, (sr, r) => SYNTH.bladeCut(sr, r, 'stab')],
  ['bladeThrough', 2, (sr, r) => SYNTH.bladeCut(sr, r, 'through')],
  ['drawnCut', 3, (sr, r) => drawnSlash(sr, r, false)],
  ['drawnHeavy', 3, (sr, r) => drawnSlash(sr, r, true)],
  ['slashCut', 3, (sr, r) => SYNTH.slashHit(sr, r, 'cut')],
  ['slashHeavy', 3, (sr, r) => SYNTH.slashHit(sr, r, 'heavy')],
  ['slashStab', 2, (sr, r) => SYNTH.slashHit(sr, r, 'stab')],
  ['slashThrough', 2, (sr, r) => SYNTH.slashHit(sr, r, 'through')],
  ['plateBreak', 2, SYNTH.plateBreak],
  ['swordLand', 3, SYNTH.swordLand],
  ['gunshot', 2, SYNTH.gunshot],
  ['gunTail', 2, SYNTH.gunTail],
  ['birdSong', 3, (sr, r) => SYNTH.bird(sr, r, 'song')], // 산사 배경 (맨 뒤: 판 시작 뒤 몇 초 안에만 있으면 된다)
  ['birdWarbler', 2, (sr, r) => SYNTH.bird(sr, r, 'warbler')],
  ['fireLoop', 1, SYNTH.fireLoop], // 성 안뜰·어두운 홀
  ['rainLoop', 1, SYNTH.rainLoop], // 화전 터
  ['clothFlap', 2, SYNTH.clothFlap], // 밤의 포세이돈 (찢어진 천)
  ['dove', 2, SYNTH.dove], // 대성당
  ['wings', 2, SYNTH.wings], // 대성당 비둘기·홀 박쥐
  ['debris', 2, SYNTH.debris], // 대성당
  ['horseSnort', 2, (sr, r) => SYNTH.horse(sr, r, 'snort')], // 성 안뜰 마구간
  ['horseStamp', 2, (sr, r) => SYNTH.horse(sr, r, 'stamp')],
  ['organ', 1, SYNTH.organ], // 대성당 판 시작
  ['castleBell', 3, SYNTH.castleBell], // 성 안뜰 종탑
];
// 목소리 조각은 이름이 "voice:캐릭터id:ko|bleed" 이고, 이번 판에 나오는 캐릭터 것만 만든다 (prepareVoices)
const VOICE_COUNT = 2;
function bankEntry(name) {
  if (name.startsWith('voice:')) {
    const [, id, kind] = name.split(':');
    return [name, VOICE_COUNT, (sr, r) => SYNTH.voice(sr, r, VOICES[id] || VOICES.generic, kind)];
  }
  return BANK.find((b) => b[0] === name);
}
/** 소리 조각 하나 만들기 (일꾼 스레드 soundgen.js 에서도 부른다) */
export function makeBankSound(name, sr, seed) {
  return bankEntry(name)[2](sr, makeRng(seed));
}

// 녹음된 소리 (Kenney.nl, CC0). 없거나 못 읽어도 합성 소리만으로 동작한다
const nums = (base, k) => Array.from({ length: k }, (_, i) => `${base}${i + 1}`);
const SAMPLES = {
  punch: ['punch1', 'punch2', 'punch3', 'punch4', 'punch5'], // 몸통을 세게 치는 "퍽" (Kenney impactPunch_heavy)
  punchMed: nums('hit/punch_med', 5), // 가볍게 치는 "퍽" (Kenney impactPunch_medium)
  soft: nums('hit/soft', 5), // 누비옷 너머로 몸통 덩어리가 받는 둔한 "쿵" (Kenney impactSoft_heavy)
  woodHit: nums('hit/wood', 5), // 나무 몽둥이 (Kenney impactWood_medium)
  woodHeavy: nums('hit/wood_heavy', 3), // (Kenney impactWood_heavy)
  step: nums('step/sand', 8), // 모래 위 무거운 발걸음: 둔한 뒤꿈치 "쿵"(Kenney footstep_carpet) + 눌리는 크런치(footstep_snow), 음을 낮추고 고음을 깎음
  stepGravel: nums('step/gravel', 8), // 산사 마사토 발걸음: 같은 뒤꿈치 "쿵" + 굵은 자갈 "자박"(OGA gravel), 모래보다 알갱이가 또렷하다
  leaves: nums('stage/leaves', 2), // 산사 낙엽 바스락 (OGA leaves) — 큰 타격에 단풍잎이 흩날릴 때
  stepSnow: nums('step/snow', 8), // 성 안뜰 다져진 눈 "뽀득" (Kenney footstep_carpet + footstep_snow)
  stepStone: nums('step/stone', 8), // 대성당·홀 판석 "턱" (Kenney footstep_carpet + footstep_concrete), 또각이지 않게 낮추고 위를 닫음
  stepMud: nums('step/mud', 8), // 화전 터의 젖은 재·흙 "저벅" (Kenney footstep_carpet 뒤꿈치 + BenDrain 진흙, 저음 웅웅거림은 깎음)
  chant: ['stage/chant1'], // 이졸데 부활: 짧은 그레고리안 성가 한 구절 (녹음, 사장님 요청)
  crow: nums('stage/crow', 3), // 화전 터 먼 까마귀 "까악" (Freesound CC0 셋, 멀리 들리게 위를 닫음)
  crack: ['crack1'], // 나무 쪼개지는 "딱" → 뼈 부러지는 소리로 쓴다 (효과음에서 흔히 쓰는 방법)
  slide: ['slide1', 'slide2'], // 칼날이 미끄러지는 "스르릉"
  breath: ['breath/breath1'], // 피를 흘리는 내 숨 한 번: 들이쉬고 "후우" (Sadiquecat, CC0)
  // 칼이 몸을 칠 때 "녹음" 안 (33차 후보, Freesound CC0 — 출처 public/sfx/LICENSE.txt). SOUND.fleshHit 이 'rec' 일 때만 쓴다
  fleshEdge: nums('flesh/edge', 5), // 날 선 칼이 살에 들어가는 매끈한 "슉" (칼·검 찌르기 녹음, 멜론 찌르기)
  fleshWet: nums('flesh/wet', 2), // 깊이 베였을 때 젖은 꼬리 (피 튀는 소리, 위를 3.5kHz 에서 닫음)
};

// 배경(스테이지)마다 다른 것: 발소리 녹음(step), 쓰러질 때 바닥 알갱이(grit), 전투 소리가 벽에 되울리는 방(room).
// room: reverbIR 모양 + 쇳소리(metal)·몸 소리(flesh)를 울림으로 보내는 양. 바깥(포세이돈·산사)은 울림 없음
const STAGE_SOUND = {
  poseidon: { step: 'step' },
  poseidon_night: { step: 'step', night: true }, // 밤의 포세이돈 (하인리히 재등장): 같은 바다·바람에 네 귀퉁이 화로·횃대의 불을 더하고 바람을 어둡게
  temple: { step: 'stepGravel', grit: 'stepGravel' },
  castle: { step: 'stepSnow', grit: 'stepSnow', room: { dur: 0.8, rt: 0.55, e0: 0.04, e1: 0.11, lp: 4000, metal: 0.22, flesh: 0.08 } }, // 성벽에 짧게 튕기는 메아리
  cathedral: { step: 'stepStone', grit: 'stepStone', room: { dur: 2.8, rt: 2.5, e0: 0.03, e1: 0.14, lp: 3500, metal: 0.4, flesh: 0.16 } }, // 돌 성당의 긴 울림
  darkhall: { step: 'stepStone', room: { dur: 1.6, rt: 1.3, e0: 0.02, e1: 0.08, lp: 3000, metal: 0.28, flesh: 0.12 } }, // 휘장·카펫이 있어 성당보다 짧고 어둡다
  clearing: { step: 'stepMud', grit: 'stepMud', rain: true }, // 화전 터 2안 (브란의 고향, 오너 선택): 봄비 내리는 탄 흙 비탈. 바깥이라 울림 없음
  clearing_a: { step: 'stepMud', grit: 'stepMud', rain: true }, // 같은 컨셉의 1안 (보관용, ?stage=clearing_a — 오너는 2안을 골랐다)
  clearing_a_dry: { step: 'stepMud', grit: 'stepMud', rain: false }, // 1안의 비 없는 판: 비만 뺀다
};

// ─────────────────────────────────────────────────────────────
//  실제로 소리를 내는 부분
// ─────────────────────────────────────────────────────────────
export class Sound {
  constructor() {
    this.ctx = null;
    this._on = true;
    this.bank = {};
    this.samples = {};
    this.voices = [];
    this.useSamples = SOUND.samples;
    this.stats = { events: 0, nodes: 0, stolen: 0, genMs: 0 };
    this._lastClash = { t: -1, x: 0 };
    this.seed = (Math.random() * 1e9) | 0;
    this.stage = 'poseidon'; // 배경: STAGE_SOUND 의 id (poseidon·temple·castle·cathedral·darkhall). setStage 로 바꾼다
    this._timers = new Set(); // 배경의 가끔 나는 소리(풍경·새·비둘기…) 예약
  }

  get on() {
    return this._on;
  }
  /** 소리 켜기/끄기: 끄면 새 소리를 안 내고, 울리고 있던 꼬리(울림·고리 소리)도 바로 줄인다 */
  set on(v) {
    this._on = !!v;
    if (this.master) this.master.gain.setTargetAtTime(this._on ? SOUND.volume : 0, this.ctx.currentTime, 0.02);
  }

  /**
   * 브라우저 규칙상 사용자가 화면을 누른 뒤에만 소리를 켤 수 있다 → 시작 버튼을 누를 때 부른다.
   * ctx 를 주면 그 오디오 문맥을 쓴다 (소리 분석용 OfflineAudioContext)
   */
  unlock(ctx) {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!ctx && !AC) return;
      // 아이폰: 무음 스위치를 켜 두면 웹 소리(Web Audio)가 통째로 꺼진다. 음악 앱처럼 "재생" 용도로 알리면
      // 무음 모드에서도 소리가 난다 (Safari 17 / iOS 17부터 되는 Audio Session API)
      if (!ctx) {
        try {
          if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback';
        } catch {
          /* 지원하지 않는 브라우저 */
        }
      }
      this.ctx = ctx || new AC();
      this.build();
      if (!this.ctx.startRendering) this.prepareSoon(); // (분석용 OfflineAudioContext 는 prepareAll 로 한꺼번에)
      this.samplesReady = this.useSamples ? this.loadSamples() : Promise.resolve();
    }
    // 폰이 전화·잠금 등으로 소리를 멈췄으면 다시 켠다 (아이폰은 'interrupted'). 분석용 OfflineAudioContext 는 빼고
    const st = this.ctx.state;
    if ((st === 'suspended' || st === 'interrupted') && !this.ctx.startRendering) this.ctx.resume().catch(() => {});
    // 아이폰: 손가락을 댄 그 순간에 아주 짧은 무음을 한 번 재생해 두어야 소리 장치가 확실히 켜진다
    if (!this.primed && !this.ctx.startRendering) {
      this.primed = true;
      try {
        const b = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = b;
        src.connect(this.ctx.destination);
        src.start(0);
      } catch {
        this.primed = false;
      }
    }
  }

  /** 경기장 울림 세기 바꾸기 (0 = 끔) */
  setReverb(amount) {
    for (const s of this.sends || []) s.g.gain.setTargetAtTime(s.amt * amount, this.ctx.currentTime, 0.02);
  }

  /** 소리 길: 소리들 → (쇳소리 / 살 소리 묶음) → 전체 음량 → 리미터(찢어지지 않게) → 스피커. 묶음마다 울림을 조금씩 보낸다 */
  build() {
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this._on ? SOUND.volume : 0;
    // 여러 소리가 겹쳐도 소리가 깨지지(클리핑) 않게: 큰 소리를 부드럽게 누르고(컴프레서),
    // 그래도 넘치는 순간은 둥글게 깎는다(소프트 클리퍼: 입력 ±2 까지를 ±0.95 안으로)
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -6;
    lim.knee.value = 6;
    lim.ratio.value = 8;
    lim.attack.value = 0.002;
    lim.release.value = 0.1;
    const clip = c.createWaveShaper();
    const curve = new Float32Array(1025);
    for (let i = 0; i < curve.length; i++) {
      const x = ((i / (curve.length - 1)) * 2 - 1) * 2; // −2 ~ 2
      const a = Math.abs(x);
      curve[i] = Math.sign(x) * (a < 0.7 ? a : 0.7 + 0.25 * Math.tanh((a - 0.7) / 0.25));
    }
    clip.curve = curve;
    const pre = c.createGain();
    pre.gain.value = 0.5; // 곡선의 입력 범위(−1~1)에 ±2 를 담으려고 반으로 줄인다 (곡선 값은 원래 크기)
    // 먹먹함 필터: 평소엔 활짝 열려 있다가 내가 쓰러지면 닫혀서 소리가 물속처럼 멀어진다 (setMuffle)
    this.muffle = c.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 20000;
    this.muffle.Q.value = 0.5;
    this.master.connect(this.muffle).connect(lim).connect(pre).connect(clip).connect(c.destination);
    this.metalBus = c.createGain();
    this.fleshBus = c.createGain();
    this.metalBus.connect(this.master);
    this.fleshBus.connect(this.master);
    if (SOUND.reverb > 0) {
      const conv = c.createConvolver();
      const [L, R] = SYNTH.reverbIR(c.sampleRate, makeRng(7));
      const ir = c.createBuffer(2, L.length, c.sampleRate);
      ir.getChannelData(0).set(L);
      ir.getChannelData(1).set(R);
      conv.normalize = false;
      conv.buffer = ir;
      conv.connect(this.master);
      this.sends = [];
      const send = (bus, amt) => {
        const g = c.createGain();
        g.gain.value = amt * SOUND.reverb;
        bus.connect(g).connect(conv);
        this.sends.push({ g, amt });
      };
      send(this.metalBus, 1); // 쇳소리는 관중석에 크게 되울린다
      send(this.fleshBus, 0.4);
    }
    // 바람 소리용 흰 잡음 (0.4초, 되풀이해서 쓴다)
    const len = Math.round(c.sampleRate * 0.4);
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    const r = makeRng(this.seed);
    for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
    this._applyRoom();
  }

  /**
   * 소리 조각 만들기: 일꾼 스레드(Web Worker, soundgen.js)에서 계산해서 받는다 → 게임 화면이 멈칫하지 않는다.
   * 일꾼을 못 쓰는 브라우저면 메인 스레드에서 한 번에 하나씩 나눠서 만든다.
   */
  prepareSoon() {
    const jobs = [];
    for (const [name, count] of BANK) for (let i = 0; i < count; i++) jobs.push({ name, seed: this.seedFor(name, i) });
    this.runJobs(jobs);
  }
  /**
   * 이번 판에 나오는 캐릭터들의 죽음 목소리를 미리 만든다 (판을 시작할 때 main.js 가 부른다).
   * 다른 캐릭터 목소리는 버려서 메모리를 아낀다 (한 벌에 약 0.3MB)
   */
  prepareVoices(ids) {
    if (!this.ctx) return;
    const keep = new Set();
    for (const id of ids) if (!VOICES[id]?.mute) for (const kind of ['ko', 'bleed']) keep.add(`voice:${id}:${kind}`);
    for (const name of Object.keys(this.bank)) if (name.startsWith('voice:') && !keep.has(name)) delete this.bank[name];
    const jobs = [];
    for (const name of keep) for (let i = this.bank[name]?.length || 0; i < VOICE_COUNT; i++) jobs.push({ name, seed: this.seedFor(name, i) });
    if (jobs.length) this.runJobs(jobs);
    this.voicesReady = this.useSamples ? this.loadVoiceSamples(ids) : Promise.resolve();
  }
  runJobs(jobs) {
    if (this.ctx.startRendering) return this.prepareOnMain(jobs); // 분석용 OfflineAudioContext
    try {
      const w = new Worker(new URL('./soundgen.js', import.meta.url), { type: 'module' });
      let left = jobs.length;
      w.onmessage = (e) => {
        this.addBuffer(e.data.name, e.data.data);
        this.stats.genMs += e.data.ms;
        if (--left === 0) w.terminate();
      };
      w.onerror = () => {
        w.terminate();
        this.prepareOnMain(jobs);
      };
      w.postMessage({ jobs, sr: this.ctx.sampleRate });
    } catch {
      this.prepareOnMain(jobs);
    }
  }
  prepareOnMain(jobs) {
    const next = () => {
      const j = jobs.shift();
      if (!j) return;
      if (this.need(j.name)) this.makeOne(j.name);
      setTimeout(next, 0);
    };
    setTimeout(next, 0);
  }
  /** 모든 소리 조각을 지금 바로 만든다 (분석용) */
  prepareAll() {
    for (const [name] of BANK) while (this.need(name)) this.makeOne(name);
  }
  seedFor(name, i) {
    let h = 0;
    if (name.startsWith('voice:')) for (let k = 0; k < name.length; k++) h = (Math.imul(h, 31) + name.charCodeAt(k)) | 0;
    return this.seed + name.charCodeAt(0) * 7919 + name.length * 131 + i * 104729 + h;
  }
  need(name) {
    return (this.bank[name]?.length || 0) < bankEntry(name)[1];
  }
  addBuffer(name, data) {
    if (!this.need(name)) return null; // (일꾼이 만든 것과 급히 만든 것이 겹치면 버린다)
    const buf = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate);
    buf.getChannelData(0).set(data);
    (this.bank[name] = this.bank[name] || []).push(buf);
    return buf;
  }
  /** 지금 바로 하나 만든다 (필요한데 아직 도착하지 않았을 때) */
  makeOne(name) {
    const t0 = performance.now();
    const buf = this.addBuffer(name, makeBankSound(name, this.ctx.sampleRate, this.seedFor(name, this.bank[name]?.length || 0)));
    this.stats.genMs += performance.now() - t0;
    return buf;
  }
  /** 이름으로 소리 조각 하나를 무작위로 (아직 하나도 없으면 지금 만든다) */
  pick(name) {
    const list = this.bank[name];
    if (!list || !list.length) return this.makeOne(name);
    return list[(Math.random() * list.length) | 0];
  }
  pickSample(name) {
    if (!this.useSamples) return null;
    const list = this.samples[name];
    if (!list || !list.length) return null;
    // 바로 앞에 쓴 것은 피한다 (발소리처럼 자주 나는 소리가 똑같이 두 번 연달아 나면 기계처럼 들린다)
    this._lastPick = this._lastPick || {};
    let i = (Math.random() * list.length) | 0;
    if (list.length > 1 && i === this._lastPick[name]) i = (i + 1 + ((Math.random() * (list.length - 1)) | 0)) % list.length;
    this._lastPick[name] = i;
    return list[i];
  }

  /** 녹음된 소리 읽기 (첫 화면 터치 뒤에, 뒤에서 천천히) */
  async loadSamples() {
    // 한꺼번에 받는다 (하나씩 받으면 발소리처럼 판 시작부터 필요한 소리가 몇 초 늦는다). 순서는 목록 순서로 맞춘다
    const jobs = [];
    for (const [name, files] of Object.entries(SAMPLES)) files.forEach((f, i) => jobs.push(this.decodeSample(f).then((buf) => buf && (((this.samples[name] = this.samples[name] || [])[i] = buf)))));
    await Promise.all(jobs);
    for (const name of Object.keys(SAMPLES)) if (this.samples[name]) this.samples[name] = this.samples[name].filter(Boolean);
  }
  async decodeSample(f) {
    const c = this.ctx;
    try {
      const res = await fetch(new URL(`sfx/${f}.mp3`, document.baseURI));
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      const buf = await new Promise((ok, bad) => c.decodeAudioData(ab, ok, bad)?.then?.(ok, bad));
      return trimStart(c, buf);
    } catch {
      return null; // 못 읽으면 합성 소리만 쓴다
    }
  }
  async loadSample(name, f) {
    const c = this.ctx;
    try {
      const res = await fetch(new URL(`sfx/${f}.mp3`, document.baseURI));
      if (!res.ok) return;
      const ab = await res.arrayBuffer();
      // 옛 사파리는 콜백 방식만 된다. 요즘 브라우저는 promise 도 함께 돌려주는데, 못 읽으면 그 promise 도
      // 실패해서 "처리 안 된 오류"가 콘솔에 뜬다 → promise 쪽 결과도 같은 곳(ok/bad)으로 받는다 (두 번 불려도 한 번만 처리됨)
      const buf = await new Promise((ok, bad) => c.decodeAudioData(ab, ok, bad)?.then?.(ok, bad));
      (this.samples[name] = this.samples[name] || []).push(trimStart(c, buf));
    } catch {
      /* 못 읽으면 합성 소리만 쓴다 */
    }
  }
  /** 이번 판 캐릭터들의 녹음된 목소리 읽기 (public/sfx/voice/<id>_<ko|bleed|hurt><번호>.mp3). 다른 캐릭터 것은 버린다 */
  async loadVoiceSamples(ids) {
    for (const name of Object.keys(this.samples)) if (name.startsWith('voice:') && !ids.includes(name.split(':')[1])) delete this.samples[name];
    for (const id of ids) {
      const rec = VOICES[id]?.rec;
      if (!rec) continue;
      for (const kind of ['ko', 'bleed', 'hurt', 'revive']) {
        const name = `voice:${id}:${kind}`;
        if (this.samples[name]) continue;
        this.samples[name] = [];
        for (let n = 1; n <= (rec[kind] || 0); n++) await this.loadSample(name, `voice/${id}_${kind}${n}`);
      }
    }
  }

  // ── 소리 하나(이벤트) 틀기 ──
  // 소리 조각 여러 겹 → 각자 음량 → (밝기 필터) → 이벤트 음량 → 묶음(bus)
  // 동시에 너무 많이 울리면 가장 오래된 소리를 빨리 줄여서 끈다 (폰 부담)
  event({ bus, gain = 1, bright = 0, prio = 1, pos = null }) {
    const c = this.ctx;
    const now = c.currentTime;
    if (prio >= 0.3) this._roundOpen = false; // 싸움 소리(발소리 이상)가 났다 → 다음 roundStart 는 새 판이다
    this.voices = this.voices.filter((v) => v.end > now);
    while (this.voices.length >= SOUND.maxVoices) {
      this.voices.sort((a, b) => a.prio - b.prio || a.start - b.start);
      const v = this.voices.shift();
      v.out.gain.setTargetAtTime(0, now, 0.01);
      for (const s of v.srcs) {
        try {
          s.stop(now + 0.06);
        } catch {
          /* 옛 사파리: stop 을 두 번 부르면 오류 */
        }
      }
      this.stats.stolen++;
    }
    const out = c.createGain();
    out.gain.value = gain;
    let input = out;
    let nodes = 1;
    if (bright > 0) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = Math.min(bright, c.sampleRate * 0.45);
      f.Q.value = 0.5;
      f.connect(out);
      input = f;
      nodes++;
    }
    // 자리(pos.x, 왼쪽/오른쪽)를 주면 살짝 팬 (무기 시스템에서 부딪힌 위치를 알려줄 때)
    if (pos && typeof pos.x === 'number' && c.createStereoPanner) {
      const pan = c.createStereoPanner();
      pan.pan.value = Math.max(-1, Math.min(1, pos.x / 4));
      out.connect(pan).connect(bus);
      nodes++;
    } else {
      out.connect(bus);
    }
    const ev = { out, input, srcs: [], end: now, start: now, prio };
    this.voices.push(ev);
    this.stats.events++;
    this.stats.nodes += nodes;
    return ev;
  }
  /** 이벤트에 소리 조각 한 겹 더하기 */
  // dur: 이 길이(초)만 틀고 끝을 줄여 끈다 (약한 소리는 긴 울림 꼬리가 어차피 안 들린다 → 폰 부담 줄이기)
  layer(ev, buf, { gain = 1, rate = 1, delay = 0, dur = 0 } = {}) {
    if (!buf || gain <= 0.001) return;
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = rate;
    let node = s;
    if (Math.abs(gain - 1) > 0.02) {
      node = c.createGain();
      node.gain.value = gain;
      s.connect(node);
      this.stats.nodes++;
    }
    const t = c.currentTime + delay;
    s.start(t); // (stop 보다 먼저 불러야 한다)
    let len = buf.duration / rate;
    if (dur > 0 && dur < len - 0.05) {
      // 끝을 부드럽게 줄이고 끈다 (이 소리 층만 따로 줄이려고 음량 노드를 하나 둔다)
      if (node === s) {
        node = c.createGain();
        s.connect(node);
        this.stats.nodes++;
      }
      node.gain.setTargetAtTime(0, t + dur - 0.12, 0.03);
      len = dur;
      s.stop(t + dur);
    }
    node.connect(ev.input);
    ev.srcs.push(s);
    ev.end = Math.max(ev.end, t + len);
    this.stats.nodes++;
  }

  // ─────────────────────────────────────────────────────────────
  //  게임에서 부르는 소리들
  // ─────────────────────────────────────────────────────────────

  /**
   * 칼끼리 부딪힘.
   * @param impact 부딪히는 속도 (m/s, 맞닿는 방향). 세기와 밝기가 여기서 정해진다
   * @param slide  칼날을 따라 스치는 속도 (m/s). 크면 "스르릉" 긁히는 소리가 섞인다
   */
  clash(impact, slide = 0) {
    if (!this._on || !this.ctx) return;
    // 세기 0~1: 부딪히는 속도 0.3 → 7.8 m/s (AI 대결에서 중간값 2m/s, 상위 10% 6m/s, 사람이 세게 치면 10m/s 넘게)
    const x = clamp01((impact - 0.3) / 7.5);
    const glance = clamp01((slide - 1.2) / 6) * clamp01(slide / (impact + slide + 1e-6) * 1.6 - 0.4);
    if (x <= 0 && glance <= 0) return;
    // 아주 짧은 사이에 거듭 닿으면(칼이 떨며 몇 번 부딪힘) 더 센 것만 낸다
    const now = this.ctx.currentTime;
    if (now - this._lastClash.t < 0.06 && x <= this._lastClash.x + 0.15) return;
    this._lastClash = { t: now, x };
    const vol = 0.18 + 0.82 * x ** 0.7; // 약 −15dB ~ 0dB
    // 세게 칠수록 두 칼이 맞닿는 시간이 짧아져서 높은 소리까지 울린다 (거의 최대면 필터 없이)
    const bright = 5000 + 11000 * x ** 1.3; // (하한이 낮으면 약한 타격의 날카로운 성분이 잘려 가운데 울림만 "통" 하고 남는다)
    const ev = this.event({ bus: this.metalBus, gain: vol, bright: bright < 12000 ? bright : 0, prio: 1 + x });
    // 세기에 따라 층을 고른다 (녹음 효과음의 "세기 층" 방식): 약하게 = 둔탁한 "텅", 세게 = "쨍그렁".
    // 0.15~0.55 사이에서는 센 층이 나올 확률이 점점 커진다
    const hardP = clamp01((x - 0.15) / 0.4);
    const buf = Math.random() < hardP ? this.pick('clashHard') : this.pick('clashSoft');
    const pitch = between(Math.random, 0.93, 1.05) * (1 - 0.05 * x); // 세게 치면 살짝 낮게 (더 무겁게)
    const skim = 1 - 0.6 * glance; // 스친 타격은 덜 울린다
    this.layer(ev, buf, { gain: skim, rate: pitch, dur: 0.35 + 1.1 * x });
    if (glance > 0) this.shing(ev, glance, slide);
  }

  /** 스치는 "스르릉" 한 번 (clash 가 부른다) */
  shing(ev, amount, slide) {
    const rate = 0.85 + 0.25 * clamp01(slide / 10);
    this.layer(ev, this.pick('shing'), { gain: 0.9 * amount, rate, delay: 0.004 });
    const rec = this.pickSample('slide');
    if (rec) this.layer(ev, rec, { gain: 0.5 * amount, rate: rate * between(Math.random, 0.8, 0.95), delay: 0.006 });
  }

  /** 투구를 친 소리: 짧고 뭉툭한 "퍽-크덕" (머리가 받는 "쿵"은 조각 안에 들어 있고, 몸통 소리는 main.js 가 blunt 로 따로 낸다) */
  helmet(energy) {
    if (!this._on || !this.ctx) return;
    const e = clamp01(energy / 110);
    const ev = this.event({ bus: this.metalBus, gain: 0.35 + 0.65 * e ** 0.8, bright: e > 0.4 ? 0 : 5000 + 12000 * e, prio: 2 });
    // 세기에 따라 층을 고른다: 약하게 = 가벼운 "깡", 세게(찌그러짐) = 저역이 실린 "퍽-크덕"
    const heavyP = clamp01((e - 0.35) / 0.4);
    const buf = Math.random() < heavyP ? this.pick('helmetHeavy') : this.pick('helmet');
    this.layer(ev, buf, { rate: between(Math.random, 0.92, 1.04) * (1 - 0.06 * e) });
    // 대전 게임식 "챡-징!": 맞은 순간을 또렷하게 (세게 맞을수록 크게)
    this.layer(ev, this.pick('hitArmor'), { gain: 0.45 + 0.4 * e, rate: between(Math.random, 0.94, 1.06) });
  }

  /** 몸통 "퍽" 한 겹 (녹음된 소리가 있으면 둘 다 섞는다) */
  body(ev, gain, rate = 1) {
    // 녹음된 주먹 "퍽"(세면 heavy) + 누비옷 너머 몸통 덩어리의 "쿵". 합성 "퍽"은 녹음이 있으면 살짝만 (없으면 이것만)
    const rec = this.pickSample(gain >= 0.8 ? 'punch' : 'punchMed') || this.pickSample('punch');
    const soft = this.pickSample('soft');
    this.layer(ev, this.pick('thump'), { gain: rec ? gain * 0.35 : gain, rate: rate * between(Math.random, 0.9, 1.1) });
    if (rec) this.layer(ev, rec, { gain: gain * 0.8, rate: rate * between(Math.random, 0.92, 1.06) });
    if (soft) this.layer(ev, soft, { gain: gain * 0.5, rate: rate * between(Math.random, 0.9, 1.05) });
  }

  /**
   * 에너지(J) → 세기 (29차, 디렉터: 온몸 타격 R3 대비. 베기·찌르기·강철 충돌이 함께 쓴다).
   *  e   지금까지의 눈금 그대로: clamp01(energy / e0). e0 는 소리마다 다르다(베기 140, 찌르기 100, 강철 90). 그 위는 포화.
   *  w   무게. hitScale 이 'log' 일 때만 0 이 아니다. SOUND.hitKnee(200 J)까지는 0 — 지금 게임 소리와 같다.
   *      그 위는 로그 눈금 w = log2(E / 200) / log2(500 / 200): 300 J ≈ 0.44, 500 J = 1, 1000 J ≈ 1.76 (상한 없이 천천히 오른다).
   *      소리는 w 를 크기(×(1+0.7w) ≈ +4.6dB@500), 낮은 음(low ≈ -16%@500), 묵직한 저음 한 겹(0.8w)으로 바꾼다.
   *  low 재생 속도 배율 2^(-0.25w) — 무거우면 낮아진다. w = 0 이면 1.
   */
  hitWeight(energy, e0) {
    const e = clamp01(energy / e0);
    const knee = SOUND.hitKnee ?? 200;
    const heavy = SOUND.hitHeavy ?? 500;
    const w = this.hitScale === 'log' && energy > knee ? Math.log2(energy / knee) / Math.log2(heavy / knee) : 0;
    return { e, w, low: 2 ** (-0.25 * w) };
  }
  /** 타격 세기 눈금: 'legacy'(지금, 기본 = SOUND.hitScale) | 'log'(hitWeight 의 무게 w 를 켠다). R3 에서 디렉터가 한 줄로 넘긴다 */
  get hitScale() {
    return this._hitScale ?? SOUND.hitScale ?? 'legacy';
  }
  set hitScale(v) {
    this._hitScale = v;
  }
  /**
   * 칼이 몸을 칠 때의 소리 (31·33차 후보, 사장님 "전자 파리채로 모기 잡는 소리 같아" → 31차 안은 "둔기·죽도 같다"): 'legacy' = 지금(5차 hitSlash),
   * 'synth' = 날 선 칼 합성(bladeCut), 'rec' = 날 선 칼 녹음(flesh/edge*.mp3 + 젖은 꼬리, 없으면 합성),
   * 'drawn' = 사용자 선택 A2/B2 단축 베기(약 .26초/강 .35초), 찌르기는 기존 samsho 유지.
   * 'samsho' = 대전 게임식 2(34·35차 slashHit: "자-쩌억 + 쿵 + 촤아악", 강베기는 두껍고 길게). 기본은 SOUND.fleshHit.
   * 베기·찌르기만 바뀐다. 칼 면(blunt)·투구·판금 소리는 그대로
   */
  get fleshHit() {
    return this._fleshHit ?? SOUND.fleshHit ?? 'legacy';
  }
  set fleshHit(v) {
    this._fleshHit = v;
  }

  /**
   * 녹음 안(33차): 날 선 칼이 살에 들어가는 "슉" 녹음(fleshEdge) + 합성 bladeCut 의 갈라지는 "쯔억"·작은 "툭"을 조금 + 깊으면 젖은 꼬리.
   * 녹음이 아직 안 읽혔으면 false → 합성으로 낸다
   */
  _fleshRec(ev, kind, e, low) {
    const edge = this.pickSample('fleshEdge');
    if (!edge) return false;
    this.layer(ev, edge, { gain: 1.2, rate: low * (kind === 'stab' ? between(Math.random, 0.85, 0.95) : between(Math.random, 0.95, 1.08)) });
    const syn = kind === 'stab' ? 'bladeStab' : kind === 'through' ? 'bladeThrough' : 'bladeCut';
    this.layer(ev, this.pick(syn), { gain: 0.35, rate: low * between(Math.random, 0.95, 1.05), delay: 0.004 });
    const wet = e > 0.3 ? this.pickSample('fleshWet') : null;
    if (wet) this.layer(ev, wet, { gain: 0.15 + 0.3 * e, rate: between(Math.random, 0.95, 1.1), delay: 0.012 });
    return true;
  }

  /** 베기: 천이 찢기고 살을 가르는 "쉭-지직" + 젖은 소리 + 몸통 "퍽". through = 베고 지나감 */
  cut(energy, through) {
    if (!this._on || !this.ctx) return;
    const { e, w, low } = this.hitWeight(energy, 140);
    const mode = this.fleshHit;
    const drawn = mode === 'drawn';
    const strong = energy >= DRAWN_SLASH.strongEnergy;
    const ev = this.event({ bus: this.fleshBus, gain: (0.45 + 0.6 * e ** 0.8) * (1 + 0.7 * w) * (drawn ? DRAWN_SLASH.gain : 1), prio: 2 });
    if (drawn) {
      // Both are shortened heavy-source A2/B2 timbres. Penetration alone is not strength.
      this.layer(ev, this.pick(strong ? 'drawnHeavy' : 'drawnCut'), { gain: 1, rate: low * between(Math.random, 0.96, 1.05) });
    } else if (mode === 'samsho') {
      // 대전 게임식 2 (34·35차): "자-쩌억 + 쿵 + 촤아악" — 금속 울림·클릭 없이
      // 강베기(에너지 112 J 위, e ≥ 0.8)와 베고 지나감은 두껍고 긴 판, 보통 베기는 짧은 판
      this.layer(ev, this.pick(through ? 'slashThrough' : e >= 0.8 ? 'slashHeavy' : 'slashCut'), { gain: 1, rate: low * between(Math.random, 0.96, 1.05) });
    } else if (mode === 'legacy') {
      // 대전 게임식 "챡-촤악-징 퍽": 맞은 순간이 또렷하게 튀어나와야 한다 (예전엔 누비옷 너머 둔한 "쿵" 위주라 흐릿했다)
      // 베고 지나가면 칼바람 꼬리를 길게(느리게 틀기)
      this.layer(ev, this.pick('hitCut'), { gain: 1, rate: low * (through ? between(Math.random, 0.85, 0.92) : between(Math.random, 0.96, 1.06)) });
      // 천이 찢기며 살을 가르는 "지직"은 뒤에 작게
      this.layer(ev, this.pick('slice'), { gain: 0.3 + 0.2 * e, rate: low * (through ? between(Math.random, 0.72, 0.82) : between(Math.random, 0.9, 1.1)), delay: 0.01 });
    } else if (!(mode === 'rec' && this._fleshRec(ev, through ? 'through' : 'cut', e, low))) {
      // 날 선 칼 합성: 매끈한 "슉" + 갈라지는 "쯔억" + 작은 "툭" (베고 지나가면 갈라지는 소리를 길게)
      this.layer(ev, this.pick(through ? 'bladeThrough' : 'bladeCut'), { gain: 1, rate: low * between(Math.random, 0.95, 1.06) });
    }
    // 깊이 베인 큰 상처(e 높음)는 물컹한 크런치가 섞인 "젖은" 소리로
    this.layer(ev, this.pick(e > 0.55 ? 'wetHeavy' : 'wet'), { gain: (mode === 'legacy' ? 1 : 0.65) * (0.3 + 0.4 * e) * (1 + 0.3 * w) * (drawn ? (strong ? 0.06 : 0.025) : 1), rate: between(Math.random, 0.85, 1.15), delay: 0.015 });
    // 몸통 "퍽"(주먹 녹음 + 누비옷 쿵): 날 선 칼은 몽둥이처럼 몸을 밀지 않는다 → 새 안에서는 작게(0.25배). 이 층이 31차 안을 "둔기"로 들리게 했다
    this.body(ev, (mode === 'legacy' ? 1 : 0.25) * (through ? 0.45 + 0.3 * e : 0.6 + 0.4 * e) * (1 + 0.5 * w) * (drawn ? (strong ? 0.035 : 0) : 1), low);
    if (w > 0 && !drawn) this.layer(ev, this.pick('thump'), { gain: 0.8 * w, rate: 0.7 * low, delay: 0.004 }); // drawn은 승인된 저음 비율 유지
  }

  /** 찌르기: 무겁고 짧은 "퍽" + 푹 들어가는 젖은 소리 */
  stab(energy) {
    if (!this._on || !this.ctx) return;
    const { e, w, low } = this.hitWeight(energy, 100);
    const ev = this.event({ bus: this.fleshBus, gain: (0.45 + 0.6 * e ** 0.8) * (1 + 0.7 * w), prio: 2 });
    const mode = this.fleshHit;
    if (mode === 'samsho' || mode === 'drawn') this.layer(ev, this.pick('slashStab'), { gain: 1, rate: low * between(Math.random, 0.95, 1.05) }); // 대전 게임식 2 "자-푹 + 쿵 + 촤악"
    else if (mode === 'legacy') this.layer(ev, this.pick('hitStab'), { gain: 1, rate: low * between(Math.random, 0.95, 1.05) }); // 대전 게임식 "챡-푹"
    else if (!(mode === 'rec' && this._fleshRec(ev, 'stab', e, low))) this.layer(ev, this.pick('bladeStab'), { gain: 1, rate: low * between(Math.random, 0.95, 1.05) }); // 날 선 칼 "슉-푹"
    this.body(ev, (mode === 'legacy' ? 0.85 : 0.3) * (1 + 0.5 * w), 0.85 * low); // 찌르기는 칼끝이 몸을 조금 민다 — 베기보다는 크게
    this.layer(ev, this.pick('wet'), { gain: (mode === 'legacy' ? 1 : 0.65) * (0.5 + 0.4 * e) * (1 + 0.3 * w), rate: low * between(Math.random, 0.7, 0.85), delay: 0.008 });
    if (mode === 'legacy') this.layer(ev, this.pick('slice'), { gain: 0.3, rate: 1.3, delay: 0.004 }); // 천을 뚫는 짧은 "틱" (새 안에서는 뺀다 — "지직"의 한 원인)
    if (w > 0) this.layer(ev, this.pick('thump'), { gain: 0.8 * w, rate: 0.7 * low, delay: 0.004 }); // 무게(200 J 위): 묵직한 저음 한 겹
  }

  /** 둔기(칼 면, 손잡이, 막힌 베기): "퍽" + 칼 면이 몸을 때리는 둔한 쇳소리 */
  blunt(energy) {
    if (!this._on || !this.ctx) return;
    // 칼끝이 스치는 약한 접촉(10J 안팎)은 싸움 중 1초에 한 번꼴로 난다 → 아주 약하게 (15J 넘어야 제대로 "퍽")
    if (energy < 5) return;
    const e = clamp01(energy / 120);
    const ev = this.event({ bus: this.fleshBus, gain: 0.12 + 0.95 * e ** 0.8, prio: 1.5 });
    // 대전 게임식 "퍽!": 짧게 터지는 때림 + 묵직한 저음 (칼끝이 스치는 약한 접촉은 작게만)
    this.layer(ev, this.pick('hitBlunt'), { gain: 0.5 + 0.6 * e, rate: between(Math.random, 0.94, 1.06) });
    this.body(ev, 0.85);
    // 세게 맞으면(칼 면으로 후려침) 칼도 짧게 울린다
    if (e > 0.2) this.layer(ev, this.pick('clashSoft'), { gain: 0.2 * e, rate: between(Math.random, 0.9, 1), delay: 0.003 });
  }

  /**
   * 재질 쌍 충돌음 (여러 무기를 다루는 무기 시스템 공용 API).
   * @param a,b     'steel' | 'armor'(투구·판금) | 'flesh' | 'wood' | 'plasma'(SF 광검) | 'rubber'(코미디 무기). 순서 상관없음
   * @param energy  충돌 세기 (대략 기존 helmet/cut 등과 같은 J 스케일)
   * @param pos     {x} 를 주면 부딪힌 자리로 살짝 좌우 팬 (없어도 된다)
   */
  impact({ a = 'steel', b = 'steel', energy = 40, pos } = {}) {
    if (!this._on || !this.ctx) return;
    const e = Math.max(0, energy);
    const has = (m) => a === m || b === m;
    if (has('rubber')) return this._impactRubber(e, pos);
    if (has('plasma')) return has('flesh') ? this._impactPlasmaFlesh(e, pos) : this._impactPlasmaSteel(e, pos);
    if (has('flesh')) return this._impactFleshDull(e, pos);
    if (has('armor')) return this._impactArmor(e, a === 'armor' && b === 'armor', pos);
    if (has('wood')) return this._impactWood(e, pos);
    if (has('frozen')) return this._impactFrozen(e, pos);
    return this._impactSteel(e, pos);
  }
  /** steel+steel (또는 알 수 없는 재질): 기존 칼끼리 부딪힘과 같은 소리, 에너지를 세기로 바꿔서 쓴다 */
  _impactSteel(energy, pos) {
    const { e, w, low } = this.hitWeight(energy, 90);
    const ev = this.event({ bus: this.metalBus, gain: (0.2 + 0.8 * e ** 0.7) * (1 + 0.7 * w), bright: e > 0.75 ? 0 : 2400 + 11000 * e, prio: 1 + e, pos });
    const buf = Math.random() < clamp01((e - 0.15) / 0.4) ? this.pick('clashHard') : this.pick('clashSoft');
    this.layer(ev, buf, { rate: low * between(Math.random, 0.93, 1.05) * (1 - 0.05 * e), dur: 0.35 + 1.1 * e + 0.5 * w });
    if (w > 0) this.layer(ev, this.pick('clashHard'), { gain: 0.8 * w, rate: 0.72 * low, delay: 0.006, dur: 1.2 }); // 무게(200 J 위): 낮게 우는 쇠 한 겹 더
  }
  /** steel/wood+armor 또는 armor+armor: 투구·판금이 우그러지는 "퍽-크덕" */
  _impactArmor(energy, plateOnPlate, pos) {
    const e = clamp01(energy / 110);
    const ev = this.event({ bus: this.metalBus, gain: 0.35 + 0.65 * e ** 0.8, bright: e > 0.4 ? 0 : 5000 + 12000 * e, prio: 2, pos });
    const buf = Math.random() < clamp01((e - 0.35) / 0.4) ? this.pick('helmetHeavy') : this.pick('helmet');
    this.layer(ev, buf, { gain: plateOnPlate ? 0.9 : 1, rate: between(Math.random, 0.92, 1.04) * (1 - 0.06 * e) });
    this.layer(ev, this.pick('hitArmor'), { gain: 0.45 + 0.4 * e, rate: between(Math.random, 0.94, 1.06) });
  }
  /** *+wood: 방패·목재 둔기의 "퍽-톡" */
  _impactWood(energy, pos) {
    const e = clamp01(energy / 80);
    const ev = this.event({ bus: this.fleshBus, gain: 0.3 + 0.7 * e ** 0.8, prio: 1.5, pos });
    const rec = this.pickSample(e > 0.6 ? 'woodHeavy' : 'woodHit');
    this.layer(ev, this.pick('wood'), { gain: rec ? 0.35 : 1, rate: between(Math.random, 0.9, 1.08) * (1 - 0.05 * e) });
    if (rec) this.layer(ev, rec, { gain: 0.9, rate: between(Math.random, 0.92, 1.06) });
  }
  /** *+flesh (강철·투구·나무 대 살): 자르지 않는 뭉툭한 접촉이므로 몸통 "퍽"만 */
  _impactFleshDull(energy, pos) {
    const e = clamp01(energy / 100);
    const ev = this.event({ bus: this.fleshBus, gain: 0.15 + 0.85 * e ** 0.8, prio: 1.5, pos });
    this.body(ev, 1);
  }
  /** *+plasma (살 제외): 전기 아크가 튀는 "파직" + 짧은 "웅" 훔 */
  _impactPlasmaSteel(energy, pos) {
    const e = clamp01(energy / 70);
    const ev = this.event({ bus: this.metalBus, gain: 0.3 + 0.7 * e ** 0.7, prio: 1.5 + e, pos });
    this.layer(ev, this.pick('plasmaZap'), { gain: 0.8 + 0.4 * e, rate: between(Math.random, 0.95, 1.08) });
  }
  /** 플라즈마 대 살: 지지는 "치이익" */
  _impactPlasmaFlesh(energy, pos) {
    const e = clamp01(energy / 100);
    const ev = this.event({ bus: this.fleshBus, gain: 0.35 + 0.65 * e ** 0.7, prio: 2, pos });
    this.layer(ev, this.pick('plasmaSizzle'), { gain: 0.8 + 0.3 * e, rate: between(Math.random, 0.9, 1.1) });
    this.body(ev, 0.25 + 0.2 * e); // 살짝 둔한 충격도 섞는다 (에너지 덩어리가 닿긴 닿았으니)
  }
  /** 고무 닭(코미디 무기): 무엇에 맞든 삑삑이+경적이 먼저 튄다 */
  _impactRubber(energy, pos) {
    const e = clamp01(energy / 60);
    const ev = this.event({ bus: this.fleshBus, gain: 0.4 + 0.6 * e ** 0.6, prio: 1.5, pos });
    this.layer(ev, this.pick('rubberHonk'), { rate: between(Math.random, 0.95, 1.15) });
  }

  /** *+frozen (언 참치): 속까지 언 살덩이의 둔하고 딱딱한 "텅" — 나무보다 낮고 무겁게 */
  _impactFrozen(energy, pos) {
    const e = clamp01(energy / 90);
    const ev = this.event({ bus: this.fleshBus, gain: 0.3 + 0.7 * e ** 0.8, prio: 1.5, pos });
    const rec = this.pickSample('woodHeavy');
    this.layer(ev, rec || this.pick('wood'), { rate: between(Math.random, 0.7, 0.8) });
    this.layer(ev, this.pickSample('soft') || this.pick('thump'), { gain: 0.5, rate: between(Math.random, 0.85, 1) });
  }

  // ─────────────────────────────────────────────────────────────
  //  몸 소리: 발소리, 쓰러짐, 무기 부러짐, 죽음 (BodySounds 가 몸 상태를 보고 부른다)
  // ─────────────────────────────────────────────────────────────

  /** 모래 위 발소리. speed = 발이 내려오던 속도 (m/s, AI 대결에서 중간값 1, 상위 10% 1.6 — 크게 내딛거나 비틀거림) */
  footstep(speed, pos) {
    if (!this._on || !this.ctx) return;
    const x = clamp01((speed - 0.3) / 1.8);
    // 녹음된 발소리(8가지, 같은 것이 연달아 안 나오게). 예전 장화 소리는 딱딱한 바닥의 "또각"과 방 울림이 있어 회랑처럼 들렸다.
    // 크게 디디면 합성 "쿵"을 조금 깔아 무게를 더한다
    const rec = this.pickSample(STAGE_SOUND[this.stage].step);
    const ev = this.event({ bus: this.fleshBus, gain: rec ? 0.22 + 0.45 * x : 0.1 + 0.4 * x, bright: rec ? 0 : 1800 + 3500 * x, prio: 0.3, pos });
    if (rec) {
      this.layer(ev, rec, { rate: between(Math.random, 0.9, 1.02) });
      if (x > 0.65) this.layer(ev, this.pick('stepHeavy'), { gain: 0.35 * x, rate: between(Math.random, 0.9, 1.05) });
    } else this.layer(ev, this.pick(x > 0.65 ? 'stepHeavy' : 'step'), { rate: between(Math.random, 0.9, 1.1) });
  }

  /**
   * 디딤: 지나는 걸음의 무거운 딛기 (29차, 디렉터가 R2/R4 에서 gait 의 딛는 순간 onTouchdown 'strike' 에 잇는다. 아직 부르는 곳 없음).
   *  strength 0~1 (0 = 보통 걸음, 1 = 온몸을 실어 내리찍는 딛기). 발소리와 같은 바닥 녹음을 조금 낮게 틀고 합성 "쿵"(stepHeavy)을
   *  세기만큼 깔고, 세게 디디면 몸무게가 실리는 낮은 "쿵"(thump)을 한 겹 더 — 발소리보다 크고 타격음(-21dB 안팎)보다는 작게(1.0 에서 -25dB쯤).
   */
  footStrike(strength = 1, pos) {
    if (!this._on || !this.ctx) return;
    const k = clamp01(strength);
    const rec = this.pickSample(STAGE_SOUND[this.stage].step);
    const ev = this.event({ bus: this.fleshBus, gain: (rec ? 0.3 : 0.22) + 0.35 * k, prio: 0.6, pos });
    if (rec) this.layer(ev, rec, { rate: between(Math.random, 0.86, 0.96) });
    this.layer(ev, this.pick('stepHeavy'), { gain: 0.4 + 0.4 * k, rate: between(Math.random, 0.85, 0.98) });
    if (k > 0.5) this.layer(ev, this.pick('thump'), { gain: 0.5 * (k - 0.5), rate: 0.6, delay: 0.005 }); // 몸무게가 실리는 낮은 "쿵"
  }

  /**
   * (예전 무기 뽑기 "딸깍" — 이제 카드는 cardFlip 을 쓴다) 화면 소리, 위치 없음. 아주 짧은 사각파 한 번 → 폰 부담 거의 없음.
   * final = 고른 카드가 뒤집힐 때: 조금 낮고 길게 (아니면 나머지 카드가 뒤집힐 때의 짧은 딸깍),
   * grand = 진짜 엑스칼리버를 뽑았을 때 한 옥타브 위 울림을 더한다
   */
  tick(final = false, grand = false) {
    if (!this._on || !this.ctx || !this.master) return;
    const c = this.ctx;
    const t = c.currentTime;
    const blip = (freq, dur, vol, type = 'square') => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    };
    if (!final) blip(1800 + Math.random() * 300, 0.025, 0.05);
    else {
      blip(660, 0.16, 0.08, 'triangle');
      if (grand) blip(1320, 0.5, 0.05, 'sine');
    }
  }

  /**
   * 무기 뽑기 카드가 뒤집힘 (화면 소리, 위치 없음). 모두 그 자리에서 노드로 만든다 → 소리 조각이 아직 안 만들어졌어도
   * 첫 탭에 바로 난다 (잡음은 build 때 만든 0.4초 잡음 this.noise 를 쓴다).
   *  pick = 고른 카드: 두꺼운 카드가 젖혀지는 "촥" + 앞면이 드러나는 순간(0.2초 뒤, 뒤집기 절반) 낮은 "둥"
   *         tier 'epic'·'legend' 는 그 위에 아주 작은 반짝임. 진짜 엑스칼리버도 등급(레전드)대로만 낸다
   *         (사장님: 엑스칼리버를 등급과 별개로 우대하지 않는다. main.js 가 넘기는 grand 는 쓰지 않는다)
   *  pick 아님 = 고르지 않은 내 카드 한 장이 뒤집힘: 작은 "촥" 한 번
   *  (상대 무기 카드는 pick 처럼 부른다: 등급 반짝임도 같다)
   */
  cardFlip({ pick = false, tier = 'common' } = {}) {
    if (!this._on || !this.ctx || !this.master || !this.noise) return;
    const c = this.ctx;
    const t0 = c.currentTime + 0.005;
    const out = c.createGain();
    out.gain.value = 1;
    out.connect(this.master);
    // 두꺼운 카드 "촥": 짧은 잡음 두 번 (종이가 휘었다 튕기는 소리) + 공기가 밀리는 낮은 "훅"
    const snap = (t, amp, f = 2600, dur = 0.014) => {
      const n = c.createBufferSource();
      n.buffer = this.noise;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = 0.8;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      n.connect(bp).connect(g).connect(out);
      n.start(t, Math.random() * 0.3);
      n.stop(t + dur + 0.02);
    };
    const whoosh = (t, amp) => {
      const n = c.createBufferSource();
      n.buffer = this.noise;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 500;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.07);
      n.connect(lp).connect(g).connect(out);
      n.start(t, Math.random() * 0.3);
      n.stop(t + 0.09);
    };
    const tone = (t, f, amp, dur, type = 'sine', f1 = f) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (f1 !== f) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.4);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dur + 0.02);
    };
    if (!pick) {
      snap(t0, 0.3, between(Math.random, 2200, 3000), 0.014);
      whoosh(t0, 0.06);
      return;
    }
    snap(t0, 0.5, 2600, 0.02);
    snap(t0 + 0.022, 0.32, 3300, 0.014);
    whoosh(t0, 0.12);
    // 앞면이 드러나는 "둥": 음이 빠르게 떨어지는 짧은 낮은 울림 + 둔한 잡음 (음이 오래 남으면 마림바처럼 "통" 하므로 짧게)
    const tr = t0 + 0.2;
    tone(tr, 150, 0.26, 0.16, 'sine', 70);
    whoosh(tr, 0.18);
    if (tier === 'legend' || tier === 'epic') {
      // 레전드·에픽: 아주 작은 반짝임 (높은 음 셋·넷이 빠르게)
      const notes = tier === 'legend' ? [2637, 3136, 3951, 4699] : [2637, 3520, 4186];
      notes.forEach((fq, k) => tone(tr + 0.04 + k * 0.045, fq, tier === 'legend' ? 0.03 : 0.02, 0.35));
    }
    this.stats.nodes += 12;
  }

  /** 몸이 땅에 부딪힘. speed = 몸통이 떨어지던 속도 (m/s). light = 무릎이 꺾여 주저앉음 */
  bodyFall(speed, { light = false, pos } = {}) {
    if (!this._on || !this.ctx) return;
    const x = clamp01((speed - 0.5) / 3);
    const ev = this.event({ bus: this.fleshBus, gain: (light ? 0.25 : 0.35) + 0.65 * x, prio: 2, pos });
    this.layer(ev, this.pick(light || x < 0.3 ? 'fallLight' : 'fall'), { rate: between(Math.random, 0.88, 1.02) * (1 - 0.08 * x) });
    // 녹음된 "퍽"을 느리게 깔아 무게를 더한다 (이어폰에서 저역이 산다)
    const rec = this.pickSample('punch');
    if (rec) this.layer(ev, rec, { gain: 0.35 + 0.3 * x, rate: between(Math.random, 0.6, 0.7), delay: 0.004 });
    const soft = this.pickSample('soft'); // 몸통 덩어리가 모래에 부딪히는 둔한 "쿵"
    if (soft) this.layer(ev, soft, { gain: 0.5 + 0.4 * x, rate: between(Math.random, 0.8, 0.95), delay: 0.002 });
    // 산사 자갈·성 안뜰 눈·성당 돌바닥: 몸에 밀린 바닥 알갱이가 "자르륵" 흩어진다 (그 바닥 발소리 녹음을 느리게)
    const gk = STAGE_SOUND[this.stage].grit;
    const grit = gk && !light ? this.pickSample(gk) : null;
    if (grit) this.layer(ev, grit, { gain: 0.3 + 0.3 * x, rate: between(Math.random, 0.62, 0.72), delay: 0.012 });
  }

  /**
   * 부활 (이졸데, 사장님 요청): 하늘에서 성스러운 빛이 내려와 비추고 다시 일어선다. 빛이 내려오기 시작할 때 main.js 가 한 번 부른다(디렉터가 연결).
   * 소리는 짧은 그레고리안 성가 한 구절(녹음 stage/chant1, 약 4초. 사장님: 반짝임·종·합창 패드 합성은 마음에 안 든다 → 성가 느낌으로)에,
   * 일어서는 0.9초쯤 그 캐릭터의 짧은 숨 들이켬(rec.revive, 있으면)을 곁들인다. 기합은 없다. 적막한 결투라 칼 부딪힘보다 작게 낸다. 좌우 위치 없음
   */
  revive(voice, { breath = true } = {}) {
    if (!this._on || !this.ctx) return;
    const id = voice in VOICES ? voice : 'generic';
    const ev = this.event({ bus: this.fleshBus, gain: 0.282, prio: 3 }); // 4초 평균이 칼 부딪힘 평균(−24dB)보다 3dB 아래
    const chant = this.pickSample('chant');
    if (chant) this.layer(ev, chant, { rate: between(Math.random, 0.995, 1.005) });
    const rec = breath ? this.pickSample(`voice:${id}:revive`) : null;
    if (rec) {
      const R = VOICES[id].rec || {};
      this.layer(ev, rec, { gain: 1.3 * (R.gain ?? 1), rate: (R.rate ?? 1) * between(Math.random, 0.97, 1.03), delay: 0.9 });
    }
  }

  /**
   * 깊은 상처를 입어 짧게 내는 신음 ("윽"). BodySounds 가 깊은 상처에만, 한 사람당 2초에 한 번까지 부른다
   * (적막한 결투라 자주 울지 않게). 녹음(rec.hurt)이 없는 캐릭터는 소리를 내지 않는다
   */
  hurt(voice, severity = 0.5, { me = false, pos } = {}) {
    if (!this._on || !this.ctx) return;
    const id = voice in VOICES ? voice : 'generic';
    const rec = this.pickSample(`voice:${id}:hurt`);
    if (!rec) return;
    const R = VOICES[id].rec || {};
    const k = clamp01((severity - 0.4) / 0.8);
    const ev = this.event({ bus: this.fleshBus, gain: (me ? 0.55 : 0.7) + 0.25 * k, prio: 2, pos });
    this.layer(ev, rec, { gain: R.gain ?? 1, rate: (R.rate ?? 1) * between(Math.random, 0.96, 1.04), delay: 0.03 });
  }

  /**
   * 내 숨 한 번 (녹음: 들이쉬고 "후우"). 피를 흘려 위험할 때 BodySounds 가 몇 초마다 부른다 — 화면 가장자리 붉은빛의 소리 짝.
   * d = 위험도 0~1 (피 80% → 0, 45% → 1). 목소리보다 약 10dB 작게 시작해 d 가 클수록 조금 커지고 무거워진다(느리게 재생)
   */
  breath(d = 0) {
    if (!this._on || !this.ctx) return;
    const rec = this.pickSample('breath');
    if (!rec) return;
    const k = clamp01(d);
    const ev = this.event({ bus: this.fleshBus, gain: (0.25 + 0.1 * k) * 0.875 * 0.85, prio: 0.2 }); // 2026-10-03 사용자 요청: 현재 저체력 숨소리에서 추가 15% 감소
    this.layer(ev, rec, { rate: (1 - 0.06 * k) * between(Math.random, 0.97, 1.03) });
  }

  /**
   * 칼이 바닥에 떨어짐 (놓친 칼, 또는 쥔 채 쓰러진 칼). speed = 떨어지던 속도 (m/s), material = 무기 재질.
   * 쇠(강철·광검 자루)는 "철-컥", 나무는 "딱", 나머지(고무 닭·언 참치)는 둔한 "툭". 그 바닥의 알갱이 소리를 조금 깐다
   */
  swordLand(speed, material = 'steel', { pos } = {}) {
    if (!this._on || !this.ctx) return;
    const x = clamp01((speed - 1) / 4);
    const metal = material === 'steel' || material === 'armor' || material === 'plasma';
    const ev = this.event({ bus: metal ? this.metalBus : this.fleshBus, gain: 0.25 + 0.45 * x, prio: 1, pos });
    if (metal) this.layer(ev, this.pick('swordLand'), { rate: between(Math.random, 0.9, 1.08) });
    else this.layer(ev, this.pickSample(material === 'wood' ? 'woodHit' : 'soft') || this.pick('thump'), { gain: 0.6, rate: between(Math.random, 0.85, 1.05) });
    const grit = this.pickSample(STAGE_SOUND[this.stage].grit || STAGE_SOUND[this.stage].step);
    if (grit) this.layer(ev, grit, { gain: 0.25 + 0.2 * x, rate: between(Math.random, 0.9, 1.1), delay: 0.004 });
  }

  /**
   * 쇠 조각 소리: 칼 떨어짐(swordLand) 조각을 빠르게 돌린 짧은 "팅"(kind 'blade', 1.5~1.9배) / "철컥"(kind 'armor', 1.15~1.4배).
   *  25차에 조각이 땅에 닿을 때 쓰려고 만든 것을 사장님이 좋아하셔서("꽤 좋던데") 부서지는 순간의 소리로 쓴다(26차).
   *  grit 이면 그 무대 바닥 알갱이 녹음을 살짝 얹는다(조각이 바닥에 떨어진 것). 새 조각 없음(0KB).
   */
  _shard(ev, kind, { gain = 1, delay = 0, grit = false } = {}) {
    this.layer(ev, this.pick('swordLand'), { gain, rate: kind === 'armor' ? between(Math.random, 1.15, 1.4) : between(Math.random, 1.5, 1.9), delay });
    if (!grit) return;
    const g = this.pickSample(STAGE_SOUND[this.stage]?.grit || STAGE_SOUND[this.stage]?.step);
    if (g) this.layer(ev, g, { gain: 0.2 * gain, rate: between(Math.random, 1.0, 1.2), delay: delay + 0.003 });
  }

  /** 무기가 부러짐 (material: 무기 재질. 강철은 쇠 "팅", 나무는 "우지끈", 언 참치는 "쩍") */
  weaponBreak(material = 'wood', pos) {
    if (!this._on || !this.ctx) return;
    const ev = this.event({ bus: this.metalBus, gain: 1, prio: 3, pos });
    if (material === 'steel') {
      // 강철 칼(커먼·레어·에픽은 등급표대로 부러진다): 꺾이는 두 토막이 함께 우는 "팅-팅"(12~20ms 사이, 다른 높이) + 떨어져 나간 끝이 튀는 작은 "철컥".
      // 조각 하나(-31dB)로는 "내 칼이 부러졌다"가 안 들려서 둘을 겹쳤다(-27dB쯤, 나무 "우지끈" -22dB보다는 여전히 작다)
      this._shard(ev, 'blade', { gain: 1 });
      this._shard(ev, 'blade', { gain: 0.7, delay: between(Math.random, 0.012, 0.02) });
      this._shard(ev, 'armor', { gain: 0.4, delay: between(Math.random, 0.04, 0.07) });
      return;
    }
    this.layer(ev, this.pick(material === 'frozen' ? 'breakFrozen' : 'breakWood'), { rate: between(Math.random, 0.92, 1.06) });
    const rec = this.pickSample('crack');
    if (rec && material !== 'frozen') this.layer(ev, rec, { gain: 0.55, rate: between(Math.random, 0.85, 1), delay: 0.002 });
  }

  /**
   * 죽음. voice = VOICES 의 id (캐릭터 id, 플레이어는 'player'), cause = fighter.causeOfDeath
   *  '기절'·'머리' → 짧게 뚝 끊기는 소리, '출혈'·'목' → 숨이 잦아드는 긴 소리 ('목'은 피 끓는 소리가 섞인다)
   *  me = 플레이어 자신이 죽음: 목소리 대신 귀가 멍해지고(삐—) 온 소리가 먹먹해진다
   */
  death(voice, cause, { me = false, pos } = {}) {
    if (!this._on || !this.ctx) return;
    const kind = cause === '출혈' || cause === '목' ? 'bleed' : 'ko';
    const id = voice in VOICES ? voice : 'generic';
    const ev = this.event({ bus: this.fleshBus, gain: me ? 0.7 : 0.9, prio: 3, pos });
    if (VOICES[id].mute) {
      // 목소리 없음 ("쿵"은 몸이 땅에 닿을 때 BodySounds 가 낸다). 목을 베였으면 피 끓는 소리만
      if (cause === '목') this.layer(ev, this.pick('wetHeavy'), { gain: 0.5, rate: between(Math.random, 0.55, 0.65), delay: 0.08 });
      if (me) this.fadeOutWorld();
      return;
    }
    // 녹음이 있으면 녹음(캐릭터에 맞게 재생 속도로 목소리 높이를 조금 바꾼다), 없으면 합성 목소리
    const rec = this.pickSample(`voice:${id}:${kind}`);
    const R = VOICES[id].rec;
    if (rec) this.layer(ev, rec, { gain: R.gain ?? 1, rate: (R.rate ?? 1) * between(Math.random, 0.97, 1.03) });
    else this.layer(ev, this.pick(`voice:${id}:${kind}`), { rate: between(Math.random, 0.97, 1.03) });
    if (cause === '목') this.layer(ev, this.pick('wetHeavy'), { gain: 0.5, rate: between(Math.random, 0.55, 0.65), delay: 0.08 });
    if (me) this.fadeOutWorld();
  }

  /**
   * 참수 (32차, 디렉터: COMBAT.decapitate — 목을 가르고 지나간 치명 베기). 베는 소리(main.js onWound 의 cut)는 이미 났다.
   *  그 위에 짧고 무거운 절단감만 얹는다(과장 없이, "적막"): 목뼈가 끊기는 둔한 "뚝"(뼈 조각·나무 쪼개짐 녹음을 낮게),
   *  목이 떨어져 나가는 무거운 젖은 소리(wetHeavy 낮게), 몸통이 받는 낮은 "쿵", 0.12초 뒤 목 단면의 낮은 젖은 소리 한 번.
   *  목소리는 내지 않는다 — 숨이 목(성대)을 지나지 않는다. BodySounds 가 이때 죽음 목소리를 건너뛴다. 내가 당하면 귀가 멍해진다
   */
  decapitate({ me = false, pos } = {}) {
    if (!this._on || !this.ctx) return;
    const ev = this.event({ bus: this.fleshBus, gain: 0.9, prio: 3, pos });
    this.layer(ev, this.pick('bone'), { gain: 0.8, rate: between(Math.random, 0.7, 0.8), delay: 0.004 });
    const rec = this.pickSample('crack');
    if (rec) this.layer(ev, rec, { gain: 0.5, rate: between(Math.random, 0.8, 0.9), delay: 0.006 });
    this.layer(ev, this.pick('wetHeavy'), { gain: 0.7, rate: between(Math.random, 0.6, 0.7), delay: 0.012 });
    this.layer(ev, this.pick('thump'), { gain: 0.5, rate: 0.6, delay: 0.008 });
    this.layer(ev, this.pick('wet'), { gain: 0.25, rate: between(Math.random, 0.5, 0.6), delay: 0.12 });
    if (me) this.fadeOutWorld();
  }

  /**
   * 떨어진 머리가 바닥에 닿음 (32차, BodySounds 가 머리 몸의 낙하를 보고 부른다. 굴러 튈 때마다, 0.12초에 한 번까지).
   *  speed = 닿기 직전 떨어지던 속도(m/s). 맨머리: 둔한 "퍽"(합성 쿵 + 누비옷 녹음) / 투구째: 투구 조각을 낮게 튼 둔한 "텅" + 쿵.
   *  둘 다 그 무대 바닥 알갱이(모래·자갈·눈·돌·흙)를 얹는다
   */
  headLand(speed, { helmet = false, pos } = {}) {
    if (!this._on || !this.ctx) return;
    const x = clamp01((speed - 0.8) / 4);
    const ev = this.event({ bus: helmet ? this.metalBus : this.fleshBus, gain: 0.2 + 0.45 * x, prio: 1, pos });
    if (helmet) this.layer(ev, this.pick('helmet'), { gain: 0.9, rate: between(Math.random, 0.7, 0.8) });
    this.layer(ev, this.pick('thump'), { gain: helmet ? 0.7 : 0.9, rate: between(Math.random, 0.8, 0.95) });
    const soft = helmet ? null : this.pickSample('soft');
    if (soft) this.layer(ev, soft, { gain: 0.5, rate: between(Math.random, 1.0, 1.15) });
    const grit = this.pickSample(STAGE_SOUND[this.stage].grit || STAGE_SOUND[this.stage].step);
    if (grit) this.layer(ev, grit, { gain: 0.25 + 0.2 * x, rate: between(Math.random, 1.0, 1.15), delay: 0.004 });
  }

  /** 내가 쓰러짐: 이명(삐—)이 울리고, 온 소리가 몇 초에 걸쳐 먹먹해진다 */
  fadeOutWorld() {
    const c = this.ctx;
    const t = c.currentTime;
    this.muffle.frequency.cancelScheduledValues(t);
    this.muffle.frequency.setValueAtTime(this.muffle.frequency.value, t);
    this.muffle.frequency.exponentialRampToValueAtTime(420, t + 1.8);
    const o = c.createOscillator();
    o.frequency.value = between(Math.random, 3600, 4200);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 3.5);
    o.connect(g).connect(this.ctx.destination); // (먹먹함 필터를 거치지 않게 바로 스피커로)
    o.start(t);
    o.stop(t + 3.6);
  }

  /**
   * 바닷가 절벽의 고요: 아주 멀리서 밀려오는 파도 + 옅은 바람. 음악이 아니라 "정적"이라 발소리보다 훨씬 작게(약 -45dB) 깔린다.
   * 처음 한 번만 만들고 계속 돈다 (시작 버튼을 누를 때 main.js 가 부른다). 전체 음량(master)을 거치므로
   * 소리 끄기·음량 설정·쓰러졌을 때의 먹먹함을 그대로 따른다. 노드 몇 개뿐이라 폰 부담은 거의 없다.
   * 다른 배경에서는 그 배경의 _amb… (산사·성 안뜰·대성당·어두운 홀)으로 바뀐다
   */
  ambience() {
    if (this._amb || !this.ctx || !this.master) return;
    const amb = { temple: this._ambTemple, castle: this._ambCastle, cathedral: this._ambCathedral, darkhall: this._ambHall, poseidon_night: this._ambPoseidon, clearing: this._ambClearing, clearing_a: this._ambClearing, clearing_a_dry: this._ambClearing }[this.stage];
    if (amb) return amb.call(this);
    return this._ambPoseidon();
  }

  /**
   * 포세이돈 신전 (위 ambience 참고). night = 밤의 포세이돈: 파도는 그대로, 바람은 더 낮고 어둡게(480Hz, 1.4kHz 위를 닫음), 결투 자리
   * 네 귀퉁이의 쇠 화로와 석상 앞 횃대의 불 "타닥"을 좌우로 아주 작게 깐다(되풀이 조각 둘). 밤바다는 낮보다 낮고 느리다(디렉터).
   * 15~40초마다 찢어진 검은 천이 바람에 펄럭이고, 큰 타격에는 바람이 잠깐 세지며 불길이 "화르륵", 천도 펄럭인다(gust)
   */
  _ambPoseidon(night = !!STAGE_SOUND[this.stage]?.night) {
    const c = this.ctx;
    const buf = this._noiseBuf();
    const out = c.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(1, c.currentTime + 0.5, this._ambTau ?? 2.5); // 천천히 스며든다 (배경이 바뀔 때는 조금 빨리)
    out.connect(this.master);
    const lfo = (hz) => {
      const o = c.createOscillator();
      o.frequency.value = hz;
      return o;
    };
    const amt = (src, v, param) => {
      const g = c.createGain();
      g.gain.value = v;
      src.connect(g).connect(param);
    };
    // 파도: 낮게 거른 잡음을 주기가 서로 안 맞는 느린 물결 둘(12초, 7.6초)로 부풀렸다 가라앉힌다
    const surf = c.createBufferSource();
    surf.buffer = buf;
    surf.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = night ? 380 : 500; // 밤바다는 더 낮고
    lp.Q.value = 0.3;
    const sg = c.createGain();
    sg.gain.value = night ? 0.026 : 0.03;
    const w1 = lfo(night ? 0.06 : 0.083); // 느리게 밀려온다
    const w2 = lfo(night ? 0.095 : 0.131);
    amt(w1, 0.016, sg.gain);
    amt(w2, 0.009, sg.gain);
    amt(w1, 160, lp.frequency); // 파도가 부서질 때 조금 밝아진다
    surf.connect(lp).connect(sg).connect(out);
    // 바람: 좁게 거른 잡음, 가운데 높이와 세기가 아주 천천히 오르내린다
    const wind = c.createBufferSource();
    wind.buffer = buf;
    wind.loop = true;
    wind.playbackRate.value = 0.87; // 파도와 같은 잡음이 겹쳐 들리지 않게
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = night ? 480 : 650;
    bp.Q.value = 1.2;
    const wg = c.createGain();
    wg.gain.value = night ? 0.009 : 0.012;
    const w3 = lfo(0.047);
    amt(w3, 220, bp.frequency);
    amt(w3, 0.008, wg.gain);
    if (night) {
      const nl = c.createBiquadFilter(); // 밤: 바람의 위를 닫아 어둡게
      nl.type = 'lowpass';
      nl.frequency.value = 1400;
      wind.connect(bp).connect(nl).connect(wg).connect(out);
    } else wind.connect(bp).connect(wg).connect(out);
    const t = c.currentTime;
    for (const n of [surf, wind, w1, w2, w3]) n.start(t);
    const nodes = [surf, wind, w1, w2, w3];
    if (night) {
      const fire = this.pick('fireLoop');
      for (const [pan, rate] of [[-0.6, 0.95], [0.6, 1.06]]) {
        const n = c.createBufferSource();
        n.buffer = fire;
        n.loop = true;
        n.playbackRate.value = rate;
        const fg = c.createGain();
        fg.gain.value = 0.022;
        const p = c.createStereoPanner?.();
        if (p) {
          p.pan.value = pan;
          n.connect(fg).connect(p).connect(out);
        } else n.connect(fg).connect(out);
        n.start(t);
        nodes.push(n);
      }
    }
    this._amb = { out, nodes, wind: wg, windBase: night ? 0.009 : 0.012 };
    if (night) this._every(15000, 40000, () => this.stageCall('flap', Math.random() * 0.5)); // 가끔 검은 천이 펄럭인다
  }


  /** 배경 흰 잡음 (4초, 22050Hz 로 만들어 메모리를 아낀다. 흰 잡음이라 되풀이 이음매에서 딸깍이지 않는다). 배경마다 같이 쓴다 */
  _noiseBuf() {
    if (this._nb) return this._nb;
    const sr = 22050;
    const buf = this.ctx.createBuffer(1, sr * 4, sr);
    const d = buf.getChannelData(0);
    const rnd = makeRng(this.seed ^ 0x5eed);
    for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
    return (this._nb = buf);
  }

  /**
   * 배경 바꾸기 (STAGE_SOUND 의 id, 모르는 id 면 포세이돈). 배경 소리가 이미 돌고 있으면 옛것을 3초에 걸쳐 줄이고 새것을 켠다.
   * 발소리·쓰러짐의 바닥 소리, 전투 소리의 울림(방), 큰 타격의 반응도 배경을 따른다
   */
  setStage(id) {
    const next = id in STAGE_SOUND ? id : 'poseidon';
    if (next === this.stage) return;
    this.stage = next;
    for (const t of this._timers) clearTimeout(t);
    this._timers.clear();
    this._applyRoom();
    this._roundOpen = false; // 새 배경: 오르간이 다시 울릴 수 있다
    clearTimeout(this._organT);
    const old = this._amb;
    if (!old) return;
    this._amb = null;
    const t = this.ctx.currentTime;
    // 옛것이 줄어드는 만큼 새것이 차오르게 (줄 때 1초, 찰 때 0.5초 뒤부터 0.9초) → 가운데가 푹 꺼지지 않는다
    old.out.gain.setTargetAtTime(0, t + 0.3, 1);
    for (const n of old.nodes) n.stop(t + 5);
    this._ambTau = 0.9;
    // 판마다 배경이 바뀌므로 다 줄어든 옛 배경 소리는 떼어 낸다 (쌓이지 않게)
    if (!this.ctx.startRendering) setTimeout(() => old.out.disconnect(), 5500);
    this.ambience();
  }

  /** 배경의 방 울림을 켠다·바꾼다 (옛 울림은 1초쯤에 걸쳐 줄인다). 울림 하나 = 합성곱 노드 하나 (폰 부담 작음) */
  _applyRoom() {
    if (!this.ctx || !this.master) return;
    const c = this.ctx;
    const t = c.currentTime;
    const old = this._room;
    if (old) {
      for (const g of old.sends) g.gain.setTargetAtTime(0, t, 0.3);
      if (!c.startRendering) setTimeout(() => old.conv.disconnect(), 4000);
    }
    this._room = null;
    const R = STAGE_SOUND[this.stage].room;
    if (!R) return;
    const conv = c.createConvolver();
    const [L, Rr] = SYNTH.reverbIR(c.sampleRate, makeRng(11), R);
    const ir = c.createBuffer(2, L.length, c.sampleRate);
    ir.getChannelData(0).set(L);
    ir.getChannelData(1).set(Rr);
    conv.normalize = false;
    conv.buffer = ir;
    conv.connect(this.master);
    const sends = [];
    for (const [bus, amt] of [[this.metalBus, R.metal], [this.fleshBus, R.flesh]]) {
      const g = c.createGain();
      g.gain.value = amt;
      bus.connect(g).connect(conv);
      sends.push(g);
    }
    this._room = { conv, sends };
  }

  /** 이 배경이 계속되는 동안 lo~hi 밀리초마다 fn (분석용 OfflineAudioContext 에서는 직접 부른다) */
  _every(lo, hi, fn) {
    if (this.ctx.startRendering) return;
    const stage = this.stage;
    const next = () => {
      const id = setTimeout(() => {
        this._timers.delete(id);
        if (this.stage !== stage) return;
        if (this.ctx.state === 'running') fn();
        next();
      }, between(Math.random, lo, hi));
      this._timers.add(id);
    };
    next();
  }

  /** 배경 소리 만들기 도구: 천천히 스며드는 출력 + 잡음 되풀이·필터·느린 물결(lfo) */
  _ambKit() {
    const c = this.ctx;
    const buf = this._noiseBuf();
    const out = c.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(1, c.currentTime + 0.5, this._ambTau ?? 2.5);
    out.connect(this.master);
    const nodes = [];
    const K = {
      c,
      out,
      nodes,
      src(rate) {
        const n = c.createBufferSource();
        n.buffer = buf;
        n.loop = true;
        n.playbackRate.value = rate;
        nodes.push(n);
        return n;
      },
      filt(type, f, q = 0.7) {
        const b = c.createBiquadFilter();
        b.type = type;
        b.frequency.value = f;
        b.Q.value = q;
        return b;
      },
      gain(v) {
        const g = c.createGain();
        g.gain.value = v;
        return g;
      },
      lfo(hz, param, v) {
        const o = c.createOscillator();
        o.frequency.value = hz;
        const g = c.createGain();
        g.gain.value = v;
        o.connect(g).connect(param);
        nodes.push(o);
        return o;
      },
      // 되풀이 소리 조각(불 등)을 좌우 pan 에 깐다
      loop(b, gain, pan, rate = 1) {
        if (!b) return;
        const n = c.createBufferSource();
        n.buffer = b;
        n.loop = true;
        n.playbackRate.value = rate;
        const g = K.gain(gain);
        const p = c.createStereoPanner?.();
        if (p) {
          p.pan.value = pan;
          n.connect(g).connect(p).connect(out);
        } else n.connect(g).connect(out);
        nodes.push(n);
      },
      start() {
        const t = c.currentTime;
        for (const n of nodes) n.start(t);
      },
    };
    return K;
  }

  /**
   * 성 안뜰의 고요 (눈 내리는 해 질 녘): 성벽을 넘는 찬 바람 "우우—" + 낮은 바람 + 네 귀퉁이 화로의 불 "타닥", 아주 가끔 마구간의 말.
   * 눈 내리는 소리는 없다 (눈은 소리를 먹는다 → 다른 배경보다 고음이 적다)
   */
  _ambCastle() {
    const K = this._ambKit();
    const wind = K.src(1);
    const bp = K.filt('bandpass', 520, 0.8);
    const wg = K.gain(0.014);
    K.lfo(0.07, wg.gain, 0.009);
    K.lfo(0.031, wg.gain, 0.005);
    K.lfo(0.07, bp.frequency, 180);
    wind.connect(bp).connect(K.filt('lowpass', 1500)).connect(wg).connect(K.out);
    const low = K.src(0.83);
    low.connect(K.filt('lowpass', 160, 0.5)).connect(K.gain(0.02)).connect(K.out);
    const fire = this.pick('fireLoop');
    K.loop(fire, 0.03, -0.55, 0.94);
    K.loop(fire, 0.03, 0.55, 1.07);
    K.start();
    this._amb = { out: K.out, nodes: K.nodes, wind: wg, windBase: 0.014 };
    // 마구간의 말: 아주 가끔(50~110초마다) 발굽으로 짚을 "쿵 쿵" 차거나 콧바람 "푸르르"
    this._every(50000, 110000, () => this.stageCall(Math.random() < 0.55 ? 'stamp' : 'snort'));
  }

  /**
   * 무너진 대성당 안: 텅 빈 돌 공간의 낮은 "웅—" + 깨진 창으로 드는 옅은 바람. 가끔 비둘기가 "구구—" 울거나
   * 날아오르고, 무너진 천장에서 돌 부스러기가 떨어진다. 전투 소리는 돌벽에 길게 되울린다 (STAGE_SOUND.cathedral.room)
   */
  _ambCathedral() {
    const K = this._ambKit();
    const low = K.src(0.71);
    const lg = K.gain(0.022);
    K.lfo(0.03, lg.gain, 0.008);
    low.connect(K.filt('lowpass', 120, 0.5)).connect(lg).connect(K.out);
    const air = K.src(1.13);
    const ag = K.gain(0.005);
    K.lfo(0.05, ag.gain, 0.003);
    air.connect(K.filt('bandpass', 650, 0.7)).connect(K.filt('lowpass', 1500)).connect(ag).connect(K.out);
    K.start();
    this._amb = { out: K.out, nodes: K.nodes, wind: ag, windBase: 0.005 };
    this._every(18000, 45000, () => this.stageCall('dove'));
    this._every(30000, 70000, () => this.stageCall('wings'));
    this._every(35000, 80000, () => this.stageCall('debris', 0.4));
  }

  /**
   * 어두운 성의 큰 홀 (밤): 거의 적막 — 아주 낮은 방 소리와 왼쪽 벽난로의 불 "타닥"뿐. 가끔 천장의 박쥐가 "푸드득".
   * 휘장·카펫이 소리를 먹어 성당보다 울림이 짧다
   */
  _ambHall() {
    const K = this._ambKit();
    K.src(0.67).connect(K.filt('lowpass', 90, 0.5)).connect(K.gain(0.02)).connect(K.out);
    K.loop(this.pick('fireLoop'), 0.05, -0.5, 0.9);
    K.start();
    this._amb = { out: K.out, nodes: K.nodes };
    this._every(25000, 60000, () => this.stageCall('bat'));
  }

  /**
   * 배경에서 가끔 나는 소리 한 번: 'dove' 비둘기 울음, 'wings' 비둘기 날갯짓, 'bat' 박쥐 날갯짓(더 빠르고 높게),
   * 'debris' 돌 부스러기, 'flare' 불길이 "화르륵" 이는 소리, 'snort'·'stamp' 마구간 말의 콧바람·발굽. k = 세기 0~1.
   * 몸 소리 길(fleshBus)로 보내 그 배경의 울림을 같이 받고, 우선순위가 낮아 전투 소리에 먼저 자리를 내준다
   */
  stageCall(kind, k = 0.5) {
    if (!this._on || !this.ctx) return;
    const [bank, gain, rate, dur] = {
      dove: ['dove', 0.1, between(Math.random, 0.95, 1.05), 0],
      wings: ['wings', 0.08 + 0.1 * k, between(Math.random, 0.9, 1.1), 0],
      bat: ['wings', 0.05 + 0.08 * k, between(Math.random, 1.6, 1.9), 0],
      debris: ['debris', 0.1 + 0.3 * k, between(Math.random, 0.9, 1.1), 0],
      flare: ['fireLoop', 0.15 + 0.35 * k, between(Math.random, 0.75, 0.85), 0.8],
      snort: ['horseSnort', 0.12, between(Math.random, 0.92, 1.08), 0],
      organ: ['organ', 0.12, 1, 0],
      stamp: ['horseStamp', 0.14, between(Math.random, 0.92, 1.08), 0],
      flap: ['clothFlap', 0.05 + 0.08 * k, between(Math.random, 0.9, 1.1), 0], // 밤의 포세이돈: 찢어진 천이 바람에 펄럭
    }[kind];
    const ev = this.event({ bus: this.fleshBus, gain, prio: 0.1 });
    this.layer(ev, this.pick(bank), { rate, dur });
  }

  /**
   * 산사의 고요: 솔숲을 지나는 바람("쏴아", 아주 옅게) + 골짜기의 낮은 바람 + 가끔 처마 끝 풍경 "댕그랑"과 먼 산새.
   * 파도 대신 산바람이라 포세이돈보다 조금 더 조용하다. 노드 몇 개와 가끔 울리는 풍경뿐이라 폰 부담은 거의 없다
   */
  _ambTemple() {
    const c = this.ctx;
    const buf = this._noiseBuf();
    const out = c.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(1, c.currentTime + 0.5, this._ambTau ?? 2.5);
    out.connect(this.master);
    const lfo = (hz) => {
      const o = c.createOscillator();
      o.frequency.value = hz;
      return o;
    };
    const amt = (src, v, param) => {
      const g = c.createGain();
      g.gain.value = v;
      src.connect(g).connect(param);
    };
    const src = (rate) => {
      const n = c.createBufferSource();
      n.buffer = buf;
      n.loop = true;
      n.playbackRate.value = rate;
      return n;
    };
    // 솔바람: 솔잎을 스치는 넓은 "쏴아". 두 느린 물결(16초, 43초)이 겹쳐 불었다 잦아든다
    const pine = src(1);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.6;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1900; // 치찰음처럼 새지 않게 위를 닫는다
    const pg = c.createGain();
    pg.gain.value = 0.007;
    const w1 = lfo(0.062);
    const w2 = lfo(0.023);
    amt(w1, 0.004, pg.gain);
    amt(w2, 0.003, pg.gain);
    amt(w1, 300, bp.frequency);
    pine.connect(bp).connect(lp).connect(pg).connect(out);
    // 골짜기 바람: 아주 낮은 "우우" (소리의 바닥을 깔아 텅 빈 느낌을 막는다)
    const low = src(0.79);
    const vl = c.createBiquadFilter();
    vl.type = 'lowpass';
    vl.frequency.value = 220;
    vl.Q.value = 0.4;
    const vg = c.createGain();
    vg.gain.value = 0.022;
    const w3 = lfo(0.041);
    amt(w3, 0.01, vg.gain);
    low.connect(vl).connect(vg).connect(out);
    const t = c.currentTime;
    for (const n of [pine, low, w1, w2, w3]) n.start(t);
    this._amb = { out, nodes: [pine, low, w1, w2, w3], wind: pg, windBase: 0.007 };
    // 풍경은 9~26초마다, 산새는 14~40초마다
    this._every(9000, 26000, () => this.windChime());
    this._every(14000, 40000, () => this.bird());
  }

  /**
   * 화전 터의 이른 아침 (브란의 고향): 잔잔한 봄비가 탄 흙과 솔숲에 내린다. 숲을 지나는 옅은 바람 + 아주 낮은 바닥 + 빗발 두 겹(좌우, 되풀이 속도를
   * 달리해 겹치지 않게) + 20~55초마다 먼 까마귀 한 마리. 사장님 컨셉("적막하고 고독한 대결")대로 가볍고 단순하게, 크게 튀는 소리는 없다.
   * `clearing_a_dry`는 비만 뺀다 (STAGE_SOUND.rain). 노드 몇 개와 되풀이 조각 둘뿐이라 폰 부담은 거의 없다
   */
  _ambClearing() {
    const K = this._ambKit();
    const wind = K.src(1);
    const bp = K.filt('bandpass', 620, 0.6);
    const wg = K.gain(0.004);
    K.lfo(0.05, wg.gain, 0.0025);
    K.lfo(0.019, wg.gain, 0.0015);
    wind.connect(bp).connect(K.filt('lowpass', 1500)).connect(wg).connect(K.out);
    const low = K.src(0.8);
    low.connect(K.filt('lowpass', 170, 0.5)).connect(K.gain(0.016)).connect(K.out);
    if (STAGE_SOUND[this.stage].rain !== false) {
      const rain = this.pick('rainLoop');
      const rg = K.gain(0.055);
      K.lfo(0.023, rg.gain, 0.012); // 빗발이 40초쯤 주기로 굵어졌다 가늘어진다
      rg.connect(K.out);
      for (const [pan, rate] of [[-0.5, 0.97], [0.5, 1.04]]) {
        const n = K.c.createBufferSource();
        n.buffer = rain;
        n.loop = true;
        n.playbackRate.value = rate;
        const p = K.c.createStereoPanner?.();
        if (p) {
          p.pan.value = pan;
          n.connect(p).connect(rg);
        } else n.connect(rg);
        K.nodes.push(n);
      }
    }
    K.loop(this.pick('fireLoop'), 0.012, 0.6, 0.85); // 잉걸불이 남은 불더미의 약한 "탁탁" (오른쪽 멀리, 느리게 재생해 낮게)
    K.start();
    this._amb = { out: K.out, nodes: K.nodes, wind: wg, windBase: 0.004 }; // 큰 타격에는 바람만 잠깐 세진다 (비는 그대로)
    this._every(20000, 55000, () => this.crow());
  }

  /** 까마귀들이 날아오름 (화전 터, 배경이 'crows' 로 알릴 때): 날갯짓 두세 번 + 놀란 "까악" 한둘. 멀리, 작게 (적막함을 깨지 않게). 4초에 한 번만 */
  _crowsUp(data = {}) {
    if (!this.stage.startsWith('clearing')) return;
    if (!this._spaced('crows')) return; // 30차: 4초 → SOUND.stageHitGap(10초)
    const k = clamp01(data.amp ?? 0.5);
    const ev = this.event({ bus: this.fleshBus, gain: 0.07 + 0.08 * k, prio: 0.2, pos: data.pos });
    for (let i = 0, t = 0; i < 2 + Math.round(k); i++, t += between(Math.random, 0.12, 0.3)) this.layer(ev, this.pick('wings'), { gain: 0.6, rate: between(Math.random, 0.9, 1.1), delay: t });
    const rec = this.pickSample('crow');
    if (rec) this.layer(ev, rec, { gain: 0.5, rate: between(Math.random, 0.96, 1.08), delay: between(Math.random, 0.1, 0.4) });
    if (k > 0.5) {
      const rec2 = this.pickSample('crow');
      if (rec2) this.layer(ev, rec2, { gain: 0.35, rate: between(Math.random, 0.95, 1.05), delay: between(Math.random, 0.6, 1.0) });
    }
  }

  /** 먼 까마귀 한 마리 (화전 터). 숲 쪽 좌우 어느 한쪽에서 아주 작게 "까악", 3번에 1번은 두 번 운다. 녹음(stage/crow1-3, CC0)을 멀리 들리게 위를 닫은 것 */
  crow() {
    if (!this._on || !this.ctx || !this.master) return;
    const c = this.ctx;
    const side = Math.random() < 0.5 ? -1 : 1;
    const caw = (t, g) => {
      const rec = this.pickSample('crow');
      if (!rec) return;
      const s = c.createBufferSource();
      s.buffer = rec;
      s.playbackRate.value = between(Math.random, 0.94, 1.06);
      const gn = c.createGain();
      gn.gain.value = g;
      s.connect(gn);
      const pan = c.createStereoPanner?.();
      if (pan) {
        pan.pan.value = side * between(Math.random, 0.55, 0.9);
        gn.connect(pan).connect(this.master);
      } else gn.connect(this.master);
      s.start(c.currentTime + t);
      this.stats.nodes += 3;
    };
    const g = between(Math.random, 0.07, 0.12);
    caw(0, g);
    if (Math.random() < 0.35) caw(between(Math.random, 0.45, 0.9), g * between(Math.random, 0.7, 0.95));
  }

  /**
   * 먼 산새 한 번 (산사). 작은 산새 "찌찌찟"이 자주, 휘파람새 "호오— 호케쿄"는 가끔(3번에 1번쯤).
   * 숲 쪽(좌우 어느 한쪽)에서 멀리 아주 작게 들린다. 소리 조각은 미리 만들어 둔 것 (birdSong·birdWarbler)
   */
  bird(kind = Math.random() < 0.65 ? 'song' : 'warbler') {
    if (!this._on || !this.ctx || !this.master) return;
    const buf = this.pick(kind === 'song' ? 'birdSong' : 'birdWarbler');
    if (!buf) return;
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = between(Math.random, 0.96, 1.04);
    const g = c.createGain();
    g.gain.value = (kind === 'song' ? 0.1 : 0.045) * between(Math.random, 0.75, 1.1); // (산새는 짧은 음이라 휘파람새만큼 들리려면 더 커야 한다)
    s.connect(g);
    const pan = c.createStereoPanner?.();
    if (pan) {
      pan.pan.value = (Math.random() < 0.5 ? -1 : 1) * between(Math.random, 0.3, 0.8);
      g.connect(pan).connect(this.master);
    } else g.connect(this.master);
    s.start(c.currentTime + 0.02);
    this.stats.nodes += 3;
  }

  /**
   * 처마 끝 풍경(작은 청동 종 + 물고기 추): 바람에 추가 흔들려 1~3번 "댕-그랑". 멀리서 아주 작게.
   * 종마다 높이가 조금씩 달라(처마 네 귀퉁이) 늘 같은 음이 되풀이되지 않는다. 음이 있는 소리지만 높고 멀어 음악처럼 들리지 않는다
   * @param k 세기 0~1 (큰 바람이면 더 많이·세게 흔들린다)
   */
  windChime(k = 0.5) {
    if (!this._on || !this.ctx || !this.master) return;
    const c = this.ctx;
    const f = between(Math.random, 1180, 1520);
    const out = c.createGain();
    out.gain.value = 0.018 + 0.02 * k;
    const pan = c.createStereoPanner?.();
    if (pan) {
      pan.pan.value = between(Math.random, -0.6, 0.6);
      out.connect(pan).connect(this.master);
    } else out.connect(this.master);
    // 작은 종의 배음 (종은 배음이 정수배가 아니다) · 세기 · 울림 길이(초)
    const P = [
      [1, 1, 1.5],
      [2.32, 0.45, 0.8],
      [4.25, 0.22, 0.45],
      [6.6, 0.1, 0.25],
    ];
    const hits = 1 + Math.floor(Math.random() * (1.6 + 1.4 * k));
    let t = c.currentTime + 0.02;
    let end = t;
    for (let h = 0; h < hits; h++) {
      const a = h === 0 ? 1 : between(Math.random, 0.3, 0.65);
      for (const [r, g, tau] of P) {
        const o = c.createOscillator();
        o.frequency.value = f * r * between(Math.random, 0.998, 1.002);
        const e = c.createGain();
        e.gain.setValueAtTime(0, t);
        e.gain.linearRampToValueAtTime(g * a, t + 0.002);
        e.gain.setTargetAtTime(0, t + 0.002, tau / 3);
        o.connect(e).connect(out);
        o.start(t);
        o.stop(t + tau * 2.2);
        end = Math.max(end, t + tau * 2.2);
      }
      t += between(Math.random, 0.16, 0.42);
    }
    this.stats.nodes += hits * 8;
  }

  /**
   * 배경이 알리는 일 (main.js: arena.onEvent → sound.stageEvent).
   *  'bell' (성 안뜰): 종탑의 종이 크게 흔들려 추가 칠 때마다 { amp, max, pos }. 세기 = amp / max.
   *   여운이 길어(약 7초) 겹치므로 동시에 울리는 여운은 3개까지 — 넘으면 가장 오래된 것을 0.3초에 걸쳐 줄인다.
   *   싸움 소리보다 작게: 가장 세게 쳐도 칼 부딪힘의 약 1/3. 성 안뜰이 아니면 무시한다
   */
  stageEvent(name, data = {}) {
    if (!this._on || !this.ctx) return;
    if (name === 'crows') return this._crowsUp(data); // 화전 터: 참나무의 까마귀들이 날아오른다 (외형 PM이 onEvent('crows') 로 알린다)
    if (name !== 'bell' || this.stage !== 'castle') return;
    if (!this._spaced('bell')) return; // 30차: 한 번 흔들리면 양 끝마다 치던 종을 10초에 한 번만 (사장님 "간격을 좀 두자")
    const c = this.ctx;
    const x = clamp01((data.amp ?? 0.3) / (data.max ?? 0.55));
    const t = c.currentTime;
    this._bells = (this._bells || []).filter((b) => b.end > t);
    while (this._bells.length >= 3) {
      const old = this._bells.shift();
      old.g.gain.cancelScheduledValues(t);
      old.g.gain.setTargetAtTime(0, t, 0.1);
      old.s.stop(t + 0.6);
    }
    const buf = this.pick('castleBell');
    const s = c.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = between(Math.random, 0.995, 1.005); // 같은 종이라 높이는 거의 그대로
    const g = c.createGain();
    // 멀리서 들리는 쪽이 커지면 이상하므로 거리로도 줄인다 (20m 기준)
    const { pan, near } = this._where(data.pos);
    g.gain.value = (0.03 + 0.15 * x ** 1.3) * near;
    s.connect(g);
    const p = c.createStereoPanner?.();
    if (p) {
      p.pan.value = pan;
      g.connect(p).connect(this.metalBus); // 쇳소리 길 → 성벽 메아리(방 울림)를 같이 받는다
    } else g.connect(this.metalBus);
    s.start(t + 0.01);
    this._bells.push({ s, g, end: t + buf.duration });
    this.stats.nodes += 3;
  }

  /**
   * 소리 자리 → 좌우(pan, -1~1)와 거리 배율. listener(카메라, main.js 가 넣어 준다)가 있으면 카메라 오른쪽 방향으로,
   * 없으면 세계 x 로 대충 정한다. 거리 배율은 20m 에서 1, 가까우면 최대 1.5
   */
  _where(pos) {
    if (!pos) return { pan: 0, near: 1 };
    const cam = this.listener;
    if (cam?.matrixWorld) {
      const m = cam.matrixWorld.elements;
      const dx = pos.x - m[12];
      const dy = pos.y - m[13];
      const dz = pos.z - m[14];
      const d = Math.hypot(dx, dy, dz) || 1;
      const right = (dx * m[0] + dy * m[1] + dz * m[2]) / d;
      return { pan: Math.max(-0.8, Math.min(0.8, right * 0.8)), near: Math.min(1.5, 20 / Math.max(8, d)) };
    }
    return { pan: Math.max(-0.6, Math.min(0.6, pos.x / 25)), near: 1 };
  }

  /**
   * 새 판이 시작됨 (main.js newRound). 대성당: 파이프 오르간 화음이 한 번 울린다.
   * 무기 뽑기 동안 newRound 가 두 번 불린다(카드를 띄울 때, 고른 무기로 다시 세울 때) → 그 사이에 싸움 소리가 없었으면
   * 같은 판으로 보고 다시 울리지 않는다 (_roundOpen: event 에서 싸움 소리가 나면, setStage 에서 배경이 바뀌면 풀린다).
   * 첫 판은 소리 조각이 아직 만들어지는 중일 수 있어 2초까지 기다렸다가 울린다 (그래도 없으면 그 자리에서 만든다)
   */
  roundStart() {
    if (!this._on || !this.ctx || this.stage !== 'cathedral' || this._roundOpen) return;
    this._roundOpen = true;
    clearTimeout(this._organT);
    const stage = this.stage;
    let waited = 0;
    const go = () => {
      if (this.stage !== stage) return;
      if (!this.bank.organ?.length && waited < 2000 && !this.ctx.startRendering) {
        waited += 100;
        this._organT = setTimeout(go, 100);
        return;
      }
      this.stageCall('organ');
    };
    go();
  }

  /**
   * 큰 타격이 배경을 흔듦 (main.js 가 arena.excite 와 같은 세기로 부른다, 0~1).
   *  산사: 단풍잎 "바스락" + 솔바람, 세면 풍경 / 성 안뜰: 눈보라 바람 + 화로 불길 "화르륵"
   *  대성당: 천장에서 돌 부스러기, 세면 비둘기가 날아오름 / 어두운 홀: 박쥐가 놀라 "푸드득", 벽난로 불길. 포세이돈은 아직 없음
   */
  /**
   * 리볼버 총성 (30차). gun.js gunshotSound 가 여기로 넘긴다. 핵심 조작 소리라 간격 제한은 없다.
   *  총성 조각(크랙·몸통·충격파) 위에 꼬리: 방 울림이 있는 무대(성 안뜰·성당·홀)는 쇳소리 길의 방 울림이 붙으니 gunTail 을 조금만(0.25),
   *  바깥(포세이돈·산사·화전 터)은 절벽·숲 메아리 gunTail 을 길고 크게(0.55). 큰 방(성당)은 꼬리를 낮게 튼다.
   */
  gunshot({ pos } = {}) {
    if (!this._on || !this.ctx) return;
    const R = STAGE_SOUND[this.stage]?.room;
    const ev = this.event({ bus: this.metalBus, gain: 1.7 * 1.15, prio: 3, pos }); // 사용자 요청: 총성 +15%
    this.layer(ev, this.pick('gunshot'), { rate: between(Math.random, 0.96, 1.04) });
    this.layer(ev, this.pick('gunTail'), { gain: R ? 0.25 : 0.55, rate: (R && R.rt > 2 ? 0.85 : 1) * between(Math.random, 0.95, 1.05), delay: 0.004 });
  }

  /**
   * 큰 타격에 반응하는 배경 소리의 간격 (30차, 사장님 "너무 자주 들려. 간격을 좀 두자"): 같은 key 의 소리는 SOUND.stageHitGap(10초) 안에 다시 내지 않는다.
   *  true 면 내도 된다(시각을 적는다). 타격음 자체에는 쓰지 않는다. 바람이 잠깐 세지는 것(gust 의 wind)은 새 소리가 아니라 그대로 둔다.
   */
  _spaced(key) {
    const now = this.ctx.currentTime;
    const gap = SOUND.stageHitGap ?? 10;
    this._spacedT ??= {};
    if (this._spacedT[key] !== undefined && now - this._spacedT[key] < gap) return false;
    this._spacedT[key] = now;
    return true;
  }
  /** 큰 타격 → 배경 소리 한 번, 간격을 지켜서 (gust 전용) */
  _hitCall(kind, k) {
    if (this._spaced(kind)) this.stageCall(kind, k);
  }

  gust(amount) {
    if (!this._on || !this.ctx || this.stage === 'poseidon' || amount < 0.15) return;
    const now = this.ctx.currentTime;
    if (this._gustT && now - this._gustT < 0.6) return; // 연타에 소리가 겹겹이 쌓이지 않게
    this._gustT = now;
    const w = this._amb?.wind;
    if (w) {
      // 바람이 잠깐 세졌다 잦아든다
      const b = this._amb.windBase;
      w.gain.cancelScheduledValues(now);
      w.gain.setTargetAtTime(b * (1 + 2 * amount), now, 0.15);
      w.gain.setTargetAtTime(b, now + 0.7, 1.2);
    }
    if (this.stage.startsWith('clearing')) return; // 화전 터: 바람만 잠깐 (크게 튀는 소리는 넣지 않는다 — 사장님 컨셉)
    if (this.stage === 'poseidon_night') {
      // 밤의 포세이돈: 화로 불길이 잠깐 "화르륵", 바람에 검은 천이 펄럭
      this._hitCall('flare', amount * 0.6);
      if (Math.random() < 0.4 + amount * 0.6) this._hitCall('flap', amount);
      return;
    }
    if (this.stage === 'castle') return this._hitCall('flare', amount);
    if (this.stage === 'cathedral') {
      this._hitCall('debris', amount);
      if (amount > 0.5 && Math.random() < amount * 0.6) this._hitCall('wings', amount);
      return;
    }
    if (this.stage === 'darkhall') {
      if (Math.random() < 0.4 + 0.5 * amount) this._hitCall('bat', amount);
      if (amount > 0.5) this._hitCall('flare', amount * 0.4);
      return;
    }
    const rec = this._spaced('leaves') ? this.pickSample('leaves') : null;
    if (rec) {
      const ev = this.event({ bus: this.fleshBus, gain: 0.08 + 0.12 * amount, bright: 4200, prio: 0.2 }); // 잎이 마른 종이처럼 쉬익 새지 않게 위를 닫는다
      this.layer(ev, rec, { rate: between(Math.random, 0.8, 1.0) });
    }
    if (amount > 0.5 && Math.random() < amount && this._spaced('chime')) this.windChime(amount);
  }

  /** 새 판: 먹먹함을 푼다 */
  resetRound() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.muffle.frequency.cancelScheduledValues(t);
    this.muffle.frequency.setTargetAtTime(20000, t, 0.1);
  }

  /**
   * 판금이 타격을 막음 (전투 판정이 "판금이 막았다"고 알려 줄 때). 무기 재질에 맞는 갑옷 충돌음 — 투구와 같은 "챡-징-크덕"
   * @param energy 막은 타격의 세기 (J), material 때린 무기 재질 (기본 강철)
   */
  plateBlock(energy, { material = 'steel', pos } = {}) {
    this.impact({ a: material, b: 'armor', energy, pos });
  }

  /** 판금이 완전히 부서짐: 금이 번지며 깨지는 소리 → 0.1~0.35초에 걸쳐 조각 둘~셋이 바닥에 "철컥" 흩어져 떨어짐(_shard) */
  plateBreak(energy = 100, { pos } = {}) {
    if (!this._on || !this.ctx) return;
    const e = clamp01(energy / 120);
    const ev = this.event({ bus: this.metalBus, gain: 0.7 + 0.3 * e, prio: 3, pos });
    this.layer(ev, this.pick('plateBreak'), { rate: between(Math.random, 0.94, 1.04) });
    // 조각: 합성 "철-퍽" 대신 25차 조각 착지 소리(사장님: "부서질 때 그걸 가져다 쓰자"). 센 타격이면 셋, 아니면 둘
    const n = Math.random() < 0.3 + 0.6 * e ? 3 : 2;
    for (let i = 0; i < n; i++) this._shard(ev, 'armor', { gain: 0.5 - 0.08 * i, delay: 0.1 + 0.09 * i + between(Math.random, 0, 0.05), grit: true });
  }

  /** 뼈 부딪히는/부러지는 소리 */
  bone(energy) {
    if (!this._on || !this.ctx) return;
    const e = clamp01((energy - 50) / 150);
    const ev = this.event({ bus: this.fleshBus, gain: 0.35 + 0.55 * e, prio: 2 });
    this.layer(ev, this.pick('bone'), { gain: 0.9, rate: between(Math.random, 0.85, 1.1), delay: 0.006 });
    const rec = this.pickSample('crack');
    if (rec) this.layer(ev, rec, { gain: 0.6, rate: between(Math.random, 1.05, 1.3), delay: 0.004 });
  }

  /**
   * 칼끼리 맞대고 긁는 소리 (바인드). 매 프레임 부른다.
   * @param slide 미끄러지는 속도 (m/s), press 누르는 힘 (N). 둘 다 0 이면 조용해진다
   */
  scrape(slide, press = 0) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (!this._scrape) {
      if (!(slide > 0.2) || !this._on) return; // 처음 긁을 때 만든다
      const s = c.createBufferSource();
      s.buffer = this.pick('scrape');
      s.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 0.6;
      f.frequency.value = 3000;
      const g = c.createGain();
      g.gain.value = 0;
      s.connect(f).connect(g).connect(this.metalBus);
      s.start();
      this._scrape = { s, f, g, quiet: c.currentTime };
    }
    const v = clamp01((slide - 0.2) / 4); // 0.2 → 4.2 m/s
    const p = clamp01(Math.sqrt(press / 150)); // 세게 누를수록 크게 (150N 이상 = 최대)
    const vol = this._on ? 0.55 * v ** 0.8 * (0.35 + 0.65 * p) : 0;
    const t = c.currentTime;
    const sc = this._scrape;
    if (vol > 0) sc.quiet = t;
    else if (t - (sc.quiet ?? t) > 0.4) {
      // 한동안 조용하면 멈춘다 (다음에 긁을 때 다시 만든다)
      sc.s.stop();
      sc.g.disconnect();
      this._scrape = null;
      return;
    }
    sc.g.gain.setTargetAtTime(vol, t, vol > sc.g.gain.value ? 0.02 : 0.06);
    sc.s.playbackRate.setTargetAtTime(0.9 + 0.2 * v, t, 0.05); // 빨리 미끄러질수록 촘촘하고 조금 높게
    sc.f.frequency.setTargetAtTime(1800 + 3500 * v, t, 0.05); // … 그리고 밝게
  }

  /**
   * 칼마다 하나씩 계속 도는 바람 소리. 칼끝 속도에 따라 커지고 높아진다 → 칼이 가속·감속하는 게 들린다.
   * 음량 곡선은 아래로 볼록 (Blade & Sorcery의 긴 칼 바람 소리 곡선 모양: 느릴 땐 거의 안 들리다가 빨라지면 확 커진다)
   * @param material 'steel'(기본, 바람 소리만) | 'plasma'(광검: 항상 켜진 낮은 "웅" 훔이 함께 돈다)
   */
  whooshLoop(material = 'steel') {
    if (!this.ctx) return null;
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
    src.connect(f).connect(g).connect(this.master);
    src.start();
    const hum = material === 'plasma' ? this._plasmaHum() : null;
    const self = this;
    return {
      set(speed) {
        const x = Math.min(1, Math.max(0, (speed - 4) / 16)); // 칼끝 4 → 20 m/s
        // (0,0) (0.66, ≈0.25) (1, 0.6) × 전체 음량. 타격음이 무거워진 만큼 바람 소리도 조금 키웠다 (+4dB)
        const vol = self._on ? 0.6 * Math.pow(x, 2.2) * 0.8 : 0;
        const t = c.currentTime;
        g.gain.setTargetAtTime(vol, t, 0.03);
        f.frequency.setTargetAtTime(250 + 1150 * x, t, 0.03);
        hum?.set(x);
      },
      /** 무기가 바뀌어 이 고리를 버릴 때 */
      stop() {
        try {
          src.stop();
        } catch {
          /* 이미 멈춤 */
        }
        g.disconnect();
        hum?.stop();
      },
    };
  }
  /** 플라즈마 날의 상시 "웅" 훔: 가만히 있어도 낮게 울리고, 휘두르면 커지며 이따금 "파직" 끼어든다 */
  _plasmaHum() {
    const c = this.ctx;
    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'sawtooth';
    o1.frequency.value = 58;
    o2.frequency.value = 58 * 1.503; // 완전5도 위, 순정과 살짝 어긋나게(SF스러운 맥놀이)
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 0.6;
    const g = c.createGain();
    g.gain.value = 0;
    o1.connect(lp);
    o2.connect(lp);
    lp.connect(g).connect(this.master);
    o1.start();
    o2.start();
    const self = this;
    let crackleAt = 0;
    return {
      stop() {
        o1.stop();
        o2.stop();
        g.disconnect();
      },
      set(x) {
        const t = c.currentTime;
        const base = 0.05; // 가만히 있어도 들리는 대기 훔
        g.gain.setTargetAtTime(self._on ? base + 0.22 * x : 0, t, 0.05);
        lp.frequency.setTargetAtTime(700 + 2200 * x, t, 0.05);
        // 빨리 휘두를수록 "파직" 스파크가 더 자주 낀다
        if (self._on && t > crackleAt) {
          crackleAt = t + between(Math.random, 0.15, 0.6) / (0.15 + x);
          const ev = self.event({ bus: self.master, gain: 0.12 + 0.25 * x, prio: 0.5 });
          self.layer(ev, self.pick('plasmaZap'), { gain: 0.35, rate: between(Math.random, 1.1, 1.4) });
        }
      },
    };
  }
}

/**
 * 파이터 한 명의 몸 소리 감지기: 매 화면(프레임)마다 몸 상태를 읽고 알맞은 소리를 부른다.
 * fighter.js 를 고치지 않고 밖에서 보기만 한다 (state, causeOfDeath, weaponBroken, 몸 조각의 높이·속도).
 *  - 발소리: 발이 들렸다가(9cm 위) 다시 땅(6cm 아래)에 닿는 순간. 세기 = 내려오던 속도
 *  - 쓰러짐: 서 있지 않을 때 골반·가슴이 떨어지다(초속 1m 넘게) 땅 근처에서 멈춘 순간 → 슬로모션에도 박자가 맞는다
 *  - 무릎 꺾임(서 있다 → 일어나는 중), 무기 부러짐, 죽음은 상태가 바뀌는 순간
 */
export class BodySounds {
  constructor(sound, fighter, voice, me = false) {
    this.s = sound;
    this.f = fighter;
    this.voice = voice;
    this.me = me;
    this.state = fighter.state;
    this.broken = !!fighter.weaponBroken;
    this.feet = { footF: { up: false, vy: 0, t: 0 }, footB: { up: false, vy: 0, t: 0 } };
    this.fallV = { pelvis: 0, chest: 0 };
    this.lastFall = -1;
    this.t = 0;
    this.thudDue = 0; // 목소리 없는 캐릭터가 죽은 뒤 "쿵"을 내야 할 마감 시각 (0 = 없음)
    this.nWounds = fighter.wounds?.length || 0; // 지금까지 본 상처 수 (새 상처 → 신음)
    this.lastHurt = -9;
    this.swordVy = 0; // 칼이 떨어지던 가장 빠른 속도 (바닥에 닿는 순간을 잡는다)
    this.lastLand = -9;
    this.breathT = 0; // 다음 숨 시각 (0 = 지금은 숨을 내지 않는다)
    this.decap = !!fighter.decapitated; // 참수를 이미 알렸나 (32차)
    this.headVy = 0; // 떨어진 머리가 떨어지던 가장 빠른 속도 (바닥에 닿는 순간을 잡는다)
    this.lastHead = -9;
  }

  update(dt) {
    const f = this.f;
    const s = this.s;
    this.t += dt;
    // 참수 (32차): fighter.decapitate 가 decapitated 를 켠다(die 와 같은 순간). 절단감 소리를 한 번, 죽음 목소리는 내지 않는다
    if (f.decapitated && !this.decap) {
      this.decap = true;
      s.decapitate({ me: this.me });
    }
    if (f.state !== this.state) {
      if (f.state === 'dead') {
        if (!f.decapitated) s.death(this.voice, f.causeOfDeath, { me: this.me });
        if (VOICES[this.voice]?.mute) this.thudDue = this.t + 1.2; // 1.2초 안에 몸이 닿지 않으면(이미 누워 있었음) 그때 낸다
      }
      else if (f.state === 'getup' && this.state === 'stand') s.bodyFall(1.2, { light: true }); // 무릎이 꺾여 주저앉음
      this.state = f.state;
    }
    if (f.weaponBroken && !this.broken) s.weaponBreak(f.weapon?.material);
    this.broken = !!f.weaponBroken;

    if (f.state === 'stand' || f.state === 'getup') {
      for (const k of ['footF', 'footB']) {
        const b = f.bodies[k];
        const ft = this.feet[k];
        const y = b.translation().y;
        const vy = b.linvel().y;
        if (y > 0.09) {
          ft.up = true;
          ft.vy = Math.min(ft.vy, vy);
        } else if (ft.up && y < 0.06) {
          ft.up = false;
          if (this.t - ft.t > 0.12) s.footstep(Math.max(-ft.vy, -vy));
          ft.t = this.t;
          ft.vy = 0;
        }
      }
    }
    if (f.state !== 'stand') {
      for (const k of ['pelvis', 'chest']) {
        const b = f.bodies[k];
        const y = b.translation().y;
        const vy = b.linvel().y;
        const v0 = this.fallV[k];
        if (v0 < -1 && vy > v0 * 0.35 && y < 0.45) {
          // 떨어지던 몸이 땅에서 멈췄다. 골반·가슴이 잇달아 닿으면 한 번만 크게
          if (this.thudDue) {
            s.bodyFall(Math.max(-v0, 2.4)); // 목소리 대신이라 늘 무겁게
            this.thudDue = 0;
          } else if (this.t - this.lastFall > 0.25) s.bodyFall(-v0);
          this.lastFall = this.t;
          this.fallV[k] = 0;
        } else this.fallV[k] = vy < 0 ? Math.min(v0, vy) : 0;
      }
    }
    if (this.thudDue && this.t > this.thudDue) {
      s.bodyFall(2.4);
      this.thudDue = 0;
    }

    // 깊은 상처 → 짧은 신음. 한 번 벨 때 상처가 여러 개 몰려 생기므로 2초에 한 번만 (죽는 상처는 죽음 목소리가 대신한다)
    const W = f.wounds || [];
    if (W.length < this.nWounds) this.nWounds = W.length;
    while (this.nWounds < W.length) {
      const w = W[this.nWounds++];
      if (f.state !== 'dead' && w.severity > 0.4 && this.t - this.lastHurt > 2) {
        s.hurt(this.voice, w.severity, { me: this.me });
        this.lastHurt = this.t;
      }
    }

    // 내 숨: "지금 얼마나 위험한가"를 귀로 알려 준다 (화면 가장자리 붉은빛의 짝). 나만 낸다 — 상대는 내지 않는다.
    // 피가 80% 아래이고, 아직 피가 흐르거나(출혈 문턱은 붉은 테두리 맥박과 같은 0.002) 60% 아래로 위험할 때만.
    // 출혈이 멎고 피가 60% 이상이면 다음 숨부터 내지 않는다(끊지 않고). 죽으면 바로 멈추고, 판이 바뀌면 새로 만들어져 초기화된다
    if (this.me) {
      const danger = f.state !== 'dead' && f.blood < VITALS.weakBlood && (f.bleed > 0.002 || f.blood < 0.6);
      if (!danger) this.breathT = 0;
      else {
        const d = clamp01((VITALS.weakBlood - f.blood) / (VITALS.weakBlood - VITALS.collapseBlood)); // 위험도 0~1
        if (!this.breathT) this.breathT = this.t + 1.2; // 처음 한 번은 조금 뒤에 (맞는 순간은 신음이 맡는다)
        else if (this.t >= this.breathT) {
          s.breath(d);
          this.breathT = this.t + (5 - 3 * d) * between(Math.random, 0.85, 1.15); // 5초(d=0) → 2초(d=1), 사람 숨처럼 ±15% 흔들림
        }
      }
    }

    // 칼이 바닥에 떨어짐: 놓친 칼, 또는 쥔 채 쓰러진 칼이 땅에 닿는 순간 (튀어서 다시 닿는 것은 0.5초 안에 한 번만)
    const sw = f.sword;
    if (sw && (!f.armed || f.state !== 'stand')) {
      const y = sw.translation().y;
      const vy = sw.linvel().y;
      const v0 = this.swordVy;
      if (v0 < -1.2 && vy > v0 * 0.35 && y < 0.25) {
        if (this.t - this.lastLand > 0.5) s.swordLand(-v0, f.weapon?.material);
        this.lastLand = this.t;
        this.swordVy = 0;
      } else this.swordVy = vy < 0 ? Math.min(v0, vy) : 0;
    } else this.swordVy = 0;

    // 떨어진 머리가 바닥에 닿음 (32차): 칼과 같은 방법 — 떨어지던 머리가 땅 가까이서 멈추거나 튀면 그 순간. 굴러 튈 때마다 작게
    const hb = this.decap ? f.bodies?.head : null;
    if (hb) {
      const y = hb.translation().y;
      const vy = hb.linvel().y;
      const v0 = this.headVy;
      if (v0 < -0.8 && vy > v0 * 0.35 && y < 0.4) {
        if (this.t - this.lastHead > 0.12) s.headLand(-v0, { helmet: !!f.hasHelmet, pos: hb.translation() });
        this.lastHead = this.t;
        this.headVy = 0;
      } else this.headVy = vy < 0 ? Math.min(v0, vy) : 0;
    }
  }
}

/** mp3 는 앞에 짧은 빈 소리(인코더 지연 약 25ms)가 붙기도 한다 → 잘라내서 합성 소리와 박자를 맞춘다 */
function trimStart(c, buf) {
  const d = buf.getChannelData(0);
  const peak = peakOf(d);
  let i = 0;
  while (i < d.length && Math.abs(d[i]) < peak * 0.01) i++;
  i = Math.max(0, i - 32);
  if (i < 16) return buf;
  const out = c.createBuffer(buf.numberOfChannels, d.length - i, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) out.getChannelData(ch).set(buf.getChannelData(ch).subarray(i));
  return out;
}
