import baseStyle from './start_screen.css?inline';
import pixelStyle from './start_pixel.css?inline';
import template from '../start-pixel.html?raw';
import { mountStartScreen } from './start_screen.js';
import { mountLobby } from './lobby.js';
import { isDirectGameLink } from './journey_save.js';

const params = new URLSearchParams(location.search.slice(1).replace(/\?/g, '&'));
if (isDirectGameLink(params)) {
  document.documentElement.removeAttribute('data-start-open');
  await import('./main.js');
} else {
  const host = document.createElement('div');
  host.id = 'gameEntrance';
  host.style.cssText = 'position:fixed;inset:0;z-index:100;background:#30291e';
  const root = host.attachShadow({ mode: 'open' });
  document.body.append(host);
  const covered = [...document.body.children].filter(el => el !== host && el.tagName !== 'SCRIPT');
  for (const el of covered) el.inert = true;
  const loaded = import('./main.js');
  let screen, lobby;
  function showTitle() {
    lobby?.destroy(); lobby = null;
    const style = document.createElement('style');
    style.textContent = (baseStyle + pixelStyle)
      .replace(/(?:html)?\[data-start-theme=["']?pixel["']?\]/g, ':host')
      .replaceAll(':root', ':host').replace(/html,\s*body/g, ':host')
      + '\n#selectionStatus:not(.sr-only){position:absolute;left:0;right:0;font:12px Pretendard,sans-serif;color:var(--c-sub);margin:12px 0 0;}';
    const markup = new DOMParser().parseFromString(template, 'text/html').getElementById('entrance');
    root.replaceChildren(style, markup);
    let choosing = false;
    screen = mountStartScreen({ root, pixelTheme: true, storageKey: 'stillness.start.notices.v1',
      async onChoice(choice) {
      if (choosing) return;
      choosing = true; screen.setBusy(true); screen.setStatus('');
      try {
        const game = await loaded;
        if (choice === 'continue' && !game.canContinueJourney()) {
          screen.setStatus('이어갈 여정이 없습니다. 처음부터 시작해 주세요.');
          screen.setBusy(false); choosing = false; return;
        }
        screen.destroy();
        lobby = mountLobby({ root, game, choice, onBack: showTitle, async onDepart() {
          if (!await game.launchJourney(choice)) throw new Error('Missing journey');
          lobby.destroy(); host.remove();
          document.documentElement.removeAttribute('data-start-open');
          for (const el of covered) el.inert = false;
        } });
      } catch {
        if (!root.getElementById('selectionStatus')) showTitle();
        screen.setStatus('게임을 준비하지 못했습니다. 다시 시도해 주세요.');
        choosing = false; screen.setBusy(false);
      }
    } });
  }
  showTitle();
  loaded.catch(() => screen.setStatus('게임을 준비하지 못했습니다. 새로고침해 주세요.'));
}
