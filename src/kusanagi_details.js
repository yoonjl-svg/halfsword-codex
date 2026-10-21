// 쿠사나기: 승인된 신화 시안의 창작 외형. 실제 신기 복원 아님.
// 물리 부품/질량은 weapons.js, 여기서는 기존 swordKit 기반 시각 요소만 만든다.
import * as THREE from 'three';
import { swordKit, metalMat } from './weapon_looks.js';

export const KUSANAGI_COLORS = { blade: 0xc0d7d3, grip: 0x204d49, gold: 0xb49b60 };
const width = t => 0.86 + 0.14 * Math.sin(Math.PI * t) - 0.15 * t;
const bladeKit = swordKit({ blade: { edge: 'double', width, thick: 0.0035,
  tip: 'spear', tipLen: 0.115, overshoot: 0, bevel: 0.0035,
  fuller: { to: 0.81, width: 0.28, depth: 0.4 } } });

function add(group, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z); mesh.castShadow = true; group.add(mesh);
  return mesh;
}
function plate(points, depth) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 3 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}
function bead(group, metal) {
  const outer = add(group, new THREE.CylinderGeometry(0.024, 0.024, 0.012, 10), metal);
  outer.rotation.x = Math.PI / 2; outer.scale.z = 1.17;
  for (const side of [-1, 1]) {
    const inset = add(group, new THREE.CircleGeometry(0.018, 12), metalMat(0x244943, { rough: 0.5, side: THREE.DoubleSide }), 0, 0, side * 0.0062);
    inset.scale.y = 1.17;
    // 곡옥: 둥근 머리에서 가늘어지는 꼬리, 양면에 같은 세공.
    const sh = new THREE.Shape();
    sh.moveTo(-0.003, 0.013);
    sh.bezierCurveTo(0.012, 0.016, 0.013, 0.003, 0.004, -0.002);
    sh.bezierCurveTo(0.002, -0.009, -0.006, -0.014, -0.013, -0.009);
    sh.quadraticCurveTo(-0.003, -0.010, -0.003, -0.001);
    sh.bezierCurveTo(-0.012, 0.003, -0.011, 0.011, -0.003, 0.013);
    const jade = add(group, new THREE.ExtrudeGeometry(sh, { depth: 0.0015, bevelEnabled: false, curveSegments: 3 }),
      metalMat(0x559784, { rough: 0.34, metal: 0.12 }), 0, 0, side * 0.0064);
    if (side < 0) jade.rotation.y = Math.PI;
    add(group, new THREE.CircleGeometry(0.0018, 6), metalMat(0x18352f, { side: THREE.DoubleSide }), side * 0.001, 0.008, side * 0.0081);
  }
}

export function kusanagiPartMesh(index, isBlade, shape, color, opts, look, tier) {
  if (isBlade) return bladeKit(index, isBlade, shape, color, opts, look, tier);
  const group = new THREE.Group();
  const gold = metalMat(KUSANAGI_COLORS.gold, { rough: 0.4 });
  if (index === 0) {
    const grip = add(group, new THREE.CylinderGeometry(0.014, 0.015, 0.30, 8),
      new THREE.MeshStandardMaterial({ color: KUSANAGI_COLORS.grip, roughness: 0.88 }));
    grip.scale.z = 1.15;
    // 교차 끈은 양면에서 읽히되 자루를 굵게 만들지 않는다.
    const silk = new THREE.MeshStandardMaterial({ color: 0x316c63, roughness: 0.92 });
    for (const side of [-1, 1]) for (let y = -0.13; y < 0.14; y += 0.025) for (const sign of [-1, 1]) {
      const strip = add(group, new THREE.BoxGeometry(0.004, 0.034, 0.001), silk, 0, y, side * 0.0173);
      strip.rotation.z = sign * 0.8;
    }
    for (const y of [-0.15, 0.15]) {
      const collar = add(group, new THREE.CylinderGeometry(0.017, 0.017, 0.012, 8), gold, 0, y);
      collar.scale.z = 1.12;
    }
  } else if (index === 1) bead(group, gold);
  else if (index === 2) {
    const leaf = [[0.008,-0.012],[0.029,-0.010],[0.045,0.004],[0.06,0.028],
      [0.065,0.036],[0.045,0.024],[0.025,0.020],[0.011,0.008]];
    for (const side of [-1, 1]) {
      add(group, plate(leaf.map(([x,y]) => [side*x,y]), 0.011), gold);
      const inlay = leaf.map(([x,y]) => [side*(0.028+(x-0.028)*0.72), 0.008+(y-0.008)*0.56]);
      for (const face of [-1, 1]) add(group, plate(inlay, 0.0005), metalMat(0x35645a, { rough: 0.48 }), 0, 0, face * 0.0058);
    }
    add(group, new THREE.BoxGeometry(0.036, 0.024, 0.023), gold);
  }
  return group;
}

export function kusanagiDecorate(group) {
  const h = this.hiltLength, L = this.bladeLength;
  const gold = metalMat(KUSANAGI_COLORS.gold, { rough: 0.4 });
  add(group, new THREE.BoxGeometry(0.033, 0.023, 0.010), gold, 0, h + 0.0115);
  // 피홈 바닥의 녹청색. 칼 전체 발광·별도 이펙트는 쓰지 않는다.
  const verts = [];
  for (const side of [-1, 1]) for (let i = 0; i < 20; i++) {
    const point = (n, edge) => {
      const t = 0.08 + 0.70 * n / 20;
      const fade = Math.max(0, Math.min(1, (0.81-t)/0.08));
      const w = 0.0205 * width(t) * 0.28 * 0.7 * fade * Math.min(1,(t-0.08)/0.05);
      return [edge*w, h+t*L, side*(0.0035*(1-0.35*t)*(1-0.4*fade)+0.00008)];
    };
    const a=point(i,-1), b=point(i,1), c=point(i+1,1), d=point(i+1,-1);
    verts.push(...a,...b,...c,...a,...c,...d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts,3)); geometry.computeVertexNormals();
  add(group, geometry, metalMat(0x4b7971, { rough: 0.48, metal: 0.5, side: THREE.DoubleSide }));
}
