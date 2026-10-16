// ─────────────────────────────────────────────────────────────
//  청람잔도의 먼 경치 — 가상의 큰 강 협곡: 큰 강 · 겹친 능선 둘 · 능선 소나무 · 강가 덤불 · 오른쪽 능선 돌계단 길
//   출처: 샛별 저장소 5a4e96c 판의 src/stage_qinglan_vista.js 로 되돌림 (사장님 10/15 23:1x — docs/stages.md '청람잔도 되돌림').
//   우리 판에서 고친 것 (무대 리뷰 10/10 §2-2, 확인표 1815~):
//    ② 둥근 초록 언덕 위에 떠 보이던 각진 바위 → 밑동을 땅속으로 길게 내리고(seatedRock), 바위 밑동 꼭짓점과 둘레 땅을 어둡게(contactShade).
//       덩어리로만 읽히던 가까운 언덕 비탈에 반쯤 묻힌 바위 몇 개(hillOutcrops — 새 난수 씨앗이라 샛별 판 소나무·바위 자리는 그대로)
//    ⑤ 쉼터 발밑 땅: 쉼터 바위 면이 내려가는 아래(강 머리 앞)가 비어 넓은 각도에서 하늘빛이 비쳤다 → 강가 높이의 낮은 땅 한 장 (restFoot)
//    ⑥ 세로 면 명암: 가파른 비탈일수록 어둡게, 가장 가파른 곳은 초록을 덜어 바위가 드러나게 (paintTerrain 끝 두 줄)
//   모두 장식 — 물리·소리·빛 없음. (아래 영어 줄 설명은 샛별 저장소 원문 그대로 둔 것이다)
// ─────────────────────────────────────────────────────────────
// A fictional great-river gorge, inspired by the broad walls of the Three
// Gorges and the grey ridges and pines of Mount Tai. No named site is reproduced.
// Only scenery is owned here: no gameplay bodies, lights, sky or sound.
import * as THREE from 'three';
import { Kit, rng, limb, boxUV, box } from './stage_kit.js';

const WATER_Y = -11.4;
const TAU = Math.PI * 2;
const RIVER_NODES = [[26, 0], [65, -5], [101, -18], [146, -29], [182, -3], [221, 31], [267, 20], [318, -19], [370, -9], [430, 12]];
const CRESTS = {
  '-1': [[-85, 13], [-30, 16], [28, 18], [67, 25], [103, 31], [146, 46], [178, 39], [221, 61], [264, 77], [305, 58], [350, 76], [435, 53]],
  '1': [[-85, 12], [-27, 15], [29, 17], [78, 23], [116, 29], [158, 43], [198, 63], [237, 45], [281, 62], [327, 83], [366, 62], [435, 51]],
};

// Kit copies each source. Dispose those sources immediately and its retained
// copies after merging; only the scene owns the resulting render resources.
class VistaKit extends Kit {
  putM(bin, geometry, color, matrix, options = {}) {
    try { return super.putM(bin, geometry, color, matrix, options); }
    finally { geometry.dispose(); }
  }
}

function interpolate(nodes, x, smooth = false) {
  if (x <= nodes[0][0]) return nodes[0][1];
  for (let i = 1; i < nodes.length; i++) {
    if (x > nodes[i][0]) continue;
    let t = (x - nodes[i - 1][0]) / (nodes[i][0] - nodes[i - 1][0]);
    if (smooth) t = t * t * (3 - 2 * t);
    return THREE.MathUtils.lerp(nodes[i - 1][1], nodes[i][1], t);
  }
  return nodes[nodes.length - 1][1];
}

const riverZ = x => interpolate(RIVER_NODES, x, true);
const riverHalfWidth = x => 14.4 + 2.1 * Math.sin(x * 0.014 + 0.4) + 0.9 * Math.sin(x * 0.047);
const valleyAxis = x => riverZ(x) * 0.25;
const valleyHalfWidth = x => 31 + THREE.MathUtils.smoothstep(x, 60, 250) * 34 + Math.max(0, -x) * 0.18;
const rockHeight = (x, side) => (interpolate(CRESTS[side], x) + 2.3 * Math.sin(x * 0.19 + side) + Math.sin(x * 0.43 - side) * 0.85) * 0.74;

