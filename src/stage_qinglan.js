// ─────────────────────────────────────────────────────────────
//  청람잔도 (`qinglan`) — 김씨(renji)의 무대. 초여름 맑은 한낮, 가상의 큰 강 협곡 위 화강암 쉼터와 산길
//   출처: 샛별 저장소 5a4e96c 판(src 는 3d3ec11 '큰 강과 겹친 능선' 그대로)으로 되돌림 — 사장님 10/15 23:1x
//    '초기 맵의 문제를 개선하는 정도로 되돌려. 디자인 전체를 지금처럼 뜯어 고치기 전으로.'
//    바위 쉼터·뒤 화강암 어깨·돌계단 둘·작은 정자·샘 상자·듬성한 소나무, 빛 색·세기·하늘·안개는 샛별 판 그대로다(해는 방위만 — ⑥. 먼 경치는 stage_qinglan_vista.js).
//   우리 판에서 고친 것 — 무대 리뷰 10/10 §2-2 의 여섯 가지만 (docs/stages.md '청람잔도 되돌림', 확인표 1815~):
//    ① 잔도: 쉼터 뒤 화강암 어깨의 곧게 선 면에 옛 판자 잔도 한 줄 (plankRoad)
//    ② 떠 보이던 바위: 뒤 어깨 밑 네모 바위는 밑동을 땅속까지 내리고 밑을 어둡게 (능선 바위·언덕 바위는 vista)
//    ③ 바닥 밝기: 아주 밝은 회백색 → 중간 밝기 화강암 (FLOOR_TONE)
//    ④ 바닥 가운데 방사 줄무늬: 길쭉한 부채꼴 삼각형에 꼭짓점마다 흔든 밝기가 바퀴살처럼 번진 것 → 고른 격자 + 넓고 부드러운 얼룩
//    ⑤ 가장자리: 둥근 판처럼 끊기던 끝 → 바위 턱 + 그 밖으로 곧게 떨어지는 바위 면
//    ⑥ 세로 면 명암: 바위·절벽 면의 기울기·지층·밑동 그늘을 꼭짓점 색에 굽고, 해는 높이(한낮) 그대로 방위만 경기 카메라 왼쪽 뒤로 (SUN_OFFSET)
//   그림만: 물리 바닥·경계 벽은 다른 무대와 같다. 카메라 궤도 10.5 m 안은 납작한 바닥뿐. 시뮬은 무대를 읽지 않는다.
//   (아래 영어 줄 설명은 샛별 저장소 원문 그대로 둔 것이다)
// ─────────────────────────────────────────────────────────────
// Clear summer noon above a fictional great-river gorge and granite mountain trail.
// All scenery is visual only. The shared duel plane/physics remain untouched.
import * as THREE from 'three';
import { Kit, rng, canvasTex, box, cyl, limb } from './stage_kit.js';
import { buildQinglanVista } from './stage_qinglan_vista.js';

const TAU = Math.PI * 2;
class OwnedKit extends Kit {
  putM(bin, geo, color, matrix, options = {}) {
    try { return super.putM(bin, geo, color, matrix, options); }
    finally { geo.dispose(); }
  }
}
function geo(points) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(points.flatMap((_,i) => i%3 ? [] : [(points[i]+32)/64,(points[i+2]+32)/64]), 2));
  g.computeVertexNormals(); return g;
}
function terraceMap() {
  const r = rng(801301);
  return canvasTex(1024,1024,(g,w,h)=>{
    g.fillStyle='#b2b9ab';g.fillRect(0,0,w,h);
    for(let i=0;i<250;i++){
      const x=r()*w,y=r()*h,rad=12+r()*100;
      const grad=g.createRadialGradient(x,y,0,x,y,rad);
      grad.addColorStop(0,i%4?'rgba(238,240,230,.13)':'rgba(84,91,82,.15)');grad.addColorStop(1,'rgba(145,145,111,0)');
      g.fillStyle=grad;g.fillRect(x-rad,y-rad,rad*2,rad*2);
    }
    for(let i=0;i<34;i++){
      let x=r()*w,y=r()*h;const angle=r()*Math.PI*2;
      g.beginPath();g.moveTo(x,y);
      for(let j=0;j<7;j++){x+=Math.cos(angle+(r()-.5)*.9)*(8+r()*30);y+=Math.sin(angle+(r()-.5)*.9)*(8+r()*30);g.lineTo(x,y);}
      g.strokeStyle=i%4?'rgba(83,90,70,.46)':'rgba(231,235,220,.45)';g.lineWidth=i%4?1.1:2.6;g.stroke();
    }
    for(let i=0;i<9000;i++){
      g.fillStyle=i%2?'rgba(242,244,231,.14)':'rgba(71,77,56,.10)';g.fillRect(r()*w,r()*h,.7+r()*1.8,.5+r());
    }
    // Worn traffic track: no artificial paving grid across the natural rock.
    g.lineCap='round';g.strokeStyle='rgba(226,223,202,.12)';g.lineWidth=66;
    g.beginPath();g.moveTo(80,130);g.bezierCurveTo(220,460,670,660,900,600);g.stroke();
  });
}
const rim = a => 23.5 - 9*Math.max(0,Math.cos(a))**3 + .55*Math.sin(3*a+.4)+.35*Math.sin(9*a);

