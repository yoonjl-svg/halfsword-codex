// Procedural stage-only gate: real Three.js GPU resources and simulated stage clock.
// Native mobile combat is checked separately by new_pair_delivery_20261010.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs';
const out='/tmp/halfsword-frozen-bay-20261010';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/frozen-bay-audit',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Stage resource audit</title>'}));
 await page.goto('http://127.0.0.1:4240/frozen-bay-audit');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {Stages,STAGE_FOE}=await import('/src/stages.js');
  const scene=new THREE.Scene(),hemi=new THREE.HemisphereLight(),sun=new THREE.DirectionalLight();scene.add(hemi,sun);
  const renderer=new THREE.WebGLRenderer();renderer.setSize(320,240);document.body.append(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(50,4/3,.1,400);camera.position.set(-9,4,5);camera.lookAt(0,1,0);
  const stages=new Stages(scene,{hemi,sun}),runs=[];let cues=[];
  for(let n=0;n<3;n++) {
   const arena=stages.build('frozen_bay');arena.onEvent=(name,data)=>cues.push({name,...data});
   const hash=[],meshes=[];let finite=true,triangles=0;
   for(const o of stages.objects)o.traverse(c=>{if(c.isMesh){
    for(const attr of Object.values(c.geometry.attributes))for(const value of attr.array)if(!Number.isFinite(value))finite=false;
    const t=(c.geometry.index?.count??c.geometry.attributes.position.count)/3;triangles+=t;meshes.push({name:c.name,triangles:t});
    hash.push(...c.geometry.attributes.position.array.slice(0,9));
   }});
   stages.warm(renderer,camera);renderer.render(scene,camera);
   const active={...renderer.info.memory},calls=renderer.info.render.calls;
   if(n===0){arena.update(NaN);arena.update(-1);for(let i=0;i<1100;i++)arena.update(.1);}
   const geos=new Set(),mats=new Set(),textures=new Set();for(const o of stages.objects)o.traverse(c=>{
    if(c.geometry)geos.add(c.geometry);for(const m of [c.material].flat().filter(Boolean)){mats.add(m);for(const t of Object.values(m))if(t?.isTexture)textures.add(t);}
   });let disposed={geometries:0,materials:0,textures:0};
   for(const [set,key]of[[geos,'geometries'],[mats,'materials'],[textures,'textures']])for(const obj of set)obj.addEventListener('dispose',()=>disposed[key]++);
   stages.clear();renderer.render(scene,camera);
   runs.push({finite,triangles,meshes,calls,buildMs:stages.buildMs,active,cleared:{...renderer.info.memory},disposed,owned:{geometries:geos.size,materials:mats.size,textures:textures.size},hash});
  }
  renderer.dispose();return{runs,cues,foe:STAGE_FOE.frozen_bay};
 });
 await fs.writeFile(out+'/scene-observed.json',JSON.stringify({result,errors},null,2));
 assert.equal(result.foe,'eira');assert.equal(errors.length,0);
 for(const r of result.runs){assert(r.finite);assert(r.triangles<65000);assert(r.calls<20);assert.deepEqual(r.disposed,r.owned);assert.equal(r.cleared.geometries,0);assert.equal(r.active.textures-r.cleared.textures,r.owned.textures);assert.deepEqual(r.cleared,result.runs[0].cleared);assert.deepEqual(r.hash,result.runs[0].hash);}
 for(const kind of ['lakeIceBoom','frozenPierCreak']){const cues=result.cues.filter(c=>c.kind===kind);assert(cues.length>=3);for(let i=1;i<cues.length;i++)assert(cues[i].time-cues[i-1].time>=24);assert(cues.every(c=>c.name==='stageDetail'&&Number.isFinite(c.amp)&&c.amp>0));}
 const sources={};for(const file of ['src/stage_frozen_bay.js','src/stage_frozen_bay_shore.js','src/stages.js'])sources[file]=createHash('sha256').update(await fs.readFile(file)).digest('hex');
 await fs.writeFile(out+'/scene-report.json',JSON.stringify({pass:true,sources,method:'Three.js standalone actual renderer, three build/clear cycles; synthetic stage clock110s. No claim of human sound evaluation or physical phone FPS.',...result,errors},null,2));
 console.log(JSON.stringify({pass:true,triangles:result.runs[0].triangles,calls:result.runs[0].calls,resources:result.runs[0].owned,cues:result.cues.length}));
}finally{await browser.close();}