function stoneTexture() {
  // A single neutral, seamless field: fine grain and irregular vertical seams.
  // DataTexture also keeps geometry validation independent of the DOM.
  const size=512, data=new Uint8Array(size*size*4);
  const hash=(x,y)=>{let n=(Math.imul(x,374761393)+Math.imul(y,668265263))|0;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const u=x/size,v=y/size;
    const grain=(hash(x,y)-0.5)*7;
    const worn=Math.sin(u*TAU*23+Math.sin(v*TAU*2)*1.2)*2.2;
    const seam=Math.pow(Math.max(0,Math.sin(u*TAU*11+Math.sin(v*TAU*3)*0.65+Math.sin(v*TAU*9)*0.13)),38);
    const value=Math.round(THREE.MathUtils.clamp(249+grain+worn-seam*20,217,255));
    const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.magFilter=THREE.LinearFilter;texture.anisotropy=4;texture.needsUpdate=true;
  texture.name='qinglan-neutral-stone-grain';
  return texture;
}

function geometryGrid(columns, rows, point, reverse = false) {
  const positions = [], indices = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) positions.push(...point(i / columns, j / rows));
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const a = j * (columns + 1) + i, b = a + 1, c = a + columns + 1, d = c + 1;
    const faces = (i + j) % 2 ? [a, b, d, a, d, c] : [a, b, c, b, d, c];
    for (let n = 0; n < faces.length; n += 3) {
      indices.push(faces[n], faces[n + (reverse ? 2 : 1)], faces[n + (reverse ? 1 : 2)]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// The river takes stronger turns than the broad gorge envelope. Low alluvial
// banks inside that envelope preserve views of both far bends from eye y=3.
function terrainPoint(x, distance, side) {
  const axis = valleyAxis(x), toe = valleyHalfWidth(x);
  const height = rockHeight(x, side);
  const broad = interpolate([[0, 0], [3, 0.06], [7, 0.25], [12, 0.31], [20, 0.36],
    [28, 0.73], [35, 0.83], [44, 0.66], [60, 1], [78, 0.80], [104, 0.36], [135, 0.07]], distance);
  const escarpment = THREE.MathUtils.smoothstep(distance, 1, 6) * (1 - THREE.MathUtils.smoothstep(distance, 8, 13))
    + THREE.MathUtils.smoothstep(distance, 19, 23) * (1 - THREE.MathUtils.smoothstep(distance, 29, 36));
  const fracture = Math.sin(x * 0.27 + side) * 1.5 + Math.sin(x * 0.63 - side * 1.6) * 0.65;
  const z = axis + side * (toe + distance + fracture * escarpment);
  const inclinedLayer = broad * height + Math.sin(x * 0.045 + side * 2) * 1.1;
  const ledge = Math.sin(inclinedLayer * 0.75 + x * 0.013 + side) * escarpment * 0.78;
  const saddle = Math.sin(x * 0.085 + distance * 0.069 + side * 3) * Math.sin(distance * 0.13) * 2.2;
  return [x, WATER_Y + 0.65 + broad * height + ledge + saddle, z];
}

function paintTerrain(g, side, far = false) {
  const p = g.attributes.position, n = g.attributes.normal, colors = g.attributes.color;
  const stone = new THREE.Color(0xa2a79f), darkRock = new THREE.Color(0x65726c);
  const forest = new THREE.Color(0x426d36), meadow = new THREE.Color(0x638447);
  const haze = new THREE.Color(0x9eb5b5), color = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), up = n.getY(i);
    const height = rockHeight(x, side), elevation = (y - WATER_Y) / height;
    const slopeForest = THREE.MathUtils.smoothstep(up, 0.20, 0.75);
    const patch = 0.5 + 0.5 * Math.sin(x * 0.065 + Math.sin(z * 0.071) * 1.4 + y * 0.043);
    const crestRock = THREE.MathUtils.smoothstep(elevation, 0.79, 0.95);
    const steep = 1 - THREE.MathUtils.smoothstep(up, 0.42, 0.78); // ⑥ 가파른 면 (우리 판)
    const greenery = THREE.MathUtils.clamp(Math.max(slopeForest * (0.82 + patch * 0.14), 0.19 + patch * 0.24) - crestRock * 0.25 - steep * 0.3, 0, 0.96);
    const crack = Math.pow(Math.max(0, Math.sin(x * 0.38 + z * 0.09 + Math.sin(y * 0.05))), 5);
    const strata = Math.sin(y * 0.51 + x * 0.024 + side) * 0.032;
    color.copy(stone).lerp(darkRock, crack * 0.31 + (1 - up) * 0.09);
    color.multiplyScalar(0.94 + strata + Math.sin(x * 0.09 + z * 0.11) * 0.035);
    const green = forest.clone().lerp(meadow, patch * 0.35);
    color.lerp(green, greenery);
    // ⑥ 세로 면 명암 (우리 판): 한낮 해가 높아 비탈이 모두 같은 빛으로 납작했다 → 가파를수록 어둡게(최대 −26 %) [사장님 확인 전 — 확인표 1822]
    color.multiplyScalar(1 - 0.26 * (1 - THREE.MathUtils.smoothstep(up, 0.3, 0.9)));
    color.lerp(haze, THREE.MathUtils.smoothstep(x, 125, 445) * (far ? 0.7 : 0.57));
    colors.setXYZ(i, color.r, color.g, color.b);
  }
}

function bankPoint(x, v, side) {
  const edge = x < 26 ? side * 25 : riverZ(x) + side * riverHalfWidth(x) * 0.993;
  const toe = valleyAxis(x) + side * valleyHalfWidth(x);
  const z = THREE.MathUtils.lerp(edge, toe, v);
  const hummock = Math.pow(Math.max(0, Math.sin(x * 0.10 + v * 8 + side)
    * Math.sin(x * 0.047 - v * 5)), 2) * 1.75;
  const y = WATER_Y - 0.045 + Math.pow(v, 0.8) * 0.72
    + Math.sin(v * Math.PI) * (hummock + Math.sin(x * 0.071 + v * 7) * 0.16);
  return [x, y, z];
}

function canyonSides(K) {
  // Continuous mountain ribbons replace independent domes or tower stacks.
  // Their tall, fractured inner faces rise into broad, uneven forested ridges.
  for (const side of [-1, 1]) {
    const g = geometryGrid(184, 48, (u, v) => {
      const x = -82 + u * 515 + Math.sin(u * 67 + v * 3) * Math.sin(v * Math.PI) * 0.8;
      const d = v * 135;
      return terrainPoint(x, d, side);
    }, side > 0);
    const placed = K.put('mountains', g, 0xa2a79f, undefined, undefined, 1, { noise: 0, vary: 0 });
    paintTerrain(placed, side);

    const banks = geometryGrid(180, 12, (u, v) => {
      const x = -82 + u * 515;
      return bankPoint(x,v,side);
    }, side > 0);
    const ground = K.put('banks', banks, 0x737d66, undefined, undefined, 1, { noise: 0.013, vary: 0 });
    const col = ground.attributes.color, pos = ground.attributes.position, c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const patch = Math.sin(pos.getX(i) * 0.09 + Math.sin(pos.getZ(i) * 0.13) * 1.6);
      c.set(0x969888).lerp(new THREE.Color(0x4f713b), 0.44 + patch * 0.38);
      c.lerp(new THREE.Color(0x9eb5b5), THREE.MathUtils.smoothstep(pos.getX(i), 150, 445) * 0.5);
      col.setXYZ(i, c.r, c.g, c.b);
    }
  }
}

