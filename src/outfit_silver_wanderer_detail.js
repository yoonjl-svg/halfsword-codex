// 다라이시 v2~ — 샛별 저장소 origin/main db729604 의 src/outfit_silver_wanderer_detail.js (docs/import/salt_desert_port_2026-10-14.md).
//  v3 머리(상업 게임 인물을 참고한 머리 — 샛별 쪽에서도 미채택) 모듈 import 와 그 갈래 둘은 뺐다(리뷰 4차 §출처). 나머지 샛별 줄은 그대로.
//  우리 판 v7(look.daraishiRevision 7 — 사장님 10/14 08:1x '폰에서 안 보이는 1~2 mm 문양은 빼고 실루엣은 유지')만 '── v7' 줄로 더했다:
//   덩굴·잎·박음질·가는 테·고리 줄(관 반지름 0.8~2.3 mm, 잎 1 cm)은 만들지 않고 큰 면만 — 어깨 원판(약 8×7 cm)과 그 위 팔각 꽃 · 허리 자주 띠와 팔각 꽃(지름 5.4 cm) ·
//   몸통 둥글리기 칸 8 → 5 · 검집 끝 쇠를 늘인 검집 끝으로 · 부위마다 같은 재질 조각을 한 메쉬로 합친다(mergeLayers)
//  우리 판 v8(look.daraishiRevision 8 — 카바, outfit_silver_wanderer_qaba.js)은 '── v8' 줄: 가슴·배 앞섶 사선 테 · 허리는 높이 8.5 cm 캄마르반드(자두색 천 띠 +
//   팔각 꽃 + 왼 앞 매듭 — 띠 끝 둘은 골반 도막) · 검집 쇠붙이는 기울인 검집(placeDaraishiScabbard)을 따른다
//  우리 판 v9(look.daraishiRevision 9 — v7·v8 절충, outfit_silver_wanderer_v9.js)은 '── v9' 줄: 가슴은 흰 안옷 V · 금빛 선 두 줄 사이 짙은 보라 앞섶 테 · 망토 금빛 띠,
//   배는 앞섶 테 · 짙은 가지색 캄마르반드(금빛 위아래 가장자리) — 팔각 꽃은 v8 그대로
//  (아래 영어 줄 설명은 샛별 저장소 원문 그대로 둔 것이다)
// v2 keeps v1 selectable. Surface-following embroidery and fittings only.
import { createSilverWandererOutfit, DARAISHI_SCABBARD, placeDaraishiScabbard } from './outfit_silver_wanderer.js';
import { createDaraishiQaba } from './outfit_silver_wanderer_qaba.js'; // ── v8
import { createDaraishiV9 } from './outfit_silver_wanderer_v9.js'; // ── v9
import { createDaraishiFront } from './outfit_daraishi_front.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'; // ── v7 mergeLayers
import { createSilverWandererFullHair } from './outfit_silver_wanderer_full_hair.js';
import { createSilverWandererCourtHair } from './outfit_silver_wanderer_court_hair.js';

