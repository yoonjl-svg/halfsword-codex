import * as T from 'three';
import {canvasTex,rng} from './stage_kit.js';
import {springRain} from './stage_clearing.js';
import {createWetlandStorm} from './wetland_storm.js';

// One opaque, slowly turning sky texture. No extra shadow light or volume pass.
function overcastTexture(){
  const r=rng(164081),grid=Array.from({length:64*32},r);
  const smooth=x=>x*x*(3-2*x),lerp=(a,b,t)=>a+(b-a)*t;
  const noise=(x,y,period)=>{const i=Math.floor(x),j=Math.floor(y),u=smooth(x-i),v=smooth(y-j),at=(a,b)=>grid[((b%32+32)%32)*64+(a%period+period)%period];return lerp(lerp(at(i,j),at(i+1,j),u),lerp(at(i,j+1),at(i+1,j+1),u),v)};
  return canvasTex(256,128,(g,w,h)=>{
    const image=g.createImageData(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      let n=0,k=.54;for(let o=0;o<5;o++){n+=noise(x/w*4*2**o,y/h*3*2**o,4*2**o)*k;k*=.5}
      const c=14+Math.pow(n,1.65)*65,at=(y*w+x)*4;
      image.data.set([c*.86,c*.95,c,255],at);
    }
    g.putImageData(image,0,0);
  });
}

export function addSluiceWeather(scene,lights,root,stage,original){
  const storm=createWetlandStorm();stage.weather=storm.state;root.userData.weather=storm.state;
  stage.sunOffset={x:-8,y:14,z:-9};
  stage.fighterLight={color:0xb8c6d2,rimColor:0x9caebb,level:.30,rim:.65,weatherDim:.30};
  const dark=new T.Color(0x070b10),litFog=new T.Color(0x283442);
  scene.background=dark.clone();scene.fog=new T.Fog(dark,14,100);
  lights.hemi.color.set(0x9aaabb);lights.hemi.groundColor.set(0x20232c);lights.sun.color.set(0xd9e4f2);
  // The builder already omits day sunshafts. Dim its self-lit puddles as well.
  const dimmed=new Set();
  for(const object of original)object.traverse(o=>{
    for(const m of Array.isArray(o.material)?o.material:[o.material])if(m&&!dimmed.has(m)){
      dimmed.add(m);if(m.emissiveIntensity)m.emissiveIntensity*=.08;
    }
  });
  const material=new T.MeshBasicMaterial({map:overcastTexture(),side:T.BackSide,depthWrite:false,fog:false});
  const sky=new T.Mesh(new T.SphereGeometry(510,32,16),material);sky.name='wetland-overcast-sky';root.add(sky);
  const rain=springRain(root,{n:850,seed:164082,size:.14,opacity:.17,speedScale:.65,windScale:.16,color:0x8296a4});
  const drops=root.getObjectByName('rain-particles');drops.name='wetland-mist-drizzle';
  const old=stage.update.bind(stage);
  const apply=()=>{const f=storm.state.flash;
    lights.hemi.intensity=.17+f*.48;lights.sun.intensity=.025+f*5.0;
    stage.fighterLight.weatherDim=.30+f*.70;
    material.color.setScalar(.18+f*4.5);scene.fog.color.copy(dark).lerp(litFog,f);
    drops.material.opacity=.17+f*.10;
  };
  stage.update=dt=>{
    old(dt);const step=Math.min(.1,Math.max(0,Number.isFinite(dt)?dt:0));if(!step)return;
    storm.update(step,e=>{if(e.type==='thunder')stage.onEvent?.('stageDetail',{kind:'wetlandThunder',amp:e.amp,seed:e.group,time:e.at});});
    rain(step,storm.state.time,0);sky.rotation.y=storm.state.time*.0015;apply();
  };
  apply();
}
