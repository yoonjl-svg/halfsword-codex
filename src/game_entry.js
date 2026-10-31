// 게임 들머리 (index.html 의 첫 모듈 — 샛별 저장소 215d7b7e · 817db21c · 3b280a1b 를 우리 판에 맞춤, docs/import/lobby_port_2026-10-16.md §3 · §5)
//  10/27 사용자 변경: 첫 단추 Stage / 기록이 있으면 이어가기 → 곧바로 여정. 둘째 대기실 → 바로 대기실.
//  대기실 Stage도 누르는 순간 유효한 기록이 있으면 이어가고, 없으면 첫 무대부터. 아래 옛 배치를 대체한다.
//  게임(main.js)은 첫 화면 뒤에서 받아 두고, 첫 화면·대기실이 앞에 있는 동안(html[data-start-open]) 게임의 3D 그리기·물리는 멈춘다 (main.js frame).
//  첫 화면의 둘째 단추 외에, 여정의 정지 · 결과 창에서도 대기실로 돌아온다(main.js setLobbyReturn → toLobby).
//  장비 · 이름 · 스킬은 저장된 그대로 싸움에 쓰인다. 주소로 연 판 · 테스트 경로는 이 길이 없다.
//  게임 인자가 하나라도 있는 주소(?stage= ?weapon= ?foe= ?test=1 ?stamina=0 ?foeWhiff=1 …): 지금처럼 바로 게임 메뉴 (journey_save.js skipsTitle)
//  첫 화면·대기실은 Shadow DOM 안 — 꾸밈은 그 안에서만, 글자는 게임 HUD 규칙의 토큰(index.html :root)을 물려받아 entrance_type.css 한 곳에서 (lobby_fix §1).
//   단추 · 미닫이 · 탭은 싸움 화면 꼴을 같은 토큰 · 같은 값으로 옮긴 entrance_ui.css 하나 (사장님 10/16 15:3x ② ③ — docs/import/ui_unify_2026-10-16.md)
//  디자인 보기용 주소 `?coins=N` = 대기실 금화를 N 으로 (lobby_progress.js setCoins — 게임 인자로 세지 않아 첫 화면이 뜬다 · lobby_fix §6) · `?heads=N` = 머리를 N 으로 (10/25 · setHeads — 같은 꼴)
//  소리 (사장님 10/17 — docs/import/ui_sound_2026-10-17.md · ui_sound.js): 덮개 안 확인 류 단추 = 짧은 딸깍 · 첫 화면 = 바람(첫 누름에 스며들고 싸움 · 대기실로 가면 잦아들어 꺼짐)
//  상점 시험판 빌드(`VITE_SHOP_TEST=1` — 사장님 10/30 상점을 본판 전에 해 보는 /shop/): 저장을 가른 뒤(shop_test.js — 맨 첫 들여오기) 게임이 뜨면 곧바로 대기실 상점 칸
import { SHOP_TEST } from './shop_test.js';
//  생사전 (10/29 — docs/design/saengsa_2026-10-29.md): 대기실 '생사전' 칸의 '생사전 입장' → showSaengsa(같은 덮개 안 · 대진표 화면 saengsa_page.js) · '대기실' 단추 → 대기실 생사전 칸.
//   시험 주소 `?saengsaNow=2026-10-30T09:59` = 생사전 시계를 그 현지 시각에서 출발(saengsa_clock.js — 게임 인자로 세지 않아 첫 화면이 뜬다)
//   생사전 시험판 빌드(config SAENGSA.testMode — 사장님 10/29 17:5x 시험 페이지): 저장을 가른 뒤(test_storage.js — 맨 첫 들여오기) 게임이 뜨면 곧바로 대기실 생사전 칸
import './test_storage.js';
import { SAENGSA } from './config.js';
import baseStyle from './start_screen.css?inline';
import pixelStyle from './start_pixel.css?inline';
import uiStyle from './entrance_ui.css?inline';
import typeStyle from './entrance_type.css?inline';
import { ENTRANCE_HTML, mountStartScreen } from './start_screen.js';
import { skipsTitle } from './journey_save.js';
import { setCoins, setHeads } from './lobby_progress.js';
import { wireUiSound, titleWind } from './ui_sound.js';

