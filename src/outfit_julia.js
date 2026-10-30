// Julia is an ordinary production Fighter, dressed through the same native
// part hooks as Maya/Isolde/Tome. Never replace the face, eyes, hands or body rig.
export const JULIA_LOOK = {
  tunic:0x465038, quilt:0x35402b, sleeve:0xe5d9be, straps:null,
  belt:0x523b29, hoseUpper:0x35402b, hoseLower:0x463327, shoes:0x443024,
  skin:0xe0ad88, hands:0xe0ad88, helmet:null, metal:0xb29a64,
  hair:0x493021, headband:null, grip:0x483222, hilt:0xa39372,
  outfit:'julia_merchant', armor:null, stockEyes:true, stockFace:true, eyeColor:0x38291c,
};

export function createJuliaOutfit(h, palette = {}) {
  const {THREE:T,bake,box,cyl,ball,addMerged,CLOTH,quietFace,isoldeLock,artoriaCloth,
    sleeveVolume,clothNeck,clothPanel,taperedTube,reshapeMain,artoriaRoundedBox}=h;
  const {GREEN=0x465038, DARK_GREEN=0x343e2b, LINEN=0xe5d9be, RUST=0x944c37,
    RUST_DARK=0x713727, GOLD=0xb09a66, BROWN=0x523b29, COLLAR=0xeee3ce}=palette;
  const ds={...CLOTH,side:T.DoubleSide};
  const layer=g=>artoriaCloth(g,'julia-cloth');
  const add=(g,p,c,m=CLOTH)=>addMerged(layer(g),p,c,m);
  const line=(pts,r=.0018)=>taperedTube(pts,pts.map(()=>r),pts.length*5,5);
  function clean(g,color){
    const main=g.children[0];for(const c of g.children.slice(1))c.visible=false;
    main.material.color.setHex(color);main.material.roughness=.95;main.material.metalness=0;return main;
  }
  function head(g,look){
    quietFace(g,look,'uniform'); // stock sphere/nose and native small eyes stay intact
    const hair=artoriaCloth(g,'julia-hair'),locks=[];
    for(const side of [-1,1]){
      for(let i=0;i<3;i++)locks.push(isoldeLock([[.018,.104,side*(.02+i*.022)],
        [.071,.087,side*(.032+i*.018)],[.094,.056,side*(.045+i*.018)],
        [.075,.032,side*(.078+i*.007)]],[.029,.034,.023,.004],.009));
      locks.push(isoldeLock([[.017,.08,side*.086],[-.015,.02,side*.109],
        [.004,-.067,side*.108],[.034,-.118,side*.091],[.014,-.145,side*.085]],
        [.035,.036,.026,.018,.003],.01));
    }
    for(let i=-2;i<=2;i++)locks.push(isoldeLock([[-.073,.073,i*.032],[-.108,-.015,i*.035],[-.097,-.10,i*.03]], [.04,.043,.02],.011));
    addMerged(hair,locks,look.hair,CLOTH);
    const curve=new T.CatmullRomCurve3([[-.097,-.035,-.025],[-.137,-.10,-.034],[-.166,-.24,-.052],[-.177,-.40,-.064]].map(p=>new T.Vector3(...p))),braids=[];
    for(let strand=0;strand<3;strand++){
      const pts=Array.from({length:37},(_,i)=>{const t=i/36,a=t*Math.PI*12+strand*Math.PI*2/3,c=curve.getPoint(t),r=.014*(1-.55*t);return[c.x+r*Math.cos(a),c.y,c.z+r*Math.sin(a)];});
      braids.push(taperedTube(pts,pts.map((_,i)=>.011-i/36*.006),54,6));
    }
    addMerged(hair,braids,look.hair,CLOTH);
    // Soft broad band fitted to the original cap, with a low rear knot and tails.
    const band=[],idx=[],uv=[];
    for(let i=0;i<=24;i++){
      const a=-Math.PI/2+i/24*Math.PI;
      for(const x of [-.055,.025]){band.push(x,.004+.127*Math.cos(a),.126*Math.sin(a));uv.push(x,i/24);}
      if(i<24){const k=i*2;idx.push(k,k+2,k+1,k+1,k+2,k+3);}
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(band,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
    addMerged(hair,[geo,ball(.017,10,6,[-.104,-.046,-.02]),
      clothPanel(-.117,[[-.035,-.026],[-.048,-.004],[-.145,.035],[-.12,.006]],.003),
      clothPanel(-.119,[[-.035,-.03],[-.048,-.046],[-.16,-.084],[-.138,-.048]],.003),
      cyl(.012,.012,.014,8,false,[-.175,-.37,-.062])],RUST,ds);
  }
  function chest(g,look){
    const main=clean(g,GREEN);reshapeMain(main,artoriaRoundedBox(.232,.28,.353,.035));
    clothNeck(g,look);
    // Ivory shirt at the front, with a shallow open neck and two small turned collars.
    add(g,[clothPanel(.118,[[.137,-.071],[.137,.071],[-.132,.021],[-.132,-.021]],.004)],LINEN);
    add(g,[clothPanel(.122,[[.145,-.035],[.145,.035],[.048,.008],[.048,-.008]],.003)],look.skin);
    add(g,[-1,1].map(s=>clothPanel(.126,[[.148,s*.035],[.133,s*.077],[.012,s*.047],[.047,s*.017]],.003)),COLLAR);
    const seams=[];for(const s of [-1,1]){
      seams.push(line([[.124,.137,s*.074],[.125,.018,s*.048],[.125,-.135,s*.025]],.002));
      for(let i=0;i<7;i++){const y=.1-i*.035,z=s*(.07-(.1-y)*.16);seams.push(box(.003,.006,.004,[.128,y,z+s*.008]));}
    }add(g,seams,GOLD);
    // The same shoulder joints as every fighter; only cloth covers their roots.
    add(g,[-1,1].map(s=>bake(ball(.052,12,8),[0,.099,s*.187],null,[1,.9,1])),LINEN);
    // Short shawl over the shoulder line, ending above the moving abdomen.
    const shawl=[];
    for(const s of [-1,1])shawl.push(isoldeLock([[.11,.10,s*.129],[.02,.146,s*.163],[-.093,.115,s*.16],[-.123,-.094,s*.125]],[.058,.065,.069,.057],.004));
    shawl.push(clothPanel(-.122,[[.112,-.15],[.112,.15],[-.09,.12],[-.107,0],[-.09,-.12]],.004));
    add(g,shawl,RUST,ds);
    add(g,[-1,1].map(s=>bake(cyl(.014,.014,.005,12,false),[.132,.096,s*.129],[0,0,Math.PI/2])),GOLD,{...CLOTH,metalness:.3,roughness:.55});
    add(g,[-1,1].map(s=>line([[.13,.084,s*.135],[.135,.015,s*.146],[.128,-.083,s*.15]],.002)),RUST_DARK);
  }
  function abdomen(g){
    const main=clean(g,GREEN);reshapeMain(main,artoriaRoundedBox(.21,.155,.30,.025));
    const rows=[];for(const y of [.052,.013,-.026]){rows.push(box(.004,.004,.047,[.11,y,0]));}
    add(g,rows,GOLD);
    add(g,[box(.22,.036,.313,[0,-.051,0])],BROWN);
    add(g,[box(.012,.029,.035,[.117,-.051,-.02])],GOLD);
    add(g,[box(.013,.017,.024,[.125,-.051,-.02])],BROWN);
  }
  function pelvis(g){
    const base=clean(g,RUST);reshapeMain(base,artoriaRoundedBox(.20,.17,.29,.048));
    const top=new T.CylinderGeometry(.169,.20,.23,28,4,true);top.scale(.75,1,1);top.translate(0,-.075,0);add(g,[top],RUST,ds);
    // Readable small merchant items attached to the original pelvis part.
    add(g,[box(.061,.105,.08,[.061,-.10,-.19],[0,0,-.10]),bake(ball(.039,10,6),[.061,-.152,-.19],null,[.75,.5,1])],BROWN);
    add(g,[box(.008,.036,.077,[.094,-.065,-.19])],0x6e5035);
    add(g,[ball(.005,8,6,[.101,-.077,-.19])],GOLD);
    add(g,[cyl(.022,.022,.18,12,false,[-.025,-.11,.198],[0,0,-.12])],0x6c5038);
    add(g,[-.055,-.165].map(y=>cyl(.024,.024,.012,12,true,[-.025,y,.198],[0,0,-.12])),BROWN,ds);
  }
  function upper(g){sleeveVolume(g,.96,.92);g.children[0].material.color.setHex(LINEN);}
  function forearm(g,look){
    sleeveVolume(g,.93,.89);g.children[0].material.color.setHex(look.skin);
    add(g,[cyl(.048,.044,.063,12,true,[0,.10,0]),cyl(.05,.047,.025,12,true,[0,.067,0])],LINEN,ds);
  }
  function thigh(g,look,d){
    const side=Math.sign(d.pos[2]||1);g.children[0].material.color.setHex(DARK_GREEN);
    // Like existing split native skirts, each cloth half follows its own thigh.
    const green=new T.CylinderGeometry(.103,.137,.39,24,5,true);green.translate(0,.015,0);add(g,[green],DARK_GREEN,ds);
    const skirt=new T.CylinderGeometry(.107,.143,.34,24,5,true),p=skirt.attributes.position;
    for(let i=0;i<p.count;i++){
      const y=p.getY(i),t=(.17-y)/.34,a=Math.atan2(p.getZ(i),p.getX(i)),f=1+.018*t*Math.cos(a*8);
      p.setXYZ(i,p.getX(i)*f,y+.052+(side>0?.018:-.015)*t+side*p.getZ(i)*.18*t,p.getZ(i)*f);
    }skirt.computeVertexNormals();add(g,[skirt],RUST,ds);
    add(g,[line([[.108,.19,side*.025],[.129,.026,side*.04],[.143,-.105,side*.06]],.002)],RUST_DARK);
  }
  function shin(g){
    g.children[0].material.color.setHex(BROWN);
    add(g,[cyl(.054,.051,.028,12,true,[0,.1,0]),cyl(.046,.046,.018,12,true,[0,-.12,0])],0x6d5038,ds);
  }
  function foot(g){g.children[0].material.color.setHex(BROWN);add(g,[box(.24,.012,.105,[0,-.032,0])],0x30231b);}
  return {head,chest,abdomen,pelvis,uarmS:upper,uarmO:upper,farmS:forearm,farmO:forearm,
    thighF:thigh,thighB:thigh,shinF:shin,shinB:shin,footF:foot,footB:foot};
}