// ⑤ (우리 판) 쉼터 발밑 땅: 샛별 판은 강이 x 26 에서 시작하고 그 앞(x < 26)의 강가 띠가 |z| 25 밖에만 있어, 쉼터 바위 면이 내려가는 아래가 비어
//  하늘빛이 비쳤다(경기 카메라에서는 안 보이고 넓은 각도에서만). 바위 면이 땅에 닿게 강가 높이의 낮은 땅 한 장 — 강가 띠 안쪽 끝(|z| 25)과 꼭 맞물리고,
//  강 머리(x 26~29)에서 둥근 물가로 물 밑에 내려가 강이 쉼터 절벽 밑에서 시작한다. 강가 색 · 절벽 밑은 그늘 [사장님 확인 전 — 확인표 1818]
const restRim = a => 23.5 - 9*Math.max(0,Math.cos(a))**3 + .55*Math.sin(3*a+.4)+.35*Math.sin(9*a); // stage_qinglan.js 의 rim 과 같은 식
function restFoot(K) {
  const g = geometryGrid(56, 40, (u, v) => {
    const x = u < 0.6 ? -27 + (u / 0.6) * 49 : 22 + ((u - 0.6) / 0.4) * 7, z = (v * 2 - 1) * 25; // 물가(x 22~29)는 칸을 촘촘히(0.32 m)
    const edge = Math.abs(z) / 25; // 1 = 강가 띠 안쪽 끝
    const lift = (1 - edge ** 4) * ((0.42 + 0.22 * Math.sin(x * 0.21 + z * 0.13)) * (1 - THREE.MathUtils.smoothstep(x, 18, 26)) + 0.11);
    // 강 머리 물가: 가운데가 가장 깊이(x 26.3) 들어온 둥근 꼴 + 잔 굴곡 — 강 메쉬의 곧은 끝(x 26)을 덮고 그 밖은 물 밑으로
    const shore = 26.3 + 2.2 * (z / 16.5) ** 2 + 0.3 * Math.sin(z * 1.1 + 0.4);
    const dip = THREE.MathUtils.smoothstep(x, shore - 0.25, shore + 0.45) * 0.45;
    return [x, WATER_Y - 0.045 + lift - dip, z];
  }, true);
  const ground = K.put('banks', g, 0x737d66, undefined, undefined, 1, { noise: 0.013, vary: 0 });
  const pos = ground.attributes.position, col = ground.attributes.color, c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), patch = Math.sin(x * 0.09 + Math.sin(z * 0.13) * 1.6);
    const a = Math.atan2(z / 0.94, x), r = Math.hypot(x, z / 0.94);
    c.set(0x969888).lerp(new THREE.Color(0x4f713b), 0.44 + patch * 0.38);
    c.multiplyScalar(0.62 + 0.38 * THREE.MathUtils.smoothstep(r - restRim(a), 0.5, 6)); // 절벽 밑 그늘
    col.setXYZ(i, c.r, c.g, c.b);
  }
}

