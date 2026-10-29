import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {buildJulia} from './model.js';
const host=document.querySelector('#model');
try {
const renderer=new T.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x282722);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;host.append(renderer.domElement);
const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.05,20),julia=buildJulia();scene.add(julia.root);
scene.add(new T.HemisphereLight(0xfff2db,0x45443c,2.1));
const key=new T.DirectionalLight(0xffe6c4,3.2);key.position.set(3,5,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-1,right:1,top:2,bottom:-1,near:.1,far:12});key.shadow.bias=-.0005;scene.add(key);
const rim=new T.DirectionalLight(0xc3d3cf,2);rim.position.set(-3,3,-2);scene.add(rim);
const ground=new T.Mesh(new T.CircleGeometry(1.4,64),new T.MeshStandardMaterial({color:0x34312a,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.002;ground.receiveShadow=true;scene.add(ground);
let angle=-.42,close=false,drag=null;const target=new T.Vector3();
function render(){renderer.render(scene,camera);}
function layout(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();const distance=close?1.0:Math.max(3.45,1.75/camera.aspect);target.set(0,close?1.48:.86,0);camera.position.set(Math.cos(angle)*distance,close?1.56:1.13,Math.sin(angle)*distance);camera.lookAt(target);render();}
function setView(v){angle=({front:0,quarter:-.42,rear:Math.PI,side:Math.PI/2})[v]??v;layout();}
host.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX};host.setPointerCapture(e.pointerId);host.focus();});host.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId)return;angle-=(e.clientX-drag.x)*.012;drag.x=e.clientX;layout();});for(const type of ['pointerup','pointercancel','lostpointercapture'])host.addEventListener(type,()=>drag=null);
host.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home'].includes(e.key)){e.preventDefault();angle=e.key==='Home'?0:angle+(e.key==='ArrowLeft'?.15:-.15);layout();}});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.querySelector('#close').onclick=()=>{close=!close;document.querySelector('#close').textContent=close?'전신 보기':'얼굴 확대';layout();};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>{const active=x===b;x.setAttribute('aria-pressed',String(active));document.getElementById(x.dataset.tab+'-panel').style.display=active?'block':'none';});layout();});
new ResizeObserver(layout).observe(host);layout();
window.review={stats:julia.stats,setView,setClose(v){close=v;layout();},root:julia.root,renderer,async exportGLB(){const out=await new GLTFExporter().parseAsync(julia.root,{binary:true});const a=new Uint8Array(out);let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);},bounds(){return new T.Box3().setFromObject(julia.root).getSize(new T.Vector3()).toArray();}};
}catch(e){const el=document.querySelector('#error');el.style.display='block';el.textContent='3D 보기를 열지 못했습니다. 전신 스케치와 프로필 탭을 이용해 주세요.';console.error(e);}
