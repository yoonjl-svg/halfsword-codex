import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Research build only. The ordinary vite.config.js never imports the probe.
const root = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
  root,
  base: './',
  plugins: [{
    name: 'attack-balance-research-only',
    transformIndexHtml: {
      order: 'pre',
      handler: (html, ctx) => /index\.html$/.test(ctx.filename || ctx.path || '') ? [{
        tag: 'script', attrs: { type: 'module', src: '/src/attack_balance_probe.js' }, injectTo: 'head-prepend',
      }] : [],
    },
  }],
  server: { host: '127.0.0.1', port: 5298, strictPort: true, hmr: false },
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    rolldownOptions: { input: fileURLToPath(new URL('../../index.html', import.meta.url)) },
  },
});
