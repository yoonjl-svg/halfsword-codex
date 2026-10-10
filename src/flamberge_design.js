// Visual study after Cleveland 1919.71. Dimensions in metres, point along +Y.
// Museum lengths are measured; blade section, back face and fine relief are reconstruction.
// No weapon registration, collider, mass, attack bonus or epic ability is defined here.
import * as THREE from 'three';
import { bladeGeometry, metalMat } from './weapon_looks.js';

export const FLAMBERGE_DIMENSIONS = Object.freeze({ overall: 1.689, blade: 1.187, ricasso: 0.267, guard: 0.505 });

function add(root, geometry, material, position = [0, 0, 0], name = '') {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...position); m.name = name; m.castShadow = true;
  root.add(m); return m;
}

function plate(points, depth, bevel = 0) {
  const shape = new THREE.Shape();
  points.forEach(([x,y],i) => i ? shape.lineTo(x,y) : shape.moveTo(x,y)); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * bevel, bevelEnabled: bevel > 0,
    bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, steps: 1, curveSegments: 1 });
  g.translate(0, 0, -depth / 2 + bevel); return g;
}

function strap(points, width, depth) {
  const side = points.map(([x,y],i) => {
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
    const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy);
    return [-dy/l*width/2,dx/l*width/2];
  });
  return plate([...points.map(([x,y],i)=>[x+side[i][0],y+side[i][1]]),
    ...points.map(([x,y],i)=>[x-side[i][0],y-side[i][1]]).reverse()],depth,depth>0.003?0.00035:0);
}

