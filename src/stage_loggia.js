// A late-afternoon Italian fencing courtyard. The fighting surface is completely
// flat; architecture begins beyond the camera's 10.5 m orbit. All resources are
// owned by scene children so Stages.clear() can release the whole stage.
import * as THREE from 'three';
import { ARENA } from './config.js';
import { Kit, box, cyl, canvasTex, rng, h3 } from './stage_kit.js';

const PALETTE = {
  ivory: 0xe8d8b7,
  light: 0xf7e9cb,
  sand: 0xc1aa84,
  trim: 0xa18b6d,
  indigo: 0x313b58,
  recess: 0x222b43,
  burgundy: 0x7b273a,
  gold: 0xc4a06a,
  roof: 0xa9543c,
  green: 0x2e4739,
  // 10/10 2차: Bologna's portico red — red-ochre plaster and brick behind pale stone columns.
  plaster: 0xb35d3e,
  plasterShade: 0x8c4a34,
  brick: 0x9c5236,
  libertasBlue: 0x24365f,
};

function plasterTexture() {
  const random = rng(9109);
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f5f0e4';
    ctx.fillRect(0, 0, w, h);
    // Travertine pores: restrained enough to keep the long architectural lines.
    for (let i = 0; i < 2200; i++) {
      ctx.fillStyle = `rgba(111,92,63,${0.015 + random() * 0.075})`;
      ctx.fillRect(random() * w, random() * h, 1 + random() * 6, 0.4 + random());
    }
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = 'rgba(146,125,94,0.035)';
      ctx.fillRect(0, random() * h, w, 1 + random() * 2);
    }
  });
}

