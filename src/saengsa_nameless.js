// 무명 검객 (사장님 10/29 15:5x '무명 검객으로 채우고' · '무명 검객은 광기의 브론과 똑같은 옷차림에 옷 색깔만 다르게' · '무명 검객은 고용비 20')
//  생사전에서 이름난 인물(로스터 열하나)은 한 대회에 한 번씩만 나오고 남는 상대 자리는 무명 검객 · 동료로도 고용(SAENGSA.nameless.hire).
//  겉모습 = 광기의 브론(characters.js bran_mad — outfit_alter.js alterLook 'bran': 브론 몸 · 얼굴 · 머리 그대로 + 옷 일곱 색을 청회색으로 + 겉꾸밈 케틀 햇)에서
//   그 옷 일곱 색만 옷 색 줄(SAENGSA.nameless.cloth — 씨앗)로 돌린다. 살갗 · 머리 · 쇠 · 가죽끈은 그대로 → 얼굴은 브론 얼굴이다(설계 §4-6 여쭘).
//  ① namelessLook(cloth) — 2단계 싸움 몸에 쓸 겉모습(looks 꼴 — outfitPalette · tunic … 가 새 색) · 지금은 아무 데서도 몸을 만들지 않는다
//  ② 카드 얼굴 — 광기의 브론 프로필 그림의 옷 칸(아래쪽 절반의 청색 칸)만 같은 규칙으로 다시 칠한 그림(캔버스 — 브라우저에서 한 번 · 옷 색마다 하나)
//  색 셈은 순수(recolorRgb — 시험 tools/sim/saengsa.test.mjs). 값은 config.js SAENGSA.nameless (확인 전 — 고용비 20 은 사장님 결정)
import { SAENGSA } from './config.js';
import { CHARACTERS_BY_ID } from './characters.js';
import { portraitSrc } from './portraits.js';

export const NAMELESS_ID = 'nameless';
export const NAMELESS_BASE = 'bran_mad'; // 옷차림 · 프로필 그림의 바탕 (광기의 브론)
const LOOK_KEYS = ['tunic', 'quilt', 'sleeve', 'hoseUpper', 'hoseLower', 'belt', 'metal']; // outfit_alter.js alterLook 이 배색을 바로 거는 칸과 같다
const REF_SAT = 0.3; // 바탕 옷의 기준 채도 — 새 채도 = 바탕 채도 × cloth.sat ÷ 이 값

export const clothCount = (cfg = SAENGSA) => cfg.nameless.cloth.length;
const clothOf = (i, cfg = SAENGSA) => cfg.nameless.cloth[((i % clothCount(cfg)) + clothCount(cfg)) % clothCount(cfg)];

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255));
}
/** 옷 한 색을 옷 색 줄 i 로: 색상 = cloth.hue · 채도 = 바탕 채도 × cloth.sat ÷ REF_SAT(0.85 까지) · 밝기 = 바탕 밝기 × cloth.light */
export function recolorRgb(r, g, b, i, cfg = SAENGSA) {
  const c = clothOf(i, cfg), [, s, l] = rgbToHsl(r, g, b);
  return hslToRgb(c.hue, Math.min(0.85, (s * c.sat) / REF_SAT), Math.min(0.92, l * c.light));
}
export const recolorHex = (hex, i, cfg = SAENGSA) => { const [r, g, b] = recolorRgb((hex >> 16) & 255, (hex >> 8) & 255, hex & 255, i, cfg); return (r << 16) | (g << 8) | b; };
/** 프로필 그림의 옷 칸인가: 광기의 브론 청색 옷(색상 195 ~ 260 · 채도 0.12 이상) — 아래쪽 절반에서만 부른다(투구의 청색 칸은 위쪽) */
export function isClothPixel(r, g, b) {
  const [h, s, l] = rgbToHsl(r, g, b);
  return h >= 195 && h <= 260 && s >= 0.12 && l > 0.04 && l < 0.8;
}

/** ① 2단계 몸에 쓸 겉모습 — 광기의 브론 겉모습에서 옷 일곱 색만 옷 색 줄 i 로 */
export function namelessLook(i, cfg = SAENGSA) {
  const src = CHARACTERS_BY_ID[NAMELESS_BASE];
  const look = { ...src.look, outfitPalette: {}, namelessCloth: i };
  const swapped = new Set(Object.values(src.look.outfitPalette));
  for (const [k, v] of Object.entries(src.look.outfitPalette)) look.outfitPalette[k] = recolorHex(v, i, cfg);
  for (const key of LOOK_KEYS) if (swapped.has(look[key])) look[key] = recolorHex(look[key], i, cfg);
  return look;
}
export const namelessLookVersion = (i) => `${CHARACTERS_BY_ID[NAMELESS_BASE].lookVersion}-nameless${i}`;

// ── ② 카드 얼굴 (브라우저) ──
const faces = new Map(); // 옷 색 줄 → 그림 주소(data URL)
let making = null;
/** 지금 쓸 수 있는 무명 검객 얼굴 (다 칠하기 전이면 광기의 브론 그림) */
export const namelessFace = (i) => faces.get(i) ?? portraitSrc(NAMELESS_BASE);
/** 옷 색마다 얼굴을 한 번 칠한다 (192 × 192 — 카드 · 칸 크기에 충분). 끝나면 참 · 그림을 못 읽으면 거짓(광기의 브론 그림 그대로) */
export function makeNamelessFaces(cfg = SAENGSA) {
  if (making) return making;
  making = new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(false); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const N = 192, cv = document.createElement('canvas');
        cv.width = cv.height = N;
        const g = cv.getContext('2d', { willReadFrequently: true });
        g.imageSmoothingEnabled = false; // 도트 칸을 그대로 (섞인 가장자리 색이 생기지 않게)
        for (let i = 0; i < clothCount(cfg); i++) {
          g.clearRect(0, 0, N, N);
          g.drawImage(img, 0, 0, N, N);
          const d = g.getImageData(0, 0, N, N), a = d.data;
          for (let y = Math.floor(N * 0.5); y < N; y++) {
            for (let x = 0; x < N; x++) {
              const p = (y * N + x) * 4;
              if (a[p + 3] < 8 || !isClothPixel(a[p], a[p + 1], a[p + 2])) continue;
              const [r, gg, b] = recolorRgb(a[p], a[p + 1], a[p + 2], i, cfg);
              a[p] = r; a[p + 1] = gg; a[p + 2] = b;
            }
          }
          g.putImageData(d, 0, 0);
          faces.set(i, cv.toDataURL('image/png'));
        }
        resolve(true);
      } catch { resolve(false); }
    };
    img.onerror = () => resolve(false);
    img.src = portraitSrc(NAMELESS_BASE);
  });
  return making;
}
