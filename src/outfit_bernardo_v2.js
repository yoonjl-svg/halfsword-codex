// 베르나르도 복식 v2 (10/23 — 사장님 10/23 '줄이면서 디자인 개선' · 앞 · 3/4 · 뒤 · 싸우는 화면을 보고 내린 여섯 가지 → 같은 날 밤 다듬기 둘)
//  v1(src/outfit_bernardo.js — 전달본 올리비에 그대로)과 같은 몸 · 같은 판금 13 부위 · 투구 없음 · 얼굴(피부 · 코 · 턱) · 칼(티소나)은 그대로. 바뀐 것:
//   ① 머리 · 목: 곱슬 중단발은 v1 그대로 · 목은 v1 의 쇠 깃 그대로 (10/23 23:4x 사장님 '머리스타일과 목깃은 원래 디자인이 나아' — 그 전의 밝은 누빔 깃 띠 · 어깨 뒤로 넘긴 곱슬은 뺌)
//      수염은 다듬은 턱수염 — 얼굴에서 떨어진 거리(길이 · 튀어나옴)와 가닥 수를 반으로 (같은 때 '지금의 50% 정도로 하자 밀도와 길이를')
//   ② 몸통: 가로 테를 겹친 통 대신 가슴판 한 장 + 배 쇠띠 셋 + 흰 겉옷(앞판 · 뒤판 — 옆이 트여 갑옷이 보임 · 무릎까지 · 둘레에 금테) · 허리띠
//   ③ 넓적다리 상자 판 · 황토빛 단 → 어두운 사슬 치마(아랫단 톱니 · 놋쇠 고리) + 겉옷 자락(앞 · 뒤 — 다리마다 따로 붙어 걸음에 앞뒤 가운데가 갈라짐 · 무릎 위까지)
//   ④ 작은 무릎 덮개(사슬 치마에 매달림 — 사슬이 다 부서질 때 같이 떨어진다 · 위아래 금테)
//   ⑤ 망토: 맑고 짙은 금빛 · v1 과 같은 어깨(인물 오른어깨 = 앞에서 보아 왼쪽)에 걸쳐 종아리까지 길게 · 등을 비스듬히 덮고 왼허리 뒤로 내려감 ·
//      깊은 주름 셋 · 짙은 금갈색 안감 · 앞 끝 놋쇠 브로치 (10/23 23:5x 사장님 — 레온 왕가의 피 · 롤랑의 숙적다운 위엄)
//      겉감 · 안감은 한 장의 두 면 · 가장자리 단은 가는 관 · 앞 끝 쪽 아랫단은 옆으로 덜 벌어짐(10/24 사장님 '망토가 너무 두꺼워보여' — 그 전 안감 5 mm 안쪽 둘째 겹 · 굵은 단을 덜어 얇은 천으로)
//   ⑥ 겉옷 가슴 한가운데에 크게, 금관을 쓴 레온 왕국의 선 사자(평면 실루엣 · 문장의 오른쪽(+Z)을 봄) — 빛깔은 look.lion:
//      'black'(기본 — 흰 바탕에 검은 사자 · 검정과 금) · 'gold'(금빛 사자 + 가는 검은 테두리) (10/24 사장님 '사자 색이 너무 튄다. 그냥 검게 하거나 금색으로' — 그 전 보랏빛)
//   ⑦ 검은 갑옷에 가는 금테(견갑 단 · 팔뚝 보호대 양끝 · 무릎 덮개) — 상아와 금의 롤랑 ↔ 검정과 금의 베르나르도
//   ⑧ (시험) 곱슬 위 가는 금빛 머리띠 — look.circlet 일 때만(looks.js · 감독이 빼려면 그 칸만 지운다) · 머리 그룹 장식이라 투구 · 판금 판정과 무관
//  판금(look.armor 'plate'): 부위마다 판금 메쉬 = 그 부위에 바로 붙인 메쉬(outfits.js decorateOutfit) — 겉옷 · 망토 · 허리띠는 몸 바탕 메쉬에 매단
//   천 층(artoriaCloth)이라 판금이 아니다(덮은 곳 · 닳음 · 부서져 날아감에서 빠지고, 판이 다 부서져도 남는다). 쇠 깃 · 테 · 금테 · 놋쇠 고리 · 무릎 덮개는 판의 자식이라 판과 같이 움직이고 떨어진다.
//  삼각형은 tools/sim/look_tris.mjs (몸 하나 · 칼 뺌) — 확인표 2318 · 2321 ~ 2325. 좌표: +X 앞 · +Y 위 · +Z 오른쪽
export function createBernardoOutfitV2(h, palette = {}) {
  const { THREE, bake, box, cyl, ball, addMerged, artoriaCloth, quietFace, taperedTube, capeSway } = h;
  const IRON = 0x484b46, EDGE = 0x858575, BRASS = 0x9c7b36, MAIL = 0x50534e, LEATHER = 0x4a3526;
  const TABARD = palette.tabard ?? 0xe6e0d0, SABLE = 0x221f1c, GOLD = palette.cloak ?? 0xb08a2c, GOLD_IN = palette.lining ?? 0x705222, TRIM = 0xc29b40;
  const metal = { metalness: 0.68, roughness: 0.52, steel: 0.75, side: THREE.DoubleSide };
  const gilt = { metalness: 0.72, roughness: 0.36, steel: 0.6, side: THREE.DoubleSide };
  const mailMat = { metalness: 0.6, roughness: 0.6, steel: 0.55, side: THREE.DoubleSide, vertexColors: true };
  const cloth = { metalness: 0, roughness: 0.97, side: THREE.DoubleSide };
  const shaded = { ...cloth, vertexColors: true };
  const add = (g, p, c = IRON, m = metal) => addMerged(g, p, c, m);
  const curve = (p, r = 0.0018, n = 12, radial = 4) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p.map(v => new THREE.Vector3(...v))), n, r, radial, false);
  const smooth = x => x * x * (3 - 2 * x);
  function mesh(p, ix, cols) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(p.flatMap((_, i) => i % 3 === 0 ? [p[i + 2], p[i + 1]] : []), 2));
    if (cols) g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(ix);
    g.computeVertexNormals();
    return g;
  }
  // 줄 [y, 앞뒤 반지름 d, 좌우 반지름 w, 앞 밀림 x] 의 각도 a 자리 (a = 0 앞 · π/2 오른쪽 · π 뒤)
  function point(row, a) {
    const [y, d, w, x = 0] = row, c = Math.cos(a);
    return [x + d * Math.sign(c) * Math.pow(Math.abs(c), 0.78), y, w * Math.sin(a)];
  }
  /** 줄들을 이은 겉면. tint(j, i) 가 있으면 꼭짓점 밝기(재질 색에 곱함 — 주름 · 사슬 줄) */
  function shell(rows, a0 = -Math.PI, a1 = Math.PI, N = 16, tint = null) {
    const p = [], ix = [], cols = tint ? [] : null;
    for (let j = 0; j < rows.length; j++) for (let i = 0; i <= N; i++) {
      p.push(...point(rows[j], a0 + (a1 - a0) * i / N));
      if (tint) {
        const k = tint(j, i);
        cols.push(k, k, k);
      }
      if (j < rows.length - 1 && i < N) {
        const k = j * (N + 1) + i;
        ix.push(k, k + N + 1, k + 1, k + 1, k + N + 1, k + N + 2);
      }
    }
    return mesh(p, ix, cols);
  }
  const rim = (row, a0 = -Math.PI, a1 = Math.PI, r = 0.0019, n = 16, radial = 3) => curve(Array.from({ length: n + 1 }, (_, i) => point(row, a0 + (a1 - a0) * i / n)), r, n, radial);
  /** y 자리의 줄 (rows 는 y 가 커지는 차례) */
  function rowAt(rows, y) {
    let k = 0;
    while (k < rows.length - 2 && y > rows[k + 1][0]) k++;
    const a = rows[k], b = rows[k + 1], t = (y - a[0]) / (b[0] - a[0]);
    return a.map((v, i) => v + ((b[i] ?? 0) - v) * t);
  }
  const grow = (row, o) => [row[0], row[1] + o, row[2] + o, row[3] ?? 0];
  /** 판 겉면을 따라 y0 → y1 을 두르는 납작한 띠(금테 — 관 대신 면 하나라 삼각형이 적다) */
  const band = (rows, y0, y1, lift = 0.0016, a0 = -Math.PI, a1 = Math.PI, N = 16) => shell([grow(rowAt(rows, y0), lift), grow(rowAt(rows, y1), lift)], a0, a1, N);
  /** 겉옷 판: 줄 [y, d, w, x, 반폭] — 줄마다 반폭(z)에 맞춰 각도 폭을 정한다. back 이면 뒤판(π 둘레) */
  function panel(rows, back = false, N = 8) {
    const p = [], ix = [];
    rows.forEach((row, j) => {
      const s = Math.asin(Math.min(0.97, row[4] / row[2]));
      for (let i = 0; i <= N; i++) {
        p.push(...point(row, (back ? Math.PI : 0) - s + 2 * s * i / N));
        if (j < rows.length - 1 && i < N) {
          const k = j * (N + 1) + i;
          ix.push(k, k + N + 1, k + 1, k + 1, k + N + 1, k + N + 2);
        }
      }
    });
    return mesh(p, ix);
  }
  /** 겉옷 판의 금테: 양옆 끝(폭 edge) · top 이면 윗단도 — 판에서 lift 만큼 띄운 납작한 띠 */
  function panelTrim(rows, back = false, { top = false, edge = 0.008, lift = 0.0012 } = {}) {
    const c0 = back ? Math.PI : 0, ang = (row, half) => Math.asin(Math.min(0.97, half / row[2])), out = [];
    for (const sgn of [-1, 1]) {
      const p = [], ix = [];
      rows.forEach((row, j) => {
        const r = [row[0], row[1] + lift, row[2] + lift, row[3]];
        p.push(...point(r, c0 + sgn * ang(row, row[4] - edge)), ...point(r, c0 + sgn * ang(row, row[4])));
        if (j < rows.length - 1) ix.push(2 * j, 2 * j + 2, 2 * j + 1, 2 * j + 1, 2 * j + 2, 2 * j + 3);
      });
      out.push(mesh(p, ix));
    }
    if (top) {
      const y1 = rows.at(-1)[0], a = rowAt(rows, y1 - edge), b = rows.at(-1);
      out.push(panel([[a[0], a[1] + lift, a[2] + lift, a[3], a[4]], [b[0], b[1] + lift, b[2] + lift, b[3], b[4]]], back, 8));
    }
    return out;
  }
  function base(g, rows, N = 16) {
    for (const c of g.children.slice(1)) c.visible = false;
    g.children[0].geometry.dispose();
    g.children[0].geometry = shell(rows, -Math.PI, Math.PI, N);
  }

  // ── 머리: 얼굴은 v1 그대로 · 곱슬 중단발은 v1 그대로 · 수염은 다듬어 반으로 ──
  //  얼굴 공(아래 head 에서 고친 꼴 — 입 아래는 옆으로 넓고 앞으로 5 mm)의 겉면까지 거리: 머리 가운데에서 단위 방향 (x, y, z) 로
  function faceRadius(x, y, z) {
    let lo = 0.04, hi = 0.2;
    for (let k = 0; k < 22; k++) {
      const r = (lo + hi) / 2, py = y * r, low = py < -0.035;
      const px = low && x > 0 ? Math.max(0, x * r - 0.005) : x * r, pz = low ? z * r / (1 + 0.14 * Math.min(1, (-py - 0.035) / 0.055)) : z * r;
      if (px * px + py * py + pz * pz < 0.01) lo = r;
      else hi = r;
    }
    return (lo + hi) / 2;
  }
  /** 다듬은 수염(10/23 23:4x): 얼굴 겉면에서 떨어진 거리를 k 배로 — 턱 아래로 늘어진 길이 · 앞으로 튀어나온 만큼 · 가닥 굵기가 얼굴 쪽으로 같이 줄고,
   *  구레나룻 · 콧수염과 이어진 자리(얼굴에 붙은 뿌리)는 그대로 남는다. 겉면에서 1.2 mm 안쪽의 점은 그대로(얼굴과 겹쳐 깜빡이지 않게) */
  function groom(geo, k = 0.5) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, y, z), s = faceRadius(x / r, y / r, z / r), o = r - s;
      const q = (s + (o > 0 ? Math.max(k * o, Math.min(o, 0.0012)) : k * o)) / r;
      p.setXYZ(i, x * q, y * q, z * q);
    }
    geo.computeVertexNormals();
    return geo;
  }
  function head(g, look) {
    quietFace(g, look, 'omari');
    for (const eye of g.children.slice(1, 3)) {
      eye.scale.set(1, 1, 1);
      eye.material.color.setHex(0x241c17);
    }
    const face = g.children[0], p = face.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), x = p.getX(i), z = p.getZ(i);
      if (y < -0.035) {
        p.setZ(i, z * (1 + 0.14 * Math.min(1, (-y - 0.035) / 0.055)));
        if (x > 0) p.setX(i, x + 0.005);
      }
    }
    p.needsUpdate = true;
    face.geometry.computeVertexNormals();
    const nose = g.children[3];
    nose.geometry.dispose();
    nose.geometry = bake(new THREE.SphereGeometry(1, 10, 8), null, null, [0.016, 0.021, 0.013]);
    nose.position.set(0.101, -0.012, 0);
    const locks = [[], [], []], beard = [[], [], []], detail = [];
    // 머리는 v1(outfit_bernardo.js) 그대로 — 가닥 수 · 길 · 굵기 · 색이 같고, 관 마디 · 면 수만 v2 만큼(삼각형)
    // 정수리 위로 넘긴 물결 머리 — 머리선은 두 눈 위에 둔다
    for (let i = 0; i < 22; i++) {
      const z = (i - 10.5) * 0.009, a = Math.abs(z) / 0.105, y = 0.062 - 0.020 * a + 0.007 * Math.sin(i * 1.6);
      locks[i % 3].push(taperedTube([[0.088 - 0.028 * a, y, z], [0.060, 0.085 - 0.032 * a + 0.011 * Math.sin(i * 1.3), z + 0.009 * Math.sin(i)], [-0.002, 0.108 - 0.055 * a ** 1.4, z * 1.10 + 0.005 * Math.cos(i)], [-0.064, 0.085 - 0.035 * a, z * 1.10], [-0.091, 0.008, z * 1.05]], [0.001, 0.011, 0.012, 0.011, 0.002], 14, 5));
    }
    // 중단발 곱슬: 귀 뒤로 넘기고, 목덜미는 숱 많게, 끝은 고르지 않게 말림
    for (let i = 0; i < 41; i++) {
      const a = 0.72 + i / 40 * (Math.PI * 2 - 1.44), x = 0.103 * Math.cos(a) - 0.012, z = 0.104 * Math.sin(a), len = 0.145 + 0.045 * (0.5 + 0.5 * Math.sin(i * 2.3));
      const path = [];
      for (let j = 0; j < 9; j++) {
        const t = j / 8, w = 0.010 * Math.sin(t * Math.PI * 3.3 + i * 0.9);
        path.push([x - 0.016 * t + w * Math.cos(a), 0.035 - len * t, z * (1 + 0.17 * t) + w * Math.sin(a)]);
      }
      locks[i % 3].push(taperedTube(path, [0.010, 0.012, 0.012, 0.011, 0.010, 0.011, 0.008, 0.006, 0.001], 16, 5));
    }
    // 수염: 턱을 두르는 이어진 바탕 + 굽은 가닥(부피와 결) — 자리 · 색은 v1 · 그 전 v2 그대로, 가닥은 반(턱선 6 → 3 · 턱 끝 5 → 2 · 콧수염 1 — 한쪽),
    //  다 지은 뒤 groom 으로 얼굴에서 떨어진 거리를 반으로 (이름 'beard' — look_tris 밖 재는 도구가 수염 조각을 고른다)
    const beardRows = [[-0.107, 0.067, 0.049, 0.016], [-0.093, 0.095, 0.074, 0.007], [-0.065, 0.101, 0.087, 0], [-0.041, 0.093, 0.091, 0]];
    const tag = geo => Object.assign(groom(geo), { name: 'beard' });
    add(g, [tag(shell(beardRows, -1.72, 1.72, 24))], look.hair, cloth);
    for (const side of [-1, 1]) {
      [0, 0.5, 1].forEach((t, i) => {
        const z = side * (0.081 - 0.059 * t), x = 0.047 + 0.049 * t, y = 0.014 - 0.063 * t;
        beard[i % 3].push(tag(taperedTube([[x, y, z], [x + 0.012, y - 0.034, z * 0.98], [x + 0.008, y - 0.060, z * 0.86], [x - 0.008, y - 0.079, z * 0.73]], [0.008, 0.013, 0.012, 0.001], 10, 5)));
      });
      [0.3, 2.3].forEach((i, n) => {
        const z = side * (0.008 + i * 0.014), x = 0.107 - 0.020 * (i / 4) ** 2;
        beard[(n + 1) % 3].push(tag(taperedTube([[x, -0.057, z], [x + 0.004, -0.080, z], [x - 0.013, -0.104, z * 0.84], [x - 0.030, -0.116 + 0.014 * i / 4, z * 0.69]], [0.009, 0.012, 0.009, 0.001], 10, 5)));
      });
      beard[0].push(tag(taperedTube([[0.119, -0.035, side * 0.003], [0.117, -0.038, side * 0.019], [0.102, -0.046, side * 0.040]], [0.007, 0.009, 0.004], 8, 5)));
      detail.push(curve([[0.092, 0.038, side * 0.020], [0.099, 0.041, side * 0.036], [0.091, 0.035, side * 0.053]], 0.003, 8));
    }
    for (let i = 0; i < 3; i++) {
      const o = add(g, [...locks[i], ...beard[i]], [look.hair, 0x272622, 0x302d26][i], cloth);
      o.name = 'bernardo-curls-and-beard-' + i;
    }
    add(g, detail, look.hair, cloth);
    // 입술 선: 수염 겉면 위에 그은 선이라 수염과 같이 안으로 (꼴 · 색 그대로)
    add(g, [groom(curve([[0.110, -0.048, -0.014], [0.113, -0.049, 0], [0.110, -0.048, 0.014]], 0.0017, 8))], 0x704534, cloth);
    if (look.circlet) circlet(g);
  }
  // 가는 금빛 머리띠(시험 · 10/23 23:5x — 왕가의 피를 넌지시): 이마의 머리선 바로 위 → 옆 · 뒤는 곱슬 겉으로 (뾰족한 끝 · 보석 없음 — 이마 가운데 작은 금 마름모 하나)
  //  둘레 반지름 앞 0.095 · 옆 0.117 · 뒤 0.131 m(가운데 4 mm 뒤) · 높이 앞 0.054 → 뒤 0.030 · 폭 5 mm — 앞은 머리 덮개 위 2 mm, 옆 · 뒤는 곱슬 사이로 지나가 몇 가닥이 띠를 덮는다(머리 위에 뜬 고리로 보이지 않게)
  function circlet(g) {
    const N = 40, H = 0.005, ring = (a, dy) => {
      const c = Math.cos(a), r = c > 0 ? 0.117 + (0.095 - 0.117) * c ** 1.5 : 0.117 + (0.131 - 0.117) * (-c) ** 1.2;
      return [r * c - 0.004, 0.042 + 0.012 * c + dy, r * Math.sin(a)];
    };
    const p = [], ix = [];
    for (let i = 0; i <= N; i++) {
      const a = i / N * Math.PI * 2;
      p.push(...ring(a, -H / 2), ...ring(a, H / 2));
      if (i < N) ix.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3);
    }
    const [fx, fy] = ring(0, 0), x0 = fx + 0.0015, gem = [x0, fy + 0.0065, 0, x0, fy, 0.0045, x0, fy - 0.0065, 0, x0, fy, -0.0045, x0 + 0.003, fy, 0];
    add(g, [mesh(p, ix), mesh(gem, [0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4])], TRIM, gilt).name = 'bernardo-circlet';
  }

  // ── 가슴: 가슴판 한 장 · v1 쇠 깃 · 흰 겉옷 앞판(금관 쓴 사자) · 뒤판 · 금테 · 금빛 긴 망토 ──
  const chestRows = [[-0.146, 0.103, 0.138, 0], [-0.095, 0.119, 0.151, 0], [0.018, 0.137, 0.176, -0.008], [0.091, 0.125, 0.170, -0.008], [0.142, 0.073, 0.107, -0.005]];
  // 겉옷은 가슴의 가장 넓은 곳에서 곧게 떨어진다 (판에 바짝 붙지 않게) — [y, d, w, x, 반폭]
  const tabardChest = [[-0.158, 0.134, 0.168, 0, 0.104], [-0.060, 0.146, 0.182, -0.004, 0.102], [0.018, 0.151, 0.190, -0.008, 0.100], [0.091, 0.139, 0.184, -0.008, 0.092], [0.124, 0.104, 0.142, -0.006, 0.075]];
  function plateShell(rows, N = 24) {
    // 가운데 능선이 살짝 선 가슴판 (앞 ±0.5 rad 안에서만 앞으로 6 mm)
    const geo = shell(rows, -Math.PI, Math.PI, N), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i)), k = Math.max(0, 1 - Math.abs(a) / 0.5), y = p.getY(i);
      if (y < 0.12) p.setX(i, p.getX(i) + 0.006 * k * Math.min(1, (0.12 - y) / 0.05));
    }
    geo.computeVertexNormals();
    return geo;
  }
  function lion() {
    // 문장의 선 사자(rampant) — (u 오른쪽 = +Z 덱스터, v 위) 1 = 사자 키. 조각을 겹쳐 한 실루엣 (같은 색 · 같은 면이라 겹친 자리가 보이지 않는다)
    const ell = (cx, cy, rx, ry, rot = 0, n = 12, jag = 0) => Array.from({ length: n }, (_, i) => {
      const t = i / n * Math.PI * 2, r = 1 + (i % 2 ? jag : 0), x = rx * r * Math.cos(t), y = ry * r * Math.sin(t);
      return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)];
    });
    const limb = (pts, w0, w1) => {
      const out = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1], L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / L, ny = (bx - ax) / L;
        const wa = (w0 + (w1 - w0) * i / (pts.length - 1)) / 2, wb = (w0 + (w1 - w0) * (i + 1) / (pts.length - 1)) / 2;
        out.push([[ax + nx * wa, ay + ny * wa], [bx + nx * wb, by + ny * wb], [bx - nx * wb, by - ny * wb], [ax - nx * wa, ay - ny * wa]]);
        if (i > 0) out.push(ell(ax, ay, wa, wa, 0, 8));
      }
      return out;
    };
    return [
      ell(0.02, 0.45, 0.14, 0.26, -0.40), // 몸통 (위가 앞으로 기욺)
      ell(0.10, 0.70, 0.17, 0.16, -0.2, 16, 0.28), // 갈기
      ell(0.20, 0.82, 0.10, 0.085, 0, 12), // 머리 (귀 자리에 금관 — lionCrown)
      [[0.25, 0.88], [0.37, 0.87], [0.38, 0.80], [0.27, 0.775]], // 윗주둥이
      [[0.25, 0.78], [0.35, 0.755], [0.33, 0.715], [0.23, 0.73]], // 벌린 아래턱
      ...limb([[0.16, 0.68], [0.29, 0.79], [0.39, 0.90]], 0.085, 0.055), // 높이 든 앞발
      [[0.37, 0.94], [0.45, 0.99], [0.42, 0.93], [0.48, 0.93], [0.42, 0.89], [0.46, 0.85], [0.38, 0.86]],
      ...limb([[0.15, 0.57], [0.29, 0.61], [0.40, 0.69]], 0.08, 0.05), // 낮은 앞발
      [[0.39, 0.73], [0.47, 0.765], [0.43, 0.70], [0.49, 0.68], [0.42, 0.66], [0.46, 0.62], [0.38, 0.655]],
      ell(-0.04, 0.27, 0.10, 0.12, -0.3), // 디딘 뒷다리 허벅지
      ...limb([[-0.03, 0.24], [0.04, 0.13], [-0.04, 0.04]], 0.10, 0.06),
      [[-0.10, 0.07], [0.06, 0.07], [0.14, 0.035], [0.11, 0.0], [0.16, -0.01], [0.06, -0.02], [-0.10, -0.01]],
      ...limb([[0.06, 0.30], [0.20, 0.31], [0.24, 0.17]], 0.10, 0.06), // 든 뒷발
      [[0.21, 0.20], [0.32, 0.18], [0.29, 0.14], [0.34, 0.11], [0.26, 0.115], [0.20, 0.14]],
      ...limb([[-0.10, 0.25], [-0.24, 0.27], [-0.32, 0.40], [-0.30, 0.56], [-0.22, 0.66]], 0.05, 0.035), // 꼬리
      ell(-0.19, 0.725, 0.045, 0.085, -0.5, 10, 0.2), // 꼬리 끝 술
    ];
  }
  // 사자 머리 위 작은 금관 (레온 왕국 문장 — 관을 쓴 사자): 띠 + 낮은 끝 셋
  const lionCrown = [[0.125, 0.885], [0.285, 0.885], [0.292, 0.985], [0.255, 0.935], [0.205, 1.005], [0.155, 0.935], [0.118, 0.985]];
  /** 다각형을 바깥으로 o 만큼 넓힌다(금빛 사자의 검은 테두리 — 꼭짓점마다 두 변의 바깥 법선 사이로, 뾰족한 끝은 2o 까지만) */
  function grownPoly(poly, o) {
    const n = poly.length;
    let area = 0;
    for (let i = 0; i < n; i++) area += poly[i][0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * poly[i][1];
    const out = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) * Math.sign(area); return [dy / L, -dx / L]; };
    return poly.map((q, i) => {
      const n1 = out(poly[(i + n - 1) % n], q), n2 = out(q, poly[(i + 1) % n]), mx = n1[0] + n2[0], my = n1[1] + n2[1], L = Math.hypot(mx, my) || 1;
      const k = o * Math.min(2, 1 / Math.max(0.5, (mx * n1[0] + my * n1[1]) / L));
      return [q[0] + mx / L * k, q[1] + my / L * k];
    });
  }
  function cape(g) {
    // 긴 망토(10/23 23:5x): t 0 어깨 → 1 아랫단(종아리) · s 0 앞 끝(오른쇄골 브로치) → 1 먼 끝. 위 끝은 목 둘레를 따라 오른어깨를 넘고,
    //  앞 끝은 어깨에서 오른옆 뒤로 · 먼 끝은 목 뒤 등줄 오른쪽에서 왼허리 뒤로 비스듬히 내려가 한쪽 어깨에 걸쳐 등을 덮은 천이 된다(왼어깨 · 왼등 위는 드러남).
    //  롤랑 v2 망토처럼 가슴에 매단 한 장(천 층) · 줄 간격은 어깨에서 촘촘하게(T) · 허리 아래는 엉덩이 · 다리에서 떨어져 뒤로 처진다
    //  (아랫단 반지름 앞뒤 0.34 · 옆 0.30 m · 먼 끝 3.9 rad — tools/sim/cape_clip.mjs 로 잰 다리 · 칼 겹침이 롤랑 v2 망토만큼 되게 고른 값, 확인표 2322)
    //  10/24 얇게: 옆으로 벌어지는 몫(0.065 q)을 앞 끝 쪽에서 35 % 로(먼 끝 쪽은 그대로) — 아랫단 앞 끝 옆 반지름 0.30 → 0.26 m. 앞에서 보이던 안감 띠(옆으로 벌어진 천의 안쪽)가
    //  판자 옆면처럼 넓게 읽혀 좁힘 · 길이 · 주름 · 뒤로 처짐(앞뒤 0.34)은 그대로 (다리 겹침 1.7 → 1.9 % — 확인표 2329)
    const layer = artoriaCloth(g, 'bernardo-gold-mantle'), C = 20;
    const T = [0, 0.012, 0.03, 0.055, 0.09, 0.14, 0.21, 0.30, 0.40, 0.51, 0.63, 0.75, 0.86, 0.94, 1];
    const TOP = 0.155, DROP = 1.18;
    const wave = (t, s) => Math.sin(Math.PI * 5 * s + 0.4 + 1.1 * t); // 주름 셋 (골 둘 · 아래로 갈수록 비스듬히)
    const at = (t, s) => {
      const yd = (DROP - 0.14 * s) * t, u = yd / DROP, e = 1 - (1 - Math.min(1, yd / 0.12)) ** 2, q = u ** 1.5;
      const f = (0.005 + 0.050 * u ** 1.1) * wave(t, s);
      const front = 1.05 + 0.95 * smooth(Math.min(1, yd / 0.35)), far = 2.95 + 0.95 * smooth(Math.min(1, yd / 0.75));
      return point([TOP - yd, 0.095 + 0.09 * e + 0.150 * q + f, 0.135 + 0.10 * e + 0.065 * q * (0.35 + 0.65 * s) + f, -0.008], front + (far - front) * s);
    };
    // 겉감 · 안감 = 한 장의 두 면(10/24 — 사장님 '망토가 너무 두꺼워보여'): 겉감 재질은 앞면(몸 밖을 보는 면)만, 안감 재질은 뒷면만 그려 두께 0 · 겹친 면 깜빡임 없음.
    //  (그 전: 안감을 5 mm 안쪽에 따로 둔 둘째 겹 — 비스듬히 보면 두 겹 사이 금빛 틈이 판자 모서리처럼 읽혔다.) 줄은 바깥에서 보아 반시계 = 앞면이 몸 밖
    const p = [], ix = [], cols = [];
    T.forEach((t, j) => {
      for (let i = 0; i <= C; i++) {
        const s = i / C, k = 1 - 0.6 * (0.5 - 0.5 * wave(t, s)) * Math.min(1, 0.25 + t);
        p.push(...at(t, s));
        cols.push(k, k, k);
        if (j < T.length - 1 && i < C) {
          const n = j * (C + 1) + i;
          ix.push(n, n + 1, n + C + 1, n + 1, n + C + 2, n + C + 1);
        }
      }
    });
    const sheet = mesh(p, ix, cols);
    const outer = add(layer, [sheet.clone()], GOLD, { ...shaded, side: THREE.FrontSide });
    outer.name = 'bernardo-gold-mantle';
    const lining = add(layer, [sheet], GOLD_IN, { ...shaded, side: THREE.BackSide });
    lining.name = 'bernardo-mantle-lining';
    // 가장자리 단(안감 색 · 두꺼운 모직 천의 결): 어깨 위 접힌 단 지름 6 mm · 앞 끝 · 먼 끝 · 아랫단 3.6 mm (그 전 12 · 7 mm)
    const hems = add(layer, [
      curve(Array.from({ length: 17 }, (_, i) => at(0, i / 16)), 0.003, 16, 3),
      curve(T.map(t => at(t, 0)), 0.0018, 14, 3),
      curve(T.map(t => at(t, 1)), 0.0018, 14, 3),
      curve(Array.from({ length: 21 }, (_, i) => at(1, i / 20)), 0.0018, 20, 3),
    ], GOLD_IN, cloth);
    // 흔들림 (10/24 — src/cape_sway.js): 겉감 · 안감 · 단을 같은 뼈에 건다 — 꼴 · 주름 · 색 · 길이 · 매단 곳 그대로, 아래쪽이 몸통을 반 박자 늦게 따라온다.
    //  브로치는 어깨 위 끝(흔들림 0)이라 그대로 둔다
    capeSway(layer, [outer, lining, hems]);
    // 앞 끝 놋쇠 브로치 (오른쇄골)
    const [bx, by, bz] = at(0.012, 0), psi = Math.atan2(bz, bx);
    add(layer, [cyl(0.016, 0.016, 0.006, 12, false, [bx + 0.004 * Math.cos(psi), by, bz + 0.004 * Math.sin(psi)], [0, -psi, -Math.PI / 2]), ball(0.006, 6, 4, [bx + 0.008 * Math.cos(psi), by, bz + 0.008 * Math.sin(psi)])], BRASS, metal);
  }
  function chest(g, look) {
    base(g, chestRows.map(([y, d, w, x]) => [y, d - 0.012, w - 0.012, x]), 20);
    // 판금 (이 부위에 바로 붙인 메쉬 = 판금 — 가슴판이 첫 판이라 금(plateCrack)이 이 판의 앞에 붙는다)
    const plate = add(g, [plateShell(chestRows)]);
    plate.name = 'bernardo-breastplate';
    add(plate, [rim(chestRows[0], -Math.PI, Math.PI, 0.0022, 20), rim(chestRows.at(-1), -Math.PI, Math.PI, 0.0022, 16)], EDGE);
    // 목: v1 의 쇠 깃 그대로(줄 · 테 · 색 — 10/23 23:4x). v1 은 따로 붙인 판이었고 여기선 가슴판의 자식(판 목록 · 파손 때 떨어지는 곁 판 수는 그 전 v2 그대로)
    add(plate, [shell([[0.126, 0.082, 0.105, 0], [0.177, 0.059, 0.066, 0]], -Math.PI, Math.PI, 24)], IRON).name = 'bernardo-iron-collar';
    add(plate, [rim([0.177, 0.060, 0.067, 0], -Math.PI, Math.PI, 0.0017, 24, 4)], EDGE);
    // 천 층 (판금 아님): 겉옷 앞판 · 뒤판 + 금테(양옆 · 목 둘레)
    const layer = artoriaCloth(g, 'bernardo-tabard');
    add(layer, [panel(tabardChest), panel(tabardChest, true)], TABARD, cloth);
    add(layer, [...panelTrim(tabardChest, false, { top: true }), ...panelTrim(tabardChest, true, { top: true })], TRIM, gilt);
    // 레온의 사자 — 겉옷 앞판 한가운데에 금테 안쪽을 꽉 채울 만큼 크게(키 0.205 m · 폭 0.17 m — 그 전 0.145 m), 겉면에 2.5 mm 띄워 굽혀 붙인다
    const S = 0.205, y0 = -0.128, du = -0.0725;
    const onTabard = (poly, lift) => {
      const tris = THREE.ShapeUtils.triangulateShape(poly.map(([u, v]) => new THREE.Vector2(u, v)), []);
      return mesh(poly.flatMap(([u, v]) => {
        const y = y0 + v * S, z = (u + du) * S, [, d, w, x0] = rowAt(tabardChest, y);
        return [x0 + d * Math.pow(Math.sqrt(Math.max(0, 1 - (z / w) ** 2)), 0.78) + lift, y, z];
      }), tris.flat());
    };
    // 사자 빛깔(10/24 — look.lion): 'black' 기본 = 검은 사자 + 금관 / 'gold' = 망토와 같은 금빛 사자(무광 천) — 흰 바탕에서 묻히지 않게 사자 · 관 둘레에 검은 테두리(3.5 mm),
    //  관은 밝은 금속 금(TRIM)이라 사자 금빛과 결이 다르고, 관의 테두리를 사자 위에 한 겹 더 그려 머리와 관 사이에 검은 줄이 선다.
    //  겹친 넷(사자 테두리 → 사자 → 관 테두리 → 관 — 2.5 · 3 · 3.5 · 4 mm 띄움)은 그리는 차례로 덮는다: 큰 조각의 삼각형은 굽은 겉옷에서 2 mm 쯤 안으로 처져
    //  띄운 높이만으로는 밑의 테두리가 사자 안에 줄로 비친다 → renderOrder 1 ~ 4 차례로 그리고 앞의 셋은 깊이를 쓰지 않는다(depthWrite — 관만 씀) · 겉옷 · 팔 · 칼이 가리는 것은 그대로
    if (look?.lion === 'gold') {
      const o = 0.0035 / S, decal = (m, k) => { m.renderOrder = k; m.material.depthWrite = k === 4; return m; };
      decal(add(layer, lion().map(poly => onTabard(grownPoly(poly, o), 0.0025)), SABLE, cloth), 1).name = 'bernardo-lion-outline';
      decal(add(layer, lion().map(poly => onTabard(poly, 0.003)), palette.lion ?? GOLD, cloth), 2).name = 'bernardo-lion';
      decal(add(layer, [onTabard(grownPoly(lionCrown, o), 0.0035)], SABLE, cloth), 3).name = 'bernardo-lion-crown-outline';
      decal(add(layer, [onTabard(lionCrown, 0.004)], TRIM, gilt), 4).name = 'bernardo-lion-crown';
    } else {
      add(layer, lion().map(poly => onTabard(poly, 0.0025)), SABLE, cloth).name = 'bernardo-lion';
      add(layer, [onTabard(lionCrown, 0.003)], TRIM, gilt).name = 'bernardo-lion-crown';
    }
    cape(g);
  }
  function shoulder(g) {
    const rows = [[-0.04, 0.088, 0.090, 0], [0.045, 0.096, 0.103, 0], [0.117, 0.072, 0.083, 0], [0.148, 0.031, 0.038, 0], [0.155, 0.004, 0.006, 0]];
    const cap = add(g, [shell(rows)], IRON);
    cap.name = 'bernardo-low-pauldron';
    // 견갑 단의 가는 금테 (10/23 23:5x — 검정과 금) · 판의 자식이라 판과 같이 떨어진다
    add(cap, [band(rows, -0.04, -0.034)], TRIM, gilt);
    for (let i = 0; i < 3; i++) {
      const y = 0.003 - i * 0.041, r = 0.091 - i * 0.008, lame = [[y - 0.045, r - 0.009, r - 0.008, 0], [y, r, r, 0]], o = add(g, [shell(lame)], IRON);
      add(o, [band(lame, y - 0.045, y - 0.040)], TRIM, gilt);
    }
    add(g, [shell([[-0.151, 0.047, 0.048, 0], [-0.109, 0.054, 0.056, 0], [-0.075, 0.061, 0.064, 0]])], IRON);
  }
  // ── 배: 쇠띠 셋(옆에서 보임) · 겉옷 앞판 · 뒤판 · 양옆 금테 ──
  function abdomen(g) {
    base(g, [[-0.082, 0.092, 0.127, 0], [0, 0.088, 0.120, 0], [0.080, 0.099, 0.134, 0]]);
    for (let i = 0; i < 3; i++) {
      const top = 0.082 - i * 0.052, lame = [[top - 0.060, 0.109, 0.141, 0], [top, 0.104, 0.137, 0]], o = add(g, [shell(lame, -Math.PI, Math.PI, 20)]);
      add(o, [rim(lame[0], -Math.PI, Math.PI, 0.0019, 20)], EDGE);
    }
    const tab = [[-0.090, 0.126, 0.152, 0, 0.098], [0.000, 0.124, 0.150, 0, 0.098], [0.075, 0.126, 0.154, 0, 0.100]], layer = artoriaCloth(g, 'bernardo-tabard');
    add(layer, [panel(tab, false, 6), panel(tab, true, 6)], TABARD, cloth);
    add(layer, [...panelTrim(tab), ...panelTrim(tab, true)], TRIM, gilt);
  }
  // 사슬: 줄마다 밝기를 번갈아 (고리 줄의 결)
  const mailTint = (j) => (j % 2 ? 0.78 : 1);
  // ── 골반: 사슬 치마 윗단(판금 자리) · 허리띠 · 겉옷 ──
  function pelvis(g) {
    base(g, [[-0.101, 0.100, 0.148, 0], [0.024, 0.100, 0.140, 0], [0.078, 0.093, 0.129, 0]]);
    const ys = [-0.105, -0.078, -0.051, -0.024, 0.003, 0.030, 0.057, 0.085];
    add(g, [shell(ys.map((y, j) => [y, 0.112 - 0.008 * j / 7, 0.160 - 0.020 * j / 7, 0]), -Math.PI, Math.PI, 20, mailTint)], MAIL, mailMat).name = 'bernardo-mail-hips';
    const layer = artoriaCloth(g, 'bernardo-tabard');
    const tab = [[-0.100, 0.116, 0.152, 0, 0.108], [-0.020, 0.122, 0.156, 0, 0.104], [0.090, 0.121, 0.153, 0, 0.100]];
    add(layer, [panel(tab, false, 6), panel(tab, true, 6)], TABARD, cloth);
    add(layer, [...panelTrim(tab), ...panelTrim(tab, true)], TRIM, gilt);
    add(layer, [shell([[0.052, 0.131, 0.159, 0], [0.088, 0.130, 0.157, 0]], -Math.PI, Math.PI, 20)], LEATHER, { ...cloth, roughness: 0.8 });
    add(layer, [box(0.008, 0.040, 0.034, [0.134, 0.070, -0.022]), box(0.006, 0.026, 0.022, [0.138, 0.070, -0.022])], BRASS, metal);
    add(layer, [box(0.005, 0.070, 0.018, [0.134, 0.030, -0.046], [0.12, 0, 0])], LEATHER, cloth);
  }
  // ── 넓적다리: 어두운 사슬 치마(톱니 아랫단 · 놋쇠 고리) · 무릎 덮개 · 무릎 위까지 오는 겉옷 자락 앞뒤 ──
  const SKIRT_HEM = -0.150; // 겉옷 아랫단(넓적다리 좌표 — 무릎 덮개 볼록한 곳 바로 위 · 무릎 관절은 −0.215)
  function thigh(g, look, d) {
    const side = Math.sign(d?.pos?.[2] || 1), N = 20;
    const ys = [-0.078, -0.044, -0.010, 0.024, 0.058, 0.092, 0.126, 0.160, 0.215];
    const rows = ys.map((y, j) => { const k = 1 - j / (ys.length - 1); return [y, 0.084 + 0.009 * k, 0.082 + 0.008 * k, 0]; });
    const geo = shell(rows, -Math.PI, Math.PI, N, mailTint), p = geo.attributes.position, hem = [];
    for (let i = 0; i <= N; i++) {
      if (i % 2) p.setY(i, p.getY(i) + 0.011); // 톱니 아랫단
      hem.push([p.getX(i), p.getY(i), p.getZ(i)]);
    }
    geo.computeVertexNormals();
    const mail = add(g, [geo], MAIL, mailMat);
    mail.name = 'bernardo-mail-skirt';
    add(mail, [curve(hem, 0.0026, 40, 3)], BRASS);
    // 무릎 덮개: 앞 반구 + 바깥 날개 — 사슬 치마의 자식(덮은 곳 상자는 사슬 치마 그대로 · 사슬이 다 부서지면 같이 떨어진다) · 위아래 단에 가는 금테
    const cop = [[-0.240, 0.040, 0.044, 0.012], [-0.215, 0.061, 0.060, 0.014], [-0.180, 0.071, 0.066, 0.012], [-0.140, 0.065, 0.062, 0.006], [-0.108, 0.052, 0.056, 0.002]];
    const kc = add(mail, [shell(cop, -1.35, 1.35, 12), bake(new THREE.SphereGeometry(1, 8, 6), [0.012, -0.172, side * 0.058], [0, side * 0.35, 0], [0.034, 0.030, 0.008])], IRON, { ...metal, steel: 1, roughness: 0.42 });
    kc.name = 'bernardo-knee-cop';
    add(kc, [band(cop, -0.240, -0.2345, 0.0016, -1.35, 1.35, 12), band(cop, -0.1135, -0.108, 0.0016, -1.35, 1.35, 12)], TRIM, gilt);
    add(kc, [curve(cop.map(r => [r[3] + r[1] + 0.003, r[0], 0]), 0.0022, 8, 3)], EDGE);
    // 겉옷 자락 (천 층): 앞판 · 뒤판을 다리마다 반쪽씩 — 안쪽 끝이 몸 가운데 줄에서 만나 선 자세에선 한 장으로 보이고, 걸으면 앞뒤 가운데가 갈라진다.
    //  다리를 감싸는 통이면 반바지로 읽혀(사장님 10/23 ③) 평평하게 늘어뜨린다. 둘레(아랫단 · 가운데 트임 · 바깥 끝)에 금테
    const layer = artoriaCloth(g, 'bernardo-tabard-skirt'), cloths = [], trims = [], ysCloth = [0.215, 0.11, 0.0, -0.075, SKIRT_HEM], du = 0.055;
    for (const back of [false, true]) {
      cloths.push(skirtHalf(side, back, ysCloth, 0));
      trims.push(skirtHalf(side, back, [SKIRT_HEM + 0.009, SKIRT_HEM], 0.0012), skirtHalf(side, back, ysCloth, 0.0012, 0, du, 1), skirtHalf(side, back, ysCloth, 0.0012, 1 - du, 1, 1));
    }
    add(layer, cloths, TABARD, cloth);
    add(layer, trims, TRIM, gilt);
  }
  /** 겉옷 자락 반쪽 (넓적다리 좌표 — 다리 가운데가 z 0, 몸 가운데 줄은 z = −side × 0.095) · u0 → u1 = 안쪽 끝 → 바깥 끝 가운데 몫 */
  function skirtHalf(side, back, ys, lift, u0 = 0, u1 = 1, C = 6) {
    const p = [], ix = [];
    ys.forEach((y, j) => {
      const flare = (0.215 - y) / 0.22, z0 = -0.093 * side, z1 = (0.048 + 0.012 * flare) * side;
      for (let i = 0; i <= C; i++) {
        const u = u0 + (u1 - u0) * i / C;
        p.push((0.097 + 0.006 * flare + 0.010 * Math.sin(Math.PI * 0.9 * u) - 0.022 * u ** 4 + lift) * (back ? -1 : 1), y, z0 + (z1 - z0) * u); // 바깥 끝은 다리 옆으로 감겨 들어감
        if (j < ys.length - 1 && i < C) {
          const k = j * (C + 1) + i;
          ix.push(k, k + C + 1, k + 1, k + 1, k + C + 1, k + C + 2);
        }
      }
    });
    return mesh(p, ix);
  }
  function shin(g) {
    const rows = [[-0.185, 0.047, 0.043, 0], [-0.09, 0.054, 0.048, 0], [0.070, 0.063, 0.055, 0], [0.150, 0.063, 0.055, 0.002], [0.192, 0.057, 0.050, 0.003]];
    const greave = add(g, [shell(rows)]);
    add(greave, [rim(rows[0]), rim(rows.at(-1)), curve([[0.048, -0.182, 0], [0.060, -0.05, 0], [0.066, 0.150, 0], [0.060, 0.190, 0]], 0.002, 10, 3)], EDGE);
  }
  function forearm(g) {
    const rows = [[-0.127, 0.046, 0.046, 0], [-0.065, 0.047, 0.047, 0], [0.070, 0.059, 0.059, 0], [0.134, 0.060, 0.063, 0]];
    const brace = add(g, [shell(rows)]);
    // 팔뚝 보호대 양끝(손목 · 팔꿈치)의 가는 금테 (10/23 23:5x) · 가운데 능선은 쇠빛 그대로
    add(brace, [band(rows, -0.127, -0.120), band(rows, 0.127, 0.134)], TRIM, gilt);
    add(brace, [curve([[0.048, -0.12, 0], [0.051, 0, 0], [0.063, 0.129, 0]], 0.0017, 8, 3)], EDGE);
  }
  function foot(g) {
    const rows = [[-0.034, 0.113, 0.047, 0], [0, 0.127, 0.053, 0], [0.032, 0.090, 0.046, -0.015]];
    base(g, rows.map(([y, d, w, x]) => [y, d - 0.006, w - 0.006, x]));
    const sab = add(g, [shell(rows)]);
    add(sab, [0, 1].map(i => curve([[0.074 + i * 0.022, 0.023, -0.037], [0.079 + i * 0.022, 0.030, 0], [0.074 + i * 0.022, 0.023, 0.037]], 0.0016, 8, 3)), EDGE);
  }
  return {
    armorParts: new Set(['chest', 'abdomen', 'pelvis', 'uarmS', 'uarmO', 'farmS', 'farmO', 'thighF', 'thighB', 'shinF', 'shinB', 'footF', 'footB']),
    head,
    chest,
    abdomen,
    pelvis,
    uarmS: shoulder,
    uarmO: shoulder,
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
