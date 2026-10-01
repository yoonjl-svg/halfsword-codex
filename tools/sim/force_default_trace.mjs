import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {newRound,AI,DT,CONFIG}=await import(pathToFileURL(process.argv[2]).href);
class Passive{update(){}}
const rows=[];
for(const kind of ['ai_duel','hurt_getup']){
 const random=Math.random;
 const G=newRound({seed:17,walls:false,weapon:'longsword',weapon2:'zweihander',AIClass:kind==='ai_duel'?AI:Passive,AI2Class:kind==='ai_duel'?AI:null});
 const hash=createHash('sha256');let frames=0;
 try{
  if(kind==='hurt_getup')G.park();
  for(let i=0;i<Math.round(8/DT);i++){
   if(kind==='hurt_getup'&&i===Math.round(3/DT)){G.player.limbs.legF=.45;G.player.knockDown(false);}
   G.step();frames++;
   hash.update(JSON.stringify([G.player,G.enemy].map(f=>({state:f.state,health:f.blood,limbs:f.limbs,bodies:[...Object.values(f.bodies),f.sword].map(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel(),b.mass()])}))));
  }
  rows.push({kind,frames,sha256:hash.digest('hex'),playerState:G.player.state,enemyState:G.enemy.state,hits:G.hits.length,configuredReaction:CONFIG.GRIP.reactionModel??'absent (legacy)'});
 }finally{G.eventQueue.free();G.world.free();Math.random=random;}
}
await writeFile(process.argv[3],JSON.stringify({harness:process.argv[2],rows},null,2)+'\n');console.log(JSON.stringify(rows));
