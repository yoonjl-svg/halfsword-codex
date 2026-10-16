// 미나미의 신목의 숲 (sacred pine grove). The level is visual only: the existing flat arena
// and camera remain authoritative. All trunks, roots, gates and large rocks stay
// outside the 10.5m camera orbit; the 6.5m fighting floor has only flush stones.
import * as THREE from 'three';
import { ARENA } from './config.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, h3, Kit, canvasTex, UP } from './stage_kit.js';

const TAU = Math.PI * 2;
const HERO = { x: 21, z: -3 };
const PINE_HEIGHT = 21, PINE_RADIUS = 2.55;
// 숲 대기 (10/11 6월 오후 3~4 시): 선형 안개 22~88 m. 싸우는 자리·가까운 숲(22 m 안)은 맑고, 신목(카메라에서 약 30 m)은
//  약 12 %, 60 m 약 58 %, 75 m 약 80 %, 88 m 밖은 안개색 그대로 → 78 m 밖에는 나무를 심지 않는다(그리기 양).
//  예전 지수 안개(0.019, 회녹색)는 가까운 곳부터 고르게 흐려 신목 실루엣까지 한 톤에 묻혔다. 땅에 깔린 물안개도 걷었다.
//  싸움꾼 재질은 안개를 받지 않는다(fighter_light.js). 하늘은 지평선 안개색 → 위로 맑은 하늘, 해 쪽은 따뜻하게 (afternoonSky)
const GROVE_FOG = { color: 0xc6d1c0, near: 22, far: 88, sky: 0xc6d1c0 };
// 6월 오후 해: 서쪽(경기 카메라 기준 왼쪽 조금 뒤)에서 고도 약 40°로 비스듬히. 그림자는 한낮보다 길게 옆으로 눕는다
const SUN_OFFSET = { x: -4.5, y: 8.8, z: -9.5 };
const C = {
  // 결투장 흙 (10/11): 베이지 흙(0xd3cbb1)에 솔잎 깔림·이끼를 섞어 한 단계 어둡게 → 크림색 옷이 뜬다
  earth: 0xb3a47f, litter: 0x8e7653, floorMoss: 0x6f7d48,
  moss: 0x6b8a58, deepMoss: 0x41664a,
  stone: 0x96a399, bark: 0x927a60, barkDark: 0x645f52,
  // 6월 잎색: 청록 대신 푸릇한 초록, 새순(밝은 연두)
  leaf: 0x4b7a4c, leafLit: 0x9db272, leafDeep: 0x2e573f,
  // 적송(赤松): 줄기 아래는 어두운 회갈색, 위로 갈수록 붉은 갈색. 잎은 짙은 초록 (10/10 소나무 작업, 10/11 6월 잎색)
  pineFoot: 0x4a4038, pineRed: 0xb4643f, needle: 0x3a6f4f, needleLit: 0x6c9758, needleDeep: 0x2a5442,
  rope: 0xd1bf8e, paper: 0xf3f0dc, vermilion: 0xa54f38, lantern: 0x959b8c,
};

function barkTexture() {
  const r = rng(913);
  return canvasTex(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#c9c5b8'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 360; i++) {
      const x = r() * w, y = r() * h;
      ctx.strokeStyle = `rgba(${r() < 0.62 ? '50,50,39' : '247,244,220'},${0.08 + r() * 0.26})`;
      ctx.lineWidth = 0.45 + r() * 2.3;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + r() * 7, y + 30, x - r() * 8, y + 70, x + (r() - 0.5) * 12, y + 35 + r() * 190); ctx.stroke();
    }
    for (let i = 0; i < 15; i++) {
      const px = i / 15 * w + r() * 5, py = r() * h;
      ctx.strokeStyle = 'rgba(43,39,29,0.26)'; ctx.lineWidth = 2 + r() * 3.5;
      ctx.beginPath(); ctx.moveTo(px, py - h * 0.6); ctx.bezierCurveTo(px - 5, py - 80, px + 6, py + 10, px - 3, py + h * 0.45); ctx.stroke();
      ctx.strokeStyle = 'rgba(252,239,211,0.2)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(px + 2, py - h * 0.6); ctx.lineTo(px - 1, py + h * 0.45); ctx.stroke();
    }
    for (let i = 0; i < 1300; i++) {
      ctx.fillStyle = `rgba(39,44,34,${r() * 0.12})`;
      ctx.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 15);
    }
  });
}

function heroBarkTexture(bark) {
  return canvasTex(256, 512, (ctx, w, h) => {
    ctx.drawImage(bark.image, 0, 0, w, h);
    const ropeY = (1 - 2.87 / PINE_HEIGHT) * h;
    ctx.fillStyle = 'rgba(38,32,21,0.38)'; ctx.fillRect(0, ropeY, w, 2.8);
    ctx.fillStyle = 'rgba(38,32,21,0.12)'; ctx.fillRect(0, ropeY + 2.8, w, 2);
    for (let n = 0; n < 5; n++) {
      const a = Math.PI * 0.57 + n * Math.PI * 0.22, px = a / TAU * w + 1.5, py = (1 - 2.51 / PINE_HEIGHT) * h;
      ctx.strokeStyle = 'rgba(37,33,22,0.4)'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 2.2, py + 3.5); ctx.lineTo(px + 0.6, py + 6); ctx.lineTo(px + 2.8, py + 9); ctx.lineTo(px + 0.8, py + 14); ctx.stroke();
    }
  });
}

function soilTexture() {
  const r = rng(702);
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d8d6ca'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 4100; i++) {
      const v = 90 + Math.floor(r() * 150);
      ctx.fillStyle = `rgba(${v},${v},${v},${0.12 + r() * 0.3})`;
      ctx.fillRect(r() * w, r() * h, 0.4 + r() * 2.2, 0.4 + r() * 1.5);
    }
    for (let i = 0; i < 38; i++) {
      ctx.strokeStyle = 'rgba(74,72,56,0.1)'; ctx.lineWidth = 0.6;
      const x = r() * w, y = r() * h;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 5 + r() * 10, y + (r() - 0.5) * 9); ctx.stroke();
    }
  });
}

// 결투장·숲 바닥 질감 (10/11): 흙 알갱이 위에 떨어진 솔잎(가늘고 짧은 붉은 갈색·검은 획)과 작은 이끼 점.
//  한 장 = 약 2.9 m 라 솔잎 한 개가 6~9 cm. 바닥 색은 정점 색이 정하고 질감은 결만 준다 (돌은 soilTexture 그대로)
function floorTexture() {
  const r = rng(7031);
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d2cfc2'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = 95 + Math.floor(r() * 140);
      ctx.fillStyle = `rgba(${v},${v - 4},${v - 14},${0.12 + r() * 0.26})`;
      ctx.fillRect(r() * w, r() * h, 0.5 + r() * 2, 0.5 + r() * 1.4);
    }
    for (let i = 0; i < 260; i++) { // 이끼 점: 둥근 초록 얼룩
      ctx.fillStyle = `rgba(${70 + r() * 30},${96 + r() * 34},${48 + r() * 18},${0.1 + r() * 0.2})`;
      ctx.beginPath(); ctx.arc(r() * w, r() * h, 0.8 + r() * 2.6, 0, TAU); ctx.fill();
    }
    for (let i = 0; i < 1500; i++) { // 솔잎: 마른 붉은 갈색이 많고 검은 것·바랜 것이 섞인다
      const x = r() * w, y = r() * h, a = r() * TAU, len = 5 + r() * 5, k = r();
      ctx.strokeStyle = k < 0.55 ? `rgba(122,74,40,${0.3 + r() * 0.35})` : k < 0.8 ? `rgba(52,40,28,${0.25 + r() * 0.3})` : `rgba(226,204,160,${0.2 + r() * 0.25})`;
      ctx.lineWidth = 0.6 + r() * 0.5;
      for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
        ctx.beginPath(); ctx.moveTo(x + dx, y + dy); ctx.quadraticCurveTo(x + dx + Math.cos(a + 0.3) * len * 0.5, y + dy + Math.sin(a + 0.3) * len * 0.5, x + dx + Math.cos(a) * len, y + dy + Math.sin(a) * len); ctx.stroke();
      }
    }
  });
}

// Low undergrowth cushions (the forest crowns now use cloudPadGeometry below). The
// undersides are dark and open space remains below every horizontal branch tier.
function canopyGeometry(detailed) {
  const g=new THREE.IcosahedronGeometry(1,detailed?1:0),p=g.attributes.position,colors=[];
  for(let i=0;i<p.count;i++) { const x=p.getX(i),y=p.getY(i),z=p.getZ(i),f=0.92+h3(x,y,z,817)*0.13;p.setXYZ(i,x*f,y*(y>0?0.36:0.22),z*f); }
  g.computeVertexNormals();
  for(let i=0;i<p.count;i++) { const ny=g.attributes.normal.getY(i),light=0.79+Math.max(0,ny)*0.21;colors.push(light,light,light); }
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return g;
}

