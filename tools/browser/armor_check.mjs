// 브라우저 방어구 점검: 판을 여러 번 열며(일시정지 → "처음부터 다시", 무기 카드 뽑기) 실제 combat.strike 로 투구·판금을
//  깨 보고, 콘솔 에러 0 · 판마다 장면 물체·모양 수가 늘지 않는지 · 흩어진 조각이 새 판·배경 바꾸기·판 끝 메뉴 뒤에서 치워지는지 본다.
//  흩어진 조각은 부러진 칼날 끝과 방어구 조각을 함께 센다(src/debris.js 한 모듈, game.debris.count). 무기 파손과 함께:
//  내 칼을 부러뜨려(칼 조각) 토막 날(weapons.js BREAK.stubEdge)로 판금을 치고, 두 조각이 함께 떠 있다가 배경 바꾸기·새 판에 둘 다 치워지나.
//  타격마다 판금·투구 소리도 판정대로인지 센다 (막음 → plateBlock, 뚫림 → 갑옷 쇳소리, 완전 파손 → plateBreak 한 번씩.
//  벗겨져 날아가는 케틀햇은 부서짐이 아니라 plateBreak 가 없다).
//  스크린샷: 마르그레테 견갑 멀쩡 → 부서지는 순간 → 부서진 뒤, 어두운 홀에서 판금이 캐릭터 조명을 받는지.
//  실행: vite 개발 서버를 띄운 뒤 (npm run dev) playwright 가 설치된 곳에서
//    node tools/browser/armor_check.mjs http://127.0.0.1:5173 margarethe castle 4 [스크린샷 폴더]
//    node tools/browser/armor_check.mjs http://127.0.0.1:5173 heinrich darkhall 4 [스크린샷 폴더]
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';

const [base = 'http://127.0.0.1:5173', foe = 'margarethe', stage = 'castle', roundsArg = '4', shotDir = 'armor_shots'] = process.argv.slice(2);
const ROUNDS = +roundsArg;
fs.mkdirSync(shotDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text() + ' @' + (m.location()?.url || '?'));
});
let closing = false; // 브라우저를 닫는 동안 끊기는 요청(미리 받아 두던 모듈)은 세지 않는다
page.on('requestfailed', (r) => {
  if (!closing) errors.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText ?? ''));
});
page.on('response', (r) => {
  if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`);
});
await page.goto(`${base}/?foe=${foe}&stage=${stage}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });

