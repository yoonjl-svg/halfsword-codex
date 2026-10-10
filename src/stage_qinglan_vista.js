// A fictional great-river gorge, inspired by the broad walls of the Three
// Gorges and the grey ridges and pines of Mount Tai. No named site is reproduced.
// Only scenery is owned here: no gameplay bodies, lights, sky or sound.
import * as THREE from 'three';
import { Kit, rng, limb, boxUV, box } from './stage_kit.js';

const WATER_Y = -11.4;
const TAU = Math.PI * 2;
const RIVER_NODES = [[26, 0], [65, -5], [101, -18], [146, -29], [182, -3], [221, 31], [267, 20], [318, -19], [370, -9], [430, 12]];
const CRESTS = {
  '-1': [[-85, 13], [-30, 16], [28, 18], [67, 25], [103, 31], [146, 46], [178, 39], [221, 61], [264, 77], [305, 58], [350, 76], [435, 53]],
  '1': [[-85, 12], [-27, 15], [29, 17], [78, 23], [116, 29], [158, 43], [198, 63], [237, 45], [281, 62], [327, 83], [366, 62], [435, 51]],
};

// Kit copies each source. Dispose those sources immediately and its retained
// copies after merging; only the scene owns the resulting render resources.
class VistaKit extends Kit {
  putM(bin, geometry, color, matrix, options = {}) {
    try { return super.putM(bin, geometry, color, matrix, options); }
    finally { geometry.dispose(); }
  }
}

function interpolate(nodes, x, smooth = false) {
  if (x <= nodes[0][0]) return nodes[0][1];
  for (let i = 1; i < nodes.length; i++) {
    if (x > nodes[i][0]) continue;
    let t = (x - nodes[i - 1][0]) / (nodes[i][0] - nodes[i - 1][0]);
    if (smooth) t = t * t * (3 - 2 * t);
    return THREE.MathUtils.lerp(nodes[i - 1][1], nodes[i][1], t);
  }
  return nodes[nodes.length - 1][1];
}

const riverZ = x => interpolate(RIVER_NODES, x, true);
const riverHalfWidth = x => 14.4 + 2.1 * Math.sin(x * 0.014 + 0.4) + 0.9 * Math.sin(x * 0.047);
const valleyAxis = x => riverZ(x) * 0.25;
const valleyHalfWidth = x => 31 + THREE.MathUtils.smoothstep(x, 60, 250) * 34 + Math.max(0, -x) * 0.18;
const rockHeight = (x, side) => (interpolate(CRESTS[side], x) + 2.3 * Math.sin(x * 0.19 + side) + Math.sin(x * 0.43 - side) * 0.85) * 0.74;

