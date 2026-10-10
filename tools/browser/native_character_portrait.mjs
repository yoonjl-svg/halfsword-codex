// Capture actual settled Fighter meshes under neutral inspection lighting.
// CAPTURE_IDS=silver_wanderer CAPTURE_VIEWS=front,threeq,back CAPTURE_BASE=http://127.0.0.1:4280 CAPTURE_OUT=/tmp/portraits node tools/browser/native_character_portrait.mjs
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const sourceRoot=process.env.SOURCE_ROOT||fileURLToPath(new URL('../..',import.meta.url));
const {CHARACTERS_BY_ID}=await import(`${sourceRoot}/src/characters.js`);
const {CHARACTER_LOOK_VERSION}=await import(`${sourceRoot}/src/looks.js`);
const entryBase=process.env.CAPTURE_BASE||'http://127.0.0.1:4240';
import {chromium} from '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs';
const out=process.env.CAPTURE_OUT||'/tmp/halfsword-native-portraits';
await fs.mkdir(out,{recursive:true});
const cases=(process.env.CAPTURE_IDS?process.env.CAPTURE_IDS.split(','):['silver_wanderer']).map(id=>[id,CHARACTERS_BY_ID[id].name]);
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-networking']});
const context=await browser.newContext({viewport:{width:1000,height:950},deviceScaleFactor:1});
await context.addInitScript(()=>localStorage.setItem('gladiator-settings',JSON.stringify({pixel:false,sound:false,trail:false,blood:true,difficulty:'normal',skill:'0.3',fpsCap:true})));
const results=[];
try{
for(const [id,label] of cases){
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const url=`${entryBase}/?stage=crown_sanctum&foe=${id}&look=${id}:${CHARACTER_LOOK_VERSION[id]}&weapon=longsword&foeWeapon=${CHARACTERS_BY_ID[id].weapon}`;
 await page.route('**/@vite/client',r=>r.fulfill({status:200,contentType:'application/javascript',body:'// HMR disabled in capture browser.'}));await page.goto(url,{waitUntil:'networkidle',timeout:60000});
 await page.waitForFunction(()=>window.game?.enemy?.groups?.head,{timeout:60000});
 await page.locator('#btnStart').click();
 await page.waitForFunction(()=>game.state==='fight'&&game.stats.simTime>=1.2,{timeout:120000});
 await page.evaluate(()=>{document.querySelector('#btnPause').click();});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const info=await page.evaluate(({id,label})=>{
  const {THREE}=game,f=id==='player'?game.player:game.enemy;
  f.syncMeshes(); window.requestAnimationFrame=()=>0; const scene=new THREE.Scene();scene.background=new THREE.Color(0xc9c7be);
  const subject=new THREE.Group(),center=f.bodies.pelvis.translation(),headCenter=f.bodies.head.translation();
  const headPoint={x:headCenter.x-center.x,y:headCenter.y,z:headCenter.z-center.z};
  for(const {group} of f.meshes){ const clone=group.clone(true);clone.position.x-=center.x;clone.position.z-=center.z;subject.add(clone);}
  if(id==='player')subject.rotation.y=Math.PI;
  scene.add(subject);
  scene.add(new THREE.HemisphereLight(0xeaf1ff,0x62604e,2.0));
  const key=new THREE.DirectionalLight(0xffedd2,3.0);key.position.set(-3,5,4);scene.add(key);
  const fill=new THREE.DirectionalLight(0xd4e4ff,1.2);fill.position.set(3,3,-3);scene.add(fill);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:0xb0afa3,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-0.01;scene.add(ground);
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,900);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  const div=document.createElement('div');div.id='audit';div.style='position:fixed;inset:0;z-index:2147483647;background:#c9c7be;color:#202420;font:20px sans-serif;';
  const header=document.createElement('div');header.style='height:50px;display:flex;align-items:center;justify-content:center;';header.textContent=label+' · current native model · neutral comparison';div.append(header,renderer.domElement);document.body.append(div);
  window.audit={scene,subject,renderer,THREE,render(kind){
   const camera=new THREE.PerspectiveCamera(kind==='detail'?24:32,1000/900,0.01,100);
   if(kind==='eyes'){camera.fov=30;camera.updateProjectionMatrix();camera.position.set(headPoint.x-.54,headPoint.y+.015,headPoint.z+.04);camera.lookAt(headPoint.x,headPoint.y+.005,headPoint.z);}
   else if(kind==='front'){camera.position.set(-3.95,1.28,0.06);camera.lookAt(0,0.98,0);}
   else if(kind==='detail'){camera.position.set(-1.72,1.71,0.70);camera.lookAt(0,1.52,0);}
   else if(kind==='fittings'){camera.fov=30;camera.updateProjectionMatrix();camera.position.set(-1.43,1.25,0.87);camera.lookAt(0,0.99,0);}
   else if(kind==='side'){camera.position.set(0,1.35,4.0);camera.lookAt(0,0.93,0);}
   else if(kind==='back'){camera.position.set(3.15,1.5,-2.1);camera.lookAt(0,0.95,0);}
   else {camera.position.set(-3.10,1.47,2.30);camera.lookAt(0,0.98,0);}
   renderer.render(scene,camera);window.nativeRender={...renderer.info.render};
  }};
  let meshCount=0,vertices=0,visibleMeshes=0,transparentMeshes=0;subject.traverse(o=>{if(o.isMesh){meshCount++;vertices+=o.geometry.attributes.position.count;}});subject.traverseVisible(o=>{if(o.isMesh){visibleMeshes++;if([o.material].flat().some(m=>m.transparent))transparentMeshes++;}});
  return {id,label,url:location.href,stageRender:game.renderInfo(),state:game.state,simTime:game.stats.simTime,guard:game.ai.guard?.name??null,inspectionGuard:window.inspectionGuard??null,weapon:f.weapon.id,name:f.name,meshCount,vertices,visibleMeshes,transparentMeshes,geometryParts:f.meshes.length,characterModel:game.characterModel,bodyPosition:{...center}};
 },{id,label});
 const views=(process.env.CAPTURE_VIEWS||'front,threeq').split(',');if(process.env.CAPTURE_FRONT_ID===id&&!views.includes('front'))views.unshift('front');
 for(const kind of views){await page.evaluate(kind=>audit.render(kind),kind);await page.locator('#audit canvas').screenshot({path:`${out}/${id}-${kind}.png`});console.log('image',id,kind);}
 if(info.weapon!==CHARACTERS_BY_ID[id].weapon)throw new Error('Enemy weapon differs from selected registry');if(errors.length)throw new Error(JSON.stringify(errors));
 results.push({...info,errors,neutralRender:await page.evaluate(()=>window.nativeRender)});await fs.writeFile(`${out}/character-report.json`,JSON.stringify({method:'Native game Fighter visual meshes cloned after at least 1.2 seconds of native physics with ordinary registry-selected AI and gun pose, then paused through game UI. Fixed front/three-quarter full-body cameras for the new encounter portraits. Extra eyes view uses a closer real perspective camera centered on the native head; no geometry or image editing. Production AI and bodies are unchanged. No guard override is applied. The capture itself edits no source, physics/body position, or geometry. Scene lighting and camera standardized for design assessment; no claim of ordinary gameplay lighting or animation. Hands/outfit groups included as native children. UI replaced only in audit browser. Weapons can extend outside fixed body frame.',results},null,2));
 console.log('captured',id,info.meshCount,errors.length);await page.close();
}
}finally{await browser.close();}
