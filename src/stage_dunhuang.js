// ─────────────────────────────────────────────────────────────
//  철불 절벽(dunhuang) — 침식된 절벽 앞 석굴 앞뜰, 초가을 맑은 아침 8 시. +x(판 시작에 상대 뒤): 절벽·석굴 입구 29·6 층 누각·창작 벽화·글씨 없는 나무 간판
//   / −x(반대쪽): 부서진 수레·마른 강바닥·먼 능선 두 겹. 바닥은 다져진 흙, 날리는 모래 알갱이 92
//   출처: 샛별 저장소 origin/main 7684c732(무대 내용은 1890fdf1 까지)의 src/stage_dunhuang.js 를 옮겨 고침 (docs/import/ironcliff_port_2026-10-14.md).
//   모티브는 철불 절벽(사장님 10/14 18:3x) — 특정 굴의 복원이 아니다. 벽화는 코드로 그린 창작 그림이고 불상은 없다. 사진·그림 파일을 읽지 않는다(질감 다섯은 모두 캔버스).
//   코드 id 는 샛별 쪽 그대로 dunhuang, 화면 이름은 '철불 절벽'(사장님 10/14 19:4x — '둔황'은 화면 이름에 넣지 않는다, stages.js STAGE_NAME_KO).
//   그림만: 결투장은 평평한 y 0, 카메라 궤도 10.5 m 안은 바닥뿐(가장 가까운 경관 13.5 m). 충돌체·지형 규칙 없음. 공구는 우리 stage_kit.js(샛별 쪽과 바이트 같음).
//   우리 판에서 고친 것 (확인표 1380~):
//    ① 먼 경관 — 절벽과 거기 붙은 누각·처마는 그림자를 드리우지 않는다(CAST_BINS). 해 반대쪽(+x, 결투장 가운데에서 14.7 m 밖)이라 그 그림자는 결투장 쪽으로
//       오지 않고, 그림자 상자(내 몸 둘레 ±4 m, main.js)에도 거의 들어오지 않는다(결투장 +x 끝에 섰을 때만 누각 아랫단 밑 실 한 줄 — 경기 화면 19 화소).
//       그런데 재질별로 합친 큰 메쉬라 상자에 걸치기만 해도 통째로 그림자 그리기에 올라가 삼각형만 늘렸다(리뷰 5차 §2-6 — 끄면 −68,217 삼각형).
//       인물·칼 그림자는 그대로, 바닥·건물은 그림자를 받는다. 수레(−x, 18 m)는 드리우기를 그대로 둔다(그림자 상자 밖이라 그리기에서 저절로 빠짐)
//    ② 결투장 바닥에 납작한 닳은 띠(보이지 않는 벽 자리 — duelRing, 사장님 10/14 19:4x): 물리 영향 없음 · 그림자를 받지 않음 · 드리우지 않음
//    ③ 샛별 판의 무대 정보 객체(info — 그쪽 화면 이름 '천불의 절벽' 등)는 우리 판이 읽지 않아 뺐다. 짓는 순서·난수는 샛별 판 그대로
//   벽화는 두 인물 머리 뒤 둥근 테까지 그대로다(사장님 결정 10/14 19:4x).
//   (아래 영어 줄 설명은 샛별 저장소 원문 그대로 둔 것이다)
// ─────────────────────────────────────────────────────────────
// A fictional Mogao-inspired forecourt, clear early-autumn 08:00.
// The native duel surface remains y=0. All solid scenery is outside 10.5 m.
// Original, synchronously drawn apsara art; no image loading or network work.
// Source geometries/bins are released after merging. Stages.clear owns every
// final geometry, material and texture through its scene-object traversal.
import * as THREE from 'three';
import { Kit, rng, box, cyl, limb, canvasTex } from './stage_kit.js';
import { ARENA } from './config.js';

// ① 그림자를 드리우는 무대 메쉬 (확인표 1382): 수레 둘만. 샛별 판은 먼 경관 — 절벽·누각·처마(cliff · plaster · interior · timber · tile)도 드리웠다
const CAST_BINS = ['procession', 'procession-cloth'];
// ② 결투장 띠 (사장님 10/14 19:4x '결투장 띠를 넣는다 — 소금 사막 결투장 고리와 같은 결', 확인표 1383): 보이지 않는 벽(ARENA.radius 6.5 m —
//  충돌 벽 가운데 6.75 m · 안쪽 면 6.55 m) 자리에, 사람이 앞뜰 가운데를 둘러 다니며 고운 흙먼지가 쓸려 나가고 다져진 흙이 조금 짙게 드러난 띠.
//  꼴(반지름 · 가운데 폭 · 녹아드는 폭 · 닳음 · 자리 흔들림 · 마디 수)은 소금 사막 띠와 같고, 칠하는 법만 다르다: 이 띠는 빛·그림자를 받지 않는 곱하기 띠라
//  밑의 바닥 색(해가 든 곳이든 인물 그림자 안이든)에 tint 를 alpha 만큼 곱한다 → 그림자를 받지 않아도 인물 그림자가 띠 위에서 끊기지 않는다.
//  (소금 사막은 밝은 소금 먼지 띠라 그림자를 받는 재질로 덧칠했다 — 여기 바닥은 이미 밝은 베이지라 밝은 띠는 안 보인다)
const RING = { radius: ARENA.radius + 0.12, half: 0.3, feather: 0.2, alpha: 0.34, tint: 0xc4ae8c, wear: 0.3, seg: 160 };

const C = { cliff: 0xd7c8ac, pale: 0xe4d4b5, worn: 0xbba78b, shade: 0x8f7a62,
  cave: 0x322e2a, sand: 0xd8c8a8, red: 0x844a3c, bright: 0xa76048,
  timber: 0x624437, tile: 0x73675c, leaf: 0x89876a, stone: 0xb5aa93 };
const CLIFF_X = 18.6;
const CAVE = { x: -7.2, y: .18, width: 6.5, height: 5.75 };
const SIGN = { x: 16.45, y: 5.34, z: -7.2 };

class OwnedKit extends Kit {
  putM(bin, geometry, color, matrix, options = {}) {
    try { return super.putM(bin, geometry, color, matrix, options); }
    finally { geometry.dispose(); }
  }
}

function triangles(points) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  g.computeVertexNormals();
  return g;
}

function earthTexture() {
  const random = rng(141402);
  return canvasTex(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#d1c4a9'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 7000; i++) {
      const x = random() * w, y = random() * h;
      ctx.fillStyle = i % 4 ? 'rgba(112,96,70,.10)' : 'rgba(255,246,220,.29)';
      ctx.fillRect(x, y, .5 + random() * 2.6, .4 + random() * 1.5);
    }
    for (let i = 0; i < 70; i++) {
      const x = random() * w, y = random() * h, radius = 25 + random() * 125;
      const wash = ctx.createRadialGradient(x, y, 0, x, y, radius);
      wash.addColorStop(0, i % 4 ? 'rgba(248,238,208,.12)' : 'rgba(108,95,75,.08)');
      wash.addColorStop(1, 'rgba(220,208,180,0)'); ctx.fillStyle = wash;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    // Short, shallow scuffs on compacted earth; no brick grid or raised floor.
    for (let i = 0; i < 85; i++) {
      const x = random() * w, y = random() * h;
      ctx.strokeStyle = 'rgba(99,87,65,.09)'; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 13, y + 3, x + 20 + random() * 25, y + random() * 9); ctx.stroke();
    }
  });
}