function lowRiverbanks(K) {
  const r=rng(263971);let shrubs=0,stones=0;
  for(const side of [-1,1]) for(let i=0;i<38;i++) {
    const x=37+i*7.5+r()*5;
    // Most scrub follows the escarpment foot, leaving the inner sight corridor
    // low. Small pale rocks interrupt the shoreline instead of outlining it.
    const v=0.76+r()*0.20, base=bankPoint(x,v,side), size=1.1+r()*2.2;
    for(let j=0;j<2;j++) {
      K.put('needles',pineCrown(size*(j?0.65:1),0.55+r()*0.3,i+j),j?0x4c703c:0x426638,
        [base[0]+j*size*0.64,base[1]+0.15,base[2]+j*side*size*0.28],[0,r()*TAU,0],1,{noise:0.025,vary:0.18});shrubs++;
    }
    if(i%2===0) {
      const p=bankPoint(x+2,0.04+r()*0.2,side);
      K.put('outcrops',new THREE.DodecahedronGeometry(1,0),0xa6a99c,
        [p[0],p[1]-0.15,p[2]],[0.1,r()*TAU,0.14],[0.7+r()*1.8,0.25+r()*0.32,0.6+r()*1.1],{noise:0.045,vary:0.13});stones++;
    }
  }
  return {bankShrubs:shrubs,bankStones:stones};
}