// 페이지 안 도우미: 실제 combat.strike 로 한 부위를 친다 (tools/sim/armor_eval.mjs probe 와 같은 방법), 카메라, 세기
await page.evaluate(() => {
  const g = window.game;
  const T = g.THREE;
  const st = (b) => {
    const t = b.translation(), r = b.rotation(), c = b.worldCom();
    return { p: new T.Vector3(t.x, t.y, t.z), q: new T.Quaternion(r.x, r.y, r.z, r.w), com: new T.Vector3(c.x, c.y, c.z), v: new T.Vector3(), w: new T.Vector3() };
  };
  // 부위 → [칠 점, 겉면 방향] (겉모습 좌표: 팔은 +y 가 어깨 쪽)
  const AT = {
    head: [[0.02, 0.08, 0.05], [0.3, 1, 0.4]],
    chest: [[0.11, 0, 0.05], [1, 0, 0]],
    abdomen: [[0.1, 0, 0.05], [1, 0, 0]],
    pelvis: [[0.1, -0.07, 0.08], [1, 0, 0]],
    uarmO: [[0.03, 0.09, 0], [1, 0, 0]],
    uarmS: [[0.03, 0.09, 0], [1, 0, 0]],
  };
  window.__strike = (attWho, part, E, type = 'cut') => {
    const att = attWho === 'player' ? g.player : g.enemy;
    const vic = att === g.player ? g.enemy : g.player;
    const C = g.combat;
    const info = [...C.info.values()];
    const vInfo = info.find((i) => i.fighter === vic && i.part === part);
    const wInfo = info.find((i) => i.fighter === att && i.part === 'blade');
    if (!vInfo || !wInfo) return null;
    const grp = vic.groups[part];
    const rot = grp.children.find((c) => c.isGroup && c.quaternion.w < 0.9999)?.quaternion ?? new T.Quaternion();
    const [lp, ln] = AT[part];
    const local = new T.Vector3(...lp).applyQuaternion(rot);
    const nl = new T.Vector3(...ln).normalize().applyQuaternion(rot);
    const P = st(vInfo.body);
    const point = local.clone().applyQuaternion(P.q).add(P.p);
    const n = nl.applyQuaternion(P.q).normalize();
    const sw = st(wInfo.body);
    const comL = sw.com.clone().sub(sw.p).applyQuaternion(sw.q.clone().invert());
    const HL = att.weaponCfg.hiltLength, BL = att.weaponCfg.bladeLength;
    const up = Math.abs(n.y) < 0.9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0);
    const tan = new T.Vector3().crossVectors(n, up).normalize();
    let x, y, at;
    if (type === 'stab') (y = n.clone().negate()), (x = tan), (at = HL + BL);
    else if (type === 'flat') (x = tan), (y = new T.Vector3().crossVectors(n, tan)), (at = HL + 0.6 * BL); // 칼 면으로 (둔타)
    else (x = n.clone().negate()), (y = tan), (at = HL + 0.6 * BL);
    const z = new T.Vector3().crossVectors(x, y);
    const q = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
    const S = { p: point.clone().addScaledVector(y, -at), q, v: new T.Vector3(), w: new T.Vector3() };
    S.com = S.p.clone().add(comL.applyQuaternion(q));
    const pr = { w: wInfo, v: vInfo };
    S.v.copy(n).multiplyScalar(-10);
    const r0 = C.analyze(pr, point, S, P, true);
    if (!r0) return null;
    S.v.copy(n).multiplyScalar(-10 * Math.sqrt(E / r0.energy));
    const ac = att.cache, vc = vic.cache;
    att.cache = { sword: S };
    vic.cache = { parts: { [part]: P } };
    vic.hitCooldowns.clear();
    const s0 = { ...window.__snd };
    const b0 = vic.platesBroken, h0 = vic.hasHelmet;
    const r = C.strike(pr, point, false);
    att.cache = ac;
    vic.cache = vc;
    const snd = Object.fromEntries(Object.keys(s0).map((k) => [k, window.__snd[k] - s0[k]]));
    return r && { snd, brokeNow: vic.platesBroken > b0 || (h0 && !vic.hasHelmet && vic.helmetType !== 'kettle'), type: r.type, E: +r.energy.toFixed(0), sev: +r.severity.toFixed(2), plate: r.plate, helmet: r.helmet, plateLeft: vic.plate[part], helmet01: +vic.helmetIntegrity.toFixed(2), hasHelmet: vic.hasHelmet, shed: vic.armorShed, broken: vic.platesBroken };
  };
  // 한 부위를 가까이서 보는 카메라 (그 부위 바깥쪽·몸 앞쪽에서)
  window.__cam = (who, part, dist = 0.9) => {
    g.freeCam = true;
    const f = who === 'player' ? g.player : g.enemy;
    const p = new T.Vector3();
    f.groups[part].getWorldPosition(p);
    const c = new T.Vector3();
    f.groups.chest.getWorldPosition(c);
    const cq = new T.Quaternion();
    f.groups.chest.getWorldQuaternion(cq);
    const fwd = new T.Vector3(1, 0, 0).applyQuaternion(cq);
    fwd.y = 0;
    fwd.normalize();
    const lat = p.clone().sub(c);
    lat.y = 0;
    if (lat.lengthSq() < 1e-6) lat.set(-fwd.z, 0, fwd.x);
    lat.normalize();
    g.camera.position.copy(p).addScaledVector(lat, dist * 0.75).addScaledVector(fwd, dist * 0.65).add(new T.Vector3(0, 0.22, 0));
    g.camera.lookAt(p);
  };
  window.__count = () => {
    let objects = 0, meshes = 0;
    g.player.scene.traverse((o) => {
      objects++;
      if (o.isMesh) meshes++;
    });
    const ri = g.renderInfo();
    return { objects, meshes, top: g.player.scene.children.length, geometries: ri.geometries, textures: ri.textures, programs: ri.programs, debris: g.debris.count(), debrisW: g.debris.count('weapon'), debrisA: g.debris.count('armor'), weapon: g.player.weapon.id, foe: g.enemy.name, stage: g.stage.id };
  };
  // 소리 세기: 판금·투구 소리가 한 타격에 몇 번 났나 (main.js onWound 가 전투 판정 r.plate 로 고른다)
  //  판이 막았으면 plateBlock 한 번(그 안에서 갑옷 쇳소리 한 번), 뚫고 들어갔으면 갑옷 쇳소리 한 번·plateBlock 0, 완전히 부서진 타격에만 plateBreak 한 번
  window.__snd = { plateBlock: 0, plateBreak: 0, armor: 0, helmet: 0 };
  const S = g.sound;
  for (const k of ['plateBlock', 'plateBreak', 'helmet']) {
    const f = S[k].bind(S);
    S[k] = (...a) => (window.__snd[k]++, f(...a));
  }
  const imp = S.impact.bind(S);
  S.impact = (o, ...a) => (o?.b === 'armor' && window.__snd.armor++, imp(o, ...a));
  window.__ui = (show) => {
    for (const id of ['menu', 'hud', 'topButtons', 'toast', 'hint', 'foeIntro', 'draw']) {
      const el = document.getElementById(id);
      if (el) el.style.visibility = show ? '' : 'hidden';
    }
  };
});