function cliffTexture() {
  const random = rng(141403);
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#ede5d4'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 4300; i++) {
      ctx.fillStyle = i % 3 ? 'rgba(101,85,63,.12)' : 'rgba(255,248,226,.33)';
      ctx.fillRect(random() * w, random() * h, .6 + random() * 3.1, .4 + random() * 2.0);
    }
    for (let i = 0; i < 85; i++) {
      const x = random() * w, y = random() * h;
      ctx.strokeStyle = i % 3 ? 'rgba(94,81,62,.09)' : 'rgba(255,245,214,.23)'; ctx.lineWidth = 1 + random() * 3;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 12, y + 2, x + 25, y - 2, x + 55 + random() * 70, y + 3); ctx.stroke();
    }
  });
}

// Original painted figures, inspired by the flowing scarves and ochre/teal
// palette in the reference. This does not claim to reconstruct a specific cave.
function muralTexture() {
  const random = rng(141405);
  return canvasTex(1024, 768, (ctx, w, h) => {
    ctx.fillStyle = '#9e7860'; ctx.fillRect(0, 0, w, h);
    // Surviving pigment is painted directly onto the cave plaster, without a
    // complete decorative rectangle or a modern picture-frame edge.
    const ribbon = (color, width, points) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(points[0], points[1]);
      for (let i = 2; i < points.length; i += 6) ctx.bezierCurveTo(...points.slice(i, i + 6));
      ctx.stroke();
    };
    const figure = (x, y, scale, rotation) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(scale, scale);
      ribbon('#3d5558', 39, [-55, 55, -128, 163, -282, 205, -405, 132, -245, 257, -117, 240, 65, 105]);
      ribbon('#c3ba93', 9, [-55, 55, -128, 163, -282, 205, -405, 132, -245, 257, -117, 240, 65, 105]);
      ribbon('#698c83', 76, [-55, 101, -112, 192, -232, 132, -366, 251]);
      ribbon('#c5c5a4', 4, [-51, 87, -145, 181, -213, 134, -354, 241]);
      ribbon('#b1baa0', 5, [-43, 122, -135, 219, -218, 148, -370, 262]);
      // Pale exposed shoulders and bent arms, dark hair and a quiet profile.
      ctx.fillStyle = '#d4cbaa'; ctx.strokeStyle = '#685948'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-40, 8); ctx.quadraticCurveTo(-16, -3, 13, 14);
      ctx.lineTo(5, 62); ctx.quadraticCurveTo(-10, 91, -33, 119); ctx.lineTo(-88, 88); ctx.closePath(); ctx.fill(); ctx.stroke();
      ribbon('#d8cdaa', 17, [-31, 17, -79, 1, -117, -38, -103, -53]);
      ribbon('#d5c9a5', 16, [7, 22, 46, 42, 63, 55, 93, 20]);
      ribbon('#b5b495', 4, [-103, -55, -59, -103, 70, -44, 106, 25, 139, 91, 13, 119, -74, 83]);
      ctx.fillStyle = '#333d3b'; ctx.beginPath(); ctx.ellipse(11, -41, 37, 53, .26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8cfaf'; ctx.beginPath(); ctx.ellipse(3, -32, 24, 32, .18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#333d3b'; ctx.beginPath(); ctx.ellipse(12, -65, 23, 17, .1, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5f6553'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, -37); ctx.quadraticCurveTo(-7, -41, -1, -38); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, -28); ctx.lineTo(-11, -22); ctx.lineTo(-3, -21); ctx.stroke();
      ctx.strokeStyle = '#9c8464'; ctx.beginPath(); ctx.moveTo(-6, -13); ctx.lineTo(1, -12); ctx.stroke();
      ctx.strokeStyle = '#c7b988'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(12, -43, 50, -2.7, 1.65); ctx.stroke();
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = '#c3b995'; ctx.beginPath(); ctx.ellipse(-5 + i * 10, -73 - Math.sin(i / 4 * Math.PI) * 10, 3, 7, (i - 2) * .3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    };
    figure(518, 247, 1.07, -.39); figure(805, 497, 1.02, -.28);
    for (let i = 0; i < 24; i++) {
      const x = 100 + random() * 825, y = 85 + random() * 585;
      ctx.fillStyle = '#c6bea0'; ctx.beginPath(); ctx.ellipse(x, y, 2.5, 6, random() * 3, 0, Math.PI * 2); ctx.fill();
    }
    // Eroded plaster interrupts every painted color, with a few larger losses.
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = i % 3 ? 'rgba(204,190,156,.23)' : 'rgba(97,81,65,.12)';
      ctx.fillRect(random() * w, random() * h, 1 + random() * 8, .5 + random() * 3);
    }
    for (let i = 0; i < 84; i++) {
      const x = random() * w, y = random() * h, radius = 5 + random() * 29;
      ctx.fillStyle = i % 4 ? 'rgba(179,164,135,.55)' : 'rgba(145,132,111,.68)'; ctx.beginPath();
      for (let k = 0; k < 9; k++) {
        const a = k / 9 * Math.PI * 2, r = radius * (.6 + random() * .6);
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * .65;
        if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.fill();
    }
    for (let i = 0; i < 11; i++) {
      let x = random() * w, y = random() * h;
      ctx.strokeStyle = 'rgba(91,82,67,.30)'; ctx.lineWidth = .8 + random(); ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (random() - .5) * 35; y += 9 + random() * 23; ctx.lineTo(x, y); } ctx.stroke();
    }
    // Large exposed losses eat into every edge, so the mural belongs to the
    // wall instead of appearing to hang in front of it.
    ctx.fillStyle = '#ac9c80';
    for (const side of [0, 1, 2, 3]) {
      ctx.beginPath();
      const horizontal = side < 2, far = side % 2, length = horizontal ? w : h;
      for (let i = 0; i <= 32; i++) {
        const a = i / 32 * length, inset = 19 + random() * 46 + (Math.sin(i * .8) + 1) * 17;
        const x = horizontal ? a : far ? w - inset : inset;
        const y = horizontal ? far ? h - inset : inset : a;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      if (horizontal) { ctx.lineTo(w, far ? h : 0); ctx.lineTo(0, far ? h : 0); }
      else { ctx.lineTo(far ? w : 0, h); ctx.lineTo(far ? w : 0, 0); }
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(182,167,139,.22)'; ctx.fillRect(0, 0, w, h);
  });
}

function cavePath(x, y, width, height) {
  const p = new THREE.Path(), half = width / 2;
  p.moveTo(x - half, y); p.lineTo(x - half * 1.01, y + height * .43);
  p.lineTo(x - half * .94, y + height * .82);
  p.lineTo(x - half * .77, y + height * .96);
  p.lineTo(x + half * .22, y + height);
  p.lineTo(x + half * .86, y + height * .94);
  p.lineTo(x + half, y + height * .75);
  p.lineTo(x + half * .98, y + height * .29); p.lineTo(x + half, y); p.closePath();
  return p;
}

function erodedCliff(source) {
  const output = [], positions = source.attributes.position;
  const relief = (x, y) => .47 + Math.sin(x * .37 + Math.sin(y * .23) * .37) * .50
    + Math.sin(x * 1.19 + Math.sin(y * .39) * .66) * .32
    + Math.sin(x * 2.73 + y * .44) * .12 + Math.sin(y * 1.43 + x * .13) * .14;
  const project = ([x, y, z]) => [x, y, z + relief(x, y) * Math.max(0, 1 + z / 5.8)];
  const midpoint = (a, b) => a.map((v, i) => (v + b[i]) / 2);
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const split = (a, b, c, depth) => {
    const edges = [distance(a, b), distance(b, c), distance(c, a)], longest = Math.max(...edges);
    if (longest < 2.15 || depth === 10 || a[2] < -5.7 && b[2] < -5.7 && c[2] < -5.7) {
      output.push(...project(a), ...project(b), ...project(c)); return;
    }
    const edge = edges.indexOf(longest);
    if (edge === 0) { const m = midpoint(a, b); split(a, m, c, depth + 1); split(m, b, c, depth + 1); }
    else if (edge === 1) { const m = midpoint(b, c); split(a, b, m, depth + 1); split(a, m, c, depth + 1); }
    else { const m = midpoint(c, a); split(a, b, m, depth + 1); split(m, b, c, depth + 1); }
  };
  for (let i = 0; i < positions.count; i += 3) split(
    [positions.getX(i), positions.getY(i), positions.getZ(i)],
    [positions.getX(i + 1), positions.getY(i + 1), positions.getZ(i + 1)],
    [positions.getX(i + 2), positions.getY(i + 2), positions.getZ(i + 2)], 0);
  source.dispose(); return triangles(output);
}

function cliff(K) {
  const random = rng(141409), shape = new THREE.Shape();
  shape.moveTo(-64, -.12); shape.lineTo(66, -.12); shape.lineTo(66, 20.4);
  for (let i = 58; i >= 0; i--) {
    const x = -64 + i * 2.2;
    shape.lineTo(x, 23.8 + Math.sin(i * .31) * 1.8 + Math.sin(i * 1.71) * .57 + random() * .63);
  }
  shape.lineTo(-64, -.12); shape.closePath();
  const caves = [CAVE, { x: 2.5, y: .18, width: 5.15, height: 5.8 }];
  for (const [x, width, height] of [[-53, 2.5, 3.7], [-44, 3.1, 4.5], [-35, 2.3, 3.7], [-25, 3.6, 4.3], [-16, 2.6, 3.8], [13, 3.1, 4.8], [22, 2.3, 3.6], [33, 3.7, 4.5], [44, 2.5, 3.4], [55, 2.2, 4.2]]) caves.push({ x, y: .15, width, height });
  for (const [x, y, width, height] of [[-48, 9, 2.2, 2.8], [-37, 8.3, 2.7, 3.9], [-26, 10.7, 2.2, 3.1], [-16, 8.2, 1.6, 2.8], [-7.7, 9.1, 1.8, 2.6], [2.5, 8.1, 2.5, 3.8], [15, 10.3, 2.3, 3.2], [28, 8.4, 1.8, 3.3], [42, 10.2, 2.5, 3.1], [53, 8.5, 2, 2.7], [-43, 17.2, 1.7, 2.2], [-32, 16, 2, 2.8], [-20, 17.4, 1.6, 2.3], [2.5, 15.3, 2.2, 3], [17, 16.7, 1.5, 2.5], [35, 17.1, 1.9, 2.7], [50, 16.3, 1.6, 2.5]]) caves.push({ x, y, width, height });
  for (const hole of caves) shape.holes.push(cavePath(hole.x, hole.y, hole.width, hole.height));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 5.8, steps: 1, curveSegments: 5, bevelEnabled: false });
  geometry.translate(0, 0, -5.8);
  K.push([CLIFF_X, 0, 0], -Math.PI / 2);
  const rock = K.put('cliff', erodedCliff(geometry), C.cliff, undefined, undefined, 1, { uv: 'box', uvScale: .24, noise: .015 });
  const rp = rock.attributes.position, rc = rock.attributes.color;
  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i);
    const strata = Math.sin(y * 1.24 + Math.sin(z * .12) * .75) * .045;
    const clay = Math.sin(z * .27 + y * .18) * .045;
    const depthShade = 1 - THREE.MathUtils.smoothstep(x - CLIFF_X, .35, 5.5) * .48;
    rc.setXYZ(i, rc.getX(i) * (1 + strata + clay) * depthShade,
      rc.getY(i) * (1 + strata + clay * .5) * depthShade, rc.getZ(i) * (1 + strata - clay * .4) * depthShade);
  }
  for (const hole of caves) {
    K.put('cave', box(hole.width + .1, hole.height + .1, .06), C.cave, [hole.x, hole.y + hole.height / 2, -5.81]);
    K.put('shade', box(hole.width - .07, .018, 5.6), C.shade, [hole.x, hole.y + .011, -2.8]);
  }
  K.pop(); return caves.length;
}

