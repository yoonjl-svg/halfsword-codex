import {build} from 'vite';import fs from 'node:fs';import path from 'node:path';
const root=new URL('./',import.meta.url).pathname,out=path.resolve(root,'../../../public/encounters/julia-20261029');
await build({configFile:false,root,base:'./',publicDir:false,build:{outDir:out,emptyOutDir:true,chunkSizeWarningLimit:900}});
fs.copyFileSync(path.join(root,'model.glb'),path.join(out,'julia-kristeva.glb'));
console.log(out);