// 적송의 잎 덩어리: 납작한 다면체 여러 개를 구름처럼 뭉쳐 한 모양으로 합친다. 가운데가 두툼하고
// 가장자리는 울퉁불퉁하며 아랫면은 판판하고 어둡다(정점 색). 덩어리 하나 = 그리기 한 번(인스턴스).
function cloudPadGeometry(seed, detail, lumps) {
  const r = rng(seed), parts = [];
  const add = (x, y, z, sx, sy, sz) => {
    const g = detail < 0 ? new THREE.OctahedronGeometry(1, 0) : new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position, k = parts.length;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), py = p.getY(i), pz = p.getZ(i), f = 0.86 + h3(px, py, pz, 311 + seed + k) * 0.28;
      p.setXYZ(i, x + px * f * sx, y + py * (py < 0 ? 0.45 : 1) * f * sy, z + pz * f * sz);
    }
    parts.push(g);
  };
  add(0, 0.05, 0, 0.62, 0.3, 0.6);
  for (let i = 0; i < lumps - 2; i++) {
    const a = i / (lumps - 2) * TAU + (r() - 0.5) * 0.7, d = 0.46 + r() * 0.2;
    add(Math.cos(a) * d, (r() - 0.45) * 0.08, Math.sin(a) * d * 0.9, 0.34 + r() * 0.16, 0.17 + r() * 0.08, 0.32 + r() * 0.14);
  }
  add((r() - 0.5) * 0.3, 0.2, (r() - 0.5) * 0.3, 0.38, 0.19, 0.34);
  const g = mergeGeometries(parts, false); for (const part of parts) part.dispose();
  const p = g.attributes.position, colors = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const light = 0.66 + 0.46 * THREE.MathUtils.smoothstep(y, -0.12, 0.32) + (h3(x * 3, y * 3, z * 3, seed) - 0.5) * 0.16;
    colors.push(light * 0.96, light, light * 0.97);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.computeVertexNormals(); return g;
}

// 숲 바닥 높이 (ground 와 같은 식). 둘레의 소나무 밑동을 땅에 묻는 데 쓴다 — 물리와는 상관없다
function groundHeight(x, z) {
  const rad = Math.hypot(x, z);
  let y = rad <= 12 ? -0.055 : -0.055 + THREE.MathUtils.smoothstep(rad, 12, 25) * (0.23 + Math.sin(x * 0.17) * Math.cos(z * 0.22) * 0.4);
  y += THREE.MathUtils.smoothstep(rad, 32, 56) * (1.7 + Math.sin(x * 0.073 + z * 0.055) * 1.25) * (1 - Math.exp(-Math.pow((x - 28) / 6, 2)));
  const bank = Math.abs(x - (27.5 + Math.sin(z * 0.12) * 2.4));
  if (Math.abs(z) < 37 && bank < 2.3) y = THREE.MathUtils.lerp(0.005, y, THREE.MathUtils.smoothstep(bank, 1.1, 2.3));
  return y;
}

function pineCenter(t,height,seed,hero) {
  if(hero) return new THREE.Vector3(height*(-0.21*t+0.14*Math.sin(t*6.2)*t),height*t,height*(0.21*Math.sin(t*3.7)*t-0.06*t));
  const bend=Math.pow(t,1.38), phase=seed*0.41;
  return new THREE.Vector3((Math.sin(t*5.2+phase)-Math.sin(phase))*bend*height*(hero?0.18:0.11),height*t,(Math.cos(t*3.4+phase)-Math.cos(phase))*bend*height*(hero?0.1:0.075));
}
function pineSurface(t,a,height,radius,seed,hero) {
  const taper=0.10+0.90*Math.pow(1-t,0.7),flare=1+0.38*Math.exp(-t*24);
  const flute=1+(hero?0.10:0.07)*Math.sin(a*7+t*5)+0.05*Math.sin(a*11-t*6+seed);
  const rad=radius*taper*flare*flute+(hero?Math.pow(Math.max(0,Math.cos(a*7-0.55)),4)*Math.exp(-height*t*0.58)*0.45:0);
  return pineCenter(t,height,seed,hero).add(new THREE.Vector3(Math.cos(a)*rad,0,Math.sin(a)*rad));
}
// Rope uses exactly the same bent trunk facets as its geometry, including the
// low root flare. It is not suspended around an unrelated ideal cylinder.
function heroSurface(y, angle, seed, pad = 0) {
  const sides=42,levels=18,h=PINE_HEIGHT,ring=j=>Math.pow(j/levels,1.55);
  let j=0;while(j<levels-1&&ring(j+1)*h<y)j++;
  const t0=ring(j),t1=ring(j+1),ty=THREE.MathUtils.clamp((y/h-t0)/(t1-t0),0,1);
  const u=((angle/TAU%1)+1)%1*sides,i=Math.floor(u),ta=u-i;
  const point=(t,index)=>pineSurface(t,index/sides*TAU,h,PINE_RADIUS,seed,true);
  return point(t0,i).lerp(point(t0,i+1),ta).lerp(point(t1,i).lerp(point(t1,i+1),ta),ty).add(new THREE.Vector3(HERO.x+Math.cos(angle)*pad,0,HERO.z+Math.sin(angle)*pad));
}

function quietWind(material, clock, paper = false) {
  material.onBeforeCompile = shader => {
    shader.uniforms.groveTime = clock;
    shader.vertexShader = 'uniform float groveTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      ${paper ? `float hang = clamp((2.58 - position.y) / .9, 0., 1.);
      transformed.x += sin(groveTime * .67 + position.z * .73) * .028 * hang;
      transformed.z += cos(groveTime * .53 + position.x * .5) * .034 * hang;` : `
      float phase = instanceMatrix[3].x * .12 + instanceMatrix[3].z * .17;
      transformed.x += sin(groveTime * .38 + phase) * .016;
      transformed.y += sin(groveTime * .47 + phase) * .012;`}
    `);
  };
  material.customProgramCacheKey = () => paper ? 'grove-folded-paper-v1' : 'grove-bough-wind-v1';
  return material;
}

