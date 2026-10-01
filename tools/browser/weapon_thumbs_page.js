// ─────────────────────────────────────────────────────────────
//  무기 카드 그림: weapons.js 의 무기 모델을 fighter.js 와 똑같이 조립해서(buildParts → partMesh → decorate)
//  칼을 대각선으로 눕혀(칼끝이 오른쪽 위) 한 장씩 찍는다. 배경은 투명, 256×256 webp.
//  모든 무기를 같은 틀에 꽉 차게 맞춘다 (칼 길이와 상관없이 대각선 길이가 같다).
//  ?ids=longsword,estoc 으로 몇 개만 찍을 수 있다. 결과는 window.thumbs = { done, list: [{ id, url, bytes }] }
//  구도·빛 시험용: ?tx=-0.45 (앞으로 숙이기, rad) ?ty=0.45 (칼날 축으로 돌리기, rad) ?shine=1.0 (칼몸에 윤을 내는 빛 세기)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { WEAPONS, weaponMatOpts } from '../../src/weapons.js';
import { LOOKS } from '../../src/looks.js';

const SIZE = 256; // 저장 크기 (카드에는 폰 약 60~110px, PC 약 210px 로 보인다 → 폰 레티나 2배까지 선명)
const SS = 2; // 두 배로 그린 뒤 줄여서 가장자리를 곱게
const QUALITY = 0.86; // webp 품질 (한 장 20KB 아래가 목표)
const PAD = 0.07; // 틀 가장자리 여백 (비율)

const params = new URLSearchParams(location.search);
const ids = params.get('ids') ? params.get('ids').split(',') : Object.keys(WEAPONS);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE * SS, SIZE * SS);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
// 게임 장면과 같은 빛 (흐린 하늘 + 누그러진 해) — 카드 앞쪽 위에서 비춘다
scene.add(new THREE.HemisphereLight(0xe3e6e8, 0x716c63, 1.3));
const key = new THREE.DirectionalLight(0xffe7cb, 1.8);
key.position.set(-2, 4, 6);
scene.add(key);
const rim = new THREE.DirectionalLight(0xc8d4e0, 0.6); // 어두운 카드 위에서 윤곽이 살게 뒤쪽 오른편에서 살짝
rim.position.set(3, -1, -2);
scene.add(rim);
// 칼몸 넓은 면에 윤이 흐르게: 카메라 쪽에서 비춰 강철 면이 번쩍이게 한다 (시험값은 ?shine=)
const shine = new THREE.DirectionalLight(0xffffff, +(params.get('shine') ?? 1.0));
shine.position.set(0.5, 0.2, 1).multiplyScalar(5);
scene.add(shine);

// fighter.js shapeMesh 와 같은 기본 부품 (partMesh 가 따로 그리지 않는 부품)
function shapeMesh(s, color, matOpts) {
  let geo;
  if (s[0] === 'box') geo = new THREE.BoxGeometry(s[1] * 2, s[2] * 2, s[3] * 2);
  else if (s[0] === 'ball') geo = new THREE.SphereGeometry(s[1], 16, 12);
  else geo = new THREE.CapsuleGeometry(s[2], s[1] * 2, 4, 10);
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...(matOpts || {}) }));
}

/** fighter.js 의 무기 조립과 같은 순서로 무기 한 자루를 만든다 (주인공 look: 손잡이·코등이 색) */
function buildWeapon(spec, look) {
  const group = new THREE.Group();
  const finish = spec.finishTier ?? spec.tier;
  spec.buildParts(look).forEach(([shape, y, , color, isBlade], pi) => {
    const opts = weaponMatOpts(spec.material, isBlade, finish);
    const mesh = spec.partMesh?.(pi, isBlade, shape, color ?? 0x888888, opts, look, finish) ?? shapeMesh(shape, color ?? 0x888888, opts);
    mesh.position.y = y;
    mesh.visible = color != null;
    group.add(mesh);
  });
  spec.decorate?.(group, look);
  return group;
}

/** 보이는 메쉬만으로 경계 상자 (물리 전용으로 숨긴 부품은 뺀다) */
function visibleBox(root) {
  const box = new THREE.Box3();
  root.updateMatrixWorld(true);
  const walk = (o) => {
    if (!o.visible) return;
    if (o.isMesh) box.expandByObject(o);
    for (const c of o.children) walk(c);
  };
  walk(root);
  return box;
}

const small = document.createElement('canvas');
small.width = small.height = SIZE;
const ctx2d = small.getContext('2d');
ctx2d.imageSmoothingEnabled = true;
ctx2d.imageSmoothingQuality = 'high';

const list = [];
for (const id of ids) {
  const spec = WEAPONS[id];
  if (!spec) continue;
  const weapon = buildWeapon(spec, LOOKS.player);
  // 칼끝이 오른쪽 위로 가게 45° 눕히고, 칼날 축으로 살짝 돌리고 앞으로 조금 숙여 날 세움 면·두께가 보이게 한다
  const holder = new THREE.Group();
  holder.add(weapon);
  weapon.rotation.set(+(params.get('tx') ?? -0.45), +(params.get('ty') ?? 0.45), 0); // 칼날 축(y)으로 먼저 돌리고 → x 로 숙인다
  holder.rotation.z = -Math.PI / 4;
  scene.add(holder);
  const box = visibleBox(holder);
  const c = box.getCenter(new THREE.Vector3());
  const sz = box.getSize(new THREE.Vector3());
  // spec.thumbScale: 실제로 짧은 무기(권총)는 칸을 가득 채우지 않고 이 비율로 작게 (틀·여백은 다른 무기와 같다)
  const half = ((Math.max(sz.x, sz.y) / 2) * (1 + PAD * 2)) / (spec.thumbScale ?? 1);
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, 20);
  cam.position.set(c.x, c.y, c.z + 5);
  cam.lookAt(c);
  renderer.render(scene, cam);
  ctx2d.clearRect(0, 0, SIZE, SIZE);
  ctx2d.drawImage(renderer.domElement, 0, 0, SIZE, SIZE);
  const url = small.toDataURL('image/webp', QUALITY);
  list.push({ id, url, bytes: Math.round(((url.length - url.indexOf(',') - 1) * 3) / 4) });
  scene.remove(holder);
  const fig = document.createElement('figure');
  const img = document.createElement('img');
  img.src = url;
  const cap = document.createElement('figcaption');
  cap.textContent = `${spec.nameKo} (${id})`;
  fig.append(img, cap);
  document.getElementById('out').append(fig);
}
window.thumbs = { done: true, list };
