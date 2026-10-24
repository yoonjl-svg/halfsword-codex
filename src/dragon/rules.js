// 용 특별전 전용. 공통 기력·무기·유파 상수를 바꾸지 않는다.
export const DRAGON = Object.freeze({
  name: '폐성의 수호룡', radius: 13, stamina: 300, moveScale: 1.5,
  health: 480, walkSpeed: 0.8, turnSpeed: 0.48,
  guardCost: 12, guardArc: Math.cos(75 * Math.PI / 180),
  meleeCooldown: 0.32, staggerDamage: 72, staggerTime: 2.6,
});
export const ATTACKS = Object.freeze({
  nip: { name: '짧은 물기', tell: .8, active: .32, recover: 1.25, blockable: true, energy: 22, severity: .13 },
  claw: { name: '앞발 견제', tell: .9, active: .5, recover: 1.35, blockable: true, energy: 26, severity: .15 },
  bite: { name: '깊게 물어뜯기', tell: 1.55, active: .46, recover: 1.75, blockable: false, energy: 68, severity: .32 },
  fire: { name: '화염 훑기', tell: 1.6, active: 2.2, recover: 2.1, blockable: false, energy: 30, severity: .12 },
  tail: { name: '꼬리 쓸기', tell: 1.15, active: .75, recover: 1.55, blockable: false, energy: 55, severity: .25 },
});
export const clamp = (x,a=0,b=1) => Math.max(a,Math.min(b,x));
export const smooth = x => { x=clamp(x); return x*x*(3-2*x); };
export const angleDelta = (a,b) => Math.atan2(Math.sin(b-a),Math.cos(b-a));
export function closestOnSegment(p,a,b,out) {
  const x=b.x-a.x,y=b.y-a.y,z=b.z-a.z;
  const t=clamp(((p.x-a.x)*x+(p.y-a.y)*y+(p.z-a.z)*z)/(x*x+y*y+z*z||1));
  return out.set(a.x+x*t,a.y+y*t,a.z+z*t);
}
export function guardEligible(f, source, held, broken=false) {
  if (!held || broken || !f.alive || !f.armed || f.weapon?.gun || f.stamina.exhausted || !['stand','kneel'].includes(f.state)) return false;
  const p=f.bodies.pelvis.translation(), dx=source.x-p.x,dz=source.z-p.z;
  return (Math.cos(f.heading)*dx+Math.sin(f.heading)*dz)/Math.max(.001,Math.hypot(dx,dz))>=DRAGON.guardArc;
}
export function configureDragonPlayer(f) {
  f.encounterMoveScale=DRAGON.moveScale;
  // 이 인스턴스만 변경. 공통 기본값·장비 보너스·음수 문턱은 보존한다.
  Object.defineProperty(f.stamina,'max',{configurable:true,get(){return DRAGON.stamina+this.maxBonus-this.aweLoss;}});
  f.stamina.refill();
}