// A thick root is a low, tapering buttress embedded in the soil, not a cylindrical
// spoke. Unequal width/height and a curved centreline join it to the fluted trunk.
function buttressRoot(angle, length, height, width) {
  const positions = [], uv = [], indices = [];
  const profile = [-1, -0.65, 0, 0.58, 1], lift = [0, 0.58, 1, 0.68, 0];
  for (let j = 0; j < 5; j++) {
    const t = j / 4, a = angle + Math.sin(t * 2.2) * 0.13, d = 1.8 + t * (length - 1.8);
    const w = width * Math.pow(1 - t, 0.85) + 0.07, h = height * Math.pow(1 - t, 1.6) + 0.035;
    for (let k = 0; k < 5; k++) {
      positions.push(HERO.x + Math.cos(a) * d - Math.sin(a) * profile[k] * w, -0.035 + h * lift[k], HERO.z + Math.sin(a) * d + Math.cos(a) * profile[k] * w);
      uv.push(k / 4, t * 1.7);
      if (j < 4 && k < 4) { const n = j * 5 + k; indices.push(n, n + 1, n + 5, n + 1, n + 6, n + 5); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
}

function trunkGeometry(height, radius, seed, hero = false) {
  const sides = hero ? 42 : 10, levels = hero ? 18 : 5;
  const pos = [], uv = [], indices = [];
  for (let j = 0; j <= levels; j++) {
    const t = hero ? Math.pow(j / levels, 1.55) : j / levels;
    for (let i = 0; i <= sides; i++) {
      const point=pineSurface(t,i/sides*TAU,height,radius,seed,hero);
      pos.push(point.x,point.y,point.z);
      uv.push(i / sides, t * (hero ? 1 : 1.5));
      if (j < levels && i < sides) {
        const n = j * (sides + 1) + i;
        indices.push(n, n + sides + 1, n + 1, n + 1, n + sides + 1, n + sides + 2);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices); geo.computeVertexNormals(); return geo;
}

function put(K, bin, geo, color, pos, rot = [0, 0, 0], scale = 1, opt = {}) {
  const result = K.put(bin, geo, color, pos, rot, scale, opt); geo.dispose(); return result;
}
function branch(K, a, b, ra, rb, color = C.bark, bin = 'bark', sides = 7) {
  const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), dir = bv.clone().sub(av);
  const g = new THREE.CylinderGeometry(rb, ra, dir.length(), sides, 1, true);
  const m = new THREE.Matrix4().compose(av.add(bv).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()), new THREE.Vector3(1, 1, 1));
  K.putM(bin, g, color, m, { vary: 0.16, noise: 0.045 }); g.dispose();
}

function ground(scene, texture) {
  // Radial tessellation gives the fighting floor detail without a huge far mesh.
  const pos = [], uv = [], colors = [], indices = [], rings = 48, segments = 96; // 10/11 128 → 96 (6.5 m 고리에서 정점 간격 0.43 m)
  const base = new THREE.Color(C.earth), moss = new THREE.Color(C.moss), dark = new THREE.Color(C.deepMoss), litterColor = new THREE.Color(C.litter), floorMoss = new THREE.Color(C.floorMoss), fleck = new THREE.Color(0xffd79a), tmp = new THREE.Color(), floor = new THREE.Color();
  for (let j = 0; j <= rings; j++) {
    const rad = j <= 26 ? j * 0.5 : 13 + Math.pow((j - 26) / 22, 1.5) * 83;
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * TAU, x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      // Broad, interlocking moss tongues replace the regular green ring. The
      // duel surface stays flat; this is pigment, not collision relief.
      const edge = Math.sin(a * 3 + 0.7) * 1.7 + Math.sin(a * 7 - 1.4) * 0.62;
      const forest = THREE.MathUtils.smoothstep(rad, ARENA.radius + 0.8 + edge * 0.35, ARENA.radius + 6.4 + edge);
      const shade = (Math.sin(x * 0.86 + Math.sin(z * 0.63)) * Math.sin(z * 0.74 - x * 0.22) + 1) * 0.5;
      // 결투장 흙 (10/11): 다져진 흙에 솔잎 깔림(붉은 갈색)이 넓게 덮이고, 이끼가 군데군데 혀처럼 번진다.
      //  디딤돌 고리(6.57 m) 둘레는 이끼가 조금 더 짙다. 밝은 디딤돌이 어두운 바닥에서 경계를 그대로 그린다
      const needles = 0.5 + 0.5 * Math.sin(x * 0.93 + Math.sin(z * 0.71) * 1.3) * Math.cos(z * 0.82 - x * 0.31);
      const mossy = 0.5 + 0.5 * Math.sin(x * 0.57 - z * 0.41 + Math.sin(x * 0.33 + z * 0.92) * 1.5);
      const ringMoss = Math.exp(-Math.pow((rad - ARENA.radius - 0.1) / 0.9, 2)) * 0.3;
      floor.copy(base).lerp(litterColor, 0.5 + 0.32 * needles).lerp(floorMoss, Math.min(0.78, THREE.MathUtils.smoothstep(mossy, 0.5, 0.86) * 0.68 + ringMoss));
      tmp.copy(floor).lerp(moss, forest).lerp(dark, forest * (0.1 + shade * 0.4));
      const approach = Math.exp(-Math.pow((z + 0.19 * x - 0.7) / 1.05, 2)) * THREE.MathUtils.smoothstep(x, 7, 13) * (1 - THREE.MathUtils.smoothstep(x, 17.3, 19));
      tmp.lerp(base, approach * 0.5);
      const litter = THREE.MathUtils.smoothstep(rad, 6.9, 8.0) * (1 - THREE.MathUtils.smoothstep(rad, 11, 17)) * Math.max(0, Math.sin(x * 0.68 + Math.sin(z * 0.5)) * Math.cos(z * 0.8));
      tmp.lerp(litterColor, litter * 0.36);
      const nearRoot = 1 - THREE.MathUtils.smoothstep(Math.hypot(x - HERO.x, z - HERO.z), 3.6, 7.4);
      const rootLight = Math.exp(-Math.pow((x - 15.3) / 4.0, 2) - Math.pow((z + 2.5) / 3.1, 2));
      const canopyShadow = forest * (0.2 + 0.17 * (0.5 + 0.5 * Math.sin(x * 0.38 + z * 0.64)));
      // 숲 덩어리 밑은 수관 그늘: 짙은 이끼로 어둡게 (10/11 2차)
      let under = 0; for (const [gx, gz, R] of GROVES) under = Math.max(under, 1 - THREE.MathUtils.smoothstep(Math.hypot(x - gx, z - gz), R * 0.55, R + 2.5));
      tmp.lerp(dark, under * 0.4);
      tmp.multiplyScalar((0.87 + shade * 0.2 + h3(x, 0, z, 79) * 0.055) * (1 - nearRoot * 0.18 - canopyShadow - under * 0.22) + rootLight * 0.3);
      // 나무 사이로 든 아침 햇살 얼룩: 숲 바닥(12~34 m)에 따뜻한 빛 조각, 결투장 안은 아주 옅게
      const flecks = THREE.MathUtils.smoothstep(Math.sin(x * 0.47 + Math.sin(z * 0.36) * 2.1) * Math.sin(z * 0.53 - x * 0.18 + 1.3), 0.45, 0.9);
      const band = THREE.MathUtils.smoothstep(rad, 11, 15) * (1 - THREE.MathUtils.smoothstep(rad, 30, 38));
      tmp.lerp(fleck, flecks * (band * 0.3 + (1 - forest) * 0.07));
      // Flat at and well beyond the duel boundary. Terrain only rises deep in forest;
      // a low distant ridge closes the horizon and the stream banks stay low (groundHeight).
      const y = groundHeight(x, z);
      pos.push(x, y, z); uv.push(x * 0.35, z * 0.35); colors.push(tmp.r, tmp.g, tmp.b);
      if (j < rings && i < segments) { const k = j * (segments + 1) + i; indices.push(k, k + 1, k + segments + 1, k + 1, k + segments + 2, k + segments + 1); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.setIndex(indices); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: texture, vertexColors: true, roughness: 1 })); mesh.receiveShadow = true; mesh.name = 'grove-flat-duel-earth'; scene.add(mesh);
}

// 줄기 정점 색: 아래(밑동~가지 없는 몸통 아래쪽)는 어두운 회갈색, 위로 갈수록 적송의 붉은 갈색
function redPineBark(g, y0, height, lo = 0.12, hi = 0.62) {
  const col = g.attributes.color, pos = g.attributes.position, foot = new THREE.Color(C.pineFoot), red = new THREE.Color(C.pineRed), c = new THREE.Color();
  for (let k = 0; k < col.count; k++) {
    c.copy(foot).lerp(red, THREE.MathUtils.smoothstep((pos.getY(k) - y0) / height, lo, hi));
    col.setXYZ(k, col.getX(k) * c.r, col.getY(k) * c.g, col.getZ(k) * c.b);
  }
}

function pine(K, foliage, r, x, z, height, radius) {
  const trunkSeed = Math.floor(r() * 200), knotKit = new Kit(4783);
  const trunk = put(K, 'heroBark', trunkGeometry(height, radius, trunkSeed, true), 0xffffff, [x, 0, z], [0, 0, 0], 1, { noise: 0.035, vary: 0.04 });
  redPineBark(trunk, 0, height, 0.06, 0.42);
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * TAU + 0.15, len = 5.0 + r() * 1.45;
    const p0 = [x + Math.cos(a) * radius * 0.64, 1.55 + r() * 0.8, z + Math.sin(a) * radius * 0.64];
    const root = put(K, 'bark', buttressRoot(a, len + (i % 3) * 0.15, p0[1] + 0.25, 0.68 + (i % 4) * 0.13), C.pineFoot, [0, 0, 0], [0, 0, 0], 1, { noise: 0.04 });
    const col = root.attributes.color, pos = root.attributes.position, normal = root.attributes.normal, moss = new THREE.Color(0x576a45);
    for (let k = 0; k < col.count; k++) {
      const mix = THREE.MathUtils.smoothstep(normal.getY(k), 0.2, 0.9) * (0.18 + 0.3 * (0.5 + 0.5 * Math.sin(pos.getX(k) * 2.2 + pos.getZ(k))));
      col.setXYZ(k, THREE.MathUtils.lerp(col.getX(k), moss.r, mix), THREE.MathUtils.lerp(col.getY(k), moss.g, mix), THREE.MathUtils.lerp(col.getZ(k), moss.b, mix));
    }
  }
  // 신목: 굵은 가지가 층층이 옆으로 길게 뻗고, 끝마다 넓고 납작한 구름 덩어리가 얹힌다 (아래쪽 몸통은 비워 둔다)
  const tiers = [0.36, 0.5, 0.63, 0.75, 0.86], perTier = [3, 3, 3, 2, 2];
  let n = 0;
  tiers.forEach((t, ti) => {
    for (let k = 0; k < perTier[ti]; k++, n++) {
      const base = pineCenter(t, height, trunkSeed, true), a = n * 2.39996 + 0.4 + r() * 0.3;
      const len = (13.5 - ti * 2.1) * (0.85 + r() * 0.25), br = radius * (1 - t) * 0.5;
      const p0 = [x + base.x, base.y, z + base.z];
      const p1 = [p0[0] + Math.cos(a) * len * 0.4, p0[1] + len * 0.05, p0[2] + Math.sin(a) * len * 0.4];
      const p2 = [p0[0] + Math.cos(a + 0.16) * len * 0.8, p0[1] + len * 0.09 - 0.4, p0[2] + Math.sin(a + 0.16) * len * 0.8];
      const red = C.pineRed;
      branch(K, p0, p1, br, br * 0.68, red); branch(K, p1, p2, br * 0.68, br * 0.3, red);
      put(knotKit, 'bark', new THREE.IcosahedronGeometry(1, 1), red, p1, [0, 0, 0], br * 0.72, { noise: 0.035, vary: 0.04 });
      put(knotKit, 'bark', new THREE.IcosahedronGeometry(1, 1), red, p2, [0, 0, 0], br * 0.34, { noise: 0.035, vary: 0.04 });
      const w = (4.2 - ti * 0.45) * (0.88 + r() * 0.22);
      foliage.push({ kind: 'hero', x: p2[0], y: p2[1] + 0.35, z: p2[2], sx: w, sy: w * 0.62, sz: w * 0.78, a: a + 0.3, tilt: (r() - 0.5) * 0.12, color: r() < 0.3 ? C.needleLit : C.needle });
      for (const side of [-1, 1]) {
        const end = [p2[0] + Math.cos(a + side * 0.75) * len * 0.3, p2[1] + 0.25, p2[2] + Math.sin(a + side * 0.75) * len * 0.3];
        branch(K, p1, end, br * 0.36, 0.05, red);
        const v = w * (0.55 + r() * 0.15);
        foliage.push({ kind: 'pad' + (n + side + 2) % 3, x: end[0], y: end[1] + 0.3, z: end[2], sx: v, sy: v * 0.62, sz: v * 0.8, a: a + side, tilt: (r() - 0.5) * 0.12, color: r() < 0.35 ? C.needleDeep : C.needle });
      }
    }
  });
  const tip = pineCenter(1, height, trunkSeed, true);
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * TAU + 0.5, w = 3.4 - k * 0.3;
    foliage.push({ kind: 'hero', x: x + tip.x + Math.cos(a) * 1.6, y: tip.y - 0.6 + k * 0.5, z: z + tip.z + Math.sin(a) * 1.6, sx: w, sy: w * 0.7, sz: w * 0.8, a, tilt: 0, color: k === 2 ? C.needleLit : C.needle });
  }
  K.bins.bark.push(...knotKit.bins.bark);
  return trunkSeed;
}

