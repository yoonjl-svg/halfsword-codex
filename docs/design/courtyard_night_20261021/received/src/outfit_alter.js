// Appearance only. Materials are freshly built by dressPart / the outfit factories.
// No body, collider, armor coverage or AI changes.
import * as THREE from 'three';
import { addGuildEmbroidery } from './outfit_guild_badge.js';
import { decorateFifthAlter } from './outfit_alter_fifth.js';
import { decorateTerracottaAlter } from './outfit_alter_terracotta.js';
import { decorateDaraishiAlter, DARAISHI_RIBBON_RED } from './outfit_alter_daraishi.js';
import { decorateRoyalMessengerAlter } from './outfit_alter_royal_messenger.js';
import { addShoulderIguana, addGroveBranch, addCosmeticKettle, addRatnaHeadscarf } from './outfit_alter_fourth.js';

export function alterLook(base, kind) {
  const look={...base,alter:kind};
  // ── 아래 다섯(마야 · 아르토리아 · 다라이시 · 찬다 · 김씨)은 샛별 저장소에서 가져옴 (10/17 — 사장님 10/16~17 결정, 샛별 쪽 · docs/import/saetbyeol_round3_2026-10-17.md)
  // 마야 얼터: 붉은 앙가르카 → 모래빛 · 흰 천 → 짙은 청색 · 금빛은 바랜 놋쇠 (외양만 — 허리의 열린 문서 가방은 outfit_alter_royal_messenger.js)
  if(kind==='samira')look.outfitPalette={
    0x922e40:0xd1c6ae,0x6e2131:0xa49983,0xefece4:0x293e50,
    0x33232c:0x293947,0x2c2530:0x333942,0x231d25:0x252a30,0xb39a5f:0x8b7959,
  };
  if(kind==='artoria'){
    // 광기의 아르토리아: 검은 궁정 예복(v4-alter13). 실제 판금을 벗는 것은 사장님 승인 예외(샛별 쪽 10/16) — 부츠 · 드레스는 방어구가 아니다.
    //  몸 · 은발 · 무기 · AI 는 그대로. 갑옷이 빠지면서 갑옷의 보통 감속도 같이 빠질 뿐, 새 능력치를 더하지 않는다
    Object.assign(look,{outfit:'artoria_ballroom',armor:null,helmet:null,tailoring:null,
      tunic:base.skin,quilt:base.skin,sleeve:base.skin,hands:base.skin,
      hoseUpper:base.skin,hoseLower:base.skin,shoes:base.skin,eyeColor:0x3b121b});
    look.outfitPalette={0x28797b:0xe0d1b2}; // 원래 있던 끈 색 → 상아색 (리본 자리)
  }
  // 다라이시 흑의 얼터 (characters.js 가 daraishiBlack 을 붙여 부른다): 거의 중성인 검정 천 — 밝기만 조금씩 다르게. 머리 · 살갗 색은 일부러 빼서
  //  기본 · 얼터가 같은 애쉬 실버 머리. 허리 장식(옛 청록)은 머리끈과 같은 붉은색 (사장님 10/16 결정, 샛별 쪽). 거절된 첫 얼터(먹청 · 동색) 배색은 안 가져옴
  if(kind==='silver_wanderer'&&base.daraishiBlack)look.outfitPalette={
    0xe9e9e5:0x28292c,0x433653:0x191c20,0x776b88:0x3b3d41,
    0x5a4c68:0x222427,0x665976:0x303235,0x34263f:0x1b1c1f,
    0x413039:0x181a1d,0x2f2338:0x202124,0xe7dfcf:0x29282c,
    0xeee7d9:0x343337,0xb7ad99:0x1d1c20,0xc4ac78:0xa0a3a6,0x88745d:0x858a90,
    0xad914e:0x92989e,0xa88b45:0x92989e,0xcfb57b:0xa9adb0,
    0xb6bbc3:0x4b525c,0xc5c5cc:0x939da8,0xd8d6e0:0x6b737b,0x9b9fa8:0x3e4248,
    0x655047:0x1d1f23,0x514a58:0x28292d,0x513c60:0x202125,0xc3a567:0x8b929b,
    0x386b70:DARAISHI_RIBBON_RED,
  };
  // 찬다 얼터: 짙은 남색 옷 → 흰빛 회색 (얼굴의 얇은 흰 가림천은 outfit_alter_fifth.js) · 김씨 얼터: 먹빛 옷 → 붉은 갈색 (늘어진 긴 머리 · 허리 칼을 손에 — 같은 파일)
  if(kind==='chanda')look.outfitPalette={0x252c4b:0xc5c1b5,0x414967:0x91958d,0x353d50:0x787f7a,0xb49354:0x537b77,0x866d3f:0x365a58,0xb0a58a:0xa9ada4};
  if(kind==='renji')look.outfitPalette={0x20232a:0x81453f,0x17191e:0x81453f,0x2a2930:0xa16a59,0x2d2930:0x65332f,0x202637:0x4c2c31,0x202537:0x4c2c31,0x303548:0x715051};
  if(kind==='bran')look.outfitPalette={0xa08757:0x354658,0x7c6740:0x293747,0xcdbb92:0x75828b,0xa89468:0x4e606b,0x6b5637:0x344351,0x5c4830:0x293747,0x4a3a26:0x354351};
  if(kind==='minami')look.outfitPalette={0xe9e2ce:0x303b51,0xcac4af:0x596277,0xe9e5d5:0x303b51,0xf4f1e8:0x778495,0xafa991:0x586477,0x3f5747:0xc6c9c1,0x3b5344:0xb4bab1,0x627b5c:0xaeb7ac};
  // Sleeve is skin on Ratna; never remap that shared color with his clothes.
  if(kind==='ratna')look.outfitPalette={0xded2b4:0xad5369,0xb9a98a:0x733448,0xe9dec4:0xe2c58b,0xb68854:0x65506e,0x8d673f:0x49364d,0x884936:0xd4b583,0xb07351:0x8e603c};
  if(kind==='heinrich') look.outfitPalette={0xc7cdd3:0x3e3544,0x6e747b:0x37303e,0x5c6168:0x282330};
  if(kind==='eira') {
    look.outfitPalette={0x222c48:0x854b60,0x18203a:0x4a2b40,0xf1f0ec:0xdcc8b8,0xc9ced6:0xb79caa,0xdadde3:0xcbb7c0};
    look.eyeColor=0x3b121b; // dark iris under the moving glow, not a bright fixed square
  }
  if(kind==='liao') {
    look.outfitPalette={0x3a5f9e:0xb88745,0x27447a:0x76512e,0x33558f:0x936e3f,0x1e2a44:0x4a3528};
    look.blindfold=true;
  }
  if(kind==='margarethe') {
    look.hair=0xa4a6a2; // muted light gray, visibly darker than ivory armor
    look.plume=base.plume??base.hair; // the helmet's feather is not natural hair
    look.outfitPalette={0x2c2c32:0xd9d1b9,0x1c1c20:0x948b77,0x8d939b:0xf1e5c9,
      0x1b1b20:0xc7bfae,0x131316:0x8d8377,0x1e1e22:0xb7ab98,0x24242a:0x9d9285};
  }
  if(kind==='isolde') {
    // Preserve the original clothes, hair cap and side locks. The existing
    // long-hair decorator trims only the rear length to the shoulder line.
    look.guildVest=true;
  }
  if(kind==='tome') {
    // Keep the wine doublet, sleeves and dark trousers. Only the outer ropa
    // and its facing change, so the original two clothing layers stay legible.
    look.outfitPalette={0x1c191b:0xb6ad98,0x4a2230:0x81755e};
  }
  if(kind==='omari') {
    look.outfitPalette={0xe4d4b4:0x40988e,0x193b4b:0x32948d,0x47616a:0x82b4a0,0x813848:0xb6935a,
      0x665a4b:0x344e4b,0xa55c60:0xd5b776};
  }
  // Base garments and added outfit parts share the same palette substitution.
  for(const key of ['tunic','quilt','sleeve','hoseUpper','hoseLower','belt','metal'])
    if(look.outfitPalette?.[look[key]]!=null)look[key]=look.outfitPalette[look[key]];
  return look;
}

