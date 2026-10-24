import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {setup} from './harness.mjs';
import {guardEligible} from '../../src/dragon/rules.js';
const out=[];const check=(name,fn)=>{fn();out.push({name,pass:true});};
const rows=JSON.parse(readFileSync('docs/design/dragon_20261024/scenarios.json')),at=n=>rows.find(r=>r.name===n);
check('약한 물기: 무방비 피격 / 방어 무피해와 단일 비용12',()=>{assert.equal(at('nip').dragon.stats.hitsTaken,1);assert.equal(at('nip').dragon.stats.damageDealt,0);const r=at('nip_guard');assert.equal(r.dragon.stats.blocked,1);assert.equal(r.dragon.stats.hitsTaken,0);assert.equal(r.player.spent.block,12);});
check('앞발 견제: 무피해와 단일 비용12',()=>{const r=at('claw_guard');assert.equal(r.dragon.stats.blocked,1);assert.equal(r.dragon.stats.hitsTaken,0);assert.equal(r.player.spent.block,12);});
check('큰 물기: 방어 관통 / 옆 회피 성공',()=>{assert.equal(at('bite_guard').dragon.stats.hitsTaken,1);assert.equal(at('bite_guard').dragon.stats.blocked,0);assert.equal(at('bite_dodge').dragon.stats.hitsTaken,0);});
check('꼬리: 막기로 피해 차단 불가',()=>{assert.equal(at('tail_guard').dragon.stats.hitsTaken,1);assert.equal(at('tail_guard').dragon.stats.blocked,0);});
check('화염: 열린 사선 피격 / 실제 기둥 뒤 차단',()=>{assert.equal(at('fire_open').dragon.stats.hitsTaken,1);assert.equal(at('fire_covered').dragon.stats.hitsTaken,0);assert.equal(at('fire_covered').dragon.stats.coverStops,1);});
check('권총: 실제 사격/사선 연결로 용에게 피해',()=>assert(at('pistol_shots').dragon.stats.damageDealt>0));
const normal=setup({base:100,scale:1}),boss=setup();
check('일반100·특별300 독립 / 장비 덧값은3배로 늘리지 않음',()=>{assert.equal(normal.f.stamina.max,100);assert.equal(boss.f.stamina.max,300);boss.f.stamina.setMaxBonus(30);assert.equal(boss.f.stamina.max,330);boss.f.stamina.setMaxBonus(0);assert.equal(normal.f.stamina.max,100);});
for(const s of[normal,boss]){s.d.cool=100;s.advance(2.2);s.f.stamina.value=50;s.f.stamina.rest=0;s.advance(1);}
check('기력 회복 속도 그대로',()=>assert(Math.abs(normal.f.stamina.value-boss.f.stamina.value)<1e-6));
check('뒤쪽·권총·탈진은 방어 성공 처리 금지',()=>{const f=boss.f,p=f.bodies.pelvis.translation();assert.equal(guardEligible(f,{x:p.x-10,z:p.z},true),false);f.stamina.exhaustLeft=1;assert.equal(guardEligible(f,{x:p.x+10,z:p.z},true),false);assert.equal(f.stamina.speed,0);});
normal.dispose();boss.dispose();
writeFileSync('docs/design/dragon_20261024/contracts.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));
