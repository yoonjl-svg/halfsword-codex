import{chromium}from'playwright';import{writeFileSync}from'node:fs';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const out=[];
for(const[version,port,ratio]of[['v1',5440,1],['fixed',5443,1],['fixed_sharp',5443,1.5]]){
 const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2});await page.goto(`http://localhost:${port}/dragon.html?debug=1&manual=1`);await page.waitForFunction(()=>window.__dragon);await page.locator('#start').click();
 const r=await page.evaluate(async ratio=>{const g=__dragon;g.dragon.cool=100;g.tick(240);g.renderer.setPixelRatio(ratio);g.renderer.setSize(innerWidth,innerHeight);for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);const t=[];let before=performance.now();for(let i=0;i<40;i++){const now=await new Promise(requestAnimationFrame);t.push(now-before);before=now;}t.sort((a,b)=>a-b);const start=performance.now();g.tick(240);return {medianRafMs:t[20],p90RafMs:t[36],physics240AndOneRenderMs:performance.now()-start,drawCalls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,geometries:g.renderer.info.memory.geometries,ratio:g.renderer.getPixelRatio()};},ratio);
 out.push({version,...r});console.log(out.at(-1));await page.close();
}
writeFileSync('docs/design/dragon_fixed_20261024/performance.json',JSON.stringify({environment:'Chromium SwiftShader, 844x390. Not phone FPS. Sequential matched DPR and sharper-quality runs.',samples:out},null,2));await browser.close();