// 둘레의 적송: 곧은 키 큰 것 · 기운 것 · 낮게 퍼진 것. 줄기는 위로 갈수록 가늘어지며 살짝 굽고,
// 아래쪽은 가지 없이 길다. 위쪽에 층층이 가지가 옆으로 뻗고 그 끝에 넓고 납작한 구름 덩어리가 얹힌다.
const PINE_KINDS = {
  tall:   { hScale: 1.0,  clear: 0.46, top: 0.92, tiers: [4, 5], reach: [0.24, 0.1],  rise: 0.2,  pad: [3.0, 1.9], lean: [0.0, 0.06] },
  lean:   { hScale: 0.88, clear: 0.46, top: 0.9,  tiers: [3, 4], reach: [0.28, 0.13], rise: 0.16, pad: [3.1, 2.0], lean: [0.22, 0.36] },
  spread: { hScale: 0.5,  clear: 0.38, top: 0.86, tiers: [4, 4], reach: [0.55, 0.3],  rise: 0.07, pad: [3.5, 2.4], lean: [0.03, 0.12] },
  // 숲 덩어리 안쪽 나무 (10/11 2차): 곧고 높은 줄기, 가지는 위쪽에만 짧게, 덩어리가 커서 이웃 나무와 이어져 지붕이 된다
  grove:  { hScale: 1.0,  clear: 0.58, top: 0.94, tiers: [2, 2], reach: [0.2, 0.1],   rise: 0.14, pad: [3.6, 2.7], lean: [0.0, 0.05] },
};
// 숲 덩어리 (10/11 2차, 사장님 "나무를 좀 모아서 부분적인 밀도를 올려"): 결투장에서 보이는 중경(20~38 m)에 열(2차 여덟 + 3차 신목 양옆 둘).
//  안은 줄기 사이 1.6 m 남짓으로 빽빽해 줄기가 겹쳐 보이고 수관이 이어져 지붕을 이룬다. 가장자리 나무는 낮고
//  바깥으로 기울며 아래 가지까지 달려 숲 벽을 닫는다. 덩어리 사이는 트인 풀밭·이끼로 남긴다 (화전 터의 듬성한 들판과 갈리게).
//  신목 둘레 13.5 m · 신목 뒤 하늘 자리 · 도리이 둘레는 1차대로 비운다. [x, z, 반지름(m), 그루, 키 배율]
//  3차(디렉터 10/11): 경기 화면에서 신목 양옆(화면 가장자리 쪽)에 덩어리 둘을 붙여 '빽빽한 숲 사이로 트인 창에 신목이 선' 그림.
//  신목 뒤 하늘 창(통로 반폭 6.5 m)·신목 둘레 13.5 m·도리이 둘레 6 m 는 그대로 비운다. 경기 카메라 뒤쪽 덩어리 둘은 그루를 줄여 맞췄다
const GROVES = [[6, -27, 7.5, 18, 1.1], [-13, -26, 5.5, 10, 1.0], [31, -21, 6, 12, 1.05], [36, 13, 5, 8, 1.0], [25, 27, 7, 14, 1.1], [-3, 28, 6.5, 13, 1.2], [-26, -12, 7.5, 9, 1.05], [-21, 19, 5.5, 6, 0.9],
  [21, -18, 5.5, 12, 1.1], [24, 15, 5, 10, 1.05]];
function pineAxis(t, P) {
  const s = P.lean * P.h * (t - 0.4 * t * t), w = Math.sin(t * Math.PI * 1.6 + P.phase) * P.wob * P.h * t;
  return new THREE.Vector3(Math.cos(P.dir) * s - Math.sin(P.dir) * w, P.h * t, Math.sin(P.dir) * s + Math.cos(P.dir) * w);
}
function forestTrunkGeometry(P, radius, far) {
  const sides = far ? 6 : 8, levels = far ? 6 : 9, pos = [], uv = [], indices = [];
  for (let j = 0; j <= levels; j++) {
    const t = j / levels, c = pineAxis(t, P), rad = radius * (1 - 0.8 * Math.pow(t, 0.85)) * (1 + 0.3 * Math.exp(-t * P.h / 0.6));
    for (let i = 0; i <= sides; i++) {
      const a = i / sides * TAU, f = 1 + 0.07 * Math.sin(a * 3 + j * 1.7 + P.phase);
      pos.push(c.x + Math.cos(a) * rad * f, c.y, c.z + Math.sin(a) * rad * f); uv.push(i / sides, t * P.h * 0.12);
      if (j < levels && i < sides) { const n = j * (sides + 1) + i; indices.push(n, n + sides + 1, n + 1, n + 1, n + sides + 1, n + sides + 2); }
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(indices); geo.computeVertexNormals(); return geo;
}
// leanDir: 기운 소나무가 기우는 쪽 (무리 가장자리 나무는 무리 바깥 빛 쪽으로). 없으면 결투장 바깥쪽
function forestPine(K, foliage, seed, x, z, height, radius, kind, leanDir) {
  const r = rng(seed), S = PINE_KINDS[kind], out = leanDir ?? Math.atan2(z, x);
  const P = { h: height * S.hScale * (0.92 + r() * 0.16), lean: S.lean[0] + r() * (S.lean[1] - S.lean[0]), dir: kind === 'lean' ? out + (r() - 0.5) * 1.6 : r() * TAU, wob: 0.012 + r() * 0.02, phase: r() * TAU };
  // 36 m 밖(대기에 흐려지기 시작하는 자리)은 층을 하나 덜고 줄기·가지 면 수를 줄여 삼각형을 아낀다
  //  덩어리 안쪽 나무는 수관 지붕이 덮어 27 m 밖부터 간단한 꼴 (10/11 3차)
  const far = Math.hypot(x, z) > (kind === 'grove' ? 27 : 36), rad = radius * (kind === 'spread' ? 1.35 : 1), y0 = groundHeight(x, z) - 0.25;
  const trunk = put(K, 'bark', forestTrunkGeometry(P, rad, far), 0xffffff, [x, y0, z], [0, 0, 0], 1, { noise: 0.04, vary: 0.12 });
  redPineBark(trunk, y0, P.h);
  const tiers = S.tiers[0] + Math.floor(r() * (S.tiers[1] - S.tiers[0] + 1)) - (far ? 1 : 0);
  let a = r() * TAU;
  for (let k = 0; k < tiers; k++) {
    const tt = tiers > 1 ? k / (tiers - 1) : 0, t = S.clear + (S.top - S.clear) * tt + (r() - 0.5) * 0.03;
    const c = pineAxis(t, P), base = [x + c.x, y0 + c.y, z + c.z];
    a += kind === 'lean' ? 0 : 2.39996 + (r() - 0.5) * 0.5;
    const ang = kind === 'lean' ? P.dir + (k % 2 ? -1 : 1) * (0.5 + r() * 1.3) : a;
    const len = P.h * (S.reach[0] + (S.reach[1] - S.reach[0]) * tt) * (0.8 + r() * 0.4);
    const br = rad * (1 - t) * 0.55 + 0.03, color = C.pineRed;
    // 아래 층은 맞은편으로 짧은 가지를 하나 더 낸다 (층마다 덩어리가 한쪽에만 붙어 보이지 않게)
    const arms = tt < 0.6 && !far && kind !== 'grove' ? [[ang, 1], [ang + Math.PI + (r() - 0.5) * 1.2, 0.68]] : [[ang, 1]];
    for (const [aa, f] of arms) {
      const L = len * f;
      const mid = [base[0] + Math.cos(aa) * L * 0.5, base[1] - L * 0.04, base[2] + Math.sin(aa) * L * 0.5];
      const end = [base[0] + Math.cos(aa + 0.12) * L, base[1] + L * S.rise, base[2] + Math.sin(aa + 0.12) * L];
      branch(K, base, mid, br * f, br * f * 0.65, color, 'bark', far ? 4 : 5); branch(K, mid, end, br * f * 0.65, br * f * 0.3, color, 'bark', far ? 4 : 5);
      const w = (S.pad[0] + (S.pad[1] - S.pad[0]) * tt) * (0.82 + r() * 0.3) * (0.6 + 0.4 * f);
      foliage.push({ kind: far ? 'padFar' : 'pad' + (seed + k) % 3, x: end[0], y: end[1] + w * 0.12, z: end[2], sx: w, sy: w * 0.6, sz: w * (0.72 + r() * 0.2), a: aa + (r() - 0.5) * 0.6, tilt: (r() - 0.5) * 0.15, color: r() < 0.28 ? C.needleLit : r() < 0.35 ? C.needleDeep : C.needle });
      if (kind === 'spread' && f === 1) { // 낮게 퍼진 소나무의 긴 가지는 가운데쯤에 작은 덩어리를 하나 더
        const v = w * 0.6;
        foliage.push({ kind: far ? 'padFar' : 'pad' + (seed + k + 1) % 3, x: mid[0], y: mid[1] + v * 0.3, z: mid[2], sx: v, sy: v * 0.6, sz: v * 0.8, a: aa + 1, tilt: 0, color: C.needleDeep });
      }
    }
  }
  const tip = pineAxis(1, P), w = S.pad[1] * (kind === 'spread' ? 1.15 : 1.05) * (0.9 + r() * 0.2);
  foliage.push({ kind: far ? 'padFar' : 'pad' + seed % 3, x: x + tip.x, y: y0 + tip.y, z: z + tip.z, sx: w, sy: w * (kind === 'spread' ? 0.55 : 0.8), sz: w * 0.85, a: r() * TAU, tilt: 0, color: C.needleLit });
}

function sacredRope(K, trunkSeed) {
  // Three visibly braided strands follow the natural trunk at chest/head height.
  for (let strand = 0; strand < 3; strand++) {
    const points = [];
    for (let i = 0; i <= 144; i++) {
      const a = i / 144 * TAU, twist = a * 23 + strand / 3 * TAU;
      const y = 3.0 + Math.sin(a * 2) * 0.07 + Math.sin(twist) * 0.095;
      points.push(heroSurface(y, a, trunkSeed, 0.27 + Math.cos(twist) * 0.095));
    }
    put(K, 'ritual', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 180, 0.092, 5, true), C.rope, [0, 0, 0], [0, 0, 0], 1, { noise: 0.04 });
  }
  // Folded shide paper, sparse and deliberately readable against the pine bark.
  for (let n = 0; n < 5; n++) {
    const a = Math.PI * 0.57 + n * Math.PI * 0.22, attachment = heroSurface(3.0, a, trunkSeed, 0.29), x = attachment.x, z = attachment.z;
    branch(K, [x, 2.96, z], [x, 2.57, z], 0.022, 0.015, C.rope, 'ritual', 4);
    const points = [0, 0, 0.19, -0.09, 0.11, -0.27, 0.31, -0.32, 0.16, -0.53, 0.34, -0.6, 0.12, -0.87, -0.02, -0.8, 0.11, -0.59, -0.07, -0.52, 0.06, -0.3, -0.12, -0.25];
    const shape = new THREE.Shape(); shape.moveTo(points[0], points[1]); for (let k = 2; k < points.length; k += 2) shape.lineTo(points[k], points[k + 1]); shape.closePath();
    const paper = new THREE.ShapeGeometry(shape);
    for (let k = 0; k < paper.attributes.position.count; k++) { const y = paper.attributes.position.getY(k); paper.attributes.position.setZ(k, -y * 0.35 + (y < -0.56 ? 0.075 : y < -0.28 ? -0.065 : 0.025)); }
    paper.computeVertexNormals();
    put(K, 'paper', paper, C.paper, [x, 2.56, z], [0, Math.PI / 2 - a, 0], 1.13, { noise: 0, vary: 0.015 });
  }
}

function torii(K) {
  // Small, off-axis and weathered: architecture remains secondary to the pine.
  K.push([13.8, 0, 13.7], 0.62);
  for (const s of [-1, 1]) {
    branch(K, [s * 1.55, 0, 0], [s * 1.36, 4.5, 0], 0.18, 0.155, C.vermilion, 'paint', 10);
    put(K, 'stone', new THREE.CylinderGeometry(0.26, 0.32, 0.3, 8), C.stone, [s * 1.55, 0.11, 0]);
    put(K, 'paint', new THREE.BoxGeometry(0.28, 0.3, 0.28), 0x705b46, [s * 1.4, 3.17, 0]);
  }
  put(K, 'paint', new THREE.BoxGeometry(4.1, 0.21, 0.3), C.vermilion, [0, 3.2, 0], [0, 0, 0], 1, { vary: 0.1, noise: 0.09 });
  put(K, 'paint', new THREE.BoxGeometry(4.55, 0.27, 0.42), C.vermilion, [0, 4.27, 0], [0, 0, 0], 1, { noise: 0.09 });
  for (let i = -4; i <= 4; i++) {
    const x = i * 0.56, y = 4.53 + Math.pow(Math.abs(x) / 2.24, 2) * 0.2;
    put(K, 'paint', new THREE.BoxGeometry(0.59, 0.17, 0.51), 0x3d4740, [x, y, 0], [0, 0, i * 0.022]);
  }
  put(K, 'paint', new THREE.BoxGeometry(0.13, 0.88, 0.23), C.vermilion, [0, 3.75, 0]);
  K.pop();
}

function plants(scene, r) {
  const positions = [], normals = [];
  for (let f = 0; f < 7; f++) {
    const a = f / 7 * TAU;
    for (let j = 0; j < 4; j++) { // 잎 마디 넷 (10/11 여섯 → 넷: 12 m 밖이라 꼴 차이 없이 삼각형 1/3 덜기)
      const t = j / 4, t1 = (j + 1) / 4, width = Math.sin((t + 0.025) * Math.PI) * 0.13, nextWidth = Math.max(0,Math.sin(t1 * Math.PI)) * 0.13;
      const p = [Math.cos(a) * t * 0.85, Math.sin(t * Math.PI * 0.78) * 0.55, Math.sin(a) * t * 0.85];
      const q = [Math.cos(a) * t1 * 0.85, Math.sin(t1 * Math.PI * 0.78) * 0.55, Math.sin(a) * t1 * 0.85];
      const dx = Math.sin(a) * width, dz = -Math.cos(a) * width, qx = Math.sin(a) * nextWidth, qz = -Math.cos(a) * nextWidth;
      positions.push(p[0] + dx,p[1],p[2] + dz, p[0] - dx,p[1],p[2] - dz, q[0] - qx,q[1],q[2] - qz, p[0] + dx,p[1],p[2] + dz, q[0] - qx,q[1],q[2] - qz, q[0] + qx,q[1],q[2] + qz);
      for (let n = 0; n < 6; n++) normals.push(0, 1, 0);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  const mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0x8aa766, roughness: 1, side: THREE.DoubleSide }), 140); // 10/11 2차 180 → 140 (숲 덩어리 그리기 몫)
  const dummy = new THREE.Object3D(), c = new THREE.Color();
  const clumps = [[13.8,-6.8],[16.7,3.1],[22.5,4.6],[18.5,-10.1],[-15,-5],[-12,12],[3,18],[-9,-18],[28,13],[5,-27],[28,-18],[-28,6]];
  for (let i = 0; i < 140; i++) {
    const center = clumps[i % clumps.length], a = r() * TAU, rad = Math.sqrt(r()) * (i < 60 ? 1.8 : 3.6);
    let x = center[0] + Math.cos(a) * rad, z = center[1] + Math.sin(a) * rad;
    const d = Math.hypot(x, z); if (d < 12.15) { x *= 12.15 / d; z *= 12.15 / d; }
    dummy.position.set(x, 0.035, z); dummy.rotation.y = r() * TAU; dummy.scale.setScalar(0.62 + r() * 0.96); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, c.set(C.leafDeep).lerp(new THREE.Color(C.leafLit), 0.2 + r() * 0.7));
  }
  mesh.name = 'grove-ferns-outside-camera'; scene.add(mesh);
}

