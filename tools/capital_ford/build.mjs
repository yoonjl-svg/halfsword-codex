import {execFileSync} from 'node:child_process';
import {cp,copyFile} from 'node:fs/promises';
execFileSync('./node_modules/.bin/vite',['build','--config','vite.ford.config.js'],{stdio:'inherit'});
await copyFile('dist-ford/ford.html','dist-ford/index.html');
await cp('public/sfx','dist-ford/sfx',{recursive:true});
