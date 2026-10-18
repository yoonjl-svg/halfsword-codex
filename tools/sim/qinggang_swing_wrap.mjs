// 청강검 바닥 진단 (10/9) 곁 도구 — motion_lab swings·tap 앞에 끼워 무기 스펙·한손 자세표를 이 프로세스 안에서만 바꾼다 (src 는 그대로).
//  W_ID=<무기id> W_STYLE=cut      싸움 방식 바꿈 (versatile → cut: 한손 자세표 바탕이 세이버 표로)
//  W_ID=<무기id> W_WRIST=34       손목 최고 빠르기 덮기
//  W_ID=<무기id> W_HYBRID=1       한손 찌르기 표의 베기 감는 자세 8 곳만 세이버 표로 (qinggang_diag.mjs QG_TABLE=hybrid 와 같은 표)
//  예: W_ID=qinggang W_HYBRID=1 node tools/sim/qinggang_swing_wrap.mjs motion_lab.mjs swings qinggang zornhau zwerch
import { WEAPONS } from '../../src/weapons.js';
import { GUARD_BASE_ONE_SABRE, GUARD_BASE_ONE_THRUST } from '../../src/guards.js';
const w = WEAPONS[process.env.W_ID];
if (process.env.W_STYLE) w.style = process.env.W_STYLE;
if (process.env.W_WRIST) w.controlOverrides = { ...(w.controlOverrides ?? {}), wristVmax: +process.env.W_WRIST };
if (process.env.W_HYBRID === '1') {
  const CHAMBER = ['지붕 (폼 타크)', '어깨 지붕 (폼 타크)', '옆 자세', '바꿈 (베크셀)', '옆 지킴 (네벤후트)', '왼 어깨 지붕 (폼 타크)', '왼 옆 자세', '왼 바꿈 (베크셀)'];
  for (let i = 0; i < GUARD_BASE_ONE_THRUST.length; i++) if (CHAMBER.includes(GUARD_BASE_ONE_THRUST[i].name)) GUARD_BASE_ONE_THRUST[i] = GUARD_BASE_ONE_SABRE[i];
}
const [script, ...rest] = process.argv.slice(2);
const { simPath } = await import('./is_main.mjs');
process.argv = [process.argv[0], simPath(script), ...rest];
await import(new URL('./' + script, import.meta.url));
