import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {CHARACTERS_BY_ID} from '../../../src/characters.js';
import {STAGE_IDS,STAGE_ORDER,STAGE_FOE,STAGE_FOE_EXTRA,STAGE_NAME_KO} from '../../../src/stages.js';
const stages=STAGE_ORDER.map(id=>({id,name:STAGE_NAME_KO[id],night:id.endsWith('_night'),main:STAGE_FOE[id],extras:STAGE_FOE_EXTRA[id]??[]}));
const characters=Object.values(CHARACTERS_BY_ID).map(c=>({id:c.id,name:c.name,variantOf:c.variantOf??null,mad:!!c.mad,stages:stages.filter(s=>s.main===c.id||s.extras.includes(c.id)).map(s=>({id:s.id,name:s.name,main:s.main===c.id,shared:s.extras.length>0}))}));
const out={observedReceiver:'6e1e9eca674016b9424f826feb2c876ff378ba71',checkout:execFileSync('git',['rev-parse','HEAD']).toString().trim(),registeredStages:STAGE_IDS.length,journeyStages:stages.length,baseCharacters:characters.filter(c=>!c.variantOf).length,alterCharacters:characters.filter(c=>c.variantOf).length,stages,characters,withoutDedicatedBaseStage:characters.filter(c=>!c.variantOf&&!c.stages.some(s=>s.main&&!s.shared)),withoutAnyStage:characters.filter(c=>!c.stages.length),withoutNight:stages.filter(s=>!s.night&&!STAGE_IDS.includes(s.id+'_night')),archivedStages:STAGE_IDS.filter(id=>!STAGE_ORDER.includes(id)).map(id=>({id,name:STAGE_NAME_KO[id]}))};
fs.writeFileSync(new URL('coverage.json',import.meta.url),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({...out,stages:undefined,characters:undefined},null,2));