function greatRiver(K) {
  const placed = K.put('river', geometryGrid(208, 10, (u, v) => {
    const x = 26 + u * 409;
    return [x, WATER_Y, riverZ(x) + (v * 2 - 1) * riverHalfWidth(x)];
  }, true), 0x377f79, undefined, undefined, 1, { noise: 0, vary: 0 });
  const p = placed.attributes.position, c = placed.attributes.color;
  const deep = new THREE.Color(0x367d77), jade = new THREE.Color(0x77ae9c), haze = new THREE.Color(0x9db9b5), color = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const edge = Math.abs(z - riverZ(x)) / riverHalfWidth(x);
    color.copy(deep).lerp(jade, 0.14 + edge * edge * 0.29 + Math.sin(x * 0.09 + z * 0.11) * 0.05);
    color.lerp(haze, THREE.MathUtils.smoothstep(x, 170, 440) * 0.35);
    c.setXYZ(i, color.r, color.g, color.b);
  }
  const r = rng(641083);
  for (let i = 0; i < 64; i++) {
    const x = 42 + r() * 345, z = riverZ(x) + (r() - 0.5) * riverHalfWidth(x) * 1.56;
    const width = 0.45 + r() * 2.8, length = 0.04 + r() * 0.075;
    K.put('glints', geometryGrid(1, 1, (u, v) => [x + (u - 0.5) * length, WATER_Y + 0.016, z + (v - 0.5) * width], true),
      0xb3c9b1, undefined, undefined, 1, { vary: 0.18, noise: 0 });
  }
  return { x: 48, y: WATER_Y, z: riverZ(48) };
}