export function createSilverWandererDetail(h) {
  const { THREE, bake, box, cyl, ball, addMerged, CLOTH, artoriaCloth, artoriaRoundedBox } = h;
  const base = createSilverWandererOutfit(h), SILVER = 0xc5c5cc, GOLD = 0xad914e;
  const fullHair = createSilverWandererFullHair(h,base.head);
  const courtHair = createSilverWandererCourtHair(h,base.head);
  const qaba = createDaraishiQaba(h); // ── v8
  const v9 = createDaraishiV9(h); // ── v9 (가슴·배 장식만 — 자락·소매는 base 의 v9)
  const frontStudy = createDaraishiFront(h);
  const hasPersianDetails = look => ['full_layered','court_half_tie','court_braided_layers'].includes(look?.hairStyle);
  const thread = { ...CLOTH, metalness: .12, roughness: .73 };
  const metal = { ...CLOTH, metalness: .6, roughness: .36, steel: .7 };
  const leather = { ...CLOTH, metalness: 0, roughness: .83 };
  const layer = g => artoriaCloth(g, 'silver-wanderer-filigree');
  const rows = [[.254, .072, .082], [.19, .079, .092], [.16, .127, .188],
    [.119, .14, .208], [.037, .14, .211]];
  function line(points, radius = .0016, sides = 4) {
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))),
      Math.max(6, Math.min(40, points.length * 2)), radius, sides, false);
  }
  function collar(y, a, offset = .002) {
    let j = 0;
    while (j < rows.length - 2 && y < rows[j + 1][0]) j++;
    const u = THREE.MathUtils.clamp((rows[j][0] - y) / (rows[j][0] - rows[j + 1][0]), 0, 1);
    const rx = THREE.MathUtils.lerp(rows[j][1], rows[j + 1][1], u);
    const rz = THREE.MathUtils.lerp(rows[j][2], rows[j + 1][2], u);
    const c = Math.cos(a), s = Math.sin(a);
    const r = (Math.abs(c / rx) ** 4 + Math.abs(s / rz) ** 4) ** -.25;
    const f = 1 + .008 * Math.cos(a * 8 + (j + u) * .25);
    return [(r * f + offset) * c, y, (r * f + offset) * s];
  }
  function ring(y, radius, count = 28) {
    return line(Array.from({ length: count + 1 }, (_, i) => {
      const a = i / count * Math.PI * 2; return [radius * Math.cos(a), y, radius * Math.sin(a)];
    }), .0013);
  }
  // Fictional Persian-inspired ornament: split leaves, scrolling stems and an
  // eight-point rosette. These are surface details, never protective armor.
  const chased = { ...metal, side: THREE.DoubleSide };
  const INK = 0x514a58, INLAY = 0xc3a567;
  function panel(points, surface) {
    const outline = points.map(([x,y]) => new THREE.Vector2(x,y));
    const indices = THREE.ShapeUtils.triangulateShape(outline, []).flat();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap(p=>surface(...p)),3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(points.flat(),2));
    geo.setIndex(indices);geo.computeVertexNormals();return geo;
  }
  function splitLeaf(surface, u, v, w, h, tilt = 0) {
    const leaves=[], c=Math.cos(tilt), s=Math.sin(tilt);
    for (const side of [-1,1]) {
      const shape=new THREE.Shape();shape.moveTo(0,-1);
      shape.bezierCurveTo(-.12,-.4,-.76,-.14,-.65,.54);
      shape.bezierCurveTo(-.49,.3,-.34,.28,-.24,.37);
      shape.bezierCurveTo(-.35,.56,-.23,.9,0,1);
      shape.bezierCurveTo(.03,.24,-.07,-.13,0,-1);
      const points=shape.getPoints(6).slice(0,-1).map(p=>{
        const x=p.x*w*side,y=p.y*h;return [u+x*c-y*s,v+x*s+y*c];
      });
      leaves.push(panel(points,surface));
    }
    return leaves;
  }
  function rosette(surface, u, v, radius) {
    return panel(Array.from({length:16},(_,i)=>{
      const a=i*Math.PI/8,r=radius*(i%2?.53:1);
      return [u+Math.sin(a)*r,v+Math.cos(a)*r];
    }),surface);
  }
  function persianCollar(l) {
    const stems=[], leaves=[], edging=[];
    for(const side of [-1,1]) {
      const surface=(u,y)=>collar(y,side*u,.0029);
      // Two crossing stems with open gaps keep the woven rhythm legible.
      for(const sign of [-1,1]) stems.push(line(Array.from({length:17},(_,i)=>{
        const t=i/16;return surface(.99+sign*.12*Math.sin(t*Math.PI*2),.18+t*.065);
      }),.00125));
      for(const y of [.196,.232])leaves.push(...splitLeaf(surface,.99,y,.155,.0115));
      edging.push(line(rows.map(([y])=>collar(y,side*.61,.003)),.001));
      // Larger terminal on the visible lower collar, clear of the long hair.
      stems.push(line([[.89,.177],[.83,.15],[.84,.119],[.94,.1],[1.02,.092]]
        .map(([a,y])=>surface(a,y)),.0014));
      leaves.push(...splitLeaf(surface,1.02,.084,.092,.013));
    }
    addMerged(l,[...stems,...edging],INLAY,thread);
    addMerged(l,leaves,SILVER,{...thread,side:THREE.DoubleSide});
  }
  // More bevel samples and seam-averaged normals, local to this outfit.
  // Retain the native representative geometry object/parameters for wounds.
  function soften(g, look) {
    const mesh = g.children[0], { width:w, height:h, depth:d } = mesh.geometry.parameters;
    const seg = look?.daraishiRevision >= 7 ? 5 : 8; // ── v7: 둥글리기 칸 8 → 5 (부위 하나 768 → 300 삼각형, 둥근 윤곽은 그대로)
    const geo = new THREE.BoxGeometry(w, h, d, seg, seg, seg), p = geo.attributes.position;
    const r = Math.min(.055, h / 3), core = new THREE.Vector3(w/2-r, h/2-r, d/2-r);
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); n.set(THREE.MathUtils.clamp(v.x,-core.x,core.x),
        THREE.MathUtils.clamp(v.y,-core.y,core.y),THREE.MathUtils.clamp(v.z,-core.z,core.z));
      v.sub(n).normalize().multiplyScalar(r).add(n);
      p.setXYZ(i, v.x * THREE.MathUtils.lerp(.96,1,(v.y+h/2)/h),v.y,v.z);
    }
    geo.computeVertexNormals(); const normals = geo.attributes.normal, sums = new Map(), keys = [];
    for (let i = 0; i < p.count; i++) {
      const key = [p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*1e6)).join(','); keys.push(key);
      if (!sums.has(key)) sums.set(key,new THREE.Vector3());
      sums.get(key).add(v.fromBufferAttribute(normals,i));
    }
    for (let i = 0; i < p.count; i++) { v.copy(sums.get(keys[i])).normalize(); normals.setXYZ(i,v.x,v.y,v.z); }
    mesh.geometry.copy(geo); geo.dispose();
  }
  function chest(g, look) {
    soften(g, look); const l = layer(g), silver = [], edging = [];
    // Hide v1's buried trim only. Keep the mantle itself and the white shirt.
    const old = g.children[0].children.find(n => n.name === 'silver-wanderer-cloth');
    for (const mesh of old?.children || []) if (mesh.material?.color.getHex() === 0xb6bbc3) mesh.visible = false;
    if (look?.daraishiRevision >= 7) { if (look.daraishiRevision >= 9) v9.chest(g); else if (look.daraishiRevision >= 8) qaba.chestBand(g); courtHair.chest(g, look); return; } // ── v9: 안옷 V · 앞섶 테 · 망토 금빛 띠 // ── v8: 겉자락 앞섶 사선 테 // ── v7: 깃 가장자리 줄·깃 덩굴과 잎·자락 잎 테·앞섶 단추·솔기 줄은 만들지 않는다 (뒷머리 장막만)
    for (const s of [-1,1]) {
      edging.push(line(rows.map(([y])=>collar(y,s*.58)),.0023));
      // Older looks retain their original collar embroidery.
      if(!hasPersianDetails(look)) {
        silver.push(line(Array.from({length:17},(_,i)=> {
        const t=i/16; return collar(.249-t*.077,s*(.97+.075*Math.sin(t*Math.PI*2)));
        }),.0015));
        for (const y of [.237,.211,.185]) {
          silver.push(line([[y-.004,.96],[y+.001,.80],[y+.008,.77],[y+.009,.85],[y+.003,.89]]
            .map(([yy,a])=>collar(yy,s*a)),.0015));
          silver.push(line([[y-.005,.98],[y-.011,1.13],[y-.007,1.22],[y+.002,1.16],[y-.005,.98]]
            .map(([yy,a])=>collar(yy,s*a)),.0014));
        }
      }
      // Woven hem continues around the short mantle, away from arm joints.
      edging.push(line(Array.from({length:22},(_,i)=>collar(.04,s*(.58+i/21*(Math.PI-.58)))),.0018));
    }
    edging.push(line(Array.from({length:37},(_,i)=>collar(.253,.58+i/36*(Math.PI*2-1.16))),.0018));
    addMerged(l,edging,0x8d879d,thread); addMerged(l,silver,SILVER,thread);
    if(hasPersianDetails(look))persianCollar(l);
    if(look?.hairStyle==='court_braided_layers') {
      const border=[];
      for(const side of [-1,1])for(const a of [.86,1.22,1.58,1.94,2.3,2.66]) {
        const surface=(u,y)=>collar(y,side*u,.0035);
        border.push(...splitLeaf(surface,a,.055,.052,.009));
      }
      addMerged(l,border,INLAY,{...thread,side:THREE.DoubleSide});
    }
    // A modest three-button placket and soft white seam folds on the shirt.
    const shirtX = y => .12 * (.96 + .04 * (y + .14) / .28) + .0015;
    addMerged(l,[.069,.016,-.037].map(y=>bake(ball(.0038,8,6),[shirtX(y),y,.002],null,[.5,1,1])),SILVER,metal);
    addMerged(l,[-1,1].map(s=>line([[shirtX(.083),.083,s*.045],[shirtX(.014),.014,s*.054],[shirtX(-.091),-.091,s*.061]],.001)),0xd8d8d7,leather);
    if (['court_half_tie','court_braided_layers'].includes(look?.hairStyle)) { courtHair.chest(g,look); return; }
    if (look?.hairStyle === 'full_layered') { fullHair.chest(g,look); return; }
    const strands=[];
    for(let i=-3;i<=3;i++) for(const dz of [-.013,.012]) {
      const z=i*.04;
      strands.push(line([[-.174,.139,z+dz],[-.182,-.07,z*1.14+dz],[-.201,-.33,z*1.21+dz],
        [-.241,-.60,z*1.17+dz*.8],[-.273,-.79+Math.abs(i)*.035,z*1.04+dz*.12]],.0008,3));
    }
    addMerged(l,strands,0xa39caa,{...thread,metalness:0,roughness:.65});
  }
  function abdomen(g,look) {
    soften(g,look); const l=layer(g), stitches=[];
    if(look?.daraishiRevision>=9) { // ── v9: 앞섶 테 · 짙은 가지색 캄마르반드(금빛 위아래 가장자리 · 매듭) — 팔각 꽃은 v8 과 같은 크기·자리·재질
      v9.abdomen(g,()=>{
        addMerged(l,[rosette((u,v)=>[.1265,v,u],-.015,-.06,.027)],INLAY,chased);
        addMerged(l,[rosette((u,v)=>[.1285,v,u],-.015,-.06,.018)],SILVER,chased);
        addMerged(l,[bake(ball(.008,8,6),[.132,-.06,-.015],null,[.45,1,1])],0x386b70,metal);
      });
      return;
    }
    if(look?.daraishiRevision>=8) { // ── v8 캄마르반드: 높이 8.5 cm(서 있을 때 1.03~1.11 m) 천 띠가 가죽 띠 자리를 덮는다 · 팔각 꽃(크기 v7 그대로)은 띠 앞면에 붙여 · 왼 앞 매듭
      addMerged(l,[bake(artoriaRoundedBox(.25,.085,.355,.022),[0,-.06,0])],0x513c60,thread);
      addMerged(l,[rosette((u,v)=>[.1265,v,u],-.015,-.06,.027)],INLAY,chased);
      addMerged(l,[rosette((u,v)=>[.1285,v,u],-.015,-.06,.018)],SILVER,chased);
      addMerged(l,[bake(ball(.008,8,6),[.132,-.06,-.015],null,[.45,1,1])],0x386b70,metal);
      addMerged(l,[bake(ball(.02,10,6),[.128,-.079,-.082],null,[.55,.85,1.15])],0x513c60,thread);
      qaba.abdomenBand(g);
      return;
    }
    if(look?.daraishiRevision>=7) { // ── v7: 박음질 50·띠 위 가는 줄·작은 단추·가죽 고리는 빼고 자주 띠와 그 위 팔각 꽃(금빛 2.7 cm · 은빛 1.8 cm · 청록 구슬)만
      addMerged(l,[bake(artoriaRoundedBox(.242,.058,.345,.013),[0,-.046,0])],0x513c60,thread);
      addMerged(l,[rosette((u,v)=>[.14,v,u],-.015,-.046,.027)],INLAY,chased);
      addMerged(l,[rosette((u,v)=>[.142,v,u],-.015,-.046,.018)],SILVER,chased);
      addMerged(l,[bake(ball(.008,8,6),[.145,-.046,-.015],null,[.45,1,1])],0x386b70,metal);
      return;
    }
    for (const y of [-.026,-.079]) for(let z=-.14;z<.15;z+=.012)
      stitches.push(line([[.12,y,z],[.12,y,z+.006]],.0008,3));
    addMerged(l,stitches,0x968076,leather);
    if(look?.hairStyle==='court_braided_layers') {
      // A shallow plum sash sits over the original belt; no body widening.
      const old=g.children[0].children.find(n=>n.name==='silver-wanderer-cloth');
      for(const mesh of old?.children||[])if(mesh.material?.color.getHex()===0x79737d)mesh.visible=false;
      addMerged(l,[bake(artoriaRoundedBox(.242,.058,.345,.013),[0,-.046,0])],0x513c60,thread);
      addMerged(l,[-.023,-.069].map(y=>line([[.124,y,-.155],[.127,y,-.06],[.127,y,.06],[.124,y,.155]],.0013)),INLAY,thread);
      const front=(u,v)=>[.14,v,u];
      addMerged(l,[rosette(front,-.015,-.046,.027)],INLAY,chased);
      addMerged(l,[rosette((u,v)=>[.142,v,u],-.015,-.046,.018)],SILVER,chased);
      addMerged(l,[bake(ball(.008,8,6),[.145,-.046,-.015],null,[.45,1,1])],0x386b70,metal);
    } else {
      // Engraved frame and tongue around the existing buckle, no belt resizing.
      addMerged(l,[line([[.134,-.022,-.039],[.134,-.022,.009],[.134,-.081,.009],
        [.134,-.081,-.039],[.134,-.022,-.039]],.002),
        line([[.14,-.05,-.03],[.14,-.043,-.012],[.14,-.055,-.003]],.0014)],SILVER,metal);
    }
    addMerged(l,[.06,.093,.126].map(z=>bake(ball(.0025,6,4),[.12,-.05,z],null,[.5,1,1])),0x211a24,leather);
    addMerged(l,[box(.006,.063,.009,[.123,-.052,.047]),box(.006,.063,.009,[.12,-.052,-.079])],0x604957,leather);
  }
  function pelvis(g,look) {
    soften(g,look); const l=layer(g), trim=[], fasteners=[];
    const old = g.children[0].children.find(n=>n.name==='silver-wanderer-cloth');
    for(const mesh of old?.children||[]) if(mesh.material?.color.getHex()===0xa88b45) mesh.visible=false;
    // Work in scabbard coordinates and transform the whole fitting together.
    const place=geo=>bake(geo,[-.018,-.22,-.24],[0,0,-.23]);
    if(look?.daraishiRevision>=7) { // ── v7: 입 쇠·끝 쇠(10 각)·끈 띠 둘·매다는 끈만 — 가는 테 넷·끈 고리·덩굴 잎은 뺀다. 끝 쇠는 늘인 검집(DARAISHI_SCABBARD) 끝으로
      const S=DARAISHI_SCABBARD, chape=S.top-S.length+.0295, put=geo=>placeDaraishiScabbard(THREE,bake,geo,look); // ── v8: 기울인 검집을 따른다 (v7 도 10/15 부터 v8 자리 — daraishiScabbard 8)
      addMerged(l,[put(cyl(.027,.027,.043,10,true,[0,.315,0])),put(cyl(.022,.018,.059,10,false,[0,chape,0]))],GOLD,metal);
      addMerged(l,[put(bake(new THREE.CircleGeometry(.024,10),[0,.331,0],[-Math.PI/2,0,0]))],0x221a21,leather);
      addMerged(l,[.27,.19].map(y=>put(cyl(.027,.027,.023,10,true,[0,y,0]))),0x30242d,leather);
      const sz=(look.daraishiRevision>=8||look.daraishiLower===10||look.daraishiScabbard===8)?[-.252,-.258]:[-.24,-.24]; // ── v8: 바깥으로 옮기고 기울인 검집까지 매다는 끈을 늘인다 (── v10 · v7(10/15) 도 v8 자리)
      addMerged(l,[line([[.028,.079,-.177],[.063,.068,-.213],[.049,.054,sz[0]]],.005),
        line([[-.033,.067,-.179],[.018,-.022,-.218],[.029,-.03,sz[1]]],.005)],0x4e3541,leather);
      return;
    }
    trim.push(place(cyl(.027,.027,.043,16,true,[0,.315,0])));
    addMerged(l,[place(bake(new THREE.CircleGeometry(.024,16),[0,.331,0],[-Math.PI/2,0,0]))],0x221a21,leather);
    trim.push(place(cyl(.022,.018,.059,16,false,[0,-.305,0])));
    for(const y of [.337,.294,-.283,-.317]) trim.push(place(ring(y,y>0?.027:.023)));
    for(const y of [.27,.19]) {
      fasteners.push(place(cyl(.027,.027,.023,16,true,[0,y,0])));
      trim.push(place(bake(new THREE.TorusGeometry(.019,.0024,4,12),[.031,y,0],[0,Math.PI/2,0])));
    }
    const scroll=[];
    if(hasPersianDetails(look)) {
      // Chased motifs on the existing mouth and chape; scabbard dimensions stay fixed.
      for(const [y,r] of [[.315,.0285],[-.303,.0215]])for(let k=0;k<4;k++) {
        const a=k*Math.PI/2;
        const surface=(u,v)=>[r*Math.cos(a+u),v,r*Math.sin(a+u)];
        scroll.push(...splitLeaf(surface,0,y,.42,.012).map(place));
      }
    } else for(const y of [.303,-.301]) scroll.push(place(line([[.027,y+.012,-.009],[.029,y+.004,.009],
      [.029,y-.003,-.009],[.027,y-.012,.007]],.0012)));
    addMerged(l,fasteners,0x30242d,leather); addMerged(l,trim,GOLD,metal);
    addMerged(l,scroll,hasPersianDetails(look)?INK:0xe2c77f,
      hasPersianDetails(look)?chased:metal);
    // Short attached suspension straps; never a solid band crossing both legs.
    addMerged(l,[line([[.028,.079,-.177],[.063,.068,-.213],[.049,.054,-.24]],.005),
      line([[-.033,.067,-.179],[.018,-.022,-.218],[.029,-.03,-.24]],.005)],0x4e3541,leather);
  }
  function upperArm(g,look,d) {
    const l=layer(g), side=Math.sign(d.pos[2])||1;
    const surface=(x,y)=>[x,y,side*(.07488*Math.sqrt(Math.max(.02,1-(x/.072)**2-((y-.098)/.07344)**2))+.0018)];
    if(look?.daraishiRevision>=7) { // ── v7: 어깨 원판(약 8×7 cm — 결투 거리에서 읽히는 하나뿐인 문양)과 그 위 팔각 꽃 둘만. 원판은 16 칸 × 고리 셋(샛별 32 × 4), 덩굴·잎·가는 테·소매 단 줄은 뺀다
      const rim=Array.from({length:17},(_,i)=>{const a=i*Math.PI/8;return [.039*Math.sin(a),.111+.035*Math.cos(a)];});
      const plateSurface=(x,y)=>{const p=surface(x,y);p[2]+=side*.0004;return p;};
      const engrave=(x,y)=>{const p=surface(x,y);p[2]+=side*.0015;return p;};
      const plates=[];
      for(let j=0;j<3;j++)for(let i=0;i<16;i++) {
        const point=(k,r)=>[rim[k][0]*r,.111+(rim[k][1]-.111)*r];
        const inner=j/3,outer=(j+1)/3;
        plates.push(panel(j===0?[[0,.111],point(i,outer),point(i+1,outer)]:[point(i,inner),point(i,outer),point(i+1,outer),point(i+1,inner)],plateSurface));
      }
      addMerged(l,plates,0xb6bbc3,chased);
      addMerged(l,[rosette(engrave,0,.111,.017)],INK,chased);
      addMerged(l,[rosette((x,y)=>{const p=engrave(x,y);p[2]+=side*.0004;return p;},0,.111,.011)],INLAY,chased);
      return;
    }
    if(hasPersianDetails(look)) {
      // A thin lenticular silver cartouche lies on the existing cloth cap.
      // Subdivided concentric rings follow the shoulder rather than spanning it.
      const rim=Array.from({length:33},(_,i)=>{
        const a=i*Math.PI/16;return [.039*Math.sin(a),.111+.035*Math.cos(a)];
      });
      const plateSurface=(x,y)=>{const p=surface(x,y);p[2]+=side*.0004;return p;};
      const engrave=(x,y)=>{const p=surface(x,y);p[2]+=side*.0015;return p;};
      const plates=[];
      for(let j=0;j<4;j++)for(let i=0;i<32;i++) {
        const point=(k,r)=>[rim[k][0]*r,.111+(rim[k][1]-.111)*r];
        const inner=j/4,outer=(j+1)/4;
        plates.push(panel(j===0?[[0,.111],point(i,outer),point(i+1,outer)]:[
          point(i,inner),point(i,outer),point(i+1,outer),point(i+1,inner)],plateSurface));
      }
      addMerged(l,plates,0xb6bbc3,chased);
      const vines=[];
      for(const s of [-1,1])vines.push(line([[-.006*s,.082],[-.027*s,.091],[-.03*s,.111],
        [-.025*s,.128],[-.019*s,.131],[-.016*s,.126],[-.02*s,.123]].map(p=>engrave(...p)),.00125));
      const leaves=[];
      for(const s of [-1,1])leaves.push(...splitLeaf(engrave,s*.025,.098,.009,.011,s*.34));
      addMerged(l,[...vines,...leaves,rosette(engrave,0,.111,.017)],INK,chased);
      addMerged(l,[line(rim.map(p=>engrave(...p)),.0015),
        rosette((x,y)=>{const p=engrave(x,y);p[2]+=side*.0004;return p;},0,.111,.011)],INLAY,chased);
      addMerged(l,[ring(.065,.0715)],0xa298b0,thread);
      return;
    }
    const glyph=[[-.019,.111],[-.012,.126],[.001,.119],[.009,.127],[.017,.113],
      [.006,.107],[.017,.093],[.005,.094],[.012,.083],[-.003,.088],[-.012,.079],[-.011,.099],[-.019,.111]];
    addMerged(l,[line(glyph.map(([x,y])=>surface(x,y)),.0019),
      line([[-.008,.109],[.002,.114],[.007,.103],[-.003,.098],[-.008,.109]].map(([x,y])=>surface(x,y)),.0014)],SILVER,thread);
    // Fine rolled cuff edge beneath the mantle, with small seam stitches.
    addMerged(l,[ring(.065,.0715)],0xa298b0,thread);
  }
  function forearm(g,look) {
    if(look?.daraishiRevision>=7) return; // ── v7: 손목 띠 위 잎 여섯·가는 줄·고리 줄 셋·끝 가죽 테는 뺀다 — 손목은 v1 의 보라 띠와 은 띠 셋(높이 0.9~1.2 cm)으로 읽힌다
    const l=layer(g), work=[];
    const surface=(y,a)=> {const r=.059-(.059-.049)*THREE.MathUtils.clamp((-.039-y)/.058,0,1)+.002;
      return [r*Math.cos(a),y,r*Math.sin(a)];};
    if(hasPersianDetails(look)) {
      const leafSurface=(a,y)=>surface(y,a);
      for(let k=0;k<6;k++)work.push(...splitLeaf(leafSurface,k*Math.PI/3,-.067,.25,.011));
      addMerged(l,[line(Array.from({length:49},(_,i)=>{
        const a=i*Math.PI/24;return surface(-.067+.005*Math.sin(a*6),a);
      }),.0012)],INLAY,thread);
    } else for(let k=0;k<6;k++) {
        const a=k*Math.PI/3;
        work.push(line([[.018,-.052],[.095,-.057],[-.05,-.067],[.09,-.076],[.025,-.082]]
          .map(([da,y])=>surface(y,a+da)),.0013));
    }
    addMerged(l,work,SILVER,hasPersianDetails(look)?{...thread,side:THREE.DoubleSide}:thread);
    addMerged(l,[ring(-.041,.061),ring(-.081,.055),ring(-.103,.049)],0xd6d4dc,metal);
    addMerged(l,[cyl(.047,.046,.007,20,true,[0,-.116,0])],0x55435f,leather);
  }
  function skirt(g,side,lower,look) {
    if(look?.daraishiRevision>=7) return; // ── v7: 자락 솔기·테 줄·잎 테·각반 등줄은 뺀다 (자락 모양·단 색 띠·은 각반은 v1·v6 그대로)
    const tailored=look?.hairStyle==='court_braided_layers',opening=tailored?.23:.14;
    const l=layer(g), a=side===1?opening:Math.PI*2-opening;
    const rows=lower?[[.282,.118,.115,-.034],[.14,.127,.125,-.038],[-.09,.145,.142,-.04],[-.175,.13,.136,-.037]]
      :[[.25,.135,.13,-.019],[.11,.142,.137,-.022],[-.12,.137,.137,-.03],[-.265,.134,.136,-.033]];
    if(tailored)rows[3][0]=lower?(side===1?-.125:-.15):(side===1?-.24:-.26);
    const seam=rows.map(([y,rx,rz,x],j)=>[x+rx*Math.cos(a)*(1+.034*Math.cos(a*8+j*.25))+.002,
      y,rz*Math.sin(a)*(1+.034*Math.cos(a*8+j*.25))+side*.001]);
    addMerged(l,[line(seam,.0015)],0x94839f,thread);
    if(tailored) {
      const border=[line(seam.map(([x,y,z])=>[x+.001,y,z]),.0011)];
      if(lower) {
        const hem=rows[3][0],start=side===1?opening:Math.PI;
        const surface=(angle,y)=>{
          const u=THREE.MathUtils.clamp((y-hem)/(-.09-hem),0,1),rx=THREE.MathUtils.lerp(.13,.145,u),rz=THREE.MathUtils.lerp(.136,.142,u);
          const f=1+.034*Math.cos(angle*8+(3-u)*.25);
          return [-.037+rx*Math.cos(angle)*f+.001*Math.cos(angle),y,rz*Math.sin(angle)*f+.001*Math.sin(angle)];
        };
        border.push(line(Array.from({length:33},(_,i)=>surface(start+i/32*(Math.PI-opening),hem+.018)),.0014));
        for(let i=0;i<7;i++) {
          const a=start+.15+i/6*(Math.PI-opening-.3);
          border.push(...splitLeaf(surface,a,hem+.031,.049,.009));
        }
      }
      addMerged(l,border,INLAY,{...thread,side:THREE.DoubleSide});
    }
    if(lower) {
      // Narrow engraved ridge on the visible silver greave.
      addMerged(l,[line([[.059,.076,-.018],[.065,.052,0],[.059,.076,.018]],.0014),
        line([[.054,-.11,-.014],[.055,-.132,0],[.054,-.11,.014]],.0012)],0x858994,metal);
    }
  }
  const details={chest,abdomen,pelvis,uarmS:upperArm,uarmO:upperArm,farmS:forearm,farmO:forearm,
    thighF:(g,look)=>skirt(g,1,false,look),thighB:(g,look)=>skirt(g,-1,false,look),
    shinF:(g,look)=>skirt(g,1,true,look),shinB:(g,look)=>skirt(g,-1,true,look)};
  // ── v7 합치기: 부위 하나의 장식 층(silver-wanderer-*) 안에서 재질(색·금속성·거칠기·양면·반사)이 같은 메쉬를 한 메쉬로 합친다 — 그리기 호출을 줄인다.
  //  층들은 모두 부위 대표 메쉬(g.children[0]) 아래 같은 좌표라 꼭짓점을 옮길 것이 없다. 숨긴 메쉬는 버린다. 꼭짓점 속성이 다르면 그 묶음은 그대로 둔다
  function mergeLayers(g) {
    const holder = g.children[0], groups = new Map();
    for (const layer of holder.children) {
      if (!layer.isGroup || !layer.name.startsWith('silver-wanderer-')) continue;
      for (const mesh of [...layer.children]) {
        if (!mesh.isMesh || mesh.isSkinnedMesh) continue; // ── v8: 카바 자락(스키닝)은 합치지 않는다
        if (!mesh.visible) { layer.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); continue; }
        const m = mesh.material, key = [m.color.getHex(), m.metalness, m.roughness, m.side, m.envMapIntensity, !!m.envMap].join('|');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(mesh);
      }
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const geo = mergeGeometries(list.map((m) => m.geometry), false);
      if (!geo) continue;
      const keep = new THREE.Mesh(geo, list[0].material);
      keep.castShadow = true;
      list[0].parent.add(keep);
      for (const mesh of list) { mesh.parent.remove(mesh); mesh.geometry.dispose(); if (mesh.material !== keep.material) mesh.material.dispose(); }
    }
  }
  return Object.fromEntries(Object.entries(base).map(([part,decorate])=>[part,(g,look,d)=>{
    if (part === 'head' && ['court_half_tie','court_braided_layers'].includes(look?.hairStyle)) { courtHair.head(g,look); frontStudy(g,look,part); if (look?.daraishiRevision >= 7) mergeLayers(g); return; }
    if (part === 'head' && look?.hairStyle === 'full_layered') { fullHair.head(g,look); return; }
    decorate(g,look,d);details[part]?.(g,look,d);
    frontStudy(g,look,part);
    if (look?.daraishiRevision >= 7) mergeLayers(g); // ── v7
  }]));
}
