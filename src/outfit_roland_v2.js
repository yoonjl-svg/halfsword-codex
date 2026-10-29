// 롤랑 복식 v2 — 줄이면서 다듬은 판 (사장님 10/23 결정: 디자인을 낫게 하면서 줄인다 — docs/decisions.md 10/23 · 확인표 2311 ~ 2314)
//  v1(outfit_roland.js — 샛별 저장소 전달본 모양 그대로 · 약 9.7 만 삼각형)은 지우지 않는다: ?look=roland:v1 로 앞뒤 견줌 · 되돌리기.
//  지킨 것: 승인된 상아빛 닫힌 면갑 투구와 말총(85 가닥 → 넓은 다발 일곱) · 단순한 솟은 견갑 · 포도주색 망토(칸 수만 줄임)
//  더한 것: 관절의 짙은 사슬(겨드랑이 · 팔꿈치 · 무릎 — 상아빛 판이 따로 떨어진 조각으로 읽히게) · 금테를 두른 포도주색 겉옷 앞판(성 문장) · 허리의 상아 뿔피리(올리판)
//  덜어낸 것: 덩굴 새김 · 리벳 · 장미 · 구슬 테 · 성 문장 셋 → 하나 · 금테 관 → 판 위에 얹은 납작한 금빛 띠(관 하나 몇백 삼각형 → 띠 하나 수십)
//  모든 메쉬는 원래 몸 부위에 얹는다 — 뼈대 · 충돌체 · 모터 · 질량 · 유파 동작은 건드리지 않는다.
//  판금 판정(outfits.js decorateOutfit — 판금 부위에 얹은 메쉬가 userData.armor): 판 · 금띠 · 팔꿈치와 오금 사슬은 판 목록(v1 의 위팔 사슬과 같게) — 판이 덮은 곳(fighter.js armorBoxes)은 v1 과 같게 맞췄다.
//   겉옷 앞판 · 허리띠 · 뿔피리 · 겨드랑이 사슬 · 넓적다리 속치마 · 무릎 위 사슬은 천 층(artoriaCloth — 판 목록 밖: 덮은 곳 · 파손에 안 듦 · 판이 다 부서져도 남는다)
//  좌표: +X 앞 · +Y 위 · +Z 오른쪽 (다른 복식 모듈과 같다)
export function createRolandOutfitV2(h, palette = {}) {
  const { THREE, bake, cyl, addMerged, artoriaCloth, taperedTube, capeSway } = h;
  const IVORY = palette.iron ?? 0xd7cfba, GOLD = palette.trim ?? 0xad8848, WINE = palette.cloth ?? 0x541f2a, MAIL = 0x5b5d61, LEATHER = 0x463727, HORN = 0xe4d9bf;
  const metal = { metalness: 0.73, roughness: 0.34, steel: 0.9 }, cloth = { roughness: 0.96, metalness: 0, side: THREE.DoubleSide };
  const chain = { metalness: 0.62, roughness: 0.5, steel: 0.55 };
  const add = (g, p, c = IVORY, m = metal) => addMerged(g, p, c, m);
  const v = p => new THREE.Vector3(...p);
  const PI = Math.PI;
  function mesh(pos, uv, idx) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  // 격자 판: fn(u, v) → 점 [x, y, z] (u 는 각도 · z 가 느는 쪽, v 는 위쪽 — 이 차례면 겉면이 바깥을 본다)
  function grid(nu, nv, fn) {
    const p = [], uv = [], ix = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      p.push(...fn(i / nu, j / nv));
      uv.push(i / nu, j / nv);
      if (i < nu && j < nv) {
        const n = j * (nu + 1) + i;
        ix.push(n, n + nu + 1, n + 1, n + 1, n + nu + 1, n + nu + 2);
      }
    }
    return mesh(p, uv, ix);
  }
  function curve(points, r = 0.002, n = 18, radial = 5) {
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v)), n, r, radial, false);
  }
  // 고리 단면 줄 rows: [높이, 앞뒤 반지름, 옆 반지름, 앞으로 민 만큼] — 높이 y 의 단면을 이웃 줄 사이에서 고른다 (v1 과 같다)
  function sample(rows, y) {
    let i = 0;
    while (i < rows.length - 2 && y > rows[i + 1][0]) i++;
    const a = rows[i], b = rows[i + 1], t = THREE.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
    return a.map((x, j) => THREE.MathUtils.lerp(x, b[j], t));
  }
  // 단면 위의 점: 높이 y · 각도 a(0 = 앞 · π/2 = 오른쪽 · π = 뒤) · lift 만큼 겉으로
  function onRows(rows, y, a, lift = 0) {
    const [, d, w, x = 0] = sample(rows, y), c = Math.cos(a);
    return [x + (d + lift) * Math.sign(c) * Math.pow(Math.abs(c), 0.8), y, (w + lift) * Math.sin(a)];
  }
  // 앞쪽 반에서 옆 자리 z 에 해당하는 각도
  function angleAt(rows, y, z) {
    return Math.asin(THREE.MathUtils.clamp(z / sample(rows, y)[2], -1, 1));
  }
  function surface(rows, y, z, lift = 0) {
    const [, d, w, x = 0] = sample(rows, y), u = Math.min(1, Math.abs(z) / w);
    return [x + d * Math.pow(Math.max(0, 1 - u * u), 0.4) + lift, y, z];
  }
  function shell(rows, start = -PI, end = PI, segs = 32) {
    const p = [], uv = [], ix = [];
    for (let j = 0; j < rows.length; j++) for (let i = 0; i <= segs; i++) {
      const [y, d, w, x = 0] = rows[j], a = start + (end - start) * i / segs, c = Math.cos(a);
      p.push(x + d * Math.sign(c) * Math.pow(Math.abs(c), 0.8), y, w * Math.sin(a));
      uv.push(i / segs, j / (rows.length - 1));
      if (j < rows.length - 1 && i < segs) {
        const n = j * (segs + 1) + i;
        ix.push(n, n + segs + 1, n + 1, n + 1, n + segs + 1, n + segs + 2);
      }
    }
    return mesh(p, uv, ix);
  }
  // 납작한 띠: 높이 y0 ~ y1 · 각도 start ~ end 를 lift 만큼 띄운다 (v1 의 금테 관 · 고리 줄 · 리벳 줄 대신 — 삼각형 segs × 2)
  function band(rows, y0, y1, lift = 0.0016, start = -PI, end = PI, segs = 32) {
    return grid(segs, 1, (u, t) => onRows(rows, y0 + (y1 - y0) * t, start + (end - start) * u, lift));
  }
  // 앞판: 높이 lo(u) ~ hi(u) · 옆 자리 zl(y) ~ zr(y) (앞쪽 반) — 겉옷 앞판 · 그 금테
  function zone(rows, nu, nv, lo, hi, zl, zr, lift) {
    return grid(nu, nv, (u, t) => {
      const y0 = lo(u), y = y0 + (hi(u) - y0) * t, z = zl(y) + (zr(y) - zl(y)) * u;
      return onRows(rows, y, angleAt(rows, y, z), lift);
    });
  }
  // 아주 얕게 눌러 낸 골 (v1 과 같다) — 띠도 같은 골을 따라 눌러야 판을 뚫지 않는다
  function flute(geo, depth = 0.004, count = 8) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z);
      if (r < 0.001) continue;
      const d = depth * Math.pow(Math.max(0, Math.cos(count * a)), 6);
      p.setX(i, x + x / r * d);
      p.setZ(i, z + z / r * d);
    }
    geo.computeVertexNormals();
    return geo;
  }
  function base(g, rows) {
    for (const c of g.children.slice(1)) c.visible = false;
    const m = g.children[0], geo = shell(rows);
    m.geometry.dispose();
    m.geometry = geo;
  }
  // 사슬: 짙은 쇠 띠에 줄마다 밝기를 번갈아 칠해 고리 줄처럼 보이게 (v1 의 고리 96 개 · 4,000 삼각형 대신 판 하나). perRow = 한 줄의 점 수
  function stripe(geo, perRow) {
    const colors = [];
    for (let i = 0; i < geo.attributes.position.count; i++) {
      const b = Math.floor(i / perRow) % 2 ? 0.6 : 1;
      colors.push(b, b, b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }
  function mail(rows, n = 6, start = -PI, end = PI, segs = 16) {
    const y0 = rows[0][0], y1 = rows[rows.length - 1][0], fine = [];
    for (let k = 0; k <= n; k++) {
      const y = y0 + (y1 - y0) * k / n, r = sample(rows, y);
      r[0] = y;
      fine.push(r);
    }
    return stripe(shell(fine, start, end, segs), segs + 1);
  }
  const ringMail = { ...chain, vertexColors: true };
  // 겉옷 앞판(포도주색 천) + 양옆 금테 (+ 위 · 아래 금테): rows 몸 단면 · lo / hi 위아래 끝(u → 높이) · half(y) 반폭
  function surcoat(layer, rows, lo, hi, half, lift, { top = false, hem = false, nv = 4 } = {}) {
    const zl = y => -half(y), zr = y => half(y), edge = 0.0065;
    add(layer, [zone(rows, 6, nv, lo, hi, zl, zr, lift)], WINE, cloth);
    const trim = [
      zone(rows, 1, nv, lo, hi, zl, y => -half(y) + edge, lift + 0.001),
      zone(rows, 1, nv, lo, hi, y => half(y) - edge, zr, lift + 0.001),
    ];
    if (top) trim.push(zone(rows, 6, 1, u => hi(u) - edge, hi, zl, zr, lift + 0.001));
    if (hem) trim.push(zone(rows, 6, 1, lo, u => lo(u) + edge, zl, zr, lift + 0.001));
    add(layer, trim, GOLD, { ...metal, side: THREE.DoubleSide });
  }
  // 성 문장(왕의 문장 — 이야기 글 '왕의 문장을 새긴 기사'): 탑 셋 · 성가퀴 · 문을 한 겹 그림자 판으로 (v1 의 성 셋 · 새김 삼각형 약 2,000 → 수십)
  function castle(fn, y0, s = 1) {
    const shape = new THREE.Shape(), q = [
      [-0.026, 0], [-0.005, 0], [-0.005, 0.009], [-0.0035, 0.0125], [0, 0.014], [0.0035, 0.0125], [0.005, 0.009], [0.005, 0], [0.026, 0],
      [0.026, 0.040], [0.0215, 0.040], [0.0215, 0.036], [0.0165, 0.036], [0.0165, 0.040], [0.012, 0.040], [0.012, 0.027], [0.008, 0.027],
      [0.008, 0.050], [0.0035, 0.050], [0.0035, 0.046], [-0.0035, 0.046], [-0.0035, 0.050], [-0.008, 0.050], [-0.008, 0.027], [-0.012, 0.027],
      [-0.012, 0.040], [-0.0165, 0.040], [-0.0165, 0.036], [-0.0215, 0.036], [-0.0215, 0.040], [-0.026, 0.040],
    ];
    q.forEach(([z, y], i) => (i ? shape.lineTo(z * s, y * s) : shape.moveTo(z * s, y * s)));
    const geo = new THREE.ShapeGeometry(shape), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const at = fn(y0 + p.getY(i), p.getX(i));
      p.setXYZ(i, at[0], at[1], at[2]);
    }
    geo.computeVertexNormals();
    return geo;
  }
  function cape(g) {
    // 망토(v1 과 같은 꼴 · 같은 주름 · 같은 색) — 천 칸 24 × 32 → 12 × 24 · 단 장식 관 셋 + 고리 아홉 → 금빛 띠 하나
    const layer = artoriaCloth(g, 'roland-cape'), p = [], uv = [], ix = [], colors = [], C = 24;
    const T = [0, 0.07, 0.15, 0.24, 0.33, 0.43, 0.53, 0.63, 0.73, 0.83, 0.91, 0.96, 1];
    const at = (t, u) => {
      const w = 0.165 + 0.132 * Math.sin(Math.min(1, t * 1.9) * PI / 2), fold = Math.cos(u * PI * 5 + 0.3 * u);
      return [-0.137 - 0.132 * t - 0.023 * fold * (0.2 + 0.8 * t), 0.14 - 1.19 * t + 0.017 * Math.cos(u * 8) * t * t, u * w];
    };
    for (let j = 0; j < T.length; j++) for (let i = 0; i <= C; i++) {
      const t = T[j], u = i / C * 2 - 1;
      p.push(...at(t, u));
      uv.push(i / C, t);
      const c = new THREE.Color(WINE).multiplyScalar(0.66 + 0.27 * (1 + Math.cos(u * PI * 5 + 0.3 * u)) / 2);
      colors.push(c.r, c.g, c.b);
      if (j < T.length - 1 && i < C) {
        const n = j * (C + 1) + i;
        ix.push(n, n + 1, n + C + 1, n + 1, n + C + 2, n + C + 1);
      }
    }
    const geo = mesh(p, uv, ix);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const capeMesh = add(layer, [geo], 0xffffff, { ...cloth, vertexColors: true });
    capeMesh.name = 'roland-wine-cape';
    const hem = grid(C, 1, (u, t) => {
      const q = at(0.935 + 0.02 * t, u * 2 - 1);
      q[0] -= 0.002;
      return q;
    });
    const band = add(layer, [hem], 0x997b49, cloth);
    // 흔들림 (10/24 — src/cape_sway.js): 망토 천 · 금빛 띠를 같은 뼈에 건다 — 꼴 · 주름 · 색 · 길이 · 매단 곳 그대로, 아래쪽이 몸통을 반 박자 늦게 따라온다
    capeSway(layer, [capeMesh, band]);
  }
  function helmet(g) {
    const helm = new THREE.Group();
    helm.name = 'roland-closed-helmet';
    helm.userData.pieces = {};
    g.add(helm);
    g.userData.helmet = helm;
    const piece = (id, p, c = IVORY, m = metal) => {
      const group = new THREE.Group();
      group.name = 'royal-helm-' + id;
      helm.add(group);
      helm.userData.pieces[id] = group;
      const o = add(group, p, c, m);
      if (o) o.userData.base = { color: c, roughness: m.roughness };
      return group;
    };
    // 사발 · 면갑은 v1 과 같은 꼴 (승인된 투구) — 면갑 칸만 48 → 32
    const rows = [[-0.117, 0.079, 0.058, 0], [-0.095, 0.100, 0.079, -0.007], [-0.04, 0.115, 0.103, -0.008], [0.025, 0.119, 0.111, -0.008], [0.08, 0.103, 0.104, -0.012], [0.12, 0.073, 0.075, -0.015], [0.147, 0.010, 0.013, -0.025]];
    piece('bowl', [flute(shell(rows), 0.0025, 6)], IVORY);
    const visor = [[-0.116, 0.099, 0.050, 0.003], [-0.091, 0.124, 0.073, 0.004], [-0.035, 0.151, 0.099, 0.004], [0.022, 0.155, 0.104, 0.002], [0.068, 0.138, 0.099, 0], [0.092, 0.116, 0.087, -0.003]];
    const f = (y, z, lift = 0.002) => surface(visor, y, z, lift);
    const wAt = y => sample(visor, y)[2];
    piece('visor', [shell(visor, -PI / 2, PI / 2, 32)], IVORY, { ...metal, side: THREE.DoubleSide });
    // 금테: 관 다섯 → 면갑 위에 얹은 띠 (양옆 · 아랫단 · 가운데 줄 · 눈썹)
    const lo = -0.116, hi = 0.092, e = 0.007, L = 0.0018;
    const trim = [
      grid(1, 5, (u, t) => {
        const y = lo + (hi - lo) * t, w = wAt(y);
        return f(y, -w + e * u, L);
      }),
      grid(1, 5, (u, t) => {
        const y = lo + (hi - lo) * t, w = wAt(y);
        return f(y, w - e + e * u, L);
      }),
      grid(16, 1, (u, t) => {
        const y = lo + 0.008 * t;
        return f(y, (u * 2 - 1) * (wAt(y) - 0.001), L);
      }),
      grid(1, 4, (u, t) => f(lo + 0.008 + (0.052 - lo - 0.008) * t, (u * 2 - 1) * 0.0028, L)),
      grid(16, 1, (u, t) => {
        const z = (u * 2 - 1) * 0.097;
        return f(0.050 + 0.009 * Math.abs(z) / 0.097 + 0.008 * t, z, L);
      }),
    ];
    piece('trim', trim, GOLD);
    // 눈 틈 · 숨구멍: 면갑 겉면을 따라 짙게 칠한 조각 (v1 은 잘게 나눈 판 · 관)
    const quad = (q, s, lift, nu = 6) => grid(nu, 1, (u, t) => {
      const b = [q[3][0] + (q[2][0] - q[3][0]) * u, q[3][1] + (q[2][1] - q[3][1]) * u], a = [q[0][0] + (q[1][0] - q[0][0]) * u, q[0][1] + (q[1][1] - q[0][1]) * u];
      return f(b[0] + (a[0] - b[0]) * t, s * (b[1] + (a[1] - b[1]) * t), lift);
    });
    const slit = [];
    for (const s of [-1, 1]) slit.push(quad([[0.043, 0.006], [0.045, 0.087], [0.025, 0.093], [0.018, 0.006]], s, 0.0035));
    piece('slit', slit, 0x111210, { ...cloth });
    const vents = [];
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const y = -0.019 - i * 0.012, z = 0.047 - i * 0.005;
      vents.push(quad([[y, z - 0.0012], [y - 0.007, z + 0.003 - 0.0012], [y - 0.007, z + 0.003 + 0.0012], [y, z + 0.0012]], s, 0.0032, 1));
    }
    piece('vents', vents, 0x2a241d, cloth);
    for (const s of [-1, 1]) piece('hinge' + s, [cyl(0.016, 0.016, 0.007, 12, false, [0.002, 0.025, s * 0.112], [PI / 2, 0, 0])], GOLD);
    // 말총: 85 가닥 → 넓은 다발 일곱 (사장님 10/23 결정 — 6 ~ 8 다발). v1 가닥이 차지하던 자리 그대로 — 꼭대기 뒤에서 솟았다가 뒤로 흘러내린다.
    //  다발마다 가로로 넓고 위아래로 얇은 관 · 끝이 가늘다 · 상아빛 셋을 번갈아. 투구 파손 조각 'crest'(config.js ARMOR.helmets.royal_close shed) = 이 말총 + 꽂이
    const locks = [[], [], []], up = new THREE.Vector3(0, 1, 0);
    const lock = (pts, widths, tilt, flat = 0.45, n = 12, radial = 6) => {
      const path = new THREE.CatmullRomCurve3(pts.map(v)), p = [], uv = [], ix = [], P = new THREE.Vector3(), T = new THREE.Vector3(), S = new THREE.Vector3(), N = new THREE.Vector3(), W = new THREE.Vector3(), last = widths.length - 1;
      for (let i = 0; i <= n; i++) {
        const t = i / n, k = Math.min(last - 1, Math.floor(t * last)), w = widths[k] + (widths[k + 1] - widths[k]) * (t * last - k);
        path.getPointAt(t, P);
        path.getTangentAt(t, T);
        S.crossVectors(T, up).normalize();
        N.crossVectors(S, T).normalize();
        W.copy(S).multiplyScalar(Math.cos(tilt)).addScaledVector(N, Math.sin(tilt)); // 넓은 쪽: 가운데 다발은 옆으로 · 바깥 다발은 바깥으로 기울어 부채꼴
        N.crossVectors(W, T).normalize();
        for (let j = 0; j <= radial; j++) {
          const a = j / radial * PI * 2, c = Math.cos(a) * w, s = Math.sin(a) * w * flat;
          p.push(P.x + W.x * c + N.x * s, P.y + W.y * c + N.y * s, P.z + W.z * c + N.z * s);
          uv.push(j / radial, t);
          if (i < n && j < radial) {
            const A = i * (radial + 1) + j, B = A + radial + 1;
            ix.push(A, B, A + 1, B, B + 1, A + 1);
          }
        }
      }
      return mesh(p, uv, ix);
    };
    // 다발마다 길이 · 굵기를 조금씩 달리해(같은 손가락이 늘어선 꼴이 아니게) 끝은 붓끝처럼 뭉툭하게
    const fall = [0.012, 0.034, 0, 0.022, 0.006, 0.03, 0.016], wide = [0.022, 0.025, 0.024, 0.027, 0.023, 0.026, 0.021];
    [-0.105, -0.07, -0.035, 0, 0.035, 0.07, 0.105].forEach((z, k) => {
      const c = 1 - Math.abs(z) / 0.14, drop = fall[k], wd = wide[k];
      const pts = [[-0.03, 0.126, z * 0.25], [-0.064, 0.205 + 0.05 * c, z * 0.85], [-0.134, 0.222 + 0.04 * c - drop * 0.2, z * 1.12], [-0.2, 0.15 + 0.03 * c - drop * 0.6, z * 1.3], [-0.24, 0.06 + 0.02 * c - drop, z * 1.38]];
      locks[k % 3].push(lock(pts, [0.010, wd * 0.85, wd, wd * 0.85, wd * 0.35], z / 0.105 * 0.7));
    });
    const hair = piece('crest', locks[0], 0xd6cfba, cloth);
    hair.name = 'royal-helm-ivory-horsehair';
    add(hair, locks[1], 0xc4bda8, cloth);
    add(hair, locks[2], 0xe4dccb, cloth);
    add(hair, [cyl(0.011, 0.016, 0.028, 8, false, [-0.036, 0.141, 0], [0, 0, 0.55])], GOLD); // 말총 꽂이
  }
  function shoulderPoint(parent, side) {
    // 짧고 단단한 네모뿔 꼭지 하나 (v1 그대로 · 금 고리 둘 → 하나) — 견갑을 따라 움직이고 함께 부서지며, 막는 곳은 늘리지 않는다
    const z = side * 0.012;
    const point = add(parent, [bake(new THREE.ConeGeometry(0.026, 0.065, 4), [0, 0.181, z], [0, PI / 4, 0])], IVORY);
    point.name = 'royal-shoulder-simple-point';
    add(point, [cyl(0.026, 0.029, 0.009, 8, false, [0, 0.153, z])], GOLD);
  }
  function shoulder(g, side = 1) {
    // 견갑 판 · 겹친 가는 판 둘 · 위팔 판은 v1 과 같은 꼴. 성 문장 · 덩굴 · 리벳 · 사슬 고리 96 개 뺌 → 금띠 · 사슬 띠
    const cap = [[-0.021, 0.088, 0.092, 0], [0.019, 0.100, 0.104, 0], [0.084, 0.094, 0.096, 0], [0.134, 0.056, 0.061, 0], [0.173, 0.009, 0.012, 0]];
    const wave = geo => {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i));
        p.setY(i, y + (1 - THREE.MathUtils.clamp((y + 0.021) / 0.155, 0, 1)) * 0.016 * Math.cos(2 * a));
      }
      geo.computeVertexNormals();
      return geo;
    };
    const capMesh = add(g, [wave(flute(shell(cap), 0.003, 10))]);
    shoulderPoint(capMesh, side);
    const lames = [], gold = [wave(flute(band(cap, -0.021, -0.0135), 0.003, 10))];
    for (let i = 0; i < 2; i++) {
      const y = -0.026 - i * 0.032, r = 0.084 - i * 0.009, rows = [[y - 0.038, r - 0.009, r - 0.008, 0], [y, r, r, 0]];
      lames.push(flute(shell(rows), 0.002, 8));
      gold.push(flute(band(rows, y - 0.038, y - 0.032), 0.002, 8));
    }
    add(g, lames);
    const arm = [[-0.147, 0.047, 0.047, 0], [-0.101, 0.055, 0.055, 0], [-0.074, 0.065, 0.065, 0]];
    add(g, [flute(shell(arm, -PI, PI, 24), 0.002, 8)]);
    add(g, gold, GOLD);
    // 팔꿈치 위 사슬 (v1 의 사슬 고리 자리 · 같은 넓이 — 판 목록이라 위팔이 덮은 곳은 v1 그대로)
    add(g, [mail([[-0.158, 0.049, 0.049, 0], [-0.147, 0.052, 0.052, 0], [-0.135, 0.050, 0.050, 0]], 4)], MAIL, ringMail);
  }
  function forearm(g) {
    const rows = [[-0.126, 0.046, 0.046, 0], [-0.087, 0.048, 0.048, 0], [0.035, 0.057, 0.056, 0], [0.101, 0.061, 0.060, 0], [0.127, 0.068, 0.064, 0]];
    add(g, [flute(shell(rows, -PI, PI, 24), 0.0018, 10)]);
    add(g, [flute(band(rows, -0.126, -0.118, 0.0016, -PI, PI, 24), 0.0018, 10), flute(band(rows, 0.104, 0.112, 0.0016, -PI, PI, 24), 0.0018, 10)], GOLD);
    // 팔꿈치 판: 팔꿈치 끝(−x)과 양옆만 — 팔 안쪽(+x, 굽히는 쪽)이 열려 사슬이 보인다
    const elbow = [[-0.005, 0.052, 0.054, 0], [0.020, 0.065, 0.068, -0.006], [0.055, 0.051, 0.054, 0]];
    add(g, [bake(flute(shell(elbow, PI - 2.05, PI + 2.05, 16), 0.0025, 6), [0, 0.117, 0])], IVORY, { ...metal, side: THREE.DoubleSide });
    // 팔꿈치 사슬 (판 목록 — 팔꿈치 판이 열어 둔 안쪽까지 덮은 곳을 v1 의 둥근 팔꿈치 판과 같게)
    add(g, [mail([[0.105, 0.047, 0.047, 0], [0.135, 0.050, 0.050, 0], [0.165, 0.048, 0.048, 0]], 6)], MAIL, ringMail);
  }
  function thigh(g) {
    // 허벅지 속: 포도주색 속치마(v1 처럼 — 넓적다리 뒤 · 안쪽 · 판 속으로 조금 좁힘) + 무릎 위 사슬 고리(천 층) — 넓적다리 판과 무릎 판 사이가 짙게 끊긴다
    const under = artoriaCloth(g, 'roland-mail');
    add(under, [shell([[-0.13, 0.068, 0.068, 0], [0.20, 0.074, 0.074, 0]], -PI, PI, 20)], WINE, cloth);
    add(under, [mail([[-0.212, 0.036, 0.036, 0], [-0.185, 0.062, 0.062, 0], [-0.15, 0.070, 0.070, 0], [-0.118, 0.070, 0.070, 0]], 8, -PI, PI, 20)], MAIL, ringMail); // 위는 넓적다리 판 속 · 아래끝은 무릎 판 속으로 오므린다
    // 넓적다리 판: v1 꼴에서 무릎 쪽 옆만 넓혔다(0.064 → 0.072) — v1 은 넓적다리 몸(반지름 0.065)과 속치마가 판 옆으로 비쳐 들쭉날쭉했다. 가장 넓은 단면 · 앞뒤 깊이는 그대로라 덮은 곳도 그대로
    const rows = [[-0.169, 0.075, 0.072, 0.004], [-0.10, 0.084, 0.075, 0.003], [0.05, 0.092, 0.079, 0.002], [0.185, 0.090, 0.080, 0]];
    const A = PI * 0.65;
    add(g, [flute(shell(rows, -A, A, 24), 0.0025, 8)], IVORY, { ...metal, side: THREE.DoubleSide });
    // 무릎 쪽 끝단 금테: 앞쪽은 판 끝에서 2 mm 내려 턱처럼 (v1 의 새김 금테 관이 판 끝 밑으로 2 mm 나와 있던 자리 — 판이 덮은 곳을 v1 과 같게 따로 한 메쉬)
    add(g, [flute(band(rows, -0.171, -0.163, 0.0016, -1.1, 1.1, 10), 0.0025, 8)], GOLD);
    const lames = [], gold = [flute(band(rows, -0.169, -0.162, 0.0016, -A, -1.1, 8), 0.0025, 8), flute(band(rows, -0.169, -0.162, 0.0016, 1.1, A, 8), 0.0025, 8)];
    for (let i = 0; i < 2; i++) {
      const y = 0.155 - i * 0.051, r = 0.102 - i * 0.004, w = 0.084 - i * 0.003, short = [[y - 0.049, r - 0.003, w - 0.002, 0], [y, r, w, 0]]; // 앞뒤만 4 mm 띄움(v1 0.098) — 넓적다리 판의 골이 뚫고 나와 톱니처럼 보이던 것
      const dip = geo => {
        const p = geo.attributes.position;
        for (let j = 0; j < p.count; j++) p.setY(j, p.getY(j) - 0.015 * (1 - Math.min(1, Math.abs(p.getZ(j)) / 0.084)));
        geo.computeVertexNormals();
        return geo;
      };
      lames.push(dip(shell(short, -PI * 0.52, PI * 0.52, 16)));
      gold.push(dip(band(short, y - 0.049, y - 0.043, 0.0016, -PI * 0.52, PI * 0.52, 16)));
    }
    add(g, lames, IVORY, { ...metal, side: THREE.DoubleSide });
    add(g, gold, GOLD);
  }
  function shin(g) {
    // 정강이받이: v1 꼴에서 발목 쪽 옆만 넓혔다(0.044 → 0.048 ~ 0.053) — v1 은 정강이 몸(반지름 0.05)이 발목 위 옆으로 뚫고 나와 검게 들쭉날쭉 보였다. 가장 넓은 단면은 그대로라 덮은 곳도 그대로
    const rows = [[-0.185, 0.050, 0.048, 0], [-0.14, 0.054, 0.053, 0], [-0.03, 0.062, 0.055, -0.002], [0.10, 0.065, 0.056, -0.002], [0.15, 0.057, 0.054, 0]];
    add(g, [flute(shell(rows, -PI, PI, 24), 0.0022, 8)]);
    // 무릎 판: 앞과 양옆만 — 오금(뒤)이 열려 사슬이 보인다
    const knee = [[-0.044, 0.061, 0.050, 0.018], [-0.015, 0.079, 0.067, 0.014], [0.028, 0.073, 0.058, 0.012], [0.055, 0.052, 0.040, 0.010]];
    add(g, [bake(flute(shell(knee, -1.95, 1.95, 16), 0.003, 8), [0, 0.165, 0])], IVORY, { ...metal, side: THREE.DoubleSide });
    add(g, [flute(band(rows, -0.185, -0.177, 0.0016, -PI, PI, 24), 0.0022, 8), bake(flute(band(knee, -0.044, -0.037, 0.0016, -1.95, 1.95, 16), 0.003, 8), [0, 0.165, 0])], GOLD);
    // 오금 사슬 (판 목록 — 무릎 판이 열어 둔 뒤쪽까지 덮은 곳을 v1 의 둥근 무릎 판과 같게)
    add(g, [mail([[0.118, 0.058, 0.052, 0], [0.17, 0.058, 0.054, 0.004], [0.222, 0.052, 0.050, 0.008]], 8)], MAIL, ringMail);
  }
  function foot(g) {
    // 쇠신: v1 꼴 그대로 · 바닥 공 20 × 12 → 12 × 8 · 앞코 판(잘게 나눈 판) → 부채꼴 · 금테 관 다섯 → 띠 셋
    const sole = g.children[0], old = sole.geometry;
    sole.geometry = bake(new THREE.SphereGeometry(1, 12, 8), [0, -0.009, 0], null, [0.117, 0.028, 0.047]);
    old.dispose();
    const p = [], uv = [], ix = [], rings = [[-0.115, 0.045, 0.032], [-0.066, 0.052, 0.057], [0, 0.051, 0.061], [0.075, 0.045, 0.042], [0.137, 0.029, 0.023], [0.151, 0.012, 0.016]], N = 12;
    const arch = (x, a, lift = 0) => {
      const r = rings.findIndex(q => q[0] >= x), k = Math.max(1, r < 0 ? rings.length - 1 : r), A = rings[k - 1], B = rings[k], t = THREE.MathUtils.clamp((x - A[0]) / (B[0] - A[0]), 0, 1);
      const w = A[1] + (B[1] - A[1]) * t + lift, hh = A[2] + (B[2] - A[2]) * t + 0.014 + lift;
      return [x, -0.017 + Math.sin(a) * hh, w * Math.cos(a)];
    };
    for (let j = 0; j < rings.length; j++) for (let i = 0; i <= N; i++) {
      p.push(...arch(rings[j][0], i / N * PI));
      uv.push(i / N, j / rings.length);
      if (j < rings.length - 1 && i < N) {
        const n = j * (N + 1) + i;
        ix.push(n, n + N + 1, n + 1, n + 1, n + N + 1, n + N + 2);
      }
    }
    const toe = p.length / 3;
    p.push(0.151, -0.017, 0);
    uv.push(0.5, 1);
    for (let i = 0; i < N; i++) ix.push(toe, (rings.length - 1) * (N + 1) + i, (rings.length - 1) * (N + 1) + i + 1);
    add(g, [mesh(p, uv, ix)], IVORY, { ...metal, side: THREE.DoubleSide });
    add(g, [-0.112, -0.020, 0.060].map(x => grid(N, 1, (u, t) => arch(x + 0.007 * t, u * PI, 0.0016))), GOLD, { ...metal, side: THREE.DoubleSide });
  }
  // 상아 뿔피리(올리판 — 롤랑의 뿔피리): 허리띠 바로 밑에 두 끈으로 매단 굽은 뿔 · 금 고리 넷 · 짙은 나팔 입.
  //  왼쪽 엉덩이 옆에서 뒤로(칼 든 손 반대 · 나팔은 망토 앞) — AI 끼리 판 점검(롤랑 츠바이핸더 · 상대 여섯 · 18 판)에서 칼날 · 허벅지와 겹침 0 · 왼 팔뚝 1 % (허리띠 밑 3 cm 더 낮으면 허벅지 18 %)
  function oliphant(layer, belt) {
    const pts = [[-0.020, -0.005, -0.174], [-0.066, -0.028, -0.183], [-0.113, -0.036, -0.166], [-0.147, -0.028, -0.131], [-0.158, -0.010, -0.092]];
    const radii = [0.007, 0.011, 0.017, 0.024, 0.030];
    const rAt = t => {
      const f = t * (radii.length - 1), k = Math.min(radii.length - 2, Math.floor(f));
      return radii[k] + (radii[k + 1] - radii[k]) * (f - k);
    };
    add(layer, [taperedTube(pts, radii, 14, 8)], HORN, { metalness: 0.05, roughness: 0.42 }).name = 'roland-oliphant';
    const path = new THREE.CatmullRomCurve3(pts.map(v)), Y = new THREE.Vector3(0, 1, 0);
    const across = (geo, t) => {
      const P = path.getPointAt(t), T = path.getTangentAt(t);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, T));
      geo.translate(P.x, P.y, P.z);
      return geo;
    };
    add(layer, [0.03, 0.34, 0.62, 0.975].map(t => across(new THREE.CylinderGeometry(rAt(t) + 0.0016, rAt(t) + 0.0016, t > 0.9 ? 0.011 : 0.007, 10, 1, true), t)), GOLD, { ...metal, side: THREE.DoubleSide });
    add(layer, [across(new THREE.CircleGeometry(rAt(1) * 0.9, 10).rotateX(-PI / 2), 0.995)], 0x1d1814, cloth);
    // 매단 끈: 허리띠 아랫단에서 금 고리 둘로
    const strap = t => {
      const P = path.getPointAt(t), [, d, w] = sample(belt, -0.002), top = onRows(belt, -0.002, Math.atan2(P.z / w, P.x / d), 0.001);
      return curve([top, [(top[0] + P.x) / 2, (top[1] + P.y) / 2, (top[2] + P.z) / 2 - 0.003], [P.x, P.y + rAt(t) * 0.8, P.z]], 0.0026, 4, 4);
    };
    add(layer, [strap(0.34), strap(0.62)], LEATHER, cloth);
  }
  return {
    armorParts: new Set(['chest', 'abdomen', 'pelvis', 'uarmS', 'uarmO', 'farmS', 'farmO', 'thighF', 'thighB', 'shinF', 'shinB', 'footF', 'footB']),
    head: helmet,
    chest(g) {
      const rows = [[-0.148, 0.102, 0.140, 0], [-0.092, 0.123, 0.153, -0.005], [-0.015, 0.142, 0.180, -0.006], [0.065, 0.134, 0.184, -0.009], [0.115, 0.104, 0.165, -0.010], [0.142, 0.076, 0.113, -0.009]];
      base(g, rows.map(([y, d, w, x]) => [y, d - 0.009, w - 0.009, x]));
      cape(g);
      // 흉갑: v1 꼴 · 가운데 등줄은 겉옷 앞판이 덮어 뺐다 · 겨드랑이를 파내어 밑의 사슬이 보인다(위끝이 옆에서 0.142 → 0.062)
      const top = a => 0.142 - 0.08 * Math.pow(Math.abs(Math.sin(a)), 8), y0 = -0.148;
      add(g, [grid(40, 7, (u, t) => {
        const a = -PI + 2 * PI * u;
        return onRows(rows, y0 + (top(a) - y0) * t, a);
      })]);
      const gorget = [[-0.006, 0.104, 0.104, 0], [0.016, 0.090, 0.091, 0], [0.057, 0.066, 0.066, 0]], gorgetGeo = shell(gorget, -PI, PI, 24);
      gorgetGeo.translate(0, 0.115, 0);
      add(g, [gorgetGeo]);
      // 금띠는 띠마다 따로 — 판이 상하면(파손) 곁 판처럼 떨어져 나간다 (v1 의 금테 관과 같게 · fighter.js wearPlate)
      add(g, [grid(40, 1, (u, t) => {
        const a = -PI + 2 * PI * u;
        return onRows(rows, top(a) - 0.007 + 0.007 * t, a, 0.0016);
      })], GOLD);
      add(g, [band(rows, -0.148, -0.141, 0.0016, -PI, PI, 40)], GOLD);
      add(g, [bake(band(gorget, -0.006, 0.001, 0.0016, -PI, PI, 24), [0, 0.115, 0]), bake(band(gorget, 0.050, 0.057, 0.0016, -PI, PI, 24), [0, 0.115, 0])], GOLD);
      const layer = artoriaCloth(g, 'roland-surcoat');
      // 겨드랑이 사슬 (흉갑 밑 · 파낸 자리로 보인다)
      add(layer, [-1, 1].map(s => stripe(grid(8, 8, (u, t) => onRows(rows, 0.02 + 0.115 * t, s * PI / 2 + (u * 2 - 1) * 0.8, -0.0055)), 9)), MAIL, ringMail);
      // 겉옷 앞판 · 성 문장
      const half = y => 0.084 - 0.014 * THREE.MathUtils.clamp((y + 0.148) / 0.246, 0, 1);
      surcoat(layer, rows, () => -0.152, () => 0.098, half, 0.0045, { top: true, nv: 6 });
      add(layer, [castle((y, z) => onRows(rows, y, angleAt(rows, y, z), 0.0062), -0.042, 1.05)], GOLD, { ...metal, side: THREE.DoubleSide });
    },
    abdomen(g) {
      const rows = [[-0.082, 0.101, 0.136, 0], [-0.031, 0.094, 0.130, 0], [0.034, 0.098, 0.134, 0], [0.079, 0.108, 0.143, 0]];
      base(g, rows.map(([y, d, w, x]) => [y, d - 0.006, w - 0.006, x]));
      // 배 판띠 둘 (v1 꼴 — 앞 아랫단이 살짝 처진다) · 아랫단 금테 관 → 띠
      const lames = [], gold = [];
      const sag = geo => {
        const p = geo.attributes.position;
        for (let j = 0; j < p.count; j++) if (p.getX(j) > 0) p.setY(j, p.getY(j) - 0.014 * (1 - Math.min(1, Math.abs(p.getZ(j)) / 0.14)));
        geo.computeVertexNormals();
        return geo;
      };
      for (let i = 0; i < 2; i++) {
        const y = 0.079 - i * 0.078, slice = [sample(rows, y - 0.085), sample(rows, y)];
        slice[0][0] = y - 0.085;
        slice[1][0] = y;
        lames.push(sag(shell(slice)));
        gold.push(sag(band(slice, y - 0.085, y - 0.078)));
      }
      for (const l of lames) add(g, [l]);
      for (const l of gold) add(g, [l], GOLD);
      surcoat(artoriaCloth(g, 'roland-surcoat'), rows, () => -0.098, () => 0.084, () => 0.083, 0.0045);
    },
    pelvis(g) {
      const rows = [[-0.10, 0.111, 0.159, 0], [-0.025, 0.107, 0.147, 0], [0.056, 0.098, 0.133, 0], [0.080, 0.099, 0.133, 0]];
      base(g, rows.map(([y, d, w, x]) => [y, d - 0.005, w - 0.005, x]));
      add(g, [shell(rows)]);
      add(g, [band(rows, -0.100, -0.093)], GOLD);
      add(g, [band(rows, 0.073, 0.080)], GOLD);
      const layer = artoriaCloth(g, 'roland-surcoat');
      // 겉옷 앞판: 허리띠 밑으로 얕은 V 단 (가랑이 위에서 끝나 허벅지를 들어도 걸리지 않는다)
      surcoat(layer, rows, u => -0.094 - 0.014 * (1 - Math.abs(u * 2 - 1)), () => 0.082, y => 0.083 + 0.005 * THREE.MathUtils.clamp(-y / 0.1, 0, 1), 0.0055, { hem: true });
      // 허리띠 (겉옷 위 · 천 층 — 판이 부서져도 남는다) · 금 버클
      const belt = [[-0.003, 0.121, 0.157, 0], [0.023, 0.118, 0.151, 0]];
      add(layer, [shell(belt)], LEATHER, cloth);
      add(layer, [band(belt, -0.003, 0.0015, 0.0012), band(belt, 0.0185, 0.023, 0.0012), bake(new THREE.BoxGeometry(0.008, 0.032, 0.034), [0.123, 0.010, -0.012])], GOLD);
      oliphant(layer, belt);
    },
    uarmS(g) {
      shoulder(g, 1);
    },
    uarmO(g) {
      shoulder(g, -1);
    },
    farmS: forearm,
    farmO: forearm,
    thighF: thigh,
    thighB: thigh,
    shinF: shin,
    shinB: shin,
    footF: foot,
    footB: foot,
  };
}
