import { defineConfig } from 'vite';

// base: './' 로 두면 GitHub Pages 같은 하위 경로에서도 그대로 동작한다.
// 페이지가 두 개: 게임(index.html) + 소리 들어보기(sounds.html)
export default defineConfig({
  base: './',
  server: { host: true },
  build: {
    rolldownOptions: {
      input: { main: 'index.html', sounds: 'sounds.html' },
    },
  },
});
