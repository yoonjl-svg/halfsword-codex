// ─────────────────────────────────────────────────────────────
//  무기 겉모습 도구 (보여 주기만 한다 — 물리 콜라이더·질량·판정에는 전혀 영향이 없다)
//
//  칼이 "뭉툭한 막대"로 보이던 원인은 세 가지였다:
//   1) 칼날이 상자꼴이거나 끝이 평평한 마개로 잘려 있었다 — 칼끝(찌르는 끝)이 없었다.
//   2) 장면에 반사 환경이 없어, 강철을 강철답게(하늘·모래가 비치는 거울면) 칠할 수 없었다 —
//      metalness 를 올리면 새까매지고, 내리면 회색 플라스틱이 됐다.
//   3) 자루·코등이·폼멜이 상자와 공 그대로였다.
//  여기서 셋 다 푼다: 무기 전용 반사 환경(장면 전체 조명은 그대로), 날 세움 면·피홈·칼끝이 있는
//  칼날 단면, 가죽 감은 손잡이·바퀴형 폼멜·끝 장식 코등이. weapons.js 의 무기 스펙이 swordKit()
//  으로 조합해 partMesh 로 넘긴다.
//
//  콜라이더와 겉보기 약속(~1cm): 칼몸·자루·코등이는 콜라이더에서 ~1cm 안이다. 예외는 칼끝 한 곳 —
//  콜라이더는 끝까지 폭이 같은 상자라, 뾰족한 칼끝을 그리면 상자 모서리 쪽이 1.5~2cm 비게 된다
//  (꼭짓점은 상자 끝을 1cm 넘겨 그려 양쪽 어긋남을 나눈다). 난수는 쓰지 않는다(시뮬 재현성).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

// ── 무기 전용 반사 환경 ──
// 작은 등장방형(equirect) 데이터 텍스처를 직접 칠한다: 위는 하늘, 수평선 바로 위는 경기장 나무 벽,
// 아래는 모래, 그리고 해(main.js 의 sun 방향과 같은 쪽). three.js 가 처음 그릴 때 알아서 PMREM 으로
// 바꿔 거칠기별 반사를 만든다. DOM 이 필요 없어 헤드리스 시뮬에서도 그대로 만들어진다.
let envTex = null;
export function weaponEnv() {
  if (envTex) return envTex;
  const W = 128;
  const H = 64;
  const data = new Uint8Array(W * H * 4);
  const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  // 폐허 신전 배경에 맞춘 반사: 흐린 하늘, 지평선의 푸른 회색 바다, 회색 모래 (예전 경기장의 나무 벽·파란 하늘 대신)
  const skyTop = hex(0x8b97a1);
  const skyLow = hex(0xc3c5c2);
  const sea = hex(0x5b6c75);
  const seaFar = hex(0x87949b);
  const sandNear = hex(0x9d9a94);
  const sandFar = hex(0x6a6863);
  const sun = new THREE.Vector3(4, 9, 3).normalize();
  const d = new THREE.Vector3();
  for (let j = 0; j < H; j++) {
    const el = (j / (H - 1)) * Math.PI - Math.PI / 2; // DataTexture 는 첫 줄이 아래(uv.y=0)
    for (let i = 0; i < W; i++) {
      const phi = ((i + 0.5) / W - 0.5) * Math.PI * 2;
      d.set(Math.cos(el) * Math.cos(phi), Math.sin(el), Math.cos(el) * Math.sin(phi));
      let c;
      if (el >= 0) {
        c = mix(skyLow, skyTop, Math.min(1, el / 1.2) ** 0.8);
        if (el < 0.2) c = mix(mix(sea, seaFar, el / 0.2), c, (el / 0.2) ** 2.5); // 지평선의 바다
        const s = d.dot(sun);
        if (s > 0.9) c = mix(c, [255, 250, 236], Math.min(1, (s - 0.9) / 0.08) ** 2); // 해와 햇무리
      } else {
        c = mix(sandNear, sandFar, Math.min(1, -el / 1.0));
      }
      const o = (j * W + i) * 4;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = 255;
    }
  }
  envTex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envTex.colorSpace = THREE.SRGBColorSpace;
  envTex.magFilter = THREE.LinearFilter;
  envTex.minFilter = THREE.LinearFilter;
  envTex.needsUpdate = true;
  return envTex;
}

// 등급별 마감: 등급이 높을수록 더 곱게 갈아 거울처럼 비친다. 쓰레기는 녹슬고 흐릿하다.
//  (레전드에 자체 발광은 없다 — 진짜 엑스칼리버의 표식은 aura.js 오라 하나뿐이어야 한다)
export const FINISH = {
  trash: { blade: 0.62, hilt: 0.75, metal: 0.55, env: 0.5 },
  common: { blade: 0.3, hilt: 0.42, metal: 0.9, env: 1.0 },
  rare: { blade: 0.22, hilt: 0.34, metal: 0.92, env: 1.1 },
  epic: { blade: 0.15, hilt: 0.28, metal: 0.94, env: 1.2, sheen: 0x9fd8e8 },
  legend: { blade: 0.1, hilt: 0.22, metal: 0.95, env: 1.3 },
};
const finishOf = (tier) => FINISH[tier] ?? FINISH.common;

/** 반사 환경을 받는 금속 재질 (장식용 메쉬에도 쓴다) */
export function metalMat(color, { rough = 0.35, metal = 0.9, env = 1, ...rest } = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMap: weaponEnv(), envMapIntensity: env, ...rest });
}

// ═════════════════════════════════════════════════════════════
//  칼날 지오메트리
// ═════════════════════════════════════════════════════════════
/**
 * 날 세움 면·피홈·칼끝이 있는 칼날. hx/hy/hz 는 콜라이더 상자 반치수(그대로 물려받는다), y=-hy 가 자루 쪽.
 *  o.edge      'double'(양날) | 'single'(외날, 날은 +x 쪽)
 *  o.width(t)  칼몸 반폭 배율 (t=0 자루 쪽 ~ 1 칼끝 구간 시작), 기본 1 − 0.35t
 *  o.edgeX(t), o.backX(t)  외날의 날·등 x 위치를 직접 줄 때 (m, 등은 음수)
 *  o.thick     밑동 반두께(m) — 콜라이더보다 얇게 두어 날이 서 보이게 한다
 *  o.tip       'spear'(양날 창끝) | 'needle'(바늘) | 'round'(둥근 끝) | 'kissaki'(카타나 끝) | 'clip'(세이버 끝)
 *  o.tipLen    칼끝 구간 길이(m),  o.overshoot 꼭짓점이 콜라이더 끝을 넘는 길이(m)
 *  o.apex      외날 칼끝 꼭짓점의 x (반폭 배율, −1 등 ~ +1 날)
 *  o.curve     칼끝에서 등 쪽(−x)으로 휘는 양(m, 곡도)
 *  o.bevel     날 세움 면 폭(m) — 이 좁은 면이 빛을 따로 받아 "선 날"로 읽힌다
 *  o.fuller    { to, width, depth }  피홈: 자루에서 t=to 까지, 반폭 배율 width, 반두께 배율 depth
 *  o.ridge     외날 등마루(시노기) 위치 — 등에서 날까지의 비율 (0 이면 등이 두꺼운 쐐기)
 *  o.hamon     외날 날 쪽 흰 담금질 무늬(하몬)
 */
