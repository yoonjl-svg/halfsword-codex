// East-Siberian inland lake, winter predawn. Visual ice only: no physics changes.
import * as THREE from 'three';
import { Kit, canvasTex, rng } from './stage_kit.js';
import { buildFrozenBayShore } from './stage_frozen_bay_shore.js';

function iceTexture() {
  const r = rng(101071);
  const tex = canvasTex(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#325568'; ctx.fillRect(0, 0, w, h);
    // Broad cloudy frost and stretched crystal grain; cracks are separate geometry.
    for (let i = 0; i < 145; i++) {
      const x = r() * w, y = r() * h, rad = 20 + r() * 145;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, i % 3 ? 'rgba(191,218,224,.10)' : 'rgba(5,24,39,.16)');
      grad.addColorStop(1, 'rgba(130,163,180,0)'); ctx.fillStyle = grad;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 2300; i++) {
      ctx.strokeStyle = `rgba(198,224,230,${.015 + r() * .045})`;
      ctx.lineWidth = .4 + r() * 1.1; const x = r() * w, y = r() * h;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4 + r() * 40, y + 1 + r() * 7); ctx.stroke();
    }
  });
  tex.repeat.set(12, 12);
  return tex;
}

function iceDetails(scene) {
  const k = new Kit(101033), r = rng(100879);
  const ribbon = (bin, a, b, width, y, color) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], d = Math.hypot(dx, dz);
    if (d < .001) return;
    const x = -dz / d * width / 2, z = dx / d * width / 2;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      a[0]-x,y,a[1]-z, b[0]-x,y,b[1]-z, a[0]+x,y,a[1]+z,
      b[0]-x,y,b[1]-z, b[0]+x,y,b[1]+z, a[0]+x,y,a[1]+z,
    ], 3));
    g.computeVertexNormals(); k.put(bin, g, color); g.dispose();
  };
  const fracture = (x, z, angle, steps, length, width, branch = true) => {
    for (let i = 0; i < steps; i++) {
      angle += (r() - .5) * .7;
      const b = [x + Math.cos(angle) * length * (.65 + r() * .7), z + Math.sin(angle) * length * (.65 + r() * .7)];
      ribbon('crackDepth', [x+.035,z+.023], [b[0]+.035,b[1]+.023], width * 4, .004, 0x142e41);
      ribbon('crack', [x,z], b, width, .008, 0xb2cbd5);
      if (branch && i % 4 === 2) fracture(x, z, angle + (r() > .5 ? 1 : -1) * .8, 3, length * .5, width * .55, false);
      [x,z] = b;
    }
  };
  fracture(-18, -10, .62, 17, 2.1, .026);
  fracture(-16, 9, -.38, 14, 2.4, .02);
  fracture(3, -23, 1.28, 20, 2.2, .018);
  fracture(17, -16, 1.8, 16, 2.5, .027);
  // Subdued, layered circles resemble bubbles trapped beneath clear ice, not snowflakes.
  const disk = new THREE.CircleGeometry(1, 10); disk.rotateX(-Math.PI / 2);
  for (let cluster = 0; cluster < 30; cluster++) {
    const x = (r() - .5) * 36, z = (r() - .5) * 36;
    for (let n = 0; n < 4; n++) {
      const radius = .02 + r() * .065;
      k.put('bubble', disk, n % 2 ? 0x668eaa : 0x759cae,
        [x + (r()-.5)*.6, .006, z + (r()-.5)*.65], undefined, [radius, 1, radius * .85]);
    }
  }
  disk.dispose();
  for (const name of ['crackDepth', 'crack', 'bubble']) {
    const mesh = k.mesh(name, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .48, side: THREE.DoubleSide }));
    mesh.name = `frozen-bay-${name}`; scene.add(mesh);
  }
  for (const bin of Object.values(k.bins)) for (const g of bin) g.dispose();
}

function dawnSky(scene) {
  const tex = canvasTex(8, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0, '#182b49'); g.addColorStop(.35, '#354a67');
    g.addColorStop(.47, '#85909c'); g.addColorStop(.50, '#c8a7a9');
    g.addColorStop(.535, '#9eafb9'); g.addColorStop(1, '#8195a5');
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(240, 32, 16), new THREE.MeshBasicMaterial({
    map: tex, side: THREE.BackSide, depthWrite: false, fog: false,
  }));
  sky.name = 'frozen-bay-dawn'; scene.add(sky);
}

export function buildFrozenBay(scene, { hemi, sun }) {
  scene.background = new THREE.Color(0x8b9dab);
  scene.fog = new THREE.Fog(0x91a3b1, 62, 205);
  hemi.color.setHex(0xb4cde6); hemi.groundColor.setHex(0x41566b); hemi.intensity = 1.9;
  sun.color.setHex(0xf0c4b7); sun.intensity = .85;
  const sunOffset = { x: 18, y: 5, z: -10 };
  dawnSky(scene);
  const ice = new THREE.Mesh(new THREE.CircleGeometry(205, 80), new THREE.MeshStandardMaterial({
    color: 0xffffff, map: iceTexture(), roughness: .62, metalness: .02,
  }));
  ice.rotation.x = -Math.PI / 2; ice.receiveShadow = true; ice.name = 'frozen-bay-ice'; scene.add(ice);
  iceDetails(scene);
  const shore = buildFrozenBayShore(scene);
  const r = rng(101073); let time = 0, nextIce = 7, nextPier = 19;
  const stage = {
    sunOffset,
    fighterLight: { color: 0xc8dbed, rimColor: 0xe7c8cf, rim: 1.1, level: .55 },
    stats: shore.stats,
    excite() {}, // Combat impacts must not manufacture thermal ice cracks or booms.
    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      time += Math.min(dt, .1);
      if (time >= nextIce) {
        stage.onEvent?.('stageDetail', { kind: 'lakeIceBoom', amp: .85, pos: { x: 40, y: 0, z: -5 }, seed: 10071, time });
        nextIce = time + 31 + r() * 16;
      }
      if (time >= nextPier) {
        stage.onEvent?.('stageDetail', { kind: 'frozenPierCreak', amp: .68, pos: shore.pierPos, seed: 10073, time });
        nextPier = time + 28 + r() * 14;
      }
    },
  };
  return stage;
}
