import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';
import {root, port, origin} from './config.mjs';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.wasm':'application/wasm','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,origin);
 if(u.pathname==='/outside.html'||u.pathname==='/halfsword/probe.html'){
  res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end('<!doctype html><title>Lifecycle test client</title>');return;
 }
 if(!u.pathname.startsWith('/halfsword/')){res.writeHead(404);res.end();return;}
 const state=JSON.parse(await fs.readFile(root+'/server-state.json','utf8'));
 let rel=decodeURIComponent(u.pathname.slice('/halfsword/'.length))||'index.html';
 if(rel.split('/').some(p=>p==='..'||p==='.')||rel.includes('\\'))throw Error('invalid path');
 if(state.corrupt&&rel==='pwa/icon-512.png'){
  res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store'});res.end('deliberately corrupted update fixture');return;
 }
 const file=path.join(root,state.build,rel),bytes=await fs.readFile(file);
 res.writeHead(200,{'Content-Type':mime[path.extname(rel)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
 }catch{res.writeHead(404);res.end('not found');}});
server.listen(port,'127.0.0.1',()=>console.log('PWA lifecycle fixture ready on '+origin));
for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>server.close(()=>process.exit()));
