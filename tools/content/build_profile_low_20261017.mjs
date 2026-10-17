// User-specified workflow: preserve the framed master; derive low mechanically.
// No generation, repainting, palette change or source-file overwrite occurs here.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/workspace/cloud-onboarding-tools/node_modules/playwright/index.mjs');
const input=process.env.PROFILE_INPUT||'/workspace/portrait-originals-frame1-20261017';
const output=process.env.PROFILE_OUTPUT||'public/encounters/pixel-profiles-frame1-v1-20261017';
const roster=JSON.parse(await readFile('docs/art/pixel_profiles_20261017/canonical-roster.json','utf8'));
const ids=process.env.PROFILE_IDS?.split(',')||roster.map(r=>r.id);
const hash=b=>createHash('sha256').update(b).digest('hex');
async function preserve(file,data){
 try{const previous=await readFile(file);if(!previous.equals(data))throw Error(`Refusing to overwrite preserved asset: ${file}`);}
 catch(e){if(e.code!=='ENOENT')throw e;await writeFile(file,data);}
}
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage();await page.setContent('<!doctype html><title>Pixel conversion</title>');
const characters=[];
try{for(const id of ids){
 const row=roster.find(r=>r.id===id);if(!row)throw Error(`Unknown character ${id}`);
 const original=await readFile(path.join(input,`${id}.png`));
 const result=await page.evaluate(async({base64,block})=>{
  const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();
  const w=image.naturalWidth,h=image.naturalHeight;if(w!==h||w<1000)throw Error(`Expected high-resolution square, got ${w}x${h}`);
  const paddedW=Math.ceil(w/block)*block,paddedH=Math.ceil(h/block)*block;
  const canvas=(width,height)=>{const c=document.createElement('canvas');c.width=width;c.height=height;const x=c.getContext('2d',{willReadFrequently:true});x.imageSmoothingEnabled=false;return {c,x};};
  const padded=canvas(paddedW,paddedH);padded.x.drawImage(image,0,0);
  if(paddedW>w)padded.x.drawImage(image,w-1,0,1,h,w,0,paddedW-w,h);
  if(paddedH>h)padded.x.drawImage(image,0,h-1,w,1,0,h,w,paddedH-h);
  if(paddedW>w&&paddedH>h)padded.x.drawImage(image,w-1,h-1,1,1,w,h,paddedW-w,paddedH-h);
  const small=canvas(paddedW/block,paddedH/block);small.x.drawImage(padded.c,0,0,small.c.width,small.c.height);
  const low=canvas(w,h);low.x.drawImage(small.c,0,0,paddedW,paddedH);
  const data=low.x.getImageData(0,0,w,h).data;
  let blocks=0;
  for(let y=0;y<h;y+=block)for(let x=0;x<w;x+=block){
   const i=(y*w+x)*4;blocks++;
   for(let dy=0;dy<Math.min(block,h-y);dy++)for(let dx=0;dx<Math.min(block,w-x);dx++){
    const j=((y+dy)*w+x+dx)*4;
    for(let ch=0;ch<4;ch++)if(data[i+ch]!==data[j+ch])throw Error(`Nonuniform pixel block at ${x},${y}`);
   }
  }
  return {width:w,height:h,effectiveWidth:small.c.width,effectiveHeight:small.c.height,block,edgeWidth:w%block||block,edgeHeight:h%block||block,verifiedBlocks:blocks,png:low.c.toDataURL('image/png').split(',')[1]};
 },{base64:original.toString('base64'),block:4});
 const low=Buffer.from(result.png,'base64');delete result.png;
 const dir=path.join(output,id);await mkdir(dir,{recursive:true});
 await preserve(path.join(dir,'original.png'),original);await preserve(path.join(dir,'low.png'),low);
 if(hash(await readFile(path.join(input,`${id}.png`)))!==hash(original))throw Error(`Master changed during conversion: ${id}`);
 characters.push({id,name:row.name,epithet:row.epithet,lookVersion:row.lookVersion,frame:1,original:{file:`${id}/original.png`,sha256:hash(original),bytes:original.length},low:{file:`${id}/low.png`,sha256:hash(low),bytes:low.length,...result}});
 console.log(JSON.stringify({id,...result,originalPreserved:true,lowBytes:low.length}));
}}finally{await browser.close();}
const manifest={version:'frame1-v1-20261017',status:'generated-portrait-masters-with-deterministic-low',frame:1,lowMethod:'nearest-neighbor downsample to 4px blocks and upscale; partial blocks only at edges',originalsUnchanged:true,characters};
await preserve(path.join(output,'profiles.json'),Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
