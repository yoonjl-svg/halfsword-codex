// Adult Artoria's beach-volleyball counterpart. Cosmetic body surfaces use the
// existing body/joints. Deliberately NO armorParts: the owner removed protection.
export function createArtoriaBeachOutfit(h, originalHead){
  const {THREE,addMerged,CLOTH,bake,artoriaRoundedBox,reshapeMain,clothNeck,isoldeLock,taperedTube}=h;
  const CORAL=0xbb5152,CREAM=0xe8d9b9,cloth={...CLOTH,side:THREE.DoubleSide};
  function skinMain(g,look,geo){
    const main=g.children[0];if(geo)reshapeMain(main,geo);
    main.material.color.setHex(look.skin);main.material.roughness=.88;main.material.metalness=0;
    for(const extra of g.children.slice(1))extra.visible=false;
    return main;
  }
  // Closed, softly squared torso; parameterized surfaces let cloth sit exactly
  // on its surface rather than hovering above a separate spherical body.
  function bodyPoint(part,y,a,extra=0){
    const t=THREE.MathUtils.clamp((y+.15)/.3,0,1),c=Math.cos(a),s=Math.sin(a);
    const waist=Math.min(1,Math.abs(y)/.10);
    const rx=part==='chest'?.106+.014*Math.sin(t*Math.PI):part==='abdomen'?.099+.007*waist*waist:.108;
    const rz=part==='chest'?.145+.028*t:part==='abdomen'?.139+.013*waist*waist:.163;
    const exponent=2.6;
    const r=1/Math.pow(Math.pow(Math.abs(c)/rx,exponent)+Math.pow(Math.abs(s)/rz,exponent),1/exponent);
    return [c*(r+extra),y,s*(r+extra)];
  }
  function surface(part,bottom,top,extra=0){
    const vertices=[],indices=[],n=64,rows=10;
    for(let j=0;j<=rows;j++)for(let i=0;i<=n;i++){
      const a=i/n*Math.PI*2,y=bottom(a)+(top(a)-bottom(a))*j/rows;
      vertices.push(...bodyPoint(part,y,a,extra));
      if(j<rows&&i<n){const k=j*(n+1)+i;indices.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2)}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
  }
  function piping(g,part,edge){
    const pts=Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*2;return bodyPoint(part,edge(a),a,.005)});
    addMerged(g,[taperedTube(pts,pts.map(()=>.0022),128,5)],CREAM,CLOTH);
  }
  function straps(g){
    for(const s of [-1,1]){
      const pts=[[.123,.032,s*.097],[.11,.103,s*.102],[.055,.153,s*.105],[-.02,.153,s*.105],[-.087,.109,s*.102],[-.112,-.043,s*.09]];
      addMerged(g,[isoldeLock(pts,Array(pts.length).fill(.019),.0025)],CORAL,cloth);
      const edge=pts.map(([x,y,z])=>[x+.001,y+.001,z+s*.007]);
      addMerged(g,[taperedTube(edge,edge.map(()=>.0015),30,5)],CREAM,CLOTH);
    }
  }
  function chestSkin(){
    const top=a=>.14-.023*Math.abs(Math.sin(a));
    const geo=surface('chest',()=>-.15,top),vertices=[...geo.attributes.position.array],indices=[...geo.index.array],n=64;
    // A single continuous shoulder slope into the neck, with no separate flat
    // cap or overlapping oval visible across the collarbone.
    for(let j=1;j<=5;j++)for(let i=0;i<=n;i++){
      const a=i/n*Math.PI*2,t=j/5,e=t*t*(3-2*t),p=bodyPoint('chest',top(a),a);
      vertices.push(p[0]*(1-e)+.044*Math.cos(a)*e,top(a)+(.184-top(a))*t,p[2]*(1-e)+.047*Math.sin(a)*e);
      if(i<n){const k=(10+j-1)*(n+1)+i;indices.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2)}
    }
    geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
  }
  function chest(g,look){
    skinMain(g,look,chestSkin());
    // Shoulder/neck skin overlaps the existing joints throughout sword poses.
    addMerged(g,[-1,1].map(s=>bake(new THREE.SphereGeometry(.057,14,10),[0,.10,s*.192],null,[1,.96,1])),look.skin,CLOTH);
    clothNeck(g,look);
    const top=a=>Math.cos(a)>0?-.012+.064*Math.exp(-Math.pow((Math.abs(Math.sin(a))-.58)/.3,2)):-.043;
    const bottom=()=>-.136;
    addMerged(g,[surface('chest',bottom,top,.003)],CORAL,cloth).name='artoria-athletic-bikini-top';
    piping(g,'chest',top);piping(g,'chest',bottom);straps(g);
    // Retain the approved silver locks extending onto the original chest.
    addMerged(g,[-1,1].map(s=>isoldeLock([[.13,.15,s*.145],[.175,.06,s*.15],[.164,-.067,s*.17]],[.03,.032,.002],.012)),look.hair,CLOTH).name='artoria-hair';
  }
  function abdomen(g,look){skinMain(g,look,surface('abdomen',()=>-.105,()=>.105));}
  function pelvis(g,look){
    skinMain(g,look,surface('pelvis',()=>-.104,()=>.10));
    const top=()=>.077,bottom=a=>-.103+.085*Math.pow(Math.abs(Math.sin(a)),1.6);
    addMerged(g,[surface('pelvis',bottom,top,.003)],CORAL,cloth).name='artoria-athletic-bikini-bottom';
    piping(g,'pelvis',top);piping(g,'pelvis',bottom);
  }
  function limb(g,look){skinMain(g,look);}
  function shin(g,look){
    skinMain(g,look);
    addMerged(g,[bake(new THREE.SphereGeometry(.049,14,10),[0,.205,0],null,[1,1.12,1]),
      bake(new THREE.SphereGeometry(.042,12,10),[0,-.203,0],null,[1,1.3,1])],look.skin,CLOTH);
  }
  function forearm(g,look){
    // Keep native hands; only remove the gauntlet/sleeve material.
    for(const m of g.children)if(m.material){m.material.color.setHex(look.skin);m.material.metalness=0;m.material.roughness=.88;}
    addMerged(g,[bake(new THREE.SphereGeometry(.043,12,10),[0,.142,0],null,[1,1.1,1])],look.skin,CLOTH);
  }
  function foot(g,look){
    const geo=artoriaRoundedBox(.248,.074,.112,.027),p=geo.attributes.position;
    for(let i=0;i<p.count;i++){
      const toe=THREE.MathUtils.smoothstep(p.getX(i),.02,.124);
      p.setY(i,p.getY(i)*(1-toe*.26)-toe*.007);
    }
    geo.computeVertexNormals();skinMain(g,look,geo);
    // Small toe contours, not metal plates or a separate shoe silhouette.
    addMerged(g,Array.from({length:5},(_,i)=>bake(new THREE.SphereGeometry(.014-i*.001,8,6),[.115-i*.005,-.005,-.039+i*.019],null,[1.35,.8,.72])),look.skin,CLOTH);
  }
  return {head:originalHead,chest,abdomen,pelvis,uarmS:limb,uarmO:limb,
    farmS:forearm,farmO:forearm,thighF:limb,thighB:limb,shinF:shin,shinB:shin,footF:foot,footB:foot};
}
