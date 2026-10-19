import {trial} from './opposition_probe.mjs';import{writeFileSync}from'node:fs';
const c={weapon:'longsword',gap:1.65,attack:'zwerchL',press:.02,seed:1};
const rows=['base','slow'].map(variant=>trial(c,variant,{window:.32,record:true}));writeFileSync('replay.json',JSON.stringify({results:rows}));console.log(rows.map(r=>({variant:r.variant,triggers:r.triggers})));