export function bladeGeometry(hx, hy, hz, o = {}) {
  const double = o.edge !== 'single';
  const width = o.width ?? ((t) => 1 - 0.35 * t);
  const thick0 = o.thick ?? Math.min(hz, hx * 0.2);
  const tipLen = o.tipLen ?? Math.min(0.1, hy * 0.25);
  const over = o.overshoot ?? 0.01;
  const tip = o.tip ?? (double ? 'spear' : 'kissaki');
  const curve = o.curve ?? 0;
  const y0 = -hy;
  const yApex = hy + over;
  const yTip = yApex - tipLen;
  const segBody = o.segs ?? 20;
  const segTip = 12;

  // 칼몸(t) 에서의 날·등 x
  const bodyEdge = (t) => (o.edgeX ? o.edgeX(t) : hx * width(t));
  const bodyBack = (t) => (o.backX ? o.backX(t) : -hx * width(t));
  const tTip = (yTip - y0) / (2 * hy);

  // y 위치에서의 단면 매개변수: 날 x(xe), 등 x(xb), 반두께(th), 칼끝 진행도(s)
  const at = (y) => {
    const t = Math.min(1, (y - y0) / (2 * hy));
    let xe = bodyEdge(Math.min(t, tTip));
    let xb = bodyBack(Math.min(t, tTip));
    let th = thick0 * (1 - 0.35 * Math.min(t, tTip)); // 칼끝으로 갈수록 얇아진다(distal taper)
    let s = 0;
    if (y > yTip) {
      s = (y - yTip) / tipLen;
      const e0 = xe;
      const b0 = xb;
      if (double) {
        const p = tip === 'needle' ? 1 : tip === 'round' ? 2.6 : 1.35;
        const k = 1 - s ** p;
        xe = e0 * k;
        xb = b0 * k;
        th *= 1 - s ** (p + 0.3);
      } else {
        const ax = (o.apex ?? (tip === 'clip' ? 0.15 : -0.7)) * hx;
        if (tip === 'clip') {
          // 세이버: 등이 칼끝 쪽으로 비스듬히 깎여 내려오고(가짜 날), 날은 끝에서만 살짝 올라간다
          xb = b0 + (ax - b0) * s ** 1.15;
          xe = e0 + (ax - e0) * s ** 2.4;
        } else {
          // 키사키: 날이 둥근 호를 그리며 올라가 등 쪽 꼭짓점에서 만난다, 등은 거의 곧다
          xe = ax + (e0 - ax) * Math.sqrt(Math.max(0, 1 - s * s));
          xb = b0 + (ax - b0) * s ** 3;
        }
        th *= 1 - s ** 1.8;
      }
    }
    const u = (y - y0) / (yApex - y0);
    const bend = -curve * u * u;
    return { xe: xe + bend, xb: xb + bend, th, s, t, bend };
  };

  // 단면 점 (한 바퀴, 같은 개수). 각 점에 색 배율(날 쪽은 밝게, 피홈 안은 어둡게)을 같이 준다.
  const EDGE = 1.1;
  const GROOVE = 0.86;
  const HAMON = [1.3, 1.31, 1.33];
  const ring = (y) => {
    const { xe, xb, th, s, t } = at(y);
    const pts = [];
    const cols = [];
    const P = (x, z, c) => {
      pts.push([x, y, z]);
      cols.push(Array.isArray(c) ? c : [c, c, c]);
    };
    if (double) {
      const w = (xe - xb) / 2;
      const cx = (xe + xb) / 2;
      const b = Math.min(o.bevel ?? 0.0035, w * 0.3);
      const te = th * 0.3;
      // 피홈: 자루 쪽에서 to 까지, 끝에서 서서히 사라진다
      const F = o.fuller;
      let fo = 0;
      let fi = 0;
      let fd = 0;
      if (F && s === 0) {
        const fade = Math.max(0, Math.min(1, (F.to - t) / 0.08));
        fo = w * F.width * fade;
        fi = fo * 0.7;
        fd = th * (F.depth ?? 0.45) * fade;
      }
      P(cx + w, 0, EDGE);
      P(cx + w - b, te, EDGE);
      P(cx + fo, th, 1);
      P(cx + fi, th - fd, fd > 0 ? GROOVE : 1);
      P(cx - fi, th - fd, fd > 0 ? GROOVE : 1);
      P(cx - fo, th, 1);
      P(cx - w + b, te, EDGE);
      P(cx - w, 0, EDGE);
      P(cx - w + b, -te, EDGE);
      P(cx - fo, -th, 1);
      P(cx - fi, -th + fd, fd > 0 ? GROOVE : 1);
      P(cx + fi, -th + fd, fd > 0 ? GROOVE : 1);
      P(cx + fo, -th, 1);
      P(cx + w - b, -te, EDGE);
    } else {
      const span = xe - xb;
      const b = Math.min(o.bevel ?? 0.003, span * 0.2);
      const te = th * 0.28;
      const r = o.ridge ?? 0;
      const xs = xb + span * r; // 등마루(시노기)
      const tb = r > 0 ? th * 0.72 : th; // 칼등(무네) 두께
      // 하몬(담금질 무늬) 경계: 날에서 폭의 35% 안쪽, 물결치며(자루→칼끝) 칼끝에선 날을 따라 돈다
      const hamonW = span * (0.3 + 0.07 * Math.sin(y * 55) + 0.04 * Math.sin(y * 131));
      const xh = Math.max(xs + 0.001, xe - b - Math.max(0.002, hamonW));
      const zOn = (x) => te + ((x - (xe - b)) / (xs - (xe - b) || 1)) * (th - te); // 날 세움 면~등마루 사이 평면의 두께
      const hamon = o.hamon ? HAMON : 1;
      P(xe, 0, o.hamon ? HAMON : EDGE);
      P(xe - b, te, o.hamon ? HAMON : EDGE);
      P(xh, zOn(xh), hamon);
      P(xh - 0.0015, zOn(xh - 0.0015), 1);
      P(xs, th, 1);
      P(xb, tb, 0.95);
      P(xb, -tb, 0.95);
      P(xs, -th, 1);
      P(xh - 0.0015, -zOn(xh - 0.0015), 1);
      P(xh, -zOn(xh), hamon);
      P(xe - b, -te, o.hamon ? HAMON : EDGE);
    }
    return { pts, cols };
  };

  const ys = [];
  for (let i = 0; i <= segBody; i++) ys.push(y0 + ((yTip - y0) * i) / segBody);
  for (let i = 1; i <= segTip; i++) ys.push(yTip + (tipLen * i) / segTip);
  const rings = ys.map(ring);

  const pos = [];
  const col = [];
  const tri = (a, ca, b, cb, c, cc) => {
    pos.push(...a, ...b, ...c);
    col.push(...ca, ...cb, ...cc);
  };
  const n = rings[0].pts.length;
  for (let r = 1; r < rings.length; r++) {
    const A = rings[r - 1];
    const B = rings[r];
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      tri(A.pts[k], A.cols[k], B.pts[k], B.cols[k], B.pts[k2], B.cols[k2]);
      tri(A.pts[k], A.cols[k], B.pts[k2], B.cols[k2], A.pts[k2], A.cols[k2]);
    }
  }
  // 자루 쪽 마개 (칼날 밑동 단면)
  const base = rings[0];
  const c0 = base.pts.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n, a[2] + p[2] / n], [0, 0, 0]);
  for (let k = 0; k < n; k++) tri(c0, [1, 1, 1], base.pts[(k + 1) % n], base.cols[(k + 1) % n], base.pts[k], base.cols[k]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals(); // 인덱스 없는 삼각형 → 면마다 각진 법선: 날 세움 면이 또렷한 선으로 빛난다
  return geo;
}

// ═════════════════════════════════════════════════════════════
//  자루 부품
// ═════════════════════════════════════════════════════════════
const shadowed = (m) => {
  m.traverse?.((c) => {
    if (c.isMesh) c.castShadow = true;
  });
  return m;
};

/** 손잡이: 가죽·끈을 감은 둥근 자루 (콜라이더 상자 안에 들어가는 원기둥), 양끝 금속 테(페룰) */
function gripMesh(hx, hy, hz, color, style, F, metalColor) {
  const g = new THREE.Group();
  const r0 = Math.min(hx, hz) * 0.98;
  const len = hy * 2;
  const pts = [];
  const N = 48;
  const ridges = style === 'plain' ? 0 : Math.max(4, Math.round(len / (style === 'wire' ? 0.004 : 0.009)));
  for (let i = 0; i <= N; i++) {
    const v = i / N;
    const y = -hy + len * v;
    const swell = 1 + 0.06 * Math.sin(v * Math.PI); // 가운데가 살짝 불룩
    const bump = ridges ? (style === 'wire' ? 0.0007 : 0.0011) * Math.abs(Math.sin(v * ridges * Math.PI)) : 0;
    pts.push(new THREE.Vector2(r0 * 0.9 * swell + bump, y));
  }
  const geo = new THREE.LatheGeometry(pts, 14);
  const mat =
    style === 'metal' || style === 'wire'
      ? metalMat(color, { rough: F.hilt + 0.05, metal: 0.85, env: F.env })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0 });
  const grip = new THREE.Mesh(geo, mat);
  if (hz !== hx) grip.scale.z = hz / hx; // 타원 단면(츠카 등)
  g.add(grip);
  if (style !== 'plain') {
    const fm = metalMat(metalColor, { rough: F.hilt, metal: 0.9, env: F.env });
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(r0 * 1.02, r0 * 1.02, 0.008, 14), fm);
      f.position.y = s * (hy - 0.004);
      if (hz !== hx) f.scale.z = hz / hx;
      g.add(f);
    }
  }
  return shadowed(g);
}

/** 폼멜 (콜라이더는 공 — 겉모습은 바퀴·배·마개 모양) */
function pommelMesh(r, color, style, F) {
  const mat = metalMat(color, { rough: F.hilt, metal: 0.9, env: F.env });
  const g = new THREE.Group();
  if (style === 'wheel') {
    // 바퀴형(휠) 폼멜: 칼날 면과 나란한 두꺼운 원반, 테두리를 비스듬히 깎고 가운데 볼록한 단추
    const R = r * 1.12;
    const h = r * 0.46;
    const prof = [
      [0, -h],
      [R * 0.62, -h],
      [R * 0.7, -h * 0.72],
      [R, -h * 0.32],
      [R, h * 0.32],
      [R * 0.7, h * 0.72],
      [R * 0.62, h],
      [0, h],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const disc = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), mat);
    disc.rotation.x = Math.PI / 2; // 원반 면이 z(칼날 면 방향)를 본다
    g.add(disc);
    for (const s of [-1, 1]) {
      const boss = new THREE.Mesh(new THREE.SphereGeometry(r * 0.38, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      boss.rotation.x = (s * Math.PI) / 2;
      boss.position.z = s * h * 0.95;
      boss.scale.y = 0.45;
      g.add(boss);
    }
  } else if (style === 'pear' || style === 'scent') {
    // 배 모양 / 향수병 마개 모양 폼멜 (자루 끝에서 아래로)
    const prof =
      style === 'pear'
        ? [[0, r * 1.05], [r * 0.45, r * 0.95], [r * 0.95, r * 0.2], [r * 0.85, -r * 0.55], [r * 0.35, -r * 0.95], [0, -r * 1.05]]
        : [[0, r * 1.05], [r * 0.4, r * 1.0], [r * 0.55, r * 0.6], [r * 1.0, r * 0.15], [r * 0.9, -r * 0.35], [r * 0.45, -r * 0.6], [r * 0.5, -r * 0.85], [r * 0.2, -r * 1.05], [0, -r * 1.08]];
    g.add(new THREE.Mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 18), mat));
  } else if (style === 'disc') {
    // 납작한 원반(검 폼멜) — 칼날 면과 나란히, 가장자리를 둥글게
    const d = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.08, r * 0.7, 20), mat);
    d.rotation.x = Math.PI / 2;
    g.add(d);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, r * 0.14, 6, 24), mat);
    g.add(rim);
  } else if (style === 'cap') {
    // 자루 끝 마개(카시라·세이버 등쇠 끝): 낮고 둥근 캡
    const c = new THREE.Mesh(new THREE.SphereGeometry(r * 1.05, 16, 10), mat);
    c.scale.set(1, 0.7, 1.05);
    g.add(c);
  } else {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), mat));
  }
  // 슴베 끝을 두드려 박은 작은 단추 (자루 끝)
  if (style !== 'cap') {
    const peen = new THREE.Mesh(new THREE.SphereGeometry(r * 0.2, 10, 6), mat);
    peen.position.y = -r * (style === 'wheel' ? 1.1 : 1.05);
    peen.scale.y = 0.6;
    g.add(peen);
  }
  return shadowed(g);
}

