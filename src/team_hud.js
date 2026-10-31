// ─────────────────────────────────────────────────────────────
//  동시 대전 화면 — 4단계 최소 (10/29 · docs/strike/team_fight_2026-10-29.md §11)
//   이름 · 체력 목록 (사장님 10/29 22:3x '왼쪽 상단에 작게 이름과 체력바 … 글자 크기와 스타일은 전투 중 기술 상세 설명 표기할 때 쓰는 것으로 · 체력바도 기력바 크기보다 작게'
//    · 10/30 01:0x '이름만 표기되게 … 체력바를 이름 아래에 … 한 줄에 이름은 두 개씩 … 적 한줄 아군 한줄 … 아군 체력바 색은 녹색 계열'):
//    왼쪽 위 #teamList (index.html — 글자 = 기술 칸 둘째 줄 .slot small 과 같은 크기 · 굵기 · 색 · 외곽선) · 짧은 이름(f.shortName — short_names.js) 밑에 막대 40 × 2 px(기력 막대 56 × 2 의 약 70 %) ·
//    한 줄에 둘 — 첫 줄 상대 · 둘째 줄 내 편 · 막대 색 HP_COLORS(아군 녹색 · 적 붉은색) · 죽으면 흐림.
//    생사전 판은 무대 이름을 감추고 그 자리 · 시험 판은 무대 이름 밑 (그 전의 머리 위 체력 막대 · 정지 단추 밑 막대 묶음은 뺌)
//   화면 밖 화살표: 살아 있는 싸움꾼이 화면 밖(또는 카메라 뒤)이면 화면 가장자리에 그쪽을 가리키는 작은 화살표 (편 색)
//   편 표시: 화면 안의 산 상대(1 편) 머리 위에 같은 화살표를 작게 붉게 아래로 — 무명 검객처럼 겉모습이 같아도 편이 보이게 (내 편 금색 세모는 뺌 — 사장님 10/29 20:3x '우리편 머리의 금색 세모는 없어도 돼')
//   카메라 물러남 몫: 보는 몸(focus)에서 TEAM_FIGHT.cam.radius 안의 산 싸움꾼이 모두 들어오게 뒤로 · 위로 (main.js updateCamera 가 부드럽게)
//  1:1 판에서는 만들지도 부르지도 않는다 (main.js — teamRun 이 있을 때만)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { TEAM_FIGHT, VITALS, CAMERA } from './config.js';
import { BLOOD_RED } from './blood_palette.js';
import { hexToOklch, oklchToCss } from './oklch.js';

/** 적 색 (사장님 10/30 02:0x '적군 체력바 색과 적군 머리 위 기호 색을 현재 전투에서 쓰고 있는 피 색으로 바꾸자. 저기서 채도만 낮춰서.'):
 *  피 색 BLOOD_RED.splash #8a0000 = OKLCH(0.398 0.163 29°) → 채도만 × TEAM_FIGHT.hudColor.foeChromaK(0.7) = #792820 */
const BLOOD_LCH = hexToOklch(BLOOD_RED.splash);
const FOE_LCH = [BLOOD_LCH[0], BLOOD_LCH[1] * TEAM_FIGHT.hudColor.foeChromaK, BLOOD_LCH[2]];
export const FOE_COLOR = oklchToCss(FOE_LCH);
/** 아군 체력 막대 녹색 (사장님 10/30 01:0x '아군 체력바 색은 녹색 계열로 … 적군 체력바 색과 톤과 채도와 명도는 어울리게'): 적 색과 같은 밝기 · 채도 · 색상만 allyHue°(145) = #10561a */
export const ALLY_HP_COLOR = oklchToCss([FOE_LCH[0], FOE_LCH[1], TEAM_FIGHT.hudColor.allyHue]);
/** 편 색: 0 편(내 편) 금색(--c-accent 와 같음) · 1 편 = 적 색 — 화면 밖 화살표 · 머리 위 세모 */
export const TEAM_COLORS = Object.freeze(['#d9a441', FOE_COLOR]);
/** 체력 막대 색: 아군 녹색 · 적 = 적 색 */
export const HP_COLORS = Object.freeze([ALLY_HP_COLOR, FOE_COLOR]);