// ── 우리 판: 바닥 밝기 ③ · 격자 ④ · 턱과 바위 면 ⑤ · 세로 면 명암 ⑥ ─────────
// ③ 바닥 꼭짓점 색 — 샛별 질감(#b2b9ab 바탕 · 얼룩 · 금)에 곱한다. 샛별 판은 흰색(곱하기 1)이라 해 아래 바닥이 화면에서 가장 밝은 면(L* 약 76)이 되어
//  밝은 옷의 플레이어가 묻혔다 → 질감은 그대로 두고 밝기만 중간 화강암으로 [사장님 확인 전 — 확인표 1816]
const FLOOR_TONE = 0xbcb9ad;
const LIP_W = 1.0; // ⑤ 바위 턱 폭 (m) — 가장자리 rim(a) 안쪽 1 m 에서 오르기 시작한다 [1818]
const RING = 144; // 바닥·턱·바위 면이 함께 쓰는 바퀴살 수 (턱의 갈라진 틈이 꼭짓점에 걸리게 — 바깥 고리에서 1 m 안팎)
/** ⑤ 턱이 낮아지는 방위 (돌계단 둘의 첫 단 · 정자 뒤) — [가운데 각, 반폭] (라디안, 샛별 rim 의 각: x = r cos a, z = 0.94 r sin a) */
const LIP_NOTCH = [[2.229, .12], [-2.229, .12], [2.51, .13]];
/** ⑤ 턱이 갈라진 자리 (라디안) — 열두 곳, 높이가 1/3 로 꺼진 좁은 틈 */
const LIP_CRACK = [.31, .9, 1.47, 1.95, 2.82, 3.38, 3.86, 4.42, 4.97, 5.45, 5.86, 6.12];
const angGap = (a, c) => Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c)));
/** ⑤ 턱 높이 (m): 0.15~0.45 로 들쭉날쭉 · 갈라진 틈 · 돌계단·정자 자리에서 거의 0 [1818] */
const lipH = (a) => {
  let h = .3 + .08 * Math.sin(5 * a + 1.3) + .05 * Math.sin(17 * a + .4) + .035 * Math.sin(37 * a + 2.2);
  for (const c of LIP_CRACK) h *= .33 + .67 * THREE.MathUtils.smoothstep(angGap(a, c), .012, .05);
  for (const [c, w] of LIP_NOTCH) h *= THREE.MathUtils.smoothstep(angGap(a, c), w * .45, w);
  return Math.max(h, .015);
};
/** ⑤ 턱 바깥 모서리를 들쭉날쭉하게 (m) — 위에서 보면 매끈한 곡선이 아니라 깨진 바위 가장자리 */
const lipWob = (a) => .11 * Math.sin(23 * a + .7) + .06 * Math.sin(41 * a + 1.9) + .04 * Math.sin(67 * a);
/** 턱 단면: [rim 에서 안쪽(−)·바깥(+) 거리 m, 높이 비율, 모서리 흔들림 몫] — 안쪽 비탈 → 마루 → 바깥 모서리 */
const LIP = [[-LIP_W, 0, 0], [-.66, .5, .2], [-.44, .88, .5], [-.24, 1, .8], [-.08, .82, 1], [0, .5, 1]];
/** 턱 밖 바위 면: [rim 밖 거리 m, 높이 m] — 처음 4.4 m 는 거의 곧게(세로 갈비 rib 를 더한다), 그 아래는 샛별 판 비탈(7 m 마다 0.7 m 씩 · 맨 아래 8 m) */
const FACE = [[.06, -1.0], [.14, -2.4], [.32, -4.4], [.7, -7], [1.4, -14], [2.1, -21], [8, -28]];
const ribOf = (a) => .26 * Math.sin(13 * a + .5) + .1 * Math.sin(29 * a + 1.1);
/** 넓고 부드러운 바닥 얼룩 (±약 8 %, 파장 8~25 m — 고리 간격 1 m 안팎보다 훨씬 길어 삼각형 꼴이 비치지 않는다) */
const floorMottle = (x, z) => 1 + .045 * Math.sin(x * .29 + z * .17 + .6) + .035 * Math.sin(x * .11 - z * .23 + 2.1) + .022 * Math.sin((x + z) * .53 + .3);

/** 꼭짓점 색을 fn(x, y, z, nx, ny, nz) 배로 (Kit 이 칠한 색 위에) */
function tintBy(g, fn) {
  const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
  for (let i = 0; i < p.count; i++) {
    const k = fn(p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i));
    c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
  }
}
/** ⑥ 세로 면 명암: 해가 높은 한낮이라 세로 면이 다 같은 그늘빛으로 납작했다 → 위를 볼수록 밝고 세로 면일수록 어둡게, 세로 면에는 가로 지층 줄,
 *  ao(x, y, z) 가 있으면 밑동 그늘을 곱한다 (면마다 법선이 하나인 각진 메쉬라 면 단위로 결이 생긴다) [1822] */
