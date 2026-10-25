import { defineConfig } from 'vite';

// base: './' 로 두면 GitHub Pages 같은 하위 경로에서도 그대로 동작한다.
// 페이지가 셋: 게임(index.html) + 소리 들어보기(sounds.html) + 테스트 고르기(test.html — 무기·캐릭터를 골라 index.html?test=1… 로, docs/test_route_2026-10-10.md)
// R2′ 운동 사슬 탐색판 (public/r2p/, docs/strike/r2p_spec_2026-10-02.md §2.5): R2P_PROBE=1 로 빌드·개발 서버를 띄울 때만 src/r2p_probe.js 를
//  index.html 에 끼워 넣는다 (?chain=legs|anchor 주소 인자 + 한 줄 HUD). 본판 빌드에는 흔적이 없다 — 본판에 남는 스위치는 config BODY.chain 상수뿐.
const r2pProbe = () => ({
  name: 'r2p-probe',
  transformIndexHtml: {
    order: 'pre', // 묶기 전에 끼워야 빌드가 이 스크립트도 묶는다 (main.js 보다 앞, 문서 순서로 먼저 실행)
    handler: (html, ctx) => (process.env.R2P_PROBE && /index\.html$/.test(ctx.filename || ctx.path || '') ? [{ tag: 'script', attrs: { type: 'module', src: '/src/r2p_probe.js' }, injectTo: 'head' }] : []),
  },
});

export default defineConfig({
  base: './',
  plugins: [r2pProbe()],
  server: { host: true },
  build: {
    rolldownOptions: {
      input: { main: 'index.html', sounds: 'sounds.html', voices: 'voices.html', test: 'test.html', tournament: 'tournament.html' }, // 생사전은 별도 저장을 쓰는 검토 페이지
    },
  },
});