function rootGarden(K) {
  const r = rng(104913);
  // Low stone shelves and moss pads lead into the pine's buttresses. They are
  // asymmetrical, half buried, and all remain beyond the full camera orbit.
  const shelves = [[13.9,-6.5,2.2,0.39,1.45],[15.5,2.6,2.3,0.35,1.45],[18.3,-8.7,1.5,0.3,1.1],[23.7,3.5,2.0,0.48,1.4],[17.5,4.9,1.5,0.23,1.1],[25,-5.8,1.75,0.32,1.1]];
  for (const [x,z,sx,sy,sz] of shelves) {
    put(K, 'stone', new THREE.DodecahedronGeometry(1, 0), 0x78887c, [x,sy * 0.1,z], [0,r() * TAU,0], [sx,sy,sz], { rough:0.085, noise:0.09, snow:0.88, snowColor:0x718659 });
    for (let i = 0; i < 5; i++) {
      const a = r() * TAU, d = 0.4 + r() * 0.7;
      put(K, 'stone', new THREE.IcosahedronGeometry(1, 0), i % 2 ? 0x8ea366 : 0x6b8858, // 이끼 방석도 돌 메쉬에 합친다(그리기 한 번 덜기, 10/11)
         [x + Math.cos(a) * sx * d,0.035,z + Math.sin(a) * sz * d], [0,r() * TAU,0], [0.45+r()*0.55,0.1+r()*0.075,0.35+r()*0.55], { noise:0.05, vary:0.08 });
    }
  }
  // An old approach disappears beneath moss before reaching the sacred rope.
  // Its irregular slabs give scale and a human trace without a second monument.
  for (let i = 0; i < 7; i++) {
    const x = 11.9 + i * 0.91, z = -1.5 - i * 0.14 + Math.sin(i * 1.4) * 0.16;
    put(K, 'stone', new THREE.CylinderGeometry(0.72,0.83,0.15,6), 0xa9ae95, [x,0.035,z], [0,r() * TAU,0], [1,1,0.7 + r() * 0.14], { rough:0.06, noise:0.07, snow:i>3?0.46:0.12, snowColor:0x718659 });
  }
}

function stream(scene, K, r) {
  // The shallow stream is 26m beyond the floor, never crossing the arena.
  const pos = [], uv = [], indices = [];
  for (let i = 0; i <= 44; i++) {
    const z = -35 + i * 1.6, x = 27.5 + Math.sin(z * 0.12) * 2.4;
    for (const s of [-1, 1]) { pos.push(x + s * (1.0 + Math.sin(z * 0.26) * 0.2), 0.19, z); uv.push(s === -1 ? 0 : 1, i / 5); }
    if (i < 44) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
    if (i % 2 === 0) for (const s of [-1, 1]) put(K, 'stone', new THREE.DodecahedronGeometry(1, 0), C.stone, [x + s * (1.4 + r() * 0.2), 0.14, z], [r(), r() * TAU, r()], [0.45 + r() * 0.6, 0.24 + r() * 0.18, 0.55 + r() * 0.5], { rough: 0.06, noise: 0.08 });
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals();
  const texture = canvasTex(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#879e96'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 85; i++) { ctx.fillStyle = `rgba(224,234,214,${0.06 + r() * 0.23})`; ctx.fillRect(r() * w, r() * h, 3 + r() * 20, 0.5 + r() * 1.4); }
  });
  const material = new THREE.MeshStandardMaterial({ color: 0xb9cbc1, map: texture, roughness: 0.28, metalness: 0.12 });
  const mesh = new THREE.Mesh(g, material); mesh.name = 'grove-distant-stream'; scene.add(mesh); return texture;
}

