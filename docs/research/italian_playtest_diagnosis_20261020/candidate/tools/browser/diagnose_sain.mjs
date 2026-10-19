import {chromium} from '/workspace/cloud-onboarding-tools/node_modules/playwright/index.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='/tmp/italian-sain-diagnosis/corrected';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const rows=[];
try{for(const approach of [false,true]){
 const p=await browser.newPage({viewport:{width:844,height:390}});const errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.goto('http://127.0.0.1:4390/?mode=strongBind');await p.locator('#start').click();const f=p.frameLocator('#game');await f.locator('#btnStart').waitFor({timeout:60000});const fr=p.frames().find(x=>x.url().includes('/game/index.html'));await fr.waitForFunction(()=>window.rapierLabDebug?.mod&&game.player);
 await f.locator('#btnStart').click();await fr.waitForFunction(()=>game.state==='fight'&&rapierLabDebug?.mod===game.playerGuard.opposition);
 await fr.evaluate(approach=>{
  const g=game,guard=g.playerGuard,m=guard.opposition,p=g.player,a=g.enemy,cfg=g.config.SKILL.itOppositionVals;
  const d=window.diag={contacts:[],wounds:[],samples:[],eligible0:m.eligible(),cfg:{...cfg},loaded:{book:p.schoolParry,tradition:p.swordArt?.tradition,weapon:p.weapon.id,foe:a.weapon.id},guardSteps:0,activeSteps:0};
  const clash=m.onClash.bind(m);m.onClash=(att,h)=>{
   const v=new g.THREE.Vector3().copy(p.bodies.chest.translation()).sub(a.bladePoint(1,new g.THREE.Vector3())).dot(a.tipVel),age=guard.clock-m.pressed;
   const gates={wrong:att!==a,eligible:!m.eligible(),inactive:!guard.active,running:!!m.run,used:m.used,age:age<0||age>cfg.window,attack:!a.stamina.attackId||a.stamina.time>a.stamina.attackUntil,duplicate:m.usedAttacks.get(a)===a.stamina.attackId,injured:guard.clock-m.lastInjury<cfg.injuryGrace,slow:h.vn<cfg.minVn,far:p.foeDistance()>cfg.maxGap,away:v<=0};
   const row={t:guard.clock,gates,age,vn:h.vn,gap:p.foeDistance(),approach:v,guard:guard.line,active:guard.active,held:guard.held,broken:guard.broken,state:p.state,stamina:p.stamina.value,tap:!!p.skill.tap,sec:!!p.skill.sec,attackId:a.stamina.attackId,attackRemaining:a.stamina.attackUntil-a.stamina.time,starts:m.starts};clash(att,h);row.fired=m.starts>row.starts;d.contacts.push(row);
  };
  const wound=p.applyWound.bind(p);p.applyWound=h=>{d.wounds.push({t:guard.clock,part:h.part,severity:h.severity,type:h.type,line:guard.line,mode:guard.mode});return wound(h);};
  const step=guard.step.bind(guard);let last=-1;guard.step=dt=>{guard.held=true;if(approach){p.move.set(0,p.foeDistance()>1.6?.35:0);p.stickY=p.move.y;}step(dt);d.guardSteps++;if(guard.active)d.activeSteps++;if(guard.clock-last>.2){last=guard.clock;d.samples.push({t:guard.clock,state:p.state,gap:p.foeDistance(),stamina:p.stamina.value,line:guard.line,mode:guard.mode,cover:p.skill._cover?.w,pose:p.skill.thrustPose.w,starts:m.starts,ai:g.ai.mode,phase:g.ai.phase});}};
 },approach);
 await fr.waitForFunction(()=>game.stats.simTime>20||!game.player.alive||!game.enemy.alive,null,{timeout:150000});
 const row=await fr.evaluate(()=>({diag,events:rapierLabDebug.events(),state:rapierLab,t:game.stats.simTime,alive:game.player.alive,cause:game.player.causeOfDeath}));row.approach=approach;row.errors=errors;rows.push(row);writeFileSync(out+'/browser.json',JSON.stringify(rows,null,2));await p.screenshot({path:out+`/browser-${approach}.png`});console.log(JSON.stringify({approach,t:row.t,alive:row.alive,contacts:row.diag.contacts.length,starts:row.state.starts,rejections:row.diag.contacts.reduce((a,r)=>{for(const [k,v]of Object.entries(r.gates))if(v)a[k]=(a[k]||0)+1;return a;},{})}));await p.close();
}}finally{await browser.close();}