/** 코등이 (콜라이더는 상자 — 겉모습은 끝이 장식된 팔각 막대, 원반 츠바, 컵 등) */
function guardMesh(shape, color, style, F) {
  const g = new THREE.Group();
  const mat = metalMat(color, { rough: F.hilt, metal: 0.9, env: F.env });
  if (style === 'none') return g;
  if (shape[0] === 'ball' || style === 'cup') {
    // 레이피어 컵: 칼날 쪽이 둥글게 덮인 사발 (손 쪽으로 열림), 가장자리에 말린 테
    const r = shape[1];
    const cup = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.46), metalMat(color, { rough: F.hilt, metal: 0.9, env: F.env, side: THREE.DoubleSide }));
    cup.position.y = -r * 0.45;
    g.add(cup);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * Math.sin(Math.PI * 0.46), 0.0035, 6, 32), mat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = cup.position.y + r * Math.cos(Math.PI * 0.46);
    g.add(rim);
    return shadowed(g);
  }
  const [, hx, hy, hz] = shape;
  if (style === 'disc') {
    // 츠바: 둥근 쇠 원반 + 테두리
    const R = Math.max(hx, hz) * 1.1;
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, hy * 2, 28), mat));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, hy * 0.9, 6, 32), mat);
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
    return shadowed(g);
  }
  if (style === 'block') {
    // 이미터·짧은 랑게트: 작은 금속 덩어리
    const b = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(hx, hz) * 1.05, Math.min(hx, hz) * 0.95, hy * 2, 14), mat);
    g.add(b);
    return shadowed(g);
  }
  // 막대형 코등이 (x 방향): 가운데가 두툼하고 끝으로 가늘어지는 팔각 단면, 끝에 둥근 장식(피니얼),
  //  가운데엔 칼날 밑동을 감싸는 방패꼴(에퀴송). curved 면 양끝이 칼날 쪽으로 살짝 굽는다.
  const rc = Math.min(hy, hz);
  const sides = 8;
  const segs = 16;
  const pos = [];
  const ringAt = (u) => {
    const x = -hx * 0.9 + hx * 1.8 * u;
    const a = Math.abs(x) / hx;
    const r = rc * (1 - 0.3 * a);
    const lift = style === 'curved' ? 0.014 * a * a : 0;
    const pts = [];
    for (let k = 0; k < sides; k++) {
      const ang = (k / sides) * Math.PI * 2 + Math.PI / sides;
      pts.push([x, Math.cos(ang) * r * (hy / rc) + lift, Math.sin(ang) * r * (hz / rc)]);
    }
    return pts;
  };
  let prev = ringAt(0);
  const q = (p0, p1, p2, p3) => pos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
  for (let i = 1; i <= segs; i++) {
    const cur = ringAt(i / segs);
    for (let k = 0; k < sides; k++) q(prev[k], cur[k], cur[(k + 1) % sides], prev[(k + 1) % sides]);
    prev = cur;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, metalMat(color, { rough: F.hilt, metal: 0.9, env: F.env, side: THREE.DoubleSide })));
  for (const s of [-1, 1]) {
    const lift = style === 'curved' ? 0.014 * 0.81 : 0;
    const fin = new THREE.Mesh(new THREE.SphereGeometry(rc * 0.95, 12, 8), mat);
    fin.position.set(s * hx * 0.9, lift, 0);
    fin.scale.set(1.15, hy / rc, hz / rc);
    g.add(fin);
  }
  const esc = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), mat);
  esc.scale.set(rc * 1.35, hy * 1.25, hz * 1.02);
  esc.position.y = hy * 0.15;
  g.add(esc);
  return shadowed(g);
}

// ═════════════════════════════════════════════════════════════
//  조합: 무기 스펙의 partMesh 로 넘긴다
// ═════════════════════════════════════════════════════════════
/**
 * fighter.js 가 부품마다 partMesh(idx, isBlade, shape, color, matOpts, look, tier) 를 부른다.
 * 칼 네 부품 순서(buildParts)는 [자루(0), 폼멜(1), 코등이(2), 칼날(3)].
 *  o.blade   bladeGeometry 옵션, 또는 o.bladeMesh(shape, color, matOpts) 로 직접 (라이트세이버 플라스마)
 *  o.grip    { style: 'leather'|'cord'|'wire'|'metal'|'plain', color? }
 *  o.pommel  { style: 'wheel'|'pear'|'scent'|'disc'|'cap'|'ball', color? }
 *  o.guard   { style: 'bar'|'curved'|'disc'|'cup'|'block'|'none', color? }
 */
export function swordKit(o) {
  return (idx, isBlade, shape, color, matOpts, look, tier) => {
    const F = finishOf(tier);
    if (isBlade) {
      if (o.bladeMesh) return o.bladeMesh(shape, color, matOpts);
      if (shape[0] !== 'box') return undefined;
      const [, hx, hy, hz] = shape;
      const mat = new THREE.MeshStandardMaterial({
        color,
        vertexColors: true,
        roughness: F.blade,
        metalness: F.metal,
        envMap: weaponEnv(),
        envMapIntensity: F.env,
        side: THREE.DoubleSide,
        ...(F.sheen ? { emissive: F.sheen, emissiveIntensity: 0.06 } : {}),
      });
      const m = new THREE.Mesh(bladeGeometry(hx, hy, hz, o.blade), mat);
      m.castShadow = true;
      return m;
    }
    const metalColor = o.metal ?? look?.hilt ?? 0x9aa3ad;
    if (idx === 0 && shape[0] === 'box' && o.grip) {
      const [, hx, hy, hz] = shape;
      return gripMesh(hx, hy, hz, o.grip.color ?? color, o.grip.style ?? 'leather', F, o.pommel?.color ?? metalColor);
    }
    if (idx === 1 && shape[0] === 'ball' && o.pommel) return pommelMesh(shape[1], o.pommel.color ?? color, o.pommel.style ?? 'wheel', F);
    if (idx === 2 && o.guard) return guardMesh(shape, o.guard.color ?? color, o.guard.style ?? 'bar', F);
    return undefined;
  };
}

// ═════════════════════════════════════════════════════════════
//  날 없는 무기 (나뭇가지·고무 닭·냉동 참치): 콜라이더 부품(자루·폼멜·몸통 상자)은 그대로 두고, 겉모습은
//  decorate 가 "한 덩어리의 매끈한 몸"으로 통째로 그린다 — 부품마다 따로 그리면 사이가 떠서 조각나 보였다.
// ═════════════════════════════════════════════════════════════

/** partMesh: 부품마다 아무것도 그리지 않는다 (겉모습은 decorate 가 통째로) */
export const hiddenParts = () => new THREE.Group();

// 꼭짓점 색은 선형 공간이라 sRGB 16진수를 변환해서 쓴다
const _lc = new THREE.Color();
const lin = (hex) => {
  _lc.setHex(hex);
  return [_lc.r, _lc.g, _lc.b];
};
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const frac = (x) => x - Math.floor(x);
const Y_UP = new THREE.Vector3(0, 1, 0);

/** 표본점 [[s, 값], ...] 사이를 부드럽게 잇는 1차원 곡선 (Catmull-Rom) */
function profile(points) {
  const n = points.length;
  return (s) => {
    if (s <= points[0][0]) return points[0][1];
    if (s >= points[n - 1][0]) return points[n - 1][1];
    let i = 0;
    while (s > points[i + 1][0]) i++;
    const [s0, v0] = points[Math.max(0, i - 1)];
    const [s1, v1] = points[i];
    const [s2, v2] = points[i + 1];
    const [s3, v3] = points[Math.min(n - 1, i + 2)];
    const h = s2 - s1;
    const t = (s - s1) / h;
    const m1 = ((v2 - v0) / (s2 - s0)) * h;
    const m2 = ((v3 - v1) / (s3 - s1)) * h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * v1 + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * v2 + (t3 - t2) * m2;
  };
}

/**
 * y 축을 따라 뻗은 매끈한 몸통 (나뭇가지 줄기·잔가지·물고기·닭 몸). 인덱스 지오메트리라 음영이 부드럽다.
 *  o.y0, o.y1       시작·끝 y,  o.segs / o.radial  길이·둘레 분할
 *  o.radius(t,a,y)  → r 또는 [rx, rz]  (a: 둘레 각도, x = cos a·rx, z = sin a·rz)
 *  o.center(t,y)    → [x, z] 축 오프셋 (휨)
 *  o.color(t,a,y)   → 선형 RGB 꼭짓점 색
 *  o.yShift(t,a)    → 고리의 y 를 들쭉날쭉하게 (꺾인 단면의 가시)
 *  o.cap0 / o.cap1  { color, rim, depth } — 끝 막음. 가장자리 꼭짓점을 따로 두어 단면 색이 또렷하다
 */
export function organicBody(o) {
  const segs = o.segs ?? 40;
  const radial = o.radial ?? 12;
  const pos = [];
  const col = [];
  const idx = [];
  const rings = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = o.y0 + (o.y1 - o.y0) * t;
    const [cx, cz] = o.center ? o.center(t, y) : [0, 0];
    const row = [];
    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      const r = o.radius(t, a, y);
      const rx = typeof r === 'number' ? r : r[0];
      const rz = typeof r === 'number' ? r : r[1];
      row.push(pos.length / 3);
      pos.push(cx + Math.cos(a) * rx, y + (o.yShift ? o.yShift(t, a) : 0), cz + Math.sin(a) * rz);
      col.push(...(o.color ? o.color(t, a, y) : [1, 1, 1]));
    }
    rings.push(row);
  }
  for (let i = 0; i < segs; i++) {
    for (let k = 0; k < radial; k++) {
      const k2 = (k + 1) % radial;
      const a = rings[i][k];
      const b = rings[i][k2];
      const c = rings[i + 1][k];
      const d = rings[i + 1][k2];
      idx.push(a, c, b, b, c, d);
    }
  }
  const cap = (row, co, bottom) => {
    if (!co) return;
    const start = pos.length / 3;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (const v of row) {
      sx += pos[v * 3];
      sy += pos[v * 3 + 1];
      sz += pos[v * 3 + 2];
    }
    const n = row.length;
    for (const v of row) {
      pos.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
      col.push(...(co.rim ?? co.color));
    }
    const ci = pos.length / 3;
    pos.push(sx / n, sy / n + (bottom ? -1 : 1) * (co.depth ?? 0), sz / n);
    col.push(...co.color);
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      if (bottom) idx.push(ci, start + k, start + k2);
      else idx.push(ci, start + k2, start + k);
    }
  };
  cap(rings[0], o.cap0, true);
  cap(rings[segs], o.cap1, false);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** 잎 한 장: 끝이 뾰족한 타원 윤곽, 가운데 잎맥을 따라 V 자로 살짝 접히고 끝으로 갈수록 휜다 (밑동이 원점, +y 로 뻗음) */
function leafGeometry(len, w, curl = 0.25) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(w * 0.95, len * 0.16, w * 0.8, len * 0.72, 0, len);
  s.bezierCurveTo(-w * 0.8, len * 0.72, -w * 0.95, len * 0.16, 0, 0);
  const geo = new THREE.ShapeGeometry(s, 12);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    p.setZ(i, curl * len * (y / len) ** 2 + 0.3 * Math.abs(x));
  }
  geo.computeVertexNormals();
  return geo;
}

/** 지느러미·납작한 장식: [x, y] 점들을 이은 평면 도형 (z=0 평면, 옆에서 보면 윤곽이 그대로 보인다) */
function flatShape(pts, curveSegs = 8) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]);
    else s.lineTo(p[0], p[1]);
  }
  return new THREE.ShapeGeometry(s, curveSegs);
}

const castAll = (obj) => {
  obj.traverse((c) => {
    if (c.isMesh && !c.material.transparent) c.castShadow = true;
  });
  return obj;
};