function roof(K, x, y, width, depth = 3.2, front = 2.1) {
  const upper = [], lower = [], edge = [], across = 24, rows = 6, thickness = .18;
  const point = (i, j, underside = false) => {
    const u = i / across * 2 - 1, v = j / rows;
    return [x + u * width / 2 * (1 - v * .065),
      y + Math.pow(Math.abs(u), 5) * .58 + v * .68 + v * v * .46 - (underside ? thickness : 0), front - v * depth];
  };
  const quad = (list, a, b, c, d) => list.push(...a, ...b, ...c, ...b, ...d, ...c);
  for (let i = 0; i < across; i++) for (let j = 0; j < rows; j++) {
    quad(upper, point(i, j), point(i + 1, j), point(i, j + 1), point(i + 1, j + 1));
    quad(lower, point(i, j, true), point(i, j + 1, true), point(i + 1, j, true), point(i + 1, j + 1, true));
  }
  for (let i = 0; i < across; i++) for (const j of [0, rows]) {
    quad(edge, point(i, j), point(i, j, true), point(i + 1, j), point(i + 1, j, true));
  }
  for (let j = 0; j < rows; j++) for (const i of [0, across]) {
    quad(edge, point(i, j), point(i, j + 1), point(i, j, true), point(i, j + 1, true));
  }
  K.put('tile', triangles(upper), C.tile, undefined, undefined, 1, { noise: .055, vary: .05 });
  K.put('timber', triangles(lower), 0x49382e, undefined, undefined, 1, { noise: .02 });
  K.put('tile', triangles(edge), 0x625343, undefined, undefined, 1, { noise: .025 });
  for (let i = 0; i <= across; i++) {
    // Tile rolls and rafters run back into the cliff, exposing real eave depth.
    for (let j = 0; j < rows; j++) {
      const a = point(i, j), b = point(i, j + 1);
      limb(K, 'tile', [a[0], a[1] + .035, a[2]], [b[0], b[1] + .035, b[2]], .033, .033, i % 3 ? 0x978876 : 0xb09e84, {}, 5);
      if (j < 3) limb(K, 'timber', [a[0], a[1] - .23, a[2]], [b[0], b[1] - .23, b[2]], .055, .055, C.bright, { noise: .02 }, 4);
    }
    const a = point(i, 0);
    K.put('timber', box(.105, .12, .22), C.bright, [a[0], a[1] - .23, a[2] - .025]);
    if (i < across) {
      const b = point(i + 1, 0);
      limb(K, 'timber', [a[0], a[1] - .11, a[2]], [b[0], b[1] - .11, b[2]], .07, .07, C.red, {}, 5);
    }
  }
  for (const side of [-1, 1]) limb(K, 'tile', [x + side * width / 2, y + .56, front], [x + side * (width / 2 + .18), y + .97, front + .16], .09, .025, C.tile, {}, 5);
}

