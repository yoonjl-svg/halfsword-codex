// User revision: close the lower face, and use matte yellow cloth distinct
// from the existing reflective antique gold trim.
// Curved bevor with an open eye band. Uses the existing closed steel-helmet
// damage profile; neck rules and all body armor remain unchanged.
import {createBlackKingOutfitV2} from './outfit_black_king_v2.js';

export function createBlackKingOutfitV3(h){
  const {THREE,addMerged,ball,cyl}=h,base=createBlackKingOutfitV2(h);
  const metal={metalness:.72,roughness:.40,steel:.82,side:THREE.DoubleSide};
  const rows=[[-.107,.074,.061],[-.088,.100,.082],[-.050,.120,.101],[-.012,.128,.107],[.032,.118,.109]];
  const top=a=>.006+.023*Math.abs(Math.sin(a))**3+.019*Math.exp(-Math.abs(Math.sin(a))*32);
  function point(y,a,inside=false){
    let k=0;while(k<rows.length-2&&y>rows[k+1][0])k++;
    const p=rows[k],q=rows[k+1],t=THREE.MathUtils.clamp((y-p[0])/(q[0]-p[0]),0,1);
    const d=THREE.MathUtils.lerp(p[1],q[1],t),w=THREE.MathUtils.lerp(p[2],q[2],t),c=Math.cos(a),th=inside?.0025:0;
    return[(d-th)*Math.pow(Math.max(0,c),.8)+.004*c**16,y,(w-th)*Math.sin(a)];
  }
  const curve=(points,r=.0016,n=40)=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),n,r,4,false);
  function closeFace(g){
    const helm=g.userData.helmet,part=new THREE.Group();part.name='black-king-lower-faceplate';helm.add(part);helm.userData.pieces.bevor=part;helm.name='black-king-half-closed-helmet';
    const N=48,R=24,pos=[],uv=[],idx=[],edges=new Map();
    const aFor=i=>-Math.PI/2+i/N*Math.PI;
    for(let j=0;j<=R;j++)for(let i=0;i<=N;i++){
      const a=aFor(i),y=THREE.MathUtils.lerp(rows[0][0],top(a),j/R);
      pos.push(...point(y,a));uv.push(i/N,j/R);
    }
    const count=pos.length/3;
    for(let j=0;j<=R;j++)for(let i=0;i<=N;i++){
      const a=aFor(i),y=THREE.MathUtils.lerp(rows[0][0],top(a),j/R);
      pos.push(...point(y,a,true));uv.push(i/N,j/R);
    }
    const edge=(u,v)=>{const key=u<v?u+':'+v:v+':'+u;if(edges.has(key))edges.delete(key);else edges.set(key,[u,v]);};
    let vents=0;
    for(let j=0;j<R;j++)for(let i=0;i<N;i++){
      const a=aFor(i+.5),y=THREE.MathUtils.lerp(rows[0][0],top(a),(j+.5)/R),z=point(y,a)[2];
      // Two short slots on each cheek are real openings, not bright paint.
      if((j===9||j===13)&&Math.abs(z)>.030&&Math.abs(z)<.076){vents++;continue;}
      const u=j*(N+1)+i,v=u+1,w=u+N+2,x=u+N+1;
      idx.push(u,x,v,v,x,w,u+count,v+count,x+count,v+count,w+count,x+count);
      for(const [a,b]of [[u,v],[v,w],[w,x],[x,u]])edge(a,b);
    }
    for(const[u,v]of edges.values())idx.push(u,v,u+count,v,v+count,u+count);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
    const shell=addMerged(part,[geo],0x353237,metal);shell.userData.base={color:0x353237,roughness:.40};
    const trim=[];
    trim.push(curve(Array.from({length:49},(_,i)=>{const a=aFor(i),p=point(top(a),a);p[0]+=.001;return p;}),.0015));
    trim.push(curve(Array.from({length:49},(_,i)=>{const p=point(rows[0][0]+.001,aFor(i));p[0]+=.001;return p;}),.0014));
    addMerged(shell,trim,0xa18b60,metal);
    const spine=[-.096,-.07,-.035,0,.024].map(y=>{const p=point(y,0);p[0]+=.001;return p;});
    addMerged(shell,[curve(spine,.0014,24)],0x766750,metal);
    const rivets=[];for(const side of [-1,1]){
      rivets.push(ball(.002,6,4,point(-.076,side*.79)),ball(.002,6,4,point(-.019,side*1.1)));
      addMerged(shell,[cyl(.008,.008,.004,12,false,[.013,.010,side*.113],[Math.PI/2,0,0])],0xa18b60,metal);
    }addMerged(shell,rivets,0xc4b086,metal);
    part.userData.ventCells=vents;part.userData.wallThickness=.0025;
  }
  const palette=new Map([[0x59445f,0xbfb358],[0x514158,0x635b31],
    [0x9c859d,0xd3c573],[0x756078,0x8b8047],[0x5b5055,0x585341],
    [0x443b3e,0x443e2b],[0x373039,0x373329]]);
  function yellowCloth(g){
    const before=new THREE.Color(0x59445f),after=new THREE.Color(0xbfb358);
    g.traverse(o=>{
      if(o.material?.color&&palette.has(o.material.color.getHex()))o.material.color.setHex(palette.get(o.material.color.getHex()));
      if(o.userData.base&&palette.has(o.userData.base.color))o.userData.base.color=palette.get(o.userData.base.color);
      const c=o.geometry?.attributes.color;if(c){for(let i=0;i<c.count;i++){
        const shade=c.getY(i)/before.g;c.setXYZ(i,after.r*shade,after.g*shade,after.b*shade);
      }c.needsUpdate=true;}
      if(o.name==='black-king-amethyst-cape')o.name='black-king-yellow-cape';
    });
  }
  const result={...base};
  for(const[part,fn]of Object.entries(base))if(typeof fn==='function'&&part!=='underCloth'){
    result[part]=(g,look,...args)=>{
      fn(g,look,...args);const finish=g.userData.finishBlackKing;
      g.userData.finishBlackKing=()=>{finish();yellowCloth(g);if(part==='head')closeFace(g);};
    };
  }
  return result;
}
