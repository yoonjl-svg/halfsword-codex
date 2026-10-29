import {defineConfig}from'vite';
export default defineConfig({base:'./',publicDir:'public',build:{copyPublicDir:false,outDir:'dist-royal',emptyOutDir:true,rolldownOptions:{input:{main:'index.html',test:'test.html'}}}});
