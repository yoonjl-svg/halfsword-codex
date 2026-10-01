// ─────────────────────────────────────────────────────────────
//  배경: 바닷가 절벽 위, 무너진 포세이돈 신전 (수니온 곶 같은 곳)
//   회색 모래 바닥(그대로) · 모래에 반쯤 묻힌 금 간 대리석 테두리(경기장 경계) · 쓰러진 기둥 토막과 주두 ·
//   부러진 도리스식 기둥들과 몇 군데 남은 들보 · 기울어 누운 박공 조각 · 머리 없는 포세이돈 석상 ·
//   절벽 너머 잔잔한 바다와 흐린 늦은 오후 하늘. 관중도 깃발도 없다 — 고요 속의 결투.
//  폰에서도 가볍게: 같은 재질끼리 하나로 합치고(merge), 풀·덤불은 인스턴싱으로 한 번에 그린다.
//  그림(질감)은 전부 캔버스에 코드로 그린다 → 파일 없음.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARENA } from './config.js';

function rng(seed) {
  let x = seed;
  return () => ((x = (x * 16807) % 2147483647) / 2147483647);
}

function canvasTex(w, h, draw, repeat = [1, 1], color = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace; // (법선 지도처럼 색이 아닌 값은 그대로 둔다)
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}

/** 이음매 없이 되풀이되는 그림: 가장자리에 걸친 모양은 반대편에도 한 번 더 그린다 */
function wrapDraw(w, h, x, y, rad, fn) {
  for (const dx of [-w, 0, w])
    for (const dy of [-h, 0, h]) {
      const px = x + dx;
      const py = y + dy;
      if (px + rad < 0 || px - rad > w || py + rad < 0 || py - rad > h) continue;
      fn(px, py);
    }
}

/** 위치로 정하는 난수 (같은 자리에 있는 꼭짓점은 같은 값 → 같이 움직여서 틈이 안 생긴다) */
function h3(x, y, z, s) {
  const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + s * 4.581) * 43758.5453;
  return v - Math.floor(v);
}

// 바닥: 회색 모래 (얼룩, 발자국, 자갈). 누런 모래에서 회색으로 바꿈 (사장님 결정) — 그대로 둔다
function sandTexture() {
  const r = rng(7);
  return canvasTex(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = '#9d9a94';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2500; i++) {
        const v = Math.floor(130 + r() * 60);
        g.fillStyle = `rgba(${v},${v - 2},${v - 6},${0.25 + r() * 0.3})`;
        g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3);
      }
      // 발자국/긁힌 자국
      for (let i = 0; i < 60; i++) {
        const x = r() * w;
        const y = r() * h;
        g.save();
        g.translate(x, y);
        g.rotate(r() * Math.PI);
        g.fillStyle = 'rgba(70,68,64,0.18)';
        g.beginPath();
        g.ellipse(0, 0, 5 + r() * 4, 11 + r() * 6, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      for (let i = 0; i < 180; i++) {
        const v = Math.floor(90 + r() * 70);
        g.fillStyle = `rgb(${v},${v - 2},${v - 5})`;
        g.beginPath();
        g.arc(r() * w, r() * h, 1 + r() * 2.5, 0, Math.PI * 2);
        g.fill();
      }
    },
    [10, 10],
  );
}

// 오래 비바람을 맞은 대리석: 흰 바탕에 빗물 얼룩, 누런 녹물, 검은 이끼 점, 가는 금
function marbleTexture() {
  const r = rng(11);
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#e4e0d6';
    g.fillRect(0, 0, w, h);
    const blot = (x, y, rad, rgb, a) =>
      wrapDraw(w, h, x, y, rad, (px, py) => {
        const gr = g.createRadialGradient(px, py, 0, px, py, rad);
        gr.addColorStop(0, `rgba(${rgb},${a})`);
        gr.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = gr;
        g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
      });
    for (let i = 0; i < 26; i++) blot(r() * w, r() * h, 40 + r() * 90, '120,116,106', 0.1 + r() * 0.12); // 잿빛 얼룩
    for (let i = 0; i < 12; i++) blot(r() * w, r() * h, 30 + r() * 70, '176,146,98', 0.08 + r() * 0.1); // 누런 녹물
    for (let i = 0; i < 10; i++) blot(r() * w, r() * h, 20 + r() * 40, '236,232,222', 0.35); // 씻겨서 밝은 곳
    // 잔 점
    for (let i = 0; i < 1800; i++) {
      const v = Math.floor(160 + r() * 80);
      g.fillStyle = `rgba(${v},${v - 3},${v - 10},${0.15 + r() * 0.25})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
    // 옅은 이끼 얼룩 (흩어진 작은 점)
    for (let i = 0; i < 16; i++) {
      const cx = r() * w;
      const cy = r() * h;
      for (let k = 0; k < 9; k++) {
        const x = cx + (r() - 0.5) * 50;
        const y = cy + (r() - 0.5) * 36;
        g.fillStyle = `rgba(${78 + r() * 20},${82 + r() * 20},${70 + r() * 15},${0.1 + r() * 0.16})`;
        g.beginPath();
        g.arc(x, y, 0.6 + r() * 1.6, 0, Math.PI * 2);
        g.fill();
      }
    }
    // 흐린 결(베인)과 가는 금
    for (let i = 0; i < 12; i++) {
      const crack = i < 5;
      g.strokeStyle = crack ? `rgba(84,80,72,${0.18 + r() * 0.16})` : `rgba(140,136,128,${0.1 + r() * 0.1})`;
      g.lineWidth = crack ? 0.8 + r() * 0.7 : 2 + r() * 4;
      g.beginPath();
      let x = r() * w;
      let y = r() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 7; k++) g.lineTo((x += (r() - 0.5) * 60), (y += (r() - 0.3) * 40));
      g.stroke();
    }
  });
}

// 기둥 겉면 (u = 기둥 둘레, 홈 16개 / v = 높이 7m): 세로 빗물 자국, 아래쪽 모래 튄 얼룩
const FLUTES = 16; // 수니온 신전 기둥은 홈이 16개
const COL_H = 7.0; // 온전한 기둥 몸통 높이
function fluteTexture() {
  const r = rng(23);
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#e4e0d5';
    g.fillRect(0, 0, w, h);
    // 홈 안쪽은 살짝 그늘
    const fw = w / FLUTES;
    for (let i = 0; i < FLUTES; i++) {
      const gr = g.createLinearGradient(i * fw, 0, (i + 1) * fw, 0);
      gr.addColorStop(0, 'rgba(255,255,250,0.25)');
      gr.addColorStop(0.5, 'rgba(90,86,78,0.1)');
      gr.addColorStop(1, 'rgba(255,255,250,0.25)');
      g.fillStyle = gr;
      g.fillRect(i * fw, 0, fw, h);
    }
    // 얼룩
    for (let i = 0; i < 30; i++) {
      const x = r() * w;
      const y = r() * h;
      const rad = 20 + r() * 60;
      const warm = r() < 0.35;
      wrapDraw(w, h, x, y, rad, (px, py) => {
        const gr = g.createRadialGradient(px, py, 0, px, py, rad);
        gr.addColorStop(0, warm ? 'rgba(178,146,96,0.16)' : 'rgba(112,108,98,0.16)');
        gr.addColorStop(1, 'rgba(112,108,98,0)');
        g.fillStyle = gr;
        g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
      });
    }
    // 세로 빗물 자국
    for (let i = 0; i < 70; i++) {
      const x = r() * w;
      const y = r() * h * 0.8;
      const len = 30 + r() * 180;
      const gr = g.createLinearGradient(0, y, 0, y + len);
      const a = 0.08 + r() * 0.18;
      gr.addColorStop(0, `rgba(88,84,76,${a})`);
      gr.addColorStop(1, 'rgba(88,84,76,0)');
      g.fillStyle = gr;
      g.fillRect(x, y, 1.5 + r() * 4, len);
    }
    // 잔 점, 이끼
    for (let i = 0; i < 1400; i++) {
      const v = Math.floor(150 + r() * 90);
      g.fillStyle = `rgba(${v},${v - 3},${v - 10},${0.15 + r() * 0.25})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
    for (let i = 0; i < 110; i++) {
      g.fillStyle = `rgba(72,76,66,${0.12 + r() * 0.2})`;
      g.beginPath();
      g.arc(r() * w, r() * h, 0.7 + r() * 1.8, 0, Math.PI * 2);
      g.fill();
    }
    // 밑동: 모래 튄 누런 얼룩 (캔버스 아래쪽 = 기둥 아래쪽)
    const gr = g.createLinearGradient(0, h * 0.86, 0, h);
    gr.addColorStop(0, 'rgba(138,128,108,0)');
    gr.addColorStop(1, 'rgba(138,128,108,0.5)');
    g.fillStyle = gr;
    g.fillRect(0, h * 0.86, w, h * 0.14);
  });
}

