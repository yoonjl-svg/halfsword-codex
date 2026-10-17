// 김씨(id renji) v2 — 하카마 한 곳만 고려·조선 결로 (사장님 10/10 23:5x "김씨는 보라 허리띠와 머플러 컨셉이니 그건 그대로 두고, 가장 왜색이 짙은 곳만
//  원포인트로 손봐. 고려 방랑 무사 같은 느낌으로 좀 더 이동하게." · "먹빛은 아주 조금만 밝혀"). v1(샛별 저장소 판, outfit_renji.js)은 보관 — ?look=renji:v1.
//  가장 왜색이 짙은 곳 = 하카마(주름 잡힌 통 넓은 치마바지 — 랴오·미나미와 셋째로 겹치던 실루엣) → 통 넉넉한 바지(바지 부리를 정강이에서 행전으로 감쌈).
//   골반의 하카마 윗단은 감추고 그 자리에 웃옷 아랫단(엉덩이까지)을 둔다.
//  더한 것 하나(사장님 10/11 00:1x '허리 칼은 천으로 감싸 끈으로 묶습니다 — 추가해줘'): 허리 칼(칼집·코등이·자루)을 닳은 무명으로 감싸 끈으로 묶음 — 매듭 셋.
//   칼은 v1 과 같은 자리·같은 기울기, 무기 등록·충돌체·날 자료 없음(겉모습만). 천에 싸여 둥근 단면이 되어 칼집 실루엣이 덜 일본풍.
//  그대로: 보라 허리띠·늘어진 띠 끝 · 목에 두른 보라 천 · 삿갓(투구 그룹, look.helmet 'kasa' 판정 그대로) · 머리 · 봇짐·멜빵·짚신 · 넓은 소매.
//  먹빛 한 단계만: 웃옷 0x17191e → 0x20232a, 바지(하카마 남색 0x202637) → 0x283044. 소매 끝 검붉은 물들임은 같은 비율로 밝힘.
//  겉모습만: 대표 메쉬는 같은 메쉬·같은 종류·같은 치수 값으로 꼴만 바꾼다 — 몸·질량·관절·충돌체·손 구체 그대로. +X 앞 · +Y 위 · +Z 오른쪽.
//  v3 (opts.hakama, 사장님 10/11 00:4x '김씨 원래가 낫다. 이전 턴의 모습에 칼만 흰 천으로 감싸. 밝힌 먹빛은 유지.'): v1 옷 그대로(하카마·넓은 소매) +
//   v2 의 밝힌 먹빛(웃옷·소매) + 허리 칼을 바랜 흰 무명(0xd6cfbf)으로 싸서 끈으로 묶음. 바지·행전 판(v2)은 ?look=renji:v2 로만 남김.
import { renjiSwordWrapGeometry } from './renji_sword_wrap.js';

