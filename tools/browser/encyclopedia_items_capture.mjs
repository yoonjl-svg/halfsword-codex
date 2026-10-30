import { chromium } from 'playwright';
import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { WEAPON_LIST } from '../../src/weapons.js';
const base=process.argv[2]??'http://127.0.0.1:4194',out='public/ui/encyclopedia/items';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM??'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const files=[],errors=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(base+'/tools/browser/weapon_thumbs.html?size=1024&ids='+WEAPON_LIST.filter(w=>w.id!=='druid_whip').map(w=>w.id).join(','));
 await page.waitForFunction(()=>window.thumbs?.done,null,{timeout:180000});
 for(const {id,url} of await page.evaluate(()=>thumbs.list)){await writeFile(`${out}/${id}.webp`,Buffer.from(url.split(',')[1],'base64'));files.push({id,file:`${id}.webp`,width:1024,height:1024,method:'native weapon model, full-resolution render'});}
 await page.goto(base+'/tools/browser/item_thumbs.html?ids=tear&scale=4');await page.waitForFunction(()=>window.thumbs?.done,null,{timeout:90000});
 const tear=await page.evaluate(()=>thumbs.list[0]);await writeFile(`${out}/hero_tear.webp`,Buffer.from(tear.url.split(',')[1],'base64'));files.push({id:'hero_tear',file:'hero_tear.webp',width:1024,height:1024,method:'existing necklace model, full-resolution render'});
 await copyFile('art/druid-whip-thumb-20261024/original.png',`${out}/druid_whip.png`);files.push({id:'druid_whip',file:'druid_whip.png',width:1254,height:1254,method:'unchanged approved original'});
 if(errors.length)throw new Error(errors.join('\n'));
 for(const f of files){const bytes=await readFile(`${out}/${f.file}`);f.bytes=bytes.length;f.sha256=createHash('sha256').update(bytes).digest('hex');}
 await writeFile('docs/design/encyclopedia_20261031/v2/item-illustrations.json',JSON.stringify({files,errors,helmet:'captured separately with armor_thumb.mjs at 1024px'},null,2));console.log({items:files.length,errors});
}finally{await browser.close();}