function pavilion(K) {
  K.push([CLIFF_X, 0, 0], -Math.PI / 2);
  const towerX = 2.5;
  // Six fictional levels inspired by Mogao: substantial stepped plaster rooms
  // carry deep timber galleries. Local +z faces the forecourt; the rear wall is
  // beyond the cliff's maximum 1.55 m relief, so rock cannot fill these rooms.
  const tiers = [[0, 5.75, 12.4], [6.6, 9.65, 10.6], [10.5, 13.65, 9.2], [14.5, 17.2, 7.8], [18.05, 20.55, 6.4], [21.35, 23.55, 5.2]];
  for (let level = 0; level < tiers.length; level++) {
    const [floor, top, width] = tiers[level], half = width * .39;
    const front = 3.92 - level * .13, wallFront = 2.68 - level * .07;
    const roofFront = front + .94, postX = half - .23, height = top - floor;
    const doorWidth = Math.min(1.65, width * .20), doorHeight = Math.min(3.8, height - .38);
    const sill = floor + (level ? .16 : .23), archSpring = sill + doorHeight - doorWidth / 2;
    const wall = new THREE.Shape();
    wall.moveTo(-half, floor); wall.lineTo(half, floor); wall.lineTo(half, top + .14); wall.lineTo(-half, top + .14); wall.closePath();
    const opening = new THREE.Path();
    opening.moveTo(-doorWidth / 2, sill); opening.lineTo(-doorWidth / 2, archSpring);
    opening.absarc(0, archSpring, doorWidth / 2, Math.PI, 0, true);
    opening.lineTo(doorWidth / 2, sill); opening.closePath(); wall.holes.push(opening);
    const wallGeometry = new THREE.ExtrudeGeometry(wall, { depth: .40, bevelEnabled: false, curveSegments: 6, steps: 1 });
    K.put('plaster', wallGeometry, level % 2 ? 0xb4a184 : 0xc2af90, [towerX, 0, wallFront - .40], undefined, 1, { noise: .025, uv: 'box', uvScale: .24 });
    // Backing, sill and side returns form a recessed doorway, not a black decal.
    K.put('interior', box(doorWidth + .12, doorHeight + .08, .12), 0x342c25, [towerX, sill + doorHeight / 2, 1.72]);
    K.put('timber', box(doorWidth + .2, .11, wallFront - 1.72), 0x564333, [towerX, sill, (wallFront + 1.72) / 2]);
    for (const side of [-1, 1]) {
      K.put('interior', box(.13, doorHeight, wallFront - 1.72), 0x716047,
        [towerX + side * (doorWidth / 2 + .015), sill + doorHeight / 2, (wallFront + 1.72) / 2]);
      // Thick pale cheeks return to the cliff, visible in an oblique view.
      K.put('plaster', box(.53, height + .30, wallFront + 1.0), C.pale,
        [towerX + side * half, floor + (height + .30) / 2, (wallFront - 1.0) / 2], undefined, 1, { noise: .025, uv: 'box', uvScale: .24 });
      K.put('timber', box(.19, .26, front - 1.8), C.red, [towerX + side * postX, top - .19, (front + 1.8) / 2]);
    }
    // Continuous, weight-bearing floor plates and a shaded ceiling volume.
    const floorFront = front + .18;
    K.put(level ? 'timber' : 'plaster', box(width * .82, level ? .34 : .28, floorFront + .6), level ? C.timber : C.worn,
      [towerX, floor + (level ? -.07 : .14), (floorFront - .6) / 2]);
    K.put('interior', box(width * .77, .19, front - 1.55), 0x47382c, [towerX, top - .10, (front + 1.55) / 2]);
    const posts = level > 3 ? [-postX, 0, postX] : [-postX, -postX / 3, postX / 3, postX];
    for (const dx of posts) {
      K.put('timber', cyl(.12, .145, height - .17, 8), C.red, [towerX + dx, floor + (height + .17) / 2, front]);
      K.put('plaster', box(.43, .20, .43), C.worn, [towerX + dx, floor + .12, front]);
      for (let step = 0; step < 3; step++) {
        const y = top - .74 + step * .22;
        K.put('timber', box(.42 + step * .31, .14, .34 + step * .29), step === 2 ? C.bright : C.red, [towerX + dx, y, front + step * .065]);
        for (const side of [-1, 1]) K.put('timber', box(.13, .17, .34), C.bright,
          [towerX + dx + side * (.17 + step * .15), y + .095, front + .03]);
      }
      limb(K, 'timber', [towerX + dx, top - .87, front - .02], [towerX + dx, top - .10, front + .67], .072, .066, C.red, {}, 5);
    }
    K.put('timber', box(width * .80, .24, .30), C.red, [towerX, top - .19, front + .20]);
    K.put('timber', box(width * .77, .17, .22), C.timber, [towerX, top - .62, front]);
    if (level) {
      const railZ = front + .10, railHalf = postX;
      for (const y of [floor + .28, floor + .94]) {
        K.put('timber', box(railHalf * 2, .11, .12), C.bright, [towerX, y, railZ]);
        for (const side of [-1, 1]) K.put('timber', box(.12, .11, railZ - wallFront), C.red,
          [towerX + side * railHalf, y, (railZ + wallFront) / 2]);
      }
      const count = Math.ceil(railHalf * 2 / .36);
      for (let j = 0; j <= count; j++) K.put('timber', box(.062, .65, .07), C.red,
        [towerX - railHalf + j / count * railHalf * 2, floor + .61, railZ]);
      for (const side of [-1, 1]) for (let j = 1; j < 4; j++) K.put('timber', box(.07, .65, .062), C.red,
        [towerX + side * railHalf, floor + .61, wallFront + (railZ - wallFront) * j / 4]);
    }
    roof(K, towerX, top, width, roofFront + .62, roofFront);
  }
  // A lower independent eave frames the nearby painted recess, clear of the
  // tower and at a human scale. Bare plaster surrounds the preserved fragment.
  roof(K, CAVE.x, 6.06, 8.25, 3.0);
  for (const dx of [-3.62, 3.62]) {
    K.put('timber', cyl(.10, .13, 5.95, 7), C.red, [CAVE.x + dx, 2.975, 1.15]);
    K.put('cliff', box(.48, .25, .48), C.worn, [CAVE.x + dx, .125, 1.15]);
    limb(K, 'timber', [CAVE.x + dx, 4.96, 1.15], [CAVE.x + dx, 5.92, 1.87], .075, .075, C.bright, {}, 6);
  }
  K.put('timber', box(7.45, .24, .23), C.red, [CAVE.x, 5.94, 1.15]);
  for (const x of [-25, 13, 33]) roof(K, x, x === 13 ? 5.0 : 4.65, x === 33 ? 5.6 : 4.8, 2.3);
  K.pop();
}