// ─────────────────────────────────────────────────────────────
//  나뭇가지 (쓰레기 등급): 나무에서 꺾어 온 마른 가지. 한 줄기로 이어진 몸통에 껍질 골·잿빛으로 바랜 껍질·
//  이끼 얼룩·옹이·껍질이 벗겨진 자리, 찢겨 꺾인 밑동(속살·가시), 헝겊을 감은 손잡이, 살아 있는 잔가지 하나와
//  부러진 잔가지 그루터기, 끝의 잎 몇 장(하나는 누렇게 시듦). 콜라이더: 자루(y −0.03~0.13)·밑동 공(y −0.1)·
//  몸통 상자(y 0.15~0.95) 를 한 줄기로 잇는다. 줄기 반지름 1~1.8cm·휨 ±1cm 라 상자 안팎 ~0.6cm 이내,
//  잔가지(6~7cm)와 끝 잎(몸통 끝에서 ~5cm)은 장식이라 콜라이더 밖으로 나온다.
// ─────────────────────────────────────────────────────────────
export function drawTreeBranch(group) {
  const yB = -0.112;
  const yT = 0.952;
  const span = yT - yB;
  const BARK_D = lin(0x35251a);
  const BARK_L = lin(0x94764f);
  const BARK_G = lin(0x9b9384);
  const LICHEN = lin(0xa9b784);
  const WOOD = lin(0xd8bc8f);
  const PITH = lin(0x7c5b38);
  const KNOT = lin(0x22170d);
  const knots = [
    { y: 0.3, a: 0.5, s: 1 },
    { y: 0.54, a: 3.5, s: 0.8 },
    { y: 0.82, a: 2.0, s: 0.7 },
    { y: 0.19, a: 4.4, s: 0.6 },
  ];
  const twigA = { y: 0.43, a: 0.15, s: 1 };
  const twigB = { y: 0.68, a: Math.PI + 0.35, s: 1 };
  const baseR = (y) => 0.0176 - 0.0079 * clamp01((y - yB) / span) ** 1.1;
  const furrow = (a, y) => 0.085 * Math.sin(6 * a + 9 * y) + 0.05 * Math.sin(11 * a - 21 * y + 1.3) + 0.025 * Math.sin(19 * a + 43 * y);
  const bump = (a, y, list, amp, sy, sa) => {
    let b = 0;
    for (const k of list) b += k.s * amp * Math.exp(-(((y - k.y) / sy) ** 2) - (angDiff(a, k.a) / sa) ** 2);
    return b;
  };
  const center = (y) => {
    const u = clamp01((y - yB) / span);
    return [0.005 * Math.sin(4.1 * y + 0.3) + 0.0025 * Math.sin(11.3 * y + 1.7) + 0.006 * u * u, 0.0035 * Math.sin(3.3 * y + 1.1)];
  };
  const radiusAt = (a, y) => {
    const r = baseR(y) * (1 + furrow(a, y));
    const b = bump(a, y, knots, 0.0045, 0.016, 0.5) + bump(a, y, [twigA, twigB], 0.004, 0.02, 0.6);
    return [r + b, r * 0.92 + b];
  };
  const colorAt = (a, y) => {
    let c = mixc(BARK_D, BARK_L, clamp01(0.5 + furrow(a, y) * 3.6)); // 골은 짙고 등은 밝다
    c = mixc(c, BARK_G, 0.5 * smooth(0.25, 0.85, 0.5 + 0.5 * Math.sin(1.7 * a + 5.3 * y + 0.4) * Math.sin(2.9 * y + 1.1))); // 볕에 바랜 잿빛
    if (y > 0.16) c = mixc(c, LICHEN, 0.85 * smooth(0.68, 0.9, 0.5 + 0.5 * Math.sin(3 * a + 17 * y) * Math.sin(5 * a - 11 * y + 2))); // 이끼 얼룩
    c = mixc(c, WOOD, smooth(0.35, 0.6, Math.exp(-(((y - 0.61) / 0.022) ** 2) - (angDiff(a, 4.6) / 0.35) ** 2))); // 껍질 벗겨진 자리
    for (const k of knots) {
      const d = Math.sqrt(((y - k.y) / 0.016) ** 2 + (angDiff(a, k.a) / 0.5) ** 2);
      c = mixc(c, KNOT, (1 - smooth(0.15, 0.75, d)) * 0.9); // 옹이
    }
    return mixc(c, WOOD, 1 - smooth(yB + 0.002, yB + 0.013, y)); // 꺾인 밑동: 껍질이 찢겨 속살
  };
  const bark = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  group.add(
    new THREE.Mesh(
      organicBody({
        y0: yB,
        y1: yT,
        segs: 72,
        radial: 14,
        center: (t, y) => center(y),
        radius: (t, a, y) => radiusAt(a, y),
        color: (t, a, y) => colorAt(a, y),
        // 꺾인 밑동: 단면 가장자리가 가시처럼 들쭉날쭉 (섬유가 찢겨 나간 자리)
        yShift: (t, a) => (t === 0 ? -(0.011 * Math.max(0, Math.sin(3 * a + 0.7)) ** 3 + 0.006 * Math.max(0, Math.sin(7 * a + 2.1)) ** 2 + 0.002) : 0),
        cap0: { color: PITH, rim: WOOD, depth: -0.004 },
        cap1: { color: BARK_L, depth: 0.004 },
      }),
      bark,
    ),
  );

  // 잔가지: 줄기 겉에서 비스듬히 뻗는다. broken 이면 끝이 찢겨 꺾인 그루터기
  const twig = ({ y, a, theta, len, r0, r1, broken }) => {
    const c = center(y);
    const [rx, rz] = radiusAt(a, y);
    const P = new THREE.Vector3(c[0] + Math.cos(a) * rx * 0.75, y, c[1] + Math.sin(a) * rz * 0.75);
    const D = new THREE.Vector3(Math.cos(a) * Math.sin(theta), Math.cos(theta), Math.sin(a) * Math.sin(theta)).normalize();
    const bend = broken ? 0 : 0.12 * len;
    const m = new THREE.Mesh(
      organicBody({
        y0: 0,
        y1: len,
        segs: 12,
        radial: 8,
        center: (t) => [bend * t * t, 0],
        radius: (t, aa) => (r0 + (r1 - r0) * t) * (1 + 0.07 * Math.sin(5 * aa + 30 * t)),
        color: (t, aa) => mixc(BARK_D, BARK_L, 0.45 + 0.35 * Math.sin(5 * aa + 30 * t)),
        yShift: broken ? (t, aa) => (t === 1 ? 0.004 * Math.max(0, Math.sin(3 * aa + 1)) ** 2 : 0) : undefined,
        cap1: broken ? { color: PITH, rim: WOOD, depth: -0.001 } : { color: BARK_L, depth: r1 },
      }),
      bark,
    );
    m.position.copy(P);
    m.quaternion.setFromUnitVectors(Y_UP, D);
    group.add(m);
    return P.clone().add(new THREE.Vector3(bend, len, 0).applyQuaternion(m.quaternion));
  };
  const tipA = twig({ ...twigA, theta: 0.75, len: 0.07, r0: 0.0055, r1: 0.0022 });
  twig({ ...twigB, theta: 0.95, len: 0.026, r0: 0.0062, r1: 0.005, broken: true });

  // 줄기 끝: 가늘어진 우듬지 + 잎 몇 장과 눈(싹)
  const ct = center(yT);
  const tipBase = new THREE.Vector3(ct[0], yT - 0.004, ct[1]);
  const topD = new THREE.Vector3(0.22, 1, 0.08).normalize();
  const top = new THREE.Mesh(
    organicBody({
      y0: 0,
      y1: 0.05,
      segs: 10,
      radial: 8,
      center: (t) => [0.006 * t * t, 0],
      radius: (t) => 0.0088 - 0.0062 * t,
      color: (t, aa) => mixc(BARK_D, BARK_L, 0.5 + 0.3 * Math.sin(5 * aa + 20 * t)),
      cap1: { color: BARK_L, depth: 0.002 },
    }),
    bark,
  );
  top.position.copy(tipBase);
  top.quaternion.setFromUnitVectors(Y_UP, topD);
  group.add(top);
  const tipT = tipBase.clone().add(new THREE.Vector3(0.006, 0.05, 0).applyQuaternion(top.quaternion));
  const bud = addTo(group, new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: 0x6f5a2e, roughness: 0.8 }), tipT);
  bud.scale.set(0.0035, 0.008, 0.0035);
  bud.quaternion.copy(top.quaternion);

  const leafMats = [0x5a8a38, 0x6b9442, 0xa08d3c].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, side: THREE.DoubleSide }));
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x4f4a26, roughness: 0.8 });
  const leaf = (at, rz, rx, len, w, mat) => {
    const g = new THREE.Group();
    g.position.copy(at);
    g.rotation.set(rx, 0, rz, 'ZXY');
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0008, 0.0011, 0.01, 5), stemMat);
    stem.position.y = 0.005;
    g.add(stem);
    const l = new THREE.Mesh(leafGeometry(len, w), mat);
    l.position.y = 0.009;
    g.add(l);
    group.add(g);
  };
  leaf(tipT, -0.5, 0.35, 0.05, 0.017, leafMats[0]);
  leaf(tipT, 0.7, -0.3, 0.045, 0.015, leafMats[1]);
  leaf(tipT.clone().add(new THREE.Vector3(-0.004, -0.02, 0)), 1.5, 0.25, 0.04, 0.014, leafMats[2]); // 누렇게 시든 잎
  leaf(tipA, -0.35, 0.3, 0.038, 0.013, leafMats[1]);
  leaf(tipA, -1.3, -0.35, 0.034, 0.012, leafMats[0]);

  // 손잡이: 때 묻은 헝겊을 나선으로 감고(겹칠수록 한 겹씩 바깥으로), 끝을 한 번 묶어 자투리가 늘어진다
  const LINEN = lin(0xb4a384);
  const STAIN = lin(0x6c5a40);
  const y0w = -0.032;
  const y1w = 0.112;
  const pitch = 0.0105;
  const width = 0.0145;
  const turns = (y1w - y0w) / pitch;
  const N = Math.ceil(turns * 40);
  const wpos = [];
  const wcol = [];
  const widx = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const phi = u * turns * Math.PI * 2;
    const y = y0w + (y1w - y0w) * u;
    const c = center(y);
    const [rx, rz] = radiusAt(phi, y);
    const lift = 0.0016 + 0.0004 * u * turns;
    const stain = smooth(0.55, 0.9, 0.5 + 0.5 * Math.sin(phi * 1.3 + 2) * Math.sin(u * 23));
    const col = mixc(LINEN, STAIN, 0.7 * stain);
    for (const e of [-0.5, 0.5]) {
      wpos.push(c[0] + Math.cos(phi) * (rx + lift), y + e * width, c[1] + Math.sin(phi) * (rz + lift));
      wcol.push(...mixc(col, STAIN, 0.18)); // 가장자리는 해져서 조금 짙다
    }
  }
  for (let i = 0; i < N; i++) {
    const a = 2 * i;
    widx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const wgeo = new THREE.BufferGeometry();
  wgeo.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  wgeo.setAttribute('color', new THREE.Float32BufferAttribute(wcol, 3));
  wgeo.setIndex(widx);
  wgeo.computeVertexNormals();
  group.add(new THREE.Mesh(wgeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide })));
  const rag = new THREE.MeshStandardMaterial({ color: 0xa89878, roughness: 1, side: THREE.DoubleSide });
  const cK = center(y1w);
  const knot = addTo(group, new THREE.SphereGeometry(1, 10, 8), rag, [cK[0] + 0.017, y1w + 0.004, cK[1] + 0.004]);
  knot.scale.set(0.0055, 0.0045, 0.0055);
  for (const [dz, len, tilt] of [
    [0.004, 0.034, 0.25],
    [-0.003, 0.026, 0.45],
  ]) {
    const tail = addTo(group, new THREE.PlaneGeometry(0.009, len, 1, 4), rag, [cK[0] + 0.021, y1w - len * 0.42, cK[1] + dz]);
    tail.rotation.set(0, Math.PI / 2 - 0.3, tilt);
  }
  castAll(group);
}

