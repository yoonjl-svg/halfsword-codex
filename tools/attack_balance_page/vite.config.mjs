import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { installResearchStorage, RESEARCH_PREFIX } from './storage_bootstrap.mjs';

// Research build only. The ordinary vite.config.js never imports the probe.
const root = fileURLToPath(new URL('../../', import.meta.url));
const pwaSource = fileURLToPath(new URL('../../src/pwa.js', import.meta.url));
const pwaStub = fileURLToPath(new URL('./pwa_stub.mjs', import.meta.url));
export default defineConfig({
  root,
  base: './',
  plugins: [{
    name: 'attack-balance-no-pwa',
    enforce: 'pre',
    resolveId(source) { if (source === '/src/pwa.js' || source === pwaSource) return pwaStub; },
  }, {
    name: 'attack-balance-research-only',
    transformIndexHtml: {
      order: 'pre',
      handler: (html, ctx) => /(?:index|test)\.html$/.test(ctx.filename || ctx.path || '') ? [
        { tag: 'script', children: `(${installResearchStorage.toString()})(${JSON.stringify(RESEARCH_PREFIX)});`, injectTo: 'head-prepend' },
        ...(/index\.html$/.test(ctx.filename || ctx.path || '') ? [{ tag: 'script', attrs: { type: 'module', src: '/src/attack_balance_probe.js' }, injectTo: 'head-prepend' }] : []),
      ] : [],
    },
  }],
  server: { host: '127.0.0.1', port: 5298, strictPort: true, hmr: false },
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    rolldownOptions: { input: { main: fileURLToPath(new URL('../../index.html', import.meta.url)), test: fileURLToPath(new URL('../../test.html', import.meta.url)) } },
  },
});
