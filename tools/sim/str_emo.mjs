// 근력·감정 옵션 (측정 도구 공용) — tap_thrust.mjs · down_hits.mjs · down_ai.mjs 가 쓴다
//  --str=0.85      플레이어 근력 (캐릭터 근력은 characters.js level.strength: 이졸데 0.85 … 브란 1.3, 기본 1)
//  --foeStr=1.3    상대(적) 근력
//  --emo=off       감정 고유 능력을 끈다 (EMO_ABILITY.enabled = false — 게임의 ?emo=0 과 같다)
//  --emoP=anger:1  플레이어 감정을 고정한다 (감정:세기 0~1). 하네스의 플레이어는 감정 판정이 없다
//  --emoE=fear:1   상대 감정을 고정한다 — 단 AI 가 움직이는 판에서는 AI 가 매 판단마다 제 감정으로 덮어쓴다
//  옵션이 없으면 아무것도 바꾸지 않는다 (예전 출력 그대로)
import { EMO_ABILITY, emoMods } from '../../src/emotions.js';

const parseEmo = (s) => {
  if (!s) return null;
  const [e, I] = s.split(':');
  return { e, I: I == null ? 1 : +I };
};

/** 명령줄 인자에서 옵션을 읽는다 (--emo=off 는 여기서 바로 건다) */
export function strEmoOpts(args) {
  const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
  const num = (k) => (opt(k) != null ? +opt(k) : null);
  const o = { str: num('str'), foeStr: num('foeStr'), emo: opt('emo') ?? 'on', emoP: parseEmo(opt('emoP')), emoE: parseEmo(opt('emoE')) };
  if (o.emo === 'off') EMO_ABILITY.enabled = false;
  return o;
}

/** newRound 직후에 부른다 */
export function applyStrEmo(G, o) {
  if (!o) return;
  if (o.str != null) G.player.strength = o.str;
  if (o.foeStr != null) G.enemy.strength = o.foeStr;
  if (o.emoP) G.player.emoMods = emoMods(o.emoP.e, o.emoP.I);
  if (o.emoE) G.enemy.emoMods = emoMods(o.emoE.e, o.emoE.I);
}

/** 출력 머리줄용 한 줄 설명 */
export function strEmoLabel(o) {
  const s = [];
  if (o.str != null) s.push(`플레이어 근력 ${o.str}`);
  if (o.foeStr != null) s.push(`상대 근력 ${o.foeStr}`);
  s.push(o.emo === 'off' ? '감정 능력 꺼짐' : '감정 능력 켜짐');
  if (o.emoP) s.push(`플레이어 감정 ${o.emoP.e}:${o.emoP.I}`);
  if (o.emoE) s.push(`상대 감정 ${o.emoE.e}:${o.emoE.I}`);
  return s.join(' · ');
}