function addTo(group, geo, mat, pos) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) (pos.isVector3 ? m.position.copy(pos) : m.position.set(...pos));
  group.add(m);
  return m;
}

// ─────────────────────────────────────────────────────────────
//  고무 닭 (쓰레기 등급 장난감): 두 다리를 한데 쥐고 휘두른다 — 주먹 아래로 발가락이 삐져나오고, 주먹 위로
//  털 뽑힌 오동통한 몸통 → 주름진 긴 목 → 머리(칼끝 쪽). 머리엔 비명 지르듯 벌린 부리·붉은 볏과 턱볏·만화 눈.
//  고무 표면(닭살 돌기·약한 광택), 낡은 장난감답게 때 묻은 얼룩과 찢어진 데를 X 자로 붙인 청테이프.
//  콜라이더: 자루 상자(y 0~0.1)=두 다리, 폼멜 공(y −0.08)=발, 몸통 상자(y 0.1~0.45, ±3.5×3cm)=몸통·목·머리.
//  몸통·목은 상자 안, 부리(~1.3cm)·볏(~1.5cm)·발가락은 조금 밖으로 나온다(말랑한 장식).
//  등 = −x, 가슴 = +x, 좌우 = ±z (칼날 면을 보는 카메라에서 옆모습이 보인다).
// ─────────────────────────────────────────────────────────────
export function drawRubberChicken(group) {
  const SKIN = lin(0xf3d15a);
  const SKIN_D = lin(0xd7b244);
  const SKIN_L = lin(0xf7e39a);
  const DIRT = lin(0x9d8f68);
  const ORANGE = lin(0xef8a2a);
  const ORANGE_D = lin(0xbf6418);
  const env = { envMap: weaponEnv(), envMapIntensity: 0.35 };
  const rubberV = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, ...env });
  const rubber = (color, rough = 0.5) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...env });

  // 몸통 + 목 (한 덩어리): 뒤꽁무니(y 0.085, 주먹 쪽)에서 부풀었다가 좁아져 긴 목으로
  const yR = 0.085;
  const yN = 0.41;
  const rBody = (y) => 0.034 * Math.sqrt(Math.max(0, 1 - ((y - 0.168) / 0.083) ** 2));
  const rAt = (y, a) => {
    const neck = 0.0088 * smooth(0.2, 0.26, y) * (1 + 0.07 * Math.sin(y * 560)); // 목 주름
    const base = (rBody(y) ** 4 + neck ** 4) ** 0.25;
    const goose = y < 0.26 ? 1 + 0.02 * Math.sin(41 * a + 3) * Math.sin(260 * y) : 1; // 닭살 돌기
    return base * goose;
  };
  const cAt = (y) => [-0.008 * (1 - smooth(yR, 0.13, y)) + 0.007 * Math.sin(clamp01((y - 0.25) / (yN - 0.25)) * Math.PI), 0];
  group.add(
    new THREE.Mesh(
      organicBody({
        y0: yR,
        y1: yN,
        segs: 90,
        radial: 20,
        center: (t, y) => cAt(y),
        radius: (t, a, y) => {
          const r = rAt(y, a);
          return [r, r * 0.9];
        },
        color: (t, a, y) => {
          const vert = -Math.cos(a); // +1 = 등
          let c = vert > 0 ? mixc(SKIN, SKIN_D, 0.45 * vert) : mixc(SKIN, SKIN_L, -0.5 * vert);
          if (y < 0.26 && Math.sin(29 * a + 7) * Math.sin(193 * y + 1) > 0.9) c = mixc(c, SKIN_D, 0.35); // 모공 점
          c = mixc(c, DIRT, 0.55 * smooth(0.72, 0.92, 0.5 + 0.5 * Math.sin(2.3 * a + 23 * y + 1) * Math.sin(4.1 * a - 17 * y))); // 때 얼룩
          if (y > 0.25) c = mixc(c, SKIN_D, 0.25 * (0.5 + 0.5 * Math.sin(y * 560 + 1.4))); // 목 주름 골
          return c;
        },
        cap0: { color: SKIN_D, depth: 0.001 },
        cap1: { color: SKIN, depth: 0.004 },
      }),
      rubberV,
    ),
  );

  // 꽁지 (뒤꽁무니의 짧은 뿔)
  const tail = addTo(group, new THREE.ConeGeometry(0.0075, 0.022, 12), rubber(0xf3d15a), [-0.012, 0.086, 0]);
  tail.quaternion.setFromUnitVectors(Y_UP, new THREE.Vector3(-0.6, -0.8, 0).normalize());

  // 날개: 털 뽑힌 작은 날개가 옆구리에 접혀 꽁무니 쪽을 향한다 (날갯죽지 + 날개 끝 두 마디)
  const skinM = rubber(0xefcc55);
  for (const s of [-1, 1]) {
    const w1 = addTo(group, new THREE.SphereGeometry(1, 16, 12), skinM, [-0.003, 0.172, s * 0.0285]);
    w1.scale.set(0.012, 0.03, 0.0055);
    w1.rotation.set(s * 0.18, 0, 0.18);
    const w2 = addTo(group, new THREE.SphereGeometry(1, 12, 10), skinM, [-0.006, 0.138, s * 0.031]);
    w2.scale.set(0.008, 0.017, 0.004);
    w2.rotation.set(s * 0.3, 0, 0.35);
  }

  // 다리: 발목 쪽은 비늘 마디가 진 주황색 정강이, 위로 갈수록 굵어지며 노란 넓적다리가 되어 몸통에 파묻힌다
  const legV = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0, ...env });
  const legs = [-1, 1].map((s) => {
    const m = new THREE.Mesh(
      organicBody({
        y0: -0.056,
        y1: 0.132,
        segs: 40,
        radial: 12,
        center: () => [0.006, s * 0.0085],
        radius: (t, a, y) => 0.0062 + 0.0052 * smooth(0.05, 0.115, y),
        color: (t, a, y) => {
          const scale = mixc(ORANGE, ORANGE_D, 0.55 * smooth(0.6, 0.95, Math.sin(y * 1050)));
          return mixc(scale, SKIN, smooth(0.06, 0.1, y));
        },
        cap0: { color: ORANGE_D, depth: 0.002 },
        cap1: { color: SKIN, depth: 0.003 },
      }),
      legV,
    );
    group.add(m);
    return s;
  });

  // 발: 주먹 아래로 앞발가락 셋이 부채꼴로 벌어지고 뒷발가락 하나, 발끝마다 작은 발톱
  const toeM = rubber(0xef8a2a, 0.45);
  const clawM = rubber(0x4a3b2c, 0.35);
  for (const s of legs) {
    const foot = new THREE.Vector3(0.006, -0.058, s * 0.0085);
    addTo(group, new THREE.SphereGeometry(0.0068, 12, 10), toeM, foot);
    const toes = [
      [0.55, -0.35, 0.021],
      [0.35, 0, 0.024],
      [0.55, 0.35, 0.021],
      [-0.6, 0, 0.012],
    ];
    for (const [fx, fz, len] of toes) {
      const d = new THREE.Vector3(fx, -1, fz + s * 0.12).normalize();
      const toe = addTo(group, new THREE.CapsuleGeometry(0.0027, len, 4, 8), toeM, foot.clone().addScaledVector(d, len / 2 + 0.003));
      toe.quaternion.setFromUnitVectors(Y_UP, d);
      const claw = addTo(group, new THREE.ConeGeometry(0.0019, 0.006, 8), clawM, foot.clone().addScaledVector(d, len + 0.0075));
      claw.quaternion.setFromUnitVectors(Y_UP, d);
    }
  }

  // 머리
  const H = new THREE.Vector3(0.003, 0.4185, 0);
  const head = addTo(group, new THREE.SphereGeometry(0.0235, 28, 20), rubber(0xf3d15a), H);
  head.scale.set(1.08, 1.12, 0.92);
  // 눈: 흰자 + 까만 눈동자 + 반짝이는 점 (장난감 페인트 눈)
  const white = rubber(0xf6f4ee, 0.3);
  const black = rubber(0x141414, 0.2);
  const glint = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const s of [-1, 1]) {
    addTo(group, new THREE.SphereGeometry(0.0062, 16, 12), white, [0.009, 0.426, s * 0.0176]);
    addTo(group, new THREE.SphereGeometry(0.0036, 12, 10), black, [0.0105, 0.4262, s * 0.0222]);
    addTo(group, new THREE.SphereGeometry(0.0011, 6, 5), glint, [0.0118, 0.4275, s * 0.0254]);
  }
  // 부리: 비명 지르듯 크게 벌린 위·아래 부리, 입안은 붉고 혀가 보인다
  const beakM = rubber(0xf29e22, 0.4);
  const up = addTo(group, new THREE.ConeGeometry(0.0078, 0.024, 16), beakM, [0.036, 0.4262, 0]);
  up.quaternion.setFromUnitVectors(Y_UP, new THREE.Vector3(Math.cos(0.3), Math.sin(0.3), 0));
  const low = addTo(group, new THREE.ConeGeometry(0.0058, 0.018, 16), beakM, [0.0335, 0.4118, 0]);
  low.quaternion.setFromUnitVectors(Y_UP, new THREE.Vector3(Math.cos(-0.38), Math.sin(-0.38), 0));
  addTo(group, new THREE.SphereGeometry(0.0062, 12, 10), rubber(0x7a1418, 0.4), [0.0295, 0.419, 0]);
  const tongue = addTo(group, new THREE.SphereGeometry(1, 10, 8), rubber(0xe2677a, 0.4), [0.0345, 0.4165, 0]);
  tongue.scale.set(0.0045, 0.0015, 0.003);
  // 볏: 정수리를 따라 둥근 봉우리 다섯, 턱 밑엔 늘어진 턱볏 둘
  const combM = rubber(0xd6302a, 0.35);
  const lobes = [
    [0.013, 0.4455, 0.0056],
    [0.0065, 0.4508, 0.0068],
    [-0.0005, 0.4528, 0.0074],
    [-0.0078, 0.4508, 0.0067],
    [-0.0145, 0.4455, 0.0054],
  ];
  for (const [x, y, r] of lobes) {
    const lobe = addTo(group, new THREE.SphereGeometry(1, 14, 10), combM, [x, y, 0]);
    lobe.scale.set(r, r * 1.3, r * 0.5);
  }
  for (const s of [-1, 1]) {
    const w = addTo(group, new THREE.SphereGeometry(1, 12, 10), combM, [0.0235, 0.4005, s * 0.0042]);
    w.scale.set(0.0055, 0.0105, 0.0035);
    w.rotation.z = 0.35;
  }

  // 청테이프: 찢어진 옆구리를 X 자로 붙인 자국 (몸통 곡면을 따라 감긴 띠 두 장)
  const tapeM = new THREE.MeshStandardMaterial({ color: 0x8e9195, roughness: 0.42, metalness: 0.3, envMap: weaponEnv(), envMapIntensity: 0.6, side: THREE.DoubleSide });
  const R = rBody(0.19) * 1.022 + 0.0006;
  for (const tilt of [-0.45, 0.45]) {
    const tape = addTo(group, new THREE.CylinderGeometry(R, R, 0.0085, 18, 1, true, -0.42, 0.84), tapeM, [0, 0.19, 0]);
    tape.scale.z = 0.9;
    tape.rotation.z = tilt;
  }
  castAll(group);
}