function mural(scene) {
  const map = muralTexture(); map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  // The plaster spans the recess behind its natural rock edges. Its rectangular
  // primitive ends inside the surrounding rock, so no floating panel is seen.
  const backing = new THREE.Mesh(new THREE.PlaneGeometry(8.3, 6.8), new THREE.MeshStandardMaterial({ map, roughness: 1, emissive: 0xb4a185, emissiveIntensity: .09 }));
  backing.name = 'dunhuang-apsara-mural'; backing.rotation.y = -Math.PI / 2;
  backing.position.set(CLIFF_X + 2.2, 3.0, CAVE.x); scene.add(backing);
  return backing;
}

function landscape(K, scene) {
  const random = rng(141414);
  K.put('ground', new THREE.PlaneGeometry(760, 760), 0xf2ead9, [0, 0, 0], [-Math.PI / 2, 0, 0], 1, { uv: 'box', uvScale: .115, noise: .008 });
  // The opposite side is an exposed dry riverbed, with no water or oasis.
  const p = [], banks = [], gravel = [];
  const riverCenter = z => -41 + Math.sin(z * .022) * 4 + Math.sin(z * .09) * 1.2;
  const riverWidth = z => 5.0 + Math.sin(z * .061 + .4) * .8 + Math.sin(z * .143) * .32;
  for (let i = 0; i < 72; i++) {
    const z0 = -170 + i * 4.7, z1 = z0 + 4.7;
    const a = [riverCenter(z0) - riverWidth(z0), .005, z0], b = [riverCenter(z0) + riverWidth(z0), .005, z0];
    const c = [riverCenter(z1) - riverWidth(z1), .005, z1], d = [riverCenter(z1) + riverWidth(z1), .005, z1];
    p.push(...a, ...c, ...b, ...b, ...c, ...d);
    for (const side of [-1,1]) {
      const bankPoint = (z, edge) => [riverCenter(z) + side * (riverWidth(z) + edge * 1.9),
        edge === 1 ? .28 + Math.sin(z * .11 + side) * .10 : .007, z];
      for (let edge = 0; edge < 2; edge++) {
        const a = bankPoint(z0,edge), b = bankPoint(z1,edge), c = bankPoint(z0,edge+1), d = bankPoint(z1,edge+1);
        if (side > 0) banks.push(...a,...b,...c,...c,...b,...d);
        else banks.push(...a,...c,...b,...c,...d,...b);
      }
    }
    // Intermittent pale bars and darker pebble beds, not running water.
    if (i % 7 !== 1 && i % 7 !== 2) {
      const offset = Math.sin(z0 * .073) * 2.4, w = 1.0 + Math.sin(z0 * .19) * .45;
      gravel.push(riverCenter(z0)+offset-w,.009,z0,riverCenter(z1)+offset-w*.7,.009,z1,riverCenter(z0)+offset+w,.009,z0,
        riverCenter(z0)+offset+w,.009,z0,riverCenter(z1)+offset-w*.7,.009,z1,riverCenter(z1)+offset+w*.7,.009,z1);
    }
  }
  K.put('riverbed', triangles(p), 0xc6bda5, undefined, undefined, 1, { noise: .025, uv: 'box', uvScale: .115 });
  K.put('riverbed', triangles(banks), 0xcfc1a1, undefined, undefined, 1, { noise: .025, uv: 'box', uvScale: .115 });
  K.put('riverbed', triangles(gravel), 0xb1a994, undefined, undefined, 1, { noise: .045, uv: 'box', uvScale: .16 });
  for (let i = 0; i < 170; i++) {
    const z = (random() - .5) * 180, x = -41 + Math.sin(z * .022) * 4 + (random() - .5) * 10;
    K.put('stone', new THREE.DodecahedronGeometry(.06 + random() * .20, 0), i % 3 ? C.stone : C.worn, [x, .045, z], [random(), random(), random()], [1.6, .45, .9], { noise: .06 });
  }
  for (let i = 0; i < 42; i++) {
    const z = (random() - .5) * 165, x = -30 - random() * 38, size = .45 + random() * .9;
    for (let b = 0; b < 5; b++) {
      const a = random() * Math.PI * 2, end = [x + Math.cos(a) * size * .55, size * (.35 + random() * .7), z + Math.sin(a) * size * .55];
      limb(K, 'shrub', [x, .025, z], end, .02 * size, .006, 0x817457, {}, 5);
      K.put('shrub', new THREE.IcosahedronGeometry(size * .23, 0), C.leaf, end, undefined, [1.5, .52, .7], { noise: .04, vary: .22 });
    }
  }
  // Sanwei-inspired dry ridges across the Daquan valley. These are game-local
  // coordinates, not surveyed compass bearings or a geographic reconstruction.
  // Each band has foothills, a broken crest and a rear slope rather than a flat
  // silhouette; low saddles leave space between the more prominent summits.
  const ridgeRandom = rng(141427), sections = 48, slope = [0,.19,.70,1,.41,0];
  for (let band = 0; band < 3; band++) {
    const points = [], heights = [], shifts = [], front = [-55,-113,-186][band], depth = [68,84,101][band];
    for (let i = 0; i <= sections; i++) {
      heights.push(4 + Math.pow(ridgeRandom(),.78) * (band ? 32 + band * 3 : 24));
      shifts.push((ridgeRandom()-.5)*9);
    }
    // Unequal wide valleys interrupt both silhouette and slope, independently
    // in each band so distant shoulders remain visible through the near gaps.
    for (const [center,width] of [[7+band*2,2],[19-band,3],[32+band,2],[43-band*2,2]])
      for (let i = Math.max(0,center-width); i <= Math.min(sections,center+width); i++)
        heights[i] *= .16 + Math.abs(i-center)/(width+1)*.72;
    const ridgePoint = (row,i) => {
      const t = row/(slope.length-1), z = -263+i*11.5;
      const crag = row === 0 || row === slope.length-1 ? 0 : Math.sin(i*2.31+row*1.19+band)*1.4;
      return [front-depth*t+shifts[i]*(.35+Math.sin(t*Math.PI)*.65),
        .014+Math.max(0,heights[i]*slope[row]+crag), z + shifts[i]*Math.sin(t*Math.PI)*.8];
    };
    for (let row = 0; row < slope.length-1; row++) for (let i = 0; i < sections; i++) {
      const a = ridgePoint(row,i), b = ridgePoint(row,i+1), c = ridgePoint(row+1,i), d = ridgePoint(row+1,i+1);
      if ((i+row)%2) points.push(...a,...c,...b,...b,...c,...d);
      else points.push(...a,...c,...d,...a,...d,...b);
    }
    const rock = K.put('hills',triangles(points),[0x9e9582,0xaaa79a,0xb8bcb3][band],undefined,undefined,1,{noise:.008,vary:.015});
    const normals=rock.attributes.normal,colors=rock.attributes.color;
    for(let i=0;i<colors.count;i++) {
      const shade=.82+.20*Math.abs(normals.getY(i))-.14*normals.getX(i)-.09*normals.getZ(i);
      colors.setXYZ(i,colors.getX(i)*shade,colors.getY(i)*shade,colors.getZ(i)*shade);
    }
    // Remove only the nearest ridge after generation, preserving all seed
    // consumption and the exact geometry/colors of the two distant bands.
    if (band === 0) K.bins.hills.pop().dispose();
  }
  const skyMap = canvasTex(512, 256, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#668fab'); gradient.addColorStop(.27, '#8db0c8');
    gradient.addColorStop(.47, '#c7d7d8'); gradient.addColorStop(.54, '#dcd8c6'); gradient.addColorStop(1, '#d5c7a9');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  });
  skyMap.wrapS = skyMap.wrapT = THREE.ClampToEdgeWrapping;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(470, 24, 12), new THREE.MeshBasicMaterial({ map: skyMap, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.name = 'dunhuang-morning-sky'; sky.renderOrder = -10; scene.add(sky);
}

// A fictional interrupted procession, not an archaeological reconstruction.
// All raised scenery stays beyond the 13 m duel buffer; tracks are visual only.
function abandonedProcession(K, night = false) {
  const origin = [-16.2, 0, 8.8], heading = 1.27;
  // Opposite the +X cliff, with its sand and ruts anchored to this same origin.
  const wood = 0x766049, edge = 0x9b8160, dark = 0x423b31;
  K.push(origin, heading);
  K.frame.multiply(new THREE.Matrix4().makeRotationZ(.14));
  K.frame.multiply(new THREE.Matrix4().makeRotationX(-.06));
  // The low deck and partly buried wheels give the load weight and a clear
  // three-dimensional silhouette, with the front shaft pointing at a cave.
  for (const x of [-1.18, 1.18]) K.put('procession', box(.22, .28, 4.6), dark, [x, .88, 0]);
  for (let i = 0; i < 9; i++) K.put('procession', box(2.72, .17, .45), i % 3 ? wood : edge, [0, 1.03, -1.96 + i * .49], [0, (i % 3 - 1) * .006, 0]);
  const wheel = (x, y, z, damaged = false) => {
    const arc = damaged ? Math.PI * 1.48 : Math.PI * 2;
    const outer = new THREE.TorusGeometry(.94, .105, 5, 18, arc);
    const inner = new THREE.TorusGeometry(.82, .075, 4, 18, arc);
    if (damaged) { outer.rotateZ(2.5); inner.rotateZ(2.5); }
    K.put('procession', outer, dark, [x, y, z], [0, Math.PI / 2, damaged ? -.16 : 0]);
    K.put('procession', inner, edge, [x, y, z], [0, Math.PI / 2, damaged ? -.16 : 0]);
    K.put('procession', cyl(.17, .19, .38, 8), wood, [x, y, z], [0, 0, Math.PI / 2]);
    for (let j = 0; j < 10; j++) {
      if (damaged && (j === 2 || j === 3)) continue;
      const a = j / 10 * Math.PI * 2, radius = damaged && j === 4 ? .42 : .85;
      limb(K, 'procession', [x, y, z], [x, y + Math.sin(a) * radius, z + Math.cos(a) * radius], .055, .042, edge, {}, 4);
    }
  };
  for (const z of [-1.35, 1.35]) {
    limb(K, 'procession', [-1.57, .68, z], [1.57, .68, z], .095, .095, dark, {}, 6);
    wheel(-1.54, z < 0 ? .55 : .68, z, z < 0); wheel(1.54, .68, z);
  }
  // Rails wrap around the bed; the broken front leaves the crates visible.
  for (const x of [-1.35, 1.35]) {
    for (const z of [-2.16, -.72, .72, 2.16]) K.put('procession', box(.12, 1.16, .12), dark, [x, 1.56, z]);
    for (const y of [1.27, 1.63, 1.99]) K.put('procession', box(.12, .19, 4.45), wood, [x, y, 0]);
  }
  for (const y of [1.26, 1.63, 1.99]) K.put('procession', box(2.82, .19, .12), wood, [0, y, -2.2]);
  limb(K, 'procession', [-.89, .91, 1.7], [-.82, .34, 4.23], .09, .065, dark, {}, 5);
  limb(K, 'procession', [.89, .91, 1.7], [.94, .51, 3.12], .09, .055, dark, {}, 5);
  limb(K, 'procession', [1.24, .12, 3.26], [1.57, .05, 4.15], .075, .035, wood, {}, 5);
  // A pair of large packing cases, with diagonal braces and a slumped lid.
  if (!night) {
  for (const [x, y, z, w, h, d] of [[-.52,1.68,-.84,1.22,1.14,1.62],[.52,1.60,.87,1.15,.98,1.44]]) {
    K.put('procession', box(w, .12, d), dark, [x,y-h/2,z]);
    for (const side of [-1,1]) {
      K.put('procession', box(.10,h,d), 0x897457, [x+side*w/2,y,z], undefined, 1, { noise: .045 });
      K.put('procession', box(w,h,.10), 0x897457, [x,y,z+side*d/2], undefined, 1, { noise: .045 });
    }
    for (const dx of [-w * .43,w * .43]) for (const dz of [-d * .51,d * .51]) K.put('procession', box(.10,h + .10,.09), dark, [x+dx,y,z+dz]);
    for (const dy of [-h*.42,h*.42]) K.put('procession', box(w+.09,.10,d+.08), edge, [x,y+dy,z]);
    for (const side of [-1,1]) limb(K,'procession',[x-w*.44,y-h*.39,z+side*(d*.5+.055)],[x+w*.44,y+h*.39,z+side*(d*.5+.055)],.045,.045,dark,{},4);
  }
  K.put('procession', box(1.28,.10,1.68), edge, [-.67,1.89,-1.53], [1.06,.12,-.10]);
  K.put('procession', box(1.25,.11,1.55), edge, [.52,2.15,.87]);
  // An exposed clay head and shoulder inside the open case link the cargo to
  // the fictional guardian without scattering unrelated relics across the arena.
  K.put('procession', new THREE.SphereGeometry(.25,8,6), 0xa88969, [-.52,2.35,-.80], [0,.28,0], [.83,1.15,.88]);
  K.put('procession', box(.58,.34,.36), 0x94785b, [-.52,2.06,-.80]);
  K.put('procession', cyl(.09,.12,.16,7), dark, [-.52,2.65,-.81]);
  K.put('procession', box(.09,.12,.11), 0x9d7f60, [-.48,2.35,-.57]);
  }
  // Sagging, torn ochre canvas hangs over an asymmetric timber frame. Its
  // subdivided folds are real geometry, visible from the side and underneath.
  for (const [x,z,y] of [[-1.28,-1.85,3.77],[1.28,-1.85,3.61],[-1.28,1.65,3.56],[1.28,1.65,3.21]])
    limb(K,'procession',[x,1.03,z],[x,y,z],.055,.04,dark,{},5);
  limb(K,'procession',[-1.28,3.77,-1.85],[-1.28,3.56,1.65],.05,.04,wood,{},5);
  limb(K,'procession',[1.28,3.61,-1.85],[1.28,3.21,1.65],.05,.04,wood,{},5);
  const canvas = [], nx = 10, nz = 12;
  const clothPoint = (i,j) => {
    const u=i/nx,v=j/nz;
    const sag = Math.pow(v,3) * Math.max(0,1-u*1.5) * .93;
    return [(u-.5)*3.04,3.68-v*.37-Math.sin(u*Math.PI)*.28+Math.sin(v*7+u*2)*.09-sag,-1.99+v*3.98];
  };
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
    if (night && i > 2) continue; // The cover has been pulled off the empty load.
    if ((j > 6 && i === 3) || (j > 9 && i > 1 && i < 5) || (j > 8 && i > 7)) continue;
    const a=clothPoint(i,j),b=clothPoint(i+1,j),c=clothPoint(i,j+1),d=clothPoint(i+1,j+1);
    canvas.push(...a,...c,...b,...b,...c,...d);
  }
  K.put('procession-cloth',triangles(canvas),0xa98c60,undefined,undefined,1,{noise:.035,vary:.025});
  // One tall faded pennant makes the interrupted procession readable at range.
  limb(K,'procession',[-1.15,.15,-2.35],[-1.48,4.72,-2.1],.065,.03,dark,{},6);
  K.put('procession-cloth',triangles([-1.48,4.61,-2.1,-1.43,3.70,-2.12,-.28,3.80,-1.82,
    -1.48,4.61,-2.1,-.28,3.80,-1.82,-.07,4.37,-1.78]),0x8c604c,undefined,undefined,1,{noise:.035});
  K.pop();
  // A small windward dune partly swallows the undercarriage, then dwindles
  // into two interrupted wheel ruts. No collision or arena-height change.
  const dune=[],rings=5,segments=32;
  const dunePoint=(r,i)=>{
    const a=i/segments*Math.PI*2,t=r/rings;
    return [origin[0]+Math.cos(a)*3.55*t,.012+Math.pow(1-t,1.7)*.64,origin[2]+Math.sin(a)*2.55*t];
  };
  for(let r=0;r<rings;r++)for(let i=0;i<segments;i++){
    const a=dunePoint(r,i),b=dunePoint(r,i+1),c=dunePoint(r+1,i),d=dunePoint(r+1,i+1);
    dune.push(...a,...b,...c,...b,...d,...c);
  }
  K.put('procession-sand',triangles(dune),0xd0bd99,undefined,undefined,1,{uv:'box',uvScale:.115,noise:.025});
  for (const side of [-1,1]) {
    const rut = [], count = 96;
    const point = (i, edge) => {
      const t = i / count, z = origin[2] + 2.1 + t * 21;
      const x = origin[0] + .1 + side * 1.27 - Math.sin(t * 2.0) * 1.2 + Math.sin(t * 16 + side) * .065;
      const width = .075 + Math.sin(t * 27 + side) * .018;
      return [x + edge * width, .018, z];
    };
    for (let i = 0; i < count; i++) {
      // Broad, uneven drifts conceal unequal lengths along each rut.
      const t = i / count, cover = Math.sin(t * 19 + side * 1.7) + Math.sin(t * 31 - side * .8) * .44;
      if (cover > .78) continue;
      const a = point(i,-1), b = point(i,1), c = point(i+1,-1), d = point(i+1,1);
      rut.push(...a,...c,...b,...b,...c,...d);
    }
    K.put('procession-sand',triangles(rut),0xc4b393,undefined,undefined,1,{noise:.018,uv:'box',uvScale:.115});
  }
  return { center: origin, heading, story: 'Fictional interrupted transport procession', clearRadius: 13, cartHeight: 4.75 };
}

