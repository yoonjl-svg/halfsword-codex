// Read-only baseline module loader. Compare ordinary rounds without another checkout.
import {registerHooks} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const base='32b4dabaa0c2d3f2149d793e2b93516ba585db92';
registerHooks({load(url,context,nextLoad){
 if(url.startsWith('file:')){
  const path=fileURLToPath(url);
  for(const name of ['fighter.js','combat.js'])if(path.endsWith(`/src/${name}`))return {format:'module',shortCircuit:true,source:execFileSync('git',['show',`${base}:src/${name}`],{encoding:'utf8'})};
 }
 return nextLoad(url,context);
}});
