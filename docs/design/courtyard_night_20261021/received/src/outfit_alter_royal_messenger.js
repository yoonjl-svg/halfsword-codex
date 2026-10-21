// 마야 얼터 — 허리에 찬 열린 문서 가방 (샛별 저장소에서 가져옴 10/17 — docs/import/saetbyeol_round3_2026-10-17.md).
// 있는 몸 부위에 붙이는 겉모습만 — 충돌체 · 방어구 표시 없음. 부위 좌표: +X 앞 · +Y 위 · Z 몸을 가로질러
import * as THREE from 'three';

const material=(color,metalness=0)=>new THREE.MeshStandardMaterial({
  color,roughness:metalness?.55:.92,metalness,side:THREE.DoubleSide,
});
function mesh(g,geo,mat,p){
  const m=new THREE.Mesh(geo,mat);if(p)m.position.set(...p);
  m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
}
function line(g,points,r,mat){
  return mesh(g,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),points.length*5,r,5,false),mat);
}
function panel(g,x,points,thickness,mat){
  const shape=new THREE.Shape();points.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1});
  geo.rotateY(-Math.PI/2);geo.translate(x,0,0);return mesh(g,geo,mat);
}

function dispatchCase(g){
  const bag=new THREE.Group();bag.name='maya-open-dispatch-case';
  bag.position.set(.161,-.035,.13);bag.rotation.x=-.14;g.add(bag);
  const leather=material(0x493c39),edge=material(0x8b775b),paper=material(0xded2b5),ink=material(0x70664f),wax=material(0x872f39),ribbon=material(0x8a4650);
  // 위가 열린 얕은 주름 가방. 허리띠 고리 둘이 무게를 받는다
  mesh(bag,new THREE.BoxGeometry(.028,.162,.128),leather,[0,-.016,0]);
  panel(bag,.022,[[-.067,.058],[-.067,-.085],[-.052,-.104],[.054,-.1],[.068,-.085],[.068,.058]],.005,leather);
  for(const z of [-.045,.045]){
    line(bag,[[-.006,.046,z],[-.022,.15,z],[-.047,.258,z],[-.058,.252,z]],.005,leather);
  }
  // 가방에 그린 읽히지 않는 글씨 대신, 보이는 접힌 명령서
  panel(bag,.017,[[-.055,.047],[-.055,.108],[-.027,.115],[.052,.103],[.052,.046]],.003,paper);
  line(bag,[[.019,.105,-.054],[.02,.102,-.013],[.02,.102,.05]],.0011,ink);
  for(let i=0;i<3;i++)line(bag,[[.021,.086-i*.008,-.043],[.021,.088-i*.008,-.009],[.021,.085-i*.008,.028-i*.008]],.0007,ink);
  // 잠그지 않은 덮개가 앞으로 늘어지고, 부서진 밀랍 봉인과 풀린 리본
  panel(bag,.032,[[-.06,.026],[-.057,-.025],[-.013,-.047],[.05,-.029],[.061,.026]],.004,leather);
  line(bag,[[.034,-.028,-.051],[.034,-.044,-.013],[.034,-.03,.044]],.0016,edge);
  for(const [y,z,start] of [[.012,-.002,.2],[-.039,.005,3.4]]){
    const seal=new THREE.CylinderGeometry(.013,.014,.004,10,1,false,start,Math.PI*.84);
    seal.rotateZ(Math.PI/2);mesh(bag,seal,wax,[.039,y,z]);
  }
  panel(bag,.036,[[-.008,-.025],[-.013,-.091],[-.022,-.125],[-.009,-.118],[.002,-.127],[.008,-.094],[.007,-.027]],.0015,ribbon);
  // 가방 둘레의 성긴 박음질 한 줄 — 가까이서 봐도 모양이 읽힌다
  line(bag,[[.027,.05,-.061],[.027,-.082,-.061],[.027,-.095,-.049],[.027,-.095,.049],[.027,-.082,.061],[.027,.05,.061]],.0011,edge);
}

export function decorateRoyalMessengerAlter(g,look,part){
  if(look.alter==='samira'&&part==='pelvis')dispatchCase(g);
}
