// 게임 들머리 (index.html 의 첫 모듈 — 샛별 저장소 215d7b7e · 817db21c · 3b280a1b 를 우리 판에 맞춤, docs/import/lobby_port_2026-10-16.md §3 · §5)
//  인자 없는 주소: 공지 → 첫 화면 → 곧바로 여정(무기 카드, 또는 이어하기 지점) — 사장님 10/17 11:2x '첫화면-대기실-전투 흐름이 아니라 첫화면에서 바로 전투로 이동'
//   (전: 첫 화면 → 대기실 → 여정). 게임(main.js)은 첫 화면 뒤에서 받아 두고, 첫 화면·대기실이 앞에 있는 동안(html[data-start-open]) 게임의 3D 그리기·물리는 멈춘다 (main.js frame).
//  대기실은 싸움에서 연다 (사장님 10/16 08:3x — docs/import/ui_fix_2026-10-16.md §3): 첫 화면에서 연 여정이면 정지 · 결과 창의 '대기실'이 이 덮개를 다시 열고
//   대기실을 띄운다 — 출발 단추 'Stage 입장'(사장님 10/17 12:1x — 전 '여정 시작' · '여정 이어가기')은 이어하기 지점부터 (main.js setLobbyReturn → toLobby). 장비 · 이름 · 스킬북은 저장된 그대로 싸움에 쓰인다. 주소로 연 판 · 테스트 경로는 이 길이 없다.
//  게임 인자가 하나라도 있는 주소(?stage= ?weapon= ?foe= ?test=1 ?stamina=0 ?foeWhiff=1 …): 지금처럼 바로 게임 메뉴 (journey_save.js skipsTitle)
//  첫 화면·대기실은 Shadow DOM 안 — 꾸밈은 그 안에서만, 글자는 게임 HUD 규칙의 토큰(index.html :root)을 물려받아 entrance_type.css 한 곳에서 (lobby_fix §1).
//   단추 · 미닫이 · 탭은 싸움 화면 꼴을 같은 토큰 · 같은 값으로 옮긴 entrance_ui.css 하나 (사장님 10/16 15:3x ② ③ — docs/import/ui_unify_2026-10-16.md)
//  디자인 보기용 주소 `?coins=N` = 대기실 금화를 N 으로 (lobby_progress.js setCoins — 게임 인자로 세지 않아 첫 화면이 뜬다 · lobby_fix §6)
//  소리 (사장님 10/17 — docs/import/ui_sound_2026-10-17.md · ui_sound.js): 덮개 안 확인 류 단추 = 짧은 딸깍 · 첫 화면 = 바람(첫 누름에 스며들고 싸움 · 대기실로 가면 잦아들어 꺼짐)
import baseStyle from './start_screen.css?inline';
import pixelStyle from './start_pixel.css?inline';
import uiStyle from './entrance_ui.css?inline';
import typeStyle from './entrance_type.css?inline';
import { ENTRANCE_HTML, mountStartScreen } from './start_screen.js';
import { skipsTitle } from './journey_save.js';
import { setCoins } from './lobby_progress.js';
import { wireUiSound, titleWind } from './ui_sound.js';