// ② (우리 판) 바위 밑동: 샛별 판은 밑 고리가 바위 키의 0.36 배 아래에서 끝나고 바위와 풀밭이 같은 빛으로 칼같이 만나, 멀리서 보면 언덕 위에 떠 보였다(리뷰 10/10 §2-2 ②).
//  밑으로 한 고리 더(1.05 배 아래까지 조금 넓게) 이어 붙이고 바위 키의 0.28 배 더 묻어, 땅이 옆면을 비탈 따라 자르게 했다. 땅에 닿는 띠는 이끼·흙빛으로 어둡게(0.5 배 → 위로 밝게),
//  밑동에 걸친 낮은 덤불 둘(능선 덤불과 같은 꼴), 둘레 땅은 contactShade 가 어둡게 한다. 바위 자리·크기·기울기는 샛별 판 그대로 [사장님 확인 전 — 확인표 1820]
const CONTACTS = []; // 바위 밑동 [x, y, z, 발자국 반지름] — contactShade 가 둘레 땅을 어둡게
const PINES = []; // 능선 소나무 자리 [x, d, side] — hillOutcrops 가 비켜 간다
const ROCK_FOOT = new THREE.Color(0x56603f); // 밑동 이끼·흙빛
function seatedRock(K, x, d, side, rot, scale, seed, color, opt, stretch = [1, 1, 1]) {
  const base = terrainPoint(x, d, side);
  // A bedded angular slab, partially buried in its ridge. Its long front and
  // split, leaning top read as an exposed outcrop rather than a round boulder.
  const ring = [[-1,-0.75],[-0.15,-1],[0.9,-0.65],[1,0.25],[0.25,0.82],[-0.9,0.7]];
  const positions = [], top = [], lower = [], buried = [];
  for (let i = 0; i < ring.length; i++) {
    const [a,b] = ring[i];
    buried.push([a * scale * 1.3, -scale * 1.05, b * scale * 0.7]);
    lower.push([a * scale * 1.2, -scale * 0.36, b * scale * 0.64]);
    top.push([a * scale * 0.8 + scale * 0.13, scale * (0.52 + Math.sin(i * 1.7 + seed) * 0.19), b * scale * 0.53]);
  }
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    positions.push(...buried[i], ...lower[i], ...buried[j], ...buried[j], ...lower[i], ...lower[j]);
    positions.push(...lower[i], ...top[i], ...lower[j], ...lower[j], ...top[i], ...top[j]);
    positions.push(...top[i], 0, scale * 0.63, 0, ...top[j]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));g.computeVertexNormals();
  const h = scale * stretch[1], sink = 0.28 * h; // 바위 키의 0.28 배 더 묻는다 — 땅이 옆면을 비탈 따라 들쭉날쭉 자르게(받침에 앉은 판이 아니라 땅에서 솟은 바위)
  const placed = K.put('outcrops', g, color, [base[0], base[1] - sink, base[2]], rot, stretch, opt);
  const p = placed.attributes.position, c = placed.attributes.color, tone = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const yl = p.getY(i) - base[1]; // 땅(바위 가운데 땅 높이) 기준
    const k = 0.5 + 0.5 * THREE.MathUtils.smoothstep(yl, -0.2 * h, 0.45 * h);
    tone.setRGB(c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k).lerp(ROCK_FOOT, 0.45 * (1 - THREE.MathUtils.smoothstep(yl, -0.05 * h, 0.2 * h)));
    c.setXYZ(i, tone.r, tone.g, tone.b);
  }
  // 밑동에 걸친 낮은 덤불 둘: 바위 발자국(돌린 타원) 가장자리, 땅 위 (난수는 바위마다 따로 — 다른 자리의 난수 순서를 건드리지 않는다)
  const r = rng(70001 + Math.round(seed * 131) + (side > 0 ? 7 : 0)), yaw = rot[1];
  for (let k = 0; k < 2; k++) {
    const t = r() * TAU, lx = Math.cos(t) * scale * 1.0 * stretch[0], lz = Math.sin(t) * scale * 0.6 * stretch[2];
    const dx = lx * Math.cos(yaw) + lz * Math.sin(yaw), dz = -lx * Math.sin(yaw) + lz * Math.cos(yaw);
    const at = terrainPoint(x + dx, d + side * dz, side), size = 0.55 + r() * 0.5;
    K.put('needles', pineCrown(size, 0.6 + r() * 0.3, seed + k), k ? 0x4c703c : 0x426638, [at[0], at[1] + 0.22, at[2]], [0, r() * TAU, 0], 1, { noise: 0.025, vary: 0.18 });
  }
  CONTACTS.push([base[0], base[1], base[2], scale * 1.2 * Math.max(stretch[0], stretch[2])]);
}
function ridgeRock(K, x, d, side, scale, seed) {
  seatedRock(K, x, d, side, [0.05, seed * 0.2, side * 0.06], scale, seed, 0xa7aca3, { noise: 0.045, vary: 0.12 });
}
// ② (우리 판) 덩어리로만 읽히던 가까운 언덕 비탈(능선 안쪽 면 d 14~44 m, x −6~100 m)에 반쯤 묻힌 바위 몇 개 — 넓적한 것과 모난 것을 섞어.
//  새 난수 씨앗이라 샛별 판의 소나무·바위·덤불 자리는 바뀌지 않는다. 소나무 둘레(3.5 m + 바위 크기) · 오른쪽 능선 돌계단 길은 비켜 간다 [확인표 1821]
function hillOutcrops(K) {
  const r = rng(551237);let n = 0;
  for (const side of [-1, 1]) for (let k = 0; k < 8; k++) {
    const x = -6 + k * 14 + r() * 6, d = 14 + r() * 30, scale = 2 + r() * 2.4, flat = r() < 0.5;
    const rot = [(r() - 0.5) * 0.14, r() * TAU, (r() - 0.5) * 0.14], seed = 40 + k + side * 7;
    if (side > 0 && x > 88 && d < 27) continue; // 돌계단 길 (hillsidePath: x 96~131, d 14.5~24)
    if (PINES.some(([px, pd, ps]) => ps === side && Math.hypot(px - x, pd - d) < 3.5 + scale * 0.8)) continue;
    seatedRock(K, x, d, side, rot, scale, seed, flat ? 0xa9ada3 : 0x9fa59c, { noise: 0.05, vary: 0.1 }, flat ? [1.5, 0.55, 1.2] : [1, 1, 1]);
    n++;
  }
  return n;
}
/** ② (우리 판) 바위 밑동 둘레 땅을 어둡게: 발자국 반지름 R 의 0.9 배 안은 −34 %, 1.5 배까지 옅어진다 (꼭짓점 색 — 그리기 호출 그대로) */
function contactShade(K) {
  for (const bin of ['mountains', 'banks']) for (const g of K.bins[bin] ?? []) {
    const p = g.attributes.position, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      let k = 1;
      for (const [cx, cy, cz, R] of CONTACTS) {
        const dx = x - cx, dz = z - cz;
        if (Math.abs(dx) > R * 1.5 || Math.abs(dz) > R * 1.5 || Math.abs(p.getY(i) - cy) > R * 1.5) continue;
        k = Math.min(k, 1 - 0.34 * (1 - THREE.MathUtils.smoothstep(Math.hypot(dx, dz), R * 0.9, R * 1.5)));
      }
      if (k < 1) c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
    }
  }
}

