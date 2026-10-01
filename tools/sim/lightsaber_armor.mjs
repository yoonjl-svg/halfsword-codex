// 라이트세이버 '고온 플라스마: 갑옷 무시' 확인 (디렉터 12:38 확인할 점 4): 투구(주인공 케틀햇·마르그레테 뿔 투구)와 판금(하인리히·
//  마르그레테 가슴)을 라이트세이버로 칠 때 맨몸처럼 뚫리는가. 같은 점·같은 세기로 롱소드와 견준다. combat.strike 를 그대로 부른다
//  (armor_eval.mjs probe 와 같은 방식 — 칼 자세·빠르기만 맞춰 준다). 결정적.
//   node tools/sim/lightsaber_armor.mjs
import { newRound, THREE } from './harness_m.mjs';
import { LOOKS } from '../../src/looks.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const _st = (b) => {
  const t = b.translation(), r = b.rotation(), c = b.worldCom();
  return { p: new THREE.Vector3(t.x, t.y, t.z), q: new THREE.Quaternion(r.x, r.y, r.z, r.w), com: new THREE.Vector3(c.x, c.y, c.z), v: new THREE.Vector3(), w: new THREE.Vector3() };
};

/** att 의 칼로 vic 의 part 를 local 에서 판정 에너지 E 로 친다 (type 'cut' = 칼날 60%, 'stab' = 칼끝) */
function strike(G, att, vic, part, local, nLocal, E, type) {
  const info = [...G.combat.info.values()];
  const vInfo = info.find((i) => i.fighter === vic && i.part === part);
  const wInfo = info.find((i) => i.fighter === att && i.part === 'blade');
  const P = _st(vInfo.body);
  const point = local.clone().applyQuaternion(P.q).add(P.p);
  const n = nLocal.clone().applyQuaternion(P.q).normalize();
  const sw = _st(wInfo.body);
  const comL = sw.com.clone().sub(sw.p).applyQuaternion(sw.q.clone().invert());
  const HL = att.weaponCfg.hiltLength, BL = att.weaponCfg.bladeLength;
  const up = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const tan = new THREE.Vector3().crossVectors(n, up).normalize();
  let x, y, at;
  if (type === 'stab') (y = n.clone().negate()), (x = tan), (at = HL + BL);
  else (x = n.clone().negate()), (y = tan), (at = HL + 0.6 * BL);
  const z = new THREE.Vector3().crossVectors(x, y);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  const S = { p: point.clone().addScaledVector(y, -at), q, v: new THREE.Vector3(), w: new THREE.Vector3() };
  S.com = S.p.clone().add(comL.clone().applyQuaternion(q));
  const pr = { w: wInfo, v: vInfo };
  S.v.copy(n).multiplyScalar(-10);
  const r0 = G.combat.analyze(pr, point, S, P, true);
  S.v.copy(n).multiplyScalar(-10 * Math.sqrt(E / r0.energy));
  const ac = att.cache, vc = vic.cache;
  att.cache = { sword: S };
  vic.cache = { parts: { [part]: P } };
  vic.hitCooldowns.clear();
  const r = G.combat.strike(pr, point, false);
  att.cache = ac;
  vic.cache = vc;
  return r;
}

const CASES = [
  ['주인공 케틀햇', LOOKS.player, 'head', [0.02, 0.08, 0.05], [0.3, 1, 0.4]],
  ['마르그레테 뿔 투구', CHARACTERS_BY_ID.margarethe.look, 'head', [0.02, 0.08, 0.05], [0.3, 1, 0.4]],
  ['마르그레테 가슴 판금', CHARACTERS_BY_ID.margarethe.look, 'chest', [0.11, 0.0, 0.05], [1, 0, 0]],
  ['하인리히 가슴 판금', CHARACTERS_BY_ID.heinrich.look, 'chest', [0.11, 0.0, 0.05], [1, 0, 0]],
  ['맨몸 가슴 (기준)', LOOKS.enemy, 'chest', [0.11, 0.0, 0.05], [1, 0, 0]],
  ['맨머리 (기준)', LOOKS.enemy, 'head', [0.02, 0.08, 0.05], [0.3, 1, 0.4]],
];
for (const [name, look, part, loc, nl] of CASES) {
  const row = [];
  for (const w of ['longsword', 'lightsaber']) {
    for (const [type, E] of [['cut', 100], ['stab', 60]]) {
      const G = newRound({ seed: 1, look, weapon: 'longsword', weapon2: w });
      const r = strike(G, G.enemy, G.player, part, new THREE.Vector3(...loc), new THREE.Vector3(...nl).normalize(), E, type);
      const armor = r ? (r.helmet ? '투구' : r.plate ? '판금' : '맨몸') : '-';
      row.push(`${w === 'longsword' ? '롱소드' : '라이트세이버'} ${type === 'cut' ? '베기' : '찌르기'} ${E}J: ${r ? `${r.type === 'blunt' ? '막힘(멍)' : `${r.type} 심각도 ${r.severity.toFixed(2)}`} 문턱 ${r.thr?.toFixed(0) ?? '-'} [${armor}]` : '-'}`);
    }
  }
  console.log(`${name}\n   ${row.join('\n   ')}`);
}
