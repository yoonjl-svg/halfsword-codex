// node tools/sim/stamina_tempo_probe.mjs OUT [weapon,...|all] [cut,thrust,pommel,secret] [human,ai]
// Attacker blade collision disabled: onset -> peak speed at blade 70%; passive foe remains.
// Contact energy is measured in a separate trial with the attacker blade enabled.
// Identical initial pose/input/seed across 100,-10,-60; stamina is pinned only in this instrument.
import { newRound, DT, AI } from './harness_m.mjs';
import { WEAPON_LIST, RETIRED_WEAPONS } from '../../src/weapons.js';
import { TRADITIONS, SCHOOLS } from '../../src/schools.js';
import { STAMINA } from '../../src/config.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const TEMPO_WEAPONS = WEAPON_LIST.filter(w => !RETIRED_WEAPONS.has(w.id) && !w.gun).map(w => w.id);
const r6 = x => Number.isFinite(x) ? +x.toFixed(6) : null;
const length = v => Math.hypot(v.x,v.y,v.z);
function onPath(points, u) {
  const lens = points.slice(1).map((p,i) => Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
  let d = u * lens.reduce((a,b)=>a+b,0);
  for(let i=0;i<lens.length;i++) {
    if(d<=lens[i] || i===lens.length-1) { const k=Math.min(1,d/(lens[i]||1));return points[i].map((x,j)=>x+(points[i+1][j]-x)*k); }
    d-=lens[i];
  }
  return points.at(-1);
}

export function tempoTrial({weapon,action,driver,level,contact=false,seconds=8,trace=false}) {
  const g=newRound({weapon,weapon2:'longsword',seed:71,gap:action==='cut'&&!contact?8:1.5,...(driver==='ai'?{AI2Class:AI,persona2:{school:SCHOOLS[weapon]?weapon:'longsword',proficiency:action==='secret'?5:3}}:{})});
  try {
    const f=g.player,a=g.ai2,school=f.swordArt.school;
    const techs=school.tech ?? f.swordArt.tech;
    const preference={german:'zornhau',italian:'zornhau',iberian:'talhoReves',japanese:'zornhau',chinese:'yao'}[f.swordArt.tradition];
    const tech=school.techByName?.[preference] ?? techs?.find(t=>t.kind==='cut') ?? techs?.[0];
    if(!tech)throw Error(`No representative cut: ${weapon}`);
    const S=TRADITIONS[f.swordArt.tradition]?.secret;
    if(action==='secret'&&!S)return {weapon,action,driver,level,status:'not-applicable',reason:'This weapon has no school secret'};
    const aiUpdate=a?.update.bind(a);
    g.ai.update=()=>{};if(a)a.update=()=>{};
    // Retain collision and wound-energy reporting but let the passive target survive repeated contacts.
    if(contact)g.enemy.applyWound=()=>{};
    else for(let i=0;i<f.sword.numColliders();i++)f.sword.collider(i).setCollisionGroups(0);
    if(action==='cut'){f.handOffset.set(...tech.from);f.handHeld=true;f.inputActive=true;}
    for(let i=0;i<360;i++){f.move.set(0,0);g.step();}
    const initialSpeed=length(f.sword.velocityAtPoint(f.bladePoint(.7)));
    const pin=()=>{if(a)a.staminaRest=false;f.stamina.value=[100,-10,-60][level];f.stamina.level=level;f.stamina.exhaustLeft=0;};
    pin();
    let accepted=true;
    const context={line:'highC',high:true,slot:Object.keys(S?.do?.combo??{})[0],held:.4};
    if(action==='cut'&&a) {accepted=a.startAttack(tech,'tempo-probe',{noFeint:true,noPending:true});if(accepted)a.startStrike();}
    if(action==='thrust')accepted=f.skill.thrust({step:false,vital:null});
    if(action==='pommel')accepted=f.skill.pommel({step:false});
    if(action==='secret') {
      accepted=a?a.secretGo(S,{...context,th:context}):f.skill.secret({S,ctx:context,dir:[-1,0]});
      if(a&&accepted&&a.mode==='attack')a.startStrike();
    }
    pin(); // a charged action must not change the stage under comparison.
    if(!accepted)return {weapon,action,driver,level,status:'rejected',reason:'Real gameplay action entry rejected the trial'};
    const points=[tech.from,...tech.path];
    let peak=0,peakAt=0,endAt=null,finite=true,stopped=false,drivePeak=0,drivePeakAt=0;
    let prevPoint=f.bladePoint(.7).clone(),sampledPeak=0,sampledPeakAt=0;
    const samples=[],hits=[];
    g.onWound=(att,vic,r)=>{if(att===f&&vic===g.enemy)hits.push({time:r6(g.t-t0),zone:r.zone,type:r.type,energy:r6(r.energy)});};
    const t0=g.t;
    for(let i=0;i<Math.ceil(seconds/DT);i++) {
      const t=i*DT;pin();f.move.set(0,0);
      if(action==='cut'&&endAt===null) {
        if(a){a.handSpeed=a.level.strikeSpeed;a.moveHand(DT);}
        else {const u=Math.min(1,t/.18);f.handOffset.set(...onPath(points,u));f.inputActive=u<1;f.handHeld=true;}
      } else if(action==='secret'&&a&&a.secretRun)aiUpdate(DT);
      g.step();pin();
      const p=f.bladePoint(.7),v=f.sword.velocityAtPoint(p),speed=length(v),at=(i+1)*DT;
      if(![p.x,p.y,p.z,v.x,v.y,v.z,...Object.values(f.bodies.pelvis.translation())].every(Number.isFinite)) {finite=false;break;}
      const sampledSpeed=p.distanceTo(prevPoint)/DT;prevPoint.copy(p);
      if(sampledSpeed>sampledPeak){sampledPeak=sampledSpeed;sampledPeakAt=at;}
      if(speed>peak){peak=speed;peakAt=at;}
      const tp=f.skill.tap,pm=f.skill.pom;
      const inDrive=action==='thrust'?tp&&tp.t<tp.K.aim+tp.K.extend+tp.K.hold:action==='pommel'?pm&&f.skill.thrustPose.w>=.99:endAt===null;
      if(inDrive&&speed>drivePeak){drivePeak=speed;drivePeakAt=at;}
      if(trace)samples.push({t:r6(at),speed:r6(speed),sampledSpeed:r6(sampledSpeed),kinematic:f.sword.isKinematic(),hand:f.handOffset.toArray().map(r6),aim:f.skill.aim.toArray().map(r6),body:{...f.bodyPose},state:f.state});
      const done=action==='cut'?(a?!a.path.length:t>=.18&&f.skill.aim.distanceTo(f.skill.aimRaw)<.02)
        :action==='thrust'?!f.skill.tap:action==='pommel'?!f.skill.pom:!(a?a.secretRun:f.skill.sec)&&!f.iai&&!f.combo;
      if(done&&endAt===null)endAt=at;
      if(f.state!=='stand')stopped=true;
      // Capture physical follow-through after the completed command without another attack.
      if(endAt!==null&&at>=endAt+.3)break;
    }
    return {weapon,tradition:f.swordArt.tradition,action,tech:action==='secret'?S.name:tech.name,driver,level,value:[100,-10,-60][level],contact,
      status:'measured',peakAt:r6(peakAt),peakSpeed:r6(peak),initialSpeed:r6(initialSpeed),sampledPeak:r6(sampledPeak),sampledPeakAt:r6(sampledPeakAt),drivePeak:r6(drivePeak),drivePeakAt:r6(drivePeakAt),endAt:r6(endAt),completed:endAt!==null,finite,stopped,state:f.state,
      energyHits:hits,impactEnergy:hits.length?Math.max(...hits.map(h=>h.energy)):null,...(trace?{samples}:{})};
  } finally {g.world.free();}
}

const [outArg='/tmp/stamina-tempo',weaponsArg='all',actionsArg='cut,thrust,pommel,secret',driversArg='human,ai']=process.argv.slice(2);
const out=resolve(outArg);mkdirSync(out,{recursive:true});
const weapons=weaponsArg==='all'?TEMPO_WEAPONS:weaponsArg.split(','),rows=[];
for(const weapon of weapons) {
  if(!TEMPO_WEAPONS.includes(weapon))throw Error(`Unsupported weapon ${weapon}`);
  for(const action of actionsArg.split(','))for(const driver of driversArg.split(','))for(const level of [0,1,2]) {
    const row=tempoTrial({weapon,action,driver,level,trace:process.env.TEMPO_TRACE==='1'});
    if(row.status==='measured'&&process.env.TEMPO_CONTACT!=='0'){
      const hit=tempoTrial({weapon,action,driver,level,contact:true});
      row.energyHits=hit.energyHits??[];row.impactEnergy=hit.impactEnergy??null;row.contactStatus=hit.status;
    }
    rows.push(row);
  }
  writeFileSync(`${out}/rows.json`,JSON.stringify(rows,null,2)+'\n');
  console.error(`measured ${weapon} (${rows.length} rows)`);
}
for(const row of rows)if(row.status==='measured'){
  const base=rows.find(b=>b.weapon===row.weapon&&b.action===row.action&&b.driver===row.driver&&b.level===0);
  row.timeRatio=r6(row.peakAt/base.peakAt);row.speedRatio=r6(row.peakSpeed/base.peakSpeed);
  row.energyRatio=row.impactEnergy!=null&&base.impactEnergy>0?r6(row.impactEnergy/base.impactEnergy):null;
  row.target=[1,1/.7,2][row.level];row.relativeError=r6(Math.abs(row.timeRatio/row.target-1));
  row.pass=row.finite&&row.completed&&!row.stopped&&row.relativeError<=.07;
}
writeFileSync(`${out}/rows.json`,JSON.stringify(rows,null,2)+'\n');
const measured=rows.filter(r=>r.status==='measured'),fails=measured.filter(r=>!r.pass);
const summary={weapons:weapons.length,rows:rows.length,measured:measured.length,notApplicable:rows.filter(r=>r.status==='not-applicable').length,rejected:rows.filter(r=>r.status==='rejected').length,pass:measured.length-fails.length,fail:fails.length,nonfinite:measured.filter(r=>!r.finite).length,incomplete:measured.filter(r=>!r.completed).length};
writeFileSync(`${out}/summary.json`,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
const table=['| Weapon | Action | Driver | Stamina | Peak time | Time ratio | Speed ratio | Contact energy J | Energy ratio | Complete | Pass |','|---|---|---|---:|---:|---:|---:|---:|---:|---|---|'];
for(const r of rows)table.push(`| ${r.weapon} | ${r.action} | ${r.driver} | ${r.value??r.level} | ${r.peakAt??'—'} | ${r.timeRatio??'—'} | ${r.speedRatio??'—'} | ${r.impactEnergy??'no hit'} | ${r.energyRatio??'—'} | ${r.completed??r.status} | ${r.pass??r.status} |`);
writeFileSync(`${out}/table.md`,table.join('\n')+'\n');
if(process.env.TEMPO_ASSERT==='1'&&(fails.length||summary.rejected))process.exitCode=1;