function stoneTexture() {
  // A single neutral, seamless field: fine grain and irregular vertical seams.
  // DataTexture also keeps geometry validation independent of the DOM.
  const size=512, data=new Uint8Array(size*size*4);
  const hash=(x,y)=>{let n=(Math.imul(x,374761393)+Math.imul(y,668265263))|0;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const u=x/size,v=y/size;
    const grain=(hash(x,y)-0.5)*7;
    const worn=Math.sin(u*TAU*23+Math.sin(v*TAU*2)*1.2)*2.2;
    const seam=Math.pow(Math.max(0,Math.sin(u*TAU*11+Math.sin(v*TAU*3)*0.65+Math.sin(v*TAU*9)*0.13)),38);
    const value=Math.round(THREE.MathUtils.clamp(249+grain+worn-seam*20,217,255));
    const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.magFilter=THREE.LinearFilter;texture.anisotropy=4;texture.needsUpdate=true;
  texture.name='qinglan-neutral-stone-grain';
  return texture;
}

function geometryGrid(columns, rows, point, reverse = false) {
  const positions = [], indices = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) positions.push(...point(i / columns, j / rows));
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const a = j * (columns + 1) + i, b = a + 1, c = a + columns + 1, d = c + 1;
    const faces = (i + j) % 2 ? [a, b, d, a, d, c] : [a, b, c, b, d, c];
    for (let n = 0; n < faces.length; n += 3) {
      indices.push(faces[n], faces[n + (reverse ? 2 : 1)], faces[n + (reverse ? 1 : 2)]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// The river takes stronger turns than the broad gorge envelope. Low alluvial
// banks inside that envelope preserve views of both far bends from eye y=3.
function terrainPoint(x, distance, side) {
  const axis = valleyAxis(x), toe = valleyHalfWidth(x);
  const height = rockHeight(x, side);
  const broad = interpolate([[0, 0], [3, 0.06], [7, 0.25], [12, 0.31], [20, 0.36],
    [28, 0.73], [35, 0.83], [44, 0.66], [60, 1], [78, 0.80], [104, 0.36], [135, 0.07]], distance);
  const escarpment = THREE.MathUtils.smoothstep(distance, 1, 6) * (1 - THREE.MathUtils.smoothstep(distance, 8, 13))
    + THREE.MathUtils.smoothstep(distance, 19, 23) * (1 - THREE.MathUtils.smoothstep(distance, 29, 36));
  const fracture = Math.sin(x * 0.27 + side) * 1.5 + Math.sin(x * 0.63 - side * 1.6) * 0.65;
  const z = axis + side * (toe + distance + fracture * escarpment);
  const inclinedLayer = broad * height + Math.sin(x * 0.045 + side * 2) * 1.1;
  const ledge = Math.sin(inclinedLayer * 0.75 + x * 0.013 + side) * escarpment * 0.78;
  const saddle = Math.sin(x * 0.085 + distance * 0.069 + side * 3) * Math.sin(distance * 0.13) * 2.2;
  return [x, WATER_Y + 0.65 + broad * height + ledge + saddle, z];
}

function paintTerrain(g, side, far = false) {
  const p = g.attributes.position, n = g.attributes.normal, colors = g.attributes.color;
  const stone = new THREE.Color(0xa2a79f), darkRock = new THREE.Color(0x65726c);
  const forest = new THREE.Color(0x426d36), meadow = new THREE.Color(0x638447);
  const haze = new THREE.Color(0x9eb5b5), color = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), up = n.getY(i);
    const height = rockHeight(x, side), elevation = (y - WATER_Y) / height;
    const slopeForest = THREE.MathUtils.smoothstep(up, 0.20, 0.75);
    const patch = 0.5 + 0.5 * Math.sin(x * 0.065 + Math.sin(z * 0.071) * 1.4 + y * 0.043);
    const crestRock = THREE.MathUtils.smoothstep(elevation, 0.79, 0.95);
    const greenery = THREE.MathUtils.clamp(Math.max(slopeForest * (0.82 + patch * 0.14), 0.19 + patch * 0.24) - crestRock * 0.25, 0, 0.96);
    const crack = Math.pow(Math.max(0, Math.sin(x * 0.38 + z * 0.09 + Math.sin(y * 0.05))), 5);
    const strata = Math.sin(y * 0.51 + x * 0.024 + side) * 0.032;
    color.copy(stone).lerp(darkRock, crack * 0.31 + (1 - up) * 0.09);
    color.multiplyScalar(0.94 + strata + Math.sin(x * 0.09 + z * 0.11) * 0.035);
    const green = forest.clone().lerp(meadow, patch * 0.35);
    color.lerp(green, greenery);
    color.lerp(haze, THREE.MathUtils.smoothstep(x, 125, 445) * (far ? 0.7 : 0.57));
    colors.setXYZ(i, color.r, color.g, color.b);
  }
}

function bankPoint(x, v, side) {
  const edge = x < 26 ? side * 25 : riverZ(x) + side * riverHalfWidth(x) * 0.993;
  const toe = valleyAxis(x) + side * valleyHalfWidth(x);
  const z = THREE.MathUtils.lerp(edge, toe, v);
  const hummock = Math.pow(Math.max(0, Math.sin(x * 0.10 + v * 8 + side)
    * Math.sin(x * 0.047 - v * 5)), 2) * 1.75;
  const y = WATER_Y - 0.045 + Math.pow(v, 0.8) * 0.72
    + Math.sin(v * Math.PI) * (hummock + Math.sin(x * 0.071 + v * 7) * 0.16);
  return [x, y, z];
}

function canyonSides(K) {
  // Continuous mountain ribbons replace independent domes or tower stacks.
  // Their tall, fractured inner faces rise into broad, uneven forested ridges.
  for (const side of [-1, 1]) {
    const g = geometryGrid(184, 48, (u, v) => {
      const x = -82 + u * 515 + Math.sin(u * 67 + v * 3) * Math.sin(v * Math.PI) * 0.8;
      const d = v * 135;
      return terrainPoint(x, d, side);
    }, side > 0);
    const placed = K.put('mountains', g, 0xa2a79f, undefined, undefined, 1, { noise: 0, vary: 0 });
    paintTerrain(placed, side);

    const banks = geometryGrid(180, 12, (u, v) => {
      const x = -82 + u * 515;
      return bankPoint(x,v,side);
    }, side > 0);
    const ground = K.put('banks', banks, 0x737d66, undefined, undefined, 1, { noise: 0.013, vary: 0 });
    const col = ground.attributes.color, pos = ground.attributes.position, c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const patch = Math.sin(pos.getX(i) * 0.09 + Math.sin(pos.getZ(i) * 0.13) * 1.6);
      c.set(0x969888).lerp(new THREE.Color(0x4f713b), 0.44 + patch * 0.38);
      c.lerp(new THREE.Color(0x9eb5b5), THREE.MathUtils.smoothstep(pos.getX(i), 150, 445) * 0.5);
      col.setXYZ(i, c.r, c.g, c.b);
    }
  }
}

