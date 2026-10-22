// Black King's second appearance. Reuses the native articulated armor and its
// wear pieces. Finishing runs AFTER armorBoxes, like the existing tailoring
// pass: no changes to body/helmet collision, plate coverage or combat motors.
import {createRoyalConceptOutfit} from './outfit_royal_concepts.js';

export function createBlackKingOutfitV2(h) {
  const {THREE,addMerged,bake,ball,cyl,artoriaCloth}=h;
  const IRON=0x353237, GOLD=0xa18b60, LIGHT=0xc4b086, CLOTH=0x59445f;
  const colors=new Map([[0x303b3e,IRON],[0x164653,CLOTH],[0x244a70,0x514158],
    [0xad8849,GOLD],[0xad8848,GOLD],[0xa58b52,GOLD],[0xd4b373,LIGHT],
    [0xd0b678,LIGHT],[0x242725,0x262329],[0x443a2a,0x262329],
    [0x141c20,0x18171b],[0x69675c,0x676268]]);
  let current=null;
  const base=createRoyalConceptOutfit({...h,addMerged(g,p,c,m){
    const obj=addMerged(g,p,colors.get(c)??c,m);
    if(obj&&current)current.push({obj,color:c,count:p.length,parent:g});
    return obj;
  }},'black');
  const metal={metalness:.72,roughness:.40,steel:.82};
  const cloth={metalness:0,roughness:.96,side:THREE.DoubleSide};
  const add=(g,geos,c=GOLD,m=metal)=>addMerged(g,geos,c,m);
  const curve=(p,r=.0014,n=18)=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p.map(v=>new THREE.Vector3(...v))),n,r,4,false);
  const bounds=m=>{m.geometry.computeBoundingBox();return m.geometry.boundingBox;};
  const surface=(rows,y,z,lift=.003)=>{
    let i=0;while(i<rows.length-2&&y>rows[i+1][0])i++;
    const a=rows[i],b=rows[i+1],t=THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);
    const d=THREE.MathUtils.lerp(a[1],b[1],t),w=THREE.MathUtils.lerp(a[2],b[2],t),x=THREE.MathUtils.lerp(a[3]||0,b[3]||0,t);
    return[x+d*Math.pow(Math.max(0,1-(z/w)**2),.4)+lift,y,z];
  };
  function rivets(parent,points,r=.0023){add(parent,points.map(p=>ball(r,6,4,p)),LIGHT);}
  function finish(g,part,look,entries){
    // Cloth has baked vertex colors, so a material remap alone leaves teal.
    const old=new THREE.Color(0x164653),next=new THREE.Color(CLOTH);
    g.traverse(o=>{
      if(!o.geometry)return;
      const colors=o.geometry.attributes.color;
      if(colors){for(let i=0;i<colors.count;i++){
        const shade=colors.getY(i)/old.g;
        colors.setXYZ(i,next.r*shade,next.g*shade,next.b*shade);
      }colors.needsUpdate=true;}
      if(o.name==='black-king-teal-cape')o.name='black-king-amethyst-cape';
    });
    // Chased decoration, rather than a repeated bright print on every plate.
    for(const e of entries)if(e.count===11&&(e.color===0xad8849||e.color===0xad8848)){
      e.obj.material.color.setHex(part.startsWith('thigh')?0x5b5055:part.startsWith('farm')?0x75654f:0x897756);
      if(e.obj.userData.base)e.obj.userData.base.color=e.obj.material.color.getHex();
    }
    if(part==='head'){
      const face=g.children[0],p=face.geometry.attributes.position;
      // Retain the game's face scale; soften the spherical cheeks into planes.
      for(let i=0;i<p.count;i++){
        const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
        const jaw=THREE.MathUtils.clamp((-y-.025)/.07,0,1);
        p.setZ(i,z*(1-.08*jaw));
        if(x>.025&&y<.015)p.setX(i,x-.004*Math.max(0,Math.abs(z)/.08));
      }p.needsUpdate=true;face.geometry.computeVertexNormals();
      for(const eye of g.children.slice(1,3)){
        eye.geometry.dispose();eye.geometry=new THREE.SphereGeometry(1,8,6);
        eye.geometry.scale(.006,.005,.010);eye.scale.y=1;eye.material.color.setHex(0x352f2e);
      }
      const nose=g.children[3];nose.geometry.dispose();
      nose.geometry=new THREE.SphereGeometry(1,8,6);
      nose.geometry.scale(.013,.018,.008);nose.position.set(.099,-.009,0);
      const skin=artoriaCloth(g,'black-king-face-detail');
      // A soft high collar bridges the jaw and chest gorget. It is cloth,
      // attached to the head's underlayer and grants no new neck armor.
      add(skin,[cyl(.052,.058,.043,24,false,[-.006,-.117,0])],0x373039,cloth);
      const helm=g.userData.helmet,visor=helm.userData.pieces.visor;
      if(visor){
        // Engraved visor border and real hinge pins, attached to wear pieces.
        const plate=visor.children[0];
        const rows=[[.050,.127,.100,.002],[.094,.143,.099,-.002],[.131,.108,.086,-.009]];
        rivets(plate,[-.075,-.05,-.025,0,.025,.05,.075].map(z=>surface(rows,.057,z,.005)),.0018);
      }
      const crest=helm.userData.pieces.crest;
      if(crest){
        // Hollow-looking chased mounting; ivory vanes retain their own widths.
        add(crest,[curve([[.079,.151,-.013],[.070,.210,-.010],[.060,.239,0],[.070,.210,.010],[.079,.151,.013]],.0016,20)],0x60503b);
        const quills=[];
        for(let i=0;i<18;i++){
          const t=(i+.5)/18,z=(t-.5)*.17;
          const path=[[.006-i*.001,.166,z*.22],[-.055-i*.002,.255+.065*Math.sin(t*Math.PI)+.012*Math.sin(i*1.7),z],[-.173-i*.004,.220+.050*Math.sin(t*Math.PI),z*1.20],[-.265-.070*Math.sin(t*Math.PI),-.015+.095*Math.sin(t*Math.PI)+.012*Math.cos(i*1.4),z]];
          const spline=new THREE.CatmullRomCurve3(path.map(p=>new THREE.Vector3(...p)));
          quills.push(curve(Array.from({length:19},(_,j)=>{const u=j/20,c=spline.getPoint(u);return[c.x,c.y+.0037*Math.sin(Math.PI*u)+.0005,c.z];}),.00085,24));
        }
        add(crest,quills,0xbeb8aa,cloth);
      }
    }
    if(part==='chest'){
      const host=entries.find(e=>e.parent===g&&e.color===0x303b3e)?.obj;
      if(host){
        const rows=[[-.146,.105,.142,0],[-.080,.128,.162,-.005],[.015,.140,.177,-.005],[.090,.126,.173,-.006],[.144,.075,.112,0]],f=(y,z)=>surface(rows,y,z,.004);
        const seams=[];
        for(const s of [-1,1])seams.push(curve([f(-.135,s*.04),f(-.07,s*.08),f(.015,s*.138),f(.083,s*.144),f(.119,s*.094)],.0015,25));
        add(host,seams,0x6b5d4d);
        rivets(host,[-.09,-.06,-.03,0,.03,.06,.09].map(z=>f(-.137,z)),.0018);
        for(const s of [-1,1]){
          const p=f(.108,s*.126);
          add(host,[cyl(.019,.019,.008,16,false,[p[0]+.006,p[1],p[2]],[0,0,Math.PI/2])],0x443b3e);
          add(host,[bake(ball(.010,10,6),[p[0]+.014,p[1],p[2]],null,[.4,1,1])],0x9c859d,{...metal,metalness:.3,roughness:.26});
        }
      }
    }
    if(part.startsWith('thigh')){
      for(const e of entries)if(e.parent===g&&e.color===0x303b3e){
        const b=bounds(e.obj),top=b.max.y,low=b.min.y,w=b.max.z,d=b.max.x;
        const seams=[];for(const s of [-1,1]){
          seams.push(curve([[d-.007,top-.011,s*w*.42],[d-.009,(top+low)/2,s*w*.43],[d-.014,low+.012,s*w*.41]],.0014,12));
        }
        add(e.obj,seams,0x887459);rivets(e.obj,[-1,1].map(s=>[d-.012,top-.012,s*w*.70]),.0022);
      }
    }
    if(part==='pelvis'){
      const layer=g.getObjectByName('concept-front-tabard');
      if(layer){
        // Long quiet centre, with one small seal instead of a vine ladder.
        for(const c of layer.children)if(c.geometry&&c.material.color.getHex()===GOLD)c.material.color.setHex(0x756078);
        add(layer,[curve([[.146,-.24,-.022],[.146,-.27,0],[.146,-.24,.022],[.146,-.21,0],[.146,-.24,-.022]],.002,12)],GOLD,cloth);
      }
    }
    if(part==='uarmS'||part==='uarmO'){
      const cap=entries.find(e=>e.parent===g&&e.color===0x303b3e)?.obj;
      if(cap){const rows=[[-.030,.097,.100,0],[.028,.102,.112,0],[.099,.093,.108,0],[.157,.046,.058,0],[.177,.007,.009,0]];
        rivets(cap,[-.065,-.033,0,.033,.065].map(z=>surface(rows,-.020,z,.004)),.002);
        const flutes=[];for(const s of [-1,1])flutes.push(curve([[.012,.162,s*.035],[.065,.132,s*.058],[.081,.075,s*.060],[.078,.008,s*.060]],.0022,20));
        add(cap,flutes,0x5c5556);
      }
    }
    g.userData.blackKingFinished=true;
  }
  const result={...base};
  for(const [part,fn]of Object.entries(base))if(typeof fn==='function'&&part!=='underCloth'){
    result[part]=(g,look,...rest)=>{
      const entries=[];current=entries;try{fn(g,look,...rest);}finally{current=null;}
      g.userData.finishBlackKing=()=>{finish(g,part,look,entries);delete g.userData.finishBlackKing;};
    };
  }
  return result;
}
