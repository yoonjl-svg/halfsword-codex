// 대기실 스킬 화면 (10/21 사장님 확정 스킬트리 — docs/design/skill_tree_2026-10-21/ · IMPLEMENTATION.md §5 · §8) — 유파 탭 다섯 · 탭마다 11 칸 트리.
//  사장님 10/21 18:3x '디아블로나 WOW처럼. 어떤 스킬을 찍으면 다음 스킬을 찍을 수 있고, 어떤 건 분기점이 되기도 … 유파마다 분기점이나 갈래의 모양이 조금씩 다르면 좋아' ·
//   18:4x '시작은 무조건 보법부터 … 보법 심화는 선택적인 곁가지로'. (전: 10/16 별자리 다섯 권 — 옛 스킬북은 skill_tree_store.js 가 한 번 거두고 돌려줌)
//  칸 = 둥근 원 안의 그림 + 원 밑 기술 이름 (사장님 10/22 00:2x '기존에 가지고 있던 아이콘이 사라져서 서운한데?' · 00:4x '보법1 보법2 이런 건 우리가 보려고 만든 범주 구분 … 기술 이름이 보이는 게' ·
//   01:2x '스킬북 아이콘에만 원형 테두리가 있고 텍스트는 그 밑에 나오는 게 낫겠어. 초기화도 원형으로'):
//   그림은 옛 스킬북 그림을 갈래대로(skill_tree_icons.js) · 원 테두리 = 갈래 색(--tier-*) · 이름은 칸 name(원 밑 · 낱말 경계에서 두 줄, 좁으면 세 줄 — 9 px 밑으로 줄이지 않음) ·
//   갈래 말(보법 I · 막기 II · 심화 …)은 상세 카드 갈래 줄에만. 누르는 자리 = 원 + 이름 (폭 · 높이 40 px 이상 — 원보다 큰 투명 자리).
//   01:5x '원형 테두리 크기를 지금보다 작게. 아이콘에 fit하게 맞춰' · 08:2x '한 크기로 통일': 원은 모든 칸 같은 지름(폰 가로 32 px) · 그림을 그림마다 키우거나 줄여
//   그 그림의 '가장 작은 둘레 원'(skill_tree_icon_fit.js) + 틈 1.5 px = 원 안쪽이 되게(원을 꼭 채움) · 그림은 둘레 원 가운데가 원 가운데에 오게 놓음.
//  칸 상태 넷 (skill_tree_data.js nodeState — 원에 보임): 잠김 = 원 · 그림 조금 흐림 · 이름 보조 색(앞 칸이 모자람) · 배울 수 있음 = 원 바깥 금색 테 + 원 아래 가장자리 값 알약 ·
//   익힘 = 원 테두리 밝게 + 빛 + 갈래 색 안쪽 · 준비 중 = 원 테두리 점선 · 그림 잿빛 + 원 아래 가장자리 '준비 중' 알약(닫힌 비기 · 일본 손목 치기 심화).
//  줄 = 그림 모양 그대로(앞 칸 원 아래 가장자리에서 이름표 뒤로 곧게 내려와 → 뒤 칸 원 위 가장자리까지 곡선): 곁가지(편지 · 보법 II)는 점선 ·
//   편지는 뿌리와 같은 줄 왼쪽(사장님 10/22 02:1x) — 뿌리 원 왼쪽 가장자리 → 편지 원 오른쪽 가장자리 수평 점선 ·
//   앞 칸을 '모두' 익혀야 하는 칸은 원 위에 금색 점 · 독일 2단계 관문은 두 줄 사이 가로 띠 하나.
//  칸을 누르면 상세 카드(유파 탭까지 덮음): 그림 · 이름(원어는 여기서만 — 화면 글 지침 §1) · 검술서 오의(lore) · 출처(src) · 효과 한 줄(작게) · 갈래 · 유파 · 상태 · 먼저 익힐 칸(잠김일 때) · 값 · '배우기'.
//   화면 읽기 차례 = 이름 · 오의 · 출처 · 효과 (사장님 10/22 00:5x '검술서나 참고 문헌에서의 오의를 밝힌 예전 방식이 더 나았던 거 같아' — 갈래 줄은 보이기만 위, 읽기는 효과 뒤).
//  유파 초기화: 판 맨 위 오른쪽(뿌리 칸 줄 · 판과 함께 내려감) 둥근 단추 — 칸과 같은 원 꼴(머리 그림 + 1 에 맞춘 원 · 1 = 값 알약 글자) · 원 밑 '초기화'(칸 이름과 같은 글자 크기 · 굵기 · 색) ·
//   누르는 자리 40 px 이상 (10/22 '너무 낮아 누르기 힘듭니다' · '초기화도 원형으로' · 02:0x '초기화만 글자가 더 크네. 스킬과 같게') ·
//   머리 1 · 확인 단계 · 익힌 칸이 없거나 머리 0 이면 못 누름.
//  꾸밈: 판 틀은 픽셀 결(창의 액자 1 — 겉) · 칸 · 줄 · 카드는 매끈(속 — 스타일 규칙 '겉은 픽셀, 속은 매끈', docs/design_language.md §5). 색은 싸움 화면 토큰과 등급 색(--tier-*) — 글자는 entrance_type.css, 자리는 lobby.css '스킬' 칸.
//  자리(layout): 모든 유파가 판 안에서 아래로 내려 보는 판 (사장님 10/22 00:3x '이탈리아 스킬트리처럼, 어차피 … 스크롤이 필요하니까, 지금보다 간격을 더 넓고 자연스럽게') —
//   원 · 줄 간격은 판 폭에서 셈(높이에 맞춰 줄이지 않음) · 가로 내려 보기 없음(01:3x '가로 스크롤은 하지 마') — 줄마다 칸 폭(원 · 이름)을 판 폭 안에 나눠 넣고,
//   좁으면 넓은 이름부터 한 줄 더 접고(세 줄까지) · 그래도 안 들면 그 줄 원만 작게 · 설계 자리(cx)에서 덜 밀리게.
//   첫 화면에 뿌리 줄이 보이고 아래 끝은 흐림 + 꺾쇠(더 있음). 잰 도구 tools/browser/skill_tree_layout.mjs
import { TREE_SCHOOLS, TREE, NODE_CAT, nodesOf, nodeOf, nodeState, canLearn, isClosed, nodeEff, RESET_HEADS } from './skill_tree_data.js';
import { readLearned, learnNode, resetPreview, resetSchool } from './skill_tree_store.js';
import { readProgress } from './lobby_progress.js';
import { TRADITIONS, playerSecretDef } from './schools.js';
import { PLAYER_UNIQUE, uniqueDef } from './unique_assist.js';
import { COIN_SRC, POUCH_SRC } from './wallet_icons.js';
import { nodeIconSrc, nodeIconKey } from './skill_tree_icons.js';
import { ICON_FIT } from './skill_tree_icon_fit.js';

