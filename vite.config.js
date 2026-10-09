import { defineConfig } from 'vite';

// base: './' 로 두면 GitHub Pages 같은 하위 경로에서도 그대로 동작한다.
// 게임 + 소리 들어보기 + 선택형 캐릭터 외형 보기.
export default defineConfig({
  base: './',
  server: { host: true },
  build: {
    rolldownOptions: {
      input: { main: 'index.html', sounds: 'sounds.html', characterViewer: 'character-viewer.html' },
    },
  },
});
