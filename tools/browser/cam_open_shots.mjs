// 판 시작 카메라 · 무대 훑기 확인 (10/15 — docs/strike/camera_open_2026-10-15.md): 무대마다
//  ① 훑기 길을 N 등분해 카메라 자리에서 무대 메쉬(벽·지붕·기둥·석상·땅·소품)까지 가장 가까운 거리 — near 면(0.1 m)이 들어가지 않게 0.3 m 아래면 '뚫음'
//     (작은 인스턴스 알갱이 — 비·눈·잎·먼지 — 는 따로 센다) · 두 검객 메쉬까지 거리도
//  ② 카메라 → 바라보는 점 · 두 사람 가슴·머리 광선이 무대 메쉬에 막히는 몫 (뚫음은 아니지만 화면이 가려지는 몫)
//  ③ 스크린샷 u = 0 · 0.5 · 1 (시작 · 가운데 · 끝 — 끝은 평소 어깨 너머 자리)
//  ④ (--run) 실제 판 시작을 한 번 돌려: 훑기 동안 두 사람 발이 묶였나 · AI 가 나서지 않나 · 카메라가 닿는 순간 발이 풀리나 · 닿는 곳에서 튀지 않나 · 소개 글 때 · 콘솔 오류 0
//  실행: 이 저장소 개발 서버(자기 포트)를 띄운 뒤 playwright 가 있는 곳에서
//    node tools/browser/cam_open_shots.mjs http://127.0.0.1:5191 <출력 폴더> [무대 id,…|all] [--run] [--params='{"r0":8}'] [--n=90]
//  크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium). 읽기만 — 게임 값을 바꾸지 않는다(--params 는 그 실행의 훑기 길만 덮는다)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const base = args[0] || 'http://127.0.0.1:5191';
const outDir = args[1] || '/tmp/cam_open_shots';
const ALL = ['poseidon', 'clearing', 'temple', 'castle', 'cathedral', 'loggia', 'corsair', 'sacred_grove', 'frozen_bay', 'qinglan', 'sluice', 'dunhuang', 'etna', 'dayr', 'poseidon_night', 'clearing_a', 'clearing_a_dry', 'darkhall'];
const pick = args[2] && !args[2].startsWith('--') ? args[2] : 'all';
const stages = pick === 'all' ? ALL : pick.split(',');
const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return [m[1], m[2] ?? true]; }));
const N = +(opt.n ?? 90);
const over = opt.params ? JSON.parse(opt.params) : null;
const SHOTS = String(opt.shots ?? '0,0.5,1').split(',').map(Number);
const viewport = opt.portrait ? { width: 390, height: 844 } : { width: 844, height: 390 };
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const report = [];
for (const id of stages) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
  await page.goto(`${base}/?stage=${id}&weapon=longsword`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword && window.game.stage?.id, null, { timeout: 90000 });
  await page.evaluate(() => document.getElementById('menu').classList.remove('show'));
  await page.waitForTimeout(1200); // 따라가기가 서 있는 몸 자리에 닿게
  if (over) await page.evaluate((o) => Object.assign(game.camOpen.params, o), over);
  // ① · ② 길 검사 (페이지 안에서 — 무대 메쉬를 훑는다)
  const chk = await page.evaluate(({ N, RING }) => {
    const T = game.THREE;
    const scene = game.scene;
    scene.updateMatrixWorld(true);
    const fighter = new Set();
    for (const g of game.fighterMeshes) g.traverse((o) => fighter.add(o));
    const path = game.camOpenPath(N);
    const stageMeshes = [];
    const fighterMeshes = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      for (let p = o; p; p = p.parent) if (!p.visible) return;
      (fighter.has(o) ? fighterMeshes : stageMeshes).push(o);
    });
    const tri = new T.Triangle();
    const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), q = new T.Vector3();
    const mtx = new T.Matrix4(), im = new T.Matrix4();
    const sphere = new T.Sphere();
    /** 메쉬의 세계 삼각형을 하나씩 (인스턴스면 인스턴스마다) */
    function eachTri(m, fn) {
      const g = m.geometry;
      const pos = g.attributes.position;
      if (!pos) return;
      const idx = g.index;
      const n = idx ? idx.count : pos.count;
      const inst = m.isInstancedMesh ? m.count : 1;
      for (let k = 0; k < inst; k++) {
        if (m.isInstancedMesh) { m.getMatrixAt(k, im); mtx.multiplyMatrices(m.matrixWorld, im); } else mtx.copy(m.matrixWorld);
        for (let i = 0; i + 2 < n; i += 3) {
          const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
          a.fromBufferAttribute(pos, i0).applyMatrix4(mtx);
          b.fromBufferAttribute(pos, i1).applyMatrix4(mtx);
          c.fromBufferAttribute(pos, i2).applyMatrix4(mtx);
          fn(a, b, c);
        }
      }
    }
    function worldSphere(m) {
      if (m.isInstancedMesh) { if (!m.boundingSphere) m.computeBoundingSphere(); sphere.copy(m.boundingSphere); } else { if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); sphere.copy(m.geometry.boundingSphere); }
      return sphere.clone().applyMatrix4(m.matrixWorld);
    }
    function describe(m) {
      const mat = [].concat(m.material)[0];
      const s = worldSphere(m);
      return `${m.name || m.geometry.type}${m.isInstancedMesh ? `×${m.count}` : ''} col=${mat?.color ? '#' + mat.color.getHexString() : '-'}${mat?.transparent ? ' tr' : ''} @(${s.center.x.toFixed(1)},${s.center.y.toFixed(1)},${s.center.z.toFixed(1)}) r${s.radius.toFixed(1)}`;
    }
    // 알갱이(비·눈·잎·먼지): 인스턴스 하나의 모양이 아주 작다
    const isParticle = (m) => { if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); return !!m.isInstancedMesh && m.geometry.boundingSphere.radius < 0.12; };
    const LIM = 1.2; // 이 거리 안의 삼각형만 정밀하게
    function minDist(list, p, skipParticle) {
      let best = Infinity, who = null;
      for (const m of list) {
        const part = isParticle(m);
        if (skipParticle != null && part !== skipParticle) continue;
        const s = worldSphere(m);
        if (s.distanceToPoint(p) > LIM) continue;
        eachTri(m, (a, b, c) => {
          tri.set(a, b, c);
          tri.closestPointToPoint(p, q);
          const d = q.distanceTo(p);
          if (d < best) { best = d; who = m; }
        });
      }
      return { d: best, who: who ? describe(who) : null };
    }
    // ② 가림: 광선이 무대 메쉬(알갱이 빼고)에 막히나
    const ray = new T.Raycaster();
    const seeThrough = (m) => [].concat(m.material).every((mt) => mt.transparent && (mt.blending === T.AdditiveBlending || mt.opacity < 0.35));
    const solid = stageMeshes.filter((m) => !isParticle(m) && !seeThrough(m)); // 가림: 알갱이 · 비쳐 보이는 더하기 면(빛줄기·안개 판)은 빼고
    const P = game.player, E = game.enemy;
    const pts = { look: null, foeChest: E.bodies.chest.translation(), foeHead: E.bodies.head.translation(), meChest: P.bodies.chest.translation(), meHead: P.bodies.head.translation() };
    const blocked = { look: 0, foeChest: 0, foeHead: 0, meChest: 0, meHead: 0 };
    const blockWho = {};
    let ring = null;
    if (RING) {
      ring = [];
      const cx = game.camOpen.centre.x, cz = game.camOpen.centre.z;
      const g0 = game.player.terrain ? game.player.terrain.heightAt(cx, cz) : 0;
      for (const r of [7, 8, 9, 10, 10.5]) for (const h of [2.5, 3.5, 4.5, 5.5, 7]) {
        let best = Infinity, at = 0, who = null;
        for (let k = 0; k < 72; k++) {
          const a = (k / 72) * Math.PI * 2;
          const p = new T.Vector3(cx + Math.cos(a) * r, g0 + h, cz + Math.sin(a) * r);
          const m = minDist(stageMeshes, p, false);
          if (m.d < best) { best = m.d; at = k * 5; who = m.who; }
        }
        ring.push({ r, h, d: +best.toFixed(2), az: at, who });
      }
    }
    const rows = [];
    for (const s of path) {
      const st = minDist(stageMeshes, s.pos, false);
      const pa = minDist(stageMeshes, s.pos, true);
      const fi = minDist(fighterMeshes, s.pos, null);
      for (const k of Object.keys(pts)) {
        const t = k === 'look' ? s.look : new T.Vector3(pts[k].x, pts[k].y, pts[k].z);
        const dir = t.clone().sub(s.pos);
        const L = dir.length();
        ray.set(s.pos, dir.normalize());
        ray.far = Math.max(0, L - 0.3);
        const hit = ray.intersectObjects(solid, false)[0];
        if (hit) { blocked[k]++; blockWho[k] = describe(hit.object); }
      }
      rows.push({ u: +s.u.toFixed(3), pos: s.pos.toArray().map((v) => +v.toFixed(2)), stage: +st.d.toFixed(3), stageWho: st.who, particle: +pa.d.toFixed(3), fighter: +fi.d.toFixed(3) });
    }
    const worst = rows.reduce((m, r) => (r.stage < m.stage ? r : m), rows[0]);
    return { ring, n: path.length, minStage: worst.stage, minAt: worst.u, minWho: worst.stageWho, minPos: worst.pos, minFighter: Math.min(...rows.map((r) => r.fighter)), minParticle: Math.min(...rows.map((r) => r.particle)), clip: rows.filter((r) => r.stage < 0.3).map((r) => r.u), close: rows.filter((r) => r.stage < 0.6).map((r) => r.u), blocked: Object.fromEntries(Object.entries(blocked).map(([k, v]) => [k, +(v / path.length).toFixed(2)])), blockWho, params: game.camOpen.params, mode: game.camOpen.mode, rows };
  }, { N, RING: !!opt.ring });
  // ③ 스크린샷
  const shots = [];
  for (const u of SHOTS) {
    await page.evaluate((u) => (game.camOpen.u = u), u);
    await page.waitForTimeout(500);
    const f = `${outDir}/${id}_u${String(u).replace('.', '')}${opt.portrait ? '_p' : ''}.png`;
    await page.screenshot({ path: f });
    shots.push(f);
  }
  await page.evaluate(() => (game.camOpen.u = null));
  // ④ 실제 판 시작
  let run = null;
  if (opt.run) {
    await page.evaluate(() => {
      window.__camRec = [];
      const rec = () => {
        const g = window.game;
        if (g.state === 'fight') {
          const hold = g.config.ARENA.startHold;
          window.__camRec.push({ t: performance.now(), fightT: g.player.fightT, hold, u: Math.min(1, g.player.fightT / (hold - 1e-6)), // 게임과 같은 끝(fighter.feetHeld · main.js openProgress)
           cam: g.camera.position.toArray(), end: g.camOpen.endPos.toArray(), feet: g.player.feetHeld, efeet: g.enemy.feetHeld, ePel: Object.values(g.enemy.bodies.pelvis.translation()), pPel: Object.values(g.player.bodies.pelvis.translation()), intro: document.getElementById('foeIntro').classList.contains('show'), toast: document.getElementById('toast').classList.contains('show'), aiMode: g.ai.mode, aiPhase: g.ai.phase, eTip: g.enemy.tipVel?.length?.() ?? 0 });
        }
        if (window.__camRec.length < 4000) requestAnimationFrame(rec);
      };
      requestAnimationFrame(rec);
    });
    await page.evaluate(() => document.getElementById('btnStart').click());
    await page.waitForFunction(() => window.__camRec.length && window.__camRec.at(-1).fightT > window.__camRec.at(-1).hold + 0.6, null, { timeout: 180000 });
    run = await page.evaluate(() => {
      const R = window.__camRec;
      const land = R.findIndex((r) => r.u >= 1);
      const pre = R.slice(0, land);
      const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      // 닿는 곳의 튐: 닿기 전 마지막 화면 · 닿은 첫 화면의 카메라 ↔ 평소 자리 차이와 화면 사이 움직임
      const gapBefore = land > 0 ? dist(R[land - 1].cam, R[land - 1].end) : null;
      const gapAt = land >= 0 ? dist(R[land].cam, R[land].end) : null;
      const steps = R.slice(Math.max(1, land - 4), land + 4).map((r, i, A) => (i ? dist(r.cam, A[i - 1].cam) : 0));
      const eMove = Math.max(...pre.map((r) => Math.hypot(r.ePel[0] - R[0].ePel[0], r.ePel[2] - R[0].ePel[2])));
      const pMove = Math.max(...pre.map((r) => Math.hypot(r.pPel[0] - R[0].pPel[0], r.pPel[2] - R[0].pPel[2])));
      const introOn = R.find((r) => r.intro);
      const introOff = introOn ? R.find((r) => r.fightT > introOn.fightT && !r.intro) : null;
      return {
        frames: R.length, hold: R[0].hold, landFightT: land >= 0 ? +R[land].fightT.toFixed(3) : null,
        feetHeldUntilLand: pre.every((r) => r.feet && r.efeet), feetFreeAtLand: land >= 0 ? !R[land].feet && !R[land].efeet : null,
        gapBefore: gapBefore != null ? +gapBefore.toFixed(4) : null, gapAt: gapAt != null ? +gapAt.toFixed(4) : null, stepsAroundLand: steps.map((s) => +s.toFixed(3)),
        enemyPelvisMoveDuringOpen: +eMove.toFixed(3), playerPelvisMoveDuringOpen: +pMove.toFixed(3), aiModes: [...new Set(pre.map((r) => `${r.aiMode}/${r.aiPhase}`))], maxFoeTipSpeedDuringOpen: +Math.max(...pre.map((r) => r.eTip)).toFixed(2),
        introOnAtGameT: introOn ? +introOn.fightT.toFixed(2) : null, introOffAtGameT: introOff ? +introOff.fightT.toFixed(2) : null, toastSeen: R.some((r) => r.toast),
        wallSec: +((R.at(-1).t - R[0].t) / 1000).toFixed(1),
      };
    });
  }
  const rec = { id, mode: chk.mode, params: chk.params, minStage: chk.minStage, minAt: chk.minAt, minWho: chk.minWho, minPos: chk.minPos, minFighter: chk.minFighter, minParticle: chk.minParticle, clip: chk.clip, close: chk.close, blocked: chk.blocked, blockWho: chk.blockWho, shots, run, errors };
  report.push(rec);
  writeFileSync(`${outDir}/${id}_path.json`, JSON.stringify(chk.rows));
  console.log(`${id}: mode ${chk.mode} · 무대까지 최소 ${chk.minStage.toFixed(2)} m (u ${chk.minAt}${chk.minWho ? ` — ${chk.minWho}` : ''}) · 뚫음(<0.3 m) ${chk.clip.length}/${chk.n} · 가까움(<0.6 m) ${chk.close.length} · 검객까지 ${Number.isFinite(chk.minFighter) ? chk.minFighter.toFixed(2) : '> 1.2'} m · 알갱이 ${Number.isFinite(chk.minParticle) ? chk.minParticle.toFixed(2) : '> 1.2'} m · 가림 ${JSON.stringify(chk.blocked)} · 콘솔 오류 ${errors.length}`);
  if (Object.keys(chk.blockWho).length) console.log(`   가린 것: ${JSON.stringify(chk.blockWho)}`);
  if (chk.ring) console.log('   둘레(r·h → 가장 가까운 무대 m @방위°): ' + chk.ring.map((x) => `${x.r}/${x.h}:${x.d}${x.d < 0.6 ? `@${x.az}` : ''}`).join(' '))
  if (chk.ring) for (const x of chk.ring.filter((x) => x.d < 0.6)) console.log(`     r ${x.r} h ${x.h}: ${x.d} m @${x.az}° — ${x.who}`);
  if (run) console.log(`   판 시작: ${JSON.stringify(run)}`);
  if (errors.length) console.log('   ' + errors.join('\n   '));
  await page.close();
}
writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 1));
await browser.close();
const bad = report.filter((r) => r.clip.length || r.errors.length);
console.log(bad.length ? `문제 ${bad.map((r) => r.id).join(', ')}` : '모든 무대: 뚫음 0 · 콘솔 오류 0');
process.exit(bad.length ? 1 : 0);
