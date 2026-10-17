// Export platform sizes from the approved generated illustration; do not repaint.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/workspace/cloud-onboarding-tools/node_modules/playwright/index.mjs');
const source=process.env.ICON_MASTER||'public/encounters/app-icon-20261017/master.png';
const output=process.env.ICON_OUTPUT||'public/icons';
await mkdir(output,{recursive:true});
const bytes=await readFile(source),sha=b=>createHash('sha256').update(b).digest('hex');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage();
const sizes={'icon-512.png':512,'icon-maskable-512.png':512,'icon-192.png':192,'apple-touch-icon.png':180,'favicon-64.png':64,'favicon-32.png':32,'px32.png':32,'px32_mask.png':32};
const files=[];
try{for(const [file,size] of Object.entries(sizes)){
 const result=await page.evaluate(async({base64,size})=>{const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();if(img.naturalWidth!==img.naturalHeight)throw Error('Master must be square');const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(img,0,0,size,size);const d=x.getImageData(0,0,size,size).data;for(let i=3;i<d.length;i+=4)if(d[i]!==255)throw Error('Opaque app icon required');return {base64:c.toDataURL('image/png').split(',')[1],masterSize:img.naturalWidth};},{base64:bytes.toString('base64'),size});
 const b=Buffer.from(result.base64,'base64');await writeFile(output+'/'+file,b);files.push({file,size,bytes:b.length,sha256:sha(b),opaque:true,masterSize:result.masterSize});
}}finally{await browser.close();}
await mkdir('docs/art/app_icon_20261017',{recursive:true});await writeFile('docs/art/app_icon_20261017/exports.json',JSON.stringify({master:source,masterSha256:sha(bytes),method:'nearest-neighbor platform-size export from generated master; no repaint',files},null,2)+'\n');console.log(JSON.stringify(files));
