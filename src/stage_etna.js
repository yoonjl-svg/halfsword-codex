// ─────────────────────────────────────────────────────────────
//  화산섬(etna) — 해 뜨기 전 화산 능선: 검은 현무암·재 비탈, 낮은 쪽(+z)의 굳은 껍질 사이로 붉은 틈이 보이는 용암,
//   오래된 관측소 터(낮은 돌담·무너진 지붕), 먼 분화구 원뿔과 옅은 재 연기, 별과 옅은 달(해 원반 없음)
//   출처: 샛별 저장소 origin/main 7684c732(내용은 53188ff8 '결투장 전체 불규칙 비탈')의 src/stage_etna.js 를 옮김
//   (docs/import/volcano_port_2026-10-14.md). 코드 id 는 샛별 쪽 그대로 etna, 화면 이름은 '화산섬'(사장님 결정 10/14 — 실제 지명은 화면에 쓰지 않는다).
//   결투장(카메라 궤도 10.5 m 안)은 비탈뿐 — 그 땅은 etna_ground.js 의 삼각형 그물 하나를 물리와 같이 쓴다(그림만 굴곡을 더하지 않는다).
//   그 밖 12 m 부터는 그림만 더 거칠게(landHeight). 결투장 띠는 없다(사장님 결정 10/14). 바깥 그림 파일 없음 — 질감은 모두 캔버스로 그려
//   Stages.clear() 가 푼다. 값은 모두 샛별 값(확인표 1460~ '사장님 확인 전')
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Kit, rng, h3, box, canvasTex } from './stage_kit.js';
import { ETNA, etnaHeight, etnaGroundMesh } from './etna_ground.js';

const TAU = Math.PI * 2;
const C = { basalt: 0x494448, umber: 0x59443b, ash: 0x5b5552, stone: 0x5c5652, straw: 0x93846a };
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

class OwnedKit extends Kit {
  putM(bin, geometry, color, matrix, options = {}) {
    try { return super.putM(bin, geometry, color, matrix, options); }
    finally { geometry.dispose(); }
  }
}

function meshGeometry(position, uv, colors = null) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function ashTexture() {
  const r = rng(151011);
  return canvasTex(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#aaa49e'; ctx.fillRect(0, 0, w, h);
    // 재 얼룩과 오래된 밧줄 꼴 흐름 띠는 폰에서도 읽힐 만큼 넓게, 잔 알갱이는 디딜 땅을 녹은 껍질과 갈라 보이게
    for (let i = 0; i < 140; i++) {
      const x = r() * w, y = r() * h, radius = 20 + r() * 125;
      const patch = ctx.createRadialGradient(x, y, 0, x, y, radius);
      patch.addColorStop(0, i % 3 ? 'rgba(65,50,47,.14)' : 'rgba(228,218,195,.18)');
      patch.addColorStop(1, 'rgba(80,64,57,0)'); ctx.fillStyle = patch;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    for (let i = 0; i < 185; i++) {
      const x = r() * w, y = r() * h, length = 14 + r() * 110;
      ctx.strokeStyle = i % 4 ? 'rgba(42,37,38,.12)' : 'rgba(222,211,192,.20)';
      ctx.lineWidth = .7 + r() * 2.2; ctx.beginPath(); ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + length * .3, y - 12, x + length * .6, y + 12, x + length, y + 3); ctx.stroke();
    }
    for (let i = 0; i < 30000; i++) {
      const x = r() * w, y = r() * h, size = .5 + r() * 2.1;
      ctx.fillStyle = i % 3 ? 'rgba(34,30,31,.21)' : 'rgba(240,231,215,.25)';
      ctx.fillRect(x, y, size, size * (.4 + r() * .8));
    }
  });
}

