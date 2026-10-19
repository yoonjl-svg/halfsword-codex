import {chromium} from '/workspace/cloud-onboarding-tools/node_modules/playwright/index.mjs';
import {writeFileSync} from 'node:fs';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});const p=await b.newPage({viewport:{width:844,height:390}});const errors=[];p.on('pageerror',e=>errors.push(String(e)));
try{
 await p.goto('http://127.0.0.1:4390/?mode=usefulNear');await p.locator('#start').click();await p.frameLocator('#game').locator('#btnStart').waitFor({timeout:60000});const f=p.frames().find(x=>x.url().includes('/game/index.html'));await f.waitForFunction(()=>window.rapierLabDebug&&game.player);
 await f.evaluate(()=>{const g=game.playerGuard,old=g.step.bind(g);g.step=dt=>{g.held=!!g.opposition.run||Math.floor(g.clock/dt)%30!==0;const f=game.player;f.move.set(0,f.foeDistance()>1.65?.4:0);f.stickY=f.move.y;old(dt);};});
 await f.locator('#btnStart').click();await f.waitForFunction(()=>rapierLab.starts>0||!game.player.alive||game.stats.simTime>28,null,{timeout:120000});
 const s=await f.evaluate(()=>({state:rapierLab,events:rapierLabDebug.events(),t:game.stats.simTime,alive:game.player.alive}));await p.screenshot({path:'/tmp/italian-four-20261020/browser/activation.png'});if(!s.state.starts||s.state.starts!==s.state.beats)throw Error('no real contact/beat mismatch');writeFileSync('/tmp/italian-four-20261020/browser/contact.json',JSON.stringify({s,errors},null,2));console.log('PASS real blade contact activation and single impulse',s.state.starts);
}finally{await b.close();}