// 기둥 홈의 법선 지도: 둘레 방향으로 오목한 홈 16개 (빛을 받는 쪽/그늘 쪽이 진짜처럼 바뀐다)
function fluteNormalTexture() {
  return canvasTex(
    256,
    2,
    (g, w, h) => {
      const img = g.createImageData(w, h);
      for (let x = 0; x < w; x++) {
        const t = ((x + 0.5) / (w / FLUTES)) % 1; // 홈 하나 안에서의 위치 0~1
        const nu = 0.62 * Math.cos(Math.PI * t); // 홈 가장자리(모서리)에서 가장 기울고 한가운데는 평평
        const nz = Math.sqrt(1 - nu * nu);
        for (let y = 0; y < h; y++) {
          const i = (y * w + x) * 4;
          img.data[i] = Math.round((nu * 0.5 + 0.5) * 255);
          img.data[i + 1] = 128;
          img.data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
          img.data[i + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
    },
    [1, 1],
    false,
  );
}

// 절벽 바위: 누런 잿빛 석회암, 가로 지층과 세로 틈
function rockTexture() {
  const r = rng(31);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8b857a';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; ) {
      const bh = 4 + r() * 16;
      const v = Math.floor(115 + r() * 45);
      g.fillStyle = `rgba(${v},${v - 5},${v - 14},0.45)`;
      g.fillRect(0, y, w, bh);
      y += bh;
    }
    for (let i = 0; i < 900; i++) {
      const v = Math.floor(80 + r() * 90);
      g.fillStyle = `rgba(${v},${v - 4},${v - 10},${0.2 + r() * 0.3})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2);
    }
    g.strokeStyle = 'rgba(52,48,42,0.45)';
    for (let i = 0; i < 18; i++) {
      g.lineWidth = 0.8 + r() * 1.5;
      g.beginPath();
      let x = r() * w;
      let y = r() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) g.lineTo((x += (r() - 0.5) * 14), (y += 8 + r() * 18));
      g.stroke();
    }
    for (let i = 0; i < 14; i++)
      wrapDraw(w, h, r() * w, r() * h, 18, (px, py) => {
        g.fillStyle = `rgba(112,116,96,${0.12 + r() * 0.12})`; // 이끼 낀 곳
        g.beginPath();
        g.ellipse(px, py, 8 + r() * 10, 5 + r() * 6, 0, 0, Math.PI * 2);
        g.fill();
      });
  });
}

// 바다 물결: 잔 점과 짧은 줄 (멀리 볼수록 눌려서 가로 물결처럼 보인다). 색은 꼭짓점 색으로 입힌다
const SEA_TEX_AVG = 0.78; // 이 질감의 평균 밝기(선형) — 꼭짓점 색을 이만큼 나눠서 원하는 색이 나오게
function seaTexture() {
  const r = rng(41);
  return canvasTex(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = '#e6e6e6';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 700; i++) {
        const x = r() * w;
        const y = r() * h;
        const len = 3 + r() * 16;
        const light = r() < 0.5;
        const a = 0.2 + r() * 0.4;
        const rot = (r() - 0.5) * 0.8;
        const th = 1.5 + r() * 1.5;
        wrapDraw(w, h, x, y, len, (px, py) => {
          g.fillStyle = light ? `rgba(255,255,255,${a})` : `rgba(140,150,156,${a})`;
          g.save();
          g.translate(px, py);
          g.rotate(rot);
          g.fillRect(-len / 2, -1, len, th);
          g.restore();
        });
      }
    },
    [100, 100],
  );
}

// 흐린 늦은 오후 하늘 (위는 잿빛 파랑, 지평선은 옅은 안개) + 수평선 아래는 먼 바다 빛, 먼 섬 그림자, 구름 뒤 해
//  구의 u = 방위(0.5 가 +x 방향), 캔버스 위쪽 = 천정, 가운데 줄 = 수평선
const SUN_AZ = Math.atan2(3, 4); // main.js 해 방향 (4, 9, 3) 의 방위
const SHEEN_AZ = -0.32; // 구름 틈으로 빛이 내려 바다가 은빛으로 빛나는 방위 (기본 화면에서 석상 뒤쪽)
const SEA_FAR = '#87949b'; // 수평선 가까운 먼 바다 색 (하늘 구의 수평선 아래 띠와 같게)
function skyTexture() {
  const r = rng(5);
  return canvasTex(512, 256, (g, w, h) => {
    const hz = h * 0.5; // 수평선
    const gr = g.createLinearGradient(0, 0, 0, hz);
    gr.addColorStop(0, '#8b97a1');
    gr.addColorStop(0.44, '#a4adb3');
    gr.addColorStop(0.8, '#c3c5c2');
    gr.addColorStop(0.94, '#d3d0c6');
    gr.addColorStop(1, '#dbd6ca');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, hz);
    const sx = (0.5 - SUN_AZ / (Math.PI * 2)) * w;
    // 해 쪽 지평선이 조금 더 밝고 따뜻하다 (구름 뒤에 숨은 해의 번짐은 아래 구름과 함께 그린다)
    g.save();
    g.translate(sx, h * 0.47);
    g.scale(1, 0.18);
    let rg = g.createRadialGradient(0, 0, 0, 0, 0, 170);
    rg.addColorStop(0, 'rgba(246,236,216,0.45)');
    rg.addColorStop(1, 'rgba(246,236,216,0)');
    g.fillStyle = rg;
    g.fillRect(-170, -170, 340, 340);
    g.restore();
    // 수평선 가까이 멀리 깔린 층구름: 낮게 보이는 먼 구름은 가로로 눌린 옅은 줄로 보인다 (높이 30° 아래만)
    for (let i = 0; i < 46; i++) {
      const y = h * (0.34 + Math.pow(r(), 0.6) * 0.14);
      const x = r() * w;
      const rx = 30 + r() * 140;
      const ry = 1.5 + r() * 4.5;
      const light = r() < 0.6;
      const a = (light ? 0.1 + r() * 0.14 : 0.06 + r() * 0.08) * THREE.MathUtils.smoothstep(y / h, 0.33, 0.4);
      for (const dx of [-w, 0, w]) {
        g.fillStyle = light ? `rgba(238,236,230,${a})` : `rgba(140,148,156,${a})`;
        g.beginPath();
        g.ellipse(x + dx, y, rx, ry, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    // 구름 뒤에 숨은 해의 번짐 + 머리 위 층구름: 높이 떠 있는 평평한 구름층에 바람 방향으로 길게 늘어진 옅은 얼룩
    //  (밝은 구름 + 잿빛 구름 밑면). 칸마다 하늘 방향을 계산해서 그린다 → 해 번짐은 천정 쪽으로 뾰족하게 찌그러지지 않고,
    //  구름층 무늬는 올려다봐도 천정을 도는 소용돌이가 아니라 한 방향으로 나란한 줄로 보인다.
    //  수평선 쪽으로 갈수록 무늬가 한 칸보다 잘아지면 그만큼 흐리게 풀어 준다 (깜빡이는 잔무늬 없이 옅은 안개처럼)
    {
      const sun = new THREE.Vector3(4, 9, 3).normalize(); // main.js 해 방향
      const cw = w / 2; // 반 해상도로 계산해 부드럽게 늘려 붙인다 (하늘 한 칸이 원래 흐릿하다)
      const ch = Math.floor(hz / 2);
      const cc = document.createElement('canvas');
      cc.width = cw;
      cc.height = ch;
      const cg = cc.getContext('2d');
      const img = cg.createImageData(cw, ch);
      const px = img.data;
      const hash = (ix, iy, s) => {
        let n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 982451653)) | 0;
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
      };
      const vnoise = (x, y, s) => {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const fx = x - ix;
        const fy = y - iy;
        const ux = fx * fx * (3 - 2 * fx);
        const uy = fy * fy * (3 - 2 * fy);
        const a = hash(ix, iy, s);
        const b = hash(ix + 1, iy, s);
        const c = hash(ix, iy + 1, s);
        const d = hash(ix + 1, iy + 1, s);
        return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
      };
      // 잔무늬가 한 칸(fp: 한 칸이 무늬 몇 주기인지)보다 잘면 평균(0.5)으로 풀어 준 여러 겹 노이즈
      const fbm = (x, y, fp, s) => {
        let v = 0.5;
        let amp = 0.5;
        let f = 1;
        for (let o = 0; o < 3; o++) {
          const keep = THREE.MathUtils.clamp(1.5 - fp * f * 3, 0, 1);
          if (keep > 0) v += amp * keep * (vnoise(x * f, y * f, s + o) - 0.5);
          amp *= 0.5;
          f *= 2.1;
        }
        return v;
      };
      const WA = Math.atan2(0.35, 1); // 바람 방향 (떠다니는 먼지가 흘러가는 쪽)
      const FA = 0.8; // 바람 방향 무늬 빈도 (구름층 높이 = 1)
      const FC = 2.6; // 가로 방향 무늬 빈도 → 바람 방향으로 3배쯤 길쭉한 부드러운 얼룩
      const dEl = Math.PI / (ch * 2); // 한 칸의 높이각 (천정~수평선 = ch 칸)
      const dAz = (Math.PI * 2) / cw;
      for (let y = 0; y < ch; y++) {
        const el = Math.PI / 2 - (Math.PI * (y + 0.5)) / (ch * 2);
        const fade = THREE.MathUtils.smoothstep(el, 0.22, 0.55); // 수평선 쪽은 위의 가로 줄구름이 맡는다
        const k = Math.cos(el) / Math.max(Math.sin(el), 1e-3); // 구름층에서 잰 수평 거리 (높이 = 1)
        const kr = dEl / (Math.sin(el) * Math.sin(el)); // 한 칸의 앞뒤 폭
        const kt = k * dAz; // 한 칸의 옆 폭
        for (let x = 0; x < cw; x++) {
          const az = Math.PI - (Math.PI * 2 * (x + 0.5)) / cw;
          const ra = Math.cos(az - WA); // 바라보는 쪽이 바람 방향과 얼마나 나란한지
          const rc = Math.sin(az - WA);
          const a = k * ra;
          const c = k * rc;
          const fp = Math.max(kr * Math.hypot(FA * ra, FC * rc), kt * Math.hypot(FA * rc, FC * ra));
          // 해 번짐 (해에서 멀어질수록 옅게)
          const cosE = Math.cos(el);
          const ang = Math.acos(THREE.MathUtils.clamp(Math.cos(az) * cosE * sun.x + Math.sin(el) * sun.y + Math.sin(az) * cosE * sun.z, -1, 1));
          const sa = 0.6 * Math.max(0, 1 - ang / 0.95) ** 1.4;
          let la = 0;
          let da = 0;
          if (fade > 0) {
            // 노이즈 값(평균 0.5, 퍼짐 약 0.11)을 표준 점수로 바꿔 덮이는 정도를 정한다
            const z1 = (fbm(a * FA, c * FC, fp, 11) - 0.5) / 0.11;
            const z2 = (fbm(a * FA * 0.8 + 5.3, c * FC * 0.9 + 2.7, fp, 23) - 0.5) / 0.11;
            la = THREE.MathUtils.smoothstep(z1, -0.2, 1.8) * 0.34 * fade; // 밝은 구름
            da = THREE.MathUtils.smoothstep(z2, 0.3, 2.0) * 0.2 * fade; // 잿빛 구름 밑면
          }
          // 해 번짐 → 밝은 구름 → 잿빛 구름 순서로 겹쳐 한 장으로 (미리 곱한 색으로 합성)
          let R = 252 * sa;
          let G = 246 * sa;
          let B = 232 * sa;
          let A = sa;
          R = 238 * la + R * (1 - la);
          G = 236 * la + G * (1 - la);
          B = 230 * la + B * (1 - la);
          A = la + A * (1 - la);
          R = 140 * da + R * (1 - da);
          G = 148 * da + G * (1 - da);
          B = 156 * da + B * (1 - da);
          A = da + A * (1 - da);
          if (A <= 0.002) continue;
          const i = (y * cw + x) * 4;
          px[i] = R / A;
          px[i + 1] = G / A;
          px[i + 2] = B / A;
          px[i + 3] = A * 255;
        }
      }
      cg.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(cc, 0, 0, w, ch * 2);
    }
    // 수평선 아래: 먼 바다 빛 (바다 판 가장자리 색과 같게 → 이음매 없이 수평선까지 바다가 이어진다)
    const sg = g.createLinearGradient(0, hz, 0, h);
    sg.addColorStop(0, SEA_FAR);
    sg.addColorStop(0.12, '#7d8b92');
    sg.addColorStop(1, '#5d6d76');
    g.fillStyle = sg;
    g.fillRect(0, hz, w, h - hz);
    // 먼 섬들 (수평선 위 낮은 그림자)
    for (const [u, width, top, col] of [
      [0.1, 60, 5, 'rgba(160,168,172,0.85)'],
      [0.16, 26, 2.5, 'rgba(176,182,184,0.8)'],
      [0.74, 44, 3.5, 'rgba(168,175,178,0.8)'],
      [0.86, 80, 6, 'rgba(154,162,167,0.85)'],
    ]) {
      const cx = u * w;
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(cx - width / 2, hz + 0.5);
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        const bump = Math.sin(t * Math.PI) ** 0.7 * top * (0.75 + 0.25 * Math.sin(t * 17 + u * 40));
        g.lineTo(cx - width / 2 + t * width, hz - bump);
      }
      g.lineTo(cx + width / 2, hz + 0.5);
      g.fill();
    }
    // 구름 틈 아래 먼 바다의 은빛 (바다 판의 은빛과 같은 방위)
    for (const [az, rad, a] of [
      [SHEEN_AZ, 70, 0.85],
      [SUN_AZ, 55, 0.4],
    ]) {
      g.save();
      g.translate((0.5 - az / (Math.PI * 2)) * w, hz + 1.5);
      g.scale(1, 0.04);
      rg = g.createRadialGradient(0, 0, 0, 0, 0, rad);
      rg.addColorStop(0, `rgba(226,228,223,${a})`);
      rg.addColorStop(1, 'rgba(226,228,223,0)');
      g.fillStyle = rg;
      g.fillRect(-rad, -rad, rad * 2, rad * 2);
      g.restore();
    }
  });
}

// 마른 풀 한 포기 (투명 바탕)
function grassTexture() {
  const r = rng(53);
  return canvasTex(
    64,
    64,
    (g, w, h) => {
      for (let i = 0; i < 16; i++) {
        const x0 = w / 2 + (r() - 0.5) * 22;
        const x1 = x0 + (r() - 0.5) * 40;
        const y1 = 6 + r() * 26;
        const v = Math.floor(120 + r() * 60);
        g.strokeStyle = `rgb(${v + 10},${v + 4},${v - 30})`;
        g.lineWidth = 1.4 + r() * 1.4;
        g.beginPath();
        g.moveTo(x0, h);
        g.quadraticCurveTo(x0 + (x1 - x0) * 0.2, (h + y1) / 2, x1, y1);
        g.stroke();
      }
    },
    [1, 1],
  );
}

// 부유하는 먼지 한 톨 (부드러운 점)
function moteTexture() {
  return canvasTex(32, 32, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, w);
  });
}

/** 모서리를 조금씩 깨뜨린다 (위치로 정한 난수라 맞닿은 면은 같이 움직인다) */
function roughen(g, amt, seed) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = Math.round(p.getX(i) * 1e4) / 1e4;
    const y = Math.round(p.getY(i) * 1e4) / 1e4;
    const z = Math.round(p.getZ(i) * 1e4) / 1e4;
    p.setXYZ(i, x + (h3(x, y, z, seed) - 0.5) * amt, y + (h3(y, z, x, seed + 1) - 0.5) * amt, z + (h3(z, x, y, seed + 2) - 0.5) * amt);
  }
}

/** 면마다 가장 가까운 축 평면으로 질감을 투사한다 (크기가 제각각인 돌도 무늬 크기가 같게) */
function boxUV(g, s) {
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1).sub(a);
    c.fromBufferAttribute(p, i + 2).sub(a);
    b.cross(c);
    const ax = Math.abs(b.x);
    const ay = Math.abs(b.y);
    const az = Math.abs(b.z);
    for (let k = i; k < i + 3; k++) {
      const x = p.getX(k);
      const y = p.getY(k);
      const z = p.getZ(k);
      if (ay >= ax && ay >= az) uv.setXY(k, x * s, z * s);
      else if (ax >= az) uv.setXY(k, z * s, y * s);
      else uv.setXY(k, x * s, y * s);
    }
  }
}

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * 여러 조각을 한 메쉬로 합쳐서 그리기 부담을 줄인다.
 * 조각마다 꼭짓점 색으로 밝기·색조를 조금씩 다르게 하고, 땅에 닿는 쪽은 어둡게(모래 얼룩) 칠한다.
 */
class Batch {
  constructor(seed) {
    this.geos = [];
    this.r = rng(seed);
    this.n = 0;
  }
  /** geo 를 (rotY, rotX, rotZ: 제자리에서 기울인 뒤 돌리는 순서) 돌리고 pos 로 옮긴다. opt.scale: 크기 (숫자나 [x,y,z]) */
  add(geo, pos, rotY = 0, rotX = 0, rotZ = 0, opt = {}) {
    const sc = opt.scale ?? 1;
    typeof sc === 'number' ? _s.setScalar(sc) : _s.set(...sc);
    const m = new THREE.Matrix4().compose(pos, _q.setFromEuler(_e.set(rotX, rotY, rotZ, 'YXZ')), _s);
    return this.addMatrix(geo, m, opt);
  }
  /**
   * opt.rough: 모서리 깨짐(m, 제 크기 기준) · opt.uv: 'box'(기본) | 'keep' · opt.uvScale: 질감 1장 = 1/uvScale m
   * opt.tint: 색 [r,g,b] · opt.vary: 조각마다 밝기 차이 · opt.dirt: false 면 땅 얼룩 없음
   */
  addMatrix(geo, m, opt = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.clearGroups();
    if (opt.rough) {
      roughen(g, opt.rough, 17 + this.n * 7);
      g.computeVertexNormals();
    }
    g.applyMatrix4(m);
    if (opt.uv !== 'keep') boxUV(g, opt.uvScale ?? 0.4);
    // 꼭짓점 색
    const r = this.r;
    const tint = opt.tint ?? [1, 1, 1];
    const j = 1 + (r() - 0.5) * (opt.vary ?? 0.14);
    const warm = (r() - 0.5) * 0.06;
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const dirt = opt.dirt === false ? 1 : THREE.MathUtils.clamp(0.74 + (0.26 * (y - (opt.ground ?? 0))) / 0.8, 0.74, 1);
      const nz = 1 + (h3(p.getX(i), y, p.getZ(i), 3) - 0.5) * 0.1;
      const k = j * dirt * nz;
      col[i * 3] = tint[0] * k * (1 + warm);
      col[i * 3 + 1] = tint[1] * k;
      col[i * 3 + 2] = tint[2] * k * (1 - warm);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.geos.push(g);
    this.n++;
    return g;
  }
  mesh(material, cast = false, receive = true) {
    const m = new THREE.Mesh(mergeGeometries(this.geos, false), material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
  }
}

// ── 기둥 부품 ──
const STY = 0.3; // 기단(스틸로베이트) 윗면 높이
const COL_R0 = 0.6; // 기둥 밑동 반지름
const COL_R1 = 0.47; // 기둥 꼭대기 반지름 (위로 갈수록 가늘다)
const colR = (y) => COL_R0 + (COL_R1 - COL_R0) * (y / COL_H);
const CAP_TOP = STY + COL_H + 0.42 + 0.32; // 주두(에키누스 + 아바쿠스) 윗면

/**
 * 기둥 토막(드럼) 하나. y0 = 기둥 안에서 이 토막이 시작하는 높이 (질감 높이·굵기를 맞춘다).
 * jag > 0 이면 윗면이 부러진 모양으로 들쭉날쭉하다.
 * seam: 서 있는 기둥의 이음매용. 윗면·밑면(부러진 윗면은 빼고)의 법선을 옆면처럼 바깥쪽으로 눕혀서,
 *  어긋난 이음매로 살짝 드러나는 면 테두리가 기둥 옆면과 같은 밝기로 보이게 한다 (가는 밝은/어두운 점선이 안 생긴다)
 */
function drumGeo(y0, h, closed, jag = 0, seed = 1, seam = false) {
  const g = new THREE.CylinderGeometry(colR(y0 + h), colR(y0), h, FLUTES, 1, !closed);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const uv = g.attributes.uv;
  const dir = seed * 2.39;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const cap = Math.abs(n.getY(i)) > 0.9;
    if (cap) uv.setXY(i, 0.5 / FLUTES, (y0 + y) / COL_H); // 윗면·밑면: 홈 한가운데(평평한 곳) 색, 같은 높이의 옆면 색
    else uv.setY(i, (y0 + y) / COL_H);
    if (seam && cap && !(jag && n.getY(i) > 0)) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const rr = Math.hypot(x, z);
      n.setXYZ(i, rr > 1e-4 ? x / rr : 1, 0, rr > 1e-4 ? z / rr : 0);
    }
    if (jag && y > h - 1e-4) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const rr = Math.hypot(x, z);
      const k = rr < 1e-3 ? 0.55 : h3(Math.round(x * 1e3), 0, Math.round(z * 1e3), seed);
      p.setY(i, y - jag * k - (jag * 0.7 * (x * Math.cos(dir) + z * Math.sin(dir))) / COL_R0);
    }
  }
  return g;
}

/**
 * 경기장을 만든다. 반환: { update(dt), excite(amount) }
 *  excite: 큰 타격이 나오면 떠다니는 먼지가 잠깐 흩날린다 (관중은 없다)
 */
export function buildArena(scene) {
  const r = rng(42);
  const marbleTex = marbleTexture();
  const marble = new THREE.MeshStandardMaterial({ map: marbleTex, vertexColors: true, roughness: 0.9 });
  const fluted = new THREE.MeshStandardMaterial({ map: fluteTexture(), normalMap: fluteNormalTexture(), vertexColors: true, roughness: 0.86 });
  const rock = new THREE.MeshStandardMaterial({ map: rockTexture(), vertexColors: true, roughness: 1, flatShading: true });

  // 가까운 돌(경계 테두리·잔해: 그림자를 드리운다) / 먼 돌(신전·석상: 그림자 계산 안 함)
  const nearStone = new Batch(101);
  const nearCol = new Batch(102);
  const farStone = new Batch(103);
  const farCol = new Batch(104);
  const cliff = new Batch(105);

  // ── 하늘 ──
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 48, 24),
    new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false, map: skyTexture() }),
  );
  scene.add(sky);

  // ── 절벽 위 평지 (회색 모래) : 가장자리가 들쭉날쭉한 곶 ──
  //  신전 기단(가로 ±16.9, 세로 ±13.4)까지는 평평하고, 그 바깥은 벼랑 끝으로 갈수록 둥글게 내려앉는다
  //  (그래서 싸우는 자리에서도 기둥 사이로 바다가 넓게 보인다). 바다 쪽(+x)이 가장 가깝다
  const rectR = (a) => Math.min(16.9 / Math.max(Math.abs(Math.cos(a)), 1e-3), 13.4 / Math.max(Math.abs(Math.sin(a)), 1e-3));
  const edgeR = (a) => {
    const wob = 1.1 * Math.sin(3 * a + 0.7) + 0.7 * Math.sin(5 * a + 2.1) + 0.45 * Math.sin(11 * a + 4.0);
    return Math.max(rectR(a) + 3.6 + 0.5 * wob, 19.2 + 2.6 * (0.5 - 0.5 * Math.cos(a)) + wob);
  };
  const DROP = 2.2; // 신전 기단에서 벼랑 끝까지 내려앉는 높이
  /** 땅 높이: 기단 둘레 0.9m 까지는 0, 그 바깥은 벼랑 끝(-DROP)까지 점점 가파르게 */
  const groundY = (x, z) => {
    const a = Math.atan2(z, x);
    const r0 = rectR(a) + 0.9;
    const u = THREE.MathUtils.clamp((Math.hypot(x, z) - r0) / (edgeR(a) - r0), 0, 1);
    return -DROP * u * u;
  };
  const EN = 144;
  const edge = [];
  for (let i = 0; i < EN; i++) {
    const a = (i / EN) * Math.PI * 2;
    edge.push({ a, R: edgeR(a), r0: rectR(a) + 0.9 });
  }
  {
    // 모래판: 가운데 한 점 + 안쪽 고리 3줄(3·6·9m) + 평평한 안쪽 테 + 내려앉는 바깥 테 4줄. 무늬 크기·위치는 예전 원판(반지름 30)과 같게
    //  (가운데를 고리로 잘게 나눈다: 가운데 점에서 15m 넘게 뻗은 큰 삼각형은 가운데 점이 카메라 뒤로 가면
    //   일부 그래픽 칩에서 통째로 뭉개져 바닥이 민짜 판처럼 그려진다)
    const INNER = [3, 6, 9];
    const RING_U = [0, 0.3, 0.55, 0.8, 1];
    const pos = [0, 0, 0];
    const uv = [0.5, 0.5];
    const idx = [];
    for (const d of INNER)
      for (let i = 0; i < EN; i++) {
        const x = Math.cos(edge[i].a) * d;
        const z = Math.sin(edge[i].a) * d;
        pos.push(x, 0, z);
        uv.push(x / 60 + 0.5, -z / 60 + 0.5);
      }
    for (let k = 0; k < RING_U.length; k++)
      for (let i = 0; i < EN; i++) {
        const { a, R, r0 } = edge[i];
        const u = RING_U[k];
        const d = r0 + (R - r0) * u;
        const x = Math.cos(a) * d;
        const z = Math.sin(a) * d;
        pos.push(x, -DROP * u * u, z);
        uv.push(x / 60 + 0.5, -z / 60 + 0.5);
      }
    for (let i = 0; i < EN; i++) idx.push(0, 1 + ((i + 1) % EN), 1 + i);
    for (let k = 0; k < INNER.length + RING_U.length - 1; k++)
      for (let i = 0; i < EN; i++) {
        const a0 = 1 + k * EN + i;
        const a1 = 1 + k * EN + ((i + 1) % EN);
        idx.push(a0, a1, a0 + EN, a1, a1 + EN, a0 + EN);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const sand = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 }));
    sand.receiveShadow = true;
    scene.add(sand);
  }
  // 자갈
  const pebbles = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.03, 0), new THREE.MeshStandardMaterial({ color: 0x75736e, roughness: 1 }), 220);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 220; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * ARENA.radius;
    const s = 0.4 + r() * 1.6;
    m4.compose(new THREE.Vector3(Math.cos(a) * d, 0.01, Math.sin(a) * d), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, 0)), new THREE.Vector3(s, s * 0.6, s));
    pebbles.setMatrixAt(i, m4);
  }
  pebbles.receiveShadow = true;
  scene.add(pebbles);

  // ── 절벽: 평지 가장자리에서 바다까지 깎아지른 바위 ──
  {
    const rings = [
      [0, 0],
      [0.45, -0.35],
      [1.2, -2.0],
      [1.9, -5.8],
      [2.9, -10.5],
      [3.9, -15.5],
      [5.3, -21],
      [6.9, -28],
    ];
    const pos = [];
    const idx = [];
    for (let k = 0; k < rings.length; k++)
      for (let i = 0; i < EN; i++) {
        const { a, R } = edge[i];
        const n = k === 0 ? 0 : 1;
        const out = rings[k][0] + n * (h3(i, k, 1, 9) - 0.5) * 1.4;
        const y = -DROP + rings[k][1] + n * (h3(i, k, 2, 9) - 0.5) * 1.2;
        const aa = a + n * (h3(i, k, 3, 9) - 0.5) * 0.02;
        pos.push(Math.cos(aa) * (R + out), y, Math.sin(aa) * (R + out));
      }
    for (let k = 0; k < rings.length - 1; k++)
      for (let i = 0; i < EN; i++) {
        const a0 = k * EN + i;
        const a1 = k * EN + ((i + 1) % EN);
        const b0 = a0 + EN;
        const b1 = a1 + EN;
        idx.push(a0, a1, b0, a1, b1, b0);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
    g.setIndex(idx);
    cliff.addMatrix(g, new THREE.Matrix4(), { uvScale: 1 / 6, dirt: false, vary: 0 });
    cliff.geos[cliff.geos.length - 1].computeVertexNormals();
    // 벼랑 끝 바위
    for (let i = 0; i < 40; i++) {
      const a = r() * Math.PI * 2;
      const R = edgeR(a) - 0.1 - r() * 0.9;
      const s = 0.35 + r() * 0.9;
      const x = Math.cos(a) * R;
      const z = Math.sin(a) * R;
      cliff.add(new THREE.IcosahedronGeometry(1, 0), new THREE.Vector3(x, groundY(x, z) + s * 0.1, z), r() * 6, r() * 0.5, r() * 0.5, {
        scale: [s * (1 + r()), s * (0.45 + r() * 0.3), s * (0.8 + r() * 0.6)],
        rough: 0.35,
        uvScale: 1 / 3,
        tint: [0.95, 0.93, 0.9],
      });
    }
    scene.add(cliff.mesh(rock, false, false));
  }

  // ── 바다: 절벽 아래 잔잔한 물. 멀수록 옅어져 수평선에서 하늘 아래쪽 빛과 이어지고, 구름 틈 아래로 은빛이 돈다 ──
  //  (안개 대신 꼭짓점 색으로 멀어지는 빛을 직접 칠한다 → 수평선이 또렷하다)
  const seaTex = seaTexture();
  {
    const g = new THREE.RingGeometry(18, 580, 128, 14);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    const near = new THREE.Color('#4a5d67');
    const mid = new THREE.Color('#5b6c75');
    const far = new THREE.Color(SEA_FAR);
    const sheen = new THREE.Color('#e2e4df');
    const c = new THREE.Color();
    const sheenAt = (az, center, width) => {
      const da = Math.atan2(Math.sin(az - center), Math.cos(az - center));
      return Math.exp(-((da / width) ** 2));
    };
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const d = Math.hypot(x, z);
      const az = Math.atan2(z, x);
      const s = (0.75 * sheenAt(az, SHEEN_AZ, 0.34) + 0.35 * sheenAt(az, SUN_AZ, 0.3)) * THREE.MathUtils.smoothstep(d, 140, 420);
      c.copy(near).lerp(mid, THREE.MathUtils.smoothstep(d, 40, 200)).lerp(far, THREE.MathUtils.smoothstep(d, 150, 575) ** 1.4).lerp(sheen, s);
      col[i * 3] = c.r / SEA_TEX_AVG; // 물결 질감의 평균 밝기만큼 되돌려 둔다
      col[i * 3 + 1] = c.g / SEA_TEX_AVG;
      col[i * 3 + 2] = c.b / SEA_TEX_AVG;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const sea = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: seaTex, vertexColors: true, fog: false }));
    sea.position.y = -25;
    scene.add(sea);
  }

  // ── 경기장 경계: 모래에 반쯤 묻힌 둥근 대리석 테두리 (옛 원형 제단터의 기초) ──
  const KIN = ARENA.radius + 0.12; // 테두리 안쪽 면 (보이지 않는 벽 6.75m 바로 앞)
  const KC = KIN + 0.25;
  {
    // 안쪽 바닥 돌 (모래와 거의 같은 높이, 금 가고 몇 장은 빠져 있다)
    const nP = 30;
    for (let i = 0; i < nP; i++) {
      if (r() < 0.13) continue;
      const a = ((i + 0.5) / nP) * Math.PI * 2 + (r() - 0.5) * 0.02;
      const inner = 5.95 + r() * 0.3;
      const rc = (inner + KIN - 0.02) / 2;
      const w = KIN - 0.02 - inner;
      const len = (2 * Math.PI * rc) / nP - 0.035 - r() * 0.05;
      const top = 0.008 + r() * 0.01;
      const yaw = -a + Math.PI / 2;
      const opt = { rough: 0.012, tint: [0.9, 0.88, 0.84], ground: -0.4 };
      if (r() < 0.25) {
        // 두 쪽으로 갈라진 돌
        const tang = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
        for (const s of [-1, 1]) {
          const p = new THREE.Vector3(Math.cos(a) * rc, top - 0.06, Math.sin(a) * rc).addScaledVector(tang, (s * (len + 0.03)) / 4);
          nearStone.add(new THREE.BoxGeometry(len / 2 - 0.015, 0.12, w, 2, 1, 1), p, yaw + s * 0.02, 0, 0, opt);
        }
      } else nearStone.add(new THREE.BoxGeometry(len, 0.12, w, 3, 1, 1), new THREE.Vector3(Math.cos(a) * rc, top - 0.06, Math.sin(a) * rc), yaw, 0, 0, opt);
    }
    // 테두리 돌 (0.2~0.4m 솟아 있다. 몇 개는 부러져 낮고, 떨어진 조각이 바깥에 뒹군다).
    //  뒤의 둘째 단·잔해보다 조금 어둡고 푸르스름한 잿빛 → 어느 쪽에서 봐도 경계 줄이 또렷하다
    const RIM_TINT = [0.84, 0.84, 0.83];
    const nK = 34;
    for (let i = 0; i < nK; i++) {
      const a = ((i + 0.5) / nK) * Math.PI * 2 + (r() - 0.5) * 0.012;
      const len = (2 * Math.PI * KC) / nK - 0.04 - r() * 0.07;
      const broken = r() < 0.13;
      const hv = broken ? 0.08 + r() * 0.06 : 0.2 + r() * 0.2;
      const H = hv + 0.35;
      const p = new THREE.Vector3(Math.cos(a) * KC, hv - H / 2, Math.sin(a) * KC);
      nearStone.add(new THREE.BoxGeometry(len, H, 0.5, 3, 1, 2), p, -a + Math.PI / 2, (r() - 0.5) * 0.07, (r() - 0.5) * 0.05, { rough: 0.06, tint: RIM_TINT });
      if (broken) {
        const rr = KC + 0.55 + r() * 0.5;
        const b = a + (r() - 0.5) * 0.08;
        nearStone.add(new THREE.BoxGeometry(0.35 + r() * 0.3, 0.2 + r() * 0.1, 0.3 + r() * 0.2, 2, 1, 1), new THREE.Vector3(Math.cos(b) * rr, 0.06, Math.sin(b) * rr), r() * 6, r() * 0.4, r() * 0.4, { rough: 0.08 });
      }
    }
    // 바깥쪽 둘째 단: 군데군데 남은 낮은 담 (0.45~0.95m, 끝은 계단처럼 낮아진다)
    const KC2 = KC + 0.52;
    for (const [a0, a1] of [
      [0.35, 1.25],
      [2.3, 3.0],
      [3.9, 4.75],
      [5.35, 5.8],
    ]) {
      const n = Math.max(2, Math.round(((a1 - a0) * KC2) / 1.3));
      for (let k = 0; k < n; k++) {
        const a = a0 + ((k + 0.5) / n) * (a1 - a0);
        const len = ((a1 - a0) * KC2) / n - 0.05;
        const endFall = Math.min(k, n - 1 - k); // 끝쪽일수록 낮다
        const hv = Math.min(0.95, 0.3 + endFall * 0.22 + r() * 0.2);
        const H = hv + 0.3;
        nearStone.add(new THREE.BoxGeometry(len, H, 0.48, 3, 2, 1), new THREE.Vector3(Math.cos(a) * KC2, hv - H / 2, Math.sin(a) * KC2), -a + Math.PI / 2, (r() - 0.5) * 0.05, (r() - 0.5) * 0.04, { rough: 0.07 });
      }
    }
  }

  // ── 테두리 바깥 잔해 (카메라를 가리지 않게 1m 아래로만): 누운 기둥 토막, 뒤집힌 주두, 떨어진 들보, 돌 조각 ──
  {
    const ring = (a, d) => new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d);
    // 누운 기둥 토막
    for (const [a, d, yaw, y0] of [
      [1.0, 8.7, 1.1, 2.2],
      [1.75, 9.3, 0.2, 4.4],
      [2.62, 8.1, 2.4, 1.1],
      [3.55, 9.5, 0.9, 3.3],
      [4.45, 8.4, 2.9, 5.5],
      [5.95, 9.0, 1.7, 0.0],
    ]) {
      const h = 1.0 + r() * 0.2;
      const rad = colR(y0 + h / 2);
      const p = ring(a, d).setY(rad - 0.14);
      nearCol.add(drumGeo(y0, h, true, r() < 0.4 ? 0.12 : 0, Math.floor(r() * 99)).translate(0, -h / 2, 0), p, yaw, 0, Math.PI / 2 + (r() - 0.5) * 0.08, { uv: 'keep', ground: -0.3 });
    }
    // 두 토막이 이어진 채 쓰러진 기둥 조각
    {
      const a = 5.2;
      const base = ring(a, 9.2);
      const yaw = -a + 0.3;
      const ax = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      for (let k = 0; k < 2; k++) {
        const y0 = 1.1 * k;
        const p = base.clone().addScaledVector(ax, k * 1.12).setY(colR(y0) - 0.15);
        nearCol.add(drumGeo(y0, 1.08, true).translate(0, -0.54, 0), p, yaw, 0, Math.PI / 2 + k * 0.03, { uv: 'keep', ground: -0.3 });
      }
    }
    // 뒤집혀 떨어진 주두 (아바쿠스가 땅에 박혔다)
    {
      const p = ring(0.3, 8.8);
      const yaw = 0.5;
      nearStone.add(new THREE.BoxGeometry(1.64, 0.32, 1.64, 2, 1, 2), p.clone().setY(0.1), yaw, 0.1, 0.05, { rough: 0.08 });
      nearStone.add(new THREE.CylinderGeometry(0.5, 0.8, 0.42, FLUTES), p.clone().setY(0.47).add(new THREE.Vector3(0.02, 0, 0.04)), yaw, 0.1, 0.05, { rough: 0.03 });
      nearCol.add(drumGeo(COL_H - 0.28, 0.28, true, 0.08, 7), p.clone().setY(0.66).add(new THREE.Vector3(0.05, 0, 0.08)), yaw, 0.1, 0.05, { uv: 'keep' });
    }
    // 떨어진 들보 (옆으로 누움)
    nearStone.add(new THREE.BoxGeometry(2.7, 0.85, 1.15, 4, 1, 2), ring(4.95, 9.4).setY(0.32), -4.95 + 1.9, 0.04, 0.03, { rough: 0.09 });
    nearStone.add(new THREE.BoxGeometry(1.6, 0.7, 0.95, 3, 1, 1), ring(1.05, 9.7).setY(0.25), 0.3, 0.06, 0.12, { rough: 0.09 });
    // 크고 작은 돌덩이
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2;
      const d = 7.6 + r() * 2.8;
      const s = 0.25 + r() * 0.55;
      nearStone.add(new THREE.BoxGeometry(s * (1 + r()), s * (0.6 + r() * 0.4), s * (0.8 + r() * 0.5), 2, 1, 2), ring(a, d).setY(s * 0.2), r() * 6, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5, { rough: s * 0.25 });
    }
    // 대리석 부스러기
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2;
      const d = KC + 0.35 + r() * 3.6;
      const s = 0.04 + r() * 0.12;
      nearStone.add(new THREE.IcosahedronGeometry(1, 0), ring(a, d).setY(s * 0.25), r() * 6, r() * 3, r() * 3, { scale: [s * (1 + r()), s * 0.6, s], rough: 0.4 });
    }
    // 성소(켈라) 담의 기초: 양쪽 끝에 낮게 남은 돌담 (가운데는 문 자리)
    for (const sx of [-1, 1]) {
      const x = sx * 10.4;
      for (let z = -4.5; z < 4.5; z += 1.25) {
        if (Math.abs(z + 0.62) < 1.5) continue; // 문 자리
        if (sx > 0 && z + 0.62 < 1.8) continue; // 석상 앞은 비운다
        const hv = sx > 0 ? 0.25 + r() * 0.3 : 0.35 + r() * 0.55;
        nearStone.add(new THREE.BoxGeometry(0.7, hv + 0.3, 1.2, 1, 1, 2), new THREE.Vector3(x + (r() - 0.5) * 0.06, (hv - 0.3) / 2, z + 0.62), (r() - 0.5) * 0.04, (r() - 0.5) * 0.05, 0, { rough: 0.06 });
      }
    }
  }

  const SP = new THREE.Vector3(11.6, 0, -6.0); // 포세이돈 석상 자리 (기본 화면에서 상대 왼쪽 뒤)

  // ── 신전: 가로(x) 30m × 세로(z) 22.8m 도리스식 주랑. 기둥 34개 중 몇 개만 온전하다 ──
  const XH = 15;
  const ZH = 11.4;
  const longX = Array.from({ length: 11 }, (_, k) => -XH + 3 * k);
  const shortZ = Array.from({ length: 8 }, (_, k) => -ZH + ((2 * ZH) / 7) * k);
  // 기둥 상태: 'F' = 주두까지 온전, 숫자 = 부러진 높이(m), 0 = 쓰러져 밑동만 (토막이 바깥으로 누워 있다)
  const columns = [];
  const LONG_P = [2.1, 0.6, 3.4, 0, 1.1, 'F', 'F', 'F', 'F', 'F', 'F']; // +z (기본 화면 오른쪽: 들보가 남은 줄)
  const LONG_N = ['F', 'F', 4.2, 0.9, 0, 2.4, 0.5, 6.1, 0.25, 3.0, 'F']; // −z
  const SHORT_P = [1.0, 1.8, 0.7, 0.45, 2.6, 'F']; // +x (석상 뒤, 바다 쪽: 가운데가 낮아 바다가 트인다. 석상 바로 뒤는 밑동만 → 석상이 하늘·바다를 등지고 선다)
  const SHORT_N = [1.4, 'F', 'F', 3.6, 0.8, 2.9]; // −x
  longX.forEach((x, k) => columns.push({ x, z: ZH, h: LONG_P[k], out: [0, 1] }));
  longX.forEach((x, k) => columns.push({ x, z: -ZH, h: LONG_N[k], out: [0, -1] }));
  shortZ.slice(1, 7).forEach((z, k) => columns.push({ x: XH, z, h: SHORT_P[k], out: [1, 0] }));
  shortZ.slice(1, 7).forEach((z, k) => columns.push({ x: -XH, z, h: SHORT_N[k], out: [-1, 0] }));

  // 기단: 기둥 줄 아래 넓은 판돌 + 바깥 낮은 계단 (모래에 묻혀 가며 금 가고 기울었다)
  {
    const slab = (x, z, lx, lz, top, opt = {}) => {
      const sink = r() < 0.18 ? 0.04 + r() * 0.08 : 0; // 몇 장은 가라앉아 기울었다
      farStone.add(new THREE.BoxGeometry(lx, 0.6, lz, 2, 1, 2), new THREE.Vector3(x, top - sink - 0.3, z), (r() - 0.5) * 0.015, (r() - 0.5) * (sink ? 0.05 : 0.01), (r() - 0.5) * (sink ? 0.05 : 0.01), { rough: 0.05, ...opt });
    };
    // 구간 [a, b] 를 n 장으로 나눠 깐다 (돌 사이 이음매 4cm)
    const tile = (a, b, n, fn) => {
      const L = (b - a) / n;
      for (let k = 0; k < n; k++) fn(a + L * (k + 0.5), L - 0.04);
    };
    const W = 2.6; // 기단 폭
    for (const sz of [-1, 1]) tile(-XH - 1.3, XH + 1.3, 16, (x, L) => slab(x, sz * ZH, L, W, STY));
    for (const sx of [-1, 1]) tile(-ZH + 1.3, ZH - 1.3, 10, (z, L) => slab(sx * XH, z, W, L, STY));
    // 바깥 계단 (한 단만 보이고 나머지는 모래 속)
    for (const sz of [-1, 1]) tile(-XH - 1.92, XH + 1.92, 14, (x, L) => slab(x, sz * (ZH + 1.61), L, 0.62, 0.1));
    for (const sx of [-1, 1]) tile(-ZH - 1.3, ZH + 1.3, 11, (z, L) => slab(sx * (XH + 1.61), z, 0.62, L, 0.1));
  }

  // 기둥 세우기
  const topOf = new Map(); // 온전한 기둥의 위치 → 들보를 얹을 때 쓴다
  for (const c of columns) {
    const yaw = r() * Math.PI * 2;
    const seed = Math.floor(r() * 997);
    if (c.h === 0) {
      farCol.add(drumGeo(0, 0.22, true, 0.1, seed), new THREE.Vector3(c.x, STY, c.z), yaw, 0, 0, { uv: 'keep', ground: STY });
      // 바깥으로 쓰러져 줄지어 누운 토막들
      const out = new THREE.Vector3(c.out[0], 0, c.out[1]);
      const side = new THREE.Vector3(-c.out[1], 0, c.out[0]);
      let y0 = 0.3;
      for (let k = 0; k < 3; k++) {
        const h = 1.1;
        const d = 2.0 + k * 1.18 + r() * 0.12;
        const rad = colR(y0 + h / 2);
        const p = new THREE.Vector3(c.x, 0, c.z).addScaledVector(out, d).addScaledVector(side, (r() - 0.5) * 0.35 + k * 0.12);
        const lyaw = Math.atan2(-out.z, out.x) + (r() - 0.5) * 0.25; // 굴러간 쪽으로 조금씩 틀어짐
        // 누운 축 방향으로 땅이 기운 만큼 토막도 기울인다
        const ax = new THREE.Vector3(-Math.cos(lyaw), 0, Math.sin(lyaw));
        const slope = groundY(p.x + ax.x * 0.5, p.z + ax.z * 0.5) - groundY(p.x - ax.x * 0.5, p.z - ax.z * 0.5);
        p.setY(groundY(p.x, p.z) + rad - 0.12);
        farCol.add(drumGeo(y0, h, true).translate(0, -h / 2, 0), p, lyaw, 0, Math.PI / 2 - Math.atan(slope), { uv: 'keep', ground: p.y - rad - 0.3 });
        y0 += h;
      }
      continue;
    }
    const full = c.h === 'F';
    const H = full ? COL_H : c.h;
    let y0 = 0;
    const off = new THREE.Vector3();
    while (y0 < H - 0.05) {
      const dh = Math.min(H - y0, 1.05 + r() * 0.2);
      const last = y0 + dh >= H - 0.05;
      const jag = last && !full ? 0.14 + r() * 0.16 : 0;
      off.x += (r() - 0.5) * 0.035; // 지진에 조금씩 어긋난 토막
      off.z += (r() - 0.5) * 0.035;
      // 토막마다 위아래를 막는다: 어긋난 이음매 틈으로 속이 빈 토막 안(= 하늘)이 비쳐 흰 줄이 반짝이지 않게
      farCol.add(drumGeo(y0, dh, true, jag, seed + y0 * 10, true), new THREE.Vector3(c.x + off.x, STY + y0, c.z + off.z), yaw + (r() - 0.5) * 0.03, 0, 0, { uv: 'keep', ground: STY, vary: 0.06 });
      y0 += dh;
    }
    if (full) {
      const top = new THREE.Vector3(c.x + off.x, STY + COL_H, c.z + off.z);
      const cy = (r() - 0.5) * 0.04;
      farStone.add(new THREE.CylinderGeometry(0.8, 0.5, 0.42, FLUTES), top.clone().setY(STY + COL_H + 0.21), cy, 0, 0, { rough: 0.03, dirt: false });
      farStone.add(new THREE.BoxGeometry(1.64, 0.32, 1.64, 2, 1, 2), top.clone().setY(STY + COL_H + 0.42 + 0.16), cy, 0, 0, { rough: 0.04, dirt: false });
      topOf.set(`${c.x},${c.z}`, top);
    }
  }

  // 남은 들보(엔타블러처): 아키트레이브 + 프리즈(트리글리프) + 코니스, 끝은 부러져 있다
  const beam = (p0, p1, ext0, ext1, frieze, cornice, dy = 0) => {
    const dir = new THREE.Vector3().subVectors(p1, p0).setY(0).normalize();
    const a = p0.clone().addScaledVector(dir, -ext0);
    const b = p1.clone().addScaledVector(dir, ext1);
    const len = a.distanceTo(b);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const yaw = Math.atan2(-dir.z, dir.x);
    const o = { rough: 0.05, dirt: false };
    farStone.add(new THREE.BoxGeometry(len, 1.0 - dy, 1.25 - dy, 4, 1, 1), mid.clone().setY(CAP_TOP + 0.5 - dy / 2), yaw, 0, 0, o);
    if (frieze) {
      const fl = len - 0.5 - r() * 0.8;
      const fm = a.clone().addScaledVector(dir, 0.25 + fl / 2);
      farStone.add(new THREE.BoxGeometry(fl, 0.95, 1.08, 4, 1, 1), fm.clone().setY(CAP_TOP + 1.475), yaw, 0, 0, o);
      // 트리글리프: 기둥 위와 기둥 사이마다 튀어나온 세로 판
      const nrm = new THREE.Vector3(-dir.z, 0, dir.x);
      for (let t = 0.35; t < fl - 0.3; t += 1.5)
        for (const s of [-1, 1])
          farStone.add(new THREE.BoxGeometry(0.5, 0.92, 0.1), a.clone().addScaledVector(dir, 0.25 + t).addScaledVector(nrm, s * 0.56).setY(CAP_TOP + 1.47), yaw, 0, 0, { dirt: false, tint: [0.86, 0.85, 0.82] });
      if (cornice) {
        const cl = fl - 0.3 - r() * 0.6;
        farStone.add(new THREE.BoxGeometry(cl, 0.34, 1.75, 4, 1, 2), a.clone().addScaledVector(dir, 0.4 + cl / 2).setY(CAP_TOP + 2.12), yaw, 0, 0, o);
      }
    }
  };
  const T = (x, z) => topOf.get(`${x},${z}`);
  beam(T(0, ZH), T(6, ZH), 0.25, 0.8, true, false); // +z: 0~6m
  beam(T(9, ZH), T(15, ZH), 0.3, 0.82, true, true); // +z: 9~15m (모서리까지)
  beam(T(XH, shortZ[6]), T(XH, ZH), 0.8, 0.6, false, false, 0.04); // +x+z 모서리: ㄱ자로 이어진 조각
  beam(T(-XH, -ZH), T(-12, -ZH), 0.82, 0.4, true, false); // −z 끝
  beam(T(-XH, shortZ[2]), T(-XH, shortZ[3]), 0.5, 0.8, false, false); // −x

  // 떨어진 들보 조각 (들보가 사라진 칸 아래, 기단 밖)
  farStone.add(new THREE.BoxGeometry(3.0, 1.0, 1.25, 4, 1, 1), new THREE.Vector3(7.4, 0.35, ZH + 2.9), 0.25, 0.08, 1.2, { rough: 0.08 });
  farStone.add(new THREE.BoxGeometry(1.6, 0.95, 1.08, 2, 1, 1), new THREE.Vector3(9.3, 0.3, ZH + 3.6), -0.6, 0.3, 0.1, { rough: 0.1 });
  farStone.add(new THREE.BoxGeometry(2.1, 1.0, 1.25, 3, 1, 1), new THREE.Vector3(-XH - 3.0, 0.3, -2.6), 1.3, 0.1, 0.2, { rough: 0.08 });
  // 신전 안쪽(테두리 밖 10.5m 너머)에 흩어진 큰 돌
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2;
    const c = Math.max(Math.abs(Math.cos(a)), 1e-3);
    const s = Math.max(Math.abs(Math.sin(a)), 1e-3);
    const rect = Math.min(XH / c, ZH / s);
    const d = 10.8 + r() * Math.max(0.2, rect - 12);
    const sz = 0.4 + r() * 0.7;
    if (Math.hypot(Math.cos(a) * d - SP.x, Math.sin(a) * d - SP.z) < 2.2) continue; // 석상 받침과 겹치지 않게
    farStone.add(new THREE.BoxGeometry(sz * (1 + r()), sz * 0.7, sz * (0.8 + r() * 0.5), 2, 1, 2), new THREE.Vector3(Math.cos(a) * d, sz * 0.25, Math.sin(a) * d), r() * 6, (r() - 0.5) * 0.4, (r() - 0.5) * 0.4, { rough: sz * 0.2 });
  }

  // 박공(페디먼트) 조각: 박공은 짧은 쪽(−x) 지붕 끝에 있었다. 그 한쪽 모서리가 기단 밖으로 떨어져, 조금 뒤로 기운 채 모래에 묻혀 있다.
  //  박공 벽면이 경기장 쪽(+x, 해가 드는 쪽)을 보고, 수평 처마와 14° 로 올라가는 비스듬한 처마가 낮은 모서리에서 뾰족하게 만난다.
  //  높은 쪽 끝은 부러졌다. (그림자를 드리우지 않는 먼 돌이라, 안쪽으로 들어간 박공 벽을 조금 어둡게 칠해 처마 틀과 구별한다)
  {
    const SL = Math.tan((14 * Math.PI) / 180); // 박공 기울기
    const L = 6.5; // 남은 길이 (모서리에서 부러진 끝까지)
    const tym = new THREE.Shape(); // 박공 벽(팀파논)
    tym.moveTo(0.3, 0);
    tym.lineTo(L - 0.1, 0);
    tym.lineTo(L - 0.1, 0.5);
    tym.lineTo(L - 0.3, 0.85);
    tym.lineTo(L - 0.12, 1.2);
    tym.lineTo(L - 0.2, (L + 0.1) * SL + 0.02);
    tym.lineTo(0.3, 0.6 * SL + 0.02);
    const rake = new THREE.Shape(); // 비스듬한 처마
    rake.moveTo(-0.3, 0);
    rake.lineTo(L - 0.35, (L - 0.05) * SL);
    rake.lineTo(L - 0.46, 0.36 + (L - 0.2) * SL); // 부러진 끝
    rake.lineTo(-0.3, 0.36);
    const base = new THREE.Matrix4().compose(new THREE.Vector3(-XH - 2.72, 0.05, 9.3), _q.setFromEuler(_e.set(-0.3, Math.PI / 2 + 0.18, -0.03, 'YXZ')), _s.setScalar(1));
    const put = (geo, opt = {}) => farStone.addMatrix(geo, base, { rough: 0.05, ...opt });
    put(new THREE.ExtrudeGeometry(tym, { depth: 0.45, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, -0.3), { tint: [0.72, 0.71, 0.68] });
    put(new THREE.ExtrudeGeometry(rake, { depth: 1.02, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, -0.4));
    // 수평 처마(게이손): 벽보다 앞으로 튀어나와 모서리까지 이어진다
    put(new THREE.BoxGeometry(L + 0.25, 0.36, 1.02, 5, 1, 1).translate((L - 0.35) / 2, -0.18, 0.11));
    // 박공에 새겨져 있던 조각의 흔적: 모서리에 비스듬히 누운 인물과 부서진 몸통 덩어리
    const relief = { rough: 0.03, tint: [0.9, 0.88, 0.84] };
    put(new THREE.IcosahedronGeometry(1, 1).scale(0.8, 0.15, 0.13).rotateZ(0.2).translate(1.5, 0.23, 0.25), relief);
    put(new THREE.BoxGeometry(0.6, 0.7, 0.24, 2, 2, 1).translate(4.0, 0.4, 0.26), relief);
    put(new THREE.BoxGeometry(0.42, 0.3, 0.22, 2, 1, 1).translate(3.0, 0.16, 0.25), relief);
  }

  // ── 포세이돈 석상: 금 간 받침 위, 머리 없이 한 팔을 들어 부러진 삼지창을 쥐었다 ──
  //  기본 화면(석상까지 약 18m)에서 삼지창 끝(약 6.2m)까지 화면 안에 들도록 받침을 낮추고 사람 크기의 1.9배로 했다
  {
    const face = Math.atan2(-SP.x, -SP.z); // 경기장 가운데를 바라본다
    const root = new THREE.Matrix4().compose(SP, new THREE.Quaternion().setFromAxisAngle(UP, face), new THREE.Vector3(1, 1, 1));
    const put = (geo, x, y, z, ry = 0, rx = 0, rz = 0, opt = {}) => {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.setScalar(1));
      farStone.addMatrix(geo, root.clone().multiply(m), opt);
    };
    const st = { rough: 0.05, tint: [0.97, 0.95, 0.9] };
    const PT = 1.3; // 받침 윗면 높이 (= 석상 발밑)
    put(new THREE.BoxGeometry(2.4, 0.6, 2.4, 2, 1, 2), 0, 0.1, 0, 0.02, 0, 0, { rough: 0.07 });
    // 가운데가 갈라진 받침돌: 한쪽은 살짝 가라앉아 기울었다
    const bh = PT - 0.52;
    put(new THREE.BoxGeometry(1.75, bh, 0.85, 2, 2, 1), 0, 0.395 + bh / 2, -0.45, 0, 0, 0, st);
    put(new THREE.BoxGeometry(1.75, bh, 0.85, 2, 2, 1), 0.02, 0.375 + bh / 2, 0.45, 0.01, 0.015, -0.02, st);
    put(new THREE.BoxGeometry(1.95, 0.14, 1.95, 2, 1, 2), 0, PT - 0.07, 0, 0.01, 0, 0, st);
    put(new THREE.BoxGeometry(0.55, 0.35, 0.45, 2, 1, 1), 1.55, 0.12, 1.05, 0.7, 0.3, 0.2, { rough: 0.1 }); // 떨어진 모서리
    // 사람 크기의 1.9배. 발밑(받침 윗면) 기준, +z 쪽을 본다
    const S = 1.9;
    const fig = root.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(0, PT, 0), new THREE.Quaternion(), new THREE.Vector3(S, S, S)));
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const body = { tint: [0.96, 0.94, 0.89], vary: 0.04, dirt: false };
    const bronze = { tint: [0.4, 0.5, 0.46], vary: 0.04, dirt: false }; // 녹슨 청동 (녹청)
    const limb = (a, b, r0, r1, opt = body, seg = 10) => {
      const d = new THREE.Vector3().subVectors(b, a);
      const len = d.length();
      const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1).translate(0, len / 2, 0);
      const m = new THREE.Matrix4().compose(a, new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), _s.setScalar(1));
      farStone.addMatrix(g, fig.clone().multiply(m), opt);
    };
    const ball = (c, rad, sx = 1, sy = 1, sz = 1, opt = body) => {
      const m = new THREE.Matrix4().compose(c, new THREE.Quaternion(), _s.set(sx, sy, sz));
      farStone.addMatrix(new THREE.IcosahedronGeometry(rad, 1), fig.clone().multiply(m), opt);
    };
    const box = (w, h, d, c, rx = 0, ry = 0, rz = 0, opt = body) => {
      const m = new THREE.Matrix4().compose(c, _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.setScalar(1));
      farStone.addMatrix(new THREE.BoxGeometry(w, h, d), fig.clone().multiply(m), opt);
    };
    // 허리 아래를 발목까지 감싼 히마티온(겉옷): 세로 주름이 지고, 내디딘 왼무릎이 옷 너머로 드러난다 (멜로스의 포세이돈처럼)
    {
      const g = new THREE.CylinderGeometry(0.2, 0.24, 0.9, 18, 5).translate(0, 0.53, 0);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z = p.getZ(i);
        const th = Math.atan2(z, x);
        const k = 1 + 0.07 * Math.sin(6 * th + 5 * y) + 0.035 * Math.sin(13 * th - 3 * y);
        const hem = y < 0.1 ? 0.03 * Math.sin(2 * th + 0.6) : 0; // 들쭉날쭉한 옷단
        const knee = Math.max(0, x) * Math.max(0, z) * 1.2 * THREE.MathUtils.smoothstep(0.75 - y, 0, 0.3); // 왼무릎 쪽으로 당겨진 옷
        p.setXYZ(i, x * k, y + hem, z * k * 0.85 + 0.07 * (0.98 - y) + knee);
      }
      g.computeVertexNormals();
      farStone.addMatrix(g, fig, body);
      // 허리에 말아 올린 옷 주름
      const m = new THREE.Matrix4().compose(V(0, 0.99, 0.02), _q.setFromEuler(_e.set(0.05, 0, -0.08, 'YXZ')), _s.set(1, 1, 0.86));
      farStone.addMatrix(new THREE.CylinderGeometry(0.205, 0.215, 0.09, 16), fig.clone().multiply(m), { ...body, rough: 0.012 });
    }
    // 다리: 오른다리로 체중을 받치고 왼다리를 앞으로 내디뎠다 (옷자락 밑으로 발끝만 보인다)
    limb(V(-0.1, 0.93, 0), V(-0.085, 0.5, 0.015), 0.088, 0.06);
    limb(V(-0.085, 0.5, 0.015), V(-0.085, 0.08, -0.01), 0.056, 0.038);
    limb(V(0.1, 0.93, 0), V(0.13, 0.52, 0.15), 0.088, 0.06);
    limb(V(0.13, 0.52, 0.15), V(0.12, 0.08, 0.17), 0.056, 0.038);
    ball(V(0.13, 0.52, 0.15), 0.058);
    box(0.1, 0.07, 0.25, V(-0.085, 0.035, 0.2));
    box(0.1, 0.07, 0.25, V(0.12, 0.035, 0.3));
    // 몸통 (살짝 비튼 콘트라포스토)
    ball(V(0, 0.95, 0), 0.17, 1.15, 0.72, 0.8);
    {
      const m = new THREE.Matrix4().compose(V(0, 0.93, 0), _q.setFromEuler(_e.set(0.03, 0.12, -0.04, 'YXZ')), _s.set(1, 1, 0.66));
      farStone.addMatrix(new THREE.CylinderGeometry(0.19, 0.145, 0.5, 12).translate(0, 0.25, 0), fig.clone().multiply(m), body);
    }
    ball(V(0.0, 1.33, 0.02), 0.19, 1.08, 0.78, 0.68);
    ball(V(-0.2, 1.42, 0), 0.07);
    ball(V(0.2, 1.42, 0), 0.07);
    // 머리는 없다: 부러진 목
    {
      const g = new THREE.CylinderGeometry(0.052, 0.062, 0.1, 8);
      const m = new THREE.Matrix4().compose(V(0, 1.5, 0.005), _q.setFromEuler(_e.set(0.1, 0, 0.12, 'YXZ')), _s.setScalar(1));
      farStone.addMatrix(g, fig.clone().multiply(m), { ...body, rough: 0.03 });
    }
    // 오른팔: 번쩍 들어 삼지창을 쥐었다
    limb(V(-0.2, 1.42, 0), V(-0.33, 1.67, 0.03), 0.056, 0.046);
    ball(V(-0.33, 1.67, 0.03), 0.046);
    limb(V(-0.33, 1.67, 0.03), V(-0.37, 1.93, 0.03), 0.043, 0.035);
    ball(V(-0.37, 1.95, 0.03), 0.047);
    // 왼팔: 윗팔 중간에서 떨어져 나갔다
    limb(V(0.2, 1.42, 0), V(0.27, 1.26, 0.06), 0.056, 0.048, { ...body, rough: 0.012 });
    // 왼어깨 뒤로 넘겨 허리까지 늘어진 옷자락
    box(0.2, 0.5, 0.05, V(0.2, 1.22, -0.13), 0.12, 0, 0.1);
    // 받침 역할의 돌고래 (오른다리 뒤): 주둥이를 받침에 박고 몸을 활처럼 굽혀 꼬리를 들었다
    {
      const P = [V(-0.24, 0.02, -0.02), V(-0.29, 0.13, -0.1), V(-0.34, 0.3, -0.15), V(-0.31, 0.46, -0.15), V(-0.25, 0.56, -0.11)];
      const R = [0.016, 0.05, 0.078, 0.055, 0.02];
      for (let k = 0; k < P.length - 1; k++) limb(P[k], P[k + 1], R[k], R[k + 1]);
      for (let k = 1; k < P.length - 1; k++) ball(P[k], R[k]);
      box(0.1, 0.09, 0.03, V(-0.41, 0.32, -0.16), 0, 0, 0.5); // 등지느러미 (바깥쪽)
      for (const s of [-1, 1]) box(0.15, 0.025, 0.07, V(-0.25 + s * 0.065, 0.58, -0.11), 0, 0, s * 0.45); // 꼬리지느러미
    }
    // 삼지창 (녹슨 청동): 자루는 받침에 세워 오른손에 쥐었고, 세 갈래 중 바깥 하나는 반쯤에서 부러졌다.
    //  18m 밖에서도 삼지창으로 읽히게 큼직하게 (가로대 0.56m, 갈래 0.3~0.85m, 굵기 6~7cm). 크기는 실제 m (석상 배율과 따로)
    {
      const hand = new THREE.Vector3(-0.37 * S, PT + 1.95 * S, 0.03 * S);
      const W = (dx, y) => new THREE.Vector3(hand.x + dx, y, hand.z);
      const rod = (a, b, r0, r1) => {
        const d = new THREE.Vector3().subVectors(b, a);
        const len = d.length();
        const g = new THREE.CylinderGeometry(r1, r0, len, 8, 1).translate(0, len / 2, 0);
        const m = new THREE.Matrix4().compose(a, new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), _s.setScalar(1));
        farStone.addMatrix(g, root.clone().multiply(m), bronze);
      };
      const piece = (geo, c, sx = 1, sy = 1, sz = 1) => farStone.addMatrix(geo, root.clone().multiply(new THREE.Matrix4().compose(c, new THREE.Quaternion(), _s.set(sx, sy, sz))), bronze);
      const YC = hand.y + 0.36; // 가로대 높이
      rod(W(0, PT), W(0, YC - 0.1), 0.036, 0.034); // 자루
      piece(new THREE.CylinderGeometry(0.048, 0.042, 0.14, 8), W(0, YC - 0.08)); // 자루 끝 쇠테
      piece(new THREE.BoxGeometry(0.5, 0.075, 0.07), W(0, YC)); // 가로대
      // 가운데 갈래 (가장 길다): 잎 모양 촉과 양쪽 미늘
      rod(W(0, YC), W(0, YC + 0.6), 0.036, 0.026);
      piece(new THREE.OctahedronGeometry(1), W(0, YC + 0.69), 0.075, 0.16, 0.032);
      for (const s of [-1, 1]) rod(W(s * 0.02, YC + 0.58), W(s * 0.08, YC + 0.5), 0.016, 0.006);
      // 바깥 갈래 (−x 쪽, 온전): 가로대 끝에서 휘어 올라간다
      rod(W(-0.23, YC - 0.02), W(-0.29, YC + 0.14), 0.034, 0.03);
      rod(W(-0.29, YC + 0.14), W(-0.29, YC + 0.5), 0.03, 0.022);
      piece(new THREE.OctahedronGeometry(1), W(-0.29, YC + 0.58), 0.06, 0.13, 0.028);
      rod(W(-0.3, YC + 0.5), W(-0.36, YC + 0.42), 0.015, 0.006);
      // 바깥 갈래 (+x 쪽): 반쯤에서 부러졌다
      rod(W(0.23, YC - 0.02), W(0.29, YC + 0.14), 0.034, 0.03);
      rod(W(0.29, YC + 0.14), W(0.3, YC + 0.3), 0.03, 0.027);
    }
    // 떨어진 머리: 받침 발치 모래에 얼굴을 하늘로 향한 채 모로 누웠다 (턱수염·코·눈두덩, 목이 부러진 면)
    {
      const Y = new THREE.Vector3(-1, 0, 0); // 정수리 쪽
      const Z = new THREE.Vector3(0, 0.9, 0.44).normalize(); // 얼굴 쪽: 하늘을 보며 조금 경기장 쪽으로
      const X = new THREE.Vector3().crossVectors(Y, Z);
      const hb = root.clone().multiply(new THREE.Matrix4().makeBasis(X, Y, Z).scale(_s.setScalar(S)).setPosition(-1.3, 0.16, 1.35));
      const hp = (geo, c, rx, sx = 1, sy = 1, sz = 1, opt = {}) =>
        farStone.addMatrix(geo, hb.clone().multiply(new THREE.Matrix4().compose(c, _q.setFromEuler(_e.set(rx, 0, 0, 'YXZ')), _s.set(sx, sy, sz))), { tint: [0.92, 0.9, 0.86], vary: 0.03, ...opt });
      hp(new THREE.IcosahedronGeometry(0.115, 1), V(0, 0, 0), 0, 0.92, 1, 0.95); // 머리통
      hp(new THREE.TorusGeometry(0.1, 0.024, 4, 10), V(0, 0.03, -0.005), Math.PI / 2 + 0.2); // 머리띠처럼 두른 곱슬머리
      hp(new THREE.IcosahedronGeometry(0.08, 1), V(0, -0.1, 0.06), 0.35, 0.95, 1.25, 0.75); // 턱수염
      hp(new THREE.BoxGeometry(0.15, 0.028, 0.04), V(0, 0.035, 0.1), 0); // 눈두덩
      hp(new THREE.BoxGeometry(0.035, 0.06, 0.05), V(0, -0.005, 0.115), -0.25); // 코
      hp(new THREE.CylinderGeometry(0.06, 0.065, 0.1, 8), V(0, -0.16, -0.03), -0.25); // 부러진 목 (평평한 단면)
    }
  }

  scene.add(nearStone.mesh(marble, true, true));
  scene.add(nearCol.mesh(fluted, true, true));
  scene.add(farStone.mesh(marble, false, false));
  scene.add(farCol.mesh(fluted, false, false));

  // ── 마른 풀과 덤불 (인스턴싱) ──
  {
    const g1 = new THREE.PlaneGeometry(0.55, 0.38).translate(0, 0.19, 0);
    const g2 = g1.clone().rotateY(Math.PI / 2);
    const tuft = mergeGeometries([g1, g2]);
    const nrm = tuft.attributes.normal;
    for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0); // 위에서 빛을 받는 것처럼 고르게
    const spots = [];
    for (let i = 0; i < 60; i++) {
      const a = r() * Math.PI * 2;
      const d = KC + 0.35 + r() * 0.6;
      spots.push([Math.cos(a) * d, Math.sin(a) * d, 0.7 + r() * 0.5]);
    }
    for (let i = 0; i < 50; i++) {
      // 기단 가장자리
      const t = r() * 2 - 1;
      const side = Math.floor(r() * 4);
      const inner = r() < 0.5;
      const x = side < 2 ? t * (XH + 1) : (side === 2 ? 1 : -1) * (XH + (inner ? -1.45 : 2.05));
      const z = side < 2 ? (side === 0 ? 1 : -1) * (ZH + (inner ? -1.45 : 2.05)) : t * (ZH + 1);
      spots.push([x, z, 0.8 + r() * 0.6]);
    }
    for (let i = 0; i < 70; i++) {
      // 절벽 쪽 평지
      const a = r() * Math.PI * 2;
      const c = Math.max(Math.abs(Math.cos(a)), 1e-3);
      const s = Math.max(Math.abs(Math.sin(a)), 1e-3);
      const rect = Math.min(18.5 / c, 15 / s);
      const R = edgeR(a) - 0.4;
      if (R <= rect) continue;
      const d = rect + r() * (R - rect);
      spots.push([Math.cos(a) * d, Math.sin(a) * d, 0.9 + r() * 0.7]);
    }
    const grass = new THREE.InstancedMesh(tuft, new THREE.MeshStandardMaterial({ map: grassTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 }), spots.length);
    spots.forEach(([x, z, s], i) => {
      m4.compose(new THREE.Vector3(x, groundY(x, z), z), new THREE.Quaternion().setFromAxisAngle(UP, r() * 3), new THREE.Vector3(s, s * (0.8 + r() * 0.4), s));
      grass.setMatrixAt(i, m4);
    });
    scene.add(grass);

    const bushGeo = new THREE.IcosahedronGeometry(0.55, 1);
    roughen(bushGeo, 0.25, 3);
    bushGeo.computeVertexNormals();
    const nB = 26;
    const bushes = new THREE.InstancedMesh(bushGeo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), nB);
    const greens = [0x7c7d74, 0x86857c, 0x72746c, 0x8b887f, 0x787a71]; // 잿빛이 도는 가시덤불 (석회암·대리석 빛에 맞춘 낮은 채도)
    let nb = 0;
    for (let tries = 0; nb < nB && tries < 400; tries++) {
      const a = r() * Math.PI * 2;
      const c = Math.max(Math.abs(Math.cos(a)), 1e-3);
      const s = Math.max(Math.abs(Math.sin(a)), 1e-3);
      const rect = Math.min(18.2 / c, 14.6 / s);
      const R = edgeR(a) - 0.9;
      if (R <= rect + 0.3) continue;
      if (Math.abs(Math.sin(a)) < 0.45 && Math.cos(a) > 0) continue; // 석상 뒤 바다 쪽은 비워 둔다
      const d = rect + r() * (R - rect);
      const sc = 0.7 + r() * 0.9;
      const bx = Math.cos(a) * d;
      const bz = Math.sin(a) * d;
      m4.compose(new THREE.Vector3(bx, groundY(bx, bz) + 0.1 * sc, bz), new THREE.Quaternion().setFromAxisAngle(UP, r() * 6), new THREE.Vector3(sc * (1 + r() * 0.5), sc * 0.6, sc));
      bushes.setMatrixAt(nb, m4);
      bushes.setColorAt(nb, new THREE.Color(greens[nb % greens.length]));
      nb++;
    }
    bushes.count = nb;
    scene.add(bushes);
  }

  // ── 떠다니는 먼지: 바람 없는 고요 속에 천천히 흘러간다 ──
  const NM = 220;
  const mPos = new Float32Array(NM * 3);
  const motes = [];
  for (let i = 0; i < NM; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 13;
    motes.push({ x: Math.cos(a) * d, y: 0.2 + r() * 3.6, z: Math.sin(a) * d, ph: r() * 6.3, sp: 0.5 + r() });
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  const dust = new THREE.Points(
    moteGeo,
    new THREE.PointsMaterial({ map: moteTexture(), color: 0xf2ede2, size: 0.045, transparent: true, opacity: 0.5, depthWrite: false }),
  );
  dust.frustumCulled = false;
  scene.add(dust);

  let t = 0;
  let gust = 0;
  const placeMotes = (dt) => {
    const drift = 0.12 + gust * 0.9;
    for (let i = 0; i < NM; i++) {
      const m = motes[i];
      m.x += drift * m.sp * dt;
      m.z += drift * 0.35 * m.sp * dt;
      if (m.x > 13) m.x -= 26; // 바람 끝으로 흘러가면 반대편에서 다시 들어온다
      if (m.z > 13) m.z -= 26;
      mPos[i * 3] = m.x + Math.sin(t * 0.3 * m.sp + m.ph) * 0.4;
      mPos[i * 3 + 1] = m.y + Math.sin(t * 0.4 + m.ph * 2) * 0.25;
      mPos[i * 3 + 2] = m.z + Math.cos(t * 0.25 * m.sp + m.ph) * 0.4;
    }
    moteGeo.attributes.position.needsUpdate = true;
  };
  placeMotes(0);

  return {
    /** 큰 타격: 떠다니던 먼지가 잠깐 흩날린다 (관중은 없다 — 고요한 결투) */
    excite(amount) {
      gust = Math.min(1, gust + amount * 0.5);
    },
    update(dt) {
      t += dt;
      gust = Math.max(0, gust - dt * 0.6);
      placeMotes(dt);
      seaTex.offset.x += dt * 0.0012; // 아주 느린 물결 흐름
      seaTex.offset.y += dt * 0.0005;
    },
  };
}