function blowingSand(scene) {
  const random = rng(141416), count = 92, p = new Float32Array(count * 3), initial = [];
  for (let i = 0; i < count; i++) initial.push({ x: -29 + random() * 42, z: -28 + random() * 56, y: .035 + random() * .11, speed: .28 + random() * .43, phase: random() * Math.PI * 2 });
  const map = canvasTex(32, 32, (ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, 'rgba(237,224,191,.65)'); gradient.addColorStop(.25, 'rgba(237,224,191,.36)'); gradient.addColorStop(1, 'rgba(237,224,191,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  });
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(p, 3).setUsage(THREE.DynamicDrawUsage));
  const mesh = new THREE.Points(geometry, new THREE.PointsMaterial({ map, size: .105, transparent: true, opacity: .31, depthWrite: false, color: 0xd8c7a2 }));
  mesh.name = 'dunhuang-ground-sand'; mesh.frustumCulled = false; scene.add(mesh);
  const update = (time, gust) => {
    for (let i = 0; i < count; i++) {
      const q = initial[i];
      p[i * 3] = q.x + Math.sin(time * .19 + q.phase) * .14;
      p[i * 3 + 1] = q.y + Math.sin(time * .71 + q.phase) * .017;
      p[i * 3 + 2] = ((q.z + 28 + time * q.speed) % 56) - 28;
    }
    mesh.material.opacity = .28 + Math.sin(time * .19) * .025 + gust * .025;
    geometry.attributes.position.needsUpdate = true;
  };
  update(0, 0); return { update, count, maxHeight: .162 };
}

// ② 결투장 띠 (확인표 1383): 반지름 RING.radius 둘레의 닳은 띠 — 꼴은 소금 사막 띠(stage_dayr.js duelRing)와 같다. 가운데가 가장 짙고(RING.alpha)
//  양쪽으로 RING.feather 만큼 바닥에 녹아든다. 둘레를 따라 닳은 정도(RING.wear)와 자리(±7 cm)를 몇 겹 사인으로 달리해 칠한 선이 아니라 밟혀 닳은 길로
//  읽히게 한다(난수 없음 — 판마다 같고, 뒤 무늬·소품의 난수 순서도 샛별 판 그대로).
//  칠하기: 빛을 안 받는 재질(MeshBasic) + 곱하기 섞기 — 화면의 바닥 색 × mix(1, tint, 알파). 그림자를 받지도 드리우지도 않고, 충돌체 없음(그림만)
function duelRing(scene) {
  const n = RING.seg, c = new THREE.Color(RING.tint), pos = [], col = [], idx = [];
  const steps = [[-RING.half - RING.feather, 0], [-RING.half, 0.7], [0, 1], [RING.half, 0.7], [RING.half + RING.feather, 0]];
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2;
    const r0 = RING.radius + 0.045 * Math.sin(2 * a + 0.7) + 0.025 * Math.sin(7 * a + 2.1);
    const wear = 1 - RING.wear * (0.5 + 0.5 * Math.sin(3 * a + 1.3) * Math.sin(5 * a + 0.4));
    for (const [d, k] of steps) {
      pos.push(Math.cos(a) * (r0 + d), 0.003, Math.sin(a) * (r0 + d));
      col.push(c.r, c.g, c.b, RING.alpha * k * wear);
    }
    if (i < n) {
      const s = i * steps.length;
      for (let j = 0; j < steps.length - 1; j++) idx.push(s + j, s + j + steps.length, s + j + 1, s + j + 1, s + j + steps.length, s + j + steps.length + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  // 곱하기 섞기는 three 에서 premultipliedAlpha 가 있어야 한다: 결과 = 바닥 × (tint × 알파 + 1 − 알파)
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, premultipliedAlpha: true, blending: THREE.MultiplyBlending, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'dunhuang-duel-ring'; mesh.castShadow = false; mesh.receiveShadow = false; scene.add(mesh);
}

export function buildDunhuang(scene, { hemi, sun } = {}, { night = false } = {}) {
  const before = new Set(scene.children), sunOffset = { x: -12, y: 8, z: -9 };
  scene.background = new THREE.Color(0xc7d7d8); scene.fog = new THREE.Fog(0xcbd2c9, 95, 330);
  if (hemi) { hemi.color.setHex(0xc3dcec); hemi.groundColor.setHex(0xc2b18e); hemi.intensity = 1.55; }
  if (sun) { sun.color.setHex(0xffedcd); sun.intensity = 2.25; sun.position.set(sunOffset.x, sunOffset.y, sunOffset.z); }
  const K = new OwnedKit(141400);
  landscape(K, scene); cliff(K); pavilion(K); mural(scene);
  abandonedProcession(K, night);
  duelRing(scene); // ② 결투장 띠 (난수를 안 쓴다)
  const earthMap = earthTexture(), rockMap = cliffTexture();
  const standard = (extra = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, ...extra });
  const materials = {
    ground: standard({ map: earthMap }), riverbed: standard({ map: earthMap }),
    procession: standard(), 'procession-cloth': standard({ side: THREE.DoubleSide }), 'procession-sand': standard({ map: earthMap }),
    cliff: standard({ map: rockMap }), plaster: standard({ map: rockMap }), interior: standard(),
    cave: standard(), shade: standard(), timber: standard(),
    tile: standard({ side: THREE.DoubleSide }), stone: standard(), shrub: standard(),
    hills: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  };
  for (const [bin, material] of Object.entries(materials)) {
    // ① 우리 판: 먼 경관(절벽·누각·처마)은 드리우지 않고 수레(CAST_BINS)만 드리운다. 받기는 샛별 판 그대로 모두
    const mesh = K.mesh(bin, material, { cast: CAST_BINS.includes(bin), receive: true });
    if (mesh) { mesh.name = `dunhuang-${bin}`; scene.add(mesh); } else material.dispose();
    for (const geometry of K.bins[bin] ?? []) geometry.dispose();
  }
  // An unlettered, faded timber plaque under the mural eave strains at the
  // same swing maximum as its rare wooden creak. No unattached bell sounds.
  const swing = new THREE.Group(); swing.name = 'dunhuang-timber-sign';
  swing.position.set(SIGN.x, SIGN.y + .26, SIGN.z); swing.rotation.y = -Math.PI / 2;
  const signMaterial = new THREE.MeshStandardMaterial({ color: 0x805845, roughness: 1 });
  const sign = new THREE.Mesh(box(1.27, .42, .068), signMaterial); sign.position.y = -.26; swing.add(sign);
  const strapMaterial = new THREE.MeshStandardMaterial({ color: 0x443f36, roughness: .93 });
  for (const x of [-.45, .45]) {
    const strap = new THREE.Mesh(box(.033, .24, .04), strapMaterial); strap.position.set(x, -.08, 0); swing.add(strap);
  }
  scene.add(swing); const sand = blowingSand(scene);
  let trianglesCount = 0, meshesCount = 0, verticesCount = 0;
  const textures = new Set();
  for (const object of scene.children) if (!before.has(object)) object.traverse(child => {
    if (child.isMesh) { meshesCount++; verticesCount += child.geometry.attributes.position.count; trianglesCount += child.geometry.index ? child.geometry.index.count / 3 : child.geometry.attributes.position.count / 3; }
    if (child.material) for (const value of Object.values(child.material)) if (value?.isTexture) textures.add(value);
  });
  // 세부음: 간판 흔들림 끝(11 s 첫, 31 s 마다)에 그 자리에서 'dunhuangWood' (stage_detail_sound.js — 샛별 값 그대로)
  const signPosition = new THREE.Vector3(), period = 31;
  let time = 0, nextCreak = 11, gust = 0;
  const stage = {
    sunOffset, // 해 (−12, 8, −9) — 높이 약 28°, 플레이어 뒤 왼쪽 (샛별 값 그대로, 확인표 1380)
    fighterLight: { color: 0xf3ecdc, rimColor: 0xd9e8ef, level: .53, rim: .76 },
    stats: { triangles: trianglesCount, meshes: meshesCount, vertices: verticesCount, textures: textures.size, clearRadius: 10.5, proceduralTextureMax: 1024 },
    excite(amount = 0) { if (Number.isFinite(amount)) gust = Math.min(1, gust + Math.max(0, amount) * .08); },
    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      const step = Math.min(dt, .1); time += step; gust *= Math.exp(-step * 1.4);
      swing.rotation.x = Math.cos((time - 11) * Math.PI * 2 / period) * .10;
      sand.update(time, gust);
      if (time >= nextCreak) {
        sign.getWorldPosition(signPosition);
        stage.onEvent?.('stageDetail', { kind: 'dunhuangWood', amp: .5, pos: { x: signPosition.x, y: signPosition.y, z: signPosition.z }, seed: 141400, time });
        nextCreak += period;
      }
    },
  };
  return stage;
}