// 오후 하늘 (10/11): 안쪽을 보는 큰 구. 지평선은 안개색(먼 숲·땅과 이어진다), 위로 갈수록 맑은 옅은 하늘색,
//  해 쪽 하늘은 따뜻한 오후빛으로 밝다(노을빛까지는 아님). 정점 색만 — 질감 없음, 안개 안 받음
function afternoonSky(scene) {
  const g = new THREE.SphereGeometry(240, 32, 14), p = g.attributes.position, colors = [];
  const horizon = new THREE.Color(GROVE_FOG.color), zenith = new THREE.Color(0x9ec4d8), warm = new THREE.Color(0xf4e7c4), c = new THREE.Color();
  const sunDir = new THREE.Vector3(SUN_OFFSET.x, SUN_OFFSET.y, SUN_OFFSET.z).normalize(), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    c.copy(horizon).lerp(zenith, THREE.MathUtils.smoothstep(v.y, 0.02, 0.62));
    const toSun = Math.max(0, v.dot(sunDir));
    c.lerp(warm, Math.pow(toSun, 3) * 0.55 * (1 - THREE.MathUtils.smoothstep(v.y, 0.55, 0.95) * 0.5));
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.name = 'grove-afternoon-sky'; sky.renderOrder = -1; scene.add(sky);
}

// 숲 깊이를 위한 엷은 대기 띠 하나(반지름 52 m). 해 쪽은 따뜻한 빛, 반대쪽은 푸르스름한 그늘빛 — 한 톤이 아니다.
//  10/11: 아침 물안개 느낌의 가까운 띠(34 m)와 안개에 다 묻히던 먼 띠(70 m), 땅에 깔린 물안개 판 넉 장은 걷었다
function distantHaze(scene) {
  const texture = canvasTex(8, 128, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(255,255,255,0)'); gradient.addColorStop(0.45, 'rgba(255,255,255,0.4)'); gradient.addColorStop(0.8, 'rgba(255,255,255,0.7)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  });
  const g = new THREE.CylinderGeometry(52, 52, 12, 64, 1, true), p = g.attributes.position, colors = [];
  const warm = new THREE.Color(0xf0e2bf), cool = new THREE.Color(0xbfd0cc), c = new THREE.Color(), sunA = Math.atan2(SUN_OFFSET.z, SUN_OFFSET.x);
  for (let i = 0; i < p.count; i++) { const k = 0.5 + 0.5 * Math.cos(Math.atan2(p.getZ(i), p.getX(i)) - sunA); c.copy(cool).lerp(warm, k * k); colors.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, map: texture, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  mesh.position.y = 5; mesh.name = 'grove-forest-haze'; scene.add(mesh);
}

// 나무 사이로 기울어 드는 오후 빛줄기: 해 방향으로 기운 긴 띠를 십자로 겹친 것 여덟 개를 한 메쉬로(그리기 한 번).
//  더하기 섞기라 아주 옅게만 밝힌다. 밑동은 해 쪽 숲 덩어리 가장자리(수관 지붕 끝, 결투장에서 20 m 넘게 — 카메라에서 늘 10 m 넘게 떨어진다),
//  밑동 쪽은 옅게 시작해 땅에서 빛기둥처럼 빛나지 않는다 (10/11 2차) — 위끝은 해 쪽 바깥으로 기울어
//  결투장 위 허공에는 걸리지 않는다. 카메라 궤도(10.5 m) 안에 들지 않는다
function lightShafts(scene, r) {
  const sun = new THREE.Vector3(SUN_OFFSET.x, SUN_OFFSET.y, SUN_OFFSET.z).normalize(), sunA = Math.atan2(sun.z, sun.x);
  const pos = [], col = [], warm = new THREE.Color(0xffe2a6);
  const u = new THREE.Vector3().crossVectors(sun, UP).normalize(), w2 = new THREE.Vector3().crossVectors(sun, u).normalize();
  // 밑동은 해 쪽 숲 덩어리 가장자리 (수관 지붕 끝에서 트인 곳으로 드는 빛, 짙은 숲 벽 앞에서 읽힌다) — 결투장에서 20 m 넘게
  const sunGroves = GROVES.filter(([gx, gz]) => Math.cos(Math.atan2(gz, gx) - sunA) > 0.6);
  let made = 0;
  for (let tries = 0; made < 8 && tries < 80; tries++) {
    const [gx, gz, R] = sunGroves[tries % sunGroves.length], ga = r() * TAU, gd = R * (0.75 + r() * 0.5), x = gx + Math.cos(ga) * gd, z = gz + Math.sin(ga) * gd;
    if (Math.hypot(x, z) < 20 || Math.hypot(x - HERO.x, z - HERO.z) < 7 || Math.hypot(x - 13.8, z - 13.7) < 4) continue;
    const len = 15 + r() * 7, width = 0.8 + r() * 1.1, peak = 0.022 + r() * 0.016, foot = new THREE.Vector3(x, groundHeight(x, z), z);
    for (const side of [u, w2]) {
      const L = 5, cols = [-1, 0, 1];
      const ring = [];
      for (let j = 0; j <= L; j++) {
        const t = j / L, wide = width * (0.75 + t * 0.7), c = foot.clone().addScaledVector(sun, t * len);
        const fade = THREE.MathUtils.smoothstep(t, 0.04, 0.42) * (1 - THREE.MathUtils.smoothstep(t, 0.55, 1)); // 밑동은 옅게 (땅에서 빛기둥처럼 빛나지 않게)
        ring.push(cols.map((k) => ({ p: c.clone().addScaledVector(side, k * wide), f: fade * (k === 0 ? 1 : 0) * peak })));
      }
      for (let j = 0; j < L; j++) for (let k = 0; k < 2; k++) {
        const q = [ring[j][k], ring[j][k + 1], ring[j + 1][k + 1], ring[j][k], ring[j + 1][k + 1], ring[j + 1][k]];
        for (const v of q) { pos.push(v.p.x, v.p.y, v.p.z); col.push(warm.r * v.f, warm.g * v.f, warm.b * v.f); }
      }
    }
    made++;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  mesh.name = 'grove-afternoon-shafts'; mesh.renderOrder = 3; scene.add(mesh);
}

// 석등(石燈籠) 둘: 도리이 앞 참배길 양옆. 받침 · 기둥 · 받침대 · 불집(어두운 창) · 육각 지붕 · 보주.
//  도리이처럼 카메라 궤도(10.5 m) 밖(결투장에서 약 17 m)이라 키를 그대로 둔다. 지붕 윗면엔 이끼
function stoneLanterns(K, r) {
  for (const [x, z, tilt, s] of [[12.15, 12.35, 0.025, 1], [15.5, 12.45, -0.015, 0.94]]) {
    K.push([x, 0, z], r() * 0.3, s);
    const lean = [tilt, 0, tilt * 0.6], st = { rough: 0.012, noise: 0.07, vary: 0.06 }, mossy = { ...st, snow: 0.75, snowColor: 0x6d7f4c };
    put(K, 'stone', new THREE.CylinderGeometry(0.3, 0.36, 0.2, 6), C.lantern, [0, 0.07, 0], [0, 0, 0], 1, mossy);
    put(K, 'stone', new THREE.CylinderGeometry(0.11, 0.13, 0.78, 8), C.lantern, [0, 0.55, 0], lean, 1, st);
    put(K, 'stone', new THREE.CylinderGeometry(0.27, 0.2, 0.14, 6), C.lantern, [tilt * 0.9, 1.0, tilt * 0.5], lean, 1, mossy);
    put(K, 'stone', new THREE.CylinderGeometry(0.19, 0.19, 0.3, 6), C.lantern, [tilt * 1.2, 1.22, tilt * 0.7], lean, 1, st);
    for (const sgn of [-1, 1]) put(K, 'stone', new THREE.BoxGeometry(0.06, 0.15, 0.13), 0x2b2a24, [tilt * 1.2 + sgn * 0.152, 1.23, tilt * 0.7], lean, 1, { noise: 0 });
    put(K, 'stone', new THREE.ConeGeometry(0.44, 0.26, 6), C.lantern, [tilt * 1.4, 1.5, tilt * 0.8], lean, [1, 1, 1], mossy);
    put(K, 'stone', new THREE.SphereGeometry(0.075, 7, 5), C.lantern, [tilt * 1.6, 1.68, tilt * 0.9], lean, [1, 1.25, 1], st);
    K.pop();
  }
}

// A single quiet sika deer, beyond both the arena and camera orbit. Feet never
// translate: breathing and head/ear attention are idle motion, not a sliding walk.
function groveDeer(scene) {
  const root=new THREE.Group();root.name='grove-sika-deer';root.position.set(14.7,0.018,6.8);root.rotation.y=-0.9;scene.add(root);
  const floor=scene.getObjectByName('grove-flat-duel-earth');floor.updateMatrixWorld(true);
  const hit=new THREE.Raycaster(new THREE.Vector3(root.position.x,4,root.position.z),new THREE.Vector3(0,-1,0)).intersectObject(floor,false)[0];
  if(hit) root.position.y=hit.point.y+0.015;
  const K=new Kit(79421),fur=0x9b7150,dark=0x473b31,cream=0xd9c7a7;
  const ellipsoid=(bin,color,pos,scale,rot=[0,0,0])=>put(K,bin,new THREE.IcosahedronGeometry(1,1),color,pos,rot,scale,{noise:0.025,vary:0.035});
  ellipsoid('body',fur,[0,1.02,0],[0.27,0.31,0.63]);
  ellipsoid('body',0x846047,[0,1.06,0.38],[0.245,0.33,0.24]);
  ellipsoid('body',cream,[0,0.835,0.08],[0.22,0.105,0.43]);
  ellipsoid('body',cream,[0,1.06,-0.586],[0.192,0.22,0.055]);
  branch(K,[0,1.14,0.39],[0,1.55,0.66],0.17,0.105,fur,'body',8);
  branch(K,[0,1.2,-0.56],[0,1.08,-0.78],0.07,0.035,cream,'body',7);
  for(const s of [-1,1]) {
    for(let i=0;i<7;i++) ellipsoid('body',cream,[s*(0.255-Math.abs(i%3-1)*0.016),1.12+(i%2)*0.09,-0.35+i*0.105],[0.009,0.025,0.043]);
    for(const front of [false,true]) {
      const hip=[s*0.19,0.97,front?0.38:-0.40],knee=[s*0.21,0.52,front?0.34:-0.57],ankle=[s*0.20,0.14,front?0.39:-0.40];
      branch(K,hip,knee,front?0.064:0.086,0.042,fur,'legs',7);branch(K,knee,ankle,0.04,0.022,0x76563e,'legs',6);
      ellipsoid('legs',dark,[s*0.20,0.055,front?0.405:-0.37],[0.038,0.07,0.072]);
    }
  }
  const head=new THREE.Group();head.name='grove-deer-head';head.position.set(0,1.54,0.65);root.add(head);
  ellipsoid('head',fur,[0,0.065,0.105],[0.125,0.165,0.23]);
  ellipsoid('head',0x997958,[0,-0.008,0.29],[0.083,0.083,0.16]);
  ellipsoid('head',dark,[0,0.012,0.413],[0.071,0.06,0.042]);
  for(const s of [-1,1]) {
    ellipsoid('head',0x211f1a,[s*0.112,0.107,0.163],[0.017,0.021,0.026]);
    ellipsoid('head',0xe4d7bb,[s*0.116,0.122,0.159],[0.007,0.008,0.011]);
    ellipsoid('ears',fur,[s*0.17,0.245,-0.027],[0.07,0.20,0.045],[0,0,-s*0.52]);
    ellipsoid('ears',cream,[s*0.17,0.247,0.004],[0.043,0.143,0.014],[0,0,-s*0.52]);
    const a=[s*0.075,0.19,-0.055],b=[s*0.12,0.38,-0.16],c=[s*0.18,0.65,-0.2];
    branch(K,a,b,0.023,0.019,0xb7a182,'head',6);branch(K,b,c,0.019,0.007,0xb7a182,'head',6);
    branch(K,[s*0.105,0.32,-0.12],[s*0.13,0.47,0.05],0.014,0.005,0xb7a182,'head',5);
    branch(K,[s*0.15,0.51,-0.18],[s*0.23,0.61,-0.08],0.012,0.005,0xb7a182,'head',5);
  }
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true});
  const meshes={};for(const bin of ['body','legs','head','ears']) { const mesh=K.mesh(bin,material,{cast:true,receive:true});mesh.name=`grove-deer-${bin}`;(bin==='head'||bin==='ears'?head:root).add(mesh);meshes[bin]=mesh;for(const g of K.bins[bin])g.dispose(); }
  // The forest lies outside the fighter shadow map. A restrained flat contact
  // shade anchors the four fixed feet without adding a light or shadow camera.
  const shade=new THREE.Mesh(new THREE.CircleGeometry(1,16),new THREE.MeshBasicMaterial({color:0x172920,transparent:true,opacity:0.16,depthWrite:false}));
  shade.name='grove-deer-contact-shade';shade.rotation.x=-Math.PI/2;shade.scale.set(0.42,0.81,1);shade.position.y=-0.011;root.add(shade);
  return {root,update(time) { meshes.body.scale.y=1+Math.sin(time*1.3)*0.0025;head.rotation.y=Math.sin(time*0.19)*0.13;head.rotation.x=Math.sin(time*0.31)*0.035;meshes.ears.rotation.x=Math.sin(time*1.7)*0.035*Math.pow(Math.max(0,Math.sin(time*0.47)),6); }};
}