function pineCrown(radius, depth, seed) {
  const segments = 11, positions = [];
  const rim = [];
  for (let i = 0; i < segments; i++) {
    const a = i / segments * TAU;
    const r = radius * (0.81 + 0.14 * Math.sin(i * 2.3 + seed) + 0.1 * Math.cos(i * 4.1));
    rim.push([Math.cos(a) * r, -depth * (0.35 + 0.19 * Math.sin(i * 3.1 + seed)), Math.sin(a) * r]);
  }
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    positions.push(0, depth * 0.5, 0, ...rim[j], ...rim[i]);
    positions.push(0, -depth * 0.73, 0, ...rim[i], ...rim[j]);
  }
  const g = new THREE.BufferGeometry();g.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();
  return g;
}

function ridgePine(K, r, base, height) {
  const lean = (r() - 0.5) * height * 0.32, twist = r() * TAU;
  K.push(base, twist);
  limb(K, 'wood', [0,-0.15,0], [lean * 0.55,height * 0.64,0.1], height * 0.035, height * 0.022, 0x5a6252, {noise:0.03}, 6);
  limb(K, 'wood', [lean * 0.55,height * 0.64,0.1], [lean,height,0], height * 0.023, height * 0.009, 0x5a6252, {noise:0.03}, 5);
  for (let j = 0; j < 3; j++) {
    const a = j * 2.5 + r(), spread = height * (j === 2 ? 0.11 : 0.26);
    const y = height * (0.58 + j * 0.19);
    const tip = [Math.cos(a) * spread + lean * y / height, y + height * 0.07, Math.sin(a) * spread];
    limb(K, 'wood', [lean * y / height,y - height * 0.05,0], tip, height * 0.018, height * 0.007, 0x5a6252, {}, 5);
    K.put('needles', pineCrown(height * (0.29 - j * 0.038), height * 0.13, r() * 10), j === 1 ? 0x3e5c3b : 0x345139,
      tip, [0, r() * TAU, 0], [1.15,1,0.83], { noise:0.035, vary:0.13 });
  }
  K.pop();
}

function rockyPineRidges(K) {
  const r = rng(990371);let pines = 0, rocks = 0;
  for (const side of [-1,1]) {
    for (let i = 0; i < 20; i++) {
      const x = -12 + i * 9.6 + r() * 5, d = 28 + (r() - 0.5) * 6;
      const base = terrainPoint(x,d,side);
      ridgePine(K,r,base,3.1 + r() * 3.4);pines++;PINES.push([x,d,side]);
      if(i % 3 === 0) { ridgeRock(K,x + 4,d + 1.2,side,3.2 + r() * 3.9,i + side);rocks++; }
    }
    for(let i=0;i<7;i++) {
      const x=44+i*19+r()*5,d=50+r()*11;
      ridgePine(K,r,terrainPoint(x,d,side),3.8+r()*3.2);pines++;PINES.push([x,d,side]);
    }
  }
  return {pines,rocks};
}

