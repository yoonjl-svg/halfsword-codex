// Usage: node apply.mjs /path/to/halfsword [--check]
// Review/preflight first; never pushes, commits, runs builds or touches game source.
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2);if(args.length<1||args.length>2||(args[1]&&args[1]!=='--check'))throw Error('Usage: node apply.mjs /path/to/halfsword [--check]');
const root=await fs.realpath(path.resolve(args[0])),check=args[1]==='--check',changes=[];
const oldPackage=await fs.readFile(path.join(root,'package.json'),'utf8'),pkg=JSON.parse(oldPackage);
const oldHTML=await fs.readFile(path.join(root,'index.html'),'utf8');let html=oldHTML;
const command='node tools/pwa/build.mjs';
if(pkg.scripts?.build==='vite build')pkg.scripts.build+=' && '+command;
else if(pkg.scripts?.build!=='vite build && '+command)throw Error('Custom build script detected; follow README manual integration. No files changed.');
if(html.includes('src="/src/pwa.js"')&&!html.includes('href="./manifest.webmanifest"'))throw Error('Partial PWA integration detected; review manually. No files changed.');
if(!html.includes('src="/src/pwa.js"')) {
 if(/rel=["']manifest["']|src=["'][^"']*pwa\.[mc]?js["']/.test(html))throw Error('An existing PWA integration requires manual review. No files changed.');
 if(!html.includes('</head>')||!html.includes('</body>'))throw Error('Expected HTML head/body anchors missing. No files changed.');
 const tags=['<link rel="manifest" href="./manifest.webmanifest" />'];
 if(!/rel=["']apple-touch-icon["']/.test(html))tags.push('<link rel="apple-touch-icon" href="./pwa/apple-touch-icon.png" />');
 if(!/name=["']apple-mobile-web-app-title["']/.test(html))tags.push('<meta name="apple-mobile-web-app-title" content="적막" />');
 if(!/^[ \t]*<title>/m.test(html))throw Error('Expected HTML title anchor missing. No files changed.');
 html=html.replace(/^([ \t]*)<title>/m,(_,indent)=>tags.map(t=>indent+t).join('\n')+'\n'+indent+'<title>');
 html=html.replace(/([ \t]*)<\/body>/, (_,indent)=>indent+'  <script type="module" src="/src/pwa.js"></script>\n'+indent+'</body>');
}
if(!html.includes('src="/src/pwa.js"'))throw Error('PWA entry insertion failed. No files changed.');
async function safeDestination(rel) {
 const parts=rel.split('/');let p=root;
 for(const part of parts) {p=path.join(p,part);try{const stat=await fs.lstat(p);if(stat.isSymbolicLink())throw Error('Refusing symbolic-link destination: '+rel);}catch(e){if(e.code!=='ENOENT')throw e;}}
 return path.join(root,rel);
}
async function overlay(dir,prefix='') {
 for(const e of await fs.readdir(dir,{withFileTypes:true})) {
  const rel=prefix+e.name;if(e.isSymbolicLink())throw Error('Overlay contains symlink');
  if(e.isDirectory())await overlay(path.join(dir,e.name),rel+'/');
  else if(e.isFile()) {
   const target=await safeDestination(rel),bytes=await fs.readFile(path.join(dir,e.name));let existing;
   try{existing=await fs.readFile(target);}catch(e){if(e.code!=='ENOENT')throw e;}
   if(existing&&!existing.equals(bytes))throw Error('Existing file differs; refusing overwrite: '+rel);
   if(!existing)changes.push({rel,bytes,created:true});
  }
 }
}
await overlay(path.join(here,'overlay'));
const newPackage=JSON.stringify(pkg,null,2)+'\n';
if(newPackage!==oldPackage){await safeDestination('package.json');changes.push({rel:'package.json',bytes:Buffer.from(newPackage),old:oldPackage});}
if(html!==oldHTML){await safeDestination('index.html');changes.push({rel:'index.html',bytes:Buffer.from(html),old:oldHTML});}
if(check){console.log(JSON.stringify({check:true,target:root,changes:changes.map(c=>c.rel)},null,2));process.exit(0);}
if(!changes.length){console.log('Already installed; no files changed.');process.exit(0);}
const backup=await fs.mkdtemp(path.join(os.tmpdir(),'stillness-pwa-backup-'));
for(const c of changes)if(!c.created)await fs.writeFile(path.join(backup,c.rel),c.old,{flag:'wx'});
await fs.writeFile(path.join(backup,'changes.json'),JSON.stringify(changes.map(({rel,created})=>({rel,created:!!created})),null,2));
for(const c of changes){const p=path.join(root,c.rel);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,c.bytes,{flag:c.created?'wx':'w'});}
console.log(JSON.stringify({installed:true,target:root,backup,files:changes.map(c=>c.rel),next:'npm run build; inspect dist/pwa-build.json, then deploy the entire dist directory'},null,2));