// 되풀이되는 흔들린 보로노이 껍질: 이웃 다각형이 불규칙한 금 하나를 함께 쓰고, 식은 검은 판이 용암을 거의 다 덮는다.
//  가까운 이웃만 잘라 써서 화소마다 도는 큰 잡음 계산을 피한다
function lavaTextures() {
  const n = 15, unit = 1024 / n;
  const point = (x, y) => {
    const ix = ((x % n) + n) % n, iy = ((y % n) + n) % n;
    return [(x + .18 + h3(ix, iy, 0, 151041) * .64) * unit, (y + .18 + h3(ix, iy, 1, 151043) * .64) * unit];
  };
  const cells = [];
  for (let y = -1; y <= n; y++) for (let x = -1; x <= n; x++) {
    const p = point(x, y);
    let poly = [[p[0] - unit * 2, p[1] - unit * 2], [p[0] + unit * 2, p[1] - unit * 2], [p[0] + unit * 2, p[1] + unit * 2], [p[0] - unit * 2, p[1] + unit * 2]];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (!dx && !dy) continue;
      const q = point(x + dx, y + dy), nx = q[0] - p[0], ny = q[1] - p[1];
      const edge = (q[0] * q[0] + q[1] * q[1] - p[0] * p[0] - p[1] * p[1]) * .5, next = [];
      for (let j = 0; j < poly.length; j++) {
        const a = poly[j], b = poly[(j + 1) % poly.length];
        const da = a[0] * nx + a[1] * ny - edge, db = b[0] * nx + b[1] * ny - edge;
        if (da <= 0) next.push(a);
        if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
      }
      poly = next;
    }
    cells.push({ p, poly, shade: h3(x, y, 0, 151049) });
  }
  const draw = (emission) => (ctx, w, h) => {
    // 이음매 대부분은 이미 칙칙한 갈색으로 식었다. 끊긴 열 웅덩이만 이음매 사이로 비친다 —
    //  고르게 빛나는 다각형 그물은 낮은 경기 카메라에서 현무암 껍질이 아니라 철사 그물로 읽힌다
    ctx.fillStyle = emission ? '#020000' : '#161316'; ctx.fillRect(0, 0, w, h);
    const hot = rng(151053);
    for (let i = 0; i < 24; i++) {
      const x = hot() * w, y = hot() * h, radius = 13 + hot() * 60;
      const patch = ctx.createRadialGradient(x, y, 0, x, y, radius);
      patch.addColorStop(0, emission ? 'rgba(244,94,15,.97)' : 'rgba(234,88,19,.95)');
      patch.addColorStop(.35, emission ? 'rgba(181,42,4,.79)' : 'rgba(169,43,11,.8)');
      patch.addColorStop(1, 'rgba(77,23,5,0)'); ctx.fillStyle = patch;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    for (const { p, poly, shade } of cells) {
      const inset = .925 + shade * .065;
      ctx.beginPath();
      for (let j = 0; j < poly.length; j++) {
        const q = poly[j], px = p[0] + (q[0] - p[0]) * inset, py = p[1] + (q[1] - p[1]) * inset;
        if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = emission ? '#030100' : `hsl(${18 + shade * 16} ${6 + shade * 6}% ${8 + shade * 9}%)`;
      ctx.fill();
      if (!emission) {
        ctx.save(); ctx.clip();
        // 판마다 안쪽의 잔 눌린 주름이 끈적한 현무암을 보이게 한다 (온 면을 밝은 장식 격자로 만들지 않고)
        for (let j = 0; j < 7; j++) {
          const y = p[1] - 25 + j * 8;
          ctx.strokeStyle = j % 2 ? 'rgba(2,3,5,.30)' : 'rgba(136,124,111,.11)';
          ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(p[0] - 55, y);
          ctx.bezierCurveTo(p[0] - 22, y - 9, p[0] + 14, y + 12, p[0] + 55, y + 2); ctx.stroke();
        }
        for (let j = 0; j < 24; j++) {
          const speck = h3(p[0], p[1], j, 151055), px = p[0] + (h3(p[0], j, p[1], 151056) - .5) * 70, py = p[1] + (speck - .5) * 70;
          ctx.fillStyle = j % 3 ? 'rgba(1,2,4,.3)' : 'rgba(136,126,118,.22)'; ctx.fillRect(px, py, 1 + speck * 2, 1.2);
        }
        ctx.restore();
      }
    }
    // 고르지 않은 틈이 식은 판 사이로 느린 흐름 방향을 따른다 — 폭이 바뀌는 띠와 어두운 다리가
    //  장식 잔금처럼 고르게 이어진 다각형 윤곽을 대신한다
    for (let stream = 0; stream < 4; stream++) {
      const center = y => 115 + stream * 258 + Math.sin(y / h * TAU + stream * 2.1) * 39 + Math.sin(y / h * TAU * 5 + stream) * 8;
      const width = y => 3 + Math.max(0, Math.sin(y / h * TAU * 3 + stream * 1.8)) ** 2 * 19 + Math.sin(y / h * TAU * 9 + stream) * 1.5;
      for (let j = 0; j < 96; j++) {
        const y0 = j / 96 * h, y1 = (j + 1) / 96 * h, x0 = center(y0), x1 = center(y1), w0 = width(y0), w1 = width(y1);
        const hotness = .5 + Math.sin(y0 / h * TAU * 3 + stream * 1.8) * .5;
        if (hotness < .16) continue;
        ctx.fillStyle = emission ? `rgb(${Math.round(106 + hotness * 138)},${Math.round(25 + hotness * 63)},4)` : `rgb(${Math.round(107 + hotness * 105)},${Math.round(34 + hotness * 40)},12)`;
        ctx.beginPath(); ctx.moveTo(x0 - w0, y0); ctx.lineTo(x1 - w1, y1); ctx.lineTo(x1 + w1 * .64, y1); ctx.lineTo(x0 + w0 * .64, y0); ctx.closePath(); ctx.fill();
        if (j % 11 < 3 && w0 > 10) {
          ctx.fillStyle = emission ? '#040100' : '#1b1819'; ctx.beginPath();
          ctx.moveTo(x0 - w0 * .65, y0 - 1); ctx.lineTo(x1 + w1 * .21, y1 + 1); ctx.lineTo(x1 + w1 * .57, y1 + 1); ctx.lineTo(x0, y0 - 1); ctx.closePath(); ctx.fill();
        }
      }
    }
  };
  return { map: canvasTex(1024, 1024, draw(false)), emissiveMap: canvasTex(1024, 1024, draw(true)) };
}

export function landHeight(x, z) {
  // 같이 쓰는 결투 땅 밖에서만 꾸민다 — 결투장 둘레에 손대지 않은 삼각형 한 바퀴를 더 남긴다
  const d = Math.hypot(x, z), blend = smooth(12, 19, d);
  const broken = .55 * Math.sin(x * .23 + z * .12) + .27 * Math.sin(x * .72 - z * .32) + .16 * Math.cos(z * .81 + x * .46);
  const uphill = smooth(9, 34, -z) * (2 + .8 * Math.sin(x * .12));
  const banks = smooth(8.6, 15, Math.abs(x + Math.sin(z * .16) * 2)) * smooth(4, 10, z) * (3.5 + z * .1);
  // 용암은 오래된 얕은 골짜기에 고여 있다 — 먼 둑과 갈래진 가장자리가 네모가 아니라 이 땅 밑으로 자연스럽게 사라진다
  const farBank = smooth(28, 44, z) * 8;
  return etnaHeight(x, z) + blend * (broken + uphill + banks + farBank);
}

function ground() {
  const { vertices, indices } = etnaGroundMesh(56), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  g.setIndex(new THREE.BufferAttribute(indices, 1));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(vertices.length / 3 * 2), 2));
  const pos = g.attributes.position, col = [], uv = g.attributes.uv;
  const basalt = new THREE.Color(C.basalt), umber = new THREE.Color(C.umber), ash = new THREE.Color(C.ash), color = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    if (Math.hypot(x, z) > 12) pos.setY(i, landHeight(x, z));
    uv.setXY(i, x / 7.7, z / 7.7);
    const patch = .5 + Math.sin(x * .37 + z * .12) * .23 + Math.sin(z * .52 - x * .18) * .17;
    color.copy(basalt).lerp(umber, Math.max(0, patch - .35));
    color.lerp(ash, .16 + Math.max(0, Math.sin(x * .31 + z * .24)) * .22);
    color.multiplyScalar(.91 + h3(x, 0, z, 151061) * .18);
    // 녹은 혀에서 오는 절제된 따뜻한 가장자리 — 바위 꼭짓점 색에 굽는다
    const glow = Math.exp(-((z - ETNA.lavaEdgeZ) ** 2) / 4) * (1 - smooth(6, 12, Math.abs(x)));
    color.r += glow * .025; color.g += glow * .006;
    col.push(color.r, color.g, color.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  // 나머지 경관을 합칠 때도 그려 둔 색 무늬를 그대로 둔다
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: ashTexture(), roughness: .99, metalness: .02 });
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'etna-shared-slope'; mesh.receiveShadow = true;
  return mesh;
}