const sleep = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
async function shot(name) {
  await ev(() => window.__ui(false));
  await sleep(250);
  const path = `${shotDir}/${name}.png`;
  await page.screenshot({ path });
  await ev(() => window.__ui(true));
  console.log('screenshot', path);
}
async function pauseGame() {
  if ((await ev(() => window.game.state)) === 'fight') await page.click('#btnPause');
  await page.waitForFunction(() => window.game.state === 'paused', null, { timeout: 10000 });
}
async function resumeGame() {
  await ev(() => (window.game.freeCam = false));
  await page.click('#btnResume');
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 10000 });
}
/** 새 판: (싸우는 중이면 일시정지 →) "싸움 시작/처음부터 다시/다시 싸우기" → 카드 한 장 → 싸움 */
async function openRound(i) {
  // 카드: 방어구를 깨 볼 수 있게 날이 선 무기가 있으면 그 카드를 고른다. 내 카드 두 장에 없으면 아무 카드로 판을 열었다가
  //  다시 뽑는다(몇 번까지). 판마다 무기는 뽑기대로 달라진다.
  //  맨 오른쪽(세 번째) 카드는 상대 무기 칸이라 고를 수 없다 — 내 카드 두 장(data-i 0·1) 가운데서만 고른다
  for (let tries = 0; ; tries++) {
    if ((await ev(() => window.game.state)) === 'fight') await pauseGame();
    await page.click('#btnStart');
    await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6, null, { timeout: 30000 });
    const ids = await ev(() => window.game.draw.ids.slice(0, 2));
    const good = ids.findIndex((id) => EDGED.includes(id));
    await page.locator(`#draw .wcard[data-i="${good >= 0 ? good : i % 2}"]`).click();
    await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 30000 });
    if (good >= 0 || tries >= 8) break;
    console.log(`round ${i + 1}: no edged weapon in my cards (${ids.join(', ')}), drawing again`);
  }
  await sleep(300);
}
// 방어구를 깨 볼 만한 날 선 무기 (카드에 있으면 고른다)
const EDGED = ['longsword', 'zweihander', 'excalibur', 'excalibur_replica', 'qinggang', 'falchion', 'monohoshizao', 'sabre'];
/** 흩어진 조각이 다 사라질 때까지 기다린다 (소프트웨어 WebGL 은 초당 몇 프레임이라 dt 상한 0.1초에 걸려 게임 시간이 느리게 간다) */
async function waitDebrisGone(ms = 30000) {
  try {
    await page.waitForFunction(() => window.game.debris.count() === 0, null, { timeout: ms });
    return true;
  } catch {
    return false;
  }
}
const hit = async (who, part, E, n = 1, type = 'cut') => {
  const rs = await ev(([w, p, e, k, t]) => Array.from({ length: k }, () => window.__strike(w, p, e, t)), [who, part, E, n, type]);
  for (const r of rs) checkSound(`${who}->${part} ${E}J`, r);
  return rs;
};
/** 한 타격의 판금·투구 소리가 판정대로인가 (막음 → plateBlock 한 번, 뚫림 → 갑옷 쇳소리 한 번 — 둘 다 쇳소리는 한 번뿐, 완전 파손 타격에만 plateBreak 한 번) */
let soundChecks = 0;
let soundBlocked = 0; // 그 가운데 판금이 막은 타격 (plateBlock 이 나야 하는 경우)
function checkSound(label, r) {
  if (!r || !(r.plate || r.helmet)) return;
  const s = r.snd;
  const opened = r.type !== 'blunt' && r.sev > 0;
  let ok = s.plateBreak === (r.brokeNow ? 1 : 0);
  if (r.helmet) ok &&= s.helmet === 1 && s.plateBlock === 0 && s.armor === 0;
  // 갑옷 쇳소리(impact b:'armor')는 어느 쪽이든 한 번: 막았으면 plateBlock 이 안에서 한 번 내고, 뚫렸으면 onWound 가 직접 한 번
  else ok &&= s.armor === 1 && s.plateBlock === (opened ? 0 : 1);
  if (r.plate && !opened) soundBlocked++;
  soundChecks++;
  if (!ok) errors.push(`sound ${label}: ${JSON.stringify(r)}`);
}
const log = (label, x) => console.log(label, JSON.stringify(x));