function lowRiverbanks(K) {
  const r=rng(263971);let shrubs=0,stones=0;
  for(const side of [-1,1]) for(let i=0;i<38;i++) {
    const x=37+i*7.5+r()*5;
    // Most scrub follows the escarpment foot, leaving the inner sight corridor
    // low. Small pale rocks interrupt the shoreline instead of outlining it.
    const v=0.76+r()*0.20, base=bankPoint(x,v,side), size=1.1+r()*2.2;
    for(let j=0;j<2;j++) {
      K.put('needles',pineCrown(size*(j?0.65:1),0.55+r()*0.3,i+j),j?0x4c703c:0x426638,
        [base[0]+j*size*0.64,base[1]+0.15,base[2]+j*side*size*0.28],[0,r()*TAU,0],1,{noise:0.025,vary:0.18});shrubs++;
    }
    if(i%2===0) {
      const p=bankPoint(x+2,0.04+r()*0.2,side);
      K.put('outcrops',new THREE.DodecahedronGeometry(1,0),0xa6a99c,
        [p[0],p[1]-0.15,p[2]],[0.1,r()*TAU,0.14],[0.7+r()*1.8,0.25+r()*0.32,0.6+r()*1.1],{noise:0.045,vary:0.13});stones++;
    }
  }
  return {bankShrubs:shrubs,bankStones:stones};
}

function greatRiver(K) {
  const placed = K.put('river', geometryGrid(208, 10, (u, v) => {
    const x = 26 + u * 409;
    return [x, WATER_Y, riverZ(x) + (v * 2 - 1) * riverHalfWidth(x)];
  }, true), 0x377f79, undefined, undefined, 1, { noise: 0, vary: 0 });
  const p = placed.attributes.position, c = placed.attributes.color;
  const deep = new THREE.Color(0x367d77), jade = new THREE.Color(0x77ae9c), haze = new THREE.Color(0x9db9b5), color = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const edge = Math.abs(z - riverZ(x)) / riverHalfWidth(x);
    color.copy(deep).lerp(jade, 0.14 + edge * edge * 0.29 + Math.sin(x * 0.09 + z * 0.11) * 0.05);
    color.lerp(haze, THREE.MathUtils.smoothstep(x, 170, 440) * 0.35);
    c.setXYZ(i, color.r, color.g, color.b);
  }
  const r = rng(641083);
  for (let i = 0; i < 64; i++) {
    const x = 42 + r() * 345, z = riverZ(x) + (r() - 0.5) * riverHalfWidth(x) * 1.56;
    const width = 0.45 + r() * 2.8, length = 0.04 + r() * 0.075;
    K.put('glints', geometryGrid(1, 1, (u, v) => [x + (u - 0.5) * length, WATER_Y + 0.016, z + (v - 0.5) * width], true),
      0xb3c9b1, undefined, undefined, 1, { vary: 0.18, noise: 0 });
  }
  return { x: 48, y: WATER_Y, z: riverZ(48) };
}

