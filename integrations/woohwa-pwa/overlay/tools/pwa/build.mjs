// Run after Vite. No dependencies, network, timestamps or gameplay-source changes.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dist = path.resolve(root, process.argv[2] || 'dist');
const excluded = new Set(['corr','r2p','support','wb']); // Separate old experimental builds, not the main game.
const files = [];
const sha = value => createHash('sha256').update(value).digest('hex');
async function walk(dir, prefix = '') {
  for (const e of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))) {
    const name=prefix+e.name;
    if (!prefix && (excluded.has(e.name) || ['sw.js','pwa-build.json'].includes(e.name))) continue;
    if (e.isSymbolicLink()) throw new Error('PWA build cannot contain symbolic links');
    if (e.isDirectory()) await walk(path.join(dir,e.name),name+'/');
    else if (e.isFile()) { const bytes=await fs.readFile(path.join(dir,e.name));files.push({path:name,bytes:bytes.length,sha256:sha(bytes)}); }
  }
}
await walk(dist);
for (const required of ['index.html','manifest.webmanifest','pwa/icon-192.png','pwa/icon-512.png','pwa/apple-touch-icon.png']) {
  if(!files.some(f=>f.path===required))throw new Error('Missing PWA file: '+required);
}
const totalBytes=files.reduce((n,f)=>n+f.bytes,0);
if(totalBytes>30*1024*1024)throw new Error('PWA main build exceeds 30 MiB; review the offline asset list before raising this budget');
const template=await fs.readFile(new URL('./sw-template.js',import.meta.url),'utf8');
const version=sha(JSON.stringify(files)+template).slice(0,24);
const worker=template.replace('__PWA_VERSION__',JSON.stringify(version)).replace('__PWA_FILES__',JSON.stringify(files));
await fs.writeFile(path.join(dist,'sw.js'),worker);
await fs.writeFile(path.join(dist,'pwa-build.json'),JSON.stringify({version,files,totalBytes,excludedDirectories:[...excluded]},null,2)+'\n');
console.log(JSON.stringify({pwa:true,version,files:files.length,totalBytes,scope:'relative to deployed sw.js'}));