const params = new URLSearchParams(location.search.slice(1).replace(/\?/g, '&'));
if (params.has('coins')) setCoins(Number(params.get('coins')));
if (params.has('heads')) setHeads(Number(params.get('heads'))); // 시험용 `?heads=N` = 머리를 N 으로 (10/25 — ?coins 와 같은 꼴)
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
  let screen = null, lobby = null, saengsa = null;
  function showTitle() {
    lobby?.destroy(); lobby = null;
    saengsa?.destroy(); saengsa = null;
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
    const mounted = screen = mountStartScreen({
      root,
      settings: async () => { const game = await loaded; return { get: game.getLobbySettings, set: game.setLobbyFps }; },
      accountLoader: () => import('./account/title_account.js'),
      async onChoice(choice) {
        if (choosing) return;
        choosing = true; screen.setBusy(true); screen.setStatus('');
        try {
          const game = await loaded;
          const journeyChoice = game.canContinueJourney() ? 'continue' : 'new';
          if (choice === 'lobby') { await showLobby(game, journeyChoice); return; }
          await depart(game, journeyChoice, () => { screen?.destroy(); screen = null; }, root.getElementById('entrance')); // 첫 단추 → 곧바로 싸움
        } catch {
          if (!root.getElementById('selectionStatus')) showTitle();
          screen.setStatus('게임을 준비하지 못했습니다. 다시 시도해 주십시오.');
          choosing = false; screen.setBusy(false);
        }
      },
    });
    // 유효한 기록을 판별한 뒤 누르게 한다. 대기실 왕복 뒤에도 새로 읽고,
    // 늦게 끝난 옛 화면의 로딩이 현재 화면의 단추 상태를 바꾸지 않게 한다.
    mounted.setBusy(true);
    loaded.then(game => {
      if (screen !== mounted) return;
      mounted.setCanContinue(game.canContinueJourney());
      mounted.setBusy(false);
    }).catch(() => {}); // 로딩 오류 표시는 아래 loaded.catch에서 한 번 처리
  }
  // 여정 출발 (첫 화면 Stage / 이어가기 · 대기실 Stage): choice 'new' = 첫 무대부터 · 'continue' = 이어하기 지점부터 · 'wander' = 방랑.
  //  판을 세운 뒤 덮개를 0.3 s 걷어 낸다 — 뒤의 카드·싸움 화면이 비쳐 보이며 넘어가게 (리뷰 §8-6 '갑작스럽다'). close = 첫 화면 · 대기실 정리 · fading = 걷어 낼 꺼풀
  async function depart(game, choice, close, fading) {
    if (!await (choice === 'wander' ? game.launchWander() : game.launchJourney(choice))) throw new Error(choice === 'wander' ? 'Missing wander' : 'Missing journey');
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
  // 대기실 (첫 화면의 둘째 단추 또는 싸움의 정지 · 결과 창에서)
  async function showLobby(game, choice, tab = null) {
    const { mountLobby } = await import('./lobby.js'); // 대기실 묶음은 열 때 받는다 — 첫 화면을 늦추지 않게 (10/17 3D 미리보기를 프로필 그림으로 바꿔 묶음이 가벼워짐)
    titleWind(false);
    screen?.destroy(); screen = null;
    saengsa?.destroy(); saengsa = null;
    const leave = async (how) => {
      const gone = lobby;
      await depart(game, how, () => { gone.destroy(); if (lobby === gone) lobby = null; }, root.querySelector('.lobby'));
    };
    lobby = mountLobby({ root, game, choice, tab, onBack: showTitle, onDepart: () => leave(game.canContinueJourney() ? 'continue' : 'new'), onWander: () => leave('wander'), onSaengsa: () => showSaengsa(game) });
  }
  // 생사전 화면 (대기실 '생사전 입장') — 같은 덮개 안. '대기실'로 돌아가면 생사전 칸이 열린 대기실
  async function showSaengsa(game) {
    const { mountSaengsa } = await import('./saengsa_page.js');
    lobby?.destroy(); lobby = null;
    saengsa = mountSaengsa({ root, game, onBack: () => showLobby(game, 'continue', 'Event') });
  }
  // 싸움 → 대기실 (main.js toLobby 가 부른다): 이어하기 지점은 지금 무대 시작(이긴 판이면 다음 무대)
  async function backToLobby() {
    const game = await loaded;
    openHost();
    try { await showLobby(game, 'continue'); }
    catch { showTitle(); screen.setStatus('대기실을 열지 못했습니다. 다시 시도해 주십시오.'); }
  }
  showTitle();
  loaded.catch(() => screen?.setStatus('게임을 준비하지 못했습니다. 새로고침해 주십시오.'));
  if (SHOP_TEST) loaded.then((game) => { if (screen && !lobby) return showLobby(game, game.canContinueJourney() ? 'continue' : 'new', 'Shop'); }).catch(() => {}); // 상점 시험판: 첫 화면을 건너 상점 칸
  if (SAENGSA.testMode) loaded.then((game) => { if (screen && !lobby && !saengsa) return showLobby(game, game.canContinueJourney() ? 'continue' : 'new', 'Event'); }).catch(() => {}); // 시험판: 첫 화면을 건너 생사전 칸
}
