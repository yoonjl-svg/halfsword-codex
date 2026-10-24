import * as T from 'three';
import { mergeStaticPieces } from './merge.js';
// 고정형 전장: 장면 전체를 그림자용으로 한 번 더 그리지 않고 접지 그림자를 쓴다.
export function groundShadows(scene,covers){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(32,32,4,32,32,32);g.addColorStop(0,'rgba(0,0,0,.65)');g.addColorStop(.48,'rgba(0,0,0,.4)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
 const texture=new T.CanvasTexture(canvas),material=new T.MeshBasicMaterial({map:texture,transparent:true,opacity:.56,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
 const group=new T.Group();scene.add(group);
 function ellipse(parent,x,z,w,h,mat=material){const m=new T.Mesh(new T.PlaneGeometry(1,1),mat);m.rotation.x=-Math.PI/2;m.position.set(x,.041,z);m.scale.set(w,h,1);parent.add(m);return m;}
 ellipse(group,7.2,0,8,5.6);ellipse(group,4.6,-1.9,1.8,1.4);ellipse(group,4.6,1.9,1.8,1.4);
 for(const c of covers)ellipse(group,c.x+.25,c.z-.2,c.r*3.6,c.r*3.1);
 mergeStaticPieces(group);
 const player=ellipse(scene,0,0,1.3,.9,material.clone()),head=ellipse(scene,0,0,2.5,1.8,material.clone());
 return{dispose(){texture.dispose();},update(f,d){const p=f.bodies.pelvis.translation();player.position.x=p.x;player.position.z=p.z;player.material.opacity=f.alive?.62:.45;const h=d.model.pose.head;head.position.x=h.x;head.position.z=h.z;head.material.opacity=Math.max(.16,.5-h.y*.085);head.scale.set(2.1+h.y*.2,1.4+h.y*.13,1);}};
}
