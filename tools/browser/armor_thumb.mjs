// 대기실 방어구 칸 섬네일 (샛별 저장소 armor_thumb.mjs — public/ui/armor/kettle.webp 를 만든 도구): 실제 플레이어의 케틀햇만 복제·촬영한다.
//  무기 섬네일과 같은 조명 · 256px WebP · 투명 바탕. 플레이어 겉모습(looks.js helmet)이 바뀌면 다시 돌린다.
//  개발 서버(npx vite --port 5202): node tools/browser/armor_thumb.mjs http://127.0.0.1:5202 [저장 파일 — 기본 public/ui/armor/kettle.webp]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const size = Math.max(256, Math.min(1024, Number(process.argv[4]) || 256));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'] });
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto((process.argv[2] || 'http://127.0.0.1:5202') + '/?test=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.helmetGroup, null, { timeout: 60000 });
  const url = await page.evaluate(async (size) => {
    const THREE = window.game.THREE;
    const model = game.player.helmetGroup.clone(true), scene = new THREE.Scene();
    model.rotation.set(.25, -.45, -.18); scene.add(model);
    scene.add(new THREE.HemisphereLight(0xe3e6e8, 0x716c63, 1.3));
    for (const [color, power, x, y, z] of [[0xffe7cb,1.8,-2,4,6],[0xc8d4e0,.6,3,-1,-2],[0xffffff,1,2.5,1,5]]) {
      const light = new THREE.DirectionalLight(color,power); light.position.set(x,y,z); scene.add(light);
    }
    const box = new THREE.Box3().setFromObject(model), center = box.getCenter(new THREE.Vector3()), extent = box.getSize(new THREE.Vector3());
    const half = Math.max(extent.x,extent.y) * .57;
    const camera = new THREE.OrthographicCamera(-half,half,half,-half,.01,20);
    camera.position.copy(center).add(new THREE.Vector3(0,.15,5)); camera.lookAt(center);
    const renderer = new THREE.WebGLRenderer({ alpha:true, antialias:true, preserveDrawingBuffer:true });
    renderer.setSize(size*2,size*2); renderer.setClearColor(0,0); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.render(scene,camera);
    const small = document.createElement('canvas'); small.width = small.height = size;
    const ctx = small.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(renderer.domElement,0,0,size,size);
    const image = small.toDataURL('image/webp',size>256?.94:.86); renderer.dispose(); renderer.forceContextLoss(); return image;
  }, size);
  if (errors.length) throw new Error(errors.join('\n'));
  const file = path.resolve(process.argv[3] || new URL('../../public/ui/armor/kettle.webp', import.meta.url).pathname);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const data = Buffer.from(url.split(',')[1],'base64'); fs.writeFileSync(file, data);
  console.log(`${file}: ${data.length} bytes, actual player helmet, ${size}×${size} transparent WebP`);
} finally { await browser.close(); }