function shadeRock(g, { vert = .3, strata = .06, ao = null } = {}) {
  tintBy(g, (x, y, z, nx, ny) => {
    let k = 1 - vert * (1 - THREE.MathUtils.smoothstep(ny, .12, .86));
    if (Math.sin(y * 1.9 + Math.sin(x * .21 + z * .17) * 1.4) > .55) k *= 1 - strata * (1 - Math.abs(ny));
    return ao ? k * ao(x, y, z) : k;
  });
}

function terrace(K) {
  // ④ 바닥: 고른 극좌표 격자(바퀴살 144 · 고리 24 — 고리 사이 0.6~1 m, 가운데 부채꼴은 반지름 1 m 안). 샛별 판은 바퀴살 72 · 고리 넷(0·4·8·11.8 m)의
  //  길쭉한 부채꼴에 Kit 기본 꼭짓점 밝기 흔들림(±6 %)이 얹혀, 꼭짓점 사이를 잇는 색이 가운데서 퍼지는 빛살로 보였다(법선은 모두 위 — 원인은 색).
  //  흔들림은 끄고 넓고 부드러운 얼룩만 칠한다. 바닥은 턱 안쪽 끝(rim − LIP_W)까지 y 0 으로 평평 [1817]
  const N = RING, S = 24, top = [];
  const P = (i, s) => { const a = i / N * TAU, r = s / S * (rim(a) - LIP_W); return [Math.cos(a) * r, 0, Math.sin(a) * r * .94]; };
  for (let s = 0; s < S; s++) for (let i = 0; i < N; i++) {
    const a = P(i, s), b = P(i + 1, s), c = P(i, s + 1), d = P(i + 1, s + 1);
    if (s === 0) top.push(...a, ...d, ...c); else top.push(...a, ...b, ...c, ...b, ...d, ...c);
  }
  // ⑤ 바위 턱: 안쪽 비탈 → 둥근 마루(0.15~0.45 m) → 바깥 모서리(들쭉날쭉). 바닥과 같은 질감·재질(위에서 보면 바닥이 그대로 솟은 바위)
  const Q = (i, k) => { const a = i / N * TAU, r = rim(a) + LIP[k][0] + lipWob(a) * LIP[k][2], y = lipH(a) * LIP[k][1]; return [Math.cos(a) * r, y, Math.sin(a) * r * .94]; };
  for (let k = 0; k < LIP.length - 1; k++) for (let i = 0; i < N; i++) {
    const a = Q(i, k), b = Q(i + 1, k), c = Q(i, k + 1), d = Q(i + 1, k + 1);
    top.push(...a, ...b, ...c, ...b, ...d, ...c);
  }
  const floor = K.put('floor', geo(top), FLOOR_TONE, undefined, undefined, 1, { noise: 0, vary: 0 });
  tintBy(floor, (x, y, z) => {
    const a = Math.atan2(z / .94, x), r = Math.hypot(x, z / .94), foot = rim(a) - LIP_W;
    const footShade = 1 - .14 * Math.max(0, 1 - Math.abs(r - foot) / .7); // 턱 밑동 그늘
    const crest = y > .02 ? 1 + .1 * Math.min(1, y / .3) : 1; // 턱 마루는 닳아 밝게 — 경기 카메라에서 바닥 끝에 밝은 띠로 읽힌다
    return floorMottle(x, z) * footShade * crest;
  });
  // ⑤ 턱 밖 바위 면: 턱 바깥 모서리에서 4.4 m 는 거의 곧게(세로 갈비 · 가로 지층), 그 아래는 샛별 판처럼 비탈로 −28 m 까지
  const sides = [];
  const R = (i, k) => {
    const a = i / N * TAU;
    if (k === 0) return Q(i, LIP.length - 1);
    const [dd, y] = FACE[k - 1], wobble = k > 3 ? Math.sin(a * 13 + k - 3) * .4 : ribOf(a) * (k / 3);
    const d = rim(a) + dd + wobble + (k <= 3 ? lipWob(a) : 0);
    return [Math.cos(a) * d, y, Math.sin(a) * d * .94];
  };
  for (let k = 0; k < FACE.length; k++) for (let i = 0; i < N; i++) {
    const a = R(i, k), b = R(i + 1, k), c = R(i, k + 1), d = R(i + 1, k + 1);
    sides.push(...a, ...b, ...c, ...b, ...d, ...c);
  }
  const skirt = K.put('rock', geo(sides), 0x899582, undefined, undefined, 1, { noise: .08 });
  // 위쪽 곧은 띠는 짙은 화강암(물 얼룩 세로 줄), 아래로 갈수록 샛별 판 회록 — 거기에 ⑥ 세로 면 명암
  const upper = new THREE.Color(0x7c8174), base = new THREE.Color(0x899582), tmp = new THREE.Color();
  const sc = skirt.attributes.color, sp = skirt.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const y = sp.getY(i), x = sp.getX(i), z = sp.getZ(i);
    const t = THREE.MathUtils.smoothstep(y, -9, -2.5), k = sc.getX(i) / base.r;
    const streak = .9 + .1 * Math.sin(Math.atan2(z, x) * 41 + Math.sin(y * .3));
    tmp.copy(base).lerp(upper, t).multiplyScalar(k * streak);
    sc.setXYZ(i, tmp.r, tmp.g, tmp.b);
  }
  shadeRock(skirt, { vert: .26, strata: .07, ao: (x, y) => (y > -.2 ? .82 : 1) }); // 턱 바로 밑 그늘
}
function pine(K,x,y,z,scale,seed){
  const r=rng(seed);K.push([x,y,z],r()*6.28,scale);
  const bends=[[0,0,0],[.18,1.7,.08],[-.25,3.1,.2],[.3,4.2,0]];
  for(let i=0;i<3;i++)limb(K,'wood',bends[i],bends[i+1],.17-i*.04,.12-i*.035,0x645d48,{},7);
  for(let i=0;i<5;i++){
    const a=i*2.4+r()*.3,base=[-.18,1.8+i*.44,.1],end=[Math.cos(a)*(1.2+r()*.4),2.5+i*.42,Math.sin(a)*(1+r()*.6)];
    limb(K,'wood',base,end,.075,.025,0x5b5743,{},6);
    const points=[],rad=1.3+r()*.3;
    for(let j=0;j<12;j++){
      const a=j/12*Math.PI*2,b=(j+1)/12*Math.PI*2;
      points.push(end[0],end[1]+.48,end[2],end[0]+Math.cos(a)*rad,end[1]+.06+Math.sin(a*5)*.1,end[2]+Math.sin(a)*rad*.7,end[0]+Math.cos(b)*rad,end[1]+.06+Math.sin(b*5)*.1,end[2]+Math.sin(b)*rad*.7);
    }
    K.put('leaf',geo(points),i%2?0x34583b:0x466b42,undefined,undefined,1,{vary:.08});
  }K.pop();
}
// 뒤 화강암 어깨 격자 (샛별 graniteBack 의 at(i, j) 그대로 — 잔도가 면 자리를 읽으려고 밖으로 꺼냈다)
const GB_N = 52, GB_ROWS = 7;
function graniteAt(i, j) {
  const z=-78+i*3,t=j/GB_ROWS;
  const crest=11+5*Math.sin(i*.32)+4*Math.sin(i*.79+.6)+2*Math.sin(i*1.67);
  const fold=1.8*Math.sin(i*.6)+.6*Math.sin(i*2.6+j*.9);
  return [-22.5-16*t-fold-2*Math.sin(t*8+i*.2),-9+(crest+9)*t,z];
}
/** 뒤 어깨 메쉬 위 (z, y) 자리의 x — 메쉬 삼각형(a, c, b)·(b, c, d)를 그대로 따라 푼다 (면이 쉼터 쪽 +x 를 본다). 범위 밖이면 null */
function graniteFaceX(z, y) {
  const fi = (z + 78) / 3, i = Math.floor(fi);
  if (i < 0 || i >= GB_N) return null;
  const u = fi - i;
  for (let j = 0; j < GB_ROWS; j++) {
    const A = graniteAt(i, j), B = graniteAt(i + 1, j), C = graniteAt(i, j + 1), D = graniteAt(i + 1, j + 1);
    const lo = A[1] + (B[1] - A[1]) * u, hi = C[1] + (D[1] - C[1]) * u;
    if (y < lo - 1e-6 || y > hi + 1e-6) continue;
    for (const [p, q, s] of [[A, C, B], [B, C, D]]) {
      const det = (q[1] - s[1]) * (p[2] - s[2]) + (s[2] - q[2]) * (p[1] - s[1]);
      const l1 = ((q[1] - s[1]) * (z - s[2]) + (s[2] - q[2]) * (y - s[1])) / det;
      const l2 = ((s[1] - p[1]) * (z - s[2]) + (p[2] - s[2]) * (y - s[1])) / det;
      if (l1 >= -1e-6 && l2 >= -1e-6 && l1 + l2 <= 1 + 1e-6) return l1 * p[0] + l2 * q[0] + (1 - l1 - l2) * s[0];
    }
  }
  return null;
}
function graniteBack(K){
  // A continuous broken granite shoulder: broad slabs and ridges, not boulder domes.
  const p=[],n=GB_N,rows=GB_ROWS;
  const at=graniteAt;
  for(let i=0;i<n;i++)for(let j=0;j<rows;j++){
    const a=at(i,j),b=at(i+1,j),c=at(i,j+1),d=at(i+1,j+1);p.push(...a,...c,...b,...b,...c,...d);
  }
  const wall=K.put('rock',geo(p),0x88978b,undefined,undefined,1,{vary:.04});
  const wp=wall.attributes.position,wn=wall.attributes.normal,wc=wall.attributes.color;
  const rockColor=new THREE.Color(0x89968b),pineFloor=new THREE.Color(0x537044),tone=new THREE.Color();
  for(let i=0;i<wp.count;i++){
    const growth=Math.max(0,Math.sin(wp.getZ(i)*.25+wp.getY(i)*.14))*.5+Math.max(0,wn.getY(i)-.45)*.6;
    tone.copy(rockColor).lerp(pineFloor,Math.min(.8,growth));wc.setXYZ(i,tone.r,tone.g,tone.b);
  }
  // ⑥ 세로 면 명암 + 쉼터 뒤 틈 밑(높이 −2 m 아래)으로 갈수록 그늘
  shadeRock(wall, { vert: .34, strata: .07, ao: (x, y) => .8 + .2 * THREE.MathUtils.smoothstep(y, -9, -2) });
  for(const i of [8,14,20,28,36,44]){const v=at(i,rows);pine(K,v[0],v[1]-.2,v[2],.9+(i%3)*.12,9111+i);}
  for(let i=0;i<15;i++){
    const z=-64+i*9,x=-28-3*Math.sin(i*.9),y=1.2+Math.max(0,Math.sin(i*.7))*3;
    // ② 떠 보이던 네모 바위: 윗면 자리는 샛별 판 그대로 두고 밑으로 6 m 더 길게(비탈 아래쪽 모서리가 비탈 속에 묻힘), 땅에 닿는 밑동을 어둡게 [1820]
    const top=y-.8+1.8, bottom=top-3.6;
    const rock=K.put('rock',box(4.8,3.6+6,6.1,1,4,1),i%2?0x8e998c:0xa2aaa0,[x,top-(3.6+6)/2,z],[.16*Math.sin(i),.12*Math.sin(i*2),.1],1,{rough:.35,noise:.04});
    shadeRock(rock, { vert: .22, strata: .05, ao: (_x, yy) => .55 + .45 * THREE.MathUtils.smoothstep(yy, bottom - 1.5, bottom + 2.2) });
  }
}
function restAndTrail(K) {
  graniteBack(K);
  // Stone stairs hug the rear mountain, with a masonry foundation continuing downward.
  for(const sign of [-1,1])for(let i=0;i<22;i++){
    const z=sign*(17+i*1.35),x=-14-i*.52-Math.sin(i*.25)*1.1,y=i*.33;
    K.put('rock',box(3.7,8+y,1.65),0x949f95,[x,y/2-4,z],[0,sign*-.3,0],1,{rough:.12,vary:.06});
    K.put('stone',box(3.6,.18,1.53),i%3?0xb5bcad:0xa8b4a9,[x,y+.03,z],[0,sign*-.3,0],1,{rough:.04});
    if(i%3===0){
      const px=x+1.75;K.put('stone',box(.23,1,.23),0xa8b1a4,[px,y+.5,z],undefined,1,{rough:.025});
      K.put('stone',cyl(.19,.16,.14,6),0xbbc1b3,[px,y+1.02,z]);
      if(i<20)limb(K,'stone',[px,y+.78,z],[px-1.6,y+1.77,z+sign*4.05],.075,.075,0xa3aea1,{},5);
    }
  }
  // Small roadside shelter: curved dark roof and a plain stone bench.
  K.push([-17,0,12],-.18);
  for(const x of [-1.8,1.8])for(const z of [-1.3,1.3]){
    K.put('stone',cyl(.18,.24,.26,8),0x9bada2,[x,.13,z]);limb(K,'wood',[x,.2,z],[x,3,z],.1,.085,0x716451,{},7);
  }
  for(const z of [-1.35,1.35])limb(K,'wood',[-2,2.75,z],[2,2.75,z],.1,.1,0x766c58,{},6);
  for(const sign of [-1,1])for(let i=0;i<22;i++){
    const x=-2.18+i*.21,strip=[];
    const roof=(xx,t)=>[xx,3.42-.75*Math.sin(t*Math.PI/2)+.23*t**6,sign*t*1.9];
    for(let j=0;j<8;j++){
      const a=roof(x,j/8),b=roof(x+.215,j/8),c=roof(x,(j+1)/8),d=roof(x+.215,(j+1)/8);
      if(sign===1)strip.push(...a,...c,...b,...b,...c,...d);else strip.push(...a,...b,...c,...b,...d,...c);
    }
    K.put('roof',geo(strip),i%3?0x465854:0x55665f);
  }
  limb(K,'roof',[-2.25,3.43,0],[2.25,3.43,0],.10,.10,0x677b72,{},6);
  K.put('stone',box(2.7,.18,.75),0x969f92,[0,.63,.52],undefined,1,{rough:.025});
  for(const x of [-.85,.85])K.put('stone',box(.36,.54,.57),0x88978a,[x,.27,.52]);
  K.put('shade',box(3.8,.012,2.8),0x87947b,[0,.012,0]);K.pop();
  // Keep the accepted visible spring/audio source in exactly the same place.
  K.put('rock',box(2.1,2.1,1.7),0x718776,[-18.1,.8,-8.5],[.08,-.2,-.13],1,{rough:.22});
  K.put('rock',box(2.5,.42,1.2),0x697d6b,[-17.2,1.85,-8],[.05,.14,-.08],1,{rough:.13});
  K.put('stone',cyl(.64,.80,.22,12),0x899681,[-17,.13,-8]);
  K.put('water',cyl(.55,.55,.01,16),0x6c9f9b,[-17,.247,-8]);
  pine(K,-15,0,-15,1.2,81265);pine(K,-15,0,17,1.3,81267);
  // Sparse edge greenery and stone shards frame the water, leaving the duel clear.
  for(const sign of [-1,1])for(let i=0;i<7;i++){
    const x=3+i*1.7,z=sign*(15.2-i*.85);
    K.put('stone',box(.8,.16,.45),i%2?0x9eaa98:0xadb7a7,[x,.05,z],[.06,i*.6,0],1,{rough:.1});
    for(let j=0;j<5;j++){
      const px=x+.23+j*.13,pz=z+.2;
      K.put('leaf',geo([px,.01,pz,px+.19,.23+j*.055,pz+.08,px+.045,.01,pz+.10]),j%2?0x6a8550:0x8c9867);
    }
  }
}