function ridgeRock(K, x, d, side, scale, seed) {
  const base = terrainPoint(x, d, side);
  // A bedded angular slab, partially buried in its ridge. Its long front and
  // split, leaning top read as an exposed outcrop rather than a round boulder.
  const ring = [[-1,-0.75],[-0.15,-1],[0.9,-0.65],[1,0.25],[0.25,0.82],[-0.9,0.7]];
  const positions = [], top = [], lower = [];
  for (let i = 0; i < ring.length; i++) {
    const [a,b] = ring[i];
    lower.push([a * scale * 1.2, -scale * 0.36, b * scale * 0.64]);
    top.push([a * scale * 0.8 + scale * 0.13, scale * (0.52 + Math.sin(i * 1.7 + seed) * 0.19), b * scale * 0.53]);
  }
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    positions.push(...lower[i], ...top[i], ...lower[j], ...lower[j], ...top[i], ...top[j]);
    positions.push(...top[i], 0, scale * 0.63, 0, ...top[j]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));g.computeVertexNormals();
  K.put('outcrops', g, 0xa7aca3, [base[0], base[1], base[2]], [0.05, seed * 0.2, side * 0.06], 1, { noise: 0.045, vary: 0.12 });
}

function pineCrown(radius, depth, seed) {
  const segments = 11, positions = [];
  const rim = [];
  for (let i = 0; i < segments; i++) {
    const a = i / segments * TAU;
    const r = radius * (0.81 + 0.14 * Math.sin(i * 2.3 + seed) + 0.1 * Math.cos(i * 4.1));
    rim.push([Math.cos(a) * r, -depth * (0.35 + 0.19 * Math.sin(i * 3.1 + seed)), Math.sin(a) * r]);
  }
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    positions.push(0, depth * 0.5, 0, ...rim[j], ...rim[i]);
    positions.push(0, -depth * 0.73, 0, ...rim[i], ...rim[j]);
  }
  const g = new THREE.BufferGeometry();g.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();
  return g;
}

function ridgePine(K, r, base, height) {
  const lean = (r() - 0.5) * height * 0.32, twist = r() * TAU;
  K.push(base, twist);
  limb(K, 'wood', [0,-0.15,0], [lean * 0.55,height * 0.64,0.1], height * 0.035, height * 0.022, 0x5a6252, {noise:0.03}, 6);
  limb(K, 'wood', [lean * 0.55,height * 0.64,0.1], [lean,height,0], height * 0.023, height * 0.009, 0x5a6252, {noise:0.03}, 5);
  for (let j = 0; j < 3; j++) {
    const a = j * 2.5 + r(), spread = height * (j === 2 ? 0.11 : 0.26);
    const y = height * (0.58 + j * 0.19);
    const tip = [Math.cos(a) * spread + lean * y / height, y + height * 0.07, Math.sin(a) * spread];
    limb(K, 'wood', [lean * y / height,y - height * 0.05,0], tip, height * 0.018, height * 0.007, 0x5a6252, {}, 5);
    K.put('needles', pineCrown(height * (0.29 - j * 0.038), height * 0.13, r() * 10), j === 1 ? 0x3e5c3b : 0x345139,
      tip, [0, r() * TAU, 0], [1.15,1,0.83], { noise:0.035, vary:0.13 });
  }
  K.pop();
}