function basaltAndGrass(K) {
  const r = rng(151079);
  for (let i = 0; i < 240; i++) {
    const angle = r() * TAU, radius = 12.2 + r() ** .7 * 30;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius, y = landHeight(x, z);
    if (z > 5 && y < ETNA.lavaLevel + .12) continue;
    const size = .16 + r() * (radius > 15 ? 1.3 : .36);
    K.put('stone', new THREE.IcosahedronGeometry(1, 0), i % 5 ? C.basalt : C.umber,
      [x, y + size * .18, z], [r() * .4, r() * TAU, r() * .3], [size * 1.5, size * .55, size], { rough: .10, vary: .25, noise: .14 });
  }
  // 드문드문한 산 다발풀 — 푸른 풀밭은 아니다. 작은 금빛 끝이 재 능선 위쪽(오래된 쪽)의 찬 하늘빛을 받는다
  const blades = [], uv = [];
  for (let i = 0; i < 160; i++) {
    const x = (r() - .5) * 44, z = -6 - r() * 25;
    if (Math.hypot(x, z) < 8.2) continue;
    const y = landHeight(x, z), height = .15 + r() * .24;
    for (let j = 0; j < 6; j++) {
      const a = r() * TAU, dx = Math.cos(a), dz = Math.sin(a), spread = .10 + r() * .16;
      blades.push(x - dz * .012, y, z + dx * .012, x + dz * .012, y, z - dx * .012,
        x + dx * spread, y + height * (.7 + r() * .4), z + dz * spread);
      uv.push(0, 0, 1, 0, .5, 1);
    }
  }
  K.put('grass', meshGeometry(blades, uv), C.straw, undefined, undefined, 1, { vary: .14, noise: .2 });
}