/** 체력 몫 0 ~ 1 (피 1 = 1 · 쓰러져 죽는 문턱 = 0 · 죽으면 0) */
export const hpShare = (f) => (f.alive ? Math.min(1, Math.max(0, (f.blood - VITALS.collapseBlood) / (1 - VITALS.collapseBlood))) : 0);

/**
 * 카메라 물러남 몫 (m): 보는 몸에서 radius 안의 산 싸움꾼이 모두 화면에 들게 — 어깨 너머 카메라(보는 몸 뒤 CAMERA.back · 오른쪽 shoulder · 바라보는 쪽 dir)에서
 *  그 몸의 깊이(카메라 앞 수평 거리)와 옆 거리로: 옆 거리 ≤ 깊이 × 가로 반폭(tan(fov/2) × 화면 비) × fit · 깊이 ≥ minDepth 가 되도록 뒤로 물러날 몫의 가장 큰 값을 0 ~ max 로.
 *  돌려줌 { back, up } — back 만큼 뒤로 · up 만큼 위로 (main.js 가 시간 상수 tau 로 거른다). 카메라 뒤로 간 몸은 max 까지만 (화면 밖 화살표가 가리킴)
 */
export function teamFramePull(focus, fighters, dir, aspect, C = TEAM_FIGHT.cam, cam = CAMERA) {
  const p = focus.pelvisPos;
  const rx = -dir.z;
  const rz = dir.x;
  const tanH = Math.tan((cam.fov * Math.PI) / 360) * aspect * C.fit;
  let need = 0;
  for (const g of fighters) {
    if (g === focus || !g.alive) continue;
    const q = g.bodies.pelvis.translation();
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    if (Math.hypot(dx, dz) > C.radius) continue;
    const depth = dx * dir.x + dz * dir.z + cam.back;
    const lat = dx * rx + dz * rz - cam.shoulder;
    need = Math.max(need, Math.abs(lat) / tanH - depth, C.minDepth - depth);
  }
  const back = Math.min(C.max, Math.max(0, need));
  return { back, up: back * C.upK };
}

