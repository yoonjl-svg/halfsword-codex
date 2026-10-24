import { Mesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
/** 움직이는 관절 그룹은 유지하고 그 안의 같은 재질 조각만 합쳐 모바일 드로콜을 줄인다. */
export function mergeStaticPieces(group) {
  for(const c of [...group.children])if(c.isGroup)mergeStaticPieces(c);
  const sets=new Map();
  for(const c of group.children)if(c.isMesh&&!c.isInstancedMesh&&!Array.isArray(c.material)){
    const key=c.material.uuid+':'+c.castShadow+':'+c.receiveShadow;if(!sets.has(key))sets.set(key,[]);sets.get(key).push(c);
  }
  for(const parts of sets.values()) {
    const mat=parts[0].material;
    if(parts.length<2)continue;
    const geos=parts.map(m=>{m.updateMatrix();const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();return g.applyMatrix4(m.matrix);});
    const geo=mergeGeometries(geos,false);for(const g of geos)g.dispose();if(!geo)continue;
    const m=new Mesh(geo,mat);m.castShadow=parts.some(p=>p.castShadow);m.receiveShadow=parts.some(p=>p.receiveShadow);
    for(const p of parts)group.remove(p);group.add(m);
  }
}
