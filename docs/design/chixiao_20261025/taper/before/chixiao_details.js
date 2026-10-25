// 적소검 — 사용자 선택 시안(2026-10-25)의 붉은 직검·백옥 코등이.
// 전승의 창작 해석. 겉모습만 담당하며 질량/충돌/유파는 weapons.js에 둔다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { metalMat, weaponEnv } from './weapon_looks.js';

export const CHIXIAO_COLORS = { blade: 0x963d35, gold: 0xb59a60, grip: 0x282325 };
const v = p => new THREE.Vector3(...p);
function add(root, geometry, material, at = [0,0,0]) {
  const m = new THREE.Mesh(geometry, material); m.position.set(...at); m.castShadow = true; root.add(m); return m;
}
function relief(points, depth, bevel = .0006, smooth = false) {
  if(smooth){const curve=new THREE.CatmullRomCurve3(points.map(([x,y])=>v([x,y,0])),true,'centripetal');points=curve.getPoints(points.length*3).map(p=>[p.x,p.y]);}
  const s = new THREE.Shape(); points.forEach(([x,y],i) => i ? s.lineTo(x,y) : s.moveTo(x,y)); s.closePath();
  const g = new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,steps:1});
  g.translate(0,0,-depth/2); return g;
}
function line(root, points, radius, material, segments=24) {
  return add(root,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v)),segments,radius,4,false),material);
}
function angularLine(root, points, radius, material) {
  const path=new THREE.CurvePath();for(let i=1;i<points.length;i++)path.add(new THREE.LineCurve3(v(points[i-1]),v(points[i])));
  return add(root,new THREE.TubeGeometry(path,points.length*3,radius,4,false),material);
}
function compact(group) {
  group.updateMatrixWorld(true); const buckets=new Map();
  group.traverse(m=>{if(!m.isMesh)return; let g=m.geometry.clone();g.applyMatrix4(m.matrixWorld);if(!g.getAttribute('uv'))g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count*2),2));
    if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}const a=buckets.get(m.material)||[];a.push(g);buckets.set(m.material,a);});
  const root=new THREE.Group();for(const[mat,geos]of buckets){add(root,mergeGeometries(geos,false),mat);geos.forEach(g=>g.dispose());}
  group.traverse(m=>{if(m.isMesh)m.geometry.dispose();});return root;
}