/** Build a bounded, disposable visual stage, using only isolated seeded RNG. */
export function buildSacredGrove(scene, { hemi, sun } = {}, { animals = true } = {}) {
  const r = rng(197719), K = new Kit(88291), foliage = [], windClock = { value: 0 };
  const sunOffset = { ...SUN_OFFSET };
  scene.background = new THREE.Color(GROVE_FOG.sky); scene.fog = new THREE.Fog(GROVE_FOG.color, GROVE_FOG.near, GROVE_FOG.far); // 무대를 떠나면 stages.js restore() 가 처음 안개로 되돌린다
  // 6월 오후: 따뜻한 해(노을빛 아님)가 고도 약 40°에서, 하늘빛 반구광은 조금 줄여 해와 그늘의 차이를 살린다
  if (hemi) { hemi.color.set(0xd2e3dc); hemi.groundColor.set(0x5f7650); hemi.intensity = 1.05; }
  if (sun) { sun.color.set(0xffe2b0); sun.intensity = 2.0; sun.position.set(sunOffset.x, sunOffset.y, sunOffset.z); }
  const soil = soilTexture(), floorTex = floorTexture(), bark = barkTexture(), heroBark = heroBarkTexture(bark);
  ground(scene, floorTex);
  afternoonSky(scene);

  // Almost flush moss stones follow the shared combat boundary.
  for (let i = 0; i < 61; i++) {
    if (i % 19 < 3) continue;
    const a = i / 61 * TAU, d = ARENA.radius + 0.07 + (r() - 0.5) * 0.1;
    put(K, 'stone', new THREE.DodecahedronGeometry(1, 0), i % 4 === 0 ? 0xa0a698 : C.stone, [Math.cos(a) * d, -0.035, Math.sin(a) * d], [0, r() * TAU, 0], [0.21 + r() * 0.09, 0.075, 0.32 + r() * 0.15], { rough: 0.022, noise: 0.08 });
  }
  // Moss-stained boulders stay outside the full camera orbit including their size.
  for (let i = 0; i < 51; i++) {
    const a = r() * TAU, d = 14.2 + r() * 23, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x - HERO.x, z - HERO.z) < 7 || Math.hypot(x - 13.8, z - 13.7) < 4) continue;
    const size = 0.5 + r() * 1.45;
    put(K, 'stone', new THREE.DodecahedronGeometry(1, 0), C.stone, [x, size * 0.26, z], [r() * 0.3, r() * TAU, r() * 0.3], [size, size * 0.65, size * 0.8], { rough: 0.12, noise: 0.12, snow: 0.86, snowColor: C.moss });
  }
  const trunkSeed = pine(K, foliage, r, HERO.x, HERO.z, PINE_HEIGHT, PINE_RADIUS);
  sacredRope(K, trunkSeed); torii(K); stoneLanterns(K, r); rootGarden(K);

  // 둘레 숲 (10/11 다시 심음): 무리마다 그루 수·퍼짐·키가 다르고, 무리 안에서도 키 0.55~1.3 배·쌍둥이 줄기·
  //  어린 소나무가 섞여 높이서 봐도 줄 맞춘 조림지처럼 보이지 않는다. 무리 가장자리 나무는 바깥(빛 쪽)으로 기운다.
  //  신목 둘레 13.5 m 와 결투장에서 본 신목 뒤 통로(신목 너머 반폭 6.5 m)는 비워 신목 실루엣이 맑은 대기에 뜬다.
  //  안개가 다 덮는 78 m 밖에는 심지 않는다. 무리: [x, z, 그루, 퍼짐(m), 키 배율]
  const stands = [
    [-6, -21, 2, 1.8, 0.7], [-23, 3, 2, 2, 0.65], [-45, 10, 2, 9, 0.9], [-38, 40, 1, 10, 1.1],
    [-14, -50, 2, 10, 1.05], [-55, -14, 1, 9, 0.95], [60, -6, 1, 10, 1.05],
  ];
  const trunks = [], heroDir = Math.atan2(HERO.z, HERO.x), heroDist = Math.hypot(HERO.x, HERO.z);
  const freeSpot = (x, z) => {
    const d0 = Math.hypot(x, z);
    if (d0 < 17.5 || d0 > 78) return false;
    if (Math.hypot(x - HERO.x, z - HERO.z) < 13.5 || Math.hypot(x - 13.8, z - 13.7) < 6) return false;
    const off = Math.atan2(z, x) - heroDir, along = d0 * Math.cos(off);
    if (along > heroDist && Math.abs(d0 * Math.sin(off)) < 6.5) return false; // 신목 뒤 통로
    return trunks.every(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) > tr);
  };
  let tree = 0;
  // 숲 덩어리: 안쪽은 키 큰 'grove' 나무를 촘촘히, 가장자리(바깥 30 %)는 낮고 바깥으로 기운 나무로 벽을 닫는다
  GROVES.forEach(([gx, gz, R, count, hs]) => {
    for (let n = 0, tries = 0; n < count && tries < count * 12; tries++) {
      const a = r() * TAU, d = Math.sqrt(r()) * R, x = gx + Math.cos(a) * d, z = gz + Math.sin(a) * d;
      const edge = d / R, rim = edge > 0.7;
      if (!freeSpot(x, z)) continue;
      const out = Math.atan2(z - gz, x - gx) + (r() - 0.5) * 0.6;
      if (rim) forestPine(K, foliage, 7001 + tree * 13, x, z, 17 * hs * (0.5 + r() * 0.35), 0.24 + r() * 0.2, r() < 0.6 ? 'lean' : 'tall', out);
      else forestPine(K, foliage, 7001 + tree * 13, x, z, 17 * hs * (0.82 + r() * 0.36), 0.3 + r() * 0.22, 'grove', out);
      trunks.push([x, z, rim ? 1.5 : 1.6]); n++; tree++;
    }
    // 수관 지붕: 덩어리 위에 넓고 납작한 잎 덩어리를 겹쳐 얹어 나무 사이 하늘을 메운다 (인스턴스라 그리기 호출은 늘지 않는다)
    const roof = Math.round(R * R * 0.2), top = 17 * hs;
    for (let k = 0; k < roof; k++) {
      const a = r() * TAU, d = Math.sqrt(r()) * R * 0.78, x = gx + Math.cos(a) * d, z = gz + Math.sin(a) * d, w = 4.4 + r() * 1.8;
      foliage.push({ kind: Math.hypot(x, z) > 26 ? 'padFar' : 'pad' + k % 3, x, y: groundHeight(x, z) + top * (0.8 + r() * 0.16), z, sx: w, sy: w * 0.42, sz: w * (0.75 + r() * 0.2), a: r() * TAU, tilt: (r() - 0.5) * 0.1, color: r() < 0.4 ? C.needleDeep : r() < 0.25 ? C.needleLit : C.needle });
    }
  });
  // 덩어리 사이 트인 곳의 외톨이·쌍둥이 몇 그루와, 안개 속 먼 숲 그림자(간단한 꼴)
  stands.forEach(([sx, sz, count, spread, hs]) => {
    for (let n = 0, tries = 0; n < count && tries < count * 8; tries++) {
      const prev = trunks.length && n > 0 && r() < 0.45 ? trunks[trunks.length - 1] : null;
      const a = r() * TAU, d = prev ? 1.7 + r() * 0.9 : Math.sqrt(r()) * spread;
      const x = (prev ? prev[0] : sx) + Math.cos(a) * d, z = (prev ? prev[1] : sz) + Math.sin(a) * d;
      if (!freeSpot(x, z)) continue;
      const d0 = Math.hypot(x, z), young = r() < 0.17, edge = Math.hypot(x - sx, z - sz) / Math.max(spread, 1);
      const h = young ? 6 + r() * 3.5 : 17 * hs * (0.55 + r() * 0.75);
      const pick = r();
      const kind = young ? (pick < 0.5 ? 'tall' : 'lean') : edge > 0.65 && pick < 0.55 ? 'lean' : pick < 0.2 && d0 > 22 ? 'spread' : pick < 0.33 ? 'lean' : 'tall';
      forestPine(K, foliage, 7001 + tree * 13, x, z, h, (young ? 0.16 : 0.26) + r() * 0.4 * hs, kind, edge > 0.4 ? Math.atan2(z - sz, x - sx) + (r() - 0.5) * 0.8 : undefined);
      trunks.push([x, z, young ? 1.4 : 2.0]); n++; tree++;
    }
  });
  const clumps = [...GROVES, ...GROVES, ...stands]; // 덤불은 숲 덩어리 둘레에 두 몫

  // Low growth follows patches of trees and leaves irregular open seams, rather
  // than a continuous row of identical green boulders around the clearing.
  for (let i = 0; i < 115; i++) {
    const stand = clumps[i % clumps.length], a = r() * TAU, d = Math.sqrt(r()) * 8.5;
    const x = stand[0] + Math.cos(a) * d, z = stand[1] + Math.sin(a) * d;
    if (Math.hypot(x,z) < 18.5 || Math.hypot(x,z) > 50) continue; // 50 m 밖 덤불은 대기에 묻힌다
    if (Math.hypot(x - HERO.x, z - HERO.z) < 7 || Math.hypot(x - 13.8, z - 13.7) < 5) continue;
    for (let j = 0; j < 2; j++) { const w = 0.68 + r() * 0.88; foliage.push({ kind:'shrub', x:x+(r()-0.5)*2.4, y:0.3+r()*1.0, z:z+(r()-0.5)*2.4, sx:w*1.65, sy:w*0.95, sz:w*1.1, a:r()*TAU, tilt:(r()-0.5)*1.2, color:r()<0.3?C.leaf:C.leafDeep }); }
  }

  const canopyMat = quietWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), windClock);
  // 잎 덩어리는 모양 여섯 가지(둘레 소나무 셋 · 먼 소나무 · 신목 · 덤불)를 각각 인스턴스 한 묶음으로 그린다 (그리기 호출 6번).
  //  신목만 80삼각형 다면체를 뭉친 고운 덩어리, 둘레는 20삼각형 다면체 뭉치, 40m 밖(안개 속)은 8삼각형 팔면체 뭉치.
  const shapes = { pad0: () => cloudPadGeometry(11, 0, 5), pad1: () => cloudPadGeometry(23, 0, 5), pad2: () => cloudPadGeometry(37, 0, 5), padFar: () => cloudPadGeometry(71, -1, 6), hero: () => cloudPadGeometry(53, 1, 7), shrub: () => canopyGeometry(false) };
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  for (const [kind, make] of Object.entries(shapes)) {
    const selected = foliage.filter(f => f.kind === kind);
    if (!selected.length) continue;
    const leaves = new THREE.InstancedMesh(make(), canopyMat, selected.length);
    selected.forEach((f, i) => {
      dummy.position.set(f.x, f.y, f.z); dummy.rotation.set(f.tilt * 0.22, f.a, -0.04);
      dummy.scale.set(f.sx, f.sy, f.sz); dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix); leaves.setColorAt(i, color.set(f.color));
    });
    leaves.name = `grove-pine-${kind}`; leaves.castShadow = false; leaves.computeBoundingSphere(); leaves.boundingSphere.radius += 0.2; scene.add(leaves);
  }
  plants(scene, r);
  const water = stream(scene, K, r); distantHaze(scene); lightShafts(scene, r);
  const deer = animals ? groveDeer(scene) : null;

  const materials = {
    heroBark: new THREE.MeshStandardMaterial({ map: heroBark, vertexColors: true, roughness: 1 }),
    bark: new THREE.MeshStandardMaterial({ map: bark, vertexColors: true, roughness: 0.97 }),
    stone: new THREE.MeshStandardMaterial({ map: soil, vertexColors: true, roughness: 1, flatShading: true }),
    ritual: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    paper: quietWind(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1, flatShading: true }), windClock, true),
    paint: new THREE.MeshStandardMaterial({ map: bark, vertexColors: true, roughness: 0.95 }),
  };
  for (const [bin, material] of Object.entries(materials)) {
    const mesh = K.mesh(bin, material, { cast: false, receive: true, // 돌은 납작하거나 그림자 상자(±4 m) 밖이라 그림자 패스에서 뺀다 (10/11)
      light: (bin === 'heroBark' || bin === 'bark') ? (x, y, z) => {
      const near = 1 - THREE.MathUtils.smoothstep(Math.hypot(x - HERO.x, z - HERO.z), 4, 7.5);
      const front = THREE.MathUtils.smoothstep(HERO.x - x, 0.2, 2.4);
      const sunPatch = Math.exp(-Math.pow((z - HERO.z + y * 0.28 + 0.7) / 1.3, 2)) * front * near;
      return [sunPatch * 0.5, sunPatch * 0.38, sunPatch * 0.21];
    } : null });
    if (mesh) { mesh.name = `grove-${bin}`; scene.add(mesh); } else material.dispose();
    for (const geometry of K.bins[bin] || []) geometry.dispose();
  }

  // Twenty-four restrained drifting seeds, kept outside the duel floor.
  const count = 24, positions = new Float32Array(count * 3), seeds = [];
  for (let i = 0; i < count; i++) { const a = r() * TAU, d = 12 + r() * 13; seeds.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: 1.3 + r() * 5, phase: r() * TAU }); positions.set([seeds[i].x, seeds[i].y, seeds[i].z], i * 3); }
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: 0xe0dcc1, size: 0.028, transparent: true, opacity: 0.48, depthWrite: false })); motes.name = 'grove-drifting-seeds'; scene.add(motes);
  let time = 0, gust = 0, lastDetail = -100, lastGrove = -100, lastPaper = -100;
  let previousBough = Math.sin(HERO.x * 0.12 + HERO.z * 0.17), previousPaper = Math.sin(HERO.z * 0.73);
  const stage = {
    sunOffset,
    fighterLight: { color: 0xf6e8cc, rimColor: 0xf1e4c2, level: 0.84, rim: 1.08 }, // 오후 햇빛 쪽으로 조금 따뜻하게
    update(dt) {
      const step = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), 0.1); time += step; gust *= Math.exp(-step * 1.6);
      water.offset.y = time * 0.012; windClock.value = time; deer?.update(time);
      // Sound follows a real visible wind phase; no timers survive stage clearing.
      const boughWind = Math.sin(time * 0.38 + HERO.x * 0.12 + HERO.z * 0.17);
      const paperWind = Math.sin(time * 0.67 + HERO.z * 0.73);
      if (boughWind > 0.84 && previousBough <= 0.84 && time - lastGrove >= 7 && time - lastDetail >= 2.2) {
        stage.onEvent?.('stageDetail', { kind: 'groveRustle', amp: 0.26 + gust * 0.08, pos: { x: HERO.x, y: 8, z: HERO.z }, seed: 1977191, time }); lastGrove = lastDetail = time;
      }
      if (paperWind > 0.82 && previousPaper <= 0.82 && time - lastPaper >= 7 && time - lastDetail >= 2.2) {
        stage.onEvent?.('stageDetail', { kind: 'paperRustle', amp: 0.2 + gust * 0.06, pos: { x: HERO.x - 3.2, y: 2.5, z: HERO.z }, seed: 1977192, time }); lastPaper = lastDetail = time;
      }
      previousBough = boughWind; previousPaper = paperWind;
      for (let i = 0; i < count; i++) { const p = seeds[i]; positions[i * 3] = p.x + Math.sin(time * 0.18 + p.phase) * (0.45 + gust * 0.2); positions[i * 3 + 1] = p.y + Math.sin(time * 0.23 + p.phase) * 0.5; positions[i * 3 + 2] = p.z + Math.cos(time * 0.12 + p.phase) * 0.4; }
      moteGeo.attributes.position.needsUpdate = true;
    },
    excite(amount = 0) { if (Number.isFinite(amount)) gust = Math.min(1.5, gust + Math.max(0, amount) * 0.12); },
  };
  return stage;
}
