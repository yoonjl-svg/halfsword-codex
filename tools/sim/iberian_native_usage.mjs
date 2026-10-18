// Read-only replay counters: pose selection, applied pose, fresh blade contact.
// None of these alone proves a clean defensive success or an outward deflection.
import {duel,OUT} from './iberian_ai_league.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const baseline=JSON.parse(gunzipSync(readFileSync(`${OUT}/raw/native.json.gz`)));
const shard=+(process.env.SHARD??0),results=[],started=Date.now();
for(const [i,base] of baseline.entries()){
 if(i%2!==shard)continue;
 const usage={selected:[],applied:[],contacts:[],guardContacts:[]};let prevSelected=null,prevApplied=null;
 const selected=ai=>ai.mode==='defend'&&!ai.defVoid&&['highL','highR'].includes(ai.defLine)?ai.defLine:null;
 const applied=f=>{const c=f.skill._cover;return c?.own&&c.w>.15?(c.last?.name?.includes('탈류')?'highL':c.last?.name?.includes('레베스')?'highR':null):null;};
 const row=duel(base.case,'native',{
  onStart(G,D,A,ai){const hook=G.combat.hooks.onClash;G.combat.hooks.onClash=(point,speed,info)=>{
   hook?.(point,speed,info);if(!info.fresh)return;
   const line=applied(D);if(!line)return;
   const c={t:G.t,line,w:D.skill._cover.w,mode:ai.mode,defLine:ai.defLine,impulse:info.impulse};usage.contacts.push(c);
   if(selected(ai)===line)usage.guardContacts.push(c);
  };},
  onFrame(G,D,A,ai){const s=selected(ai),a=applied(D);if(s&&s!==prevSelected)usage.selected.push({t:G.t,line:s});if(a&&a!==prevApplied)usage.applied.push({t:G.t,line:a});prevSelected=s;prevApplied=a;}
 });
 for(const key of ['health','enemy','duration','result','breakTimes','modes','attacks','first','prefixHash'])assert.deepEqual(row[key],base[key],`Replay changed ${i} ${key}`);
 results.push({i,case:base.case,usage,replayExact:true,eligibleOutward:base.events.length});
 writeFileSync(`${OUT}/native-usage-${shard}.json.gz`,gzipSync(JSON.stringify(results)));
 console.log(JSON.stringify({i,selected:usage.selected.length,applied:usage.applied.length,contacts:usage.guardContacts.length,seconds:(Date.now()-started)/1000}));
}
