import { defineConfig } from 'vite';
export default defineConfig({base:'./',publicDir:false,server:{host:true},build:{outDir:'dist-ford',emptyOutDir:true,rolldownOptions:{input:'ford.html'}}});
