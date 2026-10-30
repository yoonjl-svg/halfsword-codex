import { defineConfig } from 'vite';
export default defineConfig({ base: './', publicDir: false, build: { outDir: 'dist-encyclopedia', rolldownOptions: { input: 'encyclopedia-preview.html' } } });