export function createTeamHud(doc = document) {
  const root = doc.createElement('div');
  root.id = 'teamHud';
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2;display:none;font-family:var(--font-ui, system-ui);';
  const arrows = doc.createElement('div');
  arrows.style.cssText = 'position:absolute;inset:0;';
  const list = doc.createElement('div');
  list.id = 'teamList';
  list.setAttribute('aria-label', '싸움꾼 체력');
  root.append(arrows, list);
  doc.body.appendChild(root);
  let marks = [];
  let rows = [];
  const _v = new THREE.Vector3();

  /** 판을 열 때: 싸움꾼마다 화살표 하나 (focus 는 화면 밖 화살표 없음 — 늘 화면 안) · 왼쪽 위 이름 · 체력 목록 (첫 줄 상대 · 둘째 줄 내 편 — 줄마다 자리 차례 · 한 칸 = 짧은 이름 위 · 막대 밑).
   *  below = 그 밑에 둘 요소(무대 이름 — 생사전은 null) */
  function show(fighters, below = null) {
    arrows.replaceChildren();
    list.replaceChildren();
    rows = [];
    for (const team of [1, 0]) {
      const line = doc.createElement('div');
      line.className = 'tl-row';
      line.dataset.team = String(team);
      for (const f of fighters.filter((g) => g.team === team).sort((a, b) => a.index - b.index)) {
        const cell = doc.createElement('div');
        cell.className = 'tl-c';
        const n = doc.createElement('span');
        n.className = 'tl-n';
        n.textContent = f.shortName ?? f.name ?? '';
        const bar = doc.createElement('span');
        bar.className = 'tl-b';
        bar.setAttribute('role', 'meter');
        bar.setAttribute('aria-label', `${f.name ?? ''} 체력`);
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', '100');
        const fill = doc.createElement('span');
        fill.style.background = HP_COLORS[team] ?? '#888';
        bar.append(fill);
        cell.append(n, bar);
        line.append(cell);
        rows.push({ f, cell, bar, fill, last: -1, dead: false });
      }
      if (line.childElementCount) list.append(line);
    }
    const r = below?.getBoundingClientRect?.();
    list.style.top = r && r.height > 0 ? `${Math.round(r.bottom + 6)}px` : '';
    marks = fighters.map((f) => {
      const a = doc.createElement('div');
      a.className = 'th-arrow';
      const color = TEAM_COLORS[f.team] ?? '#888';
      a.style.cssText = `position:absolute;left:0;top:0;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:13px solid ${color};filter:drop-shadow(0 0 2px #000);display:none;`;
      arrows.appendChild(a);
      return { f, a };
    });
    root.style.display = '';
  }

  function hide() {
    root.style.display = 'none';
  }

  /** 프레임마다: 화살표 · 편 표시 (visible 거짓이면 모두 숨김 — 메뉴 · 판 끝) · 목록 체력 몫 (늘). me = 사람 몸 (지켜보기면 null) */
  function update(camera, focus, visible, me = null, width = window.innerWidth, height = window.innerHeight) {
    for (const r of rows) {
      const v = hpShare(r.f);
      if (Math.abs(v - r.last) > 0.004) {
        r.last = v;
        r.fill.style.transform = `scaleX(${v.toFixed(3)})`;
        r.bar.setAttribute('aria-valuenow', String(Math.round(v * 100)));
      }
      const dead = !r.f.alive;
      if (dead !== r.dead) (r.dead = dead), r.cell.classList.toggle('dead', dead);
    }
    const m = 22; // 가장자리 여백 (px)
    for (const { f, a } of marks) {
      if (!visible || !f.alive || (f === focus && f === me)) {
        a.style.display = 'none';
        continue;
      }
      _v.copy(f.bodies.chest.translation()).project(camera);
      const behind = _v.z > 1;
      let x = behind ? -_v.x : _v.x;
      let y = behind ? -_v.y : _v.y;
      if (!behind && Math.abs(x) <= 1 && Math.abs(y) <= 1) {
        // 화면 안: 상대(1 편)만 머리 위(기력 · 체력 막대 위)에 작게 아래로 — 내 편은 없음
        const h = f.bodies.head.translation();
        _v.set(h.x, h.y + 0.5, h.z).project(camera);
        if (f.team === 0 || f === me || _v.z > 1 || Math.abs(_v.x) > 1 || Math.abs(_v.y) > 1) {
          a.style.display = 'none';
          continue;
        }
        a.style.display = '';
        a.dataset.kind = 'head';
        a.style.opacity = '0.85';
        a.style.transform = `translate(${(((_v.x + 1) / 2) * width - 7).toFixed(1)}px, ${(((1 - _v.y) / 2) * height - 6.5).toFixed(1)}px) rotate(${Math.PI.toFixed(3)}rad) scale(0.6)`;
        continue;
      }
      if (f === focus) {
        a.style.display = 'none';
        continue;
      }
      a.style.opacity = '1';
      a.dataset.kind = 'edge';
      // 화면 가운데 → 그 몸 방향의 선이 가장자리(여백 안)와 만나는 곳
      const s = 1 / Math.max(Math.abs(x) / (1 - (2 * m) / width), Math.abs(y) / (1 - (2 * m) / height), 1e-6);
      x *= s;
      y *= s;
      const px = ((x + 1) / 2) * width;
      const py = ((1 - y) / 2) * height;
      const ang = Math.atan2(x * width, y * height); // 위(+y)가 0 · 시계 방향
      a.style.display = '';
      a.style.transform = `translate(${(px - 7).toFixed(1)}px, ${(py - 6.5).toFixed(1)}px) rotate(${ang.toFixed(3)}rad)`;
    }
  }

  return { show, hide, update, root };
}