// 값 그림 — 대기실 지갑과 같은 금화 · 천 주머니(wallet_icons.js — 꾸밈이라 감춤: 단추 이름이 '금화 N · 머리 N' 을 읽는다)
const COIN = `<img class="price-icon" src="${COIN_SRC}" alt="" aria-hidden="true" draggable="false">`;
const POUCH = `<img class="price-icon" src="${POUCH_SRC}" alt="" aria-hidden="true" draggable="false">`;
const won = (v) => v.toLocaleString('ko-KR');
/** 값 표시 (그림 + 숫자 — 글 없음): 금화만 · 머리만 · 둘 다 */
const priceHtml = (coins, heads) => [coins ? `<span class="price-part">${COIN}${won(coins)}</span>` : '', heads ? `<span class="price-part">${POUCH}${won(heads)}</span>` : ''].join('');
const priceWords = (coins, heads) => [coins ? `금화 ${won(coins)}` : '', heads ? `머리 ${won(heads)}` : ''].filter(Boolean).join(' · ');
const STATE_KO = { learned: '익힘', open: '배울 수 있음', locked: '잠김', closed: '준비 중' };

// 원어 (사장님 10/19 02:0x '대기실 스킬에서만 원어 병기') — 패시브 이름 · 원어 (config SCHOOL_PASSIVE 이름 — 10/21)
const PASSIVE_NAME = {
  german: ['인데스', 'Indes'],
  italian: ['곧은 선 (리네아 레타)', 'linea retta'],
  iberian: ['손목 힘', null],
  japanese: ['기다림과 침 (켄타이)', '懸待'],
  chinese: ['숨 바꾸기 (토납)', '吐納'],
};
/** 기술 이름: '뜻 (소리)' + 원어 → '뜻 (소리 · 원어)'. 원어가 없으면 그대로 */
export function withOrig(nameKo, orig) {
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(nameKo ?? '');
  if (!orig) return nameKo ?? '';
  return m ? `${m[1]} (${m[2]} · ${orig})` : `${nameKo} (${orig})`;
}
const ROLE_KO = { enh: '강화동작', step: '걸음 기술', chain: '이어 긋기' }; // 공지와 같은 말 (10/22 '걸음 명령' → '걸음 기술')
/** 칸 이름 (판 칸 · 알림 · 화면 읽기 · 먼저 익힐 칸 — 칸 name, 사장님 10/22. 옛 자료에 없으면 두 줄 이어서) */
const nameOf = (n) => n.name ?? `${n.l1} ${n.l2}`;
/** 상세 카드 제목 · 갈래 글 (닫힌 칸은 판 칸과 같은 이름 — 원어 없이) */
export function nodeTitle(school, n) {
  const cat = NODE_CAT[n.cat];
  if (isClosed(school, n)) return { title: nameOf(n), kind: cat.label };
  if (n.u) {
    const e = PLAYER_UNIQUE[school]?.find((x) => x.name === n.u), U = e && uniqueDef(school, e);
    return { title: U ? withOrig(U.nameKo, U.orig) : nameOf(n), kind: e ? `${cat.label} · ${ROLE_KO[e.role] ?? ''}`.replace(/ · $/, '') : cat.label };
  }
  if (n.cat === 'passive') { const [nm, o] = PASSIVE_NAME[school] ?? [n.l2, null]; return { title: `패시브 · ${withOrig(nm, o)}`, kind: cat.label }; }
  if (n.cat === 'secret') { const S = playerSecretDef(school); return { title: `비기 · ${S ? withOrig(S.nameKo, S.orig) : n.l2}`, kind: cat.label }; } // 10/23 비기 이름 = 원어 독음 → '고노센 (後の先)' · 옛 '뜻 (소리)' 꼴이면 '뜻 (소리 · 원어)'
  return { title: withOrig(n.title ?? `${n.l1} · ${n.l2}`, n.orig), kind: cat.label };
}

