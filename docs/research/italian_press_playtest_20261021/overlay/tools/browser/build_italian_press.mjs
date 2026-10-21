import {build} from 'vite';
import {cp,readFile,writeFile} from 'node:fs/promises';
const out=process.env.LAB_OUT??'/tmp/italian-press-lab';
await build({configFile:false,base:'./',publicDir:'public',plugins:[{name:'isolated-iberian-research',transformIndexHtml:{order:'pre',handler:html=>html.replace('/src/game_entry.js','/tools/browser/italian_press_entry.js').replace('<script type="module" src="/src/pwa.js"></script>','').replace(/<link[^>]*rel="manifest"[^>]*>/g,'')}}],build:{outDir:`${out}/game`,emptyOutDir:true,copyPublicDir:false,rolldownOptions:{input:'index.html'}}});
for(const name of ['fonts','ui','sfx','icons'])await cp(`public/${name}`,`${out}/game/${name}`,{recursive:true});
await writeFile(`${out}/index.html`,await readFile('tools/browser/italian_press.html'));
console.log(`Isolated Italian body lab: ${out}`);
