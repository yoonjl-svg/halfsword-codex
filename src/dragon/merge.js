import { Mesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
/** 움직이는 관절 그룹은 유지하고 그 안의 같은 재질 조각만 합쳐 모바일 드로콜을 줄인다. */
export function mergeStaticPieces(group) {
  for(const c of [...group.children])if(c.isGroup)mergeStaticPieces(c);
  const sets=new Map();
  for(const c of group.children)if(c.isMesh&&!c.isInstancedMesh&&!Array.isArray(c.material)){
    if(!sets.has(c.material))sets.set(c.material,[]);sets.get(c.material).push(c);
  }
  for(const [mat,parts]of sets) {
    if(parts.length<2)continue;
    const geos=parts.map(m=>{m.updateMatrix();const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();return g.applyMatrix4(m.matrix);});
    const geo=mergeGeometries(geos,false);for(const g of geos)g.dispose();if(!geo)continue;
    const m=new Mesh(geo,mat);m.castShadow=parts.some(p=>p.castShadow);m.receiveShadow=parts.some(p=>p.receiveShadow);
    for(const p of parts)group.remove(p);group.add(m);
  }
}