function hillsidePath(K) {
  const positions=[],rails=[];
  const count=28;
  const route=t=>({x:96+t*35,d:14.5+9.5*t*t});
  const quad=(a,b,c,d)=>positions.push(...a,...b,...c,...a,...c,...d);
  for(let i=0;i<count;i++) {
    const a=route(i/count),b=route((i+1)/count);
    const corners=[terrainPoint(a.x,a.d-0.76,1),terrainPoint(b.x,b.d-0.76,1),
      terrainPoint(b.x,b.d+0.76,1),terrainPoint(a.x,a.d+0.76,1)];
    const y=Math.max(...corners.map(p=>p[1]))+0.14;
    const top=corners.map(p=>[p[0],y,p[2]]);
    const base=corners.map(p=>[p[0],p[1]-0.22,p[2]]);
    quad(top[0],top[3],top[2],top[1]);
    for(let j=0;j<4;j++){const k=(j+1)%4;quad(base[j],top[j],top[k],base[k]);}
    if(i%4===0||i===count-1) {
      const p=terrainPoint((a.x+b.x)*0.5,(a.d+b.d)*0.5+0.74,1);
      const height=y-p[1]+0.64;
      K.put('outcrops',box(0.18,height+0.18,0.18),0xb9beb0,[p[0],p[1]+height/2-0.09,p[2]],undefined,1,{noise:0.02,vary:0.07});
      rails.push([p[0],y+0.50,p[2]]);
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();
  K.put('outcrops',g,0xc2c4b5,undefined,undefined,1,{noise:0.025,vary:0});
  for(let i=1;i<rails.length;i++)limb(K,'outcrops',rails[i-1],rails[i],0.065,0.065,0xb7bcae,{noise:0.018,vary:0.04},4);
  return count;
}

export function buildQinglanVista(scene) {
  const K = new VistaKit(375183);
  CONTACTS.length = 0;PINES.length = 0;
  canyonSides(K);
  const riverPos = greatRiver(K);
  const details = {...rockyPineRidges(K),...lowRiverbanks(K)};
  details.hillsideSteps=hillsidePath(K);
  restFoot(K); // ⑤ (우리 판)
  details.hillOutcrops=hillOutcrops(K);contactShade(K); // ② (우리 판)
  const stoneMap=stoneTexture();
  const materials = {
    mountains:new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,map:stoneMap}),
    banks:new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),
    outcrops:new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true,map:stoneMap}),
    wood:new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),
    needles:new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true}),
    river:new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.39,metalness:0.04}),
    glints:new THREE.MeshBasicMaterial({vertexColors:true}),
  };
  const stats = {meshes:0,triangles:0,minSceneryRadius:Infinity,riverY:WATER_Y,...details,
    continuousRidges:2,riverLength:409,riverWidth:[23,35],style:'great-river-gorge'};
  for(const [bin,material] of Object.entries(materials)) {
    const mesh=K.mesh(bin,material,{cast:false,receive:bin==='outcrops'||bin==='wood'});
    if(!mesh){material.dispose();continue;}
    mesh.name=`qinglan-vista-${bin}`;
    if(bin==='mountains'||bin==='outcrops')boxUV(mesh.geometry,0.08);
    mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
    const p=mesh.geometry.attributes.position;stats.meshes++;stats.triangles+=(mesh.geometry.index?.count??p.count)/3;
    for(let i=0;i<p.count;i++)stats.minSceneryRadius=Math.min(stats.minSceneryRadius,Math.hypot(p.getX(i),p.getZ(i)));
    scene.add(mesh);
    for(const source of K.bins[bin])source.dispose();delete K.bins[bin];
  }
  return {stats,riverPos};
}
