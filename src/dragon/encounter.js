import * as T from 'three';
import { DRAGON, ATTACKS, clamp, smooth, angleDelta, closestOnSegment, guardEligible } from './rules.js';
import { createDragonModel } from './model.js';
import { GROUND_GROUPS } from '../fighter.js';

const UP=new T.Vector3(0,1,0), TMP=new T.Vector3(), DIR=new T.Vector3(), A=new T.Vector3(), B=new T.Vector3();
const zonesKo={head:'머리',snout:'주둥이',throat:'목 아래',legL:'앞다리',legR:'앞다리',chest:'비늘',body:'비늘',tail:'꼬리'};
export class DragonEncounter {
  constructor(scene,R,world,player,guard,covers,onEvent=()=>{}) {
    Object.assign(this,{scene,R,world,player,guard,covers,onEvent});
    this.position=new T.Vector3(2.3,0,0);this.heading=Math.PI;this.time=0;this.health=DRAGON.health;
    this.phase='idle';this.phaseTime=0;this.phaseU=0;this.attack=null;this.side=1;this.cool=2.5;this.deadTime=0;
    this.attackId=0;this.hitIds=new Set();this.fireHitAt=-100;this.contactAt=-100;this.contactOpen=true;this.quiet=0;
    this.legDamage=0;this.staggerLock=0;this.seed=641;this.lastAttack=null;this.fireSince=0;
    this.stats={attacks:{},hitsTaken:0,blocked:0,missed:0,playerHits:0,damageDealt:0,damageTaken:0,coverStops:0,staggers:0,partHits:{}};
    this.model=createDragonModel(scene);this.model.update(this,0);
    this.previousBlade=null;this.prevMouth=this.model.pose.mouth.clone();this.prevClaw=this.model.pose.claw.clone();this.prevTail=this.model.pose.tail.clone();
    this.zoneByHandle=new Map();
    for(const z of this.model.zones) {
      z.body=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(z.p.x,z.p.y,z.p.z));
      z.collider=world.createCollider(R.ColliderDesc.ball(z.r).setSensor(true).setCollisionGroups(GROUND_GROUPS),z.body);
      this.zoneByHandle.set(z.collider.handle,z);
    }
    this.body=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(this.position.x,1.5,this.position.z));
    world.createCollider(R.ColliderDesc.cuboid(1.1,.5,.63).setFriction(.2).setCollisionGroups(GROUND_GROUPS),this.body);
    const target=this.model.zones.find(z=>z.id==='head').body;
    const me=this;
    this.proxy={name:DRAGON.name,index:1,get alive(){return me.alive;},state:'stand',armed:false,decapitated:false,revival:false,
      get pelvisPos(){return me.model.pose.head;},get com(){return me.model.pose.head;},bodies:{pelvis:target,chest:target,abdomen:target,head:target},
      skill:{swinging:false,tap:null,handSpeed:0,aim:{x:0,y:0}},weaponCfg:{bladeLength:0,hiltLength:0},weapon:{id:'dragon',mass:500},
      stamina:{exhausted:false,value:300,max:300},feel:{touching:false,force:0},look:{},vitality:1,limbs:{armS:1,armO:1,legF:1,legB:1},
      bladePoint:(_t,out=new T.Vector3())=>out.copy(me.model.pose.mouth),forward:(out=new T.Vector3())=>out.set(Math.cos(me.heading),0,Math.sin(me.heading)),
      wearsPlate:()=>false,armorAt:()=>false,headArmor:()=>null};
    player.foe=this.proxy;
    this.fireMesh=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshBasicMaterial({color:0xe6a45e,transparent:true,opacity:.52,depthWrite:false}),28);this.fireMesh.visible=false;scene.add(this.fireMesh);
    this.fireLight=new T.PointLight(0xff9c44,0,9,2);scene.add(this.fireLight);this.fireTip=new T.Vector3();this.fireDir=new T.Vector3();this.fireLength=8;
    this.effect=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshBasicMaterial({color:0xe4c595,transparent:true,opacity:.8,depthWrite:false}),30);this.effect.count=0;scene.add(this.effect);this.sparks=[];this.dummy=new T.Object3D();
  }
  get alive(){return this.health>0;}
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  emit(type,extra={}){this.onEvent({type,time:this.time,attack:this.attack,...extra});}
  begin(id) {
    this.attack=id;this.lastAttack=id;this.phase='tell';this.phaseTime=0;this.phaseU=0;this.attackId++;this.hitIds.clear();this.fireHitAt=-100;
    this.stats.attacks[id]=(this.stats.attacks[id]||0)+1;this.side=this.random()<.5?-1:1;this.guard.line=id==='claw'?(this.side>0?'highL':'highR'):'highC';
    this.emit('tell',{blockable:ATTACKS[id].blockable,name:ATTACKS[id].name});
  }
  beforeStep(dt) {
    this.time+=dt;this.staggerLock=Math.max(0,this.staggerLock-dt);this.fireSince+=dt;
    this.prevMouth.copy(this.model.pose.mouth);this.prevClaw.copy(this.model.pose.claw);this.prevTail.copy(this.model.pose.tail);
    this.walking=false;
    const pp=this.player.bodies.pelvis.translation(),dx=pp.x-this.position.x,dz=pp.z-this.position.z,d=Math.hypot(dx,dz),toward=Math.atan2(dz,dx);
    if(!this.alive){this.deadTime+=dt;this.phase='dead';this.phaseU=1;}
    else if(this.player.alive) {
      this.phaseTime+=dt;
      if(this.phase==='idle') {
        this.cool-=dt;
        const da=angleDelta(this.heading,toward),behind=Math.abs(da)>2.1;
        if(behind&&d<5&&this.cool<=0){this.begin('tail');}
        else {
          this.heading+=clamp(da,-DRAGON.turnSpeed*dt,DRAGON.turnSpeed*dt);
          if(d>3.7) {
            let vx=Math.cos(this.heading),vz=Math.sin(this.heading);
            for(const c of this.covers){const cx=this.position.x-c.x,cz=this.position.z-c.z,cd=Math.hypot(cx,cz);if(cd<c.r+2.4){vx+=cx/Math.max(.1,cd)*1.4;vz+=cz/Math.max(.1,cd)*1.4;}}
            const n=Math.hypot(vx,vz);this.position.x+=vx/n*DRAGON.walkSpeed*dt;this.position.z+=vz/n*DRAGON.walkSpeed*dt;this.walking=true;
          }
          if(this.cool<=0&&Math.abs(da)<.65) {
            let id;
            if(d>5.2||this.fireSince>14){id='fire';this.fireSince=0;}
            else if(d<3.1&&this.lastAttack!=='claw')id='claw';
            else id=this.lastAttack==='nip'||this.random()<.36?'bite':'nip';
            this.begin(id);
          }
        }
      } else if(this.phase==='stagger') {
        this.phaseU=clamp(this.phaseTime/DRAGON.staggerTime);
        if(this.phaseTime>=DRAGON.staggerTime){this.phase='idle';this.phaseTime=0;this.cool=.9;this.attack=null;}
      } else {
        const a=ATTACKS[this.attack],duration=this.phase==='tell'?a.tell:this.phase==='active'?a.active:a.recover;
        this.phaseU=clamp(this.phaseTime/duration);
        // 준비 앞부분만 추적한다. 강한 물기는 일찍 방향을 고정해 회피할 공간을 준다.
        if(this.phase==='tell'&&this.attack!=='tail'&&this.phaseU<(this.attack==='bite'?.25:.55))this.heading+=clamp(angleDelta(this.heading,toward),-.45*dt,.45*dt);
        if(this.phaseTime>=duration) {
          this.phaseTime-=duration;this.phaseU=0;
          if(this.phase==='tell'){this.phase='active';this.emit('attack');}
          else if(this.phase==='active'){this.phase='recover';if(!this.hitIds.size&&this.attack!=='fire')this.stats.missed++;this.emit('opening');}
          else {this.phase='idle';this.cool=.65+this.random()*.45;this.attack=null;}
        }
      }
      const pr=Math.hypot(this.position.x,this.position.z);if(pr>9.1)this.position.multiplyScalar(9.1/pr);
    }
    this.model.update(this,dt);
    for(const z of this.model.zones)z.body.setNextKinematicTranslation(z.p);
    this.body.setNextKinematicTranslation({x:this.position.x,y:this.alive?1.5:.6,z:this.position.z});
    this.body.setNextKinematicRotation(new T.Quaternion().setFromAxisAngle(UP,-this.heading));
    this.updateFire();
  }
  afterStep(dt) {
    if(this.alive&&this.player.alive) {
      this.weaponContacts(dt);
      if(this.phase==='active')this.attackPlayer();
    }
    this.updateParticles(dt);
  }
  weaponContacts(dt) {
    const f=this.player;if(!f.armed||f.weapon?.gun)return;
    if(this.pendingHit&&this.time>=this.pendingHit.until){const h=this.pendingHit;this.pendingHit=null;this.contactAt=this.time;this.takeHit(h.z,h.damage,h.point,h.type,{speed:h.speed,energy:h.energy});}
    const intent=!!(f.skill.tap||f.skill.swinging||f.skill.flick||f.skill.pom||f.stamina.attacking)&&!(this.guard.held&&!this.guard.broken);
    const segments=[];
    if(f.flexWeapon) {
      // 물리 채찍 마디 전부 검사하되 한 타격의 피해는 한 번만 낸다.
      for(const [handle,info] of f.colliderInfo)if(info.fighter===f&&info.kind==='weapon'&&info.flexible){const col=this.world.getCollider(handle);if(col){const p=col.translation(),q=col.rotation(),h=col.halfExtents().y;const axis=new T.Vector3(0,h,0).applyQuaternion(q);const center=new T.Vector3(p.x,p.y,p.z);segments.push([center.clone().sub(axis),center.clone().add(axis),info.body,info.props.m]);}}
    }
    if(!segments.length)segments.push([f.bladePoint(.12),f.bladePoint(1)]);
    let best=null;
    for(let j=0;j<segments.length;j++) {
      const [a,b]=segments[j],prev=this.previousBlade?.[j];
      for(const z of this.model.zones) {
        closestOnSegment(z.p,a,b,TMP);
        let point=TMP.clone(),distance=point.distanceTo(z.p);
        if(prev)for(let k=0;k<=3;k++){
          A.copy(prev[0]).lerp(prev[1],k/3);B.copy(a).lerp(b,k/3);closestOnSegment(z.p,A,B,TMP);
          if(TMP.distanceTo(z.p)<distance){distance=TMP.distanceTo(z.p);point.copy(TMP);}
        }
        if(distance>z.r+.035)continue;
        const sw=segments[j][2]||f.sword,sp=sw.translation(),lv=sw.linvel(),av=sw.angvel();
        DIR.set(point.x-sp.x,point.y-sp.y,point.z-sp.z).crossVectors(new T.Vector3(av.x,av.y,av.z),DIR).add(new T.Vector3(lv.x,lv.y,lv.z)).sub(z.velocity);
        const speed=DIR.length();if(speed<1||speed>60)continue;
        const q=sw.rotation(),axis=new T.Vector3(0,1,0).applyQuaternion(q),edge=new T.Vector3(1,0,0).applyQuaternion(q);
        const along=Math.abs(DIR.dot(axis))/speed,across=Math.abs(DIR.dot(edge))/speed;
        const type=!f.weaponCfg.edged||f.weaponBroken?'blunt':along>.65?'stab':'cut';
        const alignment=type==='cut'?.35+.65*across:1;
        const mass=segments[j][3]??f.swordMass;
        const energy=.5*Math.min(2.4,mass*.65+.25)*speed*speed;
        const blunt=f.weapon?.mBlunt??1;
        const damage=clamp(Math.sqrt(energy)*2.7*alignment*z.damage*(type==='blunt'?Math.sqrt(blunt):1),1,52);
        if(!best||damage>best.damage)best={z,damage,point,speed,type,energy};
      }
    }
    this.previousBlade=segments.map(([a,b])=>[a.clone(),b.clone()]);
    if(!best||!intent){this.quiet+=dt;return;}
    if(this.pendingHit){if(best.damage>this.pendingHit.damage)Object.assign(this.pendingHit,best);return;}
    if(this.time-this.contactAt<DRAGON.meleeCooldown)return;
    // 연속 접촉은 같은 타격으로 묶고, 다시 떨어져 휘둘렀을 때 재청구한다.
    if(this.quiet<.08&&this.time-this.contactAt<.65)return;
    this.quiet=0;this.pendingHit={...best,until:this.time+.10};
  }
  takeHit(z,damage,point,type,extra={}) {
    if(!this.alive)return;
    const applied=Math.min(this.health,damage);this.health=Math.max(0,this.health-damage);
    this.stats.playerHits++;this.stats.damageDealt+=applied;this.stats.partHits[z.id]=(this.stats.partHits[z.id]||0)+1;
    this.spark(point,type==='gun'?0xe9cb81:0xa76a4b);this.emit('hit',{zone:zonesKo[z.id],damage:applied,point:point.clone(),typeHit:type,...extra});
    if(z.id.startsWith('leg'))this.legDamage+=applied;
    if(this.alive&&this.legDamage>=DRAGON.staggerDamage&&this.staggerLock<=0) {
      this.phase='stagger';this.phaseTime=0;this.phaseU=0;this.legDamage=0;this.staggerLock=12;this.stats.staggers++;this.emit('stagger');
    }
    if(!this.alive){this.phase='dead';this.emit('victory');}
  }
  bulletImpact(point) {
    let best=null;
    for(const z of this.model.zones)if(point.distanceTo(z.p)<=z.r+.06&&(!best||z.damage>best.damage))best=z;
    if(best)this.takeHit(best,38*best.damage,point,'gun');
  }
  attackPlayer() {
    if(this.attack==='fire')return this.firePlayer();
    if(this.hitIds.has(this.attackId))return;
    const current=this.attack==='tail'?this.model.pose.tail:this.attack==='claw'?this.model.pose.claw:this.model.pose.mouth;
    const previous=this.attack==='tail'?this.prevTail:this.attack==='claw'?this.prevClaw:this.prevMouth;
    const radius=this.attack==='tail'?.48:this.attack==='claw'?.48:.51;
    for(const part of (this.attack==='tail'?['thighF','thighB','shinF','shinB','pelvis']:['chest','abdomen','pelvis','head'])) {
      const p=this.player.bodies[part].translation();closestOnSegment(p,previous,current,TMP);
      if(TMP.distanceTo(p)<radius+.23) {
        this.hitIds.add(this.attackId);
        const a=ATTACKS[this.attack];
        if(a.blockable&&guardEligible(this.player,this.position,this.guard.held,this.guard.broken)) {
          this.player.stamina.spend('block',DRAGON.guardCost);this.player.stamina.counts.block++;this.stats.blocked++;
          this.spark(TMP,0xe3d5a4);this.pushPlayer(2.2);this.emit('block',{point:TMP.clone()});
        } else this.hurtPlayer(a,TMP,part);
        return;
      }
    }
  }
  hurtPlayer(a,point,part='chest') {
    const f=this.player,p=f.bodies[part].translation();
    const dir=new T.Vector3(p.x-this.position.x,.12,p.z-this.position.z).normalize();
    // 용의 이빨/발톱도 사람의 상처·출혈·균형 시스템으로 전달한다. 별도 플레이어 HP는 만들지 않는다.
    const body=f.bodies[part],local=point.clone().sub(new T.Vector3(p.x,p.y,p.z)).applyQuaternion(new T.Quaternion().copy(body.rotation()).invert());
    const zone=part==='head'?'head':part==='pelvis'?'pelvis':/thigh|shin/.test(part)?'leg':'chest';
    f.applyWound({part,zone,type:this.attack==='tail'?'blunt':'cut',severity:a.severity,energy:a.energy,local,dir,point,
      pass:true,passing:false,bleedPerSev:a.blockable?.026:.04,helmet:part==='head'&&!!f.helmetGroup,helmetBlunt:.65,plate:false,plateBlunt:1});
    if(this.attack==='tail')f.consciousness=Math.max(0,f.consciousness-.19);
    this.stats.hitsTaken++;this.stats.damageTaken+=a.severity;this.pushPlayer(a.blockable?4:10);this.spark(point,0x9e4d38);this.emit('hurt',{point:point.clone(),blockable:a.blockable});
  }
  pushPlayer(strength) {
    const p=this.player.bodies.pelvis.translation();DIR.set(p.x-this.position.x,0,p.z-this.position.z).normalize().multiplyScalar(strength);
    this.player.bodies.pelvis.applyImpulse(DIR,true);
  }
  updateFire() {
    const live=this.alive&&this.attack==='fire'&&this.phase==='active';this.fireMesh.visible=live;
    this.fireLight.intensity=live?9:this.attack==='fire'&&this.phase==='tell'?this.phaseU*2:0;
    this.fireLight.position.copy(this.model.pose.mouth);
    if(!live)return;
    const a=this.heading+(this.phaseU-.5)*1.15;this.fireDir.set(Math.cos(a),-.035,Math.sin(a)).normalize();this.fireTip.copy(this.model.pose.mouth);
    // 분사 중심선은 첫 지형에서 멈춘다. 피해는 사람까지 별도 사선 검사한다.
    const hit=this.world.castRay({origin:this.fireTip,dir:this.fireDir},8,true,undefined,undefined,undefined,undefined,c=>this.covers.some(o=>o.collider.handle===c.handle));
    this.fireLength=hit?hit.timeOfImpact:8;
    for(let i=0;i<28;i++) {
      const u=((i/28+this.time*1.8)%1),dist=.15+u*this.fireLength;
      this.dummy.position.copy(this.fireTip).addScaledVector(this.fireDir,dist);
      this.dummy.position.y+=Math.sin(this.time*17+i*2)*u*.21;
      this.dummy.position.z+=Math.sin(this.time*12+i)*u*.22;
      this.dummy.scale.setScalar(.13+u*.38);this.dummy.rotation.set(i*.2,this.time*4+i,0);this.dummy.updateMatrix();this.fireMesh.setMatrixAt(i,this.dummy.matrix);
      this.fireMesh.setColorAt(i,new T.Color().setHSL(.07+u*.04,.75,.52+(1-u)*.27));
    }
    this.fireMesh.instanceMatrix.needsUpdate=true;if(this.fireMesh.instanceColor)this.fireMesh.instanceColor.needsUpdate=true;
  }
  firePlayer() {
    if(this.time-this.fireHitAt<.55)return;
    const p=this.player.bodies.chest.translation();DIR.set(p.x,p.y,p.z).sub(this.fireTip);
    const distance=DIR.length(),along=DIR.dot(this.fireDir);
    if(along<0||distance>8||Math.sqrt(Math.max(0,distance*distance-along*along))>.32+along*.12)return;
    const dir=DIR.clone().normalize();
    const wall=this.world.castRay({origin:this.fireTip,dir},distance,true,undefined,undefined,undefined,undefined,c=>this.covers.some(o=>o.collider.handle===c.handle));
    this.fireHitAt=this.time;
    if(wall){this.stats.coverStops++;this.emit('cover');return;}
    this.hurtPlayer(ATTACKS.fire,new T.Vector3(p.x,p.y,p.z));
  }
  spark(p,color) {
    for(let i=0;i<7;i++)this.sparks.push({p:p.clone(),v:new T.Vector3((this.random()-.5)*2,this.random()*2+.2,(this.random()-.5)*2),life:.4+this.random()*.2,color:new T.Color(color)});
    this.sparks=this.sparks.slice(-30);
  }
  updateParticles(dt) {
    this.sparks=this.sparks.filter(p=>(p.life-=dt)>0);this.effect.count=this.sparks.length;
    this.sparks.forEach((p,i)=>{p.v.y-=dt*5;p.p.addScaledVector(p.v,dt);this.dummy.position.copy(p.p);this.dummy.scale.setScalar(.018+p.life*.035);this.dummy.updateMatrix();this.effect.setMatrixAt(i,this.dummy.matrix);this.effect.setColorAt(i,p.color);});
    this.effect.instanceMatrix.needsUpdate=true;if(this.effect.instanceColor)this.effect.instanceColor.needsUpdate=true;
  }
  snapshot(){return {time:this.time,health:this.health,phase:this.phase,attack:this.attack,position:this.position.toArray(),heading:this.heading,stats:structuredClone(this.stats)};}
}
