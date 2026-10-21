// Read-only snapshot of current definitions. No combat simulation or game mutation.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import * as THREE from 'three';
import {WEAPON_LIST, RETIRED_WEAPONS, getWeapon, weaponMatOpts} from '../../../src/weapons.js';
import {weaponPhysics} from '../../../src/weapon_class.js';
import {traditionOf} from '../../../src/schools.js';
import {MEASURED} from '../../../src/weapon_measured.js';
const look=new Proxy({}, {get:()=>0x888888});
function bounds(w) {
  let low=Infinity,high=-Infinity;
  const root=new THREE.Group(), finish=w.finishTier??w.tier;
  w.buildParts(look).forEach(([s,y,,color,isBlade,pose],i)=>{
    let geo,dy;
    if(s[0]==='box') {
      geo=new THREE.BoxGeometry(2*s[1],2*s[2],2*s[3]);
      const a=pose?.rotZ??0; dy=Math.abs(Math.sin(a))*s[1]+Math.abs(Math.cos(a))*s[2];
    } else if(s[0]==='ball') {geo=new THREE.SphereGeometry(s[1],16,12);dy=s[1];}
    else throw new Error('Unreviewed shape '+s[0]);
    low=Math.min(low,y-dy);high=Math.max(high,y+dy);
    const opts=weaponMatOpts(w.material,isBlade,finish);
    const m=w.partMesh?.(i,isBlade,s,color??0x888888,opts,look,finish)
      ??new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:color??0x888888,...opts}));
    m.position.set(pose?.x??0,y,0);m.rotation.z=pose?.rotZ??0;m.visible=color!=null;root.add(m);
  });
  w.decorate?.(root,look);root.updateMatrixWorld(true);
  const box=new THREE.Box3();
  const visit=o=>{if(!o.visible)return;if(o.isMesh){o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}o.children.forEach(visit);};
  visit(root);
  return {colliderLength:high-low,colliderMin:low,colliderMax:high,visualLength:box.max.y-box.min.y};
}
const weapons=WEAPON_LIST.map(w=>({id:w.id,name:w.nameKo,school:traditionOf(w),tier:w.tier,
  active:w.id!=='excalibur_replica'&&!RETIRED_WEAPONS.has(w.id)&&!w.characterOnly,
  blade:w.bladeLength,handToBlade:w.hiltLength,handToTip:w.hiltLength+w.bladeLength,
  handGap:w.twoHand?-w.gripAlong:null,twoHand:w.twoHand,...bounds(w),...weaponPhysics(w),
  balanceAheadBlade:weaponPhysics(w).com-w.hiltLength,mCut:w.mCut,mThrust:w.mThrust,mBlunt:w.mBlunt,
  power:w.power,fragility:w.fragility,ability:w.ability??null,storedTrajectoryEstimate:MEASURED[w.id]??null}));
const goujian=getWeapon('goujian');
const candidates=[.67,.62,.57].map(blade=>{
  const w={...goujian,bladeLength:blade};
  return {kind:'fixed-hilt-and-cross-section analytic example',fullLength:blade+.18,blade,...weaponPhysics(w)};
});
const p=weaponPhysics(goujian),s=.557/.85,mu=.875/p.mass;
candidates.push({kind:'uniform geometric scaling + independently matched reported total mass; NOT historical reconstruction',
  fullLength:.557,blade:.67*s,handToBlade:.09*s,mass:.875,com:p.com*s,I:p.I*mu*s*s,length:p.length*s});
const result={source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  definitions:'m, kg, kg*m^2; weaponPhysics.length = hand-to-tip, not whole length; stored trajectory estimates are not fresh contact measurements',
  weapons,goujianAnalyticExamples:candidates};
const out=new URL('./',import.meta.url);
fs.writeFileSync(new URL('snapshot.json',out),JSON.stringify(result,null,2)+'\n');
const keys=['id','name','school','tier','active','blade','colliderLength','visualLength','mass','handToBlade','handToTip','com','I','mCut','mThrust'];
fs.writeFileSync(new URL('weapons.csv',out),keys.join(',')+'\n'+weapons.map(w=>keys.map(k=>JSON.stringify(w[k])).join(',')).join('\n')+'\n');
console.log(JSON.stringify({source:result.source,registered:weapons.length,active:weapons.filter(w=>w.active).length,rows:weapons.map(w=>({id:w.id,bladeCm:w.blade*100,fullCm:w.colliderLength*100,visualCm:w.visualLength*100,kg:w.mass,I:w.I})),goujianAnalyticExamples:candidates},null,2));
