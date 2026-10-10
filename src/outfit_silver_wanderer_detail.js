// v2 keeps v1 selectable. Surface-following embroidery and fittings only.
import { createSilverWandererOutfit } from './outfit_silver_wanderer.js';
import { createSilverWandererHair } from './outfit_silver_wanderer_hair.js';

export function createSilverWandererDetail(h) {
  const { THREE, bake, box, cyl, ball, addMerged, CLOTH, artoriaCloth } = h;
  const base = createSilverWandererOutfit(h), SILVER = 0xc5c5cc, GOLD = 0xad914e;
  const newHair = createSilverWandererHair(h);
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
      // One curling stem with alternating leaves, rather than parallel loops.
      silver.push(line(Array.from({length:17},(_,i)=> {
        const t=i/16; return collar(.249-t*.077,s*(.97+.075*Math.sin(t*Math.PI*2)));
      }),.0015));
      for (const y of [.237,.211,.185]) {
        silver.push(line([[y-.004,.96],[y+.001,.80],[y+.008,.77],[y+.009,.85],[y+.003,.89]]
          .map(([yy,a])=>collar(yy,s*a)),.0015));
        silver.push(line([[y-.005,.98],[y-.011,1.13],[y-.007,1.22],[y+.002,1.16],[y-.005,.98]]
          .map(([yy,a])=>collar(yy,s*a)),.0014));
      }
      // Woven hem continues around the short mantle, away from arm joints.
      edging.push(line(Array.from({length:22},(_,i)=>collar(.04,s*(.58+i/21*(Math.PI-.58)))),.0018));
    }
    edging.push(line(Array.from({length:37},(_,i)=>collar(.253,.58+i/36*(Math.PI*2-1.16))),.0018));
    addMerged(l,edging,0x8d879d,thread); addMerged(l,silver,SILVER,thread);
    // A modest three-button placket and soft white seam folds on the shirt.
    const shirtX = y => .12 * (.96 + .04 * (y + .14) / .28) + .0015;
    addMerged(l,[.069,.016,-.037].map(y=>bake(ball(.0038,8,6),[shirtX(y),y,.002],null,[.5,1,1])),SILVER,metal);
    addMerged(l,[-1,1].map(s=>line([[shirtX(.083),.083,s*.045],[shirtX(.014),.014,s*.054],[shirtX(-.091),-.091,s*.061]],.001)),0xd8d8d7,leather);
    if (look?.hairStyle === 'swept_long_front') return;
    const strands=[];
    for(let i=-3;i<=3;i++) for(const dz of [-.013,.012]) {
      const z=i*.04;
      strands.push(line([[-.174,.139,z+dz],[-.182,-.07,z*1.14+dz],[-.201,-.33,z*1.21+dz],
        [-.241,-.60,z*1.17+dz*.8],[-.273,-.79+Math.abs(i)*.035,z*1.04+dz*.12]],.0008,3));
    }
    addMerged(l,strands,0xa39caa,{...thread,metalness:0,roughness:.65});
  }
  function abdomen(g) {
    soften(g); const l=layer(g), stitches=[];
    for (const y of [-.026,-.079]) for(let z=-.14;z<.15;z+=.012)
      stitches.push(line([[.12,y,z],[.12,y,z+.006]],.0008,3));
    addMerged(l,stitches,0x968076,leather);
    // Engraved frame and tongue around the existing buckle, no belt resizing.
    addMerged(l,[line([[.134,-.022,-.039],[.134,-.022,.009],[.134,-.081,.009],
      [.134,-.081,-.039],[.134,-.022,-.039]],.002),
      line([[.14,-.05,-.03],[.14,-.043,-.012],[.14,-.055,-.003]],.0014)],SILVER,metal);
    addMerged(l,[.06,.093,.126].map(z=>bake(ball(.0025,6,4),[.12,-.05,z],null,[.5,1,1])),0x211a24,leather);
    addMerged(l,[box(.006,.063,.009,[.123,-.052,.047]),box(.006,.063,.009,[.12,-.052,-.079])],0x604957,leather);
  }
  function pelvis(g) {
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
    for(const y of [.303,-.301]) scroll.push(place(line([[.027,y+.012,-.009],[.029,y+.004,.009],
      [.029,y-.003,-.009],[.027,y-.012,.007]],.0012)));
    addMerged(l,fasteners,0x30242d,leather); addMerged(l,trim,GOLD,metal);
    addMerged(l,scroll,0xe2c77f,metal);
    // Short attached suspension straps; never a solid band crossing both legs.
    addMerged(l,[line([[.028,.079,-.177],[.063,.068,-.213],[.049,.054,-.24]],.005),
      line([[-.033,.067,-.179],[.018,-.022,-.218],[.029,-.03,-.24]],.005)],0x4e3541,leather);
  }
  function upperArm(g,look,d) {
    const l=layer(g), side=Math.sign(d.pos[2])||1;
    const surface=(x,y)=>[x,y,side*(.07488*Math.sqrt(Math.max(.02,1-(x/.072)**2-((y-.098)/.07344)**2))+.0018)];
    const glyph=[[-.019,.111],[-.012,.126],[.001,.119],[.009,.127],[.017,.113],
      [.006,.107],[.017,.093],[.005,.094],[.012,.083],[-.003,.088],[-.012,.079],[-.011,.099],[-.019,.111]];
    addMerged(l,[line(glyph.map(([x,y])=>surface(x,y)),.0019),
      line([[-.008,.109],[.002,.114],[.007,.103],[-.003,.098],[-.008,.109]].map(([x,y])=>surface(x,y)),.0014)],SILVER,thread);
    // Fine rolled cuff edge beneath the mantle, with small seam stitches.
    addMerged(l,[ring(.065,.0715)],0xa298b0,thread);
  }
  function forearm(g) {
    const l=layer(g), work=[];
    const surface=(y,a)=> {const r=.059-(.059-.049)*THREE.MathUtils.clamp((-.039-y)/.058,0,1)+.002;
      return [r*Math.cos(a),y,r*Math.sin(a)];};
    for(let k=0;k<6;k++) {
      const a=k*Math.PI/3;
      work.push(line([[.018,-.052],[.095,-.057],[-.05,-.067],[.09,-.076],[.025,-.082]]
        .map(([da,y])=>surface(y,a+da)),.0013));
    }
    addMerged(l,work,SILVER,thread);
    addMerged(l,[ring(-.041,.061),ring(-.081,.055),ring(-.103,.049)],0xd6d4dc,metal);
    addMerged(l,[cyl(.047,.046,.007,20,true,[0,-.116,0])],0x55435f,leather);
  }
  function skirt(g,side,lower) {
    const l=layer(g), a=side===1?.14:Math.PI*2-.14;
    const rows=lower?[[.282,.118,.115,-.034],[.14,.127,.125,-.038],[-.09,.145,.142,-.04],[-.175,.13,.136,-.037]]
      :[[.25,.135,.13,-.019],[.11,.142,.137,-.022],[-.12,.137,.137,-.03],[-.265,.134,.136,-.033]];
    const seam=rows.map(([y,rx,rz,x],j)=>[x+rx*Math.cos(a)*(1+.034*Math.cos(a*8+j*.25))+.002,
      y,rz*Math.sin(a)*(1+.034*Math.cos(a*8+j*.25))+side*.001]);
    addMerged(l,[line(seam,.0015)],0x94839f,thread);
    if(lower) {
      // Narrow engraved ridge on the visible silver greave.
      addMerged(l,[line([[.059,.076,-.018],[.065,.052,0],[.059,.076,.018]],.0014),
        line([[.054,-.11,-.014],[.055,-.132,0],[.054,-.11,.014]],.0012)],0x858994,metal);
    }
  }
  const details={chest,abdomen,pelvis,uarmS:upperArm,uarmO:upperArm,farmS:forearm,farmO:forearm,
    thighF:(g)=>skirt(g,1,false),thighB:(g)=>skirt(g,-1,false),
    shinF:(g)=>skirt(g,1,true),shinB:(g)=>skirt(g,-1,true)};
  return Object.fromEntries(Object.entries(base).map(([part,decorate])=>[part,(g,look,d)=>{
    if (part === 'head' && look?.hairStyle === 'swept_long_front') { newHair(g,look); return; }
    decorate(g,look,d);details[part]?.(g,look,d);
  }]));
}