function observationRuin(K) {
  const r = rng(151091), x = 15.6, z = -11.8, y = landHeight(x, z);
  K.push([x, y, z], -.18);
  // 회반죽 없이 쌓은 낮은 용암돌 담과 열린 문간, 무너진 지붕 — 작은 터가 크기를 보여 줄 뿐 산을 신전으로 만들지 않는다
  for (let row = 0; row < 6; row++) for (let col = 0; col < 8; col++) {
    const px = (col - 3.5) * .49 + (row % 2) * .15;
    const height = .29 + r() * .06;
    if (!(col >= 3 && col <= 4 && row < 5)) K.put('stone', box(.47, height, .55), C.stone, [px, .17 + row * .31, 1.43], [0, (r() - .5) * .12, (r() - .5) * .06], 1, { rough: .07, vary: .24, noise: .12 });
    if (row < 4 + Math.floor(col / 3)) K.put('stone', box(.48, height, .54), C.stone, [px, .17 + row * .31, -1.41], [0, (r() - .5) * .12, 0], 1, { rough: .08, vary: .2, noise: .1 });
  }
  for (const side of [-1, 1]) for (let row = 0; row < 5; row++) for (let j = 0; j < 5; j++) {
    if (side > 0 && row > 2 && j === 2) continue;
    K.put('stone', box(.53, .30, .48), C.stone, [side * 1.84, .17 + row * .31, (j - 2) * .49], [0, (r() - .5) * .1, 0], 1, { rough: .07, vary: .22, noise: .12 });
  }
  K.put('stone', box(1.37, .22, .66), 0x68605a, [.13, 1.77, 1.43], [0, -.018, -.013], 1, { rough: .075 });
  for (let j = 0; j < 5; j++) K.put('wood', box(.13, .13, 3.26), 0x393434, [-1.32 + j * .68, 1.48 - j * .11, -.14], [.14 + j * .033, -.06, 0], 1, { rough: .04, vary: .20 });
  for (let j = 0; j < 20; j++) K.put('stone', new THREE.IcosahedronGeometry(.21 + r() * .20, 0), C.stone, [(r() - .5) * 4.8, .13, (r() - .5) * 3.6], [r(), r(), r()], [1.4, .65, 1], { vary: .25 });
  K.pop();
  // 오르막 가장자리의 무너진 낮은 축대 — 카메라 궤도 뒤 넉넉히
  for (let i = 0; i < 21; i++) {
    const wx = -11.5 + i * .47, wz = -12.7 + Math.sin(i * .12) * .8;
    const wy = landHeight(wx, wz);
    for (let row = 0; row < (i % 7 < 2 ? 1 : 2); row++) K.put('stone', box(.45, .29, .46), C.stone,
      [wx + row * .12, wy + .15 + row * .29, wz], [0, (r() - .5) * .2, (r() - .5) * .08], 1, { rough: .07, vary: .24 });
  }
}

