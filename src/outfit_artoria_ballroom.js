// Artoria's owner-approved ballroom counterpart. Clothes are visual surfaces:
// original body, joints, AI and the already-unarmored combat state are preserved.
export function createArtoriaBallroomOutfit(h, originalHead) {
  const {THREE,addMerged,CLOTH,bake,reshapeMain,artoriaRoundedBox,clothNeck,isoldeLock,taperedTube}=h;
  const DRESS=0x27242e,FOLD=0x403a46,SEAM=0x5e5260,BOOT=0x29272d,IVORY=0xe0d1b2;
  const fabric={...CLOTH,roughness:.78,side:THREE.DoubleSide};
  const leather={...CLOTH,roughness:.63};
  const chestRows=[[-.165,.091,.136],[-.10,.100,.146],[-.035,.118,.166],[.035,.124,.169],[.10,.111,.171],[.137,.091,.158],[.18,.045,.049]];
  const waistRows=[[-.11,.106,.154],[-.065,.096,.137],[0,.085,.120],[.055,.089,.128],[.11,.096,.141]];
  const lerp=THREE.MathUtils.lerp;
  function radii(rows,y){
    for(let i=0;i<rows.length-1;i++)if(y<=rows[i+1][0]){
      const a=rows[i],b=rows[i+1],u=THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1),t=u*u*(3-2*u);
      return [lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
    }
    return rows.at(-1).slice(1);
  }
  function point(rows,y,a,padding=0){
    const [rx,rz]=radii(rows,y),c=Math.cos(a),s=Math.sin(a);
    const r=1/Math.pow(Math.pow(Math.abs(c)/rx,2.35)+Math.pow(Math.abs(s)/rz,2.35),1/2.35);
    return [c*(r+padding),y,s*(r+padding)];
  }
  function surface(fn,rows=22,n=64){
    const vertices=[],uv=[],indices=[];
    for(let j=0;j<=rows;j++)for(let i=0;i<=n;i++){
      vertices.push(...fn(j/rows,i/n*Math.PI*2));uv.push(i/n,j/rows);
      if(j<rows&&i<n){const k=j*(n+1)+i;indices.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2)}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
  }
  function main(g,geo,color){
    const m=g.children[0];if(geo)reshapeMain(m,geo);
    m.material.color.setHex(color);m.material.roughness=.85;m.material.metalness=0;
    for(const extra of g.children.slice(1))extra.visible=false;
    return m;
  }
  const line=(g,pts,color=SEAM,r=.0015)=>addMerged(g,[taperedTube(pts,pts.map(()=>r),pts.length*5,5)],color,CLOTH);
  const edge=(g,fn,color,r=.0017)=>line(g,Array.from({length:65},(_,i)=>fn(i/64*Math.PI*2)),color,r);
  function chest(g,look){
    main(g,surface((t,a)=>point(chestRows,lerp(-.165,.18,t),a)),look.skin);
    clothNeck(g,look);
    addMerged(g,[-1,1].map(s=>bake(new THREE.SphereGeometry(.048,18,12),[0,.099,s*.19],null,[1,.94,1])),look.skin,CLOTH);
    // A shallow sweetheart neckline; both shoulders remain open above the cuff.
    const top=a=>Math.cos(a)>0?.023+.039*Math.exp(-Math.pow((Math.abs(Math.sin(a))-.57)/.36,2)):.032;
    addMerged(g,[surface((t,a)=>point(chestRows,lerp(-.166,top(a),t),a,.003))],DRESS,fabric).name='artoria-ballroom-bodice';
    addMerged(g,[surface((t,a)=>point(chestRows,top(a)-t*.027,a,.005+.004*Math.sin(t*Math.PI)),4)],FOLD,fabric).name='artoria-folded-neckline';
    edge(g,a=>point(chestRows,top(a),a,.007),SEAM,.0017);
    // Subtle fitted seams continue the curved silhouette into the waist.
    for(const s of [-1,1])line(g,Array.from({length:12},(_,i)=>{
      const y=.027-i/11*.19,a=s*(.56+.10*i/11);return point(chestRows,y,a,.005);
    }),FOLD,.0016);
    // Retain her native silver side locks, including their chest continuation.
    addMerged(g,[-1,1].map(s=>isoldeLock([[.13,.15,s*.145],[.175,.06,s*.15],[.164,-.067,s*.17]],[.03,.032,.002],.012)),look.hair,CLOTH).name='artoria-hair';
  }
  function abdomen(g){
    main(g,surface((t,a)=>point(waistRows,lerp(-.11,.11,t),a)),DRESS);
    for(const s of [-1,1])line(g,Array.from({length:14},(_,i)=>point(waistRows,.108-i/13*.215,s*.66,.002)),FOLD,.0015);
    // Tiny back lacing sits on the dress; it is not a new armor or body part.
    for(let i=0;i<4;i++)for(const s of [-1,1]){
      const y=.065-i*.033,p=point(waistRows,y,Math.PI+s*.18,.003),q=point(waistRows,y-.031,Math.PI-s*.18,.003);
      line(g,[p,q],FOLD,.0014);
    }
  }
  function pelvis(g){
    main(g,artoriaRoundedBox(.208,.18,.312,.045),DRESS);
    const at=(t,a)=>{
      const flare=Math.pow(t,.8),fold=Math.pow(t,.9)*(.011*Math.cos(a*10+.25)+.0035*Math.cos(a*17));
      const rx=lerp(.103,.257,flare)+fold,rz=lerp(.154,.305,flare)+fold;
      return [Math.cos(a)*rx,.118-.485*t+Math.pow(t,5)*(.006*Math.sin(a*3)+.005*Math.cos(a*10)),Math.sin(a)*rz];
    };
    const skirt=surface(at,24,96);
    // Shade the folds without turning black fabric into flat unlit geometry.
    const colors=[];
    for(let j=0;j<=24;j++)for(let i=0;i<=96;i++){
      const shade=.82+.18*Math.cos(i/96*Math.PI*20+.25);colors.push(shade,shade,shade);
    }
    skirt.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    addMerged(g,[skirt],DRESS,{...fabric,vertexColors:true}).name='artoria-ballroom-skirt';
    // Double-sided fabric supplies the inside too. A second lifted lining
    // would cross the rapidly flaring waist and show as a gray patch.
    edge(g,a=>at(1,a),FOLD,.0022);
    // A narrow doubled hem, with the original black palette kept restrained.
    edge(g,a=>at(.972,a),0x37313d,.0013);
  }
  function limb(g,look,upper=false,forearm=false){
    const old=g.children[0].geometry.parameters,{radius,height}=old;
    const geo=new THREE.CapsuleGeometry(radius,height+.014,8,24),p=geo.attributes.position;
    for(let i=0;i<p.count;i++){
      const t=THREE.MathUtils.clamp((p.getY(i)+height/2+radius)/(height+radius*2),0,1);
      const k=upper?lerp(.79,.98,t):lerp(.82,.96,t);
      p.setXYZ(i,p.getX(i)*k,p.getY(i),p.getZ(i)*k);
    }
    geo.computeVertexNormals();reshapeMain(g.children[0],geo);
    g.children[0].material.color.setHex(look.skin);g.children[0].material.metalness=0;
    if(forearm){
      for(const m of g.children.slice(1))if(m.material)m.material.color.setHex(look.skin);
      addMerged(g,[bake(new THREE.SphereGeometry(.04,14,10),[0,.14,0],null,[1,1.08,1])],look.skin,CLOTH);
    }
    if(upper){
      const cuff=surface((t,a)=>{const r=.052+.005*Math.sin(t*Math.PI);return [Math.cos(a)*r,.12-t*.079,Math.sin(a)*r]},8,40);
      addMerged(g,[cuff],DRESS,fabric).name='artoria-off-shoulder-sleeve';
      edge(g,a=>[Math.cos(a)*.054,.12,Math.sin(a)*.054],FOLD,.0024);
    }
  }
  function boot(g){
    const rows=[[-.229,.042,.044],[-.15,.047,.048],[-.04,.064,.060],[.10,.062,.058],[.205,.066,.061],[.285,.071,.065]];
    main(g,surface((t,a)=>point(rows,lerp(-.229,.285,t),a),22,48),BOOT);
    const cuff=addMerged(g,[surface((t,a)=>point(rows,.285-t*.029,a,.003),3,48)],FOLD,leather);cuff.name='artoria-knee-boot';
    edge(g,a=>point(rows,.285,a,.004),0x62545b,.0016);
    line(g,Array.from({length:18},(_,i)=>point(rows,-.217+i/17*.485,Math.PI,.002)),FOLD,.0013);
    // Soft ankle creases make the shafts read as leather rather than shin plates.
    for(const y of [-.167,-.186])line(g,Array.from({length:9},(_,i)=>point(rows,y+.004*Math.cos(i/8*Math.PI),-.95+i/8*1.9,.002)),FOLD,.0012);
  }
  function foot(g){
    const geo=artoriaRoundedBox(.264,.078,.115,.027),p=geo.attributes.position;
    for(let i=0;i<p.count;i++){
      const toe=THREE.MathUtils.smoothstep(p.getX(i),.01,.132);
      p.setXYZ(i,p.getX(i)+toe*.014,p.getY(i)*(1-toe*.28),p.getZ(i)*(1-toe*.16));
    }
    geo.computeVertexNormals();main(g,geo,BOOT);g.children[0].material.roughness=.63;
    addMerged(g,[bake(artoriaRoundedBox(.255,.012,.112,.005),[.005,-.035,0]),
      bake(artoriaRoundedBox(.055,.023,.082,.008),[-.081,-.038,0])],0x19191e,leather);
  }
  function bow(g){
    const holder=new THREE.Group();holder.name='artoria-ivory-bow';holder.position.set(-.14,-.045,0);g.add(holder);
    for(const s of [-1,1]){
      // Wide folded wings sit behind the nape, not above the head like ears.
      const verts=[],idx=[],n=32,rows=8;
      const at=(t,v)=>[-.008-.021*Math.sin(t*Math.PI)*(1-v*v),
        .009*Math.sin(t*Math.PI)+v*(.013+.040*Math.sin(t*Math.PI*.83)),s*(.013+t*.15)];
      for(let i=0;i<=n;i++)for(let j=0;j<=rows;j++){
        verts.push(...at(i/n,j/rows*2-1));
        if(i<n&&j<rows){const k=i*(rows+1)+j;idx.push(k,k+rows+1,k+1,k+1,k+rows+1,k+rows+2)}
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(idx);geo.computeVertexNormals();
      addMerged(holder,[geo],IVORY,fabric);
      for(const side of [-1,1])line(holder,Array.from({length:17},(_,i)=>at(i/16,side)),0xc4b395,.0012);
      line(holder,Array.from({length:13},(_,i)=>at(i/12*.76,0)),0xcfc0a2,.001);
      const tail=[[-.006,-.009,s*.02],[-.015,-.062,s*.052],[-.005,-.133,s*.073],[-.017,-.167,s*.085]];
      addMerged(holder,[isoldeLock(tail,[.036,.041,.038,.029],.0025)],IVORY,fabric);
      line(holder,tail.map(([x,y,z])=>[x-.002,y,z+s*.013]),0xb4a48b,.0013);
    }
    addMerged(holder,[bake(new THREE.SphereGeometry(.026,14,10),[0,0,0],null,[.58,1,.85])],0xc5b493,fabric);
  }
  return {
    head(g,look){originalHead(g,look);bow(g)},chest,abdomen,pelvis,
    uarmS(g,l){limb(g,l,true)},uarmO(g,l){limb(g,l,true)},
    farmS(g,l){limb(g,l,false,true)},farmO(g,l){limb(g,l,false,true)},
    thighF(g,l){limb(g,l)},thighB(g,l){limb(g,l)},shinF:boot,shinB:boot,footF:foot,footB:foot,
  };
}