// 글 폭 (em) — 한글 1 · 빈칸 0.3 · 그 밖 0.6
const emWidth = (t) => [...String(t)].reduce((a, ch) => a + (/[가-힣]/.test(ch) ? 1 : ch === ' ' ? 0.3 : 0.62), 0);
const lineEm = (lines) => Math.max(...lines.map(emWidth));
/**
 * 칸 이름 접기 후보 (f = 이름 글자 px): 한 줄 · 두 줄 · 세 줄 가운데 줄마다 가장 고른 나눔 — 낱말 경계에서만(한글은 낱말 가운데서 안 끊음 · entrance_type.css keep-all).
 *  list = 좁아지는 차례(같은 폭이면 줄이 적은 쪽만) · pref = 바라는 접기(여섯 자 안팎은 한 줄 · 넘으면 두 줄)
 *  예: '뉘른베르크에서 온 편지' → ['뉘른베르크에서', '온 편지'] · '머리 위 돌려 베기' → ['머리 위', '돌려 베기'] (더 좁으면 세 줄 ['머리 위', '돌려', '베기'])
 */
export function nameOptions(name, f) {
  const w = String(name).split(' '), out = [];
  for (let k = 1; k <= Math.min(3, w.length); k++) {
    let best = null;
    const rec = (start, left, acc) => {
      if (left === 1) { const lines = [...acc, w.slice(start).join(' ')], em = lineEm(lines); if (!best || em < best.em - 1e-9) best = { lines, em }; return; }
      for (let e = start + 1; e <= w.length - left + 1; e++) rec(e, left - 1, [...acc, w.slice(start, e).join(' ')]);
    };
    rec(0, k, []);
    if (best && (!out.length || best.em < out[out.length - 1].em - 1e-9)) out.push({ ...best, w: Math.ceil(best.em * f) + 2 });
  }
  return { list: out, pref: out[0].em <= 6 || out.length === 1 ? 0 : 1 };
}
/**
 * 한 줄 칸 자리 (P = [{ c 바라는 가운데, w 폭 }] 왼쪽부터): 이웃 사이 틈 gap · 판 가장자리 edge 안 — 부딪는 칸만 밀어냄(앞뒤로 몇 번).
 *  돌려줌 { ok 판 폭에 다 듦, p 가운데들, shift 가장 많이 밀린 px }
 */
function relaxRow(P, W, gap, edge) {
  const n = P.length, p = P.map((q) => q.c);
  if (P.reduce((a, q) => a + q.w, 0) + gap * (n - 1) > W - 2 * edge + 0.01) return { ok: false, p, shift: Infinity };
  const clamp = () => { for (let i = 0; i < n; i++) p[i] = Math.min(Math.max(p[i], edge + P[i].w / 2), W - edge - P[i].w / 2); };
  for (let it = 0; it < 40; it++) {
    clamp();
    for (let i = 1; i < n; i++) p[i] = Math.max(p[i], p[i - 1] + (P[i - 1].w + P[i].w) / 2 + gap);
    clamp();
    for (let i = n - 2; i >= 0; i--) p[i] = Math.min(p[i], p[i + 1] - (P[i].w + P[i + 1].w) / 2 - gap);
  }
  clamp();
  return { ok: true, p, shift: Math.max(0, ...p.map((x, i) => Math.abs(x - P[i].c))) };
}
/**
 * 원을 꼭 채우는 그림 (D = 원 지름 px — 모든 칸 같음 · 그림 256 × 336): 그림 둘레 원 + 틈 1.5 = 원 안쪽이 되게 그림 배율을 그림마다 정함 ·
 *  그림 자리 = 둘레 원 가운데가 원 가운데에 오게 (원 안쪽 기준 left · top px) — 사장님 10/22 08:2x '한 크기로 통일'
 */