function mountains(K) {
  const r = rng(151101);
  // 겹친 칼데라 능선이 카메라가 도는 모든 방향의 지평선을 닫는다
  for (let layer = 0; layer < 3; layer++) {
    const positions = [], colors = [], radius = 145 + layer * 75, count = 128;
    const color = new THREE.Color([0x333d4e, 0x3d4d63, 0x4b5f79][layer]);
    for (let i = 0; i < count; i++) {
      const a = i / count * TAU, b = (i + 1) / count * TAU;
      const ridge = t => 7 + layer * 3 + 8 * Math.sin(t * 3 + layer) ** 2 + 6 * Math.sin(t * 7 - layer * 1.7) ** 2 + 3 * Math.cos(t * 13);
      const v = [[Math.cos(a) * radius, -22, Math.sin(a) * radius], [Math.cos(b) * radius, -22, Math.sin(b) * radius],
        [Math.cos(b) * radius, ridge(b), Math.sin(b) * radius], [Math.cos(a) * radius, ridge(a), Math.sin(a) * radius]];
      for (const j of [0, 2, 1, 0, 3, 2]) { positions.push(...v[j]); colors.push(color.r, color.g, color.b); }
    }
    const geo = meshGeometry(positions, null, colors);
    // 지평선 재질(빛 안 받음)은 이미 공기 원근의 색을 띤다
    K.put('horizon', geo, [0x333d4e, 0x3d4d63, 0x4b5f79][layer], undefined, undefined, 1, { vary: 0, noise: 0 });
  }
  const rings = [[0, 23], [3.6, 24], [5.7, 27], [9, 25.7], [17, 23.7], [30, 16.5], [47, 9.5], [72, -5]], positions = [], uv = [];
  const vertices = rings.map(([radius, y], ring) => Array.from({ length: 72 }, (_, j) => {
    const a = j / 72 * TAU, wrinkle = Math.sin(a * 7 + .4) * .48 + Math.cos(a * 11) * .3;
    const buttress = Math.max(0, Math.sin(a + .3)) ** 3 * 4.3 * smooth(1, 3, ring) * (1 - smooth(6, 7, ring));
    return [124 + Math.cos(a) * radius * (1 + .055 * Math.sin(a * 5)), y + buttress + wrinkle * smooth(0, 2, ring) * (1 + ring * .12), -23 + Math.sin(a) * radius * .78 + ring * .52];
  }));
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < 72; i++) {
    const b = (i + 1) % 72;
    for (const p of [vertices[j][i], vertices[j + 1][b], vertices[j + 1][i], vertices[j][i], vertices[j][b], vertices[j + 1][b]]) { positions.push(...p); uv.push(p[0] / 14, p[2] / 14); }
  }
  K.put('cone', meshGeometry(positions, uv), 0x4b4649, undefined, undefined, 1, { vary: .03, noise: .10 });
  // 화산탄 몇 개가 가까운 능선 윤곽을 깨뜨린다
  for (let i = 0; i < 22; i++) {
    const x = 34 + r() * 29, z = -24 + r() * 45;
    K.put('stone', new THREE.IcosahedronGeometry(1, 0), C.basalt, [x, landHeight(x, z) + .1, z], [.3, r() * TAU, .2], [1.1 + r() * 2, .5 + r() * 1.6, 1 + r() * 2], { rough: .22, vary: .24 });
  }
}