// ── ① 잔도 (무대 리뷰 10/10 §2-2 ① '잔도가 없다') ───────────────────────
/** 나뭇결 질감 (10/11 2차 옛 널 bfccc6e 와 같은 그림 — 회색조로 꼭짓점 색에 곱한다): 결이 가로로 흐르고 갈라진 틈·옹이 */
function grainMap() {
  const r = rng(801301);
  const tex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#d6d2cb'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const y = r() * h, a = 1 + r() * 3, ph = r() * 6;
      g.strokeStyle = r() < 0.6 ? `rgba(70,62,54,${0.08 + r() * 0.16})` : `rgba(255,252,245,${0.08 + r() * 0.12})`;
      g.lineWidth = 0.8 + r() * 2.2;
      g.beginPath();
      for (let x = -8; x <= w + 8; x += 16) { const yy = y + Math.sin(x * 0.02 + ph) * a; x < 0 ? g.moveTo(x, yy) : g.lineTo(x, yy); }
      g.stroke();
    }
    for (let i = 0; i < 26; i++) {
      const x = r() * w, y = r() * h, len = 40 + r() * 160;
      g.strokeStyle = 'rgba(40,34,30,.55)'; g.lineWidth = 1.5 + r() * 2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y + (r() - 0.5) * 6); g.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const x = r() * w, y = r() * h, rx = 6 + r() * 9;
      g.fillStyle = 'rgba(60,50,42,.5)'; g.beginPath(); g.ellipse(x, y, rx, rx * 0.55, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(60,50,42,.3)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y, rx * 1.9, rx * 0.9, 0, 0, TAU); g.stroke();
    }
  });
  tex.colorSpace = THREE.NoColorSpace; // 밝기 곱셈용 (색은 꼭짓점 색이 정한다)
  return tex;
}
/** 잔도 자리 [사장님 확인 전 — 확인표 1819]: 뒤 어깨 면이 높이 0~8 m 에서 거의 곧게 선 구간(z +4.6 → −21.5)을 따라
 *  y 3.7 → 5.9 m 로 완만히 오른다(약 5°). 널 폭(면에서 바깥으로) 1.35 m. 쉼터 가운데에서 약 33~40 m — 카메라 궤도 밖 */