const RING_GAP = 1.5, RING_EDGE = 1.5;
function ringFit(key, D) {
  const [fx, fy, fr] = ICON_FIT[key] ?? [0.5, 0.5, 0.5], c = D / 2 - RING_EDGE, ih = (c - RING_GAP) / fr, iw = (ih * 256) / 336;
  return { D, ih, iw, left: c - fx * iw, top: c - fy * ih };
}
/**
 * 한 줄 칸 폭 · 접기 정하기: 바라는 접기에서 시작해 판 폭에 안 들거나 너무 밀리면(이웃 간격의 30 % 넘게) 가장 넓은 칸을 한 단계 더 접음 (세 줄까지).
 *  칸 폭 = max(그 칸 원 지름 it.D, 누르는 자리 hit, 이름 폭). 돌려줌 { ok, p, w, pick } — ok 가 아니면 부르는 쪽이 그림(원)을 줄인다
 */
function fitRow(items, W, gap, edge, hit) {
  const pick = items.map((it) => it.opts.pref);
  const width = (i, k = pick[i]) => Math.max(items[i].D, hit, items[i].opts.list[k].w);
  let space = Infinity;
  for (let i = 1; i < items.length; i++) space = Math.min(space, items[i].c - items[i - 1].c);
  const tooFar = Number.isFinite(space) ? 0.3 * space : Infinity;
  const place = () => relaxRow(items.map((it, i) => ({ c: it.c, w: width(i) })), W, gap, edge);
  let r = place();
  while (!r.ok || r.shift > tooFar) {
    let k = -1;
    items.forEach((it, i) => { if (it.opts.list[pick[i] + 1] && width(i, pick[i] + 1) < width(i) && (k < 0 || width(i) > width(k))) k = i; });
    if (k < 0) break;
    pick[k]++;
    r = place();
  }
  return { ok: r.ok, p: r.p, w: items.map((_, i) => width(i)), pick };
}

/**
 * root: 스킬 칸(Shadow root 안의 #skillTreeHost) · test: 테스트 경로(모든 칸 익힘 — 배우기 · 초기화 없음) · onWallet(): 금화 · 머리 · 레벨이 바뀌면(대기실 내 정보 칸 다시 그리기) ·
 * announce(text): 화면 읽기 알림
 */
