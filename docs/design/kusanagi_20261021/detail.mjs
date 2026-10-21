import {chromium} from 'playwright';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:800,height:820},deviceScaleFactor:1});
await p.route('**/tools/browser/weapon_thumbs_page.js*',async route=>{
 const response=await route.fetch();const body=(await response.text()).replace(/(?:const|let) SIZE = 256/g,'const SIZE = 640');
 await route.fulfill({response,body});
});
await p.goto('http://127.0.0.1:4400/tools/browser/weapon_thumbs.html?ids=kusanagi');
await p.waitForFunction(()=>window.thumbs?.done);
console.log(await p.locator('img').evaluate(el=>({width:el.naturalWidth,height:el.naturalHeight})));
await p.addStyleTag({content:'body{background:#211f1b;color:#c7b99f}h1,p{display:none}figure{margin:0;padding:24px;background:#211f1b;border:0}figure img{width:640px;height:640px;background:transparent}figcaption{font:20px sans-serif;text-align:center}'});
await p.locator('figcaption').evaluate(el=>el.textContent='쿠사나기 · 실제 게임 무기 모델');
await p.locator('figure').screenshot({path:process.cwd()+'/docs/design/kusanagi_20261021/model-detail.png'});
await b.close();