const ROAD = { z0: 4.6, z1: -21.5, y0: 3.7, y1: 5.9, width: 1.35 };
/**
 * 옛 판자 잔도: 바위 구멍(어두운 네모)에 박은 통나무 들보 위에 면과 직각으로 놓은 두꺼운 널(들쭉날쭉한 폭·틈, 비바람에 바랜 회갈색, 이끼 낀 널 몇 장,
 *  빠진 널 한두 장), 들보 끝 밧줄, 아래 바위로 내려가는 비스듬한 버팀대, 바깥 가장자리의 껍질 벗긴 통나무 기둥(조금씩 기욺)과 늘어진 밧줄 난간 두 줄.
 *  널 안쪽 가장자리는 면에서 0.12 m 띄워 면의 굴곡을 따른다(들보 안쪽 끝은 바위 속으로). 양 끝은 튀어나온 바위 덩이에 가린다. 물리 없음
 */
function plankRoad(K) {
  const r = rng(801329);
  const { z0, z1, y0, y1, width } = ROAD;
  const BOARD = [0x8b8173, 0x7d7466, 0x948a7a, 0x726a5e, 0x857a68, 0x9a9282], MOSS = 0x7a7b63;
  const LOG = 0x6a5d4e, POST = 0x6e6252, ROPE = 0x8b7c5e, HOLE = 0x16130f;
  const yAt = (z) => THREE.MathUtils.lerp(y0, y1, (z0 - z) / (z0 - z1));
  // 면에서 가장 쉼터 쪽(+x)으로 나온 자리: 널 앞뒤 ±0.25 m · 들보 높이 ~ 널 윗면
  const clear = (z, y) => {
    let m = -Infinity;
    for (const dz of [-.25, 0, .25]) for (const dy of [-.35, -.15, .05]) { const f = graniteFaceX(z + dz, y + dy); if (f != null) m = Math.max(m, f); }
    return m;
  };
  // 널 자리를 먼저 정하고 안쪽 가장자리를 이웃 둘씩 보며 가장 바깥 값으로 고른다(면을 뚫지 않으면서 들쭉날쭉하지 않게)
  const boards = [];
  for (let z = z0; z > z1;) {
    const w = .24 + r() * .12;
    boards.push({ z: z - w / 2, w, t: .075 + r() * .02, gap: .02 + r() * .03, col: r() < .13 ? MOSS : BOARD[Math.floor(r() * BOARD.length)], miss: false, tilt: (r() - .5) * .035, roll: (r() - .5) * .02, sag: (r() - .5) * .015 });
    z -= w + boards.at(-1).gap;
  }
  for (let k = 0; k < boards.length; k++) boards[k].f = clear(boards[k].z, yAt(boards[k].z));
  for (let k = 0; k < boards.length; k++) {
    let m = -Infinity;
    for (let q = Math.max(0, k - 2); q <= Math.min(boards.length - 1, k + 2); q++) m = Math.max(m, boards[q].f);
    boards[k].xin = m + .12;
  }
  for (const k of [Math.floor(boards.length * .37), Math.floor(boards.length * .71)]) boards[k].miss = true; // 빠진 널 둘 — 오래 손보지 않은 길
  for (const b of boards) {
    if (b.miss) continue;
    const y = yAt(b.z);
    K.put('road', box(width + (r() - .5) * .12, b.t, b.w), b.col, [b.xin + width / 2, y - b.t / 2 + b.sag, b.z], [b.roll, b.tilt, (r() - .5) * .02], 1,
      { rough: .012, noise: .07, vary: .16, uv: 'box', uvScale: .55 });
  }
  // 들보 · 구멍 · 버팀대 · 밧줄 (1.5 m 마다), 기둥 (들보 둘에 하나)
  const posts = [];
  let n = 0;
  for (let z = z0 - .35; z > z1 + .2; z -= 1.5, n++) {
    const y = yAt(z) - .17;
    let xin = -Infinity;
    for (const b of boards) if (Math.abs(b.z - z) < .9) xin = Math.max(xin, b.xin);
    const face = graniteFaceX(z, y) ?? xin - .12;
    limb(K, 'road', [face - .45, y, z], [xin + width + .26, y + (r() - .5) * .04, z + (r() - .5) * .06], .09, .08, LOG, { noise: .08, rough: .02 }, 7);
    K.put('road', box(.05, .3, .3), HOLE, [face + .02, y, z], [0, (r() - .5) * .2, 0]); // 바위에 판 들보 구멍
    const below = graniteFaceX(z, y - 2.3);
    if (below != null) limb(K, 'road', [xin + width - .12, y - .06, z], [below + .05, y - 2.3, z + (r() - .5) * .3], .055, .065, LOG, { noise: .08 }, 6);
    K.put('road', new THREE.TorusGeometry(.105, .026, 4, 10), 0x74694f, [xin + width + .1, y, z], [0, Math.PI / 2, 0], 1, { vary: .1, noise: .05 }); // 들보 끝을 동여맨 밧줄
    if (n % 2 === 0) {
      const lean = (r() - .5) * .07, px = xin + width - .08, py = yAt(z);
      limb(K, 'road', [px, py - .1, z], [px + lean, py + 1.02, z + lean], .066, .056, POST, { noise: .08, rough: .01 }, 6);
      K.put('road', new THREE.TorusGeometry(.085, .02, 4, 9), ROPE, [px, py + .08, z], [Math.PI / 2, 0, 0], 1, { vary: .1, noise: .05 });
      posts.push([px + lean, py, z + lean]);
    }
  }
  // 늘어진 밧줄 난간 두 줄 (위 0.95 m · 가운데 0.52 m)
  for (let k = 0; k < posts.length - 1; k++) {
    const [ax, ay, az] = posts[k], [bx, by, bz] = posts[k + 1];
    for (const [h, sag] of [[.95, .13], [.52, .08]]) {
      const pt = (t) => [THREE.MathUtils.lerp(ax, bx, t), THREE.MathUtils.lerp(ay, by, t) + h - sag * 4 * t * (1 - t), THREE.MathUtils.lerp(az, bz, t)];
      for (let s = 0; s < 4; s++) limb(K, 'road', pt(s / 4), pt((s + 1) / 4), .022, .022, ROPE, { vary: .05, noise: .04 }, 4);
    }
  }
  // 양 끝을 가리는 튀어나온 바위 덩이 (길이 바위를 돌아 이어지는 것처럼)
  for (const [z, s] of [[z0 + .9, 1], [z1 - .7, -1]]) {
    const y = yAt(z), f = graniteFaceX(z, y) ?? -31;
    const rock = K.put('rock', box(2.4, 3.6, 1.9, 1, 2, 1), 0x8f998b, [f + .7, y + .7, z], [.08 * s, .3 * s, .06], 1, { rough: .3, noise: .05 });
    shadeRock(rock, { vert: .26, strata: .05 });
  }
}
// ③⑥ 해 방향 (우리 판): 높이는 샛별 판 그대로(약 65° — 한낮), 방위만 판 시작 경기 카메라의 왼쪽 뒤로 돌렸다. 샛별 판(4, 14, −5)은 해가 카메라 앞 왼쪽이라
//  카메라가 보는 세로 면 — 플레이어 등 · 바위 · 능선 안쪽 면 — 이 모두 반구광만 받는 같은 그늘빛이었다(밝은 옷이 회색으로 묻히고 형태가 납작). 이제 카메라 쪽 면에 해가 들고
//  옆면은 그늘이 진다. 뒤(−x)를 볼 때는 화강암 어깨가 역광 그늘, 잔도 널 윗면은 해를 받는다 [사장님 확인 전 — 확인표 1823]
const SUN_OFFSET = { x: -5.8, y: 14, z: -2.7 };
function sky(scene) {
  const tex=canvasTex(8,256,(g,w,h)=>{const grad=g.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,'#4e9bc7');grad.addColorStop(.45,'#9ec9d9');grad.addColorStop(.53,'#c6dddc');grad.addColorStop(1,'#aac8c5');g.fillStyle=grad;g.fillRect(0,0,w,h);});
  tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(360,32,16),new THREE.MeshBasicMaterial({map:tex,side:THREE.BackSide,depthWrite:false,fog:false}));mesh.name='qinglan-sky';scene.add(mesh);
}
function smallBird(scene) {
  const mat=new THREE.MeshBasicMaterial({color:0x263c36,side:THREE.DoubleSide});
  const group=new THREE.Group();group.name='qinglan-cliff-bird';
  const left=new THREE.Mesh(geo([0,0,0,-.55,0,.08,-.22,0,-.12]),mat);
  const right=new THREE.Mesh(geo([0,0,0,.55,0,.08,.22,0,-.12]),mat);
  group.add(left,right);group.visible=false;scene.add(group);return{group,left,right};
}
export function buildQinglan(scene,{hemi,sun}) {
  scene.background=new THREE.Color(0xb9d4d5);scene.fog=new THREE.Fog(0x9bbbc7,130,420);
  hemi.color.setHex(0xd5e9ff);hemi.groundColor.setHex(0x576458);hemi.intensity=1.65;
  sun.color.setHex(0xfff7ed);sun.intensity=2.5;
  sky(scene);const vista=buildQinglanVista(scene),K=new OwnedKit(801311);terrace(K);restAndTrail(K);plankRoad(K);
  const floorMap=terraceMap();floorMap.repeat.set(2,2);
  const mats={floor:new THREE.MeshStandardMaterial({vertexColors:true,map:floorMap,roughness:.91}),
    rock:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94}),stone:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9}),
    wood:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92}),roof:new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.91}),leaf:new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1}),
    shade:new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),water:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.37,metalness:.02}),
    road:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,map:grainMap()})}; // ① 잔도 (그림자 없음 — 쉼터에서 33 m 밖이라 그림자 상자에 들지 않는다)
  for(const [name,mat]of Object.entries(mats)){const mesh=K.mesh(name,mat,{cast:name==='wood'||name==='stone'||name==='roof',receive:true});
    if(!mesh){mat.dispose();continue;}mesh.name='qinglan-'+name;scene.add(mesh);for(const g of K.bins[name])g.dispose();}
  const drop=new THREE.Mesh(new THREE.SphereGeometry(.04,6,4),new THREE.MeshBasicMaterial({color:0xc1e0dd}));drop.name='qinglan-spring-drop';drop.visible=false;scene.add(drop);
  const bird=smallBird(scene),r=rng(801319);let time=0,nextDrip=3.2,nextBird=11,birdStart=-100,birdCalled=false;
  const stage={sunOffset:SUN_OFFSET,fighterLight:{color:0xe4ede7,rimColor:0xc4dfe4,rim:.8,level:.35},stats:vista.stats,excite(){},
    update(dt){
      if(!Number.isFinite(dt)||dt<=0)return;time+=Math.min(dt,.1);
      if(time>=nextBird){birdStart=time;birdCalled=false;nextBird=time+33+r()*13;}
      const pass=time-birdStart;bird.group.visible=pass>=0&&pass<5.2;
      if(bird.group.visible){bird.group.position.set(48+Math.sin(pass*.8)*2,6+Math.sin(pass)*.8,12+pass*3.4);
        bird.group.rotation.y=-Math.PI/2;bird.left.rotation.z=Math.sin(time*8)*.22;bird.right.rotation.z=-Math.sin(time*8)*.22;
        if(pass>=1&&!birdCalled){birdCalled=true;stage.onEvent?.('stageDetail',{kind:'cliffBird',amp:.85,pos:{...bird.group.position},seed:8013,time});}}
      // Position of the actual falling drop at the same simulation time as its plink.
      const until=nextDrip-time;drop.visible=until>0&&until<.42;
      if(drop.visible)drop.position.set(-17,1.55-1.28*(1-until/.42)**2,-8);
      if(time>=nextDrip){
        if(Math.abs(time-(birdStart+1))>2.1&&Math.abs(time-(nextBird+1))>2.1)
          stage.onEvent?.('stageDetail',{kind:'springDrip',amp:.8,pos:{x:-17,y:.25,z:-8},seed:8014,time});
        nextDrip=time+2.8+r()*2.2;
      }
    }};return stage;
}