export function createRenjiBajiOutfit(h, v1, opts = {}) {
  const HAKAMA = !!opts.hakama;
  const { THREE, bake, cyl, ball, addMerged, CLOTH, artoriaCloth, taperedTube, reshapeMain } = h;
  const INK_V1 = 0x17191e, NAVY_V1 = 0x202637;
  const INK = 0x20232a, FOLD = 0x2a2930, CUFF = 0x2d2930;
  const BAJI = 0x283044; // 바지
  const HAENGJEON = 0xa39a88, HJ_TIE = 0x5c5446, HJ_FOLD = 0x8a816f; // 행전(무명) · 끈 · 접힌 금
  const SWORD_WRAP = HAKAMA ? 0xd6cfbf : 0x6f6758, SWORD_CORD = 0x3f362c; // 칼 싸개: v2 닳은 무명 회갈 · v3 바랜 흰 무명 · 끈
  const cloth = { ...CLOTH, metalness: 0, roughness: 0.96 };
  const DS = { ...cloth, side: THREE.DoubleSide };
  const layer = (g) => artoriaCloth(g, 'renji-cloth');
  const LIGHTEN = new Map([[INK_V1, INK], [0x222127, FOLD], [0x252128, CUFF]]);
  /** v1 이 그린 부위의 먹빛을 한 단계 밝힘: 재질 색은 표로, 물들임(정점 색)은 같은 비율로 */
  function lighten(g) {
    g.traverse((n) => {
      if (!n.isMesh) return;
      for (const m of [n.material].flat()) {
        const c = LIGHTEN.get(m.color?.getHex());
        if (c !== undefined) m.color.setHex(c);
        if (m.vertexColors && n.geometry.attributes.color && !n.geometry.userData.renjiLit) {
          const col = n.geometry.attributes.color;
          for (let i = 0; i < col.count; i++) col.setXYZ(i, col.getX(i) * 1.3 + 0.004, col.getY(i) * 1.3 + 0.004, col.getZ(i) * 1.3 + 0.004);
          col.needsUpdate = true; n.geometry.userData.renjiLit = true;
        }
      }
    });
  }
  const wrapV1 = (fn) => (g, look, d) => { fn(g, look, d); lighten(g); };
  function limb(main, profile, capTop = 1, capBottom = 1, forward = () => 0) {
    const { radius, height } = main.geometry.parameters;
    const geo = new THREE.CapsuleGeometry(radius, height, 6, 18), p = geo.attributes.position;
    geo.computeBoundingBox();
    const min = geo.boundingBox.min.y, max = geo.boundingBox.max.y, hh = height / 2;
    for (let i = 0; i < p.count; i++) {
      const t = (max - p.getY(i)) / (max - min);
      let y = p.getY(i);
      if (y > hh) y = hh + (y - hh) * capTop; else if (y < -hh) y = -hh + (y + hh) * capBottom;
      const s = profile(t);
      p.setXYZ(i, p.getX(i) * s + forward(t) * radius, y, p.getZ(i) * s);
    }
    geo.computeVertexNormals();
    reshapeMain(main, geo);
  }
  // ── 골반: v1 그대로(보라 띠 끝·허리 칼) — 하카마 윗단만 감추고 웃옷 아랫단(엉덩이까지)을 둔다 ──
  function pelvis(g, look, d) {
    v1.pelvis(g, look, d);
    if (HAKAMA) { lighten(g); wrapSword(g); return; } // v3: 하카마 윗단 그대로
    g.traverse((n) => { if (n.isMesh && n !== g.children[0] && n.material?.color?.getHex() === NAVY_V1) n.visible = false; }); // 하카마 윗단(주름 통·앞판)
    lighten(g);
    const main = g.children[0]; main.material.color.setHex(BAJI);
    const top = 0.085, bot = -0.105;
    const geo = new THREE.CylinderGeometry(1, 1, top - bot, 32, 3, true), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (top - (p.getY(i) + (top + bot) / 2)) / (top - bot), a = Math.atan2(p.getZ(i), p.getX(i));
      const rx = 0.122 + t * 0.022, rz = 0.168 + t * 0.03, fold = 1 + t * 0.025 * Math.cos(a * 7);
      p.setXYZ(i, p.getX(i) * rx * fold, p.getY(i) + (top + bot) / 2, p.getZ(i) * rz * fold);
    }
    geo.computeVertexNormals();
    addMerged(layer(g), [geo], INK, DS).name = 'renji-tunic-hem';
    wrapSword(g);
  }
  /** 허리 칼을 천으로 감싸 끈으로 묶음: v1 칼 그룹(renji-sheathed-sword) 안에, 칼집·코등이·자루를 덮는 조금 큰 둥근 통 + 끈 고리 + 매듭 셋 */
  function wrapSword(g) {
    let sword = null;
    g.traverse((n) => { if (n.name === 'renji-sheathed-sword') sword = n; });
    if (!sword) return;
    // v1 칼집·코등이·자루는 천 속에 감춘다(폼멜 끝 쇠만 보임) — 단면이 둥글어져 납작한 칼집 꼴이 사라진다
    for (const m of sword.children) if (m.isMesh && m.material?.color?.getHex() !== 0x9e8558) m.visible = false;
    const { wrap, cords } = renjiSwordWrapGeometry();
    addMerged(sword, wrap, SWORD_WRAP, cloth).name = 'renji-sword-wrap';
    addMerged(sword, cords, SWORD_CORD, cloth);
  }
  // ── 허벅지: 통 넉넉한 바지(무릎 쪽으로 조금 좁아짐, 앞이 살짝 불룩) ──
  function thigh(g) {
    const main = g.children[0];
    limb(main, (t) => 1.34 - t * 0.2, 1, 1.5, (t) => 0.12 * Math.sin(t * Math.PI));
    main.material.color.setHex(BAJI); main.material.roughness = 0.96; main.material.metalness = 0;
    main.material.side = THREE.DoubleSide;
  }
  // ── 정강이: 바지 부리가 무릎 아래에서 한 번 불룩하게 내려앉고, 그 아래를 행전이 발목까지 감싼다 ──
  function shin(g) {
    const main = g.children[0];
    limb(main, (t) => (t < 0.28 ? 1.3 - t * 0.2 : 1.24 - (t - 0.28) * 0.5), 1.35, 1);
    main.material.color.setHex(BAJI); main.material.roughness = 0.96; main.material.metalness = 0;
    const l = layer(g);
    // 행전: 무릎 아래(서 있을 때 0.41 m) → 발목(0.10 m), 위가 넓고 아래가 좁은 무명 통 + 바깥 옆 여밈선
    addMerged(l, [cyl(0.064, 0.05, 0.31, 18, true, [0, -0.035, 0])], HAENGJEON, DS);
    addMerged(l, [taperedTube([[0, 0.118, 0.064], [0.004, -0.035, 0.058], [0.002, -0.188, 0.05]], [0.0022, 0.0022, 0.0022], 18, 4)], HJ_FOLD, cloth);
    // 윗단 끈: 두 바퀴 감아 바깥에서 매듭, 끝이 늘어짐
    addMerged(l, [bake(new THREE.TorusGeometry(0.0655, 0.003, 4, 18), [0, 0.106, 0], [Math.PI / 2, 0, 0]),
      bake(new THREE.TorusGeometry(0.065, 0.003, 4, 18), [0, 0.096, 0], [Math.PI / 2, 0, 0]),
      ball(0.009, 6, 5, [0.01, 0.1, 0.066]),
      taperedTube([[0.012, 0.096, 0.068], [0.02, 0.06, 0.07], [0.024, 0.03, 0.068]], [0.0025, 0.0024, 0.002], 10, 4),
      taperedTube([[0.006, 0.096, 0.068], [0.0, 0.065, 0.071], [-0.004, 0.04, 0.069]], [0.0025, 0.0024, 0.002], 10, 4)], HJ_TIE, cloth);
    // 발목 쪽 대님 한 줄
    addMerged(l, [bake(new THREE.TorusGeometry(0.0515, 0.0026, 4, 16), [0, -0.172, 0], [Math.PI / 2, 0, 0])], HJ_TIE, cloth);
  }
  return {
    head: v1.head, chest: wrapV1(v1.chest), abdomen: wrapV1(v1.abdomen), pelvis,
    uarmS: wrapV1(v1.uarmS), uarmO: wrapV1(v1.uarmO),
    farmS: wrapV1(v1.farmS), farmO: wrapV1(v1.farmO),
    thighF: HAKAMA ? v1.thighF : thigh, thighB: HAKAMA ? v1.thighB : thigh,
    shinF: HAKAMA ? v1.shinF : shin, shinB: HAKAMA ? v1.shinB : shin,
    footF: v1.footF, footB: v1.footB,
  };
}