function sky(scene) {
  const map = canvasTex(1024, 512, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#0a1022'); gradient.addColorStop(.27, '#15243e');
    gradient.addColorStop(.46, '#344d6b'); gradient.addColorStop(.515, '#7c7d89');
    gradient.addColorStop(.555, '#696979'); gradient.addColorStop(1, '#454555');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    const r = rng(151131);
    for (let i = 0; i < 135; i++) {
      const x = r() * w, y = 20 + r() * h * .33;
      ctx.fillStyle = `rgba(209,221,245,${.13 + r() * .31})`; ctx.fillRect(x, y, i % 8 ? .65 : 1.1, i % 8 ? .65 : 1.1);
    }
    // 길고 옅은 재 안개 — 불타는 구름·낮의 해 원반은 없다
    for (let i = 0; i < 19; i++) {
      ctx.fillStyle = 'rgba(163,154,167,.025)'; ctx.beginPath();
      ctx.ellipse(r() * w, h * (.39 + r() * .085), 35 + r() * 100, 1 + r() * 2, -.018, 0, TAU); ctx.fill();
    }
  });
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(510, 40, 20), new THREE.MeshBasicMaterial({ map, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.name = 'etna-predawn-sky'; dome.renderOrder = -10; scene.add(dome);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(1.35, 24), new THREE.MeshBasicMaterial({ color: 0xbbc9dc, fog: false, toneMapped: false }));
  moon.name = 'etna-pale-moon'; moon.position.set(-80, 135, -320); moon.lookAt(0, 0, 0); scene.add(moon);
}

function plume(scene) {
  const map = canvasTex(128, 128, (ctx, w, h) => {
    const r = rng(151151);
    for (let i = 0; i < 22; i++) {
      const x = w * (.27 + r() * .46), y = h * (.24 + r() * .50), radius = w * (.13 + r() * .18);
      const puff = ctx.createRadialGradient(x, y, 0, x, y, radius);
      puff.addColorStop(0, 'rgba(179,181,191,.21)'); puff.addColorStop(.4, 'rgba(179,181,191,.12)'); puff.addColorStop(1, 'rgba(179,181,191,0)');
      ctx.fillStyle = puff; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
  });
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  const positions = [], uv = [];
  const sideways = new THREE.Vector3(.18, 0, .984);
  for (let i = 0; i < 14; i++) {
    const size = 2.8 + i * .45, x = 124 + i * .70, y = 26 + i * .9, z = -22 - i * 1.6;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const j of [0, 1, 2, 0, 2, 3]) {
      const [u, v] = corners[j]; positions.push(x + sideways.x * u * size, y + v * size, z + sideways.z * u * size); uv.push((u + 1) * .5, (v + 1) * .5);
    }
  }
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: .40, depthWrite: false, side: THREE.DoubleSide, color: 0x979da9 });
  const mesh = new THREE.Mesh(meshGeometry(positions, uv), mat); mesh.name = 'etna-distant-ash-plume'; scene.add(mesh);
  return mesh;
}

