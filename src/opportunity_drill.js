// A labelled, repeatable practice setup using ordinary controller commands.
// The HUD observes game state and never moves bodies or starts an attack.
import { ARENA } from './config.js';

const active = info => info?.active && ['distance', 'flow'].includes(info.model) &&
  ['rapier', 'estoc'].includes(info.weapon) && ['near', 'far'].includes(info.drill);

export function initializeOpportunityDrill(info, enemy) {
  if (!active(info) || !enemy) return false;
  enemy.opportunityDrillState ??= { elapsed: 0, prepared: false };
  return true;
}

export function advanceOpportunityDrill(info, enemy, dt) {
  if (!active(info) || !enemy || !(dt > 0) || !Number.isFinite(dt)) return false;
  const fixture = enemy.opportunityDrillState;
  if (!fixture) return false;
  enemy.move.set(0, 0);
  enemy.handOffset.set(.02, .4);
  enemy.inputActive = false;
  enemy.handHeld = true;
  if (!fixture.prepared && fixture.elapsed >= 2 - 1e-6) {
    enemy.limbs.legF = .2;
    enemy.limbs.legB = .2;
    enemy.knockDown(false);
    fixture.prepared = true;
  }
  fixture.elapsed += dt;
  return true;
}

export function mountOpportunityDrill(info, onRestart) {
  if (!active(info) || typeof document === 'undefined') return null;
  const existing = document.getElementById('opportunityDrill');
  if (existing) return existing;
  const panel = document.createElement('aside');
  panel.id = 'opportunityDrill'; panel.hidden = true;
  panel.style.cssText = 'position:fixed;left:max(8px,env(safe-area-inset-left));top:max(8px,env(safe-area-inset-top));z-index:3;max-width:min(260px,calc(50vw - 44px));padding:8px;border-radius:8px;background:rgba(24,18,14,.82);color:#f5ead7;font-size:12px;line-height:1.35;pointer-events:none';
  const title = document.createElement('strong');
  title.textContent = '반격 없는 무릎 연습 상대'; title.style.display = 'block';
  const variant = document.createElement('span');
  variant.textContent = `${info.model === 'flow' ? 'B · 빠른 준비' : 'A · 기존 준비'} / ${info.drill === 'near' ? '가까운 거리' : '먼 거리'}`;
  variant.style.display = 'block';
  const status = document.createElement('span');
  status.id = 'opportunityDrillStatus'; status.style.cssText = 'display:block;margin:4px 0';
  status.textContent = '연습 준비 약 6초 · 잠시 기다리세요';
  const repeat = document.createElement('button');
  repeat.type = 'button'; repeat.id = 'opportunityDrillRepeat'; repeat.textContent = '같은 거리 다시';
  repeat.style.cssText = 'pointer-events:auto;touch-action:manipulation;min-height:44px;padding:6px 10px;font:inherit';
  repeat.addEventListener('click', async event => {
    event.stopPropagation();
    if (repeat.disabled) return;
    repeat.disabled = true;
    try { await onRestart(); } finally { repeat.disabled = false; }
  });
  panel.append(title, variant, status, repeat);
  document.body.append(panel);
  return panel;
}

function statusText(player, enemy) {
  if (!player || !enemy) return '연습 준비 중';
  if (!player.alive) return '쓰러졌습니다 · 같은 거리 다시';
  if (!enemy.alive) return '상대가 쓰러졌습니다 · 같은 거리 다시';
  const skill = player.skill;
  if (skill?.tap) return skill.tap.down ? '내려찍는 중 · 실제 접촉으로 판정' : '찌르는 중 · 실제 접촉으로 판정';
  const request = skill?.thrustRange;
  if (request) {
    if (request.phase === 'align') return '칼끝을 맞추는 중 → 찌르기';
    return request.measure?.move < 0 ? '물러서며 준비 → 찌르기' : '다가서며 준비 → 찌르기';
  }
  if (player.fightT < Math.max(6, ARENA.startHold) - 1e-6) return '연습 준비 약 6초 · 잠시 기다리세요';
  if (!player.armed) return '무기를 놓쳤습니다 · 같은 거리 다시';
  if (!['stand', 'kneel'].includes(player.state)) return '자세를 회복하는 중 · 기다리거나 다시 시작';
  if (enemy.state === 'down') return '상대가 넘어졌습니다 · 같은 거리 다시';
  if (enemy.state !== 'kneel') return '연습 준비 약 6초 · 상대가 무릎을 꿇는 중';
  const last = skill?.lastThrustRange;
  if (last?.reason === 'manual-input') return '수동 입력으로 준비 취소 · 스틱을 놓고 다시 톡';
  if (last && last.reason !== 'committed') return '준비 중단 · 스틱을 놓고 다시 톡 / 같은 거리 다시';
  if (last?.reason === 'committed') return '공격 끝 · 다시 톡 / 같은 거리 다시';
  return '스틱을 놓고 톡 · 간격 준비 후 찌르기';
}

export function updateOpportunityDrill(info, player, enemy, state) {
  if (typeof document === 'undefined') return;
  const panel = document.getElementById('opportunityDrill');
  if (!panel) return;
  const visible = !!active(info) && state === 'fight';
  if (panel.hidden === visible) panel.hidden = !visible;
  if (!visible) return;
  const status = document.getElementById('opportunityDrillStatus');
  const text = statusText(player, enemy);
  if (status && status.textContent !== text) status.textContent = text;
}
