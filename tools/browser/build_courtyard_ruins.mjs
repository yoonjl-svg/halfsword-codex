import {build} from 'vite';
import {cp,readFile,writeFile,mkdir} from 'node:fs/promises';
const out=process.env.COURTYARD_OUT??'/tmp/courtyard-ruins-preview-20261021';
await build({configFile:false,base:'./',publicDir:'public',plugins:[{name:'courtyard-review',transformIndexHtml:{order:'pre',handler:html=>html.replace('/src/game_entry.js','/tools/browser/courtyard_ruins_entry.js').replace('<script type="module" src="/src/pwa.js"></script>','').replace(/<link[^>]*rel="manifest"[^>]*>/g,'')}}],build:{outDir:`${out}/game`,emptyOutDir:true,copyPublicDir:false,rolldownOptions:{input:'index.html'}}});
for(const name of ['fonts','ui','sfx','icons'])await cp(`public/${name}`,`${out}/game/${name}`,{recursive:true});
await mkdir(`${out}/shots`,{recursive:true});
for(const name of ['01_fight','02_overview','03_gate_and_well','04_reverse_arcade','05_conference','06_mobile'])await cp(`docs/design/courtyard_ruins_20261021/shots/${name}.png`,`${out}/shots/${name}.png`);
await writeFile(`${out}/index.html`,await readFile('tools/browser/courtyard_ruins.html'));
console.log(`Courtyard review: ${out}`);
