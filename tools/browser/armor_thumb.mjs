// 실제 플레이어의 케틀햇만 복제·촬영한다. 무기 섬네일과 같은 조명/256px WebP/투명 배경.
// Vite 개발 서버: node tools/browser/armor_thumb.mjs http://127.0.0.1:5173
import { chromium } from 'playwright';
import fs from 'node:fs';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/usr/bin/chromium', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'] });
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto((process.argv[2] || 'http://127.0.0.1:5173') + '/?test=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.helmetGroup);
  const url = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const model = game.player.helmetGroup.clone(true), scene = new THREE.Scene();
    model.rotation.set(.25, -.45, -.18); scene.add(model);
    scene.add(new THREE.HemisphereLight(0xe3e6e8, 0x716c63, 1.3));
    for (const [color, power, x, y, z] of [[0xffe7cb,1.8,-2,4,6],[0xc8d4e0,.6,3,-1,-2],[0xffffff,1,2.5,1,5]]) {
      const light = new THREE.DirectionalLight(color,power); light.position.set(x,y,z); scene.add(light);
    }
    const box = new THREE.Box3().setFromObject(model), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const half = Math.max(size.x,size.y) * .57;
    const camera = new THREE.OrthographicCamera(-half,half,half,-half,.01,20);
    camera.position.copy(center).add(new THREE.Vector3(0,.15,5)); camera.lookAt(center);
    const renderer = new THREE.WebGLRenderer({ alpha:true, antialias:true, preserveDrawingBuffer:true });
    renderer.setSize(512,512); renderer.setClearColor(0,0); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.render(scene,camera);
    const small = document.createElement('canvas'); small.width = small.height = 256;
    const ctx = small.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(renderer.domElement,0,0,256,256);
    const image = small.toDataURL('image/webp',.86); renderer.dispose(); renderer.forceContextLoss(); return image;
  });
  if (errors.length) throw new Error(errors.join('\n'));
  const dir = new URL('../../public/ui/armor/', import.meta.url); fs.mkdirSync(dir,{recursive:true});
  const data = Buffer.from(url.split(',')[1],'base64'); fs.writeFileSync(new URL('kettle.webp',dir),data);
  console.log(`kettle.webp: ${data.length} bytes, actual player helmet, 256×256 transparent WebP`);
} finally { await browser.close(); }