// ─────────────────────────────────────────────────────────────
//  냉동 참치 (장난 무기, 커먼): 꼬리자루(가는 꼬리 쪽 몸)를 쥐고 휘두른다 — 초승달 꼬리지느러미는 주먹 아래,
//  머리는 칼끝 쪽. 방추형 몸, 등은 짙은 남색 금속빛·배는 은백색(참치의 역그늘), 옆구리의 금빛 줄,
//  배 쪽의 희미한 세로 점무늬, 노란 두 번째 등지느러미·뒷지느러미와 그 뒤로 늘어선 노란 토막지느러미,
//  꼬리자루 양옆의 용골, 아가미 뚜껑 선, 얼어서 뿌옇게 흐린 큰 눈. 통째로 얼어 서리가 끼고 얇은 얼음막이 덮여
//  반짝인다. 콜라이더: 폼멜 공(y −0.15)=꼬리지느러미 뿌리, 자루 상자(y ±0.12, ±2.5cm)=꼬리자루,
//  몸통 상자(y 0.15~0.9, ±5×4.5cm)=몸통·머리. 몸은 상자에서 ~0.7cm 이내, 지느러미(얇은 장식)는 밖으로 나온다
//  (꼬리지느러미 끝 ±7.5cm). 등 = −x, 배 = +x, 좌우 = ±z.
// ─────────────────────────────────────────────────────────────
export function drawFrozenTuna(group) {
  const y0 = -0.125;
  const y1 = 0.905;
  const S = (y) => (y - y0) / (y1 - y0);
  const Y = (s) => y0 + (y1 - y0) * s;
  // 몸 높이(rx)·너비(rz) 반값: 꼬리자루는 가늘고, 머리 쪽 40% 지점이 가장 두툼한 방추형
  const rxP = profile([
    [0, 0.01],
    [0.08, 0.011],
    [0.2, 0.017],
    [0.3, 0.031],
    [0.45, 0.05],
    [0.6, 0.0565],
    [0.75, 0.0515],
    [0.86, 0.04],
    [0.94, 0.024],
    [1, 0.004],
  ]);
  const rzP = profile([
    [0, 0.008],
    [0.08, 0.0095],
    [0.2, 0.014],
    [0.3, 0.025],
    [0.45, 0.041],
    [0.6, 0.0475],
    [0.75, 0.0445],
    [0.86, 0.036],
    [0.94, 0.022],
    [1, 0.004],
  ]);
  const sOp = (vert) => 0.845 + 0.022 * vert * vert; // 아가미 뚜껑 뒷선 (위아래로 갈수록 꼬리 쪽으로 휜다)
  // 참다랑어처럼 등은 짙은 쇠파랑, 옆구리는 푸른 은빛 (오너 지시 "더 파랗게": 예전 남색·회청색은 흐린 하늘 아래서 잿빛으로 보였다)
  const DORSAL = lin(0x0f2f6e);
  const FLANK = lin(0x3f6fae);
  const BELLY = lin(0xd0deec);
  const GOLD = lin(0xc9a13c);
  const DARK = lin(0x0f1626);
  const FROST = lin(0xd8eafb); // 서리도 얼음빛(푸르스름)
  const radius = (t, a) => {
    const s = t;
    const vert = -Math.cos(a);
    let rx = rxP(s) * (vert < 0 ? 0.96 : 1); // 배는 조금 납작
    let rz = rzP(s);
    // 꼬리자루 양옆 용골 (가로로 도드라진 능선)
    const keel = 0.0045 * smooth(0.02, 0.07, s) * (1 - smooth(0.17, 0.24, s));
    rz += keel * Math.exp(-((Math.abs(Math.cos(a)) / 0.22) ** 2));
    // 아가미 뚜껑 가장자리: 살짝 솟은 턱
    const op = 0.0014 * Math.exp(-(((s - sOp(vert)) / 0.006) ** 2));
    return [rx + op, rz + op];
  };
  const color = (t, a) => {
    const s = t;
    const vert = -Math.cos(a);
    let c = vert > 0.05 ? mixc(FLANK, DORSAL, smooth(0.05, 0.4, vert)) : mixc(BELLY, FLANK, smooth(-0.5, 0.05, vert));
    if (s > 0.28 && s < 0.88) c = mixc(c, GOLD, 0.75 * Math.exp(-(((vert - 0.02) / 0.075) ** 2)) * smooth(0.28, 0.4, s)); // 옆구리 금빛 줄
    if (vert < -0.02 && vert > -0.65 && s > 0.3 && s < 0.8) {
      const dots = smooth(0.82, 0.97, Math.sin(s * 95)) * smooth(0.5, 0.9, Math.sin(vert * 38 + 1));
      c = mixc(c, lin(0xf2f6f8), 0.55 * dots); // 배 쪽 세로 점무늬
    }
    const keelD = s < 0.24 ? Math.exp(-((Math.abs(Math.cos(a)) / 0.25) ** 2)) * (1 - smooth(0.17, 0.24, s)) : 0;
    c = mixc(c, DARK, 0.6 * keelD);
    c = mixc(c, DARK, 0.75 * Math.exp(-(((s - sOp(vert)) / 0.0045) ** 2))); // 아가미 뚜껑 선
    if (s > 0.955) c = mixc(c, DARK, 0.8 * Math.exp(-(((vert + 0.1) / 0.09) ** 2))); // 입 선
    // 서리: 몸 여기저기 흰 얼룩(등의 남색은 살린다) + 등마루에 가는 흰 서리 한 줄
    const fr = smooth(0.7, 0.95, 0.5 + 0.5 * Math.sin(13 * a + 71 * s + 1) * Math.sin(7 * a - 43 * s + 2));
    c = mixc(c, FROST, 0.34 * fr + 0.5 * smooth(0.965, 0.995, vert));
    return mixc(c, lin(0x86aee0), 0.05); // 얼어서 살짝 바랜 얼음빛
  };
  const geo = organicBody({
    y0,
    y1,
    segs: 90,
    radial: 20,
    center: (t) => [0.004 * smooth(0.9, 1, t), 0], // 주둥이가 살짝 아래(배 쪽)로
    radius,
    color,
    cap0: { color: DARK, depth: 0.001 },
    cap1: { color: FLANK, depth: 0.002 },
  });
  const env = weaponEnv();
  group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.2, envMap: env, envMapIntensity: 0.6 })));
  // 얇은 얼음막: 같은 몸을 아주 조금 부풀려 투명하게 덮는다 — 빛이 번들거려 "꽁꽁 언" 느낌
  const glaze = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xc9e4ff, transparent: true, opacity: 0.12, roughness: 0.06, metalness: 0.1, envMap: env, envMapIntensity: 1.2, depthWrite: false }));
  glaze.scale.set(1.018, 1, 1.024);
  group.add(glaze);

  const finMat = (color, rough = 0.5) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.3, envMap: env, envMapIntensity: 0.6, side: THREE.DoubleSide });
  const navy = finMat(0x1a3566);
  const yellow = finMat(0xd9ae38, 0.45);
  const back = (s) => -rxP(s) * 0.96 + 0.0015; // 등 표면 x (지느러미 뿌리를 살짝 묻는다)
  const belly = (s) => rxP(s) - 0.0015;
  const fin = (pts, mat) => group.add(new THREE.Mesh(flatShape(pts), mat));

  // 꼬리지느러미: 초승달 (주먹 아래, 폼멜 공 자리)
  fin(
    [
      [-0.012, -0.118],
      [-0.03, -0.14, -0.08, -0.207],
      [-0.052, -0.19, -0.012, -0.172],
      [0, -0.164, 0.012, -0.172],
      [0.052, -0.19, 0.08, -0.207],
      [0.03, -0.14, 0.012, -0.118],
    ],
    navy,
  );
  // 두 번째 등지느러미·뒷지느러미: 꼬리 쪽으로 휜 노란 낫 모양
  const sD = S(0.3);
  const sD2 = S(0.365);
  fin(
    [
      [back(sD2), 0.365],
      [back(sD) - 0.02, 0.3, back(0.4) - 0.036, 0.232],
      [back(sD) - 0.008, 0.28, back(sD), 0.3],
    ],
    yellow,
  );
  fin(
    [
      [belly(S(0.345)), 0.345],
      [belly(S(0.285)) + 0.018, 0.285, belly(0.4) + 0.032, 0.222],
      [belly(S(0.28)) + 0.007, 0.265, belly(S(0.285)), 0.285],
    ],
    yellow,
  );
  // 첫 번째 등지느러미: 등 홈에 반쯤 접힌 낮은 가시지느러미
  fin(
    [
      [back(S(0.555)), 0.555],
      [back(S(0.52)) - 0.017, 0.52, back(S(0.44)) - 0.008, 0.415],
      [back(S(0.415)), 0.415],
    ],
    navy,
  );
  // 토막지느러미: 등·배를 따라 꼬리자루까지 늘어선 작은 노란 삼각형들 (참치의 표지)
  for (let i = 0; i < 7; i++) {
    const y = 0.255 - i * 0.024;
    const s = S(y);
    const h = 0.0085 - i * 0.0005;
    fin([[back(s), y + 0.006], [back(s) - h, y - 0.006], [back(s), y - 0.004]], yellow);
    fin([[belly(s), y + 0.006], [belly(s) + h, y - 0.006], [belly(s), y - 0.004]], yellow);
  }
  // 가슴지느러미 (좌우): 몸 옆에 붙어 꼬리 쪽으로 길게 뻗는다
  const sP = S(0.74);
  for (const sz of [-1, 1]) {
    const g = flatShape(
      [
        [0, 0.012],
        [-0.004, -0.02, -0.012, -0.085],
        [0.002, -0.03, 0.008, 0.002],
      ],
      8,
    );
    const m = new THREE.Mesh(g, navy);
    m.position.set(-0.006, 0.74, sz * (rzP(sP) + 0.001));
    m.rotation.set(-sz * 0.22, sz * 0.2, 0); // 끝이 몸에서 살짝 벌어지게
    group.add(m);
  }
  // 배지느러미: 배 쪽 작은 한 쌍
  for (const sz of [-1, 1]) {
    const m = new THREE.Mesh(flatShape([[0, 0.008], [0.014, -0.022], [0.004, -0.004]]), navy);
    m.position.set(belly(S(0.705)) - 0.004, 0.705, sz * 0.01);
    m.rotation.y = sz * 0.35;
    group.add(m);
  }
  // 눈: 금속빛 홍채 + 까만 눈동자, 얼어서 뿌옇게 흐린 막
  const sE = S(0.842);
  const eyeZ = rzP(sE) + 0.0005;
  const iris = new THREE.MeshStandardMaterial({ color: 0xb8a468, roughness: 0.25, metalness: 0.8, envMap: env });
  const pupil = new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.1, metalness: 0.2, envMap: env });
  const cloud = new THREE.MeshStandardMaterial({ color: 0xdde9f5, transparent: true, opacity: 0.38, roughness: 0.2, envMap: env, depthWrite: false });
  const rim = finMat(0x0f1626);
  for (const sz of [-1, 1]) {
    const e = addTo(group, new THREE.SphereGeometry(1, 20, 14), iris, [-0.006, 0.842, sz * (eyeZ - 0.001)]);
    e.scale.set(0.0105, 0.0105, 0.0035);
    const p = addTo(group, new THREE.SphereGeometry(1, 16, 12), pupil, [-0.006, 0.842, sz * (eyeZ + 0.0014)]);
    p.scale.set(0.0058, 0.0058, 0.0025);
    const cl = addTo(group, new THREE.SphereGeometry(1, 16, 12), cloud, [-0.006, 0.842, sz * (eyeZ + 0.0022)]);
    cl.scale.set(0.0085, 0.0085, 0.0022);
    addTo(group, new THREE.TorusGeometry(0.0108, 0.0012, 6, 24), rim, [-0.006, 0.842, sz * (eyeZ + 0.0002)]);
  }
  // 서리 결정·얼음 조각: 등 쪽과 지느러미 가장자리에 반짝이는 흰 알갱이, 옆구리에 붙은 투명한 얼음 덩이
  const crystal = new THREE.MeshStandardMaterial({ color: 0xe3f1ff, roughness: 0.15, metalness: 0.05, envMap: env, envMapIntensity: 1.2 });
  for (let i = 0; i < 22; i++) {
    const s = 0.22 + 0.68 * frac(i * 0.618034);
    const a = Math.PI + (frac(i * 0.381966 + 0.17) - 0.5) * 1.9;
    const rx = rxP(s);
    const rz = rzP(s);
    const r = 0.0018 + 0.0018 * frac(i * 0.7548);
    const c = addTo(group, new THREE.OctahedronGeometry(r, 0), crystal, [Math.cos(a) * rx * 0.98, Y(s), Math.sin(a) * rz * 0.98]);
    c.rotation.set(i * 0.7, i * 1.3, i * 0.4);
  }
  const ice = new THREE.MeshStandardMaterial({ color: 0xd3eaff, transparent: true, opacity: 0.5, roughness: 0.05, metalness: 0.05, envMap: env, envMapIntensity: 1.6, depthWrite: false });
  for (const [s, a, sx, sy, sz] of [
    [0.52, 0.9, 0.014, 0.022, 0.008],
    [0.33, -1.1, 0.01, 0.016, 0.007],
    [0.68, 2.6, 0.012, 0.018, 0.006],
  ]) {
    const chunk = addTo(group, new THREE.BoxGeometry(sx, sy, sz), ice, [Math.cos(a) * rxP(s) * 0.97, Y(s), Math.sin(a) * rzP(s) * 0.97]);
    chunk.rotation.set(a, 0.4, 0.3);
  }
  castAll(group);
}