export function decorateAlter(g,look,part) {
  if(!look.alter)return;
  // 다라이시 · 병마용 얼터 (샛별 저장소 10/17)는 배색보다 먼저: 다라이시는 꼭짓점 색에 구운 옷감도 같은 배색으로 바꾸고 흑의면 머리 뒤 붉은 끈 /
  //  병마용은 채색 갑옷 · 창백한 사람 얼굴 · 흰 망토
  if(look.alter==='silver_wanderer')decorateDaraishiAlter(g,part,look.outfitPalette,look);
  if(look.alter==='terracotta')decorateTerracottaAlter(g,part);
  const seen=new Set();
  g.traverse(o=>{
    // Helmet wear restores its saved base color; save the altered palette there too.
    const wearColor=look.outfitPalette?.[o.userData.base?.color];
    if(wearColor!=null)o.userData.base={...o.userData.base,color:wearColor};
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
    if(!m?.color||seen.has(m))continue;seen.add(m);
    const c=look.outfitPalette?.[m.color.getHex()];if(c!=null)m.color.setHex(c);
  }});
  decorateFifthAlter(g,look,part); // 찬다 · 김씨 얼터 (밤 다섯째 — 샛별 저장소 10/17)
  decorateRoyalMessengerAlter(g,look,part); // 마야 얼터의 열린 문서 가방 (샛별 저장소 10/17)
  const mat=(color)=>new THREE.MeshStandardMaterial({color,roughness:.92,metalness:0,side:THREE.DoubleSide});
  const add=(parent,geo,m,pos)=>{const x=new THREE.Mesh(geo,m);if(pos)x.position.set(...pos);x.castShadow=true;parent.add(x);return x};
  if(look.alter==='ratna'&&part==='chest')addShoulderIguana(g);
  if(look.alter==='omari'&&['chest','abdomen','pelvis'].includes(part)){
    // An open, salt-worn captain's coat. Each short section follows its own body
    // part, as the existing clothing does; there is no new cloth physics.
    const coat=new THREE.Group();coat.name='alter-worn-captain-coat';g.add(coat);
    const cloth=mat(0x294b4a),edge=mat(0x8c9c81),n=20,pos=[],idx=[];
    const top=part==='chest'?.16:part==='abdomen'?.09:.10;
    const bottom=part==='chest'?-.18:part==='abdomen'?-.10:-.36;
    for(let row=0;row<2;row++)for(let i=0;i<=n;i++){
      const a=.68+(Math.PI*2-1.36)*i/n,rx=part==='pelvis'?.165:.148,rz=part==='chest'?.205:part==='abdomen'?.187:.207;
      const torn=part==='pelvis'&&row===1?(.035*Math.sin(i*2.1)+(i===5||i===14?.095:0)):0;
      pos.push(Math.cos(a)*rx*(row?1.08:1),row?bottom+torn:top,Math.sin(a)*rz*(row?1.08:1));
      if(row===0&&i<n){const k=i;idx.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2)}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();add(coat,geo,cloth);
    if(part==='chest')for(const s of [-1,1]){
      const lapel=add(coat,new THREE.BoxGeometry(.022,.23,.05),edge,[.13,.045,s*.13]);lapel.rotation.x=s*.20;
    }
  }
  if(look.guildVest&&['chest','abdomen'].includes(part)){
    // A pull-over training vest: continuous front/back, round neck, armholes,
    // no buttons, lapels or front opening. Follow the existing body segments.
    const vest=new THREE.Group();vest.name='alter-purple-guild-vest';g.add(vest);
    const rows=part==='chest'?[[.18,.081,.096],[.14,.139,.191],[-.045,.143,.193],[-.175,.144,.193]]:
      [[.10,.133,.183],[-.10,.136,.188]];
    const n=48,pos=[],idx=[];
    for(let j=0;j<rows.length;j++)for(let i=0;i<=n;i++){
      const [y,rx,rz]=rows[j],a=i/n*Math.PI*2,c=Math.cos(a),z=Math.sin(a);
      const rr=1/Math.pow(Math.pow(Math.abs(c)/rx,10)+Math.pow(Math.abs(z)/rz,10),1/10);
      pos.push(c*rr,y,z*rr);
      // Sleeveless opening, between the shoulder seam and the armpit.
      const hole=part==='chest'&&j===1&&Math.abs(Math.sin((i+.5)/n*Math.PI*2))>.83;
      if(j<rows.length-1&&i<n&&!hole){const k=j*(n+1)+i;idx.push(k,k+1,k+n+1,k+1,k+n+2,k+n+1)}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();
    add(vest,geo,mat(0x654272));
    if(part==='chest'){
      const collar=add(vest,new THREE.CylinderGeometry(.082,.083,.009,32,1,true),mat(0x8b6b91),[0,.18,0]);collar.scale.z=.096/.081;
      addGuildEmbroidery(vest,rows);
    }
  }
  if(part!=='head')return;
  if(look.alter==='ratna')addRatnaHeadscarf(g);
  if(look.alter==='bran')addCosmeticKettle(g);
  if(look.alter==='minami')addGroveBranch(g);
  if(look.alter==='eira'){
    const hood=new THREE.Group();hood.name='alter-deep-hood';g.add(hood);
    const cloth=mat(0x68394f),lining=mat(0x30212d),edge=mat(0x9a6b7b);
    for(const m of [cloth,lining,edge])m.defines={FL_CLOTH_GLOW:1};
    // Rounded cloth shell with an open face. The silver locks remain inside the
    // opening and continue onto the existing shoulder cape, with no new physics.
    const rings=[[.145,.17,.15,-.012],[.035,.205,.19,-.02],[-.09,.20,.19,-.028],[-.185,.13,.14,-.045],[-.22,.015,.02,-.06]],n=24,pos=[],idx=[];
    for(let j=0;j<rings.length;j++)for(let i=0;i<=n;i++){
      const [x,ry,rz,cy]=rings[j],a=i/n*Math.PI*2,fold=1+.025*Math.cos(a*7+j*.4);
      pos.push(x+.009*Math.cos(a*3),cy+Math.cos(a)*ry*fold,Math.sin(a)*rz*fold);
      if(j<rings.length-1&&i<n){const k=j*(n+1)+i;idx.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2)}
    }
    const shell=new THREE.BufferGeometry();shell.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));shell.setIndex(idx);shell.computeVertexNormals();
    add(hood,shell,cloth);
    const inner=shell.clone();inner.scale(.98,.98,.98);add(hood,inner,lining);
    const lip=[];for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;lip.push(new THREE.Vector3(.147+.009*Math.cos(a*3),-.012+Math.cos(a)*.17*(1+.025*Math.cos(a*7)),Math.sin(a)*.15*(1+.025*Math.cos(a*7))))}
    add(hood,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lip),48,.006,5,false),edge);
  }
  if(look.blindfold){
    const wrap=new THREE.Group();wrap.name='alter-blindfold';g.add(wrap);
    const linen=mat(0xd9ccb3),fold=mat(0xb7a88d);
    const band=new THREE.CylinderGeometry(.112,.112,.057,20,1,true);band.scale(1.04,1,1);
    add(wrap,band,linen,[0,.016,0]);
    add(wrap,new THREE.BoxGeometry(.014,.055,.146),linen,[.113,.016,0]).name='alter-blindfold-front';
    for(const y of [-.002,.029])add(wrap,new THREE.BoxGeometry(.003,.004,.15),fold,[.122,y,0]);
    add(wrap,new THREE.SphereGeometry(.022,6,4),linen,[-.12,.013,0]);
    for(const s of [-1,1]){const tail=add(wrap,new THREE.BoxGeometry(.009,.13,.032),linen,[-.13,-.06,s*.022]);tail.rotation.x=s*.22;tail.rotation.z=-.18;}
  }
}
