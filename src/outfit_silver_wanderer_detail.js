// v2 keeps v1 selectable. Surface-following embroidery and fittings only.
import { createSilverWandererOutfit } from './outfit_silver_wanderer.js';
import { createSilverWandererHair } from './outfit_silver_wanderer_hair.js';
import { createSilverWandererFullHair } from './outfit_silver_wanderer_full_hair.js';
import { createSilverWandererCourtHair } from './outfit_silver_wanderer_court_hair.js';

export function createSilverWandererDetail(h) {
  const { THREE, bake, box, cyl, ball, addMerged, CLOTH, artoriaCloth, artoriaRoundedBox } = h;
  const base = createSilverWandererOutfit(h), SILVER = 0xc5c5cc, GOLD = 0xad914e;
  const newHair = createSilverWandererHair(h);
  const fullHair = createSilverWandererFullHair(h,base.head);
  const courtHair = createSilverWandererCourtHair(h,base.head);
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
  function soften(g) {
    const mesh = g.children[0], { width:w, height:h, depth:d } = mesh.geometry.parameters;
    const geo = new THREE.BoxGeometry(w, h, d, 8, 8, 8), p = geo.attributes.position;
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
    soften(g); const l = layer(g), silver = [], edging = [];
    // Hide v1's buried trim only. Keep the mantle itself and the white shirt.
    const old = g.children[0].children.find(n => n.name === 'silver-wanderer-cloth');
    for (const mesh of old?.children || []) if (mesh.material?.color.getHex() === 0xb6bbc3) mesh.visible = false;
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
    if (look?.hairStyle === 'swept_long_front') return;
    const strands=[];
    for(let i=-3;i<=3;i++) for(const dz of [-.013,.012]) {
      const z=i*.04;
      strands.push(line([[-.174,.139,z+dz],[-.182,-.07,z*1.14+dz],[-.201,-.33,z*1.21+dz],
        [-.241,-.60,z*1.17+dz*.8],[-.273,-.79+Math.abs(i)*.035,z*1.04+dz*.12]],.0008,3));
    }
    addMerged(l,strands,0xa39caa,{...thread,metalness:0,roughness:.65});
  }
  function abdomen(g,look) {
    soften(g); const l=layer(g), stitches=[];
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
    soften(g); const l=layer(g), trim=[], fasteners=[];
    const old = g.children[0].children.find(n=>n.name==='silver-wanderer-cloth');
    for(const mesh of old?.children||[]) if(mesh.material?.color.getHex()===0xa88b45) mesh.visible=false;
    // Work in scabbard coordinates and transform the whole fitting together.
    const place=geo=>bake(geo,[-.018,-.22,-.24],[0,0,-.23]);
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
  return Object.fromEntries(Object.entries(base).map(([part,decorate])=>[part,(g,look,d)=>{
    if (part === 'head' && look?.hairStyle === 'swept_long_front') { newHair(g,look); return; }
    if (part === 'head' && ['court_half_tie','court_braided_layers'].includes(look?.hairStyle)) { courtHair.head(g,look); return; }
    if (part === 'head' && look?.hairStyle === 'full_layered') { fullHair.head(g,look); return; }
    decorate(g,look,d);details[part]?.(g,look,d);
  }]));
}