// Small deterministic surface maps: no drawing-time randomness or extra file loads.
const surfaceMaps=new Map();
function grain(kind) {
  if(surfaceMaps.has(kind))return surfaceMaps.get(kind);
  const W=128,H=512,data=new Uint8Array(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const hash=((Math.imul(x+17,73856093)^Math.imul(y+11,19349663))>>>0)%101/100;
    const fine=kind==='cord'?Math.sin((y*1.45+x*.65)*Math.PI)*.23+Math.sin((y*.35-x*.18)*Math.PI)*.10:
      Math.sin(x*12.37)*.15+Math.sin(x*.67+y*.028)*.09;
    const shade=Math.max(25,Math.min(240,150+fine*105+(hash-.5)*22)),o=(y*W+x)*4;
    data[o]=data[o+1]=data[o+2]=shade;data[o+3]=255;
  }
  const tex=new THREE.DataTexture(data,W,H,THREE.RGBAFormat);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.needsUpdate=true;
  surfaceMaps.set(kind,tex);return tex;
}
function flatRibbon(root,r,h,turns,width,mat,phase=0) {
  const pos=[],uv=[],steps=180;
  const pt=(t,d)=>{const a=t*Math.PI*2*turns+phase;return[Math.cos(a)*r,-h+.009+t*(2*h-.018)+d,Math.sin(a)*r*.81];};
  for(let i=0;i<steps;i++){
    const t=i/steps,u=(i+1)/steps,a=pt(t,-width/2),b=pt(u,-width/2),c=pt(u,width/2),d=pt(t,width/2);
    pos.push(...a,...b,...c,...a,...c,...d);uv.push(t*turns,0,u*turns,0,u*turns,1,t*turns,0,u*turns,1,t*turns,1);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
  add(root,geo,mat);
}
function blade(shape, opts) {
  const [,hx,hy,hz]=shape,pos=[],cols=[],uv=[];
  const sections=[0,.025,.08,.18,.34,.55,.76,.84,.90,.95,.98,1];
  // Sharpened edge, narrow fillet, broad red face, slim recessed fuller, raised spine.
  const xs=[-1,-.92,-.77,-.18,-.13,-.055,0,.055,.13,.18,.77,.92,1];
  const heights=[0,.22,.44,.84,.75,.97,1,.97,.75,.84,.44,.22,0];
  // Muted red-brown steel faces; freshly honed edges and spine reflect silver-grey.
  const palette=[0xc7cbc9,0x9b9d9a,0x84504a,0x513638,0x95827a,0x71413c,0x9e9790,0x513b3a,0x9c847b,0x80504b,0x9d9f9c,0xc8cdcb].map(c=>new THREE.Color(c));
  const width=t=>t<=.84?1-.075*t:.937*(1-t)/.16;
  const thick=t=>(1-.25*t)*(t>.90?(1-t)/.10:1);
  const point=(t,k,side)=>[xs[k]*hx*width(t),-hy+2*hy*t,side*hz*heights[k]*thick(t)];
  function tri(a,b,c,col){pos.push(...a,...b,...c);for(const p of[a,b,c]){cols.push(col.r,col.g,col.b);uv.push(p[0]/(2*hx)+.5,(p[1]+hy)/(2*hy));}}
  for(const side of[-1,1])for(let j=1;j<sections.length;j++)for(let k=0;k<xs.length-1;k++){
    const a=point(sections[j-1],k,side),b=point(sections[j],k,side),c=point(sections[j],k+1,side),d=point(sections[j-1],k+1,side);
    const color=palette[k].clone().multiplyScalar(.94+.06*Math.sin(j*.9));
    if(side>0){tri(a,c,b,color);tri(a,d,c,color);}else{tri(a,b,c,color);tri(a,c,d,color);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
  const mat=metalMat(0xffffff,{...opts,roughness:.36,metalness:.86,vertexColors:true,flatShading:true,roughnessMap:grain('steel'),bumpMap:grain('steel'),bumpScale:.000025});
  const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=true;mesh.name='chixiaoRedBlade';
  const gold=metalMat(0xc7a25e,{rough:.28,metal:.82}),ornaments=new THREE.Group();
  const surface=(x,y,side)=>{
    const t=(y+hy)/(2*hy),u=Math.min(.999,Math.abs(x)/(hx*width(t)));let index=6;
    while(index<xs.length-2&&u>xs[index+1])index++;
    const f=(u-xs[index])/(xs[index+1]-xs[index]),z=heights[index]+f*(heights[index+1]-heights[index]);
    return side*(hz*z*thick(t)+.00019);
  };
  // Balanced branching scrolls echo the illustration; generous plain blade above.
  for(const face of[-1,1])for(const sign of[-1,1]){
    const project=pts=>pts.map(([x,y])=>[sign*x,y-hy,surface(sign*x,y-hy,face)]);
    line(ornaments,project([[.017,.008],[.017,.035],[.015,.065],[.012,.094],[.008,.126],[.006,.162]]),.00042,gold,54);
    for(let j=0;j<4;j++){
      const cy=.024+j*.031,cx=.012-j*.0015,pts=[];
      for(let i=0;i<=24;i++){const t=i/24,a=-.6+t*Math.PI*1.85,r=.0052*(1-t*.80);pts.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}
      line(ornaments,project(pts),.00052,gold,28);
      line(ornaments,project([[cx+.002,cy+.003],[cx+.0027,cy+.010],[cx-.001,cy+.017]]),.00038,gold,16);
    }
    line(ornaments,project([[.018,.012],[.008,.012],[.008,.020],[.014,.020],[.014,.026]]),.0004,gold,18);
  }
  mesh.add(compact(ornaments));return mesh;
}
function collar(root,r,y,h,gold,dark) {
  const band=add(root,new THREE.CylinderGeometry(r,r,h,24),gold,[0,y,0]);band.scale.z=.84;
  for(const dy of[-h*.43,h*.43]){const ring=add(root,new THREE.TorusGeometry(r*1.01,.00065,5,32),gold,[0,y+dy,0]);ring.rotation.x=Math.PI/2;ring.scale.y=.84;}
  // Cast scrolls wrap continuously around the collar, including its reverse.
  for(let k=0;k<12;k++){
    const pts=[];for(let i=0;i<=18;i++){
      const t=i/18,a=k*Math.PI/6+Math.cos(t*Math.PI*2.1)*.15*(1-t*.7);
      pts.push([Math.cos(a)*(r+.00025),y+Math.sin(t*Math.PI*2.1)*h*.31*(1-t*.7),Math.sin(a)*(r+.00025)*.84]);
    }line(root,pts,.00032,dark,18);
  }
}
function grip(shape) {
  const [,r,h]=shape,g=new THREE.Group(),surface=grain('cord');
  const black=new THREE.MeshStandardMaterial({color:0x241f20,roughness:.73,bumpMap:surface,bumpScale:.00024});
  const red=new THREE.MeshStandardMaterial({color:0x6e2220,roughness:.56,bumpMap:surface,bumpScale:.00012,side:THREE.DoubleSide});
  const fiber=new THREE.MeshStandardMaterial({color:0x893b2b,roughness:.72});
  const gold=metalMat(0xb6985a,{rough:.28}),dark=metalMat(0x513b22,{rough:.50});
  const body=add(g,new THREE.CylinderGeometry(r*.96,r*.99,h*2,24,8),black);body.scale.z=.81;
  // Dense black cord bedding: real shallow ridges, gathered into one draw call.
  const thread=new THREE.MeshStandardMaterial({color:0x393031,roughness:.85});
  const points=[];for(let i=0;i<=600;i++){const t=i/600,a=t*Math.PI*2*38;points.push([Math.cos(a)*r,-h+.007+t*(2*h-.014),Math.sin(a)*r*.81]);}
  line(g,points,.00033,thread,600);
  flatRibbon(g,r*1.015,h,5.2,.0048,red);
  flatRibbon(g,r*1.03,h,-5.2,.0048,red,Math.PI+.18);
  for(const winding of[1,-1])for(const d of[-.00165,-.0006,.0006,.00165]){
    const pts=[];for(let i=0;i<=180;i++){const t=i/180,a=winding*t*Math.PI*2*5.2+(winding<0?Math.PI+.18:0);pts.push([Math.cos(a)*r*1.04,-h+.009+t*(2*h-.018)+d,Math.sin(a)*r*1.04*.81]);}line(g,pts,.00018,fiber,180);
  }
  collar(g,r*1.055,-h+.007,.013,gold,dark);collar(g,r*1.075,h-.007,.014,gold,dark);
  return compact(g);
}
function traceContour(root,points,z,mat,r=.0005) {
  const c=new THREE.CatmullRomCurve3(points.map(([x,y])=>v([x,y,z])),true,'centripetal');
  add(root,new THREE.TubeGeometry(c,points.length*5,r,5,true),mat);
}
function jadeCurl(root,points,z,side,jade) {
  const curve=new THREE.CatmullRomCurve3(points.map(([x,y])=>v([x,y,0]))),pos=[],uv=[],indices=[],N=32,K=8;
  for(let i=0;i<=N;i++){
    const t=i/N,p=curve.getPoint(t),d=curve.getTangent(t),r=.0036*(1-.72*Math.pow(t,2));
    for(let j=0;j<=K;j++){const a=j/K*Math.PI*2;pos.push(p.x-d.y*Math.cos(a)*r,p.y+d.x*Math.cos(a)*r,z+side*Math.sin(a)*r*.48);uv.push(j/K,t);}
  }
  for(let i=0;i<N;i++)for(let j=0;j<K;j++){const a=i*(K+1)+j,b=a+K+1;
    if(side>0)indices.push(a,a+1,b,b,a+1,b+1);else indices.push(a,b,a+1,b,b+1,a+1);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();add(root,geo,jade);
}
function guard() {
  const g=new THREE.Group(),gold=metalMat(0xb7995b,{rough:.27}),rim=metalMat(0xd5b777,{rough:.24}),dark=metalMat(0x493522,{rough:.52});
  const jade=new THREE.MeshPhysicalMaterial({color:0xdcd9c4,roughness:.26,metalness:.04,
    envMap:weaponEnv(),envMapIntensity:.45,clearcoat:.30,clearcoatRoughness:.20});
  const outline=[[-.063,-.010],[-.065,.001],[-.060,.006],[-.050,.006],[-.042,.012],[-.034,.009],[-.030,.018],[-.021,.018],[-.014,.011],[-.011,.014],[.011,.014],[.014,.011],[.021,.018],[.030,.018],[.034,.009],[.042,.012],[.050,.006],[.060,.006],[.065,.001],[.063,-.010],[.041,-.006],[.022,-.010],[.012,-.012],[-.012,-.012],[-.022,-.010],[-.041,-.006]];
  add(g,relief(outline,.015,.001,true),gold);
  const inner=outline.map(([x,y])=>[x*.955,y*.82]);
  for(const side of[-1,1]){
    add(g,relief(inner,.001,0,true),dark,[0,.0005,side*.0081]);
    traceContour(g,outline.map(([x,y])=>[x*.98,y*.97]),side*.009,rim,.00063);
    traceContour(g,inner,side*.0092,gold,.00042);
    for(const sign of[-1,1]){
      const cloud=[[.016,-.005],[.020,.002],[.019,.009],[.023,.014],[.028,.014],[.031,.010],[.029,.005],[.035,.003],[.039,.007],[.044,.007],[.048,.003],[.047,-.001],[.056,-.001],[.060,-.005],[.058,-.008],[.045,-.004],[.040,-.006],[.034,-.003],[.028,-.004],[.023,-.007]];
      add(g,relief(cloud.map(([x,y])=>[x*sign,y]),.002,.0009,true),jade,[0,0,side*.0101]);
      jadeCurl(g,[[.019,-.002],[.026,-.003],[.031,.002],[.030,.009],[.025,.011],[.022,.007],[.025,.004]].map(([x,y])=>[x*sign,y]),side*.0118,side,jade);
      jadeCurl(g,[[.034,-.001],[.042,-.002],[.046,.003],[.043,.005],[.040,.003]].map(([x,y])=>[x*sign,y]),side*.0116,side,jade);
    }
    const panel=[[-.011,-.011],[.012,-.006],[.011,.015],[-.012,.009]];
    add(g,relief(panel,.0017,.0004),gold,[0,0,side*.0107]);
    const inset=panel.map(([x,y])=>[x*.77,y*.77]);add(g,relief(inset,.001,.0002),dark,[0,0,side*.0118]);
    // Small interlocking angular seal decoration, not a fabricated historical text.
    for(const mirror of[-1,1]){
      const key=[[-.007,.007],[.005,.010],[.007,.001],[-.002,-.001],[-.003,.005],[.002,.006],[.003,.002]];
      angularLine(g,key.map(([x,y])=>[mirror*x,mirror*y+.0015,side*.01265]),.00048,rim);
    }
  }
  return compact(g);
}
function pommel() {
  const g=new THREE.Group(),gold=metalMat(0xb89a5d,{rough:.28}),dark=metalMat(0x62472b,{rough:.46});
  const red=metalMat(0x6e241d,{rough:.33,metal:.65});
  const disk=(r,d,mat,z)=>{const m=add(g,new THREE.CylinderGeometry(r,r,d,32),mat,[0,0,z]);m.rotation.x=Math.PI/2;return m;};
  disk(.023,.016,gold,0);
  for(let k=0;k<32;k++){const a=k/32*Math.PI*2;const m=add(g,new THREE.BoxGeometry(.00065,.003,.012),dark,[Math.cos(a)*.0214,Math.sin(a)*.0214,0]);m.rotation.z=a-Math.PI/2;}
  for(const side of[-1,1]){
    disk(.0205,.0014,dark,side*.0085);disk(.0187,.0015,red,side*.0094);
    for(const r of[.0217,.0195])add(g,new THREE.TorusGeometry(r,.00052,5,40),gold,[0,0,side*.0099]);
    for(let k=0;k<5;k++){
      const ang=k/5*Math.PI*2,pts=[];for(let i=0;i<=20;i++){
        const t=i/20,a=ang+t*Math.PI*1.8,r=.006*(1-.72*t);pts.push([Math.cos(ang)*.0077+Math.cos(a)*r,Math.sin(ang)*.0077+Math.sin(a)*r,side*.0106]);
      }line(g,pts,.00049,gold,24);
    }
    add(g,new THREE.TorusGeometry(.0032,.00043,4,16),gold,[0,0,side*.0106]);
  }
  return compact(g);
}
export function chixiaoPartMesh(index,isBlade,shape,color,opts) {
  if(isBlade)return blade(shape,opts);
  return index===0?grip(shape):index===1?pommel():guard();
}