const counts = [];
const isMg = foe === 'margarethe';
for (let r = 0; r < ROUNDS; r++) {
  await openRound(r);
  const c0 = await ev(() => window.__count());
  counts.push(c0);
  log(`round ${r + 1} start`, c0);
  if (c0.debris !== 0) errors.push(`round ${r + 1} start: debris ${c0.debris} (weapon ${c0.debrisW}, armor ${c0.debrisA})`);
  if (r === 0) {
    // 스크린샷 판: 상대 AI 를 잠깐 세워 둔다 (가만히 선 채로 부위를 찍고 깬다)
    await ev(() => (window.game.ai.update = () => {}));
    await pauseGame();
    await ev(() => window.__cam('enemy', 'uarmO'));
    await shot(`${foe}_pauldron_intact`);
    await resumeGame();
    const ph = await hit('player', 'uarmO', 60, 3);
    log('pauldron hits', ph);
    if (ph.some((r) => !r)) errors.push('round 1: strikes did not land (no edged weapon drawn)');
    await pauseGame();
    await ev(() => window.__cam('enemy', 'uarmO'));
    await shot(`${foe}_pauldron_breaking`);
    await resumeGame();
    await waitDebrisGone();
    log('after debris life', await ev(() => window.__count()));
    await pauseGame();
    await ev(() => window.__cam('enemy', 'uarmO'));
    await shot(`${foe}_pauldron_broken`);
    // 파손(곁 조각): 가슴 한 번, 투구(마르그레테) 두 번 → 뿔 → 뿔·볏
    await resumeGame();
    log('chest partial', await hit('player', 'chest', 60, 1));
    log('abdomen light hit (plate blocks)', await hit('player', 'abdomen', 30, 1));
    if (isMg) log('helmet partial x2', await hit('player', 'head', 60, 2));
    await pauseGame();
    await ev(() => window.__cam('enemy', 'chest', 1.2));
    await shot(`${foe}_partial`);
    await resumeGame();
    if (isMg) log('helmet shatter', await hit('player', 'head', 60, 1));
    await waitDebrisGone();
    log('round 1 after breaks', await ev(() => window.__count()));
  } else if (r === 1) {
    // 배경 바꾸기: 흩어지던 조각이 치워지나
    log('breaks', await hit('player', 'uarmS', 150, 3));
    let d0 = await ev(() => window.__count().debris);
    // 뽑은 카드에 날 선 무기가 없었으면(고무 닭 등, 칼날 부위가 없어 __strike 가 못 친다) 판을 직접 깨서 흩어지는 조각을 만든다
    if (!d0) d0 = await ev(() => { const e = window.game.enemy; for (let i = 0; i < 3; i++) e.wearPlate('chest', 150, { x: 1, y: 0, z: 0 }); return window.__count().debris; });
    // 칼 조각도 함께: 내 칼을 부러뜨린다
    const c0b = await ev(() => (window.game.player.breakWeapon(), window.__count()));
    const other = stage === 'temple' ? 'castle' : 'temple';
    await ev((s) => window.game.setStage(s), other);
    const c1 = await ev(() => window.__count());
    await ev((s) => window.game.setStage(s), stage);
    log('stage switch clears debris', { before: { weapon: c0b.debrisW, armor: c0b.debrisA }, after: { weapon: c1.debrisW, armor: c1.debrisA } });
    if (!c0b.debrisW || !c0b.debrisA || c1.debris !== 0) errors.push(`stage switch debris weapon ${c0b.debrisW} armor ${c0b.debrisA} -> ${c1.debris}`);
  } else if (r === 2) {
    // 판 끝 메뉴 뒤: 상대를 쓰러뜨리고 메뉴가 뜬 뒤 판금을 깨 본다 → 메뉴 뒤에서 마저 날아 사라져야 한다
    await ev(() => window.game.enemy.die('목'));
    await page.waitForFunction(() => window.game.state === 'paused', null, { timeout: 60000 }); // 소프트웨어 WebGL 은 느려서 쓰러짐 연출이 오래 걸린다
    const d0 = await ev(() => {
      const e = window.game.enemy;
      for (let i = 0; i < 3; i++) e.wearPlate('chest', 150, { x: 1, y: 0, z: 0 });
      window.game.player.breakWeapon(); // 칼 조각도 메뉴 뒤에서 함께 사라져야 한다
      const c = window.__count();
      return c.debrisW && c.debrisA ? c.debris : 0;
    });
    const t0 = Date.now();
    await waitDebrisGone();
    const d1 = await ev(() => window.__count().debris);
    log('behind end menu', { debrisAtBreak: d0, after: d1, waitedMs: Date.now() - t0, state: await ev(() => window.game.state) });
    if (d0 === 0 || d1 !== 0) errors.push(`end-menu debris ${d0} -> ${d1}`);
  } else {
    // 무기 파손과 함께: 내 칼을 부러뜨리고(칼 조각) 토막 날(BREAK.stubEdge — 베기 효율이 깎인다)로 판금을 친다.
    //  60J 는 판이 막고(plateBlock), 150J 세 번이면 부서진다. 칼 조각과 방어구 조각이 함께 떠 있다가 다음 판 시작에 둘 다 치워져야 한다
    log('player weapon broken', await ev(() => { const p = window.game.player; p.breakWeapon(); return { broken: p.weaponBroken, blade: +p.weaponCfg.bladeLength.toFixed(3), mCut: +p.weaponCfg.mCut.toFixed(2) }; }));
    log('stub hit', await hit('player', 'abdomen', 60, 1));
    // 그냥 싸우며 몇 번 세게 친다 (벗겨진 케틀햇도: 플레이어 머리에 센 둔타)
    log('breaks', await hit('player', 'chest', 150, 3));
    const both = await ev(() => window.__count());
    log('debris together', { weapon: both.debrisW, armor: both.debrisA });
    if (!both.debrisW || !both.debrisA) errors.push(`round ${r + 1}: weapon ${both.debrisW} and armor ${both.debrisA} debris were not up together`);
    log('player kettle knock-off (flat 220 J)', await hit('enemy', 'head', 220, 1, 'flat'));
    await sleep(1500);
  }
}
// 마지막: 한 판 더 열어 이전 판의 조각·벗겨진 투구가 남지 않았는지
await openRound(ROUNDS);
const cEnd = await ev(() => window.__count());
counts.push(cEnd);
log('final round start', cEnd);
// 어두운 홀: 캐릭터 조명이 판금을 비추나
if (stage === 'darkhall') {
  await pauseGame();
  await ev(() => window.__cam('enemy', 'chest', 1.6));
  await shot(`${foe}_darkhall_armor_lit`);
  const lit = await ev(() => ({ key: window.game.fighterLight.key, rim: window.game.fighterLight.rim, deficit: window.game.fighterLight.deficit }));
  log('fighterLight', lit);
}
console.log('round-start counts (objects/meshes/geometries/textures/programs/weapon):');
for (const c of counts) console.log(`  ${c.objects} / ${c.meshes} / ${c.geometries} / ${c.textures} / ${c.programs} / ${c.weapon} / ${c.stage}`);
console.log(`plate/helmet sound checks: ${soundChecks} hits (${soundBlocked} blocked by plate)`);
if (!soundBlocked) errors.push('no plate-blocked hit was checked');
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ZERO console errors');
closing = true;
await browser.close();
process.exit(errors.length ? 1 : 0);