// ═════════════════════════════════════════════════════════════
//  무기 파손 겉모습: 칼(무기) 그룹을 칼 축 높이 cutY(칼 원점=손 기준, m)에서 끊는다.
//   · 절단선 아래 메쉬는 그대로, 위 메쉬는 통째로 떨어지는 조각으로 옮긴다.
//   · 절단선을 걸친 메쉬(칼날·나뭇가지 몸통·닭 목 등)는 지오메트리를 둘로 복제해 남는 쪽은 위 꼭짓점을, 떨어지는 쪽은
//     아래 꼭짓점을 절단면으로 눌러 붙인다 (메쉬 객체는 그대로 둬서 피 묻히기(bladeMesh) 참조가 안 끊긴다).
//   · 남는 끝엔 톱니 모양 "부러진 면"을 얹는다 (평면 음영 로우폴리 — 설계 언어 §3D 기본 모드). 절단면 단면 크기는
//     실제 그려진 꼭짓점에서 잰다 (decorate 로 그린 세이버·나뭇가지·닭도 같은 방식으로 잘린다).
//  반환: { fragment: 떨어지는 조각 그룹 (자식 좌표 = 칼 그룹 기준) | null }. 난수는 쓰지 않는다.
// ═════════════════════════════════════════════════════════════
const BREAK_FACE = { steel: 0xeef2f5, wood: 0xdcc08a, rubber: 0xf2cf3a, frozen: 0xe6f2f8 }; // 갓 부러진 면 색 (재질별)
const _bm = new THREE.Matrix4();
const _bmi = new THREE.Matrix4();
const _bv = new THREE.Vector3();

function shownIn(o, root) {
  for (let p = o; p && p !== root; p = p.parent) if (!p.visible) return false;
  return true;
}

/** 톱니 절단면: x0~x1 폭, z 두께 dz, 뾰족 높이 h[] (위로). 아래로 0.4cm 겹쳐 칼몸 속으로 들어간다 */
function jaggedFace(x0, x1, zc, dz, heights) {
  const n = heights.length;
  const w = (x1 - x0) / n;
  const sh = new THREE.Shape();
  sh.moveTo(x0, -0.004);
  sh.lineTo(x0, 0);
  for (let i = 0; i < n; i++) {
    sh.lineTo(x0 + (i + 0.5) * w, heights[i]);
    sh.lineTo(x0 + (i + 1) * w, i === n - 1 ? 0 : heights[i] * 0.25);
  }
  sh.lineTo(x1, -0.004);
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: dz, bevelEnabled: false });
  geo.translate(0, 0, zc - dz / 2);
  return geo;
}

export function breakWeaponLook(group, cutY, { material = 'steel' } = {}) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const meshes = [];
  group.traverse((o) => {
    if (o.isMesh && o.geometry?.attributes?.position && shownIn(o, group)) meshes.push(o);
  });
  const fragment = new THREE.Group();
  // 절단면 단면 크기 (칼 그룹 기준 x·z 범위): 절단선 ±1.5cm 안의 꼭짓점에서 잰다
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  let faceMat = null;
  for (const m of meshes) {
    _bm.multiplyMatrices(inv, m.matrixWorld); // 메쉬 → 칼 그룹 좌표
    const pos = m.geometry.attributes.position;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = _bv.fromBufferAttribute(pos, i).applyMatrix4(_bm).y;
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    if (hi <= cutY) continue; // 절단선 아래: 그대로 남는다
    const piece = new THREE.Mesh(m.geometry, Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone()); // 떨어지는 쪽 (재질은 따로 — 사라질 때 흐리게)
    piece.castShadow = true;
    _bm.decompose(piece.position, piece.quaternion, piece.scale);
    fragment.add(piece);
    if (lo >= cutY) {
      m.visible = false; // 통째로 절단선 위: 원래 자리에선 숨긴다 (지오메트리는 조각이 넘겨받는다)
      continue;
    }
    // 걸친 메쉬: 두 벌로 나눠 각자 절단면 쪽 꼭짓점을 절단선에 붙인다
    _bmi.copy(_bm).invert();
    const keep = m.geometry.clone();
    const fall = m.geometry.clone();
    for (const [geo, up] of [[keep, true], [fall, false]]) {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        _bv.fromBufferAttribute(p, i).applyMatrix4(_bm);
        if (up ? _bv.y > cutY : _bv.y < cutY) {
          if (up && _bv.y < cutY + 0.02) (x0 = Math.min(x0, _bv.x)), (x1 = Math.max(x1, _bv.x)), (z0 = Math.min(z0, _bv.z)), (z1 = Math.max(z1, _bv.z));
          _bv.y = cutY;
          _bv.applyMatrix4(_bmi);
          p.setXYZ(i, _bv.x, _bv.y, _bv.z);
        } else if (up && _bv.y > cutY - 0.015) {
          (x0 = Math.min(x0, _bv.x)), (x1 = Math.max(x1, _bv.x)), (z0 = Math.min(z0, _bv.z)), (z1 = Math.max(z1, _bv.z));
        }
      }
      p.needsUpdate = true;
      geo.computeBoundingSphere();
    }
    m.geometry = keep; // 원래 지오메트리는 버린다 (조각도 새 벌을 쓴다)
    piece.geometry = fall;
    faceMat ??= Array.isArray(m.material) ? m.material[0] : m.material;
  }
  if (!fragment.children.length) return { fragment: null };
  // 톱니 절단면 (남는 쪽은 위로, 떨어지는 쪽은 뒤집어 아래로)
  if (x1 > x0 && z1 >= z0) {
    const width = x1 - x0;
    const n = width > 0.045 ? 4 : width > 0.022 ? 3 : 2;
    const hs = [0.022, 0.012, 0.03, 0.016].slice(0, n).map((h) => h * Math.min(1.3, Math.max(0.6, width / 0.04)));
    const dz = Math.max(0.006, z1 - z0);
    const geo = jaggedFace(x0, x1, (z0 + z1) / 2, dz, hs);
    const fresh = new THREE.Color(BREAK_FACE[material] ?? BREAK_FACE.steel);
    if (faceMat?.color && material !== 'steel') fresh.lerp(faceMat.color, 0.3);
    const mat = new THREE.MeshStandardMaterial({ color: fresh, roughness: 0.55, metalness: material === 'steel' ? 0.45 : 0, flatShading: true, side: THREE.DoubleSide });
    const face = new THREE.Mesh(geo, mat);
    face.position.y = cutY;
    face.castShadow = true;
    face.name = 'breakFace';
    group.add(face);
    const back = new THREE.Mesh(geo.clone(), mat.clone());
    back.position.y = cutY;
    back.scale.y = -1;
    fragment.add(back);
  }
  return { fragment };
}