export function mountSkillTree(root, { test = false, onWallet = () => {}, announce = () => {} } = {}) {
  root.innerHTML = `<div class="school-tabs" role="tablist" aria-label="유파">${TREE_SCHOOLS.map((s, i) => `<button role="tab" data-school="${s}" aria-selected="${i === 0}" tabindex="${i ? -1 : 0}">${TRADITIONS[s].nameKo}</button>`).join('')}</div>
    <div class="tree-frame card-frame"><div class="tree-scroll"><div class="tree-board" role="tabpanel"><svg class="tree-links" aria-hidden="true"></svg><div class="tree-nodes"></div>
      <button type="button" class="tree-reset" id="treeReset"><span class="reset-ring"><span class="price-part">${POUCH}${RESET_HEADS}</span></span><span class="reset-label">초기화</span></button></div></div>
    <section class="reset-confirm" hidden aria-labelledby="resetTitle"><b id="resetTitle" tabindex="-1"></b><p id="resetBody"></p><p id="resetPrice" class="detail-price"></p>
      <div class="confirm-actions"><button type="button" class="secondary" id="resetCancel">취소</button><button type="button" class="primary" id="resetOk">초기화</button></div>
    </section></div>
    <section class="node-detail" hidden aria-labelledby="nodeTitle"><button type="button" class="detail-close" aria-label="설명 닫기">×</button>
      <img class="detail-icon" id="nodeIcon" alt="" aria-hidden="true" draggable="false"><b id="nodeTitle" class="detail-title" tabindex="-1"></b>
      <figure class="detail-lore" id="nodeLoreBox"><blockquote id="nodeLore"></blockquote><figcaption id="nodeSrc"></figcaption></figure>
      <div class="detail-body"><p id="nodeEffect" class="detail-effect"></p><p id="nodePre" class="detail-pre"></p><p id="nodeState" class="detail-state" role="status"></p></div>
      <small id="nodeMeta" class="detail-meta"></small>
      <div class="detail-act"><p id="nodePrice" class="detail-price"></p><div class="detail-actions start-actions"><button type="button" id="learnNode">배우기</button></div></div>
    </section>`;
  const events = new AbortController();
  const on = (el, type, fn) => el.addEventListener(type, fn, { signal: events.signal });
  const $ = (sel) => root.querySelector(sel);
  const tabs = [...root.querySelectorAll('.school-tabs [role=tab]')];
  const frame = $('.tree-frame'), scroller = $('.tree-scroll'), board = $('.tree-board');
  let school = TREE_SCHOOLS[0], selected = null, lastNode = null, geo = null;
  const learnedNow = () => (test ? new Set(nodesOf(school).map((n) => n.id)) : readLearned()[school]);
  const stateOf = (n, learned) => (test && !isClosed(school, n) ? 'learned' : nodeState(school, n, learned));

  // ── 자리 셈: 판 폭에서 원 · 이름 · 줄 간격 (높이는 판에 맞춰 줄이지 않는다 — 넘치면 판 안에서 아래로 내려 봄 · 가로는 늘 판 폭 안) ──
  function layout() {
    const W = scroller.clientWidth, H = scroller.clientHeight;
    if (!W || !H) return null;
    const nodes = nodesOf(school), rows = Math.max(...nodes.map((n) => n.d)) + 1;
    const half = Math.max(...nodes.map((n) => Math.abs(n.cx - 500))); // 가로 범위 = 뿌리(500) 둘레로 맞춤 — 뿌리가 늘 가운데
    const c0 = 500 - half, span = 2 * half || 1;
    const s = Math.min(1.5, Math.max(0.85, W / 386)); // 틈 · 줄 간격 비 (폰 가로 판 386 px = 1)
    const f = Math.max(9, 10.5 * s), lh = Math.round(f * 1.2); // 이름 글자 · 줄 높이 — 9 px 밑으로 안 내림 (좁으면 접기 · 원 줄이기로 푼다)
    const D0 = Math.round(32 * Math.max(1, s)), hit = 40; // 원 지름(모든 칸 같음 — 08:2x · 전 24 ~ 36) · 누르는 자리 (폭 · 높이)
    const gap = Math.round(6 * s), edge = 3, nameGap = Math.round(10 * s), rowGap = Math.round(30 * s), top = 6, bottom = 10; // nameGap = 원 아래 가장자리에 걸친 값 알약 밑까지
    const padX = hit / 2 + edge;
    const X = (cx) => padX + ((cx - c0) / span) * (W - 2 * padX);
    const pos = {}, row = [];
    for (let d = 0; d < rows; d++) {
      const R = nodes.filter((n) => n.d === d).sort((a, b) => a.cx - b.cx);
      const items = R.map((n) => ({ n, c: X(n.cx), opts: nameOptions(nameOf(n), f) }));
      let D = D0, plan;
      for (;;) { // 그래도 판 폭에 안 들면 이 줄 원(과 그림)만 조금씩 작게 (24 px 까지 — 지금 화면들에서는 안 씀)
        for (const it of items) { it.ring = ringFit(nodeIconKey(school, it.n), D); it.D = D; }
        plan = fitRow(items, W, gap, edge, hit);
        if (plan.ok || D <= 24) break;
        D -= 2;
      }
      const L = Math.max(...items.map((it, i) => it.opts.list[plan.pick[i]].lines.length)), Db = Math.max(...items.map((it) => it.D));
      row[d] = { Db, L };
      items.forEach((it, i) => { pos[it.n.id] = { x: plan.p[i], w: plan.w[i], ring: it.ring, D: it.D, Db, lines: it.opts.list[plan.pick[i]].lines, d }; });
    }
    let y = top;
    for (let d = 0; d < rows; d++) { row[d].top = y; row[d].nameBottom = y + row[d].Db + nameGap + row[d].L * lh; y = row[d].nameBottom + rowGap; }
    for (const id in pos) { const q = pos[id]; q.top = row[q.d].top; q.ringTop = q.top + (q.Db - q.D) / 2; } // 한 줄의 원은 가운데를 맞춤
    const height = Math.ceil(row[rows - 1].nameBottom + bottom);
    return { W, H, height, s, f, lh, nameGap, pos, row, scroll: height > H + 0.5 };
  }

  function drawLinks(learned) {
    const svg = $('.tree-links'), g = geo, T = TREE[school];
    svg.setAttribute('viewBox', `0 0 ${g.W} ${g.height}`);
    svg.setAttribute('width', g.W);
    svg.setAttribute('height', g.height);
    const parts = [];
    const px = (n) => g.pos[n.id].x;
    const bottomOf = (n) => [px(n), g.pos[n.id].ringTop + g.pos[n.id].D], topOf = (n) => [px(n), g.pos[n.id].ringTop]; // 그 칸 원의 아래 · 위 가장자리
    const stemOf = (n) => { const q = g.pos[n.id]; return q.top + q.Db + g.nameGap + q.lines.length * g.lh; }; // 이름표 아래 끝 — 원에서 여기까지 곧게 내려와(이름표 뒤) 갈라진다
    const curve = (from, to) => {
      if (from.d === to.d) { // 같은 줄(편지 — 뿌리 왼쪽 · 10/22 02:1x): 앞 칸 원 옆 가장자리 → 뒤 칸 원 옆 가장자리 수평 한 줄 (원 가운데 높이)
        const a = g.pos[from.id], b = g.pos[to.id], dir = Math.sign(b.x - a.x) || 1, yc = a.ringTop + a.D / 2;
        return `M${(a.x + (dir * a.D) / 2).toFixed(1)} ${yc.toFixed(1)} H${(b.x - (dir * b.D) / 2).toFixed(1)}`;
      }
      const [x0, y0] = bottomOf(from), ys = stemOf(from), [x1, y1] = topOf(to), m = (ys + y1) / 2;
      return `M${x0.toFixed(1)} ${y0.toFixed(1)} V${ys.toFixed(1)} C${x0.toFixed(1)} ${m.toFixed(1)} ${x1.toFixed(1)} ${m.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    };
    const cls = (from, to) => ['tree-link', to.opt ? 'opt' : '', learned.has(from.id) && learned.has(to.id) ? 'lit' : learned.has(from.id) && !isClosed(school, to) ? 'ready' : ''].filter(Boolean).join(' ');
    const gate = T.gate;
    if (gate) { // 독일 관문 — 2단계 셋 아래 가로 띠 하나 → 3단계 셋 (사장님 18:5x '기본기를 중시')
      const from = gate.from.map((id) => nodeOf(school, id)), to = gate.to.map((id) => nodeOf(school, id));
      const yb = (g.row[from[0].d].nameBottom + g.row[to[0].d].top) / 2; // 띠 = 위 줄 이름 밑 ~ 아래 줄 원 위 사이 가운데
      const xs = [...from, ...to].map(px);
      const allIn = from.every((n) => learned.has(n.id));
      parts.push(`<path class="tree-link gate${allIn ? ' lit' : ''}" d="M${Math.min(...xs).toFixed(1)} ${yb.toFixed(1)} H${Math.max(...xs).toFixed(1)}"/>`);
      for (const n of from) { const [x0, y0] = bottomOf(n); parts.push(`<path class="tree-link${learned.has(n.id) ? ' lit' : ''}" d="M${x0.toFixed(1)} ${y0.toFixed(1)} V${yb.toFixed(1)}"/>`); }
      for (const n of to) { const [x1, y1] = topOf(n); parts.push(`<path class="tree-link${allIn && learned.has(n.id) ? ' lit' : allIn ? ' ready' : ''}" d="M${x1.toFixed(1)} ${yb.toFixed(1)} V${y1.toFixed(1)}"/>`); }
    }
    for (const n of nodesOf(school)) {
      if (gate?.to.includes(n.id)) continue;
      for (const pid of n.pre) parts.push(`<path class="${cls(nodeOf(school, pid), n)}" d="${curve(nodeOf(school, pid), n)}"/>`);
      if (n.pre.length > 1) { const [x1, y1] = topOf(n); parts.push(`<circle class="tree-join" cx="${x1.toFixed(1)}" cy="${(y1 - 2).toFixed(1)}" r="${(2.8 * g.s).toFixed(1)}"/>`); } // '모두 익혀야' 표지 (원 위 — 그림의 금색 줄)
    }
    // 이어진 줄(lit)은 얇은 흰 줄 두 겹 (10/23 사장님): 같은 길에 판 바탕 색 속줄을 한 번 더 그어 가운데를 비운다 (lobby.css .tree-link-core)
    const out = [];
    for (const p of parts) {
      out.push(p);
      if (p.startsWith('<path') && /class="[^"]*\blit\b/.test(p)) out.push(p.replace(/class="([^"]*)"/, (m, c) => `class="tree-link-core${/\bgate\b/.test(c) ? ' gate' : ''}${/\bopt\b/.test(c) ? ' opt' : ''}"`));
    }
    svg.innerHTML = out.join('');
  }

  function size() {
    geo = layout();
    if (!geo) return;
    board.style.width = `${geo.W}px`;
    board.style.height = `${geo.height}px`;
    board.style.setProperty('--lh', `${geo.lh}px`);
    board.style.setProperty('--ng', `${geo.nameGap}px`);
    board.style.setProperty('--nf', `${geo.f.toFixed(2)}px`); // 칸 이름 글자 — 초기화 글자도 같은 크기 (02:0x)
    board.style.setProperty('--s', geo.s.toFixed(3));
    scroller.dataset.scroll = geo.scroll ? 'y' : '';
    more();
  }
  // 아래로 더 볼 칸이 있나 (판이 창보다 길고 아직 끝까지 안 내림) — 아래 끝 흐림 + 꺾쇠 (lobby.css .tree-frame[data-more])
  function more() {
    const left = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
    if (left > 2) frame.dataset.more = ''; else delete frame.dataset.more;
  }
  function render() {
    size();
    if (geo && scroller.clientWidth !== geo.W) size(); // 내림 막대가 생기거나 없어져 폭이 바뀌면 한 번 더 (가로로 넘치지 않게)
    const learned = learnedNow(), P = readProgress();
    root.dataset.school = school;
    board.setAttribute('aria-label', `${TRADITIONS[school].nameKo} 스킬트리`);
    if (geo) {
      $('.tree-nodes').innerHTML = nodesOf(school).map((n) => {
        const st = stateOf(n, learned), cat = NODE_CAT[n.cat], p = geo.pos[n.id];
        const tail = st === 'open' ? `<span class="node-price">${priceHtml(n.price, n.heads)}</span>` : st === 'closed' ? '<span class="node-soon">준비 중</span>' : '';
        const label = `${nameOf(n)} · ${STATE_KO[st]}${st === 'open' ? ` · ${priceWords(n.price, n.heads)}` : ''}`;
        return `<button type="button" class="tree-node" data-node="${n.id}" data-cat="${n.cat}" data-tier="${cat.tier}" data-state="${st}" style="left:${(p.x - p.w / 2).toFixed(1)}px;top:${p.top.toFixed(1)}px;width:${p.w}px;--d:${p.D}px;--db:${p.Db}px" aria-label="${label}" aria-pressed="${selected === n.id}">
          <span class="node-ring"><img class="node-icon" src="${nodeIconSrc(school, n)}" alt="" aria-hidden="true" draggable="false" style="width:${p.ring.iw.toFixed(1)}px;height:${p.ring.ih.toFixed(1)}px;left:${p.ring.left.toFixed(1)}px;top:${p.ring.top.toFixed(1)}px"></span><span class="node-name" style="font-size:${geo.f.toFixed(2)}px">${p.lines.map((t) => `<span class="node-line">${t}</span>`).join('')}</span>${tail}</button>`;
      }).join('');
      drawLinks(learned);
    }
    renderReset(learned, P);
    renderDetail(learned, P);
  }

  function renderReset(learned, P) {
    const btn = $('#treeReset'), pre = resetPreview(school, P);
    btn.hidden = test;
    btn.disabled = !pre.ok;
    const why = pre.why === 'empty' ? '익힌 칸이 없습니다' : pre.why === 'heads' ? '머리가 모자랍니다' : '';
    btn.setAttribute('aria-label', `${TRADITIONS[school].nameKo} 스킬 초기화 · 머리 ${RESET_HEADS}${why ? ` · ${why}` : ''}`);
    btn.title = why;
  }

  function renderDetail(learned = learnedNow(), P = readProgress()) {
    const box = $('.node-detail');
    const n = selected && nodeOf(school, selected);
    if (!n) { box.hidden = true; return; }
    const st = stateOf(n, learned), cat = NODE_CAT[n.cat], { title, kind } = nodeTitle(school, n);
    box.hidden = false;
    box.dataset.state = st;
    box.dataset.tier = cat.tier;
    $('#nodeIcon').src = nodeIconSrc(school, n);
    $('#nodeTitle').textContent = title;
    $('#nodeTitle').dataset.tier = cat.tier;
    // 검술서 오의 · 출처 (칸 lore · src — 없으면 상자째 숨기고 효과만)
    const lore = st === 'closed' ? '' : n.lore ?? '';
    $('#nodeLore').textContent = lore;
    $('#nodeSrc').textContent = lore ? n.src ?? '' : '';
    $('#nodeSrc').hidden = !lore || !n.src;
    $('#nodeLoreBox').hidden = !lore;
    box.dataset.lore = lore ? 'y' : '';
    $('#nodeEffect').textContent = st === 'closed' ? '준비 중입니다.' : nodeEff(school, n);
    $('#nodeMeta').textContent = `${kind} · ${TRADITIONS[school].nameKo} 유파${test ? '' : ` · ${STATE_KO[st]}`}`;
    $('#nodeMeta').dataset.tier = cat.tier;
    // 먼저 익힐 칸: 잠김일 때만 (익혔거나 배울 수 있으면 이미 채움 · 준비 중이면 못 배움 — 10/22 카드에 오의 · 출처가 들며 자리를 아낌)
    const pre = n.pre.map((id) => nameOf(nodeOf(school, id)));
    $('#nodePre').textContent = pre.length ? `먼저 익힐 칸: ${pre.join(' · ')}${pre.length > 1 ? ' (모두)' : ''}` : '';
    $('#nodePre').hidden = st !== 'locked' || !pre.length;
    $('#nodePrice').innerHTML = st === 'closed' ? '' : `<span class="sr-only">값 ${priceWords(n.price, n.heads)}</span><span aria-hidden="true">${priceHtml(n.price, n.heads)}</span>`;
    $('#nodePrice').hidden = st === 'closed' || st === 'learned' || test;
    const can = canLearn(school, n, learned, P);
    const note = test ? '테스트 경로에서는 모든 칸을 익힌 것으로 봅니다.'
      : st === 'learned' ? '익힌 칸입니다.'
      : st === 'closed' ? '아직 배울 수 없습니다.'
      : can.why === 'pre' ? (pre.length ? '' : '먼저 익힐 칸이 있습니다.') // 잠김은 '먼저 익힐 칸: …' 줄이 까닭을 말한다 (같은 말 두 번 안 함)
      : can.why === 'coins' ? `금화가 모자랍니다. 가진 금화 ${won(P.coins)}`
      : can.why === 'heads' ? `머리가 모자랍니다. 가진 머리 ${won(P.heads)}` : '';
    $('#nodeState').textContent = note;
    $('#nodeState').hidden = !note;
    const btn = $('#learnNode');
    btn.hidden = test || st === 'learned';
    btn.disabled = !can.ok;
    btn.innerHTML = st === 'closed' ? '준비 중' : `배우기`;
  }

  function select(id, node = null) {
    selected = selected === id ? null : id;
    lastNode = node;
    closeReset(false);
    render();
    if (selected) $('#nodeTitle').focus({ preventScroll: true });
  }
  function selectTab(tab) {
    for (const t of tabs) { const sel = t === tab; t.setAttribute('aria-selected', String(sel)); t.tabIndex = sel ? 0 : -1; }
    school = tab.dataset.school; selected = null; closeReset(false); scroller.scrollTop = 0; render();
  }
  for (const tab of tabs) {
    on(tab, 'click', () => selectTab(tab));
    on(tab, 'keydown', (e) => {
      const k = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (k == null && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      const i = tabs.indexOf(tab), next = tabs[e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + k + tabs.length) % tabs.length];
      selectTab(next); next.focus();
    });
  }
  on($('.tree-nodes'), 'click', (e) => { const n = e.target.closest('.tree-node'); if (n) select(n.dataset.node, n); });
  on($('.detail-close'), 'click', () => { const id = lastNode?.dataset.node; selected = null; render(); root.querySelector(`.tree-node[data-node="${id}"]`)?.focus({ preventScroll: true }); });
  on($('#learnNode'), 'click', () => {
    const n = nodeOf(school, selected);
    if (!n) return;
    const r = learnNode(school, n.id);
    announce(r.ok ? `${nameOf(n)} 익힘 — ${priceWords(n.price, n.heads)}${r.saved ? '' : '. 이번 실행 동안 유지됩니다.'}` : r.why === 'coins' ? '금화가 모자랍니다.' : r.why === 'heads' ? '머리가 모자랍니다.' : '배울 수 없습니다.');
    render(); onWallet();
  });
  // ── 유파 초기화 (머리 1 · 확인 단계) ──
  function openReset() {
    const pre = resetPreview(school);
    if (!pre.ok || test) return;
    selected = null; render();
    const box = $('.reset-confirm');
    $('#resetTitle').textContent = `${TRADITIONS[school].nameKo} 스킬 초기화`;
    $('#resetBody').textContent = `익힌 칸 ${pre.count}개를 모두 지우고 쓴 값을 돌려받습니다. 레벨도 ${pre.count}만큼 내려갑니다.`;
    $('#resetPrice').innerHTML = `<span class="price-row"><span class="price-label">돌려받음</span>${priceHtml(pre.coins, pre.heads) || '<span class="price-part">0</span>'}</span><span class="price-row"><span class="price-label">드는 값</span>${priceHtml(0, pre.cost)}</span>`;
    box.hidden = false;
    $('#resetTitle').focus({ preventScroll: true });
  }
  function closeReset(refocus = true) {
    const box = $('.reset-confirm');
    if (box.hidden) return;
    box.hidden = true;
    if (refocus) $('#treeReset').focus({ preventScroll: true });
  }
  on(scroller, 'scroll', more);
  on($('#treeReset'), 'click', openReset);
  on($('#resetCancel'), 'click', () => closeReset());
  on($('#resetOk'), 'click', () => {
    const r = resetSchool(school);
    closeReset(false);
    announce(r.ok ? `${TRADITIONS[school].nameKo} 스킬 초기화 — 칸 ${r.count}개 · 돌려받음 ${priceWords(r.coins, r.heads) || '0'} · 머리 ${RESET_HEADS} 사용${r.saved ? '' : '. 이번 실행 동안 유지됩니다.'}` : r.why === 'heads' ? '머리가 모자랍니다.' : '초기화할 칸이 없습니다.');
    render(); onWallet();
    $('#treeReset').focus({ preventScroll: true });
  });
  on(root, 'keydown', (e) => { if (e.key === 'Escape' && !$('.reset-confirm').hidden) { e.preventDefault(); closeReset(); } });
  const sizer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => render()) : null;
  sizer?.observe(frame);
  render();
  return {
    refresh: render,
    show(s, id = null) { const tab = tabs.find((t) => t.dataset.school === s); if (tab) selectTab(tab); if (id) select(id); },
    destroy() { events.abort(); sizer?.disconnect(); },
  };
}