function rockyPineRidges(K) {
  const r = rng(990371);let pines = 0, rocks = 0;
  for (const side of [-1,1]) {
    for (let i = 0; i < 20; i++) {
      const x = -12 + i * 9.6 + r() * 5, d = 28 + (r() - 0.5) * 6;
      const base = terrainPoint(x,d,side);
      ridgePine(K,r,base,3.1 + r() * 3.4);pines++;
      if(i % 3 === 0) { ridgeRock(K,x + 4,d + 1.2,side,3.2 + r() * 3.9,i + side);rocks++; }
    }
    for(let i=0;i<7;i++) {
      const x=44+i*19+r()*5,d=50+r()*11;
      ridgePine(K,r,terrainPoint(x,d,side),3.8+r()*3.2);pines++;
    }
  }
  return {pines,rocks};
}

function hillsidePath(K) {
  const positions=[],rails=[];
  const count=28;
  const route=t=>({x:96+t*35,d:14.5+9.5*t*t});
  const quad=(a,b,c,d)=>positions.push(...a,...b,...c,...a,...c,...d);
  for(let i=0;i<count;i++) {
    const a=route(i/count),b=route((i+1)/count);
    const corners=[terrainPoint(a.x,a.d-0.76,1),terrainPoint(b.x,b.d-0.76,1),
      terrainPoint(b.x,b.d+0.76,1),terrainPoint(a.x,a.d+0.76,1)];
    const y=Math.max(...corners.map(p=>p[1]))+0.14;
    const top=corners.map(p=>[p[0],y,p[2]]);
    const base=corners.map(p=>[p[0],p[1]-0.22,p[2]]);
    quad(top[0],top[3],top[2],top[1]);
    for(let j=0;j<4;j++){const k=(j+1)%4;quad(base[j],top[j],top[k],base[k]);}
    if(i%4===0||i===count-1) {
      const p=terrainPoint((a.x+b.x)*0.5,(a.d+b.d)*0.5+0.74,1);
      const height=y-p[1]+0.64;
      K.put('outcrops',box(0.18,height+0.18,0.18),0xb9beb0,[p[0],p[1]+height/2-0.09,p[2]],undefined,1,{noise:0.02,vary:0.07});
      rails.push([p[0],y+0.50,p[2]]);
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();
  K.put('outcrops',g,0xc2c4b5,undefined,undefined,1,{noise:0.025,vary:0});
  for(let i=1;i<rails.length;i++)limb(K,'outcrops',rails[i-1],rails[i],0.065,0.065,0xb7bcae,{noise:0.018,vary:0.04},4);
  return count;
}

export function buildQinglanVista(scene) {
  const K = new VistaKit(375183);
  canyonSides(K);
  const riverPos = greatRiver(K);
  const details = {...rockyPineRidges(K),...lowRiverbanks(K)};
  details.hillsideSteps=hillsidePath(K);
  const stoneMap=stoneTexture();
  const materials = {
    mountains:new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,map:stoneMap}),
    banks:new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),
    outcrops:new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true,map:stoneMap}),
    wood:new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),
    needles:new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true}),
    river:new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.39,metalness:0.04}),
    glints:new THREE.MeshBasicMaterial({vertexColors:true}),
  };
  const stats = {meshes:0,triangles:0,minSceneryRadius:Infinity,riverY:WATER_Y,...details,
    continuousRidges:2,riverLength:409,riverWidth:[23,35],style:'great-river-gorge'};
  for(const [bin,material] of Object.entries(materials)) {
    const mesh=K.mesh(bin,material,{cast:false,receive:bin==='outcrops'||bin==='wood'});
    if(!mesh){material.dispose();continue;}
    mesh.name=`qinglan-vista-${bin}`;
    if(bin==='mountains'||bin==='outcrops')boxUV(mesh.geometry,0.08);
    mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
    const p=mesh.geometry.attributes.position;stats.meshes++;stats.triangles+=(mesh.geometry.index?.count??p.count)/3;
    for(let i=0;i<p.count;i++)stats.minSceneryRadius=Math.min(stats.minSceneryRadius,Math.hypot(p.getX(i),p.getZ(i)));
    scene.add(mesh);
    for(const source of K.bins[bin])source.dispose();delete K.bins[bin];
  }
  return {stats,riverPos};
}