// 결투장 바닥 (10/10 다듬기): 싸움이 먼저 읽히도록 무늬는 돌 색에 가깝게(명도 차 몇 %), 선은 굵고 성기게.
//  결투장 안(반지름 6.5m — 두 사람이 서는 곳)은 큰 판석의 옅은 이음매뿐이고, 나침반은 바깥 고리(7~10m)로 밀어냈다.
//  해가 낮게 드는 오후라 남쪽 회랑과 서쪽 난간의 긴 그림자를 sunOffset 방향 그대로 바닥에 구워 넣는다(그림자 지도는 두 사람 둘레 ±4m 만 그린다).
//  canvas 의 y 는 월드 z 와 같다(PlaneGeometry 를 -90° 눕히고 CanvasTexture 가 위아래를 뒤집으므로).
const PAVE = {
  field: ['#e2d5ba', '#dbcdb1', '#e5d8bd', '#ded1b5'], // 바깥 판석 네 가지 (명도 차 ~4%)
  ring: ['#e1d4b9', '#dacdb1', '#e4d7bc'], // 결투장 안 판석
  band: '#d1c2a5', // 테두리 띠
  rayA: '#c9b797', rayB: '#d3c3a4', // 나침반 살 두 면 (바탕보다 8~12% 어둡다 — 결투장 밖이라 조금 더 보이게)
  joint: 'rgba(110,98,76,0.24)', // 이음매: 굵고(3.5cm) 옅게
};
function pavingTexture(sunOffset) {
  const random = rng(6121);
  const N = 1024;
  const unit = N / 30;
  return canvasTex(N, N, (ctx, w, h) => {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(unit, unit);
    const path = (points) => {
      ctx.beginPath();
      points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.closePath();
    };
    const polygon = (points, color, joint = true) => {
      path(points);
      ctx.fillStyle = color;
      ctx.fill();
      if (!joint) return;
      ctx.strokeStyle = PAVE.joint;
      ctx.lineWidth = 0.035;
      ctx.stroke();
    };
    // Each slab: a faint broad mineral cloud, never a thin bright vein.
    const grain = (x, y, bw, bh) => {
      const r = Math.max(bw, bh) * (0.4 + random() * 0.5);
      const cx = x + random() * bw, cy = y + random() * bh;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, random() < 0.5 ? 'rgba(120,108,80,0.05)' : 'rgba(255,248,226,0.07)');
      g.addColorStop(1, 'rgba(120,108,80,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    };
    const radial = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
    const sector = (inner, outer, start, end, color, joint = true) => {
      const points = [];
      const steps = Math.max(2, Math.ceil((end - start) * outer / 0.35));
      for (let j = 0; j <= steps; j++) points.push(radial(outer, start + (end - start) * j / steps));
      for (let j = steps; j >= 0; j--) points.push(radial(inner, start + (end - start) * j / steps));
      polygon(points, color, joint);
    };
    const ringOf = (inner, outer, count, colors, phase = 0) => {
      for (let j = 0; j < count; j++) {
        const a0 = phase + j * Math.PI * 2 / count, a1 = phase + (j + 1) * Math.PI * 2 / count;
        sector(inner, outer, a0, a1, colors[Math.floor(random() * colors.length)]);
      }
    };

    // ① Outer field: 1.5 m slabs in running bond (was 1.07 m checker + green cabochons).
    for (let row = 0; row < 20; row++) {
      const y = -15 + row * 1.5;
      for (let x = -15 - (row % 2) * 0.75; x < 15; x += 1.5) {
        polygon([[x, y], [x + 1.5, y], [x + 1.5, y + 1.5], [x, y + 1.5]], PAVE.field[Math.floor(random() * 4)]);
        grain(x, y, 1.5, 1.5);
      }
    }
    // ② A broad square frame, one band and sparse diamonds every 3 m.
    ctx.strokeStyle = PAVE.band;
    ctx.lineWidth = 0.42;
    ctx.strokeRect(-11.1, -11.1, 22.2, 22.2);
    for (let side = 0; side < 4; side++) {
      ctx.save();
      ctx.rotate(side * Math.PI / 2);
      for (let j = -9; j <= 9; j += 3) polygon([[j - 0.42, -11.1], [j, -11.38], [j + 0.42, -11.1], [j, -10.82]], j % 2 ? PAVE.rayB : PAVE.rayA);
      ctx.restore();
    }
    for (const [x, y] of [[-11.1, -11.1], [11.1, -11.1], [11.1, 11.1], [-11.1, 11.1]]) {
      polygon([[x - 0.75, y], [x, y - 0.75], [x + 0.75, y], [x, y + 0.75]], PAVE.rayA);
      polygon([[x - 0.42, y], [x, y - 0.42], [x + 0.42, y], [x, y + 0.42]], PAVE.rayB);
    }
    // ③ The round floor. Inside the duel radius: plain concentric slabs only.
    ringOf(9.0, 9.4, 48, [PAVE.band]);
    ringOf(7.05, 9.0, 40, PAVE.ring, 0.04);
    ringOf(6.7, 7.05, 32, [PAVE.band]);
    ringOf(5.0, 6.7, 26, PAVE.ring, 0.07);
    ringOf(3.3, 5.0, 18, PAVE.ring, 0.11);
    ringOf(1.5, 3.3, 10, PAVE.ring, 0.2);
    sector(0, 1.5, 0, Math.PI * 2, '#dbcdb1');
    for (let j = 0; j < 36; j++) {
      const a = random() * Math.PI * 2, r = 0.8 + random() * 8.2;
      grain(Math.cos(a) * r - 0.9, Math.sin(a) * r - 0.9, 1.8, 1.8);
    }
    // ④ The compass, pushed out to the outer ring (7.1–9.9 m): eight long and
    //    eight short broad rays, two close tones each, no fine lines.
    for (let j = 0; j < 16; j++) {
      const a = j * Math.PI / 8;
      const long = j % 2 === 0;
      const r0 = 7.12, r1 = long ? 9.95 : 8.85, rm = long ? 7.95 : 7.75, half = long ? 0.12 : 0.085;
      const tip = radial(r1, a), root = radial(r0, a);
      polygon([root, radial(rm, a - half), tip], PAVE.rayA, false);
      polygon([root, tip, radial(rm, a + half)], PAVE.rayB, false);
    }

    // ④' 양각·음각 (10/10 2차): same stone colour, relief only — each motif is
    //    drawn as a pair of strokes offset toward and away from the sun
    //    (sunOffset), so the lit and shaded lips read as carving (±4~7%).
    //    Groove (음각): the lip nearer the sun is in shadow. Raised (양각): lit.
    const toward = Math.hypot(sunOffset.x, sunOffset.z);
    const tx = sunOffset.x / toward * 0.03, ty = sunOffset.z / toward * 0.03;
    const HI = 'rgba(255,250,236,0.32)', LO = 'rgba(72,52,36,0.1)';
    const relief = (draw, raised = false, k = 1, width = 0.07) => {
      for (const [sgn, col] of [[1, raised ? HI : LO], [-1, raised ? LO : HI]]) {
        ctx.save();
        ctx.translate(tx * sgn, ty * sgn);
        ctx.globalAlpha = k;
        ctx.strokeStyle = ctx.fillStyle = col;
        ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        draw();
        ctx.restore();
      }
    };
    const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); };
    // (a) Outer slabs, chequerwise: a circle with a square set in it — the plain
    //     Renaissance 'circle and square' pavement figure. Grooves.
    for (let row = 0; row < 20; row++) {
      const y = -15 + row * 1.5 + 0.75;
      for (let x = -15 - (row % 2) * 0.75 + 0.75, col = 0; x < 15; x += 1.5, col++) {
        if ((row + col) % 2 || Math.hypot(x, y) < 10.15 || Math.abs(Math.max(Math.abs(x), Math.abs(y)) - 11.1) < 0.8) continue;
        relief(() => {
          circle(x, y, 0.5);
          ctx.beginPath(); ctx.moveTo(x, y - 0.5); ctx.lineTo(x + 0.5, y); ctx.lineTo(x, y + 0.5); ctx.lineTo(x - 0.5, y); ctx.closePath(); ctx.stroke();
        }, false, 1, 0.06);
      }
    }
    // (b) The square frame: a raised running guilloche (two interlaced waves).
    for (let side = 0; side < 4; side++) {
      relief(() => {
        ctx.rotate(side * Math.PI / 2);
        for (const ph of [0, Math.PI]) {
          ctx.beginPath();
          for (let t = -10.9; t <= 10.9; t += 0.05) ctx.lineTo(t, -11.1 + Math.sin(t * Math.PI * 2 + ph) * 0.12);
          ctx.stroke();
        }
      }, true, 1, 0.045);
    }
    // (c) The inscription band (9.0–9.4 m): the guards of Achille Marozzo's
    //     Opera Nova (Bologna, 1536), cut in Roman capitals, between two raised fillets.
    relief(() => { circle(0, 0, 8.98); circle(0, 0, 9.42); }, true, 1, 0.04);
    const words = 'CODA LVNGA E STRETTA · PORTA DI FERRO STRETTA · GVARDIA ALTA · GVARDIA DI TESTA · GVARDIA DI FACCIA · CINGHIARA PORTA DI FERRO · BECCA CESA · BECCA POSSA · GVARDIA D\'INTRARE · CODA LVNGA E ALTA · OPERA NOVA · BOLOGNA MDXXXVI · ';
    relief(() => {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < words.length; i++) {
        const a = -Math.PI / 2 + i / words.length * Math.PI * 2;
        ctx.save();
        ctx.translate(Math.cos(a) * 9.2, Math.sin(a) * 9.2);
        ctx.rotate(a + Math.PI / 2);
        ctx.scale(0.01, 0.01);
        ctx.font = 'bold 25px serif';
        ctx.fillText(words[i], 0, 0);
        ctx.restore();
      }
    }, false, 1);
    // (d) Corner medallions: the cross of the city arms, raised in a ring.
    for (const [x, y] of [[-11.1, -11.1], [11.1, -11.1], [11.1, 11.1], [-11.1, 11.1]]) {
      relief(() => {
        circle(x, y, 0.3);
        ctx.beginPath(); ctx.moveTo(x - 0.2, y); ctx.lineTo(x + 0.2, y); ctx.moveTo(x, y - 0.2); ctx.lineTo(x, y + 0.2); ctx.stroke();
      }, true, 1, 0.05);
    }
    // (e) The duel centre, barely there: a ring and two interlaced squares.
    relief(() => {
      circle(0, 0, 1.22);
      for (const rot of [0, Math.PI / 4]) {
        ctx.beginPath();
        for (let k = 0; k < 4; k++) { const a = rot + k * Math.PI / 2; ctx.lineTo(Math.cos(a) * 1.08, Math.sin(a) * 1.08); }
        ctx.closePath(); ctx.stroke();
      }
    }, false, 0.5, 0.05);

    // ⑤ Age: broad soft mottling, foot-worn lighter middle, dusty darker edges.
    for (let i = 0; i < 70; i++) {
      const x = (random() - 0.5) * 29, y = (random() - 0.5) * 29;
      const r = 0.8 + random() * 3.2;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, i % 3 ? `rgba(104,92,66,${0.04 + random() * 0.05})` : `rgba(250,240,214,${0.05 + random() * 0.05})`);
      g.addColorStop(1, 'rgba(104,92,66,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const worn = ctx.createRadialGradient(0, 0, 1, 0, 0, 7.5);
    worn.addColorStop(0, 'rgba(250,242,220,0.10)');
    worn.addColorStop(1, 'rgba(250,242,220,0)');
    ctx.fillStyle = worn;
    ctx.fillRect(-8, -8, 16, 16);
    for (let side = 0; side < 4; side++) {
      ctx.save();
      ctx.rotate(side * Math.PI / 2);
      const dust = ctx.createLinearGradient(0, 12.6, 0, 15);
      dust.addColorStop(0, 'rgba(92,82,60,0)');
      dust.addColorStop(1, 'rgba(92,82,60,0.16)');
      ctx.fillStyle = dust;
      ctx.fillRect(-15, 12.6, 30, 2.4);
      ctx.restore();
    }
    for (let i = 0; i < 420; i++) {
      const x = (random() - 0.5) * 30, y = (random() - 0.5) * 30, s = 0.05 + random() * 0.1;
      ctx.fillStyle = i % 3 ? 'rgba(96,86,62,0.07)' : 'rgba(255,246,222,0.08)';
      ctx.fillRect(x, y, s, s * (0.5 + random() * 0.6));
    }
    ctx.restore();

    // ⑥ Long afternoon shadows in the sun direction, plus the shade under the
    //    roofs. Exact rays against two solids: the south arcade (front plane
    //    z = 14.3, solid to its 7.3 m cornice because the rear wall closes the
    //    arches to such a low sun) and the west balustrade (x = -14.6).
    const img = ctx.getImageData(0, 0, w, h);
    const px = img.data;
    const { x: sx, y: sy, z: sz } = sunOffset;
    const soft = (v, width) => THREE.MathUtils.smoothstep(v, -width, width);
    for (let j = 0; j < h; j++) {
      const z = (j + 0.5) / unit - 15;
      for (let i = 0; i < w; i++) {
        const x = (i + 0.5) / unit - 15;
        let lit = 1;
        const m = Math.max(Math.abs(z), x > 0 && Math.abs(z) > 4.9 ? x : 0);
        if (m > 14.3) lit = 0.56; // under a roof
        if (sz > 0 && z < 14.3 && z > 14.3 - sz / sy * 7.6) {
          const t = (14.3 - z) / sz, hgt = sy * t, xa = x + sx * t;
          const pen = 0.12 + 0.035 * hgt;
          lit = Math.min(lit, 1 - 0.5 * soft(7.3 - hgt, pen) * soft(10.7 - Math.abs(xa), pen));
        }
        if (sx < 0 && x > -14.6 && x < -14.6 - sx / sy * 1.6) {
          const t = (-14.6 - x) / sx, hgt = sy * t, za = z + sz * t;
          const pen = 0.06 + 0.03 * hgt;
          // plinth and coping are solid; between them the balusters let half through
          const solid = Math.max(soft(0.19 - hgt, pen), soft(hgt - 1.15, pen) * soft(1.35 - hgt, pen));
          const shade = Math.max(solid, 0.5 * soft(1.15 - hgt, pen));
          lit = Math.min(lit, 1 - 0.48 * shade * soft(12.75 - Math.abs(za), pen));
        }
        if (lit < 1) {
          const k = (j * w + i) * 4;
          px[k] *= lit; px[k + 1] *= lit * 1.01; px[k + 2] *= Math.min(1.08, lit * 1.06);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

function skyTexture() {
  const random = rng(231);
  return canvasTex(512, 256, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    // Late-autumn dusk: violet-blue overhead, rose, then an amber band at the horizon.
    sky.addColorStop(0, '#4f5b86');
    sky.addColorStop(0.26, '#7f7fa6');
    sky.addColorStop(0.4, '#c98f8c');
    sky.addColorStop(0.47, '#eba06c');
    sky.addColorStop(0.51, '#f3bf7c');
    sky.addColorStop(0.58, '#b98c74');
    sky.addColorStop(1, '#8f7a6c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = random() * w;
      const y = 55 + random() * 45;
      const cloud = ctx.createRadialGradient(x, y, 0, x, y, 55);
      cloud.addColorStop(0, i % 3 ? 'rgba(255,170,120,0.2)' : 'rgba(120,96,128,0.18)');
      cloud.addColorStop(1, 'rgba(255,170,120,0)');
      ctx.fillStyle = cloud;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.16);
      ctx.translate(-x, -y);
      ctx.fillRect(x - 60, y - 60, 120, 120);
      ctx.restore();
    }
  });
}

// Banner atlas, three 128×384 columns (top of canvas = top of banner):
//  0 · the city arms of Bologna — quarterly, 1st and 4th white with a red cross,
//      2nd and 3rd blue with LIBERTAS in gold on a bend, under a blue chief with
//      gold lilies and a red label (the chief of Anjou); a red tail below.
//  1 · a blue banner with LIBERTAS in gold, red head band.
//  2 · the fencing school's red banner with crossed gold swords.
function bannerTexture() {
  return canvasTex(384, 384, (ctx) => {
    const W = 128, H = 384;
    const gold = '#d8b25e', red = '#9d2a2f', white = '#efe7d6', blue = '#24365f';
    const border = (x0) => {
      ctx.strokeStyle = gold; ctx.lineWidth = 6; ctx.strokeRect(x0 + 5, 5, W - 10, H - 10);
      ctx.fillStyle = gold; ctx.fillRect(x0, 0, W, 16); // hanging sleeve
    };
    const libertas = (cx, cy, size, angle) => {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle);
      ctx.fillStyle = gold; ctx.font = `bold ${size}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('LIBERTAS', 0, 0);
      ctx.restore();
    };
    // 0: arms
    {
      const x0 = 0, top = 16, q = W / 2, qh = 104;
      ctx.fillStyle = red; ctx.fillRect(x0, 0, W, H);
      for (const [ix, iy] of [[0, 0], [1, 1]]) {
        ctx.fillStyle = white; ctx.fillRect(x0 + ix * q, top + iy * qh, q, qh);
        ctx.fillStyle = red; ctx.fillRect(x0 + ix * q + q / 2 - 6, top + iy * qh, 12, qh); ctx.fillRect(x0 + ix * q, top + iy * qh + qh / 2 - 6, q, 12);
      }
      for (const [ix, iy] of [[1, 0], [0, 1]]) {
        const x = x0 + ix * q, y = top + iy * qh;
        ctx.fillStyle = blue; ctx.fillRect(x, y, q, qh);
        ctx.fillStyle = '#2d4378'; ctx.fillRect(x, y, q, 22); // chief
        ctx.fillStyle = gold; for (let k = 0; k < 3; k++) ctx.fillRect(x + 9 + k * 18, y + 6, 6, 8);
        ctx.fillStyle = red; ctx.fillRect(x + 4, y + 16, q - 8, 3); // label
        ctx.save(); ctx.beginPath(); ctx.rect(x, y + 22, q, qh - 22); ctx.clip();
        libertas(x + q / 2, y + 22 + (qh - 22) / 2, 12, -0.9);
        ctx.restore();
      }
      ctx.fillStyle = gold; ctx.fillRect(x0, top + 2 * qh, W, 5);
      border(x0);
    }
    // 1: blue LIBERTAS
    {
      const x0 = W;
      ctx.fillStyle = blue; ctx.fillRect(x0, 0, W, H);
      ctx.fillStyle = red; ctx.fillRect(x0, 16, W, 40);
      libertas(x0 + W / 2, 215, 30, Math.PI / 2);
      border(x0);
    }
    // 2: school banner
    {
      const x0 = 2 * W;
      ctx.fillStyle = red; ctx.fillRect(x0, 0, W, H);
      ctx.strokeStyle = gold; ctx.lineCap = 'round';
      for (const d of [-1, 1]) {
        ctx.save(); ctx.translate(x0 + W / 2, 170); ctx.rotate(d * 0.62);
        ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, -95); ctx.lineTo(0, 70); ctx.stroke(); // blade
        ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-18, 70); ctx.lineTo(18, 70); ctx.stroke(); // quillons
        ctx.beginPath(); ctx.arc(0, 78, 12, 0.2, Math.PI - 0.2); ctx.lineWidth = 4; ctx.stroke(); // knuckle ring
        ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(0, 74); ctx.lineTo(0, 100); ctx.stroke(); // grip
        ctx.restore();
      }
      ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x0 + W / 2, 300, 22, 0, Math.PI * 2); ctx.stroke();
      border(x0);
    }
  });
}

// A real opening, with curved soffit and rectangular spandrels above it.
function archPanel(radius, spring, halfWidth, top, depth) {
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, spring);
  shape.lineTo(-halfWidth, top);
  shape.lineTo(halfWidth, top);
  shape.lineTo(halfWidth, spring);
  shape.lineTo(radius, spring);
  for (let i = 1; i <= 28; i++) {
    const angle = i / 28 * Math.PI;
    shape.lineTo(Math.cos(angle) * radius, spring + Math.sin(angle) * radius);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function archBand(inner, outer, depth) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI, false);
  shape.absarc(0, 0, inner, Math.PI, 0, true);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function roofGeometry(width, depth, rise) {
  const x = width / 2;
  const z = depth / 2;
  const positions = [
    -x, 0, z, x, 0, z, x, rise, 0, -x, 0, z, x, rise, 0, -x, rise, 0,
    x, 0, -z, -x, 0, -z, -x, rise, 0, x, 0, -z, -x, rise, 0, x, rise, 0,
    -x, 0, -z, -x, 0, z, -x, rise, 0, x, 0, z, x, 0, -z, x, rise, 0,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// Smooth value noise (trilinear over h3 lattice) for broad weathering.
function valueNoise(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const f = (t) => t * t * (3 - 2 * t);
  const u = f(x - xi), v = f(y - yi), w = f(z - zi);
  const c = (a, b, d) => h3(xi + a, yi + b, zi + d, seed);
  const lerp = (a, b, t) => a + (b - a) * t;
  return lerp(lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v), w);
}

// Baked into vertex colours (Kit light hook: colour *= 1 + L):
//  · shade inside the north, south and east arcades (between the front arches
//    at 14.3 m and the rear arches at 18 m, below the vault), cooler than sun;
//  · weathering: broad warm/cool blotches, darker grime near the ground.
function loggiaShade(x, y, z) {
  const az = Math.abs(z);
  const m = Math.max(az, x > 0 && az > 4.9 ? x : 0); // depth into a roofed arcade (west side is open)
  const S = THREE.MathUtils.smoothstep;
  const shade = S(m, 14.42, 14.95) * (1 - S(m, 17.7, 18.3)) * (1 - S(y, 6.55, 7.0));
  const n = valueNoise(x * 0.75, y * 0.75, z * 0.75, 31) - 0.5;
  const fine = valueNoise(x * 2.6, y * 2.6, z * 2.6, 47) - 0.5;
  const grime = y < 0.9 ? -0.16 * (1 - Math.max(0, y) / 0.9) : 0;
  const age = n * 0.24 + fine * 0.08 + grime;
  return [age + n * 0.03 - shade * 0.5, age - shade * 0.47, age - n * 0.04 - shade * 0.38];
}

export function buildLoggia(scene, { hemi, sun } = {}, {archiveBay=false} = {}) {
  const random = rng(64091);
  const kit = new Kit(1947);
  const fogColor = 0xcfa58e; // warm dusk haze
  // Late-autumn sunset over the open west balustrade (17° high): long shadows
  // run east across the court, and the same direction is baked into the floor.
  const sunOffset = { x: -10.5, y: 3.3, z: 2.6 };
  scene.background = new THREE.Color(fogColor);
  scene.fog = new THREE.Fog(fogColor, 27, 125);
  if (hemi) {
    hemi.color.set(0xa7abd0); // cool twilight sky in the shade
    hemi.groundColor.set(0xcf9e7e); // red walls and warm stone bounce
    hemi.intensity = 1.32;
  }
  if (sun) {
    sun.color.set(0xffb37a); // low amber sun
    sun.intensity = 2.15;
    sun.position.set(sunOffset.x, sunOffset.y, sunOffset.z);
  }
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(300, 40, 20),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  sky.renderOrder = -10;
  scene.add(sky);

  // Kit clones its input. Dispose the CPU-only source immediately, then dispose
  // the temporary bins after merging; only final scene resources survive.
  const put = (bin, geometry, color, position, rotation, scale, options) => {
    const result = kit.put(bin, geometry, color, position, rotation, scale, options);
    geometry.dispose();
    return result;
  };
  const stone = { vary: 0.085, noise: 0.04, rough: 0.013, uv: 'box', uvScale: 0.28 };
  const block = (bin, w, h, d, color, position, options = stone) => put(bin, box(w, h, d), color, position, undefined, undefined, options);
  const ring = (inner, outer, color, y) => put('inlay', new THREE.RingGeometry(inner, outer, 128), color, [0, y, 0], [-Math.PI / 2, 0, 0], 1, { vary: 0, noise: 0 });

  // Both decorative layers remain below the y=0 physics ground. There are no
  // columns, planters, steps, or other false obstacles inside the fighting area.
  put('ground', new THREE.PlaneGeometry(160, 160), 0xb4ac8f, [0, -0.036, 0], [-Math.PI / 2, 0, 0]);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ map: pavingTexture(sunOffset), roughness: 0.92, color: 0xfff1de }),
  );
  // Mipmaps (CanvasTexture default) plus stronger anisotropic filtering keep the
  // remaining joints from crawling when the low camera sees the floor edge-on.
  floor.material.map.anisotropy = 8;
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  floor.receiveShadow = true;
  scene.add(floor);
  // Adjacent annuli share a height but never overlap, avoiding shallow-view
  // z-fighting where the fine brass line meets its dark stone surround.
  // The edge stays legible (it is gameplay information) but in muted stone tones.
  ring(ARENA.radius - 0.16, ARENA.radius - 0.115, 0x9a9887, -0.008);
  ring(ARENA.radius - 0.115, ARENA.radius - 0.055, 0xc8ad80, -0.008);
  ring(ARENA.radius - 0.055, ARENA.radius + 0.035, 0x9a9887, -0.008);
  ring(ARENA.radius + 0.035, ARENA.radius + 0.085, 0xdccfae, -0.008);
  ring(ARENA.radius + 0.085, ARENA.radius + 0.12, 0x9a9887, -0.008);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    // Small compass marks make the arena's edge legible from any orbit angle.
    const r = ARENA.radius;
    put('inlay', new THREE.PlaneGeometry(0.15, 0.38), PALETTE.gold, [Math.sin(a) * r, -0.006, Math.cos(a) * r], [-Math.PI / 2, 0, -a], 1, { vary: 0, noise: 0 });
  }

  function column(x, z, height = 4.35, radius = 0.22) {
    block('stone', radius * 3.4, 0.22, radius * 3.4, PALETTE.sand, [x, 0.11, z]);
    put('stone', cyl(radius * 1.5, radius * 1.62, 0.14, 12), PALETTE.light, [x, 0.28, z], undefined, 1, stone);
    put('stone', cyl(radius * 0.83, radius, height - 0.72, 12), PALETTE.ivory, [x, (height - 0.72) / 2 + 0.36, z], undefined, 1, stone);
    put('stone', cyl(radius * 1.42, radius * 0.94, 0.2, 12), PALETTE.light, [x, height - 0.26, z], undefined, 1, stone);
    block('stone', radius * 3.35, 0.18, radius * 3.35, PALETTE.light, [x, height - 0.07, z]);
    put('trim', cyl(radius * 1.03, radius * 1.03, 0.055, 12), PALETTE.trim, [x, 0.45, z]);
  }

  function arcade(position, rotation, centers) {
    kit.push(position, rotation);
    const left = Math.min(...centers) - 2.5;
    const right = Math.max(...centers) + 2.5;
    const width = right - left;
    const mid = (right + left) / 2;
    block('recess', width, 0.08, 4.1, 0x5f5f57, [mid, -0.04, -1.65]);
    block('recess', width, 0.42, 3.9, 0x555e66, [mid, 6.57, -1.55]);
    // Real rear archways and shadowed piers reveal the light garden beyond.
    // Nothing seals the openings with a flat dark plane.
    for (const x of centers) {
      put('stone', archPanel(1.96, 4.1, 2.5, 6.75, 0.45), PALETTE.plasterShade, [x, 0, -3.75], undefined, 1, stone);
      put('stone', archBand(1.96, 2.16, 0.14), 0xb7b9a3, [x, 4.1, -3.48], undefined, 1, stone);
      for (const side of [-1, 1]) {
        put('stone', cyl(0.24, 0.29, 4.12, 10), 0xb5a68c, [x + side * 2.46, 2.06, -3.75], undefined, 1, stone);
        block('stone', 0.8, 0.2, 0.74, 0xaab09c, [x + side * 2.46, 4.15, -3.75]);
      }
      block('ground', 4.4, 0.06, 6, 0xa5a98a, [x, -0.05, -7]);
      block('leaves', 3.6, 0.58, 0.8, 0x65794e, [x, 0.29, -8.65], { vary: 0.09, noise: 0.08, rough: 0.15 });
    }
    block('recess', width, 0.18, 3, PALETTE.recess, [mid, 6.77, -1.3]);
    block('stone', width + 0.4, 0.23, 3.3, PALETTE.light, [mid, 7.03, -1.2]);
    block('stone', width + 0.5, 0.14, 3.55, PALETTE.light, [mid, 7.25, -1.2]);
    block('trim', width + 0.32, 0.16, 0.3, PALETTE.sand, [mid, 6.76, 0.42]);
    put('roof', roofGeometry(width + 0.9, 4.1, 0.78), PALETTE.roof, [mid, 7.32, -1.18]);
    for (const x of centers) {
      put('stone', archPanel(2.16, 4.35, 2.5, 6.81, 0.62), PALETTE.plaster, [x, 0, 0], undefined, 1, stone);
      put('stone', archBand(2.16, 2.4, 0.13), PALETTE.light, [x, 4.35, 0.38], undefined, 1, stone);
      block('stone', 0.27, 0.4, 0.2, PALETTE.light, [x, 6.64, 0.51]);
      // Stone benches sit in shade between the front and rear colonnades.
      if(!(archiveBay&&position[2]===-14.3&&x===7.5)){
        block('stone', 2.2, 0.19, 0.65, PALETTE.sand, [x, 0.75, -1.78]);
        for (const side of [-1, 1]) block('stone', 0.25, 0.66, 0.58, PALETTE.trim, [x + side * 0.77, 0.33, -1.78]);
      }
    }
    const piers = [...new Set(centers.flatMap((x) => [x - 2.5, x + 2.5]))];
    for (const x of piers) {
      column(x - 0.24, 0.035);
      column(x + 0.24, 0.035);
      block('stone', 1.15, 0.15, 0.95, PALETTE.light, [x, 4.44, 0]);
    }
    // A restrained dentil cornice rather than defensive castle crenellations.
    for (let x = left + 0.28; x < right; x += 0.64) block('stone', 0.23, 0.17, 0.28, PALETTE.sand, [x, 6.86, 0.46]);
    kit.pop();
  }
  arcade([0, 0, -14.3], 0, [-7.5, -2.5, 2.5, 7.5]);
  arcade([0, 0, 14.3], Math.PI, [-7.5, -2.5, 2.5, 7.5]);
  arcade([14.3, 0, 0], -Math.PI / 2, [-7.5]);
  arcade([14.3, 0, 0], -Math.PI / 2, [7.5]);

  // The eastern gate is the landmark: a sunlit open triumphal arch with a real
  // circular oculus above it, backed by a distant terracotta hill town.
  kit.push([14.48, 0, 0], -Math.PI / 2);
  for (const side of [-1, 1]) {
    block('stone', 1.48, 4.85, 1.2, PALETTE.brick, [side * 3.75, 2.425, -0.1]);
    column(side * 3.68 - 0.3, 0.71, 5.03, 0.29);
    column(side * 3.68 + 0.3, 0.71, 5.03, 0.29);
    block('stone', 1.32, 0.22, 1.3, PALETTE.light, [side * 3.7, 5.08, 0.32]);
  }
  put('stone', archPanel(3, 4.85, 4.5, 8.45, 1.15), PALETTE.plaster, [0, 0, -0.08], undefined, 1, stone);
  put('stone', archBand(3, 3.34, 0.22), PALETTE.light, [0, 4.85, 0.6], undefined, 1, stone);
  for (let i = 0; i < 15; i++) {
    const angle = (i + 0.5) / 15 * Math.PI;
    put('trim', box(0.019, 0.26, 0.03), PALETTE.sand, [Math.cos(angle) * 3.17, 4.85 + Math.sin(angle) * 3.17, 0.725], [0, 0, angle - Math.PI / 2]);
  }
  block('stone', 9.35, 0.24, 1.55, PALETTE.light, [0, 8.45, 0]);
  const attic = new THREE.Shape();
  attic.moveTo(-4.25, 8.57);
  attic.lineTo(4.25, 8.57);
  attic.lineTo(4.25, 11.45);
  attic.lineTo(-4.25, 11.45);
  attic.closePath();
  const oculus = new THREE.Path();
  oculus.absarc(0, 10.04, 1.05, 0, Math.PI * 2, true);
  attic.holes.push(oculus);
  put('stone', new THREE.ExtrudeGeometry(attic, { depth: 0.75, bevelEnabled: false, curveSegments: 32 }), PALETTE.brick, [0, 0, -0.38], undefined, 1, stone);
  put('stone', new THREE.TorusGeometry(1.13, 0.115, 8, 48), PALETTE.light, [0, 10.04, 0.48], undefined, 1, stone);
  put('trim', new THREE.TorusGeometry(1.29, 0.035, 6, 48), PALETTE.gold, [0, 10.04, 0.42]);
  for (const side of [-1, 1]) {
    block('stone', 0.29, 2.78, 0.22, PALETTE.light, [side * 3.89, 10, 0.46]);
    put('trim', new THREE.CircleGeometry(0.37, 24), PALETTE.sand, [side * 2.59, 10.03, 0.42]);
    put('stone', new THREE.TorusGeometry(0.37, 0.055, 6, 24), PALETTE.light, [side * 2.59, 10.03, 0.45]);
  }
  block('stone', 9.1, 0.19, 1.4, PALETTE.light, [0, 11.52, 0]);
  block('trim', 9.35, 0.12, 1.58, PALETTE.sand, [0, 11.69, 0]);
  put('roof', roofGeometry(9.65, 2.15, 0.52), PALETTE.roof, [0, 11.76, -0.04]);
  kit.pop();

  // The western edge opens over the town. Its low balustrade leaves sky and
  // distant roofs visible when the fighting camera turns through this side.
  // Its own bin that casts no shadow-map shadow: the sun is low behind it, and
  // its long shadow is already baked into the floor (never drawn twice).
  kit.push([-14.6, 0, 0], Math.PI / 2);
  block('balustrade', 25.1, 0.19, 0.8, PALETTE.sand, [0, 0.095, 0]);
  block('balustrade', 25.5, 0.2, 0.83, PALETTE.light, [0, 1.25, 0]);
  for (let x = -12; x <= 12; x += 0.75) {
    put('balustrade', cyl(0.1, 0.15, 0.33, 8), PALETTE.ivory, [x, 0.4, 0], undefined, 1, stone);
    put('balustrade', cyl(0.12, 0.21, 0.35, 8), PALETTE.ivory, [x, 0.72, 0], undefined, 1, stone);
    put('balustrade', cyl(0.16, 0.12, 0.27, 8), PALETTE.ivory, [x, 1.02, 0], undefined, 1, stone);
  }
  for (const x of [-12.4, -6.2, 0, 6.2, 12.4]) block('balustrade', 0.64, 1.37, 0.73, PALETTE.ivory, [x, 0.685, 0]);
  kit.pop();

  function cypress(x, z, height) {
    put('wood', cyl(0.13, 0.24, height * 0.48, 7), 0x70604a, [x, height * 0.24, z]);
    for (let j = 0; j < 5; j++) {
      const y = height * (0.32 + j * 0.132);
      const width = height * (0.13 - j * 0.016);
      put('leaves', new THREE.IcosahedronGeometry(1, 1), j % 2 ? 0x354e3b : PALETTE.green,
        [x + (random() - 0.5) * 0.15, y, z + (random() - 0.5) * 0.15], [0, random() * Math.PI, 0], [width, height * 0.255, width * 0.8], { noise: 0.075, vary: 0.1 });
    }
  }
  for (const [x, z, h] of [[-12.5, -12.7, 7.9], [-12.5, 12.7, 8.5], [12.3, -12.4, 8.2], [12.3, 12.4, 9.1], [-20, -15, 9], [-20, 14, 10], [21, -8, 10.3], [21, 8, 8.9], [28, -5.2, 7.8], [28, 5.2, 8.3]]) cypress(x, z, h);
  for (const [x, z] of [[-9.3, -11.1], [-9.3, 11.1], [8.6, -11.25], [8.6, 11.25]]) {
    put('roof', cyl(0.5, 0.3, 0.85, 12), 0xb67150, [x, 0.425, z]);
    put('roof', cyl(0.54, 0.54, 0.14, 12), 0xc88a64, [x, 0.83, z]);
    put('leaves', new THREE.SphereGeometry(0.7, 12, 8), 0x526044, [x, 1.14, z], undefined, [1, 0.75, 1]);
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7;
      const bloom = (x < 0 ? [0x6e7fc6, 0xe9e2d0] : [0xe0ad45, 0xc4683a])[i % 2]; // blue/white west, ochre/rust east
      put('flowers', new THREE.IcosahedronGeometry(0.1, 0), bloom, [x + Math.cos(angle) * 0.48, 1.4 + random() * 0.14, z + Math.sin(angle) * 0.48]);
    }
  }

  // Late-autumn litter: flat dry leaves blown against the arcade steps, the
  // balustrade and the pots — all outside the 9.6 m ring, never in the duel.
  {
    const leafColors = [0x9a5a2a, 0xb87a35, 0x7a4a2a, 0xc79a45, 0x8a3f25];
    const drifts = [[-13.6, -6, 2.6], [-13.8, 7, 2.2], [-6, -13.4, 2.4], [7.5, -13.5, 2.0], [3, 13.6, 2.6], [-9.3, 11.1, 1.2], [8.6, -11.25, 1.2], [12.9, 9.6, 1.8], [-11.5, -11.8, 1.6]];
    for (let i = 0; i < 150; i++) {
      const [cx, cz, spread] = drifts[i % drifts.length];
      const a = random() * Math.PI * 2, r = Math.sqrt(random()) * spread;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r * 0.6;
      if (Math.hypot(x, z) < 9.6 || Math.abs(x) > 14.1 || Math.abs(z) > 14.1) continue;
      const leaf = new THREE.CircleGeometry(1, 5);
      leaf.scale(1, 0.55, 1);
      put('flowers', leaf, leafColors[i % 5], [x, -0.012 + random() * 0.01, z], [-Math.PI / 2 + (random() - 0.5) * 0.4, random() * Math.PI * 2, 0], 0.1 + random() * 0.07, { vary: 0.2, noise: 0.05 });
    }
  }

  // Warm plaster blocks and low pitched roofs form a continuous, distant town,
  // not a castle silhouette. A few restrained shutters give its scale away.
  for (let i = 0; i < 33; i++) {
    const angle = i / 33 * Math.PI * 2 + (random() - 0.5) * 0.08;
    const radius = 35 + random() * 20;
    const width = 4 + random() * 4;
    const depth = 4 + random() * 3;
    const height = 3.5 + random() * 6;
    kit.push([Math.cos(angle) * radius, -1.4, Math.sin(angle) * radius], -angle - Math.PI / 2);
    block('town', width, height, depth, [0xc0673f, 0xd08a52, 0xb4553a, 0xd8a862, 0xc77a4c][i % 5], [0, height / 2, 0]);
    put('roof', roofGeometry(width + 0.6, depth + 0.7, 1.15), i % 2 ? 0xab6450 : PALETTE.roof, [0, height + 0.03, 0]);
    block('trim', width + 0.15, 0.16, depth + 0.18, PALETTE.sand, [0, height - 0.1, 0]);
    for (let y = 2.0; y < height - 0.8; y += 2.05) for (let x = -width / 2 + 0.95; x < width / 2 - 0.4; x += 1.75) block('distantDark', 0.48, 0.94, 0.06, (i + Math.round(x)) % 3 ? 0x4e6a50 : 0x5d5249, [x, y, depth / 2 + 0.04]); // green shutters
    if (i % 3 === 0) block('town', 0.55, 1.4, 0.65, 0xbd9c77, [width * 0.22, height + 0.7, 0]);
    kit.pop();
  }
  // Bologna's two towers, seen over the north-east roofs (off the gate axis): the tall
  // Asinelli and the short, leaning Garisenda, both bare brick.
  kit.push([46, -1.4, -17], 0.2);
  block('town', 3.6, 34, 3.6, PALETTE.brick, [0, 17, 0]);
  block('town', 4.3, 3.2, 4.3, 0xa65a3c, [0, 1.6, 0]);
  block('trim', 4.0, 0.3, 4.0, 0xb98a68, [0, 34.1, 0]);
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6], [0, -1.6], [0, 1.6], [-1.6, 0], [1.6, 0]]) block('town', 0.55, 0.8, 0.55, PALETTE.brick, [x, 34.6, z]);
  for (const y of [9, 17, 25, 31]) block('distantDark', 0.5, 1.3, 0.07, 0x4a3a32, [0, y, -1.83]);
  kit.pop();
  kit.push([42.5, -1.4, -11.8], 0.1);
  {
    const lean = new THREE.Matrix4().makeRotationZ(0.07); // ~4°
    const g = box(3.9, 19, 3.9);
    g.translate(0, 9.5, 0);
    g.applyMatrix4(lean);
    put('town', g, 0xa45a3d, [0, 0, 0]);
  }
  kit.pop();
  for (let i = 0; i < 15; i++) {
    const angle = i / 15 * Math.PI * 2;
    put('hills', new THREE.SphereGeometry(1, 18, 10), i % 2 ? 0x939988 : 0x8a927f,
      [Math.cos(angle) * 78, -6, Math.sin(angle) * 78], [0, angle, 0], [24 + random() * 9, 11 + random() * 9, 27], { noise: 0.015, vary: 0.06 });
  }
  // A level garden walk continues through the gate into the distant town.
  put('ground', new THREE.PlaneGeometry(21, 5.8), 0xcdbb9b, [25.2, -0.025, 0], [-Math.PI / 2, 0, 0]);

  // Burgundy silk is confined to the distant arcade. All four banners share
  // one merged draw and a small vertex animation; their top edge stays fixed.
  function banner(position, rotation, width = 1.15, height = 3.5, slot = 0) {
    const geometry = new THREE.PlaneGeometry(width, height, 8, 16);
    const p = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      p.setZ(i, Math.cos(u * Math.PI * 8) * (0.045 + 0.06 * (1 - v)));
      p.setY(i, p.getY(i) - Math.sin(u * Math.PI) * 0.13 * (1 - v));
    }
    geometry.computeVertexNormals();
    // The banner atlas (bannerTexture) carries the colour; vertex colour only
    // keeps a slight shading variation. Each banner reads its own atlas column.
    const cloth = put('cloth', geometry, 0xffffff, position, [0, rotation, 0], 1, { vary: 0.03, noise: 0.025 });
    const mergedUV = cloth.attributes.uv;
    for (let i = 0; i < mergedUV.count; i++) mergedUV.setX(i, (slot + 0.02 + mergedUV.getX(i) * 0.96) / 3);
  }
  // Three banners, each a different size and height (the matching pair at the
  // gate read as repetition; one gate banner and the south twin were removed).
  // 10/10 2차 colours: the city arms of Bologna at the gate, a blue LIBERTAS
  // banner, and the fencing school's red banner with gold crossed swords.
  banner([13.27, 3.35, -4.37], -Math.PI / 2, 1.15, 3.5, 0);
  banner([-5.0, 4.15, -14.02], 0, 0.82, 2.2, 1);
  banner([-5.0, 3.75, 14.02], Math.PI, 1.0, 2.8, 2);

  const standard = (options = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, ...options });
  const meshes = {};
  const materials = {
    stone: standard({ map: plasterTexture() }),
    trim: standard(),
    inlay: standard(),
    ground: standard(),
    recess: standard({ roughness: 1 }),
    roof: standard({ roughness: 1, flatShading: true }),
    town: standard(),
    hills: standard({ roughness: 1 }),
    distantDark: standard(),
    wood: standard(),
    leaves: standard({ flatShading: true, roughness: 1 }),
    flowers: standard({ flatShading: true }),
    cloth: standard({ side: THREE.DoubleSide, roughness: 1, map: bannerTexture() }),
  };
  materials.balustrade = materials.stone; // same material, separate non-casting mesh
  for (const [bin, material] of Object.entries(materials)) {
    const near = ['stone', 'balustrade', 'trim', 'inlay', 'recess', 'wood', 'leaves', 'flowers', 'cloth'].includes(bin);
    const mesh = kit.mesh(bin, material, { cast: bin === 'stone' || bin === 'leaves', receive: true, light: near ? loggiaShade : null });
    if (mesh) {
      mesh.name = `loggia-${bin}`;
      meshes[bin] = mesh;
      scene.add(mesh);
    } else material.dispose();
    for (const geometry of kit.bins[bin] ?? []) geometry.dispose();
  }

  // Seventy-two slow pollen motes, outside the center of the duel; no timers,
  // global randomness, dynamic lights, or particles spawning during combat.
  const count = 72;
  const motePositions = new Float32Array(count * 3);
  const motePhase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = random() * Math.PI * 2;
    const radius = 7.4 + random() * 6;
    motePositions[i * 3] = Math.cos(a) * radius;
    motePositions[i * 3 + 1] = 0.7 + random() * 6;
    motePositions[i * 3 + 2] = Math.sin(a) * radius;
    motePhase[i] = random() * Math.PI * 2;
  }
  const moteHome = motePositions.slice();
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const moteTexture = canvasTex(16, 16, (ctx, w, h) => {
    const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    glow.addColorStop(0, 'rgba(255,244,209,0.8)');
    glow.addColorStop(0.3, 'rgba(255,244,209,0.45)');
    glow.addColorStop(1, 'rgba(255,244,209,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  });
  const motes = new THREE.Points(moteGeometry, new THREE.PointsMaterial({ map: moteTexture, color: 0xffe9b8, size: 0.055, transparent: true, opacity: 0.54, depthWrite: false }));
  motes.frustumCulled = false;
  scene.add(motes);

  const clothGeometry = meshes.cloth.geometry;
  const clothPositions = clothGeometry.attributes.position;
  const clothUV = clothGeometry.attributes.uv;
  const clothNormals = clothGeometry.attributes.normal;
  const clothHome = clothPositions.array.slice();
  let time = 0;
  let gust = 0;
  let nextClothRustle = 1.6;
  const stage = {
    sunOffset,
    fighterLight: { color: 0xffe3c7, rimColor: 0xc7d8ef, rim: 1.05, level: 0.5 },
    excite(amount) {
      gust = Math.min(1, gust + Math.max(0, amount) * 0.24);
    },
    update(dt) {
      time += dt;
      gust = Math.max(0, gust - dt * 0.35);
      const breeze = 0.5 + Math.sin(time * 0.62) * 0.5;
      // This same slow wind crest lifts the silk and cues its quiet rustle.
      // The stage owns only the cue; the shared audio layer owns rate/distance.
      if (time >= nextClothRustle && breeze > 0.9) {
        stage.onEvent?.('stageDetail', { kind: 'clothRustle', amp: 0.32 + breeze * 0.12,
          pos: { x: 13.27, y: 3.35, z: -4.37 }, seed: 64091, time });
        nextClothRustle = time + 8;
      }
      for (let i = 0; i < clothPositions.count; i++) {
        const j = i * 3;
        const hang = 1 - clothUV.getY(i);
        const flutter = hang * (0.035 + breeze * 0.045 + gust * 0.07) * Math.sin(time * 1.7 + clothUV.getX(i) * 5 + clothHome[j] * 0.8 + clothHome[j + 2] * 0.3 - hang * 2.4);
        clothPositions.setXYZ(i, clothHome[j] + clothNormals.getX(i) * flutter, clothHome[j + 1], clothHome[j + 2] + clothNormals.getZ(i) * flutter);
      }
      clothPositions.needsUpdate = true;
      for (let i = 0; i < count; i++) {
        const j = i * 3;
        const phase = motePhase[i];
        motePositions[j] = moteHome[j] + Math.sin(time * 0.16 + phase) * 0.75;
        motePositions[j + 1] = moteHome[j + 1] + Math.sin(time * 0.22 + phase) * 0.36;
        motePositions[j + 2] = moteHome[j + 2] + Math.cos(time * 0.13 + phase) * 0.55;
      }
      moteGeometry.attributes.position.needsUpdate = true;
    },
  };
  return stage;
}
