import * as T from 'three';
// 겹친 구형 입자 대신 길게 흐르는 불길 한 표면. 길이는 실제 엄폐 사선과 공유한다.
export function createFlame(scene){
 const pos=[],indices=[],rings=24,sides=8;
 for(let i=0;i<=rings;i++)for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2;pos.push(i/rings,Math.cos(a),Math.sin(a));}
 for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,a+1,b+1,b);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(indices);
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:{value:0},flameLength:{value:8}},
 vertexShader:`uniform float time;uniform float flameLength;varying float u;varying float a;void main(){u=position.x;a=atan(position.z,position.y);vec3 p=position;float w=1.0+0.18*sin(u*23.0-time*16.0+a*2.0)+0.12*sin(u*47.0-time*23.0);float r=(0.075+u*0.77)*w;p.x=u*flameLength;p.y*=r;p.z*=r;p.y+=u*u*0.28*sin(u*9.0-time*7.0);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
 fragmentShader:`uniform float time;varying float u;varying float a;void main(){float pulse=sin(u*48.0-time*24.0+a*3.0)*0.5+0.5;float body=0.52+0.48*pulse;float alpha=(1.0-smoothstep(0.72,1.0,u))*body;if(alpha<0.23)discard;vec3 hot=vec3(1.0,0.83,0.37);vec3 tip=vec3(0.94,0.22,0.035);vec3 c=mix(hot,tip,smoothstep(0.0,1.0,u));c=mix(c,vec3(1.0,0.94,0.65),pulse*(1.0-u)*0.32);gl_FragColor=vec4(c,alpha*0.9);\n#include <colorspace_fragment>\n}`});
 const m=new T.Mesh(g,material);m.frustumCulled=false;m.visible=false;scene.add(m);return m;
}
