import baseStyle from './start_screen.css?inline';
import pixelStyle from './start_pixel.css?inline';
import template from '../start-pixel.html?raw';
import { mountStartScreen } from './start_screen.js';
import { isDirectGameLink } from './journey_save.js';

const params = new URLSearchParams(location.search.slice(1).replace(/\?/g, '&'));
if (isDirectGameLink(params)) {
  document.documentElement.removeAttribute('data-start-open');
  await import('./main.js');
} else {
  // 같은 문서의 Shadow DOM으로 게임 HUD와 시작 화면의 스타일/입력을 분리한다.
  const host = document.createElement('div');
  host.id = 'gameEntrance';
  host.style.cssText = 'position:fixed;inset:0;z-index:100;background:#30291e';
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = (baseStyle + pixelStyle)
    .replace(/(?:html)?\[data-start-theme=["']?pixel["']?\]/g, ':host')
    .replaceAll(':root', ':host').replace(/html,\s*body/g, ':host')
    + '\n#selectionStatus:not(.sr-only){position:absolute;left:0;right:0;font:12px Pretendard,sans-serif;color:var(--c-sub);margin:12px 0 0;}';
  const markup = new DOMParser().parseFromString(template, 'text/html').getElementById('entrance');
  root.append(style, markup);
  document.body.append(host);
  const covered = [...document.body.children].filter(el => el !== host && el.tagName !== 'SCRIPT');
  for (const el of covered) el.inert = true;
  let choosing = false;
  const screen = mountStartScreen({ root, pixelTheme: true, storageKey: 'stillness.start.notices.v1', async onChoice(choice) {
    if (choosing) return;
    choosing = true; screen.setBusy(true); screen.setStatus('');
    try {
      const game = await loaded;
      if (!await game.launchJourney(choice)) {
        screen.setStatus('이어갈 여정이 없습니다. 처음부터 시작해 주세요.');
        return;
      }
      screen.destroy(); host.remove();
      document.documentElement.removeAttribute('data-start-open');
      for (const el of covered) el.inert = false;
    } catch {
      screen.setStatus('게임을 준비하지 못했습니다. 새로고침해 주세요.');
    } finally { choosing = false; screen.setBusy(false); }
  } });
  // 공지를 읽는 동안 게임을 준비한다. 선택 클릭의 사용자 제스처에서 시작/소리를 연다.
  const loaded = import('./main.js');
  loaded.catch(() => screen.setStatus('게임을 준비하지 못했습니다. 새로고침해 주세요.'));
}
