// Fictional Bruges fencing guild: crossed swords and a five-petal rose.
// Historical references/limits: docs/codex_team/ISOLDE_GUILD_20261016.md.
// Surface-laid gold cords with short couching stitches, not a metal badge.
import * as THREE from 'three';

export function addGuildEmbroidery(vest, rows) {
  const positions=[],colors=[],indices=[];
  const gold=new THREE.Color(0xd4b66d),light=new THREE.Color(0xe0c282),tie=new THREE.Color(0x927241);
  function patch(side,cy,cz,scale) {
    // Follow the actual vest surface, including its shoulder taper.
    function point(u,v,raise=.0011) {
      const y=cy+v*scale,z=cz+u*scale;
      let j=rows.findIndex((r,i)=>i<rows.length-1&&y<=r[0]&&y>=rows[i+1][0]);
      if(j<0)j=y>rows[0][0]?0:rows.length-2;
      const t=THREE.MathUtils.clamp((rows[j][0]-y)/(rows[j][0]-rows[j+1][0]),0,1);
      const rx=THREE.MathUtils.lerp(rows[j][1],rows[j+1][1],t),rz=THREE.MathUtils.lerp(rows[j][2],rows[j+1][2],t);
      const x=rx*Math.pow(Math.max(.001,1-Math.pow(Math.abs(z)/rz,10)),.1);
      return [side*(x+raise),y,z];
    }
    function strip(a,b,width,color,raise=.0011) {
      const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(!len)return;
      const u=-dy/len*width/2,v=dx/len*width/2,k=positions.length/3;
      for(const p of [[a[0]+u,a[1]+v],[a[0]-u,a[1]-v],[b[0]+u,b[1]+v],[b[0]-u,b[1]-v]]){
        positions.push(...point(...p,raise));colors.push(color.r,color.g,color.b);
      }
      indices.push(k,k+1,k+2,k+1,k+3,k+2);
    }
    function cord(path,width=.021,couched=true) {
      width*=1.8;
      for(let i=1;i<path.length;i++){
        const a=path[i-1],b=path[i];strip(a,b,width,gold);
        // A thin companion thread gives the laid pair a soft, uneven sheen.
        strip([a[0]+width*.21,a[1]],[b[0]+width*.21,b[1]],width*.27,light,.00125);
        if(!couched)continue;
        const len=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/len,dy=(b[1]-a[1])/len;
        for(let d=.035;d<len;d+=.095){
          const u=a[0]+dx*d,v=a[1]+dy*d,w=width*.7;
          strip([u-dy*w,v+dx*w],[u+dy*w,v-dx*w],.011,tie,.00145);
        }
      }
    }
    // Two straight cross-hilted practice swords. Shapes are conventional
    // heraldic charges, not a claimed reproduction of a real guild's arms.
    for(const s of [-1,1]){
      const transform=([u,v])=>[s*(u*.79+v*.61),v*.79-u*.61];
      cord([[-.043,-.24],[-.035,.70],[0,.89],[.035,.70],[.043,-.24],[-.043,-.24]].map(transform));
      cord([[0,-.23],[0,.73]].map(transform),.035);
      cord([[0,-.22],[0,-.63]].map(transform),.047);
      cord([[-.19,-.25],[0,-.21],[.19,-.25]].map(transform),.035);
      const ring=Array.from({length:17},(_,i)=>transform([Math.cos(i/16*Math.PI*2)*.055,-.70+Math.sin(i/16*Math.PI*2)*.055]));
      cord(ring,.025,false);
    }
    // The rose sits above the crossing; five petals, without the extra ring of
    // a Tudor rose. Its meaning belongs to the fictional guild, not a dynasty.
    const rose=[];
    for(let i=0;i<=100;i++){
      const a=i/100*Math.PI*2,r=.154+.026*Math.cos(5*(a-Math.PI/2));
      rose.push([Math.cos(a)*r,.38+Math.sin(a)*r]);
    }
    cord(rose,.030,false);
    for(let i=0;i<5;i++){
      const a=Math.PI/2+i/5*Math.PI*2;
      cord([[Math.cos(a)*.035,.38+Math.sin(a)*.035],[Math.cos(a)*.128,.38+Math.sin(a)*.128]],.014,false);
    }
    cord(Array.from({length:17},(_,i)=>[Math.cos(i/16*Math.PI*2)*.032,.38+Math.sin(i/16*Math.PI*2)*.032]),.022,false);
  }
  patch(1,.11,-.105,.049); // above the bent forearm, modest left-breast badge
  patch(-1,-.043,0,.104);   // readable guild badge on the back, below the bob
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,metalness:.18,roughness:.72,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geo,mat);mesh.name='isolde-guild-gold-embroidery';mesh.receiveShadow=true;vest.add(mesh);
}
