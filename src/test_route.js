// 테스트 전용 경로 (사장님 10/10 16:5x: "무기와 캐릭터 고르도록 해. 상대와 스테이지는 랜덤") — docs/test_route_2026-10-10.md
//  고르는 화면은 test.html(src/test_pick.js), 그 화면이 여는 주소: index.html?test=1&weapon=<id>&hero=<id|player>&foe=random&stage=random
//  여기서는 index.html(main.js) 쪽 주소 인자만 읽는다. 인자가 없으면 아무것도 바꾸지 않는다(본판 그대로):
//   hero=<인물 id>  : 플레이어 겉모습(look) · 플레이어 이름을 그 인물로. 유파·비기·패시브는 지금 규칙대로 무기를 따르고,
//                     인물의 AI 성격·부활·붉은 안광 같은 고유 능력은 주지 않는다. 투구·판금은 겉모습에 딸려 있어 함께 온다(fighter.js look.helmet·armor)
//   stage=random    : 판을 열 때 무대를 STAGE_ORDER 안에서 무작위로 (같은 무대 연속 없음, 어두운 홀은 순서표에 없으니 안 나온다). 첫 판(메뉴 뒤)도 무작위
//   stage=<무대 id> : 그 무대에 고정 (main.js STAGE_PIN — 10/14 고르기 화면에서 새 무대 잠든 습지·철불 절벽·소금 사막을 고를 때. 셋 다 10/14 19:4x 여정에 들어감)
//   test=1          : ① 상대는 자기 무기(weapon= 가 상대에게 번지지 않게) ② 이기든 지든 다음 판으로(무대·상대 새로) ③ 메뉴에 '테스트 고르기로' 단추
//                     ④ 무기 카드 뽑기는 weapon= 가 이미 건너뛴다(main.js startFight FIXED_WEAPON)
//                     foe=random 이면 상대 후보에서 고른 인물은 뺀다(같은 겉모습 둘이 서지 않게)
//                     foe=<인물 id> 면 판마다 그 인물(main.js pickFoe — CHARACTERS_BY_ID). 10/14 고르기 화면의 '상대' 줄 — 손님 인물(CHARACTER_GUESTS, 라트나·다라이시)은
//                     무작위 후보(CHARACTERS)에 없어 테스트 경로에서는 여기서 고른다 (여정에서는 제 무대의 검객 — stages.js STAGE_FOE, 10/14 19:4x)
//                   ⑤ 플레이어 고유 동작(unique_assist.js)이 모두 열린다 (UNIQUE_ASSIST.testStage 5 = 비기까지 — 본판은 여정 인장 수, 둘 다 ?uniqueStage=0..5 로 덮음)
//   foeWhiff=1      : 상대 헛스윙 (10/15 — 고르기 화면 '상대 헛스윙'): 상대 AI 가 제 칼이 닿지 않는 거리에서 2~3 s 마다 허공을 벤다(src/whiff_drill.js — main.js 가 판마다 붙임).
//                     독일 간격 잡기 시험용. 다가가면 평소대로 싸운다. test=1 없이도 쓸 수 있다. 없으면 상대는 평소 그대로
import { CHARACTERS, CHARACTERS_BY_ID, pickCharacterWeapon } from './characters.js';
import { STAGE_ORDER, STAGE_NAME_KO } from './stages.js';

export const TEST_PICK_URL = './test.html';

export function createTestRoute(params) {
  const active = params.get('test') === '1';
  const heroId = params.get('hero');
  const hero = heroId && heroId !== 'player' ? CHARACTERS_BY_ID[heroId] || null : null;
  const stageRandom = params.get('stage') === 'random';
  const stagePinned = !stageRandom && STAGE_NAME_KO[params.get('stage')] ? STAGE_NAME_KO[params.get('stage')] : null; // 고른 무대 이름 (메뉴 한 줄용)
  const foeId = params.get('foe');
  const foeFixed = foeId && foeId !== 'random' ? CHARACTERS_BY_ID[foeId] || null : null; // 고른 상대 (메뉴 한 줄에만 — 고르기는 main.js pickFoe)
  const foeWhiff = params.get('foeWhiff') === '1'; // 상대 헛스윙 (main.js 가 판마다 상대 AI 에 WhiffDrill 을 붙인다)
  return {
    active,
    hero,
    stageRandom,
    foeWhiff,
    /** 플레이어 Fighter 옵션에 덮을 몫 (고른 인물이 없으면 빈 객체 — 지금 그대로) */
    player: hero ? { name: hero.name, look: hero.look } : {},
    /** 다음 판을 열 때 무대를 넘길지: test=1 이면 이기든 지든 넘긴다 */
    advance(won) {
      return won || active;
    },
    /** 다음 무대 id (stage=random 이 아니면 null — 부르는 쪽의 순서표를 쓴다) */
    nextStage(prev) {
      if (!stageRandom) return null;
      const pool = STAGE_ORDER.filter((id) => id !== prev);
      return pool[Math.floor(Math.random() * pool.length)];
    },
    /** test=1 · foe=random: 무작위 상대 (지난 상대·고른 인물 빼고). 그 밖엔 null — 부르는 쪽 규칙 그대로 */
    pickFoe(prevId, foeRandom) {
      if (!active || !foeRandom) return null;
      const pool = CHARACTERS.filter((c) => c.id !== prevId && c.id !== hero?.id);
      return pool[Math.floor(Math.random() * pool.length)] || null;
    },
    /** test=1: 상대는 자기 무기 (null 이면 부르는 쪽 규칙) */
    foeWeapon(foe) {
      return active && foe ? pickCharacterWeapon(foe) : null;
    },
    /** 판 끝 결과 메뉴의 시작 단추 글 (test=1 은 늘 새 판) */
    resultLabel(btn) {
      if (active && btn) btn.textContent = '다음 판 (무작위)';
    },
    /** 메뉴(시작·일시정지·결과가 함께 쓰는 #menu .actions)에 '테스트 고르기로' 단추, 제목 아래에 테스트 경로 한 줄을 한 번 붙인다 */
    mount(doc, weaponName) {
      if (!active) return;
      const actions = doc.querySelector('#menu .actions');
      if (!actions || doc.getElementById('btnTestPick')) return;
      const btn = doc.createElement('button');
      btn.id = 'btnTestPick';
      btn.className = 'secondary';
      btn.type = 'button';
      btn.textContent = '테스트 고르기로';
      btn.addEventListener('click', () => {
        location.href = TEST_PICK_URL;
      });
      const note = doc.createElement('p');
      note.id = 'testRouteNote';
      note.style.cssText = 'margin:-8px 0 12px;font-size:var(--fs-s);color:var(--c-sub);line-height:1.4'; // 10/14 글자 규칙: 작게 · 보조 색 (index.html :root)
      note.textContent = `테스트 경로 · ${weaponName} · ${hero ? hero.name : '기본 주인공'} · ${foeFixed || stagePinned ? `${foeFixed ? `상대 ${foeFixed.name}` : '상대 무작위'} · ${stagePinned ? `무대 ${stagePinned}` : '무대 무작위'}` : '상대·무대 무작위'} · 고유 동작·비기 모두 열림${foeWhiff ? ' · 상대 헛스윙' : ''}`; // 고유 동작 해금: 테스트 경로는 모두 (main.js uniqueStageFor test — UNIQUE_ASSIST.testStage)
      actions.append(btn);
      doc.getElementById('menuSub')?.after(note); // 제목 아래 한 줄 (아래 단추 줄을 두껍게 하지 않게)
    },
  };
}
