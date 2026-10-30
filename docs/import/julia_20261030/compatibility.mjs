import assert from 'node:assert/strict';import fs from 'node:fs';import {pathToFileURL}from'node:url';import crypto from 'node:crypto';
const root=process.cwd(),base=process.env.RECEIVER_ROOT||'/workspace/halfsword-julia-receiver-20261030';
const b=await import(pathToFileURL(base+'/src/characters.js')),c=await import(pathToFileURL(root+'/src/characters.js'));
for(const id of Object.keys(b.CHARACTERS_BY_ID))assert.deepEqual(c.CHARACTERS_BY_ID[id],b.CHARACTERS_BY_ID[id],id);
for(const key of ['CHARACTERS','CHARACTER_VARIANTS','CHARACTER_GUESTS'])assert.deepEqual(c[key],b[key],key);
assert.deepEqual(Object.keys(c.CHARACTERS_BY_ID).filter(id=>!b.CHARACTERS_BY_ID[id]),['julia','julia_mad']);
for(const id of ['julia','julia_mad']){assert.equal(c.CHARACTERS_BY_ID[id].ai.proficiency,4);assert.equal(c.CHARACTERS_BY_ID[id].ai.persona.school,'rapier');assert.equal(c.CHARACTERS_BY_ID[id].weapon,'rapier');}
const a=JSON.parse(fs.readFileSync(new URL('./checks.json',import.meta.url))),old=JSON.parse(fs.readFileSync(new URL('./approved-geometry.json',import.meta.url)));
for(const id of ['base','alter'])assert.equal(a[id].geometryHash,old[id].geometryHash,id);
const unchanged=['src/fighter.js','src/ai.js','src/config.js','src/gait.js','src/main.js','src/lobby.js','src/lobby_progress.js','src/sword_art.js','src/secret.js','src/schools.js','src/fight_snapshot.js','package.json','package-lock.json'];
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const file of unchanged)assert.equal(sha(root+'/'+file),sha(base+'/'+file),file);
const out={receiverBase:'61a7270b1b68dd4d774687c5f80038e4a7be57df',existingCharacters:Object.keys(b.CHARACTERS_BY_ID).length,existingCharactersUnchanged:true,journeyAndWanderPoolsUnchanged:true,approvedGeometryUnchanged:true,newIds:['julia','julia_mad'],proficiency:[4,4],unchanged};
fs.writeFileSync(new URL('./compatibility.json',import.meta.url),JSON.stringify(out,null,2));console.log(out);
