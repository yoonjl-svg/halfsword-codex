// 다라이시 복식 v1 — 샛별 저장소 origin/main db729604 의 src/outfit_silver_wanderer.js (docs/import/salt_desert_port_2026-10-14.md).
//  샛별 줄은 그대로 두고, 우리 판 v7(look.daraishiRevision 7 — 겉모습 덜기, 사장님 10/14 08:1x '폰에서 안 보이는 1~2 mm 문양은 빼고 실루엣은 유지')만
//  '── v7' 표시가 붙은 줄로 더했다: 1~3 mm 선(깃 테·덩굴·앞섶 줄·정강이 등줄)과 작은 쇠 장식은 만들지 않고, 빈 검집을 모노호시자오 날 길이로 늘인다.
//  우리 판 v8(look.daraishiRevision 8 — 사장님 10/14 12:2x '조금만 더 페르시안 귀족의 전통 · 하의 길이와 겹침이 애매')은 '── v8' 줄: 몸통 아래 옷과 발을
//  outfit_silver_wanderer_qaba.js 의 카바(종아리 중간 길이 긴 겉옷 · 바지 · 장화)로 바꾸고, 가죽 허리띠 대신 detail 의 캄마르반드, 검집은 자락 밖으로 조금 기울인다.
//  우리 판 v9(look.daraishiRevision 9 — 사장님 10/14 13:4x 'v7·v8 절충: 보랏빛·장식은 v7 쪽으로, 고증에 묶이지 말 것')은 '── v9' 줄: 카바 꼴은 v8 그대로,
//   겉감(가슴·배·골반·자락)과 위 소매를 보라로 칠하고 테·문양은 outfit_silver_wanderer_v9.js 가 짓는다
//  우리 판 v10(look.daraishiLower 10 — 사장님 10/14 18:4x 'v7 로 되돌리되 허리띠 아래 보라색 천만 v9 을 이식 · 벌어진 넓이는 그대로 · v9 의 길이와 장식')은
//   daraishiRevision 7 그대로(v7 갈래 전부)에 '── v10' 줄만: 엉덩이 자락과 다리 자락(허벅지·정강이 두 도막 + 옷단 띠)을 outfit_silver_wanderer_v10.js 가 짓고, 빈 검집은 v8 자리(감독 결정 10/14)
//  10/15 사장님 23:1x 'v7이 제일 예쁜 거 같애. 되돌려.' — 지금 쓰는 판은 다시 v7. v7 의 빈 검집도 v8 자리(look.daraishiScabbard 8)로 옮겼다 — 나머지 v7 갈래는 그대로
//  (아래 영어 줄 설명은 샛별 저장소 원문 그대로 둔 것이다)
// Reference-led preview: native anatomy/eyes, rigid part-local visual layers.
// +X forward, +Y up/proximal, +Z right. No colliders, armor or controller edits.
import { createDaraishiQaba } from './outfit_silver_wanderer_qaba.js'; // ── v8 카바
import { createDaraishiV9 } from './outfit_silver_wanderer_v9.js'; // ── v9 절충
import { createDaraishiV10 } from './outfit_silver_wanderer_v10.js'; // ── v10 v7 바탕 + v9 아래 자락
// ── v7 빈 검집: 샛별 0.66 m(롱소드 임시 배정 때 만든 길이 — 모노호시자오 날 0.90 m 보다 짧다, 리뷰 4차 §2-4) → 0.94 m. 입(위 끝)은 그 자리, 아래로만 늘인다
// ── v8 검집: 카바 자락(옷단에서 다리 축 바깥 0.14 m · 왼다리가 벌어지거나 비틀리면 더 바깥)에 검집이 묻히지 않게 입(위 끝)을 바깥(−z)으로 1.2 cm 옮기고
//  입을 축으로 바깥으로 0.12 rad 기울인다 (끝은 약 12 cm 바깥) — 임시 검사(자락 뚫림 셈, docs/import/salt_desert_port_2026-10-14.md §2-7)로 고른 값, 확인표 1234
// ── v10 검집: v7 자리면 v7 꼴 다리 자락 바깥 겉면에 걸쳐 축이 자락을 지나는 표본이 18.3 % — v8 자리를 쓴다(감독 결정 10/14, 확인표 1371)
// ── v7 검집 (10/15 — v7 이 다시 지금 쓰는 판): v7 도 v8 자리(look.daraishiScabbard 8). 같은 셈으로 v7 자리 14.5 % → v8 자리 1.3 % (확인표 1811)
export const DARAISHI_SCABBARD = { length: 0.94, top: 0.33, splay: 0.12, out: 0.012 };
const SCABBARD_POS = [-.018, -.22, -.24], SCABBARD_ROT = [0, 0, -.23];
/** 빈 검집 좌표(위 끝 y = top)의 조각을 골반 좌표로 굽는다 — v6 까지는 샛별 자리 그대로, v7(10/15)~v10 은 입 자리를 지키며 바깥으로 기울인다 (detail 모듈 쇠붙이도 같은 함수) */
export function placeDaraishiScabbard(THREE, bake, geo, look) {
  if (!(look?.daraishiRevision >= 8 || look?.daraishiLower === 10 || look?.daraishiScabbard === 8)) return bake(geo, SCABBARD_POS, SCABBARD_ROT); // ── v10 · v7(10/15): v8 자리
  const rot = [DARAISHI_SCABBARD.splay, 0, SCABBARD_ROT[2]], mouth = new THREE.Vector3(0, DARAISHI_SCABBARD.top, 0);
  const was = mouth.clone().applyEuler(new THREE.Euler(...SCABBARD_ROT)), now = mouth.clone().applyEuler(new THREE.Euler(...rot));
  return bake(geo, [SCABBARD_POS[0] + was.x - now.x, SCABBARD_POS[1] + was.y - now.y, SCABBARD_POS[2] + was.z - now.z - DARAISHI_SCABBARD.out + (look?.daraishiScabbardInset||0)], rot);
}
export function createSilverWandererOutfit(h) {
  const { THREE, bake, box, cyl, ball, addMerged, CLOTH, isoldeLock,
    artoriaCloth, artoriaRoundedBox, sleeveVolume } = h;
  const qaba = createDaraishiQaba(h); // ── v8
  const v9 = createDaraishiV9(h); // ── v9: 보라 겉감의 카바(v9.qaba — 꼴은 v8 과 같다) · 테·문양
  const is9 = (look) => look?.daraishiRevision >= 9;
  const coatOf = (look) => (is9(look) ? v9.qaba : qaba); // ── v9
  const v10 = createDaraishiV10(h); // ── v10: 허리띠 아래 보라 자락(v7 꼴 · v9 길이·장식)
  const is10 = (look) => look?.daraishiLower === 10;
  const WHITE = 0xe9e9e5, PURPLE = 0x433653, HEM = 0x776b88;
  const SILVER = 0xb6bbc3, LEATHER = 0x413039, GOLD = 0xa88b45;
  const cloth = { ...CLOTH, metalness: 0, roughness: .87, side: THREE.DoubleSide };
  const steel = { ...CLOTH, metalness: .55, roughness: .4, steel: .7 };
  const hairMat = { ...CLOTH, metalness: .04, roughness: .58 };
  const layer = (g, kind = 'cloth') => artoriaCloth(g, `silver-wanderer-${kind}`);
  function tint(g, color) {
    g.children[0].material.color.setHex(color);
    g.children[0].material.metalness = 0;
    g.children[0].material.roughness = .88;
  }
  function torso(g, color) {
    for (const child of g.children.slice(1)) child.visible = false;
    const { width, height, depth } = g.children[0].geometry.parameters;
    const geo = artoriaRoundedBox(width, height, depth, Math.min(.055, height / 3), .96);
    g.children[0].geometry.copy(geo); geo.dispose(); tint(g, color);
  }
  function line(points, radius = .002) {
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))),
      Math.max(6, points.length * 4), radius, 5, false);
  }
  // Open elliptical cloth with shallow folds. Rows: y, depth, width, x offset.
  function drape(rows, start = 0, sweep = Math.PI * 2, fold = .015, power = 2) {
    const pos = [], uv = [], idx = [], n = 32;
    for (let j = 0; j < rows.length; j++) for (let k = 0; k <= n; k++) {
      const [y, rx, rz, x = 0] = rows[j], a = start + k / n * sweep;
      const f = 1 + fold * Math.cos(a * 8 + j * .25);
      const c = Math.cos(a), sn = Math.sin(a);
      const r = (Math.abs(c / rx) ** power + Math.abs(sn / rz) ** power) ** (-1 / power);
      pos.push(x + r * c * f, y, r * sn * f); uv.push(k / n, j / (rows.length - 1));
      if (j < rows.length - 1 && k < n) {
        const i = j * (n + 1) + k;
        idx.push(i, i + n + 1, i + 1, i + 1, i + n + 1, i + n + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals(); return geo;
  }
  function head(g, look) {
    // Replace only the stock hair cap; the head and its three face meshes stay intact.
    const cap = g.children[4];
    if (cap?.geometry?.type === 'SphereGeometry') {
      const geo = new THREE.SphereGeometry(.108, 24, 12, 0, Math.PI * 2, 0, Math.PI * .68);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const a = Math.atan2(p.getZ(i), p.getX(i)), t = Math.floor(i / 25) / 12;
        const theta = t * Math.PI * (.68 - .29 * Math.max(0, Math.cos(a)));
        p.setXYZ(i, .108 * Math.sin(theta) * Math.cos(a), .108 * Math.cos(theta), .108 * Math.sin(theta) * Math.sin(a));
      }
      geo.computeVertexNormals(); cap.geometry.dispose(); cap.geometry = geo;
      cap.position.set(-.009, .005, 0); cap.rotation.set(0, 0, 0);
    }
    const locks = [], lights = [];
    // A swept, off-center part; open forehead and long temple strands.
    for (const s of [-1, 1]) {
      // The half-up variant supplies a cap-following fringe instead of these
      // two lifted crown locks. Earlier styles keep their original geometry.
      if (!['court_half_tie','court_braided_layers'].includes(look?.hairStyle)) {
        locks.push(isoldeLock([[.025, .113, -.024], [.062, .098, s * .047],
          [.064, .061, s * .088], [.021, .018, s * .107]], [.052, .063, .045, .012], .01));
        lights.push(isoldeLock([[.025, .115, -.024], [.061, .102, s * .042],
          [.07, .068, s * .075]], [.008, .009, .002], .006));
      }
      locks.push(isoldeLock([[.031, .076, s * .084], [.069, .005, s * .102],
        [.052, -.091, s * .118], [.10, -.19, s * .117]], [.029, .034, .027, .003], .009));
    }
    for (let i = -2; i <= 2; i++) locks.push(isoldeLock([
      [-.081, .074, i * .034], [-.114, -.012, i * .041],
      [-.141, -.15, i * .047], [-.163, -.34 + Math.abs(i) * .019, i * .056]], [.047, .058, .065, .003], .011));
    addMerged(layer(g, 'hair'), locks, look.hair, hairMat);
    addMerged(layer(g, 'hair'), lights, 0xb6b3bc, hairMat);
  }
  function backHair(g) {
    // One continuous chest-attached curtain, like the existing long capes.
    // Tapered head locks overlap it; no rectangular seams at spine joints.
    const dark = [], light = [];
    for (let i = -3; i <= 3; i++) {
      const z = i * .04;
      const points = [[-.128, .257 - Math.abs(i) * .019, z * .66], [-.163, .15, z],
        [-.171, -.07, z * 1.14], [-.19, -.33, z * 1.21],
        [-.23, -.61, z * 1.17], [-.269, -.83 + Math.abs(i) * .038, z * 1.04]];
      (i % 3 === 0 ? light : dark).push(isoldeLock(points, [.003, .058, .061, .06, .044, .002], .009));
    }
    addMerged(layer(g, 'hair'), dark, 0x85808b, hairMat);
    addMerged(layer(g, 'hair'), light, 0x98939d, hairMat);
  }
  function chest(g, look) {
    torso(g, is9(look) ? v9.C.coat : WHITE); const l = layer(g); // ── v9: 카바 윗몸도 보라 겉감 (흰 안옷은 v9 모듈의 가슴 V)
    // High open standing collar and short shoulder mantle; neither is heavy armor.
    addMerged(l, [drape([[.254, .072, .082], [.19, .079, .092], [.16, .127, .188],
      [.119, .14, .208], [.037, .14, .211]], .58, Math.PI * 2 - 1.16, .008, 4)], PURPLE, cloth);
    const edges = [];
    const slim = look?.daraishiRevision >= 7; // ── v7: 깃 테·깃 덩굴·앞섶 줄(관 반지름 1.6~2.8 mm — 폰 결투 거리에서 1 화소 안)은 만들지 않는다
    if (!slim) for (const s of [-1, 1]) {
      edges.push(line([[.06, .253, s * .045], [.066, .19, s * .05], [.098, .145, s * .106], [.109, .08, s * .116], [.111, .037, s * .117]], .0028));
      // Small restrained silver scrolls on the collar, no texture dependency.
      edges.push(line([[.074, .197, s * .06], [.077, .211, s * .056], [.077, .223, s * .064],
        [.077, .23, s * .051], [.069, .24, s * .05]], .0016));
    }
    addMerged(l, edges, SILVER, steel);
    if (!slim) addMerged(l, [line([[.116, .132, -.004], [.118, .027, .006], [.118, -.139, -.002]], .002)], 0xbbbfc4, cloth);
    if (!slim) addMerged(l, [line([[.117, .074, -.093], [.123, .039, -.046], [.12, .012, -.018]], .002),
      line([[.117, -.088, .11], [.124, -.106, .057], [.118, -.119, .027]], .002)], 0xd0d1d0, cloth);
    if (!look?.hairStyle) backHair(g);
  }
  function abdomen(g, look) {
    torso(g, is9(look) ? v9.C.coat : WHITE); // ── v9
    if (look?.daraishiRevision >= 8) return; // ── v8: 가죽 허리띠 대신 detail 의 캄마르반드(천 띠)
    const l = layer(g);
    addMerged(l, [bake(artoriaRoundedBox(.236, .07, .338, .015), [0, -.053, 0])], LEATHER, cloth);
    if (look?.daraishiRevision >= 7) return; // ── v7: 띠 쇠고리(v6 에서 가려 두던 것)와 작은 은 단추는 만들지 않는다 — 허리 장식은 detail 의 띠·팔각 꽃
    addMerged(l, [box(.01, .051, .007, [.126, -.05, -.035]), box(.01, .051, .007, [.126, -.05, .005]),
      box(.01, .007, .047, [.126, -.076, -.015]), box(.01, .007, .047, [.126, -.026, -.015]),
      line([[.135, -.05, -.032], [.135, -.05, .006]], .002)], 0x79737d, steel);
    addMerged(l, [-.095, .085, .125].map(z => ball(.0038, 8, 6, [.122, -.047, z])), SILVER, steel);
  }
  function pelvis(g, look, d) {
    const coat = look?.daraishiRevision >= 8; // ── v8: 골반은 카바 허리 아래 윗단(흰 겉감·닫힌 통·앞섶 테·띠 끝) — 보라 엉덩이 자락 대신
    torso(g, coat ? (is9(look) ? v9.C.coat : WHITE) : PURPLE); const l = layer(g);
    const slim = look?.daraishiRevision >= 7;
    if (coat) coatOf(look).pelvis(g, d); // ── v9: 보라 겉감 골반 통 · 테·띠 끝은 v9 모듈
    else if (is10(look)) v10.hip(g, d); // ── v10: 엉덩이 자락 — v7 꼴(같은 꼭짓점) · v9 겉감(테는 다리 자락에만)
    else addMerged(l, [drape([[.107, .109, .16], [-.011, .124, .186], [-.149, .142, .211]], .44, Math.PI * 2 - .88, .024)], 0x5a4c68, cloth);
    addMerged(l, [line([[.124, .086, -.164], [.137, .046, -.06], [.139, -.015, .04], [.117, -.07, .164]], .013)], LEATHER, cloth);
    // Empty scabbard beside the left leg; decorative and independently colored.
    // ── v7: 검집 좌표에서 위 끝(top)을 그대로 두고 길이만 DARAISHI_SCABBARD.length 로 (가운데를 아래로 옮겨 굽는다)
    const S = DARAISHI_SCABBARD, scabbard = slim ? placeDaraishiScabbard(THREE, bake, bake(cyl(.025, .02, S.length, 10, false), [0, S.top - S.length / 2, 0]), look)
      : bake(cyl(.025, .02, .66, 10, false), [-.018, -.22, -.24], [0, 0, -.23]);
    addMerged(l, [scabbard], 0x655047, cloth);
    if (!slim) addMerged(l, [bake(cyl(.027, .027, .019, 10, false), [.057, .101, -.24], [0, 0, -.23]),
      bake(cyl(.021, .014, .04, 10, false), [-.088, -.527, -.24], [0, 0, -.23])], GOLD, steel);
  }
  function upperArm(g, look) {
    tint(g, is9(look) ? v9.C.coat : WHITE); sleeveVolume(g, 1.04, 1.16);
    if (is9(look)) { v9.upperArm(g); return; } // ── v9: 겉옷 반소매(보라) — 망토 어깨 덮개·금빛 아랫단 띠·소매 끝 띠는 v9 모듈이 한 메쉬로
    const l = layer(g);
    addMerged(l, [bake(ball(.072, 20, 12, null, null, [0, Math.PI * 2, 0, Math.PI * .59]), [0, .098, 0], null, [1, 1.02, 1.04]),
      cyl(.073, .07, .016, 20, true, [0, .074, 0])], PURPLE, cloth);
    if (!(look?.daraishiRevision >= 7)) addMerged(l, [cyl(.071, .07, .004, 20, true, [0, .064, 0])], HEM, cloth); // ── v7: 4 mm 단 띠는 뺀다
  }
  function forearm(g) {
    tint(g, WHITE); sleeveVolume(g, 1.28, 1.05); const l = layer(g);
    addMerged(l, [cyl(.059, .049, .058, 20, true, [0, -.068, 0])], PURPLE, cloth);
    addMerged(l, [cyl(.06, .058, .012, 20, true, [0, -.045, 0]),
      cyl(.053, .05, .012, 20, true, [0, -.082, 0]), cyl(.049, .047, .009, 20, true, [0, -.1, 0])], SILVER, steel);
  }
  function skirt(g, side, lower, look, d) {
    if (look?.daraishiRevision >= 8) { coatOf(look).leg(g, d ?? { pos: [0, lower ? .29 : .715, side * .095] }, lower); return; } // ── v8: 카바 자락 · 바지 · 장화 목 (v9 는 보라 자락 + 테·문양)
    tint(g, WHITE); const l = layer(g);
    const tailored=look?.hairStyle==='court_braided_layers';
    // Each half follows its own leg; an open front keeps white trousers readable.
    const opening=tailored?.23:.14,start = side === 1 ? opening : Math.PI;
    const hem=tailored?(side===1?-.125:-.15):-.175;
    const rows = lower ? [[.29, .118, .115, -.034], [.14, .127, .125, -.038], [-.09, .145, .142, -.04], [-.175, .13, .136, -.037]]
      : [[.264, .135, .13, -.019], [.11, .142, .137, -.022], [-.12, .137, .137, -.03], [-.265, .134, .136, -.033]];
    if(tailored){if(lower)rows[3]=[hem,.13,.136,-.037];else rows[3][0]=side===1?-.24:-.26;}
    if (is10(look)) v10.leg(g, d ?? { pos: [0, lower ? .29 : .715, side * .095] }, lower); // ── v10: 두 도막 자락 대신 한 장(v7 꼴 · 옷단 0.30 m · v9 테) — 흰 바지·은 각반은 v7 그대로
    else addMerged(l, [drape(rows, start, Math.PI - opening, .034)], 0x665976, cloth);
    if (lower) {
      if (!is10(look)) addMerged(l, [drape([[hem+.009, .131, .137, -.037], [hem-.002, .131, .137, -.037]], start, Math.PI - opening, .034)], HEM, cloth); // ── v10: 옷단 띠는 v10 자락의 옷단 테가 맡는다
      addMerged(l, [drape([[.12, .058, .058], [.043, .063, .06], [-.13, .049, .049], [-.2, .053, .052]], -.92, 1.84, .006)], SILVER, steel);
      if (!(look?.daraishiRevision >= 7)) addMerged(l, [line([[.058, .12, 0], [.066, .034, 0], [.052, -.13, 0], [.056, -.2, 0]], .0023)], 0xd9dce1, steel); // ── v7: 각반 등줄(2.3 mm)은 뺀다
    }
  }
  function foot(g, look) {
    if (look?.daraishiRevision >= 8) { coatOf(look).boot(g); return; } // ── v8: 은 띠 붙인 회색 신 대신 부드러운 가죽 장화 (v9 같은 장화)
    tint(g, 0x9b9fa8);
    addMerged(layer(g), [-.025, .007, .039].map(x => box(.021, .005, .105, [x, .041, 0], [0, 0, -.05])), SILVER, steel);
  }
  return { head, chest, abdomen, pelvis, uarmS: upperArm, uarmO: upperArm, farmS: forearm, farmO: forearm,
    thighF: (g,look,d) => skirt(g, 1, false,look,d), thighB: (g,look,d) => skirt(g, -1, false,look,d),
    shinF: (g,look,d) => skirt(g, 1, true,look,d), shinB: (g,look,d) => skirt(g, -1, true,look,d), footF: foot, footB: foot };
}
