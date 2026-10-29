import {defineConfig}from'vite';
export default defineConfig({base:'./',publicDir:'public',build:{copyPublicDir:false,outDir:'dist-julia',emptyOutDir:true,rolldownOptions:{input:{main:'index.html',test:'test.html'}}}});