// ═════════════════════════════════════════════════════════════
//  권총 (??? 등급). 칼 축(+y)이 발사 방향이다. 주먹(칼 원점)은 손잡이 가운데를 쥐고, 총신·약실·틀은 주먹 위로 완전히 올라온다
//  (사장님: "손잡이를 잡고 총신은 손 완전히 위로") — 총신 축은 칼 축과 나란히 PISTOL_BORE_X 만큼 위(−x). 총구는 (PISTOL_BORE_X, 0.20 m):
//  gun.js 가 발사·레이저를 여기서 낸다. 손잡이는 총신에서 105° 꺾여 아래로 내려오고, 방아쇠울·공이치기가 보인다.
//  칼을 겨누는 자세에서 칼 몸체 −x 쪽이 위다(게임 화면으로 확인) → 가늠쇠·공이치기는 −x, 손잡이·방아쇠울은 +x.
//  두 풍 (docs/handoff/pistol_look_v1.png) — 사장님 선택: B 리볼버. A 는 보관:
//   'flintlock' — 세계관에 맞는 부싯돌식: 나무 몸통이 총신 밑을 받치고, 휜 나무 손잡이 끝에 놋쇠 마개, 긴 놋쇠 방아쇠울, 부싯돌 치기쇠
//   'revolver'  — 어디서 굴러 들어온 현대식 리볼버: 여섯 모 약실, 검은 강철 틀, 검은 고무 손잡이
//  로우폴리·평면 음영(설계 언어 3D 기본 모드), 난수 없음.
// ═════════════════════════════════════════════════════════════
// 손잡이 치수 — 물리(weapons.js pistol buildParts 의 손잡이 콜라이더·무게)와 그림이 같이 쓴다: 칼 몸체 (x, y) = from 에서
//  총신(+y)과 deg 만큼 꺾인 방향으로 len 만큼 (끝에 마개). 가운데가 주먹(원점)이다
const _ga = (105 * Math.PI) / 180;
export const PISTOL_GRIP = { deg: 105, len: 0.105, from: [(-Math.sin(_ga) * 0.105) / 2, (-Math.cos(_ga) * 0.105) / 2] };
// 총신 축이 칼 축에서 떨어진 거리 (−x = 위, m): 약실 밑이 주먹 위로 올라오게
export const PISTOL_BORE_X = -0.08;
export const PISTOL_STYLE = { value: 'revolver' }; // 사장님이 고른 풍: B 현대식 리볼버 (A 부싯돌식은 보관 — 시안 비교 도구는 globalThis.__pistolStyle 로 바꿔 본다)
export function drawPistol(group, style = globalThis.__pistolStyle ?? PISTOL_STYLE.value) {
  const flat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, flatShading: true, ...o });
  // 손잡이 말고는 모두 총신 축 기준으로 그린다 (top 을 PISTOL_BORE_X 만큼 위로 올려 둔다)
  const top = new THREE.Group();
  top.position.x = PISTOL_BORE_X;
  group.add(top);
  const add = (geo, mat, pos, rot, parent = top) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const UP = -1; // 위쪽 = −x
  const bore = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1 });
  // 손잡이: 원점 근처(주먹)에서 아래(+x)로, 총신과 105~110° 꺾여 조금 뒤(−y)로 내려간다. 긴 축을 x 로 만들고 z 축으로 돌린다
  const grip = (len, w, t, mat, deg, from) => {
    const a = (deg * Math.PI) / 180; // 총신(+y)과 이루는 각
    const dx = Math.sin(a), dy = Math.cos(a);
    const g = add(new THREE.BoxGeometry(len, w, t), mat, [from[0] + (dx * len) / 2, from[1] + (dy * len) / 2, 0], [0, 0, Math.atan2(dy, dx)], group);
    return { g, end: [from[0] + dx * len, from[1] + dy * len], dx, dy };
  };
  if (style === 'revolver') {
    const steel = flat(0x3b4048, { roughness: 0.4, metalness: 0.55, envMap: weaponEnv(), envMapIntensity: 0.8 });
    const rubber = flat(0x1e1e21, { roughness: 0.95 });
    // 총신 + 윗면 줄(리브) + 가늠쇠, 총신 밑 이젝터 막대
    add(new THREE.CylinderGeometry(0.0085, 0.0085, 0.13, 8), steel, [0, 0.135, 0]);
    add(new THREE.BoxGeometry(0.008, 0.13, 0.009), steel, [UP * 0.009, 0.135, 0]);
    add(new THREE.BoxGeometry(0.009, 0.006, 0.004), steel, [UP * 0.016, 0.193, 0]);
    add(new THREE.CylinderGeometry(0.0038, 0.0038, 0.09, 6), steel, [0.013, 0.11, 0]);
    add(new THREE.CylinderGeometry(0.005, 0.005, 0.003, 8), bore, [0, 0.2015, 0]);
    // 여섯 모 약실(위 약실이 총신과 한 줄) + 틀
    // 약실: 경첩(crane, 약실 밑 모서리의 총신과 나란한 축) 안에 둔다 — 외형 PM gun_fx 가 쏠 때 1/6 돌리고(cylinder 의 y 축),
    //  장전 동안 경첩을 y 축으로 돌려 옆으로 빼냈다가 장전 끝에 넣는다. 약실 원점 = 약실 가운데, 둘 다 총신 축(+y)과 나란하다
    const crane = new THREE.Group();
    crane.position.set(0.033, 0.047, 0);
    top.add(crane);
    group.userData.crane = crane;
    group.userData.cylinder = add(new THREE.CylinderGeometry(0.021, 0.021, 0.042, 6), steel, [-0.021, 0, 0], null, crane);
    add(new THREE.BoxGeometry(0.048, 0.09, 0.02), steel, [0.008, 0.028, 0]);
    // 공이치기 (뒤 위, 뒤로 젖힘) · 방아쇠울 · 방아쇠
    group.userData.hammer = add(new THREE.BoxGeometry(0.02, 0.009, 0.007), steel, [UP * 0.017, -0.02, 0], [0, 0, 0.6]); // 공이치기 (젖힘 표시용으로 따로)
    add(new THREE.TorusGeometry(0.015, 0.0028, 5, 10, Math.PI * 1.25), steel, [0.036, 0.034, 0], [0, 0, -Math.PI * 0.05]);
    add(new THREE.BoxGeometry(0.014, 0.004, 0.004), steel, [0.03, 0.03, 0], [0, 0, 0.25]);
    // 손잡이 (검은 고무) — 주먹이 가운데를 쥔다
    const g = grip(PISTOL_GRIP.len, 0.03, 0.026, rubber, PISTOL_GRIP.deg, PISTOL_GRIP.from); // 손잡이 콜라이더와 같은 각·길이
    add(new THREE.BoxGeometry(0.012, 0.034, 0.028), steel, [g.end[0], g.end[1], 0], [0, 0, Math.atan2(g.dy, g.dx)], group); // 밑마개
  } else {
    const iron = flat(0x3a3d44, { roughness: 0.5, metalness: 0.45, envMap: weaponEnv(), envMapIntensity: 0.7 });
    const wood = flat(0x6b4226, { roughness: 0.85 });
    const brass = flat(0xb08d3c, { roughness: 0.45, metalness: 0.5, envMap: weaponEnv(), envMapIntensity: 0.8 });
    // 팔각 총신 (나무 몸통 위에 얹힌다) · 총구
    add(new THREE.CylinderGeometry(0.0095, 0.011, 0.2, 8), iron, [0, 0.1, 0]);
    add(new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 8), bore, [0, 0.2015, 0]);
    // 나무 몸통: 총신 밑을 총구 가까이까지 받친다 + 놋쇠 앞마개 + 꽂을대
    add(new THREE.BoxGeometry(0.016, 0.19, 0.02), wood, [0.013, 0.07, 0]);
    add(new THREE.BoxGeometry(0.018, 0.012, 0.022), brass, [0.013, 0.168, 0]);
    add(new THREE.CylinderGeometry(0.0025, 0.0025, 0.15, 5), wood, [0.024, 0.08, 0]);
    // 격발 장치 (옆 판) · 부싯돌 치기쇠(프리즌) · 공이치기(콕, 부싯돌 물림)
    add(new THREE.BoxGeometry(0.018, 0.05, 0.004), iron, [0.004, 0.005, 0.012]);
    add(new THREE.BoxGeometry(0.018, 0.007, 0.008), iron, [UP * 0.018, 0.03, 0], [0, 0, -0.25]);
    add(new THREE.BoxGeometry(0.022, 0.008, 0.006), iron, [UP * 0.016, -0.008, 0], [0, 0, 0.7]);
    add(new THREE.BoxGeometry(0.006, 0.006, 0.007), flat(0x8a8f96), [UP * 0.026, 0.004, 0]);
    // 긴 놋쇠 방아쇠울 · 방아쇠
    add(new THREE.TorusGeometry(0.019, 0.0028, 5, 12, Math.PI * 1.3), brass, [0.037, 0.04, 0], [0, 0, -Math.PI * 0.1]);
    add(new THREE.BoxGeometry(0.016, 0.004, 0.004), iron, [0.031, 0.034, 0], [0, 0, 0.3]);
    // 휜 나무 손잡이 (105°) + 놋쇠 밑마개
    const g = grip(PISTOL_GRIP.len, 0.028, 0.024, wood, PISTOL_GRIP.deg, PISTOL_GRIP.from);
    add(new THREE.SphereGeometry(0.017, 6, 4), brass, [g.end[0], g.end[1], 0], null, group);
  }
}