function lavaSpatter(scene) {
  // 작은 용암 조각 열여섯이 그리기 하나·고정 버퍼를 함께 쓴다. 조각은 낮게 튀어 식으며 가라앉는다 — 높은 분수는 없다
  const r = rng(151137), count = 16, particles = [];
  const corners = [[0, 1, 0], [-.82, -.45, .48], [.82, -.45, .48], [0, -.45, -.95]];
  const faces = [0, 1, 2, 0, 2, 3, 0, 3, 1, 1, 3, 2];
  const position = new Float32Array(count * faces.length * 3), colors = new Float32Array(position.length);
  for (let i = 0; i < count; i++) particles.push({
    x: (r() - .5) * 11, z: 6.15 + r() * 9.8, period: 7 + r() * 7, phase: r() * 14,
    duration: .8 + r() * .65, height: .10 + r() * .24, size: .018 + r() * .018, drift: (r() - .5) * .26,
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, ETNA.lavaLevel, 11), 13);
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  mesh.name = 'etna-small-molten-spatter'; scene.add(mesh);
  const update = time => {
    for (let i = 0; i < count; i++) {
      const p = particles[i], age = (time + p.phase) % p.period, life = Math.min(1, age / p.duration);
      const active = age < p.duration, arc = 4 * life * (1 - life);
      const size = active ? p.size * Math.sin(Math.PI * life) ** .45 : 0;
      const x = p.x + p.drift * life, y = ETNA.lavaLevel + .012 + p.height * arc, z = p.z + .14 * life;
      const warm = active ? 1 - life * .70 : 0;
      for (let j = 0; j < faces.length; j++) {
        const k = (i * faces.length + j) * 3, v = corners[faces[j]];
        position[k] = x + v[0] * size; position[k + 1] = y + v[1] * size; position[k + 2] = z + v[2] * size;
        colors[k] = warm; colors[k + 1] = warm * (.16 + .26 * (1 - life)); colors[k + 2] = warm * .015;
      }
    }
    g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = true;
  };
  update(0);
  return update;
}

function lava(scene) {
  const outline = [[-8.7, ETNA.lavaEdgeZ], [8.7, ETNA.lavaEdgeZ], [10.2, 8], [9.3, 10.5], [12.5, 13.2], [11.6, 17.8], [15.8, 22], [14, 29], [9.3, 31.4],
    [7.5, 26.3], [4.1, 24.7], [1, 31], [-3, 36], [-6.1, 34], [-5.6, 29], [-8.9, 24.2], [-13.9, 23], [-15.4, 17.3], [-11.5, 16], [-10, 11], [-11.3, 8]];
  const shape = new THREE.Shape(); shape.moveTo(...outline[0]); for (const point of outline.slice(1)) shape.lineTo(...point); shape.closePath();
  const g = new THREE.ShapeGeometry(shape), p = g.attributes.position, uv = g.attributes.uv;
  // 모양 XY 를 월드 XZ 로 (위를 보는 감김)
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getY(i); p.setXYZ(i, x, ETNA.lavaLevel, z); uv.setXY(i, x / 9, z / 9); }
  // ShapeGeometry 는 +Z 가 앞면이라 +Y → +Z 로 옮기면 뒤집힌다 — 감김을 되돌린다
  const index = g.index; for (let i = 0; i < index.count; i += 3) { const b = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, b); } g.computeVertexNormals();
  const maps = lavaTextures();
  const mat = new THREE.MeshStandardMaterial({ ...maps, color: 0xf1d9c4, emissive: 0xff822b, emissiveIntensity: 1.55, roughness: .96, metalness: .01 });
  const clock = { value: 0 };
  mat.userData.flowClock = clock;
  // 셰이더: 느린 흐름(UV 만 옮김 — 물리 높이·물가의 모든 점은 그대로)과 고르지 않은 밀림이 껍질·틈을 함께 옮기고,
  //  틈마다 다른 열 위상으로 굴러 온 면이 한꺼번에 깜빡이지 않으면서 호박색 속이 떠오르게 한다 (샛별 원문 그대로)
  mat.onBeforeCompile = shader => {
    shader.uniforms.etnaTime = clock;
    shader.fragmentShader = 'uniform float etnaTime;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec2 etnaFlowUv = vMapUv - vec2(0.0, etnaTime * 0.006);
      etnaFlowUv += vec2(
        sin(vMapUv.y * 13.0 + etnaTime * 0.37) * 0.024 + sin(vMapUv.x * 19.0 - etnaTime * 0.23) * 0.010,
        sin(vMapUv.x * 15.0 - vMapUv.y * 7.0 + etnaTime * 0.29) * 0.020
      );
      ${THREE.ShaderChunk.map_fragment.replaceAll('vMapUv', 'etnaFlowUv')}`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
      ${THREE.ShaderChunk.emissivemap_fragment.replaceAll('vEmissiveMapUv', 'etnaFlowUv')}
      float etnaHeat = 0.5 + 0.5 * sin(etnaFlowUv.x * 23.0 + etnaFlowUv.y * 37.0 - etnaTime * 0.83
        + sin(etnaFlowUv.y * 19.0 + etnaTime * 0.31));
      totalEmissiveRadiance *= 0.72 + 0.58 * etnaHeat;
      totalEmissiveRadiance += vec3(0.12, 0.20, 0.018) * emissiveColor.r * pow(etnaHeat, 3.0);`);
  };
  mat.customProgramCacheKey = () => 'etna-viscous-lava-v2';
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'etna-cooled-lava-crust'; mesh.receiveShadow = true; scene.add(mesh);
  // 국소 주황 반사광 웅덩이 둘뿐 — 무대 전체를 붉게 물들이지 않는다
  const glow = new THREE.PointLight(0xff5e1c, 2.3, 8, 2); glow.position.set(-3.5, ETNA.lavaLevel + .7, 7.4); scene.add(glow);
  const glow2 = new THREE.PointLight(0xff6926, 2.0, 8, 2); glow2.position.set(4.6, ETNA.lavaLevel + .6, 8.3); scene.add(glow2);
  return { clock, spatter: lavaSpatter(scene), lights: [glow, glow2] };
}

