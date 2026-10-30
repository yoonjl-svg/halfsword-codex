// Reproduce the front-facing current-character contact sheet assets.
// CAPTURE_BASE=http://127.0.0.1:4320 node tools/browser/encyclopedia_models_capture.mjs
// Optional: CAPTURE_IDS=player,renji,ratna for a subset; the report records its scope.
// Alternate snapshot: SOURCE_ROOT=/tmp/source SOURCE_HEAD=<commit> CAPTURE_BASE=<snapshot Vite URL>
// CAPTURE_ASSET_DIR=<directory> and CAPTURE_OUT=<evidence directory> control outputs.
// This is an isolated production-Fighter inspection scene, not a gameplay screenshot.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../..',import.meta.url));
const sourceRoot=path.resolve(process.env.SOURCE_ROOT||root);
const {CHARACTERS_BY_ID}=await import(pathToFileURL(path.join(sourceRoot,'src/characters.js')).href);
const {CHARACTER_LOOK_VERSION}=await import(pathToFileURL(path.join(sourceRoot,'src/looks.js')).href);
const base=process.env.CAPTURE_BASE||'http://127.0.0.1:4193';
const out=process.env.CAPTURE_OUT||'/tmp/halfsword-character-roster-20261014/capture';
const assetDir=path.resolve(process.env.CAPTURE_ASSET_DIR||path.join(root,'public/character-roster'));
const allIds=['player',...Object.keys(CHARACTERS_BY_ID)];
const ids=process.env.CAPTURE_IDS?.split(',')||allIds;
for(const id of ids)if(!allIds.includes(id))throw new Error(`Unknown current character ${id}`);
await fs.mkdir(out,{recursive:true});
await fs.mkdir(assetDir,{recursive:true});
const sha256=data=>createHash('sha256').update(data).digest('hex');
async function sourceHashes(){
  const files=(await fs.readdir(path.join(sourceRoot,'src'),{recursive:true})).filter(f=>f.endsWith('.js')&&!f.startsWith('encyclopedia')&&!f.startsWith('lobby')).map(f=>`src/${f}`).sort();
  const hashes={};
  for(const name of files)hashes[name]=sha256(await fs.readFile(path.join(sourceRoot,name)));
  return hashes;
}
const before=await sourceHashes();
const handsHook=before['src/hands.js']?'attachHands':before['src/hand_visual.js']?'attachHandVisuals':null;
if(!handsHook)throw new Error('Selected source has no supported native hand appearance hook');
const report={
  createdAt:new Date().toISOString(),sourceRoot,sourceHead:process.env.SOURCE_HEAD||execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8'}).trim(),
  sourceBase:base,assetDir,
  method:'Selected source production Fighter constructor and registry looks in an isolated inspection scene. Fresh uninjured body parts remain at their constructor positions; both arm mesh groups are lowered by rigid transforms into the same slightly open resting pose. The source-native hand appearance hook/update supplies open hands using an unarmed inspection state; held weapons and their aura are omitted. No geometry, materials, body scale, costume children, game source, or physical body transforms are changed, and physics is not stepped. The production mad-eye effect is included for all registered madGlow variants at fixed time 1.2. Camera is exactly front (+X), orthographic, level, and shared across every subject. No character-specific reframing or height normalization. Original October 14 atlas studio lights, ACES filmic tone mapping at exposure 1, with a transparent background for the lobby palette (user rejected the original pale grey on October 31). This deliberately reproduces the approved atlas presentation; no stage-specific adaptive fill. These are design inspection renders, not gameplay pose or lighting claims.',
  handsHook,
  settings:{width:720,height:960,webpQuality:.85,frontAxis:'+X',cameraPosition:[6,.98,0],cameraTarget:[0,.98,0],orthographicHeight:2.08,orthographicWidth:1.56,background:'transparent',toneMapping:'ACESFilmicToneMapping',exposure:1,weaponsVisible:false,armAbductionDegrees:8},
  expectedIds:allIds,capturedIds:ids,sourceHashes:before,results:[],errors:[],
};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-networking']});
try{
  const page=await browser.newPage({viewport:{width:720,height:960},deviceScaleFactor:1});
  page.on('pageerror',e=>report.errors.push(String(e)));
  await page.route('**/__character_roster_capture__',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><title>Native character inspection</title><style>html,body{margin:0;width:720px;height:960px;overflow:hidden}canvas{display:block}</style></head><body></body></html>'}));
  await page.goto(`${base}/__character_roster_capture__`,{waitUntil:'domcontentloaded'});
  // Refuse a stale/wrong Vite server before generating assets from another checkout.
  const servedHashes=await page.evaluate(async files=>{
    const rows=await Promise.all(files.map(async name=>{
      const {default:raw}=await import(`/${name}?raw`);
      const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
      return [name,[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')];
    }));
    return Object.fromEntries(rows);
  },Object.keys(before));
  const mismatches=Object.keys(before).filter(name=>before[name]!==servedHashes[name]);
  if(mismatches.length)throw new Error(`Vite source does not match SOURCE_ROOT: ${mismatches.join(', ')}`);
  report.servedSourceMatches=true;
  await page.evaluate(async handsHook=>{
    // Use the dependency URLs selected by this Vite server, including custom cacheDir.
    const [fighterModule,mainModule]=await Promise.all(['/src/fighter.js','/src/main.js'].map(url=>fetch(url).then(r=>r.text())));
    const threeUrl=fighterModule.match(/\bfrom\s+(['"])([^'"]*\/three\.js(?:\?[^'"]*)?)\1/)?.[2];
    const rapierUrl=mainModule.match(/\bfrom\s+(['"])([^'"]*\/@dimforge_rapier3d-compat\.js(?:\?[^'"]*)?)\1/)?.[2];
    if(!threeUrl||!rapierUrl)throw new Error('Cannot resolve Vite Three/Rapier imports for selected source');
    const [THREE,{default:RAPIER},{Fighter},{CHARACTERS_BY_ID},{LOOKS},{attachMadEyes},handsModule]=await Promise.all([
      import(threeUrl),import(rapierUrl),
      import('/src/fighter.js'),import('/src/characters.js'),import('/src/looks.js'),import('/src/mad_eyes.js'),import(handsHook==='attachHands'?'/src/hands.js':'/src/hand_visual.js'),
    ]);
    const attachHands=handsModule[handsHook];
    if(typeof attachHands!=='function')throw new Error(`Missing native ${handsHook} export`);
    await RAPIER.init();
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
    renderer.setPixelRatio(1);renderer.setSize(720,960);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.setClearColor(0,0);
    document.body.append(renderer.domElement);
    const camera=new THREE.OrthographicCamera(-.78,.78,1.04,-1.04,.01,50);
    camera.position.set(6,.98,0);camera.lookAt(0,.98,0);camera.updateMatrixWorld();
    const scene=new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xeaf1ff,0x62604e,2.0));
    const key=new THREE.DirectionalLight(0xffedd2,3);key.position.set(4,5,-3);scene.add(key);
    const fill=new THREE.DirectionalLight(0xd4e4ff,1.2);fill.position.set(4,2.5,3);scene.add(fill);
    const stageChildren=new Set(scene.children);
    window.rosterCapture={THREE,RAPIER,Fighter,CHARACTERS_BY_ID,LOOKS,attachMadEyes,attachHands,renderer,camera,scene,stageChildren};
  },handsHook);
  for(const id of ids){
    const info=await page.evaluate(id=>{
      const a=window.rosterCapture,{THREE,RAPIER,Fighter,CHARACTERS_BY_ID,LOOKS,attachMadEyes,attachHands,renderer,camera,scene,stageChildren}=a;
      a.fx?.dispose();a.hands?.dispose();a.world?.free();
      for(const child of [...scene.children])if(!stageChildren.has(child))scene.remove(child);
      const world=a.world=new RAPIER.World({x:0,y:-9.81,z:0});
      const character=CHARACTERS_BY_ID[id];
      const f=new Fighter(RAPIER,world,scene,new Map(),{index:id==='player'?0:1,x:0,heading:0,name:character?.name||'나',look:character?.look||LOOKS.player,weapon:character?.weapon||'longsword',revive:character?.revive,breakSeed:1,physiology:character?.physiology});
      f.syncMeshes();f.swordGroup.visible=false;
      f.armed=false;f.gripping=false;
      a.hands=attachHands(f,character?.look||LOOKS.player);a.hands?.update();
      if(!a.hands)throw new Error(`${id}: native hands did not attach`);
      // Fixed anatomical shoulder and arm lengths from the production constructor.
      // Main-arm dress groups start along +X; -pi/2 restores their downward axis.
      for(const [suffix,side] of [['S',1],['O',-1]]){
        const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-side*8*Math.PI/180);
        for(const [part,distance] of [['uarm',.15],['farm',.44]]){
          const g=f.groups[part+suffix];
          g.position.copy(new THREE.Vector3(0,-distance,0).applyQuaternion(rotation).add(new THREE.Vector3(0,1.43,side*.2)));
          g.quaternion.copy(rotation);
          if(suffix==='S')g.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-Math.PI/2));
        }
      }
      a.fx=attachMadEyes(f,character?.eyes==='madGlow');
      scene.updateMatrixWorld(true);a.fx?.update(1.2);scene.updateMatrixWorld(true);
      let meshCount=0,vertices=0;
      const bounds=new THREE.Box3();
      for(const {group,kind} of f.meshes)if(kind!=='weapon')group.traverseVisible(o=>{
        if(!o.isMesh)return;
        meshCount++;vertices+=o.geometry.attributes.position.count;
        if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
        bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
      });
      let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
      for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
        const v=new THREE.Vector3(x,y,z).project(camera),px=(v.x+1)*360,py=(1-v.y)*480;
        xmin=Math.min(xmin,px);xmax=Math.max(xmax,px);ymin=Math.min(ymin,py);ymax=Math.max(ymax,py);
      }
      if(xmin<8||xmax>712||ymin<8||ymax>952)throw new Error(`${id}: body clipped: ${JSON.stringify({xmin,xmax,ymin,ymax})}`);
      renderer.render(scene,camera);
      a.current=f;
      return {id,name:f.name,lookVersion:character?.lookVersion||'v0',eyes:character?.eyes||null,weaponOmitted:f.weapon.id,handsAttached:true,handsState:'native open hands (unarmed inspection pose)',meshCount,vertices,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},frameBounds:{left:xmin,right:xmax,top:ymin,bottom:ymax},feetBottomPixels:960-ymax,renderer:{...renderer.info.render},errors:[]};
    },id);
    await page.locator('canvas').screenshot({path:path.join(out,`${id}.png`)});
    const data=await page.evaluate(()=>rosterCapture.renderer.domElement.toDataURL('image/webp',.85).split(',')[1]);
    const bytes=Buffer.from(data,'base64');
    await fs.writeFile(path.join(assetDir,`${id}.webp`),bytes);
    report.results.push({...info,image:`ui/encyclopedia/characters/${id}.webp`,width:720,height:960,bytes:bytes.length,sha256:sha256(bytes),registryLookVersion:CHARACTER_LOOK_VERSION[id]||CHARACTERS_BY_ID[id]?.lookVersion||'v0'});
    console.log(`captured ${id}: ${bytes.length} bytes, bounds ${JSON.stringify(info.frameBounds)}`);
  }
  await page.setViewportSize({width:1440,height:1100});
  await page.route('**/__roster_asset__/*',async route=>{
    const name=new URL(route.request().url()).pathname.split('/').at(-1);
    if(!report.results.some(r=>`${r.id}.webp`===name))return route.abort();
    return route.fulfill({contentType:'image/webp',body:await fs.readFile(path.join(assetDir,name))});
  });
  await page.setContent(`<style>html,body{margin:0;background:#30291e;color:#f3e9d8;font:14px sans-serif}main{display:grid;grid-template-columns:repeat(6,240px)}figure{margin:0;border:1px solid #aaa;box-sizing:border-box}img{display:block;width:238px;height:auto}figcaption{height:34px;padding:4px 7px;box-sizing:border-box}</style><main>${report.results.map(r=>`<figure><img src="${base}/__roster_asset__/${r.id}.webp"><figcaption>${r.id} · ${r.lookVersion}</figcaption></figure>`).join('')}</main>`);
  await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth===720));
  await page.locator('main').screenshot({path:path.join(out,'contact-sheet.png')});
  report.sourceStable=JSON.stringify(before)===JSON.stringify(await sourceHashes());
  if(!report.sourceStable)throw new Error('Source changed during capture');
  if(report.errors.length)throw new Error(JSON.stringify(report.errors));
  report.complete=ids.length===allIds.length&&allIds.every(id=>ids.includes(id));
}finally{
  await browser.close();
  await fs.writeFile(path.join(out,'character-report.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(`Captured ${report.results.length}/${allIds.length}; report ${out}/character-report.json`);
