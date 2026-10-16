import {chromium} from 'playwright';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4194';
const out=process.argv[3]||'/tmp/night-delivery.json';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const report={pages:[]};
try{
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  const p=await b.newPage({viewport}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
  await p.goto(base+'/night-encounters.html',{waitUntil:'networkidle'});
  const result=await p.evaluate(async()=>{
   for(const img of document.images)img.loading='eager';
   const pictures=await Promise.all([...document.images].map(async img=>{await img.decode();return img.naturalWidth>0}));
   for(const v of document.querySelectorAll('video')){v.muted=true;await v.play();v.pause()}
   const links=[...document.querySelectorAll('.duel')].map(a=>{const u=new URL(a.href);return {stage:u.searchParams.get('stage'),foe:u.searchParams.get('foe'),weapon:u.searchParams.get('weapon')}});
   return {pictures:pictures.length,decoded:pictures.every(Boolean),videos:[...document.querySelectorAll('video')].map(v=>({ready:v.readyState,duration:v.duration})),overflow:document.documentElement.scrollWidth>innerWidth,links};
  });report.pages.push({viewport,...result,errors});await p.close();
 }
 const p=await b.newPage();await p.goto('http://127.0.0.1:4193/night-encounters.html');
 report.trails=await p.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js'),{attachMadEyes}=await import('/src/mad_eyes.js');
  const head=new T.Group(),scene=new T.Scene();scene.add(head);
  const f={groups:{head},scene,state:'fight'},fx=attachMadEyes(f,true);fx.update(0);head.position.x=.03;fx.update(.016);
  const trails=scene.children.filter(x=>x.isSprite&&x.visible);
  // Measure each trail against its own eye, not all trails against the left eye.
  const moving={count:trails.length,maxDistance:Math.max(...trails.map((x,i)=>x.position.distanceTo(head.children[i<6?0:2].getWorldPosition(new T.Vector3())))),maxOpacity:Math.max(...trails.map(x=>x.material.opacity))};
  fx.update(.032);const stopped=scene.children.filter(x=>x.isSprite&&x.visible).length;fx.dispose();
  return {moving,stopped,disposed:scene.children.length===1&&head.children.length===0};
 });
}finally{await b.close()}
report.pass=report.pages.every(p=>p.decoded&&!p.overflow&&!p.errors.length&&p.videos.every(v=>v.ready>=2&&v.duration===4)&&p.links.length===3&&p.links.every(l=>l.weapon==='longsword'))&&report.trails.moving.count===12&&report.trails.moving.maxDistance<=.22001&&report.trails.stopped===0&&report.trails.disposed;
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.pass)process.exitCode=1;
