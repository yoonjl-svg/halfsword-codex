import { createRenjiHead } from './outfit_renji_head.js';
// Kurose Renji: visual clothing only. +X front, +Y up, +Z right.
// Keep the native face, eyes, nose, hands and representative wound meshes intact.
export function createRenjiOutfit(h) {
  const { THREE, bake, box, cyl, ball, addMerged, CLOTH, artoriaCloth } = h;
  const INK = 0x17191e, NAVY = 0x202637, FOLD = 0x303548;
  const WINE = 0x49202d, VIOLET = 0x665080, LIGHT = 0x816b9a;
  const STRAW_DARK = 0x80704d;
  const cloth = { ...CLOTH, metalness: 0, roughness: 0.96 };
  const doubleCloth = { ...cloth, side: THREE.DoubleSide };
  const layer = (g) => artoriaCloth(g, 'renji-cloth');
  const tint = (g, color) => g.children[0].material.color.setHex(color);

  // All helper geometries have indexed position/normal/uv attributes, so the
  // shared merger keeps one draw per material and disposes construction pieces.
  function panel(x, yz, thickness = 0.006) {
    const vertices = [], uv = [], indices = [], n = yz.length;
    for (const dx of [-thickness / 2, thickness / 2]) for (const [y, z] of yz) {
      vertices.push(x + dx, y, z); uv.push(z, y);
    }
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(yz.map(([y, z]) => new THREE.Vector2(y, z)), []))
      indices.push(a, c, b, n + a, n + b, n + c);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      indices.push(i, j, n + j, i, n + j, n + i);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices); geo.computeVertexNormals();
    return geo;
  }
  function line(a, b, radius = 0.002, sides = 5) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
    const axis = to.clone().sub(from);
    const geo = new THREE.CylinderGeometry(radius, radius, axis.length(), sides);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize()));
    geo.translate(...from.add(to).multiplyScalar(0.5).toArray());
    return geo;
  }
  function pleats(top, bottom, height, y, xScale = 1, zScale = 1, slope = 0) {
    const geo = new THREE.CylinderGeometry(top, bottom, height, 32, 4, true);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const fold = 1 + 0.07 * Math.cos(a * 8);
      const x = p.getX(i) * fold * xScale, z = p.getZ(i) * fold * zScale;
      p.setXYZ(i, x, p.getY(i) + y + slope * z, z);
    }
    geo.computeVertexNormals();
    return geo;
  }
  const head = createRenjiHead(h);
  // Reuse the wound-bearing stock mesh; soften only its rendered cloth surface.
  function soften(g, width, height, depth) {
    const geo = new THREE.CylinderGeometry(1, 1, height, 24, 4);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), t = (y / height + .5);
      const waist = .84 + .16 * Math.sin(t * Math.PI * .75);
      p.setXYZ(i, p.getX(i) * width * .5 * waist, y, p.getZ(i) * depth * .5 * waist);
    }
    geo.computeVertexNormals();
    g.children[0].geometry.dispose(); g.children[0].geometry = geo;
  }
  function chest(g) {
    tint(g, INK); soften(g, .26, .29, .34);
    for (const mesh of g.children.slice(1)) mesh.visible = false;
    const l = layer(g);
    // Keep the front plain: irregular near-vertical fabric folds, no X closure.
    addMerged(l,[
      panel(.12,[[.076,-.087],[.074,-.081],[-.119,-.067],[-.12,-.072]]),
      panel(.124,[[.043,.065],[.047,.071],[-.117,.052],[-.12,.047]]),
    ],0x222127,cloth);
    // User's photos: a white horizontal cloth roll at the lower back, bound
    // at its middle, carried by two shoulder straps with straw shoes below.
    const roll=new THREE.CapsuleGeometry(.096,.365,7,24);
    roll.rotateX(Math.PI/2);
    const rp=roll.attributes.position;
    for(let i=0;i<rp.count;i++) {
      const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i);
      const pinch=.85+.15*Math.min(1,Math.abs(z)/.095);
      const crease=1+.025*Math.cos(Math.atan2(y,x)*7+z*11);
      rp.setXYZ(i,-.223+x*pinch*crease,-.265+y*.88*pinch*crease,z);
    }
    roll.computeVertexNormals();
    const pack=addMerged(l,[roll],0xd9d1bb,cloth);pack.name='renji-cloth-bundle';
    const straps=[];
    for(const side of [-1,1]) straps.push(h.isoldeLock([
      [.083,.09,side*.142],[.014,.168,side*.136],[-.103,.15,side*.124],
      [-.217,-.035,side*.079],[-.321,-.211,side*.009],
    ],[.025,.025,.028,.027,.022],.004));
    // Broad shoulder bands form a V on the back; no crossed chest straps.
    addMerged(l,straps,0xc9bea3,cloth);
    const knots=[];
    for(const z of [-.009,0,.009]) knots.push(bake(new THREE.TorusGeometry(.084,.0033,5,24),[-.223,-.265,z],null,[1,.9,1]));
    knots.push(ball(.021,10,7,[-.314,-.211,0]));
    knots.push(panel(-.319,[[-.202,.006],[-.17,.041],[-.184,.056],[-.213,.016]],.007));
    knots.push(panel(-.319,[[-.20,-.005],[-.176,-.043],[-.20,-.051],[-.218,-.012]],.007));
    const folds=[];
    for(const side of [-1,1]) {
      for(const dy of [-.023,.018]) folds.push(line([-.306,-.255+dy,side*.02],[-.31,-.26+dy*1.8,side*.13],.0018));
      knots.push(line([-.318,-.218,0],[-.325,-.427,side*.026],.0032));
    }
    addMerged(l,knots,0xb0a48a,cloth);addMerged(l,folds,0xbeb49c,cloth);
    const soles=[],weave=[],edges=[];
    for(const side of [-1,1]) {
      const cy=-.522+(side===1?.018:0),cz=side*.04;
      soles.push(bake(ball(1,14,10),[-.326,cy,cz],null,[.009,.084,.029]));
      // Visible plaited rim and toe bands distinguish dangling straw sandals.
      for(let i=0;i<28;i++){
        const a=i*Math.PI/14,b=(i+1)*Math.PI/14;
        edges.push(line([-.338,cy+.082*Math.cos(a),cz+.027*Math.sin(a)],[-.338,cy+.082*Math.cos(b),cz+.027*Math.sin(b)],.003,4));
      }
      for(let i=-4;i<=4;i++){
        const dy=i*.015,w=.026*Math.sqrt(Math.max(0,1-(dy/.084)**2));
        weave.push(line([-.34,cy+dy-.005,cz-w],[-.34,cy+dy+.005,cz+w],.0016,4));
      }
      weave.push(line([-.344,cy+.03,cz],[-.344,cy-.013,cz-.024],.004,5));
      weave.push(line([-.344,cy+.03,cz],[-.344,cy-.013,cz+.024],.004,5));
    }
    addMerged(l,soles,0x9e8250,cloth);addMerged(l,edges,0xb49a61,cloth);addMerged(l,weave,0x786440,cloth);
    const scarf = bake(new THREE.TorusGeometry(.086,.034,8,24), [0,.172,0], [Math.PI/2,.12,-.09], [1,1.25,1]);
    const lower = bake(new THREE.TorusGeometry(.088,.027,8,24), [.004,.134,0], [Math.PI/2,-.10,.08], [1,1.3,1]);
    const tail = panel(-.082, [[.169,.052],[.157,.18],[.105,.30],[.035,.40],[-.079,.451],[-.193,.414],
      [-.163,.38],[-.124,.396],[-.14,.362],[-.058,.347],[.026,.267],[.063,.15],[.071,.067]], .008);
    addMerged(l,[scarf,lower,tail,ball(.035,10,7,[-.033,.143,.103])],VIOLET,cloth);
    addMerged(l,[
      panel(-.077,[[.125,.192],[.097,.278],[.016,.359],[-.116,.404],[-.14,.398],[-.035,.353],[.062,.263]],.004),
      bake(new THREE.TorusGeometry(.091,.003,4,24), [.008,.174,0], [Math.PI/2,.12,-.09], [1,1.23,1]),
    ],LIGHT,cloth);
  }
  function abdomen(g) {
    tint(g, INK); soften(g,.234,.145,.294);
    for (const mesh of g.children.slice(1)) mesh.visible = false;
    const l=layer(g);
    const sash = cyl(.164,.157,.071,28,false,[0,-.027,0]);
    sash.scale(.74,1,1);
    addMerged(l,[sash,ball(.033,10,7,[.116,-.025,-.097])],VIOLET,cloth);
    const ridges=[];
    for(const [y,r] of [[-.003,.164],[-.025,.163],[-.050,.159]]) {
      const ring=bake(new THREE.TorusGeometry(r,.0028,4,28),[0,y,0],[Math.PI/2,0,0],[.75,1,1]);
      ridges.push(ring);
    }
    addMerged(l,ridges,LIGHT,cloth);
  }
  function pelvis(g) {
    tint(g, NAVY);
    // Hide only the stock circular tunic skirt, keeping the native pelvis mesh.
    if (g.children[1]?.geometry?.type === 'CylinderGeometry') g.children[1].visible = false;
    const l = layer(g);
    addMerged(l, [pleats(0.167, 0.179, 0.205, -0.024, 0.71, 1),
      panel(0.121, [[0.075, -0.135], [0.075, 0.135], [-0.146, 0.117], [-0.146, -0.117]])], NAVY, doubleCloth);
    addMerged(l, [panel(0.128, [[0.04, -0.067], [0.04, -0.031], [-0.18, -0.035], [-0.216, -0.072]]),
      panel(0.13, [[0.039, -0.025], [0.039, 0.013], [-0.15, 0.024], [-0.18, -0.016]])], VIOLET, cloth);

    // A completely sheathed side sword, built into the pelvis's visual group.
    // It has no weapon registration, collider, blade edge, attack or damage data.
    const sword = new THREE.Group(); sword.name = 'renji-sheathed-sword';
    sword.userData.visualOnly = true; l.add(sword);
    sword.position.set(-0.1, 0.004, -0.195); sword.rotation.z = -1.02;
    addMerged(sword, [bake(cyl(0.018, 0.014, 0.6, 10, false, [0, -0.316, 0]), null, null, [0.66, 1, 1]),
      bake(ball(0.015, 8, 6, [0, -0.614, 0]), null, null, [0.65, 1, 1])], 0x1a1820, cloth);
    addMerged(sword, [cyl(0.014, 0.014, 0.17, 8, false, [0, 0.106, 0]),
      ...[0.044, 0.068, 0.092, 0.116, 0.14, 0.164].map(y => cyl(0.015, 0.015, 0.004, 8, true, [0, y, 0]))], WINE, cloth);
    addMerged(sword, [bake(cyl(0.034, 0.034, 0.007, 12, false, [0, 0.017, 0]), null, null, [0.72, 1, 1]),
      cyl(0.017, 0.017, 0.018, 10, false, [0, -0.008, 0]),
      cyl(0.015, 0.015, 0.008, 8, false, [0, 0.193, 0])], 0x9e8558, { ...cloth, metalness: 0.25, roughness: 0.7 });
    addMerged(l, [line([-0.09, 0.062, -0.173], [-0.117, -0.052, -0.211], 0.006),
      line([-0.13, 0.051, -0.176], [-0.217, -0.06, -0.206], 0.006)], VIOLET, cloth);
  }
  function upperArm(g) {
    tint(g,INK); const l=layer(g);
    addMerged(l,[cyl(.073,.099,.287,20,true,[0,-.015,0])],INK,doubleCloth);
  }
  function forearm(g) {
    tint(g,INK); const l=layer(g);
    // Loose, flared, torn sleeve from the illustration. The narrow cuff/hand
    // remains readable inside it; no changes to the arm, wrist or grip bodies.
    const geo=new THREE.CylinderGeometry(.076,.109,.215,32,6,true);
    const p=geo.attributes.position, colors=[], dark=new THREE.Color(INK), red=new THREE.Color(0x441d28);
    for(let i=0;i<p.count;i++) {
      const x=p.getX(i), y=p.getY(i), z=p.getZ(i), t=(.1075-y)/.215, a=Math.atan2(z,x);
      const edge=Math.pow(t,5)*(.018+.038*(.5+.5*Math.sin(a*5+.4))+.038*Math.max(0,-Math.cos(a)));
      const fold=1+.055*Math.sin(a*6);
      p.setXYZ(i,x*fold,y+.011-edge,z*fold);
      const color=dark.clone().lerp(red,Math.pow(t,3)*.88);colors.push(color.r,color.g,color.b);
    }
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
    addMerged(l,[geo],0xffffff,{...doubleCloth,vertexColors:true});
    addMerged(l,[cyl(.047,.047,.034,12,true,[0,-.103,0])],0x252128,doubleCloth);
  }
  function thigh(g) {
    tint(g, NAVY); const l = layer(g);
    // Native knee is Y=.5: thigh centre .715 gives local knee=-.215.
    // Continue 6cm below that joint, outside the shin's hidden upper overlap.
    addMerged(l, [pleats(0.104, 0.12, 0.52, -0.015, 1.03, 0.94)], NAVY, doubleCloth);
    const seams = [];
    for (const a of [-0.65, 0, 0.65, Math.PI]) {
      const c = Math.cos(a), s = Math.sin(a), fold = 1 + 0.07 * Math.cos(a * 8);
      seams.push(line([0.105 * c * fold * 1.03, 0.237, 0.105 * s * fold * 0.94], [0.121 * c * fold * 1.03, -0.269, 0.121 * s * fold * 0.94], 0.002));
    }
    addMerged(l, seams, FOLD, cloth);
  }
  function shin(g) {
    tint(g,NAVY); const l=layer(g);
    // Preserve the proven knee overlap; widen into the long reference hem.
    const geo=pleats(.114,.144,.4315,.06425,1.03,.94,.14);
    const colors=[], dark=new THREE.Color(NAVY), wine=new THREE.Color(0x401c2b);
    const p=geo.attributes.position;
    for(let i=0;i<p.count;i++) {
      const t=Math.max(0,Math.min(1,(.20-p.getY(i))/.35));
      const c=dark.clone().lerp(wine,Math.pow(t,2)*.83);colors.push(c.r,c.g,c.b);
    }
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    addMerged(l,[geo],0xffffff,{...doubleCloth,vertexColors:true});
    addMerged(l,[pleats(.1445,.146,.014,-.144,1.03,.94,.27)],VIOLET,doubleCloth);
    addMerged(l,[cyl(.053,.05,.057,12,true,[0,-.179,0])],0x30232a,doubleCloth);
  }
  function foot(g) {
    tint(g, 0x232128); const l = layer(g);
    addMerged(l, [box(0.246, 0.015, 0.114, [0, -0.033, 0])], STRAW_DARK, cloth);
    addMerged(l, [line([0.052, 0.041, 0], [-0.027, 0.043, -0.048], 0.007),
      line([0.052, 0.041, 0], [-0.027, 0.043, 0.048], 0.007)], WINE, cloth);
  }
  return { head, chest, abdomen, pelvis, uarmS: upperArm, uarmO: upperArm,
    farmS: forearm, farmO: forearm, thighF: thigh, thighB: thigh,
    shinF: shin, shinB: shin, footF: foot, footB: foot };
}