const params = new URLSearchParams(location.search.slice(1).replace(/\?/g, '&'));
if (params.has('coins')) setCoins(Number(params.get('coins')));
if (skipsTitle(params)) {
  document.documentElement.removeAttribute('data-start-open');
  await import('./main.js');
} else {
  let host = null, root = null, covered = [];
  // 덮개(Shadow DOM 을 단 #gameEntrance) 열기 — 처음 열 때 · 싸움에서 대기실로 돌아올 때. 뒤의 게임은 숨기고(index.html html[data-start-open]) 누를 수 없게(inert)
  //  첫 화면 · 공지 · 계정 · 대기실도 가로 화면만 (사장님 10/16 14:0x '첫 화면이나 대기실도 가로 화면에서만 볼 수 있게 해'): 세로 폰이면 싸움과 같은 '폰을 가로로 돌려 주십시오'(#rotate)가
  //   이 덮개 위를 덮는다 — 조건도 싸움과 같다(세로 + 터치 · PC 는 그대로). 안내는 inert 로 두지 않는다(inert 면 누름이 뒤의 첫 화면·대기실로 지나간다).
  //   창(공지 · 설정 · 계정 · 이름 — showModal)은 맨 위 층이라 안내보다 위에 그려져 같은 조건에서 감춘다 (entrance_ui.css 끝)
  function openHost() {
    document.documentElement.setAttribute('data-start-open', '');
    document.getElementById('rotate')?.classList.add('enabled');
    host = document.createElement('div');
    host.id = 'gameEntrance';
    host.style.cssText = 'position:fixed;inset:0;z-index:100;background:#30291e';
    root = host.attachShadow({ mode: 'open' });
    wireUiSound(root); // 이 덮개의 확인 류 단추 → 딸깍 (첫 화면 · 대기실 모두 이 root 안)
    document.body.append(host);
    covered = [...document.body.children].filter(el => el !== host && el.id !== 'rotate' && el.tagName !== 'SCRIPT');
    for (const el of covered) el.inert = true;
  }
  openHost();
  const loaded = import('./main.js');
  let screen = null, lobby = null;
  function showTitle() {
    lobby?.destroy(); lobby = null;
    const style = document.createElement('style');
    // 빌드가 속성 선택자의 따옴표를 뺄 수 있어 따옴표가 있든 없든 바꾼다 (샛별 쪽에서 찾은 문제)
    style.textContent = (baseStyle + pixelStyle)
      .replace(/(?:html)?\[data-start-theme=["']?pixel["']?\]/g, ':host')
      .replaceAll(':root', ':host').replace(/html,\s*body/g, ':host')
      + '\n#selectionStatus:not(.sr-only){position:absolute;left:0;right:0;margin:12px 0 0;}\n' + uiStyle + '\n' + typeStyle;
    const markup = document.createElement('template');
    markup.innerHTML = ENTRANCE_HTML;
    root.replaceChildren(style, markup.content);
    titleWind(true, root.getElementById('entrance')); // 첫 화면 바람 — 붙인 뒤 · 띄우기 전 (공지 없이 바로 바람 장면이 불어도 놓치지 않게)
    let choosing = false;
    screen = mountStartScreen({
      root,
      settings: async () => { const game = await loaded; return { get: game.getLobbySettings, set: game.setLobbyFps }; },
      accountLoader: () => import('./account/title_account.js'),
      async onChoice(choice) {
        if (choosing) return;
        choosing = true; screen.setBusy(true); screen.setStatus('');
        try {
          const game = await loaded;
          if (choice === 'continue' && !game.canContinueJourney()) {
            screen.setStatus('이어갈 여정이 없습니다. Stage 1로 시작해 주십시오.');
            screen.setBusy(false); choosing = false; return;
          }
          await depart(game, choice, () => { screen?.destroy(); screen = null; }, root.getElementById('entrance')); // 첫 화면 → 곧바로 싸움 (대기실을 거치지 않음)
        } catch {
          if (!root.getElementById('selectionStatus')) showTitle();
          screen.setStatus('게임을 준비하지 못했습니다. 다시 시도해 주십시오.');
          choosing = false; screen.setBusy(false);
        }
      },
    });
  }
  // 여정 출발 (첫 화면의 Stage 1 · 이어하기 · 대기실의 'Stage 입장'): choice 'new' = 첫 무대부터 · 'continue' = 이어하기 지점부터.
  //  판을 세운 뒤 덮개를 0.3 s 걷어 낸다 — 뒤의 카드·싸움 화면이 비쳐 보이며 넘어가게 (리뷰 §8-6 '갑작스럽다'). close = 첫 화면 · 대기실 정리 · fading = 걷어 낼 꺼풀
  async function depart(game, choice, close, fading) {
    if (!await (choice === 'wander' ? game.launchWander() : game.launchJourney(choice))) throw new Error('Missing journey');
    titleWind(false); // 첫 화면 바람은 싸움으로 이어지지 않는다 (잦아들어 꺼짐)
    game.setLobbyReturn?.(backToLobby); // 이 여정의 정지 · 결과 창에 '대기실' (main.js lobbyMenu)
    document.documentElement.removeAttribute('data-start-open');
    for (const el of covered) el.inert = false;
    const leaving = host;
    leaving.style.pointerEvents = 'none'; leaving.style.background = 'transparent';
    fading?.setAttribute('data-leaving', '');
    await new Promise(r => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300));
    close();
    leaving.remove();
  }
  // 대기실 (싸움의 정지 · 결과 창 '대기실'에서 — 'continue' = 이어하기 지점부터)
  async function showLobby(game, choice) {
    const { mountLobby } = await import('./lobby.js'); // 대기실 묶음은 열 때 받는다 — 첫 화면을 늦추지 않게 (10/17 3D 미리보기를 프로필 그림으로 바꿔 묶음이 가벼워짐)
    titleWind(false);
    screen?.destroy(); screen = null;
    lobby = mountLobby({ root, game, choice, onBack: showTitle, async onWander() {
      const gone = lobby;
      await depart(game, 'wander', () => { gone.destroy(); if (lobby === gone) lobby = null; }, root.querySelector('.lobby'));
    }, async onDepart() {
      const gone = lobby;
      await depart(game, choice, () => { gone.destroy(); if (lobby === gone) lobby = null; }, root.querySelector('.lobby'));
    } });
  }
  // 싸움 → 대기실 (main.js toLobby 가 부른다): 덮개를 다시 열고 대기실을 'continue'(출발 단추 'Stage 입장')로 — 이어하기 지점은 지금 무대 시작(이긴 판이면 다음 무대)
  async function backToLobby() {
    const game = await loaded;
    openHost();
    try { await showLobby(game, 'continue'); }
    catch { showTitle(); screen.setStatus('대기실을 열지 못했습니다. 다시 시도해 주십시오.'); }
  }
  // 별도 체험 빌드에서만 사용. 실제 앱에는 전체 클리어 조건을 그대로 둔다.
  if (import.meta.env.VITE_WANDER_REVIEW === '1') {
    loaded.then(game => { game.setLobbyReturn(backToLobby); return showLobby(game, 'continue'); })
      .catch(() => { showTitle(); screen.setStatus('체험을 준비하지 못했습니다. 다시 시도해 주십시오.'); });
  } else showTitle();
  loaded.catch(() => screen?.setStatus('게임을 준비하지 못했습니다. 새로고침해 주십시오.'));
}