export function buildEtna(scene, { hemi, sun } = {}) {
  const before = new Set(scene.children), sunOffset = { x: -6, y: 8, z: -5 };
  scene.background = new THREE.Color(0x40516a); scene.fog = new THREE.Fog(0x52617a, 54, 290);
  if (hemi) { hemi.color.setHex(0xb8cae6); hemi.groundColor.setHex(0x635256); hemi.intensity = 1.65; }
  if (sun) { sun.color.setHex(0xc4d3ee); sun.intensity = 1.8; sun.position.set(sunOffset.x, sunOffset.y, sunOffset.z); }
  sky(scene);
  const K = new OwnedKit(151001), groundMesh = ground(); scene.add(groundMesh);
  basaltAndGrass(K); observationRuin(K); mountains(K);
  const materials = {
    stone: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .97, metalness: .02 }),
    wood: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    grass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
    cone: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: groundMesh.material.map }),
    horizon: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }),
  };
  for (const [bin, material] of Object.entries(materials)) {
    const mesh = K.mesh(bin, material, { cast: bin === 'stone' || bin === 'wood', receive: bin !== 'horizon' });
    if (mesh) { mesh.name = `etna-${bin}`; scene.add(mesh); } else material.dispose();
    for (const geometry of K.bins[bin] ?? []) geometry.dispose();
  }
  const ashPlume = plume(scene), molten = lava(scene);
  let triangles = 0, meshes = 0;
  for (const object of scene.children) if (!before.has(object)) object.traverse(child => {
    if (!child.isMesh) return;
    meshes++; triangles += child.geometry.index ? child.geometry.index.count / 3 : child.geometry.attributes.position.count / 3;
  });
  let time = 0, nextCrust = 8;
  const stage = {
    sunOffset,
    fighterLight: { color: 0xdde6f4, rimColor: 0xc7d9f3, rim: 1.0, level: .87 },
    stats: { triangles, meshes, clearRadius: 6.5, cameraClearRadius: 10.8, proceduralTextureMax: 1024, groundSlopeDegrees: ETNA.degrees, lavaLevel: ETNA.lavaLevel },
    excite() {},
    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      time += Math.min(dt, .1);
      molten.clock.value = time;
      molten.spatter(time);
      molten.lights[0].intensity = 2.25 + Math.sin(time * .27) * .12;
      molten.lights[1].intensity = 1.95 + Math.sin(time * .21 + 1.4) * .10;
      ashPlume.position.x = Math.sin(time * .037) * .8;
      ashPlume.position.z = Math.sin(time * .029) * .35;
      if (time >= nextCrust) {
        const x = Math.sin(nextCrust * 1.7) * 4.8;
        stage.onEvent?.('stageDetail', { kind: 'etnaCrust', amp: .55, pos: { x, y: ETNA.lavaLevel, z: 7.6 }, seed: 151001, time });
        nextCrust += 15 + (Math.sin(nextCrust * 2.1) * .5 + .5) * 8;
      }
    },
  };
  return stage;
}