export function createFlambergeDesign() {
  const root=new THREE.Group();root.name='flamberge-cleveland-1919-71';
  const steel=metalMat(0x9ba1a2,{rough:0.34}),darkSteel=metalMat(0x646967,{rough:0.44});
  const bronze=metalMat(0x776044,{rough:0.45,metal:0.75});
  const brass=metalMat(0x9d7a43,{rough:0.38,metal:0.78});
  const leather=new THREE.MeshStandardMaterial({color:0x30231d,roughness:0.94});
  const seam=new THREE.MeshStandardMaterial({color:0x181712,roughness:0.95});
  const rootY=FLAMBERGE_DIMENSIONS.overall-FLAMBERGE_DIMENSIONS.blade;
  const edgeY=rootY+FLAMBERGE_DIMENSIONS.ricasso;

  // Compact faceted bronze pommel, long two-section leather-over-wood grip.
  add(root,new THREE.LatheGeometry([[0,0],[0.011,0.014],[0.024,0.034],[0.021,0.044],
    [0.012,0.061],[0.010,0.066]].map(p=>new THREE.Vector2(...p)),8),bronze,[0,0,0],'bronze-pommel');
  const gripProfile=[[0.011,0.059],[0.014,0.086],[0.017,0.18],[0.018,0.241],
    [0.015,0.252],[0.018,0.278],[0.018,0.37],[0.019,0.475],[0.017,0.492]];
  const grip=add(root,new THREE.LatheGeometry(gripProfile.map(p=>new THREE.Vector2(...p)),16),leather,[0,0,0],'leather-grip');
  grip.scale.z=0.86;
  // Restrained leather joins and brass rivets, not an invented gold-wrapped grip.
  for(const y of [0.085,0.167,0.245,0.284,0.369,0.449,0.483]){
    const r=y<0.15?0.0145:0.0182;
    const band=add(root,new THREE.CylinderGeometry(r+0.0004,r+0.0004,0.002,16),seam,[0,y,0]);band.scale.z=0.87;
  }
  for(const y of [0.108,0.153,0.202,0.305,0.35,0.404,0.452])for(const side of [-1,1]){
    const rivet=add(root,new THREE.SphereGeometry(0.0024,8,6),brass,[0.006,y,side*(y<0.15?0.0125:0.0156)]);rivet.scale.z=0.45;
  }

  // Swept flattened quillons with terminal paddles and six characteristic open curls.
  for(const s of [-1,1]){
    const outline=[[0.018,-0.010],[0.10,0.000],[0.19,0.018],[0.227,0.033],[0.247,0.038],
      [0.2525,0.048],[0.238,0.054],[0.220,0.044],[0.186,0.031],[0.097,0.014],[0.018,0.011]];
    const quillon=plate(outline.map(([x,y])=>[s*x,y]),0.011,0.0008);
    // Chamfer is inside the documented outer span, not extra blade reach.
    quillon.computeBoundingBox();const xmax=Math.max(Math.abs(quillon.boundingBox.min.x),Math.abs(quillon.boundingBox.max.x));
    quillon.scale(0.2525/xmax,1,1);
    add(root,quillon,steel,[0,rootY,0],'swept-quillon');
    for(const [cx,cy,rad,start,sweep]of [[0.073,0.029,0.018,-Math.PI/2,-Math.PI*1.62],
      [0.181,0.045,0.015,-Math.PI/2,Math.PI*1.72],[0.190,0.004,0.014,Math.PI/2,-Math.PI*1.66]]){
      const pts=Array.from({length:29},(_,i)=>{const a=start+sweep*i/28;return[s*(cx+rad*Math.cos(a)),cy+rad*Math.sin(a)];});
      add(root,strap(pts,0.0038,0.0055),steel,[0,rootY,0],'open-scroll');
    }
    // Fine diagonal incisions visible in the photograph; mirrored reconstruction on back.
    for(let i=0;i<7;i++)for(const z of [-0.0057,0.0057]){
      const x=0.049+i*0.022,y=0.002+(x-0.049)*0.14;
      add(root,strap([[s*(x-0.005),y-0.005],[s*(x+0.004),y+0.007]],0.00055,0.0003),darkSteel,[0,rootY,z]);
    }
  }
  add(root,plate([[-0.032,-0.013],[-0.032,0.010],[-0.012,0.018],[0.031,0.008],[0.031,-0.013],[0.010,-0.020]],0.031,0.001),steel,[0,rootY,0],'guard-block');
  for(const z of [-0.0157,0.0157])for(const s of [-1,1]){
    add(root,strap([[-0.019,s*0.010],[0.019,-s*0.010]],0.0006,0.0003),darkSteel,[0,rootY,z]);
  }

  // Long unsharpened ricasso, included within the museum's blade measurement.
  add(root,new THREE.BoxGeometry(0.031,0.237,0.007),darkSteel,[0,rootY+0.237/2,0],'straight-ricasso');
  // Distinct forward-swept parrying lugs; broad solid roots taper to the points.
  for(const s of [-1,1]){
    const hook=[[0,0],[0.032,0.004],[0.061,0.017],[0.083,0.039],[0.089,0.050],
      [0.072,0.035],[0.047,0.025],[0.019,0.021],[0,0.020]];
    add(root,plate(hook.map(([x,y])=>[s*x,y]),0.007,0.0007),steel,[0,rootY+0.220,0],'parrying-lug');
  }
  add(root,new THREE.BoxGeometry(0.027,0.034,0.006),steel,[0,edgeY-0.017,0]);

  // Closely spaced shallow undulations after the surviving blade silhouette.
  // 22 cycles and 6.4mm basal section are drawing estimates, not museum measurements.
  const L=FLAMBERGE_DIMENSIONS.blade-FLAMBERGE_DIMENSIONS.ricasso;
  const wave=t=>0.0036*Math.sin(t*22*Math.PI*2)*Math.min(1,t/0.025)*Math.min(1,(1-t)/0.07);
  const half=t=>0.017*(1-0.12*t)+0.0006*Math.sin(t*44*Math.PI*2);
  const geo=bladeGeometry(0.017,L/2,0.0032,{edge:'double',thick:0.0032,segs:352,
    edgeX:t=>wave(t)+half(t),backX:t=>wave(t)-half(t),tip:'spear',tipLen:0.032,overshoot:0,bevel:0.005});
  const bladeMaterial=metalMat(0xa3adb4,{rough:0.30,vertexColors:true});
  add(root,geo,bladeMaterial,[0,edgeY+L/2,0],'waved-double-edge');
  root.userData={reference:'Cleveland Museum of Art 1919.71',dimensions:FLAMBERGE_DIMENSIONS,visualOnly:true};
  return root;
}
