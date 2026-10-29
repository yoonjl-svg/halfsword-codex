import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Visual prototype in metres. Named rigid parts, +Y up, +X game-forward.
// No combat statistics, colliders, or changes to the shared fighter renderer.
export function buildJulia() {
  const root = new T.Group(); root.name = 'julia_kristeva';
  const rig = new T.Group(); rig.name = 'visual_rig'; root.add(rig);
  const parts = {}, palette = {}, mats = {};
  for (const [key, color] of Object.entries({skin:0xdca480, skinLight:0xe6b28e, skinShade:0xb97f5e,
    ivory:0xdccfb5, linenShade:0xb8a88d, cream:0xe9ddc6, green:0x454b2c,
    greenLight:0x555c37, greenDark:0x303621, rust:0x8f4230, rustLight:0xaa5840,
    rustDark:0x673123, hair:0x302117, hairLight:0x4a3322, hairGlint:0x60452f,
    leather:0x3f2c21, leatherLight:0x604330, gold:0x98753b, goldLight:0xc0a16a,
    eye:0x21180f, iris:0x5a3b21, eyeWhite:0xcfc0a4, lips:0xa96953})) {
    palette[key]=color; mats[key]=new T.MeshStandardMaterial({color, roughness:key.startsWith('gold')?.48:.95,metalness:key.startsWith('gold')?.55:0,side:T.DoubleSide});
  }
  function part(name, parent=rig, pos=[0,0,0]) { const p=new T.Group();p.name=name;p.position.fromArray(pos);parent.add(p);parts[name]=p;return p; }
  const body=part('chest'), pelvis=part('pelvis'), head=part('head');
  function mesh(g,geo,mat,pos=[0,0,0],rot=[0,0,0]) {const o=new T.Mesh(geo,mats[mat]);o.position.fromArray(pos);o.rotation.set(...rot);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
  function ell(g,mat,pos,size,segs=12) {const o=mesh(g,new T.SphereGeometry(1,segs,8),mat,pos);o.scale.fromArray(size);return o;}
  function box(g,mat,pos,size,rot=[0,0,0]) {return mesh(g,new T.BoxGeometry(...size),mat,pos,rot);}
  function tube(g,mat,pts,r=.004,steps=16,radial=5) {return mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),steps,r,radial,false),mat);}
  function panel(g,mat,rows) {
    const p=[],ix=[],w=rows[0].length;
    for(const row of rows)for(const v of row)p.push(...v);
    for(let y=0;y<rows.length-1;y++)for(let x=0;x<w-1;x++){const a=y*w+x;ix.push(a,a+w,a+1,a+1,a+w,a+w+1);}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setIndex(ix);geo.computeVertexNormals();return mesh(g,geo,mat);
  }
  function shell(g,mat,rings,n=32,start=0,end=Math.PI*2,pleat=0) {
    return panel(g,mat,rings.map(([y,rx,rz])=>Array.from({length:n+1},(_,i)=>{
      const th=start+(end-start)*i/n,f=1+pleat*Math.cos(th*12);return [Math.sin(th)*rx*f,y,Math.cos(th)*rz*f];
    })));
  }
  // Fitted torso and open waistcoat: no oversize shoulder pads or inflated sleeves.
  const torso=[[.94,.125,.078],[1.02,.118,.078],[1.11,.135,.086],[1.21,.166,.102],[1.29,.17,.09],[1.35,.15,.07],[1.38,.065,.052]];
  shell(body,'ivory',torso);
  shell(body,'skin',[[1.365,.048,.040],[1.43,.038,.034],[1.448,.034,.032]],16);
  panel(body,'skin',[[[-.052,1.383,.057],[.052,1.383,.057]],[[-.044,1.33,.093],[.044,1.33,.093]],[[-.022,1.27,.108],[.022,1.27,.108]],[[-.002,1.235,.111],[.002,1.235,.111]]]);
  const vestRings=torso.slice(0,-1).map(([y,x,z])=>[y,x+.004,z+.005]);
  for(const side of [-1,1]) {
    const rows=vestRings.map(([y,rx,rz])=>{
      const opening=y>1.16?.12+(y-1.16)*3:.12;
      return Array.from({length:21},(_,i)=>{const a=side*(opening+(Math.PI-opening)*i/20);return [Math.sin(a)*rx,y,Math.cos(a)*rz];});
    });panel(body,'green',rows);
    const edge=rows.map(r=>[r[0][0],r[0][1],r[0][2]+.002]);tube(body,'gold',edge,.0022,20,4);
    for(let j=0;j<12;j++) {const y=.975+j*.028, op=y>1.16?.12+(y-1.16)*3:.12,rx=y<1.1?.125:.17,z=y<1.1?.087:.107;
      box(body,'goldLight',[side*(Math.sin(op)*rx+.009),y,Math.cos(op)*z+.002],[.004,.007,.0015],[0,0,side*-.25]);}
    panel(body,'cream',[[[side*.06,1.385,.052],[side*.103,1.349,.082]],[[side*.052,1.30,.108],[side*.086,1.29,.104]],[[side*.034,1.21,.111],[side*.065,1.23,.113]]]);
    tube(body,'linenShade',[[side*.048,1.35,.095],[side*.034,1.27,.11],[side*.019,1.19,.112]],.0017,10,4);
    tube(body,'greenDark',[[side*.092,.965,.068],[side*.094,1.07,.08],[side*.135,1.23,.08],[side*.153,1.31,.06]],.0018,15,4);
  }
  for(let i=0;i<5;i++) {const y=1.015+i*.031;box(body,'leather',[0,y,.091],[.037,.004,.004]);ell(body,'gold',[-.023,y,.092],[.004,.005,.003],8);ell(body,'gold',[.023,y,.092],[.004,.005,.003],8);}
  // Narrow arms, rolled linen cuffs, hands with separate thumb silhouette.
  for(const s of [-1,1]) {
    const upper=part(s<0?'uarmL':'uarmR',rig,[s*.177,1.32,0]); upper.rotation.z=s*.16;
    ell(upper,'ivory',[0,-.006,0],[.052,.055,.053],16);
    shell(upper,'ivory',[[.015,.047,.05],[-.045,.05,.05],[-.14,.047,.045],[-.22,.043,.04],[-.25,.037,.037]],16,0,Math.PI*2,.025);
    shell(upper,'cream',[[-.22,.045,.043],[-.25,.047,.044],[-.27,.039,.038]],16);
    for(let i=0;i<4;i++){const t=i*Math.PI/2;tube(upper,'linenShade',[[Math.sin(t)*.046,-.05,Math.cos(t)*.046],[Math.sin(t+.12)*.047,-.13,Math.cos(t+.12)*.047],[Math.sin(t)*.036,-.22,Math.cos(t)*.036]],.0016,8,4);}
    const lower=part(s<0?'farmL':'farmR',upper,[0,-.25,0]);lower.rotation.x=-.06;
    shell(lower,'skin',[[0,.032,.033],[-.09,.028,.03],[-.20,.021,.024]],12);
    const hand=part(s<0?'handL':'handR',lower,[0,-.22,.005]);
    ell(hand,'skin',[0,-.021,.002],[.026,.046,.018]);
    ell(hand,'skin',[s*-.022,-.018,.011],[.011,.025,.011],10);
    for(let j=0;j<3;j++)tube(hand,'skinShade',[[-.013+j*.011,-.047,.017],[-.014+j*.011,-.058,.013]],.0008,2,3);
  }
  // Olive walking skirt under a rust wrap, with layered diagonal hems.
  shell(pelvis,'greenDark',[[.98,.13,.088],[.87,.165,.11],[.69,.194,.13],[.46,.223,.15],[.30,.232,.155]],40,.17,Math.PI*2-.17,.035);
  for(let i=0;i<10;i++) {const a=.34+i*.59;tube(pelvis,'green',[[Math.sin(a)*.16,.88,Math.cos(a)*.112],[Math.sin(a)*.202,.57,Math.cos(a)*.136],[Math.sin(a)*.238,.31,Math.cos(a)*.158]],.0023,10,4);}
  const skirtRings=[[.98,.13,.088],[.87,.165,.11],[.69,.194,.13],[.46,.223,.15],[.30,.232,.155]];
  function skirtRadius(y,col){for(let k=0;k<skirtRings.length-1;k++){const a=skirtRings[k],b=skirtRings[k+1];if(y>=b[0]){const t=(a[0]-y)/(a[0]-b[0]);return a[col]*(1-t)+b[col]*t;}}return skirtRings.at(-1)[col];}
  const wrapRows=Array.from({length:10},(_,j)=>Array.from({length:49},(_,i)=>{
    const th=-.12+i/48*Math.PI*2,t=j/9;
    const hem=.33+.36*Math.pow(Math.max(0,Math.cos(th-.85)),3)+.025*Math.sin(th*2);
    const y=.97*(1-t)+hem*t,rx=skirtRadius(y,1)+.013,rz=skirtRadius(y,2)+.012,fold=1+.015*Math.sin(th*12+t);
    return [Math.sin(th)*rx*fold,y,Math.cos(th)*rz*fold];
  }));panel(pelvis,'rust',wrapRows);
  tube(pelvis,'rustDark',wrapRows.at(-1),.0035,48,4);
  for(let i=0;i<9;i++) {const a=.4+i*.67;const x=Math.sin(a),z=Math.cos(a);const ys=[.94,.87,.79];tube(pelvis,'rustLight',ys.map(y=>[x*(skirtRadius(y,1)+.014),y,z*(skirtRadius(y,2)+.014)]),.0015,10,4);}
  for(let k=0;k<5;k++)tube(pelvis,k%2?'rustDark':'rustLight',Array.from({length:12},(_,i)=>{const t=i/11,a=.83-t*1.9,y=.96-k*.017-t*.19;return [Math.sin(a)*(skirtRadius(y,1)+.016),y,Math.cos(a)*(skirtRadius(y,2)+.016)];}),.0016,15,4);
  // Belt, asymmetrical coin pouch, wrapped folio. They remain tied to pelvis.
  shell(pelvis,'leather',[[.956,.14,.098],[1.005,.134,.097]],32);
  box(pelvis,'gold',[.018,.98,.104],[.05,.042,.009]);box(pelvis,'leather',[.018,.98,.110],[.035,.027,.003]);box(pelvis,'gold',[.019,.98,.114],[.003,.028,.003]);
  for(let i=0;i<5;i++)ell(pelvis,'gold',[-.025-i*.014,.982,.103-i*.002],[.002,.002,.0015],6);
  box(pelvis,'leatherLight',[-.11,.87,.123],[.085,.135,.044],[.03,0,-.12]);
  ell(pelvis,'leather',[-.111,.819,.124],[.044,.028,.023]);
  box(pelvis,'leather',[-.106,.92,.151],[.083,.047,.009],[.04,0,-.12]);
  ell(pelvis,'gold',[-.106,.905,.158],[.006,.006,.003],8);
  tube(pelvis,'gold',[[.112,.968,.055],[.149,.907,.064],[.151,.887,.07]],.003,10,5);
  const folio=part('folio',pelvis,[.16,.805,.02]);folio.rotation.z=.15;
  mesh(folio,new T.CylinderGeometry(.025,.025,.22,12),'leatherLight');
  for(const y of [-.075,.08]) {mesh(folio,new T.CylinderGeometry(.028,.028,.013,12),'leather',[0,y,0]);box(folio,'gold',[0,y,.029],[.014,.012,.003]);}
  // Calf boots. Ankles and feet remain clearly grounded.
  for(const s of [-1,1]) {
    const leg=part(s<0?'legL':'legR',rig,[s*.077,0,0]);
    shell(leg,'skin',[[.50,.041,.043],[.32,.037,.036],[.23,.032,.034]],12);
    shell(leg,'leather',[[.32,.042,.041],[.29,.046,.043],[.20,.037,.039],[.09,.032,.035],[.05,.04,.043]],16);
    shell(leg,'leatherLight',[[.29,.046,.044],[.315,.044,.042]],16);
    ell(leg,'leather',[0,.045,.037],[.043,.047,.093]);box(leg,'leather',[0,.018,.033],[.083,.025,.163]);
    shell(leg,'leatherLight',[[.105,.038,.044],[.12,.038,.044]],16);
    box(leg,'gold',[s*.039,.113,.018],[.007,.02,.019]);
    tube(leg,'leatherLight',[[s*.021,.275,.037],[s*.01,.23,.038],[s*.019,.17,.039]],.002,10,4);
  }
  // Lightweight shawl: one cloth surface crossing the back, separate short tails.
  const shawlRows=Array.from({length:8},(_,j)=>Array.from({length:29},(_,i)=>{
    const a=.85+i/28*(Math.PI*2-1.7),t=j/7;
    return [Math.sin(a)*(.145+.065*t),1.365-t*(.14+.04*Math.max(0,-Math.cos(a))),Math.cos(a)*(.088+.04*t)-.006];
  }));panel(body,'rust',shawlRows);
  tube(body,'rustLight',shawlRows[0],.004,28,4);
  for(const s of [-1,1]) {
    panel(body,'rust',[[[s*.12,1.36,.065],[s*.18,1.34,.033]],[[s*.155,1.27,.10],[s*.218,1.25,.015]],[[s*.173,1.16,.085],[s*.22,1.205,.012]]]);
    tube(body,'rustDark',[[s*.13,1.355,.075],[s*.18,1.28,.088],[s*.18,1.18,.08]],.004,12,4);
    ell(body,'gold',[s*.12,1.347,.087],[.018,.018,.008],12);ell(body,'goldLight',[s*.12,1.347,.095],[.010,.010,.002],10);
  }
  // Face rings taper towards the jaw rather than a spherical head.
  shell(head,'skin',[[1.435,.028,.035],[1.45,.041,.047],[1.48,.063,.058],[1.52,.079,.068],[1.57,.086,.073],[1.62,.084,.075],[1.67,.075,.068],[1.70,.052,.05],[1.716,.004,.004]],32);
  for(const s of [-1,1]) {ell(head,'skin',[s*.085,1.558,0],[.018,.031,.014]);ell(head,'skinShade',[s*.093,1.558,.008],[.007,.018,.006]);}
  // Small inset eye planes, upper lids and brows: close eye heights, no luminous sclera.
  for(const s of [-1,1]) {
    const eye=new T.Group();eye.position.set(s*.037,1.585,.071);eye.rotation.y=s*.28;head.add(eye);
    const shape=new T.Shape();shape.moveTo(-.016,-.001);shape.quadraticCurveTo(-.007,.009,0,.007);shape.quadraticCurveTo(.011,.008,.016,-.001);shape.quadraticCurveTo(0,-.008,-.016,-.001);
    mesh(eye,new T.ShapeGeometry(shape,5),'eyeWhite');ell(eye,'iris',[s*-.002,0,.001],[.0065,.007,.002],10);ell(eye,'eye',[s*-.002,0,.003],[.0032,.005,.001],8);
    tube(eye,'hair',[[-.016,-.001,.002],[-.007,.006,.003],[.005,.007,.003],[.016,-.001,.002]],.0018,8,4);
    tube(eye,'hair',[[-.017,.019,0],[-.007,.023,.002],[.008,.022,.002],[.017,.016,0]],.0026,9,4);
  }
  panel(head,'skinLight',[[[-.006,1.59,.075],[.007,1.59,.075]],[[-.008,1.545,.091],[.010,1.545,.091]],[[-.012,1.537,.077],[.013,1.537,.077]]]);
  ell(head,'skinShade',[-.009,1.54,.086],[.003,.0015,.002],8);ell(head,'skinShade',[.009,1.54,.086],[.003,.0015,.002],8);
  tube(head,'lips',[[-.023,1.512,.064],[-.011,1.506,.067],[.003,1.505,.069],[.016,1.509,.065],[.023,1.516,.061]],.0022,12,4);
  tube(head,'skin',[[-.012,1.499,.067],[0,1.497,.069],[.011,1.501,.067]],.0014,8,4);
  // Fitted hair cap, wavy locks and a long interwoven braid; no floating nape.
  const hairRows=Array.from({length:12},(_,j)=>Array.from({length:41},(_,i)=>{
    const a=i/40*Math.PI*2,back=(1-Math.cos(a))/2,t=j/11;
    const phi=t*(1.10+1.13*back),y=1.59+.143*Math.cos(phi),span=Math.sin(phi);
    return [Math.sin(a)*.102*span,y,Math.cos(a)*.095*span-.008];
  }));panel(head,'hair',hairRows);
  for(const s of [-1,1]) {
    for(let j=0;j<7;j++) {const o=j*.006;tube(head,j%2?'hairLight':'hair',[[s*(.006+o*.25),1.715,-.002],[s*(.036+o),1.694,.068],[s*(.071+o*.45),1.659,.077],[s*(.087+o*.2),1.60,.02],[s*(.085+o*.3),1.53,-.036]],.0065-j*.00025,20,6);}
    tube(head,'hairLight',[[s*.06,1.671,.079],[s*.082,1.625,.066],[s*.077,1.575,.073],[s*.071,1.52,.056],[s*.091,1.485,.053],[s*.077,1.447,.048]],.006,22,5);
    tube(head,'hairGlint',[[s*.025,1.704,.045],[s*.055,1.681,.074],[s*.08,1.642,.067]],.0018,12,4);
  }
  // Cloth headband crosses the crown, then ties behind the head.
  panel(head,'rust',Array.from({length:17},(_,i)=>{
    const a=-1.5+i/16*3;return [[Math.sin(a)*.107,1.625+Math.cos(a)*.114,.014],[Math.sin(a)*.106,1.622+Math.cos(a)*.114,-.035]];
  }));
  tube(head,'rustLight',Array.from({length:17},(_,i)=>{const a=-1.5+i/16*3;return [Math.sin(a)*.107,1.625+Math.cos(a)*.115,.014];}),.0018,20,4);
  ell(head,'rust',[-.035,1.55,-.09],[.023,.018,.018]);
  for(const s of [-1,1]) panel(head,'rust',[[[-.035,1.55,-.095],[-.018,1.54,-.098]],[[-.038+s*.052,1.52,-.098],[-.025+s*.055,1.50,-.109]],[[-.052+s*.07,1.44,-.085],[-.028+s*.07,1.455,-.099]]]);
  const braid=part('braid',head);
  tube(braid,'hair',[[0,1.575,-.082],[.012,1.42,-.112],[.037,1.22,-.136],[.025,1.02,-.128]],.012,24,8);
  for(let j=0;j<11;j++) {
    const y=1.52-j*.046,x=.018+Math.sin(j*.2)*.017,z=-.102-j*.0023,r=.025-j*.0013;
    for(const s of [-1,1]) {const o=ell(braid,j%2?'hair':'hairLight',[x+s*r*.42,y,z-.006],[r*.73,.033,r*.62]);o.rotation.z=s*.53;
      tube(braid,'hairGlint',[[x+s*r*.75,y+.017,z-r*.6],[x+s*r*.4,y,z-r*.72],[x-s*.002,y-.017,z-r*.6]],.0013,7,4);}
  }
  ell(braid,'rust',[.032,1.025,-.137],[.021,.012,.018]);ell(braid,'hair',[.028,.99,-.134],[.018,.038,.014]);

  // Bake each part's material batches, retaining hierarchy for later fighter mounting.
  function batch(g) {
    for(const child of [...g.children])if(child.isGroup)batch(child);
    const bins=new Map();for(const m of [...g.children])if(m.isMesh) {
      m.updateMatrix();let geo=m.geometry.clone().applyMatrix4(m.matrix);if(geo.index)geo=geo.toNonIndexed();geo.deleteAttribute('uv');
      const key=m.material; if(!bins.has(key))bins.set(key,[]);bins.get(key).push(geo);g.remove(m);m.geometry.dispose();
    }
    for(const [mat,list]of bins){const geo=mergeGeometries(list,false);list.forEach(g=>g.dispose());const m=new T.Mesh(geo,mat);m.name=g.name+'_'+Object.keys(mats).find(k=>mats[k]===mat);m.castShadow=m.receiveShadow=true;g.add(m);}
  }
  // Move visual pivots to anatomical attachment points without moving their meshes.
  for(const [g,p]of [[head,[0,1.55,0]],[body,[0,1.19,0]],[pelvis,[0,.95,0]]]) {
    const shift=new T.Vector3(...p);for(const child of g.children)child.position.sub(shift);g.position.add(shift);
  }
  batch(rig);rig.rotation.y=Math.PI/2;
  const stats={triangles:0,meshes:0,materials:Object.keys(mats).length};root.traverse(m=>{if(m.isMesh){stats.meshes++;stats.triangles+=m.geometry.attributes.position.count/3;}});
  root.userData={characterName:'쥘리아 크리스테바',visualOnly:true,forward:'+X',units:'metres',stats};
  return {root,parts,stats,palette,dispose(){root.traverse(m=>{if(m.isMesh)m.geometry.dispose();});Object.values(mats).forEach(m=>m.dispose());}};
}
